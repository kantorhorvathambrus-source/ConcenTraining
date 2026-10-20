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
  Under step 3 there are two checkboxes, both on by default: **Play a sound when time's up** (with a
  small **Test sound** button that plays the chime once) and **Keep the screen on during the session**.
  See "Sound and screen" below.
- **Simple mode:** 5 severity buttons (very briefly … a whole lot), not time-based.
- **Advanced mode:** 7 duration buttons (30 sec … 10+ min). Ends with the % of the session spent focusing.
  "10+ min" counts as 10 minutes in that %. A length that can't have happened yet is disabled (greyed
  out but readable): one longer than the free time, which is the time so far minus the distraction time
  already logged in this session ("10+ min" counts as 10 min here too). E.g. with 5 min logged at
  minute 6, only "30 sec" and "1 min" work, and "5 min" works again from minute 10. "30 sec" is never
  disabled, so the row isn't all grey at the start. Checked every half second and after every
  distraction or Undo.
- **Undo:** after any distraction button (both modes), **End session** turns into **Undo** for 5 s
  (`UNDO_WINDOW_MS` in `public/js/app.js`): same place, same size, so nothing on the screen moves.
  A thin bar along its bottom edge counts down the 5 s, then End session comes back. Undo takes back
  only the latest distraction: it's removed from the session, the reaction stops and the character goes
  back to its normal pose, the category picker closes, the "doing well" timer is set back to what it
  was before the tap, and the session is saved. A new tap inside the 5 s moves Undo to the new
  distraction and starts the 5 s again. After a reload there's no Undo.
- **Distraction categories:** after each distraction button, once the reaction has played (1.4 s,
  `PICKER_DELAY_MS`), a small optional picker appears above the bottom buttons:
  Phone, Thoughts, Noise, People, Tired, Other. It hides itself after 3 s (`PICKER_TIMEOUT_MS`;
  both constants are at the top of `public/js/app.js`). A tapped category is saved with the
  distraction; otherwise it's saved as `category: null`. Tapping another distraction button replaces
  the picker (the earlier distraction keeps `null`), and **Undo** closes it.
- **"A whole lot" / "10+ min"** asks: continue this session, or start over with a new duration.
  The category picker and the Undo window come first: the dialog opens once the picker has closed and
  the 5 s Undo window is over, so they never show at the same time. Undoing the tap means no question
  (an earlier "10+ min" / "A whole lot" that wasn't undone still asks, right after the Undo). The
  question is saved with the running session (`restartPending`) as soon as the button is tapped, so if
  the page is reloaded before it's answered, it's asked right after the reload.
  If the session has run at least 1 minute, the dialog also has a checkbox above **Start over**:
  "Save the first 12 min 30 sec to history" (the time so far, measured when the dialog opens), ticked
  by default. With it ticked, **Start over** saves the abandoned part to the history first, as ending
  at that moment, with `endedBy: "startOver"`. Its focus % and stats are calculated the normal way
  (including the long distraction that triggered the question), and it counts for the streak and all
  history stats like any other session. Unticked, the abandoned part is thrown away. **Continue**
  ignores the checkbox. Under 1 minute there's no checkbox and nothing is saved, as before.
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

| Result | Kind | Firm | Strict | Ragebait | Title |
|---|---|---|---|---|---|
| great | `good` (proud) | `good` (approving) | `good` (satisfied) | `good` (grudging) | Great session! |
| okay | `level2` (pleased) | `level1` (eyebrow raised) | `initial` (neutral) | `level1` (side-eye) | Good effort! |
| rough | `level4` (gently encouraging) | `level3` (serious) | `level2` (disappointed) | `level4` (mocking) | Tough session |
| short | `initial` | `initial` | `initial` | `initial` | That was quick |

The poses are in `SUMMARY_POSES` (`public/js/app.js`); titles and Simple-mode messages for each result
are in `public/js/data/messages.js`.
- A running session survives a page reload (it's saved in `localStorage`, the browser's built-in storage).
- **Timer ran out while you were away** (page closed, or phone locked or in another app):
  - Back within 30 minutes of the end (`REOPEN_ASK_AFTER_MS` at the top of `public/js/app.js`):
    the session is saved as a full session and the summary is shown, as if you'd watched it end.
  - Back later than that: the app can't tell whether you kept focusing, so it asks
    "Your 90 min Advanced session with Boss ended 2 days ago. … Save it to your history?"
    **Save** saves it exactly as above (full planned length, `endedBy: "timer"`, focus % from the
    distractions you logged, `null` in Simple mode) and shows the summary. **Discard** saves nothing
    and goes back to the setup screen. Esc doesn't answer it, and if the page is closed before
    answering, the question comes back next time.
  - Both cases work the same in Simple and Advanced mode. A continue/restart question that was
    still waiting is dropped, as before.
  - Neither case plays the end chime (see below).

### Sound and screen

- **End chime:** when the timer runs out on its own, a short, soft chime plays: three rising notes,
  about 1 second, generated with the Web Audio API (the browser's built-in sound generator, so there's
  no audio file). On Android the phone also vibrates briefly (iOS ignores vibration). The chime and
  the vibration only happen when the end is seen as it happens: within 5 s of the end time
  (`END_SOUND_VISIBLE_MS`), or within 75 s if the tab is in the background (`END_SOUND_HIDDEN_MS`),
  because browsers run background timers late. Never on **End session**, **Start over**, a page
  reopened or reloaded after the end, a phone unlocked after the end, or the "Welcome back" question.
  The notes, volume and vibration pattern are constants at the top of `public/js/app.js`.
- **Why there's a tap first:** browsers only allow sound after a tap. The sound is unlocked by the
  **Start session** tap, and every tap or key press during a session unlocks it again if the browser
  has paused it (after a reload, a phone call, or another app taking over the audio). The chime itself
  also tries to resume paused audio; if that doesn't work within a moment, it's skipped rather than
  played late.
- **iPhone silent mode:** the Ring/Silent switch (or the Action button set to silent) mutes the chime.
  This is how iPhones treat web page sounds, and the app doesn't try to get around it.
- **Background tab on a computer:** browsers slow down timers in hidden tabs, so the chime can come
  late: in Chrome and Edge up to about 1 minute (once the tab has been hidden for 5+ minutes), in
  Firefox and Safari usually about 1 second. While the computer is asleep nothing runs; waking it
  after the end counts as coming back later, so there's no chime.
- **Keep the screen on:** while a session is on screen, the app asks the browser to keep the screen
  on (the Screen Wake Lock API), so the phone doesn't lock and pause the page. A locked phone pauses
  the page, so without this the chime would rarely play on a phone. The lock is released when the
  session ends or is stopped, and on the setup and summary screens. The browser drops it whenever the
  page is hidden (another tab or app), so it's asked for again when the page is visible. After a reload
  the browser may refuse it until the first tap, so taps during a session ask again. Browsers without
  support (or a refused request, e.g. in battery saver mode) just carry on without it. Needs HTTPS,
  so it doesn't work when `index.html` is opened as a local file.

## Personalities

There's no style to choose: each character's `group` in `public/js/data/characters.js` decides its
personality, in one place (`GROUPS` and `personalityOf()`). A new character only needs a `group`.

| Group | Personality | How it reacts |
|---|---|---|
| `relaxed` (Grandma, Leader, Santa, Study Buddy, Coach, Meditation Guide) | `kind` | Happy you're back, cheers you on. Hops. |
| `firm` (Professor, Librarian, Surgeon), label "Firm but fair" | `firm` | Patient, but expects your best. Never shouts or gets angry: disappointment instead. One slow, calm lean (never shakes); a small nod when you do well. |
| `strict` (Boss, Soldier, Headmistress, Grandmaster) | `strict` | Stern when you drift off, angrier each level. Shakes. |
| `ragebait` (Bodybuilder, Influencer) | `ragebait` | Annoying on purpose: mocking, more insulting each level. Cheeky head tilt. |

The picker lists the characters in group order: relaxed, firm, strict, ragebait (the order of
`CHARACTERS` in `characters.js`).

Characters react only with poses and facial expressions, never with text. The firm poses:

| Pose | Firm reaction |
|---|---|
| initial / blink | Calm, level brows, slight smile |
| level1 | One eyebrow raised |
| level2 | A long, level look: one eyebrow still raised, eyes narrowed |
| level3 | Serious: stern brows, flat mouth |
| level4 | Stern but calm: narrowed eyes, flat mouth (no angry brows) |
| level5 | A disappointed sigh: eyes closed, worried brows, small frown |
| good | A small approving smile, more restrained than kind (no sparkles or blush) |

A character can replace some of its personality's poses with its own (`poses` in its entry in
`ART_LOOKS`, `public/js/placeholder-art.js`). Influencer does this for level4.

The ragebait poses:

| Pose | Ragebait reaction |
|---|---|
| initial / blink | Bored half-closed eyes looking straight ahead, small smirk |
| level1 | Side-eye: white eyes under a low lid, pupils pushed to the side, one eyebrow up, wide smug grin |
| level2 | Eye-roll |
| level3 | Wink and tongue out |
| level4 | Laughing at you with a sarcastic slow clap. Influencer instead just laughs, with his phone still filming you from his hand |
| level5 | Middle finger |
| good | Grudging: arms crossed, half-closed eyes looking away, flat "meh" mouth, a small shrug. Never proud |

## Session history (`history.html`)

Every finished session (timer ran out or **End session** pressed) that ran at least 1 minute is saved
on the device, except one you chose to **Discard** after coming back long after it ended (see above). A session abandoned with **Start over** is saved too, unless its "Save the first …
to history" checkbox was unticked (see above). The page shows:

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
- **Last 30 sessions** with date, character, mode, length, distractions and focus %. Sessions saved
  by **Start over** have a small "restarted" label.
- **Backup:** Export and Import buttons (see below).

Simple-mode sessions have no focus % (their buttons aren't time-based). They count for streaks and
appear in the list as "—", but are left out of the trend and time-of-day numbers.

### Browser storage keys

| Key | What's in it |
|---|---|
| `ct_session_v1` | The session that's running right now (removed when it ends). `restartPending: true` while the continue/restart question is unanswered; older saved sessions don't have it, which means `false` |
| `ct_history_v1` | Finished sessions, newest first, max. 1000 |
| `ct_prefs_v1` | Last chosen character, mode and duration, plus `endSound` and `keepScreenOn` (the two setup checkboxes, `true`/`false`). Prefs saved before these existed get `true` for both. `homeScreenTipDismissed`: `true` once **Got it** was tapped on the iPhone Home Screen tip. `persistRequested`: `true` once persistent storage was asked for (or skipped in Firefox), see [iPhone storage and the Home Screen app](#iphone-storage-and-the-home-screen-app). Prefs saved before these two existed get `false` for both. A `style` value saved by older versions is ignored and dropped |

Each history entry: `startedAt`, `endedAt` (timestamps in ms), `endedBy` (`"timer"`/`"manual"`/`"startOver"`),
`characterId`, `style` (the character's personality when the session ran: `"kind"`, `"firm"`,
`"strict"` or `"ragebait"`), `mode`, `plannedMs`, `elapsedMs`, `distractedMs`, `focusPercent`
(`null` in Simple mode) and `distractions` (`[{ at, level, ms, category }]`). `category` is
`"phone"`, `"thoughts"`, `"noise"`, `"people"`, `"tired"`, `"other"` or `null` (nothing picked).
Sessions saved before categories existed have no `category` field; everything that reads it treats
that as `null`.
Sessions saved before personalities came from the character keep the style that was chosen then
(for example a strict Grandma). A session that was still running when this changed continues, and
is saved, with the character's own personality.
History lives only in this browser: clearing site data or switching devices starts it over.
The history page says so, too.

### iPhone storage and the Home Screen app

Safari on iPhone and iPad can erase a site's saved data (history, streak, prefs) after 7 days of
using Safari without visiting the site. Web apps added to the Home Screen are exempt. Android Chrome
doesn't do this.

- **Web app manifest** (`public/manifest.webmanifest`, a small file that tells the phone the app's
  name, icon and colors): makes "Add to Home Screen" on iPhone and "Install app" on Android open the
  app full screen, without the address bar, with the ConcenTraining name and icon. Start page and
  scope are the site root. Background and theme color are the light theme's `--bg` (`#f6f3ee`). Each
  page also has two `theme-color` metas (light `#f6f3ee`, dark `#17161b`, each with its own
  `prefers-color-scheme` media query), so the browser bar matches the page in both modes.
- **Home Screen tip** (setup screen): a small card with why (the 7-day rule), how ("tap Share (or
  ••• → Share), then Add to Home Screen") and the catch: **the Home Screen app has its own separate
  storage on iPhone**, so the current history doesn't move over by itself. Export it in Safari first,
  then Import it in the Home Screen app (the card links to the Backup section of the history page).
  It's only shown when all of these are true:
  - iPhone or iPad (an iPad in desktop mode, which says it's a Mac, counts if it has a touch screen),
  - Safari, not Chrome, Firefox, Edge, Opera or the Google app on iOS, and not an in-app browser,
  - not already opened from the Home Screen (`navigator.standalone` isn't `true` and the page isn't
    in `display-mode: standalone`),
  - at least 1 finished session in the history, so first-time visitors don't see it,
  - **Got it** hasn't been tapped (saved as `homeScreenTipDismissed` in `ct_prefs_v1`).

  It's never shown during a session or on the summary screen. The check is `iosSafariNotInstalled()`
  in `public/js/history-store.js`.
- **History page:** under the same conditions (except the history and Got it rules), the storage note
  gets one more sentence about the 7-day rule and the Home Screen app.
- **Persistent storage:** once per device, right after a session is saved to the history, the app
  calls `navigator.storage.persist()`, which asks the browser to mark this site's storage as
  persistent so it isn't cleared on its own (for example when the device runs low on space). The
  browser decides, and nothing is shown either way. It isn't guaranteed to override Safari's 7-day
  rule; the Home Screen app is the reliable fix. Skipped in Firefox, because Firefox would show a
  permission bar right after the session. Either way `persistRequested` is set in `ct_prefs_v1`, so
  it's only tried once.
- **Icons** (`public/icons/`, `public/favicon.ico`): placeholders (white "CT" on orange) until the
  real character art. `apple-touch-icon.png` (180, full square, iOS rounds the corners),
  `icon-192.png` and `icon-512.png` (rounded), `icon-maskable-512.png` (full square, "CT" inside the
  middle safe zone, so Android can crop it to any shape) and a 16/32/48 px `favicon.ico`. They were
  made once with a throwaway script; only the image files are in the repo. To replace them, keep the
  same file names and sizes.

**In the Home Screen app** (standalone mode: no address bar and no browser Back button):

- Every page can be reached and left with links in the page: setup → "Your history →", summary →
  "See your history" / "Start another session", history → "← Back to the timer". `stats.html` isn't
  linked from the app (it's for the site owner) but has its own back link.
- The end chime, vibration and Screen Wake Lock work as in the browser (see
  [Sound and screen](#sound-and-screen)), with these known differences:
  - Screen Wake Lock didn't work in iPhone Home Screen apps on iOS 16.4–18.3 (a WebKit bug, fixed in
    iOS 18.4). On those versions the screen can lock during a session, as in browsers without support.
  - iOS closes Home Screen apps more readily in the background, so the page may reload when you come
    back. A running session survives that, like any reload.
  - Exporting (a file download) from inside a Home Screen app has been unreliable on some iOS
    versions. The tip's order avoids it: Export in Safari, Import in the app (Import uses the file
    picker, which works).

### Export and import

- **Export** downloads `concentraining-history-YYYY-MM-DD.json`:

  ```json
  {
    "app": "ConcenTraining",
    "type": "session-history",
    "version": 5,
    "exportedAt": "2026-10-28T09:00:00.000Z",
    "sessions": [ /* history entries, newest first */ ]
  }
  ```

- **Import** reads such a file and **adds** its sessions to the history. A session whose start time
  is already in the history, or appears twice in the file, is skipped ("Skipped 2 duplicates or
  sessions you already had"). Like when a new session is saved, only the newest 1000
  sessions are kept: if the total goes over 1000, the oldest sessions are removed, whether they
  came from the file or were already in the history. The result message says how many were
  imported, how many from the file didn't fit, and how many existing sessions were removed.
- The file itself must have the right `app`, `type` and `version`, otherwise nothing is imported
  and the page says what's wrong. Max. file size: 5 MB.
- Each session is checked on its own. An invalid session is skipped and the rest still import;
  one line says how many were skipped and why, for example
  "Skipped 3 invalid sessions (2 shorter than 1 minute, 1 focus % doesn't match distraction time)".
  A session must have valid times, `endedBy`, character id, mode, style, focus % and distractions
  (unknown character ids are fine, so a newer export with new characters still imports), **and
  its numbers must agree with each other** the way the app saves them:
  - at least 1 minute long (same rule as saving), and `elapsedMs` = `endedAt − startedAt`
  - `plannedMs` is a whole number of minutes (at least 1), and `elapsedMs` isn't more than it
  - `endedBy` fits the times: `"timer"` ran the full planned time, `"manual"` and `"startOver"`
    less. The allowed values and their rules are in `ENDED_BY_RULES` in
    `public/js/history-store.js`: a new value needs one line there, plus a version check in
    `cleanImportedSession` (like the one for `"startOver"`).
  - every distraction is inside the session (up to 1 minute after the end is allowed, for a tap
    just as the timer runs out); Simple-mode distractions have `ms: 0`, Advanced ones are
    30 sec to 10 min long
  - `distractedMs` and the Advanced `focusPercent` are what the app calculates from the
    distractions. Simple mode's `focusPercent` must be `null`. Before 19 Oct 2026 the app
    rounded a distraction under 0.5% of the session up to 100%, so that old value is accepted too.
- `test-data/` has small files for testing these checks (see `test-data/README.md`).
- **Versions:** version 2 added `category` to each distraction. Version 1 files (made before that)
  still import; their distractions get `category: null`. From version 2, every distraction must
  have a known category or `null`. Old sessions without the field are exported with `null`.
  Version 3 allows `style: "ragebait"`; in version 1 and 2 files the style must be `kind` or `strict`.
  The fields didn't change, but a version 2 app can't read a ragebait session, so the new number
  makes an older app say "made by a newer version" instead of skipping every ragebait session.
  Version 4 allows `endedBy: "startOver"` (for the same reason); in version 1–3 files it's an
  "unknown end reason". Version 5 allows `style: "firm"` (again for the same reason); in version
  1–4 files it's an "unknown style".
- The future adaptive training program must skip `endedBy: "startOver"` sessions (a note next to
  `ENDED_BY_RULES` says so too): they stopped because of the long distraction, not because of the
  chosen length.
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
| `public/js/placeholder-art.js` | Built-in placeholder drawings (kind, firm, strict and ragebait faces, plus each character's look) for characters without real art |
| `public/js/app.js` | Timer, reaction engine, distraction category picker, Undo, disabled Advanced lengths, motivation rotation, end chime, screen wake lock, summary, iPhone Home Screen tip, persistent storage request |
| `public/js/history-store.js` | Saving/loading history, focus % and summary result (with their thresholds), distraction categories, export/import checks, iPhone Safari check (used by both pages) |
| `public/js/history.js` | Streaks, weekly chart, time of day, distraction categories, session list and backup buttons on `history.html` |
| `netlify/functions/picks.mjs` | `POST /api/picks`: counts one tap on a character |
| `netlify/functions/stats.mjs` | `GET /api/stats`: popularity + which characters are paid |
| `netlify/database/migrations/` | Database tables (SQL), applied automatically on deploy |
| `test-data/` | Small export files for testing Import (not deployed, see `test-data/README.md`) |
| `public/manifest.webmanifest` | Web app manifest: name, colors and icons for Add to Home Screen / Install |
| `public/icons/` | Placeholder app icons (Home Screen, Android, maskable) |
| `public/favicon.ico` | Browser tab icon (placeholder) |
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
- The first migration created Grandma, Boss, Soldier and Bodybuilder;
  `20261020120000_add_seven_characters.sql` added Leader, Santa, Study Buddy, Coach, Professor,
  Headmistress and Grandmaster, and `20261020150000_add_four_characters.sql` added Meditation
  Guide, Librarian, Surgeon and Influencer. With 15 characters the paid selection is active: the
  top 2 by recent taps are marked "(paid)" on `/stats.html`.
- Settings (30 days, 10 characters, 10%) are constants at the top of `netlify/functions/stats.mjs`.

## Deploying

Connect this GitHub repo to the Netlify site (Site configuration → Build & deploy → Link repository).
Leave the build command empty; `netlify.toml` already sets the publish directory to `public`.
On every push Netlify installs `package.json`, deploys the functions, creates the database on the
first deploy, and applies new migrations.

**Deploy Previews have their own database.** Each Deploy Preview gets its own database branch: a
separate copy of the live database, made when the preview is created. New migrations run on that
copy, and taps on the preview are counted only there. The live database only changes when a
pull request is merged and the production deploy runs. Because the copy starts with the live
numbers, the preview's `/stats.html` shows real data. Netlify Database needs a credit-based Netlify plan;
if a deploy fails with "database feature not available for this account", the plan is the reason.
