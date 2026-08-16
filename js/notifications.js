/**
 * notifications.js
 *
 * Handles Notification permission and local scheduling.
 *
 * IMPORTANT LIMITATION (read this before debugging "it didn't fire"):
 * Browsers do not provide a reliable way to wake up a closed app at a
 * future time. What we do here is schedule a setTimeout() while Orbit
 * is open. That timer only fires while the tab/app is actually running.
 * On iOS in particular, a backgrounded home-screen web app is usually
 * suspended within seconds, so the timer will not fire if the app isn't
 * in the foreground when the target time arrives.
 *
 * This is fine for proving the core loop (create -> schedule -> notify)
 * works, but a real "notify me even if the app is closed" feature needs
 * server-sent Web Push, which is a separate, larger feature (see README).
 */

const OrbitNotifications = (() => {
  // taskId -> timeout handle, so we can cancel/reschedule
  const timers = new Map();

  let swRegistration = null;

  function isSupported() {
    return "Notification" in window;
  }

  function getPermission() {
    return isSupported() ? Notification.permission : "unsupported";
  }

  async function requestPermission() {
    if (!isSupported()) return "unsupported";
    // Must be called from a user gesture (e.g. a button click handler).
    const result = await Notification.requestPermission();
    return result;
  }

  function setServiceWorkerRegistration(registration) {
    swRegistration = registration;
  }

  async function fireNotification(task) {
    const title = task.name;
    const options = {
      body: task.description ? task.description : "Reminder from Orbit",
      icon: "icons/logo.png",
      badge: "icons/logo.png",
      tag: task.id,
      requireInteraction: true,
    };

    // Prefer showing via the service worker registration when available -
    // this is the more reliable path on iOS home-screen apps and is
    // required if we later move to real Web Push.
    if (swRegistration && swRegistration.showNotification) {
      try {
        await swRegistration.showNotification(title, options);
        return;
      } catch (err) {
        console.warn("Orbit: showNotification via service worker failed, falling back", err);
      }
    }

    try {
      new Notification(title, options);
    } catch (err) {
      console.error("Orbit: failed to show notification", err);
    }
  }

  function schedule(task) {
    cancel(task.id);

    const delay = task.timestamp - Date.now();

    // Already in the past, or too far out for setTimeout's 32-bit limit
    // (~24.8 days). For v1 we only support reasonably near-term reminders.
    if (delay <= 0) return;
    const MAX_DELAY = 2147483647; // ~24.8 days, the max setTimeout supports
    if (delay > MAX_DELAY) {
      console.warn("Orbit: task is too far in the future to schedule locally", task);
      return;
    }

    const handle = setTimeout(() => {
      fireNotification(task);
      timers.delete(task.id);
      if (typeof window.onOrbitTaskNotified === "function") {
        window.onOrbitTaskNotified(task.id);
      }
    }, delay);

    timers.set(task.id, handle);
  }

  function cancel(taskId) {
    if (timers.has(taskId)) {
      clearTimeout(timers.get(taskId));
      timers.delete(taskId);
    }
  }

  // Re-arm timers for every not-yet-fired, future task. Needed because
  // JS timers are wiped whenever the page reloads or the app relaunches.
  function rescheduleAll(tasks) {
    tasks.forEach((task) => {
      if (!task.notified && task.timestamp > Date.now()) {
        schedule(task);
      }
    });
  }

  return {
    isSupported,
    getPermission,
    requestPermission,
    setServiceWorkerRegistration,
    schedule,
    cancel,
    rescheduleAll,
  };
})();
