// The Location page's wireframe map: the ```json block at the end of Claude's
// write-up, parsed and drawn as boxes and links, plus the layout's view of it.
import { $, svgNS } from "../shared/dom.js";
import { lstate, jobs } from "../app/state.js";

// ---------- map ----------
// Pull the trailing ```json block out of Claude's Markdown and validate it.
export function splitMap(md) {
  const at = md.lastIndexOf("```json");
  if (at < 0) return { body: md, map: null };
  let body = md.slice(0, at).replace(/\n#{1,3}\s*Map\s*\n*$/i, "\n").trimEnd();
  const end = md.indexOf("```", at + 7);
  if (end < 0) return { body, map: null, pending: true };
  try {
    const raw = JSON.parse(md.slice(at + 7, end));
    const used = new Set();
    const areas = (raw.areas || []).filter(a => Number.isFinite(+a.id)).map(a => {
      let x = Math.max(0, Math.min(9, Math.round(+a.x || 0))), y = Math.max(0, Math.min(9, Math.round(+a.y || 0)));
      while (used.has(x + "," + y)) { x++; if (x > 9) { x = 0; y++; } } // nudge collisions apart
      used.add(x + "," + y);
      return { id: +a.id, name: String(a.name || "Area " + a.id).slice(0, 40), x, y, kind: String(a.kind || "room").toLowerCase() };
    });
    const ids = new Set(areas.map(a => a.id));
    const links = (raw.links || []).filter(l => ids.has(+l.from) && ids.has(+l.to) && +l.from !== +l.to)
      .map(l => ({ from: +l.from, to: +l.to, type: String(l.type || "open").toLowerCase() }));
    return { body, map: areas.length ? { areas, links } : null };
  } catch { return { body, map: null }; }
}

export const lmap = document.getElementById("lmap");
const mapLegend = document.getElementById("map-legend");
const CELL_W = 120, CELL_H = 86, BOX_W = 102, BOX_H = 58, PAD = 14;

function wrapName(name, max = 15) {
  const words = name.split(/\s+/), lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + " " + w).length <= max) lines[lines.length - 1] = cur + " " + w;
    else lines.push(w);
  }
  if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].slice(0, max - 1) + "…"; }
  return lines.map(l => l.length > max + 2 ? l.slice(0, max) + "…" : l);
}

export function drawMap(map) {
  lmap.innerHTML = "";
  const scroll = document.getElementById("map-scroll");
  scroll.querySelector(".map-empty")?.remove();
  if (!map) {
    lmap.style.display = "none"; mapLegend.hidden = true;
    const msg = document.createElement("div");
    msg.className = "map-empty";
    msg.textContent = lstate.output
      ? "This version has no readable map. Ask for one in Flesh it out, e.g. \"redraw the map\"."
      : (jobs.location ? "The map draws when Claude finishes writing." : "Your map appears here after you build the location.");
    scroll.appendChild(msg);
    document.getElementById("map-note").hidden = true;
    return;
  }
  lmap.style.display = ""; mapLegend.hidden = false; document.getElementById("map-note").hidden = false;
  requestAnimationFrame(() => {
    const wide = scroll.scrollWidth > scroll.clientWidth + 4;
    document.getElementById("map-note").textContent = wide ? "Swipe sideways to see it all. Tap an area to jump to it." : "Tap an area to jump to it.";
  });
  const minX = Math.min(...map.areas.map(a => a.x)), minY = Math.min(...map.areas.map(a => a.y));
  const cols = Math.max(...map.areas.map(a => a.x)) - minX + 1, rows = Math.max(...map.areas.map(a => a.y)) - minY + 1;
  const W = cols * CELL_W + PAD * 2 - (CELL_W - BOX_W), H = rows * CELL_H + PAD * 2 - (CELL_H - BOX_H);
  lmap.setAttribute("viewBox", `0 0 ${W} ${H}`);
  lmap.setAttribute("width", W); lmap.setAttribute("height", H);
  const pos = {};
  map.areas.forEach(a => { pos[a.id] = { x: PAD + (a.x - minX) * CELL_W + BOX_W / 2, y: PAD + (a.y - minY) * CELL_H + BOX_H / 2 }; });
  const el = (tag, attrs, parent = lmap) => {
    const n = document.createElementNS(svgNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n); return n;
  };
  // faint grid dots
  for (let c = 0; c <= cols; c++) for (let r = 0; r <= rows; r++)
    el("circle", { cx: PAD - (CELL_W - BOX_W) / 2 + c * CELL_W, cy: PAD - (CELL_H - BOX_H) / 2 + r * CELL_H, r: 1.3, class: "grid-dot" });

  // where a line from a box's center toward (dx,dy) leaves the box
  const edge = (p, dx, dy) => {
    const tx = dx ? (BOX_W / 2) / Math.abs(dx) : Infinity, ty = dy ? (BOX_H / 2) / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty); return { x: p.x + dx * t, y: p.y + dy * t };
  };
  const links = el("g", {});
  map.links.forEach(l => {
    const a = pos[l.from], b = pos[l.to];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const p1 = edge(a, ux, uy), p2 = edge(b, -ux, -uy);
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, nx = -uy, ny = ux;
    if (l.type === "stairs") {
      el("line", { x1: p1.x + nx * 3, y1: p1.y + ny * 3, x2: p2.x + nx * 3, y2: p2.y + ny * 3, class: "lk" }, links);
      el("line", { x1: p1.x - nx * 3, y1: p1.y - ny * 3, x2: p2.x - nx * 3, y2: p2.y - ny * 3, class: "lk" }, links);
      for (let t = 0.3; t <= 0.71; t += 0.2) { const sx = p1.x + (p2.x - p1.x) * t, sy = p1.y + (p2.y - p1.y) * t;
        el("line", { x1: sx + nx * 4, y1: sy + ny * 4, x2: sx - nx * 4, y2: sy - ny * 4, class: "lk" }, links); }
    } else {
      const endX = l.type === "oneway" ? p2.x - ux * 7 : p2.x, endY = l.type === "oneway" ? p2.y - uy * 7 : p2.y;
      el("line", { x1: p1.x, y1: p1.y, x2: endX, y2: endY, class: "lk" + (l.type === "secret" ? " secret" : "") }, links);
    }
    if (l.type === "door" || l.type === "locked")
      el("line", { x1: mx + nx * 7, y1: my + ny * 7, x2: mx - nx * 7, y2: my - ny * 7, class: "lk door" }, links);
    if (l.type === "locked") el("circle", { cx: mx, cy: my, r: 3.4, class: "lock" }, links);
    if (l.type === "oneway") {
      const tip = p2, bx = tip.x - ux * 9, by = tip.y - uy * 9;
      el("path", { d: `M${tip.x} ${tip.y} L${bx + nx * 5} ${by + ny * 5} L${bx - nx * 5} ${by - ny * 5} Z`, class: "arrow" }, links);
    }
  });
  const kinds = new Set(["entrance", "room", "hall", "cave", "shrine", "lair", "vault", "hazard", "exterior"]);
  map.areas.forEach(a => {
    const p = pos[a.id], k = kinds.has(a.kind) ? a.kind : "room";
    const g = el("g", { class: "area " + k, tabindex: "0", role: "button", "data-area": a.id, "aria-label": `Area ${a.id}: ${a.name}` });
    el("title", {}, g).textContent = `${a.id}. ${a.name}`;
    const r = (k === "cave" || k === "exterior") ? 18 : 6;
    el("rect", { x: p.x - BOX_W / 2, y: p.y - BOX_H / 2, width: BOX_W, height: BOX_H, rx: r, ry: r }, g);
    el("text", { x: p.x - BOX_W / 2 + 8, y: p.y - BOX_H / 2 + 15, class: "num" }, g).textContent = a.id;
    if (k !== "room") el("text", { x: p.x + BOX_W / 2 - 8, y: p.y - BOX_H / 2 + 14, "text-anchor": "end", class: "kind" }, g).textContent = k;
    const lines = wrapName(a.name);
    lines.forEach((ln, i) => {
      el("text", { x: p.x, y: p.y + 9 + (i - (lines.length - 1) / 2) * 13, "text-anchor": "middle", class: "nm" }, g).textContent = ln;
    });
  });
}

// Tap an area on the map → scroll its keyed entry into view.
function jumpToArea(id) {
  const h = [...$("ldoc").querySelectorAll("h3")].find(h => new RegExp("^\\s*" + id + "[.):\\s]").test(h.textContent));
  if (!h) return;
  h.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  h.classList.add("flash"); setTimeout(() => h.classList.remove("flash"), 1300);
}

export function initWireframe() {
  lmap.addEventListener("click", e => { const g = e.target.closest("[data-area]"); if (g) jumpToArea(+g.dataset.area); });
  lmap.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const g = e.target.closest("[data-area]"); if (g) { e.preventDefault(); jumpToArea(+g.dataset.area); }
  });
}

// The map as a standalone SVG document with the current theme's colors baked in.
export function wireframeSvgDocument() {
    const clone = lmap.cloneNode(true), cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    const css = `text{font-family:Georgia,serif}.grid-dot{fill:${v("--line")}}.lk{stroke:${v("--muted")};stroke-width:2.2;fill:none;stroke-linecap:round}
  .lk.door{stroke:${v("--ink")};stroke-width:3}.lk.secret{stroke:${v("--accent")};stroke-dasharray:5 4}.lock{fill:${v("--brass")};stroke:${v("--panel")}}
  .arrow{fill:${v("--muted")}}.area rect{fill:${v("--bg")};stroke:${v("--ink")};stroke-width:1.6}.area.entrance rect{stroke:${v("--accent")};stroke-width:3}
  .area.lair rect{stroke:${v("--ring3")};stroke-width:2.4}.area.vault rect{stroke:${v("--brass")};stroke-width:2.4}.area.hazard rect{stroke-dasharray:4 3}
  .area.exterior rect{stroke-dasharray:1.5 3}.num{font-family:monospace;font-weight:700;font-size:12px;fill:${v("--brass")}}
  .nm{font-size:11.5px;fill:${v("--ink")}}.kind{font-size:9.5px;fill:${v("--muted")};letter-spacing:.06em;text-transform:uppercase}`;
    clone.setAttribute("xmlns", svgNS);
    const style = document.createElementNS(svgNS, "style"); style.textContent = css; clone.prepend(style);
    const bg = document.createElementNS(svgNS, "rect");
    bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", v("--panel"));
    clone.insertBefore(bg, style.nextSibling);
  return new XMLSerializer().serializeToString(clone);
}
