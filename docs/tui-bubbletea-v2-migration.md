# Bubble Tea v2 迁移与真实光标（IME）接入

本文记录 TUI 从 Charm v1 迁移到 v2 的结论、坐标契约和验收状态，供后续模块接入与回归参考。正式按键契约仍以 [TUI 按键规范](tui-keybindings.md) 为准，公共组件接入规则见 [TUI 公共组件开发基线](tui-public-component-development-baseline.md)。

## 1. 目标与背景

Bubble Tea v1 的渲染器只能显示/隐藏终端光标，不能定位；全屏 TUI 里真实光标一直隐藏并停在帧末尾，中文等输入法的预编辑串与候选框因此跑到屏幕角落，编辑中文很困难。

v2 的 `tea.View` 可以声明真实终端光标（`View.Cursor`）。迁移到 v2 后，输入类组件把光标位置沿布局链逐层换算到终端绝对坐标，输入法候选框跟随实际编辑位置。

固定依赖：`charm.land/bubbletea/v2 v2.1.0`、`charm.land/bubbles/v2 v2.2.1`、`charm.land/lipgloss/v2 v2.0.6`。

## 2. 已完成的迁移

| 项目 | 迁移方式 |
|---|---|
| 视图 | 所有 `tea.Model` 的 `View() string` 改为 `View() tea.View`；纯展示辅助函数保留字符串 |
| 终端属性 | `AltScreen`、`MouseMode` 只在 `internal/tui/shell` 的顶层 `View()` 声明，模块不得设置 |
| 按键 | 分发只处理 `tea.KeyPressMsg`；`Type`→`Code`、`Runes`→`Text`、`Alt`→`Mod`；空格按键 `String()` 由 `" "` 变为 `"space"` |
| 粘贴 | `tea.PasteMsg` 由 Shell 统一路由：可见弹框 → 输入接收者 → 模块 `Update` 兜底；内容只作为文本插入，不会触发快捷键 |
| 鼠标 | `Click/Release/Wheel/Motion` 具体消息 + 公共 `components/mouse`（`Rect`、`Localize`、`Shift`、`Point`、`IsWheel/WheelUp/WheelDown/IsLeftClick`） |
| 输入接口 | `shell.InputReceiverProvider.HandleInput(tea.Msg)`、`shell.ModalProvider.HandleModalKey(tea.Msg)`、`input.Registry.Dispatch(tea.Msg)` |
| 组件 API | viewport/textinput/list/progress 的构造、宽高、样式、KeyMap 全部切到 v2 形式；`list.DefaultStyles(true)` 暂时固定暗色，后续由 Shell 背景色消息统一下发 |
| 尺寸语义 | lipgloss v2 的 `Width/Height` 含边框与内边距；需要“内容尺寸”语义时统一用 `theme.FitPanel(style, w, h)`，避免面板比父容器窄一圈 |
| 测试断言 | v2 的 `Style.Render` 始终输出全保真 ANSI（且 `Underline` 逐字符下发 SGR），可见文案断言统一先 `ansi.Strip` |

## 3. 真实光标坐标契约

坐标系是从视图内容左上角开始、以终端显示单元为准的 0 基坐标。

- 输入组件（`form.InlineEditor`、`form.TextInputView`）返回含真实光标的 `tea.View`；光标位置按字段实际显示窗口计算，覆盖中文/宽字符、横向滚动与密码掩码。
- `form.RenderParameterFormFieldsLayout` 等表单渲染函数在渲染时把光标暂存到 `view.Record`，模块在 `View()` 里用 `view.Take()` 取回并附加到自己的视图。
- `view.Stack(parts...)` 垂直组合多个视图时按上方各块的换行数平移光标；`view.Shift` 只做平移，`view.HideCursor` 隐藏光标。
- `unified.UnifiedPageModel.View()` 负责换算详情态：光标行 = 内容行 − `viewport.YOffset()` + 头部高度；滚出视口时光标隐藏。
- `shell.MainLayoutModel.View()` 负责换算终端坐标：内容区原点 + 内容视口滚动偏移，并叠加 `DocStyle` 外边距；弹框可见、导航区聚焦、窗口小于最小尺寸、光标越出内容区时一律隐藏。
- 只有当前焦点决定唯一光标：可见弹框优先且背景光标隐藏；非编辑状态不声明光标。

## 4. 覆盖的输入入口

| 入口 | 状态 |
|---|---|
| 参数表单（全部 8 个业务模块） | 已完成：编辑字段返回真实光标 |
| 统一输入页（`UnifiedPageModel.StateInput`） | 已完成 |
| 路径选择（`path.Selector`） | 复用参数表单，已接入 |
| Find 条件编辑器 | 已完成：自管表格按列宽、可见行窗口和输入框横向滚动换算光标（`ConditionEditor.Cursor`），模块 `View` 单独附加，不再只取内容 |
| Docker 运行参数自管编辑器 | 已改为真实光标（`renderRuntimeUpdateInputValue`） |
| 列表筛选（导航栏、各模块内容列表） | 已完成：关闭 Bubbles list 筛选框的虚拟光标，`FilterInput.Cursor` 位置经统一页面上报 |
| 弹框搜索框 | 已完成：`ModalListModel.FilterCursor` + Shell 叠加覆盖层原点 |
| 日志筛选 | 已完成：`logviewer.FilterCursor` + Docker 模块叠加日志页前缀高度 |

清理工具等“统一页面 + 参数表单”的模块必须整体返回 `UnifiedPageModel.View()`，只取 `.Content` 会丢掉统一页面保存的光标，输入法候选框会退回屏幕角落；该项已修复并有回归覆盖。

## 4.1 输入法开启时的按键行为

- 输入法在应用之前处理按键。中文模式下按 `s`、`j`、`k`、`q` 或数字不会到达 TUI，而是进入拼音组合与候选框，因此菜单快捷键需要英文输入；这不是 TUI 丢按键。
- 应用侧能做的是处理**提交结果**：Shell 在文本编辑态之后把单字符全角 ASCII（`１`、`ｓ`、全角空格等）归一化成半角，再进行快捷键匹配与编号定位；非编辑态收到中文或多字符文本时直接丢弃，不进入快捷键、编号缓冲或模块状态机。
- 输入法组合开始前偶尔会有一个字母先到达应用；非编辑态未声明的单字母会被静默忽略（不再出现“只允许输入数字编号”提示），随后提交的多字符英文或中文同样被丢弃。快速连续到达的字母（间隔小于约 180ms）整段忽略，直到静默约 350ms，避免输入法打字触发多个单字母快捷键；已声明的单字母动作延迟约 120ms 判定，期间又收到字母就整段丢弃（第一个字母也不执行），没有后续字母时才执行；`j/k` 导航键始终立即执行。声明为“连续两下确认”的字母（例如帮助栏声明的 `dd` 删除）第一次按键立即下发，同字母第二次也不会被防抖吞掉，由模块判定待确认状态（不设自动超时，会一直保留到下一次按键）；中间夹有其他字母的拼音串仍整段忽略。该判定只在交互式终端启用。
- 输入法提交的**汉字**在菜单、列表等非编辑态不会触发动作，Shell 会在右下信息展示区提示“中文输入法会拦截菜单快捷键，请切换到英文输入”。提示有冷却时间，任意键或鼠标事件关闭。提交的 **ASCII 字母**按普通按键处理（例如 `s` 会触发标星）。
- 筛选态（`/`）、弹框搜索、参数表单、路径与条件编辑器等文本入口会正常接收提交的中文，并因为真实光标而让候选框跟随编辑位置；这些入口的全角字符保持用户输入原样。
- 菜单等非编辑态按设计不声明硬件光标，输入法候选框会出现在终端当前光标位置（通常是屏幕角落）；只有文本编辑态才有可跟随的编辑光标。
- 编号定位只认归一化后的 ASCII 数字：连续输入多位数时优先匹配完整编号（例如列表有 12 项时的 `12`），匹配不到则退回最后一位有效数字并显示提示；定位后仍需 `Enter` 才会执行。输入法候选选择消耗的数字不会进入应用。

## 5. 验证与验收

自动回归：

- `make test-tui`：公共组件、unified、shell 与 8 个业务模块全部通过（等价于运行全部 `internal/tui/...` 回归；项目测试统一走 `make`）。
- 新增回归：`components/view`（拼接/平移/记录消费）、`components/form`（表单光标行与值列位置、密码掩码光标、输入窗口）、`shell`（内容光标与导航筛选光标 → 终端坐标、弹框/最小尺寸隐藏）、`unified`（输入页与列表筛选光标、中文筛选词列宽）、`logviewer`（筛选光标与粘贴）、`clean`（路径编辑态 `View` 保留光标）、`find`（条件编辑器值列光标与可见行窗口、模块 `View` 附加光标）。
- 终端字节级验证：在 pty 里驱动真实 TUI，确认参数表单、清理路径、Find 条件编辑器编辑态都会输出“移动光标 + 显示光标”（`CSI row;col H` + `DECSET 25`），且光标列随输入推进；列表/弹框等非编辑态不输出显示光标。

人工验收（必须在本机 iTerm2 + 系统拼音完成，自动测试无法覆盖）：

1. 打开任一参数表单，进入字段编辑，连续输入拼音：候选框应贴在编辑位置，而不是屏幕角落。
2. 中间插入、候选选择、取消组合：光标与文本位置保持一致。
3. 列表筛选、弹框搜索与日志筛选：候选框应跟随筛选输入位置，退出筛选后光标隐藏。
4. 清理工具路径输入、Find 条件编辑器值列：候选框应跟随实际编辑单元格。
5. 缩放窗口、弹框打开、切回导航栏：光标隐藏或重新定位，不出现残影。

交叉编译只代表构建通过：Windows/Linux 的真实终端与输入法行为列为后续验证项。

## 6. 遗留项

1. `list.DefaultStyles(true)` 固定暗色：后续在 Shell 通过 `tea.RequestBackgroundColor` / `BackgroundColorMsg` 统一下发 `isDark`，模块不得自行探测终端。执行视图的状态徽章同样改为固定暗色（不再使用 `lipgloss/v2/compat.AdaptiveColor`，该包 init 会查询终端背景色并阻塞启动），背景色自适应随同一次改造统一下发。
2. lipgloss v2 尺寸语义补偿只覆盖了 Shell 面板、表单子页面、notice/logviewer 等已知位置；新增带边框且需要“内容尺寸”语义的布局必须使用 `theme.FitPanel` 并补尺寸回归。
3. 真实终端输入法人工验收（第 5 节）尚未完成：SSH/tmux、Windows/Linux 输入法差异也需逐项确认；pty 字节级验证只能证明光标序列正确，不能替代系统拼音候选框的人工检查。
