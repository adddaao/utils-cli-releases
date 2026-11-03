# 重构日志体系计划

## 1. 重构 `internal/logger` 模块
使用 `logrus` 和 `lumberjack` 替换现有的简单日志实现。

- **引入依赖**：`github.com/sirupsen/logrus` (日志核心) 和 `gopkg.in/natefinch/lumberjack.v2` (日志轮转)。
- **配置集成**：在 `Init()` 中读取 `config.Logging` 配置：
    - `log_path` -> `lumberjack.Filename`
    - `max_file_size` -> `lumberjack.MaxSize` (MB)
    - `max_files` -> `lumberjack.MaxBackups`
    - `retention_days` -> `lumberjack.MaxAge` (Days)
    - `log_level` -> `logrus.SetLevel` (支持 debug/info/warn/error)
- **Debug 模式**：若 `config.Debug` 为 true，强制覆盖 Level 为 `DebugLevel`，并开启 `ReportCaller` (显示文件名行号)。
- **输出目标**：将日志输出定向到 `lumberjack` 提供的文件 writer，**不输出到控制台**（避免干扰 TUI 界面）。
- **API 适配**：保留并增强现有的 `Info`, `Error` 函数（底层调用 `logrus.Infof`, `logrus.Errorf`），并新增 `Debug` 函数。

## 2. 增强业务逻辑的 Debug 日志
在 `internal/clean` 模块的各个规则执行流程中，添加详细的 `logger.Debug` 调用，确保在 debug 模式下能追踪完整执行流。

- **通用流程**：
    - 记录开始执行的规则名与目标路径。
    - 记录扫描到的候选文件（Debug 级别）。
    - 记录跳过的文件及原因（如受保护目录、被占用等）。
    - 记录实际执行删除的操作结果。
- **涉及文件**：
    - `internal/clean/maven.go`
    - `internal/clean/macos.go`
    - `internal/clean/archive.go`
    - `internal/clean/temp.go`
    - `internal/clean/generic.go`
    - `internal/clean/cmd.go` (记录整体任务参数)

## 3. 验证
- 确保 `go build` 通过。
- 确保日志文件按配置生成，且包含详细的 Debug 信息（当启用 debug 模式时）。
