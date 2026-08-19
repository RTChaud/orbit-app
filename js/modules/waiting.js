/**
 * modules/waiting.js
 */

const OrbitWaitingModule = (() => {
  function render(root, header) {
    OrbitUI.renderModuleHeader(header, "Waiting", openAddForm);

    const items = OrbitItems.getWaitingItems();
    const list = document.createElement("div");
    list.className = "item-list";

    if (items.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("Nothing you're waiting on."));
    } else {
      items.forEach((item) => {
        let subtext = item.description || "";
        if (typeof item.dueAt === "number") {
          const followUp = `Follow up ${OrbitUtils.formatDateTime(item)}`;
          subtext = subtext ? `${subtext} · ${followUp}` : followUp;
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

    form.appendChild(OrbitUI.buildField("Name", nameInput));
    form.appendChild(OrbitUI.buildField("Description", descInput));
    const dateRow = document.createElement("div");
    dateRow.className = "field-row";
    dateRow.appendChild(OrbitUI.buildField("Follow-up date", dateInput));
    dateRow.appendChild(OrbitUI.buildField("Time", timeInput));
    form.appendChild(dateRow);
    form.appendChild(error);
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        error.textContent = "Please enter a name.";
        error.hidden = false;
        return;
      }

      const fields = {
        type: "waiting",
        name,
        description: descInput.value.trim(),
      };

      if (dateInput.value) {
        const { timestamp, hasTime } = OrbitUtils.combineDateTime(dateInput.value, timeInput.value);
        fields.dueAt = timestamp;
        fields.hasTime = hasTime;
      }

      const item = OrbitItems.create(fields);
      if (typeof item.dueAt === "number") OrbitReminders.scheduleItem(item);

      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal("Add waiting item", form);
    nameInput.focus();
  }

  return { render };
})();

OrbitRouter.register("waiting", OrbitWaitingModule.render);
