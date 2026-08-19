/**
 * modules/routines.js
 *
 * One "repeats every [N] [days/weeks/months]" control covers every
 * pattern in the brief: daily (1 day), weekly (1 week), every other
 * Sunday (2 weeks), every 5 days (5 days), every 3 months (3 months) -
 * the specific weekday/day-of-month comes naturally from the first due
 * date, so no separate weekday picker is needed.
 */

const OrbitRoutinesModule = (() => {
  const UNIT_LABELS = { day: "day(s)", week: "week(s)", month: "month(s)" };

  function render(root, header) {
    OrbitUI.renderModuleHeader(header, "Routines", openAddForm);

    const routines = OrbitItems.getRoutines();
    const list = document.createElement("div");
    list.className = "item-list";

    if (routines.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("No routines yet."));
    } else {
      routines.forEach((item) => {
        const row = OrbitUI.buildItemRow({
          name: item.name,
          subtext: `Next: ${OrbitUtils.formatDateTime(item)}`,
          onToggle: () => {
            OrbitReminders.cancelItem(item.id);
            const updated = OrbitItems.complete(item.id);
            OrbitReminders.scheduleItem(updated);
            OrbitRouter.renderCurrent();
          },
          onDelete: () => {
            OrbitReminders.cancelItem(item.id);
            OrbitItems.remove(item.id);
            OrbitRouter.renderCurrent();
          },
        });
        list.appendChild(row);
      });
    }

    root.appendChild(list);
  }

  function openAddForm() {
    const form = document.createElement("form");
    form.className = "form";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.maxLength = 80;

    const descInput = document.createElement("textarea");
    descInput.rows = 2;
    descInput.maxLength = 500;

    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.required = true;

    const timeInput = document.createElement("input");
    timeInput.type = "time";

    const intervalInput = document.createElement("input");
    intervalInput.type = "number";
    intervalInput.min = "1";
    intervalInput.value = "1";
    intervalInput.inputMode = "numeric";

    const unitSelect = document.createElement("select");
    Object.entries(UNIT_LABELS).forEach(([value, label]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      unitSelect.appendChild(opt);
    });
    unitSelect.value = "week";

    const error = document.createElement("p");
    error.className = "form-error";
    error.hidden = true;

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", OrbitUI.closeModal);
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn btn-primary";
    saveBtn.textContent = "Save";
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    form.appendChild(OrbitUI.buildField("Task name", nameInput));
    form.appendChild(OrbitUI.buildField("Description", descInput));
    const dateRow = document.createElement("div");
    dateRow.className = "field-row";
    dateRow.appendChild(OrbitUI.buildField("First due date", dateInput));
    dateRow.appendChild(OrbitUI.buildField("Time", timeInput));
    form.appendChild(dateRow);
    const repeatRow = document.createElement("div");
    repeatRow.className = "field-row";
    repeatRow.appendChild(OrbitUI.buildField("Repeats every", intervalInput));
    repeatRow.appendChild(OrbitUI.buildField("Unit", unitSelect));
    form.appendChild(repeatRow);
    form.appendChild(error);
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      const interval = parseInt(intervalInput.value, 10) || 1;

      if (!name) {
        error.textContent = "Please enter a task name.";
        error.hidden = false;
        return;
      }
      if (!dateInput.value) {
        error.textContent = "Please choose a first due date.";
        error.hidden = false;
        return;
      }

      const { timestamp, hasTime } = OrbitUtils.combineDateTime(dateInput.value, timeInput.value);
      const item = OrbitItems.create({
        type: "routine",
        name,
        description: descInput.value.trim(),
        dueAt: timestamp,
        hasTime,
        recurrence: { unit: unitSelect.value, interval },
      });
      OrbitReminders.scheduleItem(item);

      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal("Add routine", form);
    nameInput.focus();
  }

  return { render };
})();

OrbitRouter.register("routines", OrbitRoutinesModule.render);
