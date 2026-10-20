// Finished-session history, shared by index.html (saves sessions) and
// history.html (shows, exports and imports them). Stored in localStorage under
// its own key, separate from the running session (ct_session_v1).

const HISTORY_KEY = "ct_history_v1";
const HISTORY_LIMIT = 1000; // newest sessions kept (~300 KB)
const HISTORY_MIN_MS = 60 * 1000; // shorter sessions count as accidental starts and aren't saved

// How a finished session went: "great", "okay" or "rough" (see sessionResult).
// Advanced mode uses the focus %: great from 85%, okay from 60%, rough below.
const SUMMARY_GREAT_FOCUS = 85;
const SUMMARY_OKAY_FOCUS = 60;
// Simple mode has no focus %, so it uses distraction points instead: each logged
// distraction scores its level (Very briefly = 1 … A whole lot = 5), counted per
// 25 minutes. Great up to 2 points per 25 min, rough from 8, okay in between.
const SIMPLE_GREAT_POINTS = 2;
const SIMPLE_ROUGH_POINTS = 8;
const SIMPLE_POINTS_PER_MS = 25 * 60 * 1000; // shorter sessions count as 25 min

// Export file format. Bump EXPORT_VERSION if the session fields ever change.
// Version 2 added a category to each distraction. Version 3 allows the style
// "ragebait". Version 4 allows endedBy "startOver". Version 5 allows the style
// "firm". Version 1-4 files still import.
const EXPORT_APP = "ConcenTraining";
const EXPORT_TYPE = "session-history";
const EXPORT_VERSION = 5;
const IMPORT_VERSIONS = [1, 2, 3, 4, 5];
const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

// How a session can end, and what that says about its times (see saveFinishedSession):
// "timer" ran the full planned time, "manual" was ended early, "startOver" was
// abandoned with Start over after a long distraction (and the user chose to keep
// it). Only these values import. A new endedBy value needs one line here (give it
// null to import it without checking its times), plus a version check in
// cleanImportedSession like the one for "startOver".
// The future adaptive training program must skip endedBy "startOver" sessions:
// they stopped because of the long distraction, not because the user chose that length.
const ENDED_BY_RULES = {
  timer: (elapsedMs, plannedMs) => elapsedMs === plannedMs,
  manual: (elapsedMs, plannedMs) => elapsedMs < plannedMs,
  startOver: (elapsedMs, plannedMs) => elapsedMs < plannedMs,
};

// Planned lengths are whole minutes, at least 1.
const MIN_PLANNED_MS = 60 * 1000;
// Imported Advanced-mode distractions must be as long as one of its buttons:
// 30 sec (shortest) to 10 min (longest). Simple-mode distractions have no length.
const IMPORT_MIN_DISTRACTION_MS = 30 * 1000;
const IMPORT_MAX_DISTRACTION_MS = 10 * 60 * 1000;
// A tap in the last moment can be timestamped just after the timer ran out.
const IMPORT_LATE_DISTRACTION_MS = 60 * 1000;

// What caused a distraction. The id is what's saved; the label is what's shown.
// A distraction without a picked category is saved with category: null.
const DISTRACTION_CATEGORIES = [
  { id: "phone", label: "Phone" },
  { id: "thoughts", label: "Thoughts" },
  { id: "noise", label: "Noise" },
  { id: "people", label: "People" },
  { id: "tired", label: "Tired" },
  { id: "other", label: "Other" },
];

const isCategory = (value) => DISTRACTION_CATEGORIES.some((category) => category.id === value);

// Distractions saved before categories existed have no category field: they get null.
const withCategory = (d) => ({ at: d.at, level: d.level, ms: d.ms, category: isCategory(d.category) ? d.category : null });

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

// Time and focus numbers for a finished session. focusPercent is null in Simple
// mode, because its buttons say how much you were distracted, not for how long.
// It's only 100 with no distraction time at all: 99.6% shows as 99, not 100.
function sessionFocus(session) {
  const elapsedMs = Math.max(0, session.endedAt - session.startedAt);
  const loggedMs = session.distractions.reduce((sum, d) => sum + (d.ms || 0), 0);
  const distractedMs = Math.min(elapsedMs, loggedMs);
  let focusPercent = null;
  if (session.mode === "advanced") {
    focusPercent = elapsedMs > 0 ? Math.round(((elapsedMs - distractedMs) / elapsedMs) * 100) : 100;
    if (distractedMs > 0) focusPercent = Math.min(99, focusPercent);
  }
  return { elapsedMs, distractedMs, focusPercent };
}

// How a finished session went: "short" (under HISTORY_MIN_MS, so not saved),
// "great", "okay" or "rough". Advanced mode uses the focus %, Simple mode the
// distraction points (see the constants at the top).
function sessionResult(session) {
  const { elapsedMs, focusPercent } = sessionFocus(session);
  if (elapsedMs < HISTORY_MIN_MS) return "short";

  if (session.mode === "advanced") {
    if (focusPercent >= SUMMARY_GREAT_FOCUS) return "great";
    return focusPercent >= SUMMARY_OKAY_FOCUS ? "okay" : "rough";
  }

  const points = session.distractions.reduce((sum, d) => sum + d.level, 0);
  const perPeriod = (points * SIMPLE_POINTS_PER_MS) / Math.max(elapsedMs, SIMPLE_POINTS_PER_MS);
  if (perPeriod <= SIMPLE_GREAT_POINTS) return "great";
  return perPeriod >= SIMPLE_ROUGH_POINTS ? "rough" : "okay";
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

// Adds a finished session to the front of the history (newest first).
// endedBy is worked out from the times ("timer" or "manual") unless it's given.
// Returns true if the session is now in the saved history.
function saveFinishedSession(session, endedBy) {
  const { elapsedMs, distractedMs, focusPercent } = sessionFocus(session);
  if (elapsedMs < HISTORY_MIN_MS) return false;

  const history = loadHistory();
  if (history.some((entry) => entry.startedAt === session.startedAt)) return true; // already saved

  history.unshift({
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    endedBy: endedBy || (session.endedAt >= session.startedAt + session.durationMs ? "timer" : "manual"),
    characterId: session.characterId,
    style: session.style,
    mode: session.mode,
    plannedMs: session.durationMs,
    elapsedMs,
    distractedMs,
    focusPercent,
    // A session resumed after a reload can still hold distractions from before categories existed.
    distractions: session.distractions.map(withCategory),
  });
  history.length = Math.min(history.length, HISTORY_LIMIT);
  return writeHistory(history); // if it fails the app keeps working, the session just isn't remembered
}

// ---------- iPhone storage ----------

// True in Safari on an iPhone or iPad, but not in the Home Screen app. Safari can
// erase a site's storage (history included) after 7 days without a visit; Home
// Screen apps are exempt. iPads in desktop mode say they're a Mac, so a "Mac"
// with a touch screen counts as an iPad. Chrome, Firefox, Edge, Opera and the
// Google app on iOS add their own token; in-app browsers leave out "Safari".
function iosSafariNotInstalled() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  const standalone = navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return ios && safari && !standalone;
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

const isTime = (value) => Number.isFinite(value) && value >= 0;

// Checks one session from an import file. Returns a clean copy (only the known
// fields) or throws an Error whose message is a short reason, shown in the
// import result (e.g. "shorter than 1 minute"). Besides each field on its own,
// it checks that the numbers agree with each other the way the app saves them,
// so a hand-edited session can't contradict itself. Unknown character ids are
// fine (a newer export can have new characters). Version 1 files have no
// distraction categories, so their distractions get category: null. Before
// version 3 the only styles were "kind" and "strict", and "firm" exists from
// version 5. Before version 4 the only end reasons were "timer" and "manual".
function cleanImportedSession(raw, version) {
  if (!raw || typeof raw !== "object") throw new Error("not a session");

  const { startedAt, endedAt, endedBy, characterId, style, mode, plannedMs, elapsedMs, distractedMs, focusPercent } = raw;
  if (!isTime(startedAt) || !isTime(endedAt) || endedAt < startedAt) throw new Error("bad start or end time");
  if (!Object.hasOwn(ENDED_BY_RULES, endedBy) || (endedBy === "startOver" && version < 4)) {
    throw new Error("unknown end reason");
  }
  if (typeof characterId !== "string" || !/^[a-z0-9-]{1,64}$/.test(characterId)) throw new Error("bad character id");
  const styles = ["kind", "strict"];
  if (version >= 3) styles.push("ragebait");
  if (version >= 5) styles.push("firm");
  if (!styles.includes(style)) throw new Error("unknown style");
  if (mode !== "simple" && mode !== "advanced") throw new Error("unknown mode");
  if (!isTime(plannedMs) || !isTime(elapsedMs) || !isTime(distractedMs) || distractedMs > elapsedMs) {
    throw new Error("bad duration fields");
  }
  if (mode === "simple" && focusPercent !== null) throw new Error("focus % in Simple mode");
  if (mode === "advanced" && !(Number.isInteger(focusPercent) && focusPercent >= 0 && focusPercent <= 100)) {
    throw new Error("bad focus %");
  }
  if (!Array.isArray(raw.distractions)) throw new Error("no distraction list");

  const distractions = raw.distractions.map((d) => {
    if (!d || !isTime(d.at) || !Number.isInteger(d.level) || d.level < 1 || d.level > 5 || !isTime(d.ms)) {
      throw new Error("bad distraction");
    }
    if (version >= 2 && d.category !== null && !isCategory(d.category)) {
      throw new Error("unknown distraction category");
    }
    return { at: d.at, level: d.level, ms: d.ms, category: version >= 2 ? d.category : null };
  });

  // Do the numbers agree? The app's own calculation is the reference.
  const expected = sessionFocus({ startedAt, endedAt, mode, distractions });
  if (elapsedMs !== expected.elapsedMs) throw new Error("elapsed time doesn't match start and end");
  if (elapsedMs < HISTORY_MIN_MS) throw new Error("shorter than 1 minute");
  if (plannedMs < MIN_PLANNED_MS || plannedMs % MIN_PLANNED_MS !== 0) throw new Error("bad planned length");
  if (elapsedMs > plannedMs) throw new Error("longer than planned");
  const endedByRule = ENDED_BY_RULES[endedBy];
  if (endedByRule && !endedByRule(elapsedMs, plannedMs)) throw new Error("end reason doesn't match the times");
  for (const d of distractions) {
    if (d.at < startedAt || d.at > endedAt + IMPORT_LATE_DISTRACTION_MS) throw new Error("distraction outside the session");
    if (mode === "simple" && d.ms !== 0) throw new Error("Simple distraction with a length");
    if (mode === "advanced" && (d.ms < IMPORT_MIN_DISTRACTION_MS || d.ms > IMPORT_MAX_DISTRACTION_MS)) {
      throw new Error("Advanced distraction length out of range");
    }
  }
  if (distractedMs !== expected.distractedMs) throw new Error("distraction total doesn't add up");
  // Before 19 Oct 2026 the app rounded a tiny distraction (under 0.5% of the
  // session) up to 100%, so that old value is accepted too.
  const oldRoundedTo100 = Math.round(((elapsedMs - distractedMs) / elapsedMs) * 100) === 100;
  if (mode === "advanced" && focusPercent !== expected.focusPercent && !(focusPercent === 100 && oldRoundedTo100)) {
    throw new Error("focus % doesn't match distraction time");
  }

  return { startedAt, endedAt, endedBy, characterId, style, mode, plannedMs, elapsedMs, distractedMs, focusPercent, distractions };
}

// Reads the text of an import file. Returns { sessions, invalidReasons }: the
// cleaned sessions, and one short reason per session that was skipped because
// it's invalid. A problem with the file itself throws an Error whose message
// can be shown to the user as-is.
function parseHistoryExport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a ConcenTraining export: it isn't valid JSON.");
  }
  if (!data || data.app !== EXPORT_APP || data.type !== EXPORT_TYPE || !Array.isArray(data.sessions)) {
    throw new Error("This file isn't a ConcenTraining history export.");
  }
  if (!IMPORT_VERSIONS.includes(data.version)) {
    throw new Error(
      typeof data.version === "number" && data.version > EXPORT_VERSION
        ? "This export was made by a newer version of ConcenTraining. Reload the page and try again."
        : "This export has an unknown version number."
    );
  }
  // A broken session is skipped; the rest of the file still imports.
  const sessions = [];
  const invalidReasons = [];
  for (const raw of data.sessions) {
    try {
      sessions.push(cleanImportedSession(raw, data.version));
    } catch (error) {
      invalidReasons.push(error.message);
    }
  }
  return { sessions, invalidReasons };
}

// Adds imported sessions to the history, skipping any with a start time that's
// already there. Like saveFinishedSession, only the newest HISTORY_LIMIT sessions
// are kept, so the cut can drop imported sessions (droppedImported) as well as
// sessions that were already there (removedExisting). added counts only imported
// sessions that are really in the saved history. saved is false if the browser
// refused to store the result.
function mergeIntoHistory(sessions) {
  const history = loadHistory();
  const known = new Set(history.map((entry) => entry.startedAt));
  const imported = new Set();
  let skipped = 0;
  for (const session of sessions) {
    if (known.has(session.startedAt)) {
      skipped++;
    } else {
      known.add(session.startedAt);
      history.push(session);
      imported.add(session);
    }
  }

  history.sort((a, b) => b.startedAt - a.startedAt);
  const cut = history.splice(HISTORY_LIMIT);
  const droppedImported = cut.filter((entry) => imported.has(entry)).length;
  const removedExisting = cut.length - droppedImported;
  const added = imported.size - droppedImported;

  const changed = added > 0 || removedExisting > 0;
  const saved = !changed || writeHistory(history);
  return { added, skipped, droppedImported, removedExisting, saved };
}
