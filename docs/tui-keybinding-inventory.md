# TUI 按键现状统计与歧义清单

> 正式文档入口：[docs/README.md](README.md)。本文是对 `internal/tui` 全量按键声明的静态盘点，用于「统一按键控制」改造前的现状核对；文中的「建议」一节只是候选方案，尚未实施。
>
> 按键已整体改为 `r` 前缀两键序列，当前规范见 [TUI 按键规范](tui-keybindings.md)；以下内容保持盘点当时的原样，仅作改造前对照。
>
> 数据口径：抽取 `internal/tui/` 下全部非测试 Go 文件的 `shell.NewHelpBinding` / `shell.HiddenHelpBinding` 调用（共 **567** 处，其中 `shell/content_area.go` 的 3 处是工厂函数自身的构造实现，实际按键声明 **564** 条），再逐一核对 shell 全局键、公共组件键位表和 bubbles 列表默认键位。统计的是**声明条数**，不是代码分支数；同一动作在不同状态重复声明会被多次计数。
>
> 验证方式：静态抽取 + 逐条读取代码路径（含 `github.com/charmbracelet/bubbles v0.21.0` 的 `list`/`viewport`/`textinput` 默认键位表），并按模块分组做了交叉复核（docker；clean/find/tools/fileexport；database/aiops/firewall；shell/unified/components）。本次**未运行 `make test`**，涉及「实际按键生效」的结论均给出 `文件:行`，可按行号复核；标注为「静态推断」的不可达性结论尚未运行时验证。

## 一、结论速览

1. **真正跨模块固定的是公共层按键**：`Ctrl+Q`、`Ctrl+C`、`q`、`Esc`、`Tab/Shift+Tab/←/→`、`↑/↓/k/j`、`PgUp/PgDn`、`Home/End`、`Alt+PgUp/PgDn`、`Alt+Home/End`、数字编号、`Enter`、`Space`、`Backspace/Delete`、`Ctrl+U`（声明为「清空」，公共编辑器里实际是删除光标前内容）、`任意键`、`/`。
2. **字母功能键里语义唯一的只有 `c`（复制，3 处）**；`s`（标星/取消关注）本来是 shell 级统一语义、8 个业务模块全部接入，但被 docker 4 处、clean 2 处模块私有 `s` 抢占。
3. **你设想的 `a=新建 / d=删除 / s=标星 / i=详情` 目前 3 条不成立**：
   - `a`：只在 docker 结构化记录编辑器里是「新增记录」，另外 2 处是「运行中/全部」筛选和 prune「全部清理」。
   - `d`：只有 2 处是「删除」，clean 4 处是「待删明细」（打开待删清单），find 1 处是「完成选择」；bubbles 列表默认还把 `d` 当「下一页」。
   - `i`：docker 5 处是「完整详情/预览」，docker 资源监控 3 处是「采样频率」。
   - `s`：模块没声明时才是「标星」。
4. **最该先修的是「未声明却生效」的三类键**（均违反 `docs/new-feature-guidelines.md` 代码审查清单第 1 条「是否新增了隐藏快捷键」）：
   - **详情/日志 viewport 默认键**：公共页模型没有改过 `bubbles viewport` 的键位表，`空格`/`f`=下一页、`b`=上一页、`u`=半页上、`d`=半页下、`h`/`l`=左右，在 `StateDetail`/`StateLog` 页面真实生效，而帮助栏只声明了 `↑↓/PgUp/PgDn`。clean 的扫描结果页更极端：连页面级滚动声明都没有。
   - **find 条件编辑器**：`Ctrl+D`/`Ctrl+U`/`Ctrl+L`/`Ctrl+Shift+A`/`Ctrl+N`/`m` 等一批控制键未声明即生效。
   - **列表页的库键位**：`d/f/b/u/g/G` 在 bubbles 列表里是翻页/首尾，但**模块的数字编号缓冲会把所有单字母吞掉**（提示「当前列表只允许输入数字编号」），所以它们在列表页实际不翻页；真正的问题变成了**导航区 `j`/`k` 也一起失效**（见 5.1（3）），以及非字母的 `?` 仍会命中列表的库键位。
5. **同一动作在不同模块用了不同键**（属「该固定但没固定」）：新建/新增（docker `n`、编辑器 `a`、其余模块无键）、详情（docker `i`、find `Enter`）、保存（docker/clean `s`、database/aiops/fileexport `Ctrl+S`）、完成（find `d` 与 `Ctrl+X`）。

## 二、固定语义键（公共层，可直接写进规范）

| 键 | 统一语义 | 生效范围与条件 | 证据 |
| --- | --- | --- | --- |
| `Ctrl+C` | 强制退出 | 任意位置，弹框内也生效 | `shell/main_layout.go:190`、`:200` |
| `Ctrl+Q` | 返回左侧导航栏（主界面） | 内容区聚焦；与 `q`、内容区（含模块根页）里的 `←/→` 同为内容区返回主界面的入口 | `shell/main_layout.go:239-240` |
| `q` | 内容区逐级返回：模块声明了 `q` 就交模块返回上一级，未声明（含模块根页）时等同 `Ctrl+Q`；导航区：只在模块声明了 `q` 且不在根状态时返回当前流程，永不退出程序 | `q` 不再退出程序，退出只保留 `Ctrl+C`；内容区由模块声明与 Shell 分工，帮助栏必须显示 | `shell/main_layout.go:223-238`、`:1031-1036`、`:1047-1052` |
| `Esc` / `q` | 返回 / 取消 / 关闭（模块自报） | 模块必须在当前状态声明 | `shell/main_layout.go:277-279` |
| `Tab` / `Shift+Tab` | 焦点切换，方向不对称：导航栏聚焦时切到内容区；内容区聚焦时不切回导航栏 | 导航栏焦点无条件生效；内容区只有当前状态声明了这些键时才下发给模块 | `shell/main_layout.go:1113-1115`、`:248-263` |
| `←` / `→` | 焦点切换：内容区任何状态（含模块根页）里模块未声明时把焦点交回左侧主界面（模块选择） | 多页列表先被翻译成 `PgUp/PgDn`；模块声明 `←/→` 时原样下发；帮助栏显示 `←→ 返回导航栏` | `shell/main_layout.go:248-263`、`shell/page_navigation.go:100-114` |
| 鼠标（导航面板） | 内容区聚焦时左键单击左侧导航面板把焦点交回主界面：第一下只返回并定位命中行，第二下点击同一行才切换模块 | 点击与键盘返回等价；滚轮不承担返回，内容区聚焦时忽略 | `shell/main_layout.go:333-345` |
| `←/→`（改造后新增） | 多页列表页整页翻动（等价 `PgUp/PgDn`），帮助栏追加 `←→ 翻页` | 模块实现 `shell.ListPageProvider` 且列表多于一页、无可见弹框、未自己声明 `←/→` | `shell/page_navigation.go`、`shell/main_layout.go`、[TUI 按键规范](tui-keybindings.md) |
| `↑/↓` / `k/j` / `PgUp/PgDn` / `Home/End` | 列表=选择；详情=滚动；输入=光标 | 由 `UnifiedPageModel.NavigationMode()` 决定并入哪一组 | `shell/page_navigation.go:13-28`、`unified/model.go:65-79` |
| `Alt+PgUp/PgDn`、`Alt+Home/End` | 整页滚动 / 整页首尾 | 内容区内容超出可视高度且无弹框 | `shell/content_viewport.go:34-41` |
| `Alt+↑/Alt+↓` | 长内容弹框内按标题块跳转 | 公共弹框内容区 | `components/list/modal_list.go:262-265` |
| `0-9`（支持连续多位） | 仅定位，需再按 `Enter` | 所有编号列表 | `internal/tui/CLAUDE.md` 编号选择约束 1-3 |
| `Enter` | 确认 / 进入当前项 | 全部状态 | 124 条声明 |
| `Space` | 勾选 / 开关 / 切换枚举 | 多选与布尔字段 | 30 条声明 |
| `/` | 筛选 / 搜索（`Esc` 清除） | 列表、弹框、日志 | `unified/model.go:181-204`、`shell/content_area.go:92-101` |
| `Backspace` / `Ctrl+H` / `Delete` | 删除字符 | 文本输入态 | `shell/page_navigation.go:24` |
| `Ctrl+U` | 声明为「清空输入」，公共 `InlineEditor` 里实际是删除光标前内容 | 文本输入态 | `shell/page_navigation.go:25`、`components/form/inline_editor.go:50-83` |
| `任意键` | 关闭短操作反馈 | `operationstatus` 覆盖层 | `internal/tui/CLAUDE.md` 公共组件约束 4.0.3 |
| `o` / `O` | 打开生成物所在文件夹 | 有已登记生成物且图形环境可用 | `components/actions/generated_actions.go:89-94` |
| `Ctrl+o` / `Ctrl+O` | 打开生成物文件 | 同上 | `components/actions/generated_actions.go:89-94` |
| `s` | 关注 / 取消关注 | 当前页有可标星目标且模块未声明 `s` | `shell/main_layout.go:215-221`、`:496-525` |
| `Ctrl+T` | 只测试（不落盘） | 参数表单 | 6 条声明，语义统一 |
| `y` | 确认执行（与 `Enter` 同义） | 各确认弹框 | 7 条声明，全部属「确认」族 |
| `c` | 复制结果 / 复制模板 | docker 结果页、clean 模板列表 | 3 条声明，语义统一 |

`Enter`/`Esc`/`q`/`Space` 的**动作族**是固定的（确认 / 返回 / 勾选），但帮助栏描述高度分散：`Enter` 124 条声明出现了 58 种描述，`Esc` 150 条声明出现 28 种（返回 80 / 取消 18 / 关闭 / 清除筛选 / 取消编辑…），`Space` 30 条声明出现 18 种。这是文案问题而非键位问题，但会让用户无法凭帮助栏建立肌肉记忆。

## 三、有歧义的键（逐键统计）

### 3.1 单字母功能键总表

| 键 | 声明处 | 含义种数 | 含义分布 |
| --- | --- | --- | --- |
| `a` | 3 | 3 | 新增/删除记录（docker 运行时结构化记录编辑器）；运行中/全部（docker 容器工作台筛选）；全部清理（docker 清理确认） |
| `c` | 3 | 1 | 复制 |
| `d` | 8 | 4 | 待删明细×4（clean）；删除×2（docker 可信仓库、clean 模板列表）；新增/删除记录×1；完成×1（find） |
| `e` | 1 | 1 | 修改（clean 模板列表） |
| `f` | 1 | 1 | 跟随/暂停（docker 实时日志）；详情/日志 viewport 默认 = 下一页；列表态被编号缓冲吞掉 |
| `h` | 1 | 1 | 移动字段（docker 运行时结构化编辑器横向）；详情/日志 viewport 默认 = 左移；列表态被编号缓冲吞掉 |
| `i` | 8 | 3 | 完整详情×4；完整预览×1；频率×3（docker 资源监控） |
| `l` | 4 | 2 | 日志明细×3（clean）；移动字段×1；详情/日志 viewport 默认 = 右移；列表态被编号缓冲吞掉 |
| `m` | 2 | 1 | 查看镜像（docker 执行态） |
| `n` | 9 | 5 | 取消/否×5（docker 各确认弹框 `Esc/q/n`）；返回仓库×1；跳过×1；新增×1（可信仓库）；添加远端源×1 |
| `r` | 9 | 6 | 重启×2；刷新×3；修改×1；重试×1；转 compose×1；转 docker run×1 |
| `s` | 6 | 4 | 保存×3；启停×1；启停服务×1；保存模板×1；**模块未声明时 = 标星** |
| `w` | 1 | 1 | 自动换行（docker 实时日志） |
| `y` | 7 | 5 | 确认族（确认/确认执行/确认清理/确认上传），语义一致 |
| `b`/`u`/`g`/`G` | 0 | — | 未声明，但 bubbles 列表默认 = 上一页/上一页/首页/尾页 |

`j`/`k` 各 62 条声明、各 21 种描述，`↑`/`↓` 各 81 条声明、27 种描述（选择、滚动、移动字段、选择路径建议…），语义族一致（上下移动），属文案分散而非语义冲突。

### 3.2 需要重点决策的 4 个键

**`d`**
- 删除：`docker/docker_help.go:285`（可信仓库列表）、`clean/clean_controller.go:453`（模板列表）
- 待删明细（只读清单，非删除）：`clean/clean_controller.go:468`、`:470`、`:473`、`:475`
- 完成选择：`find/find_render.go:55`，实现在 `find/find_conditions.go:240`（同时接受大写 `D`）
- 新增/删除记录：`docker/docker_help.go:165`，实现在 `docker/docker_transfer.go:868`
- 隐藏：bubbles 列表下一页

**`s`**
- 标星/取消关注（shell 级默认）：`shell/main_layout.go:217`、`:441`
- 保存：`docker/docker_help.go:446`（runlike 结果）、`:458`（compose 结果）、`clean/clean_controller.go:460`
- 启停 / 启停服务：`docker/docker_help.go:506`、`:508`
- 保存模板：`clean/clean_controller.go:473`
- 覆盖规则：模块在当前状态声明了 `s` 时模块优先，shell 不接管（`shell/main_layout.go:440-443`）。**不存在同一状态双含义**：docker 声明 `s` 的 4 个状态都不在可标星的功能菜单集合里，`CurrentStarFunction()` 必为空，所以是确定性优先级（模块 > shell），不是真冲突。真正的问题是跨页面语义漂移——同一位置按 `s`，在功能菜单是标星、在结果页是保存、在 compose 详情是启停。

**`a`**
- 运行中/全部筛选：`docker/docker_help.go:216`，实现在 `docker/docker_controller.go:1280-1283`
- 全部清理（送出全部选中的 prune 目标）：`docker/docker_help.go:312`，实现在 `docker/docker_controller.go:831-836`
- 新增记录：`docker/docker_help.go:165`，实现在 `docker/docker_transfer.go:866`

**`i`**
- 完整详情/预览：`docker/docker_help.go:217`、`:220`、`:259`、`:267`、`:330`（容器工作台、镜像列表、推送选镜像、保存选镜像）
- 采样频率：`docker/docker_help.go:480`、`:489`、`:497`（资源监控结果页）

### 3.3 公共键的多义情况

| 键 | 含义种数 | 说明 |
| --- | --- | --- |
| `Esc` | 28 | 返回 80 / 取消 18 / 关闭 / 清除筛选 / 取消编辑 / 取消输入；由模块自行声明，无统一裁决 |
| `Enter` | 58 | 确认 / 进入 / 选择 / 执行 / 保存字段 / 关闭详情；动作族一致 |
| `Space` | 18 | 勾选 / 切换开关 / 选择单位 / 选择标签 / 展开折叠目录 / 暂停继续；动作族一致（切换） |
| `q` | 20 | 返回 62 / 取消 10 / 关闭 / 保存并返回；动作族一致（退出当前层） |
| `Ctrl+S` | 8 | 测试并保存×3、开始×3、开始执行×2、保存/执行、提交更新、下载、测试并继续 —— **执行与保存混用** |
| `/` | 3 | 搜索 / 筛选 / 表单里输入挂载与变更字段 |
| `Tab` / `Shift+Tab` | 6 | 焦点切换 / 路径补全 / 表单区块切换 / 已保存记录切换 / 弹框候选切换 |
| `Home/End` | 11 | 列表首尾 / 光标首尾 / 日志首尾 / 横向滚动首尾 / 详情滚动 |

## 四、同一动作、不同键位（该固定但没固定）

| 动作 | 现状 |
| --- | --- |
| 新建 / 新增 | docker 可信仓库 `n`；docker 结构化记录编辑器 `a`；docker 推送 `n`（添加远端源）；其余模块无按键入口 |
| 删除 | docker 可信仓库 `d`；clean 模板列表 `d`；find 的多选完成用 `d`；database / aiops / firewall / fileexport 无按键入口 |
| 详情 / 预览 | docker `i`；find 条件选择页 `Enter`（详情）；其余模块无按键入口 |
| 保存 | docker 结果页 `s`；clean 模板编辑器 `s`；database / aiops / fileexport `Ctrl+S` |
| 执行 / 开始 | `Ctrl+S` 家族（开始 / 开始执行 / 测试并保存 / 提交更新 / 下载）；clean 执行页 `Enter` |
| 完成 | find 自定义条件页 `d`，已保存条件页 `Ctrl+X`（同一模块两个键） |
| 刷新 | docker 资源监控 `r`；其余模块没有刷新键 |
| 标星 | `s`（shell 统一），但被上述模块私有 `s` 覆盖 |

## 五、隐藏键与「声明 ≠ 生效」清单

### 5.1 生效但从未声明的键

**（1）详情 / 日志 viewport 默认键（影响面最大）**

公共页模型建 `viewport` 时从未替换键位表（`unified/model.go:127`、`:130`），因此 `StateDetail` / `StateLog` 页面带着 `bubbles viewport` 的 pager 默认键运行：

| 键 | 实际行为 | 证据 |
| --- | --- | --- |
| `空格` / `f` | 下一页 | `bubbles@v0.21.0/viewport/keymap.go:27-30` |
| `b` | 上一页 | 同上 `:31-34` |
| `u` | 半页上 | 同上 `:35-38` |
| `d` | 半页下 | 同上 `:39-42` |
| `h` / `l` | 左 / 右 | 同上 `:51-58` |

这些键在 docker 结果页、clean 扫描结果页与手动配置页、database/aiops 详情页等所有走 `SwitchToDetail()`/`SwitchToLog()` 的页面生效，而帮助栏只注册了 `↑↓/PgUp/PgDn`。clean 的 `ControllerStateScanResult` 更彻底：它既没调用 `WithPageNavigationBindings`，也没手写滚动条目（`clean_controller.go:468`），帮助栏里**一条滚动键都没有**，但 `↑↓/PgUp/PgDn/空格/f/b/u` 都能滚。

**（2）find 条件编辑器的未声明控制键**

| 键 | 实际行为 | 证据 |
| --- | --- | --- |
| `Ctrl+D` | 清空所有条件 | `find/find_saved.go:473` |
| `Ctrl+U` | 取消分组（**与公共层 `Ctrl+U = 清空输入` 语义冲突**） | `find/finder_condition.go:361` |
| `Ctrl+L` | 清理无效条件 | `find/finder_condition.go:366` |
| `Ctrl+Shift+A` | 取消分组（兼容键） | `find/finder_condition.go:370` |
| `m`、`Ctrl+↑/Ctrl+↓`、双击 `Delete`/`Backspace` | 移动模式、条件行移动、删除条件行 | `find/finder_condition.go:238-249`、`:350-435` |
| `h`/`l`/`k`/`j`（idle） | vim 列 / 行导航；帮助栏只声明 `←→ 切换列` | `find/finder_condition.go:414-433` |
| `D`（自定义条件页） | 完成（与 `d` 同义） | `find/find_conditions.go:240` |

原因是 find 只在文本输入态做按键门控（`find/find.go:239`），控制键默认不拦截。

**（3）列表态：库键位被编号缓冲吞掉，但导航区 `j`/`k` 一并失效**

`numberSelectionBuffer` 对除 `q/Q` 以外的任何单字母都会消费并提示「只允许输入数字编号」（`components/list/compact_delegate.go:437-447`、`:490-502`）。因此：

- 列表页里 `d/f/b/u/g/G/h/l` **不会**触发 bubbles 的翻页/首尾（被缓冲吞掉），所以「库默认字母键位在列表页生效」这一风险实际被压制了；但非字母的库键位不受影响——`?`（`ShowFullHelp`/`CloseFullHelp`）会正常到达列表并切换 `Help.ShowAll`、触发分页重算，而 `unified` 只关掉了帮助渲染（`unified/model.go:122`），因此 `?` 仍是「帮助栏没有、按键却生效」；
- 副作用是**左侧导航区的 `j`/`k` 也失效**：`NavigationModel.Update` 在把按键交给列表前先调 `numberSelect.Select`（`shell/navigation.go:293-296`），`j`/`k` 走 `shouldValidateSelectionInput` 分支（`compact_delegate.go:482-493`）被吞并显示「输入: j | 当前列表只允许输入数字编号」。这与 `internal/tui/CLAUDE.md` 列表导航约束第 1 条「列表必须支持 `↑/k`、`↓/j` 循环选择」不一致；docker 用 `HelpBindingsAllowKey` 前置判断规避了同类问题（`docker/docker_controller.go:2336-2343`）。
- 注意「吞字母」只针对 a–z/A–Z（`shouldValidateSelectionInput` 只判字母）：`数字`、`空格`、`?`、方向键、`PgUp/PgDn`、`Home/End` 都会继续下发给列表或 viewport。

**（4）其它零散项**

| 键 | 实际行为 | 证据 |
| --- | --- | --- |
| `Ctrl+S`（clean 模板编辑器） | 测试并保存（帮助栏只声明 `s` 保存） | `clean/clean_controller.go:767` |
| `home`/`end`/`pgup`/`pgdown`（database 各列表、aiops 主菜单） | 声明里只有 `↑↓`，但这些键能直达列表翻页/首尾 | `database_controller.go:512`、`aiops/controller.go:324-332` → `unified/model.go:292-295` |
| `↑↓/k/j/pgup/pgdown/home/end`（database 执行中与已结束页） | 声明只有「运行中/请等待」或 `Esc/q/Enter`，实际能滚详情 viewport | `database_controller.go:497-509` → `:512` → `unified/model.go:297-302` |
| `Space`（aiops 部署产物多选弹框） | 弹框已 `SetMultiSelect(true)`，勾选生效，但该状态的帮助声明没有 `Space` | `aiops/controller.go:1037`、`:707-712` |
| `pgup`/`pgdown`（aiops 选择目标弹框） | 弹框真实翻页，声明未含 | `aiops/controller.go:701-705` |
| `Alt+↑`/`Alt+↓`（除工作台预览外的所有 docker 弹框） | 公共弹框按标题块跳转在 `runtimeStructuredChoiceModal`、`imageTagModal`、`imageDetailModal`、`analysisModal`、版本/包选择弹框都会响应，但只有容器工作台预览声明了它；弹框路径不过模块门控 | `components/list/modal_list.go:262-265`、`docker_help.go:188`（唯一声明）、`docker/docker_help.go:105-129`、`:553-578` |
| `任意键` | 关闭短反馈；5 条 `NewHelpBinding("任意键", "关闭")` 都没有 `Keys`，不授权任何键，授权来自模块状态判断 | `database_help.go:16`、`docker_help.go:98`、`clean_controller.go:434`、`aiops/controller.go:696`、`fileexport/controller.go:703` |
| 数字键 | `NewHelpBinding("数字", "定位")` 未列 `Keys`，不由 `HelpBindingsAllowKey` 授权，靠单字符豁免生效 | `docker/docker_help.go:216`、`:312`、`clean_controller.go:441`、`:452`、`find/find_render.go:47`、`:95` |

### 5.2 声明了但不生效 / 已失效的键

| 键 | 问题 | 证据 |
| --- | --- | --- |
| `↑↓`/`k`/`j`（database 备份菜单、备份计划列表、备份计划选择） | **声明为「选择」但完全不移动光标**：`handleBackupKey` 不调用 `c.model.Update`，也没有 up/down 分支，函数末尾直接 `return c, nil` | `database_controller.go:474-477`、`database_backup.go:174-225`（末尾 `:224`） |
| `Space`（database 备份文件表单） | 声明为「编辑/切换」，但处理函数只有 `esc/q`、`↑↓`、`Ctrl+S`、`Enter` 分支，没有 `" "` | `database_help.go:88`、`database_backup.go:423-442` |
| `Esc`/`q`（aiops 主菜单） | 声明为「返回」，实际只把 action 重置为 deploy 并选中第 1 项；已是 deploy 时无任何动作，不会离开模块 | `aiops/controller.go:300-309` |
| `↑↓`/`PgUp`/`PgDn`/数字/`/`/`Enter`/`Space`（加载中弹框） | 加载态 `Update` 只响应 `esc`/`q`，其余全部忽略，但帮助栏照常显示这些条目 | `components/list/modal_list.go:428-434`；声明见 `database_help.go:19-29`、`aiops/controller.go:698-712` |
| `Space`（database 导出/导入配置） | 只有光标在 `data_only`/`schema_only`/`file_mode` 时才有效，声明未按字段收敛 | `database_configuration.go:672-676` |
| `Ctrl+U`（端口输入、路径输入等文本输入态） | 公共 `form.InlineEditor` 未处理 `Ctrl+U`，实际落到 `textinput.DeleteBeforeCursor`（删除光标前内容），并非「清空」 | `components/form/inline_editor.go:50-83`、`firewall.go:338`、`shell/page_navigation.go:24` |
| `Space`（clean 规则多选弹框） | 键名写成 `"space"`，而 `tea.KeySpace.String()` 是 `" "`，该声明永远无法授权（该状态没有门控，所以按 Space 仍能勾选，但契约失效） | `clean/clean_controller.go:451`；对照组 `:457`、`find_render.go:53`、`fileexport/controller.go:731` 都写 `" "` |
| `m`（docker 执行态「离线下载失败」分支） | 声明为「查看镜像」但永不成立：镜像门控在 `c.err != nil` 时返回 false，消费点也走同一判断 | `docker/docker_help.go:394-396`、`docker_transfer.go:1891-1897`、`docker_controller.go:1195-1203` |
| `q`（docker 离线下载架构选择页） | 实现支持 `q`（`docker_offline.go:127`），但帮助栏只声明 `Esc`，于是被模块门控拦掉——声明与实现相反 | `docker/docker_help.go:551`、`docker/docker_help.go:80` |
| `Enter`（docker 执行态 else 分支） | 消费点存在但该状态未声明 `enter`，被门控丢弃，属死路径 | `docker/docker_controller.go:1204`、`:1213`、`docker_help.go:399-409` |
| 「返回上传流程」（docker 离线推送） | 文案与实现不符：实际只调用 `showMainMenu()`，且该分支静态推断不可达 | `docker/docker_help.go:378-381`、`docker/docker_controller.go:1213`、`:1225` |
| `Esc`/`q`（fileexport 主菜单） | 模块未声明，被 shell 丢弃；模块内对应分支是死代码 | `fileexport/controller.go:237-238`、`main_layout.go:257-259` |
| `tab`（find 执行/结果页） | 未声明 → shell 拦掉；即使到达，公共执行视图也不处理 `tab` | `find/find_execution.go:88`、`:178` |
| `case findStateCustomPath` | 整个分支不可达（`textInputActive()` 已提前返回） | `find/find_render.go:58-63`、`:32-42` |
| `q`（clean ManualConfig）、`Ctrl+C`（clean 执行页） | 被 shell 全局分支提前处理，模块内分支为死代码 | `clean_controller.go:635`、`:263-264`、`main_layout.go:199-202` |
| 死代码 | `shell/keys.go:97-115` 的 `MultiSelectKeyMap`（`0`/`d`/`D` 完成）与 `DefaultMultiSelect` 无调用方；`shell/main_menu.go` 的 `MainMenuModel` 无调用点 | `shell/keys.go:97-115`、`shell/main_menu.go:73` |

### 5.3 描述与行为不符

| 位置 | 描述 | 实际 |
| --- | --- | --- |
| fileexport 表单 | `Enter/Space 编辑或执行动作` | 普通字段按 `Space` 直接 return，只有动作行响应（`fileexport/controller.go:731`、`:329-332`） |
| docker 路径错误页 | 文案「任意键」但 `Keys` 只列 `esc`,`q` | 真正生效靠 `loadPathProblem` 特判（`docker_help.go:347`、`:69-73`） |
| tools 表单 | `↑↓ 选择字段` | 上、下、`k`、`j` 四个键都是 `(selected+1)%2`，**同向前进**，无法回头（`tools/tools.go:198-201`） |

## 六、未被占用的键位（供统一分配）

- 小写字母完全未被业务使用：`p`、`t`、`v`、`x`、`z`。
- 已被库或公共层占用、分配前必须先处理：`b`、`u`、`g`、`G`（bubbles 列表；`b`/`u`/`d`/`f`/`h`/`l`/`空格` 在详情与日志页由 viewport 默认键占用）、`o`/`O`/`Ctrl+O`（生成物打开，目前只有 database 与 docker 接入）、`s`（标星）、`/`（筛选）、`Ctrl+U`（清空，但公共 `form.InlineEditor` 里的实际语义是「删除光标前内容」）、`Ctrl+T`（只测试）。
- 控制键组合：`Ctrl+A`（docker 清理确认页全选、docker 镜像选择列表全选/取消整行、docker 镜像「选择标签」弹框全选/取消全部可见标签）、`Ctrl+X`（find 完成）、`Ctrl+D`/`Ctrl+L`/`Ctrl+Shift+A`/`Ctrl+N`（find 条件编辑器，未声明）已被零星占用。全选统一走 `Ctrl+A`，docker 不再用小写 `a` 作为等效全选键（`a` 只表示「新增」）；`Ctrl+A` 会被 tmux 前缀或部分终端按键绑定截走，此时用户需要自行改用不截走该组合键的终端或前缀设置。
- **但「源码里没出现」不等于「空闲」**：文本输入框用的是 bubbles `textinput` 默认键位表，`Ctrl+A`/`Ctrl+E`（行首/行尾）、`Ctrl+B`/`Ctrl+F`/`←→`（左右）、`Ctrl+N`/`Ctrl+P`（上下）、`Ctrl+W`（删词）、`Ctrl+K`、`Ctrl+V`、`Ctrl+D`（删除）、`Alt+←/→`、`Alt+Backspace` 在输入态都会生效；详情/日志 viewport 也默认占用 `Ctrl+U`/`Ctrl+D`。给这些组合键分配全局语义前必须先确认输入态是否已声明它们（`internal/tui/CLAUDE.md` 帮助栏约束第 5 条）。
- 未纳入帮助栏的键在统一时应优先补齐声明或直接禁用，避免继续积累「看不到却生效」的按键。优先级建议：先处理 viewport 默认键（影响所有详情/日志页）→ 再处理 find 条件编辑器 → 最后统一字母功能键。

## 七、如果按你的目标统一（候选方案，待确认）

目标键位：`a`=新建、`d`=删除、`s`=标星、`i`=详情。落地改动量与前置条件：

| 目标 | 需要改的地方 | 说明 |
| --- | --- | --- |
| `a` = 新建 | docker `a` 的 3 处声明与 3 处分发（`:216`、`:312`、`:165`） | `a` 现在没有「新建」语义，改造成本最低，但要把「运行中/全部」筛选迁到 `f`/`t`、「全部清理」迁到 `Ctrl+A` |
| `d` = 删除 | clean 4 处「待删明细」、find 1 处「完成」、clean 扫描结果的 `l` 水平滚动 | clean 的「待删明细」建议改成 `v`（查看）；find「完成」统一为 `Ctrl+X`；另外要在公共层显式收口详情/日志 viewport 的 `d`（半页下），否则「删除」在详情页仍会被 viewport 抢走 |
| `s` = 标星 | docker 4 处（保存×2、启停×2）、clean 2 处（保存、保存模板） | 保存统一走 `Ctrl+S`，但 `Ctrl+S` 现在同时是「执行/开始」；需要先决策「执行」是 `Ctrl+E` 还是 `Enter`，否则只是把冲突从 `s` 挪到 `Ctrl+S` |
| `i` = 详情 | docker 资源监控 3 处「频率」 | 频率建议改成 `f`，或并入参数表单 |
| 顺带 | `n` 现在同时是「新增」和「取消/否」 | 若统一用 `a` 新建，`n` 可保留为确认弹框的「否」，但要把 docker 可信仓库的「新增」从 `n` 改到 `a` |
| 顺带 | 帮助栏描述收敛 | `Enter`/`Esc`/`Space`/`j/k` 的描述种数过多，建议按动作族统一为「确认 / 返回 / 勾选 / 上下移动」等固定文案 |

统一后需要同步的约束文档：`AGENTS.md` TUI 帮助栏与按键注册约束、`internal/tui/CLAUDE.md` 同章节、`internal/tui/components/README.md` 公共组件键位清单，以及各模块 `shell_input_test.go` 的状态 → 实际消费按键表驱动测试。

## 八、附录：各模块的功能键面

| 模块 | 私有功能键 | 说明 |
| --- | --- | --- |
| docker | `a` `d` `i` `n` `r` `s` `c` `m` `y` `f` `w` `h` `l`、`Ctrl+S` `Ctrl+T` `Ctrl+A` `Ctrl+U` `Ctrl+C` | 功能键最密集的模块，也是歧义主要来源；`f`/`w` 属实时日志查看器，`h`/`l` 属结构化记录编辑器；按键声明与消费总体一致，问题集中在 4 处死声明/文案不符与多处弹框 `Alt+↑↓` 未声明 |
| clean | `d` `e` `c` `s` `l`、`Ctrl+T` `Ctrl+S` `Ctrl+C` | `d` 同时是「删除」和「待删明细」；`s` 与写盘动作绑定；扫描结果页没有任何滚动键声明 |
| database | 无单字母键；`Ctrl+S` `Ctrl+T` `Space`、`o/O` `Ctrl+o/Ctrl+O` | 全部动作走「编号定位 + Enter」；`Ctrl+S` 同时承担「开始执行 / 测试并保存 / 保存执行」；备份列表的 `↑↓` 声明失效；唯一接入生成物打开动作的模块之一 |
| aiops | 无单字母键；`Ctrl+S` `Ctrl+T` | 与 database 同构的参数表单 + 菜单流程；主菜单 `Esc/q` 不会离开模块；结果页无键盘滚动 |
| firewall | 无单字母键；`Ctrl+U` | 只有查询表单与结果页；只实现 `GetModal()`、没有 `HandleModalKey`，因此不满足 shell 的 `ModalProvider`，弹框按键完全由模块自己处理 |
| fileexport | 无单字母键；`F2` / `Ctrl+S` | 唯一使用 `F2` 的模块，`F2` 与 `Ctrl+S` 同为「测试并继续」；主菜单的 `Esc/q` 分支是死代码 |
| find | `d`（完成）、`Ctrl+X`（完成）、`←→`（切换单位/列） | 同一动作「完成」有两个键；条件编辑器有 7 个以上未声明的控制键；帮助栏缺少 `/ 筛选` 条目（未实现 `InputShortcuts`） |
| tools | 无单字母键 | 参数页 + 生成结果页；表单字段移动 `↑`/`↓`/`k`/`j` 同向，无法回头 |

生成物打开动作（`o`/`O`、`Ctrl+o`/`Ctrl+O`）目前只有 **database 与 docker** 接入（`database_help.go:121-123`、`docker_controller.go:2394`），clean / find / tools / fileexport / aiops / firewall 即使产生文件也不会出现这两个键。

没有单字母键的模块（database、aiops、firewall、fileexport、tools）目前所有操作都必须先进菜单再 `Enter`，这也是「统一按键」需要重点权衡的地方：给它们补 `a`/`d`/`i` 会显著改变现有操作路径，需要同步补帮助栏与表驱动按键测试。更关键的是——**在列表态补任何字母键之前，必须先解决数字编号缓冲吞字母的问题**（`components/list/compact_delegate.go:490-501`），否则新键在大多数列表页根本收不到。
