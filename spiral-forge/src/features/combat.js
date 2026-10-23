// Combat: a grid of monster squares for running a fight. Each square holds a
// stat block, hit points and conditions for one group; initiative steps through
// the squares in order.
import { $, esc, logEntry, smooth } from "../shared/dom.js";
import { rnd, rollDice, rollHow } from "../shared/dice.js";
import { sgn, crLabel, newId } from "../shared/format.js";
import { clampInt } from "../shared/sanitize.js";
import { RULES, bookOf } from "../data/index.js";
import { store, save } from "../app/state.js";
import { bestiaryAPI } from "./catalogs/bestiary.js";
import { encAPI } from "./encounters.js";

const C = store.combat = Object.assign({ cols: 3, slots: [], round: 1, turn: -1 }, typeof store.combat === "object" && store.combat ? store.combat : {});
const CONDS = RULES.combat.conditions;

// ---------- state cleanup ----------
function cleanSlot(s) {
  if (!s || typeof s !== "object") return null;
  const out = { id: /^s[\w]{1,30}$/.test(s.id || "") ? s.id : newId("s"), k: typeof s.k === "string" ? s.k.slice(0, 80) : "", collapsed: !!s.collapsed };
  if (!out.k) return out;
  const sn = s.snap && typeof s.snap === "object" ? s.snap : {};
  out.snap = { n: String(sn.n || "").slice(0, 80), ac: clampInt(sn.ac, 0, 40, 10), hp: clampInt(sn.hp, 1, 3000, 10), cr: +sn.cr || 0, init: clampInt(sn.init, -10, 30, 0) };
  out.label = String(s.label || out.snap.n).slice(0, 80);
  out.init = s.init == null ? null : clampInt(s.init, -20, 60, null);
  out.inst = (Array.isArray(s.inst) ? s.inst : []).slice(0, 20).map(x => ({ hp: clampInt(x?.hp, -999, 3000, out.snap.hp), max: clampInt(x?.max, 1, 3000, out.snap.hp), cond: (Array.isArray(x?.cond) ? x.cond : []).filter(c => CONDS.includes(c)) }));
  if (!out.inst.length) out.inst = [{ hp: out.snap.hp, max: out.snap.hp, cond: [] }];
  return out;
}
C.cols = clampInt(C.cols, 1, 4, 3);
C.slots = (Array.isArray(C.slots) ? C.slots : []).map(cleanSlot).filter(Boolean).slice(0, 24);
if (!C.slots.length) C.slots = Array.from({ length: 6 }, () => ({ id: newId("s"), k: "" }));
C.round = clampInt(C.round, 1, 999, 1); C.turn = clampInt(C.turn, -1, 99, -1);

let mons = null, picking = null, clearArm = false;
const getMons = () => bestiaryAPI.data().then(d => (mons = d));
const monOf = s => mons?.byKey[s.k] || null;

function fillSlot(s, m, count = 1) {
  s.k = m.k; s.label = m.n; s.collapsed = false; s.init = null;
  s.snap = { n: m.n, ac: m.ac, hp: m.hp, cr: m.cr, init: m.init ?? 0 };
  s.inst = Array.from({ length: Math.max(1, Math.min(20, count)) }, () => ({ hp: m.hp, max: m.hp, cond: [] }));
}

// ---------- turn order ----------
const alive = s => s.k && s.inst.some(x => x.hp > 0);
const order = () => C.slots.filter(s => s.k && s.init != null).slice().sort((a, b) => b.init - a.init || (b.snap.init - a.snap.init));
function renderOrder() {
  const o = order(), el = $("cb-order");
  el.hidden = !o.length;
  const now = o[C.turn]?.id;
  el.innerHTML = o.map(s => `<li class="${s.id === now ? "now" : ""}${alive(s) ? "" : " down"}"><button type="button" data-goto="${s.id}"><b>${s.init}</b>${esc(s.label)}${s.inst.length > 1 ? ` ×${s.inst.length}` : ""}</button></li>`).join("");
  $("cb-round").textContent = `Round ${C.round}`;
}
function step(dir) {
  const o = order(); if (!o.length) { $("cb-status").textContent = "Roll initiative first."; return; }
  let i = C.turn, guard = 0;
  do {
    i += dir;
    if (i >= o.length) { i = 0; C.round++; }
    if (i < 0) { i = o.length - 1; C.round = Math.max(1, C.round - 1); }
  } while (!alive(o[i]) && ++guard < o.length);
  C.turn = i; save(); render();
  document.querySelector(`.cb-slot[data-id="${o[i].id}"]`)?.scrollIntoView({ block: "nearest", behavior: smooth() });
}

// ---------- rendering ----------
function hpRow(s, x, i) {
  const pct = Math.max(0, Math.min(100, x.hp / x.max * 100));
  const cls = x.hp <= 0 ? "down" : x.hp <= x.max / 2 ? "bloodied" : x.hp < x.max ? "hurt" : "";
  const name = s.inst.length > 1 ? `${s.label} ${i + 1}` : s.label;
  return `<li class="cb-cr ${cls}" data-i="${i}">
    <span class="who"><b>${esc(name)}</b><span class="hpnum">${x.hp} / ${x.max}</span>${x.hp <= 0 ? `<span>down</span>` : x.hp <= x.max / 2 ? `<span>bloodied</span>` : ""}</span>
    <span class="cb-adj"><input type="number" inputmode="numeric" min="0" placeholder="0" aria-label="Amount for ${esc(name)}" data-amt>
      <button type="button" data-hp="-1" title="Damage">Hit</button><button type="button" data-hp="1" title="Heal">Heal</button></span>
    <span class="bar"><i style="width:${pct}%"></i></span>
    <span class="cb-conds">${x.cond.map(c => `<button type="button" class="cnd" data-cond="${esc(c)}" title="Remove ${esc(c)}">${esc(c)}</button>`).join("")}
      <select data-addcond aria-label="Add a condition to ${esc(name)}"><option value="">+ condition</option>${CONDS.filter(c => !x.cond.includes(c)).map(c => `<option>${c}</option>`).join("")}</select></span>
  </li>`;
}
function slotHTML(s) {
  if (picking === s.id) {
    return `<div class="cb-slot" data-id="${s.id}"><div class="cb-pick">
      <label class="sub-title" for="cb-q-${s.id}">Pick a monster</label>
      <input type="search" id="cb-q-${s.id}" data-q placeholder="Search by name, type or book" autocomplete="off" spellcheck="false">
      <ul class="best-list" data-results aria-label="Monsters"><li class="none">${mons ? "Type to search all " + mons.list.length.toLocaleString() + " monsters." : "Loading monsters…"}</li></ul>
      <div class="row"><span class="cb-count">How many <button type="button" data-pc="-1" aria-label="Fewer">−</button><output data-pcount>1</output><button type="button" data-pc="1" aria-label="More">+</button></span><button type="button" class="small ghost" data-cancel>Cancel</button></div>
    </div></div>`;
  }
  if (!s.k) return `<div class="cb-slot" data-id="${s.id}"><button type="button" class="cb-empty" data-pick><span><b>+</b>Add a monster</span></button></div>`;
  const m = monOf(s), now = order()[C.turn]?.id === s.id;
  const sn = s.snap;
  const block = m && bestiaryAPI.block ? bestiaryAPI.block(m) : `<p class="sbintro">This monster is no longer in your Bestiary.</p>`;
  return `<section class="cb-slot${s.collapsed ? " collapsed" : ""}${now ? " now" : ""}" data-id="${s.id}" aria-label="${esc(s.label)}">
    <div class="cb-head">
      <input class="cb-name" data-label value="${esc(s.label)}" aria-label="Name shown on this square" maxlength="80">
      <span class="cb-tools">
        <button type="button" data-collapse title="${s.collapsed ? "Show" : "Hide"} stat block">${s.collapsed ? "Show" : "Hide"}</button>
        <button type="button" data-pick title="Swap monster">Swap</button>
        <button type="button" data-remove title="Empty this square">Empty</button>
      </span>
      <span class="cb-meta"><span>AC <b>${sn.ac}</b></span><span>HP <b>${sn.hp}</b></span><span>CR <b>${crLabel(sn.cr)}</b></span>
        <span>Init <b>${sgn(sn.init)}</b></span>${s.init != null ? `<span class="cb-init" title="Rolled initiative">${s.init}</span>` : ""}
        <span class="cb-count">Count <button type="button" data-cnt="-1" aria-label="One fewer">−</button><b>${s.inst.length}</b><button type="button" data-cnt="1" aria-label="One more">+</button></span></span>
    </div>
    <ul class="cb-hp">${s.inst.map((x, i) => hpRow(s, x, i)).join("")}</ul>
    <div class="cb-log" data-log></div>
    <article class="statblock">${block}</article>
  </section>`;
}
function render() {
  $("cb-grid").style.setProperty("--cols", C.cols);
  document.querySelectorAll("#cb-cols [data-cols]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.cols === C.cols)));
  // keep each square's roll log across re-renders
  const logs = {}; document.querySelectorAll("#cb-grid .cb-slot").forEach(el => { const l = el.querySelector("[data-log]"); if (l) logs[el.dataset.id] = l.innerHTML; });
  $("cb-grid").innerHTML = C.slots.map(slotHTML).join("");
  document.querySelectorAll("#cb-grid .cb-slot").forEach(el => { const l = el.querySelector("[data-log]"); if (l && logs[el.dataset.id]) l.innerHTML = logs[el.dataset.id]; });
  renderOrder();
  if (picking) { const q = document.querySelector(`.cb-slot[data-id="${picking}"] [data-q]`); q?.focus(); }
}
function renderResults(slotEl) {
  const q = slotEl.querySelector("[data-q]").value.trim().toLowerCase().split(/\s+/).filter(Boolean), ul = slotEl.querySelector("[data-results]");
  if (!mons) { ul.innerHTML = `<li class="none">Loading monsters…</li>`; return; }
  if (!q.length) { ul.innerHTML = `<li class="none">Type to search all ${mons.list.length.toLocaleString()} monsters.</li>`; return; }
  const w = q.join(" ");
  const hits = mons.list.filter(m => q.every(t => (m._s || m.n.toLowerCase()).includes(t)))
    .sort((a, b) => (b.n.toLowerCase().startsWith(w) - a.n.toLowerCase().startsWith(w)) || a.n.localeCompare(b.n));
  ul.innerHTML = hits.length ? hits.slice(0, 40).map(m => `<li><button type="button" data-choose="${esc(m.k)}"><span class="cr${m.custom ? " mine-cr" : ""}">CR ${crLabel(m.cr)}</span><span class="nm"><b>${esc(m.n)}${m.custom ? '<span class="mine">Yours</span>' : ""}${m.src ? `<span class="book-tag">${esc(bookOf(m).tag)}</span>` : ""}</b><span>${esc(m.sz)} ${esc(m.ty)} · AC ${m.ac} · HP ${m.hp}</span></span></button></li>`).join("")
    + (hits.length > 40 ? `<li class="none">Showing 40 of ${hits.length.toLocaleString()}. Type more to narrow it down.</li>` : "")
    : `<li class="none">No monsters match.</li>`;
}


// ---------- dice in a square ----------
function roll(btn, slotEl, who) {
  const r = rollDice(btn.dataset.roll, 100); if (!r) return;
  const { dice, add, total } = r;
  let cls = "", note = "";
  if (btn.dataset.d20 && dice[0] === 20) { cls = " crit"; note = " · natural 20, roll damage dice twice"; }
  if (btn.dataset.d20 && dice[0] === 1) { cls = " fumble"; note = " · natural 1, miss"; }
  if (btn.dataset.recharge) { const ok = dice[0] >= +btn.dataset.recharge; cls = ok ? " crit" : ""; note = ok ? " · recharged" : " · not yet"; }
  logEntry(slotEl.querySelector("[data-log]"), `<span class="tot${cls}">${total}</span><span>${esc(btn.dataset.what || who)}${esc(note)}</span><span class="how">${esc(rollHow(btn.dataset.roll, r))}</span>`, 3);
}

// ---------- events ----------
const slotOf = el => C.slots.find(s => s.id === el.closest(".cb-slot")?.dataset.id);

export function openCombat() { render(); getMons().then(render).catch(() => {}); }

export function initCombat() {
  $("cb-grid").addEventListener("click", e => {
    const el = e.target, slotEl = el.closest(".cb-slot"); if (!slotEl) return;
    const s = slotOf(el); if (!s) return;
    if (el.closest("[data-pick]")) { picking = s.id; render(); getMons().then(() => { const se = document.querySelector(`.cb-slot[data-id="${s.id}"]`); if (se) renderResults(se); }).catch(() => {}); return; }
    if (el.closest("[data-cancel]")) { picking = null; render(); return; }
    const pc = el.closest("[data-pc]"); if (pc) { const o = slotEl.querySelector("[data-pcount]"); o.textContent = Math.max(1, Math.min(20, +o.textContent + +pc.dataset.pc)); return; }
    const ch = el.closest("[data-choose]"); if (ch) { const m = mons?.byKey[ch.dataset.choose]; if (m) { fillSlot(s, m, +slotEl.querySelector("[data-pcount]").textContent || 1); picking = null; save(); render(); } return; }
    if (el.closest("[data-remove]")) { Object.assign(s, { k: "", label: "", inst: [], init: null, snap: null }); save(); render(); return; }
    if (el.closest("[data-collapse]")) { s.collapsed = !s.collapsed; save(); render(); return; }
    const cnt = el.closest("[data-cnt]"); if (cnt) { if (+cnt.dataset.cnt > 0 && s.inst.length < 20) s.inst.push({ hp: s.snap.hp, max: s.snap.hp, cond: [] }); else if (+cnt.dataset.cnt < 0 && s.inst.length > 1) s.inst.pop(); save(); render(); return; }
    const hp = el.closest("[data-hp]"); if (hp) {
      const row = el.closest("[data-i]"), x = s.inst[+row.dataset.i], amt = int(row.querySelector("[data-amt]").value, 0, 9999, 0);
      if (!amt) { row.querySelector("[data-amt]").focus(); return; }
      x.hp = +hp.dataset.hp < 0 ? Math.max(0, x.hp - amt) : Math.min(x.max, x.hp + amt);
      save(); render(); return;
    }
    const cond = el.closest("[data-cond]"); if (cond) { const x = s.inst[+el.closest("[data-i]").dataset.i]; x.cond = x.cond.filter(c => c !== cond.dataset.cond); save(); render(); return; }
    const d = el.closest(".dice"); if (d && slotEl.querySelector(".statblock")?.contains(d)) { e.stopPropagation(); roll(d, slotEl, s.label); }
  });
  $("cb-grid").addEventListener("change", e => {
    const sel = e.target.closest("[data-addcond]"); if (!sel || !sel.value) return;
    const s = slotOf(sel), x = s.inst[+sel.closest("[data-i]").dataset.i]; if (!x.cond.includes(sel.value)) x.cond.push(sel.value); save(); render();
  });
  $("cb-grid").addEventListener("input", e => {
    if (e.target.matches("[data-q]")) renderResults(e.target.closest(".cb-slot"));
    if (e.target.matches("[data-label]")) { const s = slotOf(e.target); s.label = e.target.value.slice(0, 80); save(); renderOrder(); }
  });
  $("cb-grid").addEventListener("keydown", e => {
    if (e.target.matches("[data-q]")) {
      if (e.key === "Enter") { e.preventDefault(); e.target.closest(".cb-slot").querySelector("[data-choose]")?.click(); }
      if (e.key === "Escape") { picking = null; render(); }
    }
    if (e.target.matches("[data-amt]") && e.key === "Enter") { e.preventDefault(); e.target.closest("[data-i]").querySelector('[data-hp="-1"]').click(); }
  });
  $("cb-cols").addEventListener("click", e => { const b = e.target.closest("[data-cols]"); if (b) { C.cols = +b.dataset.cols; save(); render(); } });
  $("cb-add").addEventListener("click", () => { if (C.slots.length >= 24) { $("cb-status").textContent = "The board holds 24 squares."; return; } const s = { id: newId(), k: "" }; C.slots.push(s); picking = s.id; save(); render(); getMons().then(() => { const se = document.querySelector(`.cb-slot[data-id="${s.id}"]`); if (se) renderResults(se); }).catch(() => {}); });
  $("cb-fill").addEventListener("click", () => {
    const rows = encAPI.rows?.() || [];
    if (!rows.length) { $("cb-status").textContent = "The current encounter is empty. Build one in Encounters first."; return; }
    getMons().then(() => {
      let added = 0;
      rows.forEach(r => {
        const m = mons.byKey[r.k]; if (!m) return;
        let s = C.slots.find(x => !x.k);
        if (!s) { if (C.slots.length >= 24) return; s = { id: newId(), k: "" }; C.slots.push(s); }
        fillSlot(s, m, r.c); added++;
      });
      C.round = 1; C.turn = -1; picking = null; save(); render();
      $("cb-status").textContent = added ? `Added ${added} monster group${added === 1 ? "" : "s"} from ${encAPI.name()}.` : "None of the encounter's monsters are in the Bestiary any more.";
    }).catch(() => { $("cb-status").textContent = "The monster list didn't load. Check your connection, then try again."; });
  });
  const setClear = on => { clearArm = on; $("cb-clear").hidden = on; $("cb-clearok").hidden = $("cb-clearno").hidden = !on; };
  $("cb-clear").addEventListener("click", () => setClear(true));
  $("cb-clearno").addEventListener("click", () => setClear(false));
  $("cb-clearok").addEventListener("click", () => { setClear(false); C.slots = Array.from({ length: 6 }, () => ({ id: newId(), k: "" })); C.round = 1; C.turn = -1; picking = null; save(); render(); $("cb-status").textContent = "Cleared the board."; });
  $("cb-init").addEventListener("click", () => {
    const filled = C.slots.filter(s => s.k); if (!filled.length) { $("cb-status").textContent = "Add a monster first."; return; }
    filled.forEach(s => { s.init = rnd(20) + (s.snap.init || 0); });
    C.round = 1; C.turn = -1; save(); step(1);
    $("cb-status").textContent = "Rolled initiative. Each square's group acts together; add the players to your own list and use Next turn.";
  });
  $("cb-next").addEventListener("click", () => step(1));
  $("cb-prev").addEventListener("click", () => step(-1));
  $("cb-order").addEventListener("click", e => { const b = e.target.closest("[data-goto]"); if (!b) return; const i = order().findIndex(s => s.id === b.dataset.goto); if (i >= 0) { C.turn = i; save(); render(); document.querySelector(`.cb-slot[data-id="${b.dataset.goto}"]`)?.scrollIntoView({ block: "nearest" }); } });
}
