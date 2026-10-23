// Spells: SRD 5.2 spells (built from the open-source Open5e API, published
// beside this page as spells.json), Claude-made variants, and the spell links
// that stat blocks and item descriptions carry into this tab.
import { $, esc, smooth, narrow } from "../../shared/dom.js";
import { cap, newId } from "../../shared/format.js";
import { textMax } from "../../shared/sanitize.js";
import { RULES, SETTINGS } from "../../data/index.js";
import { store, state, lstate, save } from "../../app/state.js";
import { claude, claudeJson, claudeErrorMessage } from "../../shared/claude.js";
import { showView } from "../../app/shell.js";
import { fetchJson, opt, campaignContext, copyMarkdown, leaveGuard, mdWithDice, logSimpleRoll } from "./common.js";

const P = store.spells = Object.assign({ q: "", kind: "all", lv: "", sc: "", cl: "", tag: "", sort: "name", sel: "", custom: [] }, typeof store.spells === "object" && store.spells ? store.spells : {});
if (!Array.isArray(P.custom)) P.custom = [];
const SCHOOLS = RULES.spells.schools;
const CLASSES = RULES.spells.classes;
const lvLabel = n => n === 0 ? "Cantrip" : `Level ${n}`;
const ord = n => n === 0 ? "Cantrip" : ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"][n];

let S = null, byKey = {}, loading = null, cur = null, draft = null, mkCtl = null;
let linkRe = null, linkMap = {};

// ---------- validation for variants (Claude or backups) ----------
function normSpell(r, base) {
  if (!r || typeof r !== "object") return null;
  const n = textMax(r.n || r.name, 80), d = textMax(r.d || r.desc, 5000); if (!n || !d) return null;
  const lv = Math.max(0, Math.min(9, Math.round(+r.lv)));
  return {
    k: /^mine-[\w-]{1,60}$/.test(r.k || "") ? r.k : "", n, lv: Number.isFinite(lv) ? lv : (base?.lv ?? 1),
    sc: SCHOOLS.includes(String(r.sc).toLowerCase()) ? String(r.sc).toLowerCase() : (base?.sc || "evocation"),
    ct: textMax(r.ct, 200) || "Action", rit: !!r.rit, rg: textMax(r.rg, 60) || "Self", cp: textMax(r.cp, 200) || "V, S",
    du: textMax(r.du, 80) || "Instantaneous", co: !!r.co || /^concentration/i.test(textMax(r.du, 80)),
    cl: (Array.isArray(r.cl) ? r.cl : []).map(c => String(c).toLowerCase()).filter(c => CLASSES.includes(c)).slice(0, 8),
    d, hl: textMax(r.hl, 800), base: textMax(r.base || base?.k, 80), baseName: textMax(r.baseName || base?.n, 80), notes: textMax(r.notes, 600),
    custom: true, made: Number.isFinite(+r.made) ? +r.made : Date.now(),
  };
}
P.custom = P.custom.map(c => normSpell(c)).filter(x => x && x.k).slice(0, 300);
const index = x => { x._s = (x.n + " " + x.sc + " " + x.cl.join(" ") + " " + (x.baseName || "")).toLowerCase(); };
function indexCustom() { Object.keys(byKey).forEach(k => { if (k.startsWith("mine-")) delete byKey[k]; }); P.custom.forEach(x => { byKey[x.k] = x; index(x); }); }
export function restoreSpells(list) {
  if (!Array.isArray(list)) return 0; let n = 0;
  list.forEach(raw => { const x = normSpell(raw); if (!x || !x.k || P.custom.some(c => c.k === x.k)) return; P.custom.push(x); n++; });
  if (n) { save(); indexCustom(); renderList(); }
  return n;
}

function load() {
  if (S) return Promise.resolve(S);
  if (loading) return loading;
  loading = fetchJson("spells.json").then(j => {
    S = j.spells; S.forEach(x => { byKey[x.k] = x; index(x); });
    indexCustom(); buildFilters(); buildLinker(); return S;
  }).catch(err => { loading = null; $("sp-count").textContent = "The spell list didn't load. Check your connection, then open this tab again."; throw err; });
  return loading;
}
function buildFilters() {
  $("sp-lv").innerHTML = opt("", "Any level", P.lv) + Array.from({ length: 10 }, (_, i) => opt(i, lvLabel(i), P.lv)).join("");
  $("sp-sc").innerHTML = opt("", "Any school", P.sc) + SCHOOLS.map(s => opt(s, cap(s), P.sc)).join("");
  $("sp-cl").innerHTML = opt("", "Any class", P.cl) + CLASSES.map(c => opt(c, cap(c), P.cl)).join("");
  $("sp-tag").value = P.tag; $("sp-q").value = P.q;
}

// ---------- spell links in other tabs ----------
// Multi-word names link wherever a passage mentions spells or casting. Single-word names ("Light", "Shield")
// are ordinary words too, so they link only in a spell list or right before the word "spell".
function buildLinker() {
  linkMap = {}; S.forEach(x => { linkMap[x.n.toLowerCase()] = x.k; });
  const names = S.map(x => x.n).sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  linkRe = new RegExp(`(^|[^\\w'-])(${names.join("|")})(?![\\w'-])`, "g");
}
function linkify(html, context) {
  if (!linkRe || !/\bspells?\b|\bcasts?\b|\bcasting\b/i.test(context || html)) return html;
  return html.split(/(<[^>]+>)/).map((part, i, arr) => {
    if (part.startsWith("<")) return part;
    // don't link inside an existing button
    const open = arr.slice(0, i).filter(p => /^<button\b/i.test(p)).length, close = arr.slice(0, i).filter(p => /^<\/button>/i.test(p)).length;
    if (open > close) return part;
    // Older stat blocks write spells in lowercase italics ("<i>detect magic</i>"): link an italic run that is exactly a spell name.
    if (/^<i>$/i.test(arr[i - 1] || "") && /^<\/i>$/i.test(arr[i + 1] || "")) {
      const k = linkMap[part.trim().toLowerCase()];
      if (k) return `<button type="button" class="spell-link" data-spell="${esc(k)}">${part}</button>`;
    }
    return part.replace(linkRe, (m, pre, name, off, whole) => {
      const k = linkMap[name.toLowerCase()]; if (!k) return m;
      if (!/\s/.test(name)) {
        const before = whole.slice(0, off + pre.length), after = whole.slice(off + m.length);
        // a text run that starts right after a tag (e.g. "<b>At Will:</b> Light, ...") counts as the start of a list
        const prevTag = i > 0 ? arr[i - 1] : "";
        const startsAfterLabel = /^\s*$/.test(before) && /^<\/(b|strong|em)>$/i.test(prevTag) && /:\s*$/.test(arr[i - 2] || "");
        const listy = (/(:|,|\bcasts?|\band|\bor)\s*$/i.test(before) || startsAfterLabel) && /^(\s*[,.;)]|\s*$|\s+(and|or)\b|\s+\()/.test(after);
        if (!(/^\s+spell/i.test(after) || listy)) return m;
        if (/\b(Bright|Dim|Legendary)\s*$/.test(before)) return m;
      }
      return `${pre}<button type="button" class="spell-link" data-spell="${esc(k)}">${name}</button>`;
    });
  }).join("");
}
// What the Bestiary and Items tabs use: the loaded list, spell links in prose, opening a spell.
export const spellsAPI = {
  ready: () => load(),
  linkify: (html, context) => linkify(html, context),
  open: k => { showView("spells"); load().then(() => { if (byKey[k]) { draft = null; open(k, true); } }); },
};

// ---------- list ----------
function results() {
  const q = P.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pool = P.kind === "mine" ? P.custom : [...P.custom, ...S];
  const tagOk = x => !P.tag || (P.tag === "co" && x.co) || (P.tag === "nco" && !x.co) || (P.tag === "rit" && x.rit) || (P.tag === "ba" && /^Bonus Action/.test(x.ct)) || (P.tag === "re" && /^Reaction/.test(x.ct));
  const list = pool.filter(x => (P.lv === "" || x.lv === +P.lv) && (!P.sc || x.sc === P.sc) && (!P.cl || x.cl.includes(P.cl)) && tagOk(x) && q.every(w => x._s.includes(w)));
  if (P.sort === "level") list.sort((a, b) => a.lv - b.lv || a.n.localeCompare(b.n));
  else if (q.length) { const w = q.join(" "); list.sort((a, b) => (b.n.toLowerCase().startsWith(w) - a.n.toLowerCase().startsWith(w)) || a.n.localeCompare(b.n)); }
  else list.sort((a, b) => (!!b.custom - !!a.custom) || a.n.localeCompare(b.n));
  return list;
}
function renderList() {
  if (!S) return;
  const list = results(), total = P.kind === "mine" ? P.custom.length : S.length + P.custom.length;
  $("sp-count").innerHTML = P.kind === "mine" ? `<b>${list.length}</b> of your ${total} spell${total === 1 ? "" : "s"}` : `<b>${list.length}</b> of ${total} spells`;
  $("sp-list").innerHTML = list.length ? list.map(x => `<li><button type="button" data-sk="${esc(x.k)}"${x.k === P.sel ? ' aria-current="true"' : ""}>
    <span class="lvl">${x.lv === 0 ? "Cantrip" : "Lv " + x.lv}</span>
    <span class="nm"><b>${esc(x.n)}${x.custom ? '<span class="mine">Yours</span>' : ""}</b><span>${esc(x.sc)}${x.co ? " · concentration" : ""}${x.rit ? " · ritual" : ""}${x.custom && x.baseName ? ` · from ${esc(x.baseName)}` : ""}</span></span></button></li>`).join("")
    : `<li class="none">${P.kind === "mine" && !P.custom.length ? "You haven't saved any spell variants yet. Open a spell and press Make a variant with Claude." : "No spells match. Loosen a filter or try a shorter search."}</li>`;
  document.querySelectorAll("#sp-kind [data-kind]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kind === P.kind)));
  document.querySelectorAll("#sp-sort [data-sort]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sort === P.sort)));
}

// ---------- card ----------
function md(t) { return mdWithDice(t); }
const subtitle = x => `${x.lv === 0 ? `${cap(x.sc)} Cantrip` : `Level ${x.lv} ${cap(x.sc)}`}${x.cl.length ? ` (${x.cl.map(cap).join(", ")})` : ""}`;
function card(x) {
  const line = (k, v) => v ? `<p class="sbline"><b>${k}</b> ${esc(v)}</p>` : "";
  const tags = [x.co && "Concentration", x.rit && "Ritual", x.custom && "Homebrew"].filter(Boolean);
  const up = x.hl ? `<p class="sp-up"><b>${x.lv === 0 ? "Cantrip Upgrade." : "Using a Higher-Level Spell Slot."}</b> ${diceMd(esc(x.hl))}</p>` : "";
  return `<header><h3>${esc(x.n)}</h3><p class="sbsub">${esc(subtitle(x))}</p></header>
    ${tags.length ? `<div class="sp-tags">${tags.map(t => `<span>${t}</span>`).join("")}</div>` : ""}
    <hr class="sbrule">
    ${line("Casting Time", x.ct + (x.rit ? " or Ritual" : ""))}${line("Range", x.rg)}${line("Components", x.cp)}${line("Duration", x.du)}
    <hr class="sbrule">
    <div class="idesc">${md(x.d)}</div>${up}`;
}
function show(x, scroll) {
  cur = x;
  $("sp-card").innerHTML = card(x); $("sp-card").scrollTop = 0;
  $("sp-tools").hidden = false; $("sp-log").innerHTML = ""; $("sp-status").textContent = "";
  const isVar = !!x.custom; $("sp-variant").hidden = !isVar;
  if (isVar) {
    const saved = !!(x.k && P.custom.some(c => c.k === x.k));
    $("sp-v-badge").textContent = saved ? "Yours" : "Unsaved variant";
    $("sp-v-of").textContent = x.baseName ? `Variant of ${x.baseName}` : "Made with Claude";
    $("sp-v-note").textContent = x.notes || ""; $("sp-v-note").hidden = !x.notes;
    $("sp-v-save").hidden = saved; $("sp-v-revise").hidden = false;
    $("sp-v-orig").hidden = !(x.base && byKey[x.base] && !byKey[x.base].custom);
    $("sp-v-del").hidden = !saved; $("sp-v-delok").hidden = $("sp-v-delno").hidden = true;
  }
  $("sp-mk-title").textContent = isVar ? `Revise ${x.n}` : `Make a variant of ${x.n}`;
  const sel = $("sp-mk-lv"), keep = sel.dataset.for === x.k ? sel.value : "";
  sel.innerHTML = `<option value="">Keep ${x.lv === 0 ? "cantrip" : "level " + x.lv}</option>` + Array.from({ length: 10 }, (_, i) => `<option value="${i}">${lvLabel(i)}</option>`).join("");
  sel.value = keep; sel.dataset.for = x.k;
  if (scroll && narrow()) $("sp-out").scrollIntoView({ behavior: smooth(), block: "start" });
}
function open(k, scroll) {
  const x = byKey[k]; if (!x || mkCtl) return;
  draft = null; P.sel = k; save();
  document.querySelectorAll("#sp-list [data-sk]").forEach(b => b.dataset.sk === k ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"));
  show(x, scroll);
}

// ---------- variants with Claude ----------
const PRESETS = () => {
  const sj = store.setting === "spelljammer";
  return [
    [sj ? "Wildspace" : "Regional", sj ? "A wildspace version that works in vacuum and between ships, flavored by the Astral Sea." : "A regional or cultural version taught by a specific tradition, with a twist in how it looks and one mechanical change."],
    ["Elemental swap", "The same spell with a different damage type and a matching secondary effect that fits the new element."],
    ["Ritual", "A slower ritual version with no combat use, built for exploration or social play."],
    ["Cantrip", "A cantrip that captures a small piece of this spell, with cantrip damage scaling at levels 5, 11 and 17."],
    ["Greater", "A more powerful version two levels higher with a bigger area or an extra effect."],
    ["NPC signature", "A signature spell invented by a villain or NPC from my campaign, named after them."],
  ];
};
const forPrompt = x => { const { _s, made, custom, k, ...rest } = x; return JSON.stringify(rest); };
function makePrompt(x, ask, lvSel, revise) {
  const S2 = SETTINGS[store.setting];
  const camp = campaignContext($("sp-mk-camp").checked, 3500);
  const lv = lvSel === "" ? x.lv : +lvSel;
  return `You are a Dungeons & Dragons 2024 (5.5e) spell designer. ${revise ? "Revise this homebrew spell" : "Create a new homebrew spell as a variant of this spell"} for a ${S2?.name || "fantasy"} campaign.

${revise ? "Current spell" : "Source spell"} (compact JSON; "d" is the rules text in Markdown, "hl" is the upcasting or cantrip scaling text):
${forPrompt(x)}

The request: ${ask}
Target level: ${lvLabel(lv)}.
${camp ? `\nCampaign context to borrow names, places and flavor from (use lightly):\n"""\n${camp}\n"""\n` : ""}
Design rules (2024 Player's Handbook conventions):
- Give it a new, evocative name unless the request says otherwise.
- Damage benchmarks by level (one target / several targets): cantrip 1d10 / 1d6, 1st 2d10 / 2d6, 2nd 3d10 / 4d6, 3rd 5d10 / 6d6, 4th 6d10 / 7d6, 5th 8d10 / 8d6, 6th 10d10 / 11d6, 7th 11d10 / 12d6, 8th 12d10 / 13d6, 9th 15d10 / 14d6. Lower the damage if the spell also imposes a condition or lasts several rounds.
- Use "your spell save DC" and "a spell attack" rather than fixed numbers. Areas use 2024 shapes (Cone, Cube, Cylinder, Emanation, Line, Sphere) written like "a 20-foot-radius Sphere".
- Concentration if the effect lasts and could be stacked; duration then reads "Concentration, up to 1 minute". Rituals need a casting time of at least 1 minute in play.
- "hl" for leveled spells: what improves per slot level above the spell's level. For cantrips: damage increases at character levels 5, 11 and 17. Empty if nothing scales.
- Components: "V, S, M (material)"; material with a cost reads "worth 50+ GP" and say if it's consumed.
- Capitalize game terms as the 2024 rules do (Bonus Action, Advantage, Frightened condition, Fire damage). Dice as "2d6".
- "cl": the classes whose list it belongs on, from: ${CLASSES.join(", ")}.

Reply with ONLY a JSON object:
{"n":"name","lv":${lv},"sc":"one of ${SCHOOLS.join("|")}","ct":"Action|Bonus Action|Reaction, which you take when ...|1 minute","rit":false,"rg":"60 feet","cp":"V, S","du":"Instantaneous","co":false,"cl":["wizard"],"d":"rules text in Markdown","hl":"scaling text","notes":"2 or 3 sentences for the GM: what changed from the source, and who in the world knows this spell."}`;
}
async function make() {
  if (mkCtl || !cur) return;
  const base = cur, revise = !!base.custom, ask = $("sp-mk-text").value.trim(), st = $("sp-mk-status");
  if (!ask) { st.textContent = "Describe the variant first, or tap one of the ideas above."; st.classList.add("err"); $("sp-mk-text").focus(); return; }
  if (!claude.sample) { st.textContent = "Claude isn't available in this view. Open the forge on claude.ai to make variants."; st.classList.add("err"); return; }
  st.classList.remove("err");
  mkCtl = new AbortController();
  $("sp-mk-go").disabled = true; $("sp-mk-stop").hidden = false; $("sp-v-revise").disabled = true;
  st.textContent = revise ? "Claude is revising the spell… this takes about a minute." : `Claude is reworking ${base.n}… this takes about a minute.`;
  try {
    const prompt = makePrompt(base, ask, $("sp-mk-lv").value, revise);
    const raw = await claudeJson(prompt, { signal: mkCtl.signal, cache: false, modelTier: "complex" });
    const origin = base.custom ? (byKey[base.base] || { k: base.base, n: base.baseName }) : base;
    const x = normSpell({ ...raw, k: base.custom && base.k ? base.k : "", base: origin.k, baseName: origin.n || base.baseName }, base);
    if (!x) throw { code: "bad_spell" };
    index(x); draft = x;
    if (x.k && P.custom.some(c => c.k === x.k)) { x.k = ""; x.reviseOf = base.k; }
    else if (base.reviseOf) x.reviseOf = base.reviseOf;
    show(x, true);
    st.textContent = ""; $("sp-mk-text").value = "";
    $("sp-make").hidden = true; $("sp-make-open").setAttribute("aria-expanded", "false");
    $("sp-status").textContent = "Done. Save it to keep it, or press Revise to change it.";
  } catch (e) {
    const msg = claudeErrorMessage(e, { bad_spell: "Claude's reply didn't contain a usable spell. Try again.", syntax: "Claude's reply didn't contain a usable spell. Try again." });
    st.textContent = msg; st.classList.toggle("err", e?.code !== "cancelled");
  } finally { mkCtl = null; $("sp-mk-go").disabled = false; $("sp-mk-stop").hidden = true; $("sp-v-revise").disabled = false; }
}
function saveVariant() {
  const x = cur; if (!x?.custom) return;
  if (x.reviseOf) { const i = P.custom.findIndex(c => c.k === x.reviseOf); x.k = x.reviseOf; delete x.reviseOf; if (i >= 0) P.custom[i] = x; else P.custom.unshift(x); }
  else { x.k = newId("mine-"); P.custom.unshift(x); }
  x.made = Date.now(); byKey[x.k] = x; draft = null; P.sel = x.k;
  if (!save()) { $("sp-status").textContent = "Couldn't save: browser storage is full."; return; }
  renderList(); show(x, false); $("sp-status").textContent = "Saved to your spells.";
}
function deleteVariant() {
  const x = cur; if (!x?.custom || !x.k) return;
  P.custom = P.custom.filter(c => c.k !== x.k); delete byKey[x.k];
  save(); renderList();
  if (x.base && byKey[x.base]) open(x.base, false);
  else { cur = null; P.sel = ""; save(); ["sp-variant", "sp-tools", "sp-make"].forEach(id => { $(id).hidden = true; }); $("sp-card").innerHTML = `<div class="best-empty">Deleted. Pick a spell from the list to open it.</div>`; }
  $("sp-status").textContent = `Deleted ${x.n}.`;
}

// ---- dice ----
function logRoll(btn) { logSimpleRoll($("sp-log"), btn, cur?.n || "Roll"); }
function markdown(x) {
  const out = [`## ${x.n}`, `*${subtitle(x)}*`, "",
    `**Casting Time:** ${x.ct}${x.rit ? " or Ritual" : ""}  `, `**Range:** ${x.rg}  `, `**Components:** ${x.cp}  `, `**Duration:** ${x.du}`, "", x.d];
  if (x.hl) out.push("", `***${x.lv === 0 ? "Cantrip Upgrade." : "Using a Higher-Level Spell Slot."}*** ${x.hl}`);
  out.push("", x.custom ? `*Homebrew spell${x.baseName ? `, variant of ${x.baseName}` : ""} (based on SRD 5.2, CC BY 4.0)*` : "*SRD 5.2, CC BY 4.0*");
  return out.join("\n");
}

export function openSpells() { load().then(() => { renderList(); if (!cur && P.sel && byKey[P.sel]) open(P.sel, false); }).catch(() => {}); }

// Leaving an unsaved draft: first tap warns, second tap goes.
const confirmLeave = leaveGuard(() => $("sp-status"), "spells");

export function initSpells() {
  document.addEventListener("click", e => {
    const b = e.target.closest(".spell-link[data-spell]"); if (!b) return;
    e.preventDefault(); spellsAPI.open(b.dataset.spell);
  });

  // ---- wiring ----
  let qTimer;
  $("sp-q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { P.q = e.target.value; save(); renderList(); }, 120); });
  $("sp-q").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const f = $("sp-list").querySelector("[data-sk]"); if (f) open(f.dataset.sk, true); } });
  [["sp-lv", "lv"], ["sp-sc", "sc"], ["sp-cl", "cl"], ["sp-tag", "tag"]].forEach(([id, k]) => $(id).addEventListener("change", e => { P[k] = e.target.value; save(); renderList(); }));
  $("sp-kind").addEventListener("click", e => { const k = e.target.closest("[data-kind]")?.dataset.kind; if (k) { P.kind = k; save(); renderList(); } });
  $("sp-sort").addEventListener("click", e => { const s = e.target.closest("[data-sort]")?.dataset.sort; if (s) { P.sort = s; save(); renderList(); } });
  $("sp-reset").addEventListener("click", () => { Object.assign(P, { q: "", kind: "all", lv: "", sc: "", cl: "", tag: "", sort: "name" }); save(); buildFilters(); renderList(); });
  $("view-spells").addEventListener("click", e => {
    const sk = e.target.closest("[data-sk]")?.dataset.sk; if (sk) { if (draft && sk !== cur?.k && !confirmLeave()) return; open(sk, true); return; }
    const d = e.target.closest(".dice"); if (d) logRoll(d);
  });
  $("sp-copy").addEventListener("click", () => {
    const x = cur; if (!x) return;
    copyMarkdown(markdown(x), $("sp-card"), $("sp-status"), "spell");
  });
  const openPanel = () => { $("sp-make").hidden = false; $("sp-make-open").setAttribute("aria-expanded", "true"); $("sp-mk-chips").innerHTML = PRESETS().map(([l], i) => `<button type="button" data-spp="${i}">${esc(l)}</button>`).join(""); $("sp-mk-text").focus(); };
  $("sp-make-open").addEventListener("click", () => { if ($("sp-make").hidden) openPanel(); else { $("sp-make").hidden = true; $("sp-make-open").setAttribute("aria-expanded", "false"); } });
  $("sp-mk-chips").addEventListener("click", e => {
    const i = e.target.closest("[data-spp]")?.dataset.spp; if (i == null || !cur) return;
    const [label, text] = PRESETS()[+i]; $("sp-mk-text").value = text;
    if (label === "Cantrip") $("sp-mk-lv").value = "0";
    if (label === "Greater") $("sp-mk-lv").value = String(Math.min(9, cur.lv + 2));
    if (label === "NPC signature") $("sp-mk-camp").checked = true;
    $("sp-mk-text").focus();
  });
  $("sp-mk-go").addEventListener("click", make);
  $("sp-mk-text").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); make(); } });
  $("sp-mk-stop").addEventListener("click", () => mkCtl?.abort());
  $("sp-v-save").addEventListener("click", saveVariant);
  $("sp-v-revise").addEventListener("click", () => { openPanel(); $("sp-mk-status").textContent = "Describe what to change, then press Make variant."; $("sp-mk-status").classList.remove("err"); });
  $("sp-v-orig").addEventListener("click", () => { const x = cur; if (x?.base && byKey[x.base]) { if (draft && !confirmLeave()) return; open(x.base, false); } });
  $("sp-v-del").addEventListener("click", () => { ["sp-v-save", "sp-v-revise", "sp-v-orig", "sp-v-del"].forEach(id => { $(id).hidden = true; }); $("sp-v-delok").hidden = $("sp-v-delno").hidden = false; $("sp-v-delok").focus(); });
  $("sp-v-delno").addEventListener("click", () => { if (cur) show(cur, false); });
  $("sp-v-delok").addEventListener("click", deleteVariant);

  // Bestiary and Items link spell names once the spell list is in; start loading it if either is open.
  if (store.view === "bestiary" || store.view === "items") load().then(() => window.dispatchEvent(new Event("spells-ready"))).catch(() => {});
}
