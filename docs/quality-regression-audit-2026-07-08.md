# 质量回归审计（2026-07-08）

本文记录对 2026-07-08 质量审计后续修复的回归检查结果。范围覆盖 Git 可见变更、质量守卫、构建链路、删除语义、终端输出、TUI 目录边界、文档一致性和已记录问题的修复状态。

## 回归结论

- 回归验证通过：`make test`、`make build`、`git diff --check` 均通过。
- 初次回归时工作树干净；第二轮回归时存在已暂存变更，见“第二轮回归审计”。
- 未发现高危回归：没有业务 `panic(`、直接 stdout/stderr、Git 可见 `.DS_Store`、根目录临时二进制或文件硬删除路径回归。
- 2026-07-08 初始审计中的 P1 文档漂移已修复：`README.md` 和 `docs/README.md` 已指向 `build/compile/...`，`AGENTS.md` 与根目录 `CLAUDE.md` 已无差异。
- 初始审计中的自更新 TODO 已从代码中清理；当前只在历史审计文档中保留记录。

## 第二轮回归审计

第二轮回归审计针对当前已暂存变更执行。暂存范围包括：

- `.trae/specs/residual-risk-fixes/` 下的修复计划、任务和检查清单。
- `docs/README.md` 与本回归审计文档。
- Find 和 AIOps 的面包屑、帮助栏、执行视图测试补充。
- `internal/tui/keys.go` 迁移为 `internal/tui/shell/keys.go`，并更新引用方。

验证结果：

- `make test` 通过，质量守卫和全部 Go 单元测试通过。
- `make build` 通过，当前平台 `ru` 构建成功，随包 `trash v0.0.7` 下载并通过 SHA256 校验。
- `git diff --check` 和 `git diff --cached --check` 通过。
- `internal/tui` 根目录 Go 文件数量为 48，低于 49 的质量守卫上限。
- 未发现非测试业务代码中的 `panic(`、直接 stdout/stderr 输出或 Git 可见 `.DS_Store`。

审计中发现并已修复的问题：

- `.trae/specs/residual-risk-fixes/spec.md` 存在尾随空格，已清理。
- `.trae/specs/residual-risk-fixes/checklist.md` 和 `tasks.md` 缺少文件末尾换行，已补齐。

## 已验证修复项

### README 交叉编译产物路径

当前状态：

- `README.md` 中 `make build-windows` 产物为 `build/compile/windows/amd64/ru.exe`。
- `README.md` 中 `make build-linux` 产物为 `build/compile/linux/<arch>/ru`。
- `docs/README.md` 也标注 `build-linux` / `build-windows` 是仅编译目标，不包含完整发布资源。
- `Makefile` help 与实际输出路径一致。

结论：已修复，无回归。

### 规则入口文档漂移

当前状态：

- `diff -u AGENTS.md CLAUDE.md` 无输出。
- 根目录 `CLAUDE.md` 已同步较新的 TUI 公共组件、路径补全、参数表单和组件接入规则。

结论：已修复，无回归。

### 自更新 TODO

当前状态：

- `rg -n "TODO\\(feature\\)|TODO:|FIXME|XXX"` 只命中历史审计文档。
- 未再命中 `internal/tui/main_menu.go` 中的自更新 TODO。

结论：代码 TODO 已清理，无回归；历史审计文档中的记录可保留。

## 仍需关注的残余风险

### TUI legacy 根目录仍在阈值边界

当前 `internal/tui` 根目录 Go 文件数量仍为 49，等于 `scripts/check-quality.sh` 的上限阈值。当前没有新增平铺文件，但后续任何新增根目录 Go 文件都会触发质量守卫失败。

建议继续按“改到哪里迁哪里”推进，不做一次性大搬迁。

### TUI 交互规则仍主要依赖单元测试覆盖

质量守卫已覆盖根目录文件数量、内联操作提示和公共组件清单，但数字定位、帮助栏与按键消费一致性、面包屑、执行视图和异步完成目标状态仍需要靠模块单测证明。

建议后续修改 Docker、Clean、Database、Find、AIOps 等模块状态机时，同步补对应状态测试。

### 本地发布配置仍是本机风险

`release.local.mk` 仍被 `.gitignore` 忽略，不进入 Git 可见范围；但本地配置包含私有 token，并启用了临时 TLS 绕过开关。回归审计没有输出真实 token。

建议继续保证不提交、不粘贴真实 token；长期用 CA 文件或系统信任链替代 `TRASH_CURL_INSECURE := 1`。

## 本次执行命令

```bash
git status --short
make test
make build
git diff --check
find internal/tui -maxdepth 1 -type f -name '*.go' | wc -l
git ls-files -co --exclude-standard -- '*.DS_Store' '**/.DS_Store'
rg -n "fmt\\.Print|os\\.Stdout|os\\.Stderr|panic\\(" --glob '**/*.go' --glob '!**/*_test.go' --glob '!internal/console/**' --glob '!build/**' internal cmd
rg -n "os\\.Remove(All)?|Remove-Item|rm -rf|\\brm\\b" --glob '**/*.go' --glob '**/*.sh' --glob '**/*.ps1' --glob 'Makefile' --glob '!build/**' .
rg -n "build/release/(linux|windows)|build/compile|仅编译|不包含完整发布资源" --glob '!build/**' README.md docs scripts Makefile
diff -u AGENTS.md CLAUDE.md
rg -n "TODO\\(feature\\)|TODO:|FIXME|XXX" --glob '!build/**' --glob '!vendor/**' .
```
