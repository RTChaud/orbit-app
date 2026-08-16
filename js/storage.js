/**
 * storage.js
 *
 * Wraps localStorage so the rest of the app never talks to
 * localStorage directly. Swapping this out later (e.g. for
 * IndexedDB, or a backend) only means changing this file.
 */

const OrbitStorage = (() => {
  const STORAGE_KEY = "orbit.tasks";

  function getTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("Orbit: failed to read tasks from storage", err);
      return [];
    }
  }

  function saveTasks(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.error("Orbit: failed to save tasks to storage", err);
    }
  }

  function addTask(task) {
    const tasks = getTasks();
    tasks.push(task);
    saveTasks(tasks);
    return task;
  }

  function deleteTask(taskId) {
    const tasks = getTasks().filter((t) => t.id !== taskId);
    saveTasks(tasks);
  }

  function updateTask(taskId, updates) {
    const tasks = getTasks();
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;
    tasks[index] = { ...tasks[index], ...updates };
    saveTasks(tasks);
    return tasks[index];
  }

  function generateId() {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    getTasks,
    saveTasks,
    addTask,
    deleteTask,
    updateTask,
    generateId,
  };
})();
