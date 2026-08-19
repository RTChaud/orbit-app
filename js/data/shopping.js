/**
 * data/shopping.js
 *
 * Structured as multiple named lists (so "Groceries" / "IKEA" / "DIY" is
 * just a UI addition later), but only one default list is exposed for now.
 */

const OrbitShopping = (() => {
  const KEY = "orbit.shopping.lists";

  function getLists() {
    let lists = OrbitDB.readKey(KEY, null);
    if (!lists || lists.length === 0) {
      lists = [{ id: "default", name: "Shopping", items: [] }];
      OrbitDB.writeKey(KEY, lists);
    }
    return lists;
  }

  function saveLists(lists) {
    OrbitDB.writeKey(KEY, lists);
  }

  function getDefaultList() {
    return getLists()[0];
  }

  function addItem(listId, name) {
    const lists = getLists();
    const list = lists.find((l) => l.id === listId);
    if (!list) return null;
    const item = { id: OrbitDB.generateId("sitem"), name, completed: false };
    list.items.push(item);
    saveLists(lists);
    return item;
  }

  function toggleItem(listId, itemId) {
    const lists = getLists();
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    const item = list.items.find((i) => i.id === itemId);
    if (!item) return;
    item.completed = !item.completed;
    saveLists(lists);
  }

  function removeItem(listId, itemId) {
    const lists = getLists();
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    list.items = list.items.filter((i) => i.id !== itemId);
    saveLists(lists);
  }

  return { getLists, getDefaultList, addItem, toggleItem, removeItem };
})();
