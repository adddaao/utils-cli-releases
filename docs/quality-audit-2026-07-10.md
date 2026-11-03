# 全量质量审计（2026-07-10）

## 结论

当前版本 `v0.0.7` 的功能测试、当前平台构建、四个平台发布包和发布包完整性校验均已通过；删除语义、终端输出约束、TUI 文件分层、模板配置同步和发布产物结构未发现回归。

审计发现的标准静态检查问题均已修复：数据库测试不再复制 `sync.Once`，发布脚本的两处 ShellCheck 告警已消除，`make test` 已纳入 Go Vet 与 ShellCheck。CI 还会固定执行 Govulncheck，以及排除第三方 API 迁移噪声的高信号 Staticcheck SA / S 规则。当时发现的可达 Go 标准库漏洞通过将最低工具链升级到 Go 1.26.5 修复；这是历史审计结果。2026-10-05 的 Linux 质量日志促使安全基线升级到 Go 1.26.6 与 `golang.org/x/crypto` v0.56.0；2026-10-12 的日志又发现 Go 1.26.6 标准库可达漏洞，最低 Go 版本提高到 1.26.9；2026-10-21 的日志发现 GO-2026-6809（crypto/x509 可达），当前最低 Go 版本已提高到 1.26.10，1.27 分支要求 1.27.3 及以上，见[贡献指南](CONTRIBUTING.md)。

## 审计基线与范围

- 分支：`main`
- 提交：`7cd51bd0fd39400a81eddb8cb356f295234e3669`（2026-07-09）
- 版本：`v0.0.7`
- 工作树：审计开始时已有 4 个未提交的 TUI 改动：
  - `internal/tui/components/form/parameter_form.go`
  - `internal/tui/components/form/parameter_form_test.go`
  - `internal/tui/modules/aiops/controller.go`
  - `internal/tui/modules/aiops/controller_test.go`
- 本次只审计，未修改上述业务改动；本报告为本次新增文件。

审计覆盖质量守卫、全量单元测试、Go 标准静态检查、ShellCheck、当前平台构建、多平台发布包、发布包校验、`doctor` 自检、删除/输出/命令执行风险路径、TUI 规则和配置模板同步。

## 验证通过项

| 检查 | 结果 | 证据 |
|---|---|---|
| 质量守卫与单元测试 | 通过 | `make test` 成功执行 `scripts/check-quality.sh` 和全部 `go test ./...`。 |
| 当前平台构建 | 通过 | `make build` 成功生成 `build/release/darwin/arm64/ru`，并下载、校验、放置随包 `trash`。 |
| 多平台发布包 | 通过 | `make release` 成功生成 Linux amd64、Linux arm64、macOS arm64、Windows amd64 共 4 个包。 |
| 发布包完整性 | 通过 | `make verify-release` 校验了每个包的外层 SHA-256、包内 `SHA256SUMS`、`ru`、`trash`、配置和清单。 |
| 已构建程序自检 | 通过 | `build/release/darwin/arm64/ru doctor --json` 报告版本、配置、数据目录、日志、Docker 与随包 `trash` 均正常。 |
| 工作树格式 | 通过 | `git diff --check` 无输出。 |
| 依赖完整性 | 通过 | `go mod verify` 输出 `all modules verified`。 |
| 删除与输出约束 | 通过 | 质量脚本和定向扫描未发现非测试业务路径的硬删除、`panic(` 或绕过 `internal/console` 的直接终端输出。 |
| TUI 文件边界 | 通过 | `internal/tui` 根目录没有 `.go` 文件；功能代码已位于 `components/`、`modules/`、`shell/` 等目标层级。 |
| 配置模板同步 | 通过 | 仅比较节名和字段名后，`data/config.toml` 与 `internal/assets/config/default_config.toml` 没有缺失或额外字段。 |
| 构建与文档语义 | 通过 | README、docs 与 Makefile 都将 `build-linux`、`build-windows` 标为仅编译，并统一使用 `build/compile/...` 路径。 |

## 发现的问题

### 已修复 P1：`go vet ./...` 的同步原语复制

`internal/database/db_test.go` 中的 `TestGetDBReturnsErrorWhenUninitialized` 将全局 `dbOnce`（类型为 `sync.Once`）复制到局部变量，并在清理时写回。`sync.Once` 包含禁止复制的内部标记，`go vet ./...` 报出两处 `assignment copies lock value`。

影响：

- 标准 Go 静态检查无法通过，CI 或下游采用 `go vet` 时会直接失败。
- 当前 `make test` 仍然成功，无法把这类问题作为合并前门禁阻止。
- 虽然问题位于测试代码、当前测试未并行执行，复制已使用的同步原语依旧是不安全的测试隔离方式，后续测试并行化时风险会放大。

处理：将数据库包的 `dbOnce` 调整为指针，测试通过替换与恢复指针隔离全局状态；不再复制 `sync.Once` 的内部状态。

### 已修复 P2：发布脚本两处 ShellCheck SC2295 告警

`scripts/build.sh` 的第 104、128 行在参数展开的模式删除表达式中直接插入 `${repository}`。ShellCheck 报告 SC2295：该变量会作为 glob 模式的一部分参与匹配，而不是单纯文本。

当前默认仓库名 `rx/trash` 不含 glob 元字符，所以本轮发布成功；但可配置的 `TRASH_REPOSITORY` 一旦包含 `*`、`?` 或 `[`，推导 Release API / latest 页面地址的逻辑可能得到错误的 server URL。

处理：参数展开模式中的仓库名已单独引用，避免可配置仓库名被按 glob 元字符解释。

### 已修复 P2：质量门禁的静态检查覆盖不完整

`scripts/check-quality.sh` 已覆盖仓库约束（命名、业务 panic、终端输出、删除、TUI 目录和内联提示、脚本 Bash 语法、配置监听锁边界），但只执行 `bash -n`，没有运行：

- `go vet ./...`
- `shellcheck scripts/build.sh scripts/check-quality.sh scripts/update-trash.sh`

这正是本轮两个真实问题没有被 `make test` 发现的原因。

处理：`scripts/check-quality.sh` 已执行 ShellCheck 与 Go Vet；发布工作流会安装 ShellCheck，并固定执行 Staticcheck 2026.1 的 SA / S 高信号规则与 Govulncheck v1.4.0。U1000、ST1005 和第三方 API 废弃迁移作为独立重构工作处理，避免首次接入直接用大规模存量改动阻断发布。

## 风险评估与未发现项

- AIOps 本地构建命令会通过 `sh -c` 执行。这是支持用户配置安装/构建命令所需的能力；当前命令来源是本地受信配置，未发现外部不可信输入直接拼接到该 shell 命令的路径。后续若引入远端配置拉取、共享模板或 Web 输入，必须把该字段视为高风险命令边界。
- 发布配置可选择 `TRASH_CURL_INSECURE` 临时绕过 TLS 校验。当前文档已明确建议只作临时自签证书场景使用并优先安装 CA；本轮没有读取或泄露本机 `release.local.mk` 的实际配置。
- 本地审计环境未预装 `staticcheck` 与 `govulncheck`；发布 CI 已固定安装并执行它们，作为扩展静态分析和依赖漏洞扫描门禁。
- 未发现代码 TODO / FIXME / XXX / HACK 标记（历史审计文档中的记录除外）。
- 当前未提交的 AIOps 参数表单改动已有覆盖其新增行为的单元测试，且随 `make test` 通过；本次未发现该变更的格式、分层或帮助栏规则回归。

## 修复后验证

按当前安全基线，应使用 Go 1.26.10 或 Go 1.27.3 起各自分支的后续修复版本执行 `make test`、`make build`、`make release`、`make verify-release`、`git diff --check`；CI 会额外执行 Staticcheck 与 Govulncheck。

## 本次执行命令

```bash
git status --short
git diff --check
make test
make build
make release
make verify-release
build/release/darwin/arm64/ru doctor --json
go mod verify
go vet ./...
shellcheck scripts/build.sh scripts/check-quality.sh scripts/update-trash.sh
go run honnef.co/go/tools/cmd/staticcheck@2026.1 -checks='SA*,S*,-SA1019' ./...
go run golang.org/x/vuln/cmd/govulncheck@v1.4.0 ./...
```
