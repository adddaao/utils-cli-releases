# 终端一致性：lazygit / lazydocker 源码对照

## 对照范围

核对日期：2026-10-26。以下结论来自固定提交的源码，不把演示截图当作终端兼容性证明。

| 项目 | 固定提交 | 绘制后端 |
| --- | --- | --- |
| lazygit | `4e1eebe278790f257a875da6633234391a5a85b3` | 仓库内 gocui 与 tcell v3 |
| lazydocker | `7e7aadc2071d58031bf2daafca1fbd4093efc23f` | gocui 与 tcell v2 |

## 可以借鉴的实现

| 方面 | 源码事实 | 本项目采用方式 |
| --- | --- | --- |
| 终端能力 | tcell 根据终端声明、环境与能力信息决定颜色输出；支持把 RGB 转为可用调色板颜色。业务入口的 `OutputTrue` 不代表底层无条件发送 RGB。 | 工作台使用 256 色作为兼容基线；不把 `TERM=xterm` 且无 `COLORTERM` 当成已启用真彩色。 |
| 单元格样式 | gocui 把文字、前景、背景、字体属性转换为单元格样式；tcell 在样式改变时维护或重置终端状态。 | 保留 Bubble Tea / Ultraviolet 的单元格差量刷新，验证输出回放后的颜色和属性，避免只检查字符串或有没有某个 SGR。 |
| 语义主题 | 默认正文、选中行、边框和帮助分别配置。lazydocker 初始化普通视图为默认前景色；lazygit 按明暗背景合并主题。 | 普通正文、快捷键和选中行保持分工，不能让选中或快捷键颜色延续到正文与说明。用户要求固定底色，所以不照搬其跟随终端背景的默认策略。 |
| 尺寸布局 | 两者根据当前屏幕字符列数、行数统一计算窗口位置；lazydocker 使用 boxlayout 权重和条件区域分配空间。 | Shell 统一分配尺寸；清单保持紧凑单行，摘要按需显示；缩放、筛选、分页及鼠标使用同一布局。 |
| 字体边界 | 后端可处理字符宽度、替代边框和视口，字体及终端对粗体的呈现仍受客户端控制。 | 验证中文、emoji 与边框的单元格坐标，不承诺不同客户端的字体像素完全一致。 |

## 当前 Xshell 问题与修正

用户报告环境为 Xshell 8.0.0026、`TERM=xterm`、`COLORTERM` 为空。Xshell 8 官方手册的“高级设置”列有独立的“Use true color”选项；仅根据软件版本和 `TERM`，不能证明此选项已经启用。

此前全屏入口无条件指定 TrueColor，最终视图再铺 RGB 黑底与 RGB 灰字。客户端不接受 RGB 时，这些颜色设置可能被忽略；此前只检查“输出中有 RGB 黑底指令”的测试不能证明最终显示正确。该路径存在明确的能力适配缺陷；它与用户截图的因果关系仍需 Xshell 实机输出验证，不能仅凭标准终端回放宣称已经复现该客户端。

本次保留用户要求的黑底和原有强调色，使用扩展调色板 **16（黑）** 与 **252（浅灰）**，通过 `48;5;16` / `38;5;252` 输出，不使用客户端可重新配置的基础色 0–15，也不依赖真彩色开关。全屏入口默认指定 `colorprofile.ANSI256`；框架在获得明确 RGB 能力回复后仍可升级，固定工作台颜色本身继续使用索引色。支持的兼容基线是 256 色终端，不能把这解释为对仅支持 8/16 色终端的同色保证。

## 回归要求

- 运行 `make test-tui`，覆盖组件、真实程序输出和独立 VT 回放。
- `fullscreen_program_test.go` 模拟客户端忽略 RGB 参数，验证 `TERM=xterm`、`xterm-256color`、带 `COLORTERM=truecolor` 三种环境中的固定黑底、浅灰正文、快捷键和选中行颜色；聚焦与重复尺寸消息不额外清屏。该能力模拟不是 Xshell 仿真器。
- `simple_mapping_replay_test.go` 对真实 Shell 与映射控制器的连续输出逐格比较文字、背景、可见文字前景、字体属性和下划线，覆盖页面切换、搜索、表单和缩放。
- Xshell 实机验收须使用新构建，确认普通行、表头、快捷键说明不串色，背景不再沿用客户端浅色主题；发现差异时核对真实输出和构建身份，不继续凭预览图改主题。

## 主要源码与官方资料

- [lazygit：gocui 到 tcell 的单元格样式转换](https://github.com/jesseduffield/lazygit/blob/4e1eebe278790f257a875da6633234391a5a85b3/pkg/gocui/tcell_driver.go)
- [lazygit：主题合并与明暗背景](https://github.com/jesseduffield/lazygit/blob/4e1eebe278790f257a875da6633234391a5a85b3/pkg/config/theme_config.go)
- [lazygit：tcell 颜色能力处理](https://github.com/jesseduffield/lazygit/blob/4e1eebe278790f257a875da6633234391a5a85b3/vendor/github.com/gdamore/tcell/v3/tscreen.go)
- [lazydocker：视图与选中行配色](https://github.com/jesseduffield/lazydocker/blob/7e7aadc2071d58031bf2daafca1fbd4093efc23f/pkg/gui/views.go)
- [lazydocker：tcell 的颜色降级和样式重置](https://github.com/jesseduffield/lazydocker/blob/7e7aadc2071d58031bf2daafca1fbd4093efc23f/vendor/github.com/gdamore/tcell/v2/tscreen.go)
- [lazydocker：按屏幕尺寸和权重布局](https://github.com/jesseduffield/lazydocker/blob/7e7aadc2071d58031bf2daafca1fbd4093efc23f/pkg/gui/arrangement.go)
- [Xshell 8 官方手册：11.8 Advanced Settings（第 54 页）](https://www.netsarang.com/docs/Xshell8_manual.pdf#page=54)
