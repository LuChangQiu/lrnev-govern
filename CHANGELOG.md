# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 [SemVer 2.0](https://semver.org/lang/zh-CN/)。

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

[1.3.1]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.3.1
[1.3.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.3.0
[1.2.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.2.0
[1.1.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.1.0
[1.0.1]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.0.1
[1.0.0]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v1.0.0
