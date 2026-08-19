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

  function scheduleItem(item) {
    if (!item || item.completed || typeof item.dueAt !== "number") return;
    if (OrbitNotifications.getPermission() !== "granted") return;

    const payload = toReminderPayload(item);
    OrbitNotifications.schedule(payload);

    const subscription = window.OrbitRuntime && window.OrbitRuntime.getPushSubscription();
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
