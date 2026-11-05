"use strict";

// The character editor (avatar.html). avatar.html creates a character; avatar.html?id=custom-…
// edits one (look and name; the personality is fixed once saved). Everything stays in memory
// until Save: Cancel, Back or leaving the page discards it.

const $ = (selector) => document.querySelector(selector);

// The look sections. view: how the thumbnails are drawn (avatar-art.js AVATAR_VIEWS); swatch: a
// colour instead of a drawing; text: plain text buttons. perGender: the chosen gender's own list
// (built again when the gender changes); the others are shared by both genders, like every costume
// list (avatar-costumes.js). A section with no options for a gender (facial hair for women) isn't
// shown.
const SECTIONS = {
  gender: { field: "gender", title: "Gender", kind: "text" },
  skin: { field: "skin", title: "Skin tone", kind: "swatch" },
  hairColor: { field: "hairColor", title: "Hair colour", kind: "swatch" },
  face: { field: "face", title: "Face", view: "head", perGender: true },
  hairStyle: { field: "hairStyle", title: "Hairstyle", view: "head", perGender: true },
  outfit: { field: "outfit", title: "Outfit", view: "full", perGender: true },
  costumeOutfit: { field: "costumeOutfit", title: "Costume outfit", view: "full" },
  back: { field: "back", title: "Back", view: "full" },
  headwear: { field: "headwear", title: "Headwear", view: "head" },
  mask: { field: "mask", title: "Masks and face", view: "head" },
  earsHorns: { field: "earsHorns", title: "Ears and horns", view: "head" },
  eyewear: { field: "eyewear", title: "Eyewear", view: "head", perGender: true },
  earrings: { field: "earrings", title: "Earrings", view: "head", perGender: true },
  necklace: { field: "necklace", title: "Necklace", view: "full", perGender: true },
  costumeBeard: { field: "costumeBeard", title: "Costume beard", view: "head" },
  facialHair: { field: "facialHair", title: "Facial hair", view: "head", perGender: true },
  held: { field: "held", title: "Held item", view: "full" },
  pet: { field: "pet", title: "Shoulder pet", view: "full" },
};

// The editor's collapsible groups (<details>), in order. Base and Costumes are open at the start.
// A group's sections are only built the first time it's opened, and only the thumbnails of open
// groups are drawn (a closed group's thumbnails are never on screen).
const EDITOR_GROUPS = [
  { id: "base", title: "Base", open: true, sections: ["gender", "skin", "hairColor", "face", "hairStyle"] },
  { id: "costumes", title: "Costumes", open: true, presets: true, sections: [] },
  { id: "clothes", title: "Clothes", sections: ["outfit", "costumeOutfit", "back"] },
  {
    id: "accessories", title: "Accessories",
    sections: ["headwear", "mask", "earsHorns", "eyewear", "earrings", "necklace", "costumeBeard", "facialHair", "held", "pet"],
  },
];

const PERSONALITIES = ["kind", "firm", "strict", "ragebait"];

// What a thumbnail shows besides its own option: the base of the look (so every option is seen on
// this character), but no other accessories or costume items. So picking an outfit, eyewear,
// earrings, facial hair or a costume item only redraws the preview (and an outfit the necklace
// thumbnails, which show it). Costume presets show their costume on the same base.
// Each redrawn picture costs the browser several ms on a slow phone: see "Speed" in the README.
const THUMB_BASE = ["gender", "skin", "hairColor", "hairStyle", "face"];
const THUMB_EXTRA = { necklace: ["outfit"] };

// The plain parts a thumbnail shows for what it doesn't show: a T-shirt, no accessories and no
// costume.
function thumbPlain(gender) {
  const first = (field) => (lookOptions(field, gender)[0] || { id: DEFAULT_LOOKS[gender][field] }).id;
  const plain = {
    outfit: gender === "male" ? "m-tshirt" : "w-tshirt",
    eyewear: first("eyewear"), earrings: first("earrings"), necklace: first("necklace"), facialHair: first("facialHair"),
  };
  for (const field of COSTUME_FIELDS) plain[field] = first(field);
  return plain;
}
const PREVIEW_POSE_MS = 1200; // Preview reactions: how long each pose shows

// editing: the saved character being edited (null: creating). triedSave: the name is checked live
// after the first Save that failed on it. built: the groups whose sections exist (by id).
const editor = {
  editing: null,
  look: defaultLook(),
  personality: "kind",
  triedSave: false,
  previewTimer: 0,
  // key: what the thumbnail should show now (see thumbKey), drawn: what it shows.
  // { field, id (or preset), view, box, prefix, key, drawn, near (on or near the screen) }
  thumbs: [],
  observer: null,
  laterToken: null, // the latest batch of thumbnails just off screen (updateThumbs)
  themeToken: null, // the same for a theme switch (onTheme)
  built: new Set(),
  // The costume theme whose presets are shown (in memory only, Fantasy at the start), and per
  // theme: its preset grid and the dot marking the theme of the costume being worn.
  theme: COSTUME_THEMES[0].id,
  themes: new Map(),
};

// ---------- drawing ----------

function previewCharacter() {
  const name = $("#nameInput").value.trim() || "Your character";
  return { name, group: PERSONALITY_GROUPS[editor.personality] };
}

function showPose(pose) {
  const img = $("#previewImg");
  img.src = avatarArt(editor.look, editor.personality, pose);
  img.alt = describePose(previewCharacter(), pose);
}

function thumbLook(thumb) {
  const look = thumbPlain(editor.look.gender);
  for (const base of [...THUMB_BASE, ...(THUMB_EXTRA[thumb.field] || [])]) look[base] = editor.look[base];
  if (thumb.preset) return applyCostumePreset(look, thumb.preset);
  look[thumb.field] = thumb.id;
  return look;
}

// What a thumbnail shows, as text: everything thumbLook uses (the base fields it copies, except its
// own field, which it replaces with its option; its option or preset; the personality), without
// building the look (every tap does this for every thumbnail).
function thumbKey(thumb) {
  const fields = [...THUMB_BASE, ...(THUMB_EXTRA[thumb.field] || [])].filter((field) => field !== thumb.field);
  return `${fields.map((field) => editor.look[field]).join("|")}/${thumb.preset ? thumb.preset.id : thumb.id}/${editor.personality}`;
}

// Every thumbnail shows its option in the chosen personality's calm pose. Only thumbnails whose
// inputs changed are drawn again, and only those on (or near) the screen: the others are drawn
// when they scroll into view (showThumb), so a tap never waits for ~70 drawings at once. Those
// actually visible (below the preview, which stays at the top) are drawn at once; the ones just
// above or below the screen right after the next frame, so the tap's result shows sooner.
function updateThumbs() {
  const changed = [];
  for (const thumb of editor.thumbs) {
    thumb.key = thumbKey(thumb);
    if (thumb.drawn === thumb.key) continue;
    if (!editor.observer) showThumb(thumb);
    else if (thumb.near) changed.push(thumb);
  }
  drawThumbs(changed, "laterToken");
}

// Draws thumbnails: those visible on screen at once, the others right after the next frame
// (unless a newer batch of the same kind, tokenName, replaced them meanwhile).
function drawThumbs(changed, tokenName) {
  if (changed.length === 0) return;
  // All positions first, then all drawings (reading a position after a drawing would make the
  // browser lay out the page again each time).
  const top = $(".avatar-preview").getBoundingClientRect().bottom;
  const visible = changed.map((thumb) => {
    const rect = thumb.box.getBoundingClientRect();
    return rect.bottom > top && rect.top < window.innerHeight;
  });
  const later = changed.filter((thumb, i) => !visible[i]);
  changed.forEach((thumb, i) => visible[i] && showThumb(thumb));
  if (later.length === 0) return;
  const token = (editor[tokenName] = {});
  requestAnimationFrame(() =>
    setTimeout(() => {
      if (editor[tokenName] === token) later.forEach(showThumb);
    }, 0)
  );
}

function showThumb(thumb) {
  if (thumb.drawn === thumb.key) return;
  thumb.drawn = thumb.key;
  // Our own drawing, with no user text in it.
  thumb.box.innerHTML = avatarInlineSvg(thumbLook(thumb), editor.personality, "initial", thumb.view, thumb.prefix);
}

// 100px above and below the screen count as near, so a normal scroll finds them ready.
function observeThumbs() {
  if (editor.observer) editor.observer.disconnect();
  if (!("IntersectionObserver" in window)) return;
  const byBox = new Map(editor.thumbs.map((thumb) => [thumb.box, thumb]));
  editor.observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const thumb = byBox.get(entry.target);
        thumb.near = entry.isIntersecting;
        if (thumb.near) showThumb(thumb);
      }
    },
    { rootMargin: "100px 0px" }
  );
  for (const thumb of editor.thumbs) editor.observer.observe(thumb.box);
}

function syncChecked() {
  for (const section of Object.values(SECTIONS)) {
    document.querySelectorAll(`input[name="${section.field}"]`).forEach((input) => {
      input.checked = input.value === editor.look[section.field];
    });
  }
}

// thumbsLater: the thumbnails are drawn right after the next frame, so the new preview shows at
// once (Randomize changes the base of every thumbnail on screen, which takes a slow phone ~100 ms).
function redraw(thumbsLater = false) {
  stopPreview();
  showPose("initial");
  updateThemeDots();
  if (!thumbsLater) {
    updateThumbs();
    return;
  }
  const token = (editor.laterToken = {});
  requestAnimationFrame(() =>
    setTimeout(() => {
      if (editor.laterToken === token) updateThumbs();
    }, 0)
  );
}

// ---------- building the form ----------

function optionLabel(name, value, checked) {
  const label = document.createElement("label");
  label.className = "option";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  input.className = "option-input";
  label.append(input);
  return { label, input };
}

// A new thumbnail (drawn later, see updateThumbs). Each has its own id prefix for its SVG's ids.
let thumbCount = 0;
function addThumb(box, props) {
  editor.thumbs.push({ ...props, box, prefix: `t${thumbCount++}-`, key: "", drawn: "", near: false });
}

function optionVisual(section, option, label) {
  const visual = document.createElement("span");
  visual.className = "option-visual";
  label.append(visual);
  if (section.kind === "text") {
    visual.textContent = option.label;
    return;
  }
  if (section.kind === "swatch") {
    const swatch = document.createElement("span");
    swatch.className = "option-swatch";
    swatch.style.background = option.color;
    visual.append(swatch);
  } else {
    const box = document.createElement("span");
    box.className = `option-img option-img-${section.view}`;
    visual.append(box);
    addThumb(box, { field: section.field, id: option.id, view: section.view });
  }
  const name = document.createElement("span");
  name.className = "visually-hidden";
  name.textContent = option.label;
  label.append(name);
}

// The heading before a group of options inside a section (the same radio group): "Funny" before
// the funny faces, "Fantasy" before the fantasy skin colours.
function optionGroupTitle(option) {
  if (option.funny) return "Funny";
  if (option.fantasy) return "Fantasy";
  return "";
}

// One section: a fieldset with a radio button per option, inside its box (which stays in place, so
// a gender change can rebuild it there).
function buildSection(section) {
  section.box.innerHTML = "";
  editor.thumbs = editor.thumbs.filter((thumb) => thumb.field !== section.field);
  const options = lookOptions(section.field, editor.look.gender);
  if (options.length === 0) return;
  const fieldset = document.createElement("fieldset");
  fieldset.className = "editor-section";
  const legend = document.createElement("legend");
  const heading = document.createElement("h3");
  heading.textContent = section.title;
  legend.append(heading);
  const grid = document.createElement("div");
  grid.className = `option-grid option-grid-${section.kind || section.view}`;
  let groupTitle = "";
  for (const option of options) {
    const title = optionGroupTitle(option);
    if (title && title !== groupTitle) {
      const h = document.createElement("h4");
      h.className = "option-group-title";
      h.textContent = title;
      grid.append(h);
    }
    groupTitle = title;
    const { label, input } = optionLabel(section.field, option.id, editor.look[section.field] === option.id);
    optionVisual(section, option, label);
    input.addEventListener("change", () => onLookChange(section.field, option.id));
    grid.append(label);
  }
  fieldset.append(legend, grid);
  section.box.append(fieldset);
}

// One costume button: a picture of the costume on this character, and its name. Buttons, not
// options: after a preset, every item can still be changed on its own.
function presetButton(preset) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preset";
  const box = document.createElement("span");
  box.className = "option-img option-img-full";
  const label = document.createElement("span");
  label.className = "preset-label";
  label.textContent = preset.label;
  button.append(box, label);
  // Read out as "Put on the costume: Pirate" ("No costume" as it is).
  if (preset !== NO_COSTUME_PRESET) {
    button.setAttribute("aria-label", `Put on the costume: ${preset.label}${preset.description ? `, ${preset.description}` : ""}`);
  }
  button.addEventListener("click", () => onPreset(preset));
  addThumb(box, { field: "preset", preset, view: "full" });
  return button;
}

// Costumes: "No costume" (always shown), the theme chips (one radio group: Fantasy, Horror,
// History, Jobs, Fun) and the chosen theme's presets. Every theme's grid is built at once but only
// the chosen one is shown, so its thumbnails stay drawn when switching back. A dot marks the theme
// of the costume being worn (updateThemeDots).
function buildPresets(container) {
  editor.thumbs = editor.thumbs.filter((thumb) => !thumb.preset);
  editor.themes.clear();
  const intro = document.createElement("p");
  intro.className = "muted small";
  intro.textContent = "Tap a costume to put it on. You can still change every part.";
  const none = document.createElement("div");
  none.className = "preset-grid preset-grid-none";
  none.append(presetButton(NO_COSTUME_PRESET));

  const picker = document.createElement("fieldset");
  picker.className = "theme-picker";
  const legend = document.createElement("legend");
  legend.className = "visually-hidden";
  legend.textContent = "Costume theme";
  const chips = document.createElement("div");
  chips.className = "theme-chips";
  picker.append(legend, chips);
  const grids = [];
  for (const theme of COSTUME_THEMES) {
    const { label, input } = optionLabel("costumeTheme", theme.id, theme.id === editor.theme);
    label.className = "theme-chip";
    input.className = "theme-input";
    const text = document.createElement("span");
    text.className = "theme-chip-text";
    text.textContent = theme.label;
    const dot = document.createElement("span");
    dot.className = "theme-dot";
    dot.setAttribute("aria-hidden", "true");
    text.append(dot);
    label.append(text);
    input.addEventListener("change", () => onTheme(theme.id));
    chips.append(label);

    const grid = document.createElement("div");
    grid.className = "preset-grid";
    grid.hidden = theme.id !== editor.theme;
    for (const preset of COSTUME_PRESETS) if (preset.theme === theme.id) grid.append(presetButton(preset));
    grids.push(grid);
    editor.themes.set(theme.id, { grid, dot, input, label: theme.label });
  }
  container.append(intro, none, picker, ...grids);
  updateThemeDots();
}

// The dot on the theme of the costume being worn, if it's one of the presets. Screen readers
// hear it as "Horror, current costume".
function updateThemeDots() {
  if (editor.themes.size === 0) return;
  const worn = wornPreset(editor.look);
  for (const [id, { dot, input, label }] of editor.themes) {
    const on = Boolean(worn && worn.theme === id);
    dot.hidden = !on;
    input.setAttribute("aria-label", on ? `${label}, current costume` : label);
  }
}

// A group's sections, the first time it's opened.
function buildGroup(group) {
  if (editor.built.has(group.id)) return;
  editor.built.add(group.id);
  if (group.presets) buildPresets(group.body);
  for (const field of group.sections) {
    const section = SECTIONS[field];
    section.box = document.createElement("div");
    group.body.append(section.box);
    buildSection(section);
  }
  observeThumbs();
  updateThumbs();
}

function buildLookSections() {
  const container = $("#lookSections");
  for (const group of EDITOR_GROUPS) {
    const details = document.createElement("details");
    details.className = "editor-group";
    details.open = Boolean(group.open);
    const summary = document.createElement("summary");
    const heading = document.createElement("h2");
    heading.textContent = group.title;
    summary.append(heading);
    group.body = document.createElement("div");
    group.body.className = "editor-group-body";
    details.append(summary, group.body);
    details.addEventListener("toggle", () => {
      if (details.open) buildGroup(group);
    });
    container.append(details);
    if (details.open) buildGroup(group);
  }
}

// The chosen gender's sections again (after a gender change), in the groups built so far.
function buildGenderSections() {
  for (const group of EDITOR_GROUPS) {
    if (!editor.built.has(group.id)) continue;
    for (const field of group.sections) if (SECTIONS[field].perGender) buildSection(SECTIONS[field]);
  }
  observeThumbs();
}

function buildPersonalityOptions() {
  const container = $("#personalityOptions");
  for (const personality of PERSONALITIES) {
    const group = PERSONALITY_GROUPS[personality];
    const { label, input } = optionLabel("personality", personality, editor.personality === personality);
    label.classList.add("personality-option");
    const visual = document.createElement("span");
    visual.className = `option-visual badge badge-${group}`;
    visual.textContent = GROUPS[group].label;
    label.append(visual);
    input.addEventListener("change", () => {
      editor.personality = personality;
      redraw();
    });
    container.append(label);
  }
}

// ---------- changes ----------

// A gender change (also when editing) starts again from that gender's starting look: the two
// genders have different lists. The name, personality and costume items (shared by both) stay,
// except a costume beard when switching to Female.
function onLookChange(field, id) {
  if (field === "gender") {
    if (id === editor.look.gender) return;
    editor.look = { ...defaultLook(id), ...costumeOf(editor.look, id) };
    buildGenderSections();
    syncChecked();
  } else {
    editor.look = { ...editor.look, [field]: id };
  }
  redraw();
}

// A costume preset: its items (None for the other costume fields), and its skin or hair colour if
// it has one.
function onPreset(preset) {
  editor.look = applyCostumePreset(editor.look, preset);
  syncChecked();
  redraw();
}

// Another costume theme: only its presets are shown. Their keys are current (updateThumbs keeps
// every thumbnail's key up to date), so only the ones not drawn yet for this look are drawn: those
// on screen in this tap, the others right after it. They count as near the screen at once (the
// observer only reports them after the next frame).
function onTheme(id) {
  editor.theme = id;
  for (const [themeId, { grid }] of editor.themes) grid.hidden = themeId !== id;
  const shown = editor.thumbs.filter((thumb) => thumb.preset && thumb.preset.theme === id);
  for (const thumb of shown) thumb.near = true;
  drawThumbs(shown.filter((thumb) => thumb.drawn !== thumb.key), "themeToken");
}

// Randomize keeps the gender; costume items come rarely and never clash (randomCostume).
function onRandomize() {
  editor.look = randomCostume(randomLook(editor.look.gender));
  syncChecked();
  redraw(true);
}

// Preview reactions: every pose of the chosen personality once, then back to the calm one.
// Tapping it again starts over.
function startPreview() {
  stopPreview();
  let index = 0;
  const step = () => {
    showPose(POSES[index]);
    index++;
    editor.previewTimer = setTimeout(index < POSES.length ? step : () => showPose("initial"), PREVIEW_POSE_MS);
  };
  step();
}

function stopPreview() {
  clearTimeout(editor.previewTimer);
  editor.previewTimer = 0;
}

// ---------- name ----------

function showNameError(message) {
  const error = $("#nameError");
  error.textContent = message;
  error.hidden = !message;
  $("#nameInput").setAttribute("aria-invalid", String(Boolean(message)));
}

function checkName() {
  const message = nameError($("#nameInput").value, loadCustomCharacters(), editor.editing && editor.editing.id);
  showNameError(message);
  return !message;
}

function onNameInput() {
  if (editor.triedSave) checkName();
  // The alt of the preview uses the name.
  if (!editor.previewTimer) showPose("initial");
}

// ---------- save / cancel ----------

function showSaveError(message) {
  const error = $("#saveError");
  error.textContent = "";
  error.textContent = message; // set again, so a screen reader reads it on every failed Save
  error.hidden = !message;
}

// Reads the saved list again right here, so a character saved, edited or deleted in another tab
// meanwhile is taken into account (the limit and the names too).
function onSave(event) {
  event.preventDefault();
  showSaveError("");
  editor.triedSave = true;
  if (!checkName()) {
    $("#nameInput").focus();
    return;
  }
  if (!storageWorks()) {
    showSaveError(CUSTOM_TEXTS.saveFailed);
    return;
  }
  const list = loadCustomCharacters().slice();
  const name = $("#nameInput").value.trim();
  let id;
  if (editor.editing) {
    id = editor.editing.id;
    const index = list.findIndex((c) => c.id === id);
    if (index < 0) {
      showSaveError(CUSTOM_TEXTS.deletedElsewhere);
      return;
    }
    list[index] = { ...list[index], name, look: { ...editor.look } };
  } else {
    if (list.length >= CUSTOM_LIMIT) {
      showSaveError(CUSTOM_TEXTS.limit);
      return;
    }
    const taken = new Set([...list.map((c) => c.id), ...loadHistory().map((entry) => entry.characterId)]);
    id = newCustomId(taken);
    list.push({ id, name, personality: editor.personality, createdAt: Date.now(), look: { ...editor.look } });
  }
  if (!saveCustomCharacters(list)) {
    showSaveError(CUSTOM_TEXTS.saveFailed);
    return;
  }
  // replace: the editor isn't left in the back history. A new character gets picked on the setup
  // screen (with the ragebait warning first, like any ragebait character).
  location.replace(editor.editing ? "./" : `./?picked=${encodeURIComponent(id)}`);
}

function onCancel() {
  location.replace("./");
}

// ---------- start-up ----------

function init() {
  // Custom characters are off (CUSTOM_CHARACTERS_ON in custom-characters.js): back to the app.
  if (!CUSTOM_CHARACTERS_ON) {
    document.querySelector("main").hidden = true;
    location.replace("./");
    return;
  }
  const id = new URLSearchParams(location.search).get("id");
  if (id) {
    const character = customCharacterById(id);
    if (!character) {
      // Deleted meanwhile, or a broken link: back to the picker.
      location.replace("./");
      return;
    }
    editor.editing = character;
    editor.look = { ...character.look };
    editor.personality = character.personality;
    $("#editorTitle").textContent = "Edit your character";
    document.title = "Edit Your Character · ConcenTraining";
    $("#nameInput").value = character.name;
    $("#personalityPicker").hidden = true;
    $("#personalityFixed").hidden = false;
    const badge = $("#personalityBadge");
    badge.classList.add(`badge-${character.group}`);
    badge.textContent = GROUPS[character.group].label;
  } else {
    buildPersonalityOptions();
  }

  if (!storageWorks()) {
    $("#storageNote").textContent = SETUP_STORAGE_NOTE;
    $("#storageNote").hidden = false;
  }

  buildLookSections();
  redraw();
  loadAvatarPngs(() => {
    for (const thumb of editor.thumbs) thumb.drawn = "";
    redraw();
  });

  $("#nameInput").addEventListener("input", onNameInput);
  $("#previewButton").addEventListener("click", startPreview);
  $("#randomizeButton").addEventListener("click", onRandomize);
  $("#editorForm").addEventListener("submit", onSave);
  $("#cancelButton").addEventListener("click", onCancel);
}

init();
