/**
 * data/lists.js
 *
 * User-created named checklists (packing lists, nursery bags, etc.) -
 * separate from Shopping since these are arbitrary and user-named.
 */

const OrbitLists = (() => {
  const KEY = "orbit.lists";

  function getAll() {
    return OrbitDB.readKey(KEY, []);
  }

  function saveAll(lists) {
    OrbitDB.writeKey(KEY, lists);
  }

  function get(id) {
    return getAll().find((l) => l.id === id) || null;
  }

  function createList(name) {
    const lists = getAll();
    const list = { id: OrbitDB.generateId("list"), name, items: [] };
    lists.push(list);
    saveAll(lists);
    return list;
  }

  function removeList(id) {
    saveAll(getAll().filter((l) => l.id !== id));
  }

  function addItem(listId, name) {
    const lists = getAll();
    const list = lists.find((l) => l.id === listId);
    if (!list) return null;
    const item = { id: OrbitDB.generateId("litem"), name, completed: false };
    list.items.push(item);
    saveAll(lists);
    return item;
  }

  function toggleItem(listId, itemId) {
    const lists = getAll();
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    const item = list.items.find((i) => i.id === itemId);
    if (!item) return;
    item.completed = !item.completed;
    saveAll(lists);
  }

  function removeItem(listId, itemId) {
    const lists = getAll();
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    list.items = list.items.filter((i) => i.id !== itemId);
    saveAll(lists);
  }

  return { getAll, get, createList, removeList, addItem, toggleItem, removeItem };
})();
