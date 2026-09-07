# Scene 04 Architecture Decision Records

本目录记录 Scene 04 (ai-guidance-standardization) 的关键架构决策。

> **注记（2026-09-07 终审）**：部分 ADR 的决策溯源引用 `ai-discussions/`（本机讨论区，不上 GitHub）；GitHub 端证据链见 `dev-docs/ai-guidance-standardization/` 与 `tests/e2e/t027-baseline/.evidences/`。

## Active ADRs

- [ADR-0001](0001-truncation-semantics.md) - 截断语义类型选择
- [ADR-0002](0002-mvc-escape-contract.md) - MVC 逃逸层级契约
- [ADR-0003](0003-hook-drain-boundary.md) - Hook Drain 边界与超时策略

## ADR 状态说明

- **accepted** - 已接受并正在实施
- **proposed** - 已提议，待评审
- **deprecated** - 已废弃
- **superseded** - 已被其他 ADR 取代

## 创建新 ADR

1. 使用下一个顺序编号（0004, 0005, ...）
2. 文件名：`{number}-{kebab-case-title}.md`
3. 包含以下部分：
   - 背景（Background）
   - 决策（Decision）
   - 后果（Consequences）
   - 实施（Implementation）
   - 参考（References）

## 参考资料

这些 ADR 来自三方（ClaudeCode / Codex / DeepSeek）对 deepseek-harness 能力移植的深入分析：
- 分析文档：`ai-discussions/claude-code/01-03.md`
- 统一确认：`ai-discussions/结果/2026-08-28-三方统一确认-修正版.md`
- 会话日志：`ai-discussions/log/session-log.jsonl`（seq 1-575）
