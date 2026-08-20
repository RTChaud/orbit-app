/**
 * data/backup.js
 *
 * Export bundles every piece of Orbit's data (items, shopping lists,
 * custom lists, Soon/Shopping suggestions, Cooking foods) into one JSON
 * object. Import always fully replaces what's there - no merging - since
 * the whole point is "get back to exactly this state" after a reinstall
 * wipes local storage.
 */

const OrbitBackup = (() => {
  const KEYS = {
    items: "orbit.items",
    shoppingLists: "orbit.shopping.lists",
    lists: "orbit.lists",
    soonSuggestions: "orbit.suggestions.soon",
    shoppingSuggestions: "orbit.suggestions.shopping",
    cookingFoods: "orbit.cooking.foods",
  };

  function exportData() {
    return {
      app: "orbit",
      version: 3,
      exportedAt: new Date().toISOString(),
      items: OrbitDB.readKey(KEYS.items, []),
      shoppingLists: OrbitDB.readKey(KEYS.shoppingLists, []),
      lists: OrbitDB.readKey(KEYS.lists, []),
      soonSuggestions: OrbitDB.readKey(KEYS.soonSuggestions, []),
      shoppingSuggestions: OrbitDB.readKey(KEYS.shoppingSuggestions, []),
      cookingFoods: OrbitDB.readKey(KEYS.cookingFoods, []),
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
    OrbitDB.writeKey(KEYS.soonSuggestions, Array.isArray(data.soonSuggestions) ? data.soonSuggestions : []);
    OrbitDB.writeKey(
      KEYS.shoppingSuggestions,
      Array.isArray(data.shoppingSuggestions) ? data.shoppingSuggestions : []
    );
    OrbitDB.writeKey(KEYS.cookingFoods, Array.isArray(data.cookingFoods) ? data.cookingFoods : []);
  }

  return { exportData, importData };
})();
