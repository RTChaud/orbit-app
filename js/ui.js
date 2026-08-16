/**
 * ui.js
 *
 * All direct DOM manipulation lives here. app.js decides *when* things
 * happen (event wiring, state changes); ui.js decides *how* they render.
 */

const OrbitUI = (() => {
  const el = {
    taskList: document.getElementById("task-list"),
    emptyState: document.getElementById("empty-state"),
    modal: document.getElementById("task-modal"),
    modalTitle: document.getElementById("modal-title"),
    form: document.getElementById("task-form"),
    nameInput: document.getElementById("task-name"),
    descriptionInput: document.getElementById("task-description"),
    dateInput: document.getElementById("task-date"),
    timeInput: document.getElementById("task-time"),
    formError: document.getElementById("form-error"),
    banner: document.getElementById("notification-banner"),
    bannerText: document.getElementById("notification-banner-text"),
    bannerBtn: document.getElementById("notification-banner-btn"),
  };

  function formatWhen(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderTasks(tasks, onDelete) {
    el.taskList.innerHTML = "";

    const sorted = [...tasks].sort((a, b) => a.timestamp - b.timestamp);

    el.emptyState.hidden = sorted.length > 0;

    sorted.forEach((task) => {
      const isPast = task.timestamp <= Date.now();

      const li = document.createElement("li");
      li.className = "task-card" + (isPast ? " is-past" : "");

      const main = document.createElement("div");
      main.className = "task-card-main";

      const name = document.createElement("p");
      name.className = "task-card-name";
      name.textContent = task.name;

      main.appendChild(name);

      if (task.description) {
        const desc = document.createElement("p");
        desc.className = "task-card-description";
        desc.textContent = task.description;
        main.appendChild(desc);
      }

      const when = document.createElement("p");
      when.className = "task-card-time" + (isPast ? " is-past" : "");
      when.textContent = isPast
        ? `Notified ${formatWhen(task.timestamp)}`
        : formatWhen(task.timestamp);
      main.appendChild(when);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "task-card-delete";
      deleteBtn.setAttribute("aria-label", `Delete ${task.name}`);
      deleteBtn.textContent = "\u00d7";
      deleteBtn.addEventListener("click", () => onDelete(task.id));

      li.appendChild(main);
      li.appendChild(deleteBtn);
      el.taskList.appendChild(li);
    });
  }

  function openModal() {
    el.formError.hidden = true;
    el.form.reset();

    // Default the date/time picker to a few minutes from now, purely as
    // a convenient starting point for testing notifications quickly.
    const soon = new Date(Date.now() + 5 * 60 * 1000);
    el.dateInput.value = soon.toISOString().slice(0, 10);
    el.timeInput.value = soon.toTimeString().slice(0, 5);

    el.modal.hidden = false;
    el.nameInput.focus();
  }

  function closeModal() {
    el.modal.hidden = true;
  }

  function showFormError(message) {
    el.formError.textContent = message;
    el.formError.hidden = false;
  }

  function showBanner(text, buttonText, onClick) {
    el.bannerText.textContent = text;
    el.bannerBtn.textContent = buttonText;
    el.bannerBtn.onclick = onClick;
    el.banner.hidden = false;
  }

  function hideBanner() {
    el.banner.hidden = true;
  }

  function getFormValues() {
    return {
      name: el.nameInput.value.trim(),
      description: el.descriptionInput.value.trim(),
      date: el.dateInput.value,
      time: el.timeInput.value,
    };
  }

  return {
    el,
    renderTasks,
    openModal,
    closeModal,
    showFormError,
    showBanner,
    hideBanner,
    getFormValues,
  };
})();
