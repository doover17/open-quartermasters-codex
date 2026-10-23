// Draws a layout as SVG: the map for the screen and the exports, and the
// tracing layer (walls, doors and stairs only, on transparent) at the same size.
// Every map type turns the same areas and links into a list of drawing "ops".
// One renderer paints the ops for the screen and the exports; the tracing layer
// reads the same ops as a mask, so every type traces correctly.
import { store, ystate } from "../app/state.js";
import { rng } from "../shared/dice.js";
import { esc as xesc } from "../shared/dom.js";
import { LAYOUT } from "../data/index.js";
import { YU, YHEAD, ysource, effType, effOutside, terrainGeom, composeLayout, roomPath, polyD, wiggle, smoothD, segHit, distToPolyline, levelName } from "./geometry.js";

// ---------- palettes and terrain textures ----------
const YPAL = LAYOUT.palettes;
// Where a feature sits inside its room, as fractions of the room's width and height.
export const YAT = LAYOUT.anchors;

// Each pattern is the fine detail drawn over a terrain's base color.
function terrainPatterns(P) {
  const d = P.detail, u = YU;
  const pat = (id, w, h, body) => `<pattern id="yp-${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}">${body}</pattern>`;
  return [
    pat("stone", u * 2, u * 2, `<path d="M0 ${u}H${u * 2}M${u} 0V${u}M0 ${u}V${u * 2}M${u * 2} ${u}V${u * 2}" stroke="${d}" stroke-width="1" fill="none"/>`),
    pat("dirt", u * 1.5, u * 1.5, `<circle cx="${u * .3}" cy="${u * .4}" r="1.1" fill="${d}"/><circle cx="${u * 1.1}" cy="${u * 1.0}" r=".9" fill="${d}"/><circle cx="${u * .8}" cy="${u * .2}" r=".6" fill="${d}"/>`),
    pat("earth", u * 1.5, u * 1.5, `<circle cx="${u * .3}" cy="${u * .4}" r="1.1" fill="${d}"/><circle cx="${u * 1.1}" cy="${u * 1.0}" r=".9" fill="${d}"/>`),
    pat("sand", u, u, `<circle cx="${u * .25}" cy="${u * .3}" r=".7" fill="${d}"/><circle cx="${u * .75}" cy="${u * .8}" r=".6" fill="${d}"/>`),
    pat("wood", u * 3, u * .5, `<path d="M0 ${u * .5 - .5}H${u * 3}M${u * 1.4} 0V${u * .5}" stroke="${d}" stroke-width="1" fill="none"/>`),
    pat("water", u * 2, u, `<path d="M0 ${u * .5}q${u * .5} -4 ${u} 0t${u} 0" stroke="${P === YPAL.ink ? d : "rgba(255,255,255,.6)"}" stroke-width="1.2" fill="none"/>`),
    pat("marsh", u * 2, u * 2, `<path d="M${u * .4} ${u * .9}l2 -5l2 5M${u * 1.3} ${u * 1.8}l2 -5l2 5" stroke="${d}" stroke-width="1" fill="none"/>`),
    pat("grass", u * 1.5, u * 1.5, `<path d="M${u * .3} ${u * .6}l1.5 -4M${u * 1} ${u * 1.3}l1.5 -4" stroke="${d}" stroke-width="1" fill="none"/>`),
    pat("snow", u * 2, u * 2, `<circle cx="${u * .5}" cy="${u * .5}" r=".8" fill="${d}"/><circle cx="${u * 1.4}" cy="${u * 1.3}" r=".6" fill="${d}"/>`),
    pat("ice", u * 2, u * 2, `<path d="M0 ${u * 2}L${u * 2} 0" stroke="${d}" stroke-width=".8" fill="none"/>`),
    pat("metal", u, u, `<path d="M${u * .25} ${u * .25}l3 3M${u * .75} ${u * .75}l3 3" stroke="${d}" stroke-width="1" fill="none"/><path d="M0 0H${u}" stroke="${d}" stroke-width=".6"/>`),
    pat("lava", u * 3, u * 3, `<path d="M${u * .2} ${u * .5}l${u * .8} ${u * .4}l${u * .5} ${u * .9}M${u * 1.8} ${u * .3}l${u * .5} ${u * 1.1}" stroke="${P === YPAL.ink ? d : "#7a2a0e"}" stroke-width="1.4" fill="none"/>`),
    pat("rubble", u * 2, u * 2, `<path d="M${u * .3} ${u * .4}l3 -2l3 2l-2 3zM${u * 1.3} ${u * 1.2}l4 -1l1 3l-4 1z" fill="${d}"/>`),
    pat("carpet", u * 2, u * 2, `<path d="M${u} 0V${u * 2}" stroke="${d}" stroke-width=".6" stroke-dasharray="2 3"/>`),
    pat("void", u * 3, u * 3, `<circle cx="${u * .5}" cy="${u * .7}" r=".9" fill="#ffffff" opacity=".7"/><circle cx="${u * 2.1}" cy="${u * 1.9}" r=".6" fill="#ffffff" opacity=".5"/><circle cx="${u * 1.4}" cy="${u * .3}" r=".5" fill="#c9b8ff" opacity=".7"/>`),
    pat("space", u * 4, u * 4, `<circle cx="${u * .6}" cy="${u * .9}" r=".9" fill="${P === YPAL.ink ? d : "#fff"}"/><circle cx="${u * 2.7}" cy="${u * 2.2}" r=".6" fill="${P === YPAL.ink ? d : "#fff"}" opacity=".7"/><circle cx="${u * 1.6}" cy="${u * 3.3}" r=".5" fill="${P === YPAL.ink ? d : "#cdd8ff"}"/>`),
    pat("crystal", u * 2, u * 2, `<path d="M${u} ${u * .3}l${u * .4} ${u * .7}l-${u * .4} ${u * .7}l-${u * .4} -${u * .7}z" stroke="${d}" stroke-width="1" fill="none"/>`),
    pat("rock", u * 1.2, u * 1.2, `<path d="M0 ${u * 1.2}L${u * 1.2} 0" stroke="${P === YPAL.ink ? "rgba(0,0,0,.45)" : "rgba(42,32,24,.35)"}" stroke-width="1.2"/>`),
    pat("forest", u * 3, u * 3, `<circle cx="${u * .8}" cy="${u * .9}" r="${u * .55}" fill="${P === YPAL.ink ? "none" : "#5f7d4a"}" stroke="${d}"/><circle cx="${u * 2.2}" cy="${u * 2.1}" r="${u * .65}" fill="${P === YPAL.ink ? "none" : "#5f7d4a"}" stroke="${d}"/>`),
    `<pattern id="yp-grid" patternUnits="userSpaceOnUse" width="${u}" height="${u}"><path d="M${u} 0V${u}H0" fill="none" stroke="${P.grid}" stroke-width="1"/></pattern>`,
  ].join("");
}

// Building footprint: a rectangle. Ship: a hull with a pointed bow and rounded stern.
function footprintPath(fp, type) {
  const u = YU;
  if (type !== "ship") return `M${fp.x * u} ${fp.y * u}H${(fp.x + fp.w) * u}V${(fp.y + fp.h) * u}H${fp.x * u}Z`;
  const pad = 1.2, x0 = (fp.x - pad) * u, y0 = (fp.y - pad) * u, x1 = (fp.x + fp.w + pad) * u, y1 = (fp.y + fp.h + pad) * u;
  const w = x1 - x0, h = y1 - y0;
  { // bow to the east
    const b = Math.min(7 * u, h * 0.75), r = Math.min(3 * u, h * 0.35), ym = (y0 + y1) / 2;
    return `M${x0 + r} ${y0}H${x1}C${x1 + b * .55} ${y0} ${x1 + b} ${ym - h * .18} ${x1 + b} ${ym}C${x1 + b} ${ym + h * .18} ${x1 + b * .55} ${y1} ${x1} ${y1}H${x0 + r}Q${x0} ${y1} ${x0} ${y1 - r}V${y0 + r}Q${x0} ${y0} ${x0 + r} ${y0}Z`;
  }
}

function terrainSVG(geo, P, trace) {
  const u = YU, out = [];
  const dark = { river: P === YPAL.ink ? "#333" : "#4c6f80", lava: P === YPAL.ink ? "#333" : "#5a1c0a", chasm: P.wall };
  geo.forEach(g => {
    if (trace) {
      if (g.pts) out.push(`<path d="${smoothD(g.pts)}" fill="none" stroke="#777" stroke-width="${g.kind === "cliff" ? 2 : 1.5}" stroke-dasharray="${g.kind === "cliff" ? "none" : "6 5"}"/>`);
      return;
    }
    if (g.kind === "river" || g.kind === "lava") {
      const t = g.kind === "river" ? "water" : "lava", d = smoothD(g.pts);
      out.push(`<path d="${d}" fill="none" stroke="${dark[g.kind]}" stroke-width="${g.width * u + 5}" stroke-linecap="round" stroke-linejoin="round"/>`,
        `<path d="${d}" fill="none" stroke="${P.floor[t]}" stroke-width="${g.width * u}" stroke-linecap="round" stroke-linejoin="round"/>`,
        `<path d="${d}" fill="none" stroke="url(#yp-${t})" stroke-width="${g.width * u}" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else if (g.kind === "chasm") {
      const d = smoothD(g.pts);
      out.push(`<path d="${d}" fill="none" stroke="${P.wall}" stroke-width="${g.width * u + 4}" stroke-linecap="round" stroke-linejoin="round"/>`,
        `<path d="${d}" fill="none" stroke="${P === YPAL.ink ? "#444" : "#17120e"}" stroke-width="${g.width * u - 3}" stroke-linecap="round" stroke-linejoin="round"/>`,
        `<path d="${d}" fill="none" stroke="${P === YPAL.ink ? "#777" : "#3a2f26"}" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/>`);
    } else if (g.kind === "cliff") {
      out.push(`<path d="${smoothD(g.pts)}" fill="none" stroke="${P.wall}" stroke-width="3.2" stroke-linecap="round"/>`);
      const s = g.dense; let acc = 0;
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1], b = s[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; acc += L;
        if (acc < 0.8) continue; acc = 0;
        const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
        out.push(`<path d="M${b[0] * u} ${b[1] * u}l${nx * u * .7} ${ny * u * .7}" stroke="${P.wall}" stroke-width="1.6"/>`);
      }
    } else if (g.kind === "rubble") {
      const r = { x: g.cx - g.r, y: g.cy - g.r * .8, w: g.r * 2, h: g.r * 1.6, id: 991, shape: "cave" };
      out.push(`<path d="${roomPath(r)}" fill="${P.floor.rubble}" opacity=".9"/><path d="${roomPath(r)}" fill="url(#yp-rubble)"/>`);
      for (let k = 0; k < 14; k++) {
        const a = g.R() * Math.PI * 2, rr = g.R() * g.r * .85, x = (g.cx + Math.cos(a) * rr) * u, y = (g.cy + Math.sin(a) * rr * .8) * u, s = (0.25 + g.R() * 0.45) * u;
        out.push(`<path d="M${x - s} ${y}l${s * .6} ${-s * .8}l${s * .9} ${s * .2}l${s * .5} ${s * .7}l${-s * .9} ${s * .5}z" fill="${P.floor.rock}" stroke="${P.wall}" stroke-width="1"/>`);
      }
    }
  });
  return out.join("");
}
// Where a passage crosses a river, lava or chasm it gets a bridge; a cliff gets steps.
function crossingsSVG(geo, corridors, P, rects) {
  const u = YU, out = [];
  // passages run hidden into their rooms; only crossings out in the open get a bridge
  const inRoom = ([x, y]) => (rects || []).some(r => x > r.x - .3 && x < r.x + r.w + .3 && y > r.y - .3 && y < r.y + r.h + .3);
  geo.filter(g => g.pts).forEach(g => corridors.forEach(c => {
    const done = [];
    for (let i = 0; i < c.pts.length - 1; i++) for (let j = 0; j < g.dense.length - 1; j++) {
      const hit = segHit(c.pts[i], c.pts[i + 1], g.dense[j], g.dense[j + 1]); if (!hit || inRoom(hit)) continue;
      // one bridge per crossing, even where the passage turns on the bank
      if (done.some(p => Math.hypot(p[0] - hit[0], p[1] - hit[1]) < g.width + 1.5)) continue;
      done.push(hit);
      const a = c.pts[i], b = c.pts[i + 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      const len = (g.width + 1.4) * u, wid = (c.width + .5) * u, x = hit[0] * u, y = hit[1] * u;
      if (g.kind === "cliff") {
        let s = ""; for (let k = -2; k <= 2; k++) s += `<path d="M${k * u * .28} ${-wid / 2}v${wid}" stroke="${P.wall}" stroke-width="1.3"/>`;
        out.push(`<g transform="translate(${x} ${y}) rotate(${ang})"><rect x="${-u * .75}" y="${-wid / 2}" width="${u * 1.5}" height="${wid}" fill="${P.floor.stone}" stroke="${P.wall}" stroke-width="1.2"/>${s}</g>`);
      } else {
        let planks = ""; for (let k = -len / 2 + 5; k < len / 2; k += 5) planks += `<path d="M${k} ${-wid / 2}v${wid}" stroke="${P.wall}" stroke-width=".7" opacity=".6"/>`;
        out.push(`<g transform="translate(${x} ${y}) rotate(${ang})"><rect x="${-len / 2}" y="${-wid / 2}" width="${len}" height="${wid}" fill="${P.floor.wood}" stroke="${P.wall}" stroke-width="1.6"/>${planks}<path d="M${-len / 2} ${-wid / 2}h${len}M${-len / 2} ${wid / 2}h${len}" stroke="${P.wall}" stroke-width="2.4"/></g>`);
      }
    }
  }));
  return out.join("");
}

// ---------- scenery for outdoor maps and asteroid fields ----------
function scenerySVG(L, spec, type, geo, P) {
  const u = YU, out = [], sj = store.setting === "spelljammer";
  const R = rng(ystate.seed * 53 + 17);
  const rects = Object.values(L.rects);
  const clear = (x, y, pad) => !rects.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad)
    && !L.corridors.some(c => distToPolyline([x, y], c.pts) < c.width / 2 + pad)
    && !geo.some(g => g.dense && distToPolyline([x, y], g.dense) < g.width / 2 + pad)
    && !(L.footprints || []).some(fp => x > fp.x - 2 && x < fp.x + fp.w + 10 && y > fp.y - 2 && y < fp.y + fp.h + 2);
  const x0 = 1.6, x1 = L.W - 1.6, y0 = YHEAD + 0.4, y1 = L.H - 1.6;
  const tree = (x, y, s) => `<circle cx="${x * u}" cy="${y * u}" r="${s * u}" fill="${P === YPAL.ink ? "#fff" : "#6a8a50"}" stroke="${P.wall}" stroke-width="1.1"/><circle cx="${(x - s * .25) * u}" cy="${(y - s * .25) * u}" r="${s * .45 * u}" fill="${P === YPAL.ink ? "#fff" : "#7d9c61"}" stroke="${P.wall}" stroke-width=".6" opacity=".9"/>`;
  const rock = (x, y, s) => `<path d="M${(x - s) * u} ${(y + s * .3) * u}q${s * .2 * u} ${-s * 1.2 * u} ${s * u} ${-s * u}q${s * .9 * u} ${s * .1 * u} ${s * .9 * u} ${s * .9 * u}q${-s * .4 * u} ${s * .7 * u} ${-s * 1.2 * u} ${s * .5 * u}z" fill="${P.floor.rock}" stroke="${P.wall}" stroke-width="1"/>`;
  const outdoor = type === "wilderness" || type === "settlement";
  if (outdoor) {
    const n = Math.min(260, Math.round((x1 - x0) * (y1 - y0) / (type === "wilderness" ? 9 : 22)));
    for (let k = 0; k < n; k++) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
      if (!clear(x, y, 1)) continue;
      out.push(sj ? rock(x, y, .35 + R() * .5) : R() < .82 ? tree(x, y, .5 + R() * .6) : rock(x, y, .3 + R() * .4));
    }
  }
  geo.filter(g => g.kind === "asteroids").forEach(g => {
    for (let k = 0; k < 40; k++) {
      const x = x0 + g.R() * (x1 - x0), y = y0 + g.R() * (y1 - y0);
      if (!clear(x, y, 0.8)) continue;
      out.push(rock(x, y, .35 + g.R() * .9));
    }
  });
  return out.join("");
}

// ---------- the drawing ops for each type ----------
function buildOps(L, spec, CORS, type, player) {
  const u = YU, ops = [], doors = [];
  const R = rng(ystate.seed * 71 + 3);
  const rects = Object.values(L.rects);
  const cFloor = c => c.style === "tunnel" ? "dirt" : c.style === "water" ? "water" : c.style === "bridge" ? "wood" : c.style === "open" ? effOutside(type, spec.outside) : spec.corridorFloor;
  const walled = c => !["bridge", "open"].includes(c.style);
  const corrDoors = () => CORS.forEach(c => { if (c.door) doors.push({ ...c.door, len: c.width, type: c.type }); });
  if (type === "dungeon" || type === "cavern") {
    const cav = type === "cavern";
    const shapeOf = r => cav && ["rect", "L", "cross", "T", "U", "octagon", "hex"].includes(r.shape) ? { ...r, shape: "cave" } : r;
    const dOf = c => cav ? smoothD(wiggle(c.pts, rng(ystate.seed * 31 + c.from * 101 + c.to * 7), 0.55)) : polyD(c.pts);
    const wOf = c => cav ? Math.max(c.width, 1.5) : c.width;
    const join = cav ? "round" : "miter", cap = cav ? "round" : "butt";
    CORS.filter(walled).forEach(c => ops.push({ op: "stroke", d: dOf(c), w: wOf(c) * u + 6, join, cap }));
    rects.forEach(r => ops.push({ op: "solid", d: roomPath(shapeOf(r)), sw: 6 }));
    CORS.forEach(c => {
      ops.push({ op: "floorstroke", d: dOf(c), w: wOf(c) * u, t: cav && c.style === "corridor" ? "dirt" : cFloor(c), join, cap });
      if (c.style === "bridge") ops.push({ op: "deco", svg: `<path d="${dOf(c)}" fill="none" stroke="${"WALL"}" stroke-width="${c.width * u + 2}" stroke-dasharray="2 ${u * .5}" opacity=".6"/>` });
    });
    rects.forEach(r => ops.push({ op: "floor", d: roomPath(shapeOf(r)), t: r.floor }));
    if (!cav) corrDoors();
    else CORS.forEach(c => { if (c.door && c.type !== "open") doors.push({ ...c.door, len: wOf(c), type: c.type }); });
  } else if (type === "building" || type === "ship") {
    // each level panel has its own footprint
    const fds = (L.footprints || []).map(fp => footprintPath(fp, type));
    fds.forEach(d => ops.push({ op: "solid", d, sw: 9 }));
    fds.forEach(d => ops.push({ op: "floor", d, t: spec.corridorFloor }));
    rects.forEach(r => ops.push({ op: "floor", d: roomPath(r), t: r.floor }));
    rects.forEach(r => ops.push({ op: "line", d: roomPath(r), w: 3.6 }));
    (L.doors || []).forEach(d => {
      if (d.type === "secret" && player) return;          // players see a plain wall
      const fl = L.rects[d.from]?.floor || spec.corridorFloor;
      if (d.type !== "secret") ops.push({ op: "gap", x: d.x, y: d.y, dir: d.dir, len: d.len, t: fl });
      doors.push(d);
    });
  } else {
    // wilderness and settlement: paths and roads, clearings and plazas, ruins and buildings
    const settle = type === "settlement";
    const style = r => r.kind === "exterior" || (!settle && (["cave", "lair", "hazard"].includes(r.kind) || r.shape === "cave")) ? "soft" : settle ? "building" : "ruin";
    const pathW = c => settle ? Math.max(2, c.width) : Math.max(1, c.width);
    const roadT = settle ? (store.setting === "spelljammer" ? "metal" : "stone") : (store.setting === "spelljammer" ? "rock" : "dirt");
    const dOf = c => smoothD(wiggle(c.pts, rng(ystate.seed * 37 + c.from * 13 + c.to * 29), settle ? 0.35 : 0.7));
    CORS.forEach(c => ops.push({ op: "path", d: dOf(c), w: pathW(c) * u, t: c.style === "water" ? "water" : c.style === "bridge" ? "wood" : roadT }));
    rects.forEach(r => {
      const st = style(r);
      if (st === "soft") ops.push({ op: "soft", d: roomPath({ ...r, shape: "cave" }), t: r.floor });
      else {
        ops.push({ op: "floor", d: roomPath(r), t: r.floor });
        ops.push({ op: "line", d: roomPath(r), w: st === "ruin" ? 5 : 4, dash: st === "ruin" ? `${u * 1.7} ${u * .8} ${u * .6} ${u * 1.1}` : "" });
      }
    });
    // buildings get doors where the road arrives
    if (settle) CORS.forEach(c => [[c.door, c.to], [c.doorA, c.from]].forEach(([d, id]) => {
      if (!d || style(L.rects[id] || {}) !== "building" || (c.type === "secret" && player)) return;
      ops.push({ op: "gap", x: d.x, y: d.y, dir: d.dir, len: pathW(c) * .6, t: L.rects[id].floor });
      doors.push({ ...d, len: pathW(c) * .6, type: c.type === "open" ? "door" : c.type });
    }));
  }
  return { ops, doors };
}

// Paint ops for the screen, or as the white/black mask the tracing layer uses.
function drawOps(ops, P, mask) {
  const u = YU, fill = t => P.floor[t] || P.floor.stone, out = [];
  const pat = t => P.floor[t] ? `url(#yp-${t})` : "none";
  ops.forEach(o => {
    const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
    if (mask) {
      if (o.op === "solid") out.push(`<path d="${o.d}" fill="#fff" stroke="#fff" stroke-width="${o.sw}" stroke-linejoin="round"/>`);
      else if (o.op === "floor") out.push(`<path d="${o.d}" fill="#000"/>`);
      else if (o.op === "stroke") out.push(`<path d="${o.d}" fill="none" stroke="#fff" stroke-width="${o.w}" stroke-linejoin="${o.join || "miter"}" stroke-linecap="${o.cap || "butt"}"/>`);
      else if (o.op === "floorstroke") out.push(`<path d="${o.d}" fill="none" stroke="#000" stroke-width="${o.w}" stroke-linejoin="${o.join || "miter"}" stroke-linecap="${o.cap || "butt"}"/>`);
      else if (o.op === "line") out.push(`<path d="${o.d}" fill="none" stroke="#fff" stroke-width="${o.w}"${dash}/>`);
      else if (o.op === "gap") out.push(gapRect(o, "#000"));
      return;
    }
    if (o.op === "solid") out.push(`<path d="${o.d}" fill="${P.wall}" stroke="${P.wall}" stroke-width="${o.sw}" stroke-linejoin="round"/>`);
    else if (o.op === "floor") out.push(`<path d="${o.d}" fill="${fill(o.t)}"/><path d="${o.d}" fill="${pat(o.t)}"/>`);
    else if (o.op === "stroke") out.push(`<path d="${o.d}" fill="none" stroke="${P.wall}" stroke-width="${o.w}" stroke-linejoin="${o.join || "miter"}" stroke-linecap="${o.cap || "butt"}"/>`);
    else if (o.op === "floorstroke") out.push(`<path d="${o.d}" fill="none" stroke="${fill(o.t)}" stroke-width="${o.w}" stroke-linejoin="${o.join || "miter"}" stroke-linecap="${o.cap || "butt"}"/><path d="${o.d}" fill="none" stroke="${pat(o.t)}" stroke-width="${o.w}" stroke-linejoin="${o.join || "miter"}" stroke-linecap="${o.cap || "butt"}"/>`);
    else if (o.op === "line") out.push(`<path d="${o.d}" fill="none" stroke="${P.wall}" stroke-width="${o.w}" stroke-linecap="round"${dash}/>`);
    else if (o.op === "gap") out.push(gapRect(o, fill(o.t)));
    else if (o.op === "soft") out.push(`<path d="${o.d}" fill="${fill(o.t)}" opacity=".95"/><path d="${o.d}" fill="${pat(o.t)}"/><path d="${o.d}" fill="none" stroke="${P.detail}" stroke-width="1.6" stroke-dasharray="5 4"/>`);
    else if (o.op === "path") out.push(`<path d="${o.d}" fill="none" stroke="${P.detail}" stroke-width="${o.w + 3}" stroke-linecap="round" stroke-linejoin="round"/><path d="${o.d}" fill="none" stroke="${fill(o.t)}" stroke-width="${o.w}" stroke-linecap="round" stroke-linejoin="round"/><path d="${o.d}" fill="none" stroke="${pat(o.t)}" stroke-width="${o.w}" stroke-linecap="round" stroke-linejoin="round"/>`);
    else if (o.op === "deco") out.push(o.svg.replace(/"WALL"/g, `"${P.wall}"`));
  });
  return out.join("");
}
function gapRect(o, color) {
  const u = YU, x = o.x * u, y = o.y * u, len = o.len * u, th = 7;
  return o.dir === "v" ? `<rect x="${x - th / 2}" y="${y - len / 2}" width="${th}" height="${len}" fill="${color}"/>` : `<rect x="${x - len / 2}" y="${y - th / 2}" width="${len}" height="${th}" fill="${color}"/>`;
}

// ---------- feature icons (centered at cx,cy px) ----------
function featureSVG(f, cx, cy, P) {
  const u = YU, W = P.wall, D = P.detail, F = P.floor;
  const t = f.type;
  const has = k => t.includes(k);
  if (has("pillar") || has("column")) return `<circle cx="${cx}" cy="${cy}" r="${u * .42}" fill="${W}"/>`;
  if (has("statue") || has("idol")) return `<circle cx="${cx}" cy="${cy}" r="${u * .6}" fill="${F.stone}" stroke="${W}" stroke-width="1.5"/><rect x="${cx - u * .25}" y="${cy - u * .25}" width="${u * .5}" height="${u * .5}" fill="${W}"/>`;
  if (has("altar")) return `<rect x="${cx - u * .9}" y="${cy - u * .45}" width="${u * 1.8}" height="${u * .9}" fill="${F.stone}" stroke="${W}" stroke-width="1.6"/><path d="M${cx - u * .5} ${cy}h${u}" stroke="${W}" stroke-width="1"/>`;
  if (has("stair") || has("ladder") || has("lift")) { let s = `<rect x="${cx - u}" y="${cy - u * .7}" width="${u * 2}" height="${u * 1.4}" fill="${F.stone}" stroke="${W}" stroke-width="1.5"/>`; for (let i = 1; i < 5; i++) s += `<path d="M${cx - u + i * u * .4} ${cy - u * .7}v${u * 1.4}" stroke="${W}" stroke-width="1"/>`; return s; }
  if (has("pool") || has("water") || has("fountain") || has("well")) return `<ellipse cx="${cx}" cy="${cy}" rx="${has("well") ? u * .6 : u * 1.2}" ry="${has("well") ? u * .6 : u * .85}" fill="${F.water}" stroke="${W}" stroke-width="1.4"/>`;
  if (has("lava") || has("magma")) return `<ellipse cx="${cx}" cy="${cy}" rx="${u * 1.2}" ry="${u * .8}" fill="${F.lava}" stroke="${W}" stroke-width="1.4"/>`;
  if (has("rubble") || has("debris") || has("collapse")) return [[-.6, -.2], [.1, -.5], [.5, .2], [-.2, .4], [.7, -.4]].map(([a, b], i) => `<path d="M${cx + a * u} ${cy + b * u}l${3 + i} -2l2 ${3 + i % 2}l-${4 + i} 1z" fill="${W}" opacity=".8"/>`).join("");
  if (has("table") || has("desk") || has("workbench")) return `<rect x="${cx - u}" y="${cy - u * .5}" width="${u * 2}" height="${u}" fill="${F.wood}" stroke="${W}" stroke-width="1.4"/>`;
  if (has("bed") || has("cot") || has("bunk")) return `<rect x="${cx - u * .5}" y="${cy - u}" width="${u}" height="${u * 2}" fill="${F.carpet}" stroke="${W}" stroke-width="1.3"/><rect x="${cx - u * .4}" y="${cy - u * .9}" width="${u * .8}" height="${u * .4}" fill="${P.bg}" stroke="${W}" stroke-width=".8"/>`;
  if (has("chest") || has("treasure") || has("coffer")) return `<rect x="${cx - u * .45}" y="${cy - u * .32}" width="${u * .9}" height="${u * .64}" fill="${F.wood}" stroke="${W}" stroke-width="1.4"/><path d="M${cx - u * .45} ${cy - u * .05}h${u * .9}" stroke="${W}" stroke-width="1"/>`;
  if (has("trap") || has("glyph") || has("rune")) return `<rect x="${cx - u * .45}" y="${cy - u * .45}" width="${u * .9}" height="${u * .9}" fill="none" stroke="${P.accent}" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M${cx - u * .3} ${cy - u * .3}l${u * .6} ${u * .6}M${cx + u * .3} ${cy - u * .3}l-${u * .6} ${u * .6}" stroke="${P.accent}" stroke-width="1.6"/>`;
  if (has("tree") || has("fung") || has("mushroom") || has("plant")) return `<circle cx="${cx}" cy="${cy}" r="${u * .8}" fill="${P === YPAL.ink ? "#fff" : "#6f8f55"}" stroke="${W}" stroke-width="1.3"/><circle cx="${cx}" cy="${cy}" r="${u * .2}" fill="${W}"/>`;
  if (has("boulder") || has("rock") || has("stalag")) return `<path d="M${cx - u * .6} ${cy + u * .2}q${u * .1} -${u * .8} ${u * .7} -${u * .7}q${u * .6} 0 ${u * .5} ${u * .6}q-${u * .2} ${u * .5} -${u * .7} ${u * .4}q-${u * .5} 0 -${u * .5} -${u * .3}z" fill="${F.rock}" stroke="${W}" stroke-width="1.3"/>`;
  if (has("pit") || has("hole") || has("chasm") || has("shaft")) return `<circle cx="${cx}" cy="${cy}" r="${u * .9}" fill="${W}" opacity=".85"/><circle cx="${cx}" cy="${cy}" r="${u * .9}" fill="none" stroke="${W}" stroke-width="1.5"/>`;
  if (has("throne") || has("chair") || has("seat")) return `<rect x="${cx - u * .45}" y="${cy - u * .45}" width="${u * .9}" height="${u * .9}" fill="${F.carpet}" stroke="${W}" stroke-width="1.4"/><path d="M${cx - u * .45} ${cy - u * .3}h${u * .9}" stroke="${W}" stroke-width="2.2"/>`;
  if (has("crate") || has("cargo") || has("box") || has("barrel") || has("supplies")) return `<rect x="${cx - u * .7}" y="${cy - u * .4}" width="${u * .7}" height="${u * .7}" fill="${F.wood}" stroke="${W}" stroke-width="1.2"/><rect x="${cx + u * .05}" y="${cy - u * .2}" width="${u * .6}" height="${u * .6}" fill="${F.wood}" stroke="${W}" stroke-width="1.2"/>`;
  if (has("console") || has("panel") || has("computer") || has("terminal")) return `<rect x="${cx - u * .8}" y="${cy - u * .3}" width="${u * 1.6}" height="${u * .6}" fill="${F.metal}" stroke="${W}" stroke-width="1.4"/><circle cx="${cx - u * .4}" cy="${cy}" r="1.6" fill="${P.accent}"/><circle cx="${cx}" cy="${cy}" r="1.6" fill="${W}"/><circle cx="${cx + u * .4}" cy="${cy}" r="1.6" fill="${W}"/>`;
  if (has("helm")) return `<circle cx="${cx}" cy="${cy}" r="${u * .75}" fill="${F.crystal}" stroke="${W}" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="${u * .35}" fill="${F.carpet}" stroke="${W}" stroke-width="1.2"/>`;
  if (has("fire") || has("brazier") || has("hearth") || has("forge") || has("torch")) return `<circle cx="${cx}" cy="${cy}" r="${u * .45}" fill="${P === YPAL.ink ? "#fff" : "#e58a3a"}" stroke="${W}" stroke-width="1.4"/><path d="M${cx} ${cy - u * .25}l${u * .15} ${u * .35}h-${u * .3}z" fill="${W}"/>`;
  if (has("portal") || has("gate") || has("rift") || has("circle")) return `<ellipse cx="${cx}" cy="${cy}" rx="${u * .9}" ry="${u * .9}" fill="none" stroke="${P.accent}" stroke-width="2.2"/><ellipse cx="${cx}" cy="${cy}" rx="${u * .55}" ry="${u * .55}" fill="none" stroke="${P.accent}" stroke-width="1" stroke-dasharray="2 2"/>`;
  if (has("bone") || has("skull") || has("corpse") || has("remains")) return `<path d="M${cx - u * .45} ${cy - u * .3}l${u * .9} ${u * .6}M${cx + u * .45} ${cy - u * .3}l-${u * .9} ${u * .6}" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (has("cage") || has("cell") || has("bars")) { let s = `<rect x="${cx - u * .6}" y="${cy - u * .6}" width="${u * 1.2}" height="${u * 1.2}" fill="none" stroke="${W}" stroke-width="1.5"/>`; for (let i = 1; i < 4; i++) s += `<path d="M${cx - u * .6 + i * u * .3} ${cy - u * .6}v${u * 1.2}" stroke="${W}" stroke-width="1"/>`; return s; }
  if (has("web")) { let s = ""; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; s += `<path d="M${cx - Math.cos(a) * u} ${cy - Math.sin(a) * u}L${cx + Math.cos(a) * u} ${cy + Math.sin(a) * u}" stroke="${D}" stroke-width="1"/>`; } return s + `<circle cx="${cx}" cy="${cy}" r="${u * .5}" fill="none" stroke="${D}"/>`; }
  if (has("crystal") || has("gem") || has("shard")) return `<path d="M${cx} ${cy - u * .6}l${u * .4} ${u * .6}l-${u * .4} ${u * .6}l-${u * .4} -${u * .6}z" fill="${F.crystal}" stroke="${W}" stroke-width="1.3"/>`;
  if (has("machine") || has("engine") || has("generator") || has("drive") || has("golem")) return `<rect x="${cx - u * .8}" y="${cy - u * .6}" width="${u * 1.6}" height="${u * 1.2}" fill="${F.metal}" stroke="${W}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="${u * .35}" fill="none" stroke="${W}" stroke-width="1.5" stroke-dasharray="2 1.5"/>`;
  if (has("book") || has("shelf") || has("library") || has("scroll")) return `<rect x="${cx - u}" y="${cy - u * .25}" width="${u * 2}" height="${u * .5}" fill="${F.wood}" stroke="${W}" stroke-width="1.3"/><path d="M${cx - u * .5} ${cy - u * .25}v${u * .5}M${cx} ${cy - u * .25}v${u * .5}M${cx + u * .5} ${cy - u * .25}v${u * .5}" stroke="${W}" stroke-width=".8"/>`;
  return `<path d="M${cx} ${cy - u * .45}l${u * .45} ${u * .45}l-${u * .45} ${u * .45}l-${u * .45} -${u * .45}z" fill="${P.bg}" stroke="${W}" stroke-width="1.4"/>`;
}

// ---------- render ----------
// mode "full" is the map; "trace" is walls, doors and stairs only, on transparent,
// at the same size so it lines up with the full map.
export function renderLayout(forExport, mode = "full", selected = null) {
  const src = ysource();
  if (!src || !ystate.spec) return "";
  const trace = mode === "trace";
  const spec = ystate.spec, P = trace ? YPAL.ink : (YPAL[ystate.opts.style] || YPAL.parchment), u = YU, o = ystate.opts;
  const player = !!o.player;
  const L = composeLayout(src, spec);
  // the player version leaves secret passages out entirely
  const CORS = player ? L.corridors.filter(c => c.type !== "secret") : L.corridors;
  const isTrap = f => /trap|glyph|rune|secret|hidden/.test(f.type);
  const Wp = L.W * u, Hp = L.H * u;
  const fill = t => P.floor[t] || P.floor.stone;
  const parts = [];
  const idAttr = forExport ? "" : ` id="ymap" role="img" aria-label="Draft map of ${xesc(src.name)}"`;
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg"${idAttr} viewBox="0 0 ${Wp} ${Hp}" width="${Wp}" height="${Hp}" font-family="Georgia, 'Times New Roman', serif">`);
  parts.push(`<defs>${terrainPatterns(P)}</defs>`);
  const type = L.type, outside = effOutside(type, spec.outside);
  const geo = terrainGeom(L, spec);
  const { ops, doors } = buildOps(L, spec, CORS, type, player);
  if (trace) {
    // walls = (wall shapes) minus (floor shapes), via a mask, so floors stay transparent
    parts.push(`<mask id="ytrace" maskUnits="userSpaceOnUse" x="0" y="0" width="${Wp}" height="${Hp}"><rect width="${Wp}" height="${Hp}" fill="#000"/>${drawOps(ops, P, true)}</mask>`,
      `<rect width="${Wp}" height="${Hp}" fill="#111" mask="url(#ytrace)"/>`);
    // outdoor maps have few walls: trace clearings, paths and terrain as light guides
    ops.filter(o => o.op === "soft" || o.op === "path").forEach(o => parts.push(`<path d="${o.d}" fill="none" stroke="#888" stroke-width="1.5" stroke-dasharray="6 5"/>`));
    parts.push(terrainSVG(geo, P, true));
  }
  if (!trace) {
  // outside terrain
  parts.push(`<rect width="${Wp}" height="${Hp}" fill="${P.bg}"/>`);
  parts.push(`<rect x="${u}" y="${u * (YHEAD - 0.5)}" width="${Wp - u * 2}" height="${Hp - u * (YHEAD + 0.5)}" fill="${fill(outside)}"/>`);
  parts.push(`<rect x="${u}" y="${u * (YHEAD - 0.5)}" width="${Wp - u * 2}" height="${Hp - u * (YHEAD + 0.5)}" fill="url(#yp-${outside})"/>`);
  // underground panels sit in solid rock (fantasy; a ship's lower decks stay in space)
  if (L.split && store.setting !== "spelljammer" && type !== "ship") L.panels.filter(pn => pn.level < 0).forEach(pn => {
    const x0 = Math.max(u, pn.x * u), x1 = Math.min(Wp - u, (pn.x + pn.W) * u), y0 = u * (YHEAD - 0.5), h = Hp - u * (YHEAD + 0.5);
    parts.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${h}" fill="${fill("rock")}"/><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${h}" fill="url(#yp-rock)"/>`);
  });
  parts.push(`<rect x="${u}" y="${u * (YHEAD - 0.5)}" width="${Wp - u * 2}" height="${Hp - u * (YHEAD + 0.5)}" fill="none" stroke="${P.wall}" stroke-width="2"/>`);
  // terrain stays inside the map frame
  const frame = `x="${u}" y="${u * (YHEAD - 0.5)}" width="${Wp - u * 2}" height="${Hp - u * (YHEAD + 0.5)}"`;
  parts.push(`<clipPath id="yframe"><rect ${frame}/></clipPath><g clip-path="url(#yframe)">${terrainSVG(geo, P, false)}${scenerySVG(L, spec, type, geo, P)}</g>`);
  parts.push(drawOps(ops, P, false));
  parts.push(crossingsSVG(geo, CORS, P, Object.values(L.rects)));
  // grid
  if (o.grid) parts.push(`<rect x="${u}" y="${u * (YHEAD - 0.5)}" width="${Wp - u * 2}" height="${Hp - u * (YHEAD + 0.5)}" fill="url(#yp-grid)" pointer-events="none"/>`);
  }
  // 5 doors (every type), then stairs and one-way marks along passages
  doors.forEach(d => {
    const x = d.x * u, y = d.y * u, len = (d.len || 1) * u, th = u * .35;
    const box = d.dir === "v" ? `x="${x - th / 2}" y="${y - len / 2}" width="${th}" height="${len}"` : `x="${x - len / 2}" y="${y - th / 2}" width="${len}" height="${th}"`;
    if (d.type === "door" || d.type === "locked") parts.push(`<rect ${box} fill="${trace ? "#fff" : P.door}" stroke="${P.wall}" stroke-width="1.5"/>`);
    if (d.type === "locked") parts.push(`<circle cx="${x}" cy="${y}" r="${u * .22}" fill="${P.lock}" stroke="${P.wall}" stroke-width="1"/>`);
    if (d.type === "stairs" && !L.corridors.length) for (let k = -1; k <= 1; k++) parts.push(d.dir === "v"
      ? `<path d="M${x - th + k * 0} ${y + k * len * .25}h${th * 2}" stroke="${P.wall}" stroke-width="1.4"/>`
      : `<path d="M${x + k * len * .25} ${y - th}v${th * 2}" stroke="${P.wall}" stroke-width="1.4"/>`);
    if (d.type === "secret" && !player) parts.push(`<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="${u * .9}" font-weight="700" fill="${P.accent}" stroke="${trace ? "#fff" : P.bg}" stroke-width="3" paint-order="stroke">S</text>`);
  });
  // stairs between levels inside buildings and ships
  (L.stairs || []).forEach(st => parts.push(featureSVG({ type: "stairs" }, st.x * u, st.y * u, P)));
  CORS.forEach(c => {
    const len = c.width * u;
    // mid-run glyphs
    const seg = c.pts.length >= 4 ? [c.pts[1], c.pts[2]] : [c.pts[0], c.pts[c.pts.length - 1]];
    const longest = c.pts.slice(0, -1).map((p, i) => [p, c.pts[i + 1]]).sort((a, b) => Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1]) - Math.hypot(a[1][0] - a[0][0], a[1][1] - a[0][1]))[0] || seg;
    const [p, q] = longest, mx = (p[0] + q[0]) / 2 * u, my = (p[1] + q[1]) / 2 * u, horiz = Math.abs(q[0] - p[0]) > Math.abs(q[1] - p[1]);
    if (c.type === "stairs" || c.style === "stairs") {
      for (let i = -2; i <= 2; i++) parts.push(horiz
        ? `<path d="M${mx + i * u * .3} ${my - len / 2}v${len}" stroke="${P.wall}" stroke-width="1.3"/>`
        : `<path d="M${mx - len / 2} ${my + i * u * .3}h${len}" stroke="${P.wall}" stroke-width="1.3"/>`);
    }
    if (c.type === "oneway") {
      const dx = Math.sign(q[0] - p[0]), dy = Math.sign(q[1] - p[1]), s = u * .45;
      parts.push(`<path d="M${mx + dx * s} ${my + dy * s}L${mx - dx * s - dy * s} ${my - dy * s - dx * s}L${mx - dx * s + dy * s} ${my - dy * s + dx * s}Z" fill="${P.wall}"/>`);
    }
  });
  // level panels: dividers and titles, and where each cross-level stair leads
  if (L.split) {
    L.panels.forEach((pn, k) => {
      if (k > 0) parts.push(`<path d="M${pn.x * u} ${u * (YHEAD - 0.5)}V${Hp - u}" stroke="${P.wall}" stroke-width="2.5" stroke-dasharray="10 6"/>`);
      if (!trace) parts.push(`<text x="${(pn.x + 1.5) * u}" y="${(YHEAD + 1.4) * u}" font-size="${u * .95}" font-weight="700" fill="${P.ink}" stroke="${P.bg}" stroke-width="4" paint-order="stroke">${levelName(pn.level)}</text>`);
    });
    if (!trace || o.labels) L.stubs.forEach(st => {
      const [ex, ey] = st.end, off = { n: [0, -.7], s: [0, 1.3], e: [.4, .35], w: [-.4, .35] }[st.dir];
      const anchor = st.dir === "e" ? "start" : st.dir === "w" ? "end" : "middle";
      const txt = player ? (st.label[0] === "▲" ? "▲ up" : "▼ down") : st.label;
      parts.push(`<text x="${(ex + off[0]) * u}" y="${(ey + off[1]) * u}" text-anchor="${anchor}" font-size="11.5" font-weight="700" fill="${P.ink}" stroke="${trace ? "#fff" : P.bg}" stroke-width="3" paint-order="stroke">${txt}</text>`);
    });
  }
  // 6 features
  if (o.features) Object.values(L.rects).forEach(r => {
    const used = {};
    if (r.shape === "ring") parts.push(featureSVG({ type: "pit" }, (r.x + r.w / 2) * u, (r.y + r.h / 2) * u, P));
    (r.features || []).filter(f => !(player && isTrap(f))).forEach(f => {
      const [fx, fy] = YAT[f.at] || YAT.center, k = used[f.at] = (used[f.at] || 0) + 1;
      const off = k === 1 ? 0 : (k % 2 ? -1 : 1) * Math.ceil((k - 1) / 2) * 1.6;
      const cx = (r.x + 1 + fx * (r.w - 2) + off) * u, cy = (r.y + 1 + fy * (r.h - 2)) * u;
      parts.push(featureSVG(f, cx, cy, P));
      if (o.labels && !player && !trace && f.label) parts.push(`<text x="${cx}" y="${cy + u * 1.25}" text-anchor="middle" font-size="9.5" font-style="italic" fill="${P.muted}" stroke="${fill(r.floor)}" stroke-width="2.5" paint-order="stroke">${xesc(f.label)}</text>`);
    });
  });
  // 7 room labels + hit targets
  Object.values(L.rects).forEach(r => {
    const cx = (r.x + r.w / 2) * u, cy = (r.y + r.h / 2) * u;
    const sel = !forExport && selected === r.id;
    parts.push(forExport ? `<g>` : `<g class="yroom" data-yroom="${r.id}" tabindex="0" role="button" aria-label="Area ${r.id}: ${xesc(r.name)}">`);
    parts.push(`<rect x="${r.x * u}" y="${r.y * u}" width="${r.w * u}" height="${r.h * u}" fill="transparent"/>`);
 if (!player && (!trace || o.labels)) parts.push(`<circle cx="${r.x * u + u * .9}" cy="${r.y * u + u * .9}" r="${u * .62}" fill="${P.bg}" stroke="${P.wall}" stroke-width="1.6"/><text x="${r.x * u + u * .9}" y="${r.y * u + u * .9 + 4.2}" text-anchor="middle" font-size="12" font-weight="700" fill="${P.ink}">${r.id}</text>`);
    if (o.labels && !player && !trace) parts.push(`<text x="${cx}" y="${(r.y + r.h) * u - u * .45}" text-anchor="middle" font-size="12" font-weight="700" fill="${P.ink}" stroke="${fill(r.floor)}" stroke-width="3" paint-order="stroke">${xesc(r.name)}</text>`);
    if (sel) parts.push(`<rect class="ysel-ring" x="${r.x * u - 5}" y="${r.y * u - 5}" width="${r.w * u + 10}" height="${r.h * u + 10}" fill="none" stroke="#c0392b" stroke-width="2.5" stroke-dasharray="7 4" rx="4"/>`);
    parts.push(`</g>`);
  });
  // 8 title, compass, scale bar
  if (trace) { parts.push(`</svg>`); return parts.join(""); }
  parts.push(`<text x="${u * 1.2}" y="${u * 2.2}" font-size="${u * 1.4}" font-weight="700" fill="${P.ink}">${xesc(src.name)}</text>`);
  parts.push(`<text x="${u * 1.2}" y="${u * 3.2}" font-size="11" font-style="italic" fill="${P.muted}">${player ? "Player map" : "Draft layout"} · 1 square = 5 ft${player ? "" : ` · ${ystate.fromClaude ? "drafted with Claude" : "quick draft"}`}</text>`);
  const rot = { up: 0, right: 90, down: 180, left: 270 }[spec.north] || 0, ccx = Wp - u * 2.6, ccy = u * 2.1;
  parts.push(`<g transform="translate(${ccx} ${ccy}) rotate(${rot})"><circle r="${u * 1.25}" fill="${P.bg}" stroke="${P.wall}" stroke-width="1.5"/><path d="M0 -${u * 1.1}L${u * .35} 0L0 ${u * 1.1}L-${u * .35} 0Z" fill="${P.bg}" stroke="${P.wall}" stroke-width="1.2"/><path d="M0 -${u * 1.1}L${u * .35} 0L-${u * .35} 0Z" fill="${P.wall}"/><text y="-${u * 1.45}" text-anchor="middle" font-size="12" font-weight="700" fill="${P.ink}" transform="rotate(${-rot} 0 -${u * 1.6})">N</text></g>`);
  const sbx = u * 1.6, sby = Hp - u * 1.2;
  parts.push(`<rect x="${sbx - 6}" y="${sby - u * .9}" width="${u * 10 + 70}" height="${u * 1.5}" fill="${P.bg}" opacity=".9" rx="3"/>`);
  for (let i = 0; i < 10; i++) parts.push(`<rect x="${sbx + i * u}" y="${sby - u * .45}" width="${u}" height="${u * .45}" fill="${i % 2 ? P.bg : P.wall}" stroke="${P.wall}" stroke-width="1"/>`);
  parts.push(`<text x="${sbx + u * 10 + 8}" y="${sby}" font-size="11" fill="${P.ink}">50 ft</text>`);
  parts.push(`</svg>`);
  return parts.join("");
}
