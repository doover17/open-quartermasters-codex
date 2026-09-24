import SwiftUI
import CodexKit

/// Sidebar of categories → searchable item list → item entry.
struct RootView: View {
    let catalog: Catalog

    @State private var category: Category?
    @State private var selection: Item.ID?
    @State private var query = ""

    private var results: [Item] { catalog.search(query, in: category) }

    var body: some View {
        NavigationSplitView {
            List(selection: $category) {
                Label("All Items", systemImage: "books.vertical")
                    .badge(catalog.items.count)
                    .tag(Category?.none)
                Section("Categories") {
                    ForEach(catalog.categories) { category in
                        Label(category.title, systemImage: category.symbol)
                            .badge(catalog.search("", in: category).count)
                            .tag(Category?.some(category))
                    }
                }
            }
            .navigationTitle("The Codex")
        } content: {
            List(results, selection: $selection) { item in
                ItemRow(item: item)
            }
            .overlay {
                if results.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
            .searchable(text: $query, prompt: "Name, tag, or seller")
            .navigationTitle(category?.title ?? "All Items")
        } detail: {
            if let id = selection, let item = catalog.item(id: id) {
                ItemDetailView(item: item)
            } else {
                ContentUnavailableView("Pick an item", systemImage: "bag")
            }
        }
    }
}

struct ItemRow: View {
    let item: Item

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(item.name)
                .font(.headline)
            HStack(spacing: 6) {
                if let grade = item.grade {
                    Text(grade.capitalized)
                }
                if let subcategory = item.subcategory {
                    Text(subcategory.replacingOccurrences(of: "-", with: " "))
                }
                if let price = item.price.city {
                    Text(price)
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }
}
