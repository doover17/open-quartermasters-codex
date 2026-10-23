// Small DOM helpers shared by every page.
export const $ = id => document.getElementById(id);
export const svgNS = "http://www.w3.org/2000/svg";

// Escape text for HTML attribute and element content.
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// A status line: statusSetter("ystatus") gives (msg, err) => void.
export const statusSetter = id => (msg, err) => { const el = $(id); el.textContent = msg || ""; el.classList.toggle("err", !!err); };

export const smooth = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
export const narrow = () => matchMedia("(max-width: 920px)").matches;

// Select a node's contents so the user can copy by hand when the clipboard is blocked.
export function selectContents(el) {
  const r = document.createRange(); r.selectNodeContents(el);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}

// Prepend an entry to a roll log, keeping only the newest few.
export function logEntry(log, html, keep = 4) {
  const div = document.createElement("div");
  div.innerHTML = html;
  log.prepend(div); while (log.children.length > keep) log.lastChild.remove();
}

// Render Markdown through the page's sanitizer (marked + DOMPurify are loaded as classic scripts).
export const renderMarkdown = (md, opts) => DOMPurify.sanitize(marked.parse(md || "", opts));
