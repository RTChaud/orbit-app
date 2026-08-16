# Orbit push server

This is what makes reminders work even when Orbit is closed or your phone
is locked. It's small on purpose: an API (`server.js`) that stores
reminders, and a script (`send-due-reminders.js`) that a scheduler runs
once a minute to send any that are due. Deployed on Render's free tier.

## 1. Generate your VAPID keys (one-time, on your own computer)

VAPID keys let push services verify that pushes are coming from you.
You don't need an Apple/Google developer account for this — it's a
standard part of the Web Push protocol.

```bash
npx web-push generate-vapid-keys
```

This prints a public and private key. Save both somewhere safe — you'll
paste them into Render's environment variables below. (You don't need to
put the public key in `js/config.js` — the client fetches it from the
server automatically.)

## 2. Create a Render account and a Postgres database

1. Go to [render.com](https://render.com) and sign up (no credit card
   needed for the free tier).
2. **New → PostgreSQL**. Free tier is fine to start. Name it e.g.
   `orbit-db`.
3. Once it's created, open its **Connect** tab and use the provided
   "PSQL Command" or web shell to run the contents of `schema.sql`
   from this folder (paste the whole file in and run it).
4. Copy the **Internal Database URL** shown on the database's page —
   you'll need it in step 4.

   Note: Render's free Postgres expires after 30 days of the *database*
   sitting unused. For a personal reminders app that's usually fine — just
   know that if you go quiet on it for a month, you may need to recreate
   the database (and re-run `schema.sql`). If that becomes annoying, a
   paid Postgres instance ($7/mo on Render) removes the expiry.

## 3. Deploy the API as a Web Service

1. Push this whole `orbit` project (including `/server`) to a GitHub repo,
   if you haven't already.
2. In Render: **New → Web Service**, connect your GitHub repo.
3. **Root Directory**: `server`
4. **Build Command**: `npm install`
5. **Start Command**: `npm start`
6. **Instance Type**: Free
7. Add environment variables:
   - `DATABASE_URL` = the Internal Database URL from step 2
   - `VAPID_PUBLIC_KEY` = the public key from step 1
8. Deploy. Render gives you a URL like `https://orbit-push.onrender.com`.

Free web services spin down after ~15 minutes idle and take a few seconds
to wake up on the next request — that's fine here, since this service only
needs to respond when Orbit saves or deletes a reminder, not run
continuously.

## 4. Deploy the sender as a Cron Job

1. In Render: **New → Cron Job**, same GitHub repo.
2. **Root Directory**: `server`
3. **Build Command**: `npm install`
4. **Command**: `npm run send-due-reminders`
5. **Schedule**: `* * * * *` (every minute)
6. Add environment variables:
   - `DATABASE_URL` = same Internal Database URL as step 2
   - `VAPID_PUBLIC_KEY` = same public key as step 1
   - `VAPID_PRIVATE_KEY` = the private key from step 1
   - `VAPID_SUBJECT` = `mailto:` followed by your email (push services
     require this as a contact point — it's not shown to you as the user,
     it's metadata for the push service)
7. Deploy.

This is the piece that actually sends notifications: every minute it
checks the database for anything due, sends it, then exits — no
always-on process required, which is what keeps it free.

## 5. Point Orbit at the server

In `js/config.js`, set:

```js
const ORBIT_CONFIG = {
  serverUrl: "https://orbit-push.onrender.com", // your Web Service URL from step 3
};
```

Redeploy Orbit to GitHub Pages. Re-open it from your Home Screen icon,
and re-grant notification permission if you'd already denied/granted it
before — this triggers Orbit to subscribe to push and register with the
server. From then on, new tasks you create will get a real push
notification at the right time, whether or not Orbit is open.

## Testing it

Create a task a couple of minutes out, then lock your phone. Within a
minute of the due time, you should get a notification — the cron job
runs every 60 seconds, so delivery can be up to ~1 minute later than the
exact time you picked.
