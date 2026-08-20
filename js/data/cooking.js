/**
 * data/cooking.js
 *
 * Deliberately simple: a food is just a title and a duration. If you
 * want to capture the appliance or temperature, that goes in the title
 * itself (e.g. "Chicken breast - Air fryer - 180C") - there's no
 * separate structured fields for it.
 */

const OrbitCooking = (() => {
  const KEY = "orbit.cooking.foods";

  function getAll() {
    return OrbitDB.readKey(KEY, []);
  }

  function saveAll(foods) {
    OrbitDB.writeKey(KEY, foods);
  }

  function get(id) {
    return getAll().find((f) => f.id === id) || null;
  }

  function sortedAll() {
    return [...getAll()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function create(name, durationMinutes) {
    const foods = getAll();
    const food = { id: OrbitDB.generateId("food"), name, durationMinutes, createdAt: Date.now() };
    foods.push(food);
    saveAll(foods);
    return food;
  }

  function update(id, updates) {
    const foods = getAll();
    const food = foods.find((f) => f.id === id);
    if (!food) return null;
    Object.assign(food, updates);
    saveAll(foods);
    return food;
  }

  function remove(id) {
    saveAll(getAll().filter((f) => f.id !== id));
  }

  return { getAll, get, sortedAll, create, update, remove };
})();
