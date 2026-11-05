/**
 * reminders.js
 *
 * The ONLY file that connects Orbit's item model to the existing
 * notification system (js/notifications.js and js/push.js). Neither of
 * those files knows about items - they work on any object shaped like
 * { id, name, description, timestamp }, so this file adapts an item (which
 * uses `dueAt`) into that shape.
 *
 * Two paths, one notification system:
 *  - ordinary items: a one-shot reminder (local timer + a row in the
 *    Worker's `reminders` table, deleted once sent).
 *  - routines: the same local timer, plus the routine's whole schedule is
 *    kept on the Worker (`routines` table), which sends each occurrence's
 *    notification and then moves itself on to the next one - so it keeps
 *    working when Orbit is never opened.
 */

const OrbitReminders = (() => {
  // setTimeout can't wait longer than this (~24.8 days).
  const MAX_TIMER_MS = 2147483647;

  function toReminderPayload(item) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      timestamp: item.dueAt,
    };
  }

  async function getSubscription() {
    let subscription = window.OrbitRuntime && window.OrbitRuntime.getPushSubscription();

    // The cached subscription can still be null this early - getting one
    // needs a network round-trip (fetching the worker's VAPID key) that
    // runs in the background on app load. Without this, a task created
    // quickly after opening Orbit would silently never get saved to the
    // worker at all - it'd still look fine in the app, just with nothing
    // backing it beyond the local, foreground-only timer.
    if (!subscription && OrbitPush.isConfigured()) {
      const registration = window.OrbitRuntime && window.OrbitRuntime.getServiceWorkerRegistration();
      if (registration) {
        subscription = await OrbitPush.ensureSubscription(registration);
      }
    }
    return subscription;
  }

  // --- Ordinary items --------------------------------------------------------

  async function scheduleOneShot(item) {
    if (!item || item.completed || typeof item.dueAt !== "number") return;
    if (OrbitNotifications.getPermission() !== "granted") return;

    const payload = toReminderPayload(item);
    OrbitNotifications.schedule(payload);

    // Already due: its reminder was saved on the Worker when it was
    // created, which has either sent it or is about to. Saving it again
    // here (this runs for every item each time Orbit opens) would make the
    // Worker send the same notification again.
    if (item.dueAt <= Date.now()) return;

    OrbitPush.saveReminder(payload, await getSubscription());
  }

  // --- Routines ---------------------------------------------------------------

  // Brings the local timer and the Worker in line with the routine as it
  // is now. Safe to call as often as you like: the Worker only takes the
  // routine's state when its `rev` is newer than what it already has.
  async function syncRoutine(item) {
    if (!item || item.type !== "routine") return;

    OrbitNotifications.cancel(item.id);
    if (OrbitNotifications.getPermission() !== "granted") return;

    const delay = item.dueAt - Date.now();
    if (!item.paused && !item.notified && delay > 0 && delay < MAX_TIMER_MS) {
      OrbitNotifications.schedule(toReminderPayload(item));
    }

    OrbitPush.saveRoutine(item, await getSubscription());
  }

  function deleteRoutine(id) {
    OrbitNotifications.cancel(id);
    OrbitPush.cancelRoutine(id);
  }

  // --- Public ---------------------------------------------------------------------

  function scheduleItem(item) {
    if (item && item.type === "routine") return syncRoutine(item);
    return scheduleOneShot(item);
  }

  // Stops the pending notification for an item. For a routine this only
  // stops the local timer: its schedule stays on the Worker and is updated
  // by syncRoutine() once the new state is known (or removed by
  // deleteRoutine() when the routine itself is deleted).
  function cancelItem(id) {
    OrbitNotifications.cancel(id);
    const item = OrbitItems.get(id);
    if (item && item.type === "routine") return;
    OrbitPush.cancelReminder(id);
  }

  // Re-arm every pending item's reminder - called on app load, since
  // local timers don't survive a page reload.
  function rescheduleAll() {
    OrbitRoutines.migrateAll();
    OrbitItems.getAll().forEach(scheduleItem);
  }

  return { scheduleItem, syncRoutine, deleteRoutine, cancelItem, rescheduleAll };
})();
