// Library: saved campaigns and locations (with their layouts), backup and
// restore, and the validators that make saved data safe to show.
import { $, esc as xesc } from "../shared/dom.js";
import { hashStr } from "../shared/dice.js";
import { clone, docTitle, newId } from "../shared/format.js";
import { isObj, str, httpsUrl, clampN } from "../shared/sanitize.js";
import { LIB_KEY, NDEST_KEY } from "../shared/storage.js";
import { SETTINGS } from "../data/index.js";
import { store, state, lstate, ystate, save, storageWarning, HISTORY_MAX, freshSheet, freshLoc, freshLayout, setCampaign, setLocation, setLayout, setTurns, setLocationTurns } from "../app/state.js";
import { claude } from "../shared/claude.js";
import { anyBusy, showView, switchSetting } from "../app/shell.js";
import { splitMap } from "../map/wireframe.js";
import { MAP_TYPES, normalizeSpec } from "../map/geometry.js";
import { refreshAll, setStatus } from "./campaign.js";
import { refreshLoc, lsetStatus } from "./location.js";
import { refreshLayout } from "./layout.js";
import { updateNotionButtons } from "./notion.js";
import { restoreMonsters } from "./catalogs/bestiary.js";
import { restoreItems } from "./catalogs/items.js";
import { restoreSpells } from "./catalogs/spells.js";
import { restoreLootTables } from "./loot.js";
import { restoreEncounters } from "./encounters.js";

// ---------- cleaning saved data ----------
// Saved state and backup files are untrusted: every value that reaches markup is
// coerced to the type the page expects, and layouts are re-validated against the map.
function cleanSlots(o) {
  return isObj(o) ? Object.fromEntries(Object.entries(o).map(([k, v]) => [String(k), Number.isInteger(+v) && +v >= 1 && +v <= 100 && v !== null ? +v : null])) : {};
}
function cleanTexts(o) { return isObj(o) ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string")) : {}; }
function cleanHistory(h) { return Array.isArray(h) ? h.filter(x => typeof x === "string").slice(-HISTORY_MAX) : []; }
function cleanNotion(n) { const url = httpsUrl(n?.url); return url ? { url, id: str(n.id).replace(/[^0-9a-f-]/gi, ""), at: +n.at || 0 } : undefined; }
function cleanCampaign(c) {
  c = isObj(c) ? c : {};
  const out = { example: !!c.example, fronts: [1, 2, 3].includes(+c.fronts) ? +c.fronts : 2, notes: str(c.notes), slots: cleanSlots(c.slots),
    text: cleanTexts(c.text), output: str(c.output), history: cleanHistory(c.history), libId: str(c.libId) || null, savedHash: str(c.savedHash) || null };
  const n = cleanNotion(c.notion); if (n) out.notion = n;
  return out;
}
function cleanLocation(l) {
  l = isObj(l) ? l : {};
  const out = { example: !!l.example, size: ["small", "medium", "large", "huge"].includes(l.size) ? l.size : "medium", notes: str(l.notes), slots: cleanSlots(l.slots),
    text: cleanTexts(l.text), output: str(l.output), history: cleanHistory(l.history), libId: str(l.libId) || null, savedHash: str(l.savedHash) || null };
  if (isObj(l.fromCampaign)) out.fromCampaign = { campaign: str(l.fromCampaign.campaign), site: str(l.fromCampaign.site), pitch: str(l.fromCampaign.pitch),
    threats: str(l.fromCampaign.threats), excerpt: str(l.fromCampaign.excerpt).slice(0, 4000) };
  const n = cleanNotion(l.notion); if (n) out.notion = n;
  return out;
}
function cleanLayoutState(y, locOutput) {
  const f = freshLayout(); if (!isObj(y)) return f;
  const map = splitMap(locOutput || "").map;
  const intMap = o => isObj(o) ? Object.fromEntries(Object.entries(o).filter(([k]) => /^\d+$/.test(k))) : {};
  const o = isObj(y.opts) ? y.opts : {};
  const out = {
    src: str(y.src), seed: Number.isInteger(+y.seed) ? +y.seed : 1, fromClaude: !!y.fromClaude, history: [],
    spec: map && isObj(y.spec) && Array.isArray(y.spec.areas) ? normalizeSpec(y.spec, { map }) : null,
    moves: Object.fromEntries(Object.entries(intMap(y.moves)).map(([k, v]) => [k, { dx: Math.trunc(+v?.dx) || 0, dy: Math.trunc(+v?.dy) || 0 }])),
    sizes: Object.fromEntries(Object.entries(intMap(y.sizes)).map(([k, v]) => [k, { w: clampN(Math.trunc(+v?.w) || 6, 3, 18), h: clampN(Math.trunc(+v?.h) || 6, 3, 18), rot: !!v?.rot }])),
    levels: Object.fromEntries(Object.entries(intMap(y.levels)).filter(([, v]) => Number.isInteger(+v) && Math.abs(+v) <= 4).map(([k, v]) => [k, +v])),
    opts: {
      style: o.style === "ink" ? "ink" : "parchment", grid: o.grid !== false, labels: o.labels !== false, features: o.features !== false,
      zoom: o.zoom === "full" ? "full" : "fit", player: !!o.player, split: o.split !== false,
      ppsq: [50, 70, 100, 140].includes(+o.ppsq) ? +o.ppsq : 70, paper: o.paper === "a4" ? "a4" : "letter",
      level: Number.isInteger(o.level) && Math.abs(o.level) <= 4 ? o.level : null,
      type: MAP_TYPES[o.type] ? o.type : "auto",
    },
  };
  if (isObj(y.vtt)) out.vtt = { ox: clampN(+y.vtt.ox || 0, -100, 100), oy: clampN(+y.vtt.oy || 0, -100, 100), scale: clampN(+y.vtt.scale || 100, 25, 400), lights: y.vtt.lights !== false, objects: y.vtt.objects !== false };
  if (isObj(y.sheet) && isObj(y.sheet.data)) {
    const d = y.sheet.data, arr = a => Array.isArray(a) ? a.filter(x => typeof x === "string") : [];
    out.sheet = { src: str(y.sheet.src), data: {
      glance: str(d.glance),
      areas: (Array.isArray(d.areas) ? d.areas : []).filter(isObj).map((a, i) => ({ id: Math.trunc(+a.id) || i + 1, name: str(a.name), key: str(a.key) })),
      npcs: (Array.isArray(d.npcs) ? d.npcs : []).filter(isObj).map(n => ({ name: str(n.name), line: str(n.line) })),
      secrets: arr(d.secrets), encounters: arr(d.encounters), treasure: arr(d.treasure), hooks: arr(d.hooks) } };
  }
  return out;
}
// Clean the working copies loaded at startup, in place (other code holds references).
export function cleanStoreInPlace() {
  const swap = (obj, k, v) => { for (const key of Object.keys(obj[k])) delete obj[k][key]; Object.assign(obj[k], v); };
  for (const sid of Object.keys(SETTINGS)) {
    if (store.per[sid]) swap(store.per, sid, cleanCampaign(store.per[sid]));
    if (store.locs?.[sid]) swap(store.locs, sid, cleanLocation(store.locs[sid]));
    if (store.layouts?.[sid]) swap(store.layouts, sid, cleanLayoutState(store.layouts[sid], store.locs?.[sid]?.output));
  }
  for (const k of Object.keys(store.per)) if (!SETTINGS[k]) delete store.per[k];
  store.view = ["campaign", "location", "layout", "library", "bestiary", "encounters", "combat", "spells", "items", "loot"].includes(store.view) ? store.view : "campaign";
}
// A library item is usable only if it has the shape the page opens.
function cleanItem(it) {
  if (!isObj(it) || !SETTINGS[it.setting] || !["campaign", "location"].includes(it.kind) || !isObj(it.data)) return null;
  const id = /^[\w-]{1,100}$/.test(it.id || "") ? it.id : null; if (!id) return null;
  let data;
  if (it.kind === "campaign") { if (typeof it.data.output !== "string") return null; data = cleanCampaign(it.data); }
  else { if (!isObj(it.data.loc) || typeof it.data.loc.output !== "string") return null;
    const loc = cleanLocation(it.data.loc); data = { loc, layout: it.data.layout ? cleanLayoutState(it.data.layout, loc.output) : null }; }
  return { id, kind: it.kind, setting: it.setting, name: str(it.name, "Untitled").slice(0, 200), savedAt: +it.savedAt || Date.now(), renamed: !!it.renamed, data };
}

function loadLib() { try { const l = JSON.parse(localStorage.getItem(LIB_KEY)); return Array.isArray(l) ? l.map(cleanItem).filter(Boolean) : []; } catch { return []; } }
let lib = loadLib();
let libFilter = "setting";
function saveLib(list = lib) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(list)); return true; }
  catch { libSetStatus("Browser storage is full, so the library couldn't be saved. Export a backup, then delete some older items.", true); storageWarning(true); return false; }
}
function libSetStatus(msg, err) { const el = document.getElementById("libstatus"); el.textContent = msg || ""; el.classList.toggle("err", !!err); }

// What counts as "the work" for change detection.
const campHash = () => hashStr(state.output || "");
const locHash = () => hashStr((lstate.output || "") + JSON.stringify([ystate.spec, ystate.moves, ystate.sizes, ystate.seed, ystate.levels]));
export const isUnsaved = kind => kind === "campaign"
  ? !!state.output && state.savedHash !== campHash()
  : !!lstate.output && lstate.savedHash !== locHash();

export function libSave(kind, silent) {
  const camp = kind === "campaign";
  const w = camp ? state : lstate;
  if (!w.output) return null;
  const existing = lib.find(i => i.id === w.libId);
  const id = existing ? existing.id : newId(camp ? "c" : "l");
  const data = camp
    ? { ...clone(state), history: [], libId: id }
    : { loc: { ...clone(lstate), history: [], libId: id }, layout: { ...clone(ystate), history: [] } };
  const name = existing?.renamed ? existing.name : docTitle(w.output, camp ? "Untitled campaign" : "Untitled location");
  const item = { ...(existing || {}), id, kind, setting: store.setting, name, savedAt: Date.now(), data };
  const next = existing ? lib.map(i => i.id === id ? item : i) : [...lib, item];
  if (!saveLib(next)) {
    if (!silent) (camp ? setStatus : lsetStatus)("Browser storage is full, so this couldn't be saved. Export a backup, then delete old library items.", true);
    return null;
  }
  lib = next;
  w.libId = id;
  w.savedHash = camp ? campHash() : locHash();
  save(); updateLibButtons();
  if (!silent) (camp ? setStatus : lsetStatus)(`Saved "${name}" to the library.`);
  if (store.view === "library") renderLib();
  return item;
}
// Before replacing a working copy, keep it if it has unsaved changes.
function stash(kind) { return isUnsaved(kind) ? libSave(kind, true) : null; }
// Unsaved work that can't be stashed must not be replaced. Returns false to stop.
export function stashOrStop(kind) {
  if (!isUnsaved(kind)) return { ok: true, kept: false };
  const kept = stash(kind);
  if (kept) return { ok: true, kept: true };
  const msg = `Your current ${kind} has unsaved changes and browser storage is full, so it wasn't replaced. Export a backup and delete some library items first.`;
  libSetStatus(msg, true); (kind === "campaign" ? setStatus : lsetStatus)(msg, true);
  return { ok: false, kept: false };
}

export function updateLibButtons() {
  const c = document.getElementById("btn-clib"), l = document.getElementById("btn-llib");
  c.hidden = !state.output; l.hidden = !lstate.output;
  c.textContent = isUnsaved("campaign") ? "Save to library" : "Saved ✓";
  l.textContent = isUnsaved("location") ? "Save to library" : "Saved ✓";
  updateNotionButtons();
}

function loadCampaign(data, libId) {
  setCampaign(cleanCampaign(clone(data))); state.libId = libId || null;
  state.savedHash = libId ? hashStr(state.output || "") : null;
  store.per[store.setting] = state; setTurns([]);
  refreshAll(); save();
}
export function loadLocation(locData, layoutData, libId) {
  setLocation(cleanLocation(clone(locData))); lstate.libId = libId || null;
  setLayout(layoutData ? cleanLayoutState(clone(layoutData), lstate.output) : freshLayout());
  store.locs[store.setting] = lstate; store.layouts[store.setting] = ystate; setLocationTurns([]);
  lstate.savedHash = libId ? locHash() : null;
  refreshLoc(); refreshLayout(); save();
}

function openItem(id) {
  const item = lib.find(i => i.id === id); if (!item || anyBusy()) return;
  if (item.setting !== store.setting) switchSetting(item.setting);
  if (item.kind === "campaign") {
    const st = stashOrStop("campaign"); if (!st.ok) return;
    const kept = st.kept && state.libId !== item.id;
    loadCampaign(item.data, item.id); showView("campaign");
    setStatus(`Opened "${item.name}".` + (kept ? ` Your previous campaign was saved to the library.` : ""));
  } else {
    const st = stashOrStop("location"); if (!st.ok) return;
    const kept = st.kept && lstate.libId !== item.id;
    loadLocation(item.data.loc, item.data.layout, item.id); showView("location");
    lsetStatus(`Opened "${item.name}".` + (kept ? ` Your previous location was saved to the library.` : ""));
  }
  updateLibButtons();
}
function newWork(kind) {
  if (anyBusy()) return;
  const st = stashOrStop(kind); if (!st.ok) return;
  const kept = st.kept;
  if (kind === "campaign") {
    const f = freshSheet(store.setting); Object.keys(f.slots).forEach(k => f.slots[k] = null); f.example = false;
    loadCampaign(f, null); showView("campaign");
    setStatus("New campaign. Roll away." + (kept ? " Your previous campaign was saved to the library." : ""));
  } else {
    const f = freshLoc(store.setting); Object.keys(f.slots).forEach(k => f.slots[k] = null); f.example = false;
    loadLocation(f, null, null); showView("location");
    lsetStatus("New location. Roll away." + (kept ? " Your previous location was saved to the library." : ""));
  }
  updateLibButtons();
}

// Two-step delete and inline rename, by library item id.
let pendingDelete = null, renaming = null;
export function resetLibraryUi() { pendingDelete = renaming = null; }
export function renderLib() {
  document.querySelectorAll("[data-libfilter]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.libfilter === libFilter)));
  document.getElementById("btn-backup").hidden = !claude.downloads;
  const list = document.getElementById("lib-list");
  const items = lib.filter(i => libFilter === "all" || i.setting === store.setting).sort((a, b) => b.savedAt - a.savedAt);
  if (!items.length) {
    list.innerHTML = `<div class="lib-empty">${lib.length ? "Nothing saved for this setting yet." : "Nothing saved yet."} Use <b>Save to library</b> on the Campaign or Location tab. Opening or starting something new also saves your current work here automatically.</div>`;
    return;
  }
  const fmt = t => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  list.innerHTML = items.map(i => {
    const current = (i.kind === "campaign" ? state.libId : lstate.libId) === i.id && i.setting === store.setting;
    let areas = 0; try { areas = i.kind === "location" ? (splitMap(i.data?.loc?.output || "").map?.areas.length || 0) : 0; } catch {}
    const hasLayout = i.kind === "location" && i.data?.layout?.spec;
    return `<article class="lib-item${current ? " current" : ""}" data-lib="${xesc(i.id)}">
      ${renaming === i.id
        ? `<input type="text" data-rename-input value="${xesc(i.name)}" aria-label="New name">`
        : `<h3>${xesc(i.name)}</h3>`}
      <div class="lib-meta">
        <span class="badge${i.kind === "location" ? " loc" : ""}">${i.kind === "campaign" ? "Campaign" : "Location"}</span>
        <span>${xesc(SETTINGS[i.setting]?.name || i.setting)}</span>
        ${areas ? `<span>${areas} areas${hasLayout ? " · layout" : ""}</span>` : ""}
        <span>${fmt(i.savedAt)}</span>
        ${current ? `<span><b>Open now</b></span>` : ""}
      </div>
      <div class="actions">
        ${renaming === i.id
          ? `<button type="button" class="small primary" data-libact="rename-ok">Save name</button><button type="button" class="small ghost" data-libact="rename-cancel">Cancel</button>`
          : `<button type="button" class="small primary" data-libact="open"${current ? " disabled" : ""}>${current ? "Open" : "Open"}</button>
             <button type="button" class="small" data-libact="rename">Rename</button>
             <button type="button" class="small${pendingDelete === i.id ? " danger" : " ghost"}" data-libact="delete">${pendingDelete === i.id ? "Tap again to delete" : "Delete"}</button>`}
      </div>
    </article>`;
  }).join("");
  list.querySelector("[data-rename-input]")?.focus();
}

export function initLibrary() {
  document.getElementById("btn-clib").addEventListener("click", () => libSave("campaign"));
  document.getElementById("btn-llib").addEventListener("click", () => libSave("location"));
  document.getElementById("btn-newcamp").addEventListener("click", () => newWork("campaign"));
  document.getElementById("btn-newloc").addEventListener("click", () => newWork("location"));

  document.getElementById("view-library").addEventListener("click", e => {
    const f = e.target.closest("[data-libfilter]")?.dataset.libfilter;
    if (f) { libFilter = f; renderLib(); return; }
    const act = e.target.closest("[data-libact]")?.dataset.libact; if (!act) return;
    const id = e.target.closest("[data-lib]").dataset.lib, item = lib.find(i => i.id === id); if (!item) return;
    if (act !== "delete") pendingDelete = null;
    if (act === "open") openItem(id);
    if (act === "rename") { renaming = id; renderLib(); }
    if (act === "rename-cancel") { renaming = null; renderLib(); }
    if (act === "rename-ok") {
      const v = document.querySelector("[data-rename-input]").value.trim();
      if (v) { const prev = { name: item.name, renamed: item.renamed }; item.name = v.slice(0, 120); item.renamed = true; if (!saveLib()) Object.assign(item, prev); }
      renaming = null; renderLib();
    }
    if (act === "delete") {
      if (pendingDelete !== id) { pendingDelete = id; renderLib(); setTimeout(() => { if (pendingDelete === id) { pendingDelete = null; renderLib(); } }, 4000); return; }
      const next = lib.filter(i => i.id !== id); pendingDelete = null;
      if (!saveLib(next)) { renderLib(); return; }
      lib = next;
      // open work in any setting that pointed at this item is no longer "saved"
      [...Object.values(store.per || {}), ...Object.values(store.locs || {})].forEach(w => { if (w && w.libId === id) { w.libId = null; w.savedHash = null; } });
      save(); updateLibButtons(); renderLib();
      libSetStatus(`Deleted "${item.name}".`);
    }
  });
  document.getElementById("view-library").addEventListener("keydown", e => {
    if (!e.target.matches("[data-rename-input]")) return;
    if (e.key === "Enter") { e.preventDefault(); document.querySelector('[data-libact="rename-ok"]').click(); }
    if (e.key === "Escape") { renaming = null; renderLib(); }
  });

  // ---------- backup ----------
  document.getElementById("btn-backup").addEventListener("click", async () => {
    if (!claude.downloads) return;
    save();
    let dest = null; try { dest = JSON.parse(localStorage.getItem(NDEST_KEY)); } catch {}
    const data = JSON.stringify({ app: "spiral-campaign-forge", version: 3, exportedAt: new Date().toISOString(), store, library: lib, notionDest: dest });
    const day = new Date().toISOString().slice(0, 10);
    try { await claude.downloads.save({ filename: `spiral-forge-backup-${day}.json`, data }); libSetStatus(`Backup saved: ${lib.length} library item${lib.length === 1 ? "" : "s"} plus your open work.`); }
    catch (e) { libSetStatus(e.code === "declined" ? "" : "Couldn't save the backup here.", e.code !== "declined"); }
  });
  document.getElementById("btn-restore").addEventListener("click", () => document.getElementById("restore-file").click());
  document.getElementById("restore-file").addEventListener("change", async e => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    let b;
    try { b = JSON.parse(await file.text()); } catch { libSetStatus("That file isn't a Spiral Forge backup.", true); return; }
    if (b?.app !== "spiral-campaign-forge" || !Array.isArray(b.library)) { libSetStatus("That file isn't a Spiral Forge backup.", true); return; }
    const next = lib.slice();
    let added = 0, updated = 0, skipped = 0;
    b.library.forEach(raw => {
      const it = cleanItem(raw); if (!it) { skipped++; return; }
      const k = next.findIndex(i => i.id === it.id);
      if (k < 0) { next.push(it); added++; }
      else if (it.savedAt > (next[k].savedAt || 0)) { next[k] = it; updated++; }
    });
    // Open work in the backup: new work, or unsaved edits to a saved item, comes in as
    // its own item. Ids come from the content, so restoring twice doesn't duplicate.
    const libHash = it => it.kind === "campaign" ? hashStr(it.data.output) : hashStr(it.data.loc.output + JSON.stringify(it.data.layout?.spec || null) + JSON.stringify(it.data.layout?.moves || {}));
    const bring = (kind, sid, data, label) => {
      const it = cleanItem({ id: "x", kind, setting: sid, name: "", savedAt: Date.now(), data }); if (!it) return;
      const h = libHash(it), saved = next.find(i => i.id === (kind === "campaign" ? it.data.libId : it.data.loc.libId));
      if (saved && libHash(saved) === h) return;            // already saved as-is
      const id = (saved ? "ue-" : "bk-") + kind[0] + "-" + sid + "-" + h;
      if (next.some(i => i.id === id)) return;               // restored before
      if (kind === "campaign") it.data.libId = null; else it.data.loc.libId = null;
      next.push({ ...it, id, name: docTitle(kind === "campaign" ? it.data.output : it.data.loc.output, kind === "campaign" ? "Campaign" : "Location") + (saved ? " (unsaved edits)" : " (from backup)") });
      added++;
    };
    for (const sid of Object.keys(SETTINGS)) {
      const c = b.store?.per?.[sid]; if (isObj(c) && typeof c.output === "string" && c.output) bring("campaign", sid, c);
      const l = b.store?.locs?.[sid]; if (isObj(l) && typeof l.output === "string" && l.output) bring("location", sid, { loc: l, layout: b.store?.layouts?.[sid] || null });
    }
    if (!saveLib(next)) { renderLib(); return; }
    lib = next;
    try { if (!localStorage.getItem(NDEST_KEY) && isObj(b.notionDest)) {
      const d = b.notionDest, page = isObj(d.page) ? { id: str(d.page.id).replace(/[^0-9a-f-]/gi, ""), title: str(d.page.title).slice(0, 200), path: str(d.page.path).slice(0, 200), url: httpsUrl(d.page.url) } : null;
      localStorage.setItem(NDEST_KEY, JSON.stringify(d.mode === "page" && page?.id ? { mode: "page", page } : { mode: "draft" }));
    } } catch {}
    const monsters = restoreMonsters(b.store?.best?.custom);
    const itemVars = restoreItems(b.store?.items?.custom);
    const lootTables = restoreLootTables(b.store?.loot?.saved);
    const spellVars = restoreSpells(b.store?.spells?.custom);
    const encs = restoreEncounters(b.store?.enc?.saved);
    libFilter = "all"; renderLib();
    libSetStatus(`Restored: ${added} added${monsters ? `, ${monsters} monster variant${monsters === 1 ? "" : "s"}` : ""}${itemVars ? `, ${itemVars} item variant${itemVars === 1 ? "" : "s"}` : ""}${lootTables ? `, ${lootTables} loot table${lootTables === 1 ? "" : "s"}` : ""}${spellVars ? `, ${spellVars} spell variant${spellVars === 1 ? "" : "s"}` : ""}${encs ? `, ${encs} encounter${encs === 1 ? "" : "s"}` : ""}${updated ? `, ${updated} updated to newer versions` : ""}${skipped ? `, ${skipped} unreadable item${skipped === 1 ? "" : "s"} skipped` : ""}. Your open work wasn't changed; open anything from the list.`);
  });
}
