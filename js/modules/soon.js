/**
 * modules/soon.js
 *
 * Soon has two roles:
 *  1. Its own fast "due in X" creation flow (type: 'soon').
 *  2. A read-only view of ANY item (Upcoming, Routine, Waiting, Task with
 *     a deadline) that has come within 24 hours of its due time - these
 *     are never copied, just filtered in from OrbitItems.getSoonItems().
 *
 * It also remembers names typed here (with the duration used) as
 * suggestions - see js/data/suggestions.js - so "washing machine" can
 * autocomplete and refill "1h 14m" next time.
 */

const OrbitSoonModule = (() => {
  function render(root, header) {
    OrbitUI.renderModuleHeader(header, "Soon", openAddForm, openSuggestionsModal);

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

  function openSuggestionsModal() {
    const wrap = document.createElement("div");
    wrap.className = "item-list";

    const suggestions = OrbitSuggestions.sortedAll("soon");
    if (suggestions.length === 0) {
      wrap.appendChild(OrbitUI.buildEmptyHint("No previously used tasks yet."));
    } else {
      suggestions.forEach((s) => {
        const row = OrbitUI.buildItemRow({
          name: s.name,
          subtext:
            typeof s.durationMinutes === "number"
              ? `Usually ${OrbitUtils.formatMinutesDuration(s.durationMinutes)}`
              : undefined,
          onDelete: () => {
            OrbitSuggestions.remove("soon", s.name);
            openSuggestionsModal();
          },
        });
        wrap.appendChild(row);
      });
    }

    OrbitUI.openModal("Previously used", wrap);
  }

  function openAddForm() {
    const form = document.createElement("form");
    form.className = "form";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.maxLength = 80;

    const durationInput = document.createElement("input");
    durationInput.type = "time";
    durationInput.value = "00:00";
    durationInput.required = true;

    OrbitUI.wireAutocomplete(
      nameInput,
      (query) => OrbitSuggestions.search("soon", query),
      (match) => {
        nameInput.value = match.name;
        if (typeof match.durationMinutes === "number") {
          const hours = Math.floor(match.durationMinutes / 60);
          const minutes = match.durationMinutes % 60;
          durationInput.value = `${OrbitUtils.pad(hours)}:${OrbitUtils.pad(minutes)}`;
        }
      }
    );

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
        durationInput.value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
    form.appendChild(OrbitUI.buildField("Duration", durationInput));
    form.appendChild(error);
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      const [hours, minutes] = durationInput.value.split(":").map((n) => parseInt(n, 10) || 0);

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

      const totalMinutes = hours * 60 + minutes;
      const dueAt = Date.now() + totalMinutes * 60 * 1000;
      const item = OrbitItems.create({ type: "soon", name, dueAt, hasTime: true });
      OrbitReminders.scheduleItem(item);
      OrbitSuggestions.upsertSoon(name, totalMinutes);

      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal("Add task", form);
    nameInput.focus();
  }

  return { render };
})();

OrbitRouter.register("soon", OrbitSoonModule.render);
