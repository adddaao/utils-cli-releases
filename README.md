# ru 展示站

面向当前仓库项目 `ru`（utils-cli）的静态展示网站：介绍这个本地系统管理工作台的功能模块、TUI 界面、CLI 入口、安装方式、平台边界与技术文档。

> 站点是仓库的展示页，不是发布说明，也不替代官方文档。项目功能、命令与平台边界以仓库 `README.md` 和 `docs/` 为准。

![ru 展示站首页](preview.jpg)

## 本地预览

站点需要和仓库 `docs/` 在同一台静态服务器下，文档阅读页才能实时读取并渲染 Markdown。请在**仓库根目录**启动服务：

```bash
cd utils-cli
python3 -m http.server 4173
# 打开 http://127.0.0.1:4173/showcase/
```

也可以直接打开 `showcase/index.html`，但文档阅读页的 Markdown 抓取会受浏览器 `file://` 限制；此时仍可使用“下载 Markdown”。

## 页面

| 文件 | 内容 |
| --- | --- |
| `index.html` | 首页：Hero TUI 预览、8 个功能模块、工作方式、真实界面截图、CLI、安装、平台矩阵、文档与 CTA |
| `docs.html` | 技术文档索引：4 个分组、52 篇文档，支持标题/简介/文件名筛选与分组定位 |
| `doc.html` | 文档阅读页：按 `file` 参数读取 `docs/` 下的 Markdown，在浏览器内渲染排版，支持本页目录、代码复制、源码切换与下载 |
| `assets/js/data.js` | 文档索引数据（标题、简介、文件路径、分组） |
| `assets/js/site.js` | 主题、TUI 预览切换、CLI/安装标签、命令面板、复制、截图查看、文档筛选与阅读页交互 |
| `assets/js/markdown.js` | 阅读页渲染适配：标题锚点、文档间链接改写、代码块工具条、表格滚动容器、HTML 转义 |
| `assets/js/vendor/marked.umd.js` | 本地引入的 [marked](https://github.com/markedjs/marked) v18.1.3（MIT），许可证见 `assets/js/vendor/marked.LICENSE` |
| `tests/markdown.test.mjs` | 渲染回归：基础语法、全量 `docs/` 的标题/代码块/表格数量与文档链接锚点校验 |
| `publish-gh-pages.sh` | 把站点文件发布到 `adddaao/utils-cli-releases` 的 `gh-pages` 分支 |

## 交互

- **深色 / 浅色主题**：默认深色，切换结果保存在 `localStorage`。
- **TUI 预览**：八个功能模块视图；点击左侧模块或顶部标签切换。
- **命令行**：Docker / 数据库 / AIOps / 诊断 / 工具五组命令，支持一键复制（自动去掉提示符）。
- **安装命令**：Unix / Windows 安装器切换与复制，附离线安装说明。
- **命令面板**：`⌘K` / `Ctrl+K` 搜索页面、模块、命令与 52 篇文档；`/` 在文档页聚焦筛选框。
- **截图查看**：点击 TUI 截图打开大图查看器（`Esc` 关闭）。
- **文档索引**：按关键字过滤文档卡片，侧栏随滚动高亮分组，支持 `docs.html#group-*` 深链。
- **文档阅读**：从索引进入 `doc.html?file=...`，浏览器抓取 Markdown 后按 GitHub 风格渲染；右侧（窄屏为正文上方）显示本页目录，代码块可一键复制，`查看源码` 可对照原文，也可下载 Markdown。文档内的 `.md` 链接会改写为阅读页链接，外部链接新窗口打开。

## 内容来源

- 功能、命令、平台矩阵与版本信息来自仓库 `README.md`、`docs/README.md`、`docs/platform-support.md` 和 `docs/release-workflow.md`。
- 文档索引条目来自 `docs/` 文件清单与 `docs/README.md` 的分组；描述为便于索引而做的摘要。
- 首页三张 TUI 截图来自仓库 `build/` 下的 TUI 预览帧（`table-preview/table.png`、`debug/layout-preview.png`、`style-preview/palette.png`），使用演示数据，不是运行时实时抓屏。
- 当前展示版本为 `v0.3.2-preview.12`（2026-10-26）；GitHub Releases 上的最新正式版为 `v0.2.6`。

## 技术说明

- 纯静态 HTML/CSS/JavaScript，无构建步骤、无前端框架、无 CDN；Markdown 渲染器随站点本地分发，运行时不请求任何第三方资源。
- 字体为本地 IBM Plex Sans / IBM Plex Mono，SIL OFL 1.1，许可证见 `assets/fonts/licenses/`。
- 站点不收集数据、不请求第三方资源；GitHub Releases 与文档下载是显式外链。
- 文档阅读页依赖同源 `fetch(docsBase + file)`；本地为仓库根目录服务时的 `../docs/`，发布到 `gh-pages` 根目录时为 `docs/`，由 `<body data-docs-base>` 指定。
- Mermaid 代码块按源码块展示，不加载 Mermaid 运行时；如需图形化，请在仓库或支持 Mermaid 的编辑器里查看。

## 测试

```bash
node --test showcase/tests/markdown.test.mjs
```

测试会加载真实的 `marked.umd.js` 与 `markdown.js`，渲染仓库 `docs/` 下全部 Markdown，并校验标题/代码块/表格数量、标题锚点唯一性、文档间链接与跨文档锚点。仓库里已存在的失效链接单独登记在 `KNOWN_BROKEN_LINKS`，不参与渲染回归判定。

## 发布

```bash
# 需要已通过 gh 登录 adddaao 账号（repo 权限）
./showcase/publish-gh-pages.sh

# 同时把改动过的公开文档同步到线上快照（只允许 data.js 里已索引的文档）
./showcase/publish-gh-pages.sh "docs: 修正架构图对齐" architecture.md
```

脚本会克隆 `adddaao/utils-cli-releases` 的 `gh-pages` 分支到临时目录，只同步站点自身文件（`index.html`、`docs.html`、`doc.html`、`preview.jpg`、`README.md`、`assets/`），保留线上已有的 `docs/` 快照、`.nojekyll` 与 `.gitignore`；随后把 `doc.html` 的 `data-docs-base` 从 `../docs/` 改写为 `docs/`，按参数复制指定文档到线上 `docs/`，校验索引内 52 篇文档都存在，提交并推送。临时目录用 `trash` 回收。

## 维护提示

- 版本号、模块数量、文档数量与截图说明在 `index.html`、`docs.html`、`doc.html` 和 `assets/js/data.js` 中；更新文档清单时同步修改 `data.js` 与索引页的分组计数。
- 升级 Markdown 渲染器时替换 `assets/js/vendor/marked.umd.js` 与许可证，并同步运行渲染测试；`markdown.js` 只依赖 `marked` 的 `Marked` / `Renderer` 接口。
- 文档阅读页只读取 `docs/` 目录，拒绝绝对路径与 `..`；其目录、复制与源码切换逻辑都在 `site.js` 的 `setupReader` 中。
- 新增或调整阅读页样式时同时检查深色、浅色、窄屏和打印四个场景。
