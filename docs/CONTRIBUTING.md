# 贡献指南

## 开发环境
- Go 1.26 分支至少 1.26.10；使用 Go 1.27 分支时至少 1.27.3；启用 Go Modules。质量与发布 CI 固定使用 Go 1.26.10
- 本机安装 `docker`，可选安装 `7z/7zzs`

## 代码规范
- 所有导出函数必须提供函数级注释（中文）
- 错误统一包装并返回，不使用 `panic`
- 单元测试覆盖关键解析与选择逻辑
- 直接写 stdout/stderr 的输出统一复用 `internal/console`，不在业务代码中调用 `fmt.Print*` 或直接绑定 `os.Stdout` / `os.Stderr`
- Bubble Tea TUI 通过 `View()` 返回字符串或写入 delegate 提供的 writer，不使用 `internal/console` 直接打印

## 构建与测试

SSH 依赖 `golang.org/x/crypto` 至少使用 v0.56.0，避免 GO-2026-6354、GO-2026-6355 的连接死锁漏洞。Go 1.26.10 修复 2026-10-21 Linux 质量日志中可达的 GO-2026-6809（crypto/x509 对已知不可信中间证书的校验）标准库漏洞；1.27 分支同样受该漏洞影响，需要 1.27.3 及以上。更新安全基线时必须同时修改 `go.mod`、质量工作流与发布工作流，并通过漏洞扫描验证。

```bash
make test
make build-mac   # 其他宿主平台改用 make build-linux / make build-windows
```

测试和编译统一使用 Makefile，不直接执行原生 `go test`、`go build` 作为默认验证命令。`make test` 会先执行 `make quality-check`，检查旧命名残留、业务 `panic`、直接终端输出、TUI 规则、脚本语法、ShellCheck、Go Vet 和配置监听锁边界，并包含 Shell 检查器、安装和发布流程回归。请先安装 ShellCheck；不要在项目根目录生成 `utils-cli`、`ru` 或其他临时二进制；日常交互调试使用 `make run`，它会在 Go 源码、构建脚本或嵌入资源变更后按宿主平台自动执行对应的 `make build-mac` / `make build-linux` / `make build-windows` 并重启应用。公共开发会话会记录各模块完整面包屑路径，并恢复已确认且可安全重建的导航：Docker 会重新读取容器与运行参数，清理、Find、数据库会重新读取对应列表或计划。输入、密码、弹框、确认与执行任务不会写入会话，重启后会退回同一流程的安全节点；`data/config.toml` 则由进程内热加载；单次临时编译使用 `make temp`，正式构建使用宿主平台对应的 `make build-mac` / `make build-linux` / `make build-windows`，产物统一进入 `build/` 目录。

`make clean` 会逐个将根构建目录、历史根目录二进制，以及 `internal/`、`cmd/` 内带 `build/debug/.ru/config.toml` 标记的旧测试残留移入废纸篓；受版本控制的路径会保留。`data/`、`sql/` 和本地发布配置不属于构建清理范围。回收失败或路径实际未移走时返回失败，重复清理无残留时明确报告。可用 `make test-clean` 验证清理范围、悬空链接、重复清理和失败传播。

涉及配置初始化的测试必须显式把 `configFile` 指向 `t.TempDir()`，并在测试结束前关闭配置监听器；不得依赖调试模式默认的相对 `build/debug/.ru`，以免在测试包源码目录生成配置、数据库和日志。


开发入口的模块展示有意区分：`make run` 通过临时参数 `--show-all-modules` 显示全部顶层 TUI 模块（包含防火墙和文件中转），用于界面开发与热更新；`make temp` 不传此参数，按当前平台和环境能力筛选模块。两者都启用 `--debug`，因此调试模式本身不决定模块可见性。该参数不写入配置，也不改变 CLI、模块内部功能及实际操作的环境检查；不支持的平台进入防火墙后显示不可用提示，文件中转使用不执行操作的界面预览。

### CI 非交互测试要求

默认质量与发布流水线必须能够在无人值守、标准输入为 EOF 的环境中完成。禁止等待人工确认、密码、菜单选择或真实终端输入；禁止启动没有固定命令和退出边界的交互 Shell、TUI 或编辑器。不能用增大整个测试套件的超时时间掩盖阻塞。

- 子进程测试必须明确提供参数、输入和退出条件；普通命令保持 stdin 为 EOF。确需验证菜单或终端行为时，只允许测试自己创建的伪终端和预置输入，必须提供独立超时、失败诊断及进程清理，不能连接 Runner 的控制终端等待操作者输入。
- Shell 回归必须使用临时 HOME、工作目录及必要环境变量白名单，隔离 `BASH_ENV`、`ENV`、`ZDOTDIR` 和用户插件配置；Bash 使用 `--noprofile --norc -c`，Zsh 使用 `-f -c`，按测试目的显式加载临时配置。Zsh 的系统级 `zshenv` 仍可能执行，不能只靠禁用用户配置保障退出。
- 外部命令必须有单独的超时；Go 测试使用 `exec.CommandContext`，捕获输出并限制管道等待（如 `WaitDelay`）。若命令会创建后台进程，测试还必须负责终止后代进程，不能把整套 Go 测试的默认 10 分钟超时当作子进程保护。
- 交互入口的参数构造与状态转换在单元测试中验证；真实用户终端、提示符、插件兼容性和退出恢复由人工验收或专门受控终端测试验证。非交互配置加载通过不代表真实交互终端已验收。
- 默认测试不得依赖真实账号、提权密码或外部服务；真实环境验证通过明确的集成测试开关启用，凭证不写入仓库。

文件中转别名回归使用 `make test-fileexport`，每个 Shell 命令限时 5 秒、管道等待限时 1 秒，专项包级验证限时 30 秒。测试覆盖临时配置加载、引号与参数转发、宿主启动环境污染、stdin EOF 和阻塞命令超时退出；`InteractiveShell()` 只检查命令构造，不执行开放式交互会话。`make test` 仍会包含这些测试。

2026-10-06 的 macOS 质量日志中，`TestInteractiveShellLoadsAliasWithoutExtraScript/zsh` 等待子进程退出直到包级 10 分钟超时；该测试继承宿主环境，且无独立子进程超时。堆栈能够确认等待位置，不能证明是哪条 Zsh 启动脚本阻塞。该回归已改为上述隔离的非交互验证，真实交互体验仍需单独验收。

上述规则适用于新增或修改的测试，也用于逐步整改既有测试。当前安装器菜单和开发终端恢复仍有自动化伪终端回归；它们用于模拟交互行为，不应要求人工输入，不能因此声称全部历史测试都已完成超时和后代进程清理审计。

### 发布脚本检查

`make shell-check` 自动发现 `scripts/` 下全部 `.sh` 文件（含子目录），同时检查随包的 Docker 离线安装脚本；新增发布、安装和测试脚本无需手动加入文件清单。语法检查按 shebang 选择 Bash 或 POSIX sh，ShellCheck 一次检查完整集合，汇总所有文件的诊断。`make test-shell-check` 验证自动发现、多个错误同时报告和 POSIX 语法约束。

Linux CI 当前安装的 ShellCheck 为 0.9.0；本机使用较新版本时，通过并不代表旧版也通过。修改发布脚本后，应同时验证 CI 版本和本机版本，可用 `make shell-check test-shell-check SHELLCHECK=/path/to/shellcheck-0.9.0` 指定检查器，再运行 `make test`。检查输出会显示实际版本。多项条件失败后退出的校验统一写成明确的 `if`，不要用 `A && B || fail`，也不要通过屏蔽 SC2015 或降低诊断级别绕过检查。

macOS CI 使用系统 Bash 3.2 执行脚本回归；本机安装了 Homebrew Bash 时，使用 `make test PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"` 验证同一环境，同时保留 Go 等工具的已有路径。变量后紧邻中文或全角标点时必须用 `${变量名}` 明确边界，例如 `${tag}；`，避免旧版 Bash 将后续字符误当成变量名；语法检查不能替代实际执行回归。

`quality-macos-2820` 在标签冲突回归中失败：错误提示中的未限定变量紧邻中文分号，Bash 3.2 将标点误读进变量名并触发 `unbound variable`；预期失败状态因此掩盖了实际脚本错误。标签冲突和安装器缺少程序的回归必须同时断言失败状态与完整错误内容。标签回归的输出断言失败时会将对应命令日志直接写入 stderr，其他断言失败时显示行号与命令，并保留临时诊断目录；成功后仍使用 `trash` 回收。

真实环境验正使用 `make test-integration`，默认会跳过所有外部系统。需要验证 Docker 时使用 `RU_INTEGRATION_DOCKER=1 make test-integration`；AIOps/SSH 还需要设置 `RU_INTEGRATION_AIOPS=1`、`RU_INTEGRATION_AIOPS_HOST` 和 `RU_INTEGRATION_AIOPS_USER`，端口与私钥可选；防火墙读取需以管理员权限设置 `RU_INTEGRATION_FIREWALL=1`。这些测试只读取 Docker 容器和防火墙规则，SSH 仅执行无副作用探测命令，禁止将真实地址、账号或密钥写入仓库。

### 开发终端恢复

`make run` 会在首次构建前通过 `stty sane` 修复交互终端遗留的 raw 模式，再恢复备用屏、光标等显示模式。热更新监听器在启动子进程前保存原始终端属性，在每次重建和最终退出前恢复；即使子进程超时被强制结束，也能恢复换行处理、输入回显和信号。标准输入重定向时，会尝试保存应用使用的控制终端；没有终端时跳过属性处理。

`make test-devwatch` 包含真实伪终端回归：模拟子进程进入 raw 模式后忽略退出信号，验证强制结束、重复恢复、标准输入重定向和换行回到行首。该回归在 Linux/macOS 上使用 `script`；其他平台或缺少该工具时跳过。

当前终端已经出现逐行向右偏移或输入不回显时，可执行 `stty sane` 立即恢复，再重新运行 `make run`。

## 提交
- 提交信息遵循简洁明确：`feat:`、`fix:`、`docs:`、`test:` 等前缀
- 在 PR 中说明变更内容与影响
