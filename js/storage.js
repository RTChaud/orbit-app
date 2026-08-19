/**
 * storage.js
 *
 * Generic localStorage helper. Nothing in here is task/item-specific -
 * that lives in js/data/*.js. Kept as the single place that talks to
 * localStorage so it's easy to swap later (IndexedDB, a synced backend).
 */

const OrbitDB = (() => {
  function readKey(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error(`Orbit: failed to read "${key}" from storage`, err);
      return fallback;
    }
  }

  function writeKey(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Orbit: failed to write "${key}" to storage`, err);
    }
  }

  function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return { readKey, writeKey, generateId };
})();
