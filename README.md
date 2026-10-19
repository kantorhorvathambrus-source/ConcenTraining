# ConcenTraining

A focus/study timer where a character reacts when you log a distraction.
Plain HTML, CSS and vanilla JS: no build step, no framework. The website is the
`public/` folder (open `public/index.html` in a browser to try it). The backend is two
Netlify Functions plus a Netlify Database, used only for character popularity stats.

## How it works

- **Setup:** 1. pick a character, 2. a mode (Simple / Advanced), 3. a focus duration.
  The character decides the personality (see below). Ragebait characters show a warning before
  they can be selected. A custom duration is corrected as soon as you leave the field: empty becomes
  25 min, anything under 1 becomes 1, anything over 240 becomes 240.
- **Simple mode:** 5 severity buttons (very briefly … a whole lot), not time-based.
- **Advanced mode:** 7 duration buttons (30 sec … 10+ min). Ends with the % of the session spent focusing.
  "10+ min" counts as 10 minutes in that %.
- **Distraction categories:** after each distraction button, once the reaction has played (1.4 s,
  `PICKER_DELAY_MS`), a small optional picker appears above the Motivate/End buttons:
  Phone, Thoughts, Noise, People, Tired, Other. It hides itself after 3 s (`PICKER_TIMEOUT_MS`;
  both constants are at the top of `public/js/app.js`). A tapped category is saved with the
  distraction; otherwise it's saved as `category: null`. Tapping another distraction button replaces
  the picker (the earlier distraction keeps `null`), and **End session** closes it.
- **"A whole lot" / "10+ min"** asks: continue this session, or start over with a new duration.
  The category picker comes first and the dialog opens as soon as the picker closes (after a tap or
  after 3 s), so the two never show at the same time. If **End session** is pressed while this
  question is waiting, it's asked after **Keep going**. The question is saved with the running session
  (`restartPending`), so if the page is reloaded before it's answered, it's asked right after the reload.
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
  On short screens, tapping it scrolls the message up so it sits just above the bottom button bar.
- **Small screens:** the session header is short ("Boss · Strict · Advanced · 25 min") and wraps
  into two even lines if it has to. On screens up to 740 px tall, the session image shrinks
  (120–260 px tall) so every distraction button fits above the bottom bar without scrolling; the
  summary image and taller phones keep the normal size. Advanced labels like "10+ min" stay on one line.
- **Summary screen:** the character's pose, the title and the message follow how the session went
  (see "Summary result" below). It also shows the session's top 3 picked categories, e.g.
  "Most common distractions: Phone (2), Thoughts (1)". Hidden if nothing was picked.
  Times are shown with seconds when there are any ("24 min 30 sec out of 25 min").

### Summary result

Every finished session gets a result. The thresholds are constants at the top of
`public/js/history-store.js`, so other features can reuse them.

- **Advanced mode** uses the focus %: **great** from 85% (`SUMMARY_GREAT_FOCUS`), **okay** from 60%
  (`SUMMARY_OKAY_FOCUS`), **rough** below that. The focus % is only 100% when no distraction time was
  logged at all (99.6% shows as 99%).
- **Simple mode** has no focus % (it's saved as `null`), so it uses distraction points: each logged
  distraction scores its level (Very briefly = 1, Briefly = 2, Moderately = 3, A lot = 4,
  A whole lot = 5). The points are counted per 25 minutes of session time; sessions shorter than
  25 minutes count as 25 minutes. **great** up to 2 points per 25 min (`SIMPLE_GREAT_POINTS`),
  **rough** from 8 (`SIMPLE_ROUGH_POINTS`), **okay** in between. Example: two "A lot" in a 25-minute
  session = 8 points = rough.
- **short:** a session under 1 minute. It isn't saved to the history, and the summary says so.

| Result | Kind | Strict | Ragebait | Title |
|---|---|---|---|---|
| great | `good` (proud) | `good` (satisfied) | `good` (grudging) | Great session! |
| okay | `level2` (pleased) | `initial` (neutral) | `level1` (side-eye) | Good effort! |
| rough | `level4` (gently encouraging) | `level2` (disappointed) | `level4` (mocking) | Tough session |
| short | `initial` | `initial` | `initial` | That was quick |

The poses are in `SUMMARY_POSES` (`public/js/app.js`); titles and Simple-mode messages for each result
are in `public/js/data/messages.js`.
- A running session survives a page reload (it's saved in `localStorage`, the browser's built-in storage).

## Personalities

There's no style to choose: each character's `group` in `public/js/data/characters.js` decides its
personality, in one place (`GROUPS` and `personalityOf()`). A new character only needs a `group`.

| Group | Personality | How it reacts |
|---|---|---|
| `relaxed` (e.g. Grandma) | `kind` | Happy you're back, cheers you on. Hops. |
| `strict` (e.g. Boss, Soldier) | `strict` | Stern when you drift off, angrier each level. Shakes. |
| `ragebait` (e.g. Bodybuilder) | `ragebait` | Annoying on purpose: mocking, more insulting each level. Cheeky head tilt. |

Characters react only with poses and facial expressions, never with text. The ragebait poses:

| Pose | Ragebait reaction |
|---|---|
| initial / blink | Bored half-closed eyes looking straight ahead, small smirk |
| level1 | Side-eye: white eyes under a low lid, pupils pushed to the side, one eyebrow up, wide smug grin |
| level2 | Eye-roll |
| level3 | Wink and tongue out |
| level4 | Laughing at you with a sarcastic slow clap |
| level5 | Middle finger |
| good | Grudging: arms crossed, half-closed eyes looking away, flat "meh" mouth, a small shrug. Never proud |

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
- **What distracts you:** the picked categories across all sessions, most common first, with count
  and share. Distractions without a category (picker skipped, or logged before categories existed)
  are left out of the bars and only counted in the note above them.
- **Last 30 sessions** with date, character, mode, length, distractions and focus %.
- **Backup:** Export and Import buttons (see below).

Simple-mode sessions have no focus % (their buttons aren't time-based). They count for streaks and
appear in the list as "—", but are left out of the trend and time-of-day numbers.

### Browser storage keys

| Key | What's in it |
|---|---|
| `ct_session_v1` | The session that's running right now (removed when it ends). `restartPending: true` while the continue/restart question is unanswered; older saved sessions don't have it, which means `false` |
| `ct_history_v1` | Finished sessions, newest first, max. 1000 |
| `ct_prefs_v1` | Last chosen character, mode and duration. A `style` value saved by older versions is ignored and dropped |

Each history entry: `startedAt`, `endedAt` (timestamps in ms), `endedBy` (`"timer"`/`"manual"`),
`characterId`, `style` (the character's personality when the session ran: `"kind"`, `"strict"` or
`"ragebait"`), `mode`, `plannedMs`, `elapsedMs`, `distractedMs`, `focusPercent`
(`null` in Simple mode) and `distractions` (`[{ at, level, ms, category }]`). `category` is
`"phone"`, `"thoughts"`, `"noise"`, `"people"`, `"tired"`, `"other"` or `null` (nothing picked).
Sessions saved before categories existed have no `category` field; everything that reads it treats
that as `null`.
Sessions saved before personalities came from the character keep the style that was chosen then
(for example a strict Grandma). A session that was still running when this changed continues, and
is saved, with the character's own personality.
History lives only in this browser: clearing site data or switching devices starts it over.
The history page says so, too.

### Export and import

- **Export** downloads `concentraining-history-YYYY-MM-DD.json`:

  ```json
  {
    "app": "ConcenTraining",
    "type": "session-history",
    "version": 3,
    "exportedAt": "2026-10-28T09:00:00.000Z",
    "sessions": [ /* history entries, newest first */ ]
  }
  ```

- **Import** reads such a file and **adds** its sessions to the history. A session whose start time
  is already in the history is skipped. Like when a new session is saved, only the newest 1000
  sessions are kept: if the total goes over 1000, the oldest sessions are removed, whether they
  came from the file or were already in the history. The result message says how many were
  imported, how many from the file didn't fit, and how many existing sessions were removed.
- The whole file is checked before anything is saved: `app`, `type` and `version` must match,
  and every session must have valid times, mode, style, focus % and distractions. If anything is
  wrong, nothing is imported and the page says what's wrong (for example
  "Session 4 in the file can't be imported: its focus % is invalid"). Max. file size: 5 MB.
- **Versions:** version 2 added `category` to each distraction. Version 1 files (made before that)
  still import; their distractions get `category: null`. From version 2, every distraction must
  have a known category or `null`. Old sessions without the field are exported with `null`.
  Version 3 allows `style: "ragebait"`; in version 1 and 2 files the style must be `kind` or `strict`.
  The fields didn't change, but a version 2 app can't read a ragebait session, so the new number
  makes an older app say "made by a newer version" instead of "its style is invalid".
- If the session fields ever change again, raise `EXPORT_VERSION` in `public/js/history-store.js`,
  add the new number to `IMPORT_VERSIONS`, and teach the import how to read the older files.

## Files

| File | What's in it |
|---|---|
| `public/index.html` | All screens (setup, session, summary) and dialogs |
| `public/history.html` | Your finished sessions, streaks and focus trends |
| `public/stats.html` | Popularity table (reads `/api/stats`) |
| `public/css/style.css` | Styling, light/dark mode, breathing and reaction animations |
| `public/js/data/characters.js` | Character list, groups and the personality each group gives (`personalityOf`), art paths |
| `public/js/data/messages.js` | Motivation messages, summary titles and Simple-mode summary messages per result |
| `public/js/placeholder-art.js` | Built-in placeholder drawings (kind, strict and ragebait faces) for characters without real art |
| `public/js/app.js` | Timer, reaction engine, distraction category picker, motivation rotation, summary |
| `public/js/history-store.js` | Saving/loading history, focus % and summary result (with their thresholds), distraction categories, export/import checks (used by both pages) |
| `public/js/history.js` | Streaks, weekly chart, time of day, distraction categories, session list and backup buttons on `history.html` |
| `netlify/functions/picks.mjs` | `POST /api/picks`: counts one tap on a character |
| `netlify/functions/stats.mjs` | `GET /api/stats`: popularity + which characters are paid |
| `netlify/database/migrations/` | Database tables (SQL), applied automatically on deploy |
| `netlify.toml` | Tells Netlify the site is in `public/` |
| `package.json` | The one dependency the functions need (`@netlify/database`) |

## Adding real character artwork

Each character needs one set of 8 poses, drawn in its own personality. Put the images in a folder like this:

```
public/assets/characters/grandma/initial.png
public/assets/characters/grandma/level1.png   … level5.png
public/assets/characters/grandma/good.png
public/assets/characters/grandma/blink.png
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
