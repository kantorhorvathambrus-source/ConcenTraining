// Motivation messages. Each phase has 12 messages that rotate in order;
// the starting message is picked at random when the phase begins.
//   type "fact"  = a finding from research, kept hedged, no made-up numbers.
//                  Every fact has a "// source:" comment; the full references are listed below.
//   type "boost" = a concrete, optional action or a calm reframe for this stage of the session.
// Tone: informational, never controlling (no "must", no guilt, no pressure, no emoji).
// Every boost is doable in about 10 seconds, in your head or with one movement, no writing.
// The only exception is "Leave a note for next time…" in final.
// Noticing a distraction and coming back is the skill the app trains, so it's framed as a success.
//
// Sessions of 35+ minutes: general (0-10 min) -> hardest (10-20 min)
//                          -> middle (20 min - 85%) -> final (85-100%)
// Shorter sessions:        short (0-85%) -> final (85-100%)
//
// References (short names used in the source comments):
//   Amabile & Kramer 2011   - The Progress Principle. Harvard Business Review Press.
//   Bjork 1994              - Bjork, R. A. Memory and metamemory considerations in the training of human beings.
//                             In Metacognition: Knowing about knowing. MIT Press. ("desirable difficulties")
//   Balban et al. 2023      - Brief structured respiration practices enhance mood and reduce physiological
//                             arousal. Cell Reports Medicine 4(1).
//   Dewar et al. 2012       - Brief wakeful resting boosts new memories over the long term. Psychological Science 23(9).
//   Dunlosky et al. 2013    - Improving students' learning with effective learning techniques.
//                             Psychological Science in the Public Interest 14(1).
//   Gollwitzer & Sheeran 2006 - Implementation intentions and goal achievement: a meta-analysis.
//                             Advances in Experimental Social Psychology 38.
//   Harkin et al. 2016      - Does monitoring goal progress promote goal attainment? A meta-analysis.
//                             Psychological Bulletin 142(2).
//   Kahneman et al. 1993    - When more pain is preferred to less: adding a better end. Psychological Science 4(6).
//   Killingsworth & Gilbert 2010 - A wandering mind is an unhappy mind. Science 330(6006).
//   Kivetz, Urminsky & Zheng 2006 - The goal-gradient hypothesis resurrected. Journal of Marketing Research 43(1).
//   Kross et al. 2014       - Self-talk as a regulatory mechanism: how you do it matters.
//                             Journal of Personality and Social Psychology 106(2).
//   Leroy 2009              - Why is it so hard to do my work? The challenge of attention residue when switching
//                             between work tasks. Organizational Behavior and Human Decision Processes 109(2).
//   Masicampo & Baumeister 2011 - Consider it done! Plan making can eliminate the cognitive effects of
//                             unfulfilled goals. Journal of Personality and Social Psychology 101(4).
//   Mrazek et al. 2013      - Mindfulness training improves working memory capacity and GRE performance while
//                             reducing mind wandering. Psychological Science 24(5).
//   Roediger & Karpicke 2006 - Test-enhanced learning. Psychological Science 17(3).
//   Stothart, Mitchum & Yehnert 2015 - The attentional cost of receiving a cell phone notification.
//                             Journal of Experimental Psychology: Human Perception and Performance 41(4).
//   Ward et al. 2017        - Brain drain: the mere presence of one's own smartphone reduces available cognitive
//                             capacity. Journal of the Association for Consumer Research 2(2).
//   Böttger, Poschik & Zierer 2023 - Does the brain drain effect really exist? A meta-analysis.
//                             Behavioral Sciences 13(9). (Found an effect; some replications didn't, hence "some studies".)

const MOTIVATION = {
  general: [
    { type: "boost", text: "Before you start: what's the one thing you want done when the timer ends? Name it in a few words." },
    { type: "boost", text: "A slow start is normal. Give it a few minutes before you judge how this session is going." },
    { type: "boost", text: "Put your phone where you'd have to get up to reach it. That one extra step is often enough to stop the reflex." },
    // source: Ward et al. 2017; Böttger, Poschik & Zierer 2023
    { type: "fact", text: "Some studies found that just having your phone in sight can make thinking a little harder. Not all of them did. Another room is the safe bet." },
    { type: "boost", text: "Make the first step tiny: open the file, write one line, read one paragraph. Starting is the hard part, not the step." },
    // source: Leroy 2009
    { type: "fact", text: "When you switch tasks, part of your attention stays on the last one for a while. Researchers call it attention residue." },
    { type: "boost", text: "Decide now what you'll do when an urge comes: \"When I want to check my phone, I'll take one breath and keep going.\"" },
    // source: Gollwitzer & Sheeran 2006
    { type: "fact", text: "If-then plans (\"When X happens, I'll do Y\") make people clearly more likely to follow through on what they set out to do." },
    { type: "boost", text: "Something unfinished on your mind? Decide when you'll deal with it, for example \"after this session\". Then it can wait." },
    // source: Masicampo & Baumeister 2011
    { type: "fact", text: "Making a specific plan for an unfinished task can stop it from popping into your head while you work on something else." },
    // source: Killingsworth & Gilbert 2010
    { type: "fact", text: "People's minds wander from what they're doing close to half the time. Drifting is normal. Noticing and coming back is the skill you're training." },
    { type: "boost", text: "First stop: minute 10. That's the only one that matters right now." },
  ],
  hardest: [
    { type: "boost", text: "If this part feels slow and sticky, that's common. It isn't a sign that you should stop." },
    { type: "boost", text: "An urge to check something? Notice it and name it: \"that's an urge\". Urges tend to rise and fade when you don't act on them." },
    // source: Mrazek et al. 2013
    { type: "fact", text: "In one study, two weeks of mindfulness training reduced mind wandering and improved test scores. Noticing and coming back is a core part of it." },
    { type: "boost", text: "You noticed you drifted. That's the rep. Come back to the exact line you were on, not the top of the page." },
    // source: Bjork 1994
    { type: "fact", text: "Learning that feels hard, like recalling instead of rereading, often sticks better than learning that feels easy. Effort here can be a good sign." },
    { type: "boost", text: "Stuck? Say to yourself in one sentence exactly what you don't get. Often the next step shows up while you say it." },
    { type: "boost", text: "Bored isn't the same as done. Keep the task, change the angle: start from a different part of it." },
    { type: "boost", text: "Breathe in, then take a second short breath in, then breathe out slowly and fully. Twice. Then the next line." },
    // source: Balban et al. 2023
    { type: "fact", text: "In a month-long study, five minutes a day of breathing with long exhales improved mood more than the same time spent on mindfulness meditation." },
    // source: Kross et al. 2014
    { type: "fact", text: "In experiments, people who talked to themselves as \"you\" or by their own name, instead of \"I\", stayed calmer and did better under stress." },
    { type: "boost", text: "Shrink the goal for the next five minutes: one problem, one paragraph, one email. Then decide again." },
    { type: "boost", text: "You're past minute 10. The rest of this session doesn't have to feel good to be worth it." },
  ],
  middle: [
    { type: "boost", text: "You're in the long middle stretch. A steady pace works better here than a fast one." },
    // source: Stothart, Mitchum & Yehnert 2015
    { type: "fact", text: "A notification you don't even check can still pull your attention away for a moment. Silent mode is doing real work for you." },
    { type: "boost", text: "Quick check: without looking, try to recall the last part. What you can't recall is what to look at again." },
    // source: Roediger & Karpicke 2006
    { type: "fact", text: "Testing yourself beats rereading. Pulling an answer out of your memory makes it stick better than seeing it again." },
    { type: "boost", text: "Stuck on one thing for a while? Mark it, skip it and come back at the end. One problem doesn't get the whole session." },
    // source: Amabile & Kramer 2011
    { type: "fact", text: "In a diary study, people's best workdays had one thing in common most often: progress on something that mattered to them, even a small step." },
    { type: "boost", text: "Finish one small piece now. Look at the clock after that, not before." },
    { type: "boost", text: "Sip of water, sit up, shoulders down. Then straight back in." },
    // source: Dunlosky et al. 2013
    { type: "fact", text: "Asking yourself \"why is this true?\" and linking it to what you already know helps new material stick." },
    { type: "boost", text: "Notice where you are right now: which line, which step. If you drift later, you'll know exactly where to come back to." },
    // source: Harkin et al. 2016
    { type: "fact", text: "Keeping track of your progress makes reaching a goal more likely, especially when you write it down." },
    { type: "boost", text: "This is the kind of part that's easiest to put off. You're doing it anyway." },
  ],
  final: [
    { type: "boost", text: "Final stretch. Pick one thing you can fully finish before the timer ends, and finish it." },
    // source: Kivetz, Urminsky & Zheng 2006
    { type: "fact", text: "People tend to speed up as a goal gets close. You can use that pull right now." },
    // source: Kahneman et al. 1993
    { type: "fact", text: "We tend to remember an experience by its most intense moment and by how it ended. Good last minutes shape how this session feels later." },
    { type: "boost", text: "Leave a note for next time: where you stopped and what the very next step is. Getting started again will take seconds." },
    { type: "boost", text: "Stop at a point where you know what comes next. That makes the next session much easier to start." },
    { type: "boost", text: "Your phone can wait a few more minutes. Let the timer finish first." },
    // source: Dewar et al. 2012
    { type: "fact", text: "Resting quietly for a few minutes after learning, with no new input, helped people remember more a week later." },
    { type: "boost", text: "Plan your break now: a walk, a snack, a stretch. Something away from a screen." },
    { type: "boost", text: "Before the timer ends, name three things you did in this session. Recalling them helps them stay." },
    { type: "boost", text: "Think back to where you were when you started. What you got done since then is real progress." },
    // source: Masicampo & Baumeister 2011
    { type: "boost", text: "Something still unfinished? Decide what the next step is and when you'll do it. Then you can let it go for today." },
    { type: "boost", text: "Last few minutes. Finish the piece in front of you and end on something done." },
  ],
  short: [
    { type: "boost", text: "Short session, so no long warm-up needed. Pick the one thing you'll get done and start." },
    // source: Leroy 2009
    { type: "fact", text: "When you switch tasks, part of your attention stays on the last one for a while. In a short session, every switch costs a big slice." },
    { type: "boost", text: "Phone out of reach and on silent. The session is short, so it can wait." },
    // source: Killingsworth & Gilbert 2010
    { type: "fact", text: "People's minds wander close to half the time. Drifting is normal. Coming back quickly is the skill you're training." },
    { type: "boost", text: "Make the task tiny: one page, one problem, one paragraph. Then the next one." },
    { type: "boost", text: "An urge to check something? Name it (\"that's an urge\") and let it pass. Then back to the exact line you were on." },
    // source: Masicampo & Baumeister 2011
    { type: "boost", text: "A thought keeps coming back? Tell yourself when you'll deal with it, for example \"after this session\", and carry on." },
    { type: "boost", text: "No need to feel ready first. Start messy. You can fix a bad first draft, but not a blank page." },
    // source: Roediger & Karpicke 2006
    { type: "fact", text: "Testing yourself beats rereading. Cover your notes for a moment and try to recall the main point." },
    // source: Stothart, Mitchum & Yehnert 2015
    { type: "fact", text: "A notification you don't check can still pull your attention away. Silent mode helps more than it seems." },
    { type: "boost", text: "Stuck? Say to yourself in one sentence exactly what you don't get. Often the next step shows up while you say it." },
    { type: "boost", text: "Short sessions add up. A few focused minutes today do more than a perfect plan for tomorrow." },
  ],
};

// Summary screen title for each session result (see sessionResult in history-store.js).
const SUMMARY_TITLES = {
  great: "Great session!",
  okay: "Good effort!",
  rough: "Tough session",
  early: "Ended early",
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
  // Ended before half the planned time: neutral, no praise and no guilt.
  early: [
    "You stopped early. That's fine if you finished what you came for.",
    "Ended before the timer. If the job's done, that counts.",
    "You called it early. Next time, pick a length that fits the task.",
    "Shorter than planned. What matters is what you got done.",
  ],
};
