/**
 * utils.js
 *
 * Small formatting helpers shared across modules, so date/time display
 * stays consistent everywhere instead of every module rolling its own.
 */

const OrbitUtils = (() => {
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function startOfDay(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // "1h 15m", "25m", "Overdue by 10m", "Due now"
  function formatRelativeDuration(ms) {
    const abs = Math.abs(ms);
    const totalMinutes = Math.round(abs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let text;
    if (totalMinutes < 1) {
      text = "due now";
    } else if (hours === 0) {
      text = `${minutes}m`;
    } else if (minutes === 0) {
      text = `${hours}h`;
    } else {
      text = `${hours}h ${minutes}m`;
    }

    if (ms < 0 && totalMinutes >= 1) return `overdue by ${text}`;
    if (totalMinutes < 1) return text;
    return `in ${text}`;
  }

  // "Fri 22 Aug" or "Fri 22 Aug, 17:30" depending on hasTime.
  function formatDateTime(item) {
    if (typeof item.dueAt !== "number") return "";
    const d = new Date(item.dueAt);
    const datePart = d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    if (!item.hasTime) return datePart;
    return `${datePart}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatTime(ms) {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // "Monday 17"
  function formatDayHeader(ms) {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric" });
  }

  // Combine a <input type="date"> + optional <input type="time"> value
  // into a timestamp. Defaults to 09:00 when no time is given, so
  // date-only reminders still fire at a sensible hour.
  function combineDateTime(dateStr, timeStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    let hour = 9;
    let minute = 0;
    let hasTime = false;
    if (timeStr) {
      [hour, minute] = timeStr.split(":").map(Number);
      hasTime = true;
    }
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    return { timestamp: date.getTime(), hasTime };
  }

  return {
    pad,
    startOfDay,
    formatRelativeDuration,
    formatDateTime,
    formatTime,
    formatDayHeader,
    combineDateTime,
  };
})();
