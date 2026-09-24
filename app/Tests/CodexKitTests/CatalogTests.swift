import XCTest
@testable import CodexKit

final class CatalogTests: XCTestCase {
    private func sample() throws -> Catalog {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "sample", withExtension: "json", subdirectory: "Fixtures"))
        return try Catalog.decode(from: Data(contentsOf: url))
    }

    func testDecodesExport() throws {
        let catalog = try sample()
        XCTAssertEqual(catalog.items.count, 3)

        let backpack = try XCTUnwrap(catalog.item(id: "fine-backpack"))
        XCTAssertEqual(backpack.name, "Fine Backpack")
        XCTAssertEqual(backpack.category, .gear)
        XCTAssertEqual(backpack.grade, "fine")
        XCTAssertEqual(backpack.soldBy, ["outfitter", "leatherworker", "adventurers-guild"])
        XCTAssertEqual(backpack.atTheTable.count, 2)
        XCTAssertEqual(backpack.orderedSystems.map(\.system.title), ["5e", "PF2e"])
        XCTAssertEqual(backpack.price.entries.map(\.market), ["Village", "City", "Scarcity"])
    }

    func testItemWithoutPrice() throws {
        let lantern = try XCTUnwrap(try sample().item(id: "the-first-lantern"))
        XCTAssertTrue(lantern.price.isEmpty)
        XCTAssertEqual(lantern.grade, "legendary")
    }

    func testCategoriesKeepCanonicalOrder() throws {
        XCTAssertEqual(try sample().categories, [.gear, .consumable, .magic])
    }

    func testSearch() throws {
        let catalog = try sample()
        XCTAssertEqual(catalog.search("").count, 3)
        XCTAssertEqual(catalog.search("BACKPACK").map(\.id), ["fine-backpack"])
        XCTAssertEqual(catalog.search("fine stealth").map(\.id), ["fine-backpack"])
        XCTAssertEqual(catalog.search("collector").map(\.id), ["the-first-lantern"])
        XCTAssertEqual(catalog.search("", in: .consumable).map(\.id), ["acid-etch-vial"])
        XCTAssertTrue(catalog.search("backpack", in: .magic).isEmpty)
    }

    func testRejectsUnknownFormat() {
        let data = Data(#"{"format": 99, "license": "CC-BY-4.0", "items": []}"#.utf8)
        XCTAssertThrowsError(try Catalog.decode(from: data)) { error in
            XCTAssertEqual(error as? Catalog.LoadError, .unsupportedFormat(99))
        }
    }
}
