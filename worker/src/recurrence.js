/**
 * data/recurrence.js
 *
 * The recurrence engine for Routines. Pure functions only - no DOM, no
 * storage, no clock reads - so exactly the same file runs in the browser
 * (as a classic <script>, exposing window.OrbitRecurrence) and inside the
 * Cloudflare Worker (imported as a module; worker/src/recurrence.js is a
 * byte-for-byte copy of this file).
 *
 * The Worker's copy (worker/src/recurrence.js) is this file with only the
 * last line swapped for an ES `export` - see worker/README.md. Keep the two
 * in step.
 *
 * A rule looks like:
 * {
 *   freq:     'daily' | 'weekly' | 'monthly',
 *   interval: 1, 2, 3...            // "repeat every N"
 *   time:     'HH:MM',              // local wall-clock time
 *   tz:       'Europe/London',      // IANA zone the wall-clock time is in
 *   anchor:   'YYYY-MM-DD',         // daily/weekly: the first due date
 *                                   // monthly: the first day of the starting month
 *   monthly:  { mode: 'day', day: 1..31 }
 *          or { mode: 'weekday', nth: 1|2|3|4|-1 (-1 = last), weekday: 0..6 (0 = Sunday) }
 * }
 *
 * Occurrences are numbered k = 0, 1, 2... and each one is computed
 * directly from the rule and the anchor - never from the previous
 * occurrence. That is what keeps the schedule anchored: completing early
 * or late, snoozing, or skipping can never shift anything, and a 31st that
 * was clamped to 28 February returns to the 31st in March.
 *
 * Local dates/times are converted with Intl (built into browsers and
 * Workers), so there is no date library and daylight-saving changes keep
 * the intended wall-clock time.
 */
const OrbitRecurrence = (() => {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const NTH_NAMES = { 1: "first", 2: "second", 3: "third", 4: "fourth", "-1": "last" };
  const MAX_STEPS = 1000; // hard stop for any search loop

  // --- Time zone maths -------------------------------------------------

  const formatters = new Map();

  function getFormatter(tz) {
    let f = formatters.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      });
      formatters.set(tz, f);
    }
    return f;
  }

  // Wall-clock parts of an instant in a zone. m is 1-12, dow is 0 (Sun) - 6.
  function localParts(ms, tz) {
    const out = {};
    getFormatter(tz)
      .formatToParts(new Date(ms))
      .forEach((p) => {
        if (p.type !== "literal") out[p.type] = parseInt(p.value, 10);
      });
    const hh = out.hour === 24 ? 0 : out.hour;
    return {
      y: out.year,
      m: out.month,
      d: out.day,
      hh,
      mm: out.minute,
      ss: out.second,
      dow: new Date(Date.UTC(out.year, out.month - 1, out.day)).getUTCDay(),
    };
  }

  // Offset of the zone from UTC at an instant, in minutes (east positive).
  function offsetMinutes(ms, tz) {
    const p = localParts(ms, tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
  }

  // Wall-clock time in a zone -> instant. p = {y, m (1-12), d, hh, mm}.
  //  - A time that happens twice (clocks going back) resolves to the first.
  //  - A time that doesn't exist (clocks going forward) moves forward by
  //    the length of the gap, e.g. 01:30 -> 02:30 in the UK in March.
  function zonedToUtc(p, tz) {
    const naive = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, 0);
    const offBefore = offsetMinutes(naive - DAY_MS, tz);
    const offAfter = offsetMinutes(naive + DAY_MS, tz);
    const candidates = [];
    new Set([offBefore, offAfter]).forEach((off) => {
      const t = naive - off * 60000;
      if (offsetMinutes(t, tz) === off) candidates.push(t);
    });
    if (candidates.length) return Math.min.apply(null, candidates);
    return naive - offBefore * 60000;
  }

  // --- Calendar helpers (pure civil-date maths, no zone involved) ------

  function isLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function daysInMonth(y, m) {
    return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }

  function weekdayOf(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  function addDays(date, n) {
    const t = new Date(Date.UTC(date.y, date.m - 1, date.d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return { y, m, d };
  }

  function formatDateStr(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.y}-${pad(date.m)}-${pad(date.d)}`;
  }

  function parseTime(str) {
    const [hh, mm] = str.split(":").map(Number);
    return { hh, mm };
  }

  // Day of month for "the nth <weekday>" of a month. nth 1-4, or -1 for last.
  function nthWeekdayDay(y, m, nth, weekday) {
    if (nth === -1) {
      const dim = daysInMonth(y, m);
      const lastDow = weekdayOf(y, m, dim);
      return dim - ((lastDow - weekday + 7) % 7);
    }
    const first = 1 + ((weekday - weekdayOf(y, m, 1) + 7) % 7);
    return first + 7 * (nth - 1);
  }

  // Day of month a monthly rule lands on in a given month.
  function monthlyDay(y, m, monthly) {
    if (monthly.mode === "weekday") return nthWeekdayDay(y, m, monthly.nth, monthly.weekday);
    // Clamped at use time only - the stored day is never changed, so a
    // routine set for the 31st is back on the 31st in months that have one.
    return Math.min(monthly.day, daysInMonth(y, m));
  }

  // --- Rules ------------------------------------------------------------

  function isValidRule(rule) {
    if (!rule || typeof rule !== "object") return false;
    if (rule.freq !== "daily" && rule.freq !== "weekly" && rule.freq !== "monthly") return false;
    if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 1000) return false;
    if (typeof rule.tz !== "string" || !rule.tz) return false;
    try {
      getFormatter(rule.tz);
    } catch (err) {
      return false;
    }
    if (typeof rule.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time)) return false;
    if (typeof rule.anchor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rule.anchor)) return false;
    const a = parseDate(rule.anchor);
    if (a.m < 1 || a.m > 12 || a.d < 1 || a.d > daysInMonth(a.y, a.m)) return false;
    if (rule.freq === "monthly") {
      const mo = rule.monthly;
      if (!mo) return false;
      if (mo.mode === "day") {
        if (!Number.isInteger(mo.day) || mo.day < 1 || mo.day > 31) return false;
      } else if (mo.mode === "weekday") {
        if (![1, 2, 3, 4, -1].includes(mo.nth)) return false;
        if (!Number.isInteger(mo.weekday) || mo.weekday < 0 || mo.weekday > 6) return false;
      } else {
        return false;
      }
    }
    return true;
  }

  // Local calendar date of occurrence k.
  function occurrenceDate(rule, k) {
    const anchor = parseDate(rule.anchor);
    if (rule.freq === "daily") return addDays(anchor, k * rule.interval);
    if (rule.freq === "weekly") return addDays(anchor, k * rule.interval * 7);
    const monthIndex = anchor.y * 12 + (anchor.m - 1) + k * rule.interval;
    const y = Math.floor(monthIndex / 12);
    const m = (monthIndex % 12) + 1;
    return { y, m, d: monthlyDay(y, m, rule.monthly) };
  }

  // The instant (ms) occurrence k is scheduled for.
  function scheduledAt(rule, k) {
    const date = occurrenceDate(rule, k);
    const { hh, mm } = parseTime(rule.time);
    return zonedToUtc({ y: date.y, m: date.m, d: date.d, hh, mm }, rule.tz);
  }

  function approxPeriodMs(rule) {
    if (rule.freq === "daily") return rule.interval * DAY_MS;
    if (rule.freq === "weekly") return rule.interval * 7 * DAY_MS;
    return rule.interval * 30.436875 * DAY_MS;
  }

  // Smallest k >= 0 with scheduledAt(k) >= ms.
  function indexAtOrAfter(rule, ms) {
    const first = scheduledAt(rule, 0);
    if (ms <= first) return 0;
    let k = Math.max(0, Math.floor((ms - first) / approxPeriodMs(rule)) - 2);
    let steps = 0;
    while (k > 0 && scheduledAt(rule, k - 1) >= ms && steps++ < MAX_STEPS) k--;
    while (scheduledAt(rule, k) < ms && steps++ < MAX_STEPS) k++;
    return k;
  }

  // Largest k with scheduledAt(k) <= ms, or -1 if none has happened yet.
  function latestIndexAtOrBefore(rule, ms) {
    const k = indexAtOrAfter(rule, ms);
    return scheduledAt(rule, k) <= ms ? k : k - 1;
  }

  // Smallest k with scheduledAt(k) > ms.
  function indexAfter(rule, ms) {
    return latestIndexAtOrBefore(rule, ms) + 1;
  }

  // --- Wording ------------------------------------------------------------

  function ordinal(n) {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
    return `${n}${suffix}`;
  }

  function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function unitWord(rule) {
    const base = { daily: "day", weekly: "week", monthly: "month" }[rule.freq];
    return rule.interval === 1 ? base : `${base}s`;
  }

  // "Every day", "Every 2 weeks", "Every 3 months"
  function describeCadence(rule) {
    return rule.interval === 1 ? `Every ${unitWord(rule)}` : `Every ${rule.interval} ${unitWord(rule)}`;
  }

  function weekdayOfAnchor(rule) {
    const a = parseDate(rule.anchor);
    return WEEKDAY_NAMES[weekdayOf(a.y, a.m, a.d)];
  }

  // The full sentence shown live under the form:
  // "Every 2 weeks on Sunday at 19:00"
  // "Every month on the third Thursday at 08:30"
  function describe(rule) {
    const cadence = describeCadence(rule);
    if (rule.freq === "daily") return `${cadence} at ${rule.time}`;
    if (rule.freq === "weekly") return `${cadence} on ${weekdayOfAnchor(rule)} at ${rule.time}`;
    const mo = rule.monthly;
    if (mo.mode === "day") return `${cadence} on the ${ordinal(mo.day)} at ${rule.time}`;
    return `${cadence} on the ${NTH_NAMES[mo.nth]} ${WEEKDAY_NAMES[mo.weekday]} at ${rule.time}`;
  }

  // Compact line for lists:
  // "Every 2 weeks · Sunday 19:00"
  // "First Saturday of every month · 10:00"
  function describeShort(rule) {
    if (rule.freq === "daily") return `${describeCadence(rule)} · ${rule.time}`;
    if (rule.freq === "weekly") return `${describeCadence(rule)} · ${weekdayOfAnchor(rule)} ${rule.time}`;
    const mo = rule.monthly;
    const every = rule.interval === 1 ? "every month" : `every ${rule.interval} months`;
    if (mo.mode === "day") return `${ordinal(mo.day)} of ${every} · ${rule.time}`;
    return `${capitalise(NTH_NAMES[mo.nth])} ${WEEKDAY_NAMES[mo.weekday]} of ${every} · ${rule.time}`;
  }

  // "Sunday 15 November, 19:00" - always in the rule's own zone, so it
  // reads the same on any device.
  function formatMoment(ms, tz, options) {
    const p = localParts(ms, tz);
    const pad = (n) => String(n).padStart(2, "0");
    const base = `${WEEKDAY_NAMES[p.dow]} ${p.d} ${MONTH_NAMES[p.m - 1]}`;
    const withYear = options && options.year ? `${base} ${p.y}` : base;
    return `${withYear}, ${pad(p.hh)}:${pad(p.mm)}`;
  }

  // "1 November" - for history lines.
  function formatDay(ms, tz) {
    const p = localParts(ms, tz);
    return `${p.d} ${MONTH_NAMES[p.m - 1]}`;
  }

  // --- Builders (used by the form and by legacy migration) -----------------

  function todayIn(tz, nowMs) {
    const p = localParts(nowMs, tz);
    return { y: p.y, m: p.m, d: p.d };
  }

  return {
    DAY_MS,
    WEEKDAY_NAMES,
    MONTH_NAMES,
    localParts,
    offsetMinutes,
    zonedToUtc,
    isLeap,
    daysInMonth,
    weekdayOf,
    addDays,
    parseDate,
    formatDateStr,
    nthWeekdayDay,
    monthlyDay,
    isValidRule,
    occurrenceDate,
    scheduledAt,
    indexAtOrAfter,
    indexAfter,
    latestIndexAtOrBefore,
    describe,
    describeShort,
    describeCadence,
    formatMoment,
    formatDay,
    ordinal,
    todayIn,
  };
})();

export default OrbitRecurrence;
