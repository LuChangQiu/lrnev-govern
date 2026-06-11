# lrnev 核心原则

> 本文档由 lrnev 在工作区初始化时自动写入 `.lrnev/steering/CORE_PRINCIPLES.md`。
> AI 客户端在每次对话开始时应通过 `context://steering/core` 加载本文档，
> 把规则纳入系统提示词。

---

## 1. 优先读锚点文档

接手一个已有工作区时，先调 `project_status` 获取 scenes/specs/active_tasks/recent_adrs/open_errors 概览；如果有 in_progress / blocked Task，优先从该 Task 继续。

接到新任务或需要深入上下文时，再按顺序读：

1. `context://project` —— 项目全局概述
2. `context://project/architecture` —— 全局架构
3. `context://auto/codebase` —— 自动分析的技术栈
4. 任务相关 Scene 的 `context://scene/{id}`
5. 任务相关 Spec 的 `context://spec/{scene}/{spec}`

**优先用 L0/L1**（`?level=L0` 或 `?level=L1`），需要时再读 L2 全文，节省 token。

## 2. 文件是真相，URI 是别名

- 所有数据真相存在 `.lrnev/` 目录下的 Markdown / JSON 文件
- `context://` URI 是稳定的访问别名
- 修改时直接调相应的 MCP 工具，不要绕过去手编文件（除非用户明确这么要求）

## 3. 写入工具的 `ai_followup` 必须执行

每个写入工具的响应里有 `ai_followup.instructions`，里面是给你的后续待办：

- 通常包括"生成 L0/L1 摘要并调 `summarize_save`"
- 也可能包括"提示用户做某事"
- **不执行 = 工作未完成**

## 4. ADR 是主动提醒，不擅自生成

当对话中出现下列情况时，**主动询问用户**："这看起来是个值得记录的决策，要生成 ADR 吗？"

触发条件详见 `context://steering/adr`。

**不要**：
- 用户没要求就擅自调 `adr_create`
- 用过时知识凭空生成 ADR

## 5. 不确定就问，不要猜

- 不知道用户偏好 → 调 `memory_search` 看是否有偏好记录
- 不知道历史决策 → 调 `adr_list` 看 ADR
- 不知道是否有同类错误 → 调 `error_search`
- 都没找到 → 直接问用户

## 6. Scope 默认 global

写 ADR / Memory / Errorbook 时，scope 默认 `global`（更显眼）。
**仅在确认仅适用于某个 Scene 时**才用 `scene:{id}`。
详见 `context://steering/scope`。

## 7. 状态机不能跨

`task_update` 必须遵守 Task 状态机：

```
pending → in_progress → completed
        → blocked       → failed → pending（可重试）
```

非法转换会被工具拒绝并返回 `INVALID_STATUS_TRANSITION`。

## 8. Gate 失败时先修，不要绕过

`spec_gate_check` 返回 `passed: false` 时，按 `checks` 数组里的 message / hint 修复。
**不要**：
- 假装通过
- 把不达标的内容强行标记 completed

## 9. 用 lrnev_doctor 自检

每次对话结束或长时间工作后，建议跑一次 `lrnev_doctor`，检查：
- 是否有 Spec 缺文档
- 是否有 Task 卡在 in_progress 太久
- 是否有 ADR 编号冲突
- 是否有僵死的锁

发现问题及时提醒用户。
