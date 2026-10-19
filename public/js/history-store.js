// Finished-session history, shared by index.html (saves sessions) and
// history.html (shows, exports and imports them). Stored in localStorage under
// its own key, separate from the running session (ct_session_v1).

const HISTORY_KEY = "ct_history_v1";
const HISTORY_LIMIT = 1000; // newest sessions kept (~300 KB)
const HISTORY_MIN_MS = 60 * 1000; // shorter sessions count as accidental starts and aren't saved

// Export file format. Bump EXPORT_VERSION if the session fields ever change.
// Version 2 added a category to each distraction; version 1 files still import.
const EXPORT_APP = "ConcenTraining";
const EXPORT_TYPE = "session-history";
const EXPORT_VERSION = 2;
const IMPORT_VERSIONS = [1, 2];
const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

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
function sessionFocus(session) {
  const elapsedMs = Math.max(0, session.endedAt - session.startedAt);
  const loggedMs = session.distractions.reduce((sum, d) => sum + (d.ms || 0), 0);
  const distractedMs = Math.min(elapsedMs, loggedMs);
  let focusPercent = null;
  if (session.mode === "advanced") {
    focusPercent = elapsedMs > 0 ? Math.round(((elapsedMs - distractedMs) / elapsedMs) * 100) : 100;
  }
  return { elapsedMs, distractedMs, focusPercent };
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
function saveFinishedSession(session) {
  const { elapsedMs, distractedMs, focusPercent } = sessionFocus(session);
  if (elapsedMs < HISTORY_MIN_MS) return;

  const history = loadHistory();
  if (history.some((entry) => entry.startedAt === session.startedAt)) return; // already saved

  history.unshift({
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    endedBy: session.endedAt >= session.startedAt + session.durationMs ? "timer" : "manual",
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
  writeHistory(history); // if it fails the app keeps working, the session just isn't remembered
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
// fields) or throws an Error saying what's wrong. Version 1 files have no
// distraction categories, so their distractions get category: null.
function cleanImportedSession(raw, version) {
  if (!raw || typeof raw !== "object") throw new Error("it isn't a session object");

  const { startedAt, endedAt, endedBy, characterId, style, mode, plannedMs, elapsedMs, distractedMs, focusPercent } = raw;
  if (!isTime(startedAt) || !isTime(endedAt) || endedAt < startedAt) throw new Error("its start or end time is invalid");
  if (endedBy !== "timer" && endedBy !== "manual") throw new Error("it doesn't say how it ended");
  if (typeof characterId !== "string" || !/^[a-z0-9-]{1,64}$/.test(characterId)) throw new Error("its character is invalid");
  if (style !== "kind" && style !== "strict") throw new Error("its style is invalid");
  if (mode !== "simple" && mode !== "advanced") throw new Error("its mode is invalid");
  if (!isTime(plannedMs) || !isTime(elapsedMs) || !isTime(distractedMs) || distractedMs > elapsedMs) {
    throw new Error("its durations are invalid");
  }
  const focusOk =
    mode === "simple"
      ? focusPercent === null
      : Number.isInteger(focusPercent) && focusPercent >= 0 && focusPercent <= 100;
  if (!focusOk) throw new Error("its focus % is invalid");
  if (!Array.isArray(raw.distractions)) throw new Error("its distraction list is missing");

  const distractions = raw.distractions.map((d) => {
    if (!d || !isTime(d.at) || !Number.isInteger(d.level) || d.level < 1 || d.level > 5 || !isTime(d.ms)) {
      throw new Error("one of its distractions is invalid");
    }
    if (version >= 2 && d.category !== null && !isCategory(d.category)) {
      throw new Error("one of its distractions has an unknown category");
    }
    return { at: d.at, level: d.level, ms: d.ms, category: version >= 2 ? d.category : null };
  });

  return { startedAt, endedAt, endedBy, characterId, style, mode, plannedMs, elapsedMs, distractedMs, focusPercent, distractions };
}

// Reads the text of an import file. Returns the cleaned sessions, or throws an
// Error whose message can be shown to the user as-is.
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
  // All or nothing: one broken session rejects the whole file, so nothing half-imports.
  return data.sessions.map((raw, i) => {
    try {
      return cleanImportedSession(raw, data.version);
    } catch (error) {
      throw new Error(`Session ${i + 1} in the file can't be imported: ${error.message}.`);
    }
  });
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
