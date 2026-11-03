# 工具模块

工具模块首个功能是生成随机密码，可从 TUI「工具」中选择 Base64、十六进制或字母数字格式，也可在脚本中使用 `ru tools password`。

```bash
ru tools password
ru tools password --bytes 32
ru tools password --format hex --bytes 16
ru tools password --format alnum --length 24
```

`--format`（`-f`）可选 `base64`、`hex`、`alnum`，默认 `base64`。程序使用系统加密安全随机源：

| 格式 | 参数 | 输出 |
|------|------|------|
| `base64` | `--bytes`（`-b`），默认 12 | 标准 Base64，对应 `openssl rand -base64 N`；可能包含 `+`、`/`、`=` |
| `hex` | `--bytes`（`-b`），默认 16 | 小写十六进制，对应 `openssl rand -hex N` |
| `alnum` | `--length`（`-l`），默认 24 | 固定长度的大小写字母和数字；用拒绝采样避免取模偏差，也避免简单过滤后字符数不足 |

随机字节数或字符数范围均为 1～4096。12 字节的 Base64 长度为 16 个字符；32 字节编码后为 44 个字符（末尾带 `=` 填充）。

CLI 仅把生成值写入标准输出，便于脚本接收。TUI 在结果表格中完整显示生成值，并可重新生成。每次生成都会重新读取安全随机源；该功能不写入配置或凭证文件。
