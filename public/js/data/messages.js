// Motivation messages. Each phase has 10 messages that rotate in order;
// the starting message is picked at random when the phase begins.
//   type "fact"  = neuroscience-style fact
//   type "boost" = encouragement for the current stage of the session
//
// Sessions of 35+ minutes: general (0-10 min) -> hardest (10-20 min)
//                          -> middle (20 min - 85%) -> final (85-100%)
// Shorter sessions:        short (0-85%) -> final (85-100%)

const MOTIVATION = {
  general: [
    { type: "boost", text: "You started. That's honestly the hardest step. Now it's just about staying." },
    { type: "fact", text: "Getting into focus takes a little warm-up. Feeling clunky in the first few minutes is normal." },
    { type: "boost", text: "Just this one task. Everything else can wait until the timer ends." },
    { type: "fact", text: "When you switch to something else, part of your attention stays stuck on it for a while. Psychologists call this \"attention residue\"." },
    { type: "boost", text: "Phone face down, or even better, in another room. Future you says thanks." },
    { type: "fact", text: "Minds wander a lot, close to half of waking time in some studies. Noticing it and coming back is the real skill." },
    { type: "boost", text: "Small goal: just make it to the 10-minute mark." },
    { type: "fact", text: "Your brain loves novelty, which is why notifications are so tempting. Fewer cues around you means less to resist." },
    { type: "boost", text: "You don't need to feel motivated to keep going. Just do the next small thing." },
    { type: "boost", text: "Long session ahead, so pace yourself. Steady beats perfect." },
  ],
  hardest: [
    { type: "fact", text: "Many people find the first ~20 minutes the hardest. It usually gets easier after that." },
    { type: "boost", text: "This is the hardest part, but you can do it." },
    { type: "fact", text: "The urge to check something usually fades within a minute or two if you don't act on it. Let it pass like a wave." },
    { type: "boost", text: "Feeling restless right now means you're pushing through the tough part. It doesn't mean you're failing." },
    { type: "boost", text: "Hang on until the 20-minute mark. It's closer than it feels." },
    { type: "fact", text: "Every time you notice a distraction and come back, you train your attention, like a rep at the gym." },
    { type: "boost", text: "Bored? Good. Boredom is often the doorway to deep focus." },
    { type: "fact", text: "Resisting distractions feels like effort because your brain is still settling into the task. That settling gets easier with time." },
    { type: "boost", text: "You've already made it past 10 minutes. Don't give that away now." },
    { type: "boost", text: "Tough stretch. Breathe out slowly, then do the next line, the next problem, the next sentence." },
  ],
  middle: [
    { type: "boost", text: "You made it through the hardest part. Now ride the momentum." },
    { type: "fact", text: "Once you're \"in the zone\", your brain tunes out a lot of what's around you. Protect this state." },
    { type: "boost", text: "Nice work. You're in the middle stretch. Just keep the rhythm." },
    { type: "fact", text: "Deep focus is when real learning happens: your brain links new information to what you already know." },
    { type: "boost", text: "Stuck on something? Stay with it a bit longer before switching. That's often where it clicks." },
    { type: "fact", text: "A glass of water can help. Even mild dehydration can make it harder to concentrate." },
    { type: "boost", text: "You're doing the thing most people put off. Be proud of that." },
    { type: "fact", text: "Sitting up straight and breathing slowly can help you feel more alert." },
    { type: "boost", text: "Don't keep checking how much is left. Just keep going; the timer will tell you." },
    { type: "boost", text: "Focus is a muscle, and you're working it right now." },
  ],
  final: [
    { type: "boost", text: "Final stretch! Finish strong." },
    { type: "boost", text: "Almost there. Don't stop now, the finish line is right in front of you." },
    { type: "fact", text: "Ending a session on a strong note makes it easier to start the next one." },
    { type: "boost", text: "Use these last minutes to wrap up a piece of work you can feel good about." },
    { type: "fact", text: "Your brain keeps processing what you studied after you stop, so a real break after this helps it sink in." },
    { type: "boost", text: "You've done most of the work already. Just a few more minutes." },
    { type: "boost", text: "Sprint mode: pick one small thing and finish it before the timer ends." },
    { type: "fact", text: "Rewarding yourself after the session (a snack, a walk, some music) helps your brain link focus with something good." },
    { type: "boost", text: "Look how far you've come in this session. Bring it home." },
    { type: "boost", text: "Last push. Future you is already proud." },
  ],
  short: [
    { type: "boost", text: "Short and focused beats long and distracted. Let's go." },
    { type: "fact", text: "Every time you notice a distraction and come back, you train your attention." },
    { type: "boost", text: "Just this one task until the timer ends." },
    { type: "fact", text: "Switching tasks leaves \"attention residue\": part of your mind stays on the old thing. Sticking to one task avoids it." },
    { type: "boost", text: "Phone face down. Eyes on your work." },
    { type: "fact", text: "Minds wander naturally. The skill isn't never wandering, it's coming back quickly." },
    { type: "boost", text: "You don't need to feel motivated. Just do the next small step." },
    { type: "fact", text: "The urge to check something usually fades within a minute or two if you don't act on it." },
    { type: "boost", text: "Every focused minute counts. You're stacking them up." },
    { type: "boost", text: "Stay with it. You've got this." },
  ],
};

// End-of-session messages for Simple mode (no stats, just a "well done").
const SIMPLE_SUMMARY_MESSAGES = [
  "You showed up and put in the work.",
  "Every session makes the next one a little easier.",
  "Give yourself a proper break. You earned it.",
  "That's one more focus session in the bag.",
];
