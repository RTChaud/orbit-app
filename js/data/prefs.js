/**
 * data/prefs.js
 *
 * Small app-wide settings. For now just the Soon window: how far ahead of
 * its due time an item (an Upcoming task, a Routine, a Waiting follow-up...)
 * starts appearing in Soon. It used to be a fixed 24 hours; 24 hours is
 * still the default, so nothing changes until it's adjusted in Settings.
 *
 * Included in the JSON backup (see data/backup.js).
 */

const OrbitPrefs = (() => {
  const KEY = "orbit.prefs";
  const DEFAULT_SOON_HOURS = 24;
  const SOON_HOUR_CHOICES = [1, 2, 3, 6, 12, 24, 48];

  function getAll() {
    const stored = OrbitDB.readKey(KEY, {});
    return stored && typeof stored === "object" ? stored : {};
  }

  function getSoonWindowHours() {
    const hours = Number(getAll().soonWindowHours);
    return hours > 0 && hours <= 168 ? hours : DEFAULT_SOON_HOURS;
  }

  function setSoonWindowHours(hours) {
    OrbitDB.writeKey(KEY, { ...getAll(), soonWindowHours: Number(hours) });
  }

  function getSoonWindowMs() {
    return getSoonWindowHours() * 60 * 60 * 1000;
  }

  // "1 hour" / "12 hours"
  function describeHours(hours) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  return {
    SOON_HOUR_CHOICES,
    getSoonWindowHours,
    setSoonWindowHours,
    getSoonWindowMs,
    describeHours,
  };
})();
