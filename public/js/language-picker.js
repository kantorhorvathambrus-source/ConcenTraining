"use strict";

// The language button and its bottom sheet, on the setup screen (index.html) and the history page.
// The button is in the page's header (its code "EN" / "HU" and its label are translated like the rest
// of the page). The sheet is a <dialog>, built the first time it opens: focus moves into it, Esc and
// Android Back close it, and screen readers treat it like the app's other dialogs. Its rows come from
// js/i18n/languages.js in sortLanguages' order. Tapping a row switches the language at once
// (I18N.setLanguage, the only place the choice is saved), closes the sheet and puts focus back on
// the button. See "Languages" in the README.

// Where "Report a translation issue" writes to. The subject stays English ("Translation issue (hu)"),
// so the reports can be filtered.
const TRANSLATION_REPORT_EMAIL = "concentrainer@gmail.com";

const SVG_NS = "http://www.w3.org/2000/svg";

function checkIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "language-check");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M5 12.5l4.5 4.5L19 7.5");
  svg.append(path);
  return svg;
}

function languageSheet() {
  let dialog = document.getElementById("languageSheet");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "languageSheet";
  dialog.className = "language-sheet";
  dialog.setAttribute("aria-labelledby", "languageSheetTitle");
  const grab = document.createElement("div");
  grab.className = "sheet-grab";
  grab.setAttribute("aria-hidden", "true");
  const title = document.createElement("h2");
  title.id = "languageSheetTitle";
  const list = document.createElement("ul");
  list.className = "language-list";
  const report = document.createElement("p");
  report.className = "language-report";
  const link = document.createElement("a");
  link.className = "footer-link";
  report.append(link);
  dialog.append(grab, title, list, report);
  // A tap on the dimmed page around the sheet closes it, like Esc.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => document.getElementById("languageButton").focus());
  document.body.append(dialog);
  return dialog;
}

// One row per language: the native name (bold, in its own language for screen readers and fonts),
// the English name under it (not for English), BETA for unreviewed ones, and a check on the current one.
function renderLanguageSheet(dialog) {
  const current = I18N.current();
  dialog.querySelector("#languageSheetTitle").textContent = t("language.title");
  const list = dialog.querySelector(".language-list");
  list.innerHTML = "";
  for (const language of sortLanguages(LANGUAGES)) {
    const item = document.createElement("li");
    const row = document.createElement("button");
    row.type = "button";
    row.className = "language-row";
    row.dataset.code = language.code;
    if (language.code === current) row.setAttribute("aria-current", "true");
    const names = document.createElement("span");
    names.className = "language-names";
    const native = document.createElement("span");
    native.className = "language-native";
    native.lang = language.code;
    native.textContent = language.nativeName;
    names.append(native);
    if (language.code !== SOURCE_LANGUAGE) {
      const english = document.createElement("span");
      english.className = "language-english";
      english.lang = SOURCE_LANGUAGE;
      english.textContent = language.englishName;
      names.append(english);
    }
    row.append(names);
    if (language.beta) {
      const beta = document.createElement("span");
      beta.className = "language-beta";
      beta.lang = SOURCE_LANGUAGE;
      beta.textContent = "BETA"; // never translated
      row.append(beta);
    }
    if (language.code === current) row.append(checkIcon());
    row.addEventListener("click", () => pickLanguage(dialog, language.code));
    item.append(row);
    list.append(item);
  }
  const link = dialog.querySelector(".language-report a");
  link.textContent = t("language.report");
  link.href = `mailto:${TRANSLATION_REPORT_EMAIL}?subject=${encodeURIComponent(`Translation issue (${current})`)}`;
}

function openLanguageSheet() {
  const dialog = languageSheet();
  renderLanguageSheet(dialog);
  dialog.showModal();
  const currentRow = dialog.querySelector('.language-row[aria-current="true"]');
  if (currentRow) currentRow.focus();
}

// Also for the language already shown: picking it saves it, so the app stops following the
// browser's language. If the file can't load (offline and not saved yet), nothing changes.
async function pickLanguage(dialog, code) {
  await I18N.setLanguage(code);
  dialog.close(); // its close handler puts focus back on the button
}

function initLanguagePicker() {
  const button = document.getElementById("languageButton");
  if (button) button.addEventListener("click", openLanguageSheet);
}
