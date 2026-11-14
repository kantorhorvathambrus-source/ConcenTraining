# Core audit report (November 2026)

Read-only audit of the timer, multi-tab, storage, history and export/import code.
Nothing was changed in the app. Nothing was run: every finding comes from reading the code,
so each one has a short recipe to confirm it before it is fixed.

- Audited commit: `b0020a5` (main = live = PR #67).
- Files read: `public/js/app.js`, `history-store.js`, `history.js`, `sw-register.js`, `theme.js`,
  `i18n.js`, the `notificationclick` part of `public/sw.js`, and the load/save part of
  `public/js/custom-characters.js`.
- Line numbers are from that commit and will drift: the function name is the reliable pointer.
- Status: **in progress**. Areas done so far: A, B, C, E. Sections 1, 3, 4 and 5 are filled in last.

Words used below:

- **Wall clock**: the device's date and time (`Date.now()`), which the user or the network can change.
- **Web Locks**: a browser feature that lets only one tab at a time hold a named "lock"; the app
  uses it so that only one tab runs the session.
- **Service worker**: the small background script (`sw.js`) that makes the app work offline and
  handles taps on notifications.
- **Orphaned session**: a running session saved in `ct_session_v1` whose tab was closed.

---

## 1. Top 5 in plain English

_Filled in at the end of the audit._

---

## 2. Findings

Severity: **critical** = existing data lost for many users; **high** = data lost or clearly wrong
numbers in a realistic case; **medium** = wrong or confusing in a less common case; **low** = rare
or cosmetic. Size: S = under ~30 changed lines, M = one function group, L = several files.

### Area A: timer correctness

#### C1: A session that ran out while the app was closed or hidden is saved as fully focused, without asking

- **Severity:** medium (wrong numbers, by design today). **Area:** A. **Size:** M.
- **What the user sees:** Start a 25-minute Advanced session, leave the app after 1 minute (or
  close the tab), come back 30 minutes later. The summary says 25 minutes, 100% focus, "great",
  and that goes into the history. The app knew the page was hidden for 24 of the 25 minutes and
  never asked about it. In Simple mode the same session is saved with 0 distractions.
- **Where:** `app.js`: `noteReturn()` (calls `tick()` first, "the end logic wins"),
  `resumeSavedSession()` → `onTimerRanOut(false)` → `finishSession(endedAt)`.
- **Root cause:** the time away card (`askPendingAway`) is only shown while the session is still
  running. When the planned end has already passed, `onTimerRanOut` finishes the session at once
  (if the return is within `REOPEN_ASK_AFTER_MS` = 30 minutes after the planned end) and
  `session.leftAt`, which holds the moment the page was left, is thrown away unused. Writing
  100% focus for time nobody measured goes against the product rule "never invent data".
- **Proposed fix:** when the session has run out and `session.leftAt` is set and
  `effectiveEnd(session) - session.leftAt >= AWAY_MIN_MS`, ask the time away question before the
  session is saved: the length is `effectiveEnd - leftAt`, rounded down to whole seconds ("You
  were away for the last 24 min"). "Yes" logs the usual away distraction (`at: leftAt`, the same
  level rule `awayLevel`, `ms` only in Advanced mode), then the session is saved and the summary
  shows. "No" saves it as today. The same question should come first in the "late" path
  (`askSaveLateSession`) when the user chooses Save.
- **Alternatives:** (a) keep today's behaviour and only document it; (b) make the existing "save
  this session?" question (`lateDialog`) depend on the time away instead of the 30 minutes.
  (a) is the cheapest, (b) loses the measured length.
- **Risk of the fix:** the away distraction must still pass the import rules in
  `cleanImportedSession` (`ms` in whole seconds, `ms <= elapsedMs`, `at` inside the session); with
  `ms = effectiveEnd - leftAt` and no break inside that span it does. A level 5 away distraction
  must not open the continue/restart question after the end. The end chime must not be delayed
  when the user is watching the timer end (then `leftAt` is not set, so nothing changes).
- **How to confirm:** Advanced mode, 2-minute session, wait 10 s, switch to another app, come
  back after 3 minutes. Expected today: summary 2 min, 100%, no question asked. Check
  `ct_history_v1`: `focusPercent: 100`, `distractions: []`.

#### C2: Tapping Start can silently resume a different, older session instead of starting the chosen one

- **Severity:** medium. **Area:** A (restore) and B. **Size:** M.
- **What the user sees:** a session is running in tab 1 and that tab is closed without ending
  it. In tab 2 (or after reopening the app in a state that shows the setup screen) the user picks
  another character and 45 minutes and taps Start. Instead of the new session: (1) the old
  session appears, with its own character and remaining time, usually with a time away card; or
  (2) if the old one ran out less than 30 minutes ago, its summary appears and it is saved as a
  full session (see C1); or (3) if it ran out longer ago, the "Welcome back" question appears.
  The new choice is ignored without a word, and the user has to tap Start a second time.
- **Where:** `app.js`: `onStartClick()`, the branch `if (locks && savedRunningSession()) {
  continueSavedSession(false); return; }`; also `checkSessionElsewhere()` / `backToSetup()`, which
  bring the setup screen back while the orphaned session is still saved.
- **Root cause:** the rule "a session saved by another tab is never replaced" is right, but the
  only time it is applied is inside the Start tap, and it is applied silently.
- **Proposed fix:** ask instead of deciding. When Start (or Quick start) finds an orphaned
  session, show one small dialog: "You have an unfinished session (25 min, 12 min left).
  Continue it / End it and start the new one". "End it" finishes the old one the normal way
  (saved if it is at least 1 minute, ended at the moment its tab went away if `leftAt` is set,
  otherwise now) and then starts the chosen session. Cases (2) and (3) can keep today's flow but
  should start the chosen session afterwards, or at least say what happened.
- **Alternatives:** (a) offer the orphaned session as soon as it is detected (when the setup
  screen comes back in `backToSetup`, or at start-up), not at Start: clearer, but a new dialog on
  a screen the user did not touch; (b) keep the behaviour and add one line of text on the setup
  screen ("Start will continue your unfinished session"). Recommended: the dialog at Start.
- **Risk of the fix:** new UI text in nine languages; the dialog must respect "one tab at a
  time" (take the lock before finishing the old session; if another tab holds it, show the
  existing notice). The pick counter (`countCharacterPick`) must count the new session once.
- **How to confirm:** tab 1: start a 25-minute session, close the tab. Tab 2 (was open on the
  setup screen, or reopen the site in a new tab and see the session resume, then test from a
  second tab that was already open): choose another character, tap Start. The old session
  resumes.

#### C3: A change of the device clock during a session changes the session's length

- **Severity:** low (rare; automatic network time corrections are normally under a second).
  **Area:** A. **Size:** M.
- **What the user sees:** clock moved forward by 1 hour during a 25-minute session: the session
  ends at once and is saved as a full 25-minute "timer" session. Clock moved back by 10 minutes:
  the timer jumps back up, the session runs 10 real minutes longer than planned but is saved as
  25 minutes, and the time on the clock can sit at the full length while the session "has not
  started yet". After a backward change, distractions logged before the change can carry a time
  later than the session's saved end; such a session is saved, but a later import of the backup
  rejects it (see the import findings in area D).
- **Where:** `app.js`: `activeElapsed()`, `effectiveEnd()`, `tick()`, `resumeFromBreak()`
  (a negative break length is dropped by `if (ms > 0)`), `finishSession()`.
- **Root cause:** every time in the session is wall-clock time (`Date.now()`), with no check
  against the browser's steady clock (`performance.now()`, a counter that never jumps). Wall-clock
  time is the right base (it survives sleep, reload and a closed tab, which the steady clock does
  not), but nothing notices a jump.
- **Proposed fix:** keep the wall clock, and handle only what can be detected safely: a
  **backward** jump. In `tick()`, remember the last tick's `Date.now()`; if the new value is
  lower (or lower than `session.startedAt`), move the session into the new timeline by shifting
  every time stored in the running session (`startedAt`, each distraction's `at`, each pause's
  `at`, `pausedAt`, `leftAt`) by the size of the jump, then save. A **forward** jump cannot be
  told apart from the device sleeping (in Chromium the steady clock also stops during sleep), so
  it stays as it is; the existing "late" question already covers jumps of more than the session
  length plus 30 minutes.
- **Alternatives:** do nothing and document it. Reasonable for launch.
- **Risk of the fix:** shifting times is easy to get subtly wrong (the history dedupes sessions
  by `startedAt`, so the shift must happen only on the running session, never on saved ones).
  Breaks already absorb clock changes correctly: time during a break is never counted.
- **How to confirm:** desktop: start a 5-minute session, set the system clock back 10 minutes,
  watch the timer (it shows 05:00 for 10 minutes). Set it forward 1 hour: the session ends at
  once and the summary says 5 min.

#### C4: The screen lock (Wake Lock) can stay lost after a quick hide and show

- **Severity:** low. **Area:** A. **Size:** S.
- **What the user sees:** very rarely, after switching away and back within a moment, the screen
  turns off during a session although "keep the screen on" is ticked, and the "your screen may
  turn off" note does not show. The next hide/show repairs it.
- **Where:** `app.js`: `updateWakeLock()`.
- **Root cause:** if the page is hidden and shown again while `navigator.wakeLock.request()` is
  still out, the "visible again" call returns early (`wakeLock.pending`), and the request can then
  resolve with a lock the browser has already released. Its `release` event fired before the
  listener was attached, so `wakeLock.sentinel` keeps pointing at a dead lock and nothing asks
  again. Also, a page restored from the back/forward cache (`onPageShow`) does not call
  `updateWakeLock()`; it relies on the next tap.
- **Proposed fix:** after the request resolves, check `sentinel.released` and, if it is already
  released while `wakeLockWanted()` is still true, clear it and ask once more; call
  `updateWakeLock()` from `onPageShow`.
- **Risk of the fix:** minimal; keep the "no blinking note" behaviour of `updateScreenNote()`.
- **How to confirm:** hard to reproduce by hand; confirm by reading: in `updateWakeLock()` the
  resolved sentinel is stored without checking `sentinel.released`.

### Area B: multiple tabs

#### C5 (known bug F8): The leave reminder notification focuses the wrong tab

- **Severity:** medium. **Area:** B. **Size:** M (two files: `app.js`, `sw.js`).
- **What the user sees:** tapping "come back" on the reminder brings up a ConcenTraining tab that
  is not the one running the session (for example a tab showing "This session is open in another
  tab", or the browser tab when the session runs in the installed Home Screen app).
- **Where:** `public/sw.js`, the `notificationclick` listener: `windows.find((client) =>
  cacheKey(client.url) === SCOPE_URL.href)`; and `app.js` `showLeaveReminder()`, which gives the
  notification no information about which tab showed it.
- **Root cause:** the service worker focuses **the first open window whose address is the app
  page**. Every app tab and the installed app have the same address, and nothing links the
  notification to the tab that created it. `clients.matchAll()` lists windows most recently
  focused first, so the choice is "the app window the user looked at last", which is the wrong
  one whenever a second app window was looked at after the session tab. The comment above the
  listener ("the open one ... it runs the session") assumes there is only one.
- **About the hypothesis** (`navigator.locks.query()` `clientId` does not match the service
  worker's `Client.id` in Chromium): the code on main does not use `clientId` at all, so it is not
  the cause of today's bug. As a fix design it is unsafe: as far as I know Chromium gives each
  lock connection its own random id instead of the service worker client id, so the two would not
  match there. I could not run a browser in this audit, so treat that as likely, not proven; the
  recommended design below does not depend on it.
- **Proposed fix (recommended, design "A"): the page tells the notification who it is.**
  1. At start-up the page asks the service worker for its own client id: it sends a small
     message (for example `{ type: "ct-whoami" }`, with a `MessageChannel` port for the answer) to
     `registration.active`; the service worker answers with `event.source.id`. The page keeps the
     id in memory (it lives as long as the page does).
  2. `showLeaveReminder()` passes it along: `data: { clientId }` in the notification options.
  3. `notificationclick` reads `event.notification.data`, calls `self.clients.get(clientId)` and
     focuses that window. If there is no id, no such window (the browser discarded and reloaded
     the tab, which gives it a new id) or focusing fails, it falls back to exactly what it does
     today (first matching window, then `openWindow`).
  The id travels inside the notification, which the browser stores, so this works even when the
  service worker was stopped in between and when the session tab is frozen in the background
  (it does not need to answer anything at tap time).
- **Alternatives:**
  - **B: ask the tabs at tap time.** The service worker sends "do you hold the session?" to every
    window and focuses the one that says yes. Rejected: on Android a background tab is frozen and
    cannot answer, which is exactly the situation the reminder is for.
  - **C: the service worker calls `navigator.locks.query()` itself** and matches `clientId` to
    `Client.id`. Rejected: this is the hypothesis above; it depends on a browser detail.
  - **D: mark the session tab's address** (for example `?session=1` with `history.replaceState`)
    and match on `client.url`. Rejected: browsers differ on whether `client.url` follows such
    changes, and it changes the address users see and share.
  - **E: the service worker remembers the last session tab** (message on session start, stored in
    the Cache or IndexedDB because a stopped worker forgets its variables). Works, but more code
    and one more stored thing than A.
- **Risk of the fix:** the answer to "who am I" needs an active service worker; on a first visit
  there is none yet, and the reminder is already skipped then (`!registration.active`). The new
  `message` listener in `sw.js` must ignore every other message. `sw.js` changes: follow the
  CLAUDE.md offline rule and the README on how a new `sw.js` reaches users (raise `CACHE_VERSION`
  if the convention asks for it). No new data leaves the device, so no privacy page change.
- **How to confirm:** Android Chrome, reminder ticked. Open the app in two tabs. Tab 1: start a
  session. Switch to tab 2 (it shows the "open in another tab" notice), then press Home. Tap the
  notification. Expected today: tab 2 comes up, not tab 1. Second recipe: session in the installed
  app, then open the site in a Chrome tab, press Home, tap the notification.

#### C6: The "open in another tab" notice can appear, and stay, when no tab runs the session any more

- **Severity:** low. **Area:** B. **Size:** S.
- **What the user sees:** two windows side by side. Window 1 runs a session and is closed.
  Window 2, on the setup screen, switches to "This session is open in another tab" at that very
  moment and stays there, although nothing is running. "Continue here" still works and resumes
  the session, so nothing is lost.
- **Where:** `app.js`: `onStorage()` (shows the notice from the saved session alone),
  `checkSessionElsewhere()` (the only place that asks the browser who holds the lock, and it only
  runs when the page becomes visible).
- **Root cause:** closing a tab saves the session one last time (`noteLeave` writes `leftAt`),
  which fires a `storage` event in the other tab; `onStorage` does not check the lock. The comment
  above `checkSessionElsewhere` describes this and repairs it on the next "page shown" event,
  which never comes for a window that stayed visible.
- **Proposed fix:** in `onStorage`, before showing the notice, ask `locks.query()` like
  `checkSessionElsewhere` does, and check once more about a second later (the closing tab's lock
  is released a moment after its last save).
- **Risk of the fix:** the notice appears a few milliseconds later (one async call). Keep the
  no-Web-Locks path unchanged.
- **How to confirm:** desktop, two windows side by side on the app. Start a session in window 1,
  watch window 2 show the notice, close window 1: window 2 keeps (or re-shows) the notice.

### Area C: storage and data integrity

#### C7: When the save at the end of a session fails, the session is gone

- **Severity:** medium (rare, but the whole session is lost). **Area:** C. **Size:** M.
- **What the user sees:** the summary shows "Couldn't save" and that is all. There is no "try
  again" and no way to keep the session; leaving the summary drops it for good.
- **Where:** `app.js` `finishSession()`: `remove(SESSION_KEY)` runs whatever
  `saveFinishedSession()` returned; the same in `askContinueOrRestart()` for the "first part"
  saved by Start over.
- **Root cause:** the running session's own copy (`ct_session_v1`) is deleted even when the
  history write failed (storage full, or site data blocked during the session). During a session,
  failed saves of `ct_session_v1` are silent as well (`save()` swallows the error), so the user
  only finds out at the end.
- **Proposed fix:** on `"failed"`, keep the finished session instead of deleting it: (1) a "Try
  again" button on the summary that calls `saveFinishedSession` again (the user may have freed
  space or allowed site data meanwhile); (2) a "Download this session" button that writes a normal
  export file with this one session, so it can be imported later; (3) keep the finished session
  in storage as "finished, not saved yet" and retry at the next start-up, removing it only after
  `"saved"` or `"exists"`. Part (3) must not be overwritten by the next Start.
- **Alternatives:** only (1) and (2): no new stored state, smallest change. Recommended for
  launch; (3) can follow in December.
- **Risk of the fix:** (3) adds a stored state that every reader of `ct_session_v1`
  (`savedRunningSession`, `onStorage`, `canShowElsewhere`) must understand; a new storage key for
  it would need a privacy page check. New UI text in nine languages.
- **How to confirm:** start a 1-minute session; before it ends, fill the storage from the
  console (`localStorage.setItem("x", "a".repeat(5_000_000))`, repeat with smaller sizes until it
  throws). Let the session end: "Couldn't save". Check that `ct_session_v1` is gone and
  `ct_history_v1` does not have the session.

#### C8: The oldest sessions are deleted without a word once there are more than 1000

- **Severity:** medium (permanent loss, but only for long-time users; see C14 for the import
  case, which can happen on day one). **Area:** C. **Size:** S now, L in December.
- **What the user sees:** nothing. From session 1001 on, each new session removes the oldest one;
  the longest streak and every all-time number shrink quietly.
- **Where:** `history-store.js` `saveFinishedSession()`: `history.length = Math.min(history.length,
  HISTORY_LIMIT)`; `HISTORY_LIMIT = 1000`.
- **Root cause:** a fixed cap to keep `localStorage` (a small browser store, about 5 MB per
  site) from filling up, applied silently. It also cuts by position in the list, which assumes
  the list is sorted newest first (see C18).
- **Proposed fix (before launch, S):** raise the cap (5000 sessions is about 1.5 MB with
  typical sessions; four sessions a day for more than three years) and sort by `startedAt` before
  cutting. **December (L):** with accounts, move the history out of `localStorage` or stop
  cutting, because two devices that each cut different sessions would keep sending them back to
  each other.
- **Alternatives:** keep 1000 and warn at 900 with a link to Export.
- **Risk of the fix:** a larger history makes every save rewrite more text (still a few
  milliseconds) and gets closer to the 5 MB limit for users with very many distractions per
  session; C15's limit per session keeps that in check.
- **How to confirm:** read `saveFinishedSession()`. Or in the console, fill `ct_history_v1` with
  1000 valid copies of one session with different `startedAt`, finish a real session, and check
  that the length is still 1000 and the oldest one is gone.

#### C9: Saved data that cannot be read is treated as "empty" and then overwritten

- **Severity:** medium (very unlikely today, total loss if it happens; more likely once sync
  writes this data too). **Area:** C. **Size:** M.
- **What the user sees:** the History page shows "No finished sessions yet" (with Export
  disabled), and the next finished session replaces everything that was there.
- **Where:** `history-store.js` `loadHistory()` (returns `[]` for broken JSON or a non-list) →
  `saveFinishedSession()`, `mergeIntoHistory()`, `deleteFromHistory()` write that back;
  `custom-characters.js` `loadCustomCharacters()` → `saveCustomCharacters()`.
- **Root cause:** "could not read" and "nothing saved yet" give the same result, and the next
  write replaces the original text. For custom characters there is a second path: a stored
  character that fails `cleanCustomCharacter()` (for example a personality that a later version
  no longer knows) is left out of the list, and the next save of any character writes the list
  without it.
- **Proposed fix:** tell the three cases apart: nothing saved (`null`), reading refused (storage
  blocked: never write), and saved text that does not parse or has the wrong shape. In the third
  case, before anything is written over it, copy the raw text to a rescue key (one copy, for
  example `ct_history_v1_unreadable`), and show a line on the History page with a "Download the
  unreadable data" button. For custom characters, keep entries that fail the check in the saved
  list untouched (write them back as they were) instead of dropping them.
- **Risk of the fix:** a new key holds the same kind of data on the device (check the privacy
  page wording); the rescue copy doubles the space for a broken history, so keep only one.
- **How to confirm:** console: `localStorage.setItem("ct_history_v1", "{oops")`, reload History:
  empty state. Finish a 1-minute session: `ct_history_v1` now holds only that session.

#### C10: One malformed session in the saved history breaks the History page, the export and the end of every session

- **Severity:** low (needs damaged data; nothing in the app writes such an entry today).
  **Area:** C. **Size:** S to M (fix together with C9).
- **What the user sees:** the History page stops drawing part-way; Export does nothing; a
  finishing session freezes on the session screen with the timer stopped, and does so again after
  every reload.
- **Where:** `history.js` `render()` and the functions it calls (`entry.distractions.length`,
  `flatMap`); `history-store.js` `buildHistoryExport()` (`entry.distractions.map`) and
  `saveFinishedSession()` (`entry.startedAt` on every entry); `app.js` `finishSession()` (an
  exception there skips `remove(SESSION_KEY)` and `showScreen`).
- **Root cause:** entries read from storage are never checked for shape, and none of these paths
  catches an error for a single entry.
- **Proposed fix:** one small "is this a usable session" check in `history-store.js` (an object
  with finite `startedAt`, `endedAt`, `elapsedMs`, a `distractions` list, ...). Readers skip
  entries that fail it; writers keep them in the saved list untouched (never drop them); the
  export includes them as they are or reports how many it left out. `finishSession()` should show
  the summary with the "Couldn't save" line if saving throws.
- **Risk of the fix:** readers and writers must use the same list positions; keep the "writers
  read the saved history again" pattern.
- **How to confirm:** console: put `null` as the first item of the `ct_history_v1` list, reload
  History (the page stays half-drawn, the console shows a TypeError), then finish a 1-minute
  session on the app page.

#### C11: The saved running session is restored without checking it

- **Severity:** low. **Area:** C. **Size:** S.
- **What the user sees:** with a damaged `ct_session_v1`, the app page stays blank on every load
  until the site's data is cleared (which also deletes the history).
- **Where:** `app.js` `savedRunningSession()` (checks only `endedAt` and the character),
  `resumeSavedSession()`, `init()`.
- **Root cause:** a missing `distractions` list or a non-number `startedAt` / `durationMs` throws
  inside `init()` before any screen is shown. A second, quieter case: a running session whose
  built-in character id no longer exists is ignored for ever and silently replaced by the next
  Start, so a built-in character must never be removed or renamed while sessions can be running.
- **Proposed fix:** check the shape in `savedRunningSession()` (numbers are finite numbers,
  `distractions` and `pauses` are lists, `mode` is known); a session that fails is moved aside (or
  removed) and the setup screen shows. Wrap the resume in `init()` so that any error still ends
  on the setup screen.
- **How to confirm:** console: `localStorage.setItem("ct_session_v1",
  '{"characterId":"<a real id>","startedAt":1}')`, reload: blank page, TypeError in the console.

#### C12: Saved preferences are used without checking their types

- **Severity:** low. **Area:** C. **Size:** S.
- **What the user sees:** nothing normally. With a damaged `ct_prefs_v1` (for example
  `"mode":"x"`), sessions are saved with that mode; the History page shows a raw text key for it
  and a later import of the backup rejects those sessions ("unknown mode").
- **Where:** `app.js`, the `prefs` object (`Object.assign(defaults, load(PREFS_KEY, {}))`).
- **Proposed fix:** after loading, put each field back to its default when it has the wrong type
  or an unknown value (`mode`, `minutes` through `clampMinutes`, the true/false settings). Keep
  unknown fields (`theme`, `language` belong to other files) untouched.
- **How to confirm:** console: set `ct_prefs_v1` to `{"mode":"x","minutes":"abc"}`, reload, look
  at the setup screen and start a session.

### Area E: which day a session counts on

#### C13 (known bug F11): The streak counts a session on the day it ended; everything else uses the day it started

- **Severity:** high (visible, wrong-looking numbers on the main statistics page).
  **Area:** E. **Size:** S for the minimum fix, M for the full fix.
- **What the user sees:** a session from 23:50 to 00:15 is listed under Monday and adds its time
  to Monday's week, but the streak counts it for Tuesday (and Monday gets nothing from it). On a
  Sunday night the "time per week" chart and the streak even disagree about the week. A session
  paused overnight and ended the next morning counts for the next day in the streak. After
  travelling to another timezone, or changing the phone's timezone, old sessions can move to a
  different day and the streak can change after the fact.
- **Where:** `history.js`: `calcStreaks()` uses `startOfDay(entry.endedAt)`; `calcWeeklyTime()`,
  `calcWeeklyTrend()`, `calcDayParts()` and the session list (`formatSessionDate(entry.startedAt)`)
  use `entry.startedAt`.
- **Root cause:** two different fields decide the day, and in every place the day is worked out
  again each time the page is drawn, in whatever timezone the device has at that moment. Daylight
  saving changes are handled correctly (`addDays` works on calendar days); only a change of
  timezone moves old sessions.
- **The ONE rule (proposed):** *a session counts on the local calendar day on which it
  **started**, by the clock of the device at that moment, and that day never changes afterwards.*
  - Start, not end: the start is the session's identity, it is the date shown in the list, four
    of the five places already use it, and breaks can move the end by hours or days but never the
    start.
  - Over midnight: the whole session (all its time, its streak day, its "best time of day" slot)
    belongs to the start day.
  - After a timezone change: old sessions stay on the day they had. "Today" is the device's
    current local date.
- **Proposed fix:**
  - **Minimum (S, no new data):** one helper in `history-store.js`, for example
    `sessionDay(entry)`, used by every calculation in `history.js`, based on `startedAt`. This
    ends the disagreement; sessions can still move when the timezone changes.
  - **Full (M):** when a session starts, also store the device's offset from UTC (world time) in
    minutes, for example `utcOffsetMin` (`-new Date(startedAt).getTimezoneOffset()`), in
    `ct_session_v1` and in the history entry. The helper works out the day, the week and the hour
    from `startedAt + offset`; sessions without the field (everything saved before the fix) fall
    back to the device's current timezone, as today. The date and time shown in the list should
    come from the same helper, so a session never shows a time that belongs to another day than
    the one it counts on. The export format gets the optional field (a whole number from -720 to
    840) in a new version 8; version 1 to 7 files import as before.
- **Alternatives:** count on the end day everywhere (rejected: breaks move the end); split a
  session's time at midnight between two days (rejected: complex, and a session is one line in
  the list).
- **Risk of the fix:** an existing streak can change by one day for users with sessions over
  midnight (acceptable before launch). The full fix stores one new value on the device, so
  `privacy.html` and its "Last updated" date must be updated in the same PR (CLAUDE.md rule), and
  `EXPORT_VERSION` handling must follow the comments at the top of `history-store.js`. Do not
  rewrite old entries.
- **How to confirm:** console on the History page: add two sessions to `ct_history_v1`, one from
  yesterday 23:50 to today 00:15 (local time) and nothing else today or yesterday. The list shows
  yesterday's date; the current streak is 1 because of **today** (delete the idea of "today":
  change the session to the day before yesterday 23:50 → yesterday 00:15 and the streak is still
  alive, although the list shows a session two days ago). For the timezone part: note the streak,
  change the device timezone by 12 hours, reload.

_Areas D and F follow._

---

## 3. Decisions for the owner

_Filled in at the end of the audit._

## 4. Fix PR plan

_Filled in at the end of the audit._

## 5. Checked and fine

_Filled in at the end of the audit._
