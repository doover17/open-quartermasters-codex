// Layout exports as pictures: SVG, PNG at a chosen pixels-per-square, and the
// tracing layer. Also the SVG-to-PNG rasteriser the GM sheet uses.
import { statusSetter } from "../../shared/dom.js";
import { ystate } from "../../app/state.js";
import { claude } from "../../shared/claude.js";
import { YU, ystem, levelShort } from "../../map/geometry.js";
import { renderLayout } from "../../map/render.js";

const ysetStatus = statusSetter("ystatus");

// Browsers cap canvas size (iOS Safari at about 16.7 million pixels), so big maps
// at high resolution are scaled down to fit and the status says so.
async function exportPNG(mode) {
  const want = ystate.opts.ppsq || 70;
  ysetStatus(mode === "trace" ? "Rendering tracing layer…" : "Rendering PNG…");
  try {
    const svg = renderLayout(true, mode);
    const m = svg.match(/width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/);
    const w = +m[1], h = +m[2];
    let scale = want / YU;
    const maxScale = Math.min(Math.sqrt(16000000 / (w * h)), 16000 / Math.max(w, h));
    const capped = scale > maxScale;
    if (capped) scale = maxScale;
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
    const cx = cv.getContext("2d"); cx.scale(scale, scale); cx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise(res => cv.toBlob(res, "image/png"));
    const suffix = (ystate.opts.level != null && ystate.opts.split !== false ? "-" + levelShort(ystate.opts.level).toLowerCase() : "") + (mode === "trace" ? "-tracing" : "") + (ystate.opts.player ? "-player" : "");
    await claude.downloads.save({ filename: ystem() + suffix + ".png", data: blob });
    const got = Math.round(scale * YU);
    ysetStatus(`Saved a ${cv.width}×${cv.height} PNG at ${got} px per square.` + (capped ? ` This map is too big for ${want} px per square on this device, so it was scaled down; try a smaller setting or the SVG.` : ""), capped);
  } catch (e) { ysetStatus(e?.code === "declined" ? "" : "Couldn't save the PNG here. Try Save SVG.", e?.code !== "declined"); }
}

export async function svgToPng(svg, targetW) {
  const m = svg.match(/width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/), w = +m[1], h = +m[2];
  const scale = Math.min(targetW / w, Math.sqrt(16000000 / (w * h)));
  const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const cv = document.createElement("canvas"); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
  const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.scale(scale, scale); cx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  return { data: cv.toDataURL("image/png"), w, h };
}

export function initImageExports() {
  document.getElementById("btn-ysvg").addEventListener("click", async () => {
    try { await claude.downloads.save({ filename: ystem() + (ystate.opts.player ? "-player" : "") + ".svg", data: renderLayout(true) }); ysetStatus("Saved."); }
    catch (e) { ysetStatus(e.code === "declined" ? "" : "Couldn't save the file here.", e.code !== "declined"); }
  });
  document.getElementById("btn-ypng").addEventListener("click", () => exportPNG("full"));
  document.getElementById("btn-ytrace").addEventListener("click", () => exportPNG("trace"));
}
