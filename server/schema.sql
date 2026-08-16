-- Run this once against your Render Postgres database before first deploy
-- (Render's dashboard has a built-in "Connect" -> psql/SQL shell for this).

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Speeds up the cron job's "what's due right now" query.
CREATE INDEX IF NOT EXISTS reminders_due_at_idx ON reminders (due_at);
