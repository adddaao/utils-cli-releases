# TUI 筛选与多选修复计划

针对用户反馈的 "筛选后无法取消" 和 "空格键无法选择多个" 问题，制定以下修复计划。

## 1. 筛选状态处理 (`internal/tui/clean.go`)
- **问题分析**: `bubbles/list` 组件在进入筛选模式时，默认接管了键盘输入。如果我们的 `Update` 方法没有正确地将消息传递给 `list.Model`，或者拦截了 `esc` 键导致无法退出筛选模式。
- **修复方案**:
  - 在 `CleanModel.Update` 中，检查 `m.list.FilterState()`。如果处于 `Filtering` 状态，应优先让 `m.list.Update` 处理消息，而不执行自定义的快捷键逻辑（如退出、选择等）。
  - 确保 `list` 组件正确配置了 KeyMap，能够处理 `esc` 退出筛选。

## 2. 多选按键冲突修复 (`internal/tui/clean.go`)
- **问题分析**: 用户反馈空格键无法选择多个。
  - 原因 1: `key.Matches` 匹配逻辑可能被其他逻辑覆盖。
  - 原因 2: 在 `bubbles/list` 的筛选模式下，空格键被用于输入空格字符，此时不应触发选择逻辑。
- **修复方案**:
  - 仅当 `m.list.FilterState() == list.Unfiltered` 时，才处理空格键的多选逻辑。
  - 确保多选逻辑正确更新 `m.selectedRules` 并返回命令以触发视图刷新。

## 3. 实施步骤

1. **修改 `CleanModel.Update`**:
   - 在处理按键消息前，先判断是否处于筛选模式。
   - 如果 `m.list.FilterState() == list.Filtering`，直接调用 `m.list.Update`，跳过自定义按键处理。
   - 只有在非筛选模式下，才处理 `space` (多选) 和 `enter` (确认) 以及 `esc` (返回上级)。

2. **验证 KeyMap**:
   - 确认 `LocalizeListKeyMap` 中对筛选相关的键位设置正确。

## 4. 代码变更预览
```go
func (m CleanModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    // ...
    // 优先检查筛选状态
    if m.state == cleanStateList && m.list.FilterState() == list.Filtering {
        var cmd tea.Cmd
        m.list, cmd = m.list.Update(msg)
        return m, cmd
    }
    // ... 后续自定义按键处理
}
```
这能确保在筛选时，按键输入被用于输入过滤词，且 `esc` 能正确退出筛选模式；而在正常模式下，`space` 能正常触发多选。
