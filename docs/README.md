# ru - 本地系统管理工作台

`ru` 是一个面向开发和运维的本地系统管理工作台，集 Docker 管理、文件清理、文件查找、防火墙管理、数据库导入导出、安装和版本辅助能力于一体。无参数运行时启动全屏 TUI 界面，适合交互式操作；部分能力也可通过子命令直接调用。

## 技术文档唯一入口

本文件是仓库正式技术文档的唯一入口。新增或修改正式技术文档必须放入 `docs/`，并在本索引补充链接；不得在仓库根目录、`.trae/documents/` 或其他临时目录新增正式技术文档。代码旁的 `README.md` 仅用于紧贴源码的局部接口契约，仍必须链接到本索引。

### 架构与 TUI

- [总体架构](architecture.md)
- [按需表格搜索与近期路径候选](tui-search-path-history.md)（普通搜索按 `/` 展开、F4 常显、同步模糊搜索与旧结果隔离、文件路径类型与文件补全、模块和用途隔离、近期排序、30 天过期及配置候选）
- [架构流程](architecture-flow.md)
- [工作台视觉、前缀提示与功能搜索](tui-command-navigation.md)（sqlmux 排版层次、完整保留现有配色、C 公共表格与按需搜索、统一边框标题与表单按钮、失焦整列灰化及亮色模块标记、`r` 前缀提示、F4 搜索与翻页、导航保护、镜像排序保留光标位置、镜像刷新与终端回放、公共表格实际预览及表头候选布局预览）；操作方式同步见 [TUI 按键规范](tui-keybindings.md)。
- [TUI 公共组件开发基线](tui-public-component-development-baseline.md)（含三栏布局的右下信息展示区（infopanel）内容与显隐扩展、含参数页可见确认/保存/执行按钮、保存前验证的「只测试 / 测试并保存」分离与表单中下部动作提示框、表单统一下拉选择、长表单焦点与按钮保持可见、只读确认长字段换行与固定按钮滚动、结构化表格按最长内容自适应列宽与两行内自动换行、滚动高度稳定性、ANSI 覆盖层与鼠标坐标一致性、局部输入接收者的注册、启用与优先级调度、列表多列排序与字符串到数值/拼音的比较、弹框内表格排序与筛选共存、按键打开的只读覆盖层开关键（同键关闭、帮助栏自动派生），以及真实 Shell 编辑输入、提交和取消回归）
- [TUI Shell 与布局开发基线](tui-shell-layout-development-baseline.md)（含无有效信息时隐藏右下信息区、三栏独立边框的紧凑上下接缝、全模块尺寸预算、整页滚动、参数表单字段窗口与整页滚动两种纵向布局、详情焦点行自动跟随与贴底字段说明、列表 `←/→` 整页翻页契约、内容区 `←/→` 与鼠标返回主界面的焦点路由及 `q`/`r q` 返回契约、全屏 TUI 终端输出接管、保守差量刷新与逐格终端回放、备用屏残影防护）
- [TUI 鼠标与滚轮交互基线](tui-mouse-scroll-interaction-baseline.md)（含内容区聚焦时左侧导航面板忽略点击与滚轮）
- [TUI 标星（关注）功能](tui-favorites-star.md)（模块级与内容区功能项级关注目标、`★ 我的关注` 分组、`s` 键切换、本地偏好存储格式与模块接入契约）
- [TUI 按键规范](tui-keybindings.md)（统一新增、删除、标星、详情、复制、排序及保存键位；`r/R` 前缀不区分大小写、禁止重复前缀，底部按键状态与无单键动作时持续等待、成批输入只接受合法双字符前缀且三字符起整批丢弃，计时反馈及修饰键暂停关闭；状态声明、编号、滚动、弹框、筛选与排序共存、覆盖层开关键（再次按下关闭）及生成物打开规则）
- [TUI 按键现状统计与歧义清单](tui-keybinding-inventory.md)（564 条 HelpBinding 声明盘点、公共层固定键位、`a/d/s/i` 等字母键的跨模块歧义、详情/日志 viewport 与 find 条件编辑器的未声明生效键、数字编号缓冲吞字母导致的 `j`/`k` 失效、未占用键位与统一改造候选方案）
- [TUI 公共组件迁移任务](tui-public-component-migration-tasks.md)
- [Bubble Tea v2 迁移与真实光标（IME）接入](tui-bubbletea-v2-migration.md)（Charm v1→v2 API 迁移、真实终端光标坐标契约、输入法候选框跟随编辑位置、覆盖的输入入口、自动回归与人工验收清单）
- [新功能开发指南](new-feature-guidelines.md)

### 模块、配置与平台

- [PostgreSQL 数据备份与恢复](database-backup-restore.md)（六种格式、按内容识别、归档范围、并行、版本预检、具名覆盖、遇错停止、目录清单、CLI 与隔离恢复验证）
- [部署模块与简单部署](simple-deploy.md)（四列配置导入与现役路径/容器/挂载/类型过滤、同一制品多组目录与容器按行一对一配对、中文空样例导出、映射页从路径识别与手动测试包、统一检测与集中配置编辑、运行中容器下拉选择及单行宽度上限、样例导出结果与文件名保留、整批保存、单表编辑复制、内置多格式解包与通配符、CLI、一键别名、Linux 隔离验证、交付包预演与失败恢复）
- [AIOps 远程部署与巡检](aiops.md)（系统 ssh/scp 的 `BatchMode` 非交互执行与主机密钥失败处理建议、密码模式 known_hosts 强校验、状态查看与巡检的事件流与结果页、`transport=local` 的本地目标与原地构建、项目级 `transfer_cmd` 自定义搬运）
- [Find 模块设计](find-module-design.md)、[Find 模块实现](find-module-implementation.md)、[Find 条件逻辑](find-condition-logic.md)
- [Docker 离线下载、打包和安装](docker-offline.md)（含 Compose 最新稳定版默认选择与连接验证）
- [Docker 删除确认与问题总结](docker-deletion.md)（组合镜像选择删除、删除全部、只保留最新；范围二次确认、精简错误与原始错误展开）
- [Docker 守护进程配置与代理（daemon.json / systemd）](docker-daemon-config.md)（诊断与维护里的结构化表单：整页滚动与贴底字段说明、常用字段解析/校验、未托管字段保留、备份与原子写回、保存后确认重启 Docker；以及 systemd drop-in 的 HTTP_PROXY/HTTPS_PROXY/NO_PROXY 配置、daemon-reload + 重启应用）
- [docker run 与 Compose 互转（数据卷挂载）](docker-run-compose-conversion.md)（命名卷真实卷名与 Compose 项目名前缀、顶层 `volumes:` 的 `name:`/`external` 解析、`--mount` 与绑定/匿名卷处理、项目名优先级（`-p`/`COMPOSE_PROJECT_NAME`/`.env`/`name:`/目录名）、往返一致性与已知边界）
- [Docker 客户端配置](docker_client_config.md)、[Docker 对照 lazydocker 待办](docker-easydocker-backlog.md)、[Docker 工作台审计](docker-workbench-lazydocker-audit-2026-07-24.md)
- [配置说明](config.md)、[配置参考](configuration.md)
- [日志体系与等级规范](logging.md)（`text`（logfmt）/ `json` 双落盘格式与 `format` 切换、`stage` 流程日志与 `logger.Failure` 失败上下文（错误链、调用栈）、四级等级落点、`logger.Fields` 结构化字段与操作审计、统一脱敏、`Init` 幂等与启动期日志回灌、默认轮转空间上限（10MB × 5 份 + 压缩）与错误专用文件、执行视图分等级落盘要求）
- [远程地址识别与归一化](remote-address.md)（IP、IP:端口、域名、自建域名、单标签内网主机名与 http/https 组合的统一识别规则，Docker 仓库、数据库主机、AIOps SSH、离线下载源与发布安装器的接入行为）
- [PostgreSQL 用户与数据库权限管理](database-user-management.md)（创建或更新用户、新建数据库并授权、绑定已有数据库、三档权限级别、单库绑定、准备失败回退、提交确认边界与真实数据库验证）
- [平台支持](platform-support.md)（含 Linux 完整发布仅支持 amd64/arm64、Windows 10/11 最低系统与 PowerShell 要求、Windows 7 不支持的工具链边界，以及 Linux、SSH、Windows、macOS 与 WSL 的能力矩阵，以及 `make run` 全模块展示与 `make temp` 环境筛选的区别）
- [防火墙管理](firewall.md)（Windows NetSecurity 接口、规则归属、网络范围与验证边界）
- [凭证存储与生成位置盘点](credential-storage-inventory.md)（14 类凭证/敏感信息、12 个存储路径、3 个 AES-256-GCM 密钥文件、明文落盘风险点与待确认清单）
- [统一凭证与配置存储](credential-store.md)（`internal/store` 目录布局、命名空间 API 契约、原子写入与权限、历史平铺密钥迁移、配置版本 v4 变更、兼容读与失败回滚）
- [文件中转与 Shell 别名](fileexport.md)（特权文件导出、安装器可选注册与脚本/程序手动注册、root/sudo 身份核对、提权提醒、立即使用终端与冲突处理）

### 发布、协作与迁移

- GitHub 发行版列表的附注标签时间、历史轻量标签修复及预览版 Latest 隔离，见[发布流程](release-workflow.md#交互式发布与安装渠道)和[GitHub 产物发布](github-artifact-release.md)。

- [发布流程](release-workflow.md)（本地输出仅版本文件夹/压缩包/摘要、旧平铺产物与历史版本自动回收、并发构建串行化与产物指纹、发布编译与打包路径隔离、宿主 trash 依赖及四平台发布入口回归）、[GitHub 产物发布](github-artifact-release.md)（含 Linux PostgreSQL 客户端官方归档回退与 SHA-256 校验、origin 标签版本来源、确认期间状态校验、交互式正式/预览发布、按版本递增的预览序号与北京时间日期、安装渠道与服务器别名询问、Linux/macOS/Windows 发布安装器按下载 URL 自动确定版本与参数覆盖、CMD/PowerShell 通用单行 irm 管道入口、自动 TLS 1.2 与编码兼容、PowerShell 5.1 预览 JSON 数组兼容、Latest API 直接动态查询与空响应处理、Windows 下载失败提示与暂存目录清理、Latest 隔离与回归测试）、[Gitea Actions 镜像](gitea-actions-mirror.md)（含显式内网来源、Runner 旧缓存排障与原生 macOS Runner 的 Node.js 前置条件）
- [Nexus APT 缓存与 CI 接入](nexus-apt-cache.md)（含内网软件源、2000 MB 软配额、闲置缓存清理与真实容器验证）
- [贡献指南](CONTRIBUTING.md)（含 CI 非交互测试、Shell 环境隔离与子进程超时要求、文件中转别名回归，以及 Go 1.26.10 与 SSH 依赖安全基线、Bash 3.2 错误分支与标签回归失败诊断、发布脚本检查和开发终端恢复验证）、[迁移说明](MIGRATION.md)（含构建清理范围、测试配置隔离与清理回归）
- [Neumorphic 弹框 API 清单](neumorphic-modal-api-inventory-2026-07-24.md)

### 质量记录与历史归档

- [质量审计与修复记录（2026-06-21）](quality-audit-2026-06-21.md)
- [当前问题与改进建议审计（2026-06-28）](quality-audit-2026-06-28.md)
- [当前问题与改进建议审计（2026-07-08）](quality-audit-2026-07-08.md)
- [质量审计（2026-07-10）](quality-audit-2026-07-10.md)
- [质量回归审计（2026-07-08）](quality-regression-audit-2026-07-08.md)
- [历史技术资料归档](archive/README.md)

## 快速开始

```bash
# 开发热更新，显示全部顶层模块（配置和日志写在仓库本地）
make run

# 临时编译运行，按当前环境筛选模块
make temp

# 构建（macOS arm64；Linux/Windows 使用 make build-linux / make build-windows）
make build-mac

# 安装到当前会话用户路径（root 对应 /root/.local）
make install

# 查看帮助
ru --help
```

## 模块概览

| 模块 | CLI 入口 | TUI 入口 | 说明 |
|------|----------|----------|------|
| Docker 管理 | `ru docker ...` | 主菜单 → Docker | 镜像/容器/网络/磁盘/服务/离线安装 |
| 镜像传输 | `ru save` / `ru load` | Docker → 保存/加载 | 批量保存压缩、批量加载 |
| 文件清理 | `ru clean` | 主菜单 → 清理 | 默认清理缓存和历史日志；规则清理可用 `--rules` 指定 |
| 文件查找 | TUI-only | 主菜单 → Find | 条件构建器、模板、历史记录 |
| 文件中转 | `sudo ru export ...`、`ru export register-alias` | 主菜单 → 文件中转（仅 Linux） | 将特权文件复制到普通登录用户的 `~/xftp`；注册当前 Shell 的快捷别名；移动源路径走废纸篓 |
| 数据库管理 | `ru database backup ...` | 主菜单 → 数据库管理 | PostgreSQL 导入/导出、全量备份、校验、恢复演练、计划任务，以及用户与数据库权限管理 |
| 防火墙 | `ru firewall open/close/list` | 主菜单 → 防火墙 | Linux(UFW/firewalld/iptables) / Windows(NetSecurity)；macOS 隐藏，WSL 不支持 |
| AIOps 远程部署 | `ru aiops ...` | 主菜单 → AIOps 部署 | 配置检查、单实例部署、远程初始化、批量部署、SSH 状态查看与巡检；`transport=local` 时改为本机构建与发布 |
| 工具 | `ru tools password` | 主菜单 → 工具 → 生成随机密码 | 生成 Base64、十六进制或纯字母数字随机密码，详见[工具模块](tools.md) |
| 系统安装 | `ru install` | — | 安装到当前用户的 `ru` 目录，并配置命令入口或 Windows PATH |
| 版本管理 | `ru git tag` | — | 语义化版本 tag 创建与推送 |
| 环境诊断 | `ru doctor` / `--json` / `--strict` / `--fix-plan` | — | 结构化检查配置、权限、客户端、计划任务和 Docker，提供严格退出码与只读修复方案 |

## 质量记录

- [质量审计与修复记录（2026-06-21）](quality-audit-2026-06-21.md)
- [当前问题与改进建议审计（2026-06-28）](quality-audit-2026-06-28.md)
- [当前问题与改进建议审计（2026-07-08）](quality-audit-2026-07-08.md)
- [质量回归审计（2026-07-08）](quality-regression-audit-2026-07-08.md)
- [GitHub 产物发布闭环](github-artifact-release.md)

## TUI 开发基线

工作台固定黑底与原有强调配色、按需搜索、映射清单的小窗口紧凑布局及表头分隔规则见 [TUI Shell 与布局开发基线](tui-shell-layout-development-baseline.md#工作台统一底色)。内容弹框总宽、内边距及带边框表格的尺寸预算见[弹框、执行视图与日志查看器](tui-shell-layout-development-baseline.md#53-弹框执行视图与日志查看器)。面包屑真实父级、名称、按已选操作预览后续步骤、点击与逐级返回、窄窗口命中规则见[面包屑层级与点击返回](tui-shell-layout-development-baseline.md#55-面包屑层级与点击返回)。

- [终端一致性源码对照](tui-terminal-consistency.md)：lazygit / lazydocker 的能力适配、单元格样式与布局；Xshell 256 色兼容基线、固定底色与颜色回放验收。

- [TUI 差量渲染兼容补丁](tui-renderer-compatibility.md)：固定框架来源、硬滚动与光标移动优化开关、渲染器重置保持、重新聚焦与重复尺寸通知防闪屏、连续 ANSI 输出和逐格终端回放、15ms 文本批次聚合与整批快捷键过滤；帮助栏跨颜色模式可读性与终端字符网格差异见 [Shell 与布局开发基线](tui-shell-layout-development-baseline.md#差量渲染兼容)。

- [TUI 公共组件开发基线](tui-public-component-development-baseline.md)：公共组件职责、接口、表单标题上边框布局、参数表单整页滚动模式与贴底字段说明、可见确认按钮、测试与保存分离的表单动作、表单中下部动作提示框、表单下拉选择、表格内容自适应列宽与两行内自动换行、列表多列排序与类型化比较、弹框内表格排序与筛选共存、局部输入接收者优先级、Shell/模块联动、组合方式和验收要求。
- [TUI Shell 与布局开发基线](tui-shell-layout-development-baseline.md)：全模块窗口与内容区尺寸预算、表单/弹框布局参数、参数表单字段窗口与整页滚动两种纵向布局、详情焦点行自动滚动与贴底字段说明、整页滚动、焦点和输入路由（内容区未声明的 `←/→` 与单击左侧导航面板都能回到主界面，模块根页同样生效；内容区 `q` 逐级返回且永不退出，退出只走 `Ctrl+C`）、全屏 TUI 终端输出接管、保守差量刷新与逐格终端回放、备用屏残影防护。
- [TUI 鼠标与滚轮交互基线](tui-mouse-scroll-interaction-baseline.md)：鼠标坐标层级、唯一事件所有权、列表命中、左键定位/单击勾选/导航菜单两下确认（第一下选中、第二下进入）语义、内容区聚焦时左侧导航面板忽略鼠标、失焦导航栏的当前模块标识、面包屑根节点显示与点击返回规则、弹框隔离与模块接入边界。
- [TUI 标星（关注）功能](tui-favorites-star.md)：模块级与内容区功能项级关注目标、左侧 `★ 我的关注` 分组、数字编号与分组标题的光标规则、`s` 键切换与安全闸门、`favorites.json` 存储格式、模块 `StarTargetProvider` 接入契约。
- [TUI 公共组件接入规范](../internal/tui/components/README.md)：新增或修改模块时必须遵守的组件接入规则。
- [统一凭证与配置存储](credential-store.md)：配置文件与凭证/密钥文件的统一读写边界、`<data_dir>/credentials/<模块>/` 分类目录、历史平铺密钥迁移、配置版本 v4 兼容读与失败回滚要求。

## CLI 命令速查

### 工具：随机密码

```bash
ru tools password             # 默认生成 12 字节随机量并以 Base64 输出
ru tools password --bytes 32  # 生成 32 字节随机量
ru tools password --format hex --bytes 16     # 生成 32 位十六进制字符串
ru tools password --format alnum --length 24 # 生成 24 位纯字母数字字符串
```

详细说明见[工具模块](tools.md)。

### Docker 容器管理

```
ru docker containers list              # 列出容器
ru docker containers start-all         # 启动全部
ru docker containers stop-all          # 停止全部
ru docker containers restart-all       # 重启全部
ru docker containers stop-rm-all       # 停止并删除全部
```

### Docker 信息与监控

```
ru docker df                           # 磁盘使用
ru docker images-size                  # 镜像大小
ru docker stats [容器]                 # 资源监控
ru docker info                         # 系统信息
ru docker top <容器>                   # 容器进程
ru docker ip <容器>                    # 容器 IP
ru docker network                      # 网络概况
```

### Docker 操作

```
ru docker logs <容器>                  # 查看日志
ru docker exec <容器>                  # 进入终端
ru docker inspect-export <容器>        # 导出 inspect JSON
ru docker update <容器>                # 更新镜像
ru docker runtime-update <容器>        # 运行时参数热更新
ru docker runlike <容器>               # 生成 docker run 命令
ru docker compose-convert              # docker run ↔ compose 互转（命名卷保留真实卷名，见 [互转说明](docker-run-compose-conversion.md)）
ru docker backup <容器>                # 备份卷
ru docker cleanup                      # 清理无用资源
ru prune                               # 清理退出容器
```

### Docker 离线

```
ru docker offline download --version 28.0.3 --arch amd64 # 下载所选版本与架构
ru docker offline package --input ./docker-offline/x86_64 --installer script --format zip # 按清单打包
ru docker offline install --input ./docker-offline/x86_64 # 安装所选程序（仅 Linux）
```

### Docker 服务

```
ru service <名称>                      # 创建 systemd 服务（仅 Linux）
ru docker compose-project list         # 列出 Compose 项目
```

### 镜像传输

```
ru save --all --compress gzip          # 保存全部镜像
ru save --filter "nginx" -i            # 交互式筛选保存
ru load --input ./images/              # 批量加载
ru verify                              # 检查 Docker 环境并输出检查报告（含 7z）
```

在 TUI 的“Docker → 镜像管理”中还可选择本地镜像并上传到 `[[docker.registries]]` 配置的指定服务端仓库；上传确认页默认在上传成功后删除为本次上传添加的本地目标标签，可用“保留本地目标标签”选项改为保留。可在“Docker → 诊断与维护 → 可信任远端源”使用用户名和密码验证登录，成功后将密码加密保存到本机。多个上传目标、命名空间和安全凭据配置见 [Docker SDK 配置说明](docker_client_config.md)。

TUI 的镜像列表按镜像名合并同一镜像的多个标签：标签列显示标签个数，镜像 ID、大小、创建时间在组内取值不一致时显示“多个”，“使用中”只要有任一标签在用即显示“是”。在“导出镜像”和“上传镜像”的选择页中，合并行按 `Space` 打开标签弹框逐个勾选标签，弹框内按 `r a` 切换全选/取消全选（把预选项全部取消后确认表示取消整行选择）；`Enter` 只提交已经勾选的镜像，不在合并行上隐式全选该镜像名的全部标签，用弹框挑出来的标签会原样提交；单标签行保持通用的多选约定，未勾选任何项时先勾选当前行再确认。列表里按 `r a` 可以对光标所在行一键全选/取消整行（合并行表示该镜像名的全部标签，会清掉单独的标签勾选记录；单标签行等同 `Space`），已经用弹框挑过部分标签时按 `r a` 表示整行全选；小写 `a` 保留给“新增”动作，不再承担全选。光标停在任意镜像行上按 `i` 弹出只读“镜像详情”弹框，标题是镜像名：上方横向展示组内相同的部分（标签数、使用中，以及取值一致的镜像 ID/大小/创建时间），下方按标签逐行展示组内不同的部分；`Esc/q` 关闭弹框，查看过程不改变列表、光标和勾选状态。镜像列表可以按镜像名、标签、镜像 ID、大小、使用中、创建时间排序，组内取值不一致的“多个”行不参与比较、固定排在最后；打开“镜像详情”弹框或“选择标签”弹框时标签顺序跟随镜像列表当前排序里能对应上的列（标签、镜像 ID、大小、使用中、创建时间，镜像名跳过）并显示同样的方向标记，在标签界面按 `S` 确认过自己的排序后以它为准，把排序键全部移出再确认即恢复跟随。在“查看镜像列表”页连续按两下 `d` 删除当前行：第一次 `d` 只在右下信息展示区列出目标镜像、整行全部标签、是否仍被容器引用以及删除不可恢复，帮助栏提示再按一次并一直保留到下一次按键；再按一次 `d` 才进入覆盖式执行视图逐个标签调用 daemon，其他按键、移动光标或切换页面都会取消，不再有单独的确认页。合并行代表整个镜像名，删除结果在覆盖式执行视图中逐标签展示，被容器（含已停止容器）引用的镜像由 Docker 拒绝删除，不做强制删除。

### 清理

```
ru clean                               # 清理缓存和历史日志
ru clean --rules maven --dry-run       # 按规则扫描清理
```

内置清理规则：
- **Maven** — `.lastUpdated`, `.repositories`, `.sha1`, `.part` 等
- **macOS** — `.DS_Store`, `._*` 资源分叉文件
- **压缩包** — `.zip`, `.tar`, `.gz`, `.7z`, `.rar`
- **临时文件** — `.tmp`, `.temp`，支持保留时间阈值
- **自定义** — 配置文件中定义任意路径和后缀

TUI 的「模板清理」选择模板后先展示本次清理路径；可在路径字段修改目标，多个路径用英文逗号分隔。执行时先扫描并显示待清理数量、大小和明细，只有在扫描结果页按 `Enter` 确认后才逐项移入废纸篓。完成页保留清理汇总，按 `d` 查看已清理文件，按 `l` 查看执行日志；返回扫描结果的面包屑只用于查看，不会再次执行清理。

清理工具在左侧导航中标识模块；右侧内容标题显示「手动清理」或「模板清理」，顶部面包屑只列实际页面与当前执行状态。模式名称不作为面包屑节点，已访问且可还原的参数页、模板列表和扫描结果页可点击返回。

### Find 文件查找

Find 当前仅在全屏 TUI 中提供，不提供 `ru find` 子命令。入口为主菜单“Find 文件查找”，用于通过表单化流程构建查询条件、套用模板、查看历史记录并执行查找。

### 数据库管理

数据库导入/导出以全屏 TUI 为主；备份计划、校验、恢复演练和系统计划任务同时提供 `ru database backup` 子命令：

- Docker 容器模式：选择已有 PostgreSQL 容器，自动读取连接信息并获取数据库、Schema 和表列表。
- 手动连接模式：手动填写主机、端口、用户、密码、数据库、Schema 和表。
- SQL 导出默认目录为 `./sql`，默认文件名前缀为 `postgres`。
- 备份支持 SQL、ZIP、TAR.GZ、PostgreSQL Custom、原生 TAR 和 Directory；定时计划默认使用 Custom。
- 数据恢复支持只读检查、模式/表范围、仅数据/结构、所有者处理与并行；覆盖已有对象需要具名确认。详细限制见 [PostgreSQL 数据备份与恢复](database-backup-restore.md)。
- `ru database inspect --file <路径>` 只读检查；`ru database restore --profile <档案ID> --database <目标库> --file <路径>` 恢复到已有数据库。
- `ru database backup run --plan <ID或名称>` 立即执行；`verify` 校验；`restore-test` 使用临时 Docker PostgreSQL 恢复演练。
- `schedule install/status/remove` 分别管理 systemd user timer、LaunchAgent 或当前用户 Task Scheduler。

### 防火墙

```
ru firewall open -p 80,443,8080        # 配置 TCP 入站放行
ru firewall close -p 8080             # 撤销本工具的放行规则
ru firewall list                      # 查看规则，不检测端口连通性
```

Linux 需要 root；Windows 写入需要管理员终端，默认只配置域和专用网络，公用网络不放行。macOS 不提供此功能。Windows 规则范围和查询语义见[防火墙管理](firewall.md)。

### AIOps 远程部署

```
ru aiops servers                       # 查看服务器
ru aiops check-config                  # 检查 AIOps 配置
ru aiops projects                      # 查看项目部署关系
ru aiops topology                      # 查看服务器与项目拓扑
ru aiops status --server 生产服务器      # 查看服务器状态
ru aiops inspect --all                 # 巡检所有服务器
ru aiops deploy --server 生产服务器 --project api --local-path ./target --select api.jar
ru aiops deploy-init --server 生产服务器 --project api --deploy-start --deploy-bootstrap --jar ./target/api.jar
ru aiops multi-deploy --server 生产服务器 --project api --local-path ./target --select api.jar
```

配置和流程见 [AIOps 远程部署与巡检](aiops.md)。

日常交互优先进入 TUI 的“AIOps 部署”，命令行入口主要用于脚本化、调试和自动化。

### 其他

```
ru install                             # 安装到系统路径
ru doctor                              # 诊断本机 ru/trash/Docker 环境
ru doctor --json                       # 输出机器可读诊断结果
ru doctor --strict                     # error 检查项存在时以退出码 1 结束
ru doctor --fix-plan                   # 只输出建议，不修改系统
ru config migrate --check              # 只查看配置迁移内容
ru config migrate                      # 备份后原子迁移
ru git tag [patch|minor|major]         # 版本 tag 管理
```

安装或 Makefile 安装会把随包 `trash` 与 `ru` 统一放入安装目录：Linux/macOS 为 `~/.local/share/ru`，命令入口为 `~/.local/bin/ru`，无需 `sudo`；Windows 为 `%LOCALAPPDATA%\Programs\ru` 并配置 PATH。若 Unix 的 `~/.local/bin` 尚未在 `PATH` 中，请在 Shell 配置中加入 `export PATH="$HOME/.local/bin:$PATH"`。命令入口已是软链接时，`make install` 用 `ln -sfn` 原子覆盖，不经过随包 `trash`（macOS 随包 `trash` 统一交给 Finder 删除，而 Finder 无法回收符号链接），只有旧布局留下的真实文件才进入废纸篓。随包 `trash` 是替换旧目标时的最优方案而不是安装必需项：缺少时 `ru install` 与发布包安装脚本只打印降级告警并继续安装，替换旧 `ru`、旧命令入口或旧 `trash` 时改为改名备份为 `*.bak`（`*.bak` 已存在时追加时间戳），不做硬删除；此时删除类功能仍需要在 `PATH` 中提供 `trash` 命令。

## 配置

配置文件位置：
- 生产模式: `~/.ru/config.toml`
- 调试模式: `build/debug/.ru/config.toml`
- 开发 Makefile 运行: `data/config.toml`

清理模块用户模板保存在主配置同目录的 `clean_templates.toml`；内置模板由程序代码提供，不写入主配置。

支持热重载，修改配置文件后自动生效。

主要配置项：

```toml
app_name = "ru"

[common]
max_retries = 3
timeout = 30
data_dir = ""                          # 留空使用默认路径

[docker]
path = "./images/"
keyword_delimiter = "\\"

[logging]
log_level = "info"
log_path = ""                          # 留空则使用数据目录下的 logs/ru.log
format = "text"                        # text（logfmt 文本，默认）| json（结构化，便于采集）
max_files = 10
max_file_size = 50
rotation_policy = "time"               # time | size | mixed
compress = true

[compress]
type = "gzip"                          # none | gzip | zstd | 7z
level = 6

[clean.maven]
suffixes = [".lastUpdated", ".part"]
paths = [".m2/repository"]
```

## 平台支持

| 功能 | Linux | macOS | Windows |
|------|-------|-------|---------|
| Docker 管理 | ✓ | ✓ | ✓ |
| 镜像传输 | ✓ | ✓ | ✓ |
| 文件清理 | ✓ | ✓ | ✓ |
| macOS 元数据清理 | ✓ | ✓ | ✓ |
| 文件查找 | ✓ | ✓ | ✓ |
| 数据库管理 | ✓ | ✓ | ✓ |
| 防火墙 | ✓ (firewalld/ufw/iptables) | ✗ | ✓ (NetSecurity) |
| Systemd 服务 | ✓ | ✗ | ✗ |
| Docker 离线安装 | ✓ | ✗ | ✗ |
| 自安装 | ✓ | ✓ | ✓ |
| 剪贴板 | ✓ (xclip) | ✓ (pbcopy) | ✓ (PowerShell) |
| 回收站删除 | ✓ (sidecar) | ✓ (sidecar) | ✓ (sidecar) |

## 项目结构

```
cmd/ru/                  # 入口
internal/
  app/                   # 应用服务层
  clean/                 # 清理规则引擎
  compress/              # 压缩策略 (none/gzip/zstd/7z)
  config/                # 配置管理
  container/             # IoC 容器
  database/              # SQLite
  docker/                # Docker Engine SDK 封装
  domain/                # 领域模型
  find/                  # 文件查找
  firewall/              # 防火墙管理
  fuzzy/                 # 模糊搜索引擎
  git/                   # Git tag 管理
  install/               # 自安装
  logger/                # 日志轮转
  messaging/             # 消息总线
  naming/                # 默认导出命名
  netaddr/               # 远程地址解析与归一化
  platform/              # 平台检测
  runner/                # 并发任务池
  trash/                 # 回收站
  transfer/              # 镜像传输
  tui/                   # 全屏 TUI
  ui/                    # 终端交互工具
scripts/                 # 构建脚本
docs/                    # 文档
```

## 构建

```bash
make deps                # 安装依赖
make fmt                 # 格式化
make test                # 测试
make test-integration    # 显式启用的真实环境集成测试
make build-mac           # macOS arm64 完整运行目录与版本包
make release             # 多平台发布
make verify-release      # 校验发布包结构和 SHA256
make build-linux         # Linux 完整运行目录与版本包，默认 amd64（可用 ARCH=arm64 切换）
make build-windows       # Windows amd64 完整运行目录与版本包
make build-all           # 宿主平台构建 + make release
make clean               # 回收根构建目录、历史二进制与嵌套测试残留
```
