# 文件中转与 Shell 别名

文件中转复用 `ru export` 将 Linux 上仅 root 可读的文件或目录复制到普通登录用户的 `~/xftp`，便于 Xftp/SFTP 下载。目标用户优先取 `SUDO_USER`，其次取终端登录用户；无法识别普通用户时拒绝执行。目标重名不会覆盖，移动模式须另行确认，复制成功且源路径复核通过后才移入废纸篓。

```bash
sudo ru export /root/test.log
sudo ru export /var/log/nginx/access.log --dir logs --name access.log
sudo ru export /root/archive --move --confirm-move
```

## 注册快捷别名

Unix 安装脚本在 Linux 服务器交互安装完成后询问是否注册快捷别名，默认不注册；选择注册后可填写名称，留空使用 `xftp`，也可输入 `rxu`。SSH 会话或没有 `DISPLAY` / `WAYLAND_DISPLAY` 的 Linux 会话视为服务器，WSL 和本地桌面不自动询问；非交互安装不修改 Shell 配置。安装器调用安装后的 `~/.local/share/ru/ru export register-alias`，避免别名指向发布包临时目录。注册失败只提醒，不撤销已完成的 ru 安装。

安装器用 `id -u` 判断当前权限；root 会话再核对 `SUDO_USER` 对应账号的非零 UID 是否与 `SUDO_UID` 相符，匹配后才报告 sudo 发起用户。普通用户会看到使用实际安装路径的 sudo 提权命令；直接 root 或无法核对 sudo 发起用户时提醒：实际中转仍需识别普通接收用户，无法识别时拒绝执行。安装与别名配置使用当前 `HOME`，不会自动写入 sudo 发起用户的配置。脚本自身不能加载父 Shell，注册结果给出加载命令；需要立即使用可进入下面的 TUI 注册功能。

安装时跳过注册后，可随时通过脚本手动注册，无需重新安装 ru：

```bash
sh ./install.sh --register-alias                         # 交互确认并填写别名
sh ./install.sh --register-alias rxu                     # 确认注册 rxu
sh ./install.sh --register-alias rxu /opt/ru/ru           # 指定已安装 ru 的绝对路径
RU_INTERACTIVE=false sh ./install.sh --register-alias rxu # 明确指定别名后非交互注册
```

手动模式仅适用于 Linux，可在本地桌面显式执行，不依赖服务器自动询问；默认使用 `~/.local/share/ru/ru`，自定义路径须是已有可执行文件的绝对路径。它只复用程序的别名注册，不下载、不解压、不替换 ru，也不创建安装临时目录。交互时可取消；非交互时必须明确提供别名；注册失败返回非零状态，既有同名冲突仍由软件拒绝覆盖。该模式同样展示当前用户和 root/sudo 信息，实际中转仍受程序的平台与权限检查约束。

在 TUI 中进入“文件中转 → 注册 CLI 别名”，填写别名（默认 `xftp`）。“立即使用”默认开启：确认注册后，Bubble Tea 暂停 TUI，并进入读取对应配置的交互式 Bash/Zsh，别名在这个终端中可直接使用；输入 `exit` 返回原确认页。关闭“立即使用”时仅注册，并显示加载方式。确认页展示 Shell、配置路径、CLI 命令、生效方式、当前终端加载命令与验证命令，明确别名不会自动提权。非 Linux 的开发界面预览不写入配置，也不会启动交互式终端。

立即使用通过交互式子 Shell 完成，不生成额外快捷脚本，也不修改原父 Shell 的别名状态。Bash 显式读取注册目标 `.bashrc`；Zsh 使用注册配置目录作为 `ZDOTDIR`。退出子 Shell 后，原终端仍需加载自己的配置。终端启动失败时保留已注册的别名，并提示手动加载；终端退出或失败均返回注册功能的确认页。

普通用户进入文件中转参数页时会立即看到权限提醒和使用实际 ru 路径的提权命令；权限不足时不允许编辑或确认执行，但仍可注册别名。CLI 在检查源路径和参数前提示提升权限，即使未传源路径也能得到明确说明。

别名字段使用公共内联编辑器；编辑态支持文字输入、退格、Delete、光标移动和首尾定位，连续删除可清空草稿。取消编辑保留原值，保存后确认页使用新别名；具体操作键显示在底部帮助栏。

文件中转和 CLI 别名的参数页末尾均有“确认参数”按钮。用上下键选择按钮后，按 `Enter` 检查参数并进入确认页，随后仍需在确认页确认执行。字段上 `Enter` 继续用于编辑或切换，按钮不会进入文本编辑器；选择第一项时向上也能直接定位末尾按钮。`F2` 或 `r s` 保留为进入确认页的快捷方式。编辑字段时先保存或取消草稿，再确认参数；编辑期间这两个快捷键不会提交表单。

真实 `Ctrl+S` 可能被 SSH 客户端截获，或者被当作 XOFF 软件流控的暂停输出指令，因此 TUI 不再把它作为按键入口：进入确认页使用 `r s`（先按 `r` 再按 `s`），也可使用界面中的确认按钮或 `F2`（部分键盘需要 `Fn+F2`）。ru 启动后通过 Bubble Tea 的原始终端模式关闭服务端输入的软件流控，但无法接收客户端已经拦截的按键。若终端输出已被流控暂停，可尝试 `Ctrl+Q` 恢复；这一步由终端处理，不表示 ru 已收到保存指令。

CLI 提供同一能力：

```bash
ru export register-alias
ru export register-alias --name ruexport
```

需要在当前父 Shell 一次完成注册与生效时使用：

```bash
ru_alias_definition=$(ru export register-alias --name rxu --shell-code) && eval "$ru_alias_definition"
rxu /root/test.log
```

`--shell-code` 注册后只向 stdout 输出经过转义的别名定义，状态说明和提权提醒写入 stderr。注册失败时 stdout 保持为空，上述命令的 `&&` 保证不加载失败结果。软件确认页同时提供使用实际 ru 路径的完整命令，避免当前 `PATH` 未包含 ru。这个模式只输出软件生成的别名定义，不输出配置文件中的其他内容。

优先识别直接启动 ru 的父进程为 Bash/Zsh 的情况，否则使用 `SHELL` 环境变量。Bash 写入当前用户的 `~/.bashrc`；Zsh 写入 `${ZDOTDIR:-$HOME}/.zshrc`。不支持其他 Shell 时明确报错。注册针对当前会话用户，root 会话对应 root 的配置，不使用导出文件的接收用户 `SUDO_USER`。

别名指向执行注册时的 ru 可执行文件绝对路径，复用 `export` 子命令并保留调用参数。路径中的空格、单引号和 Shell 特殊字符会转义。注册只追加配置，保留原有内容、权限及配置符号链接；完全相同的定义不重复追加，已发现同名别名或函数时拒绝覆盖。更换 ru 安装路径后，需要修改原别名定义。

## 生效与调用

别名写入配置不等于当前终端已经加载。ru 是 Shell 的子进程，无法修改父 Shell 的别名状态；新交互式终端加载对应配置后生效，当前终端须在退出 ru 后执行确认页或 CLI 输出中的加载命令，例如：

```bash
source ~/.bashrc
# Zsh 使用实际 ZDOTDIR 对应的 .zshrc
source ~/.zshrc

xftp /root/test.log
xftp /root/archive --dir logs --name archive
```

别名不会自动执行 sudo；导出仍须在 Linux root 会话运行。Shell 别名不能作为 `sudo xftp` 的可执行文件参数，sudo 的搜索路径也可能不包含普通用户的 `~/.local/bin`，因此普通用户直接导出时优先使用实际 ru 路径，例如 `sudo "$HOME/.local/share/ru/ru" export /root/test.log`；需要重新打开工作台时使用 `sudo "$HOME/.local/share/ru/ru"`。提权应从接收文件的普通登录用户会话执行，以保留接收用户信息。

出现 `Command 'rxu' not found` 表示当前 Shell 尚未加载别名或当前用户配置中没有这个别名，还没有执行 ru。Bash 可执行 `source ~/.bashrc` 后用 `alias rxu` 验证；Zsh 使用实际 `.zshrc` 路径。root 和普通用户的配置彼此独立，需在实际调用别名的用户会话中注册并加载。

如配置由 chezmoi 管理，注册会修改当前实际配置文件，需自行将这行别名同步回对应配置源，避免后续应用配置时被覆盖。

正式文档入口：[docs/README.md](README.md)。
