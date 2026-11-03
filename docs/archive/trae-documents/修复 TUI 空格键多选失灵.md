# TUI 多选按键失灵修复

针对用户反馈的 "非筛选状态下空格键失灵不能多选" 问题，制定以下修复计划。

## 1. 问题分析 (`internal/tui/clean.go`)
- **KeyMap 配置**: 虽然我们创建了 `multiSelectKeyMap` 并尝试在 `AdditionalFullHelpKeys` 中注册，但 `bubbles/list` 组件本身并不自动处理这些额外的 KeyBinding。它只是在帮助视图中显示它们。
- **消息传递顺序**: 在 `CleanModel.Update` 中，我们试图通过 `key.Matches(msg, m.multiKeys.toggle)` 来捕获空格键。
  - 但是，`bubbles/list` 组件内部可能已经消费了空格键（例如用于翻页或其他操作，尽管默认 KeyMap 中空格通常未绑定）。
  - 更可能的原因是：`key.Matches` 检查的是 `msg`，而 `msg` 可能是 `tea.KeyMsg`。如果 `m.multiKeys.toggle` 的定义与实际接收到的按键消息不匹配（例如 key binding 设置了 "space" 但实际收到的是 " "），匹配就会失败。
- **Key Binding 定义**: 在 `internal/tui/util.go` 中，`newMultiSelectKeyMap` 使用了 `key.WithKeys("space")`。Bubble Tea 中，空格键的字符串表示通常是 `" "` (实际空格字符)，但也支持 `"space"` 别名。需要确认 `bubbletea` 版本对 `"space"` 的支持情况，或者直接绑定 `" "`。

## 2. 修复方案
- **确保 KeyBinding 匹配**: 将 `key.WithKeys("space")` 修改为同时支持 `" "` 和 `"space"`，即 `key.WithKeys(" ", "space")`，以防万一。
- **消息处理优先级**: 保持当前的逻辑，即先检查自定义按键，再调用 `m.list.Update`。
- **调试/验证**: 由于 `bubbles/list` 可能会在其 `Update` 中处理按键，我们必须在调用 `m.list.Update` 之前拦截我们关心的按键。目前的逻辑正是如此，所以重点在于 KeyBinding 的匹配是否正确。

## 3. 实施步骤

1. **修改 `internal/tui/util.go`**:
   - 更新 `newMultiSelectKeyMap`，将 `toggle` 的键绑定改为 `key.WithKeys(" ", "space")`。

2. **检查 `internal/tui/clean.go`**:
   - 确认 `Update` 方法中对 `key.Matches` 的调用在 `m.list.Update` 之前（已确认）。
   - 确保没有其他逻辑提前返回。

3. **额外保险**:
   - 可以在 `Update` 中直接检查 `msg.String() == " "`，作为 `key.Matches` 的备选方案。

