// Characters the user made in the editor (avatar.html), saved on this device only, under their own
// key. Shared by index.html (picker, sessions), avatar.html (editor) and history.html (names).
//
// ct_custom_characters_v1 = { v: 1, characters: [ { id, name, personality, createdAt, look } ] }
//   id: "custom-" + random letters and digits, never reused. personality: the style a session with
//   the character runs in ("kind", "firm", "strict" or "ragebait"). createdAt: Date.now() at the
//   first Save, never changed by an edit. The look and personality can be changed for
//   CUSTOM_EDIT_WINDOW_MS after that (customEditMsLeft), the name always.
//   look: see LOOK_FIELDS and GENDER_OPTIONS in avatar-parts.js (the lists differ per gender).
// Reading never throws: a broken entry is skipped (not the whole list), unknown look values get
// the default (cleanLook).

const CUSTOM_KEY = "ct_custom_characters_v1";
const CUSTOM_LIMIT = 10;
const CUSTOM_NAME_MAX = 20;

// For this long after its first Save, a character can be changed completely (look, personality,
// name). After that its look and personality are final; only the name can still be changed.
// Wall-clock time: it runs while the app is closed. Nothing extra is stored: it's worked out from
// createdAt (customEditMsLeft).
const CUSTOM_EDIT_WINDOW_MS = 10 * 60 * 1000;
// A device clock up to this far behind createdAt (a small automatic correction right after
// saving) counts as no time gone yet, so it doesn't lock a new character.
const CUSTOM_CLOCK_TOLERANCE_MS = 60 * 1000;
// Every custom character is counted under this one id by POST /api/picks: the user's own ids and
// names never leave the device.
const CUSTOM_PICK_ID = "custom";

// The switch for the whole feature, now true (on in production). false: no "Create your own" card
// and no "Your characters" section on the setup screen, avatar.html goes back to the app,
// stats.html leaves out the custom line, and a saved choice of a custom character counts as no
// choice (like a first visit). Saved characters are kept as they are, the history still shows
// their sessions' names, and POST /api/picks still accepts "custom". true: everything works as
// described in the README. This is what the production site (https://concentraining.com) follows.
const CUSTOM_CHARACTERS_ENABLED = true;

// Netlify's test sites always have custom characters on, whatever the switch says, so they can be
// tried on a phone: Deploy Previews (deploy-preview-53--concentraining.netlify.app) and the main
// branch deploy (main--concentraining.netlify.app).
const CUSTOM_CHARACTERS_TEST_SITE = (() => {
  try {
    const host = location.hostname;
    return host.startsWith("deploy-preview-") || host.startsWith("main--");
  } catch {
    return false;
  }
})();

// Whether custom characters are on in this page: every check in the app uses this.
const CUSTOM_CHARACTERS_ON = CUSTOM_CHARACTERS_ENABLED || CUSTOM_CHARACTERS_TEST_SITE;

// Custom characters will be paid (from December). While this is false they're free for everyone
// and the Create card says "Free during launch". Characters made while it's false stay usable
// after the switch (see "Custom characters" in the README).
const CUSTOM_PAID = false;

// Personality -> the built-in group with that personality (GROUPS in characters.js), for the
// badge, the ragebait warning and personalityOf.
const PERSONALITY_GROUPS = { kind: "relaxed", firm: "firm", strict: "strict", ragebait: "ragebait" };

// The texts (custom.* in js/i18n/en.js), each read in the current language when it's used.
// stats.html loads this file without the translation system (it stays English and uses none of
// these): customText then gives the key instead of failing, so loading the file never breaks a page.
const customText = (key, values) => (typeof t === "function" ? t(key, values) : key);

const CUSTOM_TEXTS = {
  get createTitle() { return customText("custom.createTitle"); },
  get createTagline() { return customText("custom.createTagline"); },
  get freeBadge() { return customText("custom.freeBadge"); },
  get limit() { return customText("custom.limit", { limit: CUSTOM_LIMIT }); },
  get nameMissing() { return customText("custom.nameMissing"); },
  get nameTooLong() { return customText("custom.nameTooLong", { max: CUSTOM_NAME_MAX }); },
  get nameTaken() { return customText("custom.nameTaken"); },
  get saveFailed() { return customText("custom.saveFailed"); },
  get deletedElsewhere() { return customText("custom.deletedElsewhere"); },
  timeLeft: (time) => customText("custom.timeLeft", { time }),
};

// How many ms are left to change the character's look and personality; 0: it's final. Locked
// with no createdAt (0 or missing: ghosts, broken entries), and when the clock is more than
// CUSTOM_CLOCK_TOLERANCE_MS behind createdAt (set back). Everything that shows or checks the
// 10 minutes uses this.
function customEditMsLeft(character, now = Date.now()) {
  const createdAt = character ? character.createdAt : 0;
  if (!Number.isFinite(createdAt) || createdAt <= 0) return 0;
  if (now < createdAt - CUSTOM_CLOCK_TOLERANCE_MS) return 0;
  const elapsed = Math.max(0, now - createdAt);
  return Math.max(0, CUSTOM_EDIT_WINDOW_MS - elapsed);
}

// The time left as m:ss ("9:05"), in every language. Seconds are rounded up, so it shows 0:01
// until the moment it locks.
function formatEditTime(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// The time left in whole minutes, rounded up ("9 min" from 9:00 down to 8:01), for screen readers:
// it only changes once a minute.
function editMinutesLeft(ms) {
  return Math.ceil(Math.max(0, ms) / 60000);
}

// The ragebait warning shows on Start until it's accepted for that character (ragebaitAccepted in
// ct_prefs_v1, a list of character ids, kept by app.js). A custom character whose personality
// changes is taken off the list, so a character changed to ragebait asks again on its next Start.
// Only that field is written; everything else in the prefs stays as it is.
function forgetRagebaitAcceptance(id) {
  try {
    const saved = JSON.parse(localStorage.getItem("ct_prefs_v1"));
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return; // nothing saved: nothing accepted
    const accepted = Array.isArray(saved.ragebaitAccepted) ? saved.ragebaitAccepted : [];
    saved.ragebaitAccepted = accepted.filter((acceptedId) => acceptedId !== id);
    localStorage.setItem("ct_prefs_v1", JSON.stringify(saved));
  } catch {
    // not critical: at worst the warning doesn't show again for this character
  }
}

function isCustomId(id) {
  return typeof id === "string" && /^custom-[a-z0-9]{4,40}$/.test(id);
}

// Characters as you see them, so an emoji or an accented letter counts as one.
function nameLength(name) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(name)).length;
  }
  return Array.from(name).length;
}

const nameKey = (name) => name.trim().toLowerCase();

// The reason a name can't be used, or "" if it's fine. Unique among the user's own characters
// (ignoring case); exceptId: the character being edited.
function nameError(name, characters, exceptId) {
  const trimmed = name.trim();
  if (!trimmed) return CUSTOM_TEXTS.nameMissing;
  if (nameLength(trimmed) > CUSTOM_NAME_MAX) return CUSTOM_TEXTS.nameTooLong;
  if (characters.some((c) => c.id !== exceptId && nameKey(c.name) === nameKey(trimmed))) return CUSTOM_TEXTS.nameTaken;
  return "";
}

// A stored entry as a character the app can use (like the ones in CHARACTERS, plus custom: true
// and the look), or null if it's broken.
function cleanCustomCharacter(raw) {
  if (!raw || typeof raw !== "object" || !isCustomId(raw.id)) return null;
  if (typeof raw.name !== "string") return null;
  const name = raw.name.trim();
  if (!name || nameLength(name) > CUSTOM_NAME_MAX) return null;
  if (!Object.hasOwn(PERSONALITY_GROUPS, raw.personality)) return null;
  return {
    id: raw.id,
    name,
    personality: raw.personality,
    group: PERSONALITY_GROUPS[raw.personality],
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
    look: cleanLook(raw.look),
    custom: true,
  };
}

// Parsed once per stored text: index.html asks often (every Quick start update).
const customCache = { raw: undefined, list: [] };

function readCustomRaw() {
  try {
    return localStorage.getItem(CUSTOM_KEY);
  } catch {
    return null;
  }
}

// The saved characters, oldest first. Duplicated ids or names keep the first one.
function loadCustomCharacters() {
  const raw = readCustomRaw();
  if (raw === customCache.raw) return customCache.list;
  let entries = [];
  try {
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.characters)) entries = data.characters;
  } catch {
    // broken JSON: no characters
  }
  const list = [];
  for (const entry of entries) {
    const character = cleanCustomCharacter(entry);
    if (!character) continue;
    if (list.some((c) => c.id === character.id || nameKey(c.name) === nameKey(character.name))) continue;
    list.push(character);
  }
  customCache.raw = raw;
  customCache.list = list;
  return list;
}

// Writes the whole list. Returns false if the browser refused (storage full or blocked).
function saveCustomCharacters(list) {
  const data = {
    v: 1,
    characters: list.map(({ id, name, personality, createdAt, look }) => ({ id, name, personality, createdAt, look })),
  };
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function customCharacterById(id) {
  return isCustomId(id) ? loadCustomCharacters().find((c) => c.id === id) || null : null;
}

// A new id that no saved character and no session in the history uses.
function newCustomId(takenIds) {
  const letters = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (;;) {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    const id = "custom-" + Array.from(bytes, (b) => letters[b % letters.length]).join("");
    if (!takenIds.has(id)) return id;
  }
}

// Stands in for a custom character that was deleted (or never arrived in this browser) in its old
// sessions: the default look, the name the session stored, and the style it ran with.
function ghostCharacter(id, name, style) {
  const personality = Object.hasOwn(PERSONALITY_GROUPS, style) ? style : "kind";
  return {
    id,
    name: typeof name === "string" && name.trim() ? name.trim() : customText("custom.ghostName"),
    personality,
    group: PERSONALITY_GROUPS[personality],
    createdAt: 0,
    look: defaultLook(),
    custom: true,
    ghost: true,
  };
}
