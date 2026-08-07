# Style Guide

How Codex entries sound and look. The goal of every rule here is Pillar 1: **an entry must be scannable in under 10 seconds.**

## Voice

- Write for the DM at the table mid-session, not for the reader at home.
- Present tense, second person where a person is implied ("You can...", not "The character may...").
- Concrete over evocative. "Smells of tallow and old smoke" beats "an air of mystery."
- No in-world narrator, no named NPCs, no setting-specific proper nouns. The Codex drops into any world.
- No jokes that only land once. Items get used dozens of times.

## Length

| Field | Target |
|---|---|
| Description | 1–3 sentences |
| Hook | 1 sentence, actionable |
| Mechanics (per system) | 1–2 sentences, no more than one new rule |

If an entry needs more than that, it is probably two items or a module.

## Formatting

- Headings in the body: `##` for sections, never `#` (the item name lives in front matter).
- Item names in Title Case: *Fine Bedroll*, *Alchemist's Fire*.
- Bold only for mechanical keywords the DM must not miss. Italics for in-world text (inscriptions, labels).
- Units always abbreviated with a period: `7 lb.`, `30 ft.`, `1 gp`, `5 sp`.
- Prices lowercase: `gp`, `sp`, `cp`. Never `GP`.
- Numbers: spell out one through nine in prose, numerals for anything mechanical or in a table.
- Lists over paragraphs whenever three or more parallel things are described.

## Naming and IDs

- `id` is the kebab-case slug of the name: `Alchemist's Fire` → `alchemists-fire` (drop apostrophes, no double hyphens).
- One item per file; the filename matches the `id` exactly (`items/gear/fine-bedroll.md`).
- Quality-tier variants share a base name and differ by the `quality` field, not by the name. Don't create *Fine Bedroll* and *Shoddy Bedroll* as separate items unless their mechanics genuinely diverge.

## Mechanics

- System-neutral text never contains numbers that are also stats. Damage, DCs, and bonuses live in `systems:` blocks only.
- Prefer reusing an existing rule to inventing one. If you must invent, keep it to a single sentence with a clear trigger and effect.
- Optional-module content is flagged inline: *(Quality tiers)*, *(Wear & repair)*, *(Haggling)*. Never assume a module is in play.

## Licensing hygiene

- SRD 5.1 (CC-BY 4.0) and ORC material only. No Product Identity — no named monsters, deities, planes, or settings from closed sources.
- Every file ends with the attribution footer from the item template.
- If you are unsure whether a term is Product Identity, rename it. Renaming costs nothing.
