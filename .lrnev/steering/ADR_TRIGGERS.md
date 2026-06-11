# ADR 生成触发条件

> ADR（架构决策记录）不是自动生成的，是 AI **察觉到决策点**时**主动询问**用户。
> 本文档列出"什么算决策点"。

---

## 5 种触发情形

### 触发 1：在 A 和 B 之间做选择

对话中出现技术选型对比时：

- "我们用 RBAC 还是 ABAC？"
- "用 Postgres 还是 MySQL？"
- "用 REST 还是 GraphQL？"
- "用 Redis 还是内存缓存？"

**AI 行为**：
1. 帮用户分析利弊
2. 用户做出选择后，**主动问**："这是个重要决策，要生成 ADR 吗？"

### 触发 2：拒绝某个方案

用户/AI 明确**否定**了某个看似合理的方案：

- "不用 ORM，我们直接写 SQL"
- "不引入微服务，单体保持"
- "不用 TS 严格模式，用宽松配置"

**AI 行为**：把"为什么不选"作为决策记录下来。

### 触发 3：改变之前的决定

用户改变了之前的方向：

- "之前打算用 Kafka，改成 Redis Stream"
- "原来设计的多租户去掉了"

**AI 行为**：
- 生成新 ADR
- 在新 ADR 的 frontmatter 里加 `supersedes: ['XXXX']` 引用旧 ADR
- 把旧 ADR 状态改为 `superseded`

### 触发 4：引入新依赖 / 新服务

引入项目之前没有的核心依赖：

- "加 Kafka"
- "引入 Stripe"
- "用 Cloudflare R2 替代 S3"

**AI 行为**：记录"为什么需要它 / 备选方案 / 影响"。

### 触发 5：设定全局约束

确立项目级硬约束：

- "统一用 ESM"
- "所有 API 必须有版本号"
- "禁止任何 console.log"

**AI 行为**：写为 global scope 的 ADR。

---

## 不该生成 ADR 的情形

- ❌ 微调（如改了一个变量名）
- ❌ Bug 修复（应该进 Errorbook）
- ❌ 实验性尝试（用户没明确接受）
- ❌ 个人偏好（应该进 Memory: preferences）

---

## 询问用户的话术

```
我注意到我们刚才做了一个决策：[简要描述]。

这看起来是个值得记录的架构决策，要生成 ADR 吗？
我会写一份草稿，包含：
- 背景
- 决策内容
- 备选方案及拒绝理由
- 后果分析

回复"是 / yes / OK"我就生成。
```

---

## 用户确认后的流程

1. 调 `adr_create({ title, scope, context, decision, alternatives, consequences })`
2. 工具返回 ADR 文件路径
3. 把 ADR 内容展示给用户确认
4. 按 ai_followup 生成 L0/L1 摘要

---

## scope 选择（结合 SCOPE_RULES）

- 跨 Scene 的决策 → `global`
- 仅某个 Scene 的决策 → `scene:{id}`
- 不确定 → `global` + tentative: true
