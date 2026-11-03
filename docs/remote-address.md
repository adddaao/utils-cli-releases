# 远程地址识别与归一化

本文件规定工程内所有“填写远程地址”的入口必须识别同一组写法，避免各模块自写校验造成“自建域名不识别”“带协议不识别”“IPv6 被拼坏”一类差异。实现位于 `internal/netaddr`，各模块只允许调用该组件，不允许再复制地址校验逻辑。

## 支持的组合

| 写法 | 示例 | 说明 |
|------|------|------|
| IPv4 | `192.168.1.108` | |
| IPv4 + 端口 | `192.168.1.108:5000` | |
| 裸 IPv6 | `2001:db8::1` | 不加方括号时整体视为主机，不当作“主机:端口” |
| 带作用域 IPv6 | `fe80::1%eth0` | |
| 方括号 IPv6 | `[2001:db8::1]`、`[fe80::1%eth0]:22` | 带端口时必须加方括号 |
| 公网域名 | `registry.example.com` | |
| 自建域名 | `harbor.corp.internal`、`gitea.corp.internal:3000` | 内网域名与自建服务域名与公网域名同规则 |
| 单标签自建主机名 | `harbor`、`harbor:5000` | 依赖内网 DNS 后缀或 hosts |
| `http://` / `https://` 前缀 | `https://harbor.corp.internal:8443` | 协议大小写不敏感，归一化后剥离 |

## 归一化规则

1. 协议只接受 `http`、`https`（AIOps 主机额外允许 `ssh`），统一转小写；归一化结果按入口需要剥离或保留。
2. 协议之后不允许出现路径、查询串、片段或用户信息（`user@host`）；下载源基础地址例外，它保留路径与查询串，但同样校验主机。
3. 主机统一返回不带方括号的字面量；域名结尾点会被去掉。
4. 端口必须是 `1-65535` 的十进制数，前导零会被归一（`05000` → `5000`）。
5. 重建地址一律走 `net.JoinHostPort` 语义：IPv6 自动补方括号，避免出现 `host:port:port` 这类无效地址。

## 各入口行为

| 入口 | 字段 | 归一化结果 | 说明 |
|------|------|-----------|------|
| Docker 可信任远端源 / `docker.registries[].server` | 服务端地址 | 去掉协议与首尾斜杠，保留 `主机[:端口]` | Docker 仓库标识本身不含协议；登录与落盘使用同一归一化值 |
| 数据库导出/导入/备份连接 | 主机、端口 | `-h` 只收到裸主机；主机内嵌端口在端口字段为空时并入 | 兼容用户直接粘贴带协议的连接地址 |
| AIOps SSH 主机 | `aiops.servers[].host` | 去掉协议与方括号得到裸主机 | 地址内嵌端口优先于 `port` 字段，两者都没有时使用 `22` |
| Docker 离线下载源 | `--docker-base-url` / `--compose-base-url` | 必须显式带 `http://` 或 `https://` | 镜像源既有明文也有 TLS，猜测协议会连错地址，因此缺少协议时直接报错 |
| 发布安装器发布源 | `RU_RELEASE_BASE_URL` | base URL 必须停在 `<协议>://<主机[:端口]>/<所有者>/<仓库>/releases` | 预览版 API 地址由此推导，见下节 |

## 发布安装器的 API 地址推导

`scripts/install.sh` 与 `scripts/install.ps1` 在查询预览版（以及 PowerShell 的已知来源）时会自动推导 Release API 地址：

| 发布源 | 推导结果 |
|--------|----------|
| `https://github.com/<所有者>/<仓库>/releases` | `https://api.github.com/repos/<所有者>/<仓库>/releases` |
| `http://<自建域名或 IP:端口>/<所有者>/<仓库>/releases` | `<协议>://<主机[:端口]>/api/v1/repos/<所有者>/<仓库>/releases` |

自建来源按 Gitea API 路径推导，与 `scripts/build.sh` 中获取随包 `trash` 的规则一致。其他代码托管平台（例如 GitHub Enterprise 的 `/api/v3`）无法只凭主机名区分，必须显式设置 `RU_RELEASE_API_URL`。缺少协议、路径不是 `<所有者>/<仓库>/releases` 时，安装器会给出指向正确写法的错误，而不是让 `curl` 或 `Invoke-WebRequest` 猜协议。

## 拒绝的输入

- 空地址、内部空白、`har bor`；
- `999.1.1.1` 这类非法 IPv4；四段纯数字不会被当作域名接受；
- 空标签或非法标签：`harbor..example.com`、`-harbor`、`harbor-`、含下划线或非 ASCII 的标签；
- 越界端口：`host:0`、`host:70000`、`host:abc`、`host:`；
- 不受支持的协议（`ftp://`）与带协议的路径（`https://host/team`）。

## 测试

- `internal/netaddr/address_test.go`：组合矩阵、边界与渲染规则。
- `internal/config/docker_registry_test.go`、`internal/tui/components/form/parameter_form_test.go`：接入点归一化与校验提示。
- `internal/aiops/remote_test.go`：SSH/SCP 参数中的主机与端口拼接。
- `internal/app/database/endpoint_test.go`：PostgreSQL `-h` 主机归一化。
- `internal/docker/offline_test.go`：下载源协议要求与自建 HTTP 镜像源。
- `scripts/test-installers.sh`、`scripts/test-installers.ps1`：发布源自建域名、IP:端口与 `http`/`https` 组合的 API 推导。
