/**
 * db.js
 *
 * One shared connection pool, used by both server.js (the API) and
 * send-due-reminders.js (the cron job). Reads the connection string from
 * the DATABASE_URL environment variable, which Render sets automatically
 * when you link a Postgres database to a service.
 */

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's managed Postgres requires SSL; it uses a certificate that
  // Node doesn't automatically trust, so we relax verification here.
  // This is standard practice for Render/Heroku-style managed Postgres.
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
