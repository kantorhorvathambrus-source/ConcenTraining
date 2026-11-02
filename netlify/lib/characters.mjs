// Characters whose picks are counted. Only these ids are accepted by POST /api/picks, so random
// requests can't invent new characters, and GET /api/stats lists exactly these.
// A new character in public/js/data/characters.js must be added here too (same id).
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
];
