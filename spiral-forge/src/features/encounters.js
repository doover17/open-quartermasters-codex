// Encounters: lists of monsters scored against the 2024 DMG XP Budget per
// Character. Build one by hand, let the forge fill a difficulty, or ask Claude
// for one that fits a theme; then roll its loot and send it to Combat.
import { $, esc, logEntry, smooth } from "../shared/dom.js";
import { rnd } from "../shared/dice.js";
import { fmt, cap, crLabel } from "../shared/format.js";
import { clip, clampInt } from "../shared/sanitize.js";
import { RULES, BOOKS, bookOf } from "../data/index.js";
import { store, state, lstate, S, save } from "../app/state.js";
import { claude, claudeJson, claudeErrorMessage } from "../shared/claude.js";
import { showView } from "../app/shell.js";
import { copyMarkdown } from "./catalogs/common.js";
import { bestiaryAPI } from "./catalogs/bestiary.js";
import { itemsAPI } from "./catalogs/items.js";
import { lootAPI } from "./loot.js";

const E = store.enc = Object.assign({ size: 4, level: 3, diff: "moderate", style: "mixed", type: "", src: "all", theme: "", q: "", cur: null, saved: [] }, typeof store.enc === "object" && store.enc ? store.enc : {});
if (!Array.isArray(E.saved)) E.saved = [];
const pick = a => a[rnd(a.length) - 1];
const XP = RULES.monsters.xp;
// 2024 DMG, XP Budget per Character: [Low, Moderate, High] for levels 1-20.
const BUDGET = RULES.encounters.budget;
const DIFFS = RULES.encounters.difficulties, DLABEL = RULES.encounters.difficultyLabels;

E.size = clampInt(E.size, 1, 10, 4); E.level = clampInt(E.level, 1, 20, 3);
const budgets = () => BUDGET[E.level].map(b => b * E.size);

// ---------- validation (storage and backups) ----------
function cleanEnc(t) {
  if (!t || typeof t !== "object" || !Array.isArray(t.rows)) return null;
  const rows = t.rows.slice(0, 30).map(r => r && typeof r === "object" && clip(r.n, 80) ? {
    k: clip(r.k, 80), n: clip(r.n, 80), cr: XP[+r.cr] != null ? +r.cr : 0, xp: XP[+r.cr] ?? 0, init: clampInt(r.init, -10, 30, 0), ty: clip(r.ty, 30), c: clampInt(r.c, 1, 40, 1), ...(BOOKS[r.bk] && r.bk !== "srd-2024" ? { bk: r.bk } : {}),
  } : null).filter(Boolean);
  return { id: /^en-[\w-]{1,40}$/.test(t.id || "") ? t.id : "", name: clip(t.name, 100), notes: clip(t.notes, 4000), rows, size: clampInt(t.size, 1, 10, E.size), level: clampInt(t.level, 1, 20, E.level), made: +t.made || Date.now(), loot: cleanLoot(t.loot) };
}
const RARS = ["common", "uncommon", "rare", "very-rare", "legendary"];
function cleanLoot(l) {
  if (!l || typeof l !== "object" || !Array.isArray(l.groups)) return null;
  const groups = l.groups.slice(0, 30).map(g => g && typeof g === "object" ? { k: clip(g.k, 80), n: clip(g.n, 80), c: clampInt(g.c, 1, 40, 1), u: g.u === "PP" ? "PP" : "GP",
    total: Math.max(0, Math.round(+g.total || 0)), each: (Array.isArray(g.each) ? g.each : []).slice(0, 40).map(x => Math.max(0, Math.round(+x || 0))), expr: clip(g.expr, 30), none: !!g.none, carry: clip(g.carry, 300) } : null).filter(Boolean);
  let hoard = null;
  if (l.hoard && typeof l.hoard === "object") hoard = { by: clip(l.hoard.by, 80), cr: XP[+l.hoard.cr] != null ? +l.hoard.cr : 0, total: Math.max(0, Math.round(+l.hoard.total || 0)), expr: clip(l.hoard.expr, 30),
    text: clip(l.hoard.text, 240), items: (Array.isArray(l.hoard.items) ? l.hoard.items : []).slice(0, 8).map(it => ({ k: clip(it?.k, 80), n: clip(it?.n, 80), r: RARS.includes(it?.r) ? it.r : "uncommon" })).filter(it => it.n) };
  return { groups, hoard, hook: clip(l.hook, 400), sig: clip(l.sig, 2000) };
}
E.cur = cleanEnc(E.cur) || { id: "", name: "", notes: "", rows: [], size: E.size, level: E.level, made: Date.now() };
E.saved = E.saved.map(cleanEnc).filter(t => t && t.id).slice(0, 60);
export function restoreEncounters(list) {
  if (!Array.isArray(list)) return 0; let n = 0;
  list.forEach(raw => { const t = cleanEnc(raw); if (!t || !t.id || E.saved.some(s => s.id === t.id)) return; E.saved.push(t); n++; });
  if (n) { save(); renderSaved(); }
  return n;
}

let mons = null; // { list, byKey } from the Bestiary
const getMons = () => bestiaryAPI.data().then(d => (mons = d));
const rowFrom = (m, c = 1) => ({ k: m.k, n: m.n, cr: m.cr, xp: XP[m.cr] ?? 0, init: m.init ?? 0, ty: m.ty, c, ...(m.src ? { bk: m.src } : {}) });

// ---------- scoring ----------
const total = (rows = E.cur.rows) => rows.reduce((a, r) => a + r.xp * r.c, 0);
function verdict(t) {
  const [lo, mo, hi] = budgets();
  if (!t) return { key: "none", label: "No monsters yet" };
  if (t <= lo / 2) return { key: "trivial", label: "Trivial" };
  if (t <= lo) return { key: "low", label: "Low" };
  if (t <= mo) return { key: "moderate", label: "Moderate" };
  if (t <= hi) return { key: "high", label: "High" };
  return { key: "over", label: "Beyond High" };
}

// ---------- rendering ----------
function renderParty() {
  $("en-size").value = E.size; $("en-level").value = E.level;
  const [lo, mo, hi] = budgets();
  $("en-budget").textContent = `XP budget for ${E.size} level-${E.level} character${E.size === 1 ? "" : "s"}: Low ${fmt(lo)}, Moderate ${fmt(mo)}, High ${fmt(hi)}.`;
  $("en-diff").value = E.diff; $("en-style").value = E.style; $("en-src").value = E.src; $("en-theme").value = E.theme; $("en-q").value = E.q;
}
function renderMeter() {
  const [lo, mo, hi] = budgets(), t = total(), v = verdict(t);
  const max = Math.max(hi * 1.15, t * 1.02, 1), pct = x => Math.min(100, x / max * 100);
  const count = E.cur.rows.reduce((a, r) => a + r.c, 0);
  const big = E.cur.rows.filter(r => r.cr > E.level);
  $("en-meter").innerHTML = `<div class="en-verdict ${v.key}"><b>${v.label}</b><span>${fmt(t)} XP · ${count} monster${count === 1 ? "" : "s"} · ${E.size} level-${E.level} characters</span></div>
    <div class="en-bar" role="img" aria-label="${fmt(t)} XP against budgets of ${fmt(lo)}, ${fmt(mo)} and ${fmt(hi)}"><div class="en-fill ${v.key}" style="width:${pct(t)}%"></div>
      <i class="en-tick" style="left:${pct(lo)}%"></i><i class="en-tick" style="left:${pct(mo)}%"></i><i class="en-tick" style="left:${pct(hi)}%"></i></div>
    <div class="en-ticks"><span style="left:${pct(lo)}%">Low ${fmt(lo)}</span><span style="left:${pct(mo)}%">Mod ${fmt(mo)}</span><span style="left:${pct(hi)}%">High ${fmt(hi)}</span></div>
    ${big.length ? `<p class="en-warn">${esc(big.map(r => `${r.n} (CR ${crLabel(r.cr)})`).join(", "))} ${big.length === 1 ? "is" : "are"} above the party's level. The 2024 DMG warns that a single such creature can deal enough damage to drop a character in one turn.</p>` : ""}`;
}
function renderRows() {
  const rows = E.cur.rows;
  $("en-rows").innerHTML = rows.length ? rows.map((r, i) => `<li class="en-row" data-i="${i}">
    <span class="who"><button type="button" data-open="${esc(r.k)}" title="Open stat block">${esc(r.n)}</button><span>CR ${crLabel(r.cr)} · ${fmt(r.xp)} XP each · ${esc(cap(r.ty))}${r.bk ? ` · ${esc(BOOKS[r.bk]?.tag || "")}` : ""}</span></span>
    <span class="en-count"><button type="button" data-cnt="-1" aria-label="One fewer ${esc(r.n)}">−</button><output>${r.c}</output><button type="button" data-cnt="1" aria-label="One more ${esc(r.n)}">+</button></span>
    <span class="en-sub"><b>${fmt(r.xp * r.c)} XP</b><button type="button" data-rm aria-label="Remove ${esc(r.n)}">Remove</button></span></li>`).join("")
    : `<li class="en-empty">No monsters yet. Add some from the list on the left, press Build encounter, or use Add to encounter on any Bestiary stat block.</li>`;
}
function render() {
  $("en-name").value = E.cur.name; $("en-notes").value = E.cur.notes;
  renderMeter(); renderRows(); renderSaved(); renderLoot();
}
const sigOf = rows => rows.map(r => `${r.k}:${r.c}`).join("|");
const lootValue = l => {
  const RV = lootAPI.RVALUE || {};
  return l.groups.reduce((a, g) => a + g.total * (g.u === "PP" ? 10 : 1), 0) + (l.hoard ? l.hoard.total + l.hoard.items.reduce((a, it) => a + (RV[it.r] || 0), 0) : 0);
};
function renderLoot() {
  const l = E.cur.loot, sec = $("en-loot-sec");
  $("en-loot-hoardon").checked = E.lootHoard !== false;
  sec.hidden = !l;
  if (!l) return;
  const RL = lootAPI.RLABEL || {};
  $("en-loot-total").textContent = `≈ ${fmt(lootValue(l))} GP in all`;
  $("en-loot-stale").hidden = l.sig === sigOf(E.cur.rows);
  $("en-loot-list").innerHTML = l.groups.map(g => `<li>
    <span class="g"><b>${esc(g.n)}${g.c > 1 ? ` ×${g.c}` : ""}</b>${g.none ? `<span class="none">carries nothing</span>` : `<span class="amt">${fmt(g.total)} ${g.u}</span><span class="how">${g.c > 1 ? `${g.c} × ` : ""}${esc(g.expr)} ${g.u}${g.c > 1 ? `: ${g.each.map(fmt).join(", ")}` : ""}</span>`}</span>
    ${g.carry ? `<p class="carry">${esc(g.carry)}</p>` : g.none ? `<span class="how">Beasts and other creatures that don't collect treasure.</span>` : ""}</li>`).join("");
  const hd = l.hoard;
  $("en-loot-hoard").innerHTML = hd ? `<span class="hh">Hoard · ${esc(hd.by)} (CR ${crLabel(hd.cr)})</span>
    <p><b>${esc(hd.text)}</b> <span class="how">${esc(hd.expr)} GP</span></p>
    ${hd.items.length ? `<div class="lt-items">${hd.items.map(it => `<button type="button" class="lt-item" data-r="${esc(it.r)}" data-lk="${esc(it.k)}">${esc(it.n)}<small>${esc(RL[it.r] || "")}</small></button>`).join("")}</div>` : `<span class="lt-none">No magic items</span>`}` : "";
  $("en-loot-hook").textContent = l.hook || ""; $("en-loot-hook").hidden = !l.hook;
}
let delArm = null;
function renderSaved() {
  $("en-saved-wrap").hidden = !E.saved.length;
  $("en-saved").innerHTML = E.saved.map(s => `<li data-sid="${esc(s.id)}"${E.cur.id === s.id ? ' aria-current="true"' : ""}>
    <button type="button" class="lt-open" data-sact="open"><b>${esc(s.name || "Untitled encounter")}</b><span>${s.rows.reduce((a, r) => a + r.c, 0)} monsters · ${fmt(total(s.rows))} XP · party of ${s.size} at level ${s.level}</span></button>
    <button type="button" class="small ghost" data-sact="${delArm === s.id ? "delok" : "del"}">${delArm === s.id ? "Delete for good" : "Delete"}</button></li>`).join("");
}
function renderPicker() {
  if (!mons) return;
  const q = E.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = q.length ? mons.list.filter(m => q.every(w => (m._s || m.n.toLowerCase()).includes(w))) : [];
  const list = hits.slice().sort((a, b) => a.n.localeCompare(b.n) || a.cr - b.cr).slice(0, 80);
  $("en-pick").innerHTML = !q.length ? `<li class="none">Type a name or creature type to find monsters.</li>` : list.length ? list.map(m => `<li><button type="button" data-add="${esc(m.k)}">
    <span class="cr${m.custom ? " mine-cr" : ""}">CR ${crLabel(m.cr)}</span><span class="nm"><b>${esc(m.n)}${m.custom ? '<span class="mine">Yours</span>' : ""}${m.src ? `<span class="book-tag">${esc(bookOf(m).tag)}</span>` : ""}</b><span>${fmt(XP[m.cr] ?? 0)} XP · ${esc(m.ty)}</span></span><span class="add">Add</span></button></li>`).join("") + (hits.length > list.length ? `<li class="none">Showing ${list.length} of ${fmt(hits.length)} matches. Type more of the name to narrow it down.</li>` : "") : `<li class="none">No monsters match.</li>`;
}
// How many monsters the current filters draw from, by book.
function renderPool() {
  if (!mons) return;
  const { all } = candidates(), by = {};
  all.forEach(m => { const g = m.custom ? "Your variants" : (bookOf(m).tag || "SRD 5.2"); by[g] = (by[g] || 0) + 1; });
  $("en-pool").textContent = all.length ? `Drawing from ${fmt(all.length)} monsters: ${Object.entries(by).map(([g, n]) => `${g} ${fmt(n)}`).join(", ")}.` : "No monsters match these filters.";
}
function renderTypes() {
  if (!mons) return;
  const types = [...new Set(mons.list.map(m => m.ty))].sort();
  $("en-type").innerHTML = `<option value="">Any type</option>` + types.map(t => `<option value="${esc(t)}"${E.type === t ? " selected" : ""}>${esc(cap(t))}</option>`).join("");
}
const changed = () => { if (E.cur.id) E.cur.dirty = true; save(); renderMeter(); renderRows(); renderLoot(); };

// ---------- adding ----------
function addMonster(m, c = 1) {
  const r = E.cur.rows.find(x => x.k === m.k);
  if (r) r.c = Math.min(40, r.c + c); else E.cur.rows.push(rowFrom(m, c));
  changed();
}
// What the Bestiary and Combat tabs use: the current rows, the name, adding a monster.
export const encAPI = {
  rows: () => JSON.parse(JSON.stringify(E.cur.rows)),
  name: () => E.cur.name || "the encounter",
  add: m => {
    addMonster(m);
    const v = verdict(total()), n = E.cur.rows.reduce((a, r) => a + r.c, 0);
    return `Added to ${E.cur.name || "the encounter"}: ${n} monster${n === 1 ? "" : "s"}, ${v.label}.`;
  },
};

// ---------- building to a difficulty ----------
function candidates(forClaude) {
  const words = E.theme.trim().toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const srcOk = m => E.src === "all" || (E.src === "mine" ? !!m.custom : !m.custom && (E.src === "kobold" ? bookOf(m).by === "Kobold Press" : (m.src || "srd-2024") === (E.src === "srd" ? "srd-2024" : E.src)));
  let list = mons.list.filter(m => srcOk(m) && (!E.type || m.ty === E.type) && (XP[m.cr] ?? 0) > 0);
  let themed = list;
  if (words.length) { const hit = list.filter(m => words.some(w => (m._s || m.n.toLowerCase()).includes(w))); if (hit.length) themed = hit; }
  return { all: list, themed, usedTheme: themed !== list };
}
function autoBuild() {
  const [lo, mo, hi] = budgets(), di = DIFFS.indexOf(E.diff);
  const maxT = [lo, mo, hi][di], minT = di === 0 ? lo / 2 : [lo, mo, hi][di - 1];
  const { all, themed, usedTheme } = candidates();
  const fits = list => list.filter(m => XP[m.cr] <= maxT);
  let pool = fits(themed); if (!pool.length) pool = fits(all);
  if (!pool.length) return { rows: null, msg: "No monsters fit that budget with these filters. Loosen the creature type or raise the difficulty." };
  const safe = pool.filter(m => m.cr <= E.level); const base = safe.length ? safe : pool;
  const xp = m => XP[m.cr];
  // Related monsters: same family name (Goblin Boss, Goblin Warrior) or the same type, except beasts, which only pair by family.
  const fam = m => m.n.replace(/^(Young|Adult|Ancient|Giant|Swarm of)\s+/i, "").split(/\s+/)[0].toLowerCase();
  const kin = (a, b) => fam(a) === fam(b) || (a.ty === b.ty && a.ty !== "beast");
  let best = null, bestT = 0;
  for (let tries = 0; tries < 400; tries++) {
    let rows = [];
    if (E.style === "solo") {
      const opts = pool.filter(m => xp(m) > minT && xp(m) <= maxT); if (!opts.length) break;
      rows = [rowFrom(pick(opts), 1)];
    } else if (E.style === "horde") {
      const m = pick(base), c = Math.floor(maxT / xp(m)); if (c < 3) continue;
      rows = [rowFrom(m, Math.min(c, 12))];
    } else if (E.style === "leader") {
      const leaders = base.filter(m => xp(m) >= maxT * .3 && xp(m) <= maxT * .65); if (!leaders.length) break;
      const L = pick(leaders), rest = maxT - xp(L);
      let mins = base.filter(m => m.k !== L.k && xp(m) <= xp(L) / 2 && xp(m) * 2 <= rest);
      const close = mins.filter(m => kin(m, L)); if (close.length) mins = close;
      if (!mins.length) continue;
      const M = pick(mins), c = Math.min(10, Math.floor(rest / xp(M))); if (c < 2) continue;
      rows = [rowFrom(L, 1), rowFrom(M, c)];
    } else {
      const first = pick(base); let kinds = [first];
      const extra = base.filter(m => m.k !== first.k && kin(m, first));
      if (!extra.length) continue;
      for (let i = 0; i < rnd(2) && extra.length; i++) { const m = pick(extra); if (!kinds.includes(m)) kinds.push(m); }
      rows = kinds.map(m => rowFrom(m, 0));
      let t = 0, guard = 0;
      while (guard++ < 60) {
        const can = rows.filter(r => t + r.xp <= maxT && r.c < 10); if (!can.length) break;
        const r = pick(can); r.c++; t += r.xp;
        if (t > minT && rnd(4) === 1) break;
      }
      rows = rows.filter(r => r.c > 0);
      if (rows.length < 2) continue;
    }
    const t = total(rows);
    if (t > minT && t <= maxT && t > bestT) { best = rows; bestT = t; if (t >= maxT * .9) break; }
  }
  if (!best) return { rows: null, msg: `Couldn't fit a ${E.style === "solo" ? "single monster" : E.style === "horde" ? "horde" : "group"} into a ${DLABEL[E.diff]} budget with these filters. Try another shape or type.` };
  return { rows: best, msg: usedTheme ? "" : (E.theme.trim() ? `No monster names match "${E.theme.trim()}", so the theme was ignored. Suggest with Claude reads themes more loosely.` : "") };
}

// ---------- suggest with Claude ----------
let enCtl = null;
async function suggest() {
  const st = $("en-gen-status");
  if (enCtl) return;
  if (!claude.sample) { st.textContent = "Claude isn't available in this view. Open the forge on claude.ai, or use Build encounter."; st.classList.add("err"); return; }
  st.classList.remove("err");
  await getMons();
  const [lo, mo, hi] = budgets(), maxT = { low: lo, moderate: mo, high: hi }[E.diff];
  const { all, themed } = candidates();
  const fit = all.filter(m => XP[m.cr] <= maxT && m.cr <= E.level + 3);
  // Theme matches first, then a sample spread evenly across every book (and your variants), shuffled,
  // so Claude sees the whole Bestiary rather than whichever monsters come first alphabetically.
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1) - 1; [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const CAP = 240, tk = new Set(themed.map(m => m.k));
  const picked = shuffle(fit.filter(m => tk.has(m.k) && candidates().usedTheme)).slice(0, CAP);
  const groups = {}; shuffle(fit.filter(m => !picked.includes(m))).forEach(m => { const g = m.custom ? "yours" : (m.src || "srd-2024"); (groups[g] ||= []).push(m); });
  const keys = Object.keys(groups);
  for (let i = 0; picked.length < CAP && keys.some(g => groups[g].length); i++) { const g = groups[keys[i % keys.length]]; if (g.length) picked.push(g.shift()); }
  const list = picked.map(m => ({ k: m.k, n: m.n, cr: m.cr, xp: XP[m.cr], ty: m.ty, book: m.custom ? "yours" : bookOf(m).tag || "SRD" }));
  if (!list.length) { st.textContent = "No monsters fit that budget with these filters."; st.classList.add("err"); return; }
  const S2 = S;
  const camp = [state?.output, lstate?.output].filter(Boolean).join("\n\n").slice(0, 2500);
  const prompt = `You are designing a Dungeons & Dragons 2024 combat encounter for a ${S2?.name || "fantasy"} campaign.

Party: ${E.size} characters of level ${E.level}. XP budgets (total for the party): Low ${lo}, Moderate ${mo}, High ${hi}. Target: ${DLABEL[E.diff]}, so the monsters' XP should add up to more than ${E.diff === "low" ? Math.round(lo / 2) : E.diff === "moderate" ? lo : mo} and no more than ${maxT}. There is no multiplier for groups.
Shape: ${{ mixed: "a mixed group of 2 or 3 kinds of monster", leader: "one leader with a group of weaker minions", horde: "many of one kind of monster", solo: "a single powerful monster" }[E.style]}.
Theme: ${E.theme.trim() || "anything that would make an interesting fight"}.
${camp ? `\nCampaign context (use for names, place and motive, lightly):\n"""\n${camp}\n"""\n` : ""}
Choose ONLY from these monsters (k is the key, xp is per monster):
${JSON.stringify(list)}

Prefer monsters that make sense together. Avoid monsters with CR above ${E.level} unless the shape is a solo monster.
Reply with ONLY JSON: {"name":"short evocative encounter name","monsters":[{"k":"key","count":2}],"notes":"Under 90 words for the GM: where it happens, one terrain feature that matters, and how the monsters fight together."}`;
  enCtl = new AbortController();
  $("en-claude").disabled = $("en-auto").disabled = true; $("en-stop").hidden = false;
  st.textContent = `Claude is choosing from ${list.length}${fit.length > list.length ? ` of ${fmt(fit.length)}` : ""} monsters that fit the budget… this takes about a minute.`;
  try {
    let raw;
    if (typeof claude.sample.json === "function") {
      try { raw = await claude.sample.json(prompt, { signal: enCtl.signal, cache: false }); }
      catch (e) { if (e.code === "invalid_json" && e.text) raw = JSON.parse((e.text.match(/\{[\s\S]*\}/) || ["null"])[0]); else throw e; }
    } else {
      const { text } = await claude.sample(prompt, { signal: enCtl.signal, cache: false });
      raw = JSON.parse((text.match(/\{[\s\S]*\}/) || ["null"])[0]);
    }
    const ok = new Set(list.map(m => m.k));
    const rows = [];
    (Array.isArray(raw?.monsters) ? raw.monsters : []).forEach(x => {
      const m = mons.byKey[x?.k]; if (!m || !ok.has(m.k)) return;
      const r = rows.find(y => y.k === m.k), c = clampInt(x.count, 1, 20, 1);
      if (r) r.c = Math.min(40, r.c + c); else rows.push(rowFrom(m, c));
    });
    if (!rows.length) throw { code: "bad_enc" };
    E.cur = { id: "", name: clip(raw.name, 100), notes: clip(raw.notes, 4000), rows, size: E.size, level: E.level, made: Date.now() };
    save(); render();
    const v = verdict(total(rows));
    st.textContent = v.key === E.diff ? `Done: ${v.label}, ${fmt(total(rows))} XP.` : `Done. It came out ${v.label} (${fmt(total(rows))} XP) rather than ${DLABEL[E.diff]}; adjust the counts if you like.`;
  } catch (e) {
    const msg = claudeErrorMessage(e, { bad_enc: "Claude's reply didn't contain usable monsters. Try again.", refused: "Claude declined that request. Try a different theme.", syntax: "Claude's reply didn't contain usable monsters. Try again." });
    st.textContent = msg; st.classList.toggle("err", e?.code !== "cancelled");
  } finally { enCtl = null; $("en-claude").disabled = $("en-auto").disabled = false; $("en-stop").hidden = true; }
}

// ---------- other actions ----------
function rollInit() {
  if (!E.cur.rows.length) return;
  const order = E.cur.rows.map(r => ({ n: r.c > 1 ? `${r.n} ×${r.c}` : r.n, v: rnd(20) + r.init, b: r.init })).sort((a, b) => b.v - a.v || b.b - a.b);
  logEntry($("en-log"), `<span class="tot">${order[0].v}</span><span>Initiative: ${order.map(o => `${esc(o.n)} ${o.v}`).join(" · ")}</span><span class="how">d20 + each monster's Initiative; a group acts together</span>`, 3);
}
function markdown() {
  const t = E.cur, v = verdict(total());
  const out = [`## ${t.name || "Encounter"}`, `*${v.label}: ${fmt(total())} XP for ${E.size} level-${E.level} characters (2024 DMG budgets)*`, "", "| Monster | CR | Count | XP |", "|---|---|---|---|"];
  t.rows.forEach(r => out.push(`| ${r.n} | ${crLabel(r.cr)} | ${r.c} | ${fmt(r.xp * r.c)} |`));
  if (t.notes.trim()) out.push("", t.notes.trim());
  const l = t.loot;
  if (l) {
    out.push("", `### Loot (≈ ${fmt(lootValue(l))} GP)`);
    l.groups.forEach(g => out.push(`- **${g.n}${g.c > 1 ? ` ×${g.c}` : ""}:** ${g.none ? "nothing" : `${fmt(g.total)} ${g.u}`}${g.carry ? ` — ${g.carry}` : ""}`));
    if (l.hoard) out.push(`- **Hoard (${l.hoard.by}):** ${l.hoard.text}${l.hoard.items.length ? `; ${l.hoard.items.map(i => i.n).join(", ")}` : ""}`);
    if (l.hook) out.push("", `*${l.hook}*`);
  }
  return out.join("\n");
}
function saveEnc() {
  const t = E.cur;
  if (!t.rows.length) { $("en-status").textContent = "Add a monster before saving."; return; }
  if (!t.id) t.id = "en-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (!t.name.trim()) { t.name = `${verdict(total()).label} fight: ${t.rows.map(r => r.n).slice(0, 2).join(" and ")}`; $("en-name").value = t.name; }
  t.size = E.size; t.level = E.level; delete t.dirty;
  const copy = JSON.parse(JSON.stringify(t)), i = E.saved.findIndex(s => s.id === t.id);
  if (i >= 0) E.saved[i] = copy; else E.saved.unshift(copy);
  E.saved = E.saved.slice(0, 60);
  if (!save()) { $("en-status").textContent = "Couldn't save: browser storage is full."; return; }
  renderSaved(); $("en-status").textContent = i >= 0 ? "Saved changes." : "Saved.";
}


// ---------- loot for this encounter ----------
// Each creature rolls Random Individual Treasure for its own CR (2024 DMG). Beasts, oozes, plants and anything with
// Intelligence 3 or lower don't collect treasure. An optional hoard is rolled at the toughest monster's CR.
const carriesNothing = m => !!m && (["beast", "ooze", "plant"].includes(m.ty) || (Array.isArray(m.ab) && m.ab[3] <= 3));
async function genLoot() {
  const st = $("en-loot-status");
  if (!E.cur.rows.length) { $("en-status").textContent = "Add monsters first; the loot comes from them."; return; }
      await getMons().catch(() => {});
  const groups = E.cur.rows.map(r => {
    const m = mons?.byKey[r.k];
    if (carriesNothing(m)) return { k: r.k, n: r.n, c: r.c, u: "GP", total: 0, each: [], expr: "", none: true, carry: "" };
    const rolls = Array.from({ length: r.c }, () => lootAPI.individual(r.cr));
    return { k: r.k, n: r.n, c: r.c, u: rolls[0].u, total: rolls.reduce((a, x) => a + x.total, 0), each: rolls.map(x => x.total), expr: rolls[0].expr, none: false, carry: "" };
  });
  let hoard = null, msg = "";
  if (E.lootHoard !== false) {
    const top = E.cur.rows.slice().sort((a, b) => b.cr - a.cr)[0];
    try {
      const row = await lootAPI.hoard(top.cr);
      hoard = { by: top.n, cr: top.cr, total: row.coins.total, expr: row.coins.expr, text: row.form.text, items: row.items };
    } catch { msg = "The item list didn't load, so the hoard was skipped."; }
  }
  E.cur.loot = { groups, hoard, hook: "", sig: sigOf(E.cur.rows) };
  save(); renderLoot();
  st.textContent = msg; st.classList.toggle("err", !!msg);
  $("en-loot-sec").scrollIntoView({ block: "nearest", behavior: smooth() });
}
let elCtl = null;
async function describeLoot() {
  const l = E.cur.loot, st = $("en-loot-status"); if (!l || elCtl) return;
  if (!claude.sample) { st.textContent = "Claude isn't available in this view. Open the forge on claude.ai to describe the loot."; st.classList.add("err"); return; }
  st.classList.remove("err");
  const rars = [...new Set((l.hoard?.items || []).map(i => i.r))];
  const { cands, byKey } = await lootAPI.candidates(rars);
  const S2 = S;
  const brief = {
    encounter: E.cur.name || "an encounter", notes: E.cur.notes.slice(0, 600),
    groups: l.groups.map(g => ({ k: g.k, monster: g.n, count: g.c, type: E.cur.rows.find(r => r.k === g.k)?.ty || "", carries: g.none ? "nothing" : `${g.total} ${g.u}` })),
    hoard: l.hoard ? { owner: l.hoard.by, value_gp: l.hoard.total, form: l.hoard.text, item_slots: l.hoard.items.map(i => i.r) } : null,
  };
  const prompt = `You are describing the treasure from a Dungeons & Dragons 2024 encounter in a ${S2?.name || "fantasy"} campaign.

${JSON.stringify(brief)}
${rars.length ? `\nCandidate magic items for the hoard, by rarity (choose ONLY from these keys, one per slot, same rarity and order):\n${JSON.stringify(cands)}\n` : ""}
For each group that carries something, write "carry": what those monsters actually have on them, in under 22 words, fitting the monster and the encounter, ending with the exact total (e.g. "...worth 38 GP in all"). For groups that carry nothing, write a short line about anything useful left behind (a hide, a nest, a clue) with no monetary value.
${l.hoard ? `For the hoard, write "treasure": the hoard's monetary treasure in under 25 words, same form and exact value, and pick "items" from the candidates that fit the owner.` : ""}
Write "hook": one sentence the GM can use, a clue or rumor found among the loot.

Reply with ONLY JSON: {"groups":[{"k":"key","carry":"..."}],${l.hoard ? `"hoard":{"treasure":"...","items":["key"]},` : ""}"hook":"..."}`;
  elCtl = new AbortController();
  $("en-loot-flavor").disabled = true; $("en-loot-stop").hidden = false;
  st.textContent = "Claude is describing the loot… this takes about a minute.";
  try {
    let raw;
    if (typeof claude.sample.json === "function") {
      try { raw = await claude.sample.json(prompt, { signal: elCtl.signal, cache: false }); }
      catch (e) { if (e.code === "invalid_json" && e.text) raw = JSON.parse((e.text.match(/\{[\s\S]*\}/) || ["null"])[0]); else throw e; }
    } else {
      const { text } = await claude.sample(prompt, { signal: elCtl.signal, cache: false });
      raw = JSON.parse((text.match(/\{[\s\S]*\}/) || ["null"])[0]);
    }
    if (!raw || typeof raw !== "object") throw { code: "bad_loot" };
    if (E.cur.loot !== l) return;
    (Array.isArray(raw.groups) ? raw.groups : []).forEach(x => { const g = l.groups.find(y => y.k === x?.k); if (g && typeof x.carry === "string") g.carry = x.carry.trim().slice(0, 300); });
    if (l.hoard && raw.hoard) {
      if (typeof raw.hoard.treasure === "string" && raw.hoard.treasure.trim()) l.hoard.text = raw.hoard.treasure.trim().slice(0, 240);
      (Array.isArray(raw.hoard.items) ? raw.hoard.items : []).forEach((k, i) => {
        const slot = l.hoard.items[i], hit = slot && (cands[slot.r] || []).some(c => c.k === k) && byKey[k];
        if (hit && hit.r === slot.r) l.hoard.items[i] = { k, n: hit.n, r: slot.r };
      });
    }
    l.hook = typeof raw.hook === "string" ? raw.hook.trim().slice(0, 400) : "";
    save(); renderLoot(); st.textContent = "Described. Coin values and item rarities are unchanged.";
  } catch (e) {
    const msg = claudeErrorMessage(e, { bad_loot: "Claude's reply didn't contain a usable description. Try again.", refused: undefined, syntax: "Claude's reply didn't contain a usable description. Try again." });
    st.textContent = msg; st.classList.toggle("err", e?.code !== "cancelled");
  } finally { elCtl = null; $("en-loot-flavor").disabled = false; $("en-loot-stop").hidden = true; }
}

export function openEncounters() { renderParty(); render(); getMons().then(() => { renderTypes(); renderPicker(); renderPool(); }).catch(() => {}); }

export function initEncounters() {
  // ---------- wiring ----------
  const party = () => { E.size = clampInt($("en-size").value, 1, 10, E.size); E.level = clampInt($("en-level").value, 1, 20, E.level); save(); renderParty(); renderMeter(); };
  $("en-size").addEventListener("change", party); $("en-level").addEventListener("change", party);
  [["en-diff", "diff"], ["en-style", "style"], ["en-type", "type"], ["en-src", "src"]].forEach(([id, k]) => $(id).addEventListener("change", e => { E[k] = e.target.value; save(); renderPool(); }));
  $("en-theme").addEventListener("input", e => { E.theme = e.target.value; save(); });
  let qT; $("en-q").addEventListener("input", e => { clearTimeout(qT); qT = setTimeout(() => { E.q = e.target.value; save(); getMons().then(renderPicker).catch(() => {}); }, 120); });
  $("en-pick").addEventListener("click", e => { const k = e.target.closest("[data-add]")?.dataset.add; if (k && mons?.byKey[k]) { addMonster(mons.byKey[k]); $("en-status").textContent = `Added ${mons.byKey[k].n}.`; } });
  $("en-auto").addEventListener("click", () => {
    const st = $("en-gen-status"); st.classList.remove("err");
    getMons().then(() => {
      const res = autoBuild();
      if (!res.rows) { st.textContent = res.msg; st.classList.add("err"); return; }
      E.cur = { id: "", name: "", notes: "", rows: res.rows, size: E.size, level: E.level, made: Date.now() };
      save(); render();
      st.textContent = res.msg || `Built a ${verdict(total()).label} encounter: ${fmt(total())} XP. Press again for another.`;
    }).catch(() => { st.textContent = "The monster list didn't load. Check your connection, then try again."; st.classList.add("err"); });
  });
  $("en-claude").addEventListener("click", suggest);
  $("en-stop").addEventListener("click", () => enCtl?.abort());
  $("en-rows").addEventListener("click", e => {
    const op = e.target.closest("[data-open]"); if (op) { if (op.dataset.open) bestiaryAPI.open(op.dataset.open); return; }
    const li = e.target.closest("[data-i]"); if (!li) return; const r = E.cur.rows[+li.dataset.i];
    const c = e.target.closest("[data-cnt]"); if (c) { r.c = Math.max(1, Math.min(40, r.c + +c.dataset.cnt)); changed(); return; }
    if (e.target.closest("[data-rm]")) { E.cur.rows.splice(+li.dataset.i, 1); changed(); }
  });
  $("en-name").addEventListener("input", e => { E.cur.name = e.target.value.slice(0, 100); save(); });
  $("en-notes").addEventListener("input", e => { E.cur.notes = e.target.value.slice(0, 4000); save(); });
  $("en-new").addEventListener("click", () => { E.cur = { id: "", name: "", notes: "", rows: [], size: E.size, level: E.level, made: Date.now() }; save(); render(); $("en-log").innerHTML = ""; $("en-status").textContent = "Started a new encounter."; });
  $("en-init").addEventListener("click", rollInit);
  $("en-save").addEventListener("click", saveEnc);
  $("en-copy").addEventListener("click", () => {
    copyMarkdown(markdown(), $("en-card"), $("en-status"), "encounter");
  });
  $("en-loot").addEventListener("click", genLoot);
  $("en-tocombat").addEventListener("click", () => { if (!E.cur.rows.length) { $("en-status").textContent = "Add monsters first."; return; } showView("combat"); document.getElementById("cb-fill")?.click(); });
  $("en-loot-reroll").addEventListener("click", genLoot);
  $("en-loot-flavor").addEventListener("click", describeLoot);
  $("en-loot-stop").addEventListener("click", () => elCtl?.abort());
  $("en-loot-hoardon").addEventListener("change", e => { E.lootHoard = e.target.checked; save(); });
  $("en-loot-clear").addEventListener("click", () => { E.cur.loot = null; save(); renderLoot(); $("en-status").textContent = "Cleared the loot."; });
  $("en-loot-table").addEventListener("click", () => {
    if (!E.cur.rows.length) return;
    const maxCr = Math.max(...E.cur.rows.map(r => r.cr));
    lootAPI.rollFor({ band: lootAPI.bandFor(maxCr), type: "hoard", title: `Loot: ${E.cur.name || "encounter"}` });
  });
  $("en-loot-hoard").addEventListener("click", e => { const it = e.target.closest("[data-lk]"); if (it) itemsAPI.open(it.dataset.lk); });
  $("en-saved").addEventListener("click", e => {
    const li = e.target.closest("[data-sid]"), act = e.target.closest("[data-sact]")?.dataset.sact; if (!li || !act) return;
    const s = E.saved.find(x => x.id === li.dataset.sid); if (!s) return;
    if (act === "open") { delArm = null; E.cur = JSON.parse(JSON.stringify(s)); E.size = s.size; E.level = s.level; save(); renderParty(); render(); $("en-log").innerHTML = ""; $("en-status").textContent = ""; }
    else if (act === "del") { delArm = s.id; renderSaved(); }
    else if (act === "delok") { delArm = null; E.saved = E.saved.filter(x => x.id !== s.id); if (E.cur.id === s.id) E.cur.id = ""; save(); renderSaved(); $("en-status").textContent = `Deleted ${s.name || "the encounter"}.`; }
  });
  renderParty();
}
