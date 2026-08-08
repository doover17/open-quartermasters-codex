#!/usr/bin/env python3
"""
validate_items.py — The Open Quartermaster's Codex validator (v2)

Validates items/, shops/, and loot-tables/ against their templates, and
cross-checks that every shop stock line and loot bundle entry references
a real merged item id. Run from the repo root:

    python3 scripts/validate_items.py             # validate everything
    python3 scripts/validate_items.py items/gear  # validate one folder

Exit code 0 = all clean, 1 = errors found (warnings don't fail the run).
"""

import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML required: pip install pyyaml")

# ---------------------------------------------------------------- config

VALID_CATEGORIES = {"gear", "consumable", "weapon", "armor", "magic", "trade-good"}
CATEGORY_FOLDERS = {  # folder name -> expected category value
    "gear": "gear", "consumables": "consumable", "weapons": "weapon",
    "armor": "armor", "magic": "magic", "trade-goods": "trade-good",
}
VALID_QUALITIES = {"shoddy", "common", "fine", "masterwork"}
VALID_RARITIES = {"common", "uncommon", "rare", "very-rare", "legendary"}
VALID_AVAILABILITY = {"common", "uncommon", "special-order", "illegal"}
REQUIRED_FIELDS = ["id", "name", "category", "price", "availability", "systems", "license"]
REQUIRED_SECTIONS = ["## Description", "## At the Table", "## Hooks"]

# Shops (docs/shop-template.md)
SHOP_REQUIRED = ["id", "name", "type", "settlement", "price_mod", "haggle", "stock", "license"]
SHOP_SECTIONS = ["## The Shop", "## The Merchant", "## Behind the Counter", "## Hooks"]
VALID_SHOP_TYPES = {
    "general-store", "outfitter", "blacksmith", "alchemist", "chandler", "tanner",
    "fence", "pawnbroker", "provisioner", "locksmith", "curiosities", "market-stall",
}
VALID_SETTLEMENTS = {"village", "town", "city", "crossroads", "frontier"}
VALID_HAGGLE = {"eager", "open", "reluctant", "fixed-prices", "insulted-by-it"}

# Loot bundles (docs/loot-table-template.md)
LOOT_REQUIRED = ["id", "name", "context", "tier", "coin", "items", "license"]
LOOT_SECTIONS = ["## The Scene", "## The Finds", "## Hooks"]
VALID_TIERS = {"low", "mid", "high"}

PRICE_RE = re.compile(r"^\d+(?:,\d{3})*\s(?:gp|sp|cp)$")
BANNED_WORDS = re.compile(r"\b(simply|very|quite)\b|\bjust\b(?!ice)", re.IGNORECASE)
BANNED_PHRASES = ["this item can be used to", "the dm may decide", "the gm may decide"]
# Withheld-answer hook endings (style guide: "withholding is not an ending")
WITHHELD_ENDING = re.compile(
    r"(won'?t|will not|refuses? to|declines? to)\s+(say|speak|discuss|explain|answer|tell)",
    re.IGNORECASE,
)
# Closed-IP tripwires (non-SRD monsters/settings). Extend as needed.
CLOSED_IP = re.compile(
    r"\b(beholder|mind flayer|illithid|yuan-ti|githyanki|githzerai|displacer beast|"
    r"carrion crawler|umber hulk|slaad|kender|drizzt|waterdeep|baldur'?s gate|"
    r"faer[uû]n|forgotten realms|greyhawk|eberron|ravenloft|strahd|golarion|absalom)\b",
    re.IGNORECASE,
)

errors, warnings = [], []


def err(f, msg):
    errors.append(f"  ERROR {f}: {msg}")


def warn(f, msg):
    warnings.append(f"  warn  {f}: {msg}")


def check_hook_ending(f, body):
    """Style guide: 'withholding is not an ending.' Applies to every content type.

    The rule is about how a hook *ends*, so this tests the final sentence only.
    An NPC declining to answer partway through a hook is legitimate characterization;
    it's only a problem when it's the last thing the DM reads.
    """
    hooks = body.split("## Hooks", 1)
    if len(hooks) != 2:
        return
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", hooks[1].strip()) if s.strip()]
    if sentences and WITHHELD_ENDING.search(sentences[-1]):
        warn(f, "hook ends on a withheld answer ('won't say') — end on the describable detail")


# ---------------------------------------------------------------- checks

def split_file(text):
    """Return (front_matter_str, body_str) or (None, None) if malformed."""
    if not text.startswith("---"):
        return None, None
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None, None
    return parts[1], parts[2]


def check_price_block(f, price):
    if not isinstance(price, dict):
        err(f, "price must be a mapping of location -> value")
        return
    for loc, val in price.items():
        if loc not in {"village", "city", "scarcity"}:
            err(f, f"unknown price location '{loc}'")
        if isinstance(val, str) and val != "—" and not PRICE_RE.match(val):
            err(f, f"price '{val}' not in 'N gp/sp/cp' format")


def check_item(path: Path, seen_ids: dict):
    f = str(path)
    text = path.read_text(encoding="utf-8")
    fm_str, body = split_file(text)
    if fm_str is None:
        err(f, "missing or malformed YAML front matter (--- fences)")
        return

    try:
        fm = yaml.safe_load(fm_str)
    except yaml.YAMLError as e:
        err(f, f"YAML parse failure: {e}")
        return
    if not isinstance(fm, dict):
        err(f, "front matter is not a mapping")
        return

    # Required fields
    for field in REQUIRED_FIELDS:
        if field not in fm:
            err(f, f"missing required field '{field}'")

    # id rules
    iid = fm.get("id", "")
    if iid:
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", iid):
            err(f, f"id '{iid}' is not kebab-case")
        if path.stem != iid:
            err(f, f"filename '{path.stem}' does not match id '{iid}'")
        if iid in seen_ids:
            err(f, f"duplicate id '{iid}' (also in {seen_ids[iid]})")
        seen_ids[iid] = f

    # category vs folder
    cat = fm.get("category")
    if cat and cat not in VALID_CATEGORIES:
        err(f, f"invalid category '{cat}'")
    folder = path.parent.name
    expected = CATEGORY_FOLDERS.get(folder)
    if expected and cat and cat != expected:
        err(f, f"category '{cat}' but file lives in items/{folder}/ (expected '{expected}')")

    # enums
    if "quality" in fm and fm["quality"] not in VALID_QUALITIES:
        err(f, f"invalid quality '{fm['quality']}'")
    if "rarity" in fm and fm["rarity"] not in VALID_RARITIES:
        err(f, f"invalid rarity '{fm['rarity']}'")
    if fm.get("availability") not in VALID_AVAILABILITY:
        err(f, f"invalid availability '{fm.get('availability')}'")
    if fm.get("license") != "CC-BY-4.0":
        err(f, f"license must be 'CC-BY-4.0', got '{fm.get('license')}'")

    # price
    if "price" in fm:
        check_price_block(f, fm["price"])

    # systems blocks
    systems = fm.get("systems") or {}
    for sys_name in ("dnd5e", "pf2e"):
        block = systems.get(sys_name)
        if not block or not block.get("mechanics"):
            warn(f, f"missing systems.{sys_name}.mechanics (TODO conversion?)")
        elif "TODO" in str(block.get("mechanics", "")):
            warn(f, f"systems.{sys_name} flagged TODO")

    # combat-math tripwire for mundane/quality items (magic exempt)
    if cat != "magic":
        mech_text = " ".join(str(systems.get(s, {}).get("mechanics", "")) for s in systems)
        if re.search(r"\+\d+\s+(to\s+)?(attack|damage|AC)\b", mech_text, re.IGNORECASE):
            err(f, "mundane item mechanics touch combat math (+X attack/damage/AC)")

    # body sections in order
    positions = []
    for sec in REQUIRED_SECTIONS:
        pos = body.find(sec)
        if pos == -1:
            err(f, f"missing body section '{sec}'")
        positions.append(pos)
    if all(p != -1 for p in positions) and positions != sorted(positions):
        err(f, "body sections out of order (Description, At the Table, Hooks)")

    # style checks (warnings only — reviewer judgment applies)
    desc_match = re.search(r"## Description\s+(.+?)(?=\n## )", body, re.DOTALL)
    if desc_match:
        desc = desc_match.group(1).strip()
        sentences = len(re.findall(r"[.!?](?:\s|$)", desc))
        if sentences > 5:
            warn(f, f"Description is ~{sentences} sentences (guide says 2–4)")
    for m in BANNED_WORDS.finditer(body):
        warn(f, f"style-guide word to avoid: '{m.group(0)}'")
    lower = body.lower()
    for phrase in BANNED_PHRASES:
        if phrase in lower:
            warn(f, f"banned phrase: '{phrase}'")
    check_hook_ending(f, body)

    # closed-IP check runs on the whole file — this one is an error
    for m in CLOSED_IP.finditer(text):
        err(f, f"possible closed IP: '{m.group(0)}'")


# ------------------------------------------------- shared helpers (v2)

def load_front_matter(path: Path):
    """Return (fm_dict, body) or (None, None) with an error logged."""
    f = str(path)
    text = path.read_text(encoding="utf-8")
    fm_str, body = split_file(text)
    if fm_str is None:
        err(f, "missing or malformed YAML front matter (--- fences)")
        return None, None
    try:
        fm = yaml.safe_load(fm_str)
    except yaml.YAMLError as e:
        err(f, f"YAML parse failure: {e}")
        return None, None
    if not isinstance(fm, dict):
        err(f, "front matter is not a mapping")
        return None, None
    return fm, body


def check_common(path: Path, fm: dict, body: str, required, sections, seen_ids: dict):
    """Checks shared by all content types: fields, id, sections, license, style, IP."""
    f = str(path)
    for field in required:
        if field not in fm:
            err(f, f"missing required field '{field}'")
    iid = fm.get("id", "")
    if iid:
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", iid):
            err(f, f"id '{iid}' is not kebab-case")
        if path.stem != iid:
            err(f, f"filename '{path.stem}' does not match id '{iid}'")
        if iid in seen_ids:
            err(f, f"duplicate id '{iid}' (also in {seen_ids[iid]})")
        seen_ids[iid] = f
    if fm.get("license") != "CC-BY-4.0":
        err(f, f"license must be 'CC-BY-4.0', got '{fm.get('license')}'")
    positions = []
    for sec in sections:
        pos = body.find(sec)
        if pos == -1:
            err(f, f"missing body section '{sec}'")
        positions.append(pos)
    if all(p != -1 for p in positions) and positions != sorted(positions):
        err(f, f"body sections out of order ({', '.join(s[3:] for s in sections)})")
    for m in BANNED_WORDS.finditer(body):
        warn(f, f"style-guide word to avoid: '{m.group(0)}'")
    lower = body.lower()
    for phrase in BANNED_PHRASES:
        if phrase in lower:
            warn(f, f"banned phrase: '{phrase}'")
    # withheld-answer endings in the Hooks section (style guide v2 rule)
    check_hook_ending(f, body)
    for m in CLOSED_IP.finditer(fm.get("name", "") + body):
        err(f, f"possible closed IP: '{m.group(0)}'")


def iter_ref_entries(f, value, field_name):
    """Yield item-id strings from stock/items/special_order/under_counter lists."""
    if value is None:
        return
    if not isinstance(value, list):
        err(f, f"'{field_name}' must be a list")
        return
    for entry in value:
        if isinstance(entry, str):
            yield entry
        elif isinstance(entry, dict) and "item" in entry:
            yield entry["item"]
        else:
            err(f, f"'{field_name}' entry {entry!r} is neither an id string nor a mapping with 'item'")


def check_shop(path: Path, seen_ids: dict, refs: list):
    f = str(path)
    fm, body = load_front_matter(path)
    if fm is None:
        return
    check_common(path, fm, body, SHOP_REQUIRED, SHOP_SECTIONS, seen_ids)
    if fm.get("type") not in VALID_SHOP_TYPES:
        err(f, f"invalid shop type '{fm.get('type')}'")
    if fm.get("settlement") not in VALID_SETTLEMENTS:
        err(f, f"invalid settlement '{fm.get('settlement')}'")
    if fm.get("haggle") not in VALID_HAGGLE:
        err(f, f"invalid haggle value '{fm.get('haggle')}'")
    pm = fm.get("price_mod")
    if not isinstance(pm, (int, float)) or not (0.3 <= pm <= 5.0):
        err(f, f"price_mod '{pm}' must be a number between 0.3 and 5.0")
    stock = fm.get("stock") or []
    if isinstance(stock, list) and not 4 <= len(stock) <= 10:
        warn(f, f"stock has {len(stock)} lines (template says 4–10)")
    for field in ("stock", "special_order", "under_counter"):
        for iid in iter_ref_entries(f, fm.get(field), field):
            refs.append((f, field, iid))
    # quoted voice line in The Merchant section
    merch = re.search(r"## The Merchant\s+(.+?)(?=\n## )", body, re.DOTALL)
    if merch and not re.search(r"[\"“].+?[\"”]", merch.group(1)):
        warn(f, "The Merchant section has no quoted voice line")


def check_loot(path: Path, seen_ids: dict, refs: list):
    f = str(path)
    fm, body = load_front_matter(path)
    if fm is None:
        return
    check_common(path, fm, body, LOOT_REQUIRED, LOOT_SECTIONS, seen_ids)
    if fm.get("tier") not in VALID_TIERS:
        err(f, f"invalid tier '{fm.get('tier')}' (low | mid | high)")
    for iid in iter_ref_entries(f, fm.get("items"), "items"):
        refs.append((f, "items", iid))
    # every unique entry needs a bold-headed paragraph in The Finds
    uniques = fm.get("unique") or []
    if isinstance(uniques, list):
        finds = re.search(r"## The Finds\s+(.+?)(?=\n## )", body, re.DOTALL)
        finds_text = finds.group(1) if finds else ""
        bold_heads = len(re.findall(r"\*\*[^*]+\*\*", finds_text))
        if bold_heads < len(uniques):
            err(f, f"{len(uniques)} unique entries but only {bold_heads} bold-headed finds in The Finds")


# ---------------------------------------------------------------- main

def collect(root: Path, sub: str):
    d = root / sub
    if not d.exists():
        return []
    return [p for p in sorted(d.rglob("*.md")) if p.name.lower() != "readme.md"]


def main():
    if len(sys.argv) > 1:
        # single-folder mode: items-style checks only, no cross-references
        root = Path(sys.argv[1])
        if not root.exists():
            sys.exit(f"path not found: {root} (run from repo root)")
        files = [p for p in sorted(root.rglob("*.md")) if p.name.lower() != "readme.md"]
        if not files:
            sys.exit(f"no files found under {root}")
        seen: dict = {}
        for p in files:
            check_item(p, seen)
        report(len(files))
        return

    # whole-repo mode
    item_files = collect(Path("."), "items")
    shop_files = collect(Path("."), "shops")
    loot_files = collect(Path("."), "loot-tables")
    if not item_files:
        sys.exit("no item files found under items/ (run from repo root)")

    item_ids: dict = {}
    for p in item_files:
        check_item(p, item_ids)

    other_ids: dict = {}
    refs: list = []
    for p in shop_files:
        check_shop(p, other_ids, refs)
    for p in loot_files:
        check_loot(p, other_ids, refs)

    # cross-reference: every referenced id must be a merged item
    for f, field, iid in refs:
        if iid not in item_ids:
            err(f, f"{field} references '{iid}' — no such merged item id")

    total = len(item_files) + len(shop_files) + len(loot_files)
    print(f"({len(item_files)} items, {len(shop_files)} shops, {len(loot_files)} loot bundles; "
          f"{len(refs)} cross-references checked)")
    report(total)


def report(count):
    print(f"Checked {count} files.")
    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        print("\n".join(warnings))
    if errors:
        print(f"\n{len(errors)} error(s):")
        print("\n".join(errors))
        sys.exit(1)
    print("\nAll files valid. ✅")


if __name__ == "__main__":
    main()
