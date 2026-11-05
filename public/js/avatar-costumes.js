// Costumes for custom characters: headwear, masks and face paint, costume beards, ears and horns,
// costume outfits, things on the back, held items and shoulder pets, plus ready-made costume sets
// (COSTUME_PRESETS). All lists are shared by both genders and start with None. Loaded after
// avatar-parts.js (it adds the costume fields to LOOK_FIELDS, SHARED_OPTIONS and DEFAULT_LOOKS) and
// before avatar-art.js, which draws them (see "Costumes" and "Avatar art guide" in the README).
//
// Adding an item = one entry in its list (and, optionally, a PNG listed in AVATAR_PNG_FILES).
// An entry with no drawing and no listed PNG isn't offered. What an entry can have:
//   id ("c-…", never reused), label (screen readers and the editor),
//   tags / clashes: an item clashes with another one when one's clashes name a tag of the other.
//     Randomize never combines clashing items; the editor allows everything. The base look also has
//     tags: "eyewear", "earrings", "necklace" and "facialHair" when that isn't None.
// Each list's own fields are described above it. ctx (what every drawing gets):
//   { skin, skinShade, hair: { hair, shade, light, fade }, brow, geo (faceGeometry), head (HEAD_SHAPES),
//     face, gender ("female" / "male"), nw (neck width), ear (earGeometry), mouth (the pose's mouth),
//     shoulder: { x, y } (the right shoulder's top, where pets sit), shoulderX (the left shoulder's
//     outer edge at y ≈ 189) }.
//
// Rules for the art: no weapons, no blood, no gore, no logos or letters, nothing copied from a
// film, book or brand, and no real person's portrait. The expression (eyes, brows, mouth) is always
// drawn on top of everything on the face, so all 9 poses read with every item: openings in masks
// show skin (or a light glow), never black, so closed eyes stay visible.

// ---------- small helpers ----------

const COSTUME_LINE = "#2b2b2b";

// A 4-point sparkle.
function sparkle(x, y, s, color) {
  const k = s * 0.3;
  return `<path d="M${fmt(x)} ${fmt(y - s)} L${fmt(x + k)} ${fmt(y - k)} L${fmt(x + s)} ${fmt(y)} L${fmt(x + k)} ${fmt(y + k)} L${fmt(x)} ${fmt(y + s)} L${fmt(x - k)} ${fmt(y + k)} L${fmt(x - s)} ${fmt(y)} L${fmt(x - k)} ${fmt(y - k)}Z" fill="${color}"/>`;
}

// A 5-point star.
function star5(x, y, r, color) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${fmt(x + rr * Math.cos(a))} ${fmt(y + rr * Math.sin(a))}`);
  }
  return `<path d="M${pts.join(" L")}Z" fill="${color}"/>`;
}

// The left and the right version of a shape: draw(s) gets -1 (left) and 1 (right).
const bothSides = (draw) => draw(-1) + draw(1);

// A fist holding something (the character's own hand, in its skin tone), like the built-in
// Influencer's phone hand. x, y: its top left corner.
const fist = (ctx, x = 24, y = 200) => `<rect x="${x}" y="${y}" width="38" height="24" rx="11" fill="${ctx.skin}" stroke="#222" stroke-width="2"/>
  <path d="M${x + 5} ${y + 9} L${x + 33} ${y + 9}" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/>`;

// White fur with small black tails (royal robes).
const ermineSpots = (points) => `<g fill="#1b1b1b">${points.map(([x, y]) => `<path d="M${x} ${y} l-2 6 l2 -1.5 l2 1.5Z"/>`).join("")}</g>`;

// The widest part of a head's face (giant cheeks are wider than the temples).
const faceHalfW = (head) => Math.max(head.halfW, head.cheekW || 0);

// A 5-point star's outline (for frames and fills).
function starPath(x, y, r, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    pts.push(`${fmt(x + rr * Math.cos(a))} ${fmt(y + rr * Math.sin(a))}`);
  }
  return `M${pts.join(" L")}Z`;
}

// The half-width of a head's top half (an ellipse above the temple line) at height y.
function headHalfAt(head, y) {
  const cy = head.cy || HEAD_CY;
  const t = (cy - y) / (cy - head.top);
  return head.halfW * Math.sqrt(Math.max(0, 1 - t * t));
}

// Horizontal bands between two edges (inner(y), outer(y): x at height y), from y0 to y1, every
// other band filled: the stripes of a striped headdress.
function bandsBetween(inner, outer, y0, y1, count, fill) {
  const h = (y1 - y0) / count;
  let d = "";
  for (let i = 1; i < count; i += 2) {
    const a = y0 + i * h;
    const b = a + h;
    d += `M${fmt(inner(a))} ${fmt(a)} L${fmt(outer(a))} ${fmt(a)} L${fmt(outer(b))} ${fmt(b)} L${fmt(inner(b))} ${fmt(b)}Z `;
  }
  return `<path d="${d}" fill="${fill}"/>`;
}

// A hood around the face (fit: "none"): the outside, with the face opening cut out. opening:
// how far below the crown the opening starts. tip: a pointed top (the dwarf hood), x of the tip.
// drop: how far below the chin the hood's sides reach (a shorter one doesn't lie on the shoulders).
// topPad: the room over the crown (pad by default; smaller for a hood that's snug on top).
function hoodShape(head, { pad = 15, opening = 8, chinPad = 2, tip = 0, drop = 34, topPad = pad } = {}) {
  const w = faceHalfW(head);
  const cy = head.cy || HEAD_CY;
  const top = tip
    ? `Q${fmt(100 - w - pad + 2)} ${fmt(head.top - 6)} ${tip} ${fmt(Math.max(4, head.top - 30))} Q${fmt(100 + w + pad - 6)} ${fmt(head.top - 4)} ${fmt(100 + w + pad)} ${cy}`
    : `A${fmt(w + pad)} ${fmt(cy - head.top + topPad)} 0 0 1 ${fmt(100 + w + pad)} ${cy}`;
  const oTop = head.top + opening;
  const oBottom = head.chin + chinPad;
  const hole = ellipsePath(100, (oTop + oBottom) / 2, w - 3, (oBottom - oTop) / 2);
  return {
    outer: `M${fmt(100 - w - pad - 3)} ${fmt(head.chin + drop)} L${fmt(100 - w - pad)} ${cy} ${top} L${fmt(100 + w + pad + 3)} ${fmt(head.chin + drop)} Q100 ${fmt(head.chin + drop + 16)} ${fmt(100 - w - pad - 3)} ${fmt(head.chin + drop)}Z`,
    hole,
    inside: ellipsePath(100, (oTop + oBottom) / 2 + 2, w + 4, (oBottom - oTop) / 2 + 6),
  };
}
// The ninja-style hood: tight around the head, opening from the brows, ending under the chin.
// Wide enough at the sides to cover large ears, snug over the crown.
const NINJA_HOOD = { pad: 11, topPad: 3, opening: 26, chinPad: 4, drop: 10 };
const hoodDraw = (shape, fill, line) => `<path d="${shape.outer} ${shape.hole}" fill="${fill}" fill-rule="evenodd"/>
  <path d="${shape.hole}" fill="none" stroke="${line}" stroke-width="3"/>`;

// A point on a quadratic curve (for leaves along a stem).
const quadAt = (p0, p1, p2, t) => [
  (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
  (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
];

// ---------- headwear ----------
// Drawn for the reference head (crown y = 45, temples x = 46 / 154 at y = 105, like hair), except
// fit: "none" (drawn straight onto the canvas from ctx.head's numbers).
//   fit: "head" (default): moved and scaled onto each head exactly like hair (hairTransform), for
//     hats that hug the head. They must not reach more than 18 px above the crown (y ≥ 27), so they
//     stay inside the picture on the tallest head.
//   fit: "upright": placed on the hat band of each head, as wide as the head there, never stretched
//     taller, and flattened only as much as needed to stay inside the picture. For tall hats.
//     height: how far the hat reaches above its band.
//   band: the hat band's height on the reference head. Hair above it is hidden (only its sides
//     and back below the band show), so every hat fits every hairstyle.
//   hair: "clip" (default, see band), "keep" (sits on the hair: crowns, halos) or "hide" (hoods,
//     helmets, pumpkin head: no hair at all).
//   behind(ctx): a part behind the head (over the body), e.g. a hood's inside. draw(ctx): the hat,
//     over the hair. face(ctx): openings drawn under the eyes and mouth, in canvas coordinates
//     (moved with a funny face's smaller features).
//   coversHead: covers the whole head (the nose isn't drawn). hidesEarrings: earrings aren't drawn.
//   mouthOnCloth: the mouth is drawn on cloth (the ninja-style mask), so a face's lip tint is left
//     out there: the plain dark line reads on it.

const NO_HEADWEAR = { id: "c-no-headwear", label: "No headwear", draw: () => "" };

const HEADWEAR = [
  NO_HEADWEAR,
  {
    id: "c-bicorne", label: "Bicorne (general's hat)", fit: "upright", band: 70, height: 50, tags: ["hat"],
    draw: () => `<path d="M30 74 Q16 68 22 56 Q46 34 100 22 Q154 34 178 56 Q184 68 170 74 Q100 60 30 74Z" fill="#1e1f26"/>
      <path d="M30 74 Q100 60 170 74" fill="none" stroke="#c9a227" stroke-width="3"/>
      <path d="M22 56 Q46 34 100 22 Q154 34 178 56" fill="none" stroke="#c9a227" stroke-width="2.5"/>
      <circle cx="100" cy="47" r="9" fill="#c9a227"/><circle cx="100" cy="47" r="5" fill="#8c1d1d"/>`,
  },
  {
    id: "c-tricorne", label: "Tricorne (pirate hat)", fit: "upright", band: 70, height: 46, tags: ["hat"],
    draw: () => `<path d="M26 76 Q28 50 52 52 Q72 28 100 26 Q128 28 148 52 Q172 50 174 76 Q138 62 100 72 Q62 62 26 76Z" fill="#2a2124"/>
      <path d="M26 76 Q62 62 100 72 Q138 62 174 76" fill="none" stroke="#c9a227" stroke-width="3" stroke-linejoin="round"/>
      <path d="M52 52 Q62 62 100 60 Q138 62 148 52" fill="none" stroke="#45383c" stroke-width="2"/>
      <circle cx="64" cy="58" r="5" fill="#c9a227"/>`,
  },
  {
    id: "c-santa-hat", label: "Santa-style hat", fit: "upright", band: 72, height: 56, tags: ["hat"],
    draw: () => `<path d="M46 68 Q54 24 104 18 Q148 16 168 54 Q170 62 162 68Z" fill="#d42a2a"/>
      <path d="M118 22 Q150 26 164 54 L158 62 Q146 36 114 28Z" fill="#a81f1f"/>
      <rect x="40" y="62" width="120" height="18" rx="9" fill="#f6f6f6"/>
      <path d="M48 74 Q100 70 152 74" fill="none" stroke="#dcdcdc" stroke-width="2"/>
      <circle cx="166" cy="62" r="10" fill="#f6f6f6"/>`,
  },
  {
    id: "c-witch-hat", label: "Witch hat", fit: "upright", band: 70, height: 66, tags: ["hat"],
    draw: () => `<ellipse cx="100" cy="70" rx="78" ry="11" fill="#2b2233"/>
      <path d="M56 70 Q74 40 96 14 Q102 4 114 6 Q108 12 108 20 Q122 44 144 70Z" fill="#2b2233"/>
      <path d="M60 66 Q100 74 140 66 L135 55 Q100 62 65 55Z" fill="#7b3fa0"/>
      <rect x="92" y="56" width="16" height="12" rx="1.5" fill="none" stroke="#e1b93a" stroke-width="2.5"/>
      <path d="M26 73 Q100 88 174 73" fill="none" stroke="#43384f" stroke-width="2"/>`,
  },
  {
    id: "c-wizard-hat", label: "Wizard hat", fit: "upright", band: 70, height: 66, tags: ["hat"],
    draw: () => `<ellipse cx="100" cy="70" rx="70" ry="10" fill="#2f4aa0"/>
      <path d="M54 70 Q82 44 98 6 Q106 32 146 70Z" fill="#3a5bc4"/>
      ${star5(84, 50, 6, "#f5d34a")}${star5(112, 38, 4.5, "#f5d34a")}${star5(118, 60, 4, "#f5d34a")}
      <path d="M94 24 A7 7 0 1 0 102 34 A5.5 5.5 0 1 1 94 24Z" fill="#f5d34a"/>`,
  },
  {
    id: "c-crown", label: "Crown", fit: "upright", band: 54, height: 30, hair: "keep", tags: ["hat"],
    draw: () => `<path d="M64 56 L62 28 L80 42 L90 22 L100 38 L110 22 L120 42 L138 28 L136 56Z" fill="#e2b33a" stroke="#a7811f" stroke-width="2" stroke-linejoin="round"/>
      <rect x="62" y="50" width="76" height="9" rx="2" fill="#c99a25"/>
      <circle cx="100" cy="54.5" r="3.6" fill="#c0392b"/><circle cx="80" cy="54.5" r="3" fill="#2f6fd6"/><circle cx="120" cy="54.5" r="3" fill="#2f6fd6"/>
      <g fill="#fffaf0"><circle cx="62" cy="27" r="3"/><circle cx="90" cy="21" r="3"/><circle cx="110" cy="21" r="3"/><circle cx="138" cy="27" r="3"/></g>`,
  },
  {
    id: "c-tiara", label: "Tiara", fit: "upright", band: 60, height: 20, hair: "keep", tags: ["hat"],
    draw: () => `<path d="M64 64 Q100 48 136 64" fill="none" stroke="#cfd6de" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M78 58 L85 47 L92 55 L100 40 L108 55 L115 47 L122 58" fill="none" stroke="#cfd6de" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="100" cy="51" r="3.8" fill="#7fc8f0"/><circle cx="85" cy="54" r="2.2" fill="#f2a7c3"/><circle cx="115" cy="54" r="2.2" fill="#f2a7c3"/>`,
  },
  {
    id: "c-jester-hat", label: "Jester hat", fit: "upright", band: 72, height: 66, tags: ["hat"],
    draw: () => `<path d="M54 58 Q30 48 22 26 Q48 30 74 44Z" fill="#e8b832"/>
      <path d="M146 58 Q170 48 178 26 Q152 30 126 44Z" fill="#e8b832"/>
      <path d="M82 42 Q94 24 100 12 Q106 24 118 42Z" fill="#d23c3c"/>
      <path d="M46 74 Q46 50 70 42 Q86 38 100 38 L100 72Z" fill="#d23c3c"/>
      <path d="M154 74 Q154 50 130 42 Q114 38 100 38 L100 72Z" fill="#e8b832"/>
      <path d="M44 78 Q100 64 156 78 L154 66 Q100 54 46 66Z" fill="#f1e3c0"/>
      <g fill="#e1a91f" stroke="#a7811f" stroke-width="1.5"><circle cx="22" cy="27" r="6"/><circle cx="178" cy="27" r="6"/><circle cx="100" cy="12" r="6"/></g>`,
  },
  {
    id: "c-knight-helmet", label: "Knight helmet (open face)", fit: "none", hair: "hide", hidesEarrings: true,
    tags: ["hat"], clashes: ["ears", "earrings"],
    draw: ({ head }) => {
      const w = faceHalfW(head) + 13;
      const cy = head.cy || HEAD_CY;
      const oy = (head.top + head.chin) / 2 + 8;
      const ry = (head.chin - head.top) / 2 - 4;
      const ow = faceHalfW(head) - 8;
      return `<path d="M${fmt(100 - w)} ${cy} A${fmt(w)} ${fmt(cy - head.top + 9)} 0 0 1 ${fmt(100 + w)} ${cy} L${fmt(100 + w + 4)} ${fmt(head.chin + 12)} Q100 ${fmt(head.chin + 28)} ${fmt(100 - w - 4)} ${fmt(head.chin + 12)}Z
              ${ellipsePath(100, oy, ow, ry)}" fill="#9aa3ad" fill-rule="evenodd" stroke="#6f7882" stroke-width="2"/>
        <path d="M100 ${fmt(head.top - 8)} L100 ${fmt(head.top + 10)}" stroke="#6f7882" stroke-width="3" stroke-linecap="round"/>
        <path d="M${fmt(100 - w + 6)} ${fmt(head.chin - 6)} Q100 ${fmt(head.chin + 18)} ${fmt(100 + w - 6)} ${fmt(head.chin - 6)}" fill="none" stroke="#7d8690" stroke-width="2" stroke-dasharray="3 2"/>
        <g fill="#6f7882">${[-1, 1].map((s) => `<circle cx="${fmt(100 + s * (w - 6))}" cy="${cy}" r="2.5"/><circle cx="${fmt(100 + s * (w - 5))}" cy="${cy + 18}" r="2.5"/>`).join("")}</g>`;
    },
  },
  {
    id: "c-top-hat", label: "Top hat", fit: "upright", band: 70, height: 62, tags: ["hat"],
    draw: () => `<path d="M62 68 L64 14 Q100 6 136 14 L138 68Z" fill="#1d1d22"/>
      <path d="M63 52 L137 52 L137.5 64 L62.5 64Z" fill="#7a1f2b"/>
      <ellipse cx="100" cy="69" rx="64" ry="9" fill="#26262c"/>
      <path d="M70 18 L70 50" stroke="#3a3a42" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "c-cowboy-hat", label: "Cowboy hat", fit: "upright", band: 70, height: 46, tags: ["hat"],
    draw: () => `<path d="M60 66 Q56 32 80 26 Q100 34 120 26 Q144 32 140 66Z" fill="#9c6a3a"/>
      <path d="M60 58 Q100 64 140 58 L140 66 Q100 72 60 66Z" fill="#5b3a1e"/>
      <path d="M18 64 Q26 80 100 80 Q174 80 182 64 Q172 56 160 62 Q100 74 40 62 Q28 56 18 64Z" fill="#8a5a2e"/>
      <path d="M86 32 Q100 40 114 32" fill="none" stroke="#7a5028" stroke-width="2"/>`,
  },
  {
    id: "c-captain-hat", label: "Captain's hat", fit: "upright", band: 72, height: 40, tags: ["hat"],
    draw: () => `<ellipse cx="100" cy="50" rx="60" ry="17" fill="#f7f7f5"/>
      <path d="M46 52 L50 74 L150 74 L154 52 Q100 66 46 52Z" fill="#1f2a44"/>
      <path d="M50 66 L150 66" stroke="#d9ae35" stroke-width="3"/>
      <path d="M50 72 Q100 96 150 72 Q100 82 50 72Z" fill="#111"/>
      <path d="M93 52 Q100 46 107 52 L104 62 L96 62Z" fill="#d9ae35"/>`,
  },
  {
    id: "c-chef-toque", label: "Chef's toque", fit: "upright", band: 74, height: 66, tags: ["hat"],
    draw: () => `<g fill="#fbfbf9" stroke="#dcdcd6" stroke-width="2">
        <circle cx="70" cy="40" r="20"/><circle cx="130" cy="40" r="20"/><circle cx="100" cy="30" r="24"/><circle cx="84" cy="22" r="14"/><circle cx="118" cy="22" r="14"/>
      </g>
      <rect x="54" y="44" width="92" height="30" rx="4" fill="#fbfbf9" stroke="#dcdcd6" stroke-width="2"/>
      <path d="M70 46 L70 72 M85 46 L85 72 M100 46 L100 72 M115 46 L115 72 M130 46 L130 72" stroke="#e6e6e0" stroke-width="2"/>`,
  },
  {
    id: "c-grad-cap", label: "Graduation cap", fit: "upright", band: 74, height: 52, tags: ["hat"],
    draw: () => `<path d="M48 76 Q50 46 100 44 Q150 46 152 76 Q100 64 48 76Z" fill="#1f2433"/>
      <path d="M100 24 L178 40 L100 56 L22 40Z" fill="#2b3145" stroke="#1a1e2b" stroke-width="2" stroke-linejoin="round"/>
      <path d="M100 40 L160 48 L160 76" fill="none" stroke="#e1b93a" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M155 74 L165 74 L163 88 L157 88Z" fill="#e1b93a"/>
      <circle cx="100" cy="40" r="3" fill="#e1b93a"/>`,
  },
  {
    id: "c-hood", label: "Hood", fit: "none", hair: "hide", hidesEarrings: true, tags: ["hat"], clashes: ["ears", "earrings"],
    behind: ({ head }) => {
      const w = faceHalfW(head);
      return `<path d="${ellipsePath(100, (head.top + head.chin) / 2 + 10, w + 4, (head.chin - head.top) / 2 + 8)}" fill="#24331f"/>`;
    },
    draw: ({ head }) => {
      const w = faceHalfW(head);
      const cy = head.cy || HEAD_CY;
      return `<path d="M${fmt(100 - w - 18)} ${fmt(head.chin + 34)} L${fmt(100 - w - 15)} ${cy} A${fmt(w + 15)} ${fmt(cy - head.top + 15)} 0 0 1 ${fmt(100 + w + 15)} ${cy} L${fmt(100 + w + 18)} ${fmt(head.chin + 34)} Q100 ${fmt(head.chin + 50)} ${fmt(100 - w - 18)} ${fmt(head.chin + 34)}Z
              ${ellipsePath(100, (head.top + head.chin) / 2 + 10, w - 3, (head.chin - head.top) / 2 + 2)}" fill="#3f5a3a" fill-rule="evenodd"/>
        <path d="${ellipsePath(100, (head.top + head.chin) / 2 + 10, w - 3, (head.chin - head.top) / 2 + 2)}" fill="none" stroke="#2e4229" stroke-width="3"/>`;
    },
  },
  {
    id: "c-pumpkin-head", label: "Pumpkin head", fit: "none", hair: "hide", coversHead: true, hidesEarrings: true,
    tags: ["hat", "fullHead"], clashes: ["mask", "beard", "top", "ears", "eyewear", "earrings", "facialHair", "fullHead"],
    draw: ({ head }) => {
      const w = faceHalfW(head) + 14;
      const cy = (head.top + head.chin) / 2 + 4;
      const ry = (head.chin - head.top) / 2 + 12;
      return `<path d="M96 ${fmt(cy - ry + 4)} Q94 ${fmt(cy - ry - 10)} 104 ${fmt(cy - ry - 14)} L108 ${fmt(cy - ry - 10)} Q102 ${fmt(cy - ry - 6)} 104 ${fmt(cy - ry + 4)}Z" fill="#3f7d2c"/>
        <ellipse cx="100" cy="${fmt(cy)}" rx="${fmt(w)}" ry="${fmt(ry)}" fill="#f08a24"/>
        <g fill="none" stroke="#c9671a" stroke-width="3">
          <ellipse cx="100" cy="${fmt(cy)}" rx="${fmt(w * 0.55)}" ry="${fmt(ry)}"/><ellipse cx="100" cy="${fmt(cy)}" rx="${fmt(w * 0.18)}" ry="${fmt(ry)}"/>
        </g>
        <path d="M108 ${fmt(cy - ry + 2)} Q124 ${fmt(cy - ry - 8)} 128 ${fmt(cy - ry + 4)}" fill="none" stroke="#3f7d2c" stroke-width="3" stroke-linecap="round"/>`;
    },
    // Lit from inside: the eyes and mouth sit in glowing openings, so every pose still reads.
    face: ({ geo }) => `<g fill="#ffd35a">
        ${[geo.eyeL, geo.eyeR].map((x) => `<path d="M${fmt(x - 15)} ${fmt(EYE_Y + 11)} L${fmt(x)} ${fmt(EYE_Y - 15)} L${fmt(x + 15)} ${fmt(EYE_Y + 11)}Z"/>`).join("")}
        <path d="M74 128 L82 134 L88 128 L94 134 L100 128 L106 134 L112 128 L118 134 L126 128 Q122 152 100 152 Q78 152 74 128Z"/>
      </g>`,
  },
  {
    id: "c-halo", label: "Halo", fit: "upright", band: 45, height: 26, hair: "keep", tags: ["band"],
    draw: () => `<ellipse cx="100" cy="26" rx="36" ry="9" fill="none" stroke="#fff3b0" stroke-width="9" stroke-opacity="0.55"/>
      <ellipse cx="100" cy="26" rx="36" ry="9" fill="none" stroke="#f2c230" stroke-width="4.5"/>`,
  },
  {
    id: "c-flower-crown", label: "Flower crown", fit: "upright", band: 62, height: 18, hair: "keep", tags: ["band"],
    draw: () => {
      const flowers = [[56, 64, "#f28cb1"], [70, 56, "#ffffff"], [86, 51, "#f7c948"], [100, 49, "#f28cb1"], [114, 51, "#ffffff"], [130, 56, "#f7c948"], [144, 64, "#f28cb1"]];
      return `<path d="M52 68 Q100 40 148 68" fill="none" stroke="#5a9a47" stroke-width="4" stroke-linecap="round"/>
        ${flowers.map(([x, y]) => `<ellipse cx="${x - 7}" cy="${y + 4}" rx="5" ry="2.6" fill="#5a9a47" transform="rotate(-25 ${x - 7} ${y + 4})"/>`).join("")}
        ${flowers.map(([x, y, c]) => `<g fill="${c}"><circle cx="${x - 3.5}" cy="${y}" r="3.6"/><circle cx="${x + 3.5}" cy="${y}" r="3.6"/><circle cx="${x}" cy="${y - 3.5}" r="3.6"/><circle cx="${x}" cy="${y + 3.5}" r="3.6"/></g><circle cx="${x}" cy="${y}" r="2.4" fill="#e09a1f"/>`).join("")}`;
    },
  },
  {
    id: "c-beret", label: "Beret", band: 66, tags: ["hat"],
    draw: () => `<path d="M42 70 Q34 46 66 36 Q112 26 160 44 Q172 54 158 68 Q100 58 42 70Z" fill="#b5262f"/>
      <path d="M42 70 Q100 58 158 68" fill="none" stroke="#8c1c24" stroke-width="3"/>
      <path d="M108 33 L112 27" stroke="#8c1c24" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: "c-party-hat", label: "Party hat", fit: "upright", band: 56, height: 54, hair: "keep", tags: ["hat"],
    draw: () => `<path d="M74 58 L100 8 L126 58Z" fill="#3fb7e8"/>
      <path d="M86 35 L114 35 L119 45 L81 45Z M93 21 L107 21 L111 28 L89 28Z" fill="#f25f8a"/>
      <ellipse cx="100" cy="58" rx="27" ry="4" fill="#2d97c4"/>
      <g fill="#f7c948"><circle cx="100" cy="7" r="6.5"/><circle cx="92" cy="52" r="2"/><circle cx="108" cy="52" r="2"/></g>`,
  },
  {
    id: "c-beanie", label: "Beanie", band: 74, tags: ["hat"],
    draw: () => `<path d="M42 78 Q40 38 100 36 Q160 38 158 78Z" fill="#d39b2a"/>
      <path d="M64 46 Q60 62 62 74 M82 40 Q80 58 80 74 M100 38 L100 74 M118 40 Q120 58 120 74 M136 46 Q140 62 138 74" fill="none" stroke="#b7821c" stroke-width="2"/>
      <rect x="38" y="64" width="124" height="16" rx="7" fill="#b7821c"/>
      <path d="M50 66 L50 78 M62 66 L62 78 M74 66 L74 78 M86 66 L86 78 M98 66 L98 78 M110 66 L110 78 M122 66 L122 78 M134 66 L134 78 M146 66 L146 78" stroke="#9c6d14" stroke-width="2"/>
      <circle cx="100" cy="35" r="8" fill="#f1e3c0"/>`,
  },
  {
    id: "c-headphones", label: "Headphones", hair: "keep", tags: ["band"], clashes: ["ears"],
    draw: () => `<path d="M44 102 Q38 36 100 34 Q162 36 156 102" fill="none" stroke="#2f2f35" stroke-width="7" stroke-linecap="round"/>
      <g fill="#2f2f35"><rect x="32" y="88" width="18" height="34" rx="7"/><rect x="150" y="88" width="18" height="34" rx="7"/></g>
      <g fill="#e2434b"><rect x="45" y="93" width="6" height="24" rx="3"/><rect x="149" y="93" width="6" height="24" rx="3"/></g>`,
  },
  {
    id: "c-bowler-hat", label: "Bowler hat", fit: "upright", band: 70, height: 48, tags: ["hat"],
    draw: () => `<path d="M56 66 Q52 24 100 22 Q148 24 144 66Z" fill="#26231f"/>
      <path d="M57 56 Q100 62 143 56 L144 66 Q100 72 56 66Z" fill="#141210"/>
      <path d="M34 72 Q38 62 52 64 Q100 74 148 64 Q162 62 166 72 Q100 82 34 72Z" fill="#2f2b26"/>
      <path d="M72 34 Q84 26 98 26" fill="none" stroke="#45403a" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "c-sailor-hat", label: "Sailor hat", fit: "upright", band: 66, height: 36, tags: ["hat"],
    draw: () => `<path d="M58 54 Q62 30 100 30 Q138 30 142 54Z" fill="#f7f7f5" stroke="#dadad4" stroke-width="2"/>
      <path d="M48 70 L52 50 Q100 42 148 50 L152 70 Q100 62 48 70Z" fill="#fbfbf9" stroke="#dadad4" stroke-width="2"/>
      <path d="M53 56 Q100 48 147 56" fill="none" stroke="#24467f" stroke-width="3"/>`,
  },
  // ----- part B -----
  {
    id: "c-elf-hat", label: "Elf hat", fit: "upright", band: 70, height: 58, tags: ["hat"],
    draw: () => `<path d="M48 72 Q58 34 108 18 Q146 8 168 34 Q152 28 138 34 Q146 52 152 72Z" fill="#2f8f4e"/>
      <path d="M112 22 Q146 14 164 32 L156 30 Q140 22 116 28Z" fill="#257a41"/>
      <path d="M44 76 L52 64 L60 74 L68 62 L76 72 L84 60 L92 70 L100 58 L108 70 L116 60 L124 72 L132 62 L140 74 L148 64 L156 76 Q100 68 44 76Z" fill="#c0392b" stroke="#962a20" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="168" cy="38" r="6.5" fill="#e8b832" stroke="#a7811f" stroke-width="1.5"/>`,
  },
  {
    id: "c-dwarf-hood", label: "Dwarf hood", fit: "none", hair: "hide", hidesEarrings: true, tags: ["hat"], clashes: ["ears", "earrings"],
    behind: ({ head }) => `<path d="${hoodShape(head, { tip: 116 }).inside}" fill="#4e2016"/>`,
    draw: ({ head }) => {
      const shape = hoodShape(head, { tip: 116 });
      return `${hoodDraw(shape, "#8c3b2a", "#6a2a1d")}
        <circle cx="116" cy="${fmt(Math.max(4, head.top - 30))}" r="5" fill="#e1c89a"/>`;
    },
  },
  {
    id: "c-viking-helmet", label: "Viking-style helmet", band: 76, tags: ["hat", "helmet"],
    draw: () => `<path d="M42 80 Q40 32 100 30 Q160 32 158 80Z" fill="#8d959e"/>
      <path d="M58 46 Q80 34 100 33" fill="none" stroke="#b9c0c7" stroke-width="5" stroke-linecap="round"/>
      <path d="M94 31 L106 31 L107 70 L93 70Z" fill="#6f7780"/>
      <path d="M40 82 Q100 70 160 82 L160 68 Q100 56 40 68Z" fill="#6f7780"/>
      <path d="M95 72 L105 72 L103.5 99 Q100 102 96.5 99Z" fill="#7a828b" stroke="#5c636b" stroke-width="1.5"/>
      <g fill="#c9ced4">${[52, 70, 88, 112, 130, 148].map((x) => `<circle cx="${x}" cy="${x < 100 ? 74 - (x - 52) * 0.12 : 74 - (148 - x) * 0.12}" r="2.4"/>`).join("")}</g>`,
  },
  {
    id: "c-laurel-wreath", label: "Laurel wreath", hair: "keep", tags: ["band"],
    draw: () => {
      const leaves = [];
      for (const s of [-1, 1]) {
        const p0 = [100 + s * 54, 80];
        const p1 = [100 + s * 44, 56];
        const p2 = [100 + s * 6, 60];
        for (let i = 0; i <= 8; i++) {
          const [x, y] = quadAt(p0, p1, p2, i / 8);
          const [nx, ny] = quadAt(p0, p1, p2, Math.min(1, i / 8 + 0.05));
          const a = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
          for (const side of [-1, 1]) {
            leaves.push(`<ellipse cx="${fmt(x)}" cy="${fmt(y)}" rx="7.5" ry="3.2" transform="rotate(${fmt(a + side * 32)} ${fmt(x)} ${fmt(y)}) translate(${fmt(5)} 0)" fill="${(i + side) % 2 ? "#4f8a3a" : "#6aa64f"}"/>`);
          }
        }
      }
      return `<path d="M46 80 Q56 56 94 60 M154 80 Q144 56 106 60" fill="none" stroke="#3b6b2b" stroke-width="3" stroke-linecap="round"/>${leaves.join("")}`;
    },
  },
  {
    id: "c-pharaoh-headdress", label: "Pharaoh-style headdress", fit: "none", hair: "hide", hidesEarrings: true,
    tags: ["hat"], clashes: ["ears", "earrings"],
    // Plain gold and blue stripes only (no symbols).
    draw: ({ head }) => {
      const w = faceHalfW(head);
      const cy = head.cy || HEAD_CY;
      const gold = "#e2b33a";
      const blue = "#2f4fa2";
      const capRx = head.halfW + 12;
      const capRy = cy - head.top + 12;
      const bandY = head.top + (cy - head.top) * 0.42;
      // The face's edge (inner) and the cloth's edge (outer) at height y, on the left.
      const inner = (y) => (y < cy ? 100 - headHalfAt(head, y) - 1 : 100 - w - 1);
      const outer = (y) => (y < cy ? 100 - capRx * Math.sqrt(Math.max(0, 1 - ((cy - y) / capRy) ** 2)) : 100 - capRx - (y - cy) * 0.12);
      const bottom = 206;
      const steps = [];
      for (let i = 0; i <= 10; i++) steps.push(bandY + ((cy - bandY) * i) / 10);
      const side = (s) => {
        const m = (x) => fmt(100 + s * (100 - x));
        const pts = [...steps.map((y) => `${m(inner(y))} ${fmt(y)}`), `${m(inner(bottom))} ${bottom}`, `${m(outer(bottom))} ${bottom}`, ...steps.slice().reverse().map((y) => `${m(outer(y))} ${fmt(y)}`)];
        return `<path d="M${pts.join(" L")}Z" fill="${gold}"/>`;
      };
      const sideBands = (s) => {
        const m = (f) => (y) => 100 + s * (100 - f(y));
        return bandsBetween(m(inner), m(outer), bandY, bottom, 13, blue);
      };
      // Over the top: gold, with blue stripes following the head.
      const top = `<path d="M${fmt(100 - capRx)} ${cy} A${fmt(capRx)} ${fmt(capRy)} 0 0 1 ${fmt(100 + capRx)} ${cy} L${fmt(100 + headHalfAt(head, bandY))} ${fmt(bandY)} L${fmt(100 - headHalfAt(head, bandY))} ${fmt(bandY)}Z" fill="${gold}"/>`;
      const stripes = [];
      for (let y = head.top - 6; y < bandY - 3; y += 9) {
        const x = capRx * Math.sqrt(Math.max(0, 1 - ((cy - y) / capRy) ** 2)) - 2;
        if (x > 6) stripes.push(`M${fmt(100 - x)} ${fmt(y)} Q100 ${fmt(y + 4)} ${fmt(100 + x)} ${fmt(y)}`);
      }
      const bw = headHalfAt(head, bandY) + 3;
      return `${side(-1)}${side(1)}${sideBands(-1)}${sideBands(1)}${top}
        <path d="${stripes.join(" ")}" fill="none" stroke="${blue}" stroke-width="4"/>
        <path d="M${fmt(100 - bw)} ${fmt(bandY + 3)} Q100 ${fmt(bandY - 3)} ${fmt(100 + bw)} ${fmt(bandY + 3)}" fill="none" stroke="#c99a25" stroke-width="7"/>
        <path d="M${fmt(100 - bw)} ${fmt(bandY + 3)} Q100 ${fmt(bandY - 3)} ${fmt(100 + bw)} ${fmt(bandY + 3)}" fill="none" stroke="${blue}" stroke-width="2"/>`;
    },
  },
  {
    id: "c-musketeer-hat", label: "Musketeer-style hat with feather", fit: "upright", band: 70, height: 50, tags: ["hat"],
    draw: () => `<path d="M14 70 Q30 56 60 64 Q100 72 140 64 Q170 58 186 70 Q160 84 100 82 Q40 84 14 70Z" fill="#232741"/>
      <path d="M14 70 Q6 46 28 36 Q44 50 62 64Z" fill="#2e3352"/>
      <path d="M60 68 Q58 34 100 30 Q142 34 140 68Z" fill="#2e3352"/>
      <path d="M60 60 Q100 66 140 60 L140 68 Q100 74 60 68Z" fill="#c9a227"/>
      <path d="M132 62 Q110 10 40 24 Q78 22 98 40 Q76 28 54 36 Q92 36 112 58Z" fill="#f4f1ea" stroke="#d6d0c2" stroke-width="1.5"/>
      <path d="M132 62 Q104 24 50 28" fill="none" stroke="#b5262f" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  {
    id: "c-coronet", label: "Coronet", fit: "upright", band: 60, height: 18, hair: "keep", tags: ["hat"],
    draw: () => `<path d="M64 64 Q100 54 136 64 L136 56 Q100 46 64 56Z" fill="#e2b33a" stroke="#a7811f" stroke-width="1.5"/>
      <g fill="#e2b33a" stroke="#a7811f" stroke-width="1.5">${[[70, 53], [85, 49], [100, 47], [115, 49], [130, 53]].map(([x, y]) => `<path d="M${x - 4} ${y + 2} L${x} ${y - 6} L${x + 4} ${y + 2}Z"/><circle cx="${x}" cy="${y - 7}" r="2.4"/>`).join("")}</g>
      <circle cx="100" cy="55" r="3" fill="#2a9d8f"/><circle cx="82" cy="57" r="2.2" fill="#c0392b"/><circle cx="118" cy="57" r="2.2" fill="#c0392b"/>`,
  },
  {
    id: "c-steampunk-hat", label: "Steampunk top hat with goggles", fit: "upright", band: 70, height: 60, tags: ["hat"],
    draw: () => `<path d="M62 68 L64 16 Q100 8 136 16 L138 68Z" fill="#5a3a24"/>
      <path d="M63 46 L137 46 L137.5 58 L62.5 58Z" fill="#8a5a2e"/>
      <ellipse cx="100" cy="69" rx="64" ry="9" fill="#4a2f1d"/>
      <g stroke="#b8862f" stroke-width="3.5" fill="#9fd3e6"><circle cx="86" cy="52" r="10"/><circle cx="114" cy="52" r="10"/></g>
      <path d="M96 52 L104 52" stroke="#b8862f" stroke-width="3.5"/>
      <g fill="#ffffff" fill-opacity="0.6"><circle cx="83" cy="49" r="2.5"/><circle cx="111" cy="49" r="2.5"/></g>
      <circle cx="74" cy="28" r="7" fill="none" stroke="#b8862f" stroke-width="3" stroke-dasharray="3 2"/><circle cx="74" cy="28" r="2.5" fill="#b8862f"/>`,
  },
  {
    id: "c-science-goggles", label: "Scientist goggles", hair: "keep", tags: ["band"],
    draw: () => `<path d="M44 74 Q100 50 156 74" fill="none" stroke="#2f3a3f" stroke-width="6"/>
      <g fill="#bfe9f5" fill-opacity="0.9" stroke="#5f7d6a" stroke-width="4"><circle cx="80" cy="62" r="13"/><circle cx="120" cy="62" r="13"/></g>
      <path d="M93 62 L107 62" stroke="#5f7d6a" stroke-width="4"/>
      <g fill="#ffffff" fill-opacity="0.75"><circle cx="75" cy="57" r="3.5"/><circle cx="115" cy="57" r="3.5"/></g>`,
  },
  {
    id: "c-police-cap", label: "Police-style cap", fit: "upright", band: 72, height: 38, tags: ["hat"],
    draw: () => `<ellipse cx="100" cy="50" rx="60" ry="17" fill="#1d2a4d"/>
      <path d="M46 52 L50 74 L150 74 L154 52 Q100 66 46 52Z" fill="#162038"/>
      <path d="M50 70 L150 70" stroke="#0e1426" stroke-width="3"/>
      <path d="M50 72 Q100 96 150 72 Q100 82 50 72Z" fill="#111"/>
      <path d="M100 50 L109 54 L107 64 Q100 69 93 64 L91 54Z" fill="#c9ced4" stroke="#8c939b" stroke-width="1.5"/>
      <circle cx="100" cy="59" r="3" fill="#8c939b"/>`,
  },
  {
    id: "c-firefighter-helmet", label: "Firefighter helmet", fit: "upright", band: 74, height: 46, tags: ["hat", "helmet"],
    draw: () => `<path d="M22 82 Q28 70 54 72 Q100 78 146 72 Q172 70 178 82 Q100 94 22 82Z" fill="#a51f1f"/>
      <path d="M54 76 Q52 30 100 28 Q148 30 146 76Z" fill="#c62828"/>
      <path d="M100 29 L100 74" stroke="#a51f1f" stroke-width="5"/>
      <path d="M70 40 Q84 32 96 31" fill="none" stroke="#e35a5a" stroke-width="4" stroke-linecap="round"/>
      <path d="M86 36 L114 36 L112 58 Q100 66 88 58Z" fill="#e8c33a" stroke="#a68620" stroke-width="2"/>
      <circle cx="100" cy="48" r="5" fill="#a68620"/>`,
  },
  {
    id: "c-astronaut-helmet", label: "Astronaut helmet", fit: "none", hair: "keep", tags: ["hat", "helmet"],
    // A glass bubble: the hair shows inside it.
    draw: ({ head }) => {
      const w = faceHalfW(head);
      const rx = w + 26;
      const ry = (head.chin - head.top) / 2 + 24;
      const cy = (head.top + head.chin) / 2 + 2;
      const ring = head.chin + 10;
      const rw = rx * 0.82;
      return `<path d="${ellipsePath(100, cy, rx, ry)}" fill="#dff2ff" fill-opacity="0.07" stroke="#cfe3f2" stroke-width="4"/>
        <path d="M${fmt(100 - rx + 12)} ${fmt(cy - 6)} A${fmt(rx - 12)} ${fmt(ry - 12)} 0 0 1 ${fmt(100 - rx * 0.3)} ${fmt(cy - ry + 14)}" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-opacity="0.8"/>
        <path d="M${fmt(100 + rx - 14)} ${fmt(cy + 10)} A${fmt(rx - 14)} ${fmt(ry - 14)} 0 0 1 ${fmt(100 + rx - 26)} ${fmt(cy + ry * 0.45)}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.6"/>
        <rect x="${fmt(100 - rw)}" y="${fmt(ring)}" width="${fmt(rw * 2)}" height="16" rx="8" fill="#e9edf1" stroke="#9aa6b2" stroke-width="2.5"/>
        <path d="M${fmt(100 - rw + 8)} ${fmt(ring + 8)} L${fmt(100 + rw - 8)} ${fmt(ring + 8)}" stroke="#c4ccd4" stroke-width="2"/>`;
    },
  },
  {
    id: "c-deerstalker", label: "Deerstalker", band: 72, tags: ["hat"],
    draw: () => `<path d="M48 64 Q40 48 56 44 Q66 54 64 68Z M152 64 Q160 48 144 44 Q134 54 136 68Z" fill="#8e6640"/>
      <path d="M44 76 Q42 36 100 34 Q158 36 156 76Z" fill="#a77b4f"/>
      <g fill="none" stroke="#7d5733" stroke-width="1.6" stroke-opacity="0.8">
        <path d="M70 40 Q64 56 64 74 M86 36 Q82 56 82 74 M100 34 L100 74 M114 36 Q118 56 118 74 M130 40 Q136 56 136 74"/>
        <path d="M50 52 Q100 42 150 52 M46 64 Q100 54 154 64"/>
      </g>
      <path d="M62 74 Q100 96 138 74 Q100 82 62 74Z" fill="#8e6640"/>
      <path d="M92 33 Q100 26 108 33 M100 33 L94 40 M100 33 L106 40" fill="none" stroke="#5c3d22" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  {
    id: "c-explorer-hat", label: "Explorer's hat", fit: "upright", band: 70, height: 40, tags: ["hat"],
    draw: () => `<path d="M20 72 Q30 62 58 64 Q100 72 142 64 Q170 62 180 72 Q100 86 20 72Z" fill="#b89c66"/>
      <path d="M60 68 Q58 34 82 30 Q100 36 118 30 Q142 34 140 68Z" fill="#c9b07a"/>
      <path d="M86 34 Q100 42 114 34" fill="none" stroke="#a88f5c" stroke-width="2"/>
      <path d="M60 58 Q100 64 140 58 L140 68 Q100 74 60 68Z" fill="#6b4a2a"/>`,
  },
  {
    id: "c-ringmaster-hat", label: "Ringmaster's top hat", fit: "upright", band: 70, height: 62, tags: ["hat"],
    draw: () => `<path d="M62 68 L64 14 Q100 6 136 14 L138 68Z" fill="#b3202b"/>
      <path d="M63 50 L137 50 L137.5 64 L62.5 64Z" fill="#e0b33c"/>
      <ellipse cx="100" cy="69" rx="64" ry="9" fill="#1d1d22"/>
      <path d="M70 18 L70 46" stroke="#d64550" stroke-width="3" stroke-linecap="round"/>
      ${star5(100, 57, 5, "#b3202b")}`,
  },
  {
    id: "c-plague-hat", label: "Plague doctor hat", fit: "upright", band: 70, height: 38, tags: ["hat"],
    draw: () => `<ellipse cx="100" cy="70" rx="80" ry="11" fill="#161618"/>
      <path d="M64 68 L66 34 Q100 28 134 34 L136 68Z" fill="#232326"/>
      <path d="M65 56 L135 56 L135.5 66 L64.5 66Z" fill="#3a3a40"/>
      <path d="M72 38 L72 52" stroke="#3a3a40" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "c-pilot-cap", label: "Pilot cap", fit: "upright", band: 72, height: 38, tags: ["hat"],
    draw: () => `<ellipse cx="100" cy="50" rx="60" ry="17" fill="#1f2a44"/>
      <path d="M46 52 L50 74 L150 74 L154 52 Q100 66 46 52Z" fill="#18213a"/>
      <path d="M50 72 Q100 96 150 72 Q100 82 50 72Z" fill="#111"/>
      <path d="M58 74 Q100 82 142 74" fill="none" stroke="#d9ae35" stroke-width="2.5"/>
      <path d="M100 58 Q88 52 76 54 Q86 58 98 62Z M100 58 Q112 52 124 54 Q114 58 102 62Z" fill="#d9ae35"/>
      <circle cx="100" cy="60" r="4" fill="#d9ae35"/>`,
  },
  {
    id: "c-surgical-cap", label: "Surgical cap", band: 70, tags: ["hat"],
    draw: () => `<path d="M44 78 Q40 36 100 34 Q160 36 156 78 Q100 68 44 78Z" fill="#8ec5d6"/>
      <path d="M44 78 Q100 68 156 78" fill="none" stroke="#6fa9bb" stroke-width="4"/>
      <path d="M70 42 Q76 56 74 70 M130 42 Q124 56 126 70" fill="none" stroke="#7ab6c8" stroke-width="2"/>`,
  },
  {
    id: "c-judge-wig", label: "Judge's wig", hair: "hide", hidesEarrings: true, tags: ["hat"], clashes: ["ears", "earrings"],
    draw: () => {
      const rolls = [];
      for (const s of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const y = 78 + i * 12;
          rolls.push(`<ellipse cx="${100 + s * 52}" cy="${y}" rx="10" ry="6.5"/>`);
          if (i > 0) rolls.push(`<ellipse cx="${100 + s * 40}" cy="${y + 6}" rx="6" ry="5"/>`);
        }
      }
      return `<path d="M44 108 Q40 38 100 36 Q160 38 156 108 L146 108 Q144 64 100 60 Q56 64 54 108Z" fill="#ecebe6" stroke="#c9c6bc" stroke-width="2"/>
        <path d="M58 52 Q100 40 142 52 M54 64 Q100 52 146 64" fill="none" stroke="#c9c6bc" stroke-width="2"/>
        <g fill="#f4f3ee" stroke="#c2bfb4" stroke-width="2">${rolls.join("")}</g>`;
    },
  },
  {
    id: "c-straw-hat", label: "Straw hat", fit: "upright", band: 70, height: 36, tags: ["hat"],
    draw: () => {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const r = i % 2 ? 1 : 1.08;
        pts.push(`${fmt(100 + 80 * r * Math.cos(a))} ${fmt(72 + 13 * r * Math.sin(a))}`);
      }
      return `<path d="M${pts.join(" L")}Z" fill="#e3c065" stroke="#c49a3a" stroke-width="1.5"/>
        <path d="M62 70 Q60 38 100 36 Q140 38 138 70Z" fill="#e9cc77"/>
        <path d="M70 46 Q100 40 130 46 M66 58 Q100 52 134 58" fill="none" stroke="#c9a24a" stroke-width="1.8"/>
        <path d="M62 62 Q100 68 138 62 L138 70 Q100 76 62 70Z" fill="#b5472a"/>
        <rect x="110" y="40" width="14" height="12" rx="1.5" fill="#7a5a3a" transform="rotate(8 117 46)"/>
        <path d="M112 42 L113 51 M122 43 L121 52" stroke="#e9cc77" stroke-width="1.2" stroke-dasharray="2 1.5"/>`;
    },
  },
  {
    id: "c-sun-hat", label: "Sun hat", fit: "upright", band: 70, height: 34, tags: ["hat"],
    draw: () => `<path d="M10 76 Q20 58 62 62 Q100 70 138 62 Q180 58 190 76 Q160 92 100 88 Q40 92 10 76Z" fill="#ecd3a2"/>
      <path d="M62 68 Q62 38 100 36 Q138 38 138 68Z" fill="#f1dcb0"/>
      <path d="M62 60 Q100 66 138 60 L138 68 Q100 74 62 68Z" fill="#e57a9a"/>
      <g fill="#f7c948"><circle cx="128" cy="60" r="3.5"/></g>
      <g fill="#ffffff">${[[0, -6], [6, 0], [0, 6], [-6, 0]].map(([dx, dy]) => `<circle cx="${128 + dx}" cy="${60 + dy}" r="3.8"/>`).join("")}</g>
      <circle cx="128" cy="60" r="3" fill="#f7c948"/>`,
  },
  {
    id: "c-cap-backwards", label: "Baseball cap, backwards", band: 70, tags: ["hat"],
    draw: (ctx) => `<path d="M68 38 Q100 24 132 38 Q100 32 68 38Z" fill="#1f5fa8"/>
      <path d="M44 76 Q42 36 100 34 Q158 36 156 76Z" fill="#2f74c0"/>
      <path d="M100 35 L100 64 M70 42 Q64 58 66 74 M130 42 Q136 58 134 74" fill="none" stroke="#2563a6" stroke-width="2"/>
      <path d="M86 77 Q86 62 100 62 Q114 62 114 77Z" fill="${ctx.hair.hair}"/>
      <path d="M84 72 L116 72" stroke="#1f5fa8" stroke-width="4"/>
      <circle cx="100" cy="35" r="3.5" fill="#1f5fa8"/>`,
  },
  {
    id: "c-knit-cap", label: "Black knit cap", band: 74, tags: ["hat"],
    draw: () => `<path d="M42 78 Q40 40 100 38 Q160 40 158 78Z" fill="#26262a"/>
      <path d="M64 46 Q60 62 62 74 M82 41 Q80 58 80 74 M100 39 L100 74 M118 41 Q120 58 120 74 M136 46 Q140 62 138 74" fill="none" stroke="#38383e" stroke-width="2"/>
      <rect x="38" y="64" width="124" height="16" rx="7" fill="#1c1c20"/>
      <path d="M50 66 L50 78 M62 66 L62 78 M74 66 L74 78 M86 66 L86 78 M98 66 L98 78 M110 66 L110 78 M122 66 L122 78 M134 66 L134 78 M146 66 L146 78" stroke="#333338" stroke-width="2"/>`,
  },
  {
    id: "c-bandana", label: "Bandana", band: 70, tags: ["hat"],
    draw: () => `<path d="M148 70 Q166 76 172 98 L162 96 Q158 82 146 76Z M148 72 Q170 70 180 86 L172 90 Q164 80 146 78Z" fill="#a93226"/>
      <path d="M44 74 Q42 36 100 34 Q158 36 156 74 Q100 64 44 74Z" fill="#c0392b"/>
      <path d="M44 74 Q100 64 156 74" fill="none" stroke="#a93226" stroke-width="3"/>
      <g fill="#ffffff">${[[64, 52], [82, 44], [100, 50], [118, 44], [136, 52], [72, 64], [92, 60], [110, 60], [128, 64], [100, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join("")}</g>
      <circle cx="150" cy="74" r="6" fill="#a93226"/>`,
  },
  {
    // Clearly ninja-style, not a head covering: a tight hood, a cloth mask across the nose and
    // cheeks (below the eyes; the shared mouth is drawn on it, so the cloth is a lighter slate than
    // the hood) and a red headband knotted at the side. The nose isn't drawn (coversHead), and the
    // mouth is drawn in its plain dark line even on a face with lip tint (mouthOnCloth), which
    // wouldn't show on the cloth.
    id: "c-ninja-hood", label: "Ninja-style hood with face mask", fit: "none", hair: "hide", coversHead: true, hidesEarrings: true, mouthOnCloth: true,
    tags: ["hat"], clashes: ["ears", "earrings", "mask", "beard", "facialHair"],
    behind: ({ head }) => `<path d="${hoodShape(head, NINJA_HOOD).inside}" fill="#121216"/>`,
    draw: ({ head, geo }) => {
      const shape = hoodShape(head, NINJA_HOOD);
      const w = faceHalfW(head);
      const cy = head.cy || HEAD_CY;
      // The mask: the face opening below a line just under the eyes, with a small rise at the nose.
      const oTop = head.top + NINJA_HOOD.opening;
      const oBottom = head.chin + NINJA_HOOD.chinPad;
      const ocy = (oTop + oBottom) / 2;
      const rx = w - 1;
      const ry = (oBottom - oTop) / 2 + 2;
      const y0 = EYE_Y + 12 * geo.eyeScale + 3;
      const dx = rx * Math.sqrt(Math.max(0, 1 - ((y0 - ocy) / ry) ** 2));
      const mask = `M${fmt(100 - dx)} ${fmt(y0)} Q100 ${fmt(y0 - 6)} ${fmt(100 + dx)} ${fmt(y0)} A${fmt(rx)} ${fmt(ry)} 0 ${y0 < ocy ? 1 : 0} 1 ${fmt(100 - dx)} ${fmt(y0)}Z`;
      // The headband: across the forehead on the hood, knotted on the right with two short tails.
      const pad = NINJA_HOOD.pad;
      const yb = oTop - 7;
      const bx = (w + pad) * Math.sqrt(Math.max(0, 1 - ((cy - yb) / (cy - head.top + NINJA_HOOD.topPad)) ** 2));
      const kx = 100 + bx - 2;
      const ky = yb + 3;
      return `${hoodDraw(shape, "#26262c", "#141418")}
        <path d="${mask}" fill="#687083"/>
        <path d="M${fmt(100 - dx + 2)} ${fmt(y0 + 1)} Q100 ${fmt(y0 - 5)} ${fmt(100 + dx - 2)} ${fmt(y0 + 1)}" fill="none" stroke="#838ba0" stroke-width="3"/>
        <path d="M${fmt(100 - dx * 0.7)} ${fmt(y0 + 30)} Q${fmt(100 - dx * 0.5)} ${fmt(y0 + 18)} ${fmt(100 - dx * 0.25)} ${fmt(y0 + 12)} M${fmt(100 + dx * 0.7)} ${fmt(y0 + 30)} Q${fmt(100 + dx * 0.5)} ${fmt(y0 + 18)} ${fmt(100 + dx * 0.25)} ${fmt(y0 + 12)}" fill="none" stroke="#565d6e" stroke-width="2" stroke-linecap="round"/>
        <path d="M${fmt(100 - bx + 2)} ${fmt(yb + 3)} Q100 ${fmt(yb - 6)} ${fmt(kx)} ${fmt(ky)}" fill="none" stroke="#a3262a" stroke-width="7" stroke-linecap="round"/>
        <path d="M${fmt(kx)} ${fmt(ky)} Q${fmt(kx + 10)} ${fmt(ky + 2)} ${fmt(kx + 17)} ${fmt(ky + 12)} L${fmt(kx + 11)} ${fmt(ky + 15)} Q${fmt(kx + 6)} ${fmt(ky + 8)} ${fmt(kx)} ${fmt(ky + 4)}Z
                 M${fmt(kx)} ${fmt(ky + 2)} Q${fmt(kx + 6)} ${fmt(ky + 10)} ${fmt(kx + 7)} ${fmt(ky + 22)} L${fmt(kx + 1)} ${fmt(ky + 22)} Q${fmt(kx + 1)} ${fmt(ky + 12)} ${fmt(kx - 2)} ${fmt(ky + 6)}Z" fill="#a3262a" stroke="#7a1c1f" stroke-width="1.2" stroke-linejoin="round"/>
        <ellipse cx="${fmt(kx)}" cy="${fmt(ky + 1)}" rx="5" ry="4.5" fill="#8e1f23" stroke="#7a1c1f" stroke-width="1.2"/>`;
    },
  },
  {
    id: "c-ballet-ribbon", label: "Ballet bun ribbon", hair: "keep", tags: ["band"],
    draw: (ctx) => `<circle cx="100" cy="39" r="11.5" fill="${ctx.hair.hair}" stroke="${ctx.hair.shade}" stroke-width="2"/>
      <path d="M92 36 Q100 30 108 36" fill="none" stroke="${ctx.hair.shade}" stroke-width="1.6"/>
      <path d="M88 47 Q100 53 112 47" fill="none" stroke="#f4a6c4" stroke-width="5" stroke-linecap="round"/>
      <path d="M112 47 Q124 40 126 50 Q118 52 112 47Z M112 47 Q122 56 118 62 L114 52Z" fill="#f4a6c4" stroke="#d97fa3" stroke-width="1.2"/>`,
  },
  {
    id: "c-bunny-ears", label: "Bunny ears", fit: "upright", band: 62, height: 64, hair: "keep", tags: ["band"], clashes: ["top"],
    draw: () => `<g transform="rotate(-12 80 30)"><ellipse cx="80" cy="30" rx="11" ry="30" fill="#fbfbf9" stroke="#d6d6d0" stroke-width="2"/><ellipse cx="80" cy="33" rx="5.5" ry="22" fill="#f6b3c8"/></g>
      <g transform="rotate(14 120 30)"><path d="M109 58 Q106 14 120 0 Q134 10 131 58Z" fill="#fbfbf9" stroke="#d6d6d0" stroke-width="2"/><path d="M114 56 Q113 22 120 10 Q127 22 126 56Z" fill="#f6b3c8"/></g>
      <path d="M50 70 Q100 44 150 70" fill="none" stroke="#f6b3c8" stroke-width="6" stroke-linecap="round"/>`,
  },
  {
    id: "c-bear-hood", label: "Bear hood", fit: "none", hair: "hide", hidesEarrings: true, tags: ["hat"], clashes: ["ears", "earrings"],
    behind: ({ head }) => `<path d="${hoodShape(head).inside}" fill="#4a3020"/>`,
    draw: ({ head }) => {
      const w = faceHalfW(head);
      const y = head.top + 2;
      const ears = bothSides((s) => `<circle cx="${fmt(100 + s * (w * 0.72))}" cy="${fmt(y)}" r="14" fill="#7a5130"/><circle cx="${fmt(100 + s * (w * 0.72))}" cy="${fmt(y)}" r="7.5" fill="#c89a6a"/>`);
      return `${ears}${hoodDraw(hoodShape(head), "#7a5130", "#5c3c22")}`;
    },
  },
  {
    id: "c-dino-hood", label: "Dinosaur hood", fit: "none", hair: "hide", hidesEarrings: true, tags: ["hat"], clashes: ["ears", "earrings"],
    behind: ({ head }) => `<path d="${hoodShape(head).inside}" fill="#2e5e2b"/>`,
    draw: ({ head }) => {
      const w = faceHalfW(head);
      const cy = head.cy || HEAD_CY;
      const rx = w + 15;
      const ry = cy - head.top + 15;
      const spikes = [];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.2 + (0.6 * i) / 6);
        const at = (r) => [100 + Math.cos(a) * rx * r, cy - Math.sin(a) * ry * r];
        const [bx, by] = at(0.97);
        const [tx, ty] = at(1.2);
        const dx = Math.sin(a) * 7;
        const dy = Math.cos(a) * 7;
        spikes.push(`M${fmt(bx - dx)} ${fmt(by - dy)} L${fmt(tx)} ${fmt(Math.max(2, ty))} L${fmt(bx + dx)} ${fmt(by + dy)}Z`);
      }
      // Soft, friendly teeth along the top of the opening.
      const oTop = head.top + 8;
      const teeth = [-24, -12, 0, 12, 24].map((dx) => `M${100 + dx - 5} ${fmt(oTop + 1 + Math.abs(dx) * 0.06)} L${100 + dx} ${fmt(oTop + 9 + Math.abs(dx) * 0.06)} L${100 + dx + 5} ${fmt(oTop + 1 + Math.abs(dx) * 0.06)}Z`).join(" ");
      return `<path d="${spikes.join(" ")}" fill="#f2a93b" stroke="#c97f1f" stroke-width="1.5" stroke-linejoin="round"/>
        ${hoodDraw(hoodShape(head), "#4f9a4a", "#3a7a36")}
        <path d="${teeth}" fill="#ffffff" stroke="#d6d6d0" stroke-width="1"/>`;
    },
  },
  {
    id: "c-robot-head", label: "Robot head", fit: "none", hair: "hide", coversHead: true, hidesEarrings: true,
    tags: ["hat", "fullHead"], clashes: ["mask", "beard", "top", "ears", "eyewear", "earrings", "facialHair", "fullHead"],
    draw: ({ head }) => {
      const w = faceHalfW(head) + 12;
      const top = Math.max(16, head.top - 6);
      const bottom = head.chin + 8;
      const antenna = Math.max(5, top - 16);
      return `<path d="M100 ${top} L100 ${fmt(antenna + 4)}" stroke="#6c7682" stroke-width="3"/>
        <circle cx="100" cy="${fmt(antenna)}" r="5" fill="#e5484d"/>
        ${bothSides((s) => `<rect x="${fmt(s < 0 ? 100 - w - 8 : 100 + w - 2)}" y="${fmt((top + bottom) / 2 - 14)}" width="10" height="28" rx="3" fill="#7d8894"/>`)}
        <rect x="${fmt(100 - w)}" y="${fmt(top)}" width="${fmt(w * 2)}" height="${fmt(bottom - top)}" rx="16" fill="#a9b4bf" stroke="#6c7682" stroke-width="3"/>
        <rect x="${fmt(100 - w + 8)}" y="${fmt(top + 6)}" width="${fmt(w * 2 - 16)}" height="10" rx="5" fill="#bcc6cf"/>
        <g fill="#6c7682">${[[-1, top + 8], [1, top + 8], [-1, bottom - 8], [1, bottom - 8]].map(([s, y]) => `<circle cx="${fmt(100 + s * (w - 8))}" cy="${fmt(y)}" r="2.5"/>`).join("")}</g>`;
    },
    // Glowing openings for the eyes and the mouth, so every pose still reads.
    face: ({ geo }) => `<g fill="#c4f3ff" stroke="#6c7682" stroke-width="2.5">
        ${[geo.eyeL, geo.eyeR].map((x) => `<rect x="${fmt(x - 17)}" y="${EYE_Y - 15}" width="34" height="28" rx="8"/>`).join("")}
        <rect x="74" y="122" width="52" height="32" rx="8"/>
      </g>`,
  },
];

// ---------- masks and face ----------
// Drawn in canvas coordinates, placed by the face (ctx.geo: eye centres and eye size); a funny face
// with smaller features shrinks them with the features. Parts (all optional):
//   paint(ctx): on the skin (cut to the head's outline), under facial hair and hair.
//   under(ctx): over the face, under the nose, eyes, brows and mouth (masks, moustaches).
//   over(ctx): over the eyes and mouth (fangs, an eye patch, a monocle, a clown nose).

const NO_MASK = { id: "c-no-mask", label: "No mask or face paint", under: () => "" };

// An eye opening in a mask: an ellipse around the eye, scaled with the eye.
const eyeHole = (x, s, rx = 12, ry = 10) => ellipsePath(x, EYE_Y, rx * s, ry * s);

const MASKS = [
  NO_MASK,
  {
    id: "c-masquerade", label: "Masquerade mask", tags: ["mask"],
    under: ({ geo, skin }) => {
      const { eyeL: l, eyeR: r, eyeScale: s } = geo;
      return `<path d="M${l - 25} 96 Q${l - 18} 82 ${l} 86 Q94 87 100 93 Q106 87 ${r} 86 Q${r + 18} 82 ${r + 25} 96 Q${r + 20} 115 ${r} 116 Q104 115 100 108 Q96 115 ${l} 116 Q${l - 20} 115 ${l - 25} 96Z
                ${eyeHole(l, s)} ${eyeHole(r, s)}" fill="#7a2b8f" fill-rule="evenodd" stroke="#e1b93a" stroke-width="2"/>
        <path d="M${r + 20} 88 Q${r + 30} 70 ${r + 26} 52 M${r + 16} 86 Q${r + 20} 70 ${r + 12} 56" fill="none" stroke="#3fb7a8" stroke-width="4" stroke-linecap="round"/>
        <circle cx="${r + 20}" cy="88" r="4" fill="#e1b93a"/>
        <path d="${eyeHole(l, s)} ${eyeHole(r, s)}" fill="${skin}"/>`;
    },
  },
  {
    id: "c-white-mask", label: "Plain white mask", tags: ["mask"],
    under: ({ geo, skin }) => `<path d="M100 56 Q142 56 142 108 Q142 160 100 166 Q58 160 58 108 Q58 56 100 56Z
        ${eyeHole(geo.eyeL, geo.eyeScale, 11, 9)} ${eyeHole(geo.eyeR, geo.eyeScale, 11, 9)}" fill="#f4f1ea" fill-rule="evenodd" stroke="#d3cdc0" stroke-width="2"/>
      <path d="${eyeHole(geo.eyeL, geo.eyeScale, 11, 9)} ${eyeHole(geo.eyeR, geo.eyeScale, 11, 9)}" fill="${skin}"/>`,
  },
  {
    id: "c-skull-mask", label: "Skull mask", tags: ["mask"],
    under: ({ geo, skin }) => `<path d="M58 106 Q56 56 100 54 Q144 56 142 106 Q142 128 128 136 L126 156 Q100 168 74 156 L72 136 Q58 128 58 106Z" fill="#efe9dc" stroke="#cfc6b4" stroke-width="2"/>
      <path d="${eyeHole(geo.eyeL, geo.eyeScale, 14, 12)} ${eyeHole(geo.eyeR, geo.eyeScale, 14, 12)}" fill="${skin}" stroke="#4a4540" stroke-width="4"/>
      <path d="M100 112 Q94 122 96 126 Q100 124 104 126 Q106 122 100 112Z" fill="#4a4540"/>
      <path d="M84 148 L84 158 M92 150 L92 161 M100 151 L100 162 M108 150 L108 161 M116 148 L116 158" stroke="#a89f8e" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "c-hero-mask", label: "Superhero eye mask", tags: ["mask"],
    under: ({ geo, skin }) => {
      const { eyeL: l, eyeR: r, eyeScale: s } = geo;
      return `<path d="M${l - 22} 100 Q${l - 16} 87 ${l} 88 Q96 89 100 95 Q104 89 ${r} 88 Q${r + 16} 87 ${r + 22} 100 Q${r + 16} 115 ${r} 114 Q104 113 100 106 Q96 113 ${l} 114 Q${l - 16} 115 ${l - 22} 100Z
                ${eyeHole(l, s)} ${eyeHole(r, s)}" fill="#1f2a44" fill-rule="evenodd"/>
        <path d="M${l - 21} 101 L${l - 34} 96 M${l - 21} 103 L${l - 32} 110 M${r + 21} 101 L${r + 34} 96 M${r + 21} 103 L${r + 32} 110" stroke="#1f2a44" stroke-width="3" stroke-linecap="round"/>
        <path d="${eyeHole(l, s)} ${eyeHole(r, s)}" fill="${skin}"/>`;
    },
  },
  {
    id: "c-eye-patch", label: "Eye patch", tags: ["mask"], clashes: ["eyewear"],
    over: ({ geo }) => `<path d="M${geo.eyeR - 11} 93 Q${geo.eyeR} 80 ${geo.eyeR + 30} 72 M${geo.eyeR + 12} 100 L${geo.eyeR + 32} 106" fill="none" stroke="#1b1b1b" stroke-width="3" stroke-linecap="round"/>
      <path d="${ellipsePath(geo.eyeR, EYE_Y + 1, 13 * geo.eyeScale, 11 * geo.eyeScale)}" fill="#1b1b1b"/>`,
  },
  {
    id: "c-monocle", label: "Monocle", tags: ["mask"], clashes: ["eyewear"],
    over: ({ geo }) => {
      const r = 14 * geo.eyeScale;
      return `<circle cx="${geo.eyeL}" cy="${EYE_Y}" r="${fmt(r)}" fill="#ffffff" fill-opacity="0.12" stroke="#c9a227" stroke-width="2.6"/>
        <path d="M${fmt(geo.eyeL + r * 0.7)} ${fmt(EYE_Y + r * 0.7)} Q${geo.eyeL + 22} 146 ${geo.eyeL + 8} 176" fill="none" stroke="#c9a227" stroke-width="1.6" stroke-dasharray="2.5 1.5"/>`;
    },
  },
  {
    id: "c-fake-moustache", label: "Fake moustache", tags: ["mask"],
    under: () => `<path d="M74 129 Q80 117 93 121 Q100 115 107 121 Q120 117 126 129 Q115 126 107 130 Q100 126 93 130 Q85 126 74 129Z" fill="#2a1e18"/>`,
  },
  {
    id: "c-villain-moustache", label: "Curly villain moustache", tags: ["mask"],
    under: () => `<path d="M100 124 Q90 120 80 125 Q72 130 70 124 Q69 118 75 119 M100 124 Q110 120 120 125 Q128 130 130 124 Q131 118 125 119" fill="none" stroke="#1b1b1b" stroke-width="3.4" stroke-linecap="round"/>`,
  },
  {
    id: "c-fangs", label: "Vampire fangs", tags: ["mask"],
    // They hang from the top of whatever mouth the pose draws (like buck teeth).
    over: ({ mouth }) => {
      const y = (MOUTH_TOPS[mouth] || MOUTH_TOPS.smile) - 1;
      return `<g fill="#ffffff" stroke="#222" stroke-width="1.2" stroke-linejoin="round">
          <path d="M88.5 ${y} L95 ${y} L92 ${y + 10}Z"/><path d="M105 ${y} L111.5 ${y} L108 ${y + 10}Z"/>
        </g>`;
    },
  },
  {
    id: "c-clown-paint", label: "Friendly clown face paint", tags: ["mask", "paint"],
    paint: ({ geo }) => `<g fill="#ff6f8f" fill-opacity="0.75"><circle cx="${geo.eyeL - 10}" cy="126" r="9"/><circle cx="${geo.eyeR + 10}" cy="126" r="9"/></g>
      <g fill="#3fb7e8">${[geo.eyeL, geo.eyeR].map((x) => `<path d="M${x} 112 L${x + 4} 119 L${x} 126 L${x - 4} 119Z M${x} 76 L${x + 3.5} 82 L${x} 88 L${x - 3.5} 82Z"/>`).join("")}</g>`,
    over: () => `<circle cx="100" cy="116" r="9" fill="#e5312f"/><circle cx="97" cy="113" r="2.6" fill="#ffffff" fill-opacity="0.7"/>`,
  },
  {
    id: "c-skeleton-paint", label: "Skeleton face paint", tags: ["mask", "paint"],
    paint: ({ geo }) => `<rect x="0" y="0" width="200" height="240" fill="#f2f0ea"/>
      <g fill="none" stroke="#2b2b2b" stroke-width="5">
        <path d="${eyeHole(geo.eyeL, geo.eyeScale, 15, 14)} ${eyeHole(geo.eyeR, geo.eyeScale, 15, 14)}"/>
      </g>
      <path d="M100 110 Q92 122 95 127 Q100 124 105 127 Q108 122 100 110Z" fill="#2b2b2b"/>
      <path d="M74 142 Q100 150 126 142" fill="none" stroke="#2b2b2b" stroke-width="2.2"/>
      <path d="M80 138 L80 148 M88 141 L88 151 M96 142 L96 153 M104 142 L104 153 M112 141 L112 151 M120 138 L120 148" stroke="#2b2b2b" stroke-width="2" stroke-linecap="round"/>
      <g fill="#b9b5ad" fill-opacity="0.6"><ellipse cx="66" cy="132" rx="7" ry="11"/><ellipse cx="134" cy="132" rx="7" ry="11"/></g>`,
  },
  {
    id: "c-glitter", label: "Glitter", tags: ["mask", "paint"],
    paint: ({ geo }) => {
      const dots = [[-18, 18, 4.5, "#f7c948"], [-6, 25, 3.5, "#f28cb1"], [-24, 6, 3.5, "#7fc8f0"], [-18, -8, 3, "#f7c948"], [-27, -3, 3.5, "#f28cb1"], [-12, 30, 2.5, "#7fc8f0"], [-28, 16, 2.5, "#ffffff"]];
      // Sparkles on the outer side of each eye and the cheekbone.
      return [geo.eyeL, geo.eyeR].map((x) => {
        const out = x < 100 ? 1 : -1;
        return dots.map(([dx, dy, r, c]) => sparkle(x + dx * out, EYE_Y + dy, r * 1.9, c)).join("");
      }).join("");
    },
  },
  // ----- part B -----
  {
    id: "c-plague-mask", label: "Plague doctor mask", tags: ["mask"], clashes: ["eyewear"],
    // Light, so the brows read on it; a short beak that stops above the mouth.
    under: ({ geo, skin }) => {
      const { eyeL: l, eyeR: r, eyeScale: s } = geo;
      return `<path d="M${l - 22} 90 Q${l - 18} 68 100 66 Q${r + 18} 68 ${r + 22} 90 L${r + 20} 112 Q${r} 122 100 118 Q${l} 122 ${l - 20} 112Z
                ${eyeHole(l, s, 13, 12)} ${eyeHole(r, s, 13, 12)}" fill="#efe6d2" fill-rule="evenodd" stroke="#c9bb98" stroke-width="2"/>
        <path d="${eyeHole(l, s, 13, 12)} ${eyeHole(r, s, 13, 12)}" fill="${skin}" stroke="#b8862f" stroke-width="3.5"/>`;
    },
    over: () => `<path d="M94 106 Q100 102 106 106 L110 114 Q105 120 100 123 Q95 120 90 114Z" fill="#e6dcc4" stroke="#a8986e" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M100 106 L100 121" stroke="#c9bb98" stroke-width="1.5"/>`,
  },
  {
    id: "c-mummy-bandages", label: "Mummy bandages", tags: ["mask", "paint"],
    // Strips across the face, with gaps at the eyes and the mouth.
    paint: () => {
      const strip = (y, h, a) => `<rect x="-10" y="${y}" width="220" height="${h}" transform="rotate(${a} 100 ${y + h / 2})"/>`;
      return `<g fill="#eee6d4" stroke="#cfc4aa" stroke-width="1.5">
          ${strip(30, 14, -3)}${strip(50, 13, 4)}${strip(68, 11, -5)}${strip(116, 8, 3)}${strip(152, 12, -4)}${strip(166, 14, 3)}
        </g>`;
    },
  },
  {
    id: "c-witch-nose", label: "Witch nose with wart", tags: ["mask"],
    over: ({ skin, skinShade }) => {
      const green = mixColor(skin, "#6f9a3a", 0.35);
      return `<path d="M97 95 Q101 93 103 97 Q107 109 113 116 Q110 122 99 121 Q94 120 96 116 Q98 106 97 95Z" fill="${green}" stroke="${mixColor(skinShade, "#3f5a1f", 0.3)}" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="105" cy="109" r="2.6" fill="${mixColor(green, "#5a3a1a", 0.35)}"/>`;
    },
  },
  {
    id: "c-wooden-nose", label: "Long wooden nose", tags: ["mask"],
    over: () => `<path d="M98 114 L148 116.5 Q152 118 148 119.5 L98 124Z" fill="#c08a52" stroke="#8a5a2b" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M108 118 L138 118.5" stroke="#9c6a38" stroke-width="1.2"/>
      <circle cx="100" cy="119" r="6.5" fill="#c99560" stroke="#8a5a2b" stroke-width="1.8"/>`,
  },
  {
    id: "c-tiger-stripes", label: "Tiger stripes face paint", tags: ["mask", "paint"],
    paint: () => {
      const wedges = [
        "M88 40 L94 40 L92 70Z", "M100 36 L106 36 L102 64Z", "M112 40 L118 40 L110 68Z",
        "M30 96 L30 104 L62 100Z", "M30 112 L30 120 L58 114Z", "M34 128 L36 136 L60 128Z",
        "M170 96 L170 104 L138 100Z", "M170 112 L170 120 L142 114Z", "M166 128 L164 136 L140 128Z",
      ];
      return `<rect x="0" y="0" width="200" height="240" fill="#f08a24" fill-opacity="0.55"/>
        <path d="M100 112 Q76 116 74 138 Q76 162 100 166 Q124 162 126 138 Q124 116 100 112Z" fill="#fff6ea" fill-opacity="0.85"/>
        <path d="${wedges.join(" ")}" fill="#2b2016"/>`;
    },
  },
  {
    id: "c-butterfly-paint", label: "Butterfly face paint", tags: ["mask", "paint"],
    paint: ({ geo }) => {
      const wing = (s) => {
        const x = s < 0 ? geo.eyeL : geo.eyeR;
        const m = (v) => fmt(100 + s * (100 - v));
        const ox = 100 - Math.abs(100 - x);
        return `<path d="M${m(98)} 98 Q${m(ox + 4)} 66 ${m(ox - 24)} 76 Q${m(ox - 30)} 100 ${m(98)} 104 Q${m(ox - 22)} 120 ${m(ox - 10)} 128 Q${m(ox + 10)} 124 ${m(98)} 106Z" fill="#b57ad9" fill-opacity="0.85"/>
          <path d="M${m(97)} 100 Q${m(ox - 6)} 78 ${m(ox - 18)} 82 Q${m(ox - 20)} 96 ${m(97)} 102Z" fill="#f2a7d8" fill-opacity="0.9"/>
          <circle cx="${m(ox - 18)}" cy="88" r="3" fill="#ffffff"/><circle cx="${m(ox - 12)}" cy="118" r="3" fill="#7fc8f0"/>`;
      };
      return `${wing(-1)}${wing(1)}<path d="M100 92 L100 112" stroke="#5b2a86" stroke-width="3" stroke-linecap="round"/>`;
    },
  },
  {
    id: "c-star-glasses", label: "Star-shaped glasses", tags: ["mask"], clashes: ["eyewear"],
    over: ({ geo }) => {
      const r = 19 * geo.eyeScale;
      return `<path d="${starPath(geo.eyeL, EYE_Y, r, 0.6)} ${starPath(geo.eyeR, EYE_Y, r, 0.6)}" fill="#ffffff" fill-opacity="0.14" stroke="#ff5fa2" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="M${fmt(geo.eyeL + r * 0.55)} ${EYE_Y - 3} Q100 ${EYE_Y - 9} ${fmt(geo.eyeR - r * 0.55)} ${EYE_Y - 3}" fill="none" stroke="#ff5fa2" stroke-width="3"/>`;
    },
  },
  {
    id: "c-carrot-nose", label: "Carrot nose", tags: ["mask"],
    over: () => `<path d="M98 112 Q100 110 102 111 L142 118 Q144 119 142 120 L102 125 Q99 126 98 124Z" fill="#f08a24" stroke="#c9671a" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M110 114 L112 118 M120 116 L121 120 M130 117 L131 120" stroke="#c9671a" stroke-width="1.4" stroke-linecap="round"/>`,
  },
  {
    id: "c-bunny-nose", label: "Bunny nose and whiskers", tags: ["mask"],
    over: () => `<path d="M93 112 Q100 108 107 112 Q104 119 100 120 Q96 119 93 112Z" fill="#f28cb1" stroke="#c85f86" stroke-width="1.5"/>
      <path d="M90 118 L62 112 M90 121 L60 122 M90 124 L63 132 M110 118 L138 112 M110 121 L140 122 M110 124 L137 132" stroke="#5a4a44" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  {
    id: "c-burglar-mask", label: "Cat-burglar eye mask", tags: ["mask"],
    under: ({ geo, skin }) => {
      const { eyeL: l, eyeR: r, eyeScale: s } = geo;
      return `<path d="M${l - 30} 92 Q100 86 ${r + 30} 92 L${r + 30} 112 Q100 118 ${l - 30} 112Z ${eyeHole(l, s)} ${eyeHole(r, s)}" fill="#1b1b1f" fill-rule="evenodd"/>
        <path d="M${r + 28} 100 L${r + 40} 94 M${r + 28} 104 L${r + 39} 112" stroke="#1b1b1f" stroke-width="3.5" stroke-linecap="round"/>
        <path d="${eyeHole(l, s)} ${eyeHole(r, s)}" fill="${skin}"/>`;
    },
  },
];

// ---------- costume beards ----------
// draw(ctx): over facial hair, under the eyes and mouth. Follows the head's jaw and chin
// (ctx.head.chin, chinW). color: "hair" uses the brow shade of the hair colour.

const NO_COSTUME_BEARD = { id: "c-no-costume-beard", label: "No costume beard", draw: () => "" };

// The part of a beard over the cheeks and jaw, from the cheekbones (y0) to w px each side of the
// chin, hanging drop px below it, with the mouth area left free.
function beardShape(head, y0, extra, drop) {
  const w = faceHalfW(head) - 4;
  const c = head.chin;
  const cw = head.chinW;
  return `M${fmt(100 - w)} ${y0} Q${fmt(100 - w - 2)} ${fmt(c - 14)} ${fmt(100 - cw - extra)} ${fmt(c + 6)} Q100 ${fmt(c + drop)} ${fmt(100 + cw + extra)} ${fmt(c + 6)} Q${fmt(100 + w + 2)} ${fmt(c - 14)} ${fmt(100 + w)} ${y0} Q${fmt(100 + w - 12)} 128 120 133 Q100 128 80 133 Q${fmt(100 - w + 12)} 128 ${fmt(100 - w)} ${y0}Z`;
}

const COSTUME_BEARDS = [
  NO_COSTUME_BEARD,
  {
    id: "c-santa-beard", label: "Santa-style white beard", tags: ["beard"],
    draw: ({ head }) => {
      const c = head.chin;
      const curls = [-36, -24, -12, 0, 12, 24, 36].map((dx, i) => `<circle cx="${100 + dx}" cy="${fmt(c + 30 - Math.abs(dx) * 0.45 + (i % 2) * 4)}" r="9"/>`).join("");
      return `<path d="${beardShape(head, 110, 30, 46)}" fill="#f5f5f3"/>
        <g fill="#f5f5f3" stroke="#dedcd6" stroke-width="1.5">${curls}</g>
        <path d="M74 131 Q82 117 100 124 Q118 117 126 131 Q114 128 100 132 Q86 128 74 131Z" fill="#ffffff" stroke="#dedcd6" stroke-width="1.5"/>`;
    },
  },
  {
    id: "c-wizard-beard", label: "Long wizard beard", tags: ["beard"],
    draw: ({ head }) => {
      const w = faceHalfW(head) - 6;
      const c = head.chin;
      return `<path d="M${fmt(100 - w)} 114 Q${fmt(100 - w - 2)} ${fmt(c)} ${fmt(100 - head.chinW - 16)} ${fmt(c + 18)} Q86 210 100 236 Q114 210 ${fmt(100 + head.chinW + 16)} ${fmt(c + 18)} Q${fmt(100 + w + 2)} ${fmt(c)} ${fmt(100 + w)} 114 Q${fmt(100 + w - 14)} 130 120 134 Q100 128 80 134 Q${fmt(100 - w + 14)} 130 ${fmt(100 - w)} 114Z" fill="#dcdad4"/>
        <path d="M86 150 Q90 190 98 226 M100 150 L100 230 M114 150 Q110 190 102 226" fill="none" stroke="#bdbab2" stroke-width="2" stroke-linecap="round"/>
        <path d="M72 140 Q80 117 100 125 Q120 117 128 140 Q116 130 100 132 Q84 130 72 140Z" fill="#e6e4de" stroke="#bdbab2" stroke-width="1.5"/>`;
    },
  },
  {
    id: "c-pirate-beard", label: "Pirate beard", color: "hair", tags: ["beard"],
    draw: ({ head, brow }) => {
      const c = head.chin;
      return `<path d="${beardShape(head, 114, 12, 22)}" fill="${brow}"/>
        <path d="M90 ${fmt(c + 10)} Q88 ${fmt(c + 30)} 92 ${fmt(c + 42)} M110 ${fmt(c + 10)} Q112 ${fmt(c + 30)} 108 ${fmt(c + 42)}" fill="none" stroke="${brow}" stroke-width="7" stroke-linecap="round"/>
        <g fill="#c0392b"><circle cx="92" cy="${fmt(c + 44)}" r="3.5"/><circle cx="108" cy="${fmt(c + 44)}" r="3.5"/></g>
        <path d="M78 130 Q86 120 100 125 Q114 120 122 130 Q110 127 100 130 Q90 127 78 130Z" fill="${brow}"/>`;
    },
  },
  {
    id: "c-string-beard", label: "Fake beard on a string", tags: ["beard"],
    draw: ({ head, ear }) => `<path d="M${fmt(100 - faceHalfW(head) + 12)} 130 L${fmt(100 - ear.dx)} ${EAR_Y} M${fmt(100 + faceHalfW(head) - 12)} 130 L${fmt(100 + ear.dx)} ${EAR_Y}" stroke="#f4f4f4" stroke-width="1.6"/>
      <path d="${beardShape(head, 128, 14, 30)}" fill="#7a4a2a"/>
      <path d="M86 ${fmt(head.chin)} L84 ${fmt(head.chin + 14)} M100 ${fmt(head.chin + 2)} L100 ${fmt(head.chin + 20)} M114 ${fmt(head.chin)} L116 ${fmt(head.chin + 14)}" stroke="#5c361d" stroke-width="2" stroke-linecap="round"/>`,
  },
  // ----- part B -----
  {
    id: "c-dwarf-beard", label: "Dwarf braided beard", color: "hair", tags: ["beard"],
    draw: ({ head, brow }) => {
      const w = faceHalfW(head) - 4;
      const c = head.chin;
      const light = mixColor(brow, "#ffffff", 0.3);
      const braid = [];
      for (let y = c + 8; y < 226; y += 9) braid.push(`<ellipse cx="${(y - c) % 18 < 9 ? 98 : 102}" cy="${fmt(y)}" rx="7.5" ry="6"/>`);
      return `<path d="M${fmt(100 - w)} 112 Q${fmt(100 - w - 4)} ${fmt(c)} ${fmt(100 - head.chinW - 22)} ${fmt(c + 22)} Q80 206 96 214 L104 214 Q120 206 ${fmt(100 + head.chinW + 22)} ${fmt(c + 22)} Q${fmt(100 + w + 4)} ${fmt(c)} ${fmt(100 + w)} 112 Q${fmt(100 + w - 12)} 130 120 134 Q100 128 80 134 Q${fmt(100 - w + 12)} 130 ${fmt(100 - w)} 112Z" fill="${brow}"/>
        <path d="M82 ${fmt(c + 4)} Q80 ${fmt(c + 24)} 86 ${fmt(c + 36)} M118 ${fmt(c + 4)} Q120 ${fmt(c + 24)} 114 ${fmt(c + 36)}" fill="none" stroke="${light}" stroke-width="2" stroke-linecap="round"/>
        <g fill="${brow}" stroke="${light}" stroke-width="1.6">${braid.join("")}</g>
        <g fill="#e1b93a" stroke="#a7811f" stroke-width="1.2"><rect x="92" y="${fmt(c + 32)}" width="16" height="6" rx="2"/><rect x="92" y="${fmt(c + 50)}" width="16" height="6" rx="2"/></g>
        <path d="M70 136 Q78 116 100 124 Q122 116 130 136 Q116 128 100 132 Q84 128 70 136Z" fill="${brow}" stroke="${light}" stroke-width="1.2"/>`;
    },
  },
  {
    id: "c-viking-beard", label: "Viking-style beard", color: "hair", tags: ["beard"],
    draw: ({ head, brow }) => {
      const c = head.chin;
      const light = mixColor(brow, "#ffffff", 0.3);
      const braid = (x, d) => [0, 1, 2, 3].map((i) => `<ellipse cx="${x + (i % 2 ? d : 0)}" cy="${fmt(c + 18 + i * 8)}" rx="5.5" ry="5"/>`).join("");
      return `<path d="${beardShape(head, 108, 20, 32)}" fill="${brow}"/>
        <path d="M76 ${fmt(c - 6)} Q78 ${fmt(c + 6)} 84 ${fmt(c + 14)} M124 ${fmt(c - 6)} Q122 ${fmt(c + 6)} 116 ${fmt(c + 14)} M100 ${fmt(c + 4)} L100 ${fmt(c + 18)}" fill="none" stroke="${light}" stroke-width="1.8" stroke-linecap="round"/>
        <g fill="${brow}" stroke="${light}" stroke-width="1.5">${braid(90, -1)}${braid(110, 1)}</g>
        <g fill="#c9ced4" stroke="#8c939b" stroke-width="1"><rect x="85" y="${fmt(c + 48)}" width="10" height="7" rx="2"/><rect x="105" y="${fmt(c + 48)}" width="10" height="7" rx="2"/></g>
        <path d="M74 132 Q82 118 100 124 Q118 118 126 132 Q112 128 100 131 Q88 128 74 132Z" fill="${brow}"/>`;
    },
  },
  {
    id: "c-musketeer-beard", label: "Musketeer-style moustache and pointed beard", color: "hair", tags: ["beard"],
    draw: ({ head, brow }) => {
      const y = Math.max(155, head.chin - 10);
      return `<path d="M100 125 Q90 119 80 124 Q72 128 70 120 Q69 114 75 115 M100 125 Q110 119 120 124 Q128 128 130 120 Q131 114 125 115" fill="none" stroke="${brow}" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M94 ${fmt(y)} Q100 ${fmt(y - 3)} 106 ${fmt(y)} L100 ${fmt(head.chin + 18)}Z" fill="${brow}"/>`;
    },
  },
  {
    id: "c-red-pointed-beard", label: "Red pointed beard", tags: ["beard"],
    draw: ({ head }) => {
      const w = faceHalfW(head) - 4;
      const c = head.chin;
      const cw = head.chinW;
      return `<path d="M${fmt(100 - w)} 116 Q${fmt(100 - w - 2)} ${fmt(c - 10)} ${fmt(100 - cw - 6)} ${fmt(c + 4)} L100 ${fmt(c + 36)} L${fmt(100 + cw + 6)} ${fmt(c + 4)} Q${fmt(100 + w + 2)} ${fmt(c - 10)} ${fmt(100 + w)} 116 Q${fmt(100 + w - 12)} 130 120 134 Q100 128 80 134 Q${fmt(100 - w + 12)} 130 ${fmt(100 - w)} 116Z" fill="#b8462a"/>
        <path d="M92 ${fmt(c)} L98 ${fmt(c + 24)} M108 ${fmt(c)} L102 ${fmt(c + 24)}" stroke="#93361f" stroke-width="2" stroke-linecap="round"/>
        <path d="M76 132 Q84 118 100 124 Q116 118 124 132 Q112 127 100 130 Q88 127 76 132Z" fill="#b8462a"/>`;
    },
  },
];

// ---------- ears and horns ----------
//   kind "ears": replaces the ears (in the skin tone), drawn over the hair so the tips show.
//     draw(ctx) in canvas coordinates (ctx.ear: where the ears are).
//   kind "top": on top of the head, drawn for the reference head and moved onto each head like
//     hair; at most 18 px above the crown (y ≥ 27).

const NO_EARS_HORNS = { id: "c-no-ears-horns", label: "No ears or horns", kind: "top", draw: () => "" };

const EARS_HORNS = [
  NO_EARS_HORNS,
  {
    id: "c-elf-ears", label: "Elf ears", kind: "ears", tags: ["ears"],
    draw: ({ ear, skin, skinShade }) => bothSides((s) => {
      const x = 100 + s * (ear.dx - 3);
      const tipX = 100 + s * (ear.dx + ear.rx + 16);
      const tipY = EAR_Y - ear.ry - 16;
      return `<path d="M${fmt(x)} ${fmt(EAR_Y + ear.ry * 0.8)} Q${fmt(x + s * ear.rx * 1.9)} ${fmt(EAR_Y + ear.ry * 0.4)} ${fmt(tipX)} ${fmt(tipY)} Q${fmt(x + s * ear.rx * 0.5)} ${fmt(EAR_Y - ear.ry * 0.7)} ${fmt(x)} ${fmt(EAR_Y - ear.ry * 0.4)}Z" fill="${skin}" stroke="${skinShade}" stroke-width="1.5"/>
        <path d="M${fmt(x + s * 3)} ${fmt(EAR_Y + ear.ry * 0.4)} Q${fmt(x + s * ear.rx * 1.2)} ${fmt(EAR_Y)} ${fmt(tipX - s * 6)} ${fmt(tipY + 8)}" fill="none" stroke="${skinShade}" stroke-width="2" stroke-linecap="round"/>`;
    }),
  },
  {
    id: "c-devil-horns", label: "Devil horns", kind: "top", tags: ["top"], clashes: ["hat"],
    draw: () => bothSides((s) => `<path d="M${100 + s * 26} 56 Q${100 + s * 36} 44 ${100 + s * 32} 29 Q${100 + s * 44} 40 ${100 + s * 40} 56Z" fill="#c62828" stroke="#8e1b1b" stroke-width="1.5" stroke-linejoin="round"/>`),
  },
  {
    id: "c-cat-ears", label: "Cat ears", kind: "top", tags: ["top"], clashes: ["hat"],
    draw: (ctx) => bothSides((s) => `<path d="M${100 + s * 20} 52 L${100 + s * 30} 28 L${100 + s * 44} 58Z" fill="${ctx.hair.hair}" stroke="${ctx.hair.shade}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M${100 + s * 25} 51 L${100 + s * 30} 36 L${100 + s * 38} 55Z" fill="#f2a7b8"/>`),
  },
  {
    id: "c-unicorn-horn", label: "Unicorn horn", kind: "top", tags: ["top"], clashes: ["hat"],
    draw: () => `<path d="M91 62 L100 28 L109 62Z" fill="#f2cf5b" stroke="#c9a227" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M93 56 L107 52 M95 48 L105 44 M97 40 L103 37" stroke="#c9a227" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "c-antennae", label: "Antennae", kind: "top", tags: ["top"], clashes: ["hat"],
    draw: () => bothSides((s) => `<path d="M${100 + s * 12} 52 Q${100 + s * 18} 40 ${100 + s * 28} 34" fill="none" stroke="#333" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${100 + s * 29}" cy="33" r="5.5" fill="#ff6fb5" stroke="#c24a8a" stroke-width="1.5"/>`),
  },
  // ----- part B -----
  {
    id: "c-ram-horns", label: "Ram horns", kind: "top", tags: ["top"], clashes: ["hat"],
    draw: () => bothSides((s) => {
      const x = (v) => 100 + s * v;
      const curl = `M${x(26)} 56 Q${x(40)} 32 ${x(56)} 44 Q${x(70)} 60 ${x(60)} 76 Q${x(48)} 86 ${x(44)} 72 Q${x(44)} 62 ${x(54)} 64`;
      return `<path d="${curl}" fill="none" stroke="#a88c5a" stroke-width="12" stroke-linecap="round"/>
        <path d="${curl}" fill="none" stroke="#d9c49a" stroke-width="8" stroke-linecap="round" stroke-dasharray="3 4"/>`;
    }),
  },
  {
    id: "c-wolf-ears", label: "Wolf ears", kind: "top", tags: ["top"], clashes: ["hat"],
    draw: () => bothSides((s) => `<path d="M${100 + s * 16} 56 L${100 + s * 34} 27 L${100 + s * 50} 62Z" fill="#7d838b" stroke="#5c6168" stroke-width="2" stroke-linejoin="round"/>
      <path d="M${100 + s * 23} 55 L${100 + s * 34} 36 L${100 + s * 43} 58Z" fill="#e4cdb8"/>
      <path d="M${100 + s * 28} 54 L${100 + s * 31} 46 M${100 + s * 34} 55 L${100 + s * 35} 45 M${100 + s * 40} 56 L${100 + s * 38} 47" stroke="#a9adb3" stroke-width="1.6" stroke-linecap="round"/>`),
  },
  {
    id: "c-fairy-ears", label: "Fairy ears", kind: "ears", tags: ["ears"],
    draw: ({ ear, skin, skinShade }) => bothSides((s) => {
      const x = 100 + s * (ear.dx - 3);
      const tipX = 100 + s * (ear.dx + ear.rx + 6);
      const tipY = EAR_Y - ear.ry - 12;
      return `<path d="M${fmt(x)} ${fmt(EAR_Y + ear.ry * 0.8)} Q${fmt(x + s * ear.rx * 1.7)} ${fmt(EAR_Y + ear.ry * 0.3)} ${fmt(tipX)} ${fmt(tipY)} Q${fmt(x + s * ear.rx * 0.4)} ${fmt(EAR_Y - ear.ry * 0.6)} ${fmt(x)} ${fmt(EAR_Y - ear.ry * 0.3)}Z" fill="${skin}" stroke="${skinShade}" stroke-width="1.5"/>
        <path d="M${fmt(x + s * 3)} ${fmt(EAR_Y + ear.ry * 0.4)} Q${fmt(x + s * ear.rx * 1.1)} ${fmt(EAR_Y)} ${fmt(tipX - s * 4)} ${fmt(tipY + 6)}" fill="none" stroke="#f2a7d8" stroke-width="2" stroke-linecap="round"/>
        ${sparkle(tipX + s * 4, tipY - 3, 5, "#f7c948")}`;
    }),
  },
  {
    id: "c-small-horns", label: "Small horns", kind: "top", tags: ["top"], clashes: ["hat"],
    draw: () => bothSides((s) => `<path d="M${100 + s * 20} 58 Q${100 + s * 22} 44 ${100 + s * 32} 38 Q${100 + s * 34} 50 ${100 + s * 34} 60Z" fill="#b3262a" stroke="#7d1a1d" stroke-width="1.5" stroke-linejoin="round"/>`),
  },
  {
    id: "c-bear-ears", label: "Bear ears", kind: "top", tags: ["top"], clashes: ["hat"],
    draw: () => bothSides((s) => `<circle cx="${100 + s * 36}" cy="46" r="13" fill="#7a5130" stroke="#5c3c22" stroke-width="2"/>
      <circle cx="${100 + s * 36}" cy="47" r="7" fill="#c89a6a"/>`),
  },
  {
    id: "c-dragon-horns", label: "Dragon horns", kind: "top", tags: ["top"], clashes: ["hat"],
    draw: () => bothSides((s) => `<path d="M${100 + s * 22} 58 Q${100 + s * 30} 38 ${100 + s * 58} 28 Q${100 + s * 44} 42 ${100 + s * 38} 60Z" fill="#3f6b3a" stroke="#2a4a27" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M${100 + s * 28} 52 L${100 + s * 34} 54 M${100 + s * 32} 44 L${100 + s * 38} 47 M${100 + s * 40} 37 L${100 + s * 44} 41" stroke="#a6c46a" stroke-width="2" stroke-linecap="round"/>`),
  },
];

// ---------- costume outfits ----------
// Like outfits (avatar-parts.js), and drawn instead of the outfit (the outfit choice is kept and
// comes back with None). body(c) is cut to the body's outline, collar(c) isn't. c: { skin, nw,
// gender, shoulderX }. highCollar: Randomize leaves necklaces out.
//   hidesHair / coversHead / head(ctx) / face(ctx): a costume that covers the head (ghost sheet):
//   head is drawn over the hair in canvas coordinates, face like a headwear's face openings.

const NO_COSTUME_OUTFIT = { id: "c-no-costume-outfit", label: "No costume outfit" };

// Gold epaulettes on both shoulders, where each gender's shoulders are.
const epaulettes = (c, color = "#d9ae35", fringe = "#b8902a") => bothSides((s) => {
  const x = 100 + s * (100 - c.shoulderX - 16);
  return `<ellipse cx="${fmt(x)}" cy="186" rx="17" ry="7" fill="${color}"/>
    <path d="M${fmt(x - 13)} 191 L${fmt(x - 13)} 199 M${fmt(x - 6)} 192 L${fmt(x - 6)} 201 M${fmt(x + 1)} 192 L${fmt(x + 1)} 201 M${fmt(x + 8)} 192 L${fmt(x + 8)} 200 M${fmt(x + 14)} 190 L${fmt(x + 14)} 197" stroke="${fringe}" stroke-width="2.4" stroke-linecap="round"/>`;
});
const standCollar = (c, fill, line) => `<path d="M${100 - c.nw / 2 - 7} 148 L${100 - c.nw / 2 - 5} 180 Q100 186 ${100 + c.nw / 2 + 5} 180 L${100 + c.nw / 2 + 7} 148 Q100 154 ${100 - c.nw / 2 - 7} 148Z" fill="${fill}"/>
  <path d="M${100 - c.nw / 2 - 6} 156 Q100 162 ${100 + c.nw / 2 + 6} 156" fill="none" stroke="${line}" stroke-width="2.5"/>`;
const ERMINE_BAND = `<path d="M0 182 Q100 166 200 182 L200 214 Q100 228 0 214Z" fill="#fbfaf6"/>
  ${ermineSpots([[20, 196], [44, 202], [70, 192], [96, 204], [122, 192], [148, 202], [174, 196], [58, 210], [134, 210]])}`;
const SWEETHEART = (c, line) => `<path d="M76 172 Q86 196 100 188 Q114 196 124 172Z" fill="${c.skin}"/>
  <path d="M76 172 Q86 196 100 188 Q114 196 124 172" fill="none" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>`;
const PUFF_SLEEVES = (c, color, line) => bothSides((s) => {
  const x = 100 + s * (100 - c.shoulderX - 10);
  return `<ellipse cx="${fmt(x)}" cy="192" rx="17" ry="12" fill="${color}" stroke="${line}" stroke-width="2"/>`;
});

const COSTUME_OUTFITS = [
  NO_COSTUME_OUTFIT,
  {
    id: "c-general-coat", label: "General's coat with epaulettes and sash", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#1f2b4a")}<path d="M82 174 L100 240 L118 174Z" fill="#f2efe6"/>
      <g fill="#d9ae35">${[190, 206, 222, 236].map((y) => `<circle cx="78" cy="${y}" r="3"/><circle cx="122" cy="${y}" r="3"/>`).join("")}</g>
      <path d="M30 178 L50 172 L176 234 L156 242Z" fill="#b0262c"/>`,
    collar: (c) => `${standCollar(c, "#1f2b4a", "#d9ae35")}${epaulettes(c)}`,
  },
  {
    id: "c-pirate-coat", label: "Pirate coat", tags: [],
    body: () => `${OUTFIT_BASE("#6e1f24")}<path d="M80 172 L100 240 L120 172Z" fill="#f4efe4"/>
      <path d="M80 172 L100 240 M120 172 L100 240" stroke="#d9ae35" stroke-width="3"/>
      <g fill="#d9ae35">${[196, 214, 232].map((y) => `<circle cx="74" cy="${y}" r="3.2"/><circle cx="126" cy="${y}" r="3.2"/>`).join("")}</g>
      <rect x="0" y="222" width="200" height="10" fill="#3a2516"/><rect x="92" y="220" width="16" height="14" rx="2" fill="none" stroke="#d9ae35" stroke-width="2.5"/>`,
    collar: () => `<path d="M92 176 Q86 184 92 190 Q86 196 94 202 Q90 208 100 212 Q110 208 106 202 Q114 196 108 190 Q114 184 108 176Z" fill="#ffffff" stroke="#ddd6c8" stroke-width="1.5"/>`,
  },
  {
    id: "c-knight-armour", label: "Knight armour", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#a3abb5")}<path d="M100 178 L100 240" stroke="#7d8590" stroke-width="2.5"/>
      <path d="M36 206 Q100 222 164 206 M30 226 Q100 242 170 226" fill="none" stroke="#7d8590" stroke-width="2.5"/>
      <path d="M70 186 Q100 176 130 186 Q122 204 100 206 Q78 204 70 186Z" fill="#b8c0c9"/>`,
    collar: (c) => `${bothSides((s) => {
      const x = 100 + s * (100 - c.shoulderX - 14);
      return `<path d="M${fmt(x - 20)} 196 Q${fmt(x)} 172 ${fmt(x + 20)} 196 Q${fmt(x)} 206 ${fmt(x - 20)} 196Z" fill="#8b939d" stroke="#6f7882" stroke-width="2"/>`;
    })}${standCollar(c, "#8b939d", "#6f7882")}`,
  },
  {
    id: "c-royal-robe", label: "King's robe with ermine", tags: [],
    body: () => `${OUTFIT_BASE("#9e1b2e")}<rect x="92" y="200" width="16" height="40" fill="#e0b33c"/>${ERMINE_BAND}
      <path d="M62 200 Q100 228 138 200" fill="none" stroke="#e0b33c" stroke-width="4" stroke-dasharray="5 3"/>
      <circle cx="100" cy="222" r="7" fill="#e0b33c" stroke="#a7811f" stroke-width="2"/>`,
  },
  {
    id: "c-royal-gown", label: "Queen's gown with ermine", tags: [],
    body: (c) => `${OUTFIT_BASE("#5b2a86")}<path d="M62 176 Q100 166 138 176 L144 200 Q100 210 56 200Z" fill="#fbfaf6"/>
      ${ermineSpots([[66, 186], [84, 192], [116, 192], [134, 186], [100, 196]])}${SWEETHEART(c, "#e0b33c")}
      <path d="M40 226 Q100 236 160 226" fill="none" stroke="#e0b33c" stroke-width="4"/>`,
  },
  {
    id: "c-prince-outfit", label: "Prince outfit", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#1f6f78")}
      <g stroke="#e0b33c" stroke-width="3" stroke-linecap="round">${[194, 206, 218, 230].map((y) => `<path d="M80 ${y} L120 ${y}"/>`).join("")}</g>
      <g fill="#e0b33c">${[194, 206, 218, 230].map((y) => `<circle cx="80" cy="${y}" r="2.8"/><circle cx="120" cy="${y}" r="2.8"/>`).join("")}</g>
      <path d="M160 180 L176 190 L52 244 L36 236Z" fill="#f1ece0" fill-opacity="0.9"/>`,
    collar: (c) => `${standCollar(c, "#1f6f78", "#e0b33c")}${epaulettes(c, "#e0b33c", "#b8902a")}`,
  },
  {
    id: "c-princess-dress", label: "Princess dress", tags: [],
    body: (c) => `${OUTFIT_BASE("#b98ad8")}<path d="M70 176 Q100 168 130 176 L128 226 Q100 232 72 226Z" fill="#9a6cbf"/>${SWEETHEART(c, "#e0b33c")}
      <path d="M74 226 Q100 232 126 226" fill="none" stroke="#e0b33c" stroke-width="3"/>
      <circle cx="100" cy="200" r="4" fill="#e0b33c"/>`,
    collar: (c) => PUFF_SLEEVES(c, "#d9b8ee", "#9a6cbf"),
  },
  {
    id: "c-santa-suit", label: "Santa-style suit", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#d12b2b")}<rect x="90" y="172" width="20" height="68" fill="#f6f6f6"/>
      <rect x="0" y="220" width="200" height="14" fill="#1b1b1b"/><rect x="88" y="218" width="24" height="18" rx="2" fill="none" stroke="#e0b33c" stroke-width="3"/>`,
    collar: (c) => `<rect x="${100 - c.nw / 2 - 12}" y="164" width="${c.nw + 24}" height="20" rx="10" fill="#f6f6f6"/>`,
  },
  {
    id: "c-witch-dress", label: "Witch dress", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#2a1f36")}<path d="M100 178 L100 240" stroke="#1a1322" stroke-width="2"/>
      <path d="M90 190 L110 202 M110 190 L90 202 M90 206 L110 218 M110 206 L90 218 M90 222 L110 234 M110 222 L90 234" stroke="#9b5bc4" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="0" y="230" width="200" height="8" fill="#7b3fa0"/>`,
    collar: (c) => bothSides((s) => `<path d="M${100 + s * (c.nw / 2 + 2)} 182 L${100 + s * (c.nw / 2 + 26)} 146 L${100 + s * (c.nw / 2 + 18)} 178 L${100 + s * (c.nw / 2 + 34)} 168 L${100 + s * (c.nw / 2 + 10)} 190Z" fill="#3a2b4a" stroke="#1a1322" stroke-width="1.5" stroke-linejoin="round"/>`),
  },
  {
    id: "c-wizard-robe", label: "Wizard robe", tags: [],
    body: (c) => `${OUTFIT_BASE("#2d3f8f")}${V_NECK(c, "#e1b93a")}
      <path d="M100 194 L100 240" stroke="#e1b93a" stroke-width="3"/>
      ${star5(52, 208, 6, "#f5d34a")}${star5(148, 222, 5, "#f5d34a")}${star5(130, 196, 4, "#f5d34a")}${star5(70, 232, 4, "#f5d34a")}
      <path d="M150 200 A7 7 0 1 0 158 210 A5.5 5.5 0 1 1 150 200Z" fill="#f5d34a"/>`,
  },
  {
    id: "c-vampire-cape", label: "Vampire suit with high cape collar", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#17151a")}<path d="M84 172 L100 216 L116 172Z" fill="#f4f4f4"/>
      <path d="M90 182 L100 186 L110 182 L100 190Z" fill="#9c1b26"/>
      <path d="M92 194 L100 216 L108 194Z" fill="#9c1b26"/>`,
    collar: (c) => bothSides((s) => `<path d="M${100 + s * (c.nw / 2 + 2)} 182 L${100 + s * (c.nw / 2 + 50)} 112 Q${100 + s * (c.nw / 2 + 62)} 148 ${100 + s * (c.nw / 2 + 46)} 186Z" fill="#17151a"/>
      <path d="M${100 + s * (c.nw / 2 + 6)} 180 L${100 + s * (c.nw / 2 + 47)} 122 Q${100 + s * (c.nw / 2 + 56)} 150 ${100 + s * (c.nw / 2 + 42)} 182Z" fill="#9c1b26"/>`),
  },
  {
    id: "c-ghost-sheet", label: "Ghost sheet", hidesHair: true, coversHead: true, highCollar: true,
    tags: ["fullHead", "highCollar"], clashes: ["hat", "band", "mask", "beard", "top", "ears", "eyewear", "earrings", "necklace", "back", "fullHead"],
    body: () => `${OUTFIT_BASE("#f4f4f7")}<path d="M60 190 Q66 216 58 240 M140 190 Q134 216 142 240 M100 200 Q96 220 100 240" fill="none" stroke="#dcdce4" stroke-width="2.5"/>`,
    head: ({ head }) => {
      const w = faceHalfW(head) + 10;
      const cy = head.cy || HEAD_CY;
      return `<path d="M${fmt(100 - w - 22)} 204 Q${fmt(100 - w - 4)} ${fmt(head.chin)} ${fmt(100 - w)} ${cy} A${fmt(w)} ${fmt(cy - head.top + 10)} 0 0 1 ${fmt(100 + w)} ${cy} Q${fmt(100 + w + 4)} ${fmt(head.chin)} ${fmt(100 + w + 22)} 204Z" fill="#f4f4f7"/>
        <path d="M${fmt(100 - w + 6)} ${cy + 20} Q${fmt(100 - w + 2)} ${fmt(head.chin)} ${fmt(100 - w - 12)} 200 M${fmt(100 + w - 6)} ${cy + 20} Q${fmt(100 + w - 2)} ${fmt(head.chin)} ${fmt(100 + w + 12)} 200" fill="none" stroke="#dcdce4" stroke-width="2.5"/>`;
    },
    // Cut-out eyes: light, so closed eyes still show.
    face: ({ geo }) => `<path d="${eyeHole(geo.eyeL, geo.eyeScale, 13, 14)} ${eyeHole(geo.eyeR, geo.eyeScale, 13, 14)}" fill="#c9d3e3"/>`,
  },
  {
    id: "c-superhero-suit", label: "Superhero suit", tags: [],
    body: (c) => `${OUTFIT_BASE("#5a3fa6")}${CREW_NECK(c, "#45308a")}
      <rect x="0" y="224" width="200" height="9" fill="#e0b33c"/>
      <circle cx="100" cy="204" r="13" fill="#e0b33c"/><circle cx="100" cy="204" r="8" fill="#f5d779"/>`,
  },
  {
    id: "c-chef", label: "Chef's jacket", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#f7f7f4")}<path d="M78 176 L120 240" stroke="#dcdcd6" stroke-width="2.5"/>
      <g fill="#2b2b2b">${[196, 212, 228].map((y) => `<circle cx="84" cy="${y}" r="2.8"/><circle cx="118" cy="${y}" r="2.8"/>`).join("")}</g>`,
    collar: (c) => `<rect x="${100 - c.nw / 2 - 6}" y="166" width="${c.nw + 12}" height="14" rx="6" fill="#d6332f"/>
      <path d="M100 176 L92 196 L100 192 L108 196Z" fill="#d6332f"/>`,
  },
  {
    id: "c-doctor", label: "Doctor's scrubs", tags: [],
    body: (c) => `${OUTFIT_BASE("#7cb7c9")}${V_NECK(c, "#5f9bad")}
      <rect x="124" y="200" width="20" height="16" rx="2" fill="none" stroke="#5f9bad" stroke-width="2"/>`,
    collar: (c) => `<path d="M${100 - c.nw / 2 - 2} 170 Q76 206 94 220 M${100 + c.nw / 2 + 2} 170 Q124 206 106 220" fill="none" stroke="#5b5f66" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="224" r="6" fill="#c9ced4" stroke="#8c939b" stroke-width="2"/>`,
  },
  {
    id: "c-firefighter", label: "Firefighter jacket", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#b58a3e")}<rect x="0" y="204" width="200" height="10" fill="#f2d53c"/><rect x="0" y="207" width="200" height="4" fill="#d9dde2"/>
      <rect x="0" y="226" width="200" height="10" fill="#f2d53c"/><rect x="0" y="229" width="200" height="4" fill="#d9dde2"/>
      <path d="M100 182 L100 240" stroke="#8a6629" stroke-width="3"/>`,
    collar: (c) => standCollar(c, "#9a7330", "#7a5a22"),
  },
  {
    id: "c-pilot", label: "Pilot uniform", tags: [],
    body: (c) => `${OUTFIT_BASE("#f5f6f8")}<path d="M84 170 L100 186 L116 170Z" fill="${c.skin}"/>
      <path d="M118 198 Q126 194 134 198 Q142 194 150 198 Q142 202 134 200 Q126 202 118 198Z" fill="#d9ae35"/>
      <rect x="122" y="206" width="22" height="16" rx="2" fill="none" stroke="#c9ced4" stroke-width="2"/>`,
    collar: (c) => `${SHIRT_COLLAR("#ffffff", "#c9ced4")}${TIE("#1f2a44", "#16203a")}${bothSides((s) => {
      const x = 100 + s * (100 - c.shoulderX - 16);
      return `<rect x="${fmt(x - 15)}" y="181" width="30" height="9" rx="3" fill="#1f2a44"/><path d="M${fmt(x - 10)} 185.5 L${fmt(x + 10)} 185.5" stroke="#d9ae35" stroke-width="2"/>`;
    })}`,
  },
  {
    id: "c-judge-robe", label: "Judge's robe", tags: [],
    body: () => `${OUTFIT_BASE("#1b1b1f")}<path d="M70 190 Q74 216 68 240 M130 190 Q126 216 132 240 M100 200 L100 240" fill="none" stroke="#2c2c33" stroke-width="3"/>`,
    collar: (c) => `<path d="M${100 - c.nw / 2 - 4} 172 Q100 186 ${100 + c.nw / 2 + 4} 172 L${100 + c.nw / 2 + 6} 180 Q100 194 ${100 - c.nw / 2 - 6} 180Z" fill="#f4f4f4"/>
      <path d="M94 184 L92 206 L99 206 L99 186Z M106 184 L108 206 L101 206 L101 186Z" fill="#ffffff" stroke="#d6d6d6" stroke-width="1"/>`,
  },
  {
    id: "c-butler", label: "Butler's tailcoat", tags: [],
    body: () => `${OUTFIT_BASE("#16161a")}<path d="M84 172 L100 230 L116 172Z" fill="#f4f4f4"/>
      <path d="M88 192 L100 230 L112 192 L112 240 L88 240Z" fill="#7d7f86"/>
      ${LAPELS("#0d0d10")}`,
    collar: () => `${SHIRT_COLLAR("#ffffff", "#c9ced4")}<path d="M88 180 L100 186 L112 180 L112 192 L100 186 L88 192Z" fill="#111"/>`,
  },
  {
    id: "c-cowboy", label: "Cowboy shirt and vest", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#b8322f")}
      <g stroke="#8a2422" stroke-width="3" stroke-opacity="0.7">${[16, 40, 64, 136, 160, 184].map((x) => `<path d="M${x} 140 L${x} 240"/>`).join("")}${[196, 216, 236].map((y) => `<path d="M0 ${y} L200 ${y}"/>`).join("")}</g>
      <path d="M0 176 L78 176 L90 240 L0 240Z M200 176 L122 176 L110 240 L200 240Z" fill="#7a4e2a"/>
      <g fill="#c9a24a"><circle cx="82" cy="204" r="2.5"/><circle cx="84" cy="222" r="2.5"/></g>`,
    collar: (c) => `<path d="M${100 - c.nw / 2 - 8} 170 L${100 + c.nw / 2 + 8} 170 L100 202Z" fill="#2b4f9e"/>
      <g fill="#ffffff">${[[92, 176], [104, 178], [98, 188], [110, 174], [88, 172]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join("")}</g>`,
  },
  {
    id: "c-sailor-suit", label: "Sailor suit", tags: [],
    body: (c) => `${OUTFIT_BASE("#f7f7f5")}<path d="M60 172 L100 222 L140 172 L160 180 L160 196 L100 236 L40 196 L40 180Z" fill="#24467f"/>
      <path d="M50 186 L100 226 L150 186" fill="none" stroke="#ffffff" stroke-width="2.5"/>
      <path d="M84 170 L100 192 L116 170Z" fill="${c.skin}"/>
      <path d="M92 214 L100 222 L108 214 L106 232 L100 226 L94 232Z" fill="#d6332f"/>`,
  },
  {
    id: "c-pumpkin-costume", label: "Pumpkin costume", tags: [],
    body: () => `${OUTFIT_BASE("#ee8a26")}<g fill="none" stroke="#c9671a" stroke-width="3">
        <path d="M60 176 Q40 208 52 240"/><path d="M84 180 Q76 210 82 240"/><path d="M116 180 Q124 210 118 240"/><path d="M140 176 Q160 208 148 240"/>
      </g>`,
    collar: (c) => bothSides((s) => `<path d="M${100 + s * (c.nw / 2 - 2)} 172 Q${100 + s * (c.nw / 2 + 14)} 160 ${100 + s * (c.nw / 2 + 24)} 176 Q${100 + s * (c.nw / 2 + 10)} 184 ${100 + s * (c.nw / 2 - 2)} 176Z" fill="#4f9a3a"/>`),
  },
  // ----- part B -----
  {
    id: "c-toga", label: "Toga-style robe", tags: [],
    body: (c) => `${OUTFIT_BASE("#f4f1e8")}<path d="M84 170 Q100 194 116 170Z" fill="${c.skin}"/>
      <path d="M20 176 L54 170 L200 236 L200 252 L170 252Z" fill="#e9e3d2"/>
      <path d="M54 170 L200 236" fill="none" stroke="#6b2d8a" stroke-width="6"/>
      <path d="M70 196 Q90 214 116 220 M84 186 Q104 204 136 214 M40 206 Q60 224 80 240" fill="none" stroke="#d8d0bb" stroke-width="2.5" stroke-linecap="round"/>`,
    collar: () => `<circle cx="66" cy="182" r="6" fill="#e0b33c" stroke="#a7811f" stroke-width="2"/>`,
  },
  {
    id: "c-viking-tunic", label: "Viking-style tunic with fur", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: (c) => `${OUTFIT_BASE("#3b5a7a")}${V_NECK(c, "#2c455e")}
      <path d="M94 180 L106 186 M106 180 L94 186 M95 188 L105 192" stroke="#c9b48a" stroke-width="2" stroke-linecap="round"/>
      <rect x="0" y="222" width="200" height="10" fill="#5a3a22"/><rect x="92" y="220" width="16" height="14" rx="3" fill="#c9ced4"/>`,
    collar: (c) => {
      const left = c.shoulderX + 10;
      const right = 200 - c.shoulderX - 10;
      const tufts = [];
      for (let i = 0; i <= 8; i++) {
        const x = left + ((right - left) * i) / 8;
        const y = 180 + Math.abs(x - 100) * -0.08 + (i % 2) * 3;
        tufts.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${i % 2 ? 9 : 11}"/>`);
      }
      return `<g fill="#8a7f72">${tufts.join("")}</g>
        <path d="M${fmt(left + 6)} 176 Q100 168 ${fmt(right - 6)} 176" fill="none" stroke="#a69b8c" stroke-width="4" stroke-linecap="round"/>`;
    },
  },
  {
    id: "c-pharaoh-robe", label: "Pharaoh-style collar and robe", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    // Plain gold and blue bands only (no symbols).
    body: () => `${OUTFIT_BASE("#f6f2e6")}<path d="M60 200 L56 240 M80 206 L78 240 M120 206 L122 240 M140 200 L144 240" stroke="#e2dccb" stroke-width="2.5"/>
      <rect x="0" y="226" width="200" height="8" fill="#e2b33a"/><rect x="0" y="228.5" width="200" height="3" fill="#2f4fa2"/>`,
    collar: (c) => [40, 32, 24].map((r, i) => `<path d="M${100 - r} ${168 + i} A${r} ${r * 0.9} 0 0 0 ${100 + r} ${168 + i}" fill="none" stroke="${i % 2 ? "#2f4fa2" : "#e2b33a"}" stroke-width="9"/>`).join("") +
      `<path d="M${100 - c.nw / 2} 168 L${100 + c.nw / 2} 168 L${100 + c.nw / 2} 172 Q100 182 ${100 - c.nw / 2} 172Z" fill="${c.skin}"/>`,
  },
  {
    id: "c-musketeer-tunic", label: "Musketeer-style tunic", tags: [],
    body: () => `${OUTFIT_BASE("#2c4f9e")}<path d="M60 172 L60 240 M140 172 L140 240" stroke="#c9ced4" stroke-width="4"/>
      <path d="M150 176 L168 184 L52 244 L34 238Z" fill="#7a4a2a"/>
      <circle cx="122" cy="206" r="4" fill="#e0b33c"/>`,
    collar: (c) => {
      const w = c.nw / 2 + 26;
      const scallops = [];
      for (let i = 0; i <= 6; i++) scallops.push(`<circle cx="${fmt(100 - w + (i * 2 * w) / 6)}" cy="${fmt(186 + Math.sin((i / 6) * Math.PI) * 10)}" r="6"/>`);
      return `<path d="M${fmt(100 - w)} 174 Q100 164 ${fmt(100 + w)} 174 L${fmt(100 + w)} 186 Q100 204 ${fmt(100 - w)} 186Z" fill="#f8f6f0"/>
        <g fill="#f8f6f0">${scallops.join("")}</g>
        <path d="M${100 - c.nw / 2} 170 Q100 180 ${100 + c.nw / 2} 170" fill="none" stroke="#dcd7cb" stroke-width="2"/>`;
    },
  },
  {
    id: "c-elf-outfit", label: "Elf outfit", tags: [],
    body: (c) => `${OUTFIT_BASE("#3f8f4a")}${CREW_NECK(c, "#2f7a3a")}
      <rect x="0" y="220" width="200" height="11" fill="#6b4a2a"/><rect x="91" y="218" width="18" height="15" rx="2" fill="none" stroke="#e0b33c" stroke-width="3"/>`,
    collar: (c) => {
      const pts = [];
      const w = c.nw / 2 + 24;
      for (let i = 0; i <= 8; i++) {
        const x = 100 - w + (i * 2 * w) / 8;
        const base = 172 + Math.sin((i / 8) * Math.PI) * 10;
        pts.push(`${fmt(x)} ${fmt(base + (i % 2 ? 12 : 0))}`);
      }
      return `<path d="M${fmt(100 - w)} 170 Q100 182 ${fmt(100 + w)} 170 L${pts.reverse().join(" L")}Z" fill="#c8d94a" stroke="#9aab2f" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M${100 - c.nw / 2} 168 L${100 + c.nw / 2} 168 L${100 + c.nw / 2} 172 Q100 184 ${100 - c.nw / 2} 172Z" fill="${c.skin}"/>`;
    },
  },
  {
    id: "c-fairy-dress", label: "Fairy dress", tags: [],
    body: (c) => `${OUTFIT_BASE("#f2b8d8")}${SWEETHEART(c, "#d97fb3")}
      ${sparkle(64, 210, 5, "#ffffff")}${sparkle(132, 222, 4, "#fff3b0")}${sparkle(110, 236, 4, "#ffffff")}${sparkle(80, 232, 3, "#fff3b0")}
      <path d="M40 228 Q60 220 80 228 Q100 220 120 228 Q140 220 160 228" fill="none" stroke="#d97fb3" stroke-width="3"/>`,
    collar: (c) => bothSides((s) => {
      const x = 100 + s * (100 - c.shoulderX - 12);
      return `<path d="M${fmt(x - s * 16)} 186 Q${fmt(x)} 168 ${fmt(x + s * 18)} 184 Q${fmt(x + s * 4)} 198 ${fmt(x - s * 16)} 186Z" fill="#9ed48f" stroke="#6fae5f" stroke-width="1.5"/>
        <path d="M${fmt(x - s * 12)} 186 Q${fmt(x)} 180 ${fmt(x + s * 14)} 184" fill="none" stroke="#6fae5f" stroke-width="1.5"/>`;
    }),
  },
  {
    id: "c-dwarf-tunic", label: "Dwarf tunic", tags: [],
    body: (c) => `${OUTFIT_BASE("#8a4a2a")}${CREW_NECK(c, "#6e3a20")}
      <rect x="0" y="212" width="200" height="16" fill="#4a2f1d"/><rect x="88" y="209" width="24" height="22" rx="3" fill="none" stroke="#c9a24a" stroke-width="4"/>
      <rect x="128" y="186" width="18" height="14" rx="2" fill="#6e3a20"/><path d="M130 188 L144 188 M130 198 L144 198" stroke="#b78560" stroke-width="1.2" stroke-dasharray="2 1.5"/>`,
  },
  {
    id: "c-angel-robe", label: "Angel robe", tags: [],
    body: (c) => `${OUTFIT_BASE("#fbfaf6")}${V_NECK(c, "#e0b33c")}
      <path d="M60 200 Q62 220 56 240 M140 200 Q138 220 144 240 M84 214 L82 240 M116 214 L118 240" fill="none" stroke="#e4e2da" stroke-width="2.5"/>
      <path d="M30 222 Q100 230 170 222" fill="none" stroke="#e0b33c" stroke-width="4"/>
      <path d="M100 226 L94 240 M100 226 L106 240" stroke="#e0b33c" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "c-devil-suit", label: "Red devil suit", tags: [],
    body: (c) => `${OUTFIT_BASE("#c62828")}${CREW_NECK(c, "#8e1b1b")}
      <path d="M60 196 Q64 216 58 240 M140 196 Q136 216 142 240" fill="none" stroke="#a51f1f" stroke-width="2.5"/>`,
    collar: (c) => bothSides((s) => `<path d="M${100 + s * (c.nw / 2 + 1)} 178 L${100 + s * (c.nw / 2 + 20)} 160 L${100 + s * (c.nw / 2 + 14)} 180 L${100 + s * (c.nw / 2 + 26)} 176 L${100 + s * (c.nw / 2 + 6)} 188Z" fill="#a51f1f" stroke="#7d1717" stroke-width="1.5" stroke-linejoin="round"/>`),
  },
  {
    id: "c-jester-suit", label: "Jester suit", tags: [],
    body: (c) => {
      const diamonds = (x0, color) => [196, 222].map((y) => `<path d="M${x0} ${y - 10} L${x0 + 8} ${y} L${x0} ${y + 10} L${x0 - 8} ${y}Z" fill="${color}"/>`).join("");
      return `<rect x="0" y="140" width="100" height="100" fill="#d23c3c"/><rect x="100" y="140" width="100" height="100" fill="#e8b832"/>
        ${diamonds(64, "#e8b832")}${diamonds(136, "#d23c3c")}${CREW_NECK(c, "#7b3fa0")}`;
    },
    collar: (c) => {
      const w = c.nw / 2 + 26;
      const points = [];
      for (let i = 0; i < 6; i++) {
        const x0 = 100 - w + (i * 2 * w) / 6;
        const x1 = x0 + (2 * w) / 6;
        const top = 172 + Math.sin(((i + 0.5) / 6) * Math.PI) * 8;
        points.push(`<path d="M${fmt(x0)} ${fmt(top - 4)} L${fmt((x0 + x1) / 2)} ${fmt(top + 18)} L${fmt(x1)} ${fmt(top - 4)}Z" fill="${i % 2 ? "#e8b832" : "#d23c3c"}" stroke="#7b3fa0" stroke-width="1.2"/>
          <circle cx="${fmt((x0 + x1) / 2)}" cy="${fmt(top + 19)}" r="3.4" fill="#e1a91f" stroke="#a7811f" stroke-width="1"/>`);
      }
      return points.join("");
    },
  },
  {
    id: "c-scarecrow", label: "Scarecrow outfit", tags: [],
    body: (c) => `${OUTFIT_BASE("#4f7fb8")}
      <g stroke="#c0392b" stroke-width="4" stroke-opacity="0.6">${[24, 56, 88, 120, 152, 184].map((x) => `<path d="M${x} 140 L${x} 240"/>`).join("")}${[188, 212, 236].map((y) => `<path d="M0 ${y} L200 ${y}"/>`).join("")}</g>
      ${CREW_NECK(c, "#3d6a9e")}
      <rect x="56" y="198" width="20" height="18" fill="#a77b4f" transform="rotate(-6 66 207)"/><rect x="120" y="214" width="18" height="16" fill="#c9a04a" transform="rotate(5 129 222)"/>
      <path d="M58 200 L74 198 M58 214 L75 212 M122 216 L136 217 M122 228 L136 229" stroke="#f2ead6" stroke-width="1.2" stroke-dasharray="2 2"/>
      <path d="M0 230 Q100 236 200 230" fill="none" stroke="#c9a04a" stroke-width="5"/>`,
    collar: (c) => `<g stroke="#e3c065" stroke-width="2.5" stroke-linecap="round">${[-1, 1].map((s) => [0, 1, 2, 3].map((i) => `<path d="M${fmt(100 + s * (c.nw / 2 - 2 + i * 3))} 174 L${fmt(100 + s * (c.nw / 2 + 6 + i * 4))} ${166 + i * 2}"/>`).join("")).join("")}</g>`,
  },
  {
    id: "c-mummy-wraps", label: "Mummy wraps", hidesHair: true, hidesEarrings: true, highCollar: true,
    tags: ["highCollar"], clashes: ["necklace", "top", "ears", "earrings"],
    body: () => `${OUTFIT_BASE("#e9e1cc")}<g fill="none" stroke="#cfc4aa" stroke-width="2.5">
        <path d="M0 172 L200 196 M0 190 L200 172 M0 206 L200 222 M0 226 L200 206 M0 240 L200 232"/>
      </g>`,
    // The head wrapped too, with the face open.
    head: ({ head }) => {
      const shape = hoodShape(head, { pad: 6, opening: 18, chinPad: 2 });
      const w = faceHalfW(head) - 3;
      const oTop = head.top + 18;
      const oBottom = head.chin + 2;
      const rings = [4, 9, 14].map((k) => `<path d="${ellipsePath(100, (oTop + oBottom) / 2, w + k * 0.6, (oBottom - oTop) / 2 + k)}" fill="none" stroke="#cfc4aa" stroke-width="2"/>`).join("");
      return `<path d="${shape.outer} ${shape.hole}" fill="#ece4d0" fill-rule="evenodd"/>${rings}
        <path d="${shape.hole}" fill="none" stroke="#cfc4aa" stroke-width="2.5"/>`;
    },
  },
  {
    id: "c-skeleton-suit", label: "Skeleton suit", tags: [],
    body: () => `${OUTFIT_BASE("#1d1d22")}<g fill="none" stroke="#ecebe4" stroke-linecap="round">
        <path d="M100 182 L100 226" stroke-width="7"/>
        <path d="M74 178 Q60 176 46 184 M126 178 Q140 176 154 184" stroke-width="6"/>
        ${[192, 204, 216].map((y) => `<path d="M94 ${y} Q74 ${y - 4} 64 ${y + 8} M106 ${y} Q126 ${y - 4} 136 ${y + 8}"/>`).join("").replace(/<path /g, '<path stroke-width="5" ')}
        <path d="M30 198 L26 240 M170 198 L174 240" stroke-width="7"/>
      </g>`,
  },
  {
    id: "c-dark-cloak", label: "Long dark hooded cloak", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#25222c")}<path d="M88 176 L84 240 M112 176 L116 240" stroke="#16141b" stroke-width="3"/>
      <path d="M50 196 Q56 220 48 240 M150 196 Q144 220 152 240" fill="none" stroke="#33303b" stroke-width="3"/>`,
    // The hood, down, lying around the neck.
    collar: (c) => `<path d="M${100 - c.nw / 2 - 4} 166 Q${100 - c.nw / 2 - 34} 170 ${100 - c.nw / 2 - 28} 190 Q100 204 ${100 + c.nw / 2 + 28} 190 Q${100 + c.nw / 2 + 34} 170 ${100 + c.nw / 2 + 4} 166 Q100 186 ${100 - c.nw / 2 - 4} 166Z" fill="#2f2b38"/>
      <path d="M${100 - c.nw / 2 - 22} 186 Q100 198 ${100 + c.nw / 2 + 22} 186" fill="none" stroke="#16141b" stroke-width="2"/>
      <circle cx="100" cy="192" r="5" fill="#c9ced4" stroke="#8c939b" stroke-width="1.5"/>`,
  },
  {
    id: "c-astronaut-suit", label: "Astronaut suit", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#eef1f4")}<path d="M60 196 Q64 218 58 240 M140 196 Q136 218 142 240" fill="none" stroke="#c9d0d7" stroke-width="3"/>
      <rect x="80" y="196" width="40" height="26" rx="4" fill="#9aa6b2"/>
      <circle cx="90" cy="205" r="3.5" fill="#e5484d"/><circle cx="100" cy="205" r="3.5" fill="#3fb7e8"/><circle cx="110" cy="205" r="3.5" fill="#5fcf5a"/>
      <rect x="86" y="212" width="28" height="5" rx="2" fill="#dfe5ea"/>
      <circle cx="140" cy="198" r="9" fill="#2f4fa2"/><circle cx="140" cy="198" r="4" fill="#f5d34a"/><ellipse cx="140" cy="198" rx="8" ry="2.5" fill="none" stroke="#ffffff" stroke-width="1.5"/>`,
    collar: (c) => `<rect x="${100 - c.nw / 2 - 12}" y="164" width="${c.nw + 24}" height="18" rx="9" fill="#c4ccd4" stroke="#8c96a0" stroke-width="2"/>`,
  },
  {
    id: "c-robot-suit", label: "Robot suit", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#a9b4bf")}<rect x="72" y="190" width="56" height="38" rx="6" fill="#7d8894"/>
      <g fill="#c4f3ff"><rect x="80" y="198" width="10" height="8" rx="2"/><rect x="95" y="198" width="10" height="8" rx="2"/></g>
      <circle cx="116" cy="202" r="4.5" fill="#e5484d"/><path d="M80 216 L120 216" stroke="#5fcf5a" stroke-width="4" stroke-linecap="round"/>
      <g fill="#7d8894">${[[44, 196], [44, 226], [156, 196], [156, 226]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join("")}</g>`,
    collar: (c) => [0, 1, 2].map((i) => `<rect x="${100 - c.nw / 2 - 4 - i * 3}" y="${158 + i * 8}" width="${c.nw + 8 + i * 6}" height="7" rx="3" fill="#8b96a2"/>`).join(""),
  },
  {
    id: "c-alien-costume", label: "Alien costume", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: (c) => `${OUTFIT_BASE("#c9d1d9")}${CREW_NECK(c, "#5fcf5a")}
      <path d="M0 190 L100 214 L200 190" fill="none" stroke="#5fcf5a" stroke-width="5"/>
      <circle cx="100" cy="226" r="9" fill="none" stroke="#5fcf5a" stroke-width="4"/><circle cx="100" cy="226" r="3" fill="#5fcf5a"/>`,
    collar: (c) => bothSides((s) => `<path d="M${100 + s * (c.nw / 2 + 2)} 182 L${100 + s * (c.nw / 2 + 30)} 150 Q${100 + s * (c.nw / 2 + 32)} 170 ${100 + s * (c.nw / 2 + 24)} 186Z" fill="#9be08f" stroke="#5fcf5a" stroke-width="1.5" stroke-linejoin="round"/>`),
  },
  {
    id: "c-trench-coat", label: "Detective trench coat", tags: [],
    body: () => `${OUTFIT_BASE("#c8a774")}<path d="M84 172 L100 206 L116 172Z" fill="#f4f4f2"/>${LAPELS("#b8965f")}
      <g fill="#6b4a2a">${[200, 220].map((y) => `<circle cx="88" cy="${y}" r="3"/><circle cx="112" cy="${y}" r="3"/>`).join("")}</g>
      <rect x="0" y="226" width="200" height="9" fill="#a88a58"/><rect x="92" y="224" width="16" height="13" rx="2" fill="none" stroke="#6b4a2a" stroke-width="2.5"/>`,
    collar: () => `${SHIRT_COLLAR("#ffffff", "#c9ced4")}${TIE("#7a2a2a", "#5c1f1f")}`,
  },
  {
    id: "c-mad-scientist-coat", label: "Mad scientist coat", tags: [],
    body: (c) => `${OUTFIT_BASE("#f3f5f6")}<path d="M82 172 L100 212 L118 172Z" fill="#7b3fa0"/>
      <path d="M80 172 L100 212 L92 240 L70 240 L72 182Z M120 172 L100 212 L108 240 L130 240 L128 182Z" fill="#e3e8ea" stroke="#c4ccd0" stroke-width="1.5"/>
      <g fill-opacity="0.85"><ellipse cx="58" cy="214" rx="9" ry="6" fill="#8bd36a"/><circle cx="66" cy="224" r="3" fill="#8bd36a"/><ellipse cx="148" cy="226" rx="7" ry="5" fill="#b57ad9"/><circle cx="72" cy="196" r="3.5" fill="#3fb7e8"/></g>
      <rect x="124" y="196" width="22" height="18" rx="2" fill="none" stroke="#c4ccd0" stroke-width="2"/>
      <rect x="128" y="186" width="5" height="16" rx="2" fill="#8bd36a"/><rect x="136" y="188" width="5" height="14" rx="2" fill="#f25f8a"/>`,
  },
  {
    id: "c-explorer-shirt", label: "Explorer shirt", tags: [],
    body: (c) => `${OUTFIT_BASE("#c9b07a")}<path d="M84 170 L100 190 L116 170Z" fill="${c.skin}"/>
      <path d="M100 190 L100 240" stroke="#a88f5c" stroke-width="2.5"/>
      ${[66, 134].map((x) => `<rect x="${x - 13}" y="196" width="26" height="22" rx="2" fill="#bea36c" stroke="#a88f5c" stroke-width="1.5"/><path d="M${x - 13} 196 L${x + 13} 196 L${x + 13} 203 L${x} 207 L${x - 13} 203Z" fill="#b39a63"/>`).join("")}`,
    collar: () => `${SHIRT_COLLAR("#c9b07a", "#a88f5c")}<path d="M88 182 L112 182 L100 200Z" fill="#c0392b"/>`,
  },
  {
    id: "c-steampunk-vest", label: "Steampunk vest", tags: [],
    body: () => `${OUTFIT_BASE("#f1ece0")}<path d="M74 172 L100 214 L126 172 L200 182 L200 240 L0 240 L0 182Z" fill="#6b3e22"/>
      <g fill="#c9a24a">${[200, 214, 228].map((y) => `<circle cx="${y === 200 ? 108 : 104}" cy="${y + 12}" r="3"/>`).join("")}</g>
      <path d="M78 214 Q90 228 104 226" fill="none" stroke="#e0b33c" stroke-width="2" stroke-dasharray="3 2"/><circle cx="76" cy="212" r="6" fill="#e0b33c" stroke="#a7811f" stroke-width="1.5"/>
      <circle cx="130" cy="196" r="7" fill="none" stroke="#b8862f" stroke-width="3" stroke-dasharray="3 2"/><circle cx="130" cy="196" r="2.5" fill="#b8862f"/>`,
    collar: () => `${SHIRT_COLLAR("#ffffff", "#d6d0c2")}<path d="M88 180 L100 186 L112 180 L112 192 L100 186 L88 192Z" fill="#3a2a1a"/>`,
  },
  {
    id: "c-ninja-outfit", label: "Ninja-style black outfit", tags: [],
    body: (c) => `${OUTFIT_BASE("#26262c")}<path d="M84 170 L100 192 L116 170Z" fill="${c.skin}"/>
      <path d="M84 170 L124 226 M116 170 L100 192" fill="none" stroke="#3a3a44" stroke-width="5" stroke-linecap="round"/>
      <rect x="0" y="222" width="200" height="12" fill="#3a3a44"/>`,
  },
  {
    id: "c-tutu", label: "Ballerina tutu", tags: [],
    body: () => {
      const frills = [];
      for (let x = 10; x <= 190; x += 18) frills.push(`<ellipse cx="${x}" cy="${232 + (x % 36 ? 2 : 0)}" rx="14" ry="9"/>`);
      return `<path d="M56 240 L60 190 Q66 178 75 176 Q86 198 100 200 Q114 198 125 176 Q134 178 140 190 L144 240Z" fill="#f4a6c4"/>
        <path d="M75 176 Q86 198 100 200 Q114 198 125 176" fill="none" stroke="#e086ab" stroke-width="3"/>
        <g fill="#fbd3e3" stroke="#f4a6c4" stroke-width="1.5">${frills.join("")}</g>
        ${sparkle(86, 214, 3.5, "#ffffff")}${sparkle(114, 210, 3, "#ffffff")}`;
    },
  },
  {
    id: "c-ringmaster-jacket", label: "Ringmaster jacket", tags: [],
    body: () => `${OUTFIT_BASE("#b3202b")}<path d="M84 172 L100 218 L116 172Z" fill="#f4f4f4"/>${LAPELS("#1d1d22")}
      <g stroke="#e0b33c" stroke-width="3" stroke-linecap="round">${[200, 214, 228].map((y) => `<path d="M48 ${y} L64 ${y} M136 ${y} L152 ${y}"/>`).join("")}</g>
      <g fill="#e0b33c">${[200, 214, 228].map((y) => `<circle cx="66" cy="${y}" r="3"/><circle cx="134" cy="${y}" r="3"/>`).join("")}</g>`,
    collar: () => `${SHIRT_COLLAR("#ffffff", "#c9ced4")}<path d="M88 180 L100 186 L112 180 L112 192 L100 186 L88 192Z" fill="#111"/>`,
  },
  {
    id: "c-leather-jacket", label: "Rock star leather jacket", tags: [],
    body: () => `${OUTFIT_BASE("#1f1f22")}<path d="M80 172 L100 230 L120 172Z" fill="#8a9097"/>${LAPELS("#141416")}
      <path d="M112 200 L118 240" stroke="#c9ced4" stroke-width="2.5" stroke-dasharray="2 2"/>
      <g fill="#c9ced4">${[[72, 186], [76, 198], [80, 210], [128, 186], [124, 198], [120, 210]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2"/>`).join("")}</g>
      <path d="M40 222 L64 222 M136 222 L160 222" stroke="#3a3a40" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "c-burglar-shirt", label: "Striped burglar shirt", tags: [],
    body: (c) => `${OUTFIT_BASE("#f4f4f4")}<g fill="#1b1b1f">${[150, 166, 182, 198, 214, 230].map((y) => `<rect x="0" y="${y}" width="200" height="8"/>`).join("")}</g>${CREW_NECK(c, "#1b1b1f")}`,
  },
  {
    id: "c-snowman", label: "Snowman costume", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#fbfbfb")}<path d="M40 200 Q30 230 46 240 M160 200 Q170 230 154 240" fill="none" stroke="#dde6ee" stroke-width="5" stroke-linecap="round"/>
      <g fill="#2b2b2b">${[198, 214, 230].map((y) => `<circle cx="100" cy="${y}" r="5"/>`).join("")}</g>`,
    collar: (c) => `<rect x="${100 - c.nw / 2 - 10}" y="164" width="${c.nw + 20}" height="16" rx="8" fill="#d6332f"/>
      <path d="M${100 + c.nw / 2 - 2} 172 L${100 + c.nw / 2 + 10} 206 L${100 + c.nw / 2 - 4} 208 L${100 + c.nw / 2 - 10} 176Z" fill="#c02a26"/>
      <path d="M${100 - c.nw / 2 - 6} 168 L${100 - c.nw / 2 - 6} 178 M${100 - c.nw / 2 + 4} 168 L${100 - c.nw / 2 + 4} 178" stroke="#f6f6f6" stroke-width="3"/>`,
  },
  {
    id: "c-bunny-onesie", label: "Bunny onesie", tags: [],
    body: (c) => `${OUTFIT_BASE("#f4f1ec")}${CREW_NECK(c, "#e2dbd0")}<ellipse cx="100" cy="226" rx="30" ry="24" fill="#f6c1d4"/>
      <path d="M100 186 L100 240" stroke="#d6cfc4" stroke-width="2.5"/>`,
  },
  {
    id: "c-bear-onesie", label: "Bear onesie", tags: [],
    body: (c) => `${OUTFIT_BASE("#7a5130")}${CREW_NECK(c, "#5c3c22")}<ellipse cx="100" cy="226" rx="30" ry="24" fill="#c89a6a"/>
      <path d="M100 186 L100 240" stroke="#5c3c22" stroke-width="2.5"/>`,
  },
  {
    id: "c-dino-onesie", label: "Dinosaur onesie", tags: [],
    body: (c) => `${OUTFIT_BASE("#4f9a4a")}${CREW_NECK(c, "#3a7a36")}<ellipse cx="100" cy="228" rx="30" ry="28" fill="#c8de7a"/>
      <path d="M76 214 Q100 220 124 214 M72 228 Q100 234 128 228" fill="none" stroke="#a6c25a" stroke-width="2.5"/>`,
    collar: (c) => bothSides((s) => [0, 1, 2].map((i) => {
      const x = 100 + s * (c.nw / 2 + 14 + i * ((100 - c.shoulderX - c.nw / 2 - 26) / 2));
      const y = 174 + i * 4;
      return `<path d="M${fmt(x - 6)} ${y + 4} L${fmt(x)} ${y - 8} L${fmt(x + 6)} ${y + 4}Z" fill="#f2a93b" stroke="#c97f1f" stroke-width="1.2" stroke-linejoin="round"/>`;
    }).join("")),
  },
  {
    id: "c-clown-suit", label: "Clown suit", highCollar: true, tags: ["highCollar"], clashes: ["necklace"],
    body: () => `${OUTFIT_BASE("#f2c230")}
      <g>${[[30, 196, "#e5484d"], [56, 222, "#3fb7e8"], [148, 200, "#5fcf5a"], [170, 228, "#e5484d"], [128, 230, "#3fb7e8"], [40, 236, "#5fcf5a"]].map(([x, y, f]) => `<circle cx="${x}" cy="${y}" r="7" fill="${f}"/>`).join("")}</g>
      <g fill="#ffffff" stroke="#e5484d" stroke-width="2">${[204, 222].map((y) => `<circle cx="100" cy="${y}" r="6.5"/>`).join("")}</g>`,
    collar: (c) => {
      const w = c.nw / 2 + 22;
      const puffs = [];
      for (let i = 0; i <= 8; i++) puffs.push(`<circle cx="${fmt(100 - w + (i * 2 * w) / 8)}" cy="${fmt(176 + Math.sin((i / 8) * Math.PI) * 8)}" r="8"/>`);
      return `<g fill="#ffffff" stroke="#f28cb1" stroke-width="2">${puffs.join("")}</g>`;
    },
  },
  {
    id: "c-dragon-tamer-vest", label: "Dragon tamer leather vest", tags: [],
    body: () => `${OUTFIT_BASE("#efe4cc")}<path d="M76 172 L96 240 L0 240 L0 180Z M124 172 L104 240 L200 240 L200 180Z" fill="#7a4a2a"/>
      <path d="M92 196 L108 202 M92 210 L108 216 M108 196 L92 202 M108 210 L92 216" stroke="#4a2f1d" stroke-width="2" stroke-linecap="round"/>
      <rect x="0" y="224" width="200" height="9" fill="#4a2f1d"/><rect x="126" y="220" width="18" height="16" rx="3" fill="#6b4a2a" stroke="#4a2f1d" stroke-width="1.5"/>`,
    // Green dragon-scale padding on one shoulder.
    collar: (c) => {
      const x = 200 - c.shoulderX - 18;
      const scales = [];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) scales.push(`<path d="M${fmt(x - 14 + i * 9 + (r % 2) * 4)} ${180 + r * 6} q4.5 7 9 0" fill="#4f9a4a" stroke="#2e5e2b" stroke-width="1.2"/>`);
      return `<path d="M${fmt(x - 18)} 186 Q${fmt(x)} 168 ${fmt(x + 18)} 186 Q${fmt(x)} 198 ${fmt(x - 18)} 186Z" fill="#3a7a36"/>${scales.join("")}`;
    },
  },
];

// ---------- back ----------
// back(ctx): behind everything (even long hair). front(ctx): over the outfit (clasps, straps).

const NO_BACK = { id: "c-no-back", label: "Nothing on the back", back: () => "" };

const CAPE_BACK = (fill) => `<path d="M30 180 Q12 210 2 240 L198 240 Q188 210 170 180 Q100 166 30 180Z" fill="${fill}"/>`;

const BACKS = [
  NO_BACK,
  {
    id: "c-cape", label: "Cape", tags: ["back"],
    back: () => CAPE_BACK("#9c1b26"),
    front: (ctx) => `${bothSides((s) => `<path d="M${100 + s * (ctx.nw / 2 + 4)} 174 Q${100 + s * (100 - ctx.shoulderX - 6)} 178 ${100 + s * (100 - ctx.shoulderX + 4)} 194" fill="none" stroke="#b3202b" stroke-width="7" stroke-linecap="round"/>`)}
      <g fill="#e0b33c">${bothSides((s) => `<circle cx="${100 + s * (ctx.nw / 2 + 6)}" cy="176" r="4.5"/>`)}</g>
      <path d="M${100 - ctx.nw / 2 - 6} 176 Q100 186 ${100 + ctx.nw / 2 + 6} 176" fill="none" stroke="#e0b33c" stroke-width="2"/>`,
  },
  {
    id: "c-royal-cloak", label: "Royal cloak", tags: ["back"],
    back: () => `${CAPE_BACK("#4b237a")}<path d="M10 214 Q6 228 2 240 L18 240 Q22 228 26 214Z M190 214 Q194 228 198 240 L182 240 Q178 228 174 214Z" fill="#fbfaf6"/>`,
    front: (ctx) => `${bothSides((s) => `<path d="M${100 + s * (ctx.nw / 2 + 2)} 172 Q${100 + s * (100 - ctx.shoulderX - 8)} 176 ${100 + s * (100 - ctx.shoulderX + 2)} 196" fill="none" stroke="#fbfaf6" stroke-width="12" stroke-linecap="round"/>`)}
      ${ermineSpots([[100 - ctx.nw / 2 - 12, 178], [100 + ctx.nw / 2 + 12, 178], [ctx.shoulderX + 12, 188], [200 - ctx.shoulderX - 12, 188]])}`,
  },
  {
    id: "c-angel-wings", label: "Angel wings", tags: ["back", "wings"],
    back: () => bothSides((s) => {
      const x = (v) => fmt(100 + s * (100 - v));
      return `<path d="M${x(78)} 186 Q${x(40)} 172 ${x(20)} 140 Q${x(4)} 110 ${x(4)} 64 Q${x(18)} 76 ${x(26)} 96 Q${x(30)} 80 ${x(28)} 66 Q${x(42)} 84 ${x(44)} 106 Q${x(50)} 94 ${x(50)} 82 Q${x(62)} 104 ${x(62)} 130 Q${x(70)} 150 ${x(80)} 166Z" fill="#fbfbf7" stroke="#d6d6cf" stroke-width="2" stroke-linejoin="round"/>
        <path d="M${x(70)} 176 Q${x(36)} 156 ${x(16)} 104 M${x(74)} 168 Q${x(48)} 148 ${x(34)} 108 M${x(76)} 160 Q${x(58)} 140 ${x(52)} 112" fill="none" stroke="#dcdcd5" stroke-width="2" stroke-linecap="round"/>`;
    }),
  },
  {
    id: "c-bat-wings", label: "Bat wings", tags: ["back", "wings"],
    back: () => bothSides((s) => {
      const x = (v) => fmt(100 + s * (100 - v));
      return `<path d="M${x(78)} 184 Q${x(60)} 120 ${x(6)} 66 Q${x(14)} 96 ${x(4)} 120 Q${x(22)} 114 ${x(26)} 136 Q${x(40)} 124 ${x(46)} 148 Q${x(58)} 142 ${x(66)} 170Z" fill="#2c1f33"/>
        <path d="M${x(74)} 178 L${x(8)} 70 M${x(70)} 172 L${x(26)} 134 M${x(72)} 176 L${x(46)} 146" fill="none" stroke="#4a3656" stroke-width="2"/>`;
    }),
  },
  {
    id: "c-backpack", label: "Backpack", tags: ["back"],
    back: () => `<rect x="44" y="148" width="112" height="100" rx="24" fill="#e07b2a"/><path d="M70 152 Q100 140 130 152" fill="none" stroke="#a8561a" stroke-width="5" stroke-linecap="round"/>`,
    front: (ctx) => bothSides((s) => `<path d="M${100 + s * (ctx.nw / 2 + 10)} 172 Q${100 + s * (ctx.nw / 2 + 18)} 204 ${100 + s * (ctx.nw / 2 + 20)} 240" fill="none" stroke="#a8561a" stroke-width="9"/>`),
  },
  // ----- part B -----
  {
    id: "c-fairy-wings", label: "Fairy wings", tags: ["back", "wings"],
    back: () => bothSides((s) => {
      const x = (v) => fmt(100 + s * (100 - v));
      return `<path d="M${x(76)} 176 Q${x(30)} 150 ${x(10)} 96 Q${x(8)} 70 ${x(30)} 80 Q${x(60)} 110 ${x(78)} 168Z" fill="#cdeefa" fill-opacity="0.75" stroke="#8fd0e6" stroke-width="2"/>
        <path d="M${x(78)} 184 Q${x(40)} 196 ${x(22)} 222 Q${x(30)} 236 ${x(48)} 226 Q${x(66)} 210 ${x(80)} 188Z" fill="#f6d2ec" fill-opacity="0.8" stroke="#e0a2cc" stroke-width="2"/>
        <path d="M${x(74)} 170 Q${x(42)} 130 ${x(22)} 92 M${x(76)} 188 Q${x(48)} 206 ${x(32)} 224" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-opacity="0.9"/>
        ${sparkle(Number(x(24)), 104, 4, "#ffffff")}`;
    }),
  },
  {
    id: "c-butterfly-wings", label: "Butterfly wings", tags: ["back", "wings"],
    back: () => bothSides((s) => {
      const x = (v) => fmt(100 + s * (100 - v));
      return `<path d="M${x(78)} 180 Q${x(40)} 120 ${x(8)} 92 Q${x(0)} 140 ${x(30)} 172 Q${x(50)} 184 ${x(78)} 184Z" fill="#f08a24" stroke="#2b2016" stroke-width="3" stroke-linejoin="round"/>
        <path d="M${x(78)} 186 Q${x(40)} 192 ${x(18)} 222 Q${x(26)} 240 ${x(52)} 230 Q${x(70)} 210 ${x(80)} 190Z" fill="#f2c230" stroke="#2b2016" stroke-width="3" stroke-linejoin="round"/>
        <g fill="#ffffff"><circle cx="${x(20)}" cy="112" r="4"/><circle cx="${x(14)}" cy="132" r="3"/><circle cx="${x(32)}" cy="218" r="3.5"/></g>
        <circle cx="${x(42)}" cy="148" r="7" fill="#2b2016"/>`;
    }),
  },
  {
    id: "c-dragon-wings", label: "Dragon wings", tags: ["back", "wings"],
    back: () => bothSides((s) => {
      const x = (v) => fmt(100 + s * (100 - v));
      return `<path d="M${x(78)} 184 L${x(54)} 110 L${x(4)} 62 Q${x(10)} 92 ${x(2)} 110 Q${x(18)} 116 ${x(16)} 140 Q${x(30)} 140 ${x(32)} 162 Q${x(48)} 160 ${x(56)} 180Z" fill="#3f7a3a" stroke="#2a4a27" stroke-width="2" stroke-linejoin="round"/>
        <path d="M${x(54)} 110 L${x(4)} 112 M${x(54)} 110 L${x(16)} 142 M${x(54)} 110 L${x(32)} 164" fill="none" stroke="#2a4a27" stroke-width="2.5"/>
        <path d="M${x(54)} 110 L${x(4)} 62" fill="none" stroke="#a6c46a" stroke-width="3" stroke-linecap="round"/>`;
    }),
  },
  {
    id: "c-jetpack", label: "Jetpack", tags: ["back"],
    back: (ctx) => bothSides((s) => {
      const x = 100 + s * (100 - ctx.shoulderX - 2);
      return `<path d="M${x - 9} 226 L${x} 248 L${x + 9} 226Z" fill="#f2a93b"/><path d="M${x - 5} 226 L${x} 240 L${x + 5} 226Z" fill="#ffe17a"/>
        <rect x="${x - 15}" y="128" width="30" height="96" rx="15" fill="#c9ced4" stroke="#8c939b" stroke-width="2.5"/>
        <rect x="${x - 15}" y="146" width="30" height="7" fill="#e5484d"/>
        <path d="M${x - 9} 136 L${x - 9} 214" stroke="#eef1f4" stroke-width="3" stroke-linecap="round"/>`;
    }),
    front: (ctx) => bothSides((s) => `<path d="M${100 + s * (ctx.nw / 2 + 8)} 172 Q${100 + s * (ctx.nw / 2 + 14)} 204 ${100 + s * (ctx.nw / 2 + 16)} 240" fill="none" stroke="#5b6168" stroke-width="7"/>`) +
      `<rect x="88" y="206" width="24" height="14" rx="3" fill="#8c939b"/><circle cx="100" cy="213" r="3.5" fill="#e5484d"/>`,
  },
  {
    id: "c-turtle-shell", label: "Turtle shell", tags: ["back"],
    back: () => `<path d="${ellipsePath(100, 214, 92, 66)}" fill="#4f8a3a" stroke="#2f5a24" stroke-width="3"/>
      <g fill="#6aa64f" stroke="#2f5a24" stroke-width="2">${[[20, 196], [180, 196], [14, 232], [186, 232]].map(([x, y]) => `<path d="M${x - 12} ${y} L${x - 6} ${y - 10} L${x + 6} ${y - 10} L${x + 12} ${y} L${x + 6} ${y + 10} L${x - 6} ${y + 10}Z"/>`).join("")}</g>`,
    front: (ctx) => bothSides((s) => `<path d="M${100 + s * (ctx.nw / 2 + 8)} 174 Q${100 + s * (ctx.nw / 2 + 12)} 206 ${100 + s * (ctx.nw / 2 + 8)} 240" fill="none" stroke="#7a5a2a" stroke-width="6"/>`),
  },
  {
    id: "c-satchel", label: "Satchel", tags: ["back"],
    // A strap across the chest and the bag at the right hip.
    front: (ctx) => `<path d="M${100 - ctx.nw / 2 - 12} 174 L168 230" stroke="#6b4a2a" stroke-width="7" stroke-linecap="round"/>
      <rect x="138" y="208" width="44" height="34" rx="6" fill="#8a5a2e" stroke="#5c3c22" stroke-width="2"/>
      <path d="M138 214 Q160 230 182 214 L182 208 L138 208Z" fill="#7a4e28" stroke="#5c3c22" stroke-width="2"/>
      <rect x="156" y="220" width="8" height="8" rx="1.5" fill="#c9a24a"/>`,
  },
];

// ---------- held items ----------
// draw(ctx): in the left hand (the viewer's left, x ≈ 18–70, y ≈ 150–235, held items may reach
// higher), with the fist (fist(ctx, x, y)) drawn over the handle. Not drawn in poses that need both
// hands (HAND_BUSY_EXTRAS in placeholder-art.js: clap, crossed arms). The pointing hand is the
// other one, so it never hides the item.

const NO_HELD = { id: "c-no-held", label: "Nothing in the hand", draw: () => "" };

const HELD_ITEMS = [
  NO_HELD,
  {
    id: "c-magic-wand", label: "Magic wand", tags: ["held"],
    draw: (ctx) => `<path d="M48 210 L66 150" stroke="#2b1d14" stroke-width="5" stroke-linecap="round"/>
      <path d="M64.5 155 L66 150" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
      ${sparkle(69, 141, 9, "#ffc21a")}${sparkle(80, 152, 4.5, "#ffe17a")}${fist(ctx)}`,
  },
  {
    id: "c-wizard-staff", label: "Wizard staff", tags: ["held"],
    draw: (ctx) => `<path d="M42 238 L42 56" stroke="#7a5230" stroke-width="7" stroke-linecap="round"/>
      <path d="M42 60 Q28 50 32 36 M42 60 Q56 48 52 34" fill="none" stroke="#7a5230" stroke-width="5" stroke-linecap="round"/>
      <circle cx="42" cy="40" r="17" fill="#bfe9ff" fill-opacity="0.35"/><circle cx="42" cy="40" r="10" fill="#7fd3ff"/><circle cx="38" cy="36" r="3" fill="#ffffff" fill-opacity="0.8"/>
      ${fist(ctx, 23, 196)}`,
  },
  {
    id: "c-scepter", label: "Scepter", tags: ["held"],
    draw: (ctx) => `<path d="M43 226 L43 138" stroke="#d6a92e" stroke-width="6" stroke-linecap="round"/>
      <circle cx="43" cy="130" r="10" fill="#e2b33a" stroke="#a7811f" stroke-width="2"/><circle cx="43" cy="130" r="4.5" fill="#c0392b"/>
      <path d="M43 108 L49 116 L43 122 L37 116Z" fill="#7fc8f0" stroke="#a7811f" stroke-width="1.5"/>
      ${fist(ctx, 24, 196)}`,
  },
  {
    id: "c-lantern", label: "Lantern", tags: ["held"],
    draw: (ctx) => `<circle cx="43" cy="208" r="26" fill="#ffd76a" fill-opacity="0.25"/>
      <path d="M33 186 Q43 168 53 186" fill="none" stroke="#3a3a3a" stroke-width="3"/>
      <path d="M31 186 L55 186 L52 194 L34 194Z" fill="#3a3a3a"/>
      <rect x="32" y="194" width="22" height="30" rx="2" fill="#ffd76a" stroke="#3a3a3a" stroke-width="2.5"/>
      <path d="M43 194 L43 224" stroke="#3a3a3a" stroke-width="1.5"/>
      <path d="M43 202 Q38 210 43 216 Q48 210 43 202Z" fill="#ff8a1f"/>
      <rect x="30" y="224" width="26" height="6" rx="2" fill="#3a3a3a"/>
      ${fist(ctx, 24, 160)}`,
  },
  {
    id: "c-telescope", label: "Telescope", tags: ["held"],
    draw: (ctx) => `<g transform="rotate(-20 43 212)">
        <rect x="38" y="200" width="12" height="38" rx="2" fill="#8a5a2b"/><rect x="39.5" y="160" width="9" height="42" rx="2" fill="#c9a24a"/>
        <rect x="41" y="126" width="6" height="36" rx="2" fill="#e2c46a"/><rect x="40" y="124" width="8" height="5" rx="1" fill="#8a5a2b"/>
      </g>${fist(ctx)}`,
  },
  {
    id: "c-book", label: "Book", tags: ["held"],
    draw: (ctx) => `<rect x="18" y="166" width="48" height="60" rx="3" fill="#7b2d26"/>
      <rect x="62" y="169" width="5" height="54" fill="#f4efe2"/>
      <rect x="28" y="178" width="28" height="4" rx="2" fill="#e0b33c"/><rect x="32" y="186" width="20" height="3" rx="1.5" fill="#e0b33c"/>
      ${fist(ctx, 24, 206)}`,
  },
  {
    id: "c-broom", label: "Broom", tags: ["held"],
    draw: (ctx) => `<path d="M38 96 L42 214" stroke="#8a5a2e" stroke-width="5" stroke-linecap="round"/>
      <path d="M30 212 Q42 205 54 212 L62 240 L22 240Z" fill="#c9a04a"/>
      <path d="M30 220 L26 240 M38 216 L36 240 M46 216 L48 240 M54 220 L58 240" stroke="#a37d33" stroke-width="2"/>
      <rect x="31" y="208" width="22" height="7" rx="2" fill="#7b2d26"/>
      ${fist(ctx, 21, 148)}`,
  },
  {
    id: "c-santa-sack", label: "Santa's sack", tags: ["held"],
    draw: (ctx) => `<path d="M8 240 Q0 198 22 178 Q30 170 42 172 Q54 170 60 180 Q80 202 72 240Z" fill="#8a2f22"/>
      <path d="M22 196 Q40 206 60 196" fill="none" stroke="#6c2219" stroke-width="2.5"/>
      <rect x="34" y="150" width="16" height="12" rx="2" fill="#2e8b57"/><path d="M42 150 L42 162" stroke="#e0b33c" stroke-width="2.5"/>
      <path d="M32 172 Q42 162 52 172" fill="none" stroke="#e0b33c" stroke-width="3"/>
      ${fist(ctx, 23, 160)}`,
  },
  {
    id: "c-gift-box", label: "Gift box", tags: ["held"],
    draw: (ctx) => `<rect x="16" y="176" width="54" height="44" rx="3" fill="#2e86c1"/>
      <rect x="40" y="176" width="7" height="44" fill="#f2c230"/><rect x="16" y="194" width="54" height="7" fill="#f2c230"/>
      <path d="M43.5 176 Q30 160 34 172 Q36 178 43.5 176 Q57 160 53 172 Q51 178 43.5 176Z" fill="#f2c230"/>
      ${fist(ctx, 24, 208)}`,
  },
  {
    id: "c-candle", label: "Candle", tags: ["held"],
    draw: (ctx) => `<circle cx="43" cy="140" r="15" fill="#ffe680" fill-opacity="0.3"/>
      <rect x="37" y="150" width="12" height="46" rx="2" fill="#f4efe2" stroke="#ddd5c2" stroke-width="1.5"/>
      <path d="M43 128 Q36 140 43 149 Q50 140 43 128Z" fill="#ffb52e"/><path d="M43 136 Q40 142 43 147 Q46 142 43 136Z" fill="#ffe680"/>
      <ellipse cx="43" cy="197" rx="17" ry="4.5" fill="#d6a92e"/><rect x="40" y="197" width="6" height="10" fill="#d6a92e"/>
      ${fist(ctx, 24, 204)}`,
  },
  {
    id: "c-balloon", label: "Balloon", tags: ["held"],
    draw: (ctx) => `<path d="M43 206 Q34 150 30 104" fill="none" stroke="#666" stroke-width="1.4"/>
      <ellipse cx="28" cy="80" rx="20" ry="24" fill="#e8434f"/>
      <path d="M26 103 L34 103 L30 98Z" fill="#c2323d"/>
      <ellipse cx="21" cy="70" rx="5" ry="8" fill="#ffffff" fill-opacity="0.45"/>
      ${fist(ctx)}`,
  },
  {
    id: "c-coffee-cup", label: "Coffee cup", tags: ["held"],
    draw: (ctx) => `<path d="M34 164 Q30 156 36 150 M46 162 Q42 154 48 148" fill="none" stroke="#c8c8c8" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M26 174 L60 174 L56 226 L30 226Z" fill="#f2f2ef"/>
      <rect x="24" y="167" width="38" height="9" rx="3" fill="#3b2a20"/>
      <path d="M28 190 L58 190 L57 206 L29 206Z" fill="#a0703f"/>
      ${fist(ctx, 24, 200)}`,
  },
  // ----- part B -----
  {
    id: "c-map", label: "Map", tags: ["held"],
    draw: (ctx) => `<path d="M10 150 L72 146 L74 204 L12 208Z" fill="#f1e3c0" stroke="#c9b07a" stroke-width="2"/>
      <rect x="6" y="146" width="10" height="64" rx="5" fill="#e3cf9e" stroke="#c9b07a" stroke-width="2" transform="rotate(-4 11 178)"/>
      <path d="M22 196 Q32 180 44 186 Q54 192 60 166" fill="none" stroke="#a0703f" stroke-width="2" stroke-dasharray="3 3"/>
      <path d="M56 162 L64 170 M64 162 L56 170" stroke="#c0392b" stroke-width="3" stroke-linecap="round"/>
      <path d="M26 158 Q34 152 40 160 Q46 168 38 172" fill="none" stroke="#5f9bad" stroke-width="2.5"/>
      ${fist(ctx, 24, 198)}`,
  },
  {
    id: "c-quill", label: "Quill", tags: ["held"],
    draw: (ctx) => `<path d="M42 226 L46 206" stroke="#2b2b2b" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M46 206 Q40 170 62 128 Q72 150 64 176 Q58 196 46 206Z" fill="#fbfbf7" stroke="#cfcfc6" stroke-width="1.5"/>
      <path d="M46 206 Q54 170 62 128" fill="none" stroke="#bdbdb4" stroke-width="1.5"/>
      ${fist(ctx)}`,
  },
  {
    id: "c-crystal-ball", label: "Crystal ball", tags: ["held"],
    draw: (ctx) => `<circle cx="43" cy="170" r="30" fill="#d9c8ff" fill-opacity="0.25"/>
      <path d="M28 196 L58 196 L54 206 L32 206Z" fill="#c9a24a" stroke="#8a6a2a" stroke-width="1.5"/>
      <circle cx="43" cy="174" r="22" fill="#b9a6f0" fill-opacity="0.85" stroke="#8b77d0" stroke-width="2"/>
      <path d="M34 162 Q40 156 48 158" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.8"/>
      ${sparkle(50, 178, 4, "#ffffff")}${fist(ctx, 24, 204)}`,
  },
  {
    id: "c-flag", label: "Flag", tags: ["held"],
    // A plain pennant (no country's flag).
    draw: (ctx) => `<path d="M44 236 L42 78" stroke="#8a8f96" stroke-width="4" stroke-linecap="round"/>
      <path d="M42 82 L2 98 L42 116Z" fill="#f08a24"/><path d="M42 94 L24 99.5 L42 104Z" fill="#f7c948"/>
      <circle cx="42" cy="76" r="4" fill="#e0b33c"/>
      ${fist(ctx)}`,
  },
  {
    id: "c-trophy", label: "Trophy", tags: ["held"],
    draw: (ctx) => `<path d="M26 150 Q12 150 14 162 Q16 174 30 174 M60 150 Q74 150 72 162 Q70 174 56 174" fill="none" stroke="#c99a25" stroke-width="4"/>
      <path d="M24 144 L62 144 Q62 178 43 184 Q24 178 24 144Z" fill="#e2b33a" stroke="#a7811f" stroke-width="2"/>
      <rect x="39" y="184" width="8" height="12" fill="#c99a25"/><rect x="29" y="194" width="28" height="10" rx="2" fill="#8a5a2e"/>
      ${star5(43, 160, 7, "#fff3b0")}${fist(ctx, 24, 202)}`,
  },
  {
    id: "c-pumpkin-basket", label: "Pumpkin basket", tags: ["held"],
    draw: (ctx) => `<path d="M24 196 Q24 168 43 166 Q62 168 62 196" fill="none" stroke="#2b2b2b" stroke-width="3"/>
      <ellipse cx="43" cy="214" rx="28" ry="24" fill="#f08a24"/>
      <path d="M43 192 Q36 214 43 236 M43 192 Q50 214 43 236" fill="none" stroke="#c9671a" stroke-width="2"/>
      <ellipse cx="43" cy="194" rx="20" ry="5" fill="#a84f12"/>
      <g fill="#7a3a0e"><path d="M28 208 L34 200 L40 208Z M46 208 L52 200 L58 208Z"/><path d="M30 218 Q43 230 56 218 Q43 224 30 218Z"/></g>
      <g><circle cx="36" cy="190" r="4" fill="#e5484d"/><circle cx="48" cy="189" r="4" fill="#3fb7e8"/></g>
      ${fist(ctx, 24, 162)}`,
  },
  {
    id: "c-easter-basket", label: "Easter basket", tags: ["held"],
    draw: (ctx) => `<path d="M20 198 Q22 160 43 158 Q64 160 66 198" fill="none" stroke="#a37d33" stroke-width="4"/>
      <ellipse cx="32" cy="196" rx="7" ry="9" fill="#f6b3c8"/><ellipse cx="45" cy="194" rx="7" ry="9" fill="#9fd3e6"/><ellipse cx="56" cy="197" rx="6.5" ry="8.5" fill="#f7e27a"/>
      <path d="M48 192 L42 196 L48 200" fill="none" stroke="#ffffff" stroke-width="1.5"/>
      <path d="M14 200 L72 200 L66 232 L20 232Z" fill="#c9a04a"/>
      <path d="M17 210 L69 210 M19 220 L67 220 M28 200 L30 232 M43 200 L43 232 M58 200 L56 232" stroke="#a37d33" stroke-width="2"/>
      <path d="M16 200 Q24 194 30 200 Q38 194 44 200 Q52 194 58 200 Q64 194 70 200" fill="none" stroke="#7fbf5a" stroke-width="3"/>
      ${fist(ctx, 24, 154)}`,
  },
  {
    id: "c-umbrella", label: "Umbrella", tags: ["held"],
    draw: (ctx) => `<path d="M43 214 L43 232 Q43 240 34 238" fill="none" stroke="#5c3c22" stroke-width="5" stroke-linecap="round"/>
      <path d="M43 104 L43 112" stroke="#5b6168" stroke-width="3" stroke-linecap="round"/>
      <path d="M43 110 Q30 150 34 198 L52 198 Q56 150 43 110Z" fill="#2f74c0" stroke="#1f5fa8" stroke-width="2"/>
      <path d="M43 112 Q40 150 42 196 M43 112 Q48 150 47 196" fill="none" stroke="#1f5fa8" stroke-width="1.5"/>
      <path d="M36 168 L50 168" stroke="#f7c948" stroke-width="3"/>
      ${fist(ctx, 24, 196)}`,
  },
  {
    id: "c-magnifying-glass", label: "Magnifying glass", tags: ["held"],
    draw: (ctx) => `<path d="M42 222 L50 178" stroke="#5c3c22" stroke-width="7" stroke-linecap="round"/>
      <circle cx="54" cy="158" r="20" fill="#dff2ff" fill-opacity="0.45" stroke="#b8862f" stroke-width="5"/>
      <path d="M44 150 Q48 144 56 144" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      ${fist(ctx)}`,
  },
  {
    id: "c-potion", label: "Potion flask", tags: ["held"],
    draw: (ctx) => `<g fill="#b9f0a6"><circle cx="38" cy="132" r="3"/><circle cx="48" cy="124" r="4"/><circle cx="42" cy="114" r="2.5"/></g>
      <rect x="37" y="140" width="12" height="8" rx="2" fill="#a0703f"/>
      <path d="M38 148 L48 148 L48 162 Q66 170 64 190 Q60 212 43 212 Q26 212 22 190 Q20 170 38 162Z" fill="#e8f4f6" fill-opacity="0.8" stroke="#8fb3bb" stroke-width="2"/>
      <path d="M24 186 Q43 178 62 186 Q60 210 43 210 Q26 210 24 186Z" fill="#7ed957"/>
      <circle cx="36" cy="196" r="3" fill="#c8f5b0"/><circle cx="50" cy="200" r="2" fill="#c8f5b0"/>
      ${fist(ctx, 24, 204)}`,
  },
  {
    id: "c-wrench", label: "Wrench", tags: ["held"],
    draw: (ctx) => `<path d="M41 230 L56 156" stroke="#9aa3ad" stroke-width="9" stroke-linecap="round"/>
      <path d="M48 140 Q50 152 58 156 Q66 156 70 148 L64 142 L62 148 L56 146 L56 138 L62 134 Q52 130 48 140Z" fill="#9aa3ad" stroke="#6f7882" stroke-width="2" stroke-linejoin="round"/>
      ${fist(ctx)}`,
  },
  {
    id: "c-electric-guitar", label: "Electric guitar", tags: ["held"],
    // No brand: a made-up shape.
    draw: (ctx) => `<path d="M34 210 L16 116" stroke="#6b3e22" stroke-width="7" stroke-linecap="round"/>
      <path d="M8 104 L20 102 L22 118 L12 120Z" fill="#1d1d22"/>
      <path d="M22 196 Q34 188 40 198 Q50 196 52 210 Q62 220 52 234 Q40 246 22 238 Q6 232 8 214 Q10 200 22 196Z" fill="#d23c3c" stroke="#8e1b1b" stroke-width="2"/>
      <rect x="22" y="212" width="18" height="5" rx="2" fill="#2b2b2b" transform="rotate(-20 31 214)"/>
      <circle cx="44" cy="226" r="3" fill="#f4f4f4"/>
      <path d="M36 206 L17 118" stroke="#e8e8e8" stroke-width="1"/>
      ${fist(ctx, 4, 150)}`,
  },
  {
    id: "c-game-controller", label: "Game controller", tags: ["held"],
    // No brand: a made-up shape.
    draw: (ctx) => `<path d="M14 192 Q16 178 30 180 L58 180 Q72 178 74 192 L78 214 Q78 224 68 222 Q60 220 56 210 L32 210 Q28 220 20 222 Q10 224 10 214Z" fill="#3a3d45" stroke="#22242a" stroke-width="2"/>
      <path d="M24 192 L32 192 M28 188 L28 196" stroke="#c9ced4" stroke-width="3" stroke-linecap="round"/>
      <circle cx="60" cy="189" r="3" fill="#e5484d"/><circle cx="66" cy="195" r="3" fill="#3fb7e8"/><circle cx="54" cy="195" r="3" fill="#5fcf5a"/><circle cx="60" cy="201" r="3" fill="#f7c948"/>
      ${fist(ctx, 10, 204)}`,
  },
  {
    id: "c-microphone", label: "Microphone", tags: ["held"],
    draw: (ctx) => `<path d="M43 226 L46 176" stroke="#2b2b2b" stroke-width="8" stroke-linecap="round"/>
      <circle cx="47" cy="164" r="13" fill="#9aa3ad" stroke="#5b6168" stroke-width="2"/>
      <path d="M38 158 L56 158 M36 164 L58 164 M38 170 L56 170 M47 152 L47 176 M41 153 L41 175 M53 153 L53 175" stroke="#5b6168" stroke-width="1.2"/>
      ${fist(ctx)}`,
  },
  {
    id: "c-lasso", label: "Lasso", tags: ["held"],
    draw: (ctx) => `<ellipse cx="38" cy="176" rx="26" ry="32" fill="none" stroke="#c9a16a" stroke-width="4"/>
      <ellipse cx="40" cy="178" rx="20" ry="26" fill="none" stroke="#b38a52" stroke-width="4"/>
      <path d="M54 214 Q66 228 60 240" fill="none" stroke="#c9a16a" stroke-width="4" stroke-linecap="round"/>
      ${fist(ctx)}`,
  },
  {
    id: "c-ringmaster-cane", label: "Ringmaster's cane", tags: ["held"],
    draw: (ctx) => `<path d="M42 240 L46 136" stroke="#1d1d22" stroke-width="5" stroke-linecap="round"/>
      <path d="M42 236 L42 240" stroke="#f4f4f4" stroke-width="5"/>
      <circle cx="46" cy="132" r="7" fill="#e0b33c" stroke="#a7811f" stroke-width="2"/>
      ${fist(ctx)}`,
  },
  {
    id: "c-clipboard", label: "Clipboard", tags: ["held"],
    draw: (ctx) => `<rect x="14" y="156" width="54" height="68" rx="4" fill="#a0703f"/>
      <rect x="19" y="164" width="44" height="56" fill="#fbfbf7"/>
      <rect x="31" y="152" width="20" height="10" rx="3" fill="#9aa3ad" stroke="#6f7882" stroke-width="1.5"/>
      <path d="M26 176 L56 176 M26 186 L52 186 M26 196 L56 196" stroke="#c9ced4" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M22 174 L24 177 L28 171 M22 184 L24 187 L28 181" fill="none" stroke="#5fcf5a" stroke-width="2"/>
      ${fist(ctx, 24, 206)}`,
  },
  {
    id: "c-wooden-spoon", label: "Wooden spoon", tags: ["held"],
    draw: (ctx) => `<path d="M42 226 L56 156" stroke="#c08a52" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="59" cy="142" rx="10" ry="15" fill="#c99560" stroke="#8a5a2b" stroke-width="2" transform="rotate(12 59 142)"/>
      ${fist(ctx)}`,
  },
  {
    id: "c-gavel", label: "Gavel", tags: ["held"],
    draw: (ctx) => `<path d="M42 224 L52 162" stroke="#8a5a2e" stroke-width="5" stroke-linecap="round"/>
      <g transform="rotate(10 54 152)"><rect x="32" y="142" width="44" height="20" rx="4" fill="#7a4a2a" stroke="#5c3c22" stroke-width="2"/>
        <rect x="30" y="144" width="6" height="16" rx="2" fill="#c9a24a"/><rect x="72" y="144" width="6" height="16" rx="2" fill="#c9a24a"/></g>
      ${fist(ctx)}`,
  },
  {
    id: "c-loot-sack", label: "Loot sack", tags: ["held"],
    draw: (ctx) => `<path d="M10 240 Q2 200 24 184 Q32 178 43 180 Q54 178 62 186 Q80 204 74 240Z" fill="#8c939b"/>
      <path d="M30 180 Q43 172 56 180 L52 170 Q43 166 34 170Z" fill="#7d848c"/>
      <path d="M32 178 Q43 172 54 178" fill="none" stroke="#5b6168" stroke-width="3"/>
      <rect x="44" y="208" width="18" height="16" rx="2" fill="#a0a7ae" stroke="#6f7882" stroke-width="1.2" stroke-dasharray="2 1.5"/>
      ${fist(ctx, 23, 156)}`,
  },
  {
    id: "c-compass", label: "Compass", tags: ["held"],
    draw: (ctx) => `<circle cx="43" cy="176" r="20" fill="#c99a25" stroke="#8a6a2a" stroke-width="2"/>
      <circle cx="43" cy="176" r="15" fill="#f6efdc"/>
      <circle cx="43" cy="154" r="4" fill="none" stroke="#c99a25" stroke-width="3"/>
      <path d="M43 164 L47 176 L43 176Z" fill="#c0392b"/><path d="M43 164 L39 176 L43 176Z" fill="#e5484d"/>
      <path d="M43 188 L47 176 L43 176Z" fill="#9aa3ad"/><path d="M43 188 L39 176 L43 176Z" fill="#c9ced4"/>
      <circle cx="43" cy="176" r="2" fill="#2b2b2b"/>
      ${fist(ctx, 24, 192)}`,
  },
  {
    id: "c-serving-tray", label: "Serving tray with cloche", tags: ["held"],
    draw: (ctx) => `<path d="M14 168 Q16 132 43 130 Q70 132 72 168Z" fill="#d6dbe0" stroke="#9aa3ad" stroke-width="2"/>
      <path d="M24 156 Q28 140 40 136" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <circle cx="43" cy="127" r="4" fill="#9aa3ad"/>
      <ellipse cx="43" cy="170" rx="36" ry="7" fill="#c4ccd4" stroke="#8c939b" stroke-width="2"/>
      ${fist(ctx, 24, 176)}`,
  },
];

// ---------- shoulder pets ----------
// draw(ctx): on the right shoulder (the viewer's right). Drawn sitting on a shoulder at (162, 190)
// and moved to where this body's shoulder is (ctx.shoulder). The pointing hand is drawn in front.

const NO_PET = { id: "c-no-pet", label: "No pet", draw: () => "" };

const PETS = [
  NO_PET,
  {
    id: "c-parrot", label: "Parrot", tags: ["pet"],
    draw: () => `<path d="M168 176 L182 216 L172 214 L162 182Z" fill="#1e6fd9"/>
      <ellipse cx="162" cy="162" rx="13" ry="20" fill="#e53935"/>
      <path d="M154 152 Q146 170 158 188 Q172 174 168 152Z" fill="#1e6fd9"/><path d="M155 170 Q152 180 158 188" fill="none" stroke="#f9c22e" stroke-width="3"/>
      <circle cx="164" cy="140" r="11" fill="#e53935"/>
      <circle cx="167" cy="137" r="4.5" fill="#ffffff"/><circle cx="168" cy="137" r="2" fill="#222"/>
      <path d="M173 136 Q184 140 178 151 Q174 147 171 143Z" fill="#f1e5c8" stroke="#3a3a3a" stroke-width="1.5"/>
      <path d="M156 188 L154 194 M164 188 L166 194" stroke="#777" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  {
    id: "c-owl", label: "Owl", tags: ["pet"],
    draw: () => `<path d="M148 150 L150 136 L157 146Z M176 150 L174 136 L167 146Z" fill="#6f523a"/>
      <ellipse cx="162" cy="166" rx="18" ry="23" fill="#8b6a4a"/>
      <ellipse cx="162" cy="174" rx="11" ry="14" fill="#d8c3a0"/>
      <g fill="#ffffff"><circle cx="155" cy="157" r="7"/><circle cx="169" cy="157" r="7"/></g>
      <g fill="#f2a72e"><circle cx="155" cy="157" r="4"/><circle cx="169" cy="157" r="4"/></g>
      <g fill="#222"><circle cx="155" cy="157" r="2"/><circle cx="169" cy="157" r="2"/></g>
      <path d="M159 163 L165 163 L162 169Z" fill="#e08a1f"/>
      <path d="M154 189 L152 194 M158 189 L158 195 M166 189 L166 195 M170 189 L172 194" stroke="#e08a1f" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  {
    id: "c-black-cat", label: "Black cat", tags: ["pet"],
    draw: () => `<path d="M176 186 Q194 180 190 158" fill="none" stroke="#1f1f24" stroke-width="6" stroke-linecap="round"/>
      <path d="M148 190 Q146 162 162 156 Q178 162 176 190Z" fill="#1f1f24"/>
      <circle cx="162" cy="146" r="13" fill="#1f1f24"/>
      <path d="M151 140 L152 127 L160 136Z M173 140 L172 127 L164 136Z" fill="#1f1f24"/>
      <g fill="#7ed957"><ellipse cx="157" cy="146" rx="3.2" ry="3.6"/><ellipse cx="167" cy="146" rx="3.2" ry="3.6"/></g>
      <g fill="#111"><rect x="156.3" y="143" width="1.4" height="6" rx="0.7"/><rect x="166.3" y="143" width="1.4" height="6" rx="0.7"/></g>
      <path d="M160 151 L164 151 L162 153Z" fill="#f2a7b8"/>
      <path d="M150 152 L140 150 M150 155 L140 157 M174 152 L184 150 M174 155 L184 157" stroke="#9a9aa2" stroke-width="1"/>`,
  },
  // ----- part B -----
  {
    id: "c-small-dragon", label: "Small dragon", tags: ["pet"],
    draw: () => `<path d="M174 186 Q192 184 188 166 Q186 158 180 160" fill="none" stroke="#4f9a4a" stroke-width="6" stroke-linecap="round"/>
      <path d="M184 158 L178 154 L182 164Z" fill="#f2a93b"/>
      <path d="M156 160 Q138 140 142 128 Q150 140 160 146Z M168 160 Q186 140 182 128 Q174 140 164 146Z" fill="#7fc46a" stroke="#3a7a36" stroke-width="1.5" stroke-linejoin="round"/>
      <ellipse cx="162" cy="174" rx="15" ry="19" fill="#4f9a4a"/>
      <ellipse cx="162" cy="180" rx="8" ry="11" fill="#c8de7a"/>
      <circle cx="162" cy="146" r="12" fill="#4f9a4a"/>
      <path d="M154 136 L152 126 L158 134Z M170 136 L172 126 L166 134Z" fill="#f2a93b"/>
      <ellipse cx="162" cy="152" rx="7" ry="5" fill="#6aae5a"/>
      <g fill="#ffffff"><circle cx="157" cy="143" r="3.5"/><circle cx="167" cy="143" r="3.5"/></g>
      <g fill="#222"><circle cx="157.5" cy="143.5" r="1.8"/><circle cx="167.5" cy="143.5" r="1.8"/></g>
      <path d="M155 192 L153 196 M169 192 L171 196" stroke="#3a7a36" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "c-raven", label: "Raven", tags: ["pet"],
    draw: () => `<path d="M168 178 L184 212 L174 210 L162 184Z" fill="#26262c"/>
      <ellipse cx="162" cy="166" rx="14" ry="20" fill="#2b2b33"/>
      <path d="M152 156 Q146 174 158 190 Q170 176 166 154Z" fill="#3a3a44"/>
      <circle cx="164" cy="142" r="11" fill="#2b2b33"/>
      <circle cx="167" cy="139" r="3.5" fill="#ffffff"/><circle cx="168" cy="139" r="1.8" fill="#111"/>
      <path d="M173 140 L186 145 L172 148Z" fill="#5b6168"/>
      <path d="M156 188 L154 194 M164 188 L166 194" stroke="#5b6168" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  {
    id: "c-frog-crown", label: "Frog with a crown", tags: ["pet"],
    draw: () => `<ellipse cx="162" cy="178" rx="20" ry="15" fill="#5fae4a"/>
      <ellipse cx="162" cy="182" rx="12" ry="9" fill="#c8e6a0"/>
      <path d="M144 190 Q140 184 148 182 M180 190 Q184 184 176 182" fill="none" stroke="#4a8f38" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="162" cy="162" rx="17" ry="12" fill="#5fae4a"/>
      <g fill="#5fae4a"><circle cx="153" cy="153" r="7"/><circle cx="171" cy="153" r="7"/></g>
      <g fill="#ffffff"><circle cx="153" cy="153" r="4.5"/><circle cx="171" cy="153" r="4.5"/></g>
      <g fill="#222"><circle cx="153.5" cy="153.5" r="2.2"/><circle cx="171.5" cy="153.5" r="2.2"/></g>
      <path d="M155 166 Q162 170 169 166" fill="none" stroke="#2f5a24" stroke-width="2" stroke-linecap="round"/>
      <path d="M154 146 L153 134 L158 140 L162 132 L166 140 L171 134 L170 146Z" fill="#e2b33a" stroke="#a7811f" stroke-width="1.5" stroke-linejoin="round"/>`,
  },
  {
    id: "c-white-mouse", label: "White mouse", tags: ["pet"],
    draw: () => `<path d="M176 188 Q192 188 190 172 Q188 164 182 168" fill="none" stroke="#f2a7b8" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="164" cy="178" rx="14" ry="13" fill="#f6f6f4" stroke="#d6d6d0" stroke-width="1.5"/>
      <g fill="#f6f6f4" stroke="#d6d6d0" stroke-width="1.5"><circle cx="153" cy="152" r="7"/><circle cx="171" cy="152" r="7"/></g>
      <g fill="#f6b3c8"><circle cx="153" cy="152" r="4"/><circle cx="171" cy="152" r="4"/></g>
      <ellipse cx="162" cy="164" rx="11" ry="10" fill="#f6f6f4" stroke="#d6d6d0" stroke-width="1.5"/>
      <g fill="#222"><circle cx="158" cy="162" r="1.8"/><circle cx="166" cy="162" r="1.8"/></g>
      <circle cx="162" cy="168" r="2.2" fill="#f28cb1"/>
      <path d="M156 168 L146 166 M156 170 L146 172 M168 168 L178 166 M168 170 L178 172" stroke="#b9b5ad" stroke-width="1"/>`,
  },
  {
    id: "c-small-robot", label: "Small robot", tags: ["pet"],
    draw: () => `<rect x="148" y="166" width="28" height="26" rx="5" fill="#a9b4bf" stroke="#6c7682" stroke-width="2"/>
      <circle cx="162" cy="179" r="4" fill="#5fcf5a"/>
      <path d="M162 140 L162 132" stroke="#6c7682" stroke-width="2.5"/><circle cx="162" cy="130" r="3.5" fill="#e5484d"/>
      <rect x="146" y="140" width="32" height="24" rx="7" fill="#c4ccd4" stroke="#6c7682" stroke-width="2"/>
      <g fill="#c4f3ff" stroke="#6c7682" stroke-width="1.5"><circle cx="155" cy="152" r="5"/><circle cx="169" cy="152" r="5"/></g>
      <g fill="#222"><circle cx="155" cy="152" r="2"/><circle cx="169" cy="152" r="2"/></g>
      <path d="M152 192 L152 196 M172 192 L172 196" stroke="#6c7682" stroke-width="3" stroke-linecap="round"/>`,
  },
];

// ---------- registering the costume fields ----------

// field -> the list, in the order of LOOK_FIELDS. The look stores the ids (None by default).
const COSTUME_OPTIONS = {
  headwear: HEADWEAR,
  mask: MASKS,
  earsHorns: EARS_HORNS,
  costumeBeard: COSTUME_BEARDS,
  costumeOutfit: COSTUME_OUTFITS,
  back: BACKS,
  held: HELD_ITEMS,
  pet: PETS,
};
const COSTUME_FIELDS = Object.keys(COSTUME_OPTIONS);

// The layer name of each field's PNGs (assets/avatar/<category>/<id>.png), one per drawing:
// headwear (draw), headwear-back (behind), headwear-face (face); mask (under), mask-paint,
// mask-over; costume-beard; ears-horns; costume-outfit (body and collar together, like outfits),
// costume-outfit-head, costume-outfit-face; back (back), back-front (front); held; pet.
const COSTUME_PNG_CATEGORIES = {
  headwear: "headwear", mask: "mask", earsHorns: "ears-horns", costumeBeard: "costume-beard",
  costumeOutfit: "costume-outfit", back: "back", held: "held", pet: "pet",
};

const COSTUME_DRAWINGS = ["draw", "behind", "face", "paint", "under", "over", "body", "collar", "head", "back", "front"];

// An item is offered if it can be drawn: an SVG drawing or a listed PNG (None always is).
function costumeItemUsable(field, item, index) {
  if (index === 0) return true;
  if (COSTUME_DRAWINGS.some((key) => typeof item[key] === "function")) return true;
  const category = COSTUME_PNG_CATEGORIES[field];
  return AVATAR_PNG_FILES.some((name) => name.endsWith(`/${item.id}`) && name.startsWith(category));
}
for (const field of COSTUME_FIELDS) {
  COSTUME_OPTIONS[field] = COSTUME_OPTIONS[field].filter((item, i) => costumeItemUsable(field, item, i));
}

for (const field of COSTUME_FIELDS) {
  SHARED_OPTIONS[field] = COSTUME_OPTIONS[field];
  LOOK_FIELDS.push(field);
  for (const gender of Object.keys(DEFAULT_LOOKS)) DEFAULT_LOOKS[gender][field] = COSTUME_OPTIONS[field][0].id;
}

// Only the costume fields of a look (for keeping them across a gender switch). With gender
// "female", the costume beard becomes None: a female look never gets one from a preset or a switch
// (it can still be added by hand).
function costumeOf(look, gender) {
  const costume = {};
  for (const field of COSTUME_FIELDS) costume[field] = look[field];
  if (gender === "female") costume.costumeBeard = COSTUME_OPTIONS.costumeBeard[0].id;
  return costume;
}

// ---------- clashes ----------

// The tags of everything in a look: its costume items' tags plus the base look's own.
function lookTags(look) {
  const tags = new Set();
  const gender = look.gender;
  for (const field of ["eyewear", "earrings", "necklace", "facialHair"]) {
    const options = lookOptions(field, gender);
    if (options.length && look[field] !== options[0].id) tags.add(field);
  }
  for (const field of COSTUME_FIELDS) {
    const item = optionById(field, look[field]);
    if (item) for (const tag of item.tags || []) tags.add(tag);
  }
  return tags;
}

function clashesWith(item, tags, clashes) {
  return (item.clashes || []).some((tag) => tags.has(tag)) || (item.tags || []).some((tag) => clashes.has(tag));
}

// Randomize's costume part: each category about 12% of the time, never an item that clashes with
// the rest of the look (the base look is picked first). The editor still allows every combination.
const COSTUME_RANDOM_CHANCE = 0.12;

function randomCostume(look) {
  const result = { ...look };
  for (const field of COSTUME_FIELDS) result[field] = COSTUME_OPTIONS[field][0].id;
  const tags = lookTags(result);
  const clashes = new Set();
  // A high collar (outfit) and a necklace already rule each other out in randomLook.
  const outfit = optionById("outfit", look.outfit, look.gender);
  if (outfit && outfit.highCollar) tags.add("highCollar");
  for (const field of COSTUME_FIELDS) {
    if (!randomChance(COSTUME_RANDOM_CHANCE)) continue;
    const candidates = COSTUME_OPTIONS[field].slice(1).filter((item) => !clashesWith(item, tags, clashes));
    if (candidates.length === 0) continue;
    const item = randomItem(candidates);
    result[field] = item.id;
    for (const tag of item.tags || []) tags.add(tag);
    for (const tag of item.clashes || []) clashes.add(tag);
  }
  return result;
}

// ---------- costume presets ----------
// One tap in the editor sets every costume field: the preset's items, None for the rest. skin /
// hairColor (optional) change those too. Never the name, personality, gender, face, hairstyle,
// outfit, eyewear, earrings, necklace or facial hair. Every item can still be changed afterwards.
// On a female look a preset never adds a costume beard. theme: one of COSTUME_THEMES (the editor
// shows one theme's presets at a time). description: read out after the label.
// No two presets may set the same items (the editor marks the theme of the one being worn).

const COSTUME_THEMES = [
  { id: "fantasy", label: "Fantasy" },
  { id: "horror", label: "Horror" },
  { id: "history", label: "History" },
  { id: "jobs", label: "Jobs" },
  { id: "fun", label: "Fun" },
];

const COSTUME_PRESETS = [
  // Fantasy
  { id: "p-witch", label: "Witch", theme: "fantasy", items: { headwear: "c-witch-hat", costumeOutfit: "c-witch-dress", held: "c-broom", pet: "c-black-cat" } },
  { id: "p-wizard", label: "Wizard", theme: "fantasy", items: { headwear: "c-wizard-hat", costumeBeard: "c-wizard-beard", costumeOutfit: "c-wizard-robe", held: "c-wizard-staff", pet: "c-owl" } },
  { id: "p-king", label: "King", theme: "fantasy", items: { headwear: "c-crown", costumeOutfit: "c-royal-robe", back: "c-royal-cloak", held: "c-scepter" } },
  { id: "p-queen", label: "Queen", theme: "fantasy", items: { headwear: "c-crown", costumeOutfit: "c-royal-gown", back: "c-royal-cloak", held: "c-scepter" } },
  { id: "p-elf", label: "Elf", theme: "fantasy", items: { headwear: "c-elf-hat", earsHorns: "c-elf-ears", costumeOutfit: "c-elf-outfit", back: "c-satchel" } },
  { id: "p-dwarf", label: "Dwarf", theme: "fantasy", items: { headwear: "c-dwarf-hood", costumeBeard: "c-dwarf-beard", costumeOutfit: "c-dwarf-tunic", held: "c-lantern" } },
  { id: "p-fairy", label: "Fairy", theme: "fantasy", items: { mask: "c-glitter", earsHorns: "c-fairy-ears", costumeOutfit: "c-fairy-dress", back: "c-fairy-wings", held: "c-magic-wand" } },
  { id: "p-angel", label: "Angel", theme: "fantasy", items: { headwear: "c-halo", costumeOutfit: "c-angel-robe", back: "c-angel-wings" } },
  { id: "p-devil", label: "Devil", theme: "fantasy", items: { earsHorns: "c-small-horns", costumeOutfit: "c-devil-suit", back: "c-bat-wings" } },
  { id: "p-dragon-tamer", label: "Dragon tamer", theme: "fantasy", items: { costumeOutfit: "c-dragon-tamer-vest", back: "c-satchel", held: "c-map", pet: "c-small-dragon" } },
  { id: "p-prince", label: "Prince", theme: "fantasy", items: { headwear: "c-coronet", costumeOutfit: "c-prince-outfit", back: "c-cape" } },
  { id: "p-princess", label: "Princess", theme: "fantasy", items: { headwear: "c-tiara", costumeOutfit: "c-princess-dress", held: "c-magic-wand" } },
  { id: "p-jester", label: "Jester", theme: "fantasy", items: { headwear: "c-jester-hat", costumeOutfit: "c-jester-suit" } },
  { id: "p-scarecrow", label: "Scarecrow", theme: "fantasy", items: { headwear: "c-straw-hat", costumeOutfit: "c-scarecrow", pet: "c-raven" } },
  // Horror
  { id: "p-vampire", label: "Vampire", theme: "horror", items: { mask: "c-fangs", costumeOutfit: "c-vampire-cape", held: "c-candle" }, hairColor: "black" },
  { id: "p-ghost", label: "Ghost", theme: "horror", items: { costumeOutfit: "c-ghost-sheet", held: "c-lantern" } },
  { id: "p-skeleton", label: "Skeleton", theme: "horror", items: { mask: "c-skeleton-paint", costumeOutfit: "c-skeleton-suit", held: "c-candle" } },
  { id: "p-mummy", label: "Mummy", theme: "horror", items: { mask: "c-mummy-bandages", costumeOutfit: "c-mummy-wraps" } },
  { id: "p-masked-figure", label: "Masked figure", theme: "horror", items: { mask: "c-white-mask", costumeOutfit: "c-dark-cloak", held: "c-lantern" } },
  { id: "p-plague-doctor", label: "Plague doctor", theme: "horror", items: { headwear: "c-plague-hat", mask: "c-plague-mask", costumeOutfit: "c-judge-robe", held: "c-lantern", pet: "c-raven" } },
  { id: "p-pumpkin-head", label: "Pumpkin head", theme: "horror", items: { headwear: "c-pumpkin-head", costumeOutfit: "c-pumpkin-costume", held: "c-pumpkin-basket" } },
  // History
  { id: "p-pirate", label: "Pirate", theme: "history", items: { headwear: "c-tricorne", mask: "c-eye-patch", costumeBeard: "c-pirate-beard", costumeOutfit: "c-pirate-coat", held: "c-telescope", pet: "c-parrot" } },
  { id: "p-general", label: "General", description: "a Napoleon-style general", theme: "history", items: { headwear: "c-bicorne", costumeOutfit: "c-general-coat" } },
  { id: "p-knight", label: "Knight", theme: "history", items: { headwear: "c-knight-helmet", costumeOutfit: "c-knight-armour", back: "c-cape" } },
  { id: "p-viking", label: "Viking", theme: "history", items: { headwear: "c-viking-helmet", costumeBeard: "c-viking-beard", costumeOutfit: "c-viking-tunic" } },
  { id: "p-roman", label: "Roman emperor-style", theme: "history", items: { headwear: "c-laurel-wreath", costumeOutfit: "c-toga", back: "c-cape" } },
  { id: "p-pharaoh", label: "Pharaoh-style", theme: "history", items: { headwear: "c-pharaoh-headdress", costumeOutfit: "c-pharaoh-robe", held: "c-scepter" } },
  { id: "p-musketeer", label: "Musketeer-style noble", theme: "history", items: { headwear: "c-musketeer-hat", costumeBeard: "c-musketeer-beard", costumeOutfit: "c-musketeer-tunic", back: "c-cape" } },
  // Jobs
  { id: "p-astronaut", label: "Astronaut", theme: "jobs", items: { headwear: "c-astronaut-helmet", costumeOutfit: "c-astronaut-suit", back: "c-jetpack", held: "c-flag" } },
  { id: "p-detective", label: "Detective", theme: "jobs", items: { headwear: "c-deerstalker", costumeOutfit: "c-trench-coat", held: "c-magnifying-glass" } },
  { id: "p-mad-scientist", label: "Mad scientist", theme: "jobs", items: { headwear: "c-science-goggles", costumeOutfit: "c-mad-scientist-coat", held: "c-potion" } },
  { id: "p-doctor", label: "Doctor", theme: "jobs", items: { headwear: "c-surgical-cap", costumeOutfit: "c-doctor", held: "c-clipboard" } },
  { id: "p-chef", label: "Chef", theme: "jobs", items: { headwear: "c-chef-toque", costumeOutfit: "c-chef", held: "c-wooden-spoon" } },
  { id: "p-firefighter", label: "Firefighter", theme: "jobs", items: { headwear: "c-firefighter-helmet", costumeOutfit: "c-firefighter" } },
  { id: "p-pilot", label: "Pilot", theme: "jobs", items: { headwear: "c-pilot-cap", costumeOutfit: "c-pilot", held: "c-map" } },
  { id: "p-sailor", label: "Sailor", theme: "jobs", items: { headwear: "c-sailor-hat", costumeOutfit: "c-sailor-suit", held: "c-compass" } },
  { id: "p-captain", label: "Ship's captain", theme: "jobs", items: { headwear: "c-captain-hat", costumeOutfit: "c-pilot", held: "c-telescope" } },
  { id: "p-judge", label: "Judge", theme: "jobs", items: { headwear: "c-judge-wig", costumeOutfit: "c-judge-robe", held: "c-gavel" } },
  { id: "p-butler", label: "Butler", theme: "jobs", items: { costumeOutfit: "c-butler", held: "c-serving-tray" } },
  { id: "p-explorer", label: "Explorer", theme: "jobs", items: { headwear: "c-explorer-hat", costumeOutfit: "c-explorer-shirt", back: "c-satchel", held: "c-compass" } },
  { id: "p-ringmaster", label: "Circus ringmaster", theme: "jobs", items: { headwear: "c-ringmaster-hat", costumeOutfit: "c-ringmaster-jacket", held: "c-ringmaster-cane" } },
  { id: "p-ballerina", label: "Ballerina", theme: "jobs", items: { headwear: "c-ballet-ribbon", costumeOutfit: "c-tutu" } },
  // Fun
  { id: "p-santa", label: "Santa-style", theme: "fun", items: { headwear: "c-santa-hat", costumeBeard: "c-santa-beard", costumeOutfit: "c-santa-suit", held: "c-santa-sack" }, hairColor: "white" },
  { id: "p-superhero", label: "Superhero", theme: "fun", items: { mask: "c-hero-mask", costumeOutfit: "c-superhero-suit", back: "c-cape" } },
  { id: "p-robot", label: "Robot", theme: "fun", items: { headwear: "c-robot-head", costumeOutfit: "c-robot-suit", pet: "c-small-robot" } },
  { id: "p-alien", label: "Alien", theme: "fun", items: { earsHorns: "c-antennae", costumeOutfit: "c-alien-costume" }, skin: "fantasy-green" },
  { id: "p-cowboy", label: "Cowboy", theme: "fun", items: { headwear: "c-cowboy-hat", costumeOutfit: "c-cowboy", held: "c-lasso" } },
  { id: "p-steampunk", label: "Steampunk inventor", theme: "fun", items: { headwear: "c-steampunk-hat", costumeOutfit: "c-steampunk-vest", held: "c-wrench" } },
  { id: "p-ninja", label: "Ninja-style", theme: "fun", items: { headwear: "c-ninja-hood", costumeOutfit: "c-ninja-outfit" } },
  { id: "p-rock-star", label: "Rock star", theme: "fun", items: { mask: "c-star-glasses", costumeOutfit: "c-leather-jacket", held: "c-electric-guitar" } },
  { id: "p-gamer", label: "Gamer", theme: "fun", items: { headwear: "c-headphones", held: "c-game-controller" } },
  { id: "p-easter-bunny", label: "Easter bunny", theme: "fun", items: { headwear: "c-bunny-ears", mask: "c-bunny-nose", costumeOutfit: "c-bunny-onesie", held: "c-easter-basket" } },
  { id: "p-snowman", label: "Snowman", theme: "fun", items: { headwear: "c-top-hat", mask: "c-carrot-nose", costumeOutfit: "c-snowman", held: "c-broom" } },
  { id: "p-cat-burglar", label: "Cat burglar", theme: "fun", items: { headwear: "c-knit-cap", mask: "c-burglar-mask", costumeOutfit: "c-burglar-shirt", held: "c-loot-sack" } },
  { id: "p-clown", label: "Friendly clown", theme: "fun", items: { mask: "c-clown-paint", costumeOutfit: "c-clown-suit", held: "c-balloon" } },
];

// The look with a preset applied (unknown item ids are left at None; no costume beard on a female
// look).
function applyCostumePreset(look, preset) {
  const result = { ...look };
  for (const field of COSTUME_FIELDS) {
    const id = preset.items[field];
    result[field] = id && optionById(field, id) ? id : COSTUME_OPTIONS[field][0].id;
  }
  if (look.gender === "female") result.costumeBeard = COSTUME_OPTIONS.costumeBeard[0].id;
  if (preset.skin && optionById("skin", preset.skin)) result.skin = preset.skin;
  if (preset.hairColor && optionById("hairColor", preset.hairColor)) result.hairColor = preset.hairColor;
  return result;
}

// "No costume": every costume field None.
const NO_COSTUME_PRESET = { id: "p-none", label: "No costume", items: {} };

// The preset this look is wearing: every costume item is exactly what the preset would set on it
// (the skin and hair colour don't count, they can be changed afterwards). null for no costume or
// a costume of its own.
function wornPreset(look) {
  if (COSTUME_FIELDS.every((field) => look[field] === COSTUME_OPTIONS[field][0].id)) return null;
  return COSTUME_PRESETS.find((preset) => {
    const worn = applyCostumePreset(look, preset);
    return COSTUME_FIELDS.every((field) => worn[field] === look[field]);
  }) || null;
}
