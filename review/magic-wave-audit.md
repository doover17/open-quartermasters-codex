# Magic Wave Audit — Batches M1–M4 (40 items)

**This is not an independent review.** I wrote all forty of these items, so a verdict from me
is worth little. What follows is an audit: the wave's rule compliance laid out as tables a
reviewer can check against the files in ten minutes, plus the judgment calls that need a
human. The batch-level failures found in the gear and consumables waves (`review/batch-review.md`)
were all *collective* — repeated hook structures, repeated mechanics — so those are the
dimensions tabulated here.

Validator at time of writing: 140 files, 0 errors, 9 warnings (all pre-existing, all in
Batch 1–2 gear files).

---

## Rule 6 — mechanical shape, two per batch

| Batch | Shapes used | Compliance |
|---|---|---|
| M1 | passive continuous (lamp, warmstone) · activation (needle, bells) · object-property (truesalt, ink) · sensor (compass, charm) · record (cord, locket) | 5 shapes × 2 — full |
| M2 | `+1` baseline ×10 | Exempt by the carve-out; no item carries an effect beyond its bonus, so the rest of the rule is trivially met |
| M3 | container/object-property (satchel, kettle) · activation (keyring, rope) · sensor/reveal (ledger, lantern) · worn concealment (mask, boots) · paired writing (slate) · worn continuous (cloak) | Full, no carve-out |
| M4 | combat `+X` (bloodless-blade, fallen-watch) · reveal (drowned-lantern, honest-mirror) · sensor/record (cartographers-eye, tally) · continuous (long-road-cloak, first-lantern) · paired passive (oathkeeper) · activation (patient-key) | Full, no carve-out |

## Rule 2 — quirk registers

Every quirk is distinct. Registers are spread, with no more than two per batch in any one
register — see the caveat below on why strict uniqueness across forty items is impossible.

| Batch | Registers, in table order |
|---|---|
| M1 | shadow-angle · motion-when-unwatched · aftertaste · weight · structural absence · texture · scent · sound · orientation · peripheral sight |
| M2 | scent · salt moisture · absence of sound · temperature · weight · behavioral return · vibration · orientation · appearing marks · frost |
| M3 | motion · structural count · aftertaste · tactile fit · sound · sight (ink) · temperature · displacement · drying time · light quality |
| M4 | decay over time · tactile tightening · sound · tactile wear · memory · sight (wounds) · dimension · sight (names) · temperature · scent |

Repeats *across* batches: scent (M1/M2/M4), temperature (M2/M3/M4), sound (M1/M2/M3/M4),
weight (M1/M2). Within any single batch the cap holds.

## Rule 3 — price against band

| Batch | Rarity | Band | Range used | Availability |
|---|---|---|---|---|
| M1 | common | 50–100 | 55–100 | uncommon, 2× special-order |
| M2 | uncommon | 200–500 | 350–500 | uncommon, 3× special-order |
| M3 | uncommon | 200–500 | 300–500 | uncommon, 3× special-order |
| M4 | rare | 2,000–10,000 | 5,000–9,000 | all special-order |
| M4 | very-rare | 20,000–50,000 | 35,000 | special-order, collector/auction |
| M4 | legendary | no price field | — | special-order |

All resale at ~50% of city. `rope-that-listens` at 300 gp is the one item deliberately below
the upper half of its band, because it does its job badly on purpose.

## Addendum 3 — attunement

Seven items, each with an SRD analogue that requires it: `rememberers-locket`,
`mask-of-plain-faces`, `boots-of-the-quiet-mile`, `oathkeeper-band`, `the-cartographers-eye`,
`the-long-road-cloak`, `the-first-lantern`. No `+1` weapon or armor requires attunement,
matching the SRD.

## Addendum 4 — hook structures

No structure repeats within a batch, and no hook ends on a withheld answer (the validator
now checks the latter automatically, and reports zero across all 140 files). Provenance
carries the wave: 31 of 40 hooks turn on ownership — who had it, how they lost it, who is
still looking.

Deliberate cross-batch differentiations, made while writing rather than caught in review:

- `quiet-bell` (M1) carries a count and no content; `speaking-slate` (M3) carries words and
  no signal. The backlog gave both "paired object communication."
- `homing-compass`'s hook was rewritten mid-draft because its first version — a dealer with
  a shelf of forty — duplicated `rememberers-locket`'s collector.
- `warmstone`'s quirk is scent rather than warmth so it doesn't collide with
  `hearthguard-shield`; this then collided with `spicebiter-dagger`'s cinnamon, which is
  what surfaced the Rule 2 problem below.

---

## Judgment calls needing a human

1. **Rule 2 is unsatisfiable as written.** "No two items may share a sensory register" across
   40 items, against roughly nine registers, cannot hold. I worked to: all quirks distinct,
   at most two per register per batch. That interpretation is now written into the style
   guide's Batch Integrity section. If the strict reading was intended, the wave needs either
   a larger register vocabulary or fewer items.
2. **`docs/item-template.md` was edited.** Worked Example 3's id changed from
   `dagger-plus-one-cinnamon` to `spicebiter-dagger` so the Codex has one canonical id. This
   is a spec change made on my own judgment — the backlog is the list of record, the template
   example is illustrative. Reversible in one line if you'd rather the backlog moved.
3. **Three divination items strain Rule 1.** `lantern-of-last-hours`, `the-drowned-lantern`,
   and `the-honest-mirror` are new effects rather than SRD restatements. Each is held to one
   adjudicable sentence with an explicit statement of what it does *not* do — the honest
   mirror reveals without dispelling, the drowned lantern shows resting places rather than
   events, the lantern of last hours shows position without sound. If Rule 1 is meant
   strictly, these three are where it broke.
4. **`the-first-lantern` cannot be turned off.** That is the intent ("no price, only
   consequence"), but it is a permanent, undismissable light source in a party's inventory,
   and it will reshape every stealth scene for the rest of a campaign. Worth confirming that
   is wanted rather than tolerated.
5. **`bloodless-blade`'s quirk is bleak.** Permanent, recognizable wounds that never close,
   explicitly noted as an interrogator's tool. It is within the Codex's register — the merged
   `numbing-salve` already has an interrogator hook — but it is the darkest item in the wave
   and a reasonable person might want it softened.

## Not covered by any check

The validator confirms schema, ids, formats, price form, section order, banned words, hook
endings, closed IP, and cross-references. It cannot see whether a quirk is distinct, whether
a price is *right* within its band, whether a mechanic is adjudicable cold, or whether an
item earns its place. Every table above was compiled by hand and should be spot-checked
against the files rather than trusted.
