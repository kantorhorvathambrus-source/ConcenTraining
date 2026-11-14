# Core audit report (November 2026)

Read-only audit of the timer, multi-tab, storage, history and export/import code.
Nothing was changed in the app. Nothing was run: every finding comes from reading the code,
so each one has a short recipe to confirm it before it is fixed.

- Audited commit: `b0020a5` (main = live = PR #67).
- Files read: `public/js/app.js`, `history-store.js`, `history.js`, `sw-register.js`, `theme.js`,
  `i18n.js`, the `notificationclick` part of `public/sw.js`, and the load/save part of
  `public/js/custom-characters.js`.
- Line numbers are from that commit and will drift: the function name is the reliable pointer.
- Status: **in progress**. Areas done so far: A, B. Sections 1, 3, 4 and 5 are filled in last.

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

_Areas C, E, D and F follow._

---

## 3. Decisions for the owner

_Filled in at the end of the audit._

## 4. Fix PR plan

_Filled in at the end of the audit._

## 5. Checked and fine

_Filled in at the end of the audit._
