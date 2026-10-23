// Loot: roll tables of treasure using the 2024 DMG treasure rules (pp. 120-121,
// 218) and the SRD 5.2 items, with Claude theming a table without changing any
// row's rarities or coin values.
import { $, esc, logEntry, smooth } from "../shared/dom.js";
import { rnd, sum } from "../shared/dice.js";
import { fmt } from "../shared/format.js";
import { clip } from "../shared/sanitize.js";
import { RULES } from "../data/index.js";
import { store, state, lstate, S, save } from "../app/state.js";
import { claude, claudeJson, claudeErrorMessage } from "../shared/claude.js";
import { showView } from "../app/shell.js";
import { campaignContext, copyMarkdown } from "./catalogs/common.js";
import { itemsAPI } from "./catalogs/items.js";

const L = store.loot = Object.assign({ type: "hoard", band: 0, die: 10, pools: { arms: true, wond: true, cons: true, impl: true, mine: true }, cur: null, saved: [] }, typeof store.loot === "object" && store.loot ? store.loot : {});
if (!Array.isArray(L.saved)) L.saved = [];
if (typeof L.pools !== "object" || !L.pools) L.pools = { arms: true, wond: true, cons: true, impl: true, mine: true };

const RLABEL = RULES.loot.rarityLabels;
const RORDER = RULES.loot.rarityOrder;
// 2024 DMG guideline values by rarity, used for the value column.
const RVALUE = RULES.loot.rarityValue;
// Random Treasure Hoard, Random Individual Treasure, and Magic Item Rarities by band.
const BANDS = RULES.loot.bands;
const POOLS = RULES.loot.pools;
const GEMS = RULES.loot.gems, ART = RULES.loot.art;

let items = null; // { list, byKey }
// Always ask Items for the current list, so newly saved variants are included.
const getItems = () => itemsAPI.data().then(d => (items = d));

// ---------- generating ----------
function pool() {
  const cats = Object.entries(POOLS).filter(([k]) => L.pools[k]).flatMap(([, c]) => c);
  const src = items.list.filter(x => x.m && RORDER.includes(x.r) && (x.custom ? L.pools.mine : cats.includes(x.cat)));
  const by = {}; RORDER.forEach(r => { by[r] = src.filter(x => x.r === r); });
  return by;
}
function pickItem(by, r) {
  // Nearest rarity that has something, preferring lower when tied, if the chosen rarity is empty in this pool.
  const i = RORDER.indexOf(r);
  const order = [i, i - 1, i + 1, i - 2, i + 2, i - 3, i + 3, i - 4, i + 4].filter(j => j >= 0 && j < RORDER.length);
  for (const j of order) { const list = by[RORDER[j]]; if (list.length) { const x = list[rnd(list.length) - 1]; return { k: x.k, n: x.n, r: x.r }; } }
  return null;
}
function moneyForm(total) {
  // Stash & Cache (2024 DMG): d20 → 1-8 coins, 9-12 gemstones, 13-15 trade bars, 16-18 trade goods, 19-20 art objects
  const d = rnd(20);
  const split = (vals, noun) => {
    const each = vals.find(v => total / v >= 3) || vals[vals.length - 1];
    const count = Math.max(1, Math.floor(total / each)), rest = total - count * each;
    return `${count} ${noun}${count === 1 ? "" : "s"} worth ${fmt(each)} GP${count === 1 ? "" : " each"}${rest > 0 ? `, plus ${fmt(rest)} GP in coins` : ""}`;
  };
  if (d <= 8) return { kind: "coins", text: `${fmt(total)} GP in coins` };
  if (d <= 12) return { kind: "gemstones", text: split(GEMS, "gemstone") };
  if (d <= 15) return { kind: "trade bars", text: `Trade bars of silver, gold or platinum worth ${fmt(total)} GP` };
  if (d <= 18) return { kind: "trade goods", text: `Trade goods worth ${fmt(total)} GP` };
  return { kind: "art objects", text: split(ART, "art object") };
}
function makeRow(type, band, by) {
  const B = BANDS[band];
  if (type === "individual") {
    const c = B.ind, total = sum(c.n, c.s) * c.x;
    return { coins: { expr: `${c.n}d${c.s}${c.x > 1 ? ` × ${fmt(c.x)}` : ""}`, total, u: c.u }, form: { kind: "coins", text: `${fmt(total)} ${c.u}` }, items: [], flavor: "", lock: false };
  }
  const c = B.hoard, total = sum(c.n, c.s) * c.x;
  const count = Math.max(0, sum(B.items.n, B.items.s) + B.items.add);
  const its = [];
  for (let i = 0; i < count; i++) {
    const d = rnd(100), r = B.rar.find(([hi]) => d <= hi)[1];
    const it = pickItem(by, r); if (it) its.push(it);
  }
  return { coins: { expr: `${c.n}d${c.s} × ${fmt(c.x)}`, total, u: "GP" }, form: moneyForm(total), items: its, flavor: "", lock: false };
}
const rowValue = r => r.coins.total * (r.coins.u === "PP" ? 10 : 1) + r.items.reduce((a, it) => a + (RVALUE[it.r] || 0), 0);

function generate() {
  return getItems().then(() => {
    const by = pool();
    const old = L.cur && L.cur.type === L.type && L.cur.band === L.band && L.cur.die === L.die ? L.cur : null;
    const rows = Array.from({ length: L.die }, (_, i) => old?.rows[i]?.lock ? old.rows[i] : makeRow(L.type, L.band, by));
    L.cur = { id: "", title: "", intro: "", type: L.type, band: L.band, die: L.die, rows, made: Date.now() };
    save(); render();
    const empty = L.type === "hoard" && !Object.values(by).some(a => a.length);
    $("lt-gen-status").textContent = empty ? "No magic items match those categories, so the table has coins only." : "";
  }).catch(() => { $("lt-gen-status").textContent = "The item list didn't load. Check your connection, then try again."; });
}

// ---------- rendering ----------
function rowHTML(r, i) {
  const items = r.items.length ? `<div class="lt-items">${r.items.map(it => `<button type="button" class="lt-item" data-r="${esc(it.r)}" data-lk="${esc(it.k)}">${esc(it.n)}<small>${esc(RLABEL[it.r] || "")}</small></button>`).join("")}</div>` : (L.cur.type === "hoard" ? `<span class="lt-none">No magic items</span>` : "");
  return `<li class="lt-row" id="lt-row-${i + 1}" data-row="${i}">
    <span class="lt-num">${i + 1}</span>
    <div class="lt-body">
      <p class="lt-coins"><b>${esc(r.form.text)}</b> <span class="how">${esc(r.coins.expr)} ${esc(r.coins.u)}</span></p>
      ${r.flavor ? `<p class="lt-flavor">${esc(r.flavor)}</p>` : ""}
      ${items}
    </div>
    <div class="lt-side">
      <span class="lt-val">≈ ${fmt(rowValue(r))} GP</span>
      <span class="lt-acts">
        <button type="button" data-act="lock" aria-pressed="${r.lock ? "true" : "false"}" aria-label="Keep row ${i + 1} when rerolling">${r.lock ? "Kept" : "Keep"}</button>
        <button type="button" data-act="reroll" aria-label="Reroll row ${i + 1}"${r.lock ? " disabled" : ""}>Reroll</button>
      </span>
    </div>
  </li>`;
}
function render() {
  const t = L.cur, card = $("lt-card");
  $("lt-tools").hidden = !t;
  if (!t) { card.innerHTML = `<div class="best-empty">Choose the treasure type and challenge rating, then press Generate table.</div>`; return; }
  const B = BANDS[t.band];
  const title = t.title || `${t.type === "hoard" ? "Treasure Hoard" : "Individual Treasure"}, ${B.label}`;
  const total = t.rows.reduce((a, r) => a + rowValue(r), 0) / t.rows.length;
  card.innerHTML = `<header><h3>${esc(title)}</h3><p class="sbsub">d${t.die} · ${t.type === "hoard" ? "hoard" : "individual"} treasure for ${B.label} (characters of level ${B.levels}) · average row ≈ ${fmt(total)} GP</p></header>
    ${t.intro ? `<p class="lt-intro">${esc(t.intro)}</p>` : ""}
    <ol class="lt-rows" id="lt-rows">${t.rows.map(rowHTML).join("")}</ol>
    <p class="lt-foot">Coins, item counts and rarity odds from the 2024 Dungeon Master's Guide. Item values use the DMG's guideline price for each rarity. Tap an item to open it in Items.</p>`;
  $("lt-roll").textContent = `Roll d${t.die}`;
  renderSaved();
}
function renderControls() {
  document.querySelectorAll("#lt-type [data-type]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.type === L.type)));
  document.querySelectorAll("#lt-band [data-band]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.band === L.band)));
  document.querySelectorAll("#lt-die [data-die]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.die === L.die)));
  ["arms", "wond", "cons", "impl", "mine"].forEach(k => { $("lt-p-" + k).checked = !!L.pools[k]; });
  $("lt-pools").disabled = L.type !== "hoard";
  const B = BANDS[L.band];
  $("lt-type-note").textContent = L.type === "hoard"
    ? `A boss's or lair's stash: ${B.hoard.n}d${B.hoard.s} × ${fmt(B.hoard.x)} GP and ${B.items.add ? `${B.items.n}d${B.items.s} − 1` : `${B.items.n}d${B.items.s}`} magic items per row.`
    : `What one creature carries: ${B.ind.n}d${B.ind.s}${B.ind.x > 1 ? ` × ${fmt(B.ind.x)}` : ""} ${B.ind.u} per row.`;
  let lo = 0; const odds = B.rar.map(([hi, r]) => { const p = hi - lo; lo = hi; return `${RLABEL[r]} ${p}%`; }).join(", ");
  $("lt-band-note").textContent = `Suits characters of level ${B.levels}. Item rarity odds: ${odds}.`;
}
function renderSaved() {
  $("lt-saved-wrap").hidden = !L.saved.length;
  $("lt-saved").innerHTML = L.saved.map(s => `<li data-sid="${esc(s.id)}"${L.cur?.id === s.id ? ' aria-current="true"' : ""}>
    <button type="button" class="lt-open" data-sact="open"><b>${esc(s.title || "Untitled table")}</b><span>d${s.die} · ${s.type} · ${BANDS[s.band]?.label || ""}</span></button>
    <button type="button" class="small ghost" data-sact="${delArm === s.id ? "delok" : "del"}">${delArm === s.id ? "Delete for good" : "Delete"}</button></li>`).join("");
}

// ---------- validation for saved tables (storage and backups) ----------
function cleanTable(t) {
  if (!t || typeof t !== "object" || !Array.isArray(t.rows)) return null;
  const die = [6, 8, 10, 12, 20].includes(+t.die) ? +t.die : null; if (!die || t.rows.length !== die) return null;
  const band = [0, 1, 2, 3].includes(+t.band) ? +t.band : 0, type = t.type === "individual" ? "individual" : "hoard";
  const rows = t.rows.map(r => r && typeof r === "object" ? {
    coins: { expr: clip(r.coins?.expr, 30), total: Math.max(0, Math.round(+r.coins?.total || 0)), u: r.coins?.u === "PP" ? "PP" : "GP" },
    form: { kind: clip(r.form?.kind, 20), text: clip(r.form?.text, 240) || `${fmt(+r.coins?.total || 0)} GP` },
    items: (Array.isArray(r.items) ? r.items : []).slice(0, 8).map(it => ({ k: clip(it?.k, 80), n: clip(it?.n, 80), r: RORDER.includes(it?.r) ? it.r : "uncommon" })).filter(it => it.n),
    flavor: clip(r.flavor, 300), lock: !!r.lock,
  } : null);
  if (rows.some(r => !r)) return null;
  return { id: /^lt-[\w-]{1,40}$/.test(t.id || "") ? t.id : "", title: clip(t.title, 100), intro: clip(t.intro, 500), type, band, die, rows, made: +t.made || Date.now() };
}
L.cur = L.cur ? cleanTable(L.cur) : null;
L.saved = L.saved.map(cleanTable).filter(t => t && t.id).slice(0, 40);
export function restoreLootTables(list) {
  if (!Array.isArray(list)) return 0; let n = 0;
  list.forEach(raw => { const t = cleanTable(raw); if (!t || !t.id || L.saved.some(s => s.id === t.id)) return; L.saved.push(t); n++; });
  if (n) { save(); renderSaved(); }
  return n;
}

// ---------- table actions ----------
function rollTable() {
  const t = L.cur; if (!t) return;
  const n = rnd(t.die);
  document.querySelectorAll("#lt-rows .lt-row.hit").forEach(el => el.classList.remove("hit"));
  const row = $("lt-row-" + n); if (row) { void row.offsetWidth; row.classList.add("hit"); row.scrollIntoView({ block: "nearest", behavior: smooth() }); }
  const r = t.rows[n - 1];
  logEntry($("lt-log"), `<span class="tot">${n}</span><span>${esc(r.form.text)}${r.items.length ? " + " + esc(r.items.map(i => i.n).join(", ")) : ""}</span><span class="how">d${t.die}</span>`);
}
function rerollRows(which) {
  const t = L.cur; if (!t) return;
  return getItems().then(() => {
    const by = pool();
    t.rows = t.rows.map((r, i) => (which == null ? !r.lock : i === which) ? makeRow(t.type, t.band, by) : r);
    save(); render();
  });
}
function markdown(t) {
  const B = BANDS[t.band];
  const out = [`## ${t.title || `${t.type === "hoard" ? "Treasure Hoard" : "Individual Treasure"}, ${B.label}`}`, ""];
  if (t.intro) out.push(`*${t.intro}*`, "");
  out.push(`| d${t.die} | Treasure | Value |`, "|---|---|---|");
  t.rows.forEach((r, i) => {
    const parts = [r.form.text, ...(r.flavor ? [`*${r.flavor}*`] : []), ...(r.items.length ? [r.items.map(it => `**${it.n}** (${RLABEL[it.r]})`).join(", ")] : [])];
    out.push(`| ${i + 1} | ${parts.join("<br>").replace(/\|/g, "/")} | ≈ ${fmt(rowValue(r))} GP |`);
  });
  out.push("", `*${t.type === "hoard" ? "Hoard" : "Individual"} treasure for ${B.label}, using the 2024 DMG treasure tables and SRD 5.2 items (CC BY 4.0).*`);
  return out.join("\n");
}
let delArm = null;
function saveTable() {
  const t = L.cur; if (!t) return;
  if (!t.id) t.id = "lt-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (!t.title) t.title = `${t.type === "hoard" ? "Hoard" : "Individual"} ${BANDS[t.band].label} d${t.die}`;
  const copy = JSON.parse(JSON.stringify(t));
  const i = L.saved.findIndex(s => s.id === t.id);
  if (i >= 0) L.saved[i] = copy; else L.saved.unshift(copy);
  L.saved = L.saved.slice(0, 40);
  if (!save()) { $("lt-status").textContent = "Couldn't save: browser storage is full."; return; }
  render(); $("lt-status").textContent = i >= 0 ? "Saved changes." : "Saved.";
}

// ---------- theme with Claude (keeps every row's rarities and values) ----------
let thCtl = null;
async function theme() {
  const t = L.cur, st = $("lt-theme-status");
  if (!t || thCtl) { if (!t) { st.textContent = "Generate a table first."; st.classList.add("err"); } return; }
  const ask = $("lt-theme").value.trim();
  if (!ask) { st.textContent = "Describe the theme first."; st.classList.add("err"); $("lt-theme").focus(); return; }
  if (!claude.sample) { st.textContent = "Claude isn't available in this view. Open the forge on claude.ai to theme tables."; st.classList.add("err"); return; }
  st.classList.remove("err");
  await getItems();
  const by = pool();
  const used = [...new Set(t.rows.flatMap(r => r.items.map(i => i.r)))];
  const cands = {}; used.forEach(r => { const list = by[r].length ? by[r] : items.list.filter(x => x.m && x.r === r); cands[r] = list.slice().sort(() => Math.random() - .5).slice(0, 80).map(x => ({ k: x.k, n: x.n })); });
  const S2 = S;
  const camp = campaignContext($("lt-camp").checked, 3000);
  const rowsBrief = t.rows.map((r, i) => ({ row: i + 1, value_gp: r.coins.total * (r.coins.u === "PP" ? 10 : 1), form: r.form.kind, items: r.items.map(it => it.r) }));
  const prompt = `You are themeing a Dungeons & Dragons 2024 treasure table for a ${S2?.name || "fantasy"} campaign.

Theme: ${ask}
${camp ? `\nCampaign context to borrow names, places and flavor from (use lightly):\n"""\n${camp}\n"""\n` : ""}
The table (each row: total monetary value in GP, the form it takes, and the rarity of each magic item slot):
${JSON.stringify(rowsBrief)}

Candidate magic items by rarity (choose ONLY from these keys, matching each slot's rarity):
${JSON.stringify(cands)}

For every row:
- "treasure": describe the monetary treasure in the theme in under 25 words, in the row's form (coins, gemstones, trade bars, trade goods or art objects), and end with its exact value in GP, e.g. "...worth 2,400 GP".
- "flavor": optional, one short sentence about where or how it is found; empty string if not needed.
- "items": one key per slot, in the same order and rarity as that row's slots, picking items that fit the theme. Repeats across rows are fine.

Reply with ONLY JSON: {"title":"short evocative table name","intro":"one sentence the GM can read aloud","rows":[{"row":1,"treasure":"...","flavor":"...","items":["key"]}]}`;
  thCtl = new AbortController();
  $("lt-theme-go").disabled = true; $("lt-theme-stop").hidden = false;
  st.textContent = "Claude is themeing the table… this takes about a minute.";
  try {
    let raw;
    if (typeof claude.sample.json === "function") {
      try { raw = await claude.sample.json(prompt, { signal: thCtl.signal, cache: false }); }
      catch (e) { if (e.code === "invalid_json" && e.text) raw = JSON.parse((e.text.match(/\{[\s\S]*\}/) || ["null"])[0]); else throw e; }
    } else {
      const { text } = await claude.sample(prompt, { signal: thCtl.signal, cache: false });
      raw = JSON.parse((text.match(/\{[\s\S]*\}/) || ["null"])[0]);
    }
    if (!raw || !Array.isArray(raw.rows)) throw { code: "bad_table" };
    if (L.cur !== t) return; // the table changed while Claude worked
    let swapped = 0;
    raw.rows.forEach(rr => {
      const r = t.rows[(+rr?.row || 0) - 1]; if (!r) return;
      const tx = typeof rr.treasure === "string" ? rr.treasure.trim().slice(0, 240) : "";
      if (tx) r.form.text = tx;
      r.flavor = typeof rr.flavor === "string" ? rr.flavor.trim().slice(0, 300) : "";
      (Array.isArray(rr.items) ? rr.items : []).forEach((k, i) => {
        const slot = r.items[i]; if (!slot) return;
        const hit = (cands[slot.r] || []).find(c => c.k === k) && items.byKey[k];
        if (hit && hit.r === slot.r) { if (slot.k !== k) swapped++; r.items[i] = { k, n: hit.n, r: slot.r }; }
      });
    });
    if (typeof raw.title === "string" && raw.title.trim()) t.title = raw.title.trim().slice(0, 100);
    if (typeof raw.intro === "string") t.intro = raw.intro.trim().slice(0, 500);
    save(); render();
    st.textContent = `Themed. ${swapped} item${swapped === 1 ? "" : "s"} swapped for better fits; rarities and values unchanged.`;
  } catch (e) {
    const msg = claudeErrorMessage(e, { bad_table: "Claude's reply didn't contain a usable table. Try again.", syntax: "Claude's reply didn't contain a usable table. Try again." });
    st.textContent = msg; st.classList.toggle("err", e?.code !== "cancelled");
  } finally { thCtl = null; $("lt-theme-go").disabled = false; $("lt-theme-stop").hidden = true; }
}

const bandFor = cr => cr <= 4 ? 0 : cr <= 10 ? 1 : cr <= 16 ? 2 : 3;
// What the Encounters tab uses: treasure by challenge rating, and opening a table.
export const lootAPI = {
  bandFor, RLABEL, RVALUE,
  // One creature's Random Individual Treasure for its CR.
  individual: cr => { const c = BANDS[bandFor(cr)].ind; return { expr: `${c.n}d${c.s}${c.x > 1 ? ` × ${fmt(c.x)}` : ""}`, total: sum(c.n, c.s) * c.x, u: c.u }; },
  // A Random Treasure Hoard for a CR, drawing magic items from the Loot tab's item choices.
  hoard: cr => getItems().then(() => makeRow("hoard", bandFor(cr), pool())),
  // Items to offer Claude for each rarity, from the same choices.
  candidates: rarities => getItems().then(() => { const by = pool(), out = {}; rarities.forEach(r => { const list = by[r]?.length ? by[r] : items.list.filter(x => x.m && x.r === r); out[r] = list.slice().sort(() => Math.random() - .5).slice(0, 60).map(x => ({ k: x.k, n: x.n })); }); return { cands: out, byKey: items.byKey }; }),
  rollFor: ({ band, type, title }) => {
    Object.assign(L, { band: [0, 1, 2, 3].includes(band) ? band : 0, type: type === "individual" ? "individual" : "hoard" });
    L.cur = null; showView("loot");
    generate().then(() => { if (L.cur && title) { L.cur.title = String(title).slice(0, 100); save(); render(); } renderControls(); });
  },
};
export function openLoot() { renderControls(); render(); renderSaved(); getItems().catch(() => {}); }

export function initLoot() {
  // ---------- wiring ----------
  const seg = (id, attr, key, num) => $(id).addEventListener("click", e => { const b = e.target.closest(`[data-${attr}]`); if (!b) return; L[key] = num ? +b.dataset[attr] : b.dataset[attr]; save(); renderControls(); });
  seg("lt-type", "type", "type", false); seg("lt-band", "band", "band", true); seg("lt-die", "die", "die", true);
  ["arms", "wond", "cons", "impl", "mine"].forEach(k => $("lt-p-" + k).addEventListener("change", e => { L.pools[k] = e.target.checked; save(); }));
  $("lt-form").addEventListener("submit", e => { e.preventDefault(); generate(); });
  $("lt-roll").addEventListener("click", rollTable);
  $("lt-reroll").addEventListener("click", () => rerollRows(null));
  $("lt-save").addEventListener("click", saveTable);
  $("lt-copy").addEventListener("click", () => {
    const t = L.cur; if (!t) return;
    copyMarkdown(markdown(t), $("lt-card"), $("lt-status"), "table");
  });
  $("lt-card").addEventListener("click", e => {
    const it = e.target.closest("[data-lk]"); if (it) { if (items?.byKey[it.dataset.lk]) itemsAPI.open(it.dataset.lk); else $("lt-status").textContent = "That item isn't in your Items any more."; return; }
    const act = e.target.closest("[data-act]"); if (!act) return;
    const i = +act.closest("[data-row]").dataset.row, r = L.cur.rows[i];
    if (act.dataset.act === "lock") { r.lock = !r.lock; save(); render(); }
    else if (act.dataset.act === "reroll") rerollRows(i);
  });
  $("lt-theme-go").addEventListener("click", theme);
  $("lt-theme-stop").addEventListener("click", () => thCtl?.abort());
  $("lt-saved").addEventListener("click", e => {
    const li = e.target.closest("[data-sid]"), act = e.target.closest("[data-sact]")?.dataset.sact; if (!li || !act) return;
    const id = li.dataset.sid, s = L.saved.find(x => x.id === id); if (!s) return;
    if (act === "open") { delArm = null; L.cur = JSON.parse(JSON.stringify(s)); Object.assign(L, { type: s.type, band: s.band, die: s.die }); save(); renderControls(); render(); $("lt-log").innerHTML = ""; $("lt-status").textContent = ""; }
    else if (act === "del") { delArm = id; renderSaved(); }
    else if (act === "delok") { delArm = null; L.saved = L.saved.filter(x => x.id !== id); if (L.cur?.id === id) L.cur.id = ""; save(); render(); renderSaved(); $("lt-status").textContent = `Deleted ${s.title || "the table"}.`; }
  });
  renderControls();
}
