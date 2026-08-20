/**
 * data/cooking.js
 *
 * A food has a name and a list of cooking methods. Each method carries
 * its own duration/temperature/wattage/notes, since the same food can
 * be cooked several different ways.
 *
 * Shape:
 * {
 *   id, name, createdAt,
 *   methods: [
 *     { id, type, durationMinutes, temperature, temperatureUnit, wattage, notes }
 *   ]
 * }
 *
 * temperature/wattage/notes are null when not set - fields the method
 * type doesn't need are just never filled in, not forced.
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

  function createFood(name) {
    const foods = getAll();
    const food = { id: OrbitDB.generateId("food"), name, methods: [], createdAt: Date.now() };
    foods.push(food);
    saveAll(foods);
    return food;
  }

  function renameFood(id, name) {
    const foods = getAll();
    const food = foods.find((f) => f.id === id);
    if (!food) return null;
    food.name = name;
    saveAll(foods);
    return food;
  }

  function removeFood(id) {
    saveAll(getAll().filter((f) => f.id !== id));
  }

  function addMethod(foodId, method) {
    const foods = getAll();
    const food = foods.find((f) => f.id === foodId);
    if (!food) return null;
    const full = { id: OrbitDB.generateId("method"), ...method };
    food.methods.push(full);
    saveAll(foods);
    return full;
  }

  function updateMethod(foodId, methodId, updates) {
    const foods = getAll();
    const food = foods.find((f) => f.id === foodId);
    if (!food) return null;
    const method = food.methods.find((m) => m.id === methodId);
    if (!method) return null;
    Object.assign(method, updates);
    saveAll(foods);
    return method;
  }

  function removeMethod(foodId, methodId) {
    const foods = getAll();
    const food = foods.find((f) => f.id === foodId);
    if (!food) return;
    food.methods = food.methods.filter((m) => m.id !== methodId);
    saveAll(foods);
  }

  return {
    getAll,
    get,
    sortedAll,
    createFood,
    renameFood,
    removeFood,
    addMethod,
    updateMethod,
    removeMethod,
  };
})();
