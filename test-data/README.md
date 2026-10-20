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

The file names are listed below with the message you should see. The good files, the
duplicates file and `mixed.json` add sessions dated September 2026 to the preview's history;
importing one a second time says "Nothing new to import: you already have every session in this
file (…)".

## Bad files: nothing is imported (red message)

Each holds one session that breaks one rule.

| File | What's wrong | Message |
|---|---|---|
| `bad-01a-zero-duration.json` | Elapsed time 0 | Nothing was imported. Skipped 1 invalid session (shorter than 1 minute). |
| `bad-01b-under-1-minute.json` | Ran 45 seconds | Nothing was imported. Skipped 1 invalid session (shorter than 1 minute). |
| `bad-02-elapsed-mismatch.json` | Start and end are 20 min apart, `elapsedMs` says 50 min | Nothing was imported. Skipped 1 invalid session (elapsed time doesn't match start and end). |
| `bad-03-planned-length.json` | `plannedMs` is 0 | Nothing was imported. Skipped 1 invalid session (bad planned length). |
| `bad-04-longer-than-planned.json` | Planned 25 min, ran 30 | Nothing was imported. Skipped 1 invalid session (longer than planned). |
| `bad-05-ended-by.json` | Says the timer ended it, but it stopped after 10 of 25 min | Nothing was imported. Skipped 1 invalid session (end reason doesn't match the times). |
| `bad-06-distraction-outside.json` | A distraction one hour before the session started | Nothing was imported. Skipped 1 invalid session (distraction outside the session). |
| `bad-07-simple-distraction-length.json` | A Simple-mode distraction lasting 5 min | Nothing was imported. Skipped 1 invalid session (Simple distraction with a length). |
| `bad-08-advanced-distraction-length.json` | An Advanced-mode distraction lasting 60 min | Nothing was imported. Skipped 1 invalid session (Advanced distraction length out of range). |
| `bad-09-distraction-total.json` | 7 min of distractions, but `distractedMs` is 0 | Nothing was imported. Skipped 1 invalid session (distraction total doesn't add up). |
| `bad-10-focus-100-with-distraction.json` | 100% focus with 10 min of distraction in 25 min | Nothing was imported. Skipped 1 invalid session (focus % doesn't match distraction time). |
| `bad-11-simple-with-focus.json` | Simple mode with `focusPercent: 80` | Nothing was imported. Skipped 1 invalid session (focus % in Simple mode). |
| `bad-12-start-over-in-v3.json` | `endedBy: "startOver"` in a version 3 file (only allowed from version 4) | Nothing was imported. Skipped 1 invalid session (unknown end reason). |

## Good files: everything imports

| File | What it tests | Message |
|---|---|---|
| `good-v1.json` | Export version 1 (no distraction categories) | Imported 2 sessions. |
| `good-v2.json` | Export version 2 | Imported 2 sessions. |
| `good-v3-new-character.json` | Version 3, ragebait style, a character id this app doesn't know | Imported 2 sessions. |
| `good-v4-start-over.json` | Version 4, two sessions saved with **Start over** (`endedBy: "startOver"`): Advanced 12 of 25 min at 8% (with a 10+ min distraction), Simple 8 of 25 min. Both show "restarted" in the list | Imported 2 sessions. |
| `good-edge-cases.json` | 100% with one 30-sec distraction in 2 hours (how the app rounded before 19 Oct 2026), and a distraction tapped 0.4 sec after the timer ran out | Imported 2 sessions. |

## Mixed

| File | What it tests | Message |
|---|---|---|
| `duplicates-in-file.json` | The same session twice in one file | Imported 1 session. Skipped 1 duplicate or session you already had. |
| `mixed.json` | 2 good sessions, a copy of one of them, and 3 bad ones | Imported 2 sessions. Skipped 1 duplicate or session you already had. Skipped 3 invalid sessions (1 focus % in Simple mode, 1 focus % doesn't match distraction time, 1 shorter than 1 minute). |
