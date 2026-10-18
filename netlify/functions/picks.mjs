// POST /api/picks  { "characterId": "grandma" }
// Counts one tap on a character card (popularity statistics).

import { getDatabase } from "@netlify/database";

// One shared client for every request (a new one per request would run out of connections).
const db = getDatabase();

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Expected a JSON body", { status: 400 });
  }

  const characterId = body && body.characterId;
  if (typeof characterId !== "string" || characterId.length === 0 || characterId.length > 64) {
    return new Response("Missing characterId", { status: 400 });
  }

  // Adds 1 to today's count. The database does the "+ 1" itself, so taps that
  // arrive at the same moment are never lost. Unknown ids insert nothing.
  const rows = await db.sql`
    INSERT INTO character_daily_picks (character_id, day, picks)
    SELECT id, CURRENT_DATE, 1 FROM characters WHERE id = ${characterId}
    ON CONFLICT (character_id, day)
    DO UPDATE SET picks = character_daily_picks.picks + 1
    RETURNING character_id`;

  if (rows.length === 0) {
    return new Response("Unknown character", { status: 404 });
  }
  return new Response(null, { status: 204 });
};

export const config = {
  path: "/api/picks",
  method: "POST",
  // Stops one visitor from inflating the numbers: max 30 taps per minute per IP.
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
