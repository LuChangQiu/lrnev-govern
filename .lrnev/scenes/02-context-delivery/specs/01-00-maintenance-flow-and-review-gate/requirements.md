---
spec: '01-00-maintenance-flow-and-review-gate'
scene: '02-context-delivery'
status: draft
priority: P0
created: '2026-06-15'
---

# 01-00 维护态流程 + 需求审核门 + 任务启动上下文 - 需求

> 权威依据：`dev-docs/PRODUCT-STRATEGY.md`（维护态缺口分析）+ `dev-docs/TASK-START-CONTEXT.md`（任务启动上下文收敛口径）+ 2026-06-15 对话决策（需求审核门）。
> 后续 spec（治理地图 / 搜索升级 / 执法环 / 报表等）见本 scene 的 `roadmap.md`，不在本 spec。

## L0 摘要

修通三处治理数据没送达 AI 的核心缺口：小增量没有轻量落位通道、新需求写完没有人工审核门、任务启动时只递指令不递内容。

## L1 概览

### 问题域

lrnev 积累了结构化治理数据，但在三个关键时刻没有有效送达 AI：

**缺口一：维护态——小增量没有轻量通道。**

项目越成熟，工作越是以小增量为主（加参数、改文案、修边角）。现有轻产物（memory/errorbook/ADR）是**知识轨道**（记"这件事教会了我们什么"），不是**工作轨道**（记"这件事做没做完、对应哪个需求"）。

典型场景"给已完成的登录功能加个记住我选项"：errorbook 没踩坑、memory 不是约定、ADR 没有决策、新开 spec 写不出独立验收——AI 真机表现为乱开新 spec（2026-06-05 xpaas-gen-v3 实测）或绕开 lrnev。**这是留存的最大威胁**——"小增量是大多数真实工作的形态"。

协议层已留了路（状态机允许 `completed → in-progress` 回退，GOVERNANCE-FLOW 写了"增量加需求在本版 task_create 即可"），但**对 AI 不可见**——分流指引是二元的（"开 spec 还是直接做"），缺第三分支"落位到已有 spec"。

**缺口二：需求审核——新特性需求写完后没有人工门。**

`spec_create` → 填 requirements → ready gate（结构校验）→ 直接建 task。ready gate 只校验标题/FILL/验收框，不校验内容方向：AI 可能把"用户登录"理解成"社交登录"，需求错了全链路的正确性都是假的。需求是追溯链路源头，但没有让用户审一眼的环节。

**缺口三：任务启动——只递指令不递内容。**

task 推进到 in_progress 时，AI 收到一句"先读 requirements/design 中与 F-01 对应的段落"——但它手里没有内容，要自己去文件里翻（两三次额外工具调用）。每多一步操作多一层流失：强模型大概率走完，中弱模型很可能跳过。**这是产品最大的依从性问题在微观处的复现。** S6 的锚点规范化让"拦截坏引用"成为可能，但**正向递送**还没做：锚点校验只在写入时挡坏的，不在使用时递好的。

### 用户故事

- **U-1（小增量落位）**：想给已完成的登录功能加"记住我"时，我希望快速找到已有登录 spec 并加 task，而不是被迫开新 spec 或绕开 lrnev。
- **U-2（需求审核门）**：开新 spec 填完需求时，我希望 AI 停下来让我审核需求再继续，而不是静默放行一个可能方向错的需求。
- **U-3（已有 spec 加 task 不被拦）**：落位到已有 spec 加 task 时不被需求审核门拦——那个 spec 的需求早审过了。
- **U-4（任务启动上下文）**：task 推进时 AI 手里有对应的验收口径段落，而不是一句提示然后自己翻文件。

### 范围

**包含**：
- F-01：小增量轻量落位（分流指引铺显，completed→in-progress 回退提示）。
- F-02：需求审核门（ready gate passed 时 followup 强制停，让用户审需求）。
- F-03：任务启动上下文（in_progress / claim 时回填 F-xx/D-xx 锚点段落）。
- F-04：分流路径边界定义（新开 spec〔有域 scene / 00-default〕 vs 落位已有 spec vs 不落地的分流判断）。

**不包含（移至 scene roadmap，按阶段推进）**：
- 治理地图、context_search 锚点级抽段、BM25 打分 —— 定位升级，下一个 spec。
- git pre-commit 配方、doctor 未治理变更审计 —— 入口执法，**硬依赖本 spec 的 F-01 维护通道先行**。
- AGENTS.md（**只在文档建议用户自己加，不做 lrnev 代码生成**——侵入用户不拥有的跨工具配置）。
- `lrnev report` 结构化回报、`lrnev integrate` 薄垫片、国际化 alias 表 —— 再后续。
- 工具描述瘦身 —— **观察项，非确定需求**：尚无"弱模型因工具多而选错"的实测证据，记录在 roadmap 待真机验证，不预先动。

**永远不做**：agent 编排/子任务调度（harness 地盘）；语义检索/向量（零模型是身份）；追新客户端每个特性。

## L2 详情

### 详细需求

#### F-01 小增量落位：分流指引铺显

- 描述：AI 动手前的分流指引从二元（"开 spec 还是直接做"）扩展为三元："开新 spec（独立可交付特性）→ 落位已有 spec 加 task（小增量）→ 不落地（改错字/调样式等小事）"。触发点：
  - `spec_create` 的 followup：追加"先 context_search 确认是否已有相关 spec 可落位"。
  - `lrnev_guide` 与 `docs/AI-ADAPTATION.md` 的常驻提示词模板片段（产品自身不持有 CLAUDE.md，该片段供用户贴进各自客户端的 CLAUDE.md / 常驻提示槽）：分流指引显式写出第三分支。
  - 在 completed spec 上 `task_create` 时：followup 提示状态回退语义（"completed → in-progress 表示有未完成工作"）。注意此提示在 `task_update(in_progress)` 入口**已存在**（`buildFollowupAfterUpdate` 在 specStatus=completed 时已发），F-01 只需把它**补到 `task_create` 入口**，不要重造。
- 验收：
  - WHEN 调 `spec_create` THEN followup 含"先 context_search 确认是否该落位到现有 spec"。
  - WHEN 在 completed 状态的 spec 上 `task_create` THEN followup 提示"若需回退状态，可调 spec_update 把 status 改回 in-progress"。
  - WHEN 调 `lrnev_guide` 或读常驻提示词 THEN 分流指引含三个分支（新开 / 落位 / 不落地）。
  - 三条均为 followup 提醒、不强制——AI 仍可开新 spec，但被显式告知有更轻的路。

#### F-02 需求审核门：新开 spec 的需求通过 ready gate 后强制停

- 描述：`spec_gate_check` 当 gate=ready 且 passed=true 时，followup 追加强制停语："**请暂停，把 requirements.md 展示给用户确认后再继续**——这是用户审核'做什么'的唯一机会。需求确认后 AI 再建 task 和设计。如用户明确说'直接做'则可跳过。"
  - 只对 ready gate passed 触发；落位到已有 spec 加 task 不触发（F-04 边界）。
  - 为什么是 followup 不是 block：保持"只引导不强制"。"绕过"是用户的权利，"遗忘"靠 followup 消灭。
- 验收：
  - WHEN `spec_gate_check(gate=ready)` 返回 `passed=true` THEN followup 含"请暂停"与"把 requirements.md 展示给用户确认后再继续"。
  - WHEN 用户明确说"直接做" THEN AI 继续（followup 引导、不阻断）。
  - completion gate / creation gate 的 followup 不受影响。

#### F-03 任务启动上下文：in_progress / claim 时回填锚点段落

- 描述：在 `task_update(in_progress)` 与 `task_claim` 两个入口，若 task 带 `validates`（F-xx / D-xx），解析锚点并从 requirements.md / design.md 抽取对应段落，**作为结构化字段随返回结果送达 AI**（不只是文字提示）。把依从性问题从"AI 会不会去读"（行为，不可控）变成"AI 看不看得见"（内容已在 tool result 里进了上下文）。
  - **返回结构**：在工具返回的顶层 `data` 同级新增 `anchor_context` 字段（**不是 `ai_followup.data`——ai_followup 只有 instructions/suggested_tools 两个字段，无 data**）。结构形如 `{ anchor, source: 'requirements'|'design', text, truncated: bool }[]`。CLI JSON 输出与 MCP 返回含同一字段（CLI/MCP 对等，S1 原则）。
  - **两个入口都做**：`task_update(in_progress)` 走 `buildFollowupAfterUpdate`、`task_claim` 走 `buildClaimResponseFollowup`，两处共用同一抽段结果——**堵 claim 旁路**（claim 进任务不走 update，不堵就漏）。
  - **截断策略**：单锚点段落上限约 400 字（超出截断 + `truncated=true`）；总回填上限约 1200 字；**D-xx 设计段默认只回首行 + 标题**（不是可选项）。起始值定保守，真机用后再调（放宽容易收紧难）。
  - **回填不替代原文**：followup instructions 仍保留"请回看 requirements.md / design.md 原文"。防弱模型把截断段落当全部需求。
  - **无 validates 的降级链**：spec 的 L0/L1 摘要（若存在）→ 现有"回看 requirements 目标与验收标准"文案。摘要是可选产物，不存在不报错、不硬塞全文。
  - **漂移降级（扩展现有告警，非新增）**：`task_update` 入口已有坏锚点软告警（`findBadValidatesAnchors` → `buildFollowupAfterUpdate` 的 `badAnchorWarning`），已覆盖"锚点在 create 时存在、启动前被删"的场景；F-03 在此**复用/扩展**它，不另起平行路。真正的缺口在 **`task_claim` 入口**——claim 不算 badAnchors，漂移告警漏掉，需在 `buildClaimResponseFollowup` 补同款检测。告警一律不报错、不阻止启动；副产品：成为锚点漂移的晚期检测器，覆盖 create 时校验够不到的窗口。
  - **不复用 S6 的 IO**（GPT 纠错，已认）：S6 存在性校验在 create 时刻，回填在启动时刻，不同调用——启动时需重新读 requirements/design。可复用的是**定位逻辑**（`extractAnchorSections` 与已有 `extractAnchorPool` 同族），不是 IO。两个小文件读取成本值得付，按 validates 实际涉及的文档裁剪（只有 F-xx 就不读 design）。
- 验收：
  - WHEN `task_update(in_progress)` 且 task 有 `validates=F-01` THEN 返回顶层含 `anchor_context`，内有 F-01 的 requirements 段落，段落短于 400 字时 `truncated=false`。
  - WHEN task 有 `validates` 含 D-xx THEN D-xx 段默认只回首行 + 标题。
  - WHEN `task_claim` 成功且 task 有 validates THEN 返回同样的 `anchor_context`（堵旁路）。
  - WHEN 某锚点段落超过 400 字 THEN `truncated=true`、内容截断。
  - WHEN task 无 validates THEN 走降级链（有摘要回摘要、无则现有文案），不返回空 anchor_context 误导。
  - WHEN 某锚点在文档中已找不到 THEN followup 点名警告、不报错、不阻止启动。
  - followup instructions 仍含"请回看原文"。
  - CLI `task update` / `task claim` 的 JSON 输出与对应 MCP 工具含同一 `anchor_context` 字段。

#### F-04 分流路径的边界定义

- 描述：明确"新开 spec / 落位已有 spec / 不落地"的决策边界，在 followup/文档中统一表述。开 spec 这一支再按有无业务域细分：
  - 能写出独立 WHEN…THEN 验收 + 可独立交付，且**有业务域归属** → 在对应 scene 下新开 spec（走 F-02 审核门）。
  - 能写出独立验收 + 可独立交付，但**无业务域/很小** → 在 `00-default` 下新开 spec（同样走 F-02）。`00-default` 是给"无显式 scene 的 spec"的默认落点，不为这种小特性单开 scene。
  - 已有 spec 的 completed 特性要加参数/改边角/加子功能 → 落位（task_create 直接走，不审需求）。
  - **写不出独立 WHEN…THEN 验收的小改动**（改错字/调样式等）→ 不开 spec、不开 task，就是一个 commit。lrnev 不为它建实体（git 才是变更的真相源）；将来 git 执法上线后用 commit 消息约定放行，不在本 spec。
  - 不确定 → 先 context_search，有则落位，没有再按上面判断开新的。
- 验收：
  - WHEN AI 准备 spec_create THEN followup 含边界判断指引（说明何时开新 spec、何时落位、何时连 spec 都不开；开新 spec 时区分有域 scene 与 00-default）。
  - WHEN 落位到已有 spec 加 task THEN 不触发 F-02 需求审核门（F-02 只在 `spec_gate_check ready passed` 触发）。

### 非功能性需求

- 性能：F-03 启动时新增至多 2 次小文件读取（requirements.md / design.md），按 validates 实际涉及裁剪；F-01/F-02/F-04 纯 followup 文案，零 IO。
- 改动面：F-01/F-02/F-04 纯 followup 文案，零 IO；F-03 直接给共享契约 `AiFollowupResponse`（`types/response.ts`）加 `anchor_context` 字段——这会改所有工具的返回形状。lrnev 还年轻、不背向后兼容包袱：破坏性改动直接上、迁移交给 `doctor`，故不写"不破坏旧消费方"的对冲。仍不改 passed、不改 gate 逻辑、不改状态机、不新增 API 或 flag。
- 战略约束：F-01 维护通道是后续 git pre-commit / doctor 审计环的硬前置（顺序硬依赖，见 PRODUCT-STRATEGY；roadmap 已标）。

### 边界与依赖

- 与 scene 01 的 S6 互补：S6 在 create 时**挡坏引用**；本 spec F-03 在 in_progress/claim 时**递好内容**——同一条筋的两面。
- `extractAnchorSections`（新增，返回 `#### F-xx` 到下一同级标题之间的文本）与 `extractAnchorPool`（S6 已有，见 `TaskManager.ts` 的 `extractAnchorPool` 导出函数）同族：后者返回 ID 集合，前者返回 ID→段落映射。沉淀为共享锚点工具，供本 scene 后续的治理地图/搜索升级复用。
- 接入点：`buildFollowupAfterUpdate`（in_progress 分支）与 `buildClaimResponseFollowup`（claim 分支），两处共用同一抽段结果结构。
- F-01/F-02 的 followup 改动在 spec_gate_check 与 spec_create 的 followup 构造函数；分流指引改动涉及 `src/mcp/guidance.ts` 与 `docs/AI-ADAPTATION.md` 的常驻提示词模板片段（产品不持有 CLAUDE.md，该片段供用户贴入自己的 CLAUDE.md）。

### 验收标准

最初失败信号：维护态缺口（AI 乱开新 spec / 绕开 lrnev）；ready gate passed 后 AI 静默继续建 task 不等用户审需求；task 推进/claim 时 AI 只收到一句"先读 F-01"而无内容。期望结果：小增量有轻量落位路；新 spec 需求有人审门；task 启动时 AI 手里有对应验收口径段落（两入口都送达）。
- [ ] F-01：spec_create 引导落位、completed spec 加 task 提示状态回退、lrnev_guide 三分支。
- [ ] F-02：ready gate passed 时 followup 含"请暂停让用户确认需求"。
- [ ] F-03：in_progress 与 claim 两入口都回填 `anchor_context`（顶层字段、含截断标记、D-xx 默认首行）；无 validates 走降级链；漂移降级警告；followup 保留原文提示；CLI/MCP 对等。
- [ ] F-04：落位已有 spec 加 task 不触发需求审核门。
- [ ] 新增测试覆盖；npm test 全绿无回归。
