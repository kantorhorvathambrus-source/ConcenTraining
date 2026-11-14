// Exports every text of the app into Markdown tables for review: docs/texts/en.md (the English
// source, plus the text of privacy.html) and docs/texts/<code>.md for every other language
// (key | English | that language).
//
//   node tools/export-texts.mjs
//
// No dependencies and no build step: plain Node (18 or newer). The generated files are committed;
// run this again after any text change and commit the result with it. See "Exporting the texts
// for review" in the README.
//
// How it reads the texts: it runs the app's own files (js/i18n/languages.js, en.js, i18n.js, the
// data files and every language file) inside Node's "vm" module, an isolated box that runs
// JavaScript without a browser, with a few empty stand-ins for the browser's objects. So it sees
// exactly the texts the app shows: there is no second copy of them in this tool.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "docs", "texts");

// The data files that hand their English to the translation system (I18N.localize / I18N.source),
// in the order the pages load them.
const DATA_FILES = [
  "js/data/characters.js",
  "js/data/messages.js",
  "js/avatar-parts.js",
  "js/avatar-costumes.js",
  "js/custom-characters.js",
  "js/history-store.js",
];

// ---------- loading the app's texts ----------

function loadTexts() {
  const nothing = () => {};
  // Stand-ins for what the files touch while they load. Nothing is drawn or saved.
  const sandbox = {
    console,
    Intl,
    URLSearchParams,
    navigator: { languages: ["en"], language: "en" },
    localStorage: { getItem: () => null, setItem: nothing, removeItem: nothing },
    location: { hostname: "export-texts", search: "" },
    document: { documentElement: {}, readyState: "complete", addEventListener: nothing, write: nothing },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  const run = (file) => vm.runInContext(fs.readFileSync(path.join(PUBLIC, file), "utf8"), context, { filename: file });

  run("js/i18n/languages.js");
  run("js/i18n/en.js");
  run("js/i18n.js");
  for (const file of DATA_FILES) run(file);
  const languages = vm.runInContext("LANGUAGES", context);
  for (const language of languages) {
    if (language.code !== "en") run(language.file);
  }
  return {
    languages,
    texts: vm.runInContext("I18N_TEXTS", context),
    motivation: vm.runInContext("MOTIVATION", context),
  };
}

// Each motivation's phase and type from the data, and its "// source:" comment from the file.
function motivationNotes(motivation) {
  const notes = new Map();
  for (const [phase, messages] of Object.entries(motivation)) {
    for (const message of messages) notes.set(`motivation.${message.id}`, { phase, type: message.type, source: "" });
  }
  const file = fs.readFileSync(path.join(PUBLIC, "js/data/messages.js"), "utf8");
  for (const match of file.matchAll(/\/\/ source: (.+)\r?\n\s*\{ id: "([\w-]+)"/g)) {
    const note = notes.get(`motivation.${match[2]}`);
    if (note) note.source = match[1].trim();
  }
  return notes;
}

// ---------- where each text appears ----------

// The sections of every file, in this order. A section without texts is left out.
const SECTIONS = [
  ["shared", "Shared words, modes and lengths of time"],
  ["buttons", "Language and dark mode buttons"],
  ["setup", "Setup screen"],
  ["characters", "Characters and their groups"],
  ["poses", "Pose descriptions (screen readers only)"],
  ["session", "Session screen"],
  ["motivation-general", "Motivations: start of a long session (0–10 min)"],
  ["motivation-hardest", "Motivations: the hardest part (10–20 min)"],
  ["motivation-middle", "Motivations: the middle of a long session"],
  ["motivation-final", "Motivations: the last part of any session"],
  ["motivation-short", "Motivations: short sessions"],
  ["dialogs", "Dialogs"],
  ["summary", "Summary"],
  ["history", "History page"],
  ["import", "Export and import messages"],
  ["editor", "Character editor"],
  ["editor-base", "Editor options: base (gender, skin, hair, face)"],
  ["editor-clothes", "Editor options: clothes"],
  ["editor-accessories", "Editor options: accessories"],
  ["costumes", "Costumes"],
  ["other", "Other texts (no section yet: add a rule to sectionOf in tools/export-texts.mjs)"],
];

const BASE_FIELDS = ["gender", "skin", "hairColor", "hairStyle", "headShape", "nose", "mark", "funny"];
const CLOTHES_FIELDS = ["outfit"];
const ACCESSORY_FIELDS = ["eyewear", "earrings", "necklace", "facialHair"];
const COSTUME_FIELDS = ["theme", "preset", "presetDescription", "headwear", "mask", "earsHorns", "costumeBeard", "costumeOutfit", "back", "held", "pet"];
const EDITOR_MESSAGES = ["custom.nameMissing", "custom.nameTooLong", "custom.nameTaken", "custom.saveFailed", "custom.deletedElsewhere"];

// The section of a key. The more specific rules come first.
function sectionOf(key, notes) {
  const [area, second] = key.split(".");
  if (notes.has(key)) return `motivation-${notes.get(key).phase}`;
  if (["common", "mode", "time"].includes(area)) return "shared";
  if (["language", "darkMode"].includes(area)) return "buttons";
  if (area === "storage") return { setupNote: "setup", sessionNote: "session", historyNote: "history" }[second] || "other";
  if (EDITOR_MESSAGES.includes(key)) return "editor";
  if (["setup", "quickStart", "how", "tip", "duration", "custom"].includes(area)) return "setup";
  if (key === "group.ragebait.warning") return "dialogs";
  if (area === "group") return "characters";
  if (area === "pose" || key === "character.poseAlt") return "poses";
  if (area === "character") {
    if (["editLabel", "deleteLabel"].includes(second)) return "setup";
    if (key.split(".").length === 2) return "dialogs"; // the delete and ragebait dialogs
    return "characters"; // character.<id>.name / .tagline
  }
  if (["session", "distraction", "category", "announce", "motivation", "notification"].includes(area)) return "session";
  if (["restart", "end", "away", "late", "elsewhere"].includes(area)) return "dialogs";
  if (["summary", "pauses"].includes(area)) return "summary";
  if (["history", "dayPart"].includes(area)) return "history";
  if (area === "import") return "import";
  if (area === "avatar") {
    if (BASE_FIELDS.includes(second)) return "editor-base";
    if (CLOTHES_FIELDS.includes(second)) return "editor-clothes";
    if (ACCESSORY_FIELDS.includes(second)) return "editor-accessories";
    if (COSTUME_FIELDS.includes(second)) return "costumes";
    return "editor";
  }
  return "other";
}

// ---------- writing a text into a table cell ----------

const LEGEND = [
  "`·` is a soft hyphen (an invisible point where a long word may break)",
  "`_` is a narrow no-break space",
  "`~` is a no-break space",
  "`␣` is an ordinary space at the very start or end of a text",
  "`{name}` is a placeholder the app fills in",
];

// Invisible characters become visible marks (see LEGEND).
function mark(text) {
  return text
    .replace(/­/g, "·")
    .replace(/ /g, "_")
    .replace(/ /g, "~")
    .replace(/^ +| +$/g, (spaces) => "␣".repeat(spaces.length))
    .replace(/\s+/g, " ");
}

// The text as a code span, so Markdown shows every character as it is. "|" would end the table
// cell, so it's escaped; a text with a backtick gets a longer fence.
function code(text) {
  const shown = mark(text).replace(/\|/g, "\\|");
  const fence = shown.includes("`") ? "``" : "`";
  const pad = shown.startsWith("`") || shown.endsWith("`") ? " " : "";
  return `${fence}${pad}${shown}${pad}${fence}`;
}

// One table cell: a text, or every form of a text with plural forms, one per line.
function cell(value) {
  if (value === undefined) return "*(missing: shows in English)*";
  if (typeof value === "string") return code(value);
  return Object.entries(value)
    .map(([form, text]) => `${form}: ${code(text)}`)
    .join("<br>");
}

function keyCell(key, notes) {
  const note = notes.get(key);
  if (!note) return `\`${key}\``;
  return `\`${key}\`<br>${note.type}${note.source ? ` · source: ${note.source.replace(/\|/g, "\\|")}` : ""}`;
}

// ---------- the privacy page (English only, never translated) ----------

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", larr: "←", rarr: "→", ndash: "–", mdash: "—" };

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, number) => String.fromCodePoint(Number(number)))
    .replace(/&(\w+);/g, (match, name) => ENTITIES[name] ?? match);
}

// Every heading, paragraph and list item of privacy.html's body, in order.
function privacyRows() {
  const html = fs.readFileSync(path.join(PUBLIC, "privacy.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const body = html.slice(html.search(/<body\b/i));
  const rows = [];
  for (const match of body.matchAll(/<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (text) rows.push({ element: match[1].toLowerCase(), text });
  }
  return rows;
}

// ---------- the files ----------

function buildFile(language, { texts, notes, keysBySection }) {
  const isSource = language.code === "en";
  const own = texts[language.code] || {};
  const keys = Object.keys(texts.en);
  const lines = [];

  lines.push(`# ConcenTraining texts: ${language.nativeName} (${language.code})`, "");
  lines.push("Generated by `tools/export-texts.mjs`. Don't edit this file: change the text in");
  lines.push(
    isSource
      ? "`public/js/i18n/en.js` or the data file it comes from, then run `node tools/export-texts.mjs` again."
      : `\`public/js/i18n/${path.basename(language.file)}\`, then run \`node tools/export-texts.mjs\` again.`
  );
  lines.push("");
  const missing = keys.filter((key) => own[key] === undefined).length;
  lines.push(`${keys.length} texts${isSource ? "" : `, ${missing} missing`}${language.beta ? " · beta (not yet reviewed by a native speaker)" : ""}.`, "");
  lines.push("How to read it:", "");
  for (const item of LEGEND) lines.push(`- ${item}`);
  lines.push("- a text with plural forms shows every form (`one`, `few`, `many`, `other`, `zero`), one per line");
  lines.push("- motivations are marked `fact` (with its source) or `boost`", "");

  for (const [id, title] of SECTIONS) {
    const sectionKeys = keysBySection.get(id) || [];
    if (!sectionKeys.length) continue;
    lines.push(`## ${title}`, "");
    lines.push(isSource ? "| Key | English |" : `| Key | English | ${language.nativeName} |`);
    lines.push(isSource ? "|---|---|" : "|---|---|---|");
    for (const key of sectionKeys) {
      const row = [keyCell(key, notes), cell(texts.en[key])];
      if (!isSource) row.push(cell(own[key]));
      lines.push(`| ${row.join(" | ")} |`);
    }
    lines.push("");
  }

  if (isSource) {
    lines.push("## Privacy page (`privacy.html`): English only, never translated", "");
    lines.push("| # | Element | English |", "|---|---|---|");
    privacyRows().forEach((row, i) => lines.push(`| ${i + 1} | ${row.element} | ${code(row.text)} |`));
    lines.push("");
  }
  return lines.join("\n");
}

function main() {
  const { languages, texts, motivation } = loadTexts();
  const notes = motivationNotes(motivation);

  const keysBySection = new Map();
  for (const key of Object.keys(texts.en)) {
    const section = sectionOf(key, notes);
    if (!keysBySection.has(section)) keysBySection.set(section, []);
    keysBySection.get(section).push(key);
  }

  fs.mkdirSync(OUT, { recursive: true });
  for (const language of languages) {
    const file = path.join(OUT, `${language.code}.md`);
    fs.writeFileSync(file, buildFile(language, { texts, notes, keysBySection }));
    console.log(`${path.relative(ROOT, file)}: ${Object.keys(texts.en).length} texts`);
  }

  const unsorted = keysBySection.get("other") || [];
  if (unsorted.length) console.warn(`No section for ${unsorted.length} texts (listed under "Other texts"): ${unsorted.join(", ")}`);
}

main();
