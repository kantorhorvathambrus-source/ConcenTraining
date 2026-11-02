// Draws a custom character from its look (avatar-parts.js), in layers on one 200 × 240 canvas.
// The expression (eyes, brows, mouth, extras) is the shared one from placeholder-art.js, so every
// face works in all 9 poses of all 4 personalities.
//
// Layers, back to front:
//   hair-back, body (skin), neck, outfit (inside the body's outline, plus its collar), necklace,
//   ears, head, nose, marks, facial hair, hair-front, eyes / brows / mouth, earrings, eyewear,
//   extras (sparkle, tears, the hands…).
// Ears sit behind the head, and facial hair and hair under the eyes and mouth, so the
// expression always shows. Any layer listed in AVATAR_PNG_FILES is drawn from its PNG instead of
// SVG (see layer below); skin and hair layers are coloured by code (see tintFilter).

// Images loaded from AVATAR_PNG_FILES, as data: URLs (an SVG shown in an <img> can't load other
// files, so they're written into it).
const avatarPngData = new Map();
const avatarArtCache = new Map();
const AVATAR_ART_CACHE_MAX = 800;

// The visible part of the canvas: the whole character, or the head only (editor thumbnails).
const AVATAR_VIEWS = { full: "0 0 200 240", head: "16 2 168 178" };

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

// Hair is drawn for the reference head (top 45, half-width 54): moved to this head's top and
// stretched to its width.
function hairTransform(head) {
  if (head.top === 45 && head.halfW === 54) return "";
  return `translate(100 ${head.top}) scale(${(head.halfW / 54).toFixed(3)} 1) translate(-100 -45)`;
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

// Very dark skin hides the dark lines of the eyes, brows and mouth: they get a thin, soft light outline.
function liftFilter(skin) {
  return `<filter id="lift" x="-20%" y="-20%" width="140%" height="140%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="wide"/>
            <feFlood flood-color="${mixColor(skin, "#ffffff", 0.5)}" flood-opacity="0.55"/>
            <feComposite in2="wide" operator="in" result="outline"/>
            <feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>`;
}

// The SVG markup of a look in a personality's pose. view: a key of AVATAR_VIEWS.
function avatarSvg(rawLook, personality, pose, view = "full") {
  const look = cleanLook(rawLook);
  const gender = optionById("gender", look.gender);
  const skin = optionById("skin", look.skin).color;
  const skinShade = mixColor(skin, "#000000", 0.22);
  const hair = optionById("hairColor", look.hairColor).color;
  const brow = browColor(hair);
  const hairStyle = optionById("hairStyle", look.hairStyle);
  const face = optionById("face", look.face);
  const head = HEAD_SHAPES[face.head];
  const outfit = optionById("outfit", look.outfit);
  const geo = faceGeometry(face);
  const nw = gender.neckWidth;

  const expression =
    (ART_EXPRESSIONS[personality] || ART_EXPRESSIONS.kind)[pose] || ART_EXPRESSIONS.kind.initial;
  const [leftEye, rightEye] = Array.isArray(expression.eyes) ? expression.eyes : [expression.eyes, expression.eyes];
  const extras = expression.extras || [];
  const lift = luminance(skin) < 0.12;

  const hairColors = { hair, shade: mixColor(hair, "#000000", 0.3) };
  const hairMove = hairTransform(head);
  const eye = (cx, type) =>
    geo.eyeScale === 1
      ? drawEye(cx, type)
      : `<g transform="translate(${cx} ${EYE_Y}) scale(${geo.eyeScale}) translate(${-cx} ${-EYE_Y})">${drawEye(cx, type)}</g>`;
  const outfitColors = { skin, nw };
  const outfitPng = avatarPngData.has(`outfit/${outfit.id}`);

  const defs = [
    `<clipPath id="headClip"><path d="${head.path}"/></clipPath>`,
    `<clipPath id="bodyClip"><path d="${gender.body}"/></clipPath>`,
    // A PNG outfit includes its collar, so it may also cover the area around the neck.
    outfitPng ? `<clipPath id="outfitClip"><path d="${gender.body}"/><rect x="70" y="140" width="60" height="60"/></clipPath>` : "",
    lift ? liftFilter(skin) : "",
  ];
  if (avatarPngData.size > 0) {
    defs.push(tintFilter("tint-skin", skin), tintFilter("tint-hair", hair), tintFilter("tint-brow", brow));
  }

  const parts = [
    avatarLayer("hair-back", hairStyle.id, hairStyle.back ? hairStyle.back(hairColors) : "", hairMove, "hair"),
    avatarLayer("body", gender.id, `<path d="${gender.body}" fill="${skin}"/>`, "", "skin"),
    avatarLayer("neck", gender.id, `<rect x="${100 - nw / 2}" y="140" width="${nw}" height="40" fill="${skin}"/>`, "", "skin"),
    outfitPng
      ? `<g clip-path="url(#outfitClip)">${avatarLayer("outfit", outfit.id, "")}</g>`
      : `<g clip-path="url(#bodyClip)">${outfit.body(outfitColors)}</g>${outfit.collar ? outfit.collar(outfitColors) : ""}`,
    avatarLayer("necklace", look.necklace, optionById("necklace", look.necklace).draw(nw)),
    avatarLayer("ears", face.ears, drawEars(head, face.ears, skin, skinShade), "", "skin"),
    avatarLayer("head", face.head, `<path d="${head.path}" fill="${skin}"/>`, "", "skin"),
    extras.includes("red") ? `<path d="${head.path}" fill="#ff2d2d" fill-opacity="0.3"/>` : "",
    avatarLayer("nose", face.nose, NOSES[face.nose].draw(skinShade), "", "skin"),
    face.marks.map((mark) => avatarLayer("marks", mark, MARKS[mark].draw(geo, skinShade))).join(""),
    avatarLayer("facial-hair", look.facialHair, optionById("facialHair", look.facialHair).draw(brow, head), "", "brow"),
    avatarLayer("hair-front", hairStyle.id, hairStyle.front(hairColors), hairMove, "hair"),
    `<g${lift ? ` filter="url(#lift)"` : ""}>
       ${drawBrows(expression.brows, brow, geo)}
       ${eye(geo.eyeL, leftEye)}
       ${eye(geo.eyeR, rightEye)}
       ${drawMouth(expression.mouth)}
     </g>`,
    avatarLayer("earrings", look.earrings, optionById("earrings", look.earrings).draw(earGeometry(head, face.ears))),
    avatarLayer("eyewear", look.eyewear, optionById("eyewear", look.eyewear).draw(geo, head.halfW)),
    extras.filter((name) => ART_EXTRAS[name]).map((name) => ART_EXTRAS[name](skin, geo)).join(""),
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
const AVATAR_SVG_IDS = /(id="|url\(#)(headClip|bodyClip|outfitClip|lift|tint-skin|tint-hair|tint-brow)\b/g;

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
