"use strict";

// Light and dark. Loaded in <head> of every page as an ordinary (blocking) script file, so it runs
// before the browser draws anything: the page never shows in the wrong theme first. The CSP allows
// no inline scripts, so it's a file of its own. See "Light and dark" in the README.
//
// What it does:
//   1. Picks the theme: the one saved in ct_prefs_v1 (theme: "light" | "dark") if the switch was
//      ever tapped, otherwise the phone's or browser's own setting (prefers-color-scheme). While
//      nothing is saved it keeps following that setting, also when it changes while the page is open.
//   2. Sets it as data-theme on <html>. css/style.css holds the colours of both themes (and a
//      prefers-color-scheme fallback for when this script can't run).
//   3. Gives the browser bar (Android Chrome's address bar, the "theme-color" metas) the page
//      background of the theme that's showing.
//   4. Runs the light/dark switch, where a page has one (#darkModeSwitch on the setup screen and
//      the history page): a tap flips the theme and saves it. That's the only place it is saved;
//      from then on the phone's setting is ignored.
const Theme = (() => {
  const PREFS_KEY = "ct_prefs_v1"; // the app's prefs (app.js): the theme is one field in it
  const root = document.documentElement;
  const isTheme = (value) => value === "light" || value === "dark";

  // The phone's setting. null in a browser without matchMedia: light then.
  let phoneDark = null;
  try {
    phoneDark = window.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    phoneDark = null;
  }

  function savedTheme() {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));
      return prefs && isTheme(prefs.theme) ? prefs.theme : null;
    } catch {
      return null; // storage blocked or broken: as if the switch was never tapped
    }
  }

  // The user's own choice: saved, or tapped on this page while the browser wouldn't save it.
  let chosen = savedTheme();
  const current = () => chosen || (phoneDark && phoneDark.matches ? "dark" : "light");

  // Each page has two theme-color metas, one per prefers-color-scheme, holding the light and the
  // dark page background. Both get the colour of the theme that's showing, so the bar also follows
  // a choice that differs from the phone's setting. The colours are remembered from the page
  // itself the first time, so none is repeated in this file.
  let barColors = null;
  function syncBrowserBar(theme) {
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (!metas.length) return; // this script ran before them, or the page has none
    if (!barColors) {
      barColors = {};
      metas.forEach((meta) => {
        barColors[(meta.getAttribute("media") || "").includes("dark") ? "dark" : "light"] = meta.getAttribute("content");
      });
    }
    const color = barColors[theme];
    if (!color) return;
    metas.forEach((meta) => {
      if (meta.getAttribute("content") !== color) meta.setAttribute("content", color);
    });
  }

  // role="switch": on (aria-checked="true") means dark. Only what screen readers hear is set here:
  // how the switch looks comes from the theme's colours in css/style.css.
  function syncSwitch(theme) {
    const button = document.getElementById("darkModeSwitch");
    if (button) button.setAttribute("aria-checked", String(theme === "dark"));
  }

  function apply() {
    const theme = current();
    if (root.getAttribute("data-theme") !== theme) root.setAttribute("data-theme", theme);
    syncBrowserBar(theme);
    syncSwitch(theme);
  }

  // Only the theme field, on top of what's saved now (the same way app.js saves its prefs and
  // i18n.js the language), so no other field is lost and app.js's savePrefs keeps this one.
  function saveTheme(theme) {
    try {
      let prefs = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) prefs = {};
      prefs.theme = theme;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // not saved: this page still switches, the next one follows the phone again
    }
  }

  // A tap on the switch: the other theme, saved.
  function toggle() {
    chosen = current() === "dark" ? "light" : "dark";
    saveTheme(chosen);
    apply();
  }

  // ---------- start ----------

  apply(); // before the first paint: this file is loaded in <head>

  // The phone's setting changed while the page is open. Only matters while nothing is chosen.
  if (phoneDark) {
    try {
      phoneDark.addEventListener("change", apply);
    } catch {
      // very old browsers: the page follows the setting again on its next load
    }
  }

  // The switch was tapped in another tab (or all of the site's data was cleared there).
  window.addEventListener("storage", (event) => {
    if (event.key !== PREFS_KEY && event.key !== null) return;
    chosen = savedTheme();
    apply();
  });

  // Back to a page the browser kept as it was (the back/forward cache): the switch may have been
  // tapped on the page in between.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    chosen = savedTheme() || chosen;
    apply();
  });

  // The page is built: the browser bar (if its metas came after this script) and the switch.
  function start() {
    const button = document.getElementById("darkModeSwitch");
    if (button) button.addEventListener("click", toggle);
    apply();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  return { current, toggle };
})();
