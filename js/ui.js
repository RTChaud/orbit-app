/**
 * ui.js
 *
 * Shared, generic UI plumbing used by every module:
 *  - the notification permission banner (unchanged behaviour from v1)
 *  - a generic modal shell that modules put their own form markup into
 *  - a module screen header (back button + title + optional add button)
 *
 * No module-specific markup lives here - that's in js/modules/*.js.
 */

const OrbitUI = (() => {
  const el = {
    banner: document.getElementById("notification-banner"),
    bannerText: document.getElementById("notification-banner-text"),
    bannerBtn: document.getElementById("notification-banner-btn"),
    modalOverlay: document.getElementById("app-modal"),
    modalTitle: document.getElementById("app-modal-title"),
    modalBody: document.getElementById("app-modal-body"),
    modalCloseBtn: document.getElementById("app-modal-close"),
  };

  el.modalCloseBtn.innerHTML = OrbitIcons.get("close");
  el.modalCloseBtn.addEventListener("click", closeModal);
  el.modalOverlay.addEventListener("click", (event) => {
    if (event.target === el.modalOverlay) closeModal();
  });

  function showBanner(text, buttonText, onClick) {
    el.bannerText.textContent = text;
    el.bannerBtn.textContent = buttonText;
    el.bannerBtn.onclick = onClick;
    el.banner.hidden = false;
  }

  function hideBanner() {
    el.banner.hidden = true;
  }

  // contentNode: a DOM node (built by the calling module) inserted as
  // the modal body. The module owns its own form + submit/cancel wiring.
  function openModal(title, contentNode) {
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = "";
    el.modalBody.appendChild(contentNode);
    el.modalOverlay.hidden = false;
  }

  function closeModal() {
    el.modalOverlay.hidden = true;
    el.modalBody.innerHTML = "";
  }

  // Builds a standard module header: back chevron, title, optional add
  // button. headerEl is cleared and repopulated each navigation.
  function renderModuleHeader(headerEl, title, onAdd, onSuggestions) {
    headerEl.innerHTML = "";
    headerEl.className = "app-header module-header";

    const backBtn = document.createElement("button");
    backBtn.className = "icon-btn header-back";
    backBtn.setAttribute("aria-label", "Back");
    backBtn.innerHTML = OrbitIcons.get("back");
    backBtn.addEventListener("click", () => OrbitRouter.back());

    const titleEl = document.createElement("h1");
    titleEl.className = "module-title";
    titleEl.textContent = title;

    headerEl.appendChild(backBtn);
    headerEl.appendChild(titleEl);

    if (onSuggestions) {
      const suggestionsBtn = document.createElement("button");
      suggestionsBtn.className = "icon-btn header-settings";
      suggestionsBtn.setAttribute("aria-label", "Previously used");
      suggestionsBtn.innerHTML = OrbitIcons.get("settings");
      suggestionsBtn.addEventListener("click", onSuggestions);
      headerEl.appendChild(suggestionsBtn);
    }

    if (onAdd) {
      const addBtn = document.createElement("button");
      addBtn.className = "icon-btn header-add";
      addBtn.setAttribute("aria-label", "Add");
      addBtn.innerHTML = OrbitIcons.get("plus");
      addBtn.addEventListener("click", onAdd);
      headerEl.appendChild(addBtn);
    } else {
      const spacer = document.createElement("div");
      spacer.className = "header-spacer";
      headerEl.appendChild(spacer);
    }
  }

  function renderHomeHeader(headerEl, onSettings) {
    headerEl.innerHTML = "";
    headerEl.className = "app-header home-header";

    const row = document.createElement("div");
    row.className = "home-header-row";

    const spacer = document.createElement("div");
    spacer.className = "header-spacer";

    const titles = document.createElement("div");
    titles.className = "home-header-titles";
    titles.innerHTML = `
      <h1 class="app-title">Orbit</h1>
      <p class="app-subtitle">Keep life neatly in orbit</p>
    `;

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "icon-btn header-settings";
    settingsBtn.setAttribute("aria-label", "Settings");
    settingsBtn.innerHTML = OrbitIcons.get("settings");
    settingsBtn.addEventListener("click", onSettings);

    const settingsWrap = document.createElement("div");
    settingsWrap.className = "header-settings-wrap";

    const versionLabel = document.createElement("p");
    versionLabel.className = "version-label";
    versionLabel.textContent = `v${ORBIT_APP_VERSION}`;

    settingsWrap.appendChild(settingsBtn);
    settingsWrap.appendChild(versionLabel);

    row.appendChild(spacer);
    row.appendChild(titles);
    row.appendChild(settingsWrap);
    headerEl.appendChild(row);
  }

  // Standard row: checkbox, name, optional subtext, delete button.
  // onToggle/onDelete are optional - omit either to hide that control.
  function buildItemRow({ name, subtext, completed, onToggle, onDelete }) {
    const row = document.createElement("div");
    row.className = "item-row" + (completed ? " is-completed" : "");

    if (onToggle) {
      const checkBtn = document.createElement("button");
      checkBtn.className = "item-check";
      checkBtn.setAttribute("aria-label", completed ? "Mark not done" : "Mark done");
      checkBtn.innerHTML = OrbitIcons.get(completed ? "checkOn" : "checkOff");
      checkBtn.addEventListener("click", onToggle);
      row.appendChild(checkBtn);
    }

    const main = document.createElement("div");
    main.className = "item-row-main";
    const nameEl = document.createElement("p");
    nameEl.className = "item-row-name";
    nameEl.textContent = name;
    main.appendChild(nameEl);
    if (subtext) {
      const subEl = document.createElement("p");
      subEl.className = "item-row-subtext";
      subEl.textContent = subtext;
      main.appendChild(subEl);
    }
    row.appendChild(main);

    if (onDelete) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "item-row-delete";
      deleteBtn.setAttribute("aria-label", `Delete ${name}`);
      deleteBtn.innerHTML = OrbitIcons.get("trash");
      deleteBtn.addEventListener("click", onDelete);
      row.appendChild(deleteBtn);
    }

    return row;
  }

  function buildEmptyHint(text) {
    const p = document.createElement("p");
    p.className = "empty-hint";
    p.textContent = text;
    return p;
  }

  // Wraps an input/select/textarea with a label, per the no-placeholder
  // rule - every field is identified by a visible label instead.
  function buildField(labelText, inputEl) {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const label = document.createElement("span");
    label.className = "field-label";
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(inputEl);
    return wrap;
  }

  // Wires a live-filtered dropdown under a text input. getMatches(query)
  // returns an array of {name, ...} objects; onSelect(match) is called
  // when one is tapped. The dropdown sits in normal document flow right
  // after the input (not absolutely positioned), so it can't get clipped
  // or misaligned inside the modal.
  function wireAutocomplete(input, getMatches, onSelect) {
    const list = document.createElement("ul");
    list.className = "autocomplete-list";
    list.hidden = true;

    // Insert after the whole label/field wrapper, not just the raw
    // input - the input is nested inside a <label class="field">, and a
    // browser forwards taps anywhere inside a label to its control,
    // which was fighting with taps on the dropdown itself.
    const anchor = input.closest(".field") || input;
    anchor.insertAdjacentElement("afterend", list);

    function preventBlur(event) {
      event.preventDefault();
    }

    function render() {
      const matches = document.activeElement === input ? getMatches(input.value) : [];
      list.innerHTML = "";
      if (matches.length === 0) {
        list.hidden = true;
        return;
      }
      matches.forEach((match) => {
        const li = document.createElement("li");
        li.textContent = match.name;
        // Keeps the input focused (so blur doesn't hide the list before
        // the tap lands). Deliberately mousedown only - preventDefault()
        // on touchstart can suppress the click event that follows it on
        // iOS Safari, which was silently breaking selection entirely.
        li.addEventListener("mousedown", preventBlur);
        li.addEventListener("click", () => {
          onSelect(match);
          list.hidden = true;
        });
        list.appendChild(li);
      });
      list.hidden = false;
    }

    input.addEventListener("input", render);
    input.addEventListener("focus", render);
    input.addEventListener("blur", () => {
      setTimeout(() => {
        list.hidden = true;
      }, 200);
    });
  }

  return {
    el,
    showBanner,
    hideBanner,
    openModal,
    closeModal,
    renderModuleHeader,
    renderHomeHeader,
    buildItemRow,
    buildEmptyHint,
    buildField,
    wireAutocomplete,
  };
})();
