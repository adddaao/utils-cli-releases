# 架构与流程

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     cmd/ru/main.go                       │
│                    CLI 入口 / TUI 入口                    │
└──────────┬──────────────────────────────────────┬────────┘
           │                                      │
    CLI 子命令                              TUI (bubbletea)
           │                                      │
┌──────────┼──────────────────────────────────────┼────────┐
│          │           internal/tui/               │        │
│  ┌───────┴──────────────────────────────────────┴──┐     │
│  │  MainLayoutModel (导航 + 面包屑 + 内容 + 帮助)     │     │
│  └──┬──────────┬──────────┬──────────┬────────────┘     │
│     │          │          │          │                    │
│  Docker    Clean       Find     Firewall               │
│  Controller Controller Model     Model                  │
└─────┼──────────┼──────────┼──────────┼──────────────────┘
      │          │          │          │
┌─────┼──────────┼──────────┼──────────┼──────────────────┐
│     │    应用服务层 (internal/app/)  │                   │
│     │          │          │          │                   │
│  ┌──┴──┐  ┌───┴───┐  ┌───┴───┐  ┌──┴───┐              │
│  │docker│  │clean  │  │ find  │  │fire  │              │
│  │ app  │  │ app   │  │ app   │  │wall  │              │
│  └──┬──┘  └───┬───┘  └───┬───┘  └──┬───┘              │
└─────┼─────────┼──────────┼──────────┼──────────────────┘
      │         │          │          │
┌─────┼─────────┼──────────┼──────────┼──────────────────┐
│     │    领域层 (internal/domain/)   │                   │
│  docker/   clean/      find/    firewall/               │
│  Entity    Entity      Entity   Entity                  │
│  Repository Repository Repository Repository            │
└─────┼─────────┼──────────┼──────────┼──────────────────┘
      │         │          │          │
┌─────┼─────────┼──────────┼──────────┼──────────────────┐
│     │    基础设施层 (internal/*)      │                   │
│  ┌──┴──┐  ┌──┴───┐  ┌──┴──┐  ┌──┴───┐  ┌──────┐      │
│  │docker│  │clean │  │find │  │fire- │  │config│      │
│  │ sdk  │  │rules │  │exec │  │wall  │  │logger│      │
│  └──────┘  └──────┘  └─────┘  └──────┘  │database│     │
│  ┌──────┐  ┌──────┐  ┌─────┐  ┌──────┐  │trash  │     │
│  │transfer│ │compress│ │fuzzy│ │platform│ │runner │     │
│  └──────┘  └──────┘  └─────┘  └──────┘  └──────┘      │
└─────────────────────────────────────────────────────────┘
```

## 程序启动流程

```mermaid
flowchart TD
    A[main] --> B[initConfig]
    B --> B1{--debug 参数?}
    B1 -->|是| B2[配置路径: build/debug/.ru/config.toml]
    B1 -->|否| B3[配置路径: ~/.ru/config.toml]
    B2 --> B4[ensureInitialized]
    B3 --> B4
    B4 --> B5{文件存在?}
    B5 -->|否| B6[写入内嵌默认配置模板]
    B5 -->|是| B7[viper.ReadInConfig]
    B6 --> B7
    B7 --> B8[Unmarshal → AppConfig]
    B8 --> B9[validateAndNormalize]
    B9 --> B10[启动热更新监听]

    B10 --> C[logger.Init]
    C --> D[database.Init]

    D --> E{有子命令参数?}
    E -->|是| F[cobra.Execute]
    E -->|否| G[tui.StartWithNewLayout]

    G --> G1[NewMainLayoutModel]
    G1 --> G2[注册 Docker/Clean/Find 组件]
    G2 --> G3{平台支持防火墙?}
    G3 -->|是| G4[注册 Firewall 组件]
    G3 -->|否| G5[跳过]
    G4 --> G6[bubbletea.Run]
    G5 --> G6
```

## TUI 导航流程

```mermaid
flowchart LR
    subgraph 主菜单
        D[Docker 管理]
        C[清理工具]
        F[Find 查找]
        W[防火墙管理]
    end

    D --> D1[镜像管理]
    D1 --> D2[容器管理]
    D2 --> D3[网络管理]
    D3 --> D4[系统信息]

    D1 --> D1a[保存镜像]
    D1 --> D1b[加载镜像]
    D1 --> D1c[镜像详情]
    D1 --> D1d[批量导出]
    D1 --> D1e[上传到指定仓库]
    D1e --> D1f[选择本地镜像]
    D1f --> D1g[选择已配置仓库]
    D1g --> D1h[添加目标标签并推送]

    D2 --> D2a[容器列表]
    D2 --> D2b[资源监控]
    D2 --> D2c[日志查看]
    D2 --> D2d[runlike 转换]
    D2 --> D2e[Compose 转换]
	D2d -->|r| D2e
	D2e -->|r| D2d
    D2 --> D2f[卷备份]
    D2 --> D2g{systemd 可用?}
    D2g -->|是| D2h[创建服务]

    C --> C1[选择清理模板]
    C1 --> C2[扫描文件]
    C2 --> C3[预览结果]
    C3 --> C4[确认删除]

    F --> F1[条件构建器]
    F1 --> F2[执行查找]
    F2 --> F3[结果查看]
    F --> F4[使用模板]
    F --> F5[历史记录]

    W --> W1[开放端口]
    W --> W2[关闭端口]
    W --> W3[查看状态]
```

## Docker 镜像保存流程

```mermaid
flowchart TD
    A[选择保存] --> B[列出本机镜像]
    B --> C{交互模式?}
    C -->|是| D[模糊搜索/选择]
    C -->|否| E[使用 filter/ALL]
    D --> F[选择压缩类型]
    E --> F
    F --> F1{压缩类型}
    F1 -->|none| G1[直接 tar]
    F1 -->|gzip| G2[tar + gzip]
    F1 -->|zstd| G3[tar + zstd]
    F1 -->|7z| G4[tar + 7z]
    G1 --> H[并发保存]
    G2 --> H
    G3 --> H
    G4 --> H
    H --> I[进度报告]
    I --> J[完成汇总]
```

## Docker 镜像加载流程

```mermaid
flowchart TD
    A[选择加载] --> B[选择目录/文件]
    B --> C[扫描归档文件]
    C --> D{交互模式?}
    D -->|是| E[选择归档]
    D -->|否| F[加载全部]
    E --> G[并发加载]
    F --> G
    G --> G1{格式?}
    G1 -->|.tar| H1[docker load]
    G1 -->|.tar.gz| H2[gunzip → docker load]
    G1 -->|.tar.zst| H3[zstd -d → docker load]
    G1 -->|.7z| H4[7z x → docker load]
    H1 --> I[进度报告]
    H2 --> I
    H3 --> I
    H4 --> I
    I --> J[完成汇总]
```

## 文件清理流程

```mermaid
flowchart TD
    A[进入清理] --> B[选择模板或自定义]
    B --> C[加载清理规则]
    C --> C1{规则列表}
    C1 --> R1[Maven: .lastUpdated 等]
    C1 --> R2[macOS: .DS_Store 等]
    C1 --> R3[压缩包: .zip 等]
    C1 --> R4[临时文件: .tmp 等]
    C1 --> R5[自定义规则]

    R1 & R2 & R3 & R4 & R5 --> D[并发扫描]
    D --> E[结果表格展示]
    E --> F{用户确认?}
    F -->|确认| G[trash.Move 回收站删除]
    F -->|取消| H[返回]
    G --> I[清理报告: 文件数/释放空间/耗时]
```

## 文件查找流程

```mermaid
flowchart TD
    A[进入 Find] --> B{入口选择}
    B -->|条件构建| C[条件编辑器]
    B -->|模板| D[选择预设模板]
    B -->|历史| E[选择历史记录]

    C --> C1[添加条件组]
    C1 --> C2[设置条件: 名称/大小/时间/权限...]
    C2 --> C3[设置逻辑: AND/OR]
    C3 --> C4[预览命令]
    C4 --> F

    D --> D1[填充模板参数]
    D1 --> F

    E --> E1[重放历史命令]
    E1 --> F

    F[执行 find] --> G[结果展示]
    G --> H{后续操作}
    H -->|保存为模板| I[持久化]
    H -->|新建查找| A
    H -->|返回| J[主菜单]
```

## 防火墙操作流程

```mermaid
flowchart TD
    A[进入防火墙] --> A1{平台检测}
    A1 -->|Linux| A2[检测工具]
    A1 -->|macOS| A3[pfctl]
    A1 -->|Windows| A4[不支持，显示提示]

    A2 --> A2a{检测到?}
    A2a -->|firewalld| B1[firewalld 模式]
    A2a -->|ufw| B2[ufw 模式]
    A2a -->|iptables| B3[iptables 模式]
    A2a -->|无| A5[不可用提示]

    A3 --> C1[pf anchor 模式]
    B1 & B2 & B3 & C1 --> D[操作选择]
    D --> D1[开放端口]
    D --> D2[关闭端口]
    D --> D3[查看规则]
```

## 配置热更新流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant FS as 文件系统
    participant Watcher as config 监听器
    participant Config as config.current
    participant Logger as logger
    participant Callbacks as onConfigChangeCbs

    User->>FS: 修改 config.toml
    FS->>Watcher: fsnotify 事件（监听配置文件所在目录）
    Watcher->>Watcher: 合并连续写事件（120ms）
    Watcher->>Config: store.ReadConfigFile + viper.ReadConfig
    Config->>Config: Unmarshal → validateAndNormalize
    Config->>Callbacks: 触发注册回调
    Callbacks->>Logger: 重新初始化日志
    Note over Logger: 应用新的日志级别/路径
```

监听器由 `internal/config` 自己用 fsnotify 管理，只监听一个配置文件、只占用一个 inotify 实例；同一份配置从相对路径和绝对路径重复加载时会复用同一个监听器。热更新是可选能力：inotify 实例或监听数量被宿主/其他容器耗尽时，`config.Load` 不会失败、更不会终止进程，只记录降级原因（`config.ConfigWatchError()`、错误回调与启动告警），本次运行跳过配置变更监听。不能用 `viper.WatchConfig` 承担这一步：它在监听器创建失败时会直接 `os.Exit(1)`，且默认丢弃日志，会让 `ru version` 这类一次性命令在受限环境里静默退出。

补充约定：配置路径在加载时统一转成绝对路径，因此相对 `--config` 下 `data_dir`、`cache_dir`、`logging.log_path` 的相对值以配置文件所在目录为基准，`ConfigFileUsed()` / `doctor` 展示的也是绝对路径；监听器只匹配配置文件本身的写入/新增事件，不解析符号链接目标，因此 k8s ConfigMap 这类“替换 symlink 目标”的更新不会触发热更新（需要重启或直接写回 `config.toml`）。

## Docker 离线安装流程

```mermaid
flowchart TD
    A[离线安装] --> B{当前平台}
    B -->|Linux| C[继续]
    B -->|其他| D[报错退出]

    C --> E[选择版本]
    E --> F[下载 Docker 二进制]
    F --> G[下载 Docker service 文件]
    G --> H[打包为 tar.gz]
    H --> I[传输到目标机器]

    I --> J[目标机器解压]
    J --> K[复制到 /usr/bin]
    K --> L[注册 systemd 服务]
    L --> M[启动 Docker]
```

## 压缩策略选择

```mermaid
flowchart LR
    A[镜像归档] --> B{压缩类型}
    B -->|none| C[.tar]
    B -->|gzip| D[.tar.gz]
    B -->|zstd| E[.tar.zst]
    B -->|7z| F[.tar.7z]

    C --> G[流式写入]
    D --> G
    E --> G
    F --> H[先 tar 再 7z]
```
