/**
 * data/backup.js
 *
 * Export bundles every piece of Orbit's data (items, shopping lists,
 * custom lists) into one JSON object. Import always fully replaces what's
 * there - no merging - since the whole point is "get back to exactly
 * this state" after a reinstall wipes local storage.
 */

const OrbitBackup = (() => {
  const KEYS = {
    items: "orbit.items",
    shoppingLists: "orbit.shopping.lists",
    lists: "orbit.lists",
  };

  function exportData() {
    return {
      app: "orbit",
      version: 1,
      exportedAt: new Date().toISOString(),
      items: OrbitDB.readKey(KEYS.items, []),
      shoppingLists: OrbitDB.readKey(KEYS.shoppingLists, []),
      lists: OrbitDB.readKey(KEYS.lists, []),
    };
  }

  // Fully replaces existing data - anything not present in the file is
  // cleared, not left alone.
  function importData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Not a valid Orbit backup file.");
    }
    OrbitDB.writeKey(KEYS.items, Array.isArray(data.items) ? data.items : []);
    OrbitDB.writeKey(KEYS.shoppingLists, Array.isArray(data.shoppingLists) ? data.shoppingLists : []);
    OrbitDB.writeKey(KEYS.lists, Array.isArray(data.lists) ? data.lists : []);
  }

  return { exportData, importData };
})();
