# Nexus APT 缓存与 CI 接入

质量与发布流程的 Ubuntu 24.04 amd64 任务容器通过内网 Nexus 下载系统依赖。配置入口是 `scripts/configure-ci-apt.sh`，两个工作流的所有 APT 安装步骤都先调用该脚本。

## 仓库与网络

管理页面：`https://nexus.nas/`。任务容器直接访问 `http://192.168.1.108:8086/repository`，避免依赖容器对 `nexus.nas` 的 DNS 解析和内网 HTTPS 证书安装。

| 仓库 | 类型 | 上游 | Distribution 字段 | 客户端发行分支 |
| --- | --- | --- | --- | --- |
| `ubuntu-archive` | `apt (proxy)` | `https://archive.ubuntu.com/ubuntu/` | `noble` | `noble`、`noble-updates`、`noble-backports` |
| `ubuntu-security` | `apt (proxy)` | `https://security.ubuntu.com/ubuntu/` | `noble-security` | `noble-security` |

Nexus 3.89.1 的表单要求填写 Distribution；本机已验证 `ubuntu-archive` 同时代理上述三个发行分支。两个仓库使用 `apt-cache` Blob Store，保留严格内容类型校验，不配置重新签名，透传 Ubuntu 签名元数据。

组件缓存最大年龄设为 `-1`，已缓存的软件包无需定期向上游确认；元数据缓存最大年龄为 `1440` 分钟，每天检查索引更新；未找到内容的负缓存有效期为 `60` 分钟。保持自动阻断不可达上游的默认设置。

容器会使用 Ubuntu 自带的 `/usr/share/keyrings/ubuntu-archive-keyring.gpg` 验证索引签名，并据此验证软件包摘要。没有启用 `trusted=yes` 或允许未签名源。

## 容量与清理

APT 使用独立文件 Blob Store `apt-cache`，路径为 `/nexus-data/blobs/apt-cache`，不与现有 Docker、Maven 等存储混用。

- 软配额选择 `Space Used`，阈值为 **2000 MB**。
- APT 清理策略 `apt-ci-unused-7d` 按 **7 天未下载**的组件识别闲置缓存，只绑定到上述两个代理仓库。现有 `Cleanup service` 每天北京时间 09:00 执行关联策略。
- 清理策略先软删除缓存。磁盘空间需要 Blob Store 压缩任务才能释放；待确认的 `apt-cache-compact-daily` 仅针对 `apt-cache`，每天北京时间 09:30 永久回收已软删除并保留至少 7 天的内容。此任务未确认前不保存启用。

软配额只会产生告警，**不会在达到 2000 MB 后停止写入**；闲置清理也不是严格容量上限。首次请求和缓存过期后的索引刷新仍需要 Nexus 访问上游。需要完全离线或严格硬限额时，应另行配置软件源快照与宿主存储配额。

参考：[Sonatype Blob Store 配额](https://help.sonatype.com/en/blob-stores.html)、[APT 仓库](https://help.sonatype.com/en/apt-repositories.html)、[清理策略](https://help.sonatype.com/en/cleanup-policies.html)。

## CI 行为

脚本保留镜像中的原软件源文件，并新增：

- `/etc/apt/sources.list.d/ru-nexus.list`：四个 Ubuntu 发行分支，包含 `main restricted universe multiverse`。
- `/etc/apt/apt.conf.d/99ru-nexus`：只选择上述来源，不读取其他源文件；对 Nexus 主机设置 APT 的 `DIRECT` 代理规则；网络失败重试 3 次；任一索引更新失败时返回非零。

APT 的主机级 `DIRECT` 配置优先于容器的外网 HTTP 代理，现有 `GOPROXY` 和其他下载的代理设置仍独立生效。镜像中的 Microsoft、Git LFS、Git PPA 等源不参与本项目的 APT 更新；所需工具由 Ubuntu 软件源提供。

工作流通过 `NEXUS_APT_BASE_URL` 声明仓库基础地址。脚本只支持 Ubuntu 24.04，并在写入前拒绝不支持的 URL、凭证 URL 和配置注入字符；重复执行得到相同配置。

## 验证

```bash
# 不访问真实 Nexus：验证配置生成、来源隔离、签名、幂等和错误边界
make shell-check test-ci-apt

# 使用 Ubuntu 24.04 amd64 容器访问真实 Nexus，更新索引并安装所需工具
make test-ci-apt-integration
```

集成验证将外网代理设为不可用地址，验证内网 Nexus 仍能直连。测试容器使用 `linux/amd64`，与 Linux Runner 一致；Apple Silicon 主机通过 Docker 的跨架构支持执行。Ubuntu ARM 软件包属于 Ubuntu Ports，上述仓库不用于 ARM Runner。

`make test` 包含离线配置回归，真实网络验证单独执行。可通过 `NEXUS_APT_BASE_URL` 或 `CI_APT_TEST_IMAGE` 覆盖集成验证地址和镜像。

本地容器通过不等于 Gitea Runner 已运行修改后的工作流；远端验证必须以新提交的 Actions 运行结果为准。

2026-10-05 已完成本地质量检查、Shell 配置回归和两次全新 Ubuntu amd64 容器集成验证。外网代理不可用时，四个发行分支的签名索引及全部 CI 工具仍成功下载、安装；专用存储实际占用约 48 MB。第二次验证的软件包下载从约 7 秒降至不足 1 秒。
