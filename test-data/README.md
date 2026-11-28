# Import test files

Small ConcenTraining export files for testing **Import** on the History page. This folder is
outside `public/`, so Netlify doesn't publish it.

Test on a **Deploy Preview**, not on the real site: a Deploy Preview is a different web address,
so it has its own saved history and your real history isn't touched.

## Getting a file onto your phone

1. On GitHub, open this `test-data` folder and tap a file.
2. Tap the download button ("Download raw file") at the top right of the file.
   - iPhone: it goes to the **Files** app → Downloads.
   - Android: it goes to **Downloads**.
3. On the Deploy Preview, open **History** → **Import** and pick the file.

The file names are listed below with the message you should see. The good files, the repair
files, the duplicates file and `mixed.json` add sessions dated September 2026 to the preview's history;
importing one a second time says "Nothing new to import: you already have every session in this
file (…)".

## Bad files: nothing is imported (red message)

Each holds one session that breaks one rule.

| File | What's wrong | Message |
|---|---|---|
| `bad-01a-zero-duration.json` | Elapsed time 0 | Nothing was imported. Skipped 1 invalid session (shorter than 1 minute). |
| `bad-01b-under-1-minute.json` | Ran 45 seconds | Nothing was imported. Skipped 1 invalid session (shorter than 1 minute). |
| `bad-03-planned-length.json` | `plannedMs` is 0 | Nothing was imported. Skipped 1 invalid session (bad planned length). |
| `bad-04-longer-than-planned.json` | Planned 25 min, ran 30 | Nothing was imported. Skipped 1 invalid session (longer than planned). |
| `bad-05-ended-by.json` | Says the timer ended it, but it stopped after 10 of 25 min | Nothing was imported. Skipped 1 invalid session (end reason doesn't match the times). |
| `bad-07-simple-distraction-length.json` | A Simple-mode distraction lasting 5 min | Nothing was imported. Skipped 1 invalid session (Simple distraction with a length). |
| `bad-08-advanced-distraction-length.json` | An Advanced-mode distraction lasting 60 min | Nothing was imported. Skipped 1 invalid session (Advanced distraction length out of range). |
| `bad-12-start-over-in-v3.json` | `endedBy: "startOver"` in a version 3 file (only allowed from version 4) | Nothing was imported. Skipped 1 invalid session (unknown end reason). |
| `bad-13-firm-in-v4.json` | `style: "firm"` in a version 4 file (only allowed from version 5) | Nothing was imported. Skipped 1 invalid session (unknown style). |
| `bad-14-away-too-short.json` | Version 6, an Advanced time away distraction of 10 sec (at least 15 sec) | Nothing was imported. Skipped 1 invalid session (away distraction length out of range). |
| `bad-15-away-longer-than-session.json` | Version 6, a 12-min time away distraction in a session that ran 10 min | Nothing was imported. Skipped 1 invalid session (away distraction length out of range). |
| `bad-16-away-level-mismatch.json` | Version 6, a 2 min 15 sec time away distraction at level 5 (should be 3) | Nothing was imported. Skipped 1 invalid session (away distraction level doesn't match its length). |
| `bad-17-unknown-source.json` | Version 6, a distraction with `source: "timer"` | Nothing was imported. Skipped 1 invalid session (unknown distraction source). |
| `bad-18-away-in-v5.json` | A 20-sec time away distraction in a version 5 file: before version 6 every Advanced distraction must be 30 sec to 10 min, as always | Nothing was imported. Skipped 1 invalid session (Advanced distraction length out of range). |
| `bad-19-break-outside.json` | Version 7, a break that starts 2 min before the session | Nothing was imported. Skipped 1 invalid session (break outside the session). |
| `bad-20-breaks-overlap.json` | Version 7, a second break that starts while the first is still running | Nothing was imported. Skipped 1 invalid session (breaks overlap). |
| `bad-21-distraction-during-break.json` | Version 7, a distraction logged in the middle of a break | Nothing was imported. Skipped 1 invalid session (distraction during a break). |
| `bad-22-future-date.json` | A session on 1 Jan 2100 (more than a day after the import) | Nothing was imported. Skipped 1 invalid session (date in the future). |
| `bad-23-before-2024.json` | A session in July 2023 (before 1 Jan 2024) | Nothing was imported. Skipped 1 invalid session (bad start or end time). |
| `bad-24-too-many-distractions.json` | A 1-minute session with 301 distractions (at most 300: 5 per second) | Nothing was imported. Skipped 1 invalid session (too many distractions). |
| `bad-25-planned-too-long.json` | Planned for 300 min (at most 240) | Nothing was imported. Skipped 1 invalid session (bad planned length). |

## Repair files: imported after a correction

Each holds one session with a mistake the import corrects instead of refusing it. The session
list shows the corrected numbers.

| File | What's wrong | What the import does | Message |
|---|---|---|---|
| `repair-01-elapsed-mismatch.json` | Simple, start and end 20 min apart, `elapsedMs` says 50 min | Works out 20 min: listed as "20 of 25 min" | Imported 1 session. |
| `repair-02-distraction-before-start.json` | Simple, a distraction one hour before the session started | Moves it to the session's start; the session imports with its 1 distraction | Imported 1 session. |
| `repair-03-distraction-total.json` | Advanced 25 min, 7 min of distractions but `distractedMs` 0 and 100% | Works out 7 min and 72% | Imported 1 session. |
| `repair-04-focus-100-with-distraction.json` | Advanced, 100% focus with 10 min of distraction in 25 min | Works out 60% | Imported 1 session. |
| `repair-05-simple-with-focus.json` | Simple mode with `focusPercent: 80` | Simple has no focus %: shown as "—" | Imported 1 session. |
| `repair-06-distraction-after-end.json` | Version 8, the phone's clock was set back 8 min during the session: a Professor Advanced session that ends 4 min after its start, with a 2 min distraction logged "6 min after the end" | Moves the distraction to the session's end, keeps its length and level: "4 of 25 min", 50% | Imported 1 session. |

## Good files: everything imports

| File | What it tests | Message |
|---|---|---|
| `good-v1.json` | Export version 1 (no distraction categories) | Imported 2 sessions. |
| `good-v2.json` | Export version 2 | Imported 2 sessions. |
| `good-v3-new-character.json` | Version 3, ragebait style, a character id this app doesn't know | Imported 2 sessions. |
| `good-v4-start-over.json` | Version 4, two sessions saved with **Start over** (`endedBy: "startOver"`): Advanced 12 of 25 min at 8% (with a 10+ min distraction), Simple 8 of 25 min. Both show "restarted" in the list | Imported 2 sessions. |
| `good-v5-firm.json` | Version 5, two Professor sessions with the firm style: Advanced 25 of 25 min at 94%, Simple 20 of 30 min. Both show "… · Firm" in the list | Imported 2 sessions. |
| `good-v6-away.json` | Version 6, time away distractions (`source: "away"`, category Screen): Advanced 25 of 25 min at 87% with a 2 min 15 sec one and a tapped 1 min; Simple 20 of 25 min with one at level 4; Advanced **Start over** after 15 min at 54% with an 11 min 30 sec one (level 5, longer than any button) | Imported 3 sessions. |
| `good-v7-pauses.json` | Version 7, sessions with breaks (`pauses`): Advanced 25 of 25 min at 96% with breaks of 3 min and 1 min 30 sec, which **ran to the timer** (`endedBy: "timer"`, shown as "25 min"), and a Simple session ended after 18 of 25 min with one 2 min break. Their rows say "Paused 2 times · 5 min" and "Paused once · 2 min" | Imported 2 sessions. |
| `good-v8-utc-offset.json` | Version 8, the time zone offset each session started in (`utcOffsetMin`): a Grandma Simple session from **Sun 27 Sep 23:50 to Mon 00:15 in Madeira** (offset 60), shown as "Sun 27 Sept · 23:50" and counted on that Sunday and in its week, whatever the phone's time zone; a Professor Advanced session at 10:00 in Budapest (offset 120), shown as "Wed 23 Sept · 10:00" everywhere; and a session with an impossible offset (999), which still imports without it and is shown in the phone's own time zone (Tue 22 Sept, 16:00 in Budapest) | Imported 3 sessions. |
| `good-many-distractions.json` | A Simple 1-minute session with 150 distractions (one every 0.4 s, the fastest tapping allows) | Imported 1 session. |
| `good-custom-name.json` | Version 8, custom character names (`characterName`): "Captain Focus 🚀" and "<b>Bold Max</b>" are listed with those names (the second as plain text, not bold); a name over 20 characters is dropped, so that session is listed as `custom-k1l2m3n4o5`; a built-in character's `characterName` ("Not Grandma") is dropped, so it's listed as Grandma | Imported 4 sessions. |
| `good-edge-cases.json` | 100% with one 30-sec distraction in 2 hours (how the app rounded before 19 Oct 2026), and a distraction tapped 0.4 sec after the timer ran out | Imported 2 sessions. |

## Mixed

| File | What it tests | Message |
|---|---|---|
| `duplicates-in-file.json` | The same session twice in one file | Imported 1 session. Skipped 1 duplicate or session you already had. |
| `mixed.json` | 2 good sessions, a copy of one of them, 2 that are repaired (a Simple session with a focus %, an Advanced 100% with 10 min of distraction) and 1 bad one | Imported 4 sessions. Skipped 1 duplicate or session you already had. Skipped 1 invalid session (shorter than 1 minute). |
