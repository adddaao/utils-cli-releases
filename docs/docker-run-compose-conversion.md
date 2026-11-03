# docker run 与 Compose 互转（数据卷挂载）

`ru docker compose-convert` 与 TUI「Docker → docker run 与 Compose 转换」在 `docker run` 命令和 `docker-compose.yml` 之间互转。本文说明命名卷（数据卷）在转换中的处理规则，重点解决 Compose 项目名前缀导致容器挂载到空卷的问题。

## 背景：Compose 会按项目名给命名卷加前缀

Compose 顶层卷 `postgres_data` 在项目 `infrastructure` 下实际创建为 `infrastructure_postgres_data`；而 `docker run -v` 使用的是字面卷名。转换时如果直接照抄卷名：

- `docker run` → compose：服务引用了 `infrastructure_postgres_data`，但顶层没有声明，Compose 会报“未定义卷”或把它二次前缀成 `<新项目名>_infrastructure_postgres_data`，容器挂载到新的空卷，看起来就像数据丢了；
- compose → docker run：Compose 文件里写 `postgres_data`，生成的命令挂载字面卷 `postgres_data`，同样不是原来的 `infrastructure_postgres_data`。

因此两个方向都必须按“真实卷名”转换。

## docker run → compose

命名卷会同时写入服务挂载和顶层 `volumes:` 声明，并显式写入真实卷名 `name:`：

```bash
ru docker compose-convert --to-compose \
  'docker run --name postgres -p 5432:5432 -v infrastructure_postgres_data:/var/lib/postgresql/data postgres:16'
```

```yaml
services:
  postgres:
    image: postgres:16
    ports:
      - 5432:5432
    volumes:
      - infrastructure_postgres_data:/var/lib/postgresql/data
volumes:
  infrastructure_postgres_data:
    name: infrastructure_postgres_data
```

`name:` 让 `docker compose up` 直接使用 `infrastructure_postgres_data` 这个卷（存在则复用），不会按项目名再加前缀；卷不存在时按该名字创建，与 `docker run -v` 创建卷的行为一致。

支持的挂载写法：

| docker run 写法 | 转换结果 |
| --- | --- |
| `-v 卷名:/容器路径[:ro]` | 服务挂载 + 顶层 `volumes:` 声明（`name:` 为真实卷名） |
| `-v ./host:/容器路径`、`-v /host:/容器路径`、`-v C:\host:/容器路径` | 绑定挂载，原样保留，不生成顶层声明 |
| `-v /容器路径` | 匿名卷，原样保留，不生成顶层声明 |
| `--mount type=volume,source=...,target=...[,readonly]` | 转为 `-v source:target[:ro]` 并按命名卷处理 |
| `--mount type=bind,source=...,target=...` | 转为 `-v source:target` |
| `--mount type=tmpfs,target=...` | 转为 `tmpfs` 挂载 |

## compose → docker run

命名卷会按 Compose 的真实卷名规则解析后输出：

```bash
ru docker compose-convert --to-run -f /mnt/wtxdaas/env/docker-compose.yml
# 需要覆盖项目名时：
ru docker compose-convert --to-run -f /mnt/wtxdaas/env/docker-compose.yml --project-name infrastructure
```

```yaml
services:
  postgres:
    image: postgres:16
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:
```

```bash
docker run --name postgres -v infrastructure_postgres_data:/var/lib/postgresql/data postgres:16
```

真实卷名按以下优先级确定（与 `docker compose` 的项目名来源一致）：

1. `--project-name/-p` 显式项目名（TUI 无该输入，直接读文件）；
2. 进程环境变量 `COMPOSE_PROJECT_NAME`；
3. Compose 文件所在目录的 `.env` 中的 `COMPOSE_PROJECT_NAME`；
4. Compose 顶层 `name:`；
5. `-f` 文件所在目录名（TUI 按用户输入的文件路径推断）；
6. 以上都没有时保留字面卷名。

例如项目目录是 `/mnt/wtxdaas/env`，而 `.env` 里写了 `COMPOSE_PROJECT_NAME=infrastructure`，转换结果会使用 `infrastructure_postgres_data`，与 `docker compose config` 显示的真实卷名一致。

顶层卷声明本身优先于项目名前缀：

| 顶层声明 | 实际卷名 |
| --- | --- |
| `name: infrastructure_real_data` | `infrastructure_real_data` |
| `external: true` | 顶层键本身（外部卷不加项目前缀） |
| `external: {name: actual_legacy_volume}` | `actual_legacy_volume` |
| 无（由 Compose 管理） | `<项目名>_<键>` |

服务里的绑定挂载、匿名卷和未在顶层声明的命名卷原样输出。

## 往返一致性

```text
docker run -v infrastructure_postgres_data:/var/lib/postgresql/data
  → compose: 顶层 volumes: infrastructure_postgres_data: {name: infrastructure_postgres_data}
  → docker run -v infrastructure_postgres_data:/var/lib/postgresql/data
```

命名卷在两轮转换后仍指向同一个真实卷，`ro` 等模式、绑定挂载和匿名卷也保持不变。

## 已知边界

- 只读取进程环境变量 `COMPOSE_PROJECT_NAME` 与项目目录 `.env` 中的同名键；自定义 `--env-file`、`.env` 变量插值不参与判断，需要时显式传 `--project-name`。
- 服务卷的长格式列表（`volumes: - type: volume, source: ..., target: ...`）当前不在转换字段范围内，会因 YAML 结构不匹配报解析错误。
- `--volumes-from`、Compose `profiles`/`deploy` 等未列出的字段不参与转换。
- 未在顶层声明的命名卷按字面卷名输出；Compose 本身会拒绝这种引用，转换不替它补声明。
