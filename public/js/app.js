"use strict";

const MIN = 60 * 1000;
const SESSION_KEY = "ct_session_v1";
const PREFS_KEY = "ct_prefs_v1";
const BASE_TITLE = "ConcenTraining";

const GOOD_EVERY_MS = 5 * MIN; // show the "doing well" pose after this much undistracted time
// How long the "doing well" pose plays. It isn't started when less than this is left of the
// session, so it never lands on the end (e.g. at 5:00 of a 5 min session) or gets cut off by it.
const GOOD_REACTION_MS = 3000;
const PICKER_DELAY_MS = 1400; // let the reaction play before asking what caused the distraction
// After every distraction reaction, the "refocus" pose ("OK, back to work") shows for this
// long before the normal pose, so admitting a distraction ends with a push back to work.
const REFOCUS_MS = 2500;
// The category picker stays open until a category or Skip is tapped. If neither happens
// (e.g. the phone was put down), it closes silently after this long, so it doesn't stay up
// for the rest of the session or hold back the continue/restart question forever.
const PICKER_AUTO_CLOSE_MS = 60 * 1000;
const UNDO_WINDOW_MS = 5000; // after a distraction tap, Undo takes End session's place for this long
// Page hidden (another app, another tab, locked screen) for at least this long during a session:
// on return the app asks whether it was a distraction. Shorter absences are ignored.
// AWAY_MIN_MS is in history-store.js, because imports check away distractions against it.
const AWAY_ASK_AFTER_MS = AWAY_MIN_MS;
const DURATION_PRESETS = [5, 10, 15, 25, 35, 45, 60, 90];
const MAX_MINUTES = 240;
const DEFAULT_MINUTES = 25;
// The timer can run out while the page is closed or the phone is locked. If the app
// gets control back later than this after the end, it asks before saving the session.
const REOPEN_ASK_AFTER_MS = 30 * MIN;
// The chime plays only if the end is seen as it happens: within this long of the end time.
// A hidden tab gets longer, because browsers run its timers late (Chrome: up to 1 minute).
const END_SOUND_VISIBLE_MS = 5 * 1000;
const END_SOUND_HIDDEN_MS = 75 * 1000;
const CHIME_NOTES = [659.25, 783.99, 1046.5]; // E5, G5, C6, rising
const CHIME_GAP_S = 0.18; // between note starts
const CHIME_NOTE_S = 0.75; // each note fades out over this long
const CHIME_VOLUME = 0.25; // 1 = full scale
const END_VIBRATION = [150, 80, 150]; // ms on, off, on (Android; iOS ignores it)

// Summary screen pose for each session result (see sessionResult in history-store.js).
// early: neutral, never the proud "good" pose and never the "rough" one.
const SUMMARY_POSES = {
  kind: { great: "good", okay: "level2", rough: "level4", early: "initial", short: "initial" }, // proud / pleased / gently encouraging / calm
  firm: { great: "good", okay: "level1", rough: "level3", early: "level1", short: "initial" }, // approving / eyebrow raised / serious / eyebrow raised
  strict: { great: "good", okay: "initial", rough: "level2", early: "level1", short: "initial" }, // satisfied / neutral / disappointed / stern
  ragebait: { great: "good", okay: "level1", rough: "level4", early: "level1", short: "initial" }, // grudging / smirking / mocking / side-eye
};

// Simple mode: severity only, no time. Level = which reaction pose to show (1-5).
const SIMPLE_OPTIONS = [
  { label: "Very briefly", level: 1 },
  { label: "Briefly", level: 2 },
  { label: "Moderately", level: 3 },
  { label: "A lot", level: 4 },
  { label: "A whole lot", level: 5, askRestart: true },
];

// Advanced mode: distraction length. "10+ min" counts as 10 minutes in the focus %.
// A length longer than the free time so far is disabled (see updateLengthButtons),
// except "30 sec" (alwaysEnabled), so the row isn't all grey at the start.
const ADVANCED_OPTIONS = [
  { label: "30 sec", ms: 30 * 1000, level: 1, alwaysEnabled: true },
  { label: "1 min", ms: 1 * MIN, level: 2 },
  { label: "2 min", ms: 2 * MIN, level: 3 },
  { label: "3 min", ms: 3 * MIN, level: 3 },
  { label: "5 min", ms: 5 * MIN, level: 4 },
  { label: "10 min", ms: 10 * MIN, level: 4 },
  { label: "10+ min", ms: 10 * MIN, level: 5, askRestart: true },
];

const $ = (selector) => document.querySelector(selector);

// ---------- storage (localStorage can throw in private mode, so wrap it) ----------

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not critical: the app still works, it just won't remember.
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Popularity stats: one count per session started with Start session, finished or not.
// Browsing the cards, a cancelled ragebait warning, Start over and a restored session don't count.
// Sent to the Netlify Function in netlify/functions/picks.mjs. Fire-and-forget: if it fails
// (offline, index.html opened as a local file, or the GitHub Pages test site, which has no
// backend) the app works the same. Relative address, so it stays inside the app's own folder.
function countCharacterPick(id) {
  fetch("api/picks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ characterId: id }),
    keepalive: true,
  }).catch(() => {});
}

// ---------- state ----------

// endSound / keepScreenOn: the setup checkboxes. homeScreenTipDismissed: "Got it" was tapped on the
// iPhone Home Screen tip. persistRequested: persistent storage was asked for (or skipped, in Firefox).
// howItWorksDismissed: "Got it" was tapped on the How it works card.
// Prefs saved before any of these existed get these defaults.
const prefs = Object.assign(
  {
    characterId: null, mode: "simple", minutes: 25, endSound: true, keepScreenOn: true,
    homeScreenTipDismissed: false, persistRequested: false, howItWorksDismissed: false,
  },
  load(PREFS_KEY, {}),
);
delete prefs.style; // saved before personalities came from the character; dropped on the next save
// style: the character's personality when the session ran ("kind", "firm", "strict" or "ragebait")
// restartPending: "A whole lot" / "10+ min" was tapped and the continue/restart question
// hasn't been answered yet. Saved, so a reload still asks it.
// leftAt: set while the page is hidden, cleared on return (see "time away"). Saved, so a page the
// browser discarded in the background still asks after the reload. Never goes into the history.
let session = null; // { characterId, style, mode, durationMs, startedAt, distractions: [], endedAt, restartPending, leftAt }
let tickTimer = 0;
let nextGoodAt = 0;
// distraction: the one the open (or about to open) picker belongs to.
// If session.restartPending is set, the continue/restart dialog opens as soon as
// the picker is closed and the Undo window is over. They never show at the same time.
// closesAt: when the open picker's safety close (PICKER_AUTO_CLOSE_MS) is due.
const picker = { distraction: null, showTimer: 0, hideTimer: 0, closesAt: 0 };
// distraction: the latest one, while its Undo window is open. prevNextGoodAt: nextGoodAt
// before that tap. setRestart: that tap set session.restartPending (it wasn't set before).
const undo = { distraction: null, prevNextGoodAt: 0, setRestart: false, timer: 0 };
const motivation = { phase: null, index: 0, shown: false };
// from / ms: when the page was left and for how long (whole seconds) the card asks about, also
// while it waits for another dialog to close (ms 0: none). open: the card is on screen.
// yes: "Yes" was tapped, logged once the card has closed. hiddenAt: the latest time the page
// was hidden (in memory only).
const away = { from: 0, ms: 0, open: false, yes: false, hiddenAt: 0 };

function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || null;
}

function showScreen(id) {
  if (id === "setupScreen") {
    updateHowItWorks();
    updateHomeScreenTip();
  }
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.hidden = screen.id !== id;
  });
  window.scrollTo(0, 0);
  updateWakeLock();
}

// Opens a <dialog> and resolves with the value of the button that closed it ("" for Esc).
function ask(dialog) {
  return new Promise((resolve) => {
    dialog.returnValue = "";
    dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true });
    dialog.showModal();
  });
}

// ---------- character images ----------

function setPoseImage(img, character, pose) {
  const fallback = placeholderArt(character, pose);
  if (!character.artPath) {
    img.onerror = null;
    img.src = fallback;
    return;
  }
  img.onerror = () => {
    img.onerror = null;
    img.src = fallback;
  };
  img.src = `${character.artPath}/${pose}.${character.artExt || "png"}`;
}

function preloadArt(character) {
  if (!character.artPath) return;
  for (const pose of POSES) {
    new Image().src = `${character.artPath}/${pose}.${character.artExt || "png"}`;
  }
}

// ---------- reaction engine (shared by every character) ----------

const REACTION_CLASSES = ["react-1", "react-2", "react-3", "react-4", "react-5", "react-good", "react-refocus"];
const stage = { wrap: null, img: null, character: null, reacting: false, reactTimer: 0, blinkTimer: 0 };

function mountStage(character) {
  stopStage();
  const personality = personalityOf(character);
  stage.wrap = $("#sessionStage");
  stage.img = $("#sessionImg");
  stage.character = character;
  for (const name of ["kind", "firm", "strict", "ragebait"]) stage.wrap.classList.toggle(name, personality === name);
  stage.img.alt = character.name;
  preloadArt(character);
  setPose("initial");
  scheduleBlink();
}

function setPose(pose) {
  setPoseImage(stage.img, stage.character, pose);
}

// pose: "level1".."level5" or "good"; level: 1-5 for distraction reactions, 0 for "good".
// A distraction reaction has two steps: the reaction, then the refocus pose for REFOCUS_MS.
// Both run on stage.reactTimer, so a new reaction, Undo or the end of the session stops either.
function react(pose, level) {
  clearTimeout(stage.reactTimer);
  stage.reacting = true;
  setPose(pose);

  stage.wrap.classList.remove(...REACTION_CLASSES);
  void stage.wrap.offsetWidth; // restarts the CSS animation if the same class is added again
  stage.wrap.classList.add(level ? `react-${level}` : "react-good");

  stage.reactTimer = setTimeout(level ? refocus : endReaction, level ? 2500 + level * 500 : GOOD_REACTION_MS);
}

// Still counts as reacting: no blinks, and the "doing well" pose waits.
function refocus() {
  setPose("refocus");
  stage.wrap.classList.remove(...REACTION_CLASSES);
  stage.wrap.classList.add("react-refocus");
  stage.reactTimer = setTimeout(endReaction, REFOCUS_MS);
}

function endReaction() {
  stage.reacting = false;
  stage.wrap.classList.remove(...REACTION_CLASSES);
  setPose("initial");
}

function scheduleBlink() {
  stage.blinkTimer = setTimeout(() => {
    if (!stage.reacting) {
      setPose("blink");
      setTimeout(() => {
        if (!stage.reacting) setPose("initial");
      }, 160);
    }
    scheduleBlink();
  }, 2500 + Math.random() * 3500);
}

// Ends the reaction that's playing now (the pose is left as it is).
function stopReaction() {
  clearTimeout(stage.reactTimer);
  stage.reacting = false;
  if (stage.wrap) stage.wrap.classList.remove(...REACTION_CLASSES);
}

function stopStage() {
  stopReaction();
  clearTimeout(stage.blinkTimer);
}

// ---------- end-of-session chime ----------

let audioContext = null;

// Browsers only allow sound after a tap, so this runs on the Start tap and on every tap
// during a session. It only does something while the audio isn't running (first tap, or
// after a phone call or another app took the audio over). Returns the context, or null.
function unlockAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    if (!audioContext || audioContext.state === "closed") audioContext = new AudioCtx();
    if (audioContext.state !== "running") {
      audioContext.resume().catch(() => {});
      // iOS also wants something played inside the tap: one silent sample.
      const source = audioContext.createBufferSource();
      source.buffer = audioContext.createBuffer(1, 1, 22050);
      source.connect(audioContext.destination);
      source.start(0);
    }
  } catch {
    return null; // no sound, the app works the same
  }
  return audioContext;
}

// Three soft rising notes, about 1 second. Generated, no audio file.
// If the audio was taken over since the last tap, it's resumed first. If that takes
// more than a moment (or never happens), the chime is skipped rather than played late.
function playChime() {
  const ctx = unlockAudio();
  if (!ctx) return;
  const askedAt = Date.now();
  const play = () => {
    if (Date.now() - askedAt > 3000) return;
    const master = ctx.createGain();
    master.gain.value = CHIME_VOLUME;
    master.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.03;
    CHIME_NOTES.forEach((frequency, i) => {
      const start = t0 + i * CHIME_GAP_S;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(1, start + 0.012); // short fade-in, so no click
      gain.gain.exponentialRampToValueAtTime(0.0001, start + CHIME_NOTE_S);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + CHIME_NOTE_S + 0.05);
    });
  };
  if (ctx.state === "running") play();
  else Promise.resolve(ctx.resume()).then(play, () => {}); // old Safari's resume() returns nothing
}

// Time's up, seen as it happens: chime and a short vibration, if the setting is on.
// Nothing here may stop the session from finishing, so errors are swallowed.
function announceEnd() {
  if (!prefs.endSound) return;
  try {
    playChime();
  } catch {
    // no sound: fine
  }
  try {
    if (navigator.vibrate) navigator.vibrate(END_VIBRATION);
  } catch {
    // not supported: fine
  }
}

// ---------- keep the screen on (Screen Wake Lock API) ----------

const wakeLock = { sentinel: null, pending: false };

function wakeLockWanted() {
  return Boolean(
    prefs.keepScreenOn && session && !session.endedAt &&
    !$("#sessionScreen").hidden && document.visibilityState === "visible",
  );
}

// Holds the lock while a session is on screen, releases it everywhere else. Called on every
// screen change, when the page becomes visible again (the browser drops the lock while it's
// hidden) and on taps during a session (a reload may be refused until the first tap).
// Unsupported or refused: the session carries on without it (and the note below shows).
async function updateWakeLock() {
  if (!("wakeLock" in navigator)) {
    updateScreenNote();
    return;
  }
  if (!wakeLockWanted()) {
    releaseWakeLock();
    updateScreenNote();
    return;
  }
  if (wakeLock.sentinel || wakeLock.pending) return;
  wakeLock.pending = true;
  try {
    const sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      if (wakeLock.sentinel === sentinel) wakeLock.sentinel = null;
      updateScreenNote();
    });
    wakeLock.sentinel = sentinel;
  } catch {
    // refused (no tap yet, battery saver, ...): carry on without it
  }
  wakeLock.pending = false;
  if (!wakeLockWanted()) releaseWakeLock(); // the session ended while the request was out
  updateScreenNote();
}

// "Your screen may turn off" note: a turned-off screen pauses the page, so the chime can't play.
// Shown while a session is on screen with the chime on and the screen lock not held (setting
// off, unsupported, refused, or released and not taken back). While a request is out, or the
// page is hidden (the browser drops the lock then), it stays as it is, so it doesn't blink
// (and move the page) on every tap or return to the page.
function updateScreenNote() {
  const note = $("#screenNote");
  const running = Boolean(session && !session.endedAt && !$("#sessionScreen").hidden);
  if (!running || !prefs.endSound) {
    note.hidden = true;
    return;
  }
  if (wakeLock.pending || document.visibilityState !== "visible") return;
  note.hidden = Boolean(wakeLock.sentinel);
}

function releaseWakeLock() {
  const sentinel = wakeLock.sentinel;
  wakeLock.sentinel = null;
  if (sentinel) sentinel.release().catch(() => {});
}

// Every tap or key press while a session is running.
function onSessionInput() {
  if (!session || session.endedAt || $("#sessionScreen").hidden) return;
  if (prefs.endSound) unlockAudio();
  updateWakeLock();
}

// ---------- duration picker (used on setup and in the restart dialog) ----------

// Empty becomes 25, anything under 1 becomes 1, anything over 240 becomes 240.
function clampMinutes(value) {
  if (String(value).trim() === "") return DEFAULT_MINUTES;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(1, n));
}

// Builds preset chips + a custom number field. Returns a function that reads the value.
function durationPicker(container, initialMinutes) {
  container.innerHTML = "";

  const chips = document.createElement("div");
  chips.className = "chips";

  const custom = document.createElement("label");
  custom.className = "custom-minutes";
  custom.innerHTML = `Custom: <input type="number" min="1" max="${MAX_MINUTES}" inputmode="numeric"> min`;
  const input = custom.querySelector("input");

  const sync = () => {
    chips.querySelectorAll("button").forEach((chip) => {
      chip.setAttribute("aria-pressed", String(Number(chip.dataset.minutes) === Number(input.value)));
    });
  };

  for (const minutes of DURATION_PRESETS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.minutes = minutes;
    chip.textContent = `${minutes} min`;
    chip.addEventListener("click", () => {
      input.value = minutes;
      sync();
    });
    chips.append(chip);
  }

  input.value = initialMinutes;
  input.addEventListener("input", sync);
  // When the field is left, show the value that will really be used.
  input.addEventListener("change", () => {
    input.value = clampMinutes(input.value);
    sync();
  });
  // Inside a dialog form, Enter would press the first button ("Continue") by accident.
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  sync();

  container.append(chips, custom);
  return () => clampMinutes(input.value);
}

// ---------- setup screen ----------

let readSetupMinutes = () => prefs.minutes;

// Saves only the given fields on top of what's saved now, so a field another tab changed since
// this page loaded isn't undone. This page's copy fills in fields that were never saved, so the
// saved prefs stay complete. Only the given fields change in this page's copy: the others stay
// as this page shows them.
function savePrefs(changes) {
  Object.assign(prefs, changes);
  const next = Object.assign({}, prefs, load(PREFS_KEY, {}), changes);
  delete next.style; // see prefs above
  save(PREFS_KEY, next);
}

// Shown on the setup screen until "Got it" is tapped. The header button brings it back without
// changing the pref, so after that it only shows again when asked for.
function updateHowItWorks() {
  $("#howItWorks").hidden = prefs.howItWorksDismissed;
}

// Header button: show the card and move focus to its heading, so a screen reader reads it out.
function openHowItWorks() {
  $("#howItWorks").hidden = false;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("#howItWorks").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  $("#howItWorksTitle").focus({ preventScroll: true });
}

// Focus goes to the header button: the "Got it" button disappears, and that's where the card comes back from.
function dismissHowItWorks() {
  savePrefs({ howItWorksDismissed: true });
  $("#howItWorks").hidden = true;
  $("#howItWorksLink").focus();
}

// iPhone/iPad Safari only (see iosSafariNotInstalled in history-store.js), and only once
// there's at least one finished session to lose. "Got it" hides it for good.
function updateHomeScreenTip() {
  $("#homeScreenTip").hidden =
    prefs.homeScreenTipDismissed || !iosSafariNotInstalled() || loadHistory().length === 0;
}

function dismissHomeScreenTip() {
  savePrefs({ homeScreenTipDismissed: true });
  $("#homeScreenTip").hidden = true;
}

function renderCharacterList() {
  const list = $("#characterList");
  list.innerHTML = "";
  for (const character of CHARACTERS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "char-card";
    card.dataset.id = character.id;
    card.setAttribute("aria-pressed", String(prefs.characterId === character.id));
    card.innerHTML = `
      <img alt="">
      <span class="char-name">${character.name}</span>
      <span class="badge badge-${character.group}">${GROUPS[character.group].label}</span>
      <span class="char-tagline">${character.tagline}</span>`;
    setPoseImage(card.querySelector("img"), character, "initial");
    card.addEventListener("click", () => onCharacterTap(character));
    list.append(card);
  }
}

// Updates the selection in place: rebuilding the cards would move keyboard and screen reader
// focus away from the card that was just tapped.
function updateCharacterCards() {
  $("#characterList").querySelectorAll(".char-card").forEach((card) => {
    card.setAttribute("aria-pressed", String(card.dataset.id === prefs.characterId));
  });
}

async function onCharacterTap(character) {
  if (character.group === "ragebait" && prefs.characterId !== character.id) {
    $("#ragebaitText").textContent = `${character.name}: ${GROUPS.ragebait.warning}`;
    if ((await ask($("#ragebaitDialog"))) !== "ok") return;
  }

  savePrefs({ characterId: character.id });
  $("#characterError").hidden = true;
  updateCharacterCards();
}

function bindChoiceGroups() {
  document.querySelectorAll(".choice-group").forEach((group) => {
    const key = group.dataset.pref;
    const buttons = group.querySelectorAll(".choice");
    const sync = () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === prefs[key])));

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        savePrefs({ [key]: button.dataset.value });
        sync();
      });
    });
    sync();
  });
}

function bindSettingChecks() {
  document.querySelectorAll(".session-settings input[data-pref]").forEach((check) => {
    const key = check.dataset.pref;
    check.checked = Boolean(prefs[key]);
    check.addEventListener("change", () => {
      savePrefs({ [key]: check.checked });
    });
  });
  $("#testSoundButton").addEventListener("click", playChime);
}

async function onStartClick() {
  if (!characterById(prefs.characterId)) {
    const error = $("#characterError");
    error.hidden = false;
    error.textContent = "";
    error.textContent = "Pick a character first."; // re-set so screen readers announce it again on every tap
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    $("#characterStep").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    return;
  }
  savePrefs({ minutes: readSetupMinutes() });
  if (prefs.endSound) unlockAudio(); // this tap is what allows the chime later
  // A session saved by another tab is never replaced (see "one tab at a time"): it carries on here
  // if its tab was closed, or the notice shows if that tab still runs it. Without Web Locks the
  // tabs can't tell, so Start works as it always has.
  if (locks && savedRunningSession()) {
    continueSavedSession(false);
    return;
  }
  if (!(await takeControl(false))) {
    showScreen("elsewhereScreen");
    return;
  }
  if (session) return; // a quick second tap: already started
  countCharacterPick(prefs.characterId); // here, not in startSession(): Start over is not a new choice
  startSession(prefs.characterId, prefs.mode, prefs.minutes);
}

// ---------- session ----------

function startSession(characterId, mode, minutes) {
  session = {
    characterId,
    style: personalityOf(characterById(characterId)), // kept in the history
    mode,
    durationMs: minutes * MIN,
    startedAt: Date.now(),
    distractions: [],
    endedAt: null,
  };
  save(SESSION_KEY, session);
  enterSession();
}

function enterSession() {
  const character = characterById(session.characterId);
  const options = session.mode === "advanced" ? ADVANCED_OPTIONS : SIMPLE_OPTIONS;

  $("#sessionInfo").textContent =
    `${character.name} · ${styleLabel(session.style)} · ${capitalize(session.mode)} · ${Math.round(session.durationMs / MIN)} min`;
  $("#distractionPrompt").textContent =
    session.mode === "advanced" ? "Got distracted? For how long?" : "Got distracted? How much?";

  const buttons = $("#distractionButtons");
  buttons.innerHTML = "";
  buttons.classList.toggle("advanced", session.mode === "advanced");
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn level level-${option.level}`;
    button.textContent = option.label;
    button.addEventListener("click", () => logDistraction(option));
    buttons.append(button);
  }

  closePicker(false);
  closeUndo(false);
  Object.assign(away, { from: 0, ms: 0, open: false, yes: false, hiddenAt: 0 });
  motivation.phase = null;
  $("#motivationCard").hidden = true;
  nextGoodAt = Date.now() + GOOD_EVERY_MS;

  showScreen("sessionScreen");
  mountStage(character);

  clearInterval(tickTimer);
  tick();
  tickTimer = setInterval(tick, 500);
}

function tick() {
  if (!session || session.endedAt) return;
  const now = Date.now();
  const elapsed = Math.min(now - session.startedAt, session.durationMs);
  const remaining = session.durationMs - elapsed;

  const clock = formatClock(remaining);
  $("#timer").textContent = clock;
  $("#progressBar").style.width = `${(elapsed / session.durationMs) * 100}%`;
  document.title = `${clock} · ${BASE_TITLE}`;

  updateMotivationPhase(elapsed);
  updateLengthButtons();

  if (now >= nextGoodAt) {
    if (!stage.reacting && remaining >= GOOD_REACTION_MS) react("good", 0);
    nextGoodAt = now + GOOD_EVERY_MS;
  }

  if (remaining <= 0) onTimerRanOut(true);
}

function logDistraction(option) {
  if (!session || session.endedAt) return;
  const distraction = { at: Date.now(), level: option.level, ms: option.ms || 0, category: null };
  addDistraction(distraction, Boolean(option.askRestart));
  schedulePicker(distraction);
}

// Saves a distraction and plays its reaction, with Undo. askRestart: level 5, which asks
// continue or restart once the picker (if any) and the Undo window are over.
function addDistraction(distraction, askRestart) {
  const setRestart = askRestart && !session.restartPending;
  session.distractions.push(distraction);
  if (askRestart) session.restartPending = true;
  save(SESSION_KEY, session);

  openUndo(distraction, nextGoodAt, setRestart);
  nextGoodAt = Date.now() + GOOD_EVERY_MS;
  react(`level${distraction.level}`, distraction.level);
  updateLengthButtons();
}

// Advanced mode: a length longer than the free time (time so far minus the distraction
// time already logged) can't have happened, so its button is disabled. Simple mode has
// no lengths, so nothing changes there.
function updateLengthButtons() {
  if (!session || session.mode !== "advanced") return;
  const elapsed = Math.min(Date.now() - session.startedAt, session.durationMs);
  const logged = session.distractions.reduce((sum, d) => sum + (d.ms || 0), 0);
  const free = elapsed - logged;
  $("#distractionButtons").querySelectorAll("button").forEach((button, i) => {
    const option = ADVANCED_OPTIONS[i];
    button.disabled = !option.alwaysEnabled && option.ms > free;
  });
}

// ---------- undo ----------

// Undo only applies to the latest distraction: a newer tap moves it there and restarts the window.
function openUndo(distraction, prevNextGoodAt, setRestart) {
  closeUndo(false);
  Object.assign(undo, { distraction, prevNextGoodAt, setRestart });
  const button = $("#undoButton");
  void button.offsetWidth; // so showing it again restarts the countdown bar
  $("#endButton").hidden = true;
  button.hidden = false;
  undo.timer = setTimeout(() => closeUndo(true), UNDO_WINDOW_MS);
}

// thenAsk: open the continue/restart dialog now if one is waiting for the Undo window.
function closeUndo(thenAsk) {
  clearTimeout(undo.timer);
  undo.distraction = null;
  const button = $("#undoButton");
  const hadFocus = document.activeElement === button;
  button.hidden = true;
  $("#endButton").hidden = false;
  if (hadFocus) $("#endButton").focus(); // keyboard focus stays in the same spot
  if (thenAsk) askPendingRestart();
}

// Takes the latest distraction back as if it had never been tapped.
function onUndoClick() {
  const distraction = undo.distraction;
  if (!distraction || !session || session.endedAt) return;
  const index = session.distractions.indexOf(distraction);
  if (index !== -1) session.distractions.splice(index, 1);
  if (undo.setRestart) session.restartPending = false;
  save(SESSION_KEY, session);

  nextGoodAt = undo.prevNextGoodAt;
  stopReaction();
  setPose("initial");
  closePicker(false);
  updateLengthButtons();
  // An earlier "10+ min" / "A whole lot" that wasn't undone still asks, now.
  closeUndo(true);
}

// ---------- distraction category picker ----------

function buildCategoryButtons() {
  const buttons = $("#categoryButtons");
  for (const category of DISTRACTION_CATEGORIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = category.label;
    button.addEventListener("click", () => pickCategory(category.id));
    buttons.append(button);
  }
}

// A newer distraction replaces the picker of the previous one (which keeps category: null).
function schedulePicker(distraction) {
  closePicker(false);
  picker.distraction = distraction;
  picker.showTimer = setTimeout(() => showPicker(PICKER_AUTO_CLOSE_MS), PICKER_DELAY_MS);
}

function showPicker(closeInMs) {
  $("#categoryPicker").hidden = false;
  picker.closesAt = Date.now() + closeInMs;
  picker.hideTimer = setTimeout(() => closePicker(true), closeInMs);
}

// While End session's question is open, the picker's timers are stopped: its safety close
// would ask a waiting continue/restart question, which must not open on top of that dialog.
// The picker stays (behind the dialog, where it can't be tapped) and keeps its distraction,
// so a waiting continue/restart question keeps waiting for it, as before.
function pausePicker() {
  clearTimeout(picker.showTimer);
  clearTimeout(picker.hideTimer);
}

// After Keep going: the picker is back as it was, with the time it had left. If its safety
// close would have happened in the meantime, it closes now instead (category stays null).
function resumePicker() {
  if (!picker.distraction || !session || session.endedAt) return;
  if ($("#categoryPicker").hidden) showPicker(PICKER_AUTO_CLOSE_MS); // End was tapped before it appeared
  else if (Date.now() >= picker.closesAt) closePicker(false);
  else showPicker(picker.closesAt - Date.now());
}

function pickCategory(id) {
  if (picker.distraction && session && !session.endedAt) {
    picker.distraction.category = id;
    save(SESSION_KEY, session);
  }
  closePicker(true);
}

// Skip, and the silent auto-close, also end up here: the category stays null (never guessed).
// thenAsk: open the continue/restart dialog now if one is waiting for the picker.
function closePicker(thenAsk) {
  clearTimeout(picker.showTimer);
  clearTimeout(picker.hideTimer);
  $("#categoryPicker").hidden = true;
  picker.distraction = null;
  if (thenAsk) askPendingRestart();
}

// Waits while the category picker is open (or about to open), the Undo window is open, or
// the time away card is open or waiting: closing any of them calls this again.
function askPendingRestart() {
  if (session && session.restartPending && !picker.distraction && !undo.distraction && !away.ms) {
    askContinueOrRestart();
  }
}

async function askContinueOrRestart() {
  if (!session || session.endedAt) return;
  const dialog = $("#restartDialog");
  if (dialog.open) return;

  const readMinutes = durationPicker($("#restartDuration"), Math.round(session.durationMs / MIN));

  // "Save the first X to history": X is the time so far, and if it's kept, the
  // session is saved as ending right now, so what's shown is what's saved. Only
  // offered when it could be saved at all (same 1-minute rule as finishing).
  const cutAt = Date.now();
  const canSave = cutAt - session.startedAt >= HISTORY_MIN_MS;
  $("#restartSaveRow").hidden = !canSave;
  $("#restartSave").checked = true;
  $("#restartSaveText").textContent = `Save the first ${formatDuration(cutAt - session.startedAt)} to history`;

  const asked = session;
  const answer = await ask(dialog);
  if (!session || session.endedAt) return; // the timer ran out while the question was open
  if (session !== asked) return; // another tab took the session over meanwhile (loseControl)

  // Answered (Esc counts as "continue"), so a reload won't ask again.
  session.restartPending = false;
  save(SESSION_KEY, session);
  if (answer === "restart") {
    const { characterId, mode } = session;
    // The checkbox only matters here: "Continue" keeps the session running.
    if (canSave && $("#restartSave").checked && saveFinishedSession({ ...session, endedAt: cutAt }, "startOver")) {
      requestPersistentStorage();
    }
    startSession(characterId, mode, readMinutes()); // a waiting time away card is dropped with the old session
  } else {
    askPendingAway();
  }
}

async function onEndClick() {
  // The picker waits behind this dialog, and a waiting restart question waits until it's answered.
  pausePicker();
  // "Save this session to your history": only offered when it could be saved at all
  // (same 1-minute rule as saving). Ticked every time the dialog opens, never remembered.
  const canSave = Date.now() - session.startedAt >= HISTORY_MIN_MS;
  $("#endSaveRow").hidden = !canSave;
  $("#endSave").checked = true;
  const asked = session;
  const answer = await ask($("#endDialog"));
  if (session !== asked) return; // another tab took the session over meanwhile (loseControl)
  if (answer === "end" && session && !session.endedAt) {
    finishSession(Date.now(), !canSave || $("#endSave").checked);
  } else {
    resumePicker();
    askPendingAway();
    askPendingRestart();
  }
}

// ---------- one tab at a time (Web Locks API) ----------

// With the app open in several tabs (or a tab and the installed app), only the tab holding the
// browser lock SESSION_LOCK runs the running session: timers, reactions, sounds, the time away
// card and every save. The others show "This session is open in another tab." (elsewhereScreen).
// The browser frees the lock by itself when its tab is closed, reloaded or crashes. "Continue
// here" takes it from the other tab, which then stops at once without saving anything more.
// The lock is held from the start (or resume) of a session until it's finished or discarded.
// The setup screen, the summary, history.html and stats.html need no lock.
// Without Web Locks (old browsers, or index.html opened as a file: locks need HTTPS) every tab
// runs the session on its own, as before this existed.
const SESSION_LOCK = "ct_session"; // a lock name, not a storage key: nothing is saved under it
const locks = (() => {
  try {
    return navigator.locks && typeof navigator.locks.request === "function" ? navigator.locks : null;
  } catch {
    return null;
  }
})();
// hold: { release } while this tab holds the lock. pending: an unanswered request (see takeControl).
const control = { hold: null, pending: null };

// The session saved in ct_session_v1, if one is running (or ran out without being saved yet).
function savedRunningSession() {
  const saved = load(SESSION_KEY, null);
  return saved && !saved.endedAt && characterById(saved.characterId) ? saved : null;
}

// Resolves true once this tab holds the lock, false if another tab holds it. steal: take it from
// that tab ("Continue here"). Without Web Locks, or if the browser refuses the request, always true.
function takeControl(steal) {
  if (!locks || control.hold) return Promise.resolve(true);
  if (control.pending) return control.pending; // e.g. a quick second tap on Start
  const mine = { release: null };
  control.pending = new Promise((resolve) => {
    locks
      .request(SESSION_LOCK, steal ? { steal: true } : { ifAvailable: true }, (lock) => {
        control.pending = null;
        if (!lock) {
          resolve(false);
          return undefined;
        }
        control.hold = mine;
        resolve(true);
        return new Promise((release) => (mine.release = release)); // held until releaseControl()
      })
      .catch(() => {
        control.pending = null;
        if (control.hold === mine) {
          control.hold = null;
          loseControl(); // another tab took it ("Continue here" there)
        } else {
          resolve(true); // refused before it was granted: carry on as without Web Locks
        }
      });
  });
  return control.pending;
}

function releaseControl() {
  const hold = control.hold;
  control.hold = null;
  if (hold) hold.release();
}

// Another tab took the session over. Everything here stops, and session is dropped before the
// dialogs close, so nothing that waits on them (or on a timer) saves anything more.
function loseControl() {
  clearInterval(tickTimer);
  stopStage();
  closePicker(false);
  closeUndo(false);
  Object.assign(away, { from: 0, ms: 0, open: false, yes: false, hiddenAt: 0 });
  session = null;
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  document.title = BASE_TITLE;
  showScreen("elsewhereScreen");
}

// Picks up the session saved in ct_session_v1: after a reload, or when this tab takes it over.
// It's read only now, after the lock, so whatever the other tab logged is in it. Taking over
// works exactly like a reload: a leftAt the other tab saved when it was hidden (the switch to
// this tab) counts like a normal return, so 15 s or more away asks the time away card, here only.
// Returns false if there's no running session any more (it ended in the meantime).
function resumeSavedSession() {
  const saved = savedRunningSession();
  if (!saved) return false;
  session = saved;
  // A session saved before personalities came from the character can hold any
  // style: it continues (and goes into the history) with the character's own.
  session.style = personalityOf(characterById(saved.characterId));
  save(SESSION_KEY, session);
  if (Date.now() >= saved.startedAt + saved.durationMs) {
    onTimerRanOut(false);
  } else {
    enterSession();
    onVisibilityChange(); // a leave time saved before the reload counts like a normal return
    askPendingRestart(); // the page was reloaded before the continue/restart question was answered
  }
  return true;
}

// Start-up with a running session saved, Start while one is saved, and "Continue here".
// Another tab holds the lock (and steal isn't set): the notice. The session ended meanwhile: setup.
async function continueSavedSession(steal) {
  if (!(await takeControl(steal))) {
    showScreen("elsewhereScreen");
    return;
  }
  if (session) return; // a quick second tap: it's already running here
  if (resumeSavedSession()) return;
  releaseControl();
  renderCharacterList();
  showScreen("setupScreen");
}

function onContinueHereClick() {
  if (prefs.endSound) unlockAudio(); // this tap is what allows the chime later, as on Start
  continueSavedSession(true);
}

// The notice goes when the session ends in the other tab (finished or discarded there).
// "storage" only fires in the other tabs of the site, never in the one that saved.
function onStorage(event) {
  if (event.key !== SESSION_KEY && event.key !== null) return; // null: all storage was cleared
  if ($("#elsewhereScreen").hidden || savedRunningSession()) return;
  renderCharacterList();
  showScreen("setupScreen");
}

// ---------- time away ----------

// The page was hidden or shown again. The browser can't tell another app or tab from a locked
// screen, so the card only says "away". Nothing is ever logged without a tap.
function onVisibilityChange() {
  if (!session || session.endedAt) return;
  if (document.hidden) noteLeave();
  else noteReturn();
}

// Saved at once: on Android a background tab is often discarded and reloaded on return.
// If a card is already open or waiting, leftAt keeps its start: the time away then runs from
// the first leave to the last return, so after such a reload the card still covers all of it.
function noteLeave() {
  away.hiddenAt = Date.now();
  if (session.leftAt) return;
  session.leftAt = away.ms ? away.from : away.hiddenAt;
  save(SESSION_KEY, session);
}

// Also runs right after a reload, with the leftAt saved before it.
function noteReturn() {
  if (!session.leftAt) return;
  tick(); // the timer check comes first: if the session ran out while away, the end logic wins
  if (!session || session.endedAt) return;
  const now = Date.now();
  const from = session.leftAt;
  // With a card open or waiting, only this latest absence decides whether anything changes.
  const absence = away.ms ? now - away.hiddenAt : now - from;
  delete session.leftAt;
  save(SESSION_KEY, session);
  if (absence < AWAY_ASK_AFTER_MS) return; // short: nothing happens
  away.from = from;
  away.ms = Math.floor((now - from) / 1000) * 1000; // whole seconds, as shown and saved
  closeUndo(false); // its 5 s are long over, but timers in a hidden page can run late
  if (away.open) showAwayQuestion(); // left again while the card was open: the new total
  else askPendingAway();
}

// An open question (End session, continue/restart) comes first: closing it calls this again.
function askPendingAway() {
  if (!away.ms || away.open || !session || session.endedAt) return;
  if (document.querySelector("dialog[open]")) return;
  away.open = true;
  away.yes = false;
  // The level1 pose, held still: no blinking and no "doing well" pose while the card is open.
  stopReaction();
  stage.reacting = true;
  setPose("level1");
  showAwayQuestion();
  $("#awayDialog").showModal();
}

function showAwayQuestion() {
  $("#awayTitle").textContent = `You were away for ${formatDuration(away.ms)}.`;
}

// Every way the card closes ends up here: "Yes", "No", Esc, the session ending.
function onAwayClosed() {
  const { yes, from, ms } = away;
  Object.assign(away, { from: 0, ms: 0, open: false, yes: false });
  if (!session || session.endedAt) return; // the timer ran out while it was open: nothing is logged
  if (yes) logAwayDistraction(from, ms); // its reaction takes over the pose
  else endReaction();
  askPendingRestart();
}

// "Yes" logs the measured time away: at is the moment the page was left, the level comes
// from the length (awayLevel in history-store.js), and Advanced mode saves the length itself
// (Simple mode has no lengths: ms 0). The category is "phone" (shown as "Screen") and there's no
// picker. Reaction, Undo and the level 5 continue/restart question work as for a tap. If only
// part of it was a distraction, Undo it and log that part by hand.
function logAwayDistraction(from, ms) {
  const level = awayLevel(ms);
  const distraction = {
    at: from, level, ms: session.mode === "advanced" ? ms : 0, category: "phone", source: "away",
  };
  addDistraction(distraction, level === 5);
}

// Once per device, after a session is saved: asks the browser to mark this site's storage as
// persistent, so it isn't cleared on its own (e.g. when the device runs low on space). The
// browser decides; nothing is shown either way. Skipped in Firefox, which would show a
// permission bar right after the session (persistRequested is still set, so it's not tried again).
function requestPersistentStorage() {
  if (prefs.persistRequested) return;
  savePrefs({ persistRequested: true });
  if (/Firefox\/|FxiOS/.test(navigator.userAgent)) return;
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch {
    // not supported: fine
  }
}

// keep: false when "Save this session to your history" was unticked: the session
// doesn't count, so nothing is saved and there's no summary to judge it. Straight back
// to the setup screen instead, like Discard in the "Welcome back" dialog.
function finishSession(endedAt, keep = true) {
  clearInterval(tickTimer);
  stopStage();
  closePicker(false);
  closeUndo(false);
  session.endedAt = Math.min(endedAt, session.startedAt + session.durationMs);
  if (keep && saveFinishedSession(session)) requestPersistentStorage();
  remove(SESSION_KEY);
  releaseControl();
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  document.title = BASE_TITLE;
  if (!keep) {
    session = null;
    renderCharacterList();
    showScreen("setupScreen");
    return;
  }
  renderSummary();
  showScreen("summaryScreen");
}

// Back soon after the end (or watching it end): saved as a full session, as always.
// Back much later: the app can't tell whether the user kept focusing, so it asks.
// running: called by the running timer (not on start-up after a reload or reopen).
// The chime only plays if the end is happening right now, not when someone comes back later.
function onTimerRanOut(running) {
  const endedAt = session.startedAt + session.durationMs;
  const late = Date.now() - endedAt;
  if (late > REOPEN_ASK_AFTER_MS) {
    askSaveLateSession(endedAt);
    return;
  }
  if (running && late <= (document.hidden ? END_SOUND_HIDDEN_MS : END_SOUND_VISIBLE_MS)) announceEnd();
  finishSession(endedAt);
}

async function askSaveLateSession(endedAt) {
  clearInterval(tickTimer);
  stopStage();
  closePicker(false);
  closeUndo(false);
  // Only in memory: stops the session, and a dialog closed below (continue/restart,
  // End session) sees it as ended. ct_session_v1 stays as it was until the answer,
  // so closing the page now asks again next time.
  session.endedAt = endedAt;
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  document.title = BASE_TITLE;
  showScreen("setupScreen");

  const character = characterById(session.characterId);
  $("#lateText").textContent =
    `Your ${Math.round(session.durationMs / MIN)} min ${capitalize(session.mode)} session with ` +
    `${character.name} ended ${formatTimeAgo(Date.now() - endedAt)}.`;

  // Discard deletes the session, so only a tap on a button answers (Esc asks again).
  // Another tab taking the session over closes the dialog: then this one stops asking.
  const late = session;
  let answer = "";
  while (answer !== "save" && answer !== "discard") {
    answer = await ask($("#lateDialog"));
    if (session !== late) return;
  }

  if (answer === "save") {
    finishSession(endedAt);
  } else {
    remove(SESSION_KEY);
    releaseControl();
    session = null;
    renderCharacterList();
  }
}

// ---------- motivation ----------

function motivationPhase(elapsed, duration) {
  const progress = elapsed / duration;
  if (duration >= 35 * MIN) {
    if (elapsed < 10 * MIN) return "general";
    if (elapsed < 20 * MIN) return "hardest";
    return progress < 0.85 ? "middle" : "final";
  }
  return progress < 0.85 ? "short" : "final";
}

function updateMotivationPhase(elapsed) {
  const phase = motivationPhase(elapsed, session.durationMs);
  if (phase === motivation.phase) return;

  motivation.phase = phase;
  motivation.index = Math.floor(Math.random() * MOTIVATION[phase].length);
  motivation.shown = false;

  // New phase: swap the visible message quietly, no separate notification.
  if (!$("#motivationCard").hidden) showMotivation();
}

function onMotivateClick() {
  if (motivation.shown) {
    motivation.index = (motivation.index + 1) % MOTIVATION[motivation.phase].length;
  }
  showMotivation();
  scrollMotivationIntoView();
}

// On short screens the card opens under the sticky bottom bar, so scroll it up
// just far enough to sit 12px above the bar (which is taller while the picker is open).
function scrollMotivationIntoView() {
  const overlap = $("#motivationCard").getBoundingClientRect().bottom - ($(".session-bar").getBoundingClientRect().top - 12);
  if (overlap > 0) window.scrollBy({ top: overlap, behavior: "smooth" });
}

function showMotivation() {
  const message = MOTIVATION[motivation.phase][motivation.index];
  motivation.shown = true;
  $("#motivationBadge").textContent = message.type === "fact" ? "Brain fact" : "Boost";
  $("#motivationBadge").dataset.type = message.type;
  $("#motivationText").textContent = message.text;
  $("#motivationCard").hidden = false;
}

// ---------- summary ----------

// The pose, title and message all follow the session result (great / okay / rough / early / short).
// A short session only shows the title and the "not saved" note, in both modes.
function renderSummary() {
  const character = characterById(session.characterId);
  const result = sessionResult(session);
  const short = result === "short";
  const img = $("#summaryImg");
  img.alt = character.name;
  setPoseImage(img, character, (SUMMARY_POSES[personalityOf(character)] || SUMMARY_POSES.kind)[result]);

  $("#summaryTitle").textContent = SUMMARY_TITLES[result];
  const percentEl = $("#summaryPercent");
  const textEl = $("#summaryText");
  const noteEl = $("#summaryNote");
  noteEl.textContent = SUMMARY_SHORT_NOTE;
  noteEl.hidden = !short;

  if (session.mode === "advanced") {
    const { elapsedMs: elapsed, distractedMs: distracted, focusPercent: percent } = sessionFocus(session);
    const count = session.distractions.length;
    // Ended before the timer ran out: also say how long it was meant to be.
    const planned = elapsed < session.durationMs ? ` (${formatDuration(session.durationMs)} planned)` : "";

    percentEl.textContent = `${percent}% focused`;
    percentEl.hidden = short; // means nothing after a few seconds
    textEl.textContent =
      `You focused for ${formatDuration(elapsed - distracted)} out of ${formatDuration(elapsed)}${planned}, ` +
      `with ${count} distraction${count === 1 ? "" : "s"} logged.`;
    textEl.hidden = short;
  } else {
    percentEl.hidden = true;
    const messages = SIMPLE_SUMMARY_MESSAGES[result];
    textEl.hidden = !messages; // a short session only shows the note
    if (messages) textEl.textContent = messages[Math.floor(Math.random() * messages.length)];
  }

  // Top 3 picked categories. Hidden if none was picked this session, or if it was short.
  const top = countCategories(session.distractions).slice(0, 3);
  const categoriesEl = $("#summaryCategories");
  categoriesEl.hidden = short || top.length === 0;
  categoriesEl.textContent =
    `Most common distraction${top.length === 1 ? "" : "s"}: ` +
    top.map((category) => `${category.label} (${category.count})`).join(", ");
}

// ---------- formatting ----------

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

// "45 sec", "25 min" or "24 min 30 sec": seconds are shown whenever there are any,
// so focused time and session time never round to the same number by accident.
function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds} sec`;
  return seconds ? `${minutes} min ${seconds} sec` : `${minutes} min`;
}

// "45 min ago", "3 hours ago", "2 days ago"
function formatTimeAgo(ms) {
  const minutes = Math.floor(ms / MIN);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ---------- start-up ----------

function init() {
  renderCharacterList();
  bindChoiceGroups();
  bindSettingChecks();
  buildCategoryButtons();
  readSetupMinutes = durationPicker($("#setupDuration"), prefs.minutes);

  $("#startButton").addEventListener("click", onStartClick);
  $("#howItWorksLink").addEventListener("click", openHowItWorks);
  $("#howItWorksButton").addEventListener("click", dismissHowItWorks);
  $("#homeScreenTipButton").addEventListener("click", dismissHomeScreenTip);
  $("#motivateButton").addEventListener("click", onMotivateClick);
  $("#motivationClose").addEventListener("click", () => ($("#motivationCard").hidden = true));
  $("#endButton").addEventListener("click", onEndClick);
  $("#undoButton").addEventListener("click", onUndoClick);
  $("#undoButton").style.setProperty("--undo-timeout", `${UNDO_WINDOW_MS}ms`);
  $("#skipCategoryButton").addEventListener("click", () => closePicker(true));
  $("#newSessionButton").addEventListener("click", () => {
    session = null;
    renderCharacterList();
    showScreen("setupScreen");
  });
  // Capture phase, so every tap counts, wherever it lands (dialogs too).
  // touchend for iPhones, which don't always send click for taps on plain areas.
  for (const type of ["touchend", "click", "keydown"]) document.addEventListener(type, onSessionInput, true);
  document.addEventListener("visibilitychange", updateWakeLock);
  document.addEventListener("visibilitychange", onVisibilityChange);
  $("#awayNoButton").addEventListener("click", () => $("#awayDialog").close());
  $("#awayYesButton").addEventListener("click", () => {
    away.yes = true;
    $("#awayDialog").close();
  });
  $("#awayDialog").addEventListener("close", onAwayClosed);
  $("#continueHereButton").addEventListener("click", onContinueHereClick);
  window.addEventListener("storage", onStorage);

  // Resume a session that was running when the page was closed or reloaded,
  // unless another tab runs it (see "one tab at a time").
  if (savedRunningSession()) {
    continueSavedSession(false);
    return;
  }
  showScreen("setupScreen");
}

init();
