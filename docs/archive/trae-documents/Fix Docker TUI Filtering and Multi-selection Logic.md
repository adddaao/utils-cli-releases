I will fix the issues in the Docker TUI module (`internal/tui/docker.go`) related to filtering and multi-selection.

1.  **Refactor `dockerItem`**: Add a field to store the original data (`docker.Image` or `string` path) to avoid fragile string parsing.
2.  **Fix Multi-select Logic**:
    *   Change the selection toggling logic to correctly handle filtered lists.
    *   Instead of using `m.imageList.Index()` directly on `m.imageList.Items()`, I will:
        *   Get the currently selected item using `m.imageList.SelectedItem()`.
        *   Iterate through the full list (`m.imageList.Items()`) to find the matching item by ID.
        *   Update the `selected` status in the full list.
        *   Use `m.imageList.SetItems()` to update the model.
    *   This ensures that even when filtering is active, the correct item is selected/deselected.
3.  **Fix "Enter" (Submit) Logic**:
    *   Ensure the final collection of selected items iterates over the updated full list and checks the `selected` status.
    *   Use the stored original data instead of parsing `Repo:Tag` strings.

This will resolve the "filtering not working" (likely due to index mismatch corruption) and "multi-select not working" issues.