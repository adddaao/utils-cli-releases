# Bubble Tea 重构计划

本计划旨在引入 Charmbracelet 的 Bubble Tea 框架，将现有的基于 `fmt/bufio` 的命令行交互重构为现代化的 TUI（终端用户界面）。

## 1. 分支管理
- 创建并切换到新分支 `feat/bubbletea-refactor`。

## 2. 依赖引入
- 添加 `github.com/charmbracelet/bubbletea` (核心框架)
- 添加 `github.com/charmbracelet/bubbles` (常用组件：列表、输入框等)
- 添加 `github.com/charmbracelet/lipgloss` (样式定义)

## 3. 架构设计 (`internal/tui`)
创建一个新的 `internal/tui` 包，用于存放所有的 TUI 逻辑，保持与现有业务逻辑 (`internal/clean`, `internal/docker` 等) 的解耦。

### 3.1 模型结构 (Model)
采用 "主模型 + 子模型" 的架构：
- **MainModel**: 负责全局状态管理和视图切换（主菜单、子功能页面）。
- **SubModels**:
  - `MenuModel`: 通用菜单组件（用于主菜单、Docker 菜单、Firewall 菜单）。
  - `CleanModel`: 清理模块的交互界面（列表选择、确认对话框）。
  - `DockerModel`: Docker 模块的交互界面。
  - `InputModel`: 通用输入组件（替代 `ui.PromptText`）。

### 3.2 界面流转
1. **启动**: `cmd/dit/main.go` 在不带参数运行时，不再调用 `runMainMenu`，而是启动 `tui.Start()`。
2. **主菜单**: 显示 Docker、Clean、Firewall、Update、Exit 选项。
3. **功能进入**: 选中 Clean -> 切换到 `CleanModel` -> 显示规则列表 -> 选中规则 -> 弹出路径输入 -> 执行清理 -> 显示结果 -> 按键返回。

## 4. 逐步实施步骤
1. **初始化**: 创建分支，添加依赖。
2. **基础框架**: 实现 `internal/tui/app.go` (入口) 和 `internal/tui/main_menu.go` (主菜单)。
3. **迁移 Clean 模块**: 将 `internal/clean/cmd.go` 中的交互逻辑迁移到 `internal/tui/clean.go`。
   - 使用 `bubbles/list` 显示规则。
   - 使用 `bubbles/textinput` 输入路径。
   - 使用 `tea.Cmd` 异步执行清理任务，避免界面卡顿。
4. **替换入口**: 修改 `cmd/dit/main.go` 对接新 TUI。

## 5. 后续规划 (本次暂不包含)
- Docker 和 Firewall 模块的完整迁移（将在 Clean 模块验证成功后进行）。

本次任务将重点完成 **环境搭建**、**主菜单重构** 以及 **Clean 模块的 TUI 化**，以验证架构的可行性。
