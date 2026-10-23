// Layout page: turns the Location wireframe into a top-down draft map for
// tracing in Inkarnate. Drafting with Claude or from the wireframe, map type and
// terrain, room selection, dragging and resizing, levels, undo, and the options.
import { $, statusSetter } from "../shared/dom.js";
import { clone } from "../shared/format.js";
import { LOC, LAYOUT } from "../data/index.js";
import { store, ystate, save, HISTORY_MAX, jobs } from "../app/state.js";
import { claude, claudeJson } from "../shared/claude.js";
import { anyBusy, setBusy, showView } from "../app/shell.js";
import { updateLibButtons } from "./library.js";
import { YU, YFLOORS, YOUTSIDE, YFEATURES, MAP_TYPES, TERRAIN_KINDS, ysource, quickSpec, normalizeSpec, computeLevels, levelName, levelShort, effType } from "../map/geometry.js";
import { renderLayout } from "../map/render.js";
import { drawVtt, invalidateVtt } from "./export/vtt.js";
import { drawSheet } from "./export/gm-sheet.js";

// The selected room (its area id) and the drag in progress; neither is saved.
let ysel = null, ydrag = null;

export function ysave() { store.layouts[store.setting] = ystate; save(); updateLibButtons(); }

const ymapHost = document.getElementById("lay-stage");
// Keep the spec's areas in step with the location's (a revision can add or drop areas).
function syncSpec(src) {
  if (!ystate.spec || !src) return;
  const ids = new Set(ystate.spec.areas.map(a => a.id));
  if (src.map.areas.length !== ids.size || src.map.areas.some(a => !ids.has(a.id))) ystate.spec = normalizeSpec(ystate.spec, src);
}
export function drawLayout() {
  const src = ysource();
  document.getElementById("lay-empty").hidden = !!src;
  document.getElementById("lay-main").hidden = !src;
  if (!src) return;
  if (!ystate.spec) { ystate.spec = quickSpec(src); ystate.src = src.src; ystate.fromClaude = false; ysave(); }
  syncSpec(src);
  document.getElementById("lay-title").textContent = src.name;
  document.getElementById("lay-sub").textContent = `${src.map.areas.length} areas from the Location tab · ${ystate.fromClaude ? "drafted with Claude" : "quick draft from the wireframe"}`;
  document.getElementById("lay-stale").hidden = ystate.src === src.src;
  ymapHost.classList.toggle("fit", ystate.opts.zoom !== "full");
  ymapHost.classList.toggle("editing", ysel != null);
  ymapHost.innerHTML = renderLayout(false, "full", ysel);
  document.querySelectorAll("[data-ystyle]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.ystyle === ystate.opts.style)));
  document.querySelectorAll("[data-yzoom]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.yzoom === ystate.opts.zoom)));
  document.getElementById("yopt-grid").checked = ystate.opts.grid;
  document.getElementById("yopt-labels").checked = ystate.opts.labels;
  document.getElementById("yopt-features").checked = ystate.opts.features;
  document.getElementById("yopt-player").checked = !!ystate.opts.player;
  const tsel = document.getElementById("ytype"), specT = MAP_TYPES[ystate.spec.type] ? ystate.spec.type : "dungeon";
  tsel.innerHTML = `<option value="auto">Auto (${MAP_TYPES[specT]})</option>` + Object.entries(MAP_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  tsel.value = MAP_TYPES[ystate.opts.type] ? ystate.opts.type : "auto";
  const have = new Set((ystate.spec.terrain || []).map(t => t.kind));
  const kinds = LAYOUT.terrainOrder[store.setting === "spelljammer" ? "spelljammer" : "fantasy"];
  document.getElementById("yterrain").innerHTML = kinds.map(k => `<button type="button" data-yterr="${k}" aria-pressed="${have.has(k)}">${TERRAIN_KINDS[k]}</button>`).join("");
  const lv = computeLevels(src, ystate.spec), levels = [...new Set(Object.values(lv))].sort((a, b) => b - a);
  const multi = levels.length > 1, split = multi && ystate.opts.split !== false;
  document.getElementById("ysplit-wrap").hidden = !multi;
  document.getElementById("yopt-split").checked = split;
  const seg = document.getElementById("ylevel-seg");
  seg.hidden = !split;
  if (split) {
    const cur = levels.includes(ystate.opts.level) ? ystate.opts.level : "all";
    seg.innerHTML = [`<button type="button" data-ylevel="all" aria-pressed="${cur === "all"}">All levels</button>`,
      ...levels.map(n => `<button type="button" data-ylevel="${n}" aria-pressed="${cur === n}" title="${levelName(n)}">${levelShort(n) === "G" ? "Ground" : levelShort(n)}</button>`)].join("");
  }
  document.querySelectorAll("[data-yppsq]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.yppsq === (ystate.opts.ppsq || 70))));
  const selBox = document.getElementById("lay-sel");
  const selArea = src.map.areas.find(a => a.id === ysel);
  selBox.hidden = !selArea;
  if (selArea) document.getElementById("ysel-name").textContent = `${selArea.id}. ${selArea.name}`;
  document.getElementById("btn-yundo").hidden = !(ystate.history || []).length;
  document.getElementById("btn-yrefine").disabled = anyBusy();
  document.getElementById("yrefine").hidden = !claude.sample;
  document.getElementById("btn-ydraft").disabled = !claude.sample || anyBusy();
  document.getElementById("yexport").hidden = !claude.downloads;
  document.getElementById("ychips").innerHTML = LAYOUT.chips[store.setting === "spelljammer" ? "spelljammer" : "fantasy"]
    .map(c => `<button type="button" data-ychip="${c}">${c}</button>`).join("");
  drawVtt();
  drawSheet();
}

function yeditRoom(op) {
  const src = ysource(); if (!src) return;
  const base = ystate.spec.areas.find(a => a.id === ysel); if (!base) return;
  const cur = ystate.sizes[ysel] || {};
  let w = cur.w ?? base.w, h = cur.h ?? base.h, rot = !!cur.rot;
  // w/h are stored unrotated; the on-screen axes swap when rotated
  const dw = rot ? "h" : "w", dh = rot ? "w" : "h";
  const v = { w, h };
  if (op === "rotate") rot = !rot;
  if (op === "wider") v[dw] = Math.min(18, v[dw] + 1);
  if (op === "narrower") v[dw] = Math.max(3, v[dw] - 1);
  if (op === "taller") v[dh] = Math.min(18, v[dh] + 1);
  if (op === "shorter") v[dh] = Math.max(3, v[dh] - 1);
  if (op === "lvlup" || op === "lvldown") {
    const cur = computeLevels(src, ystate.spec)[ysel] ?? 0;
    ystate.levels = { ...(ystate.levels || {}), [ysel]: cur + (op === "lvlup" ? 1 : -1) };
    delete ystate.moves[ysel]; ystate.opts.level = null;
    ysave(); drawLayout(); ysetStatus(`Moved area ${ysel} to ${levelName(ystate.levels[ysel]).toLowerCase()}.`); return;
  }
  if (op === "reset") { delete ystate.sizes[ysel]; delete ystate.moves[ysel]; if (ystate.levels) delete ystate.levels[ysel]; ysave(); drawLayout(); return; }
  ystate.sizes[ysel] = { w: v.w, h: v.h, rot };
  ysave(); drawLayout();
}

// ---------- drafting ----------
const ysetStatus = statusSetter("ystatus");
function ypushHistory() {
  if (ystate.spec) ystate.history = [...(ystate.history || []), { spec: ystate.spec, fromClaude: ystate.fromClaude, src: ystate.src,
    moves: clone(ystate.moves || {}), sizes: clone(ystate.sizes || {}), levels: clone(ystate.levels || {}), seed: ystate.seed }].slice(-HISTORY_MAX);
}
function ylayoutPrompt(src, change) {
  return `You are helping a tabletop RPG game master turn a location's wireframe into a rough, top-down battle-map layout that they will redraw by hand in Inkarnate. You decide the physical shape of each area; a program places the areas on a 5-foot grid using the wireframe positions and draws walls, corridors, doors, and textures. ${LOC[store.setting].context.split(". Use monsters")[0]}.

THE LOCATION (its keyed areas describe what each room is)
${src.body}

THE WIREFRAME (positions are a coarse grid; links are connections)
${JSON.stringify(src.map)}
${ystate.spec && change ? `\nTHE CURRENT LAYOUT\n${JSON.stringify(ystate.spec)}\n\nTHE GM'S CHANGE\n${change}\nApply this change and keep everything else the same.\n` : ""}
Reply with JSON only, no prose, in exactly this shape:
{"type":"dungeon","terrain":[{"kind":"river","from":"n","to":"s"}],"north":"up","outside":"rock","corridorFloor":"stone","areas":[{"id":1,"w":6,"h":5,"shape":"rect","floor":"stone","level":0,"features":[{"type":"pillar","at":"nw","label":""}]}],"links":[{"from":1,"to":2,"style":"corridor","width":1}]}

Rules:
- One entry in "areas" for every wireframe area, same ids. w and h are the room's size in 5-ft squares (3 to 18), sized to fit what the keyed text says happens there: a throne room or cavern is big, a closet or cell is small.
- type is how the whole place is built, and decides how it's drawn:
  dungeon (rooms joined by built corridors), cavern (natural chambers and winding tunnels), building (a manor, temple, inn, keep or station whose rooms share walls inside one footprint, with halls in between), ship (the same, inside a hull: ships, wrecks, nautiloids), wilderness (open ground: clearings, ruins and paths), settlement (small buildings, plazas and roads). Pick what the keyed text describes, not what the name suggests.
- terrain: 0 to 2 features that cross the whole map, only when the text supports them: river, chasm, cliff, lava, rubble (a collapsed zone), asteroids (a field of floating rock, for space). from and to are the map edges it runs between (n, s, e, w); rubble and asteroids need neither. Passages that cross a river, chasm or lava get bridges automatically; crossing a cliff gets steps.
- shape: rect, round, cave (natural, irregular walls), L, cross, T, U, octagon, hex, apse (a hall with a rounded end, like a chapel), or ring (a round room around a central pit). Vary shapes to fit each room's purpose. In buildings and ships rooms become rectangles that fill the floor plan unless round, octagon, hex, apse or ring.
- floor and corridorFloor: ${YFLOORS.join(", ")}.
- outside is the terrain around the whole site: ${YOUTSIDE.join(", ")}.
- north is which way north points on the page: up, down, left, or right. Choose it so the entrance faces where the keyed text implies (a gate facing the road, a dock facing the void).
- features: up to 6 per area, things a mapmaker should draw, taken from the keyed text. type is a short noun such as ${YFEATURES.join(", ")}. at is n, s, e, w, ne, nw, se, sw, or center. label is optional, at most 3 words, only for features that need a name.
- level (optional on each area): 0 for the entrance's level, -1, -2 for levels below, 1, 2 for levels above. Give every area a level when the place has more than one floor (a cellar, a tower, decks of a ship), and keep areas joined by stairs on different levels. Omit it everywhere for single-level places.
- One entry in "links" for every wireframe link, same from and to. style: corridor (built passage), tunnel (rough natural passage), bridge (span over the outside terrain), stairs, water (a channel to wade or swim), or open (no walls, open ground). width is 1 or 2 squares.`;
}
async function ydraft(change) {
  const src = ysource(); if (!src || !claude.sample || anyBusy()) return;
  jobs.layout = new AbortController();
  setBusy(true);
  document.getElementById("btn-ydraft").disabled = true; document.getElementById("btn-yrefine").disabled = true;
  document.getElementById("btn-ystop").hidden = false;
  ysetStatus(change ? "Revising the layout… this can take a minute." : "Claude is sizing rooms and placing features… this can take a minute.");
  try {
    const prompt = ylayoutPrompt(src, change);
    const raw = await claudeJson(prompt, { signal: jobs.layout.signal, cache: false });
    if (!raw || !Array.isArray(raw.areas)) throw { code: "bad_layout" };
    ypushHistory();
    ystate.spec = normalizeSpec(raw, src); ystate.src = src.src; ystate.fromClaude = true;
    if (!change) { ystate.sizes = {}; ystate.levels = {}; ystate.opts.level = null; }
    ysave();
    ysetStatus("Done. Drag rooms to adjust, then save a PNG for Inkarnate.");
  } catch (e) {
    const msg = {
      cancelled: "Stopped.", bad_layout: "Claude's reply didn't contain a usable layout. Try again.",
      not_granted: "Claude isn't allowed for this page. Quick draft still works.",
      sampling_disabled: "Claude isn't available on this account. Quick draft still works.",
      rate_limited: "Too many requests right now. Wait a minute and try again.",
      session_expired: "Your session expired. Sign in again, then retry.",
      refused: "Claude declined that request. Try different wording.",
    }[e.code] || (e instanceof SyntaxError ? "Claude's reply didn't contain a usable layout. Try again." : "Something went wrong reaching Claude. Try again.");
    ysetStatus(msg, e.code !== "cancelled");
  } finally {
    jobs.layout = null; setBusy(false); document.getElementById("btn-ystop").hidden = true;
    drawLayout();
  }
}

export function refreshLayout() {
  ystate.opts ||= freshLayout().opts; ystate.moves ||= {}; ystate.sizes ||= {}; ystate.history ||= [];
  ysel = null; ysetStatus("");
  if (store.view === "layout") drawLayout();
}

export function initLayout() {
  document.getElementById("view-layout").addEventListener("click", e => {
    const st = e.target.closest("[data-ystyle]")?.dataset.ystyle;
    if (st) { ystate.opts.style = st; ysave(); drawLayout(); }
    const lvb = e.target.closest("[data-ylevel]")?.dataset.ylevel;
    if (lvb) { ystate.opts.level = lvb === "all" ? null : +lvb; ysel = null; ysave(); drawLayout(); }
    const pp = e.target.closest("[data-yppsq]")?.dataset.yppsq;
    if (pp) { ystate.opts.ppsq = +pp; ysave(); drawLayout(); }
    const z = e.target.closest("[data-yzoom]")?.dataset.yzoom;
    if (z) { ystate.opts.zoom = z; ysave(); drawLayout(); }
    const chip = e.target.closest("[data-ychip]")?.dataset.ychip;
    if (chip) { const box = document.getElementById("yrefine-text"); box.value = (box.value.trim() ? box.value.trim() + " " : "") + chip + "."; box.focus(); }
    const ed = e.target.closest("[data-yedit]")?.dataset.yedit;
    if (ed && ysel != null) yeditRoom(ed);
  });
  document.getElementById("ytype").addEventListener("change", e => {
    ystate.opts.type = MAP_TYPES[e.target.value] ? e.target.value : "auto"; ysel = null; invalidateVtt();
    ysave(); drawLayout();
    const t = effType(ystate.spec);
    ysetStatus(t === "building" || t === "ship" ? "Rooms snap into a floor plan in this type: resize rooms to reshape it; dragging doesn't move them." : "");
  });
  document.getElementById("yterrain").addEventListener("click", e => {
    const k = e.target.closest("[data-yterr]")?.dataset.yterr; if (!k || !ystate.spec) return;
    ypushHistory();
    const cur = ystate.spec.terrain || [];
    ystate.spec = { ...ystate.spec, terrain: cur.some(t => t.kind === k) ? cur.filter(t => t.kind !== k) : [...cur, { kind: k }].slice(-3) };
    ysave(); drawLayout();
  });
  ["grid", "labels", "features", "player", "split"].forEach(k => document.getElementById("yopt-" + k).addEventListener("change", e => { ystate.opts[k] = e.target.checked; if (k === "split") ystate.opts.level = null; ysave(); drawLayout(); }));
  document.getElementById("btn-goto-loc").addEventListener("click", () => showView("location"));

  ymapHost.addEventListener("pointerdown", e => {
    const g = e.target.closest("[data-yroom]"); if (!g) return;
    const svg = ymapHost.querySelector("svg"), m = svg.getScreenCTM(); if (!m) return;
    const id = +g.dataset.yroom, mv = ystate.moves[id] || { dx: 0, dy: 0 };
    ydrag = { id, sx: e.clientX, sy: e.clientY, scale: m.a, base: { ...mv }, moved: false, pid: e.pointerId };
    try { ymapHost.setPointerCapture(e.pointerId); } catch {}
    if (e.pointerType === "mouse" || ysel === id) e.preventDefault();
  });
  // tap empty map → deselect (on touch this also hands panning back to the stage)
  ymapHost.addEventListener("click", e => {
    if (!e.target.closest("[data-yroom]") && ysel != null && !ydrag) { ysel = null; drawLayout(); }
  });
  ymapHost.addEventListener("pointermove", e => {
    if (!ydrag || e.pointerId !== ydrag.pid) return;
    const dx = Math.round((e.clientX - ydrag.sx) / (YU * ydrag.scale)), dy = Math.round((e.clientY - ydrag.sy) / (YU * ydrag.scale));
    const cur = ystate.moves[ydrag.id] || { dx: 0, dy: 0 };
    if (dx === cur.dx - ydrag.base.dx && dy === cur.dy - ydrag.base.dy) return;
    if (Math.abs(e.clientX - ydrag.sx) + Math.abs(e.clientY - ydrag.sy) > 4) ydrag.moved = true;
    ystate.moves[ydrag.id] = { dx: ydrag.base.dx + dx, dy: ydrag.base.dy + dy };
    ysel = ydrag.id;
    const keepScroll = [ymapHost.scrollLeft, ymapHost.scrollTop];
    ymapHost.innerHTML = renderLayout(false, "full", ysel);
    [ymapHost.scrollLeft, ymapHost.scrollTop] = keepScroll;
    ymapHost.querySelector(`[data-yroom="${ydrag.id}"]`)?.classList.add("dragging");
  });
  const yendDrag = e => {
    if (!ydrag || (e && e.pointerId !== ydrag.pid)) return;
    const id = ydrag.id, moved = ydrag.moved; ydrag = null;
    if (!moved) ysel = ysel === id ? null : id; else ysel = id;
    ysave(); drawLayout();
  };
  ymapHost.addEventListener("pointerup", yendDrag);
  ymapHost.addEventListener("pointercancel", yendDrag);
  ymapHost.addEventListener("keydown", e => {
    const g = e.target.closest?.("[data-yroom]"); if (!g) return;
    const id = +g.dataset.yroom, step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ysel = ysel === id ? null : id; drawLayout(); ymapHost.querySelector(`[data-yroom="${id}"]`)?.focus(); return; }
    if (!step) return;
    e.preventDefault();
    const mv = ystate.moves[id] || { dx: 0, dy: 0 };
    ystate.moves[id] = { dx: mv.dx + step[0], dy: mv.dy + step[1] }; ysel = id;
    ysave(); drawLayout(); ymapHost.querySelector(`[data-yroom="${id}"]`)?.focus();
  });

  document.getElementById("btn-ydraft").addEventListener("click", () => ydraft());
  document.getElementById("btn-ystale").addEventListener("click", () => {
    if (claude.sample && ystate.fromClaude) ydraft();
    else { ypushHistory(); ystate.spec = quickSpec(ysource()); ystate.src = ysource().src; ystate.fromClaude = false; ystate.moves = {}; ystate.sizes = {}; ysel = null; ysave(); drawLayout(); }
  });
  document.getElementById("btn-ystop").addEventListener("click", () => jobs.layout?.abort());
  document.getElementById("btn-yquick").addEventListener("click", () => {
    const src = ysource(); if (!src) return;
    ypushHistory();
    ystate.spec = quickSpec(src, ystate.opts.type); ystate.src = src.src; ystate.fromClaude = false; ystate.sizes = {}; ystate.levels = {}; ystate.opts.level = null; ysel = null;
    ysave(); drawLayout(); ysetStatus("Quick draft from the wireframe. Draft with Claude for room sizes, terrain, and features from the keyed areas.");
  });
  document.getElementById("btn-yshuffle").addEventListener("click", () => {
    ystate.seed = (ystate.seed % 100000) + 1 + Math.floor(Math.random() * 97); ysave(); drawLayout(); ysetStatus("");
  });
  document.getElementById("btn-yresetall").addEventListener("click", () => { ypushHistory(); ystate.moves = {}; ystate.sizes = {}; ystate.levels = {}; ysel = null; ysave(); drawLayout(); ysetStatus("Room moves and sizes reset."); });
  document.getElementById("btn-yundo").addEventListener("click", () => {
    const h = ystate.history || []; if (!h.length || jobs.layout) return;
    const prev = h.pop(); ystate.spec = prev.spec; ystate.fromClaude = prev.fromClaude; ystate.src = prev.src; ystate.history = h;
    if (prev.moves) { ystate.moves = prev.moves; ystate.sizes = prev.sizes || {}; ystate.levels = prev.levels || {}; ystate.seed = prev.seed ?? ystate.seed; }
    ysave(); drawLayout(); ysetStatus("Restored the previous draft.");
  });
  document.getElementById("btn-yrefine").addEventListener("click", () => {
    const box = document.getElementById("yrefine-text"), txt = box.value.trim();
    if (!txt) { ysetStatus("Describe the change first.", true); return; }
    box.value = ""; ydraft(txt);
  });
}
