# Docker 守护进程配置与代理（daemon.json / systemd）

Docker 守护进程的配置与代理有两种落地方式：`daemon.json`（推荐，Docker Desktop 忽略其中的 `proxies`）和 systemd 的 `docker.service` drop-in 环境变量。TUI 在「Docker → 诊断与维护」分别提供两个页面：

| 页面 | 文件 | 适用 |
| --- | --- | --- |
| 守护进程配置 | `daemon.json` | 所有平台；结构化字段编辑、含 `proxies` 代理 |
| Systemd 代理配置 | `/etc/systemd/system/docker.service.d/http-proxy.conf` | Linux systemd（rootful）；`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` |

两种代理方式同时配置时，Docker 以 `daemon.json` 的 `proxies` 为准；Docker Desktop 不使用 `daemon.json` 的 `proxies`，应在其设置中配置代理。

实现位于 `internal/docker/daemon_config.go`、`internal/docker/systemd_proxy.go`，TUI 位于 `internal/tui/modules/docker/docker_daemon.go`、`docker_systemd_proxy.go`。

## 配置文件位置

| 平台 | 默认路径 |
| --- | --- |
| Linux | `/etc/docker/daemon.json` |
| macOS / Windows（Docker Desktop） | `<用户主目录>/.docker/daemon.json` |
| 显式覆盖 | 环境变量 `RU_DOCKER_DAEMON_JSON`（按绝对路径归一化，优先于平台默认值） |

文件不存在时表单照常进入，保存时创建文件；文件存在但 JSON 无法解析时进入只读的“读取失败”页，展示具体解析错误和文件原文，并明确界面不会覆盖无法解析的文件。用户在外部修复后按 `r` 重新读取。

## daemon.json 可编辑字段

| 分组 | 字段（daemon.json 键） | 说明 |
| --- | --- | --- |
| 基础 | `data-root`、`storage-driver`、`live-restore`、`userland-proxy`、`experimental` | 数据目录、存储驱动与守护进程行为开关 |
| 日志 | `log-driver`、`log-opts.max-size`、`log-opts.max-file` | 默认日志驱动、单文件上限与保留文件数 |
| 镜像与仓库 | `registry-mirrors`、`insecure-registries` | 镜像加速地址与允许 HTTP/自签名证书的仓库 |
| 网络 | `dns`、`dns-search`、`bip`、`fixed-cidr`、`max-concurrent-downloads`、`max-concurrent-uploads` | 容器 DNS、默认网桥地址与镜像并发数 |
| 代理（守护进程环境） | `proxies.http-proxy`、`proxies.https-proxy`、`proxies.no-proxy` | Docker 守护进程出站请求使用的代理与直连列表 |
| 监听与证书 | `hosts`、`tls`、`tlsverify`、`tlscacert`、`tlscert`、`tlskey` | Docker API 监听地址与 TLS 材料；TLS 关闭时证书字段隐藏且不提交 |

- `userland-proxy` 使用“未设置 / 开启 / 关闭”三态：Docker 该键的默认值是开启，不能用一个布尔值表示“保持默认”。未设置时保存不写入该键。
- 文本字段留空表示删除该键（回到 Docker 默认行为）；布尔开关只有开启或原文件已有该键时才写回，保证 `true → false` 能正确落盘。
- 未纳入界面的顶层键，以及 `log-opts`、`proxies` 中未纳入界面的子键会被原样保留：顶层键沿用原文件顺序，子键按名称排序。表单上方的“未托管字段”一行会列出未被界面接管的顶层键。
- `hosts`、`tls*` 与 `data-root` 修改影响面较大：修改监听地址或证书可能导致 Docker 客户端无法连接；修改数据目录前必须先迁移已有镜像、容器和卷，否则 Docker 会在新目录重新初始化。

## 校验规则

保存前用 `ValidateDaemonConfigValues` 做本地校验，错误按字段回填到表单行；校验失败只在表单中下部展示“配置校验未通过”，不会写盘。主要规则：

- `data-root`、`tlscacert`、`tlscert`、`tlskey`：必须是绝对路径，不能包含 NUL。
- `storage-driver`、`log-driver`：只接受 Docker 支持的固定枚举，留空表示默认。
- `log-opts.max-size`：形如 `20m`、`100m`、`1g`；`max-file` 与并发数必须是正整数。
- `registry-mirrors`：`http://` 或 `https://` 开头的 URL，必须有主机，不能带用户信息、路径、查询或片段。
- `insecure-registries`：`主机` 或 `主机:端口`，不能带协议和路径；IPv6 使用 `[::1]:5000` 形式。
- `dns` 必须是 IP；`dns-search` 必须是合法域名；`bip`、`fixed-cidr` 必须是合法 CIDR。
- `hosts`：`unix://<绝对路径>`、`fd://...` 或 `tcp://主机:端口`（TCP 必须有端口）。
- `http-proxy`/`https-proxy`：合法的 `http`/`https` URL；`no-proxy` 按逗号拆分并忽略空项，条目内部不能含空白。

## Systemd 代理配置（docker.service drop-in）

Linux 上 Docker 以 systemd 服务运行时可另外通过 drop-in 文件给守护进程设置代理环境变量，等价于手工编辑：

```ini
[Service]
Environment="HTTP_PROXY=http://proxy.example.com:3128"
Environment="HTTPS_PROXY=http://proxy.example.com:3128"
Environment="NO_PROXY=localhost,127.0.0.1,docker-registry.example.com,.corp"
```

- 入口：诊断与维护 →「Systemd 代理配置」（仅在支持 systemd 的平台出现）；默认文件 `/etc/systemd/system/docker.service.d/http-proxy.conf`，可用 `RU_DOCKER_PROXY_DROPIN` 覆盖。
- 可编辑字段：`HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`。文件里的其他 `Environment=` 赋值（例如 `ALL_PROXY`）、注释和其他段/指令会原样保留；受管键统一写成 `Environment="KEY=value"` 形式并追加在 `[Service]` 段内。
- 与 `daemon.json` 的 `proxies` 相比，这是设置守护进程启动环境变量的方式；两者同时存在时以 `daemon.json` 为准。Docker Desktop 不使用该 drop-in。
- systemd 值里的 `%` 有特殊含义，密码等特殊字符需要按 systemd 规则双写为 `%%`；界面按原文保存，不会自动解码或改写。校验只约束协议、主机与空白字符，合法 URL 示例：`http://proxy.example.com:3128`。
- 校验通过后由 `internal/store` 备份原文件并原子写回，随后进入「应用确认」页；确认后执行 `systemctl daemon-reload`、`systemctl restart docker`，输出进入公共执行视图，完成后回到表单提示配置已生效。不支持界面内应用的环境会提示手动执行这两条命令。
- 写入 `/etc/systemd` 需要 root；权限失败时提示用 `sudo` 重新打开 `ru`，表单内容保留。
- 根身（rootless）Docker 使用 `~/.config/systemd/user/docker.service.d/` 和 `systemctl --user`，当前界面不覆盖该路径，需要手工维护。

按键：表单 `↑↓/k/j` 移动、`Enter` 编辑或执行操作行、`Esc/q` 返回；编辑态 `Enter` 保存字段、`Esc` 取消、`←→/Home/End` 移动光标、`Backspace/Delete` 删除；「查看原始文件」弹框 `↑↓/PgUp/PgDn` 滚动、`Esc/q` 关闭；应用确认页 `Enter/y` 重载并重启、`Esc/q/n` 稍后手动应用；读取失败页 `r` 重新读取。

## daemon.json 保存与生效

1. 保存动作先本地校验，通过后由 `internal/store` 备份原文件为 `<path>.bak.<时间戳>`，再用 `WriteAtomic` 原子写入（保留原文件权限，缺失时 `0644`，目录 `0755`）。写入失败会用备份回滚。
2. 保存成功后进入“确认生效方式”页，展示配置文件、备份路径、重启影响，并等待用户确认。
3. 确认重启后执行 `systemctl restart docker`，命令输出逐行进入公共执行视图的日志区，重启完成后轮询等待 Docker daemon 可用；执行视图完成后回到配置表单并在中下部提示“配置已生效”。
4. 当前环境不支持在界面内重启时（非 Linux systemd，例如 Docker Desktop），确认页明确提示只能手动重启；按确认键会回到表单并提示“配置已保存，请手动重启”。重启会停止正在运行的容器，配置了 restart 策略的容器会自动恢复。
5. 写入 `/etc/docker/daemon.json` 需要 root 权限；权限失败时错误详情会提示使用 `sudo` 重新打开 `ru`，表单内容和本次输入全部保留。

## 页面与按键

配置页使用公共参数表单：`↑↓/k/j` 移动字段，`Enter` 编辑文本/展开枚举下拉/执行可见操作行，`Space` 切换布尔开关，`Esc/q` 返回诊断与维护。字段编辑态由公共内联编辑器接管：`Enter` 保存字段、`Esc` 取消编辑、`←→/Home/End` 移动光标、`Backspace/Delete` 删除。枚举字段使用公共下拉：`↑↓/PgUp/PgDn` 选择、`/` 搜索、`Enter` 确认、`Esc/q` 取消并保留原值。

配置页分组多、字段多，使用公共参数表单的整页滚动模式：顶部“配置文件”信息表和全部字段区块按顺序完整渲染，不因终端高度不足删除字段；`↑↓/k/j` 把焦点移出可视区域时页面按最小距离滚动，字段说明和校验汇总固定在内容区底部。“操作”区块随内容滚动，不再固定常驻；移动到 `查看原始 JSON` / `保存配置` 时页面自动滚到该区块。保存校验失败时贴底区域先显示失败结论，同时保留“输入校验失败”的字段级汇总（哪个字段为什么不合格），字段说明让位；窗口过矮时贴底区域自动隐藏，把高度让给可滚动内容。

表单末尾有两个操作行：`查看原始 JSON` 打开只读弹框展示文件当前保存的原文（长内容按 `↑↓/PgUp/PgDn` 滚动，`Esc/q` 关闭，未保存的修改不会出现在其中）；`保存配置` 触发校验与写回。读取失败页另声明 `r` 重新读取。完整按键语义见 [TUI 按键规范](tui-keybindings.md)。

## 验证与测试

- 核心单元测试 `internal/docker/daemon_config_test.go` 覆盖：无文件读取、未知顶层键与嵌套子键保留、字段清空删键、布尔写回语义、`userland-proxy` 三态、校验表、备份/写回/校验失败不写盘、重启命令与等待的注入式测试。
- TUI 回归 `internal/tui/modules/docker/docker_daemon_test.go` 覆盖：菜单与关注目录、读取解析、解析失败原文页、字段编辑与校验、TLS 字段显隐、枚举下拉、保存校验拦截、保存成功进入重启确认、平台不支持重启、重启执行视图与完成返回、原始 JSON 弹框、帮助栏声明、面包屑节点与面包屑返回、关注跳转；整页滚动模式另覆盖全部区块完整渲染且不重复、焦点移动到首尾时自动滚动、贴底字段说明始终可见、操作区块不常驻首屏、编辑光标在视口内以及窄终端不超宽。
