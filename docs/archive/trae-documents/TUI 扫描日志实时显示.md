# 添加文件扫描实时滚动日志

为了在扫描过程中展示实时文件路径，需要将扫描过程从“一次性返回结果”改为“流式反馈”。

## 1. 模型增强 (`CleanModel`)

*   **新增字段**:
    *   `scanLog []string`: 存储最近扫描到的 N 条文件路径。
    *   `maxScanLog int`: 限制日志显示行数（例如 10 行）。

## 2. 消息机制 (`Messages`)

*   **新增消息类型**:
    *   `scanLogMsg string`: 用于传递单条文件路径。
    *   `scanLogWrapperMsg`: 类似于 `progressWrapperMsg`，用于在 Bubble Tea 中实现流式 Cmd。

## 3. 扫描逻辑重构 (`startScan`)

*   **异步化扫描**:
    *   不再直接调用 `manager.ScanSelected` 并等待结果。
    *   改为启动一个 Goroutine 执行扫描。
    *   传入 `onProgress` 回调，将扫描到的路径发送到一个 `chan string`。

*   **流式 Cmd**:
    *   实现 `awaitScanLog(logChan, resultChan)` 函数。
    *   该函数通过 `select` 监听 channel：
        *   收到路径 -> 返回 `scanLogWrapperMsg`（包含路径和下一个等待 Cmd）。
        *   收到结果 -> 返回 `scanResultMsg`。

## 4. UI 更新 (`Update` & `View`)

*   **Update**:
    *   处理 `scanLogWrapperMsg`: 更新 `m.scanLog` 列表（保持固定长度），并返回 `msg.next()` 以继续监听。
    *   处理 `scanResultMsg`: 扫描结束，进入下一步。

*   **View (`cleanStateScanning`)**:
    *   在 Spinner 下方，渲染 `m.scanLog`。
    *   使用淡色（灰色）字体，模拟终端滚动日志的效果，最新路径显示在最下方。

这将使用户能直观地看到扫描正在进行，并了解当前扫描到了哪些文件。
