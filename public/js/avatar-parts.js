// The parts a custom character's look is built from (the editor's options), and how each one is
// drawn as SVG. Costumes (headwear, masks, costume outfits, held items…) are in avatar-costumes.js,
// which adds its fields to LOOK_FIELDS, SHARED_OPTIONS and DEFAULT_LOOKS. avatar-art.js puts them together in layers; see "Avatar art guide" in the README.
//
// Female and male looks are fully separate: every shape list (faces, hairstyles, outfits, eyewear,
// earrings, necklaces, facial hair) exists per gender, with ids that start with "w-" or "m-". Only
// skin tone, hair colour and the funny faces ("fun-…") are shared.
//
// Every part is drawn on the same 200 × 240 canvas as the built-in placeholders, with the same
// anchor points: eye line y = 102 (eye centres x = 78 / 122, moved a little by the face), mouth
// around y = 136, temple line y = 105, shoulder line y ≈ 172.
//
// Heads are built from a few numbers (buildHead). Their upper half, from the crown to the temples,
// is always half an ellipse centred at (100, 105). Hair is drawn once, for the reference head
// (crown y = 45, temples x = 46 / 154), and moved and scaled onto each head's ellipse
// (hairTransform in avatar-art.js), so the hairline and sides follow every head exactly.

// ---------- real images ----------

// Layers that have a real image in public/assets/avatar/<category>/<id>.png, e.g.
// "hair-front/w-sleek-bob". A listed file replaces that part's SVG drawing everywhere; anything not
// listed stays SVG. Add one line here per new file (and the file to PRECACHE in sw.js, so it works
// offline). Files are listed instead of looked up, so the app never asks the server for hundreds
// of files that don't exist. Categories: body, neck, outfit, necklace, ears, head, nose, marks,
// facial-hair, hair-back, hair-front, earrings, eyewear-arms, eyewear.
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

// ---------- shared options ----------

const GENDERS = [
  { id: "female", label: "Female", body: "M24 240 Q28 182 100 175 Q172 182 176 240Z", neckWidth: 28 },
  { id: "male", label: "Male", body: "M8 240 Q12 174 100 170 Q188 174 192 240Z", neckWidth: 34 },
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
  // Fantasy colours (costumes), under their own "Fantasy" heading in the editor.
  { id: "fantasy-green", label: "Fantasy skin 1: green", color: "#86c06c", fantasy: true },
  { id: "fantasy-blue", label: "Fantasy skin 2: blue", color: "#7ea6dc", fantasy: true },
  { id: "fantasy-purple", label: "Fantasy skin 3: purple", color: "#a88ad6", fantasy: true },
  { id: "fantasy-grey", label: "Fantasy skin 4: grey", color: "#a9adb3", fantasy: true },
  { id: "fantasy-red", label: "Fantasy skin 5: red", color: "#d8746a", fantasy: true },
  { id: "fantasy-gold", label: "Fantasy skin 6: gold", color: "#ddb653", fantasy: true },
];
const NATURAL_SKIN_TONES = SKIN_TONES.filter((tone) => !tone.fantasy);
const FANTASY_SKIN_TONES = SKIN_TONES.filter((tone) => tone.fantasy);

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

const HEAD_CY = 105; // the temple line: the head's widest point above the cheeks
const HAIR_REF = { top: 45, halfW: 54 }; // the head hair is drawn for

const fmt = (n) => Math.round(n * 10) / 10;

function ellipsePath(cx, cy, rx, ry) {
  return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
}

// A head outline from a few numbers (all half-widths, measured from x = 100):
//   top: crown y. halfW: width at the temples (y = HEAD_CY).
//   cheekW / cheekY: cheekbones. jawW / jawY: jaw corner. chinW / chinY: the chin's corners,
//   chinDrop: how far the chin's middle hangs below them. sharp (0–1): how angular the jaw is.
// Above the temples it's half an ellipse (where the hair sits); the face's character is all below.
// A head with ellipse: true is an exact ellipse instead: centred at (100, cy), halfW wide each side,
// from the crown (top) to the chin (cy + (cy - top)). Its top half is the same kind of oval, so
// hair is anchored to it the same way (hairTransform uses cy). chinW: how wide a beard's chin part is.
function buildHead(p) {
  if (p.ellipse) return { ...p, path: ellipsePath(100, p.cy, p.halfW, p.cy - p.top), chin: p.cy + (p.cy - p.top) };
  const right = [
    [p.halfW, HEAD_CY],
    [p.cheekW, p.cheekY],
    [p.jawW, p.jawY],
    [p.chinW, p.chinY],
    [0, p.chinY + p.chinDrop],
  ];
  // Tangents: vertical at the temples (joins the ellipse smoothly), horizontal at the chin's middle,
  // Catmull-Rom in between, shortened at the jaw corner when the jaw is angular.
  const tangents = right.map((pt, i) => {
    if (i === 0) return [0, (right[1][1] - pt[1]) * 0.9];
    if (i === right.length - 1) return [-(right[i - 1][0] - pt[0]) * 0.9, 0];
    const k = i === 2 ? 1 - p.sharp : i === 3 ? 1 - p.sharp * 0.5 : 1;
    return [((right[i + 1][0] - right[i - 1][0]) / 2) * k, ((right[i + 1][1] - right[i - 1][1]) / 2) * k];
  });
  const segment = (a, b, mirror) => {
    const [p0, t0] = [right[a], tangents[a]];
    const [p1, t1] = [right[b], tangents[b]];
    const sx = (x) => fmt(100 + mirror * x);
    if (mirror > 0) {
      return `C${sx(p0[0] + t0[0] / 3)} ${fmt(p0[1] + t0[1] / 3)} ${sx(p1[0] - t1[0] / 3)} ${fmt(p1[1] - t1[1] / 3)} ${sx(p1[0])} ${fmt(p1[1])}`;
    }
    // Left side, walked upwards: the same curve backwards, mirrored.
    return `C${sx(p1[0] - t1[0] / 3)} ${fmt(p1[1] - t1[1] / 3)} ${sx(p0[0] + t0[0] / 3)} ${fmt(p0[1] + t0[1] / 3)} ${sx(p0[0])} ${fmt(p0[1])}`;
  };
  let d = `M${fmt(100 - p.halfW)} ${HEAD_CY} A${p.halfW} ${HEAD_CY - p.top} 0 0 1 ${fmt(100 + p.halfW)} ${HEAD_CY}`;
  for (let i = 0; i < right.length - 1; i++) d += segment(i, i + 1, 1);
  for (let i = right.length - 2; i >= 0; i--) d += segment(i, i + 1, -1);
  return { ...p, path: d + "Z", chin: p.chinY + p.chinDrop };
}

const HEAD_SHAPES = {
  // Female: smaller, softer jaws and rounded chins.
  "w-soft-oval": { label: "soft oval", top: 44, halfW: 52, cheekW: 51, cheekY: 122, jawW: 37, jawY: 152, chinW: 13, chinY: 165, chinDrop: 3, sharp: 0 },
  "w-soft-round": { label: "soft round", top: 47, halfW: 55, cheekW: 55, cheekY: 120, jawW: 44, jawY: 150, chinW: 15, chinY: 163, chinDrop: 3, sharp: 0 },
  "w-heart": { label: "heart-shaped", top: 45, halfW: 56, cheekW: 52, cheekY: 118, jawW: 34, jawY: 150, chinW: 9, chinY: 165, chinDrop: 3, sharp: 0 },
  "w-diamond": { label: "high cheekbones", top: 46, halfW: 51, cheekW: 55, cheekY: 116, jawW: 36, jawY: 150, chinW: 10, chinY: 165, chinDrop: 3, sharp: 0 },
  "w-soft-long": { label: "long", top: 40, halfW: 50, cheekW: 50, cheekY: 124, jawW: 38, jawY: 156, chinW: 13, chinY: 169, chinDrop: 3, sharp: 0 },
  "w-soft-square": { label: "soft square", top: 47, halfW: 54, cheekW: 54, cheekY: 122, jawW: 46, jawY: 150, chinW: 18, chinY: 163, chinDrop: 2, sharp: 0.3 },
  // The first version's "long" head, exactly (an ellipse 50 wide and 66 tall, centred at y = 104).
  "w-model": { label: "long oval, model-like", ellipse: true, cy: 104, top: 38, halfW: 50, chinW: 14 },
  "w-petite": { label: "petite", top: 48, halfW: 50, cheekW: 50, cheekY: 118, jawW: 36, jawY: 148, chinW: 11, chinY: 162, chinDrop: 3, sharp: 0 },
  // Male: mostly oval and round, close to the built-in characters' simple oval head (an ellipse 54
  // wide and 60 tall): the jaw clearly narrower than the temples, a small rounded chin. Only square
  // and rectangle have a strong jaw, and even those keep rounded corners.
  // The first version's "long" head, exactly (same outline as w-model).
  "m-model": { label: "long oval, model-like", ellipse: true, cy: 104, top: 38, halfW: 50, chinW: 14 },
  "m-oval": { label: "oval", top: 45, halfW: 53, cheekW: 52, cheekY: 122, jawW: 40, jawY: 150, chinW: 13, chinY: 162, chinDrop: 4, sharp: 0.1 },
  "m-long-oval": { label: "long oval", top: 40, halfW: 51, cheekW: 50, cheekY: 124, jawW: 38, jawY: 155, chinW: 13, chinY: 167, chinDrop: 4, sharp: 0.1 },
  "m-round": { label: "round", top: 47, halfW: 56, cheekW: 56, cheekY: 120, jawW: 44, jawY: 148, chinW: 15, chinY: 160, chinDrop: 5, sharp: 0 },
  "m-egg": { label: "egg-shaped", top: 44, halfW: 56, cheekW: 53, cheekY: 120, jawW: 37, jawY: 150, chinW: 11, chinY: 163, chinDrop: 4, sharp: 0 },
  "m-diamond": { label: "high cheekbones", top: 46, halfW: 51, cheekW: 55, cheekY: 116, jawW: 40, jawY: 150, chinW: 12, chinY: 164, chinDrop: 3, sharp: 0.15 },
  "m-wide": { label: "wide", top: 51, halfW: 59, cheekW: 59, cheekY: 120, jawW: 44, jawY: 149, chinW: 16, chinY: 160, chinDrop: 4, sharp: 0 },
  "m-square": { label: "square jaw", top: 47, halfW: 55, cheekW: 55, cheekY: 120, jawW: 48, jawY: 150, chinW: 20, chinY: 164, chinDrop: 2, sharp: 0.35 },
  "m-rectangle": { label: "long, strong jaw", top: 41, halfW: 52, cheekW: 52, cheekY: 124, jawW: 45, jawY: 155, chinW: 18, chinY: 168, chinDrop: 2, sharp: 0.35 },
  // Funny. The first three are the blocky shapes some funny faces were made with (kept as they were).
  "fun-round": { label: "round", top: 47, halfW: 56, cheekW: 57, cheekY: 120, jawW: 48, jawY: 150, chinW: 20, chinY: 163, chinDrop: 3, sharp: 0 },
  "fun-square": { label: "square", top: 47, halfW: 55, cheekW: 55, cheekY: 120, jawW: 52, jawY: 151, chinW: 24, chinY: 165, chinDrop: 1, sharp: 0.7 },
  "fun-oval": { label: "oval", top: 44, halfW: 53, cheekW: 53, cheekY: 122, jawW: 42, jawY: 152, chinW: 17, chinY: 165, chinDrop: 2, sharp: 0.2 },
  "fun-huge-chin": { label: "huge chin", top: 47, halfW: 52, cheekW: 50, cheekY: 122, jawW: 42, jawY: 160, chinW: 34, chinY: 186, chinDrop: 6, sharp: 0.3 },
  "fun-tiny": { label: "tiny head", top: 60, halfW: 45, cheekW: 45, cheekY: 118, jawW: 37, jawY: 146, chinW: 14, chinY: 160, chinDrop: 3, sharp: 0 },
  "fun-very-long": { label: "very long", top: 26, halfW: 50, cheekW: 49, cheekY: 128, jawW: 40, jawY: 172, chinW: 16, chinY: 194, chinDrop: 3, sharp: 0 },
  "fun-giant-cheeks": { label: "giant cheeks", top: 50, halfW: 52, cheekW: 68, cheekY: 132, jawW: 56, jawY: 154, chinW: 18, chinY: 165, chinDrop: 3, sharp: 0 },
  "fun-extra-wide": { label: "extra wide", top: 54, halfW: 66, cheekW: 66, cheekY: 120, jawW: 58, jawY: 150, chinW: 24, chinY: 162, chinDrop: 2, sharp: 0.3 },
};
for (const id of Object.keys(HEAD_SHAPES)) HEAD_SHAPES[id] = buildHead(HEAD_SHAPES[id]);

const EAR_SIZES = { small: { rx: 7, ry: 10 }, medium: { rx: 9, ry: 13 }, large: { rx: 12, ry: 16 }, giant: { rx: 21, ry: 27 } };
const EAR_Y = 106;

// Ear centres and earlobes for a head and ear size.
function earGeometry(head, ears) {
  const { rx, ry } = EAR_SIZES[ears];
  const dx = head.halfW - 1;
  return { rx, ry, dx, lobeY: EAR_Y + ry - 3, lobeDx: dx + rx * 0.35 };
}

// ---------- noses and marks ----------

// Noses sit between the eyes and the mouth (y 96–128), drawn in a darker shade of the skin.
function noseLine(shade, width = 2.5) {
  return `fill="none" stroke="${shade}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
}

const NOSES = {
  button: { label: "button nose", draw: (shade) => `<ellipse cx="100" cy="116" rx="6" ry="4.5" fill="${shade}" fill-opacity="0.6"/>` },
  straight: { label: "straight nose", draw: (shade) => `<path d="M100 103 L103.5 117 Q101 121 96 119.5" ${noseLine(shade)}/>` },
  wide: {
    label: "wide nose",
    draw: (shade) => `<path d="M90 117 Q94 122 100 120 Q106 122 110 117" ${noseLine(shade)}/>
                      <path d="M94 111 Q90 115 92 118 M106 111 Q110 115 108 118" ${noseLine(shade)}/>`,
  },
  long: { label: "long nose", draw: (shade) => `<path d="M100 97 L105 118 Q102 123 95 121" ${noseLine(shade)}/>` },
  curved: { label: "small curved nose", draw: (shade) => `<path d="M100 108 Q107 115 101 119 Q99 120 96.5 118.5" ${noseLine(shade)}/>` },
  petite: { label: "petite nose", draw: (shade) => `<path d="M101.5 111 Q105 116.5 101 119 Q99.5 119.8 97.5 118.8" ${noseLine(shade, 2.2)}/>` },
  smallStraight: { label: "small straight nose", draw: (shade) => `<path d="M100.5 106 L102.8 116.5 Q101.5 119.8 97.5 118.8" ${noseLine(shade, 2.2)}/>` },
  softTip: {
    label: "soft nose",
    draw: (shade) => `<ellipse cx="100" cy="116.5" rx="4" ry="2.8" fill="${shade}" fill-opacity="0.3"/>
                      <path d="M96.5 118.5 Q100 121.5 103.5 118.5" ${noseLine(shade, 2.2)}/>`,
  },
  defined: {
    label: "defined nose",
    draw: (shade) => `<path d="M99.5 99 L103 116 Q102 120 97 119.5" ${noseLine(shade, 2.4)}/>
                      <path d="M104.5 117.6 Q106.6 117.4 106.6 115.4" ${noseLine(shade, 2)}/>`,
  },
  potato: {
    label: "potato nose",
    draw: (shade, skin) => `<path d="M93 106 Q84 112 86 121 Q89 129 100 128 Q111 129 114 121 Q116 112 107 106 Q100 102 93 106Z" fill="${mixColor(skin, shade, 0.35)}" stroke="${shade}" stroke-width="2.2"/>
                            <ellipse cx="94.5" cy="122" rx="2.6" ry="1.8" fill="${shade}"/><ellipse cx="105.5" cy="122" rx="2.6" ry="1.8" fill="${shade}"/>`,
  },
  pointy: {
    label: "long pointy nose",
    draw: (shade, skin) => `<path d="M99 103 L136 119 Q137 122 133 123 L101 121 Q97 120 97.5 117Z" fill="${skin}" stroke="${shade}" stroke-width="2.2" stroke-linejoin="round"/>`,
  },
};

// Marks on the skin. geo: the face's eye positions (faceGeometry).
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

// ---------- faces ----------

const EYE_SPACINGS = { close: 3, normal: 0, wide: -3 }; // how far each eye moves towards the nose
const EYE_SIZES = { small: 0.88, medium: 1, mediumPlus: 1.08, large: 1.14, huge: 1.35 }; // scale of every eye drawing
const BROW_WIDTHS = { thin: 3.5, medium: 5, thick: 7 }; // the pose still sets the brow's shape

// [head, ears, nose, eye size, eye spacing, brows, marks, features]. Features (all optional):
// lashes, lip (lip tint), unibrow, buckTeeth, featureScale (eyes, brows, nose and mouth smaller),
// earsOnTop (giant ears stay visible over hair).
const FEMALE_FACES = [
  ["w-soft-round", "small", "button", "medium", "normal", "medium", []],
  ["w-soft-round", "small", "curved", "large", "normal", "thin", ["freckles", "rosy"]],
  ["w-soft-oval", "medium", "straight", "medium", "normal", "medium", []],
  ["w-soft-oval", "small", "curved", "medium", "close", "thin", ["freckles"]],
  ["w-soft-oval", "medium", "button", "large", "wide", "medium", ["smileLines"]],
  ["w-soft-long", "small", "curved", "large", "normal", "thin", ["moleLip"]],
  ["w-soft-square", "small", "button", "medium", "close", "medium", ["rosy"]],
  ["w-heart", "small", "curved", "large", "wide", "thin", []],
  ["w-heart", "medium", "button", "medium", "normal", "medium", ["freckles"]],
  ["w-heart", "medium", "straight", "small", "close", "thin", ["dimples", "rosy"]],
  ["w-heart", "small", "petite", "large", "normal", "thin", [], { lashes: true, lip: true }],
  ["w-model", "small", "smallStraight", "large", "wide", "medium", [], { lashes: true, lip: true }],
  ["w-diamond", "small", "petite", "large", "normal", "thin", [], { lashes: true }],
  ["w-petite", "small", "softTip", "large", "wide", "thin", [], { lashes: true, lip: true }],
  ["w-model", "small", "petite", "mediumPlus", "normal", "medium", [], { lashes: true }],
  ["w-heart", "small", "softTip", "large", "normal", "medium", [], { lashes: true, lip: true }],
  ["w-model", "small", "smallStraight", "large", "wide", "thin", [], { lashes: true, lip: true }],
  ["w-soft-round", "small", "petite", "large", "normal", "thin", [], { lashes: true, lip: true }],
  ["w-soft-long", "small", "smallStraight", "mediumPlus", "normal", "medium", [], { lashes: true }],
  ["w-petite", "small", "petite", "large", "normal", "medium", [], { lip: true }],
  ["w-model", "small", "softTip", "large", "normal", "thick", [], { lashes: true, lip: true }],
  ["w-heart", "small", "petite", "large", "wide", "thin", [], { lashes: true }],
];

// At most 4 faces on the two strong-jaw shapes (square, rectangle); the rest are oval or round.
// 8 of the 12 new faces (and the default, face 11) use the model-like long oval.
const MALE_FACES = [
  ["m-round", "medium", "button", "medium", "normal", "medium", []],
  ["m-round", "large", "wide", "small", "wide", "thick", ["dimples"]],
  ["m-oval", "medium", "straight", "medium", "normal", "medium", []],
  ["m-long-oval", "large", "long", "small", "normal", "thick", ["moleCheek"]],
  ["m-long-oval", "medium", "long", "small", "close", "medium", []],
  ["m-rectangle", "large", "straight", "medium", "normal", "thick", ["smileLines"]],
  ["m-square", "medium", "wide", "medium", "wide", "thick", []],
  ["m-egg", "large", "straight", "small", "normal", "thick", ["dimples"]],
  ["m-wide", "large", "wide", "medium", "wide", "medium", ["rosy"]],
  ["m-wide", "small", "straight", "small", "close", "thin", ["smileLines"]],
  ["m-model", "medium", "defined", "large", "normal", "thick", []],
  ["m-diamond", "medium", "defined", "large", "wide", "medium", []],
  ["m-model", "small", "smallStraight", "large", "normal", "medium", []],
  ["m-model", "medium", "defined", "mediumPlus", "normal", "thick", []],
  ["m-rectangle", "medium", "smallStraight", "large", "normal", "thick", []],
  ["m-round", "small", "softTip", "large", "wide", "medium", []],
  ["m-model", "medium", "smallStraight", "large", "normal", "thick", []],
  ["m-model", "small", "defined", "large", "wide", "medium", []],
  ["m-model", "medium", "defined", "mediumPlus", "normal", "thick", []],
  ["m-square", "medium", "smallStraight", "large", "normal", "medium", []],
  ["m-model", "medium", "softTip", "large", "normal", "thick", []],
  ["m-model", "small", "defined", "large", "wide", "medium", []],
];

// Silly on purpose, never mean. Shared by both genders. name: shown in the label.
const FUNNY_FACES = [
  ["Huge chin", "fun-huge-chin", "medium", "long", "medium", "normal", "medium", []],
  ["Tiny head, giant ears", "fun-tiny", "giant", "button", "small", "close", "thin", [], { earsOnTop: true }],
  ["Very long face", "fun-very-long", "medium", "long", "medium", "normal", "thin", []],
  ["Buck teeth", "fun-round", "medium", "button", "medium", "normal", "medium", [], { buckTeeth: true }],
  ["Unibrow", "fun-square", "medium", "wide", "medium", "normal", "thick", [], { unibrow: true }],
  ["Potato nose", "fun-round", "medium", "potato", "small", "normal", "medium", []],
  ["Long pointy nose", "fun-oval", "medium", "pointy", "medium", "normal", "medium", []],
  ["Giant cheeks", "fun-giant-cheeks", "small", "button", "small", "close", "thin", ["rosy"]],
  ["Wide face, tiny features", "fun-extra-wide", "medium", "petite", "medium", "normal", "thin", [], { featureScale: 0.72 }],
  ["Huge eyes", "fun-oval", "medium", "petite", "huge", "wide", "thin", []],
];

function makeFace(id, label, [head, ears, nose, eyeSize, eyeSpacing, brows, marks, features = {}]) {
  return { id, label, head, ears, nose, eyeSize, eyeSpacing, brows, marks, ...features };
}

// "Face 3: soft oval, straight nose": worked out each time it's read (a getter), from the parts'
// names in the current language (see "translations" at the end of this file).
function faceLabel(n, [head, , nose, , , , marks, features = {}]) {
  const parts = [HEAD_SHAPES[head].label, NOSES[nose].label, ...marks.map((mark) => MARKS[mark].label)];
  if (features.lashes) parts.push(t("avatar.feature.lashes"));
  if (features.lip) parts.push(t("avatar.feature.lip"));
  return t("avatar.faceLabel", { number: n, parts: [...new Set(parts)].join(t("common.listSeparator")) });
}

function faceWithLabel(face, label) {
  Object.defineProperty(face, "label", { get: label, enumerable: true, configurable: true });
  return face;
}

const FACES_BY_GENDER = {
  female: FEMALE_FACES.map((f, i) => faceWithLabel(makeFace(`w-face-${String(i + 1).padStart(2, "0")}`, "", f), () => faceLabel(i + 1, f))),
  male: MALE_FACES.map((f, i) => faceWithLabel(makeFace(`m-face-${String(i + 1).padStart(2, "0")}`, "", f), () => faceLabel(i + 1, f))),
};
// "Funny face 1: huge chin". The name's key: avatar.funny.<id>.
const FUNNY = FUNNY_FACES.map(([name, ...f], i) => {
  const id = `fun-${String(i + 1).padStart(2, "0")}`;
  I18N.source(`avatar.funny.${id}`, name.toLowerCase());
  return faceWithLabel({ ...makeFace(id, "", f), funny: true }, () =>
    t("avatar.funnyFaceLabel", { number: i + 1, name: t(`avatar.funny.${id}`) })
  );
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
// Drawn for the reference head: ellipse centred at (100, 105), 54 wide each side, crown y = 45.
// c: { hair, shade (darker), light (lighter), fade (hair mixed with skin, for faded sides) }.
// back is drawn behind the head and body, front over the head (but under the eyes, brows and
// mouth, so the expression always shows). Long styles also have backFall / frontFall: the hair
// that falls below the temples. It's scaled to the head's width but never stretched in height, so
// it always falls straight to the same length, like in the first version. coversEars: the front covers the ears (studs are then
// hidden, and Randomize leaves earrings out).
// Rules: the front's outer edge lies outside the head outline and its hairline inside it, so no
// skin shows between them; fringes stay above y ≈ 70 between x 62 and 138 (the brows).

// x of an ellipse centred at (100, 105) at height y (half-width).
function ellipseHalf(rx, ry, y) {
  const t = (HEAD_CY - y) / ry;
  return rx * Math.sqrt(Math.max(0, 1 - t * t));
}

// A hair cap: the outer edge is part of an ellipse (rx, ry) from the left side at sideY over the
// top to the right side; inner continues from the right side back to the left (the hairline).
function cap(rx, ry, sideY, inner) {
  const h = fmt(ellipseHalf(rx, ry, sideY));
  // Sides below the temple line: the way over the top is the larger part of the ellipse.
  const large = sideY > HEAD_CY ? 1 : 0;
  return `M${fmt(100 - h)} ${sideY} A${rx} ${ry} 0 ${large} 1 ${fmt(100 + h)} ${sideY} ${inner} Z`;
}

// Curls: circles with a darker rim.
const curls = (list, c) => `<g fill="${c.hair}" stroke="${c.shade}" stroke-width="1.6">${list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>`;

// Curls along an ellipse centred at (100, 105) from angle a0 to a1 (degrees, 0 = right, -90 = top).
function curlRing(rx, ry, a0, a1, step, r) {
  const list = [];
  for (let a = a0; a <= a1 + 0.01; a += step) {
    const rad = (a * Math.PI) / 180;
    list.push([fmt(100 + rx * Math.cos(rad)), fmt(HEAD_CY + ry * Math.sin(rad)), r]);
  }
  return list;
}

function braid(x, y0, y1) {
  let links = "";
  for (let y = y0; y <= y1; y += 17) links += `<ellipse cx="${x}" cy="${y}" rx="9" ry="10.5"/>`;
  return links;
}

// Side curtains over the ears, from y0 down to y1 (left and right).
const curtains = (y0, y1, c, flare = 0) =>
  `<path d="M45 ${y0} Q${37 - flare} ${(y0 + y1) / 2} ${40 - flare} ${y1} Q50 ${y1 + 6} 60 ${y1 - 4} Q55 ${(y0 + y1) / 2} 59 ${y0 + 4}Z
            M155 ${y0} Q${163 + flare} ${(y0 + y1) / 2} ${160 + flare} ${y1} Q150 ${y1 + 6} 140 ${y1 - 4} Q145 ${(y0 + y1) / 2} 141 ${y0 + 4}Z" fill="${c.hair}"/>`;

const SHINE = (c) => `<path d="M70 58 Q86 46 104 46" fill="none" stroke="${c.light}" stroke-width="3" stroke-linecap="round" stroke-opacity="0.6"/>`;

// A smooth cap pulled back (buns, ponytails): hairline at the forehead and temples.
const SLEEK_CAP = (c) => `<path d="${cap(57, 63, 104, "L152 104 Q150 82 140 70 Q122 58 100 58 Q78 58 60 70 Q50 82 48 104")}" fill="${c.hair}"/>
                          <path d="M64 66 Q82 52 100 50 M136 66 Q118 52 100 50 M80 60 Q92 50 100 48" fill="none" stroke="${c.shade}" stroke-width="1.6"/>`;
const CENTER_PART = (c) => `<path d="${cap(57, 63, 104, "L152 104 Q150 76 136 66 Q116 58 103 56 L100 50 L97 56 Q84 58 64 66 Q50 76 48 104")}" fill="${c.hair}"/>`;
const SIDE_PART = (c) => `<path d="${cap(57, 63, 104, "L152 104 Q151 82 144 72 Q124 60 80 64 Q62 70 54 84 Q49 94 48 104")}" fill="${c.hair}"/>
                          <path d="M80 64 Q90 50 100 44" fill="none" stroke="${c.shade}" stroke-width="2" stroke-linecap="round"/>`;

const WOMEN_HAIR = [
  {
    id: "w-pixie", label: "Pixie cut", coversEars: false,
    front: (c) => `<path d="${cap(57, 63, 108, "L151 108 Q153 90 146 80 Q136 70 118 66 Q94 64 76 70 Q64 76 58 86 Q52 96 49 108")}" fill="${c.hair}"/>
                   <path d="M58 88 Q66 64 104 58 Q136 56 148 78 Q124 66 100 68 Q76 72 62 92Z" fill="${c.shade}" fill-opacity="0.45"/>
                   <path d="M44 100 L45 116 Q49 118 52 112 L51 100Z M156 100 L155 116 Q151 118 148 112 L149 100Z" fill="${c.hair}"/>`,
  },
  {
    id: "w-layered", label: "Short layered cut", coversEars: true,
    back: (c) => `<path d="${cap(61, 66, 132, "L100 132")}" fill="${c.hair}"/>`,
    front: (c) => `<path d="${cap(59, 65, 104, "L152 104 Q152 80 142 70 Q120 60 92 64 Q70 68 58 84 Q50 94 48 104")}" fill="${c.hair}"/>
                   <path d="M43 96 Q37 114 39 132 L45 126 L49 135 L55 127 L60 131 Q57 112 60 98Z M157 96 Q163 114 161 132 L155 126 L151 135 L145 127 L140 131 Q143 112 140 98Z" fill="${c.hair}"/>
                   <path d="M92 64 Q110 54 144 72 M70 70 Q80 60 96 58" fill="none" stroke="${c.shade}" stroke-width="2"/>`,
  },
  {
    id: "w-volume-bob", label: "Chin-length bob with volume", coversEars: true,
    back: (c) => `<path d="M30 118 Q24 34 100 30 Q176 34 170 118 Q172 150 156 158 L44 158 Q28 150 30 118Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="${cap(64, 71, 100, "L152 100 Q152 78 140 68 Q118 60 96 64 Q70 70 58 88 Q51 96 49 100")}" fill="${c.hair}"/>
                   <path d="M40 96 Q30 134 44 156 Q56 158 61 148 Q55 124 59 100Z M160 96 Q170 134 156 156 Q144 158 139 148 Q145 124 141 100Z" fill="${c.hair}"/>
                   <path d="M96 64 Q104 46 124 40 M58 88 Q60 70 76 60" fill="none" stroke="${c.shade}" stroke-width="2"/>
                   ${SHINE(c)}`,
  },
  {
    id: "w-soft-perm", label: "Short soft perm", coversEars: true,
    back: (c) => `<ellipse cx="100" cy="92" rx="66" ry="56" fill="${c.hair}"/>${curls([[42, 124, 12], [158, 124, 12], [48, 138, 10], [152, 138, 10]], c)}`,
    front: (c) => curls([...curlRing(60, 58, -180, 0, 18, 12), [62, 66, 10], [80, 58, 10], [100, 55, 10], [120, 58, 10], [138, 66, 10],
                         [44, 112, 11], [156, 112, 11], [46, 100, 10], [154, 100, 10]], c),
  },
  {
    id: "w-sleek-bob", label: "Sleek bob", coversEars: true,
    back: (c) => `<path d="M36 112 Q32 36 100 32 Q168 36 164 112 L166 152 L34 152Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="${cap(58, 64, 100, "L154 100 L148 70 L52 70 L46 100")}" fill="${c.hair}"/>
                   <path d="M42 92 L40 152 L61 152 L58 92Z M158 92 L160 152 L139 152 L142 92Z" fill="${c.hair}"/>
                   <path d="M70 70 L68 60 M100 70 L100 58 M130 70 L132 60" stroke="${c.shade}" stroke-width="2" stroke-linecap="round"/>
                   ${SHINE(c)}`,
  },
  {
    id: "w-lob", label: "Side-swept lob", coversEars: true,
    back: (c) => `<path d="M34 112 Q30 36 100 32 Q170 36 166 112Z" fill="${c.hair}"/>`,
    backFall: (c) => `<path d="M34.7 104 L165.3 104 L166 112 L172 176 Q156 186 138 176 L136 120 L64 120 L62 176 Q44 186 28 176 L34 112Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="M46 104 Q40 38 100 36 Q160 38 154 104 Q150 74 132 62 Q100 60 76 68 Q60 76 54 92 Q50 98 46 104Z" fill="${c.hair}"/>
                   <path d="M132 62 Q98 62 70 78 Q56 88 52 104 Q58 80 82 66 Q104 56 132 56Z" fill="${c.shade}" fill-opacity="0.4"/>`,
    frontFall: (c) => curtains(92, 176, c, 4),
  },
  // The first version's shape: a full, high crown and two straight panels that frame the face
  // from outside and fall to the shoulders, with a gap beside the neck.
  {
    id: "w-shoulder", label: "Shoulder length", coversEars: true,
    back: (c) => `<path d="M36 112 Q32 38 100 34 Q168 38 164 112Z" fill="${c.hair}"/>`,
    backFall: (c) => `<path d="M36.7 104 L163.3 104 L164 112 L170 184 Q152 194 136 182 L136 120 L64 120 L64 182 Q48 194 30 184 L36 112Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="M46 104 Q40 40 100 38 Q160 40 154 104 Q150 74 128 64 Q96 76 62 66 Q52 80 46 104Z" fill="${c.hair}"/>
                   <path d="M62 66 Q96 74 128 64" fill="none" stroke="${c.shade}" stroke-width="2"/>`,
    frontFall: (c) => `<path d="M46 92 Q38 140 40 178 Q50 186 60 176 Q54 130 58 98Z M154 92 Q162 140 160 178 Q150 186 140 176 Q146 130 142 98Z" fill="${c.hair}"/>`,
  },
  {
    id: "w-long-straight", label: "Long straight", coversEars: true,
    back: (c) => `<path d="M34 112 Q30 36 100 32 Q170 36 166 112Z" fill="${c.hair}"/>`,
    backFall: (c) => `<path d="M34.7 104 L165.3 104 L166 112 L172 240 L134 240 L134 120 L66 120 L66 240 L28 240 L34 112Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="M46 104 Q42 40 100 38 Q158 40 154 104 Q150 66 104 58 L100 50 L96 58 Q50 66 46 104Z" fill="${c.hair}"/>`,
    frontFall: (c) => `<path d="M46 92 Q36 150 40 236 L60 236 Q56 150 58 100Z M154 92 Q164 150 160 236 L140 236 Q144 150 142 100Z" fill="${c.hair}"/>
                       <path d="M50 130 L50 220 M150 130 L150 220" stroke="${c.shade}" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "w-long-waves", label: "Long waves", coversEars: true,
    back: (c) => `<path d="M32 112 Q28 34 100 32 Q172 34 168 112Z" fill="${c.hair}"/>`,
    backFall: (c) => `<path d="M32.7 104 L167.3 104 L168 112 Q180 140 168 168 Q182 196 170 228 L176 240 L134 240 L134 120 L66 120 L66 240 L24 240 L30 228 Q18 196 32 168 Q20 140 32 112Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="M46 104 Q40 38 100 36 Q160 38 154 104 Q150 78 134 66 Q114 58 94 60 L90 52 Q80 60 66 66 Q52 78 46 104Z" fill="${c.hair}"/>`,
    frontFall: (c) => `<path d="M45 92 Q34 116 44 140 Q32 166 44 192 Q34 214 42 236 L60 232 Q54 212 60 192 Q50 166 60 140 Q52 116 59 96Z
                                M155 92 Q166 116 156 140 Q168 166 156 192 Q166 214 158 236 L140 232 Q146 212 140 192 Q150 166 140 140 Q148 116 141 96Z" fill="${c.hair}"/>
                       <path d="M52 140 Q46 166 54 190 M148 140 Q154 166 146 190" fill="none" stroke="${c.shade}" stroke-width="2"/>`,
  },
  {
    id: "w-long-curls", label: "Long curls", coversEars: true,
    back: (c) => `<path d="M30 112 Q24 32 100 30 Q176 32 170 112 L176 214 L24 214Z" fill="${c.hair}"/>
                  ${curls([[30, 140, 13], [170, 140, 13], [28, 166, 13], [172, 166, 13], [32, 192, 13], [168, 192, 13], [40, 214, 12], [160, 214, 12], [62, 216, 12], [138, 216, 12]], c)}`,
    front: (c) => `${curls([...curlRing(60, 61, -180, 0, 18, 12), [64, 64, 10], [82, 57, 10], [100, 55, 10], [118, 57, 10], [136, 64, 10]], c)}
                   ${curls([[45, 104, 11], [42, 126, 11], [44, 148, 11], [42, 170, 11], [46, 192, 11], [155, 104, 11], [158, 126, 11], [156, 148, 11], [158, 170, 11], [154, 192, 11]], c)}`,
  },
  {
    id: "w-afro", label: "Curly afro", coversEars: false,
    back: (c) => `<circle cx="100" cy="84" r="72" fill="${c.hair}"/>${curls(curlRing(70, 70, -200, 20, 20, 12).map(([x, y, r]) => [x, y - 21, r]), c)}`,
    front: (c) => curls([[54, 88, 9], [60, 74, 9], [72, 64, 9], [86, 58, 9], [100, 56, 9], [114, 58, 9], [128, 64, 9], [140, 74, 9], [146, 88, 9]], c),
  },
  {
    id: "w-high-bun", label: "High bun", coversEars: false,
    front: (c) => `<circle cx="100" cy="26" r="19" fill="${c.hair}" stroke="${c.shade}" stroke-width="2"/>
                   ${SLEEK_CAP(c)}
                   <path d="M86 43 Q100 49 114 43" fill="none" stroke="${c.shade}" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: "w-low-bun", label: "Low bun", coversEars: false,
    back: (c) => `<ellipse cx="146" cy="150" rx="22" ry="18" fill="${c.hair}" stroke="${c.shade}" stroke-width="2"/>`,
    front: (c) => `${SIDE_PART(c)}<path d="M150 98 Q156 116 152 132" fill="none" stroke="${c.hair}" stroke-width="6" stroke-linecap="round"/>`,
  },
  {
    id: "w-ponytail", label: "High ponytail", coversEars: false,
    back: (c) => `<path d="M126 40 Q176 42 174 104 Q174 150 156 200 Q146 178 148 140 Q150 92 124 62Z" fill="${c.hair}"/>
                  <path d="M160 84 Q164 130 154 180" fill="none" stroke="${c.shade}" stroke-width="2"/>`,
    front: (c) => `${SLEEK_CAP(c)}<circle cx="140" cy="48" r="6" fill="${c.shade}"/>`,
  },
  {
    id: "w-two-braids", label: "Two braids", coversEars: true,
    front: (c) => `${CENTER_PART(c)}
                   <path d="M45 92 Q41 108 44 120 L58 118 Q56 106 58 98Z M155 92 Q159 108 156 120 L142 118 Q144 106 142 98Z" fill="${c.hair}"/>
                   <g fill="${c.hair}" stroke="${c.shade}" stroke-width="2">${braid(50, 118, 202)}${braid(150, 118, 202)}</g>
                   <rect x="44" y="210" width="12" height="7" rx="3" fill="#e74c3c"/><rect x="144" y="210" width="12" height="7" rx="3" fill="#e74c3c"/>`,
  },
  {
    id: "w-side-braid", label: "Side braid", coversEars: true,
    front: (c) => `${SIDE_PART(c)}
                   <path d="M45 92 Q40 112 47 124 L61 120 Q56 106 58 98Z M155 92 Q159 104 154 114 Q147 113 144 104 L142 98Z" fill="${c.hair}"/>
                   <g fill="${c.hair}" stroke="${c.shade}" stroke-width="2">${braid(54, 122, 206)}</g>
                   <rect x="48" y="214" width="12" height="7" rx="3" fill="${c.shade}"/>`,
  },
  {
    id: "w-half-up", label: "Half-up", coversEars: true,
    back: (c) => `<circle cx="100" cy="34" r="13" fill="${c.hair}" stroke="${c.shade}" stroke-width="2"/>
                  <path d="M34 112 Q30 34 100 32 Q170 34 166 112Z" fill="${c.hair}"/>`,
    backFall: (c) => `<path d="M34.7 104 L165.3 104 L166 112 L172 232 L134 232 L134 120 L66 120 L66 232 L28 232 L34 112Z" fill="${c.hair}"/>`,
    front: (c) => SLEEK_CAP(c),
    frontFall: (c) => curtains(96, 228, c),
  },
];

const MEN_HAIR = [
  {
    id: "m-buzz", label: "Buzz cut", coversEars: false,
    front: (c) => `<path d="${cap(55.5, 61.5, 100, "L152.5 100 Q151 80 142 70 Q122 60 100 60 Q78 60 58 70 Q49 80 47.5 100")}" fill="${c.fade}"/>
                   <path d="${cap(55.5, 61.5, 92, "L150 92 Q146 74 136 68 Q118 60 100 61 Q82 60 64 68 Q54 74 50 92")}" fill="${c.hair}" fill-opacity="0.55"/>`,
  },
  {
    id: "m-bald", label: "Shaved", coversEars: false,
    front: () => `<ellipse cx="84" cy="60" rx="13" ry="6" fill="#ffffff" fill-opacity="0.2" transform="rotate(-22 84 60)"/>`,
  },
  {
    id: "m-crop", label: "Short crop", coversEars: false,
    front: (c) => `<path d="${cap(57, 64, 100, "L153 100 Q151 74 140 66 L134 56 L124 64 L113 53 L102 63 L90 53 L80 64 L68 56 L62 67 Q50 74 47 100")}" fill="${c.hair}"/>`,
  },
  {
    id: "m-crew", label: "Crew cut", coversEars: false,
    front: (c) => `<path d="${cap(57, 63, 100, "L152.5 100 Q151 82 146 74 L136 70 Q118 62 100 62 Q82 62 64 70 L54 74 Q49 82 47.5 100")}" fill="${c.hair}"/>
                   <path d="M47.5 100 Q46.5 92 49 86 Q53 84 56 87 Q54.5 94 56 100Z M152.5 100 Q153.5 92 151 86 Q147 84 144 87 Q145.5 94 144 100Z" fill="${c.fade}"/>`,
  },
  {
    id: "m-side-part", label: "Side part", coversEars: false,
    front: (c) => `<path d="${cap(57, 63, 100, "L152.5 100 Q152 80 144 68 Q118 58 76 62 Q60 66 52 80 Q48 88 47.5 100")}" fill="${c.hair}"/>
                   <path d="M76 62 Q98 44 152 72 Q122 52 98 52 Q84 54 76 62Z" fill="${c.shade}" fill-opacity="0.5"/>
                   <path d="M76 62 Q74 52 86 44" fill="none" stroke="${c.shade}" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  {
    id: "m-quiff", label: "Quiff", coversEars: false,
    front: (c) => `<path d="M47.5 100 Q42 60 66 44 Q84 18 122 22 Q152 30 156 62 Q158 82 152.5 100 L150 100 Q148 78 136 70 Q112 60 82 66 Q60 72 52 100Z" fill="${c.hair}"/>
                   <path d="M72 46 Q92 28 124 30 M80 56 Q100 38 132 42" fill="none" stroke="${c.shade}" stroke-width="2"/>
                   <path d="M47.5 100 Q46.5 92 49 86 Q53 84 56 87 Q54.5 94 56 100Z M152.5 100 Q153.5 92 151 86 Q147 84 144 87 Q145.5 94 144 100Z" fill="${c.fade}"/>`,
  },
  {
    id: "m-slicked-back", label: "Slicked back", coversEars: false,
    front: (c) => `<path d="${cap(57, 63, 100, "L152.5 100 Q151 78 140 66 Q120 56 100 56 Q80 56 60 66 Q49 78 47.5 100")}" fill="${c.hair}"/>
                   <path d="M68 62 Q84 48 104 46 M84 58 Q98 48 118 48 M100 56 Q114 48 132 54" fill="none" stroke="${c.shade}" stroke-width="1.8"/>
                   ${SHINE(c)}`,
  },
  {
    id: "m-fringe", label: "Textured fringe", coversEars: false,
    front: (c) => `<path d="${cap(57, 63, 100, "L152.5 100 Q152 80 146 72 L138 68 L134 74 L126 66 L118 72 L110 65 L102 71 L94 65 L86 72 L78 66 L70 73 L62 68 L54 74 Q49 84 47.5 100")}" fill="${c.hair}"/>
                   <path d="M70 60 L74 50 M90 58 L94 48 M110 58 L112 48 M128 60 L130 50" stroke="${c.shade}" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "m-low-fade", label: "Low fade", coversEars: false,
    front: (c) => `<path d="${cap(55.5, 61.5, 104, "L152.5 104 Q151 86 144 78 L56 78 Q49 86 47.5 104")}" fill="${c.fade}"/>
                   <path d="${cap(57, 63, 84, "L146 84 Q142 70 132 66 Q116 60 100 60 Q84 60 68 66 Q58 70 54 84")}" fill="${c.hair}"/>
                   <path d="M70 64 Q90 54 112 56" fill="none" stroke="${c.shade}" stroke-width="1.8"/>`,
  },
  {
    id: "m-curls", label: "Short curls", coversEars: false,
    front: (c) => `<path d="${cap(56, 62, 98, "L152 98 Q150 78 140 70 L60 70 Q50 78 48 98")}" fill="${c.hair}"/>
                   ${curls([[52, 88, 10], [148, 88, 10], [55, 70, 11], [145, 70, 11], [67, 55, 12], [133, 55, 12], [83, 46, 12], [117, 46, 12], [100, 43, 12], [80, 62, 9], [100, 58, 9], [120, 62, 9]], c)}`,
  },
  {
    id: "m-curly-fade", label: "Curly top fade", coversEars: false,
    front: (c) => `<path d="${cap(55.5, 61.5, 104, "L152.5 104 Q151 84 144 74 L56 74 Q49 84 47.5 104")}" fill="${c.fade}"/>
                   ${curls([[60, 72, 10], [140, 72, 10], [66, 56, 11], [134, 56, 11], [80, 44, 12], [120, 44, 12], [100, 40, 12], [84, 60, 10], [100, 56, 10], [116, 60, 10]], c)}`,
  },
  {
    id: "m-afro", label: "Afro", coversEars: false,
    back: (c) => `<circle cx="100" cy="88" r="66" fill="${c.hair}"/>${curls(curlRing(64, 64, -200, 20, 22, 11).map(([x, y, r]) => [x, y - 17, r]), c)}`,
    front: (c) => curls([[54, 90, 9], [60, 76, 9], [72, 66, 9], [86, 60, 9], [100, 58, 9], [114, 60, 9], [128, 66, 9], [140, 76, 9], [146, 90, 9]], c),
  },
  {
    id: "m-shoulder", label: "Shoulder length", coversEars: true,
    back: (c) => `<path d="M36 112 Q32 36 100 34 Q168 36 164 112 L168 178 L32 178Z" fill="${c.hair}"/>`,
    front: (c) => `<path d="${cap(58, 64, 104, "L152 104 Q150 78 134 66 Q116 58 106 56 L102 50 Q86 58 66 66 Q52 78 48 104")}" fill="${c.hair}"/>
                   ${curtains(92, 172, c)}`,
  },
  {
    id: "m-man-bun", label: "Man bun", coversEars: false,
    back: (c) => `<circle cx="100" cy="30" r="17" fill="${c.hair}" stroke="${c.shade}" stroke-width="2"/>`,
    front: (c) => `${SLEEK_CAP(c)}<path d="M88 46 Q100 51 112 46" fill="none" stroke="${c.shade}" stroke-width="3.5" stroke-linecap="round"/>`,
  },
  {
    id: "m-tied-back", label: "Long tied back", coversEars: false,
    back: (c) => `<path d="M134 126 Q156 140 160 190 Q150 196 142 188 Q142 158 126 140Z" fill="${c.hair}"/>
                  <rect x="128" y="128" width="12" height="7" rx="3" fill="${c.shade}" transform="rotate(35 134 131)"/>`,
    front: (c) => SLEEK_CAP(c),
  },
];

// ---------- outfits ----------
// c: { skin, nw (neck width) }. body is drawn inside the body's outline and may paint the whole
// area; collar is drawn on top without that limit (collars rise above the shoulder line).
// highCollar: Randomize leaves necklaces out with it.

const OUTFIT_BASE = (color) => `<rect x="0" y="140" width="200" height="100" fill="${color}"/>`;
const CREW_NECK = (c, rib) => `<path d="M84 170 Q100 190 116 170Z" fill="${c.skin}"/>
                               <path d="M84 170 Q100 190 116 170" fill="none" stroke="${rib}" stroke-width="3"/>`;
const V_NECK = (c, rib) => `<path d="M84 170 L100 194 L116 170Z" fill="${c.skin}"/>
                            <path d="M84 170 L100 194 L116 170" fill="none" stroke="${rib}" stroke-width="3" stroke-linejoin="round"/>`;
const SLEEVE_SEAMS = (color) => `<path d="M44 194 Q50 208 48 226 M156 194 Q150 208 152 226" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
const SHIRT_COLLAR = (fill, line) => `<path d="M84 170 L100 186 L93 194 L78 177Z M116 170 L100 186 L107 194 L122 177Z" fill="${fill}" stroke="${line}" stroke-width="1.5" stroke-linejoin="round"/>`;
const LAPELS = (fill) => `<path d="M80 172 L100 224 L86 240 L62 240 L70 180Z M120 172 L100 224 L114 240 L138 240 L130 180Z" fill="${fill}"/>`;
const TIE = (fill, knot) => `<path d="M95 183 L105 183 L103 191 L97 191Z" fill="${knot}"/><path d="M97 190 L103 190 L108 224 L100 236 L92 224Z" fill="${fill}"/>`;
const TURTLE = (color, line) => (c) => `<rect x="${100 - c.nw / 2 - 4}" y="148" width="${c.nw + 8}" height="34" rx="9" fill="${color}"/>
  <path d="M${100 - c.nw / 2 - 2} 158 L${100 + c.nw / 2 + 2} 158 M${100 - c.nw / 2 - 2} 167 L${100 + c.nw / 2 + 2} 167" stroke="${line}" stroke-width="2"/>`;
const PUFFER_COLLAR = (color, line) => (c) => `<rect x="${100 - c.nw / 2 - 7}" y="152" width="${c.nw + 14}" height="34" rx="10" fill="${color}" stroke="${line}" stroke-width="2"/>
  <path d="M100 152 L100 186" stroke="#3a2a1a" stroke-width="2.5"/>`;
const STRIPES = (base, stripe) => `${OUTFIT_BASE(base)}<g fill="${stripe}"><rect x="0" y="184" width="200" height="8"/><rect x="0" y="200" width="200" height="8"/><rect x="0" y="216" width="200" height="8"/><rect x="0" y="232" width="200" height="8"/></g>`;

const outfitTee = (color, rib) => (c) => `${OUTFIT_BASE(color)}${CREW_NECK(c, rib)}${SLEEVE_SEAMS(rib)}`;
const outfitHoodie = (color, dark) => ({
  body: () => `${OUTFIT_BASE(color)}<path d="M66 240 L70 214 Q100 206 130 214 L134 240Z" fill="${dark}"/>
               <path d="M90 184 L88 210 M110 184 L112 210" stroke="#ececec" stroke-width="3" stroke-linecap="round"/>`,
  collar: () => `<path d="M60 184 Q58 156 100 158 Q142 156 140 184 Q124 173 100 175 Q76 173 60 184Z" fill="${dark}"/>`,
  highCollar: true,
});
const outfitSweater = (color, dark) => ({
  body: () => `${OUTFIT_BASE(color)}<path d="M60 196 L60 240 M80 200 L80 240 M120 200 L120 240 M140 196 L140 240" stroke="${dark}" stroke-width="2" stroke-opacity="0.6"/>`,
  collar: () => `<path d="M78 168 Q100 184 122 168 L122 176 Q100 192 78 176Z" fill="${dark}"/>`,
});
const outfitDenim = (color, dark) => ({
  body: () => `${OUTFIT_BASE(color)}<path d="M82 172 L92 240 L108 240 L118 172Z" fill="#f4f4f2"/>
               <rect x="54" y="200" width="24" height="16" rx="2" fill="none" stroke="${dark}" stroke-width="2.5"/>
               <rect x="122" y="200" width="24" height="16" rx="2" fill="none" stroke="${dark}" stroke-width="2.5"/>
               <circle cx="88" cy="210" r="2.5" fill="#c58b3a"/><circle cx="90" cy="228" r="2.5" fill="#c58b3a"/>`,
  collar: () => `<path d="M76 172 L90 168 L95 192 L83 197Z M124 172 L110 168 L105 192 L117 197Z" fill="${dark}"/>`,
});
const outfitLabCoat = (shirt) => ({
  body: () => `${OUTFIT_BASE("#f3f5f6")}<path d="M82 172 L100 212 L118 172Z" fill="${shirt}"/>
               <path d="M80 172 L100 212 L92 240 L70 240 L72 182Z M120 172 L100 212 L108 240 L130 240 L128 182Z" fill="#e3e8ea" stroke="#c4ccd0" stroke-width="1.5"/>
               <rect x="124" y="206" width="22" height="18" rx="2" fill="none" stroke="#c4ccd0" stroke-width="2"/>
               <path d="M130 198 L130 212" stroke="#2b5fb8" stroke-width="3" stroke-linecap="round"/>`,
});
const outfitPuffer = (color, line) => ({
  body: () => `${OUTFIT_BASE(color)}<path d="M0 196 Q100 206 200 196 M0 216 Q100 226 200 216 M0 236 Q100 246 200 236" fill="none" stroke="${line}" stroke-width="2.5"/>
               <path d="M100 176 L100 240" stroke="#3a2a1a" stroke-width="2.5"/>`,
  collar: PUFFER_COLLAR(color, line),
  highCollar: true,
});
const outfitTank = (color, line) => ({
  body: () => `<path d="M56 240 L60 190 Q66 178 75 176 Q86 198 100 200 Q114 198 125 176 Q134 178 140 190 L144 240Z" fill="${color}"/>
               <path d="M75 176 Q86 198 100 200 Q114 198 125 176" fill="none" stroke="${line}" stroke-width="3"/>`,
});
const outfitApron = (shirt, rib) => ({
  body: (c) => `${OUTFIT_BASE(shirt)}${CREW_NECK(c, rib)}
                <path d="M66 240 L68 198 Q100 193 132 198 L134 240Z" fill="#f3ead6" stroke="#d6c8a6" stroke-width="2"/>
                <path d="M72 199 L${100 - c.nw / 2 + 3} 172 M128 199 L${100 + c.nw / 2 - 3} 172" stroke="#f3ead6" stroke-width="5"/>
                <rect x="86" y="214" width="28" height="16" rx="3" fill="none" stroke="#d6c8a6" stroke-width="2"/>`,
});

const outfit = (id, label, parts) => ({ id, label, ...(typeof parts === "function" ? { body: parts } : parts) });

const WOMEN_OUTFITS = [
  outfit("w-tshirt", "T-shirt", outfitTee("#e0483e", "#b8362e")),
  outfit("w-hoodie", "Hoodie", outfitHoodie("#b48ec9", "#9873ad")),
  outfit("w-sweater", "Sweater", outfitSweater("#d9a441", "#b98a2f")),
  outfit("w-cardigan", "Cardigan", () => `${OUTFIT_BASE("#c97b8e")}<path d="M82 172 L100 240 L118 172Z" fill="#f6efe6"/>
      <path d="M82 172 L100 240 L118 172" fill="none" stroke="#a9606f" stroke-width="3"/>
      <circle cx="88" cy="202" r="2.6" fill="#7d3f4e"/><circle cx="93" cy="222" r="2.6" fill="#7d3f4e"/>`),
  outfit("w-turtleneck", "Turtleneck", { body: () => OUTFIT_BASE("#5b3a5e"), collar: TURTLE("#5b3a5e", "#432a45"), highCollar: true }),
  outfit("w-blazer", "Blazer and blouse", () => `${OUTFIT_BASE("#2f3a56")}<path d="M82 172 L100 222 L118 172Z" fill="#fbf6f0"/>
      <path d="M84 172 Q92 186 100 182 Q108 186 116 172" fill="none" stroke="#e2d7c8" stroke-width="2"/>${LAPELS("#243048")}`),
  outfit("w-dress-collar", "Dress with collar", () => `${OUTFIT_BASE("#7a4fc2")}
      <path d="M100 178 Q88 198 74 190 Q68 180 82 172Z M100 178 Q112 198 126 190 Q132 180 118 172Z" fill="#ffffff" stroke="#d8d0ea" stroke-width="1.5"/>
      <circle cx="100" cy="204" r="2.4" fill="#5c3796"/><circle cx="100" cy="220" r="2.4" fill="#5c3796"/>`),
  outfit("w-wrap-dress", "Wrap dress", (c) => `${OUTFIT_BASE("#2e8b7a")}<path d="M84 172 L100 206 L116 172Z" fill="${c.skin}"/>
      <path d="M78 174 L132 240" stroke="#22695c" stroke-width="3"/><path d="M84 172 L100 206 L116 172" fill="none" stroke="#22695c" stroke-width="2.5"/>
      <path d="M124 222 Q132 214 136 224 Q130 228 124 222Z M124 222 Q118 232 126 236" fill="#22695c"/>`),
  outfit("w-bow-blouse", "Bow blouse", () => `${OUTFIT_BASE("#f4e6d8")}
      <path d="M100 184 Q86 174 84 186 Q86 196 100 188Z M100 184 Q114 174 116 186 Q114 196 100 188Z" fill="#c0392b"/>
      <path d="M98 188 L92 210 M102 188 L108 210" stroke="#c0392b" stroke-width="4" stroke-linecap="round"/><circle cx="100" cy="186" r="3.5" fill="#962d22"/>
      <path d="M100 196 L100 240" stroke="#e0cdb8" stroke-width="2"/>`),
  outfit("w-floral", "Floral blouse", (c) => `${OUTFIT_BASE("#f08a7e")}${CREW_NECK(c, "#d0675c")}
      <g fill="#fff4c2">${[[50, 204], [80, 222], [120, 206], [150, 226], [104, 232], [36, 228], [164, 200], [70, 196], [132, 188]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/><circle cx="${x + 4}" cy="${y}" r="2.2"/><circle cx="${x - 4}" cy="${y}" r="2.2"/><circle cx="${x}" cy="${y + 4}" r="2.2"/><circle cx="${x}" cy="${y - 4}" r="2.2"/>`).join("")}</g>`),
  outfit("w-stripes", "Striped top", (c) => `${STRIPES("#f4f1ea", "#2c3e66")}${CREW_NECK(c, "#2c3e66")}`),
  outfit("w-tank", "Tank top", outfitTank("#e05a9a", "#b8437a")),
  outfit("w-off-shoulder", "Off-shoulder top", () => `<path d="M0 198 Q100 208 200 198 L200 240 L0 240Z" fill="#f2c94c"/>
      <path d="M0 198 Q12 206 24 200 Q36 208 48 202 Q60 210 72 203 Q86 210 100 204 Q114 210 128 203 Q140 210 152 202 Q164 208 176 200 Q188 206 200 198" fill="none" stroke="#d4a92c" stroke-width="3"/>`),
  outfit("w-denim", "Denim jacket", outfitDenim("#4a78b5", "#3a6296")),
  outfit("w-lab-coat", "Lab coat", outfitLabCoat("#f4c6d6")),
  outfit("w-uniform", "School uniform", () => `${OUTFIT_BASE("#26375e")}<path d="M82 172 L100 222 L118 172Z" fill="#f7f7f5"/>
      ${SHIRT_COLLAR("#ffffff", "#c9c9c9")}
      <path d="M100 190 Q88 180 86 192 Q88 200 100 194Z M100 190 Q112 180 114 192 Q112 200 100 194Z" fill="#c0392b"/><circle cx="100" cy="192" r="3" fill="#962d22"/>
      ${LAPELS("#1c2a4a")}<path d="M132 198 L148 198 L148 208 Q140 217 132 208Z" fill="#e0b84a"/>`),
  outfit("w-track", "Track jacket", {
    body: () => `${OUTFIT_BASE("#1f9a8a")}<path d="M100 178 L100 240" stroke="#e8e8e8" stroke-width="2.5"/>
                 <path d="M24 204 L52 182 M30 214 L58 192 M176 204 L148 182 M170 214 L142 192" stroke="#ffffff" stroke-width="4"/>`,
    collar: (c) => `<rect x="${100 - c.nw / 2 - 5}" y="160" width="${c.nw + 10}" height="22" rx="7" fill="#1f9a8a" stroke="#177a6d" stroke-width="2"/><path d="M100 160 L100 182" stroke="#e8e8e8" stroke-width="2.5"/>`,
    highCollar: true,
  }),
  outfit("w-puffer", "Puffer jacket", outfitPuffer("#e9e2d6", "#c9bfae")),
  outfit("w-apron", "Apron", outfitApron("#7fae8c", "#5f8d6c")),
  outfit("w-pinafore", "Pinafore dress", (c) => `${OUTFIT_BASE("#ffffff")}${CREW_NECK(c, "#d6d6d6")}
      <path d="M68 196 L132 196 L136 240 L64 240Z" fill="#c0392b"/>
      <path d="M72 198 L66 176 M128 198 L134 176" stroke="#c0392b" stroke-width="8"/>
      <circle cx="74" cy="201" r="2.6" fill="#ffffff"/><circle cx="126" cy="201" r="2.6" fill="#ffffff"/>`),
];

const MEN_OUTFITS = [
  outfit("m-tshirt", "T-shirt", outfitTee("#3d6fb0", "#2c5590")),
  outfit("m-hoodie", "Hoodie", outfitHoodie("#5d7184", "#4a5b6b")),
  outfit("m-sweater", "Sweater", outfitSweater("#8a6d4e", "#6e553b")),
  outfit("m-shirt-tie", "Shirt and tie", () => `${OUTFIT_BASE("#f4f4f2")}${SHIRT_COLLAR("#ffffff", "#c9c9c9")}${TIE("#2b4a8b", "#1f3566")}`),
  outfit("m-suit", "Suit", () => `${OUTFIT_BASE("#2a2f3a")}<path d="M82 172 L100 222 L118 172Z" fill="#f4f4f2"/>
      ${SHIRT_COLLAR("#ffffff", "#c9c9c9")}${TIE("#8e1f2f", "#6b1623")}${LAPELS("#1f232c")}<circle cx="100" cy="232" r="2.5" fill="#15181e"/>`),
  outfit("m-polo", "Polo shirt", {
    body: () => `${OUTFIT_BASE("#7fb6e6")}<path d="M95 174 L105 174 L105 204 L95 204Z" fill="#6aa2d4"/>
                 <circle cx="100" cy="186" r="2" fill="#ffffff"/><circle cx="100" cy="196" r="2" fill="#ffffff"/>${SLEEVE_SEAMS("#5f98c8")}`,
    collar: () => `<path d="M80 170 L99 177 L95 191 L76 181Z M120 170 L101 177 L105 191 L124 181Z" fill="#a3cbef" stroke="#5f98c8" stroke-width="1.5" stroke-linejoin="round"/>`,
  }),
  outfit("m-flannel", "Flannel shirt", () => `${OUTFIT_BASE("#b23a3a")}<g fill="#2a1414" fill-opacity="0.35">
      <rect x="12" y="140" width="10" height="100"/><rect x="44" y="140" width="10" height="100"/><rect x="76" y="140" width="10" height="100"/>
      <rect x="114" y="140" width="10" height="100"/><rect x="146" y="140" width="10" height="100"/><rect x="178" y="140" width="10" height="100"/>
      <rect x="0" y="186" width="200" height="10"/><rect x="0" y="218" width="200" height="10"/></g>
      ${SHIRT_COLLAR("#b23a3a", "#6e2020")}<path d="M100 186 L100 240" stroke="#6e2020" stroke-width="2"/>
      <circle cx="100" cy="204" r="2" fill="#f0e2c8"/><circle cx="100" cy="222" r="2" fill="#f0e2c8"/>`),
  outfit("m-denim", "Denim jacket", outfitDenim("#3f6aa3", "#30568a")),
  outfit("m-lab-coat", "Lab coat", outfitLabCoat("#9cc3e6")),
  outfit("m-uniform", "School uniform", () => `${OUTFIT_BASE("#26375e")}<path d="M82 172 L100 222 L118 172Z" fill="#f7f7f5"/>
      ${SHIRT_COLLAR("#ffffff", "#c9c9c9")}<path d="M97 189 L103 189 L107 220 L100 230 L93 220Z" fill="#b8333a"/>
      <path d="M96 198 L104 194 M95 208 L106 202 M94 218 L107 212" stroke="#e0b84a" stroke-width="2"/>
      ${LAPELS("#1c2a4a")}<path d="M132 198 L148 198 L148 208 Q140 217 132 208Z" fill="#e0b84a"/>`),
  outfit("m-jersey", "Sports jersey", (c) => `${OUTFIT_BASE("#2f9e63")}${V_NECK(c, "#ffffff")}
      <path d="M28 202 L58 184 M32 212 L62 194 M172 202 L142 184 M168 212 L138 194" stroke="#ffffff" stroke-width="4"/>`),
  outfit("m-tank", "Tank top", outfitTank("#2d3436", "#1b2022")),
  outfit("m-turtleneck", "Turtleneck", { body: () => OUTFIT_BASE("#2b2b33"), collar: TURTLE("#2b2b33", "#1d1d23"), highCollar: true }),
  outfit("m-varsity", "Varsity jacket", {
    body: () => `${OUTFIT_BASE("#7b1e3a")}<path d="M0 240 L0 176 Q32 174 54 188 L56 240Z M200 240 L200 176 Q168 174 146 188 L144 240Z" fill="#efe3c8"/>
                 <circle cx="100" cy="202" r="2.6" fill="#efe3c8"/><circle cx="100" cy="218" r="2.6" fill="#efe3c8"/><circle cx="100" cy="234" r="2.6" fill="#efe3c8"/>`,
    collar: () => `<path d="M78 168 Q100 184 122 168 L122 177 Q100 193 78 177Z" fill="#7b1e3a"/><path d="M78 172 Q100 188 122 172" fill="none" stroke="#efe3c8" stroke-width="2"/>`,
  }),
  outfit("m-puffer", "Puffer jacket", outfitPuffer("#f08a24", "#c96d14")),
  outfit("m-leather", "Leather jacket", (c) => `${OUTFIT_BASE("#1f1f22")}${CREW_NECK(c, "#d9d9d9")}
      <path d="M86 176 L100 196 L114 176 L118 240 L82 240Z" fill="#e9e9e9"/>
      <path d="M78 174 L96 204 L90 240 L64 240 L68 186Z M122 174 L104 204 L112 240 L136 240 L132 186Z" fill="#2c2c30"/>
      <path d="M112 204 L118 240" stroke="#b8b8b8" stroke-width="2"/><rect x="52" y="214" width="20" height="3" fill="#b8b8b8"/>`),
  outfit("m-henley", "Henley", (c) => `${OUTFIT_BASE("#c9b79c")}${CREW_NECK(c, "#a8967b")}
      <path d="M100 186 L100 210" stroke="#a8967b" stroke-width="2"/><circle cx="100" cy="194" r="2" fill="#7d6c53"/><circle cx="100" cy="203" r="2" fill="#7d6c53"/>${SLEEVE_SEAMS("#a8967b")}`),
  outfit("m-stripes", "Striped sweatshirt", () => `${STRIPES("#f4f1ea", "#9b2c2c")}<path d="M82 171 Q100 186 118 171" fill="none" stroke="#9b2c2c" stroke-width="4"/>`),
  outfit("m-dungarees", "Dungarees", (c) => `${OUTFIT_BASE("#f2c94c")}${CREW_NECK(c, "#d4a92c")}
      <path d="M70 200 L130 200 L130 240 L70 240Z" fill="#3d6fb0"/><path d="M74 202 L64 178 M126 202 L136 178" stroke="#3d6fb0" stroke-width="9"/>
      <rect x="88" y="212" width="24" height="14" rx="2" fill="none" stroke="#2c5590" stroke-width="2"/>
      <circle cx="75" cy="205" r="3" fill="#e0b84a"/><circle cx="125" cy="205" r="3" fill="#e0b84a"/>`),
  outfit("m-bomber", "Bomber jacket", {
    body: () => `${OUTFIT_BASE("#56603c")}<path d="M100 180 L100 240" stroke="#c8c8c8" stroke-width="2.5"/>
                 <rect x="0" y="232" width="200" height="8" fill="#3f4629"/><path d="M40 204 L58 200" stroke="#3f4629" stroke-width="3"/>`,
    collar: () => `<path d="M76 170 Q100 190 124 170 L126 180 Q100 200 74 180Z" fill="#3f4629"/><path d="M80 174 Q100 192 120 174" fill="none" stroke="#e07a2c" stroke-width="2"/>`,
  }),
];

// ---------- accessories ----------
// Eyewear is drawn around the eyes (geo), as arms (under the hair, to the sides of the head) and a
// front (over the hair). sun: sunglasses (Randomize leaves them out with a full beard).

function glassesArms(geo, halfW, color, width) {
  const lx = geo.eyeL - 16;
  const rx = geo.eyeR + 16;
  return `<path d="M${lx} 99 L${fmt(100 - halfW + 1)} 96 M${rx} 99 L${fmt(100 + halfW - 1)} 96" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
}

function bridge(geo, color, width, lensHalf) {
  return `<path d="M${geo.eyeL + lensHalf} 100 Q100 95 ${geo.eyeR - lensHalf} 100" fill="none" stroke="${color}" stroke-width="${width}"/>`;
}

// One lens path per side (side -1: left lens, its outer corner points left).
function lensPair(geo, lens) {
  return `<path d="${lens(geo.eyeL, -1)}"/><path d="${lens(geo.eyeR, 1)}"/>`;
}

const catEyeLens = (cx, side) => {
  const o = (dx) => fmt(cx + dx * side);
  return `M${o(-17)} 92 Q${o(-21)} 84 ${o(-8)} 89 L${o(15)} 91 Q${o(17)} 108 ${o(2)} 113 Q${o(-15)} 114 ${o(-17)} 92Z`;
};
const oversizedLens = (cx) => `M${cx - 19} 88 L${cx + 19} 88 Q${cx + 21} 88 ${cx + 20} 92 L${cx + 17} 116 Q${cx + 16} 119 ${cx + 12} 119 L${cx - 12} 119 Q${cx - 16} 119 ${cx - 17} 116 L${cx - 20} 92 Q${cx - 21} 88 ${cx - 19} 88Z`;
const aviatorLens = (cx, side) => {
  const o = (dx) => fmt(cx + dx * side);
  return `M${o(-16)} 91 L${o(16)} 91 Q${o(17)} 116 ${o(2)} 116 Q${o(-15)} 116 ${o(-16)} 91Z`;
};
const wayfarerLens = (cx, side) => {
  const o = (dx) => fmt(cx + dx * side);
  return `M${o(-18)} 90 L${o(17)} 90 L${o(14)} 113 L${o(-15)} 113Z`;
};

const eyewear = (id, label, color, width, front, sun = false) => ({
  id, label, sun,
  arms: (geo, halfW) => glassesArms(geo, halfW, color, width),
  draw: front,
});

const WOMEN_EYEWEAR = [
  { id: "w-no-eyewear", label: "No eyewear", arms: () => "", draw: () => "" },
  eyewear("w-cat-eye", "Cat-eye glasses", "#7a2340", 3, (geo) => `<g fill="#ffffff" fill-opacity="0.15" stroke="#7a2340" stroke-width="3" stroke-linejoin="round">${lensPair(geo, catEyeLens)}</g>${bridge(geo, "#7a2340", 3, 15)}`),
  eyewear("w-round-thin", "Round thin-frame glasses", "#9a7419", 2.2, (geo) => `<g fill="#ffffff" fill-opacity="0.12" stroke="#9a7419" stroke-width="2.2"><circle cx="${geo.eyeL}" cy="102" r="14"/><circle cx="${geo.eyeR}" cy="102" r="14"/></g>${bridge(geo, "#9a7419", 2.2, 14)}`),
  eyewear("w-oversized", "Oversized glasses", "#2b2b2b", 2.6, (geo) => `<g fill="#ffffff" fill-opacity="0.15" stroke="#2b2b2b" stroke-width="2.6">${lensPair(geo, oversizedLens)}</g>${bridge(geo, "#2b2b2b", 2.6, 20)}`),
  eyewear("w-oversized-sun", "Oversized sunglasses", "#3a2a22", 3, (geo) => `<g fill="#3a2a22" fill-opacity="0.62" stroke="#3a2a22" stroke-width="3">${lensPair(geo, oversizedLens)}</g>${bridge(geo, "#3a2a22", 3, 20)}`, true),
  eyewear("w-cat-eye-sun", "Cat-eye sunglasses", "#111111", 3, (geo) => `<g fill="#1d1d1d" fill-opacity="0.6" stroke="#111111" stroke-width="3" stroke-linejoin="round">${lensPair(geo, catEyeLens)}</g>${bridge(geo, "#111111", 3, 15)}`, true),
  eyewear("w-round-sun", "Round sunglasses", "#c9a227", 2, (geo) => `<g fill="#5a3c7a" fill-opacity="0.55" stroke="#c9a227" stroke-width="2"><circle cx="${geo.eyeL}" cy="102" r="14"/><circle cx="${geo.eyeR}" cy="102" r="14"/></g>${bridge(geo, "#c9a227", 2, 14)}`, true),
];

const MEN_EYEWEAR = [
  { id: "m-no-eyewear", label: "No eyewear", arms: () => "", draw: () => "" },
  eyewear("m-rectangle", "Rectangle glasses", "#24364f", 3, (geo) => `<g fill="#ffffff" fill-opacity="0.15" stroke="#24364f" stroke-width="3"><rect x="${geo.eyeL - 17}" y="91" width="34" height="22" rx="3"/><rect x="${geo.eyeR - 17}" y="91" width="34" height="22" rx="3"/></g>${bridge(geo, "#24364f", 3, 17)}`),
  eyewear("m-browline", "Browline glasses", "#2b2b2b", 2.4, (geo) => `<g fill="#ffffff" fill-opacity="0.12" stroke="#a8a8a8" stroke-width="1.6"><rect x="${geo.eyeL - 16}" y="90" width="32" height="24" rx="9"/><rect x="${geo.eyeR - 16}" y="90" width="32" height="24" rx="9"/></g>
      <path d="M${geo.eyeL - 17} 92 Q${geo.eyeL} 86 ${geo.eyeL + 17} 92 M${geo.eyeR - 17} 92 Q${geo.eyeR} 86 ${geo.eyeR + 17} 92" fill="none" stroke="#2b2b2b" stroke-width="4.5" stroke-linecap="round"/>${bridge(geo, "#a8a8a8", 1.8, 16)}`),
  eyewear("m-round-wire", "Round wire glasses", "#8a8a8a", 1.8, (geo) => `<g fill="#ffffff" fill-opacity="0.12" stroke="#8a8a8a" stroke-width="1.8"><circle cx="${geo.eyeL}" cy="102" r="13.5"/><circle cx="${geo.eyeR}" cy="102" r="13.5"/></g>${bridge(geo, "#8a8a8a", 1.8, 13.5)}`),
  eyewear("m-aviators", "Aviator sunglasses", "#c9a227", 2, (geo) => `<g fill="#3b4a5a" fill-opacity="0.6" stroke="#c9a227" stroke-width="2">${lensPair(geo, aviatorLens)}</g>
      <path d="M${geo.eyeL + 16} 92 L${geo.eyeR - 16} 92" stroke="#c9a227" stroke-width="2"/>${bridge(geo, "#c9a227", 2, 16)}`, true),
  eyewear("m-wayfarers", "Wayfarer sunglasses", "#111111", 4, (geo) => `<g fill="#1d1d1d" fill-opacity="0.6" stroke="#111111" stroke-width="4" stroke-linejoin="round">${lensPair(geo, wayfarerLens)}</g>${bridge(geo, "#111111", 4, 17)}`, true),
  eyewear("m-sport", "Sport sunglasses", "#c0392b", 2.5, (geo) => `<path d="M${geo.eyeL - 22} 96 Q${geo.eyeL - 20} 88 ${geo.eyeL} 89 L${geo.eyeR} 89 Q${geo.eyeR + 20} 88 ${geo.eyeR + 22} 96 Q${geo.eyeR + 18} 114 ${geo.eyeR} 112 Q104 112 100 104 Q96 112 ${geo.eyeL} 112 Q${geo.eyeL - 18} 114 ${geo.eyeL - 22} 96Z"
      fill="#2d4f7a" fill-opacity="0.6" stroke="#c0392b" stroke-width="2.5" stroke-linejoin="round"/>`, true),
];

// ear: earGeometry(); earrings hang from both earlobes. stud: hidden when hair covers the ears.
const earringsAt = (ear, draw) => [-1, 1].map((s) => draw(fmt(100 + s * ear.lobeDx), ear.lobeY)).join("");

const WOMEN_EARRINGS = [
  { id: "w-no-earrings", label: "No earrings", draw: () => "" },
  { id: "w-studs", label: "Studs", stud: true, draw: (ear) => earringsAt(ear, (x, y) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#e6c35c" stroke="#a8841f" stroke-width="1"/>`) },
  { id: "w-hoops", label: "Hoops", draw: (ear) => earringsAt(ear, (x, y) => `<circle cx="${x}" cy="${y + 7}" r="7.5" fill="none" stroke="#d4af37" stroke-width="2.5"/>`) },
  {
    id: "w-drops", label: "Drop earrings",
    draw: (ear) => earringsAt(ear, (x, y) => `<path d="M${x} ${y} L${x} ${y + 8}" stroke="#d4af37" stroke-width="1.8"/>
      <path d="M${x} ${y + 7} Q${x - 5} ${y + 16} ${x} ${y + 19} Q${x + 5} ${y + 16} ${x} ${y + 7}Z" fill="#4fb3c9" stroke="#2f8ca0" stroke-width="1"/>
      <circle cx="${x}" cy="${y}" r="2.4" fill="#d4af37"/>`),
  },
];

const MEN_EARRINGS = [
  { id: "m-no-earrings", label: "No earrings", draw: () => "" },
  { id: "m-stud", label: "Small stud", stud: true, draw: (ear) => earringsAt(ear, (x, y) => `<circle cx="${x}" cy="${y}" r="3" fill="#d9dde2" stroke="#6f767e" stroke-width="1.2"/>`) },
  { id: "m-hoop", label: "Small hoop", draw: (ear) => earringsAt(ear, (x, y) => `<circle cx="${x}" cy="${y + 5}" r="5.5" fill="none" stroke="#b9bfc6" stroke-width="2.4"/>`) },
  {
    id: "m-double-stud", label: "Double studs", stud: true,
    draw: (ear) => [-1, 1].map((s) => {
      const x = fmt(100 + s * ear.lobeDx);
      const x2 = fmt(100 + s * (ear.lobeDx + ear.rx * 0.45));
      return `<circle cx="${x}" cy="${ear.lobeY}" r="2.4" fill="#1d1d1d" stroke="#555" stroke-width="1"/>
              <circle cx="${x2}" cy="${ear.lobeY - ear.ry * 0.45}" r="2" fill="#d9dde2" stroke="#8c939b" stroke-width="1"/>`;
    }).join(""),
  },
];

// nw: neck width. The chain starts at the sides of the neck and hangs onto the chest.
const chainPath = (nw, depth = 212) => `M${100 - nw / 2 + 2} 168 Q100 ${depth} ${100 + nw / 2 - 2} 168`;

function pearlString(nw) {
  const l = 100 - nw / 2 + 2;
  const r = 100 + nw / 2 - 2;
  let pearls = "";
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = (1 - t) ** 2 * l + 2 * (1 - t) * t * 100 + t ** 2 * r;
    const y = (1 - t) ** 2 * 168 + 2 * (1 - t) * t * 210 + t ** 2 * 168;
    pearls += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="3.4"/>`;
  }
  return `<g fill="#f8f5ee" stroke="#cfc6b4" stroke-width="1">${pearls}</g>`;
}

const WOMEN_NECKLACES = [
  { id: "w-no-necklace", label: "No necklace", draw: () => "" },
  { id: "w-thin-chain", label: "Thin chain", draw: (nw) => `<path d="${chainPath(nw)}" fill="none" stroke="#d4af37" stroke-width="1.8"/>` },
  {
    id: "w-pendant", label: "Pendant",
    draw: (nw) => `<path d="${chainPath(nw)}" fill="none" stroke="#d4af37" stroke-width="1.6"/>
                   <circle cx="100" cy="194" r="5.5" fill="#d4af37"/><circle cx="100" cy="194" r="2.8" fill="#c0392b"/>`,
  },
  { id: "w-pearls", label: "Pearls", draw: (nw) => pearlString(nw) },
];

const MEN_NECKLACES = [
  { id: "m-no-necklace", label: "No necklace", draw: () => "" },
  { id: "m-chain", label: "Chain", draw: (nw) => `<path d="${chainPath(nw, 206)}" fill="none" stroke="#c9ced4" stroke-width="2.2"/>` },
  {
    id: "m-thick-chain", label: "Thick chain",
    draw: (nw) => `<path d="${chainPath(nw, 204)}" fill="none" stroke="#d4af37" stroke-width="5"/>
                   <path d="${chainPath(nw, 204)}" fill="none" stroke="#a8841f" stroke-width="5" stroke-dasharray="3 3"/>`,
  },
  {
    id: "m-dog-tag", label: "Dog tag",
    draw: (nw) => `<path d="${chainPath(nw, 214)}" fill="none" stroke="#a9b0b8" stroke-width="1.6" stroke-dasharray="2 1.5"/>
                   <rect x="93" y="190" width="14" height="20" rx="4" fill="#c9ced4" stroke="#8c939b" stroke-width="1.5"/>`,
  },
];

// Facial hair (men only), inside the head's outline (#headClip in avatar-art.js) with a line over
// the cheeks, plus a part below the chin. The eyes and mouth are drawn on top. head: the head
// shape (its chin and chinW, so a beard fits every jaw).
const BEARD_AREA = "M24 100 L58 100 Q62 124 82 128 Q100 121 118 128 Q138 124 142 100 L176 100 L176 240 L24 240Z";
const BOXED_AREA = "M24 112 L56 112 Q60 130 80 131 Q100 125 120 131 Q140 130 144 112 L176 112 L176 240 L24 240Z";
const MOUSTACHE = (color) => `<path d="M79 131 Q88 120 100 125 Q112 120 121 131 Q110 127 100 130 Q90 127 79 131Z" fill="${color}"/>`;
const clipped = (inner) => `<g clip-path="url(#headClip)">${inner}</g>`;

const MEN_FACIAL_HAIR = [
  { id: "m-no-facial-hair", label: "No facial hair", draw: () => "" },
  { id: "m-stubble", label: "Stubble", draw: (color) => clipped(`<path d="${BEARD_AREA}" fill="${color}" fill-opacity="0.3"/>`) },
  { id: "m-moustache", label: "Moustache", draw: (color) => MOUSTACHE(color) },
  {
    id: "m-beard", label: "Full beard",
    draw: (color, head) => `${clipped(`<path d="${BEARD_AREA}" fill="${color}"/>`)}
      <path d="M${100 - head.chinW - 18} ${head.chin - 10} Q100 ${head.chin + 22} ${100 + head.chinW + 18} ${head.chin - 10}Z" fill="${color}"/>`,
  },
  {
    id: "m-goatee", label: "Goatee",
    draw: (color, head) => `${MOUSTACHE(color)}
      <path d="M90 146 Q100 150 110 146 Q112 ${head.chin - 6} 106 ${head.chin + 3} Q100 ${head.chin + 7} 94 ${head.chin + 3} Q88 ${head.chin - 6} 90 146Z" fill="${color}"/>`,
  },
  {
    id: "m-boxed-beard", label: "Short boxed beard",
    draw: (color, head) => `${clipped(`<path d="${BOXED_AREA}" fill="${color}"/>`)}
      <path d="M${100 - head.chinW - 8} ${head.chin - 6} Q100 ${head.chin + 9} ${100 + head.chinW + 8} ${head.chin - 6}Z" fill="${color}"/>`,
  },
];

// ---------- looks ----------

// Fields with one list for both genders, and fields with a list per gender.
const SHARED_OPTIONS = { gender: GENDERS, skin: SKIN_TONES, hairColor: HAIR_COLORS };
const GENDER_OPTIONS = {
  female: {
    hairStyle: WOMEN_HAIR, face: [...FACES_BY_GENDER.female, ...FUNNY], outfit: WOMEN_OUTFITS,
    eyewear: WOMEN_EYEWEAR, earrings: WOMEN_EARRINGS, necklace: WOMEN_NECKLACES, facialHair: [],
  },
  male: {
    hairStyle: MEN_HAIR, face: [...FACES_BY_GENDER.male, ...FUNNY], outfit: MEN_OUTFITS,
    eyewear: MEN_EYEWEAR, earrings: MEN_EARRINGS, necklace: MEN_NECKLACES, facialHair: MEN_FACIAL_HAIR,
  },
};
const LOOK_FIELDS = ["gender", "skin", "hairColor", "hairStyle", "face", "outfit", "eyewear", "earrings", "necklace", "facialHair"];
// A woman's look always has this (there's no facial hair section for women).
const NO_FACIAL_HAIR = "none";

// The options of a field for a gender.
function lookOptions(field, gender) {
  return SHARED_OPTIONS[field] || GENDER_OPTIONS[gender][field];
}

function optionById(field, id, gender) {
  return lookOptions(field, gender).find((option) => option.id === id) || null;
}

// The starting look of each gender (also what a value outside its lists falls back to).
const DEFAULT_LOOKS = {
  female: {
    gender: "female", skin: "tone4", hairColor: "brown", hairStyle: "w-shoulder", face: "w-face-11", outfit: "w-cardigan",
    eyewear: "w-no-eyewear", earrings: "w-studs", necklace: "w-no-necklace", facialHair: NO_FACIAL_HAIR,
  },
  male: {
    gender: "male", skin: "tone4", hairColor: "darkBrown", hairStyle: "m-side-part", face: "m-face-11", outfit: "m-hoodie",
    eyewear: "m-no-eyewear", earrings: "m-no-earrings", necklace: "m-no-necklace", facialHair: "m-no-facial-hair",
  },
};
// The look of a character that no longer exists (a deleted one, in old sessions).
const DEFAULT_GENDER = "female";

// A complete look with only known values for its gender: anything unknown, missing or from the
// other gender's lists gets that gender's default. Never throws.
function cleanLook(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const gender = GENDERS.some((g) => g.id === source.gender) ? source.gender : DEFAULT_GENDER;
  const look = {};
  for (const field of LOOK_FIELDS) {
    look[field] = optionById(field, source[field], gender) ? source[field] : DEFAULT_LOOKS[gender][field];
  }
  return look;
}

function defaultLook(gender = DEFAULT_GENDER) {
  return { ...DEFAULT_LOOKS[gender] };
}

const randomItem = (list) => list[Math.floor(Math.random() * list.length)];
const randomChance = (p) => Math.random() < p;

// Randomize: a new look for the same gender, from its own lists. A funny face only about 1 in 10
// times. Combinations that look bad together are avoided (the editor still allows them):
// sunglasses with a full beard, earrings with hair that covers the ears, a necklace on a high collar.
function randomLook(gender) {
  const options = GENDER_OPTIONS[gender];
  const male = gender === "male";
  const hairStyle = randomItem(options.hairStyle);
  const outfit = randomItem(options.outfit);
  const face = randomChance(0.1) ? randomItem(FUNNY) : randomItem(FACES_BY_GENDER[gender]);
  const facialHair = male && randomChance(0.4) ? randomItem(options.facialHair.slice(1)).id : DEFAULT_LOOKS[gender].facialHair;
  let eyewear = randomChance(0.4) ? randomItem(options.eyewear.slice(1)) : options.eyewear[0];
  if (eyewear.sun && facialHair === "m-beard") eyewear = randomItem(options.eyewear.filter((e) => e.id !== options.eyewear[0].id && !e.sun));
  const earrings = !hairStyle.coversEars && randomChance(male ? 0.15 : 0.5) ? randomItem(options.earrings.slice(1)) : options.earrings[0];
  const necklace = !outfit.highCollar && randomChance(male ? 0.15 : 0.35) ? randomItem(options.necklace.slice(1)) : options.necklace[0];
  return {
    gender,
    // A fantasy colour only about 1 in 20 times.
    skin: randomItem(randomChance(0.05) ? FANTASY_SKIN_TONES : NATURAL_SKIN_TONES).id,
    // The bold colour only now and then.
    hairColor: randomChance(0.08) ? "blue" : randomItem(HAIR_COLORS.slice(0, -1)).id,
    hairStyle: hairStyle.id,
    face: face.id,
    outfit: outfit.id,
    eyewear: eyewear.id,
    earrings: earrings.id,
    necklace: necklace.id,
    facialHair,
  };
}

// ---------- translations ----------
// The English labels above go to the translation system (localize in js/i18n.js): each becomes a
// getter that gives the current language. Keys: avatar.headShape.<id>, avatar.nose.<id>,
// avatar.mark.<id> (the parts of a face's name), and avatar.<field>.<option id> for every option
// (the faces build their names from the parts, see faceLabel). avatar-costumes.js does the same
// for the costume lists. Only ids are ever saved.
for (const [table, prefix] of [[HEAD_SHAPES, "headShape"], [NOSES, "nose"], [MARKS, "mark"]]) {
  for (const [id, part] of Object.entries(table)) I18N.localize(part, "label", `avatar.${prefix}.${id}`);
}
for (const [field, options] of Object.entries(SHARED_OPTIONS)) {
  for (const option of options) I18N.localize(option, "label", `avatar.${field}.${option.id}`);
}
for (const fields of Object.values(GENDER_OPTIONS)) {
  for (const [field, options] of Object.entries(fields)) {
    if (field === "face") continue;
    for (const option of options) I18N.localize(option, "label", `avatar.${field}.${option.id}`);
  }
}
