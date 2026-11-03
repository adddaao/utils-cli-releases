# 项目目标
- 用 Go 语言完整复现 DockerImageTransfer 的核心功能：批量列出/筛选/保存/加载 Docker 镜像，并支持并行与压缩。
- 支持通过配置文件与命令行参数双通道配置，CLI 友好，跨平台单文件发布（Windows/macOS/Linux，x64/arm64）。

# 技术选型
- CLI：`spf13/cobra`（命令/子命令/帮助文档），`spf13/viper`（配置文件与环境变量）
- 进程执行：使用 `os/exec` 调用本机 `docker` CLI，避免引入 Docker Engine API 认证复杂度；保留 `provider` 接口以便未来替换为官方 SDK
- 压缩：内置 `tar`/`tar.gz`（标准库 `archive/tar`、`compress/gzip`），可选 `zstd`（`github.com/klauspost/compress/zstd`）；若检测到系统存在 `7z/7zzs`，支持外部 7z 压缩
- 并行：基于 goroutine + worker pool；可配置并发度与队列大小
- 日志与输出：标准库 `log` + 结构化简洁输出；保留更人性化打印（进度、速率）扩展点

# 项目结构
```
.
├─ cmd/dit                 # 主可执行（cobra 根命令）
├─ internal/
│  ├─ config               # 配置加载/合并/校验（viper 封装）
│  ├─ docker               # docker 命令执行与输出解析（list/save/load）
│  ├─ transfer             # 保存/加载主流程（选择、并行、重试、进度）
│  ├─ compress             # 压缩策略接口与实现（tar、gzip、zstd、7z 适配器）
│  ├─ selector             # 镜像筛选（索引、repo/tag 正则、大小/时间过滤）
│  ├─ ui                   # 友好打印/表格/进度条（可插拔）
│  ├─ runner               # 通用 worker pool、限流、上下文取消
│  └─ util                 # 工具函数（路径、校验、错误包装）
├─ pkg/                    # 预留外部可复用 API（可选）
├─ testdata/               # 解析与流程测试样例数据
├─ scripts/                # 构建/交叉编译脚本（sh/ps1）
├─ docs/                   # 架构与开发文档
└─ README.md               # 快速开始与使用说明
```

# 核心功能设计
- 镜像列出：执行 `docker image ls`，按两位及以上空格分列（与原仓库一致），过滤 `<none>` 与表头；字段：`Repo`、`Tag`、`Id`、`Created`、`Size`
- 镜像选择：
  - `--all` 全部；`--filter` 正则；`--index` 支持 `1,3-6` 范围选择；`--exclude` 排除规则
  - 以配置文件默认规则作为基线，CLI 参数优先级覆盖
- 批量保存：
  - 单项：`docker save repo:tag -o <name>.tar`；根据 `--compress` 执行 `tar.gz/zstd/7z`（7z 需本机可用）
  - 并行：worker pool 控制并发，失败可重试（可配置重试次数/退避）
  - 输出命名：`{repo}_{tag}_{id_short}.tar[.gz/.zst/.7z]`，可配置模板
  - 进度打印：开始/成功/失败统计，汇总报告
- 批量加载：
  - 输入目录递归匹配压缩文件，自动解压到临时目录或通过管道加载
  - 单项：`docker load -i <path_to_tar>`；解压策略按后缀选择
  - 并行同保存，错误收敛与汇总
- 健康检查：`dit verify` 检查 `docker` 可用、7z 可用、权限与磁盘空间

# 配置文件
- 默认路径：`./dit.yaml`（支持 `json/yaml/toml`），可通过 `--config` 指定
- 字段示例：
```yaml
provider: cli
concurrency: 4
outputDir: ./images
compress:
  type: gzip          # none|gzip|zstd|7z
  level: 6            # gzip/zstd 有效
selection:
  includeRepo: ["^myorg/.*"]
  excludeRepo: ["^test/"]
  includeTag: ["^v\d+\."]
  excludeTag: ["latest"]
load:
  inputDir: ./images
  recurse: true
retries:
  count: 2
  backoffMs: 500
nameTemplate: "{{repo}}_{{tag}}_{{idShort}}"
```
- 加载流程：viper 读取 → schema 校验 → 与 CLI flags 合并（flags 覆盖配置）

# CLI 设计
- 根命令：`dit`（Docker Image Transfer 的缩写）
- 子命令：
  - `dit list [--filter --json]`
  - `dit save [--all --filter --index --output --concurrency --compress --overwrite --dry-run]`
  - `dit load [--input --pattern --recurse --concurrency --dry-run]`
  - `dit verify`
  - 全局：`--config`、`--log-level`
- 帮助文档：cobra 自动生成 + 详细 Examples 与参数说明；`dit --help`、`dit save --help`

# 代码质量
- 注释：所有导出函数与关键内部函数提供函数级注释（中文），说明用途与优化点
- 错误处理：统一错误类型包装，带上下文；命令失败捕获 `stderr` 与退出码；超时与取消支持 `context.Context`
- 测试：
  - 解析测试：`docker image ls` 假数据（不同空格、locale、表头/none 过滤）
  - 选择器测试：索引/正则/包含排除组合
  - 压缩测试：tar/gzip/zstd 内存管道测试；7z 检测分支（跳过或模拟）
  - 端到端（可选）：在 CI 中标记为 `requires-docker`

# 构建与部署
- 单可执行：`go build -trimpath -ldflags "-s -w" -o dit`
- 交叉编译：
  - Linux x64：`GOOS=linux GOARCH=amd64`
  - macOS arm64：`GOOS=darwin GOARCH=arm64`
  - Windows x64：`GOOS=windows GOARCH=amd64`
- 脚本：
  - `scripts/build.sh`、`scripts/build.ps1`：一键产出多平台二进制到 `dist/`
- 可选：`goreleaser` 配置用于发布归档

# 文档交付
- README：快速开始、安装、示例（list/save/load）、配置说明、常见问题
- `docs/config.md`：完整配置字段与示例
- `docs/architecture.md`：模块与数据流图、扩展点说明
- `docs/CONTRIBUTING.md`：开发环境、代码规范（golangci-lint）、测试与提交指南

# 扩展接口
- `Provider`：`ListImages/Save/Load`（CLI/SDK 实现可替换）
- `Compressor`：`Name() Compress() Decompress()`（tar/gzip/zstd/7z）
- `Selector`：策略组合（索引/正则/表达式）
- `ProgressSink`：打印/记录/上报可插拔

# 验证策略
- 本地：Windows 与 macOS 环境分别跑 `list/save/load` 小样例，确认并行与压缩有效
- 回归：解析与选择器单测覆盖关键分支；对外命令失败与超时路径覆盖

# 里程碑
1. 基础骨架与 `list`/解析/配置加载
2. `save` 并行与 `tar.gz` 压缩；进度与错误收敛
3. `load` 并行与解压；目录与模式匹配
4. 文档与示例、跨平台构建脚本、完善单测
5. 可选 7z 与 zstd 适配器，`verify` 健康检查