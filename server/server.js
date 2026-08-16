/**
 * server.js
 *
 * The API Orbit (the client) talks to. Responsibilities:
 *   - hand out the public VAPID key so the client can subscribe to push
 *   - store a reminder (task info + due time + push subscription)
 *   - delete a reminder if the task is deleted or edited in the app
 *
 * It does NOT send any notifications itself - that's send-due-reminders.js,
 * run on a schedule by Render's Cron Job feature. This file only ever
 * responds to requests from Orbit; it has no background timers of its own,
 * which is exactly why it can run on a free, spin-down-when-idle instance.
 */

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const PORT = process.env.PORT || 3000;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;

if (!VAPID_PUBLIC_KEY) {
  console.error("Missing VAPID_PUBLIC_KEY environment variable.");
  process.exit(1);
}

const app = express();
app.use(cors()); // Orbit is served from GitHub Pages, a different origin
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Create (or replace) a reminder.
app.post("/api/reminders", async (req, res) => {
  const { id, name, description, dueAt, subscription } = req.body || {};

  if (!id || !name || !dueAt || !subscription) {
    return res.status(400).json({ error: "id, name, dueAt and subscription are required" });
  }

  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return res.status(400).json({ error: "dueAt must be a valid ISO date string" });
  }

  try {
    await pool.query(
      `INSERT INTO reminders (id, name, description, due_at, subscription)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             due_at = EXCLUDED.due_at,
             subscription = EXCLUDED.subscription`,
      [id, name, description || null, dueDate.toISOString(), subscription]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("Failed to save reminder", err);
    res.status(500).json({ error: "Failed to save reminder" });
  }
});

// Cancel a reminder (e.g. the task was deleted in Orbit).
app.delete("/api/reminders/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM reminders WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete reminder", err);
    res.status(500).json({ error: "Failed to delete reminder" });
  }
});

app.listen(PORT, () => {
  console.log(`Orbit push server listening on port ${PORT}`);
});
