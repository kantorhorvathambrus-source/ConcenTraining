# ConcenTraining

A focus/study timer where a character reacts when you log a distraction.
Plain HTML, CSS and vanilla JS: no build step, no framework. Open `index.html`
in a browser, or deploy the folder to Netlify as-is (publish directory: the repo root).

## How it works

- **Setup:** pick a character, a style (Kind / Strict), a mode (Simple / Advanced) and a focus duration.
  Ragebait characters show a warning before they can be selected.
- **Simple mode:** 5 severity buttons (very briefly … a whole lot), not time-based.
- **Advanced mode:** 7 duration buttons (30 sec … 10+ min). Ends with the % of the session spent focusing.
  "10+ min" counts as 10 minutes in that %.
- **"A whole lot" / "10+ min"** asks: continue this session, or start over with a new duration.
- **Reactions:** each button maps to one of the 5 distraction poses. The character also blinks,
  "breathes", and shows the "doing well" pose after every 5 minutes without a logged distraction.

| Button (Simple) | Button (Advanced) | Pose |
|---|---|---|
| Very briefly | 30 sec | level1 |
| Briefly | 1 min | level2 |
| Moderately | 2 min, 3 min | level3 |
| A lot | 5 min, 10 min | level4 |
| A whole lot | 10+ min | level5 |

- **Motivation button:** always visible. Messages rotate in phases (see `js/data/messages.js`).
  Sessions of 35+ min: 0–10 min general → 10–20 min "hardest part" → 20 min–85% middle → 85–100% final stretch.
  Shorter sessions: general messages without the "first 20 minutes" facts → final stretch.
- A running session survives a page reload (it's saved in `localStorage`, the browser's built-in storage).

## Files

| File | What's in it |
|---|---|
| `index.html` | All screens (setup, session, summary) and dialogs |
| `css/style.css` | Styling, light/dark mode, breathing and reaction animations |
| `js/data/characters.js` | Character list, personality groups, art paths |
| `js/data/messages.js` | Motivation messages and Simple-mode summary messages |
| `js/placeholder-art.js` | Built-in placeholder drawings for characters without real art |
| `js/app.js` | Timer, reaction engine, motivation rotation, summary |

## Adding real character artwork

Each character needs 8 poses × 2 styles. Put the images in a folder like this:

```
assets/characters/grandma/kind/initial.png
assets/characters/grandma/kind/level1.png   … level5.png
assets/characters/grandma/kind/good.png
assets/characters/grandma/kind/blink.png
assets/characters/grandma/strict/…          (same 8 file names)
```

Then set `artPath: "assets/characters/grandma"` for that character in `js/data/characters.js`
(and `artExt` if you use `.webp` or `.jpg`). Any missing image falls back to the placeholder drawing,
so you can add them one by one. Use the same canvas size for all poses so blinking doesn't make the image jump.

## Popularity stats

Every tap on a character card is counted in `localStorage` (`ct_character_picks_v1`).
That only covers one browser. Picking the paid characters later (once there are 10+) will need the
counts from all users, so it will need a small backend, for example a Netlify Function plus a database.
