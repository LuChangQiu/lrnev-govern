# 任务启动上下文：validates 锚点内容回填（提案）

> 来源：2026-06-12 Claude 提出 + GPT 交叉评审修正 + Claude 复核的讨论快照。
> 性质：功能提案，未立项。落地时按 lrnev 流程开 spec（能写出独立 WHEN…THEN 验收，够格进治理，不顺手改）。
> 关联：`dev-docs/PRODUCT-STRATEGY.md`（「软提醒→结构性在场」主线的微观应用）；scene 01 的 S6（锚点体系规范化）是其前置。

---

## 一句话

把任务启动时刻的「提醒 AI 去读需求/设计」升级为「把 F-xx/D-xx 锚点段落直接回填进返回结果」——追溯链从「可能读、可能不读」变成「开工上下文里必然有验收口径」。

## 问题

核心关切：AI 领了任务，**动手前是否真的看到了 validates 指向的需求/设计口径**？

现状是「lrnev 在正确的时机说了正确的话，但只是说，没有递」：

- 唯一推送点在 `task_update(in_progress)` 的 followup（`src/core/TaskManager.ts:893-897`）：「先读 requirements/design 中与 F-01、D-02 对应的段落，确认验收口径后再动手」。时机准、锚点具体，但递的是**指令不是内容**。
- AI 仍需自己打开 requirements.md / design.md、找到 `#### F-01` / `#### D-02`——两三次额外工具调用。每多一步操作多一层流失：强模型大概率走完，中弱模型很可能跳过。**这是产品最大的依从性问题在微观处的复现。**
- 四个衰减点：① 递指令不递内容；② 软 followup 无法验证读没读；③ `task_claim` 旁路无此提醒（`TaskManager.ts:982` 起只返回占用信息）；④ in_progress 的 followup 没用 suggested_tools 给现成 URI（completed 时反而给了）。

## 方案

任务启动时（`task_update(in_progress)` 与 `task_claim` 两个入口），lrnev 解析该 task 的 validates，从 requirements.md / design.md 抽取对应锚点段落，直接放入返回结果。

**本质**：把依从性问题从「AI 会不会去读」（行为，不可控）变成「AI 看不看得见」（内容已在 tool result 里进了上下文，必然看见）。模型越弱收益越大，与多模型受众目标同向。**不改状态机、不判断质量、不 block**——只是把确定性锚点内容送到开始任务的那一刻。

## 三方讨论中的修正（记录，防止凭记忆实现）

| 主张 | 结论 |
|---|---|
| Claude 初版「复用 S6 校验已打开的文件，零额外 IO」 | **不成立（GPT 纠错，Claude 认）**。S6 存在性校验在 `task_create` 时刻，回填在启动时刻，不同调用——启动时需重新读一次 requirements/design。可复用的是**定位逻辑**，不是 IO。两个小文件的读取成本值得付。 |
| GPT「复用 extractAnchorPool 思路，需新增抽段函数」 | **属实且比预想更近**：`extractAnchorPool(content, prefix)` 已存在于 `src/core/TaskManager.ts:499`（Doctor.ts:215-220 在用）。缺的是返回段落文本的 `extractAnchorSections` 变体。资源层目前只能整文档读（`src/mcp/resources/index.ts:32-34`），无按锚点抽段能力。 |
| create 与启动之间的时间差 | **新边界（Claude 补）**：锚点在 create 时存在、启动前被编辑删除 → 回填必须优雅降级（followup 警告「F-01 在 requirements 中已找不到」，不报错、不阻止启动）。副产品：回填成为锚点漂移的晚期检测器，覆盖 create 时校验够不到的窗口。 |

## 验收口径（收敛版）

- WHEN `task_update(status=in_progress)` 且 task 有 `validates=F-01|D-02` THEN 返回结果包含 F-01 的 requirements 段落与 D-02 的 design 段落。
- WHEN `task_claim` 成功且 task 有 validates THEN 返回同样的启动上下文（堵旁路）。
- WHEN task 无 validates THEN 降级链：spec 的 L0/L1 摘要（若存在）→ 现有「回看 requirements 目标与验收标准」提醒文案。摘要是可选产物，不存在不报错、不硬塞全文。
- WHEN 某锚点在对应文档中已找不到（启动时漂移）THEN followup 警告点名缺失锚点，不报错、不阻止启动。
- 每段内容有长度上限（单锚点上限 + 多锚点总上限），超长截断并标明 `truncated=true`。**起始值定保守**（建议单锚点 ~400 字、总 ~1200 字，真机用后再调）；**D-xx 设计段默认只回该段首行 + 标题**（不是可选项）——与 S4 刚做的 followup 消噪同向：噪音≠口径，但上限数字决定回填是「递口径」还是「灌上下文」，宁紧勿松、放宽容易收紧难。
- 回填逻辑住 core，CLI 与 MCP 第一天对等（S1 原则）。
- 不改变状态机、不判断质量、不 block。

## 实现要点

- 新增 `extractAnchorSections(content, anchors)`（与 `extractAnchorPool` 同族，住 `TaskManager.ts` 或抽出的共享锚点工具），返回 `#### F-xx` 到下一同级标题之间的文本。
- 接入点：`buildFollowupAfterUpdate`（in_progress 分支）与 `buildClaimResponseFollowup`，两处共用同一抽段结果结构。
- 启动时新增 2 次小文件读取（requirements.md / design.md），可按 validates 实际涉及的文档裁剪（只有 F-xx 就不读 design）。

## 优先级定位

**S6 的自然后续，建议排在治理报表（战略第三步）之前。**理由：report 是事后收割结构化数据；本提案是动手前保证 AI 看见需求/设计——**追溯链的实时闭环**。S6 落地后锚点语法已规范（只认 F-xx/D-xx），抽段实现才不用处理自由字符串。

顺序依赖：S6（锚点规范 + 存在性硬校验）→ 本提案（锚点内容回填）→ report（锚点覆盖率收割）。三步共用同一套锚点基础设施，逐级变现。

## 不做的

- 不在回填里塞整篇 requirements/design（上下文成本失控，且违背「只递口径」）。
- 不因锚点漂移阻止任务启动（漂移是 warning，不是 error——启动权在 AI/用户）。
- 不新增 MCP 资源模板（如 `context://spec/.../anchor/F-01`）——除非后续报表/外部消费需要，先只做 followup 回填这一个出口，避免过早泛化。
