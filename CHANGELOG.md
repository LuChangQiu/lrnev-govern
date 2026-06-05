# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 [SemVer 2.0](https://semver.org/lang/zh-CN/)。

## [1.1.0] - 2026-06-05

围绕"Spec 生命周期收尾"与"防止小事乱开 Spec"做的一组治理增强。

### Added

- **新增 `spec_update` 工具**（MCP + CLI）：按状态机更新 Spec 状态（draft→ready→in-progress→completed→archived），非法转换会被拒绝并给出可走的目标。此前只能手编 frontmatter，AI 无法正规地回填或归档 Spec 状态。

### Changed

- **`project_status` 尊重 `archived` 状态**：已归档的 Spec 仍出现在列表（保留历史），但它的待办任务不再计入 `claimable_next` / `free_tasks_count` / 活跃任务，避免被取代的旧版污染接手快照。
- **开重写版时引导归档旧版**：`spec_create --version` 检测到同名旧版时，followup 提示可用 `spec_update` 把旧版标 `archived`（不自动归档，判断权在 AI/用户）。
- **`spec_get` 对已实现的 Spec 提示考虑开新版**：仅当 Spec 有已完成任务或已 completed 时出声，其余情况零噪音。
- **强化"该不该开 Spec"的引导**：工具描述、工作流说明和提示词模板统一改为"先自问能否写出 WHEN…THEN 验收且可独立交付——是才开 Spec；改文档/小重构/调参数/答问题等小改动直接做、不要开 Spec"。修正了 AI 倾向把小修小补都开成独立 Spec 的问题。
- **README 面向新用户重写介绍**：补充"为什么用它/不用会怎样""只引导不强制的宗旨""token 成本说明""什么是 Spec"等，降低上手门槛。

## [1.0.1] - 2026-06-04

### Changed

- MCP 服务启动时检测工作区向上误命中：若 `lrnev-mcp` 在非项目目录启动且通过向上查找命中祖先 `.lrnev`，server instructions 中会显示明确警告并提供修正方式(`LRNEV_WORKSPACE` 环境变量)。

## [1.0.0] - 2026-06-04

首次公开发布。lrnev 是确定性的 AI 开发流程治理工具：文件即真相、零模型依赖，通过 MCP 服务 `lrnev-mcp` 与 CLI `lrnev` 双入口，让 Claude Code、Cursor、Codex 等客户端按 Scene → Spec → Task 流程治理开发。

### 本版本包含

- **双入口共享同一套 core**：MCP 服务 `lrnev-mcp` 与 CLI `lrnev` 共用 `.lrnev/` 文件系统工作区，能力一一对等。
- **治理对象**：Scene（业务场景）、Spec（可交付特性，三文档 requirements/design/tasks）、Task（执行单元），以及 ADR、Errorbook、Memory、Summary 等轻产物。
- **三档 Gate**：creation / ready / completion，只校验结构契约、必填哨兵与验收清单状态，不替 AI 判断质量。
- **接手快照 `project_status`**：有界返回（计数 + 活跃项 + `claimable_next` 可领取任务 + 按 scene 过滤），不随历史膨胀。
- **多窗口协作**：agent registry + 心跳，Task claim 运行态软占用（原子登记、心跳续租、过期可重领、`touches_files` 文件重叠提示），状态更新时自动 claim/release。
- **拆分粒度引导**：`scene_create` 给出 Spec 拆分标尺 + 启发式辅助信号；`task_create` 引导按需拆子任务——均只给提示，不替 AI 决定。
- **Hooks 系统**：在 Spec/Task/ADR/Errorbook/Gate 事件后执行本地命令，CLI/MCP 可查看、触发、启停与读日志。
- **存量项目接入**：`lrnev init` 最小探测已有代码、预填确定信息，不传项目名时默认用当前文件夹名。
- **写入类工具返回 `ai_followup`**，把可执行的下一步建议交还给 AI 客户端。
- **客户端常驻提示词模板**，帮助长对话压缩后仍按 lrnev 流程工作。

---

[1.1.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.1.0
[1.0.1]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.0.1
[1.0.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.0.0
