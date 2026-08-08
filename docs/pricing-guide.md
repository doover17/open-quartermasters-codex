# Pricing Guide

How the Codex sets prices so that hundreds of contributors produce one coherent economy. These rules keep items consistent with the source systems and with each other.

## First Principles

1. **Never contradict the SRD.** If SRD 5.1 prices a hempen rope at 1 gp, our common-quality rope is 1 gp. Codex prices *extend* the official economy (tiers, locations, resale); they never overwrite it.
2. **PF2e prices follow Pathfinder's own tables** for the common tier; where the systems disagree, each system's YAML block may carry its own price note, but the front-matter `price` uses the 5e-anchored value as the shared default.
3. **Price for play, not simulation.** We are not modeling a medieval economy; we are making shopping, looting, and selling *interesting*. When realism and fun conflict, fun wins.
4. **A price is a promise.** Players learn the economy through repetition. Identical items should never have unexplained different prices across entries.

## The Three Price Points

Every item carries up to three prices in its front matter:

| Field | Meaning | Default relationship |
|---|---|---|
| `city` | Standard market price in a decent-sized settlement with competition | The anchor — set this first |
| `village` | Small settlement, limited stock, no competition | ×1.2–1.5 for manufactured goods; ×0.7–0.9 for rural/raw goods (food, hides, timber) |
| `scarcity` | Wartime, remote frontier, black market, siege, or "the only one for sale" | ×2–4, contributor's judgment |

- Round to clean coin values. `8 sp`, not `7.5 sp`. Below 1 gp, prefer sp; below 1 sp, cp.
- Above 1 gp, prefer gp — **except** where a village or scarcity multiplier lands between whole gp values. There, sp is preferred over rounding the multiplier away: a 1 gp city item at a ×1.2 village markup is `12 sp`, not `1 gp` (which erases the markup) or `2 gp` (which doubles it). `12 sp` and `15 sp` are correct and idiomatic; `13 gp, 7 sp` is not.
- Omit a price point rather than force one (e.g., illegal goods may have no `village` price).

## Quality Tier Multipliers

Applied to the common (SRD) city price:

| Tier | Multiplier | Design contract |
|---|---|---|
| Shoddy | ×0.5 | Cheaper, with a drawback or failure risk. The discount must be tempting; the risk must be real. |
| Common | ×1 | The SRD item, unchanged in price and function — now with a description. |
| Fine | ×3–5 | One small, situational benefit. Closer to ×3 for everyday goods, ×5 for specialist tools. |
| Masterwork | ×10+ | Fine's benefit made reliable, plus identity: a maker's mark and resale that holds value. |

**Sanity check:** a tier's benefit should feel worth its price to a player who cares about that situation, and skippable to one who doesn't. If every player would always buy the fine version, it's underpriced or overpowered.

## Consumables

The golden rule: **price so players actually use them.**

- Target **0.5–2% of a mid-level character's expected total wealth per use**. In 5e terms: most utility consumables land between 2 sp and 5 gp; combat-relevant ones up to ~25 gp.
- Hoarding is a pricing failure. If playtests show players saving an item "for the right moment" forever, cut its price or raise its availability.
- Sold in batches where natural (chalk by the ten, tapers by the dozen) — batch pricing makes buying feel generous.

## Resale (`resale` field)

- **Mundane goods:** 25–50% of city price. Closer to 25% for common items every merchant already stocks; up to 50% for fine/masterwork with a recognizable maker's mark.
- **Consumables and provisions:** usually `"—"` (no meaningful resale).
- **Magic items:** ~50% of city price from a legitimate buyer; collectors and auctions can exceed city price for named, storied, or quirked items — that's an adventure, not a table entry.
- Resale is the *typical fence or merchant offer*, not a rule. Haggling, reputation, and story override it freely.

## Magic Item Pricing (5e-anchored)

The SRD gives rarity but not firm prices, so the Codex standardizes:

| Rarity | City price band | Notes |
|---|---|---|
| Common | 50–100 gp | Consumable commons (potions) at the low end |
| Uncommon | 200–500 gp | Combat-relevant items price at the top of band |
| Rare | 2,000–10,000 gp | Availability is `special-order` at best |
| Very rare | 20,000–50,000 gp | Rarely for sale at all; `collector`/`auction` |
| Legendary | Priceless | No price field — acquiring one is a campaign event |

- Named/quirked items (see the quirks module) add 25–100% over an anonymous equivalent.
- PF2e blocks should use Pathfinder's item-level price table directly; note the level in the mechanics field.

## Availability Ladder

`availability` sets *whether* the item is on the shelf, independent of price:

- **common** — any settlement with a relevant shop stocks it
- **uncommon** — cities stock it; villages special-order it (days to weeks)
- **special-order** — must be commissioned or hunted down even in cities
- **illegal** — sold only through fences and black markets; possessing it is a scene

Availability is the DM's friction dial. When in doubt, make an item cheap but *uncommon* rather than expensive but everywhere — hunting for a thing is more fun than saving for it.

## Worked Example

Pricing a **Fine Grappling Hook**:

1. SRD grappling hook, city, common: **2 gp** → that's our anchor.
2. Fine tier, specialist tool → ×5 → **10 gp city**.
3. Manufactured good in a village → ×1.3 → **13 gp**, round to **12 gp village**.
4. Scarcity ×3 → **30 gp**.
5. Resale: fine tool with a mark → 40% → **4 gp**.
6. Availability: cities stock climbing gear, villages don't → **uncommon**.

```yaml
price: {village: 12 gp, city: 10 gp, scarcity: 30 gp}
resale: 4 gp
availability: uncommon
```

## Precedents from Merged Items

Rules get argued; precedents get copied. These are worked examples from items already in the
Codex — match them rather than re-deriving from first principles.

**Tier multipliers, anchored to SRD tools.** Every one of these lands exactly on its band:

| Item | SRD anchor | Tier | City price |
|---|---|---|---|
| `fine-healers-kit` | healer's kit, 5 gp | Fine ×5 | 25 gp |
| `shoddy-healers-kit` | healer's kit, 5 gp | Shoddy ×0.5 | 2 gp |
| `fine-cartographers-kit` | cartographer's tools, 15 gp | Fine ×5 | 75 gp |
| `fine-climbing-kit` | climber's kit, 25 gp | Fine ×4 | 100 gp |
| `portable-alchemy-rig` | alchemist's supplies, 50 gp | Fine ×4 | 200 gp |
| `masterwork-smiths-tools` | smith's tools, 20 gp | Masterwork ×10 | 200 gp |

Note the two masterwork entries in the Codex sit at 150–200 gp. **Masterwork is a price
band as much as a multiplier**: if your masterwork item lands under ~10× and reads as
cheap beside these, the multiplier is wrong or the item isn't masterwork.

**Village/city inversion, worked correctly.** Manufactured goods cost more in the village;
rural and raw goods cost less. Both directions appear in merged items and both are correct:

| Direction | Examples | Village | City |
|---|---|---|---|
| Manufactured (×1.2–1.5 village) | `fine-backpack` | 8 gp | 6 gp |
| | `iron-strongbox` | 20 gp | 15 gp |
| | `travelers-spice-tin` (traded in) | 2 gp | 1 gp |
| Rural / raw (×0.7–0.9 village) | `willowbark-chew` (gathered) | 4 sp | 5 sp |
| | `fever-tea` (gathered) | 6 sp | 8 sp |
| | `hunters-jerky-spiced` (farmed) | 6 sp | 8 sp |
| | `honeyed-hardtack` (baked locally) | 8 cp | 1 sp |

If your item is grown, gathered, hunted, or baked where it's sold, the village price is the
lower one. If it was carried in, it's the higher one. Imported goods (`bitter-coffee-brick`)
are manufactured goods for this purpose no matter what they're made of.

## Red Flags Reviewers Look For

- A price that contradicts the SRD or an already-merged Codex item
- Fine/masterwork items whose benefit touches combat math (attack, damage, AC)
- A mundane item whose benefit duplicates a magic item's — if the effect has a rarity band in the magic table, a quality tier can't sell it for 10 gp. Check the band before you price it.
- A lower tier outclassing a higher one at its own job: a common-tier bundle that grants automatic success where a merged fine-tier item grants only advantage is a tier-contract failure, whatever it costs.
- Consumables priced into hoarding territory
- Resale above 50% without a story reason
- Precision theater: `13 gp, 7 sp, 4 cp` — round it
- A shoddy item whose drawback never actually comes up in play

When your item's price feels wrong but you can't say why, open the PR anyway and flag it — pricing debates in review are how this guide improves.
