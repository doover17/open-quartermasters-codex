import SwiftUI
import CodexKit

/// A full item entry, laid out in the same order as the markdown file.
struct ItemDetailView: View {
    let item: Item

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                facts
                section("Description") { markdown(item.description) }
                section("At the Table") {
                    ForEach(item.atTheTable, id: \.self) { moment in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("•")
                            markdown(moment)
                        }
                    }
                }
                section("Hooks") { markdown(item.hooks) }
                section("Mechanics") {
                    ForEach(item.orderedSystems, id: \.system) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(entry.system.title)
                                .font(.subheadline.bold())
                            markdown(entry.mechanics)
                        }
                    }
                }
                footer
            }
            .padding()
            .frame(maxWidth: 700, alignment: .leading)
        }
        .navigationTitle(item.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.name)
                .font(.largeTitle.bold())
            Text([item.grade?.capitalized, item.subcategory, item.category.title]
                .compactMap { $0 }
                .joined(separator: " · "))
                .foregroundStyle(.secondary)
        }
    }

    private var facts: some View {
        Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
            ForEach(item.price.entries, id: \.market) { entry in
                fact(entry.market, entry.price)
            }
            fact("Resale", item.resale)
            fact("Weight", item.weight)
            fact("Availability", item.availability.replacingOccurrences(of: "-", with: " "))
            fact("Sold by", item.soldBy.map { $0.replacingOccurrences(of: "-", with: " ") }.joined(separator: ", "))
        }
        .font(.callout)
        .padding()
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
    }

    private var footer: some View {
        Text("\(item.license) · \(item.contributors.joined(separator: ", "))")
            .font(.caption)
            .foregroundStyle(.tertiary)
    }

    private func fact(_ label: String, _ value: String) -> some View {
        GridRow {
            Text(label).foregroundStyle(.secondary)
            Text(value)
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.title3.bold())
            content()
        }
    }

    /// Entries use light inline markdown (*italics*, **bold**).
    private func markdown(_ text: String) -> Text {
        Text((try? AttributedString(markdown: text)) ?? AttributedString(text))
    }
}
