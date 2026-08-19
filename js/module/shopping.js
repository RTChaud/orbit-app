/**
 * modules/shopping.js
 */

const OrbitShoppingModule = (() => {
  function render(root, header) {
    OrbitUI.renderModuleHeader(header, "Shopping", openAddForm);

    const list = OrbitShopping.getDefaultList();
    const listEl = document.createElement("div");
    listEl.className = "item-list";

    if (list.items.length === 0) {
      listEl.appendChild(OrbitUI.buildEmptyHint("No items yet."));
    } else {
      // Unchecked items first, so the active list stays at the top.
      const sorted = [...list.items].sort((a, b) => Number(a.completed) - Number(b.completed));
      sorted.forEach((item) => {
        const row = OrbitUI.buildItemRow({
          name: item.name,
          completed: item.completed,
          onToggle: () => {
            OrbitShopping.toggleItem(list.id, item.id);
            OrbitRouter.renderCurrent();
          },
          onDelete: () => {
            OrbitShopping.removeItem(list.id, item.id);
            OrbitRouter.renderCurrent();
          },
        });
        listEl.appendChild(row);
      });
    }

    root.appendChild(listEl);
  }

  function openAddForm() {
    const list = OrbitShopping.getDefaultList();

    const form = document.createElement("form");
    form.className = "form";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.maxLength = 80;

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

    form.appendChild(OrbitUI.buildField("Item name", nameInput));
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      OrbitShopping.addItem(list.id, name);
      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal("Add item", form);
    nameInput.focus();
  }

  return { render };
})();

OrbitRouter.register("shopping", OrbitShoppingModule.render);
