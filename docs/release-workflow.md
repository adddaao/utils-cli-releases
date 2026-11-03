# Release Workflow 配置说明

本项目的 Gitea Actions 质量与发布流程分别位于 `.gitea/workflows/quality.yml` 和 `.gitea/workflows/release.yml`。质量流程在 Linux、macOS arm64 原生 Runner 上执行测试、构建和严格诊断；Windows amd64 由 Linux 容器交叉编译，验证 Windows 条件编译和可执行文件产出。Linux 额外执行 Staticcheck、Govulncheck、ShellCheck 和默认跳过外部系统的集成测试。

发布流程在 Linux、macOS arm64 原生 Runner 上调用 `make release-one`，Windows amd64 则由 Linux 容器交叉编译；所有平台都会在上传前调用 `make verify-release-one` 校验随包 `ru`、`trash`、PostgreSQL 客户端、配置、manifest 和 SHA-256。各平台将已校验附件直接上传到 GitHub 仓库 `adddaao/utils-cli-releases` 的同一个草稿 Release，不再通过 Gitea Artifact 服务传递产物；汇总任务仅在三端都成功后校验 12 个必需附件并按标签渠道公开草稿。汇总任务只复核附件和调用 GitHub API，因此固定在原生 macOS Runner 上执行，不使用 Docker 任务容器，避免任务启动前拉取镜像失败导致 Release 一直停留在草稿。原生 macOS Runner 还需在 Runner 服务环境中提供 `node`，否则 `actions/checkout` 等 JavaScript Action 会在任务执行任何步骤前失败，见[Gitea Actions 镜像](gitea-actions-mirror.md)。

汇总任务按标签判定正式或预览渠道。正式发布设置并核验 Latest，预览发布设置 Pre-release 并保持正式 Latest 不变；普通上传和独立上传包复用相同的完整附件检查与渠道核验。

Linux 与 Windows 交叉编译容器的系统工具安装统一通过 [Nexus APT 缓存](nexus-apt-cache.md)，先调用 `scripts/configure-ci-apt.sh`，再更新索引和安装工具。APT 直连 `http://192.168.1.108:8086/repository`，保留 Ubuntu 签名校验，只使用本项目的 Ubuntu 软件源，不访问镜像附带的第三方源。APT 独立存储设有 2000 MB 告警阈值和闲置清理；该阈值不是硬容量上限。

Go 模块使用内网 `GOPROXY`，校验和服务等外网访问继续经过 Runner 的 HTTP 代理，并关闭 `actions/setup-go` 缓存：该缓存服务在任务容器网络中不可达时会长时间超时。PostgreSQL 下载默认明确经过本地代理 `http://192.168.1.113:22335`，连接失败重试后改用 PostgreSQL 官方归档站；两个来源均须通过同一 SHA-256 校验。`rx/trash` 的下载仍通过 `http://192.168.1.108:3000` 访问内网 Gitea；发布附件则通过 GitHub API 上传，因此发布工作流不依赖 Gitea Artifact 服务或 `actions/upload-artifact`、`actions/download-artifact` 的内网镜像。

发布流程仅在推送匹配 `v*` 的 Git 标签时触发；普通分支提交、拉取请求和手动执行均不会启动发布或上传 GitHub Release。

发布用的 `ru` 会统一以 `CGO_ENABLED=0` 编译，不依赖构建 Runner 的 glibc。这样 Linux amd64/arm64 包可在较旧的发行版上启动，不会因 Runner 使用较新的 glibc 而要求目标机器提供 `GLIBC_2.32`、`GLIBC_2.34` 等版本。

macOS Runner 使用 BSD tar 打包时会显式排除扩展属性和 macOS 元数据，避免 Linux 解压时出现 `LIBARCHIVE.xattr.com.apple.provenance` 提示。

发布工作流固定从内网 `rx/trash` 的最新 Release 解析平台附件。任务容器使用 `http://192.168.1.108:3000`，避免其无法解析 `gitea.nas`；下载优先使用 `TRASH_DOWNLOAD_TOKEN`，未配置时复用必填的 `RELEASE_TOKEN`。令牌不会写入命令输出或产物。

每个平台构建前都会验证 `rx/trash` 最新 Release 可读。令牌缺失或没有该私有仓库读取权限时，会在编译前直接失败，不会构建完成后才报下载错误。

Linux 发布与 Windows 交叉发布任务会预先安装 `trash-cli`，为构建锁释放、暂存目录和历史产物回收提供宿主可执行的 `trash`。随包下载的 `trash` 属于目标平台产物，不能替代宿主工具，尤其不能在 Linux 容器中执行 Windows 程序。

各平台直接上传至同一 GitHub 草稿 Release；同一标签重跑时会优先比较远端同名附件的 SHA-256 摘要，GitHub 未返回摘要时才回退比较文件大小。摘要或大小不一致时会覆盖上传，避免同样大小的旧校验文件被误判为最新。只有 Linux、macOS、Windows 三个任务都成功后，汇总任务确认 12 个必需附件齐全，才会将草稿标记为正式发布。汇总任务在原生 macOS Runner 上执行，单次运行失败会间隔 10 秒重试，最多 3 次；仍失败时可用同一标签重跑整个发布流程，已完整上传的附件会被跳过，汇总任务重新核验后公开草稿，不会重复上传或覆盖已公开版本。

## 本地构建与版本包清理

`make build-linux ARCH=amd64`、`make build-mac`、`make build-windows` 将程序和运行依赖统一放入带版本号的文件夹，平台/架构输出目录同级只保留以下三项：

- Linux/macOS：`build/release/<os>/<arch>/ru-<版本>-<os>-<arch>.tar.gz`。
- Windows：`build/release/windows/amd64/ru-<版本>-windows-amd64.zip`。
- 每个包附带同名 `.sha256`，同级生成 `ru-<版本>-<os>-<arch>/` 文件夹，包含 `ru`、`trash`、`bin/`、`lib/`、配置、清单和空日志目录；文件夹与压缩包内容一致，可直接整体复制。

版本默认取 Makefile 当前 Git 标签，可用 `VERSION=v0.0.0` 显式指定。`ARCH` 显式传入时用于对应平台构建，仍兼容 `BUILD_LINUX_ARCH` 等平台专用变量。包内集中包含程序、trash、默认配置、PostgreSQL 客户端及依赖、清单与空日志目录；历史包、运行日志和其他本地文件不收入新包。跳过可选依赖的构建只打包实际准备的依赖。

新包和摘要完整生成且压缩包可读后，构建脚本才逐个调用 `trash`，回收当前平台/架构输出目录里的历史版本可执行文件、旧压缩包、摘要及带有打包清单的旧版本文件夹。同版本重打也先回收同名旧包，避免 ZIP 追加残留条目。构建在 `build/staging/<os>/<arch>/ru-<版本>-<os>-<arch>/` 中准备程序和依赖，成功发布后回收暂存目录；编译或依赖准备失败时保留上一份完整版本。旧布局中平铺的 `ru`、`trash`、`bin/`、`lib/`、配置、日志和清单在新版本成功发布后逐个移入废纸篓。`make run`、`make run-cli`、`make install` 统一从版本文件夹读取程序和依赖。其他平台/架构和非打包文件继续保留。同名目录缺少打包清单时停止覆盖。清理限定于本地输出目录，不操作已上传的 Release；打包失败不提前清理旧包，回收失败则停止并报告，已回收内容可从废纸篓恢复。

同一个 `build/` 输出目录只允许一个构建写入：`make build-linux`、`make build-mac`、`make build-windows`、`make release`、`make release-one` 都会先获取 `build/.build-lock`，同时启动时后来者等待，超过等待上限（默认 1800 秒，可用 `BUILD_LOCK_TIMEOUT` 覆盖）仍未拿到锁则失败，避免两个构建互相回收对方的暂存目录和发布目录。构建成功或失败后释放锁；进程异常退出留下的锁由下一次构建按“同主机且 pid 已不存在”自动回收，锁目录同样通过 `trash` 回收。构建成功后会打印产物指纹，包括压缩包文件名、`sha256`、修改时间和大小，以及可执行文件修改时间，可用来核对当前看到的是本次构建产物而不是旧副本。

`make release` 和 `make release-one` 共用以上打包、旧产物回收与构建锁规则。发布编译文件放在本次临时目录的 `binaries/<os>/<arch>/ru[.exe]`，与 `ru-<版本>-<os>-<arch>/` 打包目录分开，避免 Unix 无扩展名程序和包根目录同名导致 `mkdir: File exists`。

可运行 `make test-build-packaging` 验证同级仅三项输出、旧平铺产物迁移、版本清理、暂存隔离、目录保护、失败保留、构建锁串行化与失效锁回收、产物指纹、运行安装路径及架构参数。回归还会在隔离最小工程中执行四平台 `make release-one`、`make verify-release-one`、全量 `make release` 与 `make verify-release`，覆盖编译到打包的完整入口和同版本重打；Go 编译、下载、PostgreSQL 依赖与回收使用替身，归档和 SHA-256 校验真实执行，不替代原生 Runner 的实际编译与运行验收。

## 随包 PostgreSQL 客户端

每个正式构建和发布包都会带有 `bin/pg_dump`、`bin/psql`、`bin/pg_restore`（Windows 为 `.exe`）及运行所需依赖，并在 `POSTGRES-TOOLS.json` 中记录来源和版本。发布包的 `SHA256SUMS` 会覆盖这些文件；`make verify-release` 也会检查其存在。

默认来源固定为 PostgreSQL 18.4：Linux amd64/arm64 从 PGDG 的 Ubuntu 24.04 `postgresql-client-18` 与 `libpq5` 包提取；主站连接失败时从 PostgreSQL 官方归档站下载相同包，并在工具清单中记录实际下载地址。Windows amd64 从 EDB 的 PostgreSQL binaries ZIP 提取；macOS arm64 继续从本机 Homebrew `libpq` 提取。所有下载都先校验 SHA256，校验不一致会中止构建。

如需在内网镜像或升级版本时覆盖来源，可设置以下变量；自定义 URL 时也必须同步设置对应 SHA256：

| 名称 | 作用 |
| --- | --- |
| `POSTGRES_VERSION` / `POSTGRES_LINUX_DIST` / `POSTGRES_LINUX_BASE_URL` | Linux PGDG 默认包版本、发行版标识和基础地址。 |
| `POSTGRES_LINUX_FALLBACK_BASE_URL` | Linux 主下载源连接失败时的归档地址；默认 PostgreSQL 官方归档站，设为空可禁用回退。 |
| `POSTGRES_LINUX_CLIENT_URL` / `POSTGRES_LINUX_LIBPQ_URL` | 覆盖当前 Linux 目标的客户端包和 libpq 包下载地址。 |
| `POSTGRES_LINUX_AMD64_CLIENT_SHA256` / `POSTGRES_LINUX_ARM64_CLIENT_SHA256` | Linux 客户端包 SHA256。 |
| `POSTGRES_LINUX_AMD64_LIBPQ_SHA256` / `POSTGRES_LINUX_ARM64_LIBPQ_SHA256` | Linux libpq 包 SHA256。 |
| `POSTGRES_WINDOWS_AMD64_URL` / `POSTGRES_WINDOWS_AMD64_SHA256` | Windows binaries ZIP 地址与 SHA256。 |
| `POSTGRES_CLIENT_DIR` | macOS arm64 的本地 PostgreSQL 客户端目录；未设置时使用 Homebrew `libpq`。 |
| `POSTGRES_TOOLS_CACHE_DIR` | 覆盖客户端下载缓存目录；默认是 `build/release/tools/<os>-<arch>/postgres/`。Linux/Windows 缓存原始下载包并每次重校验 SHA256；macOS 缓存已重定位、重签名的客户端 bundle，并按本机客户端指纹刷新。 |

## 可选变量

发布工作流已固定使用任务容器可访问的 Gitea 内网地址读取 `rx/trash`，并固定将产物发布到 GitHub 仓库 `adddaao/utils-cli-releases`。下表用于本地发布或未来显式映射到工作流的覆盖；当前 Actions 仅映射 `POSTGRES_WINDOWS_AMD64_URL`，GitHub CLI 认证只从 `GH_TOKEN` Secret 读取。

| 名称 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `PROXY_URL` | 否 | runner 访问外网需要代理时填写。 | `http://<代理主机>:<端口>` |
| `NO_PROXY` | 否 | 不走代理的主机列表。 | `localhost,127.0.0.1,<你的-gitea-域名>` |
| `TRASH_DOWNLOAD_TOKEN` | 否 | 私有 `rx/trash` 读取 Release API 和下载附件时使用的专用只读 token；未配置时发布流程使用 `RELEASE_TOKEN`。 | `<访问令牌>` |
| `TRASH_CURL_INSECURE` | 否 | 内网自签证书临时验证开关；设为 `1` 或 `true` 时 curl 使用 `-k`。长期使用应安装根证书，而不是关闭 TLS 校验。 | `1` |
| `TRASH_DOWNLOAD_URL` | 否 | 通用 trash 产物下载地址；平台专用地址为空时作为兜底。 | `https://<地址>/trash-<版本>-<平台>-<架构>.tar.gz` |
| `TRASH_LINUX_AMD64_URL` | 否 | Linux amd64 的 trash 产物下载地址；只有命名规则不一致时才覆盖。 | `https://<地址>/trash-<版本>-linux-amd64.tar.gz` |
| `TRASH_LINUX_ARM64_URL` | 否 | Linux arm64 的 trash 产物下载地址；只有命名规则不一致时才覆盖。 | `https://<地址>/trash-<版本>-linux-arm64.tar.gz` |
| `TRASH_DARWIN_ARM64_URL` | 否 | macOS arm64 的 trash 产物下载地址；只有命名规则不一致时才覆盖。 | `https://<地址>/trash-<版本>-darwin-arm64.tar.gz` |
| `TRASH_WINDOWS_AMD64_URL` | 否 | Windows amd64 的 trash 产物下载地址；只有命名规则不一致时才覆盖。 | `https://<地址>/trash-<版本>-windows-amd64.zip` |
| `TRASH_SHA256` / `TRASH_DOWNLOAD_SHA256` | 否 | 通用 trash 下载产物 SHA256；平台专用 SHA256 为空时作为兜底。 | `b0dabc5b39f58d3727ab47974c0ca218d15d71d164dfee2515f9c13f3a13fc2a` |
| `TRASH_LINUX_AMD64_SHA256` | 否 | Linux amd64 trash 下载产物 SHA256，优先级高于通用 SHA256。 | `b0dabc5b39f58d3727ab47974c0ca218d15d71d164dfee2515f9c13f3a13fc2a` |
| `TRASH_LINUX_ARM64_SHA256` | 否 | Linux arm64 trash 下载产物 SHA256，优先级高于通用 SHA256。 | `b0dabc5b39f58d3727ab47974c0ca218d15d71d164dfee2515f9c13f3a13fc2a` |
| `TRASH_DARWIN_ARM64_SHA256` | 否 | macOS arm64 trash 下载产物 SHA256，优先级高于通用 SHA256。 | `b0dabc5b39f58d3727ab47974c0ca218d15d71d164dfee2515f9c13f3a13fc2a` |
| `TRASH_WINDOWS_AMD64_SHA256` | 否 | Windows amd64 trash 下载产物 SHA256，优先级高于通用 SHA256。 | `b0dabc5b39f58d3727ab47974c0ca218d15d71d164dfee2515f9c13f3a13fc2a` |

## 需要配置的密钥

在 Gitea 仓库的 `Settings -> Actions -> Secrets` 中配置：

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `GH_TOKEN` | 是 | GitHub 仓库 `adddaao/utils-cli-releases` 的访问令牌，用于创建草稿 Release、上传附件和正式发布。细粒度令牌应授予该仓库 `Contents: Read and write`。 |
| `RELEASE_TOKEN` | 是 | 用于读取私有 `rx/trash` Release 的 Gitea 访问令牌；`TRASH_DOWNLOAD_TOKEN` 未配置时作为其回退。 |
| `TRASH_DOWNLOAD_TOKEN` | 否 | `rx/trash` 是私有仓库，且希望使用专用只读令牌时填写。用于下载 trash 发布附件。 |
| `INTERNAL_ROOT_CA_B64` | 否 | 内网 HTTPS 使用自签或私有 CA 时填写，内容是根证书 PEM 文件的 base64。 |

## 生成 `GH_TOKEN`

1. 在 GitHub 创建只对 `adddaao/utils-cli-releases` 生效的细粒度个人访问令牌。
2. 在 `Repository permissions` 中将 `Contents` 设置为 `Read and write`。
3. 在 Gitea 仓库的 `Settings -> Actions -> Secrets` 中创建 `GH_TOKEN`，粘贴该令牌；不要将令牌提交到仓库或写入 `release.local.mk`。

## 生成 `RELEASE_TOKEN`

1. 打开 Gitea 个人设置。
2. 进入 `Applications -> Generate New Token`。
3. 勾选读取私有 `rx/trash` Release 所需的仓库读取权限。
4. 生成后把 token 写入仓库 Actions Secrets 的 `RELEASE_TOKEN`。

如果你的 Gitea 版本按 scope 授权，通常至少需要 `repository` 读取权限；如果是旧版本 token，则确保该用户对 `rx/trash` 有读取权限。

如果 `rx/trash` 是私有仓库，推荐让同一个 `RELEASE_TOKEN` 同时具备读取 `rx/trash` 发布附件的权限；如果做不到，再额外创建只读 token 并写入 `TRASH_DOWNLOAD_TOKEN`。

## 生成 `INTERNAL_ROOT_CA_B64`

如果 Gitea 使用内网私有 CA，先拿到根证书 PEM 文件，例如 `internal-root-ca.crt`，然后在本机执行：

```bash
base64 -i internal-root-ca.crt | tr -d '\n'
```

将输出内容写入仓库 Actions Secrets 的 `INTERNAL_ROOT_CA_B64`。

如果证书文件在 Linux runner 或服务器上，也可以使用：

```bash
base64 -w 0 internal-root-ca.crt
```

## 获取 trash 产物地址

`make release` 会把 `trash` 可执行文件一起打进发布包。当前发布目标是：

| 目标 | 变量名 |
| --- | --- |
| Linux amd64 | `TRASH_LINUX_AMD64_URL` |
| macOS arm64 | `TRASH_DARWIN_ARM64_URL` |
| Windows amd64 | `TRASH_WINDOWS_AMD64_URL` |

地址应指向可下载的 `trash` 可执行文件或包含 `trash` / `trash.exe` 的 `.tar.gz`、`.tgz`、`.zip` 归档。可同时配置 SHA256，下载后会先校验下载产物本身，校验失败会直接终止发布。配置后可以在本地用同样的变量验证：

从 Gitea 页面复制附件时，可能会得到类似 `/attachments/<uuid>` 的地址。这类地址可以下载，但不如 Release 固定地址清晰稳定。固定使用某个 `rx/trash` 版本时只需要填：

```text
TRASH_RELEASE_VERSION=v0.0.0
```

workflow 会自动生成：

```text
TRASH_LINUX_AMD64_URL=https://gitea.nas/rx/trash/releases/download/v0.0.0/trash-v0.0.0-linux-amd64.tar.gz
TRASH_LINUX_ARM64_URL=https://gitea.nas/rx/trash/releases/download/v0.0.0/trash-v0.0.0-linux-arm64.tar.gz
TRASH_DARWIN_ARM64_URL=https://gitea.nas/rx/trash/releases/download/v0.0.0/trash-v0.0.0-macos-arm64.tar.gz
TRASH_WINDOWS_AMD64_URL=https://gitea.nas/rx/trash/releases/download/v0.0.0/trash-v0.0.0-windows-amd64.zip
```

如果希望每次都使用 trash 最新 Release，配置为：

```make
TRASH_RELEASE_VERSION := latest
TRASH_REPOSITORY := rx/trash
TRASH_RELEASE_BASE_URL := https://gitea.nas/rx/trash/releases/download
# 私有仓库需要配置：
# TRASH_DOWNLOAD_TOKEN := <gitea-access-token>
# 内网自签证书临时验证才配置：
# TRASH_CURL_INSECURE := 1
```

`make release` 会先调用 `https://gitea.nas/api/v1/repos/rx/trash/releases/latest` 解析真实 tag；如果 latest API 不可用，会继续尝试 Release 列表 API 和网页 `releases/latest` 跳转，拿到真实 tag 后再下载平台产物。若你的 Gitea API 地址不是这个规则，显式配置：

```make
TRASH_RELEASE_API_URL := https://gitea.nas/api/v1/repos/rx/trash/releases/latest
```

本地只把 ru 产物发布到 GitHub Release 时，再配置：

```make
GITHUB_RELEASE_REPO := owner/utils-cli-releases
```

`make publish-github` 会递归扫描 `build/release` 下文件名中版本与 `GITHUB_RELEASE_TAG` 一致的 ru 发布包，不推源码；若已生成 `github-upload-<版本>.tar.gz`，也会上传该独立上传包及其校验文件。

```bash
TRASH_LINUX_AMD64_URL="https://example.com/trash-linux-amd64.tar.gz" \
TRASH_LINUX_AMD64_SHA256="b0dabc5b39f58d3727ab47974c0ca218d15d71d164dfee2515f9c13f3a13fc2a" \
TRASH_LINUX_ARM64_URL="https://example.com/trash-linux-arm64.tar.gz" \
TRASH_LINUX_ARM64_SHA256="b0dabc5b39f58d3727ab47974c0ca218d15d71d164dfee2515f9c13f3a13fc2a" \
TRASH_DARWIN_ARM64_URL="https://example.com/trash-darwin-arm64.tar.gz" \
TRASH_DARWIN_ARM64_SHA256="b0dabc5b39f58d3727ab47974c0ca218d15d71d164dfee2515f9c13f3a13fc2a" \
TRASH_WINDOWS_AMD64_URL="https://example.com/trash-windows-amd64.zip" \
TRASH_WINDOWS_AMD64_SHA256="b0dabc5b39f58d3727ab47974c0ca218d15d71d164dfee2515f9c13f3a13fc2a" \
make release
```

## 发布包校验

每个发布包内都会包含 `SHA256SUMS`，记录包内 `ru`、`trash` 和 `config.toml` 的 SHA256。`scripts/build.sh` 还会为最终 `.tar.gz` / `.zip` 发布包生成同名 `.sha256` 文件，例如：

```text
ru-v0.1.0-linux-amd64.tar.gz
ru-v0.1.0-linux-amd64.tar.gz.sha256
ru-v0.1.0-linux-arm64.tar.gz
ru-v0.1.0-linux-arm64.tar.gz.sha256
```

用户下载后可在发布包所在目录执行：

```bash
shasum -a 256 -c ru-v0.1.0-linux-amd64.tar.gz.sha256
```

## URL 一键安装

`make release` 还会在 `build/release/` 生成 `install.sh`、`install.ps1` 及各自的 `.sha256`。发布工作流和 `make publish-github` 会将它们作为 Release 附件上传，因此 GitHub Release 可直接使用：

```bash
curl -fsSL https://github.com/adddaao/utils-cli-releases/releases/latest/download/install.sh | sh
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; irm 'https://github.com/adddaao/utils-cli-releases/releases/latest/download/install.ps1' | iex"
```

Unix 安装器支持 Linux amd64/arm64 与 macOS arm64；PowerShell 安装器支持 Windows 10/11 amd64（系统 PowerShell 5.1），同一命令可从 CMD、PowerShell 5.1 或 PowerShell 7 发起。所有发布安装器均自动使用下载 URL 对应的 Release 标签，直接下载对应发布包及其同名 `.sha256`，验证包外 SHA-256 与包内 `SHA256SUMS`，随后调用随包 `ru install`。Windows 使用系统自带的 `Get-FileHash`，不要求安装 Gpg4win。

Windows 一键安装由 `powershell.exe -NoProfile -Command` 启动独立系统 PowerShell，在首次 HTTPS 下载前自动启用 TLS 1.2（3072）并执行 `irm <地址> | iex`。命令外层不包含 `$` 变量或依赖 Shell 的转义，因此 CMD 与 PowerShell 可复制同一行；不会要求修改调用者的会话配置。维护用的 `scripts/install.ps1` 保留 UTF-8 BOM；发布构建通过 `scripts/package-windows-installer.sh` 生成纯 ASCII 入口，内嵌并按 UTF-8 解码当前源码，兼容旧版 PowerShell 对无字符集响应的默认编码，不增加网络请求。生成物保留具名参数与点导入能力，摘要在生成后计算。

Linux、macOS 和 Windows 发布入口在打包时均绑定 `VERSION`：从 `/download/<标签>/install.sh` 或 `/download/<标签>/install.ps1` 获取后直接安装该标签，不再询问来源或版本，也不查询 Latest 或预览列表；`/latest/download/` 则安装当前正式 Latest 附件绑定的版本。`curl ... | sh` 与 `irm ... | iex` 不会把来源 URL 传给脚本，因此由发布流程把 URL 中的标签写入对应附件；不依赖调用者再次设置版本。Windows 版本优先级为 `-Version`、`RU_VERSION`、发布内置标签，Unix 为 `RU_VERSION`、发布内置标签。交互终端在摘要校验后仍确认替换，Windows 的 `-Interactive false` 或各平台的 `RU_INTERACTIVE=false` 可关闭确认。源码安装器和未绑定标签的维护入口仍提供渠道菜单；Windows 显式 `-Version latest` 或 Unix 设置 `RU_VERSION=latest` 时按渠道动态查询版本。

Windows 正式查询直接读取 Release API 的 `/latest`，再用同一标签下载包和摘要，不依赖网页重定向响应的 `BaseResponse`。GitHub 的 API 地址自动推导；自建来源在正式渠道下仍保留网页解析（`-Optional` 只推导 github.com），需要走 API 时显式设置 `RU_RELEASE_API_URL`，预览渠道则按 Gitea 路径自动推导自建来源的 API 地址。网页解析兼容 URI 对象和字符串，缺少有效地址时明确提示配置 API。API 返回为空、JSON 无效、草稿、预览或缺少标签时停止，不进入下载和替换阶段。

### Windows 下载连接排障

上方命令已在下载前自动启用 TLS 1.2，无需单独执行设置语句。直接运行下载后的 `install.ps1` 时，脚本也会在后续联网前启用 TLS 1.2。下载阶段失败时脚本尚未执行，仅在脚本内部设置 TLS 无法修复首次下载。

如果仍提示“基础连接已经关闭”，需要检查 GitHub 与下载重定向域名的代理、网络和系统证书；不能只凭该异常断定 TLS 是唯一原因。TLS 设置仅作用于安装进程，仍校验服务器证书。参见 [Microsoft 的 TLS 1.2 设置说明](https://learn.microsoft.com/en-us/powershell/gallery/how-to/getting-support/troubleshooting-cmdlets)。

当前构建使用 Go 1.26.10，官方运行时要求 Windows 10 或 Windows Server 2016 及以上。Windows 7/8 即使能下载脚本，也不能运行当前发布包；安装器在创建暂存目录、查询版本和下载包前明确拒绝。实现 Windows 7 支持需要独立评估工具链、依赖及随包程序，不能通过 TLS 设置或替换一条安装命令解决。完整边界见[平台支持](platform-support.md)。

安装器下载发布包或摘要失败时会提示检查网络并保留原始原因，且不会替换已安装程序。安装成功或失败后优先使用 `trash` 回收本次专用暂存目录；未找到 `trash` 或回收失败时，使用 PowerShell `Remove-Item` 按子项到目录的顺序逐项删除。只有两种方式都失败时才提示清理错误和目录路径。修改源码不会更新已发布的安装附件；需要经发布流程生成并上传新附件后，一键安装地址才会使用修复版。`make test-installers-windows` 覆盖源码与发布入口的最新标签动态下载与安装、下载中断、无 `trash` 时的清理、空响应、无效 JSON、自建来源 URI 差异、异常 Release 拒绝、渠道选择和摘要校验；本机 PowerShell 7 的模拟通过不替代 Windows PowerShell 5.1 真机安装验收。

## Unix 离线一键安装

Unix `install.sh` 也可在完全离线环境使用。将发布包与其同名 `.sha256` 放到目标机器后，直接传入发布包路径：

```bash
sh ./install.sh /path/to/ru-v0.1.0-linux-amd64.tar.gz
```

或者将 `install.sh`、`ru-v0.1.0-linux-amd64.tar.gz` 和 `ru-v0.1.0-linux-amd64.tar.gz.sha256` 放到同一目录，再运行 `sh ./install.sh`。未绑定版本的源码安装器会按当前平台匹配同级发布包；若匹配到多个包，会要求显式传入路径。发布附件已经绑定 URL 版本，不会自动使用目录中的其他离线包；使用离线包时明确传入压缩包路径。离线流程与 URL 安装一致，均校验包外 `.sha256` 及包内 `SHA256SUMS`，然后执行随包 `ru install`；因此离线安装不需要 `curl`。

Unix 安装器支持 root 与普通用户，均直接安装到当前会话用户的 `~/.local/share/ru` 与 `~/.local/bin/ru`。例如 root 在 Ubuntu 上执行时，程序文件位于 `/root/.local/share/ru`，并额外创建 `/usr/local/bin/ru` 入口以匹配 root 默认 `PATH`，安装后可直接执行 `ru`；无需创建额外用户或委托执行。普通用户执行时则使用自己的 home 目录。

Linux 服务器的交互安装完成后，脚本可选询问注册文件中转别名（默认 `xftp`，可自定义），调用安装后的稳定 ru 路径复用注册功能。服务器判定为 SSH 会话或无桌面会话，排除 WSL；非交互安装不注册。脚本区分普通用户、直接 root 与经账号 UID 核对的 sudo 启动，展示当前 `HOME` 对应的配置归属及权限/接收用户说明，不自动提升权限。注册失败不影响 ru 安装成功。完整规则见[文件中转与 Shell 别名](fileexport.md)。

安装后可在 Linux 使用 `sh ./install.sh --register-alias [别名] [ru绝对路径]` 独立注册，或运行 ru 进入文件中转别名注册界面。脚本手动模式不进入发布包下载/安装流程；非交互调用须明确指定别名，注册失败返回非零状态，交互取消不修改配置。

发布包由 macOS 构建时，打包脚本会设置 `COPYFILE_DISABLE=1` 和 `COPY_EXTENDED_ATTRIBUTES_DISABLE=1`，避免把 `LIBARCHIVE.xattr.com.apple.provenance` 等 macOS 扩展属性写入 `.tar.gz`，从而避免 Linux `tar` 的无害警告。该修复仅对重新生成的发布包生效。

校验文件与发布包同属一个 Release，能发现下载损坏或意外篡改，但不能独立防御两者被整体替换。若有更高的来源验证需求，请从已审阅、固定 commit 的源码检出运行安装器。

默认下载源为 `https://github.com/adddaao/utils-cli-releases/releases`。自建 Gitea 或其他发布仓库可设置 `RU_RELEASE_BASE_URL=<协议>://<主机[:端口]>/<所有者>/<仓库>/releases`；安装指定版本时再设置 `RU_VERSION=v0.1.0`。私有发布仓库需要让 `curl` 或 PowerShell 先具备读取附件的认证能力。

发布源地址支持 `http://` 与 `https://`、自建域名、内网 IP、`IP:端口` 与 IPv6 组合，例如 `https://gitea.corp.internal/ops/utils-cli/releases`、`http://192.168.1.10:3000/ops/utils-cli/releases`。查询预览版时安装器会按该地址自动推导 Release 列表 API：`https://github.com/<所有者>/<仓库>/releases` 推导为 `https://api.github.com/repos/<所有者>/<仓库>/releases`，其余自建主机推导为 `<协议>://<主机[:端口]>/api/v1/repos/<所有者>/<仓库>/releases`（Gitea 路径，与获取随包 `trash` 的规则一致）；其他代码托管平台（例如 GitHub Enterprise 的 `/api/v3`）仍需显式设置 `RU_RELEASE_API_URL`。`RU_RELEASE_BASE_URL` 必须停在 `/releases`，因为下载地址由脚本拼接 `<base>/download/<版本>/<附件>`；缺少协议或路径不符时安装器会直接报错并给出正确写法，不会猜测协议。完整规则见[远程地址识别与归一化](remote-address.md)。

每次新建 GitHub Release 时，`make publish-github` 与发布工作流都会通过 `scripts/release-notes.sh` 自动写入上述两条可复制命令。`GITHUB_RELEASE_NOTES` 仍可用于追加本版本的变更说明，但不会覆盖一键安装区块。

## 交互式发布与安装渠道

执行 `make updateVersion`，先选择预览发布或正式发布，最终确认一次后创建并推送标签到 origin。工作区存在未提交改动时拒绝发布。预览版默认使用下一个 patch 版本作为基数，标签格式为 `vX.Y.Z-preview.N.YYYY-MM-DD`，例如 `v0.2.5-preview.3.2026-10-06`。日期按北京时间（`Asia/Shanghai`）生成，仅供辨认发布时间；序号只按 `vX.Y.Z` 版本基数递增，跨天不重置，基数改变才从 1 开始。发布前获取标签，再用 `git ls-remote` 读取 origin 的真实标签，以该基数下已有新格式标签的最大序号加 1 分配，不复用空缺序号。本地未推送的大版本和预览序号不参与分配；本地已有目标标签则停止，不覆盖、不删除、不跳号，应核对是否需要重试此前推送。推送冲突时保留本地标签并报错，不覆盖远程标签。历史时间戳标签继续作为安装和正式发布来源，但不参与新序号计算。每次预览独立发布，不占用正式版本号。

正式发布先选择当前提交或已验证的预览标签，再选择 patch/minor/major。预览来源列表只列 origin 的预览标签，新格式按版本和序号倒序排列，历史时间戳标签列在其后；标签存在不代表构建和实际测试已完成，操作者须先验证该预览。正式标签固定预览对应的源码 SHA，工作流从该提交重新构建正式版本。正式递增仅读取 origin 的 `vX.Y.Z` 标签。

确认后重新检查分支、HEAD、暂存区、工作区、预览来源、origin 获取／推送地址与远端标签；发生变化即停止，即使切换后的分支指向相同提交也不能继续。标签脚本只推送选定提交的标签，不提交版本文件、不推送分支；Go 构建继续从 Git 标签注入版本。可用 `bash scripts/tag.sh --help` 查看用法。推送失败保留本地标签，按输出的原标签命令重试。此脚本与 Local Capture 同步的是发布检查，预览标签格式和版本写入方式各自遵循仓库约定。

| 渠道 | Release 状态 | Latest 行为 |
| --- | --- | --- |
| stable 正式版 | `draft=false`、`prerelease=false` | `make_latest=true`，核验 Latest ID |
| preview 预览版 | `draft=false`、`prerelease=true` | `make_latest=false`，只核验发布渠道 |

`GITHUB_RELEASE_CHANNEL` 默认为 `auto`，依据标签严格推断；显式 stable/preview 必须与标签一致。两种渠道都先运行测试，再构建、校验、上传草稿；汇总任务核验四个平台包及摘要、两个安装器及摘要，共 12 个必需附件后公开。任何失败都不继续公开。已公开版本不得覆盖缺失或不同附件，应创建新版本；完整重复执行允许重新核验。

GitHub 发行版列表按标签／提交时间排列，并不直接按预览序号或 `published_at` 排序。产物仓库中多个轻量标签指向同一旧提交时，`preview.11` 可能排在 `preview.8` 后面。公开前，上传脚本会创建带 UTC 时间的附注标签：新标签沿用发布仓库默认分支的提交，历史轻量标签保留原提交并使用 Release 的原始发布时间（草稿使用当前时间）。已有附注标签保持不变；写入前复核引用、写入后核验引用，失败则不继续公开。此修复不替换附件、不改变下载地址，也不把预览版设为正式 Latest。历史版本可通过同标签的 `GITHUB_RELEASE_FINALIZE=true make publish-github` 补齐标签时间。

```bash
make updateVersion                 # 推荐：交互选择渠道、来源、版本和最终确认
make release-preview               # 直接进入预览确认
make release-stable                # 直接进入正式来源与版本选择
make updateVersion TYPE=patch RELEASE_CHANNEL=stable RELEASE_SOURCE=HEAD
```

以上发布入口会推送标签并触发 Actions；`make release` 仍只生成本地产物，`make install` 与 `ru install` 仍只安装本地已构建程序。

下载安装器后执行 `sh ./install.sh`（Unix）或 `./install.ps1`（Windows），或在源码目录执行 `make install-release`。Unix 与 Windows 源码安装器的交互菜单提供最新正式版、最新预览版和指定版本；Linux、macOS 和 Windows 发布附件均按下载 URL 对应的标签直接安装并跳过来源菜单。安装器显示当前安装与目标渠道、版本和源码提交，校验包后确认替换。Unix 管道执行从 `/dev/tty` 读取菜单，不占用脚本 stdin；没有交互终端时默认安装最新正式版。`RU_INTERACTIVE=true/false` 可显式控制，Windows 对应 `-Interactive true/false`。显式渠道、指定版本与离线包不再弹来源菜单，交互终端仍需确认。

```bash
RU_CHANNEL=preview sh ./install.sh                 # 选择预览渠道，终端中确认
RU_CHANNEL=stable RU_INTERACTIVE=false sh ./install.sh
RU_VERSION=v1.2.4-preview.1.2026-10-06 RU_INTERACTIVE=false sh ./install.sh
```

```powershell
./install.ps1 -Version latest -Channel preview
./install.ps1 -Version latest -Channel stable -Interactive false
./install.ps1 -Version v1.2.4-preview.1.2026-10-06 -Interactive false
```

正式查询使用 Latest；预览查询分页读取 Release API，排除草稿、正式版本和当前平台缺少包或摘要的预览，按公开时间选择最新版本，然后固定具体标签下载包与校验文件。没有可安装预览或 API 查询失败时明确报错，不回退到正式版。Unix 最新预览查询依赖 `jq`，正式版和指定版本不依赖它。非 GitHub 发布源使用预览查询时须设置 `RU_RELEASE_API_URL` 为 Release 列表 API 地址（不含查询参数）。显式 `RU_CHANNEL` 与版本渠道冲突时拒绝安装。显式渠道或版本不会误用安装器同目录的其他离线包。

Windows PowerShell 5.1 会将 `ConvertFrom-Json` 的数组作为单个管道对象返回；不能直接用 `@($json | ConvertFrom-Json)` 包装 Release 列表，否则整页会变成一个元素，筛选误报“没有可安装的公开预览版”，分页计数也会错误。安装器先用括号结束解析管道，再通过 `@((ConvertFrom-Json -InputObject $json))` 统一展开。PowerShell 回归同时覆盖当前运行时和旧版数组返回行为，验证空列表、单项列表、百项分页及最新预览版本改变后的动态选择。

安装始终使用 `ru` 命令并替换当前程序，用户配置保留；重新选择最新正式版即可切回正式渠道。程序回退不会自动撤销配置或数据迁移。`ru version` 输出正式版/预览版；源码 SHA 从包内已校验的 `RELEASE-MANIFEST.json` 读取，Unix 没有 jq 或历史包没有清单时显示 unknown。

发布说明中的所有单行命令均默认安装 URL 对应的本 Release 版本，不必重复传入版本或渠道；非交互示例仅需显式关闭安装确认。旧正式版附件中的安装器不会自动更新；首个新版本发布前请使用仓库当前安装器，首个预览发布后也可从其 Release 附件获取新安装器。离线上传包携带渠道、判定脚本与说明生成脚本，不携带认证令牌。

回归入口为 `make test-release-flow`，已纳入 `make test`：通过模拟网络、真实控制终端和隔离 Git 仓库验证管道菜单、渠道、分页、固定版本、确认取消、缺附件、重试失败、正式 Latest、预览来源与离线包。Unix 回归覆盖 Linux amd64/arm64 与 macOS arm64 的正式/预览 URL、Latest 附件、管道执行、真实控制终端跳过版本菜单、显式版本覆盖及其他离线包隔离。`make test-installers-windows` 使用 PowerShell 执行 JSON、ZIP、SHA-256 和交互回归，网络和程序执行为模拟；可通过 `PWSH=/path/to/pwsh` 指定运行时。Windows 本机安装路径、PATH 更新和原生程序执行仍需 Windows Runner 验证。

## 发布命令

推荐通过交互入口推送标签触发发布：

```bash
make updateVersion
```

本地只验证构建时继续使用项目约定入口：

```bash
make test
make release
```
