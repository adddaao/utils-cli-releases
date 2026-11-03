I will modify `internal/ui/select.go` to display the image size instead of the search score in the fuzzy search results.

**Change Plan:**
1.  **File:** `internal/ui/select.go`
2.  **Location:** Inside `SelectImages` function, within the fuzzy search result loop.
3.  **Action:** Update the `fmt.Printf` statement.
    -   **From:** `fmt.Printf("[%d] %-35s %-20s  score=%d\n", i, rs[i].Image.Repo, rs[i].Image.Tag, rs[i].Score)`
    -   **To:** `fmt.Printf("[%d] %-35s %-20s  %-10s\n", i, rs[i].Image.Repo, rs[i].Image.Tag, rs[i].Image.Size)`

This will restore the image size display as requested.
