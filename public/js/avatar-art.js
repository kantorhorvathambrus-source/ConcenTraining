// Draws a custom character from its look (avatar-parts.js), in layers on one 200 × 240 canvas.
// The expression (eyes, brows, mouth, extras) is the shared one from placeholder-art.js, so every
// face works in all 9 poses of all 4 personalities.
//
// Layers, back to front:
//   hair-back, body (skin), neck, outfit (inside the body's outline, plus its collar), necklace,
//   ears, head, nose, marks, facial hair, eyewear-arms, hair-front, the face (eyes with lashes,
//   brows, unibrow, mouth with lip tint and buck teeth, blush and tears), earrings, eyewear,
//   the other extras (sparkle, sweat, steam, the hands…).
// Ears sit behind the head, facial hair and hair under the eyes and mouth (so the expression
// always shows), glasses arms under the hair and the lenses over it. Any layer listed in
// AVATAR_PNG_FILES is drawn from its PNG instead of SVG (avatarLayer); skin and hair layers are
// coloured by code (tintFilter).

// Images loaded from AVATAR_PNG_FILES, as data: URLs (an SVG shown in an <img> can't load other
// files, so they're written into it).
const avatarPngData = new Map();
const avatarArtCache = new Map();
const AVATAR_ART_CACHE_MAX = 800;

// The visible part of the canvas: the whole character, or the head only (editor thumbnails).
const AVATAR_VIEWS = { full: "0 0 200 240", head: "8 -14 184 204" };

// Extras that belong to the face (they move and shrink with its features).
const FACE_EXTRAS = ["blush", "tears"];

// Loads every listed PNG once, then calls done (to redraw). Missing or broken files stay SVG.
function loadAvatarPngs(done) {
  if (AVATAR_PNG_FILES.length === 0) return;
  Promise.all(
    AVATAR_PNG_FILES.map((name) =>
      fetch(`assets/avatar/${name}.png`)
        .then((response) => (response.ok ? response.blob() : null))
        .then((blob) => blob && blobToDataUrl(blob))
        .then((url) => url && avatarPngData.set(name, url))
        .catch(() => {})
    )
  ).then(() => {
    avatarArtCache.clear();
    if (avatarPngData.size > 0 && done) done();
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

// Colours a grey PNG: each pixel's grey level is multiplied by the colour, so white becomes the
// colour, grey a darker shade of it and black stays black. Transparency is kept.
function tintFilter(id, hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => (v / 255).toFixed(3));
  return `<filter id="${id}" color-interpolation-filters="sRGB">
            <feColorMatrix type="matrix" values="${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0"/>
          </filter>`;
}

// One layer: its PNG if there is one, otherwise the SVG. transform and tint ("skin", "hair" or
// "brow") apply to both.
function avatarLayer(category, id, svg, transform, tint) {
  const png = avatarPngData.get(`${category}/${id}`);
  const inner = png
    ? `<image href="${png}" width="200" height="240"${tint ? ` filter="url(#tint-${tint})"` : ""}/>`
    : svg;
  if (!inner) return "";
  return transform ? `<g transform="${transform}">${inner}</g>` : inner;
}

// Hair is drawn for the reference head (crown y = 45, temples x = 46 / 154 at y = 105): moved to
// this head's ellipse centre (y = 105, or cy for an exact-ellipse head) and scaled, so it lies
// exactly on this head's upper ellipse.
function hairTransform(head) {
  const cy = head.cy || HEAD_CY;
  const sx = head.halfW / HAIR_REF.halfW;
  const sy = (cy - head.top) / (HEAD_CY - HAIR_REF.top);
  if (sx === 1 && sy === 1 && cy === HEAD_CY) return "";
  return `translate(100 ${cy}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-100 -${HEAD_CY})`;
}

function drawEars(head, ears, skin, shade) {
  const ear = earGeometry(head, ears);
  return [-1, 1].map((s) => {
    const cx = 100 + s * ear.dx;
    const inner = `M${cx + s * ear.rx * 0.1} ${EAR_Y - ear.ry * 0.5} Q${cx + s * ear.rx * 0.75} ${EAR_Y} ${cx + s * ear.rx * 0.15} ${EAR_Y + ear.ry * 0.55}`;
    return `<ellipse cx="${cx}" cy="${EAR_Y}" rx="${ear.rx}" ry="${ear.ry}" fill="${skin}"/>
            <path d="${inner}" fill="none" stroke="${shade}" stroke-width="2" stroke-linecap="round"/>`;
  }).join("");
}

// Lashes: where each eye drawing's outer corner is (outwards, down from the eye line), and
// whether they point up (open eyes) or down (closed ones). Matches drawEye in placeholder-art.js.
const LASH_ANCHORS = {
  open: [6, -4, "up"], wide: [9.5, -5, "up"], rolled: [9.5, -5, "up"], teary: [7, -4, "up"],
  closed: [9, 0.5, "down"], happy: [9, 3, "up"], narrow: [10, -2, "up"], bored: [11, 0, "up"],
  side: [12, 0, "up"], sideGlance: [13, -4, "up"], squeezed: [8, -7, "up"],
};

function drawLashes(cx, type, color) {
  const [dx, dy, dir] = LASH_ANCHORS[type] || LASH_ANCHORS.open;
  const out = cx < 100 ? -1 : 1;
  const x = cx + out * dx;
  const y = EYE_Y + dy;
  const v = dir === "up" ? -1 : 1;
  return `<path d="M${fmt(x)} ${fmt(y)} l${fmt(out * 4.5)} ${fmt(v * 2.2)} M${fmt(x - out * 1.5)} ${fmt(y + v * 1)} l${fmt(out * 3)} ${fmt(v * 4.2)}"
            fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
}

// Where the top of each mouth drawing is in the middle (for buck teeth).
const MOUTH_TOPS = {
  smile: 138, grin: 128, flat: 136, smirk: 136, frown: 134, shout: 129, yell: 125, smugGrin: 134,
  meh: 137, tongue: 137, laugh: 126, wobbly: 135,
};

function drawBuckTeeth(mouth, line) {
  const y = (MOUTH_TOPS[mouth] || MOUTH_TOPS.smile) - 1;
  return `<g fill="#ffffff" stroke="${line}" stroke-width="1.3" stroke-linejoin="round">
            <path d="M94.5 ${y} L99.6 ${y} L99.6 ${y + 8} Q97 ${y + 9.5} 94.5 ${y + 8}Z"/>
            <path d="M100.4 ${y} L105.5 ${y} L105.5 ${y + 8} Q103 ${y + 9.5} 100.4 ${y + 8}Z"/>
          </g>`;
}

// A unibrow: the inner ends of both brows joined, so it follows the pose's brow shape.
function drawUnibrow(type, color, geo) {
  const [left, right] = Array.isArray(type) ? type : [type, type];
  const leftInner = (BROW_SHAPES[left] || BROW_SHAPES.flat)[1] + geo.browDy;
  const rightInner = (BROW_SHAPES[right] || BROW_SHAPES.flat)[1] + geo.browDy;
  return `<path d="M${geo.eyeL + 10} ${leftInner} Q100 ${Math.min(leftInner, rightInner) - 2} ${geo.eyeR - 10} ${rightInner}"
            fill="none" stroke="${color}" stroke-width="${geo.browWidth}" stroke-linecap="round"/>`;
}

// Very dark skin (tones 8–10) makes the near-black lines of the eyes, brows and mouth hard to
// see. No outline (it looked odd): the lines become pure black and a little thicker, and the
// inside of open mouths a brighter red. Eye whites stay as they are.
function darkSkinFace(markup) {
  return markup
    .replace(/(stroke|fill)="#222"/g, '$1="#000"')
    .replace(/stroke-width="([\d.]+)"/g, (match, w) => `stroke-width="${fmt(Number(w) * 1.15)}"`)
    .replace(/#6b1f1f/g, "#9c2b2b")
    .replace(/#5a1414/g, "#8a2222");
}

// The look's parts for its gender (cleanLook makes sure every value exists).
function lookParts(look) {
  const gender = look.gender;
  const face = optionById("face", look.face, gender);
  return {
    gender: optionById("gender", gender),
    skin: optionById("skin", look.skin).color,
    hair: optionById("hairColor", look.hairColor).color,
    hairStyle: optionById("hairStyle", look.hairStyle, gender),
    face,
    head: HEAD_SHAPES[face.head],
    outfit: optionById("outfit", look.outfit, gender),
    eyewear: optionById("eyewear", look.eyewear, gender),
    earrings: optionById("earrings", look.earrings, gender),
    necklace: optionById("necklace", look.necklace, gender),
    facialHair: optionById("facialHair", look.facialHair, gender),
  };
}

// The SVG markup of a look in a personality's pose. view: a key of AVATAR_VIEWS.
function avatarSvg(rawLook, personality, pose, view = "full") {
  const look = cleanLook(rawLook);
  const p = lookParts(look);
  const { skin, hair, face, head, hairStyle, outfit } = p;
  const skinShade = mixColor(skin, "#000000", 0.22);
  const dark = luminance(skin) < 0.12;
  const brow = dark && luminance(hair) < 0.05 ? "#000000" : browColor(hair);
  const geo = faceGeometry(face);
  const nw = p.gender.neckWidth;

  const expression =
    (ART_EXPRESSIONS[personality] || ART_EXPRESSIONS.kind)[pose] || ART_EXPRESSIONS.kind.initial;
  const [leftEye, rightEye] = Array.isArray(expression.eyes) ? expression.eyes : [expression.eyes, expression.eyes];
  const extras = expression.extras || [];

  const hairColors = {
    hair,
    shade: mixColor(hair, "#000000", 0.3),
    light: mixColor(hair, "#ffffff", 0.35),
    fade: mixColor(hair, skin, 0.5),
  };
  const hairMove = hairTransform(head);
  const lashColor = dark ? "#000" : "#222";
  const eye = (cx, type) => {
    const inner = drawEye(cx, type) + (face.lashes ? drawLashes(cx, type, lashColor) : "");
    return geo.eyeScale === 1
      ? inner
      : `<g transform="translate(${cx} ${EYE_Y}) scale(${geo.eyeScale}) translate(${-cx} ${-EYE_Y})">${inner}</g>`;
  };
  let mouth = drawMouth(expression.mouth);
  if (face.lip) mouth = mouth.replace(/stroke="#222"/g, `stroke="${dark ? "#5e1a2a" : "#a8465a"}"`);
  let features = `${drawBrows(expression.brows, brow, geo)}
    ${face.unibrow ? drawUnibrow(expression.brows, brow, geo) : ""}
    ${eye(geo.eyeL, leftEye)}
    ${eye(geo.eyeR, rightEye)}
    ${mouth}
    ${face.buckTeeth ? drawBuckTeeth(expression.mouth, "#222") : ""}
    ${extras.filter((name) => FACE_EXTRAS.includes(name)).map((name) => ART_EXTRAS[name](skin, geo)).join("")}`;
  if (dark) features = darkSkinFace(features);
  const nose = avatarLayer("nose", face.nose, NOSES[face.nose].draw(skinShade, skin), "", "skin");
  // Smaller features (a funny face): nose, eyes, brows and mouth shrink around the face's middle.
  const faceGroup = face.featureScale
    ? `<g transform="translate(100 118) scale(${face.featureScale}) translate(-100 -118)">${nose}${features}</g>`
    : `${nose}${features}`;

  const outfitColors = { skin, nw };
  const outfitPng = avatarPngData.has(`outfit/${outfit.id}`);
  // Hair that covers the ears hides studs; hoops and drops hang below it and stay visible.
  const earringsShown = !(hairStyle.coversEars && p.earrings.stud);
  const ears = avatarLayer("ears", face.ears, drawEars(head, face.ears, skin, skinShade), "", "skin");

  const defs = [
    `<clipPath id="headClip"><path d="${head.path}"/></clipPath>`,
    `<clipPath id="bodyClip"><path d="${p.gender.body}"/></clipPath>`,
    // A PNG outfit includes its collar, so it may also cover the area around the neck.
    outfitPng ? `<clipPath id="outfitClip"><path d="${p.gender.body}"/><rect x="70" y="140" width="60" height="60"/></clipPath>` : "",
  ];
  if (avatarPngData.size > 0) {
    defs.push(tintFilter("tint-skin", skin), tintFilter("tint-hair", hair), tintFilter("tint-brow", brow));
  }

  const parts = [
    avatarLayer("hair-back", hairStyle.id, hairStyle.back ? hairStyle.back(hairColors) : "", hairMove, "hair"),
    avatarLayer("body", p.gender.id, `<path d="${p.gender.body}" fill="${skin}"/>`, "", "skin"),
    avatarLayer("neck", p.gender.id, `<rect x="${100 - nw / 2}" y="140" width="${nw}" height="40" fill="${skin}"/>`, "", "skin"),
    outfitPng
      ? `<g clip-path="url(#outfitClip)">${avatarLayer("outfit", outfit.id, "")}</g>`
      : `<g clip-path="url(#bodyClip)">${outfit.body(outfitColors)}</g>${outfit.collar ? outfit.collar(outfitColors) : ""}`,
    avatarLayer("necklace", p.necklace.id, p.necklace.draw(nw)),
    face.earsOnTop ? "" : ears,
    avatarLayer("head", face.head, `<path d="${head.path}" fill="${skin}"/>`, "", "skin"),
    extras.includes("red") ? `<path d="${head.path}" fill="#ff2d2d" fill-opacity="0.3"/>` : "",
    face.marks.map((mark) => avatarLayer("marks", mark, MARKS[mark].draw(geo, skinShade))).join(""),
    p.facialHair ? avatarLayer("facial-hair", p.facialHair.id, p.facialHair.draw(brow, head), "", "brow") : "",
    avatarLayer("eyewear-arms", p.eyewear.id, p.eyewear.arms(geo, head.halfW)),
    avatarLayer("hair-front", hairStyle.id, hairStyle.front(hairColors), hairMove, "hair"),
    // Giant ears (a funny face) stick out of any hair, so they're drawn over it.
    face.earsOnTop ? ears : "",
    faceGroup,
    earringsShown ? avatarLayer("earrings", p.earrings.id, p.earrings.draw(earGeometry(head, face.ears))) : "",
    avatarLayer("eyewear", p.eyewear.id, p.eyewear.draw(geo, head.halfW)),
    extras.filter((name) => ART_EXTRAS[name] && !FACE_EXTRAS.includes(name)).map((name) => ART_EXTRAS[name](skin, geo)).join(""),
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${AVATAR_VIEWS[view] || AVATAR_VIEWS.full}">
    <defs>${defs.join("")}</defs>
    ${parts.join("\n")}
  </svg>`;
}

// Returns a data: URL, like placeholderArt. Cached per look, personality, pose and view.
function avatarArt(look, personality, pose, view = "full") {
  const key = `${LOOK_FIELDS.map((field) => look && look[field]).join("|")}/${personality}/${pose}/${view}`;
  const cached = avatarArtCache.get(key);
  if (cached) return cached;
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(avatarSvg(look, personality, pose, view));
  if (avatarArtCache.size >= AVATAR_ART_CACHE_MAX) avatarArtCache.clear();
  avatarArtCache.set(key, url);
  return url;
}

// The ids inside one drawing (clip paths and filters). Two drawings in the same page would share
// them, so a drawing put straight into a page gets its own prefix (avatarInlineSvg).
const AVATAR_SVG_IDS = /(id="|url\(#)(headClip|bodyClip|outfitClip|tint-skin|tint-hair|tint-brow)\b/g;

// The same drawing as SVG markup to put straight into the page (the editor's thumbnails): much
// quicker for the browser to update than a separate image each. Hidden from screen readers.
function avatarInlineSvg(look, personality, pose, view, prefix) {
  return avatarSvg(look, personality, pose, view)
    .replace(AVATAR_SVG_IDS, `$1${prefix}$2`)
    .replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
}

// The "Create your own" card: a neutral grey figure with a question mark.
function createCardArt() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
    <path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#b9b4ad"/>
    <rect x="84" y="140" width="32" height="40" fill="#cfcac3"/>
    <ellipse cx="100" cy="105" rx="54" ry="60" fill="#cfcac3"/>
    <path d="M86 92 Q86 74 100 74 Q116 74 116 90 Q116 100 106 105 Q100 108 100 118" fill="none" stroke="#7d776f" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="100" cy="136" r="6" fill="#7d776f"/>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
