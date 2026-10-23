// Campaign page: the roll sheet, the spiral diagram, weaving the rolls into a
// campaign with Claude, revisions and undo, and the hand-off of first-ring sites
// to the Location page.
import { $, esc, svgNS, renderMarkdown } from "../shared/dom.js";
import { docTitle, slug } from "../shared/format.js";
import { SETTINGS, SETTING_IDS } from "../data/index.js";
import { store, state, turns, S, T, setTurns, save, HISTORY_MAX, freshLoc, jobs } from "../app/state.js";
import { claude } from "../shared/claude.js";
import { slotHTML, readRoll, virtualRoll } from "../ui/roll-sheet.js";
import { updateDock, anyBusy, setBusy, showView } from "../app/shell.js";
import { isUnsaved, libSave, updateLibButtons, stashOrStop, loadLocation } from "./library.js";
import { nOpen, renderNotionPanel } from "./notion.js";
import { lsetStatus } from "./location.js";

// ---------- slots ----------
// Which table each slot rolls on; filled in as the sheet is built.
export const SLOT_DEFS = {};

// Rebuild the roll sheet and every setting-specific bit of wording for the current setting.
export function buildSheet() {
  const u = S.ui;
  document.documentElement.dataset.setting = store.setting;
  const setText = (id, txt) => { document.getElementById(id).textContent = txt; };
  setText("ui-lede", S.lede);
  setText("ui-pitch-h", u.pitchH); setText("ui-pitch-hint", u.pitchHint);
  setText("ui-start-h", u.startH); setText("ui-start-hint", u.startHint);
  setText("ui-fronts-h", u.frontsH); setText("ui-fronts-hint", u.frontsHint);
  setText("ui-locs-h", u.locsH); setText("ui-locs-hint", u.locsHint);
  setText("ui-notes-hint", u.notesHint);
  document.getElementById("notes").placeholder = u.notesPh;
  document.getElementById("refine-text").placeholder = u.refinePh;

  document.getElementById("slot-pitch").innerHTML = slotHTML("pitch", "pitch", "", false, SLOT_DEFS);
  document.getElementById("slot-start").innerHTML = slotHTML("start", "start", "", false, SLOT_DEFS);
  document.getElementById("fronts").innerHTML = [0,1,2].map(i => `
    <div class="sub" id="front-block-${i}">
      <div class="sub-title">${store.setting === "spelljammer" ? "Threat" : "Front"} ${i + 1}</div>
      ${slotHTML("front" + i, "front", store.setting === "spelljammer" ? "Threat" : "Front", false, SLOT_DEFS)}
      ${slotHTML(`front${i}-beh`, "behavior", "Leader's behavior", true, SLOT_DEFS)}
      ${slotHTML(`front${i}-anc`, "ancestry", u.ancestry, true, SLOT_DEFS)}
    </div>`).join("");
  document.getElementById("locs").innerHTML = [0,1,2].map(i => `
    <div class="sub">
      <div class="sub-title">${u.loc} ${i + 1}</div>
      ${slotHTML("loc" + i, "loc", u.loc, false, SLOT_DEFS)}
      ${slotHTML(`loc${i}-desc`, "desc", store.setting === "spelljammer" ? "Condition" : "Description", true, SLOT_DEFS)}
      ${slotHTML(`loc${i}-origin`, "origin", u.origin, true, SLOT_DEFS)}
    </div>`).join("");

  document.getElementById("setting-seg").innerHTML = SETTING_IDS.map(id =>
    `<button type="button" data-setting="${id}" aria-pressed="${id === store.setting}">${SETTINGS[id].name}</button>`).join("");
}
function emptyHTML() {
  return `<div class="empty">
    <strong>Your campaign appears here.</strong>
    <ol>
      <li>Roll each die at the table and type the number. The entry fills in.</li>
      <li>Edit any entry's text if you'd rather have your own idea.</li>
      <li>Press <em>Weave the campaign</em>. You'll get ${S.ui.emptyGet}.</li>
    </ol>
  </div>`;
}

export function valueOf(id) {
  const custom = state.text[id];
  if (custom != null && custom !== "") return custom;
  const n = state.slots[id];
  return n ? T[SLOT_DEFS[id]][n - 1] : "";
}
export function paintSlot(id) {
  const n = state.slots[id];
  document.getElementById("n-" + id).value = n || "";
  document.getElementById("t-" + id).value = valueOf(id);
}
export function setRoll(id, n) {
  const max = T[SLOT_DEFS[id]].length;
  n = Number.isFinite(n) && n >= 1 && n <= max ? Math.floor(n) : null;
  state.slots[id] = n;
  delete state.text[id];
  state.example = false;
  paintSlot(id); save(); drawSpiral();
}

function paintFronts() {
  document.querySelectorAll("[data-fronts]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.fronts) === state.fronts)));
  [0,1,2].forEach(i => document.getElementById("front-block-" + i).hidden = i >= state.fronts);
}
export function activeIds() {
  return Object.keys(SLOT_DEFS).filter(id => { const m = id.match(/^front(\d)/); return !m || Number(m[1]) < state.fronts; });
}

// ---------- spiral diagram ----------
export function drawSpiral() {
  const svg = document.getElementById("spiral");
  svg.innerHTML = "";
  const cx = 90, cy = 90;
  // Archimedean spiral guide
  let d = "";
  for (let t = 0; t <= 6 * Math.PI; t += 0.12) {
    const r = 4 + t * 4.2;
    d += (d ? "L" : "M") + (cx + r * Math.cos(t)).toFixed(1) + " " + (cy + r * Math.sin(t)).toFixed(1);
  }
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", d); path.setAttribute("fill", "none");
  path.setAttribute("stroke", "var(--line)"); path.setAttribute("stroke-width", "1.5");
  svg.appendChild(path);
  const dot = (r, ang, color, size, filled) => {
    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", cx + r * Math.cos(ang)); c.setAttribute("cy", cy + r * Math.sin(ang));
    c.setAttribute("r", size); c.setAttribute("fill", filled ? color : "var(--panel)");
    c.setAttribute("stroke", color); c.setAttribute("stroke-width", "2");
    svg.appendChild(c);
  };
  dot(0, 0, "var(--ring1)", 9, !!valueOf("start"));
  [0,1,2].forEach(i => dot(38, -Math.PI / 2 + i * 2.1, "var(--ring2)", 6.5, !!valueOf("loc" + i)));
  for (let i = 0; i < state.fronts; i++) dot(74, -Math.PI / 2 + 1.05 + i * (2 * Math.PI / Math.max(state.fronts, 1)), "var(--ring3)", 7.5, !!valueOf("front" + i));

  const lg = document.getElementById("legend");
  const locs = [0,1,2].map(i => valueOf("loc" + i)).filter(Boolean);
  const fronts = [...Array(state.fronts).keys()].map(i => valueOf("front" + i)).filter(Boolean);
  lg.innerHTML = `
    <div><i style="background:var(--brass)"></i><div><b>Pitch</b><br><span>${esc(valueOf("pitch") || "Not rolled")}</span></div></div>
    <div><i style="background:var(--ring1)"></i><div><b>${S.ui.center}</b><br><span>${esc(valueOf("start") || "Not rolled")}</span></div></div>
    <div><i style="background:var(--ring2)"></i><div><b>First ring</b><br><span>${esc(locs.join(" · ") || "Not rolled")}</span></div></div>
    <div><i style="background:var(--ring3)"></i><div><b>${S.ui.frontsH === "Campaign Fronts" ? "Fronts" : "Threats"}</b><br><span>${esc(fronts.join(" · ") || "Not rolled")}</span></div></div>`;
  updateDock();
}

// ---------- output and Claude ----------
const doc = document.getElementById("doc");
const statusEl = document.getElementById("status");
export const btnWeave = document.getElementById("btn-weave");
const btnStop = document.getElementById("btn-stop");
const btnCopy = document.getElementById("btn-copy");
const btnSave = document.getElementById("btn-save");
const btnUndo = document.getElementById("btn-undo");
const refineBox = document.getElementById("refine");

export function setStatus(msg, err) { statusEl.textContent = msg || ""; statusEl.classList.toggle("err", !!err); }
function render(md) { doc.innerHTML = renderMarkdown(md); addSiteButtons(); }

function rollsSummary() {
  const line = (label, id) => {
    const n = state.slots[id], v = valueOf(id);
    if (!v) return `- ${label}: (not rolled — invent something fitting)`;
    const custom = state.text[id] ? " (GM's own entry)" : (n ? ` (rolled ${n})` : "");
    return `- ${label}: ${v}${custom}`;
  };
  const L = S.rollLabels;
  const F = store.setting === "spelljammer" ? "Threat" : "Front";
  const D = store.setting === "spelljammer" ? "condition" : "description";
  const out = [line("Campaign pitch", "pitch"), line(L.start, "start")];
  for (let i = 0; i < state.fronts; i++) {
    out.push(line(`${F} ${i + 1}`, "front" + i));
    out.push(line(`  ${F} ${i + 1} leader behavior`, `front${i}-beh`));
    out.push(line(`  ${F} ${i + 1} ${L.anc}`, `front${i}-anc`));
  }
  for (let i = 0; i < 3; i++) {
    out.push(line(`${L.loc} ${i + 1}`, "loc" + i));
    out.push(line(`  ${L.loc} ${i + 1} ${D}`, `loc${i}-desc`));
    out.push(line(`  ${L.loc} ${i + 1} ${L.origin}`, `loc${i}-origin`));
  }
  return out.join("\n");
}

function instructions() {
  return `${S.intro}

THE ROLLS
${rollsSummary()}

GM NOTES
${(state.notes || "").trim() || "(none)"}

Write the campaign in Markdown with exactly these sections, in this order. Be concrete and evocative but brief; this is a GM's prep sheet, not a novel. Give everything proper names.

${S.sections}

Output only the Markdown document.`;
}

async function ask(input, label) {
  if (!claude.sample || anyBusy()) return;
  const mine = jobs.campaign = new AbortController(), target = state, fresh = typeof input === "string";
  setBusy(); btnStop.hidden = false;
  setStatus(label + " Thinking… this can take up to a minute.");
  let streamed = false;
  try {
    const { text, truncated } = await claude.sample(input, {
      signal: mine.signal, cache: false,
      onText: ({ text }) => { if (!streamed) { streamed = true; setStatus("Writing…"); } if (target === state) render(text); }
    });
    if (target !== state) return; // the open campaign changed underneath; never write into the wrong one
    // A fresh weave is a new campaign: keep any unsaved revisions of the library item
    // it replaces, then unlink it so saving makes a new item instead of overwriting.
    if (fresh && state.output) {
      if (state.libId && isUnsaved("campaign")) libSave("campaign", true);
      state.libId = null; state.savedHash = null;
    }
    if (state.output && state.output !== text) {
      state.history = [...(state.history || []), state.output].slice(-HISTORY_MAX);
    }
    state.output = text; save();
    setTurns([{ role: "user", content: typeof input === "string" ? input : input[0].content }, { role: "assistant", content: text }]);
    setStatus(truncated ? "Cut off at the length limit. Ask for less in a revision." : "Done.", truncated);
    showOutputTools(true);
  } catch (e) {
    if (target === state) { if (e.text) render(e.text); else if (state.output) render(state.output); }
    const msg = {
      cancelled: "Stopped.",
      not_granted: "Claude isn't allowed for this page. You can still use the roll sheet.",
      sampling_disabled: "Claude isn't available on this account.",
      rate_limited: "Too many requests right now. Wait a minute and try again.",
      session_expired: "Your session expired. Sign in again, then retry.",
      refused: "Claude declined that request. Try different wording.",
    }[e.code] || "Something went wrong reaching Claude. Try again.";
    setStatus(msg, e.code !== "cancelled");
    if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e.code)) btnWeave.hidden = true;
  } finally {
    if (jobs.campaign === mine) jobs.campaign = null;
    setBusy(); btnStop.hidden = true;
  }
}

export function showOutputTools(on) {
  updateLibButtons();
  if (on) addSiteButtons();
  btnCopy.hidden = !on; btnSave.hidden = !on || !claude.downloads; refineBox.hidden = !on || !claude.sample;
  const n = (state.history || []).length;
  btnUndo.hidden = !on || !n;
  btnUndo.textContent = n > 1 ? `Undo (${n})` : "Undo";
}

// ---------- campaign → location hand-off ----------
// Adds "Build this site" under each first-ring site in a woven campaign.
function addSiteButtons() {
  if (doc.querySelector(".site-btn")) return;
  const h2s = [...doc.querySelectorAll("h2")];
  const ring = h2s.find(h => /first ring/i.test(h.textContent));
  if (!ring) return;
  let el = ring.nextElementSibling, i = 0;
  while (el && el.tagName !== "H2") {
    if (el.tagName === "H3") {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "site-btn"; btn.dataset.site = String(i++);
      btn.textContent = "Build this site on the Location tab →";
      el.after(btn); el = btn;
    }
    el = el.nextElementSibling;
  }
}

// Paint everything from the current setting's saved sheet.
export function refreshAll() {
  nOpen.campaign = false; renderNotionPanel("campaign");
  state.slots ||= {}; state.text ||= {}; state.history ||= [];
  Object.keys(SLOT_DEFS).forEach(id => { if (!(id in state.slots)) state.slots[id] = null; });
  Object.keys(SLOT_DEFS).forEach(paintSlot);
  document.getElementById("notes").value = state.notes || "";
  document.getElementById("refine-text").value = "";
  paintFronts(); drawSpiral();
  if (state.output) render(state.output); else doc.innerHTML = emptyHTML();
  showOutputTools(!!state.output);
  setStatus(state.example ? "Example rolls loaded. Replace them with your own, or clear them." : "");
}

export function initCampaign() {
  buildSheet();
  const sheet = $("sheet");
  sheet.addEventListener("input", e => {
    const el = e.target;
    if (el.id?.startsWith("n-")) {
      const id = el.id.slice(2);
      const max = T[SLOT_DEFS[id]].length;
      const n = readRoll(el.value, max);
      state.slots[id] = n;
      delete state.text[id];
      document.getElementById("t-" + id).value = valueOf(id);
      el.setCustomValidity(el.value && !n ? `Enter 1 to ${max} (00 counts as ${max})` : "");
    } else if (el.id?.startsWith("t-")) {
      const id = el.id.slice(2);
      const n = state.slots[id];
      const tableVal = n ? T[SLOT_DEFS[id]][n - 1] : "";
      if (el.value === tableVal) delete state.text[id]; else state.text[id] = el.value;
    } else if (el.id === "notes") {
      state.notes = el.value;
    }
    state.example = false;
    save(); drawSpiral();
  });
  sheet.addEventListener("change", e => {
    const el = e.target;
    if (el.id?.startsWith("n-") && state.slots[el.id.slice(2)]) el.value = state.slots[el.id.slice(2)];
  });
  sheet.addEventListener("submit", e => e.preventDefault());
  sheet.addEventListener("click", e => {
    const id = e.target.dataset?.roll;
    if (id) setRoll(id, virtualRoll(SLOT_DEFS[id]));
  });

  document.querySelectorAll("[data-fronts]").forEach(b => b.addEventListener("click", () => {
    state.fronts = Number(b.dataset.fronts); save(); paintFronts(); drawSpiral();
  }));

  btnWeave.addEventListener("click", () => ask(instructions(), "Weaving your rolls together."));
  btnStop.addEventListener("click", () => jobs.campaign?.abort());
  document.getElementById("btn-refine").addEventListener("click", () => {
    const txt = document.getElementById("refine-text").value.trim();
    if (!txt) { setStatus("Describe the change you want first.", true); return; }
    const base = turns.length ? turns : [{ role: "user", content: instructions() }, { role: "assistant", content: state.output }];
    ask([...base, { role: "user", content: `Revise the campaign with this change, keeping everything else consistent: ${txt}\n\nReturn the complete revised Markdown document in the same structure.` }], "Revising.");
    document.getElementById("refine-text").value = "";
  });
  btnUndo.addEventListener("click", () => {
    const h = state.history || [];
    if (!h.length || jobs.campaign) return;
    state.output = h.pop();
    state.history = h;
    setTurns([]); // next revision builds on the restored version
    save(); render(state.output); showOutputTools(true);
    setStatus(h.length ? `Restored the previous version. ${h.length} more to go back.` : "Restored the previous version.");
  });
  btnCopy.addEventListener("click", () => {
    navigator.clipboard.writeText(state.output).then(() => setStatus("Copied as Markdown."), () => {
      const r = document.createRange(); r.selectNodeContents(doc);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      setStatus("Copy was blocked. The text is selected; press Ctrl/Cmd+C.");
    });
  });
  btnSave.addEventListener("click", async () => {
    const name = slug(state.output.match(/^#\s+(.+)$/m)?.[1], "spiral-campaign");
    try { await claude.downloads.save({ filename: name + ".md", data: state.output }); setStatus("Saved."); }
    catch (e) { setStatus(e.code === "declined" ? "" : "Couldn't save the file here. Use Copy instead.", e.code !== "declined"); }
  });

  doc.addEventListener("click", e => {
    const b = e.target.closest(".site-btn"); if (!b || anyBusy()) return;
    const h3 = b.previousElementSibling; const site = h3.textContent.replace(/^\s*\d+[.)]\s*/, "").trim();
    let ex = [h3.textContent], el = b.nextElementSibling;
    while (el && !/^H[23]$/.test(el.tagName)) { ex.push(el.innerText || el.textContent); el = el.nextElementSibling; }
    const name = docTitle(state.output, "the campaign");
    const pitch = (state.output.match(/^>\s*(.+)$/m) || [])[1] || "";
    const threats = (() => {
      const fh = [...doc.querySelectorAll("h2")].find(h => /front|threat/i.test(h.textContent)); if (!fh) return "";
      const out = []; let n = fh.nextElementSibling;
      while (n && n.tagName !== "H2") { if (n.tagName === "H3") out.push(n.textContent.trim()); n = n.nextElementSibling; }
      return out.join("; ");
    })();
    const st = stashOrStop("location"); if (!st.ok) return;
    const kept = st.kept;
    const f = freshLoc(store.setting); Object.keys(f.slots).forEach(k => f.slots[k] = null);
    f.example = false; f.text = { "l-loc": site };
    f.fromCampaign = { campaign: name, site, pitch, threats, excerpt: ex.join("\n").trim().slice(0, 2000) };
    loadLocation(f, null, null); showView("location");
    lsetStatus(`Loaded "${site}" from your campaign. Roll or fill anything you like, then build it.` + (kept ? " Your previous location was saved to the library." : ""));
    updateLibButtons();
  });
}
