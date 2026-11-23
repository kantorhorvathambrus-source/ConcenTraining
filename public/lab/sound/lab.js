// TEMPORARY listening lab for PR #81 (Focus sound): plays the variants of Rain, Birds, Fire and
// Waves, and Wind, through the app's own player (js/focus-sound.js) and worklet. Deleted in the PR's
// last commit, once the variants are picked.
"use strict";

const LAB_SOUNDS = [
  { group: "Rain", id: "rain", variant: "a", name: "Rain A", note: "Drops only, at three distances; the many far drops make the hiss." },
  { group: "Rain", id: "rain", variant: "b", name: "Rain B", note: "Fewer drops over a steady hiss shaped like rain (1–8 kHz) that never swells." },
  { group: "Rain", id: "rain", variant: "c", name: "Rain C", note: "Like A, on leaves and a roof: more near drops that ring longer, and more reverb." },
  { group: "Birds", id: "birds", variant: "a", name: "Birds A", note: "Two birds, simple whistles and sweeps." },
  { group: "Birds", id: "birds", variant: "b", name: "Birds B", note: "Three birds, one far away, with trills and more varied syllables." },
  { group: "Fire", id: "fire", variant: "a", name: "Fire A", note: "Crackles in clusters, rarer low pops, a soft low rumble." },
  { group: "Fire", id: "fire", variant: "b", name: "Fire B", note: "Denser, smaller ticking crackles, bigger and rarer pops, a quieter and lower rumble." },
  { group: "Waves", id: "waves", variant: "a", name: "Waves A", note: "The first version: a smooth swell that brightens at each crest." },
  { group: "Waves", id: "waves", variant: "b", name: "Waves B", note: "Each wave has a shape: a short build, a fast break with bright foam, then a fading wash." },
  { group: "Wind", id: "wind", variant: "", name: "Wind", note: "Gusts through a slowly moving band, with a faint leaf rustle at the peaks." },
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
