# The Open Quartermaster's Codex
*A free, open-source item compendium for tabletop RPGs*

## Vision

Items in most TTRPGs are underserved: scattered across roll tables, missing prices, lacking descriptions, and forgotten after purchase. The Codex gives every item — mundane, consumable, and magical — a full, table-ready entry so that:

- **DMs** can open the book (or site) mid-session and run any shop, loot drop, or appraisal cold.
- **Players** get items that feel distinct, useful, and worth engaging with.
- **The community** can extend it forever: new items, regional variants, and system conversions all follow one shared template.

## Design Pillars

1. **Usability at the table beats completeness.** Every entry must be scannable in under 10 seconds.
2. **Every item earns its place.** Each entry has at least one mechanical *or* narrative hook. No filler rows.
3. **Modular by default.** Quality tiers, wear/repair, haggling — all optional dials, clearly flagged, never required.
4. **System-neutral core, system-specific stats.** Descriptions, hooks, and lore are shared; numbers live in per-system blocks (5e, PF2e first).
5. **Open forever.** Content released under CC-BY 4.0, built on SRD 5.1 (CC) and ORC-licensed material. No closed IP, ever.

## Scope

### Phase 1 — Core Release (v0.1, the lean proof)
- Adventuring gear (full treatment of ~60 SRD items: quality tiers, prices, descriptions, hooks)
- Consumables (~40 items: alchemical, herbal, culinary one-shots priced to be used, not hoarded)
- The item template + contribution guide (this repo's foundation)
- One sample pre-built shop with merchant personality

### Phase 2 — Commerce & Context
- Shop generator chapter (merchant archetypes, inventories, haggling quirks, under-the-counter goods)
- Selling & appraisal rules (fences, collectors, resale values, monster-part markets)
- Loot-by-context bundles (curated: war camp, wizard's study, shipwreck, etc.)

### Phase 3 — Depth & Character
- Weapons & armor regional variants and maker's marks
- Magic item quirks & personality tables
- Sentimental/story item guidance
- Wear, repair, and upgrade module

### Out of scope (for now)
- New character options (feats, subclasses)
- Full crafting economy overhaul (light crafting notes only)
- Systems beyond 5e/PF2e (welcomed later as community conversions)

## Licensing

- **Our content:** Creative Commons Attribution 4.0 (CC-BY 4.0)
- **5e compatibility:** built on SRD 5.1 (CC-BY 4.0). No Product Identity (no beholders, no named settings)
- **PF2e compatibility:** ORC License for Paizo-derived mechanics
- Every file carries an attribution footer; a `LICENSES/` folder holds full texts

## Repository Structure

```
/
├── README.md                  ← this file
├── CONTRIBUTING.md            ← how to submit items
├── docs/
│   ├── item-template.md       ← canonical schema + examples
│   ├── style-guide.md         ← voice, tense, formatting rules
│   └── pricing-guide.md       ← how we set prices consistently
├── items/
│   ├── gear/                  ← one file per item (markdown + YAML front matter)
│   ├── consumables/
│   ├── weapons/
│   ├── armor/
│   └── magic/
├── shops/                     ← pre-built merchants
├── loot-tables/               ← contextual loot bundles
├── modules/                   ← optional rules (quality tiers, wear, haggling)
└── LICENSES/
```

Items are stored as individual markdown files with YAML front matter — human-readable, diffable in pull requests, and machine-parseable so we can auto-generate the PDF, item cards, and a searchable website from one source of truth.

## Outputs (generated from the same files)

1. **Website** — searchable, filterable database (static site; priority #1 for usability)
2. **PDF** — print-friendly compiled book per release
3. **Item cards** — printable card sheets for handing to players
4. **Data export** — JSON for VTT module makers (Foundry, etc.)

## Contribution Model

- All items follow the canonical template (see `docs/item-template.md`)
- Pull requests reviewed for: template compliance, pricing consistency, license safety, and the "earns its place" rule
- Playtesting feedback tracked via issues with a `playtest` label
- Maintainers keep a public roadmap; contributors can claim open item slots from issue lists

## Roadmap

| Milestone | Target |
|---|---|
| v0.1 | Template finalized, 100 core items (gear + consumables), contribution guide live |
| v0.2 | Website generator working, first community PRs merged |
| v0.5 | Phase 2 content (shops, selling, loot bundles) |
| v1.0 | Phase 3 content, PDF + card decks compiled, PF2e stat blocks complete |
