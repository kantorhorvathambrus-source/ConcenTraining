"use strict";

// Design lab (temporary, never merged into main): switches between visual directions for the UI.
// Loaded in <head> of every page, right after css/style.css.
//
//   ?design=N in the address (0-5) picks a direction. It is remembered for this tab in
//   sessionStorage (a browser storage that is cleared when the tab closes), so it survives going
//   from page to page. 0 = today's look: no extra stylesheet at all.
//
// Only on test addresses: Deploy Previews (deploy-preview-N--…), the main branch deploy (main--…)
// and localhost. On any other address (the production domain, GitHub Pages) this file does nothing.
//
// The stylesheet is written into the page with document.write, like the language files in
// js/i18n.js: a stylesheet added that way loads before the browser draws the page, so today's look
// never flashes first. The CSP allows it (it's a file from the site itself, no inline code).
(() => {
  const host = location.hostname;
  const onLabHost =
    host.startsWith("deploy-preview-") || host.startsWith("main--") || host === "localhost" || host === "127.0.0.1";
  if (!onLabHost) return;

  const NAMES = ["Today's look", "Quiet Paper", "Sticker Pop", "Night Lamp", "Training Ground", "Meadow"];
  const STORAGE_KEY = "ct_design_lab";
  const isDesign = (value) => typeof value === "string" && /^[0-5]$/.test(value);

  let design = 0;
  const fromAddress = new URLSearchParams(location.search).get("design");
  if (isDesign(fromAddress)) {
    design = Number(fromAddress);
    try {
      sessionStorage.setItem(STORAGE_KEY, fromAddress);
    } catch {
      // storage blocked: the direction then only holds for this page
    }
  } else {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (isDesign(saved)) design = Number(saved);
    } catch {
      // storage blocked: today's look
    }
  }

  document.documentElement.dataset.design = String(design);
  document.write('<link rel="stylesheet" href="css/design-lab.css">');
  if (design > 0) document.write(`<link rel="stylesheet" href="css/design-${design}.css">`);

  // The browser bar (Android Chrome) gets the direction's page background, so it doesn't stay
  // today's beige above another palette. Read from the stylesheet, so no colour is repeated here.
  function syncBrowserBar() {
    if (design === 0) return;
    const background = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    if (!background) return;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", background));
  }

  // "Design 2 · Sticker Pop": in the page's left margin at the bottom, written upwards, so it
  // never sits on a button. Taps go through it, and screen readers skip it.
  function addLabel() {
    const label = document.createElement("div");
    label.className = "design-lab-label";
    label.setAttribute("aria-hidden", "true");
    label.textContent = `Design ${design} · ${NAMES[design]}`;
    document.body.append(label);
  }

  document.addEventListener("DOMContentLoaded", () => {
    addLabel();
    syncBrowserBar();
    try {
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncBrowserBar);
    } catch {
      // very old browsers: the bar keeps the colour it got on load
    }
  });
})();
