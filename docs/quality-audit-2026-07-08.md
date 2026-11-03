# 当前问题与改进建议审计（2026-07-08）

本文记录对当前工程状态的全量检查结果。范围覆盖工作树状态、质量守卫、删除语义、终端输出、TUI 组件约束、构建发布链路、配置模板、文档一致性和本地验证结果。本次只做审计与文档记录，未修改业务代码。

## 当前基线

- 工作树检查：审计开始时 `git status --short` 无输出；执行 `make build` 后仍无 Git 可见变更。
- 单元测试：`make test` 通过，包含 `scripts/check-quality.sh` 和全部 Go 单元测试。
- 当前平台构建：`make build` 通过，生成 `build/release/darwin/arm64/ru`，并成功解析、下载、校验和放置当前平台随包 `trash v0.0.7`。
- 空白检查：`git diff --check` 通过。
- 高危守卫仍然有效：旧命名残留、业务代码 `panic(`、业务代码直接 stdout/stderr 输出、Git 可见 `.DS_Store`、根目录临时二进制、TUI 根目录文件数量、TUI 内联操作提示、公共组件清单、脚本语法和配置监听锁边界检查均通过。

## 发现的问题

### P1：README 中的交叉编译产物路径已落后于 Makefile

`Makefile` 已将 `build-linux` 和 `build-windows` 明确收敛为“仅编译”目标，并输出到 `build/compile/linux/<arch>/ru` 和 `build/compile/windows/amd64/ru.exe`。但根目录 `README.md` 的构建表仍写为：

- `make build-windows` -> `build/release/windows/amd64/ru.exe`
- `make build-linux` -> `build/release/linux/<arch>/ru`

风险：

- 用户可能把仅编译产物误认为正式发布包。
- 与 `Makefile help` 中“不包含完整发布资源”的语义不一致。
- 后续发布排查时容易混淆 `build/compile` 与 `build/release` 的边界。

建议：

- 同步更新 `README.md` 的构建表，将交叉编译产物改为 `build/compile/...`。
- 在 `README.md`、`docs/README.md` 或发布说明中明确：`build-linux` / `build-windows` 只编译 `ru`，不包含 `trash`、`config.toml`、`SHA256SUMS` 或 `RELEASE-MANIFEST.json`。

### P1：规则入口文档仍存在漂移

根目录 `AGENTS.md` 和 `internal/tui/CLAUDE.md` 已包含较新的 TUI 公共组件规则，但根目录 `CLAUDE.md` 仍是旧版本，缺少或弱化了以下内容：

- 缺少“公共组件接入方式以 `internal/tui/components/README.md` 为准”的规则。
- 参数表单规则缺少 `RenderParameterFormFieldsLayout`、`RenderParameterFormFieldsPinned`、表单子页面框、贴底说明布局等约束。
- 路径输入规则缺少 Shell 风格补全、候选移动和 `SelectedPathSuggestion` 等约束。

风险：

- 不同代理或工具读取不同入口时，会得到不一致的工程约束。
- 后续新增 TUI 功能可能按旧规则实现，绕开最近补齐的公共组件能力。

建议：

- 以 `AGENTS.md` 为主规则源，同步更新根目录 `CLAUDE.md`。
- 保留 `internal/tui/CLAUDE.md` 作为 TUI 子目录入口，但需要明确它与根规则的关系，避免三份规则继续分叉。
- 后续新增公共组件规则时，同步检查 `AGENTS.md`、`CLAUDE.md`、`internal/tui/CLAUDE.md` 和 `internal/tui/components/README.md`。

### P2：TUI 目录分层仍处在 legacy 临界状态

当前 `internal/tui` 根目录仍有 49 个 Go 文件，刚好等于 `scripts/check-quality.sh` 的上限阈值。`internal/tui/components/` 目前主要只有执行状态主题组件，`internal/tui/modules/` 中只有 AIOps 和 Find 子目录，`internal/tui/shell/` 仍只有说明文档。

风险：

- 新增 TUI 文件一旦继续平铺到 `internal/tui` 根目录，质量守卫会失败。
- 公共组件、业务控制器、应用壳和流程面包屑仍大量混在 legacy 根目录，后续迁移时容易出现重复实现和 import 回归。

建议：

- 不做一次性大搬迁，继续按“改到哪里迁哪里”推进。
- 修改公共组件时优先迁入 `internal/tui/components/` 的对应子目录。
- 修改 Docker、Clean、Database、Firewall 等模块私有控制器时，优先评估迁入 `internal/tui/modules/<module>/`。
- 修改布局、导航、面包屑时，优先评估迁入 `internal/tui/shell/`。

### P2：TUI 质量守卫已有加强，但仍不能覆盖全部交互规则

`scripts/check-quality.sh` 已经比 2026-06-28 审计时更完整，新增了 TUI 根目录文件数量、内联操作提示和公共组件接入文档检查。但以下规则仍主要依赖单元测试和人工审查：

- 数字键只能定位，不能直接执行。
- 当前状态注册的 `HelpBinding` 与实际按键消费必须一致。
- 异步任务完成后必须回到自身流程，不能因结果类型相同误跳。
- 执行态必须展示执行日志，并把最终结果合并进公共执行视图。
- 面包屑不得退化到模块名、`当前任务` 或泛化占位。

风险：

- `make test` 通过只能证明现有测试覆盖范围，没有证明所有新增状态都遵守上述规则。
- 大模块控制器新增状态时，容易漏掉帮助栏、面包屑和执行视图回归测试。

建议：

- 对低误报规则继续放进 `scripts/check-quality.sh`。
- 对状态相关规则继续补业务单元测试，尤其是新增状态的帮助栏、按键消费、面包屑和任务完成目标状态。
- 对 Docker、Clean、Database、Find、AIOps 等主要模块建立最小状态覆盖清单，避免只在单个模块补测试。

### P2：本地发布配置包含敏感 token 和临时 TLS 绕过开关

`release.local.mk` 已被 `.gitignore` 忽略，当前不会进入 Git 可见范围；这是正确边界。但本地文件里包含 `TRASH_DOWNLOAD_TOKEN`，且启用了 `TRASH_CURL_INSECURE := 1`。

风险：

- 如果后续手工复制配置、粘贴日志或临时调整 `.gitignore`，token 有泄漏风险。
- `TRASH_CURL_INSECURE := 1` 适合内网临时环境，长期发布链路应优先安装根证书或配置 `TRASH_CURL_CA_FILE`。

建议：

- 继续保持 `release.local.mk` 不提交，不在公开文档、日志和 PR 描述中粘贴真实 token。
- 中长期把内网证书链收敛到 `TRASH_CURL_CA_FILE` 或系统信任链，减少 `-k` 下载。
- 发布前可增加一次 `git status --short` 和 `git check-ignore -v release.local.mk` 检查。

### P3：遗留 TODO 仍未任务化

`internal/tui/main_menu.go` 仍有 `TODO(feature): 实现自更新与配置更新逻辑`。它没有影响当前测试和构建，但仍属于用户可见入口附近的未完成意图。

建议：

- 如果自更新能力已经由其他入口承接，删除或改写该 TODO。
- 如果仍要实现，补成明确任务，说明入口、执行视图、随包 `trash` 更新策略和验证命令。

### P3：本地忽略目录存在较多 `.DS_Store` 和历史构建产物

磁盘上存在多个被 `.gitignore` 忽略的 `.DS_Store`，例如根目录、`data/`、`internal/`、`build/`、`.planning/` 等；`build/release/darwin/arm64/` 中也保留了旧版本发布包和 `ru.db`。这些内容没有进入 Git 可见范围，质量守卫不失败。

风险：

- 本地排查发布产物时，旧版本文件可能干扰人工判断。
- 被忽略文件虽然不影响提交，但会让目录浏览和手工打包更混乱。

建议：

- 需要清理时统一使用 `make clean` 或 `trash`，不要硬删除。
- 发布前优先执行干净的 `make release` / `make verify-release`，不要手工上传目录里的散落历史文件。

## 已确认改善的问题

- 2026-06-28 审计提到的 `build-linux` / `build-windows` 发布语义问题，当前 Makefile 已基本处理：目标输出已改到 `build/compile/...`，help 文案也标注“仅编译”“不包含完整发布资源”。
- 质量守卫已经新增 TUI 根目录文件数量、内联操作提示和公共组件接入文档检查。
- `docs/new-feature-guidelines.md` 已改为引用 `AGENTS.md` / `CLAUDE.md` 的 TUI 规则，避免重复维护大段条款。

## 未发现的问题

- 未发现业务代码直接使用 `os.Remove` / `os.RemoveAll` / `Remove-Item` / `rm -rf` 这类硬删除路径。
- 未发现非测试业务代码中的 `panic(`。
- 未发现非 `internal/console` 业务代码直接调用 `fmt.Print*` 或绑定 `os.Stdout` / `os.Stderr`。
- 未发现 Git 可见范围内的 `.DS_Store`。
- 未发现项目根目录存在 Git 可见的 `utils-cli`、`utool` 或 `ru` 临时二进制。
- 默认配置模板 `internal/assets/config/default_config.toml` 和已创建开发配置 `data/config.toml` 当前字段结构一致；差异主要是开发配置的本地路径、debug 开关和示例值。

## 建议处理顺序

1. 先修正文档漂移：同步 `README.md` 的 `build-linux` / `build-windows` 产物路径，并同步根目录 `CLAUDE.md`。
2. 继续推进 TUI legacy 分层：后续改到公共组件、模块控制器或 shell 逻辑时顺手迁移，不做无业务收益的大规模纯移动。
3. 给主要 TUI 模块补状态覆盖清单，把帮助栏、数字定位、面包屑和执行视图规则变成可回归测试。
4. 发布链路长期收敛 TLS 配置，尽量用 CA 文件替代 `TRASH_CURL_INSECURE := 1`。
5. 任务化或清理 `internal/tui/main_menu.go` 的自更新 TODO。

## 本次执行的命令

```bash
git status --short
make test
make build
git diff --check
find internal/tui -maxdepth 1 -type f -name '*.go' | wc -l
find internal/tui/components internal/tui/modules internal/tui/shell -maxdepth 2 -type f | sort
git ls-files -co --exclude-standard -- '*.DS_Store' '**/.DS_Store'
git check-ignore -v release.local.mk .planning/full-audit-2026-07-08/task_plan.md build/release/darwin/arm64/ru data/.DS_Store
rg -n "fmt\\.Print|os\\.Stdout|os\\.Stderr|panic\\(" --glob '**/*.go' --glob '!**/*_test.go' --glob '!internal/console/**' --glob '!build/**' internal cmd
rg -n "os\\.Remove(All)?|Remove-Item|rm -rf|\\brm\\b|trash\\(|trash \\\"|trash '\\''|Delete|删除" --glob '**/*.go' --glob '**/*.sh' --glob '**/*.ps1' --glob 'Makefile' --glob '!build/**' .
rg -n "build/release/(linux|windows)|build/compile|仅编译|不包含完整发布资源" --glob '!build/**' README.md docs scripts Makefile
diff -u AGENTS.md CLAUDE.md
diff -u CLAUDE.md internal/tui/CLAUDE.md
diff -u internal/assets/config/default_config.toml data/config.toml
```
