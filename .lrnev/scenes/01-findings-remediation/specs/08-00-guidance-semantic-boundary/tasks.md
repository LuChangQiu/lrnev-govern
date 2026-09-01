---
spec: '08-00-guidance-semantic-boundary'
scene: '01-findings-remediation'
created: '2026-08-26'
---

# 08-00 Guidance Semantic Boundary - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 建立共享语义常量并同步客户端模板 <!-- lrnev-task: status=completed, created=2026-08-27T07:34:36.168Z, completed=2026-09-01T10:45:00.000Z, validates=F-01|F-02|D-01 -->

新增 USER_DECISION_PRIORITY_CLAUSE 共享常量，更新 WORKFLOW_OVERVIEW 与 AI-ADAPTATION.md，确保“建议不是规则、用户明确决定优先、只有真实约束可阻断”文案一致。

**验收**：
- 运行时常量和静态文档条款一致
- 没有服务端伪造 USER_DECISION
- 旧客户端模板可直接复制使用

### T-002 迁移全局分流与 spec_create 文案 <!-- lrnev-task: status=completed, created=2026-08-27T07:34:36.168Z, completed=2026-09-01T10:45:00.000Z, depends_on=T-001, validates=F-03|F-04|D-05|D-06 -->

将 WORKFLOW_OVERVIEW、spec_create/tool descriptions 改为建议语气，保留 context_search、00-default、问用户等锚词和用户决定例外。

**验收**：
- 不再出现建议伪命令
- 全局和工具描述在字符预算内
- 用户明确要求时按用户决定处理

**授权偏离**（2026-09-01）：
- spec_create 描述字符上限 180→300（用户授权："这个长单独限制 可以弄300" + "不要为了限制而导致最后语义错误"）
- 理由：语义完整性优先于字符限制，保留例子避免语义缺失
- 连带调整：tool-descriptions.test.ts 护栏 180→300、WORKFLOW_OVERVIEW 护栏 600→800

**依赖**：T-001

### T-003 迁移 Spec 创建后 followup 与重写引导 <!-- lrnev-task: status=completed, created=2026-08-27T07:34:36.168Z, completed=2026-09-01T10:45:00.000Z, depends_on=T-001, validates=F-05|F-06|D-04 -->

按事实/建议/决策边界/下一步语义重构 SpecManager 创建后 followup 和 SPEC_REWRITE_GUIDANCE，保持 version 模型和创建成功不自动回退。

**验收**：
- 第一行事实前缀正确
- 整体推翻→新版、增量→task_create、冷却→先读摘要
- 用户已明确创建时不擅自撤销

**依赖**：T-001

### T-004 补齐 GoalAssessor 对称 override 指引 <!-- lrnev-task: status=completed, created=2026-08-27T07:34:36.168Z, completed=2026-09-01T10:45:00.000Z, depends_on=T-001, validates=F-07|D-07 -->

在 single-spec 分支加入用户明确要求独立 Spec 的 override，明确 suggested_next_step 是建议而非必须步骤。

**验收**：
- single-spec 返回用户决定 override
- 保留三档分流锚词
- 不改变 GoalAssessor 的复杂度启发式职责

**依赖**：T-001

### T-005 完成语义扫描与执行层回归测试 <!-- lrnev-task: status=completed, created=2026-08-27T07:34:36.168Z, completed=2026-09-01T10:45:00.000Z, depends_on=T-002|T-003|T-004, validates=F-08|F-09|F-10|D-01|D-04 -->

新增黑名单/白名单 guidance 语义扫描，覆盖文档常量一致性；新增已有 Spec 后仍可创建独立 Spec 的执行层非阻断测试，并同步现有锚词断言。

**验收**：
- 黑名单/白名单测试通过
- spec_create 不被执行层强制复用
- 全量测试通过

**依赖**：T-002, T-003, T-004
