// Helpers the three reference tabs (Bestiary, Items, Spells) share, and that the
// Loot and Encounters tabs borrow: dataset loading, the campaign excerpt for
// prompts, copying as Markdown, the unsaved-draft guard, and dice in prose.
import { esc, selectContents, logEntry } from "../../shared/dom.js";
import { rollDice, rollHow } from "../../shared/dice.js";
import { state, lstate } from "../../app/state.js";

// A dataset published beside index.html (monsters.json, items.json, spells.json).
export const fetchJson = name => fetch(name).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

export const opt = (v, t, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(t)}</option>`;

// The open campaign and location write-ups, for "Flavor it from my campaign".
export const campaignContext = (on, max) => on ? [state?.output, lstate?.output].filter(Boolean).join("\n\n").slice(0, max) : "";

// Copy Markdown to the clipboard, selecting the card for a manual copy when that's blocked.
export function copyMarkdown(md, cardEl, statusEl, noun) {
  const fallback = () => { selectContents(cardEl); statusEl.textContent = `Copy was blocked. The ${noun} is selected; copy it with your keyboard.`; };
  try { navigator.clipboard.writeText(md).then(() => { statusEl.textContent = "Copied."; }, fallback); } catch { fallback(); }
}

// Leaving an unsaved draft: first tap warns, second tap goes.
export function leaveGuard(statusEl, noun) {
  let armed = false;
  return () => {
    if (armed) { armed = false; return true; }
    armed = true; statusEl().textContent = `This variant isn't saved. Tap again to discard it, or press Save to my ${noun}.`;
    setTimeout(() => { armed = false; }, 6000);
    return false;
  };
}

// Dice in rules text become roll buttons; the text is then rendered as Markdown.
const diceMd = t => t.replace(/\b(\d+d\d+(?:\s*[+\-−]\s*\d+)?)\b/g, m => `<button type="button" class="dice" data-roll="${m.replace(/\s+/g, "").replace("−", "-")}">${m}</button>`);
export function mdWithDice(text, opts) {
  const src = diceMd(String(text || ""));
  try { if (window.marked && window.DOMPurify) return DOMPurify.sanitize(marked.parse(src, opts)); } catch {}
  return src.split(/\n{2,}/).map(p => `<p>${p}</p>`).join("");
}

// A plain roll (no crit or recharge rules) logged under a card.
export function logSimpleRoll(logEl, btn, name) {
  const r = rollDice(btn.dataset.roll, 100); if (!r) return;
  logEntry(logEl, `<span class="tot">${r.total}</span><span>${esc(name)}</span><span class="how">${esc(rollHow(btn.dataset.roll, r))}</span>`);
}
