# Find 条件组合逻辑设计

## find 命令原生语法

### 逻辑运算符

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `-a` / `-and` | 与（默认） | `-name "*.log" -a -mtime +7` |
| `-o` / `-or` | 或 | `-name "*.log" -o -name "*.txt"` |
| `!` / `-not` | 非 | `! -name "*.bak"` |
| `( )` | 分组 | `\( -name "*.log" -o -name "*.txt" \) -mtime +7` |

### 默认行为

- 多个条件默认使用 AND 连接
- `find . -name "*.log" -size +1M` 等价于 `find . -name "*.log" -a -size +1M`

## TUI 实现方案

### 条件模型扩展

```go
type Condition struct {
    Type     string   // name, size, mtime, user, empty, executable
    Value    string   // 条件值
    Operator string   // eq, gt, lt (用于 size/mtime)
    Not      bool     // 是否取反
}

type ConditionGroup struct {
    Conditions []Condition
    Logic      string // "and" 或 "or"
}

type FindQuery struct {
    Path       string
    Type       string           // f, d, l 或空
    Groups     []ConditionGroup // 支持多组条件
    GroupLogic string           // 组间逻辑: "and" 或 "or"
    Action     Action
}
```

### 交互流程

#### 简单模式（当前）

1. 选择多个条件 → 默认 AND 连接
2. 适合大多数场景

#### 高级模式（扩展）

1. 在条件选择界面增加选项:
   - `[组合逻辑]` - 设置条件间的 AND/OR
   - `[取反条件]` - 对选中条件取反
   - `[条件分组]` - 创建条件组

### 命令生成示例

#### 简单 AND

```
选择: name=*.log, size=+1M
生成: find . -name "*.log" -size +1M
```

#### OR 连接

```
选择: name=*.log OR name=*.txt
生成: find . \( -name "*.log" -o -name "*.txt" \)
```

#### 复杂组合

```
选择: (name=*.log OR name=*.txt) AND size=+1M
生成: find . \( -name "*.log" -o -name "*.txt" \) -size +1M
```

#### 取反

```
选择: NOT name=*.bak, size=+1M
生成: find . ! -name "*.bak" -size +1M
```

## 实现优先级

### 第一阶段（当前）

- 多条件 AND 连接
- 支持单条件取反

### 第二阶段

- 条件间 OR 连接
- 简单分组

### 第三阶段

- 复杂嵌套分组
- 自定义表达式

## Builder 接口设计

```go
type Builder struct {
    query FindQuery
}

func (b *Builder) SetConditionLogic(logic string) *Builder
func (b *Builder) NegateCondition(condType string) *Builder
func (b *Builder) AddGroup(conditions []Condition, logic string) *Builder
func (b *Builder) Build() (string, error)
```
