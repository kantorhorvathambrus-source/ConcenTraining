"use strict";

// Inner weather: after a session the user can mark, optionally, how it felt inside, as weather
// (see "Inner weather" in the README). It records a feeling, not performance: no mood is better than
// another, and a mood never changes a result, a number, a message or a pose.
// Loaded by index.html (the question on the summary, drawn by app.js) and history.html (the icon in
// the session list and the "Inner weather" strip, drawn by history.js), after js/history-store.js.
// It only relies on history-store.js (HISTORY_KEY, sessionDay) and the i18n files (t), never on
// history.js or app.js, and it touches no DOM when it loads.
//
// Saved data:
//   ct_moods_v1 = { v: 1, moods: { "<startedAt>": "<mood id>" } }
//   The key is a history entry's startedAt (the session's id), the value one of MOOD_IDS.
// Reading never throws: unknown ids and broken entries are skipped, not the whole list. Every write
// reads the saved moods fresh first, so another tab's pick is never lost, and drops the moods whose
// session is no longer in the history, so the key can't grow forever.
// Not in the history export yet: imported sessions have no mood.

const MOOD_KEY = "ct_moods_v1";

// The moods: six steps of one scale, from easy to hard, in the order they're offered (left to right
// on the summary). Each has a name (i18n key mood.<id>, "Rainy") and a short meaning
// (mood.meaning.<id>, "it was hard going"), shown together as "Rainy: it was hard going" (moodText).
// An id saved by an earlier test build that isn't here any more ("fog") is skipped as unknown.
const MOOD_IDS = ["sunny", "partly", "cloudy", "drizzle", "rain", "storm"];

// The switch for the whole feature. It is true: Inner weather is on in production
// (https://concentraining.com) and on the GitHub Pages backup. Setting it to false turns it off
// there: no question on the summary, no setup checkbox, nothing on the history page, and saved
// moods are ignored but kept (nothing reads or writes them). The test sites below keep it on.
const MOOD_ENABLED = true;

// Netlify's test sites and a local copy always have Inner weather on, whatever the switch says:
// Deploy Previews (deploy-preview-80--concentraining.netlify.app), the main branch deploy
// (main--concentraining.netlify.app), localhost and 127.0.0.1. Same rule as PLANS_TEST_SITE.
const MOOD_TEST_SITE = (() => {
  try {
    const host = location.hostname;
    return host.startsWith("deploy-preview-") || host.startsWith("main--") || host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
})();

// Whether Inner weather is on in this page: every check uses this.
const MOOD_ON = MOOD_ENABLED || MOOD_TEST_SITE;

// "Rainy: it was hard going": a mood's name and meaning, as every screen shows and reads it (the
// summary's line and buttons, the history page's icons and strip).
function moodText(id) {
  return t("mood.nameMeaning", { name: t(`mood.${id}`), meaning: t(`mood.meaning.${id}`) });
}

// ---------- reading ----------

const isMoodId = (value) => typeof value === "string" && MOOD_IDS.includes(value);

// A history entry's startedAt as it's written in the key: a whole, positive number.
const isMoodKey = (key) => /^[1-9]\d{0,15}$/.test(key);

// The saved text (null if nothing is saved or storage is blocked): history.js compares it to know
// whether the page must be drawn again.
function readMoodsRaw() {
  try {
    return localStorage.getItem(MOOD_KEY);
  } catch {
    return null;
  }
}

// The saved moods as a Map of startedAt (a number) → mood id. Never throws: anything broken is
// skipped.
function loadMoods() {
  const moods = new Map();
  let parsed = null;
  try {
    parsed = JSON.parse(readMoodsRaw());
  } catch {
    return moods;
  }
  if (!parsed || typeof parsed !== "object" || !parsed.moods || typeof parsed.moods !== "object") return moods;
  for (const [key, id] of Object.entries(parsed.moods)) {
    if (isMoodKey(key) && isMoodId(id)) moods.set(Number(key), id);
  }
  return moods;
}

// The startedAt of every session in the history, or null if the history couldn't be read (broken
// JSON, storage blocked). null means "don't know": then no mood is dropped, so one bad read can't
// wipe them all. No history saved at all is an empty history: every mood is dropped then.
function historyStartTimes() {
  let raw;
  try {
    raw = localStorage.getItem(HISTORY_KEY);
  } catch {
    return null;
  }
  if (raw === null) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((entry) => entry && Number.isFinite(entry.startedAt)).map((entry) => entry.startedAt));
  } catch {
    return null;
  }
}

// ---------- writing ----------

// The one way moods are written. Reads the saved moods fresh, gives each startedAt in startedAts
// the mood id (or removes its mood when id is null), drops the moods whose session is no longer in
// the history, and writes. Returns false when the write failed (storage blocked or full), or when
// a mood was to be set and none of its sessions is in the history any more (deleted in another
// tab): the caller then keeps showing what was there before.
function setMood(startedAts, id) {
  if (id !== null && !isMoodId(id)) return false;
  const moods = loadMoods();
  for (const startedAt of startedAts) {
    if (id === null) moods.delete(startedAt);
    else moods.set(startedAt, id);
  }
  const inHistory = historyStartTimes();
  if (inHistory) {
    for (const startedAt of [...moods.keys()]) {
      if (!inHistory.has(startedAt)) moods.delete(startedAt);
    }
    if (id !== null && !startedAts.some((startedAt) => inHistory.has(startedAt))) return false;
  }
  const saved = {};
  for (const [startedAt, moodId] of moods) saved[String(startedAt)] = moodId;
  try {
    localStorage.setItem(MOOD_KEY, JSON.stringify({ v: 1, moods: saved }));
    return true;
  } catch {
    return false;
  }
}

// A session deleted on the history page: its mood goes too. Returns what setMood returns.
function removeMood(startedAt) {
  return setMood([startedAt], null);
}

// ---------- the 7-day strip ----------

// The last 7 local days, oldest first (today last): { day (a Date at local midnight), mood (an id,
// or null when no session of that day has one) }. A session counts on its sessionDay. The day's
// mood is its most frequent one; a tie goes to the mood of the latest session among the tied ones.
function weekMoods(history, moods, now = new Date()) {
  const key = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const days = [];
  for (let back = 6; back >= 0; back--) {
    days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back));
  }
  const byDay = new Map(days.map((day) => [key(day), new Map()])); // day → mood → { count, latest }
  for (const entry of history) {
    if (!entry || !Number.isFinite(entry.startedAt)) continue;
    const id = moods.get(entry.startedAt);
    if (!id) continue;
    let day;
    try {
      day = byDay.get(key(sessionDay(entry)));
    } catch {
      continue; // a broken entry counts nothing
    }
    if (!day) continue;
    const seen = day.get(id) || { count: 0, latest: -Infinity };
    seen.count += 1;
    seen.latest = Math.max(seen.latest, entry.startedAt);
    day.set(id, seen);
  }
  return days.map((day) => {
    let best = null;
    for (const [id, seen] of byDay.get(key(day))) {
      if (!best || seen.count > best.count || (seen.count === best.count && seen.latest > best.latest)) {
        best = { id, count: seen.count, latest: seen.latest };
      }
    }
    return { day, mood: best ? best.id : null };
  });
}

// ===== MOOD ART (placeholder, to be replaced by real artwork) =====
// Everything the mood icons look like is here and in the "mood art" block of css/style.css
// (classes .mood-art*). To use images instead, return e.g. <img class="mood-art" src="…" alt="">
// for each id and replace that CSS block; nothing else depends on the drawing. Purely decorative:
// aria-hidden, the button or label next to it says which mood it is. id null: the empty dot of a day
// without a mood.
const MOOD_CLOUD = "M17 35 H45 A9 9 0 0 0 44 17 A12 12 0 0 0 21 19 A8 8 0 0 0 17 35 Z";
const MOOD_SMALL_CLOUD = "M23 39 H47 A8 8 0 0 0 46 23 A10.5 10.5 0 0 0 26 25 A7 7 0 0 0 23 39 Z";

function moodArt(id) {
  const parts = {
    sunny: `<circle class="mood-art-sun" cx="28" cy="24" r="9"/>
      <path class="mood-art-rays" d="M28 6 V10 M28 38 V42 M10 24 H14 M42 24 H46 M15.3 11.3 L18.1 14.1 M37.9 33.9 L40.7 36.7 M15.3 36.7 L18.1 33.9 M37.9 14.1 L40.7 11.3"/>`,
    partly: `<circle class="mood-art-sun" cx="20" cy="18" r="8"/>
      <path class="mood-art-rays" d="M20 3 V6 M5 18 H8 M9.4 7.4 L11.5 9.5 M30.6 7.4 L28.5 9.5 M9.4 28.6 L11.5 26.5"/>
      <path class="mood-art-cloud" d="${MOOD_SMALL_CLOUD}"/>`,
    cloudy: `<g transform="translate(-6 0)">
      <path class="mood-art-cloud mood-art-cloud-back" d="M27 27 H47 A7 7 0 0 0 46 13 A9 9 0 0 0 29 14 A6 6 0 0 0 27 27 Z"/>
      <path class="mood-art-cloud" d="${MOOD_SMALL_CLOUD}"/></g>`,
    drizzle: `<path class="mood-art-cloud" d="${MOOD_CLOUD}"/>
      <path class="mood-art-drizzle" d="M21 41 L20.4 43 M31 41 L30.4 43 M26 46 L25.4 48 M36 46 L35.4 48"/>`,
    rain: `<path class="mood-art-cloud" d="${MOOD_CLOUD}"/>
      <path class="mood-art-rain" d="M19 39 L16.5 47 M27 39 L24.5 47 M35 39 L32.5 47 M43 39 L40.5 47"/>`,
    storm: `<path class="mood-art-cloud mood-art-cloud-dark" d="${MOOD_CLOUD}"/>
      <path class="mood-art-bolt" d="M30 33 L24 42 H29 L26 49 L35 38 H30 L33 33 Z"/>`,
  };
  const inner = parts[id] || `<circle class="mood-art-empty" cx="28" cy="26" r="5"/>`;
  return `<svg class="mood-art${id ? "" : " mood-art-none"}" viewBox="0 0 56 52" aria-hidden="true" focusable="false">${inner}</svg>`;
}
// ===== END MOOD ART =====
