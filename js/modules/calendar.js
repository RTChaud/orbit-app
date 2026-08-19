/**
 * modules/calendar.js
 *
 * Read-only for now - no direct creation here. Every dated item (any
 * type) is pulled straight from OrbitItems for the current week; nothing
 * is duplicated into a separate calendar record.
 */

const OrbitCalendarModule = (() => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function render(root, header) {
    OrbitUI.renderModuleHeader(header, "Calendar", null);

    const today = OrbitUtils.startOfDay(Date.now());
    // Week starts on the most recent Sunday.
    const weekStart = today - new Date(today).getDay() * DAY_MS;

    const container = document.createElement("div");
    container.className = "calendar-week";

    for (let i = 0; i < 7; i++) {
      const dayStart = weekStart + i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const items = OrbitItems.getItemsInRange(dayStart, dayEnd);

      const dayBlock = document.createElement("div");
      dayBlock.className = "calendar-day" + (dayStart === today ? " is-today" : "");

      const dayHeader = document.createElement("p");
      dayHeader.className = "calendar-day-header";
      dayHeader.textContent = OrbitUtils.formatDayHeader(dayStart);
      dayBlock.appendChild(dayHeader);

      if (items.length === 0) {
        const none = document.createElement("p");
        none.className = "calendar-day-empty";
        none.textContent = "No items";
        dayBlock.appendChild(none);
      } else {
        items.forEach((item) => {
          const row = document.createElement("p");
          row.className = "calendar-item";
          const time = item.hasTime ? `${OrbitUtils.formatTime(item.dueAt)} ` : "";
          row.textContent = `${time}${item.name}`;
          dayBlock.appendChild(row);
        });
      }

      container.appendChild(dayBlock);
    }

    root.appendChild(container);
  }

  return { render };
})();

OrbitRouter.register("calendar", OrbitCalendarModule.render);
