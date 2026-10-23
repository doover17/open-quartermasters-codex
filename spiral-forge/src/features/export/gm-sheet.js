// One-page GM sheet: the map with a condensed key, NPCs, secrets, encounters,
// treasure and hooks. The key comes straight from the location's Markdown, or
// Claude condenses it; the PDF is built with jsPDF.
import { $, statusSetter, renderMarkdown, esc as xesc } from "../../shared/dom.js";
import { cut } from "../../shared/format.js";
import { str } from "../../shared/sanitize.js";
import { ystate, jobs } from "../../app/state.js";
import { claude, claudeJson, loadScript } from "../../shared/claude.js";
import { anyBusy, setBusy } from "../../app/shell.js";
import { ysource, ystem } from "../../map/geometry.js";
import { renderLayout } from "../../map/render.js";
import { ysave } from "../layout.js";
import { svgToPng } from "./images.js";

// Pull a compact sheet straight from the location's Markdown (no Claude needed).
function autoSheet(src) {
  const d = document.createElement("div");
  d.innerHTML = renderMarkdown(src.body);
  const sec = {};
  let cur = null;
  [...d.children].forEach(el => {
    if (el.tagName === "H2") { cur = el.textContent.trim().toLowerCase(); sec[cur] = []; }
    else if (cur) sec[cur].push(el);
  });
  const find = re => Object.keys(sec).find(k => re.test(k));
  const lis = re => { const k = find(re); return k ? sec[k].flatMap(el => [...el.querySelectorAll("li")]) : []; };
  const glanceP = [...d.querySelectorAll("p")].find(p => /^at a glance/i.test(p.textContent.trim()));
  const areas = [];
  const ka = find(/keyed/);
  if (ka) {
    let a = null;
    sec[ka].forEach(el => {
      if (el.tagName === "H3") {
        const m = el.textContent.trim().match(/^(\d+)[.):\s]+(.*)$/);
        a = { id: m ? +m[1] : areas.length + 1, name: m ? m[2] : el.textContent.trim(), parts: [] }; areas.push(a);
      } else if (a) {
        if (el.tagName === "UL" || el.tagName === "OL") el.querySelectorAll("li").forEach(li => a.parts.push(li.textContent.trim()));
        else if (el.tagName === "P" && !el.querySelector("em") && el.textContent.trim()) a.parts.push(el.textContent.trim());
      }
    });
  }
  const enc = (() => {
    const k = find(/encounter/); if (!k) return [];
    const rows = sec[k].flatMap(el => [...el.querySelectorAll("tbody tr")]);
    if (rows.length) return rows.map(r => cut([...r.children].slice(1).map(c => c.textContent).join(" "), 90));
    return sec[k].flatMap(el => [...el.querySelectorAll("li")]).map(li => cut(li.textContent, 90));
  })();
  return {
    glance: glanceP ? glanceP.textContent.replace(/^at a glance:?\s*/i, "").trim() : "",
    areas: areas.map(a => ({ id: a.id, name: a.name, key: cut(a.parts.join("; "), 210) })),
    npcs: lis(/npc/).map(li => { const b = li.querySelector("strong, b"); const name = b ? b.textContent.trim() : ""; return { name, line: cut(li.textContent.replace(name, "").replace(/^[\s—–-]+/, ""), 150) }; }),
    secrets: lis(/secret/).map(li => cut(li.textContent, 130)),
    encounters: enc,
    treasure: lis(/treasure/).map(li => cut(li.textContent, 110)),
    hooks: lis(/hook/).map(li => cut(li.textContent, 110)),
  };
}
function sheetData(src) {
  const sh = ystate.sheet;
  return sh && sh.src === src.src && sh.data ? sh.data : autoSheet(src);
}
const usingClaudeSheet = src => !!(ystate.sheet && ystate.sheet.src === src.src && ystate.sheet.data);

// Map for the sheet: always the GM version with every level, whatever the screen shows.
function sheetMapSVG() {
  const keep = { ...ystate.opts };
  Object.assign(ystate.opts, { player: false, level: null, labels: true, features: true });
  const svg = renderLayout(true, "full");
  ystate.opts = keep;
  return svg;
}

export function drawSheet() {
  const src = ysource(); if (!src || !ystate.spec) return;
  const data = sheetData(src), byClaude = usingClaudeSheet(src);
  document.querySelectorAll("[data-paper]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.paper === (ystate.opts.paper || "letter"))));
  document.getElementById("btn-stighten").hidden = !claude.sample;
  document.getElementById("btn-stighten").disabled = anyBusy();
  document.getElementById("btn-sauto").hidden = !byClaude;
  document.getElementById("btn-spdf").hidden = !claude.downloads;
  const e = xesc, sec = (t, items) => items.length ? `<h4>${t}</h4>${items.join("")}` : "";
  document.getElementById("sheet-preview").innerHTML = `
    <h3>${e(src.name)}</h3>
    ${data.glance ? `<div class="glance">${e(data.glance)}</div>` : ""}
    <div class="smap">${sheetMapSVG()}</div>
    <div class="cols">
      ${sec("Key", data.areas.map(a => `<p><b>${a.id}. ${e(a.name)}.</b> ${e(a.key)}</p>`))}
      ${sec("NPCs", data.npcs.map(n => `<p><b>${e(n.name)}</b> ${e(n.line)}</p>`))}
      ${sec("Secrets and clues", data.secrets.map((t, i) => `<p>${i + 1}. ${e(t)}</p>`))}
      ${sec("Random encounters (d6)", data.encounters.slice(0, 6).map((t, i) => `<p>${i + 1}. ${e(t)}</p>`))}
      ${sec("Treasure", data.treasure.map(t => `<p>• ${e(t)}</p>`))}
      ${sec("Hooks", data.hooks.map(t => `<p>• ${e(t)}</p>`))}
    </div>
    <div class="pages" id="sheet-pages"></div>`;
}

const ssetStatus = statusSetter("sstatus");

// ---------- PDF ----------
const loadJsPDF = () => loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => window.jspdf?.jsPDF, "jsPDF missing");
// PDF standard fonts only cover Windows-1252; swap anything else for a plain lookalike.
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function pdfText(t) {
  return String(t || "").replace(/[−‐‑‒]/g, "-").replace(/[→⇒]/g, "->").replace(/[←]/g, "<-").replace(/▲/g, "up").replace(/▼/g, "down").replace(/[×✕]/g, "x")
    .replace(/[^\x00-\xff]/g, ch => CP1252_EXTRA.includes(ch) ? ch : (ch.normalize("NFKD").replace(/[^\x00-\xff]/g, "") || "?"));
}

export function initGmSheet() {
  document.getElementById("gmsheet").addEventListener("click", e => {
    const pp = e.target.closest("[data-paper]")?.dataset.paper;
    if (pp) { ystate.opts.paper = pp; ysave(); drawSheet(); }
  });
  document.getElementById("btn-sauto").addEventListener("click", () => { ystate.sheet = null; ysave(); drawSheet(); ssetStatus("Using text straight from the location."); });
  document.getElementById("btn-stighten").addEventListener("click", async () => {
    const src = ysource(); if (!src || !claude.sample || anyBusy()) return;
    jobs.sheet = new AbortController(); setBusy(true); drawSheet();
    ssetStatus("Claude is condensing the key to fit one page…");
    const n = src.map.areas.length, words = n > 9 ? 18 : n > 6 ? 24 : 32;
    const prompt = `Condense this tabletop RPG location into a one-page GM cheat sheet that sits under its map. Keep every fact a GM needs at the table (creatures, DCs, hazards, treasure, exits that matter) and drop flavor. Use short fragments, not full sentences. Keep proper names exactly as written.

  THE LOCATION
  ${src.body}

  Reply with JSON only, in exactly this shape:
  {"glance":"<one line, at most 18 words>","areas":[{"id":1,"name":"<as written>","key":"<at most ${words} words>"}],"npcs":[{"name":"<name>","line":"<at most 16 words: role, want, secret>"}],"secrets":["<at most 14 words>"],"encounters":["<6 entries, at most 10 words each>"],"treasure":["<at most 12 words>"],"hooks":["<at most 12 words>"]}
  Include every keyed area in number order (${n} areas), every named NPC, all six secrets, six encounters, and at most 4 treasure and 3 hooks.`;
    try {
      const raw = await claudeJson(prompt, { signal: jobs.sheet.signal, cache: false });
      if (!raw || !Array.isArray(raw.areas)) throw { code: "bad" };
      ystate.sheet = { src: src.src, data: {
        glance: str(raw.glance),
        areas: raw.areas.map((a, i) => ({ id: +a.id || i + 1, name: str(a.name) || `Area ${i + 1}`, key: str(a.key) })),
        npcs: (raw.npcs || []).map(x => ({ name: str(x.name), line: str(x.line) })),
        secrets: (raw.secrets || []).map(str).filter(Boolean),
        encounters: (raw.encounters || []).map(str).filter(Boolean),
        treasure: (raw.treasure || []).map(str).filter(Boolean),
        hooks: (raw.hooks || []).map(str).filter(Boolean),
      } };
      ysave(); ssetStatus("Condensed. Check the preview, then save the PDF.");
    } catch (err) {
      ssetStatus(err.code === "cancelled" ? "Stopped." : err.code === "rate_limited" ? "Too many requests right now. Wait a minute and try again."
        : err.code === "bad" || err instanceof SyntaxError ? "Claude's reply couldn't be used. Try again." : "Something went wrong reaching Claude. Try again.", err.code !== "cancelled");
    } finally { jobs.sheet = null; setBusy(false); drawSheet(); }
  });

  document.getElementById("btn-spdf").addEventListener("click", async () => {
    const src = ysource(); if (!src || !claude.downloads) return;
    ssetStatus("Building the PDF…");
    try {
      const JsPDF = await loadJsPDF();
      const paper = ystate.opts.paper === "a4" ? "a4" : "letter";
      const pdf = new JsPDF({ unit: "pt", format: paper, orientation: "portrait" });
      const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight(), M = 30;
      const data = sheetData(src);
      // header
      pdf.setFont("times", "bold"); pdf.setFontSize(17); pdf.setTextColor(20);
      pdf.text(pdfText(src.name), M, M + 12);
      let y = M + 20;
      if (data.glance) { pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(90); const gl = pdf.splitTextToSize(pdfText(data.glance), PW - 2 * M); pdf.text(gl, M, y + 6); y += gl.length * 9.5 + 2; }
      // map: GM version, every level, fit to width and at most ~42% of the page
      const map = await svgToPng(sheetMapSVG(), 2400);
      const maxW = PW - 2 * M, maxH = PH * 0.42;
      const k = Math.min(maxW / map.w, maxH / map.h), mw = map.w * k, mh = map.h * k;
      pdf.addImage(map.data, "PNG", M + (maxW - mw) / 2, y + 4, mw, mh);
      y += mh + 12;
      // two columns of text that flow onto a second page if needed
      const gap = 16, colW = (PW - 2 * M - gap) / 2, top0 = y;
      let col = 0, cy = y, page = 1, top = top0;
      const bottom = PH - M;
      const nextCol = () => {
        if (col === 0) { col = 1; cy = top; }
        else { pdf.addPage(paper, "portrait"); page++; col = 0; top = M; cy = M; }
      };
      const x = () => M + col * (colW + gap);
      const head = t => {
        if (cy + 22 > bottom) nextCol();
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(122, 42, 31);
        pdf.text(pdfText(t.toUpperCase()), x(), cy + 9); cy += 13;
      };
      const para = (bold, rest) => {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.2);
        const full = pdfText((bold ? bold + " " : "") + rest);
        const lines = pdf.splitTextToSize(full, colW);
        const lh = 9.8;
        if (cy + lines.length * lh > bottom) nextCol();
        // bold lead-in on the first line, then the rest in regular weight
        lines.forEach((ln, i) => {
          const ly = cy + 8 + i * lh;
          if (i === 0 && bold && ln.startsWith(pdfText(bold) + " ")) {
            const b = pdfText(bold);
            pdf.setFont("helvetica", "bold"); pdf.setTextColor(20); pdf.text(b, x(), ly);
            const bw = pdf.getTextWidth(b) + 3;
            pdf.setFont("helvetica", "normal"); pdf.setTextColor(35); pdf.text(ln.slice(b.length + 1), x() + bw, ly);
          } else { pdf.setFont("helvetica", "normal"); pdf.setTextColor(35); pdf.text(ln, x(), ly); }
        });
        cy += lines.length * lh + 2.5;
      };
      const block = (title, rows) => { if (!rows.length) return; head(title); rows.forEach(r => para(r[0], r[1])); cy += 4; };
      block("Key", data.areas.map(a => [`${a.id}. ${a.name}.`, a.key]));
      block("NPCs", data.npcs.map(n => [n.name, n.line]));
      block("Secrets and clues", data.secrets.map((t, i) => [`${i + 1}.`, t]));
      block("Random encounters (d6)", data.encounters.slice(0, 6).map((t, i) => [`${i + 1}.`, t]));
      block("Treasure", data.treasure.map(t => ["", "- " + t]));
      block("Hooks", data.hooks.map(t => ["", "- " + t]));
      // footer
      for (let i = 1; i <= page; i++) {
        pdf.setPage(i); pdf.setFont("helvetica", "italic"); pdf.setFontSize(6.5); pdf.setTextColor(140);
        pdf.text(pdfText(`${src.name} · GM sheet${page > 1 ? ` · page ${i} of ${page}` : ""}`), M, PH - 14);
      }
      const blob = pdf.output("blob");
      await claude.downloads.save({ filename: ystem().replace(/-layout$/, "") + "-gm-sheet.pdf", data: blob });
      ssetStatus(page > 1
        ? `Saved. It runs to ${page} pages${claude.sample && !usingClaudeSheet(src) ? "; Tighten with Claude to fit it on one" : ""}.`
        : "Saved a one-page PDF.", false);
    } catch (e) {
      ssetStatus(e?.code === "declined" ? "" : (e?.message === "load failed" ? "Couldn't load the PDF tool. Check your connection and try again." : "Couldn't build the PDF here."), e?.code !== "declined");
    }
  });
}
