# GitHub 产物发布闭环

本文档说明“源码留在本地或 Gitea，只把 ru 发布产物上传到 GitHub Release”的推荐流程。

## 流程总览

1. `trash` 仓库在自建 Gitea 发布版本，Release 附件包含各平台 `trash` 包和 `SHA256SUMS`。
2. `utils-cli` 执行 `make release`，从 Gitea 下载对应平台的 `trash`，校验 SHA256 后打进 ru 发布包。
3. `utils-cli` 执行 `make verify-release`，校验发布包结构、包外 SHA256、包内 `SHA256SUMS` 和 `RELEASE-MANIFEST.json`。
4. `utils-cli` 执行 `make publish-github`，递归上传 `build/release` 下当前版本的 `.tar.gz`、`.zip` 和 `.sha256`，不推送源码。

渠道由标签自动推断：`vX.Y.Z` 为正式版，`vX.Y.Z-preview.N.YYYY-MM-DD` 为预览版（版本基数内序号连续递增，日期按北京时间生成，跨天不重置序号；仍识别历史时间戳标签）。正式发布设置并核验 Latest；预览发布设置并核验 Pre-release，不改变正式 Latest。新 Release 先创建草稿，全部 12 个必需附件齐全后公开。已公开版本不覆盖不同附件。`GITHUB_RELEASE_DRAFT=true` 只上传草稿，`GITHUB_RELEASE_FINALIZE=true` 核验附件后按渠道公开。汇总公开任务在原生 macOS Runner 执行并自带失败重试；仍失败时可用同一标签重跑发布流程，附件会跳过已完整上传的文件并重新核验后公开。交互菜单、安装渠道与回归规则见[发布流程](release-workflow.md#交互式发布与安装渠道)。

公开前会为 GitHub 产物仓库准备带日期的附注标签，避免多个版本指向同一旧提交时发行版列表乱序。历史轻量标签只补充原始发布时间，保留所指提交、附件和下载地址；已有附注标签不修改。该规则也随独立上传包提供，旧上传包需要重新生成才能生效。标签创建、历史修复、失败中止和重复执行由 `make test-publish-github` 回归验证。

## 本地配置

复制模板：

```bash
cp release.local.mk.example release.local.mk
```

自建 Gitea 推荐配置：

```make
TRASH_RELEASE_VERSION := latest
TRASH_REPOSITORY := rx/trash
TRASH_RELEASE_BASE_URL := https://gitea.example.com/rx/trash/releases/download

# 私有 Gitea 仓库需要可读取 Release API 和附件的 token。
TRASH_DOWNLOAD_TOKEN := <gitea-access-token>

# 内网自签证书优先配置 CA 文件或安装根证书；临时验证才启用 insecure 开关。
# TRASH_CURL_CA_FILE := /path/to/internal-ca.crt
# TRASH_CURL_INSECURE := 1

# 只用于 GitHub Release 附件上传。
GITHUB_RELEASE_REPO := owner/utils-cli-releases
```

如果 Gitea API 地址不是默认规则，显式配置：

```make
TRASH_RELEASE_API_URL := https://gitea.example.com/api/v1/repos/rx/trash/releases/latest
```

## 发布命令

日常推荐执行 `make updateVersion`，交互选择预览或正式发布，确认后推送标签触发 Actions。下面的本地构建与上传命令用于手工发布，须显式指定与源码对应的 VERSION/GITHUB_RELEASE_TAG。

```bash
make test
make release
make verify-release
make publish-github
```

`make release` 会生成 Linux amd64、Linux arm64、macOS arm64 和 Windows amd64 发布包。每个包内包含：

- `ru` / `ru.exe`
- `trash` / `trash.exe`
- `config.toml`
- `SHA256SUMS`
- `RELEASE-MANIFEST.json`

## 校验语义

- 优先使用平台专用 `TRASH_*_SHA256`。
- 未配置平台 SHA 时，`make release` 会尝试下载 trash Release 中的 `SHA256SUMS`，按附件文件名自动校验。
- 最终 ru 发布包旁边会生成同名 `.sha256` 文件，包内也会包含 `SHA256SUMS`。
- `make verify-release` 会解包当前版本发布包，重新校验包外 `.sha256`、包内 `SHA256SUMS` 和 manifest 中的 trash 校验信息。

## 在独立上传服务器执行

如果构建机不能访问 GitHub，先在构建机完成 `make release` 和 `make verify-release`，再执行：

```bash
make package-github-upload
```

该命令会在 `build/release/` 生成 `github-upload-<版本>.tar.gz` 及对应 `.sha256`。压缩包内包含当前版本的发布产物、每个产物的校验文件以及上传、渠道判定和发布说明生成脚本；不会携带源码、`release.local.mk` 或任何令牌。生成时必须已配置 `GITHUB_RELEASE_REPO`，避免带出无法直接使用的空配置包。

把这两个文件复制到上传服务器后执行：

```bash
shasum -a 256 -c github-upload-<版本>.tar.gz.sha256
tar -xzf github-upload-<版本>.tar.gz
cd github-upload-<版本>
gh auth login
./publish-github-release.sh
```

上传包会预写当前的 Release 仓库、版本、渠道和标题到 `upload.env`，但绝不包含 Token；认证由上传服务器上的 `gh auth login` 管理。如需改目标仓库或版本，编辑该文件。上传服务器只需要 `gh` 和 `curl`。脚本会创建不存在的 Release，并复用 `make publish-github` 的附件大小校验、覆盖上传、重试和 GitHub Upload API 回退逻辑。脚本会忽略并清理仅由 macOS 归档扩展属性产生的 `._*` 元数据附件，不会影响正常发布产物。

离线上传按渠道执行同样的正式 Latest 或预览 Pre-release 核验。旧上传包内的脚本不会自动更新，修复后应重新生成上传包，或同步替换其中的上传、渠道判定和发布说明脚本。发布流程回归验证入口为 `make test-publish-github`。

## 注意事项

- `release.local.mk` 只保存本机发布配置，不提交。
- `TRASH_DOWNLOAD_TOKEN` 不应写入公开日志、README 或提交记录。
- `make publish-github` 会递归扫描各平台发布目录，只上传文件名中版本与 `GITHUB_RELEASE_TAG` 一致的产物，避免误传历史构建结果；若已执行 `make package-github-upload`，同版本的独立上传包及其 `.sha256` 也会作为附件上传。上传前会先比较远端同名附件的大小；已完整上传的附件会跳过，草稿缺失或不同附件才使用 `--clobber` 上传；已公开版本禁止覆盖。
- 单个附件默认等待 GitHub CLI 自行完成或报告网络错误，不会因固定时限中断仍在传输的上传。遇到 `EOF`、`unexpected EOF`、连接重置或命令返回后附件仍未完整落盘时，会先检查远端是否已收到完整附件；未收到时最多尝试 6 次，等待时间依次为 3、6、12、24、48 秒。可用 `GITHUB_UPLOAD_RETRIES`、`GITHUB_UPLOAD_RETRY_DELAY_SECONDS` 覆盖；如确实需要卡死保护，可把 `GITHUB_GH_UPLOAD_TIMEOUT_SECONDS` 设置为正整数秒数，设为 `0` 或留空则不设超时。
- 如果 GitHub CLI 上传命令返回后远端仍没有同大小附件，发布脚本会自动改用 HTTP/1.1 的 GitHub Upload API 上传，并在每次上传后再次核验大小；认证复用现有的 `gh auth login` 会话，不会输出访问令牌。
