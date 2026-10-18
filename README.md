# ConcenTraining

A focus/study timer where a character reacts when you log a distraction.
Plain HTML, CSS and vanilla JS: no build step, no framework. The website is the
`public/` folder (open `public/index.html` in a browser to try it). The backend is two
Netlify Functions plus a Netlify Database, used only for character popularity stats.

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

## Session history (`history.html`)

Every finished session (timer ran out or **End session** pressed) that ran at least 1 minute is saved
on the device. Sessions abandoned with **Start over** aren't saved. The page shows:

- **Current and longest streak:** days (local time) with at least one finished session.
  The current streak stays alive until today is over, even if you haven't finished a session yet today.
- **Weekly focus trend:** an SVG line chart of the last 12 weeks (weeks start on Monday).
  Each week is total focused time ÷ total session time, so longer sessions count more.
  Weeks without Advanced sessions are a gap in the line.
- **Best time of day:** focus % by start time: Morning 5–12, Afternoon 12–17, Evening 17–22, Night 22–5.
  A slot can only be "best" once it has at least 3 sessions with a focus %
  (`MIN_SESSIONS_FOR_BEST_TIME` at the top of `public/js/history.js`). Until one does, the page says
  "Not enough data yet".
- **Last 30 sessions** with date, character, mode, length, distractions and focus %.
- **Backup:** Export and Import buttons (see below).

Simple-mode sessions have no focus % (their buttons aren't time-based). They count for streaks and
appear in the list as "—", but are left out of the trend and time-of-day numbers.

### Browser storage keys

| Key | What's in it |
|---|---|
| `ct_session_v1` | The session that's running right now (removed when it ends) |
| `ct_history_v1` | Finished sessions, newest first, max. 1000 |
| `ct_prefs_v1` | Last chosen character, style, mode and duration |

Each history entry: `startedAt`, `endedAt` (timestamps in ms), `endedBy` (`"timer"`/`"manual"`),
`characterId`, `style`, `mode`, `plannedMs`, `elapsedMs`, `distractedMs`, `focusPercent`
(`null` in Simple mode) and `distractions` (`[{ at, level, ms }]`).
History lives only in this browser: clearing site data or switching devices starts it over.
The history page says so, too.

### Export and import

- **Export** downloads `concentraining-history-YYYY-MM-DD.json`:

  ```json
  {
    "app": "ConcenTraining",
    "type": "session-history",
    "version": 1,
    "exportedAt": "2026-10-28T09:00:00.000Z",
    "sessions": [ /* history entries, newest first */ ]
  }
  ```

- **Import** reads such a file and **adds** its sessions to the history. A session whose start time
  is already in the history is skipped, and nothing is ever deleted. If the result is over 1000
  sessions, the oldest ones are left out.
- The whole file is checked before anything is saved: `app`, `type` and `version` must match,
  and every session must have valid times, mode, style, focus % and distractions. If anything is
  wrong, nothing is imported and the page says what's wrong (for example
  "Session 4 in the file can't be imported: its focus % is invalid"). Max. file size: 5 MB.
- If the session fields ever change, raise `EXPORT_VERSION` in `public/js/history-store.js`
  and teach the import how to read version 1 files.

## Files

| File | What's in it |
|---|---|
| `public/index.html` | All screens (setup, session, summary) and dialogs |
| `public/history.html` | Your finished sessions, streaks and focus trends |
| `public/stats.html` | Popularity table (reads `/api/stats`) |
| `public/css/style.css` | Styling, light/dark mode, breathing and reaction animations |
| `public/js/data/characters.js` | Character list, personality groups, art paths |
| `public/js/data/messages.js` | Motivation messages and Simple-mode summary messages |
| `public/js/placeholder-art.js` | Built-in placeholder drawings for characters without real art |
| `public/js/app.js` | Timer, reaction engine, motivation rotation, summary |
| `public/js/history-store.js` | Saving/loading history, focus % calculation, export/import checks (used by both pages) |
| `public/js/history.js` | Streaks, weekly chart, time of day, session list and backup buttons on `history.html` |
| `netlify/functions/picks.mjs` | `POST /api/picks`: counts one tap on a character |
| `netlify/functions/stats.mjs` | `GET /api/stats`: popularity + which characters are paid |
| `netlify/database/migrations/` | Database tables (SQL), applied automatically on deploy |
| `netlify.toml` | Tells Netlify the site is in `public/` |
| `package.json` | The one dependency the functions need (`@netlify/database`) |

## Adding real character artwork

Each character needs 8 poses × 2 styles. Put the images in a folder like this:

```
public/assets/characters/grandma/kind/initial.png
public/assets/characters/grandma/kind/level1.png   … level5.png
public/assets/characters/grandma/kind/good.png
public/assets/characters/grandma/kind/blink.png
public/assets/characters/grandma/strict/…          (same 8 file names)
```

Then set `artPath: "assets/characters/grandma"` (relative to `public/`) for that character in `public/js/data/characters.js`
(and `artExt` if you use `.webp` or `.jpg`). Any missing image falls back to the placeholder drawing,
so you can add them one by one. Use the same canvas size for all poses so blinking doesn't make the image jump.

## Popularity stats (backend)

Every tap on a character card sends `POST /api/picks`, whether or not the session gets finished.
Counts are stored per character per day in Netlify Database (managed Postgres), so popularity
can be measured over the **last 30 days** and the paid selection rotates as tastes change.

- `GET /api/stats` returns every character's recent and all-time taps, plus `paidCharacterIds`:
  empty until there are at least 10 characters, then the top ~10% by recent taps.
  The numbers are at `/stats.html` on the live site.
- Only characters listed in the `characters` table are counted, and each IP address can send
  at most 30 taps per minute, so the numbers are hard to fake.
- **Adding a character:** besides `characters.js`, add a **new** migration file, e.g.
  `netlify/database/migrations/20261101120000_add_robot.sql` containing
  `INSERT INTO characters (id, name) VALUES ('robot', 'Robot');`.
  Never edit or delete a migration that has already been deployed: Netlify will refuse the deploy.
- Settings (30 days, 10 characters, 10%) are constants at the top of `netlify/functions/stats.mjs`.

## Deploying

Connect this GitHub repo to the Netlify site (Site configuration → Build & deploy → Link repository).
Leave the build command empty; `netlify.toml` already sets the publish directory to `public`.
On every push Netlify installs `package.json`, deploys the functions, creates the database on the
first deploy, and applies new migrations. Netlify Database needs a credit-based Netlify plan;
if a deploy fails with "database feature not available for this account", the plan is the reason.
