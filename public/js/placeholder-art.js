// Draws simple SVG stand-in art for characters that don't have real artwork yet.
// Every character gets all 8 poses in its own personality (see personalityOf in
// characters.js), so the app is fully usable before the real images are finished.

// Face settings for each personality and pose. eyes and brows can be one value
// for both sides or [left, right].
const ART_EXPRESSIONS = {
  kind: {
    initial: { eyes: "open", brows: "soft", mouth: "smile" },
    blink: { eyes: "closed", brows: "soft", mouth: "smile" },
    good: { eyes: "happy", brows: "raised", mouth: "grin", extras: ["sparkle", "blush"] },
    level1: { eyes: "open", brows: "raised", mouth: "smile" },
    level2: { eyes: "happy", brows: "raised", mouth: "smile", extras: ["blush"] },
    level3: { eyes: "happy", brows: "raised", mouth: "grin", extras: ["sweat"] },
    level4: { eyes: "wide", brows: "worried", mouth: "grin", extras: ["sweat"] },
    level5: { eyes: "teary", brows: "worried", mouth: "wobbly", extras: ["tears", "heart"] },
  },
  strict: {
    initial: { eyes: "open", brows: "flat", mouth: "flat" },
    blink: { eyes: "closed", brows: "flat", mouth: "flat" },
    good: { eyes: "open", brows: "flat", mouth: "smirk" },
    level1: { eyes: "open", brows: "stern", mouth: "flat" },
    level2: { eyes: "narrow", brows: "stern", mouth: "frown" },
    level3: { eyes: "narrow", brows: "angry", mouth: "frown", extras: ["vein"] },
    level4: { eyes: "wide", brows: "angry", mouth: "shout", extras: ["vein"] },
    level5: { eyes: "wide", brows: "furious", mouth: "yell", extras: ["vein", "steam", "red"] },
  },
  // Annoying on purpose: gets more insulting with the level, and only grudging when you do well.
  ragebait: {
    initial: { eyes: "bored", brows: "flat", mouth: "smirk" },
    blink: { eyes: "closed", brows: "flat", mouth: "smirk" },
    good: { eyes: "side", brows: "flat", mouth: "meh" }, // unimpressed side-eye
    level1: { eyes: "bored", brows: ["raised", "flat"], mouth: "smirk" }, // smirk
    level2: { eyes: "rolled", brows: "raised", mouth: "flat" }, // eye-roll
    level3: { eyes: ["happy", "open"], brows: ["flat", "raised"], mouth: "tongue" }, // wink + tongue out
    level4: { eyes: "squeezed", brows: "raised", mouth: "laugh", extras: ["tears", "clap"] }, // laughing, slow clap
    level5: { eyes: "bored", brows: ["raised", "flat"], mouth: "smirk", extras: ["blush", "middleFinger"] },
  },
};

// Body, hair and accessories for each character.
const ART_LOOKS = {
  boss: {
    skin: "#f2c9a0",
    brow: "#2b2b2b",
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#1f2a44"/>
           <path d="M80 176 L100 202 L120 176Z" fill="#fff"/>
           <path d="M96 182 L104 182 L109 222 L100 234 L91 222Z" fill="#c0392b"/>`,
    hair: `<path d="M46 100 Q44 44 100 42 Q156 44 154 100 Q150 66 118 62 Q96 74 60 70 Q50 80 46 100Z" fill="#2b2b2b"/>`,
  },
  grandma: {
    skin: "#f5d0b5",
    brow: "#9a9a9a",
    back: `<ellipse cx="100" cy="102" rx="64" ry="68" fill="#d9d9d9"/>
           <circle cx="100" cy="38" r="22" fill="#cfcfcf"/>`,
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#b56b8e"/>
           <path d="M82 176 L100 210 L118 176Z" fill="#fff4e6"/>
           <circle cx="100" cy="222" r="3.5" fill="#fff4e6"/><circle cx="100" cy="234" r="3.5" fill="#fff4e6"/>`,
    hair: `<path d="M44 102 Q46 50 100 48 Q154 50 156 102 Q142 70 100 66 Q58 70 44 102Z" fill="#e3e3e3"/>`,
    glasses: `<g fill="#fff" fill-opacity="0.15" stroke="#7a5230" stroke-width="3">
                <circle cx="78" cy="102" r="15"/><circle cx="122" cy="102" r="15"/>
              </g>
              <path d="M93 101 Q100 96 107 101" fill="none" stroke="#7a5230" stroke-width="3"/>`,
  },
  bodybuilder: {
    skin: "#c98c5a",
    brow: "#3b2414",
    neckWidth: 44,
    body: `<path d="M0 240 Q2 166 100 164 Q198 166 200 240Z" fill="#c98c5a"/>
           <path d="M58 240 L62 182 Q100 206 138 182 L142 240Z" fill="#2d3436"/>`,
    hair: `<path d="M48 94 Q50 46 100 44 Q150 46 152 94 Q140 62 100 60 Q60 62 48 94Z" fill="#3b2414"/>
           <path d="M47 82 Q100 64 153 82 L153 94 Q100 76 47 94Z" fill="#e74c3c"/>`,
  },
  soldier: {
    skin: "#e0b088",
    brow: "#4a3520",
    body: `<path d="M16 240 Q20 176 100 172 Q180 176 184 240Z" fill="#5b6b3a"/>
           <circle cx="50" cy="210" r="12" fill="#44522b"/><circle cx="150" cy="200" r="14" fill="#44522b"/>
           <circle cx="110" cy="228" r="10" fill="#7a8a50"/><circle cx="72" cy="232" r="8" fill="#7a8a50"/>`,
    hair: `<path d="M40 80 Q38 28 100 26 Q162 28 160 80 Q166 82 168 88 L32 88 Q34 82 40 80Z" fill="#556b2f"/>
           <path d="M38 78 L162 78 L164 86 L36 86Z" fill="#3f4f22"/>`,
  },
};

// [outer end y, inner end y] of each eyebrow.
const BROW_SHAPES = {
  flat: [80, 80],
  soft: [80, 77],
  raised: [73, 73],
  worried: [80, 71],
  stern: [77, 82],
  angry: [73, 86],
  furious: [68, 90],
};

const EYE_Y = 102;
const LINE = `fill="none" stroke="#222" stroke-linecap="round"`;

function drawEye(cx, type) {
  switch (type) {
    case "bored": // half-closed lid
      return `<path d="M${cx - 8} ${EYE_Y} A8 8 0 0 0 ${cx + 8} ${EYE_Y}Z" fill="#222"/>
              <path d="M${cx - 11} ${EYE_Y} L${cx + 11} ${EYE_Y}" ${LINE} stroke-width="3.5"/>`;
    case "side": // half-closed, looking away
      return `<path d="M${cx - 10} ${EYE_Y} A10 9 0 0 0 ${cx + 10} ${EYE_Y}Z" fill="#fff" stroke="#222" stroke-width="2.5"/>
              <circle cx="${cx + 5}" cy="${EYE_Y + 3.5}" r="4" fill="#222"/>
              <path d="M${cx - 12} ${EYE_Y} L${cx + 12} ${EYE_Y}" ${LINE} stroke-width="3.5"/>`;
    case "rolled": // pupils up
      return `<circle cx="${cx}" cy="${EYE_Y}" r="11" fill="#fff" stroke="#222" stroke-width="2.5"/>
              <circle cx="${cx}" cy="${EYE_Y - 6}" r="5" fill="#222"/>`;
    case "squeezed": { // > < laughing eyes, pointing at the nose
      const d = cx < 100 ? 1 : -1;
      return `<path d="M${cx - 8 * d} ${EYE_Y - 7} L${cx + 8 * d} ${EYE_Y} L${cx - 8 * d} ${EYE_Y + 7}" ${LINE} stroke-width="3.5" stroke-linejoin="round"/>`;
    }
    case "closed":
      return `<path d="M${cx - 9} ${EYE_Y} Q${cx} ${EYE_Y + 6} ${cx + 9} ${EYE_Y}" ${LINE} stroke-width="3.5"/>`;
    case "happy":
      return `<path d="M${cx - 9} ${EYE_Y + 3} Q${cx} ${EYE_Y - 8} ${cx + 9} ${EYE_Y + 3}" ${LINE} stroke-width="3.5"/>`;
    case "wide":
      return `<circle cx="${cx}" cy="${EYE_Y}" r="11" fill="#fff" stroke="#222" stroke-width="2.5"/>
              <circle cx="${cx}" cy="${EYE_Y}" r="5" fill="#222"/>`;
    case "narrow":
      return `<path d="M${cx - 10} ${EYE_Y - 2} L${cx + 10} ${EYE_Y - 2}" ${LINE} stroke-width="3"/>
              <ellipse cx="${cx}" cy="${EYE_Y + 1}" rx="6" ry="2.5" fill="#222"/>`;
    case "teary":
      return `<circle cx="${cx}" cy="${EYE_Y}" r="8" fill="#222"/>
              <circle cx="${cx + 2}" cy="${EYE_Y - 3}" r="3" fill="#fff"/>
              <circle cx="${cx - 3}" cy="${EYE_Y + 3}" r="1.5" fill="#fff"/>`;
    default:
      return `<circle cx="${cx}" cy="${EYE_Y}" r="7" fill="#222"/>
              <circle cx="${cx + 2}" cy="${EYE_Y - 2}" r="2" fill="#fff"/>`;
  }
}

function drawBrows(type, color) {
  const [left, right] = Array.isArray(type) ? type : [type, type];
  const [leftOuter, leftInner] = BROW_SHAPES[left] || BROW_SHAPES.flat;
  const [rightOuter, rightInner] = BROW_SHAPES[right] || BROW_SHAPES.flat;
  const style = `fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"`;
  return `<path d="M66 ${leftOuter} L90 ${leftInner}" ${style}/><path d="M110 ${rightInner} L134 ${rightOuter}" ${style}/>`;
}

function drawMouth(type) {
  switch (type) {
    case "grin":
      return `<path d="M80 128 Q100 160 120 128Z" fill="#6b1f1f"/><path d="M84 129 L116 129 L114 134 L86 134Z" fill="#fff"/>`;
    case "flat":
      return `<path d="M88 136 L112 136" ${LINE} stroke-width="3.5"/>`;
    case "smirk":
      return `<path d="M88 137 Q104 139 114 130" ${LINE} stroke-width="3.5"/>`;
    case "frown":
      return `<path d="M86 141 Q100 128 114 141" ${LINE} stroke-width="3.5"/>`;
    case "shout":
      return `<ellipse cx="100" cy="139" rx="12" ry="10" fill="#5a1414"/>`;
    case "yell":
      return `<ellipse cx="100" cy="141" rx="19" ry="16" fill="#5a1414"/>
              <ellipse cx="100" cy="150" rx="10" ry="5" fill="#e05a5a"/>`;
    case "meh":
      return `<path d="M88 135 L113 139" ${LINE} stroke-width="3.5"/>`;
    case "tongue":
      return `<path d="M92 136 Q92 156 101 156 Q110 156 110 136Z" fill="#e8607a" stroke="#222" stroke-width="2.5"/>
              <path d="M101 140 L101 150" ${LINE} stroke-width="2"/>
              <path d="M84 131 Q100 144 116 131" ${LINE} stroke-width="3.5"/>`;
    case "laugh":
      return `<path d="M76 126 Q100 170 124 126Z" fill="#6b1f1f"/>
              <path d="M80 127 L120 127 L118 133 L82 133Z" fill="#fff"/>
              <ellipse cx="100" cy="152" rx="11" ry="5" fill="#e05a5a"/>`;
    case "wobbly":
      return `<path d="M84 136 Q92 129 100 136 Q108 143 116 136" ${LINE} stroke-width="3.5"/>`;
    default:
      return `<path d="M84 131 Q100 146 116 131" ${LINE} stroke-width="3.5"/>`;
  }
}

function star(x, y, s) {
  const k = s * 0.3;
  return `<path d="M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k}Z" fill="#ffc21a"/>`;
}

function drop(x, y) {
  return `<path d="M${x} ${y} Q${x - 6} ${y + 11} ${x} ${y + 14} Q${x + 6} ${y + 11} ${x} ${y}Z" fill="#7ec8ff"/>`;
}

// skin is the character's skin colour, for the hands.
const ART_EXTRAS = {
  sparkle: () => star(28, 56, 11) + star(172, 64, 9) + star(162, 28, 6),
  blush: () => `<ellipse cx="66" cy="122" rx="10" ry="5" fill="#ff7aa2" fill-opacity="0.5"/>
                <ellipse cx="134" cy="122" rx="10" ry="5" fill="#ff7aa2" fill-opacity="0.5"/>`,
  sweat: () => drop(160, 66),
  tears: () => drop(72, 112) + drop(128, 112),
  heart: () => `<path d="M164 66 C150 55 152 43 164 50 C176 43 178 55 164 66Z" fill="#ff4d6d"/>`,
  vein: () => `<g fill="none" stroke="#d62828" stroke-width="4" stroke-linecap="round">
                 <path d="M146 48 Q152 55 146 62"/><path d="M166 48 Q160 55 166 62"/>
                 <path d="M149 44 Q156 50 163 44"/><path d="M149 66 Q156 60 163 66"/>
               </g>`,
  steam: () => `<g fill="#b8b8b8" fill-opacity="0.85">
                  <circle cx="30" cy="62" r="11"/><circle cx="20" cy="44" r="7"/><circle cx="26" cy="30" r="4"/>
                  <circle cx="170" cy="62" r="11"/><circle cx="180" cy="44" r="7"/><circle cx="174" cy="30" r="4"/>
                </g>`,
  // Two palms meeting in front of the chest, with small motion lines.
  clap: (skin) => `<g fill="${skin}" stroke="#222" stroke-width="2.5">
                     <ellipse cx="89" cy="206" rx="13" ry="22" transform="rotate(18 89 206)"/>
                     <ellipse cx="111" cy="206" rx="13" ry="22" transform="rotate(-18 111 206)"/>
                   </g>
                   <g fill="none" stroke="#222" stroke-width="3" stroke-linecap="round">
                     <path d="M66 192 Q60 204 66 216"/><path d="M134 192 Q140 204 134 216"/>
                     <path d="M54 196 Q50 204 54 212"/><path d="M146 196 Q150 204 146 212"/>
                   </g>`,
  // A fist with the middle finger raised.
  middleFinger: (skin) => `<g fill="${skin}" stroke="#222" stroke-width="2.5">
                             <rect x="153" y="128" width="14" height="62" rx="7"/>
                             <rect x="139" y="170" width="14" height="22" rx="7"/>
                             <rect x="167" y="170" width="14" height="22" rx="7"/>
                             <rect x="136" y="180" width="48" height="44" rx="14"/>
                           </g>
                           <rect x="155" y="131" width="10" height="10" rx="4" fill="#fff" fill-opacity="0.45"/>
                           <path d="M142 202 Q160 196 178 206" ${LINE} stroke-width="2.5"/>`,
};

const artCache = new Map();

// Returns a data: URL for the given character and pose, drawn in the character's personality.
function placeholderArt(character, pose) {
  const key = `${character.id}/${pose}`;
  if (artCache.has(key)) return artCache.get(key);

  const look = ART_LOOKS[character.id] || ART_LOOKS.boss;
  const face = (ART_EXPRESSIONS[personalityOf(character)] || ART_EXPRESSIONS.kind)[pose] || ART_EXPRESSIONS.kind.initial;
  const [leftEye, rightEye] = Array.isArray(face.eyes) ? face.eyes : [face.eyes, face.eyes];
  const extras = face.extras || [];
  const neckWidth = look.neckWidth || 32;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
    ${look.back || ""}
    ${look.body}
    <rect x="${100 - neckWidth / 2}" y="140" width="${neckWidth}" height="40" fill="${look.skin}"/>
    <ellipse cx="100" cy="105" rx="54" ry="60" fill="${look.skin}"/>
    ${extras.includes("red") ? `<ellipse cx="100" cy="105" rx="54" ry="60" fill="#ff2d2d" fill-opacity="0.3"/>` : ""}
    ${look.hair}
    ${drawBrows(face.brows, look.brow)}
    ${drawEye(78, leftEye)}
    ${drawEye(122, rightEye)}
    ${drawMouth(face.mouth)}
    ${look.glasses || ""}
    ${extras.filter((name) => ART_EXTRAS[name]).map((name) => ART_EXTRAS[name](look.skin)).join("")}
  </svg>`;

  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  artCache.set(key, url);
  return url;
}
