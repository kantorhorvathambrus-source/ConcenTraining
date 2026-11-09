// stats.html: loads the pick counts from api/stats and fills in the tables.
// In its own file (not inline in the page) because the Content-Security-Policy only allows
// scripts from the site's own files (script-src 'self'), see netlify.toml.
"use strict";

async function loadStats() {
  const status = document.getElementById("statsStatus");
  try {
    const response = await fetch("api/stats");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const stats = await response.json();

    // Which counts these are: the live site's, or the separate test counts of Deploy Previews
    // and the main branch deploy.
    const storeNote = document.getElementById("storeNote");
    storeNote.textContent =
      stats.store === "live"
        ? "Reading the live counts (the production site)."
        : "Reading the test counts (Deploy Previews and the main branch deploy), not the live numbers.";
    storeNote.hidden = false;

    document.getElementById("recentHeader").textContent = `Last ${stats.recentDays} days`;
    const body = document.querySelector("#statsTable tbody");
    for (const character of stats.characters) {
      const row = document.createElement("tr");
      const paid = stats.paidCharacterIds.includes(character.id) ? " (paid)" : "";
      for (const text of [character.name + paid, character.recentPicks, character.totalPicks]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.append(cell);
      }
      body.append(row);
    }

    document.getElementById("paidNote").textContent = stats.paidCharacterIds.length
      ? `Paid right now: the top ${stats.paidCharacterIds.length} by the last ${stats.recentDays} days.`
      : `No paid characters yet: that starts once there are at least 10 built-in characters.`;
    document.getElementById("statsTable").hidden = false;

    // Older backends (before custom characters) don't send it. Not shown while custom
    // characters are switched off (the backend still counts "custom").
    if (stats.customPicks && CUSTOM_CHARACTERS_ON) {
      document.getElementById("customRecentHeader").textContent = `Last ${stats.recentDays} days`;
      document.getElementById("customRecent").textContent = stats.customPicks.recentPicks;
      document.getElementById("customTotal").textContent = stats.customPicks.totalPicks;
      document.getElementById("customTable").hidden = false;
    }
    status.hidden = true;
  } catch (error) {
    status.textContent = `Couldn't load stats (${error.message}). They only work on the deployed Netlify site.`;
  }
}

loadStats();
