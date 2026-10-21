"use strict";

const MIN = 60 * 1000;
const SESSION_KEY = "ct_session_v1";
const PREFS_KEY = "ct_prefs_v1";
const BASE_TITLE = "ConcenTraining";

const GOOD_EVERY_MS = 5 * MIN; // show the "doing well" pose after this much undistracted time
const PICKER_DELAY_MS = 1400; // let the reaction play before asking what caused the distraction
// The category picker stays open until a category or Skip is tapped. If neither happens
// (e.g. the phone was put down), it closes silently after this long, so it doesn't stay up
// for the rest of the session or hold back the continue/restart question forever.
const PICKER_AUTO_CLOSE_MS = 60 * 1000;
const UNDO_WINDOW_MS = 5000; // after a distraction tap, Undo takes End session's place for this long
const DURATION_PRESETS = [15, 25, 35, 45, 60, 90];
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

// Popularity stats: every tap on a character card counts, finished session or not.
// Sent to the Netlify Function in netlify/functions/picks.mjs. Fire-and-forget:
// if it fails (offline, or index.html opened as a local file) the app works the same.
function countCharacterPick(id) {
  fetch("/api/picks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ characterId: id }),
    keepalive: true,
  }).catch(() => {});
}

// ---------- state ----------

// endSound / keepScreenOn: the setup checkboxes. homeScreenTipDismissed: "Got it" was tapped on the
// iPhone Home Screen tip. persistRequested: persistent storage was asked for (or skipped, in Firefox).
// Prefs saved before any of these existed get these defaults.
const prefs = Object.assign(
  {
    characterId: null, mode: "simple", minutes: 25, endSound: true, keepScreenOn: true,
    homeScreenTipDismissed: false, persistRequested: false,
  },
  load(PREFS_KEY, {}),
);
delete prefs.style; // saved before personalities came from the character; dropped on the next save
// style: the character's personality when the session ran ("kind", "firm", "strict" or "ragebait")
// restartPending: "A whole lot" / "10+ min" was tapped and the continue/restart question
// hasn't been answered yet. Saved, so a reload still asks it.
let session = null; // { characterId, style, mode, durationMs, startedAt, distractions: [], endedAt, restartPending }
let tickTimer = 0;
let nextGoodAt = 0;
// distraction: the one the open (or about to open) picker belongs to.
// If session.restartPending is set, the continue/restart dialog opens as soon as
// the picker is closed and the Undo window is over. They never show at the same time.
const picker = { distraction: null, showTimer: 0, hideTimer: 0 };
// distraction: the latest one, while its Undo window is open. prevNextGoodAt: nextGoodAt
// before that tap. setRestart: that tap set session.restartPending (it wasn't set before).
const undo = { distraction: null, prevNextGoodAt: 0, setRestart: false, timer: 0 };
const motivation = { phase: null, index: 0, shown: false };

function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || null;
}

function showScreen(id) {
  if (id === "setupScreen") updateHomeScreenTip();
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

const REACTION_CLASSES = ["react-1", "react-2", "react-3", "react-4", "react-5", "react-good"];
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
function react(pose, level) {
  clearTimeout(stage.reactTimer);
  stage.reacting = true;
  setPose(pose);

  stage.wrap.classList.remove(...REACTION_CLASSES);
  void stage.wrap.offsetWidth; // restarts the CSS animation if the same class is added again
  stage.wrap.classList.add(level ? `react-${level}` : "react-good");

  stage.reactTimer = setTimeout(() => {
    stage.reacting = false;
    stage.wrap.classList.remove(...REACTION_CLASSES);
    setPose("initial");
  }, level ? 2500 + level * 500 : 3000);
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
// Unsupported or refused: nothing happens.
async function updateWakeLock() {
  if (!("wakeLock" in navigator)) return;
  if (!wakeLockWanted()) {
    releaseWakeLock();
    return;
  }
  if (wakeLock.sentinel || wakeLock.pending) return;
  wakeLock.pending = true;
  try {
    const sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      if (wakeLock.sentinel === sentinel) wakeLock.sentinel = null;
    });
    wakeLock.sentinel = sentinel;
  } catch {
    // refused (no tap yet, battery saver, ...): carry on without it
  }
  wakeLock.pending = false;
  if (!wakeLockWanted()) releaseWakeLock(); // the session ended while the request was out
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

function savePrefs() {
  save(PREFS_KEY, prefs);
}

// iPhone/iPad Safari only (see iosSafariNotInstalled in history-store.js), and only once
// there's at least one finished session to lose. "Got it" hides it for good.
function updateHomeScreenTip() {
  $("#homeScreenTip").hidden =
    prefs.homeScreenTipDismissed || !iosSafariNotInstalled() || loadHistory().length === 0;
}

function dismissHomeScreenTip() {
  prefs.homeScreenTipDismissed = true;
  savePrefs();
  $("#homeScreenTip").hidden = true;
}

function renderCharacterList() {
  const list = $("#characterList");
  list.innerHTML = "";
  for (const character of CHARACTERS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "char-card";
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

async function onCharacterTap(character) {
  countCharacterPick(character.id);

  if (character.group === "ragebait" && prefs.characterId !== character.id) {
    $("#ragebaitText").textContent = `${character.name}: ${GROUPS.ragebait.warning}`;
    if ((await ask($("#ragebaitDialog"))) !== "ok") return;
  }

  prefs.characterId = character.id;
  savePrefs();
  $("#characterError").hidden = true;
  renderCharacterList();
}

function bindChoiceGroups() {
  document.querySelectorAll(".choice-group").forEach((group) => {
    const key = group.dataset.pref;
    const buttons = group.querySelectorAll(".choice");
    const sync = () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === prefs[key])));

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        prefs[key] = button.dataset.value;
        savePrefs();
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
      prefs[key] = check.checked;
      savePrefs();
    });
  });
  $("#testSoundButton").addEventListener("click", playChime);
}

function onStartClick() {
  if (!characterById(prefs.characterId)) {
    $("#characterError").hidden = false;
    $("#characterList").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  prefs.minutes = readSetupMinutes();
  savePrefs();
  if (prefs.endSound) unlockAudio(); // this tap is what allows the chime later
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
    `${character.name} · ${capitalize(session.style)} · ${capitalize(session.mode)} · ${Math.round(session.durationMs / MIN)} min`;
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
    if (!stage.reacting) react("good", 0);
    nextGoodAt = now + GOOD_EVERY_MS;
  }

  if (remaining <= 0) onTimerRanOut(true);
}

function logDistraction(option) {
  if (!session || session.endedAt) return;
  const distraction = { at: Date.now(), level: option.level, ms: option.ms || 0, category: null };
  const setRestart = Boolean(option.askRestart && !session.restartPending);
  session.distractions.push(distraction);
  if (option.askRestart) session.restartPending = true;
  save(SESSION_KEY, session);

  openUndo(distraction, nextGoodAt, setRestart);
  nextGoodAt = Date.now() + GOOD_EVERY_MS;
  react(`level${option.level}`, option.level);
  schedulePicker(distraction);
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
  picker.showTimer = setTimeout(() => {
    $("#categoryPicker").hidden = false;
    picker.hideTimer = setTimeout(() => closePicker(true), PICKER_AUTO_CLOSE_MS);
  }, PICKER_DELAY_MS);
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

// Waits while the category picker is open (or about to open) or the Undo window is open:
// closing either one calls this again.
function askPendingRestart() {
  if (session && session.restartPending && !picker.distraction && !undo.distraction) askContinueOrRestart();
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

  const answer = await ask(dialog);
  if (!session || session.endedAt) return; // the timer ran out while the question was open

  // Answered (Esc counts as "continue"), so a reload won't ask again.
  session.restartPending = false;
  save(SESSION_KEY, session);
  if (answer === "restart") {
    const { characterId, mode } = session;
    // The checkbox only matters here: "Continue" keeps the session running.
    if (canSave && $("#restartSave").checked && saveFinishedSession({ ...session, endedAt: cutAt }, "startOver")) {
      requestPersistentStorage();
    }
    startSession(characterId, mode, readMinutes());
  }
}

async function onEndClick() {
  // No picker behind this dialog, and a waiting restart question waits until it's answered.
  closePicker(false);
  // "Save this session to your history": only offered when it could be saved at all
  // (same 1-minute rule as saving). Ticked every time the dialog opens, never remembered.
  const canSave = Date.now() - session.startedAt >= HISTORY_MIN_MS;
  $("#endSaveRow").hidden = !canSave;
  $("#endSave").checked = true;
  if ((await ask($("#endDialog"))) === "end" && session && !session.endedAt) {
    finishSession(Date.now(), !canSave || $("#endSave").checked);
  } else {
    askPendingRestart();
  }
}

// Once per device, after a session is saved: asks the browser to mark this site's storage as
// persistent, so it isn't cleared on its own (e.g. when the device runs low on space). The
// browser decides; nothing is shown either way. Skipped in Firefox, which would show a
// permission bar right after the session (persistRequested is still set, so it's not tried again).
function requestPersistentStorage() {
  if (prefs.persistRequested) return;
  prefs.persistRequested = true;
  savePrefs();
  if (/Firefox\/|FxiOS/.test(navigator.userAgent)) return;
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch {
    // not supported: fine
  }
}

// keep: false when "Save this session to your history" was unticked: the summary is
// still shown, but nothing goes into the history.
function finishSession(endedAt, keep = true) {
  clearInterval(tickTimer);
  stopStage();
  closePicker(false);
  closeUndo(false);
  session.endedAt = Math.min(endedAt, session.startedAt + session.durationMs);
  if (keep && saveFinishedSession(session)) requestPersistentStorage();
  remove(SESSION_KEY);
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  document.title = BASE_TITLE;
  renderSummary(keep);
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
  let answer = "";
  while (answer !== "save" && answer !== "discard") answer = await ask($("#lateDialog"));

  if (answer === "save") {
    finishSession(endedAt);
  } else {
    remove(SESSION_KEY);
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
// kept: false when the user chose not to save it (End session dialog).
function renderSummary(kept) {
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
  noteEl.textContent = short ? SUMMARY_SHORT_NOTE : SUMMARY_NOT_SAVED_NOTE;
  noteEl.hidden = !short && kept;

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

  // Resume a session that was running when the page was closed or reloaded.
  const saved = load(SESSION_KEY, null);
  if (saved && !saved.endedAt && characterById(saved.characterId)) {
    session = saved;
    // A session saved before personalities came from the character can hold any
    // style: it continues (and goes into the history) with the character's own.
    session.style = personalityOf(characterById(saved.characterId));
    save(SESSION_KEY, session);
    if (Date.now() >= saved.startedAt + saved.durationMs) {
      onTimerRanOut(false);
    } else {
      enterSession();
      askPendingRestart(); // the page was reloaded before the continue/restart question was answered
    }
    return;
  }
  showScreen("setupScreen");
}

init();
