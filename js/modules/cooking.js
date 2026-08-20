/**
 * modules/cooking.js
 *
 * '#/cooking' shows the list of saved foods. '#/cooking/<id>' shows one
 * food's cooking methods. Pressing Start on a method creates a normal
 * Soon item via OrbitItems/OrbitReminders - the exact same path Soon's
 * own "Add task" uses (see js/modules/soon.js) - so all of Orbit's
 * existing notification/push behaviour just works, with no second
 * timer system.
 */

const OrbitCookingModule = (() => {
  // Which optional fields make sense for each method. Duration is
  // always required; temperature/wattage/notes are only shown where
  // they're actually relevant, per method.
  const METHOD_TYPES = [
    { value: "airFryer", label: "Air fryer", temperature: true, wattage: false },
    { value: "oven", label: "Oven", temperature: true, wattage: false },
    { value: "hob", label: "Hob", temperature: false, wattage: false },
    { value: "microwave", label: "Microwave", temperature: false, wattage: true },
    { value: "pan", label: "Pan", temperature: false, wattage: false },
    { value: "other", label: "Other", temperature: true, wattage: true },
  ];

  function methodConfig(type) {
    return METHOD_TYPES.find((m) => m.value === type) || METHOD_TYPES[METHOD_TYPES.length - 1];
  }

  function methodLabel(type) {
    return methodConfig(type).label;
  }

  function formatMethodSummary(method) {
    const parts = [];
    if (typeof method.temperature === "number") parts.push(`${method.temperature}\u00b0C`);
    if (typeof method.wattage === "number") parts.push(`${method.wattage}W`);
    parts.push(OrbitUtils.formatMinutesDuration(method.durationMinutes));
    return parts.join(" \u00b7 ");
  }

  function render(root, header, params) {
    const foodId = params[0];
    if (foodId) {
      renderFoodDetail(root, header, foodId);
    } else {
      renderFoodList(root, header);
    }
  }

  function renderFoodList(root, header) {
    OrbitUI.renderModuleHeader(header, "Cooking", openAddFoodForm);

    const foods = OrbitCooking.sortedAll();
    const list = document.createElement("div");
    list.className = "item-list";

    if (foods.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("No foods saved yet."));
    } else {
      foods.forEach((food) => {
        const count = food.methods.length;
        const row = OrbitUI.buildItemRow({
          name: food.name,
          subtext: `${count} method${count === 1 ? "" : "s"}`,
          onDelete: () => {
            OrbitCooking.removeFood(food.id);
            OrbitRouter.renderCurrent();
          },
        });
        row.classList.add("item-row-tappable");
        row.addEventListener("click", (event) => {
          if (event.target.closest(".item-row-delete") || event.target.closest(".item-row-secondary-action")) return;
          OrbitRouter.navigate(`/cooking/${food.id}`);
        });

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "item-row-secondary-action";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openEditFoodForm(food);
        });
        row.appendChild(editBtn);

        list.appendChild(row);
      });
    }

    root.appendChild(list);
  }

  function renderFoodDetail(root, header, foodId) {
    const food = OrbitCooking.get(foodId);
    if (!food) {
      OrbitUI.renderModuleHeader(header, "Cooking", null);
      root.appendChild(OrbitUI.buildEmptyHint("This food no longer exists."));
      return;
    }

    OrbitUI.renderModuleHeader(header, food.name, () => openMethodForm(food, null));

    const list = document.createElement("div");
    list.className = "item-list";

    if (food.methods.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("No cooking methods yet."));
    } else {
      food.methods.forEach((method) => {
        const row = OrbitUI.buildItemRow({
          name: methodLabel(method.type),
          subtext: formatMethodSummary(method),
          onDelete: () => {
            OrbitCooking.removeMethod(food.id, method.id);
            OrbitRouter.renderCurrent();
          },
        });
        row.classList.add("item-row-tappable");
        row.addEventListener("click", (event) => {
          if (event.target.closest(".item-row-delete") || event.target.closest(".item-row-secondary-action")) return;
          openStartModal(food, method);
        });

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "item-row-secondary-action";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openMethodForm(food, method);
        });
        row.appendChild(editBtn);

        list.appendChild(row);
      });
    }

    root.appendChild(list);
  }

  function openAddFoodForm() {
    openFoodForm(null);
  }

  function openEditFoodForm(food) {
    openFoodForm(food);
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

    form.appendChild(OrbitUI.buildField("Food name", nameInput));
    form.appendChild(error);
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        error.textContent = "Please enter a food name.";
        error.hidden = false;
        return;
      }

      if (isEdit) {
        OrbitCooking.renameFood(existingFood.id, name);
        OrbitUI.closeModal();
        OrbitRouter.renderCurrent();
      } else {
        const food = OrbitCooking.createFood(name);
        OrbitUI.closeModal();
        OrbitRouter.navigate(`/cooking/${food.id}`);
      }
    });

    OrbitUI.openModal(isEdit ? "Edit food" : "Add food", form);
    nameInput.focus();
  }

  function openMethodForm(food, existingMethod) {
    const isEdit = Boolean(existingMethod);

    const form = document.createElement("form");
    form.className = "form";

    const typeSelect = document.createElement("select");
    METHOD_TYPES.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.value;
      opt.textContent = m.label;
      typeSelect.appendChild(opt);
    });
    typeSelect.value = existingMethod ? existingMethod.type : METHOD_TYPES[0].value;

    const durationInput = document.createElement("input");
    durationInput.type = "time";
    durationInput.required = true;
    durationInput.value = existingMethod
      ? `${OrbitUtils.pad(Math.floor(existingMethod.durationMinutes / 60))}:${OrbitUtils.pad(
          existingMethod.durationMinutes % 60
        )}`
      : "00:00";

    const temperatureInput = document.createElement("input");
    temperatureInput.type = "number";
    temperatureInput.inputMode = "numeric";
    temperatureInput.min = "0";
    if (existingMethod && typeof existingMethod.temperature === "number") {
      temperatureInput.value = existingMethod.temperature;
    }

    const wattageInput = document.createElement("input");
    wattageInput.type = "number";
    wattageInput.inputMode = "numeric";
    wattageInput.min = "0";
    if (existingMethod && typeof existingMethod.wattage === "number") {
      wattageInput.value = existingMethod.wattage;
    }

    const notesInput = document.createElement("textarea");
    notesInput.rows = 2;
    notesInput.maxLength = 300;
    if (existingMethod && existingMethod.notes) notesInput.value = existingMethod.notes;

    const temperatureField = OrbitUI.buildField("Temperature (\u00b0C)", temperatureInput);
    const wattageField = OrbitUI.buildField("Power (W)", wattageInput);

    function updateFieldVisibility() {
      const config = methodConfig(typeSelect.value);
      temperatureField.hidden = !config.temperature;
      wattageField.hidden = !config.wattage;
    }
    typeSelect.addEventListener("change", updateFieldVisibility);

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

    form.appendChild(OrbitUI.buildField("Method", typeSelect));
    form.appendChild(OrbitUI.buildField("Duration", durationInput));
    form.appendChild(temperatureField);
    form.appendChild(wattageField);
    form.appendChild(OrbitUI.buildField("Notes", notesInput));
    form.appendChild(error);
    form.appendChild(actions);

    updateFieldVisibility();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const [hours, minutes] = durationInput.value.split(":").map((n) => parseInt(n, 10) || 0);
      const totalMinutes = hours * 60 + minutes;

      if (totalMinutes === 0) {
        error.textContent = "Please set a duration greater than zero.";
        error.hidden = false;
        return;
      }

      const config = methodConfig(typeSelect.value);
      const method = {
        type: typeSelect.value,
        durationMinutes: totalMinutes,
        temperature: config.temperature && temperatureInput.value !== "" ? parseInt(temperatureInput.value, 10) : null,
        temperatureUnit: "C",
        wattage: config.wattage && wattageInput.value !== "" ? parseInt(wattageInput.value, 10) : null,
        notes: notesInput.value.trim() || null,
      };

      if (isEdit) {
        OrbitCooking.updateMethod(food.id, existingMethod.id, method);
      } else {
        OrbitCooking.addMethod(food.id, method);
      }

      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal(isEdit ? "Edit method" : "Add method", form);
  }

  function openStartModal(food, method) {
    const wrap = document.createElement("div");
    wrap.className = "form";

    const summary = document.createElement("p");
    summary.className = "item-row-subtext";
    summary.textContent = formatMethodSummary(method);
    wrap.appendChild(summary);

    if (method.notes) {
      const notes = document.createElement("p");
      notes.className = "item-row-subtext";
      notes.textContent = method.notes;
      wrap.appendChild(notes);
    }

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
      const dueAt = Date.now() + method.durationMinutes * 60 * 1000;
      const item = OrbitItems.create({ type: "soon", name: food.name, dueAt, hasTime: true });
      OrbitReminders.scheduleItem(item);

      OrbitUI.closeModal();
      OrbitUI.showToast(`Timer started for ${food.name}`);
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(startBtn);
    wrap.appendChild(actions);

    OrbitUI.openModal(methodLabel(method.type), wrap);
  }

  return { render };
})();

OrbitRouter.register("cooking", OrbitCookingModule.render);
