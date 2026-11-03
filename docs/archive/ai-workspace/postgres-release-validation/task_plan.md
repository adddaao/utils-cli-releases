# ru-test PostgreSQL 工具实测计划

## 目标

为 macOS、Linux amd64/arm64 与 Windows amd64 发布包随包提供 PostgreSQL 客户端工具，并在 `ru-test`（Linux arm64）完成实测。

## 阶段

- [x] 确认 OrbStack 虚拟机与目标工作目录。
- [x] 核对 Linux 构建当前是否能打包客户端工具。
- [x] 实现多平台下载、校验、打包及发布包校验。
- [x] 验证 macOS 构建、Linux arm64 构建与运行时诊断。
- [x] 校验 Windows 发布目录结构、四平台发布包与校验清单。
- [x] 将 Linux 与 Windows PostgreSQL 下载包缓存到 `build/release/tools` 并验证复用。
- [x] 为 Release 校验清单引入独立签名与安装端固定公钥验证。

## 错误记录

| 现象 | 处理 |
| --- | --- |
| 直接 SSH 到 `ru-test` 在密钥交换前断开 | 已确认应通过 `orb -m ru-test` 进入。 |
| `orbctl push` 无法写入虚拟机家目录 | 目标家目录被只读挂载；已改用可写的 `/tmp`。 |
| `orbctl run -p` 未映射当前 macOS 工作目录 | 该机器未暴露 `/mnt/mac` 共享；改为寻找可访问的主机传输通道。 |
| 首次 `make test` 在 `internal/config` 失败 | 精简源码包遗漏 `data/config.toml` fixture；补传 `data/` 后重试。 |
| `make build` 在 Linux arm64 失败 | `bundle-postgres-tools.sh` 只允许 Darwin arm64，主动退出；运行时诊断也正确报告缺少 `bin/pg_dump`。 |
| Linux Debian 包数据层解压失败 | PGDG 包使用 `data.tar.xz`；已按数据层扩展名选择 tar 解压参数，兼容 xz、gzip 与 zstd。 |
| 初始清理旧打包目录时废纸篓被系统拒绝 | 脚本先尝试 `trash`；失败时原子重命名为同目录可恢复备份，绝不硬删除。 |
| PostgreSQL 客户端每次构建都会下载 | 已缓存到 `build/release/tools/<os>-<arch>/postgres`；每次命中仍重算 SHA256，失败后再下载。 |
| GPG 在安装器工作目录内导入公钥失败 | macOS 的 GPG agent Unix socket 路径过长；改为使用独立、短路径的密钥临时目录。 |
| 首个签名口令可能出现在本地调试追踪 | 该密钥未发布、未配置 CI；已改用新的独立签名密钥，旧密钥不再被安装器信任。 |
| 首次签名扫描包含历史包和工具缓存 | 已收紧为仅签署当前版本 Release 附件、离线上传包和安装器；误生成的历史/缓存签名已移入废纸篓。 |
