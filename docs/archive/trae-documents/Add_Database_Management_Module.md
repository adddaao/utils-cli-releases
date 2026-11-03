# 添加数据库管理模块实现计划

## 1. 概述
为 CLI 添加一个全新的“数据库管理”模块。首先实现 **Postgres** 子模块，该子模块下包含**数据导入**和**数据导出**两个核心功能。
每个功能都提供表格化的表单界面，允许用户配置连接参数（IP、端口、用户名、密码、数据库名）以及导出选项（模式、表、仅导出数据、仅导出表结构等）。

**核心需求（自带二进制）**：为了避免依赖宿主机的环境，底层执行命令将优先使用**自带的** `pg_dump` 和 `psql` 二进制文件。系统将在可执行文件同级的特定目录（如 `bin/`）中查找这些工具。默认使用纯 SQL 脚本格式进行导入导出。

## 2. 当前状态分析
目前系统的主菜单（`main_menu.go`）和布局管理器（`main_layout.go`）已经支持模块化扩展（Docker、清理、Find、防火墙）。服务注册中心（`service_registry.go`）使用依赖注入管理各模块的 Application Service。当前缺乏对外部数据库的管理和备份恢复能力。

## 3. 拟议更改

### 3.1 二进制文件查找与执行 (`internal/app/database/` & `internal/platform/`)
- **二进制路径解析**：实现一个查找函数，优先在当前程序所在目录的 `bin/` 目录下查找 `pg_dump` 和 `psql`（Windows 下为 `pg_dump.exe` 和 `psql.exe`）。如果找到则使用该绝对路径；如果未找到，则回退到使用系统的环境变量 PATH 中的命令。
- **创建 `dto.go`**：定义 `PostgresExportConfig` 和 `PostgresImportConfig`，包含所需的参数（Host, Port, User, Password, DBName, Schema, Table, DataOnly, SchemaOnly, FilePath）。
- **创建 `service.go`**：定义 `DatabaseApplicationService`，实现基于 `os/exec` 调用自带 `pg_dump` 和 `psql` 的逻辑。
  - **导出**：拼接 `<自带pg_dump路径> -h <IP> -p <Port> -U <User> -d <DB> ... > <FilePath>` 命令。根据参数追加 `-n <Schema>`, `-t <Table>`, `-a` (DataOnly), `-s` (SchemaOnly)。
  - **导入**：拼接 `<自带psql路径> -h <IP> -p <Port> -U <User> -d <DB> -f <FilePath>` 命令。

### 3.2 TUI 注册与菜单更新
- **`internal/tui/app_state.go`**：添加 `stateDatabase` 枚举。
- **`internal/tui/main_menu.go`**：在主菜单列表中添加 `{id: "database", title: "数据库管理", index: "x"}`。
- **`internal/tui/service_registry.go`**：注册 `database-app-service`。
- **`internal/tui/main_layout.go`**：在 `NewMainLayoutModel` 中添加 `menuItems`，并调用 `content.RegisterComponent("database", NewDatabaseController(registry))`。

### 3.3 TUI 控制器实现 (`internal/tui/database_controller.go`)
创建 `DatabaseController` 实现 `ContentComponent`、`BreadcrumbProvider`、`RootStateProvider` 接口。
- **状态管理 (`DatabaseControllerState`)**：
  - `Menu`：数据库子模块选择（目前只有 Postgres）。
  - `PostgresMenu`：导入/导出选项。
  - `PostgresExportConfig` / `PostgresImportConfig`：表单配置界面。
  - `Executing` / `Result`：执行中和执行结果展示。
- **表单界面**：
  - 遵守项目约束：必须按表格化表单展示，包含“字段 / 值 / 类型或说明”列。
  - 实现类似于 `DockerController` 的 `renderFormRow` 逻辑，展示并响应用户的 Enter（输入框）和 Space（开关切换）操作。
- **执行视图**：
  - 复用 `TaskExecutionModel`，在进入 `Executing` 状态时展示执行参数和下方滚动的日志输出。
  - 命令执行时拦截标准输出和标准错误，发送实时进度消息以刷新日志区域。

### 3.4 面包屑导航 (`internal/tui/breadcrumb_flows.go`)
- 为 `DatabaseController` 实现面包屑流程，如 `数据库管理 > Postgres > 数据导出 > 配置导出`。

## 4. 假设与决策
- **二进制自带策略**：不在此次代码提交中直接将庞大的 `pg_dump`/`psql` 提交到 Git 仓库，而是通过代码逻辑支持“如果当前目录的 `bin/` 存在则优先使用”，用户在打包发布时可自行将二进制文件放入该目录。
- **密码传递**：使用环境变量 `PGPASSWORD` 传递密码，避免密码在命令参数或进程列表中明文显示，保证安全性。
- **文件选择**：对于数据导入的路径选择，可以使用简单的输入框。
- **TUI 规范**：严格遵循 `AGENTS.md` 中关于表格展示、多选/单选、执行任务日志的约束。

## 5. 验证步骤
1. 启动 CLI，检查主菜单是否出现“数据库管理”。
2. 进入“数据库管理” -> “Postgres”，检查是否显示“数据导入”和“数据导出”。
3. 在本地建立 `bin/` 目录并放入伪造的 `pg_dump` 脚本（用于测试打印路径），进入“数据导出”，验证所有参数的表单交互。
4. 执行导出，观察“执行视图”是否优先调用了 `bin/` 下的自带脚本，并正常显示命令执行日志。
5. 执行导入，观察“执行视图”是否正常展示自带 `psql` 的执行日志。