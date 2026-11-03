# Docker 离线下载、打包和安装

本流程根据用户选择获取程序，目标服务器安装时不联网。Docker 版本和目标架构由用户选择；Compose 可指定版本，启用后版本留空则采用下载时的最新稳定版。containerd、shim、runc 等程序使用所选 Docker 静态包内的配套文件，不单独猜选版本。默认由 dockerd 管理 containerd，不额外创建独立 containerd 服务。

## TUI 流程

进入 Docker → 离线下载安装 → 离线下载 Docker。选择目标架构与 Docker 版本；启用 Compose 后，版本默认显示“最新稳定版”，也可选择指定版本。版本弹框中的“最新稳定版”可恢复默认选择。Compose 与 Docker 没有在本工具中硬编码的一一对应版本表。切换架构后清空指定版本，Docker 需重新选择，Compose 恢复最新稳定版。

最新稳定版在开始下载时解析为确定版本，执行信息和日志展示解析结果，之后按版本 URL 下载并写入清单；目标服务器安装时不再解析 latest。解析失败会停止任务，不静默使用旧缓存或预发布版本。最新稳定版不保证所有旧 Engine 与项目配置都兼容。

下载结果包含 `offline-manifest.tsv` 和 `SHA256SUMS`。清单记录版本、目标架构、确切文件名与下载来源。已有文件只有在来源与本地摘要一致时才复用；Compose 文件名包含版本，避免切换版本后使用旧文件。旧版本文件可留在资源目录，但打包只包含当前清单的文件。

下载后选择安装载体（独立脚本或 ru）与归档格式（zip 或 tar.gz）。ru 载体必须与目标 Linux 架构一致；例如在 macOS 上准备 Linux 离线包时选择脚本载体。包名使用公共时间戳命名规则，重复包从 `_02` 开始递增，显式指定的已存在输出路径会被拒绝。

目标服务器进入离线安装，选择资源目录。读取并校验清单后展示 Docker、架构及 Compose 选择；可以取消安装 Compose。确认后进入公共执行视图，显示预检、备份、安装、启动、验证五个步骤与实际执行日志。结果保留在执行视图内。

## CLI 用法

```bash
# 查看候选 Docker 版本
ru docker offline download --arch amd64 --version-prefix 28 --list-only

# 下载用户所选版本及架构的程序
ru docker offline download --arch amd64 --version 28.0.3 \
  --compose --compose-version 5.4.0 --output ./docker-offline/x86_64

# 启用 Compose，留空版本采用下载时的最新稳定版
ru docker offline download --arch amd64 --version 28.0.3 \
  --compose --output ./docker-offline/x86_64

# 只有显式传入 --latest 才自动解析最新 Docker 版本；不能与 --version 同时使用
ru docker offline download --arch amd64 --latest --output ./docker-offline/x86_64

# 根据当前清单打包
ru docker offline package --input ./docker-offline/x86_64 --installer script --format tar.gz

# 在目标 Linux 上安装；默认采用包内 Compose 选择
sudo ru docker offline install --input ./docker-offline/x86_64

# 明确跳过 Compose
sudo ru docker offline install --input ./docker-offline/x86_64 --compose=false

# 独立载体：默认安装包内所选 Compose，也可显式跳过
sudo bash ./docker-offline/x86_64/install_docker.sh ./docker-offline/x86_64
sudo bash ./docker-offline/x86_64/install_docker.sh ./docker-offline/x86_64 --no-compose
```

`--docker-base-url` 接收 Docker 静态包根地址，按 `<架构>/docker-<版本>.tgz` 拼接；`--compose-base-url` 接收 Compose `releases/download` 根地址，按 `v<版本>/docker-compose-linux-<架构>` 拼接。自建镜像源应保持同样的目录结构；默认最新稳定版还要求对应 `releases/latest` 地址跳转到 `releases/tag/v<稳定版本>`。不提供此跳转的镜像源需手动指定 Compose 版本。

两个下载源地址都支持 `http://` 与 `https://`、域名、IPv4、IPv6（方括号形式）和 `IP:端口` 组合，例如 `https://mirror.corp.internal:8443/docker`、`http://192.168.1.10:8080/docker`。镜像源既有明文也有 TLS，协议不会被猜测：缺少 `http://` 或 `https://` 前缀时会直接报错并提示正确写法。完整地址规则见[远程地址识别与归一化](remote-address.md)。

## 校验与安装规则

- 清单和所有列出的文件都参与 SHA256 校验；安装或打包时拒绝缺失、损坏、重复记录、越界文件名和符号链接。摘要保证离线传输和本地缓存完整性，不能代替独立的上游签名或可信摘要认证。
- 安装前检查 Linux、root、目标架构、基础命令和包内必需程序；解压前拒绝非法路径、链接与特殊文件。运行包内 Docker、Compose 检查版本，并由 dockerd 校验实际使用的配置。
- 已有 `/etc/docker/daemon.json` 和 `/etc/systemd/system/docker.service` 保留；缺失时才采用包内文件。已有服务参数需要与本次选择相符，服务端版本验证可阻止旧启动路径被误报为安装成功。
- Docker 二进制安装至 `/usr/bin`；Compose 安装为 `/usr/local/lib/docker/cli-plugins/docker-compose`，使用 `docker compose`。不替换既有独立的 `/usr/local/bin/docker-compose` 命令。
- 原文件备份至 `/var/backups/ru-docker.*`，`targets.tsv` 保存备份编号与目标路径，`service-state.txt` 保存原运行和自启状态。已有运行服务先停止，再使用同目录暂存文件替换二进制。
- 启动失败会输出服务状态和最近 journal；启动后轮询本地 Docker socket，验证服务端版本和 `docker info`。安装 Compose 时额外核对 Docker CLI 实际调用的插件版本，并执行指向本地 socket 的只读 `docker compose ls --format json` 验证 daemon 连接；失败会触发恢复。校验成功后才设置开机自启。此检查验证基础 API 通信，不能替代具体项目配置和功能的运行验证。
- 安装失败时恢复备份文件，新建文件与未完成暂存文件移入备份目录；尝试恢复原服务运行、自启状态。恢复失败会明确写入日志。程序文件和服务状态恢复不代表 Docker 数据目录可跨版本降级，既有容器与数据的升级需要独立备份和验证。
- 临时目录只通过 trash 回收；没有 trash 或回收失败时保留目录并输出路径。原文件备份始终保留，不自动删除。

Go 安装入口与独立载体共用同一嵌入脚本，避免配置与验证行为漂移。旧的、没有选择清单的离线目录需重新通过下载流程生成；安装器不会按文件名排序、修改时间或通配符自行猜选安装包。

## 验证

`make test-docker-offline` 覆盖最新稳定版解析和版本固定、解析失败与预发布拒绝、关闭 Compose 不查询、版本/来源切换、缓存完整性、清单打包、载体平台、选择与按键、面包屑、异步取消及安装脚本的预检、配置保留、Compose 连接验证和失败恢复。脚本测试在隔离目录中重写系统路径，并使用受控 systemctl 等命令，避免修改宿主 Docker。`make test` 执行全量质量守卫与单元测试。
