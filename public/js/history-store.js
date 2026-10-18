// Finished-session history, shared by index.html (saves sessions) and
// history.html (shows them). Stored in localStorage under its own key, separate
// from the running session (ct_session_v1).

const HISTORY_KEY = "ct_history_v1";
const HISTORY_LIMIT = 1000; // newest sessions kept (~300 KB)
const HISTORY_MIN_MS = 60 * 1000; // shorter sessions count as accidental starts and aren't saved

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
    distractions: session.distractions,
  });
  history.length = Math.min(history.length, HISTORY_LIMIT);

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage full or blocked: the app keeps working, the session just isn't remembered.
  }
}
