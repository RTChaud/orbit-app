/**
 * modules/soon.js
 *
 * Soon has two roles:
 *  1. Its own fast "due in X" creation flow (type: 'soon').
 *  2. A read-only view of ANY item (Upcoming, Routine, Waiting, Task with
 *     a deadline) that has come within 24 hours of its due time - these
 *     are never copied, just filtered in from OrbitItems.getSoonItems().
 */

const OrbitSoonModule = (() => {
  function render(root, header) {
    OrbitUI.renderModuleHeader(header, "Soon", openAddForm);

    const items = OrbitItems.getSoonItems();
    const list = document.createElement("div");
    list.className = "item-list";

    if (items.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("Nothing due in the next 24 hours."));
    } else {
      items.forEach((item) => {
        const remaining = item.dueAt - Date.now();
        const row = OrbitUI.buildItemRow({
          name: item.name,
          subtext: OrbitUtils.formatRelativeDuration(remaining),
          completed: false,
          onToggle: () => {
            OrbitReminders.cancelItem(item.id);
            OrbitItems.complete(item.id);
            if (item.type === "routine") OrbitReminders.scheduleItem(OrbitItems.get(item.id));
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

    const hoursInput = document.createElement("input");
    hoursInput.type = "number";
    hoursInput.min = "0";
    hoursInput.max = "23";
    hoursInput.inputMode = "numeric";
    hoursInput.value = "0";

    const minutesInput = document.createElement("input");
    minutesInput.type = "number";
    minutesInput.min = "0";
    minutesInput.max = "59";
    minutesInput.inputMode = "numeric";
    minutesInput.value = "15";

    const presetRow = document.createElement("div");
    presetRow.className = "preset-row";
    [
      ["15m", 0, 15],
      ["30m", 0, 30],
      ["1h", 1, 0],
      ["2h", 2, 0],
    ].forEach(([label, h, m]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        hoursInput.value = h;
        minutesInput.value = m;
      });
      presetRow.appendChild(btn);
    });

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
    form.appendChild(presetRow);
    form.appendChild(OrbitUI.buildField("Hours", hoursInput));
    form.appendChild(OrbitUI.buildField("Minutes", minutesInput));
    form.appendChild(error);
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      const hours = parseInt(hoursInput.value, 10) || 0;
      const minutes = parseInt(minutesInput.value, 10) || 0;

      if (!name) {
        error.textContent = "Please enter a task name.";
        error.hidden = false;
        return;
      }
      if (hours === 0 && minutes === 0) {
        error.textContent = "Please set a duration greater than zero.";
        error.hidden = false;
        return;
      }

      const dueAt = Date.now() + (hours * 60 + minutes) * 60 * 1000;
      const item = OrbitItems.create({ type: "soon", name, dueAt, hasTime: true });
      OrbitReminders.scheduleItem(item);

      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal("Add task", form);
    nameInput.focus();
  }

  return { render };
})();

OrbitRouter.register("soon", OrbitSoonModule.render);
