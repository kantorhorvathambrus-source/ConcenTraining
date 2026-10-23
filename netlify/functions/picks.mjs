// POST /api/picks  { "characterId": "grandma" }
// Counts one session started with this character (popularity statistics).
// Sent once per Start session press; Start over and a restored session don't send it.

import { CHARACTERS } from "../lib/characters.mjs";
import { picksStore, utcDay } from "../lib/picks-store.mjs";

const CHARACTER_IDS = new Set(CHARACTERS.map((character) => character.id));

// How often a pick is retried when another pick for the same character was saved in between.
const MAX_ATTEMPTS = 8;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async (req, context) => {
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
  if (!CHARACTER_IDS.has(characterId)) {
    return new Response("Unknown character", { status: 404 });
  }

  const store = picksStore(context);
  const day = utcDay();

  // Adds 1 to today's count without losing picks that arrive at the same moment: the new value is
  // only saved if the blob is still the version that was read (its etag). If another pick was
  // saved in between, Blobs refuses the write, so read again and retry after a random wait that
  // doubles each time (up to 50, 100, ... 3200 ms), so a burst of picks spreads out instead of
  // colliding again.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const entry = await store.getWithMetadata(characterId, { type: "json" });
    // Without an etag the write below would not be conditional and could overwrite another pick.
    if (entry && !entry.etag) {
      throw new Error(`Blob ${characterId} was read without an etag`);
    }
    const days = (entry && entry.data && entry.data.days) || {};
    days[day] = (days[day] || 0) + 1;

    const { modified } = await store.setJSON(
      characterId,
      { days },
      entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true }
    );
    if (modified) {
      return new Response(null, { status: 204 });
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(Math.random() * 25 * 2 ** attempt);
    }
  }

  console.error(`Pick for ${characterId} not saved: still conflicting after ${MAX_ATTEMPTS} attempts`);
  return new Response("Too many picks at once, try again", { status: 503 });
};

export const config = {
  path: "/api/picks",
  method: "POST",
  // Stops one visitor from inflating the numbers: max 30 picks per minute per IP.
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
