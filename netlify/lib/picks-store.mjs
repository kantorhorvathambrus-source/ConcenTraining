// Where the pick counts live: Netlify Blobs, one blob per character, keyed by the character id.
// Each blob holds picks per day (UTC): { "days": { "2026-11-03": 5, "2026-11-04": 2 } }.

import { getStore } from "@netlify/blobs";

// The production deploy (the live branch) counts real users. Every other deploy (Deploy Previews,
// the main branch deploy, netlify dev) counts into a separate test store, so testing never touches
// the live numbers.
export function storeKind(context) {
  return context.deploy && context.deploy.context === "production" ? "live" : "test";
}

// "strong" consistency: a read always sees the latest write, so the counts are never stale.
export function picksStore(context) {
  return getStore({ name: `picks-${storeKind(context)}`, consistency: "strong" });
}

// "2026-11-03" for today in UTC, optionally `daysAgo` days earlier.
export function utcDay(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
