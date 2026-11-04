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

// Only the costume fields of a look (for keeping them across a gender switch).
function costumeOf(look) {
  const costume = {};
  for (const field of COSTUME_FIELDS) costume[field] = look[field];
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

const COSTUME_PRESETS = [
  { id: "p-pirate", label: "Pirate", items: { headwear: "c-tricorne", mask: "c-eye-patch", costumeBeard: "c-pirate-beard", costumeOutfit: "c-pirate-coat", held: "c-telescope", pet: "c-parrot" } },
  { id: "p-general", label: "General", description: "a Napoleon-style general", items: { headwear: "c-bicorne", costumeOutfit: "c-general-coat" } },
  { id: "p-santa", label: "Santa-style", items: { headwear: "c-santa-hat", costumeBeard: "c-santa-beard", costumeOutfit: "c-santa-suit", held: "c-santa-sack" }, hairColor: "white" },
  { id: "p-witch", label: "Witch", items: { headwear: "c-witch-hat", costumeOutfit: "c-witch-dress", held: "c-broom", pet: "c-black-cat" } },
  { id: "p-wizard", label: "Wizard", items: { headwear: "c-wizard-hat", costumeBeard: "c-wizard-beard", costumeOutfit: "c-wizard-robe", held: "c-wizard-staff", pet: "c-owl" } },
  { id: "p-knight", label: "Knight", items: { headwear: "c-knight-helmet", costumeOutfit: "c-knight-armour", back: "c-cape" } },
  { id: "p-king", label: "King", items: { headwear: "c-crown", costumeOutfit: "c-royal-robe", back: "c-royal-cloak", held: "c-scepter" } },
  { id: "p-queen", label: "Queen", items: { headwear: "c-crown", costumeOutfit: "c-royal-gown", back: "c-royal-cloak", held: "c-scepter" } },
  { id: "p-vampire", label: "Vampire", items: { mask: "c-fangs", costumeOutfit: "c-vampire-cape", held: "c-candle" }, hairColor: "black" },
  { id: "p-ghost", label: "Ghost", items: { costumeOutfit: "c-ghost-sheet", held: "c-lantern" } },
];

// The look with a preset applied (unknown item ids are left at None).
function applyCostumePreset(look, preset) {
  const result = { ...look };
  for (const field of COSTUME_FIELDS) {
    const id = preset.items[field];
    result[field] = id && optionById(field, id) ? id : COSTUME_OPTIONS[field][0].id;
  }
  if (preset.skin && optionById("skin", preset.skin)) result.skin = preset.skin;
  if (preset.hairColor && optionById("hairColor", preset.hairColor)) result.hairColor = preset.hairColor;
  return result;
}

// "No costume": every costume field None.
const NO_COSTUME_PRESET = { id: "p-none", label: "No costume", items: {} };
