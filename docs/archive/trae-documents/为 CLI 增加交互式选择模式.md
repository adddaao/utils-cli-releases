## 目标
- 为 `list/save/load` 增加交互式选择，避免仅用参数输入

## 方案
- 引入 `github.com/AlecAivazis/survey/v2` 与 `golang.org/x/term` 实现 TTY 下的交互
- 新增 `--interactive/-i` 开关；在 TTY 且未提供关键参数时默认进入交互

## 代码改动
- 新增 `internal/ui/select.go`：
  - 多选镜像：`SelectImages([]docker.Image) ([]docker.Image, error)`
  - 单选压缩类型：`SelectCompress(default string) (string, error)`
  - 输入输出目录：`PromptOutput(default string) (string, error)`
  - 输入并发度：`PromptConcurrency(default int) (int, error)`
  - 选择待加载文件：`SelectArchives(paths []string) ([]string, error)`
- 修改 `cmd/dit/main.go`：
  - `list`：添加 `-i`；交互选择/过滤后打印 `docker.PrintImages`
  - `save`：添加 `-i`；交互选择镜像→压缩类型→输出目录→并发度→覆盖开关，构造 `transfer.SaveRequest` 执行
  - `load`：添加 `-i`；交互选择输入目录→扫描归档→多选文件→并发度，构造 `transfer.LoadRequest` 执行

## 兼容与默认
- 非 TTY 或已提供参数时按原逻辑运行
- 交互模式仅在 TTY 生效，保持向后兼容

## 验证
- 构建：`go build -trimpath -ldflags "-s -w" -o dit ./cmd/dit`
- 交互验证：
  - `./dit list -i`
  - `./dit save -i`
  - `./dit load -i`
- 回归测试：`go test ./...` 并验证无破坏

## 代码定位
- 入口与子命令：`cmd/dit/main.go:16-181`
- 镜像与打印：`internal/docker/list.go:12-90`