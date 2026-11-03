# TUI Condition Editor Improvements

I will implement the following changes to `internal/tui/finder_condition.go` and `internal/find/builder.go` to address your 4 requests.

## 1. Fix Unit Duplication (Terminal #6-6)

* **Problem**: Repeatedly entering edit mode causes units to stack (e.g., `100kM`).

* **Fix**:

  * In `enterRawValueEditMode`, strip existing unit suffixes (`k`, `M`, `G`, `c`) from the value before editing.

  * Update `handleKey` to include `c` (bytes) in the unit rotation cycle (`c` <-> `k` <-> `M` <-> `G`).

## 2. Improved Ungroup Logic (Ctrl+Shift+A)

* **Problem**: Current ungroup just clears markers; logic needs to be smarter for groups of size 2 vs >2.

* **Fix**: Implement `ungroupSelection` method:

  * **Size = 2**: If a group has exactly 2 items, removing one cancels the *entire group* (removes Start/End markers).

  * **Size > 2**: If > 2 items, "cancel the selected one" means removing it from the group:

    * If Start item selected: Remove Start, set next item as Start.

    * If End item selected: Remove End, set previous item as End.

    * If Middle item selected: Split the group into two (Start..Selected-1) and (Selected+1..End).

  * **Restriction**: Prevent ungrouping if multiple items are selected (as per "Cannot cancel multiple").

## 3. Dynamic Preview & Column Width

* **Problem**: Preview box doesn't align; Value column is fixed width.

* **Fix**:

  * **Dynamic Width**: In `SetSize`, calculate `Value` column width dynamically: `WindowWidth - FixedColumns(51)`.

  * **Preview Box**: Set preview box width to match the table exactly. Enable text wrapping (`Wrap(true)`) so long queries grow vertically instead of truncating.

  * **Value Cell**: Enable wrapping for the value cell if content exceeds width.

## 4. Add Condition to Existing Group

* **Problem**: Cannot add a new condition *inside* an existing group (currently appends to end).

* **Fix**:

  * Add `InsertCondition(index, fieldID)` to `ConditionBuilder`.

  * Modify `Ctrl+N` to **insert after current row** instead of appending to the end. This allows adding conditions inside a group by selecting a row within that group.

  * Update `ConditionBuilder` to correctly shift group Start/End markers when inserting.

## Files to Modify

1. `internal/tui/finder_condition.go` (UI Logic)
2. `internal/find/builder.go` (Data Logic: Insert & Shift)

