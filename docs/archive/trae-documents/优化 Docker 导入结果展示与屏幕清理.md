# 修改 Docker 导入结果展示逻辑

## 1. 重构 `transfer` 包的导入函数
为了避免 `LoadFiles` / `LoadImages` 直接将 "导入汇总" 打印到 stdout，我们将修改这些函数以返回结构化的结果对象。

*   **定义 `LoadResult` 结构体** (`internal/transfer/load.go`):
    ```go
    type LoadResult struct {
        Success int
        Failures []string // 失败的文件名和错误信息
    }
    ```
*   **修改函数签名**:
    *   `LoadImages(ctx context.Context, req LoadRequest) (*LoadResult, error)`
    *   `LoadFiles(ctx context.Context, files []string, concurrency int, stdout io.Writer) (*LoadResult, error)`
*   **逻辑变更**:
    *   函数内部依然保留打印 "正在导入 xxx..." 的进度日志（通过 `stdout` 参数）。
    *   **移除** 原有的 `fmt.Println("=== 导入汇总 ===")` 等汇总打印代码。
    *   将统计结果封装到 `LoadResult` 中返回。

## 2. 更新 TUI 逻辑 (`internal/tui/docker.go`)
*   **处理 `LoadResult`**:
    *   更新调用 `transfer.LoadFiles` 的 `tea.Cmd`。
    *   接收到 `LoadResult` 后，构造包含 "导入汇总" 的完整结果字符串。
    *   将结果传递给 `dockerTaskResultMsg`。
*   **清除屏幕日志**:
    *   在进入 `dockerStateResult` 状态时，通过 `tea.Cmd` 发送 `tea.ClearScreen` 指令（虽然 TUI 在 AltScreen 模式下通常会自动重绘覆盖，但发送清除指令能确保清除之前的直接 stdout 输出）。
    *   实际上，由于 TUI 运行在 `tea.WithAltScreen()` 模式下，之前的 stdout 输出可能直接写到了屏幕缓冲区。当 TUI 重绘 `dockerStateResult` 视图时，它会覆盖屏幕。为了确保用户要求的 "完全清除详情"，我们将构造一个全屏的 Result 视图，并可能需要显式清屏。

## 3. 更新 CLI 调用 (`cmd/dit/main.go`)
由于 `transfer` 包的函数不再打印汇总，CLI 命令需要自己处理结果打印。
*   **更新 `NewLoadCmd`**:
    *   获取 `LoadResult`。
    *   手动打印 "=== 导入汇总 ==="、成功数、失败列表等信息，保持原有 CLI 体验一致。

## 4. 验证
*   执行导入操作。
*   观察过程日志（"正在导入..."）是否正常显示。
*   导入完成后，确认日志被清除/覆盖，屏幕只显示最终的 "导入汇总" 和 "按 Enter 返回"。

---

**Todo List:**
1.  修改 `internal/transfer/load.go`: 定义 `LoadResult` 并更新 `LoadImages`/`LoadFiles`。
2.  修改 `cmd/dit/main.go`: 适配新的返回值并手动打印汇总。
3.  修改 `internal/tui/docker.go`: 适配返回值，构造结果视图字符串，并确保视图切换时的清洁。