# 当前问题与改进建议审计（2026-06-28）

本文记录对当前工程状态的检查结果。范围覆盖工作树状态、质量守卫、构建入口、删除语义、TUI 约束、文档一致性和发布链路边界。本次只做审计与文档记录，未修改业务代码。

## 当前基线

- 工作树检查：`git status --short` 无输出，审计开始和构建后工作树均保持干净。
- 单元测试：`make test` 通过，包含 `scripts/check-quality.sh` 和全部 `go test ./...`。
- 当前平台构建：`make build` 通过，生成 `build/release/darwin/arm64/ru`，并成功下载、校验、放置当前平台随包 `trash`。
- 已有高危守卫仍然有效：旧命名残留、业务代码 `panic(`、业务代码直接 stdout/stderr 输出、Git 可见 `.DS_Store`、根目录临时二进制、脚本语法和配置监听锁边界检查均通过。

## 发现的问题

### P1：`build-linux` / `build-windows` 与正式发布包规则不一致

`make build` 和 `make release` 已经接入随包 `trash` 下载、校验和发布包结构验证，但 `build-linux`、`build-windows` 仍是直接 `go build` 到 `build/release/<os>/<arch>/ru` 或 `ru.exe`。这两个目标不会准备同平台 `trash`，也不会复制 `config.toml`、生成 `SHA256SUMS` 或 `RELEASE-MANIFEST.json`。

风险：

- 目标名称和输出目录容易让人误以为它们也是完整发布产物。
- 与 `docs/new-feature-guidelines.md` 中“每个平台发布包必须包含当前平台的 `ru` 与当前平台的 `trash`”“缺少目标平台 `trash` 产物 URL 时必须失败”不一致。
- 后续如果有人直接上传这些目录内容，会得到不完整包。

建议：

- 将 `build-linux` / `build-windows` 明确改名为仅编译目标，或复用 `scripts/build.sh` 的发布包路径。
- 如果保留当前目标名，至少在 help 文案和文档中标注“只编译 ru，不生成完整发布包”。
- 增加检查，避免它们被 `publish-github` 或其他发布入口误当成完整产物。

### P1：质量守卫尚未覆盖新增 TUI 规则

`scripts/check-quality.sh` 当前主要覆盖命名、`panic(`、直接终端输出、根目录产物、脚本语法和配置锁边界。当前 `AGENTS.md` 与 `docs/new-feature-guidelines.md` 已经加入更多 TUI 约束，但守卫还没有覆盖：

- 新增 TUI 文件不能继续平铺到 `internal/tui` 根目录。
- 结构化内容必须复用表格或公共参数表单。
- 快捷键必须来自 `GetHelpBindings()`，内容区不能内联操作提示。
- 数字键只能定位，不能直接执行。
- 执行态必须进入公共执行日志视图。
- 面包屑不能回退到 `当前任务`、泛化 `结果` 或只显示模块名。

风险：

- 这些规则目前主要依赖人工审查和局部测试，新增功能时容易绕过。
- `make test` 通过只能证明已有测试覆盖范围内没有回归，不能证明新 TUI 状态符合全部规则。

建议：

- 扩展 `scripts/check-quality.sh`，先加入低误报的静态检查，例如新增 TUI 根目录文件、内容区硬编码 `提示:` / `按 Enter` / `(y/n)`、业务控制器私有复选框文本等。
- 对复杂规则继续用单元测试覆盖，例如数字选择、帮助栏声明与实际按键、执行视图和面包屑节点。
- 将新增守卫接入 `make test` 前置流程，确保本地和 CI 一致失败。

### P2：TUI 目录分层仍处于大规模迁移期

当前 `internal/tui` 根目录仍有 49 个 Go 文件；`internal/tui/components/` 仅有执行状态主题组件，`internal/tui/modules/` 和 `internal/tui/shell/` 目前主要是 README。规则允许根目录文件作为迁移期 legacy，但这说明架构分层尚未真正落地。

风险：

- 公共组件、模块私有控制器、应用壳、布局和面包屑仍混在同一层，新增代码容易继续沿用旧位置。
- 后续迁移公共组件时，容易在 legacy 根目录和新目录之间形成重复实现。

建议：

- 不做一次性大搬迁，优先按“改到哪里迁哪里”的方式推进。
- 下一次修改 TUI 公共组件时，优先迁入 `internal/tui/components/`。
- 下一次修改 Docker、Clean、Database、Find、Firewall 私有控制器时，评估是否迁入 `internal/tui/modules/<module>/`。
- 迁移时必须同步测试和 import，避免只移动文件导致历史回归难排查。

### P2：`CLAUDE.md` 与项目主规则存在漂移

`AGENTS.md` 和用户上下文中已经包含完整规则，例如配置模板同步、TUI 公共组件、帮助栏、面包屑、执行日志、编号选择和列表导航等。根目录 `CLAUDE.md` 仍是较短版本，只覆盖通用约束和终端输出约束。

风险：

- 不同代理或工具读取不同入口时，会得到不完整约束。
- 文档越多，越容易出现旧规则和新规则并存的问题。

建议：

- 以 `AGENTS.md` 为主规则源，同步更新 `CLAUDE.md`。
- 同步时不要简单追加，应删除或改写过时描述，避免和公共组件规则冲突。
- 若后续继续维护 `docs/new-feature-guidelines.md`，需要保持它与 `AGENTS.md` 的核心规则一致。

### P2：`make test` 不包含构建和发布结构验证

当前 `make test` 会执行质量守卫和单元测试，但不会执行 `make build`、`make verify-release` 或 `git diff --check`。这符合“测试”和“构建”分离，但对审计类任务来说，单跑 `make test` 容易漏掉构建、随包 `trash`、发布包结构和文档空白字符问题。

风险：

- 新增构建脚本或发布链路改动时，`make test` 通过不足以证明产物可用。
- 发布包是否包含 `trash`、`SHA256SUMS`、`RELEASE-MANIFEST.json` 仍依赖额外命令。

建议：

- 保持 `make test` 轻量不变，但在审计、发布和构建相关改动中固定执行：

```bash
make test
make build
git diff --check
```

- 涉及发布包结构时额外执行：

```bash
make release
make verify-release
```

### P3：遗留 TODO 未形成明确任务

`internal/tui/main_menu.go` 仍有 `TODO: Implement Update logic`。当前未影响测试和构建，但作为用户可见功能菜单或未来入口，长期保留会让后续维护者不清楚这是废弃入口、待实现功能还是已经被其他流程取代。

建议：

- 如果更新能力已经由其他入口提供，删除或改写该 TODO。
- 如果仍要实现，补一个明确任务，说明入口、执行视图、随包 `trash` 更新策略和验证方式。

## 未发现的问题

- 未发现业务代码直接使用 `os.Remove` / `os.RemoveAll` / `Remove-Item` / `rm -rf` 这类硬删除路径。
- 未发现非测试业务代码中的 `panic(`。
- 未发现非 `internal/console` 业务代码直接调用 `fmt.Print*` 或绑定 `os.Stdout` / `os.Stderr`。
- 未发现根目录 `utils-cli`、`utool`、`ru` 临时二进制。
- 未发现 Git 可见范围内的 `.DS_Store`。

## 建议处理顺序

1. 先处理发布目标语义：明确 `build-linux` / `build-windows` 是“仅编译”还是“完整发布包”，避免产物误用。
2. 扩展 `scripts/check-quality.sh` 的低误报守卫，把已经写进规则的 TUI 禁止项前移到 `make test`。
3. 同步 `CLAUDE.md`、`AGENTS.md`、`docs/new-feature-guidelines.md` 中的核心规则，消除文档入口漂移。
4. 按后续实际改动逐步迁移 `internal/tui` legacy 根目录文件，不做无业务收益的大规模纯移动。
5. 清理或任务化 `internal/tui/main_menu.go` 的遗留 TODO。

## 本次执行的命令

```bash
git status --short
make test
make build
find internal/tui -maxdepth 1 -type f -name '*.go' | wc -l
rg -n "os\\.Remove(All)?|Remove-Item|rm -rf|\\brm\\b|trash\\.Move|trash \\\"|/usr/local/ru/trash|TRASH_SIDECAR|Delete|删除" --glob '**/*.go' --glob '**/*.sh' --glob '**/*.ps1' --glob 'Makefile' --glob '!build/**'
rg -n "fmt\\.Print|os\\.Stdout|os\\.Stderr|panic\\(|os\\.Remove|os\\.RemoveAll|Remove-Item|rm -rf|\\brm\\b|\\.DS_Store|utool|\\.utool|dutils|DUTILS|~/.dutils|~/.utool" --glob '!build/**' --glob '!vendor/**' .
```
