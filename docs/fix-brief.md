# Fix Brief — Post-Review Corrections (Batches 3–10)

Instructions for agents executing the fixes from `review/batch-review.md`. Read that report
in full first, plus the *updated* `docs/style-guide.md` and `docs/pricing-guide.md` — both
now contain new rules codified from this review (over-used hook shapes, mechanical batch
integrity, description-opening variety, sub-gold rounding, pricing precedents). Every fix
below must comply with the updated guides.

**Scope discipline:** touch only the files and the specific elements named. Do not
re-write descriptions, mechanics, or hooks that weren't flagged. Do not "improve" the
five best items. Update nothing in Batches 1–2.

---

## Track 1 — Design-Decision Fixes (do these exactly as specified)

These four had decisions made for them; implement, don't reinterpret.

1. **`items/gear/masterwork-boots.md`** — Remove the silent-heel Perception-disadvantage
   mechanic from both system blocks entirely. The masterwork payload is: broken in from
   day one (no movement penalties from new-boot conditions), soles that outlast the
   owner's patience, and a maker's mark with held resale. Reprice: 35 gp city, 45 gp
   village, 70 gp scarcity, resale 18 gp.
2. **`items/gear/winter-kit.md`** — Downgrade "automatically succeed" to advantage (5e) /
   +2 circumstance bonus (PF2e) on saves against extreme-cold exhaustion effects. Keep
   tier common and price 8 gp. It now sits below merged fine-bedroll's specialization,
   as a bundle should.
3. **`items/consumables/honeyed-hardtack.md`** — Replace the PF2e block with: "A creature
   that eats the biscuit during Treat Wounds gains a +1 item bonus to its recovery roll's
   DC comparison is NOT valid PF2e — instead use: the healer gains a +1 item bonus to the
   Medicine check to Treat Wounds on a patient who eats the biscuit during treatment."
   Final text must name a real check and a real bonus type, runnable cold.
4. **`items/consumables/strongwine-flask.md`** — Cap the second measure's Perception
   disadvantage at 1 hour (5e) / until the end of your next 10-minute activity (PF2e),
   not until a long rest.

## Track 2 — Batch 9 Rebuild (RETURN TO AGENT)

Keep as written: `feast-in-a-jar`, `celebration-cask`, `ceremonial-salt`,
`bitter-coffee-brick`.

Rebuild the other six under two hard constraints:

- **Mechanics:** at most two of the six may grant a bonus to a social skill check. The
  other four must use different mechanical shapes — a duration purchased, a resource
  shared, an effect on someone else's roll, a condition removed, a thing that can be
  lost or spent as currency. Specific redirections:
  - `travelers-spice-tin`: rations/morale payload per its backlog intent — e.g., makes
    monotonous or borderline rations count as a proper meal; no social bonus.
  - `pipeweed-pouch`: the shared pipe buys *time* — ten minutes of guaranteed audience
    or truce; the mechanic is the duration, not a bonus.
  - `sugar-figures`: strip the fey-obligation line from mechanics (keep as At the Table
    fiction); mechanics are a trivial gift's effect on attitude, once, small.
  - `strongwine-flask`: see Track 1 fix; it may remain one of the two social-bonus items.
  - `honeyed-hardtack`: see Track 1 fix; its payload is now medical, not social.
  - `bribery-tobacco` (Batch 10, fixed here for coherence): rebuild as denominated
    frontier currency — thumb-widths as units with stated values — not a social-bonus
    consumable. It and `pipeweed-pouch` must not share a job when done.
- **Descriptions:** at least four of the six rebuilt descriptions must open on something
  other than smell or taste — weight, sound, temperature, texture, material, or the
  container. Read Batch 5's openings first as the model.
- **Hooks:** `travelers-spice-tin` loses its merchant-recognition hook; no rebuilt hook
  may use a shape on the updated style guide's over-used list.

## Track 3 — Hook & Prose Re-cuts (one element each)

Per the review's per-item tables; the review's "suggested fix" column is the spec.

- Batch 3: `iron-strongbox` (hook), `belt-pouch-set` (hook), `shoddy-sack` (hook ending),
  `pack-frame` (price to 4 gp *or* harder drawback — choose one and note which in the PR)
- Batch 4: `noble-attire` (hook), `reversible-coat` (hook source, keep twin-coat premise)
- Batch 5: `fine-tent` (hook → the re-sewn grommet), `signal-kit` (5e block compression;
  code-learning line moves to At the Table), `travois-kit` (5e capacity as a flat number)
- Batch 6: `portable-alchemy-rig` (hook → the pried plaque), `shoddy-healers-kit` (hook →
  the buyer), `surveyors-kit` (hook ending → the field book)
- Batch 7: `acid-etch-vial` (hook stops at the count), `smoke-pellet` (one concrete wrong
  detail), `tanglefoot-sap` (show the trees/gourds), `waterproofing-resin` (untangle the
  dead-addressee sentence)
- Batch 8: `willowbark-chew` (hook re-seeded from the aftertaste argument, keep damp
  coin image if it fits), `fever-tea` (hook ending)
- Batch 10: `patch-kit` (hook replaced → mends of its mends), `fire-log-pressed` (hook
  opens and ends on the smell), `water-purification-drops` (hook ending inverted)

The three "extra unit in the kit" hooks: `herbal-poultice-kit` keeps its sixth square;
`fine-healers-kit`'s black-wax vial also stays (different enough); `patch-kit`'s sixth
patch is replaced per above.

## Verification

After all tracks: run `python3 scripts/validate_items.py items` (must exit 0), then
self-audit each touched batch against the updated batch-integrity rules — hook shapes
*and* mechanical shapes. State in the PR description which over-used-shape slots each
batch still uses, so review can confirm at a glance.
