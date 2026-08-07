# Contributing to the Codex

Thanks for helping make items matter! This guide covers everything you need to submit content.

## Ways to Contribute

- **New items** — the core of the project. Claim an open slot from the issues labeled `item-wanted`, or propose your own.
- **System conversions** — fill in missing `dnd5e` or `pf2e` blocks on existing items (search for `TODO` in item files).
- **Playtest reports** — open an issue with the `playtest` label describing what happened at your table.
- **Corrections** — typos, pricing inconsistencies, broken YAML. Small PRs are always welcome.
- **Shops, loot bundles, and modules** — coordinate via an issue first so we don't duplicate work.

## Submitting an Item

1. **Read the template.** Every item follows [`docs/item-template.md`](docs/item-template.md) exactly — YAML front matter plus the three required body sections (Description, At the Table, Hooks).
2. **One item, one file.** Place it in the right category folder, named after its `id`:
   `items/gear/fine-bedroll.md`
3. **Name well.** `id` is kebab-case, unique, and stable (it becomes the website URL). Quality-tier variants get their own files: `shoddy-bedroll.md`, `fine-bedroll.md`.
4. **Check yourself** against the checklist at the bottom of the template before opening the PR.
5. **Open a pull request** with a title like `Add item: Fine Bedroll` and a sentence on why it earns its place.

## Review Criteria

Maintainers review PRs against five questions:

1. **Template compliance** — does the YAML validate and are all sections present?
2. **Earns its place** — at least one real mechanical or narrative hook? No filler.
3. **Pricing consistency** — follows `docs/pricing-guide.md` and doesn't contradict SRD prices?
4. **License safety** — no closed IP: no named settings, characters, or monsters outside SRD 5.1 / ORC content. When in doubt, ask in the PR.
5. **Balance discipline** — quality tiers and mundane items stay out of combat math (situational benefits only).

Expect friendly feedback rather than rejection — most PRs get merged after a round of tweaks.

## Style Notes (short version)

- Descriptions in second person present tense, 2–4 sentences, sensory and concrete.
- "At the Table" bullets describe *moments of play*, not rules restatements.
- Hooks should raise a question or point at a person. One good hook beats three vague ones.
- Avoid naming specific deities, nations, or settings — write "a coastal duchy," not a proper noun. This keeps items drop-in for any world.

## Licensing of Contributions

By submitting a pull request, you agree to license your contribution under **CC-BY 4.0** (see [LICENSE.md](LICENSE.md)). You'll be credited in the `contributors` field of the item file and in release notes.

## Questions?

Open an issue with the `question` label, or start a thread in Discussions.

