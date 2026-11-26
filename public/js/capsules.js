"use strict";

// Time capsule: a short message to your future self, sealed until a chosen day and time or until you've
// spent a chosen amount of further time in sessions (see "Time capsule" in the README).
// Loaded by history.html (writing, sealed cards, opening) and index.html (the summary line), after
// js/history-store.js. It only relies on history-store.js (loadHistory, sessionFocus, sessionDay)
// and the i18n files (t), never on history.js or app.js, and it touches no DOM when it loads.
// The history page's drawing is in history.js; the summary line in app.js (renderCapsuleNote).
//
// Saved data:
//   ct_capsules_v1 = { v: 1, capsules: [ { id, createdAt, text, opensAt?, opensAfterMs?, readyAt?,
//     announced?, openedAt? } ] }
//   id: "cap-" + 10 random letters/digits. createdAt: Date.now() at Seal. text: the message, trimmed,
//   1 to CAPSULE_TEXT_MAX characters. Exactly one of opensAt (a timestamp in ms: the local day and
//   time picked in the date sheet) or opensAfterMs (session time, see countedSessionMs). Capsules
//   from earlier test builds have opensOn ("YYYY-MM-DD") instead: it's read as opensAt = local
//   midnight of that day, and written as opensAt with the next save. readyAt: Date.now() the first time it was
//   seen ready; from then on it stays ready, even if sessions are deleted. announced: true once the
//   summary said "A time capsule is ready". openedAt: Date.now() at Open (the first one wins).
// Reading never throws: a broken entry is skipped (not the whole list) and unknown fields are
// dropped. Every change reads the saved list fresh, so another tab's change is never lost.
// Not in the history export yet.

const CAPSULES_KEY = "ct_capsules_v1";
const CAPSULE_TEXT_MAX = 500;
// At most this many sealed (not yet opened) messages at a time.
const CAPSULE_SEALED_LIMIT = 3;
// A date capsule opens at the earliest 15 minutes from now, at the latest 2 years from now.
const CAPSULE_MIN_LEAD_MS = 15 * 60 * 1000;
const CAPSULE_MAX_YEARS = 2;
// The chips of "After more session time", in hours.
const CAPSULE_HOURS = [5, 10, 25, 50];
// Test sites only: a "+1 min" chip, so a capsule can be opened after one short session.
const CAPSULE_TEST_MS = 60 * 1000;
// "Custom" (the time sheet, js/time-sheet.js): any whole number of minutes from 15 min to 999 h.
const CAPSULE_CUSTOM_MIN_MS = 15 * 60 * 1000;
const CAPSULE_CUSTOM_MAX_MS = 999 * 60 * 60 * 1000;

// The switch for the whole feature. It is true: time capsules are on in production
// (https://concentraining.com) and on the GitHub Pages backup. Setting it to false turns them off
// there: no Time capsule section, no summary line, and saved capsules are ignored but kept. The test
// sites below keep them on either way.
const CAPSULES_ENABLED = true;

// Netlify's test sites and a local copy always have time capsules on, whatever the switch says:
// Deploy Previews (deploy-preview-80--concentraining.netlify.app), the main branch deploy
// (main--concentraining.netlify.app), localhost and 127.0.0.1. Same rule as PLANS_TEST_SITE.
const CAPSULES_TEST_SITE = (() => {
  try {
    const host = location.hostname;
    return host.startsWith("deploy-preview-") || host.startsWith("main--") || host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
})();

// Whether time capsules are on in this page: every check uses this.
const CAPSULES_ON = CAPSULES_ENABLED || CAPSULES_TEST_SITE;

// ---------- counting session time ----------

// Session time counted towards something (here: "Opens after … more in sessions"; a later "journey"
// counted in session hours must use the same rule): no day counts for more than this.
const COUNTED_MAX_PER_DAY_MS = 4 * 60 * 60 * 1000;

// "YYYY-MM-DD" from a Date's local year, month and day. capsules.js's own copy (history.js has
// dayKey, which index.html doesn't load).
function capsuleDateKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// THE rule for counted session time: the session time (sessionFocus(entry).elapsedMs, so without
// breaks) of every history entry that started at or after sinceMs, with each day (the day a session
// counts on, sessionDay) capped at COUNTED_MAX_PER_DAY_MS. Imported sessions count only if they
// started after sinceMs. Reuse this, don't copy it.
function countedSessionMs(history, sinceMs) {
  const perDay = new Map();
  for (const entry of history) {
    if (!entry || !Number.isFinite(entry.startedAt) || entry.startedAt < sinceMs) continue;
    let ms = 0;
    let day = "";
    try {
      ms = sessionFocus(entry).elapsedMs;
      day = capsuleDateKey(sessionDay(entry));
    } catch {
      continue; // a broken entry counts nothing
    }
    if (!Number.isFinite(ms) || ms <= 0) continue;
    perDay.set(day, (perDay.get(day) || 0) + ms);
  }
  let total = 0;
  for (const ms of perDay.values()) total += Math.min(ms, COUNTED_MAX_PER_DAY_MS);
  return total;
}

// ---------- reading and cleaning ----------

const isCapsuleId = (value) => typeof value === "string" && /^cap-[a-z0-9]{10}$/.test(value);
const isStamp = (value) => Number.isFinite(value) && value >= 0;

// A real calendar date written as "YYYY-MM-DD" (so "2026-02-30" isn't one).
function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// "YYYY-MM-DD" as a Date at local midnight of that day (old opensOn values).
function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// The message as it's saved: trimmed, line breaks kept.
function cleanCapsuleText(text) {
  return typeof text === "string" ? text.trim() : "";
}

function isCapsuleText(text) {
  return text.length > 0 && text.length <= CAPSULE_TEXT_MAX;
}

// One saved capsule with only the known fields, or null if it's broken.
function cleanCapsule(raw) {
  if (!raw || typeof raw !== "object" || !isCapsuleId(raw.id) || !isStamp(raw.createdAt)) return null;
  const text = cleanCapsuleText(raw.text);
  if (!isCapsuleText(text)) return null;
  // opensAt, or (earlier test builds) opensOn read as local midnight of that day. opensAt wins if
  // both are there.
  let opensAt = null;
  if (Object.hasOwn(raw, "opensAt")) {
    if (!(Number.isInteger(raw.opensAt) && raw.opensAt >= 0)) return null;
    opensAt = raw.opensAt;
  } else if (Object.hasOwn(raw, "opensOn")) {
    if (!isDateKey(raw.opensOn)) return null;
    opensAt = dateFromKey(raw.opensOn).getTime();
  }
  const hasDate = opensAt !== null;
  const hasTime = Object.hasOwn(raw, "opensAfterMs");
  if (hasDate === hasTime) return null; // exactly one opening condition
  if (hasTime && !(Number.isInteger(raw.opensAfterMs) && raw.opensAfterMs > 0)) return null;
  return {
    id: raw.id,
    createdAt: raw.createdAt,
    text,
    ...(hasDate ? { opensAt } : { opensAfterMs: raw.opensAfterMs }),
    ...(isStamp(raw.readyAt) && { readyAt: raw.readyAt }),
    ...(raw.announced === true && { announced: true }),
    ...(isStamp(raw.openedAt) && { openedAt: raw.openedAt }),
  };
}

// The saved text, for the history page's "did anything change?" check. null if nothing is saved
// or storage is blocked.
function readCapsulesRaw() {
  try {
    return localStorage.getItem(CAPSULES_KEY);
  } catch {
    return null;
  }
}

// The saved capsules, oldest first, read fresh. A duplicated id keeps the first one.
function loadCapsules() {
  let entries = [];
  try {
    const data = JSON.parse(readCapsulesRaw());
    if (data && Array.isArray(data.capsules)) entries = data.capsules;
  } catch {
    // broken JSON: no capsules
  }
  const seen = new Set();
  const list = [];
  for (const entry of entries) {
    const capsule = cleanCapsule(entry);
    if (!capsule || seen.has(capsule.id)) continue;
    seen.add(capsule.id);
    list.push(capsule);
  }
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

// Returns false if the browser refused to store it (storage full or blocked).
function writeCapsules(list) {
  try {
    localStorage.setItem(CAPSULES_KEY, JSON.stringify({ v: 1, capsules: list.map(cleanCapsule).filter(Boolean) }));
    return true;
  } catch {
    return false;
  }
}

function newCapsuleId(takenIds) {
  const letters = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (;;) {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    const id = "cap-" + Array.from(bytes, (b) => letters[b % letters.length]).join("");
    if (!takenIds.has(id)) return id;
  }
}

// ---------- the rules ----------

const isSealed = (capsule) => !isStamp(capsule.openedAt);

function sealedCount(list) {
  return list.filter(isSealed).length;
}

// The earliest and latest moment (ms) a date capsule can open at: 15 minutes from now to 2 years
// from now (by the calendar, so the same clock time 2 years on).
function capsuleOpenRange(now = new Date()) {
  const max = new Date(now.getTime());
  max.setFullYear(max.getFullYear() + CAPSULE_MAX_YEARS);
  return { min: now.getTime() + CAPSULE_MIN_LEAD_MS, max: max.getTime() };
}

// The "After more session time" choices in ms: the hour chips, plus "+1 min" on test sites.
function capsuleTimeChoices() {
  const choices = CAPSULE_HOURS.map((hours) => hours * 60 * 60 * 1000);
  return CAPSULES_TEST_SITE ? [CAPSULE_TEST_MS, ...choices] : choices;
}

// Whether a new capsule's opening condition is allowed: a moment (opensAt, whole ms) from 15 minutes
// to 2 years from now (capsuleOpenRange), or a session time of whole minutes from CAPSULE_CUSTOM_MIN_MS to
// CAPSULE_CUSTOM_MAX_MS (every hour chip is inside it), or exactly 1 minute on the test sites.
function isValidOpening(opening, now = new Date()) {
  if (!opening) return false;
  if (Object.hasOwn(opening, "opensAt")) {
    const { min, max } = capsuleOpenRange(now);
    return Number.isInteger(opening.opensAt) && opening.opensAt >= min && opening.opensAt <= max;
  }
  const ms = opening.opensAfterMs;
  if (!Number.isInteger(ms) || ms % 60000 !== 0) return false;
  if (CAPSULES_TEST_SITE && ms === CAPSULE_TEST_MS) return true;
  return ms >= CAPSULE_CUSTOM_MIN_MS && ms <= CAPSULE_CUSTOM_MAX_MS;
}

// Session time still needed before a time capsule opens (0 when it's reached). Date capsules: null.
function capsuleMsLeft(capsule, history) {
  if (!Object.hasOwn(capsule, "opensAfterMs")) return null;
  return Math.max(0, capsule.opensAfterMs - countedSessionMs(history, capsule.createdAt));
}

// Ready: seen ready before (readyAt), or its condition is met now: the time is at or after
// opensAt, or the counted session time reached opensAfterMs.
function isCapsuleReady(capsule, history, now = new Date()) {
  if (isStamp(capsule.readyAt)) return true;
  if (Object.hasOwn(capsule, "opensAt")) return now.getTime() >= capsule.opensAt;
  return capsuleMsLeft(capsule, history) === 0;
}

// For the history page's redraw timer: the soonest opensAt still to come among sealed capsules not
// yet seen ready, or null.
function nextCapsuleOpensAt(now = Date.now()) {
  let next = null;
  for (const c of loadCapsules()) {
    if (!isSealed(c) || isStamp(c.readyAt) || !Object.hasOwn(c, "opensAt") || c.opensAt <= now) continue;
    if (next === null || c.opensAt < next) next = c.opensAt;
  }
  return next;
}

// For the history page's "did anything change?" check: how many date capsules have reached their
// opensAt. It changes when one opens with the page hidden (a sleeping phone), so showing the page
// again draws it.
function dueCapsuleCount(now = Date.now()) {
  return loadCapsules().filter((c) => Object.hasOwn(c, "opensAt") && c.opensAt <= now).length;
}

// Reads the capsules fresh, changes them with change(list) (which returns true if it changed
// anything) and writes them back. Returns { list, saved }: saved is true when nothing needed saving.
function changeCapsules(change) {
  const list = loadCapsules();
  if (!change(list)) return { list, saved: true };
  return { list, saved: writeCapsules(list) };
}

// The capsules, with readyAt saved on every one that's ready now for the first time. A failed write
// is silent: the returned list still has readyAt, so readiness is still worked out from the
// condition (and saved on a later visit).
function refreshCapsules(history, now = new Date()) {
  return changeCapsules((list) => {
    let changed = false;
    for (const capsule of list) {
      if (!isStamp(capsule.readyAt) && isCapsuleReady(capsule, history, now)) {
        capsule.readyAt = now.getTime();
        changed = true;
      }
    }
    return changed;
  }).list;
}

// Seal: text (as typed) and opening ({ opensAt } or { opensAfterMs }). Returns { status, capsule }:
// "sealed", "invalid" (empty text or a condition that isn't allowed: nothing saved), "limit"
// (CAPSULE_SEALED_LIMIT already sealed, perhaps in another tab: nothing saved) or "failed" (the
// browser refused to store it: nothing changed).
function sealCapsule(text, opening, now = new Date()) {
  const clean = cleanCapsuleText(text);
  if (!isCapsuleText(clean) || !isValidOpening(opening, now)) return { status: "invalid", capsule: null };
  const list = loadCapsules();
  if (sealedCount(list) >= CAPSULE_SEALED_LIMIT) return { status: "limit", capsule: null };
  const capsule = {
    id: newCapsuleId(new Set(list.map((c) => c.id))),
    createdAt: now.getTime(),
    text: clean,
    ...(Object.hasOwn(opening, "opensAt") ? { opensAt: opening.opensAt } : { opensAfterMs: opening.opensAfterMs }),
  };
  list.push(capsule);
  return { status: writeCapsules(list) ? "sealed" : "failed", capsule };
}

// Open: saves openedAt (and readyAt if it was missing). An openedAt that's already saved (opened in
// another tab) is kept. Returns { status, capsule }: "opened", "missing" (deleted meanwhile) or
// "failed" (the browser refused: nothing changed, the message stays sealed).
function openCapsule(id, now = Date.now()) {
  let found = null;
  const { saved } = changeCapsules((list) => {
    found = list.find((c) => c.id === id) || null;
    if (!found || isStamp(found.openedAt)) return false;
    found.openedAt = now;
    if (!isStamp(found.readyAt)) found.readyAt = now;
    return true;
  });
  if (!found) return { status: "missing", capsule: null };
  return { status: saved ? "opened" : "failed", capsule: found };
}

// Delete: "deleted", "missing" (already gone, e.g. deleted in another tab) or "failed".
function deleteCapsule(id) {
  const list = loadCapsules();
  const kept = list.filter((c) => c.id !== id);
  if (kept.length === list.length) return "missing";
  return writeCapsules(kept) ? "deleted" : "failed";
}

// For the badge on "Your history →" and "See your history" (app.js): how many capsules are ready and
// not opened yet. Read-only: it never saves readyAt or announced, so visiting the history page
// doesn't change it; only Open does. 0 while CAPSULES_ON is false.
function readyUnopenedCount(history = loadHistory(), now = new Date()) {
  if (!CAPSULES_ON) return 0;
  return loadCapsules().filter((c) => isSealed(c) && isCapsuleReady(c, history, now)).length;
}

// For the summary (app.js): true when at least one capsule is ready, unopened and not yet
// announced. Those get announced: true (and readyAt if missing), so the line shows once per
// capsule. A failed write is silent (the line may then show once more next time).
function announceReadyCapsules(now = new Date()) {
  if (!CAPSULES_ON) return false;
  const history = loadHistory();
  let any = false;
  changeCapsules((list) => {
    for (const capsule of list) {
      if (!isSealed(capsule) || capsule.announced || !isCapsuleReady(capsule, history, now)) continue;
      if (!isStamp(capsule.readyAt)) capsule.readyAt = now.getTime();
      capsule.announced = true;
      any = true;
    }
    return any;
  });
  return any;
}

// ---------- the envelope art ----------
// ===== ENVELOPE ART: placeholder, to be replaced by real artwork =====
// Everything the envelope looks like is here and in the "envelope art" block of css/style.css
// (classes .capsule-art*). To use an image instead, return e.g. <img class="capsule-art" src="…"
// alt=""> for each state and replace that CSS block; nothing else depends on the drawing.
// state: "sealed" (waiting), "ready" (can be opened) or "open" (flap up, after Open). Purely
// decorative: aria-hidden, the card's text says what it is. The flap folds open with CSS (the
// .opening class on the card, about 400 ms; none with reduced motion).
function envelopeArt(state) {
  return `<svg class="capsule-art capsule-art-${state}" viewBox="0 0 64 48" aria-hidden="true" focusable="false">
    <rect class="capsule-art-body" x="2" y="8" width="60" height="38" rx="5"/>
    <path class="capsule-art-fold" d="M2 44 L26 26 M62 44 L38 26"/>
    <path class="capsule-art-flap" d="M3 10 L32 32 L61 10 Z"/>
    <circle class="capsule-art-seal" cx="32" cy="30" r="5.5"/>
  </svg>`;
}
// ===== END ENVELOPE ART =====
