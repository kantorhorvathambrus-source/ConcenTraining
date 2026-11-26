"use strict";

// The day and time sheet: an in-app bottom sheet for picking when a time capsule opens (its "On a
// day" mode, see "Time capsule" in the README). It replaces the native date input, whose system
// picker ignores the app's design on Android. Built like js/duration-sheet.js and uses its styles.
//
// One <dialog>, built the first time it opens and filled in again on every open (so it follows the
// language). A month at a time: ‹ month and year ›, a row of weekday names starting on Monday and a
// grid of days (names from Intl in the current language). Under it a Time row (− hours : minutes +,
// 15 minutes per tap, holding repeats, or type any hour 0-23 and minute 0-59), the range hint and
// "Set". Tapping a day selects it (the sheet stays open); "Set" applies the day and time and closes.
//
// Allowed: a whole minute from minMs to maxMs (the caller passes 15 minutes from now to 2 years from
// now). A day without any allowed minute is dimmed and can't be tapped; ‹ › stop at the first and
// last month with an allowed day. Outside the range, or with a field that isn't a whole number in
// its own range, the hint turns red and "Set" stays disabled; what was typed is never changed.
// Selecting a day gives it a default time (today: the next full hour at least minMs away, else the
// next quarter hour, else the first allowed minute; any other day 8:00, moved into the range on the
// last day), unless the time was changed by hand in this sheet (or came with the value it opened
// with): then picking another day keeps that time.
//
// Keyboard: the days have one tab stop (a roving tabindex). Arrow keys move a day or a week, Page Up
// / Page Down a month, Home / End to the start / end of the week; a move past the month's edge shows
// that month, and moves stop at the first and last allowed day. Enter or Space selects a day; Enter
// in a time field is "Set". Closing without "Set" (tap outside, ×, Esc, Android Back) changes
// nothing. Focus moves into the sheet on open (the selected day, or the first allowed one) and back
// to the trigger on close.

const DATE_SHEET_STEP_MIN = 15; // − / + in the Time row
const DATE_SHEET_LAST_STEP = 23 * 60 + 45; // + stops at 23:45, − at 0:00
const DATE_SHEET_DEFAULT_HOUR = 8; // the default time on any day but today
const DATE_SHEET_HOLD_DELAY_MS = 400; // holding − / +: the first repeat (as in the duration sheet)
const DATE_SHEET_HOLD_REPEAT_MS = 70; // and the ones after it

const dateSheetState = {
  dialog: null,
  els: null,
  options: null, // the open sheet's { title, minMs, maxMs, valueMs, trigger, onPick }
  year: 0, // the month on show
  month: 0, // 0-11
  selected: "", // the selected day, "YYYY-MM-DD", or ""
  timeTouched: false, // the time was changed by hand (or came with valueMs): another day keeps it
  holdTimer: 0,
  fromPointer: false, // − / + was pressed with a pointer: its click event doesn't step again
};

function dateSheetKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateSheetDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// A month's number for comparing months: year * 12 + month.
const dateSheetMonthIndex = (date) => date.getFullYear() * 12 + date.getMonth();

// The first and last allowed whole minute (ms) and their days.
function dateSheetLimits() {
  const { minMs, maxMs } = dateSheetState.options;
  const first = Math.ceil(minMs / 60000) * 60000;
  const last = Math.floor(maxMs / 60000) * 60000;
  return { first, last, firstKey: dateSheetKey(new Date(first)), lastKey: dateSheetKey(new Date(last)) };
}

function dateSheet() {
  const state = dateSheetState;
  if (state.dialog) return state.dialog;

  const dialog = document.createElement("dialog");
  dialog.id = "dateSheet";
  dialog.className = "duration-sheet date-sheet"; // the duration sheet's bottom-sheet styles
  dialog.setAttribute("aria-labelledby", "dateSheetTitle");

  // The content has the padding, so a click whose target is the dialog itself is on the backdrop.
  const body = document.createElement("div");
  body.className = "duration-sheet-body";

  const grab = document.createElement("div");
  grab.className = "sheet-grab";
  grab.setAttribute("aria-hidden", "true");

  const head = document.createElement("div");
  head.className = "duration-sheet-head";
  const title = document.createElement("h2");
  title.id = "dateSheetTitle";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-btn duration-sheet-close";
  close.textContent = "×";
  head.append(title, close);

  const nav = document.createElement("div");
  nav.className = "date-nav";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "icon-btn date-nav-btn";
  prev.textContent = "‹";
  const month = document.createElement("p");
  month.id = "dateSheetMonth";
  month.className = "date-month";
  month.setAttribute("aria-live", "polite");
  const next = document.createElement("button");
  next.type = "button";
  next.className = "icon-btn date-nav-btn";
  next.textContent = "›";
  nav.append(prev, month, next);

  // The weekday names are for the eye; each day's button says its full date.
  const weekdays = document.createElement("div");
  weekdays.className = "date-weekdays";
  weekdays.setAttribute("aria-hidden", "true");

  const grid = document.createElement("div");
  grid.className = "date-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-labelledby", "dateSheetMonth");

  // The Time row: label, then − [hours] : [minutes] +.
  const timeRow = document.createElement("div");
  timeRow.className = "time-sheet-row date-time-row";
  const timeLabel = document.createElement("span");
  timeLabel.id = "dateSheetTimeLabel";
  timeLabel.className = "duration-custom-label time-sheet-label";
  const field = document.createElement("div");
  field.className = "duration-custom-field date-time-field";
  field.setAttribute("role", "group");
  field.setAttribute("aria-labelledby", "dateSheetTimeLabel");
  const earlier = document.createElement("button");
  earlier.type = "button";
  earlier.className = "stepper-btn duration-step";
  earlier.textContent = "−";
  const timeInput = (id, maxLength) => {
    const input = document.createElement("input");
    input.id = id;
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.maxLength = maxLength;
    input.setAttribute("enterkeyhint", "done");
    input.setAttribute("aria-describedby", "dateSheetHint");
    return input;
  };
  const hours = timeInput("dateSheetHours", 2);
  const colon = document.createElement("span");
  colon.className = "date-time-colon";
  colon.setAttribute("aria-hidden", "true");
  colon.textContent = ":";
  const minutes = timeInput("dateSheetMinutes", 2);
  const later = document.createElement("button");
  later.type = "button";
  later.className = "stepper-btn duration-step";
  later.textContent = "+";
  field.append(earlier, hours, colon, minutes, later);
  timeRow.append(timeLabel, field);

  const hint = document.createElement("p");
  hint.id = "dateSheetHint";
  hint.className = "duration-hint muted";

  const set = document.createElement("button");
  set.type = "button";
  set.className = "btn primary wide duration-set date-sheet-set";

  body.append(grab, head, nav, weekdays, grid, timeRow, hint, set);
  dialog.append(body);
  document.body.append(dialog);

  state.dialog = dialog;
  state.els = { title, close, prev, month, next, weekdays, grid, timeLabel, earlier, hours, minutes, later, hint, set };

  // A tap on the dimmed page around the sheet closes it. Only when the press started there too.
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (event) => {
    pressedOutside = event.target === dialog;
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && pressedOutside) dialog.close();
    pressedOutside = false;
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", onDateSheetClose);

  // aria-disabled (not disabled) at the limits, so a focused month button keeps the focus.
  prev.addEventListener("click", () => {
    if (prev.getAttribute("aria-disabled") !== "true") showDateSheetMonth(-1);
  });
  next.addEventListener("click", () => {
    if (next.getAttribute("aria-disabled") !== "true") showDateSheetMonth(1);
  });

  // A tap on a dimmed day does nothing, and the focus stays where it was (in the grid), so the
  // arrow keys keep working.
  grid.addEventListener("pointerdown", (event) => {
    const day = event.target.closest(".date-day");
    if (!day || day.disabled) event.preventDefault();
  });
  grid.addEventListener("click", (event) => {
    const day = event.target.closest(".date-day");
    if (day && !day.disabled) selectDateSheetDay(day.dataset.date);
  });
  grid.addEventListener("keydown", onDateSheetKey);

  for (const input of [hours, minutes]) {
    input.addEventListener("input", () => {
      state.timeTouched = true;
      syncDateSheet();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      applyDateSheet();
    });
    // Keeps the field and "Set" in view when the on-screen keyboard opens.
    input.addEventListener("focus", () => setTimeout(keepDateSheetInView, 300));
  }
  for (const [button, by] of [[earlier, -1], [later, 1]]) {
    // A press steps once at once and repeats while held. preventDefault keeps focus (and the
    // on-screen keyboard) where it is and stops a long press from selecting text.
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      state.fromPointer = true;
      startDateSheetHold(by);
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
      button.addEventListener(type, stopDateSheetHold);
    }
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    // Keyboards and screen readers only send a click.
    button.addEventListener("click", () => {
      if (state.fromPointer) return;
      stepDateSheetTime(by);
    });
  }
  set.addEventListener("click", applyDateSheet);

  return dialog;
}

// Opens the sheet. options: { title, minMs, maxMs, valueMs (ms or null), trigger: the button to
// focus again, onPick(ms) }.
function openDateSheet(options) {
  const state = dateSheetState;
  const dialog = dateSheet();
  const { title, close, prev, next, weekdays, timeLabel, earlier, later, hours, minutes, hint, set } = state.els;
  state.options = options;

  title.textContent = options.title;
  close.setAttribute("aria-label", t("dateSheet.close"));
  prev.setAttribute("aria-label", t("dateSheet.prevMonth"));
  next.setAttribute("aria-label", t("dateSheet.nextMonth"));
  timeLabel.textContent = t("dateSheet.time");
  hours.setAttribute("aria-label", t("dateSheet.hour"));
  minutes.setAttribute("aria-label", t("dateSheet.minute"));
  earlier.setAttribute("aria-label", t("dateSheet.earlier"));
  later.setAttribute("aria-label", t("dateSheet.later"));
  hint.textContent = t("dateSheet.hint");
  set.textContent = t("durationSheet.set");

  // Monday first: 1 January 2024 was a Monday.
  weekdays.textContent = "";
  for (let i = 0; i < 7; i++) {
    const name = document.createElement("span");
    name.textContent = I18N.formatDate(new Date(2024, 0, 1 + i), { weekday: "short" });
    weekdays.append(name);
  }

  // The value it opened with (its day and time, kept when another day is picked), or nothing yet.
  const { firstKey, lastKey } = dateSheetLimits();
  state.selected = "";
  state.timeTouched = false;
  hours.value = "";
  minutes.value = "";
  if (Number.isFinite(options.valueMs)) {
    const value = new Date(options.valueMs);
    const key = dateSheetKey(value);
    if (key >= firstKey && key <= lastKey) {
      state.selected = key;
      state.timeTouched = true;
      hours.value = String(value.getHours());
      minutes.value = String(value.getMinutes()).padStart(2, "0");
    }
  }
  const startDate = dateSheetDate(state.selected || firstKey);
  state.year = startDate.getFullYear();
  state.month = startDate.getMonth();
  renderDateSheet(state.selected || null);
  syncDateSheet();

  dialog.style.removeProperty("--keyboard");
  dialog.showModal();
  dialog.scrollTop = 0;
  // preventScroll: on a short (landscape) screen the sheet stays at its top, so the month and the
  // ‹ › buttons show; it scrolls inside if needed.
  const focusDay = state.els.grid.querySelector('.date-day[tabindex="0"]');
  if (focusDay) focusDay.focus({ preventScroll: true });

  if (window.visualViewport) {
    visualViewport.addEventListener("resize", fitDateSheet);
    visualViewport.addEventListener("scroll", fitDateSheet);
  }
}

// Draws the month on show. focusKey: the day that gets the tab stop (if it's in this month and can
// be picked); otherwise the selected day, or the first day that can be picked.
function renderDateSheet(focusKey) {
  const state = dateSheetState;
  const { prev, month, next, grid } = state.els;
  const { firstKey, lastKey } = dateSheetLimits();
  const first = new Date(state.year, state.month, 1);

  const label = I18N.formatDate(first, { month: "long", year: "numeric" });
  month.textContent = label.charAt(0).toLocaleUpperCase(I18N.language().intlLocale) + label.slice(1);
  const shown = dateSheetMonthIndex(first);
  prev.setAttribute("aria-disabled", String(shown <= dateSheetMonthIndex(dateSheetDate(firstKey))));
  next.setAttribute("aria-disabled", String(shown >= dateSheetMonthIndex(dateSheetDate(lastKey))));

  grid.textContent = "";
  // Empty cells before the 1st, so it's under its weekday (Monday = 0).
  for (let i = 0; i < (first.getDay() + 6) % 7; i++) {
    const gap = document.createElement("span");
    gap.className = "date-gap";
    grid.append(gap);
  }
  const days = new Date(state.year, state.month + 1, 0).getDate();
  const buttons = [];
  for (let d = 1; d <= days; d++) {
    const date = new Date(state.year, state.month, d);
    const key = dateSheetKey(date);
    const day = document.createElement("button");
    day.type = "button";
    day.className = "date-day";
    day.dataset.date = key;
    day.textContent = String(d);
    day.setAttribute("aria-label", I18N.formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    day.disabled = key < firstKey || key > lastKey; // no allowed minute on that day
    day.setAttribute("aria-pressed", String(key === state.selected));
    day.tabIndex = -1;
    grid.append(day);
    buttons.push(day);
  }
  const enabled = buttons.filter((b) => !b.disabled);
  const stop =
    enabled.find((b) => b.dataset.date === focusKey) || enabled.find((b) => b.dataset.date === state.selected) || enabled[0];
  if (stop) stop.tabIndex = 0;
}

// ‹ or ›: the month before or after, the focus staying on the button.
function showDateSheetMonth(by) {
  const state = dateSheetState;
  const date = new Date(state.year, state.month + by, 1);
  state.year = date.getFullYear();
  state.month = date.getMonth();
  renderDateSheet(null);
}

// Selects a day (the sheet stays open). Its default time, unless the time was set by hand.
function selectDateSheetDay(key) {
  const state = dateSheetState;
  state.selected = key;
  if (!state.timeTouched) {
    const minutes = dateSheetDefaultMinutes(key);
    state.els.hours.value = String(Math.floor(minutes / 60));
    state.els.minutes.value = String(minutes % 60).padStart(2, "0");
  }
  for (const day of state.els.grid.querySelectorAll(".date-day")) {
    day.setAttribute("aria-pressed", String(day.dataset.date === key));
    day.tabIndex = day.dataset.date === key ? 0 : -1;
  }
  syncDateSheet();
}

// The default time of a day, in minutes after midnight. Today: the next full hour at least the
// minimum away, else the next quarter hour, else the first allowed minute (late in the evening).
// Any other day: 8:00, moved to the last allowed quarter hour on the last day if 8:00 is too late.
function dateSheetDefaultMinutes(key) {
  const { first, last, firstKey, lastKey } = dateSheetLimits();
  const ofDay = (ms) => {
    const d = new Date(ms);
    return d.getHours() * 60 + d.getMinutes();
  };
  if (key === dateSheetKey(new Date())) {
    // Today can only be selected while it has an allowed minute, so the first one is today.
    const earliest = key === firstKey ? ofDay(first) : 0;
    const hour = Math.ceil(earliest / 60) * 60;
    if (hour < 24 * 60) return hour;
    const quarter = Math.ceil(earliest / DATE_SHEET_STEP_MIN) * DATE_SHEET_STEP_MIN;
    if (quarter < 24 * 60) return quarter;
    return earliest;
  }
  const morning = DATE_SHEET_DEFAULT_HOUR * 60;
  if (key === lastKey && morning > ofDay(last)) return Math.floor(ofDay(last) / DATE_SHEET_STEP_MIN) * DATE_SHEET_STEP_MIN;
  return morning;
}

// A time field's whole number inside its limits, or null.
function dateSheetNumber(input, max) {
  const text = input.value.trim();
  if (!/^\d{1,2}$/.test(text)) return null;
  const n = Number(text);
  return n <= max ? n : null;
}

// The selected day and typed time as ms, or null (no day, or a broken field).
function dateSheetValue() {
  const state = dateSheetState;
  if (!state.selected) return null;
  const h = dateSheetNumber(state.els.hours, 23);
  const m = dateSheetNumber(state.els.minutes, 59);
  if (h === null || m === null) return null;
  const day = dateSheetDate(state.selected);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
}

function dateSheetValid(value = dateSheetValue()) {
  const { minMs, maxMs } = dateSheetState.options;
  return value !== null && value >= minMs && value <= maxMs;
}

// "Set", the hint's colour, the fields' error state and − / + follow the day and the fields. What
// was typed is never changed. Before a day is selected the time fields are disabled.
function syncDateSheet() {
  const state = dateSheetState;
  const { hours, minutes, earlier, later, hint, set } = state.els;
  const daySelected = Boolean(state.selected);
  hours.disabled = !daySelected;
  minutes.disabled = !daySelected;
  const value = dateSheetValue();
  const valid = dateSheetValid(value);
  set.disabled = !valid;
  const showError = daySelected && !valid;
  hint.classList.toggle("error", showError);
  hint.classList.toggle("muted", !showError);
  const h = dateSheetNumber(hours, 23);
  const m = dateSheetNumber(minutes, 59);
  for (const [input, n] of [[hours, h], [minutes, m]]) {
    if (showError && (n === null || value !== null)) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
  const total = h !== null && m !== null ? h * 60 + m : null;
  earlier.setAttribute("aria-disabled", String(!daySelected || (total !== null && total <= 0)));
  later.setAttribute("aria-disabled", String(!daySelected || (total !== null && total >= DATE_SHEET_LAST_STEP)));
}

// − / +: to the previous / next quarter hour (20:07 → 20:00 / 20:15), between 0:00 and 23:45. A
// broken field steps from the day's default time. Returns whether another step could follow.
function stepDateSheetTime(by) {
  const state = dateSheetState;
  if (!state.selected) return false;
  const { hours, minutes } = state.els;
  const h = dateSheetNumber(hours, 23);
  const m = dateSheetNumber(minutes, 59);
  const total = h !== null && m !== null ? h * 60 + m : dateSheetDefaultMinutes(state.selected);
  const stepped =
    by > 0
      ? Math.floor(total / DATE_SHEET_STEP_MIN) * DATE_SHEET_STEP_MIN + DATE_SHEET_STEP_MIN
      : Math.ceil(total / DATE_SHEET_STEP_MIN) * DATE_SHEET_STEP_MIN - DATE_SHEET_STEP_MIN;
  const next = Math.min(DATE_SHEET_LAST_STEP, Math.max(0, stepped));
  if (next === total && h !== null && m !== null) return false;
  hours.value = String(Math.floor(next / 60));
  minutes.value = String(next % 60).padStart(2, "0");
  state.timeTouched = true;
  syncDateSheet();
  return next > 0 && next < DATE_SHEET_LAST_STEP;
}

function startDateSheetHold(by) {
  const state = dateSheetState;
  stopDateSheetHold();
  if (!stepDateSheetTime(by)) return;
  const repeat = () => {
    if (!stepDateSheetTime(by)) return;
    state.holdTimer = setTimeout(repeat, DATE_SHEET_HOLD_REPEAT_MS);
  };
  state.holdTimer = setTimeout(repeat, DATE_SHEET_HOLD_DELAY_MS);
}

function stopDateSheetHold() {
  const state = dateSheetState;
  clearTimeout(state.holdTimer);
  state.holdTimer = 0;
  // The click that follows this press comes right after; later clicks are keyboard ones again.
  if (state.fromPointer) setTimeout(() => (state.fromPointer = false), 350);
}

function onDateSheetKey(event) {
  const day = event.target.closest(".date-day");
  if (!day) return;
  const current = dateSheetDate(day.dataset.date);
  let target = null;
  const move = (days) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + days);
  const weekday = (current.getDay() + 6) % 7;
  if (event.key === "ArrowLeft") target = move(-1);
  else if (event.key === "ArrowRight") target = move(1);
  else if (event.key === "ArrowUp") target = move(-7);
  else if (event.key === "ArrowDown") target = move(7);
  else if (event.key === "Home") target = move(-weekday);
  else if (event.key === "End") target = move(6 - weekday);
  else if (event.key === "PageUp" || event.key === "PageDown") {
    const by = event.key === "PageUp" ? -1 : 1;
    const lastDay = new Date(current.getFullYear(), current.getMonth() + by + 1, 0).getDate();
    target = new Date(current.getFullYear(), current.getMonth() + by, Math.min(current.getDate(), lastDay));
  }
  if (!target) return; // Enter and Space select through the button's click
  event.preventDefault();
  const { firstKey, lastKey } = dateSheetLimits();
  let key = dateSheetKey(target);
  if (key < firstKey) key = firstKey;
  if (key > lastKey) key = lastKey;
  focusDateSheetDay(key);
}

// Moves the tab stop and the focus to a day, showing its month first if needed.
function focusDateSheetDay(key) {
  const state = dateSheetState;
  const date = dateSheetDate(key);
  state.year = date.getFullYear();
  state.month = date.getMonth();
  renderDateSheet(key);
  const day = state.els.grid.querySelector(`.date-day[data-date="${key}"]`);
  if (day) day.focus();
}

function applyDateSheet() {
  const state = dateSheetState;
  const value = dateSheetValue();
  if (!dateSheetValid(value)) {
    syncDateSheet();
    return;
  }
  const { onPick } = state.options;
  state.dialog.close(); // its close handler puts focus back on the trigger
  onPick(value);
}

function onDateSheetClose() {
  const state = dateSheetState;
  stopDateSheetHold();
  state.fromPointer = false;
  if (window.visualViewport) {
    visualViewport.removeEventListener("resize", fitDateSheet);
    visualViewport.removeEventListener("scroll", fitDateSheet);
  }
  const trigger = state.options && state.options.trigger;
  state.options = null;
  if (trigger && trigger.isConnected) trigger.focus();
}

// With the on-screen keyboard open, the sheet sits on top of it and gets shorter (--keyboard is
// the keyboard's height). Browsers that shrink the page for the keyboard give 0 here.
function fitDateSheet() {
  const dialog = dateSheetState.dialog;
  if (!dialog || !dialog.open || !window.visualViewport) return;
  const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
  const covered = Math.max(0, Math.round(layoutHeight - (visualViewport.offsetTop + visualViewport.height)));
  dialog.style.setProperty("--keyboard", `${covered}px`);
  keepDateSheetInView();
}

// The focused time field and "Set" stay visible above the on-screen keyboard.
function keepDateSheetInView() {
  const state = dateSheetState;
  if (!state.dialog || !state.dialog.open) return;
  const focused = document.activeElement;
  if (!focused || !state.dialog.contains(focused) || focused.tagName !== "INPUT") return;
  const sheet = state.dialog.getBoundingClientRect();
  const top = focused.getBoundingClientRect().top;
  const bottom = state.els.set.getBoundingClientRect().bottom;
  if (bottom > sheet.bottom) state.dialog.scrollTop += Math.min(bottom - sheet.bottom, top - sheet.top);
  else if (top < sheet.top) state.dialog.scrollTop -= sheet.top - top;
}
