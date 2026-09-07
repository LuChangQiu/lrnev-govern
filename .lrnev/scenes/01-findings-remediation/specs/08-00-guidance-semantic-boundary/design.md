---
spec: '08-00-guidance-semantic-boundary'
scene: '01-findings-remediation'
created: '2026-08-26'
---

# 08-00 Guidance Semantic Boundary - 设计

## L0 摘要

纯文案修复 + 测试补充：修改 6 处 guidance 文案，补充两条判断标尺，新增语义回归扫描测试和执行层非阻断回归测试，不改工具执行逻辑，不引入新字段。

## L1 概览

### 架构思路

**核心原则：只改语义表达，不改执行行为**

1. **文案层修复**：把容易被模型理解成”Rule”的措辞（箭头式决策表、”不要开 spec”）改成明确的”Recommendation + 例外条款”
2. **标尺层补充**：补充两条可操作的判断标尺（整体推翻与增量演进、上下文冷却信号），降低 AI 推理成本
3. **测试层防复发**：黑名单扫描阻止硬措辞回流，执行层非阻断回归测试验证已有 Spec 不会阻止新建
4. **不上结构化协议**：暂时不引入 `user_intent` 参数、不拆分 `facts/recommendations` 字段，保持 API 向后兼容

### 主要模块

- `src/shared/guidance-semantics.ts`（新增）：共享语义常量
- `src/mcp/guidance.ts`：`WORKFLOW_OVERVIEW` + `TOOL_DESCRIPTIONS`
- `src/core/SpecManager.ts`：创建后 followup
- `src/core/SpecGuidance.ts`：`SPEC_REWRITE_GUIDANCE`
- `src/core/GoalAssessor.ts`：single-spec 分支
- `docs/AI-ADAPTATION.md`：客户端常驻规则模板
- `tests/unit/guidance-semantics.test.ts`（新增）：语义回归扫描
- `tests/unit/mcp-server.test.ts`：执行层非阻断回归测试（追加）

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|---|---|---|---|
| 是否引入 `user_intent` 参数 | A: 现在上；B: E2E 验证后再决定 | **B** | 否（见 requirements “不包含”） |
| 是否拆分结构化响应协议 | A: 拆 `facts/recommendations/constraints`；B: 暂时只用文本前缀 | **B** | 否 |
| 语义常量的使用范围 | A: 所有 followup 统一引用；B: 只用于全局通道 | **B** | 否（见 D-01 说明） |
| 时间阈值的表达方式 | A: 写死”1 个月”；B: 给判断框架让 AI 自行判断 | **B** | 否（见 D-03 说明） |

## L2 详情

### 模块详细设计

#### D-01 共享语义常量的使用约束

**位置**：`src/shared/guidance-semantics.ts`

**设计**：

```typescript
/**
 * 全局优先级条款（用于 WORKFLOW_OVERVIEW；客户端常驻规则模板复制相同文本）。
 * 具体 followup 使用场景相关的短例外条款，不复读此段。
 */
export const USER_DECISION_PRIORITY_CLAUSE = 
  '用户明确表达的决定优先于任何建议；lrnev 可以提示治理建议与利弊，但不得替用户改变决定。建议≠规则，只有结构/状态/完整性约束才会阻断操作。';
```

**使用约束**：

- **运行时引用**：`WORKFLOW_OVERVIEW` 直接引用 `USER_DECISION_PRIORITY_CLAUSE`
- **静态文档同步**：`AI-ADAPTATION.md` 复制相同文本；语义回归测试读取 Markdown 并校验其包含与常量完全一致的条款
- **具体 followup 不引用**：`SpecManager.ts:217` 等地方写场景相关的短例外条款，避免每个 followup 都复读一遍完整哲学导致返回体膨胀

**理由**：followup 无字符预算限制，但全量复读会让返回体冗余，实际上 AI 不会逐字读完；全局通道只注入一次，影响整个会话，值得写完整条款。

#### D-02 “整体推翻 vs 增量演进”标尺的实现

**位置**：`AI-ADAPTATION.md` 规则 3 ②、`SpecManager.ts:217` 创建后 followup、`SPEC_REWRITE_GUIDANCE`

**文案设计（与 lrnev 的 version 模型一致）**：

```
如果新需求需要整体推翻已有 Spec 的 requirements/design，
建议开新版（spec_create --version）保留旧版对照，再用 spec_update 归档旧版。

独立新特性且能独立验收时，通常建议开新 Spec。

已有特性的增量演进通常建议复用原 Spec，并在本版使用 task_create 落位。

以上均为治理建议；用户明确指定组织方式时，以用户决定为准。
```

**判断容易度**：高（AI 可以直接问自己”这是整体推翻还是增量演进？”）

**位置选择**：

- `AI-ADAPTATION.md`：写完整判断逻辑（3 条标尺）
- `SpecManager.ts:217` 创建后 followup：写简化版”判断时注意：整体推翻→开新版（version+1）；独立新特性→开新 spec”
- `SPEC_REWRITE_GUIDANCE`：明确”整体推翻→开新版；增量在本版 task_create”

#### D-03 “上下文冷了”标尺的实现

**位置**：同 D-02

**文案设计（不写死时间阈值，给判断信号而不是决策条件）**：

```
如果已有 Spec 长时间未更新（比如几个月前创建，中间没动），
且状态非 in-progress、无活跃 claim，
这是上下文可能冷却的信号。

建议先用 spec_get 或 context_search 读取 L0 摘要，
确认当时的上下文、技术方案、业务假设是否仍然适用，
再决定复用还是新建。
```

**为什么不写死”3 个月”**：

- 不同团队节奏不同（有些团队 1 个月就是”很久以前”，有些团队 3 个月还算”近期”）
- 给 AI 判断框架比写死阈值更灵活
- 排除活跃 Spec（in-progress 或有 claim 的”没动”是健康的，不是冷却）
- 结论是”先读摘要再决定”，不是默认开新

#### D-04 创建后 followup 的三行结构

**位置**：`src/core/SpecManager.ts:215-229`

**当前问题**：创建成功后返回”若这其实是给已完成特性加的小增量，通常该...而非新开”，容易诱导 AI”我是不是做错了，要不要撤销重建”

**新结构（第一行就带前缀，与 F-05 验收一致）**：

```typescript
const instructions = [
  `【事实】Spec “${spec.spec}” 已创建于 Scene “${sceneId}”，路径 .lrnev/scenes/${sceneId}/specs/${spec.spec}`,
  
  '【建议】如果这是已有特性的增量，且用户未明确指定组织方式，通常可以考虑：先 context_search 找到对应 spec 用 task_create 落位。判断时注意：整体推翻→开新版（version+1）；独立新特性→开新 spec；上下文冷了（长时间未更新、状态非 in-progress、无活跃 claim）→先读摘要再决定。Scene 选择：优先归入已有匹配业务域 scene；零散无稳定域的小特性才落 00-default；拿不准问用户。',
  
  '【重要】以上是治理建议，不代表本次创建失败。若用户已明确要求创建独立 Spec，不得擅自撤销或回退。',
  
  '请协助用户填充 requirements.md 的”目标”、”用户故事”、”详细需求”',
  '注意：三文档的章节标题是模板契约，不要翻译或改名（ready gate 按中文标题精确匹配，如「L0 摘要」「详细需求」），只填标题下的内容。',
  '需求填完后调用 spec_gate_check(gate=ready) 检查',
  '通过后再填 design.md（技术方案），最后填 tasks.md（任务清单）',
  '关键决策出现时主动询问用户是否生成 ADR（参考 context://steering/adr）',
  EARS_ACCEPTANCE_EXAMPLE,
];
```

**锚词保留**：`context_search`、`00-default`、`问用户` 必须出现，避免 `spec-manager.test.ts:136` 红

#### D-05 WORKFLOW_OVERVIEW 的字符预算管理

**位置**：`src/mcp/guidance.ts:6`

**当前长度**：541 字符，上限 600，余量 59

**改动后预期**：约 500 字符（-41）

**策略**：

1. 把原来的”踩坑→error_record，决策→adr_create，约定→memory_save”砍掉（不属于分流核心，可以放到工具描述里）
2. 补充”以上是建议；用户明确决定优先”条款（约 18 字）
3. 修正标尺：改为”整体推翻通常建议开新版；独立新特性通常建议开新 spec”，与 version 模型一致

**修改后文案**：

```
分流：写不出独立验收时通常无需单独落治理；已有特性增量通常建议落位已有 spec；整体推翻通常建议开新版；独立新特性通常建议开新 spec。以上是建议，用户明确决定优先。新 spec 优先已有 scene；scene/00 拿不准问用户。
```

#### D-06 spec_create 描述的字符预算管理

**位置**：`src/mcp/guidance.ts:25`

**当前长度**：179 字符，上限 180，余量 1

**策略**：砍掉”例子：spec_create{name:'login'}”（28 字符），腾空间补建议语气和”（用户明确要求时按用户决定开）”

**修改后**：

```
spec_create: '创建 Spec 三文档。何时用：可独立交付且能写出 WHEN…THEN 验收的特性通常适合开 spec；没有独立验收可挂的小改动通常无需单独创建（用户明确要求时按用户决定开）；拿不准且用户未指定时先问用户。前置：已 init；scene 可省略。',
```

**预期长度**：约 151 字符（-28，余量 29）

#### D-07 GoalAssessor 对称补丁

**位置**：`src/core/GoalAssessor.ts:96`

**当前问题**：multi-spec 分支有 override 指引（”若用户已明确本次只做其中一个小特性，可直接按 single-spec 走 spec_create”），single-spec 分支缺对称指引

**修改**：

```typescript
function nextStep(kind: GoalAssessmentKind): string {
  if (kind === 'single-spec') {
    return '建议在现有 Scene 下创建一个 Spec，并把需求、设计、任务放入该 Spec。若用户已明确要求独立 spec，可直接按用户决定 spec_create。';
  }
  // ...
}
```

**followup 补充**：在 `GoalAssessor.assess()` 的 `ai_followup.instructions` 数组补一句”这是建议的下一步，不是必须执行的步骤”

### 数据模型

无新增数据结构，不改变现有类型签名。

### 接口契约

**不改变任何工具的签名**：

- `spec_create` / `task_create` / `assess_goal` 等工具的参数和返回值保持不变
- 不引入 `user_intent` 参数（暂缓）
- 不拆分 `ai_followup` 的结构（`instructions` 仍是 `string[]`，不改成 `{facts, recommendations, constraints}`）

**对外行为**：

- `spec_create` 在有相似 Spec 的情况下仍然可以成功创建（行为不变）
- 只有 followup 文案改变，执行逻辑完全不变

### 错误处理

无新增错误场景，不涉及降级策略。

### 测试策略

#### 单元测试

**新增**：

1. **`tests/unit/guidance-semantics.test.ts`**：
   - 黑名单扫描：断言”必须使用已有 Spec / 禁止创建新 Spec / 不新开 spec / 默认不开 spec / 是才开 spec”不出现
   - 白名单扫描：断言”用户明确决定优先”出现在 `WORKFLOW_OVERVIEW`，”用户明确要求时按用户决定”出现在 `spec_create` 描述
   - 文档一致性：读取 `AI-ADAPTATION.md`，断言其包含与 `USER_DECISION_PRIORITY_CLAUSE` 完全一致的条款
   
2. **`tests/unit/mcp-server.test.ts` 追加执行层非阻断测试**：
   - Case 1：已有 Spec A + 创建 Spec B → B 成功创建
   - 反向测试：B 创建后，A 未被被动增 task
   - followup 验证：不含”不应该 / 必须复用”，含”【重要】”
   - 边界说明：该测试不包含原始用户对话，不能证明客户端 AI 已正确理解用户意图；相关行为只由真实 Agent E2E 验收

**修改**：

- `tests/unit/spec-manager.test.ts:136`：把 `scene_create` 的旧无条件断言改为验证新版条件化引导；另行保留 Scene 选择语义的行为覆盖
- 其余测试保持不变（锚词保留策略确保现有断言仍通过）

#### 集成测试

无（纯文案修改，不涉及集成）

#### E2E / 盲测（验收阶段）

**验收方式**：用实际在用的主力 Agent（Claude Code / Codex）跑两个场景：

1. **Case 1（explicit）**：已有 Spec A（用户登录），用户说”我要新建一个 Spec，专门处理登录风控” → 期望 AI 调用 `spec_create`，而不是擅自改成 `task_create` 复用 Spec A
2. **Case 2（上下文冷却）**：已有 Spec B 长时间未更新、状态非 in-progress 且无活跃 claim，用户说”我要修改登录逻辑” → 期望 AI 先读取摘要或原文确认上下文，再根据变化属于增量演进、整体推翻还是独立新特性给出建议；不能仅凭时间直接决定开新 Spec

**触发条件**（决定是否上 P2）：

- 如果 E2E 盲测中 explicit/preferred 场景仍失败 ≥2 次 → 上 `user_intent` 参数
- 如果 E2E 盲测通过 → 暂时不上 `user_intent`，保持当前最小改动
