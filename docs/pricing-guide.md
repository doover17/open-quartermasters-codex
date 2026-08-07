# Pricing Guide

Prices in the Codex are consistent by construction, not by taste. This document is the reference a reviewer checks a pull request against.

## The three price points

Every item carries three prices plus a resale value:

| Field | Meaning |
|---|---|
| `city` | The baseline. A well-supplied market, no pressure on supply. |
| `village` | Small settlement, limited stock. |
| `scarcity` | Wartime, remote frontier, siege, or black market. |
| `resale` | What a merchant or fence pays to take it off your hands. |

**Set `city` first, then derive the rest.** The `city` price is the number that must match SRD/comparable published items; the others are multipliers.

## Default multipliers

| Field | Multiplier on `city` | Notes |
|---|---|---|
| `village` | ×1.25 | ×1.0 for items produced locally (rope in a fishing town, ale anywhere) |
| `scarcity` | ×2 to ×5 | ×2 for merely inconvenient, ×5 for genuinely contested goods |
| `resale` | ×0.25 | ×0.5 for goods a merchant can resell easily; ×0.1 for illegal or traceable goods |

Round to a table-friendly number after applying the multiplier: prefer 1, 2, 5, 10, 25, 50, 100 over 3.75. A price no one has to do arithmetic on is worth more than a price that is exactly right.

## Anchors

Set the `city` price by comparison, not from scratch. Useful anchors:

| Anchor | Price |
|---|---|
| A day's unskilled labor | 2 sp |
| A night at a modest inn | 5 sp |
| A common melee weapon | 1–10 gp |
| A set of artisan's tools | 15–25 gp |
| A riding horse | 75 gp |
| Plate armor | 1,500 gp |

If your item costs more than a riding horse, the entry must justify why in one sentence.

## Quality tiers *(optional module)*

When an item uses quality tiers, price them off the `common` tier:

| Tier | Multiplier |
|---|---|
| shoddy | ×0.5 |
| common | ×1 |
| fine | ×2 |
| masterwork | ×10 |

Masterwork is deliberately steep — it should be an acquisition, not a purchase.

## Consumables

Consumables are priced to be **used, not hoarded** (Phase 1 scope). Rule of thumb: a consumable should cost no more than a single day of adventuring income at the tier it is useful. If a player hesitates to throw it, it is priced too high.

## Magic items

Magic items carry `rarity` instead of `quality`. Suggested `city` bands:

| Rarity | Band |
|---|---|
| common | 50–100 gp |
| uncommon | 101–500 gp |
| rare | 501–5,000 gp |
| very rare | 5,001–50,000 gp |
| legendary | 50,001+ gp |

These are guidance for worlds where magic items are bought and sold at all. Say so in the entry if the item is meant to be unpurchasable.

## Review checklist

- [ ] `city` price justified against an anchor or a comparable SRD item
- [ ] `village`, `scarcity`, `resale` derived with stated multipliers (deviations explained in the PR)
- [ ] Prices rounded to table-friendly numbers
- [ ] Currency units lowercase and abbreviated (`gp`, `sp`, `cp`)
- [ ] Consumables pass the "would a player actually spend it?" test
