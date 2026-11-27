"use strict";

// The time sheet: an in-app bottom sheet for picking an amount of time in hours and minutes (the
// time capsule's "Custom" chip under "After more session time", see "Time capsule" in the README).
// Built like js/duration-sheet.js and uses its styles; that file isn't changed.
//
// One <dialog>, built the first time it opens and filled in again on every open (so it follows the
// language). Two rows, Hours (0-999) and Minutes (0-59), each with − / a number field / + (one per
// tap, holding repeats), then the range hint and "Set". A total outside [minMs, maxMs], or a field
// that isn't a whole number in its range (also an empty one), is never changed or applied: the hint
// turns red and "Set" stays disabled until it's valid. − / + stop at each field's own limits;
// minutes don't carry over into hours.
//
// Closing without "Set" (tap outside, ×, Esc, Android Back) changes nothing. Back closes the sheet
// instead of leaving the page because it's a modal <dialog>. Focus moves to the hours field on open
// and back to the trigger on close.

const TIME_SHEET_HOLD_DELAY_MS = 400; // holding − / +: the first repeat (as in the duration sheet)
const TIME_SHEET_HOLD_REPEAT_MS = 70; // and the ones after it
const TIME_SHEET_MAX_HOURS = 999;
const TIME_SHEET_MAX_MINUTES = 59;

const timeSheetState = {
  dialog: null,
  els: null,
  options: null, // the open sheet's { title, minMs, maxMs, valueMs, trigger, onPick }
  touched: false, // a field was typed in or stepped: an invalid value shows as an error
  holdTimer: 0,
  fromPointer: false, // − / + was pressed with a pointer: its click event doesn't step again
};

// One row: its label, − / field / +. max: the field's own limit.
function timeSheetRow(id, max) {
  const row = document.createElement("div");
  row.className = "time-sheet-row";
  const label = document.createElement("label");
  label.className = "duration-custom-label time-sheet-label";
  label.htmlFor = id;
  const field = document.createElement("div");
  field.className = "duration-custom-field";
  const less = document.createElement("button");
  less.type = "button";
  less.className = "stepper-btn duration-step";
  less.textContent = "−";
  const input = document.createElement("input");
  input.id = id;
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.maxLength = String(max).length;
  input.setAttribute("enterkeyhint", "done");
  input.setAttribute("aria-describedby", "timeSheetHint");
  const more = document.createElement("button");
  more.type = "button";
  more.className = "stepper-btn duration-step";
  more.textContent = "+";
  field.append(less, input, more);
  row.append(label, field);
  return { row, label, less, input, more, max };
}

function timeSheet() {
  const state = timeSheetState;
  if (state.dialog) return state.dialog;

  const dialog = document.createElement("dialog");
  dialog.id = "timeSheet";
  dialog.className = "duration-sheet time-sheet"; // the duration sheet's bottom-sheet styles
  dialog.setAttribute("aria-labelledby", "timeSheetTitle");

  // The content has the padding, so a click whose target is the dialog itself is on the backdrop.
  const body = document.createElement("div");
  body.className = "duration-sheet-body";

  const grab = document.createElement("div");
  grab.className = "sheet-grab";
  grab.setAttribute("aria-hidden", "true");

  const head = document.createElement("div");
  head.className = "duration-sheet-head";
  const title = document.createElement("h2");
  title.id = "timeSheetTitle";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-btn duration-sheet-close";
  close.textContent = "×";
  head.append(title, close);

  const hours = timeSheetRow("timeSheetHours", TIME_SHEET_MAX_HOURS);
  const minutes = timeSheetRow("timeSheetMinutes", TIME_SHEET_MAX_MINUTES);

  const hint = document.createElement("p");
  hint.id = "timeSheetHint";
  hint.className = "duration-hint muted";

  const set = document.createElement("button");
  set.type = "button";
  set.className = "btn primary wide duration-set time-sheet-set";

  body.append(grab, head, hours.row, minutes.row, hint, set);
  dialog.append(body);
  document.body.append(dialog);

  state.dialog = dialog;
  state.els = { title, close, hours, minutes, hint, set };

  // A tap on the dimmed page around the sheet closes it. Only when the press started there too, so
  // selecting a field's text and letting go outside doesn't close it.
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (event) => {
    pressedOutside = event.target === dialog;
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && pressedOutside) dialog.close();
    pressedOutside = false;
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", onTimeSheetClose);
  set.addEventListener("click", applyTimeSheet);

  for (const part of [hours, minutes]) {
    part.input.addEventListener("input", () => {
      state.touched = true;
      syncTimeSheet();
    });
    part.input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      applyTimeSheet();
    });
    // Keeps the field and "Set" in view when the on-screen keyboard opens.
    part.input.addEventListener("focus", () => setTimeout(keepTimeSheetInView, 300));
    for (const [button, by] of [[part.less, -1], [part.more, 1]]) {
      // A press steps once at once and repeats while held. preventDefault keeps focus (and the
      // on-screen keyboard) where it is and stops a long press from selecting text.
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        state.fromPointer = true;
        startTimeSheetHold(part, by);
      });
      for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
        button.addEventListener(type, stopTimeSheetHold);
      }
      button.addEventListener("contextmenu", (event) => event.preventDefault());
      // Keyboards and screen readers only send a click.
      button.addEventListener("click", () => {
        if (state.fromPointer) return;
        stepTimeSheet(part, by);
      });
    }
  }

  return dialog;
}

// Opens the sheet. options: { title, minMs, maxMs, valueMs (a whole number of minutes), trigger:
// the button to focus again, onPick(ms) }.
function openTimeSheet(options) {
  const state = timeSheetState;
  const dialog = timeSheet();
  const { title, close, hours, minutes, hint, set } = state.els;
  state.options = options;
  state.touched = false;

  title.textContent = options.title;
  close.setAttribute("aria-label", t("durationSheet.close"));
  hours.label.textContent = t("timeSheet.hours");
  minutes.label.textContent = t("timeSheet.minutes");
  hours.less.setAttribute("aria-label", t("timeSheet.hourLess"));
  hours.more.setAttribute("aria-label", t("timeSheet.hourMore"));
  minutes.less.setAttribute("aria-label", t("timeSheet.minuteLess"));
  minutes.more.setAttribute("aria-label", t("timeSheet.minuteMore"));
  set.textContent = t("durationSheet.set");
  hint.textContent = t("timeSheet.hint", { min: timeSheetFormat(options.minMs), max: timeSheetFormat(options.maxMs) });

  const total = Math.round(options.valueMs / 60000);
  hours.input.value = String(Math.floor(total / 60));
  minutes.input.value = String(total % 60);
  syncTimeSheet();

  dialog.style.removeProperty("--keyboard");
  dialog.showModal();
  dialog.scrollTop = 0;
  hours.input.focus({ preventScroll: true });

  if (window.visualViewport) {
    visualViewport.addEventListener("resize", fitTimeSheet);
    visualViewport.addEventListener("scroll", fitTimeSheet);
  }
}

// "15 min", "999 h", "7 h 30 min": the app's own time texts.
function timeSheetFormat(ms) {
  const total = Math.round(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return t("time.min", { minutes: m });
  return m ? t("time.hMin", { hours: h, minutes: m }) : t("time.h", { hours: h });
}

function onTimeSheetClose() {
  const state = timeSheetState;
  stopTimeSheetHold();
  state.fromPointer = false;
  if (window.visualViewport) {
    visualViewport.removeEventListener("resize", fitTimeSheet);
    visualViewport.removeEventListener("scroll", fitTimeSheet);
  }
  const trigger = state.options && state.options.trigger;
  state.options = null;
  if (trigger && trigger.isConnected) trigger.focus();
}

// A field's whole number inside its own limits, or null (empty, "7.5", "-3", "abc", 60 minutes).
function timeSheetNumber(part) {
  const text = part.input.value.trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return n <= part.max ? n : null;
}

// The total in ms, or null if a field isn't valid.
function timeSheetTotal() {
  const { hours, minutes } = timeSheetState.els;
  const h = timeSheetNumber(hours);
  const m = timeSheetNumber(minutes);
  return h === null || m === null ? null : (h * 60 + m) * 60000;
}

function timeSheetValid(total = timeSheetTotal()) {
  const { minMs, maxMs } = timeSheetState.options;
  return total !== null && total >= minMs && total <= maxMs;
}

// "Set", the hint's colour, the fields' error state and − / + follow what's in the fields. What was
// typed is never changed.
function syncTimeSheet() {
  const state = timeSheetState;
  const { hours, minutes, hint, set } = state.els;
  const total = timeSheetTotal();
  const valid = timeSheetValid(total);
  set.disabled = !valid;
  const showError = !valid && state.touched;
  hint.classList.toggle("error", showError);
  hint.classList.toggle("muted", !showError);
  for (const part of [hours, minutes]) {
    const n = timeSheetNumber(part);
    // A field is marked when it's broken itself, or (both) when the total is out of range.
    if (showError && (n === null || total !== null)) part.input.setAttribute("aria-invalid", "true");
    else part.input.removeAttribute("aria-invalid");
    // aria-disabled (not disabled) at the limits, so focus isn't lost.
    part.less.setAttribute("aria-disabled", String(n !== null && n <= 0));
    part.more.setAttribute("aria-disabled", String(n !== null && n >= part.max));
  }
}

// One less or more in a field, kept inside its limits. A broken field steps from the value the
// sheet opened with. Returns whether another step could follow (for holding).
function stepTimeSheet(part, by) {
  const state = timeSheetState;
  const n = timeSheetNumber(part);
  let base = n;
  if (base === null) {
    const total = Math.round(state.options.valueMs / 60000);
    base = part === state.els.hours ? Math.floor(total / 60) : total % 60;
  }
  const next = Math.min(part.max, Math.max(0, base + by));
  if (n === next) return false;
  part.input.value = String(next);
  state.touched = true;
  syncTimeSheet();
  return next > 0 && next < part.max;
}

function startTimeSheetHold(part, by) {
  const state = timeSheetState;
  stopTimeSheetHold();
  if (!stepTimeSheet(part, by)) return;
  const repeat = () => {
    if (!stepTimeSheet(part, by)) return;
    state.holdTimer = setTimeout(repeat, TIME_SHEET_HOLD_REPEAT_MS);
  };
  state.holdTimer = setTimeout(repeat, TIME_SHEET_HOLD_DELAY_MS);
}

function stopTimeSheetHold() {
  const state = timeSheetState;
  clearTimeout(state.holdTimer);
  state.holdTimer = 0;
  // The click that follows this press comes right after; later clicks are keyboard ones again.
  if (state.fromPointer) setTimeout(() => (state.fromPointer = false), 350);
}

function applyTimeSheet() {
  const state = timeSheetState;
  const total = timeSheetTotal();
  if (!timeSheetValid(total)) {
    state.touched = true;
    syncTimeSheet();
    return;
  }
  const { onPick } = state.options;
  state.dialog.close(); // its close handler puts focus back on the trigger
  onPick(total);
}

// With the on-screen keyboard open, the sheet sits on top of it and gets shorter (--keyboard is
// the keyboard's height). Browsers that shrink the page for the keyboard give 0 here.
function fitTimeSheet() {
  const dialog = timeSheetState.dialog;
  if (!dialog || !dialog.open || !window.visualViewport) return;
  const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
  const covered = Math.max(0, Math.round(layoutHeight - (visualViewport.offsetTop + visualViewport.height)));
  dialog.style.setProperty("--keyboard", `${covered}px`);
  keepTimeSheetInView();
}

// The focused field and "Set" stay visible above the on-screen keyboard.
function keepTimeSheetInView() {
  const state = timeSheetState;
  if (!state.dialog || !state.dialog.open) return;
  const focused = document.activeElement;
  if (!focused || !state.dialog.contains(focused) || focused.tagName !== "INPUT") return;
  const sheet = state.dialog.getBoundingClientRect();
  const top = focused.getBoundingClientRect().top;
  const bottom = state.els.set.getBoundingClientRect().bottom;
  if (bottom > sheet.bottom) state.dialog.scrollTop += Math.min(bottom - sheet.bottom, top - sheet.top);
  else if (top < sheet.top) state.dialog.scrollTop -= sheet.top - top;
}
