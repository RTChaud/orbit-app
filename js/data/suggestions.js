/**
 * data/suggestions.js
 *
 * Remembers names typed into Soon ("washing machine") and Shopping
 * ("milk") so they can be suggested next time. Soon suggestions also
 * carry the last duration used for that name, so picking a suggestion
 * can refill the whole form, not just the name.
 *
 * Matching is case-insensitive (so "Milk" and "milk" are the same
 * suggestion), but the originally-typed casing is what's stored/shown.
 */

const OrbitSuggestions = (() => {
  const KEYS = {
    soon: "orbit.suggestions.soon",
    shopping: "orbit.suggestions.shopping",
  };

  function getAll(kind) {
    return OrbitDB.readKey(KEYS[kind], []);
  }

  function saveAll(kind, list) {
    OrbitDB.writeKey(KEYS[kind], list);
  }

  function upsertSoon(name, durationMinutes) {
    const list = getAll("soon");
    const existing = list.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.durationMinutes = durationMinutes;
    } else {
      list.push({ name, durationMinutes });
    }
    saveAll("soon", list);
  }

  function upsertShopping(name) {
    const list = getAll("shopping");
    const existing = list.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      list.push({ name });
      saveAll("shopping", list);
    }
  }

  function remove(kind, name) {
    saveAll(
      kind,
      getAll(kind).filter((s) => s.name.toLowerCase() !== name.toLowerCase())
    );
  }

  // Matches for the autocomplete dropdown, alphabetical - nothing shown
  // until there's actual typed text, so it doesn't clutter an empty field.
  function search(kind, query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sortedAll(kind)
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }

  // Full alphabetical list, for the "previously used" management section.
  function sortedAll(kind) {
    return [...getAll(kind)].sort((a, b) => a.name.localeCompare(b.name));
  }

  return { getAll, upsertSoon, upsertShopping, remove, search, sortedAll, KEYS };
})();
