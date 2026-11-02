// Characters whose picks are counted. Only these ids are accepted by POST /api/picks, so random
// requests can't invent new characters, and GET /api/stats lists exactly these.
// A new character in public/js/data/characters.js must be added here too (same id).
// "custom" (custom: true) counts every character users made themselves (the app sends this one id
// for all of them, never their own ids or names). It isn't part of the paid ranking: GET /api/stats
// returns it separately, and custom characters are always paid (see CUSTOM_PAID in
// public/js/custom-characters.js).
export const CHARACTERS = [
  { id: "grandma", name: "Grandma" },
  { id: "leader", name: "Leader" },
  { id: "santa", name: "Santa" },
  { id: "study-buddy", name: "Study Buddy" },
  { id: "coach", name: "Coach" },
  { id: "meditation-guide", name: "Meditation Guide" },
  { id: "professor", name: "Professor" },
  { id: "librarian", name: "Librarian" },
  { id: "surgeon", name: "Surgeon" },
  { id: "boss", name: "Boss" },
  { id: "soldier", name: "Soldier" },
  { id: "headmistress", name: "Headmistress" },
  { id: "grandmaster", name: "Grandmaster" },
  { id: "bodybuilder", name: "Bodybuilder" },
  { id: "influencer", name: "Influencer" },
  { id: "custom", name: "Custom characters", custom: true },
];
