-- D1 (SQLite) schema for Orbit's reminders.
-- Applied via wrangler in step 3 of README.md - you don't need to run
-- this by hand.
--
-- due_at is stored as a Unix timestamp in milliseconds (an INTEGER),
-- which keeps timezone handling unambiguous and comparisons cheap.
-- subscription is the browser's push subscription object, stored as JSON
-- text since SQLite has no native JSON column type.

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  due_at INTEGER NOT NULL,
  subscription TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS reminders_due_at_idx ON reminders (due_at);

-- Routines (added in migration 0002 - see migrations/0002_routines.sql).
-- Kept here too so a brand-new database gets everything in one go.
CREATE TABLE IF NOT EXISTS routines (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  rule         TEXT NOT NULL,
  k            INTEGER NOT NULL,
  due_at       INTEGER NOT NULL,
  paused       INTEGER NOT NULL DEFAULT 0,
  rev          INTEGER NOT NULL,
  last_fired   TEXT,
  subscription TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS routines_due_idx ON routines (paused, due_at);
