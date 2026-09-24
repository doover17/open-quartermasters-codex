// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "CodexKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "CodexKit", targets: ["CodexKit"]),
    ],
    targets: [
        .target(name: "CodexKit"),
        .testTarget(
            name: "CodexKitTests",
            dependencies: ["CodexKit"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
