# Utils-CLI 重构迁移指南

## 概述

本文档帮助开发者从旧架构迁移到新的DDD分层架构。迁移过程分为几个阶段，每个阶段都可以独立完成，不影响现有功能。

## 迁移前准备

### 1. 备份现有代码

```bash
git checkout -b backup-before-migration
git push origin backup-before-migration
```

### 2. 创建迁移分支

```bash
git checkout -b feature/ddd-migration
```

### 3. 理解新架构

阅读 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 了解新架构的设计理念和组件职责。

## 迁移阶段

### 阶段一：基础设施迁移

#### 1.1 依赖注入容器

**旧代码**:
```go
// 直接创建依赖
manager := clean.NewManager()
scanner := clean.NewFileScanner(config)
```

**新代码**:
```go
// 使用DI容器
container := container.NewSimpleContainer()
container.Register("clean-manager", func(c container.Container) (interface{}, error) {
    return clean.NewManager(), nil
}, container.Singleton)

container.Register("scanner", func(c container.Container) (interface{}, error) {
    cfg := c.Resolve("config").(*config.Config)
    return clean.NewFileScanner(cfg.ScannerConfig), nil
}, container.Transient)

// 解析服务
manager, _ := container.Resolve("clean-manager")
```

**迁移步骤**:
1. 创建DI容器实例
2. 将所有服务注册到容器
3. 修改服务创建代码使用容器解析

#### 1.2 消息总线集成

**旧代码**:
```go
// 直接调用方法
result := service.Execute()
```

**新代码**:
```go
// 发布消息
bus.Publish(messaging.NewBaseMessage("service.execute", request))

// 订阅消息
bus.Subscribe("service.complete", func(msg messaging.Message) {
    result := msg.Data()
    // 处理结果
})
```

**迁移步骤**:
1. 在ServiceRegistry中初始化消息总线
2. 将同步调用改为消息发布
3. 订阅感兴趣的消息类型
4. 更新ViewModel监听消息

### 阶段二：领域层迁移

#### 2.1 定义领域模型

**旧代码** (在基础设施层):
```go
// internal/clean/clean.go
type CleanEntry struct {
    Path     string
    Size     int64
    Modified time.Time
}
```

**新代码** (在领域层):
```go
// internal/domain/clean/entity.go
package clean

type CleanEntry struct {
    id       string
    Path     string
    Size     int64
    Modified time.Time
}

func (e *CleanEntry) ID() string {
    return e.id
}
```

**迁移步骤**:
1. 识别核心业务概念
2. 将实体和值对象移到领域层
3. 添加业务方法到领域模型
4. 更新基础设施层使用领域模型

#### 2.2 实现领域服务

**旧代码** (业务逻辑分散):
```go
// 在多个地方都有文件扫描逻辑
func scanFiles(paths []string) ([]Entry, error) {
    // 扫描逻辑
}
```

**新代码** (领域服务):
```go
// internal/domain/clean/service.go
package clean

type CleanDomainService interface {
    Scan(ctx context.Context, paths []string) ([]CleanEntry, error)
}

type CleanDomainServiceImpl struct{}

func (s *CleanDomainServiceImpl) Scan(ctx context.Context, paths []string) ([]CleanEntry, error) {
    // 领域业务逻辑
}
```

**迁移步骤**:
1. 提取跨实体的业务逻辑
2. 创建领域服务接口
3. 实现领域服务
4. 更新调用方使用领域服务

### 阶段三：应用层迁移

#### 3.1 创建应用服务

**旧代码** (TUI直接调用基础设施):
```go
// internal/tui/clean_model.go
func (m *CleanModel) Scan() {
    entries, err := clean.Scan(m.Paths)
    // 处理结果
}
```

**新代码** (通过应用服务):
```go
// internal/app/clean/service.go
package clean

type CleanApplicationService struct {
    domainService clean.CleanDomainService
    publisher     messaging.Publisher
}

func (s *CleanApplicationService) Scan(ctx context.Context, req *ScanRequest) (*ScanResponse, error) {
    entries, err := s.domainService.Scan(ctx, req.Paths)
    if err != nil {
        return nil, err
    }

    s.publisher.Publish(messaging.NewBaseMessage("clean.scan.complete", entries))

    return &ScanResponse{Entries: entries}, nil
}
```

**迁移步骤**:
1. 定义应用服务接口
2. 创建应用服务实现
3. 添加用例（UseCase）
4. 更新TUI使用应用服务

#### 3.2 使用用例模式

**旧代码**:
```go
func (s *CleanService) Execute(cmd string) error {
    switch cmd {
    case "scan":
        return s.scan()
    case "delete":
        return s.delete()
    }
}
```

**新代码**:
```go
// 定义用例
type ScanUseCase interface {
    Execute(ctx context.Context, req *ScanRequest) (*ScanResponse, error)
}

// 实现用例
type ScanUseCaseImpl struct {
    service clean.CleanDomainService
    pub     messaging.Publisher
}

func (uc *ScanUseCaseImpl) Execute(ctx context.Context, req *ScanRequest) (*ScanResponse, error) {
    // 用例逻辑
}
```

**迁移步骤**:
1. 识别应用用例
2. 为每个用例创建接口和实现
3. 编排领域服务调用
4. 处理应用级错误

### 阶段四：ViewModel层迁移

#### 4.1 创建ViewModel

**旧代码** (TUI模型包含所有逻辑):
```go
// internal/tui/clean_model.go
type CleanModel struct {
    entries []Entry
    loading bool
    error   string
}

func (m *CleanModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case ScanMsg:
        m.loading = true
        go m.doScan()
        return m, nil
    case ScanCompleteMsg:
        m.entries = msg.Entries
        m.loading = false
        return m, nil
    }
}
```

**新代码** (ViewModel管理状态):
```go
// internal/tui/viewmodel/clean_viewmodel.go
type CleanViewModel struct {
    *BaseViewModel
    service appclean.CleanService
    bus     messaging.Bus
}

func (vm *CleanViewModel) Scan() {
    state := vm.GetState()
    state.Loading = true
    vm.setState(state)

    req := &appclean.ScanRequest{Paths: state.Paths}

    go func() {
        resp, err := vm.service.Scan(context.Background(), req)
        if err != nil {
            state := vm.GetState()
            state.Error = err.Error()
            state.Loading = false
            vm.setState(state)
            return
        }

        state := vm.GetState()
        state.Entries = resp.Entries
        state.Loading = false
        vm.setState(state)
    }()
}
```

**迁移步骤**:
1. 创建ViewModel继承BaseViewModel
2. 将状态管理移到ViewModel
3. 异步调用应用服务
4. 监听消息总线更新状态

#### 4.2 更新TUI模型

**旧代码**:
```go
type CleanModel struct {
    // 所有状态和方法
}
```

**新代码**:
```go
type CleanModel struct {
    viewmodel *CleanViewModel
}

func NewCleanModel(registry *ServiceRegistry) *CleanModel {
    return &CleanModel{
        viewmodel: registry.GetCleanViewModel(),
    }
}

func (m *CleanModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    // 只处理UI交互
    // 业务逻辑委托给ViewModel
}
```

**迁移步骤**:
1. TUI模型只处理UI交互
2. 所有业务操作委托给ViewModel
3. 通过消息总线接收状态更新
4. 更新UI显示

### 阶段五：集成测试

#### 5.1 测试应用服务

```go
// internal/app/clean/service_test.go
func TestCleanApplicationService_Scan(t *testing.T) {
    // Mock领域服务
    mockDomain := &MockCleanDomainService{
        entries: []clean.CleanEntry{{Path: "test"}},
    }

    service := NewCleanApplicationService(mockDomain, mockPublisher)

    req := &ScanRequest{Paths: []string{"/test"}}
    resp, err := service.Scan(context.Background(), req)

    assert.NoError(t, err)
    assert.Len(t, resp.Entries, 1)
}
```

#### 5.2 测试ViewModel

```go
// internal/tui/viewmodel/clean_viewmodel_test.go
func TestCleanViewModel_Scan(t *testing.T) {
    mockService := &MockCleanService{}

    vm := NewCleanViewModel(mockService, mockBus)
    vm.Scan()

    time.Sleep(100 * time.Millisecond)

    state := vm.GetState()
    assert.True(t, state.Loading)
}
```

## 常见迁移问题

### 问题1: 循环依赖

**症状**:
```
panic: circular dependency detected: service-a -> service-b -> service-a
```

**解决方案**:
1. 重新审视依赖关系
2. 提取共同依赖到第三层
3. 使用消息总线解耦

### 问题2: 状态管理混乱

**症状**:
- 状态在不同层级重复
- 状态更新不一致

**解决方案**:
1. 状态只在ViewModel中管理
2. TUI模型只负责渲染
3. 通过消息总线传递状态变更

### 问题3: 测试困难

**症状**:
- 无法mock依赖
- 集成测试不稳定

**解决方案**:
1. 依赖接口而非实现
2. 使用DI容器注入mock
3. 隔离外部依赖

## 迁移检查清单

### 阶段一: 基础设施
- [ ] 创建DI容器
- [ ] 注册所有服务
- [ ] 初始化消息总线
- [ ] 创建ServiceRegistry

### 阶段二: 领域层
- [ ] 识别领域模型
- [ ] 定义实体和值对象
- [ ] 实现领域服务
- [ ] 定义仓储接口

### 阘段三: 应用层
- [ ] 创建应用服务接口
- [ ] 实现应用服务
- [ ] 定义用例
- [ ] 编排业务流程

### 阶段四: ViewModel层
- [ ] 创建ViewModel
- [ ] 迁移状态管理
- [ ] 集成消息总线
- [ ] 更新TUI模型

### 阶段五: 测试
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 测试覆盖率 > 80%
- [ ] 所有测试通过

## 回滚计划

如果迁移遇到严重问题，可以按以下步骤回滚：

1. 恢复到备份分支
   ```bash
   git checkout backup-before-migration
   ```

2. 或者只回滚特定模块
   ```bash
   git revert <commit-hash>
   ```

3. 重新开始迁移，一次迁移一个模块

## 最佳实践

### 1. 渐进式迁移

不要一次性迁移整个项目。按模块或功能逐个迁移：
- 先迁移一个简单的模块（如Clean）
- 验证迁移效果
- 然后迁移其他模块

### 2. 保持向后兼容

迁移过程中保持旧API可用：
```go
// 旧API（标记为deprecated）
func OldScan() ([]Entry, error) {
    return NewScan().Entries
}

// 新API
func NewScan() (*ScanResult, error) {
    // 新实现
}
```

### 3. 充分测试

每完成一个阶段都要充分测试：
- 单元测试
- 集成测试
- 手动测试

### 4. 文档更新

及时更新文档：
- API文档
- 架构文档
- 用户文档

## 获取帮助

如果遇到问题：

1. 查看 [ARCHITECTURE.md](./ARCHITECTURE.md) 了解架构
2. 查看测试文件了解使用方式
3. 提交Issue描述问题
4. 参考现有已迁移模块

## 总结

迁移到DDD分层架构是一个系统性的工作，需要：

1. **理解新架构**: 先学习再动手
2. **渐进式迁移**: 不要急于求成
3. **充分测试**: 确保每一步都正确
4. **文档记录**: 记录迁移过程和决策

通过遵循本指南，可以顺利完成从旧架构到新DDD架构的迁移，提升代码质量和可维护性。
