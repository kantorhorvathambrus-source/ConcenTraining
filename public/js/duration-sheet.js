"use strict";

// The duration sheet: an in-app bottom sheet for picking a length (a plan row's block length or
// its break, see "Plans" in the README). It replaces the native <select>, whose system list ignores
// the app's design on Android and only offers the presets.
//
// One <dialog>, built the first time it opens and filled in again on every open (so it follows the
// language). On top: the presets as chips in a radio group; tapping one picks it and closes the
// sheet. Below: "Custom" with − / a number field / + (1 minute per tap, holding repeats) and "Set".
// Out-of-range, empty or non-whole input is never changed or applied: the range hint under the
// field turns red and "Set" stays disabled until the value is valid.
//
// Closing without a pick (tap outside, ×, Esc, Android Back) changes nothing. Back closes the sheet
// instead of leaving the page because it's a modal <dialog>, like the language sheet. Focus moves
// into the sheet on open and back to the trigger on close.

const HOLD_DELAY_MS = 400; // holding − / +: the first repeat
const HOLD_REPEAT_MS = 70; // and the ones after it

const durationSheetState = {
  dialog: null,
  els: null,
  options: null, // the open sheet's { title, presets, min, max, value, label, trigger, onPick }
  touched: false, // the field was typed in or stepped: an invalid value shows as an error
  holdTimer: 0,
  holdBy: 0,
  fromPointer: false, // − / + was pressed with a pointer: its click event doesn't step again
};

function durationSheet() {
  const state = durationSheetState;
  if (state.dialog) return state.dialog;

  const dialog = document.createElement("dialog");
  dialog.id = "durationSheet";
  dialog.className = "duration-sheet";
  dialog.setAttribute("aria-labelledby", "durationSheetTitle");

  // The content has the padding, so a click whose target is the dialog itself is on the backdrop.
  const body = document.createElement("div");
  body.className = "duration-sheet-body";

  const grab = document.createElement("div");
  grab.className = "sheet-grab";
  grab.setAttribute("aria-hidden", "true");

  const head = document.createElement("div");
  head.className = "duration-sheet-head";
  const title = document.createElement("h2");
  title.id = "durationSheetTitle";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-btn duration-sheet-close";
  close.textContent = "×";
  head.append(title, close);

  const presets = document.createElement("div");
  presets.className = "duration-presets";
  presets.setAttribute("role", "radiogroup");
  presets.setAttribute("aria-labelledby", "durationSheetTitle");

  const custom = document.createElement("div");
  custom.className = "duration-custom";
  const label = document.createElement("label");
  label.className = "duration-custom-label";
  label.htmlFor = "durationCustomInput";
  const row = document.createElement("div");
  row.className = "duration-custom-row";
  const field = document.createElement("div");
  field.className = "duration-custom-field";
  const less = document.createElement("button");
  less.type = "button";
  less.className = "stepper-btn duration-step";
  less.textContent = "−";
  const input = document.createElement("input");
  input.id = "durationCustomInput";
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.setAttribute("enterkeyhint", "done");
  input.setAttribute("aria-describedby", "durationCustomHint");
  const unit = document.createElement("span");
  unit.className = "duration-custom-unit muted";
  unit.setAttribute("aria-hidden", "true");
  const more = document.createElement("button");
  more.type = "button";
  more.className = "stepper-btn duration-step";
  more.textContent = "+";
  field.append(less, input, unit, more);
  const set = document.createElement("button");
  set.type = "button";
  set.className = "btn primary duration-set";
  row.append(field, set);
  const hint = document.createElement("p");
  hint.id = "durationCustomHint";
  hint.className = "duration-hint muted";
  custom.append(label, row, hint);

  body.append(grab, head, presets, custom);
  dialog.append(body);
  document.body.append(dialog);

  state.dialog = dialog;
  state.els = { title, close, presets, label, less, input, unit, more, set, hint };

  // A tap on the dimmed page around the sheet closes it. Only when the press started there too, so
  // selecting the field's text and letting go outside doesn't close it.
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (event) => {
    pressedOutside = event.target === dialog;
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && pressedOutside) dialog.close();
    pressedOutside = false;
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", onDurationSheetClose);

  // Arrow keys, Home and End move between the presets (a radio group has one tab stop);
  // Enter, Space or a tap picks one.
  presets.addEventListener("keydown", (event) => {
    const chips = Array.from(presets.children);
    const i = chips.indexOf(document.activeElement);
    if (i < 0) return;
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (i + 1) % chips.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (i - 1 + chips.length) % chips.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = chips.length - 1;
    if (next < 0) return;
    event.preventDefault();
    chips.forEach((chip, j) => (chip.tabIndex = j === next ? 0 : -1));
    chips[next].focus();
  });

  input.addEventListener("input", () => {
    state.touched = true;
    syncDurationCustom();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyDurationCustom();
  });
  // Keeps the field and "Set" in view when the on-screen keyboard opens.
  input.addEventListener("focus", () => setTimeout(() => keepDurationCustomInView(), 300));
  set.addEventListener("click", applyDurationCustom);

  for (const [button, by] of [[less, -1], [more, 1]]) {
    // A press steps once at once and repeats while held. preventDefault keeps focus (and the
    // on-screen keyboard) where it is and stops a long press from selecting text.
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      state.fromPointer = true;
      startDurationHold(by);
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
      button.addEventListener(type, stopDurationHold);
    }
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    // Keyboards and screen readers only send a click.
    button.addEventListener("click", () => {
      if (state.fromPointer) return;
      stepDurationCustom(by);
    });
  }

  return dialog;
}

// Opens the sheet. options: { title, presets: [minutes] (0: "No break"), min, max, value,
// label(minutes): a preset's text, trigger: the button to focus again, onPick(minutes) }.
function openDurationSheet(options) {
  const state = durationSheetState;
  const dialog = durationSheet();
  const { title, close, presets, label, less, more, input, unit, set, hint } = state.els;
  state.options = options;
  state.touched = false;

  title.textContent = options.title;
  close.setAttribute("aria-label", t("durationSheet.close"));
  label.textContent = t("durationSheet.custom");
  unit.textContent = t("duration.customAfter");
  less.setAttribute("aria-label", t("durationSheet.less"));
  more.setAttribute("aria-label", t("durationSheet.more"));
  set.textContent = t("durationSheet.set");
  hint.textContent = t("durationSheet.hint", { min: options.min, max: options.max });

  presets.textContent = "";
  const picked = options.presets.includes(options.value);
  options.presets.forEach((minutes, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip duration-preset";
    chip.setAttribute("role", "radio");
    const checked = minutes === options.value;
    chip.setAttribute("aria-checked", String(checked));
    chip.tabIndex = checked || (!picked && i === 0) ? 0 : -1;
    chip.textContent = options.label(minutes);
    chip.addEventListener("click", () => pickDuration(minutes));
    presets.append(chip);
  });

  // A value that isn't a preset (or any value from 1 up) is in the field; "No break" leaves it empty.
  input.value = options.value >= options.min ? String(options.value) : "";
  syncDurationCustom();

  dialog.style.removeProperty("--keyboard");
  dialog.showModal();
  dialog.scrollTop = 0;
  const focusChip = presets.querySelector('[tabindex="0"]');
  if (focusChip) focusChip.focus();

  if (window.visualViewport) {
    visualViewport.addEventListener("resize", fitDurationSheet);
    visualViewport.addEventListener("scroll", fitDurationSheet);
  }
}

function onDurationSheetClose() {
  const state = durationSheetState;
  stopDurationHold();
  state.fromPointer = false;
  if (window.visualViewport) {
    visualViewport.removeEventListener("resize", fitDurationSheet);
    visualViewport.removeEventListener("scroll", fitDurationSheet);
  }
  const trigger = state.options && state.options.trigger;
  state.options = null;
  if (trigger && trigger.isConnected) trigger.focus();
}

function pickDuration(minutes) {
  const state = durationSheetState;
  const { onPick } = state.options;
  state.dialog.close(); // its close handler puts focus back on the trigger
  onPick(minutes);
}

// The field's whole number, or null for anything else (empty, "7.5", "-3", "abc").
function durationCustomNumber() {
  const text = durationSheetState.els.input.value.trim();
  return /^\d{1,4}$/.test(text) ? Number(text) : null;
}

function durationCustomValid(n = durationCustomNumber()) {
  const { min, max } = durationSheetState.options;
  return n !== null && n >= min && n <= max;
}

// "Set", the hint's colour and − / + follow what's in the field. What was typed is never changed.
function syncDurationCustom() {
  const state = durationSheetState;
  const { less, more, input, set, hint } = state.els;
  const { min, max } = state.options;
  const n = durationCustomNumber();
  const valid = durationCustomValid(n);
  set.disabled = !valid;
  const showError = !valid && state.touched;
  hint.classList.toggle("error", showError);
  hint.classList.toggle("muted", !showError);
  if (showError) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  // aria-disabled (not disabled) at the limits, so focus isn't lost.
  less.setAttribute("aria-disabled", String(n !== null && n <= min));
  more.setAttribute("aria-disabled", String(n !== null && n >= max));
}

// One minute less or more, from what's in the field, kept inside the limits. An empty or broken
// field steps from the sheet's current value ("No break": from 0, so + gives 1).
function stepDurationCustom(by) {
  const state = durationSheetState;
  const { min, max, value } = state.options;
  const n = durationCustomNumber();
  const base = n !== null ? n : value;
  const next = Math.min(max, Math.max(min, base + by));
  if (n === next) return false;
  state.els.input.value = String(next);
  state.touched = true;
  syncDurationCustom();
  return next > min && next < max;
}

function startDurationHold(by) {
  const state = durationSheetState;
  stopDurationHold();
  state.holdBy = by;
  if (!stepDurationCustom(by)) return;
  const repeat = () => {
    if (!stepDurationCustom(state.holdBy)) return;
    state.holdTimer = setTimeout(repeat, HOLD_REPEAT_MS);
  };
  state.holdTimer = setTimeout(repeat, HOLD_DELAY_MS);
}

function stopDurationHold() {
  const state = durationSheetState;
  clearTimeout(state.holdTimer);
  state.holdTimer = 0;
  // The click that follows this press comes right after; later clicks are keyboard ones again.
  if (state.fromPointer) setTimeout(() => (state.fromPointer = false), 350);
}

function applyDurationCustom() {
  const n = durationCustomNumber();
  if (!durationCustomValid(n)) {
    durationSheetState.touched = true;
    syncDurationCustom();
    return;
  }
  pickDuration(n);
}

// With the on-screen keyboard open, the sheet sits on top of it and gets shorter (--keyboard is
// the keyboard's height). Browsers that shrink the page for the keyboard give 0 here.
function fitDurationSheet() {
  const dialog = durationSheetState.dialog;
  if (!dialog || !dialog.open || !window.visualViewport) return;
  const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
  const covered = Math.max(0, Math.round(layoutHeight - (visualViewport.offsetTop + visualViewport.height)));
  dialog.style.setProperty("--keyboard", `${covered}px`);
  keepDurationCustomInView();
}

function keepDurationCustomInView() {
  const state = durationSheetState;
  if (!state.dialog || !state.dialog.open || document.activeElement !== state.els.input) return;
  const custom = state.els.input.closest(".duration-custom");
  const sheet = state.dialog.getBoundingClientRect();
  const box = custom.getBoundingClientRect();
  if (box.bottom > sheet.bottom) state.dialog.scrollTop += box.bottom - sheet.bottom;
  else if (box.top < sheet.top) state.dialog.scrollTop -= sheet.top - box.top;
}
