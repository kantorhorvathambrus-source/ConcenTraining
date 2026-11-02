// The parts a custom character's look is built from (the editor's options), and how each one is
// drawn as SVG. avatar-art.js puts them together in layers; see "Avatar art guide" in the README.
//
// Every part is drawn on the same 200 × 240 canvas as the built-in placeholders, with the same
// anchor points:
//   eye line y = 102 (eye centres x = 78 / 122, moved a little by the face), mouth around y = 136,
//   head centre (100, 105), chin y = 163–170 (depends on the head), neck y = 140–180,
//   shoulder line y ≈ 172.
// Hair is drawn for the reference head (top y = 45, sides x = 46 / 154) and moved and stretched
// to fit each head shape (see hairTransform in avatar-art.js).

// ---------- real images ----------

// Layers that have a real image in public/assets/avatar/<category>/<id>.png, e.g. "hair-front/bob".
// A listed file replaces that part's SVG drawing everywhere; anything not listed stays SVG.
// Add one line here per new file (and the file to PRECACHE in sw.js, so it works offline).
// Files are listed instead of looked up, so the app never asks the server for ~150 files that
// don't exist. Categories: body, neck, outfit, necklace, ears, head, nose, marks, facial-hair,
// hair-back, hair-front, earrings, eyewear.
const AVATAR_PNG_FILES = [];

// ---------- colours ----------

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) {
  return "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

// Mixes a colour with another: amount 0 = the colour, 1 = the other one.
function mixColor(hex, other, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(other);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * amount));
}

// Relative luminance (0 = black, 1 = white), as in the WCAG contrast formula.
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---------- options ----------

const GENDERS = [
  {
    id: "female",
    label: "Female",
    // Shoulders and body (skin coloured: an outfit's neckline shows it).
    body: "M24 240 Q28 182 100 175 Q172 182 176 240Z",
    neckWidth: 28,
  },
  {
    id: "male",
    label: "Male",
    body: "M8 240 Q12 174 100 170 Q188 174 192 240Z",
    neckWidth: 34,
  },
];

// Very light to very dark, in even steps.
const SKIN_TONES = [
  { id: "tone1", label: "Skin tone 1: very light", color: "#fde7d6" },
  { id: "tone2", label: "Skin tone 2: light", color: "#f5d2b8" },
  { id: "tone3", label: "Skin tone 3: light beige", color: "#eabf9c" },
  { id: "tone4", label: "Skin tone 4: beige", color: "#dca783" },
  { id: "tone5", label: "Skin tone 5: light tan", color: "#c98e66" },
  { id: "tone6", label: "Skin tone 6: tan", color: "#b0754f" },
  { id: "tone7", label: "Skin tone 7: light brown", color: "#94603e" },
  { id: "tone8", label: "Skin tone 8: brown", color: "#794b30" },
  { id: "tone9", label: "Skin tone 9: dark brown", color: "#5e3924" },
  { id: "tone10", label: "Skin tone 10: very dark brown", color: "#45291b" },
];

const HAIR_COLORS = [
  { id: "black", label: "Black", color: "#1c1a19" },
  { id: "darkBrown", label: "Dark brown", color: "#3a2618" },
  { id: "brown", label: "Brown", color: "#5c3920" },
  { id: "lightBrown", label: "Light brown", color: "#8a5b36" },
  { id: "darkBlonde", label: "Dark blonde", color: "#a7834c" },
  { id: "blonde", label: "Blonde", color: "#e3c47e" },
  { id: "ginger", label: "Ginger", color: "#c0592a" },
  { id: "grey", label: "Grey", color: "#9c9a97" },
  { id: "white", label: "White", color: "#ebe9e4" },
  { id: "blue", label: "Blue", color: "#2f6fd6" },
];

// Brows and facial hair: a darker shade of the hair colour (more for light hair, so they show).
function browColor(hair) {
  return mixColor(hair, "#000000", luminance(hair) > 0.3 ? 0.4 : 0.2);
}

// ---------- heads ----------

function ellipsePath(cx, cy, rx, ry) {
  return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
}

// top: crown, chin: lowest point, halfW: half the width at the ears. Every head keeps the eyes,
// brows and mouths inside it, and stays between 50 and 60 wide so every hairstyle fits.
const HEAD_SHAPES = {
  round: { label: "round", top: 48, chin: 164, halfW: 56, path: ellipsePath(100, 106, 56, 58) },
  oval: { label: "oval", top: 44, chin: 166, halfW: 52, path: ellipsePath(100, 105, 52, 61) },
  long: { label: "long", top: 38, chin: 170, halfW: 50, path: ellipsePath(100, 104, 50, 66) },
  square: {
    label: "square", top: 48, chin: 166, halfW: 54,
    path: "M100 48 C142 48 154 58 154 92 L154 132 C154 156 136 166 100 166 C64 166 46 156 46 132 L46 92 C46 58 58 48 100 48Z",
  },
  heart: {
    label: "heart-shaped", top: 46, chin: 168, halfW: 56,
    path: "M100 46 C148 46 158 70 156 102 C153 132 122 162 100 168 C78 162 47 132 44 102 C42 70 52 46 100 46Z",
  },
  wide: { label: "wide", top: 53, chin: 163, halfW: 60, path: ellipsePath(100, 108, 60, 55) },
};

const EAR_SIZES = { small: { rx: 7, ry: 10 }, medium: { rx: 9, ry: 13 }, large: { rx: 12, ry: 16 } };
const EAR_Y = 106;

// Ear centres and earlobes for a head and ear size.
function earGeometry(head, ears) {
  const { rx, ry } = EAR_SIZES[ears];
  const dx = head.halfW - 1;
  return { rx, ry, dx, lobeY: EAR_Y + ry - 3, lobeDx: dx + rx * 0.35 };
}

// Noses sit between the eyes and the mouth (y 98–124), drawn in a darker shade of the skin.
const NOSES = {
  button: { label: "button", draw: (shade) => `<ellipse cx="100" cy="116" rx="6" ry="4.5" fill="${shade}" fill-opacity="0.6"/>` },
  straight: { label: "straight", draw: (shade) => `<path d="M100 103 L103.5 117 Q101 121 96 119.5" ${noseLine(shade)}/>` },
  wide: {
    label: "wide",
    draw: (shade) => `<path d="M90 117 Q94 122 100 120 Q106 122 110 117" ${noseLine(shade)}/>
                      <path d="M94 111 Q90 115 92 118 M106 111 Q110 115 108 118" ${noseLine(shade)}/>`,
  },
  long: { label: "long", draw: (shade) => `<path d="M100 97 L105 118 Q102 123 95 121" ${noseLine(shade)}/>` },
  curved: { label: "small curved", draw: (shade) => `<path d="M100 108 Q107 115 101 119 Q99 120 96.5 118.5" ${noseLine(shade)}/>` },
};

function noseLine(shade) {
  return `fill="none" stroke="${shade}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;
}

// Marks on the skin. geo: the face's eye positions (FACE_GEO in placeholder-art.js).
const MARKS = {
  freckles: {
    label: "freckles",
    draw: (geo, shade) => {
      const dots = [[-9, 15], [-3, 18], [3, 15], [9, 18], [-6, 22], [5, 22]];
      return `<g fill="${shade}" fill-opacity="0.7">` +
        [geo.eyeL, geo.eyeR].map((cx) => dots.map(([x, y]) => `<circle cx="${cx + x}" cy="${102 + y}" r="1.5"/>`).join("")).join("") +
        `</g>`;
    },
  },
  moleCheek: { label: "a mole", draw: () => `<circle cx="132" cy="126" r="2.3" fill="#3b2a20"/>` },
  moleLip: { label: "a mole", draw: () => `<circle cx="113" cy="125" r="2" fill="#3b2a20"/>` },
  moleChin: { label: "a mole", draw: () => `<circle cx="117" cy="150" r="2.2" fill="#3b2a20"/>` },
  dimples: {
    label: "dimples",
    draw: (geo, shade) => `<path d="M72 133 Q69 138 72 142 M128 133 Q131 138 128 142" fill="none" stroke="${shade}" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  rosy: {
    label: "rosy cheeks",
    draw: (geo) => `<ellipse cx="${geo.eyeL - 10}" cy="124" rx="11" ry="6.5" fill="#e8697d" fill-opacity="0.25"/>
                    <ellipse cx="${geo.eyeR + 10}" cy="124" rx="11" ry="6.5" fill="#e8697d" fill-opacity="0.25"/>`,
  },
  smileLines: {
    label: "smile lines",
    draw: (geo, shade) => `<path d="M87 117 Q79 126 82 137 M113 117 Q121 126 118 137" fill="none" stroke="${shade}" stroke-width="2" stroke-linecap="round" stroke-opacity="0.8"/>`,
  },
};

const EYE_SPACINGS = { close: 3, normal: 0, wide: -3 }; // how far each eye moves towards the nose
const EYE_SIZES = { small: 0.88, medium: 1, large: 1.14 }; // scale of every eye drawing
const BROW_WIDTHS = { thin: 3.5, medium: 5, thick: 7 }; // the pose still sets the brow's shape

// 20 face presets: shape and features only, never the expression (that comes from the pose).
const FACE_PRESETS = [
  ["round", "medium", "button", "medium", "normal", "medium", []],
  ["round", "small", "curved", "large", "normal", "thin", ["freckles", "rosy"]],
  ["round", "large", "wide", "small", "wide", "thick", ["dimples"]],
  ["oval", "medium", "straight", "medium", "normal", "medium", []],
  ["oval", "small", "curved", "medium", "close", "thin", ["freckles"]],
  ["oval", "large", "long", "small", "normal", "thick", ["moleCheek"]],
  ["oval", "medium", "button", "large", "wide", "medium", ["smileLines"]],
  ["long", "medium", "long", "small", "close", "medium", []],
  ["long", "large", "straight", "medium", "normal", "thick", ["smileLines"]],
  ["long", "small", "curved", "large", "normal", "thin", ["moleLip"]],
  ["square", "medium", "wide", "medium", "wide", "thick", []],
  ["square", "large", "straight", "small", "normal", "thick", ["dimples"]],
  ["square", "small", "button", "medium", "close", "medium", ["rosy"]],
  ["heart", "small", "curved", "large", "wide", "thin", []],
  ["heart", "medium", "button", "medium", "normal", "medium", ["freckles"]],
  ["heart", "medium", "straight", "small", "close", "thin", ["dimples", "rosy"]],
  ["heart", "large", "long", "medium", "wide", "medium", ["moleChin"]],
  ["wide", "large", "wide", "medium", "wide", "medium", ["rosy"]],
  ["wide", "medium", "button", "large", "normal", "thick", ["freckles", "dimples"]],
  ["wide", "small", "straight", "small", "close", "thin", ["smileLines"]],
];

const FACES = FACE_PRESETS.map(([head, ears, nose, eyeSize, eyeSpacing, brows, marks], index) => {
  const n = index + 1;
  const features = [`${NOSES[nose].label} nose`, ...marks.map((mark) => MARKS[mark].label)];
  return {
    id: `f${String(n).padStart(2, "0")}`,
    label: `Face ${n}: ${HEAD_SHAPES[head].label}, ${features.join(", ")}`,
    head, ears, nose, eyeSize, eyeSpacing, brows, marks,
  };
});

// The face's geometry for the shared expression parts (see FACE_GEO in placeholder-art.js).
function faceGeometry(face) {
  const scale = EYE_SIZES[face.eyeSize];
  const shift = EYE_SPACINGS[face.eyeSpacing];
  return {
    eyeL: 78 + shift,
    eyeR: 122 - shift,
    eyeScale: scale,
    browWidth: BROW_WIDTHS[face.brows],
    browDy: Math.round(-(scale - 1) * 12 * 10) / 10, // bigger eyes push the brows up a little
    tearDy: Math.round((scale - 1) * 10 * 10) / 10,
  };
}

// ---------- hair ----------
// c: { hair, shade } colours. back is drawn behind the head and body, front over the head (but
// under the eyes, brows and mouth, so the expression always shows). coversEars: Randomize leaves
// earrings out with it.

const curl = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;

function braid(x) {
  let links = "";
  for (let y = 116; y <= 200; y += 17) links += `<ellipse cx="${x}" cy="${y}" rx="9" ry="10.5"/>`;
  return links;
}

const CENTER_PART_TOP = "M46 104 Q42 40 100 38 Q158 40 154 104 Q150 66 104 58 L100 50 L96 58 Q50 66 46 104Z";

const HAIRSTYLES = [
  {
    id: "buzz", label: "Buzz cut", coversEars: false,
    front: (c) => `<path d="M50 86 Q46 46 100 44 Q154 46 150 86 Q144 62 100 58 Q56 62 50 86Z" fill="${c.hair}" fill-opacity="0.85"/>`,
  },
  {
    id: "crop", label: "Short crop", coversEars: false,
    front: (c) => `<path d="M46 98 Q42 42 100 38 Q158 42 154 98 Q150 72 140 66 L134 56 L124 64 L113 53 L102 63 L90 53 L80 64 L68 56 L62 67 Q50 74 46 98Z" fill="${c.hair}"/>`,
  },
  {
    id: "sidePart", label: "Side part", coversEars: false,
    front: (c) => `<path d="M46 100 Q42 42 100 40 Q160 42 154 100 Q152 80 144 68 Q118 58 76 62 Q60 66 52 80 Q48 88 46 100Z" fill="${c.hair}"/>
                   <path d="M76 62 Q98 44 152 72 Q122 52 98 52 Q84 54 76 62Z" fill="${c.shade}" fill-opacity="0.5"/>
                   <path d="M76 62 Q74 52 86 44" fill="none" stroke="${c.shade}" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  {
    id: "curls", label: "Short curls", coversEars: false,
    front: (c) => `<g fill="${c.hair}" stroke="${c.shade}" stroke-width="1.5">
                     ${curl(52, 86, 10)}${curl(148, 86, 10)}${curl(55, 68, 11)}${curl(145, 68, 11)}
                     ${curl(67, 54, 12)}${curl(133, 54, 12)}${curl(83, 45, 12)}${curl(117, 45, 12)}${curl(100, 42, 12)}
                     ${curl(80, 60, 9)}${curl(100, 56, 9)}${curl(120, 60, 9)}
                   </g>`,
  },
  {
    id: "afro", label: "Afro", coversEars: false,
    back: (c) => `<circle cx="100" cy="84" r="72" fill="${c.hair}" stroke="${c.shade}" stroke-width="2"/>`,
    front: (c) => `<path d="M48 96 Q48 58 100 54 Q152 58 152 96 Q142 74 100 70 Q58 74 48 96Z" fill="${c.hair}"/>`,
  },
  {
    id: "bob", label: "Bob", coversEars: true,
    back: (c) => `<path d="M36 112 Q32 38 100 34 Q168 38 164 112 L166 152 Q150 160 134 150 L134 110 L66 110 L66 150 Q50 160 34 152Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="M46 104 Q42 40 100 38 Q158 40 154 104 Q152 80 146 70 L54 70 Q48 80 46 104Z" fill="${c.hair}"/>
                   <path d="M44 92 L42 152 Q52 158 60 148 L58 92Z M156 92 L158 152 Q148 158 140 148 L142 92Z" fill="${c.hair}"/>
                   <path d="M70 70 L68 62 M100 70 L100 60 M130 70 L132 62" stroke="${c.shade}" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "shoulder", label: "Shoulder length", coversEars: true,
    back: (c) => `<path d="M36 112 Q32 38 100 34 Q168 38 164 112 L170 184 Q152 194 136 182 L136 120 L64 120 L64 182 Q48 194 30 184Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="M46 104 Q40 40 100 38 Q160 40 154 104 Q150 74 128 64 Q96 76 62 66 Q52 80 46 104Z" fill="${c.hair}"/>
                   <path d="M46 92 Q38 140 40 178 Q50 186 60 176 Q54 130 58 98Z M154 92 Q162 140 160 178 Q150 186 140 176 Q146 130 142 98Z" fill="${c.hair}"/>
                   <path d="M62 66 Q96 74 128 64" fill="none" stroke="${c.shade}" stroke-width="2"/>`,
  },
  {
    id: "long", label: "Long straight", coversEars: true,
    back: (c) => `<path d="M34 112 Q30 36 100 32 Q170 36 166 112 L172 240 L134 240 L134 120 L66 120 L66 240 L28 240Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="${CENTER_PART_TOP}" fill="${c.hair}"/>
                   <path d="M46 92 Q36 150 40 236 L60 236 Q56 150 58 100Z M154 92 Q164 150 160 236 L140 236 Q144 150 142 100Z" fill="${c.hair}"/>
                   <path d="M50 130 L50 220 M150 130 L150 220" stroke="${c.shade}" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "bun", label: "High bun", coversEars: false,
    front: (c) => `<circle cx="100" cy="27" r="19" fill="${c.hair}" stroke="${c.shade}" stroke-width="2"/>
                   <path d="M47 98 Q44 44 100 42 Q156 44 153 98 Q146 62 100 58 Q54 62 47 98Z" fill="${c.hair}"/>
                   <path d="M86 43 Q100 49 114 43" fill="none" stroke="${c.shade}" stroke-width="4" stroke-linecap="round"/>
                   <path d="M66 58 Q80 48 94 46 M134 58 Q120 48 106 46" fill="none" stroke="${c.shade}" stroke-width="1.8"/>`,
  },
  {
    id: "braids", label: "Braids", coversEars: true,
    front: (c) => `<path d="${CENTER_PART_TOP}" fill="${c.hair}"/>
                   <g fill="${c.hair}" stroke="${c.shade}" stroke-width="2">${braid(48)}${braid(152)}</g>
                   <rect x="42" y="208" width="12" height="7" rx="3" fill="#e74c3c"/>
                   <rect x="146" y="208" width="12" height="7" rx="3" fill="#e74c3c"/>`,
  },
];

// ---------- outfits ----------
// c: { skin, nw (neck width) }. body is drawn inside the body's outline (so one outfit fits both
// shoulder shapes) and may paint the whole area; collar is drawn on top without that limit, for
// collars that rise above the shoulder line. highCollar: Randomize leaves necklaces out with it.

const OUTFIT_BASE = (color) => `<rect x="0" y="140" width="200" height="100" fill="${color}"/>`;
const CREW_NECK = (c, rib) => `<path d="M84 170 Q100 190 116 170Z" fill="${c.skin}"/>
                               <path d="M84 170 Q100 190 116 170" fill="none" stroke="${rib}" stroke-width="3"/>`;
const SLEEVE_SEAMS = (color) => `<path d="M44 194 Q50 208 48 226 M156 194 Q150 208 152 226" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
const SHIRT_COLLAR = (fill, line) => `<path d="M84 170 L100 186 L93 194 L78 177Z M116 170 L100 186 L107 194 L122 177Z" fill="${fill}" stroke="${line}" stroke-width="1.5" stroke-linejoin="round"/>`;

const OUTFITS = [
  {
    id: "hoodie", label: "Hoodie", highCollar: true,
    body: () => `${OUTFIT_BASE("#5d7184")}
                 <path d="M66 240 L70 214 Q100 206 130 214 L134 240Z" fill="#4a5b6b"/>
                 <path d="M90 184 L88 210 M110 184 L112 210" stroke="#ececec" stroke-width="3" stroke-linecap="round"/>`,
    collar: () => `<path d="M60 184 Q58 156 100 158 Q142 156 140 184 Q124 173 100 175 Q76 173 60 184Z" fill="#4a5b6b"/>`,
  },
  {
    id: "tshirt", label: "T-shirt",
    body: (c) => `${OUTFIT_BASE("#e0483e")}${CREW_NECK(c, "#b8362e")}${SLEEVE_SEAMS("#b8362e")}`,
  },
  {
    id: "sweater", label: "Sweater",
    body: () => `${OUTFIT_BASE("#d9a441")}
                 <path d="M60 196 L60 240 M80 200 L80 240 M120 200 L120 240 M140 196 L140 240" stroke="#b98a2f" stroke-width="2" stroke-opacity="0.6"/>`,
    collar: () => `<path d="M78 168 Q100 184 122 168 L122 176 Q100 192 78 176Z" fill="#b98a2f"/>`,
  },
  {
    id: "shirtTie", label: "Shirt and tie",
    body: () => `${OUTFIT_BASE("#f4f4f2")}
                 ${SHIRT_COLLAR("#ffffff", "#c9c9c9")}
                 <path d="M95 183 L105 183 L103 191 L97 191Z" fill="#1f3566"/>
                 <path d="M97 190 L103 190 L108 224 L100 236 L92 224Z" fill="#2b4a8b"/>`,
  },
  {
    id: "blazer", label: "Blazer",
    body: () => `${OUTFIT_BASE("#3a3f4b")}
                 <path d="M82 172 L100 222 L118 172Z" fill="#f4f4f2"/>
                 ${SHIRT_COLLAR("#ffffff", "#c9c9c9")}
                 <path d="M80 172 L100 224 L86 240 L62 240 L70 180Z M120 172 L100 224 L114 240 L138 240 L130 180Z" fill="#2c3039"/>
                 <circle cx="100" cy="232" r="2.5" fill="#1a1d23"/>`,
  },
  {
    id: "cardigan", label: "Cardigan",
    body: () => `${OUTFIT_BASE("#c97b8e")}
                 <path d="M82 172 L100 240 L118 172Z" fill="#f6efe6"/>
                 <path d="M82 172 L100 240 L118 172" fill="none" stroke="#a9606f" stroke-width="3"/>
                 <circle cx="88" cy="202" r="2.6" fill="#7d3f4e"/><circle cx="93" cy="222" r="2.6" fill="#7d3f4e"/>`,
  },
  {
    id: "uniform", label: "School uniform",
    body: () => `${OUTFIT_BASE("#26375e")}
                 <path d="M82 172 L100 222 L118 172Z" fill="#f7f7f5"/>
                 ${SHIRT_COLLAR("#ffffff", "#c9c9c9")}
                 <path d="M97 189 L103 189 L107 220 L100 230 L93 220Z" fill="#b8333a"/>
                 <path d="M96 198 L104 194 M95 208 L106 202 M94 218 L107 212" stroke="#e0b84a" stroke-width="2"/>
                 <path d="M80 172 L100 224 L86 240 L62 240 L70 180Z M120 172 L100 224 L114 240 L138 240 L130 180Z" fill="#1c2a4a"/>
                 <path d="M132 198 L148 198 L148 208 Q140 217 132 208Z" fill="#e0b84a"/>`,
  },
  {
    id: "jersey", label: "Sports jersey",
    body: (c) => `${OUTFIT_BASE("#2f9e63")}
                  <path d="M86 170 L100 190 L114 170Z" fill="${c.skin}"/>
                  <path d="M86 170 L100 190 L114 170" fill="none" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
                  <path d="M28 202 L58 184 M32 212 L62 194 M172 202 L142 184 M168 212 L138 194" stroke="#ffffff" stroke-width="4"/>`,
  },
  {
    id: "tank", label: "Tank top",
    body: () => `<path d="M56 240 L60 190 Q66 178 75 176 Q86 198 100 200 Q114 198 125 176 Q134 178 140 190 L144 240Z" fill="#1fa3a3"/>
                 <path d="M75 176 Q86 198 100 200 Q114 198 125 176" fill="none" stroke="#167a7a" stroke-width="3"/>`,
  },
  {
    id: "denim", label: "Denim jacket",
    body: () => `${OUTFIT_BASE("#4a78b5")}
                 <path d="M82 172 L92 240 L108 240 L118 172Z" fill="#f4f4f2"/>
                 <rect x="54" y="200" width="24" height="16" rx="2" fill="none" stroke="#3a6296" stroke-width="2.5"/>
                 <rect x="122" y="200" width="24" height="16" rx="2" fill="none" stroke="#3a6296" stroke-width="2.5"/>
                 <path d="M36 196 L40 240 M164 196 L160 240" stroke="#3a6296" stroke-width="2.5"/>
                 <circle cx="88" cy="210" r="2.5" fill="#c58b3a"/><circle cx="90" cy="228" r="2.5" fill="#c58b3a"/>`,
    collar: () => `<path d="M76 172 L90 168 L95 192 L83 197Z M124 172 L110 168 L105 192 L117 197Z" fill="#3a6296"/>`,
  },
  {
    id: "labCoat", label: "Lab coat",
    body: () => `${OUTFIT_BASE("#f3f5f6")}
                 <path d="M82 172 L100 212 L118 172Z" fill="#9cc3e6"/>
                 <path d="M80 172 L100 212 L92 240 L70 240 L72 182Z M120 172 L100 212 L108 240 L130 240 L128 182Z" fill="#e3e8ea" stroke="#c4ccd0" stroke-width="1.5"/>
                 <rect x="124" y="206" width="22" height="18" rx="2" fill="none" stroke="#c4ccd0" stroke-width="2"/>
                 <path d="M130 198 L130 212" stroke="#2b5fb8" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "turtleneck", label: "Turtleneck", highCollar: true,
    body: () => OUTFIT_BASE("#2b2b33"),
    collar: (c) => `<rect x="${100 - c.nw / 2 - 4}" y="148" width="${c.nw + 8}" height="34" rx="9" fill="#2b2b33"/>
                    <path d="M${100 - c.nw / 2 - 2} 158 L${100 + c.nw / 2 + 2} 158 M${100 - c.nw / 2 - 2} 167 L${100 + c.nw / 2 + 2} 167" stroke="#1d1d23" stroke-width="2"/>`,
  },
  {
    id: "polo", label: "Polo shirt",
    body: () => `${OUTFIT_BASE("#7fb6e6")}
                 <path d="M95 174 L105 174 L105 204 L95 204Z" fill="#6aa2d4"/>
                 <circle cx="100" cy="186" r="2" fill="#ffffff"/><circle cx="100" cy="196" r="2" fill="#ffffff"/>
                 ${SLEEVE_SEAMS("#5f98c8")}`,
    collar: () => `<path d="M80 170 L99 177 L95 191 L76 181Z M120 170 L101 177 L105 191 L124 181Z" fill="#a3cbef" stroke="#5f98c8" stroke-width="1.5" stroke-linejoin="round"/>`,
  },
  {
    id: "flannel", label: "Flannel shirt",
    body: () => `${OUTFIT_BASE("#b23a3a")}
                 <g fill="#2a1414" fill-opacity="0.35">
                   <rect x="12" y="140" width="10" height="100"/><rect x="44" y="140" width="10" height="100"/>
                   <rect x="76" y="140" width="10" height="100"/><rect x="114" y="140" width="10" height="100"/>
                   <rect x="146" y="140" width="10" height="100"/><rect x="178" y="140" width="10" height="100"/>
                   <rect x="0" y="186" width="200" height="10"/><rect x="0" y="218" width="200" height="10"/>
                 </g>
                 ${SHIRT_COLLAR("#b23a3a", "#6e2020")}
                 <path d="M100 186 L100 240" stroke="#6e2020" stroke-width="2"/>
                 <circle cx="100" cy="204" r="2" fill="#f0e2c8"/><circle cx="100" cy="222" r="2" fill="#f0e2c8"/>`,
  },
  {
    id: "dungarees", label: "Dungarees",
    body: (c) => `${OUTFIT_BASE("#f2c94c")}${CREW_NECK(c, "#d4a92c")}
                  <path d="M70 200 L130 200 L130 240 L70 240Z" fill="#3d6fb0"/>
                  <path d="M74 202 L64 178 M126 202 L136 178" stroke="#3d6fb0" stroke-width="9"/>
                  <rect x="88" y="212" width="24" height="14" rx="2" fill="none" stroke="#2c5590" stroke-width="2"/>
                  <circle cx="75" cy="205" r="3" fill="#e0b84a"/><circle cx="125" cy="205" r="3" fill="#e0b84a"/>`,
  },
  {
    id: "puffer", label: "Puffer jacket", highCollar: true,
    body: () => `${OUTFIT_BASE("#f08a24")}
                 <path d="M0 196 Q100 206 200 196 M0 216 Q100 226 200 216 M0 236 Q100 246 200 236" fill="none" stroke="#c96d14" stroke-width="2.5"/>
                 <path d="M100 176 L100 240" stroke="#8a4a0c" stroke-width="2.5"/>`,
    collar: (c) => `<rect x="${100 - c.nw / 2 - 7}" y="152" width="${c.nw + 14}" height="34" rx="10" fill="#f08a24" stroke="#c96d14" stroke-width="2"/>
                    <path d="M100 152 L100 186" stroke="#8a4a0c" stroke-width="2.5"/>`,
  },
  {
    id: "apron", label: "Apron",
    body: (c) => `${OUTFIT_BASE("#8e979f")}${CREW_NECK(c, "#737c84")}
                  <path d="M66 240 L68 198 Q100 193 132 198 L134 240Z" fill="#f3ead6" stroke="#d6c8a6" stroke-width="2"/>
                  <path d="M72 199 L${100 - c.nw / 2 + 3} 172 M128 199 L${100 + c.nw / 2 - 3} 172" stroke="#f3ead6" stroke-width="5"/>
                  <rect x="86" y="214" width="28" height="16" rx="3" fill="none" stroke="#d6c8a6" stroke-width="2"/>`,
  },
  {
    id: "varsity", label: "Varsity jacket",
    body: () => `${OUTFIT_BASE("#7b1e3a")}
                 <path d="M0 240 L0 176 Q32 174 54 188 L56 240Z M200 240 L200 176 Q168 174 146 188 L144 240Z" fill="#efe3c8"/>
                 <circle cx="100" cy="202" r="2.6" fill="#efe3c8"/><circle cx="100" cy="218" r="2.6" fill="#efe3c8"/><circle cx="100" cy="234" r="2.6" fill="#efe3c8"/>`,
    collar: () => `<path d="M78 168 Q100 184 122 168 L122 177 Q100 193 78 177Z" fill="#7b1e3a"/>
                   <path d="M78 172 Q100 188 122 172" fill="none" stroke="#efe3c8" stroke-width="2"/>`,
  },
  {
    id: "dress", label: "Dress with collar",
    body: () => `${OUTFIT_BASE("#7a4fc2")}
                 <path d="M100 178 Q88 198 74 190 Q68 180 82 172Z M100 178 Q112 198 126 190 Q132 180 118 172Z" fill="#ffffff" stroke="#d8d0ea" stroke-width="1.5"/>
                 <circle cx="100" cy="204" r="2.4" fill="#5c3796"/><circle cx="100" cy="220" r="2.4" fill="#5c3796"/>`,
  },
  {
    id: "stripes", label: "Striped sweatshirt",
    body: () => `${OUTFIT_BASE("#f4f1ea")}
                 <g fill="#2c3e66"><rect x="0" y="184" width="200" height="8"/><rect x="0" y="200" width="200" height="8"/>
                 <rect x="0" y="216" width="200" height="8"/><rect x="0" y="232" width="200" height="8"/></g>
                 <path d="M82 171 Q100 186 118 171" fill="none" stroke="#2c3e66" stroke-width="4"/>`,
  },
];

// ---------- accessories ----------
// Eyewear is drawn around the eyes (geo), with arms to the sides of the head (halfW).

function glassesArms(geo, halfW, color, width) {
  const lx = geo.eyeL - 16;
  const rx = geo.eyeR + 16;
  return `<path d="M${lx} 99 L${100 - halfW + 1} 96 M${rx} 99 L${100 + halfW - 1} 96" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
}

function bridge(geo, color, width, lensHalf) {
  return `<path d="M${geo.eyeL + lensHalf} 100 Q100 95 ${geo.eyeR - lensHalf} 100" fill="none" stroke="${color}" stroke-width="${width}"/>`;
}

function catEyeLens(cx, side) {
  // side -1: left lens (its outer corner points left), 1: right lens.
  const o = (dx) => cx + dx * side;
  return `M${o(-17)} 92 Q${o(-21)} 84 ${o(-8)} 89 L${o(15)} 91 Q${o(17)} 108 ${o(2)} 113 Q${o(-15)} 114 ${o(-17)} 92Z`;
}

const EYEWEAR = [
  { id: "none", label: "No eyewear", draw: () => "" },
  {
    id: "roundGlasses", label: "Round glasses",
    draw: (geo, halfW) => `<g fill="#ffffff" fill-opacity="0.15" stroke="#3b3b3b" stroke-width="3">
                             <circle cx="${geo.eyeL}" cy="102" r="15"/><circle cx="${geo.eyeR}" cy="102" r="15"/></g>
                           ${bridge(geo, "#3b3b3b", 3, 15)}${glassesArms(geo, halfW, "#3b3b3b", 3)}`,
  },
  {
    id: "rectGlasses", label: "Rectangle glasses",
    draw: (geo, halfW) => `<g fill="#ffffff" fill-opacity="0.15" stroke="#24364f" stroke-width="3">
                             <rect x="${geo.eyeL - 17}" y="91" width="34" height="23" rx="4"/>
                             <rect x="${geo.eyeR - 17}" y="91" width="34" height="23" rx="4"/></g>
                           ${bridge(geo, "#24364f", 3, 17)}${glassesArms(geo, halfW, "#24364f", 3)}`,
  },
  {
    id: "catEye", label: "Cat-eye glasses",
    draw: (geo, halfW) => `<g fill="#ffffff" fill-opacity="0.15" stroke="#7a2340" stroke-width="3" stroke-linejoin="round">
                             <path d="${catEyeLens(geo.eyeL, -1)}"/><path d="${catEyeLens(geo.eyeR, 1)}"/></g>
                           ${bridge(geo, "#7a2340", 3, 15)}${glassesArms(geo, halfW, "#7a2340", 3)}`,
  },
  {
    id: "aviators", label: "Aviator sunglasses",
    draw: (geo, halfW) => `<g fill="#3b4a5a" fill-opacity="0.6" stroke="#c9a227" stroke-width="2">
                             <path d="M${geo.eyeL - 16} 91 L${geo.eyeL + 16} 91 Q${geo.eyeL + 17} 116 ${geo.eyeL + 2} 116 Q${geo.eyeL - 15} 116 ${geo.eyeL - 16} 91Z"/>
                             <path d="M${geo.eyeR - 16} 91 L${geo.eyeR + 16} 91 Q${geo.eyeR + 15} 116 ${geo.eyeR - 2} 116 Q${geo.eyeR - 17} 116 ${geo.eyeR - 16} 91Z"/></g>
                           <path d="M${geo.eyeL + 16} 92 L${geo.eyeR - 16} 92" stroke="#c9a227" stroke-width="2"/>
                           ${bridge(geo, "#c9a227", 2, 16)}${glassesArms(geo, halfW, "#c9a227", 2)}`,
  },
  {
    id: "wayfarers", label: "Square sunglasses",
    draw: (geo, halfW) => `<g fill="#1d1d1d" fill-opacity="0.6" stroke="#111111" stroke-width="4" stroke-linejoin="round">
                             <path d="M${geo.eyeL - 18} 90 L${geo.eyeL + 17} 90 L${geo.eyeL + 14} 113 L${geo.eyeL - 15} 113Z"/>
                             <path d="M${geo.eyeR - 17} 90 L${geo.eyeR + 18} 90 L${geo.eyeR + 15} 113 L${geo.eyeR - 14} 113Z"/></g>
                           ${bridge(geo, "#111111", 4, 17)}${glassesArms(geo, halfW, "#111111", 4)}`,
  },
  {
    id: "roundShades", label: "Round sunglasses",
    draw: (geo, halfW) => `<g fill="#5a3c7a" fill-opacity="0.55" stroke="#c9a227" stroke-width="2">
                             <circle cx="${geo.eyeL}" cy="102" r="14"/><circle cx="${geo.eyeR}" cy="102" r="14"/></g>
                           ${bridge(geo, "#c9a227", 2, 14)}${glassesArms(geo, halfW, "#c9a227", 2)}`,
  },
];

// ear: earGeometry(); earrings hang from both earlobes.
const EARRINGS = [
  { id: "none", label: "No earrings", draw: () => "" },
  {
    id: "studs", label: "Studs",
    draw: (ear) => [-1, 1].map((s) => `<circle cx="${100 + s * ear.lobeDx}" cy="${ear.lobeY}" r="3.2" fill="#e6c35c" stroke="#a8841f" stroke-width="1"/>`).join(""),
  },
  {
    id: "hoops", label: "Hoops",
    draw: (ear) => [-1, 1].map((s) => `<circle cx="${100 + s * ear.lobeDx}" cy="${ear.lobeY + 7}" r="7.5" fill="none" stroke="#d4af37" stroke-width="2.5"/>`).join(""),
  },
  {
    id: "drops", label: "Drop earrings",
    draw: (ear) => [-1, 1].map((s) => {
      const x = 100 + s * ear.lobeDx;
      return `<path d="M${x} ${ear.lobeY} L${x} ${ear.lobeY + 8}" stroke="#d4af37" stroke-width="1.8"/>
              <path d="M${x} ${ear.lobeY + 7} Q${x - 5} ${ear.lobeY + 16} ${x} ${ear.lobeY + 19} Q${x + 5} ${ear.lobeY + 16} ${x} ${ear.lobeY + 7}Z" fill="#4fb3c9" stroke="#2f8ca0" stroke-width="1"/>
              <circle cx="${x}" cy="${ear.lobeY}" r="2.4" fill="#d4af37"/>`;
    }).join(""),
  },
];

// nw: neck width. The chain starts at the sides of the neck and hangs onto the chest.
function pearlString(nw) {
  const l = 100 - nw / 2 + 2;
  const r = 100 + nw / 2 - 2;
  let pearls = "";
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = (1 - t) ** 2 * l + 2 * (1 - t) * t * 100 + t ** 2 * r;
    const y = (1 - t) ** 2 * 168 + 2 * (1 - t) * t * 210 + t ** 2 * 168;
    pearls += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4"/>`;
  }
  return `<g fill="#f8f5ee" stroke="#cfc6b4" stroke-width="1">${pearls}</g>`;
}

const chainPath = (nw) => `M${100 - nw / 2 + 2} 168 Q100 212 ${100 + nw / 2 - 2} 168`;

const NECKLACES = [
  { id: "none", label: "No necklace", draw: () => "" },
  { id: "chain", label: "Thin chain", draw: (nw) => `<path d="${chainPath(nw)}" fill="none" stroke="#d4af37" stroke-width="1.8"/>` },
  {
    id: "pendant", label: "Pendant",
    draw: (nw) => `<path d="${chainPath(nw)}" fill="none" stroke="#d4af37" stroke-width="1.6"/>
                   <circle cx="100" cy="194" r="5.5" fill="#d4af37"/><circle cx="100" cy="194" r="2.8" fill="#c0392b"/>`,
  },
  { id: "pearls", label: "Pearls", draw: (nw) => pearlString(nw) },
];

// Beard and stubble cover the lower face inside the head's outline (#headClip in avatar-art.js),
// with a cut-out line over the cheeks. The eyes and mouth are drawn on top of them.
const BEARD_AREA = "M30 100 L58 100 Q62 124 82 128 Q100 121 118 128 Q138 124 142 100 L170 100 L170 200 L30 200Z";

const FACIAL_HAIR = [
  { id: "none", label: "No facial hair", draw: () => "" },
  {
    id: "stubble", label: "Stubble",
    draw: (color) => `<g clip-path="url(#headClip)"><path d="${BEARD_AREA}" fill="${color}" fill-opacity="0.3"/></g>`,
  },
  {
    id: "moustache", label: "Moustache",
    draw: (color) => `<path d="M79 131 Q88 120 100 125 Q112 120 121 131 Q110 127 100 130 Q90 127 79 131Z" fill="${color}"/>`,
  },
  {
    id: "beard", label: "Full beard",
    draw: (color, head) => `<g clip-path="url(#headClip)"><path d="${BEARD_AREA}" fill="${color}"/></g>
                            <path d="M70 ${head.chin - 10} Q100 ${head.chin + 20} 130 ${head.chin - 10}Z" fill="${color}"/>`,
  },
];

// ---------- looks ----------

// The editor's sections in order, and the options of each look field.
const LOOK_OPTIONS = {
  gender: GENDERS,
  skin: SKIN_TONES,
  hairColor: HAIR_COLORS,
  hairStyle: HAIRSTYLES,
  face: FACES,
  outfit: OUTFITS,
  eyewear: EYEWEAR,
  earrings: EARRINGS,
  necklace: NECKLACES,
  facialHair: FACIAL_HAIR,
};
const LOOK_FIELDS = Object.keys(LOOK_OPTIONS);

// Gender only sets the starting look (and the shoulders); every option works with both.
const DEFAULT_LOOKS = {
  female: {
    gender: "female", skin: "tone4", hairColor: "brown", hairStyle: "shoulder", face: "f05", outfit: "cardigan",
    eyewear: "none", earrings: "studs", necklace: "none", facialHair: "none",
  },
  male: {
    gender: "male", skin: "tone4", hairColor: "darkBrown", hairStyle: "sidePart", face: "f04", outfit: "hoodie",
    eyewear: "none", earrings: "none", necklace: "none", facialHair: "none",
  },
};
// The look of a character that no longer exists (a deleted one, in old sessions).
const DEFAULT_GENDER = "female";

function optionById(field, id) {
  return LOOK_OPTIONS[field].find((option) => option.id === id) || null;
}

// A complete look with only known values: anything unknown or missing gets the default of the
// look's gender (or of DEFAULT_GENDER). Never throws.
function cleanLook(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const gender = optionById("gender", source.gender) ? source.gender : DEFAULT_GENDER;
  const look = {};
  for (const field of LOOK_FIELDS) {
    look[field] = optionById(field, source[field]) ? source[field] : DEFAULT_LOOKS[gender][field];
  }
  return look;
}

function defaultLook(gender = DEFAULT_GENDER) {
  return { ...DEFAULT_LOOKS[gender] };
}

const randomItem = (list) => list[Math.floor(Math.random() * list.length)];
const randomChance = (p) => Math.random() < p;

// Randomize: a new look for the same gender. Combinations that look bad together are avoided
// (the editor still allows them): sunglasses with a full beard, earrings with hair that covers
// the ears, a necklace on a high collar, and facial hair on the Female body.
function randomLook(gender) {
  const hairStyle = randomItem(HAIRSTYLES);
  const outfit = randomItem(OUTFITS);
  const male = gender === "male";
  const facialHair = male && randomChance(0.35) ? randomItem(FACIAL_HAIR.slice(1)).id : "none";
  let eyewear = randomChance(0.4) ? randomItem(EYEWEAR.slice(1)).id : "none";
  if (facialHair === "beard" && ["aviators", "wayfarers", "roundShades"].includes(eyewear)) {
    eyewear = randomItem(EYEWEAR.slice(1, 4)).id;
  }
  const earrings = !hairStyle.coversEars && randomChance(male ? 0.15 : 0.5) ? randomItem(EARRINGS.slice(1)).id : "none";
  const necklace = !outfit.highCollar && randomChance(male ? 0.15 : 0.35) ? randomItem(NECKLACES.slice(1)).id : "none";
  return {
    gender,
    skin: randomItem(SKIN_TONES).id,
    // The bold colour only now and then.
    hairColor: randomChance(0.08) ? "blue" : randomItem(HAIR_COLORS.slice(0, -1)).id,
    hairStyle: hairStyle.id,
    face: randomItem(FACES).id,
    outfit: outfit.id,
    eyewear,
    earrings,
    necklace,
    facialHair,
  };
}
