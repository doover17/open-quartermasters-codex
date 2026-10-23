// The saved store and the working copies every page edits.
//
// One object (`store`) is persisted under STORE_KEY. It holds, per setting, the
// campaign sheet (`per`), the location (`locs`) and the layout (`layouts`), plus
// the tool tabs' own sections (best, items, spells, loot, enc, combat) and the
// open tab (`view`). The current setting's working copies are exported as live
// bindings: importers always see the latest object, and only the setters below
// reassign them.
import { SETTINGS, LOC } from "../data/index.js";
import { STORE_KEY, OLD_STORE_KEY, readJSON } from "../shared/storage.js";

export const HISTORY_MAX = 5;

const SLOT_IDS = ["pitch", "start",
  ...[0,1,2].flatMap(i => [`front${i}`, `front${i}-beh`, `front${i}-anc`]),
  ...[0,1,2].flatMap(i => [`loc${i}`, `loc${i}-desc`, `loc${i}-origin`])];
export const LSLOT_IDS = ["l-loc", "l-desc", "l-origin", "l-occ", "l-occ-beh", "l-occ-anc"];

export function freshSheet(settingId) {
  const slots = Object.fromEntries(SLOT_IDS.map(id => [id, SETTINGS[settingId].example[id] ?? null]));
  return { example: true, fronts: 2, notes: "", slots, text: {}, output: "", history: [] };
}
export function freshLoc(settingId) {
  const slots = Object.fromEntries(LSLOT_IDS.map(id => [id, LOC[settingId].example[id] ?? null]));
  return { example: true, size: "medium", notes: "", slots, text: {}, output: "", history: [] };
}
export function freshLayout() {
  return { src: "", spec: null, seed: 1, moves: {}, sizes: {}, opts: { style: "parchment", grid: true, labels: true, features: true, zoom: "fit", player: false, ppsq: 70 }, history: [], fromClaude: false };
}

function loadStore() {
  const s = readJSON(STORE_KEY);
  if (s && typeof s === "object" && s.per && typeof s.per === "object") {
    if (!SETTINGS[s.setting]) s.setting = "fantasy";
    return s;
  }
  // Carry an existing single-setting sheet over as the fantasy sheet.
  const old = readJSON(OLD_STORE_KEY);
  if (old && old.slots) return { setting: "fantasy", per: { fantasy: old } };
  return { setting: "fantasy", per: {} };
}
export const store = loadStore();
store.locs ||= {};
store.layouts ||= {};
store.view ||= "campaign";

export let T = SETTINGS[store.setting].tables;   // the current setting's d100 tables
export let S = SETTINGS[store.setting];          // the current setting
export let state = store.per[store.setting] || (store.per[store.setting] = freshSheet(store.setting));
export let turns = [];   // [{role, content}] for campaign revisions
export let lstate = store.locs[store.setting] || (store.locs[store.setting] = freshLoc(store.setting));
export let lturns = [];
export let ystate = store.layouts[store.setting] || (store.layouts[store.setting] = freshLayout());

// In-flight Claude requests, one per page: campaign, location, layout, GM sheet.
export const jobs = { campaign: null, location: null, layout: null, sheet: null };

export function setCampaign(next) { state = next; }
export function setTurns(next) { turns = next; }
export function setLocation(next) { lstate = next; }
export function setLocationTurns(next) { lturns = next; }
export function setLayout(next) { ystate = next; }
export function setSetting(id) {
  store.setting = id;
  S = SETTINGS[id]; T = S.tables;
  state = store.per[id] || (store.per[id] = freshSheet(id));
  lstate = store.locs[id] || (store.locs[id] = freshLoc(id));
  ystate = store.layouts[id] || (store.layouts[id] = freshLayout());
  turns = []; lturns = [];
}

// Browser storage can fill up; when it does, say so on screen instead of silently
// dropping changes.
export function save() {
  store.per[store.setting] = state;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); storageWarning(false); return true; }
  catch { storageWarning(true); return false; }
}
export function storageWarning(on) { const el = document.getElementById("storage-warn"); if (el) el.hidden = !on; }
export function lsave() { store.locs[store.setting] = lstate; save(); }
