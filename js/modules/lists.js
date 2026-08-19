/**
 * modules/lists.js
 *
 * '#/lists' shows the list of lists. '#/lists/<id>' shows one list's
 * items. Both are handled by the same registered route, switching on
 * whether a params[0] id was given.
 */

const OrbitListsModule = (() => {
  function render(root, header, params) {
    const listId = params[0];
    if (listId) {
      renderListDetail(root, header, listId);
    } else {
      renderListIndex(root, header);
    }
  }

  function renderListIndex(root, header) {
    OrbitUI.renderModuleHeader(header, "Lists", openCreateListForm);

    const lists = OrbitLists.getAll();
    const listEl = document.createElement("div");
    listEl.className = "item-list";

    if (lists.length === 0) {
      listEl.appendChild(OrbitUI.buildEmptyHint("No lists yet."));
    } else {
      lists.forEach((list) => {
        const remaining = list.items.filter((i) => !i.completed).length;
        const row = OrbitUI.buildItemRow({
          name: list.name,
          subtext: `${remaining} item${remaining === 1 ? "" : "s"}`,
          onDelete: () => {
            OrbitLists.removeList(list.id);
            OrbitRouter.renderCurrent();
          },
        });
        row.classList.add("item-row-tappable");
        row.addEventListener("click", (event) => {
          if (event.target.closest(".item-row-delete")) return;
          OrbitRouter.navigate(`/lists/${list.id}`);
        });
        listEl.appendChild(row);
      });
    }

    root.appendChild(listEl);
  }

  function renderListDetail(root, header, listId) {
    const list = OrbitLists.get(listId);
    if (!list) {
      OrbitUI.renderModuleHeader(header, "Lists", null);
      root.appendChild(OrbitUI.buildEmptyHint("This list no longer exists."));
      return;
    }

    OrbitUI.renderModuleHeader(header, list.name, () => openAddItemForm(list));

    const listEl = document.createElement("div");
    listEl.className = "item-list";

    if (list.items.length === 0) {
      listEl.appendChild(OrbitUI.buildEmptyHint("No items yet."));
    } else {
      const sorted = [...list.items].sort((a, b) => Number(a.completed) - Number(b.completed));
      sorted.forEach((item) => {
        const row = OrbitUI.buildItemRow({
          name: item.name,
          completed: item.completed,
          onToggle: () => {
            OrbitLists.toggleItem(list.id, item.id);
            OrbitRouter.renderCurrent();
          },
          onDelete: () => {
            OrbitLists.removeItem(list.id, item.id);
            OrbitRouter.renderCurrent();
          },
        });
        listEl.appendChild(row);
      });
    }

    root.appendChild(listEl);
  }

  function openCreateListForm() {
    const form = document.createElement("form");
    form.className = "form";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.maxLength = 60;

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

    form.appendChild(OrbitUI.buildField("List name", nameInput));
    form.appendChild(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      const list = OrbitLists.createList(name);
      OrbitUI.closeModal();
      OrbitRouter.navigate(`/lists/${list.id}`);
    });

    OrbitUI.openModal("New list", form);
    nameInput.focus();
  }

  function openAddItemForm(list) {
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
      OrbitLists.addItem(list.id, name);
      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal("Add item", form);
    nameInput.focus();
  }

  return { render };
})();

OrbitRouter.register("lists", OrbitListsModule.render);
