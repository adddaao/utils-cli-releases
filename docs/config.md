# 配置说明

默认从 `~/.ru/config.toml` 读取，调试模式默认使用 `build/debug/.ru/config.toml`，支持 `toml`。环境变量前缀：`RU_`（如 `RU_CONCURRENCY=8`）。

默认配置模板保存在 `internal/assets/config/default_config.toml`，首次初始化、正式构建和发布打包都使用这份模板。根目录 `config.toml.example` 作为外部示例保留，并由测试校验与默认模板一致。

本地开发模板位于 `config.development.toml.example`；`make run` 和 `make temp` 仅在缺少时生成 `data/config.toml`，不会覆盖已有本地配置。清理模块用户模板位于主配置同目录的 `clean_templates.toml`。

PostgreSQL 导入/导出成功后，连接历史才会写入 `[database].profiles`。主机、端口和用户名用于逐级内联提示；密码只以独立加密凭证保存，`[[database.profiles]]` 中的 `credential_id` 指向 `<data_dir>/credentials/database/<credential_id>.secret`，密钥位于 `<data_dir>/credentials/database/database.key`，目录与文件权限为 `0700/0600`。不要手工写入明文密码。旧版本内联在 `config.toml` 的 `password_ciphertext` 仍可读取，执行 `ru config migrate` 会把它转换为独立凭证。

`[database].custom_dump_threshold_gib` 默认是 `8`。导出前会按数据库、模式或已选表的源存储大小估算；达到阈值或无法预估时，TUI 会要求选择 PostgreSQL Custom `.dump`（`pg_dump -Fc`）、保持当前格式或取消。该估算不是普通 SQL 最终体积，普通 SQL 可能更大；`.dump` 可在导入页由 `pg_restore` 自动恢复。

`[database].backup_plans` 保存 PostgreSQL 备份计划，不保存密码。每个连接档案具有稳定 `id`，计划通过 `connection_profile_id` 引用档案。计划包含格式、输出目录、daily/weekly/monthly 频率、本地时间、保留数量与天数，以及校验和恢复演练开关；月日期限制为 1–28。定时任务由 `ru database backup schedule install` 注册到当前用户的 systemd、launchd 或 Task Scheduler。

AIOps 服务器只保存 `auth_mode`、`credential_id` 和可选 `key_file`。Agent 和密钥模式不需要凭证文件；密码模式的密文位于 `<data_dir>/credentials/aiops/<credential_id>.secret`，密钥位于 `<data_dir>/credentials/aiops/aiops.key`，目录与文件权限为 `0700/0600`。历史版本把密钥平铺在凭证根目录 `<data_dir>/credentials/<模块>.key`（AIOps 即根目录下的 `aiops.key`），该文件会在 `ru config migrate` 或首次访问凭证时自动迁入模块目录，只搬移密钥、不改动密文。旧 v2 明文密码必须先通过 `ru config migrate` 转换，程序不会在配置版本过旧时继续执行远程操作。

优先级：默认值 > 配置文件 > 环境变量 > CLI 参数。
