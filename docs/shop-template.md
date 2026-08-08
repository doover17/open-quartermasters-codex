# Shop Template (Canonical Schema)

Shops live in `shops/`, one markdown file per shop, same front-matter pattern as items. A shop is a *scene*, not a spreadsheet: the schema exists so a DM can run the merchant cold, mid-session, in under a minute of reading.

## The Schema

```yaml
---
id: the-honest-nail            # unique slug, kebab-case; filename must match
name: The Honest Nail
type: general-store            # general-store | outfitter | blacksmith | alchemist |
                               # chandler | tanner | fence | pawnbroker | provisioner |
                               # locksmith | curiosities | market-stall
settlement: village            # village | town | city | crossroads | frontier
price_mod: 1.2                 # multiplier on Codex city prices (see pricing-guide
                               # location logic; 1.0 = city standard)
haggle: reluctant              # eager | open | reluctant | fixed-prices | insulted-by-it
stock:                         # references to merged Codex item ids + quantity
  - {item: trail-rations, qty: 20}
  - {item: chalk-bundle, qty: 6}
  - {item: shoddy-rope, qty: 4}
  - {item: fine-tinderbox, qty: 1}
special_order: [fine-bedroll, iron-piton-set]   # can obtain in days–weeks
under_counter: []              # illegal/discreet stock; empty list if none
buys: [mundane-gear, salvage]  # what the shop will purchase from PCs
tags: [village, general, honest]
contributors: [your-handle]
license: CC-BY-4.0
---
```

**Stock rules:** every `item:` value must be a merged Codex item id — shops are stocked from the real catalog so play loops back into the book. Quantities are small on purpose; scarcity is content. A shop needs 4–10 stock lines, not an inventory system.

## The Body — four required sections

### The Shop (2–4 sentences)
The room, by the senses: what it smells like, what's hanging from the ceiling, what the floor does. Same sensory-first rules as item Descriptions.

### The Merchant (2–4 sentences + a voice line)
Who runs it: name, manner, one physical detail, one want. End with a single line of dialogue in quotes — the voice the DM opens with.

### Behind the Counter (1–3 bullets)
Play texture: how haggling actually goes here, what earns a discount or the door, what the merchant notices about customers. This is where `haggle:` becomes a scene.

### Hooks (at least 1)
Same rules as item hooks: point at a person, end on the unsettling detail. The best shop hooks come from the stock list itself — where things came from, who else wants them.

---

## Worked Example

```yaml
---
id: the-honest-nail
name: The Honest Nail
type: general-store
settlement: village
price_mod: 1.3
haggle: reluctant
stock:
  - {item: trail-rations, qty: 14}
  - {item: chalk-bundle, qty: 6}
  - {item: shoddy-rope, qty: 4}
  - {item: oak-door-wedges, qty: 3}
  - {item: sputter-torches, qty: 8}
  - {item: oil-flask, qty: 10}
  - {item: fine-tinderbox, qty: 1}
special_order: [fine-bedroll, iron-piton-set, fine-waterskin]
under_counter: []
buys: [mundane-gear, salvage]
tags: [village, general, honest]
contributors: [codex-core]
license: CC-BY-4.0
---
```

## The Shop

A converted stable that still smells faintly of horse under the tallow and dried herbs. Goods hang from the old hay-hooks in the rafters, and the floorboards each report a different note — the owner knows the tune of every customer's path. The one fine tinderbox sits in a locked glass case like a relic.

## The Merchant

Odessa Pale runs the Nail alone since her brother took the wagon east and stopped writing. Gray-braided, ledger-inked fingers, and a habit of answering questions a beat too slowly, as if checking the answer against stock. She wants, more than profit, for someone to bring her news of the east road. *"Prices are on the tags. The tags are honest. That's the whole trick of the place."*

## Behind the Counter

- Haggling offends her arithmetic, not her pride: she'll drop the price only when a buyer points out a genuine flaw in the goods — and then respects them for it.
- She front-shelves the sputter torches and keeps quiet about the difference; buyers who ask *why* the good tinderbox costs twelve times more get the honest answer and her attention.
- Pays fair salvage prices but records every seller's name and description in the ledger, unprompted.

## Hooks

Odessa's ledger has a page for her brother's last three shipments, each shorter than the one before. The final entry is a single line of goods she never received — and two of those exact items, in his handwriting's inventory marks, are on a peddler's cart that came through last week heading west.

---

## Submission Checklist

- [ ] YAML validates; `id` matches filename; every stock `item:` is a merged Codex id
- [ ] All four body sections present, in order, with a quoted voice line
- [ ] `price_mod` consistent with `settlement` per the pricing guide
- [ ] At least one hook, ending unsettled
- [ ] Merchant is a person with a want, not an inventory interface
- [ ] Ten-second test: could a DM open this file mid-session and start talking?
