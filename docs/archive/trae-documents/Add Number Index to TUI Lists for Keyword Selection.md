I will update the TUI list items to include index numbers in their titles and filter values. This will allow users to select items using keywords (numbers and letters) via the filter function.

**1. Modify `internal/tui/clean.go`**

*   **Refactor `pathItem`**: Change it from a `string` alias to a `struct { path string; index int }` to support index storage.
*   **Update `cleanRuleItem`**: Add an `index int` field.
*   **Update `Title()` and `FilterValue()`**: Update these methods for both types to include the index (e.g., "1. Maven").
*   **Update Initialization**:
    *   In `NewCleanModel`: Initialize rules with indices (1-based).
    *   In `restoreRuleList`: Re-initialize rules with indices.
    *   In `enterPathSelectState`: Initialize paths with indices.
*   **Update Usage**:
    *   In `Update` method: Fix type assertions and value access for `pathItem` (use `.path` instead of `string(i)`).
    *   In `pathItemDelegate.Render`: Ensure title rendering uses the new `Title()` method which includes the number.

This enables filtering by "1", "2" etc., satisfying the request for number-based selection.