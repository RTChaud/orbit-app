/**
 * modules/routines.js
 *
 * '#/routines'      the list: each routine's schedule and next occurrence.
 * '#/routines/<id>' one routine: Done / Skip / Snooze, Pause / Resume,
 *                   next due, last completed and a simple history.
 *
 * The add form is in routines-form.js; everything that changes a routine
 * is in data/routines.js. This file only draws and wires buttons.
 */

const OrbitRoutinesModule = (() => {
  const SNOOZE_REASONS = {
    past: "Choose a time in the future.",
    stale: "This occurrence has already changed.",
    unavailable: "This routine is paused.",
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  // --- Wording -------------------------------------------------------------

  // "Next: Sunday 15 November, 19:00" / "Overdue: Sunday 8 November, 19:00" / "Paused"
  function nextText(routine) {
    const state = OrbitRoutines.getState(routine);
    if (state === "paused") return { text: "Paused", cls: "is-paused" };
    const moment = OrbitRecurrence.formatMoment(routine.dueAt, routine.rule.tz);
    if (state === "overdue") return { text: `Overdue: ${moment}`, cls: "is-overdue" };
    return { text: `Next: ${moment}`, cls: "" };
  }

  // "1 November, 19:04" - an actual timestamp, in the routine's time zone.
  function formatStamp(ms, tz) {
    const p = OrbitRecurrence.localParts(ms, tz);
    const thisYear = OrbitRecurrence.localParts(Date.now(), tz).y;
    const year = p.y === thisYear ? "" : ` ${p.y}`;
    return `${p.d} ${OrbitRecurrence.MONTH_NAMES[p.m - 1]}${year}, ${pad(p.hh)}:${pad(p.mm)}`;
  }

  // "1 November" (with the year when it isn't this year).
  function formatDayLabel(ms, tz) {
    const p = OrbitRecurrence.localParts(ms, tz);
    const thisYear = OrbitRecurrence.localParts(Date.now(), tz).y;
    const year = p.y === thisYear ? "" : ` ${p.y}`;
    return `${p.d} ${OrbitRecurrence.MONTH_NAMES[p.m - 1]}${year}`;
  }

  // --- Routing ----------------------------------------------------------------

  function render(root, header, params) {
    OrbitRoutines.migrateAll();
    if (params[0]) {
      renderDetail(root, header, params[0]);
    } else {
      renderList(root, header);
    }
  }

  // Makes a whole row open its routine. Used here and by Soon / Upcoming,
  // which show routine occurrences too. Taps on the row's own check or
  // delete buttons are left alone.
  function linkRow(row, routineId) {
    row.classList.add("item-row-tappable");
    row.addEventListener("click", (event) => {
      if (event.target.closest(".item-check, .item-row-delete")) return;
      OrbitRouter.navigate(`/routines/${routineId}`);
    });
  }

  // --- List ----------------------------------------------------------------------

  function renderList(root, header) {
    OrbitUI.renderModuleHeader(header, "Routines", OrbitRoutinesForm.open);

    const routines = OrbitItems.getRoutines();
    const list = document.createElement("div");
    list.className = "item-list";

    if (routines.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("No routines yet."));
    } else {
      routines.forEach((routine) => {
        if (!OrbitRecurrence.isValidRule(routine.rule)) return; // can't be shown safely
        const paused = Boolean(routine.paused);

        const row = OrbitUI.buildItemRow({
          name: routine.name,
          subtext: OrbitRecurrence.describeShort(routine.rule),
          // Ticking completes the pending occurrence; a paused routine has none.
          onToggle: paused
            ? undefined
            : () => {
                OrbitRoutines.complete(routine.id, routine.k);
                OrbitRouter.renderCurrent();
              },
          onDelete: () => {
            if (confirmDelete(routine)) OrbitRouter.renderCurrent();
          },
        });
        if (paused) row.classList.add("is-paused");

        const next = nextText(routine);
        const nextEl = document.createElement("p");
        nextEl.className = `item-row-subtext routine-next ${next.cls}`;
        nextEl.textContent = next.text;
        row.querySelector(".item-row-main").appendChild(nextEl);

        linkRow(row, routine.id);
        list.appendChild(row);
      });
    }

    root.appendChild(list);
  }

  function confirmDelete(routine) {
    if (!window.confirm(`Delete "${routine.name}" and its history?`)) return false;
    OrbitItems.remove(routine.id);
    return true;
  }

  // --- One routine ---------------------------------------------------------------------

  function renderDetail(root, header, routineId) {
    const routine = OrbitRoutines.ensure(OrbitItems.get(routineId));
    if (!routine || !OrbitRecurrence.isValidRule(routine.rule)) {
      OrbitUI.renderModuleHeader(header, "Routines", null);
      pointBackToList(header);
      root.appendChild(OrbitUI.buildEmptyHint("This routine no longer exists."));
      return;
    }

    OrbitUI.renderModuleHeader(header, routine.name, null);
    pointBackToList(header);

    const tz = routine.rule.tz;
    const paused = Boolean(routine.paused);
    const wrap = document.createElement("div");
    wrap.className = "routine-detail";

    // -- Status card --
    const card = document.createElement("div");
    card.className = "routine-card";

    const cadence = document.createElement("p");
    cadence.className = "routine-cadence";
    cadence.textContent = OrbitRecurrence.describeShort(routine.rule);
    card.appendChild(cadence);

    if (routine.description) {
      const desc = document.createElement("p");
      desc.className = "routine-description";
      desc.textContent = routine.description;
      card.appendChild(desc);
    }

    const next = nextText(routine);
    const nextEl = document.createElement("p");
    nextEl.className = `routine-next-line ${next.cls}`;
    nextEl.textContent = next.text;
    card.appendChild(nextEl);

    if (OrbitRoutines.isSnoozed(routine)) {
      const note = document.createElement("p");
      note.className = "routine-note";
      note.textContent = `Rescheduled from ${OrbitRecurrence.formatMoment(routine.scheduledAt, tz)}`;
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "link-btn";
      reset.textContent = "Use original time";
      reset.addEventListener("click", () => {
        OrbitRoutines.resetSchedule(routine.id, routine.k);
        OrbitRouter.renderCurrent();
      });
      note.appendChild(reset);
      card.appendChild(note);
    }

    // -- Done / Skip / Snooze --
    if (!paused) {
      const actions = document.createElement("div");
      actions.className = "routine-actions";
      const panel = buildSnoozePanel(routine);

      actions.appendChild(
        makeButton("Done", "btn btn-primary", () => {
          OrbitRoutines.complete(routine.id, routine.k);
          OrbitRouter.renderCurrent();
        })
      );
      actions.appendChild(
        makeButton("Skip", "btn btn-secondary", () => {
          OrbitRoutines.skip(routine.id, routine.k);
          OrbitRouter.renderCurrent();
        })
      );
      actions.appendChild(
        makeButton("Snooze", "btn btn-secondary", () => {
          panel.hidden = !panel.hidden;
        })
      );
      card.appendChild(actions);
      card.appendChild(panel);
    }

    // -- Pause / Resume / Delete --
    const manage = document.createElement("div");
    manage.className = "routine-actions";
    manage.appendChild(
      makeButton(paused ? "Resume" : "Pause", paused ? "btn btn-primary" : "btn btn-secondary", () => {
        if (paused) OrbitRoutines.resume(routine.id);
        else OrbitRoutines.pause(routine.id);
        OrbitRouter.renderCurrent();
      })
    );
    manage.appendChild(
      makeButton("Delete", "btn btn-danger-text", () => {
        if (confirmDelete(routine)) OrbitRouter.navigate("/routines");
      })
    );
    card.appendChild(manage);
    wrap.appendChild(card);

    // -- Summary --
    const summary = document.createElement("div");
    summary.className = "routine-summary";
    summary.appendChild(
      summaryLine(
        "Last completed",
        routine.lastCompletedAt ? formatStamp(routine.lastCompletedAt, tz) : "Not yet"
      )
    );
    summary.appendChild(
      summaryLine("Next due", paused ? "Paused" : formatStamp(routine.dueAt, tz))
    );
    wrap.appendChild(summary);

    // -- History --
    const title = document.createElement("p");
    title.className = "history-title";
    title.textContent = "History";
    wrap.appendChild(title);
    wrap.appendChild(buildHistory(routine));

    root.appendChild(wrap);
  }

  // The header's back arrow normally returns Home; from a routine it
  // should return to the Routines list.
  function pointBackToList(header) {
    const back = header.querySelector(".header-back");
    if (!back) return;
    const fresh = back.cloneNode(true);
    back.replaceWith(fresh);
    fresh.addEventListener("click", () => OrbitRouter.navigate("/routines"));
  }

  function makeButton(label, className, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function summaryLine(label, value) {
    const p = document.createElement("p");
    const l = document.createElement("span");
    l.className = "label";
    l.textContent = `${label}: `;
    p.appendChild(l);
    p.appendChild(document.createTextNode(value));
    return p;
  }

  // --- Snooze (inline, no modal) -----------------------------------------------------------

  function buildSnoozePanel(routine) {
    const R = OrbitRecurrence;
    const tz = routine.rule.tz;

    const panel = document.createElement("div");
    panel.className = "snooze-panel";
    panel.hidden = true;

    const error = document.createElement("p");
    error.className = "form-error";
    error.hidden = true;

    function showResult(result) {
      if (result.ok) {
        OrbitUI.showToast(`Snoozed until ${R.formatMoment(result.item.dueAt, tz)}`);
        OrbitRouter.renderCurrent();
        return;
      }
      if (result.reason === "after-next") {
        const nextOccurrence = R.formatMoment(R.scheduledAt(routine.rule, routine.k + 1), tz);
        error.textContent = `Choose a time before the next occurrence (${nextOccurrence}). To drop this one, use Skip.`;
      } else {
        error.textContent = SNOOZE_REASONS[result.reason] || "Couldn't reschedule.";
      }
      error.hidden = false;
    }

    const presets = document.createElement("div");
    presets.className = "preset-row";
    [
      ["30 min", 30],
      ["1 hour", 60],
    ].forEach(([label, minutes]) => {
      const btn = makeButton(label, "preset-btn", () =>
        showResult(OrbitRoutines.snoozeBy(routine.id, minutes, routine.k))
      );
      presets.appendChild(btn);
    });

    // Custom date + time
    const custom = document.createElement("div");
    custom.className = "snooze-custom";
    custom.hidden = true;

    const defaultMoment = R.localParts(Math.max(routine.dueAt, Date.now()) + 60 * 60000, tz);
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = R.formatDateStr(defaultMoment);
    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.value = `${pad(defaultMoment.hh)}:${pad(defaultMoment.mm)}`;

    const fields = document.createElement("div");
    fields.className = "field-row";
    fields.appendChild(OrbitUI.buildField("Date", dateInput));
    fields.appendChild(OrbitUI.buildField("Time", timeInput));

    const setBtn = makeButton("Reschedule", "btn btn-primary", () => {
      if (!dateInput.value || !timeInput.value) {
        error.textContent = "Choose a date and time.";
        error.hidden = false;
        return;
      }
      const d = R.parseDate(dateInput.value);
      const [hh, mm] = timeInput.value.split(":").map(Number);
      const target = R.zonedToUtc({ y: d.y, m: d.m, d: d.d, hh, mm }, tz);
      showResult(OrbitRoutines.rescheduleTo(routine.id, target, routine.k));
    });

    custom.appendChild(fields);
    custom.appendChild(setBtn);

    presets.appendChild(
      makeButton("Custom", "preset-btn", () => {
        custom.hidden = !custom.hidden;
      })
    );

    panel.appendChild(presets);
    panel.appendChild(custom);
    panel.appendChild(error);
    return panel;
  }

  // --- History ---------------------------------------------------------------------------------

  function buildHistory(routine) {
    const tz = routine.rule.tz;
    const list = document.createElement("div");
    list.className = "history-list";

    function addRow(dateText, statusText, statusClass) {
      const row = document.createElement("div");
      row.className = "history-row";
      const date = document.createElement("span");
      date.textContent = dateText;
      const status = document.createElement("span");
      status.className = `history-status ${statusClass}`;
      status.textContent = statusText;
      row.appendChild(date);
      row.appendChild(status);
      list.appendChild(row);
    }

    // The occurrence waiting right now, so overdue / pending is visible
    // alongside what's already been done.
    if (!routine.paused) {
      const state = OrbitRoutines.getState(routine);
      addRow(
        formatDayLabel(routine.scheduledAt, tz),
        state === "overdue" ? "Overdue" : "Pending",
        state === "overdue" ? "is-overdue" : "is-pending"
      );
    }

    const entries = (routine.history || []).slice().reverse().slice(0, 30);
    entries.forEach((entry) => {
      if (entry.status === "completed") {
        // Show when it was actually done, not just the scheduled day.
        const sameDay =
          formatDayLabel(entry.at, tz) === formatDayLabel(entry.scheduledAt, tz);
        const clock = OrbitRecurrence.localParts(entry.at, tz);
        const when = sameDay ? `${pad(clock.hh)}:${pad(clock.mm)}` : formatStamp(entry.at, tz);
        addRow(formatDayLabel(entry.scheduledAt, tz), `Completed · ${when}`, "is-completed");
      } else {
        addRow(formatDayLabel(entry.scheduledAt, tz), "Skipped", "");
      }
    });

    if (list.children.length === 0) {
      list.appendChild(OrbitUI.buildEmptyHint("No history yet."));
    }
    return list;
  }

  return { render, linkRow };
})();

OrbitRouter.register("routines", OrbitRoutinesModule.render);
