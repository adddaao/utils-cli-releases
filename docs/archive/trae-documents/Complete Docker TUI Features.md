I will implement the missing Docker functionalities (Image List, Save, Load) and integrate them into the TUI.

1.  **Backend Implementation (`internal/docker/image_ops.go`)**:
    *   Create `internal/docker/image_ops.go` to implement `SaveImage` (docker save) and `LoadImage` (docker load).
    *   This addresses the missing "Import/Export" logic.

2.  **TUI Update (`internal/tui/docker.go`)**:
    *   **Menu Update**: Add "List Images", "Export Image", "Import Image" to the Docker menu with indices 3, 4, 5.
    *   **State Management**: Add states for image listing (`dockerStateListImages`), export selection (`dockerStateExportSelect`), export filename input (`dockerStateExportInput`), and import filename input (`dockerStateImportInput`).
    *   **Image Listing**: Use `docker.ListImages` to fetch data and populate the TUI list for viewing and selection.
    *   **Export Flow**: Select "Export" -> Select Image from List -> Enter Filename -> Run `SaveImage`.
    *   **Import Flow**: Select "Import" -> Enter Filename -> Run `LoadImage`.
    *   **UI Components**: Use `bubbles/textinput` for filename entry and `bubbles/list` for image selection.

3.  **Refactoring**:
    *   Ensure the new list views support the same numbered selection/filtering as the main menu.

This will restore the missing capabilities and align the Docker module with the new TUI framework.