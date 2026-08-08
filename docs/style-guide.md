# Style Guide

How the Codex sounds, reads, and stays consistent across hundreds of contributors. When this guide conflicts with your instincts, follow the guide; when it's silent, use your best judgment and expect friendly notes in review.

## Voice & Tense

- **Second person, present tense** in Descriptions: "The wax flakes under your thumbnail," not "The wax would flake" or "Characters may notice."
- **Direct address to the DM** in At the Table and Hooks: "The party's names may already be on the list." You're talking to the person running the game.
- **Confident, concrete, a little wry.** The Codex's personality is a well-traveled quartermaster: practical, observant, occasionally dry. Not jokey, not grimdark, not purple.

## Descriptions

- **2–4 sentences.** If you need five, cut the weakest.
- **Lead with the senses.** Weight, smell, sound, texture, and temperature before appearance. "It smells of honey and lamp smoke" does more than "it is a well-made case."
- **Vary which sense leads.** "Lead with the senses" is not "open on smell." Weight, sound, temperature, and texture are equally valid first beats, and a batch whose descriptions all open the same way reads as one voice no matter how good each sentence is. If you're writing several items at once, check your opening lines side by side before you submit.
- **One detail that implies a history.** Scratches, brands, repairs, regional variation. Objects are biographies.
- **Vary the history-detail too.** A scratched or burned tally of past uses is one valid answer and currently an over-used one. Reach instead for a repair made by a different hand, a regional variation, a modification the current owner didn't make, or a part replaced with something that doesn't match.
- **No stats in prose.** Numbers live in the YAML `mechanics` fields. The description of a fine bedroll never says "advantage."

### Good vs. flat

> ❌ *A high-quality rope that is stronger than normal rope and less likely to break.*
>
> ✅ *Loose-laid hemp with visible splices where shorter offcuts were married together. Coiled tight, it looks fine — which is exactly the problem.*

## "At the Table" Sections

- **1–3 bullets, each a moment of play** — a scene, a decision, a payoff. Never a restatement of the mechanics.
- Ask: *when does this item become the most interesting thing in the room?* Write that.
- It's fine for a bullet to be social ("lending yours to a sick companion is a visible kindness") — items create roleplay, not just rolls.

## Hooks

- **At least one per item; one great hook beats three vague ones.**
- A hook should **raise a question or point at a person**: someone who made it, wants it, fears it, or is lying about it.
- **End on the unsettling detail**, not the explanation. "The chalk dust at each mark is mixed with grave soil." Full stop. The DM finishes the story.
- **An NPC refusing to answer is not an unsettling detail.** "She won't say what she's been feeding them," "he changes the subject," "she'll only discuss it drunk" — these withhold the image instead of delivering it. End on the thing the DM can describe.
- **Don't do the DM's arithmetic.** If the hook names the target, solves its own puzzle, or explains the anomaly it just raised, cut the last sentence. Twelve missing vials and a year of patience is the hook; the DM finds the door.
- Hooks are prompts, not plots. No stat blocks, no required outcomes, no multi-paragraph scenarios.

### Over-used hook shapes

These structures work, which is why they recur — and they now recur too much. **Use each at most once per batch**, and if your batch is already carrying two of them, reach for something else entirely.

- **The seller's secret record** — the maker or merchant keeps a ledger, a customer book, a wax impression, or a shelf of lasts, and knows more about buyers than they let on. Heavily over-used; treat as spent unless your version does something the merged examples don't.
- **The unfindable supplier** — the shop no one can locate, the resin bought after dark, the source nobody can recall.
- **The strange customer** — someone buying or consuming unusual quantities of the item.
- **The unexplained extra unit** — a sixth patch, a sixth square, an unlabeled vial that came free with the kit.

Structures the Codex has *not* worn out, for when you need one: an object found where it can't have got to, a previous owner identified by a trace they left, a local custom nobody will explain the origin of, a mark or code that outlived the institution that used it, a track heading the wrong way.

## Setting Neutrality

- **No proper nouns for places, deities, nations, or organizations.** Write "a coastal duchy," "the hunting lodge," "a trading house." Items must drop into any world.
- **No closed IP, ever.** Nothing outside SRD 5.1 / ORC content: no beholders, no named settings, no trademarked monsters. When unsure, ask in your PR before writing around it.
- Generic fantasy peoples and professions (dwarves, smiths, smugglers) are fine.

## Mechanics Writing (the YAML `mechanics` fields)

- **Use each system's native vocabulary.** 5e says "advantage," "saving throw," "action." PF2e says "circumstance bonus," "Fortitude save," "Interact." Don't blend them.
- **State the trigger, then the effect.** "On a climbing check that fails by 5 or more, the rope frays or snaps."
- **Situational, never raw power** for mundane and quality-tier items: no flat bonuses to attack or damage, no AC increases, nothing that competes with magic items. Reliability, resistance to failure, and edge-case utility are the design space.
- **Shoddy = drawback with a discount. Fine = one situational benefit. Masterwork = Fine's benefit made reliable, plus identity (a maker's mark, held resale value).**
- If a rule needs a DC, use the system's standard easy/medium DCs (5e: 10/15; PF2e: level-appropriate simple DCs). Don't invent novel subsystems inside a single item — propose those as modules instead.
- Can't write one of the two system blocks? Fill in what you can and mark the other `TODO:` — conversion help is a valued contribution type.

## Formatting Rules

- Filename = `id` + `.md`, kebab-case, in the correct category folder.
- `id` is permanent once merged (it's the future website URL). Choose carefully.
- Section headers exactly: `## Description`, `## At the Table`, `## Hooks`.
- Prices always in the form `4 gp`, `5 sp`, `2 cp` (lowercase, space, no periods). Em dash `"—"` for not-applicable fields, in quotes so YAML parses it.
- **Prices of 1,000 or more must be quoted** in the inline `price: {…}` form: `price: {city: "6,500 gp", scarcity: "15,000 gp"}`. The thousands separator is a comma, and an unquoted comma inside `{ }` splits the mapping — YAML parses `{city: 6,500 gp}` as the key `city` set to `6` plus a junk key `500 gp`. The validator catches it as `unknown price location`, but the fix is to quote, not to drop the separator.
- Weights as `7 lb.` — and note conditions where relevant: `"5 lb. (full)"`.
- Oxford commas, en dashes for ranges (2–4), em dashes for asides.

## Words to Avoid

- "Simply," "just," "very," "quite" — cut them.
- "This item can be used to..." — show the use instead.
- "The DM may decide..." — the DM always may; saying so wastes the sentence.
- Real-world brand names, units the systems don't use (no meters, no kilograms).

## Batch Integrity

When you write several items at once — a full backlog batch, or any group that will be read together — the group is reviewed as a unit. Items that each pass on their own can still fail collectively, and that failure is the most common reason a batch is returned.

Check all three before submitting:

1. **Hook structure.** No two hooks in a batch share a structure. See the over-used shapes above; each may appear at most once.
2. **Mechanical shape.** No more than two items in a batch resolve to the same mechanical payload — a bonus to the same check, the same duration, the same resource, the same trigger. A batch of ten social items should not be ten bonuses to Persuasion; vary what the mechanic *is*, not only what it's flavored as. A player who buys three items from your batch should not own one item three times.
3. **Description openings.** Vary the sense and sentence rhythm you open on. Read your first lines in sequence; if they sound like one narrator with one move, rewrite half of them.
4. **Sensory registers** (for waves whose items carry quirks). Every quirk must be distinct, and no more than two per batch may sit in the same register — smell, taste, sound, texture, temperature, weight, sight, motion, orientation. Note that "every quirk in a wave gets its own register" is not achievable past about nine items; the workable rule is distinctness everywhere and no clustering within a batch. Spread the registers across the wave as far as the count allows, and don't spend two batches in a row on the same one.

The bar for a batch is not "every item passes." It's "these ten items feel like ten items."

## The Bar

Before submitting, read your item and ask the two Codex questions:

1. **Could a DM run this cold, mid-session, in ten seconds of reading?**
2. **Would a player remember owning it?**

If both answers are yes, open the PR.
