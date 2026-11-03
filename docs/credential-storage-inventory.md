# 凭证 / 敏感信息 存储与生成位置 全量盘点报告

- 仓库：`/Users/renx/projects/i/utils-cli`（utils-cli / 二进制 `ru`）
- 任务性质：纯只读调研盘点；报告文件是唯一写入
- 盘点基线：工作区当前代码 + 本机实际落盘文件
- 术语：`<data_dir>` = `internal/config/config.go:1428-1443` 的 `getDataDir()` 结果。优先级为 `common.data_dir` → 配置文件所在目录 → `build/debug/.ru`（debug）→ `~/.ru`。凭证根目录固定为 `<data_dir>/credentials`，每个模块一个分类目录（`internal/store/store.go:41-43` `CredentialsRoot`、`:83-104` `Namespace.Dir`/`KeyPath`/`SecretPath`）。
  本工作区实际值：`data/config.toml:92` `data_dir = './data/runtime'`，解析后绝对路径为
  `/Users/renx/projects/i/utils-cli/data/data/runtime`。

---

## 一、总表

| 凭证类型（中文名 + 字段/常量名） | 定义位置 | 生成/写入位置 | 落盘路径 | 权限与加密 | 读取/解密位置 | 删除位置 | 是否明文 | 测试 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **1. AIOps SSH 密码（`AIOpsServer.CredentialID` 指向的密文）** | `internal/config/config.go:202-210`（`AIOpsServer`，`CredentialID` 在 `:208`）；认证方式常量 `internal/config/aiops_credentials.go:10-14` | `internal/config/aiops_credentials.go:42-51` `saveAIOpsPasswordAt` → `store.Namespace.Put`（`internal/store/store.go:183-199`；加密 `:167-172` → `internal/securestore/secret.go:24-45`；密文原子写入 `PutToken` `:203-231`）；入口 `SaveAIOpsPassword` `:38-40`。调用方：TUI `internal/tui/modules/aiops/controller.go:1280`；配置迁移 `internal/config/migration.go:93-105` | `<data_dir>/credentials/aiops/<credential_id>.secret`（`store.Namespace.SecretPath` `store.go:98-104`）；先写 `<path>.pending.<uuid>` 再原子改名 | 文件 `0600`、目录 `0700`（`store.Namespace.EnsureDir` `store.go:107-115`；`internal/store/fs.go:13-37`）。算法 **AES-256-GCM**，随机 nonce，密文前缀 `v1:` + base64（`internal/securestore/secret.go:19`、`:24-45`） | `AIOpsPassword` `internal/config/aiops_credentials.go:54-64`（`namespace.Get` → `Decrypt`）；调用 `internal/aiops/remote.go:86-90` `password()`；使用后 `securestore.Zero`（`remote.go:63`、`:77`） | `DeleteAIOpsPassword` `internal/config/aiops_credentials.go:76-78` → `deleteAIOpsPasswordAt` `:80-86` → `store.Namespace.Delete`（`store.go:266-278`，底层 `trash.Move` `fs.go:40-42`）。调用：`controller.go:1311`（保存失败回滚）、`controller.go:1317`（换密码回收旧凭证）、`migration.go:106-118`（迁移回滚） | **加密密文**（文件内容形如 `v1:BASE64`） | `internal/config/aiops_credentials_test.go:12`、`:54`（路径穿越）；`internal/store/store_test.go:82`、`:136`；`internal/aiops/remote_test.go:61`；`internal/config/migration_test.go:60`、`:90` |
| **2. AIOps SSH 私钥文件（`AIOpsServer.KeyFile`）** | `internal/config/config.go:205` `KeyFile`；认证归一化 `aiops_credentials.go:22-37` | **不由 ru 生成或写入**；仅作为路径写入 `config.toml`（`config.go:511` `viper.Set("aiops", aiops)` / `WriteConfig`）。私钥文件本身由用户自行创建 | 私钥本体位于用户指定路径（示例 `~/.ssh/id_rsa`，`config.toml.example:129`）；`ru` 不复制、不改权限 | 无（`ru` 不创建该文件）；`ru` 只校验内容是否为合法 PEM 私钥（`internal/tui/modules/aiops/field_validation.go:16-38`），**不校验文件权限** | 使用位置 `internal/aiops/remote.go:144-145`、`:153`（拼 `ssh -i`/`scp -i`，`expandHomeForShell`） | 无（不是 `ru` 管理的凭证） | **仅路径引用**（私钥本体在 `~/.ssh`，未由 `ru` 纳管） | `internal/tui/modules/aiops/field_validation_test.go:15`；`internal/tui/modules/aiops/form_contract_test.go:78`；`internal/aiops/model_test.go:87` |
| **3. Nacos bootstrap 密码（`BootstrapConfig.Password` / 表单 `bootstrap_password` / CLI `--bootstrap-password`）** | `internal/aiops/templates.go:17-23`（`BootstrapConfig`，`Password` 在 `:22`） | `internal/aiops/templates.go:43-70` `PrepareDeployInitTemplates` → `:64` `os.WriteFile(path, []byte(RenderBootstrap(...)), 0o600)`；模板替换 `templates.go:25-41`（`:35` 替换密码占位）。CLI 入口 `internal/aiops/cmd.go:232`；TUI 表单字段 `internal/tui/modules/aiops/controller.go:1117`，提交 `controller.go:1552` | 系统临时目录 `<os.TempDir()>/ru-aiops-init-bootstrap-*/bootstrap.yaml`（`templates.go:59-65`）；上传远端后清理 | 本地临时文件 `0600`（`templates.go:64`）；**无加密** | 生成后直接交给上传流程（`internal/aiops/deploy.go:156-209`），无解密读取 | 上传完成后 `trash.Move` 移入废纸篓（`deploy.go:110-117`、`deploy.go:203-209`） | **明文**（内存 → 临时文件 → 远端服务器 `bootstrap.yaml`） | `internal/aiops/deploy_test.go` |
| **4. Docker 镜像仓库密码（`DockerRegistry.CredentialID` 指向的密文）** | `internal/config/config.go:130-137`（`DockerRegistry`，`CredentialID` 在 `:135`，`PasswordEnv` 在 `:136`） | `internal/config/docker_registry_credentials.go:17-26` `saveDockerRegistryPasswordAt` → `store.Namespace.Put`（加密 `store.go:167-172`、密文原子写入 `:203-231`）；入口 `SaveDockerRegistryPassword` `:13-15`。调用方：`internal/tui/modules/docker/docker_trusted_registry.go:30` 注入 `persistTrustedRegistryCredential`，登录成功后 `:433` 保存；失败回收 `:440`、换密码回收旧凭证 `:448` | `<data_dir>/credentials/docker-registry/<credential_id>.secret`（`store.Namespace.SecretPath` `store.go:98-104`） | 文件 `0600`、目录 `0700`（`store.Namespace.EnsureDir` `store.go:107-115`、`fs.go:13-37`）。**AES-256-GCM**，与密钥分离 | `DockerRegistryPassword` `internal/config/docker_registry_credentials.go:29-39`（`namespace.Get` → `Decrypt`）；调用 `internal/tui/modules/docker/docker_push.go:188-192` `pushRegistryPassword`；使用后 `securestore.Zero`（`docker_push.go:192`） | `DeleteDockerRegistryPassword` `internal/config/docker_registry_credentials.go:51-57` → `store.Namespace.Delete`（`store.go:259-271`）。调用：`docker_trusted_registry.go:149`（删除仓库）、`:448`（换密码回收旧凭证） | **加密密文** | `internal/config/docker_registry_credentials_test.go:11`；`internal/config/docker_registry_test.go:5`、`:19`；`internal/tui/modules/docker/docker_trusted_registry_test.go:16`、`:56`；`internal/store/store_test.go:82` |
| **5. Docker 仓库密码环境变量引用（`DockerRegistry.PasswordEnv`）** | `internal/config/config.go:136` `PasswordEnv`；注释说明 `:128-129` | 只把**变量名**写入 `config.toml`（`SaveDockerRegistries` `config.go:525-551`）。密码值由外部环境提供，`ru` 不写入 | 仅配置文件中的变量名；密码值只在进程环境（不落盘） | 无（值为环境变量） | `internal/tui/modules/docker/docker_push.go:198-205`（`:201` `os.LookupEnv`）；校验要求同时配置 username（`config.go:1195-1197`） | 无 | **环境变量引用**（配置中仅变量名，明文值在环境） | `internal/tui/modules/docker/docker_push_test.go:28`（未设置时报错）；`internal/config/docker_registry_test.go:7` |
| **6. Docker daemon 仓库登录凭据（`docker login` 语义的本地 docker config credentials）** | 无本项目结构体；请求体 `internal/docker/push.go:16-22` `ImagePushRequest.Password`（注释 `:15` 明确"不应持久化"） | 触发点 `internal/tui/modules/docker/docker_trusted_registry.go:340-343` → `docker.LoginRegistry` `internal/docker/push.go:40-48` → SDK `push.go:51-66`（`:57` `cli.RegistryLogin`）。认证值编码 `push.go:111-123` `encodedRegistryAuth`（base64 AuthConfig） | **本项目代码不写 `~/.docker/config.json`**；凭据经 Docker Socket 交给 daemon，由 daemon 自行持久化到其宿主的 docker config（Linux 通常 `/root/.docker/config.json`） | 由 Docker 守护进程决定（**待确认**：本仓库无 `DOCKER_CONFIG` / `config.json` 写入代码，已全仓检索确认） | 上传时重新编码 `push.go:79`、`:111-123`；登录成功后另存加密凭据（见第 4 行） | 本项目不删除 daemon 侧凭据；仅删除自己的加密凭据（见第 4 行） | **明文经进程内存/Socket 传给 daemon**，宿主侧 docker config 内容为 base64（非强加密，可逆） | `internal/docker/push_test.go:39`、`:57` |
| **7. PostgreSQL 连接密码（`DatabaseConnectionProfile.CredentialID` 指向的密文）** | `internal/config/config.go:167-177`（`CredentialID` 在 `:173`；兼容字段 `PasswordCiphertext` 在 `:176`，仅用于读取 v3 及更早配置） | `SaveDatabaseConnectionProfile` `internal/config/config.go:636-705` → `applyDatabaseProfilePassword` `:710-729` → `store.Namespace.Put`；配置写回 `writeConfigValues` `:855-864`（`store.ReadDocumentIfExists` + `store.WriteDocument`，不再使用 `viper.WriteConfig`） | `<data_dir>/credentials/database/<credential_id>.secret`；`[[database.profiles]]` 只保留 `credential_id`（本工作区实际 `data/config.toml:105`、`:112`）。旧版内联 `password_ciphertext` 仅作为兼容读回退，本工作区已不存在 | 密文文件 `0600`、目录 `0700`（`store.go:107-115`、`fs.go:13-37`）；`config.toml` `0600`（`store.WriteDocument`）。密文 **AES-256-GCM**，密钥独立 | `DatabaseConnectionPassword` `internal/config/config.go:587-616`（优先 `credential_id` → `namespace.Get`；回退内联 → `namespace.Decrypt`；`securestore.Zero` `:601`、`:616`）；判断是否存在 `HasDatabaseConnectionPassword` `:618-632` | 传空字符串即清除密码：`applyDatabaseProfilePassword` 把已有密文移入废纸篓并清空 `credential_id`/`password_ciphertext`（`config.go:712-720`）。密钥文件本身无删除入口 | **加密密文** | `internal/config/config_test.go:61-115`（断言配置只含 `credential_id`、不含 `password_ciphertext`，且密文落在 `credentials/database/<id>.secret`）；`internal/config/migration_test.go:143`（内联密文迁移为独立凭证） |
| **8. PostgreSQL 运行时明文密码（`PGPASSWORD`，环境变量/进程参数）** | 请求结构 `internal/app/database/dto.go:27`、`:50`、`:219`（`Password`）；SQL 模块 `dto.go:91`、`:103` | `internal/app/database/service.go:478-479`（`docker exec -e PGPASSWORD=<明文>`）、`:515-517`（本地进程 `cmd.Env`）、`:1037-1039`、`:1072-1073`；`internal/app/database/user_database_run.go:618-619`（docker 参数）、`:633-634`（本地 env） | **不落盘**；进入子进程环境变量 / docker 命令行参数 | 无（明文）；日志侧有脱敏：`service.go:1123-1136` `formatSafeCommand` / `redactCommandArgs`（`:1131-1132` 把 `PGPASSWORD=` 替成 `PGPASSWORD=******`） | 解密来源见第 7 行；`internal/tui/modules/database/database_configuration.go:248-271` `loadSavedPasswordForExecution` 按需解密 | 无（进程结束即消失）；`internal/app/database/user_database_run.go:577-590` 清理的是临时同步目录，不含密码 | **明文**（进程参数/环境） | `internal/app/database/service_test.go:29`（脱敏测试）、`:18`；`internal/app/database/user_database_test.go:925`、`:942` |
| **9. SQL 语句中的明文 `PASSWORD '<literal>'`（`PostgresStatement.SQL`）** | `internal/app/database/dto.go:119-128`（`SQL` 注释 `:122-123`：只能交给执行器，不能写日志；`DisplaySQL` `:124-125`） | 生成 `internal/app/database/user_database.go:223-226`（CREATE ROLE）、`:242-245`（ALTER ROLE）；脱敏副本 `newPostgresStatement` `user_database.go:377-388` | **不落盘到 ru 的文件**；经 `psql` **stdin** 下发（`user_database_run.go:425` `io.WriteString(stdin, session.script())`，脚本拼装 `:456-465`）。容器模式经 `docker exec -i` 标准输入 | 无（明文）；`ru.log` 只写 `DisplaySQL`（`user_database_run.go:197`、`:216`），实测已脱敏 | 执行器 `user_database_run.go:198` `runPostgresStatement(..., statement.SQL)`；`user_database.go:385` 构造 `DisplaySQL` | 无 | **明文**（内存 → psql stdin；**待确认**：远端 PostgreSQL 若开启 `log_statement=all`，明文密码会进入服务器日志，本仓库无控制手段） | `internal/app/database/user_database_test.go:192`、`:210`、`:491`、`:818`；`internal/tui/modules/database/database_user_test.go:309` |
| **10. 发布/CI 令牌（`GH_TOKEN`、`RELEASE_TOKEN`、`TRASH_DOWNLOAD_TOKEN`、`GITEA_TOKEN`）** | 本地：`release.local.mk:16`（`TRASH_DOWNLOAD_TOKEN`）；Makefile `:39`、`:62`、`:239`、`:291`；CI：`.gitea/workflows/release.yml:20-25`、`.gitea/workflows/quality.yml` | 由外部注入（GitHub/Gitea Secrets 或本地 `release.local.mk`），`ru` 运行时不生成 | `<repo>/release.local.mk`（**本机实际存在且第 16 行已赋值**）；CI 中仅存在于 Actions Secret/环境 | `release.local.mk` 为普通文件（未加权限限制），但已被 `.gitignore:29` 忽略，`git check-ignore` 确认不会提交 | `scripts/build.sh:196-198`、`:294-296`；`scripts/update-trash.sh:58-60`；`scripts/publish-gitea-release-assets.sh:39-48`；`scripts/mirror-gitea-actions.sh:65-74`、`:139`；`scripts/publish-github-release.sh:263-269` | 无 | **明文**（本地文件 + 环境变量）；CI 侧由平台加密 | `scripts/test-publish-github.sh:48`、`scripts/test-release-tag.sh`、`scripts/verify-release.sh` |
| **11. 容器 inspect 导出（含 `Config.Env`，可能内嵌密码/令牌）** | 无专属结构体；来源 `inspect.Raw` | `internal/docker/sdk.go:468-487` `ExportContainerInspect`（`os.MkdirAll(..., 0755)` `:480`，`os.WriteFile(outputPath, prettyJSON(inspect.Raw), 0644)` `:483`）；默认名 `sdk.go:478`、`internal/docker/manage.go:246`（`<容器名>_config.json`） | 当前工作目录下 `<name>_config.json`（或用户指定路径） | 目录 `0755`、文件 **`0644`（同机其他用户可读）**；**无加密** | 无（仅导出） | 无 | **明文**（完整容器配置，含环境变量列表 → 可能含 `PGPASSWORD`、DB 密码、token） | 无专项测试（**待确认**：未检索到断言该导出内容/权限的单测） |
| **12. `docker run` / compose 命令导出（`-e KEY=VALUE` 明文环境变量）** | `internal/docker/runlike.go:18-19` `RunlikeResult`（`Command`） | 生成 `internal/docker/runlike.go:176-179`（`parts = append(parts, "-e "+shellEscape(e))`）。保存动作：`internal/tui/modules/docker/docker_results.go:1645-1655` `saveRunlikeCommand`（`os.WriteFile(filename, ..., 0o644)` `:1648`）；compose 转换保存 `internal/tui/modules/docker/docker_controller.go:1584-1589`（`0o644` `:1584`） | 当前工作目录（`runlikeCommandFilename` `docker_results.go:1657+`；compose 为 `docker-run-commands.sh` / 对应文件名，`docker_controller.go:1578-1583`） | 文件 **`0644`**；**无加密** | 无 | 无 | **明文**（`docker run` 命令直接展开容器环境变量原值） | 无专项测试（**待确认**） |
| **13. 本机加密密钥文件（3 个）** | 路径函数：`store.Namespace.KeyPath`（`internal/store/store.go:88-90`）；模块命名空间 `internal/config/aiops_credentials.go:16-18`、`internal/config/docker_registry_credentials.go:9-10`、`internal/config/config.go:844-845`；兼容路径函数 `aiops_credentials.go:93-99`、`docker_registry_credentials.go:64-70` | `internal/securestore/secret.go:89-141` `loadOrCreateKey`（首次使用时生成 32 字节随机密钥，`:111` `os.OpenFile(..., 标志为 O_CREATE 与 O_EXCL, 0o600)`，`:127` 写入，`:136` 复核权限）；`Encrypt`/`Decrypt` 均会按需创建。密钥创建前 `store.Namespace.Prepare` 会先迁移历史平铺密钥（`store.go:119-125`、`:134-164`） | ① `<data_dir>/credentials/aiops/aiops.key` ② `<data_dir>/credentials/docker-registry/docker-registry.key` ③ `<data_dir>/credentials/database/database.key` | 文件 `0600`、父目录 `0700`（`secret.go:151-178` `ensurePrivateDir`/`ensurePrivateFile`，`:174-176` 拒绝组/其他可读；`store/fs.go:13-37` 同样收紧）；**密钥本身不加密**（依赖文件系统权限） | 同 `loadOrCreateKey`（`secret.go:96-121`）；`validateKey` 强制 32 字节 `:143-149` | 无删除入口（删除后旧密文不可恢复，`docs/configuration.md` 已说明）；`MigrateLegacyKey` 只搬移、不删除旧密钥 | **明文密钥但受 0600 保护** | `internal/securestore/secret_test.go:11`、`:42`（认证失败拒绝篡改）；`:38` 断言 0600；`internal/store/store_test.go:136`、`:175`（迁移保留可解密、幂等）；`internal/config/credential_layout_test.go:9`、`:62` |
| **14. Git 仓库地址内嵌凭据（`AIOpsSource.GitRepo`，待确认）** | `internal/config/config.go` `AIOpsSource`（`git_repo`，模板见 `config.toml.example:161`） | 不生成；用户可在 `git_repo` 写入 `https://user:token@host/...` | 配置文件中（若用户内嵌）；本工作区示例未内嵌 | 无 | `internal/aiops/deploy.go:285` `git clone --depth 1 <git_repo>` | 无 | **潜在明文**：`:284` 会把 `git_repo` 作为事件发出（`emit(... Message: project.Source.GitRepo)`），随后经执行视图写入 `ru.log`；`:292` 同样写入步骤文本 | **待确认**（无测试覆盖内嵌凭据场景） |

---

## 二、统计汇总

| 统计项 | 数量 | 说明 |
| --- | ---: | --- |
| 凭证/敏感信息**类别** | **14** | 见上表 |
| 其中"由 ru 加密存储"类别 | 3 | AIOps 密码、Docker 仓库密码、PG 连接密码 |
| 其中"明文落盘"类别 | 5 | 第 3、11、12、10（本地文件） + 第 9（远期落盘至服务器日志，待确认） |
| 其中"仅路径/环境变量引用"类别 | 3 | 第 2（私钥路径）、第 5（`password_env`）、第 6（daemon 侧，待确认） |
| **存储路径（去重）** | **12** | 11 个仓库内可达路径 + 1 个外部（Docker daemon 自有 config.json，待确认）。凭证部分由“3 个平铺密钥 + 2 个模块密文目录 + config.toml 内联密文”变为“3 个模块内密钥 + 3 个模块密文目录”，去重总数不变 |
| **加密密钥文件** | **3** | `<data_dir>/credentials/<模块>/<模块>.key`：`aiops.key`、`docker-registry.key`、`database.key`，均 32 字节、`0600`、目录 `0700` |
| 本工作区**实际存在**的密钥/密文文件 | **5** | `data/data/runtime/credentials/database/{database.key, 9fe40a72-….secret, 0e258445-….secret}` + `credentials/docker-registry/{docker-registry.key, 58b946f1-….secret}`（`ls`/`stat` 确认，密钥与密文均 `-rw-------`、目录 `drwx------`）。本机**没有** `credentials/aiops/` 目录，即未保存过 AIOps 密码凭证 |
| 加密算法 | 1 | AES-256-GCM + 随机 nonce + 前缀 `v1:`，认证加密，篡改解密失败（`internal/securestore/secret.go:19`、`:24-80`） |
| 凭证密文类型数 | 3 | 每个模块分类目录各一类 `.secret`：`credentials/aiops/`、`credentials/docker-registry/`、`credentials/database/`；`config.toml` 内 `password_ciphertext` 只作为 v3 及更早配置的兼容读回退 |
| `[[database.profiles]]` 实际凭证条数 | 2 | 各以 `credential_id` 指向独立密文：`data/config.toml:105`、`:112`；内联 `password_ciphertext` 条数为 0 |
| 实际 `credential_id` 条数 | 3 | `data/config.toml:105`、`:112`（database）+ `:123`（docker registry）；AIOps 服务器为 agent/密钥模式，无凭证引用 |
| 配置文件权限 | — | `config.toml` `0600`（`-rw-------`，实测）；`SaveAIOpsConfig`/`SaveDockerRegistries`/`SaveDatabaseConnectionProfile` 写后均经 `store.WriteDocument` 原子落盘并收紧为 `0600` |
| `ru.log` 权限 | — | `0600`（实测 `-rw-------`） |

---

## 三、明文 / 泄漏风险点

> 每条给出 `文件:行号` 与理由。已实测确认的标注"已确认"，无证据的标注"待确认"。

1. **`internal/app/database/service.go:479`（及 `:1073`、`user_database_run.go:619`）— 已确认**
   `PGPASSWORD=<明文密码>` 作为 `docker exec -e` 的**命令行参数**传入（`args = append(args, "-e", "PGPASSWORD="+req.Password)`），会出现在本机进程表（`ps`/`/proc/<pid>/cmdline`）中，同机其他用户可读。日志侧已脱敏（`service.go:1131-1132`），但进程参数未处理。

2. **`internal/docker/sdk.go:483` — 已确认**
   容器 inspect 导出使用 `os.WriteFile(outputPath, prettyJSON(inspect.Raw), 0644)`。`inspect.Raw` 含 `Config.Env`，容器常见 `PGPASSWORD`、数据库密码、API token 等环境变量会以**明文写入 0644 文件**。父目录 `:480` 也仅为 `0755`。

3. **`internal/tui/modules/docker/docker_results.go:1648` — 已确认**
   `saveRunlikeCommand` 以 `0o644` 写出 `result.Command`；该命令由 `internal/docker/runlike.go:176-179` 生成，逐条展开 `-e KEY=VALUE`，容器内的密码/令牌**明文进入导出文件**。

4. **`internal/tui/modules/docker/docker_controller.go:1584` — 已确认**
   compose ↔ docker run 转换结果以 `0o644` 写出（`docker-run-commands.sh` 等），内容同风险点 3。

5. **`internal/config/migration.go:264`（配合 `:251-274` `replaceConfigWithBackup`）— 已确认**
   迁移 v2→v3 时把**原配置文件**整体改名为 `<config>.bak.<timestamp>`。原文件中若存在旧版**明文 AIOps `password`**（`migration.go:176-186` 正在迁移的字段），该明文就保留在备份文件里，且**权限继承原文件**（无 Chmod）。`docs/config.md:15` 要求迁移，但未提示备份仍含明文。

6. **`internal/aiops/cmd.go:232` — 已确认**
   `--bootstrap-password` 从命令行读取 Nacos 密码，密码**明文出现在进程参数**中（同风险点 1 的机制）。

7. **`internal/tui/modules/aiops/controller.go:1117` — 已确认**
   TUI 表单字段 `bootstrap_password` 的 `Kind` 是 `"文本"`，而掩码逻辑在 `controller.go:558` 只对 `ParameterFormInputPassword` 生效（`form/parameter_form.go:129-130`）。因此 Nacos 密码在 TUI 编辑与显示时**不回显掩码**（对比 AIOps `server_password` `Kind:"密码"` `controller.go:856`、数据库密码 `database_controller.go:906` 有掩码）。

8. **`internal/aiops/templates.go:64` — 已确认**
   `bootstrap.yaml` 含明文 Nacos 密码，写入 `os.MkdirTemp` 的系统临时目录（`0600`）。虽然 `deploy.go:110-117`/`:203-209` 用 `trash.Move` 清理，但废纸篓中仍保留该明文文件，且若进程被强杀则残留于 `/tmp`。

9. **`internal/aiops/deploy.go:284`、`:292`（配合 `task_execution.go:126` → `logger.go:101`）— 已确认机制，内容待确认**
   `git_repo` 值与构建命令被 `emit` 为事件，最终经 `internal/tui/components/execution/task_execution.go:126` `writeExecutionLog`（`= logger.Info`，`:17`）写入 `<data_dir>/logs/ru.log`（`internal/config/config.go:1118-1120`）。若用户在 `git_repo` 中内嵌 `https://user:token@host`（`config.toml.example:161` 未内嵌），token 会明文落盘到 `ru.log`。**待确认**是否有实际内嵌用法。

10. **`internal/logger/logger.go:101-107` `logf` → `ru.log` — 已确认（当前无泄漏，通道有风险）**
    公共执行视图把**每一条** `AppendLog` 文本落盘（`task_execution.go:118-128`，`:126`）。当前数据库语句已用 `DisplaySQL` 脱敏：实测 `data/data/runtime/logs/ru.log:1946`、`:1948`、`:1969`、`:1970` 中 `PASSWORD` 均显示为 `'******'`。该通道本身是"通用文本落盘"，任何后续把明文拼进执行日志的代码都会泄漏到 `ru.log`。

11. **`release.local.mk:16` — 已确认**
    `TRASH_DOWNLOAD_TOKEN := <非空值>` 以明文保存于仓库根目录。虽被 `.gitignore:29` 忽略（`git check-ignore -v` 已确认），但同机任意进程可读，且文件权限未收紧（实测 `-rw-r--r--`）。`docs/release-workflow.md` 明确要求"不要写入 `release.local.mk`"，实际文件与该建议不一致。

12. **`internal/app/database/user_database_run.go:425` + `user_database.go:223-224` — 待确认**
    `CREATE/ALTER ROLE ... PASSWORD '<明文>'` 经 `psql` **stdin** 下发（不落盘到 ru 文件），但远端 PostgreSQL 若启用 `log_statement=all`/`log_min_duration_statement`，明文密码会进入**服务器端日志**。本仓库无任何开关或提示控制该外部行为。同理，`pg_dump`/`psql` 的错误输出若回显连接串也可能带密码（未检索到相关处理）。

13. **`internal/docker/sdk.go:57`（`RegistryLogin`）— 待确认（外部）**
    登录凭据经 Docker Socket 交给 daemon，daemon 会把 `auths` 写入其宿主机的 docker config（通常 `/root/.docker/config.json`，值为可逆 base64）。本仓库无清理入口，`docker_trusted_registry.go:131` 只删除 `ru` 自己的 `.secret` 文件，**不影响 daemon 侧残留**。本仓库无 `DOCKER_CONFIG` 相关代码（已全仓检索确认），实际路径取决于 daemon 环境。

14. **`internal/config/config.go:310-311`（`v.SetEnvPrefix("RU")` + `AutomaticEnv`）— 说明项**
    任意 `RU_*` 环境变量可覆盖配置键（含 `docker.registries`）。这不是泄漏点，但意味着凭据可经环境注入而不落盘，环境本身成为凭证可见面（`env`/`/proc/<pid>/environ`）。

---

## 四、配置文件模板涉及的凭证字段

| 模板 | 行号 | 字段 | 性质 |
| --- | --- | --- | --- |
| `config.toml.example` | `:42-49` | `[[docker.registries]]` 注释块：`password_env`、`credential_id` | 环境变量名 / 密文 ID 引用（无明文） |
| `config.toml.example` | `:52-53` | `[database] profiles = []` | 注释说明密码不写入配置、只以独立加密凭证保存 |
| `config.toml.example` | `:123-129` | `[[aiops.servers]]`：`auth_mode = "key"`、`key_file = "~/.ssh/id_rsa"` | SSH 私钥**路径引用** |
| `config.toml.example` | `:102-106` | `[logging] log_path = ""` | 日志落盘位置（默认 `<data_dir>/logs/ru.log`） |
| `config.development.toml.example` | `:28-29` | `data_dir = "./data/runtime"`、`cache_dir = "./data/cache"` | 决定 `credentials/` 根目录位置，以及各模块密钥 `credentials/<模块>/<模块>.key` 与密文 `credentials/<模块>/<credential_id>.secret` 的位置 |
| `config.development.toml.example` | `:35-41` | `[[docker.registries]]` 注释块：`password_env`、`credential_id` | 同上 |
| `config.development.toml.example` | `:43-44` | `[database] profiles = []` | 同上 |
| `config.development.toml.example` | `:82-88` | `[[aiops.servers]]`：`auth_mode = "key"`、`key_file = "~/.ssh/id_rsa"` | 同上 |

补充：两个模板中**均不存在** `password` / `password_ciphertext` 的示例值，符合 `internal/config/config.go:165-166` 与 `:128-129` 的约定。

---

## 五、`ru` 生成的全部落盘路径（速查）

| # | 路径 | 权限 | 加密 | 生成函数 |
| --- | --- | --- | --- | --- |
| 1 | `<data_dir>/credentials/aiops/aiops.key` | 0600 / 目录 0700 | 否（密钥本体） | `store.Namespace.MigrateLegacyKey` `store.go:134-164` + `securestore.loadOrCreateKey` `secret.go:89-141` |
| 2 | `<data_dir>/credentials/aiops/<credential_id>.secret` | 0600 / 0700 | AES-256-GCM | `saveAIOpsPasswordAt` `aiops_credentials.go:42-51` → `store.Namespace.Put` `store.go:183-199` |
| 3 | `<data_dir>/credentials/docker-registry/docker-registry.key` | 0600 / 0700 | 否（密钥本体） | 同上 |
| 4 | `<data_dir>/credentials/docker-registry/<credential_id>.secret` | 0600 / 0700 | AES-256-GCM | `saveDockerRegistryPasswordAt` `docker_registry_credentials.go:17-26` |
| 5 | `<data_dir>/credentials/database/database.key` | 0600 / 0700 | 否（密钥本体） | 同上 |
| 6 | `<data_dir>/credentials/database/<credential_id>.secret` | 0600 / 0700 | AES-256-GCM | `SaveDatabaseConnectionProfile` `config.go:636-705` → `applyDatabaseProfilePassword` `:710-729`；旧内联 `<config.toml>` `password_ciphertext` 仅兼容读（`:587-616`） |
| 7 | `<data_dir>/logs/ru.log`（+ 轮转文件） | 0600 | 否 | `logger.Init` `logger.go:23-60`；写入 `logger.go:101-107` |
| 8 | `<容器名>_config.json` | 0644 | 否 | `ExportContainerInspect` `sdk.go:468-487` |
| 9 | `runlikeCommandFilename(...)` / `docker-run-commands.sh` | 0644 | 否 | `saveRunlikeCommand` `docker_results.go:1645-1655`；`docker_controller.go:1584` |
| 10 | `<os.TempDir()>/ru-aiops-init-bootstrap-*/bootstrap.yaml` | 0600 | 否 | `PrepareDeployInitTemplates` `templates.go:59-65` |
| 11 | `<repo>/release.local.mk`（人工维护，非 `ru` 生成） | 默认（实测 0644） | 否 | 人工 |
| 12 | Docker daemon 自有 `~/.docker/config.json`（**待确认**） | daemon 决定 | 否（base64） | Docker daemon（非本仓库） |
| 13 | `<config>.bak.<timestamp>`（迁移备份，**含旧明文密码**） | 继承原文件 | 否 | `replaceConfigWithBackup` `migration.go:363-386` |

---

## 六、待确认清单

1. Docker daemon 侧 docker config credentials 的实际落盘路径与权限（本仓库无相关代码，已全仓检索 `DOCKER_CONFIG`/`config.json` 确认）。
2. 远端 PostgreSQL 是否开启 `log_statement`，会把 `user_database.go:223-224` 的明文 `PASSWORD` 写入服务器日志。
3. `git_repo` 是否在生产配置中内嵌 `user:token@` 形式凭据（决定风险点 9 是否实际成立）。
4. 风险点 11 与 12（容器 inspect 导出、runlike 导出）未检索到专项单测断言其内容/权限。
5. `data/config.toml:130-131` 存在 `[filesync]` / `[[filesync.profiles]]` 配置段，但全仓 Go 代码与模板中**均无对应结构体或读写代码**（已检索确认），疑为历史遗留字段，当前不承载凭证。

---

## 七、结论

- `ru` 自身的密文存储设计是收敛的：**3 类密码 → 3 个模块分类目录（`<data_dir>/credentials/<模块>/`）→ 3 个独立密钥文件 + 3 个独立密文文件**，统一走 `internal/store`（目录 `0700`、文件 `0600`、同目录临时文件 + 原子改名）与 `internal/securestore`（AES-256-GCM，认证加密，使用后 `Zero`），并通过 `cmd/ru/doctor.go:246+` 做权限体检。数据库密码已不再内联在 `config.toml`，只保留 `credential_id` 引用；历史平铺密钥由 `ru config migrate` 或首次访问时迁入模块目录，旧内联密文仍可兼容读取。
- 明文暴露不集中在密文存储层，而集中在**四类外围产物**：数据库 `PGPASSWORD` 进程参数、Docker 容器 inspect / `docker run` 命令导出（`0644`）、Nacos bootstrap 明文临时文件与 CLI 参数、以及迁移备份文件对旧明文的保留。
- `ru.log` 当前**未发现**明文密码（数据库语句已脱敏，实测证据在 `data/data/runtime/logs/ru.log:1946/1948/1969/1970`），但它是所有执行日志的通用落盘通道，属于需要持续约束的边界。
