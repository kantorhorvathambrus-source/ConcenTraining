# Core audit report (November 2026)

Read-only audit of the timer, multi-tab, storage, history and export/import code.
Nothing was changed in the app. Nothing was run: every finding comes from reading the code,
so each one has a short recipe to confirm it before it is fixed.

- Audited commit: `b0020a5` (main = live = PR #67).
- Files read: `public/js/app.js`, `history-store.js`, `history.js`, `sw-register.js`, `theme.js`,
  `i18n.js`, the `notificationclick` part of `public/sw.js`, and the load/save part of
  `public/js/custom-characters.js`.
- Line numbers are from that commit and will drift: the function name is the reliable pointer.
- Status: **complete** (areas A, B, C, E, D and F).

Words used below:

- **Wall clock**: the device's date and time (`Date.now()`), which the user or the network can change.
- **Web Locks**: a browser feature that lets only one tab at a time hold a named "lock"; the app
  uses it so that only one tab runs the session.
- **Service worker**: the small background script (`sw.js`) that makes the app work offline and
  handles taps on notifications.
- **Orphaned session**: a running session saved in `ct_session_v1` whose tab was closed.

---

## 1. Top 5 in plain English

No critical finding: nothing in normal use loses a whole history. The five that matter most:

1. **The streak and the weekly chart disagree about the day (F11, finding C13).** The streak
   counts a session on the day it ended, everything else on the day it started, and old sessions
   can move to another day when the phone changes timezone. Proposed rule: a session counts on
   the day it started, by the phone's clock at that moment, for ever.
2. **Old sessions can be deleted without asking (C14, C8).** The history keeps only 1000
   sessions. An import can push out existing sessions and only says so afterwards; in normal use
   the oldest session disappears silently from session 1001 on.
3. **A session that ends while you are away is saved as perfect (C1).** Leave after one minute,
   come back after the end: the app saves the full time with 100% focus and never asks about the
   time away, although it knows when you left.
4. **The backup file is not a full backup (C16, C17).** Custom characters are not in it, their
   names on old sessions are lost at import, and a few unusual sessions the app saved itself are
   refused by its own import.
5. **The reminder notification opens the wrong tab (F8, finding C5).** The background script
   picks "any open app tab"; nothing tells it which tab runs the session. The fix is small: the
   tab puts its own id into the notification.

Close behind: when the save at the end of a session fails, the session cannot be rescued (C7),
and tapping Start can quietly continue an older unfinished session instead of the chosen one (C2).

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
- **How to confirm:** console on the History page: replace `ct_history_v1` with one valid
  session that started the day before yesterday at 23:50 and ended yesterday at 00:15 (local
  time), and reload. The list shows the day before yesterday, but the current streak says 1 day,
  because the streak counts the session for yesterday. By the proposed rule it is 0. For the
  timezone part: note the streak and the list, change the device's timezone by 12 hours, reload.

### Area D: history export / import (F10)

How it works today: Export writes every saved session as it is, labelled version 7. Import only
**merges**: a session whose start time is already in the history is skipped, everything else is
added, and each session is checked strictly (each field, and that the numbers agree with each
other). A broken session is skipped with a reason; the rest still imports. There is no "replace"
mode, and that is good: keep merge only.

#### C14: Import can delete existing sessions, and only says so afterwards

- **Severity:** high (existing data is removed for good, with no question and no undo).
  **Area:** D. **Size:** M.
- **What the user sees:** with 990 sessions saved, importing a file with 20 newer sessions
  removes the 10 oldest existing ones. The result line mentions it ("removed N older sessions")
  after it has happened. In general: after an import only the 1000 sessions with the newest start
  times are kept, whoever they belonged to.
- **Where:** `history-store.js` `mergeIntoHistory()` (sorts, cuts at `HISTORY_LIMIT` and writes
  in one step); `history.js` `importHistory()` (shows `import.removed` after the write).
- **Root cause:** the limit of C8 applied to the merged list, with no step between "work out the
  result" and "write it".
- **Proposed fix:** split the merge in two: first work out the result without writing
  (`added`, `skipped`, `droppedImported`, `removedExisting`); if `removedExisting > 0`, ask first
  ("This import would remove your N oldest sessions. Export your history first?" Cancel / Import
  anyway); only then write. Never let imported sessions push out existing ones silently. With the
  higher limit of C8 this dialog becomes rare.
- **Alternatives:** when the merged list is too long, drop imported sessions first and never
  existing ones (no dialog needed, but a restore into a full history then silently imports less;
  the result line already has a text for that, `import.didNotFit`).
- **Risk of the fix:** the history may change in another tab between the two steps, so the
  second step must read the saved history again and redo the merge (as `deleteFromHistory` does).
  New dialog text in nine languages.
- **How to confirm:** console: fill `ct_history_v1` with 995 valid sessions; import a file with
  10 valid sessions that started later. The status line reports removed sessions; the 5 oldest
  are gone.
- **Note:** one more import case was reported to the owner outside this file (the repository is
  public). The fixes of C14 and C15 together close it.

#### C15: Import has no sanity limits on dates, lengths and counts

- **Severity:** medium. **Area:** D. **Size:** M.
- **What the user sees:** a hand-edited or damaged file can add sessions dated years in the
  future or in 1970, sessions planned for weeks, times with fractions of a millisecond, or one
  session with tens of thousands of distractions. Such sessions distort the charts and streaks
  or use up the storage so that later sessions cannot be saved.
- **Where:** `history-store.js` `cleanImportedSession()`: `isTime()` accepts any finite number
  from 0 up; `plannedMs` has no upper limit; the number of distractions and breaks is not
  limited; only the file size is (`IMPORT_MAX_BYTES`, 5 MB, checked in `history.js`
  `importHistory()` before the file is read).
- **Proposed fix (limits):**
  1. Every time (`startedAt`, `endedAt`, each distraction's `at`, each break's `at`) is a whole
     number (`Number.isSafeInteger`).
  2. `startedAt` is not before a date safely earlier than the app's first release (for example
     1 January 2024) and `endedAt` is not later than the moment of the import plus one day (the
     day allows for a device clock that is a little off).
  3. `plannedMs` is at most 240 minutes (`MAX_MINUTES` lives in `app.js`; the limit needs to be
     in `history-store.js`, which both pages load).
  4. Distractions per session: at most **max(100, 5 for every second of session time)**. Why
     this number: taps are limited to one per 400 ms (`TAP_GUARD_MS`), which is 2.5 per second;
     the owner logged 117 in one minute by tapping (about 2 per second). 5 per second is twice
     what tapping can produce: 300 for a one-minute session, so real data always passes. Any
     limit below 2.5 per second would reject real sessions.
  5. Breaks per session: at most 1000.
  Reuse the existing reason codes where they fit (`badTimes`, `badPlanned`, `badDistraction`), so
  only one new text is needed ("too many distractions") in nine languages.
- **The same limit inside the app:** a held-down Enter key on a distraction button repeats the
  click many times per second and is not stopped by the tap guard (keyboard clicks are let
  through on purpose). Ignore clicks that come from key auto-repeat on the distraction buttons,
  so the app itself can never save a session that its own import would reject for limit 4.
- **Alternatives:** no limit on counts and rely on the 5 MB file limit alone (then one imported
  session can still be several megabytes).
- **Risk of the fix:** a limit that is too tight rejects real sessions for good at restore time;
  each limit above is far outside what the app can produce. Limit 2 uses the importing device's
  clock: if that clock is wrong by more than a day, fresh sessions would be rejected, so the
  reason text should say "date in the future".
- **How to confirm:** export a history, pick a session without distractions or breaks, move its
  `startedAt` and `endedAt` to the year 2099 (same difference between them), delete that session
  from the History page and import the file: it is accepted.

#### C16: The app can save sessions that its own import rejects, so a restore silently loses them

- **Severity:** medium. **Area:** D. **Size:** M.
- **What the user sees:** after Export on one device and Import on another (or after clearing
  the site's data), the result says "Skipped N invalid sessions", for sessions the app saved
  itself. They exist only in the file, and nothing can bring them back short of editing it by
  hand.
- **Where:** `history-store.js` `cleanImportedSession()` against what `saveFinishedSession()`
  writes; `buildHistoryExport()`.
- **Root cause:** the import checks are stricter than the saving code. Sessions from normal use
  pass every check (I walked through each one: end reasons, breaks, time away, Start over, the
  late "Welcome back" save). Known ways to fail: a device clock change during the session (C3:
  `distractionOutside`, `breakOutside`), a damaged preference (C12: `unknownMode`), and sessions
  saved by older versions of the app if a rule changed since (the special case for the focus
  rounding of 19 October 2026 shows this has happened once). Export does not test its own output.
- **Proposed fix:** two parts.
  1. Export tests itself: run every exported session through `cleanImportedSession()`; sessions
     that fail are still written to the file, and the status line says how many would not import
     and why, so the user (and the owner, during testing) finds out at export time, not at
     restore time.
  2. Import repairs what can be worked out again instead of rejecting it: `elapsedMs`,
     `distractedMs` and `focusPercent` are derived from the times and the distractions, so
     recompute them (`sessionFocus()`) and accept the session; keep rejecting only what cannot be
     true (end before start, unknown mode, a break outside the session, ...).
- **Alternatives:** part 1 only (no change to what import accepts).
- **Risk of the fix:** part 2 changes the meaning of "a hand-edited session can't contradict
  itself" to "it is corrected"; `endedBy` must still agree with the recomputed times.
- **How to confirm:** produce a session with a clock change (C3 recipe, with one distraction
  logged before setting the clock back and End tapped after), export, clear the history, import:
  "Skipped 1 invalid session".

#### C17: The backup is not a full backup: custom characters and their names are lost

- **Severity:** medium. **Area:** D. **Size:** S for the name, M for the characters.
- **What is lost today (brief):**
  - The custom characters themselves (`ct_custom_characters_v1`: name, look, personality) are not
    in the export file. After a restore on a new device they do not exist.
  - Every session stores the custom character's name (`characterName`) so old sessions keep a
    name, and Export writes it to the file, but Import throws it away:
    `cleanImportedSession()` returns only the fields it knows, and `characterName` is not among
    them. After a restore, those sessions show the internal id (`custom-ab12...`) instead of the
    name (`characterName()` in `history.js` falls back to the id), with the default look.
  - The preferences (`ct_prefs_v1`: chosen character, mode, minutes, sound, theme, language,
    dismissed tips) are not in the file either; that is a smaller loss.
- **Proposed fix:**
  - **Now (S):** Import keeps `characterName` when the `characterId` is a custom id
    (`isCustomId`) and the name is a non-empty text within the name length limit; an invalid name
    is dropped, the session still imports. The field is already in exported files, so files from
    every version can carry it. It is shown with `textContent` everywhere today; keep it that way.
  - **Later (M):** add the custom characters to the export file (a new version with a
    `characters` list checked by `cleanCustomCharacter()`), and merge on import by id: a
    character that already exists is kept, a name clash gets a number added rather than being
    dropped, and the limit of 10 needs a rule.
- **Risk of the fix:** the name is user-written text from a file: length-check it and never put
  it into HTML.
- **How to confirm:** make a custom character, finish a 1-minute session with it, export, clear
  the site's data, import: the session is listed as `custom-...`.

### Area F: other things found on the way

#### C18: The history is assumed to be sorted, but saving does not sort it

- **Severity:** low. **Area:** F. **Size:** S.
- **Where:** `history-store.js` `saveFinishedSession()` puts the new session first
  (`unshift`) and cuts the end of the list; `history.js` `renderSessionList()` shows the first 30.
- **Root cause / effect:** after a clock change backwards, or a "Welcome back" save of an old
  session, the list is no longer in start-time order until the next import sorts it; the "last
  30" list and the cut at the limit then pick the wrong sessions.
- **Proposed fix:** sort by `startedAt`, newest first, before cutting and writing.
- **How to confirm:** read the two functions.

#### C19: The History page does not notice midnight while it stays open

- **Severity:** low. **Area:** F. **Size:** S.
- **Where:** `history.js` `historySource()` includes today's date, but it is only compared when
  the page is shown again or the history changes (`refreshInBackground`).
- **Effect:** a page left open and visible over midnight keeps yesterday's "current streak" and
  "this week" until something else triggers a redraw.
- **Proposed fix:** a timer that redraws once just after the next local midnight (set again after
  each redraw).

### Notes for December: what makes syncing two devices hard today

Not bugs today; things in the data model to settle before accounts and sync.

1. **A session's identity is its start time** (`startedAt`, in milliseconds). There is no id and
   no device id. "Same start time" means "same session" in `saveFinishedSession`,
   `mergeIntoHistory` and `deleteFromHistory`. Give each session a random id; keep `startedAt`
   as the fallback for old data.
2. **A delete leaves no trace.** A session deleted on one device would come back from the other
   at the next sync (today: from an older backup file). Sync needs a small "deleted" marker per
   session id.
3. **No version or "last changed" stamp** on an entry or on the stored history. Saved sessions
   never change after saving, which makes sync simple (the union of both sides, minus deletes);
   keep it that way.
4. **The 1000-session cut** (C8) is applied per device, so two devices would cut different
   sessions and keep sending them back to each other. Remove the cut or move the history to a
   bigger store (IndexedDB, the browser's built-in database).
5. **The day a session counts on** depends on the timezone of the device that shows it (C13).
   Two devices in different timezones would show different streaks; the stored UTC offset of the
   full fix solves it.
6. **Derived numbers are stored and must match** (`elapsedMs`, `distractedMs`, `focusPercent`).
   Any change of a formula makes old data "contradict itself" (C16). For sync, treat the times
   and distractions as the truth and work the rest out.
7. **Custom characters:** ids are random per device (no clash), but names must be unique and
   `loadCustomCharacters()` silently keeps only the first of two characters with the same name,
   so two devices that each made a "Coach" would lose one after a merge. The limit of 10 is per
   device too.
8. **The running session** (`ct_session_v1`) and the Web Lock are per browser. Do not sync a
   running session; decide what happens when a session runs on two devices at the same time.
9. **Preferences:** decide which are per device (theme, language, screen and sound settings,
   dismissed tips) and which belong to the account (chosen character, mode, minutes).
10. **iPhone:** Safari and the Home Screen app already are "two devices" with separate storage;
    Export and Import are the only bridge today (the tip says so).

---

---

## 3. Decisions for the owner

1. **Which day does a session count on? (C13)** Recommendation: the day it started, by the
   device's clock at that moment, stored with the session (the full fix), before launch, so every
   session saved from launch day on carries it.
2. **Session ran out while you were away (C1):** ask the time away question before saving?
   Recommendation: yes. It is the same card as during a session, and "No" keeps today's result.
3. **Start with an unfinished older session (C2):** Recommendation: a small question at Start
   ("Continue it / End it and start the new one").
4. **The 1000-session limit (C8, C14):** Recommendation: raise it to 5000 now and ask before an
   import removes anything; replace the limit in December together with sync.
5. **How strict should import be? (C16)** Recommendation: recompute the derived numbers instead
   of rejecting a session for them, keep rejecting impossible data, and let Export test its own
   file.
6. **Limit for distractions per session (C15):** Recommendation: max(100, 5 per second of session
   time) on import, and ignore key auto-repeat on the distraction buttons in the app.
7. **Custom characters in the backup (C17):** Recommendation: keep the per-session name on
   import now (small); add the characters themselves to the file in December with sync, unless
   there is time before launch.
8. **Failed save at the end (C7):** Recommendation: "Try again" and "Download this session" on
   the summary before launch; automatic retry later.
9. **Device clock changes (C3):** Recommendation: nothing before launch; handle a backward change
   in December if it shows up in real use.
10. **F8 design (C5):** Recommendation: design A (the tab's id travels in the notification).
11. **Unreadable saved data (C9 to C12):** Recommendation: one "careful loading" PR before
    launch if time allows; it must be in place before sync starts writing this data.

## 4. Fix PR plan

For the model that fixes these: one PR per line, each from the latest `main`, in a fresh
session. Follow `CLAUDE.md`: show the plan and wait for "go", update the README when behaviour
changes, add every new text to all nine language files in `public/js/i18n/`, update
`public/privacy.html` when new data is stored, and update `PRECACHE` / `CACHE_VERSION` in
`public/sw.js` if a start-up file is added. Confirm each finding with its recipe first.

**Before launch**

1. **Day rule (C13, plus C19).** Files: `history-store.js` (helper, export version 8, import of
   the optional offset), `history.js` (every calculation and the list use the helper), `app.js`
   (`startSession` stores the offset; `saveFinishedSession` copies it), `privacy.html`, README.
   Edge cases: sessions without the field, a session over midnight, Sunday night to Monday,
   daylight saving days, a running session started before the update. Android test: a session
   from 23:58 to 00:03; then change the phone's timezone by several hours and reopen History:
   list, streak and both charts must not move.
2. **Import must not remove sessions unasked; higher limit; sorted save (C14, C8, C18).** Files:
   `history-store.js`, `history.js`, `history.html` (dialog), language files, README. Edge cases:
   the history changes in another tab while the dialog is open; storage full during the write;
   Cancel changes nothing. Android test: import a file from another device into a filled history
   and use the Back button on the dialog.
3. **Import limits and repair, export self-test, keep the character name (C15, C16, C17 part
   1).** Files: `history-store.js`, `history.js`, `app.js` (key auto-repeat on the distraction
   buttons), language files, README. Edge cases: version 1 to 7 files still import; a one-minute
   session with 150 distractions imports; a file from the future is refused with a clear reason.
   Android test: export on the phone, import the same file again ("nothing new"), then clear the
   site's data and import: every session and every custom character name is back.
4. **Ask about the time away when the session ended meanwhile (C1).** Files: `app.js`, language
   files only if a new text is needed, README. Edge cases: the "Welcome back" path, a session
   ended during a takeover from another tab, Advanced and Simple mode, a level 5 time away (no
   continue/restart question after the end), the end chime when the user is watching. Android
   test: start 2 minutes, lock the phone for 4 minutes, unlock.
5. **Notification opens the right tab, F8 (C5).** Files: `app.js`, `sw.js`. Edge cases: no active
   service worker yet, the tab was discarded and reloaded, the session was taken over by another
   tab, tab plus installed app. Android test: both recipes of C5, in Chrome and in the installed
   app.
6. **Rescue a session whose save failed (C7).** Files: `app.js`, `index.html`, language files,
   README. Edge cases: Start over's "first part", storage allowed again before "Try again".
   Android test: block site data in Chrome's site settings during a session, let it end, allow
   again, tap "Try again".
7. **Question at Start when an older session is unfinished (C2, plus C6).** Files: `app.js`,
   `index.html`, language files, README. Edge cases: the older session is paused, has run out
   (under and over 30 minutes ago), another tab still runs it, Quick start. Android test: start a
   session in Chrome, close the tab from the tab switcher, open the site again from a second tab
   that was already open.
8. **Careful loading (C9, C10, C11, C12).** Files: `history-store.js`, `history.js`, `app.js`,
   `custom-characters.js`, README, `privacy.html` if a rescue key is added. Edge cases: storage
   blocked (never write), nothing saved yet, broken text, one broken entry among good ones.
   Android test: none needed beyond a normal session; test the broken cases on desktop from the
   console.
9. **Small one (C4):** `app.js` only. Android test: keep-screen-on still works after switching
   apps quickly several times.

**December**

10. Custom characters in the backup file (C17 part 2), designed together with sync.
11. Replace the history limit and `localStorage` for the history (C8), session ids and delete
    markers (notes 1 to 4 above).
12. Device clock change during a session (C3), if still wanted.
13. Automatic retry of a failed save (C7 part 3).

## 5. Checked and fine

Nobody needs to re-check these (code reading, commit `b0020a5`):

- **Sleep, screen lock, background throttling:** the timer is worked out from the clock on every
  tick, never counted, so no time is lost while the page is frozen. On return the end is detected
  at once (`noteReturn` → `tick`).
- **Daylight saving start/end, timezone change, midnight:** no effect on the running timer
  (`Date.now()` is world time). Week and day boundaries on the History page use calendar days
  (`addDays`), so daylight saving days are right there too. Only C13 remains.
- **Breaks (Pause / Resume):** time in a break is never counted; a break absorbs a clock change;
  a paused session never runs out, survives reload, a closed tab and a takeover by another tab;
  ending during a break ends the session where the break started; the end reason and the numbers
  of a session with breaks pass the import checks.
- **Stop dialog with the running timer (#60):** the session can run out behind the dialog; all
  dialogs close and nothing is saved twice. `ask()` resets the dialog's answer every time.
- **Reload and closed tab:** every change of the running session is saved at once
  (`ct_session_v1`); start-up resumes it or shows the right screen; the time away card covers the
  time the tab was closed (while the session is still running).
- **Two tabs with Web Locks:** only the lock holder runs timers and saves; "Continue here" stops
  the other tab before it can save again; open dialogs in the losing tab do nothing afterwards.
  A session cannot be saved twice (`saveFinishedSession` returns "exists" for the same start).
- **Tab plus installed app on Android:** same storage and same lock, so it behaves like two tabs.
- **Preferences from several files:** `app.js`, `theme.js` and `i18n.js` each write only their own
  fields on top of what is saved now, so they do not undo each other (theme, language).
- **Storage blocked:** every read and write of `localStorage` in the audited files is wrapped;
  the app runs, says so on the setup screen, the session screen and the History page.
- **Delete on the History page:** reads the saved history again before writing, so a session
  saved in another tab meanwhile is kept.
- **Custom character saves:** the editor and Delete read the saved list again right before
  writing.
- **Import file handling:** size checked before reading (5 MB); broken JSON, a wrong file type
  and a newer version give clear messages; a broken session is skipped, the rest imports;
  duplicates inside one file are skipped; imported text never reaches HTML (all `textContent`,
  chart text is escaped); field names from the file cannot reach built-in object properties
  (`Object.hasOwn` on the end reasons).
- **Version handling:** versions 1 to 7 import with the rules of their version; a newer version
  is refused as a whole. Entries without `pauses` (before version 7) count as never paused
  everywhere.
- **iPhone Home Screen tip:** it already says that the Home Screen app has separate storage and
  to export first.
- **`sw-register.js`:** registers after load, never reloads the page, failures are ignored.
