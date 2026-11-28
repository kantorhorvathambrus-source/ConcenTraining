# ConcenTraining

A focus/study timer where a character reacts when you log a distraction.
Plain HTML, CSS and vanilla JS: no build step, no framework. The website is the
`public/` folder (open `public/index.html` in a browser to try it). The backend is two
Netlify Functions that store counts in Netlify Blobs, used only for character popularity stats.

The app speaks **English and Hungarian** (it follows the browser's language until one is picked
with the language button; see [Languages](#languages)).

**Live at https://concentraining.com** (the production site; the old Netlify address redirects
there, see [Domain, redirect and security headers](#domain-redirect-and-security-headers)).

## How it works

- **How it works card:** at the top of the setup screen (above step 1) a short card explains the
  app in 5 points: pick a character and a timer; when you notice your mind has wandered, tap how much
  (Simple) or how long (Advanced), the character reacts with a pose, never with words, and noticing
  and coming back is the skill being trained; to step away for a moment, tap **Stop**, then **Take a
  break** (the timer waits, and the break doesn't count against your focus); leaving the app during a
  session brings a "were you distracted?" question; the history is saved automatically on this device, and Export on the
  history page (linked) moves it to another phone. It's shown on the setup screen until **Got it** is tapped (saved as `howItWorksDismissed` in
  `ct_prefs_v1`), then never again by itself. Prefs saved before this existed don't have the key, so
  existing users also see it once. The **How it works** button in the header (next to "Your history
  →") brings it back any time without changing the pref: the card opens, scrolls into view and
  keyboard/screen reader focus moves to its heading. **Got it** moves focus to that header button.
  Shown automatically on page load, it doesn't move focus. If the iPhone Home Screen tip (see
  [iPhone storage](#iphone-storage-and-the-home-screen-app)) shows too, this card comes first: it's
  what a first visit needs, while the tip only appears once there's history and refers to Export,
  which this card introduces. Same look as the tip (`.tip-card`).
- **Quick start card:** for returning users, a small card right under the header (above How it
  works and the iPhone tip) starts a session in one tap, without scrolling down to **Start session**.
  It shows a small image of the character (initial pose, decorative), a grey "Quick start" label,
  one line like "Boss · Advanced · 25 min" (character · Simple/Advanced · minutes; with Plan picked,
  "Boss · Advanced · Plan: 2×30 · 60 · 30", see [Plans](#plans)), a small grey
  underlined **Change ↓** under that line and a **Start** button. **Change ↓** is for anyone who
  doesn't realise the setup can be changed further down: it scrolls to step 1 (`scrollToStep`, an
  instant jump with reduced motion) and changes nothing else. The card only shows when the saved
  character still exists and the history has at least one session, so a brand-new user (or someone
  who deleted all their history) never sees it. It always shows the current setup, i.e. exactly
  what **Start session** would start, and follows every change
  further down at once (character card, mode, chip, Custom field). The minutes are corrected the way
  Start corrects them: while "300" is typed in the Custom field the card says 240 min, an empty
  field says 25 min. **Start** runs the same code as **Start session** (`onStartClick(true)` in
  `public/js/app.js`): same checks, same one-tab-at-a-time rules, the same ragebait warning (only
  until it's accepted for that character, see **Ragebait warning** below), and a quick double tap
  starts one session. If the tap corrected the Custom
  field ("Max. 240 min." etc.), nothing starts and the page scrolls to step 3 so the message is
  visible (an instant jump with reduced motion); the next tap starts. It's checked again whenever
  the setup screen is shown (after a session, Discard, End without saving, a reload), when the page
  comes back from the browser's back/forward cache, and when another tab changes the history. No
  setting and nothing new saved: it only reads `ct_prefs_v1` and `ct_history_v1`. The image box has
  a fixed size (56 px wide, 200:240) with `object-fit: contain`, so nothing moves when the image
  loads and real artwork fits the same slot. At 320 × 568 the header and the whole card fit on the
  first screen.
- **Setup:** 1. pick a character, 2. a mode (Simple / Advanced), 3. a focus duration, or (while
  plans are on, see [Plans](#plans)) a plan of several blocks with planned breaks.
  The character decides the personality (see below). While custom characters are on
  (`CUSTOM_CHARACTERS_ENABLED`, now on in production, and always on on Netlify's test sites), the
  last card of step 1 is **Create your own**, and characters you made appear under the grid in
  **Your characters** (see
  [Custom characters](#custom-characters)). Tapping a card just selects it, ragebait characters
  too (their warning shows on Start, see below). Selecting a card only updates which card is
  pressed (`aria-pressed`), so keyboard and screen reader focus stays on it. Tapping Start session without a character shows "Pick a character first."
  under the step 1 heading and scrolls back to the top of step 1 (an instant jump instead of a smooth
  scroll with reduced motion); there is no default character, so picks are only counted on Start.
  Duration presets: 5, 10, 15, 25, 35, 45, 60 and 90 min (`DURATION_PRESETS`
  in `public/js/app.js`, default 25), plus a custom field. The 5 and 10 min presets make a session
  easy to start for beginners and on hard days. The presets always sit in 2 rows of 4, both on the
  setup screen and in step 2 of the continue/restart dialog, and each one is at least 44 px tall. A custom duration
  is corrected as soon as you leave the field: empty (or not a number) becomes 25 min, anything
  under 1 becomes 1, anything over 240 becomes 240, and decimals are rounded (`MIN_MINUTES`,
  `MAX_MINUTES` and `DEFAULT_MINUTES` in `public/js/app.js`). Whenever that changes what you typed, one
  short line appears right under the Custom field: "Max. 240 min.", "Min. 1 min.", "Set to 25 min." or
  "Rounded to 13 min.". The limits are checked on what you typed, before rounding: anything under 1
  (0.5 too) says "Min. 1 min.", anything over 240 (240.4 too) says "Max. 240 min.", and "Rounded to …"
  is only for decimals inside that range. It's a status line, so screen readers read it once. It
  takes no space until it appears, and it goes away as soon as the value is valid again (you type a
  valid number or tap a preset), and when a session starts. If the tap on **Start session** (or **Start new session** in the
  continue/restart dialog) is what corrected the field (you typed 300 and tapped the button without leaving the field
  first), that tap doesn't start anything: the message shows, and the next tap starts with the
  corrected value. So a session never starts with a length you didn't see.
  Under step 3 there are two checkboxes, both on by default: **Play a sound when time's up** (with a
  small **Test sound** button that plays the chime once, and a hint under it: "Uses your media volume.
  On iPhone, silent mode can mute it.") and **Keep the screen on during the session**.
  See "Sound and screen" below. A third one, **Remind me if I leave the app**, is off by default and
  only shown where it can work (on iPhone and iPad only in the Home Screen app, never in a Safari
  tab); see [Leave reminder](#leave-reminder). A fourth one, **Ask how it felt at the end**, on by
  default, turns the summary's optional mood question on or off (see [Inner weather](#inner-weather)).
  Below them, **Focus sound**: **Noise** (one choice: Off · Brown · Pink · White · Green) and
  **Ambient** (a mixer of toggle tiles: Rain · Birds · Wind · Waves · Crickets · Fan · Vacuum, any number
  on).
  While at least one is on: a volume row per layer, **Volume** (the master) and **Preview**. See
  [Focus sound](#focus-sound).
- **Ragebait warning:** a ragebait character (built-in or custom) shows "Heads up!" with its
  warning on **Start session** or Quick start's **Start**, not when its card is tapped, so creating
  a ragebait character or tapping its card never asks. It shows after every check that can stop the
  start (no character, a corrected Custom field), so nobody accepts and then gets an error.
  **Bring it on** remembers the acceptance for that character (`ragebaitAccepted` in `ct_prefs_v1`,
  a list of character ids; ids of deleted characters stay and do nothing) and starts as usual; its
  tap also allows the end chime. **Pick someone else** (or Esc) starts nothing, scrolls to step 1
  and focuses its heading; the selection stays. Once accepted, later Starts with that character
  don't ask. **Start over** and a plan's next block never ask: they continue a start. A custom
  character whose personality is changed in the editor (see [Custom characters](#custom-characters))
  is taken off the list, so a character changed to ragebait asks on its next Start. Prefs saved
  before the warning moved here (no `ragebaitAccepted` yet) count the character chosen then as
  accepted if it's ragebait, because the old warning showed when it was picked
  (`migrateRagebaitAccepted`, once at start-up).
- **Tap targets:** everything you can tap is at least 44 × 44 px (buttons, chips, the Custom field,
  **Start** on the Quick start card,
  the header's **How it works** and **Your history →**, **Test sound**, the × on the Motivate me card,
  **← Back to the timer**, **Edit** / **Done** and **Delete** in the history list, and each checkbox
  together with its text). Where the text is smaller, the
  tappable area around it is bigger than what you see. The only exceptions are links inside a
  sentence ("Export on the history page →", "Go to Export →", "Start one →"), which stay the height
  of their line so the paragraph keeps its normal line spacing.
- **Screen readers (TalkBack, VoiceOver):** a screen reader user gets what a sighted user sees from
  the characters, with nothing new on screen and no setting for it. Sighted users see and hear no
  difference.
  - **Reactions:** when a distraction reaction starts (a distraction button, or **Yes** on the time
    away card), one short description of the pose is read out, like alt text: the character's name
    and a few words, e.g. "Professor, a disappointed sigh, eyes closed." It's never the character
    speaking (no quotes, never addressed to you), so "poses only, never text" still holds. There's one
    description per personality and pose (`POSE_DESCRIPTIONS` and `describePose()` in
    `public/js/data/characters.js`), matching the pose tables in [Personalities](#personalities). It's
    read through a visually hidden live region in the session screen (`#announcer` in `index.html`,
    `announce()` in `public/js/app.js`): polite, so it waits until the screen reader is done talking and
    never cuts in. The same text is read again on the next tap, and the region empties itself after
    5 s (`ANNOUNCE_CLEAR_MS`), so swiping through the page later doesn't find old text.
  - **Not read out:** the "doing well" pose, blinks, the refocus pose, the Undo countdown and the
    category picker's safety close. They happen without your action and would break your focus.
  - **Category picker:** when it appears (1.4 s after the tap), "What distracted you? Choose below,
    or skip." is read out, after the reaction's line (both are polite, so neither cuts off the other).
    Focus stays where it is. Not read again after **Keep going** if it was already open. After a
    category or **Skip**, focus goes back to the distraction button you tapped (or to the "Got
    distracted?" heading if that button is disabled now, in Advanced mode), so it isn't lost.
  - **Undo:** "Distraction undone." is read out.
  - **Break:** "Paused" is read out when a break starts and "Resumed" when it ends. Focus moves to
    **Resume** after **Take a break**, and to the "Got distracted?" heading after **Resume**.
  - **Images:** the session and summary images have the same descriptions as their alt
    ("Grandma, calm and smiling."), following the pose, so you can check the character any time by
    moving to it. Blinks don't change the alt.
  - **Screens:** when a session starts (Start session, Start on the Quick start card, Start new session, Continue here, or a reload), focus
    moves to the session info line ("Grandma · Relaxed · Simple · 25 min"); when it ends (Stop →
    End session, timer ran out, Save in "Welcome back"), focus moves to the summary title. Whenever "This session is open in another tab." shows
    (Start or Quick start while another tab runs the session, opening the app then, another tab's
    **Continue here**, or the setup screen switching by itself), focus moves to that heading
    (`showElsewhere()` in `public/js/app.js`), so it's read out once. Focus moves
    without scrolling, and these get no focus outline, so nothing changes on screen.
  - **Quick start:** the card's **Start** button is named by its text plus the setup line
    (`aria-labelledby`), e.g. "Start Boss · Advanced · 25 min", so it can't be confused with
    **Start session**, and it still starts with the visible word "Start" for voice control.
    **Change ↓** is named "Change setup" (`aria-label`), so the arrow isn't read out and "tap Change"
    still works in voice control. It moves focus to the step 1 heading ("1. Choose your character")
    without a second scroll and without a focus outline, so a screen reader carries on reading there.
  - **Dialogs:** every dialog is labelled by its title (and described by its question), so a screen
    reader reads it when focus moves into it, e.g. "You were away for 2 min 10 sec. Were you distracted?"
- **Simple mode:** 5 severity buttons (Barely, A little, Quite a bit, A lot, Completely), not
  time-based. They answer the prompt "Got distracted? How much?", so they're plain words that
  clearly increase (Hungarian: Alig, Kicsit, Eléggé, Nagyon, Teljesen). Only the level (1–5) is
  saved, never the label, so renaming them changed no saved data. They always sit in two full rows: three in the first, two wider ones in the second.
- **Advanced mode:** 7 duration buttons (30 sec … 10+ min). Ends with the % of the session spent focusing.
  "10+ min" counts as 10 minutes in that %. A length that can't have happened yet is disabled (greyed
  out but readable): one longer than the free time, which is the time so far minus the distraction time
  already logged in this session ("10+ min" counts as 10 min here too). E.g. with 5 min logged at
  minute 6, only "30 sec" and "1 min" work, and "5 min" works again from minute 10. "30 sec" is never
  disabled, so the row isn't all grey at the start. Checked every half second and after every
  distraction or Undo. In a 5 min session "5 min", "10 min" and "10+ min" stay disabled the whole
  time, and in a 10 min session "10 min" and "10+ min" do, so the continue/restart question can't
  come up there in Advanced mode.
- **Undo:** after any distraction button (both modes), **Motivate me** turns into **Undo** for 5 s
  (`UNDO_WINDOW_MS` in `public/js/app.js`): same place, same size, so nothing on the screen moves,
  and **Stop** stays next to it the whole time. The button counts down the seconds in its
  label ("Undo · 5" … "Undo · 1"), then Motivate me comes back. The countdown is on the button, not
  a bar, so it isn't mistaken for a time limit on the category picker right above it (the picker
  has none). Screen readers hear just "Undo" (the number is hidden from them). If Undo has keyboard
  focus when it goes away, focus moves to Motivate me in the same spot (and from Motivate me to Undo
  when Undo appears). Undo takes back
  only the latest distraction: it's removed from the session, the reaction (or the refocus step after
  it) stops and the character goes back to its normal pose, the category picker closes, the "doing well" timer is set back to what it
  was before the tap, and the session is saved. A new tap inside the 5 s moves Undo to the new
  distraction and starts the 5 s again. After a reload there's no Undo.
- **Tap guard:** a tap that comes less than 0.4 s after the previous accepted tap is ignored everywhere in the app (`TAP_GUARD_MS` in `public/js/app.js`), so an accidental double tap never logs twice or presses what appears under the finger; keyboard and screen reader activation, Undo, text fields and checkbox labels are never blocked. On the distraction buttons a held-down key's auto-repeat is ignored (only the first press logs), and a session never holds more distractions than max(100, 5 per second of session time) (`distractionLimit` in `public/js/history-store.js`, the import's limit): a tap beyond it is ignored.
- **Distraction categories:** after each distraction button, once the reaction has played (1.4 s,
  `PICKER_DELAY_MS`), a small picker appears above the bottom buttons: "What distracted you?" with
  Screen, Thoughts, Noise, People, Tired, Other, and a grey **Skip** button on the right. There's no
  countdown: it stays open until a category or Skip is tapped. A tapped category is saved with the
  distraction; Skip saves `category: null` (a category is never guessed). As a safety net, if
  nothing is tapped (e.g. the phone was put down), it closes silently after 60 s
  (`PICKER_AUTO_CLOSE_MS`), also with `null`, so it doesn't stay up for the rest of the session
  (both constants are at the top of `public/js/app.js`). Tapping another distraction button replaces
  the picker (the earlier distraction keeps `null`); **Undo**, ending the session and the timer running
  out close it. Tapping **Stop** only holds it (also during the 5 s Undo window, or before
  the picker has appeared: then it appears after **Keep going**, with the full 60 s): it waits behind the question with its 60 s
  stopped, so its safety close can't open the continue/restart question on top of it. After **Keep
  going** it's back with the time it had left, or closes then if its 60 s would have run out meanwhile.
  **Take a break** closes it as Skip (`category: null`). On small phones the open picker covers some of the distraction buttons (never the
  character or the timer); tap a category or Skip first, or scroll down, to log another one.
- **"Completely" / "10+ min"** asks: continue this session, or start over with a new duration.
  The question comes in two steps of one dialog, so the duration chips can't be read as "how long
  was the distraction?" (the app never asks that):
  - **Step 1** asks only continue or start over. Simple mode (which has no times): "That was a big
    distraction" / "Keep going with this session, or start fresh? After a big distraction, starting
    over is often easier." Advanced mode: "That was a long distraction" / "Keep going with this
    session, or start fresh? After a long distraction, starting over is often easier." Buttons: **Continue this
    session** (gets the focus) and **Start over**. Esc or Android Back means Continue.
  - **Step 2** (only after **Start over**): "How long should the new session be?", the duration chips
    and Custom field (the current session length preselected), the "Save the first …" checkbox (see
    below), **Start new session** and **Back**. **Back**, Esc and Android Back go back to step 1 (if the
    browser doesn't let the app stop Esc/Back, which Chrome allows only once per tap, the dialog
    closes and that counts as Continue). A length picked in step 2 stays there if you go Back and
    tap Start over again; the correction line under the Custom field doesn't.
  - Screen readers: the dialog is labelled by the visible step's title (step 1 also by its text).
    Step 2's title gets the focus, so it's read out; Back puts the focus on **Start over**.
  - Every time the dialog opens (also after a reload, or when another tab takes the session over)
    it starts at step 1 with fresh chips and the checkbox ticked.
  The category picker, the Undo window and the time away card come first: the dialog opens once the
  picker has closed (category picked, Skip, or the 60 s safety close), the 5 s Undo window is over and
  the time away card (see below) has been answered, so they never show at the same time. Undoing the tap means no question
  (an earlier "10+ min" / "Completely" that wasn't undone still asks, right after the Undo). The
  question is saved with the running session (`restartPending`) as soon as the button is tapped, so if
  the page is reloaded before it's answered, it's asked right after the reload.
  If the session has run at least 1 minute, step 2 also has a checkbox above **Start new session**:
  "Save the first 12 min 30 sec to your history" (the time so far, measured when the dialog first opens,
  so time spent in the dialog isn't added), ticked by default. With it ticked, **Start new session**
  saves the abandoned part to the history first, as ending
  at that moment, with `endedBy: "startOver"`. Its focus % and stats are calculated the normal way
  (including the long distraction that triggered the question), and it counts for the streak and all
  history stats like any other session. Unticked, the abandoned part is thrown away. **Continue**
  (also after going Back from step 2) ignores the checkbox. Under 1 minute there's no checkbox and nothing is saved, as before.
  If the box was ticked but the browser refused to store the part (storage full or site data
  blocked), the new session starts as usual and a red line under the session info says "Couldn't save
  the first part to your history: your browser didn't allow it." (`role="status"`, so a screen reader
  reads it once). After 10 s (`SAVE_ERROR_NOTE_MS` in `public/js/app.js`) it turns invisible but
  keeps its space, so nothing on the screen moves while a distraction button may be tapped; the next
  session removes it completely. If the browser doesn't let the site save anything at all, the new
  session's own note ("This session won't be saved…", see
  [When the browser won't save](#when-the-browser-wont-save)) shows in that spot instead: only one
  line fits, and it covers the lost first part too.
- **Stop** (the right button of the bottom bar, where End session used to be: same place, style and
  size) asks "Stop for now?". Because the dialog covers the timer, a line right under the title shows
  that the clock keeps running: a small static amber dot (`--color-accent-text`), muted "Timer still running · "
  and the remaining time in bold ("Timer still running · 16:41"), the same value and format as the
  timer, updated every second with the same tick (tabular numbers, so it doesn't wobble). Screen
  readers read it once as the dialog's description when it opens; it isn't a live region, so the
  ticking time isn't announced. It's not shown during a break. Under it is a full-width
  **Take a break** button with a muted,
  centred line under it, "The timer waits for you.", then a thin divider. Below the divider, because
  they belong to ending, not to the break: the save checkbox and **Keep going** / **End session**
  (End session stays the primary button). One button covers both on purpose: anyone who wants to stop
  finds the break, without a pause button tempting you on the timer screen all the time. Keyboard focus
  lands on **Take a break** when the dialog opens. During a break the button reads **End session**
  and opens the old "End this session now?" dialog, without Take a break, the note and the divider
  (pausing is no longer an option then). If the session has run at least 1 minute (session time,
  measured when the dialog opens; breaks don't count), the dialog also has a checkbox: "Save this
  session to your history", ticked every time the dialog opens (it isn't remembered). Unticked means "this session doesn't
  count": **End session** ends it, saves nothing (and doesn't request persistent storage), and goes
  straight back to the setup screen with no summary, like **Discard** in the "Welcome back" dialog.
  The setup keeps the last character, mode and length. Under 1 minute there's no checkbox (nothing is
  saved anyway, and the summary is shown as before). If the timer runs out while the dialog is open,
  the session is saved as a full session. In a plan the dialog ends blocks instead: **End this
  block** and **End plan** (see [Plans](#plans)).
  Tapped during the 5 s Undo window, it closes Undo first: the distraction stays logged and Undo
  doesn't come back after **Keep going**. A waiting continue/restart question doesn't open on top of
  the dialog; after Keep going it opens once the category picker has closed, as usual.
- **Take a break:** a chosen pause is not a distraction. The app trains noticing that you drifted
  away and coming back; a break is a decision, so it's kept separate, never judged, and always shown
  honestly in the summary and the history.
  - The clock stops at the tap, so the planned end moves later by the length of every break. A
    break is never session time: it doesn't count in the elapsed time, the focus %, the result, the
    stats or the 1-minute rule.
  - **Paused screen:** the timer digits are dimmed (50%, `--timer-paused-opacity` in `style.css`) and the
    progress bar fill turns a neutral that reads as "stopped" (`--color-paused`, with
    its own value in dark mode: visible on the track, but quieter than the dimmed digits). The
    distraction block is replaced by centred text, with no box around it: **Paused** and, under it,
    "Break · 2:14", counting up from the start of the break (m:ss, h:mm:ss from 1 hour, no upper
    limit). The prompt and buttons keep their space but are invisible, and the text sits in the
    middle of that space, so nothing on the screen moves (also on landscape phones and wide screens). The motivation card and
    the category picker are hidden. **Resume** (primary) takes Motivate me's cell, like Undo, and the
    right button reads **End session**. The tab title is "Paused · ConcenTraining". The change is
    instant, with no animation.
  - **Character:** its normal pose. Blinks and breathing go on, but no reactions, no "doing well"
    pose and no taunts (ragebait included). **Resume** shows the refocus pose for 2.5 s, as after a
    distraction; the next "doing well" pose comes 5 minutes after Resume.
  - **Nothing is measured:** leaving the page during a break saves no leave time and brings no time
    away card and no leave reminder (one that's showing is closed when the break starts). The screen
    may turn off: the screen lock is released and the "Your screen may turn off" note turns invisible
    (keeping its space); **Resume** takes the lock back.
  - **What waits:** a category picker that was open when Stop was tapped closes as Skip on **Take a
    break** (the Undo window is already over). A waiting continue/restart question or time away card
    is asked after **Resume**, not during the break.
  - **End session** during a break ends the session where the break started (`endedAt` is the start
    of the break), and that last break isn't recorded: it came after the session.
  - The break is saved with the running session (`pausedAt` and `pauses` in `ct_session_v1`), so a
    reload, reopening the app or **Continue here** in another tab brings the session back paused,
    with the counter running from the start of the break, however long it has been. There's no time
    limit and no question: the paused screen already offers **Resume** and **End session**. The timer
    never runs out during a break.
  - **Summary and history:** a session with breaks shows one factual line: "Paused once · 2 min 14
    sec" on the summary (its usual time format) and "Paused 3 times · 6 min" in the history list
    (whole minutes, at least 1). Nothing is shown when there were no breaks. Same in both modes.
- **Time away:** if the page is hidden during a running session (another app, another tab, or a
  locked screen; the browser can't tell these apart, so the wording stays neutral) and you come back
  after at least 15 s (`AWAY_MIN_MS` in `public/js/history-store.js`), a card at the bottom of the
  screen asks "You were away for 2 min 15 sec. Were you distracted?" (measured to the second). Under
  15 s nothing happens. Nothing is ever logged without a tap. With **Remind me if I leave the app**
  on, a system notification also comes as soon as you leave; it doesn't change anything here (see
  [Leave reminder](#leave-reminder)). During a break nothing is measured (see **Take a break** above).
  - While the card is open, the character holds its `level1` pose (no blinking, no "doing well"
    pose) and shows no text.
  - **No, it was for the task** (or Esc) closes it and logs nothing.
  - **Yes** logs the time away at once, with no buttons to pick:
    - `at` is the moment you left (measured, like everything else here).
    - Advanced mode: `ms` is the measured time away in whole seconds (the X on the card), so it can
      be any length, e.g. 2 min 15 sec or 14 min. Simple mode: `ms` stays `0`, as always.
    - The level, and so the reaction, comes from the time away, with the lengths of the Advanced
      buttons as thresholds (`awayLevel` in `public/js/history-store.js`):

      | Time away | Level | Like the button |
      |---|---|---|
      | under 1 min | 1 | 30 sec |
      | 1 min to under 2 min | 2 | 1 min |
      | 2 min to under 5 min | 3 | 2 min, 3 min |
      | 5 min to 10 min (exactly 10:00 included) | 4 | 5 min, 10 min |
      | over 10 min | 5, plus the continue/restart question | 10+ min |

    - The category is set to `"phone"` (shown as "Screen": the phone, other apps or other tabs,
      online or offline), with no category picker.
    - It's marked `source: "away"`, so it can be told apart from a tapped one (those have no
      `source` field).
    - Everything else works like a tap: reaction, refocus pose, Undo for 5 s, and for level 5 the
      continue/restart question once the Undo window is over. If only part of the time was a
      distraction, Undo it and log that part with the buttons.
    - In Advanced mode it counts as logged time for the disabled lengths, like any distraction.
  - The timer check comes first: if the session ran out while you were away, the end comes first, and
    the card asks about the time away before the session is saved, with its own title (see **Timer ran
    out while you were away** below). If it runs out while the card is open (you're back and watching),
    the card closes and nothing is logged.
  - If Stop's question or the continue/restart question was open when you left, it stays and
    comes first; the card follows after **Keep going** / **Continue** (and is dropped after **End
    session** or **Start new session**). An open category picker stays as it was (it still belongs to the
    earlier distraction). An open Undo window is closed on return (its 5 s are long over).
  - Leaving again while the card is open: if the new absence is 15 s or more, the time away now runs
    from the first leave to this return (including the few seconds the card was on screen in
    between), and the card shows the new total. A shorter absence changes nothing.
  - The time you left is saved with the running session (`leftAt` in `ct_session_v1`) and cleared on
    return, so the card still comes after a reload, e.g. when Android discarded the tab in the
    background. If the card was open or waiting when you left, `leftAt` keeps the first leave, so the
    card still covers the whole time. A reload while the card is on screen (without leaving again)
    drops it. `leftAt` itself never goes into the history or the export file.
- **Reactions:** each button maps to one of the 5 distraction poses. The character also blinks,
  "breathes", and shows the "doing well" pose after every 5 minutes without a logged distraction.
  It plays for 3 s (`GOOD_REACTION_MS` in `public/js/app.js`) and isn't started when less than that
  is left of the session, so it never lands on the end (e.g. at 5:00 of a 5 min session) or gets
  cut off by it.
- **Two-step reaction:** after every distraction reaction (all levels, all personalities) the character
  shows the `refocus` pose ("OK, back to work") for 2.5 s (`REFOCUS_MS` in `public/js/app.js`), then
  goes back to its normal pose. So admitting a distraction always ends with a push back to work, not
  with the scolding or the mockery. The "doing well" pose has no refocus step. During refocus the
  character still counts as reacting (no blinking, the "doing well" pose waits) and makes one gentle
  nod, never a shake (with "reduce motion" on, just the pose). A new distraction tap during refocus
  starts its reaction straight away; Undo and the end of the session stop both steps. The category
  picker's timing doesn't change.

| Button (Simple) | Button (Advanced) | Pose |
|---|---|---|
| Barely | 30 sec | level1 |
| A little | 1 min | level2 |
| Quite a bit | 2 min, 3 min | level3 |
| A lot | 5 min, 10 min | level4 |
| Completely | 10+ min | level5 |

- **Motivation button:** always visible. Messages rotate in phases (see `js/data/messages.js`).
  The messages are research-based: every "Brain fact" has a `// source:` comment in
  `js/data/messages.js`, and the full references are listed in its header. Tone rule: informational,
  no pressure, no guilt, no emoji. Every "Boost" is doable in about 10 seconds, in your head or with
  one movement, no writing (the only exception is "Leave a note for next time…" in the final stretch).
  Sessions of 35+ min: 0–10 min general → 10–20 min "hardest part" → 20 min–85% middle → 85–100% final stretch.
  Shorter sessions: general messages without the "first 20 minutes" facts → final stretch.
  E.g. the final stretch starts at 4:15 in a 5 min session and at 8:30 in a 10 min session.
  On short screens, tapping it scrolls the message up so it sits just above the bottom button bar.
- **Small screens:** the session header is short ("Boss · Strict · Advanced · 25 min") and wraps
  into two even lines if it has to. On screens up to 740 px tall, the session image shrinks
  (120–260 px tall) so every distraction button fits above the bottom bar without scrolling; the
  summary image and taller phones keep the normal size. Advanced labels like "10+ min" stay on one line.
- **Summary screen:** the character's pose, the title and the message follow how the session went
  (see "Summary result" below). A plan gets one summary for all its blocks (see
  [The plan's summary](#the-plans-summary)). It also shows the session's top 3 picked categories, e.g.
  "Most common distractions: Screen (2), Thoughts (1)". Hidden if nothing was picked.
  Times are shown with seconds when there are any ("24 min 30 sec out of 25 min"). They're session
  time: breaks aren't included. A session with breaks adds one line, "Paused once · 2 min 14 sec" or
  "Paused 3 times · 6 min" (see **Take a break**).
  In Advanced mode, a session ended before the timer ran out also shows its planned length:
  "You focused for 28 min out of 30 min (60 min planned), with 2 distractions logged."
  Simple mode shows the character's sentence (see "Summary result" below) and, under it, a factual
  line: "Your session ran 24 min 30 sec (25 min planned), with 3 distractions logged." Simple mode has
  no distraction lengths, so this is the session's length (distractions included), never "focused"
  time; "(… planned)" follows the same rule as in Advanced mode. A session under 1 minute only shows
  the title and the "not saved" note (no focus %, sentence, factual line, breaks or categories).
  Under the details, a saved session gets the optional question "What was the weather like inside?"
  with a row of six weather icons from easy to hard (see [Inner weather](#inner-weather)); it changes
  nothing else on the summary.
- **Couldn't save:** if the browser refused to store a finished session (storage full or site data
  blocked; usually the setup and session screens already said so, see
  [When the browser won't save](#when-the-browser-wont-save)), the summary adds one red line under the details: "Couldn't save this session to your
  history: your browser didn't allow it. Full storage or blocked site data can cause this."
  (`role="status"`, read once by a screen reader; the title still gets focus). Everything else on the
  summary stays the same. It's never shown for a session under 1 minute (not saved on purpose), for a
  session that was already in the history (same start time, e.g. finished again after a reload), or
  when "Save this session to your history" was unticked (no summary then). Every summary starts
  without it, so an old error never shows after a later successful save.
  `saveFinishedSession` in `public/js/history-store.js` returns `"saved"`, `"exists"`, `"short"` or
  `"failed"`; persistent storage is only requested after `"saved"` or `"exists"`, as before.

### Summary result

Every finished session gets a result. The thresholds are constants at the top of
`public/js/history-store.js`, so other features can reuse them.

- **Advanced mode** uses the focus %: **great** from 85% (`SUMMARY_GREAT_FOCUS`), **okay** from 60%
  (`SUMMARY_OKAY_FOCUS`), **rough** below that. The focus % is only 100% when no distraction time was
  logged at all (99.6% shows as 99%).
- **Simple mode** has no focus % (it's saved as `null`), so it uses distraction points: each logged
  distraction scores its level (Barely = 1, A little = 2, Quite a bit = 3, A lot = 4,
  Completely = 5). The points are counted per 25 minutes of session time; sessions shorter than
  25 minutes count as 25 minutes. **great** up to 2 points per 25 min (`SIMPLE_GREAT_POINTS`),
  **rough** from 8 (`SIMPLE_ROUGH_POINTS`), **okay** in between. Example: two "A lot" in a 25-minute
  session = 8 points = rough. Short sessions are judged like a 25-minute one on purpose, so they
  aren't harsher: one "Quite a bit" in a 5-minute session = 3 points = okay (one "A little" = great).
- **early:** the session ran less than half of its planned time (`EARLY_END_RATIO` = 0.5), whatever
  the focus % or distraction points. Ending early isn't judged as good or bad: the title is
  "Ended early", the pose is neutral, and Simple mode shows a short neutral message. Advanced mode
  still shows the focus % and the sentence (they were measured). A session that ran the full time is
  never "early". Only the times count, so a part saved with **Start over** would be "early" too,
  though Start over doesn't show a summary.
- **short:** a session under 1 minute. It isn't saved to the history, and the summary says so. This
  is checked first: under 1 minute is always "short", never "early". Example, 5-minute session:
  under 1:00 is short, 1:00–2:29 is early, from 2:30 it gets great / okay / rough. 10-minute
  session: early from 1:00 to 4:59.

The result is only used on the summary screen. It isn't saved, and the history page and stats
don't use it. A plan's summary applies the same rules to the totals of its blocks (`resultOf`, see
[The plan's summary](#the-plans-summary)).

| Result | Kind | Firm | Strict | Ragebait | Title |
|---|---|---|---|---|---|
| great | `good` (proud) | `good` (approving) | `good` (satisfied) | `good` (grudging) | Great session! |
| okay | `level2` (pleased) | `level1` (eyebrow raised) | `initial` (neutral) | `level1` (side-eye) | Good effort! |
| rough | `level4` (gently encouraging) | `level3` (serious) | `level2` (disappointed) | `level4` (mocking) | Tough session |
| early | `initial` (calm) | `level1` (eyebrow raised) | `level1` (stern, no frown) | `level1` (side-eye) | Ended early |
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
  - **The time away at the end:** the app knows when you left (`leftAt`), so if you left 15 s or more
    (`AWAY_MIN_MS`) before the end, the time away card asks about that part before the session is
    saved: "You were away for the last 24 min of the session. Were you distracted?" The length is the
    session time from leaving to the end, in whole seconds (a break that started after leaving isn't
    counted). Without it the app would save time nobody measured as fully focused.
    - Back within 30 minutes: the card shows over the session screen at its end (0:00, full bar, the
      character holding its `level1` pose), also when the app was closed and is opened again.
      After "Welcome back": only once **Save** is tapped, right over the setup screen. **Discard** asks
      nothing.
    - **Yes** adds the usual time away distraction (`at`: when you left, level by length as in the
      table above, `ms` only in Advanced mode, `"phone"`, `source: "away"`), then saves the session
      and shows the summary. There's no reaction, no Undo and no continue/restart question, also at
      level 5: the session is already over.
    - **No, it was for the task** (or Esc) saves it exactly as before.
    - Nothing is saved until the card is answered: a reload or a closed page asks again next time
      (through "Welcome back" if that's more than 30 minutes after the end). If another tab takes the
      session over meanwhile ("Continue here"), the card is asked there instead.
    - Watching the timer end, or leaving less than 15 s before it, changes nothing: no card, and the
      end chime is never delayed (when the timer runs out in a background tab, the chime still plays
      at the end and the card waits for you).
  - Both cases work the same in Simple and Advanced mode. A continue/restart question that was
    still waiting is dropped, as before, and so is a time away card from earlier in the session (the
    card at the end covers that time too, from the first leave).
  - Neither case plays the end chime on your return (see below).

### Sound and screen

- **End chime:** when the timer runs out on its own, a short, soft chime plays: three rising notes,
  about 1 second, generated with the Web Audio API (the browser's built-in sound generator, so there's
  no audio file). On Android the phone also vibrates briefly (iOS ignores vibration). The chime and
  the vibration only happen when the end is seen as it happens: within 5 s of the end time
  (`END_SOUND_VISIBLE_MS`), or within 75 s if the tab is in the background (`END_SOUND_HIDDEN_MS`),
  because browsers run background timers late. Never on **End session**, **Start over**, a page
  reopened or reloaded after the end, a phone unlocked after the end, or the "Welcome back" question.
  The notes, volume and vibration pattern are constants at the top of `public/js/app.js`.
  In a plan the same chime also marks the end of a planned break, under the same rule (see
  [Plans](#plans)).
- **Why there's a tap first:** browsers only allow sound after a tap. The sound is unlocked by the
  **Start session** tap, and every tap or key press during a session unlocks it again if the browser
  has paused it (after a reload, a phone call, or another app taking over the audio). The chime itself
  also tries to resume paused audio; if that doesn't work within a moment, it's skipped rather than
  played late.
- **iPhone silent mode:** silent mode (the Ring/Silent switch, the Action button or Control Center)
  mutes the chime. This is how iPhones treat web page sounds, and the app doesn't try to get around it.
  The setup hint under **Test sound** says so. Safari's `navigator.audioSession.type = "playback"`
  (Safari 16.4+, tells iOS what kind of sound the page makes) would let the chime play in silent
  mode, but it was left out on purpose: `"playback"` is an exclusive type, so when the page plays a
  sound iOS pauses other audio (music, podcasts) and doesn't resume it. The silent sample played on
  the Start tap would stop the user's music, and switching only for the chime would stop it at the
  end. The mixing types (`"ambient"`, `"transient"`) don't reliably play in silent mode, and none of
  it helps when the screen is locked.
- **Background tab on a computer:** browsers slow down timers in hidden tabs, so the chime can come
  late: in Chrome and Edge up to about 1 minute (once the tab has been hidden for 5+ minutes), in
  Firefox and Safari usually about 1 second. While the computer is asleep nothing runs; waking it
  after the end counts as coming back later, so there's no chime.
- **Keep the screen on:** while a session is on screen, the app asks the browser to keep the screen
  on (the Screen Wake Lock API), so the phone doesn't lock and pause the page. A locked phone pauses
  the page, so without this the chime would rarely play on a phone. The lock is released when the
  session ends, during a break (Resume takes it back), and on the setup and summary screens. During a
  plan's planned break it's kept (so the break's end sound can play) and released once the break is
  over: the next block waits for a tap. The browser drops it whenever the
  page is hidden (another tab or app), so it's asked for again when the page is visible. After a reload
  the browser may refuse it until the first tap, so taps during a session ask again. Browsers without
  support (or a refused request, e.g. in battery saver mode) just carry on without it. Needs HTTPS,
  so it doesn't work when `index.html` is opened as a local file.
- **"Your screen may turn off" note:** while a session is on screen with **Play a sound when time's
  up** on, but the screen isn't being kept on (the setting is off, the browser doesn't support Screen
  Wake Lock, the request was refused, or the browser released the lock and getting it again failed),
  a small muted line under the session info says: "Your screen may turn off. If it does, you won't
  hear the sound." It's in the page flow, so it never covers the character, the timer or the buttons.
  It disappears as soon as the lock is held (e.g. after the first tap following a reload). It's never
  shown with the sound off, or on the setup and summary screens. While a lock request is out, or the
  page is hidden, it stays as it is, so it doesn't blink on every tap or return (`updateScreenNote()`
  in `public/js/app.js`). During a break it doesn't apply: it turns invisible but keeps its space, so
  nothing moves when the break starts or ends.

### Focus sound

A mix of background sounds that plays during focus time to cover distracting noises, set up in the
setup screen's **Focus sound** row, like Noisli: at most one noise plus any number of Ambient sounds,
each with its own volume. Everything is generated in the browser with the Web Audio API, like the
chime: no audio file, nothing downloaded, no libraries, no Netlify bandwidth. The code:
`public/js/focus-sound.js` (the noises, the mixer, the reverb and the player),
`public/js/focus-sound-worklet.js` (the Ambient sounds and the limiter) and the "focus sound" part of
`public/js/app.js` (the setup screen, and when the mix plays).

**Setup screen**

- **Noise** (one choice): Off · Brown · Pink · White · Green.
- **Ambient** (a mixer): Rain · Birds · Wind · Waves · Crickets · Fan · Vacuum, as toggle tiles: a tap turns
  a sound on or off, and any number can be on at once, also together with a noise. Under them: "You
  can mix these: turn on several and set each one's volume." Under both groups: "Steady background
  sound that covers distracting noises. Tap Preview to listen."
- All chips and tiles are exactly the same size: both groups are the same grid, as wide as each
  other, so their columns line up; a column is at least 7em (the longest single word of any language,
  Italian "Aspirapolvere", is 6.3em, so no word is ever split), and every tile has room for two lines.
  Larger text gives fewer columns. Checked in all 9 languages at 320 px, 390 px and desktop, at normal
  and 200% text.
- While at least one layer is on: a **volume row per layer** (its name, its value, a slider; the noise
  first, then the Ambient sounds in tile order; the slider's accessible name is "Rain volume" and so
  on), then **Volume** (the master volume of the whole mix) and **Preview**. With nothing on, none of
  these show. Changing one layer never changes another.
- A layer turned on for the first time starts at 70% (`FOCUS_LAYER_DEFAULT`). Turned off, an Ambient
  sound keeps its volume for next time. Changing the noise keeps the noise row's volume.
- **Preview** (the button then reads **Stop**) plays the whole mix until Stop, **Start session**,
  leaving the setup screen, or turning everything off. No time limit, and it keeps playing when the
  page is in the background. While it plays, every change (a tile, the noise, any slider) is heard at
  once.

**The mixer** (`createFocusSoundPlayer` in `focus-sound.js`)

- Every layer has its own gain. Ambient layers have a second, "wet" output that goes to one shared
  reverb: a ConvolverNode with a short room (about 0.5 s, early reflections then a tail whose highs die
  faster) generated in code once (`makeRoomImpulse`). A single drop or bird can be more or less
  distant this way: far ones are quieter, duller and wetter. Noises have no reverb; Fan and Vacuum
  only a touch.
- Everything meets in the master gain (the Volume slider), then a **limiter** (`focus-limiter` in the
  worklet: it looks 3 ms ahead and turns the volume down just enough so the output never goes over
  about −3 dBFS; below that it changes nothing), then the fade gain, then the speakers. The end chime
  has its own path and never goes through the limiter.
- A layer's loudness is `FOCUS_LEVELS[sound] × (layer %)² × (master %)²`: squared, the way ears hear
  loudness. The master is 55% by default (`FOCUS_VOLUME_DEFAULT`), so a new user's first layer at 70%
  sounds as loud as the earlier single sound at its old default of 40% (0.55² × 0.7² ≈ 0.40²).
- Fades: the whole mix fades in over 2 s when focus starts or resumes and out over 1 s when it stops;
  a layer turned on or off, or a noise changed, fades over 0.3 s while the others play on undisturbed;
  a volume change follows within 0.08 s. Never a click.
- Nothing runs while silent: a layer that's turned off, and the whole mix once it's faded out (muted,
  paused, ended), is stopped and disconnected, the worklet processors included.
- If the worklet module can't be loaded (an old browser, a failed download), the noise still plays
  (straight to the master, without the limiter: one noise alone can't clip) and Ambient layers stay
  silent, without errors. Browsers without AudioWorklet (Safari before 14.1) don't show the Ambient
  group; saved Ambient layers are kept but not played there. AudioWorklet also needs HTTPS (or
  localhost).

**The sounds**

- **Noises (looped buffers):** Brown (the deepest), Pink (softer), White (the brightest), Green (the
  middle frequencies around 500 Hz, like a forest). Steady, so about 8 s of the picked one is
  generated in stereo and looped, with its end crossfaded into its start. Only the picked noise's
  buffer is kept (about 3 MB).
- **Ambient (generated live in the worklet):** events such as drops, chirps and birdsong would
  audibly repeat in any loop short enough to keep in memory, so they're rolled from random numbers
  while they play, sample by sample, on the browser's audio thread. Nothing ever repeats, nothing is
  kept in memory, and no timers are involved (which browsers pause in the background).
  - **Rain:** drops over a steady hiss shaped like rain (about 1–8 kHz, which never swells); no
    wind-like bed and no tones. Each drop is a tiny noise burst rung through its own band-pass filter
    (random centre and Q: a hard surface rings, a soft one taps), with its own attack, decay and
    place, at three distances: far (quiet, duller, wetter), mid, and a few near ones (louder,
    brighter, drier). Its strength drifts only ±10% over about a minute: no gusts.
  - **Birds:** 3 birds at different sides and distances (one far away), nothing else. Each has its own
    song (a phrase of a few syllables: fast pitch sweeps between about 2 and 7 kHz, whistles with a
    little vibrato, trills), sung with small changes in pitch and timing, with pauses of 3–12 s. Far
    birds are quieter, duller and wetter; a soft cap keeps every syllable in the background.
  - **Wind:** pink noise through a slowly moving band-pass with a low Q (so it never whistles), gusts
    of 5–15 s, and a faint rustle of leaves at the gusts' peaks.
  - **Waves:** two kinds of wave played together, each with its own independent timing: a smooth
    swell, and waves with a shape (a short build, a fast break with bright foam, a fading wash, a soft
    steady surf in between). Mostly both play; when only one plays, it's mostly the break and wash,
    rarely only the swell; never neither.
  - **Crickets:** 3–5 crickets at different distances and sides, each with its own pitch (about
    4–5 kHz), chirp (2–5 short pulses) and pace, slightly irregular; far ones quieter and duller.
  - **Fan** (airy noise with a soft 100 Hz hum), **Vacuum** (air noise and a 140 Hz motor tone with
    harmonics and a slight wobble).
- **Planned as recordings:** Fire, Thunder, Train, Airplane and Stream. Three rounds of generated
  versions (with listening tests on a phone) didn't sound real enough, so they'll come back as short
  recorded loops in a separate change. Saved settings for them from the test versions are simply
  dropped (`cleanFocusMix` ignores unknown sounds).
- **Loudness:** every layer at the same % sounds about equally loud (`FOCUS_LEVELS`, measured with
  A-weighting, which follows how ears hear, over 1–3 minutes of each, reverb included). Rain, Wind, Fan
  and Vacuum are matched on their average like the noises; Waves on their crests (2 dB above the
  noises); Birds on their phrases (2 dB under the noises) and Crickets 4 dB under, so they stay in the
  background.
- **How they were checked:** rendered offline through the real player (OfflineAudioContext in
  headless Chromium) and measured: spectrum per octave and narrow tonal peaks (Rain has none above the
  measuring noise), peaks, A-weighted loudness, event rates, and the autocorrelation of the loudness
  over 10 minutes (no repeating pattern). With every layer and the master at 100% the limiter holds
  the peaks at −3 dBFS; at the default settings it never acts. All 7 Ambient sounds plus a noise take
  about 7% of the audio thread's time budget in the worklet, about 8% with the reverb, on the test
  machine. To keep that low the worklet uses a sine table instead of `Math.sin`, a cheap rational soft
  limit instead of `Math.tanh`, and works out slow envelopes every 16 samples.

**When it plays** (`updateFocusSound` in `app.js`)

- Only while a focus block is running on the session screen: a single session and every block of a
  plan. It fades out on **Take a break**, a planned break, the end of a session or block (the chime
  plays over the fade), giving up, the summary, the "Welcome back" question, and when another tab
  takes the session over (**Continue here** there: the mix moves to that tab).
- **Taps first:** browsers only allow sound after a tap, and nothing ever plays on page load. These
  taps allow it: **Start session** and Quick start's **Start** (and **Bring it on** in the ragebait
  warning), **Resume**, **Start now** / "Start: 30 min" in a plan, **Continue here**, **Preview** and
  the mute button. After a reload during focus the mix waits: the mute button shows its "Turn sound
  on" state, and only that button, **Resume** or **Start now** starts it (other taps, like a
  distraction button, don't).
- **Mute button:** a small speaker button at the end of the session info line, there for the whole
  session (breaks too, so nothing moves) while at least one layer is on. It mutes and unmutes the
  whole mix ("Mute sound" / "Turn sound on"), for this session or plan only (in memory): the saved
  choice stays, and the next **Start session** begins unmuted.
- **Phone locked or app in the background:** Chrome on Android keeps Web Audio playing with the
  screen off or another app in front, so the mix carries on (the Ambient sounds too: they run on the
  audio thread). iPhone and iPad Safari suspend it while the screen is locked; when the page is
  visible again during focus the app resumes it, and if the browser wants a tap first, the next tap on
  the session screen brings it back. No tricks (no silent `<audio>` element, no media controls).
  iPhone silent mode mutes it, like the chime.
- **Browsers without Web Audio:** the **Focus sound** row and the mute button aren't shown.

**Saved** in `ct_prefs_v1` (see [Browser storage keys](#browser-storage-keys)), nothing sent anywhere:
`focusNoise` (`"off"` or a noise), `focusNoiseVolume`, `focusMix` (`{ rain: { on: true, volume: 40 } }`:
a sound is in it once it has been on, and keeps its volume when turned off) and `focusVolume` (the
master). Unknown sounds and bad values are dropped when the app starts. `focusSound` (the single
choice of an early test version, only ever on Deploy Previews) is deleted.

**Adding an Ambient sound** (for example Café):

1. In `focus-sound-worklet.js`: a class with `next(out)` that writes dry left, dry right, wet left and
   wet right into `out[0..3]` (the helpers there: `Pink`, `Brown`, `Biquad`, `OnePole`, `Drift`,
   `fastSin`, `softClip`, `Bursts` for drops and clicks), and an entry in `SOUNDS`.
2. In `focus-sound.js`: the id in `FOCUS_AMBIENTS` (its place there is its place on screen) and a
   level in `FOCUS_LEVELS` (render a minute of it offline and match its A-weighted loudness to the
   noises).
3. The name: `setup.focusSound<Id>` (for example `setup.focusSoundCafe`) in all 9 language files,
   then `node tools/export-texts.mjs`.
4. Nothing else: the tile and its volume row are built from the list, and `PRECACHE` doesn't change.
   Update this section and `about.html`.

### Leave reminder

An optional system notification that brings you back when you leave the app during a session.

- **Setting:** the setup checkbox **Remind me if I leave the app**, under **Keep the screen on during
  the session**. Off by default. Saved as `leaveReminder` in `ct_prefs_v1`; prefs saved before it
  existed get `false`.
- **Permission:** ticking the box asks the browser for permission to show notifications, in that
  same tap (browsers only show the prompt after a tap). Allowed: the box stays ticked. Blocked (now,
  or earlier for this site): the box unticks itself and a hint shows under it: "Notifications are
  blocked for this site. You can allow them in your browser's site settings." The hint only shows
  after such a tap, never on its own. Prompt closed without an answer: the box just unticks. If the
  permission is taken back later in the browser's settings, the box shows unticked on the next visit
  (and `leaveReminder` is saved as `false`); the app never asks again without a tap.
- **Where it's shown:** only where notifications can work: the Notification API and a service worker
  (see [Offline use](#offline-use)). Elsewhere the row is hidden, e.g. `index.html` opened as a local
  file.
  - **iPhone and iPad:** only in the Home Screen app (`inHomeScreenApp()` in
    `public/js/history-store.js`: `navigator.standalone` or `display-mode: standalone`), never in a
    Safari tab, where iOS has no web notifications (iOS turns the Notification API and
    `showNotification` on only for Home Screen apps, from iOS 16.4). **Untested on a real iPhone or
    iPad.** It's one switch: `LEAVE_REMINDER_ON_IOS` in `public/js/app.js`; `false` hides the row on
    iPhone and iPad again.
- **When:** as soon as the page is hidden during a running session (another app, another tab, the
  home screen, a locked screen; the browser can't tell these apart): one notification. There's no
  delay: even if you're back after 2 s, it was shown and the return closes it.
  - Title: "Your session is still running". Text: "Is this part of what you're focusing on? Tap to go
    back." Icon: `icons/icon-192.png`. Sound and vibration: the phone's defaults for the site.
  - One per leave, and it has a tag (`ct-leave-reminder`): a new one replaces an old one, so there's
    never more than one. Every new leave shows it again. It's shown with `renotify: true`, so it
    still plays the phone's sound and vibration when it replaces an older one that's still in the
    notification shade (without it, a replacement is silent; Safari and Firefox ignore the option).
  - Not shown during a plan's planned break (there's no session then, see [Plans](#plans)).
  - Not shown if the session has 15 s or less left when you leave (`AWAY_ASK_AFTER_MS`; the end chime
    and summary come instead), if it ended meanwhile, or in a tab that doesn't run the session (see
    [Several tabs](#several-tabs-one-tab-at-a-time)). Not during the "Welcome back" question either.
  - Not shown when the page itself goes away: a reload, closing the tab, or going to another page
    (e.g. **Your history →**). The browser fires `pagehide` just before the page is hidden then, and
    the app checks for it. The session carries on as always and is picked up on the next open.
  - It's the app speaking, like the time away card; characters never use text.
- **Coming back** (by tapping the notification or any other way) closes it if it's still there.
  It also closes when the session ends while you're away, and when the app starts (e.g. after the
  browser discarded the page and the tap reloaded it). The time away card then works exactly as
  before (still only after 15 s or more away). The notification itself never logs anything.
- **Tapping it:** the service worker closes it and brings back the open app page (`notificationclick`
  in `public/sw.js`), or opens the app if no app page is open (or if bringing it back fails, as on
  some iOS versions). That picks the session up like a reload. The address comes from the service
  worker's scope, so it works at the domain root and under `/ConcenTraining/`. It's shown through the
  service worker (`registration.showNotification`), because `new Notification()` doesn't work on
  Android Chrome.
- **How reliable it is:** no timer, no push, no backend. It's shown inside the page's own "hidden"
  event, so it doesn't depend on timers in a background page (Android slows those down a lot, which
  made the earlier 15 s delay come late or not at all).
  - The service worker registration is fetched when the app starts, and again as soon as the service
    worker becomes active (on a first visit it isn't active yet when the app starts), so the
    notification can be shown at once, without waiting. iOS pauses a Home Screen app very soon after
    it's left.
  - Until the service worker is active (the first seconds of a first visit), there's no reminder.
  - If Chrome's own notifications are turned off in Android's settings, nothing shows even though the
    site is allowed.
- **Right after an update:** a page that is still controlled by an older service worker (without the
  tap handler) for the first few seconds after a new version is deployed still shows the reminder.
  Tapping it then doesn't open the app; coming back by hand closes it. The new service worker takes
  over on its own (see [Offline use](#offline-use)).

### Several tabs (one tab at a time)

The app can be open in several tabs at once, or in a tab and the installed app (on Android they
share their saved data; on iPhone the Home Screen app has its own, see
[iPhone storage and the Home Screen app](#iphone-storage-and-the-home-screen-app)). Only one tab runs
a session at a time, so two tabs never overwrite each other's distractions or both end the session.

- **How:** the Web Locks API (`navigator.locks`, a browser feature that gives a named lock to one
  tab at a time and frees it by itself when that tab is closed, reloaded or crashes). The tab holding
  the lock `ct_session` runs the session; it's held from **Start session** (or a resume) until the
  session is finished or discarded. A plan holds it from its first block to its summary, its breaks
  included (see [Plans](#plans)). The lock lives only in the browser's memory: nothing is saved
  under it, and no saved data or storage key changed.
- **The other tabs** show a calm notice instead of the session: "This session is open in another tab."
  with a **Continue here** button. They run no timers, reactions, sounds, wake lock or time away card,
  and save nothing. Focus moves to the notice's heading, so a screen reader reads it.
- **A tab on the setup screen switches to the notice by itself** as soon as another tab runs a
  session, so you don't have to tap Start to find out. Two things trigger it:
  - the `storage` event for `ct_session_v1` or `ct_plan_v1` (the browser sends it to the other tabs
    whenever saved data changes), if a running session (or a running plan, also in its break) is saved;
  - the tab being shown again (`visibilitychange`, or `pageshow` after the back/forward cache), because
    Android can freeze a background tab so it misses the event. Here it also asks the browser
    (`navigator.locks.query()`) whether another tab holds the lock: a saved session whose tab was
    closed doesn't switch, and Start resumes it, as before.

  It only switches from the plain setup screen: never from the summary, the "Welcome back" question,
  the ragebait warning or any other open dialog, and never while this tab is starting a session
  itself. It switches once: the saves that follow (each distraction, each leave) change nothing, so
  nothing flickers and focus moves only once. Without Web Locks nothing switches.
  Nothing on the setup screen is lost: the character, mode, typed Custom minutes and checkboxes stay
  as they were (this tab's own choices, not the other tab's), and when the notice goes again the
  scroll position and the focused element come back too (`setupView` in `public/js/app.js`, in memory
  only). Closing the other tab saves its session one last time, so the notice can come up just as
  that tab goes away; when this tab is shown again and no tab holds the lock, a notice that came by
  itself goes back to the setup screen.
- **Continue here** takes the lock from the other tab first, then reads the latest saved session, so
  everything logged in the other tab is there. From then on it works like a reload of that tab: the
  timer carries on, a waiting continue/restart question is asked, and a session whose time ran out
  long ago gets the "Welcome back" question. The other tab stops at once (open dialogs close without
  an answer) and shows the notice. If the session ended in the meantime, the setup screen shows.
- **Time away across the switch:** on purpose, switching tabs counts as being away from the session.
  The tab you leave is hidden, so it saves `leftAt` as usual; Continue here reads it. 15 s or more
  between leaving that tab and tapping Continue here asks the time away card, in the tab that now runs
  the session only (the tab that lost the lock never shows it). A shorter switch asks nothing.
- **Closing or reloading** the tab that runs the session frees the lock: a reload picks the session up
  directly, and another tab can take it with Continue here. No tab takes over by itself, so a tab in
  the background never suddenly starts the timer or the chime.
- **Session ended in the other tab:** a tab showing the notice goes back to the setup screen by itself
  (the `storage` event). If the notice had come by itself, the setup screen looks as it was left.
- **Start session while another tab runs a session:** there's only one saved running session, so it's
  never replaced. If its tab is still open, the notice shows. If its tab was closed, Start continues
  that session instead of starting a new one (like a reload would).
- **No Web Locks** (very old browsers, or `index.html` opened as a local file, because locks need
  HTTPS): every tab runs the session on its own, as before this existed.
- **Prefs and history in several tabs:** the setup screen, `history.html` and `stats.html` can be open
  in any number of tabs. Prefs are saved field by field (only what was just changed, on top of what's
  saved), so a choice made in one tab isn't undone by another tab saving its own. The history is read,
  changed and written in one go (saving a session, Import, Delete), and a session is only saved once
  (by its start time), so nothing is lost there. `history.html` draws itself again when another tab
  saves, deletes or imports sessions, and when it's shown again (see
  [Changes from other tabs](#changes-from-other-tabs)). Delete reads the saved history again and
  removes only that one session, never writing back the page's older copy.

## Plans

Many people study in blocks, e.g. 2×30 min, then 60 min, then 30 min, with a 10 min break after each
30 min block and 20 min after the 60 min block. A **plan** runs such a sequence by itself: block →
planned break → next block … → one summary for the whole plan. The single-block flow is unchanged.
The code is in `public/js/plans.js` (the switch, the rules, the plan builder and the timeline),
`public/js/duration-sheet.js` (the sheet for a row's length and break) and `public/js/app.js` (running
a plan, the "plans" section).

### The switch (`PLANS_ENABLED`)

The whole feature is behind one switch, `PLANS_ENABLED` at the top of `public/js/plans.js`. It is
now **`true`**: plans are on for everyone, on the production site (https://concentraining.com) and on
the GitHub Pages backup. They are also **always on**, whatever the switch says, on Netlify's test
sites (every Deploy Preview, `deploy-preview-…`, and the main branch deploy, `main--…`) and on
`localhost` / `127.0.0.1`. The code checks `PLANS_ON` (`PLANS_ENABLED` or one of those hostnames),
never the switch alone.

Setting the switch back to `false` turns plans off on production and the GitHub Pages backup (the
test sites and localhost keep them on). Then there's no "Single block | Plan" toggle and the app
works exactly as before plans existed: step 3 shows the duration picker, Quick start shows minutes
and Start starts one session. A plan saved in the prefs (`usePlan`, `plan`) is ignored but kept, so
switching plans on again brings it back. A leftover `ct_plan_v1` is ignored and cleared (a block
that's already running carries on as a normal single session). Nothing else needs to change either
way.

### Building a plan (setup, step 3)

- At the top of step 3, a pill-shaped toggle: **Single block** | **Plan** (the picked half is raised
  on the card colour; `aria-pressed` says which). It's saved as `usePlan` in `ct_prefs_v1`.
  **Single block** shows today's duration picker, unchanged.
- **Plan** shows one card per **row**; a row is a group of identical blocks:
  - first line: a round number badge, the block length (a pill button showing "30 min" that opens
    the [duration sheet](#the-duration-sheet): any whole minute from 1 to 240) and a stepper,
    **−** ×N **+**, N from 1 to 6.
    At 1 and 6 the button is marked unavailable (`aria-disabled`) but keeps keyboard focus. Screen
    readers hear the count as "2 blocks" (a live region) and the stepper as "Number of blocks in
    row 1".
  - second line: a cup icon, **After** and the break after each block of this row (a pill button
    showing "10 min break" or "No break" that opens the duration sheet: No break or any whole minute
    from 1 to 120), and the **×** that
    removes the row (hidden while there's only one row). On phones under 350px wide "After" is
    hidden visually (screen readers still hear "Break after row 1"), so the line fits.
  - The very last block of the plan never has a break after it. Last row ×1: its break line reads
    "Last block, no break after it" instead (the text wraps inside the line, so the × stays on it). Last row ×2 or more: the break button stays (it applies
    between its blocks) with "(none after the last one)" under it. Adding or removing rows updates
    which row is last.
- **Default break:** one third of the block, rounded to the nearest 5, at least 5 (30 → 10, 60 → 20,
  90 → 30, a custom 37 → 10; `defaultBreak`). Changing a row's length resets its break to that, unless that row's break
  was picked by hand (`breakPicked`).
- **+ Add block** (full width, dashed edge) adds a row copying the last row's length and break, ×1.
  At 6 rows it hides. Focus moves to the new row's length; after × it moves to the length of the row
  that took its place (or the one before).
- **The timeline** under it: one thin bar split into segments as wide as their minutes, small gaps,
  pill ends; focus blocks amber, breaks striped. Under it: "2 h 30 min focus · 3 h 10 min with breaks
  · ends around 17:13" (just "… focus · ends around …" without breaks; the end time is now + the
  total, in the language's time format, updated on every change and every minute while the setup
  screen shows). "ends around 17:13" is joined with no-break spaces in every language, so the time
  never wraps onto a line of its own.
- The first time Plan is picked: one row, 30 min ×2, 10 min break. The plan is saved as `plan` in
  `ct_prefs_v1` on every change and comes back next time. A broken saved plan falls back to that.
  Lengths and breaks are saved as plain whole minutes, presets or custom alike, so plans saved
  before custom values existed load unchanged. A whole number outside the limits (only possible in
  edited data) is moved to the nearest limit (`cleanPlanRows`).
- A pill button's screen reader name says the row and the value: "Length of row 1: 37 min",
  "Break after row 1: 7 min break" (`plan.pillLabel`).

### The duration sheet

A plan row's length and break buttons open a bottom sheet (`public/js/duration-sheet.js`) instead of
a native `<select>`, whose system list ignores the app's design on Android and only offers presets.

- **Look:** the language sheet's look (grab bar, rounded top corners, the app's theme tokens, 440px
  wide at most), with a title ("Focus length" / "Break length") and a **×** close button. It slides
  up when it opens; with "reduce motion" it just appears.
- **Presets** on top, as large chips that wrap into as many columns as fit (3 on a 320px phone, 2 at
  200% text): block length 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90, 120 min
  (`PLAN_BLOCK_MINUTES`); break No break, 5, 10, 15, 20, 25, 30, 40, 45, 60 min
  (`PLAN_BREAK_MINUTES`). The current one is filled amber. One tap picks a preset and closes the
  sheet.
- **Custom** under them: a visible "Custom" label, **−**, a number field (`inputmode="numeric"`, so
  phones show the number pad), "min", **+** and **Set**. −/+ change the value by 1 minute and
  repeat while held (after 0.4 s, then every 70 ms). They step on the press itself, so quick taps
  aren't dropped by the **Tap guard** (see [How it works](#how-it-works)). At the limit the button is
  marked unavailable (`aria-disabled`) but keeps focus. An empty field steps from the current value
  ("No break": + gives 1). **Set** (or Enter in the field) applies the value and closes the sheet.
- **Limits:** block length 1–240 min (`PLAN_MIN_MINUTES`, `PLAN_MAX_MINUTES`, the same as a single
  block), break No break or 1–120 min (`PLAN_MAX_BREAK`). Whole minutes only. "Choose between 1 and
  240 minutes." is always shown under the field. While the field is empty, not a whole number or out
  of range, that line turns red, the field is marked invalid (`aria-invalid`) and **Set** is
  disabled. What was typed is never changed or rounded.
- **The field's value when the sheet opens:** the current value ("37" for a custom 37 min, "30"
  for the 30 min preset), empty for "No break" (Set then waits for a number).
- **Closing** without a pick: a tap on the dimmed page, **×**, Esc or Android Back. Nothing changes.
  Back closes the sheet instead of leaving the app because it's a modal `<dialog>`, like the
  language sheet.
- **On-screen keyboard:** while the sheet is open it follows the visual viewport (the part of the
  page the keyboard leaves visible). It sits right above the keyboard, gets shorter and scrolls
  inside, so the Custom row and **Set** stay visible. Anything taller than the screen scrolls inside
  the sheet too.
- **Screen readers and keyboard:** the sheet is a dialog labelled by its title. Focus moves to the
  current preset when it opens (to the first one when the value is custom) and back to the pill
  button when it closes. The presets are a radio group with one Tab stop: the arrow keys, Home and
  End move between them, and Enter or Space picks one. (Arrows don't pick, because picking closes
  the sheet.) The field has its visible label, and the limits line is its description. −/+ are
  named "1 minute less" / "1 minute more", × "Close". Every tap target is at least 44px.
- **Quick start** with Plan picked: "Leader · Simple · Plan: 2×30 · 60 · 30", and **Start** starts
  the plan.
- Mode, character and the setup checkboxes apply to every block. The character pick is counted once
  per plan (`countCharacterPick`), not per block.
- A language switch rebuilds the rows in the new language and keeps the plan and the focused control.

### Running a plan

- **Each block is a normal session:** `ct_session_v1` with its usual fields, saved to the history on
  its own as always. Everything inside a block works as before: distractions, Undo, the category
  picker, motivation, Stop → Take a break, the time away card, the leave reminder, the level-5
  continue/start over question, the wake lock.
- **Session screen:** the info line reads "Grandma · Relaxed · Simple · Plan" (no minutes). The
  progress bar is replaced by the same timeline: finished blocks and breaks full, the current segment
  filling as time passes, upcoming segments empty (upcoming breaks keep a faint stripe). Under it:
  "Block 2/4 · 10 min break after", "Block 4/4 · last block", or just "Block 2/4" before "No break".
  Screen readers hear "Block 2 of 4, 30 min." when a block starts (focus goes to the info line, as
  always).
- **A block's timer runs out:** the chime and vibration as always (same rules), the block is saved,
  then the plan's summary (last block) or its planned break, which starts at once.
- **Planned break**, in the session's layout (nothing moves): "BREAK" above the timer (its line is
  kept for the whole plan), the timer counts the break down, the timeline's break segment fills, the
  tab title reads "09:41 · Break · ConcenTraining", and under the timeline "A sound plays when the
  break is over." (only with the end sound on). The distraction block is replaced by a card:
  "1/4 blocks done", "Next: block 2/4" and a chip "30 min focus". **Start now** and **Start: 120 min**
  always stay on one line, so the bar keeps its height when the break ends: when the text doesn't fit
  (narrow phones, longer languages), the button alone gets slightly smaller text and tighter side
  padding, in up to three steps (`fitStartButton` in `app.js`, `bar-fit-1` … `bar-fit-3` in
  `style.css`; at 320px every language fits by the second step). The character plays its "doing
  well" pose once, then stays in its normal pose (blinks and breathing go on). The bar: **Start now**
  (ends the break early and starts the next block; it gets the focus) and **Stop** ("End the plan
  now?" with Keep going / End plan → the plan's summary). Screen readers hear "Block 1 of 4 done.
  10 min break." No distractions, no time away card and no leave reminder during a planned break. The
  screen is kept on if "Keep the screen on" is ticked (so the end sound can play); the "Your screen
  may turn off" note works as during a session.
- **Break over:** the chime and vibration, only if it's seen as it happens (the same windows as the
  session's end, never when the app is opened or shown again later). The label reads "BREAK OVER",
  the timer shows the next block's full length dimmed, the card says "Break's over" / "When you're
  back, start the next block.", and the button reads **Start: 60 min**. The screen lock is released.
  **The next block never starts by itself**, however long it waits: only that tap starts it, so no
  focus is measured while you're not back. Screen readers hear "Break's over."
- **No break** between two blocks: the same screen at once, labelled "NEXT BLOCK", with "1/4 blocks
  done" / "Start the next block when you're ready." and **Start: 30 min** (no second sound).
- **Stop during a block:** the usual dialog. In a plan, **End session** reads **End this block** (saves
  it as always, then its break, or the summary after the last block), and a full-width **End plan**
  under Keep going / End this block ends this block the same way and goes straight to the plan's
  summary (not shown on the last block, where both would do the same). Take a break, Keep going and
  the save checkbox stay. During Take a break the bar's button reads **End this block** and the dialog
  "End this block now?".
- **Start over** (after "Completely" / "10+ min") restarts the current block: step 2 preselects its
  planned length, the length picked there replaces that block's length in the plan, and the rest of
  the plan is unchanged. A first part saved with "Save the first …" counts in the plan's summary,
  marked "started over".

### The plan's summary

One summary for the whole plan, on the summary screen:

- **Which blocks count:** the ones that went into the history (or were meant to and the browser
  refused: "Couldn't save every block to your history…" then shows). A block under 1 minute
  ("Under 1 minute, not saved"), one ended with "Save this session" unticked or discarded in "Welcome
  back" ("Not saved") is listed, but left out of every total. Nothing is estimated.
- **Result:** the session rules (`resultOf` in `public/js/history-store.js`) on the totals:
  Advanced uses the focus % over all counted blocks (summed distraction time / summed time), Simple the
  distraction points per 25 minutes of the summed time. **early** only by the times, like a session:
  the summed time of the counted blocks is under half (`EARLY_END_RATIO`) of the whole plan's planned
  focus time. End plan with blocks left doesn't make it early by itself ("3 of 4 blocks" shows that).
  **short** when no block counts but one was under 1 minute. If no block counts and none was short,
  there's nothing to sum up: back to the setup screen, as after an unticked single session.
- **Lines:** the title and pose as always; Advanced "92% focused" and "You focused for 1 h 52 min out
  of 2 h (2 h 30 min planned), with 6 distractions logged."; Simple the character's sentence and
  "Your blocks ran 2 h in total (2 h 30 min planned), with 6 distractions logged." (totals from an hour
  up in hours and whole minutes); "4 blocks" or "3 of 4 blocks"; one line per block that ran
  ("1. 30 min · 2 distractions", Advanced "1. 30 min · 92% focused · 2 distractions", "2. 12 min 30
  sec · 3 distractions · started over"); the breaks taken with Take a break, summed ("Paused twice ·
  4 min"); the top 3 categories.
- The history page, stats and export are unchanged: each block is already in the history as its own
  session (no new history fields, no new `EXPORT_VERSION`).
- **How it felt:** the optional question "What was the weather like inside?" shows once, under the plan's
  summary, when at least one block is in the history (`saved` or `exists`). One tap saves the mood for
  every such block, each its own session (see [Inner weather](#inner-weather)).

### Storage, reloads and tabs

- **`ct_plan_v1`** holds the running plan (see [Browser storage keys](#browser-storage-keys)) and is
  removed when its summary shows. Its blocks hold plain whole minutes (custom values too). A length
  or break outside the limits (1–240, 0–120; only possible in edited data) is moved to the nearest
  limit when it's read (`cleanStoredPlan`), and a running single block or session longer than 240
  min (or shorter than 1) is set to the limit once when it's picked up (`resumeSavedSession`), so
  it goes on instead of being dropped. `ct_session_v1` holds the running block as a normal session and got
  no new fields, so a session saved by an older version still resumes, and everything that reads it
  works unchanged. Between blocks no session is saved at all. A block belongs to the plan only if its
  `startedAt` is the plan's `blockStartedAt`; otherwise the saved session runs as a single block.
- **Write order** at the end of a block: the history, then the plan (now in its break), then the
  session is removed, so a reload at any moment comes back to the same place, and a block is never
  counted twice (blocks are keyed by their start time, like the history).
- **"Break over" isn't saved:** it's the break's start plus its length in the past. So a reload, an
  Android tab discard, reopening the app or **Continue here** comes back to the same place: mid-block
  (as always), mid-break (the countdown continues from the saved start), or break over (no sound then).
- **One tab at a time** covers the whole plan: the lock is held from the first block to the summary,
  breaks and "break over" included. Other tabs show "This session is open in another tab." (also during
  a break, through the `storage` event for `ct_plan_v1`), and **Continue here** takes the plan over.

### Edge cases

- **A block runs out while the page is hidden or the phone is locked:** back within 30 minutes, it's
  saved as always (the chime only if it's happening now) and the break started when the block ended,
  so you land on the break or on break over. Back later than `REOPEN_ASK_AFTER_MS`: the "Welcome back"
  question for that block, as always; Save or Discard, then the plan goes on (the break or break over).
  If the page was left 15 s or more before the block's end, the time away card at the end comes first
  (after Save in "Welcome back"), as for a single session: its answer belongs to that block only (its
  history entry and its line in the plan's summary), and the break still started when the block ended.
- **A plan left for a long time:** if a plan is in its break and that break ended more than 12 hours
  ago (`PLAN_STALE_MS`) when the app is opened again (start-up, reopening, a reload or Continue here),
  the plan is closed instead of showing "Break over": its summary shows (blocks that didn't run simply
  aren't there, as after End plan) and `ct_plan_v1` is removed. While the page stays open, "Break
  over" keeps waiting.
- **A block under 1 minute, or with "Save this session" unticked:** the plan goes on; the summary lists
  it as not saved and leaves it out of the totals.
- **The switch off with a plan saved in the prefs:** ignored; the single-block picker shows.
- **Language switch on the setup screen:** the rows are built again in the new language, the plan is
  kept.
- **Screen sizes:** on landscape phones (740×340, 568×320) and in the wide two-column layout the
  timeline, block line and break card fit without scrolling, like the session. In portrait on short
  screens the character gives up the two lines' height (down to 76px at 320×568), so the distraction
  buttons sit where they do without a plan. At 320px each row takes two lines and nothing scrolls
  sideways; where a language's break text is long (Spanish between 351 and 374px), the break button
  moves to the next line.
- **Light and dark, reduced motion, keyboard:** the timeline uses theme tokens only; its fills grow
  with a transform and don't animate with "reduce motion"; every control can be reached with Tab, has
  the app's focus ring, and every length and break button has a name that says its row and value.

## Personalities

There's no style to choose: each character's `group` in `public/js/data/characters.js` decides its
personality, in one place (`GROUPS` and `personalityOf()`). A new character only needs a `group`.

| Group | Personality | How it reacts |
|---|---|---|
| `relaxed` (Grandma, Leader, Santa, Study Buddy, Study Partner, Coach, Meditation Guide), label "Relaxed" | `kind` | Happy you're back, cheers you on. Hops. |
| `firm` (Professor, Librarian, Surgeon), label "Firm" | `firm` | Patient, but expects your best. Never shouts or gets angry: disappointment instead. One slow, calm lean (never shakes); a small nod when you do well. |
| `strict` (Boss, Soldier, Headmistress, Grandmaster, Judge, Sensei) | `strict` | Stern when you drift off, angrier each level. Shakes. |
| `ragebait` (Bodybuilder, Influencer, Your Phone) | `ragebait` | Annoying on purpose: mocking, more insulting each level. Cheeky head tilt. |

The app always shows the group's label ("Relaxed", "Firm", "Strict", "Ragebait"): on the
character cards, in the session info line and in the history list. The personality (`kind`, `firm`, ...)
is only what's saved. The history list finds the label from the saved `style` (`styleLabel()` in
`characters.js`), so an old entry shows the personality it actually ran with (a strict Grandma: "Strict").

The picker lists the characters in group order: relaxed, firm, strict, ragebait (the order of
`CHARACTERS` in `characters.js`).

Characters react only with poses and facial expressions, never with text. For screen readers each
pose also has a short neutral description (`POSE_DESCRIPTIONS` in `characters.js`, see "Screen
readers" above); when the art for a pose changes, check that its description still fits. The firm poses:

| Pose | Firm reaction |
|---|---|
| initial / blink | Calm, level brows, slight smile |
| level1 | One eyebrow raised |
| level2 | A long, level look: one eyebrow still raised, eyes narrowed |
| level3 | Serious: stern brows, flat mouth |
| level4 | Stern but calm: narrowed eyes, flat mouth (no angry brows) |
| level5 | A disappointed sigh: eyes closed, worried brows, small frown |
| good | A small approving smile, more restrained than kind (no sparkles or blush) |
| refocus | Calm and expectant: both brows slightly up, small smile, pointing down at the work |

A character can replace some of its personality's poses with its own (`poses` in its entry in
`ART_LOOKS`, `public/js/placeholder-art.js`). Influencer does this for level4.

Two more optional `ART_LOOKS` fields are for a character that isn't a person. `head` is drawn instead
of the skin-coloured neck and face oval, and the eyes, brows and mouth go on top of it. `hands` is the
colour of the hands that pose extras draw (pointing, clap, crossed arms, middle finger); by default
it's the skin colour. Your Phone uses both: it *is* a smartphone, with its face on the screen (a
cracked corner and two red notification dots, no numbers, since characters never show text), no
neck, and arms and hands in a shade lighter than its case, so all nine ragebait poses work the same
as for the others. The strict "red-faced" overlay only colours the default face oval.

Held items sit in the `hand` layer and are hidden in poses that need both hands (clap, crossed arms).
Judge holds a gavel there; strict poses only point with the other hand, so it shows in every pose.

The ragebait poses:

| Pose | Ragebait reaction |
|---|---|
| initial / blink | Bored half-closed eyes looking straight ahead, small smirk |
| level1 | Side-eye: white eyes under a low lid, pupils pushed to the side, one eyebrow up, wide smug grin |
| level2 | Eye-roll |
| level3 | Wink and tongue out |
| level4 | Laughing at you with a sarcastic slow clap (Your Phone claps with its case-coloured hands). Influencer instead just laughs, with his phone still filming you from his hand |
| level5 | Middle finger |
| good | Grudging: arms crossed, half-closed eyes looking away, flat "meh" mouth, a small shrug. Never proud |
| refocus | "Whatever, go on": bored half-closed eyes, one eyebrow up, flat "meh" mouth, a lazy point at the work. No insult |

The refocus pose ("OK, back to work"), shown for a moment after every distraction reaction. It's not
praise (that's `good`) and not a reaction to the distraction:

| Personality | Refocus pose |
|---|---|
| kind | Warm and encouraging: happy closed-arc eyes, soft brows, smile. No pointing hand |
| firm | Calm and expectant: both brows slightly up, small smile, pointing down at the work. Never angry |
| strict | Firm and neutral, "get on with it": narrowed eyes, level brows, flat mouth, pointing down at the work. No anger, vein or steam |
| ragebait | Bored "whatever, go on": half-closed eyes, one eyebrow up, "meh" mouth, pointing down at the work. No middle finger, no insult |

## Custom characters

Users can design their own characters: pick the look from parts, give it a name, and pick its
personality. It's the one exception to "the personality comes from the character's group": the
user picks it when creating the character, and from then on it belongs to that character. The look
and personality can be changed for 10 minutes after the first Save; after that only the name (see
[The 10-minute rule](#the-10-minute-rule)).

### The switch (`CUSTOM_CHARACTERS_ENABLED`)

The whole feature is behind one switch, `CUSTOM_CHARACTERS_ENABLED` at the top of
`public/js/custom-characters.js`. It is now **`true`**: custom characters are on in production.
Everything below describes the feature as it works while it's on.

**The plan:** this isn't final yet. The switch is meant to go back to `false` until the final
character art is ready, and part 2 (exporting and importing the characters themselves, see
**Export** below) is to be finished before custom characters are switched on for good.

**Where it's on:** the switch decides on the production site (https://concentraining.com), on the GitHub Pages backup, on `localhost` and under `netlify dev`. On
Netlify's test sites custom characters are **always on**, whatever the switch says, so they can be
tried on a phone: every Deploy Preview (the hostname starts with `deploy-preview-`, e.g.
`deploy-preview-54--concentraining.netlify.app`) and the main branch deploy (it starts with
`main--`: `main--concentraining.netlify.app`). The code checks `CUSTOM_CHARACTERS_ON`
(`CUSTOM_CHARACTERS_ENABLED` or one of those hostnames), never the switch alone.

While they're off:

- **Setup screen:** there's no **Create your own** card and no **Your characters** section, so the
  main grid has only the 19 built-in characters. `./?picked=custom-…` (the editor's way back
  after Save) does nothing.
- **A saved choice of a custom character** (`characterId` in `ct_prefs_v1`) counts as no choice,
  like a first visit: no card is selected, Quick start doesn't show, and **Start session** says
  "Pick a character first." The saved choice isn't changed, so switching the feature on again
  brings it back.
- **The editor** (`avatar.html`, also `avatar.html?id=custom-…`) goes straight back to the app.
- **`/stats.html`** leaves out the "Custom characters (always paid)" table. The backend is
  unchanged: `POST /api/picks` still accepts `"custom"`, and `/api/stats` still returns
  `customPicks`.
- **Saved data stays:** `ct_custom_characters_v1` is neither read for the picker nor deleted. The
  history still shows the names of sessions with custom characters (their current name, or the
  name the session stored).
- **A session that's already running** with a custom character (started while they were on)
  keeps running with that character after a reload.

To switch the feature off or on, set it to `false` or `true`. Nothing else needs to change: no
saved data, no backend, no service worker version (the file's name stays the same).

### On the setup screen

- **Create your own** is always the last card of the main character grid: a grey figure with a
  "?", the title, "Design your own character, with your own name." and, while `CUSTOM_PAID` is
  `false`, the badge **Free during launch**. Tapping it opens the editor (`avatar.html`).
- **Limit:** at most 10 characters (`CUSTOM_LIMIT` in `public/js/custom-characters.js`). With 10,
  the card says "You can have up to 10 characters. Delete one to make a new one." instead of the
  tagline, is marked `aria-disabled` and doesn't open the editor.
- **Your characters:** a second grid under the main one, only shown once at least one exists.
  Each card shows the character's calm pose, its name (always set as plain text, never as HTML),
  its personality badge, and **Edit** / **Delete** (44 px tall; read out as "Edit Mia" / "Delete
  Mia"). While the character is in its 10 minutes, "Time left to make changes: 9:41" shows under
  the card; once it's final, **Rename** (read out as "Rename Mia") replaces **Edit**, with the
  same link (see [The 10-minute rule](#the-10-minute-rule)). Tapping the card itself selects it
  exactly like a built-in character: the selection is saved in `ct_prefs_v1` (`characterId`),
  Quick start and **Start session** use it, and a ragebait character shows the ragebait warning on
  Start. A card is a frame holding the select button and the
  Edit/Delete row, because a button can't contain other buttons.
- **Delete** asks "Delete Mia? Your past sessions with this character stay in your history."
  (**Cancel** / **Delete**). If it was the chosen character, nothing is chosen any more (like a
  first visit, so Quick start hides). Focus moves to the next card, or to **Create your own**.
- **Other tabs:** saving, editing or deleting in another tab (or in the editor) updates the cards
  and Quick start at once (the `storage` event), and on a return from the back/forward cache.

### The editor (`avatar.html`)

`avatar.html` creates a character; `avatar.html?id=custom-…` edits one (or, once its 10 minutes
are up, only renames it: see [The 10-minute rule](#the-10-minute-rule)). It's a separate page
(like `history.html`) with a **← Back** link, so leaving it in any way discards what wasn't saved.

- **Preview:** at the top, staying on screen while the options scroll (`position: sticky`, at most
  about a quarter of the screen height). **Preview reactions** shows the 9 poses of the chosen
  personality one after another (1.2 s each), then the calm pose again. **Randomize** changes the
  look only (never the name, the personality or the gender), using only the chosen gender's
  options, picks a funny face only about 1 time in 10 and a fantasy skin colour about 1 time in 20,
  adds each kind of costume item only about 1 time in 8 (see [Costumes](#costumes)), and avoids
  combinations that look bad together: sunglasses with a full beard, earrings with hair that covers
  the ears, a necklace on a high collar (hoodie, turtleneck, puffer, track jacket, and high-collared
  costumes), and costume items that clash. The editor itself allows every combination.
- **Groups:** under Name and Personality, the look options are in 4 groups, in this order:
  **Base** (gender, skin tone, hair colour, face, hairstyle), **Costumes** (the presets),
  **Clothes** (outfit, costume outfit, back) and **Accessories** (headwear, masks and face, ears
  and horns, eyewear, earrings, necklace, costume beard, facial hair, held item, shoulder pet).
  All four are open when the editor opens; a tap on a group's title closes it (and opens it
  again), `<details>`. A group's options are only built while it's open.
- **Name:** required, 1–20 characters after trimming (an emoji or accented letter counts as one),
  unique among your own characters ignoring case. A name like a built-in character's is fine.
  Errors: "Give your character a name." / "Names can be up to 20 characters." / "You already have
  a character with this name." Checked on **Save**, then live while typing.
- **Personality:** Relaxed, Firm, Strict or Ragebait (the built-in groups and their
  expressions), Relaxed at the start, with "You can change it in the first 10 minutes after
  saving." (only when creating). When editing within the 10 minutes it can be changed like the
  look; on a final character it's a read-only badge.
- **Gender** (Female / Male): the two genders are fully separate. Each has its own faces,
  hairstyles, outfits, eyewear, earrings and necklaces (ids start with `w-` or `m-`), and only men
  have facial hair (the section isn't shown for women). Only skin tone, hair colour and the funny
  faces are shared, and every costume item. Switching gender, also when editing, starts again from
  that gender's starting look; the name, the personality and the costume items stay, except a
  costume beard when switching to Female (it can still be added by hand in Accessories).
- **What each gender gets** (`avatar-parts.js`):

  | | Women | Men |
  |---|---|---|
  | Faces | 22 (10 kept from the first version, 12 new young, attractive faces with lashes and/or lip tint; 4 of them on the model-like long oval head) | 22 (10 kept, 12 new young, attractive faces). Mostly oval or round heads (oval, long oval, round, egg, high cheekbones, wide), like the built-in characters' simple oval head: the jaw clearly narrower than the temples and a small rounded chin. 8 of the 12 new faces and the default face use the model-like long oval head. Only 4 faces use the two strong-jaw shapes (square jaw, long strong jaw), and those keep rounded corners |
  | Funny faces (shared, "Funny" group at the end of Face) | Huge chin, Tiny head with giant ears, Very long face, Buck teeth, Unibrow, Potato nose, Long pointy nose, Giant cheeks, Wide face with tiny features, Huge eyes | same |
  | Hairstyles | 17: Pixie cut, Short layered cut, Chin-length bob with volume, Short soft perm, Sleek bob, Side-swept lob, Shoulder length, Long straight, Long waves, Long curls, Curly afro, High bun, Low bun, High ponytail, Two braids, Side braid, Half-up | 15: Buzz cut, Shaved, Short crop, Crew cut, Side part, Quiff, Slicked back, Textured fringe, Low fade, Short curls, Curly top fade, Afro, Shoulder length, Man bun, Long tied back |
  | Outfits | 20 | 20 (T-shirt, hoodie, sweater, turtleneck, denim jacket, lab coat, puffer, striped top and tank top exist in both lists, with their own ids and colours) |
  | Eyewear | None; cat-eye, round thin-frame and oversized glasses; oversized, cat-eye and round sunglasses | None; rectangle, browline and round wire glasses; aviator, wayfarer and sport sunglasses |
  | Earrings | None, studs, hoops, drops | None, small stud, small hoop, double studs |
  | Necklace | None, thin chain, pendant, pearls | None, chain, thick chain, dog tag |
  | Facial hair | – | None, stubble, moustache, full beard, goatee, short boxed beard |

- **Faces** change the head shape and features, never the expression: the eyes, brows and mouth
  of every pose stay the shared ones, so every face works in all 9 poses of all 4 personalities.
  Lashes are 2 small strokes at each eye's outer corner, placed per eye drawing (open, closed,
  happy, wide, teary, narrow, bored, side, side-glance, rolled, squeezed) and scaled with the eye.
  Lip tint draws the mouth's line in a soft rose. The funny features follow the pose too: buck
  teeth hang from the top of whatever mouth the pose draws, a unibrow joins the brows' inner ends,
  and "tiny features" shrink the eyes, brows, nose and mouth together.
- **Look options:** radio-button grids (arrow keys and screen readers work as with any radio
  group), the chosen one with a coloured border and a check mark. Colours are swatches, the rest are
  small drawings of the character with that option. Every option has a label for screen readers
  (e.g. "Face 16: heart-shaped, soft nose, lashes, lip tint" or "Funny face 6: potato nose").
  Skin tone ends with a **Fantasy** group: green, blue, purple, grey, red and gold.
- **Save** reads the saved list again first, so the 10 limit and the name rule also hold if another
  tab saved meanwhile. A new character is then picked on the setup screen (`./?picked=<id>`, which
  runs the normal card tap: it's just selected, a ragebait one asks on Start). An edit goes back to
  the setup screen (`./`). **Cancel** goes back without saving. If the browser doesn't let the site store data, the editor shows the same note
  as the setup screen and still works; **Save** then says "Couldn't save your character. Your
  browser isn't letting this site save data." Editing a character that another tab deleted
  meanwhile says "This character was deleted in another tab, so it can't be saved."
- **During a session:** the editor can only be opened from the setup screen, so not from a running
  session in the same tab. In another tab it can: the running session keeps the character as it
  was when it started, even if it's edited or deleted there.
- **Speed:** a tap on an option redraws the preview and only the thumbnails whose drawing changed.
  Each thumbnail shows the base of the look (gender, skin, hair colour, hairstyle, face) with its
  own option, but no other accessories and no costume (the necklace thumbnails also show the
  outfit; the presets show their costume on that base), so outfit, eyewear, earrings, facial hair
  and costume item taps only redraw the preview. A thumbnail's key (what it shows) is built from
  the few fields it depends on, so checking ~350 thumbnails after a tap stays cheap. Thumbnails
  are inline SVG (much quicker to update than one image each), without the spaces between tags.
  - **What gets drawn when:** thumbnails on screen are drawn at once, those up to 100 px above or
    below it right after the next frame, the rest when they scroll into view; a closed group's
    thumbnails are never drawn, and only the chosen gender's sections exist.
  - **Randomize** shows the new preview first and redraws the thumbnails on screen right after
    that frame. The ones just off screen are drawn when the browser is idle, a few at a time, or
    the moment one scrolls onto the screen. A **gender switch** draws the rebuilt sections'
    thumbnails on screen at once (no empty boxes), and the rest the same way.
  - **Off-screen sections aren't rendered:** each section of options has `content-visibility:
    auto`, so the browser doesn't style, lay out or paint it while it's off screen (with every
    group open the page has ~2,000 elements). Until a section has been drawn once, its height is
    an estimate from its number of options (`contain-intrinsic-size`); then the browser keeps its
    real height. Content on screen doesn't move when sections above it are drawn for the first
    time.
  - **Theme chips:** a chip (see [Costumes](#costumes)) only shows another grid: its thumbnails
    are drawn the first time they're on screen for the current look, so going back to a theme
    seen before costs almost nothing.

  Measured in Chromium at 360 × 780 with 4× CPU slowdown, 7 taps each, with the tapped section
  scrolled into view. The first number: until the frame that shows the tap's result. The second:
  until every thumbnail on screen is redrawn. Medians of two runs, then the slowest tap. Timings in
  the test container vary from run to run, so the version just before these changes was measured
  alternately with this one on the same machine:

  | Tap (all 4 groups open, as when the editor opens) | Now | Before |
  |---|---|---|
  | Costume theme chip | 43–52 / 60–62 ms (slowest 77 / 128) | 73–87 / 93–96 ms |
  | Costume preset | 45–50 / 52–60 ms (slowest 70 / 87) | 52–53 / 53 ms |
  | Face | 33–37 / 37–41 ms (slowest 52 / 57) | 43–46 / 46–49 ms |
  | Hairstyle | 49–54 / 77–82 ms (slowest 75 / 102) | 53–61 / 76–84 ms |
  | Skin tone | 65–77 / 82–96 ms (slowest 91 / 109) | 79–80 / 91–95 ms |
  | Headwear, costume outfit or held item | 47–63 / 51–66 ms (slowest 85 / 91) | 46–61 / 49–63 ms |
  | Randomize, Base on screen | 55–60 / 116–126 ms (slowest 70 / 153) | 83–89 / 135–141 ms (slowest 120 / 170) |
  | Randomize, headwear on screen | 58–62 / 127–128 ms (slowest 75 / 159) | 99–100 / 179–185 ms (slowest 160 / 251) |
  | Gender switch | 94–146 / 115–172 ms (slowest 214 / 242) | 91–107 / 143–188 ms (slowest 171 / 289) |

  With only Base and Costumes open: Randomize 30–34 / 80–87 ms, gender switch 72–74 / 87–90 ms
  (before: 36–37 / 83–90 ms and 36–38 / 75 ms; the gender switch's first frame used to show the
  rebuilt sections with empty thumbnail boxes for a moment, now it shows them drawn). Opening the
  editor with all four groups open: the page is ready (DOMContentLoaded) after 176–243 ms and every
  thumbnail on screen is drawn after 249–325 ms (about 350 thumbnails built, most of them drawn
  only when scrolled to).

  Earlier versions measured the first number until after the work a tap left for after that
  frame; measured that way, Randomize is now 92–98 ms (before 118–153 ms). Part A: a tap 18–108
  ms. Before costumes (part 1): a tap on an option 21–92 ms, Randomize 65–91 ms, gender switch
  39–63 ms. Redrawing all thumbnails as images took 370–1160 ms. Almost all of the time is the
  browser parsing, styling and painting the thumbnails on screen (several ms each on a slow
  phone); building their drawings takes about 0.2 ms each.

### The 10-minute rule

Custom characters will be paid, so one character can't be turned into endless looks. A character
can be changed completely (look, personality, name) for 10 minutes after its first Save. After
that its look and personality are final; only its name can still be changed. The rule is shown
before saving, the time left is shown while it runs, and a final character says why.

- **One constant, one helper** (`public/js/custom-characters.js`): `CUSTOM_EDIT_WINDOW_MS`
  (10 × 60 × 1000) and `customEditMsLeft(character, now)`, the ms left (0: final). Everything that
  shows or checks the 10 minutes uses it. It's worked out from `createdAt` (`Date.now()` at the
  first Save, never changed by an edit, so an edit doesn't restart the 10 minutes): no new storage
  key and no new stored field. Wall-clock time, so it runs while the app is closed.
- **Final** when `now − createdAt` ≥ 10 minutes, when `createdAt` is 0 or missing (ghosts, broken
  entries), and when the device clock is more than 60 s behind `createdAt` (set back;
  `CUSTOM_CLOCK_TOLERANCE_MS`). Up to 60 s behind counts as no time gone yet, so a small automatic
  clock correction right after saving doesn't lock a new character. Characters saved before this
  rule existed are final at once (their `createdAt` is old).
- **Creating:** no time limit. Under the title: "After you save, you can still change everything
  for 10 minutes. After that, the look and personality are final."
- **Editing with time left** (`avatar.html?id=…`): everything can be changed, the personality too
  (the picker, not the badge). Under the title: "Time left to make changes: 9:41", updated every
  second (m:ss, timed to the deadline's whole seconds). That line is hidden from screen readers;
  next to it a visually hidden copy says the time in whole minutes ("… 9 min"), changes once a
  minute and isn't announced, except that a polite live region reads it out once at 5 min and at
  1 min left (then empties again).
- **When the time runs out with the editor open** (or as soon as the page runs again, if the tab
  was asleep): what's on screen is saved (look and personality, and the name if it's valid,
  otherwise the stored name), the page switches to the final state and "The 10 minutes are up. What
  you see is saved, and the look and personality are now final." shows above it (`role="status"`).
  Every change (an option, a costume, Randomize, gender, personality) checks the time first, so a
  change made after the 10 minutes is never stored, even in a tab that was asleep: the tap that
  finds the time is up only locks the page. If the browser refuses to store it, the usual save
  error shows instead and the preview goes back to the saved look; if the character was deleted in
  another tab, that message shows.
- **A final character** (`avatar.html?id=…` with no time left): the heading and page title are
  "Rename your character"; the preview and **Preview reactions** stay; **Randomize**, every look
  group and the personality picker are gone (the look options aren't even built); the personality
  shows as the badge; "This character is final. Its look and personality could be changed for 10
  minutes after it was created. You can still change its name." Only Name, **Save** and **Cancel**
  remain, and Save writes only the name (a look saved in another tab stays).
- **Save checks again** right before writing: a look or personality change is only written with
  time left; if the time just ran out, Save does what the end of the 10 minutes does (above) and
  stays on the page. A name-only Save always goes through. Every other check stays (name rules,
  limit, deleted in another tab, storage).
- **Your characters:** a character with time left shows the same countdown under its card and keeps
  **Edit**; a final one shows **Rename** instead. One timer updates only the countdown texts, runs
  only while some character has time left, and catches up as soon as the page is shown again; when
  one runs out the list is built again (focus stays on the same button). So with the editor open in
  one tab, the list in another switches to **Rename** by itself.
- **Personality changes** within the 10 minutes take the character off the accepted ragebait list
  (`forgetRagebaitAcceptance`), so a character changed to ragebait shows the warning on its next
  Start. A running session keeps the character it started with, and history entries keep the style
  they stored.

### Costumes

Custom characters can wear costumes, to build ideas like a Napoleon-style general, a pirate, a
witch or a masked figure. Everything is in `public/js/avatar-costumes.js`, as data: every list is
shared by both genders and starts with None.

202 items (87 from part A, 115 from part B, marked "B:"):

| Category (look field) | Items |
|---|---|
| Headwear (`headwear`, 54) | Bicorne (general's hat), tricorne (pirate hat), Santa-style hat, witch hat, wizard hat, crown, tiara, jester hat, knight helmet (open face), top hat, cowboy hat, captain's hat, chef's toque, graduation cap, hood, pumpkin head, halo, flower crown, beret, party hat, beanie, headphones, bowler hat, sailor hat. B: elf hat, dwarf hood, Viking-style helmet (no horns), laurel wreath, pharaoh-style headdress, musketeer-style hat with feather, coronet, steampunk top hat with goggles, scientist goggles, police-style cap, firefighter helmet, astronaut helmet (a glass bubble, the hair shows inside), deerstalker, explorer's hat, ringmaster's top hat, plague doctor hat, pilot cap, surgical cap, judge's wig, straw hat, sun hat, baseball cap (backwards), black knit cap, bandana, ninja-style hood with a cloth face mask and a red headband knotted at the side, ballet bun ribbon, bunny ears, bear hood, dinosaur hood, robot head (covers the head, with glowing openings) |
| Masks and face paint (`mask`, 22) | Masquerade mask, plain white mask, skull mask, superhero eye mask, eye patch, monocle, fake moustache, curly villain moustache, vampire fangs, friendly clown face paint, skeleton face paint, glitter. B: plague doctor mask (light, with a short beak that stops above the mouth), mummy bandages, witch nose with wart, long wooden nose, tiger stripes face paint, butterfly face paint, star-shaped glasses, carrot nose, bunny nose and whiskers, cat-burglar eye mask |
| Costume beard (`costumeBeard`, 8) | Santa-style white beard, long wizard beard, pirate beard (in the hair colour), fake beard on a string. B: dwarf braided beard, Viking-style beard, musketeer-style moustache and pointed beard (all three in the hair colour), red pointed beard |
| Ears and horns (`earsHorns`, 11) | Elf ears, devil horns, cat ears (in the hair colour), unicorn horn, antennae. B: ram horns, wolf ears, fairy ears, small horns, bear ears, dragon horns |
| Costume outfit (`costumeOutfit`, 54) | General's coat with epaulettes and sash, pirate coat, knight armour, king's robe and queen's gown with ermine, prince outfit, princess dress, Santa-style suit, witch dress, wizard robe, vampire suit with high cape collar, ghost sheet, superhero suit, chef's jacket, doctor's scrubs, firefighter jacket, pilot uniform, judge's robe, butler's tailcoat, cowboy shirt and vest, sailor suit, pumpkin costume. B: toga-style robe, Viking-style tunic with fur, pharaoh-style collar and robe, musketeer-style tunic, elf outfit, fairy dress, dwarf tunic, angel robe, red devil suit, jester suit, scarecrow outfit, mummy wraps (also wrap the head, face open), skeleton suit, long dark hooded cloak, astronaut suit, robot suit, alien costume, detective trench coat, mad scientist coat, explorer shirt, steampunk vest, ninja-style black outfit, ballerina tutu, ringmaster jacket, rock star leather jacket, striped burglar shirt, snowman costume, bunny onesie, bear onesie, dinosaur onesie, clown suit, dragon tamer leather vest |
| Back (`back`, 11) | Cape, royal cloak, angel wings, bat wings, backpack. B: fairy wings, butterfly wings, dragon wings, jetpack, turtle shell, satchel |
| Held item (`held`, 34) | Magic wand, wizard staff, sceptre, lantern, telescope, book, broom, Santa's sack, gift box, candle, balloon, coffee cup. B: map, quill, crystal ball, flag (a plain pennant, no country's flag), trophy, pumpkin basket, Easter basket, umbrella, magnifying glass, potion flask, wrench, electric guitar and game controller (made-up shapes, no brand), microphone, lasso, ringmaster's cane, clipboard, wooden spoon, gavel, loot sack, compass, serving tray with cloche |
| Shoulder pet (`pet`, 8) | Parrot, owl, black cat. B: small dragon, raven, frog with a crown, white mouse, small robot |

Plus 6 **fantasy skin colours** (green, blue, purple, grey, red, gold) after the 10 natural tones.
Left out on purpose: a trident (a weapon), a monk-style hood (religious dress), a respirator and a
sports face guard.

- **Presets** (the **Costumes** group, right after Base): **No costume**, always shown first, then
  a row of 5 **theme chips** and a grid with only the chosen theme's presets. 55 presets:

  | Theme | Presets |
  |---|---|
  | Fantasy (14) | Witch, Wizard, King, Queen, Elf, Dwarf, Fairy, Angel, Devil, Dragon tamer, Prince, Princess, Jester, Scarecrow |
  | Horror (7) | Vampire, Ghost, Skeleton, Mummy, Masked figure, Plague doctor, Pumpkin head |
  | History (7) | Pirate, General (Napoleon-style), Knight, Viking, Roman emperor-style, Pharaoh-style, Musketeer-style noble |
  | Jobs (14) | Astronaut, Detective, Mad scientist, Doctor, Chef, Firefighter, Pilot, Sailor, Ship's captain, Judge, Butler, Explorer, Circus ringmaster, Ballerina |
  | Fun (13) | Santa-style, Superhero, Robot, Alien, Cowboy, Steampunk inventor, Ninja-style, Rock star, Gamer, Easter bunny, Snowman, Cat burglar, Friendly clown |

  Each is a small picture of that costume on your character's current face and hair. A tap sets
  every costume field (the preset's items, None for the rest) and, for Santa-style and Vampire,
  the hair colour (white, black), for Alien the skin (green). It never changes the name,
  personality, gender, face, hairstyle, outfit, eyewear, earrings, necklace or facial hair, and
  every item can still be changed afterwards. Read out as "Put on the costume: Pirate".
- **Theme chips:** Fantasy, Horror, History, Jobs, Fun: one radio group (arrow keys and screen
  readers work as with any radio group; its name is "Costume theme"), Fantasy chosen at the start.
  The chosen theme is only kept in memory (nothing is stored), so the editor always opens on
  Fantasy. The chips wrap onto more lines when they don't fit; there's no sideways-scrolling row.
  A small **dot** marks the chip of the theme of the costume being worn, when it is exactly one of
  the presets (every costume item as that preset sets it; the skin and hair colour don't count);
  screen readers hear that chip as "Horror, current costume". No two presets set the same items,
  for either gender, so the dot is never ambiguous.
- **Beards and gender:** on a female look, no preset adds a costume beard (Pirate, Santa-style,
  Wizard, Dwarf, Viking, Musketeer-style noble), and the female preset pictures show none. Male
  looks keep them. A costume beard can still be added by hand in Accessories. Switching to Female
  removes the costume beard; every other costume item stays.
- **The costume outfit** is drawn instead of the outfit. The outfit choice is kept and comes back
  when the costume outfit is set to None.
- **A pick takes off what would hide it:** when you pick an option that a costume item covers,
  that costume item is set to None at once, silently, so your pick shows (`uncoverFor` in
  `avatar-costumes.js`). This also works when you tap the option that's already chosen (and with
  Space on it). Picking a field's None (no facial hair, no eyewear…) takes nothing off. The rules:

  | You pick | Taken off |
  |---|---|
  | An outfit | the costume outfit |
  | A hairstyle | anything that hides the hair completely: the hoods (plain, dwarf, ninja-style, bear, dinosaur), the knight helmet, the pharaoh-style headdress, the judge's wig, the pumpkin and robot heads (`hair: "hide"`), the ghost sheet and the mummy wraps (`hidesHair`). Hats that only cover the top of the hair stay. |
  | Facial hair | the costume beard, and anything over the lower face (the pumpkin and robot heads, the ninja-style hood with its mask) |
  | A necklace | a high-collared costume outfit, or the ghost sheet |
  | Eyewear | a covering head (pumpkin, robot, ghost sheet) or a mask that clashes with glasses (eye patch, monocle, star-shaped glasses, plague doctor mask) |
  | Earrings | anything that hides them: the hoods, the knight helmet, the pharaoh-style headdress, the judge's wig, the covering heads, the mummy wraps |

  Everything else stays, and the preset dot and the thumbnails update as usual (after Pirate, a
  T-shirt takes off only the pirate coat; the dot goes, because the look is no longer exactly
  Pirate).
- **Hats over hair:** each hat has a band height. The hair above it is hidden and only its sides
  and back show, so every hat fits every hairstyle and head, including the funny faces. Tall hats
  (witch, wizard, top hat…) are as wide as the head at the band and are flattened only as much as
  needed to stay inside the picture on the tallest head. Crowns, the coronet, the tiara, the party
  hat, the halo, the flower crown, the laurel wreath, headphones, scientist goggles, the ballet bun
  ribbon, bunny ears and the astronaut helmet sit on the hair instead (the hair shows inside the
  bubble). The hoods (plain, dwarf, ninja-style, bear, dinosaur), the knight helmet, the
  pharaoh-style headdress, the judge's wig, the pumpkin head, the robot head, the ghost sheet and
  the mummy wraps hide the hair completely (and earrings).
- **The face always reads:** masks, face paint, beards, hats, the pumpkin and robot heads, the
  ghost sheet and the mummy wraps are all drawn under the shared eyes, brows and mouth, so all 9
  poses of all 4 personalities still show. The ninja-style mask covers the nose and cheeks below
  the eyes; the mouth is drawn on the cloth, in its plain dark line even on a face with lip tint
  (`mouthOnCloth`), and the cloth is a lighter slate than the hood so it reads. Openings in masks
  show skin (the pumpkin's glow yellow,
  the robot's light cyan, the ghost's light blue), never black, so closed eyes stay visible. Masks
  around the brows are light (the plague doctor mask) so dark brows read on them. Fangs hang from
  whatever mouth the pose draws. Fake noses (witch, wooden, carrot, bunny) and the plague doctor
  beak stop above the mouth and stay between the eyes. The eye patch is the one item that covers
  an eye; the other eye, the brows and the mouth carry the expression.
- **Held items** are in the left hand (on the viewer's left), drawn with the character's own hand.
  They're hidden in the two poses that need both hands (ragebait's slow clap and crossed arms,
  `HAND_BUSY_EXTRAS`). Pointing uses the other hand.
- **Shoulder pets** sit on the right shoulder, where each body's shoulder is. In the pointing poses
  the hand is drawn in front of the pet.
- **Clashes:** items that don't go together are marked in the data (`tags` / `clashes`), e.g.
  horns, ears on top or bunny ears with a hat or helmet, the pumpkin head, the robot head or the
  ghost sheet with any hat, mask, beard or glasses, a monocle, eye patch, star-shaped glasses or
  the plague doctor mask with glasses, the ninja-style hood (it has its own face mask) with
  another mask, a costume beard or facial hair, the mummy wraps with ears, horns or earrings, a
  high-collared costume with a necklace. (One headwear at a time, so a helmet never meets another
  hat.) **Randomize** never picks clashing items and adds each kind of costume item only about 1
  time in 8; the editor still allows everything.
- **Tone:** costumes may be spooky (skulls, masks, a hood, dark outfits, mummy bandages) but there
  are no weapons, no blood and no gore; nothing copied from a film, book, brand or logo (the
  masked figure is a plain white mask with a long dark hooded cloak; the guitar and controller are
  made-up shapes); no real person's portrait ("Napoleon-style" is a generic bicorne and general's
  coat; "Pharaoh-style" is plain gold and blue stripes, with no symbols); nothing that mocks a real
  culture, religion or ethnicity; and no sacred dress.
- **Saved data:** the 8 fields are optional in `ct_custom_characters_v1`'s look (part B only adds
  item ids, no fields). A character saved before costumes has none of them and gets None; an
  unknown value also gets None.
- **Adding an item:** one entry in its list in `avatar-costumes.js` (an `id` starting with `c-`,
  never reused, a `label`, and an SVG drawing or a listed PNG; see the
  [Avatar art guide](#avatar-art-guide)). Nothing else needs to change. A preset is one entry in
  `COSTUME_PRESETS`, with a `theme` from `COSTUME_THEMES` and items that no other preset uses
  exactly.

### Sessions, history and stats

- Sessions store the `characterId` and the personality as `style`, as always. Sessions with a
  custom character also store its name (`characterName`, in `ct_session_v1` and the history
  entry), so a renamed or deleted character's sessions still show a name. History and summary use
  the character's current look and name if it still exists.
- **Deleted characters:** old sessions show the stored name. A session that runs (or is resumed
  after a reload) with a character deleted in another tab keeps running, drawn with the default
  look and its stored name and style (`ghostCharacter`).
- **Picks:** every custom character counts as `"custom"` in `POST /api/picks`; the user's own ids
  and names never leave the device. See [Popularity stats](#popularity-stats-backend).
- **Export:** the history export includes these sessions (with `characterName`), but not yet the
  characters themselves. That's part 2 of custom characters, which is to be finished before the
  feature is switched on for good. Each character's `look` is exported and imported as a whole
  and goes through `cleanLook`, so look fields added later (and older files without them) work
  without extra code.

### Paid characters (plan for December)

`CUSTOM_PAID` in `public/js/custom-characters.js` is `false`: custom characters are free for
everyone and the Create card says **Free during launch**. When payments arrive (December), it
becomes `true`, and then:

- the Create card shows a lock and a **Paid** badge instead of "Free during launch", and tapping it
  opens an unlock sheet instead of the editor (until unlocked);
- **characters made during the free launch stay usable**: they keep working (select, rename,
  delete, sessions) without paying;
- [the 10-minute rule](#the-10-minute-rule) already applies to every custom character, so a paid
  character is one look, not endless ones;
- `/stats.html` already lists custom characters as "always paid", outside the top ~10% ranking.

No payment code exists yet.

### Avatar art guide

A custom character is drawn in layers (`public/js/avatar-art.js`), all on the **same 200 × 240
canvas** as the built-in placeholders, with the same anchor points:

| Anchor | Where |
|---|---|
| Eye line | y = 102 (eye centres x = 78 / 122, moved by up to 3 px towards or away from the nose by the face) |
| Mouth | around y = 136 |
| Head centre | (100, 105) |
| Temple line | y = 105: the head's widest point above the cheeks; everything above it is half an ellipse |
| Crown / chin | crown y = 40–54 (funny heads 26–60), chin y = 164–172 (funny heads up to 197), depending on the head |
| Neck | y = 140–180 (28 px wide Female, 34 px Male) |
| Shoulder line | y ≈ 172 |

**Heads** are built from a few numbers (`buildHead` in `avatar-parts.js`): crown height, width at
the temples, cheekbones, jaw corner, chin width and height, and how angular the jaw is. Above the
temple line every head is half an ellipse centred at (100, 105); all the differences (soft or
strong or narrow jaw, high cheekbones, pointed or square chin) are below it. A head with
`ellipse: true` is an exact ellipse instead (centre y `cy`, half-width `halfW`, crown `top`): the
model-like long oval (`m-model`, `w-model`) is the first version's "long" head, an ellipse 50 wide
and 66 tall centred at y = 104. Hair is anchored to its centre the same way.

**Layers, back to front** (costume layers in italics): *`back`*, `hair-back`, `body`, `neck`,
`outfit` or *`costume-outfit`*, *`back-front`*, `necklace`, *`headwear-back`*, `ears`, `head`,
`marks`, *`mask-paint`*, `facial-hair`, *`costume-beard`*, `eyewear-arms`, `hair-front`, giant
ears, *`ears-horns`* (elf ears), *`costume-outfit-head`*, *`ears-horns`* (on top of the head),
*`headwear`*, then the face (*`headwear-face`* and *`costume-outfit-face`*: openings, *`mask`*,
`nose` and the expression: eyes with lashes, brows, mouth with lip tint, buck teeth, blush and
tears; the expression is shared by every face and always SVG; then *`mask-over`*), `earrings`,
`eyewear`, *`held`*, *`pet`*, and the pose's other extras (sweat, steam, hands…). Ears sit behind
the head; facial hair, hair, masks and hats sit under the eyes and mouth, so the expression always
shows; glasses arms go under the hair and the lenses over it. Giant ears (a funny face) are drawn
over the hair. Without a costume, the drawing is exactly the same as before costumes existed.

**Real images:** any layer can be a PNG with a transparent background, drawn on the full 200 × 240
canvas (or a larger image with the same proportions, e.g. 800 × 960), at
`public/assets/avatar/<category>/<id>.png`, for example `hair-front/w-sleek-bob.png`,
`head/m-square.png`, `outfit/w-wrap-dress.png`, `eyewear/m-aviators.png` (the lenses) and
`eyewear-arms/m-aviators.png` (the arms). The ids are the ones in `public/js/avatar-parts.js`:
heads `w-…`, `m-…` and `fun-…` (`HEAD_SHAPES`), `ears/<small|medium|large|giant>`,
`body/<female|male>`, `nose/<button|petite|defined|…>`, and the option ids of each gender's lists.
Add one line per file to `AVATAR_PNG_FILES` in `avatar-parts.js` (and the file to `PRECACHE` in
`sw.js`): a listed file is used everywhere, anything not listed stays SVG, and nothing else
changes (not the editor, not the saved data). Files are listed instead of looked up, so the app
never requests hundreds of files that don't exist.

- **Hair** (`hair-back`, `hair-front`) is drawn for the reference head: an ellipse centred at
  (100, 105), 54 wide each side (x = 46 to 154 at y = 105), crown at y = 45. The code scales it
  around the temple line onto each head's ellipse (`hairTransform`), exactly like the SVG hair, so
  a hairline drawn on the reference head fits every head. The hair's outer edge must lie a little
  outside that ellipse and its hairline inside it, so no skin shows between them. Long women's
  styles (shoulder length, side-swept lob, long straight, long waves, half-up) also have a "fall":
  the hair below the temples, drawn as two panels with a gap beside the neck, so the hair frames the
  face from outside. The fall is scaled to the head's width but never stretched in height, and on a
  head taller than the reference it moves up with the crown (at most 7 px), as in the first
  version (`hairFallTransform`), so it always falls straight to the same length. A PNG for such a
  style replaces both parts and is placed like the hair on the head. Keep fringes above
  y ≈ 70 between x = 62 and 138, so the brows stay visible. Mark a hairstyle `coversEars` when its
  front covers the ears: studs are then hidden, hoops and drops still hang below the hair.
- **Outfits** are drawn for the wider Male shoulders. The code cuts them to the chosen body's
  outline, except the area around the neck (x 70–130, y 140–200), where collars can rise.
- **Tinted layers:** `body`, `neck`, `ears`, `head` and `nose` take the skin tone; `hair-back` and
  `hair-front` the hair colour; `facial-hair` the darker brow shade of it. The code multiplies the
  image by the colour (an SVG `feColorMatrix` filter), so one image works for every colour. Such an
  image must be **greyscale**: the main colour area **white**, shading in greys (darker grey = deeper
  shadow), outlines dark grey or black (they stay dark), transparent background. Other layers
  (outfits, accessories, marks) keep their own colours.
- **Costume anchors** (`avatar-costumes.js` explains each list's fields):
  - **Hat band:** headwear is drawn for the reference head (like hair) with its band at a height
    of its own, usually y = 66–74, and must cover the head above it (the hair above the band is
    hidden). `fit: "head"` hats hug the head and are moved and scaled like hair: they may reach at
    most 18 px above the crown (y ≥ 27). `fit: "upright"` hats (tall ones) give their `height`
    above the band. Hoods, the knight helmet, the pumpkin and robot heads, the astronaut helmet
    and the pharaoh-style headdress (`fit: "none"`) are drawn from the head's own numbers
    (crown, temples, chin), straight onto the canvas (`hoodShape` in `avatar-costumes.js` builds
    a hood with its face opening for any head; `drop` and `topPad` make one shorter and snugger, like
    the ninja-style hood). Something that covers the whole head gives openings for the eyes and
    mouth in a light colour (`face(ctx)`) and isn't given a nose (`coversHead`; the ninja-style
    hood uses it too, since its cloth mask covers the nose).
  - **Face and mask area:** x ≈ 56–144, y ≈ 56–166, around the eyes (y = 102, x = 78 / 122, moved
    by the face) and the mouth (y ≈ 125–150). Masks and face paint follow the eye positions and
    size in SVG; a PNG mask is drawn for the default eye positions. Leave the eyes and the mouth
    open (skin, or a light colour), never black, and keep anything over the face (`over`: fake
    noses, the plague doctor beak) between x ≈ 90 and 112 above the eyes' lower edge, or below
    the eyes (y ≥ 106), ending above the mouth (y ≤ 124). Something around the brows must be
    light, so dark brows still read on it.
  - **Ears and horns:** elf-type ears at the ears (`earGeometry`, y ≈ 106), top items on the
    reference head's crown (y ≥ 27).
  - **Hand:** the left fist is at x = 24–62, y = 200–224 (some items move it: the lantern, the
    broom, the sacks and the baskets hold it higher, x ≈ 21–62, y ≈ 148–184; the serving tray
    sits on it at y ≈ 176; the guitar's hand is at x ≈ 4–42, y ≈ 150). Held items may reach from
    y ≈ 20 (staff, balloon) to the bottom, at x ≈ 0–80, but nothing tall may lean in over the
    face (x > 70 above y ≈ 150): the guitar's neck leans out to the left.
  - **Shoulder:** pets are drawn sitting on (162, 190) and moved onto the body's right shoulder:
    Female (152, 192), Male (164, 186). Keep them within x ≈ 140–190, y ≈ 125–195.
  - **Back:** behind the body and the hair, x 0–200, y ≈ 60–240 (wings reach up beside the head).
    Their front part (clasps, straps, the satchel at the right hip) goes over the outfit; the
    shoulders' outer edges are at x ≈ 53 / 147 (Female) and 33 / 167 (Male) at y ≈ 189
    (`ctx.shoulderX`: the jetpack's tanks are placed by it, so they show beside either body).
  - **Costume outfits** are drawn like outfits (for the Male shoulders, cut to the body's outline,
    collars free around the neck). Collar parts that reach the shoulders (fur, scales, spikes)
    use `c.shoulderX` so they fit the narrower Female shoulders too. One that wraps the head
    (mummy wraps) sets `hidesHair` and `hidesEarrings` and draws the head part in `head(ctx)`.
  - **PNG names** are `<layer>/<id>.png` with the layers above, e.g. `headwear/c-witch-hat.png`,
    `held/c-broom.png`, `costume-outfit/c-pirate-coat.png`. A PNG headwear is placed on the band
    like the SVG one. A costume item with no SVG drawing is still offered once its PNG is listed.
- **Very dark skin tones** (8–10, luminance under 0.12) draw the lines of the eyes, brows and mouth
  in pure black and 15% thicker, open mouths in a brighter red, and dark brows pure black, so the
  expression stays readable without an outline. Eye whites stay as they are.

## Session history (`history.html`)

Every finished session (timer ran out, or **Stop** → **End session**) that ran at least 1 minute is saved
on the device, except one ended with "Save this session to your history" unticked, and one you chose to **Discard** after coming back long after it ended (see above). A session abandoned with **Start over** is saved too, unless its "Save the first …
to history" checkbox was unticked (see above). The page shows:

- **Current and longest streak:** days with at least one finished session, by the day each session
  started (see [Which day a session counts on](#which-day-a-session-counts-on)).
  The current streak stays alive until today is over, even if you haven't finished a session yet today.
- **Time per week:** an SVG bar chart of the time spent in sessions (Simple and Advanced) in the
  same 12 weeks as the focus trend, by the week of the day a session counts on. The axis is in minutes while the
  busiest week is under 2 hours, in hours above that. This week's bar is full color, earlier weeks
  are lighter, and the line under it says e.g. "This week: 2 h 15 min across 6 sessions." With no
  sessions in those 12 weeks it only says "No sessions in the last 12 weeks."
- **Weekly focus trend:** an SVG line chart of the last 12 weeks (weeks start on Monday).
  Each week is total focused time ÷ total session time, so longer sessions count more.
  Weeks without Advanced sessions are a gap in the line.
- **Best time of day:** focus % by the hour a session started (on the device's clock then): Morning
  5–12, Afternoon 12–17, Evening 17–22, Night 22–5.
  A slot can only be "best" once it has at least 3 sessions with a focus %
  (`MIN_SESSIONS_FOR_BEST_TIME` at the top of `public/js/history.js`). Until one does, the page says
  "Not enough data yet".
- **Inner weather:** how the last 7 days felt, as marked after each session (see
  [Inner weather](#inner-weather)). Only once at least one session has a mood.
- **What distracts you:** the picked categories across all sessions, most common first, with count
  and share. Distractions without a category (picker skipped, or logged before categories existed)
  are left out of the bars and only counted in the note above them.
- **Last 30 sessions** with date, character, mode, length, distractions and focus %. Sessions saved
  by **Start over** have a small "restarted" label. The title says "Last 30 sessions (of N)" once
  there are more than 30, otherwise "N sessions". A session with a mood has a small weather icon at
  the end of its first line. See [Deleting a session](#deleting-a-session).
- **Time capsule:** a message to your future self, sealed until a day or more session time (see
  [Time capsule](#time-capsule)). Ready messages show at the very top of the page.
- **Backup:** "Your sessions are saved automatically on this device. Export a copy before you
  switch phones or clear your browser data. …", then Export and Import buttons (see
  [Export and import](#export-and-import)). The text names the history limit, written the way the
  language writes numbers ("5,000" in English, "5000" in Hungarian, "5.000" in German), so
  `history.js` fills it (`renderBackupText`) instead of `data-i18n`; `history.html` has the English
  text for a page without script.

The history keeps the **newest 5000 sessions** (`HISTORY_LIMIT` in `public/js/history-store.js`,
about 1.5 MB with typical sessions). It's always sorted by start time, newest first:
`saveFinishedSession` sorts before it cuts and writes, so a "Welcome back" save of an older session
or a device clock set back lands in its place. Once there are more than 5000, each new session
silently removes the oldest one. An import never removes a session (see below).

Simple-mode sessions have no focus % (their buttons aren't time-based). They count for streaks and
time per week and appear in the list as "—", but are left out of the focus trend and time-of-day
numbers.

### Which day a session counts on

One rule for every number and every date on the page: **a session counts on the local calendar day
on which it started, by the device's clock at that moment, and that day never changes afterwards.**

- **Over midnight:** a session from 23:50 to 00:15 belongs to its start day as a whole: its time,
  its streak day, its week and its time-of-day slot (Night). It's listed with its start date and
  time. The end doesn't matter, so a session paused overnight and ended the next morning still
  counts on the day it started. Sunday 23:50 to Monday 00:15 counts in Sunday's week.
- **Stored with the session:** when a session starts, the device's offset from UTC (world time)
  in minutes is saved with it (`utcOffsetMin`, e.g. `60` in Budapest in winter, `120` in summer,
  `0` in Madeira in winter, `330` in India). It already includes daylight saving at that moment.
  The day, the week, the hour and the date and time shown in the list (and in the Delete dialog)
  all come from `startedAt` plus this offset, so they're the same wherever the phone is later.
- **After a timezone change** (travel, or a change in the phone's settings) old sessions keep
  their day and time. **"Today" and "this week"** are always the phone's current local date. Times
  in the list then aren't always in clock order: each session shows the time the phone had when it
  started (the list itself stays in start-time order).
- **Sessions saved before this rule** (no `utcOffsetMin`) use the phone's current timezone, as
  they always did; they're never rewritten. A session that was already running when the app was
  updated gets its offset worked out from its start time when it's saved.
- **Code:** `sessionDay`, `sessionHour` and `sessionClock` in `public/js/history-store.js` are the
  only places that turn a session into a day, an hour or a shown date; `public/js/history.js` uses
  nothing else. Days and weeks are compared by their date (`YYYY-MM-DD`), never by time.
  `startSession()` in `public/js/app.js` is the only place that creates a running session (Start,
  Quick start and Start over all go through it), so every new session gets `utcOffsetMin`.

### Deleting a session

For a session that shouldn't count (timer left running, a test, an accidental save):

1. Tap **Edit** next to the list title. Each listed session gets a **Delete** button on a line of its
   own under it, and **Edit** becomes **Done**.
2. Tap **Delete** under the session. A dialog asks "Delete this session?", shows the session's
   summary line (character, mode, date and time, length) and says "It will be removed from your
   history and from every number on this page."
3. **Delete** (red) removes it; **Cancel**, Esc or Back keeps it.

After a delete every number on the page is drawn again from the saved history, the next older
session moves up into the list, and a line under the list says "Session deleted." Edit mode stays
on, so you can delete several in a row; **Done** turns it off. Deleting the last session shows the
empty state, as on a first visit (Export is disabled then).

- **Only the newest 30 sessions** can be deleted, because only these are listed.
- **An export brings it back:** Import adds every session whose start time isn't in the history, so
  importing an export made before the delete adds the deleted session again. Delete it again, or
  export a new file after deleting.
- **Several tabs:** Delete reads the saved history at that moment and removes only that session, so
  a session saved meanwhile in another tab is kept. If the session was already deleted in another
  tab, the page just redraws. See also [Changes from other tabs](#changes-from-other-tabs).
- If the browser refuses the change (storage blocked), nothing is deleted and the line under the
  list says "Couldn't delete the session: your browser didn't allow the change."
- Nothing else about the saved data changes: same key, same session format, same export version.
- Screen readers: each Delete button is read with its session, e.g. "Delete session: Grandma, Mon 20
  Oct, 14:05". After a delete the focus moves to the Delete button now at the same place in the list
  (the one above if it was the last row, the empty-state text if no sessions are left), and "Session
  deleted." is read out. After Cancel it goes back to the Delete button that opened the dialog (or,
  if another tab changed the history meanwhile, to that session's Delete button in the redrawn list).

### Changes from other tabs

The page doesn't keep showing old numbers: it's drawn again from the saved history when
- another tab saves, deletes or imports sessions, seals, opens or deletes a time capsule, picks,
  changes or removes a mood on a summary, or all site data is cleared there (the `storage` event for
  `ct_history_v1`, `ct_capsules_v1` or `ct_moods_v1`, or with no key);
- it comes back from the browser's back/forward cache (`pageshow` with `persisted`), e.g. Android
  Back after a session was saved on the app page;
- it's shown again (`visibilitychange`), because Android can freeze a background tab so it misses
  the storage event. This also happens when the file picker of **Import** closes;
- the day changes while it stays open and visible: a timer goes off 1 second after the next local
  midnight and draws the page again (the new day's current streak and "this week"), then is set for
  the following midnight. It's set again after every draw (`scheduleMidnightRedraw()` in
  `public/js/history.js`). With the Delete dialog open it waits like any other redraw.

It's only drawn again if something changed: the saved history (as text) or the date, since the
streak and "this week" depend on the day (`historySource()` in `public/js/history.js`). So showing the
page again after nothing happened draws nothing, and an Import only draws once (its own).
- **Edit mode** stays as it is (it only turns off when no sessions are left).
- **"Session deleted."** and the Backup line (e.g. "Imported 3 sessions.") stay.
- **Delete dialog open:** nothing is drawn under it. Once it closes the page is drawn again once,
  whatever the answer (a delete draws it anyway, so never twice).
- **Focus:** if a Delete button had it, it moves to the new Delete button of the same session, or, if
  that session is gone, to the one now at its place (the row above if it was the last one), or to
  the empty-state text if no sessions are left. Everything else that's focused (Edit, Export, Import,
  links) isn't replaced, so it keeps focus, unless no sessions are left and it's hidden (Edit) or
  disabled (Export): then focus goes to the empty-state text. Nothing is read out.

### Browser storage keys

| Key | What's in it |
|---|---|
| `ct_session_v1` | The session that's running right now (removed when it ends). `characterName`: only with a custom character (its name when the session started). `restartPending: true` while the continue/restart question is unanswered; older saved sessions don't have it, which means `false`. `leftAt` (timestamp in ms): only while the page is hidden, for the time away card; missing means the page wasn't left. Never copied into the history. `pausedAt` (timestamp in ms, or `null`): when the current break started (see **Take a break**). `pauses` (`[{ at, ms }]`): the breaks that are over. Sessions saved before breaks existed have neither, which means never paused. `utcOffsetMin`: the device's offset from UTC in minutes when the session started (copied into the history, see [Which day a session counts on](#which-day-a-session-counts-on)); a session started before it existed doesn't have it |
| `ct_history_v1` | Finished sessions, sorted by start time (newest first), max. 5000: a new session over the limit removes the oldest one, an import never removes any |
| `ct_custom_characters_v1` | Characters made in the editor: `{ v: 1, characters: [ { id, name, personality, createdAt, look: { gender, skin, hairColor, hairStyle, face, outfit, eyewear, earrings, necklace, facialHair, headwear, mask, earsHorns, costumeBeard, costumeOutfit, back, held, pet } } ] }`. The 8 costume fields are optional: characters saved before costumes don't have them, which means None. `id` is `custom-` plus 10 random letters/digits, never reused (a new id also avoids every id in the history). `personality` is the style its sessions run in. `createdAt`: `Date.now()` at the first Save, never changed by an edit; the look and personality can be changed for 10 minutes after it (see [The 10-minute rule](#the-10-minute-rule)), and 0 or a missing value means final. Reading never fails: a broken entry is skipped (not the whole list), an unknown look value gets the default. See [Custom characters](#custom-characters) |
| `ct_prefs_v1` | Last chosen character, mode and duration, plus `endSound` and `keepScreenOn` (the two setup checkboxes, `true`/`false`). Prefs saved before these existed get `true` for both. `leaveReminder`: the **Remind me if I leave the app** checkbox (see [Leave reminder](#leave-reminder)); prefs saved before it existed get `false`. `homeScreenTipDismissed`: `true` once **Got it** was tapped on the iPhone Home Screen tip. `persistRequested`: `true` once persistent storage was asked for (or skipped in Firefox), see [iPhone storage and the Home Screen app](#iphone-storage-and-the-home-screen-app). Prefs saved before these two existed get `false` for both. `howItWorksDismissed`: `true` once **Got it** was tapped on the How it works card; prefs saved before it existed get `false`, so the card shows once. `language`: only once a language was picked in the language sheet (`"en"`, `"hu"`); without it the app follows the browser's language (see [Languages](#languages)). `theme`: `"light"` or `"dark"`, only once the light/dark switch was tapped; without it the app follows the phone's setting (see [Light and dark](#light-and-dark)). A `style` value saved by older versions is ignored and dropped. `ragebaitAccepted`: the ids of the characters whose ragebait warning was accepted on Start (see **Ragebait warning** in [How it works](#how-it-works)); prefs saved before it existed count the ragebait character chosen then as accepted. `usePlan` (`true` while **Plan** is picked in step 3; missing means `false`) and `plan` (`{ rows: [{ minutes, count, breakMinutes, breakPicked }] }`, the plan built there; `breakPicked`: that row's break was picked by hand): see [Plans](#plans); prefs saved before them have neither, which means Single block and, once Plan is picked, the first-time plan. `focusNoise` (`"off"`, `"brown"`, `"pink"`, `"white"` or `"green"`), `focusNoiseVolume` (5–100, in %), `focusMix` (`{ rain: { on: true, volume: 40 }, … }`: every Ambient sound that has ever been on, with its volume) and `focusVolume` (the master, 5–100): the **Focus sound** setting (see [Focus sound](#focus-sound)); missing or bad values mean Off, 70% per layer and 55% master, and unknown sounds are dropped. A `focusSound` value saved by an early test version is dropped. `moodQuestion`: the **Ask how it felt at the end** checkbox (see [Inner weather](#inner-weather)); prefs saved before it existed get `true`. Saved field by field (see [Several tabs](#several-tabs-one-tab-at-a-time)) |
| `ct_plan_v1` | The running plan (see [Plans](#plans)), removed when its summary shows: `{ v: 1, startedAt, characterId, characterName?, style, mode, blocks: [{ minutes, breakMinutes }], index, phase, blockStartedAt, breakStartedAt, parts }`. `index`: the block that runs (`phase: "block"`, whose session in `ct_session_v1` has `startedAt` = `blockStartedAt`) or the next one (`phase: "break"`, the break after block `index − 1`, started at `breakStartedAt`). `parts`: what each finished block measured, for the plan's summary (`{ block, startedAt, plannedMs, elapsedMs, distractedMs, focusPercent, distractions: [{ level, category }], pauses, status, startedOver? }`, `status` `"saved"`, `"exists"`, `"failed"`, `"short"`, `"unsaved"` or `"discarded"`). Never copied into the history. Ignored and cleared while plans are off |
| `ct_capsules_v1` | Time capsule messages (see [Time capsule](#time-capsule)): `{ v: 1, capsules: [ { id, createdAt, text, opensAt?, opensAfterMs?, readyAt?, announced?, openedAt? } ] }`. `id` is `cap-` plus 10 random letters/digits. `text`: the message, trimmed, 1 to 500 characters. Exactly one of `opensAt` (a timestamp in ms: the local day and time picked in the day and time sheet; ready when `Date.now() >= opensAt`) or `opensAfterMs` (counted session time in ms). Capsules from earlier test builds have `opensOn` (`"YYYY-MM-DD"`) instead: it's read as `opensAt` = local midnight of that day and saved as `opensAt` with the next change (if both are there, `opensAt` wins). `readyAt`: when it was first seen ready; from then on it stays ready. `announced: true` once the summary line was shown for it. `openedAt`: when **Open** was tapped (the first one is kept). Reading never fails: a broken entry is skipped (not the whole list), unknown fields are dropped. Not in the export file yet. Ignored but kept while `CAPSULES_ON` is false |
| `ct_moods_v1` | Inner weather (see [Inner weather](#inner-weather)): `{ v: 1, moods: { "<startedAt>": "<mood id>" } }`, keyed by the history entry's `startedAt`; the id is `sunny`, `partly`, `cloudy`, `drizzle`, `rain` or `storm`. Reading never fails: unknown ids (such as `fog` from an earlier test build) and broken entries are skipped. Every write reads the key fresh first and drops the moods whose session is no longer in the history. The history entries themselves have no mood field. Not in the export file yet. Ignored but kept while `MOOD_ON` is false |

Each history entry: `startedAt`, `endedAt` (timestamps in ms), `utcOffsetMin` (the device's offset
from UTC in minutes when the session started, a whole number from −720 to 840; entries saved before
it existed don't have it, see [Which day a session counts on](#which-day-a-session-counts-on)), `endedBy` (`"timer"`/`"manual"`/`"startOver"`),
`characterId`, `characterName` (custom characters only, see [Custom characters](#custom-characters);
built-in characters and older entries don't have it), `style` (the character's personality when the session ran: `"kind"`, `"firm"`,
`"strict"` or `"ragebait"`; shown as its group label, e.g. "Relaxed" for `"kind"`), `mode`, `plannedMs`, `elapsedMs`, `distractedMs`, `focusPercent`
(`null` in Simple mode) and `distractions` (`[{ at, level, ms, category }]`). `category` is
`"phone"` (shown as "Screen": the phone, other apps or tabs; also what the time away card sets), `"thoughts"`, `"noise"`,
`"people"`, `"tired"`, `"other"` or `null` (nothing picked). A distraction logged from the time away
card also has `source: "away"`; tapped ones have no `source` field. `pauses` (`[{ at, ms }]`: when each
break started and how long it lasted) is only there when the session had breaks; older entries never
have it. `elapsedMs` is session time: `endedAt − startedAt` minus the breaks.
Sessions saved before categories existed have no `category` field; everything that reads it treats
that as `null`.
Sessions saved before personalities came from the character keep the style that was chosen then
(for example a strict Grandma). A session that was still running when this changed continues, and
is saved, with the character's own personality.
History lives only in this browser: clearing site data or using private mode deletes it, and it
doesn't show up on other devices.
The history page says so, too (its storage note at the top: "Use Export below before you switch
phones or clear your browser data.").

### When the browser won't save

Browsers can refuse to let a site store anything (in Chrome on Android: Settings → Site settings →
On-device site data → "Don't allow sites to save data on your device", for all sites or just this
one), and storage can be full. Then nothing reaches the history and settings aren't remembered, so
the app says so before a session, not only on the summary:

- **How it's checked:** `storageWorks()` in `public/js/history-store.js` writes `ct_storage_test` =
  `"1"` and removes it straight away. If storage is blocked or full the write throws, so nothing is
  ever left behind and no new data is kept. Blocked and full count the same. It runs when
  `index.html` and `history.html` load, when a session starts (Start, Quick start, Start new
  session), and whenever the page is shown again (so the notes go away without a reload once site
  data is allowed, and appear on the next check if it's blocked while the page is open). Other tabs
  get a `storage` event for the test key, which all their listeners ignore. Storage that is only
  nearly full can pass the 1-byte test and still refuse a session: then the summary's "Couldn't
  save" line is the only hint, as before.
- **Setup screen:** a red line right under the header, above the Quick start card: "Your browser
  isn't letting this site save data, so sessions won't go into your history and your settings won't
  be remembered. You can allow it in your browser's site settings." Only while the check fails;
  there's no setting for it. The Quick start card, How it works card and iPhone tip show and hide as
  before. If the page is scrolled down when the line appears or goes, the page is scrolled by its
  height, so what's on screen stays put.
- **Session screen:** when a session starts and the check fails, the red line under the session info
  says "This session won't be saved: your browser isn't letting this site save data." Like the "Couldn't save the first part" line it turns invisible after 10 s
  (`SAVE_ERROR_NOTE_MS`), keeping its space, and the next session removes it. A session resumed after
  a reload doesn't check again.
- **History page:** while the check fails, "Your browser isn't letting this site save data, so no
  sessions can be stored here. You can allow it in your browser's site settings." shows instead of
  "No finished sessions yet … Start one →". If sessions can still be read (full storage), they're
  drawn under it. Export and Import keep their own messages.
- All three notes are `role="status"` and their text is set only when they appear, so a screen reader
  reads them once, not on every check. The texts are in `public/js/data/messages.js` (which
  `history.html` loads too).

### iPhone storage and the Home Screen app

Safari on iPhone and iPad can erase a site's saved data (history, streak, prefs) after 7 days of
using Safari without visiting the site. Web apps added to the Home Screen are exempt. Android Chrome
doesn't do this.

- **Web app manifest** (`public/manifest.webmanifest`, a small file that tells the phone the app's
  name, icon and colors): makes "Add to Home Screen" on iPhone and "Install app" on Android open the
  app full screen, without the address bar, with the ConcenTraining name and icon. Start page and
  scope are the site root. Background and theme color are the light theme's page background
  (`--color-bg`, `#f5ede0`). Each page also has two `theme-color` metas (light `#f5ede0`, dark
  `#12172b`, each with its own `prefers-color-scheme` media query), and `js/theme.js` gives both the
  colour of the theme that's showing, so the browser bar matches the page (see
  [Light and dark](#light-and-dark)).
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

  It's never shown during a session or on the summary screen. If the How it works card shows too,
  the tip comes right under it. The check is `iosSafariNotInstalled()`
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
- **Icons** (`public/icons/`, `public/favicon.ico`): the ConcenTraining logo, a cream crosshair with
  an amber filled brain in the middle (seen from above: four rounded lobes per hemisphere, a central
  fissure and five short folds per side, outlined in espresso) on an espresso background. The source
  is `public/icons/icon.svg` (edit this one). The PNGs are rendered from it: `apple-touch-icon.png`
  (180, full square without transparency, iOS rounds the corners), `icon-192.png` and
  `icon-512.png` (rounded corners), and `icon-maskable-512.png` (full square, the picture shrunk to
  80% so it stays inside the middle safe zone and Android can crop it to any shape). At favicon
  size the filled brain would read as a pill, so `favicon.ico` (16/32/48 px) is rendered from a
  simplified `public/icons/icon-small.svg` (cream crosshair with an amber dot on espresso). The PNGs
  and the favicon were made with a throwaway script (headless Chromium + Python), which isn't in the
  repo. After editing an SVG, render the files again at the same names and sizes, and raise
  `CACHE_VERSION` in `public/sw.js`: the icons are precached, so with unchanged file names the
  service worker would keep serving the old ones.

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
    "version": 8,
    "exportedAt": "2026-10-28T09:00:00.000Z",
    "sessions": [ /* history entries, newest first */ ]
  }
  ```

- **Export checks its own file:** every exported session runs through the same check as an import
  (`exportProblems` in `public/js/history-store.js`). Sessions that fail are still written to the
  file, but the status line turns red and says how many wouldn't import and why, e.g. "Exported 120
  sessions. 2 sessions in the file wouldn't import (2 break outside the session)." So a problem
  shows up at export time, not when you restore.
- **Import** reads such a file and **adds** its sessions to the history. It **never removes a
  session you have.** A session whose start time is already in the history, or appears twice in the
  file, is skipped ("Skipped 2 duplicates or sessions you already had"). The new sessions are
  added newest first while the history has room under the limit of 5000; the rest are left out
  ("5 older sessions from the file didn't fit (max. 5,000)"). With a full history nothing is
  written: "Nothing was imported: your history is full (5,000 sessions)." `mergeIntoHistory` reads
  the saved history again in the same step as the write, so a session saved meanwhile in another
  tab is never lost, and if the browser refuses the write nothing changes ("Couldn't save the
  imported sessions: …").
- The file itself must have the right `app`, `type` and `version`, otherwise nothing is imported
  and the page says what's wrong. Max. file size: 5 MB.
- Each session is checked on its own. An invalid session is skipped and the rest still import;
  one line says how many were skipped and why, for example
  "Skipped 3 invalid sessions (2 shorter than 1 minute, 1 bad planned length)".
  A session must have valid times, `endedBy`, character id, mode, style and distractions
  (unknown character ids are fine, so a newer export with new characters still imports), stay
  within the **sanity limits**, and not contain anything that can't be true. What can be worked out
  again is **repaired** instead of rejected, so a session the app saved itself is never lost.
- **Sanity limits** (far outside what the app can save):
  - every time (`startedAt`, `endedAt`, each distraction's and each break's `at`) is a whole number
    of milliseconds (`Number.isSafeInteger`), and `endedAt` isn't before `startedAt`
  - `startedAt` isn't before 1 January 2024 ("bad start or end time"), and `endedAt` isn't more
    than one day after the moment of the import ("date in the future"; the day allows for a phone
    clock that is a little off)
  - `plannedMs` is a whole number of minutes from 1 to 240 (`MAX_PLANNED_MS`, the same as the
    timer's maximum; "bad planned length")
  - at most max(100, 5 per second of session time) distractions ("too many distractions",
    `distractionLimit`). Taps are limited to one per 400 ms, which is 2.5 per second, so real
    sessions always fit: 300 for a one-minute session. The app never logs more than this limit
    either, and a held-down Enter on a distraction button counts once (key auto-repeat is ignored),
    so it can't save a session its own import would reject.
  - at most 1000 breaks ("bad break list")
- **Repairs:**
  - `elapsedMs`, `distractedMs` and `focusPercent` are always worked out again from the times, the
    breaks and the distractions (`sessionFocus`), whatever the file says (Simple mode's
    `focusPercent` is always `null`). Before 19 Oct 2026 the app rounded a distraction under 0.5% of
    the session up to 100%; such a saved 100 is kept.
  - a distraction whose `at` is outside the session (before the start, or more than 1 minute after
    the end, e.g. after the phone's clock was changed during the session) is moved to the session's
    start or end, whichever is nearer. Its length, level and category stay. A break outside the
    session is still rejected.
  - `characterName` is kept when `characterId` is a custom character's id and the name is
    non-empty text of at most 20 characters (after trimming); otherwise it's dropped and the session
    still imports. So after a restore, sessions with a custom character show its name again (the
    characters themselves aren't in the file yet). The name is only ever shown as plain text.
- What must still agree, checked against the worked-out numbers:
  - at least 1 minute long (same rule as saving); session time is `endedAt − startedAt` minus the
    breaks (version 7; before that there are no breaks)
  - from version 7, `pauses` is missing or a list of breaks: each `at` a time and each `ms` a whole
    number above 0 ("bad break"), each inside the session ("break outside the session"), in order and
    not overlapping ("breaks overlap"), and no distraction may fall inside a break ("distraction
    during a break": the buttons are hidden then). The breaks are taken into account before the times
    are compared, so a session with breaks that ran to the timer is still `"timer"`
  - `plannedMs` is a whole number of minutes (at least 1), and `elapsedMs` isn't more than it
  - `endedBy` fits the times: `"timer"` ran the full planned time, `"manual"` and `"startOver"`
    less. The allowed values and their rules are in `ENDED_BY_RULES` in
    `public/js/history-store.js`: a new value needs one line there, plus a version check in
    `cleanImportedSession` (like the one for `"startOver"`).
  - a distraction up to 1 minute after the end is kept as it is (a tap just as the timer runs out;
    a time away distraction's `at` is the moment the page was left, which is always inside);
    Simple-mode distractions have `ms: 0`, tapped Advanced ones are 30 sec to 10 min long
  - from version 6, `source` is missing (a tap) or `"away"`, anything else is an "unknown
    distraction source". An Advanced away distraction is a measured length: whole seconds, at
    least 15 s and not longer than the session ("away distraction length out of range"), and its
    level must match its length by the thresholds above ("away distraction level doesn't match
    its length"). So changing those thresholds later needs a new version, or older version 6
    exports would be rejected. A Simple away distraction has `ms: 0` like any Simple one.
  - from version 8, `utcOffsetMin` is optional: a whole number from −720 to 840 is kept, anything
    else is left out and the session still imports (it then counts in the phone's current
    timezone, like every older session). In version 1–7 files the field is dropped.
- `test-data/` has small files for testing these checks (see `test-data/README.md`).
- **Versions:** version 2 added `category` to each distraction. Version 1 files (made before that)
  still import; their distractions get `category: null`. From version 2, every distraction must
  have a known category or `null`. Old sessions without the field are exported with `null`.
  Version 3 allows `style: "ragebait"`; in version 1 and 2 files the style must be `kind` or `strict`.
  The fields didn't change, but a version 2 app can't read a ragebait session, so the new number
  makes an older app say "made by a newer version" instead of skipping every ragebait session.
  Version 4 allows `endedBy: "startOver"` (for the same reason); in version 1–3 files it's an
  "unknown end reason". Version 5 allows `style: "firm"` (again for the same reason); in version
  1–4 files it's an "unknown style". Version 6 allows time away distractions (`source: "away"` and
  a measured length). Version 1–5 files import exactly as before: a `source` field in them is
  dropped, and every Advanced distraction must still be 30 sec to 10 min. Version 7 adds the
  session's breaks (`pauses`, see **Take a break**). Version 1–6 files import exactly as before: a
  `pauses` field in them is dropped, and `elapsedMs` must be `endedAt − startedAt`. Version 8 adds
  each session's `utcOffsetMin` (see [Which day a session counts on](#which-day-a-session-counts-on)).
  Version 1–7 files import exactly as before (a `utcOffsetMin` field in them is dropped). An older
  app can't keep the field, so the new number makes it say "made by a newer version".
- If the session fields ever change again, raise `EXPORT_VERSION` in `public/js/history-store.js`,
  add the new number to `IMPORT_VERSIONS`, and teach the import how to read the older files.

## Time capsule

A **Time capsule** section on the history page: you write a short message to your future self and
seal it. It stays sealed until a day and time you pick, or until you've spent a chosen amount of further time
in sessions; then it can be opened on the history page. The data and rules are in
`public/js/capsules.js`, the drawing in `public/js/history.js`, the summary line in `public/js/app.js`
(`renderCapsuleNote`).

### The switch (`CAPSULES_ENABLED`)

`CAPSULES_ENABLED` at the top of `public/js/capsules.js` is **`true`**: time capsules are on for
everyone. Like plans, they're also **always on** on Netlify's test sites (`deploy-preview-…`,
`main--…`) and on `localhost` / `127.0.0.1` (`CAPSULES_TEST_SITE`); the code checks `CAPSULES_ON`,
never the switch alone. Set to `false`: no section, no ready messages at the top, no summary line,
and `ct_capsules_v1` is ignored but kept, so switching it on again brings every message back.

### Writing and sealing

- The section sits above **Backup**, outside the session part of the page, so it also shows with
  no sessions. Intro text, the sealed messages, **Write a message**, the "Opened messages" list and a
  muted line "Time capsules aren't in the export file yet."
- **Write a message** opens an inline form (not a dialog): "Your message" (up to 500 characters,
  counter "{count}/500"; the trimmed text can't be empty) and **Opens**, a two-way toggle:
  - **At a day and time:** a visible label "Day and time" (hu "Nap és időpont") above a field-like button
    with a calendar icon that says "Pick a day and time" (grey) and opens the in-app
    [day and time sheet](#the-day-and-time-sheet): any moment from 15 minutes from now to 2 years from
    now. After **Set** it shows "Today, 20:00", "Tomorrow, 8:00" or the date with weekday, year and
    time ("2026. dec. 24., csütörtök, 8:00"): "today" and "tomorrow" come from Intl
    (`RelativeTimeFormat`, `numeric: "auto"`) and the time from Intl in the language's own format
    (Indonesian "8.00"), so they need no texts. Screen readers hear the label and the value
    together. `isValidOpening` checks the range again; while the form is open it's checked every 30
    seconds, so a picked time that has become less than 15 minutes away disables **Seal it** and the
    form says "That time is too soon now. Pick a later one."
  - **After more session time:** quick-pick chips **+5 h**, **+10 h**, **+25 h**, **+50 h** (on the
    test sites only also **+1 min**, so a capsule can be opened after one short session on a phone),
    and **Custom** on a row of its own, which opens the [time sheet](#the-custom-time-sheet) for any
    amount from 15 min to 999 h. After **Set** the Custom chip shows the amount ("+7 h 30 min",
    Hungarian "+7 óra 30 perc") and is the selected one, even when it equals an hour chip; tapping
    it again opens the sheet with that amount. Cancel and Seal clear it ("Custom" again).
    `isValidOpening` accepts any whole number of minutes from `CAPSULE_CUSTOM_MIN_MS` (15 min) to
    `CAPSULE_CUSTOM_MAX_MS` (999 h), plus exactly 1 minute on the test sites; `cleanCapsule` accepts
    any positive whole number of ms, so older or hand-made amounts still read.
- **Each mode keeps its own choice:** switching between **At a day and time** and **After more session time**
  loses nothing; the active mode's choice is what gets sealed. While the active mode has no choice
  yet, a muted line under the two buttons says what's missing ("Pick a day and time first." / "Pick
  how much more session time first.").
- **Seal it** stays disabled until the text and the opening are valid. **Cancel** clears the form
  and puts the focus back on **Write a message**. After **Seal it** the focus goes to the new sealed
  card.
- **At most 3 sealed** (not yet opened) messages at a time. With 3, **Write a message** is disabled
  and a note says "You can have 3 sealed messages at a time." Seal checks again against the saved
  list, so a third message sealed meanwhile in another tab stops it (the note shows in the form).
- If the browser refuses to save (storage blocked or full), the form and its text stay exactly as
  they were and it says "Couldn't save the message: your browser didn't allow it. Your text is still
  here."
- The form is written in the HTML and never rebuilt by a redraw, so a change in another tab can't
  wipe what's being typed.

### Sealed messages

Each sealed card shows the envelope, "Sealed on {date}" and "Opens: {when}" (the field's format with
"today" / "tomorrow" in lower case: "Opens: tomorrow, 8:00", hu "Kinyílik: holnap, 8:00") or "Opens
after {time} more in sessions". The remaining time is formatted like the history page's totals (X h Y
min) but **rounded up** to whole minutes, so it never says "0 min". "Sealed on" uses the history
page's Intl date format, with the year when it isn't the current year. **A sealed message's text is never put
on the page**, not even hidden, so it can't be read early. A sealed message can be deleted (dialog
"Delete this message?" / "It will be deleted without being opened. This can't be undone.", Cancel
first, Esc and Back cancel) but not edited.

### Counting session time (one rule)

"After more session time" counts the session time (`sessionFocus(entry).elapsedMs`, so without
breaks) of every history entry whose `startedAt` is at or after the capsule's `createdAt`, with
**each day capped at 4 hours** (`COUNTED_MAX_PER_DAY_MS`), by the day a session counts on
(`sessionDay`). Sessions imported later count only if they started after the capsule was sealed.
The rule is one helper, `countedSessionMs(history, sinceMs)` in `capsules.js`: a later feature
counted in session hours (the "journey") must reuse it, not copy it. `capsules.js` has its own
local date-key helper (`capsuleDateKey`), because `history.js`'s `dayKey` isn't loaded on
`index.html`.

### Ready, opening and the summary line

- **Ready:** a date capsule when `Date.now() >= opensAt`; a time capsule when the counted time
  reaches `opensAfterMs`. While the history page is open, a timer draws it again half a second after
  the next sealed capsule's `opensAt` (`scheduleCapsuleRedraw`; times more than 24 days away are
  checked again after 24 days, the longest a browser timer can wait), so it opens on time without a
  reload. The midnight redraw stays. The page's "did anything change?" check also counts the
  capsules whose time has passed (`dueCapsuleCount`), so one that opened while the phone slept is
  drawn as soon as the page is shown again. The setup screen's badge updates when that page is shown
  again. A capsule opens at the moment that was picked: after a time zone change it opens at the
  same moment, so the clock time it shows moves with the zone. The first time a capsule is seen ready (history page or
  summary), `readyAt` is saved, and from then on it counts as ready forever, even if sessions are
  deleted later. A failed write of `readyAt` or `announced` is silent: readiness is still worked out
  from the condition.
- **Opening:** ready messages show at the very top of the history page, under the storage notes,
  oldest first: envelope, "A message from your past self", "Sealed on {date}", **Open**. Open saves
  `openedAt` first (if another tab already opened it, its `openedAt` is kept), then the envelope's
  flap folds open (about 400 ms, none with reduced motion) and the message shows in place and gets
  the focus. If the browser refuses the change, the message stays sealed and a line says so.
- **Opened on this visit:** the message stays in its card at the top until the page is loaded again,
  with "Written {date} · Opened {date}" and a **Delete** button (the same dialog as in "Opened
  messages"). After a delete the card disappears, the focus goes to the "Time capsule" title and
  "Message deleted." is read out.
- **Never twice:** a message with a card at the top is left out of the sealed and "Opened messages"
  lists (`renderCapsules` collects the top cards' ids first). As a safety net, the browser console
  reports an error if any message is ever drawn twice (nothing is shown on the page).
- **Later visits:** opened messages are in "Opened messages" inside the section, newest opened
  first, each with "Written {date} · Opened {date}", the text and a **Delete** button (dialog "This
  can't be undone.").
- **Summary line:** on the summary screen (a single session's and a plan's), when at least one
  capsule is ready, unopened and not yet announced: "A time capsule is ready to open in your
  history." Those capsules get `announced: true` (and `readyAt` if missing), so it shows once per
  capsule. The call is wrapped in `try`/`catch`: a capsule problem can never break the summary.
  `index.html` loads `js/capsules.js` before `app.js`; on that page it only runs from the summary.
- **Text safety:** the message is always set with `textContent`. Line breaks are kept
  (`white-space: pre-wrap`) and very long words wrap (`overflow-wrap: anywhere`).
- **Tabs:** every change reads the saved list fresh and changes only that capsule, so another tab's
  change is never lost. A capsule sealed, opened or deleted in another tab shows up on the next
  redraw (see [Changes from other tabs](#changes-from-other-tabs)).
- **Clearing site data** deletes the messages, like the history. They aren't in the export file yet
  (a later change to the export format adds them).

### The ready badge

A small amber circle with the number of time capsules that are **ready and not opened yet**, next to
**Your history →** on the setup screen and on the summary's **See your history** button (only while
`CAPSULES_ON`). It uses the design tokens (`--color-accent` fill, `--color-on-accent` number), so
it follows light and dark.

- **The count:** `readyUnopenedCount()` in `capsules.js`, with the same readiness rule as everything
  else (`isCapsuleReady`). It's read-only: the badge never saves `readyAt` or `announced`. So
  visiting the history page doesn't change it; it only goes down when a message is **opened** (or
  deleted).
- **When it's drawn** (`renderHistoryBadges()` in `app.js`): when the page loads, when it's shown
  again (`visibilitychange`, `pageshow`), on the `storage` event for `ct_capsules_v1`, for
  `ct_history_v1` (a session saved in another tab can make a time capsule ready) and with no key
  (all site data cleared), with every summary (single session and plan), and on a language switch.
- **Screen readers:** the circle is `aria-hidden`; the link gets the count in its name, e.g. "Your
  history, 1 message ready to open" / "See your history, 2 messages ready to open"
  (`capsule.badgeSetupLabel`, `capsule.badgeSummaryLabel`, with plural forms). With no ready
  message the `aria-label` is removed and the link reads as before.
- **Never breaks a screen:** the count is worked out inside `try`/`catch`; on any problem the circles
  are hidden and the setup screen and summary work as usual.
- The link texts sit in their own `<span data-i18n>`, because the translation system replaces the
  whole text of an element with `data-i18n`, which would remove the circle.
- No badge on the Home Screen icon: the Badging API isn't supported on Android.

### The day and time sheet

`public/js/date-sheet.js` replaces the native date input, whose system picker ignores the app's
design on Android. It's built like the [duration sheet](#the-duration-sheet) and uses its
bottom-sheet styles (`dialog.duration-sheet.date-sheet`):

- A modal `<dialog>` at the bottom: "Pick a day and time" and **×**, then **‹** month and year **›**,
  a row of weekday names starting on Monday and the month's days (names from Intl in the current
  language). Under it a **Time** row: **−** hours : minutes **+**, the hint "At least 15 minutes from
  now, up to 2 years ahead." and **Set**.
- **Days:** today can be picked. A day without any allowed minute is dimmed and disabled (today
  after 23:44, and every day after the one 2 years ahead); tapping one does nothing and keeps the
  focus where it was. **‹ ›** stop at the first and last month with an allowed day. It opens on the
  picked day's month, or on the first allowed day's month.
- **Tapping a day selects it** (`aria-pressed="true"`); the sheet stays open. Before a day is selected
  the time fields and **Set** are disabled.
- **Default time** when a day is selected: today, the next full hour at least 15 minutes away
  (19:50 → 21:00), else the next quarter hour (23:20 → 23:45), else the first allowed minute; any
  other day 8:00 (on the last day moved back into the range). Once the time was changed by hand in
  the sheet (or the sheet opened with a picked time), picking another day keeps that time, as long
  as it's allowed on that day; otherwise that day's default is used (so going back from a later day
  at 8:00 to today, once 8:00 has passed, gives today's next full hour, not a red hint).
- **Time:** **−** / **+** move to the previous / next quarter hour (20:07 → 20:00 / 20:15) between 0:00
  and 23:45, holding repeats (the duration sheet's timing). Any hour 0–23 and minute 0–59 can be
  typed. Outside the range (sooner than 15 minutes from now, later than 2 years from now), or with a
  field that isn't a whole number in its range, the hint turns red and **Set** stays disabled; what
  was typed is never changed.
- **Set** (or Enter in a time field) applies the day and time and closes the sheet. Tapping outside,
  **×**, Esc and Android Back close it without a change. Focus moves to the selected day (or the first
  allowed one) on open, without scrolling the sheet (so a landscape phone still shows the month and
  **‹ ›**), and back to the field on close. On a short screen (320×640, landscape phones, large text)
  the sheet scrolls inside; with the on-screen keyboard open it sits above it and keeps the field and
  **Set** in view.
- **Keyboard:** the days have one tab stop. Arrow keys move a day or a week, Page Up / Page Down a
  month, Home / End to the start / end of the week; moving past the month's edge shows that month,
  and moves stop at the first and last allowed day. Enter or Space selects a day.
- **Sizes:** day cells are at least 44px from a 360px wide screen up; below 360px they're 40×40 (the
  sheet's side padding is narrower there, so seven columns fit on a 320px phone).
- Each day button's name is its full date ("Thursday, 24 December 2026").

### The custom time sheet

`public/js/time-sheet.js`, behind the **Custom** chip. Built like the
[duration sheet](#the-duration-sheet) and on its styles (`dialog.duration-sheet.time-sheet`);
`duration-sheet.js` itself isn't changed.

- A modal `<dialog>` at the bottom: "Session time" and **×**, then **Hours** (0–999) and **Minutes**
  (0–59), each with **−** / a number field / **+** (one per tap, holding repeats with the duration
  sheet's timing), the range hint "Choose between 15 min and 999 h." and **Set**.
- A total under 15 min or over 999 h, or a field that isn't a whole number in its own range (also an
  empty one, or 60 minutes), turns the hint red and keeps **Set** disabled; what was typed is never
  changed. **−** / **+** stop at each field's limits (`aria-disabled`, so the focus stays), and
  minutes don't carry over into hours.
- It opens with the Custom amount set before, else the picked hour chip, else 1 h 0 min.
- **Set** (or Enter in a field) applies it and closes the sheet. Tapping outside, **×**, Esc and
  Android Back close it without a change. Focus goes to the hours field on open (without scrolling
  the sheet) and back to the Custom chip on close. With the on-screen keyboard open the sheet sits
  above it and keeps the field and **Set** in view.
- The chip row's columns have a minimum width in `em`, so with large text there are fewer, wider
  chips instead of labels overflowing them.

### The envelope art (placeholder)

The envelope is a simple inline SVG made with the design tokens, so it works in light and dark.
Everything about it is in one marked block: `envelopeArt(state)` in `capsules.js` (`sealed`,
`ready`, `open`) and the "ENVELOPE ART" block (`.capsule-art*`) in `css/style.css`. To use real
artwork, replace those two blocks; nothing else depends on the drawing.

## Inner weather

After a session the user can mark, optionally, how it felt inside, as weather. The history page shows
the marks as a small weather diary. It records a feeling, not performance: a stormy session is fine
and never judged, and a mood never changes a result, a number, a message or a character's pose
(characters react only to the session, never to the mood). The data and rules are in
`public/js/mood.js`, the question in `public/js/app.js` (`renderMoodRow`), the history page's parts in
`public/js/history.js` (`renderMoods`, the icon in `renderSessionList`).

### The switch (`MOOD_ENABLED`)

`MOOD_ENABLED` at the top of `public/js/mood.js` is **`true`**. Like plans and time capsules, Inner
weather is also **always on** on Netlify's test sites (`deploy-preview-…`, `main--…`) and on
`localhost` / `127.0.0.1` (`MOOD_TEST_SITE`); the code checks `MOOD_ON`, never the switch alone. Set
to `false`: no setup checkbox, no question on the summary, no icons or section on the history page,
and `ct_moods_v1` is ignored but kept (nothing reads or writes it, so nothing is dropped), so switching
it on again brings every mood back.

### The setting

The setup checkbox **Ask how it felt at the end** (`moodQuestion` in `ct_prefs_v1`, on by default;
prefs saved before it existed count as on). Off: the summary doesn't ask. Moods already marked still
show on the history page.

### The six moods: one scale

The moods are six steps of one scale, from easy to hard, always in this order (`MOOD_IDS`). Each has a
name and a short meaning, always shown together as "name: meaning" (`moodText`, the format
`mood.nameMeaning`):

| id | Name | Meaning |
|---|---|---|
| `sunny` | Sunny | it went easily |
| `partly` | Partly cloudy | it mostly went well |
| `cloudy` | Cloudy | it was mixed |
| `drizzle` | Drizzle | it was a bit hard |
| `rain` | Rainy | it was hard going |
| `storm` | Stormy | it was really hard |

The names are the keys `mood.<id>`, the meanings `mood.meaning.<id>`. A meaning is written as it
reads after the colon ("Rainy: it was hard going"), so it starts in lower case where the language
allows, and each "name: meaning" fits on one line at 320 px in every language. An earlier test build
had `fog`: a saved `fog` is skipped as unknown.

### The question on the summary

- **When:** under the summary's lines, above "Start another session", only for a session that is in
  the history (`saveFinishedSession` returned `"saved"` or `"exists"`), so never after a session under
  1 minute, a failed save or "Save this session" unticked, and only while `MOOD_ON` and `moodQuestion`
  are on. A session saved in another tab can only get its mood on its own summary.
- **What:** "What was the weather like inside?" and the six moods as icon toggle buttons
  (`aria-pressed`) in **one row**, left to right from sunny to stormy, so the row itself reads as the
  scale, with small end labels "Easy" under the left end and "Hard" under the right (`aria-hidden`).
  There's no label under each icon: each button's name is the full "Rainy: it was hard going", and
  the line under the row shows the picked one the same way. That line keeps its height when nothing
  is picked, so picking or removing never moves anything. The group is named by the question. A
  picked button has an amber ring, a tint and a check mark (not colour alone).
- **Size:** the buttons are square, 2.75rem to 3.75rem (44 to 60 px at the normal text size), and fit
  in one row at 320 px without sideways scrolling. Sized in rem, they grow with the text size; once
  six no longer fit in the question's width (a CSS container query), the row wraps to 3 + 3, keeping
  the order.
- **Taps:** skippable, nothing happens without a tap. A tap saves at once; tapping the picked one
  again removes the mood; picking another replaces it. The buttons only change once the write worked:
  if the browser refuses it (storage blocked or full), or the session was deleted in another tab
  meanwhile, "Couldn't save that. Try again." shows under the line and the previous state stays.
  The only text about the choice is its own "name: meaning"; there's no character reaction.
- **Plans:** the question shows once on the plan's summary; a tap saves the same mood for every block
  that is in the history (each block is its own session).
- **Other tabs:** if `ct_moods_v1` changes in another tab while the question shows (a session deleted
  on the history page), the buttons show what is saved now.
- The call is wrapped in `try`/`catch`, and `app.js` checks that `js/mood.js` is there (`moodOn()`),
  so a mood problem or a mixed-version cache only leaves the question out.

### Storage

- **`ct_moods_v1`** = `{ v: 1, moods: { "<startedAt>": "<mood id>" } }`, keyed by the session's
  `startedAt`, the same id the history uses. The history entries, `history-store.js` and the export
  format are unchanged.
- **Reading never fails:** unknown ids, keys that aren't a start time, and a broken file are skipped.
- **Writing** (`setMood`, the only write): reads the key fresh (so another tab's mood is never lost),
  changes the given sessions, then drops every mood whose session is no longer in the history, so the
  key can't grow forever (sessions over the 5000 limit, or deleted). If the
  history can't be read (broken data, storage blocked), nothing is dropped, so one bad read can't wipe
  the moods; no history saved at all drops them all.
- **Deleting a session** on the history page also removes its mood (also when another tab already
  deleted the session). If that write fails nothing is shown: the next write drops it anyway.
- **Import:** imported sessions have no mood, because moods aren't in the export file yet (a later
  change to the export format adds them).

### On the history page

- **Session list:** a small weather icon at the end of a session's first line, when it has a mood
  (`role="img"` named "Rainy: it was hard going").
- **Inner weather** section, above "What distracts you", only while `MOOD_ON` and at least one session
  in the history has a mood: the last 7 days as a strip, today on the right (local days; a session
  counts on its day as in [Which day a session counts on](#which-day-a-session-counts-on)). Each day
  shows its most frequent mood; a tie goes to the mood of the latest session among the tied ones
  (`weekMoods`). A day without a mood shows a small empty dot. Under each day its short weekday
  ("Mon"), or its narrow one ("M") when the section is narrow in rem (small screen, large text);
  today's is bold. Each day is a toggle button, at least 44 px tall, named with its full date and mood
  ("Monday 24 November, Rainy: it was hard going", or "…, Not marked"). Tapping a day shows its
  "name: meaning" (or "Not marked") in a line under the strip and marks the day with an amber ring;
  tapping it again clears the line. The line keeps its height while empty, and the picked day stays
  picked through redraws while it's still one of the 7. The note under it: "How your sessions felt,
  as you marked them after each one."

### The mood art (placeholder)

The six icons and the empty dot are simple inline SVGs made with the design tokens, so they work in
light and dark. They get heavier along the scale: sun, sun with a cloud, two clouds, a cloud with a
few short light drops (drizzle), a cloud with long rain lines, a darker cloud with lightning. Everything about them is in one marked block: `moodArt(id)` in `mood.js` and the "MOOD
ART" block (`.mood-art*`) in `css/style.css`. To use real artwork, replace those two blocks; nothing
else depends on the drawing.

## Privacy page (`privacy.html`)

`privacy.html` explains in plain words what stays on the device, what is sent to the server (only
the character count on **Start session**), hosting by Netlify, the legal basis and the user's GDPR
rights (required before launch, GDPR Art. 13). It's linked as a small grey **Privacy** link below
**Start session** on the setup screen, at the very bottom of `history.html` and in the "Your data"
part of `about.html`; not on `stats.html`,
the session or summary screens, or in dialogs. "← Back to the timer" at the top and bottom goes to
`./`, like on `history.html`; the phone's Back button returns to where you came from.

- The page has **one script**, `js/theme.js` in `<head>`: it reads the saved light/dark choice, so the
  page shows in the same theme as the app (see [Light and dark](#light-and-dark)). The page has no
  switch, so opening it saves nothing; it takes no session lock and registers nothing (it doesn't
  load `sw-register.js`).
- **Keep it true:** whenever data handling changes (a new request to a server, new data stored on
  the device or the server, a new third-party service, accounts or payments), update
  `public/privacy.html` and its "Last updated" date in the same pull request (also a rule in
  `CLAUDE.md`).

## About page (`about.html`)

`about.html` (https://concentraining.com/about) is the public page that says what the app does
today, for visitors, search engines and AI assistants: everything else is only visible inside the
app. It's short (one h1, "What you can do" and "Your data", about 250 words) and built like
`privacy.html` (same layout and CSS classes, "← Back to the timer" at the top, "Start a session →"
and a link to the privacy page at the bottom, all relative links).

- **English only, never translated**, like `privacy.html`: all its text is in the HTML itself, so
  crawlers that don't run JavaScript read it. It doesn't load the translation system; the only
  thing translated is the link to it, **About**, next to **Privacy** under **Start session**
  (`common.about` in every language file: "Az appról", "Über die App", …). The two links share one
  line, small and grey, each a 44px tap target, with a dot between them.
- **One script**, `js/theme.js` in `<head>` (same theme as the app); nothing is saved from the page,
  it takes no session lock and registers nothing. **Not in the precache list** (not needed at
  startup); the service worker keeps a copy after the first online visit, like `privacy.html`.
- **Indexed:** it has a canonical address (`https://concentraining.com/about`), link preview tags,
  no `noindex`, and it's in `sitemap.xml` (see [Search engines (SEO)](#search-engines-seo)).
  Netlify serves it as `/about` and `/about.html`; the canonical is always `/about`.
- **Keep it true:** it only lists features that are on in production (the switches in `plans.js`,
  `custom-characters.js` and `capsules.js`), never anything behind a switch that's off, prices, "free" or future
  plans. Characters never speak, so it never describes them talking. Whenever a user-visible
  feature is added, changed or removed, update the English text of `about.html` (and the meta
  description and JSON-LD in `index.html` if they're affected) in the same pull request (a rule in
  `CLAUDE.md`). No translations are needed.

## Languages

The app runs in **English**, **Hungarian** (magyar) and, in beta, **Spanish** (español), **Brazilian
Portuguese** (português), **Indonesian** (Bahasa Indonesia), **French** (français), **German**
(Deutsch), **Italian** (italiano) and **Polish** (polski), without a build step. English is the source
of every text and the fallback for any text another language doesn't have. `privacy.html` (legal
text), `about.html` (the public About page; only the link to it is translated), `stats.html` (internal), the link preview tags (`og:*`, `meta description`) and
`manifest.webmanifest` stay English: crawlers and the browser read those without running the app's
scripts.

### Files

| File | What's in it |
|---|---|
| `public/js/i18n/languages.js` | The list of languages without their texts (`LANGUAGES`: code, native name, English name, native speakers, beta flag, file, Intl locale, relative-time style) and the sheet's order rule (`sortLanguages`). The speaker numbers' sources are in a comment there. |
| `public/js/i18n/en.js` | The English UI texts (setup, session, dialogs, summary, history, import messages, editor), keyed `area.name`. |
| `public/js/i18n/hu.js` | Every key in Hungarian: the UI texts and the data files' texts (below). |
| `public/js/i18n/es.js`, `pt-BR.js`, `id.js`, `fr.js`, `de.js`, `it.js`, `pl.js` | Every key in Spanish, Brazilian Portuguese, Indonesian, French, German, Italian and Polish (beta: not yet reviewed by a native speaker). |
| `public/js/i18n.js` | The system: picks the language, `t(key, values)`, plurals, dates and relative times via Intl, translating the page while it's built, switching (`setLanguage`), the dev check. |
| `public/js/language-picker.js` | The language button and its bottom sheet (setup screen and history page). |

**Data files keep their English next to their data:** characters, groups and pose descriptions
(`js/data/characters.js`), motivations and the Simple summary sentences (`js/data/messages.js`),
distraction categories (`js/history-store.js`) and every avatar option, costume and preset
(`js/avatar-parts.js`, `js/avatar-costumes.js`). Each file ends with a short "translations" block
that hands its English to the system (`I18N.localize`): the text field turns into a **getter** (a
property that's worked out each time it's read), so `character.name` or `option.label` always gives
the current language and no other code had to change. Their keys:

- `character.<id>.name` / `.tagline`, `group.<id>.label`, `group.ragebait.warning`,
  `pose.<personality>.<pose>`
- `motivation.<id>`: each motivation has a fixed `id` (`general-1` …), given once and never reused,
  so moving a message doesn't mix up its translations. `summary.simple.<result>.<n>` (n from 1).
- `category.<id>`
- `avatar.<field>.<option id>` for every option; `avatar.headShape.*`, `avatar.nose.*`,
  `avatar.mark.*` and `avatar.funny.*` are the parts a face's name is built from ("Face 3: soft
  oval, straight nose"); `avatar.theme.<id>`, `avatar.preset.<id>`, `avatar.presetDescription.<id>`.

Adding a data item (a character, an avatar option, a motivation) works as before: one entry in its
list. Without a translation it shows in English in the other languages (and the dev check lists it).

**Copying a data object** freezes its texts in the language of that moment, because the copy gets
plain values instead of the getters. Every place that does this (checked for this change) builds a
fresh copy each time it draws, so nothing stays in an old language:

- `countCategories` (`history-store.js`) spreads a category (`{ ...category, count }`), used at once
  for the summary or the history page.
- `calcDayParts` (`history.js`) spreads a part of the day; the labels come from `dayPart.<id>` anyway.
- `FUNNY` (`avatar-parts.js`) spreads `makeFace(…)` while building the list, before its label getter
  is added; `buildHead` replaces every head shape with a built copy while the file loads, also before
  the translations block adds the getters.
- Not affected: `defaultLook`, `cleanLook`, `randomLook`, `applyCostumePreset`, `costumeOf` and the
  editor copy looks (ids only); `saveFinishedSession`, `buildHistoryExport` and the session in
  `ct_session_v1` store ids only (`JSON.stringify` never sees a character, option or category);
  `addThumb` keeps a reference to its preset. No `structuredClone` or `Object.assign` copies a data
  object.

Saved data holds no display text: prefs, the running session and the history store ids (character,
style, mode, category, level, end reason). The only text is `characterName` for custom characters,
the user's own name, which is never changed. So every old session shows in the current language,
and the **export file is exactly the same in every language**. Import problems are codes
(`import.reason.*`, `import.file.*`), translated when they're shown.

### Which language

- **Detection:** the first of the browser's languages (`navigator.languages`) that the app has: for
  each one in order, the exact code first, then its base language (`hu-HU` → `hu`, `en-US` → `en`,
  `pt-PT` → `pt-BR`). Otherwise English.
- **Saved only when picked:** a new field `language` in `ct_prefs_v1` (no new storage key), written
  only by a tap on a row of the language sheet, also on the language already shown. Until then the
  app follows the browser's language on every load, so prefs saved before this existed behave like a
  first visit.
- **Another open tab** keeps its language until it's loaded again (no live sync).

### The language button and sheet

- A pill at the top right of the setup screen's header and the history page's header: a globe icon,
  the code ("EN", "HU") and a small chevron, on the card colour with the cards' soft shadow, no
  outline, fully rounded, 44px tall. Screen readers hear "Language: English" / "Nyelv: magyar". It
  sits in a row of its own above the title, right-aligned, to the right of the light/dark switch
  (8px between them), at every width, so the title stays centred and never touches them (see
  [Light and dark](#light-and-dark)). It's not on the timer, summary or editor screens (they follow the language too).
- Tapping it opens a bottom sheet (a `<dialog>`, so focus, Esc / Android Back and screen readers work
  like the other dialogs; a tap on the dimmed page closes it too): a grab bar, "Language", one row
  per language (at least 52px), each with its native name in bold (with a matching `lang`), the
  English name under it in muted text (not for English), a check and a light amber background on
  the current one, and a "BETA" pill (never translated) on unreviewed ones. At the bottom, "Report a
  translation issue" opens an email to concentrainer@gmail.com with the subject "Translation issue
  (hu)" (always English, so reports can be filtered). It slides up when it opens (240 ms, like the
  [duration sheet](#the-duration-sheet)); with "reduce motion" it just appears.
- **Order, worked out from the data** (`sortLanguages`): English first; then the reviewed languages,
  most native speakers first; then the beta ones, most native speakers first; equal numbers by
  English name A–Z. So removing a language's `beta` flag moves it up by itself. With today's
  languages: English, Magyar, then (beta) Español, Português (Brasil), Bahasa Indonesia, Français,
  Deutsch, Italiano, Polski. Only languages that exist in `LANGUAGES` are listed.
- **Switching** happens at once, in place: the page's own text, the character cards, Quick start, the
  duration chips (the typed minutes stay), the category buttons, any note that's showing, the
  history page with its charts (edit mode stays), `<html lang>` and the page title. Everything else
  (the session screen, the summary, the dialogs) is built in the current language whenever it's next
  shown. A session can't be running on screen while the button is visible; a session in another tab
  keeps its language until that tab is loaded again (it resumes in the new language, its data has no
  text). If a language's file can't load (offline before it was ever saved), nothing changes.

### No flash of English (no inline scripts)

Each page loads `languages.js`, `en.js` and `i18n.js` in `<head>`, before `<title>`. `i18n.js` picks
the language, sets `<html lang>`, and for a language other than English writes its file into the
page with `document.write`: a script added that way loads before the browser goes on to the body,
so the texts are there in time (the CSP allows it: it's a file from the site itself). Then a
**MutationObserver** (a browser feature that runs code whenever elements are added) puts every
element with `data-i18n="key"` (text) or `data-i18n-attr="aria-label:key"` (attributes) into the
language as the browser builds it. Its code runs before the browser paints those elements, so the
English in the HTML never shows. One last pass at `DOMContentLoaded`, then it stops; everything the
scripts build afterwards asks `t()` itself. Elements whose text a script switches later (Stop / End
session, the Stop dialog's title) have no `data-i18n`, so that last pass can't overwrite them.

If the language's file doesn't load (blocked, or offline and not saved), the page simply shows in
English, with `<html lang="en">`.

### Formats

- **Plurals:** a text with plural forms is an object with one entry per `Intl.PluralRules` category
  of the language: `{ one, other }` in English, Hungarian and German; `{ one, many, other }` in
  Spanish, French, Italian and Brazilian Portuguese ("many" is for very large round numbers and has
  the same text as "other"); `{ one, few, many, other }` in Polish; only `{ other }` in Indonesian.
  A text may also have an optional **`zero`** form: for a count of 0, `t()` uses it if it's there,
  otherwise the `Intl.PluralRules` category as usual. Only Brazilian Portuguese uses it:
  `Intl.PluralRules("pt-BR")` puts 0 in "one" ("0 dia"), but Brazilians say "0 dias". Its zero forms
  are on every plural text that can show 0: `summary.logged`, `history.days` (streaks),
  `history.sessions` and `history.distractions`. The other plural texts are only shown for a count
  of 1 or more.
- **Dates and times:** always `Intl.DateTimeFormat` in the language's `intlLocale`, never put
  together by hand: English (`en-GB`) "Mon 20 Oct · 14:05", Hungarian "okt. 20., hétfő · 14:05". How long the weekday is comes from the language's `weekday`
  field in `languages.js` (`short` for English and the beta languages, e.g. "mar, 20 oct",
  "Di., 20. Okt.", "Sel, 20 Okt"; `long` for Hungarian, whose short form is a single letter). Spanish
  uses plain `es` (not tied to Spain, 24-hour clock; `es-419` would give "02:05 p.m.").
- **"Ended 3 hours ago":** `Intl.RelativeTimeFormat` in the language's `relativeTimeStyle`. English
  mixes styles to keep its wording ("45 min ago", "1 hour ago", "3 hours ago", "2 days ago"),
  Hungarian is `narrow` ("45 perce", "3 órája"). Each beta language's choice is commented in
  `languages.js`, picked from the real Intl output: `long` for Brazilian Portuguese and German
  (their short forms end in a full stop: "há 45 min.", "vor 45 Min.") and Indonesian ("45 mnt lalu"
  is cryptic); short minutes with long hours and days for Spanish, French, Italian and Polish
  ("hace 45 min", "il y a 3 heures"; French `narrow` would give "-45 min", Italian short days
  "2 gg fa", Polish narrow "3 g. temu").
- **Durations** ("24 min 30 sec" / "24 perc 30 mp") and percentages are templates in the language
  files (`time.*`, `history.percent`).
- **The leave reminder** is shown by the page (`app.js`), with the page's texts: always in the
  chosen language. The service worker only handles the tap, so it never needs the language (and it
  can't read `ct_prefs_v1`).

### Voice and the informal "you"

In every language: translated for meaning and tone, not word by word; factual, no guilt or pressure,
no emoji; characters never speak (pose descriptions stay neutral image descriptions). Always the
informal "you", the same across the whole app:

| Language | "You" | Notes |
|---|---|---|
| English | you | The source. |
| Hungarian | te (tegeződés) | Names, modes and durations in a text never get a case ending ("Törlöd: {name}?"), because custom names can be anything. "Munkamenet" (session) only where nothing more natural fits: buttons and headings use verbs or no noun ("Kezdés", "Még egy kör"). Terms: elkalandozás (distraction), fókusz, sorozat (streak), szünet (break), Egyszerű / Részletes (Simple / Advanced), Alig / Kicsit / Eléggé / Nagyon / Teljesen (the Simple levels), Laza / Határozott / Szigorú / Ragebait (groups), Tudtad? / Lendület (Brain fact / Boost). The Stop button keeps its English name, "Stop". The storage note on the history page names the Export button exactly as the button says it ("Exportálás"; the checks compare them). |
| Spanish | tú (never vosotros; ustedes if a plural is ever needed) | Neutral international Spanish for Latin America and Spain ("teléfono", "temporizador", no regional slang). Gender-neutral: no adjective or participle about the user (listo, cansado, bienvenido); verbs and nouns instead ("¡Hola de nuevo!"). Terms: sesión, distracción ("¿Te distrajiste? ¿Cuánto?"), concentración, racha, descanso, Parar, Simple / Detallado, Apenas / Un poco / Bastante / Mucho / Por completo, Amable / Firme / Inflexible / Ragebait (invariable, so they fit any character), ¿Lo sabías? / Impulso. |
| Brazilian Portuguese | você | Brazilian vocabulary and spelling (tela, celular, modo anônimo). Gender-neutral: no pronto, cansado, bem-vindo, obrigado about the user ("Que bom te ver de novo!"). Terms: sessão, distração ("Se distraiu? Quanto?"), foco, sequência, pausa, Parar, Simples / Detalhado, Quase nada / Um pouco / Mais ou menos / Muito / Totalmente, Gentil / Firme / Inflexível / Ragebait, Você sabia? / Impulso, "timer" (the Brazilian word). |
| Indonesian | kamu | No grammatical gender; no gendered address (Mas/Mbak, Kak). Terms: sesi, distraksi ("Terdistraksi? Seberapa banyak?"), fokus, hari beruntun (streak), istirahat, Berhenti, Sederhana / Rinci, Hampir tidak / Sedikit / Lumayan / Banyak / Sepenuhnya, Santai / Tegas / Ketat / Ragebait, Tahukah kamu? / Penyemangat; "timer", "browser" and "HP" are the everyday words. |
| French | tu | French typography: a narrow no-break space (`\u202f`) before ? ! : ; and % and inside « ». Gender-neutral: past tenses about the user use avoir ("tu as décroché"), never être + participle; no prêt, distrait, fatigué about the user ("Fin anticipée", "Bon retour !"). Terms: séance, distraction ("Tu as décroché ? À quel point ?"), concentration, série, pause, Stop, Simple / Détaillé, À peine / Un peu / Assez / Beaucoup / Complètement, Calme / Ferme / Sévère / Ragebait (invariable), Le savais-tu ? / Coup de pouce, minuteur. |
| German | du (lowercase) | Gender-neutral: no person nouns for the user (Nutzer, Anfänger, Profi); participles don't inflect ("Abgelenkt?", "du bist zurückgekommen"). Soft hyphens (`\u00ad`) in long compounds ("Weihnachts\u00admann"). Terms: Runde (session: "Letzte 10 Runden"), Ablenkung ("Abgelenkt? Wie sehr?"), Fokus, Serie, Pause, Stopp, Einfach / Detailliert, Kaum / Etwas / Ziemlich / Stark / Völlig, Locker / Konsequent / Streng / Ragebait, Wusstest du? / Ansporn, Figur (character), Timer. |
| Italian | tu | Gender-neutral: past tenses about the user use avere ("Hai perso il filo?"), never essere + participle ("ti sei distratto"); no pronto, stanco, bentornato about the user ("Rieccoti!"). Terms: sessione, distrazione, concentrazione, serie, pausa, Stop, Semplice / Dettagliata (agrees with "modalità"), Pochissimo / Un po' / Abbastanza / Molto / Del tutto, Gentile / Esigente / Inflessibile / Ragebait (invariable), Lo sapevi? / Carica, timer. |
| Polish | ty | Gender-neutral: never the 2nd-person past tense (-łeś/-łaś) or adjectives about the user; present tense, imperatives, impersonal forms and nouns instead ("Coś cię rozproszyło?", "Nie było cię przez 5 min."). Names are never declined ("Usunąć: {name}?"). Plurals have one / few / many / other. Terms: sesja, rozproszenie, skupienie, seria, przerwa, Stop, Prosty / Szczegółowy, Ledwo / Trochę / Sporo / Bardzo / Całkowicie, Łagodnie / Stanowczo / Surowo / Ragebait (adverbs, so they don't agree with a gender), Ciekawostka / Zachęta, minutnik. |

**The user's gender is unknown**, so no language uses a gendered form for the user: no slash forms
("listo/a"), no "(a)", no gender stars. Pose descriptions are written as verbs or invariable words,
because any character (also a custom one of either gender) uses them, and the "Tired" distraction
category is a noun everywhere (Cansancio, Cansaço, Kelelahan, Fatigue, Müdigkeit, Stanchezza, Zmęczenie).
The checks search each language for its typical gendered forms. A pose is read out as
"{name}, {pose}" ("Grandma, calm and smiling."); Spanish, Italian and Polish, whose pose
descriptions start with a verb, use "{name}: {pose}" ("Abuela: sonríe con calma."), because after a
comma the verb reads as an order to the character.

**"Ragebait"** is a loanword in many languages. Each language decides whether to keep it (when the
word is used locally, as in Hungarian, where the warning dialog explains it: "szándékosan próbál
felhúzni") or to use a native word. Every language so far keeps it: it's in everyday use on social
media in all of them. Each ragebait warning explains it in one sentence (es "intenta sacarte de
quicio a propósito", de "Sie will dich absichtlich auf die Palme bringen", …). The check for leftover
English allows it.

**Character names and their grammatical gender.** Most languages need a gender for role names
(Profesor / Profesora, Chirurg / Chirurgin). Each character keeps the gender its **current
placeholder art** shows (`placeholder-art.js`); this follows the placeholders and will be revisited
when the real artwork is made.

| Gender | Characters | From the art |
|---|---|---|
| Female | Grandma, Study Partner, Meditation Guide, Librarian, Headmistress | name; high bun; long braid; long hair; bun and name |
| Male | Santa, Professor, Sensei, Boss, Influencer | beard; beard; goatee; tie; "his phone" in the art code |
| Male (short hair only, no other cue) | Leader, Study Buddy, Grandmaster, Bodybuilder, Judge | short hair |
| Ambiguous (cap, mask or helmet hides the hair) | Coach, Surgeon, Soldier | a gender-neutral word where the language has a natural one, otherwise the masculine form (below); their taglines are gender-neutral |

Ambiguous characters per language: Coach = Coach (es, pt-BR, fr, de, it), Pelatih (id), Trener (pl).
Soldier = Soldado (es, pt-BR), Militaire (fr), Militare (it), Tentara (id), Soldat (de), Żołnierz (pl).
Surgeon = Dokter Bedah (id); the masculine form elsewhere (Cirujano, Cirurgião, Chirurgien, Chirurg,
Chirurgo, Chirurg). Where a language has no neutral word, the masculine form was chosen to follow the
placeholders, like the short-haired characters above; all of this is revisited with the real artwork.
Your Phone is an object. Custom characters' names are never translated.

### For the native-speaker review

Choices the independent reviews flagged and kept on purpose. A native speaker checks these before a
language loses its `beta` flag:

- **All gendered languages:** the masculine names of Surgeon (es, pt-BR, fr, de, it, pl), Soldier (de,
  pl) and Coach (pl), and the male short-haired characters (see the table above).
- **Spanish:** "Gamer" for the gamer costume (an invariable anglicism; "Videojugador" would be
  masculine). "Atardecer" for evening (17–22 h; Spanish has no exact one-word "evening"). "Gafas"
  (Spain) and "Aretes" (Latin America), both widely understood.
- **Brazilian Portuguese:** "Noite" (17–22 h) and "Madrugada" (22–5 h; strictly it starts at midnight,
  but the hours are shown next to the label).
- **Indonesian:** "Siang" for 12–17 h and "Malam" for 17–22 h. Duration chips use "mnt" / "dtk" for space; sentences say "menit".
- **French:** "Binôme" (Study Partner) is a masculine noun for a female character; her tagline doesn't
  agree with any gender. Pose descriptions are noun phrases ("un sourire encourageant"), because
  "Mamie, sourit." isn't correct French.
- **German:** costume presets that are masculine person nouns (Arzt, Koch, Feuerwehrmann, Superheld,
  Detektiv, Pestarzt, Zirkusdirektor, Außerirdischer, Verrückter Wissenschaftler, Einbrecher) and can
  be worn by a female custom character. The approved summary sentence "geht's" has a straight
  apostrophe while the rest uses ’. "Masken und Schminke" as the heading of a section that also has a
  monocle and noses.
- **Italian:** "Settimana dal giorno {date}" in the chart labels ("Settimana del {date}" would need
  "dell'8" / "dell'11"). Long single words carry soft hyphens for 320px phones ("Pochis-simo",
  "Abba-stanza").
- **Plans:** "After" in the plan rows is the shorter "Luego" (es), "Puis" (fr) and "Lalu" (id), so
  the break line fits a 360px phone. French uses "Lancer maintenant" / "Lancer : 120 min" for the
  break's Start button (like "lance le bloc suivant" in its text): "Commencer maintenant" doesn't fit
  half of a 320px bar on one line. Hungarian uses short units on the setup timeline only ("2 ó 30
  p").
- **Polish:** the badge "Za darmo na start" ("free to start with") is a little looser than "Free during
  launch".

### Exporting the texts for review

`tools/export-texts.mjs` writes every text of the app into Markdown tables, so a text can be
reviewed without reading code:

```
node tools/export-texts.mjs
```

It needs only Node (18 or newer): no dependencies, no build step. It writes `docs/texts/en.md`
(the English source, plus the text of `privacy.html` and `about.html`, which stay English) and
`docs/texts/<code>.md` for every other language in `LANGUAGES`. These files are generated:
**never edit them by hand**. Change the text in `public/js/i18n/<code>.js` (or, for English, in
`en.js` or the data file the text comes from), run the tool again and commit the regenerated
files in the same change. Running it without a text change gives no difference.

- **One row per key:** `key | English | this language` (`en.md`: `key | English`), grouped by
  where the text appears: shared words, the language and dark mode buttons, setup, characters,
  pose descriptions, session, motivations (one group per phase, each marked `fact` with its
  `// source:` or `boost`), dialogs, summary, history, export and import messages, the editor,
  its options (base, clothes, accessories) and costumes. A key that fits no group lands under
  "Other texts" and the tool says so: add a rule to `sectionOf` in the tool.
- **Plural texts** show every form (`one`, `few`, `many`, `other`, `zero`), one per line.
- **Invisible characters are shown:** a soft hyphen as `·`, a narrow no-break space as `_`, a
  no-break space as `~`, and an ordinary space at the very start or end of a text as `␣`. Every
  text is in a code span, so Markdown shows each character as it is.
- **No second copy of the texts:** the tool runs the app's own files (`languages.js`, `en.js`,
  `i18n.js`, the data files and every language file) in Node's `vm` module, an isolated box that
  runs JavaScript without a browser. What it exports is what the app shows.
- `docs/` and `tools/` are outside `public/`, so they aren't deployed, cached or covered by the
  service worker.

### Adding a language

1. Copy `public/js/i18n/hu.js` to `public/js/i18n/<code>.js`, change its first line to
   `I18N_TEXTS["<code>"] = {` and translate every text (keep every `{placeholder}`, every key, and
   the leading space of texts that start with one). Plural texts need every category
   `new Intl.PluralRules("<locale>").resolvedOptions().pluralCategories` lists.
2. Add an entry to `LANGUAGES` in `public/js/i18n/languages.js`, with `beta: true` and its
   `nativeSpeakers` from a source written in the comment there.
3. Add the file to `PRECACHE` in `public/sw.js` and raise `CACHE_VERSION`.
4. Add its "you" to the table above.
5. Open the app on localhost (or any address with `?i18n-check`): the console lists every text the
   language is missing.
6. Run `node tools/export-texts.mjs` and commit the new `docs/texts/<code>.md` (see above).

**Review process, before removing "beta":** automatic checks (every key, placeholders, plural forms,
no leftover English, the pages at 320px, 390×844 and 740×340 without overflow) → an independent
review session (a fresh session that only reviews the translation against the English and the rules
above) → a native speaker uses the app → remove `beta: true` (the language then moves up in the
sheet by itself).

## Offline use

Once the app has been opened online, it also opens and works **without internet**: the setup
screen, a full session, the summary, `history.html` and the character editor. This is done by a **service worker**
(`public/sw.js`): a small script the browser installs for the site, which sits between the pages
and the network and can answer from saved copies when the network is down. It's registered by
`public/js/sw-register.js`, loaded at the end of `index.html`, `history.html` and `avatar.html`. In a browser
without service workers, or if registering fails (e.g. `index.html` opened as a local file), the app
works online exactly as before.

- **First online visit (install):** the service worker downloads every file needed to start a
  session (the `PRECACHE` list in `sw.js`: the pages, CSS, the four font files, all JS including every
  language's texts, manifest, icons, favicon) into a
  cache named `concentraining-v<CACHE_VERSION>`. If any file fails, nothing is saved and it tries
  again on a later visit. `stats.html` (and `js/stats.js`) is left out: it needs `api/stats` anyway.
  The install asks with `cache: "no-cache"`: each file is checked with the server, so it's always
  the current version, but a file the page has just downloaded comes back as a tiny "not modified"
  answer instead of being downloaded a second time (measured locally: about 510 KB, 11 files, less
  on the first visit than with the earlier `cache: "reload"`).
- **Later visits:** every file the page uses is asked for again (network first, see below), but the
  browser only checks whether it changed: an unchanged file is a "not modified" answer of a few
  hundred bytes with no body. A second visit to the setup screen is about 12 such checks.
- **Network first:** every same-origin `GET` first tries the network. A good answer is used and its
  copy saved, so **online you always get the newest version**. A forgotten version bump can't
  leave anyone on an old app. The saved copy is used when the network fails (offline) or hasn't
  answered within **3 seconds** (a very weak signal), so the page doesn't hang. The network request
  keeps going in the background and still refreshes the saved copy. A file that was never saved
  keeps waiting for the network.
- **One address per page:** Netlify's Pretty URLs can serve `history.html` as `/history` (redirecting
  `/history.html` there and rewriting links to it). The service worker saves and looks up every copy
  under one address (`cacheKey` in `sw.js`): `/index.html` → `/`, `/history` → `/history.html`, and the
  `?query` is ignored. So the history page opens offline whichever address is used, even if it was
  never opened online. Redirect responses themselves are never saved; a page reached through one is
  saved without the redirect, because Chrome won't show a redirected response as a page.
- **Notification taps:** the service worker also handles taps on the
  [leave reminder](#leave-reminder) (`notificationclick`): it focuses the open app page or opens the
  app at its scope. This needed no new file, so `PRECACHE` and `CACHE_VERSION` didn't change: any
  change to `sw.js` makes the browser install the new version anyway.
- **Never handled by the service worker:** `api/*` and `.netlify/*`, anything that isn't `GET`
  (so `POST api/picks` goes straight to the network: a pick sent offline is simply lost, as
  before), other sites, and `Range` requests.
- **Works at the root and under a subpath:** every address above is relative to the service
  worker's scope (`self.registration.scope`, the folder `sw.js` is in). That's `/` on Netlify and
  `/ConcenTraining/` on the [GitHub Pages backup test site](#github-pages-backup-test-site-optional),
  so there `/ConcenTraining/index.html` is saved as `/ConcenTraining/`. For the same reason every path
  in `public/` is relative (no leading `/`), including the `api/picks` and `api/stats` calls.
- **Updates:** the browser checks `sw.js` on every visit (`netlify.toml` sends it with
  `Cache-Control: no-cache`). A changed `sw.js` installs in the background, then takes over at once
  (`skipWaiting` + `clients.claim`) and deletes the older `concentraining-` caches. **It never
  reloads or interrupts an open page:** a running session keeps the code it started with, and the
  new version shows up the next time the app is opened or reloaded. A reload during a session
  still resumes it from `ct_session_v1`. No localStorage key changed for offline use.
- **`privacy.html`** and **`about.html`** aren't in the precache list either: they aren't needed at
  startup. Once the service worker is installed, the first online visit saves a copy (as `/privacy`
  and `privacy.html`, `/about` and `about.html`, see above), so they open offline after that. Opened offline before any online visit, it shows the
  browser's offline page; Back works as usual.
- **`robots.txt` and `sitemap.xml`** are only for search engines and aren't in the precache list.
- **The character editor** (`avatar.html` and its scripts) is in the precache list, so characters can
  be made and edited offline too (`avatar.html?id=…` is found under `avatar.html`: the `?query` is
  ignored).
- **Real character artwork** (`public/assets/...`) isn't in the precache list. Each image is saved
  the first time it loads online and is available offline after that.
- **When you add, remove or rename a file the app needs at startup** (a page, CSS, a JS file, a font,
  an icon), update `PRECACHE` in `public/sw.js` and raise `CACHE_VERSION`. Forgetting doesn't break
  the online app, but a new file wouldn't work offline until it has been loaded online once, and a
  removed one would make the install fail (no offline support at all) until the list is fixed.
- **Deploy Previews** are separate sites (own address), so they have their own service worker and
  cache, apart from `main` and the live site. Netlify's preview toolbar doesn't load offline; that's
  expected.

### Mixed versions (old and new files together)

Because each file is fetched on its own, a weak signal right after a new deploy could in theory
give a page a new `app.js` from the network but an old `history-store.js` from the cache. The
service worker guards against the common cases:

- **The page came from the cache** (offline, or no answer within 3 seconds): all of that page's
  files come from the cache too, even if the network would answer them quickly. So an old page
  always runs with its old files.
- **The page came from the network:** the connection works, so its files get **10 seconds**
  (instead of 3) before the saved copy is used.

What's left is rare: the page arrives over the network, then the connection drops completely (or
a file takes over 10 seconds) in the second or two the other files load, **and** there was a new
deploy since this phone last opened the app online. A similar case: the connection drops in the
middle of an online start, so only some saved copies get refreshed, and a later offline start
combines them. If it happens, it depends on what changed: usually nothing visible; at worst a
JavaScript error, so the app doesn't start properly or a button doesn't work. Saved data is safe
(the localStorage keys never change, and older code ignores fields it doesn't know). Reloading
once with a decent connection fixes it, because every online start refreshes all the files.

## Design system

The app has one look, **Night Lamp**: parchment paper by day, midnight blue with amber lamp light by
night. Soft cards without outlines (a shadow instead of a border), pill buttons, 22px corners, and
in the dark theme a warm glow behind the character and around the timer. All of it is in
`public/css/style.css`; there is no second stylesheet and no design switch.

| | Light | Dark |
|---|---|---|
| Page | parchment `#F5EDE0` | midnight `#12172B` |
| Cards, dialogs, fields | `#FFFAF2` | `#1B2240` |
| Text | espresso `#2B2118` | `#F3E9D8` |
| Grey text | `#66584A` | `#B0AEC4` |
| Amber as a fill (primary buttons, picked chips, the switch's knob, progress bar, rings) | burnt amber `#B4541A`, white text on it | lamp amber `#FFB454`, dark ink `#2B1A05` on it |
| Amber as text (links, labels, chart lines) | `#9A4410` | `#FFB454` |

Burnt amber `#B4541A` is only 4.28:1 as text on the parchment page, so amber *text* uses the darker
`#9A4410` (5.63:1). In the dark theme one amber does both jobs.

### Tokens (three layers)

A **token** is a named value (a CSS custom property, e.g. `--color-accent`) that the rules use
instead of writing the value itself, so a colour or size is changed in one place. They are at the
top of `style.css`, in three layers:

1. **Primitives**: the palette, named by what they are (`--parchment-100`, `--amber-600`,
   `--midnight-900`, `--ramp-1` …). This is the only place where a raw colour (`#b4541a`) is
   written. No rule uses a primitive.
2. **Semantic tokens**: named by what they are for (`--color-bg`, `--color-surface`, `--color-text`,
   `--color-text-muted`, `--color-accent`, `--color-on-accent`, `--color-accent-text`,
   `--color-focus`, `--color-danger`, `--color-divider`, `--shadow-card`, `--radius-card`,
   `--font-body`, the type scale `--fs-…`, `--dur`). Each points at a primitive. The dark theme only
   changes this layer (and a few component tokens).
3. **Component tokens**: one component's own values, built from semantic tokens only (`--timer-size`,
   `--timer-glow`, `--level-tint`, `--stage-glow`, `--char-outline`, `--swatch-border`,
   `--header-control-bg`, `--dark-switch-shift` …).

Rules for changing the stylesheet:

- A rule uses semantic or component tokens, never a primitive and never a raw colour. A see-through
  colour is written as `color-mix(in srgb, var(--color-text) 30%, transparent)` (the colour at 30%
  opacity).
- A new colour: add the primitive, then a semantic token that points at it, for **both** themes.
- The dark theme's block is in the file **twice with the same content**: once for
  `:root[data-theme="dark"]` and once inside `@media (prefers-color-scheme: dark)` (see
  [Light and dark](#light-and-dark)). There is no build step that could share one block, so a
  change to one must be made to the other.
- Every text and its background must reach 4.5:1 (3:1 for large text: 24px, or 18.66px bold), in
  both themes. Marks that carry meaning (rings, bars, the switch's knob, field edges) reach 3:1.

What isn't a border any more still has one in the CSS: buttons, chips and cards keep a see-through
`1.5px` border, so their measured sizes didn't change and a picked card can show its amber ring
without moving anything. Real edges are kept where they carry meaning: text fields, the distraction
buttons, Undo, Stop next to the amber button, a disabled button, and hairlines between rows.

**Plans** (see [Plans](#plans)): the "Single block | Plan" toggle is a pill on `--color-control`
with the picked half on `--color-surface` and `--shadow-card`; the plan rows are cards; a row's
length and break are pill buttons on `--color-control`, with the app's chevron as an inline SVG in
the text colour (no image, so it follows the theme), that open the duration sheet (the language
sheet's look, the setup screen's chips); the timeline's blocks are `--color-accent`, its breaks stripes
of `--color-track` and `--color-paused`, and its fills grow with `transform: scaleX()` (no width
animation).

**Cues that don't rely on colour:** a picked character, mode or editor option gets a ring, a tint and
a check mark. The five distraction buttons are tinted from yellow to red and also have a band under
the word that grows from Barely to Completely (yellow can't be told from white by colour alone).

**The character** stands on a calm, pattern-free light (`--stage-glow`: the card colour by day, a
warm lamp glow by night) and has an outline (`--char-outline`) made with `drop-shadow`, which
follows the artwork's own transparent edge instead of drawing a box. So light and dark artwork both
stand out from the page in both themes, and new art needs no background of its own.

### Fonts

| Family | Used for | Files (`public/fonts/…`) | Size |
|---|---|---|---|
| **Fraunces 600** | Headings only (`h1`–`h3`, the character names, the Quick start line, "Paused", the language names) | `fraunces/fraunces-latin-600-normal.woff2`, `fraunces/fraunces-latin-ext-600-normal.woff2` | 17.7 KB + 16.9 KB |
| **Figtree** (variable: one file holds every weight) | Everything else: text, buttons, the timer and all other digits | `figtree/figtree-latin-wght-normal.woff2`, `figtree/figtree-latin-ext-wght-normal.woff2` | 19.7 KB + 10.0 KB |

- **Self-hosted:** the files are part of the site (`public/fonts/`), not loaded from a font service,
  so no other company sees a visit, the CSP stays `default-src 'self'`, and they work offline. Both
  are under the SIL Open Font License; each folder has its `OFL.txt`, which must stay next to the
  files.
- **Two files per family.** `unicode-range` in `style.css` tells the browser which characters each
  file holds. The Latin file is always loaded (37 KB for both families); the Latin Extended file
  only on a page that really shows such a character (ő, ű, ł, ą …), so in practice for Hungarian and
  Polish.
- **`font-display: swap`:** text shows at once in a system font and changes when the file arrives.
  Every page preloads the two Latin files (`<link rel="preload">` in `<head>`: the browser fetches
  them right away instead of after reading the stylesheet), which keeps that moment short.
- **Offline:** all four files are in the service worker's `PRECACHE` list.
- **Not in the fonts:** the arrows (→ ← ↓ in "Your history →", "← Back", "Change ↓") come from the
  system font. Neither font has the French narrow no-break space (U+202F); the app doesn't use it.
- Digits that change (timer, counters, percentages) use `font-variant-numeric: tabular-nums`, so
  every digit is equally wide and nothing wobbles.

### Type scale

Every font size in `style.css` is one of 13 steps (`--fs-11` … `--fs-48`; the number is the size in
px at the browser's default text size). They are written in `rem`, so they grow with the phone's or
browser's text size setting.

| Token | Size | Used for (examples) |
|---|---|---|
| `--fs-11` | 11px | "BETA" in the language list |
| `--fs-12` | 12px | Badges, "restarted", the label on the motivation card |
| `--fs-13` | 13px | Costume names, the smallest step of the motivation card on landscape phones |
| `--fs-14` | 14px | Small text: taglines, hints, notes, Test sound |
| `--fs-15` | 15px | The language button, the Quick start line, compact buttons on landscape phones |
| `--fs-16` | 16px | Body text and buttons (the default), character names |
| `--fs-18` | 18px | `h2`, the big Start button, "Paused" |
| `--fs-20` | 20px | The editor's group titles, the focus % in the session list |
| `--fs-22` | 22px | The "open in another tab" title, the × of the motivation card |
| `--fs-26` | 26px | The editor's title, the numbers on the history cards |
| `--fs-30` | 30px | `h1` |
| `--fs-40` | 40px | The timer on landscape phones |
| `--fs-48` | 48px | The focus % on the summary |

Two sizes are not steps, on purpose: the timer (`--timer-size`, `--timer-size-wide`: it follows the
screen's width between a smallest and a largest size) and the chart labels (12 units inside the
chart's own drawing, which is scaled with the chart).

### Light and dark

- **The switch** is a pill (84×44px) with a sun on the left and a moon on the right, and an amber
  knob (36px) behind the icon of the theme that's showing; a tap anywhere on it flips the theme, and
  the knob slides 40px (200 ms, no movement with "reduce motion"). It's on the setup screen and the
  history page, in a row of its own above the title, right-aligned: the switch, 8px, the language
  button. Not on the session, summary, editor or privacy screens (they follow the theme too).
  The pair is about 183px wide and the widest title ("La tua cronologia", 251px) is centred in a
  column of at most 600px, so the pair can never sit beside the title without touching it: it has
  its own row at every width, on desktop too.
- **For screen readers and keyboards** it's a `<button role="switch">` called "Dark mode" (in the
  page's language, `darkMode.label`), on (`aria-checked="true"`) in the dark theme. Tab reaches it,
  Enter or Space flips it, and it has a visible focus ring.
- **Which theme:** until the switch is tapped, the app follows the phone's (or browser's) own
  light/dark setting, also when that changes while the app is open. The first tap saves the choice
  as `theme: "light"` or `"dark"` in `ct_prefs_v1` (no new storage key); from then on the phone's
  setting is ignored, on every page. There's no "back to automatic": clearing the site's data does
  that. If the browser won't save, the tap still switches this page.
- **How:** `js/theme.js` sets `data-theme="light"` or `"dark"` on `<html>`, and `style.css` has the
  dark values under `:root[data-theme="dark"]`. If that script can't run, the same dark values
  apply through `@media (prefers-color-scheme: dark)`, so the page still follows the phone.
- **No flash of the wrong theme (no inline scripts):** `js/theme.js` is loaded in `<head>` of all
  five pages as an ordinary script file, before the stylesheet. The browser runs such a script
  before it draws anything, so the theme is already set for the first paint. (The CSP forbids inline
  scripts, so it's a file; the same technique as `js/i18n.js`.) The switch's knob and icon colours
  come from the theme's tokens in CSS, not from the script, so the switch can't show the wrong side
  either.
- **Saving** is read-merge-write like the language: only the `theme` field is written on top of
  what's saved now, and `app.js`'s `savePrefs` keeps it.
- **Other tabs and Back:** a tab follows a tap made in another tab (the `storage` event), and a page
  the browser brings back as it was (Back) reads the choice again.
- **The browser bar** (Android Chrome's address bar): each page has two `theme-color` metas with the
  light and the dark page background. `js/theme.js` gives both the colour of the theme that's
  showing, so the bar also follows a choice that differs from the phone's setting.
- **The installed app's splash screen** uses the manifest's colours (parchment). The manifest is a
  fixed file, so that one screen can't follow the switch.
- `privacy.html`, `about.html` and `stats.html` load `js/theme.js` too, so they show in the same
  theme; they have no switch.

## Layout (screen sizes)

Only `index.html` (the setup and session screens) changes with the screen size. The editor,
history, stats, privacy and about pages keep one column of at most 600px everywhere. All of it is CSS
(media queries at the end of `style.css`); no JavaScript decides the layout.

| Screen | Layout |
|---|---|
| Portrait phones, and portrait tablets of any size (even 1024x1366) | One column, at most 600px wide. This is the original layout and doesn't change. |
| 900px wide or more **and** landscape (laptops, desktops, landscape tablets) | Two columns, at most 1200px in total, centred |
| Landscape **and** under 500px tall (landscape phones, any width) | Two columns, compact |

The media query for two columns is
`(min-width: 900px) and (orientation: landscape), (orientation: landscape) and (max-height: 500px)`.

**Why these breakpoints.** A focus timer is often used on a laptop while studying or working, and
in landscape on phones and tablets. A 600px column uses about a third of a laptop screen, and on a
landscape phone the height is the tight dimension, so the old layout needed scrolling during a session.
900px is where two columns have room. A landscape phone is never more than about 450px tall,
and a landscape tablet or laptop window is taller than 500px, so "under 500px tall" picks out phones.
A portrait tablet keeps the single column: it has plenty of height, and one column reads better there.

**Session screen, two columns.** The character is on the left with the info line ("Grandma ·
Relaxed · Simple · 25 min") and any notes above it. The timer, "Got distracted?" and its buttons,
the motivation card and the Motivate me / Stop bar are on the right, vertically centred. In
`index.html` these two groups are wrapped in `.session-side` and `.session-main`; in portrait the
wrappers are `display: contents` (they make no box), so the single column lays out exactly as
without them. The character fills the left column's height (the screen height minus the page's
padding; `svh`, with `vh` as the fallback for older browsers) and is scaled with
`object-fit: contain`: whatever the art's aspect ratio, it fits inside the box and is never cropped
or stretched. It's anchored at the bottom, where the reaction animations pivot. The timer is bigger
than on a phone.

**Landscape phones (compact).** Everything on the right is tighter (smaller timer, 44px buttons,
less spacing), so the timer, both rows of distraction buttons and the bottom bar fit in about
250px of height without scrolling. A 740x360 phone in Chrome with the address bar showing has about
265px. Advanced mode keeps its 7 lengths on two rows (at least 4 per row). The bottom bar isn't
sticky here (everything fits), and Motivate me doesn't scroll the page (`scrollMotivationIntoView`
skips it on landscape phones).

**Picker and motivation card on landscape phones.** There's no room for them under the buttons,
so they take the place of the distraction buttons block, the question and its buttons, directly
above Motivate me / Stop. The left column (info line, notes, full-size character) is never
covered or resized. During a break the paused text sits over the same block in the same way (in
every layout), and **Resume** takes Motivate me's cell, so nothing moves.

- **One place, one thing at a time.** While the picker or the card is shown, the distraction
  buttons are hidden: they can't be seen, tapped, focused or read out, but they keep their space.
  The block never changes height, so the timer and the bar never move. The buttons come back when
  the picker closes (a category, Skip or its 60-second auto-close) and the card is closed with its ×.
  The card has no auto-close. Undo stays in the bar the whole time.
- **The picker wins.** If the picker opens while the card is open, the card closes. If Motivate me
  is tapped while the picker is open (possible once Undo's 5 seconds are over), the card waits
  under the picker and shows when the picker closes. (On laptops and in portrait both can be open
  at once, as before.)
- **The picker's layout.** It fits the block's height (about 120px): the question on top,
  the six categories in two rows of three, and Skip on the right, as tall as both rows. The category
  labels are a touch smaller, so "Thoughts" fits even on a 568x320 phone. All tap targets are
  still 44px or more.
- **The card's text.** The card is exactly the block's size. If its message doesn't fit,
  `fitMotivationCard` makes the text a step smaller (`fit-1`, then `fit-2`), and only if even that
  doesn't fit does it scroll inside the card. It never grows the block, so it can't push the bar off
  the screen. All current messages fit at the normal size on 740x340, 844x390 and 915x412.
- **Focus (keyboard and screen readers).** As in portrait, a category or Skip sends focus back to
  the distraction button that was pressed. When the picker opens over the button that has
  focus (or over the card), focus moves to Skip, the picker's first control, so it isn't lost.
  If the card is still covering the buttons when the picker closes, focus goes to the card's ×.

How it works: the right column is a CSS grid with three rows (timer, block, bar). The bottom bar
has no box of its own there (`display: contents`), so the picker inside it can be placed over the
block like the card (absolutely positioned in the block's grid area, so they never change its
height). `:has()` hides the buttons while either is shown. The only JavaScript is in `app.js`:
which one wins (`showPicker`), where focus goes (`closePicker`) and the card's text size.
Dialogs get less padding, and anything taller than the screen (step 2 of the continue/restart
dialog on the smallest phones) scrolls inside the dialog.

**Setup screen, two columns.** Step 1 (the character grid) uses the full width (up to 1200px), with
as many cards per row as fit at 150px or more each: 7 on a typical laptop (3 rows for 20 cards),
5 on a landscape phone. Everything else on the setup screen (header, Quick start, the tip cards, steps 2
and 3, the settings and Start session) keeps the 600px column, centred, so lines of text stay short.
The summary and the "open in another tab" notice also keep the 600px column.

**Plans** add two short lines around the timer (the "BREAK" label line and "Block 2/4 · …" under the
timeline). Landscape phones and the two-column layout have room for them; in portrait on short
screens the character gives up their height (see [Plans](#plans)). The planned break's card sits
over the distraction block like the paused text, and **Start now** takes Motivate me's cell.

**Rotating the phone** during a session only switches CSS: nothing is reset, nothing is saved again,
and the timer keeps counting from the start time as always.

## Files

| File | What's in it |
|---|---|
| `public/index.html` | All screens (setup, session, summary, "open in another tab" notice) and dialogs |
| `public/history.html` | Your finished sessions, streaks, time per week and focus trends, Inner weather, and the time capsule |
| `public/avatar.html` | The character editor (see [Custom characters](#custom-characters)) |
| `public/privacy.html` | Privacy page: what stays on the device, what is sent to the server, hosting, your rights (its only script is `js/theme.js`) |
| `public/about.html` | The public About page: what the app does today, English only (its only script is `js/theme.js`; see [About page](#about-page-abouthtml)) |
| `public/robots.txt`, `public/sitemap.xml` | For search engines: crawling allowed everywhere, and the list of pages to index (see [Search engines (SEO)](#search-engines-seo)) |
| `public/stats.html` | Popularity table (not indexed by search engines) |
| `public/js/stats.js` | Loads `/api/stats` and fills in the tables on `stats.html` (a file of its own because the CSP allows no inline scripts) |
| `public/sw.js` | Service worker: offline start, network first with a 3-second fallback to the cache, precache list and cache version (see [Offline use](#offline-use)), and taps on the leave reminder notification |
| `public/js/sw-register.js` | Registers `sw.js` from `index.html`, `history.html` and `avatar.html`; does nothing without service worker support |
| `public/css/style.css` | The one stylesheet: fonts, design tokens (primitives, semantic, component) for the light and the dark theme, the type scale (see [Design system](#design-system)), breathing and reaction animations, the wide and landscape layout (see [Layout](#layout-screen-sizes)) |
| `public/fonts/` | Fraunces 600 and Figtree (woff2, Latin and Latin Extended) with their licence files (`OFL.txt`) |
| `public/js/theme.js` | Light and dark: sets the theme on `<html>` before the first paint, the light/dark switch, the browser bar colour (see [Light and dark](#light-and-dark)) |
| `public/js/data/characters.js` | Character list, groups and the personality each group gives (`personalityOf`), art paths, pose descriptions for screen readers (`POSE_DESCRIPTIONS`) |
| `public/js/data/messages.js` | Motivation messages (each with a fixed `id`) and Simple-mode summary messages per result, in English; their translations are in the language files (also loaded by `history.html`) |
| `public/js/i18n/languages.js` | The languages (code, names, speakers, beta flag, file, Intl settings) and the sheet's order rule (see [Languages](#languages)) |
| `public/js/i18n/en.js`, `public/js/i18n/hu.js`, `es.js`, `pt-BR.js`, `id.js`, `fr.js`, `de.js`, `it.js`, `pl.js` | The texts: English (the UI texts; the data files keep their own English) and every other language (everything) |
| `public/js/i18n.js` | Translation system: language detection, `t()`, plurals, Intl dates, translating the page while it loads, switching |
| `public/js/language-picker.js` | The language button and bottom sheet on the setup screen and the history page |
| `public/js/placeholder-art.js` | Built-in placeholder drawings (kind, firm, strict and ragebait faces, plus each character's look) for characters without real art; its eyes, brows, mouths and extras are shared with custom characters |
| `public/js/avatar-parts.js` | Custom characters' parts: head shapes (`buildHead`), each gender's faces, hairstyles, outfits and accessories, the shared skin tones, hair colours and funny faces, how each is drawn, starting looks, Randomize, and `AVATAR_PNG_FILES` |
| `public/js/avatar-costumes.js` | Costumes: every costume list (headwear, masks, beards, ears and horns, costume outfits, back, held items, pets) and how each is drawn, clashes, Randomize's costume part, and the costume presets |
| `public/js/avatar-art.js` | Draws a custom character from its layers (SVG, or listed PNGs with skin/hair tint) |
| `public/js/custom-characters.js` | Saving and reading `ct_custom_characters_v1`, name rules, the 10 limit, `CUSTOM_PAID`, the feature switch `CUSTOM_CHARACTERS_ENABLED` (and `CUSTOM_CHARACTERS_ON`, which is also true on Netlify's test sites), stand-in for deleted characters (used by all three pages and `stats.html`) |
| `public/js/avatar.js` | The editor on `avatar.html` |
| `public/js/plans.js` | Plans: the switch `PLANS_ENABLED` (and `PLANS_ON`, also true on Netlify's test sites and localhost), the block and break presets and limits, the default break, cleaning saved plans (`cleanPlanRows`, `cleanStoredPlan`), the plan builder in step 3 and the segmented timeline (see [Plans](#plans)) |
| `public/js/capsules.js` | Time capsule data and rules: the switch `CAPSULES_ENABLED` (and `CAPSULES_ON`, also true on Netlify's test sites and localhost), reading and writing `ct_capsules_v1`, the counted session time rule (`countedSessionMs`, `COUNTED_MAX_PER_DAY_MS`), when a capsule is ready, the summary line's check (`announceReadyCapsules`), the ready badge's count (`readyUnopenedCount`, read-only) and the placeholder envelope art (`envelopeArt`). Loaded by `history.html` and `index.html`; uses only `history-store.js` and the i18n files, and touches no DOM when it loads (see [Time capsule](#time-capsule)) |
| `public/js/mood.js` | Inner weather data and rules: the switch `MOOD_ENABLED` (and `MOOD_ON`, also true on Netlify's test sites and localhost), the mood ids, reading and writing `ct_moods_v1` (`loadMoods`, `setMood`, `removeMood`, dropping moods of sessions no longer in the history), the 7-day strip rule (`weekMoods`) and the placeholder mood art (`moodArt`). Loaded by `index.html` and `history.html`; uses only `history-store.js` and the i18n files, and touches no DOM when it loads (see [Inner weather](#inner-weather)) |
| `public/js/date-sheet.js` | The day and time sheet: the bottom sheet behind the time capsule's "Pick a day and time" field (month grid starting on Monday, ‹ › months, dimmed days without an allowed minute, the Time row in 15-minute steps, Set; see [The day and time sheet](#the-day-and-time-sheet)). Loaded by `history.html` |
| `public/js/time-sheet.js` | The custom time sheet: the bottom sheet behind the time capsule's **Custom** chip (Hours and Minutes with − / + and typing, the 15 min – 999 h range, Set; see [The custom time sheet](#the-custom-time-sheet)). Loaded by `history.html` |
| `public/js/duration-sheet.js` | The duration sheet: the bottom sheet a plan row's length and break buttons open (presets, Custom with −/+ and Set; see [The duration sheet](#the-duration-sheet)) |
| `public/js/focus-sound.js` | The focus sound: the list of sounds, generating the noise loops, every sound's level and the volume curve, the generated reverb, and the mixer/player that fades layers and the whole mix in and out (see [Focus sound](#focus-sound)) |
| `public/js/focus-sound-worklet.js` | The 7 Ambient focus sounds, generated live on the browser's audio thread, and the limiter on the mix (an AudioWorklet module, loaded by `focus-sound.js`) |
| `public/js/app.js` | Running a plan (blocks, planned breaks, the plan's summary), timer, reaction engine, distraction category picker, Undo, Stop and breaks (Take a break / Resume), disabled Advanced lengths, time away card, leave reminder notification, motivation rotation, the picker and card in the distraction buttons' place on landscape phones, end chime, when the focus sound plays (its setup row, Preview and the mute button), screen wake lock and the "screen may turn off" note, summary, How it works card, iPhone Home Screen tip, persistent storage request, one tab at a time (Web Locks), the time capsule summary line and ready badge (`renderCapsuleNote`, `renderHistoryBadges`), the summary's "What was the weather like inside?" question (`renderMoodRow`) |
| `public/js/history-store.js` | Saving/loading history, focus % and summary result (with their thresholds; `resultOf` also judges a plan's totals), break totals and the "Paused …" line, distraction categories, export/import checks, iPhone/iPad and iPhone Safari checks, the "can this browser save?" test (`storageWorks`) (used by both pages) |
| `public/js/history.js` | Streaks, weekly time and focus charts, time of day, distraction categories, session list and backup buttons on `history.html`, the time capsule's drawing (ready messages at the top, the section, the form, Open and Delete), and Inner weather's 7-day strip and list icons (`renderMoods`) |
| `netlify/functions/picks.mjs` | `POST /api/picks`: counts one session started with a character |
| `netlify/functions/stats.mjs` | `GET /api/stats`: popularity + which characters are paid |
| `netlify/lib/characters.mjs` | The characters whose picks are counted (id + name); a new character must be added here |
| `netlify/lib/picks-store.mjs` | Which Blobs store the counts are in (live or test) and the UTC day helper |
| `test-data/` | Small export files for testing Import (not deployed, see `test-data/README.md`) |
| `tools/export-texts.mjs` | Writes every text of every language into `docs/texts/` for review (Node, no dependencies; not deployed, see [Exporting the texts for review](#exporting-the-texts-for-review)) |
| `docs/texts/` | The generated review tables: `en.md` (with the privacy and About pages' text) and one file per other language. Never edited by hand |
| `public/manifest.webmanifest` | Web app manifest: name, colors and icons for Add to Home Screen / Install |
| `public/icons/` | App icons (the logo): `icon.svg` and `icon-small.svg` (sources) and the PNGs rendered from them (Home Screen, Android, maskable) |
| `public/favicon.ico` | Browser tab icon (crosshair with a dot, from `icons/icon-small.svg`) |
| `netlify.toml` | Tells Netlify the site is in `public/`, the redirect from the old Netlify addresses to https://concentraining.com, the security headers and CSP, `Cache-Control: no-cache` for `sw.js` (see [Domain, redirect and security headers](#domain-redirect-and-security-headers)), and the `noindex` header for branch deploys (see [Search engines (SEO)](#search-engines-seo)) |
| `.github/workflows/pages.yml` | Optional backup: publishes a copy of `public/` (every page with `noindex`) to the GitHub Pages test site on every push to `main` (see [GitHub Pages backup test site](#github-pages-backup-test-site-optional)) |
| `package.json` | The one dependency the functions need (`@netlify/blobs`) |

## Adding real character artwork

Each character needs one set of 9 poses, drawn in its own personality. Put the images in a folder like this:

```
public/assets/characters/grandma/initial.png
public/assets/characters/grandma/level1.png   … level5.png
public/assets/characters/grandma/good.png
public/assets/characters/grandma/blink.png
public/assets/characters/grandma/refocus.png
```

Then set `artPath: "assets/characters/grandma"` (relative to `public/`) for that character in `public/js/data/characters.js`
(and `artExt` if you use `.webp` or `.jpg`). Any missing image falls back to the placeholder drawing,
so you can add them one by one. Use the same canvas size for all poses so blinking doesn't make the image jump.
Any portrait aspect ratio works: on wide and landscape screens the session image is scaled to fit
the space left (`object-fit: contain`), never cropped or stretched (see [Layout](#layout-screen-sizes)).

## Popularity stats (backend)

Every press of **Start session** sends `POST /api/picks` once for the chosen character, whether or
not the session gets finished. Browsing the cards, tapping the same card again, a cancelled ragebait
warning, **Start over** (same character, not a new choice) and a reload that restores a running
session don't count.
Counts are stored per character per day (UTC) in **Netlify Blobs** (a simple key–value storage
on Netlify: the functions save and read named pieces of data, with no database server running), so
popularity can be measured over the **last 30 days** and the paid selection rotates as tastes change.

- `GET /api/stats` returns every built-in character's recent and all-time picks, plus
  `paidCharacterIds`: empty until there are at least 10 built-in characters, then the top ~10% by
  recent picks.
- **Custom characters** all count under one id, `"custom"` (in `netlify/lib/characters.mjs` with
  `custom: true`): the app never sends the user's own ids or names. They're always paid, so
  `"custom"` is left out of the ranking and of the character count, and comes separately as
  `customPicks: { recentPicks, totalPicks }`. `/stats.html` shows it in its own table, "Custom
  characters (always paid)", but only while custom characters are on (`CUSTOM_CHARACTERS_ON`; it
  loads `js/custom-characters.js` for that), so on Deploy Previews and the main branch deploy too.
  It also returns `store`: `"live"` or `"test"` (see below). The numbers are at `/stats.html`,
  which says which store it's reading.
- **One blob per character:** the key is the character id (`grandma`), the value is the picks per
  day, e.g. `{ "days": { "2026-11-03": 5, "2026-11-04": 2 } }`. `/api/stats` reads the 20 blobs (19 characters and `custom`).
- **Picks at the same moment aren't lost:** `POST /api/picks` reads the character's blob together
  with its `etag` (an id of that exact version), adds 1 to today, and saves only if the blob is
  still that version (a conditional write: `onlyIfMatch`, or `onlyIfNew` for the very first pick).
  If another pick for the same character was saved in between, Blobs refuses the write and the
  function reads again and retries, up to 8 times, with a random wait that doubles each time
  (so a burst of picks spreads out instead of colliding again). Only picks for the
  **same** character at the **same** moment can collide. If all 8 attempts collide (only under a
  big burst of simultaneous picks) it answers `503` and logs an error; the app ignores that, so
  that one pick isn't counted. Reads use `strong` consistency, so they always see the latest write.
- **Live and test counts are separate:** the production deploy (the `live` branch) uses the
  `picks-live` store; Deploy Previews, the `main` branch deploy and `netlify dev` use `picks-test`.
  So **Start session** on https://main--concentraining.netlify.app or a Deploy Preview never changes
  the live numbers. Both stores are visible in the Netlify UI under **Data & Storage → Blobs**.
- **Counting restarted from zero** with the move from Netlify Database to Blobs (November 2026). The
  old database counts (mostly test taps; before 2026-10-21 every tap on a character card counted)
  were not copied over. `/stats.html` notes this.
- Only characters listed in `netlify/lib/characters.mjs` are counted (others get `404`), and each
  IP address can send at most 30 picks per minute, so the numbers are hard to fake.
- **Adding a character:** besides `public/js/data/characters.js`, add it with the same id to
  `CHARACTERS` in `netlify/lib/characters.mjs`, e.g. `{ id: "robot", name: "Robot" }`. Without that
  its picks are refused and it doesn't appear on `/stats.html`.
- With 19 built-in characters the paid selection is active: the top 2 by recent picks (**Start
  session** presses) are marked "(paid)" on `/stats.html` (19 × 10% = 1.9, rounded to 2; it becomes
  3 at 25 built-in characters). New characters start with 0 picks. `"custom"` doesn't count here
  (see above).
- Settings (30 days, 10 characters, 10%) are constants at the top of `netlify/functions/stats.mjs`.
- **Cost:** every pick and every stats load is one function call (web request + a short compute
  time, billed in Netlify credits). Blobs has no server that wakes up and no separate copy per
  Deploy Preview. Netlify's credit table doesn't list Blobs as its own meter; check the **Usage**
  page after the first days to be sure.

**Checking that counting works** (on https://main--concentraining.netlify.app or a Deploy Preview):
open `/stats.html` and check it says "Reading the test counts"; start two sessions with the **same**
character and one with another; wait a minute (the stats are cached for 60 seconds) and reload
`/stats.html`: the first character has gone up by 2 and the other by 1, in both columns. The live
site's `/stats.html` still says "Reading the live counts" and its numbers haven't changed.

**`netlify dev` (local):** its local Blobs server doesn't send etags when reading, so only the first
pick per character is saved there; later ones fail with an error on purpose (a write without an etag
could overwrite another pick). The deployed sites aren't affected.

## Deploying

Connect this GitHub repo to the Netlify site (Site configuration → Build & deploy → Link repository).
Leave the build command empty; `netlify.toml` already sets the publish directory to `public` (and a
one-line build command for branch deploys only, see [Search engines (SEO)](#search-engines-seo)).
On every push Netlify installs `package.json` and deploys the functions. The Blobs stores are
created automatically by the first pick.

**Branches.** The live site deploys only from the `live` branch (Netlify's production branch).
`main` is the development branch and the target of every pull request:

- Pull requests into `main` get a Deploy Preview for testing.
- Each push to `main` (for example a merged pull request) updates the branch deploy at
  https://main--concentraining.netlify.app. This does **not** change the live site.
- To release, open a pull request from `main` into `live` and merge it with **Create a merge commit**,
  never **Squash and merge**; that runs the production deploy. Squashing gives `live` a new commit that
  `main` doesn't have, so the next `main` → `live` pull request shows the old changes again and can
  conflict.

**Deploy Previews and the main branch deploy count separately.** They all share one test store
(`picks-test`), so **Start session** presses there never change the live numbers, and their
`/stats.html` says "Reading the test counts". Only the production deploy (`live`) uses
`picks-live`. The test counts are shared by every preview and `main`, so they mix test runs; that's
fine for checking that counting works.

### Domain, redirect and security headers

**The official address is https://concentraining.com** (Netlify DNS, the site's primary domain;
`www.concentraining.com` redirects to it in Netlify's domain settings). Live and test counting
doesn't depend on the address: it follows Netlify's deploy context, so the custom domain (the
production deploy) counts into `picks-live`.

**Redirect** (`[[redirects]]` in `netlify.toml`): `https://concentraining.netlify.app/*` and
`https://live--concentraining.netlify.app/*` (the production branch's own address) send a permanent
**301** redirect to the same path on https://concentraining.com. `force = true` makes it apply even
where a file exists. A domain rule only matches that exact host, so these are **not** redirected:
Deploy Previews (`deploy-preview-N--concentraining.netlify.app`), the main branch deploy
(`main--concentraining.netlify.app`) and the GitHub Pages copy (which doesn't read `netlify.toml`).
Custom characters aren't affected: `CUSTOM_CHARACTERS_ENABLED` is on for the new domain, and the
test-site hostname check still matches the previews and `main--`.
- Saved data belongs to an address: history, settings and custom characters saved on
  `concentraining.netlify.app` stay there and don't move to `concentraining.com`. Since the
  redirect, the old address can't be opened any more (that was decided: only test data was there).
  A Home Screen app added from the old address opens the new site; add it again from the new one.

**Canonical address and link previews.** `index.html`, `history.html`, `privacy.html` and `about.html` have
`<link rel="canonical">` with their https://concentraining.com address (`index.html` →
`https://concentraining.com/`, `history.html` → `https://concentraining.com/history`,
`privacy.html` → `https://concentraining.com/privacy`, `about.html` → `https://concentraining.com/about`: Netlify serves a page without `.html` and,
with Pretty URLs on, redirects the `.html` address there, so the canonical address is never a
redirect), so search engines treat every copy (including GitHub Pages) as that one. `stats.html` and `avatar.html` have `noindex` instead (not pages for search results), and no
canonical. The same four pages have Open Graph and Twitter card tags (`og:title`,
`og:description` = the page's meta description, `og:url` = the canonical address, `og:image`,
`twitter:card` = `summary`), which apps like Messenger use for the preview of a shared link.
- **The preview image is the app icon** (`https://concentraining.com/icons/icon-512.png`,
  512×512). If it's ever swapped for another image, update `og:image`, `og:image:width`,
  `og:image:height` and `og:image:alt` on all four pages.
- Messenger, Facebook and others keep a copy of a preview for a while. After changing the tags,
  Facebook's Sharing Debugger (https://developers.facebook.com/tools/debug/) shows the new one and
  can refresh it.

**Security headers** (`[[headers]] for = "/*"` in `netlify.toml`, on every Netlify deploy, including
Deploy Previews; GitHub Pages can't send headers):

| Header | Value | What it does |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Files are only used as the type the server says they are |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Links to other sites only tell them "concentraining.com", never the page's full address |
| `X-Frame-Options` | `DENY` | No other site can show the app inside a frame (older browsers; newer ones use `frame-ancestors`) |
| `Permissions-Policy` | camera, microphone, geolocation, payment, USB, serial, HID, MIDI, motion sensors, fullscreen, … `=()` | Browser features the app never uses are switched off. `screen-wake-lock=(self)` stays on (the screen stays on during a session). Notifications, sound and vibration aren't controlled by this header |
| `Strict-Transport-Security` | `max-age=31536000` | Browsers use only https for this site for a year. No `preload` and no `includeSubDomains`. On `*.netlify.app` addresses (Deploy Previews, `main--`) Netlify sends its own stricter value instead (`includeSubDomains; preload`, the whole netlify.app domain is https-only); that doesn't affect concentraining.com |
| `Content-Security-Policy` | see below | Which files the pages may load |

**Content-Security-Policy (CSP)**, enforced:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:;
connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'
```

- Everything comes from the site's own files (`'self'`): scripts, the stylesheet, `fetch` calls
  (`api/picks`, `api/stats`, the avatar PNGs in `assets/avatar/`), the manifest and the service
  worker. No other site is ever contacted.
- **No inline scripts and no inline styles.** That's why `stats.html`'s script is in
  `js/stats.js`. No page or generated SVG uses `style="…"` or `<style>`; the code only sets styles
  through `element.style` (e.g. the progress bar width), which the CSP allows. So `style-src` needs
  no `'unsafe-inline'`. **Keep it that way:** a new inline `<script>` or `style="…"` is blocked
  (check the browser console for "Content Security Policy" errors).
- `img-src` also allows `data:` and `blob:`: the character art is SVG drawn by code and shown as a
  `data:` URL (custom characters' PNG layers are written into it as `data:` URLs too), and the
  setup screen's checkmark in `style.css` is a `data:` image.
- Not limited by the CSP: the end chime (Web Audio), the leave reminder notification, the export
  download (a `blob:` link) and the import (the file is read in the page).
- **Netlify's Deploy Preview toolbar is blocked** (it's a script from another site), so it doesn't
  show on Deploy Previews and the console shows Netlify's own CSP error for it. That's expected; the
  toolbar can also be switched off in the Netlify project's Deploy Preview settings.

### Search engines (SEO)

Goal: searching "concentraining" or "ConcenTraining" shows https://concentraining.com first, search
engines and AI assistants know what the app does today, and **only concentraining.com is ever
indexed** (never the GitHub Pages copy or a Netlify test address).

- **`public/robots.txt`** allows crawling of everything and names the sitemap. Pages with `noindex`
  are deliberately **not** blocked there: a search engine has to be able to open a page to see its
  `noindex`.
- **`public/sitemap.xml`** lists the indexable pages with their absolute concentraining.com
  addresses: `/`, `/about`, `/history`, `/privacy`. Not `avatar.html` or `stats.html` (`noindex`).
  It has no `<lastmod>`, because there's no real date to put there. Add a page here when a new
  indexable page is added.
- **`index.html`**: the title is "ConcenTraining – Focus timer with characters" (not translated;
  during a session the tab shows the clock before "ConcenTraining", and `app.js` puts this title back
  afterwards, `PAGE_TITLE`). The meta description (also `og:description`, English, static): "A focus
  timer with characters that react when you get distracted. Plan your session, create your own
  character, use it in 9 languages." No price and no "free".
- **Structured data (JSON-LD)** in `index.html`: one `<script type="application/ld+json">` in the
  HTML itself with a `WebSite` and a `WebApplication` (name, address, the same description,
  `UtilitiesApplication`, `operatingSystem` "Any", "Requires JavaScript", the 9 language codes). It's a
  data block that is never run, so the CSP (`script-src 'self'`) doesn't block it and didn't change.
  Only true facts: no offers, prices or ratings.
- **The About page** (`about.html`, see [About page](#about-page-abouthtml)) is the readable
  description of today's features. Keep it, the meta description and the JSON-LD true whenever a
  feature changes (a rule in `CLAUDE.md`).
- **Only concentraining.com is indexed:**

  | Address | How it stays out of search results |
  |---|---|
  | `concentraining.netlify.app`, `live--concentraining.netlify.app` | 301 redirect to concentraining.com |
  | Deploy Previews (`deploy-preview-N--…`) | Netlify sends `X-Robots-Tag: noindex` itself |
  | The main branch deploy (`main--concentraining.netlify.app`) | `[context.branch-deploy]` in `netlify.toml`: a one-line build command writes `public/_headers` (Netlify's file of extra headers) with `X-Robots-Tag: noindex` for every file, on that deploy's build machine only. Production (`live`) uses the production context and never runs it |
  | GitHub Pages copy | the workflow adds `<meta name="robots" content="noindex">` to every page of the uploaded copy |
  | All of them | the canonical tags point to concentraining.com |

  To check the branch deploy's header after a push to `main`: open
  https://main--concentraining.netlify.app on a computer, DevTools (F12) → **Network** → reload →
  click the first request → **Response Headers** should list `x-robots-tag: noindex`. The same check
  on https://concentraining.com must **not** show it.

**Google Search Console** (free; tells Google about the site and shows how it's indexed). Once:

1. Open https://search.google.com/search-console, **Add property** → **Domain** →
   `concentraining.com`.
2. Google shows a TXT record. In Netlify: **Domains** → `concentraining.com` → **DNS settings** →
   **Add new record**: type `TXT`, name `@`, value the text from Google. Back in Search Console,
   **Verify** (it can take a few minutes up to a day).
3. **Sitemaps** → enter `sitemap.xml` → **Submit**.
4. **URL Inspection** → `https://concentraining.com/` → **Request indexing**; the same for
   `https://concentraining.com/about`.
5. Optional: Bing Webmaster Tools (https://www.bing.com/webmasters) can import the site from Search
   Console in one step; Bing's index is also used by other search engines and assistants.

New pages usually show up within days to a few weeks. To check the structured data, paste
https://concentraining.com/ into https://search.google.com/test/rich-results and
https://validator.schema.org/ (the second one also shows the `WebSite` and `WebApplication` details;
the first may say no rich result type applies, which is fine as long as it reports no errors).

### GitHub Pages backup test site (optional)

The normal way to test is the Netlify Deploy Preview of each pull request (and the `main` branch
deploy after merging). The GitHub Pages site is a free backup copy of `main`, for example if Netlify
pauses the account again (it did until 2 November 2026, after hitting the usage limit). You don't
need it for everyday testing.

- **Backup site:** https://kantorhorvathambrus-source.github.io/ConcenTraining/, published from `main`.
- **How it's published:** a GitHub Actions workflow (`.github/workflows/pages.yml`: a small file
  that tells GitHub to run steps on its own servers when something happens) uploads a copy of
  `public/` on every push to `main`, with no build step. The only change in the copy: every page gets
  `<meta name="robots" content="noindex">` right after `<head>` (unless it already has a robots tag),
  so search engines never list this duplicate; the workflow stops if any page is left without one.
  The files in the repository are never changed. It can also be started by hand: **Actions** tab →
  **Deploy to GitHub Pages** → **Run workflow**. The repo's Pages setting must stay on
  **Source: GitHub Actions**.
- **If Netlify is paused:** there are no Deploy Previews and no `main` branch deploy. Pull requests
  into `main` can then be merged without a Deploy Preview and tested on the GitHub Pages site
  afterwards. That's safe because `main` isn't the live site; the live site only changes through a
  `main` → `live` pull request (which has to wait for Netlify).
- **No backend there:** the Netlify Functions don't run on Pages, so `POST api/picks` gets a 404 and
  is ignored (no session is counted, the app works the same), and `stats.html` shows its
  "Couldn't load stats" message.
- **Subpath:** the site runs under `/ConcenTraining/`, not the domain root. Every path in `public/`
  is relative and the service worker works relative to its scope (see [Offline use](#offline-use)),
  so the app, history and offline start work the same as on Netlify.
- **Separate saved data:** it's a different address from the Netlify sites, so its history,
  settings and offline cache are separate too.
- **noindex and canonical tags, no headers:** its pages carry `noindex` (above) and point search
  engines to https://concentraining.com (`<link rel="canonical">`); the security headers and CSP
  from `netlify.toml` don't apply there. Its `robots.txt` is at `/ConcenTraining/robots.txt`, where
  crawlers never look (they only read it at the domain root), so crawling isn't blocked and the
  `noindex` can be seen.
- **Doesn't affect Netlify:** the workflow only publishes to GitHub Pages and can be deleted any
  time without changing the Netlify sites.
