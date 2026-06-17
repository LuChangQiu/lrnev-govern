---
scene: '02-context-delivery'
created: '2026-06-15'
---

# Context Delivery - 路线图

> 本 Scene 的中长期规划。Spec 是路线图的具体实施。
> 业务线：把治理数据在正确时刻送进 AI 上下文。
> 战略依据：`dev-docs/PRODUCT-STRATEGY.md`（战略四步）+ `dev-docs/NEXT-STEPS.md`（检索三件套 + 执行顺序）。

## 当前阶段

需求定义中。首个 spec `01-00-maintenance-flow-and-review-gate`（维护态流程 + 需求审核门 + 任务启动上下文）已写 requirements、过 ready gate，待用户审。本 scene 后续 spec 按下方阶段顺序推进，**前一阶段是后一阶段的前置依赖**。

## 已完成

- scene 01-findings-remediation（v2.0.0）打通确定性硬校验地基，含 S6 锚点体系（F-xx/D-xx 规范 + 存在性校验 + `extractAnchorPool`）——本 scene 的锚点基础设施前置。

## 进行中

- spec 01-00：维护态流程 + 需求审核门 + 任务启动上下文（F-01~F-04）。requirements 已就绪，待审 → design → tasks → 实现。

## 计划中

### 阶段二：定位升级（下一个 spec，复用 extractAnchorSections 共享地基）

- **治理地图**：repo-map 思路——scene→spec(状态/L0)→锚点标题 的压缩全景（约 2-4k token），一次性入上下文，AI 看图用 URI 直接跳转，把定位从 O(搜索质量) 变 O(1)。实现 = 聚合已有 frontmatter + extractAnchorPool 输出（抄 Aider repo-map）。
- **context_search 锚点级抽段返回**：命中终点从文档级精确到 `#### F-xx`/`#### D-xx` 段落级，复用 spec 01-00 沉淀的 `extractAnchorSections`。
- **BM25 打分替换原始 TF**：替换裸命中计数（长文档高频词压过精准短文档），纯算术零依赖约 50 行，对中文子串照常工作。
- 检索域优先级：治理地图 > 锚点抽段 > BM25 > （条件触发的）SQLite FTS。前三个零模型零新依赖。

### 阶段三：分红（`lrnev report` —— 决策 2026-06-15）

> 提前理由：前面所有 spec 都在让用户"交税"（写 requirements/validates、过 gate）。report 是第一个"分红"——读 `.lrnev/` 自有数据生成报告，让用户尝到结构化数据的好处，写 validates 从负担变投资。故从原阶段四提前。
>
> **身份契合**：report 是纯 lrnev 内部能力（只读自己的 `.lrnev/` 数据），无任何环境侵入，完全契合 MCP+CLI 身份——与下方"待评估"里那几个"MCP 之外的触达层"形成对比。

- **`lrnev report`**（spec 03-00）：validates 覆盖率、需求→任务→完成链路完整度、按 spec 生成 release notes 草稿。S6 锚点规范化是前置（已通）。待 01-00 / 02-00 完成后开 spec。

## 待评估

- **「MCP 之外的触达层」整组降级（决策 2026-06-15，不做、等真实需求信号）**：以下三者都不是 lrnev 的核心治理能力，而是"让 lrnev 在 MCP 调用之外也在场"的分发/触达尝试——共同问题：与 MCP+CLI 身份有割裂感、侵入用户不拥有的环境、依赖"用户愿意装"。**核心价值（追溯/gate/任务治理）不依赖它们**。等 lrnev 核心被验证、出现真实抱怨（如"AI 老偷懒绕开治理"）后再评估，现在不开 spec。
  - **git pre-commit 执法**：在 commit 那一刻（写入历史前）检查"动了源码却无 task 活动"，补 MCP 够不到的盲区（AI 不调工具直接改代码，lrnev 作为被动方看不见）。本质是 lrnev **CLI** 提供给 git hook 调用的命令，不是 MCP 功能。降级主因：安装侵入 `.git/hooks`/husky、且 init 不能自动装。
  - **doctor 未治理变更审计**：对比近期 git 提交与 task 状态变更列出"未治理的变更"。与 git 执法同源，同降级。（若将来做，仍硬依赖 F-01 维护通道先行，否则审计对无处安放的变更持续报警→I-19 脱敏。）
  - **AGENTS.md 生成 / `lrnev integrate` 薄垫片**：提示词层 / 客户端钩子层的在场尝试。AGENTS.md 标准仍在各家博弈、integrate 要钻各客户端钩子——侵入性 + 押注未定型标准。最多在文档建议用户自己加，不做 lrnev 代码生成。
- **MCP 工具描述瘦身**（用户 2026-06-15 要求记录）：当前约 30+ 工具，PRODUCT-STRATEGY 推测"对弱模型和小上下文客户端是负担、弱模型选错工具概率随工具数上升"。**但尚无实测证据**——是观察项不是确定需求。触发条件：真机观察到"弱模型确实因工具多而选错/超上下文"后，再考虑按场景分组暴露或合并低频工具。预先瘦身可能砍掉有用工具，属过早优化。
- **国际化标题 alias 表**：ready gate 中文标题硬契约（I-13）的国际化通道——alias 表支持英文等标题映射到中文模板。等前三阶段验证产品有非中文受众后再做。
- **SQLite FTS5**：现在不上。触发条件：真实项目扫描 >300-500ms 可感知时，作可丢的 `.lrnev/cache/`（Node 24 基线 + trigram + LIKE 兜底 + mtime 校验）。详见 NEXT-STEPS 第三节。
- **doctor 子命令 / 迁移 flag 合并**（决策 2026-06-15，功能稳定后再做）：当前 `doctor --migrate-todos` / `--migrate-summaries` 一个迁移一个 flag、分得太碎；待 scene 02 功能落地后收敛成一个（如 `doctor --migrate` 自动检测该迁什么，或并进 doctor 默认 detect+fix）。属 CLI 人体工学小重构，不是 spec，时机到了直接做。

## 永远不做（守住边界）

- agent 编排 / 子任务调度 —— harness 地盘，进去就是和 Claude Code/Codex 正面竞争。
- 语义检索 / 向量 / embedding —— 零模型是身份不是省钱；治理语料小而结构强，精确派打得过模糊语义（Sourcegraph 放弃 embeddings 退回关键词为旁证）。
- 持久化 JSON 索引缓存 —— 为不存在的瓶颈优化；无 watcher 时索引陈旧是死结。
- 追新客户端的每个新特性 —— 薄垫片做最主流两三家，其余靠 git 层兜底 + 社区模板。
