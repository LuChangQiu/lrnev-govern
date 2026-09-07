# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 [SemVer 2.0](https://semver.org/lang/zh-CN/)。

## [3.0.0] - 2026-09-07

lrnev 治理契约的端到端标准化（governance scene `04-ai-guidance-standardization` 承载，T-027 真实客户端双 SHA 三客户端对照驱动）：MCP 响应从"JSON 文本 + 无 schema"重构为 **structuredContent canonical 信封 + outputSchema 声明 + 逐工具渲染文本**；引导从散落文案收敛为**五角色语义体系**；新增 `decision_context` 客户端声明通道与 `--profile` 工具面分层。**破坏性变更：text 通道内容格式**（详见升级指南）；其余向后兼容（42 工具默认全量、数据文件格式不变）。

### Added

- **MCP 响应双通道（03-00 M1/M2）**：每次工具调用同时返回 `structuredContent`（canonical 信封 `response_version:'1'` / `ok` / `data` / `errors` / `ai_followup` / `anchor_context` / `summary_context`）与 `content[0].text`（逐工具 ModelVisibleContract 渲染文本：42 个工具渲染器 + 错误路径渲染器，共 43 项）；全工具在 `tools/list` 声明 `outputSchema`（此前无结构化机器通道）。
- **Guidance Profile v1 语义体系（05-00）**：五角色引导前缀（【事实】【建议】【决策边界】【执行约束】【下一步】）+ `classifyInstructions`/`buildGuidanceView`/`diagnoseGuidance` 纯函数库；spec_get 分层引导（未完成 Spec 给"开发请求先 task_create 登记"边界）、归档边界语义（archived 终态、用户改主意不构成自动归档依据——B4 真机验证归档率 4/5→0/5）、工具描述档位标记（[核心]/[自动]/[配置]）。
- **`decision_context` 可选入参（05-00 T-002/T-003）**：`scene_create`/`spec_create`/`task_create`/`assess_goal` 接受 client_asserted 决策上下文（strength/summary/direction/target_ref）；只影响本次调用、不落盘、不阻断；条件规则（缺失≠unspecified、explicit 强制 direction 等）由真实链路负向校验验证（缺 direction 被拒后模型自纠）。
- **工具面分层 `--profile core|full`（L7）**：MCP 服务启动参数；`core`（33）= full − 9 个"AI 不该主动选"（agent_* 自动面 + hook_* 配置面），弱模型客户端受益；默认 `full` 向后兼容。
- **开发入口 `src/mcp/dev-entry.ts`**：修复 `dev:mcp`/`dev:inspect`（原 server.ts 无自启，脚本实际无法启动）。

### Changed

- **text 通道破坏性变更**：`content[0].text` 由 `JSON.stringify(payload)` 改为逐工具渲染的模型可见文本；机器数据契约 = `structuredContent`。曾用 `JSON.parse(content[0].text)` 取数据的接入方必须迁移到 `structuredContent`（信封字段与旧 payload 同构）。
- **业务拒绝统一 `isError=true`**：`ok:false` 的业务拒绝（参数错误、状态机冲突、歧义引用 AMBIGUOUS_REF、内部错误）一律置 isError（2.x 的 AMBIGUOUS_REF 不带 isError，易被客户端当成功）；`INTERNAL_ERROR` 不再回传异常原文（只给 code/message）。
- **引导措辞收敛（真机驱动）**：开发/扩展功能请求 → 先 `task_create` 登记再实施（直接编辑 requirements/design 只限需求细化/文档维护，不能替代登记——E-02 四 SHA 0/5 直写观测驱动）；用户决定优先条款显式化；状态机提示与合法回退（failed/blocked→pending）表述修正。
- **错误路径统一转义出口**（D-04.1 防注入契约）：错误 message/hint 含用户可控文本时经统一转义（此前错误路径绕过转义出口）。

### Fixed

- **严格客户端 -32602 输出契约缺陷**（T-027 发现 #3）：frontmatter 全展开泄漏裁剪（Scene/Spec/Memory 白名单化，spec_update 写路径 round-trip 不丢用户键）+ outputSchema/DataSchema 对齐（task_create_many 数组错配、ADR 嵌套 body、6 处 SimpleConfirmation 误用）——opencode 33 错 → 0。
- 渲染器输出 undefined（`data.scene`/`data.task_id` → `data.id`）。
- `dev:mcp`/`dev:inspect` 脚本实际无法启动 MCP 服务。
- CLI 两处 JSON.parse 裸抛误归 INTERNAL_ERROR（改 INVALID_INPUT）。
- tests 类型门禁缺失（`typecheck:test`，101 个游离类型错误修复）。

### Tests

- 全量 **1055 条全绿**（v2.3.0 为 692；3.0.0 前夜 09-04 达 1051，其后文档守护与转义回归增至 1055）。新增覆盖：输出契约严格镜像（data-output-contract）、错误路径转义、--profile 42/33 集合差、归档边界语义（G5）、decision_context 负向校验、E-06 v2 判定（真实续接双轮）。

### 升级指南

- **接入方必读（破坏性）**：`content[0].text` 不再是 JSON——机器数据改读 `structuredContent`（`response_version:'1'` 信封，字段同旧 payload：ok/data/errors/ai_followup/anchor_context/summary_context）；`ok:false` 一律 `isError=true`（此前需特判 AMBIGUOUS_REF）。
- 工具集 42 = 42 无删改；`--profile` 默认 full 零配置变化；`.lrnev` 数据文件格式不变。
- `lrnev-mcp --profile core` 可选裁剪（弱模型/工具面板拥挤客户端）。

## [2.3.0] - 2026-07-06

工作区运行态卫生 + 批量拆任务两件实事，均源于真实项目观察：xpaas 项目 3 周积累 64 条死 agent 记录（文件里全标 active）与 14 个过期 claim（显式 `doctor --gc-agents` 存在但没人会主动跑——与维护态缺口同构的"有门但找不到门"发现性问题）；GPT-5.5 真机反馈"连续 10 次 task_create 逐条建任务成本高"。用 lrnev 自身治理实现（新 scene `03-workspace-hygiene` 的 `01-00-auto-gc` + `00-default` 的 `01-00-task-create-many`），两份 spec 均经独立 AI 只读复核（5 处错误 + 3 处风险逐条修正后实现）。**无破坏性改动**：响应契约只新增可选字段，registry/claim 文件格式不变。

### Added

- **机会式 GC（register 时自动清扫）**：每次 `agent_register`（含 MCP 连接自动注册）在注册锁内顺手清理运行态残留，无需记得任何维护命令。判据与死亡确定性对齐：本机 pid 判死（确定性死亡，重连拿新 id 不会复活）立即清；跨主机心跳判死（推断性）超过 `agent.gc_retention_days`（默认 7 天）才清；两类均要求名下无未过期 claim（dead 但持有效 claim 的保留为接手线索）。过期 claim 文件按属主状态独立清扫，删除前按 claim 锁重读判据（消 TOCTOU）。清扫 best-effort：任何异常不影响注册主流程。
- **status 真值回写**：GC 扫描顺手把幸存条目的落盘 `status` 回写为计算真值——消除"registry.json 里全是 active"对人的误导。不增删字段（保旧版 `normalizeAgentInfo` 多版本混跑兼容）；文件语义明确为"最近一次写路径触达时的快照"，实时状态仍以读时计算为准。
- **GC 配置**：`agent.auto_gc`（默认 true，false 完全关闭）与 `agent.gc_retention_days`（默认 7；非正数/NaN 在实现处防御回退默认，不抛错）。`doctor --gc-agents` 原样保留（显式入口、判死即清），只读路径依旧零写副作用（v2.0 S5/I-12 决定不动摇）。
- **GC 透明返回**：实际清理了内容时 register 返回 `data.gc: { removed_agents, removed_claims }`（没清则无该字段）；不进 followup instructions（不占 AI 注意力）。新建 `AgentRegisterResult` 返回类型，gc 不落盘。CLI `agent register --json` 同构透传。
- **批量建任务 `task_create_many` / CLI `task create-many --from-file`**：spec ready 后一次性拆任务清单，N 次往返降为 1 次。两阶段原子执行：全量校验（key 规则、title、parent/depends_on、validates 锚点）通过才单次写入 tasks.md，任一条失败整批不写并**一次性返回全部错误明细**（`errors: [{index, field, message, code}]`，LrnevError 加法扩展）。批内依赖用元素级 `key` 临时键（禁 `T-\d+` 格式防歧义；解析优先批内 key、兼容已存在真 ID；不限引用方向）；`parent` 只接受已存在真 ID。ID 按数组顺序 max+1 连续分配，落盘产物与逐条创建等价；hook `task.create` 逐任务触发；返回压缩为 `created: [{id, title}]` + 单次 followup。校验判据与单条 `task_create` 共用同一份代码（`validateAnchorsAgainstPools` 收集式重构，单条外部行为不变）。CLI `--from-file` 接受 JSON 数组或 `{"tasks":[...]}` 包装、`-` 读 stdin。单批上限 `task.max_batch_create`（config，默认 50）。
- **单条 task_create 完全不动**：有意不做入参扩展——单条 XOR 数组的互斥 schema 是弱模型误用陷阱；也不做 dry_run（原子失败即校验）与 partial 模式（半批状态难恢复，违背"坏引用不落盘"口径）。取舍记录于两条 scene 级 ADR。

### Changed

- **发布前审计整改（三客户端盲测 + 全文档对照源码审核，2026-07-06）**：用 codex(gpt-5.5)、opencode(deepseek-v4-pro)、claude-sonnet-4-6 在干净真实项目上只靠 lrnev 自带引导盲测全流程（报告见 `dev-docs/E2E-REPORT-*-V23-2026-07-06.md`；v2.3 新特性全部真机验证通过，三家均自主发现并选用 `task_create_many`），收敛整改：
  - **`was_new` 判定改为 PROJECT.md 存在性**（README 既定的"已初始化"标记）——修复 MCP 连接自动注册预建 `.lrnev/agents/` 导致经 MCP 调 init 永远返回 `was_new:false` 的失真（三家模型均困惑）。
  - **guide 与 server instructions 同步 v2.1~v2.3**：`lrnev_guide` 与连接注入的工作流概览此前停在 v2.0 之前，补齐 `task_create_many` / `governance_map` / `lrnev_report` / `spec_update` / `assess_goal`（instructions 预算护栏 480→600，内容准确性优先于凑字数）。
  - **引导前置化**：spec_create followup 加"章节标题勿翻译/改名（模板契约）"警示（codex 实撞后才知）；ready gate 通过 followup 加无条件"先把 design.md 的 FILL 填完（completion 会硬拦）"（两家都到 completion 才发现）；assess_goal 判 multi-spec 时给出"用户已明确单特性可按 single-spec 继续"的 override 指引；`agent_register` 描述补 gc 字段语义；`task_create` 描述提示多条请用批量工具。
  - **report headline 改"治理债"口径**：不再是裸"整体健康"，明示只看治理债、执行进度看 project_status——防接手 AI 把结构健康误读为"全部完成"。
  - **claimable_next 透明化（加法契约）**：条目附带非空 `depends_on`（依赖未完成仍可领，软提醒哲学不变）；超出预览上限（`project_status.claimable_preview`，默认 5）时 followup 给出截断说明。
- **文档修复与补全**：新增 `docs/CONFIG.md` + `docs/examples/lrnev.json`（`.lrnev/config/lrnev.json` 全部配置键首次成文）；AI-ADAPTATION 增 `LRNEV_WORKSPACE` 定位说明（修正"MCP 调工具用 --workspace"误导）、42 工具分组总览、实测矩阵回填 v2.3 盲测三行；ARCHITECTURE 目录树对齐实际源码；HOOKS 事件表补 `task.update.pending`；GOVERNANCE-FLOW 重框定为通用语义文档并补"空 00-default 不出现在 project_status / claimable 预览"口径说明；CHANGELOG 补 2.0~2.3 链接定义；sample-project 修步骤注释并补批量创建示例。dev-docs 十份已消化历史快照移入 `archive/`，NEXT-STEPS / PRODUCT-STRATEGY / INTEGRATION-TEST 三份活文档刷新到 v2.3 实况。
- **文档同步**：MULTI-AGENT 补"机会式清理"一节与 status 落盘语义；README 目录树注释、批量建任务示例；GOVERNANCE-FLOW 补多 Agent 存活的 GC 行为与批量创建段落。

### Tests

- 全量 **692 条全绿**（v2.2 为 654）。新增覆盖：GC 双轨判据/保留期/持 claim 保留/status 回写/auto_gc 开关/非法保留期防御/损坏 claim 容错/gc 不落盘/CLI 对等；createMany 连续编号/逐条等价（含 parent 路径）/key 解析全边界/多错误一次返回/原子零变更/上限 config/维护态提示单次/hook N 次触发/CLI from-file 与坏 JSON；审计整改新增 was_new 判据两分支、claimable depends_on 与截断说明、guide 工具覆盖断言、标题契约警示与填 design 提示断言、headline 新口径。

### 升级指南

- 无需迁移。升级后首次 register 会自动清理历史积累的死 agent 记录与过期 claim——这是新规的本意；若想保留残留现场，先设 `.lrnev/config/lrnev.json` 的 `agent.auto_gc=false` 再升级。
- 消费 `agent_register` 返回的脚本可选用新增的 `data.gc` 字段（不用则行为不变）。

## [2.2.0] - 2026-06-18

把 lrnev 自身的治理进度从"AI 自己读状态"升级为一张给人看的零模型体检单：新增 `lrnev report` / MCP `lrnev_report`，用于发现做完没收口、失败/阻塞任务、validates 覆盖缺口和坏引用。用 lrnev 自身治理实现（scene `02-context-delivery`，spec `03-00-governance-report`），经两轮 GPT 复审收敛。**无破坏性改动**：新增命令与工具均为只读快照，有治理欠债也 exit 0。

### Added

- **治理体检 `lrnev report` / `lrnev_report`**：CLI 与 MCP 共用 `GovernanceReport` core，零模型遍历 `.lrnev`，输出链路完整度与 validates 覆盖率。
- **链路完整度**：统计 scene/spec/task，列出"做完没收口" spec（所有 task completed 但 spec status 未 completed）、failed/blocked 任务明细。
- **validates 覆盖率**：计算真锚点覆盖率；孤儿锚点按"在途"与"已收口真欠债"分类；坏 validates 单独列出、不计入 covered，并指向 `doctor`。
- **欠债下一步与定位**：`unclosed` / `failed` / `blocked` / `debt_orphans` / `broken_validates` 都带确定性 `next_action` 与 `context://spec/<scene>/<spec>` 定位；text、Markdown、JSON 输出均消费。
- **多输出形态**：默认 text 人读体检单，支持 `--md`、`--json`、`--out <path>`（不给不写文件）、`--scene` 过滤、`--release-notes` 附已完成清单草稿。
- **单坏 spec 容错**：单个 spec 读取/解析失败时跳过并写入 warnings，不让整份 report 崩溃。

### Changed

- **report 与 doctor 边界文档化**：`doctor` 管工作区结构健康、坏引用详细修复和 stale；`report` 管治理进度呈现和下一步。`report` 是给人看的快照，不做 CI gate，不提供 `--fail-on`。
- **"做完没收口"口径锁定**：只镜像 completion gate 的 `all_tasks_completed`（全平铺、含子任务），不复刻 FILL/design 子检查；测试直接对照 `GateRunner` 锁定一致性。
- **文档同步**：README、架构说明、治理流程、AI 适配指南同步 `report` 命令、MCP 工具与 report/doctor 分工。
- **治理收口**：收口 `02-context-delivery` 下已实现但 status 滞留的 `01-00-maintenance-flow-and-review-gate` 与 `02-00-locator-upgrade`。

### Tests

- 全量 **654 条全绿**（v2.1 为 626）。新增覆盖：治理体检核心计算、CLI text/Markdown/JSON/`--out`/`--scene` 输出、CLI↔MCP 对等、gate 口径对齐、坏 validates 不虚增覆盖率、archived 排除、空 `00-default` 显式 scene、单坏 spec 容错与 headline 口径。

## [2.1.0] - 2026-06-16

把治理数据「在正确时刻送进 AI 上下文」：v2.0 解决了写入时的确定性硬校验（挡坏引用），本版补上**使用时的送达**与**定位升级**。用 lrnev 自身治理实现（scene `02-context-delivery`，两个 spec：`01-00 维护态流程+需求审核门+任务启动上下文`、`02-00 定位升级`），每个 spec 经 codex(GPT-5.5) 两轮只读复核，意见逐条落地。**无破坏性改动**：响应契约只新增可选字段，新增能力均为加法。

### Added

- **任务启动上下文回填 `anchor_context`**（01-00 F-03）：`task_update(in_progress)` 与 `task_claim` 两入口，若 task 带 `validates`（`F-xx`/`D-xx`），从 requirements/design 抽出对应 `#### F-xx`/`#### D-xx` 段落，作为**响应顶层结构化字段** `anchor_context` 随返回送达 AI（不再只是"提示去读"）。截断策略：单段 ≤400 字、总量 ≤1200 字、`D-xx` 默认只回首行+标题；超长按句末/换行边界截断、标 `truncated`。`task_claim` 同样回填——**堵 claim 旁路**（claim 进任务不走 update）。锚点在 create 后被删时给**漂移软告警**（点名、不报错、不阻断），claim 入口补齐了此前缺失的坏锚点检测。
- **任务启动降级档 `summary_context`**（01-00 F-03）：task 无 `validates`（无锚点段落可回填）时，回填 spec 级 L0/L1 摘要做快速定向。**统一摘要读取契约**：sidecar（`.requirements.abstract.md`/`.overview.md`）优先、requirements 内联 `## L0 摘要`/`## L1 概览` 兜底；两者皆无才退回纯文字"回看本 Spec 目标与验收"。L0≤200/L1≤600 截断，防 L1 撑爆启动上下文。
- **需求审核门**（01-00 F-02）：`spec_gate_check(gate=ready)` 通过时，`ai_followup` 追加"请暂停，把 requirements.md 展示给用户确认后再继续"——用户审核"做什么"方向的人工门（只引导不强制，用户说"直接做"可跳过）。落位到已有 spec 加 task 不触发；`completion`/`creation` 不受影响。
- **治理地图 `governance_map` / `lrnev map`**（02-00 F-01）：新增只读能力，输出 scene→spec(状态/优先级/L0)→`#### F-xx`/`#### D-xx` 锚点标题 的压缩全景（读文件但**只含标题级、不放正文**），AI 看图用 URI 直接定位，把"反复搜索+读全文"变成 O(1) 跳转。空 `00-default` 不出现；未填的模板哨兵锚点不进图。MCP 工具与 CLI 命令输出对等。
- **`context_search` 锚点级抽段返回**（02-00 F-02）：命中落在某 `#### F-xx`/`#### D-xx` 段内时，`snippet` 升级为该锚点段落、并附 `anchor` 字段；多段命中取词频最高段；命中段外保持行级 snippet。
- **共享锚点工具 `extractAnchorSections`**：返回锚点 ID→段落映射，供任务回填、治理地图、检索抽段复用（与 v2.0 的 `extractAnchorPool` 同族）。

### Changed

- **`context_search` 排序从裸命中计数换为 BM25**（02-00 F-03）：词频饱和 + 文档长度归一化，短而精准的文档不再被长文档高频词压过。**召回谓词独立于排序分**（裸命中判召回、BM25 只排序），负 IDF 不会缩小召回集；`tokenize` 子串口径不变，中文照常；零模型、零新依赖。
- **分流指引从二元/三元扩为四路**（01-00 F-01/F-04）：`spec_create`/`task_create` 的 followup、`guidance` 工作流摘要、`docs/AI-ADAPTATION.md` 常驻模板统一为——有业务域→对应 scene 开 spec、无业务域→`00-default` 开 spec、给已完成特性加小增量→落位已有 spec 加 task、写不出独立验收→直接做不开 spec；`scene_create` 门槛提到"用户明确确认/上下文非常清楚会承载多 spec"，scene/00-default 拿不准就问用户（防 00-default 滥用与 scene 滥建）。在 completed spec 上 `task_create` 时提示状态回退语义。
- **文本截断按边界切**：`clampText` 截断时优先切在上限内最后一个换行/中英文句末标点，边界过早才硬截——避免预览切在半句中间（纯算术、不调模型）。

### 契约变更（向后兼容）

- `AiFollowupResponse` 顶层新增可选字段 `anchor_context` / `summary_context`；`SearchResult` 新增可选 `anchor`。均为加法，旧消费方忽略即可，CLI JSON 与 MCP 返回对等。
- lrnev 仍**零模型**：摘要由客户端经 `summarize_save` 写入，lrnev 只读只递、不调用任何 LLM/Embedding。

### Tests

- 全量 **626 条全绿**（v2.0 为 593）。新增覆盖：`extractAnchorSections` 边界、`anchor_context` 两入口回填/截断/D-xx 首行/漂移告警、`summary_context` sidecar-优先/内联兜底/截断、需求审核门 followup、四路分流文案、BM25 短精准胜长高频且召回不缩、`context_search` 锚点抽段、治理地图、`clampText` 边界截断，以及 `anchor_context`/`summary_context`/`governance_map`/`context_search` 的 CLI↔MCP 对等集成用例。

### 发布前修复（codex + opencode 双模型真机 E2E + Claude 独立复核）

- **gate followup CLI/MCP 对等**：`gate followup` 下沉 `core/GateGuidance`，CLI `gate check` 也显示（含 ready 的需求审核门）——此前只在 MCP 通道。CLI `gate check` 返回改为统一 `ok/data/ai_followup` 包装（与其它 CLI 命令一致）。
- **未知 gate 名**：`gate check --gate <非法>` 现返结构化 `INVALID_INPUT`（此前返 `undefined`）。
- **init 开箱**：`lrnev init` 现 scaffold 空 `.lrnev/config/hooks.json`（`[]`），hooks 开箱即用。
- **CLI error record 对等**：新增 `--tags`（与 MCP `error_record` 对齐）。

### 升级指南

- 无需迁移、无破坏性。接入方若消费 `task_update`/`task_claim`/`context_search` 返回，可选用新增的 `anchor_context`/`summary_context`/`anchor` 字段（不用则行为不变）。
- 想用治理地图：MCP 调 `governance_map`，或 CLI `lrnev map`。
- **注意**：CLI `gate check` 的 JSON 输出从裸 `GateResult` 改为 `{ok, data, ai_followup}` 包装（与其它命令一致）；若你脚本解析过 `gate check --json`，请改读 `.data`。

## [2.0.0] - 2026-06-12

把治理保障从「依赖模型听话」迁移到「协议层强制」：确定性事实（FILL 残留、引用目标存在性）硬校验，需判断的语义仍交 AI。源于一轮全面真机测试发现的 17+1 项清单（`dev-docs/FINDINGS-CHECKLIST.md`，Claude/GPT 双向复评 + 用户逐条裁决），按 7 个 spec 用 lrnev 自身治理实现（scene `01-findings-remediation`），每个 spec 经 codex(GPT-5.5) 只读复核。

### ⚠️ Breaking Changes

- **completion gate 硬拦 requirements/design 的 FILL 哨兵**（S2/I-4）：所有 task completed 但 `requirements.md` 或 `design.md` 仍残留 `<!-- FILL: ... -->` 时，completion **不再通过**（新增 `requirements_no_fill` / `design_no_fill` hard check）；`design.md` 缺失同样判失败（`design_exists`，防"删 design 绕过"，codex 复核发现）。`tasks.md` 自带的模板 FILL 不检查。判据：FILL 是"表单必填项未填"的确定性事实，不是语义判断——不判断写得好不好、是否真实现，那些仍交 AI。
- **validates 锚点体系规范化、去自由字符串化**（S6/I-18+I-5）：`task_create` 的 validates **只接受 `F-xx`（requirements 的 `#### F-xx`）与 `D-xx`（design 的 `#### D-xx`，新规范、与 F-xx 对称）**，并做存在性硬校验——引用不存在的锚点报 `ANCHOR_NOT_FOUND`（新错误码）、不落盘；旧式 `design#3.2` 自由写法废弃，报错引导改用 `D-xx`；其它自由字符串一律拒绝。存量数据不自动迁移（无确定映射）：`task_update` 推进含坏锚点的存量 task 时 followup 软提醒点名，doctor 新增 `VALIDATES_LEGACY_ANCHOR` / `VALIDATES_ANCHOR_MISSING` 列全量供手改。
- **summarize_save 拒绝孤儿目标**（S2/I-6）：目标 scene/spec/文档不存在时报 `FILE_NOT_FOUND`，**不再凭空创建目录与摘要文件**。
- **task_create 校验 depends_on 存在性**（S2/I-7）：依赖列表含不存在的 Task ID 时报 `TASK_NOT_FOUND`、不落盘（与 parent 校验同口径）。"依赖未完成"仍只是软提醒、不阻断。
- **adr_create 的 supersedes 规范化**（S5 复核修复）：非正整数（如 `ADR-1`、空格、`0`）直接拒绝；合法编号统一归一化为四位（`1` → `0001`）。

### Added

- **设计锚点 `D-xx` 规范**（S6）：design 模板新增 `#### D-01` 锚点示范；GOVERNANCE-FLOW 补锚点体系说明。task 可用 `--validates F-01 D-02` 同时追溯需求与设计；lrnev 只判"编号在不在"，不判设计好坏。
- **显式 dead-agent GC**（S5/I-12）：`lrnev doctor --gc-agents` / MCP `lrnev_doctor{gc_agents}`——仅清"已判 dead 且名下无未过期 claim"的 agent；dead 但持未过期 claim 的保留（接手线索）、active 不动；报告含 `released_expired_claims`。`agent_list` 等只读路径保持零写副作用，`diagnose` 不顺手清。
- **ADR `superseded_by` 读时计算**（S5/I-17）：`adr_list` / `adr_get` 基于全量 supersedes 反向派生"本条被哪些更新 ADR 取代"，**不回写旧 ADR 文件**（保历史可追溯）。
- **CLI 补齐与 MCP 的能力对等**（S1/I-1~I-3）：`spec get` 现与 MCP 一致返回"已实现 Spec 考虑开新版"引导（逻辑下沉 `core/SpecGuidance`，两路共用根治漂移）；`task create` 新增 `--depends-on`（此前传了被静默吞）；`adr create` 新增 `--supersedes`。
- **任务状态软提醒**（S3/I-7+I-8）：task 转 in_progress 时若 depends_on 前置未完成，followup 点名提醒（不阻断，允许知情抢跑）；父任务标 completed 但仍有未完成子任务时提醒（completion gate 本就会拦，提醒防 task_list 快照误读）。

### Changed

- **in_progress 的"拆子任务并行"提示改为弱信号触发**（S4/I-10）：仅当 acceptance≥3 / 描述较长 / 已有子任务 / 多锚点之一命中才提示；子任务一律不提。消除"改个文案"级小任务也被劝拆的噪音。
- **assess_goal 的 kind 与 reasons 一致**（S4/I-11）：枚举 ≥3 个并列项等强多特性信号直接判 `multi-spec-program`，不再被固定 score 阈值压回 single-spec，与 scene_create intent 路径口径统一。
- **error_search 明确零模型边界**（S7/I-14）：工具描述与无结果时的 followup 均提示"用记录原文的关键词/错误码/文件名搜，不要近义改述"。
- **治理边界文档化**（S7/I-9、I-13）：GOVERNANCE-FLOW 显式写明"序号会复用、引用必须用完整 ID"与"ready gate 中文标题是模板契约（国际化走 alias 表，不悄悄放宽）"。
- guide(concepts) 的 gate 边界描述同步新行为。

### Fixed

- MCP `spec_get` 的"开新版"引导此前 CLI 拿不到（CLI/MCP 行为不一致），现共用 core。

### Tests

- 新增/调整 40+ 条测试（FILL 硬拦、孤儿摘要、坏依赖、锚点格式与存在性、存量坏锚点软提醒、supersedes 归一化、gc 边界、软提醒、弱信号、kind 抬升），全量 **593 条全绿**。
- 新增 `tests/e2e/mcp-stdio-lifecycle.test.ts`：套件中唯一覆盖真 stdio 进程生命周期（连接自动注册、并发 active、touches 重叠、优雅断开自动注销+释放 claim）的 e2e。

### 迁移指南

- 若有 spec 的 completion 突然不过：检查 requirements/design 是否仍有 `<!-- FILL: ... -->`（或 design.md 缺失），填完即过——这是新规的本意。
- 若 task_create 因 validates 被拒：把锚点改为 requirements/design 中真实存在的 `F-xx` / `D-xx`；旧 `design#...` 写法请在 design.md 定义 `#### D-xx` 后改用编号。
- 存量 `.lrnev` 数据无需迁移：运行 `lrnev doctor` 可列出需手改的坏锚点。

## [1.3.1] - 2026-06-08

### Changed

- **常驻提示词区分"只读 / 要改"**：`README.md` 与 `docs/AI-ADAPTATION.md` 的常驻提示词模板更新——纯查代码、定位、解释、回答问题等不改任何文件的事直接做（不必先 `project_status`、不必开 spec）；`project_status` / spec / task 流程只在"要动手改代码或推进治理"时才走。修正 AI 对只读问题也先调 `project_status` 的过度行为，同时明确"真改动仍需走 task/spec"，避免反向跳过治理。

## [1.3.0] - 2026-06-08

### Fixed

- **摘要旁车文件改为按文档键控**：`summarize_save` 不再把同目录下多个文档写到同一份 `.abstract.md` / `.overview.md`，改为 `.<文档名>.abstract.md` / `.<文档名>.overview.md`，修复 `PROJECT.md` 与 `ARCHITECTURE.md`、Scene 三文档摘要互相覆盖的问题。
- **资源读取与检索复用新摘要命名**：`context://...?level=L0/L1` 和 `context_search` 均按新命名读取/映射摘要；无摘要时仍回退 L2 全文。

### Added

- **Doctor 新增 `LEGACY_SUMMARY` 与清理命令**：发现旧式目录级 `.abstract.md` / `.overview.md` 时报告 warning；`lrnev doctor --migrate-summaries` / `lrnev_doctor migrate_summaries` 可一次性删除遗留旧文件，不做运行时兼容读取。
- **Doctor 新增 `ONBOARDING_INCOMPLETE`**：`init` 后 PROJECT/ARCHITECTURE 仍含 `FILL` 哨兵时报 warning（仅提示、不阻塞、不强制），避免空骨架被当成接入完成。

### Changed

- **init 不再把自动探测当事实写入**：PROJECT/ARCHITECTURE 模板必填字段改用 `FILL` 哨兵；技术栈/主要模块即使探测成功也只写"疑似候选（待核实，可能不准）"提示，完整原始探测仍只落 `auto/codebase.json`；`lrnev_init` 引导文案通用化为"读构建文件与核心源码自行判断技术栈"，不假设语言（遵 ADR-0001 与"引导不强制"原则）。

## [1.2.0] - 2026-06-08

把多 Agent 的"存活判定"从不可靠的心跳模型改为 stdio 进程/连接生命周期。

### Changed

- **Agent 存活信号改为进程生命周期**：同主机以 `process.kill(pid,0)` 探活为准，进程活着即 `active`，不再依赖客户端定时 `agent_heartbeat`；跨主机回退到 `last_heartbeat` 年龄阈值。修正了"活着的会话因没发心跳被判 dead、claim 被误回收"的问题（根因：MCP 无定时器、LLM 客户端不会周期性主动调工具）。
- **会话注册/注销自动化**：MCP 连接初始化时自动注册当前会话 agent，连接断开时自动注销并释放其 claim；`agent_register`/`agent_heartbeat`/`agent_unregister` 仍保留，供脚本化与跨主机协作显式使用。
- **claim 回收跟随属主进程**：claim 在 TTL 过期或属主 agent 已 dead 时即可被接手，不必干等 TTL。
- **心跳降级为兜底**：`agent_heartbeat` 与 `last_heartbeat` 保留，定位收敛为跨主机续活与人类可读的"上次活动时间"。

### Added

- **Doctor 新增 `STALE_AGENT` / `ORPHAN_CLAIM`**：分别诊断"同主机 pid 已不在世却仍在注册表的 agent"和"属主已退出/不在注册表的未过期 claim"，给出清理建议。

## [1.1.0] - 2026-06-05

围绕"Spec 生命周期收尾"与"防止小事乱开 Spec"做的一组治理增强。

### Added

- **新增 `spec_update` 工具**（MCP + CLI）：按状态机更新 Spec 状态（draft→ready→in-progress→completed→archived），非法转换会被拒绝并给出可走的目标。此前只能手编 frontmatter，AI 无法正规地回填或归档 Spec 状态。

### Changed

- **`project_status` 尊重 `archived` 状态**：已归档的 Spec 仍出现在列表（保留历史），但它的待办任务不再计入 `claimable_next` / `free_tasks_count` / 活跃任务，避免被取代的旧版污染接手快照。
- **开重写版时引导归档旧版**：`spec_create --version` 检测到同名旧版时，followup 提示可用 `spec_update` 把旧版标 `archived`（不自动归档，判断权在 AI/用户）。
- **`spec_get` 对已实现的 Spec 提示考虑开新版**：仅当 Spec 有已完成任务或已 completed 时出声，其余情况零噪音。
- **强化"该不该开 Spec"的引导**：工具描述、工作流说明和提示词模板统一改为"先自问能否写出 WHEN…THEN 验收且可独立交付——是才开 Spec；改文档/小重构/调参数/答问题等小改动直接做、不要开 Spec"。修正了 AI 倾向把小修小补都开成独立 Spec 的问题。
- **README 面向新用户重写介绍**：补充"为什么用它/不用会怎样""只引导不强制的宗旨""token 成本说明""什么是 Spec"等，降低上手门槛。

## [1.0.1] - 2026-06-04

### Changed

- MCP 服务启动时检测工作区向上误命中：若 `lrnev-mcp` 在非项目目录启动且通过向上查找命中祖先 `.lrnev`，server instructions 中会显示明确警告并提供修正方式(`LRNEV_WORKSPACE` 环境变量)。

## [1.0.0] - 2026-06-04

首次公开发布。lrnev 是确定性的 AI 开发流程治理工具：文件即真相、零模型依赖，通过 MCP 服务 `lrnev-mcp` 与 CLI `lrnev` 双入口，让 Claude Code、Cursor、Codex 等客户端按 Scene → Spec → Task 流程治理开发。

### 本版本包含

- **双入口共享同一套 core**：MCP 服务 `lrnev-mcp` 与 CLI `lrnev` 共用 `.lrnev/` 文件系统工作区，能力一一对等。
- **治理对象**：Scene（业务场景）、Spec（可交付特性，三文档 requirements/design/tasks）、Task（执行单元），以及 ADR、Errorbook、Memory、Summary 等轻产物。
- **三档 Gate**：creation / ready / completion，只校验结构契约、必填哨兵与验收清单状态，不替 AI 判断质量。
- **接手快照 `project_status`**：有界返回（计数 + 活跃项 + `claimable_next` 可领取任务 + 按 scene 过滤），不随历史膨胀。
- **多窗口协作**：agent registry + 心跳，Task claim 运行态软占用（原子登记、心跳续租、过期可重领、`touches_files` 文件重叠提示），状态更新时自动 claim/release。
- **拆分粒度引导**：`scene_create` 给出 Spec 拆分标尺 + 启发式辅助信号；`task_create` 引导按需拆子任务——均只给提示，不替 AI 决定。
- **Hooks 系统**：在 Spec/Task/ADR/Errorbook/Gate 事件后执行本地命令，CLI/MCP 可查看、触发、启停与读日志。
- **存量项目接入**：`lrnev init` 最小探测已有代码、预填确定信息，不传项目名时默认用当前文件夹名。
- **写入类工具返回 `ai_followup`**，把可执行的下一步建议交还给 AI 客户端。
- **客户端常驻提示词模板**，帮助长对话压缩后仍按 lrnev 流程工作。

---

[3.0.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v3.0.0
[2.3.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v2.3.0
[2.2.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v2.2.0
[2.1.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v2.1.0
[2.0.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v2.0.0
[1.3.1]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.3.1
[1.3.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.3.0
[1.2.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.2.0
[1.1.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.1.0
[1.0.1]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.0.1
[1.0.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.0.0
