import Foundation

/// The whole compendium, loaded from the JSON export.
public struct Catalog: Codable, Sendable {
    public static let supportedFormat = 1

    public let format: Int
    public let license: String
    public let items: [Item]

    public enum LoadError: Error, Equatable {
        case missingResource(String)
        case unsupportedFormat(Int)
    }

    public init(format: Int = Catalog.supportedFormat, license: String = "CC-BY-4.0", items: [Item]) {
        self.format = format
        self.license = license
        self.items = items
    }

    public static func decode(from data: Data) throws -> Catalog {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let catalog = try decoder.decode(Catalog.self, from: data)
        guard catalog.format == supportedFormat else {
            throw LoadError.unsupportedFormat(catalog.format)
        }
        return catalog
    }

    public static func load(named name: String = "codex", in bundle: Bundle = .main) throws -> Catalog {
        guard let url = bundle.url(forResource: name, withExtension: "json") else {
            throw LoadError.missingResource("\(name).json")
        }
        return try decode(from: Data(contentsOf: url))
    }

    public func item(id: String) -> Item? {
        items.first { $0.id == id }
    }

    /// Categories that actually have items, in `Category.allCases` order.
    public var categories: [Category] {
        let present = Set(items.map(\.category))
        return Category.allCases.filter(present.contains)
    }

    /// Items matching an optional category and a free-text query.
    /// The query matches name, subcategory, tags, and seller types, case- and diacritic-insensitively;
    /// every whitespace-separated word must match somewhere.
    public func search(_ query: String, in category: Category? = nil) -> [Item] {
        let words = query.split(whereSeparator: \.isWhitespace).map(String.init)
        return items.filter { item in
            guard category == nil || item.category == category else { return false }
            let haystack = ([item.name, item.subcategory ?? ""] + item.tags + item.soldBy)
                .joined(separator: " ")
            return words.allSatisfy {
                haystack.range(of: $0, options: [.caseInsensitive, .diacriticInsensitive]) != nil
            }
        }
    }
}
