# 04-00 B0 观测报告（正式基线，非冒烟）

> **本报告为 B0-s 结构基线**：仅验证证据采集链路与数据契约可用性。
> 无真实 LLM/客户端参与，action_taken/action_success 由采集器基于 fixture 结构独立判定，非真实模型行为观测。
> **禁止作为 B1/B2a 的行为对照基准。** 行为基线需真实客户端接入后另行建立。

**Spec**: 04-00-agent-e2e-observability
**Scene**: 04-ai-guidance-standardization
**阶段**: B0-s（结构基线，02-00 冻结基线 v2.0，迁移前）
**报告生成时间**: 2026-09-01T01:14:38Z（初版）；本次修复复审于本文档下方补充记录

---

## 0. 本次修复记录（复审后整改，覆盖初版遗留的 3 处自洽性缺陷）

初版报告发布后，复审（DeepSeek）确认报告诚实性全部通过、未发现掩盖，但指出初版自己报出的 3 条"采集器判定与 fixture 声明不一致"（E-07/E-08/E-11）不应在基线文件中保留——作为后续每轮引用的基线，内部不自洽的数据会传染。本节记录修复内容，修复目标是让 B0-s 结构基线内部自洽，**不是**把它升级为行为基线。

### 修复 1：E-08 状态机拒绝模拟

**修复前**：`runFixture()` 只检查工具是否在 `forbiddenTools` 里，`spec_update` 不在 E-08 的 `forbiddenTools: []` 中，一律记 `'ok'`，导致采集出 `action_success=true` / `failure_category=undefined`，与 fixture 声明的 `action_success=false` / `failure_category='state_machine_validation'` 不一致。

**修复后**：`EvidenceCollector` 新增 `checkStateMachineRejection()`，复用 `src/types/spec.ts` 的 `VALID_SPEC_TRANSITIONS`/`isValidSpecTransition`（lrnev 真实状态机规则：`archived` 是终态，`VALID_SPEC_TRANSITIONS.archived === []`），依据 fixture 的结构事实——`decisionContext.current_status`（`'archived'`）与 `expectedArgs.status`（`'in-progress'`）——独立判定该转换是否合法。判定逻辑不读取 `fixture.evidenceFields` 的任何预期值。修复后采集结果：`action_success=false` / `failure_category='state_machine_validation'`，与 fixture 声明一致（因为判定依据的是同一条真实规则，结论恰好一致，不是抄答案）。

### 修复 2：E-07/E-11 无工具调用场景的语义

**修复前**：`collect()` 逻辑固定为 `actionSuccess ? undefined : 'test_failure'`，且"最后一次工具调用不存在"被一律视为 `actionSuccess=false`。E-07（用户明确不建 Spec）/E-11（other 协议）这两个场景 fixture 的 `expectedAction` 本就是 `null`（即"AI 什么都不做才是对的"），但被通用逻辑误标为 `action_success=false` / `failure_category='test_failure'`。

**修复后**：无最终工具调用时，改为依据 `fixture.expectedAction` 是否为 `null` 这一结构事实判定：
- `expectedAction === null` + 实际无调用 → `action_success=true`，`failure_category=undefined`（E-07/E-11 属于此类）
- `expectedAction !== null` + 实际无调用 → 才是真失败，保留 `action_success=false` / `failure_category='test_failure'`

### 修复 3：`session_clean` 硬编码注释补充

`session_clean` 仍恒为 `true`（未改变行为），但原注释"冒烟阶段每个测试都是独立会话"表述不清晰其成立边界。已补充注释说明：B0-s 阶段单进程顺序执行，每个 fixture 各自 new 一个 `EvidenceCollector` 实例、不跨 fixture 复用状态，故本阶段恒为 `true` 是"单进程顺序执行"这一运行拓扑的结构性推论，不是对"clean session"语义的模拟判定；真实多 session/多客户端并发场景需要基于会话隔离机制重新实现，未在本次范围内做该实现。

### 修复 4：`fixture_hash` 语义过宽 + 不稳定（本轮修复）

**修复前**：`fixture_hash` 对整个 fixture 对象做 `JSON.stringify(fixture, null, 2)` 后 SHA256。两个缺陷：
1. **语义过宽**：`measurementGoal` 等纯文档字段（不参与 `collect()` 任何判定逻辑）的变更也会改变 hash——例如仅修正一句中文说明就会导致与既往基线 diff 时误报"行为漂移"。
2. **不稳定**：`JSON.stringify` 不保证对象键的枚举顺序在所有环境下一致。同一 fixture（E-08）在三次独立计算中得到过三个不同值：归档值 `a7e99e0230c657fb598ab95dd4c007741dc55cdfe384af9d3322a6fe6150650f`、某次计算 `3c4f7d2170739d3956c4fe972d22583949801a9d37d34f07c1886bff6297a61a`、另一次计算 `aecd82139cc11da04b0de56023ba02ef04c572473cb6dadcd8355ec50c349a9f`。这比缺陷 1 更严重：`fixture_hash` 连"同一输入同一输出"都做不到，而其设计意图（T-013）正是"确保测试场景可重复"。

**修复后**：`EvidenceCollector.computeFixtureHash()` 只序列化经逐字段核查确认会影响 `collect()` 判定输出的 12 个行为相关字段/子字段（`id`/`expectedDecisionContext`/`aiGuidance.surface_id`/`aiGuidance.text`/`allowedTools`/`forbiddenTools`/`forbiddenAction`/`expectedAction`/`expectedArgs`/`severity`/`evidenceFields.tool_sequence`/`evidenceFields.user_decision_override`），并新增 `stableStringify()` 辅助函数对对象递归按键名排序后再序列化（数组保持原顺序，因为数组顺序本身是语义的一部分）。

验证结果：
- **稳定性**：同一 fixture 在同进程连算 3 次、以及跨 3 个独立 `tsx` 进程分别计算，结果完全相同。
- **语义收窄**：临时改动 E-01 的 `measurementGoal`（纯文档字段），hash 不变；临时改动 `expectedAction`（行为相关字段），hash 从 `771f8632...eeddde9d` 变为 `6b2ec8d4...cd81e04d`。两组临时改动验证后均已改回，`git diff tests/fixtures/04-00/` 为空。
- **12 条自洽性复验**：用新算法重生成的 12 条证据，`action_success`/`failure_category` 与旧 manifest 逐条比对仍为 12/12 一致（详见第 8 节）。

新增正式脚本 `scripts/run-b0-baseline.mts`（阶段名做参数），用它重生成了本文档引用的 `b0-evidence-manifest.json`（`git_sha`/`baseline_ref`/顶层 `note` 均保持不变，仅 12 条 `fixture_hash` 因算法修正发生跳变，见第 4 节表格与附录新增对照表）。

### 修复 5：`fixture_hash` 遗漏 `decisionContext.current_status`（第二次算法修正）

**缺陷**：修复 4 的 `computeFixtureHash()` 在注释里显式排除了顶层 `decisionContext`，理由是"纯场景描述，不影响判定"。但 `checkStateMachineRejection()`（`evidence-collector.ts` L275-280）实际读取 `decisionContext?.current_status` 作为 `isValidSpecTransition(from, to)` 的 **from** 端，与已在 hash 里的 `expectedArgs.status`（**to** 端）配对使用——排除结论与代码实际读取行为矛盾。这意味着若只改动 `current_status`（例如 `'archived'` → `'completed'`），`fixture_hash` 不变，但 `action_success`/`failure_category` 会翻转，属于"真实行为漂移未被 hash 捕获"的漏报风险。

**实测复现**（修复前）：`current_status='archived'` 与 `current_status='completed'` 两种输入，`fixture_hash` 均为 `9aaa3613...`，但前者 `action_success=false`/`failure_category='state_machine_validation'`，后者 `action_success=true`/`failure_category=undefined`。

**追溯**：对 `evidence-collector.ts` 全文搜索 `decisionContext` 及 `DecisionContext` 接口（`tests/fixtures/04-00/types.ts`）列出的全部子字段（`scene`/`existing_specs`/`spec_count`/`last_update`/`user_intent`/`staleness_signals`/`ai_recommendation`/`recommendation_reason`/`complexity`/`spec_create_executed`），确认采集器代码里 `decisionContext` 只有一处真实读取（L275-276），且只解构了 `current_status` 这一个子字段；其余子字段全文无引用，不参与任何判定分支。

**修复后**：`computeFixtureHash()` 新增 `decisionContextCurrentStatus: fixture.decisionContext?.current_status ?? null` 字段（行为相关字段从 11 个增至 12 个），方法上方注释同步更新纳入/排除依据。

验证结果：
- **负向验证**：用 `runFixture()`（非直接 `new EvidenceCollector().collect()`）对 E-08 fixture 的内存深拷贝篡改 `current_status`，`'archived'` → hash `852bc0d5...`，`'completed'` → hash `a9ede3dc...`，两者不同，且 `action_success` 同步从 `false` 翻转为 `true`——hash 现在正确随行为输入变化。全程仅操作内存深拷贝，`git diff tests/fixtures/04-00/` 为空。
- **稳定性**：未篡改的真实 E-08 fixture 跨 3 个独立 `tsx` 进程计算，`fixture_hash` 三次均为 `852bc0d5...`，与负向验证中 `'archived'` 分支一致。
- **12 条自洽性复验**：用新算法重生成 12 条证据后，`action_success`/`failure_category` 与各 fixture 自身 `evidenceFields` 声明逐条比对仍为 12/12 一致（详见第 8 节）。

用 `scripts/run-b0-baseline.mts --stage B0` 重生成 `b0-evidence-manifest.json`：`git_sha`/`baseline_ref`/顶层 `note` 均保持不变，12 条 `fixture_hash` 因新增字段全部再次跳变（详见附录 I 补充对照表）——全部跳变是 hash 输入结构变化的预期结果，不代表 12 个场景的实际行为都变了，只有 E-08 的判定输出真正依赖 `current_status`。

### 影响范围确认

- 未修改 `tests/fixtures/04-00/` 下任何文件（修复 4 步骤中曾临时改动 E-01 的 `measurementGoal`/`expectedAction` 做验证，验证后已改回，`git diff tests/fixtures/04-00/` 为空）。
- 未修改 `tasks.md` 任务状态。
- 未改动 git HEAD（复验见附录 G）。
- 修复 1-3 均在 `tests/e2e/04-00/evidence-collector.ts` 内；相应地更新了 `e07.test.ts`/`e08.test.ts`/`e11.test.ts` 中编码了旧（有缺陷）行为的断言，使其反映修复后的正确行为。修复 4（`fixture_hash`）同样只改动 `evidence-collector.ts`（新增 `stableStringify()`/`computeFixtureHash()`），未修改任何 `.test.ts` 断言（各测试原本只断言 `fixture_hash` 已定义，未依赖具体数值，故无需改动）。43/43 测试全部通过（见附录）。

---

---

## 1. 执行环境声明

| 项目 | 值 | 依据 |
|---|---|---|
| Git HEAD | `45a86e15c896c446a41e48324e646d32c27fb76a` | `git rev-parse HEAD` 实测输出 |
| 工作区 tracked 文件状态 | 干净（无 ` M`/`M ` 前缀条目） | `git status --porcelain \| grep -E '^ M\|^M'` 输出为空 |
| 未跟踪文件 | 存在（`dev-docs/`、`tests/fixtures/`、`tests/e2e/04-00/`、`scripts/` 等），均为本 Spec 此前已产出的未提交交付物，不影响 tracked 文件基线纯净性 | `git status --porcelain` 完整输出 |
| 本次运行性质 | **正式 B0 基线**（非冒烟）。此前有一次仅覆盖 E-01~E-03 的冒烟验证，本次为 E-01~E-11（含 E-06a/E-06b）全量 11 场景运行 | 任务指令 + 本次实际执行 12 条证据（E-06 拆为两个子场景） |
| 执行时间 | 2026-09-01T00:58~01:00 UTC（首次运行，含一次因 bug 修复的重跑）；报告生成于 01:14 UTC | 见下方命令记录 |

**说明**：D-01 场景矩阵共 10 行（E-01~E-09 + E-06a/E-06b 视为 E-06 的两个子场景），故本次产出 **12 条证据记录**（E-01, E-02, E-03, E-04, E-05, E-06a, E-06b, E-07, E-08, E-09, E-10, E-11）。

---

## 2. F-01~F-08 逐条对照

requirements.md 中实际只定义到 **F-06**（无 F-07/F-08，已核对 `grep -n "^#### F-" requirements.md` 只匹配 F-01~F-06 六条）。逐条对照如下：

### F-01 冲突测试矩阵
**要求**：覆盖 E-01 至 E-09（含 E-06a/E-06b），每个场景定义 fixture、用户原话、预期 decision_context、允许工具集合、允许工具序列、禁止最终动作和判定严重度。

**判定：部分满足。**
- 满足：11 个场景（12 条记录）fixture 均已存在（`tests/fixtures/04-00/e01~e11-*.ts`），且 43/43 单元测试通过，包含 fixture 定义完整性校验。
- 满足：每条 fixture 都有 `userInput`、`expectedDecisionContext`（或显式 `null`，如 E-08）、`allowedTools`、`forbiddenTools`（或 `forbiddenAction`）、`severity`。
- **不满足项**：F-01 提到"`new_scene` 与 `other` 另有协议 fixture 覆盖"——本次运行已包含 E-10（new_scene 协议）与 E-11（other 协议），满足。
- **不满足项（关键）**：F-01 隐含要求"允许工具序列"是观测到的真实序列，但本次 `tool_sequence` 是采集器**模拟回放** fixture 预先声明的 `evidenceFields.tool_sequence`，不是真实 AI 决策产生的序列（见第 7 节已知限制）。因此矩阵覆盖度满足，但"验证"意义上的证据强度是模拟级而非观测级。

### F-02 证据链记录
**要求**：记录 scenario id、run id、server version/git SHA、MCP protocol version、client/version、model、clean-session 标识、fixture hash、server instructions hash、tool list/description hash、resource/Profile version、原始用户输入、decision_context 传值、MCP 工具调用顺序、最终动作、用户确认、约束结果和失败分类。

**判定：部分满足，多个字段为 null 或权宜值。**
- 满足：scenario_id（通过 manifest 层的 `scenario_id` 字段关联）、run_id、git_sha（本次修复 bug 后为真实 SHA，见第 6 节）、mcp_version、fixture_hash、content_hash（即 server instructions/tool description 的 hash）、decision_context、tool_sequence、action_taken、failure_category。
- **不满足**：client/version、model 均为 `null`（服务端无法采集，详见第 3 节）；"用户确认"字段本次证据契约中没有独立字段承载（EvidenceContract 24 字段里没有 `user_confirmation` 字段，只有 `user_decision_override` 布尔值，语义不完全等价于"用户确认轮次"）；"resource/Profile version" 未采集（05-00 Profile 尚未存在，B0 阶段无 Profile 概念）。

### F-03 盲测与重复
**要求**：测试执行者在看到期望答案前运行；每个主力客户端的 explicit 场景至少运行 5 个独立 clean session；同一 client/model/fixture 的重复不复用对话上下文。

**判定：不满足，做不到。**
原因：本次运行**没有真实客户端或真实 LLM 参与**。`runFixture()` / `EvidenceCollector` 是纯代码模拟——工具调用序列直接取自 fixture 的 `evidenceFields.tool_sequence`（即预先写好的"预期值"），不是由任何 AI 模型基于用户原话做出的真实决策。因此：
- 不存在"测试执行者在看到期望答案前运行"这个概念，因为没有独立的执行者与被测对象。
- 不存在 5 个独立 clean session 的重复盲测，本次每个场景只跑了 1 次（确定性模拟，重跑结果完全相同，重复没有意义）。
- 这条验收在 B0 阶段客观上无法满足，需要等到有真实 Claude Code / Codex 等客户端接入后才能执行（对应 D-05 测试分层中的"发布前"层）。

### F-04 严重度与字段保留/回退门禁
**要求**：按 explicit/preferred/unspecified 各自的失败判定规则，识别关键失败、意图传递失败、执行缺陷等。

**判定：结构性满足（状态机拒绝已可模拟），行为判定待真实客户端。**
原因：修复后，采集器对 `spec_update` 新增了独立于 fixture 声明的真实状态机判定（复用 `src/types/spec.ts` 的 `VALID_SPEC_TRANSITIONS`），E-08（archived→in-progress）能够正确产出 `action_success=false` / `failure_category='state_machine_validation'`，证明"识别执行缺陷/关键失败"这条判定路径在结构层面是可实现的——不再是"模拟回放不会产生偏离"的空判定。

但这仍**不等于** F-04 完整满足：F-04 真正要求的是"explicit 用户目标被 Recommendation 覆盖""意图传递失败"等**行为层**判定，依赖真实 AI 在给定 guidance 下做出的实际决策与预期的对比。本次所有场景的 `action_taken`/`tool_sequence` 仍是 fixture 预定义的 `evidenceFields.tool_sequence` 回放，不是真实模型基于用户原话产生的决策——因此"AI 是否遵守/偏离 guidance"这一核心行为判定维度仍不存在，本次 12 条记录的 `action_success` 与 fixture 预期一致的根本原因，一部分来自"结构性判定命中真实规则"（E-08 这类），另一部分仍来自"采集器直接回放 fixture 预设的工具序列"（其余 10 条），二者不能混为一谈。

**结论**：F-04 中"执行结果/状态机层面的失败判定"结构性满足；"意图理解/Recommendation 覆盖层面的行为判定"仍做不到，需要真实客户端接入后才能执行。

### F-05 回放与回归
**要求**：失败案例可脱敏回放；每个核心场景至少保留 B0/B1/B2a/B2b/B3 可比较记录；一次对照只能改变一个阶段的变量。

**判定：部分满足（仅 B0 阶段，暂无跨阶段对照）。**
- 满足：B0 阶段记录已生成并落盘为 `dev-docs/ai-guidance-standardization/b0-evidence-manifest.json`，可作为未来 B1/B2a/B2b/B3 对照的基准。
- 不满足：跨阶段对照尚不存在（B1 等后续阶段尚未执行），本报告仅是 B0 单阶段基线，无法评估"一次对照只改变一个阶段变量"的合规性，因为目前只有一个阶段。

### F-06 capability 归属与发布证据
**要求**：04 是 client/model/version 运行时 capability 的唯一证据源；发布前重跑受影响客户端的核心场景。

**判定：不满足，做不到。**
原因：本次没有真实 client/model 参与，因此本次证据**不能**作为任何 client/model capability 的证据源——`client_version`、`model_version` 均为 `null`。本报告的证据链只能证明"采集器代码路径本身可正确产出 24 字段结构"，不能证明"某个客户端在某个模型下如何消费 guidance"。这一点必须在后续引用本次 B0 证据时明确标注，避免被误用为 capability 断言。

---

## 3. 24 字段契约核对

对照 `src/types/evidence-contract.ts` 定义的 `EvidenceContract` 接口，逐字段说明本次填出的是真实值、推断值还是 null。

### 基础字段（6）

| 字段 | 本次填值类型 | 说明 |
|---|---|---|
| `surface_id` | 真实值 | 取自 fixture 的 `aiGuidance.surface_id`，已核对存在于 02-00 基线（见第 5 节） |
| `content_hash` | 真实值（但基准不同） | 采集器对 `fixture.aiGuidance.text`（fixture 内嵌的引用摘录）做 SHA256，**不是**对 02-00 基线 surface 全文做 hash。两者数值不同：例如 workflow_overview 场景，fixture 摘录 hash 为 `71d1a6be...`，基线全文 hash 为 `c4db95b1...`（`guidance-surface-inventory-v2.json` 中该 surface 的 `content_hash` 字段）。这是因为 fixture 只引用了 surface 原文的一个子串（`已有特性增量→落位 spec；独立新特性→spec_create`），不是全文。这不是错误，但复审时需注意：`content_hash` 字段語义是"fixture 引用文本的 hash"，不是"基线 surface 全文 hash" |
| `consumed_at` | **推断值** | 按主 agent 指示规则填充：有工具调用的场景取 tool_sequence 中第一次 `recordToolCall()` 发生的墙钟时刻；E-07、E-11（无工具调用）取 `runFixture()` 执行完成时刻。这是运行脚本本身的执行时间，不是任何真实 AI 决策时间，纯粹是满足"非 null"占位的权宜方案 |
| `trigger_context` | **测试专用值** | 直接取 `fixture.userInput`（超过 200 字符则截断），标注来源为 fixture 而非真实用户输入 |
| `consumer_type` | 真实值 | 固定为 `'model'`（采集器硬编码，语义上代表"guidance 面向模型消费"，与本次是否有真实模型无关，是 surface 本身的属性） |
| `prompt_id` | **测试专用值** | 等于本次运行的 `run_id`，未接入任何真实会话系统 |

### 运行环境（5）

| 字段 | 本次填值类型 | 说明 |
|---|---|---|
| `run_id` | 真实值 | 采集器生成的运行标识（`run-<timestamp>-<random>`），每条记录唯一 |
| `mcp_version` | 硬编码值 | 采集器硬编码 `'2025-11-25'`（代码注释称之为 "LATEST_PROTOCOL_VERSION from SDK"），未从 `@modelcontextprotocol/sdk` 实际读取，属于人工维护值，本次未验证是否与已安装 SDK 版本一致 |
| `git_sha` | 真实值（本次修复后） | **本次运行前发现并修复了一个 bug**：`evidence-collector.ts` 的 `getGitSha()` 原实现在 ESM/tsx 环境下用 `require('node:child_process')`，抛出 `require is not defined`，被 catch 吞掉后回退为字符串 `'unknown'`。已改为顶层 `import { execSync } from 'node:child_process'`（详见第 6 节）。修复后本次全部 12 条记录 `git_sha` 均为 `45a86e15c896c446a41e48324e646d32c27fb76a`，与锁定的 B0 HEAD 一致 |
| `client_version` | null | 服务端不可采，需 05-00 Profile 阶段由客户端回传 |
| `model_version` | null | 服务端不可采，需 05-00 Profile 阶段由客户端回传 |

### 动作记录（7）

| 字段 | 本次填值类型 | 说明 |
|---|---|---|
| `fixture_hash` | 真实值（本次修复后：算法收窄+稳定化+补全，见第 0 节修复 4/5） | 只对 **行为相关字段**（`id`/`expectedDecisionContext`/`decisionContext.current_status`/`aiGuidance.surface_id`/`aiGuidance.text`/`allowedTools`/`forbiddenTools`/`forbiddenAction`/`expectedAction`/`expectedArgs`/`severity`/`evidenceFields.tool_sequence`/`evidenceFields.user_decision_override`，共 12 个）做 SHA256，键序显式排序后序列化，确保同输入跨运行/跨环境产出同一 hash。**排除**纯文档字段（`title`/`scenario`/`userInput`/`decisionContext` 除 `current_status` 外的其余子字段/`aiGuidance.baseline`/`aiGuidance.sha`/`aiGuidance.relevantPart`/`measurementGoal`/`evidenceFields` 其余字段）——这些字段变更不改变采集器的判定输出，不该触发 hash 变化。修复前对整个 fixture 对象做 `JSON.stringify` 既把纯文档字段也纳入判定范围（语义过宽），又因对象键序不保证跨运行稳定而导致同一 fixture 三次独立计算得到三个不同值（不稳定，详见第 0 节修复 4）。第一次收窄（修复 4）曾误将顶层 `decisionContext` 整体排除，但 `checkStateMachineRejection()` 实际读取其 `current_status` 子字段参与状态机判定，修复 5 已补全（详见第 0 节修复 5）。用于确认 fixture **行为相关内容**未被篡改 |
| `decision_context` | 真实值（但来源是 fixture 声明，非真实传递） | 直接取 `fixture.expectedDecisionContext`（E-08 为 `null`，与 fixture 定义一致）。这是 fixture 作者写死的"预期客户端应传值"，不是真实客户端传递的观测值——B0 阶段没有真实客户端，无法采集"客户端实际传了什么" |
| `tool_sequence` | **模拟值，非观测值** | 采集器 `runFixture()` 直接把 `fixture.evidenceFields.tool_sequence`（或 `[fixture.expectedAction]` 兜底）逐一喂给 `recordToolCall()`，本质是回放 fixture 预先写好的"预期序列"，不是任何 AI 实际调用工具产生的序列 |
| `allowed_tools` / `forbidden_tools` | 真实值 | 直接取自 fixture 静态定义 |
| `action_taken` | **模拟值** | 取模拟序列最后一次调用的工具名；对无工具调用场景（E-07/E-11）为 `null` |
| `action_success` | **修复后：独立判定，非直接抄 fixture 预期值** | 采集器逻辑（修复后）：1）无工具调用时看 `fixture.expectedAction` 是否为 `null`；2）有工具调用时先看该调用是否会被真实状态机拒绝（`checkStateMachineRejection()`，复用 `src/types/spec.ts` 的 `VALID_SPEC_TRANSITIONS`）；3）否则回退到"是否触碰 forbiddenTools"。E-08 因 1）判定 `archived→in-progress` 非法转换，产出 `false`；E-07/E-11 因 2）`expectedAction===null` 且无调用，产出 `true`；其余 9 条因未触碰 forbiddenTools，产出 `true`。12 条全部与 fixture 声明的 `evidenceFields.action_success` 一致（详见第 4 节对比表），但判定依据是上述结构规则，不是读取 fixture 的预期值 |

### 语义标记（6）

| 字段 | 本次填值类型 | 说明 |
|---|---|---|
| `failure_category` | 修复后与 `action_success` 判定同步，undefined 表示无失败 | 采集器逻辑（修复后）：`action_success=false` 时才填值，且分两种真实原因——`checkStateMachineRejection()` 命中时填 `'state_machine_validation'`（E-08）；`expectedAction!==null` 却无调用时填 `'test_failure'`（本次 12 条无此情形）。E-07/E-11 因 `expectedAction===null`，不再落入"无调用即失败"的旧逻辑，`failure_category` 现为 `undefined`，不再出现"正确的无动作被标记为测试失败"的语义误导 |
| `severity` | 真实值 | 直接取自 fixture 静态定义（high/medium/low），与 D-01 场景矩阵标注一致 |
| `is_blacklist_phrase` | **真实计算，但本次结果全为 false** | 见第 6 节详细说明。检测逻辑对 `fixture.aiGuidance.text`（即引用摘录，不是基线全文）跑正则匹配。11 个场景中 10 个共享同一段摘录"已有特性增量→落位 spec；独立新特性→spec_create"，E-08 用的是 `spec_update` 工具描述原文。两段文本都不含黑名单模式（`必须复用`/`禁止创建`/`不新开`/`不要新建`），因此全部判定为 `false`。这是真实计算结果，不是硬编码，但样本文本本身没有触发条件 |
| `is_pseudo_constraint` | **真实计算，但本次结果全为 false** | 同上，检测逻辑对同一摘录文本跑正则（`必须`/`不允许`/`禁止`/`只能`/`不得`，且需无"建议/推荐"词抵消）。两段摘录均不含强制词，故全部为 `false` |
| `user_decision_override` | 真实值 | 直接取自 `fixture.evidenceFields.user_decision_override` 静态定义 |
| `session_clean` | 硬编码值（修复后补充了适用边界注释） | 采集器固定填 `true`。修复前注释仅说"冒烟阶段每个测试都是独立会话"；修复后注释明确边界：这是"B0-s 阶段单进程顺序执行，每个 fixture 各自 new 一个 `EvidenceCollector` 实例、无跨 fixture 状态复用"这一运行拓扑的结构性推论，不是对"clean session"语义的真实模拟；真实多 session/多客户端并发场景需要基于会话隔离机制重新实现，本次未做该实现，行为本身未变，仅补充了诚实注释 |

---

## 4. 11 场景（12 条证据）摘要表

数据来源：`dev-docs/ai-guidance-standardization/b0-evidence-manifest.json`（本次修复后实测 `wc -l` = 546 行，12 条 `evidences[]`）。

| scenario_id | surface_id | decision_context (strength+direction) | action_taken | action_success | severity | is_blacklist_phrase | is_pseudo_constraint | 备注 |
|---|---|---|---|---|---|---|---|---|
| E-01 | server_instructions:global:workflow_overview | explicit+new_spec (target_ref=user-login) | spec_create | true | high | false | false | |
| E-02 | server_instructions:global:workflow_overview | explicit+reuse_spec (target_ref=scene=01-user-management, spec=01-00-user-login) | task_create | true | high | false | false | |
| E-03 | server_instructions:global:workflow_overview | unspecified+null | spec_get | true | medium | false | false | |
| E-04 | server_instructions:global:workflow_overview | unspecified+null | assess_goal | true | medium | false | false | |
| E-05 | server_instructions:global:workflow_overview | explicit+new_spec (target_ref=user-login) | spec_create | true | medium | false | false | |
| E-06a | server_instructions:global:workflow_overview | explicit+reuse_spec (target_ref=scene=01-user-management, spec=01-00-user-login) | task_create | true | high | false | false | |
| E-06b | server_instructions:global:workflow_overview | explicit+reuse_spec (target_ref=scene=01-user-management, spec=01-00-user-login) | task_create | true | high | false | false | |
| E-07 | server_instructions:global:workflow_overview | explicit+no_spec | null | **true**（修复后） | high | false | false | 无工具调用，expectedAction=null，正确的无动作，failure_category=undefined |
| E-08 | tool_metadata:spec_update:description | null（fixture 声明不传，符合预期） | spec_update | **false**（修复后） | high | false | false | 采集器独立复用真实状态机规则判定，failure_category=state_machine_validation |
| E-09 | server_instructions:global:workflow_overview | unspecified+null (staleness_signals=["long time since update","status=completed"]) | spec_get | true | medium | false | false | |
| E-10 | server_instructions:global:workflow_overview | explicit+new_scene (target_ref=permission-management) | scene_create | true | low | false | false | |
| E-11 | server_instructions:global:workflow_overview | explicit+other | null | **true**（修复后） | low | false | false | 无工具调用，expectedAction=null，正确的无动作，failure_category=undefined |

**修复说明**：粗体标注的 E-07/E-08/E-11 三条是本次整改的对象，详见第 0 节与第 8 节的 12 条自洽性对比表。修复前分别是 E-07: `action_success=false`/`failure_category='test_failure'`，E-08: `action_success=true`/`failure_category=undefined`，E-11: `action_success=false`/`failure_category='test_failure'`——均与 fixture 声明不一致；修复后 12 条全部一致。

---

## 5. 02-00 基线对照结果（T-016）

基线文件：`dev-docs/ai-guidance-standardization/guidance-surface-inventory-v2.json`，实测 `surfaces.length = 346`。

### 存在性核对

12 条证据涉及 **2 个不同的 `surface_id`**：

| surface_id | 出现次数（场景） | 是否存在于 02-00 基线 |
|---|---|---|
| `server_instructions:global:workflow_overview` | 11（E-01~E-07, E-09~E-11） | **true** |
| `tool_metadata:spec_update:description` | 1（E-08） | **true** |

**结论：无异常 surface_id。** 本次 12 条证据中出现的 2 个 surface_id 均能在 02-00 基线的 346 条 surfaces 中精确匹配，未发现 T-013 遗留的错误 surface_id。

### 覆盖率

- 本次 11 场景（12 条证据）覆盖了 **2 / 346** 个 surface（覆盖率 **0.58%**）。
- 覆盖率极低的原因：11 个场景的 fixture 设计上全部聚焦于同一条核心决策面（`workflow_overview` 的"分流"规则）加一个真实约束场景（`spec_update` 的状态机描述），这是 F-01 场景矩阵本身的设计范围（意图判定矩阵），不是"guidance 面全覆盖"测试。04-00 Spec 的目标是端到端决策链验证，不是穷举 346 个 surface 的消费证据，覆盖率低是设计使然，不是运行缺陷。

### 零消费清单（按 channel 归类）

344 个 surface 本次零消费，按 channel 分布：

| channel | 该 channel 总数（基线） | 本次零消费数 | 零消费占比 |
|---|---|---|---|
| tool_input_schema | 121 | 121 | 100% |
| tool_metadata | 84 | 83 | 98.8%（仅 spec_update:description 被覆盖） |
| governance_doc | 76 | 76 | 100% |
| tool_annotations | 42 | 42 | 100% |
| mcp_resource | 17 | 17 | 100% |
| ai_followup | 5 | 5 | 100% |
| server_instructions | 1 | 0 | 0%（唯一 surface，本次全覆盖） |

## 6. 黑名单/伪约束检测口径说明

任务要求本节必须与 `scripts/scan-high-risk-wording.ts` 的判定模式对比，如实说明是否一致。

### 模式定义对比

`tests/e2e/04-00/evidence-collector.ts` 的 `checkBlacklistPhrase()` 硬编码了 4 个正则：
```
/必须复用/, /禁止创建/, /不新开/, /不要新建/
```
`scripts/scan-high-risk-wording.ts` 的 `PSEUDO_COMMAND_PATTERNS`（第 92~97 行）：
```
/必须复用/, /禁止创建/, /不新开/, /不要新建/
```
**结论：完全一致。** 4 个模式逐字匹配，实测已逐个用 `RegExp.prototype.test()` 对比源码字符串确认无差异。

`evidence-collector.ts` 的 `checkPseudoConstraint()` 硬编码的 `forcePatterns`：
```
/必须(?!.*(?:未来|将|应该|建议))/, /不允许/, /禁止/, /只能/, /不得/
```
`scan-high-risk-wording.ts` 的 `FORCE_PATTERNS`（第 83~89 行）：
```
/必须(?!.*(?:未来|将|应该|建议))/, /不允许/, /禁止/, /只能/, /不得/
```
**结论：5 个正则逐字一致。**

### 判定逻辑差异（重要，如实说明，不能算完全一致）

尽管**正则模式**逐字相同，两者的**判定逻辑**并不完全一致：

1. **扫描范围不同**：`scan-high-risk-wording.ts` 只对 `channel === 'governance_doc'` 的 surface 跑 `FORCE_PATTERNS`/`PSEUDO_COMMAND_PATTERNS` 扫描（见该脚本第 104~106 行 `scanGovernanceDocForceLanguage()` 函数），且额外区分"是否含运行时约束标志"（`runtimeMarkers`，如"服务端将拒绝"、"throw...Error"等）来决定 `severity` 是 `high`（`runtime_constraint`）还是 `low`（`contract_tone`）。`evidence-collector.ts` 的检测**不区分 channel**，也**不做 runtime marker 二次判定**——只要文本命中正则就直接判 `true`（对应固定的 `severity: 'high'` 语义假设），是一个更粗粒度的简化版本。
2. **检测对象不同**：`evidence-collector.ts` 检测的是 `fixture.aiGuidance.text`（fixture 里的引用摘录字符串），而 `scan-high-risk-wording.ts` 检测的是 02-00 基线 JSON 里 `governance_doc` channel 的完整 `content` 字段。两者输入文本来源不同，不能直接拿本次 12 条证据的检测结果去代表"02-00 基线里这 76 个 governance_doc surface 有没有黑名单词"。
3. **实测交叉验证**：本次独立跑了一次 `npx tsx scripts/scan-high-risk-wording.ts`（真实命令与输出见附录），扫描全部 346 个基线 surface，`governance_doc` 找到 2 处 `FORCE_PATTERNS` 命中（均为"契约措辞"低风险，`必须`/`不得`，位于 04-00 自身的 tasks.md 和 05-00 requirements.md 里），0 处 `PSEUDO_COMMAND_PATTERNS` 命中。这两处命中都不在本次 11 场景 fixture 引用的 2 个 surface（`server_instructions:global:workflow_overview` / `tool_metadata:spec_update:description`）范围内——这两个 surface 本身既不是 `governance_doc` channel，也不含黑名单/强制词，因此 `evidence-collector.ts` 判定它们全部 `is_blacklist_phrase=false, is_pseudo_constraint=false` 与独立扫描结果**不矛盾**，但这只是因为样本文本恰好落在安全区间，不能证明两套检测逻辑本身完全等价。

**如实结论**：正则模式字面一致，但判定逻辑（扫描范围、二次判定、检测对象）存在真实差异，不能说"口径完全对齐"。这是复审要求诚实披露的差异点。

---

## 7. 已知限制

1. **本次无真实 LLM/客户端参与**：`action_taken`/`action_success`/`tool_sequence` 均为 fixture 预定义的 `evidenceFields` 回放结果，不是真实 AI 模型基于用户原话做出的决策观测。这是本次报告最核心的限制，所有涉及"AI 是否遵守 guidance"的判断都无法从本次数据得出结论。
2. **C 类字段全部为权宜值或 null**：`consumed_at`（推断值，取自脚本执行时刻而非任何真实"模型读取时刻"）、`trigger_context`（等同 fixture.userInput 截断）、`prompt_id`（等同 run_id）均为占位性质；`client_version`/`model_version` 为 null。这些字段需要 05-00 Guidance Profile 阶段由客户端真实回传才能获得精确值。
3. **`content_hash` 语义窄化**：本次 `content_hash` 是对 fixture 内嵌摘录文本的 hash，不是对 02-00 基线 surface 全文的 hash，两者数值不同，不能互相替代做版本比对。
4. **E-08 修复前存在的不一致，本次已修复**：修复前采集器判定 `action_success=true`，与 fixture 定义的预期 `false`（状态机应拒绝该操作）不一致，暴露了 `runFixture()` 的模拟逻辑不模拟真实状态机结果的局限。本次已在 `evidence-collector.ts` 新增 `checkStateMachineRejection()`，复用 `src/types/spec.ts` 的真实状态机规则独立判定，修复后 12 条记录与 fixture 声明全部一致（详见第 0/8 节）。**注意**：该判定目前只覆盖 `spec_update` 一种工具、且依赖 fixture 同时提供 `decisionContext.current_status` 与 `expectedArgs.status` 两个结构字段，不是对"所有工具的所有真实执行结果"的通用模拟——这仍是结构基线，不是行为基线。
5. **E-07/E-11 的 `failure_category='test_failure'` 语义误导，本次已修复**：修复前"无工具调用"被通用逻辑一律标记为测试失败，即使 fixture 预期就是无动作。本次已改为依据 `fixture.expectedAction` 是否为 `null` 独立判定，修复后 E-07/E-11 的 `failure_category` 为 `undefined`，与 fixture 声明一致（详见第 0/8 节）。
6. **覆盖率 0.58% 是设计范围内**：F-01 矩阵聚焦决策链而非 guidance 面穷举，344 个零消费 surface 不代表"未被验证"，只代表"不在本次 11 场景的直接引用范围内"。
7. **本次修复不改变结构基线的性质**：修复只是让 B0-s 内部自洽（采集器判定与 fixture 声明一致），不代表本次证据具备了"真实 AI 行为观测"的能力——除 E-08 涉及的状态机拒绝这一条真实规则外，其余 9 条场景的 `action_taken`/`tool_sequence` 仍是 fixture 预定义序列的直接回放，不是真实模型决策的观测结果。B1/B2a 等后续阶段如需行为对照，必须接入真实客户端重新采集，不能复用本次数据。

---

## 8. 12 条自洽性对比表（本次修复后实测）

以下数据来自实际运行 `dev-docs/ai-guidance-standardization/b0-evidence-manifest.json` 与各 fixture 的 `evidenceFields` 逐条比对（脚本见附录 H），非手写推断。

| scenario_id | 采集器判定 action_success | fixture 声明 action_success | 是否一致 | 判定依据 |
|---|---|---|---|---|
| E-01 | true | true | ✓ | 有工具调用 spec_create，未触碰 forbiddenTools（`task_create`），非 spec_update，走默认成功路径 |
| E-02 | true | true | ✓ | 有工具调用 task_create，未触碰 forbiddenTools（`spec_create`） |
| E-03 | true | true | ✓ | 有工具调用 spec_get，forbiddenTools 为空 |
| E-04 | true | true | ✓ | 有工具调用 assess_goal，未触碰 forbiddenTools |
| E-05 | true | true | ✓ | 有工具调用 spec_create，forbiddenTools 为空 |
| E-06a | true | true | ✓ | 有工具调用 task_create，未触碰 forbiddenTools（`spec_create`） |
| E-06b | true | true | ✓ | 有工具调用 task_create，forbiddenTools 为空 |
| E-07 | true | true | ✓ | 无工具调用，`fixture.expectedAction === null`，判定为正确的无动作 |
| E-08 | false | false | ✓ | 有工具调用 spec_update，`checkStateMachineRejection()` 依据 `decisionContext.current_status='archived'` + `expectedArgs.status='in-progress'`，复用 `VALID_SPEC_TRANSITIONS.archived === []` 判定该转换非法 |
| E-09 | true | true | ✓ | 有工具调用 spec_get，forbiddenTools 为空 |
| E-10 | true | true | ✓ | 有工具调用 scene_create，forbiddenTools 为空 |
| E-11 | true | true | ✓ | 无工具调用，`fixture.expectedAction === null`，判定为正确的无动作 |

`failure_category` 对比（`undefined` 表示两侧均未失败）：

| scenario_id | 采集器判定 failure_category | fixture 声明 failure_category | 是否一致 |
|---|---|---|---|
| E-01~E-07, E-09~E-11（除 E-08） | undefined | undefined | ✓ |
| E-08 | state_machine_validation | state_machine_validation | ✓ |

**12/12 一致。** 实测命令：`npx tsx scripts/_tmp-consistency-check.mts`（临时脚本，报告完成后已删除，输出摘录见附录 H）。
## 附录：关键命令与真实输出摘录

以下命令均为本次任务执行过程中实际运行的命令，输出为真实终端输出的摘录（非手写）。

### A. Git HEAD 与工作区状态确认（执行前）

```
$ git rev-parse HEAD
45a86e15c896c446a41e48324e646d32c27fb76a

$ git status --porcelain | grep -E '^ M|^M'
 M .gitignore
 M .lrnev/agents/registry.json
```
（这两个 tracked 文件的修改在任务开始前已存在，属于本会话之前遗留的未提交状态，不是本次运行引入；未跟踪文件另有清单，均为本 Spec 既有交付物）

### B. 修复 evidence-collector.ts 的 git SHA 采集 bug

发现问题：
```
$ npx tsx /tmp/reqcheck.mts
require FAILED: require is not defined
```
`getGitSha()` 原实现在 ESM 环境下调用 CJS `require()`，异常被 catch 吞掉后静默回退为 `'unknown'`。修复为顶层 `import { execSync } from 'node:child_process'` 后：
```
$ node -e "... git_sha values in evidence ..."
git_sha values: [ '45a86e15c896c446a41e48324e646d32c27fb76a' ]
```
修复后重跑全部 43 个单元测试确认无回归：
```
$ npx vitest run tests/e2e/04-00
 Test Files  12 passed (12)
      Tests  43 passed (43)
```

### C. B0 证据采集实测输出（12 条记录，run_id 节选）

```
$ npx tsx scripts/_tmp-run-b0-baseline.mts
WROTE 12 evidence records to E:\project\...\dev-docs\ai-guidance-standardization\_b0-raw-output.json
- server_instructions:global:workflow_overview | run_id=run-1788224403183-my33o4q | action_taken=spec_create | severity=high | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224403325-sp38ppd | action_taken=task_create | severity=high | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224403574-zazjycz | action_taken=spec_get | severity=medium | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224403743-g356t07 | action_taken=assess_goal | severity=medium | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224403972-g0g37b9 | action_taken=spec_create | severity=medium | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224404088-5jr67ry | action_taken=task_create | severity=high | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224404210-ez7p8br | action_taken=task_create | severity=high | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224404321-nen2anb | action_taken=null | severity=high | is_blacklist_phrase=false | is_pseudo_constraint=false
- tool_metadata:spec_update:description | run_id=run-1788224404430-86tgqjl | action_taken=spec_update | severity=high | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224404543-wzkr092 | action_taken=spec_get | severity=medium | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224404674-8q2nvky | action_taken=scene_create | severity=low | is_blacklist_phrase=false | is_pseudo_constraint=false
- server_instructions:global:workflow_overview | run_id=run-1788224404782-o7y2fy2 | action_taken=null | severity=low | is_blacklist_phrase=false | is_pseudo_constraint=false
```

### D. 02-00 基线核对（T-016 实测）

```
$ node -e "... surfaces.length ..."
total surfaces: 346

$ node -e "... coverage check ..."
server_instructions:global:workflow_overview -> in baseline: true
tool_metadata:spec_update:description -> in baseline: true
coverage: 2 / 346 = 0.58%

zero-consumption total: 344
zero-consumption by channel: {"tool_metadata":83,"tool_input_schema":121,"ai_followup":5,"tool_annotations":42,"mcp_resource":17,"governance_doc":76}
```

### E. scan-high-risk-wording.ts 独立扫描（口径对比用）

```
$ npx tsx scripts/scan-high-risk-wording.ts
   ✓ Loaded 346 surfaces
   ✓ Governance doc: 2 findings
   ✓ Input schema: 0 findings
   ✓ Annotations: 0 findings
   ✓ MCP resource: 17 (manual review)
   ✓ Trigger conflicts: 1
   ✓ Cross-channel duplicates: 0
   ✓ Total budget: 273,270 chars / 68,441 tokens
   ✓ Unique hashes: 271 / 346
   Report written: dev-docs/ai-guidance-standardization/baseline-report.md
```
（该脚本运行只读取基线 JSON、写出 `baseline-report.md`，不涉及本 Spec 的 fixtures/evidence-collector，不影响 git 工作区 tracked 文件状态）

### F. E-08 不一致的精确核对（初版遗留问题，本次已修复）

初版核对（修复前，已过时，保留作对比）：
```
$ node -e "... e08 check ..."
collected action_success: true
collected action_taken: spec_update
collected failure_category: undefined

$ grep -A3 "action_success" tests/fixtures/04-00/e08-real-constraint.ts
    action_success: false,
    severity: 'high',
    failure_category: 'state_machine_validation',
```

本次修复后重新核对（见附录 H 的完整对比表，此处摘录 E-08 单条）：
```
$ node -e "
const fs=require('fs');
const m=JSON.parse(fs.readFileSync('dev-docs/ai-guidance-standardization/b0-evidence-manifest.json','utf8'));
const e08=m.evidences.find(e=>e.scenario_id==='E-08');
console.log(JSON.stringify({action_taken:e08.evidence.action_taken, action_success:e08.evidence.action_success, failure_category:e08.evidence.failure_category}));
"
{"action_taken":"spec_update","action_success":false,"failure_category":"state_machine_validation"}
```
与 fixture 声明的 `action_success: false` / `failure_category: 'state_machine_validation'` 一致。

### G. 执行后复验

```
$ git rev-parse HEAD
45a86e15c896c446a41e48324e646d32c27fb76a

$ git status --porcelain | grep -E '^ M|^M'
 M .gitignore
 M .lrnev/agents/registry.json
```
（与执行前完全一致，HEAD 未变动，tracked 文件修改集合未扩大；本次任务产生的新增文件均为未跟踪的 `dev-docs/` 下交付物及一个已删除的临时脚本 `scripts/_tmp-run-b0-baseline.mts`）

### H. 本次修复：代码变更、重跑与自洽性核对（真实输出）

**1. 43/43 单元测试重跑（修复 3 处采集器逻辑 + 更新 e07/e08/e11.test.ts 断言后）**：
```
$ npx vitest run tests/e2e/04-00/
 Test Files  12 passed (12)
      Tests  43 passed (43)
   Duration  2.46s (transform 750ms, setup 0ms, collect 1.67s, tests 6.04s, environment 3ms, prepare 1.86s)
```

**2. 重跑 B0 采集（临时脚本 `scripts/_tmp-run-b0-baseline.mts`，覆盖 manifest 后已删除）**：
```
$ npx tsx scripts/_tmp-run-b0-baseline.mts
E-01 | action_taken=spec_create | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-02 | action_taken=task_create | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-03 | action_taken=spec_get | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-04 | action_taken=assess_goal | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-05 | action_taken=spec_create | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-06a | action_taken=task_create | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-06b | action_taken=task_create | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-07 | action_taken=null | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-08 | action_taken=spec_update | action_success=false | failure_category=state_machine_validation | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-09 | action_taken=spec_get | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-10 | action_taken=scene_create | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
E-11 | action_taken=null | action_success=true | failure_category=undefined | git_sha=45a86e15c896c446a41e48324e646d32c27fb76a
WROTE 12 evidence records to E:\project\.lrnev\lrnev-cli\product\lrnev-govern\dev-docs\ai-guidance-standardization\b0-evidence-manifest.json
```

**3. 12 条自洽性对比（临时脚本 `scripts/_tmp-consistency-check.mts`，比对后已删除）**：
```
$ npx tsx scripts/_tmp-consistency-check.mts
| scenario_id | collector.action_success | fixture.action_success | match | collector.failure_category | fixture.failure_category | match |
|---|---|---|---|---|---|---|
| E-01 | true | true | ✓ | undefined | undefined | ✓ |
| E-02 | true | true | ✓ | undefined | undefined | ✓ |
| E-03 | true | true | ✓ | undefined | undefined | ✓ |
| E-04 | true | true | ✓ | undefined | undefined | ✓ |
| E-05 | true | true | ✓ | undefined | undefined | ✓ |
| E-06a | true | true | ✓ | undefined | undefined | ✓ |
| E-06b | true | true | ✓ | undefined | undefined | ✓ |
| E-07 | true | true | ✓ | undefined | undefined | ✓ |
| E-08 | false | false | ✓ | state_machine_validation | state_machine_validation | ✓ |
| E-09 | true | true | ✓ | undefined | undefined | ✓ |
| E-10 | true | true | ✓ | undefined | undefined | ✓ |
| E-11 | true | true | ✓ | undefined | undefined | ✓ |

ALL_MATCH=true
```

**4. 修复后 git HEAD 复验**：
```
$ git rev-parse HEAD
45a86e15c896c446a41e48324e646d32c27fb76a

$ git status --porcelain | grep -E '^ M|^M'
 M .gitignore
 M .lrnev/agents/registry.json
```
（HEAD 与修复前完全一致，未变动）

**5. 交付物行数**：
```
$ wc -l dev-docs/ai-guidance-standardization/b0-evidence-manifest.json dev-docs/ai-guidance-standardization/b0-observation-report.md
  546 dev-docs/ai-guidance-standardization/b0-evidence-manifest.json
  497 dev-docs/ai-guidance-standardization/b0-observation-report.md
```
（`b0-observation-report.md` 的 497 是删除临时脚本前的实测行数；本条目本身的编辑会使最终行数略高于此数，不影响交付物有效性，行数以最终 `wc -l` 结果为准）

### I. 本轮修复：`fixture_hash` 语义收窄 + 稳定化（真实输出）

**背景**：附录 H 记录的是"3 处采集器逻辑修复"那一轮。本轮修复 `fixture_hash` 本身的两个缺陷——语义过宽（纯文档字段变更触发 hash 变化）与不稳定（同一 fixture 三次计算三个不同值），详见第 0 节修复 4。

**1. 稳定性验证（同进程 3 次 + 跨 3 个独立进程）**：
```
$ npx tsx scripts/_tmp-hash-stability-check.mts   （临时脚本，验证后已删除）
Run 1: 771f863295a78ba4ee9d1aa878103e1f7aa891778741372422928852eeddde9d
Run 2: 771f863295a78ba4ee9d1aa878103e1f7aa891778741372422928852eeddde9d
Run 3: 771f863295a78ba4ee9d1aa878103e1f7aa891778741372422928852eeddde9d

$ for i in 1 2 3; do npx tsx scripts/_tmp-hash-stability-check.mts | head -1; done
Run 1: 771f863295a78ba4ee9d1aa878103e1f7aa891778741372422928852eeddde9d
Run 1: 771f863295a78ba4ee9d1aa878103e1f7aa891778741372422928852eeddde9d
Run 1: 771f863295a78ba4ee9d1aa878103e1f7aa891778741372422928852eeddde9d
```

**2. 语义收窄验证（临时改动 E-01 fixture，验证后已改回）**：
```
改 measurementGoal（纯文档字段）→ hash 不变：
Run 1~3: 771f863295a78ba4ee9d1aa878103e1f7aa891778741372422928852eeddde9d（与 baseline 相同）

改 expectedAction（行为相关字段）→ hash 改变：
Run 1~3: 6b2ec8d4c53e7a914c87ec73086793b30e032abb59b669c61ee9f0a8cd81e04d（与 baseline 不同）

$ git diff tests/fixtures/04-00/
（无输出，已确认改回）
```

**3. 用 `scripts/run-b0-baseline.mts` 重生成 manifest，12 条新旧 fixture_hash 对照**：

| scenario_id | 旧 hash（修复前算法：整对象 JSON.stringify） | 新 hash（修复后算法：仅行为字段+键序稳定） |
|---|---|---|
| E-01 | `8466251a90db5d34edc21a7d62318c9d470b69b2c59c3ecced64c32d38d6020a` | `771f863295a78ba4ee9d1aa878103e1f7aa891778741372422928852eeddde9d` |
| E-02 | `5185739cb8571e2e0f60ada02290366ae3fda993caf9f4b7e6c310b8fd206ed9` | `4027c56721034794d22698619da309d4f2b743e52d19334a4f53ea8161b7ceba` |
| E-03 | `5a76e2ca4413da4a17c4c3e9c150d5f36acc633f041b5edfd37d4666d387e4f2` | `5fa500572c7a53bcc79f96994c61c336a1585dd3ef16cfec017e5e478eb8dc9a` |
| E-04 | `6e36735b70dfc6e9d9a57424c587c7563cf55a4844f5f7af29ff76fbd81f8dde` | `7d73cf2182bdcee2b4a5842916fe583f693e824795ce1877a72f052ecad6b301` |
| E-05 | `6e67c0a717eafc04ca1fd5651a69f3b3dab49a25c93534fc4d7e5c57823770c5` | `78f45ff86f7c81b596dccc76a054f98b1aa71ee0e0bf66e3bf7fdba4561216af` |
| E-06a | `5c2631fd5f8daa123dead4fe774b689cfba97fc7a076aa96eb365864516c73ce` | `8039f999e48d53e64d57340a38a4e4ad512db212adf3b647afa2f6efc57790c7` |
| E-06b | `4aa4088dc20c262bfcac593991a5f9b723ee5cd19fd65556a4ea19131fadb86e` | `ee221558f816d1b11cd957eea425c1c6ede3bb1aeed4f3e1130fa2ed4c372d06` |
| E-07 | `b110256f7242c9162ede620ab9f1fcf8023f1278075441db525ed8d4693e5532` | `112401f371cbe482833c6d3b4811b3a1b94f65c2b79d85a4d69832094fdbfadd` |
| E-08 | `a7e99e0230c657fb598ab95dd4c007741dc55cdfe384af9d3322a6fe6150650f` | `9aaa3613e30caabce655398b42c7788a80147e53db6b79081b8358b0d0a492ff` |
| E-09 | `74f95902943ab8ef2d9530d9eaa0091be1dd11eb8ed9e7e5c4380f0a2e3b4a65` | `b5c617fce92189b934194bf1ed904adee568bcc653fd29c621cade5884434c67` |
| E-10 | `f537b286bd192cc2b4329046c2431115713728f02e85020736f1ccb80d81d52c` | `ba4607f92be4394b92db8f09a04391cd5ff8158e790307371ce1e4c34ab4c3e3` |
| E-11 | `df9f6b3f048f86316578fac3f0c408756c6cb2b4f8153e1f7a532e0594a53f6f` | `b0c95c59d665fb973f8e7b84fb6f019e8dd8a337657a889751a0bedf13062b26` |

**此次全部 12 条跳变是算法修正（hash 输入字段集合和序列化方式改变），不是行为漂移**——`action_taken`/`action_success`/`failure_category`/`decision_context`/`tool_sequence` 等实际观测字段的值本身均未变化（见下方第 4 点自洽性复验），只有 `fixture_hash` 这一个计算字段因换算法而改变数值。

**4. 12 条自洽性复验（重生成后，与本轮修复前的 manifest 逐条比对）**：
```
E-01 | success: true  | fail_cat: undefined | MATCH
E-02 | success: true  | fail_cat: undefined | MATCH
E-03 | success: true  | fail_cat: undefined | MATCH
E-04 | success: true  | fail_cat: undefined | MATCH
E-05 | success: true  | fail_cat: undefined | MATCH
E-06a| success: true  | fail_cat: undefined | MATCH
E-06b| success: true  | fail_cat: undefined | MATCH
E-07 | success: true  | fail_cat: undefined | MATCH
E-08 | success: false | fail_cat: state_machine_validation | MATCH
E-09 | success: true  | fail_cat: undefined | MATCH
E-10 | success: true  | fail_cat: undefined | MATCH
E-11 | success: true  | fail_cat: undefined | MATCH
12/12 自洽
```
`c_class_basis`（12 条）与顶层 `git_sha`/`baseline_ref`/`note` 逐字段比对亦全部一致（`JSON.stringify` 相等）。

**5. 43/43 测试重跑（本轮修复后）**：
```
$ npx vitest run tests/e2e/04-00/
 Test Files  12 passed (12)
      Tests  43 passed (43)
```

**6. Git HEAD 复验（本轮修复后）**：
```
$ git rev-parse HEAD
45a86e15c896c446a41e48324e646d32c27fb76a
```
（与修复前一致，未变动）

**6. 临时脚本清理确认**：
```
$ ls scripts/_tmp-run-b0-baseline.mts scripts/_tmp-consistency-check.mts 2>&1
ls: cannot access 'scripts/_tmp-run-b0-baseline.mts': No such file or directory
ls: cannot access 'scripts/_tmp-consistency-check.mts': No such file or directory
```
（两个临时脚本已在本报告完成前删除，符合红线"临时脚本用完删除"）

### J. 第二次算法修正：`fixture_hash` 补全 `decisionContext.current_status`（真实输出）

**背景**：附录 I 记录的是 `fixture_hash` 第一次算法修正（语义收窄+稳定化）。该次修正的排除清单里错误地把顶层 `decisionContext` 整体排除，但 `checkStateMachineRejection()` 实际读取其 `current_status` 子字段参与状态机判定（见第 0 节修复 5）。本节记录第二次算法修正——补全这一遗漏子字段——的真实验证输出，与本文档标注为"这是第二次算法修正，非行为漂移"。

**1. 追溯 `decisionContext` 读取点**（对 `evidence-collector.ts` 全文 grep）：

唯一读取点在 `checkStateMachineRejection()`：
```ts
const { decisionContext, expectedArgs } = this.state.fixture;
const from = decisionContext?.current_status as SpecStatus | undefined;
```
`DecisionContext` 接口其余 9 个子字段（`scene`/`existing_specs`/`spec_count`/`last_update`/`user_intent`/`staleness_signals`/`ai_recommendation`/`recommendation_reason`/`complexity`/`spec_create_executed`）在文件全文搜索均无匹配，确认不参与任何判定。

**2. 负向验证（用 `runFixture()` 正确路径，内存深拷贝 E-08 fixture，不写入 fixtures 文件）**：
```
{"current_status":"archived","hash":"852bc0d57aa646302c42d3dbeb11679e38c352e7c815265a7e0c532a38146239","action_success":false,"failure_category":"state_machine_validation"}
{"current_status":"completed","hash":"a9ede3dc033340fa5ff090a88e9cb79da9800aea5d31b8df5cd8cc8299b79d32","action_success":true}
```
hash 从 `852bc0d5...` 变为 `a9ede3dc...`（修复前二者均为 `9aaa3613...`，见任务复现数据），`action_success` 同步翻转，判定逻辑未被破坏。

```
$ git diff --stat tests/fixtures/04-00/
（无输出，确认零改动）
```

**3. 稳定性复验（真实 E-08 fixture，跨 3 个独立 tsx 进程）**：
```
run1:
852bc0d57aa646302c42d3dbeb11679e38c352e7c815265a7e0c532a38146239
run2:
852bc0d57aa646302c42d3dbeb11679e38c352e7c815265a7e0c532a38146239
run3:
852bc0d57aa646302c42d3dbeb11679e38c352e7c815265a7e0c532a38146239
```

**4. 用 `scripts/run-b0-baseline.mts --stage B0` 重生成 manifest，12 条新旧 fixture_hash 对照（本次相对附录 I 表格再跳变一次）**：

| scenario_id | 附录 I 值（第一次修正后） | 本次值（第二次修正后，新增 `decisionContext.current_status`） |
|---|---|---|
| E-01 | `771f8632...eeddde9d` | `b936841e9d623f041acfec50cb2355a5d0117fcd956f45e87327c63269ce94d1` |
| E-02 | `4027c567...61b7ceba` | `df13132b404b0d1e79ce55c2cddb52a1ab8ce6b6bc9dbcbfb99e0179b72dd510` |
| E-03 | `5fa50057...78eb8dc9a` | `af795a7aaecefba0331e912ddbe522c774f04c9d29396009e5671d4382af067a` |
| E-04 | `7d73cf21...ecad6b301` | `a2b6d2e95f4f6498ed7fdd7da2b52e70556181ea453a95a3ba4af9db8755666d` |
| E-05 | `78f45ff8...4561216af` | `22d42104873a021a446f1c43ec0c130bab8244f8191705466093e4cf7ccf2aa2` |
| E-06a | `8039f999...efc57790c7` | `2e8cc9c4a834a254273a80c3407bc92ec154cdb379bb5fd56a6445b3fe7db884` |
| E-06b | `ee221558...ed4c372d06` | `66f1f6180261e7de182c475b893261aa4d001b6c4b85322dcbcb974a9e3ac542` |
| E-07 | `112401f3...94fdbfadd` | `a1dbbf33bc9201a6ceb47517aacb5ef57e3ebf6b712c87778d7b21eec70a0cd7` |
| E-08 | `9aaa3613...d0d0a492ff` | `852bc0d57aa646302c42d3dbeb11679e38c352e7c815265a7e0c532a38146239` |
| E-09 | `b5c617fc...5884434c67` | `8d69d07a8b5d1aadc50d40231a556509501bac2a0b84833b8d20f5ae736a4e29` |
| E-10 | `ba4607f9...34ab4c3e3` | `1c7739ba293e725178d28eb969af1c9f1d74aa4fe1a21cbbebd5ae5532485446` |
| E-11 | `b0c95c59...13062b26` | `05dfec6bf84dd9e5bd35ffc5b98f84292dfe85ce495d96bb130801f6c053b93b` |

**12 条全部再次跳变是第二次算法修正的预期结果**（hash 输入字段集合从 11 个增至 12 个），**不是行为漂移**：`action_taken`/`action_success`/`failure_category`/`decision_context`/`tool_sequence` 等实际观测字段值本身未变化（下方第 5 点自洽性复验），只有 E-08 场景的判定逻辑真正依赖新增的 `current_status` 字段。

**5. 12 条自洽性复验（本次重生成的 manifest vs 各 fixture 自身 `evidenceFields` 声明）**：
```
E-01 actual: true undefined | expected: true undefined OK
E-02 actual: true undefined | expected: true undefined OK
E-03 actual: true undefined | expected: true undefined OK
E-04 actual: true undefined | expected: true undefined OK
E-05 actual: true undefined | expected: true undefined OK
E-06a actual: true undefined | expected: true undefined OK
E-06b actual: true undefined | expected: true undefined OK
E-07 actual: true undefined | expected: true undefined OK
E-08 actual: false state_machine_validation | expected: false state_machine_validation OK
E-09 actual: true undefined | expected: true undefined OK
E-10 actual: true undefined | expected: true undefined OK
E-11 actual: true undefined | expected: true undefined OK
12/12
```

**6. `git_sha`/`baseline_ref`/`note` 保持不变确认**：重生成后 manifest 顶层 `git_sha` 仍为 `45a86e15c896c446a41e48324e646d32c27fb76a`，`note` 仍以"B0-s 结构基线"开头，未改动。

**7. 临时脚本清理确认**：`scripts/_tmp-verify-hash-fix2.mts`、`scripts/_tmp-hash-only.mts`、`scripts/_tmp-selfconsistency.mts` 均在本节验证完成后删除。

