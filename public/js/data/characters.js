// Character roster and the poses every character needs.
//
// Real artwork: set `artPath` to a folder holding one image per pose, named after POSES:
//   assets/characters/grandma/initial.png, .../level1.png, ... .../blink.png, .../refocus.png
// Any image that is missing falls back to the built-in placeholder drawing.

// refocus: "OK, back to work", shown for a moment after every distraction reaction.
const POSES = ["initial", "level1", "level2", "level3", "level4", "level5", "good", "blink", "refocus"];

// A character's personality comes from its group (see personalityOf below):
//   kind     = happy you're back, cheers you on
//   firm     = patient, but expects your best: never angry, disappointed instead
//   strict   = stern when you drift off
//   ragebait = annoying on purpose: mocking reactions, grudging when you do well
const GROUPS = {
  relaxed: { label: "Relaxed", personality: "kind" },
  firm: { label: "Firm but fair", personality: "firm" },
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

// What the user sees for a saved style: its group's label ("kind" -> "Relaxed"). Old history
// entries keep the style they ran with, so this goes by the style, not the character's group.
function styleLabel(style) {
  const group = Object.values(GROUPS).find((g) => g.personality === style);
  return group ? group.label : style;
}

// Ordered by group: relaxed, firm, strict, ragebait (the picker shows them in this order).
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
    id: "leader",
    name: "Leader",
    group: "relaxed",
    tagline: "Believes in you. Calm, clear, and on your side.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "santa",
    name: "Santa",
    group: "relaxed",
    tagline: "Jolly, patient, and keeping an eye on his list.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "study-buddy",
    name: "Study Buddy",
    group: "relaxed",
    tagline: "Studying right next to you. Let's both get this done.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "coach",
    name: "Coach",
    group: "relaxed",
    tagline: "Here to train your focus, one rep at a time.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "meditation-guide",
    name: "Meditation Guide",
    group: "relaxed",
    tagline: "Breathe in, breathe out. Come back, gently.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "professor",
    name: "Professor",
    group: "firm",
    tagline: "Patient and fair, but expects your best.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "librarian",
    name: "Librarian",
    group: "firm",
    tagline: "Quiet, please. Your focus is safe here.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "surgeon",
    name: "Surgeon",
    group: "firm",
    tagline: "Steady hands, steady mind.",
    artPath: null,
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
    id: "headmistress",
    name: "Headmistress",
    group: "strict",
    tagline: "Rules are rules. Eyes on your work.",
    artPath: null,
    artExt: "png",
  },
  {
    id: "grandmaster",
    name: "Grandmaster",
    group: "strict",
    tagline: "Silent, still, and always three moves ahead.",
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
  {
    id: "influencer",
    name: "Influencer",
    group: "ragebait",
    tagline: "Posts everything. Including your distractions.",
    artPath: null,
    artExt: "png",
  },
];
