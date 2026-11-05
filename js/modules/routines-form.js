/**
 * modules/routines-form.js
 *
 * The "Add routine" form: Periodicity + "Repeat every N <unit>", an
 * optional "Repeat on" section for monthly routines, the start date/month
 * and time, and a live one-line preview of what will be saved.
 *
 * No placeholders anywhere - fields are identified by their labels, and
 * the only pre-filled values are real configuration defaults (every 1,
 * today, 09:00).
 *
 * The form only builds a rule (see data/recurrence.js) and hands it to
 * OrbitRoutines.create(); all the date maths lives in the engine.
 */

const OrbitRoutinesForm = (() => {
  const FREQ_OPTIONS = [
    ["daily", "Daily"],
    ["weekly", "Weekly"],
    ["monthly", "Monthly"],
  ];
  const NTH_OPTIONS = [
    [1, "First"],
    [2, "Second"],
    [3, "Third"],
    [4, "Fourth"],
    [-1, "Last"],
  ];
  const UNIT_WORDS = { daily: "day", weekly: "week", monthly: "month" };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function makeSelect(options, selectedValue) {
    const select = document.createElement("select");
    options.forEach(([value, label]) => {
      const opt = document.createElement("option");
      opt.value = String(value);
      opt.textContent = label;
      select.appendChild(opt);
    });
    select.value = String(selectedValue);
    return select;
  }

  function open() {
    const R = OrbitRecurrence;
    const tz = OrbitRoutines.deviceTimeZone();
    const today = R.todayIn(tz, Date.now());
    const todayDow = R.weekdayOf(today.y, today.m, today.d);

    const form = document.createElement("form");
    form.className = "form routine-form";

    // --- Name + description ---
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.maxLength = 80;

    const descInput = document.createElement("textarea");
    descInput.rows = 2;
    descInput.maxLength = 500;

    // --- Periodicity + Repeat every ---
    const freqSelect = makeSelect(FREQ_OPTIONS, "weekly");

    const intervalInput = document.createElement("input");
    intervalInput.type = "number";
    intervalInput.min = "1";
    intervalInput.max = "999";
    intervalInput.step = "1";
    intervalInput.value = "1";
    intervalInput.inputMode = "numeric";
    intervalInput.setAttribute("aria-label", "Repeat every");

    const unitLabel = document.createElement("span");
    unitLabel.className = "repeat-unit";

    const repeatControl = document.createElement("div");
    repeatControl.className = "repeat-control";
    repeatControl.appendChild(intervalInput);
    repeatControl.appendChild(unitLabel);

    const freqRow = document.createElement("div");
    freqRow.className = "field-row";
    freqRow.appendChild(OrbitUI.buildField("Periodicity", freqSelect));
    freqRow.appendChild(OrbitUI.buildField("Repeat every", repeatControl));

    // --- Monthly: Repeat on ---
    const dayOptions = [];
    for (let d = 1; d <= 31; d++) dayOptions.push([d, R.ordinal(d)]);
    const daySelect = makeSelect(dayOptions, today.d);

    const nthSelect = makeSelect(NTH_OPTIONS, 1);
    const weekdaySelect = makeSelect(
      R.WEEKDAY_NAMES.map((name, i) => [i, name]),
      todayDow
    );

    function buildRadio(value, labelText, checked) {
      const label = document.createElement("label");
      label.className = "radio-row";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "repeat-on";
      radio.value = value;
      radio.checked = checked;
      const text = document.createElement("span");
      text.textContent = labelText;
      label.appendChild(radio);
      label.appendChild(text);
      return { label, radio };
    }

    const dayOption = buildRadio("day", "Specific date of the month", true);
    const weekdayOption = buildRadio("weekday", "Specific weekday occurrence", false);

    const dayControls = document.createElement("div");
    dayControls.className = "radio-controls";
    dayControls.appendChild(daySelect);

    const weekdayControls = document.createElement("div");
    weekdayControls.className = "radio-controls";
    weekdayControls.appendChild(nthSelect);
    weekdayControls.appendChild(weekdaySelect);

    const radioGroup = document.createElement("div");
    radioGroup.className = "radio-group";
    radioGroup.appendChild(dayOption.label);
    radioGroup.appendChild(dayControls);
    radioGroup.appendChild(weekdayOption.label);
    radioGroup.appendChild(weekdayControls);

    const repeatOnField = document.createElement("div");
    repeatOnField.className = "field";
    const repeatOnLabel = document.createElement("span");
    repeatOnLabel.className = "field-label";
    repeatOnLabel.textContent = "Repeat on";
    repeatOnField.appendChild(repeatOnLabel);
    repeatOnField.appendChild(radioGroup);

    // --- Start date (daily/weekly) or start month (monthly), and time ---
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = R.formatDateStr(today);

    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.value = "09:00";

    const dateField = OrbitUI.buildField("First due date", dateInput);
    const timeField = OrbitUI.buildField("Time", timeInput);

    const monthSelect = makeSelect(
      R.MONTH_NAMES.map((name, i) => [i + 1, name]),
      today.m
    );
    const yearOptions = [];
    for (let y = today.y; y <= today.y + 5; y++) yearOptions.push([y, String(y)]);
    const yearSelect = makeSelect(yearOptions, today.y);

    const monthField = OrbitUI.buildField("Starting month", monthSelect);
    const yearField = OrbitUI.buildField("Year", yearSelect);

    // daily/weekly: [date | time].  monthly: [month | year] then [time].
    const dateRow = document.createElement("div");
    dateRow.className = "field-row";
    const monthRow = document.createElement("div");
    monthRow.className = "field-row";
    monthRow.appendChild(monthField);
    monthRow.appendChild(yearField);
    const timeRow = document.createElement("div");
    timeRow.className = "field-row";

    // --- Preview ---
    const preview = document.createElement("p");
    preview.className = "routine-preview";
    const previewFirst = document.createElement("p");
    previewFirst.className = "routine-preview-first";

    // --- Errors + actions ---
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
    form.appendChild(OrbitUI.buildField("Description", descInput));
    form.appendChild(freqRow);
    form.appendChild(repeatOnField);
    form.appendChild(dateRow);
    form.appendChild(monthRow);
    form.appendChild(timeRow);
    form.appendChild(preview);
    form.appendChild(previewFirst);
    form.appendChild(error);
    form.appendChild(actions);

    // --- Behaviour ---

    function selectedMode() {
      return weekdayOption.radio.checked ? "weekday" : "day";
    }

    let layoutIsMonthly = null;

    // Shows only what the chosen periodicity needs.
    function syncLayout() {
      const freq = freqSelect.value;
      const monthly = freq === "monthly";

      const interval = parseInt(intervalInput.value, 10);
      const unit = UNIT_WORDS[freq];
      unitLabel.textContent = interval === 1 || !interval ? unit : `${unit}s`;

      repeatOnField.hidden = !monthly;
      monthRow.hidden = !monthly;
      dateRow.hidden = monthly;

      const mode = selectedMode();
      dayControls.hidden = mode !== "day";
      weekdayControls.hidden = mode !== "weekday";
      dayOption.label.classList.toggle("is-selected", mode === "day");
      weekdayOption.label.classList.toggle("is-selected", mode === "weekday");

      // The one time field moves to wherever it belongs - but only when
      // the layout actually changes, because re-parenting an input that is
      // being edited would knock the date/time picker closed.
      if (monthly !== layoutIsMonthly) {
        layoutIsMonthly = monthly;
        if (monthly) {
          timeRow.appendChild(timeField);
        } else {
          dateRow.appendChild(dateField);
          dateRow.appendChild(timeField);
        }
      }
      timeRow.hidden = !monthly;
    }

    // The rule the form currently describes, or null while it's incomplete.
    function readRule() {
      const interval = parseInt(intervalInput.value, 10);
      if (!Number.isInteger(interval) || interval < 1 || interval > 999) return null;
      if (!timeInput.value) return null;

      const freq = freqSelect.value;
      const rule = { freq, interval, time: timeInput.value, tz };

      if (freq === "monthly") {
        rule.anchor = `${yearSelect.value}-${pad(parseInt(monthSelect.value, 10))}-01`;
        rule.monthly =
          selectedMode() === "day"
            ? { mode: "day", day: parseInt(daySelect.value, 10) }
            : {
                mode: "weekday",
                nth: parseInt(nthSelect.value, 10),
                weekday: parseInt(weekdaySelect.value, 10),
              };
      } else {
        if (!dateInput.value) return null;
        rule.anchor = dateInput.value;
      }

      return R.isValidRule(rule) ? rule : null;
    }

    function updatePreview() {
      syncLayout();
      error.hidden = true;

      const rule = readRule();
      if (!rule) {
        preview.textContent = "";
        previewFirst.textContent = "";
        return;
      }
      const firstK = R.indexAtOrAfter(rule, Date.now());
      preview.textContent = R.describe(rule);
      previewFirst.textContent = `First: ${R.formatMoment(R.scheduledAt(rule, firstK), tz)}`;
    }

    form.addEventListener("input", updatePreview);
    form.addEventListener("change", updatePreview);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();

      if (!name) {
        showError("Please enter a task name.");
        return;
      }
      const rule = readRule();
      if (!rule) {
        showError(
          freqSelect.value === "monthly"
            ? "Please check the repeat interval and time."
            : "Please check the repeat interval, first due date and time."
        );
        return;
      }

      OrbitRoutines.create({ name, description: descInput.value.trim(), rule });
      OrbitUI.closeModal();
      OrbitRouter.renderCurrent();
    });

    function showError(message) {
      error.textContent = message;
      error.hidden = false;
    }

    updatePreview();
    OrbitUI.openModal("Add routine", form);
    nameInput.focus();
  }

  return { open };
})();
