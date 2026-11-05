/**
 * data/routines.js
 *
 * Everything that changes a Routine. A routine is one item (see
 * data/items.js) with exactly ONE pending occurrence at a time, held in
 * `k` / `scheduledAt` / `dueAt`. Finished occurrences go to `history`, so
 * pending state and history are kept apart. Because the pending occurrence
 * is the item's own dueAt, Soon / Upcoming / Calendar need no copies, and
 * there is nothing that could create a duplicate.
 *
 * The schedule itself always comes from the rule and its original anchor
 * (data/recurrence.js), never from when something was completed - so
 * early, late, skipped or snoozed never shifts it.
 *
 * Every action takes the occurrence index `k` the caller was looking at.
 * If that is no longer the pending one (a double tap, a retry, a stale
 * screen) the action does nothing, so each action is safe to repeat.
 *
 * Each change bumps `rev` and re-syncs the routine to the Cloudflare
 * Worker (via OrbitReminders.syncRoutine), which is what keeps notifying -
 * and moves on to the next occurrence - while Orbit is closed.
 */

const OrbitRoutines = (() => {
  const HISTORY_CAP = 100;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function deviceTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (err) {
      return "UTC";
    }
  }

  // Strictly increasing per routine, and still newer than any older
  // device/backup copy, because it is based on the clock.
  function nextRev(previous) {
    return Math.max(Date.now(), (previous || 0) + 1);
  }

  // --- Upgrading routines from before recurrence rules existed -------------

  // Old routines only had { unit, interval } and a next due date. The next
  // due date becomes the anchor, so they carry on exactly as before.
  function ruleFromLegacy(item) {
    const tz = deviceTimeZone();
    const legacy = item.recurrence || {};
    const interval = Math.max(1, parseInt(legacy.interval, 10) || 1);
    const p = OrbitRecurrence.localParts(item.dueAt, tz);
    const time = `${pad(p.hh)}:${pad(p.mm)}`;
    if (legacy.unit === "month") {
      return {
        freq: "monthly",
        interval,
        time,
        tz,
        anchor: `${p.y}-${pad(p.m)}-01`,
        monthly: { mode: "day", day: p.d },
      };
    }
    return {
      freq: legacy.unit === "day" ? "daily" : "weekly",
      interval,
      time,
      tz,
      anchor: `${p.y}-${pad(p.m)}-${pad(p.d)}`,
    };
  }

  // Returns the routine in its current shape, upgrading it if needed.
  function ensure(item) {
    if (!item || item.type !== "routine") return null;
    if (OrbitRecurrence.isValidRule(item.rule)) return item;
    if (typeof item.dueAt !== "number") return null;

    const rule = ruleFromLegacy(item);
    const scheduledAt = OrbitRecurrence.scheduledAt(rule, 0);
    return OrbitItems.update(item.id, {
      rule,
      k: 0,
      scheduledAt,
      dueAt: scheduledAt,
      hasTime: true,
      paused: false,
      history: [],
      rev: nextRev(item.rev),
    });
  }

  function migrateAll() {
    OrbitItems.getAll()
      .filter((i) => i.type === "routine" && !OrbitRecurrence.isValidRule(i.rule))
      .forEach(ensure);
  }

  // --- Creating ----------------------------------------------------------------

  // The first pending occurrence is the first one that hasn't already
  // passed, counted from the original anchor - so a start date in the past
  // never creates a backlog, and the cycle still lines up with the anchor.
  function create({ name, description, rule }) {
    if (!OrbitRecurrence.isValidRule(rule)) throw new Error("Invalid recurrence rule");
    const k = OrbitRecurrence.indexAtOrAfter(rule, Date.now());
    const scheduledAt = OrbitRecurrence.scheduledAt(rule, k);
    const item = OrbitItems.create({
      type: "routine",
      name,
      description: description || "",
      rule,
      k,
      scheduledAt,
      dueAt: scheduledAt,
      hasTime: true,
      paused: false,
      history: [],
      lastCompletedAt: null,
      rev: nextRev(0),
    });
    OrbitReminders.syncRoutine(item);
    return item;
  }

  // --- Completing / skipping ----------------------------------------------------

  // Records the pending occurrence in history and moves to the next one.
  // The next one is the first occurrence after BOTH this one and now:
  // completing early moves to the following occurrence, and completing an
  // occurrence so late that later ones have also come due counts as
  // covering them (no backlog of identical chores to tap through).
  function resolve(id, expectedK, status) {
    const routine = ensure(OrbitItems.get(id));
    if (!routine || routine.paused) return routine;
    if (typeof expectedK === "number" && routine.k !== expectedK) return routine; // already handled

    const now = Date.now();
    const rule = routine.rule;
    const history = (routine.history || [])
      .filter((h) => h.k !== routine.k)
      .concat({ k: routine.k, scheduledAt: routine.scheduledAt, status, at: now })
      .slice(-HISTORY_CAP);

    const nextK = Math.max(routine.k + 1, OrbitRecurrence.indexAfter(rule, now));
    const nextScheduled = OrbitRecurrence.scheduledAt(rule, nextK);

    const updated = OrbitItems.update(id, {
      history,
      k: nextK,
      scheduledAt: nextScheduled,
      dueAt: nextScheduled,
      notified: false,
      lastCompletedAt: status === "completed" ? now : routine.lastCompletedAt || null,
      rev: nextRev(routine.rev),
    });
    OrbitReminders.syncRoutine(updated);
    return updated;
  }

  function complete(id, expectedK) {
    return resolve(id, expectedK, "completed");
  }

  function skip(id, expectedK) {
    return resolve(id, expectedK, "skipped");
  }

  // --- Snooze / reschedule (this occurrence only) ---------------------------------

  // Moves only this occurrence's due time; the rule and anchor are
  // untouched, so the occurrence after it is exactly where it always was.
  // The new time must be in the future and before that next occurrence -
  // past that it would really be a skip, which has its own action.
  function rescheduleTo(id, targetMs, expectedK) {
    const routine = ensure(OrbitItems.get(id));
    if (!routine || routine.paused) return { ok: false, reason: "unavailable" };
    if (typeof expectedK === "number" && routine.k !== expectedK) return { ok: false, reason: "stale" };
    if (!(targetMs > Date.now())) return { ok: false, reason: "past" };
    if (targetMs >= OrbitRecurrence.scheduledAt(routine.rule, routine.k + 1)) {
      return { ok: false, reason: "after-next" };
    }

    const updated = OrbitItems.update(id, {
      dueAt: targetMs,
      notified: false,
      rev: nextRev(routine.rev),
    });
    OrbitReminders.syncRoutine(updated);
    return { ok: true, item: updated };
  }

  function snoozeBy(id, minutes, expectedK) {
    return rescheduleTo(id, Date.now() + minutes * 60000, expectedK);
  }

  // Puts a snoozed occurrence back on its original time.
  function resetSchedule(id, expectedK) {
    const routine = ensure(OrbitItems.get(id));
    if (!routine || routine.paused) return null;
    if (typeof expectedK === "number" && routine.k !== expectedK) return routine;
    if (routine.dueAt === routine.scheduledAt) return routine;
    const updated = OrbitItems.update(id, {
      dueAt: routine.scheduledAt,
      notified: false,
      rev: nextRev(routine.rev),
    });
    OrbitReminders.syncRoutine(updated);
    return updated;
  }

  // --- Pause / resume ---------------------------------------------------------------

  function pause(id) {
    const routine = ensure(OrbitItems.get(id));
    if (!routine || routine.paused) return routine;
    const updated = OrbitItems.update(id, {
      paused: true,
      pausedAt: Date.now(),
      rev: nextRev(routine.rev),
    });
    OrbitReminders.syncRoutine(updated);
    return updated;
  }

  // Picks up at the next occurrence on the ORIGINAL schedule that is still
  // ahead. Nothing is created for the time it was paused, and it never goes
  // backwards: resuming straight away gives back the occurrence that was
  // pending (not one already completed or skipped), while resuming after a
  // long pause jumps over everything that was missed.
  function resume(id) {
    const routine = ensure(OrbitItems.get(id));
    if (!routine || !routine.paused) return routine;
    const k = Math.max(routine.k, OrbitRecurrence.indexAtOrAfter(routine.rule, Date.now()));
    const scheduledAt = OrbitRecurrence.scheduledAt(routine.rule, k);
    const updated = OrbitItems.update(id, {
      paused: false,
      pausedAt: null,
      k,
      scheduledAt,
      dueAt: scheduledAt,
      notified: false,
      rev: nextRev(routine.rev),
    });
    OrbitReminders.syncRoutine(updated);
    return updated;
  }

  // --- Reading ------------------------------------------------------------------------

  // 'paused' | 'overdue' | 'pending'
  function getState(routine, now) {
    if (routine.paused) return "paused";
    return routine.dueAt < (now || Date.now()) ? "overdue" : "pending";
  }

  function isSnoozed(routine) {
    return !routine.paused && routine.dueAt !== routine.scheduledAt;
  }

  return {
    ensure,
    migrateAll,
    create,
    complete,
    skip,
    rescheduleTo,
    snoozeBy,
    resetSchedule,
    pause,
    resume,
    getState,
    isSnoozed,
    deviceTimeZone,
  };
})();
