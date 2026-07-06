# LRNEV E2E V23 - Codex Report

- 客户端: codex-cli
- 模型: gpt-5.5
- 日期: 2026-07-06

## 版本守卫

结论: 通过。工具清单中存在 `task_create_many`。

证据片段:

```text
type task_create_many
一次原子性创建多个 Task。何时用：spec ready 后一次性拆任务清单；补单个仍用 task_create。
批内依赖用 key 临时键(禁 T-xxx)，任一条失败整批不写、返回全部错误。
```

## 阶段 1 逐步记录

### 1. 初始化与接入

调用:

- `lrnev_init(project_name="P0_8_GitHub-Spec-Kit")`
- `context_search(query="project architecture")`
- `read_mcp_resource(context://project)`
- `read_mcp_resource(context://project/architecture)`
- `read_mcp_resource(context://auto/codebase)`
- 读取 `pyproject.toml` 和 3-5 个核心源码/测试文件
- 编辑 `.lrnev/PROJECT.md`、`.lrnev/ARCHITECTURE.md`
- `project_status()`

关键返回:

```json
{
  "was_new": false,
  "codebase_detected": true,
  "ai_followup": {
    "instructions": [
      "检测到当前目录已有代码。请读项目的构建/清单文件...与 3-5 个核心源码文件，自行判断技术栈与架构；auto/codebase.json 只是未经核实的探测信号，仅供参考。请补全 ARCHITECTURE.md ... PROJECT.md ...",
      "请先阅读 context://project 和 context://project/architecture...",
      "可以直接调用 spec_create；不传 scene 时会挂到 00-default。"
    ]
  }
}
```

是否被引导到正确下一步: 基本是。`lrnev_init` 明确引导我分析项目并补全项目档案，我实际读取了治理 context、`pyproject.toml`、CLI 入口、集成注册、资产定位、工具检测测试，并补全了 `PROJECT.md` / `ARCHITECTURE.md`。

卡点:

- init 告诉我要补项目档案，但没有提供“写项目档案”的专用工具或说明，只能直接编辑文件。
- `project_status()` 在刚 init 后返回 `scenes: []`，但 `scene_list()` 后续能看到 `00-default`。对首次接手者来说，空 scene 快照容易让人误以为默认 scene 不存在。
- CodeGraph 查询项目时超时；这不是 lrnev 的问题，但影响了按 init 引导“读核心源码”的体验。

### 2. 创建 `specify doctor` Spec 并通过 ready gate

调用:

- `assess_goal(...)`
- `spec_create(name="specify-doctor", priority="P1")`
- 编辑 `requirements.md`
- `spec_gate_check(gate="ready")`
- 修正章节标题与验收清单
- 再次 `spec_gate_check(gate="ready")`
- `spec_update(status="ready")`
- 编辑 `design.md`

关键返回 1: `assess_goal` 保守判定为 multi-spec。

```json
{
  "kind": "multi-spec-program",
  "confidence": "medium",
  "reasons": ["目标列举了 4 个并列项，可能是多个可交付特性"],
  "ai_followup": {
    "instructions": ["评估结果是 multi-spec-program，请和用户确认这个拆分粒度是否正确。"]
  }
}
```

我没有中断询问，因为用户本轮已经明确要求“规划一个真实的小特性”。这是靠外部任务说明做出的判断，不完全是 lrnev 自身引导。

关键返回 2: `spec_create` 后续指引。

```json
{
  "spec": "01-00-specify-doctor",
  "scene": "00-default",
  "status": "draft",
  "ai_followup": {
    "instructions": [
      "请协助用户填充 requirements.md 的\"目标\"、\"用户故事\"、\"详细需求\"",
      "需求填完后调用 spec_gate_check(gate=ready) 检查",
      "通过后再填 design.md（技术方案），最后填 tasks.md（任务清单）",
      "验收标准建议写成可测形式(EARS)..."
    ]
  }
}
```

第一次 ready gate 失败:

```json
{
  "passed": false,
  "checks": [
    {
      "name": "requirements_sections_present",
      "passed": false,
      "message": "requirements.md 缺少必填章节：L0 摘要, L1 概览, L2 详情, 范围, 详细需求, 验收标准",
      "hint": "章节标题必须与模板完全一致（中文原文：L0 摘要 / L1 概览 / L2 详情 / 范围 / 详细需求 / 验收标准），不要翻译或改名..."
    },
    {
      "name": "requirements_acceptance_checked",
      "passed": false,
      "message": "requirements.md 仍有未勾选清单项：L82, L83, L84, L85, L86",
      "hint": "确认验收清单已完成后，把 - [ ] 改为 - [x]"
    }
  ]
}
```

修正后 ready gate 通过:

```json
{
  "gate": "ready",
  "passed": true,
  "ai_followup": {
    "instructions": [
      "ready gate 已通过：requirements 结构契约完整。",
      "请暂停：把 requirements.md 展示给用户确认「做什么」后再继续...",
      "建议把 Spec 状态回填为 ready；gate 检查不依赖 status。"
    ]
  }
}
```

是否被引导到正确下一步: 大体正确。失败后的 hint 非常清楚。但“章节标题不能翻译”和“ready 阶段验收清单要勾选”是 gate 失败后才知道的，事前引导不足。

### 3. 创建 5 个任务

调用:

- `task_create_many(...)`

我使用的是 `task_create_many`，因为工具描述明确说它适合 “spec ready 后一次性拆任务清单”。批内依赖用 key 表达: T-003 依赖 T-001，T-005 依赖 T-004。

返回证据:

```json
{
  "ok": true,
  "data": {
    "created": [
      {"id": "T-001", "title": "Wire `specify doctor` Typer command"},
      {"id": "T-002", "title": "Implement tool and agent CLI diagnostics"},
      {"id": "T-003", "title": "Implement template availability diagnostics"},
      {"id": "T-004", "title": "Implement diagnostic summary and exit status"},
      {"id": "T-005", "title": "Add doctor command tests"}
    ],
    "count": 5
  },
  "ai_followup": {
    "instructions": [
      "5 个任务已创建（T-001..T-005），状态均为 pending",
      "建议从无依赖任务 T-001 开始：task_update 置 in_progress"
    ]
  }
}
```

是否被引导到正确下一步: 是。返回直接指出从 T-001 开始并用 `task_update` 置 `in_progress`。

### 4. 推进 2 个任务并跑 completion gate

调用:

- `spec_update(status="in-progress")`
- `task_update(T-001, status="in_progress")`
- `task_update(T-001, status="completed")`
- `task_update(T-002, status="in_progress")`
- `task_update(T-002, status="completed")`
- `spec_gate_check(gate="completion")`

T-001 进入 in_progress 后返回锚点上下文:

```json
{
  "id": "T-001",
  "status": "in_progress",
  "anchor_context": [
    {
      "anchor": "F-01",
      "source": "requirements",
      "text": "#### F-01 Doctor Command Entry Point..."
    },
    {
      "anchor": "D-01",
      "source": "design",
      "text": "#### D-01 CLI Command Wiring..."
    }
  ],
  "ai_followup": {
    "instructions": [
      "Task \"T-001\" 已进入 in_progress。返回里若有 anchor_context / summary_context，先看它..."
    ]
  }
}
```

T-001 完成后:

```json
{
  "id": "T-001",
  "status": "completed",
  "ai_followup": {
    "instructions": [
      "Task \"T-001\" 已完成",
      "若该 Spec 的所有 Task 都完成，可调 spec_gate_check(gate=completion) 验收"
    ]
  }
}
```

completion gate 失败符合预期:

```json
{
  "gate": "completion",
  "passed": false,
  "checks": [
    {
      "name": "all_tasks_completed",
      "passed": false,
      "message": "仍有未完成 Task：T-003:pending, T-004:pending, T-005:pending",
      "hint": "完成所有 Task 后再检查 completion gate"
    }
  ],
  "ai_followup": {
    "instructions": [
      "completion gate 未通过...",
      "all_tasks_completed: 仍有未完成 Task：T-003:pending, T-004:pending, T-005:pending；建议：完成所有 Task 后再检查 completion gate"
    ]
  }
}
```

是否说清楚为什么没过、还差什么: 是。它明确列出 T-003/T-004/T-005 仍是 pending，并给出下一步。

### 5. 三类沉淀

调用:

- `error_record(...)`
- `adr_create(...)`
- `memory_save(...)`

踩坑记录:

```json
{
  "id": "ff7a2db303b7",
  "status": "incident",
  "scope": "scene:00-default",
  "body": {
    "symptom": "Ready gate failed after requirements.md headings were translated to English.",
    "root_cause": "lrnev gate checks required exact template section titles...",
    "fix_action": "Restore the required Chinese section headings..."
  },
  "ai_followup": {
    "instructions": [
      "错误已记录到 incidents：ff7a2db303b7",
      "修复被验证后，请调用 error_promote..."
    ]
  }
}
```

ADR:

```json
{
  "number": "0001",
  "title": "Use local deterministic checks for specify doctor",
  "status": "proposed",
  "scope": "scene:00-default",
  "ai_followup": {
    "instructions": [
      "ADR 0001 已创建...",
      "请检查 context / decision / alternatives / consequences 是否完整。"
    ]
  }
}
```

Memory:

```json
{
  "id": "patterns-18417cb53ed2",
  "category": "patterns",
  "scope": "scene:00-default",
  "content": "When editing lrnev-generated spec documents, preserve the exact template section headings..."
}
```

是否被引导到正确下一步: 是。三类工具职责清晰。`error_record` 在我已经提供 verification 的情况下仍提示 promote 前必须补证据，略显重复但不阻塞。

## 阶段 2 结论

### A. `task_create_many` 回顾与验证

阶段 1 第 3 步我使用了 `task_create_many`，不是逐条 `task_create`。原因是工具描述明确写了“spec ready 后一次性拆任务清单”，且支持批内 key 依赖。

再次创建 3 个任务，批内第 2 条依赖第 1 条:

```json
{
  "ok": true,
  "data": {
    "created": [
      {"id": "T-006", "title": "Refine doctor diagnostic result model"},
      {"id": "T-007", "title": "Define doctor output grouping"},
      {"id": "T-008", "title": "Draft doctor usage documentation note"}
    ],
    "count": 3
  },
  "ai_followup": {
    "instructions": ["3 个任务已创建（T-006..T-008），状态均为 pending"]
  }
}
```

结论: 返回是压缩摘要，只有 `created` 列表和 `count`，没有展开完整任务正文。

错误批次验证:

```json
{
  "ok": false,
  "errors": [
    {
      "code": "ANCHOR_NOT_FOUND",
      "message": "批量创建校验失败：2 处错误，任务未创建",
      "field": "tasks",
      "hint": "按 errors 明细逐条修正（index 为条目在 tasks 数组中的序号，0 起）后整批重新提交。",
      "errors": [
        {
          "index": 0,
          "field": "validates",
          "code": "ANCHOR_NOT_FOUND",
          "message": "validates 锚点在 requirements.md 中不存在：F-99"
        },
        {
          "index": 1,
          "field": "depends_on",
          "code": "TASK_NOT_FOUND",
          "message": "depends_on 引用既不是批内 key 也不是已存在的 Task：missing-key"
        }
      ]
    }
  ]
}
```

任务文件无变化验证:

```text
before SHA256: 7626CCDDD7D79819D7B714D1F369B4D1539F98EBE703B3B04B4E2B25F4C238C1
after  SHA256: 7626CCDDD7D79819D7B714D1F369B4D1539F98EBE703B3B04B4E2B25F4C238C1
```

结论: ✅ 整批拒绝、一次性返回全部错误明细、任务文件未变化。

### B. `agent_register` 的 `gc` 字段

调用:

- `agent_register(agent_id="codex-e2e-v23", client="codex-cli")`

返回:

```json
{
  "ok": true,
  "data": {
    "agent_id": "codex-e2e-v23",
    "pid": 38780,
    "host": "DESKTOP-2E4TITN",
    "client": "codex-cli",
    "started_at": "2026-07-06T10:10:53.647Z",
    "last_heartbeat": "2026-07-06T10:10:53.647Z",
    "status": "active"
  }
}
```

结论: `data` 中没有 `gc` 字段。按题设，工作区干净时没有 `gc` 字段是正常情况。

### C. `project_status` / `governance_map` / `lrnev_report` 接手评价

`project_status()` 证据:

```json
{
  "scenes": [{"id": "00-default", "name": "default", "spec_count": 1}],
  "specs": [
    {
      "spec": "01-00-specify-doctor",
      "status": "in-progress",
      "task_counts": {
        "pending": 6,
        "in_progress": 0,
        "blocked": 0,
        "completed": 2,
        "failed": 0
      },
      "free_tasks_count": 6,
      "claimable_next": [
        {"id": "T-003", "title": "Implement template availability diagnostics"},
        {"id": "T-004", "title": "Implement diagnostic summary and exit status"},
        {"id": "T-005", "title": "Add doctor command tests"},
        {"id": "T-006", "title": "Refine doctor diagnostic result model"},
        {"id": "T-007", "title": "Define doctor output grouping"}
      ]
    }
  ],
  "recent_adrs": [{"number": "0001", "title": "Use local deterministic checks for specify doctor"}],
  "open_errors": [{"id": "ff7a2db303b7", "status": "incident"}]
}
```

评价: 对接手很有用，能看到 spec 状态、任务计数、可领任务、active agents、ADR、open errors。缺口是 `free_tasks_count=6` 但 `claimable_next` 只列 5 条，输出没有说明是否被截断；刚 init 时也没有列空的 `00-default`。

`governance_map()` 证据:

```json
{
  "scenes": [
    {
      "scene": "00-default",
      "specs": [
        {
          "spec": "01-00-specify-doctor",
          "status": "in-progress",
          "l0": "Add a `specify doctor` subcommand...",
          "anchors": [
            "#### F-01 Doctor Command Entry Point",
            "#### F-02 Git Diagnostic",
            "#### F-03 AI Agent CLI Diagnostics",
            "#### F-04 Template Availability Diagnostics",
            "#### F-05 Exit Status and Summary",
            "#### D-01 CLI Command Wiring",
            "#### D-02 Tool Checks",
            "#### D-03 Template Checks",
            "#### D-04 Result Model and Exit Code",
            "#### D-05 Tests"
          ]
        }
      ]
    }
  ],
  "ai_followup": {
    "instructions": [
      "这是治理全景（scene→spec→锚点标题）。按需用 context://spec/<scene>/<spec> 或 context_search 跳到具体段落，别全文通读。"
    ]
  }
}
```

评价: 很适合快速理解治理结构和需求/设计锚点，避免全文通读。缺口是没有任务状态、未完成项、open errors；需要配合 `project_status`。

`lrnev_report(release_notes=true)` 证据:

```json
{
  "headline": "整体健康：无做完未收口的 spec、无失败任务、无已收口 spec 的孤儿锚点。",
  "chain": {
    "scene_count": 1,
    "spec_count": 1,
    "task_count": 8,
    "unclosed": [],
    "failed_tasks": [],
    "blocked_tasks": []
  },
  "coverage": {
    "anchor_total": 10,
    "anchor_covered": 10,
    "coverage_ratio": 1,
    "broken_validates": []
  },
  "release_notes": {"scenes": []}
}
```

评价: 很适合体检 validates 覆盖率和治理债。缺口是 headline 容易让第一次接手者误以为项目已经“健康完成”，但其实当前 spec 仍 `in-progress` 且有 6 个 pending 任务。它检查的是治理债，不是交付完成度，这一点需要在输出里更显眼。

### D. 错误路径

错误路径 1: pending 任务直接标 completed。

调用:

- `task_update(T-003, status="completed")`

返回:

```json
{
  "ok": false,
  "errors": [
    {
      "code": "INVALID_STATUS_TRANSITION",
      "message": "非法状态转换：pending → completed",
      "field": "status",
      "hint": "当前状态 pending 只允许转换到：in_progress、blocked；请用 task_update 选择其中一个状态。completed 是终态，返工请新建 task。"
    }
  ]
}
```

结论: ✅ 足以自我纠正。code、message、hint 都明确，hint 直接给出允许状态。

错误路径 2: 创建任务时 `validates` 引用不存在锚点。

调用:

- `task_create(..., validates=["F-99"])`

返回:

```json
{
  "ok": false,
  "errors": [
    {
      "code": "ANCHOR_NOT_FOUND",
      "message": "validates 锚点在 requirements.md 中不存在：F-99",
      "field": "validates",
      "hint": "确认对应文档中存在该锚点标题（requirements 的 \"#### F-xx\" / design 的 \"#### D-xx\"），或修正 validates 编号。"
    }
  ]
}
```

结论: ✅ 足以自我纠正。它明确说明锚点必须来自 `requirements` 的 `#### F-xx` 或 `design` 的 `#### D-xx`。

## 卡点清单

1. 严重: requirements/design 模板标题必须保持中文原文，但这个约束在我编辑前没有主动提示。第一次 ready gate 失败后 hint 很清楚，但首次使用者容易先走错。
2. 严重: `assess_goal` 把一个用户明确指定的“小特性”判为 multi-spec，并要求向用户确认。它没有给出“用户已明确要求按单 Spec 演练时如何继续”的处理建议。
3. 中等: init 引导要求补 `PROJECT.md` / `ARCHITECTURE.md`，但没有提供对应更新工具或明确说“直接编辑这些文件”。我靠文件编辑完成。
4. 中等: ready gate 要求把验收清单从 `- [ ]` 改为 `- [x]`。对“需求阶段”的语义来说，这看起来像已经验收完成，容易误解。
5. 中等: `project_status` 初始时没有列出空的 `00-default`，后续 `scene_list` 才显示；第一次接手时可能误判工作区结构。
6. 轻微: `project_status` 的 `claimable_next` 比 `free_tasks_count` 少，但未说明列表是否截断或截断上限。
7. 轻微: 多个 `ai_followup` 建议 `summarize_save`，但本轮常规工具发现流程里没有主动暴露该工具；如果它不是默认工具，建议 followup 不要直接推荐不可用工具，或说明需要额外开启。
8. 轻微: `error_record` 在传入 verification 后仍提示 promote 前必须补充证据，提示语略重复。

## 文档/引导缺口建议

- 在 `spec_create` 的 `ai_followup` 中明确写: 不要翻译或改名模板章节标题，ready gate 会按中文标题精确匹配。
- 在 requirements 模板中说明 ready gate 对验收清单的勾选语义，例如“这里的 [x] 表示需求确认，不表示实现完成”。
- 提供 `project_profile_update` / `spec_doc_update` 一类治理文档写入工具，或在引导中明确“请直接编辑生成的 markdown 文件”。
- `assess_goal` 返回 multi-spec 时增加 override 分支: 如果用户已明确要求单个小特性，可继续 `spec_create` 并记录判断依据。
- `project_status` 对空 scene 的处理需要说明，或列出 `00-default` 即使 spec_count=0。
- `project_status` 若截断 `claimable_next`，应返回 `limit` / `truncated` / `remaining_count`。
- `lrnev_report` 的 headline 建议强调“治理债健康”而不是泛化成“整体健康”，避免和“交付是否完成”混淆。
- `ai_followup.suggested_tools` 建议只推荐当前 MCP 实际暴露的工具，或附带“如工具已启用”的提示。

## 一句话总评

AI 可以靠 lrnev 的工具描述、`ai_followup` 和错误 hint 走通核心状态机，但还不能完全准确无猜地完成首次接入和文档填充；最主要缺口是模板结构约束和“何时可以覆盖确认建议”的引导不够前置。
