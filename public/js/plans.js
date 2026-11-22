"use strict";

// Plans: several focus blocks with planned breaks in between (see "Plans" in the README).
// This file has the switch, the lists of lengths, the plan rules (default break, totals, cleaning
// saved data), the plan builder on the setup screen and the segmented timeline. Running a plan
// (blocks, planned breaks, the summary, reloads and tabs) is in app.js.
//
// Saved data:
//   ct_prefs_v1.usePlan: true while "Plan" is picked in step 3 (missing: false, "Single block").
//   ct_prefs_v1.plan = { rows: [ { minutes, count, breakMinutes, breakPicked } ] }: the plan as
//     built on the setup screen. breakPicked: this row's break was picked by hand, so changing its
//     length doesn't reset it. Broken or missing: the first-time plan (30 min ×2, 10 min break).
//   ct_plan_v1: the running plan's progress (cleanStoredPlan below; written by app.js). Removed
//     when the plan's summary shows. ct_session_v1 holds the block that's running, as a normal
//     session: it has no plan fields.

const PLAN_KEY = "ct_plan_v1";

// The switch for the whole feature. It is true: plans are on in production
// (https://concentraining.com) and on the GitHub Pages backup, and work as described in the README.
// Setting it back to false turns them off there: no "Single block | Plan" toggle in step 3, the app
// works exactly as before plans existed, a plan saved in the prefs is ignored but kept, and a
// leftover ct_plan_v1 is ignored and cleared. The test sites below keep plans on either way.
const PLANS_ENABLED = true;

// Netlify's test sites and a local copy always have plans on, whatever the switch says, so they
// can be tried on a phone: Deploy Previews (deploy-preview-80--concentraining.netlify.app), the
// main branch deploy (main--concentraining.netlify.app), localhost and 127.0.0.1.
const PLANS_TEST_SITE = (() => {
  try {
    const host = location.hostname;
    return host.startsWith("deploy-preview-") || host.startsWith("main--") || host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
})();

// Whether plans are on in this page: every check in the app uses this.
const PLANS_ON = PLANS_ENABLED || PLANS_TEST_SITE;

const PLAN_BLOCK_MINUTES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90, 120];
const PLAN_BREAK_MINUTES = [0, 5, 10, 15, 20, 25, 30, 40, 45, 60]; // 0: "No break"
const PLAN_MAX_ROWS = 6;
const PLAN_MAX_COUNT = 6;
const PLAN_FIRST_ROW = { minutes: 30, count: 2, breakMinutes: 10, breakPicked: false };
// A plan whose break ended longer ago than this is closed (its summary shows) when the app is
// opened again, instead of showing "Break over". While the page stays open it keeps waiting.
const PLAN_STALE_MS = 12 * 60 * 60 * 1000;
// More segments than this: the timeline's gaps get thinner, so the segments keep their width.
const TIMELINE_DENSE = 20;

// One third of the block, rounded to the nearest 5, at least 5: 30 → 10, 60 → 20, 90 → 30.
function defaultBreak(minutes) {
  return Math.max(5, Math.round(minutes / 3 / 5) * 5);
}

// The rows saved in the prefs, or the first-time plan if anything about them is wrong.
function cleanPlanRows(saved) {
  const rows = saved && Array.isArray(saved.rows) ? saved.rows : null;
  const first = () => [{ ...PLAN_FIRST_ROW }];
  if (!rows || rows.length < 1 || rows.length > PLAN_MAX_ROWS) return first();
  const clean = [];
  for (const row of rows) {
    if (
      !row || !PLAN_BLOCK_MINUTES.includes(row.minutes) || !PLAN_BREAK_MINUTES.includes(row.breakMinutes) ||
      !Number.isInteger(row.count) || row.count < 1 || row.count > PLAN_MAX_COUNT
    ) {
      return first();
    }
    clean.push({ minutes: row.minutes, count: row.count, breakMinutes: row.breakMinutes, breakPicked: row.breakPicked === true });
  }
  return clean;
}

// Rows → the blocks in order. The very last block never has a break after it.
function expandPlan(rows) {
  const blocks = [];
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) blocks.push({ minutes: row.minutes, breakMinutes: row.breakMinutes });
  }
  if (blocks.length) blocks[blocks.length - 1].breakMinutes = 0;
  return blocks;
}

// Focus minutes, and minutes with the breaks between the blocks.
function planMinutes(blocks) {
  const focus = blocks.reduce((sum, b) => sum + b.minutes, 0);
  const breaks = blocks.reduce((sum, b, i) => sum + (i < blocks.length - 1 ? b.breakMinutes : 0), 0);
  return { focus, total: focus + breaks };
}

// "2 h 30 min", "3 h", "45 min" (Hungarian "2 ó 30 p"): the setup screen's timeline line.
function formatPlanMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return t("plan.min", { minutes: rest });
  return rest ? t("plan.hMin", { hours, minutes: rest }) : t("plan.h", { hours });
}

// "2×30 · 60 · 30" (Quick start). No-break spaces, so it only wraps after a "·".
function planShortText(rows) {
  return rows.map((row) => (row.count > 1 ? `${row.count}×${row.minutes}` : `${row.minutes}`)).join(" · ");
}

// ---------- the running plan (ct_plan_v1) ----------

// { v: 1, startedAt, characterId, characterName?, style, mode, blocks: [{ minutes, breakMinutes }],
//   index, phase: "block" | "break", blockStartedAt, breakStartedAt, parts: [...] }
// index: the block that runs now (phase "block"), or the next one (phase "break": the break after
// block index - 1). blockStartedAt: the startedAt of the block in ct_session_v1. "Break over" isn't
// saved: it's breakStartedAt + the break's length in the past. parts: what each finished block
// measured, for the plan's summary ({ block, startedAt, plannedMs, elapsedMs, distractedMs,
// focusPercent, distractions: [{ level, category }], pauses, status, startedOver }); status is
// "saved", "exists", "failed", "short", "unsaved" or "discarded". null if anything is wrong.
function cleanStoredPlan(raw) {
  if (!raw || raw.v !== 1 || !Array.isArray(raw.blocks) || !Array.isArray(raw.parts)) return null;
  const { blocks } = raw;
  const okBlock = (b) =>
    b && Number.isInteger(b.minutes) && b.minutes >= 1 && b.minutes <= 240 &&
    Number.isInteger(b.breakMinutes) && b.breakMinutes >= 0 && b.breakMinutes <= 60;
  if (blocks.length < 1 || blocks.length > PLAN_MAX_ROWS * PLAN_MAX_COUNT || !blocks.every(okBlock)) return null;
  if (typeof raw.characterId !== "string" || !["simple", "advanced"].includes(raw.mode)) return null;
  if (!Number.isInteger(raw.index) || raw.index < 0 || raw.index >= blocks.length) return null;
  const isTimeValue = (value) => Number.isFinite(value) && value >= 0;
  if (raw.phase === "block" && !isTimeValue(raw.blockStartedAt)) return null;
  if (raw.phase === "break" && (raw.index < 1 || !isTimeValue(raw.breakStartedAt))) return null;
  if (raw.phase !== "block" && raw.phase !== "break") return null;
  if (!raw.parts.every((p) => p && Number.isInteger(p.block) && isTimeValue(p.startedAt) && typeof p.status === "string")) return null;
  return raw;
}

// The planned break that follows the block before index, in ms (0: "No break").
function planBreakMs(p) {
  return p.index > 0 ? p.blocks[p.index - 1].breakMinutes * 60 * 1000 : 0;
}

function planBreakEnd(p) {
  return p.breakStartedAt + planBreakMs(p);
}

// ---------- the timeline (setup screen and session screen) ----------

// One segment per block and per break between blocks.
function planSegments(blocks) {
  const segments = [];
  blocks.forEach((block, i) => {
    segments.push({ kind: "block", minutes: block.minutes, block: i });
    if (i < blocks.length - 1 && block.breakMinutes > 0) segments.push({ kind: "break", minutes: block.breakMinutes, block: i });
  });
  return segments;
}

// A thin bar, each segment as wide as its minutes. Each has a fill (scaled with transform, so the
// only motion is a transform). Returns the segments, for updateTimeline.
function buildTimeline(bar, blocks) {
  bar.textContent = "";
  const segments = planSegments(blocks);
  bar.classList.toggle("dense", segments.length > TIMELINE_DENSE);
  bar.classList.add("fresh"); // the first update jumps, the next ones grow (updateTimeline)
  for (const segment of segments) {
    const el = document.createElement("span");
    el.className = `plan-seg plan-seg-${segment.kind}`;
    el.style.flexGrow = String(segment.minutes);
    const fill = document.createElement("span");
    fill.className = "plan-seg-fill";
    el.append(fill);
    bar.append(el);
  }
  return segments;
}

// Segments before current are full, current is filled by fraction (0–1), the rest are empty.
function updateTimeline(bar, current, fraction) {
  Array.from(bar.children).forEach((el, i) => {
    const amount = i < current ? 1 : i === current ? Math.min(1, Math.max(0, fraction)) : 0;
    el.firstChild.style.transform = `scaleX(${amount})`;
    el.classList.toggle("current", i === current);
  });
  if (bar.classList.contains("fresh")) {
    void bar.offsetWidth; // applies the jump before transitions are on again
    bar.classList.remove("fresh");
  }
}

// ---------- the plan builder (setup screen, step 3) ----------

const PLAN_SVG_NS = "http://www.w3.org/2000/svg";

function svgIcon(className, paths) {
  const svg = document.createElementNS(PLAN_SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of paths) {
    const path = document.createElementNS(PLAN_SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

const CHEVRON_PATHS = ["M7 10l5 5 5-5"];
// A cup with steam, in the same stroke style as the app's other icons.
const CUP_PATHS = ["M4 10h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z", "M16 11h1.5a2.5 2.5 0 0 1 0 5H16", "M8 3.5c-.8 1 .8 2 0 3", "M12 3.5c-.8 1 .8 2 0 3"];

// A native <select> in a pill, with the app's chevron (inline SVG in currentColor, no image).
function pillSelect(options) {
  const wrap = document.createElement("span");
  wrap.className = "pill-select";
  const select = document.createElement("select");
  for (const value of options) {
    const option = document.createElement("option");
    option.value = String(value);
    select.append(option);
  }
  wrap.append(select, svgIcon("pill-select-chevron", CHEVRON_PATHS));
  return { wrap, select };
}

// Builds the plan's rows, "+ Add block", the timeline and its line into container.
// onChange(rows) runs after every change (the rows are a fresh copy). Returns:
//   rows(): the current rows (a copy). relabel(): every text in the current language, keeping
//   the plan and the focused control. refreshTime(): the "ends around" time again.
function planBuilder(container, initialRows, onChange) {
  let rows = initialRows.map((row) => ({ ...row }));
  container.textContent = "";

  const list = document.createElement("ol");
  list.className = "plan-rows";
  const add = document.createElement("button");
  add.type = "button";
  add.className = "plan-add";
  const bar = document.createElement("div");
  bar.className = "plan-timeline preview";
  bar.setAttribute("aria-hidden", "true");
  const line = document.createElement("p");
  line.className = "plan-timeline-text muted";
  container.append(list, add, bar, line);

  let shownLine = "";
  const refreshTime = () => {
    const blocks = expandPlan(rows);
    const { focus, total } = planMinutes(blocks);
    const time = I18N.formatDate(new Date(Date.now() + total * 60 * 1000), { hour: "2-digit", minute: "2-digit" });
    const text = total > focus
      ? t("plan.timeline", { focus: formatPlanMinutes(focus), total: formatPlanMinutes(total), time })
      : t("plan.timelineNoBreaks", { focus: formatPlanMinutes(focus), time });
    if (text !== shownLine) line.textContent = shownLine = text;
  };

  const changed = () => {
    buildTimeline(bar, expandPlan(rows));
    refreshTime();
    onChange(rows.map((row) => ({ ...row })));
  };

  // Fills in one row's texts, values and what's shown (the last row has no break after its last block).
  const syncRow = (li, i) => {
    const row = rows[i];
    const last = i === rows.length - 1;
    const n = i + 1;
    const els = li.planEls;
    els.badge.textContent = String(n);
    els.length.value = String(row.minutes);
    els.length.setAttribute("aria-label", t("plan.lengthLabel", { n }));
    Array.from(els.length.options).forEach((option) => (option.textContent = t("duration.chip", { minutes: option.value })));
    els.stepper.setAttribute("aria-label", t("plan.stepperLabel", { n }));
    els.fewer.setAttribute("aria-label", t("plan.fewer"));
    els.more.setAttribute("aria-label", t("plan.more"));
    els.fewer.setAttribute("aria-disabled", String(row.count <= 1));
    els.more.setAttribute("aria-disabled", String(row.count >= PLAN_MAX_COUNT));
    els.countShown.textContent = `×${row.count}`;
    els.countSpoken.textContent = t("plan.count", { count: row.count });
    const noBreakAtAll = last && row.count === 1;
    els.lastNote.hidden = !noBreakAtAll;
    els.lastNote.textContent = t("plan.lastNoBreak");
    els.after.hidden = noBreakAtAll;
    els.breakWrap.hidden = noBreakAtAll;
    els.after.textContent = t("plan.after");
    els.breakSelect.value = String(row.breakMinutes);
    els.breakSelect.setAttribute("aria-label", t("plan.breakLabel", { n }));
    Array.from(els.breakSelect.options).forEach((option) => {
      const minutes = Number(option.value);
      option.textContent = minutes ? t("plan.breakOption", { minutes }) : t("plan.noBreak");
    });
    els.noneAfter.hidden = !(last && row.count > 1);
    els.noneAfter.textContent = t("plan.noneAfterLast");
    els.remove.hidden = rows.length === 1;
    els.remove.setAttribute("aria-label", t("plan.removeRow", { n }));
  };

  const buildRow = (i) => {
    const li = document.createElement("li");
    li.className = "plan-row";

    const main = document.createElement("div");
    main.className = "plan-row-main";
    const badge = document.createElement("span");
    badge.className = "plan-badge";
    badge.setAttribute("aria-hidden", "true");
    const length = pillSelect(PLAN_BLOCK_MINUTES);
    length.select.dataset.focus = "length";
    const stepper = document.createElement("div");
    stepper.className = "stepper";
    stepper.setAttribute("role", "group");
    const fewer = document.createElement("button");
    fewer.type = "button";
    fewer.className = "stepper-btn";
    fewer.textContent = "−";
    fewer.dataset.focus = "fewer";
    const count = document.createElement("span");
    count.className = "stepper-count";
    count.setAttribute("aria-live", "polite");
    const countShown = document.createElement("span");
    countShown.setAttribute("aria-hidden", "true");
    const countSpoken = document.createElement("span");
    countSpoken.className = "visually-hidden";
    count.append(countShown, countSpoken);
    const more = document.createElement("button");
    more.type = "button";
    more.className = "stepper-btn";
    more.textContent = "+";
    more.dataset.focus = "more";
    stepper.append(fewer, count, more);
    main.append(badge, length.wrap, stepper);

    const breakLine = document.createElement("div");
    breakLine.className = "plan-row-break";
    const after = document.createElement("span");
    after.className = "plan-after";
    const breakSel = pillSelect(PLAN_BREAK_MINUTES);
    breakSel.select.dataset.focus = "break";
    const noneAfter = document.createElement("span");
    noneAfter.className = "plan-note muted";
    const lastNote = document.createElement("span");
    lastNote.className = "plan-note muted";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn plan-remove";
    remove.textContent = "×";
    remove.dataset.focus = "remove";
    const cupAndText = document.createElement("span");
    cupAndText.className = "plan-break-text";
    cupAndText.append(svgIcon("plan-cup", CUP_PATHS), after, lastNote);
    breakLine.append(cupAndText, breakSel.wrap, remove, noneAfter); // the note gets a line of its own (CSS)

    li.append(main, breakLine);
    li.planEls = {
      badge, length: length.select, stepper, fewer, more, countShown, countSpoken,
      after, breakWrap: breakSel.wrap, breakSelect: breakSel.select, noneAfter, lastNote, remove,
    };

    const index = () => Array.from(list.children).indexOf(li);
    length.select.addEventListener("change", () => {
      const row = rows[index()];
      row.minutes = Number(length.select.value);
      if (!row.breakPicked) row.breakMinutes = defaultBreak(row.minutes);
      syncRow(li, index());
      changed();
    });
    breakSel.select.addEventListener("change", () => {
      const row = rows[index()];
      row.breakMinutes = Number(breakSel.select.value);
      row.breakPicked = true;
      changed();
    });
    // aria-disabled instead of disabled at 1 and 6, so keyboard focus isn't lost.
    const step = (by) => {
      const i = index();
      const next = rows[i].count + by;
      if (next < 1 || next > PLAN_MAX_COUNT) return;
      rows[i].count = next;
      syncRow(li, i);
      changed();
    };
    fewer.addEventListener("click", () => step(-1));
    more.addEventListener("click", () => step(1));
    remove.addEventListener("click", () => {
      const i = index();
      if (rows.length === 1) return;
      rows.splice(i, 1);
      render();
      // The row that moved up into this place, or the one before if the last row went.
      focusControl(Math.min(i, rows.length - 1), "length");
      changed();
    });
    return li;
  };

  const focusControl = (i, name) => {
    const li = list.children[i];
    const el = li && li.querySelector(`[data-focus="${name}"]`);
    if (el && !el.hidden && !el.closest("[hidden]")) el.focus();
    else if (li) li.querySelector('[data-focus="length"]').focus();
  };

  const render = () => {
    list.textContent = "";
    rows.forEach((_, i) => list.append(buildRow(i)));
    rows.forEach((_, i) => syncRow(list.children[i], i));
    add.hidden = rows.length >= PLAN_MAX_ROWS;
    add.textContent = t("plan.add");
  };

  add.addEventListener("click", () => {
    if (rows.length >= PLAN_MAX_ROWS) return;
    const lastRow = rows[rows.length - 1];
    rows.push({ minutes: lastRow.minutes, count: 1, breakMinutes: lastRow.breakMinutes, breakPicked: lastRow.breakPicked });
    render();
    focusControl(rows.length - 1, "length");
    changed();
  });

  // A language switch: everything again, the plan and the focused control kept.
  const relabel = () => {
    const active = document.activeElement;
    const li = active && active.closest && active.closest(".plan-row");
    const where = li && list.contains(li) ? { i: Array.from(list.children).indexOf(li), name: active.dataset.focus } : null;
    const addFocused = active === add;
    render();
    buildTimeline(bar, expandPlan(rows));
    shownLine = "";
    refreshTime();
    if (where && where.name) focusControl(where.i, where.name);
    else if (addFocused && !add.hidden) add.focus();
  };

  render();
  buildTimeline(bar, expandPlan(rows));
  refreshTime();
  return { rows: () => rows.map((row) => ({ ...row })), relabel, refreshTime };
}
