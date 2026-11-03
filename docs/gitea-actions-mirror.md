# Gitea Actions 内网镜像包

`scripts/mirror-gitea-actions.sh` 用于将 GitHub Action 下载为可校验的离线包，并同步到内网 Gitea。默认处理：

- `actions/checkout@v4`
- `actions/setup-go@v5`

发布流程现在直接通过 Gitea Release API 上传各平台已校验产物，不再依赖 Artifact Action；因此本清单只保留实际仍使用的 Action。

脚本不保存令牌；令牌只从执行时的 `GITEA_TOKEN` 环境变量读取。

## 1. 在可访问 GitHub 的机器上下载并打包

```bash
scripts/mirror-gitea-actions.sh download
```

产物位于 `build/gitea-actions-mirror/`：

- `gitea-actions-mirror-<UTC 时间>.tar.gz`：裸仓库、提交清单和导入脚本。
- 同名 `.sha256`：离线包 SHA-256 校验文件，使用相对文件名，可随离线包移动。

需要额外镜像 Action 时，重复传入 `--action`。指定该选项后，默认列表不会自动加入：

```bash
scripts/mirror-gitea-actions.sh download \
  --action actions/checkout@v4 \
  --action actions/setup-go@v5 \
  --action actions/cache@v4
```

## 2. 搬运并导入内网 Gitea

将 `.tar.gz` 与其 `.sha256` 一同搬到可访问内网 Gitea 的机器：

```bash
export GITEA_TOKEN='仅在当前终端有效的访问令牌'
scripts/mirror-gitea-actions.sh import \
  --archive ./gitea-actions-mirror-20260718T120000Z.tar.gz \
  --target-base https://gitea.nas \
  --target-owner actions \
  --create
```

`--create` 会通过 Gitea API 创建缺失的公开镜像仓库，供 Runner 无凭据下载 Action。若仓库已预先创建，可省略它和 `GITEA_TOKEN`，并使用机器现有 Git 凭据完成推送。

`--target-base` 必须是**执行导入的机器**能够解析并访问的地址。若 NAS 不能解析 `gitea.nas`，请使用 Gitea 的可达内网地址和端口，例如 `http://192.168.1.108:3000`；不要为此关闭 TLS 校验。

离线包保留打包机的文件属主也不会影响导入：脚本仅对自己刚解包的裸仓库临时设置 Git `safe.directory`，不会修改 NAS 的全局 Git 配置。

默认仅新增和更新上游存在的分支、标签，保留内网独有引用。只有明确需要精确镜像时才加入 `--prune`，它会删除内网仓库中上游不再存在的分支和标签。

## 3. 启用内网 Action 来源

确认 `actions/checkout` 有 `v4`、`actions/setup-go` 有 `v5` 标签后，仓库的 `quality.yml` 与 `release.yml` 显式声明来源：

```yaml
- uses: http://192.168.1.108:3000/actions/checkout@v4
- uses: http://192.168.1.108:3000/actions/setup-go@v5
```

这个地址沿用发布流程已有的内网 Gitea 入口，不依赖任务容器解析 `gitea.nas`。Action 在步骤执行前由 Runner 下载，任务里的 `HTTP_PROXY`、`HTTPS_PROXY` 和重试步骤不能修复这一阶段的失败。显式 URL 也让按 `uses` 标识缓存的 Runner 区分内网来源与旧的简写来源。

如果希望其他工作流中的简写 Action 默认使用内网镜像，可以在 Gitea `app.ini` 中设置：

```ini
[actions]
DEFAULT_ACTIONS_URL = self
```

重启 Gitea 后，简写 Action 会解析到本机 Gitea；本仓库的显式 URL 不受该默认值影响。

## 4. 克隆内网地址却请求 GitHub

若日志先显示 `git clone 'https://gitea.nas/actions/checkout'`，随后报错 `Get "https://github.com/actions/checkout/info/refs?service=git-upload-pack": EOF`，失败发生在 Action 下载阶段，尚未进入代码测试。应先检查日志给出的 Runner 缓存目录中 `.git/config` 的 `remote.origin.url`；部分旧版克隆实现会直接打开已有缓存并从其中的 `origin` 拉取，即使日志展示的是新的输入 URL。

不要仅据 `EOF` 判断内网镜像不可用。先从 Runner 所在环境验证内网仓库和标签：

```bash
git ls-remote http://192.168.1.108:3000/actions/checkout refs/tags/v4
git ls-remote http://192.168.1.108:3000/actions/setup-go refs/tags/v5
```

本仓库通过显式内网 URL 避开原简写 Action 的缓存标识。若新任务仍请求 GitHub，检查该任务实际使用的工作流提交、缓存 `origin`、Git URL 重写配置及 HTTP 重定向；只有确认具体缓存仍指向旧源时，再将该单个缓存用 `trash` 回收并重跑。不要清空全部 Runner 缓存，也不要关闭 TLS 校验。

上述检查只证明镜像入口与引用可读取；是否修复 Runner 的下载链路，仍需以新工作流实际运行的日志为准。Action 镜像不代理 `setup-go` 下载工具链，也不代理 Go 模块或发布附件。

## 5. 原生 macOS Runner 缺少 Node.js

2026-10-21 的 macOS 质量任务（task 3437）在启动 `actions/checkout@v4` 时直接失败：

```
Run Main http://192.168.1.108:3000/actions/checkout@v4
Cannot find: node in PATH
##[error]Cannot find: node in PATH
```

原生 macOS Runner（例如 macmini）不像 `catthehacker/ubuntu` 任务容器那样自带 Node.js，而 `actions/checkout`、`actions/setup-go` 都是 JavaScript Action，需要 Runner 进程的 `PATH` 中存在 `node`。失败发生在 Action 执行阶段、任何仓库步骤之前，因此工作流里的 `env`、代理配置和重试步骤都无法修复；`quality.yml` 的 `macos` 任务与 `release.yml` 的 `macos`、`publish` 任务都会受同一问题影响。

先在 Runner 主机核对实际启动环境，而不是只检查登录 Shell：

```bash
command -v node && node --version
# launchd 启动的 Runner 服务实际环境
launchctl print gui/$(id -u)/<runner-label> | grep -A5 -i environment
```

通过 nvm 安装的 Node.js 只在交互式 Shell 生效：Runner 由 launchd 启动时不会加载 `.zshrc` 或 nvm 初始化脚本，因此即使登录 Shell 中 `command -v node` 正常，Runner 服务仍然找不到 `node`。如果 `node` 只安装在 nvm 或 Homebrew 目录（Apple Silicon 为 `/opt/homebrew/bin`），则需要把对应 `bin` 目录显式加入 Runner 服务的 `PATH`（launchd plist 的 `EnvironmentVariables`），或改用系统级安装；重启 Runner 后用同一服务环境复核 `command -v node`。不要用 `actions/setup-node` 兜底：它本身也是 JavaScript Action，会在同一阶段同样失败。
