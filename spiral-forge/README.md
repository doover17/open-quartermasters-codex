# Spiral Forge (web app)

The campaign, location, map, bestiary, encounter, combat, spell, item and loot
tool, split from a single `index.html` into HTML, CSS, JSON data and ES modules.

## Running it

The page uses ES modules and fetches its JSON data, so it must be served over
HTTP (opening the file directly does not work in Chrome):

    cd spiral-forge
    python3 -m http.server 8000      # then open http://localhost:8000/

## Environment requirements (unchanged from the original page)

- **Claude features** need the claude.ai artifact runtime (`window.claude.use`
  for `sample`, `downloads` and `mcp`). Outside claude.ai the roll sheets,
  reference tabs, loot tables, encounters and combat board still work; weaving,
  building, drafting, reskinning, theming, file saves and Send to Notion do not.
- **Reference data**: `monsters.json`, `items.json` and `spells.json` are not in
  this folder. The page fetches them from beside `index.html`, exactly as
  before; place the published files next to it.
- **CDN scripts**: marked and DOMPurify load in `index.html`; JSZip and jsPDF
  load on demand for the VTT and PDF exports.
- Browser-storage keys are unchanged (`spiral-forge-v2`, `spiral-forge-v1`,
  `spiral-forge-library-v1`, `spiral-forge-notion-dest`), so saved work and
  backups from the single-file version load as-is.

See `docs/ARCHITECTURE.md` for the module map, shared state and start-up order.
