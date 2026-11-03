# Windows 适配与一键安装功能

我们将通过以下步骤实现 Windows 适配及跨平台一键安装功能：

## 1. Makefile 适配 Windows

在 `Makefile` 中添加 `build-windows` 目标，方便在非 Windows 环境下交叉编译 Windows 可执行文件。

* 新增 `build-windows`：编译生成 `build/bin/RUtil.exe`

* 新增适配Windows7的功能

## 2. 新增 `install` 子命令 (核心功能)

为了实现 "一键安装"，我们将直接在 `RUtil` 工具内部集成 `install` 命令。用户只需下载并运行一次 `./RUtil install`，程序会自动将自己安装到系统路径中。

### 功能设计

* **命令**: `RUtil install`

* **Linux/macOS**:

  * 将二进制文件复制到 `/usr/local/bin/RUtil`

  * 自动添加执行权限 (`chmod +x`)

  * **注意**: 需要用户使用 `sudo` 运行，若权限不足会提示。

* **Windows**:

  * 将二进制文件复制到 `%LOCALAPPDATA%\Programs\RUtil\RUtil.exe`

  * 使用 PowerShell 修改用户环境变量 `PATH`，将安装目录添加进去。

  * 无需管理员权限即可完成安装。

## 3. 代码结构变更

* **修改** `Makefile`: 添加编译目标。

* **修改** `cmd/dit/main.go`: 注册新的 `install` 子命令。

* **新增** `internal/install/`:

  * `cmd.go`: 定义 Cobra 命令。

  * `install.go`: 通用接口与逻辑。

  * `install_unix.go`: Linux/macOS 具体实现。

  * `install_windows.go`: Windows 具体实现 (PowerShell 交互)。

这将完美解决 "Exec format error" (通过正确编译) 和 "Permission denied" (通过规范化安装流程) 的问题。
