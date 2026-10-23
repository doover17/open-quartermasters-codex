// Location page: one standalone adventure site at a time. Its roll sheet,
// building and revising the write-up with Claude, the link back to the campaign
// it came from, and the tools under the write-up (copy, save, map export, undo).
import { $, renderMarkdown, selectContents } from "../shared/dom.js";
import { fileStem } from "../shared/format.js";
import { LOC } from "../data/index.js";
import { store, state, lstate, lturns, ystate, T, setLocationTurns, setLayout, freshLayout, save, lsave, HISTORY_MAX, LSLOT_IDS, jobs } from "../app/state.js";
import { claude } from "../shared/claude.js";
import { slotHTML, readRoll, virtualRoll } from "../ui/roll-sheet.js";
import { updateDock, anyBusy, setBusy } from "../app/shell.js";
import { splitMap, drawMap, wireframeSvgDocument } from "../map/wireframe.js";
import { isUnsaved, libSave, updateLibButtons } from "./library.js";
import { nOpen, renderNotionPanel } from "./notion.js";

const LSIZES = { small: 5, medium: 8, large: 12, huge: 16 };
export const LSLOT_DEFS = {};

export function buildLocSheet() {
  const L = LOC[store.setting];
  document.getElementById("ui-lplace-h").textContent = store.setting === "spelljammer" ? "The Site" : "The Place";
  document.getElementById("ui-lplace-hint").textContent = L.placeHint;
  document.getElementById("lnotes").placeholder = L.notesPh;
  document.getElementById("lslots-place").innerHTML =
    slotHTML("l-loc", "loc", store.setting === "spelljammer" ? "Site" : "Location", false, LSLOT_DEFS) +
    slotHTML("l-desc", "desc", L.descLabel, true, LSLOT_DEFS) +
    slotHTML("l-origin", "origin", L.originLabel, true, LSLOT_DEFS);
  document.getElementById("lslots-occ").innerHTML =
    slotHTML("l-occ", "front", L.occLabel, false, LSLOT_DEFS) +
    slotHTML("l-occ-beh", "behavior", "Leader's behavior", true, LSLOT_DEFS) +
    slotHTML("l-occ-anc", "ancestry", L.ancLabel, true, LSLOT_DEFS);
  document.getElementById("lchips").innerHTML = L.chips.map(c => `<button type="button" data-chip="${c.replace(/"/g, "&quot;")}">${c}</button>`).join("");
}

export function lvalueOf(id) {
  const custom = lstate.text[id];
  if (custom != null && custom !== "") return custom;
  const n = lstate.slots[id], table = T[LSLOT_DEFS[id]];
  return n && table ? table[n - 1] || "" : "";
}
export function lpaintSlot(id) {
  document.getElementById("n-" + id).value = lstate.slots[id] || "";
  document.getElementById("t-" + id).value = lvalueOf(id);
}
export function lsetRoll(id, n) {
  const max = T[LSLOT_DEFS[id]].length;
  lstate.slots[id] = Number.isFinite(n) && n >= 1 && n <= max ? Math.floor(n) : null;
  delete lstate.text[id];
  lstate.example = false;
  lpaintSlot(id); lsave(); updateDock();
}
function paintSize() {
  document.querySelectorAll("[data-size]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.size === lstate.size)));
}

// ---------- prompt ----------
function lrollsSummary() {
  const L = LOC[store.setting];
  const line = (label, id) => {
    const n = lstate.slots[id], v = lvalueOf(id);
    if (!v) return `- ${label}: (not rolled — invent something fitting)`;
    const custom = lstate.text[id] ? " (GM's own entry)" : (n ? ` (rolled ${n})` : "");
    return `- ${label}: ${v}${custom}`;
  };
  return [
    line(store.setting === "spelljammer" ? "Kind of site" : "Kind of place", "l-loc"),
    line(L.descLabel, "l-desc"),
    line(L.originLabel + " (who made it)", "l-origin"),
    line("Current occupants", "l-occ"),
    line("  Occupant leader behavior", "l-occ-beh"),
    line("  Occupant " + L.ancLabel.toLowerCase().replace("leader's ", "leader "), "l-occ-anc"),
  ].join("\n");
}
function linstructions() {
  const n = LSIZES[lstate.size] || 8;
  const five = lstate.size === "small"
    ? `\nShape the five areas as a five-room dungeon: 1 entrance with a guardian, 2 a puzzle or roleplaying challenge, 3 a trick or setback, 4 the climax, 5 a reward with a twist.`
    : "";
  return `You are helping a tabletop RPG game master who follows the "Lazy Dungeon Master" approach prepare ONE adventure location. ${lstate.fromCampaign
    ? `It is a site from the GM's campaign "${lstate.fromCampaign.campaign}". Keep it consistent with the campaign excerpt below, keep its name, and tie its hooks, NPCs, and secrets to the campaign's threats.`
    : "It doesn't belong to any campaign; make it self-contained and drop-in ready, with its own hooks."} Write what the GM needs at the table, not a novel: short, concrete, evocative, scannable. Give everything proper names. Use every rolled result, reinterpreting creatively when a literal reading doesn't fit, and invent anything not rolled.

${LOC[store.setting].context}

${lstate.fromCampaign ? `FROM THE CAMPAIGN
Campaign: ${lstate.fromCampaign.campaign}
Pitch: ${lstate.fromCampaign.pitch || "(none)"}
Threats: ${lstate.fromCampaign.threats || "(none)"}
This site, as the campaign describes it:
${lstate.fromCampaign.excerpt}

` : ""}THE ROLLS
${lrollsSummary()}

SIZE: exactly ${n} keyed areas.${five}

GM NOTES
${(lstate.notes || "").trim() || "(none)"}

Write it in Markdown with exactly these sections, in this order:

# <Location name>
> <One sentence the GM reads aloud when the characters first see it>

**At a glance:** <kind of place> · <${n} areas> · <suggested level range> · <the one thing players will remember>

## Overview
3-4 sentences: what it is, what it looks like on approach, and why it matters right now.

## Hooks
3 bullets, each a different reason a party might come here.

## History
3 bullets: who built it and why, what went wrong, and how it came to its present state.

## Inhabitants
Who holds it now (use the rolled occupants and leader), what they want, how they react to intruders, and one rival or wandering threat. 1-2 short paragraphs.

## Named NPCs
4-6 bullets: **Name** (ancestry or species, role, one-word demeanor) — what they want, what they know, a secret, and one roleplaying cue (a phrase, habit, or voice). Note which keyed area each is usually found in.

## Keyed Areas
For each area, in number order: a heading "### N. Area Name", then one line of read-aloud text in italics, then 2-4 short bullets covering what's here (creatures, NPCs, features), any hazard, trap, or puzzle and how to get past it, any treasure, and the exits. Areas must match the map below exactly.

## Secrets and Clues
Six numbered one-sentence secrets that can be discovered in this location, written without saying how they're found.

## Treasure
3-5 bullets of notable treasure, each with a hook (who wants it, or what it unlocks).

## Random Encounters
A d6 Markdown table of things that happen or wander by while the party is here.

## Map
Finish with a single fenced code block marked json and nothing after it. It describes the map's layout:
{"areas":[{"id":1,"name":"Short Name","x":0,"y":0,"kind":"entrance"}],"links":[{"from":1,"to":2,"type":"door"}]}
Map rules:
- Exactly ${n} areas, ids 1 to ${n}, matching the keyed areas' numbers and names (names 1-3 words).
- x and y are integer grid cells, x from 0 to 6 and y from 0 to 5, and no two areas share a cell. Lay it out like a real place: area 1 at the edge, linked areas in neighboring cells (side by side or diagonal) wherever possible, with only a few longer links.
- kind is one of: entrance, room, hall, cave, shrine, lair, vault, hazard, exterior.
- type is one of: open, door, locked, secret, stairs, oneway. Use stairs for any change of level (stairs, shafts, lifts, ladders).
- Make it non-linear: at least one loop, more than one way to reach the climax, and at least one secret link.`;
}

// ---------- generate / revise ----------
// The write-up, its status line, and the tool buttons under it.
const ldoc = document.getElementById("ldoc");
const lstatusEl = document.getElementById("lstatus");
export const btnLBuild = document.getElementById("btn-lbuild");
const btnLStop = document.getElementById("btn-lstop");
const btnLCopy = document.getElementById("btn-lcopy");
const btnLSave = document.getElementById("btn-lsave");
const btnLSvg = document.getElementById("btn-lsvg");
const btnLUndo = document.getElementById("btn-lundo");
const btnLRefine = document.getElementById("btn-lrefine");
const lrefineBox = document.getElementById("lrefine");

export function lsetStatus(msg, err) { lstatusEl.textContent = msg || ""; lstatusEl.classList.toggle("err", !!err); }
function lemptyHTML() {
  return `<div class="empty">
    <strong>Your location appears here.</strong>
    <ol>
      <li>Roll the place and its occupants, or type your own ideas over any entry.</li>
      <li>Pick a size and add notes: party level, mood, anything it must have.</li>
      <li>Press <em>Build the location</em>. You'll get hooks, history, inhabitants, named NPCs, ${LSIZES[lstate.size] || 8} keyed areas with a map, secrets, treasure, and random encounters.</li>
    </ol>
  </div>`;
}
function lrender(md, final) {
  const { body, map } = splitMap(md || "");
  ldoc.innerHTML = renderMarkdown(body);
  if (final !== false) drawMap(map);
  const t = (body.match(/^#\s+(.+)$/m) || [])[1];
  document.getElementById("map-title").textContent = t ? t + " · Map" : "Map";
}
export function lshowTools(on) {
  updateLibButtons();
  const hasMap = on && !!splitMap(lstate.output).map;
  btnLCopy.hidden = !on; btnLSave.hidden = !on || !claude.downloads; btnLSvg.hidden = !hasMap || !claude.downloads;
  lrefineBox.hidden = !on || !claude.sample;
  const n = (lstate.history || []).length;
  btnLUndo.hidden = !on || !n; btnLUndo.textContent = n > 1 ? `Undo (${n})` : "Undo";
}

async function lask(input, label) {
  if (!claude.sample || anyBusy()) return;
  const mine = jobs.location = new AbortController(), target = lstate, fresh = typeof input === "string";
  setBusy(); btnLStop.hidden = false;
  lsetStatus(label + " Thinking… this can take a minute or two.");
  drawMap(null);
  let streamed = false;
  try {
    const { text, truncated } = await claude.sample(input, {
      signal: mine.signal, cache: false,
      onText: ({ text }) => { if (!streamed) { streamed = true; lsetStatus("Writing…"); } if (target === lstate) lrender(text, false); }
    });
    if (target !== lstate) return;
    // A fresh build is a new location: keep unsaved revisions of the library item it
    // replaces, unlink it, and start its layout over (the old one has different areas).
    if (fresh && lstate.output) {
      if (lstate.libId && isUnsaved("location")) libSave("location", true);
      lstate.libId = null; lstate.savedHash = null;
      const keepOpts = { ...ystate.opts, level: null };
      setLayout(store.layouts[store.setting] = freshLayout()); ystate.opts = keepOpts;
    }
    if (lstate.output && lstate.output !== text) lstate.history = [...(lstate.history || []), lstate.output].slice(-HISTORY_MAX);
    lstate.output = text; lsave();
    setLocationTurns([{ role: "user", content: typeof input === "string" ? input : input[0].content }, { role: "assistant", content: text }]);
    if (jobs.location === mine) jobs.location = null;
    lrender(text);
    const ok = !!splitMap(text).map;
    lsetStatus(truncated ? "Cut off at the length limit. Try a smaller size, or ask for less in a revision."
      : ok ? "Done." : "Done, but the map didn't come through. Ask Claude to redraw it.", truncated || !ok);
    lshowTools(true);
  } catch (e) {
    if (jobs.location === mine) jobs.location = null;
    if (target === lstate) {
      if (e.text) lrender(e.text); else lrender(lstate.output);
      if (!lstate.output && !e.text) { ldoc.innerHTML = lemptyHTML(); }
    }
    const msg = {
      cancelled: "Stopped.",
      not_granted: "Claude isn't allowed for this page. You can still use the roll sheet.",
      sampling_disabled: "Claude isn't available on this account.",
      rate_limited: "Too many requests right now. Wait a minute and try again.",
      session_expired: "Your session expired. Sign in again, then retry.",
      refused: "Claude declined that request. Try different wording.",
    }[e.code] || "Something went wrong reaching Claude. Try again.";
    lsetStatus(msg, e.code !== "cancelled");
  } finally {
    if (jobs.location === mine) jobs.location = null;
    setBusy(); btnLStop.hidden = true;
  }
}


export function refreshLoc() {
  nOpen.location = false; renderNotionPanel("location");
  lstate.slots ||= {}; lstate.text ||= {};
  LSLOT_IDS.forEach(id => { if (!(id in lstate.slots)) lstate.slots[id] = null; });
  lstate.history ||= []; lstate.size ||= "medium";
  LSLOT_IDS.forEach(lpaintSlot);
  document.getElementById("lnotes").value = lstate.notes || "";
  document.getElementById("lrefine-text").value = "";
  paintSize();
  if (lstate.output) lrender(lstate.output); else { ldoc.innerHTML = lemptyHTML(); drawMap(null); document.getElementById("map-title").textContent = "Map"; }
  lshowTools(!!lstate.output);
  paintLinkBanner();
  lsetStatus(lstate.example ? "Example rolls loaded. Replace them with your own, or clear them." : "");
}

function paintLinkBanner() {
  const fc = lstate.fromCampaign;
  document.getElementById("llink").hidden = !fc;
  if (fc) document.getElementById("llink-name").textContent = `${fc.site} (${fc.campaign})`;
}

export function initLocation() {
  const lsheet = $("lsheet");
  lsheet.addEventListener("input", e => {
    const el = e.target;
    if (el.id?.startsWith("n-")) {
      const id = el.id.slice(2), max = T[LSLOT_DEFS[id]].length;
      const n = readRoll(el.value, max);
      lstate.slots[id] = n; delete lstate.text[id];
      document.getElementById("t-" + id).value = lvalueOf(id);
      el.setCustomValidity(el.value && !n ? `Enter 1 to ${max} (00 counts as ${max})` : "");
    } else if (el.id?.startsWith("t-")) {
      const id = el.id.slice(2), n = lstate.slots[id];
      const tableVal = n ? T[LSLOT_DEFS[id]][n - 1] : "";
      if (el.value === tableVal) delete lstate.text[id]; else lstate.text[id] = el.value;
    } else if (el.id === "lnotes") {
      lstate.notes = el.value;
    }
    lstate.example = false;
    lsave(); updateDock();
  });
  lsheet.addEventListener("change", e => {
    const el = e.target;
    if (el.id?.startsWith("n-") && lstate.slots[el.id.slice(2)]) el.value = lstate.slots[el.id.slice(2)];
  });
  lsheet.addEventListener("submit", e => e.preventDefault());
  lsheet.addEventListener("click", e => {
    const id = e.target.dataset?.roll;
    if (id) lsetRoll(id, virtualRoll(LSLOT_DEFS[id]));
    const size = e.target.closest("[data-size]")?.dataset.size;
    if (size) { lstate.size = size; lsave(); paintSize(); }
  });

  btnLBuild.addEventListener("click", () => lask(linstructions(), "Building your location."));
  btnLStop.addEventListener("click", () => jobs.location?.abort());
  btnLRefine.addEventListener("click", () => {
    const box = document.getElementById("lrefine-text"), txt = box.value.trim();
    if (!txt) { lsetStatus("Describe what to flesh out first.", true); return; }
    const base = lturns.length ? lturns : [{ role: "user", content: linstructions() }, { role: "assistant", content: lstate.output }];
    lask([...base, { role: "user", content: `Revise the location with this change, keeping everything else consistent: ${txt}\n\nReturn the complete revised Markdown document in the same structure, ending with the updated json map block. Keep the keyed areas and the map in sync; if you add areas, number them after the existing ones.` }], "Revising.");
    box.value = "";
  });
  document.getElementById("lchips").addEventListener("click", e => {
    const c = e.target.closest("[data-chip]"); if (!c) return;
    const box = document.getElementById("lrefine-text");
    box.value = box.value.trim() ? box.value.trim() + " " + c.dataset.chip + "." : c.dataset.chip + ".";
    box.focus();
  });
  btnLUndo.addEventListener("click", () => {
    const h = lstate.history || [];
    if (!h.length || jobs.location) return;
    lstate.output = h.pop(); lstate.history = h; setLocationTurns([]);
    lsave(); lrender(lstate.output); lshowTools(true);
    lsetStatus(h.length ? `Restored the previous version. ${h.length} more to go back.` : "Restored the previous version.");
  });
  btnLCopy.addEventListener("click", () => {
    const body = splitMap(lstate.output).body;
    navigator.clipboard.writeText(body).then(() => lsetStatus("Copied as Markdown."), () => {
      selectContents(ldoc);
      lsetStatus("Copy was blocked. The text is selected; press Ctrl/Cmd+C.");
    });
  });
  btnLSave.addEventListener("click", async () => {
    try { await claude.downloads.save({ filename: fileStem(lstate.output, "location") + ".md", data: splitMap(lstate.output).body + "\n" }); lsetStatus("Saved."); }
    catch (e) { lsetStatus(e.code === "declined" ? "" : "Couldn't save the file here. Use Copy instead.", e.code !== "declined"); }
  });
  // Export the map as a standalone SVG with the current theme's colors baked in.
  btnLSvg.addEventListener("click", async () => {
    try { await claude.downloads.save({ filename: fileStem(lstate.output, "location") + "-map.svg", data: wireframeSvgDocument() }); lsetStatus("Map saved."); }
    catch (e) { lsetStatus(e.code === "declined" ? "" : "Couldn't save the map here.", e.code !== "declined"); }
  });
  document.getElementById("btn-lunlink").addEventListener("click", () => { delete lstate.fromCampaign; lsave(); paintLinkBanner(); lsetStatus("This location is standalone now."); });
}
