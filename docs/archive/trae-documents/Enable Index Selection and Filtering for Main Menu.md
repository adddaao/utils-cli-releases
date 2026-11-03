I will enable index-based selection and filtering for the Main Menu, similar to the Clean module.

**1. Modify `internal/tui/main_menu.go`**

*   **Refactor `item`**: Change it from `string` alias to `struct { id string; title string; index int }` to support index and filtering.
*   **Update `FilterValue()`**: Implement it to return the index and title (e.g., "1 Docker").
*   **Enable Filtering**: In `NewMainMenuModel`, remove `l.SetFilteringEnabled(false)`.
*   **Update `itemDelegate.Render`**:
    *   Use the new struct fields for rendering the title with index.
    *   Handle special cases like "Update" (index 0) and "Exit" (index 'q') logically or visually, but allow filtering by "0" or "q" (or just "exit").
*   **Update `NewMainMenuModel`**: Initialize items with explicit indices and titles.
    *   Docker: 1
    *   Clean: 2
    *   Firewall: 3
    *   Update: 0
    *   Exit: (No number, maybe just 'q' or keep it last)
*   **Update `Update`**: Handle selection based on the new struct type.

This ensures the Main Menu also supports "1", "2", etc., via the filter mechanism.