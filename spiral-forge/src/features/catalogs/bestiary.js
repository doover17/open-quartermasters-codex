// Bestiary: SRD 5.2 monsters (data built from the open-source Open5e API,
// published beside this page as monsters.json) plus Kobold Press books, with
// stat blocks, dice buttons, and reskinning a monster with Claude into a saved
// variant ("Yours").
import { $, esc, logEntry, selectContents, smooth, narrow } from "../../shared/dom.js";
import { rnd, rollDice, rollHow, diceAvg } from "../../shared/dice.js";
import { cap, sgn, mod, pb, crLabel, newId } from "../../shared/format.js";
import { textMax, clampInt } from "../../shared/sanitize.js";
import { RULES, bookOf } from "../../data/index.js";
import { store, state, lstate, S, save } from "../../app/state.js";
import { claude, claudeJson, claudeErrorMessage } from "../../shared/claude.js";
import { showView } from "../../app/shell.js";
import { fetchJson, campaignContext, copyMarkdown, leaveGuard } from "./common.js";
import { spellsAPI } from "./spells.js";
import { encAPI } from "../encounters.js";

const B = store.best = Object.assign({ q: "", crmin: "", crmax: "", type: "", size: "", book: "", sort: "name", src: "all", sel: "", custom: [] }, typeof store.best === "object" && store.best ? store.best : {});
if (!Array.isArray(B.custom)) B.custom = [];
const XP = RULES.monsters.xp;
const CRS = Object.keys(XP).map(Number).sort((a, b) => a - b);
const ABBR = RULES.monsters.abilities;
const SIZES = RULES.monsters.sizes;

let M = null, byKey = {}, loading = null, named = [];
let cur = null;        // the monster object on screen (SRD, saved variant, or unsaved draft)
let draft = null;      // an unsaved Claude variant
let rsCtl = null;

// ---------- custom variants: validate anything that came from Claude or a backup ----------
// Make every "N (XdY + Z)" average agree with its dice.
const fixAverages = t => t.replace(/(\d+) \((\d+d\d+(?:\s*[+\-−]\s*\d+)?)\)/g, (m, n, dice) => { const a = diceAvg(dice); return `${a == null ? n : Math.max(1, a)} (${dice})`; });
function normMon(r, base) {
  if (!r || typeof r !== "object") return null;
  const name = textMax(r.n || r.name, 80); if (!name) return null;
  const sz = SIZES.includes(String(r.sz).toLowerCase()) ? String(r.sz).toLowerCase() : (base?.sz || "medium");
  const ab = Array.from({ length: 6 }, (_, i) => clampInt(r.ab?.[i], 1, 30, base?.ab?.[i] ?? 10));
  const sv = Array.from({ length: 6 }, (_, i) => clampInt(r.sv?.[i], -5, 25, mod(ab[i])));
  const objNum = (o, keys) => { const out = {}; if (o && typeof o === "object") keys.forEach(k => { const n = clampInt(o[k], 0, 1000, 0); if (n) out[k] = n; }); return out; };
  const sp = objNum(r.sp, ["walk", "burrow", "climb", "fly", "swim"]); if (r.sp?.hover) sp.hover = 1;
  const sk = {}; if (r.sk && typeof r.sk === "object") Object.entries(r.sk).slice(0, 18).forEach(([k, v]) => { const key = String(k).toLowerCase().replace(/[^a-z_ ]/g, "").replace(/ /g, "_"); if (key) sk[key] = clampInt(v, -5, 30, 0); });
  const ents = (a, isAct) => (Array.isArray(a) ? a : []).slice(0, 30).map(x => {
    const e = { n: textMax(x?.n || x?.name, 80), d: fixAverages(textMax(x?.d || x?.desc, 1500)) };
    if (!e.n || !e.d) return null;
    if (isAct) {
      e.t = ["a", "b", "r", "l"].includes(x.t) ? x.t : "a";
      const u = textMax(x.u, 60); if (u) e.u = u;
      const c = clampInt(x.c, 1, 3, 1); if (e.t === "l" && c > 1) e.c = c;
      const f = textMax(x.f, 60); if (f) e.f = f;
    }
    return e;
  }).filter(Boolean);
  const cr = nearestCR(r.cr);
  let hd = textMax(r.hd, 30), hp = clampInt(r.hp, 1, 2000, base?.hp || 10);
  const avg = diceAvg(hd); if (avg != null && avg > 0) hp = avg; else if (!/^\d+d\d+/.test(hd)) hd = "";
  return {
    k: /^mine-[\w-]{1,60}$/.test(r.k || "") ? r.k : "", n: name, sz, ty: textMax(r.ty, 40).toLowerCase() || base?.ty || "monstrosity", al: textMax(r.al, 60).toLowerCase() || "unaligned", cat: "Yours",
    ac: clampInt(r.ac, 1, 40, 12), acd: textMax(r.acd, 60), hp, hd, init: clampInt(r.init, -10, 30, mod(ab[1])),
    sp: Object.keys(sp).length ? sp : { walk: 30 }, ab, sv, sk,
    vu: textMax(r.vu, 200), re: textMax(r.re, 300), im: textMax(r.im, 300), ci: textMax(r.ci, 300),
    sn: objNum(r.sn, ["blindsight", "darkvision", "tremorsense", "truesight"]), pp: clampInt(r.pp, 0, 60, 10 + mod(ab[4])),
    tp: clampInt(r.tp, 0, 1000, 0) || null, lg: textMax(r.lg, 200), cr,
    tr: ents(r.tr, false), ac2: ents(r.ac2, true),
    base: textMax(r.base || base?.k, 80), baseName: textMax(r.baseName || base?.n, 80), notes: textMax(r.notes, 600),
    custom: true, made: clampInt(r.made, 0, 9e15, Date.now()),
  };
}
B.custom = B.custom.map(c => normMon(c)).filter(m => m && m.k).slice(0, 200);
export function restoreMonsters(list) {
  if (!Array.isArray(list)) return 0; let n = 0;
  list.forEach(raw => { const m = normMon(raw); if (!m || !m.k || B.custom.some(c => c.k === m.k)) return; B.custom.push(m); n++; });
  if (n) { save(); indexCustom(); renderList(); }
  return n;
}
function indexCustom() { Object.keys(byKey).forEach(k => { if (k.startsWith("mine-")) delete byKey[k]; }); B.custom.forEach(m => { byKey[m.k] = m; m._s = (m.n + " " + m.ty + " " + (m.baseName || "")).toLowerCase(); }); }

function load() {
  if (M) return Promise.resolve(M);
  if (loading) return loading;
  loading = fetchJson("monsters.json").then(d => {
    M = d.monsters; M.forEach(m => { byKey[m.k] = m; m._s = (m.n + " " + m.ty + (m.src ? " " + bookOf(m).name : "")).toLowerCase(); });
    indexCustom(); buildFilters(); return M;
  }).catch(err => {
    loading = null;
    $("best-count").textContent = "The monster list didn't load. Check your connection, then open this tab again.";
    throw err;
  });
  return loading;
}

function buildFilters() {
  const crs = [...new Set(M.map(m => m.cr))].sort((a, b) => a - b);
  const opt = (v, t, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(t)}</option>`;
  $("best-crmin").innerHTML = opt("", "Any", B.crmin) + crs.map(c => opt(c, crLabel(c), B.crmin)).join("");
  $("best-crmax").innerHTML = opt("", "Any", B.crmax) + crs.map(c => opt(c, crLabel(c), B.crmax)).join("");
  const types = [...new Set(M.map(m => m.ty))].sort();
  $("best-type").innerHTML = opt("", "Any type", B.type) + types.map(t => opt(t, cap(t), B.type)).join("");
  const sizes = SIZES.filter(s => M.some(m => m.sz === s));
  $("best-size").innerHTML = opt("", "Any size", B.size) + sizes.map(s => opt(s, cap(s), B.size)).join("");
  $("best-q").value = B.q; $("best-book").value = B.book || "";
}

function results() {
  const q = B.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lo = B.crmin === "" ? -1 : +B.crmin, hi = B.crmax === "" ? 99 : +B.crmax;
  const pool = B.src === "mine" ? B.custom : [...B.custom, ...M];
  const bookOk = m => !B.book || (m.custom ? false : B.book === "kobold" ? bookOf(m).by === "Kobold Press" : (m.src || "srd-2024") === B.book);
  const list = pool.filter(m => m.cr >= lo && m.cr <= hi && (!B.type || m.ty === B.type) && (!B.size || m.sz === B.size) && bookOk(m) && q.every(w => m._s.includes(w)));
  if (B.sort === "cr") list.sort((a, b) => a.cr - b.cr || a.n.localeCompare(b.n) || !!a.src - !!b.src);
  else if (q.length) { const w = q.join(" "); list.sort((a, b) => (b.n.toLowerCase().startsWith(w) - a.n.toLowerCase().startsWith(w)) || a.n.localeCompare(b.n)); }
  else list.sort((a, b) => (!!b.custom - !!a.custom) || a.n.localeCompare(b.n));
  return list;
}

function renderList() {
  if (!M) return;
  const list = results();
  const total = B.src === "mine" ? B.custom.length : M.length + B.custom.length;
  $("best-count").innerHTML = B.src === "mine" ? `<b>${list.length}</b> of your ${total} variant${total === 1 ? "" : "s"}` : `<b>${list.length}</b> of ${total} monsters`;
  $("best-list").innerHTML = list.length ? list.map(m => `<li><button type="button" data-mk="${esc(m.k)}"${m.k === B.sel ? ' aria-current="true"' : ""}>
    <span class="cr${m.custom ? " mine-cr" : ""}">CR ${crLabel(m.cr)}</span><span class="nm"><b>${esc(m.n)}${m.custom ? '<span class="mine">Yours</span>' : ""}${m.src ? `<span class="book-tag">${esc(bookOf(m).tag)}</span>` : ""}</b><span>${esc(m.sz)} ${esc(m.ty)}${m.custom && m.baseName ? ` · from ${esc(m.baseName)}` : ""}</span></span></button></li>`).join("")
    : `<li class="none">${B.src === "mine" && !B.custom.length ? "You haven't saved any variants yet. Open a monster and press Reskin with Claude." : "No monsters match. Loosen a filter or try a shorter search."}</li>`;
  document.querySelectorAll("#best-sort [data-sort]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sort === B.sort)));
  document.querySelectorAll("#best-src [data-src]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.src === B.src)));
}

// Monsters whose names appear in the current campaign or location write-up.
function renderNamed() {
  if (!M) return;
  const text = [state?.output, lstate?.output].filter(Boolean).join("\n");
  const seen = new Set();
  named = !text ? [] : M.filter(m => { if (seen.has(m.n)) return false; seen.add(m.n); return true; }).filter(m => new RegExp(`\\b${m.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?\\b`, "i").test(text)).slice(0, 30);
  $("best-named").hidden = !named.length;
  $("best-named-chips").innerHTML = named.map(m => `<button type="button" data-mk="${m.k}">${esc(m.n)} <span class="note">CR ${crLabel(m.cr)}</span></button>`).join("");
}

// Wrap attack bonuses, damage dice and recharges in roll buttons.
function diceify(text, who) {
  let h = esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])_([^_\n]+?)_(?=[\s.,:;)]|$)/g, "$1<i>$2</i>").replace(/\s*(?:\n|\s)-\s+(?=<b>)/g, "<br>").replace(/\n+/g, "<br>");
  // Older 5e wording, as in the Kobold Press books: "Melee Weapon Attack: +4 to hit"
  h = h.replace(/(Attack:(?:<\/i>)?\s*)([+\-−]\d+)(\s+to hit)/g, (m, a, b, c) => `${a}<button type="button" class="dice" data-roll="1d20${b.replace("−", "-")}" data-what="${esc(who)}: attack" data-d20="1">${b}</button>${c}`);
  h = h.replace(/(Attack Roll:\s*)([+\-−]\d+)/g, (m, a, b) => `${a}<button type="button" class="dice" data-roll="1d20${b.replace("−", "-")}" data-what="${esc(who)}: attack" data-d20="1">${b}</button>`);
  h = h.replace(/(\d+) \((\d+d\d+(?:\s*[+\-−]\s*\d+)?)\)/g, (m, avg, dice) => `${avg} (<button type="button" class="dice" data-roll="${dice.replace(/\s+/g, "").replace("−", "-")}" data-what="${esc(who)}: damage">${dice}</button>)`);
  return h;
}
function rechargeBtn(label, who) {
  const t = /Recharge (\d)/.exec(label), safe = esc(label);
  if (!t) return safe;
  return safe.replace(/Recharge \d(?:–6)?/, x => `<button type="button" class="dice" data-roll="1d6" data-recharge="${t[1]}" data-what="${esc(who)}: recharge">${x}</button>`);
}

function entry(name, desc, who, extra = "") {
  const body = diceify(desc, who);
  return `<p class="sbentry"><b>${name}.</b>${extra} ${spellsAPI.linkify(body, desc)}</p>`;
}

function block(m) {
  const ab = m.ab.map((s, i) => ({ s, m: mod(s), sv: m.sv[i] ?? mod(s), prof: (m.sv[i] ?? mod(s)) !== mod(s) }));
  const row = i => `<tr><th scope="row">${ABBR[i]}</th><td>${ab[i].s}</td><td>${sgn(ab[i].m)}</td><td class="sv${ab[i].prof ? " prof" : ""}">${sgn(ab[i].sv)}</td></tr>`;
  const tbl = idx => `<table><thead><tr><th></th><th></th><th>Mod</th><th>Save</th></tr></thead><tbody>${idx.map(row).join("")}</tbody></table>`;
  const speed = Object.entries(m.sp).filter(([k]) => k !== "hover").map(([k, v]) => k === "walk" ? `${v} ft.` : `${cap(k)} ${v} ft.${k === "fly" && m.sp.hover ? " (hover)" : ""}`).join(", ");
  const skills = Object.entries(m.sk).map(([k, v]) => `${cap(k.replace(/_/g, " "))} ${sgn(v)}`).join(", ");
  const imm = [m.im, m.ci].filter(Boolean).map(cap).join("; ");
  const senses = [...Object.entries(m.sn).map(([k, v]) => `${cap(k)} ${v} ft.`), `Passive Perception ${m.pp}`].join(", ");
  const lang = [m.lg || "None", m.tp ? `telepathy ${m.tp} ft.` : ""].filter(Boolean).join("; ");
  const line = (k, v) => v ? `<p class="sbline"><b>${k}</b> ${esc(v)}</p>` : "";
  const sect = (title, t, intro = "") => {
    const xs = m.ac2.filter(a => a.t === t); if (!xs.length) return "";
    xs.sort((a, b) => (b.n === "Multiattack") - (a.n === "Multiattack"));
    return `<h4>${title}</h4>${intro}` + xs.map(a => {
      const head = a.u ? `${esc(a.n)} (${rechargeBtn(a.u, a.n)})` : rechargeBtn(a.n, a.n);
      const costs = a.c ? ` <span class="form">(Costs ${a.c} Actions)</span>` : "";
      const form = a.f ? ` <span class="form">(${esc(a.f)})</span>` : "";
      return entry(head, a.d, a.n, costs + form);
    }).join("");
  };
  const lr = m.tr.find(t => /Legendary Resistance/.test(t.n));
  const uses = lr && /in Lair/i.test(lr.n) ? "3 (4 in Lair)" : "3";
  const legIntro = bookOf(m).older ? `<p class="sbintro">The ${esc(m.n.toLowerCase())} can take 3 legendary actions, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. It regains spent legendary actions at the start of its turn.</p>` : `<p class="sbintro">Legendary Action Uses: ${uses}. Immediately after another creature's turn, the ${esc(m.n.toLowerCase())} can expend a use to take one of the following actions. It regains all expended uses at the start of each of its turns.</p>`;
  return `
    <header><h3>${esc(m.n)}</h3><p class="sbsub">${esc(cap(m.sz))} ${esc(cap(m.ty))}, ${esc(cap(m.al))}</p>${m.src ? `<p class="sbsource"><b>${esc(bookOf(m).name)}</b> · ${esc(bookOf(m).by)} · ${esc(bookOf(m).lic)}${bookOf(m).older ? " · older 5e stat block; Initiative is its Dexterity modifier" : " · 2024 rules"}</p>` : ""}</header>
    <hr class="sbrule">
    <div class="sbpair"><p class="sbline"><b>AC</b> ${m.ac}${m.acd ? ` <span class="note">(${esc(m.acd)})</span>` : ""}</p>
      <p class="sbline"><b>Initiative</b> <button type="button" class="dice" data-roll="1d20${m.init >= 0 ? "+" : ""}${m.init}" data-what="${esc(m.n)}: initiative">${sgn(m.init)}</button> (${10 + m.init})</p></div>
    <p class="sbline"><b>HP</b> ${m.hp}${m.hd ? ` (<button type="button" class="dice" data-roll="${esc(m.hd.replace(/\s+/g, ""))}" data-what="${esc(m.n)}: hit points">${esc(m.hd)}</button>)` : ""}</p>
    <p class="sbline"><b>Speed</b> ${esc(speed || "0 ft.")}</p>
    <hr class="sbrule">
    <div class="sbabil">${tbl([0, 3])}${tbl([1, 4])}${tbl([2, 5])}</div>
    <hr class="sbrule">
    ${line("Skills", skills)}${line("Vulnerabilities", cap(m.vu))}${line("Resistances", cap(m.re))}${line("Immunities", imm)}
    ${line("Senses", senses)}${line("Languages", lang)}
    <p class="sbline"><b>CR</b> ${crLabel(m.cr)} <span class="note">(XP ${(XP[m.cr] ?? 0).toLocaleString()}; PB ${sgn(pb(m.cr))})</span></p>
    ${m.tr.length ? `<h4>Traits</h4>` + m.tr.map(t => entry(rechargeBtn(t.n, t.n), t.d, t.n)).join("") : ""}
    ${sect("Actions", "a")}${sect("Bonus Actions", "b")}${sect("Reactions", "r")}${sect("Legendary Actions", "l", legIntro)}
    ${m.src === "home" && m.notes ? `<h4>Designer Notes</h4><p class="sbintro">${esc(m.notes)}</p>` : ""}`;
}

// Put a monster object on screen. Saved/SRD monsters come by key; drafts are passed directly.
function show(m, scroll) {
  cur = m;
  $("best-block").innerHTML = block(m);
  $("best-block").scrollTop = 0;
  $("best-tools").hidden = false;
  $("best-log").innerHTML = ""; $("best-status").textContent = "";
  // variant bar
  const isVar = !!m.custom;
  $("best-variant").hidden = !isVar;
  if (isVar) {
    const saved = !!(m.k && B.custom.some(c => c.k === m.k));
    $("best-v-badge").textContent = saved ? "Yours" : "Unsaved variant";
    $("best-v-of").textContent = m.baseName ? `Reskinned from ${m.baseName}` : "Made with Claude";
    $("best-v-note").textContent = m.notes || "";
    $("best-v-note").hidden = !m.notes;
    $("best-v-save").hidden = saved;
    $("best-v-orig").hidden = !(m.base && byKey[m.base] && !byKey[m.base].custom);
    $("best-v-del").hidden = !saved; $("best-v-delok").hidden = $("best-v-delno").hidden = true; $("best-v-revise").hidden = false;
  }
  $("best-rs-title").textContent = `Reskin ${m.n}`;
  fillCR(m.cr);
  if (scroll && narrow()) $("best-out").scrollIntoView({ behavior: smooth(), block: "start" });
}
function open(k, scroll) {
  const m = byKey[k]; if (!m) return;
  if (draft && rsCtl) return; // don't swap monsters under a running reskin
  draft = null;
  B.sel = k; save();
  document.querySelectorAll("#best-list [data-mk]").forEach(b => b.dataset.mk === k ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"));
  show(m, scroll);
}
// Two-step delete: the Delete button swaps for "Delete for good" / "Keep it".
function setDel(asking) {
  if (!asking) { if (cur) show(cur, false); return; }
  ["best-v-save", "best-v-revise", "best-v-orig", "best-v-del"].forEach(id => { $(id).hidden = true; });
  $("best-v-delok").hidden = $("best-v-delno").hidden = false;
  $("best-v-delok").focus();
}

// ---------- reskin with Claude ----------
const PRESETS = () => {
  const sj = store.setting === "spelljammer";
  return [
    sj ? ["Wildspace", "A wildspace version: adapted to vacuum and the Astral Sea, with a hazard that fits life between the stars."] : ["Regional", "A regional variant shaped by the terrain it lives in, with one new trait and a signature attack that fits that land."],
    ["Undead", "An undead version of this creature: what death took from it, what it gained, and how it hunts now."],
    ["Elite", "An elite leader of its kind: tougher, smarter, with a command or rallying ability that makes its allies dangerous."],
    ["Minion", "A weak minion version meant to appear in groups of four to eight, with simple tactics."],
    ["Boss", "A solo boss version with Legendary Resistance and three Legendary Actions so it can fight a whole party alone."],
    ["Elemental", "An elemental-infused version, picking whichever element suits it best, with matching resistances and a damage type swap."],
    ...(cur && !cur.custom && bookOf(cur).older ? [["2024 rules", "Convert this monster to the 2024 rules with as few design changes as possible: keep its name, CR and abilities, but use 2024 stat block wording (Attack Roll, saving throw Failure and Success lines, conditions and damage types capitalized), add hit dice, and set Initiative."]] : []),
  ];
};
function fillCR(cr) {
  const sel = $("best-rs-cr"), was = sel.dataset.for === String(cur?.k || cur?.n) ? sel.value : "";
  sel.innerHTML = `<option value="">Keep CR ${crLabel(cr)}</option>` + CRS.filter(c => c <= 30).map(c => `<option value="${c}">${crLabel(c)}</option>`).join("");
  sel.value = was; sel.dataset.for = String(cur?.k || cur?.n);
}
function renderPresets() {
  $("best-rs-chips").innerHTML = PRESETS().map(([l, t], i) => `<button type="button" data-rsp="${i}">${esc(l)}</button>`).join("");
}
const forPrompt = m => {
  const { _s, made, custom, ...rest } = m;
  return JSON.stringify(rest);
};
function reskinPrompt(m, ask, targetCR, revise) {
  const S2 = S;
  const camp = campaignContext($("best-rs-camp").checked, 3500);
  const cr = targetCR === "" ? m.cr : Number(targetCR);
  return `You are a Dungeons & Dragons 2024 (5.5e) monster designer. ${revise ? "Revise this homebrew stat block" : "Reskin this monster into a new homebrew variant"} for a ${S2?.name || "fantasy"} campaign.

${revise ? "Current variant" : "Source monster"} (compact JSON):
${forPrompt(m)}

The request: ${ask}
Target challenge rating: ${crLabel(cr)} (proficiency bonus ${sgn(pb(cr))}).
${camp ? `\nCampaign context to borrow names, places and flavor from (use lightly; don't contradict it):\n"""\n${camp}\n"""\n` : ""}
Design rules (2024 Monster Manual conventions):
- Give it a new, evocative name unless the request says otherwise. Keep the parts of the original that still make sense; change what the concept demands.
- Proficiency bonus comes from CR. Weapon attack bonus = PB + Str or Dex modifier. Save DC = 8 + PB + the relevant modifier.
- Save bonuses in "sv" = ability modifier, plus PB where proficient. Skills = modifier + PB (or 2×PB with expertise). Passive Perception = 10 + Perception bonus (or 10 + Wis modifier). Initiative bonus = Dex modifier (plus PB if it should act early).
- Hit dice use the size's die (Tiny d4, Small d6, Medium d8, Large d10, Huge d12, Gargantuan d20) plus Con modifier × number of dice, written like "11d10 + 33". "hp" is that average, rounded down.
- AC, HP and damage per round should sit where official monsters of CR ${crLabel(cr)} sit. A CR change needs real changes to HP, damage, bonuses and DCs.
- Write every damage roll as "N (XdY + Z) Type damage", with N the average rounded down. Write attacks like "Melee Attack Roll: +5, reach 5 ft. 7 (1d8 + 3) Piercing damage." and saves like "Dexterity Saving Throw: DC 14, each creature in a 15-foot Cone. Failure: 21 (6d6) Fire damage. Success: Half damage." Capitalize conditions and damage types as the 2024 rules do.
- Recharge or limited uses go in "u" ("Recharge 5–6", "3/Day"), not in the name. Legendary Actions only if it should have them (then add a Legendary Resistance trait).

Reply with ONLY a JSON object in exactly this shape (same keys as the source):
{"n":"name","sz":"tiny|small|medium|large|huge|gargantuan","ty":"type in lowercase","al":"alignment in lowercase","ac":15,"acd":"armor note or empty","hp":45,"hd":"6d10 + 12","init":2,"sp":{"walk":30,"fly":0,"swim":0,"climb":0,"burrow":0,"hover":0},"ab":[STR,DEX,CON,INT,WIS,CHA],"sv":[6 save bonuses in the same order],"sk":{"perception":4},"vu":"","re":"","im":"damage immunities","ci":"condition immunities","sn":{"darkvision":60},"pp":14,"tp":0,"lg":"Common","cr":${cr},"tr":[{"n":"Trait","d":"text"}],"ac2":[{"n":"Multiattack","d":"text","t":"a"},{"n":"Breath","d":"text","t":"a","u":"Recharge 5–6"},{"n":"Leap","d":"text","t":"b"},{"n":"Parry","d":"text","t":"r"},{"n":"Pounce","d":"text","t":"l","c":1}],"notes":"2 or 3 sentences for the GM: what changed, and how to run it at the table."}
"t" is a for Actions, b for Bonus Actions, r for Reactions, l for Legendary Actions.`;
}
async function reskin(revise) {
  if (rsCtl) return;
  const base = cur;
  if (!base) return;
  const ask = $("best-rs-text").value.trim();
  const st = $("best-rs-status");
  if (!ask) { st.textContent = "Describe the variant first, or tap one of the ideas above."; st.classList.add("err"); $("best-rs-text").focus(); return; }
  if (!claude.sample) { st.textContent = "Claude isn't available in this view. Open the forge on claude.ai to reskin monsters."; st.classList.add("err"); return; }
  st.classList.remove("err");
  rsCtl = new AbortController();
  $("best-rs-go").disabled = true; $("best-rs-stop").hidden = false; $("best-v-revise").disabled = true;
  st.textContent = revise ? "Claude is revising the stat block… this takes about a minute." : `Claude is reskinning the ${base.n.toLowerCase()}… this takes about a minute.`;
  try {
    const prompt = reskinPrompt(base, ask, $("best-rs-cr").value, revise && base.custom);
    const raw = await claudeJson(prompt, { signal: rsCtl.signal, cache: false, modelTier: "complex" });
    const origin = base.custom ? (byKey[base.base] || { k: base.base, n: base.baseName }) : base;
    const m = normMon({ ...raw, k: base.custom && base.k ? base.k : "", base: origin.k, baseName: origin.n || base.baseName }, base);
    if (!m || !m.ac2.length) throw { code: "bad_monster" };
    m._s = (m.n + " " + m.ty + " " + (m.baseName || "")).toLowerCase();
    // Revising a saved variant keeps it a draft until saved again.
    draft = m;
    if (m.k && B.custom.some(c => c.k === m.k)) { m.k = ""; m.reviseOf = base.k; }
    else if (base.reviseOf) m.reviseOf = base.reviseOf;
    show(m, true);
    st.textContent = "";
    $("best-reskin").hidden = true; $("best-reskin-open").setAttribute("aria-expanded", "false");
    $("best-status").textContent = "Done. Save it to keep it, or press Revise to change it.";
    $("best-rs-text").value = "";
  } catch (e) {
    const msg = claudeErrorMessage(e, { bad_monster: "Claude's reply didn't contain a usable stat block. Try again.", syntax: "Claude's reply didn't contain a usable stat block. Try again." });
    st.textContent = msg; st.classList.toggle("err", e?.code !== "cancelled");
  } finally {
    rsCtl = null; $("best-rs-go").disabled = false; $("best-rs-stop").hidden = true; $("best-v-revise").disabled = false;
  }
}
function saveVariant() {
  const m = cur; if (!m?.custom) return;
  if (m.reviseOf) { const i = B.custom.findIndex(c => c.k === m.reviseOf); m.k = m.reviseOf; delete m.reviseOf; if (i >= 0) B.custom[i] = m; else B.custom.unshift(m); }
  else { m.k = newId("mine-"); B.custom.unshift(m); }
  m.made = Date.now();
  byKey[m.k] = m; draft = null; B.sel = m.k;
  if (!save()) { $("best-status").textContent = "Couldn't save: browser storage is full."; return; }
  renderList(); show(m, false);
  $("best-status").textContent = "Saved to your monsters.";
}
function deleteVariant() {
  const m = cur; if (!m?.custom || !m.k) return;
  B.custom = B.custom.filter(c => c.k !== m.k); delete byKey[m.k];
  const back = m.base && byKey[m.base];
  save(); renderList();
  if (back) open(back.k, false);
  else { cur = null; B.sel = ""; save(); $("best-variant").hidden = true; $("best-tools").hidden = true; $("best-reskin").hidden = true; $("best-block").innerHTML = `<div class="best-empty">Deleted. Pick a monster from the list to open its stat block.</div>`; }
  $("best-status").textContent = `Deleted ${m.n}.`;
}

// ---- dice ----
function logRoll(btn) {
  const r = rollDice(btn.dataset.roll); if (!r) return;
  let cls = "", note = "";
  if (btn.dataset.d20 && r.dice[0] === 20) { cls = " crit"; note = " Natural 20: critical hit, roll the damage dice twice."; }
  if (btn.dataset.d20 && r.dice[0] === 1) { cls = " fumble"; note = " Natural 1: automatic miss."; }
  if (btn.dataset.recharge) { const ok = r.dice[0] >= +btn.dataset.recharge; cls = ok ? " crit" : ""; note = ok ? " Recharged." : " Not yet."; }
  const how = rollHow(btn.dataset.roll, r);
  logEntry($("best-log"), `<span class="tot${cls}">${r.total}</span><span>${esc(btn.dataset.what)}${esc(note)}</span><span class="how">${esc(how)}</span>`);
}

function markdown(m) {
  const ab = m.ab.map((s, i) => `| ${ABBR[i]} | ${s} | ${sgn(mod(s))} | ${sgn(m.sv[i] ?? mod(s))} |`).join("\n");
  const out = [`## ${m.n}`, `*${cap(m.sz)} ${cap(m.ty)}, ${cap(m.al)}*`, "",
    `**AC** ${m.ac} · **Initiative** ${sgn(m.init)} (${10 + m.init})`, `**HP** ${m.hp}${m.hd ? ` (${m.hd})` : ""}`,
    `**Speed** ${Object.entries(m.sp).filter(([k]) => k !== "hover").map(([k, v]) => k === "walk" ? `${v} ft.` : `${cap(k)} ${v} ft.`).join(", ")}`, "",
    "| | Score | Mod | Save |", "|---|---|---|---|", ab, ""];
  const sk = Object.entries(m.sk).map(([k, v]) => `${cap(k.replace(/_/g, " "))} ${sgn(v)}`).join(", ");
  if (sk) out.push(`**Skills** ${sk}`);
  if (m.vu) out.push(`**Vulnerabilities** ${cap(m.vu)}`);
  if (m.re) out.push(`**Resistances** ${cap(m.re)}`);
  const imm = [m.im, m.ci].filter(Boolean).map(cap).join("; "); if (imm) out.push(`**Immunities** ${imm}`);
  out.push(`**Senses** ${[...Object.entries(m.sn).map(([k, v]) => `${cap(k)} ${v} ft.`), `Passive Perception ${m.pp}`].join(", ")}`);
  out.push(`**Languages** ${m.lg || "None"}${m.tp ? `; telepathy ${m.tp} ft.` : ""}`);
  out.push(`**CR** ${crLabel(m.cr)} (XP ${(XP[m.cr] ?? 0).toLocaleString()}; PB ${sgn(pb(m.cr))})`);
  if (m.tr.length) out.push("", "### Traits", ...m.tr.map(t => `***${t.n}.*** ${t.d}`));
  [["Actions", "a"], ["Bonus Actions", "b"], ["Reactions", "r"], ["Legendary Actions", "l"]].forEach(([h, t]) => {
    const xs = m.ac2.filter(a => a.t === t).sort((a, b) => (b.n === "Multiattack") - (a.n === "Multiattack")); if (!xs.length) return;
    out.push("", `### ${h}`, ...xs.map(a => `***${a.n}${a.u ? ` (${a.u})` : ""}${a.c ? ` (Costs ${a.c} Actions)` : ""}.*** ${a.d}`));
  });
  out.push("", m.custom ? `*Homebrew variant${m.baseName ? ` of ${m.baseName}` : ""} (based on SRD 5.2, CC BY 4.0)*` : "*SRD 5.2, CC BY 4.0*");
  return out.join("\n");
}

// What the Encounters and Combat tabs use: stat blocks, the monster list, opening a monster.
export const bestiaryAPI = {
  block: m => block(m),
  data: () => load().then(() => ({ list: [...B.custom, ...M], byKey })),
  open: k => { showView("bestiary"); load().then(() => { if (byKey[k]) { draft = null; open(k, true); } }); },
};

const relink = () => { if (!cur) return; const el = $("best-block"), top = el.scrollTop, html = block(cur); if (el.innerHTML !== html) { el.innerHTML = html; el.scrollTop = top; } };
export function openBestiary() {
  load().then(() => { renderNamed(); renderList(); if (!cur && B.sel && byKey[B.sel]) open(B.sel, false); spellsAPI.ready().then(relink).catch(() => {}); }).catch(() => {});
}

// Leaving an unsaved draft: first tap warns, second tap goes.
const confirmLeave = leaveGuard(() => $("best-status"), "monsters");

export function initBestiary() {
  // ---- wiring ----
  let qTimer;
  $("best-q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { B.q = e.target.value; save(); renderList(); }, 120); });
  $("best-q").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const first = $("best-list").querySelector("[data-mk]"); if (first) open(first.dataset.mk, true); } });
  [["best-crmin", "crmin"], ["best-crmax", "crmax"], ["best-type", "type"], ["best-size", "size"]].forEach(([id, k]) =>
    $(id).addEventListener("change", e => { B[k] = e.target.value; save(); renderList(); }));
  $("best-sort").addEventListener("click", e => { const s = e.target.closest("[data-sort]")?.dataset.sort; if (s) { B.sort = s; save(); renderList(); } });
  $("best-src").addEventListener("click", e => { const s = e.target.closest("[data-src]")?.dataset.src; if (s) { B.src = s; save(); renderList(); } });
  $("best-reset").addEventListener("click", () => { Object.assign(B, { q: "", crmin: "", crmax: "", type: "", size: "", book: "", src: "all" }); save(); buildFilters(); renderList(); });
  $("best-book").addEventListener("change", e => { B.book = e.target.value; save(); renderList(); });
  $("view-bestiary").addEventListener("click", e => {
    const mk = e.target.closest("[data-mk]")?.dataset.mk; if (mk) { if (draft && mk !== cur?.k && !confirmLeave()) return; open(mk, true); return; }
    const d = e.target.closest(".dice"); if (d) logRoll(d);
  });
  $("best-hp").addEventListener("click", () => { const m = cur; if (m?.hd) logRoll({ dataset: { roll: m.hd.replace(/\s+/g, ""), what: `${m.n}: hit points` } }); });
  $("best-init").addEventListener("click", () => { const m = cur; if (m) logRoll({ dataset: { roll: `1d20${m.init >= 0 ? "+" : ""}${m.init}`, what: `${m.n}: initiative` } }); });
  $("best-copy").addEventListener("click", () => {
    const m = cur; if (!m) return;
    copyMarkdown(markdown(m), $("best-block"), $("best-status"), "stat block");
  });
  $("best-reskin-open").addEventListener("click", () => {
    const p = $("best-reskin"), show = p.hidden;
    p.hidden = !show; $("best-reskin-open").setAttribute("aria-expanded", String(show));
    if (show) { renderPresets(); $("best-rs-text").focus(); }
  });
  $("best-rs-chips").addEventListener("click", e => {
    const i = e.target.closest("[data-rsp]")?.dataset.rsp; if (i == null) return;
    const [label, text] = PRESETS()[+i];
    $("best-rs-text").value = text;
    if (label === "Minion" && cur) $("best-rs-cr").value = String(CRS[Math.max(0, CRS.indexOf(cur.cr) - 3)]);
    if (label === "Elite" && cur) $("best-rs-cr").value = String(CRS[Math.min(CRS.length - 1, CRS.indexOf(cur.cr) + 2)]);
    if (label === "Boss" && cur) $("best-rs-cr").value = String(CRS[Math.min(CRS.length - 1, CRS.indexOf(cur.cr) + 3)]);
    $("best-rs-text").focus();
  });
  $("best-rs-go").addEventListener("click", () => reskin(!!cur?.custom));
  $("best-rs-text").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); reskin(!!cur?.custom); } });
  $("best-rs-stop").addEventListener("click", () => rsCtl?.abort());
  $("best-v-save").addEventListener("click", saveVariant);
  $("best-v-revise").addEventListener("click", () => {
    const p = $("best-reskin"); p.hidden = false; $("best-reskin-open").setAttribute("aria-expanded", "true"); renderPresets();
    $("best-rs-status").textContent = "Describe what to change, then press Reskin."; $("best-rs-status").classList.remove("err");
    $("best-rs-text").focus();
  });
  $("best-v-orig").addEventListener("click", () => { const m = cur; if (m?.base && byKey[m.base]) { if (draft && !confirmLeave()) return; open(m.base, false); } });
  $("best-v-del").addEventListener("click", () => setDel(true));
  $("best-v-delno").addEventListener("click", () => setDel(false));
  $("best-v-delok").addEventListener("click", deleteVariant);

  $("best-enc-add").addEventListener("click", () => {
    const m = cur, st = $("best-status"); if (!m) return;
    if (m.custom && !(m.k && B.custom.some(c => c.k === m.k))) { st.textContent = "Save this variant first, then add it to an encounter."; return; }
    st.textContent = encAPI.add(m);
  });
  window.addEventListener("spells-ready", relink);
}
