"use strict";

// History page: streaks, weekly focus trend, best time of day, recent sessions.
// All dates use the device's local time.

const TREND_WEEKS = 12;
const LIST_SIZE = 30;
// A time-of-day slot can only be "best" once it has this many sessions with a focus %.
const MIN_SESSIONS_FOR_BEST_TIME = 3;

// Sessions are grouped by the hour they started.
const DAY_PARTS = [
  { label: "Morning", hours: "5:00–12:00", matches: (h) => h >= 5 && h < 12 },
  { label: "Afternoon", hours: "12:00–17:00", matches: (h) => h >= 12 && h < 17 },
  { label: "Evening", hours: "17:00–22:00", matches: (h) => h >= 17 && h < 22 },
  { label: "Night", hours: "22:00–5:00", matches: (h) => h >= 22 || h < 5 },
];

// ---------- dates ----------

function startOfDay(time) {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Calendar-based (not "+ 24 hours"), so daylight saving changes can't skip a day.
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dayKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Weeks start on Monday.
function startOfWeek(time) {
  const day = startOfDay(time);
  return addDays(day, -((day.getDay() + 6) % 7));
}

// ---------- calculations ----------

// A day counts once it has at least one finished session (by the time it ended).
function calcStreaks(history, now) {
  const days = new Map();
  for (const entry of history) {
    const day = startOfDay(entry.endedAt);
    days.set(dayKey(day), day);
  }

  // Current streak: count back from today. If nothing is finished today yet,
  // yesterday's streak is still alive until the day is over.
  let day = startOfDay(now);
  if (!days.has(dayKey(day))) day = addDays(day, -1);
  let current = 0;
  while (days.has(dayKey(day))) {
    current++;
    day = addDays(day, -1);
  }

  // Longest streak: walk the days in order and count consecutive runs.
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const key of [...days.keys()].sort()) {
    run = previous && dayKey(addDays(previous, 1)) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = days.get(key);
  }

  return { current, longest };
}

// Focus % across several sessions: total focused time / total time, so a
// 90-minute session weighs more than a 5-minute one. Simple-mode sessions
// (focusPercent null) are left out. Returns null when there's nothing to measure.
function combinedFocus(entries) {
  const timed = entries.filter((entry) => entry.focusPercent !== null && entry.elapsedMs > 0);
  const elapsed = timed.reduce((sum, entry) => sum + entry.elapsedMs, 0);
  if (elapsed === 0) return null;
  const focused = timed.reduce((sum, entry) => sum + entry.elapsedMs - entry.distractedMs, 0);
  return { percent: Math.round((focused / elapsed) * 100), count: timed.length };
}

function calcWeeklyTrend(history, now) {
  const thisWeek = startOfWeek(now);
  const weeks = [];
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    const focus = combinedFocus(
      history.filter((entry) => entry.startedAt >= start.getTime() && entry.startedAt < end.getTime())
    );
    weeks.push({ start, percent: focus ? focus.percent : null, count: focus ? focus.count : 0 });
  }
  return weeks;
}

function calcDayParts(history) {
  return DAY_PARTS.map((part) => {
    const focus = combinedFocus(history.filter((entry) => part.matches(new Date(entry.startedAt).getHours())));
    return { ...part, percent: focus ? focus.percent : null, count: focus ? focus.count : 0 };
  });
}

// ---------- formatting ----------

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatSessionDate(time) {
  const date = new Date(time);
  const day = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const clock = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${clock}`;
}

function formatSessionLength(entry) {
  const planned = Math.round(entry.plannedMs / 60000);
  if (entry.endedBy === "timer") return `${planned} min`;
  const actual = Math.max(1, Math.round(entry.elapsedMs / 60000));
  return `${actual} of ${planned} min`;
}

function characterName(id) {
  const character = CHARACTERS.find((c) => c.id === id);
  return character ? character.name : id;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- chart ----------

// Line chart of weekly focus %. Weeks without data leave a gap in the line.
// Colors come from CSS classes, so the chart follows light/dark mode.
function trendChartSvg(weeks) {
  const width = 400;
  const height = 210;
  const left = 38;
  const right = 26; // room for the last week's date label
  const top = 12;
  const bottom = 30;
  const x = (i) => left + ((width - left - right) * i) / (weeks.length - 1);
  const y = (percent) => top + (height - top - bottom) * (1 - percent / 100);

  let grid = "";
  for (const percent of [0, 25, 50, 75, 100]) {
    grid += `<line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(percent)}" y2="${y(percent)}"/>`;
    grid += `<text class="chart-label" x="${left - 6}" y="${y(percent) + 4}" text-anchor="end">${percent}%</text>`;
  }

  // Label every third week, ending with the current week.
  let labels = "";
  weeks.forEach((week, i) => {
    if ((weeks.length - 1 - i) % 3 === 0) {
      labels += `<text class="chart-label" x="${x(i)}" y="${height - 8}" text-anchor="middle">${formatShortDate(week.start)}</text>`;
    }
  });

  let path = "";
  let penDown = false;
  let points = "";
  weeks.forEach((week, i) => {
    if (week.percent === null) {
      penDown = false;
      return;
    }
    path += `${penDown ? "L" : "M"}${x(i)} ${y(week.percent)} `;
    penDown = true;
    points +=
      `<circle class="chart-point" cx="${x(i)}" cy="${y(week.percent)}" r="4.5">` +
      `<title>Week of ${formatShortDate(week.start)}: ${week.percent}% (${plural(week.count, "session")})</title></circle>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekly focus percentage for the last ${weeks.length} weeks">
    ${grid}${labels}
    <path class="chart-line" d="${path.trim()}"/>
    ${points}
  </svg>`;
}

// ---------- rendering ----------

function renderStreaks(history, now) {
  const { current, longest } = calcStreaks(history, now);
  document.getElementById("currentStreak").textContent = plural(current, "day");
  document.getElementById("longestStreak").textContent = plural(longest, "day");
}

function renderTrend(history, now) {
  const weeks = calcWeeklyTrend(history, now);
  const chart = document.getElementById("trendChart");
  const note = document.getElementById("trendNote");

  if (weeks.every((week) => week.percent === null)) {
    chart.innerHTML = "";
    note.textContent = "No Advanced-mode sessions in the last 12 weeks. Use Advanced mode to see your focus trend.";
    return;
  }

  chart.innerHTML = trendChartSvg(weeks);
  const thisWeek = weeks[weeks.length - 1];
  note.textContent =
    thisWeek.percent === null
      ? "No Advanced-mode sessions this week yet."
      : `This week: ${thisWeek.percent}% focused across ${plural(thisWeek.count, "session")}.`;
}

function renderDayParts(history) {
  const parts = calcDayParts(history);
  const eligible = parts.filter((part) => part.count >= MIN_SESSIONS_FOR_BEST_TIME);
  // Highest %, and with a tie the one with more sessions behind it.
  const best = eligible.sort((a, b) => b.percent - a.percent || b.count - a.count)[0] || null;

  document.getElementById("bestTime").textContent = best
    ? `You focus best in the ${best.label.toLowerCase()} (${best.percent}% on average).`
    : `Not enough data yet. A time of day counts once it has ${MIN_SESSIONS_FOR_BEST_TIME} Advanced-mode sessions.`;

  const list = document.getElementById("dayParts");
  list.innerHTML = "";
  for (const part of parts) {
    const item = document.createElement("li");
    item.className = "day-part" + (part === best ? " best" : "");
    item.innerHTML = `
      <div class="day-part-head">
        <span><strong></strong> <span class="muted small"></span></span>
        <span class="day-part-value"></span>
      </div>
      <div class="day-part-track"><div class="day-part-fill"></div></div>
      <span class="muted small day-part-count"></span>`;
    item.querySelector("strong").textContent = part.label;
    item.querySelector(".day-part-head .muted").textContent = part.hours;
    item.querySelector(".day-part-value").textContent = part.percent === null ? "—" : `${part.percent}%`;
    item.querySelector(".day-part-fill").style.width = `${part.percent || 0}%`;
    item.querySelector(".day-part-count").textContent =
      part.count >= MIN_SESSIONS_FOR_BEST_TIME
        ? plural(part.count, "session")
        : `${plural(part.count, "session")} · needs ${MIN_SESSIONS_FOR_BEST_TIME} to count`;
    list.append(item);
  }
}

function renderSessionList(history) {
  const recent = history.slice(0, LIST_SIZE);
  document.getElementById("listTitle").textContent =
    history.length > LIST_SIZE ? `Last ${LIST_SIZE} sessions (of ${history.length})` : plural(history.length, "session");

  const list = document.getElementById("sessionList");
  list.innerHTML = "";
  for (const entry of recent) {
    const item = document.createElement("li");
    item.className = "session-item";
    item.innerHTML = `
      <div class="session-item-main">
        <div><strong></strong> <span class="muted small session-item-mode"></span></div>
        <div class="muted small session-item-meta"></div>
      </div>
      <div class="session-item-focus"></div>`;
    item.querySelector("strong").textContent = characterName(entry.characterId);
    item.querySelector(".session-item-mode").textContent = `${capitalize(entry.mode)} · ${capitalize(entry.style)}`;
    item.querySelector(".session-item-meta").textContent = [
      formatSessionDate(entry.startedAt),
      formatSessionLength(entry),
      plural(entry.distractions.length, "distraction"),
    ].join(" · ");

    const focus = item.querySelector(".session-item-focus");
    if (entry.focusPercent === null) {
      focus.textContent = "—";
      focus.title = "Simple mode doesn't measure focus %";
    } else {
      focus.textContent = `${entry.focusPercent}%`;
    }
    list.append(item);
  }
}

// Draws (or redraws, after an import) everything that depends on the history.
function render() {
  const history = loadHistory();
  const empty = history.length === 0;
  document.getElementById("historyEmpty").hidden = !empty;
  document.getElementById("historyContent").hidden = empty;
  document.getElementById("exportButton").disabled = empty;
  if (empty) return;

  const now = Date.now();
  renderStreaks(history, now);
  renderTrend(history, now);
  renderDayParts(history);
  renderSessionList(history);
}

// ---------- export / import ----------

function showBackupStatus(message, isError) {
  const status = document.getElementById("backupStatus");
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.hidden = false;
}

function exportHistory() {
  const data = buildHistoryExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `concentraining-history-${dayKey(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showBackupStatus(`Exported ${plural(data.sessions.length, "session")}.`, false);
}

async function importHistory(file) {
  if (file.size > IMPORT_MAX_BYTES) {
    showBackupStatus("This file is too big to be a ConcenTraining export.", true);
    return;
  }

  let sessions;
  try {
    sessions = parseHistoryExport(await file.text());
  } catch (error) {
    showBackupStatus(error.message, true);
    return;
  }

  const { added, skipped, dropped, saved } = mergeIntoHistory(sessions);
  if (!saved) {
    showBackupStatus("Couldn't save the imported sessions: this browser's storage is full or blocked.", true);
    return;
  }

  let message =
    added === 0
      ? `Nothing new to import: you already have every session in this file (${sessions.length}).`
      : `Imported ${plural(added, "session")}.`;
  if (added > 0 && skipped > 0) message += ` Skipped ${plural(skipped, "session")} you already had.`;
  if (dropped > 0) message += ` The oldest ${plural(dropped, "session")} didn't fit (max. ${HISTORY_LIMIT}) and were left out.`;
  showBackupStatus(message, false);
  render();
}

function init() {
  const fileInput = document.getElementById("importFile");
  document.getElementById("exportButton").addEventListener("click", exportHistory);
  document.getElementById("importButton").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    fileInput.value = ""; // so picking the same file again still triggers "change"
    if (file) importHistory(file);
  });
  render();
}

init();
