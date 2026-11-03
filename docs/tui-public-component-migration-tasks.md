# TUI 公共组件迁移任务功能文档

本文档记录 TUI 公共组件迁移专项的目标、范围、任务拆分、验收标准和回归要求。当前代码可以通过测试和构建，但公共组件、业务模块和应用壳仍大量处在 `internal/tui` 根目录的 legacy 过渡状态；本专项的目标是把可复用能力沉入公共组件，把业务状态机收敛到模块目录，把布局导航收敛到 shell 层。

## 背景与当前状态

当前 TUI 分层已经有明确规则：

- 公共组件应放入 `internal/tui/components/` 下的分级子目录。
- 业务模块应放入 `internal/tui/modules/<module>/`。
- 应用壳、布局、导航、面包屑应放入 `internal/tui/shell/`。
- 仍在 `internal/tui` 根目录的文件属于迁移期 legacy。

截至本次审计，`internal/tui` 根目录仍有 48 个 Go 文件。当前已通过质量守卫阈值，但根目录仍承载了大量公共组件、业务控制器和 shell 职责。

已存在的新结构：

- `internal/tui/components/execution/status_theme.go`
- `internal/tui/modules/aiops/`
- `internal/tui/shell/keys.go`

仍在 legacy 根目录的主要公共组件：

- `table.go`
- `parameter_form.go`
- `modal_list.go`
- `compact_delegate.go`
- `task_execution.go`
- `path_suggest.go`
- `inline_editor.go`
- `generated_actions.go`
- `help_bar.go`
- `breadcrumb.go`
- `breadcrumb_flows.go`

仍在 legacy 根目录的主要业务模块：

- `docker_controller.go`
- `clean_controller.go`
- `database_controller.go`
- `find.go`
- `finder_condition.go`
- `firewall.go`

仍在 legacy 根目录的主要 shell 文件：

- `app.go`
- `app_state.go`
- `main_layout.go`
- `main_menu.go`
- `navigation.go`
- `content_area.go`
- `layout.go`
- `module_registry.go`
- `service_registry.go`
- `messages.go`

## 目标

### 功能目标

1. 公共 TUI 能力可被所有模块通过稳定包路径复用。
2. 业务控制器只保留业务状态、服务调用和薄适配逻辑。
3. 布局、导航、帮助栏、面包屑和模块注册收敛到 shell 层。
4. 新增 TUI 功能不再向 `internal/tui` 根目录平铺文件。
5. 公共组件迁移后保持现有交互行为不变。

### 质量目标

1. `make test`、宿主平台对应的 `make build-mac` / `make build-linux` / `make build-windows`、`git diff --check` 必须通过。
2. 已有 TUI 单元测试不因迁移丢失覆盖。
3. 每个公共组件迁移都必须同步迁移或补齐对应测试。
4. `internal/tui/components/README.md`、`AGENTS.md`、`internal/tui/CLAUDE.md` 中的组件规则必须与实际包路径一致。
5. 根目录 legacy 文件数量应随阶段逐步下降，不能只靠阈值卡住新增文件。

## 非目标

1. 不在本专项中重写 Docker、Clean、Database、Find、防火墙等业务逻辑。
2. 不改变现有快捷键语义、面包屑语义或执行流程语义。
3. 不引入新的 TUI 框架或平行组件体系。
4. 不为了迁移做大规模无业务收益的重命名。
5. 不在工程内新增临时 Go 缓存目录或根目录临时二进制。

## 设计原则

1. 先迁公共组件，再迁业务模块，最后迁 shell 聚合层。
2. 每次迁移保持小步可验证，避免一次移动过多文件导致 import 回归难定位。
3. 公共组件不允许依赖 Docker、清理、数据库、Find、防火墙、AIOps 等业务包。
4. 组件包可以依赖更底层的主题、样式、文本截断和按键模型，但不能反向依赖 shell 或模块。
5. 如果迁移会造成循环依赖，先抽出低层公共类型或主题接口，再移动组件。
6. 对外可见行为保持一致，迁移阶段可以保留临时兼容别名，但必须明确清理任务。

## 目标目录结构

建议迁移后的目标结构如下：

```text
internal/tui/
  components/
    actions/
    execution/
    form/
    list/
    path/
    table/
    theme/
  modules/
    aiops/
    clean/
    database/
    docker/
    find/
    firewall/
  shell/
    app/
    breadcrumb/
    help/
    layout/
    navigation/
    registry/
  unified/
  viewmodel/
```

说明：

- `components/theme/` 用于沉淀跨组件样式、宽度和文本处理，避免组件迁移后反向依赖 root `tui` 包。
- `components/table/` 负责结构化表格。
- `components/list/` 负责紧凑菜单、弹框列表、编号定位和多选标记。
- `components/form/` 负责参数表单、字段校验和内联编辑。
- `components/path/` 负责路径显示、路径建议和补全。
- `components/execution/` 负责执行信息、执行日志、进度和状态主题。
- `components/actions/` 负责生成物后续动作。
- `shell/` 负责应用壳、布局、帮助栏、面包屑、导航和模块注册。

## 任务拆分

### 任务 1：公共主题与底层工具边界

范围：

- 梳理 `style.go`、`util.go` 中被表格、表单、列表、执行视图共用的内容。
- 抽出组件可依赖的底层主题或文本工具包。
- 避免后续组件迁移时出现 `components/*` 反向依赖 `internal/tui` root 包。

候选文件：

- `internal/tui/style.go`
- `internal/tui/util.go`
- `internal/tui/table.go`
- `internal/tui/parameter_form.go`
- `internal/tui/modal_list.go`
- `internal/tui/task_execution.go`

验收标准：

- 组件包可以引用底层主题或工具，不需要 import root `internal/tui`。
- 原有样式输出不出现大面积视觉变化。
- 相关测试通过。

### 任务 2：迁移表格组件

目标包：

- `internal/tui/components/table`

迁移内容：

- `TableColumn`
- `TableAlign`
- `RenderTableBlock`
- `RenderTableRow`
- `FitTableColumns`
- 表格截断、对齐、低优先级列隐藏逻辑。

候选文件：

- `internal/tui/table.go`
- `internal/tui/table_test.go`

需要更新的调用方：

- Docker 详情、监控、Compose 结果页。
- Clean、Database、Find、AIOps 等结构化结果页。
- 参数表单和执行视图中复用表格的部分。

验收标准：

- 窄宽度截断、低优先级列隐藏、长 ID 和长路径不撑破布局。
- 所有调用方通过新包路径使用表格能力。
- 旧 root 表格实现被删除或只保留明确标注的临时兼容别名。

### 任务 3：迁移列表组件

目标包：

- `internal/tui/components/list`

迁移内容：

- `ModalListModel`
- `ModalListItem`
- `SubmenuListConfig`
- 紧凑菜单 delegate。
- 编号定位、多位编号、无效编号提示。
- 多选标记和循环选择。

候选文件：

- `internal/tui/modal_list.go`
- `internal/tui/modal_list_test.go`
- `internal/tui/compact_delegate.go`
- `internal/tui/compact_delegate_test.go`

需要更新的调用方：

- Docker 子菜单和弹框。
- Database 操作选择。
- AIOps 参数选择。
- Find 条件选择。
- 其他模块功能菜单。

验收标准：

- 数字键只定位，不直接执行。
- 超过 9 项时支持连续数字输入。
- 多选列表使用公共选择标记，不手写 `[ ]` 或 `[x]`。
- `Space` 勾选，`Enter` 确认。
- 列表上下选择支持首尾循环。

### 任务 4：迁移参数表单和内联编辑

目标包：

- `internal/tui/components/form`

迁移内容：

- `ParameterFormField`
- `RenderParameterFormFields`
- `RenderParameterFormFieldsLayout`
- `RenderParameterFormFieldsPinned`
- `RenderParameterForm`
- `ValidateParameterFormFields`
- `FirstInvalidParameterFormFieldIndex`
- `ParameterFormWidth`
- `ParameterFormEditorWidth`
- `InlineEditor`

候选文件：

- `internal/tui/parameter_form.go`
- `internal/tui/parameter_form_test.go`
- `internal/tui/inline_editor.go`
- `internal/tui/inline_editor_test.go`

需要更新的调用方：

- Docker 参数配置。
- Database SQL 导出配置。
- AIOps 参数页。
- Find 条件编辑。
- 其他确认页和编辑页。

验收标准：

- 参数配置页继续使用“字段 / 值 / 类型或说明”结构化表单。
- 字段说明和校验消息由公共说明区展示，不混入可编辑行。
- 枚举项继续通过选择或切换表达，不伪装成普通输入。
- 输入态帮助栏只显示当前编辑器真实支持的按键。

### 任务 5：迁移路径输入和补全

目标包：

- `internal/tui/components/path`

迁移内容：

- `StartEmptyPathInput`
- `UpdatePathInputSuggestions`
- `RefreshPathInputSuggestions`
- `ResolveEmptyPathToCWD`
- `DisplayPath`
- `DisplayPathWithCWD`
- `CompactPath`
- `RenderPathSuggestions`
- `RenderPathSuggestionsWithSelection`
- `RenderPathSuggestionsBox`
- `CompletePathInput`
- `MovePathSuggestionSelection`
- `SelectedPathSuggestion`

候选文件：

- `internal/tui/path_suggest.go`
- `internal/tui/path_suggest_test.go`

需要更新的调用方：

- Docker 文件路径输入。
- Database SQL 导出路径。
- Find 路径条件。
- 其他文件或目录生成路径输入。

验收标准：

- 空输入解析为当前目录。
- 路径显示支持省略和当前目录标识。
- `Tab` 补全、上下移动候选、`Enter` 采用候选行为保持一致。
- 路径建议不撑破父容器。

### 任务 6：迁移执行任务视图

目标包：

- `internal/tui/components/execution`

迁移内容：

- `TaskExecutionModel`
- `NewTaskExecutionModel`
- `NewSimpleTaskExecutionModel`
- 执行信息表格。
- 执行日志滚动。
- 状态主题。
- 任务结果合并展示。

候选文件：

- `internal/tui/task_execution.go`
- `internal/tui/task_execution_test.go`
- `internal/tui/components/execution/status_theme.go`
- `internal/tui/components/execution/status_theme_test.go`

需要更新的调用方：

- Docker 导出、复制、提交、Compose 等执行流程。
- AIOps 执行流程。
- Database SQL 导出。
- Clean 执行流程。

验收标准：

- 执行中必须展示执行日志，不退化成单行“正在执行”。
- 执行信息使用表格展示任务、目标、路径、状态。
- 最终结果通过执行视图合并展示，错误追加到日志。
- 任务完成后回到自身流程，不跳错模块状态。

### 任务 7：迁移生成物后续动作

目标包：

- `internal/tui/components/actions`

迁移内容：

- `GeneratedActions`
- `GeneratedArtifact`
- 打开文件、打开目录、复制路径等动作注册。

候选文件：

- `internal/tui/generated_actions.go`
- `internal/tui/generated_actions_test.go`

需要更新的调用方：

- Database SQL 导出。
- Docker 导出。
- AIOps 生成结果。
- 其他生成文件或目录的模块。

验收标准：

- 生成物动作只通过帮助栏暴露。
- 内容区不新增“打开文件”“打开目录”等操作提示。
- 错误能从公共组件向业务控制器传播。

### 任务 8：迁移帮助栏、面包屑和 shell 基础能力

目标包：

- `internal/tui/shell/help`
- `internal/tui/shell/breadcrumb`
- `internal/tui/shell/navigation`
- `internal/tui/shell/layout`
- `internal/tui/shell/registry`

迁移内容：

- `HelpBinding`
- `NewHelpBinding`
- `VisibleHelpBindingItems`
- `HelpBindingsAllowKey`
- `HelpBar`
- 面包屑结构和流程注册。
- 导航、布局、模块注册。

候选文件：

- `internal/tui/content_area.go`
- `internal/tui/help_bar.go`
- `internal/tui/breadcrumb.go`
- `internal/tui/breadcrumb_flows.go`
- `internal/tui/navigation.go`
- `internal/tui/main_layout.go`
- `internal/tui/main_menu.go`
- `internal/tui/module_registry.go`
- `internal/tui/service_registry.go`

验收标准：

- 模块私有按键必须通过 `GetHelpBindings()` 注册。
- 布局层只消费当前状态允许的按键。
- 面包屑反映当前真实状态，不退化到泛化占位。
- shell 层不依赖具体业务模块的私有状态。

### 任务 9：迁移业务模块

目标包：

- `internal/tui/modules/docker`
- `internal/tui/modules/clean`
- `internal/tui/modules/database`
- `internal/tui/modules/find`
- `internal/tui/modules/firewall`

迁移内容：

- 业务控制器。
- 业务状态枚举。
- 业务薄适配函数。
- 模块私有测试。

候选文件：

- `internal/tui/docker_controller.go`
- `internal/tui/clean_controller.go`
- `internal/tui/database_controller.go`
- `internal/tui/find.go`
- `internal/tui/find_shared.go`
- `internal/tui/finder_condition.go`
- `internal/tui/firewall.go`

验收标准：

- 业务模块通过 `components/*` 和 `shell/*` 使用公共能力。
- 业务模块不复制表格、表单、弹框、路径补全、执行视图逻辑。
- 每个模块保留或补齐核心状态测试。
- Docker 这类大控制器分批迁移，不一次性混合行为改动和目录移动。

### 任务 10：清理兼容层和质量守卫

范围：

- 清理 root `internal/tui` 下已迁移组件的临时别名。
- 更新质量守卫，防止已迁移组件回流到 legacy 根目录。
- 更新文档中的组件路径。

候选文件：

- `scripts/check-quality.sh`
- `internal/tui/components/README.md`
- `AGENTS.md`
- `internal/tui/CLAUDE.md`
- `docs/new-feature-guidelines.md`

验收标准：

- 已迁移组件不再在 root 包保留完整实现。
- 新增公共组件只能进入 `internal/tui/components/`。
- 质量守卫能识别明显的回流风险。
- 文档中的路径和实际包路径一致。

## 推荐执行顺序

1. 公共主题与底层工具边界。
2. 表格组件。
3. 列表组件。
4. 参数表单和内联编辑。
5. 路径输入和补全。
6. 执行任务视图。
7. 生成物后续动作。
8. 帮助栏、面包屑和 shell 基础能力。
9. Clean、Database、Find、防火墙等中小模块。
10. Docker 模块。
11. 清理兼容层和强化质量守卫。

说明：

- Docker 控制器体量最大，应放在公共组件稳定之后处理。
- 表格、列表、表单是最多模块复用的基础能力，应优先迁移。
- shell 层迁移要等公共组件包路径稳定后再做，避免同时改动 import 边界和状态流。

## 回归验证要求

每个阶段至少执行：

```bash
make test
make build-mac        # 其他宿主平台改用 make build-linux / make build-windows
git diff --check
```

涉及文档、质量守卫或脚本时，额外检查：

```bash
scripts/check-quality.sh
```

涉及 TUI 宽度、表格、表单、执行视图时，测试应覆盖：

- `80x24`
- `100x30`
- `120x40`

涉及列表和弹框时，测试应覆盖：

- 数字键只定位。
- 多位编号。
- 无效编号提示。
- `Enter` 确认。
- `Space` 多选。
- 首尾循环。

涉及帮助栏和按键消费时，测试应覆盖：

- 帮助栏显示项。
- 未注册按键不生效：模块在状态机入口丢弃未声明的控制键，表驱动断言“状态 → 处理器实际消费的按键”全部已声明，未声明控制键不改变状态、不打开弹框。
- 列表/详情/输入模式的公共导航键通过 `shell.WithPageNavigationBindings` 与 `UnifiedPageModel.NavigationMode()` 声明，模块自绘子状态必须抑制页面导航声明。
- 输入态方向键和 `Tab` 只在注册后生效。
- `Esc/q` 是否返回由当前状态注册决定。

涉及执行任务时，测试应覆盖：

- 执行信息表格。
- 执行日志区域。
- 进度更新。
- 成功结果合并。
- 失败原因追加到日志。
- 完成后回到自身目标状态。

## 文档同步要求

每个阶段完成后必须同步检查：

- `internal/tui/components/README.md`
- `AGENTS.md`
- `internal/tui/CLAUDE.md`
- `docs/new-feature-guidelines.md`
- 相关模块文档，例如 `docs/aiops.md`、`docs/find-module-design.md`、`docs/find-module-implementation.md`

同步原则：

1. 已迁移组件必须使用新路径。
2. 过时规则要删除或改写，不能只追加新规则。
3. 文档要描述最终使用方式，不保留容易误导的新旧混合路径。
4. 用户可见说明使用中文。

## 风险与处理策略

### 循环依赖风险

风险：组件迁入 `components/*` 后仍需要 root `tui` 的样式、帮助栏或工具函数，可能形成循环依赖。

处理：

- 先抽 `components/theme` 或更低层工具包。
- 组件通过参数或 option 接收外部样式。
- shell 可以依赖 components，components 不能依赖 shell。

### 行为回归风险

风险：纯移动文件时顺手改了状态机、快捷键或渲染细节。

处理：

- 一个阶段只处理一类组件。
- 行为改动和目录迁移分开提交。
- 迁移前后保留同一组测试断言。

### 兼容别名长期残留风险

风险：root `tui` 包保留大量 type alias 后，调用方继续使用旧路径，迁移没有真正完成。

处理：

- 兼容别名只作为短期过渡。
- 每个阶段记录别名清理任务。
- 最终通过质量守卫禁止已迁移组件回流。

### 文档漂移风险

风险：`AGENTS.md`、`internal/tui/CLAUDE.md`、`components/README.md` 中的路径和规则再次分叉。

处理：

- 每个阶段把文档同步列入验收。
- 避免复制大段规则，优先引用权威文档。
- 改规则时删除冲突旧规则。

## 完成判定

本专项完成时应满足：

1. 公共组件完整迁入 `internal/tui/components/*`。
2. 业务模块不再直接依赖 root `tui` 中的公共组件实现。
3. shell 相关能力迁入 `internal/tui/shell/*`。
4. `internal/tui` 根目录只保留必要入口、过渡聚合或极少数 legacy 文件，并有明确后续处理说明。
5. 文档中的组件路径、接入方式和测试要求与实际代码一致。
6. `make test`、宿主平台对应的 `make build-mac` / `make build-linux` / `make build-windows`、`git diff --check` 全部通过。
7. 质量守卫能阻止新增公共组件继续平铺到 root `internal/tui`。
