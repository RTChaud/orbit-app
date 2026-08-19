/**
 * app.js
 *
 * Entry point. Registers the service worker, drives the notification
 * permission banner, subscribes to push, and starts the router. Task
 * creation/rendering now lives in js/modules/*.js - this file only
 * handles app-wide startup, exactly as before.
 */

(function () {
  let swRegistration = null;
  let pushSubscription = null;

  // Exposes the current push subscription to reminders.js without a
  // circular dependency between the two files.
  window.OrbitRuntime = {
    getPushSubscription: () => pushSubscription,
  };

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
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
        OrbitReminders.rescheduleAll();
        pushSubscription = await OrbitPush.ensureSubscription(swRegistration);
        updateNotificationBanner();
      }
    );
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register("service-worker.js");

      // navigator.serviceWorker.ready resolves only once a worker is fully
      // active - subscribing before that (e.g. right after register(), on
      // a first-time install) can silently fail on some browsers.
      const readyRegistration = await navigator.serviceWorker.ready;
      swRegistration = readyRegistration;
      OrbitNotifications.setServiceWorkerRegistration(readyRegistration);

      if (OrbitNotifications.getPermission() === "granted") {
        pushSubscription = await OrbitPush.ensureSubscription(readyRegistration);
      }
    } catch (err) {
      console.warn("Orbit: service worker registration failed", err);
    }
  }

  function init() {
    registerServiceWorker();

    // Clear the icon badge (the red "1") set when a reminder fired -
    // opening Orbit counts as having seen it.
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }

    OrbitReminders.rescheduleAll();
    updateNotificationBanner();

    // Called by notifications.js when a local (foreground) timer fires.
    window.onOrbitTaskNotified = function (itemId) {
      OrbitItems.update(itemId, { notified: true });
      OrbitRouter.renderCurrent();
    };

    OrbitRouter.init(document.getElementById("view-root"), document.getElementById("app-header"));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
