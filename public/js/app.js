"use strict";

const MIN = 60 * 1000;
const SESSION_KEY = "ct_session_v1";
const PREFS_KEY = "ct_prefs_v1";
const BASE_TITLE = "ConcenTraining";

const GOOD_EVERY_MS = 5 * MIN; // show the "doing well" pose after this much undistracted time
const PICKER_DELAY_MS = 1400; // let the reaction play before asking what caused the distraction
const PICKER_TIMEOUT_MS = 3000; // the category picker hides itself after this long
const DURATION_PRESETS = [15, 25, 35, 45, 60, 90];

// Simple mode: severity only, no time. Level = which reaction pose to show (1-5).
const SIMPLE_OPTIONS = [
  { label: "Very briefly", level: 1 },
  { label: "Briefly", level: 2 },
  { label: "Moderately", level: 3 },
  { label: "A lot", level: 4 },
  { label: "A whole lot", level: 5, askRestart: true },
];

// Advanced mode: distraction length. "10+ min" counts as 10 minutes in the focus %.
const ADVANCED_OPTIONS = [
  { label: "30 sec", ms: 30 * 1000, level: 1 },
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

const prefs = Object.assign({ characterId: null, mode: "simple", minutes: 25 }, load(PREFS_KEY, {}));
delete prefs.style; // saved before personalities came from the character; dropped on the next save
// style: the character's personality when the session ran ("kind", "strict" or "ragebait")
let session = null; // { characterId, style, mode, durationMs, startedAt, distractions: [], endedAt }
let tickTimer = 0;
let nextGoodAt = 0;
// distraction: the one the open (or about to open) picker belongs to.
// restartPending: "A whole lot" / "10+ min" was tapped, so the continue/restart
// dialog opens as soon as the picker closes. They never show at the same time.
const picker = { distraction: null, showTimer: 0, hideTimer: 0, restartPending: false };
const motivation = { phase: null, index: 0, shown: false };

function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || null;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.hidden = screen.id !== id;
  });
  window.scrollTo(0, 0);
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
  for (const name of ["kind", "strict", "ragebait"]) stage.wrap.classList.toggle(name, personality === name);
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

function stopStage() {
  clearTimeout(stage.reactTimer);
  clearTimeout(stage.blinkTimer);
  stage.reacting = false;
  if (stage.wrap) stage.wrap.classList.remove(...REACTION_CLASSES);
}

// ---------- duration picker (used on setup and in the restart dialog) ----------

function clampMinutes(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(240, n) : 25;
}

// Builds preset chips + a custom number field. Returns a function that reads the value.
function durationPicker(container, initialMinutes) {
  container.innerHTML = "";

  const chips = document.createElement("div");
  chips.className = "chips";

  const custom = document.createElement("label");
  custom.className = "custom-minutes";
  custom.innerHTML = `Custom: <input type="number" min="1" max="240" inputmode="numeric"> min`;
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

function onStartClick() {
  if (!characterById(prefs.characterId)) {
    $("#characterError").hidden = false;
    $("#characterList").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  prefs.minutes = readSetupMinutes();
  savePrefs();
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
    `${character.name} · ${capitalize(session.style)} · ${capitalize(session.mode)} mode · ${Math.round(session.durationMs / MIN)} min`;
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

  resetPicker();
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

  if (now >= nextGoodAt) {
    if (!stage.reacting) react("good", 0);
    nextGoodAt = now + GOOD_EVERY_MS;
  }

  if (remaining <= 0) finishSession(session.startedAt + session.durationMs);
}

function logDistraction(option) {
  if (!session || session.endedAt) return;
  const distraction = { at: Date.now(), level: option.level, ms: option.ms || 0, category: null };
  session.distractions.push(distraction);
  save(SESSION_KEY, session);

  nextGoodAt = Date.now() + GOOD_EVERY_MS;
  react(`level${option.level}`, option.level);

  if (option.askRestart) picker.restartPending = true;
  schedulePicker(distraction);
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
  $("#categoryPicker").style.setProperty("--picker-timeout", `${PICKER_TIMEOUT_MS}ms`);
}

// A newer distraction replaces the picker of the previous one (which keeps category: null).
function schedulePicker(distraction) {
  closePicker(false);
  picker.distraction = distraction;
  picker.showTimer = setTimeout(() => {
    $("#categoryPicker").hidden = false; // showing it again also restarts the countdown bar
    picker.hideTimer = setTimeout(() => closePicker(true), PICKER_TIMEOUT_MS);
  }, PICKER_DELAY_MS);
}

function pickCategory(id) {
  if (picker.distraction && session && !session.endedAt) {
    picker.distraction.category = id;
    save(SESSION_KEY, session);
  }
  closePicker(true);
}

// thenAsk: open the continue/restart dialog now if one is waiting for the picker.
function closePicker(thenAsk) {
  clearTimeout(picker.showTimer);
  clearTimeout(picker.hideTimer);
  $("#categoryPicker").hidden = true;
  picker.distraction = null;
  if (thenAsk) askPendingRestart();
}

function askPendingRestart() {
  if (!picker.restartPending) return;
  picker.restartPending = false;
  askContinueOrRestart();
}

function resetPicker() {
  picker.restartPending = false;
  closePicker(false);
}

async function askContinueOrRestart() {
  if (!session || session.endedAt) return;
  const dialog = $("#restartDialog");
  if (dialog.open) return;

  const readMinutes = durationPicker($("#restartDuration"), Math.round(session.durationMs / MIN));
  const answer = await ask(dialog);

  if (answer === "restart" && session && !session.endedAt) {
    const { characterId, mode } = session;
    startSession(characterId, mode, readMinutes());
  }
}

async function onEndClick() {
  // No picker behind this dialog, and a waiting restart question waits until it's answered.
  closePicker(false);
  if ((await ask($("#endDialog"))) === "end" && session && !session.endedAt) {
    finishSession(Date.now());
  } else {
    askPendingRestart();
  }
}

function finishSession(endedAt) {
  clearInterval(tickTimer);
  stopStage();
  resetPicker();
  session.endedAt = Math.min(endedAt, session.startedAt + session.durationMs);
  saveFinishedSession(session);
  remove(SESSION_KEY);
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  document.title = BASE_TITLE;
  renderSummary();
  showScreen("summaryScreen");
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

function renderSummary() {
  const character = characterById(session.characterId);
  const img = $("#summaryImg");
  img.alt = character.name;
  setPoseImage(img, character, "good");

  const percentEl = $("#summaryPercent");

  if (session.mode === "advanced") {
    const { elapsedMs: elapsed, distractedMs: distracted, focusPercent: percent } = sessionFocus(session);
    const count = session.distractions.length;

    $("#summaryTitle").textContent = verdict(percent);
    percentEl.textContent = `${percent}% focused`;
    percentEl.hidden = false;
    $("#summaryText").textContent =
      `You focused for ${formatDuration(elapsed - distracted)} out of ${formatDuration(elapsed)}, ` +
      `with ${count} distraction${count === 1 ? "" : "s"} logged.`;
  } else {
    $("#summaryTitle").textContent = "Well done!";
    percentEl.hidden = true;
    $("#summaryText").textContent =
      SIMPLE_SUMMARY_MESSAGES[Math.floor(Math.random() * SIMPLE_SUMMARY_MESSAGES.length)];
  }

  // Top 3 picked categories. Hidden if none was picked this session.
  const top = countCategories(session.distractions).slice(0, 3);
  const categoriesEl = $("#summaryCategories");
  categoriesEl.hidden = top.length === 0;
  categoriesEl.textContent =
    `Most common distraction${top.length === 1 ? "" : "s"}: ` +
    top.map((category) => `${category.label} (${category.count})`).join(", ");
}

function verdict(percent) {
  if (percent >= 90) return "Outstanding focus!";
  if (percent >= 75) return "Great session!";
  if (percent >= 50) return "Good effort!";
  return "Every session is practice!";
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

function formatDuration(ms) {
  if (ms < MIN) return `${Math.round(ms / 1000)} sec`;
  return `${Math.round(ms / MIN)} min`;
}

// ---------- start-up ----------

function init() {
  renderCharacterList();
  bindChoiceGroups();
  buildCategoryButtons();
  readSetupMinutes = durationPicker($("#setupDuration"), prefs.minutes);

  $("#startButton").addEventListener("click", onStartClick);
  $("#motivateButton").addEventListener("click", onMotivateClick);
  $("#motivationClose").addEventListener("click", () => ($("#motivationCard").hidden = true));
  $("#endButton").addEventListener("click", onEndClick);
  $("#newSessionButton").addEventListener("click", () => {
    session = null;
    renderCharacterList();
    showScreen("setupScreen");
  });

  // Resume a session that was running when the page was closed or reloaded.
  const saved = load(SESSION_KEY, null);
  if (saved && !saved.endedAt && characterById(saved.characterId)) {
    session = saved;
    // A session saved before personalities came from the character can hold any
    // style: it continues (and goes into the history) with the character's own.
    session.style = personalityOf(characterById(saved.characterId));
    save(SESSION_KEY, session);
    if (Date.now() >= saved.startedAt + saved.durationMs) {
      finishSession(saved.startedAt + saved.durationMs);
    } else {
      enterSession();
    }
    return;
  }
  showScreen("setupScreen");
}

init();
