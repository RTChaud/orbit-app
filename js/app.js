/**
 * app.js
 *
 * Entry point. Wires together storage, notifications and ui.
 */

(function () {
  let swRegistration = null;
  let pushSubscription = null;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function refreshTaskList() {
    const tasks = OrbitStorage.getTasks();
    OrbitUI.renderTasks(tasks, handleDeleteTask);
  }

  function handleDeleteTask(taskId) {
    OrbitNotifications.cancel(taskId);
    OrbitPush.cancelReminder(taskId);
    OrbitStorage.deleteTask(taskId);
    refreshTaskList();
  }

  function buildTimestamp(dateStr, timeStr) {
    // Combine the <input type="date"> and <input type="time"> values into
    // a single local-time Date. Using the constructor directly (rather
    // than Date.parse) avoids UTC-vs-local ambiguity.
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hour, minute] = timeStr.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    const values = OrbitUI.getFormValues();

    if (!values.name) {
      OrbitUI.showFormError("Please enter a task name.");
      return;
    }
    if (!values.date || !values.time) {
      OrbitUI.showFormError("Please choose a date and time.");
      return;
    }

    const when = buildTimestamp(values.date, values.time);

    if (when.getTime() <= Date.now()) {
      OrbitUI.showFormError("Please choose a date and time in the future.");
      return;
    }

    const task = {
      id: OrbitStorage.generateId(),
      name: values.name,
      description: values.description,
      date: values.date,
      time: values.time,
      timestamp: when.getTime(),
      notified: false,
      createdAt: Date.now(),
    };

    OrbitStorage.addTask(task);

    if (OrbitNotifications.getPermission() === "granted") {
      OrbitNotifications.schedule(task);
      OrbitPush.saveReminder(task, pushSubscription);
    }

    OrbitUI.closeModal();
    refreshTaskList();
  }

  function updateNotificationBanner() {
    if (!OrbitNotifications.isSupported()) {
      OrbitUI.showBanner(
        "This browser doesn't support notifications.",
        "Dismiss",
        OrbitUI.hideBanner
      );
      return;
    }

    if (isIOS() && !isStandalone()) {
      OrbitUI.showBanner(
        "On iPhone, notifications only work once Orbit is added to your Home Screen. Tap Share \u2192 Add to Home Screen, then open Orbit from the icon.",
        "Got it",
        OrbitUI.hideBanner
      );
      return;
    }

    const permission = OrbitNotifications.getPermission();

    if (permission === "granted") {
      OrbitUI.hideBanner();
      return;
    }

    if (permission === "denied") {
      OrbitUI.showBanner(
        "Notifications are blocked for Orbit. Enable them in your device or browser settings to get reminders.",
        "Dismiss",
        OrbitUI.hideBanner
      );
      return;
    }

    // permission === "default"
    OrbitUI.showBanner(
      "Turn on notifications so Orbit can remind you when a task is due.",
      "Enable notifications",
      async () => {
        await OrbitNotifications.requestPermission();
        // Any tasks already saved should now be armed.
        OrbitNotifications.rescheduleAll(OrbitStorage.getTasks());
        pushSubscription = await OrbitPush.ensureSubscription(swRegistration);
        updateNotificationBanner();
      }
    );
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("service-worker.js");
      swRegistration = registration;
      OrbitNotifications.setServiceWorkerRegistration(registration);

      if (OrbitNotifications.getPermission() === "granted") {
        pushSubscription = await OrbitPush.ensureSubscription(registration);
      }
    } catch (err) {
      console.warn("Orbit: service worker registration failed", err);
    }
  }

  function init() {
    registerServiceWorker();

    refreshTaskList();
    OrbitNotifications.rescheduleAll(OrbitStorage.getTasks());
    updateNotificationBanner();

    // Called by notifications.js when a scheduled reminder actually fires.
    window.onOrbitTaskNotified = function (taskId) {
      OrbitStorage.updateTask(taskId, { notified: true });
      refreshTaskList();
    };

    OrbitUI.el.bannerBtn.addEventListener("click", () => {}); // handler set dynamically in showBanner

    document.getElementById("add-task-btn").addEventListener("click", OrbitUI.openModal);
    document.getElementById("modal-close-btn").addEventListener("click", OrbitUI.closeModal);
    document.getElementById("cancel-task-btn").addEventListener("click", OrbitUI.closeModal);
    document.getElementById("task-form").addEventListener("submit", handleFormSubmit);

    OrbitUI.el.modal.addEventListener("click", (event) => {
      if (event.target === OrbitUI.el.modal) OrbitUI.closeModal();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
