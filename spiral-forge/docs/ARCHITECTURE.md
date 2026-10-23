# Spiral Forge: project layout

## Folders

| Path | Holds |
|---|---|
| `index.html` | Page structure and interface markup only (the original body, unchanged). |
| `css/base.css` | Shell styles: theme tokens, the two-column layout, roll sheet, output document, setting picker, tabs and tab groups, the phone dock, shared bits (banners, chips, selects). |
| `css/map.css` | Location wireframe map, Layout page, VTT export card, GM sheet preview. |
| `css/library.css` | Library cards and the Send to Notion panel. |
| `css/catalogs.css` | Bestiary, stat blocks, reskin and variant bars, Items (rarity colors), Spells. |
| `css/encounters.css`, `css/combat.css`, `css/loot.css` | One sheet per tool tab. |
| `data/tables.json` | The d100 tables for both settings. |
| `data/settings.json` | Per-setting wording, example rolls, prompt intro and section template (`tables` names the table set). |
| `data/locations.json` | Location page wording, example rolls, prompt context and revision chips per setting. |
| `data/books.json` | Monster source books (tag, name, publisher, license). |
| `data/layout.json` | Room shapes, floors, outside terrain, corridor styles, feature nouns, map types, terrain kinds, palettes, feature anchors, revision chips. |
| `data/rules.json` | XP by CR, ability and size lists, item rarities/categories/values, loot bands and pools, spell schools and classes, encounter budgets, combat conditions. |

The CSS files are linked in an order that keeps every rule in the same cascade
position as the single-file version (checked for conflicting selectors).

## Modules (`src/`)

| Module | Responsibility |
|---|---|
| `main.js` | Entry point: registers what each tab does on open, wires every feature, restores saved work, opens the last tab, connects to Claude. |
| `app/state.js` | The persisted `store`, the working copies (`state`, `lstate`, `ystate`, `T`, `S`, `turns`, `lturns`) as live bindings with setters, in-flight `jobs`, `save()`, the `fresh*` factories, `HISTORY_MAX`. |
| `app/shell.js` | Tabs and `showView` (with an `onView` registry), the setting switch, the Clear/Roll toolbar, the floating Weave bar, `anyBusy`/`setBusy`. |
| `data/index.js` | Loads the JSON files once (top-level await) and exports `SETTINGS`, `TABLES`, `LOC`, `BOOKS`, `bookOf`, `LAYOUT`, `RULES`. |
| `shared/dom.js` | `$`, `esc`, status setters, Markdown rendering, roll-log entries, selection fallback. |
| `shared/dice.js` | Crypto dice, dice expressions, averages, `hashStr`, seeded `rng`. |
| `shared/format.js` | `cap`, `sgn`, `fmt`, `crLabel`, `mod`, `pb`, titles, slugs, `cut`, `clone`, `newId`. |
| `shared/sanitize.js` | Coercions for saved data and Claude replies. |
| `shared/storage.js` | Storage keys and a safe JSON read. |
| `shared/claude.js` | The `claude` handles, `connectClaude`, `claudeJson` (sample.json with text fallback), error messages, on-demand script loading. |
| `ui/roll-sheet.js` | Slot markup, percentile-roll parsing, virtual rolls (shared by Campaign and Location). |
| `map/wireframe.js` | `splitMap` (the ```json block), the wireframe drawing, jump-to-area, SVG export of the wireframe. |
| `map/geometry.js` | Layout geometry: specs, room placement, buildings and ships, corridors, levels, terrain geometry, `roomPath`, `ysource`. Formulas untouched. |
| `map/render.js` | `renderLayout` and every SVG layer: patterns, terrain, scenery, drawing ops, features, tracing mask. |
| `features/campaign.js` | Campaign sheet, spiral diagram, weave/revise/undo, copy/save, site hand-off buttons, `refreshAll`. |
| `features/location.js` | Location sheet, build/revise/undo, copy/save/map export, campaign link banner, `refreshLoc`. |
| `features/layout.js` | Layout page: drafting (Claude and quick), options, terrain, room drag/resize/levels, undo, `drawLayout`, `refreshLayout`. |
| `features/export/images.js` | SVG/PNG/tracing-layer exports, `svgToPng`. |
| `features/export/vtt.js` | Wall tracing and the `.dd2vtt` zip. |
| `features/export/gm-sheet.js` | One-page GM sheet preview, Tighten with Claude, PDF. |
| `features/notion.js` | Send to Notion panels and the MCP calls. |
| `features/library.js` | Validators for saved data, library save/open/rename/delete, backup and restore. |
| `features/catalogs/common.js` | Helpers the reference tabs share: dataset fetch, campaign excerpt, copy, unsaved-draft guard, dice in prose. |
| `features/catalogs/bestiary.js`, `items.js`, `spells.js` | The three reference tabs; each exports its `*API` object, `restore*` and `open*`. |
| `features/loot.js`, `encounters.js`, `combat.js` | The tool tabs; `lootAPI` and `encAPI` replace the old `window.*API` objects. |

## Shared state and cross-feature dependencies

- Everything the pages edit lives in `store` and the working copies exported by
  `app/state.js`. Modules import them; only `state.js` reassigns them (via
  `setCampaign`, `setLocation`, `setLayout`, `setTurns`, `setLocationTurns`,
  `setSetting`).
- In-flight Claude requests are `jobs.campaign/location/layout/sheet`; the
  reference tabs keep their own controllers.
- The former `window.bestiaryAPI`, `itemsAPI`, `spellsAPI`, `lootAPI`,
  `encAPI`, `*Restore` and `open*` globals are now named exports. The
  `spells-ready` window event is kept as the signal that spell links can be
  rebuilt.
- Cycles between feature modules exist (library ↔ campaign, layout ↔ exports,
  shell ↔ features) but are only used at call time, never during module
  evaluation; `main.js` runs the inits in a fixed order.

## Start-up order (`main.js`)

1. Modules evaluate: data loads, `store` is read, tool tabs normalise their own
   store sections.
2. `onView(...)` registrations, then every `init*()` builds markup and listeners.
3. `cleanStoreInPlace()`, `buildLocSheet()`, `refreshAll()`, `refreshLoc()`,
   `refreshLayout()`, `showView(store.view)`, `updateLibButtons()`.
4. `connectClaude()`; buttons are disabled with a message when Claude is absent.

## Status

Every module parses and every import resolves to a real export. A headless
run with a stubbed Claude runtime got through campaign weaving, location
building, the wireframe map, layout drafting and editing, SVG/PNG/tracing/
VTT/PDF exports and library saves on the refactor. The Bestiary "Reskin with
Claude" step showed a generic error in that run and was not investigated
further. Not tested: the real claude.ai runtime, Notion, the Items/Spells
variant flows, Loot, Encounters, Combat, backup restore, and the real
`monsters.json`/`items.json`/`spells.json` datasets.
