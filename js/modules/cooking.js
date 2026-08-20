/**
 * modules/cooking.js
 *
 * A single flat list - title + duration, nothing else. Tapping a food
 * opens Start, which creates a normal Soon item via OrbitItems/
 * OrbitReminders - the exact same path Soon's own "Add task" uses (see
 * js/modules/soon.js) - so all of Orbit's existing notification/push
 * behaviour just works, with no second timer system.
 */

const OrbitCookingModule = (() => {
  function render(root, header) {
    OrbitUI.renderModuleHeader(header, "Cooking", openAddForm);

    const foods = OrbitCooking.sortedAll();
    const list = document.createElement("div");
    list.className = "item-list";

    if (foods.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("No foods saved yet."));
    } else {
      foods.forEach((food) => {
        const row = OrbitUI.buildItemRow({
          name: food.name,
          subtext: OrbitUtils.formatMinutesDuration(food.durationMinutes),
          onDelete: () => {
            OrbitCooking.remove(food.id);
            OrbitRouter.renderCurrent();
          },
        });
        row.classList.add("item-row-tappable");
        row.addEventListener("click", (event) => {
          if (event.target.closest(".item-row-delete") || event.target.closest(".item-row-secondary-action")) return;
          openStartModal(food);
        });

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "item-row-secondary-action";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openFoodForm(food);
        });
        row.appendChild(editBtn);

        list.appendChild(row);
      });
    }

    root.appendChild(list);
  }

  function openAddForm() {
    openFoodForm(null);
  }

  function openFoodForm(existingFood) {
    const isEdit = Boolean(existingFood);

    const form = document.createElement("form");
    form.className = "form";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.maxLength = 80;
    if (existingFood) nameInput.value = existingFood.name;

    const durationInput = document.createElement("input");
    durationInput.type = "time";
    durationInput.required = true;
    durationInput.value = existingFood
      ? `${OrbitUtils.pad(Math.floor(existingFood.durationMinutes / 60))}:${OrbitUtils.pad(
          existingFood.durationMinutes % 60
        )}`
      : "00:00";

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

    form.appendChild(OrbitUI.buildField("Title", nameInput));
    form.appendChild(OrbitUI.buildField("Duration", durationInput));
    form.appendChild(error);
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      const [hours, minutes] = durationInput.value.split(":").map((n) => parseInt(n, 10) || 0);
      const totalMinutes = hours * 60 + minutes;

      if (!name) {
        error.textContent = "Please enter a title.";
        error.hidden = false;
        return;
      }
      if (totalMinutes === 0) {
        error.textContent = "Please set a duration greater than zero.";
        error.hidden = false;
        return;
      }

      if (isEdit) {
        OrbitCooking.update(existingFood.id, { name, durationMinutes: totalMinutes });
      } else {
        OrbitCooking.create(name, totalMinutes);
      }

      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal(isEdit ? "Edit food" : "Add food", form);
    nameInput.focus();
  }

  function openStartModal(food) {
    const wrap = document.createElement("div");
    wrap.className = "form";

    const summary = document.createElement("p");
    summary.className = "item-row-subtext";
    summary.textContent = OrbitUtils.formatMinutesDuration(food.durationMinutes);
    wrap.appendChild(summary);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", OrbitUI.closeModal);
    const startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.className = "btn btn-primary";
    startBtn.textContent = "Start";
    startBtn.addEventListener("click", () => {
      const dueAt = Date.now() + food.durationMinutes * 60 * 1000;
      const item = OrbitItems.create({ type: "soon", name: food.name, dueAt, hasTime: true });
      OrbitReminders.scheduleItem(item);

      OrbitUI.closeModal();
      OrbitUI.showToast(`Timer started for ${food.name}`);
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(startBtn);
    wrap.appendChild(actions);

    OrbitUI.openModal(food.name, wrap);
  }

  return { render };
})();

OrbitRouter.register("cooking", OrbitCookingModule.render);
