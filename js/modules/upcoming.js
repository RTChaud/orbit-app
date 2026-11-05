/**
 * modules/upcoming.js
 */

const OrbitUpcomingModule = (() => {
  function render(root, header) {
    OrbitUI.renderModuleHeader(header, "Upcoming", openAddForm);

    const items = OrbitItems.getUpcomingItems();
    const list = document.createElement("div");
    list.className = "item-list";

    if (items.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("No upcoming tasks."));
    } else {
      items.forEach((item) => {
        // Routines show their next occurrence here (the same item that
        // Soon shows once it is inside the Soon window - never a copy).
        const isRoutine = item.type === "routine";
        const row = OrbitUI.buildItemRow({
          name: item.name,
          subtext: OrbitUtils.formatDateTime(item) + (isRoutine ? " \u00b7 Routine" : ""),
          completed: false,
          onToggle: () => {
            if (isRoutine) {
              OrbitRoutines.complete(item.id, item.k);
            } else {
              OrbitReminders.cancelItem(item.id);
              OrbitItems.complete(item.id);
            }
            OrbitRouter.renderCurrent();
          },
          onDelete: isRoutine
            ? undefined
            : () => {
                OrbitReminders.cancelItem(item.id);
                OrbitItems.remove(item.id);
                OrbitRouter.renderCurrent();
              },
        });
        if (isRoutine) OrbitRoutinesModule.linkRow(row, item.id);
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
    dateRow.appendChild(OrbitUI.buildField("Date", dateInput));
    dateRow.appendChild(OrbitUI.buildField("Time", timeInput));
    form.appendChild(dateRow);
    form.appendChild(error);
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();

      if (!name) {
        error.textContent = "Please enter a task name.";
        error.hidden = false;
        return;
      }
      if (!dateInput.value) {
        error.textContent = "Please choose a date.";
        error.hidden = false;
        return;
      }

      const { timestamp, hasTime } = OrbitUtils.combineDateTime(dateInput.value, timeInput.value);
      const item = OrbitItems.create({
        type: "upcoming",
        name,
        description: descInput.value.trim(),
        dueAt: timestamp,
        hasTime,
      });
      OrbitReminders.scheduleItem(item);

      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal("Add task", form);
    nameInput.focus();
  }

  return { render };
})();

OrbitRouter.register("upcoming", OrbitUpcomingModule.render);
