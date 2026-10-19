// Character roster and the poses every character needs.
//
// Real artwork: set `artPath` to a folder holding one image per pose, named after POSES:
//   assets/characters/grandma/initial.png, .../level1.png, ... .../blink.png
// Any image that is missing falls back to the built-in placeholder drawing.

const POSES = ["initial", "level1", "level2", "level3", "level4", "level5", "good", "blink"];

// A character's personality comes from its group (see personalityOf below):
//   kind     = happy you're back, cheers you on
//   strict   = stern when you drift off
//   ragebait = annoying on purpose: mocking reactions, grudging when you do well
const GROUPS = {
  relaxed: { label: "Relaxed", personality: "kind" },
  strict: { label: "Strict", personality: "strict" },
  ragebait: {
    label: "Ragebait",
    personality: "ragebait",
    warning:
      "This is a ragebait character. Their reactions are loud and exaggerated on purpose. " +
      "It's all for laughs, never meant to actually hurt. Still want to pick them?",
  },
};

// The one place that decides how a character behaves. Saved sessions store the
// result as `style`. An unknown group falls back to "kind".
function personalityOf(character) {
  const group = character && GROUPS[character.group];
  return group ? group.personality : "kind";
}

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
