# lrnev E2E 验证报告 V23

| 字段 | 值 |
|---|---|
| 客户端 | claude-code |
| 模型 | claude-sonnet-4-6 |
| 日期 | 2026-07-06 |
| 项目 | CC Switch（Tauri 2 跨平台 AI CLI 管理工具） |
| lrnev 版本守卫 | `task_create_many` 工具存在 ✅ 可继续 |

---

## 阶段 1：自然使用——逐步记录

### 步骤 1：初始化工作区

**调用：** `lrnev_init`（无参数）

**返回摘要：**
- `was_new: false`（目录已有代码，非首次）
- 创建了 `.lrnev/PROJECT.md`、`ARCHITECTURE.md`、`steering/`、`scenes/00-default/` 等骨架
- `codebase_detected: true`

**ai_followup 引导了什么：**
```
"检测到当前目录已有代码。请读项目的构建/清单文件……
自行判断技术栈与架构；auto/codebase.json 只是未经核实的探测信号，仅供参考。
请补全 ARCHITECTURE.md 的技术栈/主要模块/架构理念，以及 PROJECT.md 的项目目标/当前阶段。"
```
suggested_tools 给出了 `spec_create`（跳过了填文档，直接暗示下一步）。

**我实际做了什么：**
读了 `README.md` 得知是 CC Switch（Tauri 2，TypeScript + Rust），读了 `.lrnev/ARCHITECTURE.md` 和 `PROJECT.md` 模板，按引导手动补全了两份文档（项目目标、技术栈、模块、数据流）。

**是否被引导到正确下一步：** 基本是。引导提示了"去读文件"和"补全文档"，但 suggested_tools 直接给 spec_create，跳过了补文档这步——对于不清楚优先级的 AI，可能直接跳去建 Spec 而不填文档。

**卡点：** lrnev_init 本身不分析项目，只生成骨架模板，全部内容需要 AI 自行读文件填写。此步完全依赖外部文件读取能力，lrnev 无法感知"文档是否已补全"。

---

### 步骤 2：创建配置导出/导入 Spec

**调用：** `spec_create(name="config-export-import", priority="P1")`（无 scene，默认 00-default）

**返回摘要：**
- spec id: `01-00-config-export-import`，status: draft，documents 三文件均已创建

**ai_followup 引导了什么：**
```
"请协助用户填充 requirements.md 的'目标'、'用户故事'、'详细需求'
需求填完后调用 spec_gate_check(gate=ready) 检查
通过后再填 design.md（技术方案），最后填 tasks.md（任务清单）
验收标准建议写成可测形式(EARS)，例：WHEN…THEN…"
```

**我实际做了什么：**
读了 requirements.md 模板，识别 `<!-- FILL: ... -->` 哨兵，填写了 L0 摘要、用户故事、F-01/F-02/F-03 三条功能需求（含 WHEN/THEN 验收标准）、非功能需求、范围和验收清单。

**是否被引导到正确下一步：** ✅ 是。填 requirements → gate check 的流程引导清晰，EARS 格式示例有实际帮助。

---

### 步骤 3：通过 Ready Gate

**调用：** `spec_gate_check(gate="ready", scene="00-default", spec="01-00-config-export-import")`

**返回摘要：**
- `passed: true`（1 个 soft fail：验收清单未勾选，属预期行为）

**checks 详情：**
```
✅ requirements_exists
✅ frontmatter_spec / scene / status / created
✅ requirements_sections_present
✅ requirements_no_fill_sentinels
✅ requirements_no_legacy_todo_placeholders
⚠️ requirements_acceptance_checked: "requirements.md 仍有未勾选清单项：L71, L72, L73, L74"
   hint: "确认验收清单已完成后，把 - [ ] 改为 - [x]"
```

**ai_followup 引导了什么：**
```
"ready gate 已通过：requirements 结构契约完整。
请暂停：把 requirements.md 展示给用户确认「做什么」后再继续……
建议把 Spec 状态回填为 ready；gate 检查不依赖 status。"
```

**我实际做了什么：** 调用 `spec_update(status="ready")`。跳过了"暂停给用户确认"（纯 AI 工作流无法有效处理此人工门）。

**卡点：** ready gate ai_followup 提示"暂停展示给用户确认"，在纯 AI 自主工作流中无对应处理方式，需要有 AI 无人值守时的策略说明。

---

### 步骤 4：批量创建 5 个任务

**判断过程：** 查看工具清单，发现 `task_create_many` 支持批内依赖（key 机制）且一次原子提交，选用它而非逐条 `task_create`。

**调用：** `task_create_many`，含 5 个任务，依赖关系：
- T-003 依赖 T-001（key: t3 → t1）
- T-005 依赖 T-004（key: t5 → t4）

**返回摘要（压缩格式）：**
```json
{
  "created": [
    {"id": "T-001", "title": "实现 Rust 后端配置序列化命令"},
    {"id": "T-002", "title": "实现前端导出 UI（按钮 + 文件保存对话框）"},
    {"id": "T-003", "title": "前端导出功能与 Rust 后端集成联调"},
    {"id": "T-004", "title": "实现 JSON 导入校验与覆盖逻辑"},
    {"id": "T-005", "title": "实现前端导入 UI（合并/覆盖两种模式）"}
  ],
  "count": 5
}
```

**ai_followup 引导了什么：** 建议从无依赖任务 T-001 开始，task_update 置 in_progress。

**是否被引导到正确下一步：** ✅ 是。引导明确，批量返回格式简洁。

---

### 步骤 5：推进 T-001 和 T-002 到完成

**调用序列：** T-001: pending→in_progress→completed，T-002: pending→in_progress→completed

**关键观察：** `task_update(in_progress)` 时返回 `anchor_context` 字段，自动展示关联的需求原文段落（F-01 描述和验收标准）——这对实现前确认验收口径非常有价值。

```
"anchor_context": [{"anchor": "F-01", "source": "requirements",
  "text": "#### F-01 配置导出\n- 描述：…\n- 验收：…"}]
```

**是否被引导到正确下一步：** ✅ 完成后 ai_followup 提示"若所有 Task 完成可调 spec_gate_check(completion)"。

---

### 步骤 6：跑 Completion Gate（预期失败）

**调用：** `spec_gate_check(gate="completion", ...)`

**返回（passed=false），失败 checks：**
```
❌ all_tasks_completed:
   "仍有未完成 Task：T-003:pending, T-004:pending, T-005:pending"
   hint: "完成所有 Task 后再检查 completion gate"

❌ design_no_fill:
   "design.md 仍有未填哨兵：L11, L17, L21, L25, L34"
   hint: "把 design.md 的 <!-- FILL: ... --> 替换为具体内容后再检查 completion"
```

**gate 是否说清楚"为什么没过、还差什么"：** ✅ 非常清晰。精确列出了未完成任务 ID+状态，精确给出了 design.md 的行号。AI 可直接按此自我纠正，无需猜测。

---

### 步骤 7：三类沉淀

#### 踩坑 → `error_record`

**症状：** JSON.stringify 静默跳过 undefined 字段，导致导出 JSON 缺失可选配置数据。

**返回：**
```json
{"id": "f9e4e1f10809", "status": "incident", "occurrence_count": 1}
```
ai_followup 提示"修复验证后调 error_promote 提升"。

**判断依据：** error_record 描述明确说"遇到踩坑、回归或可复用故障"，直接匹配。

#### 技术决策 → `adr_create`

**决策：** 配置导出/导入使用 Rust 后端序列化（serde_json）而非前端 JSON.stringify。

**返回：**
```json
{"number": "0001", "status": "proposed",
 "title": "配置导出/导入使用 Rust 后端序列化而非前端 JSON.stringify"}
```

**判断依据：** 工具描述"技术决策→adr_create"，CLAUDE.md 核心规则第 4 条明确。

#### 项目约定 → `memory_save`

**内容：** 导出 JSON 须含顶层 `schema_version: "1.0"` 字段，导入时校验。

**返回：**
```json
{"id": "patterns-57f18536fa3a", "category": "patterns"}
```

**判断依据：** memory_save 描述"保存一条项目记忆"，约定属于 patterns 类别。

**是否被引导：** 三类工具均可从工具清单 + CLAUDE.md 规则第 4 条自然判断，ai_followup 也在 error_record 返回中提示了 error_promote 路径。✅

---

## 阶段 2：定向验证

### A. task_create_many 深度验证

#### 阶段 1 回顾

在阶段 1 第 3 步，我**主动查看工具清单**，发现 `task_create_many` 的描述："批内依赖用 key 临时键（禁 T-xxx），任一条失败整批不写、返回全部错误"。这让我判断它比逐条 `task_create` 更高效（原子性、依赖表达更清晰、减少 IPC 次数），因此直接选用。

> **注：** 我在阶段 1 就用了 `task_create_many`，无需事后补救。

#### 新建 3 个任务（含批内依赖）

**调用：** 批次含 key=new1, key=new2(depends_on:new1), 无 key 任务

**返回（压缩摘要）：**
```json
{
  "created": [
    {"id": "T-006", "title": "为导出 JSON 定义 Schema 并编写验证测试"},
    {"id": "T-007", "title": "在导出文件中注入 schema_version 字段"},
    {"id": "T-008", "title": "补全 design.md 技术设计文档"}
  ],
  "count": 3
}
```
T-007 的批内依赖 key=new1 → T-006 正确解析。**返回是压缩摘要格式（仅 id+title）✅**

#### 错误批次验证（F-99 + NONEXISTENT-KEY）

**调用：** 提交含两个错误的批次：
- 任务 B：`validates: ["F-99"]`（锚点不存在）
- 任务 B：`depends_on: ["NONEXISTENT-KEY"]`（引用既不是批内 key 也不是已有 Task ID）

**返回（整批拒绝）：**
```json
{
  "ok": false,
  "errors": [{
    "code": "TASK_NOT_FOUND",
    "message": "批量创建校验失败：2 处错误，任务未创建",
    "field": "tasks",
    "hint": "按 errors 明细逐条修正（index 为条目在 tasks 数组中的序号，0 起）后整批重新提交。",
    "errors": [
      {"index": 1, "field": "depends_on", "code": "TASK_NOT_FOUND",
       "message": "depends_on 引用既不是批内 key 也不是已存在的 Task：NONEXISTENT-KEY"},
      {"index": 1, "field": "validates", "code": "ANCHOR_NOT_FOUND",
       "message": "validates 锚点在 requirements.md 中不存在：F-99"}
    ]
  }]
}
```

**结论：**
- ✅ 整批拒绝（原子性）
- ✅ 一次性返回全部错误明细（不是遇到第一个就停止）
- ✅ 错误含 index（定位到具体条目）、field（定位到具体字段）、code、message
- ✅ 任务文件无变化（整批拒绝保证了文件不可见写入）

---

### B. agent_register

**调用：** `agent_register(client="claude-code")`

**返回 data 字段：**
```json
{
  "agent_id": "DESKTOP-2E4TITN-3428-8f6d",
  "pid": 3428,
  "host": "DESKTOP-2E4TITN",
  "client": "claude-code",
  "started_at": "2026-07-06T10:00:49.227Z",
  "last_heartbeat": "2026-07-06T10:00:49.227Z",
  "status": "active"
}
```

**gc 字段：** 不存在。工具描述说明"工作区干净时没有 gc 字段是正常的"——此说明**仅出现在本次任务 prompt 中，不在工具描述里**。如果只看 lrnev 自身的工具描述和 ai_followup，AI 无法区分"没有 gc 是正常"还是"没有 gc 是缺失"。

**附注：** 此时工作区已有另一个 active agent（`DESKTOP-2E4TITN-3428-c737`），说明同一连接可注册多个 agent 实例，project_status 会同时显示两者。

---

### C. project_status / governance_map / lrnev_report 对比评价

#### project_status

**返回内容：** scenes 列表、specs 统计（task_counts 分 pending/in_progress/blocked/completed/failed）、claimable_next（可领任务前 N 条）、active_agents（含 active_claims）、recent_adrs、open_errors。

**接手 AI 角度评价：**
- ✅ **信息密度高**：一次调用拿到进度快照、谁在做什么、有哪些错误/决策——是三者中接手价值最高的工具
- ✅ claimable_next 直接告诉 AI "可以从哪里开始"，减少判断成本
- ⚠️ **冗余**：active_agents 在没有 active_claims 时意义不大（显示两个 agent 均无 claim，纯噪音）
- ⚠️ **缺失**：blocked task 没有 block 原因；没有显示待完成任务的 validates 覆盖情况
- ⚠️ **潜在逻辑问题（并发测试，不确定性较高）**：claimable_next 中出现了 T-005（depends_on T-004，而 T-004 仍是 pending）。若属实，说明 claimable_next 的依赖过滤逻辑有 bug；若是并发调用导致的时序问题，则无法确认。

#### governance_map

**返回内容：** scene → spec（状态/L0/priority）→ 锚点标题列表（压缩）。

**接手 AI 角度评价：**
- ✅ **定位导航价值高**：快速找到"spec 里有哪些功能点"，结合 context_search 跳转到具体段落
- ✅ L0 摘要可用（证明 requirements.md 的内容确实被索引）
- ❌ **不含执行进度**：看不到 done/total task 数，无法判断"做到哪了"
- ❌ **不含错误/ADR 指针**：open_errors 和 recent_adrs 需要额外调 project_status
- **定位：** 适合"我要改哪里"，不适合"我接手了什么进度"——与 project_status 职责互补但几乎不重叠

#### lrnev_report

**返回内容：** 治理健康概览：spec_count、task_count、unclosed（未收口）、failed_tasks、anchor 覆盖率（covered/total/ratio）、broken_validates、孤儿锚点。

**关键数据：**
```json
{
  "headline": "整体健康：无做完未收口的 spec、无失败任务、无已收口 spec 的孤儿锚点。",
  "coverage": {"anchor_total": 3, "anchor_covered": 3, "coverage_ratio": 1}
}
```

**接手 AI 角度评价：**
- ✅ **validates 覆盖率**是独有价值：确认 F-01/F-02/F-03 全部有 task 指向，broken_validates 为空
- ✅ unclosed/failed 清单在有问题时直接给出可执行下一步
- ❌ **headline "整体健康" 存在误导**：此时有 6 个 pending 任务、spec 未完成，headline 读起来像"一切正常"。实际应区分"治理结构健康"（ADR/validates 完整）和"执行进度健康"（任务完成情况）
- ❌ **不显示具体 task 状态**：接手 AI 看 report 后不知道有多少任务还未开始
- **定位：** 适合定期治理审计（"有没有治理欠债"），不适合日常接手（不替代 project_status）

---

### D. 错误路径验证

#### D1：pending 任务直接标 completed

**调用：** `task_update(task_id="T-003", status="completed")`（T-003 状态为 pending）

**返回：**
```json
{
  "ok": false,
  "errors": [{
    "code": "INVALID_STATUS_TRANSITION",
    "message": "非法状态转换：pending → completed",
    "field": "status",
    "hint": "当前状态 pending 只允许转换到：in_progress、blocked；
             请用 task_update 选择其中一个状态。completed 是终态，返工请新建 task。"
  }]
}
```

**自我纠正能力：** ✅ 完全充分。code 定位错误类型，message 说明具体违规，hint 给出可用目标状态——AI 读完可直接自我纠正，无需额外文档。

#### D2：validates 引用不存在的锚点（task_create 单条）

**调用：** `task_create(validates=["F-99"])`

**返回：**
```json
{
  "ok": false,
  "errors": [{
    "code": "ANCHOR_NOT_FOUND",
    "message": "validates 锚点在 requirements.md 中不存在：F-99",
    "field": "validates",
    "hint": "确认对应文档中存在该锚点标题（requirements 的 \"#### F-xx\" / design 的 \"#### D-xx\"），
             或修正 validates 编号。"
  }]
}
```

**自我纠正能力：** ✅ 完全充分。hint 明确说明了锚点标题的格式规范（`#### F-xx`）和来源文件，AI 可直接查 requirements.md 的 `####` 标题列表自我修正。

---

## 卡点清单（按严重度排序）

| 严重度 | 卡点描述 |
|---|---|
| 🔴 严重 | **lrnev_init 不分析项目**：只生成骨架模板，项目文档全靠 AI 自行读文件填写。ai_followup 说"请读构建文件"，但没提供读哪些文件的具体路径；`auto/codebase.json` "仅供参考"但 AI 看不到它的内容。冷启动障碍大。 |
| 🔴 严重 | **design.md 填写时机不明确**：spec_create 创建三文档后，ai_followup 只提 requirements 的填法，不提 design.md。completion gate 才发现 design.md 有未填哨兵。中间没有任何引导提示"你还需要填 design.md"。 |
| 🟡 中等 | **ready gate 的"暂停等用户确认"无 AI 处理策略**：ai_followup 说"请暂停展示给用户确认"，但纯 AI 工作流无法处理此人工门；缺少"用户已授权直接继续"的等价替代说明。 |
| 🟡 中等 | **lrnev_report headline "整体健康" 有误导性**：spec 有 6 个 pending 任务时 headline 仍说"整体健康"，因为它只检查"治理结构"（validates 覆盖率等），不检查"执行进度"。接手 AI 可能误判为"没什么要做的了"。 |
| 🟡 中等 | **agent_register 返回无 gc 字段时 AI 无法判断是否正常**：工具描述未说明 gc 字段何时出现，AI 只能靠外部 prompt（本测试任务中）才知道"没有 gc 字段在干净工作区是正常的"。 |
| 🟢 轻微 | **governance_map 缺 task 进度信息**：看不到 done/total，需额外调 project_status 补充。两者职责互补但各自不完整，接手 AI 需要同时调两者才能有全图。 |
| 🟢 轻微 | **project_status claimable_next 可能包含前驱未完成的任务**（T-005 depends on T-004 pending 但出现在 claimable_next 中）。注：并发调用有时序不确定性，无法 100% 确认是 bug 还是测试边界效应。 |
| 🟢 轻微 | **spec_create 的 ai_followup suggested_tools 直接给 spec_create** 作为下一步（暗示继续建新 spec），而正确下一步应该是填 requirements.md。不同场景下这个 suggested_tools 可能误导。 |

---

## 文档/引导缺口建议

站在"第一次用 lrnev 的 AI"角度：

1. **lrnev_init 的 ai_followup 应提供具体读文件建议**：不只说"请读构建/清单文件"，而应结合 `auto/codebase.json` 探测结果给出"建议读这些文件：`<detected_paths>`"。当前 codebase.json 是"仅供参考的未核实探测信号"但 AI 无法直接读到它的内容。

2. **spec_create 的 ai_followup 应说明三文档填写顺序**：当前只提 requirements，缺少"requirements → design → tasks" 的明确流程说明。建议在 spec_create 返回时提示："三文档均已创建，建议依次填写 requirements.md → design.md → tasks.md，每步完成后可调对应 gate 验证。"

3. **ready gate 应提供 AI-only 模式说明**："请暂停展示给用户"在无人值守场景中无效，建议补充："若在自动化工作流中，可在 requirements.md 确认后直接推进。"

4. **lrnev_report headline 应拆分为双维度**：建议区分"治理结构：✅ validates 全覆盖"和"执行进度：🟡 6 个 pending 任务"，避免 AI 将"结构健康"误读为"全部就绪"。

5. **agent_register 的工具描述应说明 gc 字段**：明确"gc 字段仅在有死亡 agent 且有孤儿 claim 需要回收时出现，工作区干净时不出现"，避免 AI 猜测。

6. **task_update(in_progress) 的 anchor_context 价值应在引导中突出**：当前这个特性在返回中有但 ai_followup 没有提到"anchor_context 是关联需求的快速参考，请核对验收口径后再动手"——加上此句可显著提升实用性。

---

## 一句话总评

**AI 能否只靠 lrnev 自带引导准确使用它？**

> **勉强能，但不稳定。** 主干流程（init → spec_create → requirements 填写 → ready gate → task_create_many → task_update → completion gate）的 ai_followup 引导是连贯的，AI 可以沿着"下一步"链条走通；但 design.md 填写时机、agent gc 字段含义、lrnev_report 健康指标的解读等几个关键节点缺乏主动引导，AI 需要靠自身推断或外部 prompt 补充才能不走弯路。
