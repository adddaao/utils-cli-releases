# 防火墙管理

正式技术文档入口：[docs/README.md](README.md)。

## 平台与权限

| 平台 | 后端 | 入口与权限 |
|------|------|------------|
| 原生 Linux | firewalld、ufw、iptables，按此顺序检测 | 已安装受支持工具时显示；CLI 需要 root |
| Windows | Windows Defender Firewall 的官方 NetSecurity PowerShell 接口 | 系统 Windows PowerShell 可用时显示；查询不强制提权，写入要求管理员终端 |
| macOS | 不提供 | TUI 隐藏导航并不注册内容模块，CLI 明确拒绝，不再自动选用 PF |
| WSL | 不提供 | 防火墙入口隐藏，不跨越 WSL 修改宿主 Windows 策略 |

Windows 后端使用系统自带的 `powershell -NoProfile -NonInteractive -EncodedCommand` 调用 `NetSecurity`，不依赖第三方防火墙工具，也不使用 `netsh` 文本解析。请求以 JSON/Base64 传递，脚本使用 UTF-16LE 编码，输出使用 UTF-8 JSON；端口输入不参与脚本拼接。每次调用限时 60 秒。

## Windows 规则契约

- 仅配置本机 `PersistentStore` 的 TCP 入站放行规则，每个端口一条，网络范围固定为 `Domain,Private`，不放行公用网络。
- 规则名称固定为 `ru-tcp-in-<端口>`，组固定为 `ru.firewall.v1`，描述使用固定归属标记；不随应用名称配置变化。
- `open` 创建或重新启用 ru 规则，重复调用不新增重名规则。已有同名规则不符合 ru 归属、方向、动作、网络、协议或端口契约时拒绝覆盖。
- `close` 禁用对应 ru 规则，规则不存在或已经禁用时可重复执行；不会创建强制阻断规则，也不会修改系统、应用、组织策略或其他工具的规则。
- 不自动开启、关闭、重置或重新加载系统防火墙。域/专用配置的防火墙未启用或组织策略明确禁止本机规则时，`open` 报错。
- 写入后重新查询 `PersistentStore` 校验；放行还检查 `ActiveStore` 中合并后的规则。组织策略限制、权限不足、服务或模块不可用、命令失败、JSON 不完整均向调用方返回错误，不伪装成成功或空规则。
- `list` 展示三个网络配置文件的防火墙开关，以及 ru 持久规则的端口、范围、启用状态、合并策略是否存在启用规则。空结果只表示没有 ru 规则，不表示系统没有防火墙规则。

“规则已配置”不等于“端口可连接”：当前连接可能使用公用网络；服务可能未监听，或另有阻断规则、上游设备、组织策略影响流量。同样，“撤销 ru 放行”不等于“端口已被阻断”。

## 使用

```powershell
# Windows 写操作：以管理员身份打开终端
ru firewall open -p 80,443,8080
ru firewall list
ru firewall close -p 8080
```

CLI 用逗号或重复的 `-p` 传入多个端口，TUI 输入页用空格分隔。仅支持独立整数 TCP 端口 `1–65535`，暂不支持 UDP、端口区间或自选网络范围；先校验整批输入，再执行操作。Windows CLI 批次会先检查全部同名规则冲突；TUI 按端口执行并逐项显示进度和日志。运行失败或超时时可能部分完成，必须重新查询后处理，工具不会自动回滚已经完成的规则。

TUI 查询先建立规则详情页，再覆盖公共加载弹框；完成后展示可滚动表格。实际规则更新使用公共执行视图展示任务、端口、状态、进度和日志；结果留在执行视图中，返回回到防火墙功能菜单。取消查询后丢弃迟到结果；运行中的规则写入不提供取消按钮。

## 验证

- `make test`：平台门控、端口校验、编码与错误传播、规则快照、CLI 输出、TUI 查询/执行/返回和帮助按键。
- `make build-windows`：Windows amd64 交叉编译并打包完整运行目录（`build/release/windows/amd64/ru.exe`）。
- Windows 真实系统验收：先在测试机管理员终端查询；创建未占用的测试端口规则，重复创建确认仅一条；核对方向、协议、网络范围；撤销后确认 ru 规则禁用且其他规则不变。另在普通终端尝试写入，确认失败；组织策略环境检查规则合并限制和错误反馈。

跨平台单元测试和交叉编译不能替代 Windows 实机、管理员权限、NetSecurity 模块及组织策略验收。

## 微软官方接口

- [New-NetFirewallRule](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule)
- [Get-NetFirewallRule](https://learn.microsoft.com/en-us/powershell/module/netsecurity/get-netfirewallrule)
- [Set-NetFirewallRule](https://learn.microsoft.com/en-us/powershell/module/netsecurity/set-netfirewallrule)
- [Get-NetFirewallPortFilter](https://learn.microsoft.com/en-us/powershell/module/netsecurity/get-netfirewallportfilter)
- [Get-NetFirewallProfile](https://learn.microsoft.com/en-us/powershell/module/netsecurity/get-netfirewallprofile)
