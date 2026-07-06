# lrnev 全功能真机走查（E2E Feature Walkthrough）

> 目的：让一个 AI agent **完全模拟真实用户**，把 lrnev v2.1.0 的**每一个功能**走一遍，记录实际行为 vs 期望，产出一份发现清单。比 `FINDINGS-CHECKLIST.md`（聚焦硬校验缺口）和 `INTEGRATION-TEST.md`（聚焦集成点）更全面——覆盖正常路径、边界、错误路径、CLI/MCP 对等、v2.1 新功能。
>
> **执行方式**：在一个**全新临时目录**里跑（别污染本仓库的 `.lrnev`）。两条通道都要验：
> - **CLI 通道**：`lrnev <cmd>`（全局装了 `lrnev`；或 `node <repo>/bin/lrnev.mjs` 但需先 `npm run build`）。
> - **MCP 通道**：把 `lrnev-mcp` 配进客户端，用工具名调用。
> 每个用例标 `[CLI]` / `[MCP]` / `[both]`。
>
> **记录格式**：每条用例记 `PASS / FAIL / 偏差`，FAIL 写「期望 vs 实际 + 复现命令」。结尾汇总。
> **版本**：v2.1.0。**零模型**：lrnev 不调任何 LLM，纯确定性 + ai_followup 文本。

---

## 执行准备（执行者必读）

**0. 版本守卫（最重要）**：本轮测的是**未发布的 v2.1.0**。开测前必须确认：
- `lrnev --version` → **2.1.0**（不是 2.0.0；若是 2.0.0 说明用到了旧的全局 npm 包，停下报告）。
- `lrnev --help` 必须列出 `map` 子命令；MCP listTools 必须含 `governance_map`（v2.1 新增）。
- MCP 通道用**我的 build**：`node E:/project/.lrnev/lrnev-cli/product/lrnev-govern/bin/lrnev-mcp.mjs`，不要用全局 `lrnev-mcp`（除非确认它已 link 到本 build）。

**1. 工具数 sanity**：listTools 约 **39 个**（v2.0 的 ~38 + 新增 governance_map）；**不应有** `adr_suggest`。

**2. 驱动方式**：
- codex-cli：`codex exec "<prompt>"`（非交互，读 prompt 跑完）。
- opencode：`opencode run "<message>" -m <provider/model>`；MCP 配置参考 `.tmp/opencode-lrnev-test.json`（`mcp.lrnev.command = [node, .../bin/lrnev-mcp.mjs]` + `environment.LRNEV_WORKSPACE` 钉到被测项目）。

**3. 两种工作区**：
- **空区测试**（阶段 1~15 主体）：全新临时目录，覆盖功能正确性。
- **真实项目测试**（阶段 16）：从 `E:/project/.lrnev/lrnev-cli/research/*` 或 `.tmp/*` 选一个真实代码库，`LRNEV_WORKSPACE` 钉过去，验证"在真实项目里 init→建 spec→走流程"的体感与探测。

---

## 阶段 0 — 环境与冷启动

| # | 操作 | 期望 |
|---|------|------|
| 0.1 | `[CLI]` 新建空临时目录 `T`，cd 进去 | — |
| 0.2 | `[CLI]` `lrnev --help` | 列出全部子命令（init/status/map/scene/spec/task/gate/adr/goal/summary/session/hook/agent/error/memory/doctor/search/guide） |
| 0.3 | `[CLI]` `lrnev guide` / `[MCP]` `lrnev_guide` | 返回工作流/工具速查/错误自救/概念；`lrnev_guide{topic:"errors"}` 只返错误自救 |
| 0.4 | `[MCP]` 连接后读 server instructions | 含「lrnev 是什么 + 新建/接手怎么走 + 四路分流」；分流摘要 ≤480 字 |

## 阶段 1 — 工作区初始化

| # | 操作 | 期望 |
|---|------|------|
| 1.1 | `[both]` `lrnev init --project-name demo` / `lrnev_init{project_name:"demo"}` | 创建 `.lrnev/`：PROJECT.md、ARCHITECTURE.md、steering/、scenes/00-default/、decisions/、errorbook/、memory/、config/hooks.json 等；PROJECT.md 作为"已初始化"标记 |
| 1.2 | `[both]` 再 init 一次 | 幂等/不破坏既有内容（或明确提示已初始化） |
| 1.3 | `[CLI]` 检查 `.lrnev/scenes/00-default/` 存在 | 默认 scene 在 |
| 1.4 | `[both]` 在**有代码的目录**里 init，检查 `.lrnev/auto/codebase.json` | 探测到技术栈/`root_files`（如 package.json/pom.xml）；噪音目录（.idea/logs/node_modules）被忽略；`data.codebase_detected=true`，followup 引导 AI 读构建文件补 ARCHITECTURE/PROJECT |

## 阶段 2 — Scene 管理

| # | 操作 | 期望 |
|---|------|------|
| 2.1 | `[both]` `scene create user-management` | 生成 `01-user-management/`：scene.md、architecture.md、roadmap.md |
| 2.2 | `[both]` `scene create x`（名 <2 字符）| 拒绝：名长度 2~64 |
| 2.3 | `[both]` `scene list` | 列出 00-default + 01-user-management，含 status/spec_count |
| 2.4 | `[both]` `scene get user-management`（id/序号/纯名都试）| 解析成功，返回元信息 + 统计 |
| 2.5 | `[both]` `scene create payment --intent "支付域"` | followup 给单/多 Spec 拆分信号 |

## 阶段 3 — Spec 生命周期（核心流程）

| # | 操作 | 期望 |
|---|------|------|
| 3.1 | `[both]` `spec create user-login --scene user-management --priority P0` | 生成三文档 requirements/design/tasks（带 FILL 哨兵 + 中文模板章节）；followup 含**四路分流提醒**（落位/00-default/context_search） |
| 3.2 | `[both]` `spec create quick` 不传 scene | 落到 00-default |
| 3.3 | `[both]` 立即 `spec_gate_check ready`（未填）| **失败**：FILL 哨兵残留 / 未勾选验收（列出 checks 的 name/message/hint） |
| 3.4 | `[CLI]` 编辑 requirements.md：填掉 FILL、写真实 `#### F-01`/`#### F-02`、勾选验收 | — |
| 3.5 | `[both]` `spec_gate_check ready` | **通过**；followup 含**「请暂停，把 requirements.md 展示给用户确认」需求审核门**（v2.1）+ 建议 ADR + EARS 示范 |
| 3.6 | `[both]` 把章节标题改成英文（如 `## Requirements`）再跑 ready | **失败**：标题须与中文模板一致（I-13 模板契约） |
| 3.7 | `[CLI]` 填 design.md：写 `#### D-01` 设计点，删掉所有 FILL | — |
| 3.8 | `[both]` `spec_update status=ready→in-progress` | 状态机合法转换；非法转换（如 draft→completed）报 INVALID_STATUS_TRANSITION |

## 阶段 4 — Task 生命周期 + 锚点校验

| # | 操作 | 期望 |
|---|------|------|
| 4.1 | `[both]` `task create "实现登录" --validates F-01 --acceptance "200" "401"` | T-001 创建，validates=F-01 写入 meta |
| 4.2 | `[both]` `task create "x" --validates F-99`（不存在）| **拒绝** ANCHOR_NOT_FOUND，不落盘 |
| 4.3 | `[both]` `task create "x" --validates design#3.2`（旧式）| **拒绝**，提示改用 D-xx |
| 4.4 | `[both]` `task create "x" --depends-on T-999`（不存在）| **拒绝** TASK_NOT_FOUND，不落盘 |
| 4.5 | `[both]` `task create "子任务" --parent T-001` | 子任务插到父块末尾 |
| 4.6 | `[both]` `task update T-001 status=in_progress` | 合法；**回填 anchor_context**（见阶段 6）；非法转换报错 |
| 4.7 | `[both]` `task claim T-002 --agent-id a` / `task release` | claim 软占用登记/释放；followup 提示运行态语义 |
| 4.8 | `[both]` `task list`（raw / readable 两视图）| readable 隐藏 history/meta |
| 4.9 | `[both]` 在 completed 的 spec 上 `task create` | followup 提示「completed→in-progress 表示有未完成工作，可 spec_update 回退」 |

## 阶段 5 — Gate 完成校验

| # | 操作 | 期望 |
|---|------|------|
| 5.1 | `[both]` 所有 task 未完时 `spec_gate_check completion` | 失败：有未 completed task |
| 5.2 | `[both]` requirements 或 design 残留 FILL 时 completion | **失败**（requirements_no_fill/design_no_fill 硬拦） |
| 5.3 | `[CLI]` 删掉 design.md 再 completion | **失败** design_exists |
| 5.4 | `[both]` 全 task completed + 无 FILL + design 在 | **通过** |

## 阶段 6 — 任务启动上下文回填（v2.1 F-03）

| # | 操作 | 期望 |
|---|------|------|
| 6.1 | `[both]` task 带 `validates=F-01`，`task update in_progress` | 顶层 `anchor_context`：含 F-01 的 requirements 段落、source=requirements、<400 字 truncated=false |
| 6.2 | `[both]` task 带 `validates=D-01` | anchor_context 中 D-xx **只回首行+标题** |
| 6.3 | `[CLI]` 造一个超长 F-xx 段（>400 字）再 in_progress | truncated=true，**按句末/换行边界截断**（不切半句） |
| 6.4 | `[both]` task **无 validates** + 写了 spec 的 L0 摘要（内联 `## L0 摘要`）| 回填 `summary_context`，source=inline |
| 6.5 | `[both]` 同上但用 `summarize_save` 写 sidecar | summary_context source=**sidecar**（优先于内联） |
| 6.6 | `[both]` 无 validates 且无任何摘要 | 不回 context，followup 退回「回看本 Spec 目标与验收」 |
| 6.7 | `[both]` `task claim` 带 validates 的 task | **同样回填 anchor_context**（堵旁路） |
| 6.8 | `[CLI]` task create 后把 F-01 从 requirements 删掉，再 claim | **漂移软告警**点名 F-01，不报错、不阻断 |
| 6.9 | `[both]` 对比 CLI 与 MCP 的 anchor_context/summary_context | 字段对等 |

## 阶段 7 — 分流四路（v2.1 F-01/F-04）

| # | 操作 | 期望 |
|---|------|------|
| 7.1 | `[both]` `spec_create` 的 followup | 含四路：有域 scene / 无域 00-default / 落位已有 spec / 不开 |
| 7.2 | `[both]` `lrnev_guide` / server instructions 的分流摘要 | 四路；scene_create 门槛="用户确认/明确多 spec"；scene/00 拿不准问用户 |

## 阶段 8 — 检索与定位（v2.1 F-01/F-02/F-03）

| # | 操作 | 期望 |
|---|------|------|
| 8.1 | `[both]` 造一个短而精准的 spec + 一个长而泛泛提同词的 spec，`context_search 关键词` | **BM25**：短精准排在长高频前；两个都召回（召回集不缩小） |
| 8.2 | `[both]` 搜中文两字词 | 正常打分（子串口径） |
| 8.3 | `[both]` 命中落在某 `#### F-xx` 段内 | snippet=该段落 + `anchor:"F-xx"` 字段 |
| 8.4 | `[both]` 命中落在 L0 摘要/正文（非锚点段）| 保持行级 snippet，无 anchor |
| 8.5 | `[both]` `scope=scene:xxx` | 只搜该 scene |
| 8.6 | `[both]` 搜不存在词 | 空结果 + followup 提示换词 |
| 8.7 | `[both]` `lrnev map` / `governance_map` | scene→spec(状态/优先级/L0)→锚点标题 全景；空 00-default 不出现；未填哨兵锚点不进图；只含标题级（无正文） |
| 8.8 | `[both]` 对比 CLI map 与 MCP governance_map | data.scenes 对等 |

## 阶段 9 — 轻产物（ADR / Errorbook / Memory）

| # | 操作 | 期望 |
|---|------|------|
| 9.1 | `[both]` `adr_create`（global + scene 范围）| 生成编号 ADR + 更新索引 |
| 9.2 | `[both]` `adr_list` / `adr_get` | 列出/读取；supersedes 反向派生 superseded_by（不回写旧文件）|
| 9.3 | `[both]` `adr_create --supersedes ADR-1`（非法）| 拒绝；合法编号归一化四位 |
| 9.4 | `[both]` `error_record`（同指纹两次）| 去重合并 |
| 9.5 | `[both]` `error_search`（用原文关键词）| 命中 incidents/promoted |
| 9.6 | `[both]` `error_promote`（无 verification）| 要求 verification |
| 9.7 | `[both]` `memory_save`（5 类各一）+ `memory_search` + `memory_forget` | 保存/检索/删除；同类去重 |
| 9.8 | `[both]` `session_commit`（summary + candidates）| 批量保存候选记忆 |
| 9.9 | `[both]` `assess_goal`（模糊大目标）| 建议 single/multi-spec/research |

## 阶段 10 — 摘要

| # | 操作 | 期望 |
|---|------|------|
| 10.1 | `[both]` `summarize_save`（spec URI，l0+l1）| 写 `.requirements.abstract.md` / `.overview.md` |
| 10.2 | `[both]` `summarize_save`（不存在的 URI）| 拒绝 FILE_NOT_FOUND，不建孤儿文件 |
| 10.3 | `[both]` 同目录多文档分别存摘要 | 按文档名键控，不互相覆盖 |

## 阶段 11 — 接手

| # | 操作 | 期望 |
|---|------|------|
| 11.1 | `[both]` `project_status` | 接手快照：scenes/specs/active_tasks/active_agents/recent_adrs/open_errors；只读 frontmatter，不读正文 |
| 11.2 | `[both]` `project_status{scene:x}` | 缩小到该 scene |
| 11.3 | 验证 free_tasks_count / claimable_next | 给出可领 pending task |

## 阶段 12 — 多 Agent

| # | 操作 | 期望 |
|---|------|------|
| 12.1 | `[MCP]` 两个并发连接 | 都判 active；agent_list 显示 |
| 12.2 | `[MCP]` 两 active 声明同一 touches_files | overlap 提示 |
| 12.3 | `[MCP]` 优雅断开 | 该 agent 自动注销、其 claim 自动释放 |
| 12.4 | `[both]` claim 一个属主已 dead 的 task | 可接手 |

## 阶段 13 — Hooks

| # | 操作 | 期望 |
|---|------|------|
| 13.1 | `[both]` `lrnev_hook_list` | 列出配置 + 最近执行状态 |
| 13.2 | `[both]` `lrnev_hook_trigger`（如 task.update.completed）| 触发并记录 |
| 13.3 | `[both]` `lrnev_hook_tail_log` | 读最近日志 |
| 13.4 | `[both]` enable/disable 某 hook | 生效 |

## 阶段 14 — doctor

| # | 操作 | 期望 |
|---|------|------|
| 14.1 | `[both]` `lrnev doctor` | 体检结构/spec/task/adr/claim/hook/context；列 issues |
| 14.2 | `[both]` 手造一个坏 validates 锚点，doctor | 列出 VALIDATES_ANCHOR_MISSING / LEGACY |
| 14.3 | `[both]` `doctor --migrate-todos` / `--migrate-summaries` | 迁移旧占位/旧摘要 |
| 14.4 | `[both]` `doctor --gc-agents` | 清已 dead 且无未过期 claim 的 agent |

## 阶段 15 — CLI/MCP 对等抽查

| # | 操作 | 期望 |
|---|------|------|
| 15.1 | MCP 建数据 → CLI 读 | 一致 |
| 15.2 | CLI 建数据 → MCP 读 | 一致 |
| 15.3 | 抽查 task_update/task_claim/context_search/governance_map 的返回 | CLI JSON 与 MCP 同构（含 anchor_context/summary_context/anchor 字段）|

## 阶段 16 — MCP 资源（context:// 协议，仅 MCP）

| # | 操作 | 期望 |
|---|------|------|
| 16.1 | `[MCP]` listResources | 列出 context:// 资源 |
| 16.2 | `[MCP]` readResource `context://project` | 返回 PROJECT 内容 |
| 16.3 | `[MCP]` readResource `context://spec/<scene>/<spec>`（默认 requirements）+ `?level=L0`/`?level=L1` | 有摘要返摘要，无则回退 L2 全文 |
| 16.4 | `[MCP]` readResource 不存在的 URI | 报错、不崩 |

## 阶段 17 — 真实项目走查（用 research/ 或 .tmp/ 下的真实代码库）

> 选一个真实项目（如 `research/P0_5_Aider`、`research/P0_6_OpenCode` 或 `.tmp/Understand-Anything`），`LRNEV_WORKSPACE` 钉过去。**完全模拟用户**：不是机械跑命令，而是"我要给这个项目加个功能/治理它"。

| # | 操作 | 期望 |
|---|------|------|
| 17.1 | init 真实项目 | codebase.json 正确探测该项目真实技术栈；followup 引导补 ARCHITECTURE |
| 17.2 | **按 followup 真的去读**构建文件 + 源码，填 PROJECT.md/ARCHITECTURE.md | 验证"AI 识别项目"设计走得通（不是死局）|
| 17.3 | 模拟真实需求：`assess_goal` 一个真实改动诉求 → 按建议 `spec_create` | 粒度建议合理 |
| 17.4 | 走完整 spec：填真实 requirements（真实 F-xx）→ ready gate（含**需求审核门**）→ design（D-xx）→ task_create → in_progress（看 **anchor_context** 是否真的把验收口径送到手）→ completed → completion gate | 全链路通，anchor_context 内容对真实需求有用 |
| 17.5 | `lrnev map` 看这个真实项目的治理全景 | 地图能力在真实数据上可读、有用 |
| 17.6 | `context_search` 搜真实关键词 | BM25 排序 + 锚点抽段在真实语料上表现 |
| 17.7 | **体感记录**：作为"用户"，哪些地方啰嗦/打断/帮倒忙/真有用？followup 是否在对的时机给了对的提示？ | 主观但重要——产品级反馈 |

---

## 结果汇总（执行者填写）

- 通道：CLI ___ / MCP ___（版本 v2.1.0，node ___）
- 总用例 ___，PASS ___，FAIL ___，偏差 ___
- 阻断级问题（会真机翻车）：
- 非阻断/体验问题：
- 文档与实际不符处：
- 对 v2.1 新功能（anchor_context/summary_context/governance_map/BM25/锚点抽段/审核门/四路分流/clampText 边界）的专门结论：

---

## 报告产出位置（每个 agent 各写一份，互不覆盖）

- codex-cli(GPT-5.5)：`dev-docs/E2E-REPORT-CODEX-2026-06-16.md`
- opencode(DeepSeek)：`dev-docs/E2E-REPORT-OPENCODE-2026-06-16.md`

每份报告须含：客户端/模型/时间；逐阶段 ✅/⚠️/❌ 表；FAIL 的复现命令与实际输出；真实项目（阶段 17）的体感结论；以及"是否建议发布 v2.1.0"的一句话判断。

## 测试结果 + 讨论记录（Claude ↔ 用户，跑完后回填）

> 两个 agent 跑完后，由 Claude 汇总两份报告、与用户逐条讨论，决定每个发现「修 / 不修 / 记录待真机再看」，记录在此——这是发布决策的依据。

| 发现 | 来源(codex/opencode) | 级别 | Claude 判断 | 用户裁决 | 处置 |
|------|------|------|------|------|------|
| (待填) | | | | | |

