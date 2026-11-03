# AIOps 远程部署与巡检

`AIOps 部署` 是从 `Example/aiops-cli` 中提取理念和交互流程后迁移来的 TUI 模块。迁移目标不是复刻原模板的命令行样式，而是把“服务器 → 项目 → 来源 → 构建 → 备份 → 上传 → 部署后命令 → 健康检查”的运维流程，收敛进当前 `utils-cli` 的 TUI 表格、参数表单、执行视图和底部帮助栏体系。

SSH Agent 和密钥认证复用系统 `ssh` / `scp`；密码认证使用内置 SSH/SFTP 客户端，从独立加密凭证读取密码并强制校验 `known_hosts`。三种认证方式都不会把密码写入命令参数、环境变量或日志。

目标也可以是本机：服务器配置 `transport = "local"` 时，构建、备份、复制、部署后命令和健康检查都直接在本机执行，整条链路不建立 SSH 连接（见[本地目标](#本地目标免-ssh)）。

## TUI 入口

运行 `ru` 进入主界面后，选择 `部署 → AIOps 部署`。原有功能位于第三级，名称保持不变。同级的「简单部署」说明见 [部署模块与简单部署](simple-deploy.md)。

当前 TUI 按部署优先级拆成：

| 视图 | 交互目的 | 展示方式 |
|---|---|---|
| 配置检查 | 检查 `[aiops]` 是否足够支撑部署 | 公共表格 |
| 单实例部署 | 配置服务器、项目、来源、产物、远程路径、部署后命令 | 公共参数表单 + 执行视图 |
| 远程初始化 | 生成或上传 `start.sh`、`bootstrap.yaml` 和 jar | 公共参数表单 + 执行视图 |
| 批量部署 | 同一服务器上同名项目多实例部署 | 公共多选弹框 + 执行视图 |
| 状态查看 | 采集主机名、系统、负载、内存、磁盘和网络摘要（仅 SSH 目标） | 加载弹框 + 只读表格 |
| 状态巡检 | 采集进程、端口、关键服务和最近错误日志（仅 SSH 目标） | 加载弹框 + 只读表格 |
| 服务器 | 新增/编辑服务器（SSH 或本机目标）与认证 | 公共表格 + 参数表单 |
| 项目 | 新增/编辑服务器上的项目实例与合并关系 | 公共表格 + 参数表单 |
| 部署拓扑 | 辅助查看服务器、项目、路径、部署后命令关系 | 公共表格 |

TUI 内所有操作说明来自底部帮助栏；内容区只展示结构化数据和表单，不再放原模板里的大段命令行提示。

## 配置模型

AIOps 配置使用双层模型：

- `[[aiops.servers]]` 定义服务器。
- `[[aiops.servers.projects]]` 定义某台服务器上的部署实例，主要放远程路径、说明和健康检查覆盖项。
- `[[aiops.projects]]` 定义跨服务器复用的项目公共信息，例如项目类型、源码路径、Git 地址、构建命令和部署后命令。

服务器项目实例会按 `name` 合并全局项目配置；服务器级配置优先，`post_deploy` 和 `transfer_cmd` 同样按“实例优先、全局回落”合并。

```toml
[aiops]

[[aiops.servers]]
name = "生产服务器"
transport = "ssh"                # 可选，默认 ssh；local 表示本机目标
host = "192.168.1.100"
port = 22
username = "root"
auth_mode = "key"
key_file = "~/.ssh/id_rsa"

[[aiops.servers.projects]]
name = "api"
remote_path = "/opt/apps/api"
description = "商城后端 API"

[aiops.servers.projects.health_check]
enabled = true
endpoint = "http://localhost:8080/actuator/health"
interval = 5
timeout = 300
expected_status = 200

[[aiops.projects]]
name = "api"
type = "backend"
post_deploy = "bash start.sh restart"

[aiops.projects.source]
local_path = "./target"
git_repo = "https://git.example.com/api.git"

[aiops.projects.build]
build_cmd = "mvn clean package -DskipTests"
output_dir = "target"
```

`auth_mode` 支持 `agent`、`key` 和 `password`。Agent/密钥模式复用系统 `ssh`、`scp`；密码模式使用内置 SSH/SFTP 客户端，强制校验 `~/.ssh/known_hosts`。密码不会出现在 TOML、命令参数、环境变量、日志或错误文本中，而是通过 `credential_id` 引用 `<data_dir>/credentials/aiops/<credential_id>.secret` 独立加密凭证，密钥为同目录的 `aiops.key`；历史版本把密钥平铺在凭证根目录 `<data_dir>/credentials/<模块>.key`（AIOps 即根目录下的 `aiops.key`），该文件会由 `ru config migrate` 或首次访问时自动迁入模块目录，迁移只搬移密钥、不改动密文。编辑已有服务器时密码留空表示保留，TUI 另提供更新和清除动作。

Agent/密钥模式复用系统 `ssh`、`scp` 时以 `BatchMode=yes` 非交互执行。全屏界面既不能回答 OpenSSH 的确认提示，也不允许子进程直接读写终端：主机密钥确认和口令提示一旦落到终端上，会覆盖帧内容并触发滚动、破坏差量渲染。因此首次连接一台新主机必须先在普通终端确认指纹（`ssh -p <端口> <用户>@<主机>`），或核对后把公钥追加到 `~/.ssh/known_hosts`（`ssh-keyscan -p <端口> <主机> >> ~/.ssh/known_hosts`）。主机密钥未知或与记录不一致时，状态查看、巡检和部署会立即失败，错误文本除 `SSH 主机密钥校验失败` 外还会附带上述处理建议。

`host` 支持域名、IPv4、IPv6（含作用域地址）、自建内网域名与单标签主机名，也接受 `http://`、`https://` 或 `ssh://` 前缀和方括号写法（前缀与方括号会被剥离后再连接），例如 `harbor.corp.internal`、`https://harbor.corp.internal`、`[2001:db8::1]`、`fe80::1%eth0`。主机里内嵌的端口优先于 `port` 字段，两者都没有时使用 `22`；ssh/scp 命令的 `-p`/`-P` 使用同一端口，IPv6 在 scp 目标中会自动补方括号。完整地址规则见[远程地址识别与归一化](remote-address.md)。

## 本地目标（免 SSH）

服务器配置 `transport = "local"` 时，这是一个本机执行目标：项目配置、单实例部署、批量部署和远程初始化都复用同一套表单和执行视图，但具体动作改为本机 `sh -c`、文件复制和 HTTP 健康检查，不建立 SSH 连接，也不需要 `host`、`username`、认证方式、`known_hosts` 或密码凭证。

```toml
[[aiops.servers]]
name = "本机"
transport = "local"

[[aiops.servers.projects]]
name = "api"
remote_path = "/Users/me/apps/api"   # 本机目标目录，建议使用绝对路径

[[aiops.projects]]
name = "api"
type = "backend"
post_deploy = "bash start.sh restart"

[aiops.projects.source]
local_path = "/Users/me/work/api"    # 本地源码目录，原地构建

[aiops.projects.build]
build_cmd = "mvn clean package -DskipTests"
output_dir = "target/api.jar"
```

- **原地构建**：打开“执行构建”时在 `source.local_path`（未配置时退回本次“本地来源”）里执行 `install_cmd`、`build_cmd`，再按 `build.output_dir` 取产物，不再创建临时克隆目录；`来源 = git` 仍会先浅克隆到临时目录，再在本机构建和复制。
- **备份**：使用 `cp` 复制旧版本，`frontend` 备份 `<目标目录>/dist`，`backend`/`jar` 备份 `<目标目录>/*.jar`，其他类型备份整个目标目录；失败不回滚，备份保留。
- **自定义搬运**：项目的 `transfer_cmd`（实例可覆盖全局）可以替代内置复制，命令在目标目录执行，可读取 `RU_DEPLOY_SOURCE`、`RU_DEPLOY_TARGET`、`RU_DEPLOY_PROJECT` 环境变量；SSH 目标会忽略该字段并继续使用内置上传。
- **健康检查**：本机用 HTTP 轮询 `health_check.endpoint`，默认 5 秒间隔、300 秒超时、期望 200。
- **限制**：本地目标仅支持 macOS/Linux（依赖 POSIX `sh`、`cp`、`ls`），Windows 上会直接拒绝；状态查看和状态巡检仍只面向 SSH 目标，本地服务器不会出现在候选列表里。
- CLI 同样可用：`ru aiops deploy --server 本机 --project api --build`。
- 开发配置模板 `config.development.toml.example` 与开发默认配置自带一台 `本机` 目标（含示例项目），可直接在 TUI 里选择；正式模板只保留注释示例，不会给所有用户自动增加本地服务器。

## CLI 查看

```bash
ru aiops check-config
ru aiops servers
ru aiops projects
ru aiops projects --server 生产服务器
ru aiops projects --name api
ru aiops topology
```

`check-config`、`servers`、`projects` 和 `topology` 只读取本地配置，不连接远程服务器。CLI 入口主要用于脚本化和调试，日常交互优先使用 TUI。

## 状态与巡检

```bash
ru aiops status --server 生产服务器
ru aiops status --all
ru aiops inspect --server 生产服务器
ru aiops inspect --server 生产服务器,测试服务器
ru aiops inspect --all
```

`status` 会采集主机名、系统、负载、内存、磁盘和网络摘要。`inspect` 会进一步采集基础信息、CPU/内存 TOP 进程、监听端口、关键服务和最近错误日志。

## CLI 单实例部署

指定本地产物直接部署：

```bash
ru aiops deploy \
  --server 生产服务器 \
  --project api \
  --path ./target/api.jar \
  --remote /opt/apps/api \
  --post-cmd "bash start.sh restart"
```

从本地目录选择产物部署。目录会按项目类型过滤：`frontend` 只选择 `dist`，`backend` / `jar` 只选择 `*.jar`；如果传入 `--select`，会先暂存选中文件再上传，暂存目录在流程结束后移入废纸篓。

```bash
ru aiops deploy \
  --server 生产服务器 \
  --project api \
  --local-path ./target \
  --select api.jar
```

从 Git 拉取并构建后部署：

```bash
ru aiops deploy --server 生产服务器 --project api --source git --build
```

执行流程：

1. 解析服务器和项目配置。
2. 如指定 `--source git`，浅克隆项目仓库到临时目录。
3. 如指定 `--build`，在项目目录执行 `install_cmd` 和 `build_cmd`。
4. 根据项目类型备份远程旧版本：前端备份 `dist`，后端/JAR 备份 `*.jar`，其他类型备份整个目录。
5. 创建远程目录并通过 `scp` 上传产物。
6. 执行部署后命令。
7. 如果启用健康检查，通过远程 `curl` 轮询期望 HTTP 状态。
8. Git 临时克隆目录会通过废纸篓语义清理。

## CLI 远程初始化

`deploy-init` 用于初始化远程 Java 服务目录，上传启动脚本、Spring 配置和 jar：

```bash
ru aiops deploy-init \
  --server 生产服务器 \
  --project api \
  --remote /opt/apps/api \
  --deploy-start \
  --deploy-bootstrap \
  --jar ./target/api.jar \
  --bootstrap-app api-service \
  --bootstrap-nacos 127.0.0.1:8848 \
  --bootstrap-namespace production \
  --post-cmd "bash start.sh restart"
```

`--deploy-start` 和 `--deploy-bootstrap` 会使用内置模板生成文件；如果传入 `--start-script` 或 `--bootstrap`，则上传指定文件。`--jar` 上传本地 jar 文件。

## CLI 多实例部署

同一台服务器上如果存在多个同名项目实例，可以一次部署到所有实例：

```bash
ru aiops multi-deploy \
  --server 生产服务器 \
  --project api \
  --local-path ./target \
  --select api.jar \
  --post-cmd "bash start.sh restart"
```

## 边界

- AIOps 主交互在 TUI 中表达，CLI 作为脚本化入口复用同一服务能力。
- 本地临时目录清理必须走废纸篓语义；不要在脚本或扩展中绕过 `trash`。
- 远程备份使用目标服务器上的 `cp` 命令，不会删除远程文件。
