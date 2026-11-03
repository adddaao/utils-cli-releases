# 使用 UnifiedPageModel 重构主菜单计划

## 1. 目标与背景
用户希望将当前主菜单（左侧导航栏）中不连续的字母快捷键（如 d, c, f, w）替换为连续的数字序号（如 1, 2, 3, 4），并且支持数字缓冲输入方式（即输入数字后按 Enter 执行）。
根据用户要求，为了减少重复代码并保证体验一致性，需要**复用已有的公共组件 `UnifiedPageModel` 和 `numberSelectionBuffer`** 来完成本次重构。同时，必须保留原有的左右分栏整体布局。

## 2. 当前状态分析
- `internal/tui/main_layout.go` 已经在初始化时将 `MenuItem` 的 `Shortcut` 替换为了 `Index`，并且添加了对 `NavigationConfirmMsg` 的监听以处理焦点切换，但遗留了硬编码的 `enter` 拦截逻辑。
- `internal/tui/navigation.go` 当前是手动绘制列表（基于光标 `cursor` 状态），且不支持数字缓冲输入，也不符合项目中基于 `list.Model` 的统一组件规范。
- `MainLayoutModel` 的 `pendingInputLine` 方法目前只针对 `content` 焦点生效，没有考虑到 `navigation` 焦点时也可能存在数字缓冲输入。

## 3. 提议的变更

### 3.1 修改 `internal/tui/navigation.go`
- **更新 `MenuItem` 结构体**：移除 `Shortcut rune`，改为 `Index string`。并实现 `list.Item` 接口（`Title()`, `Description()`, `FilterValue()`）。
- **定义 `NavigationConfirmMsg`**：新增一个空的结构体，用于在确认选择时通知父组件。
- **重构 `NavigationModel` 结构体**：
  - 移除原有的 `cursor`，引入 `model *unified.UnifiedPageModel` 和 `numberSelect numberSelectionBuffer`。
  - 实现 `PendingInputProvider` 接口（提供 `GetPendingInputLine()` 方法）。
- **重写相关方法**：
  - `NewNavigationModel`：初始化并嵌入一个关闭了 Chrome（Title, StatusBar, Help）的 `UnifiedPageModel`。
  - `Update`：将方向键和数字输入委托给 `numberSelect.Select` 和内部的 `UnifiedPageModel` 处理。当确认输入（按 `Enter`）时，抛出 `NavigationConfirmMsg`。
  - `View`：直接调用内部 `UnifiedPageModel` 的 `View()`。
- **实现自定义 Delegate**：
  - 新增 `navigationDelegate` 结构体，实现 `list.ItemDelegate` 接口。
  - 在 `Render` 方法中复用现有的 `NavTitle`, `NavItemSelectedFocus`, `NavItemNormal` 等样式，确保重构后外观不变。

### 3.2 修改 `internal/tui/main_layout.go`
- **修复 Enter 键拦截**：
  - 在 `MainLayoutModel` 的 `Update` 方法中，移除 `if msg.String() == "enter" { m.focusState = "content" ... }` 这段硬编码逻辑，允许 `Enter` 键事件下发到 `NavigationModel`，由其处理缓冲数字并在确认时抛出 `NavigationConfirmMsg`。
- **支持导航栏的输入缓冲提示**：
  - 修改 `pendingInputLine` 方法：当 `m.focusState == "navigation"` 时，如果 `m.navigation` 实现了 `PendingInputProvider`，则返回其缓冲提示，以便在底部 HelpBar 上方显示诸如“输入: 1 | 待执行: 第 1 项”的提示。

## 4. 假设与决策
- **布局保留**：我们只在 `NavigationModel` 内部使用 `UnifiedPageModel`，外部 `MainLayoutModel` 依然维持左（导航）右（内容）的分栏结构，不受影响。
- **样式保留**：通过实现自定义的 `list.ItemDelegate`（即 `navigationDelegate`），我们可以精确控制每一行的渲染样式，从而完美还原原有的 UI 样式。

## 5. 验证步骤
1. 保存并运行程序。
2. 观察主菜单是否显示为 `[1] Docker 管理`、`[2] 清理工具` 等数字序号，且整体样式和之前一致。
3. 测试上下方向键（或 j/k）是否能正常移动高亮光标。
4. 测试数字缓冲输入：按下 `2`，观察底部帮助栏上方是否出现“输入: 2 | 待执行: 第 2 项”的提示，按 `Enter` 后是否成功切换到“清理工具”并进入右侧焦点。
5. 测试无缓冲输入的直接确认：使用方向键移动到某一项，直接按 `Enter`，确认是否能正常切换并进入右侧焦点。