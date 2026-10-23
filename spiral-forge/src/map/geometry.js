// Layout geometry: turns the Location wireframe plus a layout spec (room sizes,
// shapes, floors, features, corridor styles, terrain) into rooms, corridors,
// doors and levels on a 5-foot grid. Everything here is in grid squares; only
// roomPath and the small path helpers return pixels.
//
// The page places rooms from the wireframe's grid, routes corridors between
// them, and the renderer draws walls, terrain and features. Claude (optional)
// supplies the semantic part: room sizes, shapes, floors, features, corridor
// styles, north, and the terrain outside.
import { store, lstate, ystate } from "../app/state.js";
import { hashStr, rng } from "../shared/dice.js";
import { clampN, isObj } from "../shared/sanitize.js";
import { slug } from "../shared/format.js";
import { LAYOUT } from "../data/index.js";
import { splitMap } from "./wireframe.js";

export const YU = 18;                 // px per square on screen
const YGAP = 4;                // squares of corridor space between wireframe cells
const YMARGIN = 4;             // squares of outside terrain around the map
export const YHEAD = 4;               // squares above the map for the title
export const YSHAPES = LAYOUT.shapes, YFLOORS = LAYOUT.floors, YOUTSIDE = LAYOUT.outside, YLINKS = LAYOUT.linkStyles, YFEATURES = LAYOUT.features;
export const MAP_TYPES = LAYOUT.mapTypes;
export const TERRAIN_KINDS = LAYOUT.terrainKinds;

// ---------- the location being drawn ----------
// The location we're drawing: Location tab's current output + its wireframe.
export function ysource() {
  if (!lstate.output) return null;
  const { body, map } = splitMap(lstate.output);
  if (!map) return null;
  const name = (body.match(/^#\s+(.+)$/m) || [])[1] || "Untitled location";
  return { body, map, name, src: hashStr(lstate.output) };
}
// File-name stem for the layout's exports.
export const ystem = () => slug(ysource()?.name, "location") + "-layout";

// ---------- default specs (Quick draft) ----------
export function quickSpec(src, typeIn) {
  const sj = store.setting === "spelljammer";
  const type = MAP_TYPES[typeIn] ? typeIn : quickType(src);
  const R = rng(src.map.areas.length * 131 + ystate.seed * 7);
  const base = {
    entrance: [6, 5, "rect"], room: [6, 6, "rect"], hall: [10, 4, "rect"], cave: [8, 7, "cave"], shrine: [6, 8, "apse"],
    lair: [9, 8, sj ? "octagon" : "cave"], vault: [5, 5, "rect"], hazard: [7, 6, sj ? "rect" : "cave"], exterior: [10, 8, sj ? "round" : "cave"],
  };
  const floorFor = k => {
    if (type === "cavern") return k === "shrine" || k === "vault" ? "stone" : sj ? "rock" : k === "hazard" ? "rubble" : "dirt";
    if (type === "ship") return sj ? (k === "exterior" ? "metal" : "metal") : "wood";
    if (type === "building") return sj ? "metal" : k === "shrine" ? "stone" : k === "lair" || k === "vault" ? "stone" : k === "hall" ? "carpet" : "wood";
    if (type === "wilderness") return sj ? (k === "exterior" ? "rock" : "crystal") : k === "exterior" || k === "cave" ? "grass" : k === "hazard" ? "marsh" : "stone";
    if (type === "settlement") return sj ? "metal" : k === "exterior" ? "stone" : "wood";
    return sj ? (k === "cave" ? "rock" : k === "exterior" ? "void" : k === "hazard" ? "void" : "metal")
      : (k === "cave" || k === "lair" || k === "hazard" ? "dirt" : k === "exterior" ? "grass" : "stone");
  };
  const shapeFor = (k, def) => type === "cavern" ? (k === "shrine" ? "round" : "cave")
    : type === "building" || type === "ship" ? (k === "shrine" ? "apse" : "rect")
    : type === "settlement" ? (k === "exterior" ? "cave" : "rect")
    : type === "wilderness" ? (["exterior", "cave", "lair", "hazard"].includes(k) ? "cave" : def === "apse" ? "apse" : "rect") : def;
  const feats = { shrine: [{ type: "altar", at: "n" }], vault: [{ type: "chest", at: "center" }], hazard: [{ type: sj ? "trap" : "pit", at: "center" }],
    lair: [{ type: sj ? "console" : "bones", at: "center" }], hall: [{ type: "pillar", at: "nw" }, { type: "pillar", at: "ne" }, { type: "pillar", at: "sw" }, { type: "pillar", at: "se" }] };
  if (type === "ship") Object.assign(feats, { entrance: [{ type: sj ? "helm" : "barrel", at: "center" }], room: [{ type: "crates", at: "ne" }], hall: [{ type: "table", at: "center" }] });
  if (type === "settlement") Object.assign(feats, { exterior: [{ type: "well", at: "center" }], room: [{ type: "table", at: "center" }] });
  if (type === "wilderness" && !sj) Object.assign(feats, { exterior: [{ type: "tree", at: "nw" }, { type: "boulder", at: "se" }] });
  const areas = src.map.areas.map(a => {
    const [w, h, shape] = base[a.kind] || base.room;
    const small = type === "settlement" && a.kind !== "exterior" ? -1 : 0;
    return { id: a.id, w: w + small + Math.round(R() * 2 - 1), h: h + small + Math.round(R() * 2 - 1), shape: shapeFor(a.kind, shape), floor: floorFor(a.kind), features: feats[a.kind] || [] };
  });
  const links = src.map.links.map(l => ({ from: l.from, to: l.to, style: l.type === "stairs" ? "stairs" : type === "cavern" ? "tunnel" : "corridor", width: type === "settlement" ? 2 : 1 }));
  const outside = type === "ship" ? (sj ? "space" : "water") : type === "wilderness" || type === "settlement" ? (sj ? "rock" : "grass") : sj ? "space" : "rock";
  const corridorFloor = type === "ship" ? (sj ? "metal" : "wood") : type === "building" ? (sj ? "metal" : "stone") : type === "cavern" ? (sj ? "rock" : "dirt") : sj ? "metal" : "stone";
  return { scale: 5, north: "up", type, terrain: [], outside, corridorFloor, areas, links };
}

// Clean up whatever Claude returned into a spec the renderer can trust.
export function normalizeSpec(raw, src) {
  const q = quickSpec(src);
  const byId = Object.fromEntries((raw?.areas || []).map(a => [+a.id, a]));
  const areas = q.areas.map(d => {
    const a = byId[d.id] || {};
    const feats = (Array.isArray(a.features) ? a.features : []).slice(0, 8).map(f => ({
      type: String(f.type || "").toLowerCase().trim() || "statue",
      at: ["n", "s", "e", "w", "ne", "nw", "se", "sw", "center"].includes(String(f.at).toLowerCase()) ? String(f.at).toLowerCase() : "center",
      label: f.label ? String(f.label).slice(0, 24) : "",
    }));
    return {
      id: d.id,
      w: clampN(Math.round(+a.w || d.w), 3, 18), h: clampN(Math.round(+a.h || d.h), 3, 18),
      shape: YSHAPES.includes(a.shape) ? a.shape : d.shape,
      floor: YFLOORS.includes(a.floor) ? a.floor : d.floor,
      features: a.features ? feats : d.features,
      ...(Number.isInteger(+a.level) && a.level !== null && a.level !== undefined && Math.abs(+a.level) <= 4 ? { level: +a.level } : {}),
    };
  });
  const lk = {}; (raw?.links || []).forEach(l => { lk[`${+l.from}-${+l.to}`] = l; lk[`${+l.to}-${+l.from}`] = l; });
  const links = q.links.map(d => {
    const l = lk[`${d.from}-${d.to}`] || {};
    return { ...d, style: YLINKS.includes(l.style) ? l.style : d.style, width: +l.width === 2 ? 2 : 1 };
  });
  const terr = (Array.isArray(raw?.terrain) ? raw.terrain : []).filter(t => isObj(t) && TERRAIN_KINDS[t.kind]).slice(0, 3)
    .map(t => ({ kind: t.kind, ...(["n", "s", "e", "w"].includes(t.from) ? { from: t.from } : {}), ...(["n", "s", "e", "w"].includes(t.to) ? { to: t.to } : {}) }));
  return {
    scale: 5,
    // a layout saved before map types existed stays a dungeon
    type: MAP_TYPES[raw?.type] ? raw.type : "dungeon",
    terrain: Array.isArray(raw?.terrain) ? terr : q.terrain,
    north: ["up", "down", "left", "right"].includes(raw?.north) ? raw.north : "up",
    outside: YOUTSIDE.includes(raw?.outside) ? raw.outside : q.outside,
    corridorFloor: YFLOORS.includes(raw?.corridorFloor) ? raw.corridorFloor : q.corridorFloor,
    areas, links,
  };
}

// ---------- layout geometry ----------
function computeLayout(src, spec, ids, gap = YGAP) {
  const specById = Object.fromEntries(spec.areas.map(a => [a.id, a]));
  const inSet = id => !ids || ids.has(id);
  let quick = null; // areas the spec doesn't know yet get a quick-draft shape
  const areas = src.map.areas.filter(a => inSet(a.id)).map(a => {
    const s = specById[a.id] || (quick ||= Object.fromEntries(quickSpec(src).areas.map(q => [q.id, q])))[a.id];
    const sz = ystate.sizes[a.id];
    let w = sz?.w ?? s.w, h = sz?.h ?? s.h;
    if (sz?.rot) [w, h] = [h, w];
    return { ...a, ...s, w, h };
  });
  const minX = Math.min(...areas.map(a => a.x)), maxX = Math.max(...areas.map(a => a.x));
  const minY = Math.min(...areas.map(a => a.y)), maxY = Math.max(...areas.map(a => a.y));
  const colW = [], rowH = [];
  for (let c = minX; c <= maxX; c++) colW.push(Math.max(4, ...areas.filter(a => a.x === c).map(a => a.w)) + gap);
  for (let r = minY; r <= maxY; r++) rowH.push(Math.max(4, ...areas.filter(a => a.y === r).map(a => a.h)) + gap);
  const colX = [YMARGIN], rowY = [YMARGIN + YHEAD];
  colW.forEach((w, i) => colX.push(colX[i] + w));
  rowH.forEach((h, i) => rowY.push(rowY[i] + h));
  const R = rng(ystate.seed * 977 + 13);
  const rects = {};
  areas.forEach(a => {
    const ci = a.x - minX, ri = a.y - minY;
    const slackX = colW[ci] - gap - a.w, slackY = rowH[ri] - gap - a.h;
    const jx = Math.round((R() - .5) * Math.min(slackX + 2, 4)), jy = Math.round((R() - .5) * Math.min(slackY + 2, 4));
    const mv = ystate.moves[a.id] || { dx: 0, dy: 0 };
    rects[a.id] = {
      ...a,
      x: colX[ci] + gap / 2 + Math.floor(slackX / 2) + jx + mv.dx,
      y: rowY[ri] + gap / 2 + Math.floor(slackY / 2) + jy + mv.dy,
    };
  });
  let W = colX[colX.length - 1] + YMARGIN, H = rowY[rowY.length - 1] + YMARGIN;
  // grow the sheet if a room was dragged past the edge
  Object.values(rects).forEach(r => { W = Math.max(W, r.x + r.w + YMARGIN); H = Math.max(H, r.y + r.h + YMARGIN + 2); });
  const shiftX = Math.max(0, YMARGIN - Math.min(...Object.values(rects).map(r => r.x)));
  const shiftY = Math.max(0, YMARGIN + YHEAD - Math.min(...Object.values(rects).map(r => r.y)));
  Object.values(rects).forEach(r => { r.x += shiftX; r.y += shiftY; });
  W += shiftX; H += shiftY;
  const linkSpec = Object.fromEntries(spec.links.map(l => [`${l.from}-${l.to}`, l]));
  const corridors = src.map.links.filter(l => inSet(l.from) && inSet(l.to)).map(l => {
    const s = linkSpec[`${l.from}-${l.to}`] || { style: "corridor", width: 1 };
    return { ...routeCorridor(rects[l.from], rects[l.to], s.width || 1, R), type: l.type, style: s.style, width: s.width || 1, from: l.from, to: l.to };
  });
  return { W: Math.ceil(W), H: Math.ceil(H), rects, corridors };
}

export function effType(spec) {
  const o = ystate.opts.type;
  return MAP_TYPES[o] ? o : MAP_TYPES[spec?.type] ? spec.type : "dungeon";
}
// The ground around the map should suit the type even when you override it.
export function effOutside(type, outside) {
  const sj = store.setting === "spelljammer";
  if (type === "ship" && !["water", "void", "space"].includes(outside)) return sj ? "space" : "water";
  if ((type === "wilderness" || type === "settlement") && ["rock", "void"].includes(outside) && !sj) return "grass";
  return outside;
}
// Quick drafts guess the type from what the place is.
function quickType(src) {
  const body = typeof src?.body === "string" ? src.body : "", name = typeof src?.name === "string" ? src.name : "";
  const glance = (body.match(/^\*\*At a glance:\*\*(.*)$/mi) || [])[1] || "";
  const t = (name + " " + glance).toLowerCase();
  const all = (t + " " + body.slice(0, 1500)).toLowerCase();
  const test = s => re => re.test(s);
  const tests = [
    ["ship", /\b(ship|hulk|galleon|nautiloid|spelljammer|vessel|frigate|barge|airship|deathspider|wreck)\b/],
    ["settlement", /\b(village|town|hamlet|camp|market|settlement|homestead|farmstead|bazaar|refugee)\b/],
    ["cavern", /\b(cave|caves|cavern|caverns|grotto|mine|burrow|warren|tunnels|sinkhole|lava tubes)\b/],
    ["wilderness", /\b(forest|grove|glade|swamp|marsh|bog|ravine|canyon|crater|standing stones|fairy ring|garden|island|orchard|battlefield|reef|tar pits|crash site)\b/],
    ["building", /\b(manor|keep|castle|tower|temple|chapel|church|inn|tavern|mansion|library|monastery|fort|fortress|station|academy|prison|lighthouse|house|estate|guildhall|arena|theater|theatre|observatory|mill|lab|laboratory)\b/],
  ];
  for (const s of [t, all]) for (const [k, re] of tests) if (test(s)(re)) return k;
  return "dungeon";
}

// ---------- small geometry helpers (squares in, px out where noted) ----------
export const polyD = pts => "M" + pts.map(p => `${(p[0] * YU).toFixed(1)} ${(p[1] * YU).toFixed(1)}`).join("L");
// Break a path into short steps and nudge each sideways, ends fixed.
export function wiggle(pts, R, amp, step = 2) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n = Math.max(1, Math.round(L / step)), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    for (let k = 1; k <= n; k++) {
      const t = k / n, last = i === pts.length - 2 && k === n, firstSeg = i === 0 && k === 1;
      const j = last || firstSeg ? 0 : (R() - .5) * 2 * amp;
      out.push([a[0] + (b[0] - a[0]) * t + nx * j, a[1] + (b[1] - a[1]) * t + ny * j]);
    }
  }
  return out;
}
// Catmull-Rom through points → smooth cubic path (px).
export function smoothD(pts) {
  if (pts.length < 3) return polyD(pts);
  const u = YU, f = v => (v * u).toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
// The same curve as dense points (for crossings and spacing).
function sampleCR(pts, k = 6) {
  if (pts.length < 3) return pts.slice();
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let s = 0; s < k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
export function segHit(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, w = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && w >= 0 && w <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null;
}
export function distToPolyline(p, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    const t = clampN(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0, 1);
    best = Math.min(best, Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t)));
  }
  return best;
}

// ---------- building and ship floor plans ----------
// Rooms fill their grid cells and share walls; empty cells inside the footprint are
// halls (or open deck). Doors go on shared walls, or from a room into a hall.
function computeBuilding(src, spec, ids, type) {
  // Rows of rooms that share walls, with a 2-square hall between rows (a ship's
  // passage). Rows follow the wireframe's top-to-bottom order, rooms its left-to-right.
  const specById = Object.fromEntries(spec.areas.map(a => [a.id, a]));
  const inSet = id => !ids || ids.has(id);
  let quick = null;
  const areas = src.map.areas.filter(a => inSet(a.id)).map(a => {
    const s = specById[a.id] || (quick ||= Object.fromEntries(quickSpec(src).areas.map(q => [q.id, q])))[a.id];
    const sz = ystate.sizes[a.id];
    let w = sz?.w ?? s.w, h = sz?.h ?? s.h;
    if (sz?.rot) [w, h] = [h, w];
    return { ...a, ...s, w: clampN(w, 4, 18), h: clampN(h, 4, 18) };
  });
  const ys = [...new Set(areas.map(a => a.y))].sort((a, b) => a - b);
  const wireRows = ys.map(y => areas.filter(a => a.y === y).sort((a, b) => a.x - b.x));
  // Aim for a roughly 3:2 footprint: merge short wireframe rows, split long ones.
  const area = areas.reduce((t, a) => t + a.w * a.h, 0);
  const target = Math.max(Math.max(...areas.map(a => a.w)), Math.ceil(Math.sqrt(area * 1.5)));
  const rows = []; let cur = [], curW = 0;
  wireRows.forEach(r => r.forEach(a => {
    if (cur.length && curW + a.w > target) { rows.push(cur); cur = []; curW = 0; }
    cur.push(a); curW += a.w;
  }));
  if (cur.length) rows.push(cur);
  const HALL = 2, M = YMARGIN + 1;
  const rowW = rows.map(r => r.reduce((t, a) => t + a.w, 0)), W0 = Math.max(...rowW);
  const rects = {}, rowOf = {};
  let y = M + YHEAD;
  const hallY = [];
  rows.forEach((r, ri) => {
    const rh = Math.max(...r.map(a => a.h)), extra = W0 - rowW[ri];
    let x = M;
    r.forEach((a, k) => {
      // share spare width across the row, but never stretch a room more than half again;
      // whatever is left at the row's end stays open hall
      const w = a.w + Math.min(Math.floor(a.w / 2), Math.floor(extra / r.length) + (k < extra % r.length ? 1 : 0));
      rects[a.id] = { ...a, shape: ["round", "octagon", "hex", "apse", "ring"].includes(a.shape) ? a.shape : "rect", x, y, w, h: rh, ri, k };
      rowOf[a.id] = ri; x += w;
    });
    y += rh;
    if (ri < rows.length - 1 || rows.length === 1) { hallY.push(y); y += HALL; }
  });
  const fp = { x: M, y: M + YHEAD, w: W0, h: y - (M + YHEAD) };
  const doors = [], seen = new Set();
  const addDoor = (pt, type, from) => {
    const k = `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`; if (seen.has(k)) return; seen.add(k);
    doors.push({ x: pt.x, y: pt.y, dir: pt.dir, len: 1, type, from });
  };
  const toHall = (R, down, offset = 0) => ({ x: clampN(R.x + R.w / 2 + offset, R.x + 1, R.x + R.w - 1), y: down ? R.y + R.h : R.y, dir: "h" });
  src.map.links.filter(l => inSet(l.from) && inSet(l.to)).forEach(l => {
    const A = rects[l.from], B = rects[l.to];
    if (A.ri === B.ri && Math.abs(A.k - B.k) === 1) {
      const left = A.k < B.k ? A : B;
      addDoor({ x: left.x + left.w, y: left.y + left.h / 2, dir: "v" }, l.type, l.from);
      return;
    }
    // otherwise both open onto the hall between them (same row: the hall below, or above for the last row)
    const down = A.ri === B.ri ? A.ri < rows.length - 1 || rows.length === 1 : B.ri > A.ri;
    addDoor(toHall(A, down, (B.x - A.x) > 0 ? 1 : -1), l.type, A.id);
    addDoor(toHall(B, A.ri === B.ri ? down : !down, (A.x - B.x) > 0 ? 1 : -1), l.type, B.id);
  });
  // rooms nobody links to still open onto a hall
  Object.values(rects).forEach(R => {
    if (doors.some(d => d.from === R.id)) return;
    addDoor(toHall(R, R.ri < rows.length - 1 || rows.length === 1), "door", R.id);
  });
  // a way in: through the entrance room's outer wall
  const ent = Object.values(rects).find(r => r.kind === "entrance") || Object.values(rects)[0];
  if (ent) {
    const lastRow = ent.ri === rows.length - 1 && rows.length > 1;
    const side = ent.k === 0 ? "w" : ent.k === rows[ent.ri].length - 1 ? "e" : lastRow ? "s" : ent.ri === 0 ? "n" : "w";
    const pt = side === "w" ? { x: ent.x, y: ent.y + ent.h / 2, dir: "v" } : side === "e" ? { x: ent.x + ent.w, y: ent.y + ent.h / 2, dir: "v" }
      : side === "s" ? { x: ent.x + ent.w / 2, y: ent.y + ent.h, dir: "h" } : { x: ent.x + ent.w / 2, y: ent.y, dir: "h" };
    addDoor(pt, "door", ent.id);
  }
  // ships need room for the bow, which always points east
  const W = fp.x + fp.w + YMARGIN + 1 + (type === "ship" ? 8 : 0), H = fp.y + fp.h + YMARGIN + 1;
  return { W: Math.ceil(W), H: Math.ceil(H), rects, corridors: [], doors, footprint: fp };
}

// ---------- map-wide terrain ----------
// Lines (river, chasm, cliff, lava) cross the ground-level panel from edge to edge;
// zones (collapse, asteroids) sit inside it. Shapes come from the layout's seed.
export function terrainGeom(L, spec) {
  const pn = L.panels.find(p => p.level === 0) || L.panels[0];
  const x0 = pn.x + 1.3, x1 = pn.x + pn.W - 1.3, y0 = YHEAD + 0.2, y1 = (pn.H || L.H) - 1.3;
  const opp = { n: "s", s: "n", e: "w", w: "e" };
  return (spec.terrain || []).map((t, i) => {
    const R = rng(ystate.seed * 131 + i * 977 + 5);
    if (t.kind === "rubble" || t.kind === "asteroids") {
      return { kind: t.kind, cx: x0 + (x1 - x0) * (0.25 + R() * 0.5), cy: y0 + (y1 - y0) * (0.25 + R() * 0.5), r: 3 + R() * 3, R };
    }
    const from = ["n", "s", "e", "w"].includes(t.from) ? t.from : (R() < .5 ? "n" : "w");
    const to = ["n", "s", "e", "w"].includes(t.to) && t.to !== from ? t.to : opp[from];
    const edgePt = e => { const f = 0.15 + R() * 0.7; return e === "n" ? [x0 + (x1 - x0) * f, y0] : e === "s" ? [x0 + (x1 - x0) * f, y1] : e === "w" ? [x0, y0 + (y1 - y0) * f] : [x1, y0 + (y1 - y0) * f]; };
    const a = edgePt(from), b = edgePt(to), n = 7, pts = [a];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, amp = len * 0.13;
    let off = 0;
    for (let k = 1; k < n; k++) { off = clampN(off + (R() - .5) * amp * 0.9, -amp, amp); pts.push([a[0] + dx * k / n + nx * off, a[1] + dy * k / n + ny * off]); }
    pts.push(b);
    const width = { river: 2.4, lava: 2, chasm: 3.2, cliff: 0.4 }[t.kind] || 2;
    return { kind: t.kind, pts, dense: sampleCR(pts, 8), width };
  });
}

// ---------- levels ----------
// Areas joined by anything but stairs share a level. Stairs between those groups
// change level: Claude's "level" wins, then a per-room override, then name hints.
const UP_WORDS = /\b(tower|top|roof|upper|loft|attic|spire|balcony|bridge deck|crow|gallery|belfry|aerie|observatory|summit)\b/i;
export function computeLevels(src, spec) {
  const ids = src.map.areas.map(a => a.id), lvl = {};
  const specLvl = Object.fromEntries(spec.areas.filter(a => Number.isInteger(a.level)).map(a => [a.id, a.level]));
  // groups joined without stairs
  const parent = Object.fromEntries(ids.map(i => [i, i]));
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  src.map.links.filter(l => l.type !== "stairs").forEach(l => { parent[find(l.from)] = find(l.to); });
  const groups = {}; ids.forEach(i => (groups[find(i)] ||= []).push(i));
  const gOf = i => find(i);
  const start = (src.map.areas.find(a => a.kind === "entrance") || src.map.areas[0]).id;
  const gl = {}; gl[gOf(start)] = 0;
  const queue = [gOf(start)];
  while (queue.length) {
    const g = queue.shift();
    src.map.links.filter(l => l.type === "stairs").forEach(l => {
      const [a, b] = [gOf(l.from), gOf(l.to)];
      const other = a === g ? b : b === g ? a : null;
      if (other == null || other === g || other in gl) return;
      const up = groups[other].some(i => UP_WORDS.test(src.map.areas.find(x => x.id === i).name));
      gl[other] = gl[g] + (up ? 1 : -1); queue.push(other);
    });
  }
  ids.forEach(i => { lvl[i] = gl[gOf(i)] ?? 0; });
  // Claude's levels, when it gave them for every area, replace the guess
  if (ids.every(i => i in specLvl)) ids.forEach(i => { lvl[i] = specLvl[i]; });
  Object.entries(ystate.levels || {}).forEach(([i, v]) => { if (+i in lvl) lvl[+i] = v; });
  return lvl;
}
export const levelName = n => (n = Math.trunc(+n) || 0) === 0 ? "Ground level" : n < 0 ? (n === -1 ? "Lower level" : `Lower level ${-n}`) : (n === 1 ? "Upper level" : `Upper level ${n}`);
export const levelShort = n => (n = Math.trunc(+n) || 0) === 0 ? "G" : n < 0 ? "B" + (-n) : "U" + n;

// Lay out each level as its own panel, side by side, and give stairs that cross
// levels a short stub labelled with where they lead.
export function composeLayout(src, spec) {
  const lvl = computeLevels(src, spec);
  const levels = [...new Set(Object.values(lvl))].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : a < 0 && b < 0 ? b - a : a < 0 ? -1 : b < 0 ? 1 : a - b));
  const split = levels.length > 1 && ystate.opts.split !== false;
  const shown = split && ystate.opts.level != null && levels.includes(ystate.opts.level) ? [ystate.opts.level] : (split ? levels : [null]);
  const type = effType(spec), plan = type === "building" || type === "ship";
  const rects = {}, corridors = [], panels = [], stubs = [], doors = [], footprints = [], stairs = [];
  let ox = 0, H = 0;
  shown.forEach(lv => {
    const ids = lv == null ? null : new Set(Object.keys(lvl).map(Number).filter(i => lvl[i] === lv));
    const P = plan ? computeBuilding(src, spec, ids, type)
      : computeLayout(src, spec, ids, type === "wilderness" || type === "settlement" ? 7 : YGAP);
    Object.values(P.rects).forEach(r => { rects[r.id] = { ...r, x: r.x + ox }; });
    P.corridors.forEach(c => corridors.push({ ...c, pts: c.pts.map(([x, y]) => [x + ox, y]),
      door: c.door && { ...c.door, x: c.door.x + ox }, doorA: c.doorA && { ...c.doorA, x: c.doorA.x + ox } }));
    (P.doors || []).forEach(d => doors.push({ ...d, x: d.x + ox }));
    if (P.footprint) footprints.push({ ...P.footprint, x: P.footprint.x + ox });
    panels.push({ level: lv, x: ox, W: P.W, H: P.H });
    ox += P.W; H = Math.max(H, P.H);
  });
  if (split) {
    // stairs whose ends are on different levels: a 3-square stub out of each visible end
    src.map.links.filter(l => lvl[l.from] !== lvl[l.to]).forEach(l => {
      [[l.from, l.to], [l.to, l.from]].forEach(([a, b]) => {
        const r = rects[a]; if (!r) return;
        const panel = panels.find(p => p.level === lvl[a]);
        const pcx = panel.x + panel.W / 2, pcy = panel.H / 2;
        const rcx = r.x + r.w / 2, rcy = r.y + r.h / 2;
        const used = stubs.filter(s => s.from === a).length;
        // head away from the panel's middle, so the stub lands in open ground
        let dir = Math.abs(rcx - pcx) / panel.W > Math.abs(rcy - pcy) / panel.H ? (rcx < pcx ? "w" : "e") : (rcy < pcy ? "n" : "s");
        if (used) dir = { n: "e", e: "s", s: "w", w: "n" }[dir];
        const L = 3, inset = r.shape === "rect" ? 1.5 : Math.min(r.w, r.h) / 2;
        const p1 = { n: [rcx, r.y + inset], s: [rcx, r.y + r.h - inset], e: [r.x + r.w - inset, rcy], w: [r.x + inset, rcy] }[dir];
        const edge = { n: [rcx, r.y], s: [rcx, r.y + r.h], e: [r.x + r.w, rcy], w: [r.x, rcy] }[dir];
        const end = { n: [edge[0], edge[1] - L], s: [edge[0], edge[1] + L], e: [edge[0] + L, edge[1]], w: [edge[0] - L, edge[1]] }[dir];
        const p1r = [Math.round(p1[0] - .5) + .5, Math.round(p1[1] - .5) + .5], endr = [Math.round(end[0] - .5) + .5, Math.round(end[1] - .5) + .5];
        if (dir === "n" || dir === "s") endr[0] = p1r[0]; else endr[1] = p1r[1];
        const toLvl = lvl[b];
        const label = `${toLvl > lvl[a] ? "▲" : "▼"} ${b} · ${levelShort(toLvl)}`;
        if (plan) {
          // inside a building the stairs sit in the room, against the wall they head toward
          const sp = { n: [rcx, r.y + 1.3], s: [rcx, r.y + r.h - 1.3], e: [r.x + r.w - 1.6, rcy], w: [r.x + 1.6, rcy] }[dir];
          stairs.push({ x: sp[0], y: sp[1] });
          stubs.push({ from: a, to: b, dir: "s", end: [sp[0], sp[1] + 0.6], label, inner: true });
          return;
        }
        stubs.push({ from: a, to: b, dir, end: endr, label });
        corridors.push({ pts: [p1r, endr], door: null, doorA: null, type: "stairs", style: "stairs", width: 1, from: a, to: b, stub: true });
      });
    });
  }
  return { W: Math.ceil(ox), H: Math.ceil(H), rects, corridors, panels, stubs, split, levels, lvl, type, doors, footprints, footprint: footprints[0], stairs };
}

// Orthogonal route from room A to room B. Returns the polyline (square coords)
// and the door point where it meets B, with its orientation.
function routeCorridor(A, B, w, R) {
  const ax2 = A.x + A.w, ay2 = A.y + A.h, bx2 = B.x + B.w, by2 = B.y + B.h;
  const half = w / 2;
  // Ports on rectangles can sit anywhere along a wall; on round, cave, L and cross
  // rooms keep them near the middle of the side so they land on real floor.
  const pick = (room, lo, hi, prefer) => {
    if (room.shape !== "rect") { const mid = (lo + hi) / 2, k = (hi - lo) * 0.16; lo = Math.min(mid - 1, mid - k) - 1 - half; hi = Math.max(mid + 1, mid + k) + 1 + half; }
    return clampN(prefer, lo + 1 + half, hi - 1 - half);
  };
  const overlapY = [Math.max(A.y, B.y), Math.min(ay2, by2)], overlapX = [Math.max(A.x, B.x), Math.min(ax2, bx2)];
  const sepX = B.x >= ax2 ? 1 : A.x >= bx2 ? -1 : 0;
  const sepY = B.y >= ay2 ? 1 : A.y >= by2 ? -1 : 0;
  // corridor ends run into the room (under its floor) so non-rect walls still open onto floor
  const inA = (dim) => A.shape === "rect" ? 1.5 : dim / 2, inB = (dim) => B.shape === "rect" ? 1.5 : dim / 2;
  const gapX = sepX > 0 ? B.x - ax2 : sepX < 0 ? A.x - bx2 : -1;
  const gapY = sepY > 0 ? B.y - ay2 : sepY < 0 ? A.y - by2 : -1;
  if (sepX && (!sepY || gapX >= gapY)) {
    const xa = sepX > 0 ? ax2 : A.x, xb = sepX > 0 ? B.x : bx2;
    let ya, yb;
    if (overlapY[1] - overlapY[0] >= w + 2) { ya = yb = Math.round((overlapY[0] + overlapY[1]) / 2 - half) + half; }
    else { ya = pick(A, A.y, ay2, B.y + B.h / 2); yb = pick(B, B.y, by2, A.y + A.h / 2); ya = Math.round(ya - half) + half; yb = Math.round(yb - half) + half; }
    const span = Math.abs(xb - xa), bend = Math.round(Math.min(xa, xb) + span / 2 + (span > 4 ? Math.round((R() - .5) * (span - 3)) : 0));
    const pts = [[xa - sepX * inA(A.w), ya], [bend, ya], [bend, yb], [xb + sepX * inB(B.w), yb]];
    return { pts, door: { x: xb, y: yb, dir: "v" }, doorA: { x: xa, y: ya, dir: "v" } };
  }
  if (sepY) {
    const ya = sepY > 0 ? ay2 : A.y, yb = sepY > 0 ? B.y : by2;
    let xa, xb;
    if (overlapX[1] - overlapX[0] >= w + 2) { xa = xb = Math.round((overlapX[0] + overlapX[1]) / 2 - half) + half; }
    else { xa = pick(A, A.x, ax2, B.x + B.w / 2); xb = pick(B, B.x, bx2, A.x + A.w / 2); xa = Math.round(xa - half) + half; xb = Math.round(xb - half) + half; }
    const span = Math.abs(yb - ya), bend = Math.round(Math.min(ya, yb) + span / 2 + (span > 4 ? Math.round((R() - .5) * (span - 3)) : 0));
    const pts = [[xa, ya - sepY * inA(A.h)], [xa, bend], [xb, bend], [xb, yb + sepY * inB(B.h)]];
    return { pts, door: { x: xb, y: yb, dir: "h" }, doorA: { x: xa, y: ya, dir: "h" } };
  }
  // overlapping rooms (after a drag): just join centers
  const ca = [A.x + A.w / 2, A.y + A.h / 2], cb = [B.x + B.w / 2, B.y + B.h / 2];
  return { pts: [ca, [cb[0], ca[1]], cb], door: null, doorA: null };
}

// Room outline as an SVG path in px.
export function roomPath(r) {
  const u = YU, x = r.x * u, y = r.y * u, w = r.w * u, h = r.h * u;
  const R = rng(r.id * 7919 + ystate.seed);
  if (r.shape === "round") return `M${x + w / 2} ${y}A${w / 2} ${h / 2} 0 1 1 ${x + w / 2 - .01} ${y}Z`;
  if (r.shape === "cave") {
    const n = 14 + Math.round((r.w + r.h) / 2), pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, k = 0.82 + R() * 0.18;
      // superellipse-ish so caves fill their footprint
      const cx = Math.sign(Math.cos(t)) * Math.pow(Math.abs(Math.cos(t)), 0.6), cy = Math.sign(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), 0.6);
      pts.push([x + w / 2 + cx * (w / 2) * k, y + h / 2 + cy * (h / 2) * k]);
    }
    let d = `M${(pts[0][0] + pts[n - 1][0]) / 2} ${(pts[0][1] + pts[n - 1][1]) / 2}`;
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`; }
    return d + "Z";
  }
  if (r.shape === "L" && r.w >= 5 && r.h >= 5) {
    const cw = Math.floor(r.w / 2) * u, ch = Math.floor(r.h / 2) * u, c = Math.floor(R() * 4);
    const P = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    // cut corner c
    const cuts = [
      [[x + cw, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + ch], [x + cw, y + ch]],
      [[x, y], [x + w - cw, y], [x + w - cw, y + ch], [x + w, y + ch], [x + w, y + h], [x, y + h]],
      [[x, y], [x + w, y], [x + w, y + h - ch], [x + w - cw, y + h - ch], [x + w - cw, y + h], [x, y + h]],
      [[x, y], [x + w, y], [x + w, y + h], [x + cw, y + h], [x + cw, y + h - ch], [x, y + h - ch]],
    ][c] || P;
    return "M" + cuts.map(p => p.join(" ")).join("L") + "Z";
  }
  const poly = P => "M" + P.map(p => p.map(v => v.toFixed(1)).join(" ")).join("L") + "Z";
  if (r.shape === "ring") return `M${x + w / 2} ${y}A${w / 2} ${h / 2} 0 1 1 ${x + w / 2 - .01} ${y}Z`;
  if (r.shape === "octagon") { const c = Math.min(w, h) * 0.29; return poly([[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]); }
  if (r.shape === "hex") { const c = Math.min(w * 0.25, h * 0.5); return poly([[x + c, y], [x + w - c, y], [x + w, y + h / 2], [x + w - c, y + h], [x + c, y + h], [x, y + h / 2]]); }
  if (r.shape === "apse") { const ar = Math.min(w / 2, h * 0.4); return `M${x} ${y + h}V${y + ar}A${w / 2} ${ar} 0 0 1 ${x + w} ${y + ar}V${y + h}Z`; }
  if (r.shape === "T" && r.w >= 5 && r.h >= 5) { const bh = Math.round(r.h / 3) * u, sx = Math.floor(r.w / 3) * u;
    return poly([[x, y], [x + w, y], [x + w, y + bh], [x + w - sx, y + bh], [x + w - sx, y + h], [x + sx, y + h], [x + sx, y + bh], [x, y + bh]]); }
  if (r.shape === "U" && r.w >= 5 && r.h >= 5) { const sx = Math.floor(r.w / 3) * u, nd = Math.round(r.h / 2) * u;
    return poly([[x, y], [x + sx, y], [x + sx, y + nd], [x + w - sx, y + nd], [x + w - sx, y], [x + w, y], [x + w, y + h], [x, y + h]]); }
  if (r.shape === "cross" && r.w >= 5 && r.h >= 5) {
    const tx = Math.floor(r.w / 3) * u, ty = Math.floor(r.h / 3) * u;
    const pts = [[x + tx, y], [x + w - tx, y], [x + w - tx, y + ty], [x + w, y + ty], [x + w, y + h - ty], [x + w - tx, y + h - ty], [x + w - tx, y + h],
      [x + tx, y + h], [x + tx, y + h - ty], [x, y + h - ty], [x, y + ty], [x + tx, y + ty]];
    return "M" + pts.map(p => p.join(" ")).join("L") + "Z";
  }
  return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
}
