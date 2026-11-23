// TEMPORARY listening lab for PR #81 (Focus sound): plays the variants of Fire, Thunder, Train and
// Airplane, and the new Stream, through the app's own player (js/focus-sound.js) and worklet. Deleted in the PR's
// last commit, once the variants are picked.
"use strict";

const LAB_SOUNDS = [
  { group: "Fire", id: "fire", variant: "a", name: "Fire A", note: "Fireplace: fuller flame, 1–4 crackles a second, a few pops a minute, a small room." },
  { group: "Fire", id: "fire", variant: "b", name: "Fire B", note: "Campfire: softer, more open flame, denser crackles (many tiny), little reverb." },
  { group: "Thunder", id: "thunder", variant: "a", name: "Thunder A", note: "Rolling rumble and growl only, no clap. First roll within 3–10 s; listen about 2 minutes." },
  { group: "Thunder", id: "thunder", variant: "b", name: "Thunder B", note: "Like A, a little closer, with soft distant claps at the start of about half the rolls." },
  { group: "Train", id: "train", variant: "a", name: "Train A", note: "Classic jointed track: a clear da-dum, the rolling noise lower." },
  { group: "Train", id: "train", variant: "b", name: "Train B", note: "Softer clacks, more rolling roar and rattle, the same rhythm." },
  { group: "Airplane", id: "airplane", variant: "a", name: "Airplane A", note: "Middle or rear seat: airflow around 300–1000 Hz, more engine drone." },
  { group: "Airplane", id: "airplane", variant: "b", name: "Airplane B", note: "Front seat: brighter airflow (around 1–3 kHz), less engine." },
  { group: "Stream", id: "stream", variant: "", name: "Stream", note: "The bubbles as before, the steady rush under them about 3 dB lower." },
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
