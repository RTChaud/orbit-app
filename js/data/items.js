/**
 * data/items.js
 *
 * Every dated or actionable thing in Orbit - a Soon reminder, an Upcoming
 * task, a Routine, a plain Task, a Waiting item - is one "item" in one
 * table. Soon, Upcoming and Calendar are just different filtered/sorted
 * views over this same table, per the shared-architecture requirement:
 * there is never a separate copy of a task for each screen it appears on.
 *
 * Item shape:
 * {
 *   id, type,            // 'soon' | 'upcoming' | 'routine' | 'task' | 'waiting'
 *   name, description,
 *   dueAt,                // ms timestamp, or null/undefined if undated
 *   hasTime,               // whether dueAt includes a meaningful time of day
 *   completed, completedAt,
 *   notified,               // local (foreground) notification already fired
 *   createdAt,
 * }
 *
 * A Routine is the same item, plus (all managed by data/routines.js):
 *   rule        the recurrence (see data/recurrence.js) incl. the original anchor
 *   k           index of the one pending occurrence
 *   scheduledAt when that occurrence is scheduled; dueAt is when it is
 *               actually due (they differ only if it was snoozed)
 *   paused, history, lastCompletedAt, rev
 * dueAt is always the pending occurrence, so a routine appears in Soon,
 * Upcoming and Calendar exactly like any other dated item - no copies.
 * (Routines created before this version have `recurrence` instead of
 * `rule`; data/routines.js upgrades them in place the first time they load.)
 */

const OrbitItems = (() => {
  const KEY = "orbit.items";
  const DAY_MS = 24 * 60 * 60 * 1000;

  function getAll() {
    return OrbitDB.readKey(KEY, []);
  }

  function saveAll(items) {
    OrbitDB.writeKey(KEY, items);
  }

  function get(id) {
    return getAll().find((i) => i.id === id) || null;
  }

  function create(fields) {
    const items = getAll();
    const item = {
      id: OrbitDB.generateId("item"),
      completed: false,
      notified: false,
      createdAt: Date.now(),
      ...fields,
    };
    items.push(item);
    saveAll(items);
    return item;
  }

  function update(id, updates) {
    const items = getAll();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates };
    saveAll(items);
    return items[index];
  }

  function remove(id) {
    const item = get(id);
    saveAll(getAll().filter((i) => i.id !== id));
    // A routine also lives on the Worker (that's what lets it keep
    // notifying while Orbit is closed) - deleting it must remove it there.
    if (item && item.type === "routine" && typeof OrbitReminders !== "undefined") {
      OrbitReminders.deleteRoutine(id);
    }
  }

  // Completing a Routine completes its current occurrence and schedules
  // the next one - it is never marked permanently done.
  function complete(id) {
    const item = get(id);
    if (!item) return null;

    if (item.type === "routine") return OrbitRoutines.complete(id);

    return update(id, { completed: true, completedAt: Date.now() });
  }

  // --- Views ---

  // Paused routines keep their data but generate nothing visible.
  function isActive(item) {
    return !item.completed && !item.paused && typeof item.dueAt === "number";
  }

  // Anything due within the configurable Soon window (Settings, default
  // 24h) - including anything already overdue. Items created directly in
  // Soon are always shown, whatever the window.
  function getSoonItems() {
    const cutoff = Date.now() + OrbitPrefs.getSoonWindowMs();
    return getAll()
      .filter((i) => isActive(i) && (i.type === "soon" || i.dueAt <= cutoff))
      .sort((a, b) => a.dueAt - b.dueAt);
  }

  function getUpcomingItems() {
    return getAll()
      .filter(
        (i) =>
          isActive(i) && (i.type === "upcoming" || i.type === "task" || i.type === "routine")
      )
      .sort((a, b) => a.dueAt - b.dueAt);
  }

  // Active routines by next due; paused ones sink to the bottom.
  function getRoutines() {
    return getAll()
      .filter((i) => i.type === "routine")
      .sort((a, b) => {
        if (Boolean(a.paused) !== Boolean(b.paused)) return a.paused ? 1 : -1;
        return (a.dueAt || 0) - (b.dueAt || 0);
      });
  }

  function getOpenTasks() {
    return getAll()
      .filter((i) => i.type === "task" && !i.completed)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function getWaitingItems() {
    return getAll()
      .filter((i) => i.type === "waiting" && !i.completed)
      .sort((a, b) => {
        if (typeof a.dueAt === "number" && typeof b.dueAt === "number") return a.dueAt - b.dueAt;
        if (typeof a.dueAt === "number") return -1;
        if (typeof b.dueAt === "number") return 1;
        return a.createdAt - b.createdAt;
      });
  }

  // All dated items falling within [startMs, endMs) - used by Calendar.
  function getItemsInRange(startMs, endMs) {
    return getAll()
      .filter((i) => isActive(i) && i.dueAt >= startMs && i.dueAt < endMs)
      .sort((a, b) => a.dueAt - b.dueAt);
  }

  return {
    getAll,
    get,
    create,
    update,
    remove,
    complete,
    getSoonItems,
    getUpcomingItems,
    getRoutines,
    getOpenTasks,
    getWaitingItems,
    getItemsInRange,
    DAY_MS,
  };
})();
