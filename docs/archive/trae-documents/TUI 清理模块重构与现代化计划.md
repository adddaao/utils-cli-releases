# TUI 清理模块重构与现代化计划

非常抱歉之前的理解有误。我将完全重构 `internal/tui/clean.go`，将我在 CLI 中实现的“扫描-预览-执行”流程移植到 Bubble Tea TUI 界面中，并按照您的要求合并路径选择步骤。

## 1. 状态机重构 (`internal/tui/clean.go`)

将原本的线性流程改造为包含“检查”分支的流程：

```go
const (
    cleanStateList cleanState = iota
    cleanStatePathSelect      // 合并后的路径选择（输入 + 列表）
    cleanStateActionSelect    // 新增：选择 "扫描并检查" 或 "直接清理"
    cleanStateScanning        // 新增：扫描中（带 Spinner）
    cleanStateScanResult      // 新增：扫描结果展示（确认/返回）
    cleanStateExecuting       // 执行中（带进度条）
    cleanStateDone
)
```

## 2. 界面与交互改进

### A. 合并路径选择 (`cleanStatePathSelect`)

* **目标**：解决您提到的 "Terminal#11-15 与 Terminal#10-15 功能合并" 问题。

* **实现**：

  * 移除单独的 `cleanStateInputPath` 和 `cleanStateMavenConfirm`。

  * 创建一个统一的界面，上方显示 `TextInput` 供手动输入，下方显示 `List` 列出默认路径（如 Maven 默认路径、当前目录）。

  * 用户可以直接打字输入，也可以按上下键选择列表中的默认路径，按 Enter 确认。

### B. 操作选择菜单 (`cleanStateActionSelect`)

* 在选择路径后，不直接进入确认，而是提供选项：

  1. `[1] 扫描并检查 (推荐)`
  2. `[2]  直接清理`
  3. `[3] 返回规则选择`

### C. 现代化进度条集成

* **扫描阶段**：集成 `bubbles/spinner`，显示动态的扫描状态。

* **执行阶段**：集成 `bubbles/progress`，显示平滑的进度条和百分比。

* 摒弃之前的 `fmt.Print` 直接输出，完全使用 Bubble Tea 的 `View()` 渲染，确保界面不闪烁且风格统一。

### D. 扫描结果页 (`cleanStateScanResult`)

* 展示详细的扫描报告（文件数、大小）。

* 提供明确的后续操作：

  * `[Enter] 确认清理`

  * `[Esc/q] 返回规则选择` (满足您提到的“返回规则选择”需求)

## 3. 实现步骤

1. **修改** **`CleanModel`**：引入 `spinner`, `progress` 模型，移除旧的 `input` 逻辑，替换为组合视图。
2. **重写** **`Update`**：处理新的状态流转，特别是扫描和执行的异步消息处理（`Cmd`）。
3. **重写** **`View`**：使用 Lipgloss 渲染现代化的 UI，包括合并后的路径选择器和进度视图。
4. **迁移逻辑**：将 `manager.ScanSelected` 和 `manager.DeleteSelected` 的调用适配到 TUI 的 `Cmd` 模式。

此计划将彻底替换当前的 TUI 实现，使其符合您的“交互式”预期。
