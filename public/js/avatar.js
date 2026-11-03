"use strict";

// The character editor (avatar.html). avatar.html creates a character; avatar.html?id=custom-…
// edits one (look and name; the personality is fixed once saved). Everything stays in memory
// until Save: Cancel, Back or leaving the page discards it.

const $ = (selector) => document.querySelector(selector);

// The look sections, in order. view: how the thumbnails are drawn (avatar-art.js AVATAR_VIEWS);
// swatch: a colour instead of a drawing; text: plain text buttons. The first three are the same for
// both genders; the others show only the chosen gender's options (and are built again when the
// gender changes). A section with no options for a gender (facial hair for women) isn't shown.
const SHARED_SECTIONS = [
  { field: "gender", title: "Gender", kind: "text" },
  { field: "skin", title: "Skin tone", kind: "swatch" },
  { field: "hairColor", title: "Hair colour", kind: "swatch" },
];
const GENDER_SECTIONS = [
  { field: "hairStyle", title: "Hairstyle", view: "head" },
  { field: "face", title: "Face", view: "head" },
  { field: "outfit", title: "Outfit", view: "full" },
  { field: "eyewear", title: "Eyewear", view: "head" },
  { field: "earrings", title: "Earrings", view: "head" },
  { field: "necklace", title: "Necklace", view: "full" },
  { field: "facialHair", title: "Facial hair", view: "head" },
];

const PERSONALITIES = ["kind", "firm", "strict", "ragebait"];

// What a thumbnail shows besides its own option: the base of the look (so every option is seen on
// this character), but no other accessories. So picking an outfit, eyewear, earrings or facial
// hair only redraws the preview (and an outfit the necklace thumbnails, which show it).
// Each redrawn picture costs the browser several ms on a slow phone: see "Speed" in the README.
const THUMB_BASE = ["gender", "skin", "hairColor", "hairStyle", "face"];
const THUMB_EXTRA = { necklace: ["outfit"] };

// The plain parts a thumbnail shows for what it doesn't show: a T-shirt and no accessories.
function thumbPlain(gender) {
  const first = (field) => (lookOptions(field, gender)[0] || { id: DEFAULT_LOOKS[gender][field] }).id;
  return {
    outfit: gender === "male" ? "m-tshirt" : "w-tshirt",
    eyewear: first("eyewear"), earrings: first("earrings"), necklace: first("necklace"), facialHair: first("facialHair"),
  };
}
const PREVIEW_POSE_MS = 1200; // Preview reactions: how long each pose shows

// editing: the saved character being edited (null: creating). triedSave: the name is checked live
// after the first Save that failed on it.
const editor = {
  editing: null,
  look: defaultLook(),
  personality: "kind",
  triedSave: false,
  previewTimer: 0,
  // key: what the thumbnail should show now (see thumbKey), drawn: what it shows.
  thumbs: [], // { field, id, view, box, prefix, key, drawn, near (on or near the screen) }
  observer: null,
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

function thumbLook(field, id) {
  const look = thumbPlain(editor.look.gender);
  for (const base of [...THUMB_BASE, ...(THUMB_EXTRA[field] || [])]) look[base] = editor.look[base];
  look[field] = id;
  return look;
}

function thumbKey(thumb) {
  const look = thumbLook(thumb.field, thumb.id);
  return `${LOOK_FIELDS.map((field) => look[field]).join("|")}/${editor.personality}`;
}

// Every thumbnail shows its option in the chosen personality's calm pose. Only thumbnails whose
// inputs changed are drawn again, and only those on (or near) the screen: the others are drawn
// when they scroll into view (showThumb), so a tap never waits for ~70 drawings at once.
function updateThumbs() {
  for (const thumb of editor.thumbs) {
    thumb.key = thumbKey(thumb);
    if (thumb.near || !editor.observer) showThumb(thumb);
  }
}

function showThumb(thumb) {
  if (thumb.drawn === thumb.key) return;
  thumb.drawn = thumb.key;
  // Our own drawing, with no user text in it.
  thumb.box.innerHTML = avatarInlineSvg(thumbLook(thumb.field, thumb.id), editor.personality, "initial", thumb.view, thumb.prefix);
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
  for (const section of [...SHARED_SECTIONS, ...GENDER_SECTIONS]) {
    document.querySelectorAll(`input[name="${section.field}"]`).forEach((input) => {
      input.checked = input.value === editor.look[section.field];
    });
  }
}

function redraw() {
  stopPreview();
  showPose("initial");
  updateThumbs();
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
    editor.thumbs.push({
      field: section.field, id: option.id, view: section.view, box,
      prefix: `t${editor.thumbs.length}-`, key: "", drawn: "", near: false,
    });
  }
  const name = document.createElement("span");
  name.className = "visually-hidden";
  name.textContent = option.label;
  label.append(name);
}

// One section: a fieldset with a radio button per option. The funny faces get their own "Funny"
// heading at the end of the Face section (still the same radio group).
function buildSection(section, container) {
  const options = lookOptions(section.field, editor.look.gender);
  if (options.length === 0) return;
  const fieldset = document.createElement("fieldset");
  fieldset.className = "editor-section";
  const legend = document.createElement("legend");
  const heading = document.createElement("h2");
  heading.textContent = section.title;
  legend.append(heading);
  const grid = document.createElement("div");
  grid.className = `option-grid option-grid-${section.kind || section.view}`;
  for (const option of options) {
    if (option.funny && !grid.querySelector(".option-group-title")) {
      const title = document.createElement("h3");
      title.className = "option-group-title";
      title.textContent = "Funny";
      grid.append(title);
    }
    const { label, input } = optionLabel(section.field, option.id, editor.look[section.field] === option.id);
    optionVisual(section, option, label);
    input.addEventListener("change", () => onLookChange(section.field, option.id));
    grid.append(label);
  }
  fieldset.append(legend, grid);
  container.append(fieldset);
}

function buildLookSections() {
  const container = $("#lookSections");
  for (const section of SHARED_SECTIONS) buildSection(section, container);
  const genderSections = document.createElement("div");
  genderSections.id = "genderSections";
  container.append(genderSections);
  buildGenderSections();
}

// The chosen gender's sections (again after a gender change), with their thumbnails.
function buildGenderSections() {
  const container = $("#genderSections");
  container.innerHTML = "";
  editor.thumbs = [];
  for (const section of GENDER_SECTIONS) buildSection(section, container);
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
// genders have different lists. The name and personality stay.
function onLookChange(field, id) {
  if (field === "gender") {
    if (id === editor.look.gender) return;
    editor.look = defaultLook(id);
    buildGenderSections();
    syncChecked();
  } else {
    editor.look = { ...editor.look, [field]: id };
  }
  redraw();
}

function onRandomize() {
  editor.look = randomLook(editor.look.gender);
  syncChecked();
  redraw();
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
