const RU_DOCS = {
  "total": 52,
  "groups": [
    {
      "id": "architecture",
      "title": "架构与 TUI",
      "desc": "架构、导航、渲染与交互的维护者契约。",
      "count": 15,
      "docs": [
        {
          "title": "总体架构",
          "file": "architecture.md",
          "desc": "DDD 与整洁架构的五层划分、依赖注入容器、消息总线与服务注册表。",
          "href": "doc.html?file=architecture.md"
        },
        {
          "title": "按需表格搜索与近期路径候选",
          "file": "tui-search-path-history.md",
          "desc": "按需搜索、文件路径候选与近期排序，包含模块隔离、30 天过期与配置候选。",
          "href": "doc.html?file=tui-search-path-history.md"
        },
        {
          "title": "架构流程",
          "file": "architecture-flow.md",
          "desc": "从 Bubble Tea 界面、ViewModel、应用服务到领域层与基础设施的请求流转。",
          "href": "doc.html?file=architecture-flow.md"
        },
        {
          "title": "工作台视觉、前缀提示与功能搜索",
          "file": "tui-command-navigation.md",
          "desc": "工作台视觉、r 前缀提示、F4 功能搜索、翻页与导航保护。",
          "href": "doc.html?file=tui-command-navigation.md"
        },
        {
          "title": "TUI 按键规范",
          "file": "tui-keybindings.md",
          "desc": "单键语义、r 两键序列、覆盖层开关键、编号选择与输入法让行规则。",
          "href": "doc.html?file=tui-keybindings.md"
        },
        {
          "title": "TUI 公共组件开发基线",
          "file": "tui-public-component-development-baseline.md",
          "desc": "公共组件职责、参数表单、表格列宽、弹框与输入调度的接入契约。",
          "href": "doc.html?file=tui-public-component-development-baseline.md"
        },
        {
          "title": "TUI Shell 与布局开发基线",
          "file": "tui-shell-layout-development-baseline.md",
          "desc": "三栏尺寸预算、整页滚动、焦点路由、终端输出接管与差量刷新。",
          "href": "doc.html?file=tui-shell-layout-development-baseline.md"
        },
        {
          "title": "TUI 鼠标与滚轮交互基线",
          "file": "tui-mouse-scroll-interaction-baseline.md",
          "desc": "鼠标坐标层级、事件所有权、单击/双击语义与滚轮边界。",
          "href": "doc.html?file=tui-mouse-scroll-interaction-baseline.md"
        },
        {
          "title": "TUI 标星（关注）功能",
          "file": "tui-favorites-star.md",
          "desc": "模块级与功能项级关注、★ 我的关注分组、s 键与 favorites.json 存储。",
          "href": "doc.html?file=tui-favorites-star.md"
        },
        {
          "title": "TUI 按键现状统计与歧义清单",
          "file": "tui-keybinding-inventory.md",
          "desc": "564 条 HelpBinding 的盘点、跨模块歧义与统一改造候选。",
          "href": "doc.html?file=tui-keybinding-inventory.md"
        },
        {
          "title": "TUI 公共组件迁移任务",
          "file": "tui-public-component-migration-tasks.md",
          "desc": "各模块迁移到公共组件的任务拆分与验收状态。",
          "href": "doc.html?file=tui-public-component-migration-tasks.md"
        },
        {
          "title": "Bubble Tea v2 迁移与真实光标（IME）接入",
          "file": "tui-bubbletea-v2-migration.md",
          "desc": "Charm v1→v2 API 迁移、真实终端光标与输入法候选框跟随编辑位置。",
          "href": "doc.html?file=tui-bubbletea-v2-migration.md"
        },
        {
          "title": "新功能开发指南",
          "file": "new-feature-guidelines.md",
          "desc": "新增模块、命令、界面状态与测试的落地流程。",
          "href": "doc.html?file=new-feature-guidelines.md"
        },
        {
          "title": "TUI 差分渲染兼容补丁",
          "file": "tui-renderer-compatibility.md",
          "desc": "固定渲染器来源、关闭硬滚动、保留差量刷新与逐格终端回放验收。",
          "href": "doc.html?file=tui-renderer-compatibility.md"
        },
        {
          "title": "终端一致性源码对照",
          "file": "tui-terminal-consistency.md",
          "desc": "对照 lazygit / lazydocker 的布局与配色，含 Xshell 256 色兼容基线。",
          "href": "doc.html?file=tui-terminal-consistency.md"
        }
      ]
    },
    {
      "id": "modules",
      "title": "模块、配置与平台",
      "desc": "每个模块的行为、配置与平台边界。",
      "count": 24,
      "docs": [
        {
          "title": "PostgreSQL 数据备份与恢复",
          "file": "database-backup-restore.md",
          "desc": "六种备份格式、内容识别、归档、并行、版本预检与隔离恢复验证。",
          "href": "doc.html?file=database-backup-restore.md"
        },
        {
          "title": "部署模块与简单部署",
          "file": "simple-deploy.md",
          "desc": "配置导入、现役路径过滤、一对一组装、样例导出与内置解包部署。",
          "href": "doc.html?file=simple-deploy.md"
        },
        {
          "title": "AIOps 远程部署与巡检",
          "file": "aiops.md",
          "desc": "ssh/scp 与内置 SSH/SFTP 的远程部署、known_hosts 校验、状态与巡检。",
          "href": "doc.html?file=aiops.md"
        },
        {
          "title": "Find 模块设计",
          "file": "find-module-design.md",
          "desc": "Find 条件构建器的条件模型、模板与历史记录设计。",
          "href": "doc.html?file=find-module-design.md"
        },
        {
          "title": "Find 模块实现",
          "file": "find-module-implementation.md",
          "desc": "Find 模块的实现结构、状态流转与查找执行路径。",
          "href": "doc.html?file=find-module-implementation.md"
        },
        {
          "title": "Find 条件逻辑",
          "file": "find-condition-logic.md",
          "desc": "条件组合、求值顺序与查找边界规则。",
          "href": "doc.html?file=find-condition-logic.md"
        },
        {
          "title": "Docker 离线下载、打包和安装",
          "file": "docker-offline.md",
          "desc": "Docker 离线资源下载、打包与目标机安装流程。",
          "href": "doc.html?file=docker-offline.md"
        },
        {
          "title": "Docker 删除确认与问题总结",
          "file": "docker-deletion.md",
          "desc": "镜像与容器的范围选择、删除确认与错误展开。",
          "href": "doc.html?file=docker-deletion.md"
        },
        {
          "title": "Docker 守护进程配置与代理（daemon.json / systemd）",
          "file": "docker-daemon-config.md",
          "desc": "daemon.json / systemd 代理表单、字段校验、备份与安全写回。",
          "href": "doc.html?file=docker-daemon-config.md"
        },
        {
          "title": "docker run 与 Compose 互转（数据卷挂载）",
          "file": "docker-run-compose-conversion.md",
          "desc": "docker run 与 Compose 的卷挂载、项目名与往返一致性。",
          "href": "doc.html?file=docker-run-compose-conversion.md"
        },
        {
          "title": "Docker 客户端配置",
          "file": "docker_client_config.md",
          "desc": "Docker 客户端配置的读取、选择与写入边界。",
          "href": "doc.html?file=docker_client_config.md"
        },
        {
          "title": "Docker 对照 lazydocker 待办",
          "file": "docker-easydocker-backlog.md",
          "desc": "对照 lazydocker 的能力盘点与待补齐事项。",
          "href": "doc.html?file=docker-easydocker-backlog.md"
        },
        {
          "title": "Docker 工作台审计",
          "file": "docker-workbench-lazydocker-audit-2026-07-24.md",
          "desc": "Docker 工作台与 lazydocker 的界面、交互对照审计。",
          "href": "doc.html?file=docker-workbench-lazydocker-audit-2026-07-24.md"
        },
        {
          "title": "配置说明",
          "file": "config.md",
          "desc": "配置项、默认值、数据目录与加载顺序。",
          "href": "doc.html?file=config.md"
        },
        {
          "title": "配置参考",
          "file": "configuration.md",
          "desc": "完整配置参考与字段说明。",
          "href": "doc.html?file=configuration.md"
        },
        {
          "title": "日志体系与等级规范",
          "file": "logging.md",
          "desc": "logfmt / JSON 双格式、等级落点、结构化字段、轮转与脱敏。",
          "href": "doc.html?file=logging.md"
        },
        {
          "title": "远程地址识别与归一化",
          "file": "remote-address.md",
          "desc": "IP、域名、端口与 http/https 组合的识别和归一化规则。",
          "href": "doc.html?file=remote-address.md"
        },
        {
          "title": "PostgreSQL 用户与数据库权限管理",
          "file": "database-user-management.md",
          "desc": "创建或更新用户、新建或绑定数据库、三档权限与失败回滚。",
          "href": "doc.html?file=database-user-management.md"
        },
        {
          "title": "平台支持",
          "file": "platform-support.md",
          "desc": "Linux、macOS、Windows、WSL 的能力矩阵与门控方式。",
          "href": "doc.html?file=platform-support.md"
        },
        {
          "title": "防火墙管理",
          "file": "firewall.md",
          "desc": "Linux/Windows 防火墙规则、归属范围与验证边界。",
          "href": "doc.html?file=firewall.md"
        },
        {
          "title": "凭证存储与生成位置盘点",
          "file": "credential-storage-inventory.md",
          "desc": "14 类凭证与敏感信息的存储位置盘点及风险点。",
          "href": "doc.html?file=credential-storage-inventory.md"
        },
        {
          "title": "统一凭证与配置存储",
          "file": "credential-store.md",
          "desc": "internal/store 目录布局、命名空间 API、原子写入与密钥迁移。",
          "href": "doc.html?file=credential-store.md"
        },
        {
          "title": "文件中转与 Shell 别名",
          "file": "fileexport.md",
          "desc": "特权文件中转、Shell 别名注册与移动语义。",
          "href": "doc.html?file=fileexport.md"
        },
        {
          "title": "工具模块",
          "file": "tools.md",
          "desc": "生成 Base64、十六进制或纯字母数字随机密码，支持字节数与长度参数。",
          "href": "doc.html?file=tools.md"
        }
      ]
    },
    {
      "id": "release",
      "title": "发布、协作与迁移",
      "desc": "构建、发布、镜像与协作流程。",
      "count": 7,
      "docs": [
        {
          "title": "GitHub 产物发布",
          "file": "github-artifact-release.md",
          "desc": "GitHub 产物发布、Latest 隔离与安装器渠道行为。",
          "href": "doc.html?file=github-artifact-release.md"
        },
        {
          "title": "发布流程",
          "file": "release-workflow.md",
          "desc": "发布产物、并发构建、版本回收与安装器回归。",
          "href": "doc.html?file=release-workflow.md"
        },
        {
          "title": "Gitea Actions 镜像",
          "file": "gitea-actions-mirror.md",
          "desc": "Gitea Actions 镜像、内网来源与 Runner 排障。",
          "href": "doc.html?file=gitea-actions-mirror.md"
        },
        {
          "title": "Nexus APT 缓存与 CI 接入",
          "file": "nexus-apt-cache.md",
          "desc": "Nexus APT 缓存、配额与 CI 接入。",
          "href": "doc.html?file=nexus-apt-cache.md"
        },
        {
          "title": "贡献指南",
          "file": "CONTRIBUTING.md",
          "desc": "贡献指南：测试、Shell 隔离、超时与安全基线。",
          "href": "doc.html?file=CONTRIBUTING.md"
        },
        {
          "title": "迁移说明",
          "file": "MIGRATION.md",
          "desc": "构建清理范围、测试配置隔离与清理回归。",
          "href": "doc.html?file=MIGRATION.md"
        },
        {
          "title": "Neumorphic 弹框 API 清单",
          "file": "neumorphic-modal-api-inventory-2026-07-24.md",
          "desc": "Neumorphic 弹框 API 清单与统一改造记录。",
          "href": "doc.html?file=neumorphic-modal-api-inventory-2026-07-24.md"
        }
      ]
    },
    {
      "id": "quality",
      "title": "质量记录与历史归档",
      "desc": "带日期的审计、回归与历史资料。",
      "count": 6,
      "docs": [
        {
          "title": "质量审计与修复记录（2026-06-21）",
          "file": "quality-audit-2026-06-21.md",
          "desc": "首轮质量审计与修复记录：问题清单、修复与回归。",
          "href": "doc.html?file=quality-audit-2026-06-21.md"
        },
        {
          "title": "当前问题与改进建议审计（2026-06-28）",
          "file": "quality-audit-2026-06-28.md",
          "desc": "当前问题与改进建议：定位、证据与后续动作。",
          "href": "doc.html?file=quality-audit-2026-06-28.md"
        },
        {
          "title": "当前问题与改进建议审计（2026-07-08）",
          "file": "quality-audit-2026-07-08.md",
          "desc": "2026-07-08 的问题清单与改进建议审计。",
          "href": "doc.html?file=quality-audit-2026-07-08.md"
        },
        {
          "title": "质量审计（2026-07-10）",
          "file": "quality-audit-2026-07-10.md",
          "desc": "质量审计：实现、测试、构建与发布边界。",
          "href": "doc.html?file=quality-audit-2026-07-10.md"
        },
        {
          "title": "质量回归审计（2026-07-08）",
          "file": "quality-regression-audit-2026-07-08.md",
          "desc": "变更后的质量回归复验与遗漏项。",
          "href": "doc.html?file=quality-regression-audit-2026-07-08.md"
        },
        {
          "title": "历史技术资料归档",
          "file": "archive/README.md",
          "desc": "历史技术资料归档索引。",
          "href": "doc.html?file=archive/README.md"
        }
      ]
    }
  ]
};

window.RU_DOCS = RU_DOCS;
