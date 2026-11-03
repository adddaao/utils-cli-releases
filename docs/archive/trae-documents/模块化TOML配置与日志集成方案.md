## 目标

- 将配置文件重构为标准 TOML v1.0 的模块化结构，新增 [docker] 与 [logging] 节。
- 支持相对/绝对路径、嵌套结构、统一小写下划线命名、示例与类型校验。
- 关键词分隔符支持自定义（默认 "\\"），交互时按配置动态触发模糊查询。

## 结构设计

- [docker]
  - path: 导入导出统一目录（save/load 使用同一目录）
  - keyword_delimiter: 模糊查询触发分隔符（默认 "\\"）
- [logging]
  - log_path: 日志文件存储路径（留空则使用数据目录下的 logs/ru.log）
  - max_files: 最大保留文件数（>=1）
  - retention_days: 保留天数（>=1）
  - max_file_size: 单文件最大尺寸（MB，>=1）
  - rotation_policy: 轮转策略（time|size|mixed）
- 其他现有字段保留，新增字段与旧字段在加载后映射，保证兼容。

## 代码改动

- internal/config/config.go
  - 扩展 AppConfig：新增 Docker 与 Logging 子结构体，字段及默认值、类型校验与路径规范化。
  - defaultToml(): 输出模块化 TOML 默认内容（含注释），首次初始化写入。
  - Load(): 读取 layered 配置（默认→文件→环境），合并到结构体，执行 validateAndNormalize()。
  - validateAndNormalize(): 校验 logging/docking 字段约束，创建必要目录，应用 keyword_delimiter。
  - 保持热更新逻辑，变更后重新 Unmarshal 并校验。
  - 兼容旧字段：将 docker.path 映射到旧的 OutputDir；保留 NameTemplate 等。

- internal/ui/select.go
  - SelectImages(): 将模糊查询触发判断从固定 "\\" 改为读取 config.Get().Docker.KeywordDelimiter。

- docs/configuration.md
  - 更新为模块化示例：提供 [docker] 与 [logging] 两节完整示例与中文注释。

## 验证

- make build
- 首次运行 --debug：生成 ./.Rutils/config.toml，包含模块化结构；日志输出 DEBUG 路径与最终值。
- 修改 keyword_delimiter 后交互选择支持新的前缀触发模糊查询。
- 变更 [logging] 字段仍能通过校验；非法值报错说明。
