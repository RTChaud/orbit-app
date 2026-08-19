/**
 * modules/tasks.js
 *
 * A Task starts with no date. Adding a deadline later doesn't create a
 * new item or move it anywhere - it just sets dueAt on the same item,
 * which is why it then also shows up in Upcoming/Soon/Calendar (those
 * views already look for type 'task' with a dueAt set).
 */

const OrbitTasksModule = (() => {
  function render(root, header) {
    OrbitUI.renderModuleHeader(header, "Tasks", openAddForm);

    const tasks = OrbitItems.getOpenTasks();
    const list = document.createElement("div");
    list.className = "item-list";

    if (tasks.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("No tasks yet."));
    } else {
      tasks.forEach((item) => {
        let subtext = item.description || "";
        if (typeof item.dueAt === "number") {
          const due = OrbitUtils.formatDateTime(item);
          subtext = subtext ? `${subtext} · Due ${due}` : `Due ${due}`;
        }

        const row = OrbitUI.buildItemRow({
          name: item.name,
          subtext,
          onToggle: () => {
            if (typeof item.dueAt === "number") OrbitReminders.cancelItem(item.id);
            OrbitItems.complete(item.id);
            OrbitRouter.renderCurrent();
          },
          onDelete: () => {
            if (typeof item.dueAt === "number") OrbitReminders.cancelItem(item.id);
            OrbitItems.remove(item.id);
            OrbitRouter.renderCurrent();
          },
        });

        if (typeof item.dueAt !== "number") {
          const deadlineBtn = document.createElement("button");
          deadlineBtn.type = "button";
          deadlineBtn.className = "item-row-secondary-action";
          deadlineBtn.textContent = "Add deadline";
          deadlineBtn.addEventListener("click", () => openDeadlineForm(item));
          row.appendChild(deadlineBtn);
        }

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

      OrbitItems.create({ type: "task", name, description: descInput.value.trim() });
      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal("Add task", form);
    nameInput.focus();
  }

  function openDeadlineForm(item) {
    const form = document.createElement("form");
    form.className = "form";

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

    const dateRow = document.createElement("div");
    dateRow.className = "field-row";
    dateRow.appendChild(OrbitUI.buildField("Date", dateInput));
    dateRow.appendChild(OrbitUI.buildField("Time", timeInput));
    form.appendChild(dateRow);
    form.appendChild(error);
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!dateInput.value) {
        error.textContent = "Please choose a date.";
        error.hidden = false;
        return;
      }

      const { timestamp, hasTime } = OrbitUtils.combineDateTime(dateInput.value, timeInput.value);
      const updated = OrbitItems.update(item.id, { dueAt: timestamp, hasTime });
      OrbitReminders.scheduleItem(updated);

      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal(`Deadline for "${item.name}"`, form);
  }

  return { render };
})();

OrbitRouter.register("tasks", OrbitTasksModule.render);
