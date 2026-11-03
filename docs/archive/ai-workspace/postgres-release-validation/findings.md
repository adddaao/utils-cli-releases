# 测试发现

- `ru-test` 是正在运行的 OrbStack Ubuntu arm64 虚拟机，IP 为 `192.168.139.211`。
- 虚拟机工作目录为 `/home/renx/utils-cli`，具有 Docker，系统未安装 `psql`、`pg_dump` 或 `ru`。
- 该目录不是 Git 工作树，包含 macOS 资源叉副本（`._*`）；需要以当前挂载源码和实际构建结果为准。
- `ru-test` 的 `/home/renx/utils-cli` 是旧副本，未包含本次新增的 `scripts/bundle-postgres-tools.sh`；macOS 当前工作目录也未作为共享目录挂载到虚拟机。
- 虚拟机的 `/tmp` 可写；`orbctl push` 写入家目录失败，且 `orbctl run -p` 无法解析当前 macOS 工作目录，因此需要使用网络或其他显式传输通道同步精简源码包。
- 隔离工作树初始化 Git 后，Linux 的质量守卫完整通过。首次 `make test` 仅因打包时遗漏 `data/config.toml` 失败；其他测试包均通过。
- 补齐 `data/` 后，Linux arm64 上的完整 `make test` 通过。
- Linux arm64 的 `make build` 先成功生成 `build/release/linux/arm64/ru`，随后被打包脚本拒绝：该脚本目前仅支持 Darwin arm64。`ru doctor --json` 如实报告发布目录缺少 `bin/pg_dump`，因此不能进入真实 PostgreSQL 导出、导入与容器失败回退测试。
- 修复后：macOS arm64 `make build` 与 `make run ARGS='doctor --json'` 通过，随包工具均为 PostgreSQL 18.4；`ru-test` 的 Linux arm64 `make test`、`make build`、`pg_dump --version`、`psql --version` 和 `ru doctor --json` 均通过。
- Windows amd64 交叉构建产物包含 x86-64 的 `pg_dump.exe`、`psql.exe` 和 29 个同目录 DLL。完整 `make release` 生成四个平台包，`make verify-release` 全部通过。
- Linux 与 Windows PostgreSQL 下载包现在缓存为 `build/release/tools/<os>-<arch>/postgres/` 下的原始包；Linux arm64 和 Windows amd64 的第二次构建均确认命中缓存且 SHA256 仍匹配。完整发布仅首次下载 Linux amd64 包，其余已缓存工具均复用。
- macOS arm64 现在缓存已重定位、重签名的客户端 bundle 到 `build/release/tools/darwin-arm64/postgres/bundle/`，其中包括 `pg_dump`、`psql`、动态库、工具元数据和来源指纹；连续构建确认命中该缓存，`ru doctor --json` 仍为 OK。
- 当前 URL 安装器从同一 Release 下载发布包及其同名 `.sha256`，并只验证 SHA-256；包内 `SHA256SUMS` 同样随包提供。仓库未实现 GPG、cosign/Sigstore 或内置公钥验证，因此无法抵御“附件与校验和一起被替换”。
- 本机存在 `gpg` 与 `openssl`，但没有现有的 GPG 私钥；发布签名应使用专用私钥并仅以 CI Secret 提供，公钥可固定在仓库和安装器中。
- 已生成新的专用 OpenPGP 发布密钥；固定指纹为 `A07FC8908899DE6D95B253B1096AF701E421AEB5`，公钥仅存于 `keys/release-signing-public.asc` 与两个安装器。私钥留在本机 GPG 密钥环，口令仅保存于 macOS 钥匙串；CI 需要配置 `RELEASE_SIGNING_KEY` 与 `RELEASE_SIGNING_PASSPHRASE`。
- `make release`、`make release-one` 与 `make release-installers` 会生成 `.sha256.asc`；Gitea/GitHub 上传筛选和 Gitea 发布前附件检查均要求这些签名文件。`make verify-release` 会先验证固定公钥签名再进行现有哈希、内容清单和运行时检查。
