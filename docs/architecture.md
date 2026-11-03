# Utils-CLI 架构文档

## 概述

本项目采用**领域驱动设计（DDD）**和**整洁架构（Clean Architecture）**原则，实现了清晰的分层架构。整个系统分为四个主要层次：

1. **Presentation Layer（表现层）** - TUI界面
2. **ViewModel Layer（视图模型层）** - UI状态管理
3. **Application Layer（应用层）** - 业务流程编排
4. **Domain Layer（领域层）** - 核心业务逻辑
5. **Infrastructure Layer（基础设施层）** - 技术实现

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                       Presentation Layer                        │
│                        (TUI - Bubbletea)                        │
│                                                                 │
│        ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│        │ CleanModel  │  │ DockerModel │  │  FindModel  │        │
│        └─────────────┘  └─────────────┘  └─────────────┘        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                         ViewModel Layer                         │
│                       (UI状态管理与协调)                        │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ CleanViewModel  │  │ DockerViewModel │  │  FindViewModel  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                        Application Layer                        │
│                    (用例编排与业务流程控制)                     │
│                                                                 │
│           ┌──────────────────┐  ┌──────────────────┐            │
│           │ CleanAppService  │  │ DockerAppService │            │
│           └──────────────────┘  └──────────────────┘            │
│                                                                 │
│           ┌──────────────────┐  ┌──────────────────┐            │
│           │  FindAppService  │  │  FirewallAppSvc  │            │
│           └──────────────────┘  └──────────────────┘            │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                          Domain Layer                           │
│                    (核心业务逻辑与领域模型)                     │
│                                                                 │
│   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│   │    Entities    │  │  ValueObjects  │  │   Aggregates   │    │
│   └────────────────┘  └────────────────┘  └────────────────┘    │
│                                                                 │
│   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│   │ DomainServices │  │  Repositories  │  │  DomainEvents  │    │
│   └────────────────┘  └────────────────┘  └────────────────┘    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                      Infrastructure Layer                       │
│                      (技术实现与外部集成)                       │
│                                                                 │
│           ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│           │   File    │  │  Docker   │  │  Config   │           │
│           │  System   │  │    SDK    │  │  Manager  │           │
│           └───────────┘  └───────────┘  └───────────┘           │
│                                                                 │
│           ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│           │  Logger   │  │  Message  │  │    DI     │           │
│           │           │  │    Bus    │  │ Container │           │
│           └───────────┘  └───────────┘  └───────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 依赖注入容器（DI Container）

**位置**: `internal/container/container.go`

**职责**:
- 管理服务的生命周期
- 支持瞬态（Transient）和单例（Singleton）两种生命周期
- 自动解析服务依赖
- 循环依赖检测

**使用示例**:

```go
container := NewSimpleContainer()

// 注册单例服务
container.Register("clean-service", func(c Container) (interface{}, error) {
    return clean.NewManager(), nil
}, Singleton)

// 注册瞬态服务
container.Register("scanner", func(c Container) (interface{}, error) {
    return clean.NewFileScanner(clean.ScannerConfig{}), nil
}, Transient)

// 解析服务
manager, err := container.Resolve("clean-service")
```

### 2. 消息总线（Message Bus）

**位置**: `internal/messaging/bus.go`

**职责**:
- 实现发布-订阅模式
- 支持同步和异步消息传递
- 模块解耦
- 事件驱动架构

**使用示例**:

```go
bus := messaging.NewInMemoryBus()

// 订阅消息
bus.Subscribe("clean.scan.progress", func(msg messaging.Message) {
    progress := msg.Data().(*CleanScanProgressMsg)
    console.Printf("进度: %d/%d\n", progress.Current, progress.Total)
})

// 发布消息
bus.Publish(messaging.NewBaseMessage("clean.scan.progress", progressData))

// 等待消息处理完成
bus.PublishAndWait(message, 5*time.Second)
```

### 3. 服务注册表（Service Registry）

**位置**: `internal/tui/service_registry.go`

**职责**:
- 集成DI容器和消息总线
- 统一管理应用服务
- 自动注册所有模块服务

**使用示例**:

```go
registry := NewServiceRegistry()

// 注册所有服务
registry.RegisterServices()

// 获取应用服务
cleanService := registry.GetCleanService()
dockerService := registry.GetDockerService()

// 获取消息总线
bus := registry.GetBus()
```

## 分层详解

### Presentation Layer（表现层）

**位置**: `internal/tui/`

**职责**:
- 提供TUI界面
- 处理用户输入
- 显示输出结果
- 委托业务逻辑到ViewModel

**核心组件**:
- `MainModel`: 主TUI模型
- `CleanModel`, `DockerModel`, `FindModel`, `FirewallModel`: 各功能模块的TUI模型

### ViewModel Layer（视图模型层）

**位置**: `internal/tui/viewmodel/`

**职责**:
- 管理UI状态
- 协调应用服务调用
- 处理异步操作
- 转换领域模型到UI模型

**核心组件**:
- `CleanViewModel`: 清理模块的UI状态管理
- `DockerViewModel`: Docker模块的UI状态管理
- `FindViewModel`: 查找模块的UI状态管理

### Application Layer（应用层）

**位置**: `internal/app/`

**职责**:
- 编排业务用例
- 协调领域服务
- 处理应用级事务
- 发布领域事件

**核心组件**:
- `CleanApplicationService`: 清理应用服务
- `DockerApplicationService`: Docker应用服务
- `FindApplicationService`: 查找应用服务
- `FirewallApplicationService`: 防火墙应用服务

### Domain Layer（领域层）

**位置**: `internal/domain/`

**职责**:
- 定义核心业务概念
- 实现业务规则
- 领域服务
- 仓储接口定义

**核心概念**:
- **Entities（实体）**: 有唯一标识的对象
- **Value Objects（值对象）**: 不可变的、无标识的对象
- **Domain Services（领域服务）**: 跨实体的业务逻辑
- **Repositories（仓储）**: 数据访问抽象

### Infrastructure Layer（基础设施层）

**位置**: `internal/`（各模块）

**职责**:
- 实现技术细节
- 外部系统集成
- 数据持久化
- 消息传输

**核心组件**:
- `clean`: 文件扫描和清理
- `docker`: Docker Engine Go SDK 集成
- `find`: 文件查找功能
- `firewall`: 防火墙管理
- `config`: 配置管理
- `logger`: 日志系统

## 设计模式

### 1. 依赖注入（Dependency Injection）

使用DI容器管理服务依赖，实现松耦合。

```go
// 定义服务接口
type CleanService interface {
    Scan(ctx context.Context, paths []string) ([]Entry, error)
}

// 注册服务
container.Register("clean-service", func(c Container) (interface{}, error) {
    return clean.NewManager(), nil
}, Singleton)
```

### 2. 仓储模式（Repository Pattern）

抽象数据访问，隔离业务逻辑与数据存储。

```go
// 仓储接口（领域层）
type CleanRepository interface {
    Save(ctx context.Context, entry *CleanEntry) error
    Find(ctx context.Context, id string) (*CleanEntry, error)
}

// 仓储实现（基础设施层）
type FileCleanRepository struct{}

func (r *FileCleanRepository) Save(ctx context.Context, entry *CleanEntry) error {
    // 实现文件存储
}
```

### 3. 工厂模式（Factory Pattern）

用于创建复杂对象，封装创建逻辑。

```go
// 工厂接口
type ServiceFactory interface {
    CreateService() (CleanService, error)
}

// 工厂实现
type CleanServiceFactory struct {
    config *Config
}

func (f *CleanServiceFactory) CreateService() (CleanService, error) {
    return clean.NewManager(f.config), nil
}
```

### 4. 策略模式（Strategy Pattern）

定义一系列算法，封装每个算法，使它们可互换。

```go
// 策略接口
type CleanRule interface {
    Name() string
    Scan(ctx context.Context, paths []string) ([]Entry, error)
}

// 具体策略
type MavenRule struct{}
type MacOSRule struct{}
type ArchiveRule struct{}

// 使用策略
manager := clean.NewManager()
manager.Register(clean.NewMavenRule())
manager.Register(clean.NewMacOSRule())
```

## 消息流

### 同步消息流

```
TUI Model → ViewModel → Application Service → Domain Service
     ↓            ↓                ↓                      ↓
   更新UI      转换请求        编排用例              执行业务逻辑
     ↑            ↑                ↑                      ↑
   接收事件    监听消息        发布事件                生成事件
```

### 异步消息流

```
Domain Service → Publisher → Message Bus → Subscribers → ViewModel → UI
     ↓                ↓            ↓               ↓              ↓
   生成事件        发布消息     分发消息      处理消息      更新界面
```

## 错误处理

### 错误分类

1. **Domain Errors**: 业务规则违反
   ```go
   return fmt.Errorf("文件不存在: %w", ErrFileNotFound)
   ```

2. **Application Errors**: 用例执行失败
   ```go
   return fmt.Errorf("扫描失败: %w", err)
   ```

3. **Infrastructure Errors**: 技术层面错误
   ```go
   return fmt.Errorf("文件系统错误: %w", err)
   ```

### 错误处理策略

- **领域层**: 抛出领域错误，不处理技术异常
- **应用层**: 捕获技术异常，转换为应用错误
- **表现层**: 显示用户友好的错误信息

## 配置管理

### 配置层次

1. **默认配置**: 代码中定义的默认值
2. **配置文件**: `config.yaml` 或 `config.json`
3. **环境变量**: 覆盖配置文件
4. **命令行参数**: 最高优先级

### 配置示例

```yaml
# config.yaml
clean:
  maven:
    paths:
      - ".m2/repository"
    suffixes:
      - ".lastUpdated"
      - ".sha1"

docker:
  client_type: "cli"  # cli 或 sdk
  path: "./images/"

logging:
  level: "info"
  path: "./logs/ru.log"
```

## 测试策略

### 测试金字塔

```
        /\
       /  \      E2E Tests (少量)
      /____\
     /      \    Integration Tests (适量)
    /________\
   /          \  Unit Tests (大量)
  /____________\
```

### 单元测试

- **目标**: 验证单个组件的正确性
- **覆盖率**: > 80%
- **位置**: `*_test.go` 文件

### 集成测试

- **目标**: 验证组件间的协作
- **重点**: 应用层和领域层
- **位置**: `internal/*/integration_test.go`

### E2E测试

- **目标**: 验证完整的用户流程
- **重点**: 关键业务场景
- **位置**: `tests/e2e/`

## 性能优化

### 并发处理

```go
// 使用worker pool并发扫描
scanner := clean.NewFileScanner(clean.ScannerConfig{
    MaxConcurrency: runtime.NumCPU() * 2,
})

entries, err := scanner.Scan(ctx, paths)
```

### 缓存策略

```go
// 单例服务自动缓存
container.Register("service", factory, Singleton)
```

### 资源管理

```go
// 使用context控制超时
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := service.Execute(ctx)
```

## 扩展性

### 添加新模块

1. **定义领域模型** (`internal/domain/newmodule/`)
2. **实现基础设施** (`internal/newmodule/`)
3. **创建应用服务** (`internal/app/newmodule/`)
4. **实现ViewModel** (`internal/tui/viewmodel/new_viewmodel.go`)
5. **创建TUI模型** (`internal/tui/new_model.go`)
6. **注册服务** (`internal/tui/service_registry.go`)

### 添加新规则

```go
// 实现Rule接口
type NewRule struct{}

func (r *NewRule) Name() string {
    return "New Rule"
}

func (r *NewRule) Scan(ctx context.Context, paths []string) ([]clean.Entry, error) {
    // 实现扫描逻辑
}

// 注册规则
manager.Register(&NewRule{})
```

## 安全考虑

1. **输入验证**: 所有用户输入必须验证
2. **路径安全**: 防止路径遍历攻击
3. **权限检查**: 文件操作前检查权限
4. **敏感信息**: 不记录敏感信息到日志

## 部署

### 构建选项

```bash
# 宿主平台正式构建，产物为 build/release/<os>/<arch>/ 下的完整运行目录
make build-mac      # macOS arm64；Linux/Windows 分别使用 make build-linux / make build-windows

# 临时调试构建，产物进入 build/debug/
make temp
```

### Docker支持

项目统一使用 Docker Engine Go SDK 连接 Docker daemon，不再提供 CLI/build tag 切换模式。构建产物不需要本机安装 `docker` CLI，但运行 Docker 管理功能时必须能访问 Docker daemon。

## 总结

本架构通过清晰的分层和严格的依赖规则，实现了：
- **高内聚低耦合**: 各层职责明确，依赖关系清晰
- **易于测试**: 每层可独立测试，依赖可mock
- **易于扩展**: 添加新功能不修改现有代码
- **可维护性强**: 代码结构清晰，易于理解和修改
