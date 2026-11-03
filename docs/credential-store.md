# 统一凭证与配置存储

`internal/store` 是本仓库唯一直接读写配置文件与凭证/密钥文件的公共模块。业务模块不再自行 `os.ReadFile` / `os.WriteFile` 配置文件，不再拼接凭证目录路径，也不得在凭证根目录下新增平铺密钥。`internal/securestore` 只提供加密原语，`internal/config` 只负责领域类型、默认值、校验与版本迁移。

本文描述目录布局、`Namespace` API 契约、原子写入与权限、迁移策略与兼容读、配置版本 v4 变更、失败与回滚行为，以及必须补充的测试。

## 一、模块职责边界

| 包 / 文件 | 职责 |
| --- | --- |
| `internal/store/store.go` | 凭证根目录、命名空间校验、`Namespace` 的密钥与密文读写 |
| `internal/store/document.go` | 配置文档的读取与原子写入（`ReadConfigFile`、`ReadDocument*`、`Write*`、`BackupDocument`） |
| `internal/store/fs.go` | 权限收紧（目录 `0700`、文件 `0600`）与废纸篓回收 |
| `internal/securestore/secret.go` | 仅加密原语：AES-256-GCM、`v1:` 前缀密文、密钥文件创建与校验 |

调用契约：

- 配置与本地状态文件读取统一走 `store.ReadConfigFile` / `store.ReadFile`（唯一读取入口），再交给 viper 组装默认值、`RU_*` 环境变量覆盖与 `Unmarshal`。
- 配置与本地状态文件写入统一走 `store.WriteDocument` / `store.WritePrivateDocument` / `store.WriteAtomic`，不再使用 `viper.WriteConfig`。
- 密文与密钥统一走 `store.Namespace`，`internal/config` 只暴露领域级函数（保存、读取、判断存在、删除）。

`internal/config` 的生产代码当前**不再有任何直接的文件读写**（`os.ReadFile` / `os.WriteFile` / `os.Rename` / `viper.WriteConfig` / `viper.ReadInConfig` 均已消除），以下路径也一并收敛到 `store`：

| 路径 | 收敛方式 |
| --- | --- |
| 首次创建默认 `config.toml` | `store.WriteAtomic`（0600、原子写） |
| `UpdateConfig` 备份与回滚 | `store.BackupDocument` / `store.RestoreDocument` |
| `MigrateConfig` 读取待迁移配置 | `store.ReadConfigFile` |
| `replaceConfigWithBackup` 迁移安装 | `store.BackupDocument` + `store.WriteAtomic` + 失败回滚 |
| 标星偏好 `favorites.json` | `store.ReadFile` / `store.WriteAtomic` |

仅剩目录创建（缓存目录、日志目录）仍直接使用 `os.MkdirAll`，它不写入任何配置文件或凭证内容。

## 二、目录布局

凭证根目录固定为 `<data_dir>/credentials`（`store.CredentialsRoot`），每个模块一个分类目录，密钥与密文同目录、模块之间互不共享密钥：

| 命名空间 | 密钥文件 | 密文文件 |
| --- | --- | --- |
| `aiops` | `<data_dir>/credentials/aiops/aiops.key` | `<data_dir>/credentials/aiops/<credential_id>.secret` |
| `docker-registry` | `<data_dir>/credentials/docker-registry/docker-registry.key` | `<data_dir>/credentials/docker-registry/<credential_id>.secret` |
| `database` | `<data_dir>/credentials/database/database.key` | `<data_dir>/credentials/database/<credential_id>.secret` |

- 目录权限 `0700`、文件权限 `0600`（Windows 跳过权限位）。
- `<credential_id>` 必须是合法 UUID；密文文件名固定为 `<credential_id>.secret`。
- `<data_dir>` 的默认值来源见 `config.GetDataDir()`：取 `common.data_dir`；为空时取配置文件所在目录；调试模式下取 `build/debug/.ru`；否则取 `~/.ru`。相对路径按配置文件所在目录解析。

历史布局把密钥平铺在 `<data_dir>/credentials/<模块>.key`，密文本来就位于 `<data_dir>/credentials/<模块>/`。新布局把密钥也移入模块分类目录，迁移细节见第五节。

## 三、`Namespace` API 契约

`store.OpenNamespace(dataDir, name)` 只做校验、不触盘；真正的准备动作由 `Prepare` 完成。命名空间名必须匹配 `^[a-z0-9][a-z0-9_-]*$`，长度不超过 32，空值、大写、路径分隔符都会报错。

| 方法 | 语义与约束 |
| --- | --- |
| `Name()` / `Dir()` / `KeyPath()` / `LegacyKeyPath()` | 返回命名空间名、分类目录、新密钥路径、历史平铺密钥路径 |
| `SecretPath(id)` | 返回 `<root>/<模块>/<id>.secret`；`id` 非 UUID 时直接报错 |
| `EnsureDir()` | 创建分类目录并收紧为 `0700` |
| `Prepare()` | `EnsureDir` + `MigrateLegacyKey`；所有加密、解密、写入动作的前置条件 |
| `MigrateLegacyKey()` | 迁移历史平铺密钥，返回本次是否真的发生迁移（见第五节） |
| `Encrypt(plaintext)` / `Decrypt(token)` | 先 `Prepare`，再调用 `securestore` 加解密；`Decrypt` 返回值由调用方 `securestore.Zero` |
| `Put(id, plaintext)` | 加密并保存密文，返回凭证 ID；`id` 为空或非法时生成新 UUID，明文为空报错 |
| `PutToken(id, token)` | 写入已是 `v1:` 格式的密文，用于迁移或密钥不变的场景，不重新加密 |
| `Token(id)` | 读取原始密文文本，不解密 |
| `Get(id)` | 读取并解密；返回值由调用方 `securestore.Zero` |
| `Has(id)` | 只判断密文文件是否存在，不读取、不解密 |
| `Delete(id)` | 把密文移入废纸篓（`trash.Move`）；文件不存在视为成功，不使用硬删除 |
| `IDs()` | 列出该命名空间下合法的 `<uuid>.secret`，用于体检与清理 |

配置文档 API：

| 函数 | 语义与约束 |
| --- | --- |
| `ReadConfigFile(path)` | 读取配置原始字节，是配置文件内容的唯一读取入口 |
| `ReadDocument(path)` / `ReadDocumentIfExists(path)` | 解析 TOML 为文档；后者在文件不存在时返回空文档且不报错 |
| `ReadDocumentInto(path, target)` | 解析 TOML 到结构体，返回 `exists` 标志；文件不存在不算错误 |
| `WriteDocument(path, document)` | 原子写入 TOML，文件 `0600`，目录不存在时按 `0755` 创建 |
| `WritePrivateDocument(path, document)` | 同上，但目录收紧为 `0700` |
| `WriteAtomic(path, content, fileMode, dirMode)` | 通用原子写入，本地状态文件统一经过它落盘 |
| `BackupDocument(path)` / `WriteDocumentWithBackup(path, document)` | 备份为 `<path>.bak.<时间戳>`；后者写入失败时回滚为备份内容 |

## 四、原子写入与权限

- 凭证密文写入：同目录临时文件 `<path>.pending.<uuid>` → 写后收紧权限 → `os.Rename` 提交。任何一步失败都不会留下半截目标文件；rename 失败时把临时文件移入废纸篓。
- 配置写入：同样使用同目录临时文件 + 原子改名；`WriteDocument` 的目录模式为 `0755`（配置可能位于共享位置），`WritePrivateDocument` 为 `0700`。
- 权限收紧由 `internal/store/fs.go` 统一实现：目录 `0700`、文件 `0600`；Windows 跳过权限位。
- 密钥文件由 `securestore.loadOrCreateKey` 创建：`32` 字节随机密钥，`os.OpenFile(..., O_CREATE|O_EXCL, 0o600)`；并发创建时读取已存在密钥；读取后强校验长度并再次确保 `0600`，若组或其他用户可读则报错。
- 加密算法固定为 AES-256-GCM + 随机 nonce，密文格式 `v1:` + base64（`RawStdEncoding`），AAD 为 `v1:`；认证加密失败即拒绝篡改。`internal/securestore/secret.go` 只提供 `Encrypt`、`Decrypt`、`Zero`，不负责目录布局。
- 权限体检：`doctor` 的 `credential-store` 检查项会遍历 `<data_dir>/credentials`，发现越权或不可读时给出修复建议。

## 五、迁移策略与兼容读

### 密钥布局迁移

历史平铺密钥 `<data_dir>/credentials/<模块>.key` 迁移到 `<data_dir>/credentials/<模块>/<模块>.key`：

- 使用 `os.Rename` 搬移密钥文件，**不改动密文**，因此已保存密码继续可解密。
- 两个触发入口：
  1. `ru config migrate` 在应用配置迁移后调用 `config.MigrateCredentialLayout`，一次性整理 `aiops`、`docker-registry`、`database` 三个模块的密钥；
  2. 每个模块首次访问凭证时由 `Namespace.Prepare()` 惰性迁移自己的密钥。
- `MigrateLegacyKey` 是幂等的：新位置已存在密钥（已迁移或本机首次即新布局）直接返回；历史密钥不存在（全新安装）直接返回；历史路径被目录占用时报错。
- 单模块失败不阻断其他模块，`MigrateCredentialLayout` 返回已迁移模块列表与聚合错误。
- **顺序约束**：迁移必须早于任何“缺密钥则新建”的加密/解密动作，否则旧密文会因为换用新密钥而永久无法解密。`Prepare` 保证所有加解密入口都先执行迁移。

### 配置版本与兼容读

配置版本当前为 4。涉及凭证的版本变更：

- v2 → v3：AIOps 服务器明文 `password` 迁移为独立加密凭证（`credential_id`），并补齐数据库档案稳定 ID。
- v3 → v4：`[[database.profiles]]` 的内联 `password_ciphertext` 转为独立密文文件 + `credential_id`，并从文档中删除 `password_ciphertext`。迁移时密文原样搬运（`Namespace.PutToken`），不重新加密，因此不依赖明文，也不会因换密钥而失效。

兼容读：

- `config.DatabaseConnectionPassword` 优先按 `credential_id` 读取 `<data_dir>/credentials/database/<credential_id>.secret`；若没有 `credential_id`，回退读取旧的内联 `password_ciphertext`，用同一把 `database` 密钥解密（密钥迁移目录后仍可解密）。
- `config.HasDatabaseConnectionPassword` 同样先判断独立密文是否存在，再回退判断内联密文是否非空。
- 旧内联密文只用于读取；该档案下次保存时由 `CredentialID` 取代并清空 `PasswordCiphertext`。执行 `ru config migrate` 会一次性把它们全部转换成独立凭证。

## 六、配置版本 v4 变更

- `[[database.profiles]]` 现在使用 `credential_id` 指向 `<data_dir>/credentials/database/<credential_id>.secret`；`password_ciphertext` 仅保留在结构体中用于读取 v3 及更早配置，新写入一律不再产生。
- viper 只负责默认值、`RU_*` 环境变量覆盖与 `Unmarshal`；配置文件监听由 `internal/config` 用 fsnotify 自行管理（`viper.WatchConfig` 在监听器创建失败时会静默 `os.Exit(1)`，不能用于发布自检这类受限环境）。写盘必须走 `store`。副作用：写回 `config.toml` 时不再把默认值和 pflag 绑定值（如 `configfile`、`templates = []`）整体刷进文件。
- 清理模板等独立文档也统一走 `store.WriteDocument`；主配置同目录的 `clean_templates.toml` 不再由业务代码自行写盘。
- `ru config migrate --check` 只显示迁移内容、不写文件；`ru config migrate` 备份原配置后原子应用，并顺带整理历史平铺密钥。

## 七、失败与回滚行为

| 场景 | 行为 |
| --- | --- |
| 凭证临时文件写入或权限收紧失败 | 返回错误，目标文件保持原样；临时文件在可行时移入废纸篓 |
| 凭证原子改名失败 | 回收临时文件并报错，已有密文不被覆盖 |
| 配置原子写入失败 | 不产生半成品；`WriteDocumentWithBackup` 会把备份改回原路径 |
| 历史密钥迁移 rename 失败 | 报错并保留旧位置密钥，不删除、不新建，旧密文仍可解密 |
| 单模块密钥迁移失败 | 其他模块继续迁移，返回已迁移列表与聚合错误 |
| 配置迁移中写入凭证失败 | 回收本次已写入的凭证；AIOps 与 database 凭证分别回滚后返回错误 |
| 配置迁移安装新配置失败 | 恢复原配置（`replaceConfigWithBackup` 内置回滚），并回收已写入凭证 |
| 迁移备份文件 | 原配置改名为 `<config>.bak.<时间戳>`；若含旧版明文 AIOps 密码，该明文仍保留在备份文件中（风险结论见[凭证盘点报告](credential-storage-inventory.md)） |

## 八、测试要求

修改 `internal/store`、`internal/securestore` 或凭证迁移逻辑时，必须覆盖以下用例（通过 `make test` 执行，不直接运行 `go test`）：

- 命名空间路径必须落在模块分类目录：`Dir()`、`KeyPath()`、`SecretPath()` 均不得回到平铺路径。
- 非法命名空间必须被拒绝：空值、`../escape`、大写、含路径分隔符、超长。
- `Put` / `Get` 往返成功，且密钥文件与密文文件权限为 `0600`、目录为 `0700`。
- 历史平铺密钥迁移后，旧密文仍能用同一把密钥解密；重复迁移幂等（第二次不搬移、不报错）。
- `Delete` 只能把密文移入废纸篓；`IDs` 只列出合法 UUID 的 `.secret`；空明文与空密文被拒绝。
- `PutToken` 原样保留密文文本，不重新加密。
- 配置文档读写往返与权限；缺失文件按空文档处理；损坏 TOML 必须报错；`WriteDocumentWithBackup` 失败时保留旧内容；`WritePrivateDocument` 创建 `0700` 目录。
- 加密原语遭到篡改时解密失败；测试断言密钥文件权限为 `0600`。
- `MigrateCredentialLayout` 把三个模块的平铺密钥搬入模块目录，并保留已是新布局的密钥。
- 配置迁移：`--check` 不写文件；应用迁移时生成备份；AIOps 明文密码移出 TOML；数据库档案补齐稳定 ID；数据库密码迁移为独立凭证；`profiles` 结构无效时不得改动原文件。
- 涉及删除的测试必须通过 `RU_TRASH_BIN` 之类的桩命令隔离真实废纸篓，不得污染本机回收站。

## 九、相关文档

- [配置说明](config.md)、[配置参考](configuration.md)：用户可见的配置项与凭证行为。
- [凭证存储与生成位置盘点](credential-storage-inventory.md)：全部凭证类别、落盘路径与明文风险点。
- [AIOps 远程部署与巡检](aiops.md)：AIOps 密码凭证的使用方式。
