# lrnev Semantic Authority Cases

**Document Purpose**: 详细说明五类语义权威案例（E-01 至 E-05），用于验证客户端行为、服务端行为和可观察结果的边界。

**Baseline**: Semantic Authority Model v0.1

**Scene**: 04-ai-guidance-standardization

**Spec**: 01-00-semantic-authority-model

**Created**: 2026-08-28

---

## 1. 案例概览

本文档定义五类语义权威案例，用于验证 lrnev Guidance Semantic Authority Model v0.1 的核心原则：

| 案例 ID | 名称 | 核心原则 |
|---------|------|----------|
| E-01 | Explicit User Request | 用户明确请求优先于 RECOMMENDATION |
| E-02 | Preferred Recommendation | RECOMMENDATION 不生成 USER_DECISION |
| E-03 | Unspecified Direction | GoalAssessor 是启发式，不是用户决定 |
| E-04 | User Changed Decision | 最后确认覆盖先前确认，无需撤销 |
| E-05 | Constraint Conflict | EXECUTION_CONSTRAINT 来自确定性代码 |

每个案例都明确定义：
- **场景描述**：触发该案例的具体情境
- **客户端行为**：客户端 AI 应如何识别、处理和展示
- **服务端行为**：lrnev 服务端如何校验和响应
- **可观察结果**：可验证的输出和状态变化
- **引用约束**（E-05）：对应 execution-constraints-inventory.md 的真实约束

---

## 2. E-01: 明确用户请求优先于推荐

### 2.1 场景

已有相近 Spec A，服务端给出「在 A 下建 Task」的 **RECOMMENDATION**；用户明确要求「新建 Spec B」。

### 2.2 三维分析

- **Provenance**: `user_quote` （用户原话）
- **Role**: `decision_boundary` （决策边界）
- **Enforcement**: `client_boundary` （客户端边界）

### 2.3 客户端行为

客户端 AI 应该：

1. **识别明确请求**：从用户对话中识别「新建 Spec B」这一明确指令
2. **记录为 DECISION_BOUNDARY**：将用户确认的方向标记为当前决策边界
3. **调用正确工具**：执行 `spec_create(name='B', scene=current_scene)`
4. **不误导用户**：不将服务端 RECOMMENDATION 显示为阻断规则或禁令

**示例对话流**：

```
Server: 【事实】已有 Spec A: user-authentication
        【建议】可以考虑在 A 下创建 Task 以复用现有结构
        
User:   不，我要创建独立的 Spec B: oauth-integration

Client: [识别] 用户明确要求创建新 Spec
        [记录] DECISION_BOUNDARY: 创建 oauth-integration
        [调用] spec_create(name='oauth-integration')
```

### 2.4 服务端行为

服务端只校验 `spec_create` 的**真实输入约束**：

- ✅ **必须校验**：
  - name 为 kebab-case（参考 execution-constraints-inventory.md §4.2）
  - name+version 在 scene 内唯一（参考 §5.2）
  
- ❌ **不应拒绝**：
  - 不因已有相似 Spec A 而阻止创建 B
  - RECOMMENDATION 不转化为阻断

**响应可以包含**：

```
【事实】Spec A (user-authentication) 已存在
【建议】考虑在 A 下创建 Task 以复用现有结构
【事实】Spec B (oauth-integration) 已创建成功
```

**响应不应包含**：

```
❌ 【执行约束】不能创建新 Spec，必须使用 A
❌ 拒绝创建 B（当输入合法时）
❌ 【用户已决定】使用现有 Spec A
```

### 2.5 可观察结果

- ✅ Spec B 的 `requirements.md` 存在于文件系统
- ✅ 响应包含成功状态 `ok: true`
- ✅ 响应可包含关于 A 的 FACT 和 RECOMMENDATION
- ✅ RECOMMENDATION 未阻止 B 的创建

### 2.6 用户故事

> 当已有 Spec 可以承载但用户明确要求新建 Spec 时，我希望建议仍可解释利弊，但不能被当作禁止新建的规则。

---

## 3. E-02: 推荐但未确认

### 3.1 场景

服务端建议复用已有 Spec，但用户**没有明确选择**。

### 3.2 三维分析

- **Provenance**: `lrnev` （服务端推导）
- **Role**: `recommendation` （推荐）
- **Enforcement**: `none` （无强制）

### 3.3 客户端行为

客户端 AI 应该：

1. **展示 RECOMMENDATION**：清晰展示「可以考虑在现有 Spec 下创建 Task」
2. **展示候选路径**：复用现有 Spec 或创建新 Spec 两条路径
3. **判断风险等级**：
   - **低风险、可逆操作**：可自行选择并解释理由
   - **高影响、不可逆操作**：请求用户确认
4. **不伪造决定**：不生成「用户已决定」或「用户已确认」的声明

**示例对话流**：

```
Server: 【事实】存在 Spec A: user-management 可能承载此需求
        【建议】优先评估在 A 下创建 Task
        【下一步】可调用 task_create 或 spec_create

Client: [展示] 我看到有现有的 user-management Spec，可以在那里添加任务
        [询问] 您想在现有 Spec 下创建任务，还是创建新的独立 Spec？
        
        （注意：客户端未生成「用户已决定使用 Spec A」）
```

### 3.4 服务端行为

服务端**不生成 USER_DECISION**，不把推荐写成拒绝规则。

**响应可以包含**：

```
【事实】存在 Spec A 可能承载此需求
【建议】优先评估在 A 下创建 Task
【下一步】可调用 task_create 或 spec_create
```

**响应不应包含**：

```
❌ 【用户已决定】使用 Spec A
❌ 【用户已确认】不创建新 Spec
❌ 【执行约束】只能使用现有 Spec
❌ 从 GoalAssessor.suggested_next_step 生成的 USER_DECISION
```

### 3.5 可观察结果

- ✅ 响应不包含 `USER_DECISION` 标记
- ✅ 响应不声称用户已确认某个方向
- ✅ 用户可选择复用或新建，两者均为合法路径
- ✅ RECOMMENDATION 标记为可选，不是强制

### 3.6 用户故事

> 当用户没有指定组织方式时，我希望 AI 可以基于事实提出建议并询问用户，而不是把默认建议伪装成用户决定。

---

## 4. E-03: 未指定方向需要澄清

### 4.1 场景

用户仅表达目标（如「添加登录功能」），未说明应**复用、创建还是修改**哪一个对象。

### 4.2 三维分析

- **Provenance**: `client_asserted` （客户端判断）
- **Role**: `action_hint` （下一步提示）
- **Enforcement**: `client_boundary` （客户端边界）

### 4.3 客户端行为

客户端 AI 应该：

1. **识别目标模糊**：用户说「添加登录功能」，未指定在哪个 Spec
2. **可调用 assess_goal**：获取复杂度启发式（single-spec / multi-spec-program / research-program）
3. **按风险分级处理**：
   - **低风险场景**（如添加文档、注释）：可自行选择并解释理由
   - **高风险场景**（如架构变更、新建 Scene）：先询问用户意图
4. **不伪造用户意图**：不把 `GoalAssessor.kind` 或 `suggested_next_step` 当作 USER_DECISION

**示例对话流**：

```
User:   添加用户登录功能

Client: [调用] assess_goal("添加用户登录功能")
        [收到] { kind: "single-spec", suggested_next_step: "可在现有 Spec 或新建" }
        
        [展示] 我看到这个需求可能适合作为单个 Spec。
               当前有 user-management Spec 可能相关。
        [询问] 您想在现有 Spec 下添加，还是创建新的独立 Spec？
        
        （注意：GoalAssessor.kind 仅作为启发式，不是用户确认）
```

### 4.4 服务端行为

服务端可返回**事实、建议、下一步**和工具参数错误，但**不持久化猜测**出的方向。

**响应可以包含**：

```
【事实】当前有 2 个 Spec 可能相关：user-management, authentication
【建议】可使用 assess_goal 评估复杂度
【下一步】确认后可调用 spec_create 或 task_create
GoalAssessor 的 kind（single-spec）作为启发式参考
```

**响应不应包含**：

```
❌ 【用户已决定】创建新 Spec
❌ 【用户已确认】使用现有 Spec X
❌ 服务端自动选择方向并持久化
❌ 把 GoalAssessor.kind 伪装成用户意图
```

### 4.5 可观察结果

- ✅ 响应提供事实和建议
- ✅ 如客户端自动选择，必须附带可理解的解释
- ✅ 用户可随时改变方向
- ✅ GoalAssessor 结果仅作为 RECOMMENDATION 或 ACTION_HINT
- ✅ 服务端未持久化未经确认的方向

### 4.6 GoalAssessor 的定位

根据 `semantic-authority-model.md` §5.1：

> `GoalAssessor` 是接收 `goal: string` 的启发式分析器，不是用户意图的权威来源，也不调用 LLM。它的 `suggested_next_step` 只能形成 `RECOMMENDATION` 或 `ACTION_HINT`，不能形成 `USER_DECISION`。

---

## 5. E-04: 用户改变决定

### 5.1 场景

用户先确认**方案 A**，随后明确改为**方案 B**。

### 5.2 三维分析

- **Provenance**: `user_quote` （用户原话）
- **Role**: `decision_boundary` （决策边界）
- **Enforcement**: `client_boundary` （客户端边界）

### 5.3 客户端行为

客户端 AI 应该：

1. **初始确认**：用户说「在现有 Spec A 下创建 Task」，记录为 DECISION_BOUNDARY(A)
2. **识别改变**：用户说「不，创建新 Spec B」，识别为方向变更
3. **更新决策边界**：用最后一次有效确认更新 DECISION_BOUNDARY 为方案 B
4. **明确告知**：向用户确认「已从 A 切换到 B」
5. **执行新方案**：调用 `spec_create(B)` 而不是 `task_create(A)`

**对话流示例**：

```
Turn 1:
User:   在 user-management Spec 下创建登录任务
Client: [记录] DECISION_BOUNDARY: 使用 Spec A (user-management)

Turn 2:
User:   不对，我要创建新的 oauth-integration Spec
Client: [更新] DECISION_BOUNDARY: 创建 Spec B (oauth-integration)
        [确认] 已从「在 A 下创建任务」切换到「创建新 Spec B」
        [调用] spec_create(name='oauth-integration')

Turn 3:
Server: spec_create(B) 成功，不因之前考虑 A 而拒绝
```

### 5.4 服务端行为

服务端按 **B 的实际工具输入与校验**执行，**不以旧确认制造额外阻断**。

**服务端约束**：

- ✅ 只校验当前工具调用的真实约束
- ❌ 不因历史决定 A 而拒绝 B
- ❌ 不要求用户「撤销 A」的额外步骤

**响应可以包含**：

```
【事实】Spec B (oauth-integration) 已创建
【事实】之前考虑过在 A 下创建 Task（如需说明上下文）
```

**响应不应包含**：

```
❌ 【执行约束】必须先撤销方案 A
❌ 因历史决定而拒绝当前合法输入
❌ 把客户端对话历史当作服务端状态锁
```

### 5.5 可观察结果

- ✅ Spec B 创建成功（假设输入合法）
- ✅ 不存在针对 Spec A 的 Task 创建
- ✅ 服务端未因历史决定 A 产生阻断
- ✅ 客户端上下文清晰标识当前决定为 B

### 5.6 关键原则

**最后一次有效确认覆盖先前确认**。历史决定可以保留为对话记录，但不能继续被当作当前决定，也不能成为服务端阻断的依据。

---

## 6. E-05: 真实约束冲突

### 6.1 场景

用户要求把 **archived Spec** 改回 **in-progress**。

### 6.2 三维分析

- **Provenance**: `workspace` （工作区事实）
- **Role**: `execution_constraint` （执行约束）
- **Enforcement**: `server_enforced` （服务端强制）

### 6.3 客户端行为

客户端 AI 应该：

1. **识别用户请求**：`spec_update(status='in-progress')` on archived Spec
2. **调用服务端**：执行 `spec_update` 工具
3. **接收错误**：收到 `INVALID_STATUS_TRANSITION` 错误
4. **解释为约束**：向用户解释这是**服务端状态机约束**，不是建议或偏好分歧
5. **展示替代路径**：archived 是终态，需要通过 `spec_create(version=1)` 开新版

**对话流示例**：

```
User:   把 archived 的 Spec 01-user-auth 改回 in-progress

Client: [调用] spec_update(spec='01-user-auth', status='in-progress')
Server: [返回] { ok: false, error: { code: 'INVALID_STATUS_TRANSITION', ... } }

Client: [解释] 无法执行此操作。archived 是终态，根据服务端状态机约束，
               不能转换回 in-progress。
        [建议] 如需重做该 Spec，请使用 spec_create 创建新版本（version=1）
```

### 6.4 服务端行为

`SpecManager.updateStatus` 返回 **INVALID_STATUS_TRANSITION**，**不写入状态**。

**真实约束引用**（参考 `execution-constraints-inventory.md` §1.1）：

| 约束项 | 值 |
|--------|-----|
| **清单章节** | §1.1 Spec Status Transition |
| **源码位置** | `src/types/spec.ts:25-31`, `src/core/SpecManager.ts:136-158` |
| **校验函数** | `isValidSpecTransition(from, to)` |
| **常量定义** | `VALID_SPEC_TRANSITIONS` |
| **archived 转换** | `(no valid transitions - terminal state)` |

**触发条件**：

请求从 `archived` 转换到任何其他状态（包括 `in-progress`、`ready`、`draft`）

**可观察结果**：

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "非法 Spec 状态转换：archived → in-progress",
    "details": {
      "field": "status",
      "hint": "archived 是终态，不能再转换；如需重做请用 spec_create 开新版"
    }
  }
}
```

**文件系统**：

- ✅ `requirements.md` 的 `status` 字段保持 `archived`
- ✅ 没有写入操作发生

### 6.5 可观察结果

- ✅ `spec_update` 返回错误，`ok: false`
- ✅ 错误码为 `INVALID_STATUS_TRANSITION`
- ✅ 错误消息说明状态转换不合法
- ✅ 提供替代路径：`spec_create(version > 0)`
- ✅ `requirements.md` 的 `status` 字段未改变
- ✅ 这是**确定性服务端校验**，不是 RECOMMENDATION

### 6.6 与 RECOMMENDATION 的区别

| 维度 | RECOMMENDATION | EXECUTION_CONSTRAINT |
|------|----------------|----------------------|
| **来源** | lrnev 启发式推导 | 服务端确定性代码 |
| **强制性** | 可接受、拒绝或替换 | 违反时确定性拒绝 |
| **可绕过** | 用户明确请求可覆盖 | 用户请求无法绕过 |
| **错误码** | 无（成功响应） | 有（如 INVALID_STATUS_TRANSITION） |
| **代码位置** | 无需回指代码 | 必须回指确定性校验代码 |

### 6.7 用户故事

> 当用户选择违反状态机、必填字段、引用完整性或安全边界的动作时，我希望 lrnev 由服务端真实校验拒绝，而不是只返回一条看似强硬的提示。

---

## 7. 约束清单交叉引用

### 7.1 E-05 引用的真实约束

E-05 案例**必须只引用** `execution-constraints-inventory.md` 中已核验的真实约束。

**当前引用**：

- **清单章节**：§1.1 Spec Status Transition
- **源码文件**：`src/types/spec.ts:25-31`, `src/core/SpecManager.ts:136-158`
- **校验逻辑**：`isValidSpecTransition(from, to)` 检查 `VALID_SPEC_TRANSITIONS`
- **错误码**：`INVALID_STATUS_TRANSITION`
- **替代路径**：按状态机更新，或使用 `spec_create` 开新版

### 7.2 明确的非约束

根据 `semantic-authority-model.md` §6.1 和 `execution-constraints-inventory.md` "Known Non-Constraints"，以下**不是**当前实现的服务端约束：

| 错误说法 | 为什么不是约束 | 正确表达 |
|---------|---------------|---------|
| archived Spec 不能新增 Task | `TaskManager.create` 没有按 Spec 状态拦截 | 【事实】当前代码未禁止 archived Spec 新增 Task |
| ready gate 会为其他工具建立全局锁 | Gate 返回检查结果，不是互斥锁 | 【建议】先修复 gate 问题再继续 |
| 已有相近 Spec 后不能创建新 Spec | 相似性只能形成建议 | 【建议】优先评估复用已有 Spec |

**重要**：案例、测试和文档**不得**将上述内容标记为 EXECUTION_CONSTRAINT。

---

## 8. 静态语义检查规则

### 8.1 禁止项总结

| 检查项 | 规则 | 违例示例 | 合规示例 |
|--------|------|---------|---------|
| **建议非阻断** | RECOMMENDATION 不得写为「只能」「必须」「服务端拒绝」 | ❌ 【建议】只能使用现有 Spec | ✅ 【建议】可以考虑使用现有 Spec |
| **决定来源可追溯** | "用户已决定"必须关联 user_quote 或 client_asserted | ❌ 【用户已决定】采用 GoalAssessor.kind | ✅ 【决策边界】用户明确要求「创建新 Spec」 |
| **决策边界不越权** | DECISION_BOUNDARY 只能要求客户端确认，不能声称服务端拦截 | ❌ 【决策边界】服务端强制执行该方向 | ✅ 【决策边界】客户端以最后确认方向为准 |
| **约束可回指代码** | 每个 EXECUTION_CONSTRAINT 必须列出代码位置和错误码 | ❌ 【执行约束】archived Spec 不能新增 Task | ✅ 【执行约束】archived → in-progress 不合法（src/core/SpecManager.ts, INVALID_STATUS_TRANSITION） |
| **三维框架不扩散** | 不得要求所有消息增加 provenance/role/enforcement 字段 | ❌ 所有 MCP response 必须包含三维字段 | ✅ 三维框架仅用于评审和案例分析 |
| **必填输入显式失败** | 缺失必填字段必须报错，不能静默填充 | ❌ title 缺失时用 "未命名任务" 填充 | ✅ title 缺失时返回 INVALID_INPUT |

### 8.2 检查时机

- **设计评审**：新增或修改 Guidance 文案时
- **代码审查**：修改 MCP 工具响应逻辑时
- **测试验证**：集成测试和单元测试阶段
- **文档更新**：修改 dev-docs 或规范文档时

---

## 9. 测试覆盖

### 9.1 Fixture 位置

所有案例 fixtures 位于：

```
tests/fixtures/semantic-authority/
├── E-01-explicit.json
├── E-02-preferred.json
├── E-03-unspecified.json
├── E-04-user-changed-decision.json
└── E-05-constraint-conflict.json
```

### 9.2 单元测试

单元测试位于 `tests/unit/semantic-authority-model.test.ts`，覆盖：

1. **五类案例断言**（E-01 至 E-05）
   - 验证 provenance / role / enforcement
   - 验证客户端行为 / 服务端行为 / 可观察结果
   
2. **assertValidatesAnchors 直接测试**
   - 验证 F-xx 锚点存在于 requirements.md
   - 验证 D-xx 锚点存在于 design.md
   - 验证不存在的锚点返回 ANCHOR_NOT_FOUND
   - 验证无效格式返回 INVALID_INPUT
   - 验证 legacy design# 格式被拒绝
   
3. **静态语义检查**
   - 禁止「建议」写成「必须」
   - 禁止「用户决定」置于真实 Constraint 之上
   - 禁止「客户端边界」伪装成服务端规则
   - 禁止从 GoalAssessor 伪造 USER_DECISION
   - 三维框架不扩散为必填字段

### 9.3 集成测试

后续 Spec `04-00-agent-e2e-observability` 将提供端到端测试，覆盖：

- E-01 至 E-09 决策链（E-01~E-05 是语义边界，E-06~E-09 是跨会话场景）
- 真实客户端盲测（B0/B1）
- 传输与模型可见视图对照（B2a/B2b）

---

## 10. 版本与维护

### 10.1 版本基线

- **版本**：v0.1（与 semantic-authority-model.md 同步）
- **冻结日期**：2026-08-27
- **修订原则**：案例定义变更必须升级版本号

### 10.2 后续演进

以下事项不属于 v0.1，后续版本可扩展：

- **E-06 至 E-09**：跨会话、多客户端、决策失效等场景
- **Profile 集成**：如何以 `client_asserted` 传递 decision context
- **Model Visible Contract**：如何表达角色信息而不强制三维字段
- **新约束添加**：如实施 archived Spec 禁止新增 Task，需先修改代码再更新清单

### 10.3 维护要求

- **代码变更**：若真实约束的校验逻辑改变，必须同步更新 E-05 引用
- **新增约束**：新增 EXECUTION_CONSTRAINT 时，需在 execution-constraints-inventory.md 记录后才能在案例中引用
- **移除约束**：若某约束从代码中移除，必须从 E-05 和相关案例中移除引用

---

## 11. 参考文档

| 文档 | 路径 | 用途 |
|------|------|------|
| Semantic Authority Model v0.1 | `dev-docs/ai-guidance-standardization/semantic-authority-model.md` | 语义权威规范 |
| Execution Constraints Inventory | `dev-docs/ai-guidance-standardization/execution-constraints-inventory.md` | 真实约束清单 |
| Requirements | `.lrnev/scenes/04-ai-guidance-standardization/specs/01-00-semantic-authority-model/requirements.md` | 需求文档 |
| Design | `.lrnev/scenes/04-ai-guidance-standardization/specs/01-00-semantic-authority-model/design.md` | 设计文档 |
| Unit Tests | `tests/unit/semantic-authority-model.test.ts` | 单元测试 |
| Fixtures | `tests/fixtures/semantic-authority/` | 案例 fixtures |

---

## 12. 审核与验收

### 12.1 F-05 验收标准

> 至少覆盖 explicit、preferred、unspecified、用户改变决定、候选动作违反真实 Constraint 五类案例，并写出客户端行为、服务端行为和可观察结果。

**验收状态**：

- ✅ E-01: Explicit User Request（明确用户请求）
- ✅ E-02: Preferred Recommendation（推荐但未确认）
- ✅ E-03: Unspecified Direction（未指定方向）
- ✅ E-04: User Changed Decision（用户改变决定）
- ✅ E-05: Constraint Conflict（真实约束冲突）

每个案例都包含：
- ✅ 场景描述
- ✅ 客户端行为
- ✅ 服务端行为
- ✅ 可观察结果
- ✅ 用户故事引用

### 12.2 D-05 验收标准

> 五类案例有客户端、服务端和可观察结果。

**验收状态**：✅ 已完成

### 12.3 D-07 验收标准

> 用固定 fixture 验证五种角色和五类案例；约束冲突案例只引用经源码核验的真实 Constraint。

**验收状态**：

- ✅ 固定 fixtures：`tests/fixtures/semantic-authority/*.json`
- ✅ 单元测试：`tests/unit/semantic-authority-model.test.ts`
- ✅ E-05 引用真实约束：execution-constraints-inventory.md §1.1
