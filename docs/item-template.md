# Item Template (Canonical Schema)

Every item in the Codex is one markdown file with YAML front matter. The front matter is the machine-readable data (powers the website, cards, and JSON export); the body is the human-readable description and hooks.

## The Schema

```yaml
---
id: fine-bedroll              # unique slug, kebab-case
name: Fine Bedroll
category: gear                # gear | consumable | weapon | armor | magic | trade-good
subcategory: camping
quality: fine                 # shoddy | common | fine | masterwork (omit if N/A)
rarity: common                # common | uncommon | rare | very-rare | legendary (magic items)
price:
  village: 4 gp               # small settlement, limited stock
  city: 3 gp                  # standard market price
  scarcity: 8 gp              # wartime / remote / black market
resale: 1 gp                  # typical fence/merchant buyback
weight: 7 lb.
availability: common          # common | uncommon | special-order | illegal
sold_by: [general-store, outfitter, caravan-trader]
systems:
  dnd5e:
    mechanics: "Advantage on saving throws against exhaustion caused by sleeping in rough conditions."
  pf2e:
    mechanics: "+1 circumstance bonus to Fortitude saves against effects of resting in severe environmental cold."
tags: [camping, travel, comfort, quality-tier]
contributors: [your-handle]
license: CC-BY-4.0
---
```

## The Body (after the front matter)

Each body has three required sections:

### Description (2–4 sentences)
Sensory and concrete. What does it look, feel, smell like? What marks it as this quality tier or region? Write in second person present ("The wool is dense and lanolin-rich...") per the style guide.

### At the Table (1–3 bullets)
The usability payload. When would this item actually matter in play? Give the DM the moment, not just the rule.

### Hooks (at least 1)
A narrative thread: who made it, who wants it, what secret might it carry. Hooks justify the item's existence — the "earns its place" rule.

---

## Worked Example 1 — Mundane Gear

```yaml
---
id: fine-bedroll
name: Fine Bedroll
category: gear
subcategory: camping
quality: fine
price: {village: 4 gp, city: 3 gp, scarcity: 8 gp}
resale: 1 gp
weight: 7 lb.
availability: common
sold_by: [general-store, outfitter, caravan-trader]
systems:
  dnd5e:
    mechanics: "Advantage on saving throws against exhaustion from sleeping in rough conditions."
  pf2e:
    mechanics: "+1 circumstance bonus to Fortitude saves against environmental cold while resting."
tags: [camping, travel, comfort, quality-tier]
license: CC-BY-4.0
---
```

**Description.** Dense-woven wool over an oiled canvas shell, with a lanolin smell that never quite washes out. The stitching is double-run and the ties are leather rather than cord — the mark of an outfitter who expects the buyer to actually sleep outdoors, not just own the option.

**At the Table.**
- On a night of rain, altitude, or frost, this is the difference between a real long rest and a miserable one.
- A character who lends theirs to a sick companion is making a visible, costly kindness.

**Hooks.** The best fine bedrolls in the region carry the burned brand of a single workshop — and its owner recently stopped filling orders. Anyone selling a "new" one now is selling stolen stock.

---

## Worked Example 2 — Consumable

```yaml
---
id: emberwax-taper
name: Emberwax Taper
category: consumable
subcategory: alchemical
price: {village: 8 sp, city: 5 sp, scarcity: 2 gp}
resale: 2 sp
weight: "—"
availability: uncommon
sold_by: [alchemist, chandler, caravan-trader]
systems:
  dnd5e:
    mechanics: "As an action, light and hurl up to 20 ft. Sheds bright light in a 10-ft radius for 1 minute and ignites unattended flammable objects it touches. A creature it strikes takes 1 fire damage and is outlined (attackers don't suffer disadvantage from the target being lightly obscured) until the end of your next turn."
  pf2e:
    mechanics: "Held alchemical item, 1 action to Activate (Strike or thrown Interact, 20 ft.). On hit: 1 fire damage and the target is dazzled-adjacent: it can't benefit from concealment until the end of your next turn."
tags: [light, fire, thrown, cheap-utility]
license: CC-BY-4.0
---
```

**Description.** A stubby candle the color of banked coals, dipped in a resin that catches from friction alone. It burns hot, fast, and stubborn — rain hisses off it for the first thirty seconds.

**At the Table.**
- Cheap enough that players will actually throw it: reveal a lurker, start a diversion fire, mark a fleeing target.
- Chandlers sell them by the dozen; a bandolier of tapers is a personality statement.

**Hooks.** Emberwax is rendered from a beetle that swarms only in burn-scarred forests. Every taper on a shelf implies a fire somewhere — and someone harvesting its aftermath.

---

## Worked Example 3 — Magic Item with Quirk

```yaml
---
id: dagger-plus-one-cinnamon
name: "+1 Dagger, 'Spicebiter'"
category: magic
subcategory: weapon
rarity: uncommon
price: {city: 350 gp, scarcity: 600 gp}
resale: 175 gp
weight: 1 lb.
availability: special-order
sold_by: [collector, auction, adventurers-guild]
systems:
  dnd5e:
    mechanics: "+1 to attack and damage rolls. Base weapon: dagger."
  pf2e:
    mechanics: "+1 striking dagger equivalent."
tags: [magic, weapon, quirk, uncommon]
license: CC-BY-4.0
---
```

**Description.** An unremarkable blade with a walnut grip — until it's drawn, when the air fills with the warm smell of cinnamon. The scent strengthens near the recently dead.

**At the Table.**
- The quirk is a free plot sensor: the party's dagger "smells stronger" near a hidden body.
- Merchants and collectors pay a premium for named, quirked items over anonymous +1s.

**Hooks.** Spicebiter has changed hands eleven times, and its previous owners share one detail: none of them sold it. Each swears it was stolen — or that they woke up and it was simply gone.

---

## Quality Tiers (module reference)

| Tier | Price mult. | Rule of thumb |
|---|---|---|
| Shoddy | ×0.5 | Works, with a drawback or failure risk |
| Common | ×1 | The book-standard item, now with a description |
| Fine | ×3–5 | One small, situational benefit |
| Masterwork | ×10+ | Fine's benefit, reliably; a maker's mark; resale holds value |

Tier benefits must be **situational, not raw power** — a fine sword doesn't add damage; it might resist breakage or shave gold off maintenance. Combat math stays untouched.

## Pricing Principles

1. Anchor to SRD prices for common tier; never contradict them.
2. Village > city for manufactured goods; city > village for raw/rural goods.
3. Consumables should be priced so a mid-level party can burn them freely (~0.5–2% of expected wealth per use).
4. Resale defaults to ~25–50% of city price; magic items ~50%.

## Submission Checklist

- [ ] YAML validates and `id` is unique
- [ ] All three body sections present
- [ ] At least one hook; item passes "earns its place"
- [ ] Prices follow the pricing guide
- [ ] No closed IP (settings, named monsters outside SRD/ORC)
- [ ] Both system blocks filled, or `TODO` flagged for conversion help
