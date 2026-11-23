// TEMPORARY listening lab for PR #81 (Focus sound): plays the variants of Fire and Waves and the
// new sounds, through the app's own player (js/focus-sound.js) and worklet. Deleted in the PR's
// last commit, once the variants are picked.
"use strict";

const LAB_SOUNDS = [
  { group: "Fire", id: "fire", variant: "c", name: "Fire C", note: "A fireplace indoors: closer, more flame body, fewer snaps, a little room, a faint low roar." },
  { group: "Fire", id: "fire", variant: "d", name: "Fire D", note: "A campfire outdoors: more snaps and sap sizzle, less body, open space (little reverb)." },
  { group: "Waves", id: "waves", variant: "c", name: "Waves C", note: "Swell and break together, each with its own timing; when only one plays, it's mostly the smooth swell." },
  { group: "Waves", id: "waves", variant: "d", name: "Waves D", note: "The same, but when only one plays, it's mostly the break and wash." },
  { group: "New sounds", id: "stream", variant: "", name: "Stream", note: "A brook: many small bubbles over a gentle babble." },
  { group: "New sounds", id: "crickets", variant: "", name: "Crickets", note: "3–5 crickets at different distances, each with its own chirp and pace." },
  { group: "New sounds", id: "thunder", variant: "", name: "Thunder", note: "Distant rolls: the first within 3–10 s, then one every 20–90 s, silence in between." },
  { group: "New sounds", id: "train", variant: "", name: "Train", note: "Inside a carriage: low rumble, clack-clack over the rail joints, a gentle sway." },
  { group: "New sounds", id: "airplane", variant: "", name: "Airplane", note: "Cabin noise: deep and steady, a faint engine hum." },
];

let audio = null;
let player = null;
let playing = null; // the LAB_SOUNDS entry that's playing
const buttons = new Map();

function ensureAudio() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    player = createFocusSoundPlayer(() => audio);
    player.setMaster(Number(document.getElementById("labVolume").value));
  }
  if (audio.state !== "running") audio.resume().catch(() => {});
}

function relabel() {
  for (const [sound, button] of buttons) {
    const on = sound === playing;
    button.textContent = `${on ? "Stop" : "Play"} ${sound.name}`;
    button.setAttribute("aria-pressed", String(on));
    button.classList.toggle("primary", on);
  }
}

function onClick(sound) {
  if (playing === sound) {
    player.stop(0.3);
    playing = null;
  } else {
    ensureAudio();
    player.setMix({
      noise: "off",
      ambients: { [sound.id]: FOCUS_LAYER_DEFAULT },
      variants: sound.variant ? { [sound.id]: sound.variant } : {},
    });
    player.start(0.3);
    playing = sound;
  }
  relabel();
}

function init() {
  if (!focusAmbientSupported()) {
    document.getElementById("labUnsupported").hidden = false;
    return;
  }
  const list = document.getElementById("labList");
  let section = null;
  for (const sound of LAB_SOUNDS) {
    if (!section || section.dataset.group !== sound.group) {
      section = document.createElement("section");
      section.className = "lab-group";
      section.dataset.group = sound.group;
      const h2 = document.createElement("h2");
      h2.textContent = sound.group;
      section.append(h2);
      list.append(section);
    }
    const item = document.createElement("div");
    item.className = "lab-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.addEventListener("click", () => onClick(sound));
    const note = document.createElement("p");
    note.textContent = sound.note;
    item.append(button, note);
    section.append(item);
    buttons.set(sound, button);
  }
  const slider = document.getElementById("labVolume");
  slider.addEventListener("input", () => {
    document.getElementById("labVolumeValue").textContent = `${slider.value}%`;
    if (player) player.setMaster(Number(slider.value));
  });
  relabel();
}

init();
