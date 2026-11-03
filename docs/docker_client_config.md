# Docker SDK 配置说明

## 概述

Docker 模块统一使用 Docker Engine Go SDK 访问 Docker daemon，不再通过本机 `docker` CLI 执行业务操作，也不再支持 `cli/sdk/auto` 客户端切换。

程序仍然需要可访问的 Docker daemon：本地 Docker Desktop、Linux Docker Engine、远程 TCP daemon 或 Windows 命名管道都可以。

## 命令入口

Docker 管理能力统一挂在 `ru docker` 下，原有顶层 `list`、`save`、`load`、`verify`、`service`、`prune` 入口继续保留。

常用命令：

```bash
ru docker images
ru docker containers list
ru docker df
ru docker images-size
ru docker network
ru docker logs <container>
ru docker top <container>
ru docker ip <container>
ru docker cleanup --containers --images
```

离线资源命令：

```bash
ru docker offline download --arch x86_64 --version 27.4.0 --compose --output ./docker-offline/x86_64
ru docker offline package --input ./docker-offline/x86_64 --installer script --format zip --output ./docker-offline-x86_64.zip
sudo ru docker offline install --input ./docker-offline/x86_64 --compose
```

离线下载会先检查配置文件 `[common] cache_dir` 中的缓存；缓存元数据和 SHA256 校验匹配时直接复用缓存。远端下载默认遵循 `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY` 等环境代理。

## 配置方式

### 配置文件

在项目根目录或用户主目录下创建 `config.toml`：

```toml
[docker]
path = "./images/"
keyword_delimiter = "\\"

[compress]
type = "gzip"
level = 6

concurrency = 4

[[docker.registries]]
name = "生产 Harbor"
server = "192.168.1.108:5000"
namespace = "production"
username = "robot$project+uploader"
password_env = "RU_DOCKER_REGISTRY_PROD_PASSWORD"
```

### 环境变量

```bash
# Linux/macOS
export RU_DOCKER_PATH=./images
export RU_COMPRESS_TYPE=gzip
export RU_CONCURRENCY=4

# Windows PowerShell
$env:RU_DOCKER_PATH="./images"
```

SDK 客户端会读取 Docker 标准环境变量，例如 `DOCKER_HOST`、`DOCKER_API_VERSION`、`DOCKER_TLS_VERIFY`。项目配置负责 ru 自身的导入导出目录、压缩和并发等行为。

镜像管理中的“上传到指定仓库”会列出 `docker.registries` 的所有条目。选择镜像和目标后，程序使用 Docker Engine SDK 为本地镜像添加 `server/namespace/镜像名:tag` 标签并推送。确认页提供“保留本地目标标签”选项，默认否：上传成功后删除为本次上传添加的本地目标标签，避免本机残留改名后的镜像；选择是时标签保留在本机，便于核验或重试。目标标签与本地来源镜像同名时始终不删除，否则会连带删掉本地原始镜像名；上传失败时也保留标签供排查和重试。删除标签失败不影响上传成功结论，执行信息表格的“本地标签”行显示各镜像的处理结果（删除失败会标注），执行日志按警告级别记录具体原因。来源镜像含有服务端前缀时，上传目标会去掉来源服务端前缀、保留其余镜像路径。当 `docker.registries` 为空时，目标仓库页面会提示未配置仓库，并按 `n` 直接进入新增可信任远端源表单；登录成功且该仓库是唯一目标时自动回到“确认上传”页继续上传，取消或登录失败则回到目标仓库页面，可再次按 `n` 重试。

“Docker → 诊断与维护 → 可信任远端源”默认展示当前 `docker.registries` 的表格；使用 `n` 新增、`r` 修改当前选中仓库、`d` 删除当前选中仓库。新增或修改时填写名称、服务端地址、镜像命名空间、用户名和密码，并执行登录。服务端地址接受域名、IPv4、IPv6，以及各自带端口的形式，例如 `registry.example.com`、`harbor.corp.internal:8082`、`192.168.1.108:5000`、`[2001:db8::1]:5000`；自建内网域名与单标签主机名同样支持。也接受 `http://` 或 `https://` 前缀：Docker 的仓库标识本身不含协议，因此保存时会自动去掉前缀，只保留 `主机[:端口]`；不接受路径。镜像命名空间是上传路径前缀，例如 `production` 会生成 `192.168.1.108:5000/production/镜像名:tag`；可留空。登录成功后才会新增或更新 `docker.registries` 条目；密码会加密保存到本机数据目录的独立凭据文件，配置中只保存自动生成的 `credential_id`，界面和日志均不会显示密码。删除仓库时关联的本机加密凭据会移入废纸篓。后续上传优先使用该加密凭据。完整地址规则见[远程地址识别与归一化](remote-address.md)。

`password_env` 只填写密码环境变量名，密码本身不能写入 `config.toml` 或日志。它适合非交互部署；未通过可信任远端源保存凭据时，上传会回退读取该环境变量。设置了 `username` 且未配置加密凭据或 `password_env` 时按匿名认证请求推送，适用于无需认证的仓库；受保护仓库应使用上述登录入口或同时配置二者，例如：

```bash
export RU_DOCKER_REGISTRY_PROD_PASSWORD='实际密码或机器人令牌'
```

### 配置优先级

1. 环境变量
2. 配置文件
3. 默认值

## 配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `docker.path` | string | `./images/` | 镜像导入导出目录 |
| `docker.keyword_delimiter` | string | `\\` | 模糊查询触发分隔符 |
| `docker.registries` | array | `[]` | 可选的多个上传目标；每项包含 `name`、`server`、可选 `namespace`、`username`、自动生成的 `credential_id` 或 `password_env` |
| `compress.type` | string | `gzip` | 压缩格式：none, gzip, zstd, 7z |
| `compress.level` | int | 6 | 压缩等级 |
| `concurrency` | int | 4 | 最大并发数 |

## 配置文件位置

程序按以下顺序查找配置文件：

1. `--config` 指定的路径
2. 可执行文件同级 `config.toml`
3. `~/.ru/config.toml`

## 故障排查

### SDK 连接失败

常见原因：

- Docker daemon 未运行
- `DOCKER_HOST` 指向错误
- 当前用户没有访问 Docker socket 或 Windows 命名管道的权限
- 远程 TCP daemon 的 TLS/网络配置不可达

建议检查：

```bash
# Linux/macOS
ls -l /var/run/docker.sock

# Linux
systemctl status docker
```

### 权限不足

Linux 上通常需要把当前用户加入 `docker` 组，或以具备 Docker socket 访问权限的用户运行：

```bash
sudo usermod -aG docker $USER
```

重新登录后再运行 `ru docker verify` 验证。

## 开发说明

Docker SDK 集中封装在 `internal/docker/sdk.go`。新增 Docker 能力时优先在该文件补齐 daemon API 调用，再由 `internal/docker/*.go` 中的命令或 TUI 调用现有函数。
