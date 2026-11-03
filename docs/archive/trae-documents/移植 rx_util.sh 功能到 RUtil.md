我将把 `rx_util.sh` 的功能移植到 `utils-cli`，并严格遵守"不新增 cmd 目录文件"的原则，采用将 Command 定义下沉到 `internal` 包的模式。

### 1. 新增防火墙模块 (`internal/firewall`)
- **文件结构**:
    - `internal/firewall/manager.go`: 核心接口 `Manager` (Open/Close/List) 与工厂方法。
    - `internal/firewall/firewalld.go`: Firewalld 实现。
    - `internal/firewall/ufw.go`: UFW 实现。
    - `internal/firewall/iptables.go`: IPTables 实现。
    - `internal/firewall/cmd.go`: 定义 `NewCmd()`，返回 `firewall` 子命令。
- **功能**:
    - 自动检测防火墙类型。
    - 支持 `open`, `close`, `list` 子命令。
    - 示例: `RUtil firewall open -p 80 443`

### 2. 扩展 Docker 模块 (`internal/docker`)
- **文件结构**:
    - `internal/docker/service.go`: 实现 `CreateSystemdService` 逻辑。
    - `internal/docker/prune.go`: 实现 `PruneExited` 逻辑。
    - `internal/docker/cmd.go`: 定义 `NewServiceCmd()` 和 `NewPruneCmd()`。
- **功能**:
    - **Systemd 服务**: `RUtil service <container>` (生成并启用服务)。
    - **清理容器**: `RUtil prune` (清理退出状态的容器)。

### 3. 集成到主程序 (`cmd/dit/main.go`)
- 修改 `NewRootCmd`，注册新命令：
    - `cmd.AddCommand(firewall.NewCmd())`
    - `cmd.AddCommand(docker.NewServiceCmd())`
    - `cmd.AddCommand(docker.NewPruneCmd())`

### 4. 权限与兼容性
- **Root 检查**: 在 `firewall` 和 `service` 命令执行前检查 `os.Geteuid()` (Linux/Mac)。
- **平台限制**: 防火墙和 Systemd 功能限制在 Linux 平台运行 (通过 runtime.GOOS 判断或构建标签)。

### 5. 功能对齐说明
- **导出/导入**: 现有的 `save` 和 `load` 命令已满足脚本 `-de/-di` 需求，无需新增代码。
- **中文支持**: 保持现有的中文输出风格。