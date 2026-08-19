/**
 * Orbit push worker
 *
 * One Cloudflare Worker doing two jobs:
 *
 *   fetch()     - the API Orbit talks to. Hands out the VAPID public key,
 *                 saves reminders, deletes them when a task is removed.
 *
 *   scheduled() - runs every minute (see [triggers] in wrangler.toml).
 *                 Finds reminders that are due, sends each one as a real
 *                 push notification, then clears it out.
 *
 * The scheduled() half is what makes reminders survive a locked screen
 * or a fully closed app: the timing lives here on Cloudflare's side, not
 * in a setTimeout inside the phone's browser.
 *
 * Everything here fits comfortably in Cloudflare's free plan: cron
 * triggers are free, and 1440 scheduled runs a day plus a handful of API
 * calls is well under the 100,000 requests/day allowance.
 */

import { buildPushHTTPRequest } from "@pushforge/builder";

const CORS_HEADERS = {
  // Orbit is served from GitHub Pages, a different origin to this Worker.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleSaveReminder(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const { id, name, description, dueAt, subscription } = body;

  if (!id || !name || !dueAt || !subscription) {
    return json({ error: "id, name, dueAt and subscription are required" }, 400);
  }

  const dueMs = Date.parse(dueAt);
  if (Number.isNaN(dueMs)) {
    return json({ error: "dueAt must be a valid ISO date string" }, 400);
  }

  // Upsert, so editing a task later just overwrites its reminder.
  await env.DB.prepare(
    `INSERT INTO reminders (id, name, description, due_at, subscription, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       due_at = excluded.due_at,
       subscription = excluded.subscription`
  )
    .bind(
      id,
      name,
      description || null,
      dueMs,
      JSON.stringify(subscription),
      Date.now()
    )
    .run();

  return json({ ok: true }, 201);
}

async function handleDeleteReminder(id, env) {
  await env.DB.prepare("DELETE FROM reminders WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Browsers send a preflight OPTIONS request before cross-origin
    // POST/DELETE calls; it has to be answered before the real one lands.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/api/vapid-public-key" && request.method === "GET") {
      return json({ publicKey: env.VAPID_PUBLIC_KEY });
    }

    if (url.pathname === "/api/reminders" && request.method === "POST") {
      return handleSaveReminder(request, env);
    }

    if (url.pathname.startsWith("/api/reminders/") && request.method === "DELETE") {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      return handleDeleteReminder(id, env);
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDueReminders(env));
  },
};

async function sendDueReminders(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, description, subscription FROM reminders WHERE due_at <= ?"
  )
    .bind(Date.now())
    .all();

  if (!results || results.length === 0) return;

  const privateJWK = JSON.parse(env.VAPID_PRIVATE_JWK);

  for (const reminder of results) {
    try {
      const subscription = JSON.parse(reminder.subscription);

      const { endpoint, headers, body } = await buildPushHTTPRequest({
        privateJWK,
        subscription,
        message: {
          payload: {
            title: reminder.name,
            body: reminder.description || "Reminder from Orbit",
            tag: reminder.id,
          },
          adminContact: env.VAPID_SUBJECT,
          options: { ttl: 3600, urgency: "high" },
        },
      });

      const res = await fetch(endpoint, { method: "POST", headers, body });

      if (!res.ok) {
        // 404/410 mean the subscription is dead (app removed, permission
        // revoked). Nothing to do but drop it, same as any other failure.
        console.log(`Push for "${reminder.name}" returned ${res.status}`);
      }
    } catch (err) {
      console.error(`Failed to send "${reminder.name}"`, err);
    }

    // Either way, clear it - this is a personal app, so a missed reminder
    // isn't worth retrying forever and re-sending on every later run.
    await env.DB.prepare("DELETE FROM reminders WHERE id = ?")
      .bind(reminder.id)
      .run();
  }
}
