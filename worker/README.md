# Orbit push worker (Cloudflare)

This is what makes reminders arrive when your phone is locked or Orbit is
closed. It runs on Cloudflare Workers, whose free plan has no trial period
and no expiry — cron triggers are free, and the D1 database is free up to
5 GB.

Everything below is done from your computer's terminal, in this `worker`
folder.

## 1. Set up Cloudflare and generate VAPID keys

Sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up) (free, no
card needed). Then from this folder:

```bash
npm install
npx wrangler login
```

`wrangler login` opens a browser window to connect your account.

Now generate your VAPID keys — these let push services verify pushes are
genuinely from you. No Apple or Google developer account is involved:

```bash
npx @pushforge/builder vapid
```

Keep the output open — you'll need the **public key** and the **private
key (JWK)** in step 4.

## 2. Create the database

```bash
npx wrangler d1 create orbit-db
```

This prints a `database_id`. Open `wrangler.toml` and paste it in, replacing
`PASTE_YOUR_DATABASE_ID_HERE`.

Then create the table:

```bash
npm run db:init
```

## 3. Deploy the worker

```bash
npm run deploy
```

Wrangler prints your worker's URL — something like
`https://orbit-push.<your-subdomain>.workers.dev`. Save it for step 5.

The cron trigger is set up automatically from `wrangler.toml` — there's no
separate "create a scheduled job" step. You can confirm it in the
Cloudflare dashboard under Workers & Pages → orbit-push → Settings →
Triggers.

## 4. Add your keys as secrets

Secrets are encrypted and never appear in your repo. Run each of these and
paste the value when prompted:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_JWK
npx wrangler secret put VAPID_SUBJECT
```

- `VAPID_PUBLIC_KEY` — the public key from step 1
- `VAPID_PRIVATE_JWK` — the private key from step 1, as the full JWK JSON
  (paste it as one line, including the surrounding `{` and `}`)
- `VAPID_SUBJECT` — `mailto:` followed by your email address. Push
  services require a contact point; it isn't shown to you in the app.

## 5. Point Orbit at the worker

In `js/config.js` (in the main Orbit folder, not this one), set:

```js
const ORBIT_CONFIG = {
  serverUrl: "https://orbit-push.<your-subdomain>.workers.dev",
};
```

Commit and push so GitHub Pages picks it up. Then open Orbit from your
Home Screen icon and grant notification permission — that's what triggers
Orbit to subscribe to push and register itself with the worker.

If you'd already granted permission before this step, it's worth removing
Orbit from your Home Screen and re-adding it, so it subscribes cleanly.

## Testing it

Create a task two or three minutes out, then lock your phone and put it
down. The notification should arrive within about a minute of the time you
picked.

## Things worth knowing

- **Delivery is accurate to about a minute.** The cron runs every 60
  seconds, so a reminder set for 9:00 may arrive at 9:00:40. Fine for life
  admin; not the tool for a precise timer.
- **Cron triggers don't retry.** If a scheduled run fails, Cloudflare
  waits for the next minute rather than retrying immediately — so in the
  rare failure case a reminder arrives a minute late rather than never.
- **Free plan limits are generous here.** Running every minute uses about
  1,440 of your 100,000 daily requests.
- **Reminders are deleted once sent.** The table only ever holds pending
  reminders, so it stays tiny.

## Useful commands

```bash
npx wrangler tail                          # live logs, handy for debugging
npx wrangler d1 execute orbit-db --remote --command "SELECT * FROM reminders"
```
