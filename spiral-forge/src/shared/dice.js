// Dice and deterministic randomness.

// 1..n from the browser's crypto source, falling back to Math.random.
export const rnd = n => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % n); } catch { return 1 + Math.floor(Math.random() * n); } };
export const sum = (n, s) => { let t = 0; for (let i = 0; i < n; i++) t += rnd(s); return t; };

// "2d6+3" → { dice, add, total }, or null when the expression isn't dice.
export function rollDice(expr, maxDice = Infinity) {
  const p = /^(\d+)d(\d+)(?:([+-])(\d+))?$/.exec(expr || ""); if (!p) return null;
  const dice = Array.from({ length: Math.min(maxDice, +p[1]) }, () => rnd(+p[2]));
  const add = p[3] ? (p[3] === "-" ? -p[4] : +p[4]) : 0;
  return { dice, add, total: dice.reduce((a, b) => a + b, 0) + add };
}
// "[3, 4] + 2" style explanation of a roll, with the expression's minus sign typeset.
export const rollHow = (expr, r) => `${expr.replace("-", "−")}: [${r.dice.join(", ")}]${r.add ? (r.add > 0 ? " + " : " − ") + Math.abs(r.add) : ""}`;

// Average of "XdY + Z", rounded down; null if it isn't dice.
export const diceAvg = d => { const p = /^(\d+)d(\d+)(?:\s*([+\-−])\s*(\d+))?$/.exec(String(d).trim()); if (!p) return null; const add = p[3] ? (p[3] === "+" ? +p[4] : -p[4]) : 0; return Math.floor(+p[1] * (+p[2] + 1) / 2 + add); };

// FNV-1a hash of a string as base-36; used to fingerprint saved work and seed layouts.
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
// Seeded pseudo-random generator (mulberry32): the same seed always draws the same map.
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
