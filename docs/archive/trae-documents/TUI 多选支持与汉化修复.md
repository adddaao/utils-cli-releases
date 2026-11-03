# TUI 多选支持与帮助信息汉化

针对用户反馈的 "无法进行多选" 和 "帮助信息未汉化" 问题，制定以下修复计划。

## 1. 列表多选支持 (`internal/tui/clean.go`)
当前 `CleanModel` 使用的是 `bubbles/list`，该组件默认是单选模式。要支持多选，我们需要：
- **自定义列表项**: 在 `cleanRuleItem` 中增加 `selected` 状态。
- **切换选择**: 监听按键（如 `space`），切换当前选中项的状态。
- **批量执行**: 修改 `CleanModel`，使其能够收集所有已选中的规则，并批量执行清理任务。
- **视觉反馈**: 在渲染列表项时，通过前缀（如 `[x]` 或 `[ ]`）显示选中状态。
  - **注意**: `bubbles/list` 的默认 Delegate 不直接支持多选样式，我们需要实现自定义的 `list.ItemDelegate`。

## 2. 帮助信息汉化 (`internal/tui/main_menu.go`, `internal/tui/clean.go`)
`bubbles/list` 组件底部的帮助栏（如 `↑/k up • ↓/j down ...`）是英文的。
- **解决方案**: 使用 `list.NewDefaultDelegate()` 时，可以通过 `list.Help` 结构体或直接修改 `list.Model` 的 KeyMap 来定制显示的文本。
- **具体操作**:
  - 获取 `list.Model` 的 `KeyMap`。
  - 修改 `KeyMap` 中各个绑定的 `Help().Desc` 字段为中文。
  - 或者，如果 `bubbles/list` 允许直接设置帮助组件，可以替换为自定义的中文帮助组件。
  - **更简单的做法**: 直接修改 `list.Model.AdditionalShortHelpKeys` 和 `AdditionalFullHelpKeys`，或者在初始化时配置 KeyMap 的中文描述。

## 3. 实施步骤

1. **实现多选列表 Delegate (`internal/tui/clean.go`)**:
   - 定义 `cleanItemDelegate`，在 `Render` 方法中根据选中状态绘制复选框。
   - 在 `CleanModel` 中维护一个 `selectedRules` 集合（`map[string]bool`）。
   - 处理 `space` 键来切换选中状态。
   - 处理 `enter` 键：如果有多选，则执行所有选中的；如果无多选，则执行当前高亮的（或提示）。

2. **批量执行逻辑 (`internal/tui/clean.go`)**:
   - 修改 `executeCleanTask`，使其接受 `[]clean.Rule`。
   - 在后台并发执行所有规则，并合并结果。

3. **汉化帮助信息**:
   - 创建一个通用的 `initListKeyMap` 函数，用于将 `list.Model` 的默认按键帮助文本改为中文。
   - 应用于 `MainMenuModel` 和 `CleanModel`。

## 4. 详细设计 - 多选交互
- **Space**: 切换当前项选中状态。
- **Enter**: 确认选择并进入下一步（路径输入）。
- **界面显示**:
  - 未选中: `[ ] 规则名`
  - 已选中: `[x] 规则名`
  - 当前行高亮: `> [x] 规则名`

## 5. 详细设计 - 批量执行
- `CleanModel` 将不再只持有一个 `selectedRule`，而是 `selectedRules []clean.Rule`。
- 结果展示页面需要能够展示多个规则的汇总结果。

