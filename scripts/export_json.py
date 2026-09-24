#!/usr/bin/env python3
"""
export_json.py — The Open Quartermaster's Codex JSON export

Compiles every item under items/ into one JSON file: the front matter plus
the three body sections (Description, At the Table, Hooks). This is the
"data export" output from the README, and the bundle the Swift app ships.
Run from the repo root:

    python3 scripts/export_json.py                  # writes app/Codex/Resources/codex.json
    python3 scripts/export_json.py path/to/out.json
    python3 scripts/export_json.py --check          # exit 1 if the bundle is stale

Output is deterministic (sorted, no timestamps) so the file diffs cleanly.
"""

import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML required: pip install pyyaml")

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "app" / "Codex" / "Resources" / "codex.json"
SECTIONS = {"Description": "description", "At the Table": "at_the_table", "Hooks": "hooks"}


def split_item(text, path):
    if not text.startswith("---\n"):
        raise ValueError(f"{path}: missing YAML front matter")
    _, front, body = text.split("---\n", 2)
    return yaml.safe_load(front), body


def parse_sections(body):
    sections, current = {}, None
    for line in body.splitlines():
        if line.startswith("## "):
            current = SECTIONS.get(line[3:].strip())
            if current:
                sections[current] = []
        elif current:
            sections[current].append(line)
    out = {k: "\n".join(v).strip() for k, v in sections.items()}
    if "at_the_table" in out:
        out["at_the_table"] = [
            l[2:].strip() for l in out["at_the_table"].splitlines() if l.startswith("- ")
        ]
    return out


def export_item(path):
    front, body = split_item(path.read_text(encoding="utf-8"), path)
    sections = parse_sections(body)
    item = {
        "id": front["id"],
        "name": front["name"],
        "category": front["category"],
        "subcategory": front.get("subcategory"),
        "quality": front.get("quality"),
        "rarity": front.get("rarity"),
        "price": {k: str(v) for k, v in (front.get("price") or {}).items()},
        "resale": str(front.get("resale", "")),
        "weight": str(front.get("weight", "")),
        "availability": front["availability"],
        "sold_by": front.get("sold_by", []),
        "systems": {
            name: {"mechanics": (block or {}).get("mechanics", "")}
            for name, block in front["systems"].items()
        },
        "tags": front.get("tags", []),
        "contributors": front.get("contributors", []),
        "license": front["license"],
        "description": sections.get("description", ""),
        "at_the_table": sections.get("at_the_table", []),
        "hooks": sections.get("hooks", ""),
    }
    return {k: v for k, v in item.items() if v is not None}


def build():
    items = [export_item(p) for p in sorted((ROOT / "items").glob("*/*.md"))]
    items.sort(key=lambda i: (i["category"], i["name"].lower()))
    payload = {"format": 1, "license": "CC-BY-4.0", "items": items}
    return len(items), json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def main(argv):
    check = "--check" in argv
    args = [a for a in argv if a != "--check"]
    out = Path(args[0]) if args else DEFAULT_OUT
    count, data = build()
    if check:
        if not out.exists() or out.read_text(encoding="utf-8") != data:
            print(f"{out} is stale — run scripts/export_json.py")
            return 1
        print(f"{out} is up to date")
        return 0
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(data, encoding="utf-8")
    print(f"Wrote {count} items to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
