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
 *   recurrence,              // { unit: 'day'|'week'|'month', interval } - routines only
 *   lastCompletedAt,          // routines only
 *   createdAt,
 * }
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
    saveAll(getAll().filter((i) => i.id !== id));
  }

  // Moves a routine to its next occurrence rather than marking it
  // permanently done - completing a Routine completes this occurrence.
  function advanceRecurrence(dueAt, recurrence) {
    const next = new Date(dueAt);
    const { unit, interval } = recurrence;
    if (unit === "day") next.setDate(next.getDate() + interval);
    else if (unit === "week") next.setDate(next.getDate() + interval * 7);
    else if (unit === "month") next.setMonth(next.getMonth() + interval);
    return next.getTime();
  }

  function complete(id) {
    const item = get(id);
    if (!item) return null;

    if (item.type === "routine" && item.recurrence && typeof item.dueAt === "number") {
      const nextDueAt = advanceRecurrence(item.dueAt, item.recurrence);
      return update(id, { dueAt: nextDueAt, lastCompletedAt: Date.now(), notified: false });
    }

    return update(id, { completed: true, completedAt: Date.now() });
  }

  // --- Views ---

  function getSoonItems() {
    const cutoff = Date.now() + DAY_MS;
    return getAll()
      .filter((i) => !i.completed && typeof i.dueAt === "number" && i.dueAt <= cutoff)
      .sort((a, b) => a.dueAt - b.dueAt);
  }

  function getUpcomingItems() {
    return getAll()
      .filter(
        (i) =>
          !i.completed &&
          (i.type === "upcoming" || i.type === "task") &&
          typeof i.dueAt === "number"
      )
      .sort((a, b) => a.dueAt - b.dueAt);
  }

  function getRoutines() {
    return getAll()
      .filter((i) => i.type === "routine")
      .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
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
      .filter((i) => !i.completed && typeof i.dueAt === "number" && i.dueAt >= startMs && i.dueAt < endMs)
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
