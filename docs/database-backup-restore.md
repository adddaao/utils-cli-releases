# PostgreSQL 数据备份与恢复

入口：[正式文档索引](README.md)。实现参考了 [dbx-pg-restore](https://github.com/alvinades98/dbx-pg-restore) 的客户端分工、归档识别、版本预检和选择性恢复思路，沿用本项目的连接档案、凭证库、公共表单与执行视图。

## 程序分工与格式

`pg_dump` 生成单库逻辑备份；`pg_restore` 恢复 PostgreSQL 归档；`psql` 执行纯 SQL 备份。程序优先查找随包 `bin/`，然后使用 PATH 中的工具。

| 格式 | 备份方式 | 恢复方式 | 并行备份 | 并行恢复 |
| --- | --- | --- | --- | --- |
| SQL | `pg_dump` 文本输出 | `psql` | 否 | 否 |
| ZIP | SQL 直接写入压缩流 | 读取唯一载荷后恢复 | 否 | 否 |
| TAR.GZ | SQL 先暂存再打包 | 读取唯一载荷后恢复 | 否 | 否 |
| Custom | `pg_dump -Fc` | `pg_restore` | 否 | 是 |
| PostgreSQL TAR | `pg_dump -Ft` | `pg_restore` | 否 | 否 |
| Directory | `pg_dump -Fd`，输出 `.pgdir` 目录 | `pg_restore` | 是 | 是 |

恢复按实际内容选择工具：Custom 识别 `PGDMP` 文件头，原生 TAR 检查 `toc.dat` 首项，Directory 检查目录中的 `toc.dat`。归档误命名为 `.sql` 仍使用 `pg_restore`；SQL 误命名为 `.dump` 仍使用 `psql`。纯 SQL 目前要求 UTF-8，不自动转码。

ZIP、TAR.GZ 可以读取唯一的 `.sql`、`.dump` 或 `.backup` 载荷，载荷仍按内容识别。多个候选载荷会被拒绝，不会静默只恢复第一份；归档内路径不用于写盘。普通 `.sql.gz` 不属于 TAR.GZ 支持范围。

原生归档的能力与限制见 [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) 和 [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html) 官方文档。

## TUI 使用

进入「数据库管理 → PostgreSQL」。

- **数据导出**：选择连接、数据库、模式和表，然后选择格式与保存位置。支持仅数据、仅结构、跳过指定表的数据；跳过数据时仍保存表结构。Directory 可设置 1–64 个并行任务。
- **数据恢复**：指定已经存在的目标数据库与备份路径。先使用「检查备份内容」只读查看格式、来源版本和归档目录；确认目标后使用「开始恢复」。
- **备份与恢复**：管理计划、立即执行、校验或在隔离 Docker 容器中恢复演练。计划格式也支持原生 TAR 和 Directory；计划默认仍为 Custom，目录计划默认单任务执行。

路径字段使用公共路径建议、补全与分场景历史；`Enter` 先选择高亮候选，再次确认才提交。检查内容弹框支持方向键、翻页、按表格跳转和滚轮；缩放不改变来源表单草稿。长参数页保留当前字段和可见执行按钮。

归档恢复可设置：

| 参数 | 行为与限制 |
| --- | --- |
| 模式范围 | 逗号分隔 schema 名；留空恢复全部。跨模式依赖需要一并选择 |
| 表范围 | 逗号分隔裸表名，通过模式范围限定 schema；不自动补齐索引、序列、外键等依赖 |
| 仅数据 / 仅结构 | 两者互斥。仅数据需要目标结构已存在，不执行自动去重 |
| 跳过所有者和授权 | 使用 `--no-owner --no-privileges`；新建对象归当前恢复账号所有，不重建原账号及授权 |
| 并行数 | 1–64；大于 1 仅支持手动连接模式下未包装的 Custom 文件或 Directory 目录 |
| 覆盖已有对象 | 使用 `--clean --if-exists`，删除本次准备恢复的对象再重建；必须输入完整目标数据库名确认 |

纯 SQL 脚本不能通过这些归档参数改写恢复范围；设置了不适用的选项会在执行前报错，不会静默忽略。更换目标数据库、备份路径或关闭覆盖开关后，原覆盖确认失效。

覆盖恢复只清理归档对应对象，不提供删除目标库所有 schema 的“重置数据库”操作。执行前应保存目标库可用备份。需要新建数据库或用户时，先使用[用户与数据库管理](database-user-management.md)。

## 版本检查与错误处理

备份先检查 `pg_dump --version` 和服务端版本；工具主版本低于服务端时拒绝执行。Custom 使用兼容旧版工具的数字压缩等级参数。

恢复在写目标库前检查格式、压缩载荷完整性、工具版本、归档目录及目标服务端版本。`pg_restore` 低于归档生成工具时拒绝；备份生成工具版本高于目标服务端时也拒绝，避免将不保证兼容的降级恢复当作正常操作。无法提取备份来源版本时，检查结果明确留空，不推断版本。

容器模式的备份、恢复通过标准输入传递本地文件。Directory 的本地目录和并行恢复不能通过该流直接交给容器，因此要求使用手动连接模式。容器内使用其本地连接；宿主机地址及映射端口用于本地客户端后备连接。

恢复工具在执行前不可用时，可以切换到已填写宿主机地址的本地客户端；一旦开始恢复，发生错误就停止，不会换通道重新执行。SQL 使用 `psql -X -v ON_ERROR_STOP=1`，归档使用 `pg_restore --exit-on-error`。具体错误尾部会保留在执行结果中。

执行视图中的 `x`、`Esc` 或 `q` 请求取消当前任务，结果仍留在当前执行视图。**遇错停止和取消都不保证整次恢复回滚**，目标库可能已经有部分提交，需核查后再决定后续操作。密码通过环境传递，不进入新增备份/恢复命令的参数列表。

## 完整性校验与恢复演练

备份先写暂存产物，检查通过后提交正式名称，再生成 manifest。新建的单文件备份使用 `0600` 权限；已有产物不覆盖。

校验包括非空内容、可识别格式、ZIP/TAR.GZ 载荷与校验和、归档目录可读性，以及已有 manifest 的文件名、大小、格式、状态和 SHA-256。损坏或不可读的 manifest 会报错。Directory 按稳定相对路径、文件大小及每个文件的摘要生成整体摘要，拒绝链接和特殊文件；新增、改名或修改文件都会使原清单失效。保留策略仅回收身份和摘要匹配的备份及其清单，继续逐项走 `trash`。

`pg_restore --list` 只证明归档目录可读，并不证明所有数据块都能导入；SHA-256 证明与清单一致，也不代替恢复演练。演练在无宿主端口的临时容器内执行导入与基础查询，优先使用备份生成工具对应主版本的 PostgreSQL 镜像；归档跳过原所有者及授权。演练失败时保留备份和 manifest，并返回失败；Docker 不可用时明确标记跳过。

## CLI

```bash
# 查看已保存的连接档案 ID：TUI 的「连接档案」字段
# 只读检查备份；归档检查需要可用的本地 pg_restore
ru database inspect --file /backup/app.dump

# 恢复归档；目标数据库须已创建，密码从档案对应的凭证库读取
ru database restore --profile <档案ID> --database app_restore \
  --file /backup/app.dump --no-owner --jobs 4

# 选择模式；表范围为裸表名，不自动补齐依赖
ru database restore --profile <档案ID> --database app_restore \
  --file /backup/app.dump --schemas public --tables users,orders

# 覆盖必须额外具名确认
ru database restore --profile <档案ID> --database app_restore \
  --file /backup/app.dump --clean --confirm-database app_restore

ru database backup run --plan <计划ID或名称>
ru database backup verify --file /backup/app.pgdir
ru database backup restore-test --file /backup/app.dump
```

本功能是单库逻辑备份恢复，不包含 WAL/PITR、全局角色和表空间备份，也不自动为缺失角色创建占位账号。需要跨账号迁移时可启用跳过所有者和授权，再独立配置目标权限。

## 验证

```bash
make test-database
make test-database-live
make test-tui
```

`test-database-live` 自建隔离临时集群：优先使用完整本地 PostgreSQL 服务端，否则使用匹配客户端主版本的自动回收 Docker 容器（可能下载官方镜像）。不读取现有连接配置，不连接用户数据库，不挂载宿主数据目录。验证六种格式的数据及序列往返、误扩展名识别、跳过表数据、具名覆盖、SQL 遇错停止和目录 manifest 变更检测。
