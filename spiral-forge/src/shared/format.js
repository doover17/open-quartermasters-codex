// Text formatting helpers.
export const cap = s => String(s || "").replace(/(^|[\s(-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
export const sgn = n => (n >= 0 ? "+" : "−") + Math.abs(n);
export const fmt = n => Math.round(n).toLocaleString("en-US");
export const crLabel = c => c === 0.125 ? "1/8" : c === 0.25 ? "1/4" : c === 0.5 ? "1/2" : String(c);
export const mod = s => Math.floor((s - 10) / 2);
export const pb = c => c < 5 ? 2 : Math.min(9, 2 + Math.ceil((c - 4) / 4));

// The "# Title" of a Markdown document, or a fallback.
export const docTitle = (md, fb) => ((md || "").match(/^#\s+(.+)$/m) || [])[1]?.trim() || fb;
// A safe file-name stem from a title.
export const slug = (name, fb) => (name || "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || fb;
export const fileStem = (md, fb) => slug((md.match(/^#\s+(.+)$/m) || [])[1], fb);
// Shorten a line of text at a word boundary.
export const cut = (t, n) => { t = (t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, "") + "…" : t; };

export const clone = o => JSON.parse(JSON.stringify(o));
export const newId = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
