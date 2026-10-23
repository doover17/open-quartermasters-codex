// Items: SRD 5.2 magic items and equipment (built from the open-source Open5e
// API, published beside this page as items.json), plus Claude-made variants.
import { $, esc, smooth, narrow } from "../../shared/dom.js";
import { cap, newId } from "../../shared/format.js";
import { textMax } from "../../shared/sanitize.js";
import { RULES } from "../../data/index.js";
import { store, state, lstate, S, save } from "../../app/state.js";
import { claude, claudeJson, claudeErrorMessage } from "../../shared/claude.js";
import { showView } from "../../app/shell.js";
import { fetchJson, opt, campaignContext, copyMarkdown, leaveGuard, mdWithDice, logSimpleRoll } from "./common.js";
import { spellsAPI } from "./spells.js";

const I = store.items = Object.assign({ q: "", kind: "all", cat: "", rar: "", att: "", sort: "name", sel: "", custom: [] }, typeof store.items === "object" && store.items ? store.items : {});
if (!Array.isArray(I.custom)) I.custom = [];
const RARITIES = RULES.items.rarities;
const RLABEL = RULES.items.rarityLabels;
// 2024 Dungeon Master's Guide guidelines by rarity.
const VALUE = RULES.items.value;
const TIER = RULES.items.tier;
const CATS = RULES.items.categories;
const rank = r => r ? (RARITIES.indexOf(r) + 1 || 3.5) : 0;

let D = null, byKey = {}, loading = null;
let cur = null, draft = null, mkCtl = null;

// ---------- validate variants that came from Claude or a backup ----------
function normItem(r, base) {
  if (!r || typeof r !== "object") return null;
  const n = textMax(r.n || r.name, 80); if (!n) return null;
  const d = textMax(r.d || r.desc, 4000); if (!d) return null;
  const cat = CATS[r.cat] ? r.cat : (base?.cat || "wondrous-item");
  const rr = String(r.r || "").toLowerCase().replace(/\s+/g, "-");
  const out = {
    k: /^mine-[\w-]{1,60}$/.test(r.k || "") ? r.k : "", n, m: 1, cat,
    r: RARITIES.includes(rr) ? rr : (base?.r && RARITIES.includes(base.r) ? base.r : "uncommon"),
    at: !!r.at, atr: textMax(r.atr, 80), d, base_txt: textMax(r.base_txt, 120), cost: textMax(r.cost, 30), wt: textMax(r.wt, 20),
    base: textMax(r.base || base?.k, 80), baseName: textMax(r.baseName || base?.n, 80), notes: textMax(r.notes, 600),
    custom: true, made: Number.isFinite(+r.made) ? +r.made : Date.now(),
  };
  // keep the base weapon/armor numbers when the variant didn't restate them
  const w = r.w && typeof r.w === "object" ? r.w : base?.w, a = r.a && typeof r.a === "object" ? r.a : base?.a;
  if (w) out.w = { dmg: textMax(w.dmg, 20), dt: textMax(w.dt, 20).toLowerCase(), simple: !!w.simple, ranged: !!w.ranged, props: (Array.isArray(w.props) ? w.props : []).map(p => textMax(p, 60)).filter(Boolean).slice(0, 8), mastery: textMax(w.mastery, 20) };
  if (a) out.a = { ac: textMax(String(a.ac ?? ""), 40), kind: textMax(a.kind, 10), str: Math.max(0, Math.min(30, Math.round(+a.str || 0))), stealth: !!a.stealth };
  return out;
}
I.custom = I.custom.map(c => normItem(c)).filter(x => x && x.k).slice(0, 300);
function indexCustom() { Object.keys(byKey).forEach(k => { if (k.startsWith("mine-")) delete byKey[k]; }); I.custom.forEach(x => { byKey[x.k] = x; x._s = (x.n + " " + (CATS[x.cat] || "") + " " + (x.baseName || "")).toLowerCase(); }); }
export function restoreItems(list) {
  if (!Array.isArray(list)) return 0; let n = 0;
  list.forEach(raw => { const x = normItem(raw); if (!x || !x.k || I.custom.some(c => c.k === x.k)) return; I.custom.push(x); n++; });
  if (n) { save(); indexCustom(); renderList(); }
  return n;
}

function load() {
  if (D) return Promise.resolve(D);
  if (loading) return loading;
  loading = fetchJson("items.json").then(j => {
    D = j.items; D.forEach(x => { byKey[x.k] = x; x._s = (x.n + " " + (CATS[x.cat] || "") + " " + (x.base_txt || "")).toLowerCase(); });
    indexCustom(); buildFilters(); return D;
  }).catch(err => { loading = null; $("it-count").textContent = "The item list didn't load. Check your connection, then open this tab again."; throw err; });
  return loading;
}
function buildFilters() {
  const cats = Object.keys(CATS).filter(c => D.some(x => x.cat === c));
  $("it-cat").innerHTML = opt("", "Any category", I.cat) + cats.map(c => opt(c, CATS[c], I.cat)).join("");
  $("it-rar").innerHTML = opt("", "Any rarity", I.rar) + RARITIES.map(r => opt(r, RLABEL[r], I.rar)).join("");
  $("it-att").value = I.att; $("it-sort").value = I.sort; $("it-q").value = I.q;
}

function results() {
  const q = I.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pool = I.kind === "mine" ? I.custom : [...I.custom, ...D];
  const list = pool.filter(x => (I.kind !== "magic" || x.m) && (I.kind !== "gear" || !x.m) && (!I.cat || x.cat === I.cat) && (!I.rar || x.r === I.rar)
    && (!I.att || (I.att === "yes") === !!x.at) && q.every(w => x._s.includes(w)));
  const nm = x => x.n.replace(/^\+\d\s*/, "").toLowerCase();
  if (I.sort === "rarity") list.sort((a, b) => rank(a.r) - rank(b.r) || nm(a).localeCompare(nm(b)));
  else if (q.length) { const w = q.join(" "); list.sort((a, b) => (nm(b).startsWith(w) - nm(a).startsWith(w)) || nm(a).localeCompare(nm(b))); }
  else list.sort((a, b) => (!!b.custom - !!a.custom) || nm(a).localeCompare(nm(b)) || a.n.localeCompare(b.n));
  return list;
}
function renderList() {
  if (!D) return;
  const list = results();
  const total = I.kind === "mine" ? I.custom.length : D.length + I.custom.length;
  $("it-count").innerHTML = I.kind === "mine" ? `<b>${list.length}</b> of your ${total} item${total === 1 ? "" : "s"}` : `<b>${list.length}</b> of ${total} items`;
  $("it-list").innerHTML = list.length ? list.slice(0, 400).map(x => `<li><button type="button" data-ik="${esc(x.k)}"${x.k === I.sel ? ' aria-current="true"' : ""}${x.r ? ` data-r="${esc(x.r)}"` : ""}>
    <span class="rar${x.m ? "" : " gear"}">${x.m ? esc(RLABEL[x.r] || "Magic") : esc(x.cost || "Gear")}</span>
    <span class="nm"><b>${esc(x.n)}${x.custom ? '<span class="mine">Yours</span>' : ""}</b><span>${esc(CATS[x.cat] || x.cat)}${x.base_txt && x.base_txt !== x.n ? ` · ${esc(x.base_txt)}` : ""}${x.at ? " · attunement" : ""}${x.custom && x.baseName ? ` · from ${esc(x.baseName)}` : ""}</span></span></button></li>`).join("")
    : `<li class="none">${I.kind === "mine" && !I.custom.length ? "You haven't saved any item variants yet. Open an item and press Make a variant with Claude." : "No items match. Loosen a filter or try a shorter search."}</li>`;
  document.querySelectorAll("#it-kind [data-kind]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kind === I.kind)));
}
// Magic items named in the current campaign or location write-up.
function renderNamed() {
  if (!D) return;
  const text = [state?.output, lstate?.output].filter(Boolean).join("\n");
  const hits = !text ? [] : D.filter(x => x.m && x.n.length > 4 && !/^\+\d/.test(x.n) && new RegExp(`\\b${x.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "i").test(text)).slice(0, 24);
  $("it-named").hidden = !hits.length;
  $("it-named-chips").innerHTML = hits.map(x => `<button type="button" data-ik="${x.k}">${esc(x.n)}</button>`).join("");
}

// ---------- the item card ----------
function renderDesc(md) { return mdWithDice(md, { breaks: false }); }
function subtitle(x) {
  let s = CATS[x.cat] || cap(x.cat);
  if (x.base_txt && x.base_txt !== x.n && x.m) s += ` (${x.base_txt})`;
  if (x.m) s += `, ${RLABEL[x.r] || "Rarity Varies"}`;
  if (x.at) s += ` (Requires Attunement${x.atr ? " " + x.atr : ""})`;
  return s;
}
function card(x) {
  const line = (k, v) => v ? `<p class="sbline"><b>${k}</b> ${esc(v)}</p>` : "";
  const rows = [];
  if (x.w) {
    rows.push(line("Damage", `${x.w.dmg} ${cap(x.w.dt)}`));
    rows.push(line("Weapon", `${x.w.simple ? "Simple" : "Martial"} ${x.w.ranged ? "Ranged" : "Melee"}`));
    rows.push(line("Properties", x.w.props.join(", ")));
    rows.push(line("Mastery", x.w.mastery));
  }
  if (x.a) {
    rows.push(line("Armor Class", x.a.kind === "shield" ? "+2" : x.a.ac));
    rows.push(line("Armor", x.a.kind === "shield" ? "Shield" : `${cap(x.a.kind)} Armor`));
    if (x.a.str) rows.push(line("Strength", `${x.a.str} required`));
    if (x.a.stealth) rows.push(line("Stealth", "Disadvantage"));
  }
  if (x.cost) rows.push(line("Cost", x.cost)); else if (x.m && VALUE[x.r]) rows.push(`<p class="sbline"><b>Value</b> ${VALUE[x.r]} <span class="note">(2024 DMG guideline for ${RLABEL[x.r].toLowerCase()} items; suits characters of level ${TIER[x.r]}+)</span></p>`);
  if (x.wt) rows.push(line("Weight", x.wt));
  if (x.bases?.length > 1) rows.push(line("Available as", x.bases.join(", ")));
  const desc = x.d ? `<div class="idesc">${spellsAPI.linkify(renderDesc(x.d), x.d)}</div>` : `<p class="gearnote">Standard equipment with no special rules beyond the numbers above.</p>`;
  return `<header><h3>${esc(x.n)}</h3><p class="sbsub">${esc(subtitle(x))}</p></header>
    ${rows.length ? `<hr class="sbrule">${rows.join("")}` : ""}
    <hr class="sbrule">${desc}`;
}
function show(x, scroll) {
  cur = x;
  const el = $("it-card");
  if (x.r) el.dataset.r = x.r; else delete el.dataset.r;
  el.innerHTML = card(x); el.scrollTop = 0;
  $("it-tools").hidden = false; $("it-log").innerHTML = ""; $("it-status").textContent = "";
  const isVar = !!x.custom;
  $("it-variant").hidden = !isVar;
  if (isVar) {
    const saved = !!(x.k && I.custom.some(c => c.k === x.k));
    $("it-v-badge").textContent = saved ? "Yours" : "Unsaved variant";
    $("it-v-of").textContent = x.baseName ? `Variant of ${x.baseName}` : "Made with Claude";
    $("it-v-note").textContent = x.notes || ""; $("it-v-note").hidden = !x.notes;
    $("it-v-save").hidden = saved; $("it-v-revise").hidden = false;
    $("it-v-orig").hidden = !(x.base && byKey[x.base] && !byKey[x.base].custom);
    $("it-v-del").hidden = !saved; $("it-v-delok").hidden = $("it-v-delno").hidden = true;
  }
  $("it-mk-title").textContent = isVar ? `Revise ${x.n}` : `Make a variant of ${x.n}`;
  fillRar(x);
  if (scroll && narrow()) $("it-out").scrollIntoView({ behavior: smooth(), block: "start" });
}
function open(k, scroll) {
  const x = byKey[k]; if (!x || mkCtl) return;
  draft = null; I.sel = k; save();
  document.querySelectorAll("#it-list [data-ik]").forEach(b => b.dataset.ik === k ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"));
  show(x, scroll);
}

// ---------- variants with Claude ----------
const PRESETS = () => {
  const sj = store.setting === "spelljammer";
  return [
    [sj ? "Wildspace" : "Regional", sj ? "A wildspace version: built for spelljamming ships, vacuum, and the Astral Sea." : "A regional version shaped by a specific land or culture, with one new property that fits it."],
    ["Cursed", "A cursed version that looks like the original until attuned or used, with a curse that makes a good story rather than just a penalty."],
    ["Sentient", "A sentient version with its own personality, goal, senses and way of communicating, plus what happens when it conflicts with its wielder."],
    ["Lesser", "A weaker, cheaper version one rarity lower that a low-level party could find."],
    ["Greater", "A more powerful version one rarity higher, with an extra property or charges."],
    ["Consumable", "A single-use or few-charges consumable version: a potion, scroll, oil, ammunition or talisman."],
  ];
};
function fillRar(x) {
  const sel = $("it-mk-rar"), keep = sel.dataset.for === x.k ? sel.value : "";
  sel.innerHTML = `<option value="">${x.m && x.r && RLABEL[x.r] ? `Keep ${RLABEL[x.r]}` : "Claude decides"}</option>` + RARITIES.slice(0, 5).map(r => `<option value="${r}">${RLABEL[r]}</option>`).join("");
  sel.value = keep; sel.dataset.for = x.k;
}
const forPrompt = x => { const { _s, made, custom, k, ...rest } = x; return JSON.stringify(rest); };
function makePrompt(x, ask, rar, revise) {
  const S2 = S;
  const camp = campaignContext($("it-mk-camp").checked, 3500);
  const target = rar || (x.m && RARITIES.includes(x.r) ? x.r : "");
  return `You are a Dungeons & Dragons 2024 (5.5e) magic item designer. ${revise ? "Revise this homebrew magic item" : "Create a new homebrew magic item as a variant of this item"} for a ${S2?.name || "fantasy"} campaign.

${revise ? "Current item" : "Source item"} (compact JSON; "d" is the rules text in Markdown):
${forPrompt(x)}

The request: ${ask}
Target rarity: ${target ? RLABEL[target] : "choose the rarity that fits the power level"}.
${camp ? `\nCampaign context to borrow names, places and flavor from (use lightly; don't contradict it):\n"""\n${camp}\n"""\n` : ""}
Design rules (2024 Dungeon Master's Guide conventions):
- Give it a new, evocative name unless the request says otherwise. Keep what still makes sense from the source.
- Match power to rarity. Bonuses to attack and damage rolls or AC: +1 Uncommon, +2 Rare, +3 Very Rare. Spells an item casts: up to level 1 for Common, 3 for Uncommon, 6 for Rare, 8 for Very Rare, 9 for Legendary.
- When the item forces a save, use a fixed DC that fits the rarity (about 13 Uncommon, 15 Rare, 17 Very Rare, 19 Legendary) or "your spell save DC" when attuned by a spellcaster.
- Charges: state the maximum, how many regain and when (e.g. "regains 1d6 + 1 expended charges daily at dawn"), and what happens on the last charge if it matters.
- Require attunement when the item grants ongoing power, spells, or a significant bonus. "atr" is an optional restriction like "by a Wizard" or "by a Cleric or Paladin".
- Write the rules text in 2024 style, second person ("you"), with game terms capitalized (Bonus Action, Advantage, Frightened, Fire damage). Use Markdown: short paragraphs, and bold-italic property names like "***Starfall.*** ..." when it has several properties. Dice as "2d6". Tables only if needed.
- If the source is a weapon or armor, keep its weapon ("w") or armor ("a") stats unless the request changes them, and name what it's built on in "base_txt" (e.g. "Longsword", "any sword", "any armor").

Reply with ONLY a JSON object in exactly this shape:
{"n":"name","cat":"wondrous-item|weapon|armor|ring|potion|wand|staff|rod|scroll|ammunition","r":"common|uncommon|rare|very-rare|legendary","at":true,"atr":"","base_txt":"","d":"rules text in Markdown","notes":"2 or 3 sentences for the GM: what changed from the source, and a hook or where the party might find it."}`;
}
async function make() {
  if (mkCtl || !cur) return;
  const base = cur, revise = !!base.custom;
  const ask = $("it-mk-text").value.trim(), st = $("it-mk-status");
  if (!ask) { st.textContent = "Describe the variant first, or tap one of the ideas above."; st.classList.add("err"); $("it-mk-text").focus(); return; }
  if (!claude.sample) { st.textContent = "Claude isn't available in this view. Open the forge on claude.ai to make variants."; st.classList.add("err"); return; }
  st.classList.remove("err");
  mkCtl = new AbortController();
  $("it-mk-go").disabled = true; $("it-mk-stop").hidden = false; $("it-v-revise").disabled = true;
  st.textContent = revise ? "Claude is revising the item… this takes about a minute." : `Claude is reworking the ${base.n}… this takes about a minute.`;
  try {
    const prompt = makePrompt(base, ask, $("it-mk-rar").value, revise);
    const raw = await claudeJson(prompt, { signal: mkCtl.signal, cache: false, modelTier: "complex" });
    const origin = base.custom ? (byKey[base.base] || { k: base.base, n: base.baseName }) : base;
    const geared = origin.w || origin.a ? origin : base;
    const x = normItem({ ...raw, k: base.custom && base.k ? base.k : "", base: origin.k, baseName: origin.n || base.baseName, w: raw?.w || geared.w, a: raw?.a || geared.a }, base);
    if (!x) throw { code: "bad_item" };
    x._s = (x.n + " " + (CATS[x.cat] || "") + " " + (x.baseName || "")).toLowerCase();
    draft = x;
    if (x.k && I.custom.some(c => c.k === x.k)) { x.k = ""; x.reviseOf = base.k; }
    else if (base.reviseOf) x.reviseOf = base.reviseOf;
    show(x, true);
    st.textContent = ""; $("it-mk-text").value = "";
    $("it-make").hidden = true; $("it-make-open").setAttribute("aria-expanded", "false");
    $("it-status").textContent = "Done. Save it to keep it, or press Revise to change it.";
  } catch (e) {
    const msg = claudeErrorMessage(e, { bad_item: "Claude's reply didn't contain a usable item. Try again.", syntax: "Claude's reply didn't contain a usable item. Try again." });
    st.textContent = msg; st.classList.toggle("err", e?.code !== "cancelled");
  } finally {
    mkCtl = null; $("it-mk-go").disabled = false; $("it-mk-stop").hidden = true; $("it-v-revise").disabled = false;
  }
}
function saveVariant() {
  const x = cur; if (!x?.custom) return;
  if (x.reviseOf) { const i = I.custom.findIndex(c => c.k === x.reviseOf); x.k = x.reviseOf; delete x.reviseOf; if (i >= 0) I.custom[i] = x; else I.custom.unshift(x); }
  else { x.k = newId("mine-"); I.custom.unshift(x); }
  x.made = Date.now(); byKey[x.k] = x; draft = null; I.sel = x.k;
  if (!save()) { $("it-status").textContent = "Couldn't save: browser storage is full."; return; }
  renderList(); show(x, false); $("it-status").textContent = "Saved to your items.";
}
function deleteVariant() {
  const x = cur; if (!x?.custom || !x.k) return;
  I.custom = I.custom.filter(c => c.k !== x.k); delete byKey[x.k];
  save(); renderList();
  if (x.base && byKey[x.base]) open(x.base, false);
  else { cur = null; I.sel = ""; save(); ["it-variant", "it-tools", "it-make"].forEach(id => { $(id).hidden = true; }); delete $("it-card").dataset.r; $("it-card").innerHTML = `<div class="best-empty">Deleted. Pick an item from the list to open it.</div>`; }
  $("it-status").textContent = `Deleted ${x.n}.`;
}

// ---- dice ----
function logRoll(btn) { logSimpleRoll($("it-log"), btn, cur?.n || "Roll"); }
function markdown(x) {
  const out = [`## ${x.n}`, `*${subtitle(x)}*`, ""];
  if (x.w) out.push(`**Damage** ${x.w.dmg} ${cap(x.w.dt)} · **Properties** ${x.w.props.join(", ") || "None"}${x.w.mastery ? ` · **Mastery** ${x.w.mastery}` : ""}`);
  if (x.a) out.push(`**Armor Class** ${x.a.kind === "shield" ? "+2" : x.a.ac}${x.a.str ? ` · **Strength** ${x.a.str}` : ""}${x.a.stealth ? " · **Stealth** Disadvantage" : ""}`);
  const extra = [x.cost && `**Cost** ${x.cost}`, x.wt && `**Weight** ${x.wt}`].filter(Boolean).join(" · "); if (extra) out.push(extra);
  if (x.w || x.a || extra) out.push("");
  if (x.d) out.push(x.d, "");
  out.push(x.custom ? `*Homebrew variant${x.baseName ? ` of ${x.baseName}` : ""} (based on SRD 5.2, CC BY 4.0)*` : "*SRD 5.2, CC BY 4.0*");
  return out.join("\n");
}

// What the Loot and Encounters tabs use: the item list and opening an item.
export const itemsAPI = {
  data: () => load().then(() => ({ list: [...I.custom, ...D], byKey })),
  open: k => { showView("items"); load().then(() => { if (byKey[k]) { draft = null; open(k, true); } }); },
};
const relink = () => { if (!cur) return; const el = $("it-card"), top = el.scrollTop, html = card(cur); if (el.innerHTML !== html) { el.innerHTML = html; el.scrollTop = top; } };
export function openItems() { load().then(() => { renderNamed(); renderList(); if (!cur && I.sel && byKey[I.sel]) open(I.sel, false); spellsAPI.ready().then(relink).catch(() => {}); }).catch(() => {}); }

// Leaving an unsaved draft: first tap warns, second tap goes.
const confirmLeave = leaveGuard(() => $("it-status"), "items");

export function initItems() {
  // ---- wiring ----
  let qTimer;
  $("it-q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { I.q = e.target.value; save(); renderList(); }, 120); });
  $("it-q").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const f = $("it-list").querySelector("[data-ik]"); if (f) open(f.dataset.ik, true); } });
  [["it-cat", "cat"], ["it-rar", "rar"], ["it-att", "att"], ["it-sort", "sort"]].forEach(([id, k]) => $(id).addEventListener("change", e => { I[k] = e.target.value; save(); renderList(); }));
  $("it-kind").addEventListener("click", e => { const k = e.target.closest("[data-kind]")?.dataset.kind; if (k) { I.kind = k; save(); renderList(); } });
  $("it-reset").addEventListener("click", () => { Object.assign(I, { q: "", kind: "all", cat: "", rar: "", att: "", sort: "name" }); save(); buildFilters(); renderList(); });
  $("view-items").addEventListener("click", e => {
    const ik = e.target.closest("[data-ik]")?.dataset.ik; if (ik) { if (draft && ik !== cur?.k && !confirmLeave()) return; open(ik, true); return; }
    const d = e.target.closest(".dice"); if (d) logRoll(d);
  });
  $("it-copy").addEventListener("click", () => {
    const x = cur; if (!x) return;
    copyMarkdown(markdown(x), $("it-card"), $("it-status"), "item");
  });
  const openPanel = () => { $("it-make").hidden = false; $("it-make-open").setAttribute("aria-expanded", "true"); $("it-mk-chips").innerHTML = PRESETS().map(([l], i) => `<button type="button" data-ip="${i}">${esc(l)}</button>`).join(""); $("it-mk-text").focus(); };
  $("it-make-open").addEventListener("click", () => { if ($("it-make").hidden) openPanel(); else { $("it-make").hidden = true; $("it-make-open").setAttribute("aria-expanded", "false"); } });
  $("it-mk-chips").addEventListener("click", e => {
    const i = e.target.closest("[data-ip]")?.dataset.ip; if (i == null) return;
    const [label, text] = PRESETS()[+i]; $("it-mk-text").value = text;
    const r = cur?.m && RARITIES.includes(cur.r) ? RARITIES.indexOf(cur.r) : -1;
    if (label === "Lesser" && r > 0) $("it-mk-rar").value = RARITIES[r - 1];
    if (label === "Greater" && r >= 0 && r < 4) $("it-mk-rar").value = RARITIES[r + 1];
    $("it-mk-text").focus();
  });
  $("it-mk-go").addEventListener("click", make);
  $("it-mk-text").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); make(); } });
  $("it-mk-stop").addEventListener("click", () => mkCtl?.abort());
  $("it-v-save").addEventListener("click", saveVariant);
  $("it-v-revise").addEventListener("click", () => { openPanel(); $("it-mk-status").textContent = "Describe what to change, then press Make variant."; $("it-mk-status").classList.remove("err"); });
  $("it-v-orig").addEventListener("click", () => { const x = cur; if (x?.base && byKey[x.base]) { if (draft && !confirmLeave()) return; open(x.base, false); } });
  $("it-v-del").addEventListener("click", () => { ["it-v-save", "it-v-revise", "it-v-orig", "it-v-del"].forEach(id => { $(id).hidden = true; }); $("it-v-delok").hidden = $("it-v-delno").hidden = false; $("it-v-delok").focus(); });
  $("it-v-delno").addEventListener("click", () => { if (cur) show(cur, false); });
  $("it-v-delok").addEventListener("click", deleteVariant);
  window.addEventListener("spells-ready", relink);
}
