# ConcenTraining

A focus/study timer where a character reacts when you log a distraction.
Plain HTML, CSS and vanilla JS: no build step, no framework. The website is the
`public/` folder (open `public/index.html` in a browser to try it). The backend is two
Netlify Functions that store counts in Netlify Blobs, used only for character popularity stats.

## How it works

- **How it works card:** at the top of the setup screen (above step 1) a short card explains the
  app in 4 points: pick a character and a timer; when you notice your mind has wandered, tap how much
  (Simple) or how long (Advanced), the character reacts with a pose, never with words, and noticing
  and coming back is the skill being trained; leaving the app during a session brings a "were you
  distracted?" question; the history is saved automatically on this device, and Export on the
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
  one line like "Boss · Advanced · 25 min" (character · Simple/Advanced · minutes), a small grey
  underlined **Change ↓** under that line and a **Start** button. **Change ↓** is for anyone who
  doesn't realise the setup can be changed further down: it scrolls to step 1 (`scrollToStep`, an
  instant jump with reduced motion) and changes nothing else. The card only shows when the saved
  character still exists and the history has at least one session, so a brand-new user (or someone
  who deleted all their history) never sees it. It always shows the current setup, i.e. exactly
  what **Start session** would start, and follows every change
  further down at once (character card, mode, chip, Custom field). The minutes are corrected the way
  Start corrects them: while "300" is typed in the Custom field the card says 240 min, an empty
  field says 25 min. **Start** runs the same code as **Start session** (`onStartClick(true)` in
  `public/js/app.js`): same checks, same one-tab-at-a-time rules, a ragebait character saved earlier
  doesn't warn again, and a quick double tap starts one session. If the tap corrected the Custom
  field ("Max. 240 min." etc.), nothing starts and the page scrolls to step 3 so the message is
  visible (an instant jump with reduced motion); the next tap starts. It's checked again whenever
  the setup screen is shown (after a session, Discard, End without saving, a reload), when the page
  comes back from the browser's back/forward cache, and when another tab changes the history. No
  setting and nothing new saved: it only reads `ct_prefs_v1` and `ct_history_v1`. The image box has
  a fixed size (56 px wide, 200:240) with `object-fit: contain`, so nothing moves when the image
  loads and real artwork fits the same slot. At 320 × 568 the header and the whole card fit on the
  first screen.
- **Setup:** 1. pick a character, 2. a mode (Simple / Advanced), 3. a focus duration.
  The character decides the personality (see below). Ragebait characters show a warning before
  they can be selected. Selecting a card only updates which card is pressed (`aria-pressed`), so
  keyboard and screen reader focus stays on it, also after the ragebait warning (**Bring it on** or
  **Pick someone else**). Tapping Start session without a character shows "Pick a character first."
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
  only shown where it can work (not on iPhone or iPad); see [Leave reminder](#leave-reminder).
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
  - **Images:** the session and summary images have the same descriptions as their alt
    ("Grandma, calm and smiling."), following the pose, so you can check the character any time by
    moving to it. Blinks don't change the alt.
  - **Screens:** when a session starts (Start session, Start on the Quick start card, Start new session, Continue here, or a reload), focus
    moves to the session info line ("Grandma · Relaxed · Simple · 25 min"); when it ends (End
    session, timer ran out, Save in "Welcome back"), focus moves to the summary title. Whenever "This session is open in another tab." shows
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
- **Simple mode:** 5 severity buttons (A flicker, Drifted, Lost track, Far away, Totally gone), not
  time-based. They always sit in two full rows: three in the first, two wider ones in the second.
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
  and **End session** stays next to it the whole time. The button counts down the seconds in its
  label ("Undo · 5" … "Undo · 1"), then Motivate me comes back. The countdown is on the button, not
  a bar, so it isn't mistaken for a time limit on the category picker right above it (the picker
  has none). Screen readers hear just "Undo" (the number is hidden from them). If Undo has keyboard
  focus when it goes away, focus moves to Motivate me in the same spot (and from Motivate me to Undo
  when Undo appears). Undo takes back
  only the latest distraction: it's removed from the session, the reaction (or the refocus step after
  it) stops and the character goes back to its normal pose, the category picker closes, the "doing well" timer is set back to what it
  was before the tap, and the session is saved. A new tap inside the 5 s moves Undo to the new
  distraction and starts the 5 s again. After a reload there's no Undo.
- **Tap guard:** a tap that comes less than 0.4 s after the previous accepted tap is ignored everywhere in the app (`TAP_GUARD_MS` in `public/js/app.js`), so an accidental double tap never logs twice or presses what appears under the finger; keyboard and screen reader activation, Undo, text fields and checkbox labels are never blocked.
- **Distraction categories:** after each distraction button, once the reaction has played (1.4 s,
  `PICKER_DELAY_MS`), a small picker appears above the bottom buttons: "What distracted you?" with
  Screen, Thoughts, Noise, People, Tired, Other, and a grey **Skip** button on the right. There's no
  countdown: it stays open until a category or Skip is tapped. A tapped category is saved with the
  distraction; Skip saves `category: null` (a category is never guessed). As a safety net, if
  nothing is tapped (e.g. the phone was put down), it closes silently after 60 s
  (`PICKER_AUTO_CLOSE_MS`), also with `null`, so it doesn't stay up for the rest of the session
  (both constants are at the top of `public/js/app.js`). Tapping another distraction button replaces
  the picker (the earlier distraction keeps `null`); **Undo**, ending the session and the timer running
  out close it. Tapping **End session** only pauses it (also during the 5 s Undo window, or before
  the picker has appeared: then it appears after **Keep going**, with the full 60 s): it waits behind the question with its 60 s
  stopped, so its safety close can't open the continue/restart question on top of it. After **Keep
  going** it's back with the time it had left, or closes then if its 60 s would have run out meanwhile. On small phones the open picker covers some of the distraction buttons (never the
  character or the timer); tap a category or Skip first, or scroll down, to log another one.
- **"Totally gone" / "10+ min"** asks: continue this session, or start over with a new duration.
  The question comes in two steps of one dialog, so the duration chips can't be read as "how long
  was the distraction?" (the app never asks that):
  - **Step 1** asks only continue or start over. Simple mode (which has no times): "That was a big
    distraction" / "Keep going with this session, or start fresh? After a big distraction, starting
    over is often easier." Advanced mode: "That was a long break" / "Keep going with this session, or
    start fresh? After a long break, starting over is often easier." Buttons: **Continue this
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
  (an earlier "10+ min" / "Totally gone" that wasn't undone still asks, right after the Undo). The
  question is saved with the running session (`restartPending`) as soon as the button is tapped, so if
  the page is reloaded before it's answered, it's asked right after the reload.
  If the session has run at least 1 minute, step 2 also has a checkbox above **Start new session**:
  "Save the first 12 min 30 sec to history" (the time so far, measured when the dialog first opens,
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
- **End session** asks "End this session now?". If the session has run at least 1 minute (measured
  when the dialog opens), the dialog also has a checkbox: "Save this session to your history",
  ticked every time the dialog opens (it isn't remembered). Unticked means "this session doesn't
  count": **End session** ends it, saves nothing (and doesn't request persistent storage), and goes
  straight back to the setup screen with no summary, like **Discard** in the "Welcome back" dialog.
  The setup keeps the last character, mode and length. Under 1 minute there's no checkbox (nothing is
  saved anyway, and the summary is shown as before). If the timer runs out while the dialog is open,
  the session is saved as a full session.
  Tapped during the 5 s Undo window, it closes Undo first: the distraction stays logged and Undo
  doesn't come back after **Keep going**. A waiting continue/restart question doesn't open on top of
  the dialog; after Keep going it opens once the category picker has closed, as usual.
- **Time away:** if the page is hidden during a running session (another app, another tab, or a
  locked screen; the browser can't tell these apart, so the wording stays neutral) and you come back
  after at least 15 s (`AWAY_MIN_MS` in `public/js/history-store.js`), a card at the bottom of the
  screen asks "You were away for 2 min 15 sec. Were you distracted?" (measured to the second). Under
  15 s nothing happens. Nothing is ever logged without a tap. With **Remind me if I leave the app**
  on, a system notification also comes after 15 s away; it doesn't change anything here (see
  [Leave reminder](#leave-reminder)).
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
  - The timer check comes first: if the session ran out while you were away, the end (summary, or the
    "Welcome back" question) happens as before and there's no card. If it runs out while the card is
    open, the card closes and nothing is logged.
  - If End session's question or the continue/restart question was open when you left, it stays and
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
| A flicker | 30 sec | level1 |
| Drifted | 1 min | level2 |
| Lost track | 2 min, 3 min | level3 |
| Far away | 5 min, 10 min | level4 |
| Totally gone | 10+ min | level5 |

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
  (see "Summary result" below). It also shows the session's top 3 picked categories, e.g.
  "Most common distractions: Screen (2), Thoughts (1)". Hidden if nothing was picked.
  Times are shown with seconds when there are any ("24 min 30 sec out of 25 min").
  In Advanced mode, a session ended before the timer ran out also shows its planned length:
  "You focused for 28 min out of 30 min (60 min planned), with 2 distractions logged."
  Simple mode shows the character's sentence (see "Summary result" below) and, under it, a factual
  line: "Your session ran 24 min 30 sec (25 min planned), with 3 distractions logged." Simple mode has
  no distraction lengths, so this is the session's length (distractions included), never "focused"
  time; "(… planned)" follows the same rule as in Advanced mode. A session under 1 minute only shows
  the title and the "not saved" note (no focus %, sentence, factual line or categories).
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
  distraction scores its level (A flicker = 1, Drifted = 2, Lost track = 3, Far away = 4,
  Totally gone = 5). The points are counted per 25 minutes of session time; sessions shorter than
  25 minutes count as 25 minutes. **great** up to 2 points per 25 min (`SIMPLE_GREAT_POINTS`),
  **rough** from 8 (`SIMPLE_ROUGH_POINTS`), **okay** in between. Example: two "Far away" in a 25-minute
  session = 8 points = rough. Short sessions are judged like a 25-minute one on purpose, so they
  aren't harsher: one "Lost track" in a 5-minute session = 3 points = okay (one "Drifted" = great).
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
don't use it.

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
  - Both cases work the same in Simple and Advanced mode. A continue/restart question that was
    still waiting is dropped, as before, and so is the time away card.
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
  session ends or is stopped, and on the setup and summary screens. The browser drops it whenever the
  page is hidden (another tab or app), so it's asked for again when the page is visible. After a reload
  the browser may refuse it until the first tap, so taps during a session ask again. Browsers without
  support (or a refused request, e.g. in battery saver mode) just carry on without it. Needs HTTPS,
  so it doesn't work when `index.html` is opened as a local file.
- **"Your screen may turn off" note:** while a session is on screen with **Play a sound when time's
  up** on, but the screen isn't being kept on (the setting is off, the browser doesn't support Screen
  Wake Lock, the request was refused, or the browser released the lock and getting it again failed),
  a small muted line under the session info says: "Your screen may turn off. If it does, you won't
  hear the chime." It's in the page flow, so it never covers the character, the timer or the buttons.
  It disappears as soon as the lock is held (e.g. after the first tap following a reload). It's never
  shown with the sound off, or on the setup and summary screens. While a lock request is out, or the
  page is hidden, it stays as it is, so it doesn't blink on every tap or return (`updateScreenNote()`
  in `public/js/app.js`).

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
  file. It's also hidden on every iPhone and iPad (`isIOS()` in `public/js/history-store.js`), even in
  the Home Screen app: iOS pauses a web app almost as soon as it's left, so the reminder wouldn't come.
- **When:** the page is hidden during a running session (another app, another tab, the home screen,
  a locked screen) and is still hidden 15 s later (`AWAY_ASK_AFTER_MS`, the time away card's
  threshold): one notification.
  - Title: "Your session is still running". Text: "Is this part of what you're focusing on? Tap to go
    back." Icon: `icons/icon-192.png`.
  - At most one per leave, and it has a tag (`ct-leave-reminder`): a new one replaces an old one, so
    there's never more than one.
  - Not shown if the session has 15 s or less left when you leave (the end chime and summary come
    instead), if it ended meanwhile, or in a tab that doesn't run the session (see
    [Several tabs](#several-tabs-one-tab-at-a-time)). Not during the "Welcome back" question either.
  - It's the app speaking, like the time away card; characters never use text.
- **Coming back** (by tapping the notification or any other way) closes it if it's still there.
  It also closes when the session ends while you're away, and when the app starts (e.g. after the
  browser discarded the page and the tap reloaded it). The time away card then works exactly as
  before. The notification itself never logs anything.
- **Tapping it:** the service worker closes it and brings back the open app page (`notificationclick`
  in `public/sw.js`), or opens the app if no app page is open. That picks the session up like a
  reload. The address comes from the service worker's scope, so it works at the domain root and under
  `/ConcenTraining/`. It's shown through the service worker (`registration.showNotification`),
  because `new Notification()` doesn't work on Android Chrome.
- **How reliable it is:** it runs on a 15 s timer in the hidden page. No push, no backend.
  - Chrome runs timers in hidden pages at most once a second for the first 5 minutes, so it normally
    comes at about 15-16 s.
  - If Android freezes or closes the browser before then (low memory, battery saver, aggressive power
    settings on some phones) or discards the tab, the reminder doesn't come. The time away card still
    works on return.
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
  session is finished or discarded. The lock lives only in the browser's memory: nothing is saved
  under it, and no saved data or storage key changed.
- **The other tabs** show a calm notice instead of the session: "This session is open in another tab."
  with a **Continue here** button. They run no timers, reactions, sounds, wake lock or time away card,
  and save nothing. Focus moves to the notice's heading, so a screen reader reads it.
- **A tab on the setup screen switches to the notice by itself** as soon as another tab runs a
  session, so you don't have to tap Start to find out. Two things trigger it:
  - the `storage` event for `ct_session_v1` (the browser sends it to the other tabs whenever saved
    data changes), if a running session is saved;
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

## Personalities

There's no style to choose: each character's `group` in `public/js/data/characters.js` decides its
personality, in one place (`GROUPS` and `personalityOf()`). A new character only needs a `group`.

| Group | Personality | How it reacts |
|---|---|---|
| `relaxed` (Grandma, Leader, Santa, Study Buddy, Coach, Meditation Guide), label "Relaxed" | `kind` | Happy you're back, cheers you on. Hops. |
| `firm` (Professor, Librarian, Surgeon), label "Firm but fair" | `firm` | Patient, but expects your best. Never shouts or gets angry: disappointment instead. One slow, calm lean (never shakes); a small nod when you do well. |
| `strict` (Boss, Soldier, Headmistress, Grandmaster) | `strict` | Stern when you drift off, angrier each level. Shakes. |
| `ragebait` (Bodybuilder, Influencer) | `ragebait` | Annoying on purpose: mocking, more insulting each level. Cheeky head tilt. |

The app always shows the group's label ("Relaxed", "Firm but fair", "Strict", "Ragebait"): on the
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
| refocus | "Whatever, go on": bored half-closed eyes, one eyebrow up, flat "meh" mouth, a lazy point at the work. No insult |

The refocus pose ("OK, back to work"), shown for a moment after every distraction reaction. It's not
praise (that's `good`) and not a reaction to the distraction:

| Personality | Refocus pose |
|---|---|
| kind | Warm and encouraging: happy closed-arc eyes, soft brows, smile. No pointing hand |
| firm | Calm and expectant: both brows slightly up, small smile, pointing down at the work. Never angry |
| strict | Firm and neutral, "get on with it": narrowed eyes, level brows, flat mouth, pointing down at the work. No anger, vein or steam |
| ragebait | Bored "whatever, go on": half-closed eyes, one eyebrow up, "meh" mouth, pointing down at the work. No middle finger, no insult |

## Session history (`history.html`)

Every finished session (timer ran out or **End session** pressed) that ran at least 1 minute is saved
on the device, except one ended with "Save this session to your history" unticked, and one you chose to **Discard** after coming back long after it ended (see above). A session abandoned with **Start over** is saved too, unless its "Save the first …
to history" checkbox was unticked (see above). The page shows:

- **Current and longest streak:** days (local time) with at least one finished session.
  The current streak stays alive until today is over, even if you haven't finished a session yet today.
- **Time per week:** an SVG bar chart of the time spent in sessions (Simple and Advanced) in the
  same 12 weeks as the focus trend, by the week a session started. The axis is in minutes while the
  busiest week is under 2 hours, in hours above that. This week's bar is full color, earlier weeks
  are lighter, and the line under it says e.g. "This week: 2 h 15 min across 6 sessions." With no
  sessions in those 12 weeks it only says "No sessions in the last 12 weeks."
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
  by **Start over** have a small "restarted" label. The title says "Last 30 sessions (of N)" once
  there are more than 30, otherwise "N sessions". See [Deleting a session](#deleting-a-session).
- **Backup:** "Your sessions are saved automatically on this device. Export a copy if you switch
  phones or clear your browser data.", then Export and Import buttons (see below).

Simple-mode sessions have no focus % (their buttons aren't time-based). They count for streaks and
time per week and appear in the list as "—", but are left out of the focus trend and time-of-day
numbers.

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
- another tab saves, deletes or imports sessions, or all site data is cleared there (the `storage`
  event for `ct_history_v1`, or with no key);
- it comes back from the browser's back/forward cache (`pageshow` with `persisted`), e.g. Android
  Back after a session was saved on the app page;
- it's shown again (`visibilitychange`), because Android can freeze a background tab so it misses
  the storage event. This also happens when the file picker of **Import** closes.

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
| `ct_session_v1` | The session that's running right now (removed when it ends). `restartPending: true` while the continue/restart question is unanswered; older saved sessions don't have it, which means `false`. `leftAt` (timestamp in ms): only while the page is hidden, for the time away card; missing means the page wasn't left. Never copied into the history |
| `ct_history_v1` | Finished sessions, newest first, max. 1000 |
| `ct_prefs_v1` | Last chosen character, mode and duration, plus `endSound` and `keepScreenOn` (the two setup checkboxes, `true`/`false`). Prefs saved before these existed get `true` for both. `leaveReminder`: the **Remind me if I leave the app** checkbox (see [Leave reminder](#leave-reminder)); prefs saved before it existed get `false`. `homeScreenTipDismissed`: `true` once **Got it** was tapped on the iPhone Home Screen tip. `persistRequested`: `true` once persistent storage was asked for (or skipped in Firefox), see [iPhone storage and the Home Screen app](#iphone-storage-and-the-home-screen-app). Prefs saved before these two existed get `false` for both. `howItWorksDismissed`: `true` once **Got it** was tapped on the How it works card; prefs saved before it existed get `false`, so the card shows once. A `style` value saved by older versions is ignored and dropped. Saved field by field (see [Several tabs](#several-tabs-one-tab-at-a-time)) |

Each history entry: `startedAt`, `endedAt` (timestamps in ms), `endedBy` (`"timer"`/`"manual"`/`"startOver"`),
`characterId`, `style` (the character's personality when the session ran: `"kind"`, `"firm"`,
`"strict"` or `"ragebait"`; shown as its group label, e.g. "Relaxed" for `"kind"`), `mode`, `plannedMs`, `elapsedMs`, `distractedMs`, `focusPercent`
(`null` in Simple mode) and `distractions` (`[{ at, level, ms, category }]`). `category` is
`"phone"` (shown as "Screen": the phone, other apps or tabs; also what the time away card sets), `"thoughts"`, `"noise"`,
`"people"`, `"tired"`, `"other"` or `null` (nothing picked). A distraction logged from the time away
card also has `source: "away"`; tapped ones have no `source` field.
Sessions saved before categories existed have no `category` field; everything that reads it treats
that as `null`.
Sessions saved before personalities came from the character keep the style that was chosen then
(for example a strict Grandma). A session that was still running when this changed continues, and
is saved, with the character's own personality.
History lives only in this browser: clearing site data or switching devices starts it over.
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
- **Icons** (`public/icons/`, `public/favicon.ico`): placeholders until the real character art, a
  white crosshair with a brain in the middle on the app's orange. The source is
  `public/icons/icon.svg` (edit this one). The PNGs are rendered from it: `apple-touch-icon.png`
  (180, full square without transparency, iOS rounds the corners), `icon-192.png` and
  `icon-512.png` (rounded corners), and `icon-maskable-512.png` (full square, the picture shrunk to
  80% so it stays inside the middle safe zone and Android can crop it to any shape). At favicon
  size the brain would be a blob, so `favicon.ico` (16/32/48 px) is rendered from a simplified
  `public/icons/icon-small.svg` (crosshair with a filled dot). The PNGs and the favicon were made
  once with a throwaway script (headless Chromium + Python), which isn't in the repo. After editing an
  SVG, render the files again at the same names and sizes.

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
    "version": 6,
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
    just as the timer runs out; a time away distraction's `at` is the moment the page was left,
    which is always inside); Simple-mode distractions have `ms: 0`, tapped Advanced ones are
    30 sec to 10 min long
  - from version 6, `source` is missing (a tap) or `"away"`, anything else is an "unknown
    distraction source". An Advanced away distraction is a measured length: whole seconds, at
    least 15 s and not longer than the session ("away distraction length out of range"), and its
    level must match its length by the thresholds above ("away distraction level doesn't match
    its length"). So changing those thresholds later needs a new version, or older version 6
    exports would be rejected. A Simple away distraction has `ms: 0` like any Simple one.
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
  1–4 files it's an "unknown style". Version 6 allows time away distractions (`source: "away"` and
  a measured length). Version 1–5 files import exactly as before: a `source` field in them is
  dropped, and every Advanced distraction must still be 30 sec to 10 min.
- If the session fields ever change again, raise `EXPORT_VERSION` in `public/js/history-store.js`,
  add the new number to `IMPORT_VERSIONS`, and teach the import how to read the older files.

## Privacy page (`privacy.html`)

`privacy.html` explains in plain words what stays on the device, what is sent to the server (only
the character count on **Start session**), hosting by Netlify, the legal basis and the user's GDPR
rights (required before launch, GDPR Art. 13). It's linked as a small grey **Privacy** link below
**Start session** on the setup screen and at the very bottom of `history.html`; not on `stats.html`,
the session or summary screens, or in dialogs. "← Back to the timer" at the top and bottom goes to
`./`, like on `history.html`; the phone's Back button returns to where you came from.

- The page has **no scripts**: opening it reads and saves nothing in localStorage, takes no session
  lock and registers nothing (it doesn't load `sw-register.js`).
- **Keep it true:** whenever data handling changes (a new request to a server, new data stored on
  the device or the server, a new third-party service, accounts or payments), update
  `public/privacy.html` and its "Last updated" date in the same pull request (also a rule in
  `CLAUDE.md`).

## Offline use

Once the app has been opened online, it also opens and works **without internet**: the setup
screen, a full session, the summary and `history.html`. This is done by a **service worker**
(`public/sw.js`): a small script the browser installs for the site, which sits between the pages
and the network and can answer from saved copies when the network is down. It's registered by
`public/js/sw-register.js`, loaded at the end of `index.html` and `history.html`. In a browser
without service workers, or if registering fails (e.g. `index.html` opened as a local file), the app
works online exactly as before.

- **First online visit (install):** the service worker downloads every file needed to start a
  session (the `PRECACHE` list in `sw.js`: both pages, CSS, all JS, manifest, icons, favicon) into a
  cache named `concentraining-v<CACHE_VERSION>`. If any file fails, nothing is saved and it tries
  again on a later visit. `stats.html` is left out: it needs `api/stats` anyway.
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
  `/ConcenTraining/` on the [GitHub Pages test site](#github-pages-test-site-while-netlify-is-paused),
  so there `/ConcenTraining/index.html` is saved as `/ConcenTraining/`. For the same reason every path
  in `public/` is relative (no leading `/`), including the `api/picks` and `api/stats` calls.
- **Updates:** the browser checks `sw.js` on every visit (`netlify.toml` sends it with
  `Cache-Control: no-cache`). A changed `sw.js` installs in the background, then takes over at once
  (`skipWaiting` + `clients.claim`) and deletes the older `concentraining-` caches. **It never
  reloads or interrupts an open page:** a running session keeps the code it started with, and the
  new version shows up the next time the app is opened or reloaded. A reload during a session
  still resumes it from `ct_session_v1`. No localStorage key changed for offline use.
- **`privacy.html`** isn't in the precache list either: it isn't needed at startup. Once the service
  worker is installed, the first online visit saves a copy (as `/privacy` and `privacy.html`, see
  above), so it opens offline after that. Opened offline before any online visit, it shows the
  browser's offline page; Back works as usual.
- **Real character artwork** (`public/assets/...`) isn't in the precache list. Each image is saved
  the first time it loads online and is available offline after that.
- **When you add, remove or rename a file the app needs at startup** (a page, CSS, a JS file, an
  icon), update `PRECACHE` in `public/sw.js` and raise `CACHE_VERSION`. Forgetting doesn't break
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

## Files

| File | What's in it |
|---|---|
| `public/index.html` | All screens (setup, session, summary, "open in another tab" notice) and dialogs |
| `public/history.html` | Your finished sessions, streaks, time per week and focus trends |
| `public/privacy.html` | Privacy page: what stays on the device, what is sent to the server, hosting, your rights (no scripts) |
| `public/stats.html` | Popularity table (reads `/api/stats`) |
| `public/sw.js` | Service worker: offline start, network first with a 3-second fallback to the cache, precache list and cache version (see [Offline use](#offline-use)), and taps on the leave reminder notification |
| `public/js/sw-register.js` | Registers `sw.js` from `index.html` and `history.html`; does nothing without service worker support |
| `public/css/style.css` | Styling, light/dark mode, breathing and reaction animations |
| `public/js/data/characters.js` | Character list, groups and the personality each group gives (`personalityOf`), art paths, pose descriptions for screen readers (`POSE_DESCRIPTIONS`) |
| `public/js/data/messages.js` | Motivation messages, summary titles, Simple-mode summary messages per result, and the "can't save" notes (also loaded by `history.html`) |
| `public/js/placeholder-art.js` | Built-in placeholder drawings (kind, firm, strict and ragebait faces, plus each character's look) for characters without real art |
| `public/js/app.js` | Timer, reaction engine, distraction category picker, Undo, disabled Advanced lengths, time away card, leave reminder notification, motivation rotation, end chime, screen wake lock and the "screen may turn off" note, summary, How it works card, iPhone Home Screen tip, persistent storage request, one tab at a time (Web Locks) |
| `public/js/history-store.js` | Saving/loading history, focus % and summary result (with their thresholds), distraction categories, export/import checks, iPhone/iPad and iPhone Safari checks, the "can this browser save?" test (`storageWorks`) (used by both pages) |
| `public/js/history.js` | Streaks, weekly time and focus charts, time of day, distraction categories, session list and backup buttons on `history.html` |
| `netlify/functions/picks.mjs` | `POST /api/picks`: counts one session started with a character |
| `netlify/functions/stats.mjs` | `GET /api/stats`: popularity + which characters are paid |
| `netlify/lib/characters.mjs` | The characters whose picks are counted (id + name); a new character must be added here |
| `netlify/lib/picks-store.mjs` | Which Blobs store the counts are in (live or test) and the UTC day helper |
| `test-data/` | Small export files for testing Import (not deployed, see `test-data/README.md`) |
| `public/manifest.webmanifest` | Web app manifest: name, colors and icons for Add to Home Screen / Install |
| `public/icons/` | Placeholder app icons: `icon.svg` and `icon-small.svg` (sources) and the PNGs rendered from them (Home Screen, Android, maskable) |
| `public/favicon.ico` | Browser tab icon (placeholder) |
| `netlify.toml` | Tells Netlify the site is in `public/`, and sends `sw.js` with `Cache-Control: no-cache` |
| `.github/workflows/pages.yml` | Temporary: publishes `public/` to the GitHub Pages test site on every push to `main` (see [GitHub Pages test site](#github-pages-test-site-while-netlify-is-paused)) |
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

## Popularity stats (backend)

Every press of **Start session** sends `POST /api/picks` once for the chosen character, whether or
not the session gets finished. Browsing the cards, tapping the same card again, a cancelled ragebait
warning, **Start over** (same character, not a new choice) and a reload that restores a running
session don't count.
Counts are stored per character per day (UTC) in **Netlify Blobs** (a simple key–value storage
on Netlify: the functions save and read named pieces of data, with no database server running), so
popularity can be measured over the **last 30 days** and the paid selection rotates as tastes change.

- `GET /api/stats` returns every character's recent and all-time picks, plus `paidCharacterIds`:
  empty until there are at least 10 characters, then the top ~10% by recent picks.
  It also returns `store`: `"live"` or `"test"` (see below). The numbers are at `/stats.html`,
  which says which store it's reading.
- **One blob per character:** the key is the character id (`grandma`), the value is the picks per
  day, e.g. `{ "days": { "2026-11-03": 5, "2026-11-04": 2 } }`. `/api/stats` reads the 15 blobs.
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
- With 15 characters the paid selection is active: the top 2 by recent picks (**Start session**
  presses) are marked "(paid)" on `/stats.html`.
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
Leave the build command empty; `netlify.toml` already sets the publish directory to `public`.
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

### GitHub Pages test site (while Netlify is paused)

Netlify paused the account until about **2 November 2026** (usage limit), so right now there are no
Deploy Previews and no `main` branch deploy. Until it's back:

- **Test site:** https://kantorhorvathambrus-source.github.io/ConcenTraining/, published from `main`.
- **How it's published:** a GitHub Actions workflow (`.github/workflows/pages.yml`: a small file
  that tells GitHub to run steps on its own servers when something happens) uploads `public/` as it
  is, with no build step, on every push to `main`. It can also be started by hand: **Actions** tab →
  **Deploy to GitHub Pages** → **Run workflow**. The repo's Pages setting must stay on
  **Source: GitHub Actions**.
- **Workflow:** pull requests into `main` are merged **without a Deploy Preview** and tested on the
  GitHub Pages site afterwards. That's safe because `main` isn't the live site; the live site still
  only changes through a `main` → `live` pull request (which also has to wait for Netlify).
- **No backend there:** the Netlify Functions don't run on Pages, so `POST api/picks` gets a 404 and
  is ignored (no session is counted, the app works the same), and `stats.html` shows its
  "Couldn't load stats" message.
- **Subpath:** the site runs under `/ConcenTraining/`, not the domain root. Every path in `public/`
  is relative and the service worker works relative to its scope (see [Offline use](#offline-use)),
  so the app, history and offline start work the same as on Netlify.
- **Separate saved data:** it's a different address from the Netlify sites, so its history,
  settings and offline cache are separate too.
- When Netlify is back, the workflow can stay or be deleted; it doesn't affect Netlify.
