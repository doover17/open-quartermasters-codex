// The page shell: tabs and views, the setting picker, the roll-sheet toolbar,
// the floating Weave bar on phones, and the one-request-at-a-time busy state.
import { $, smooth } from "../shared/dom.js";
import { SETTINGS } from "../data/index.js";
import { store, state, lstate, save, lsave, setSetting, jobs, LSLOT_IDS } from "./state.js";
import { claude } from "../shared/claude.js";
import { virtualRoll } from "../ui/roll-sheet.js";
import { SLOT_DEFS, buildSheet, refreshAll, valueOf, paintSlot, setRoll, activeIds, drawSpiral, setStatus, btnWeave } from "../features/campaign.js";
import { LSLOT_DEFS, buildLocSheet, refreshLoc, lvalueOf, lpaintSlot, lsetRoll, lsetStatus, btnLBuild } from "../features/location.js";
import { refreshLayout } from "../features/layout.js";
import { updateLibButtons, renderLib } from "../features/library.js";

// ---------- page tabs ----------
// What each tab does when it opens; the tool tabs register theirs in main.js.
const viewHandlers = {};
export function onView(view, fn) { viewHandlers[view] = fn; }

const VIEWS = ["campaign", "location", "layout", "bestiary", "encounters", "combat", "spells", "items", "loot", "library"];
export function showView(view) {
  store.view = VIEWS.includes(view) ? view : "campaign";
  VIEWS.forEach(v => { document.getElementById("view-" + v).hidden = store.view !== v; });
  // the roll-sheet tools and the floating Weave bar don't apply to the Layout page
  const sheetless = store.view === "layout" || store.view === "library" || store.view === "bestiary" || store.view === "items" || store.view === "loot" || store.view === "spells" || store.view === "encounters" || store.view === "combat";
  document.querySelector(".toolbar").hidden = sheetless;
  document.getElementById("ui-lede").hidden = ["bestiary", "encounters", "combat", "spells", "items", "loot", "library"].includes(store.view);
  dock.hidden = sheetless;
  viewHandlers[store.view]?.();
  document.querySelectorAll(".tabs [data-view]").forEach(b => {
    const on = b.dataset.view === store.view;
    b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
    if (on) { const t = b.closest(".tabs"), tr = t.getBoundingClientRect(), br = b.getBoundingClientRect(); if (t.scrollWidth > t.clientWidth) t.scrollLeft += (br.left - tr.left) - (tr.width - br.width) / 2; }
  });
  dockBtn.textContent = store.view === "location" ? "Build the location ↓" : "Weave the campaign ↓";
  if (sheetless) { save(); return; }
  updateDock(); save();
}

// ---------- floating Weave bar (phones) ----------
const dock = document.getElementById("dock");
const dockBtn = document.getElementById("btn-dock-weave");
const dockCount = document.getElementById("dock-count");
export function updateDock() {
  const loc = store.view === "location";
  const ids = loc ? LSLOT_IDS : activeIds();
  const done = ids.filter(id => (loc ? lvalueOf : valueOf)(id)).length;
  dockCount.innerHTML = `<b>${done}</b> of ${ids.length} rolled`;
}

// One request at a time: everything that starts or switches work is disabled while
// any Claude request (campaign, location, layout, GM sheet) is in flight.
export function anyBusy() { return !!(jobs.campaign || jobs.location || jobs.layout || jobs.sheet); }
export function setBusy() {
  const busy = anyBusy();
  [btnWeave, btnLBuild, $("btn-undo"), $("btn-lundo"), dockBtn, $("btn-refine"), $("btn-lrefine"),
   document.getElementById("btn-yrefine"), document.getElementById("btn-stighten"), document.getElementById("btn-yundo"),
   ...document.querySelectorAll("#setting-seg button")].forEach(b => { if (b) b.disabled = busy; });
  const yd = document.getElementById("btn-ydraft"); if (yd) yd.disabled = busy || !claude.sample;
}

// ---------- settings ----------
export function switchSetting(id) {
  if (!SETTINGS[id] || id === store.setting || anyBusy()) return;
  save();
  setSetting(id);
  buildSheet(); refreshAll(); buildLocSheet(); refreshLoc(); refreshLayout(); updateDock(); save();
  updateLibButtons(); if (store.view === "library") renderLib();
  if (!claude.sample && window.claude?.use) btnWeave.disabled = true;
}

export function initShell() {
  document.querySelector(".tabs").addEventListener("click", e => {
    const v = e.target.closest("[data-view]")?.dataset.view; if (v) showView(v);
  });
  document.querySelector(".tabs").addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = VIEWS.indexOf(store.view), next = VIEWS[(i + (e.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length];
    showView(next); document.getElementById("tab-" + next).focus();
  });

  dockBtn.addEventListener("click", () => {
    const loc = store.view === "location";
    document.querySelector(loc ? "#view-location .out" : "#view-campaign .out").scrollIntoView({ behavior: smooth(), block: "start" });
    const go = loc ? btnLBuild : btnWeave;
    if (!go.disabled && !go.hidden && claude.sample) go.click();
  });
  // Tuck the bar away whenever the real actions row (or the output below it) is on screen.
  if ("IntersectionObserver" in window) {
    const onScreen = new Set();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target));
      const visible = onScreen.size > 0;
      dock.classList.toggle("away", visible);
      dock.setAttribute("aria-hidden", String(visible));
      dockBtn.tabIndex = visible ? -1 : 0;
    }, { threshold: 0 });
    document.querySelectorAll(".out").forEach(o => io.observe(o));
  }

  document.getElementById("btn-clear").addEventListener("click", () => {
    if (store.view === "location") {
      LSLOT_IDS.forEach(id => { lstate.slots[id] = null; });
      lstate.text = {}; lstate.example = false;
      LSLOT_IDS.forEach(lpaintSlot); lsave(); updateDock(); lsetStatus("All rolls cleared.");
      return;
    }
    Object.keys(SLOT_DEFS).forEach(id => { state.slots[id] = null; });
    state.text = {}; state.example = false;
    Object.keys(SLOT_DEFS).forEach(paintSlot); save(); drawSpiral(); setStatus("All rolls cleared.");
  });
  document.getElementById("btn-randomize").addEventListener("click", () => {
    if (store.view === "location") {
      LSLOT_IDS.forEach(id => { if (!lvalueOf(id)) lsetRoll(id, virtualRoll(LSLOT_DEFS[id])); });
      return;
    }
    activeIds().forEach(id => { if (!valueOf(id)) setRoll(id, virtualRoll(SLOT_DEFS[id])); });
  });

  document.getElementById("setting-seg").addEventListener("click", e => {
    const id = e.target.closest("[data-setting]")?.dataset.setting;
    if (id) switchSetting(id);
  });
}
