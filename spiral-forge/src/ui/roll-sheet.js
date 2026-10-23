// The roll-sheet widgets shared by the Campaign and Location pages: one slot per
// d100 table, with a number box for the die roll and a text box for the result.
import { T } from "../app/state.js";

export function slotHTML(id, table, label, minor, defs) {
  defs[id] = table;
  const n = T[table].length;
  return `<div class="slot${minor ? " minor" : ""}">
    ${label ? `<span class="lbl">${label}</span>` : ""}
    <span class="die">d${n}</span>
    <input type="number" id="n-${id}" min="0" max="${n}" inputmode="numeric" aria-label="${label || table} roll (1 to ${n})" placeholder="–">
    <input type="text" id="t-${id}" aria-label="${label || table} result" placeholder="Roll or write your own">
    <button type="button" class="roll-btn" data-roll="${id}" title="Virtual d${n}">roll</button>
  </div>`;
}

// Percentile dice read "00" as 100. Interpret 0/00 as the top of the table, without
// rewriting the field mid-typing (so "05" still works); tidy the display on change.
export function readRoll(raw, max) {
  let n = parseInt(raw, 10);
  if (n === 0 && String(raw).trim() !== "") n = max;
  return Number.isFinite(n) && n >= 1 && n <= max ? n : null;
}

// A virtual roll on a table: 1..length.
export const virtualRoll = table => 1 + Math.floor(Math.random() * T[table].length);
