"use strict";

// The date sheet: an in-app bottom sheet for picking a day (the time capsule's "On a date", see
// "Time capsule" in the README). It replaces the native <input type="date">, whose system picker
// ignores the app's design on Android. Built like js/duration-sheet.js and uses its sheet styles.
//
// One <dialog>, built the first time it opens and filled in again on every open (so it follows the
// language). A month at a time: ‹ month and year ›, a row of weekday names starting on Monday, and
// a grid of days. Month and weekday names come from Intl in the current language. Days outside
// [min, max] are dimmed and disabled; the month buttons stop at the months of min and max. Tapping
// a day picks it and closes the sheet.
//
// Keyboard: the days have one tab stop (a roving tabindex). Arrow keys move a day (left / right) or
// a week (up / down), Page Up / Page Down a month, Home / End to the start / end of the week; a move
// past the month's edge shows the next or previous month, and moves stop at min and max (every day
// between them can be picked, so no day in between is ever skipped). Enter or Space picks.
// Closing without a pick (tap outside, ×, Esc, Android Back) changes nothing. Back closes the sheet
// instead of leaving the page because it's a modal <dialog>. Focus moves into the sheet on open
// (the picked day, or the first day that can be picked) and back to the trigger on close.
//
// Dates are "YYYY-MM-DD" strings of local calendar days, compared as text.

const dateSheetState = {
  dialog: null,
  els: null,
  options: null, // the open sheet's { title, min, max, value, trigger, onPick }
  year: 0, // the month on show
  month: 0, // 0-11
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

  body.append(grab, head, nav, weekdays, grid);
  dialog.append(body);
  document.body.append(dialog);

  state.dialog = dialog;
  state.els = { title, close, prev, month, next, weekdays, grid };

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
    if (day && !day.disabled) pickDate(day.dataset.date);
  });
  grid.addEventListener("keydown", onDateSheetKey);

  return dialog;
}

// Opens the sheet. options: { title, min, max ("YYYY-MM-DD"), value ("YYYY-MM-DD" or ""), trigger:
// the button to focus again, onPick(key) }.
function openDateSheet(options) {
  const state = dateSheetState;
  const dialog = dateSheet();
  const { title, close, prev, next, weekdays } = state.els;
  state.options = options;

  title.textContent = options.title;
  close.setAttribute("aria-label", t("dateSheet.close"));
  prev.setAttribute("aria-label", t("dateSheet.prevMonth"));
  next.setAttribute("aria-label", t("dateSheet.nextMonth"));

  // Monday first: 1 January 2024 was a Monday.
  weekdays.textContent = "";
  for (let i = 0; i < 7; i++) {
    const name = document.createElement("span");
    name.textContent = I18N.formatDate(new Date(2024, 0, 1 + i), { weekday: "short" });
    weekdays.append(name);
  }

  // The picked day's month, or the first month a day can be picked in.
  const start = options.value && options.value >= options.min && options.value <= options.max ? options.value : options.min;
  const startDate = dateSheetDate(start);
  state.year = startDate.getFullYear();
  state.month = startDate.getMonth();
  renderDateSheet(start);

  dialog.showModal();
  dialog.scrollTop = 0;
  // preventScroll: on a short (landscape) screen the sheet stays at its top, so the month and the
  // ‹ › buttons show; it scrolls inside if needed.
  const focusDay = state.els.grid.querySelector('.date-day[tabindex="0"]');
  if (focusDay) focusDay.focus({ preventScroll: true });
}

// Draws the month on show. focusKey: the day that gets the tab stop (if it's in this month and can
// be picked); otherwise the picked day, or the first day that can be picked.
function renderDateSheet(focusKey) {
  const state = dateSheetState;
  const { min, max, value } = state.options;
  const { prev, month, next, grid } = state.els;
  const first = new Date(state.year, state.month, 1);

  const label = I18N.formatDate(first, { month: "long", year: "numeric" });
  month.textContent = label.charAt(0).toLocaleUpperCase(I18N.language().intlLocale) + label.slice(1);
  const shown = dateSheetMonthIndex(first);
  prev.setAttribute("aria-disabled", String(shown <= dateSheetMonthIndex(dateSheetDate(min))));
  next.setAttribute("aria-disabled", String(shown >= dateSheetMonthIndex(dateSheetDate(max))));

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
    day.disabled = key < min || key > max;
    day.setAttribute("aria-pressed", String(key === value));
    day.tabIndex = -1;
    grid.append(day);
    buttons.push(day);
  }
  const enabled = buttons.filter((b) => !b.disabled);
  const stop =
    enabled.find((b) => b.dataset.date === focusKey) || enabled.find((b) => b.dataset.date === value) || enabled[0];
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
  if (!target) return; // Enter and Space pick through the button's click
  event.preventDefault();
  const { min, max } = dateSheetState.options;
  let key = dateSheetKey(target);
  if (key < min) key = min;
  if (key > max) key = max;
  focusDateSheetDay(key);
}

// Moves the tab stop and the focus to a day, showing its month first if needed.
function focusDateSheetDay(key) {
  const state = dateSheetState;
  const date = dateSheetDate(key);
  if (date.getFullYear() !== state.year || date.getMonth() !== state.month) {
    state.year = date.getFullYear();
    state.month = date.getMonth();
  }
  renderDateSheet(key);
  const day = state.els.grid.querySelector(`.date-day[data-date="${key}"]`);
  if (day) day.focus();
}

function onDateSheetClose() {
  const state = dateSheetState;
  const trigger = state.options && state.options.trigger;
  state.options = null;
  if (trigger && trigger.isConnected) trigger.focus();
}

function pickDate(key) {
  const state = dateSheetState;
  const { onPick } = state.options;
  state.dialog.close(); // its close handler puts focus back on the trigger
  onPick(key);
}
