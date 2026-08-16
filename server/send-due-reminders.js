/**
 * send-due-reminders.js
 *
 * This is NOT part of the always-running web server. It's a standalone
 * script meant to be run on a schedule (every minute) by Render's Cron
 * Job feature. Each run:
 *   1. connects to Postgres
 *   2. finds reminders whose due_at has passed
 *   3. sends each one as a real push notification
 *   4. deletes it from the table (sent or not worth retrying)
 *   5. exits
 *
 * Because Render Cron Jobs spin up fresh for each run, there's no
 * always-on process to keep alive - which is what makes this the free,
 * "easiest" option instead of needing an always-on background worker.
 */

const webpush = require("web-push");
const pool = require("./db");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT; // e.g. "mailto:you@example.com"

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  console.error("Missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT.");
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function main() {
  const { rows: dueReminders } = await pool.query(
    "SELECT id, name, description, subscription FROM reminders WHERE due_at <= now()"
  );

  if (dueReminders.length === 0) {
    console.log("No due reminders.");
    await pool.end();
    return;
  }

  console.log(`Sending ${dueReminders.length} reminder(s)...`);

  for (const reminder of dueReminders) {
    const payload = JSON.stringify({
      title: reminder.name,
      body: reminder.description || "Reminder from Orbit",
      tag: reminder.id,
    });

    try {
      await webpush.sendNotification(reminder.subscription, payload);
      console.log(`Sent: ${reminder.name}`);
    } catch (err) {
      // 404/410 means the subscription is gone (app uninstalled, permission
      // revoked, etc). Any other error, we still drop the reminder rather
      // than retry forever - fine for a personal single-user app.
      console.error(`Failed to send "${reminder.name}":`, err.statusCode || err.message);
    }

    await pool.query("DELETE FROM reminders WHERE id = $1", [reminder.id]);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("send-due-reminders failed", err);
  process.exit(1);
});
