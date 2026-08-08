# Style Guide

How the Codex sounds, reads, and stays consistent across hundreds of contributors. When this guide conflicts with your instincts, follow the guide; when it's silent, use your best judgment and expect friendly notes in review.

## Voice & Tense

- **Second person, present tense** in Descriptions: "The wax flakes under your thumbnail," not "The wax would flake" or "Characters may notice."
- **Direct address to the DM** in At the Table and Hooks: "The party's names may already be on the list." You're talking to the person running the game.
- **Confident, concrete, a little wry.** The Codex's personality is a well-traveled quartermaster: practical, observant, occasionally dry. Not jokey, not grimdark, not purple.

## Descriptions

- **2–4 sentences.** If you need five, cut the weakest.
- **Lead with the senses.** Weight, smell, sound, texture, and temperature before appearance. "It smells of honey and lamp smoke" does more than "it is a well-made case."
- **One detail that implies a history.** Scratches, brands, repairs, regional variation. Objects are biographies.
  - A tally of past uses (scratch marks, notches, burned counts) is one valid history-detail among many — not the default. Alternatives: a repair by a different hand, a regional variation, a modification the current owner didn't make, a part that's newer than the rest.
- **Vary your openings across a batch.** "Lead with the senses" does not mean "open on smell." Weight, sound, temperature, texture, and material are equally valid leads. A batch where every description opens the same way reads as one narrator with one move — a batch-level failure even when every sentence passes.
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
- Hooks are prompts, not plots. No stat blocks, no required outcomes, no multi-paragraph scenarios.
- **An NPC refusing to answer is not an unsettling detail.** "She won't say," "he changes the subject," and "she'll only discuss it drunk" are the *absence* of a detail. End on the thing the DM can describe.
- **Over-used hook shapes — a batch may use each at most once, and check merged items in the same subcategory before reaching for any of them:**
  - the seller/maker keeps a secret record of buyers
  - the supplier can't be found or won't explain
  - a strange customer buys unusual quantities
  - the maker won't say what's in it / where it comes from
  - an unexplained extra unit inside a kit

## Setting Neutrality

- **No proper nouns for places, deities, nations, or organizations.** Write "a coastal duchy," "the hunting lodge," "a trading house." Items must drop into any world.
- **No closed IP, ever.** Nothing outside SRD 5.1 / ORC content: no beholders, no named settings, no trademarked monsters. When unsure, ask in your PR before writing around it.
- Generic fantasy peoples and professions (dwarves, smiths, smugglers) are fine.

## Mechanics Writing (the YAML `mechanics` fields)

- **Use each system's native vocabulary.** 5e says "advantage," "saving throw," "action." PF2e says "circumstance bonus," "Fortitude save," "Interact." Don't blend them.
- **State the trigger, then the effect.** "On a climbing check that fails by 5 or more, the rope frays or snaps."
- **Situational, never raw power** for mundane and quality-tier items: no flat bonuses to attack or damage, no AC increases, nothing that competes with magic items. Reliability, resistance to failure, and edge-case utility are the design space.
- **Shoddy = drawback with a discount. Fine = one situational benefit. Masterwork = Fine's benefit made reliable, plus identity (a maker's mark, held resale value).**
- If a rule needs a DC, use the system's standard easy/medium DCs (5e: 10/15; PF2e: level-appropriate simple DCs). Don't invent novel subsystems inside a single item — propose those as modules instead. Obligation economies, faction accounting, and anything that implies ongoing bookkeeping belong in At the Table as fiction, not in the mechanics block.
- **Batch integrity covers mechanics, not only hooks.** No more than two items in a batch should resolve to the same mechanical shape — a bonus to the same check, the same duration, the same resource. Vary the payload, not only the flavor: a duration, a consumable resource, a thing that works on someone else's roll, a thing you can lose.
- Can't write one of the two system blocks? Fill in what you can and mark the other `TODO:` — conversion help is a valued contribution type.

## Formatting Rules

- Filename = `id` + `.md`, kebab-case, in the correct category folder.
- `id` is permanent once merged (it's the future website URL). Choose carefully.
- Section headers exactly: `## Description`, `## At the Table`, `## Hooks`.
- Prices always in the form `4 gp`, `5 sp`, `2 cp` (lowercase, space, no periods). Em dash `"—"` for not-applicable fields, in quotes so YAML parses it.
- Weights as `7 lb.` — and note conditions where relevant: `"5 lb. (full)"`.
- Oxford commas, en dashes for ranges (2–4), em dashes for asides.

## Words to Avoid

- "Simply," "just," "very," "quite" — cut them.
- "This item can be used to..." — show the use instead.
- "The DM may decide..." — the DM always may; saying so wastes the sentence.
- Real-world brand names, units the systems don't use (no meters, no kilograms).

## The Bar

Before submitting, read your item and ask the two Codex questions:

1. **Could a DM run this cold, mid-session, in ten seconds of reading?**
2. **Would a player remember owning it?**

If both answers are yes, open the PR.
