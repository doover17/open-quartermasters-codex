# Batch Review — Batches 3–10 (80 items)

Human-judgment review of the 80 agent-written items in `items/gear/` (Batches 3–6) and
`items/consumables/` (Batches 7–10). The validator passed all files with zero errors, so
schema, ids, formats, and structure are out of scope here.

Reference bar: the 20 merged items of Batches 1–2. Not perfection — Batch 2 itself ships
two "the seller secretly tracks buyers" hooks (`fine-grappling-hook`, `fine-lockpicks`), so
that structure was already in the water before Batch 3 was written.

**Headline:** the prose bar is met or beaten almost everywhere. Individual hooks are
frequently better than the Batch 1–2 average. The failures are *collective* — hooks and
mechanics that are excellent alone but repeat each other within a batch. One batch (9)
repeats itself at the mechanics level badly enough to return.

---

## Verdicts

| Batch | Name | Verdict |
| --- | --- | --- |
| 3 | Containers & Storage | **MERGE WITH FIXES** |
| 4 | Clothing & Disguise | **MERGE WITH FIXES** |
| 5 | Camp & Travel | **MERGE** |
| 6 | Tools & Trades | **MERGE WITH FIXES** |
| 7 | Alchemical Utility | **MERGE WITH FIXES** |
| 8 | Herbal & Medicinal | **MERGE WITH FIXES** |
| 9 | Culinary & Social | **RETURN TO AGENT** |
| 10 | Expedition Expendables | **MERGE WITH FIXES** |

---

## Batch 3 — Containers & Storage · MERGE WITH FIXES

Strong individual work. `sealed-clay-jars`, `false-bottom-chest`, and `pack-frame` are
Batch 1–2 quality or better. The batch-level problem is one structure used four times.

**Batch-level flag (criterion 2).** Four of ten hooks are *"the merchant who makes or
sells this is quietly collecting information on, or exploiting, their customers"*:
`fine-backpack` (fence trains burglars on the standard layout), `iron-strongbox`
(locksmith files a wax impression under every buyer's name), `belt-pouch-set` (the best
cutpurse takes measurements as a leatherworker's assistant), `fine-bandolier` (free
bandoliers sized to no one else's vials). `masterwork-lockbox` is a fifth cousin. Each is
good; read consecutively they blur into one merchant.
*Suggested fix:* keep `fine-bandolier` and `false-bottom-chest` as written; re-cut two of
`fine-backpack` / `iron-strongbox` / `belt-pouch-set` toward structures the batch doesn't
use — an object found where it shouldn't be, or a previous owner, both of which the batch's
own best items already demonstrate.

| File | Crit. | Issue | Suggested fix |
| --- | --- | --- | --- |
| `items/gear/iron-strongbox.md` | 1, 2 | The wax-impression hook is the fourth "seller keeps secret records" in the batch, and it half-resolves itself by adding "She's never used them." | Cut the reassurance; end on the cheap lock on the drawer. Better: move the hook to whoever has already opened that drawer. |
| `items/gear/belt-pouch-set.md` | 5b | Competently written but the least memorable item in the batch — the hook is about a cutpurse, not about the pouches. | Tie the hook to the *third* pouch specifically: what someone was found carrying in one, or an empty one sewn into a garment that had no business having one. |
| `items/gear/shoddy-sack.md` | 1 | Ends on an evasion ("she'll only discuss drunk") rather than an unsettling detail — the third-act beat is withheld rather than delivered. | End on the thing itself: what the new thread is, or what the double-bagging is meant to hold in. |
| `items/gear/pack-frame.md` | 3, 4 | +50 lb. carrying capacity for 2 gp is the cheapest large numeric benefit in the gear set — an SRD backpack is 2 gp for 30 lb. | Either raise to 4–5 gp or keep the price and make the drawback bite harder (it currently only costs Dash and Acrobatics). |

---

## Batch 4 — Clothing & Disguise · MERGE WITH FIXES

Individually the best-written batch in the set — `masterwork-boots`, `common-clothes-bundle`,
`winter-kit`, `disguise-kit`, and `veil-and-gloves` all clear the bar comfortably. It carries
the batch's variety problem and the review's single worst mechanics/pricing outlier.

**Batch-level flag (criterion 2).** Four hooks are *"the tradesperson keeps a record of
their customers"*: `masterwork-boots` (shelf of lasts), `noble-attire` (measurement ledger),
`disguise-kit` (the costumer recognizes her own work), `veil-and-gloves` (the customer book).
Separately, `disguise-kit` and `reversible-coat` both hang on a theater costumer recognizing
her own output.
*Suggested fix:* `masterwork-boots` and `veil-and-gloves` are the two best executions — keep
both. Rewrite `noble-attire`'s hook entirely and re-point `reversible-coat`'s away from the
costumer.

| File | Crit. | Issue | Suggested fix |
| --- | --- | --- | --- |
| `items/gear/masterwork-boots.md` | 3, 4 | The silent heel imposes disadvantage on all hearing-based Perception permanently, for 10 gp — that is Boots of Elvenkind (uncommon, 200–500 gp by our own magic band) on a mundane item, and 10 gp is absurd beside `masterwork-lockbox` (150 gp) and `masterwork-smiths-tools` (200 gp). | Keep the never-blisters benefit as the masterwork payload; cut the silent heel to a narrow circumstance (hard floors only, and only while walking, not Dashing) or drop it. Reprice to 30–40 gp regardless — masterwork on ordinary footwear should still cost like masterwork. |
| `items/gear/winter-kit.md` | 4 | *Automatically succeed* on extreme-cold exhaustion saves, at common tier for 8 gp, strictly outclasses merged `fine-bedroll` (fine tier, advantage only). | Downgrade to advantage, or keep automatic success but move the price and tier into fine. A common-tier bundle should not beat a fine-tier merged item at its own job. |
| `items/gear/noble-attire.md` | 1, 2 | The ledger-exploited-by-a-third-party hook is the batch's fourth records hook and its most generic — the debt collectors are an explanation, not an unsettling detail. | Point at a person instead: whose measurements are in the book that shouldn't be, or the entry taken for someone who never came to collect the garment. |
| `items/gear/reversible-coat.md` | 2 | Same costumer, same "she keeps the twin / she recognizes her work" move as `disguise-kit` two files earlier. | Keep the twin-coat premise (it's good) but source it elsewhere — a tailor, a dead owner, an estate lot — so the batch doesn't run one NPC twice. |

---

## Batch 5 — Camp & Travel · MERGE

The strongest batch in the review and the one to hold up as the target. `bear-bag-kit`,
`travois-kit`, `shoddy-tent`, `camp-kitchen`, `portable-shrine`, and `folding-camp-stool` are
all at or above the Batch 1–2 line, and no two hooks share a structure. Hook subjects range
across an object's history, a custom, an absence, a wrong-direction track, and a code — this
is what criterion 2 looks like when it's satisfied.

| File | Crit. | Issue | Suggested fix |
| --- | --- | --- | --- |
| `items/gear/fine-tent.md` | 1, 2 | The sailmaker's ledger of buyers is the repo's most-reused structure (also Batches 2, 3, 4, 6), and the premise is muddled — why she demands the answer is never made strange enough to carry the crossed-out pages. | Drop the ledger. The tent already has a better detail sitting unused: the one corner grommet re-sewn by a finer hand. Build the hook on that. |
| `items/gear/signal-kit.md` | 5a | The 5e block is the longest mechanics text in the review — four distances, three components, plus a code-learning subsystem — and can't be absorbed cold mid-session. | Move the code-learning line to At the Table as fiction, and compress the ranges to a three-item list. The hook and description are excellent; only the block needs cutting. |
| `items/gear/travois-kit.md` | 5a | "treats the load as dragged weight (up to twice its normal drag capacity) in cargo" is genuinely hard to parse at speed; the PF2e block states the same thing cleanly in Bulk. | Restate the 5e capacity as a flat number the way the PF2e block does. |

---

## Batch 6 — Tools & Trades · MERGE WITH FIXES

`forgery-kit`, `fine-climbing-kit`, `masterwork-smiths-tools`, and `game-set-carved` are
review highlights. Pricing in this batch is the most disciplined in the set — every SRD-anchored
tool lands exactly on its multiplier (healer's kit 5→25 gp ×5, cartographer's 15→75 ×5,
smith's 20→200 ×10, alchemist's 50→200 ×4). Worth calling out as the model.

| File | Crit. | Issue | Suggested fix |
| --- | --- | --- | --- |
| `items/gear/portable-alchemy-rig.md` | 1, 2 | Another "workshop keeps a ledger of buyers" — the fifth in the repo — and the payoff (three buyers nobody remembers speaking) arrives as an explanation appended to the ledger rather than as the hook's own image. | Cut the ledger framing and lead with the pried-off silver plaque already in the description: who removed the name, and what the rivet holes spell. |
| `items/gear/shoddy-healers-kit.md` | 2 | Sits directly beside `fine-healers-kit`, and both hooks turn on *what's missing from kits that come back* (the black-wax vial; the scraped initials). | Keep the fine kit's vial. Re-point the shoddy kit at a buyer rather than the stock — who is buying half-empty kits on purpose, and for whom. |
| `items/gear/surveyors-kit.md` | 1 | The widow-and-unfinished-survey hook is well-made but resolves toward sentiment; the unnamed client is stated rather than felt. | End on the field book itself — the last measurement recorded, or the page torn out — instead of the missing name. |

---

## Batch 7 — Alchemical Utility · MERGE WITH FIXES

Mechanically the cleanest consumables batch: every item states trigger-then-effect, uses
native vocabulary in each system, and prices inside the guide's 2 sp–5 gp utility band.
`glowvial`, `vermin-smoke`, `flash-powder-packet`, and `scent-killer` are excellent.

**Batch-level flag (criterion 2).** Four hooks are *"a merchant or buyer of this item is
behaving strangely"*: `smoke-pellet` (the widow who sells only at night), `glowvial` (the
foreman buying spent vials back), `tanglefoot-sap` (the herbalist who won't say what she
feeds the trees), `acid-etch-vial` (the apprentice underreporting the tally). `glowvial` is
the best of them and should stay; two of the other three should move off the shop counter.

| File | Crit. | Issue | Suggested fix |
| --- | --- | --- | --- |
| `items/consumables/acid-etch-vial.md` | 1 | The hook resolves its own mystery — it does the arithmetic for the DM ("the missing twelve would eat through the hinges of exactly one thing in this city") and then names the target. | Stop at the count. Twelve missing vials and a year of patience is the hook; let the DM find the door. |
| `items/consumables/smoke-pellet.md` | 1, 5b | The thinnest hook in the batch: a character sketch that raises no question and ends on the seller's caution rather than an unsettling detail. | Give the widow one concrete wrong detail — what she watches for on the second crossing, or what she does with the pellets she declines to sell. |
| `items/consumables/tanglefoot-sap.md` | 1 | "will not say what she has been feeding them" is the same withheld-answer ending as `shoddy-sack` and `oilskin-set` — evasion in place of an image. | Show the trees, or the gourds: what this season's sap grips that last season's didn't. |
| `items/consumables/waterproofing-resin.md` | 5a | "addressed to a person who insists, credibly, that she has been dead for forty years" reads on first pass as the *addressee* claiming to be dead — a DM running it cold will stumble. | Rephrase so the living speaker and the forty-years-dead addressee are unambiguous. The idea is strong; only the sentence is tangled. |

---

## Batch 8 — Herbal & Medicinal · MERGE WITH FIXES

Very close to Batch 5 in quality. `clot-moss`, `purgative-draught`, `calming-tincture`,
`antivenom-draught`, and `smelling-salts` are all first-rate, and the batch handles the
village-cheaper-than-city inversion for rural goods correctly and consistently
(willowbark 4 sp / 5 sp, fever-tea 6 sp / 8 sp, purgative 4 sp / 5 sp). Drawbacks are real
and priced honestly — `calming-tincture` and `wakeleaf` both charge for what they give.

**Batch-level flag (criterion 2).** Four hooks are *"someone is buying or consuming
unusual quantities of this"*: `willowbark-chew` (the ferryman by the score),
`wakeleaf` (the warden, a pouch a night), `numbing-salve` (the interrogator in bulk),
`smelling-salts` (the mother buying in other towns). All four are good — `smelling-salts`
and `numbing-salve` are the best — but four in ten is the same silhouette repeated.
*Suggested fix:* re-cut `willowbark-chew` and `wakeleaf` toward the substance itself or a
place, the way `clot-moss` does.

| File | Crit. | Issue | Suggested fix |
| --- | --- | --- | --- |
| `items/consumables/willowbark-chew.md` | 2 | Bulk-buyer hook, and the weakest of the four — "coin that's always damp" is a good closing image attached to a premise the batch has already used. | Keep the damp coin; change what it buys. The description's upland/lowland aftertaste argument is a better seed. |
| `items/consumables/fever-tea.md` | 1 | Ends on "recover faster than they should," which explains the anomaly instead of showing it. | End on the smell, or on what the country families have started folding into the family book alongside the packets. |
| `items/consumables/herbal-poultice-kit.md` | 2 | The unlabeled sixth square duplicates `patch-kit`'s free sixth patch (Batch 10) and `fine-healers-kit`'s unexplained extra vial (Batch 6) — see repo-wide patterns. | This is the best of the three; keep it and change the other two. |

---

## Batch 9 — Culinary & Social · RETURN TO AGENT

The only batch I'd send back. The prose is good — `feast-in-a-jar`, `celebration-cask`,
and `ceremonial-salt` have genuinely strong hooks, and `bitter-coffee-brick`'s
mirror-backward shipping mark is one of the review's best closing images. The batch fails
as a batch, in two ways at once, and the fix isn't per-item editing.

**1. Mechanical monoculture (criteria 2, 4).** Six of ten items resolve to *advantage /
+1 on a Charisma check*: `travelers-spice-tin`, `strongwine-flask`, `pipeweed-pouch`,
`feast-in-a-jar`, `sugar-figures`, `celebration-cask`. `ceremonial-salt` is a seventh
social mechanic in different clothes (mutual Insight). A player who buys three of these
owns one item three times. The subcategory is "Culinary & Social," so social payloads are
right — but the batch needed the *shapes* to differ: a duration, a resource, a reputation
clock, a thing you can lose, a thing that works on someone else's roll.

**2. Uniform description rhythm (criterion 2).** Eight of ten descriptions open on the same
smell-then-taste construction — "It smells of X, Y, and Z... it tastes of..." (`spice-tin`,
`honeyed-hardtack`, `strongwine-flask`, `pipeweed-pouch`, `feast-in-a-jar`,
`bitter-coffee-brick`, `ceremonial-salt`, `sugar-figures`). The style guide asks for senses
first, and each sentence in isolation is good; read in sequence the batch has one narrator
with one move. Batch 5 varies its openings (an object, a material, a bundle, a weight) and
should be the model.

*Recommended return brief:* keep `feast-in-a-jar`, `celebration-cask`, `ceremonial-salt`,
and `bitter-coffee-brick` as written. Rebuild the mechanics of the other six so no more than
two grant a social-check bonus, and rewrite at least four descriptions to open on something
other than smell.

| File | Crit. | Issue | Suggested fix |
| --- | --- | --- | --- |
| `items/consumables/travelers-spice-tin.md` | 6, 2 | Backlog intent is "makes trail rations morale food," but the item became a Persuasion booster like everything else in the batch — the rations connection is in the prose only, and the hook (merchant remembers every blend) is the repo's sixth merchant-recognition hook. | Give it a rations/morale mechanic that touches the food, not the conversation — e.g. it makes spoiled or monotonous rations count as a proper meal. Then re-point the hook away from the merchant. |
| `items/consumables/honeyed-hardtack.md` | 5a | The PF2e block is incoherent: "a +1 circumstance bonus to the recipient's recovery only if the treatment succeeds" names no PF2e mechanic, and a bonus applied *after* success does nothing. | Rewrite to a real hook in the system — e.g. the biscuit removes the need for the patient to be willing/immobile, or grants a flat bonus to the Treat Wounds check. Must be runnable cold. |
| `items/consumables/strongwine-flask.md` | 4 | Second measure imposes disadvantage on Perception until the next long rest — a session-long penalty from one consumable, harsher than any drawback in Batches 1–2, and it will simply mean nobody ever drinks twice. | Cap the penalty at a few hours, or make the second measure's cost fictional and social rather than a long mechanical tail. |
| `items/consumables/pipeweed-pouch.md` | 2, 6 | Nearly the same job as `bribery-tobacco` (Batch 10): cured leaf, shared or gifted, grants a social bonus. Two items, one reason to exist. | Differentiate hard — make this one about the ritual's *duration* (the ten minutes as the mechanic, an item that buys time rather than a bonus) and leave the gift-economy role to `bribery-tobacco`. |
| `items/consumables/sugar-figures.md` | 4 | The fey-courtesy-owed line invents a small obligation subsystem inside one item ("fey keep accounts") with no rules attached to it. | Keep it as fiction in At the Table; strip it from the mechanics block, which should say only what the bonus is. |

---

## Batch 10 — Expedition Expendables · MERGE WITH FIXES

Solid, useful, well-priced batch. `glow-chalk` differentiates cleanly from merged
`chalk-bundle` rather than replacing it, `last-candle` delivers its intent exactly, and
`marked-trail-ribbons` and `message-ribbon` both end on genuinely unsettling images.

**Batch-level flag (criterion 2).** Three hooks are *"the supplier is mysterious or
unfindable"*: `fire-log-pressed` (buys resin after dark, pays without counting),
`patch-kit` (can't recall where he buys it; neither can his supplier), `last-candle` (a
chandler whose shop no one has ever found open). `last-candle`'s is the best; the other
two should move.

| File | Crit. | Issue | Suggested fix |
| --- | --- | --- | --- |
| `items/consumables/patch-kit.md` | 1, 2 | The free unlabeled sixth patch is a near-verbatim structural copy of `herbal-poultice-kit`'s free unlabeled sixth square (Batch 8), and it's the weaker version — it ends on forgetfulness rather than an image. | Replace entirely. The description's "old kits carry the mends of their mends" is a better seed: a kit whose own patches were cut from something identifiable. |
| `items/consumables/bribery-tobacco.md` | 6, 2 | Redundant with `pipeweed-pouch` (see Batch 9); the design intent "small luxuries as social currency" survives, but the item no longer has a distinct reason to exist beside its neighbor. | Lean fully into the *denomination* idea already in the description — thumb-widths as frontier currency, priced and spent in units — so it's a currency item, not a second social-bonus consumable. |
| `items/consumables/fire-log-pressed.md` | 2, 5b | Mysterious-supplier hook (one of three in the batch) and the least memorable item here — the funeral-incense smell is a good detail arriving one sentence too late to land. | Open the hook on the smell and end there. Cut the after-dark supplier framing, which the batch already uses twice. |
| `items/consumables/water-purification-drops.md` | 1 | Ends on the alchemist not drinking from his own well — a good beat, but it explains the village's crate orders rather than deepening them. | Invert: end on the crate order itself (what the households are doing with ten gallons a week each), and leave the alchemist out. |

---

## The five best items

Calibration set — this is what "good" looks like in this review. All are Batch 3–10, none
need any fix.

1. **`items/gear/bear-bag-kit.md`** — the hook lands on "Retied better." Three words that
   reframe the entire nightly camp ritual the item just taught the party to perform. The
   mechanics and the hook are the same idea seen from two ends.
2. **`items/consumables/purgative-draught.md`** — "she can feel the ring moving — upward."
   Ends on the unsettling detail with nothing after it, points at a specific person, and
   the horror runs directly through the item's stated function.
3. **`items/gear/travois-kit.md`** — the pole-lines stop at a rock face, mid-stride. A
   physical trace that raises a question the DM can answer any of six ways, attached to an
   item whose whole purpose is leaving a track.
4. **`items/gear/fine-climbing-kit.md`** — white thread for gear he expects back, red for
   yours, and he chose without measuring or asking. The hook is one sentence of NPC
   behavior that tells the player something about themselves.
5. **`items/gear/forgery-kit.md`** — "The signature on the confession is the best version
   on the sheet." Perfect use of the item's own mechanics as the hook's evidence, and it
   stops exactly one sentence before the explanation.

Runners-up worth reading for calibration: `items/consumables/clot-moss.md`,
`items/gear/shoddy-tent.md`, `items/gear/camp-kitchen.md`,
`items/gear/masterwork-smiths-tools.md`.

## The five weakest items — priority for human reading

Ordered by how much a human needs to look at them, not by prose quality.

1. **`items/gear/masterwork-boots.md`** — beautifully written; the mechanics and price are
   the review's worst outlier (permanent stealth benefit approaching an uncommon magic item,
   at 10 gp, in a tier whose siblings cost 150–200 gp). Needs a design decision, not an edit.
2. **`items/consumables/honeyed-hardtack.md`** — the PF2e block does not describe a
   runnable rule. This is the only item in the review that fails Codex question (a)
   outright rather than by being slow.
3. **`items/gear/winter-kit.md`** — a common-tier 8 gp bundle that automatically beats a
   merged fine-tier item at its own job. Tier-contract problem; affects the pricing
   promise across the whole clothing subcategory.
4. **`items/consumables/patch-kit.md`** — structurally duplicates a Batch 8 hook. Needs a
   rewrite, and someone should decide which of the three "unexplained extra unit in the
   kit" hooks survives.
5. **`items/consumables/travelers-spice-tin.md`** — the clearest case of an item losing its
   reason to exist: the backlog intent (rations morale) is present in the prose and absent
   from the mechanics, which instead do what five of its batchmates already do.

Next in line: `items/gear/noble-attire.md`, `items/consumables/smoke-pellet.md`,
`items/consumables/bribery-tobacco.md`, `items/gear/fine-tent.md`.

---

## Repo-wide patterns worth adding to the style guide

These are all cases where a rule the guide already implies isn't stated explicitly enough
to stop an agent — or a human — from reaching for the same move ten times.

**1. The merchant's ledger is exhausted.** Across Batches 2–7, at least eight hooks turn on
a maker or seller who secretly records, remembers, or exploits their customers:
`fine-grappling-hook`, `fine-lockpicks`, `fine-backpack`, `iron-strongbox`,
`belt-pouch-set`, `noble-attire`, `masterwork-boots`, `veil-and-gloves`, `fine-tent`,
`portable-alchemy-rig`, `travelers-spice-tin`. It's a good structure — that's why it
recurs — but it is now the Codex's default, and a reader going shop-to-shop meets the same
suspicious tradesperson in every store.
*Proposed guide text:* under Hooks, add a short list of over-used hook shapes with a note
that a batch may use each at most once — "the seller keeps a secret record of buyers," "the
supplier can't be found or won't explain," "a strange customer buys unusual quantities,"
"the maker won't say."

**2. Withholding is not an ending.** Several hooks end on someone declining to explain —
"she'll only discuss drunk," "will not say what she has been feeding them," "won't discuss
it," "changes the subject." The guide's actual instruction is to end on the *unsettling
detail*; a refusal to speak is the absence of a detail. Batch 5 never does this and is the
better for it.
*Proposed guide text:* add to the Hooks section — "An NPC refusing to answer is not an
unsettling detail. End on the thing the DM can describe."

**3. Tally marks have become a tic.** Scratched, burned, or etched counts of past uses
appear in at least six descriptions: `tinkers-roll`, `travelers-spice-tin`,
`rust-eater-paste`, `water-purification-drops`, `acid-etch-vial`, `glowvial`, plus
`pack-frame`'s hash marks and `smelling-salts`' tooth-marked cork. It's the guide's "one
detail that implies a history" rule solved the same way every time.
*Proposed guide text:* under Descriptions, note that a count of past uses is one valid
history-detail among many, and name alternatives — a repair by a different hand, a
regional variation, a modification the current owner didn't make.

**4. "An unexplained extra unit in the kit" needs retiring.** Three multi-use items ship
the same hook: `fine-healers-kit`'s black-wax vial, `herbal-poultice-kit`'s sixth square,
`patch-kit`'s sixth patch. Keep one.

**5. Batch integrity should cover mechanics, not only hooks.** The writers' brief (BACKLOG.md
step 8) says "no two hooks in a batch should share a structure" but says nothing about
mechanical shape — which is exactly how Batch 9 shipped six consecutive Charisma-bonus items
and still passed every stated rule.
*Proposed guide text:* extend the batch-integrity rule — "no more than two items in a batch
should resolve to the same mechanical shape (a bonus to the same check, the same duration,
the same resource). Vary the payload, not only the flavor."

**6. Description openings should vary within a batch.** Related to the above: "lead with the
senses" is being read as "open on smell." Batch 9 opens eight of ten descriptions on smell or
taste. Worth one line in the guide noting that weight, sound, temperature, and texture are
equally valid leads, and that a batch reading as one voice is a batch-level failure even when
every sentence passes.

**7. Sub-gold rounding needs a stated convention.** Seven items price at 12 sp or 15 sp
(`shoddy-tent`, `bear-bag-kit`, `insect-netting`, `belt-pouch-set`, `ceremonial-salt`,
`glow-chalk`, `rust-eater-paste`, `numbing-salve`). The guide says "below 1 gp, prefer sp,"
which leaves values *above* 1 gp ambiguous — and these are all cases where the 1.2×/1.5×
village multiplier lands between gp steps. The agents converged on a sensible answer
independently; the guide should ratify it.
*Proposed guide text:* "Above 1 gp, prefer gp — except where a village or scarcity
multiplier lands between whole gp values, in which case sp (12 sp, 15 sp) is preferred over
rounding away the multiplier."

**8. What's working, and should be written down as working.** Two things the agents did
consistently well and the guide currently only implies: (a) the village/city inversion for
rural and raw goods is applied correctly and consistently across all of Batches 8–10 —
herbs, food, and drink are cheaper in the village, manufactured goods dearer; (b) every
SRD-anchored tool in Batch 6 lands exactly on its tier multiplier. Both deserve a
"worked examples from merged items" appendix in the pricing guide so the next hundred items
have concrete precedents rather than only rules.
