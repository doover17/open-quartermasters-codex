// Final map → Universal VTT (.dd2vtt): walls, doors, lights and sight-blocking
// objects from the layout, packaged with the attached Inkarnate map (or the
// draft map) as one zip. Roll20 imports it directly, Foundry with the Universal
// Battlemap Importer, Owlbear Rodeo with Smoke & Spectre.
import { $, statusSetter } from "../../shared/dom.js";
import { clampN } from "../../shared/sanitize.js";
import { ystate } from "../../app/state.js";
import { claude, loadScript } from "../../shared/claude.js";
import { YU, MAP_TYPES, ysource, ystem, composeLayout, computeLevels, roomPath, levelName, levelShort, effType } from "../../map/geometry.js";
import { renderLayout, YAT } from "../../map/render.js";
import { ysave } from "../layout.js";

// Walls come from the layout itself: floors are rasterised at VK cells per square,
// the floor/non-floor boundary is traced into closed loops, and the loops are
// simplified. Coordinates are in squares of the same sheet the PNG and tracing
// layer use, so they line up with an Inkarnate map traced from that layer.
const VK = 10;
let vimg = null;               // { url, w, h, name } of the attached Inkarnate map (memory only)
let vcache = { key: "", data: null };

function vttGeometry() {
  const src = ysource(); if (!src || !ystate.spec) return null;
  const keep = { ...ystate.opts };
  ystate.opts.player = false; // VTT gets every passage; secret ones are walled below
  const L = composeLayout(src, ystate.spec);
  ystate.opts = keep;
  const key = JSON.stringify([src.src, ystate.spec, ystate.moves, ystate.sizes, ystate.seed, ystate.levels, keep.level, keep.split]);
  if (vcache.key === key) return vcache.data;

  const W = L.W, H = L.H, cw = W * VK, ch = H * VK;
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#000"; cx.fillRect(0, 0, cw, ch);
  cx.setTransform(VK / YU, 0, 0, VK / YU, 0, 0);
  cx.fillStyle = "#fff"; cx.strokeStyle = "#fff"; cx.lineJoin = "miter"; cx.lineCap = "butt";
  Object.values(L.rects).forEach(r => cx.fill(new Path2D(roomPath(r))));
  L.corridors.forEach(c => {
    cx.lineWidth = c.width * YU;
    cx.beginPath(); c.pts.forEach(([x, y], i) => i ? cx.lineTo(x * YU, y * YU) : cx.moveTo(x * YU, y * YU)); cx.stroke();
  });
  const px = cx.getImageData(0, 0, cw, ch).data;
  const floor = (x, y) => x >= 0 && y >= 0 && x < cw && y < ch && px[(y * cw + x) * 4] > 127;

  // directed boundary edges, floor on the right, keyed by start vertex
  const out = new Map(), vk = (x, y) => y * (cw + 1) + x;
  const add = (x1, y1, x2, y2) => { const k = vk(x1, y1); (out.get(k) || out.set(k, []).get(k)).push([x2, y2]); };
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (!floor(x, y)) continue;
    if (!floor(x, y - 1)) add(x, y, x + 1, y);
    if (!floor(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!floor(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!floor(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops = [];
  for (const [k0, list] of out) {
    while (list.length) {
      let x = k0 % (cw + 1), y = Math.floor(k0 / (cw + 1));
      const pts = [[x, y]];
      let guard = 0;
      while (guard++ < 200000) {
        const nexts = out.get(vk(x, y)); if (!nexts || !nexts.length) break;
        const [nx, ny] = nexts.pop(); x = nx; y = ny; pts.push([x, y]);
        if (vk(x, y) === k0 && !(out.get(k0) || []).length) break;
        if (vk(x, y) === k0) break;
      }
      if (pts.length > 3) loops.push(pts);
    }
  }
  // simplify: drop collinear points, then Douglas–Peucker to smooth stair-stepped curves
  const dp = (pts, tol) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let idx = 0, dmax = 0;
    const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const d = L2 ? Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / Math.sqrt(L2) : Math.hypot(p[0] - a[0], p[1] - a[1]);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax <= tol) return [a, b];
    return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
  };
  const walls = loops.map(loop => {
    const c = [loop[0]];
    for (let i = 1; i < loop.length - 1; i++) {
      const [p, q, r] = [c[c.length - 1], loop[i], loop[i + 1]];
      if ((q[0] - p[0]) * (r[1] - q[1]) !== (q[1] - p[1]) * (r[0] - q[0])) c.push(q);
    }
    c.push(loop[loop.length - 1]);
    // split the closed loop at its farthest point so DP keeps the shape
    let far = 0, fd = 0; c.forEach((p, i) => { const d = Math.hypot(p[0] - c[0][0], p[1] - c[0][1]); if (d > fd) { fd = d; far = i; } });
    const s = [...dp(c.slice(0, far + 1), 1.0).slice(0, -1), ...dp(c.slice(far), 1.0)];
    return s.map(([x, y]) => ({ x: +(x / VK).toFixed(3), y: +(y / VK).toFixed(3) }));
  }).filter(w => w.length >= 2);

  // doors become portals; secret doors become a wall across the doorway
  const portals = [];
  L.corridors.forEach(c => {
    const d = c.door; if (!d || !["door", "locked", "secret"].includes(c.type)) return;
    const half = c.width / 2;
    const bounds = d.dir === "v" ? [{ x: d.x, y: d.y - half }, { x: d.x, y: d.y + half }] : [{ x: d.x - half, y: d.y }, { x: d.x + half, y: d.y }];
    if (c.type === "secret") walls.push(bounds);
    else portals.push({ position: { x: d.x, y: d.y }, bounds, rotation: d.dir === "v" ? Math.PI / 2 : 0, closed: true, freestanding: false });
  });

  // features: pillars/statues/boulders block sight; fires give light
  const objects = [], lights = [];
  Object.values(L.rects).forEach(r => {
    const used = {};
    (r.features || []).forEach(f => {
      const [fx, fy] = YAT[f.at] || YAT.center, k = used[f.at] = (used[f.at] || 0) + 1;
      const off = k === 1 ? 0 : (k % 2 ? -1 : 1) * Math.ceil((k - 1) / 2) * 1.6;
      const x = r.x + 1 + fx * (r.w - 2) + off, y = r.y + 1 + fy * (r.h - 2);
      if (/pillar|column|statue|idol|boulder|rock|stalag/.test(f.type)) {
        const s = /statue|idol/.test(f.type) ? .55 : .42;
        objects.push([{ x: x - s, y: y - s }, { x: x + s, y: y - s }, { x: x + s, y: y + s }, { x: x - s, y: y + s }, { x: x - s, y: y - s }]);
      }
      if (/fire|brazier|hearth|forge|torch|lava|magma|candle|lantern/.test(f.type))
        lights.push({ position: { x, y }, range: /lava|forge|hearth/.test(f.type) ? 6 : 4, intensity: 1, color: "ffffb46b", shadows: true });
    });
  });
  const data = { W, H, walls, portals, objects, lights };
  vcache = { key, data };
  return data;
}

// Image placement: the attached map covers the sheet starting at (ox, oy) squares,
// spanning W × scale squares across.
function vplace(g) {
  const o = ystate.vtt || {};
  const sc = (o.scale || 100) / 100, ox = o.ox || 0, oy = o.oy || 0;
  const iw = vimg ? vimg.w : g.W * YU, ih = vimg ? vimg.h : g.H * YU;
  const spanW = g.W * sc, spanH = spanW * ih / iw;
  return { ox, oy, spanW, spanH, ppg: iw / spanW, iw, ih };
}

export function drawVtt() {
  const card = document.getElementById("vttcard"); if (!card) return;
  ystate.vtt ||= { ox: 0, oy: 0, scale: 100, lights: true, objects: true };
  const vt = effType(ystate.spec);
  if (vt !== "dungeon" && vt !== "cavern") {
    document.getElementById("vinfo").textContent = `Wall export works for dungeon and cavern maps; this is a ${MAP_TYPES[vt].toLowerCase()} map. Switch the map type above to export walls.`;
    document.getElementById("vstage").innerHTML = ""; document.getElementById("btn-vexport").hidden = true;
    document.getElementById("valign").hidden = true; return;
  }
  const g = vttGeometry(); if (!g) return;
  const o = ystate.vtt, pl = vplace(g);
  document.getElementById("btn-vremove").hidden = !vimg;
  document.getElementById("valign").hidden = !vimg;
  document.getElementById("btn-vexport").hidden = !claude.downloads;
  document.getElementById("vopt-lights").checked = o.lights !== false;
  document.getElementById("vopt-objects").checked = o.objects !== false;
  ["ox", "oy"].forEach(k => { const el = document.getElementById("v" + k); if (document.activeElement !== el) el.value = o[k] || 0; });
  const scEl = document.getElementById("vscale"); if (document.activeElement !== scEl) scEl.value = o.scale || 100;
  const lvl = ystate.opts.level != null && ystate.opts.split !== false ? ` · ${levelName(ystate.opts.level)}` : "";
  const sheetPx = `${g.W}×${g.H} squares`;
  if (vimg) {
    const ratioSheet = g.W / g.H, ratioImg = vimg.w / vimg.h, off = Math.abs(ratioSheet - ratioImg) / ratioSheet;
    document.getElementById("vinfo").textContent = `${vimg.name}: ${vimg.w}×${vimg.h} px → ${pl.ppg.toFixed(1)} px per square. Sheet: ${sheetPx}${lvl}.` +
      (off > 0.01 ? ` Its shape differs from the sheet by ${(off * 100).toFixed(0)}%, so check the overlay and nudge offset or scale until the red walls sit on your walls.` : " Check that the red walls sit on your drawn walls; nudge offset or scale if not.");
  } else {
    document.getElementById("vinfo").textContent = `No map attached; the draft map will be used. Walls: ${g.walls.length} runs, ${g.portals.length} doors, ${g.lights.length} lights${lvl}. For a perfect fit, make your Inkarnate map from the tracing layer above (same size and pixels per square).`;
  }
  // overlay preview (in squares): image + walls in red, doors in blue, lights in amber
  const pts = w => w.map(p => `${p.x},${p.y}`).join(" ");
  const imgHref = vimg ? vimg.url : "data:image/svg+xml;charset=utf-8," + encodeURIComponent(renderLayout(true, "full"));
  document.getElementById("vstage").innerHTML = `<svg viewBox="0 0 ${g.W} ${g.H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${g.W}" height="${g.H}" fill="#ddd"/>
    <image href="${imgHref}" x="${pl.ox}" y="${pl.oy}" width="${pl.spanW}" height="${pl.spanH}" preserveAspectRatio="none" opacity="${vimg ? 1 : .55}"/>
    ${g.walls.map(w => `<polyline points="${pts(w)}" fill="none" stroke="#e0262b" stroke-width=".18" stroke-linejoin="round"/>`).join("")}
    ${o.objects !== false ? g.objects.map(w => `<polyline points="${pts(w)}" fill="none" stroke="#e0262b" stroke-width=".12"/>`).join("") : ""}
    ${g.portals.map(p => `<polyline points="${pts(p.bounds)}" stroke="#1f6fe0" stroke-width=".35" stroke-linecap="round"/>`).join("")}
    ${o.lights !== false ? g.lights.map(l => `<circle cx="${l.position.x}" cy="${l.position.y}" r="${l.range}" fill="#ffb46b" opacity=".18"/><circle cx="${l.position.x}" cy="${l.position.y}" r=".3" fill="#ff9a2e"/>`).join("") : ""}
  </svg>`;
}

const vsetStatus = statusSetter("vstatus");

// Forget the cached wall geometry (after the map type or level changes).
export function invalidateVtt() { vcache = { key: "", data: null }; }

const loadJSZip = () => loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", () => window.JSZip);
// Build the .dd2vtt: walls/doors/lights shifted into the image's own grid.
async function buildDd2vtt() {
  const g = vttGeometry(), pl = vplace(g), o = ystate.vtt || {};
  // VTTs read pixels_per_grid as a whole number, so the image is resampled to an
  // exact whole number of pixels per square; otherwise walls drift across big maps.
  const fitPpg = want => {
    let ppg = Math.max(10, Math.round(want));
    while (ppg > 10 && (ppg * pl.spanW) * (ppg * pl.spanH) > 16000000) ppg--; // phone canvas limit
    return ppg;
  };
  let ppg, img, srcW, srcH;
  if (vimg) {
    img = new Image(); img.src = vimg.url; await img.decode();
    srcW = vimg.w; srcH = vimg.h;
    ppg = fitPpg(vimg.w / pl.spanW);
  } else {
    const svg = renderLayout(true, "full");
    srcW = g.W * YU; srcH = g.H * YU;
    img = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ppg = fitPpg(ystate.opts.ppsq || 70);
  }
  const iw = Math.round(ppg * pl.spanW), ih = Math.round(ppg * pl.spanH);
  const cv = document.createElement("canvas"); cv.width = iw; cv.height = ih;
  const cx = cv.getContext("2d"); cx.imageSmoothingQuality = "high"; cx.drawImage(img, 0, 0, srcW, srcH, 0, 0, iw, ih);
  const base64 = cv.toDataURL("image/png").split(",")[1];
  const T = p => ({ x: +(p.x - pl.ox).toFixed(4), y: +(p.y - pl.oy).toFixed(4) });
  return {
    format: 0.3,
    resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: +(iw / ppg).toFixed(4), y: +(ih / ppg).toFixed(4) }, pixels_per_grid: ppg },
    line_of_sight: g.walls.map(w => w.map(T)),
    objects_line_of_sight: o.objects !== false ? g.objects.map(w => w.map(T)) : [],
    portals: g.portals.map(p => ({ ...p, position: T(p.position), bounds: p.bounds.map(T) })),
    environment: { baked_lighting: true, ambient_light: "ffffffff" },
    lights: o.lights !== false ? g.lights.map(l => ({ ...l, position: T(l.position) })) : [],
    image: base64,
  };
}

export function initVtt() {
  document.getElementById("btn-vattach").addEventListener("click", () => document.getElementById("vfile").click());
  document.getElementById("vfile").addEventListener("change", async e => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    try {
      await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
      if (vimg) URL.revokeObjectURL(vimg.url);
      vimg = { url, w: img.naturalWidth, h: img.naturalHeight, name: f.name, file: f };
      ystate.vtt = { ...(ystate.vtt || {}), ox: 0, oy: 0, scale: 100 }; ysave();
      vsetStatus("Map attached. It stays attached until you reload the page.");
    } catch { URL.revokeObjectURL(url); vsetStatus("That file couldn't be read as an image.", true); }
    drawVtt();
  });
  document.getElementById("btn-vremove").addEventListener("click", () => { if (vimg) URL.revokeObjectURL(vimg.url); vimg = null; vsetStatus(""); drawVtt(); });
  document.getElementById("btn-vfit").addEventListener("click", () => { ystate.vtt = { ...ystate.vtt, ox: 0, oy: 0, scale: 100 }; ysave(); drawVtt(); });
  [["vox", "ox"], ["voy", "oy"], ["vscale", "scale"]].forEach(([id, k]) => document.getElementById(id).addEventListener("input", e => {
    const v = parseFloat(e.target.value); if (!Number.isFinite(v)) return;
    ystate.vtt[k] = k === "scale" ? clampN(v, 25, 400) : clampN(v, -100, 100); ysave(); drawVtt();
  }));
  document.getElementById("vopt-lights").addEventListener("change", e => { ystate.vtt.lights = e.target.checked; ysave(); drawVtt(); });
  document.getElementById("vopt-objects").addEventListener("change", e => { ystate.vtt.objects = e.target.checked; ysave(); drawVtt(); });

  document.getElementById("btn-vexport").addEventListener("click", async () => {
    if (!claude.downloads || !ysource()) return;
    const src = ysource(), lv = computeLevels(src, ystate.spec), levels = [...new Set(Object.values(lv))];
    const allShown = levels.length > 1 && ystate.opts.split !== false && ystate.opts.level == null;
    // Universal VTT holds one image per file. An attached map belongs to one level, so
    // ask which; the draft map can be exported for every level at once.
    if (allShown && vimg) { vsetStatus("Pick the level this map is for with the level buttons above, then save.", true); return; }
    vsetStatus("Building the VTT file…");
    const keepLevel = ystate.opts.level;
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip(), base = ystem().replace(/-layout$/, "");
      const todo = allShown ? levels.sort((a, b) => b - a) : [ystate.opts.split !== false && levels.length > 1 ? keepLevel : null];
      let walls = 0, doors = 0, lights = 0, ppg = 0;
      for (const L of todo) {
        ystate.opts.level = L;
        const d = await buildDd2vtt();
        walls += d.line_of_sight.length; doors += d.portals.length; lights += d.lights.length; ppg = d.resolution.pixels_per_grid;
        zip.file(base + (L != null ? "-" + levelShort(L).toLowerCase() : "") + ".dd2vtt", JSON.stringify(d));
      }
      ystate.opts.level = keepLevel;
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const tag = !allShown && keepLevel != null && levels.length > 1 ? "-" + levelShort(keepLevel).toLowerCase() : "";
      await claude.downloads.save({ filename: base + tag + "-vtt.zip", data: blob });
      vsetStatus(`Saved${todo.length > 1 ? ` ${todo.length} levels, one .dd2vtt each` : ""}: ${walls} wall runs, ${doors} doors, ${lights} lights at ${ppg} px per square.`);
    } catch (e) {
      ystate.opts.level = keepLevel;
      vsetStatus(e?.code === "declined" ? "" : e?.message === "load failed" ? "Couldn't load the zip tool. Check your connection and try again." : "Couldn't build the VTT file here.", e?.code !== "declined");
    } finally { invalidateVtt(); drawVtt(); }
  });
}
