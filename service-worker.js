/**
 * service-worker.js
 *
 * v1 responsibilities:
 *  - Make Orbit installable (required by iOS/most browsers).
 *  - Cache the app shell so it loads offline.
 *  - Provide `registration.showNotification()`, used by js/notifications.js
 *    as the preferred way to display reminders.
 *
 * It does NOT yet handle real Web Push ('push' events) - that's a
 * separate, later feature that needs a backend to send pushes at the
 * right time. See README.md.
 */

const CACHE_NAME = "orbit-shell-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/app.js",
  "./js/ui.js",
  "./js/storage.js",
  "./js/notifications.js",
  "./js/push.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Let a saved reminder be tapped to bring Orbit to the foreground.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow("./index.html");
    })
  );
});

// Real push notifications, sent by the Orbit worker (see /worker) even
// when this app isn't open. This is what actually survives a locked
// screen or a fully closed app - the local setTimeout scheduling in
// js/notifications.js only works while Orbit is running in the foreground.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = {};
  }

  const title = data.title || "Orbit";
  const options = {
    body: data.body || "Reminder from Orbit",
    icon: "icons/logo.png",
    badge: "icons/logo.png",
    tag: data.tag || "orbit-reminder",
    requireInteraction: true,
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);

      // App icon badge (the small red "1"). Supported on installed
      // iOS home-screen apps since iOS 16.4, same as notifications. Not
      // an accurate unread count - just "something needs your attention" -
      // it's cleared in app.js as soon as Orbit is opened.
      if ("setAppBadge" in navigator) {
        try {
          await navigator.setAppBadge(1);
        } catch (err) {
          // Badging isn't supported everywhere - fine to ignore.
        }
      }
    })()
  );
});
