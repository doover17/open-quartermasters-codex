# Codex — the Swift app

A SwiftUI app for iPhone, iPad, and Mac that puts the whole Codex in your hand at the table: browse by category, search by name, tag, or seller, and open any item's full entry (prices, description, At the Table, hooks, and 5e/PF2e mechanics).

## Layout

```
app/
├── Package.swift          ← CodexKit: models, loading, search (no UI; testable with `swift test`)
├── Sources/CodexKit/
├── Tests/CodexKitTests/   ← unit tests + a small fixture export
├── Codex/                 ← the SwiftUI app target
│   └── Resources/codex.json   ← generated item bundle (committed)
└── project.yml            ← XcodeGen spec for the app project
```

The app never parses markdown or YAML itself. `scripts/export_json.py` compiles every file under `items/` into `codex.json`, and the app ships that bundle. The same file doubles as the README's "data export" for VTT module makers.

## Running it

Requires Xcode 15+ and [XcodeGen](https://github.com/yonaskolb/XcodeGen).

```sh
brew install xcodegen
cd app
xcodegen generate      # creates Codex.xcodeproj (gitignored)
open Codex.xcodeproj
```

Pick the **Codex** scheme and run on an iOS 17 simulator or "My Mac".

## After changing items

Regenerate the bundle from the repo root and commit it with your item changes:

```sh
python3 scripts/export_json.py
```

CI runs `python3 scripts/export_json.py --check` and fails if the committed bundle is stale.

## Tests

```sh
cd app
swift test
```

## License

Covered by the repository's CC-BY 4.0 license, like everything else here (see `../LICENSES.md`).
