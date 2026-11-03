# TUI 输入框显示不全修复计划

针对用户反馈的 "输入框提示语显示不全" (例如只显示 "> 输")，这是由于 `textinput` 组件的默认宽度较小导致的。

## 1. 问题分析 (`internal/tui/clean.go`)
- **Textinput Width**: `bubbles/textinput` 的默认宽度通常较小（例如 40 字符），而包含中文字符的 Placeholder 可能会超出此宽度。
- **Truncation**: 当内容（Placeholder 或 Value）超出宽度时，`textinput` 会进行截断或滚动显示。由于没有显式设置宽度，且未在窗口调整时更新宽度，导致显示异常。

## 2. 修复方案
- **初始化时设置宽度**: 在 `NewCleanModel` 中，给 `ti.Width` 设置一个较大的默认值（例如 50 或 60）。
- **动态更新宽度**: 在 `CleanModel.Update` 的 `tea.WindowSizeMsg` 分支中，根据窗口宽度动态调整输入框宽度（例如 `msg.Width - padding`）。

## 3. 实施步骤

1. **修改 `NewCleanModel`**:
   - 设置 `ti.Width = 60`。

2. **修改 `CleanModel.Update`**:
   - 在 `tea.WindowSizeMsg` 中，除了更新 `list` 的尺寸，也更新 `input` 的宽度：`m.input.Width = msg.Width - 10` (预留边距)。

这能确保输入框有足够的空间显示完整的中文提示语。
