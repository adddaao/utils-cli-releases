# TUI 功能补全与日志增强计划

针对用户提出的三点要求，制定以下实施计划。

## 1. 恢复二次确认与智能默认路径逻辑 (`internal/tui/clean.go`)
- **现状分析**: 当前 TUI 的实现过于简化，丢失了原 `clean/cmd.go` 中的逻辑：
  - 如果选中 Maven 规则，应使用 Maven 默认路径（`.m2/repository`），且提示语应说明。
  - 如果未选 Maven，默认路径应为当前目录。
  - 缺少执行前的二次确认步骤。
- **修复方案**:
  - 在 `cleanStateInputPath` 阶段：
    - 检查已选规则中是否包含 `maven`。
    - 动态设置输入框的 Placeholder（提示语）。
    - 动态处理空输入：若包含 Maven，则传递 `nil` 或空路径给执行函数（触发规则内部默认配置）；否则传递当前目录 `.`。
  - 增加 `cleanStateConfirm` 阶段：
    - 在路径输入完成后，进入确认阶段。
    - 显示：即将执行的规则列表、扫描路径、是否模拟执行。
    - 提示 "确认执行? (y/n)"。

## 2. 输出与 TUI 集成 (`internal/tui/clean.go`)
- **目标**: 将清理过程中的输出（如 Maven 预览列表、错误信息）通过 Bubble Tea 界面展示，而不是直接打印到 stdout。
- **方案**:
  - 利用 `tea.Cmd` 和 `tea.Msg` 机制。
  - 对于 Maven 预览功能：这在 TUI 中较难直接复用 `fmt.Printf`。我们将暂时禁用 TUI 下的 Maven 预览确认（因为 TUI 本身已包含确认步骤），或者将预览结果作为 `Model` 的一部分展示。
  - 鉴于复杂性，首选方案是：**TUI 自带确认步骤**（即上述第 1 点），并在执行结果页展示详细信息。

## 3. 日志增强 (`internal/clean/*.go`, `internal/logger`)
- **目标**: 所有的清理操作步骤必须记录到日志文件，且路径服从配置文件。
- **现状**: `logger` 模块已实现并初始化。`MavenRule`, `MacOSRule`, `ArchiveRule`, `TempRule` 中已包含部分 `logger.Info/Error` 调用。
- **增强方案**:
  - 检查并确保所有 Rule 实现（特别是 `GenericRule`）在执行删除操作前后都调用了 `logger`。
  - 在 TUI 的 `executeBatchCleanTask` 中记录任务开始和结束的汇总日志。
  - 确保日志文件路径从 `config.Logging.LogPath` 读取（已在 logger 初始化时实现）。

## 4. 实施步骤

1. **修改 `CleanModel` 状态机**:
   - 增加 `cleanStateConfirm` 状态。

2. **完善路径逻辑**:
   - 在进入 `cleanStateInputPath` 时，根据选中规则更新 Placeholder。
   - 在提交路径后，进入 `cleanStateConfirm`。

3. **实现确认视图**:
   - 在 `View()` 中渲染确认信息。
   - 处理 `y/n` 或 `Enter/Esc` 按键。

4. **日志补全**:
   - 审查 `internal/clean/generic.go`，添加日志记录。
   - 在 `internal/tui/clean.go` 的执行逻辑中添加任务级日志。

