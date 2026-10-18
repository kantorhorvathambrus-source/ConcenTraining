// Character roster and the poses every character needs.
//
// Real artwork: set `artPath` to a folder that has a `kind/` and a `strict/`
// subfolder, each holding one image per pose, named after POSES:
//   assets/characters/grandma/kind/initial.png, .../kind/level1.png, ... .../strict/blink.png
// Any image that is missing falls back to the built-in placeholder drawing.

const POSES = ["initial", "level1", "level2", "level3", "level4", "level5", "good", "blink"];

const GROUPS = {
  relaxed: { label: "Relaxed" },
  strict: { label: "Strict" },
  ragebait: {
    label: "Ragebait",
    warning:
      "This is a ragebait character. Their reactions are loud and exaggerated on purpose. " +
      "It's all for laughs, never meant to actually hurt. Still want to pick them?",
  },
};

const CHARACTERS = [
  {
    id: "grandma",
    name: "Grandma",
    group: "relaxed",
    tagline: "Warm, patient, and always has a cookie for you.",
    artPath: null, // e.g. "assets/characters/grandma"
    artExt: "png",
  },
  {
    id: "boss",
    name: "Boss",
    group: "strict",
    tagline: "Expects results. Deadlines are not suggestions.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "soldier",
    name: "Soldier",
    group: "strict",
    tagline: "Discipline first. Eyes on the mission.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "bodybuilder",
    name: "Bodybuilder",
    group: "ragebait",
    tagline: "Loud, dramatic, and personally offended when you skip focus day.",
    artPath: null,
    artExt: "png",
  },
];
