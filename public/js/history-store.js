// Finished-session history, shared by index.html (saves sessions) and
// history.html (shows, exports and imports them). Stored in localStorage under
// its own key, separate from the running session (ct_session_v1).

const HISTORY_KEY = "ct_history_v1";
// Newest sessions kept (about 1.5 MB with typical sessions; four a day for more than three years).
// A new session over the limit removes the oldest one (saveFinishedSession); an import never
// removes any (mergeIntoHistory).
const HISTORY_LIMIT = 5000;
const HISTORY_MIN_MS = 60 * 1000; // shorter sessions count as accidental starts and aren't saved

// How a finished session went: "short", "early", "great", "okay" or "rough" (see sessionResult).
// A session that ran less than this share of its planned time is "early", whatever the
// focus: ending early isn't judged as good or bad. A full session can never be "early".
const EARLY_END_RATIO = 0.5;
// Advanced mode uses the focus %: great from 85%, okay from 60%, rough below.
const SUMMARY_GREAT_FOCUS = 85;
const SUMMARY_OKAY_FOCUS = 60;
// Simple mode has no focus %, so it uses distraction points instead: each logged
// distraction scores its level (Barely = 1 … Completely = 5), counted per
// 25 minutes. Great up to 2 points per 25 min, rough from 8, okay in between.
const SIMPLE_GREAT_POINTS = 2;
const SIMPLE_ROUGH_POINTS = 8;
const SIMPLE_POINTS_PER_MS = 25 * 60 * 1000; // shorter sessions count as 25 min

// Export file format. Bump EXPORT_VERSION if the session fields ever change.
// Version 2 added a category to each distraction. Version 3 allows the style
// "ragebait". Version 4 allows endedBy "startOver". Version 5 allows the style
// "firm". Version 6 allows distractions logged from the time away card
// (source: "away", with a measured length). Version 7 adds the session's breaks
// (pauses: [{ at, ms }], see "breaks" below). Version 8 adds the device's offset from
// UTC when the session started (utcOffsetMin, see "the day a session counts on" below).
// Version 1-7 files still import.
const EXPORT_APP = "ConcenTraining";
const EXPORT_TYPE = "session-history";
const EXPORT_VERSION = 8;
const IMPORT_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

// How a session can end, and what that says about its times (see saveFinishedSession):
// "timer" ran the full planned time, "manual" was ended early, "startOver" was
// abandoned with Start over after a long distraction (and the user chose to keep
// it). Only these values import. A new endedBy value needs one line here (give it
// null to import it without checking its times), plus a version check in
// cleanImportedSession like the one for "startOver".
const ENDED_BY_RULES = {
  timer: (elapsedMs, plannedMs) => elapsedMs === plannedMs,
  manual: (elapsedMs, plannedMs) => elapsedMs < plannedMs,
  startOver: (elapsedMs, plannedMs) => elapsedMs < plannedMs,
};

// Planned lengths are whole minutes, from 1 to 240 (the same as MAX_MINUTES in app.js and
// PLAN_MAX_MINUTES in plans.js).
const MIN_PLANNED_MS = 60 * 1000;
const MAX_PLANNED_MS = 240 * 60 * 1000;

// Sanity limits for imported sessions (a damaged or hand-edited file). Each is far outside what
// the app can save. No session starts before IMPORT_EARLIEST_START (safely before the app's first
// release), and none ends more than IMPORT_FUTURE_MS after the moment of the import (the day
// allows for a device clock that is a little off). At most IMPORT_MAX_BREAKS breaks.
const IMPORT_EARLIEST_START = Date.UTC(2024, 0, 1);
const IMPORT_FUTURE_MS = 24 * 60 * 60 * 1000;
const IMPORT_MAX_BREAKS = 1000;

// The most distractions a session of this length (session time, without breaks) can hold: 5 per
// second, at least 100. Taps are limited to one per 400 ms (TAP_GUARD_MS in app.js), which is 2.5
// per second, so real sessions always fit. The import rejects more, and the app (addDistraction)
// never logs more, so it can't save a session its own import would reject.
function distractionLimit(elapsedMs) {
  return Math.max(100, Math.floor((elapsedMs * 5) / 1000));
}
// Imported Advanced-mode distractions must be as long as one of its buttons:
// 30 sec (shortest) to 10 min (longest). Simple-mode distractions have no length.
const IMPORT_MIN_DISTRACTION_MS = 30 * 1000;
const IMPORT_MAX_DISTRACTION_MS = 10 * 60 * 1000;
// A tap in the last moment can be timestamped just after the timer ran out.
const IMPORT_LATE_DISTRACTION_MS = 60 * 1000;

// Time away (the card in app.js): an absence this long or longer is asked about, and
// "Yes" logs it with source: "away", at: the moment the page was left, and (Advanced
// mode) ms: the measured time in whole seconds. v6 imports check the length against it.
const AWAY_MIN_MS = 15 * 1000;

// The level (and so the reaction) of a time away distraction, from the lengths of the
// Advanced buttons: a level starts at its button's length. Exactly 10 min is still 4,
// more than 10 min is 5 (like "10+ min", which also asks continue or restart).
// v6 imports check that an away distraction's level matches its length, so changing
// these thresholds later needs a new EXPORT_VERSION (otherwise older v6 exports would
// be rejected).
function awayLevel(ms) {
  if (ms > 10 * 60 * 1000) return 5;
  if (ms >= 5 * 60 * 1000) return 4;
  if (ms >= 2 * 60 * 1000) return 3;
  if (ms >= 60 * 1000) return 2;
  return 1;
}

// What caused a distraction. The id is what's saved; the label is what's shown.
// A distraction without a picked category is saved with category: null.
const DISTRACTION_CATEGORIES = [
  { id: "phone", label: "Screen" }, // phone, other apps or tabs; also set by the time away card
  { id: "thoughts", label: "Thoughts" },
  { id: "noise", label: "Noise" },
  { id: "people", label: "People" },
  { id: "tired", label: "Tired" },
  { id: "other", label: "Other" },
];

// The labels go to the translation system (localize in js/i18n.js) under category.<id>: each one
// gives the current language. Only the id is ever saved.
for (const category of DISTRACTION_CATEGORIES) I18N.localize(category, "label", `category.${category.id}`);

const isCategory = (value) => DISTRACTION_CATEGORIES.some((category) => category.id === value);

// Distractions saved before categories existed have no category field: they get null.
// source is only kept when it's "away" (time away card); a manual tap has no source.
const withCategory = (d) => ({
  at: d.at, level: d.level, ms: d.ms, category: isCategory(d.category) ? d.category : null,
  ...(d.source === "away" && { source: "away" }),
});

// Counts the categories in a list of distractions, most common first (a tie keeps
// the order of DISTRACTION_CATEGORIES). Distractions without a category (null, or
// saved before categories existed) are left out.
function countCategories(distractions) {
  const counts = new Map();
  for (const d of distractions) {
    if (isCategory(d.category)) counts.set(d.category, (counts.get(d.category) || 0) + 1);
  }
  return DISTRACTION_CATEGORIES.filter((category) => counts.has(category.id))
    .map((category) => ({ ...category, count: counts.get(category.id) }))
    .sort((a, b) => b.count - a.count);
}

// ---------- breaks (Stop → Take a break in app.js) ----------

// A break is a chosen pause, not a distraction: the session clock stops, and the break never counts
// as session time (elapsed time, focus %, result, stats). Each one is saved as { at, ms }: when it
// started and how long it lasted. A session without breaks has no pauses field (or an empty one),
// so sessions saved before breaks existed count as never paused.
function pausedTotal(pauses) {
  return Array.isArray(pauses) ? pauses.reduce((sum, p) => sum + p.ms, 0) : 0;
}

// Only the known fields, and no zero-length breaks (Take a break and Resume in the same millisecond).
function cleanPauses(pauses) {
  return Array.isArray(pauses) ? pauses.filter((p) => p && p.ms > 0).map((p) => ({ at: p.at, ms: p.ms })) : [];
}

// "Paused once · 2 min" / "Paused 3 times · 6 min". formatLength formats the total: the summary
// uses its own time format, the history list whole minutes.
function formatPauses(pauses, formatLength) {
  return t("pauses.line", { count: pauses.length, duration: formatLength(pausedTotal(pauses)) });
}

// Time and focus numbers for a finished session. focusPercent is null in Simple
// mode, because its buttons say how much you were distracted, not for how long.
// It's only 100 with no distraction time at all: 99.6% shows as 99, not 100.
// elapsedMs is session time: from start to end, without the breaks.
function sessionFocus(session) {
  const elapsedMs = Math.max(0, session.endedAt - session.startedAt - pausedTotal(session.pauses));
  const loggedMs = session.distractions.reduce((sum, d) => sum + (d.ms || 0), 0);
  const distractedMs = Math.min(elapsedMs, loggedMs);
  const focusPercent = session.mode === "advanced" ? focusPercentOf(elapsedMs, distractedMs) : null;
  return { elapsedMs, distractedMs, focusPercent };
}

// The focus % of some session time with some of it distracted (Advanced mode). Also used for the
// totals of a plan's blocks (app.js).
function focusPercentOf(elapsedMs, distractedMs) {
  const percent = elapsedMs > 0 ? Math.round(((elapsedMs - distractedMs) / elapsedMs) * 100) : 100;
  return distractedMs > 0 ? Math.min(99, percent) : percent;
}

// How a finished session went: "short" (under HISTORY_MIN_MS, so not saved),
// "early" (ended before EARLY_END_RATIO of the planned time), "great", "okay" or
// "rough". Advanced mode uses the focus %, Simple mode the distraction points
// (see the constants at the top). Only the times count, not how it ended, so a
// session cut short by Start over is "early" too.
function sessionResult(session) {
  const { elapsedMs, focusPercent } = sessionFocus(session);
  return resultOf({ mode: session.mode, plannedMs: session.durationMs, elapsedMs, focusPercent, distractions: session.distractions });
}

// The same rules on totals: one session, or all the counted blocks of a plan (app.js), where
// plannedMs is the whole plan's planned focus time and distractions are all of its blocks'.
function resultOf({ mode, plannedMs, elapsedMs, focusPercent, distractions }) {
  if (elapsedMs < HISTORY_MIN_MS) return "short";
  if (elapsedMs < plannedMs * EARLY_END_RATIO) return "early";

  if (mode === "advanced") {
    if (focusPercent >= SUMMARY_GREAT_FOCUS) return "great";
    return focusPercent >= SUMMARY_OKAY_FOCUS ? "okay" : "rough";
  }

  const points = distractions.reduce((sum, d) => sum + d.level, 0);
  const perPeriod = (points * SIMPLE_POINTS_PER_MS) / Math.max(elapsedMs, SIMPLE_POINTS_PER_MS);
  if (perPeriod <= SIMPLE_GREAT_POINTS) return "great";
  return perPeriod >= SIMPLE_ROUGH_POINTS ? "rough" : "okay";
}

// ---------- the day a session counts on ----------

// ONE rule for every number and every date shown: a session counts on the local calendar day on
// which it STARTED, by the device's clock at that moment, and that day never changes afterwards.
// A session over midnight belongs to its start day as a whole (its time, its streak day and its
// time-of-day slot). So when a session starts, the device's offset from UTC (world time) in
// minutes is stored with it: utcOffsetMin, e.g. 60 in Budapest in winter, 120 in summer, 0 in
// Madeira in winter, 330 in India. It already includes daylight saving at that moment. With it,
// the start's clock reading is the same in any timezone the device is in later.
// Sessions saved before utcOffsetMin existed (or with a broken value) have no stored offset: they
// use the device's current timezone, as they always did. Old entries are never rewritten.
// "Today" and "this week" are always the device's current local date (history.js).

// Real offsets go from UTC-12:00 to UTC+14:00.
const MIN_UTC_OFFSET = -12 * 60;
const MAX_UTC_OFFSET = 14 * 60;

function isUtcOffset(value) {
  return Number.isInteger(value) && value >= MIN_UTC_OFFSET && value <= MAX_UTC_OFFSET;
}

// The device's offset from UTC at this moment (getTimezoneOffset counts the other way round).
// "+ 0" turns UTC's -0 into 0.
function utcOffsetAt(time) {
  return -new Date(time).getTimezoneOffset() + 0;
}

// The start of a session as shown and counted: { date, timeZone }, to be read or formatted
// together. With a stored offset, date is startedAt moved by the offset and read in UTC, which
// gives the clock reading the device had at the start. Without one, the device's current timezone.
function sessionClock(entry) {
  return isUtcOffset(entry.utcOffsetMin)
    ? { date: new Date(entry.startedAt + entry.utcOffsetMin * 60000), timeZone: "UTC" }
    : { date: new Date(entry.startedAt), timeZone: undefined };
}

// The calendar day a session counts on, as a Date at local midnight of that date (only its year,
// month and day mean anything: compare days with their date, never with the time).
function sessionDay(entry) {
  const { date, timeZone } = sessionClock(entry);
  return timeZone
    ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// The hour (0-23) on the device's clock when the session started: its time-of-day slot.
function sessionHour(entry) {
  const { date, timeZone } = sessionClock(entry);
  return timeZone ? date.getUTCHours() : date.getHours();
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Whether this browser lets the site save anything right now: a tiny test write, removed at once.
// Site data blocked (e.g. Chrome's "Don't allow sites to save data on your device") throws when
// localStorage is touched, full storage throws on setItem: either way nothing stays behind, and
// both count as "can't save". Storage that is only nearly full can pass this test and still
// refuse a whole session; the summary's "Couldn't save" line covers that. Other tabs get a
// storage event for this key, which their listeners ignore (they only watch the app's own keys).
// Checked when index.html and history.html load, when a session starts, and when the page is
// shown again (so the notes go away once site data is allowed).
const STORAGE_TEST_KEY = "ct_storage_test";

function storageWorks() {
  try {
    localStorage.setItem(STORAGE_TEST_KEY, "1");
    localStorage.removeItem(STORAGE_TEST_KEY);
    return true;
  } catch {
    return false;
  }
}

// Returns false if the browser refused to store it (storage full or blocked).
function writeHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

// Adds a finished session to the history, which is kept sorted by start time, newest first (a
// "Welcome back" save of an older session, or a device clock set back, lands in its place).
// Over HISTORY_LIMIT the oldest sessions are removed, without a warning.
// endedBy is worked out from the times ("timer" or "manual") unless it's given: "timer" when the
// session time (without breaks) reached the planned length.
// Returns "saved", "exists" (already in the saved history: same start time, nothing is written),
// "short" (under HISTORY_MIN_MS: not saved on purpose) or "failed" (the browser refused to store it).
function saveFinishedSession(session, endedBy) {
  const { elapsedMs, distractedMs, focusPercent } = sessionFocus(session);
  if (elapsedMs < HISTORY_MIN_MS) return "short";

  const history = loadHistory();
  if (history.some((entry) => entry.startedAt === session.startedAt)) return "exists";

  const pauses = cleanPauses(session.pauses);
  // Set when the session started (startSession in app.js). A session that was already running when
  // the app was updated doesn't have it: its offset is worked out from its start time now.
  const utcOffsetMin = isUtcOffset(session.utcOffsetMin) ? session.utcOffsetMin : utcOffsetAt(session.startedAt);
  history.push({
    startedAt: session.startedAt,
    ...(isUtcOffset(utcOffsetMin) && { utcOffsetMin }),
    endedAt: session.endedAt,
    endedBy: endedBy || (elapsedMs >= session.durationMs ? "timer" : "manual"),
    characterId: session.characterId,
    // Custom characters only: the name when the session ran, so a renamed or deleted character's
    // sessions still show a name. Built-in characters and older entries don't have it.
    ...(typeof session.characterName === "string" && { characterName: session.characterName }),
    style: session.style,
    mode: session.mode,
    plannedMs: session.durationMs,
    elapsedMs,
    distractedMs,
    focusPercent,
    // A session resumed after a reload can still hold distractions from before categories existed.
    distractions: session.distractions.map(withCategory),
    // Only when the session had breaks.
    ...(pauses.length && { pauses }),
  });
  history.sort((a, b) => b.startedAt - a.startedAt);
  history.length = Math.min(history.length, HISTORY_LIMIT);
  // If it fails the app keeps working, the session just isn't remembered (and the user is told).
  return writeHistory(history) ? "saved" : "failed";
}

// Removes the session with this start time (Delete on the history page). The saved history is
// read again right here, never taken from the page, so a session saved meanwhile in another tab
// is kept. Returns "deleted", "missing" (it isn't in the saved history any more, e.g. deleted in
// another tab: nothing is written) or "failed" (the browser refused to store it: nothing changed).
function deleteFromHistory(startedAt) {
  const history = loadHistory();
  const kept = history.filter((entry) => entry.startedAt !== startedAt);
  if (kept.length === history.length) return "missing";
  return writeHistory(kept) ? "deleted" : "failed";
}

// ---------- iPhone storage ----------

// True on an iPhone, iPad or iPod, in any browser or the Home Screen app. iPads in desktop
// mode say they're a Mac, so a "Mac" with a touch screen counts as an iPad.
function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// True when the page runs as an installed app in its own window (the iPhone/iPad Home Screen app,
// or an installed app on Android and desktop), not in a browser tab.
function inHomeScreenApp() {
  return navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

// True in Safari on an iPhone or iPad, but not in the Home Screen app. Safari can
// erase a site's storage (history included) after 7 days without a visit; Home
// Screen apps are exempt. Chrome, Firefox, Edge, Opera and the Google app on iOS
// add their own token; in-app browsers leave out "Safari".
function iosSafariNotInstalled() {
  const ua = navigator.userAgent;
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  return isIOS() && safari && !inHomeScreenApp();
}

// ---------- export / import ----------

function buildHistoryExport() {
  return {
    app: EXPORT_APP,
    type: EXPORT_TYPE,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: loadHistory().map((entry) => ({ ...entry, distractions: entry.distractions.map(withCategory) })),
  };
}

// Times are whole milliseconds that JavaScript can hold exactly.
const isTime = (value) => Number.isSafeInteger(value) && value >= 0;
const isLength = (value) => Number.isFinite(value) && value >= 0;

// Checks one session from an import file (and, for the export's self-test, one session about to be
// exported). now: the moment of the import. Returns a clean copy (only the known fields) or throws
// an Error whose message is the code of a short reason, shown in the import result in the current
// language (import.reason.<code> in js/i18n/en.js, e.g. "tooShort": "shorter than 1 minute").
//
// Rejected: what can't be true (an end before the start, an unknown mode or style, a break outside
// the session, breaks that overlap, ...) and what is outside the sanity limits at the top (a start
// before 2024, an end more than a day after now, a planned length over 240 minutes, more than
// distractionLimit() distractions or IMPORT_MAX_BREAKS breaks).
// Repaired, so a session the app saved itself is never lost:
// - elapsedMs, distractedMs and focusPercent are worked out again from the times, the breaks and
//   the distractions (sessionFocus), whatever the file says; endedBy, "at least 1 minute" and "not
//   longer than planned" are then checked against those. One exception: before 19 Oct 2026 the app
//   rounded a tiny distraction (under 0.5% of the session) up to 100%, and such a 100 is kept.
// - a distraction whose at is outside the session (more than IMPORT_LATE_DISTRACTION_MS after the
//   end, or before the start: a device clock changed during the session) is moved to the session's
//   start or end; its length, level and category stay.
// - characterName (custom characters only) is kept when it's a usable name, otherwise dropped.
//
// Unknown character ids are fine (a newer export can have new characters). Version 1 files have no
// distraction categories, so their distractions get category: null. Before version 3 the only
// styles were "kind" and "strict", and "firm" exists from version 5. Before version 4 the only end
// reasons were "timer" and "manual". Before version 6 there are no away distractions: a source
// field is dropped and every Advanced distraction needs a button length, exactly as those versions
// did. Before version 7 there are no breaks: a pauses field is dropped. From version 8 a session can
// have utcOffsetMin (see "the day a session counts on"): a valid one is kept, a missing or invalid
// one is left out and the session still imports (it then counts in the device's current timezone,
// like every older session). Before version 8 the field is dropped.
function cleanImportedSession(raw, version, now = Date.now()) {
  if (!raw || typeof raw !== "object") throw new Error("notSession");

  const { startedAt, endedAt, endedBy, characterId, style, mode, plannedMs } = raw;
  if (!isTime(startedAt) || !isTime(endedAt) || endedAt < startedAt || startedAt < IMPORT_EARLIEST_START) {
    throw new Error("badTimes");
  }
  if (endedAt > now + IMPORT_FUTURE_MS) throw new Error("future");
  if (!Object.hasOwn(ENDED_BY_RULES, endedBy) || (endedBy === "startOver" && version < 4)) {
    throw new Error("unknownEndReason");
  }
  if (typeof characterId !== "string" || !/^[a-z0-9-]{1,64}$/.test(characterId)) throw new Error("badCharacter");
  const styles = ["kind", "strict"];
  if (version >= 3) styles.push("ragebait");
  if (version >= 5) styles.push("firm");
  if (!styles.includes(style)) throw new Error("unknownStyle");
  if (mode !== "simple" && mode !== "advanced") throw new Error("unknownMode");
  if (!Number.isInteger(plannedMs) || plannedMs < MIN_PLANNED_MS || plannedMs > MAX_PLANNED_MS || plannedMs % MIN_PLANNED_MS !== 0) {
    throw new Error("badPlanned");
  }
  if (!Array.isArray(raw.distractions)) throw new Error("noDistractions");

  // Breaks (version 7): each inside the session, in order and not overlapping. They're checked
  // before the distractions, so session time is measured without them, exactly as the app saves it
  // (a session with breaks that ran to the timer is still "timer").
  let pauses = [];
  if (version >= 7 && Object.hasOwn(raw, "pauses")) {
    if (!Array.isArray(raw.pauses) || raw.pauses.length > IMPORT_MAX_BREAKS) throw new Error("badBreakList");
    let previousEnd = startedAt;
    pauses = raw.pauses.map((p) => {
      if (!p || !isTime(p.at) || !Number.isInteger(p.ms) || p.ms <= 0) throw new Error("badBreak");
      if (p.at < startedAt || p.at + p.ms > endedAt) throw new Error("breakOutside");
      if (p.at < previousEnd) throw new Error("breaksOverlap");
      previousEnd = p.at + p.ms;
      return { at: p.at, ms: p.ms };
    });
  }

  // Session time, as sessionFocus works it out (no distraction can change it).
  const elapsedMs = Math.max(0, endedAt - startedAt - pausedTotal(pauses));
  if (raw.distractions.length > distractionLimit(elapsedMs)) throw new Error("tooManyDistractions");

  const distractions = raw.distractions.map((d) => {
    if (!d || !isTime(d.at) || !Number.isInteger(d.level) || d.level < 1 || d.level > 5 || !isLength(d.ms)) {
      throw new Error("badDistraction");
    }
    if (version >= 2 && d.category !== null && !isCategory(d.category)) {
      throw new Error("unknownCategory");
    }
    if (version >= 6 && Object.hasOwn(d, "source") && d.source !== "away") {
      throw new Error("unknownSource");
    }
    // Inside the session, or up to IMPORT_LATE_DISTRACTION_MS after the end (a tap just as the timer
    // ran out): kept as it is. Anything else is moved to the nearer end of the session.
    const outside = d.at < startedAt || d.at > endedAt + IMPORT_LATE_DISTRACTION_MS;
    const at = outside ? Math.min(endedAt, Math.max(startedAt, d.at)) : d.at;
    const clean = { at, level: d.level, ms: d.ms, category: version >= 2 ? d.category : null };
    if (version >= 6 && d.source === "away") clean.source = "away";
    return clean;
  });

  if (elapsedMs < HISTORY_MIN_MS) throw new Error("tooShort");
  if (elapsedMs > plannedMs) throw new Error("longerThanPlanned");
  const endedByRule = ENDED_BY_RULES[endedBy];
  if (endedByRule && !endedByRule(elapsedMs, plannedMs)) throw new Error("endReasonMismatch");
  for (const d of distractions) {
    // The distraction buttons are hidden during a break, and leaving the page then logs nothing.
    if (pauses.some((p) => d.at > p.at && d.at < p.at + p.ms)) throw new Error("distractionInBreak");
    if (mode === "simple" && d.ms !== 0) throw new Error("simpleWithLength");
    // Away: measured in whole seconds, at least AWAY_MIN_MS, never longer than the session.
    // Its at (the moment the page was left) is inside the session like any other.
    if (mode === "advanced" && d.source === "away") {
      if (d.ms % 1000 !== 0 || d.ms < AWAY_MIN_MS || d.ms > elapsedMs) {
        throw new Error("awayLength");
      }
      if (d.level !== awayLevel(d.ms)) throw new Error("awayLevel");
    } else if (mode === "advanced" && (d.ms < IMPORT_MIN_DISTRACTION_MS || d.ms > IMPORT_MAX_DISTRACTION_MS)) {
      throw new Error("advancedLength");
    }
  }

  // The numbers are always the app's own calculation.
  const expected = sessionFocus({ startedAt, endedAt, mode, distractions, pauses });
  // Before 19 Oct 2026 the app rounded a tiny distraction (under 0.5% of the session) up to 100%:
  // that saved 100 is kept, so a restored session shows what it showed before.
  const oldRoundedTo100 =
    mode === "advanced" && raw.focusPercent === 100 && expected.focusPercent === 99 &&
    Math.round(((elapsedMs - expected.distractedMs) / elapsedMs) * 100) === 100;
  const focusPercent = oldRoundedTo100 ? 100 : expected.focusPercent;

  // A custom character's name when the session ran (see saveFinishedSession), within the editor's
  // limits. Shown as plain text only (textContent), never as HTML.
  const name = isCustomId(characterId) && typeof raw.characterName === "string" ? raw.characterName.trim() : "";
  const characterName = name && nameLength(name) <= CUSTOM_NAME_MAX ? name : "";

  return {
    startedAt,
    ...(version >= 8 && isUtcOffset(raw.utcOffsetMin) && { utcOffsetMin: raw.utcOffsetMin }),
    endedAt, endedBy, characterId,
    ...(characterName && { characterName }),
    style, mode, plannedMs, elapsedMs, distractedMs: expected.distractedMs, focusPercent, distractions,
    ...(pauses.length && { pauses }),
  };
}

// Counts how many sessions fail, by reason code. Returns [[code, count], ...] in the order the
// codes first appear.
function countReasons(reasons) {
  const counts = new Map();
  for (const reason of reasons) counts.set(reason, (counts.get(reason) || 0) + 1);
  return [...counts];
}

// The export's self-test: every session of an export runs through the same check as an import
// (cleanImportedSession), so a session that a restore would lose is found now, not then. Returns
// one reason code per session that wouldn't import. Those sessions are still in the file.
function exportProblems(data, now = Date.now()) {
  const reasons = [];
  for (const entry of data.sessions) {
    try {
      cleanImportedSession(entry, data.version, now);
    } catch (error) {
      reasons.push(error.message);
    }
  }
  return reasons;
}

// Reads the text of an import file. Returns { sessions, invalidReasons }: the
// cleaned sessions, and one reason code per session that was skipped because
// it's invalid. A problem with the file itself throws an Error whose message is a code:
// import.file.<code> in js/i18n/en.js. now: the moment of the import (for "date in the future").
function parseHistoryExport(text, now = Date.now()) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("notJson");
  }
  if (!data || data.app !== EXPORT_APP || data.type !== EXPORT_TYPE || !Array.isArray(data.sessions)) {
    throw new Error("notExport");
  }
  if (!IMPORT_VERSIONS.includes(data.version)) {
    throw new Error(typeof data.version === "number" && data.version > EXPORT_VERSION ? "newerVersion" : "unknownVersion");
  }
  // A broken session is skipped; the rest of the file still imports.
  const sessions = [];
  const invalidReasons = [];
  for (const raw of data.sessions) {
    try {
      sessions.push(cleanImportedSession(raw, data.version, now));
    } catch (error) {
      invalidReasons.push(error.message);
    }
  }
  return { sessions, invalidReasons };
}

// Adds imported sessions to the history. It never removes a session you have: a session whose
// start time is already in the history (or earlier in the file) is skipped, and the new ones are
// added newest first while the history has room under HISTORY_LIMIT; the rest didn't fit. The saved
// history is read again right here, in the same step as the write, so a session saved meanwhile in
// another tab is never lost. Returns { added, skipped, didNotFit, full, saved }: full is true when
// there were new sessions but no room for any; saved is false if the browser refused to store the
// result (then nothing changed).
function mergeIntoHistory(sessions) {
  const history = loadHistory();
  const known = new Set(history.map((entry) => entry.startedAt));
  const fresh = [];
  let skipped = 0;
  for (const session of sessions) {
    if (known.has(session.startedAt)) {
      skipped++;
    } else {
      known.add(session.startedAt);
      fresh.push(session);
    }
  }

  fresh.sort((a, b) => b.startedAt - a.startedAt);
  const room = Math.max(0, HISTORY_LIMIT - history.length);
  const toAdd = fresh.slice(0, room);
  const didNotFit = fresh.length - toAdd.length;
  const full = fresh.length > 0 && toAdd.length === 0;
  if (toAdd.length === 0) return { added: 0, skipped, didNotFit, full, saved: true };

  const merged = history.concat(toAdd).sort((a, b) => b.startedAt - a.startedAt);
  const saved = writeHistory(merged);
  return { added: saved ? toAdd.length : 0, skipped, didNotFit, full, saved };
}
