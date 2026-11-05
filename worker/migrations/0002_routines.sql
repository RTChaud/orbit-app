-- Orbit migration 0002: routines
--
-- ADDITIVE ONLY. Creates one new table (and an index) for routine
-- schedules. It does not alter, rename, copy or delete anything, and the
-- existing `reminders` table is not touched - existing data is safe, and
-- running this twice is harmless (IF NOT EXISTS).
--
-- How to run it: Cloudflare dashboard -> Storage & Databases -> D1 ->
-- orbit-db -> Console, paste everything below and press Execute.

CREATE TABLE IF NOT EXISTS routines (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  rule         TEXT NOT NULL,              -- recurrence rule, JSON
  k            INTEGER NOT NULL,           -- index of the occurrence waiting to be notified
  due_at       INTEGER NOT NULL,           -- when that occurrence is due (ms; moves if snoozed)
  paused       INTEGER NOT NULL DEFAULT 0,
  rev          INTEGER NOT NULL,           -- version stamp from the app; only newer ones are accepted
  last_fired   TEXT,                       -- "k@due_at" of the last occurrence notified (prevents duplicates)
  subscription TEXT NOT NULL,              -- push subscription, JSON
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS routines_due_idx ON routines (paused, due_at);
