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

## 2. 文件是真相；工具管状态，正文直接编辑是正常路径

- 所有数据真相存在 `.lrnev/` 目录下的 Markdown / JSON 文件；`context://` URI 是稳定的访问别名。
- **结构化状态走工具**：spec/task 状态与创建走 `spec_update` / `task_update` / `spec_gate_check` / `spec_create` / `scene_create` / `adr_create` / `memory_save` / `error_record`——**不手改 tasks.md 的状态注释或 spec frontmatter 绕过状态机**（非法转换会被拒绝）。
- **正文类文档没有更新工具，按流程直接编辑是正常路径**：PROJECT / ARCHITECTURE / scene 三件套，以及 requirements / design / tasks 正文（编辑 requirements/design 只限需求细化/文档维护，不能替代 task 登记）。大改后重新调 `summarize_save` 同步 L0/L1——**不手写 sidecar、不生成旧式 `.abstract.md`**。
- 不手建/手删规范文件、不改文件命名；不确定先问用户或跑 `lrnev_doctor`。

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

- 找相关文档/锚点 → `context_search`（治理文档全文检索）；看全景 → `project_status` / `governance_map`
- 不知道用户偏好 → 调 `memory_search` 看是否有偏好记录
- 不知道历史决策 → 调 `adr_list` 看 ADR
- 不知道是否有同类错误 → 调 `error_search`
- 都没找到 → 直接问用户

## 6. Scope 判定看 SCOPE_RULES

写 ADR / Memory / Errorbook 时按 `context://steering/scope` 判定：默认 `global`（更显眼）；**仅在确认仅适用于某个 Scene 时**才用 `scene:{id}`。注：`adr_create` 的 scope 必填（不传即错），其余写入类默认 global；`tentative` 标记仅 `memory_save` 支持。

## 7. 状态机不能跨

状态变更必须走工具且遵守合法转换（非法转换会被拒绝并返回 `INVALID_STATUS_TRANSITION`）：

- **Task**：`pending → in_progress | blocked`；`in_progress → completed | failed | blocked`；`blocked → pending | in_progress`；`failed → pending`（可重试）；`completed` 是终态——返工请新建 task。
- **Spec**：`draft → ready → in-progress → completed → archived`；合法回退 `ready → draft`、`completed → in-progress`（维护增量）；**archived 是终态、只由用户明确决定**——AI 不自动归档，刚创建的 Spec 不得自我回退。

## 8. Gate 失败时先修，不要绕过

`spec_gate_check` 返回 `passed: false` 时，按 `checks` 数组里的 message / hint 修复。
**不要**：
- 假装通过
- 把不达标的内容强行标记 completed

任务全 completed 后跑 `spec_gate_check(gate=completion)`，通过再 `spec_update` 回填 completed（收口动作点）。

## 9. 用 lrnev_doctor 自检

每次对话结束或长时间工作后，建议跑一次 `lrnev_doctor`，检查：
- 是否有 Spec 缺文档
- 是否有 Task 卡在 in_progress 太久
- 是否有 ADR 编号冲突
- 是否有僵死的锁

发现问题及时提醒用户。

## 10. 用户决定优先；如实声明；文档维护时机

- **用户决定优先**：以上皆为建议非强制——用户已明确要求（如"直接帮我建 Spec"）照做即可，即使与建议相左也不劝返。ai_followup 的【执行约束】是系统硬约束；【决策边界】指"未经用户确认不得改变其明确目标"。
- **如实声明**：`scene_create` / `spec_create` / `task_create` / `assess_goal` 可附 `decision_context`（source: `client_asserted`）说明本次调用照用户的什么组织决定来——用户没说过就不编造，不传 = 未声明。
- **文档维护时机**：PROJECT.md = init 补全一次 + 项目定位/阶段变化（用户确认后更新）；ARCHITECTURE.md = 跨 Scene 架构约束/技术栈变化（与 global ADR 联动）；scene.md = Scene 边界/intent 变化；scene architecture.md = 新跨 Spec 共享约束出现；**roadmap.md = Spec 新建/收口/计划变化时同步**；所有文档大改后重新 `summarize_save`（不手写 sidecar）。
