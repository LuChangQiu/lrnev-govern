# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 [SemVer 2.0](https://semver.org/lang/zh-CN/)。

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

[1.0.0]: https://github.com/luchangqiu/lrnev-govern/releases/tag/v1.0.0
