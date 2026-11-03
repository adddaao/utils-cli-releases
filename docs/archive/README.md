# 历史技术资料归档

正式技术文档的唯一入口是 [docs/README.md](../README.md)。本目录只保存不再作为当前规范维护的历史资料，不能作为新实现的依据；需要复用历史结论时，必须先与当前代码和正式文档核对。

| 目录 | 内容 | 使用边界 |
|---|---|---|
| `trae-documents/` | 从 `.trae/documents/` 迁入的 68 份历史设计、实现与修复记录。 | 仅供追溯，不新增文件。 |
| `ai-workspace/postgres-release-validation/` | PostgreSQL 发布工具实测的历史计划、发现与执行记录。 | 仅供追溯，不作为当前工作台任务文件。 |

`.trae/specs/` 仍是 AI 任务过程材料，不是正式技术文档；其中涉及架构、接口或行为约束时，必须链接到 `docs/README.md` 下的正式文档。
