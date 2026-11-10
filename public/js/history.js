"use strict";

// History page: streaks, time per week, weekly focus trend, best time of day,
// distraction categories, recent sessions.
// All dates use the device's local time.

const TREND_WEEKS = 12;
const LIST_SIZE = 30;
// A time-of-day slot can only be "best" once it has this many sessions with a focus %.
const MIN_SESSIONS_FOR_BEST_TIME = 3;

// Edit mode (the Edit / Done button above the list): each listed session gets a Delete button.
// Stays on across redraws, so several sessions can be deleted in a row, and turns off when the
// history becomes empty.
let editing = false;

// Whether this browser lets the site save anything (storageWorks in history-store.js). Checked
// when the page loads and whenever it's shown again (e.g. back from the browser's site settings);
// while it's false, the storage note shows instead of the empty state (renderStorageNote).
let canSave = true;

// What the page was last drawn from: the day, canSave and the saved history as text (see historySource).
// renderPending: the history may have changed while the Delete dialog was open; it's drawn once
// the dialog closes, never under it.
let drawnFrom = null;
let renderPending = false;

// Sessions are grouped by the hour they started. id: the texts (dayPart.<id>, history.best.<id>).
// hours: shown as it is (numbers only, the same in every language).
const DAY_PARTS = [
  { id: "morning", hours: "5:00–12:00", matches: (h) => h >= 5 && h < 12 },
  { id: "afternoon", hours: "12:00–17:00", matches: (h) => h >= 12 && h < 17 },
  { id: "evening", hours: "17:00–22:00", matches: (h) => h >= 17 && h < 22 },
  { id: "night", hours: "22:00–5:00", matches: (h) => h >= 22 || h < 5 },
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

// Session time per week, all modes: the sum of elapsedMs, so in Simple mode it
// includes the distractions. Same weeks as the focus trend (by start time).
function calcWeeklyTime(history, now) {
  const thisWeek = startOfWeek(now);
  const weeks = [];
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    const entries = history.filter((entry) => entry.startedAt >= start.getTime() && entry.startedAt < end.getTime());
    weeks.push({ start, ms: entries.reduce((sum, entry) => sum + entry.elapsedMs, 0), count: entries.length });
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

// "3 days", "1 session", "12 distractions": key is history.days, history.sessions or
// history.distractions (plural forms in the language files).
function counted(key, count) {
  return t(key, { count });
}

// Every date and time comes from Intl in the current language (I18N.formatDate), never put
// together by hand in English order. English: "20 Oct", "Mon 20 Oct", "14:05"; Hungarian:
// "okt. 20.", "okt. 20., hétfő", "14:05".
function formatShortDate(date) {
  return I18N.formatDate(date, { day: "numeric", month: "short" });
}

// The weekday's length is the language's (weekday in js/i18n/languages.js): "Mon" / "hétfő".
function formatDay(time) {
  return I18N.formatDate(new Date(time), { weekday: I18N.language().weekday || "short", day: "numeric", month: "short" });
}

function formatClockTime(time) {
  return I18N.formatDate(new Date(time), { hour: "2-digit", minute: "2-digit" });
}

// "Mon 20 Oct · 14:05": the two Intl parts on one line (time.dateAndClock).
function formatSessionDate(time) {
  return t("time.dateAndClock", { date: formatDay(time), time: formatClockTime(time) });
}

// Rounded to whole minutes: "45 min", "1 h", "2 h 15 min".
function formatTotalTime(ms) {
  const total = Math.round(ms / 60000);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return t("time.min", { minutes });
  return minutes ? t("time.hMin", { hours, minutes }) : t("time.h", { hours });
}

function formatSessionLength(entry) {
  const planned = Math.round(entry.plannedMs / 60000);
  if (entry.endedBy === "timer") return t("history.lengthFull", { planned });
  const actual = Math.max(1, Math.round(entry.elapsedMs / 60000));
  return t("history.lengthPart", { actual, planned });
}

// One line about a session, for the delete dialog: "Grandma · Advanced · Mon 20 Oct · 14:05 · 25 min".
function formatSessionSummary(entry) {
  return [
    characterName(entry),
    modeName(entry.mode),
    formatSessionDate(entry.startedAt),
    formatSessionLength(entry),
  ].join(" · ");
}

// A built-in character's name, a custom character's current name, or (for a deleted or renamed-away
// custom character, or one made on another device) the name the session stored. Shown as plain text.
function characterName(entry) {
  const character = CHARACTERS.find((c) => c.id === entry.characterId) || customCharacterById(entry.characterId);
  if (character) return character.name;
  return typeof entry.characterName === "string" && entry.characterName ? entry.characterName : entry.characterId;
}

// "simple" / "advanced" as shown: "Simple" / "Advanced" in English.
function modeName(mode) {
  return t(`mode.${mode}`);
}

// ---------- charts ----------

// The charts are SVG text: every text that goes into it is escaped (translations could hold & or <).
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

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
    grid += `<text class="chart-label" x="${left - 6}" y="${y(percent) + 4}" text-anchor="end">${escapeHtml(t("history.percent", { percent }))}</text>`;
  }

  // Label every third week, ending with the current week.
  let labels = "";
  weeks.forEach((week, i) => {
    if ((weeks.length - 1 - i) % 3 === 0) {
      labels += `<text class="chart-label" x="${x(i)}" y="${height - 8}" text-anchor="middle">${escapeHtml(formatShortDate(week.start))}</text>`;
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
      `<title>${escapeHtml(t("history.focusPointTitle", { date: formatShortDate(week.start), percent: week.percent, sessions: counted("history.sessions", week.count) }))}</title></circle>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t("history.focusChartLabel", { count: weeks.length }))}">
    ${grid}${labels}
    <path class="chart-line" d="${path.trim()}"/>
    ${points}
  </svg>`;
}

// The y-axis of the time chart: minutes while the busiest week is under 2 hours, hours
// above that. The step is picked so there are at most 4 steps, and at least 2.
function timeScale(maxMs) {
  const maxMinutes = maxMs / 60000;
  const [unit, unitMinutes, steps] =
    maxMinutes < 120 ? ["minutes", 1, [5, 10, 15, 30]] : ["hours", 60, [1, 2, 5, 10, 20, 50, 100]];
  const max = maxMinutes / unitMinutes;
  const step = steps.find((s) => Math.ceil(max / s) <= 4) || steps[steps.length - 1];
  const stepCount = Math.max(2, Math.ceil(max / step));
  const ticks = [];
  const tickLabel = (value) => (unit === "minutes" ? t("time.min", { minutes: value }) : t("time.h", { hours: value }));
  for (let i = 0; i <= stepCount; i++) ticks.push({ ms: i * step * unitMinutes * 60000, label: tickLabel(i * step) });
  return { topMs: stepCount * step * unitMinutes * 60000, ticks };
}

// Bar chart of session time per week. The current week is full color, earlier weeks lighter.
// Weeks without sessions have no bar. Same size, labels and CSS classes as trendChartSvg.
function timeChartSvg(weeks) {
  const width = 400;
  const height = 210;
  const left = 52; // room for "120 min"
  const right = 26;
  const top = 12;
  const bottom = 30;
  const slot = (width - left - right) / weeks.length;
  const barWidth = slot * 0.6;
  const { topMs, ticks } = timeScale(Math.max(...weeks.map((week) => week.ms)));
  const y = (ms) => top + (height - top - bottom) * (1 - ms / topMs);
  const center = (i) => left + slot * (i + 0.5);

  let grid = "";
  for (const tick of ticks) {
    grid += `<line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(tick.ms)}" y2="${y(tick.ms)}"/>`;
    grid += `<text class="chart-label" x="${left - 6}" y="${y(tick.ms) + 4}" text-anchor="end">${escapeHtml(tick.label)}</text>`;
  }

  // Label every third week, ending with the current week.
  let labels = "";
  weeks.forEach((week, i) => {
    if ((weeks.length - 1 - i) % 3 === 0) {
      labels += `<text class="chart-label" x="${center(i)}" y="${height - 8}" text-anchor="middle">${escapeHtml(formatShortDate(week.start))}</text>`;
    }
  });

  let bars = "";
  weeks.forEach((week, i) => {
    if (week.ms === 0) return;
    // At least 2 px tall, so a single short session still shows up next to a long week.
    const h = Math.max(2, y(0) - y(week.ms));
    const x0 = center(i) - barWidth / 2;
    const y0 = y(0) - h;
    const r = Math.min(3, h / 2); // rounded top corners only
    const d =
      `M${x0} ${y(0)} V${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} H${x0 + barWidth - r} ` +
      `Q${x0 + barWidth} ${y0} ${x0 + barWidth} ${y0 + r} V${y(0)} Z`;
    const current = i === weeks.length - 1 ? " current" : "";
    bars +=
      `<path class="chart-bar${current}" d="${d}">` +
      `<title>${escapeHtml(t("history.timeBarTitle", { date: formatShortDate(week.start), time: formatTotalTime(week.ms), sessions: counted("history.sessions", week.count) }))}</title></path>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t("history.timeChartLabel", { count: weeks.length }))}">
    ${grid}${labels}
    ${bars}
  </svg>`;
}

// ---------- rendering ----------

function renderStreaks(history, now) {
  const { current, longest } = calcStreaks(history, now);
  document.getElementById("currentStreak").textContent = counted("history.days", current);
  document.getElementById("longestStreak").textContent = counted("history.days", longest);
}

function renderWeeklyTime(history, now) {
  const weeks = calcWeeklyTime(history, now);
  const chart = document.getElementById("timeChart");
  const note = document.getElementById("timeNote");

  if (weeks.every((week) => week.count === 0)) {
    chart.innerHTML = "";
    note.textContent = t("history.timeNone");
    return;
  }

  chart.innerHTML = timeChartSvg(weeks);
  const thisWeek = weeks[weeks.length - 1];
  note.textContent =
    thisWeek.count === 0
      ? t("history.timeNoneThisWeek")
      : t("history.timeThisWeek", { time: formatTotalTime(thisWeek.ms), sessions: counted("history.sessions", thisWeek.count) });
}

function renderTrend(history, now) {
  const weeks = calcWeeklyTrend(history, now);
  const chart = document.getElementById("trendChart");
  const note = document.getElementById("trendNote");

  if (weeks.every((week) => week.percent === null)) {
    chart.innerHTML = "";
    note.textContent = t("history.focusNone");
    return;
  }

  chart.innerHTML = trendChartSvg(weeks);
  const thisWeek = weeks[weeks.length - 1];
  note.textContent =
    thisWeek.percent === null
      ? t("history.focusNoneThisWeek")
      : t("history.focusThisWeek", { percent: thisWeek.percent, sessions: counted("history.sessions", thisWeek.count) });
}

function renderDayParts(history) {
  const parts = calcDayParts(history);
  const eligible = parts.filter((part) => part.count >= MIN_SESSIONS_FOR_BEST_TIME);
  // Highest %, and with a tie the one with more sessions behind it.
  const best = eligible.sort((a, b) => b.percent - a.percent || b.count - a.count)[0] || null;

  document.getElementById("bestTime").textContent = best
    ? t(`history.best.${best.id}`, { percent: best.percent })
    : t("history.bestNotEnough", { count: MIN_SESSIONS_FOR_BEST_TIME });

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
    item.querySelector("strong").textContent = t(`dayPart.${part.id}`);
    item.querySelector(".day-part-head .muted").textContent = part.hours;
    item.querySelector(".day-part-value").textContent = part.percent === null ? "—" : t("history.percent", { percent: part.percent });
    item.querySelector(".day-part-fill").style.width = `${part.percent || 0}%`;
    item.querySelector(".day-part-count").textContent =
      part.count >= MIN_SESSIONS_FOR_BEST_TIME
        ? counted("history.sessions", part.count)
        : t("history.dayPartNeeds", { sessions: counted("history.sessions", part.count), count: MIN_SESSIONS_FOR_BEST_TIME });
    list.append(item);
  }
}

// Picked categories across all sessions, as bars (same look as the time-of-day list).
// Distractions without a category (skipped picker, or logged before categories
// existed) are only counted in the note.
function renderCategories(history) {
  const distractions = history.flatMap((entry) => entry.distractions);
  const counts = countCategories(distractions);
  const picked = counts.reduce((sum, category) => sum + category.count, 0);
  const notPicked = distractions.length - picked;

  const note = document.getElementById("categoryNote");
  if (distractions.length === 0) {
    note.textContent = t("history.categoriesNone");
  } else if (picked === 0) {
    note.textContent = t("history.categoriesNotPicked");
  } else {
    note.textContent =
      t("history.categoriesBasedOn", { count: picked }) +
      (notPicked > 0 ? t("history.categoriesNoneHad", { count: notPicked }) : "");
  }

  const list = document.getElementById("categoryList");
  list.innerHTML = "";
  counts.forEach((category, i) => {
    const percent = Math.round((category.count / picked) * 100);
    const item = document.createElement("li");
    item.className = "day-part" + (i === 0 ? " best" : "");
    item.innerHTML = `
      <div class="day-part-head">
        <strong></strong>
        <span class="day-part-value"></span>
      </div>
      <div class="day-part-track"><div class="day-part-fill"></div></div>`;
    item.querySelector("strong").textContent = category.label;
    item.querySelector(".day-part-value").textContent = t("history.categoryValue", { count: category.count, percent });
    item.querySelector(".day-part-fill").style.width = `${percent}%`;
    list.append(item);
  });
}

function renderSessionList(history) {
  const recent = history.slice(0, LIST_SIZE);
  // No-break spaces in history.listLast: next to the Edit button at 320px the title wraps before
  // "sessions (of 40)", not inside the brackets.
  document.getElementById("listTitle").textContent =
    history.length > LIST_SIZE
      ? t("history.listLast", { size: LIST_SIZE, total: history.length })
      : counted("history.sessions", history.length);

  document.getElementById("editButton").textContent = t(editing ? "common.done" : "common.edit");
  const list = document.getElementById("sessionList");
  list.classList.toggle("editing", editing);
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
    item.querySelector("strong").textContent = characterName(entry);
    item.querySelector(".session-item-mode").textContent = `${modeName(entry.mode)} · ${styleLabel(entry.style)}`;
    if (entry.endedBy === "startOver") {
      const tag = document.createElement("span");
      tag.className = "session-tag";
      tag.textContent = t("history.restartedTag");
      tag.title = t("history.restartedTitle");
      item.querySelector(".session-item-mode").after(" ", tag);
    }
    item.querySelector(".session-item-meta").textContent = [
      formatSessionDate(entry.startedAt),
      formatSessionLength(entry),
      counted("history.distractions", entry.distractions.length),
    ].join(" · ");
    // Breaks (Stop → Take a break): one factual line, only when there were any. Whole minutes, at
    // least 1, like the session length above it.
    const pauses = cleanPauses(entry.pauses);
    if (pauses.length) {
      const line = document.createElement("div");
      line.className = "muted small session-item-pauses";
      line.textContent = formatPauses(pauses, (ms) => t("time.min", { minutes: Math.max(1, Math.round(ms / 60000)) }));
      item.querySelector(".session-item-meta").after(line);
    }

    const focus = item.querySelector(".session-item-focus");
    if (entry.focusPercent === null) {
      focus.textContent = "—";
      focus.title = t("history.noFocusTitle");
    } else {
      focus.textContent = t("history.percent", { percent: entry.focusPercent });
    }

    // On its own line under the row's text, so the text keeps its full width.
    if (editing) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn compact session-delete";
      button.textContent = t("common.delete");
      button.setAttribute(
        "aria-label",
        t("history.deleteLabel", { name: characterName(entry), date: formatDay(entry.startedAt), time: formatClockTime(entry.startedAt) })
      );
      button.dataset.startedAt = entry.startedAt;
      button.dataset.summary = formatSessionSummary(entry);
      item.append(button);
    }
    list.append(item);
  }
}

// Draws (or redraws, after an import or a delete) everything that depends on the history.
function render() {
  drawnFrom = historySource();
  renderPending = false;
  const history = loadHistory();
  const empty = history.length === 0;
  renderStorageNote();
  // "No finished sessions yet … Start one →" would be a promise this browser can't keep.
  document.getElementById("historyEmpty").hidden = !empty || !canSave;
  document.getElementById("historyContent").hidden = empty;
  document.getElementById("exportButton").disabled = empty;
  if (empty) {
    editing = false;
    return;
  }

  const now = Date.now();
  renderStreaks(history, now);
  renderWeeklyTime(history, now);
  renderTrend(history, now);
  renderDayParts(history);
  renderCategories(history);
  renderSessionList(history);
}

// "Your browser isn't letting this site save data": in place of the empty state, or above the
// sessions if some can still be read (e.g. storage that is full, not blocked). Only changes when
// canSave changed, and the text is set when it appears, so a screen reader reads it once.
function renderStorageNote() {
  const note = document.getElementById("historyStorageNote");
  if (note.hidden === canSave) return;
  note.textContent = canSave ? "" : t("storage.historyNote");
  note.hidden = canSave;
}

// What shows when there are no sessions: the empty state, or the storage note in its place.
function emptyPlace() {
  const empty = document.getElementById("historyEmpty");
  return empty.hidden ? document.getElementById("historyStorageNote") : empty;
}

// ---------- changes made elsewhere ----------

// The saved history as text, plus today's date: the streak and "this week" depend on the day too.
// Same text as last time: nothing to draw again.
function historySource() {
  let saved = null;
  try {
    saved = localStorage.getItem(HISTORY_KEY);
  } catch {
    // storage blocked: loadHistory sees an empty history, so does this
  }
  // The custom characters too: a rename or delete in another tab changes the names shown.
  return `${dayKey(new Date())}|${canSave}|${saved}|${readCustomRaw()}`;
}

// The page keeps showing what it drew, so it's drawn again when the history (or canSave) may have changed
// without this page: a session saved, deleted or imported in another tab (the storage event), a
// return from the back/forward cache (e.g. Android Back after a session on index.html), or the
// page being shown again (Android can freeze a background tab, so it may miss the storage event).
// Edit mode stays as it is, and so do the "Session deleted." and Backup lines.
function refreshInBackground() {
  if (document.getElementById("deleteDialog").open) {
    renderPending = true; // drawn when the dialog closes (confirmDelete)
    return;
  }
  if (historySource() === drawnFrom) return;
  redrawKeepingFocus(document.activeElement);
}

// render() replaces the list, so a focused Delete button is replaced too: focus goes to the new
// button of the same session, or to the one now at its place if that session is gone (see
// focusInList). Anything else focused stays, unless no sessions are left and it's hidden (Edit) or
// disabled (Export) now: then focus goes to the empty state (or the storage note in its place),
// which replaces the content.
function redrawKeepingFocus(focused) {
  const element = focused && focused !== document.body && focused.closest ? focused : null;
  const deleteButton = element ? element.closest(".session-delete") : null;
  const position = deleteButton ? deleteButtons().indexOf(deleteButton) : -1;
  render();
  const empty = emptyPlace();
  if (deleteButton) {
    focusInList(Number(deleteButton.dataset.startedAt), position);
  } else if (element && !empty.hidden && (element.closest("[hidden]") || element.disabled)) {
    empty.focus();
  }
}

// After the list is drawn again: the Delete button of the session that started at startedAt, or
// else the one now at position (the row that moved up into it, or the row above if it was the last
// one). With no sessions left the empty state replaces the list (render turns edit mode off then).
function focusInList(startedAt, position) {
  const buttons = editing ? deleteButtons() : [];
  const same = buttons.find((button) => Number(button.dataset.startedAt) === startedAt);
  if (same) {
    same.focus();
  } else if (buttons.length > 0) {
    buttons[Math.min(Math.max(position, 0), buttons.length - 1)].focus();
  } else {
    emptyPlace().focus();
  }
}

// ---------- deleting a session ----------

// Opens a <dialog> and resolves with the value of the button that closed it ("" for Esc / Back).
// Same as ask() in app.js, which this page doesn't load.
function ask(dialog) {
  return new Promise((resolve) => {
    dialog.returnValue = "";
    dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true });
    dialog.showModal();
  });
}

function deleteButtons() {
  return [...document.querySelectorAll("#sessionList .session-delete")];
}

// The text is cleared first and set a moment later, so screen readers read it out again even
// when it's the same as last time (two deletes in a row).
let deleteStatusTimer = null;

function showDeleteStatus(message, isError) {
  const status = document.getElementById("deleteStatus");
  clearTimeout(deleteStatusTimer);
  status.textContent = "";
  status.classList.toggle("error", isError);
  deleteStatusTimer = setTimeout(() => {
    status.textContent = message;
  }, 100);
}

function clearDeleteStatus() {
  clearTimeout(deleteStatusTimer);
  document.getElementById("deleteStatus").textContent = "";
}

function toggleEditing() {
  editing = !editing;
  if (!editing) clearDeleteStatus();
  render();
}

// Asks first; only "Delete" in the dialog deletes. The page's own copy of the history is never
// written back: deleteFromHistory reads the saved one again (see history-store.js).
// If the history changed in another tab while the dialog was open, the page is drawn again once,
// right after it closes, whatever the answer (a delete draws it anyway).
async function confirmDelete(button) {
  document.getElementById("deleteSummary").textContent = button.dataset.summary;
  const answer = await ask(document.getElementById("deleteDialog"));
  const startedAt = Number(button.dataset.startedAt);

  // "missing" (already deleted in another tab) needs no message of its own: it's gone either way.
  if (answer !== "delete" || deleteFromHistory(startedAt) === "failed") {
    if (answer === "delete") {
      showDeleteStatus(t("history.deleteFailed"), true);
    }
    const changed = renderPending && historySource() !== drawnFrom;
    renderPending = false;
    if (changed) redrawKeepingFocus(button); // its session's new button, or the one at its place
    else button.focus();
    return;
  }

  const position = deleteButtons().indexOf(button);
  render();
  showDeleteStatus(t("history.deleted"), false);
  // Focus stays at the same place in the list: the row that moved up into it, or the row above
  // if it was the last one. With no sessions left, the empty state replaces the list (render
  // turns edit mode off then, and leaves the hidden list as it was).
  focusInList(startedAt, position);
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
  showBackupStatus(t("import.exported", { count: data.sessions.length }), false);
}

async function importHistory(file) {
  if (file.size > IMPORT_MAX_BYTES) {
    showBackupStatus(t("import.tooBig"), true);
    return;
  }

  let sessions, invalidReasons;
  try {
    ({ sessions, invalidReasons } = parseHistoryExport(await file.text()));
  } catch (error) {
    // A problem with the file (a code from parseHistoryExport), or the browser couldn't read it.
    const key = `import.file.${error.message}`;
    showBackupStatus(I18N.has(key) ? t(key) : error.message, true);
    return;
  }

  const { added, skipped, droppedImported, removedExisting, saved } = mergeIntoHistory(sessions);
  if (!saved) {
    showBackupStatus(t("import.saveFailed"), true);
    return;
  }

  // The added parts start with their own space (in the language files).
  let message;
  if (added > 0) {
    message = t("import.imported", { count: added });
    if (skipped > 0) message += t("import.skipped", { count: skipped });
    if (droppedImported > 0) message += t("import.didNotFit", { count: droppedImported, max: HISTORY_LIMIT });
  } else if (droppedImported > 0) {
    message = t("import.allTooOld", { max: HISTORY_LIMIT });
  } else if (sessions.length === 0 && invalidReasons.length > 0) {
    message = t("import.nothing");
  } else {
    message = t(invalidReasons.length > 0 ? "import.nothingNewValid" : "import.nothingNew", { count: sessions.length });
  }
  if (invalidReasons.length > 0) message += invalidSummary(invalidReasons);
  if (removedExisting > 0) message += t("import.removed", { count: removedExisting, max: HISTORY_LIMIT });
  showBackupStatus(message, added === 0 && invalidReasons.length > 0);
  render();
}

// One line about the sessions skipped as invalid, e.g. " Skipped 3 invalid
// sessions (2 shorter than 1 minute, 1 bad focus %)." With one reason, no counts.
// reasons: codes from cleanImportedSession (import.reason.<code>).
function invalidSummary(reasons) {
  const reasonText = (code) => t(`import.reason.${code}`);
  const counts = new Map();
  for (const reason of reasons) counts.set(reason, (counts.get(reason) || 0) + 1);
  const why =
    counts.size === 1
      ? reasonText(reasons[0])
      : [...counts].map(([reason, count]) => t("import.reasonCount", { count, reason: reasonText(reason) })).join(t("common.listSeparator"));
  return t("import.invalid", { count: reasons.length, why });
}

// Shown again: site data may have been allowed or blocked meanwhile, and the history may have changed.
function recheckAndRefresh() {
  canSave = storageWorks();
  refreshInBackground();
}

// A row tapped in the language sheet (js/language-picker.js). js/i18n.js has already put the page's
// own text in the new language; everything drawn here is drawn again. Edit mode stays. The
// "Session deleted." and backup lines keep the language they were written in until the next
// message: they report something that already happened.
function onLanguageChange() {
  render();
}

function init() {
  document.addEventListener("ct:languagechange", onLanguageChange);
  initLanguagePicker();
  // The 7-day rule only applies in Safari on iPhone/iPad (see iosSafariNotInstalled in history-store.js).
  document.getElementById("iosStorageNote").hidden = !iosSafariNotInstalled();
  const fileInput = document.getElementById("importFile");
  document.getElementById("exportButton").addEventListener("click", exportHistory);
  document.getElementById("importButton").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    fileInput.value = ""; // so picking the same file again still triggers "change"
    if (file) importHistory(file);
  });
  document.getElementById("editButton").addEventListener("click", toggleEditing);
  document.getElementById("sessionList").addEventListener("click", (event) => {
    const button = event.target.closest(".session-delete");
    if (button) confirmDelete(button);
  });
  window.addEventListener("storage", (event) => {
    // null: all storage was cleared. CUSTOM_KEY: a custom character renamed or deleted elsewhere.
    if (event.key === HISTORY_KEY || event.key === CUSTOM_KEY || event.key === null) refreshInBackground();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) recheckAndRefresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) recheckAndRefresh();
  });
  canSave = storageWorks();
  render();
}

init();
