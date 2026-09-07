---
spec: '08-00-guidance-semantic-boundary'
scene: '01-findings-remediation'
status: draft
priority: P0
created: '2026-08-26'
---

# 08-00 Guidance Semantic Boundary - 需求

## L0 摘要

明确区分 guidance 中的”建议”和”规则”，确保客户端 AI 在用户明确决定与 lrnev Recommendation 冲突时，优先尊重用户决定。

## L1 概览

### 目标

修复当前 guidance 文案中”Recommendation 被误读为 Rule”的语义问题，具体达到：

1. **用户明确要求新建 Spec 时，AI 不会因为”已有 Spec 可以承载”的建议而擅自改成复用旧 Spec**
2. **Spec 创建成功后的 followup 不会诱导 AI 自我回退（删除刚建的 Spec 或改成 task）**
3. **补充两条判断标尺：整体推翻已有需求/设计时通常建议开新版，独立且可验收的新特性通常建议开新 Spec；旧 Spec 上下文冷却时先读摘要，再决定复用还是新建**

### 用户故事

- 作为使用 lrnev 的开发者，当我明确说”帮我新建一个 Spec”时，AI 应该执行我的决定，而不是因为 lrnev 建议”已有 Spec 可以承载”就擅自改成复用旧 Spec
- 作为使用 lrnev 的开发者，当我需要修改较久未更新的旧 Spec 时，AI 应该先识别上下文冷却信号并读取摘要，再结合当前边界建议复用、开新版或创建独立 Spec，而不是仅凭时间替我决定

### 范围

**包含**：
- 修改 6 处高风险文案（`AI-ADAPTATION.md`、`WORKFLOW_OVERVIEW`、`spec_create` 描述、创建后 followup、`SPEC_REWRITE_GUIDANCE`、`GoalAssessor`）
- 补充”需改需求/设计”和”上下文冷了”两条判断标尺
- 创建共享语义常量（全局优先级条款）
- 新增语义回归扫描测试（黑名单 + 白名单）
- 新增执行层非阻断回归测试（已有 Spec 后仍可创建新 Spec）

**不包含**：
- 不引入 `user_intent` 参数（暂时不做，等 E2E 验证后再决定）
- 不引入结构化响应协议（`facts/recommendations/constraints` 字段，暂时只用文本前缀）
- 不引入 Decision Record 或 `.lrnev/decisions/` 目录（现有 `memory_save(category=decisions)` 够用）
- 不改变任何工具的执行逻辑（纯文案修复，不改 `spec_create` / `task_create` 的代码行为）

## L2 详情

### 详细需求

#### F-01 创建共享语义常量

- 描述：新增 `src/shared/guidance-semantics.ts`，定义全局优先级条款：”用户明确表达的决定优先于任何建议；lrnev 可以提示治理建议与利弊，但不得替用户改变决定。建议≠规则，只有结构/状态/完整性约束才会阻断操作。”`WORKFLOW_OVERVIEW` 直接引用该常量；静态 Markdown 复制相同文本，并由测试校验一致性。
- 验收：
  - WHEN 读 `guidance-semantics.ts` THEN 能看到导出的 `USER_DECISION_PRIORITY_CLAUSE` 常量
  - WHEN 读实现和文档 THEN `WORKFLOW_OVERVIEW` 引用该常量，`AI-ADAPTATION.md` 包含与常量完全一致的优先级条款
  - WHEN 跑语义回归测试 THEN Markdown 中的优先级条款与 `USER_DECISION_PRIORITY_CLAUSE` 保持一致

#### F-02 修复客户端常驻规则模板

- 描述：修改 `docs/AI-ADAPTATION.md:142` 规则 3 ②，从当前的”能落到某现有 spec → task_create 落位（不新开 spec）”改为包含三条判断标尺的完整版本：① 需要整体推翻还是增量演进？② 旧 Spec 上下文还热吗？③ 用户明确指定了吗？
- 验收：
  - WHEN 读 `AI-ADAPTATION.md` 规则 3 ② THEN 包含”需要改 requirements/design 且变化是整体推翻 → 通常建议开新版（version+1）保留旧版对照；独立新特性且能独立验收 → 通常建议开新 Spec”标尺
  - WHEN 读 `AI-ADAPTATION.md` 规则 3 ② THEN 包含”上下文冷却信号（长时间未更新、状态非 in-progress、无活跃 claim）→ 建议先读 L0 摘要确认上下文，再决定复用还是新建”标尺
  - WHEN 读 `AI-ADAPTATION.md` 规则 3 ② THEN 包含”用户明确决定优先于任何建议”条款
  - WHEN 读 `AI-ADAPTATION.md` 规则 3 ② THEN 不再出现”不新开 spec”这种硬措辞（改为”通常建议...但...”）

#### F-03 修复全局 WORKFLOW_OVERVIEW

- 描述：修改 `src/mcp/guidance.ts:6` 的分流句，把箭头式决策表改成”通常建议”语气，补充例外条款，挂全局优先级条款
- 验收：
  - WHEN 读 `WORKFLOW_OVERVIEW` THEN 分流句不再是”已有特性增量→落位 spec”的硬分支，而是”已有特性增量通常建议落位已有 spec；整体推翻通常建议开新版；独立新特性通常建议开新 spec”
  - WHEN 读 `WORKFLOW_OVERVIEW` THEN 包含”以上是建议；用户明确决定优先”条款
  - WHEN 读 `WORKFLOW_OVERVIEW` THEN 字符数 ≤ 600（测试护栏）

#### F-04 修复 spec_create 工具描述

- 描述：修改 `src/mcp/guidance.ts:25` 的 `spec_create` 描述，把”不要开 spec”改成”通常无需单独开（用户明确要求时按用户决定开）”，砍掉例子腾空间
- 验收：
  - WHEN 读 `spec_create` 工具描述 THEN 不再出现”不要开 spec / 默认不开 spec / 是才开 spec”，改为”通常适合 / 通常无需单独创建”的建议语气，并保留”用户明确要求时按用户决定开”
  - WHEN 读 `spec_create` 工具描述 THEN 不再包含”例子：spec_create{name:'login'}”（已砍掉）
  - WHEN 读 `spec_create` 工具描述 THEN 字符数 ≤ 180（测试护栏）

#### F-05 修复创建后 followup 的时序问题

- 描述：重构 `src/core/SpecManager.ts:215-229` 的创建后 followup，从当前的”分流提醒（若这其实是...应该...而非新开）”改为三行结构：【事实】→【建议】→【重要】，明确”这不是失败，若用户已明确要求新建，不得擅自撤销”
- 验收：
  - WHEN spec_create 成功后 THEN followup 第一行是”【事实】Spec 'XX' 已创建于 Scene 'YY'，路径 ...”（合并路径信息到第一行，确保第一句话就带前缀）
  - WHEN spec_create 成功后 THEN followup 包含”【建议】如果这是已有特性的增量...通常可以考虑...判断时注意：整体推翻→开新版（version+1）；独立新特性→开新 spec；上下文冷了→先读摘要再决定”
  - WHEN spec_create 成功后 THEN followup 包含”【重要】以上是治理建议，不代表本次创建失败。若用户已明确要求创建独立 Spec，不得擅自撤销或回退”
  - WHEN spec_create 成功后 THEN followup 仍包含测试锚词（`context_search`、`00-default`、`问用户`），避免 `spec-manager.test.ts:136` 红

#### F-06 修复 SPEC_REWRITE_GUIDANCE

- 描述：修改 `src/core/SpecGuidance.ts:16` 的 `SPEC_REWRITE_GUIDANCE`，把”不必新开 spec”改为包含例外条款的版本，与 version 模型一致
- 验收：
  - WHEN 读 `SPEC_REWRITE_GUIDANCE` THEN 包含”整体推翻重做→开新版（version+1）保留旧版对照；增量加需求在本版 task_create 即可”语义
  - WHEN 读 `SPEC_REWRITE_GUIDANCE` THEN 包含”用户明确要求独立 spec 时，以用户决定为准”条款

#### F-07 补充 GoalAssessor 对称 override 指引

- 描述：修改 `src/core/GoalAssessor.ts:96` 的 single-spec 分支，补充”若用户已明确要求独立 spec，可直接按用户决定 spec_create”的 override 指引（与 multi-spec 分支的现有 override 对称）
- 验收：
  - WHEN assess_goal 返回 kind=single-spec THEN suggested_next_step 包含”若用户已明确要求独立 spec，可直接按用户决定 spec_create”
  - WHEN assess_goal 返回 THEN ai_followup.instructions 包含”这是建议的下一步，不是必须执行的步骤”
  - WHEN assess_goal 的测试 THEN 仍包含”三档分流”锚词（避免 `goal-assessor.test.ts` 红）

#### F-08 新增语义回归扫描测试

- 描述：新增 `tests/unit/guidance-semantics.test.ts`，扫描 `WORKFLOW_OVERVIEW`、`TOOL_DESCRIPTIONS.spec_create`、`SPEC_REWRITE_GUIDANCE` 等关键文案，断言黑名单措辞不出现、白名单条款出现
- 验收：
  - WHEN 跑 `guidance-semantics.test.ts` THEN 断言”必须使用已有 Spec / 禁止创建新 Spec / 不新开 spec / 默认不开 spec / 是才开 spec”不出现
  - WHEN 跑 `guidance-semantics.test.ts` THEN 断言”用户明确决定优先”出现在 `WORKFLOW_OVERVIEW`
  - WHEN 跑 `guidance-semantics.test.ts` THEN 断言”用户明确要求时按用户决定”出现在 `spec_create` 描述
  - WHEN 跑 `guidance-semantics.test.ts` THEN 断言 `AI-ADAPTATION.md` 包含与 `USER_DECISION_PRIORITY_CLAUSE` 完全一致的条款

#### F-09 新增执行层非阻断回归测试

- 描述：在 `tests/unit/mcp-server.test.ts` 追加 Case 1（已有 Spec A 后调用 `spec_create` 创建 B）和反向测试（B 被创建、A 未被被动增 task）。该测试只证明执行层没有强制复用，用户意图是否被客户端正确理解由真实 Agent E2E 验收。
- 验收：
  - WHEN 先创建 Spec A，再创建 Spec B THEN B 成功创建（ok=true，spec 正确分配）
  - WHEN 创建 B 后 THEN followup 不含”不应该新建 / 必须复用”等强制措辞
  - WHEN 创建 B 后 THEN followup 包含”【重要】”（不得擅自撤销）

#### F-10 同步现有测试断言

- 描述：核对 `spec-manager.test.ts:136` 等现有测试，确认锚词保留后测试仍通过
- 验收：
  - WHEN 跑 `spec-manager.test.ts:136` THEN 断言 followup 含 `context_search`、`00-default`、`问用户` 仍通过
  - WHEN 跑 `goal-assessor.test.ts` THEN 断言含”三档分流”仍通过
  - WHEN 跑全量测试 THEN 所有调整后的断言通过且无红；`scene_create` 的旧无条件断言改为验证新版条件化引导，不以直接删除断言作为验收

### 非功能性需求

- 性能：纯文案修改，不影响运行时性能
- 兼容性：不改变 MCP 协议、不改变工具签名、不引入新字段，向后兼容

### 边界与依赖

- 依赖用户手动重拷 `AI-ADAPTATION.md` 到 `~/.claude/CLAUDE.md`（否则用户本地常驻规则不会更新）
- 不依赖其他 Spec
- 不引入新的外部依赖

### 验收标准

- [ ] **核心验收**：WHEN 用户明确说”帮我新建一个 Spec”且已有相似 Spec THEN AI 调用 spec_create 创建新 Spec，而不是擅自改成 task_create 复用旧 Spec
- [ ] **时序验收**：WHEN spec_create 成功后 THEN followup 不会诱导 AI”我是不是做错了，要不要撤销重建成 task”
- [ ] **标尺验收**：WHEN 新需求整体推翻已有 requirements/design THEN guidance 通常建议开新版（version+1）；WHEN 是独立且可验收的新特性 THEN 通常建议开新 Spec；WHEN 旧 Spec 出现上下文冷却信号 THEN 建议先读摘要，再决定复用、开新版还是创建独立 Spec
- [ ] **测试验收**：WHEN 跑全量测试 THEN 语义回归测试、执行层非阻断回归测试和现有测试均通过
