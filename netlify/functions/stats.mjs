// GET /api/stats
// Popularity of every character, plus which ones would be paid.

import { getDatabase } from "@netlify/database";

const db = getDatabase();

const RECENT_DAYS = 30; // popularity = picks in the last 30 days, so the paid set rotates
const MIN_CHARACTERS_FOR_PAID = 10; // monetization starts at 10 characters
const PAID_SHARE = 0.1; // the most popular ~10% become paid

export default async () => {
  const rows = await db.sql`
    SELECT
      c.id,
      c.name,
      COALESCE(SUM(p.picks) FILTER (WHERE p.day > CURRENT_DATE - ${RECENT_DAYS}::int), 0)::int AS recent_picks,
      COALESCE(SUM(p.picks), 0)::int AS total_picks
    FROM characters c
    LEFT JOIN character_daily_picks p ON p.character_id = c.id
    GROUP BY c.id, c.name
    ORDER BY recent_picks DESC, total_picks DESC, c.id`;

  const paidCount =
    rows.length >= MIN_CHARACTERS_FOR_PAID ? Math.max(1, Math.round(rows.length * PAID_SHARE)) : 0;

  return Response.json(
    {
      recentDays: RECENT_DAYS,
      characters: rows.map((row) => ({
        id: row.id,
        name: row.name,
        recentPicks: row.recent_picks,
        totalPicks: row.total_picks,
      })),
      paidCharacterIds: rows.slice(0, paidCount).map((row) => row.id),
    },
    // Let browsers/CDN reuse the answer for a minute instead of hitting the database every time.
    { headers: { "cache-control": "public, max-age=60" } }
  );
};

export const config = {
  path: "/api/stats",
  method: "GET",
};
