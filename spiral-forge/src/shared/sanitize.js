// Coercions for untrusted values: saved state, backup files, and Claude's replies.
export const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
export const str = (v, d = "") => typeof v === "string" ? v : d;
export const httpsUrl = u => typeof u === "string" && /^https:\/\//i.test(u) ? u : "";
// Trimmed text capped at n characters; "" for anything that isn't a string.
export const textMax = (v, n = 400) => typeof v === "string" ? v.trim().slice(0, n) : "";
// Text capped at n characters without trimming.
export const clip = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
export const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// A whole number within [lo, hi], or the default when it isn't a number.
export const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
