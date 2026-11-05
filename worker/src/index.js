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
 *                 push notification, then clears it out. It also looks after
 *                 Routines: for each one it sends the notification for the
 *                 occurrence that has come due and then moves on to the next
 *                 occurrence itself, using the same recurrence engine as the
 *                 app (recurrence.js) - so routines keep notifying when
 *                 Orbit is never opened.
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
// Same file the app uses (js/data/recurrence.js) - keep the two identical.
import Recurrence from "./recurrence.js";

// A routine notification this far past its time is not sent (e.g. after an
// outage): "put the bins out" six hours late is noise. The schedule still
// moves on.
const STALE_MS = 6 * 60 * 60 * 1000;

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


// --- Routines ---------------------------------------------------------------
//
// The app owns a routine's state (which occurrence is pending, snoozed,
// paused...) and tells us about every change, stamped with `rev`. We only
// accept a state with a HIGHER rev than the one we hold, so re-sending the
// same thing (every time Orbit opens, retries...) changes nothing, and we
// never rewind ourselves to an occurrence we have already notified.

async function handleSaveRoutine(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const { id, name, description, rule, k, dueAt, paused, rev, subscription } = body;

  if (!id || typeof id !== "string" || !name || !subscription) {
    return json({ error: "id, name and subscription are required" }, 400);
  }
  if (!Recurrence.isValidRule(rule)) return json({ error: "Invalid recurrence rule" }, 400);
  if (!Number.isInteger(k) || k < 0) return json({ error: "k must be a non-negative integer" }, 400);
  if (!Number.isFinite(dueAt)) return json({ error: "dueAt must be a timestamp in ms" }, 400);
  if (!Number.isFinite(rev)) return json({ error: "rev must be a number" }, 400);

  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO routines
       (id, name, description, rule, k, due_at, paused, rev, last_fired, subscription, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       subscription = excluded.subscription,
       updated_at = excluded.updated_at,
       rule   = CASE WHEN excluded.rev > routines.rev THEN excluded.rule   ELSE routines.rule   END,
       k      = CASE WHEN excluded.rev > routines.rev THEN excluded.k      ELSE routines.k      END,
       due_at = CASE WHEN excluded.rev > routines.rev THEN excluded.due_at ELSE routines.due_at END,
       paused = CASE WHEN excluded.rev > routines.rev THEN excluded.paused ELSE routines.paused END,
       rev    = MAX(routines.rev, excluded.rev)`
  )
    .bind(
      id,
      name,
      description || null,
      JSON.stringify(rule),
      k,
      Math.round(dueAt),
      paused ? 1 : 0,
      Math.round(rev),
      JSON.stringify(subscription),
      now,
      now
    )
    .run();

  return json({ ok: true }, 201);
}

async function handleDeleteRoutine(id, env) {
  await env.DB.prepare("DELETE FROM routines WHERE id = ?").bind(id).run();
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

    if (url.pathname === "/api/routines" && request.method === "POST") {
      return handleSaveRoutine(request, env);
    }

    if (url.pathname.startsWith("/api/routines/") && request.method === "DELETE") {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      return handleDeleteRoutine(id, env);
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },

  async scheduled(event, env, ctx) {
    // Independent of each other: if the routines table hasn't been created
    // yet (see migrations/), ordinary reminders must carry on regardless.
    ctx.waitUntil(
      Promise.all([
        sendDueReminders(env).catch((err) => console.error("Reminders run failed", err)),
        sendDueRoutines(env).catch((err) => console.error("Routines run failed", err)),
      ])
    );
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
            body: reminder.description || "Reminder",
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

// --- Routine notifications ------------------------------------------------------

async function sendDueRoutines(env) {
  const now = Date.now();

  const { results } = await env.DB.prepare(
    `SELECT id, name, description, rule, k, due_at, rev, last_fired, subscription
       FROM routines
      WHERE paused = 0 AND due_at <= ?
      ORDER BY due_at
      LIMIT 50`
  )
    .bind(now)
    .all();

  if (!results || results.length === 0) return;

  const privateJWK = JSON.parse(env.VAPID_PRIVATE_JWK);

  for (const row of results) {
    try {
      await processRoutine(env, privateJWK, row, now);
    } catch (err) {
      console.error(`Failed to process routine "${row.name}"`, err);
    }
  }
}

// One due routine: move its schedule on to the next occurrence, then send
// the notification for the one that came due.
//
// The schedule is moved FIRST, as a compare-and-set on (k, due_at, rev):
//  - if two runs overlap, only one wins the claim, so it is sent once;
//  - if the app changed the routine a moment ago (new rev), we lose the
//    claim and leave it alone - the app's version wins;
//  - `last_fired` records exactly which occurrence/time was notified, so
//    the same one can never be sent twice even if the app re-sends it.
async function processRoutine(env, privateJWK, row, now) {
  const rule = JSON.parse(row.rule);
  const firedKey = `${row.k}@${row.due_at}`;
  const isStale = now - row.due_at > STALE_MS;
  const shouldSend = !isStale && firedKey !== row.last_fired;

  // Next occurrence. If we are so far behind that it has passed as well
  // (an outage), jump straight to the latest one that is due rather than
  // working through every missed occurrence - no backlog.
  let nextK = row.k + 1;
  if (Recurrence.scheduledAt(rule, nextK) <= now) {
    nextK = Math.max(nextK, Recurrence.latestIndexAtOrBefore(rule, now));
  }
  const nextDue = Recurrence.scheduledAt(rule, nextK);
  const newLastFired = shouldSend ? firedKey : row.last_fired;

  const claim = await env.DB.prepare(
    `UPDATE routines
        SET k = ?, due_at = ?, last_fired = ?, updated_at = ?
      WHERE id = ? AND k = ? AND due_at = ? AND rev = ?`
  )
    .bind(nextK, nextDue, newLastFired, now, row.id, row.k, row.due_at, row.rev)
    .run();

  if (!claim.meta || claim.meta.changes !== 1) return;
  if (!shouldSend) return;

  let status = 0;
  try {
    const { endpoint, headers, body } = await buildPushHTTPRequest({
      privateJWK,
      subscription: JSON.parse(row.subscription),
      message: {
        payload: {
          title: row.name,
          body: row.description || "Reminder",
          // One tag per routine: a newer notification replaces the
          // previous one instead of piling up beside it.
          tag: row.id,
        },
        adminContact: env.VAPID_SUBJECT,
        options: { ttl: 3600, urgency: "high" },
      },
    });
    const res = await fetch(endpoint, { method: "POST", headers, body });
    status = res.status;
  } catch (err) {
    console.error(`Push for routine "${row.name}" failed`, err);
    status = 599;
  }

  if (status === 404 || status === 410) {
    // The subscription is dead (app removed, permission revoked) - there is
    // nobody left to notify, so stop tracking this routine. Orbit
    // registers it again the next time it is opened.
    await env.DB.prepare("DELETE FROM routines WHERE id = ?").bind(row.id).run();
    return;
  }

  if (status === 429 || status >= 500) {
    // The push service had a hiccup: put the routine back so the next
    // minute's run tries again (until it goes stale).
    await env.DB.prepare(
      `UPDATE routines SET k = ?, due_at = ?, last_fired = ?
        WHERE id = ? AND k = ? AND due_at = ? AND rev = ?`
    )
      .bind(row.k, row.due_at, row.last_fired, row.id, nextK, nextDue, row.rev)
      .run();
  }
}
