# 质量审计与修复记录（2026-06-21）

本文记录本轮对当前工程问题的全局检查、已修复内容和验证结果。范围不只包含未提交改动，也包含工程内已有的运行期风险、输出规范、命名残留和文档一致性问题。

## 检查范围

- 当前工作树和未提交改动。
- 配置加载、热更新和初始化流程。
- 运行期 `panic` 风险点。
- 用户可见 stdout/stderr 输出是否统一经过 `internal/console`。
- TUI 未处理按键是否会破坏 Bubble Tea 渲染或导致崩溃。
- 旧二进制名、旧配置目录名和旧模块名残留。
- 文档、测试和示例是否符合当前 `ru` 命名。

## 已修复问题

### 项目定位文档漂移

根 README 仍把项目描述为 Docker 镜像保存/加载工具，和当前 TUI 中 Docker、清理、Find、防火墙、数据库管理等能力不一致。已将根 README、文档首页和根命令说明统一为“面向开发和运维的本地系统管理工作台”，并补齐数据库管理、Find TUI-only、安装和版本辅助边界。

相关文件：
- `README.md`
- `docs/README.md`
- `cmd/ru/main.go`

### Find 和数据库入口边界不清

纯文本菜单曾提示可以直接运行 `ru find`，但当前没有 `ru find` 子命令。已改为明确提示 Find 仅在全屏 TUI 中提供。数据库管理也在文档中明确为 TUI-only，当前聚焦 PostgreSQL 导入/导出、Docker 容器模式和手动连接模式，默认 SQL 导出目录为 `./sql`。

相关文件：
- `cmd/ru/main.go`
- `README.md`
- `docs/README.md`

### 配置热更新死锁

`config.Load()` 已经持有 `stateMu.Lock()`，此前 `tryWatchConfig()` 内部又对同一个锁加锁，真实 CLI 首次加载配置时可能自锁卡死。已将 `tryWatchConfig()` 中对 `watchedConfigPath` 的重复加锁移除，保持由调用方持锁保护。

相关文件：
- `internal/config/config.go`

### TUI 未处理按键 panic

条件编辑器移动模式下遇到未处理按键时会直接 `panic("unhandled default case")`，导致 TUI 崩溃。已改为 no-op 返回，并新增回归测试覆盖。

相关文件：
- `internal/tui/finder_condition.go`
- `internal/tui/finder_condition_test.go`

### Docker 离线打包 panic

离线打包遍历文件时，`d.Info()` 失败会通过 `mustInfo()` 触发 panic。已移除 `mustInfo()`，改为将 `d.Info()` 错误正常返回给调用方。

相关文件：
- `internal/docker/offline.go`

### 数据库未初始化 panic

`database.GetDB()` 在全局数据库未初始化时直接 panic。已改为返回 `(*DB, error)`，调用方 `find.NewHistoryManager()` 继续向上传递错误，并新增未初始化场景测试。

相关文件：
- `internal/database/db.go`
- `internal/database/db_test.go`
- `internal/find/history.go`

### 用户可见输出绕过 console

业务代码中仍有直接绑定 `os.Stdout` 的输出点。已将 Docker 日志跟随、Docker exec attach 输出和镜像加载默认输出统一改为 `internal/console.Stdout()`。交互输入仍保留 `os.Stdin`，因为它是终端输入源，不属于 stdout/stderr 输出封装范围。

相关文件：
- `internal/docker/manage.go`
- `internal/docker/sdk.go`
- `internal/transfer/load.go`
- `cmd/ru/main.go`

### 质量守卫漏扫子目录 Go 文件

`scripts/check-quality.sh` 使用 `--glob '*.go'` 时没有覆盖 `cmd/ru/main.go` 这类子目录 Go 文件，导致 `os.Stdout` writer 注入残留没有被质量守卫拦住。已改为 `**/*.go`，并新增 Git 可见范围内的 `.DS_Store` 与根目录临时二进制检查。

相关文件：
- `scripts/check-quality.sh`
- `.gitignore`

### 安装目录与删除语义边界

Makefile 的安装目标曾直接覆盖 `/usr/local/bin/ru`。已将安装目录收敛为 `/usr/local/ru`，安装时先安装随包 `trash` 到 `/usr/local/ru/trash`，再安装 `ru` 到 `/usr/local/ru/ru`，最后创建 `/usr/local/bin/ru` 命令入口。安装前的既有目标统一先使用新安装的 `trash` 移入废纸篓；如果缺少随包 `trash`，则安装失败，不回退硬覆盖。`ru install` 的 Unix 和 Windows 路径也同步改为先安装 `trash` / `trash.exe`，再安装 `ru` / `ru.exe` 到统一的 `ru` 目录。

相关文件：
- `Makefile`
- `internal/install/install_unix.go`
- `internal/install/install_windows.go`

### 旧命名残留

用户文档和测试中存在旧二进制名和旧配置目录名。已统一更新为当前的 `ru`、`.ru`，Docker 文档命令也更新为 `ru docker ...`。

相关文件：
- `AGENTS.md`
- `CLAUDE.md`
- `docs/CONTRIBUTING.md`
- `docs/architecture.md`
- `docs/docker_client_config.md`
- `docs/new-feature-guidelines.md`
- `internal/tui/layout_test.go`

### 文档示例输出规范

架构文档中的示例仍使用 `fmt.Printf` 打印用户可见进度。已改为 `console.Printf`，与工程输出规范保持一致。

相关文件：
- `docs/architecture.md`

## 验证结果

已按项目约定使用 Makefile 验证：

```bash
make test
make build
git diff --check
```

结果：
- `make test` 通过。
- `make build` 通过。
- `git diff --check` 通过。

额外复扫：
- 旧二进制名、旧配置目录名和旧模块名残留：未发现。
- 业务代码 `panic(` 残留：未发现。
- 业务代码直接 `fmt.Print*` / `os.Stdout` / `os.Stderr` 输出：未发现。剩余命中仅为规则文档、`internal/console` 自身和测试里的输出捕获或假命令输出。
- Git 可见范围内的 `.DS_Store` 与根目录临时二进制产物：由质量守卫检查，发现后必须用 `trash` 清理。

## 后续注意

- 新增直接终端输出时继续复用 `internal/console`。
- TUI 渲染路径仍保持返回字符串或组件 writer，不直接打印终端。
- 新增配置、模板、命令文档时统一使用 `ru` / `.ru` 命名。
- 新增可能失败的运行期路径时优先返回 error，不在业务流程中使用 panic。

## 防回归机制

已新增 `scripts/check-quality.sh`，并接入 `make test` 前置执行。该脚本会检查：

- 旧二进制名、旧配置目录名和旧模块名残留。
- 非测试业务代码中的 `panic(`。
- 非 `internal/console` 代码里的直接 `fmt.Print*`、`os.Stdout`、`os.Stderr`。
- Git 可见范围内的 `.DS_Store` 和根目录临时二进制产物。
- `tryWatchConfig()` 内部再次加 `stateMu` 锁，避免配置热更新锁边界回退。

后续新增类似问题时，`make test` 会直接失败。
