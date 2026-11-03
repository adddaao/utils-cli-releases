# 日志体系与等级规范

本文是 `ru` 日志体系的正式技术规范：等级落点、两个输出通道的分工、日志接口、脱敏、初始化生命周期与业务模块接入要求。配置项本身见 [配置参考](configuration.md)。

## 1. 两个输出通道

日志分成两条互不替代的通道，业务代码必须按用途选择，不允许混用。

| 通道 | 接口 | 落盘 | 用途 |
| --- | --- | --- | --- |
| 事件日志 | `logger.Debug` / `Info` / `Warn` / `Error` | 是 | 生命周期、业务操作与故障记录 |
| 双通道通知 | `logger.ConsoleInfo` / `ConsoleWarn` / `ConsoleError` / `ConsoleDebug` | 是 | 既要提示用户、又必须留档的问题 |
| 纯终端输出 | `internal/console` 的 `Print` / `Printf` / `Println` / `Errorf` / `Errorln` | 否 | 菜单、分隔线、结果汇总等纯展示文案 |

规则：

1. 纯界面文案（菜单、提示语、分隔线、结果汇总表）只能走 `internal/console`，不得写进日志文件。
2. 需要留档的用户可见问题走 `logger.Console*`；`ConsoleWarn` / `ConsoleError` 走 stderr 并带 `[WARN] ` / `[ERROR] ` 前缀，`ConsoleDebug` 带 `[DEBUG] ` 前缀，`ConsoleInfo` 保持原样（它承载交互提示）。
3. TUI 内部一律不调用上述任何接口直接打印，渲染必须返回字符串或写入组件提供的 `io.Writer`。

## 2. 等级落点

等级是给检索用的：任何一条日志都必须能仅凭 `level=` 判断它是正常进度还是故障。

| 等级 | 必须记录 | 不得记录 |
| --- | --- | --- |
| `debug` | 命令上下文、消息总线的发布/订阅、配置与外部调用的诊断细节 | 正常生命周期与业务结果（这些属于 info） |
| `info` | 应用启动/退出、正常退出信号、命令开始与完成、业务操作成功、执行视图进度日志 | 纯界面文案、故障原因 |
| `warn` | 可继续运行的问题：日志初始化失败、配置热更新失败、Docker daemon 信息不完整、执行视图中的非致命异常 | 正常退出、用户输入校验、正常操作结果 |
| `error` | 启动失败、命令失败、配置热更新失败、消息处理异常、未捕获 panic 及其堆栈、业务操作失败、执行视图中的失败原因 | 已被上层降级或可重试的临时问题（用 warn） |

落点要求：

1. 业务操作的失败原因必须记在 `error`。执行视图的失败行必须用 `AppendErrorLog`，不能用 `AppendLog`，否则失败与成功进度在日志文件里无法区分。
2. 正常退出（`SIGINT` / `SIGTERM`）记 `info`，不占用 `warn`；否则 `warn` 通道会被正常的 Ctrl+C 淹掉。
3. 日志级别由 `[logging] log_level` 控制，合法值为 `debug|info|warn|error`；`--debug` 或 `RU_DEBUG=1` 等价于 `debug`。

## 3. 文件格式

每条日志一行，固定键顺序为 `time` / `level` / `msg` / `caller`，结构化字段在同层输出。默认是便于人读与 `grep` 的 **logfmt 文本**；把 `[logging] format` 设为 `json` 即得到同样的键与字段、可直接被采集器解析的 JSON 行。

```
# 默认：text（logfmt）
time=2026-10-14T00:16:33.913+08:00 level=info msg=命令开始 caller=utils-cli/cmd/ru/main.go:74 args_count=0 command="ru version" stage=命令
time=2026-10-14T00:16:41.002+08:00 level=error msg=操作失败 caller=utils-cli/internal/transfer/save.go:91 action=保存镜像 error="磁盘已满" stage=导出 target="local/caddy:v1"
```

```json
# format = "json"
{"time":"2026-10-14T00:16:41.002+08:00","level":"error","msg":"操作失败","caller":"utils-cli/internal/transfer/save.go:91","action":"保存镜像","error":"磁盘已满","stack":"...","stage":"导出","target":"local/caddy:v1"}
```

- `time`：RFC3339 带毫秒和时区，可直接按字符串排序。
- `level`：与配置词表一致，取值为 `debug` / `info` / `warn` / `error`。
- `msg`：事件名或用 `fmt` 风格格式化后的事件描述；logfmt 只在值含空格、引号或等号时加引号。
- `caller`：真实业务调用点，格式为 `file:line`；只有 `internal/logger` 自己输出的启动横幅会落在 `internal/logger/logger.go`，业务日志出现该文件说明绕过了包装层，属于缺陷。
- 其余键是结构化字段。固定键重名的业务字段会加 `fields.` 前缀保留。
- 消息与所有字符串字段统一经过脱敏（见第 5 节），任何等级都不例外。

两种格式的键、顺序与等级词表完全一致，切换格式不需要改检索口径：

```bash
grep 'level=error' ru.log                          # 文本格式：只看失败
grep 'stage=执行' ru.log                            # 只看某条流程
jq -c 'select(.level=="error")' ru.log              # JSON 格式
jq -c 'select(.module=="docker") | {action,target}' ru.log
```

## 4. 日志接口

```go
// 流程日志：stage 标记流程阶段，level 决定等级
logger.Flow(level logger.Level, stage, message string, fields logger.Fields)
logger.Debug/Info/Warn/Error(format string, v ...interface{})                              // 仅文件，fmt 风格
logger.DebugFields/InfoFields/WarnFields/ErrorFields(message string, fields logger.Fields) // 仅文件，结构化字段
logger.ConsoleInfo/ConsoleWarn/ConsoleError/ConsoleDebug(format string, v ...interface{})  // 终端 + 文件

// 失败详情：自动带 stage / action / target / error / error_chain / stack
logger.Failure(stage, action, target string, err error)

logger.Audit(module, action, target string, elapsed time.Duration, err error) // 业务操作审计
logger.Sanitize(text string) string                                           // 脱敏原语
```

- 只需要一句描述时用 `Info("已删除: %s", path)` 这类 `fmt` 风格调用。
- 需要机器可检索的字段时用 `Flow(logger.LevelInfo, "命令", "命令开始", logger.Fields{"command": cmd, "args_count": n})`，字段与 `stage` 一起输出；`Fields` 是 `map[string]interface{}` 的别名、`Level*` 是等级常量，调用方不必依赖日志库。
- 终端通道（TUI 与非 TUI 菜单）保持人类可读文本与 `[WARN]` / `[ERROR]` / `[DEBUG]` 前缀；文件通道才有上面的键值结构。

### 流程日志

流程日志回答“走到哪一步了”，都必须带 `stage`：

| stage | 记录内容 |
| --- | --- |
| `启动` | 应用启动、初始化配置与数据库的结果 |
| `命令` | 命令开始 / 上下文 / 完成、命令级失败 |
| `配置` | 配置文件热重载 |
| `运行` | 退出信号、未捕获 panic |
| `执行` | 公共执行视图的阶段、进度、命令原文与输出（由执行视图自动带 `stage=执行`） |
| `导出` / `导入` / `部署` 等 | 各模块自定义阶段，由模块在 `Flow` 里传入 |

### 失败定位

所有失败都走 `error` 级，并且必须能自解释：

```bash
grep 'level=error' ru.log | tail -1        # 最近一次失败及其完整上下文
grep 'stage=执行' ru.log | grep error      # 执行类任务的失败
jq -r '.error_chain' ru.log                # 只提取错误链
```

字段含义：

- `stage`：失败发生在哪个流程阶段。
- `action` / `target`：对什么对象做了什么。
- `error`：最外层错误文本；`error_chain`：`%w` 包装链展开为「外层 <- 内层」，直接给出根因。
- `stack`：跳过日志包装层后的调用栈（`file:line`，最多 12 帧），给出抛出位置。
- 业务操作失败另有 `Audit` 记录（`result=失败`），字段为 `module` / `action` / `target` / `error`。

`Failure` 覆盖代码级失败；执行视图里的失败行用 `AppendErrorLog`，同样落成 `level=error` 并带 `stage=执行`。两者配合：`Failure` 给调用栈，执行视图给当时的外部命令输出。

### 操作审计

写操作（创建、修改、删除、推送、导入、导出、开放/关闭端口、部署等）完成后必须各记一条 `Audit`：

- 成功 → `level=info`，失败 → `level=error`；两者字段一致，可直接按 `module` / `action` / `target` 检索。
- 固定字段：`module`、`action`、`target`、`result`（`成功` / `失败`），可选 `elapsed`、`error`。
- `target` 使用用户可识别的对象（容器名、镜像引用、用户名、项目名、端口、路径），无法计算耗时传 `0`。
- 只读查询（列表、详情、状态）不记审计。
- 同一次操作只能有一条审计记录，必须记在能判定最终结果的那一层：例如镜像保存、加载与归档删除由 `internal/transfer` 在操作完成处单点记录（`module=docker`），Docker 模块与 CLI 调用方不得重复记；同一次操作出现两条审计（甚至一条成功一条失败）属于缺陷。

业务模块在测试中可替换 `logger.Audit`（它声明为变量）以断言审计调用。

## 5. 脱敏

所有落盘消息在写入前统一经过 `Sanitize`，覆盖以下形式：

- `password=…`、`token: …`、`api_key='…'` 等键值形式；
- SQL 等语句里的 `PASSWORD '…'` 空白分隔形式；
- `Authorization: Bearer …`；
- 连接串里的 `user:password@host`。

要求：

1. 业务代码不得把凭证拼进日志；即使拼接了，也必须先经 `Sanitize`（`Audit` 已内置）。
2. 需要向用户展示并且可能含凭证的文本，调用 `Sanitize` 后再渲染。
3. 新增凭证形态时，只在 `internal/logger/sanitize.go` 增加模式并补测试，不允许在业务模块各写一份脱敏逻辑。

## 6. 初始化生命周期

1. `logger.Init()` 幂等：日志配置签名（路径、大小、备份数、保留天数、策略、压缩、等级）未变化时不重复装配，也不重复输出启动横幅，只记一条 `debug`。`main()` 与 `PersistentPreRunE` 会连续调用一次，配置热更新再次调用，这是正常路径。
2. 初始化之前的日志进入缓冲（上限 256 条）。`Init()` 成功后按原等级、原顺序回灌，再输出启动横幅，因此“配置加载失败”“数据库初始化失败”这类最早期的错误同样会落到文件。
3. `logger.Close()` 会关闭轮转器；如果日志模块始终没有初始化成功（例如配置加载失败后退出），缓冲日志会按 `config.DefaultLogPath()` 解析出的绝对路径（相对路径以配置文件所在目录为基准）尽力直接落盘。所有 `os.Exit` 前必须经过 `exitWithError`（`cmd/ru/main.go`）先 `Close`，因为 `os.Exit` 不执行 `defer`。
4. 轮转由 `[logging]` 的 `max_file_size`、`max_files`、`retention_days`、`rotation_policy`、`compress` 控制，写入方不允许自行切分日志文件。空间上限见第 8 节。

## 7. 业务模块接入要求

1. 产生执行日志、进度或可恢复结果的操作必须进入公共执行视图，并通过它追加运行日志；业务模块不得额外直接写文件日志造成重复。
2. 执行视图分等级写入：
   - `AppendLog`：阶段、进度、命令原文、正常输出（info）；
   - `AppendWarnLog`：可继续运行的异常（warn）；
   - `AppendErrorLog`：失败原因、回退失败、最终失败结论（error）。
3. 写操作必须补 `logger.Audit`；短操作失败同时用 `notice` 或 `operationstatus` 告知用户，两者不互相替代。
4. 代码级失败必须用 `logger.Failure(stage, action, target, err)`（自动带错误链与调用栈），不要只写一句 `Error("xxx 失败: %v")` 而丢失阶段与对象；流程节点必须用 `logger.Flow(level, stage, message, fields)`，保证 `stage` 可检索。
5. 不允许在业务模块内引入新的日志库、直接写文件日志或自行实现轮转与脱敏。
6. 新增或修改日志行为必须补测试：等级路由、脱敏、审计字段、流程 stage、失败上下文（错误链与调用栈）、执行视图分等级落盘至少各有一处覆盖。

## 8. 空间上限与有效信息保留

日志默认按“有界但够用”配置，不会无限占用磁盘，同时尽量留住排查需要的信息。

| 项 | 默认值 | 说明 |
| --- | --- | --- |
| `max_file_size` | `10`（MB） | 单个文件上限，超过即轮转 |
| `max_files` | `5` | 保留的历史份数 |
| `retention_days` | `7` | 超过天数的历史文件清理 |
| `rotation_policy` | `time` | 按时间周期轮转，同时始终受 `max_file_size` 约束 |
| `compress` | `true` | 轮转后的历史文件压缩为 `.gz` |
| 错误专用文件 | `<主日志同目录>/<名称>.error.log` | 只收 `warn` / `error`，至少保留 30 天 |

空间上限：

```
未压缩峰值 ≈ max_file_size × (max_files + 1) = 10MB × 6 = 60MB
实际占用   通常远低于该值（历史文件压缩、按天数清理）
错误文件   只收问题记录，通常是 KB 级
```

保留有效信息的措施：

1. **错误单独留档**：`warn` / `error` 除了写主日志，还会另写一份 `<名称>.error.log`。主日志按体积轮转，所以只收问题记录的错误文件能用同样的空间保留长得多的失败历史（至少 30 天）。
2. **单行长度上限**：单条消息或字段超过 4KB 时截断为「首部 + 截断标记（含省略字节数）+ 尾部」，既不丢开头上下文也不丢结尾根因，并保证截断后仍是合法 UTF-8。
3. **默认不写 debug**：`log_level` 默认 `info`；`debug` 只用于临时排查，避免高频诊断信息挤掉有效记录。
4. **失败自带上下文**：`Failure` 的 `stage` / `action` / `target` / `error` / `error_chain` / `stack` 都在同一条记录里，不需要靠翻更多历史行还原现场。

需要更长的历史时按占用线性调整 `max_files` 或 `retention_days` 即可；只要不关闭 `compress`，实际占用增长远小于上限。
