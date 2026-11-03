# 清理模块重构计划 (Refactor Maven to Generic Clean Module)

## 1. 模块架构设计 (internal/clean)
将 `internal/maven` 重构为 `internal/clean`，采用 **策略模式** 管理不同的清理规则。

### 1.1 核心接口 (`internal/clean/interface.go`)
定义统一的清理规则接口，支持扩展：
```go
type Rule interface {
    ID() string             // 规则唯一标识 (e.g., "maven", "npm_cache")
    Name() string           // 规则显示名称
    Description() string    // 规则描述
    Execute(ctx context.Context, dryRun bool) (Result, error) // 执行清理
}

type Result struct {
    DeletedFiles []string
    FreedSpace   int64
    Errors       []error
}
```

### 1.2 规则管理器 (`internal/clean/manager.go`)
- **注册机制**：支持内置规则注册与动态加载自定义规则。
- **执行模式**：支持“全量执行”、“交互选择执行”、“指定规则执行”。
- **线程安全**：使用 `sync.Mutex` 管理规则列表，支持并发执行（可选）。

## 2. 规则实现 (`internal/clean/rules/`)

### 2.1 Maven 清理规则 (迁移与适配)
- 将 `internal/maven/clean.go` 逻辑迁移至 `internal/clean/rules/maven.go`。
- 实现 `Rule` 接口。
- **兼容性**：继续读取 `config.Maven` 配置作为默认参数，同时支持从新配置覆盖。

### 2.2 通用清理规则 (自定义规则扩展)
- 实现 `GenericRule`，支持通过配置文件定义简单的清理任务（路径 + 后缀/正则）。
- 允许用户在配置文件中添加多个自定义清理任务（如 `log_cleaner`, `temp_cleaner`）。

## 3. 配置系统更新 (`internal/config/config.go`)

### 3.1 新增配置结构
在 `AppConfig` 中添加 `Clean` 模块：
```go
type Clean struct {
    // 自定义通用规则列表
    CustomRules []struct {
        Name     string   `mapstructure:"name"`
        Paths    []string `mapstructure:"paths"`
        Suffixes []string `mapstructure:"suffixes"`
        Enabled  bool     `mapstructure:"enabled"`
    } `mapstructure:"custom_rules"`
}
```
*保持 `Maven` 结构不变以确保向后兼容。*

## 4. CLI 与交互升级 (`internal/clean/cmd.go`)

### 4.1 新增 `clean` 命令
- 替换/升级原 `maven` 命令为 `clean`。
- **交互模式**：
  1. 列出所有可用规则（内置 Maven + 用户自定义）。
  2. 用户通过 Checkbox 或编号多选规则。
  3. 确认后批量执行。
  4. 显示汇总报告（删除文件数、释放空间、详细日志）。
- **Flags**：支持 `--dry-run`（空跑预览）。

### 4.2 集成到主程序 (`cmd/dit/main.go`)
- 更新主菜单：`2) maven` -> `2) clean (清理工具)`。
- 注册 `clean.NewCmd()`。
- 移除旧的 `internal/maven` 调用。

## 5. 执行步骤

1.  **基础建设**：创建 `internal/clean` 包，定义 `Rule` 接口与 `Manager`。
2.  **迁移 Maven**：将 Maven 清理逻辑封装为 `MavenRule` 并注册。
3.  **实现通用规则**：开发 `GenericRule` 并实现从配置加载自定义规则的逻辑。
4.  **更新配置**：修改 `config.go` 与 `defaultToml`，添加自定义规则示例。
5.  **CLI 实现**：开发交互式选择界面与执行反馈流。
6.  **替换集成**：修改 `main.go`，移除旧 `internal/maven`，接入新模块。
7.  **验证与文档**：编写测试用例，生成使用文档。

## 6. 交付物
- 重构后的代码库。
- `docs/clean_module.md` 使用说明。
- 单元测试覆盖核心逻辑。