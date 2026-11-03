# TUI Shell 与布局开发基线

> 本文档只定义 TUI 应用壳、工作台布局、尺寸传递、焦点与事件路由，以及公共组件所使用的布局参数。公共组件职责与 API 见 [公共组件开发基线](tui-public-component-development-baseline.md)。

## 1. 职责边界

Shell 负责模块注册、窗口尺寸、导航和内容焦点、面包屑、帮助栏、弹框覆盖与跨模块服务编排。模块负责自己的状态机和业务服务调用。公共组件只接收模块已经分配好的内容区尺寸，不能读取终端总尺寸、更改 Shell 焦点或调用业务服务。

~~~text
终端窗口
  → LayoutManager
  → MainLayoutModel
  ├─ NavigationModel
  ├─ BreadcrumbModel
  ├─ ContentAreaModel → 当前模块
  └─ HelpBarModel
                    ↓
          表格 / 表单 / 弹框 / 执行视图 / 日志查看器
~~~

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| shell | 模块注册、尺寸、焦点、路由、面包屑、帮助栏、弹框覆盖。 | 模块私有流程和业务服务分支。 |
| module | 状态机、服务调用、把组件输入输出转换为业务状态。 | 工作台分栏、终端总尺寸、全局按键抢占。 |
| component | 局部渲染、最小尺寸收敛、内部滚动与字段/列表交互。 | Shell 状态或业务服务调用。 |

## 2. Shell 公共接口与模块契约

### 2.1 Shell API 索引

| 文件 | 主要公开 API | 用途 |
| --- | --- | --- |
| shell/app.go | StartWithNewLayout、StartWithNewLayoutWithOptions | 创建 ServiceRegistry 并启动 Bubble Tea。 |
| shell/main_layout.go | MainLayoutModel、NewMainLayoutModel | 根模型：布局、焦点、弹框、帮助栏和面包屑编排。 |
| shell/content_area.go | ContentAreaModel、ContentComponent、SwitchComponentMsg | 模块容器、尺寸转发和当前组件切换。 |
| shell/navigation.go | NavigationModel、MenuItem、NavigationConfirmMsg | 左侧模块导航。 |
| shell/breadcrumb.go、breadcrumb_flows.go | BreadcrumbModel、BreadcrumbItem、BreadcrumbFlowState、BuildBreadcrumbFlow 系列 | 流程面包屑与窄宽度收折。 |
| shell/help_bar.go | HelpBarModel、HelpItem | 底部帮助栏。 |
| shell/content_area.go | HelpBinding、NewHelpBinding、HiddenHelpBinding、VisibleHelpBindingItems、HelpBindingsAllowKey | 将按键显示与生效绑定为同一声明。 |
| shell/page_navigation.go、unified/model.go | PageNavigationHelpBindings、WithPageNavigationBindings、NavigationMode | 列表/详情/输入模式的公共导航键统一声明并授权。 |
| shell/layout.go | LayoutManager、Dimensions、LayoutAreas、Rect | 保存真实窗口尺寸、最小窗口判断和基础矩形计算。 |
| shell/module_registry.go | RegisterContentModule、NewRegisteredContentModule、ContentModuleFactory | 模块工厂登记与创建。 |
| shell/service_registry.go | ServiceRegistry、服务 ID、RuntimeOptions | 应用服务、消息总线、DI 容器和开发期选项。 |
| shell/keys.go | ListKeyConfig、DefaultSingleSelect、DefaultMultiSelect、DefaultMenu | Bubble list 原生键位配置。 |
| shell/messages.go | Clean、Docker、Find 的 Progress/Complete 消息和 ErrorMessage | 既有消息总线适配类型。 |

### 2.2 必须与可选模块接口

每个模块必须实现 ContentComponent：Bubble Tea 的 tea.Model 加上 GetHelpBindings() []HelpBinding。

| 接口 | 方法 | Shell 使用方式 | 模块必须保证 |
| --- | --- | --- | --- |
| ContentComponent | Init、Update、View、GetHelpBindings | ContentArea 保存并转发 tea.Msg。 | View 只返回字符串，不直接终端输出。 |
| BreadcrumbFlowProvider | GetBreadcrumbFlow() BreadcrumbFlowState | 优先构造流程面包屑。 | 返回真实菜单父级、当前节点和后续节点，名称与对应菜单一致。 |
| BreadcrumbProvider | GetBreadcrumbItems(label) | 流程接口未实现时回退。 | 不用当前任务、结果等泛化占位。 |
| RootStateProvider | IsAtRoot() bool | 决定内容区 `←/→` 是否转移焦点、导航焦点下 `q` 是否交回模块与帮助栏条目。 | 只有模块根状态为 true。 |
| PendingInputProvider | GetPendingInputLine() string | 将编号等未确认输入显示在帮助栏上方。 | 返回当前待确认输入，不在内容区提示。 |
| ModalProvider | GetModal、HandleModalKey | 有弹框时键盘优先路由给弹框。 | 弹框关闭时恢复来源状态，不回模块根。 |
| InputReceiverProvider | HandleInput(KeyMsg) | 在模块状态机前将按键交给最高优先级的已启用接收者。 | 多个输入态通过 `components/input.Registry` 注册并声明优先级；返回 false 时才继续状态机。 |
| 焦点能力 | SetFocus、HasFocus | ContentArea 切换模块/焦点时同步。 | 紧凑菜单失焦必须灰色且没有选中前缀。 |

新模块在 init 中通过 RegisterContentModule 登记工厂。模块从传入的 ServiceRegistry 解析自己的服务，不创建平行容器；新跨模块异步能力优先使用应用服务事件，不滥用既有 Clean/Docker/Find 消息类型。

## 2.3 三栏布局与信息展示区

工作台固定为三栏：左侧导航、右上主窗口、右下信息展示区，底部再放帮助栏。

- 三块独立面板：左导航、右上主窗口、右下信息展示区。右侧两块面板左右边框严格对齐、共用同一份内部宽度；导航与右侧两块面板底边对齐，帮助栏横跨整个可用宽度。
- 导航与右侧面板之间保留 1 列空白。主窗口与信息区、工作区与帮助栏不再额外插入空白行；各区域保留独立边框，两条边框相邻但不重叠。
- 左侧导航宽度沿用 `theme.CalculateNavWidth`；右侧主窗口与信息展示区共用同一份内部宽度，帮助栏横跨整个可用宽度。
- 信息展示区由公共 `components/infopanel` 提供能力，Shell 负责放置：内容行数决定高度，最多占右侧栏可用高度 1/4；模块通过 `shell.InfoPanelVisibilityProvider.InfoPanelVisible()` 按当前页面主动决定显隐。
- 仅重复面包屑中的页面名称、普通的“服务可用”或“连接正常”时，模块返回 false，信息区整块隐藏，主窗口占满右侧栏；内容为空也会自动隐藏，不允许固定预留 1/4 高度或渲染“暂无信息”占位。
- 具体目标、异常、模式、执行结果等能补充主窗口的信息仍可显示。短反馈消息出现时，即使当前页通常隐藏信息区，也由 Shell 临时显示在信息区，反馈消失后再收起。
- 模块内容通过 `shell.InfoPanelProvider.InfoPanelContent()` 提供，页面名称用 `shell.InfoPanelPageLabel` 派生；Shell 在每次布局重算时读取最新内容，模块切换、页面切换和执行态变化都会自动刷新或隐藏。
- 一次性消息（成功、失败、标星结果）由公共 `operationstatus` 产出快照后显示在信息展示区，优先于模块信息，不覆盖主窗口。

## 3. 事件、焦点、帮助栏与弹框路由

~~~mermaid
sequenceDiagram
    participant U as 用户输入
    participant S as MainLayoutModel
    participant A as ContentAreaModel
    participant M as 模块
    participant C as 公共组件
    U->>S: KeyMsg / MouseMsg / WindowSizeMsg / 异步消息
    alt 内容焦点且存在弹框
        S->>M: HandleModalKey
        M->>C: ModalListModel.Update 或 UpdateMouse
    else 导航焦点
        S->>S: Navigation.Update / SwitchComponent
    else 内容焦点
        S->>A: Update(msg)
        A->>M: Update(msg)
        M->>C: 局部状态更新或 tea.Cmd
    end
    S->>S: 刷新焦点、面包屑、帮助栏
~~~

| 场景 | 固定路由规则 |
| --- | --- |
| Ctrl+C | Shell 强制退出，模块不可覆盖；是唯一保留的真实 Ctrl 组合键。 |
| r q | 先按 `r` 再按 `q`，Shell 返回导航栏；与内容区的 `q`、内容区（含模块根页）里的 `←/→`、单击左侧导航面板同为内容区返回主界面的入口。 |
| 真实 Ctrl+字母 | Shell 在最外层拦截并丢弃（`Ctrl+C` 除外），不再作为任何动作入口，模块不需要处理。 |
| Tab、Shift+Tab | 导航焦点时切到内容焦点；内容焦点时不切回导航焦点，只有显式 HelpBinding 注册时才转交模块。 |
| 左、右 | 多页列表页由 Shell 翻译成 `PgUp/PgDn` 整页翻动并在帮助栏追加 `←→ 翻页`（见下方列表翻页契约）；导航焦点时切到内容焦点；内容焦点时模块根页与二级子模块一致——模块未声明 `←/→` 时转移焦点回左侧主界面并在帮助栏追加 `←→ 返回导航栏`，模块声明了则原样转交。 |
| q | 内容焦点时逐级返回：模块声明了 `q` 就转交模块返回上一级，未声明（含模块根页）时 Shell 等同 `r q` 返回导航栏并在帮助栏显示；导航焦点时不退出程序，只在模块声明了 `q` 且不在模块根状态时交回模块返回当前流程，其余忽略。 |
| Esc/q | 仅当前状态的 HelpBinding 允许时转交模块；`q` 不再退出程序，退出程序统一由 `Ctrl+C` 承担。 |
| 键盘弹框 | 当前内容区有 ModalProvider.GetModal 时先交给 HandleModalKey，背景页面不能响应。 |
| 局部输入接收者 | 焦点区域的 InputReceiverProvider 在模块状态机和全局焦点快捷键前接收按键；当前最高优先级接收者唯一消费。 |
| 鼠标弹框 | 模块先调用 ModalListModel.UpdateMouse；返回 true 后必须停止向背景分发。 |
| 鼠标（导航面板） | 导航栏聚焦时点击定位并切换模块；内容区聚焦时左键单击把焦点交回主界面（模块选择）并把光标定位到命中行，第二下点击同一行才切换模块，滚轮不承担返回、内容区聚焦时忽略。 |
| 帮助栏 | 内容焦点由 VisibleHelpBindingItems 派生；未声明 `q` 时 Shell 追加 `q 返回导航栏`，`←/→` 未被模块或多页列表占用时追加 `←→ 返回导航栏`；导航焦点由 Shell 提供公共项。 |
| 页面导航键 | 列表/详情/输入模式的公共导航键由 `UnifiedPageModel.NavigationMode()` 描述，模块用 `shell.WithPageNavigationBindings` 并入 `GetHelpBindings`；模块已显式声明同类键时不重复追加。 |
| 未声明按键 | `HelpBindingsAllowKey` 只认可见声明；模块必须在状态机入口丢弃未声明的控制键（字符输入与编辑器内部按键除外），Shell 继续门控 `Tab/←→/Esc/q` 与 `r q` 等 `r` 前缀两键序列，其中内容区未声明的 `←/→` 由 Shell 转移焦点回主界面。 |
| 未确认编号 | PendingInputProvider 的文字显示在帮助栏上方，数字键只定位，不执行。 |

真实 `Ctrl+<字母>` 组合键由 Shell 在最外层拦截并丢弃（`Ctrl+C` 除外）。除 `Ctrl+C` 外不再使用任何 Ctrl 组合键，其余按键整体改为 `r` 前缀两键序列：在内容区先按小写 `r`，再按原字母（大小写精确）；当前前缀字母已声明单键动作时约 300ms 超时回退，否则持续等待下一键；底部帮助栏最后一行显示实际输入的 `r/R` 和等待状态；`Esc` 只取消前缀，其他非字母键取消前缀后仍按普通按键处理。完整规则见 [TUI 按键规范](tui-keybindings.md)。

内容弹框的标题块跳转是 Alt+↑/Alt+↓；模块必须在 GetHelpBindings 中注册后才转交。普通滚动为 ↑↓/k/j 和 PgUp/PgDn；左键不关闭弹框，滚轮由弹框消费。

### 列表翻页契约

内容区确实多于一页的列表页把 `←/→` 当上一页/下一页（等价 `PgUp/PgDn`），由 Shell 统一翻译并在帮助栏追加 `←→ 翻页`，模块不需要自己声明 `←/→`：

| 角色 | 契约 |
| --- | --- |
| 模块 | 实现 `shell.ListPageProvider` 的 `IsListPage() bool`，只在“当前内容区是可选列表页、列表真的存在上一页/下一页（`UnifiedPageModel.ListPageCount() > 1` 或等价页数判断）”时返回 true；同时保证该状态已声明 `PgUp/PgDn`。 |
| Shell | 满足“焦点在内容区、没有可见弹框、`IsListPage()` 为真、当前状态已声明 `PgUp/PgDn`、模块没有自己声明 `←/→`”时，把 `←` 翻译成 `PgUp`、`→` 翻译成 `PgDn` 后转交模块；未命中时 `←/→` 不下发给模块，改按焦点规则处理：模块根页与二级子模块一样转移焦点回左侧主界面。 |
| 帮助栏 | 翻译生效时由 Shell 追加 `←→ 翻页`；翻译未生效且模块没有自己声明 `←/→` 时，追加 `←→ 返回导航栏`（模块根页、单页列表、详情、表单都适用）；弹框可见时不追加。 |
| 模块自己占用 `←/→` | 表格横向滚动（`NewHorizontalTableLayout`）、表单字段移动、输入光标、排序方向等场景由模块显式声明 `←/→`，此时 Shell 不翻译、原样转发。 |

弹框列表的翻页仍使用弹框自己的 `PgUp/PgDn`；Shell 不在弹框可见时翻译 `←/→`。

### 备用屏终端输出契约

备用屏（AltScreen）只允许 Bubble Tea 渲染器写入。其他 goroutine 或业务函数直接写标准输出/标准错误会切断渲染器维护的帧与光标状态：轻则某一行的内容被覆盖，重则触发终端滚动，导致渲染器按旧帧差量重绘时把上一页的表格碎片留在当前页面（典型现象是退出某个结果页后底部还残留一行提示或旧表格残余）。

| 角色 | 契约 |
| --- | --- |
| Shell | 主界面启动时调用 `shell.GuardTerminalOutput()`：把 `internal/console` 的 stdout/stderr 临时重定向到日志（warn 级，前缀“全屏界面运行期间被重定向的终端输出”），退出时恢复并冲刷未换行的残留文本。`EditSimpleDeployMappings` 等嵌套全屏程序必须同样接入。 |
| 业务模块 | 不得因为该兜底就继续直接打印；`View()`、日志查看器、执行视图、表单说明等仍只能返回字符串或写入组件给的 writer。 |
| 终端控制序列 | 必须直达终端的写入（当前只有剪贴板 OSC 52）只能使用 `console.TerminalStdout` / `console.TerminalStderr`，它们不受重定向影响，避免 SSH 会话复制能力被兜底吞掉。 |
| 验证 | 必须覆盖重定向与恢复、`\r`/`\n` 切行、ANSI 转义清理、超长未换行文本与退出时残留半行的冲刷；终端字节级回归要确认全屏运行期间不再有业务文本写入标准输出。 |

### 差量渲染兼容

全屏入口统一使用 `shell.NewFullscreenProgram` 并保留终端输出接管。入口通过固定版本的 `tea.WithConservativeRenderer()` 保留单元格差量刷新，关闭硬滚动、硬 Tab 和退格定位优化；普通更新不额外清屏。真实窗口缩放和子进程返回仍由框架恢复画面，渲染器重置不得重新开启这些优化。

不再使用逐帧清屏包装或 `RU_TUI_RENDER=full/diff` 环境切换。业务模块不得以异步清屏修补残影。框架原有的消息过滤、命令调度、输入与真实光标机制保持可用。连续输出必须经过独立 VT 回放逐格比较；测试同时检查普通更新没有额外清屏、滚动区域、插入/删除行和硬 Tab/退格定位。

固定来源、最小补丁、测试命令及人工验收边界见 [TUI 差量渲染兼容补丁](tui-renderer-compatibility.md)。

帮助栏说明与状态使用终端默认前景色，快捷键保留着色与粗体；不得用固定灰色承载必读说明，以免 16 色降级后变成浅色背景上的白字。分隔点只由帮助栏插入一次，宽度预算与显示文本保持一致。回归同时覆盖 16 色、256 色和真彩色的实际 ANSI 输出与 VT 回放。

### 工作台统一底色

主工作台和嵌套映射编辑器在最终 `tea.View` 上调用 `theme.ApplyWorkbenchTheme(view, width, height)`，由程序通过 256 色扩展调色板固定黑底（索引 16，`#000000`）与浅灰正文（索引 252，`#D0D0D0`），导航、表格选中项、面包屑等沿用原有强调配色。避开可由客户端主题重定义的基础色 0–15，背景不继承终端默认色。该步骤覆盖边框、边距、空白、编辑区和弹框；仅替换背景及反显，保留强调色、粗体、下划线、链接和真实光标。业务组件仍返回终端默认色，不自行设置整行背景。着色后的完整画面交给原有差量渲染器，不修改终端默认背景，也不额外清屏。

全屏入口默认使用 `tea.WithColorProfile(colorprofile.ANSI256)` 作为兼容基线，不无条件强制 TrueColor；框架在获得明确 RGB 能力回复后可升级，固定工作台底色和正文仍使用索引色。必须验证 `TERM=xterm` 且无 `COLORTERM` 时的真实输出，在忽略 RGB 的能力模拟中仍能保留黑底、浅灰正文与独立强调色。lazygit / lazydocker 的源码对照、Xshell 真彩色开关与验收边界见 [终端一致性源码对照](tui-terminal-consistency.md)。

字体、字号和字符网格仍由终端客户端设置决定。相同数据在较少字符列数下会按公共表格规则收缩、换行并减少每页条数。公共表格采用 C 布局（标题嵌边框、列间竖线、表头下横线），普通搜索仅按 `/` 展开，收起后释放输入行；F4 命令面板是唯一常显搜索入口。表格模式隐藏底层列表原筛选栏，退出时恢复设置。表头只在标题文字上使用下划线，列间留白不画下划线，完整分隔线独立渲染。

简单部署的映射清单对制品、目录和容器列显式声明 `MaxLines: 1`，通过公共表格省略过长值，避免单条长路径把整张表的分页行高翻倍；原值完整保留并在编辑表单中展示。普通映射列表隐藏仅含配置位置和映射数量的例行信息区，把高度还给主窗口；待删除影响、样例导出结果及短操作反馈继续显示。回归覆盖 100×24、112×26、120×30 和 190×50，以及往返缩放、筛选、分页、点击和编辑原值。

验收须覆盖整窗每个显示单元的统一背景、中文和 emoji、编辑光标、浮层覆盖及缩放；默认色说明在组件测试中继续验证，最终画面再验证统一底色。

## 4. 工作台尺寸传递与公式

尺寸只沿终端窗口 → MainLayoutModel → ContentAreaModel → 当前模块 → 公共组件传递。模块收到的 WindowSizeMsg 已经是内容区尺寸，不能再次扣导航、帮助栏、面包屑或面板框线。

| 层级 | 输入 | 输出/约束 |
| --- | --- | --- |
| LayoutManager | 真实窗口 W × H | 最小阈值为 100 × 24；不满足时显示窗口过小提示。 |
| theme.CalculateAvailableSize | W × H | 扣除 DocStyle 框架，宽度至少 40、高度至少 10。 |
| theme.CalculateNavWidth | 可用宽度 AW | 导航宽约 AW/4，限制在 22 至 30，并保证内容区至少 40。 |
| MainLayoutModel | AW × AH | 帮助栏按全部有效按键的换行数动态分配，至少 3 行；主区为剩余高度，最小 10；面板框架宽高各占 2。 |
| ContentAreaModel | contentInnerWidth × contentInnerHeight | 向当前模块发送 WindowSizeMsg。 |
| 模块 | 内容区尺寸 | 原样交给表格、表单、弹框、执行视图或日志查看器。 |

设 AW、AH 是 CalculateAvailableSize 的结果，当前公式为：

~~~text
helpHeight          = max(3, RequiredContentHeight(AW) + 1) + 未确认编号行数
mainHeight          = max(AH - helpHeight, 10)
navWidth            = clamp(AW / 4, 22, 30)，且不大于 AW - 40
contentWidth        = max(AW - navWidth - 1, 40)
navInnerWidth       = max(navWidth - 2, 1)
navInnerHeight      = max(mainHeight - 2, 1)
contentInnerWidth   = max(contentWidth - 2, 1)
contentInnerHeight  = max(mainHeight - 2 - 2, 1)
~~~

信息展示区可见时，右侧两块面板的独立边框相邻：`contentPanelHeight + infoPanelHeight = mainHeight`；隐藏时 `contentPanelHeight = mainHeight`。上式 `contentInnerHeight` 是信息展示区隐藏时的高度。

## 5. 公共组件的布局参数

### 5.1 表格

RenderTableBlock 的 width 就是模块内容区宽度。公共表格先处理 HideBelow，再按每列最长内容计算列宽（标题是下限、MaxWidth 是上限），内容完整时不再平均撑宽；可用宽度不足时按 DisplayPriority 从 Optional 到 Primary 收缩，仍放不下的列在列内自动换行且最多两行，余量只补给内容仍未完整显示的列。带数据行的表格使用 FitTableColumnsWithRows，RenderTableBlock、RenderSelectableTableBlock 内部已使用它；FitTableColumns 只保留给拿不到数据行的固定布局（例如 §5.2 的编辑器列宽）。模块只提供完整原始字符串和 TableColumn，不能预截断或复制表格列宽算法；隐藏中间列后仍传递原始行，由公共组件按原始索引映射值。单行横向模式使用 NewHorizontalTableLayout，至少声明一个 Fixed 列；固定与滚动区按原始值计算宽度、极窄时才收缩固定区，两区间有不嵌套 ANSI 的公共细虚线 `┊`，表头和数据行共享同一偏移；模块显式注册 `←/→` 后才能消费横向滚动键。

### 5.2 参数表单

参数表单的布局宽度由公共函数统一推导。设模块传入宽度为 W：

~~~text
formWidth       = W；W <= 0 时为 80
subpageWidth    = max(formWidth - 4, 24)
contentWidth    = max(subpageWidth - 2, 20)
valueWidth      = FitTableColumns(contentWidth, fieldColumns)[值列].Width
editorWidth     = max(valueWidth - 1, 1)
~~~

| 区域 | 固定列契约 |
| --- | --- |
| 编辑字段页 | 前缀 2；字段 20/12；值 38/16，Flex，最大 58；类型 12/6，宽度小于 68 隐藏。 |
| 确认页 | 字段 22/12；值 52/16，Flex，最大 70；类型 18/10，宽度小于 68 隐藏。 |
| 字段详情 | 子页面内容区内的说明/校验框；无说明、无错误时不渲染。 |
| 错误摘要 | 由 RenderParameterFormValidationSummary 输出；不可由模块手拼。 |

ParameterFormLayoutOptions 的布局优先级：HideDetail 先隐藏字段详情；ShowValidationSummary 决定是否生成摘要；PinnedValidationSummary 时错误摘要贴底且优先于字段详情；否则 PinnedDetail 可以将详情贴底；Height 同时约束单区块及多区块字段窗口，自动保留当前字段与全部按钮，完整字段继续参与导航及校验。字段说明预算包含实际边框；字段窗口模式的极短窗口无法同时容纳最小表单和完整说明时，保留表单，完整说明通过页面滚动访问；整页滚动模式在同样过矮的窗口隐藏贴底区域（见下文），高度全部让给可滚动内容。

参数表单支持两种纵向布局，模块按页面形态选择：

| 模式 | 入口 | 高度契约 |
| --- | --- | --- |
| 字段窗口模式（默认） | `RenderParameterFormSectionsLayout` + `ParameterFormLayoutOptions{Height}` | 高度不足时只收缩展示窗口，保留当前字段及全部动作行；完整字段仍参与导航、校验与提交。适合单屏参数页。 |
| 整页滚动模式 | `RenderParameterFormSectionsScroll` + `UnifiedPageModel.SetDetailContentWithFocus` / `SetDetailFooter` | 不读取 Height、不删除任何字段；返回完整 `Content`、贴底 `Footer` 与当前字段的 `FocusLine`。Footer 按优先级组合：动作结果置顶，校验汇总必须保留，字段说明在动作结果出现时让位；无动作结果时字段说明与校验汇总并存。页面视口按 FocusLine 做最小滚动，键盘移动字段和窗口缩放时焦点始终可见；贴底区域固定在内容区底部，动作行随内容滚动，不再常驻在固定位置。适合分组多、字段多的长配置页（Docker daemon.json）。 |

整页滚动模式下的编辑光标仍由公共表单返回内容坐标，`UnifiedPageModel` 在换算终端位置时扣除详情视口滚动偏移；`SetDetailFooter` 占用的高度必须先于视口高度计算扣除，窗口过矮时隐藏贴底区域，把高度让给可读内容（此时字段说明不可见，属于可接受的信息让位）。下拉锚点的 `topRows` 必须使用同一份内容起点并扣除视口滚动偏移，窗口缩放时要随最新布局重算。

字段导航和 selectedIndex 始终基于 VisibleParameterFormFields 的可见字段列表。InlineEditor 的宽度必须是 ParameterFormEditorWidth(W)；路径和一般输入建议框的宽度必须使用 ParameterFormValueWidth(W)。

### 5.3 弹框、执行视图与日志查看器

| 组件 | 接收尺寸 | 内部收敛规则 |
| --- | --- | --- |
| ModalListModel.SetSize(W, H) | 当前内容区尺寸 | 面板宽 W - 8，最低取 max(W - 2, 20)；列表高 clamp(H - 8, 5, 14)；内容高 clamp(H - 8, 5, 22)；内部列表宽为面板宽减 4。 |
| ModalListModel.View | 来源视图与内容区 W/H | 宽度为包含边框和内边距的整块尺寸，内容渲染宽度为总宽减 4；外框按 Lip Gloss v2 直接使用总宽，不得重复扣除。普通弹框默认贴底，字段下拉贴值列下方且不足时向上展开；显式指定 Center 时正中居中、UpperCenter 时偏上居中。只读详情弹框按内容收缩：宽度上限 = 内容表格的自然整块宽度（`table.NaturalGridWidth`）+ 弹框边框与内边距 4 列，通过 `SetContentModalMaxSize` 交给公共弹框；居中后宽度不足 W - 8 时保留两侧边距，不把表格边框拉伸到内容区宽度后在右侧留白。 |
| TaskExecutionModel.Render(W, H) | 内容区尺寸 | W <= 0 时 100，H <= 0 时 24；按实际内容收紧；高度不足时扣除一行分隔，任务区约 60%，任务及日志区各至少一行，通过各自视口访问完整内容。 |
| logviewer.Model.Render(W, H) | 内容区尺寸 | W 最小 20、H 最小 4；日志视口宽 W - 2，高为总高扣标题和边框后至少 1。 |
| UnifiedPageModel | 内容区 WindowSizeMsg | 详情/日志扣可选标题；详情还要扣 `SetDetailFooter` 的贴底区域（窗口过矮时隐藏）；进度宽 W - 4；`SetDetailContentWithFocus` 的焦点行在渲染和窗口缩放后重新做最小滚动；既有页面不另建平行尺寸状态。 |

进度条宽度完全由 TaskExecutionModel 推导。模块仅传 current、total、label；total 小于等于 0 时必须使用 SetIndeterminateProgress，不能提供虚假的总量。

### 5.4 全模块内容视口与摘要预算

`UnifiedPageModel.SetListHeaderRenderer` 在窗口、footer 变化时重新提供摘要宽高预算，预留八行操作列表；空摘要和 footer 不额外占行。Docker 工作台根据预算依次收缩运行摘要、资源表和当前容器表，保持当前操作可见。

Shell 对七个模块共用 ANSI 感知的显示单元换行和内容视口。超过高度的页面保留完整内容，并在帮助栏注册 `Alt+PgUp/PgDn` 滚动整页、`Alt+Home/End` 定位首尾；滚轮由整页视口消费，点击坐标加回滚动偏移。弹框打开时整页按键与鼠标停止接管。普通模块按键恢复页首，列表当前项和表单焦点仍由各自公共组件保持可见。模块不得自行裁掉尾部内容。

参数页默认传入 Height；单区块下拉使用 `ConfigureParameterFormLayoutDropdown`，多区块使用带同一布局选项的 `ConfigureParameterFormSectionsDropdown`。锚点按实际字段窗口定位，重新布局保留尚未提交的候选。Find 原样使用内容区尺寸，其条件列表与字段选择随窗口更新；数据库、清理和文件中转参数页共用上述窗口规则。Docker 参数页中的守护进程配置（daemon.json）是整页滚动模式的参考实现：表单不再传 Height，全部区块完整渲染，`UnifiedPageModel` 按焦点行自动滚动并固定贴底区域，下拉锚点行扣减滚动偏移；其尺寸回归见 §6 第 8 项。

### 5.5 面包屑层级与点击返回

面包屑保留已访问节点、当前节点及已选流程的后续节点；后续节点用于预览，不参与点击返回。进入具体功能后必须保留真实菜单父级，例如 `选择功能 > 镜像管理 > 查看镜像列表`、`选择功能 > Compose > Compose 项目管理 > 项目列表 > 项目详情`。普通镜像浏览不预告删除；明确进入删除范围选择或确认后，才追加“执行删除”，取消或关闭删除结果后恢复浏览路径。当前节点必须对应正在显示的页面，不能把服务列表标成项目详情，也不能在确认阶段提前显示执行完成。

节点名称与菜单文案一致，返回只调用原有导航或只读加载入口。Compose 的项目详情可点击“项目列表”返回列表，服务列表可点击“项目详情”返回详情；`Esc/q` 也按同一层级返回。执行中的任务与可见弹框继续阻止背景面包屑导航。

标题行的状态文字最多占一半宽度，面包屑与状态都按 ANSI 显示单元裁切，不能换行挤动正文。窄窗口优先保留当前节点及最近的父级，较远祖先和后续步骤按需折叠；渲染与鼠标命中复用同一布局，折叠占位、分隔符、状态文字和裁切区域不触发返回。

回归须从真实完整帧定位点击坐标，覆盖宽窄窗口、热加载长状态、往返缩放、重复聚焦、逐级返回、后续步骤保留与不可点击，并用真实 SGR 鼠标输入及连续程序输出的独立 VT 回放核对。

## 6. 布局变更验收

1. 先断言模块收到的内容区尺寸，不将终端总尺寸传给公共组件。
2. 表格在窄宽度下按优先显示层级先为高优先级列分配宽度，超出列预算的长值省略且不换行撑破页面。
3. 表单的编辑器、路径建议、输入建议、说明框和错误框都不越过值列。
4. 弹框滚动、鼠标消费与背景隔离在内容区尺寸变化后仍成立。
5. 执行视图和日志查看器在最小高度时仍保留可用滚动区。
6. Shell 测试覆盖窗口过小、焦点切换、帮助栏、面包屑和弹框优先路由。
7. 组件测试覆盖其局部最小尺寸和截断；模块流程测试覆盖窗口变化后的真实目标状态。
8. 整页滚动模式的参数表单必须覆盖：全部区块/字段完整渲染且只出现一次、焦点移动到首尾字段时自动滚动、焦点行与真实编辑光标都在视口内、贴底区域的字段说明/校验汇总/动作结果按优先级显示且不进入可滚动内容（动作结果出现时校验汇总仍保留、字段说明让位）、窗口过矮时隐藏贴底区域且高度归还视口、窄宽度不超宽、窗口缩放后焦点仍可见、下拉锚点随滚动偏移和缩放重算、离开页面后贴底区域不残留。

布局回归使用 `make test-tui`，覆盖七个模块的最小窗口及往返缩放、长表单焦点/按钮/下拉、彩色中文及 emoji、整页滚动与弹框隔离；执行视图增加 3 至 12 行的短高度覆盖。提交前使用 `make test`、宿主平台对应的 `make build-mac` / `make build-linux` / `make build-windows` 与 `git diff --check`。

## 异步任务的所属模块

任务在用户切换模块后仍可能继续运行。此类任务的日志与完成通知使用 `shell.TargetedContentMsg{ComponentID, Message}`，`ContentAreaModel` 按注册 ID 将内部消息交给所属模块并返回后续命令，不改变当前模块、焦点或页面。后续等待命令仍须包装，未知模块 ID 安全忽略。不得依赖当前可见模块接收异步结果，否则日志等待链会中断；简单部署已经接入此路由，执行期间关注跳转不得重置其状态。


## 功能搜索与前缀候选

工作台保留黑底及三栏布局，采用统一语义样式；F4 功能搜索与底部前缀操作表的输入、状态保护、分页及回放验收见 [工作台视觉、前缀提示与功能搜索](tui-command-navigation.md)。
