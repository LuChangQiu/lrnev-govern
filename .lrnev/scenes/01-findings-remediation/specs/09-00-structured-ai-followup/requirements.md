---
spec: '09-00-structured-ai-followup'
scene: '01-findings-remediation'
status: draft
priority: P1
created: '2026-08-26'
---

# 09-00 Structured Ai Followup - 需求

> **⚠️ 当前状态：暂缓执行，待重写**
>
> 经过 GPT 和 DeepSeek 审查，当前设计存在致命缺陷：
>
> 1. **user_decision 来源悖论**：lrnev 不读对话、不调 LLM，无法知道用户决定是什么，却计划生成 `user_decision`
> 2. **priority 表概念错误**：把 `constraint` 和 `user_decision` 放在同一个数字优先级比较，会导致"用户决定覆盖结构约束"
> 3. **修复位置错误**：结构化的是"工具返回后的输出"，修不到"AI 决策前的误读"（最初问题的失败点）
> 4. **doctor --migrate-followup 伪需求**：lrnev 的 followup 不持久化，没有存量数据可迁移
>
> **执行策略**：
> - 先执行 08-00-guidance-semantic-boundary（文案修复）
> - 跑 E2E 盲测验证效果
> - 如果 E2E 仍失败 ≥2 次，重新设计本 Spec（不按当前版本执行）
> - 重写时至少要改：删 priority 字段、user_decision 改为客户端通过 `user_intent` 显式传入、constraint 不与 user_decision 竞争、删 migrate-followup
>
> 以下内容保留作为参考，但**不应按此执行**。

## L0 摘要

将 ai_followup 从扁平 `instructions: string[]` 升级为结构化 `messages: Array<{kind, text, priority}>`，兼容保留旧字段，提供 doctor 迁移命令。

## L1 概览

### 目标

让客户端 AI 在处理冲突信息时，能通过机器可读的 `kind` 和 `priority` 字段立刻判断优先级，而不需要从自然语言文本推断：

1. **明确语义分类**：fact / recommendation / user_decision / constraint 四种 kind，每种有明确定义和优先级
2. **冲突自动解决**：当 recommendation 和 user_decision 冲突时，AI 可以机械地比较 priority，执行优先级高的那个
3. **向后兼容**：保留 `instructions` 字段，旧客户端继续工作；新客户端优先读 `messages`
4. **存量迁移**：提供 `lrnev doctor --migrate-followup` 命令，把现有 Spec 的历史 followup（如果有持久化）补充 `messages` 字段

### 用户故事

- 作为客户端 AI，当我收到”建议复用已有 Spec”和”用户明确要求新建 Spec”两条冲突信息时，我希望能直接读取 `kind` 和 `priority` 判断该听谁的，而不需要从文本推断”建议”vs”用户明确”的强度
- 作为 lrnev 开发者，当我在 SpecManager.create() 返回 followup 时，我希望有明确的类型约束，确保我把”建议复用”标记为 `recommendation`，而不会错误地标成 `constraint`
- 作为使用旧版 lrnev MCP 客户端的用户，当 lrnev 升级到结构化协议后，我希望我的客户端仍能继续读取 `instructions` 字段，不会因为协议变化而中断

### 范围

**包含**：
- 定义 `MessageKind` 枚举和优先级规则
- 扩展 `AiFollowup` 类型，新增 `messages` 字段（可选）
- 修改所有返回 `ai_followup` 的地方（SpecManager、TaskManager、GoalAssessor、GateGuidance 等 10+ 处），同时填充 `instructions` 和 `messages`
- 提供 `lrnev doctor --migrate-followup`（或在现有 `lrnev doctor` 中新增选项）迁移存量数据（如果有持久化的 followup）
- 新增 lint 规则或类型检查，确保 `kind` 用对（比如 recommendation 的文本不能出现”必须”）

**不包含**：
- 不强制客户端立刻适配 `messages` 字段（保留 `instructions` 兼容）
- 不迁移外部集成（如果有外部工具依赖 `instructions`，它们可以继续用）
- 不删除 `instructions` 字段（即使未来所有客户端都升级，也保留以防回退）

## L2 详情

### 详细需求

#### F-01 定义 MessageKind 和优先级规则

- 描述：定义四种 `MessageKind`，每种有明确的语义和优先级
- 验收：
  - WHEN 读 `src/types/response.ts` THEN 看到 `type MessageKind = 'fact' | 'recommendation' | 'user_decision' | 'constraint'` 的定义
  - WHEN 读类型注释 THEN 明确写出：
    - `fact`：项目当前状态，不可辩驳，不参与优先级比较（只是背景信息）
    - `recommendation`：lrnev 的治理建议，优先级 3（最低），可以有例外
    - `user_decision`：用户明确做出的决定，优先级 1（最高），覆盖 recommendation 和 constraint
    - `constraint`：结构/状态/完整性约束，优先级 2（中等），违反会阻断操作，但不覆盖 user_decision
  - WHEN 冲突时 THEN 优先级规则为：user_decision (1) > constraint (2) > recommendation (3)

#### F-02 扩展 AiFollowup 类型（兼容式）

- 描述：在 `src/types/response.ts` 中扩展 `AiFollowup` 接口，新增 `messages` 字段，保留 `instructions` 字段
- 验收：
  - WHEN 读 `AiFollowup` 类型定义 THEN 看到：
    ```typescript
    export interface AiFollowup {
      /** @deprecated 保留以兼容旧客户端；新客户端应优先读 messages */
      instructions?: string[];
      
      /** 结构化消息列表；新客户端优先消费此字段 */
      messages?: AiFollowupMessage[];
      
      suggested_tools?: ToolHint[];
    }
    
    export interface AiFollowupMessage {
      kind: MessageKind;
      text: string;
      priority: number;
    }
    ```
  - WHEN 读类型注释 THEN 明确标注 `instructions` 为 `@deprecated`，但不删除

#### F-03 修改所有 followup 返回点（双字段填充）

- 描述：修改 SpecManager、TaskManager、GoalAssessor、GateGuidance、SceneManager、WorkspaceManager 等所有返回 `ai_followup` 的地方，同时填充 `instructions` 和 `messages`
- 验收：
  - WHEN spec_create 成功后 THEN 返回的 `ai_followup` 同时包含：
    ```typescript
    {
      instructions: [
        '【事实】Spec 已创建成功。',
        '【建议】如果这是已有特性的增量...',
        '【重要】若用户已明确要求创建独立 Spec，不得擅自撤销。',
      ],
      messages: [
        { kind: 'fact', text: 'Spec 已创建成功。', priority: 0 },
        { kind: 'recommendation', text: '如果这是已有特性的增量...', priority: 3 },
        { kind: 'user_decision', text: '用户已明确要求创建独立 Spec。', priority: 1 },
        { kind: 'constraint', text: '不得擅自撤销用户决定。', priority: 2 },
      ],
    }
    ```
  - WHEN 跑全量测试 THEN 所有断言 `instructions` 的测试仍通过（向后兼容）

#### F-04 新增 kind 使用规范和 lint

- 描述：在 `src/shared/guidance-semantics.ts` 或新建 `src/shared/followup-rules.ts` 中定义 kind 使用规范，并提供辅助函数验证
- 验收：
  - WHEN 读规范文档 THEN 明确写出：
    - `recommendation` 的 text 不能出现”必须 / 禁止 / 不得 / 不要”等强制措辞
    - `constraint` 的 text 必须描述违反后的具体阻断行为（如”Spec 状态为 archived 时不能新增 task”）
    - `user_decision` 只能来自用户的原始输入或用户确认，不能由 lrnev 推断产生
    - `fact` 必须是客观可验证的项目状态，不能包含建议或判断
  - WHEN 调用 `validateFollowupMessage({kind, text})` THEN 如果违反规范则抛出错误（开发时可选启用）

#### F-05 提供 doctor 迁移命令

- 描述：在 `lrnev doctor` 中新增 `--migrate-followup` 选项（或作为独立子命令），把现有工作区中持久化的 followup（如果有）补充 `messages` 字段
- 验收：
  - WHEN 跑 `lrnev doctor --migrate-followup` THEN 扫描 `.lrnev/` 下所有可能包含 followup 的地方（如果 lrnev 有持久化 followup 的机制）
  - WHEN 发现只有 `instructions` 的旧格式 THEN 自动解析文本中的【事实】/【建议】/【约束】前缀，生成对应的 `messages`
  - WHEN 无法解析前缀 THEN 默认标记为 `kind='recommendation'`，并在迁移报告中列出需要人工确认的项
  - WHEN 迁移完成 THEN 输出报告：迁移了多少条、多少条需要人工确认

#### F-06 文档和示例

- 描述：更新 `docs/GOVERNANCE-FLOW.md` 和 `docs/AI-ADAPTATION.md`，说明结构化 followup 的使用方式和优先级规则
- 验收：
  - WHEN 读 `GOVERNANCE-FLOW.md` THEN 包含”ai_followup 结构化协议”一节，解释四种 kind 和优先级
  - WHEN 读开发者文档 THEN 包含示例代码，展示如何正确返回结构化 followup
  - WHEN 读客户端适配指南 THEN 说明如何优先读 `messages`，如何 fallback 到 `instructions`

### 非功能性需求

- 性能：双字段填充会增加返回体大小（约 20-30%），但不影响 MCP 传输性能
- 兼容性：**必须向后兼容**，旧客户端读 `instructions` 仍能正常工作
- 可维护性：新增 lint 规则确保 `kind` 用对，避免未来滥用

### 边界与依赖

- 依赖 08-00-guidance-semantic-boundary（先把文案语义理清楚，再上结构化）
- 不依赖外部客户端升级（保留 `instructions` 兼容）
- 如果 lrnev 当前没有持久化 followup 的机制，F-05 迁移命令可以简化为”只检查不迁移”

### 验收标准

- [ ] **核心验收**：WHEN 客户端 AI 收到冲突的 recommendation 和 user_decision THEN 可以通过比较 `priority` 字段机械地选择优先级高的那个，而不需要从文本推断
- [ ] **兼容性验收**：WHEN 旧客户端连接到升级后的 lrnev THEN 仍能读取 `instructions` 字段，行为不变
- [ ] **规范验证**：WHEN 开发者错误地把 recommendation 标记为 constraint THEN lint 或类型检查能捕获并报错
- [ ] **迁移验证**：WHEN 跑 `lrnev doctor --migrate-followup` THEN 能成功把现有工作区的旧格式 followup 补充 `messages` 字段
