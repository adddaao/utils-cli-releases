# 平台支持

## 功能矩阵

| 功能 | Linux 本地 / SSH | macOS 本地 / SSH | Windows 本地 | WSL | 门控方式 |
|------|------------------|------------------|------------|-----|----------|
| Docker 管理 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | Docker daemon 可访问 |
| 镜像保存/加载 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | Docker daemon 可访问 |
| 容器管理 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | Docker daemon 可访问 |
| 容器资源监控 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | Docker daemon 可访问 |
| 镜像模糊搜索 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | Docker daemon 可访问 |
| 文件清理 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | 全平台可用 |
| macOS 元数据清理 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | 全平台可用 |
| 文件查找 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | 全平台可用 |
| 打开生成物、剪贴板 | ✓ 本地桌面 / ✗ | ✓ / ✗ | ✓ | 按桌面会话与依赖检测 | SSH 一律隐藏 |
| 特权文件中转 | ✓ / ✓ | ✗ / ✗ | ✗ | ✗ | 原生 Linux + root + 普通登录用户 |
| 防火墙管理 | ✓ / ✓ | ✗ / ✗ | ✓ | ✗ | Linux 检测工具；Windows 检测系统 PowerShell，操作时校验 NetSecurity 与权限 |
| Systemd 服务创建 | ✓ / ✓ | ✗ / ✗ | ✗ | ✗ | 原生 Linux + systemd 运行目录 + `systemctl` |
| Docker 离线资源制作 | ✓ | ✓ | ✓ | ✓ | 可为 Linux 目标机下载和打包 |
| Docker 离线安装 | ✓ / ✓ | ✗ / ✗ | ✗ | ✗ | 与 Systemd 服务创建相同 |
| 数据库备份计划/状态 | ✓ / ✓ | ✓ / ✓ | ✓ | ✗ | 原生系统计划任务工具 |
| AIOps 远程部署 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | 系统 ssh/scp 或内置 SSH/SFTP；首次连接需确认 known_hosts |
| AIOps 本地目标 | ✓ | ✓ | ✗ | ✓ | `transport=local`，仅 macOS/Linux 用户态；状态查看/巡检仅对 SSH 目标开放 |
| 自安装 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | Build tag |
| 回收站删除 | ✓ / ✓ (sidecar) | ✓ / ✓ (sidecar) | ✓ (sidecar) | ✓ (sidecar) | 随包或 PATH 中的 `trash` |
| 配置热重载 | ✓ / ✓ | ✓ / ✓ | ✓ | ✓ | 全平台可用 |

## 构建目标

| 平台 | 架构 | 状态 |
|------|------|------|
| Linux | amd64, arm64 | 完整运行目录与发布包支持 |
| Linux | ppc64le, s390x, riscv64, 386, armv7 | 尚未完成 PostgreSQL 客户端随包与发布验收 |
| Windows 10/11、Server 2016 及以上 | amd64 | ✓ |
| Windows 7/8/8.1 | — | 当前发布包不支持 |
| macOS | arm64 | ✓ |
| macOS | amd64 | 未构建 |

`make build-linux` 的完整运行目录目前只覆盖 amd64 和 arm64；其他 Linux 架构不能把单独的 Go 交叉编译结果视作可安装的发布包。

Windows 发布包采用 `go.mod` 指定的 Go 1.26.10；[Go 官方最低系统要求](https://go.dev/wiki/MinimumRequirements#windows)从 Go 1.21 起为 Windows 10 或 Server 2016。当前依赖和随包工具也没有 Windows 7 兼容验收，不能把“脚本能下载”当作“程序能运行”。

一键安装要求系统 Windows PowerShell 5.1；同一行命令可从 CMD、PowerShell 5.1 或 PowerShell 7 执行，统一启动 `powershell.exe` 并自动设置安装进程的 TLS 1.2。直接执行安装脚本支持 PowerShell 5.1 及以上。安装器在联网下载包之前检查系统与 PowerShell 版本；Windows 32 位和 ARM64 暂无对应发布包。TLS 和编码处理见[发布流程](release-workflow.md#url-一键安装)。

## 门控机制

### 编译时 (Build Tags)

| 文件 | Tag | 用途 |
|------|-----|------|
| `install/install_unix.go` | `!windows` | 把 `ru` 放到 `~/.local/share/ru`，并创建 `~/.local/bin/ru` 命令入口，无需 sudo；随包 `trash` 存在时一并安装，缺失时只告警不阻断 |
| `install/install_windows.go` | `windows` | 把 `ru.exe` 放到 `%LOCALAPPDATA%\Programs\ru`，PowerShell 配 PATH；随包 `trash.exe` 存在时一并安装，缺失时只告警不阻断 |
| `trash/trash_darwin.go` | `darwin` | macOS 使用随包或外部 `trash` 命令 |
| `trash/trash_other.go` | `!darwin` | Linux/Windows 使用 sidecar 或外部 trash 命令 |

### 运行时检测 (`internal/platform`)

```go
// 统一功能检测
platform.IsFeatureSupported(platform.FeatureFirewall)  // 防火墙
platform.IsFeatureSupported(platform.FeatureSystemd)    // Systemd 服务
platform.IsFeatureSupported(platform.FeatureFileExport) // 特权文件中转
platform.IsFeatureSupported(platform.FeatureDockerOfflineInstall) // Docker 离线安装
platform.IsFeatureSupported(platform.FeatureDatabaseSchedule)     // 数据库计划任务

// 直接平台检查
platform.IsWindows()
platform.IsLinux()
platform.IsWSL()
platform.IsRemoteShell()
platform.IsDarwin()
```

### 功能门控位置

| 功能 | TUI 门控 | CLI 门控 | 说明 |
|------|----------|----------|------|
| 防火墙导航 | `main_layout.go` 条件注册 MenuItem 和 Component；`make run` 显示全部模块 | `firewall/cmd.go` 平台门控；Windows 后端检查写入权限 | 默认在 macOS、WSL 上不可见；开发入口可进入不可用提示页；Windows 使用官方 NetSecurity 接口 |
| Systemd 服务 | Docker 维护菜单条件显示 | `docker/cmd.go` PersistentPreRunE 报错 | 仅原生 Linux 的实际 systemd 环境可见 |
| Docker 离线安装 | Docker 离线资源菜单条件显示安装项 | `offline.go` 运行时检查能力 | 其他平台仍可下载、打包 Linux 离线载体 |
| 特权文件中转 | `main_layout.go` 默认仅原生 Linux 显示；`make run` 可临时预览 | `fileexport/cmd.go` 返回 Linux/root/登录用户错误 | WSL 默认不显示，开发预览不执行操作；不会导出到 `/root` |
| 数据库计划任务 | 备份菜单仅在原生计划任务可用时显示计划与状态项 | `database backup schedule` 提前报错 | WSL 只保留即时备份、校验与恢复演练 |
| AIOps 本地目标 | 服务器表单按连接方式隐藏 SSH 字段；状态查看/巡检不列出本地目标 | `AIOps ValidateConfig` 在 Windows 拒绝本地目标 | 本地目标依赖 POSIX `sh`/`cp`/`ls` |
| 打开生成物、剪贴板 | `components/actions` 与 Docker 帮助栏按能力注册 | — | 所有 SSH 会话均不显示且按键无效 |

`make run` 显示全部顶层 TUI 模块，`make temp` 按当前环境筛选；展示开关不改变实际能力与操作权限。开发入口契约见[贡献指南](CONTRIBUTING.md)。

## 压缩支持

防火墙的规则归属、网络配置文件范围和成功状态含义见[防火墙管理](firewall.md)。

| 类型 | 依赖 | 平台 |
|------|------|------|
| none | 无 | 全平台 |
| gzip | Go 标准库 | 全平台 |
| zstd | `klauspost/compress` | 全平台 |
| 7z | 系统 `7z`/`7zz` 命令 | 需额外安装 |

## 回收站实现

```
macOS:          sidecar trash 二进制 或 PATH 中的 trash
Linux:          sidecar trash 二进制 或 PATH 中的 trash
Windows:        sidecar trash.exe 或 PATH 中的 trash.exe
```

`ru install` 和发布包安装脚本都把随包 `trash` 视为最优方案而非必需项：找不到随包 `trash` 时只打印降级告警并继续安装，替换旧 `ru`、旧命令入口或旧 `trash` 时改为改名备份为 `*.bak`（`*.bak` 已存在时追加时间戳），不做硬删除。此时 `ru` 的删除类功能仍需要 PATH 中存在 `trash` 命令。

## 配置文件权限

| 平台 | 权限处理 |
|------|----------|
| Linux/macOS | `os.Chmod(0600)` 仅 owner 可读写 |
| Windows | 跳过 `chmod`，依赖 NTFS ACL |
