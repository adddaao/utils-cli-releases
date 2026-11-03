# TUI 优化与修复计划

针对用户反馈的 "中文显示优化" 和 "进入 clean 菜单不显示" 问题，制定以下修复计划。

## 1. 修复 Clean 菜单不显示问题 (`internal/tui/app.go`)

* **问题分析**: 当 `MainModel` 接收到 `ChangeStateMsg` 切换到 `stateClean` 时，只是更新了 `m.state`，但没有立即触发 `m.clean` 模型的视图更新或初始化。如果在切换瞬间没有后续事件（如按键），可能导致界面停留在上一帧或空白。

* **修复方案**: 在 `MainModel.Update` 处理 `ChangeStateMsg` 时，手动向目标子模型发送一个初始化消息（如 `tea.WindowSizeMsg`），确保其正确渲染。或者，确保 `MainModel.View()` 能立即返回新状态的视图。

* **潜在原因**: `CleanModel` 的 `list` 组件需要初始化大小。如果在 `InitialModel` 中初始化时没有设置大小，且在切换后也没有收到 `WindowSizeMsg`，列表可能高度为 0 而不显示。

* **具体操作**:

  * 在 `MainModel` 中保存 `windowWidth` 和 `windowHeight`。

  * 在切换状态时，立即调用子模型的 `Update` 方法传入当前的 `WindowSizeMsg`，以确保子模型获得正确尺寸。

## 2. 中文显示优化 (`internal/tui/main_menu.go`, `internal/tui/clean.go`)

* **问题**: `bubbles/list` 默认不支持中文标题或选项，或者中文标题未本地化。

* **优化方案**:

  * **Clean 菜单**:

    * 将列表标题 "Select Cleaning Rule" 改为 "选择清理规则"。

    * 确保 `cleanRuleItem` 的 `Title` 和 `Description` 使用中文（目前 `clean.Rule` 接口已返回中文，需确认列表组件渲染是否正常）。

  * **执行结果**: 将 "Clean Complete!" 等英文提示改为中文。

## 3. 实施步骤

1. **修复显示 Bug**: 修改 `internal/tui/app.go`，在处理 `ChangeStateMsg` 时，如果已有窗口尺寸信息，立即向新状态的 Model 发送 `WindowSizeMsg`。
2. **汉化主菜单**: 修改 `internal/tui/main_menu.go` 中的菜单项显示逻辑。
3. **汉化 Clean 界面**: 修改 `internal/tui/clean.go` 中的标题、提示语和结果展示。

