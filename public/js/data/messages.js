// Motivation messages. Each phase has 12 messages that rotate in order;
// the starting message is picked at random when the phase begins.
//   type "fact"  = science-backed fact about focus or learning (kept hedged, no made-up numbers)
//   type "boost" = concrete encouragement or a small action for the current stage of the session
//
// Sessions of 35+ minutes: general (0-10 min) -> hardest (10-20 min)
//                          -> middle (20 min - 85%) -> final (85-100%)
// Shorter sessions:        short (0-85%) -> final (85-100%)

const MOTIVATION = {
  general: [
    { type: "boost", text: "Before anything else: what's the one thing you want done when the timer ends? Pick it now." },
    { type: "fact", text: "The first few minutes of focus feel clunky for almost everyone. Your brain is still loading the task. Keep going and it smooths out." },
    { type: "boost", text: "Phone out of reach, not just face down. If grabbing it takes effort, you'll grab it less." },
    { type: "fact", text: "In one study, people with their phone face down on the desk did worse on a thinking test than people whose phone was in another room." },
    { type: "boost", text: "Make the task smaller, not the session shorter. One page, one problem, one paragraph. Then the next one." },
    { type: "fact", text: "Every switch to something else costs you a little time to get back in. A few quick checks can quietly eat a big part of your session." },
    { type: "boost", text: "A thought keeps popping up? Write it down in three words and go back. Your notes will hold it for you." },
    { type: "fact", text: "Writing down an unfinished to-do can help your mind stop bringing it up again. It doesn't have to be done, just written down." },
    { type: "boost", text: "Don't wait to feel ready. Start badly. A messy first line beats a perfect blank page." },
    { type: "boost", text: "Long session ahead. You don't have to be amazing for all of it, just here for all of it." },
    { type: "fact", text: "Our thoughts drift away from what we're doing close to half the time. Drifting is normal. Coming back fast is the skill you're training." },
    { type: "boost", text: "First milestone: 10 minutes. That's the only one you have to beat right now." },
  ],
  hardest: [
    { type: "boost", text: "If this part feels slow and sticky, that's normal. It isn't a sign you should stop." },
    { type: "boost", text: "Restless? That's the entry fee for deep focus. You're paying it right now, so don't walk out before you get in." },
    { type: "fact", text: "An urge works like a wave: it builds, peaks and fades, often within a minute or two, as long as you don't feed it." },
    { type: "boost", text: "Itching to check something? Notice it, name it (\"that's just the urge\"), and go back to the exact line you were on." },
    { type: "fact", text: "Learning that feels hard often sticks better than learning that feels easy. Struggling here doesn't mean it isn't working." },
    { type: "boost", text: "Stuck? Write down exactly what you don't get. Half the time the question answers itself." },
    { type: "boost", text: "Bored isn't the same as done. The boring part is usually the part that actually moves things forward." },
    { type: "boost", text: "Every time you notice you drifted and come back, that's one rep for your attention. You're not failing, you're training." },
    { type: "boost", text: "You're over 10 minutes in. Quit now and you'll have to pay the warm-up cost all over again later." },
    { type: "boost", text: "Breathe out slowly, longer than you breathe in. Then do the next line, the next problem, the next sentence." },
    { type: "fact", text: "Slow breathing with a long exhale can help calm your body down. It's one of the quickest ways to take the edge off restlessness." },
    { type: "boost", text: "Every minute you push through now is a minute you won't have to do tonight." },
  ],
  middle: [
    { type: "boost", text: "You're past the hardest part. This is where the good work happens, so keep the rhythm." },
    { type: "fact", text: "Right now your brain is doing a good job of tuning things out. One quick phone check can pull you out, and getting back in takes time." },
    { type: "boost", text: "Quick test: cover your notes and explain the last part in your own words. Can't? That's exactly what to look at again." },
    { type: "fact", text: "Testing yourself beats rereading. Pulling an answer out of your memory makes it stick much better than just seeing it again." },
    { type: "boost", text: "Getting bored of the material? Change the method, not the task: stop reading, write three questions, then answer them without looking." },
    { type: "fact", text: "Even a buzz you don't check can break your concentration for a moment. Silent mode is doing real work for you." },
    { type: "boost", text: "Don't measure, just move: the next line, the next problem, the next sentence." },
    { type: "boost", text: "Stuck on one thing for a while? Mark it, skip it, come back at the end. Don't let one problem eat the whole session." },
    { type: "fact", text: "Small wins give your motivation a bigger boost than you'd expect. Finish one small piece now and feel the difference." },
    { type: "boost", text: "Sip of water, sit up, shoulders down. Then straight back in." },
    { type: "boost", text: "You're doing the thing that's easiest to put off. That's exactly why it pays off." },
    { type: "fact", text: "Linking new things to what you already know helps them stick. Ask yourself: what does this remind me of?" },
  ],
  final: [
    { type: "boost", text: "Final stretch. Pick one thing you can fully finish before the timer ends, and finish it." },
    { type: "fact", text: "People tend to speed up as they get close to a goal. Use it: make this your fastest stretch." },
    { type: "boost", text: "The hard part is behind you. These last minutes are the easy ones, so make them count." },
    { type: "fact", text: "We tend to remember an experience by its best moment and by how it ended. End strong and this session will stay with you as a good one." },
    { type: "boost", text: "Leave a note for next time: where you stopped and what the very next step is. Future you will get started in seconds." },
    { type: "boost", text: "Some writers stop in the middle of a sentence on purpose, so it's easy to pick up next time. Ending with a clear next step works the same way." },
    { type: "boost", text: "Don't reach for your phone now. You'd be giving up the easiest minutes of the whole session." },
    { type: "fact", text: "Your brain keeps working on what you studied after you stop. A real break, without scrolling, gives it room to do that." },
    { type: "boost", text: "Plan your reward now: a snack, a walk, a song. Then earn it." },
    { type: "boost", text: "Think back to where you were when you started. That progress is real, and you made it." },
    { type: "boost", text: "Before the timer ends, name three things you covered today. Recalling them now helps them stay." },
    { type: "boost", text: "Last push. Finish this one and you've kept a promise to yourself." },
  ],
  short: [
    { type: "boost", text: "Short session, so no warm-up excuses. Pick the one thing you'll get done and go." },
    { type: "fact", text: "Every switch to something else costs you time to get back in. In a short session, one phone check can cost a big slice." },
    { type: "boost", text: "Phone out of reach, notifications off. This session without it won't hurt anyone." },
    { type: "fact", text: "Our thoughts drift away from what we're doing close to half the time. Drifting is normal. Coming back fast is the skill." },
    { type: "boost", text: "Make the task tiny: one page, one problem, one paragraph. Then the next one." },
    { type: "fact", text: "An urge to check something often fades within a minute or two if you don't act on it. Let it pass." },
    { type: "boost", text: "A thought keeps popping up? Write it down in three words and go back. It'll wait for you." },
    { type: "boost", text: "Don't wait to feel ready. Start messy. You can fix a bad page, but not a blank one." },
    { type: "fact", text: "Testing yourself beats rereading. Cover your notes for a moment and try to recall the main point." },
    { type: "boost", text: "Stuck? Write down exactly what you don't get. Often the question answers itself." },
    { type: "fact", text: "Learning that feels hard often sticks better. Struggling a bit doesn't mean it isn't working." },
    { type: "boost", text: "Short sessions add up. A few focused minutes today beat a perfect plan for tomorrow." },
  ],
};

// Summary screen title for each session result (see sessionResult in history-store.js).
const SUMMARY_TITLES = {
  great: "Great session!",
  okay: "Good effort!",
  rough: "Tough session",
  short: "That was quick",
};

// Shown under the title for sessions under 1 minute, in both modes.
const SUMMARY_SHORT_NOTE = "Sessions shorter than 1 minute aren't saved to your history.";

// End-of-session messages for Simple mode (it has no stats), one is picked at random.
const SIMPLE_SUMMARY_MESSAGES = {
  great: [
    "You showed up and put in the work.",
    "Every session makes the next one a little easier.",
    "Give yourself a proper break. You earned it.",
    "That's one more focus session in the bag.",
  ],
  okay: [
    "Some distractions crept in, but you kept coming back. That's the skill.",
    "Not perfect, but solid. Every time you came back counted.",
    "A few bumps along the way. Next time, try putting your phone further away.",
    "You got real work done. Aim for a few fewer distractions next time.",
  ],
  rough: [
    "Lots of distractions this time. That happens to everyone.",
    "Tough one. A shorter session next time might be easier to protect.",
    "Your focus got pulled away a lot today. Tomorrow is a fresh start.",
    "Hard session. Notice what kept distracting you, and plan around it next time.",
  ],
};
