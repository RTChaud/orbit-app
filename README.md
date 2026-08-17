# Orbit

A personal life-admin app: chores, checklists, tasks, and timed reminders.
This is v1 — a minimal proof that "create a task with a date/time \u2192 save it
\u2192 get a notification when it's due" works end to end.

## Project structure

```
orbit/
├── index.html          # App shell + task list + add/edit task modal
├── manifest.json        # PWA manifest (name, icons, standalone display)
├── service-worker.js    # Offline caching + notification display
├── css/
│   └── styles.css       # All styling
├── js/
│   ├── storage.js        # localStorage read/write for tasks
│   ├── notifications.js  # Permission handling + scheduling
│   ├── ui.js              # DOM rendering (task list, modal, banner)
│   └── app.js             # Wires everything together, app entry point
└── icons/
    └── logo.png          # App icon / Home Screen icon
```

Each JS file has one job, so this should scale reasonably as chores,
checklists and recurring items get added later — e.g. a future
`js/chores.js` or `js/recurring.js` can reuse `storage.js` and
`notifications.js` without touching `app.js`'s wiring much.

## Running it locally

Notifications and service workers require a real HTTP origin (not `file://`).
From the `orbit/` folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser on your computer to test the
flow quickly before trying it on your iPhone.

## Deploying to GitHub Pages

1. Push the contents of this `orbit/` folder to a GitHub repo (either at the
   repo root, or in a `/docs` folder — either works, just set Pages to match).
2. In the repo: **Settings → Pages → Source**, pick the branch/folder you used.
3. GitHub gives you a URL like `https://<username>.github.io/<repo>/`.

## Installing on iPhone (required for notifications)

This is the part that trips people up, so it's worth doing exactly:

1. Open the GitHub Pages URL in **Safari** (not Chrome — see limitations below).
2. Tap the **Share** icon → **Add to Home Screen** → **Add**.
3. Open Orbit from the **icon on your Home Screen**, not from a Safari tab.
4. Tap **Add task**, create a task a few minutes in the future.
5. When prompted (or via the banner at the top), tap **Enable notifications**
   and allow.
6. Keep Orbit open (foreground) until the reminder time hits, and you should
   see the notification.

## Real notifications (locked screen / app closed)

The limitations below describe the local-only scheduling this app ships
with by default. There's now a way around them: `/worker` contains a
Cloudflare Worker that sends real notifications even when Orbit is
closed. See `worker/README.md` for the setup — it runs on Cloudflare's
free plan, which has no trial period or expiry. Until you deploy it and
set `serverUrl` in `js/config.js`, Orbit falls back to the local-only
behavior described below.

## Notification limitations (local-only mode, no server configured)

Browser/PWA notifications are more constrained than native app notifications.
Specifically:

- **iOS requires the app to be installed to the Home Screen.** Notifications
  do not work at all in a normal Safari tab — only in a web app added via
  Add to Home Screen, and only on iOS 16.4 or later. Orbit detects this and
  shows a banner if you're not in that mode.
- **Permission can only be requested from a tap**, never automatically on
  page load — this is a browser security rule, so Orbit asks via the banner
  button or when you first try to use notifications.
- **There is no cross-browser API to reliably wake up a closed app at a
  future time.** Orbit's current scheduling (`setTimeout`) only fires while
  the app is actually running. If you background the app or lock your phone
  before the scheduled time, iOS will likely suspend Orbit and the timer
  won't fire — this is a real platform constraint, not a bug in this build.
  For this v1, the reliable test is: create a task a minute or two out, and
  keep Orbit open and in the foreground until it fires.
- **A "notify me even if the app is fully closed" feature is possible**, but
  requires real **Web Push**: a backend server that sends the notification
  via Apple/Google's push service at the right time, rather than the app
  timing itself. That's a meaningfully bigger feature (needs a server, VAPID
  keys, a push subscription per device) and is a good candidate for v2 once
  the core task/notification loop here is proven out.

## Data storage

Tasks are stored in `localStorage`, on-device only — nothing is sent to a
server. This is fine for a single-device v1, but means tasks won't sync
across devices; that'll need a real backend or sync solution later if you
want Orbit on more than one device.

## Icons

`icons/logo.png` is used as the app's Home Screen icon (via `manifest.json`
and the `apple-touch-icon` link in `index.html`) and as the icon shown on
reminder notifications. For best results on iOS, use a square image at
least 512\u00d7512px with no transparency (iOS fills transparent areas with
black on the Home Screen).
