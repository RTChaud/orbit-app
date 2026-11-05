/**
 * push.js
 *
 * Client side of real (locked-screen / closed-app) notifications.
 * Talks to the Cloudflare Worker in /worker to:
 *   - subscribe this install of Orbit to push
 *   - tell the server about a reminder (task + due time)
 *   - cancel a reminder if the task is deleted
 *
 * If ORBIT_CONFIG.serverUrl isn't set, every function here is a no-op -
 * Orbit still works with local, foreground-only scheduling (see
 * notifications.js), it just won't survive the app being backgrounded.
 */

const OrbitPush = (() => {
  function isConfigured() {
    return Boolean(ORBIT_CONFIG.serverUrl) && "PushManager" in window;
  }

  // Web Push subscription keys are base64url-encoded; the browser API
  // wants them as a Uint8Array. This is the standard conversion helper
  // used in most Web Push examples.
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function ensureSubscription(swRegistration) {
    if (!isConfigured() || !swRegistration) return null;

    try {
      const existing = await swRegistration.pushManager.getSubscription();
      if (existing) return existing;

      const res = await fetch(`${ORBIT_CONFIG.serverUrl}/api/vapid-public-key`);
      if (!res.ok) throw new Error("Failed to fetch VAPID public key");
      const { publicKey } = await res.json();

      return await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch (err) {
      console.warn("Orbit: push subscription failed", err);
      return null;
    }
  }

  async function saveReminder(task, subscription) {
    if (!isConfigured() || !subscription) return;

    try {
      await fetch(`${ORBIT_CONFIG.serverUrl}/api/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          name: task.name,
          description: task.description,
          dueAt: new Date(task.timestamp).toISOString(),
          subscription,
        }),
      });
    } catch (err) {
      console.warn("Orbit: failed to save reminder on server", err);
    }
  }

  // A routine's whole schedule lives on the Worker, so it can keep
  // notifying (and move on to the next occurrence) while Orbit is closed.
  // The Worker keeps whichever copy has the higher `rev`, which makes
  // repeating this call harmless.
  async function saveRoutine(routine, subscription) {
    if (!isConfigured() || !subscription) return;

    try {
      await fetch(`${ORBIT_CONFIG.serverUrl}/api/routines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: routine.id,
          name: routine.name,
          description: routine.description,
          rule: routine.rule,
          k: routine.k,
          dueAt: routine.dueAt,
          paused: Boolean(routine.paused),
          rev: routine.rev,
          subscription,
        }),
      });
    } catch (err) {
      console.warn("Orbit: failed to save routine on server", err);
    }
  }

  async function cancelRoutine(routineId) {
    if (!isConfigured()) return;

    try {
      await fetch(`${ORBIT_CONFIG.serverUrl}/api/routines/${encodeURIComponent(routineId)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("Orbit: failed to delete routine on server", err);
    }
  }

  async function cancelReminder(taskId) {
    if (!isConfigured()) return;

    try {
      await fetch(`${ORBIT_CONFIG.serverUrl}/api/reminders/${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("Orbit: failed to cancel reminder on server", err);
    }
  }

  return {
    isConfigured,
    ensureSubscription,
    saveReminder,
    cancelReminder,
    saveRoutine,
    cancelRoutine,
  };
})();
