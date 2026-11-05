/**
 * reminders.js
 *
 * The ONLY file that connects Orbit's new item model to the existing
 * notification system (js/notifications.js and js/push.js). Neither of
 * those files is touched by this feature - they already work on any
 * object shaped like { id, name, description, timestamp }, so this file
 * just adapts an item (which uses `dueAt`) into that shape.
 */

const OrbitReminders = (() => {
  function toReminderPayload(item) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      timestamp: item.dueAt,
    };
  }

  async function scheduleItem(item) {
    if (!item || item.completed || typeof item.dueAt !== "number") return;
    if (OrbitNotifications.getPermission() !== "granted") return;

    const payload = toReminderPayload(item);
    OrbitNotifications.schedule(payload);

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

    OrbitPush.saveReminder(payload, subscription);
  }

  function cancelItem(id) {
    OrbitNotifications.cancel(id);
    OrbitPush.cancelReminder(id);
  }

  // Re-arm every pending item's reminder - called on app load, since
  // local timers don't survive a page reload.
  function rescheduleAll() {
    OrbitItems.getAll().forEach(scheduleItem);
  }

  return { scheduleItem, cancelItem, rescheduleAll };
})();
