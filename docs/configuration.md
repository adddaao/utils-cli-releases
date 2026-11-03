# 配置文件

默认使用 TOML 格式。调试模式配置位于 `./build/debug/.ru/config.toml`，非调试模式配置位于 `~/.ru/config.toml`。覆盖顺序为：默认值、配置文件、`RU_*` 环境变量、CLI 参数。

```toml
app_name = "ru"

[common]
max_retries = 3          # 最大重试次数（>=0）
timeout = 30             # 超时（秒，>0）
config_version = 4       # 配置版本（用于迁移）
data_dir = ""            # 数据目录，留空使用配置文件所在目录
cache_dir = ""           # 缓存目录，留空使用数据目录下的 cache/

[docker]
path = "./output_results/"     # 导入导出统一目录（相对或绝对）
keyword_delimiter = "\\"       # 模糊查询触发分隔符

[database]
# PostgreSQL 连接历史。主机、端口和用户名用于逐级提示；密码只保存为独立加密凭证，
# 由 [[database.profiles]].credential_id 引用。
profiles = []
# PostgreSQL 备份计划，由 TUI 或 ru database backup 管理。
backup_plans = []
# 导出源预估达到该值时，提示是否改用 PostgreSQL Custom .dump（-Fc）格式。
custom_dump_threshold_gib = 8

[logging]
log_level = "debug"            # 日志级别：debug|info|warn|error
log_path = ""                  # 留空则使用数据目录下的 logs/ru.log
format = "text"                # 落盘格式：text（logfmt 文本，默认）| json（结构化）
max_files = 5                  # 最大保留数（>=1）
retention_days = 7             # 保留天数（>=1）
max_file_size = 10             # 单文件最大尺寸（MB，>=1）
rotation_policy = "time"       # 轮转策略：time | size | mixed
compress = true                 # 压缩轮转后的日志（默认开启，实际占用远小于上限）
```

## PostgreSQL 连接历史与密码保护

数据库导入、导出以及“用户与数据库”权限管理成功执行后，程序才会将该次完整连接写入历史。主机、端口和用户名按“主机 → 端口 → 用户名”以内联建议方式提供；仅编辑字段、取消或执行失败都不会创建历史记录，因此不会把未确认的默认值误记进去。密码不会写入 `config.toml` 明文：`[[database.profiles]]` 只保存指向独立密文文件的 `credential_id`，密文位于 `<data_dir>/credentials/database/<credential_id>.secret`，密钥位于 `<data_dir>/credentials/database/database.key`，Unix 上分别限制为 `0600` 文件和 `0700` 目录；`<data_dir>` 取 `common.data_dir`，留空时为配置文件所在目录（调试模式为 `build/debug/.ru`，否则为 `~/.ru`）。

旧版本内联在 `config.toml` 的 `password_ciphertext` 仍然可读（读取时回退到该字段并用同一把 `database` 密钥解密）；执行 `ru config migrate` 会把它转换为独立凭证并写回 `credential_id`。

已保存密码不会出现在候选文本或日志中。实际执行时，密码输入框为空才会按需解密已保存密码，并仅用于本次数据库连接；命令日志仍会将 `PGPASSWORD` 脱敏。删除密钥文件会使旧密码密文无法恢复，但不会删除连接的主机、端口和用户名提示。

## PostgreSQL 备份计划

备份计划通过稳定的 `connection_profile_id` 引用连接档案，支持 SQL、ZIP、TAR.GZ 和 PostgreSQL Custom。计划可配置 daily、weekly、monthly，本地执行时间、星期或 1–28 的月日期；默认保留 7 份且最多 30 天。每次成功备份都生成不含密码的 manifest 和 SHA-256，清理时只处理 manifest 能证明属于当前计划的文件。

```toml
[[database.backup_plans]]
id = "5fc9596a-4989-42b9-a5c4-dbbb4ff48925"
name = "生产库每日备份"
enabled = true
connection_profile_id = "连接档案的稳定 ID"
database = "app"
schema = "public"
tables = []
format = "custom"
output_dir = "./backups"
compression_level = 6
frequency = "daily"
local_time = "02:00"
weekday = 1
month_day = 1
retention_count = 7
retention_days = 30
verify_after_backup = true
restore_test = false
```

系统任务安装命令使用 `ru` 和配置文件的绝对路径，不携带密码：Linux 使用 systemd user timer，macOS 使用 `~/Library/LaunchAgents`，Windows 使用当前用户 Task Scheduler。更新定义前保留时间戳备份，移除定义时走废纸篓。

## AIOps 认证凭证

服务器的 `auth_mode` 可为 `agent`、`key` 或 `password`。配置文件只保存认证方式、可选 `key_file` 和 `credential_id`；密码密文独立保存在 `<data_dir>/credentials/aiops/<credential_id>.secret`，密钥位于 `<data_dir>/credentials/aiops/aiops.key`，目录与文件权限为 `0700/0600`。历史版本把密钥平铺在凭证根目录 `<data_dir>/credentials/<模块>.key`（AIOps 即根目录下的 `aiops.key`），该文件会由 `ru config migrate` 或该模块首次访问凭证时自动移入模块目录，迁移只搬移密钥、不改动密文，已保存密码继续可解密。密码连接强制校验用户 `known_hosts`，未知或变化的主机密钥会直接失败，不提供跳过验证选项。

## 清理模板

清理模块的内置模板由程序代码提供，不写入主配置文件。用户新增、复制或编辑的清理模板保存在主配置文件同目录下的 `clean_templates.toml`。

开发模式下，`make run` 和 `make temp` 会在缺少配置时从 `config.development.toml.example` 创建 `data/config.toml`；已有配置不会覆盖。`make run` 监听 Go 源码、构建脚本和嵌入资源，变更后自动重建并恢复已确认的模块内导航层级。Docker 容器工作台的运行参数配置会重新读取容器数据后回到“配置参数”层；输入、弹框和执行任务状态不会恢复。修改 `data/config.toml` 不会重启，而是由应用内配置监听即时加载。清理模板仍位于主配置同目录的 `clean_templates.toml`。

```toml
[[templates]]
id = "dev-runtime-temp"
name = "开发运行目录临时文件清理"
description = "清理 data/runtime 下的临时文件"
rule_ids = ["temp"]
path_mode = "configured"
paths = ["./data/runtime"]
action = "scan_then_delete"
enabled = true
```

## 日志级别

- `debug`：命令上下文、消息发布和订阅等诊断信息；配置 `log_level = "debug"`、`--debug` 或 `RU_DEBUG=1` 时启用。
- `info`：应用启动退出、正常退出信号、命令开始完成、业务操作成功、执行视图进度日志等正常生命周期信息。
- `warn`：日志初始化失败、配置热更新失败、Docker daemon 信息不完整等可继续运行的问题。
- `error`：启动失败、命令失败、配置热更新失败、未捕获 panic 及其堆栈、消息处理异常和业务操作失败。

运行日志默认写入数据目录下的 `logs/ru.log`，默认是 logfmt 文本行（固定键 `time` / `level` / `msg` / `caller`，结构化字段同层输出），便于 `tail`、`grep` 直接排查；需要日志采集时把 `format` 改成 `json`，得到同样的键与字段、可直接用 `jq` 检索的 JSON 行。交互提示、表格和进度仍以人类可读文本输出到终端；菜单、结果汇总这类纯界面文案只写终端，需要同时通知用户的问题会写入终端和日志文件。

出错的排查入口：`error` 级记录都会带 `stage`（流程阶段）、`action`（操作）、`target`（对象）、`error`（原因）、`error_chain`（`%w` 错误链）与 `stack`（调用栈），例如：

```bash
grep 'level=error' ru.log                 # 文本格式：所有失败
grep 'level=error' ru.log | tail -1       # 最近一次失败及其完整上下文
jq -c 'select(.level=="error")' ru.log    # JSON 格式：按字段筛选
```

写操作（创建、修改、删除、推送、导入导出、开关端口等）完成后按 `info`（成功）或 `error`（失败）记录一条操作审计，字段为 `module` / `action` / `target` / `result` / `elapsed`。落盘消息与字段统一脱敏，密码、令牌、连接串凭证不会写入日志。

日志空间默认有界：未压缩峰值 ≈ `max_file_size × (max_files + 1)` = 10MB × 6 = 60MB，历史文件压缩并按天数清理后实际占用通常只有几 MB。`warn` / `error` 还会同时写入同目录的 `<名称>.error.log`（只收问题记录、至少保留 30 天），单个文件超过 4KB 的记录会被截断保留首尾。

完整的等级落点、通道分工、日志接口、初始化生命周期、空间上限与模块接入要求见 [日志体系与等级规范](logging.md)。

## 开发热更新会话

通过 `make run` 启动时，开发监听器会在每次重建前保存临时会话。会话包含当前模块、完整面包屑路径及由模块声明的最小安全定位信息；不会包含输入草稿、密码、令牌、弹框、确认动作或执行中的任务。重启后会优先重新读取实时资源和本地配置，再回到可安全重建的最近页面；无法安全恢复的深层界面会退回同一流程的上一级，而不会尝试重放操作。

## 缓存与系统清理

Docker 离线下载会优先复用 `[common] cache_dir` 下的缓存文件；缓存元数据和文件校验匹配时不重复访问远端。网络下载默认遵循系统环境代理，例如 `HTTP_PROXY`、`HTTPS_PROXY` 和 `NO_PROXY`。

系统级清理使用：

```bash
ru clean
ru clean --dry-run
ru clean --cache-only
ru clean --logs-only
```

该命令会清理配置缓存目录中的内容，并清理历史日志；当前日志文件与正在写入的错误专用日志（`<名称>.error.log`）不会被处理。历史日志清理默认保留最新的一半 `logging.max_files`，并清理早于一半 `logging.retention_days` 的历史日志。
