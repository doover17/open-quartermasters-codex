# ``WelcomeWindow``

A highly customizable welcome window built for macOS applications. This package supports NSDocument-based apps and offers the ability to override the recent list for other use cases. It's designed to provide a native and elegant welcome experience for your app at launch, with support for new/open document actions, drag-and-drop functionality, and dynamic layouts.

## Overview

To use welcome window, simply import the package

```swift
import WelcomeWindow
```

And add it as a window in your SwiftUI App.

```swift
@main
struct CodeEditApp: App {
    @Environment(\.dismiss) private var dismiss

    var body: some Scene {
        WelcomeWindow(
            // Add two action buttons below your icon
            actions: { dismiss in
                WelcomeButton(
                    iconName: "circle.fill",
                    title: "New Text Document",
                    action: {
                        NSDocumentController.shared.createFileDocumentWithDialog(
                            configuration: .init(title: "Create new text document"),
                            onCompletion: { dismiss() }
                        )
                    }
                )
                WelcomeButton(
                    iconName: "triangle.fill",
                    title: "Open Text Document or Folder",
                    action: {
                        NSDocumentController.shared.openDocumentWithDialog(
                            configuration: .init(canChooseDirectories: true),
                            onDialogPresented: { dismiss() },
                            onCancel: { openWindow(id: "welcome") }
                        )
                    }
                )
            },
            // Receive files via drag and drop
            onDrop: { url, dismiss in
                print("File dropped at: \(url.path)")

                Task {
                    NSDocumentController.shared.openDocument(at: url, onCompletion: { dismiss() })
                }
            }
        )
    }
}
```

## Topics

### Example App

A great way to get started is by checking out the example app in the `Example` folder.

### Window Configuration

- ``WelcomeWindow`` This window creates the styled window that is the core of WelcomeWindow.
- ``WelcomeButton`` Use welcome buttons to create pre-designed buttons to go in your welcome window. These are common actions users may take to start a project, open an old project, or navigate somewhere useful in your app.

### Recent Projects List

- ``RecentsStore`` stores a list of bookmarked files or folders that your users can open from the welcome window. Call ``RecentsStore/documentOpened(at:)`` to tell the recents store about an opened document. The store will trim items to 100 history automatically, so don't worry about space or memory usage and call it often.
