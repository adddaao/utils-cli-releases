# 拟态弹框公共能力与接口清单

## 定位

项目中的“拟态弹框”由 `internal/tui/components/list` 提供，不是某个 Docker 私有视图：

- `ModalListModel`：选择、搜索、多选、加载和只读内容弹框的公共状态模型。
- `NewContentModal`：在来源页面上覆盖只读详情、确认信息或短任务结果；不切换到独立页面。
- `OverlayStyle`、`CenterOverlayAt`：圆角边框、背景遮罩与位置叠加的公共渲染层。

业务模块只持有 `*list.ModalListModel`，在自己的 `Update` 中优先转发事件，并在 `View` 时将来源页面作为背景传入；不应私写边框、居中算法、滚动偏移或鼠标拦截。

## 对外构造与配置接口

| 接口 | 用途 | 适用场景 |
|---|---|---|
| `NewModalListModel(title, items, delegate, width, height)` | 创建可选择列表 | 单选、搜索、数字定位、多选列表 |
| `NewLoadingModal(title, message, width, height)` | 创建加载态弹框 | 异步列表尚未返回 |
| `NewContentModal(title, content, footer, width, height)` | 创建只读内容拟态弹框 | 详情、确认、短任务结果 |
| `SetSize(width, height)` | 刷新弹框可用尺寸 | 窗口尺寸变化；`View` 会自动调用 |
| `SetTitle(title)` | 更新标题 | 任务状态从执行中切换到完成/失败 |
| `SetContent(content)` | 替换详情主体并回到首行 | 异步详情或短任务刷新 |
| `SetFooter(footer)` | 更新只读底部状态 | 任务完成状态、附加说明 |
| `SetLoading(loading)` / `SetMessage(message)` | 控制加载态与消息 | 列表异步加载与失败反馈 |
| `SetItems(items)` / `Items()` | 更新或读取列表项 | 异步列表返回、业务同步 |

## 选择与多选接口

| 接口 | 行为 |
|---|---|
| `SetMultiSelect(true)` | 开启公共勾选样式与多选语义。 |
| `SelectedItems()` | 按当前列表顺序返回已勾选项。 |
| `SelectTitles(titles)` | 按标题恢复默认勾选，适用于回显既有配置。 |
| `Update(tea.KeyMsg)` | 处理按键，返回 `(item, confirmed, closed)`；业务层据此确认、关闭或保持弹框。 |

列表模式的公共交互为：`↑↓/k/j` 循环定位，数字键仅定位、`Enter` 确认，`/` 搜索，`Space` 勾选多选项，`Esc/q` 返回来源状态。

## 内容弹框交互

| 输入 | 公共行为 |
|---|---|
| `↑↓`、`k/j` | 按一行滚动。 |
| `PgUp/PgDn` | 以当前可视高度翻页。 |
| `Alt+↑/Alt+↓` | 跳到上一个/下一个 `RenderTableBlock` 标题模块。标题由“标题 + 表头 + 分隔线”结构自动识别。 |
| 鼠标滚轮 | 每次滚动 3 行。 |
| 鼠标其他事件 | 由 `UpdateMouse` 消费，避免背景列表被误操作；左键不关闭弹框，保留终端文本复制。 |
| `Esc/q` | 关闭弹框，回到来源页面。 |

长内容的底部会显示 `第 x-y / total 行`。最后一个标题块若不足一页，组件会以可滚动范围允许的最接近位置显示，保证标题与其内容仍处于同一可视窗口。

## 事件与渲染接口

| 接口 | 业务层责任 |
|---|---|
| `Update(tea.KeyMsg)` | 弹框打开时优先调用；若 `closed` 为真，清理模块持有的弹框指针并恢复来源状态。 |
| `UpdateMouse(tea.MouseMsg) bool` | 弹框打开时优先调用；返回真表示事件已消费，不能继续分发给背景页面。 |
| `View(background, width, height)` | 用当前来源页面渲染结果作为 `background`，输出已叠加的完整画面。 |
| `CenterOverlay` / `CenterOverlayAt` | 公共居中或指定纵向位置叠加。业务通常不直接调用，应优先使用 `ModalListModel.View`。 |
| `PlaceOverlay` / `PlaceOverlayClearedRows` | 低层叠加工具；后者会清空弹框覆盖行，避免背景文字穿透。仅公共组件内部或确有通用需求时使用。 |

## 已有接入与验证

- Docker：离线安装版本选择、文件分析、任务覆盖层、容器工作台概览与完整详情；完整详情支持原值显示的环境变量，便于复制。
- 数据库、清理、AIOps、Find：复用同一个列表/多选/加载模型。
- 公共单测已覆盖：列表选择与多选、内容弹框叠加、按行滚动、翻页、滚轮消费、`Alt+↑/Alt+↓` 标题跳转、关闭和背景事件不穿透。

## 接入边界

1. 结构化内容使用 `table.RenderTableBlock`；这样标题跳转无需业务模块维护偏移量。
2. 快捷键仅在底部帮助栏注册，内容区域不再重复提示操作。
3. 密码、令牌等敏感字段可以在详情内容中显示供复制，但不能进入输入建议、历史候选或日志。
4. 弹框不是独立流程页；关闭后必须回到打开它的原页面与原选择上下文。
