import Foundation

/// One Codex item, as exported by `scripts/export_json.py`.
public struct Item: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let category: Category
    public let subcategory: String?
    public let quality: String?
    public let rarity: String?
    public let price: Price
    public let resale: String
    public let weight: String
    public let availability: String
    public let soldBy: [String]
    public let systems: [String: SystemBlock]
    public let tags: [String]
    public let contributors: [String]
    public let license: String
    public let description: String
    public let atTheTable: [String]
    public let hooks: String

    /// Quality tier for mundane items, rarity for magic ones.
    public var grade: String? { rarity ?? quality }

    /// Mechanics for a game system, in display order (5e first, then PF2e, then anything else).
    public var orderedSystems: [(system: GameSystem, mechanics: String)] {
        systems
            .map { (system: GameSystem(rawValue: $0.key), mechanics: $0.value.mechanics) }
            .sorted { $0.system.sortOrder < $1.system.sortOrder }
    }
}

public enum Category: String, Codable, CaseIterable, Identifiable, Sendable {
    case gear, consumable, weapon, armor, magic
    case tradeGood = "trade-good"

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .gear: "Gear"
        case .consumable: "Consumables"
        case .weapon: "Weapons"
        case .armor: "Armor"
        case .magic: "Magic"
        case .tradeGood: "Trade Goods"
        }
    }

    public var symbol: String {
        switch self {
        case .gear: "backpack"
        case .consumable: "flask"
        case .weapon: "hammer"
        case .armor: "shield"
        case .magic: "sparkles"
        case .tradeGood: "scalemass"
        }
    }
}

/// Prices by market. Legendary items may have none.
public struct Price: Codable, Hashable, Sendable {
    public let village: String?
    public let city: String?
    public let scarcity: String?

    public var isEmpty: Bool { village == nil && city == nil && scarcity == nil }

    /// Labelled prices in market order, skipping the ones not set.
    public var entries: [(market: String, price: String)] {
        let all: [(String, String?)] = [("Village", village), ("City", city), ("Scarcity", scarcity)]
        return all.compactMap { entry in entry.1.map { (market: entry.0, price: $0) } }
    }
}

public struct SystemBlock: Codable, Hashable, Sendable {
    public let mechanics: String
}

public struct GameSystem: Hashable, Sendable {
    public let rawValue: String

    public init(rawValue: String) {
        self.rawValue = rawValue
    }

    public var title: String {
        switch rawValue {
        case "dnd5e": "5e"
        case "pf2e": "PF2e"
        default: rawValue
        }
    }

    var sortOrder: Int {
        switch rawValue {
        case "dnd5e": 0
        case "pf2e": 1
        default: 2
        }
    }
}
