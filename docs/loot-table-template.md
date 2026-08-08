# Loot Bundle Template (Canonical Schema)

Loot bundles live in `loot-tables/`, one markdown file per context. A bundle is **curated, not rolled**: it answers "what's actually *in* a hobgoblin war camp?" with a scene's worth of stuff a DM reads once and narrates forever. No d100s.

## The Schema

```yaml
---
id: drowned-merchant-ship      # unique slug, kebab-case; filename must match
name: The Drowned Merchant Ship
context: shipwreck             # free descriptor: war-camp | wizard-study | shipwreck |
                               # bandit-cache | noble-vault | shrine | sewer-den | ...
tier: low                      # low (levels 1–4) | mid (5–10) | high (11+)
coin: "120 gp equivalent, mostly in mixed regional silver"
items:                         # merged Codex ids the party can recover
  - {item: waxed-map-case, note: "still sealed"}
  - {item: fine-waterskin, note: "monogrammed"}
  - {item: iron-piton-set, qty: 1}
bulk: "trade cargo: 8 crates of lacquerware (40 gp/crate, heavy, awkward)"
unique:                        # 1–3 one-off finds written in the body
  - captains-letter
  - the-eleventh-crate
tags: [shipwreck, water, salvage, mystery]
contributors: [your-handle]
license: CC-BY-4.0
---
```

**Item rules:** like shops, every `item:` must be a merged Codex id — loot loops back into the catalog (and the recovered goods can be *sold* using the same book). `bulk` covers value that's heavy, awkward, or story-flavored rather than pocketable — hauling problems are content. `unique` entries are named finds detailed in the body: the reason this bundle is a story and not a list.

## The Body — three required sections

### The Scene (2–4 sentences)
Where the loot *is*, sensory-first: the state of the place, what's been disturbed, what the searcher touches first. Sets the mood the whole haul inherits.

### The Finds
One short paragraph per `unique` entry, headed by its name in bold. Each unique find follows item-description rules — concrete, sensory, with an implied history — and at least one should raise a question the coin doesn't answer.

### Hooks (at least 1)
What the loot *means*: who's missing it, who's looking for it, what taking it starts. Standard hook rules — end on the unsettling detail.

---

## Worked Example

```yaml
---
id: drowned-merchant-ship
name: The Drowned Merchant Ship
context: shipwreck
tier: low
coin: "120 gp equivalent in mixed silver, swollen leather purses, and one strongbox tithe-marked for a temple"
items:
  - {item: waxed-map-case, note: "still sealed, red courier wax"}
  - {item: fine-waterskin, note: "monogrammed 'E.V.'"}
  - {item: sounding-cord, qty: 1}
  - {item: oil-flask, qty: 4, note: "wax seals intact"}
bulk: "trade cargo: 8 crates of lacquerware (40 gp/crate if raised dry; heavy, fragile, and insured by someone)"
unique: [captains-letter, the-eleventh-crate]
tags: [shipwreck, water, salvage, mystery]
contributors: [codex-core]
license: CC-BY-4.0
---
```

## The Scene

She settled upright on a sandbar at three fathoms, masts shorn, and the water inside her holds is colder than the sea around them. Fish have claimed the crew quarters; nothing has claimed the captain's cabin, though the door stands open. Silt rises at every touch like the ship exhaling.

## The Finds

**The Captain's Letter.** In the cabin's drowned desk, a waxed packet the sea never breached: a letter of credit for triple the cargo's worth, drawn against a lender in a city this route doesn't pass. The captain's log, by contrast, is water-ruined — except the final page, which someone tore out *before* the sinking.

**The Eleventh Crate.** The manifest nailed by the hold ladder lists ten crates of lacquerware. There are eleven. The eleventh matches the others exactly — same maker's stamps, same rope-work — but it's lashed apart from the rest, and something inside shifts a half-beat after the crate stops moving.

## Hooks

The insurance seals on the cargo belong to an underwriting house that already paid this claim — two seasons ago, for the same ship, reported sunk on a different coast. Whoever raises the lacquerware will be selling goods that officially drowned twice, and the underwriters employ people whose whole job is arithmetic like that.

---

## Submission Checklist

- [ ] YAML validates; `id` matches filename; every `items` entry is a merged Codex id
- [ ] All three body sections present; every `unique` id has a bold-headed paragraph
- [ ] Coin and bulk values sane for the stated `tier`
- [ ] At least one unique find raises an unanswered question
- [ ] Hook ends unsettled; taking the loot starts something
- [ ] Ten-second test: could a DM narrate this search without reading ahead?
