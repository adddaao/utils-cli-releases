## 准备

* 安装 `go>=1.21`、`docker`；可选安装 `7z`

## 构建

* `go build -trimpath -ldflags "-s -w" -o dit ./cmd/dit`

## 基础校验

* `./dit --help`

* `./dit verify`

## 功能验证

* 列表：`./dit list`、`./dit list --filter '^alpine:latest' --json`

* 保存：`./dit save --all --compress gzip --output ./images --concurrency 4`

* 加载：`./dit load --input ./images --recurse --concurrency 4`

## 测试

* `go test ./...`

## 代码定位

* 根命令 `cmd/dit/main.go:16-40`

* `list` `cmd/dit/main.go:42-63`

* `verify` `cmd/dit/main.go:65-75`

* `load` `cmd/dit/main.go:77-109`

* `save` `cmd/dit/main.go:111-181`

