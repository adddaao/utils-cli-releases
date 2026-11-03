我将修复 `iptables` 列表为空时的报错，并优化全局的错误提示体验，防止简单的运行时错误显示大段的 Usage 信息。

### 1. 修复 `iptables` 列表查询 (`internal/firewall/iptables.go`)
- **问题**: 当前使用 `grep` 过滤输出，当没有匹配项时 `grep` 返回 exit code 1，导致 Go 认为命令执行失败。
- **修复**: 修改命令执行逻辑，允许 `grep` 返回 exit code 1（视为无匹配而非错误），或者直接在 Go 中过滤输出而不依赖 `grep`。鉴于跨平台兼容性，我将改为获取 `iptables -L -n -v` 的完整输出，然后在 Go 代码中按行查找包含 `dpt:` 的内容。这样更健壮。

### 2. 优化命令行错误体验 (`cmd/dit/main.go`)
- **问题**: Cobra 默认在命令返回 error 时打印 Usage 信息，这对于参数错误的场景很有用，但对于运行时错误（如网络问题、权限不足、查询为空）则显得冗余且干扰视线。
- **修复**: 在 `NewRootCmd` 中设置 `SilenceUsage: true`。这样只有在用户输入未知 flag 或参数错误时才会显示 Usage，而像 "exit status 1" 这种运行时错误只会打印错误信息本身。

### 3. 增强菜单交互的健壮性 (`cmd/dit/main.go`)
- **问题**: 在菜单循环中直接调用 `cmd.Execute()`，如果子命令报错，错误会直接向上冒泡导致程序退出。
- **修复**: 在 `runMainMenu`, `runFirewallMenu`, `runDockerMenu` 中捕获 `cmd.Execute()` 的错误。如果发生错误，打印错误信息（`fmt.Println(err)`）但不退出程序，而是允许用户继续操作或返回上一级。

### 4. 检查其他命令的健壮性
- **Docker Prune (`internal/docker/prune.go`)**: 已经处理了空列表的情况 (`if ids == "" { return nil }`)，无需修改。
- **Docker Service (`internal/docker/service.go`)**: 模板执行和文件写入都有错误处理，正常。
- **Firewalld/UFW**: 使用官方命令工具，通常只有在服务未运行时才会报错，这属于预期的运行时错误，通过第 2 点（SilenceUsage）可以优化展示。

### 5. 执行计划
1.  修改 `internal/firewall/iptables.go`: 重写 `List` 方法，移除 `grep` 依赖。
2.  修改 `cmd/dit/main.go`:
    -   在 `NewRootCmd` 添加 `SilenceUsage: true`。
    -   在所有菜单函数 (`run*Menu`) 中添加错误捕获逻辑，防止程序因单一命令失败而崩溃。