import SwiftUI
import CodexKit

@main
struct CodexApp: App {
    private let catalog: Result<Catalog, Error> = Result { try Catalog.load() }

    var body: some Scene {
        WindowGroup {
            switch catalog {
            case .success(let catalog):
                RootView(catalog: catalog)
            case .failure(let error):
                ContentUnavailableView(
                    "Couldn't open the Codex",
                    systemImage: "book.closed",
                    description: Text(error.localizedDescription)
                )
            }
        }
    }
}
