/**
 * icons.js
 *
 * Small hand-drawn line icons (no external icon library). Kept simple on
 * purpose - proper branding/space theme comes later and can replace these
 * without touching any module code, since every module just calls
 * OrbitIcons.get(name).
 */

const OrbitIcons = (() => {
  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

  const icons = {
    soon: `<svg viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>`,
    upcoming: `<svg viewBox="0 0 24 24" ${stroke}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>`,
    routines: `<svg viewBox="0 0 24 24" ${stroke}><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>`,
    tasks: `<svg viewBox="0 0 24 24" ${stroke}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l2.5 2.5L16 9"/></svg>`,
    shopping: `<svg viewBox="0 0 24 24" ${stroke}><path d="M5 8h14l-1.5 10.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>`,
    lists: `<svg viewBox="0 0 24 24" ${stroke}><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" ${stroke}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>`,
    waiting: `<svg viewBox="0 0 24 24" ${stroke}><path d="M6 3h12M6 21h12M8 3c0 4 8 4 8 8s-8 4-8 8M16 3c0 4-8 4-8 8s8 4 8 8"/></svg>`,

    back: `<svg viewBox="0 0 24 24" ${stroke}><path d="M15 5l-7 7 7 7"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" ${stroke}><path d="M12 5v14M5 12h14"/></svg>`,
    close: `<svg viewBox="0 0 24 24" ${stroke}><path d="M6 6l12 12M18 6L6 18"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" ${stroke}><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>`,
    checkOn: `<svg viewBox="0 0 24 24" ${stroke}><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="currentColor" stroke="none"/><path d="M8 12l2.5 2.5L16 9" stroke="#12141c"/></svg>`,
    checkOff: `<svg viewBox="0 0 24 24" ${stroke}><rect x="3.5" y="3.5" width="17" height="17" rx="5"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" ${stroke}><line x1="4" y1="6" x2="20" y2="6"/><circle cx="15" cy="6" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="9" cy="12" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="17" cy="18" r="2" fill="currentColor" stroke="none"/></svg>`,
    cooking: `<svg viewBox="0 0 24 24" ${stroke}><path d="M4 11h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3Z"/><path d="M2 9a2 2 0 0 0 2-2M22 9a2 2 0 0 1-2-2M9 11V7a3 3 0 0 1 6 0v4"/></svg>`,
  };

  function get(name) {
    return icons[name] || "";
  }

  return { get };
})();
