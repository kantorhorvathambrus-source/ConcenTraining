// English: the source of every text and the fallback for any text another language doesn't have.
// Loaded in <head> before js/i18n.js. See "Languages" in the README.
//
// Keys: area.name. {name} is a placeholder, filled by the code. A text with plural forms is an
// object with one entry per Intl.PluralRules category of the language (English: one, other).
// \u00a0 is a no-break space: the line never wraps there.
//
// The data files hand over the rest of the English when they load (localize in js/i18n.js):
// characters, groups and pose descriptions (js/data/characters.js), motivations and the Simple
// summary sentences (js/data/messages.js), distraction categories (js/history-store.js) and every
// avatar option, costume and preset (js/avatar-parts.js, js/avatar-costumes.js). Their keys are
// listed in the README.

// eslint-disable-next-line no-var
var I18N_TEXTS = I18N_TEXTS || {};

I18N_TEXTS.en = {
  // ---------- shared ----------
  "common.gotIt": "Got it",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.done": "Done",
  "common.back": "Back",
  "common.save": "Save",
  "common.yes": "Yes",
  "common.privacy": "Privacy",
  "common.listSeparator": ", ",

  "mode.simple": "Simple",
  "mode.advanced": "Advanced",

  // Lengths of time. sec/min are also used inside other texts.
  "time.sec": "{seconds} sec",
  "time.min": "{minutes} min",
  "time.minSec": "{minutes} min {seconds} sec",
  "time.h": "{hours} h",
  "time.hMin": "{hours} h {minutes} min",
  // A date and a clock time on one line: "Mon 20 Oct · 14:05". Both parts come from Intl.
  "time.dateAndClock": "{date} · {time}",

  // ---------- language button and sheet ----------
  "language.code": "EN",
  "language.buttonLabel": "Language: English",
  "language.title": "Language",
  "language.report": "Report a translation issue",

  // The light/dark switch next to the language button (js/theme.js): what screen readers call it.
  // It is a switch, so they add "on" or "off" themselves.
  "darkMode.label": "Dark mode",

  // ---------- setup screen ----------
  "setup.tagline": "Pick a buddy, set a timer, and get focused.",
  "setup.howItWorks": "How it works",
  "setup.historyLink": "Your history →",
  "quickStart.label": "Quick start",
  "quickStart.change": "Change ↓",
  "quickStart.changeLabel": "Change setup",
  "quickStart.start": "Start",
  // No-break spaces: a narrow screen wraps after a "·", never before it or inside "25 min".
  "quickStart.line": "{name}\u00a0· {mode}\u00a0· {minutes}\u00a0min",

  "how.title": "How it works",
  "how.item1": "Pick a character and a timer, then start focusing.",
  "how.item2":
    "When you notice your mind has wandered, tap how much (Simple) or how long (Advanced). Your character reacts with a pose, never with words. Noticing and coming back is the skill you're training.",
  "how.item3":
    "Need to step away for a moment? Tap Stop, then Take a break. The timer waits for you, and the break doesn't count against your focus.",
  "how.item4": "If you leave the app during a session, it asks when you're back whether you were distracted.",
  "how.item5": "Your history is saved automatically on this device. To move it to another phone, use",
  "how.item5Link": "Export on the history page →",

  "tip.title": "Keep your history safe on iPhone",
  "tip.text": "Safari may erase your history and streak if you don't open ConcenTraining for 7 days. Apps on your Home Screen keep it.",
  "tip.howLabel": "How:",
  "tip.how": "tap Share (or ••• → Share), then Add to Home Screen.",
  "tip.importantLabel": "Important:",
  "tip.important":
    "the Home Screen app has its own separate storage, so your current history won't move over by itself. Export your history first, then Import it in the Home Screen app.",
  "tip.exportLink": "Go to Export →",

  "setup.step1": "1. Choose your character",
  "setup.pickFirst": "Pick a character first.",
  "setup.yourCharacters": "Your characters",
  "setup.step2": "2. Choose a mode",
  "setup.simpleText": "Say how distracted you were with 5 buttons.",
  "setup.advancedText": "Log how long you were distracted and see your focus % at the end.",
  "setup.step3": "3. How long do you want to focus?",
  "setup.endSound": "Play a sound when time's up",
  "setup.testSound": "Test sound",
  "setup.soundHint": "Uses your media volume. On iPhone, silent mode can mute it.",
  "setup.keepScreenOn": "Keep the screen on during the session",
  "setup.leaveReminder": "Remind me if I leave the app",
  "setup.leaveReminderBlocked": "Notifications are blocked for this site. You can allow them in your browser's site settings.",
  "setup.start": "Start session",

  // The duration picker (setup screen and the Start over dialog).
  "duration.chip": "{minutes} min",
  "duration.customBefore": "Custom:",
  "duration.customAfter": "min",
  "duration.setTo": "Set to {minutes} min.",
  "duration.max": "Max. {minutes} min.",
  "duration.min": "Min. {minutes} min.",
  "duration.rounded": "Rounded to {minutes} min.",

  // Character cards. editLabel / deleteLabel: what a screen reader says for the buttons.
  "character.editLabel": "Edit {name}",
  "character.deleteLabel": "Delete {name}",
  "character.deleteTitle": "Delete {name}?",
  "character.deleteText": "Your past sessions with this character stay in your history.",
  "character.ragebaitTitle": "Heads up!",
  "character.ragebaitText": "{name}: {warning}",
  "character.ragebaitCancel": "Pick someone else",
  "character.ragebaitOk": "Bring it on",
  // The image description of a pose (alt text and screen reader announcement), never the character speaking.
  "character.poseAlt": "{name}, {pose}",

  "custom.createTitle": "Create your own",
  "custom.createTagline": "Design your own character, with your own name.",
  "custom.freeBadge": "Free during launch",
  "custom.limit": "You can have up to {limit} characters. Delete one to make a new one.",
  "custom.nameMissing": "Give your character a name.",
  "custom.nameTooLong": "Names can be up to {max} characters.",
  "custom.nameTaken": "You already have a character with this name.",
  "custom.saveFailed": "Couldn't save your character. Your browser isn't letting this site store data.",
  "custom.deletedElsewhere": "This character was deleted in another tab, so it can't be saved.",
  "custom.ghostName": "Custom character",

  // ---------- storage notes ----------
  "storage.setupNote":
    "Your browser isn't letting this site save data, so sessions won't go into your history and your settings won't be remembered. You can allow it in your browser's site settings.",
  "storage.sessionNote": "This session won't be saved: your browser isn't letting this site save data.",
  "storage.historyNote":
    "Your browser isn't letting this site save data, so no sessions can be stored here. You can allow it in your browser's site settings.",

  // ---------- session screen ----------
  "session.info": "{name} · {style} · {mode} · {minutes} min",
  "session.promptSimple": "Got distracted? How much?",
  "session.promptAdvanced": "Got distracted? For how long?",
  "session.screenNote": "Your screen may turn off. If it does, you won't hear the chime.",
  "session.paused": "Paused",
  "session.break": "Break",
  "session.hideMessage": "Hide message",
  "session.motivate": "Motivate me",
  "session.undo": "Undo",
  "session.resume": "Resume",
  "session.stop": "Stop",
  "session.endSession": "End session",
  "session.pausedTitle": "Paused · ConcenTraining",
  "session.saveFirstPartFailed": "Couldn't save the first part to your history: your browser didn't allow it.",

  // Simple mode's 5 buttons (by level): they answer "How much?", so they're plain and clearly
  // increase. Advanced mode's 7 lengths (in order).
  "distraction.simple.1": "Barely",
  "distraction.simple.2": "A little",
  "distraction.simple.3": "Quite a bit",
  "distraction.simple.4": "A lot",
  "distraction.simple.5": "Completely",
  "distraction.advanced.1": "30 sec",
  "distraction.advanced.2": "1 min",
  "distraction.advanced.3": "2 min",
  "distraction.advanced.4": "3 min",
  "distraction.advanced.5": "5 min",
  "distraction.advanced.6": "10 min",
  "distraction.advanced.7": "10+ min",

  "category.prompt": "What distracted you?",
  "category.skip": "Skip",

  // Screen readers only.
  "announce.picker": "What distracted you? Choose below, or skip.",
  "announce.undo": "Distraction undone.",
  "announce.paused": "Paused",
  "announce.resumed": "Resumed",

  "motivation.fact": "Brain fact",
  "motivation.boost": "Boost",

  // The leave reminder: the app speaking, never a character.
  "notification.title": "Your session is still running",
  "notification.body": "Is this part of what you're focusing on? Tap to go back.",

  // ---------- dialogs ----------
  "restart.simpleTitle": "That was a big distraction",
  "restart.simpleText": "Keep going with this session, or start fresh? After a big distraction, starting over is often easier.",
  "restart.advancedTitle": "That was a long break",
  "restart.advancedText": "Keep going with this session, or start fresh? After a long break, starting over is often easier.",
  "restart.continue": "Continue this session",
  "restart.over": "Start over",
  "restart.lengthTitle": "How long should the new session be?",
  "restart.save": "Save the first {duration} to history",
  "restart.startNew": "Start new session",

  "end.titleRunning": "Stop for now?",
  "end.titlePaused": "End this session now?",
  "end.running": "Timer still running",
  "end.break": "Take a break",
  "end.breakNote": "The timer waits for you.",
  "end.save": "Save this session to your history",
  "end.keepGoing": "Keep going",

  "away.title": "You were away for {duration}.",
  "away.question": "Were you distracted?",
  "away.no": "No, it was for the task",

  "late.title": "Welcome back!",
  "late.text": "Your {minutes} min {mode} session with {name} ended {ago}.",
  "late.question": "The app can't tell if you kept focusing until the end. Save it to your history?",
  "late.discard": "Discard",

  "elsewhere.title": "This session is open in another tab.",
  "elsewhere.text": "Only one tab can run a session at a time.",
  "elsewhere.continue": "Continue here",

  // ---------- summary ----------
  "summary.title.great": "Great session!",
  "summary.title.okay": "Good effort!",
  "summary.title.rough": "Tough session",
  "summary.title.early": "Ended early",
  "summary.title.short": "That was quick",
  "summary.shortNote": "Sessions shorter than 1 minute aren't saved to your history.",
  "summary.saveError":
    "Couldn't save this session to your history: your browser didn't allow it. Full storage or blocked site data can cause this.",
  "summary.percent": "{percent}% focused",
  "summary.logged": { one: "with {count} distraction logged.", other: "with {count} distractions logged." },
  "summary.planned": " ({duration} planned)",
  "summary.advancedLine": "You focused for {focused} out of {elapsed}{planned}, {logged}",
  "summary.simpleLine": "Your session ran {elapsed}{planned}, {logged}",
  "summary.categories": { one: "Most common distraction: {list}", other: "Most common distractions: {list}" },
  "summary.categoryCount": "{label} ({count})",
  "summary.again": "Start another session",
  "summary.history": "See your history",

  // "Paused once · 2 min" (summary and history list).
  "pauses.line": { one: "Paused once · {duration}", other: "Paused {count} times · {duration}" },

  // ---------- history page ----------
  "history.pageTitle": "Your History · ConcenTraining",
  "history.title": "Your history",
  "history.subtitle": "Finished sessions saved on this device.",
  "history.storageBefore":
    "Your history is stored only in this browser. Clearing site data or using private mode deletes it, and it doesn't show up on other devices. Use",
  // Names the Export button. Other languages keep it exactly as their history.export (checked).
  "history.storageExport": "Export",
  "history.storageAfter": "below before you switch phones or clear your browser data.",
  "history.iosNote":
    "On iPhone and iPad, Safari may also erase it if you don't visit for 7 days. Adding ConcenTraining to your Home Screen (tap Share, or ••• → Share, then Add to Home Screen) keeps it.",
  "history.empty": "No finished sessions yet. Every session that runs at least 1 minute shows up here once it ends.",
  "history.startOne": "Start one →",
  "history.currentStreak": "Current streak",
  "history.longestStreak": "Longest streak",
  "history.streakNote": "A streak counts days with at least one finished session.",
  "history.days": { one: "{count} day", other: "{count} days" },
  "history.sessions": { one: "{count} session", other: "{count} sessions" },
  "history.distractions": { one: "{count} distraction", other: "{count} distractions" },

  "history.timeTitle": "Time per week",
  "history.timeNote": "All sessions over the last 12 weeks, Simple and Advanced.",
  "history.timeNone": "No sessions in the last 12 weeks.",
  "history.timeNoneThisWeek": "No sessions this week yet.",
  "history.timeThisWeek": "This week: {time} across {sessions}.",
  "history.timeChartLabel": "Time spent in sessions per week for the last {count} weeks",
  "history.timeBarTitle": "Week of {date}: {time} ({sessions})",

  "history.focusTitle": "Weekly focus",
  "history.focusNote": "Advanced-mode sessions over the last 12 weeks. Longer sessions count more.",
  "history.focusNone": "No Advanced-mode sessions in the last 12 weeks. Use Advanced mode to see your focus trend.",
  "history.focusNoneThisWeek": "No Advanced-mode sessions this week yet.",
  "history.focusThisWeek": "This week: {percent}% focused across {sessions}.",
  "history.focusChartLabel": "Weekly focus percentage for the last {count} weeks",
  "history.focusPointTitle": "Week of {date}: {percent}% ({sessions})",
  "history.percent": "{percent}%",

  "history.bestTimeTitle": "Best time of day",
  "dayPart.morning": "Morning",
  "dayPart.afternoon": "Afternoon",
  "dayPart.evening": "Evening",
  "dayPart.night": "Night",
  // Whole sentences per part of the day, so no language has to bend the part's name to fit.
  "history.best.morning": "You focus best in the morning ({percent}% on average).",
  "history.best.afternoon": "You focus best in the afternoon ({percent}% on average).",
  "history.best.evening": "You focus best in the evening ({percent}% on average).",
  "history.best.night": "You focus best at night ({percent}% on average).",
  "history.bestNotEnough": "Not enough data yet. A time of day counts once it has {count} Advanced-mode sessions.",
  "history.dayPartNeeds": "{sessions} · needs {count} to count",

  "history.distractTitle": "What distracts you",
  "history.categoriesNone": "No distractions logged yet.",
  "history.categoriesNotPicked": "No categories yet. After logging a distraction, tap what caused it.",
  "history.categoriesBasedOn": { one: "Based on {count} distraction with a category.", other: "Based on {count} distractions with a category." },
  "history.categoriesNoneHad": " {count} had none.",
  "history.categoryValue": "{count} · {percent}%",

  // The list title: the no-break spaces keep "sessions (of 40)" together next to the Edit button.
  "history.listLast": "Last {size} sessions\u00a0(of\u00a0{total})",
  "history.lengthFull": "{planned} min",
  "history.lengthPart": "{actual} of {planned} min",
  "history.restartedTag": "restarted",
  "history.restartedTitle": "Saved when you chose Start over",
  "history.noFocusTitle": "Simple mode doesn't measure focus %",
  "history.deleteLabel": "Delete session: {name}, {date}, {time}",
  "history.deleteTitle": "Delete this session?",
  "history.deleteText": "It will be removed from your history and from every number on this page.",
  "history.deleteFailed": "Couldn't delete the session: your browser didn't allow the change.",
  "history.deleted": "Session deleted.",

  "history.backupTitle": "Backup",
  "history.backupText":
    "Your sessions are saved automatically on this device. Export a copy if you switch phones or clear your browser data. Export saves all your sessions as a .json file. Import adds the sessions from such a file; sessions you already have are skipped. Only the newest 1000 sessions are kept: if the total goes over 1000, the oldest sessions are removed.",
  "history.export": "Export history",
  "history.import": "Import history",
  "history.backToTimer": "← Back to the timer",

  // ---------- export / import ----------
  "import.exported": { one: "Exported {count} session.", other: "Exported {count} sessions." },
  "import.tooBig": "This file is too big to be a ConcenTraining export.",
  "import.saveFailed": "Couldn't save the imported sessions: this browser's storage is full or blocked.",
  "import.imported": { one: "Imported {count} session.", other: "Imported {count} sessions." },
  "import.skipped": {
    one: " Skipped {count} duplicate or session you already had.",
    other: " Skipped {count} duplicates or sessions you already had.",
  },
  "import.didNotFit": {
    one: " {count} older session from the file didn't fit (max. {max}).",
    other: " {count} older sessions from the file didn't fit (max. {max}).",
  },
  "import.allTooOld": "Nothing was imported: all new sessions in this file are older than the {max} sessions kept.",
  "import.nothing": "Nothing was imported.",
  "import.nothingNew": "Nothing new to import: you already have every session in this file ({count}).",
  "import.nothingNewValid": "Nothing new to import: you already have every valid session in this file ({count}).",
  "import.removed": {
    one: " Your oldest session was removed to stay under {max}.",
    other: " Your {count} oldest sessions were removed to stay under {max}.",
  },
  "import.invalid": {
    one: " Skipped {count} invalid session ({why}).",
    other: " Skipped {count} invalid sessions ({why}).",
  },
  "import.reasonCount": "{count} {reason}",
  // Problems with the whole file.
  "import.file.notJson": "This file isn't a ConcenTraining export: it isn't valid JSON.",
  "import.file.notExport": "This file isn't a ConcenTraining history export.",
  "import.file.newerVersion": "This export was made by a newer version of ConcenTraining. Reload the page and try again.",
  "import.file.unknownVersion": "This export has an unknown version number.",
  // Why one session in the file was skipped (cleanImportedSession in history-store.js).
  "import.reason.notSession": "not a session",
  "import.reason.badTimes": "bad start or end time",
  "import.reason.unknownEndReason": "unknown end reason",
  "import.reason.badCharacter": "bad character id",
  "import.reason.unknownStyle": "unknown style",
  "import.reason.unknownMode": "unknown mode",
  "import.reason.badDurations": "bad duration fields",
  "import.reason.focusInSimple": "focus % in Simple mode",
  "import.reason.badFocus": "bad focus %",
  "import.reason.noDistractions": "no distraction list",
  "import.reason.badBreakList": "bad break list",
  "import.reason.badBreak": "bad break",
  "import.reason.breakOutside": "break outside the session",
  "import.reason.breaksOverlap": "breaks overlap",
  "import.reason.badDistraction": "bad distraction",
  "import.reason.unknownCategory": "unknown distraction category",
  "import.reason.unknownSource": "unknown distraction source",
  "import.reason.elapsedMismatch": "elapsed time doesn't match start and end",
  "import.reason.tooShort": "shorter than 1 minute",
  "import.reason.badPlanned": "bad planned length",
  "import.reason.longerThanPlanned": "longer than planned",
  "import.reason.endReasonMismatch": "end reason doesn't match the times",
  "import.reason.distractionOutside": "distraction outside the session",
  "import.reason.distractionInBreak": "distraction during a break",
  "import.reason.simpleWithLength": "Simple distraction with a length",
  "import.reason.awayLength": "away distraction length out of range",
  "import.reason.awayLevel": "away distraction level doesn't match its length",
  "import.reason.advancedLength": "Advanced distraction length out of range",
  "import.reason.totalMismatch": "distraction total doesn't add up",
  "import.reason.focusMismatch": "focus % doesn't match distraction time",

  // ---------- character editor (avatar.html) ----------
  "avatar.pageTitle": "Your Character · ConcenTraining",
  "avatar.pageTitleEdit": "Edit Your Character · ConcenTraining",
  "avatar.back": "← Back",
  "avatar.title": "Create your character",
  "avatar.titleEdit": "Edit your character",
  "avatar.preview": "Preview reactions",
  "avatar.randomize": "Randomize",
  "avatar.name": "Name",
  "avatar.personality": "Personality",
  "avatar.personalityFixed": "You can't change this later.",
  "avatar.defaultName": "Your character",
  "avatar.group.base": "Base",
  "avatar.group.costumes": "Costumes",
  "avatar.group.clothes": "Clothes",
  "avatar.group.accessories": "Accessories",
  "avatar.section.gender": "Gender",
  "avatar.section.skin": "Skin tone",
  "avatar.section.hairColor": "Hair colour",
  "avatar.section.face": "Face",
  "avatar.section.hairStyle": "Hairstyle",
  "avatar.section.outfit": "Outfit",
  "avatar.section.costumeOutfit": "Costume outfit",
  "avatar.section.back": "Back",
  "avatar.section.headwear": "Headwear",
  "avatar.section.mask": "Masks and face",
  "avatar.section.earsHorns": "Ears and horns",
  "avatar.section.eyewear": "Eyewear",
  "avatar.section.earrings": "Earrings",
  "avatar.section.necklace": "Necklace",
  "avatar.section.costumeBeard": "Costume beard",
  "avatar.section.facialHair": "Facial hair",
  "avatar.section.held": "Held item",
  "avatar.section.pet": "Shoulder pet",
  "avatar.optionGroup.funny": "Funny",
  "avatar.optionGroup.fantasy": "Fantasy",
  "avatar.costumeIntro": "Tap a costume to put it on. You can still change every part.",
  "avatar.costumeTheme": "Costume theme",
  "avatar.putOn": "Put on the costume: {name}",
  "avatar.putOnDescribed": "Put on the costume: {name}, {description}",
  "avatar.currentCostume": "{theme}, current costume",
  // Screen reader names of the faces, built from their parts (js/avatar-parts.js).
  "avatar.faceLabel": "Face {number}: {parts}",
  "avatar.funnyFaceLabel": "Funny face {number}: {name}",
  "avatar.feature.lashes": "lashes",
  "avatar.feature.lip": "lip tint",
};
