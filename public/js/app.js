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
const UNDO_WINDOW_MS = 5000; // after a distraction tap, Undo takes Motivate me's place for this long
// Screen reader announcements (see "screen reader announcements"): set this long after the live
// region is emptied, and emptied again this long after that.
const ANNOUNCE_DELAY_MS = 100;
const ANNOUNCE_CLEAR_MS = 5000;
// Their texts: announce.* in js/i18n/en.js.
// Page hidden (another app, another tab, locked screen) for at least this long during a session:
// on return the app asks whether it was a distraction. Shorter absences are ignored.
// AWAY_MIN_MS is in history-store.js, because imports check away distractions against it.
const AWAY_ASK_AFTER_MS = AWAY_MIN_MS;
const DURATION_PRESETS = [5, 10, 15, 25, 35, 45, 60, 90];
const MIN_MINUTES = 1;
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
// Red note on a new session's screen ("This session won't be saved…" or "Couldn't save the first
// part…"): long enough to read it once the screen (or the dialog) has changed, then it turns
// invisible (keeping its space, so nothing moves).
const SAVE_ERROR_NOTE_MS = 10 * 1000;

// Summary screen pose for each session result (see sessionResult in history-store.js).
// early: neutral, never the proud "good" pose and never the "rough" one.
const SUMMARY_POSES = {
  kind: { great: "good", okay: "level2", rough: "level4", early: "initial", short: "initial" }, // proud / pleased / gently encouraging / calm
  firm: { great: "good", okay: "level1", rough: "level3", early: "level1", short: "initial" }, // approving / eyebrow raised / serious / eyebrow raised
  strict: { great: "good", okay: "initial", rough: "level2", early: "level1", short: "initial" }, // satisfied / neutral / disappointed / stern
  ragebait: { great: "good", okay: "level1", rough: "level4", early: "level1", short: "initial" }, // grudging / smirking / mocking / side-eye
};

// Simple mode: severity only, no time. Level = which reaction pose to show (1-5).
// key: the button's text (js/i18n/en.js: Barely, A little, Quite a bit, A lot, Completely).
const SIMPLE_OPTIONS = [
  { key: "distraction.simple.1", level: 1 },
  { key: "distraction.simple.2", level: 2 },
  { key: "distraction.simple.3", level: 3 },
  { key: "distraction.simple.4", level: 4 },
  { key: "distraction.simple.5", level: 5, askRestart: true },
];

// Advanced mode: distraction length. "10+ min" counts as 10 minutes in the focus %.
// A length longer than the free time so far is disabled (see updateLengthButtons),
// except "30 sec" (alwaysEnabled), so the row isn't all grey at the start.
// key: the button's text (30 sec, 1 min, 2 min, 3 min, 5 min, 10 min, 10+ min).
const ADVANCED_OPTIONS = [
  { key: "distraction.advanced.1", ms: 30 * 1000, level: 1, alwaysEnabled: true },
  { key: "distraction.advanced.2", ms: 1 * MIN, level: 2 },
  { key: "distraction.advanced.3", ms: 2 * MIN, level: 3 },
  { key: "distraction.advanced.4", ms: 3 * MIN, level: 3 },
  { key: "distraction.advanced.5", ms: 5 * MIN, level: 4 },
  { key: "distraction.advanced.6", ms: 10 * MIN, level: 4 },
  { key: "distraction.advanced.7", ms: 10 * MIN, level: 5, askRestart: true },
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
// Every custom character counts as "custom": the user's own ids and names never leave the device.
function countCharacterPick(character) {
  fetch("api/picks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ characterId: character.custom ? CUSTOM_PICK_ID : character.id }),
    keepalive: true,
  }).catch(() => {});
}

// ---------- state ----------

// endSound / keepScreenOn / leaveReminder: the setup checkboxes (leaveReminder: see "leave reminder").
// language: only set when a language was picked in the language sheet (js/i18n.js saves it; until
// then the app follows the browser's language). This file never writes it: savePrefs keeps it.
// theme: "light" or "dark", only set once the light/dark switch was tapped (js/theme.js saves it;
// until then the app follows the phone's setting). This file never writes it either: savePrefs keeps it.
// homeScreenTipDismissed: "Got it" was tapped on the iPhone Home Screen tip.
// persistRequested: persistent storage was asked for (or skipped, in Firefox).
// howItWorksDismissed: "Got it" was tapped on the How it works card.
// Prefs saved before any of these existed get these defaults.
const prefs = Object.assign(
  {
    characterId: null, mode: "simple", minutes: 25, endSound: true, keepScreenOn: true, leaveReminder: false,
    homeScreenTipDismissed: false, persistRequested: false, howItWorksDismissed: false,
  },
  load(PREFS_KEY, {}),
);
delete prefs.style; // saved before personalities came from the character; dropped on the next save
// style: the character's personality when the session ran ("kind", "firm", "strict" or "ragebait")
// restartPending: "Completely" / "10+ min" was tapped and the continue/restart question
// hasn't been answered yet. Saved, so a reload still asks it.
// leftAt: set while the page is hidden, cleared on return (see "time away"). Saved, so a page the
// browser discarded in the background still asks after the reload. Never goes into the history.
// characterName: only for custom characters, so a renamed or deleted one keeps its name in old sessions.
// pausedAt: when the current break started (Stop → Take a break), null while running. pauses: the
// breaks that are over, [{ at, ms }]. Sessions saved before breaks existed have neither: never paused.
let session = null; // { characterId, characterName, style, mode, durationMs, startedAt, distractions: [], endedAt, restartPending, leftAt, pausedAt, pauses: [] }
let tickTimer = 0;
let nextGoodAt = 0;
let saveErrorNoteTimer = 0;
// distraction: the one the open (or about to open) picker belongs to.
// If session.restartPending is set, the continue/restart dialog opens as soon as
// the picker is closed and the Undo window is over. They never show at the same time.
// closesAt: when the open picker's safety close (PICKER_AUTO_CLOSE_MS) is due.
// returnFocus: the distraction button that was tapped; focus goes back there when the picker
// closes with focus inside it (a category or Skip was tapped), instead of being lost.
const picker = { distraction: null, showTimer: 0, hideTimer: 0, closesAt: 0, returnFocus: null };
// distraction: the latest one, while its Undo window is open. prevNextGoodAt: nextGoodAt
// before that tap. setRestart: that tap set session.restartPending (it wasn't set before).
// closesAt: when the window ends. countdownTimer: updates the seconds shown on the button.
const undo = { distraction: null, prevNextGoodAt: 0, setRestart: false, timer: 0, closesAt: 0, countdownTimer: 0 };
const motivation = { phase: null, index: 0, shown: false };
// from / ms: when the page was left and for how long (whole seconds) the card asks about, also
// while it waits for another dialog to close (ms 0: none). open: the card is on screen.
// yes: "Yes" was tapped, logged once the card has closed. hiddenAt: the latest time the page
// was hidden (in memory only).
const away = { from: 0, ms: 0, open: false, yes: false, hiddenAt: 0 };

// A built-in character, or one of the user's own (custom-characters.js) that exists right now.
// null for anything else, e.g. a custom character deleted here or in another tab, or any custom
// character while custom characters are off (CUSTOM_CHARACTERS_ON): a saved choice of one is then
// like no choice.
function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || (CUSTOM_CHARACTERS_ON ? customCharacterById(id) : null);
}

// The character a session runs with. A custom character that was deleted meanwhile (here or in
// another tab) is drawn with the default look and the name the session stored (ghostCharacter),
// so the session keeps running and its summary still shows it. A session that was already running
// with a custom character also keeps it while custom characters are off.
function sessionCharacter(s) {
  return (
    characterById(s.characterId) ||
    customCharacterById(s.characterId) ||
    (isCustomId(s.characterId) ? ghostCharacter(s.characterId, s.characterName, s.style) : null)
  );
}

function showScreen(id) {
  if (id === "setupScreen") {
    updateHowItWorks();
    updateHomeScreenTip();
    refreshQuickStart();
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
  preloadArt(character);
  setPose("initial"); // also sets the alt
  scheduleBlink();
}

// The alt follows the pose (describePose in characters.js), so a screen reader can check the
// character any time. A blink keeps the alt it had, so the alt doesn't change every few seconds.
function setPose(pose) {
  setPoseImage(stage.img, stage.character, pose);
  if (pose !== "blink") stage.img.alt = describePose(stage.character, pose);
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
  clearAnnouncement();
}

// ---------- screen reader announcements ----------

// One visually hidden live region (#announcer in index.html, polite). Only for what follows the
// user's own action: a distraction reaction, the category picker appearing, and Undo. The poses
// that come by themselves (doing well, blinks, refocus) and Undo's countdown are never read out,
// so they don't break the user's focus. Nothing is shown on screen, and it's never the character
// speaking: the reactions are described like alt text (describePose in characters.js).
const announcer = { text: "", timer: 0 };

// Emptied first and set a moment later, so the same text is read again on the next tap. Emptied
// again after ANNOUNCE_CLEAR_MS, so swiping through the page later doesn't find old text there.
// Emptying it never cuts off what's being read: only new text is read out.
function announce(text) {
  const region = $("#announcer");
  clearTimeout(announcer.timer);
  announcer.text = text;
  region.textContent = "";
  announcer.timer = setTimeout(() => {
    region.textContent = text;
    announcer.timer = setTimeout(clearAnnouncement, ANNOUNCE_CLEAR_MS);
  }, ANNOUNCE_DELAY_MS);
}

function clearAnnouncement() {
  clearTimeout(announcer.timer);
  announcer.text = "";
  $("#announcer").textContent = "";
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
    prefs.keepScreenOn && session && !session.endedAt && !session.pausedAt &&
    !$("#sessionScreen").hidden && document.visibilityState === "visible",
  );
}

// Holds the lock while a session is on screen, releases it everywhere else and during a break
// (a screen that turns off then changes nothing; Resume takes it back). Called on every
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
  // During a break it doesn't apply (the screen may turn off then): invisible, but it keeps its
  // space, so the screen doesn't move when the break starts or ends. Resume brings it back as it was.
  const paused = running && Boolean(session.pausedAt);
  note.style.visibility = paused ? "hidden" : "";
  if (!running || !prefs.endSound) {
    note.hidden = true;
    return;
  }
  if (paused || wakeLock.pending || document.visibilityState !== "visible") return;
  note.hidden = Boolean(wakeLock.sentinel);
}

// Red note on the new session's screen: storage.sessionNote when the session starts while the
// browser doesn't let the site save anything (startSession), or session.saveFirstPartFailed when Start new
// session couldn't save the abandoned part. After SAVE_ERROR_NOTE_MS it turns invisible but keeps
// its space, so nothing on the screen moves while a distraction button may be tapped. The next
// session (enterSession) removes it completely.
function showSaveErrorNote(text) {
  const note = $("#saveErrorNote");
  clearTimeout(saveErrorNoteTimer);
  note.style.visibility = "";
  note.textContent = text; // set when shown, so a screen reader reads it once
  note.hidden = false;
  saveErrorNoteTimer = setTimeout(() => {
    note.style.visibility = "hidden"; // also hides it from screen readers
  }, SAVE_ERROR_NOTE_MS);
}

function hideSaveErrorNote() {
  const note = $("#saveErrorNote");
  clearTimeout(saveErrorNoteTimer);
  note.hidden = true;
  note.textContent = "";
  note.style.visibility = "";
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

// ---------- tap guard ----------

// Many taps remove or replace what's under the finger (a dialog closes, the picker hides, Undo
// turns back into Motivate me, the screen changes). The second tap of an accidental double tap
// would then press whatever appeared there, or log a distraction twice. So a click from a tap
// or mouse that comes less than TAP_GUARD_MS after the last accepted one is dropped, wherever it
// lands: no handler runs, no dialog closes, no checkbox toggles. 400 ms: Android's double-tap
// timeout (300 ms from lift to the next touch) plus the second press. A deliberate tap on
// something that just appeared takes longer than that. A dropped click doesn't restart the time.
// Always let through: keyboard and assistive-tech clicks (detail 0), Undo (it may follow a
// distraction tap at once), text fields (a click there does nothing) and the click a <label>
// passes on to its checkbox right after its own.
const TAP_GUARD_MS = 400;
const tapGuard = { lastAt: -Infinity, labelControl: null };

function onGuardedClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const passes =
    event.detail === 0 ||
    (target && target.closest("#undoButton")) ||
    (target && target.matches("input:not([type=checkbox]):not([type=radio]), textarea, select")) ||
    (target && target === tapGuard.labelControl);
  if (!passes && event.timeStamp - tapGuard.lastAt < TAP_GUARD_MS) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return;
  }
  tapGuard.labelControl = null;
  if (event.detail === 0) return; // a key press doesn't start the time
  tapGuard.lastAt = event.timeStamp;
  const label = target && target.closest("label");
  if (label && label.control) {
    tapGuard.labelControl = label.control;
    setTimeout(() => (tapGuard.labelControl = null)); // the passed-on click comes before this
  }
}

// ---------- duration picker (used on setup and in the restart dialog) ----------

// Empty becomes 25, anything under 1 becomes 1, anything over 240 becomes 240.
function clampMinutes(value) {
  if (String(value).trim() === "") return DEFAULT_MINUTES;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n));
}

// The line under the custom field when clampMinutes changes what was typed, "" when it doesn't.
// A number field reports text it can't read as "", so that gets the empty message too.
// The limits are checked on what was typed, before rounding: 0.5 says "Min.", 240.4 says "Max.".
function minutesNote(value) {
  const n = Number(value);
  if (String(value).trim() === "" || !Number.isFinite(n)) return t("duration.setTo", { minutes: DEFAULT_MINUTES });
  if (n > MAX_MINUTES) return t("duration.max", { minutes: MAX_MINUTES });
  if (n < MIN_MINUTES) return t("duration.min", { minutes: MIN_MINUTES });
  const rounded = Math.round(n);
  if (rounded !== n) return t("duration.rounded", { minutes: rounded });
  return "";
}

// Every press (finger, mouse or key) counts up, so a picker can tell whether its last correction
// came from the press going on now: tapping Start leaves the field first, which corrects it.
let pressCount = 0;

// Builds preset chips + a custom number field + the line that says when the field was corrected.
// read() returns the minutes, or null when the tap on Start just corrected the field: then nothing
// starts, so the message can be seen, and the next tap starts with the corrected value. It blocks
// only once per correction, so a click without a press (TalkBack, Voice Access, Switch Access)
// can't get stuck. value() returns the minutes without blocking. clearNote() hides the line.
// relabel() puts its texts in the current language, keeping the typed value (language switch).
function durationPicker(container, initialMinutes) {
  container.innerHTML = "";

  const chips = document.createElement("div");
  chips.className = "chips";

  // "Custom: [25] min": the words around the field are their own text nodes, so they can be
  // translated without touching the field.
  const custom = document.createElement("label");
  custom.className = "custom-minutes";
  const before = document.createTextNode("");
  const after = document.createTextNode("");
  const input = document.createElement("input");
  input.type = "number";
  input.min = MIN_MINUTES;
  input.max = MAX_MINUTES;
  input.inputMode = "numeric";
  custom.append(before, input, after);
  const relabel = () => {
    before.textContent = `${t("duration.customBefore")} `;
    after.textContent = ` ${t("duration.customAfter")}`;
    chips.querySelectorAll("button").forEach((chip) => {
      chip.textContent = t("duration.chip", { minutes: chip.dataset.minutes });
    });
  };

  // Always in the page (a status line must exist before its text changes to be read out),
  // empty and without height until the field is corrected.
  const note = document.createElement("p");
  note.className = "custom-note muted";
  note.setAttribute("role", "status");
  let correctedAtPress = -1;

  const clearNote = () => {
    note.textContent = "";
  };

  const sync = () => {
    chips.querySelectorAll("button").forEach((chip) => {
      chip.setAttribute("aria-pressed", String(Number(chip.dataset.minutes) === Number(input.value)));
    });
  };

  // Shows the value that will really be used. Returns true if it differs from what was typed.
  const correct = () => {
    const text = minutesNote(input.value);
    input.value = clampMinutes(input.value);
    sync();
    if (!text) return false;
    note.textContent = "";
    note.textContent = text; // re-set so screen readers announce it again
    correctedAtPress = pressCount;
    return true;
  };

  for (const minutes of DURATION_PRESETS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.minutes = minutes;
    chip.addEventListener("click", () => {
      input.value = minutes;
      sync();
      clearNote();
    });
    chips.append(chip);
  }

  relabel();
  input.value = initialMinutes;
  // While typing the line only goes away (once the value is valid), it never appears.
  input.addEventListener("input", () => {
    sync();
    if (!minutesNote(input.value)) clearNote();
  });
  input.addEventListener("change", correct);
  // Inside a dialog form, Enter would press the first button ("Continue") by accident.
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  sync();

  container.append(chips, custom, note);
  return {
    // correct() here too: some browsers don't take focus from the field when a button is tapped.
    read: () => {
      if (correct() || correctedAtPress === pressCount) {
        correctedAtPress = -1; // blocked once: the next read starts, even without a new press
        return null;
      }
      return clampMinutes(input.value);
    },
    value: () => clampMinutes(input.value),
    clearNote,
    relabel,
  };
}

// ---------- can this browser save? ----------

// Runs the test write (storageWorks in history-store.js) and shows or hides the setup screen note.
// Called at start-up, when a session starts, and when the page is shown again. Returns the result.
function checkStorage() {
  const ok = storageWorks();
  updateSetupStorageNote(ok);
  return ok;
}

// Only changes something when the result changed, and the text is set when the note appears, so a
// screen reader reads it once, not on every check. The note sits at the top of the setup screen:
// if the page is scrolled down, it's scrolled by the note's height, so what's on screen stays put.
// (Browsers with scroll anchoring already keep it in place: the difference is 0 there.)
function updateSetupStorageNote(ok) {
  const note = $("#setupStorageNote");
  if (note.hidden === ok) return;
  const anchor = $("#characterStep");
  const before = anchor.getBoundingClientRect().top;
  note.textContent = ok ? "" : t("storage.setupNote");
  note.hidden = ok;
  if ($("#setupScreen").hidden || window.scrollY === 0) return;
  const moved = anchor.getBoundingClientRect().top - before;
  if (moved) window.scrollBy(0, moved);
}

// ---------- setup screen ----------

let setupPicker = { read: () => prefs.minutes, value: () => prefs.minutes, clearNote() {}, relabel() {} };

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

// "Quick start" card at the top: starts the current setup (character, mode, duration) without
// scrolling down to Start session. Only for returning users: a saved character that still exists
// and at least one session in the history. It always shows what Start session would start, so it
// follows every change further down. hasHistory: checked when the setup screen is shown (and when
// the history changes in another tab), not on every keystroke. artKey: the character (and, for a
// custom one, its look) whose image is shown, so the image is only set again when that changes.
const quickStart = { hasHistory: false, artKey: null };

function refreshQuickStart() {
  quickStart.hasHistory = loadHistory().length > 0;
  updateQuickStart();
}

// The minutes are setupPicker.value(): what's typed, corrected the way Start corrects it
// (300 shows 240, an empty field 25), so the line never shows a length that can't start.
function updateQuickStart() {
  const character = characterById(prefs.characterId);
  const card = $("#quickStart");
  card.hidden = !character || !quickStart.hasHistory;
  if (card.hidden) return;
  const artKey = character.custom ? `${character.id}/${LOOK_FIELDS.map((f) => character.look[f]).join("|")}` : character.id;
  if (quickStart.artKey !== artKey) {
    setPoseImage($("#quickStartImg"), character, "initial");
    quickStart.artKey = artKey;
  }
  // No-break spaces in the text: a narrow screen wraps after a "·", never before it or inside "25 min".
  $("#quickStartLine").textContent = t("quickStart.line", {
    name: character.name, mode: modeName(prefs.mode), minutes: setupPicker.value(),
  });
}

// A restore from the browser's back/forward cache (e.g. Back from history.html after deleting
// sessions there) shows the page without showScreen, so the history is checked again here.
// It also checks whether another tab started a session meanwhile (see checkSessionElsewhere).
// Every pageshow ends the "unloading" state set by pagehide (see "leave reminder").
function onPageShow(event) {
  leaveReminder.unloading = false;
  if (!event.persisted) return;
  checkStorage(); // site data may have been allowed or blocked meanwhile
  if (!$("#setupScreen").hidden) {
    renderCustomList(); // characters made, edited or deleted on another page meanwhile
    refreshQuickStart();
  }
  checkSessionElsewhere();
}

// The history changed in another tab (a session saved or deleted there). null: all storage was cleared.
function onHistoryStorage(event) {
  if (event.key !== HISTORY_KEY && event.key !== null) return;
  if (!$("#setupScreen").hidden) refreshQuickStart();
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
  if (CUSTOM_CHARACTERS_ON) list.append(createCard());
  renderCustomList();
}

// ---------- your own characters ----------

// "Create your own": always the last card of the main grid. It opens the editor, unless the
// user already has CUSTOM_LIMIT characters: then it says so and does nothing.
// (While CUSTOM_PAID is false it's free for everyone and says "Free during launch".)
function createCard() {
  const card = document.createElement("button");
  card.type = "button";
  card.id = "createCard";
  card.className = "char-card create-card";
  const img = document.createElement("img");
  img.alt = "";
  img.src = createCardArt();
  const name = document.createElement("span");
  name.className = "char-name";
  name.textContent = CUSTOM_TEXTS.createTitle;
  const tagline = document.createElement("span");
  tagline.className = "char-tagline";
  card.append(img, name);
  if (!CUSTOM_PAID) {
    const badge = document.createElement("span");
    badge.className = "badge badge-free";
    badge.textContent = CUSTOM_TEXTS.freeBadge;
    card.append(badge);
  }
  card.append(tagline);
  updateCreateCard(card);
  card.addEventListener("click", () => {
    if (card.getAttribute("aria-disabled") !== "true") location.href = "avatar.html";
  });
  return card;
}

function updateCreateCard(card = $("#createCard")) {
  if (!card) return;
  const full = loadCustomCharacters().length >= CUSTOM_LIMIT;
  card.querySelector(".char-tagline").textContent = full ? CUSTOM_TEXTS.limit : CUSTOM_TEXTS.createTagline;
  if (full) card.setAttribute("aria-disabled", "true");
  else card.removeAttribute("aria-disabled");
}

// "Your characters": the same cards as the main grid (picture, name, personality badge), each
// with Edit and Delete under it. Every name is set as plain text, never as HTML. If focus was in
// the list, it goes back to the same button of the same character after the rebuild.
// Never shown while custom characters are off (CUSTOM_CHARACTERS_ON).
function renderCustomList() {
  const list = $("#customList");
  if (!CUSTOM_CHARACTERS_ON) {
    list.innerHTML = "";
    $("#customSection").hidden = true;
    return;
  }
  const focused = document.activeElement;
  const refocus = list.contains(focused)
    ? { id: focused.closest("[data-id]").dataset.id, role: focused.dataset.role }
    : null;
  list.innerHTML = "";
  const characters = loadCustomCharacters();
  $("#customSection").hidden = characters.length === 0;
  for (const character of characters) {
    const item = document.createElement("div");
    item.className = "custom-item";
    item.dataset.id = character.id;
    item.classList.toggle("selected", prefs.characterId === character.id);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "char-card";
    card.dataset.id = character.id;
    card.dataset.role = "select";
    card.setAttribute("aria-pressed", String(prefs.characterId === character.id));
    const img = document.createElement("img");
    img.alt = "";
    const name = document.createElement("span");
    name.className = "char-name";
    name.textContent = character.name;
    const badge = document.createElement("span");
    badge.className = `badge badge-${character.group}`;
    badge.textContent = GROUPS[character.group].label;
    card.append(img, name, badge);
    setPoseImage(img, character, "initial");
    card.addEventListener("click", () => onCharacterTap(character));

    const actions = document.createElement("div");
    actions.className = "custom-actions";
    const edit = document.createElement("a");
    edit.className = "btn compact";
    edit.href = `avatar.html?id=${encodeURIComponent(character.id)}`;
    edit.textContent = t("common.edit");
    edit.dataset.role = "edit";
    edit.setAttribute("aria-label", t("character.editLabel", { name: character.name }));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn compact";
    remove.textContent = t("common.delete");
    remove.dataset.role = "delete";
    remove.setAttribute("aria-label", t("character.deleteLabel", { name: character.name }));
    remove.addEventListener("click", () => confirmDeleteCustom(character));
    actions.append(edit, remove);

    item.append(card, actions);
    list.append(item);
  }
  updateCreateCard();
  if (refocus) {
    const item = list.querySelector(`.custom-item[data-id="${CSS.escape(refocus.id)}"]`);
    const target = item && item.querySelector(`[data-role="${refocus.role}"]`);
    if (target) target.focus({ preventScroll: true });
    else focusAfterRemoval(refocus.id, characters);
  }
}

// Focus goes to the next character's card (or the one before), or to "Create your own" if none is left.
function focusAfterRemoval(removedId, before) {
  const index = before.findIndex((c) => c.id === removedId);
  const cards = $("#customList").querySelectorAll(".char-card");
  const next = cards[Math.min(Math.max(index, 0), cards.length - 1)];
  (next || $("#createCard")).focus({ preventScroll: true });
}

// Delete on a card: asks first. Past sessions stay in the history (with the name they stored).
// The saved list is read again right here, so a character saved or edited in another tab meanwhile
// is kept. If it was the chosen character, nothing is chosen any more (like a first visit).
async function confirmDeleteCustom(character) {
  $("#deleteCharacterTitle").textContent = t("character.deleteTitle", { name: character.name });
  if ((await ask($("#deleteCharacterDialog"))) !== "delete") return;
  const before = loadCustomCharacters();
  const kept = before.filter((c) => c.id !== character.id);
  if (kept.length !== before.length && !saveCustomCharacters(kept)) return; // storage refused: nothing changed
  if (prefs.characterId === character.id) savePrefs({ characterId: null });
  renderCustomList();
  focusAfterRemoval(character.id, before);
  updateQuickStart();
}

// The custom characters changed in another tab (or the editor): the cards and Quick start follow.
// A session running here keeps the character it started with. null: all storage was cleared.
function onCustomStorage(event) {
  if (event.key !== CUSTOM_KEY && event.key !== null) return;
  if ($("#setupScreen").hidden) return;
  renderCustomList();
  updateQuickStart();
}

// Back from the editor after creating a character (./?picked=custom-…): it's picked like a tap on
// its card (a ragebait one shows the warning first) and scrolled into view. The address is then
// cleaned up, so a reload doesn't pick it again.
function pickNewCharacter() {
  const params = new URLSearchParams(location.search);
  const id = params.get("picked");
  if (id === null) return;
  history.replaceState(null, "", location.pathname + location.hash);
  if (!CUSTOM_CHARACTERS_ON) return;
  const character = customCharacterById(id);
  if (!character) return;
  const card = $("#customList").querySelector(`.char-card[data-id="${CSS.escape(id)}"]`);
  if (card) {
    card.scrollIntoView({ block: "center" });
    card.focus({ preventScroll: true });
  }
  onCharacterTap(character);
}

// Updates the selection in place: rebuilding the cards would move keyboard and screen reader
// focus away from the card that was just tapped.
function updateCharacterCards() {
  $("#characterStep").querySelectorAll(".char-card[data-id]").forEach((card) => {
    card.setAttribute("aria-pressed", String(card.dataset.id === prefs.characterId));
  });
  $("#customList").querySelectorAll(".custom-item").forEach((item) => {
    item.classList.toggle("selected", item.dataset.id === prefs.characterId);
  });
}

async function onCharacterTap(character) {
  if (character.group === "ragebait" && prefs.characterId !== character.id) {
    $("#ragebaitText").textContent = t("character.ragebaitText", { name: character.name, warning: GROUPS.ragebait.warning });
    if ((await ask($("#ragebaitDialog"))) !== "ok") return;
  }

  savePrefs({ characterId: character.id });
  $("#characterError").hidden = true;
  updateCharacterCards();
  updateQuickStart();
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
        updateQuickStart();
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

function scrollToStep(step) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  step.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

// "Change ↓" on the Quick start card: go to step 1 and move focus to its heading without a second
// scroll, so a screen reader carries on reading there.
function onQuickStartChange() {
  scrollToStep($("#characterStep"));
  $("#characterStepTitle").focus({ preventScroll: true });
}

// Start session (fromQuickStart false) and Start on the Quick start card (true) both come here.
async function onStartClick(fromQuickStart) {
  const character = characterById(prefs.characterId);
  if (!character) {
    const error = $("#characterError");
    error.hidden = false;
    error.textContent = "";
    error.textContent = t("setup.pickFirst"); // re-set so screen readers announce it again on every tap
    scrollToStep($("#characterStep"));
    return;
  }
  const minutes = setupPicker.read();
  if (minutes === null) {
    // This tap corrected the custom field: its message shows first. The Quick start card is
    // far above it, so the page goes to step 3, where the message is. Focus stays on the button.
    if (fromQuickStart) scrollToStep($("#durationStep"));
    return;
  }
  // The setup picker is kept, so the message would still be there after the session.
  setupPicker.clearNote();
  savePrefs({ minutes });
  if (prefs.endSound) unlockAudio(); // this tap is what allows the chime later
  // A session saved by another tab is never replaced (see "one tab at a time"): it carries on here
  // if its tab was closed, or the notice shows if that tab still runs it. Without Web Locks the
  // tabs can't tell, so Start works as it always has.
  if (locks && savedRunningSession()) {
    continueSavedSession(false);
    return;
  }
  if (!(await takeControl(false))) {
    showElsewhere();
    return;
  }
  if (session) return; // a quick second tap: already started
  countCharacterPick(character); // here, not in startSession(): Start over is not a new choice
  startSession(character, prefs.mode, prefs.minutes);
}

// ---------- session ----------

// Start, Quick start and Start new session. Returns whether this browser can save (checkStorage):
// if it can't, the new session's screen says so (after enterSession, which clears that line).
function startSession(character, mode, minutes) {
  session = {
    characterId: character.id,
    ...(character.custom && { characterName: character.name }),
    style: personalityOf(character), // kept in the history
    mode,
    durationMs: minutes * MIN,
    startedAt: Date.now(),
    distractions: [],
    endedAt: null,
    pausedAt: null,
    pauses: [],
  };
  save(SESSION_KEY, session);
  enterSession();
  const ok = checkStorage();
  if (!ok) showSaveErrorNote(t("storage.sessionNote"));
  return ok;
}

function enterSession() {
  const character = sessionCharacter(session);
  const options = session.mode === "advanced" ? ADVANCED_OPTIONS : SIMPLE_OPTIONS;

  $("#sessionInfo").textContent = t("session.info", {
    name: character.name, style: styleLabel(session.style), mode: modeName(session.mode),
    minutes: Math.round(session.durationMs / MIN),
  });
  $("#distractionPrompt").textContent = t(session.mode === "advanced" ? "session.promptAdvanced" : "session.promptSimple");

  const buttons = $("#distractionButtons");
  buttons.innerHTML = "";
  buttons.classList.toggle("advanced", session.mode === "advanced");
  buttons.classList.toggle("simple", session.mode !== "advanced");
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn level level-${option.level}`;
    button.textContent = t(option.key);
    button.addEventListener("click", () => logDistraction(option, button));
    buttons.append(button);
  }

  closePicker(false);
  closeUndo(false);
  hideSaveErrorNote();
  Object.assign(away, { from: 0, ms: 0, open: false, yes: false, hiddenAt: 0 });
  motivation.phase = null;
  $("#motivationCard").hidden = true;
  nextGoodAt = Date.now() + GOOD_EVERY_MS;
  updatePausedView(); // a session reloaded or taken over during a break comes back paused

  showScreen("sessionScreen");
  mountStage(character);
  // The button that started it is gone now: without this, focus would be lost and a screen reader
  // would say nothing. Without scrolling, so nothing moves on screen.
  $("#sessionInfo").focus({ preventScroll: true });

  clearInterval(tickTimer);
  tick();
  tickTimer = setInterval(tick, 500);
}

function tick() {
  if (!session || session.endedAt) return;
  const now = Date.now();
  const elapsed = activeElapsed(session, now);
  const remaining = session.durationMs - elapsed;

  const clock = formatClock(remaining);
  $("#timer").textContent = clock;
  $("#endClock").textContent = clock; // Stop's dialog covers #timer, so it shows the same clock
  $("#progressBar").style.width = `${(elapsed / session.durationMs) * 100}%`;

  // During a break the clock stands still and only the break counter moves: no motivation phase,
  // no "doing well" pose, and the session can't run out.
  if (session.pausedAt) {
    $("#breakClock").textContent = formatBreak(now - session.pausedAt);
    document.title = t("session.pausedTitle");
    return;
  }
  document.title = `${clock} · ${BASE_TITLE}`;

  updateMotivationPhase(elapsed);
  updateLengthButtons();

  if (now >= nextGoodAt) {
    if (!stage.reacting && remaining >= GOOD_REACTION_MS) react("good", 0);
    nextGoodAt = now + GOOD_EVERY_MS;
  }

  if (remaining <= 0) onTimerRanOut(true);
}

function logDistraction(option, button) {
  if (!session || session.endedAt) return;
  const distraction = { at: Date.now(), level: option.level, ms: option.ms || 0, category: null };
  addDistraction(distraction, Boolean(option.askRestart));
  schedulePicker(distraction, button);
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
  announce(describePose(stage.character, `level${distraction.level}`));
  updateLengthButtons();
}

// Advanced mode: a length longer than the free time (time so far minus the distraction
// time already logged) can't have happened, so its button is disabled. Simple mode has
// no lengths, so nothing changes there.
function updateLengthButtons() {
  if (!session || session.mode !== "advanced") return;
  const elapsed = activeElapsed(session);
  const logged = session.distractions.reduce((sum, d) => sum + (d.ms || 0), 0);
  const free = elapsed - logged;
  $("#distractionButtons").querySelectorAll("button").forEach((button, i) => {
    const option = ADVANCED_OPTIONS[i];
    button.disabled = !option.alwaysEnabled && option.ms > free;
  });
}

// ---------- undo ----------

// Undo sits in Motivate me's cell, so Stop stays where it is the whole time. The seconds
// left are shown on the button itself ("Undo · 4"), not as a bar, so they can't be mistaken
// for a time limit on the category picker right above it.
// Undo only applies to the latest distraction: a newer tap moves it there and restarts the window.
function openUndo(distraction, prevNextGoodAt, setRestart) {
  closeUndo(false);
  Object.assign(undo, { distraction, prevNextGoodAt, setRestart, closesAt: Date.now() + UNDO_WINDOW_MS });
  const button = $("#undoButton");
  const motivate = $("#motivateButton");
  const hadFocus = document.activeElement === motivate;
  updateUndoCountdown();
  motivate.hidden = true;
  button.hidden = false;
  if (hadFocus) button.focus(); // keyboard focus stays in the same spot
  undo.timer = setTimeout(() => closeUndo(true), UNDO_WINDOW_MS);
  undo.countdownTimer = setInterval(updateUndoCountdown, 250);
}

function updateUndoCountdown() {
  const seconds = Math.max(1, Math.ceil((undo.closesAt - Date.now()) / 1000));
  $("#undoSeconds").textContent = String(seconds);
}

// thenAsk: open the continue/restart dialog now if one is waiting for the Undo window.
function closeUndo(thenAsk) {
  clearTimeout(undo.timer);
  clearInterval(undo.countdownTimer);
  undo.distraction = null;
  const button = $("#undoButton");
  const hadFocus = document.activeElement === button;
  button.hidden = true;
  $("#motivateButton").hidden = Boolean(session && session.pausedAt); // Resume has the cell during a break
  if (hadFocus) $("#motivateButton").focus(); // keyboard focus stays in the same spot
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
  announce(t("announce.undo")); // replaces the reaction's line if it hasn't been read yet
  updateLengthButtons();
  // An earlier "10+ min" / "Completely" that wasn't undone still asks, now.
  closeUndo(true);
}

// ---------- distraction category picker ----------

function buildCategoryButtons() {
  const buttons = $("#categoryButtons");
  buttons.innerHTML = ""; // built again after a language switch
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
function schedulePicker(distraction, button) {
  closePicker(false);
  picker.distraction = distraction;
  picker.returnFocus = button;
  picker.showTimer = setTimeout(() => showPicker(PICKER_AUTO_CLOSE_MS), PICKER_DELAY_MS);
}

// Announced only when it appears, not when it was already open (after Keep going). Polite, like
// the reaction's line, so it's read after that one, not over it. Focus stays where it is.
// On landscape phones the picker takes the distraction buttons' place and wins over the motivation
// card (they'd share that place): the card closes when the picker opens. If focus was on what the
// picker now covers (the distraction button just pressed, or the card), it moves to Skip, the
// picker's first control, so it isn't lost; closing the picker brings it back to that button.
function showPicker(closeInMs) {
  const box = $("#categoryPicker");
  const card = $("#motivationCard");
  const compact = box.hidden && isCompactLandscape();
  const coveredFocus =
    compact && ($(".distraction").contains(document.activeElement) || card.contains(document.activeElement));
  if (compact) card.hidden = true;
  if (box.hidden) announce(t("announce.picker"));
  box.hidden = false;
  if (coveredFocus) $("#skipCategoryButton").focus({ preventScroll: true });
  picker.closesAt = Date.now() + closeInMs;
  picker.hideTimer = setTimeout(() => closePicker(true), closeInMs);
}

// While Stop's question is open, the picker's timers are stopped: its safety close
// would ask a waiting continue/restart question, which must not open on top of that dialog.
// The picker stays (behind the dialog, where it can't be tapped) and keeps its distraction,
// so a waiting continue/restart question keeps waiting for it, as before.
function pausePicker() {
  clearTimeout(picker.showTimer);
  clearTimeout(picker.hideTimer);
}

// After Keep going: the picker is back as it was, with the time it had left. If its safety
// close would have happened in the meantime, it closes now instead (category stays null).
// (Take a break closes it as Skip instead: see takeBreak.)
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
// Focus inside it (a category or Skip was tapped) goes back to the distraction button that was
// tapped, or to the heading above the buttons if that one is disabled now (Advanced mode), so
// it isn't lost. Before the restart question, so focus comes back there when that closes.
// On landscape phones, if the motivation card is open (it waited under the picker), the buttons
// stay covered by it, so focus goes to the card's × instead.
function closePicker(thenAsk) {
  clearTimeout(picker.showTimer);
  clearTimeout(picker.hideTimer);
  const box = $("#categoryPicker");
  const hadFocus = box.contains(document.activeElement);
  box.hidden = true;
  if (announcer.text === t("announce.picker")) clearAnnouncement();
  if (hadFocus) {
    const button = picker.returnFocus;
    const covered = isCompactLandscape() && !$("#motivationCard").hidden;
    const target = covered
      ? $("#motivationClose")
      : button && button.isConnected && !button.disabled
        ? button
        : $("#distractionPrompt");
    target.focus({ preventScroll: true });
  }
  picker.distraction = null;
  picker.returnFocus = null;
  if (thenAsk) askPendingRestart();
}

// Waits while the category picker is open (or about to open), the Undo window is open, the time
// away card is open or waiting, or during a break: closing any of them (or Resume) calls this again.
function askPendingRestart() {
  if (
    session && session.restartPending && !session.pausedAt &&
    !picker.distraction && !undo.distraction && !away.ms
  ) {
    askContinueOrRestart();
  }
}

let restartPicker = null; // built again every time the dialog opens

// Step 1 of the continue/restart dialog (its texts' keys). Simple mode has no times, so it doesn't
// say "long break".
const RESTART_TEXTS = {
  simple: { title: "restart.simpleTitle", text: "restart.simpleText" },
  advanced: { title: "restart.advancedTitle", text: "restart.advancedText" },
};

// Step 1 asks only "continue or start over"; step 2 (after Start over) asks for the new length,
// so the preselected chip can't be read as "how long was the distraction?". One dialog, so
// everything that closes it (answer, loseControl, timer end) works the same in both steps.
// The dialog is labelled by the visible step's title, so it's read out with the step. Step 2:
// focus goes to its title, so a screen reader reads the question. Back to step 1: focus goes to
// Start over, the button that left it.
function showRestartStep(step) {
  const dialog = $("#restartDialog");
  $("#restartStep1").hidden = step !== 1;
  $("#restartStep2").hidden = step !== 2;
  if (step === 1) {
    dialog.setAttribute("aria-labelledby", "restartTitle");
    dialog.setAttribute("aria-describedby", "restartText");
  } else {
    dialog.setAttribute("aria-labelledby", "restartStep2Title");
    dialog.removeAttribute("aria-describedby");
  }
  if (!dialog.open) return;
  if (step === 2) {
    $("#restartStep2Title").focus();
  } else {
    $("#restartOverButton").focus();
    // After the focus move: leaving the custom field can correct it and show the note.
    // The chosen length stays for the next Start over in this opening, the note doesn't.
    if (restartPicker) restartPicker.clearNote();
  }
}

// Esc / Android Back: in step 1 the dialog closes ("" = continue), as before. In step 2 it goes
// back to step 1 instead. If the browser won't let that be stopped (Chrome allows one per tap),
// the dialog closes and it counts as continue.
function onRestartCancel(event) {
  if ($("#restartStep2").hidden || !event.cancelable) return;
  event.preventDefault();
  showRestartStep(1);
}

// "Start new session" keeps the dialog open when this tap corrected the custom field (see durationPicker).
function onStartNewSessionClick(event) {
  if (restartPicker && restartPicker.read() === null) event.preventDefault();
}

async function askContinueOrRestart() {
  if (!session || session.endedAt) return;
  const dialog = $("#restartDialog");
  if (dialog.open) return;

  // Every opening starts at step 1 with fresh chips, even after a reload or a takeover.
  const texts = RESTART_TEXTS[session.mode] || RESTART_TEXTS.simple;
  $("#restartTitle").textContent = t(texts.title);
  $("#restartText").textContent = t(texts.text);
  showRestartStep(1);
  restartPicker = durationPicker($("#restartDuration"), Math.round(session.durationMs / MIN));

  // "Save the first X to history": X is the time so far, and if it's kept, the
  // session is saved as ending right now, so what's shown is what's saved. Only
  // offered when it could be saved at all (same 1-minute rule as finishing).
  const cutAt = Date.now();
  const sessionTime = activeElapsed(session, cutAt); // without the breaks
  const canSave = sessionTime >= HISTORY_MIN_MS;
  $("#restartSaveRow").hidden = !canSave;
  $("#restartSave").checked = true;
  $("#restartSaveText").textContent = t("restart.save", { duration: formatDuration(sessionTime) });

  const asked = session;
  const answer = await ask(dialog);
  if (!session || session.endedAt) return; // the timer ran out while the question was open
  if (session !== asked) return; // another tab took the session over meanwhile (loseControl)

  // Answered (Esc in step 1 counts as "continue"), so a reload won't ask again.
  session.restartPending = false;
  save(SESSION_KEY, session);
  if (answer === "restart") {
    const { mode } = session;
    const character = sessionCharacter(session); // also if it was deleted in another tab meanwhile
    // The checkbox only matters here: "Continue" keeps the session running.
    const saved = canSave && $("#restartSave").checked ? saveFinishedSession({ ...session, endedAt: cutAt }, "startOver") : "";
    if (saved === "saved" || saved === "exists") requestPersistentStorage();
    // value(), not read(): Start new session's click already let it through, so it must never block here.
    // a waiting time away card is dropped with the old session
    const canSaveNow = startSession(character, mode, restartPicker.value());
    // Only one line fits: if nothing can be saved at all, the new session's note (already shown by
    // startSession) also covers the lost first part.
    if (saved === "failed" && canSaveNow) showSaveErrorNote(t("session.saveFirstPartFailed"));
  } else {
    askPendingAway();
  }
}

// The bar's Stop button (labelled End session during a break). Running, its dialog asks "Stop for
// now?" and offers Take a break above the divider; the save checkbox below it belongs to ending.
// During a break pausing is no longer an option: the old "End this session now?" without that part.
async function onEndClick() {
  const paused = Boolean(session.pausedAt);
  // Tapped during the Undo window: the distraction stays logged and Undo is over for good (it
  // doesn't come back after Keep going). false: a waiting restart question doesn't open now.
  closeUndo(false);
  // The picker waits behind this dialog, and a waiting restart question waits until it's answered.
  pausePicker();
  $("#endTitle").textContent = t(paused ? "end.titlePaused" : "end.titleRunning");
  $("#endBreak").hidden = paused;
  // Running: "Timer still running · 16:41" under the title, ticked by tick(). It's the dialog's
  // description, read once when it opens; no live region, so the ticking time isn't announced.
  // The attribute goes during a break: screen readers read a description even when it's hidden.
  const endDialog = $("#endDialog");
  $("#endRunning").hidden = paused;
  if (paused) {
    endDialog.removeAttribute("aria-describedby");
  } else {
    $("#endClock").textContent = formatClock(session.durationMs - activeElapsed(session));
    endDialog.setAttribute("aria-describedby", "endRunning");
  }
  // "Save this session to your history": only offered when it could be saved at all
  // (same 1-minute rule as saving, on session time without breaks). Ticked every time the dialog
  // opens, never remembered.
  const canSave = activeElapsed(session) >= HISTORY_MIN_MS;
  $("#endSaveRow").hidden = !canSave;
  $("#endSave").checked = true;
  const asked = session;
  const answer = await ask(endDialog);
  if (session !== asked) return; // another tab took the session over meanwhile (loseControl)
  if (answer === "end" && session && !session.endedAt) {
    // During a break the session ends where the break started: the break isn't session time.
    finishSession(session.pausedAt || Date.now(), !canSave || $("#endSave").checked);
  } else if (answer === "break" && session && !session.endedAt && !session.pausedAt && Date.now() < effectiveEnd(session)) {
    takeBreak();
  } else {
    resumePicker();
    askPendingAway();
    askPendingRestart();
  }
}

// ---------- break (Stop → Take a break) ----------

// A break is a chosen pause, not a distraction: the clock stops, and the planned end moves later by
// the length of every break. The break is never session time (pausedTotal in history-store.js).
// Saved in ct_session_v1 (pausedAt, pauses), so a reload, reopen or another tab's Continue here
// comes back paused, however long the break has been. While paused: the character stays in its
// initial pose (blinks and breathing go on, no reactions), the distraction block is replaced by
// the paused card, Resume takes Motivate me's cell, no leave reminder or time away card, and the
// screen may turn off. A waiting continue/restart or time away question is asked after Resume.

// The planned end, moved later by the breaks that are over. A running session's clock reaches 0 here.
function effectiveEnd(s) {
  return s.startedAt + s.durationMs + pausedTotal(s.pauses);
}

// Session time so far, without breaks. During a break it stands still at the moment it started.
function activeElapsed(s, now = Date.now()) {
  const until = s.pausedAt || now;
  return Math.min(Math.max(0, until - s.startedAt - pausedTotal(s.pauses)), s.durationMs);
}

// The paused look (dimmed timer, grey progress bar, paused card, Resume, "End session"), or the
// running one. Only ever shows or hides elements, so nothing on the screen moves.
function updatePausedView() {
  const paused = Boolean(session && session.pausedAt);
  $("#sessionScreen").classList.toggle("paused", paused);
  $("#pausedCard").hidden = !paused;
  $("#resumeButton").hidden = !paused;
  $("#motivateButton").hidden = paused || Boolean(undo.distraction);
  $("#endButton").textContent = t(paused ? "session.endSession" : "session.stop");
  if (paused) {
    $("#motivationCard").hidden = true;
    $("#categoryPicker").hidden = true;
  }
}

// "Take a break" in Stop's dialog. The break starts now. A picker that was open closes as Skip
// (its category stays null); the Undo window was already closed by Stop.
function takeBreak() {
  closePicker(false);
  closeUndo(false);
  session.pausedAt = Date.now();
  if (!Array.isArray(session.pauses)) session.pauses = [];
  save(SESSION_KEY, session);
  cancelLeaveReminder();
  stopReaction();
  setPose("initial");
  updatePausedView();
  tick();
  $("#resumeButton").focus({ preventScroll: true });
  announce(t("announce.paused"));
  updateWakeLock(); // released: the screen may turn off now
}

// Resume: the break is saved, the clock runs again from where it stopped and the character shows
// its refocus pose, as after a distraction. Then what waited for the break is asked.
function resumeFromBreak() {
  if (!session || session.endedAt || !session.pausedAt) return;
  const now = Date.now();
  const ms = now - session.pausedAt;
  if (!Array.isArray(session.pauses)) session.pauses = [];
  if (ms > 0) session.pauses.push({ at: session.pausedAt, ms });
  session.pausedAt = null;
  save(SESSION_KEY, session);
  nextGoodAt = now + GOOD_EVERY_MS;
  updatePausedView();
  clearTimeout(stage.reactTimer);
  stage.reacting = true; // the refocus pose counts as reacting: no blink over it
  refocus();
  tick();
  // The prompt above the distraction buttons, where the session goes on.
  $("#distractionPrompt").focus({ preventScroll: true });
  announce(t("announce.resumed"));
  updateWakeLock(); // this tap lets the browser keep the screen on again
  askPendingAway();
  askPendingRestart();
}

// The break counter: "2:14", "1:05:09" from an hour on, counting up with no limit.
function formatBreak(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
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
  return saved && !saved.endedAt && sessionCharacter(saved) ? saved : null;
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
  cancelLeaveReminder();
  stopStage();
  closePicker(false);
  closeUndo(false);
  Object.assign(away, { from: 0, ms: 0, open: false, yes: false, hiddenAt: 0 });
  session = null;
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  document.title = BASE_TITLE;
  showElsewhere();
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
  // A custom character that still exists keeps its current name.
  const character = sessionCharacter(saved);
  session.style = personalityOf(character);
  if (character.custom && !character.ghost) session.characterName = character.name;
  if (session.pausedAt) delete session.leftAt; // nothing is measured while paused
  save(SESSION_KEY, session);
  // A paused session never runs out: it always comes back paused, however long the break.
  if (!saved.pausedAt && Date.now() >= effectiveEnd(saved)) {
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
    showElsewhere();
    return;
  }
  if (session) return; // a quick second tap: it's already running here
  if (resumeSavedSession()) return;
  releaseControl();
  renderCharacterList();
  showScreen("setupScreen");
}

function onContinueHereClick() {
  setupView.saved = null; // the setup screen comes back after this session, as after any other
  if (prefs.endSound) unlockAudio(); // this tap is what allows the chime later, as on Start
  continueSavedSession(true);
}

// Every way to the notice comes here: Start (or Quick start) while another tab runs the session,
// start-up with the session running elsewhere, another tab's Continue here (loseControl), and the
// switch by itself below. The screen before it is hidden now, so focus would be lost: it goes to
// the heading, which a screen reader then reads. Without scrolling and with no focus outline.
function showElsewhere() {
  showScreen("elsewhereScreen");
  $("#elsewhereTitle").focus({ preventScroll: true });
}

// A tab showing the setup screen switches to the notice by itself when another tab runs a
// session, so Start doesn't have to be tapped to find out. Only from the plain setup screen:
// never from the summary, the "Welcome back" question (session is set then), the ragebait
// warning or any other open dialog, and never while this tab is starting a session itself.
// Without Web Locks the tabs can't tell, so nothing changes there.
function canShowElsewhere() {
  return Boolean(
    locks && !$("#setupScreen").hidden && !session && !control.hold && !control.pending &&
    !document.querySelector("dialog[open]") && savedRunningSession()
  );
}

// saved: where the setup screen was when the notice replaced it by itself (scroll position, the
// focused element and, for a character card, its id: the cards are rebuilt on the way back), so it
// looks the same when it comes back. In memory only. Cleared by Continue here.
const setupView = { saved: null };

function showElsewhereByItself() {
  const focused = document.activeElement;
  setupView.saved = {
    scrollY: window.scrollY,
    focused: focused && focused !== document.body ? focused : null,
    cardId: focused && focused.classList.contains("char-card") ? focused.dataset.id : null,
  };
  showElsewhere();
}

// Back on the setup screen after the notice (the session ended in the other tab): the scroll
// position and focus it had before the notice replaced it by itself. Nothing else needs restoring:
// the choices live in this tab's prefs and the setup screen's fields, which the notice leaves alone.
function restoreSetupView() {
  const saved = setupView.saved;
  setupView.saved = null;
  if (!saved) return;
  window.scrollTo(0, saved.scrollY);
  const target = saved.cardId
    ? $("#characterStep").querySelector(`.char-card[data-id="${CSS.escape(saved.cardId)}"]`)
    : saved.focused;
  if (target && target.isConnected) target.focus({ preventScroll: true });
}

// The notice replaced the setup screen by itself and is still shown, with no answer pending here.
function elsewhereByItself() {
  return Boolean(setupView.saved && !$("#elsewhereScreen").hidden && !control.hold && !control.pending);
}

// The setup screen comes back as it was before the notice.
function backToSetup() {
  renderCharacterList();
  showScreen("setupScreen");
  restoreSetupView();
}

// The page is shown again (another tab or app, or the back/forward cache). Android can freeze a
// tab in the background, so it may have missed the storage event of a session started elsewhere.
// The saved session alone isn't enough here: its tab may have been closed meanwhile, and then
// Start resumes it, as before. So it only switches if another tab holds the lock (this one doesn't).
// The other way round too: a notice shown by itself goes back to the setup screen when no tab
// holds the lock any more. Closing a tab saves its session one last time (the leave time), so the
// notice can come up in the very moment that tab goes away, and no storage event follows.
async function checkSessionElsewhere() {
  if (document.hidden || !locks || (!canShowElsewhere() && !elsewhereByItself())) return;
  let held = [];
  try {
    ({ held } = await locks.query());
  } catch {
    return;
  }
  if (document.hidden) return;
  const heldElsewhere = held.some((lock) => lock.name === SESSION_LOCK);
  // Checked again: something may have changed while the browser answered.
  if (heldElsewhere && canShowElsewhere()) showElsewhereByItself();
  else if (!heldElsewhere && elsewhereByItself()) backToSetup();
}

// "storage" only fires in the other tabs of the site, never in the one that saved. Every save of
// the running session fires it (each distraction, each leave), so both cases only act once:
// a session started in another tab replaces the setup screen with the notice, and the notice goes
// when the session ends there (finished or discarded), bringing the setup screen back as it was.
function onStorage(event) {
  if (event.key !== SESSION_KEY && event.key !== null) return; // null: all storage was cleared
  if (canShowElsewhere()) {
    showElsewhereByItself();
    return;
  }
  if ($("#elsewhereScreen").hidden || savedRunningSession()) return;
  backToSetup();
}

// ---------- time away ----------

// The page was hidden or shown again. The browser can't tell another app or tab from a locked
// screen, so the card only says "away". Nothing is ever logged without a tap. During a break
// leaving is fine: no leave time is saved and there's no reminder or card.
function onVisibilityChange() {
  if (!document.hidden) cancelLeaveReminder(); // any way back, also after the session ended meanwhile
  if (!session || session.endedAt || session.pausedAt) return;
  if (document.hidden) noteLeave();
  else noteReturn();
}

// Saved at once: on Android a background tab is often discarded and reloaded on return.
// If a card is already open or waiting, leftAt keeps its start: the time away then runs from
// the first leave to the last return, so after such a reload the card still covers all of it.
function noteLeave() {
  away.hiddenAt = Date.now();
  showLeaveReminder();
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

// An open question (Stop, continue/restart) comes first: closing it calls this again. During a
// break it waits for Resume.
function askPendingAway() {
  if (!away.ms || away.open || !session || session.endedAt || session.pausedAt) return;
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
  $("#awayTitle").textContent = t("away.title", { duration: formatDuration(away.ms) });
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

// ---------- leave reminder (system notification) ----------

// Optional: the setup checkbox "Remind me if I leave the app" (prefs.leaveReminder, off by default).
// Page hidden during a running session: one system notification at once, shown through the
// service worker, because new Notification() doesn't work on Android Chrome. Tapping it brings the
// app back (notificationclick in sw.js). Coming back any way closes it. It never logs anything: the
// time away card handles the return as always. It's the app speaking, never a character.
// No timer: Android throttles hidden pages hard, so a delayed one came late or not at all. And no
// waiting either: showNotification is called inside the visibilitychange handler itself, with the
// registration fetched beforehand, because iOS freezes a Home Screen app very soon after it's left.
// No push, no backend.
const LEAVE_REMINDER_TAG = "ct-leave-reminder"; // a new notification with this tag replaces the old one
// The one switch for iPhones and iPads. Untested on a real device: false turns it off there again.
const LEAVE_REMINDER_ON_IOS = true;
// registration: the service worker registration, kept ready for the synchronous call (see above).
// unloading: set by pagehide. It comes before the visibilitychange of a reload, a closed tab or a
// link to another page, and these never get a reminder: the session carries on as before and is
// picked up on the next open. Cleared by pageshow (back from the back/forward cache).
const leaveReminder = { registration: null, unloading: false };

// iPhones and iPads: only in the Home Screen app. Safari tabs have no web notifications at all
// (there the checks below are false anyway: iOS only turns these APIs on for Home Screen apps).
function leaveReminderSupported() {
  try {
    return (
      (!isIOS() || (LEAVE_REMINDER_ON_IOS && inHomeScreenApp())) &&
      "Notification" in window && "serviceWorker" in navigator &&
      "ServiceWorkerRegistration" in window && "showNotification" in ServiceWorkerRegistration.prototype
    );
  } catch {
    return false;
  }
}

function notificationsAllowed() {
  return leaveReminderSupported() && Notification.permission === "granted";
}

// Unsupported: the row stays hidden. Permission taken back (or reset) since the box was ticked:
// it shows unticked, and permission is never asked for again without a tap.
function initLeaveReminder() {
  if (!leaveReminderSupported()) return;
  if (prefs.leaveReminder && !notificationsAllowed()) savePrefs({ leaveReminder: false });
  const check = $("#leaveReminderCheck");
  check.checked = prefs.leaveReminder;
  check.addEventListener("change", onLeaveReminderChange);
  $("#leaveReminderRow").hidden = false;
  keepLeaveReminderRegistration();
}

// Keeps the registration for showLeaveReminder. getRegistration answers at once if the service
// worker is already set up. On a first visit it isn't yet (sw-register.js registers it after this
// load), so ready fills it in as soon as the worker is active. The object stays the same after an
// update (its active worker changes), so this is only needed once per page.
function keepLeaveReminderRegistration() {
  const keep = (registration) => {
    if (registration) leaveReminder.registration = registration;
  };
  try {
    navigator.serviceWorker.getRegistration().then(keep, () => {});
    navigator.serviceWorker.ready.then(keep, () => {});
  } catch {
    // not supported: no reminder
  }
}

// Browsers only show the permission prompt inside a tap, so it's asked right here.
// Denied (now or earlier): unticked, with the hint. Prompt closed without an answer: just unticked.
async function onLeaveReminderChange() {
  const check = $("#leaveReminderCheck");
  const hint = $("#leaveReminderHint");
  hint.hidden = true;
  if (!check.checked) {
    savePrefs({ leaveReminder: false });
    return;
  }
  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await new Promise((resolve) => {
        const asked = Notification.requestPermission(resolve); // older browsers: the callback only
        if (asked) asked.then(resolve, () => resolve("default"));
      });
    } catch {
      permission = "default";
    }
  }
  const allowed = permission === "granted";
  check.checked = allowed;
  savePrefs({ leaveReminder: allowed });
  if (permission === "denied") {
    hint.hidden = false;
    hint.textContent = t("setup.leaveReminderBlocked"); // set after showing it, so screen readers announce it
  }
}

// More than AWAY_ASK_AFTER_MS of the session must be left: a session ending sooner gets its chime
// and summary instead. Only the tab running the session (see "one tab at a time"), never during a break.
function leaveReminderWanted() {
  return Boolean(
    prefs.leaveReminder && notificationsAllowed() && document.hidden && !leaveReminder.unloading &&
    session && !session.endedAt && !session.pausedAt && (!locks || control.hold) &&
    effectiveEnd(session) - Date.now() > AWAY_ASK_AFTER_MS,
  );
}

// From noteLeave, i.e. inside the visibilitychange handler. Every leave shows it again; the same
// tag means there's never more than one. Sound and vibration: the phone's defaults for the site.
// renotify: a notification that replaces one with the same tag (e.g. an older reminder still in the
// notification shade) is silent without it. Browsers that don't support it (Safari, Firefox) skip
// it; it only throws with an empty tag, and the tag here is never empty.
// Its text is in this page's language (t): the service worker only handles the tap, so it never
// needs to know the language (it can't read the saved prefs anyway).
function showLeaveReminder() {
  if (!leaveReminderWanted()) return;
  const registration = leaveReminder.registration;
  if (!registration || !registration.active) return; // no service worker yet: no reminder
  let shown;
  try {
    shown = registration.showNotification(t("notification.title"), {
      body: t("notification.body"),
      icon: "icons/icon-192.png",
      tag: LEAVE_REMINDER_TAG,
      renotify: true,
    });
  } catch {
    return; // unsupported: the session carries on without it
  }
  Promise.resolve(shown).then(
    // Came back, or the session ended, while it was being shown.
    () => {
      if (!document.hidden || !session || session.endedAt) cancelLeaveReminder();
    },
    () => {}, // refused: the session carries on without it
  );
}

// Closes it if it's showing: on every return to the page, every end of the session in this tab,
// and at start-up.
function cancelLeaveReminder() {
  if (!notificationsAllowed()) return; // nothing can be showing
  try {
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => (registration ? registration.getNotifications({ tag: LEAVE_REMINDER_TAG }) : []))
      .then((notifications) => notifications.forEach((notification) => notification.close()))
      .catch(() => {});
  } catch {
    // not supported: fine
  }
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
  cancelLeaveReminder();
  stopStage();
  closePicker(false);
  closeUndo(false);
  // Ended during a break: endedAt is when it started, and that open break isn't kept.
  session.endedAt = Math.min(endedAt, effectiveEnd(session));
  session.pausedAt = null;
  const saved = keep ? saveFinishedSession(session) : "";
  if (saved === "saved" || saved === "exists") requestPersistentStorage();
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
  renderSummary(saved === "failed");
  showScreen("summaryScreen");
  // Focus was on the session (now hidden): the title gets it, so a screen reader reads the result.
  $("#summaryTitle").focus({ preventScroll: true });
}

// Back soon after the end (or watching it end): saved as a full session, as always.
// Back much later: the app can't tell whether the user kept focusing, so it asks.
// running: called by the running timer (not on start-up after a reload or reopen).
// The chime only plays if the end is happening right now, not when someone comes back later.
function onTimerRanOut(running) {
  const endedAt = effectiveEnd(session);
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
  cancelLeaveReminder();
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

  const character = sessionCharacter(session);
  $("#lateText").textContent = t("late.text", {
    minutes: Math.round(session.durationMs / MIN), mode: modeName(session.mode), name: character.name,
    ago: formatTimeAgo(Date.now() - endedAt),
  });

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
// Not on landscape phones: there the card takes the distraction buttons' place, above the bar.
function scrollMotivationIntoView() {
  if (isCompactLandscape()) return;
  const overlap = $("#motivationCard").getBoundingClientRect().bottom - ($(".session-bar").getBoundingClientRect().top - 12);
  if (overlap > 0) window.scrollBy({ top: overlap, behavior: "smooth" });
}

// ---------- landscape phones ----------

// The compact layout in style.css ("Layout (screen sizes)" in the README): the category picker
// and the motivation card take the distraction buttons' place in the right column, so only one
// of them can be seen at a time. The layout itself is CSS; these only cover what CSS can't:
// which one wins (showPicker), where focus goes (closePicker) and the card's text size.
const COMPACT_LANDSCAPE = matchMedia("(orientation: landscape) and (max-height: 500px)");

function isCompactLandscape() {
  return COMPACT_LANDSCAPE.matches;
}

// The card is exactly the size of the distraction buttons' block there. If its message doesn't
// fit, the text gets a step smaller (fit-1, then fit-2 in style.css); if even that doesn't
// fit, the card scrolls inside itself. Never the other way round: it can't push the bar down.
const CARD_FIT_STEPS = ["fit-1", "fit-2"];

function fitMotivationCard() {
  const card = $("#motivationCard");
  card.classList.remove(...CARD_FIT_STEPS);
  if (card.hidden || !isCompactLandscape()) return;
  for (const step of CARD_FIT_STEPS) {
    if (card.scrollHeight <= card.clientHeight) return;
    card.classList.remove(...CARD_FIT_STEPS);
    card.classList.add(step);
  }
}

// Again whenever the card's size changes: rotating the phone, or a new message (showMotivation).
function initMotivationFit() {
  if (typeof ResizeObserver === "function") new ResizeObserver(fitMotivationCard).observe($("#motivationCard"));
  if (typeof COMPACT_LANDSCAPE.addEventListener === "function") COMPACT_LANDSCAPE.addEventListener("change", fitMotivationCard);
}

function showMotivation() {
  const message = MOTIVATION[motivation.phase][motivation.index];
  motivation.shown = true;
  $("#motivationBadge").textContent = t(message.type === "fact" ? "motivation.fact" : "motivation.boost");
  $("#motivationBadge").dataset.type = message.type;
  $("#motivationText").textContent = message.text;
  $("#motivationCard").hidden = false;
  fitMotivationCard();
}

// ---------- summary ----------

// The pose, title and message all follow the session result (great / okay / rough / early / short).
// Both modes show a factual line (time and distractions); Simple mode also shows a sentence above it.
// A short session only shows the title and the "not saved" note, in both modes.
// saveFailed: the browser refused to store the session, so the summary says so.
function renderSummary(saveFailed) {
  const character = sessionCharacter(session);
  const result = sessionResult(session);
  const short = result === "short";
  const img = $("#summaryImg");
  const pose = (SUMMARY_POSES[personalityOf(character)] || SUMMARY_POSES.kind)[result];
  img.alt = describePose(character, pose);
  setPoseImage(img, character, pose);

  $("#summaryTitle").textContent = t(`summary.title.${result}`);
  const percentEl = $("#summaryPercent");
  const messageEl = $("#summaryMessage");
  const textEl = $("#summaryText");
  const noteEl = $("#summaryNote");
  noteEl.textContent = t("summary.shortNote");
  noteEl.hidden = !short;
  // Reset every time, so the next summary never shows an old error. The text is only set when it's
  // shown, so a screen reader reads it once.
  const saveErrorEl = $("#summarySaveError");
  saveErrorEl.textContent = saveFailed ? t("summary.saveError") : "";
  saveErrorEl.hidden = !saveFailed;

  const { elapsedMs: elapsed, distractedMs: distracted, focusPercent: percent } = sessionFocus(session);
  const count = session.distractions.length;
  const logged = t("summary.logged", { count });
  // Ended before the timer ran out: also say how long it was meant to be.
  const planned = elapsed < session.durationMs ? t("summary.planned", { duration: formatDuration(session.durationMs) }) : "";
  textEl.hidden = short; // means nothing after a few seconds

  if (session.mode === "advanced") {
    messageEl.hidden = true;
    percentEl.textContent = t("summary.percent", { percent });
    percentEl.hidden = short;
    textEl.textContent = t("summary.advancedLine", {
      focused: formatDuration(elapsed - distracted), elapsed: formatDuration(elapsed), planned, logged,
    });
  } else {
    // Simple mode has no lengths, so the elapsed time includes the distractions:
    // it's the session's length, not focused time. The character's sentence comes first.
    percentEl.hidden = true;
    const messages = SIMPLE_SUMMARY_MESSAGES[result];
    messageEl.hidden = !messages; // a short session only shows the note
    if (messages) messageEl.textContent = messages[Math.floor(Math.random() * messages.length)];
    textEl.textContent = t("summary.simpleLine", { elapsed: formatDuration(elapsed), planned, logged });
  }

  // Breaks: one factual line, only when there were any (and not for a short session).
  const pauses = cleanPauses(session.pauses);
  const pausesEl = $("#summaryPauses");
  pausesEl.hidden = short || pauses.length === 0;
  pausesEl.textContent = pauses.length ? formatPauses(pauses, formatDuration) : "";

  // Top 3 picked categories. Hidden if none was picked this session, or if it was short.
  const top = countCategories(session.distractions).slice(0, 3);
  const categoriesEl = $("#summaryCategories");
  categoriesEl.hidden = short || top.length === 0;
  categoriesEl.textContent = t("summary.categories", {
    count: top.length,
    list: top.map((category) => t("summary.categoryCount", { label: category.label, count: category.count })).join(t("common.listSeparator")),
  });
}

// ---------- formatting ----------

// "simple" / "advanced" as shown: "Simple" / "Advanced" in English.
function modeName(mode) {
  return t(`mode.${mode}`);
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
  if (minutes === 0) return t("time.sec", { seconds });
  return seconds ? t("time.minSec", { minutes, seconds }) : t("time.min", { minutes });
}

// "45 min ago", "3 hours ago", "2 days ago" (English) / "45 perce", "3 órája" (Hungarian): Intl's
// relative time in the language's relativeTimeStyle (js/i18n/languages.js).
function formatTimeAgo(ms) {
  const minutes = Math.floor(ms / MIN);
  if (minutes < 60) return I18N.formatAgo(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return I18N.formatAgo(hours, "hour");
  return I18N.formatAgo(Math.floor(hours / 24), "day");
}

// ---------- language switch ----------

// A row tapped in the language sheet (js/language-picker.js) while the setup screen shows (the only
// screen with the language button). js/i18n.js has already put the page's own text (data-i18n) in
// the new language; this builds the parts made here again, in place, keeping every choice and the
// typed minutes. Everything else (session, summary, dialogs) is built in the current language
// whenever it's next shown. A session that's running in this tab can't be on screen now; one in
// another tab keeps its language until that tab is loaded again.
function onLanguageChange() {
  renderCharacterList();
  buildCategoryButtons();
  setupPicker.relabel();
  setupPicker.clearNote(); // a correction message in the old language: it comes back on the next Start
  updateQuickStart();
  // Notes that are showing get their text again (they're only set when they appear).
  const storageNote = $("#setupStorageNote");
  if (!storageNote.hidden) storageNote.textContent = t("storage.setupNote");
  const characterError = $("#characterError");
  if (!characterError.hidden) characterError.textContent = t("setup.pickFirst");
  const hint = $("#leaveReminderHint");
  if (!hint.hidden) hint.textContent = t("setup.leaveReminderBlocked");
}

// ---------- start-up ----------

function init() {
  // On window, capture phase: runs before every other click listener (see "tap guard").
  window.addEventListener("click", onGuardedClick, true);
  renderCharacterList();
  bindChoiceGroups();
  bindSettingChecks();
  initLeaveReminder();
  cancelLeaveReminder(); // e.g. its tap reopened the app after the browser discarded the page
  buildCategoryButtons();
  initMotivationFit();
  setupPicker = durationPicker($("#setupDuration"), prefs.minutes);
  // Capture phase, so the count goes up before the press moves focus (see pressCount).
  for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, () => pressCount++, true);

  // Wrapped, so the click event doesn't arrive as fromQuickStart.
  $("#startButton").addEventListener("click", () => onStartClick(false));
  $("#quickStartButton").addEventListener("click", () => onStartClick(true));
  $("#quickStartChange").addEventListener("click", onQuickStartChange);
  // Chips and the Custom field are inside #setupDuration: their events bubble up to it, after
  // the picker's own handlers have set the value.
  for (const type of ["click", "input", "change"]) $("#setupDuration").addEventListener(type, updateQuickStart);
  $('#restartDialog button[value="restart"]').addEventListener("click", onStartNewSessionClick);
  $("#restartOverButton").addEventListener("click", () => showRestartStep(2));
  $("#restartBackButton").addEventListener("click", () => showRestartStep(1));
  $("#restartDialog").addEventListener("cancel", onRestartCancel);
  $("#howItWorksLink").addEventListener("click", openHowItWorks);
  $("#howItWorksButton").addEventListener("click", dismissHowItWorks);
  $("#homeScreenTipButton").addEventListener("click", dismissHomeScreenTip);
  $("#motivateButton").addEventListener("click", onMotivateClick);
  $("#motivationClose").addEventListener("click", () => ($("#motivationCard").hidden = true));
  $("#endButton").addEventListener("click", onEndClick);
  $("#undoButton").addEventListener("click", onUndoClick);
  $("#resumeButton").addEventListener("click", resumeFromBreak);
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
  document.addEventListener("visibilitychange", checkSessionElsewhere);
  // Back from the browser's site settings: the setup note follows what's allowed now.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkStorage();
  });
  $("#awayNoButton").addEventListener("click", () => $("#awayDialog").close());
  $("#awayYesButton").addEventListener("click", () => {
    away.yes = true;
    $("#awayDialog").close();
  });
  $("#awayDialog").addEventListener("close", onAwayClosed);
  $("#continueHereButton").addEventListener("click", onContinueHereClick);
  window.addEventListener("storage", onStorage);
  window.addEventListener("storage", onHistoryStorage);
  window.addEventListener("storage", onCustomStorage);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", () => (leaveReminder.unloading = true)); // see "leave reminder"
  document.addEventListener("ct:languagechange", onLanguageChange);
  initLanguagePicker();

  checkStorage();
  // Real images for custom characters' layers (AVATAR_PNG_FILES), once they're loaded.
  loadAvatarPngs(() => {
    renderCustomList();
    quickStart.artKey = null;
    updateQuickStart();
  });

  // Resume a session that was running when the page was closed or reloaded,
  // unless another tab runs it (see "one tab at a time").
  if (savedRunningSession()) {
    continueSavedSession(false);
    return;
  }
  showScreen("setupScreen");
  pickNewCharacter();
}

init();
