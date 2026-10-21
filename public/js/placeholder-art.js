// Draws simple SVG stand-in art for characters that don't have real artwork yet.
// Every character gets all 9 poses in its own personality (see personalityOf in
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
    refocus: { eyes: "happy", brows: "soft", mouth: "smile" }, // warm "you've got this", no pointing
  },
  // Patient, but expects your best: never angry, disappointed instead.
  firm: {
    initial: { eyes: "open", brows: "flat", mouth: "smile" },
    blink: { eyes: "closed", brows: "flat", mouth: "smile" },
    good: { eyes: "happy", brows: "soft", mouth: "smile" }, // small approving smile, no sparkles
    level1: { eyes: "open", brows: ["raised", "flat"], mouth: "flat" }, // one eyebrow raised
    level2: { eyes: "narrow", brows: ["raised", "flat"], mouth: "flat" }, // a long, level look: eyes narrow, brow still up
    level3: { eyes: "open", brows: "stern", mouth: "flat" }, // serious
    level4: { eyes: "narrow", brows: "stern", mouth: "flat" }, // stern but calm
    level5: { eyes: "closed", brows: "worried", mouth: "frown" }, // a disappointed sigh
    refocus: { eyes: "open", brows: "raised", mouth: "smile", extras: ["point"] }, // calm, expectant "go on then"
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
    refocus: { eyes: "narrow", brows: "flat", mouth: "flat", extras: ["point"] }, // neutral "get on with it", no anger
  },
  // Annoying on purpose: gets more insulting with the level, and only grudging when you do well.
  ragebait: {
    initial: { eyes: "bored", brows: "flat", mouth: "smirk" },
    blink: { eyes: "closed", brows: "flat", mouth: "smirk" },
    good: { eyes: "side", brows: "flat", mouth: "meh", extras: ["crossedArms"] }, // grudging: looks away, arms crossed
    level1: { eyes: "sideGlance", brows: ["raised", "flat"], mouth: "smugGrin" }, // side-eye: low lid, pupils pushed to one side
    level2: { eyes: "rolled", brows: "raised", mouth: "flat" }, // eye-roll
    level3: { eyes: ["happy", "open"], brows: ["flat", "raised"], mouth: "tongue" }, // wink + tongue out
    level4: { eyes: "squeezed", brows: "raised", mouth: "laugh", extras: ["tears", "clap"] }, // laughing, slow clap
    level5: { eyes: "bored", brows: ["raised", "flat"], mouth: "smirk", extras: ["blush", "middleFinger"] },
    refocus: { eyes: "bored", brows: ["flat", "raised"], mouth: "meh", extras: ["point"] }, // "whatever, go on"
  },
};

// Body, hair and accessories for each character. Layers, back to front: back, body,
// hand (something held, left out when a pose needs that hand, see HAND_BUSY_EXTRAS), neck,
// front (things worn around the neck), face, hair (beards too, so the eyes and mouth
// are always drawn on top of them), face parts, glasses.
// poses (optional) replaces some of the personality's poses for this one character.
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
  leader: {
    skin: "#f0c39b",
    brow: "#5a3a22",
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#7a4a26"/>
           <path d="M76 176 L100 222 L124 176Z" fill="#fff"/>
           <path d="M88 176 L100 196 L112 176Z" fill="#f0c39b"/>
           <path d="M76 176 L90 176 L94 194Z" fill="#fff" stroke="#d6d6d6" stroke-width="1.5"/>
           <path d="M124 176 L110 176 L106 194Z" fill="#fff" stroke="#d6d6d6" stroke-width="1.5"/>
           <path d="M70 178 L100 230 L84 240 L60 240 Z" fill="#62391b"/>
           <path d="M130 178 L100 230 L116 240 L140 240 Z" fill="#62391b"/>`,
    hair: `<path d="M46 100 Q42 44 100 40 Q158 42 156 98 Q150 70 134 62 Q104 80 62 68 Q52 80 46 100Z" fill="#6b4226"/>
           <path d="M56 70 Q88 46 152 66 Q118 58 92 76 Q72 80 56 70Z" fill="#7f5130"/>`,
  },
  santa: {
    skin: "#f5cfb4",
    brow: "#b5b5b5",
    back: `<ellipse cx="100" cy="112" rx="64" ry="58" fill="#f2f2f2"/>`,
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#d42a2a"/>
           <rect x="91" y="190" width="18" height="50" fill="#fff"/>
           <path d="M46 190 Q100 166 154 190" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`,
    hair: `<path d="M46 112 Q46 150 70 180 Q100 208 130 180 Q154 150 154 112 Q148 142 128 152 Q100 164 72 152 Q52 142 46 112Z" fill="#fafafa" stroke="#dcdcdc" stroke-width="1.5"/>
           <path d="M76 124 Q88 112 100 120 Q112 112 124 124 Q112 128 100 124 Q88 128 76 124Z" fill="#fafafa" stroke="#dcdcdc" stroke-width="1.5"/>
           <path d="M44 62 Q58 6 122 10 Q166 16 172 52 L156 58 Q104 34 54 60Z" fill="#d42a2a"/>
           <rect x="40" y="48" width="120" height="16" rx="8" fill="#fff" stroke="#dcdcdc" stroke-width="1.5"/>
           <circle cx="170" cy="54" r="11" fill="#fff" stroke="#dcdcdc" stroke-width="1.5"/>`,
    glasses: `<g fill="#fff" fill-opacity="0.15" stroke="#b8892a" stroke-width="3">
                <circle cx="78" cy="102" r="15"/><circle cx="122" cy="102" r="15"/>
              </g>
              <path d="M93 101 Q100 96 107 101" fill="none" stroke="#b8892a" stroke-width="3"/>`,
  },
  "study-buddy": {
    skin: "#e8b48c",
    brow: "#2e1f14",
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#e0a419"/>
           <path d="M52 186 Q100 162 148 186 Q140 200 100 198 Q60 200 52 186Z" fill="#c48d0e"/>
           <path d="M88 198 L86 228 M112 198 L114 228" fill="none" stroke="#fff4d6" stroke-width="3" stroke-linecap="round"/>
           <path d="M66 224 L134 224 L130 240 L70 240Z" fill="#c48d0e"/>`,
    front: `<path d="M68 172 Q100 198 132 172" fill="none" stroke="#333" stroke-width="6" stroke-linecap="round"/>
            <rect x="58" y="164" width="18" height="24" rx="8" fill="#333"/>
            <rect x="124" y="164" width="18" height="24" rx="8" fill="#333"/>
            <rect x="62" y="168" width="10" height="16" rx="5" fill="#5a5a5a"/>
            <rect x="128" y="168" width="10" height="16" rx="5" fill="#5a5a5a"/>`,
    hair: `<path d="M46 98 Q42 42 100 40 Q158 42 154 98 Q148 72 136 64 Q128 76 116 66 Q104 80 90 68 Q78 80 66 68 Q54 78 46 98Z" fill="#3a2618"/>`,
  },
  coach: {
    skin: "#d9a07a",
    brow: "#3b2a1e",
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#1f74e8"/>
           <path d="M30 196 L44 240 M38 190 L54 240" fill="none" stroke="#fff" stroke-width="4"/>
           <path d="M170 196 L156 240 M162 190 L146 240" fill="none" stroke="#fff" stroke-width="4"/>
           <path d="M80 174 L100 186 L120 174 L120 182 L100 194 L80 182Z" fill="#fff"/>
           <path d="M100 192 L100 240" stroke="#c9d9f5" stroke-width="2.5"/>`,
    front: `<path d="M88 168 Q92 196 104 214 M112 168 Q110 196 104 214" fill="none" stroke="#222" stroke-width="2.5"/>
            <rect x="96" y="212" width="20" height="12" rx="5" fill="#c7cdd4" stroke="#7d858d" stroke-width="2"/>
            <rect x="112" y="214" width="8" height="6" rx="2" fill="#7d858d"/>`,
    hair: `<path d="M44 82 Q42 30 100 28 Q158 30 156 82Z" fill="#1f74e8"/>
           <path d="M44 82 Q100 62 156 82 L156 74 Q100 54 44 74Z" fill="#fff"/>
           <path d="M40 80 Q100 60 160 80 Q180 84 182 72 Q156 54 100 56 Q48 58 40 80Z" fill="#1659b8"/>
           <circle cx="100" cy="30" r="5" fill="#1659b8"/>`,
  },
  professor: {
    skin: "#f0c8a8",
    brow: "#7d7d7d",
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#8b8a80"/>
           <g stroke="#6f6e65" stroke-width="2" stroke-linecap="round">
             <path d="M34 214 l6 -3 M48 226 l6 -3 M40 236 l6 -3 M150 214 l6 -3 M160 230 l6 -3 M140 234 l6 -3 M30 230 l6 -3 M164 216 l6 -3"/>
           </g>
           <path d="M80 176 L100 214 L120 176Z" fill="#fff"/>
           <path d="M96 182 L104 182 L107 214 L100 224 L93 214Z" fill="#5b4636"/>
           <path d="M72 178 L100 232 L86 240 L62 240Z" fill="#74736a"/>
           <path d="M128 178 L100 232 L114 240 L138 240Z" fill="#74736a"/>`,
    hair: `<path d="M46 104 Q42 66 58 56 Q56 76 62 86 Q54 92 50 104Z" fill="#b0b0b0"/>
           <path d="M154 104 Q158 66 142 56 Q144 76 138 86 Q146 92 150 104Z" fill="#b0b0b0"/>
           <path d="M60 60 Q100 30 140 60 Q120 50 100 52 Q80 50 60 60Z" fill="#b0b0b0"/>
           <path d="M54 136 Q58 170 100 172 Q142 170 146 136 Q138 156 100 158 Q62 156 54 136Z" fill="#a3a3a3"/>
           <path d="M82 124 Q92 114 100 120 Q108 114 118 124 Q108 126 100 122 Q92 126 82 124Z" fill="#a3a3a3"/>`,
    glasses: `<g fill="#fff" fill-opacity="0.15" stroke="#5a4636" stroke-width="2.5">
                <rect x="60" y="88" width="36" height="27" rx="10"/><rect x="104" y="88" width="36" height="27" rx="10"/>
              </g>
              <path d="M96 100 Q100 96 104 100" fill="none" stroke="#5a4636" stroke-width="2.5"/>`,
  },
  headmistress: {
    skin: "#f2cdb0",
    brow: "#2a1d18",
    back: `<circle cx="100" cy="40" r="20" fill="#2a1d18"/>`,
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#6e1f33"/>
           <path d="M78 176 L100 236 L122 176Z" fill="#f7f1e6"/>
           <path d="M84 176 L100 190 L116 176 L112 172 L100 182 L88 172Z" fill="#fff" stroke="#d9cfbf" stroke-width="1.5"/>
           <circle cx="100" cy="204" r="2.5" fill="#d9cfbf"/><circle cx="100" cy="220" r="2.5" fill="#d9cfbf"/>
           <circle cx="74" cy="212" r="3" fill="#4a1322"/><circle cx="72" cy="228" r="3" fill="#4a1322"/>`,
    hair: `<path d="M46 100 Q44 48 100 46 Q156 48 154 100 Q150 70 104 62 L100 50 L96 62 Q50 70 46 100Z" fill="#2a1d18"/>`,
    glasses: `<g fill="#fff" fill-opacity="0.15" stroke="#2a1d18" stroke-width="2.5">
                <rect x="61" y="90" width="34" height="24" rx="3"/><rect x="105" y="90" width="34" height="24" rx="3"/>
              </g>
              <path d="M95 100 L105 100" stroke="#2a1d18" stroke-width="2.5"/>`,
  },
  grandmaster: {
    skin: "#e3b591",
    brow: "#262626",
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#161616"/>
           <path d="M40 196 Q46 220 44 240 M160 196 Q154 220 156 240" fill="none" stroke="#2c2c2c" stroke-width="3"/>`,
    front: `<rect x="78" y="146" width="44" height="40" rx="10" fill="#161616"/>
            <path d="M80 160 L120 160 M80 170 L120 170 M80 180 L120 180" stroke="#2c2c2c" stroke-width="2.5"/>`,
    hair: `<path d="M46 100 Q42 44 100 42 Q158 44 154 100 Q150 68 120 62 Q100 70 80 62 Q50 68 46 100Z" fill="#262626"/>
           <path d="M46 100 Q44 80 50 70 Q54 84 56 96Z" fill="#a0a0a0"/>
           <path d="M154 100 Q156 80 150 70 Q146 84 144 96Z" fill="#a0a0a0"/>`,
  },
  "meditation-guide": {
    skin: "#e2b08a",
    brow: "#2b1d16",
    back: `<ellipse cx="100" cy="98" rx="60" ry="62" fill="#2b1d16"/>`,
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#efe4cf" stroke="#cbbd9f" stroke-width="2"/>
           <path d="M84 176 Q100 196 116 176" fill="#e2b08a" stroke="#cbbd9f" stroke-width="2"/>
           <path d="M60 206 Q64 224 62 240 M140 206 Q136 224 138 240" fill="none" stroke="#d8cbb0" stroke-width="2"/>
           <g fill="#2b1d16" stroke="#1a110c" stroke-width="1.5">
             <ellipse cx="146" cy="168" rx="11" ry="13"/><ellipse cx="148" cy="190" rx="10" ry="12"/>
             <ellipse cx="149" cy="211" rx="9" ry="11"/><ellipse cx="150" cy="229" rx="7" ry="9"/>
           </g>
           <rect x="144" y="236" width="12" height="4" fill="#b85c38"/>`,
    hair: `<path d="M46 104 Q42 44 100 42 Q158 44 154 104 Q150 74 128 64 Q110 56 100 52 Q90 56 72 64 Q50 74 46 104Z" fill="#2b1d16"/>`,
  },
  librarian: {
    skin: "#f1c7a6",
    brow: "#2c1c14",
    back: `<path d="M40 110 Q30 60 64 44 Q100 26 136 44 Q170 60 160 110 Q170 140 158 170 Q150 180 140 168 L140 120 L60 120 L60 168 Q50 180 42 170 Q30 140 40 110Z" fill="#3a241a"/>`,
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#c4612b"/>
           <path d="M80 176 L100 228 L120 176Z" fill="#f5ecdc"/>
           <path d="M84 176 Q100 188 116 176" fill="none" stroke="#e0d3bd" stroke-width="2"/>
           <circle cx="106" cy="204" r="3" fill="#8a3d16"/><circle cx="104" cy="222" r="3" fill="#8a3d16"/>
           <path d="M40 200 l8 4 M36 218 l8 4 M160 200 l-8 4 M164 218 l-8 4" stroke="#a84f20" stroke-width="2.5" stroke-linecap="round"/>`,
    hair: `<path d="M46 102 Q40 46 100 42 Q160 46 154 102 Q152 82 142 74 Q146 86 134 70 Q120 78 112 64 Q102 76 92 64 Q80 78 68 68 Q60 84 56 76 Q48 86 46 102Z" fill="#3a241a"/>
           <g fill="#fff" fill-opacity="0.25" stroke="#7a3f6a" stroke-width="3">
             <rect x="64" y="44" width="30" height="16" rx="7"/><rect x="106" y="44" width="30" height="16" rx="7"/>
           </g>
           <path d="M94 50 Q100 46 106 50" fill="none" stroke="#7a3f6a" stroke-width="3"/>`,
  },
  surgeon: {
    skin: "#c98d66",
    brow: "#2b1a12",
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#14958b"/>
           <path d="M80 176 L100 206 L120 176Z" fill="#c98d66"/>
           <path d="M80 176 L100 206 L120 176" fill="none" stroke="#0e756d" stroke-width="3"/>
           <rect x="128" y="204" width="24" height="20" rx="3" fill="#0e756d"/>`,
    front: `<path d="M72 160 Q100 150 128 160 L126 182 Q100 192 74 182Z" fill="#a9d8f0" stroke="#7fb8d6" stroke-width="2"/>
            <path d="M78 168 Q100 162 122 168 M78 175 Q100 170 122 175" fill="none" stroke="#7fb8d6" stroke-width="1.5"/>`,
    hair: `<path d="M44 92 Q42 32 100 30 Q158 32 156 92 Q150 66 100 62 Q50 66 44 92Z" fill="#14958b"/>
           <path d="M44 92 Q50 66 100 62 Q150 66 156 92 L156 86 Q150 58 100 56 Q50 58 44 86Z" fill="#0e756d"/>
           <circle cx="72" cy="44" r="3" fill="#0e756d"/><circle cx="100" cy="38" r="3" fill="#0e756d"/><circle cx="128" cy="44" r="3" fill="#0e756d"/>
           <path d="M46 96 Q44 88 50 84 Q50 94 54 100Z M154 96 Q156 88 150 84 Q150 94 146 100Z" fill="#2b1a12"/>`,
  },
  influencer: {
    skin: "#e6b593",
    brow: "#c9a24a",
    body: `<path d="M18 240 Q22 178 100 172 Q178 178 182 240Z" fill="#ff2fa0"/>
           <path d="M54 184 Q100 160 146 184 Q138 198 100 196 Q62 198 54 184Z" fill="#d81b84"/>
           <path d="M88 196 L86 222 M112 196 L114 222" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    // Phone in hand, camera side out and always recording.
    // Hidden in poses that need that hand (see HAND_BUSY_EXTRAS).
    hand: `<rect x="30" y="172" width="26" height="46" rx="5" fill="#222" stroke="#555" stroke-width="2"/>
           <rect x="34" y="176" width="12" height="20" rx="4" fill="#3a3a3a"/>
           <circle cx="40" cy="181" r="3.6" fill="#111" stroke="#777" stroke-width="1.2"/>
           <circle cx="40" cy="190.5" r="3.6" fill="#111" stroke="#777" stroke-width="1.2"/>
           <circle cx="51" cy="178.5" r="2.8" fill="#ff2d2d"/>
           <rect x="24" y="200" width="38" height="24" rx="11" fill="#e6b593" stroke="#222" stroke-width="2"/>
           <path d="M29 209 L57 209" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/>`,
    hair: `<path d="M48 98 Q44 44 100 40 Q156 44 152 98 Q150 72 140 64 L136 52 L126 64 L118 48 L108 62 L98 46 L88 62 L78 50 L70 64 Q54 72 48 98Z" fill="#f2df9a"/>
           <g fill="#222">
             <path d="M60 52 L94 52 L92 64 Q78 70 62 64Z"/><path d="M106 52 L140 52 L138 64 Q122 70 108 64Z"/>
           </g>
           <path d="M94 54 L106 54" stroke="#222" stroke-width="3"/>`,
    // Instead of the slow clap: laughing at you while his phone keeps filming.
    poses: {
      level4: { eyes: "squeezed", brows: "raised", mouth: "laugh", extras: ["tears"] },
    },
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
    case "side": // half-closed, looking away (to the left)
      return `<path d="M${cx - 10} ${EYE_Y} A10 9 0 0 0 ${cx + 10} ${EYE_Y}Z" fill="#fff" stroke="#222" stroke-width="2.5"/>
              <circle cx="${cx - 5}" cy="${EYE_Y + 3.5}" r="4" fill="#222"/>
              <path d="M${cx - 12} ${EYE_Y} L${cx + 12} ${EYE_Y}" ${LINE} stroke-width="3.5"/>`;
    case "sideGlance": // mostly open with a low lid, pupils pushed hard to the right
      return `<path d="M${cx - 11} ${EYE_Y - 4} L${cx + 11} ${EYE_Y - 4} A12 10 0 1 1 ${cx - 11} ${EYE_Y - 4}Z" fill="#fff" stroke="#222" stroke-width="2.5"/>
              <circle cx="${cx + 6}" cy="${EYE_Y + 1.5}" r="5" fill="#222"/>
              <path d="M${cx - 13} ${EYE_Y - 4} L${cx + 13} ${EYE_Y - 4}" ${LINE} stroke-width="3.5"/>`;
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
    case "smugGrin": // wide lopsided grin, higher on one side
      return `<path d="M82 134 Q104 148 122 124 Q104 140 82 134Z" fill="#6b1f1f" stroke="#222" stroke-width="3" stroke-linejoin="round"/>`;
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
  // Arms folded across the chest.
  crossedArms: (skin) => `<g fill="${skin}" stroke="#222" stroke-width="2.5">
                            <rect x="34" y="190" width="112" height="24" rx="12" transform="rotate(-6 90 202)"/>
                            <rect x="54" y="204" width="112" height="24" rx="12" transform="rotate(6 110 216)"/>
                          </g>`,
  // "Back to work": a fist with the index finger pointing down, towards the timer below.
  point: (skin) => `<g fill="${skin}" stroke="#222" stroke-width="2.5">
                      <g transform="rotate(40 156 188)">
                        <rect x="150" y="182" width="12" height="54" rx="6"/>
                        <rect x="152" y="224" width="8" height="8" rx="3" fill="#fff" fill-opacity="0.45" stroke="none"/>
                      </g>
                      <rect x="142" y="158" width="42" height="38" rx="13"/>
                      <rect x="138" y="164" width="34" height="13" rx="6.5"/>
                    </g>
                    <path d="M160 184 L160 195 M172 184 L172 195" ${LINE} stroke-width="2.5"/>`,
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

// Extras that use both hands, so the hand holding look.hand isn't drawn for them.
const HAND_BUSY_EXTRAS = ["clap", "crossedArms"];

const artCache = new Map();

// Returns a data: URL for the given character and pose, drawn in the character's personality.
function placeholderArt(character, pose) {
  const key = `${character.id}/${pose}`;
  if (artCache.has(key)) return artCache.get(key);

  const look = ART_LOOKS[character.id] || ART_LOOKS.boss;
  const face =
    (look.poses && look.poses[pose]) ||
    (ART_EXPRESSIONS[personalityOf(character)] || ART_EXPRESSIONS.kind)[pose] ||
    ART_EXPRESSIONS.kind.initial;
  const [leftEye, rightEye] = Array.isArray(face.eyes) ? face.eyes : [face.eyes, face.eyes];
  const extras = face.extras || [];
  const neckWidth = look.neckWidth || 32;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
    ${look.back || ""}
    ${look.body}
    ${look.hand && !extras.some((name) => HAND_BUSY_EXTRAS.includes(name)) ? look.hand : ""}
    <rect x="${100 - neckWidth / 2}" y="140" width="${neckWidth}" height="40" fill="${look.skin}"/>
    ${look.front || ""}
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
