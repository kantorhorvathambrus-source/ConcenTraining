"use strict";

// History page: streaks, time per week, weekly focus trend, best time of day,
// distraction categories, recent sessions, and the time capsule (data and rules in js/capsules.js).
// Each session counts on the day it started, by the device's clock then (sessionDay, sessionHour and
// sessionClock in history-store.js), and every date and time shown comes from the same place.
// "Today" and "this week" are the device's current local date.

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

// Redraws the page just after the next local midnight, so a page left open over midnight shows the
// new day's streak and week (see scheduleMidnightRedraw).
let midnightTimer = 0;

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

// A day counts once it has at least one finished session (on the day it started, see sessionDay).
// Days are compared by their date (dayKey), never by time.
function calcStreaks(history, now) {
  const days = new Map();
  for (const entry of history) {
    const day = sessionDay(entry);
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

// The last TREND_WEEKS weeks, oldest first, each { start, entries }: start is its Monday, entries
// the sessions whose day (sessionDay) is in that week. Weeks are matched by the date of their
// Monday, never by time, so a session from Sunday 23:50 to Monday 00:15 stays in Sunday's week.
function sessionsByWeek(history, now) {
  const byMonday = new Map();
  for (const entry of history) {
    const key = dayKey(startOfWeek(sessionDay(entry)));
    if (!byMonday.has(key)) byMonday.set(key, []);
    byMonday.get(key).push(entry);
  }
  const thisWeek = startOfWeek(now);
  const weeks = [];
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    weeks.push({ start, entries: byMonday.get(dayKey(start)) || [] });
  }
  return weeks;
}

function calcWeeklyTrend(history, now) {
  return sessionsByWeek(history, now).map(({ start, entries }) => {
    const focus = combinedFocus(entries);
    return { start, percent: focus ? focus.percent : null, count: focus ? focus.count : 0 };
  });
}

// Session time per week, all modes: the sum of elapsedMs, so in Simple mode it
// includes the distractions. Same weeks as the focus trend (by the day a session counts on).
function calcWeeklyTime(history, now) {
  return sessionsByWeek(history, now).map(({ start, entries }) => ({
    start,
    ms: entries.reduce((sum, entry) => sum + entry.elapsedMs, 0),
    count: entries.length,
  }));
}

// By the hour on the device's clock when the session started (sessionHour).
function calcDayParts(history) {
  return DAY_PARTS.map((part) => {
    const focus = combinedFocus(history.filter((entry) => part.matches(sessionHour(entry))));
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

// A session's start date and time, as it counts (sessionClock in history-store.js): with a stored
// offset, the clock the device showed then, whatever timezone it's in now. timeZone is left out
// when it's undefined (the device's current timezone, for sessions without a stored offset).
function formatSessionClock(entry, options) {
  const { date, timeZone } = sessionClock(entry);
  return I18N.formatDate(date, timeZone ? { ...options, timeZone } : options);
}

// The weekday's length is the language's (weekday in js/i18n/languages.js): "Mon" / "hétfő".
function formatDay(entry) {
  return formatSessionClock(entry, { weekday: I18N.language().weekday || "short", day: "numeric", month: "short" });
}

function formatClockTime(entry) {
  return formatSessionClock(entry, { hour: "2-digit", minute: "2-digit" });
}

// "Mon 20 Oct · 14:05": the two Intl parts on one line (time.dateAndClock).
function formatSessionDate(entry) {
  return t("time.dateAndClock", { date: formatDay(entry), time: formatClockTime(entry) });
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
    formatSessionDate(entry),
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
      formatSessionDate(entry),
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
        t("history.deleteLabel", { name: characterName(entry), date: formatDay(entry), time: formatClockTime(entry) })
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
  renderPending = false;
  scheduleMidnightRedraw();
  const history = loadHistory();
  // Before the empty-history return: the time capsule shows with no sessions too. It can save
  // readyAt, so what the page was drawn from is taken after it. A capsule problem never stops the
  // rest of the page from being drawn.
  try {
    renderCapsules(history);
  } catch (error) {
    console.error(error);
  }
  drawnFrom = historySource();
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
  // And the time capsules: one sealed, opened or deleted in another tab shows up.
  return `${dayKey(new Date())}|${canSave}|${saved}|${readCustomRaw()}|${CAPSULES_ON ? readCapsulesRaw() : ""}`;
}

// "Today" changes at midnight, and with it the current streak and "this week". A page that stays
// open and visible gets no other event then, so a timer goes off once, 1 second after the next local
// midnight, and draws the page again through refreshInBackground (so not under an open Delete
// dialog, and only if the day really changed). Every draw sets it again; so does the timer itself,
// in case nothing was drawn (a timer that went off early, or the dialog was open). A timezone
// change or a sleeping phone can make it late or early: showing the page again (visibilitychange)
// checks the day anyway.
function scheduleMidnightRedraw() {
  clearTimeout(midnightTimer);
  const nextMidnight = addDays(startOfDay(Date.now()), 1);
  midnightTimer = setTimeout(() => {
    refreshInBackground();
    scheduleMidnightRedraw();
  }, nextMidnight.getTime() - Date.now() + 1000);
}

// The page keeps showing what it drew, so it's drawn again when the history (or canSave) may have changed
// without this page: a session saved, deleted or imported in another tab (the storage event), a
// return from the back/forward cache (e.g. Android Back after a session on index.html), or the
// page being shown again (Android can freeze a background tab, so it may miss the storage event).
// Edit mode stays as it is, and so do the "Session deleted." and Backup lines.
function refreshInBackground() {
  if (document.getElementById("deleteDialog").open || document.getElementById("capsuleDeleteDialog").open) {
    renderPending = true; // drawn when the dialog closes (confirmDelete, confirmCapsuleDelete)
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
  // A time capsule card, its message or one of its buttons: drawn again too (refocusCapsule).
  const capsuleElement = element ? element.closest("[data-capsule-id]") : null;
  render();
  const empty = emptyPlace();
  if (capsuleElement) {
    refocusCapsule(capsuleElement);
  } else if (element && element.id === "capsuleWrite" && element.disabled) {
    document.getElementById("capsuleTitle").focus(); // another tab sealed the third message
  } else if (deleteButton) {
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

// ---------- time capsule (data and rules: js/capsules.js) ----------

// How long the envelope takes to open (the CSS transition in the "envelope art" block of style.css).
const CAPSULE_OPEN_MS = 400;
// Opened on this page since it loaded: they stay at the top where they were opened, with the
// message showing, until the next visit (then they're under "Opened messages").
const openedThisVisit = new Set();
// The form: how the message opens ("date" or "time") and the picked time chip (ms, or null).
let capsuleOpensBy = "date";
let capsulePickedMs = null;
let capsulePickedDate = ""; // "YYYY-MM-DD" from the date sheet, or ""
// "Custom" (the time sheet): the amount set there (ms, or null) and whether it's the one picked.
let capsuleCustomMs = null;
let capsulePickedCustom = false;
let capsuleCountTimer = 0;
const capsuleStatusTimers = {};

const byId = (id) => document.getElementById(id);

// The history page's date format (weekday, day, month), with the year when it isn't this year:
// a message can open up to 2 years ahead.
function formatCapsuleDate(date) {
  const options = { weekday: I18N.language().weekday || "short", day: "numeric", month: "short" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return I18N.formatDate(date, options);
}

// Like formatTotalTime ("45 min", "1 h", "2 h 15 min"), but rounded UP to whole minutes, so a
// sealed message never says "0 min more".
function formatTimeLeft(ms) {
  const total = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return t("time.min", { minutes });
  return minutes ? t("time.hMin", { hours, minutes }) : t("time.h", { hours });
}

function capsuleChipLabel(ms) {
  return ms < 60 * 60 * 1000 ? t("capsule.chipMin", { minutes: ms / 60000 }) : t("capsule.chipHours", { hours: ms / 3600000 });
}

function writtenOpenedLine(capsule) {
  return t("capsule.writtenOpened", {
    written: formatCapsuleDate(new Date(capsule.createdAt)),
    opened: formatCapsuleDate(new Date(capsule.openedAt)),
  });
}

function capsuleButton(capsule, action, label, ariaLabel, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.dataset.capsuleId = capsule.id;
  button.dataset.action = action;
  return button;
}

// One card. kind: "sealed" (waiting), "ready" (Open), "openedHere" (opened on this visit, at the
// top) or "opened" (the Opened messages list). The message text is only ever added to an opened
// card, with textContent: a sealed message is never on the page, not even hidden.
function capsuleCard(capsule, kind, history) {
  const item = document.createElement("li");
  item.className = `capsule-card capsule-card-${kind}`;
  item.dataset.capsuleId = capsule.id;
  item.tabIndex = -1; // gets the focus after Seal
  const opened = kind === "openedHere" || kind === "opened";
  const art = document.createElement("div");
  art.className = "capsule-art-wrap";
  art.innerHTML = envelopeArt(opened ? "open" : kind); // fixed drawing, no text in it
  const body = document.createElement("div");
  body.className = "capsule-body";
  item.append(art, body);
  const line = (className, text) => {
    const p = document.createElement("p");
    p.className = className;
    p.textContent = text;
    body.append(p);
    return p;
  };
  const sealedOn = formatCapsuleDate(new Date(capsule.createdAt));

  if (kind === "sealed") {
    line("capsule-card-title", t("capsule.sealedOn", { date: sealedOn }));
    const left = capsuleMsLeft(capsule, history);
    line(
      "muted small",
      left === null
        ? t("capsule.opensOn", { date: formatCapsuleDate(dateFromKey(capsule.opensOn)) })
        : t("capsule.opensAfter", { time: formatTimeLeft(left) })
    );
    body.append(capsuleButton(capsule, "delete", t("common.delete"), t("capsule.deleteSealedLabel", { date: sealedOn }), "btn compact capsule-delete"));
    item.dataset.state = "sealed";
  } else if (kind === "ready") {
    line("capsule-card-title", t("capsule.fromPast"));
    line("muted small", t("capsule.sealedOn", { date: sealedOn }));
    body.append(capsuleButton(capsule, "open", t("capsule.open"), t("capsule.openLabel", { date: sealedOn }), "btn primary capsule-open"));
  } else {
    if (kind === "openedHere") line("capsule-card-title", t("capsule.fromPast"));
    line("muted small", writtenOpenedLine(capsule));
    const message = line("capsule-message", capsule.text);
    message.tabIndex = -1; // gets the focus after Open
    // Both opened kinds: the top card (opened on this visit) and the Opened messages list.
    body.append(capsuleButton(capsule, "delete", t("common.delete"), t("capsule.deleteOpenedLabel", { date: sealedOn }), "btn compact capsule-delete"));
    item.dataset.state = "opened";
  }
  return item;
}

function fillList(id, cards) {
  const list = byId(id);
  list.textContent = "";
  list.append(...cards);
}

// The ready strip at the top and the Time capsule section. Saves readyAt on every capsule that's
// ready for the first time (refreshCapsules; a failed write is silent). The form isn't touched,
// only its limits and the Seal button.
function renderCapsules(history) {
  const section = byId("capsules");
  const strip = byId("capsuleReady");
  section.hidden = !CAPSULES_ON;
  if (!CAPSULES_ON) {
    strip.hidden = true;
    return; // saved capsules are ignored but kept
  }
  const now = new Date();
  const list = refreshCapsules(history, now);
  // A message is never on the page twice: whatever has a card at the top is left out of the lists
  // below it (an opened one stays at the top for the rest of this visit).
  const ready = list.filter((c) => (isSealed(c) && isCapsuleReady(c, history, now)) || (!isSealed(c) && openedThisVisit.has(c.id)));
  const atTop = new Set(ready.map((c) => c.id));
  const waiting = list.filter((c) => !atTop.has(c.id) && isSealed(c));
  const opened = list
    .filter((c) => !atTop.has(c.id) && !isSealed(c))
    .sort((a, b) => b.openedAt - a.openedAt);

  fillList("capsuleReadyList", ready.map((c) => capsuleCard(c, isSealed(c) ? "ready" : "openedHere", history)));
  strip.hidden = ready.length === 0;
  fillList("capsuleSealedList", waiting.map((c) => capsuleCard(c, "sealed", history)));
  fillList("capsuleOpenedList", opened.map((c) => capsuleCard(c, "opened", history)));
  byId("capsuleOpenedPart").hidden = opened.length === 0;
  // Dev check: each message has one card.
  const drawn = [...document.querySelectorAll("li[data-capsule-id]")].map((li) => li.dataset.capsuleId);
  if (new Set(drawn).size !== drawn.length) console.error("[capsules] a message is drawn twice", drawn);

  const full = sealedCount(list) >= CAPSULE_SEALED_LIMIT;
  const write = byId("capsuleWrite");
  write.disabled = full;
  write.hidden = !byId("capsuleForm").hidden;
  const limit = byId("capsuleLimit");
  limit.textContent = t("capsule.limit", { count: CAPSULE_SEALED_LIMIT });
  limit.hidden = !full;

  updateCapsuleForm();
}

// What the form says the message opens on, or null.
function capsuleOpening() {
  if (capsuleOpensBy === "date") return capsulePickedDate ? { opensOn: capsulePickedDate } : null;
  return capsulePickedMs ? { opensAfterMs: capsulePickedMs } : null;
}

function capsuleCountText() {
  return t("capsule.count", { count: byId("capsuleText").value.length, max: CAPSULE_TEXT_MAX });
}

// The counter, the "Opens" choice and whether Seal can be tapped (text and opening both valid).
function updateCapsuleForm() {
  byId("capsuleCount").textContent = capsuleCountText();
  const byDate = capsuleOpensBy === "date";
  byId("capsuleByDate").setAttribute("aria-pressed", String(byDate));
  byId("capsuleByTime").setAttribute("aria-pressed", String(!byDate));
  byId("capsuleDatePart").hidden = !byDate;
  // "Pick a day", or the picked day with its weekday and always its year ("2026. dec. 24., csütörtök").
  byId("capsuleDate").textContent = capsulePickedDate
    ? I18N.formatDate(dateFromKey(capsulePickedDate), {
        weekday: I18N.language().weekday || "short", day: "numeric", month: "short", year: "numeric",
      })
    : t("capsule.pickDay");
  byId("capsuleTimePart").hidden = byDate;
  for (const chip of byId("capsuleTimePart").querySelectorAll(".chip")) {
    const custom = chip.dataset.custom === "true";
    chip.setAttribute("aria-pressed", String(custom ? capsulePickedCustom : !capsulePickedCustom && Number(chip.dataset.ms) === capsulePickedMs));
    // "Custom", or what was set there ("+7 h 30 min").
    if (custom) chip.textContent = capsuleCustomMs ? t("capsule.chipCustomValue", { time: formatTimeLeft(capsuleCustomMs) }) : t("capsule.chipCustom");
  }
  const text = cleanCapsuleText(byId("capsuleText").value);
  byId("capsuleSeal").disabled = !(isCapsuleText(text) && isValidOpening(capsuleOpening()));
}

// The time chips: built once (so a redraw never takes the focus away from one), relabelled when
// the language changes. "+1 min" only on the test sites (capsuleTimeChoices).
function buildCapsuleChips() {
  const part = byId("capsuleTimePart");
  part.textContent = "";
  for (const ms of capsuleTimeChoices()) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.ms = ms;
    chip.textContent = capsuleChipLabel(ms);
    chip.setAttribute("aria-pressed", "false");
    part.append(chip);
  }
  // "Custom": opens the time sheet (js/time-sheet.js); its label is set by updateCapsuleForm.
  const custom = document.createElement("button");
  custom.type = "button";
  custom.className = "chip capsule-chip-custom";
  custom.dataset.custom = "true";
  custom.setAttribute("aria-haspopup", "dialog");
  custom.setAttribute("aria-pressed", "false");
  custom.textContent = t("capsule.chipCustom");
  part.append(custom);
}

function relabelCapsuleChips() {
  for (const chip of byId("capsuleTimePart").querySelectorAll(".chip:not([data-custom])")) {
    chip.textContent = capsuleChipLabel(Number(chip.dataset.ms));
  }
}

function clearCapsuleError() {
  const error = byId("capsuleError");
  error.textContent = "";
  error.hidden = true;
}

function showCapsuleError(message) {
  const error = byId("capsuleError");
  error.textContent = message;
  error.hidden = false;
}

function resetCapsuleForm() {
  byId("capsuleText").value = "";
  capsulePickedDate = "";
  capsuleOpensBy = "date";
  capsulePickedMs = null;
  capsuleCustomMs = null;
  capsulePickedCustom = false;
  clearTimeout(capsuleCountTimer);
  byId("capsuleCountSpoken").textContent = "";
  clearCapsuleError();
  updateCapsuleForm();
}

function openCapsuleForm() {
  resetCapsuleForm();
  byId("capsuleForm").hidden = false;
  byId("capsuleWrite").hidden = true;
  byId("capsuleText").focus();
}

function closeCapsuleForm() {
  byId("capsuleForm").hidden = true;
  resetCapsuleForm();
  byId("capsuleWrite").hidden = false;
}

// Cancel: the form goes, and the focus goes back to Write (or the title, if Write is disabled
// because another tab sealed the third message meanwhile).
function cancelCapsuleForm() {
  closeCapsuleForm();
  const write = byId("capsuleWrite");
  (write.disabled ? byId("capsuleTitle") : write).focus();
}

// Seal it. A failed save, or the limit reached in another tab, keeps the form and its text as they
// are and says why. Otherwise the new sealed card gets the focus.
function submitCapsule(event) {
  event.preventDefault();
  const { status, capsule } = sealCapsule(byId("capsuleText").value, capsuleOpening());
  if (status === "invalid") {
    updateCapsuleForm();
    return;
  }
  if (status === "failed" || status === "limit") {
    showCapsuleError(status === "failed" ? t("capsule.saveError") : t("capsule.limit", { count: CAPSULE_SEALED_LIMIT }));
    if (status === "limit") render(); // shows the third message from the other tab
    return;
  }
  closeCapsuleForm();
  render();
  const card = document.querySelector(`#capsules [data-capsule-id="${capsule.id}"]`);
  (card || byId("capsuleTitle")).focus();
}

// The date sheet (js/date-sheet.js): tomorrow to 2 years ahead, from today's date. A picked day that
// has since become too early (the page stayed open over midnight) still fails isValidOpening, so
// Seal it stays disabled.
function openCapsuleDateSheet() {
  const { min, max } = capsuleDateRange();
  openDateSheet({
    title: t("capsule.pickDay"),
    min,
    max,
    value: capsulePickedDate,
    trigger: byId("capsuleDate"),
    onPick: (key) => {
      capsulePickedDate = key;
      updateCapsuleForm();
    },
  });
}

// The counter is read out once typing pauses, not on every key.
function onCapsuleInput() {
  updateCapsuleForm();
  clearTimeout(capsuleCountTimer);
  capsuleCountTimer = setTimeout(() => {
    byId("capsuleCountSpoken").textContent = capsuleCountText();
  }, 1000);
}

function pickCapsuleChip(event) {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  if (chip.dataset.custom === "true") {
    openCapsuleTimeSheet(chip);
    return;
  }
  capsulePickedMs = Number(chip.dataset.ms);
  capsulePickedCustom = false;
  updateCapsuleForm();
}

// "Custom": any whole number of minutes from 15 min to 999 h (CAPSULE_CUSTOM_MIN_MS / _MAX_MS in
// capsules.js). Opens with what was set there before, else the picked hour chip, else 1 h. Set
// selects the Custom chip, even when the amount equals an hour chip; closing without Set changes
// nothing.
function openCapsuleTimeSheet(chip) {
  const picked = capsulePickedMs >= CAPSULE_CUSTOM_MIN_MS ? capsulePickedMs : 60 * 60 * 1000;
  openTimeSheet({
    title: t("timeSheet.title"),
    minMs: CAPSULE_CUSTOM_MIN_MS,
    maxMs: CAPSULE_CUSTOM_MAX_MS,
    valueMs: capsuleCustomMs || picked,
    trigger: chip,
    onPick: (ms) => {
      capsuleCustomMs = ms;
      capsulePickedMs = ms;
      capsulePickedCustom = true;
      updateCapsuleForm();
    },
  });
}

function setCapsuleOpensBy(by) {
  capsuleOpensBy = by;
  updateCapsuleForm();
}

// A status line like "Session deleted.": cleared first and set a moment later, so a screen reader
// reads it again even when it's the same text.
function showCapsuleStatus(id, message, isError) {
  const status = byId(id);
  clearTimeout(capsuleStatusTimers[id]);
  status.textContent = "";
  status.classList.toggle("error", isError);
  capsuleStatusTimers[id] = setTimeout(() => {
    status.textContent = message;
  }, 100);
}

// Open: openedAt is saved first (the first tab's stays), then the flap folds open (about 400 ms,
// none with reduced motion) and the message shows in place and gets the focus. If the browser
// refuses the change, the message stays sealed and a line says so.
function openReadyCapsule(button) {
  const card = button.closest(".capsule-card");
  if (!card || card.classList.contains("opening")) return;
  const id = button.dataset.capsuleId;
  const { status } = openCapsule(id);
  if (status === "failed") {
    showCapsuleStatus("capsuleReadyStatus", t("capsule.openFailed"), true);
    return;
  }
  if (status === "missing") {
    redrawKeepingFocus(button); // deleted in another tab
    return;
  }
  openedThisVisit.add(id);
  const show = () => {
    render();
    const message = document.querySelector(`#capsuleReadyList [data-capsule-id="${id}"] .capsule-message`);
    (message || byId("capsuleTitle")).focus();
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    show();
    return;
  }
  card.classList.add("opening");
  button.setAttribute("aria-disabled", "true");
  setTimeout(show, CAPSULE_OPEN_MS);
}

// The same card's same button again after a redraw, or the card itself, or (if it's gone) the
// section title.
function refocusCapsule(element) {
  const id = element.closest("[data-capsule-id]").dataset.capsuleId;
  const action = element.dataset.action;
  const target =
    (action && document.querySelector(`[data-capsule-id="${id}"][data-action="${action}"]`)) ||
    (element.classList.contains("capsule-message") && document.querySelector(`[data-capsule-id="${id}"] .capsule-message`)) ||
    document.querySelector(`li[data-capsule-id="${id}"]`);
  (target || byId("capsuleTitle")).focus();
}

// Delete (sealed: "It will be deleted without being opened…"; opened: "This can't be undone.").
// Like the session dialog: Cancel first, Esc / Back = Cancel, the saved list is read again right
// before the change, and a redraw that came in while it was open happens once it closes.
async function confirmCapsuleDelete(button) {
  const sealed = button.closest("[data-state]").dataset.state === "sealed";
  byId("capsuleDeleteText").textContent = t(sealed ? "capsule.deleteSealedText" : "capsule.deleteOpenedText");
  const answer = await ask(byId("capsuleDeleteDialog"));
  const id = button.dataset.capsuleId;
  const result = answer === "delete" ? deleteCapsule(id) : "";
  if (result === "failed") showCapsuleStatus("capsuleStatus", t("capsule.deleteFailed"), true);
  if (result !== "deleted" && result !== "missing") {
    const changed = renderPending && historySource() !== drawnFrom;
    renderPending = false;
    if (changed) redrawKeepingFocus(button);
    else button.focus();
    return;
  }
  const listId = button.closest("ul").id;
  openedThisVisit.delete(id);
  // From the top card (opened on this visit): the card goes, and the focus goes to the section title.
  if (listId === "capsuleReadyList") {
    render();
    showCapsuleStatus("capsuleStatus", t("capsule.deleted"), false);
    byId("capsuleTitle").focus();
    return;
  }
  // The next Delete button in the same list (the one above if it was the last), else Write.
  const position = [...byId(listId).querySelectorAll(".capsule-delete")].indexOf(button);
  render();
  showCapsuleStatus("capsuleStatus", t("capsule.deleted"), false);
  const buttons = [...byId(listId).querySelectorAll(".capsule-delete")];
  const write = byId("capsuleWrite");
  if (buttons.length) buttons[Math.min(Math.max(position, 0), buttons.length - 1)].focus();
  else (write.hidden || write.disabled ? byId("capsuleTitle") : write).focus();
}

function initCapsules() {
  if (!CAPSULES_ON) return;
  buildCapsuleChips();
  byId("capsuleWrite").addEventListener("click", openCapsuleForm);
  byId("capsuleCancel").addEventListener("click", cancelCapsuleForm);
  byId("capsuleForm").addEventListener("submit", submitCapsule);
  byId("capsuleText").addEventListener("input", onCapsuleInput);
  byId("capsuleDate").addEventListener("click", openCapsuleDateSheet);
  byId("capsuleByDate").addEventListener("click", () => setCapsuleOpensBy("date"));
  byId("capsuleByTime").addEventListener("click", () => setCapsuleOpensBy("time"));
  byId("capsuleTimePart").addEventListener("click", pickCapsuleChip);
  byId("capsuleReadyList").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="open"]');
    if (button) openReadyCapsule(button);
  });
  for (const id of ["capsuleReadyList", "capsuleSealedList", "capsuleOpenedList"]) {
    byId(id).addEventListener("click", (event) => {
      const button = event.target.closest('[data-action="delete"]');
      if (button) confirmCapsuleDelete(button);
    });
  }
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
  if (CAPSULES_ON) relabelCapsuleChips();
  render(); // also the capsule counter (updateCapsuleForm)
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
    // CAPSULES_KEY: a time capsule sealed, opened or deleted elsewhere.
    if (event.key === HISTORY_KEY || event.key === CUSTOM_KEY || event.key === CAPSULES_KEY || event.key === null) {
      refreshInBackground();
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) recheckAndRefresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) recheckAndRefresh();
  });
  initCapsules();
  canSave = storageWorks();
  render();
}

init();
