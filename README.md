# ru 发布包

这是 `ru` 的发布包仓库，只存放可直接下载使用的 Release 产物，不存放源码。

`ru` 是一个面向开发和运维的本地系统管理工作台。无参数运行时会进入全屏 TUI，也可以通过命令行完成常见自动化操作。

## 适合做什么

- 管理 Docker 镜像、容器、网络、磁盘、服务和离线安装相关任务。
- 清理 Maven、macOS、压缩包、临时文件和自定义规则匹配的内容。
- 在 TUI 中构建文件查找条件，复用模板和历史记录。
- 在 TUI 中执行 PostgreSQL 导入、导出，支持 Docker 容器模式和手动连接模式。
- 查看和调整 Linux、macOS 的防火墙端口状态。
- 执行安装、自更新和版本辅助类操作。

## 下载

前往 [Latest Release](https://github.com/adddaao/utils-cli-releases/releases/latest) 下载最新版本。

按系统选择对应文件：

| 系统 | 架构 | 下载文件 |
|------|------|----------|
| macOS | Apple Silicon / arm64 | `ru-<版本>-darwin-arm64.tar.gz` |
| Linux | amd64 | `ru-<版本>-linux-amd64.tar.gz` |
| Linux | arm64 | `ru-<版本>-linux-arm64.tar.gz` |
| Windows | amd64 | `ru-<版本>-windows-amd64.zip` |

每个发布包旁边都有同名 `.sha256` 文件，用来校验下载内容是否完整。

## 校验下载文件

macOS / Linux：

```bash
shasum -a 256 -c ru-<版本>-<系统>-<架构>.tar.gz.sha256
```

如果系统提供的是 `sha256sum`，也可以使用：

```bash
sha256sum -c ru-<版本>-<系统>-<架构>.tar.gz.sha256
```

Windows PowerShell：

```powershell
Get-FileHash .\ru-<版本>-windows-amd64.zip -Algorithm SHA256
```

将输出的哈希值与 `.sha256` 文件中的值对比即可。

## 解压和运行

macOS / Linux：

```bash
tar -xzf ru-<版本>-<系统>-<架构>.tar.gz
cd ru-<版本>-<系统>-<架构>
./ru --help
./ru
```

Windows：

1. 解压 `ru-<版本>-windows-amd64.zip`。
2. 在解压目录中打开 PowerShell。
3. 执行：

```powershell
.\ru.exe --help
.\ru.exe
```

直接运行 `ru` 会进入 TUI；如果只想查看命令行能力，可以先运行 `ru --help`。

## 安装到系统命令

发布包中包含 `ru` 主程序和配套文件。解压后可以先在当前目录试运行，确认正常后再按自己的系统习惯加入 `PATH`。

macOS / Linux 示例：

```bash
sudo mkdir -p /usr/local/ru
sudo cp ru trash config.toml /usr/local/ru/
sudo ln -sf /usr/local/ru/ru /usr/local/bin/ru
ru --help
```

如果系统提示没有执行权限：

```bash
chmod +x ru trash
```

Windows 可以把解压目录加入系统 `Path`，或在该目录中直接运行 `.\ru.exe`。

## 常用入口

```bash
ru
ru --help
ru version
ru list
ru save --all --compress gzip --output ./images
ru load --input ./images --recurse
```

部分功能只在全屏 TUI 中提供，例如文件查找条件构建器和数据库导入导出界面。

## 注意事项

- Docker 相关能力需要本机能够访问 Docker daemon。
- 清理工具会使用废纸篓语义处理删除动作，误删后优先从废纸篓恢复。
- 数据库管理默认面向 PostgreSQL 使用场景。
- Linux 防火墙能力取决于系统中实际可用的 UFW、firewalld 或 iptables。
- macOS 首次运行从网络下载的二进制时，可能需要在系统安全设置中允许执行。

## Release 说明

每个 Release 页面都会列出该版本的下载附件。通常只需要下载自己系统对应的主包和同名 `.sha256` 文件。

当前仓库只负责发布产物和使用说明；问题反馈、功能讨论和源码变更不在这个仓库中展开。
