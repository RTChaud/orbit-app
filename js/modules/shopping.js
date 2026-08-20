/**
 * modules/shopping.js
 *
 * Also remembers item names typed here as suggestions (see
 * js/data/suggestions.js), so "milk" autocompletes next time - no
 * duration involved, just the name.
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
    renderSuggestionsSection(root);
  }

  function renderSuggestionsSection(root) {
    const suggestions = OrbitSuggestions.sortedAll("shopping");
    if (suggestions.length === 0) return;

    const heading = document.createElement("h2");
    heading.className = "section-label";
    heading.textContent = "Previously used";
    root.appendChild(heading);

    const list = document.createElement("div");
    list.className = "item-list";
    suggestions.forEach((s) => {
      const row = OrbitUI.buildItemRow({
        name: s.name,
        onDelete: () => {
          OrbitSuggestions.remove("shopping", s.name);
          OrbitRouter.renderCurrent();
        },
      });
      list.appendChild(row);
    });
    root.appendChild(list);
  }

  function openAddForm() {
    const list = OrbitShopping.getDefaultList();

    const form = document.createElement("form");
    form.className = "form";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.maxLength = 80;

    OrbitUI.wireAutocomplete(
      nameInput,
      (query) => OrbitSuggestions.search("shopping", query),
      (match) => {
        nameInput.value = match.name;
      }
    );

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
      OrbitSuggestions.upsertShopping(name);
      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    OrbitUI.openModal("Add item", form);
    nameInput.focus();
  }

  return { render };
})();

OrbitRouter.register("shopping", OrbitShoppingModule.render);
