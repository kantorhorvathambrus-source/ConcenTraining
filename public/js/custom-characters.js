// Characters the user made in the editor (avatar.html), saved on this device only, under their own
// key. Shared by index.html (picker, sessions), avatar.html (editor) and history.html (names).
//
// ct_custom_characters_v1 = { v: 1, characters: [ { id, name, personality, createdAt, look } ] }
//   id: "custom-" + random letters and digits, never reused. personality: the style a session with
//   the character runs in ("kind", "firm", "strict" or "ragebait"), picked once when it's created.
//   look: see LOOK_FIELDS and GENDER_OPTIONS in avatar-parts.js (the lists differ per gender).
// Reading never throws: a broken entry is skipped (not the whole list), unknown look values get
// the default (cleanLook).

const CUSTOM_KEY = "ct_custom_characters_v1";
const CUSTOM_LIMIT = 10;
const CUSTOM_NAME_MAX = 20;
// Every custom character is counted under this one id by POST /api/picks: the user's own ids and
// names never leave the device.
const CUSTOM_PICK_ID = "custom";

// Custom characters will be paid (from December). While this is false they're free for everyone
// and the Create card says "Free during launch". Characters made while it's false stay usable
// after the switch (see "Custom characters" in the README).
const CUSTOM_PAID = false;

// Personality -> the built-in group with that personality (GROUPS in characters.js), for the
// badge, the ragebait warning and personalityOf.
const PERSONALITY_GROUPS = { kind: "relaxed", firm: "firm", strict: "strict", ragebait: "ragebait" };

const CUSTOM_TEXTS = {
  createTitle: "Create your own",
  createTagline: "Design your own character, with your own name.",
  freeBadge: "Free during launch",
  limit: `You can have up to ${CUSTOM_LIMIT} characters. Delete one to make a new one.`,
  nameMissing: "Give your character a name.",
  nameTooLong: `Names can be up to ${CUSTOM_NAME_MAX} characters.`,
  nameTaken: "You already have a character with this name.",
  saveFailed: "Couldn't save your character. Your browser isn't letting this site store data.",
  deletedElsewhere: "This character was deleted in another tab, so it can't be saved.",
};

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
    name: typeof name === "string" && name.trim() ? name.trim() : "Custom character",
    personality,
    group: PERSONALITY_GROUPS[personality],
    createdAt: 0,
    look: defaultLook(),
    custom: true,
    ghost: true,
  };
}
