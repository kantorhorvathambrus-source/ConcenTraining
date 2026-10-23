// GET /api/stats
// Popularity of every character, plus which ones would be paid.

import { CHARACTERS } from "../lib/characters.mjs";
import { picksStore, storeKind, utcDay } from "../lib/picks-store.mjs";

const RECENT_DAYS = 30; // popularity = picks in the last 30 days, so the paid set rotates
const MIN_CHARACTERS_FOR_PAID = 10; // monetization starts at 10 characters
const PAID_SHARE = 0.1; // the most popular ~10% become paid

export default async (req, context) => {
  const store = picksStore(context);
  // The last 30 days are today and the 29 days before it (UTC).
  const firstRecentDay = utcDay(RECENT_DAYS - 1);

  const rows = await Promise.all(
    CHARACTERS.map(async (character) => {
      const counts = await store.get(character.id, { type: "json" });
      const days = (counts && counts.days) || {};
      let recentPicks = 0;
      let totalPicks = 0;
      for (const [day, picks] of Object.entries(days)) {
        totalPicks += picks;
        if (day >= firstRecentDay) recentPicks += picks;
      }
      return { id: character.id, name: character.name, recentPicks, totalPicks };
    })
  );
  rows.sort(
    (a, b) =>
      b.recentPicks - a.recentPicks ||
      b.totalPicks - a.totalPicks ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );

  const paidCount =
    rows.length >= MIN_CHARACTERS_FOR_PAID ? Math.max(1, Math.round(rows.length * PAID_SHARE)) : 0;

  return Response.json(
    {
      recentDays: RECENT_DAYS,
      // "live" on the production deploy, "test" everywhere else (see netlify/lib/picks-store.mjs).
      store: storeKind(context),
      characters: rows,
      paidCharacterIds: rows.slice(0, paidCount).map((row) => row.id),
    },
    // Let browsers/CDN reuse the answer for a minute instead of reading the store every time.
    { headers: { "cache-control": "public, max-age=60" } }
  );
};

export const config = {
  path: "/api/stats",
  method: "GET",
};
