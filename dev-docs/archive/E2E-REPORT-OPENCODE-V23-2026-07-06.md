# LRNEV E2E 测试报告 V23

- **客户端**: opencode
- **模型**: deepseek-v4-pro
- **日期**: 2026-07-06
- **项目**: anthropics/skills（Agent Skills 示例仓库，17 个 Skill 目录）

---

## 阶段 1：自然使用

### 步骤 1.1 — 初始化治理工作区

**调用**: `lrnev_init{project_name:"agent-skills"}`

**返回摘要**:
- `was_new: false`（`.lrnev/` 已存在骨架目录 `agents/` + `locks/`）
- 创建了 9 个文件（PROJECT.md, ARCHITECTURE.md, steering/*, config/hooks.json, scenes/00-default/scene.md）
- `codebase_detected: true`，但 auto/codebase.json 中 `tech_stack: []`、`primary_language: "unknown"`

**ai_followup 引导**:
> "检测到当前目录已有代码。请读项目的构建/清单文件（如 pom.xml、build.gradle、package.json、go.mod、pyproject.toml 等，按实际为准且不限于这些）与 3-5 个核心源码文件，自行判断技术栈与架构；auto/codebase.json 只是未经核实的探测信号，仅供参考。请补全 ARCHITECTURE.md 的技术栈/主要模块/架构理念，以及 PROJECT.md 的项目目标/当前阶段。"

**AI 实际做了什么**: 
- 读取了 PROJECT.md（含 FILL 占位）、ARCHITECTURE.md（含 FILL 占位）、auto/codebase.json
- 扫描了 `skills/*/SKILL.md`（17 个），采样了 3 个 SKILL.md 查看 frontmatter 结构
- 补齐了 PROJECT.md 的 L0/L1 摘要和 ARCHITECTURE.md 的技术栈/模块列表

**评价**: ✅ lrnev 明确引导了"分析项目→补全档案"——指出 auto/codebase.json 不可靠、要求 AI 自行读源码判断、给出了具体锚点（ARCHITECTURE.md 的技术栈/主要模块/架构理念，PROJECT.md 的项目目标/当前阶段）。引导是到位的。

---

### 步骤 1.2 — 创建特性治理档案

**调用**: `spec_create{name:"skill-frontmatter-validator", priority:"P1"}`

**返回摘要**:
- Spec ID: `01-00-skill-frontmatter-validator`，挂到 `00-default`
- status: `draft`，三文档（requirements/design/tasks）均已创建

**ai_followup 引导**:
> "请协助用户填充 requirements.md 的"目标"、"用户故事"、"详细需求"；需求填完后调用 spec_gate_check(gate=ready) 检查；通过后再填 design.md（技术方案），最后填 tasks.md（任务清单）"

分流提醒也出现了：
> "若这其实是给已完成特性加的小增量，通常该 context_search 找到对应 spec 用 task_create 落位、而非新开"

**AI 实际做了什么**:
- 填充 requirements.md：L0 摘要、目标、用户故事、4 个 F-xx 功能项（含 EARS 验收条件）、非功能需求（性能/兼容性）、边界依赖、验收标准
- 运行 `spec_gate_check(gate=ready)` → **通过**（9/10 checks passed，1 soft fail：验收清单未勾选，属预期）
- 调 `spec_update(status=ready)`

**评价**: ✅ 引导链完整：create → fill requirements → gate_check(ready) → update status。分流提醒（"该不该新开 spec"）也是有用的护栏。验收标准格式建议（EARS）也明确给出。

---

### 步骤 1.3 — 创建 5 个任务（含依赖关系）

**选用工具**: `task_create_many` — 一口原子批次创建全部 5 个任务。

**依赖设计**:
| Task | 依赖 | validates |
|------|------|-----------|
| T-001 (key:a) 项目骨架搭建 | 无 | F-04 |
| T-002 (key:b) Frontmatter 解析模块 | 无 | F-01, F-02 |
| T-003 (key:c) 字段校验逻辑 | depends_on: ["a"] | F-01, F-02 |
| T-004 (key:d) 报告生成模块 | 无 | F-03 |
| T-005 (key:e) 退出码与 CI 集成 | depends_on: ["d"] | F-04 |

**返回是压缩摘要**:
```json
"created": [
  {"id": "T-001", "title": "项目骨架搭建"},
  {"id": "T-002", "title": "Frontmatter 解析模块"},
  ...
],
"count": 5
```

**为什么选了 task_create_many**: 在工具清单中看到了 `task_create_many`，其描述为"一次原子性创建多个 Task"，且有 `key` 参数支持批内依赖引用。对于 5 个任务且有交叉依赖的场景，这是最自然高效的选择。

**评价**: ✅ ai_followup 引导从无依赖任务开始（"建议从无依赖任务 T-001 开始"）。

---

### 步骤 1.4 — 推进 2 个任务到完成，跑完成门禁

**操作**: 
1. `task_update(T-001, in_progress)` → `task_update(T-001, completed)` ✅
2. `task_update(T-002, in_progress)` → `task_update(T-002, completed)` ✅
3. `spec_gate_check(gate=completion)` → **未通过**

**完成门禁返回**:
```
❌ all_tasks_completed (hard_fail)
   "仍有未完成 Task：T-003:pending, T-004:pending, T-005:pending"
   hint: "完成所有 Task 后再检查 completion gate"

❌ design_no_fill (hard_fail)
   "design.md 仍有未填哨兵：L11, L17, L21, L25, L34"
   hint: "把 design.md 的 <!-- FILL: ... --> 替换为具体内容后再检查 completion"
```

**评价**: ✅ 门禁反馈非常清晰——逐条列出未通过项、具体到 Task ID 和行号、给出修复方向。

---

### 步骤 1.5 — 三类沉淀

| 类型 | 工具 | 内容 | 结果 |
|------|------|------|------|
| 踩坑记录 | `error_record` | "pending→completed 跳步被拒" | incident `5472d0fabe3e`，ai_followup 引导 "验证后 promote" |
| 技术选型 ADR | `adr_create` | "Python vs Bash for validator" | ADR `0001`，scope=scene:00-default，含 alternatives + consequences |
| 项目约定 | `memory_save` | "EARS 格式验收标准" | patterns 记忆 `patterns-4a0192aecf74` |

**评价**: ✅ 三类工具各自正确落盘。error_record 的 ai_followup 正确提示了 `error_promote` 的下一步。

---

## 阶段 2：定向验证

### A. task_create_many 回顾与验证

**A.1 — 阶段 1 第 3 步确认**：已使用 `task_create_many`，未用逐条 `task_create`。

**A.2 — 批内 key 依赖验证**：
```json
// 创建 3 个任务，第 2 条用 key 依赖第 1 条
tasks: [
  {"key":"x","title":"Phase2 验证任务X","validates":["F-01"]},
  {"key":"y","title":"Phase2 验证任务Y","depends_on":["x"],"validates":["F-01"]},
  {"key":"z","title":"Phase2 验证任务Z","validates":["F-03"]}
]
// 返回压缩摘要（仅 id + title）：
"created": [
  {"id":"T-006","title":"Phase2 验证任务X"},
  {"id":"T-007","title":"Phase2 验证任务Y"},
  {"id":"T-008","title":"Phase2 验证任务Z"}
]
```

✅ key 依赖正确解析，返回确为压缩摘要。

**A.3 — 错误批次的原子回滚验证**：
```json
// 故意提交含 2 个错误的批次
tasks: [
  {"key":"bad1","title":"正常任务A","validates":["F-01"]},
  {"key":"bad2","title":"错误-不存在锚点","validates":["F-99"]},
  {"key":"bad3","title":"错误-不存在依赖","depends_on":["NONEXISTENT"]}
]
```

**返回**:
```json
{
  "ok": false,
  "errors": [{
    "code": "ANCHOR_NOT_FOUND",
    "message": "批量创建校验失败：2 处错误，任务未创建",
    "hint": "按 errors 明细逐条修正（index 为条目在 tasks 数组中的序号，0 起）后整批重新提交。",
    "errors": [
      {"index": 1, "field": "validates", "code": "ANCHOR_NOT_FOUND",
       "message": "validates 锚点在 requirements.md 中不存在：F-99"},
      {"index": 2, "field": "depends_on", "code": "TASK_NOT_FOUND",
       "message": "depends_on 引用既不是批内 key 也不是已存在的 Task：NONEXISTENT"}
    ]
  }]
}
```

✅ **验证通过**:
- 整批拒绝（`任务未创建`）
- 一次性返回全部 2 条错误明细（index + field + code + message）
- task_list 确认无 T-009/T-010/T-011 残留（共 8 个任务 = 5+3 合法批次）
- hint 给出了明确的修正方式（按 index 修正后整批重新提交）

---

### B. agent_register

```json
{
  "agent_id": "DESKTOP-2E4TITN-27844-229e",
  "pid": 27844,
  "host": "DESKTOP-2E4TITN",
  "client": "opencode-test",
  "started_at": "2026-07-06T10:01:14.831Z",
  "status": "active"
}
```

✅ 返回 data 中无 `gc` 字段——工作区干净时没有 gc 字段，符合预期。ai_followup 引导了 task_claim 的下一步。

---

### C. 三工具对比：project_status / governance_map / lrnev_report

| 维度 | project_status | governance_map | lrnev_report |
|------|---------------|----------------|--------------|
| **场景/Spec 概览** | ✅ 含 status/priority/任务计数 | ✅ 含 L0 摘要 + 锚点标题 | ✅ 含场景统计 |
| **任务详情** | ✅ 含 claimable_next（可领任务列表） | ❌ 不含 | ✅ 含 task_count |
| **ADR/错误** | ✅ recent_adrs + open_errors 数组 | ❌ 不含 | ❌ 不含 |
| **活跃 Agent** | ✅ active_agents + claims | ❌ 不含 | ❌ 不含 |
| **覆盖率** | ❌ 不含 | ✅ 锚点标题（可跳转） | ✅ coverage_ratio + 孤儿检测 |
| **健康诊断** | ❌ 不含 | ❌ 不含 | ✅ headline + unclosed/failed/blocked |

**接手评价**:
- **project_status** — 接手首选。给全貌：scene/spec/task 状态、谁在线（agents）、有什么历史决策（ADRs）和坑（errors）、可领什么任务（claimable_next）。`ai_followup` 中 "project_status 只做接手概览，不废弃 scene_list/spec_list" 的说明消除了"是不是该用更细工具"的疑虑。
- **governance_map** — 导航地图。唯一带 L0 摘要和锚点标题的工具，适合"我只想跳到一个具体需求段"。但如果只给这个，接手者不知道有 ADR/错误/agent——缺位太多。
- **lrnev_report** — 体检报告。专注健康/覆盖率，不重复 ADR/agent/错误信息。和 project_status 职责边界清晰，但 headline "整体健康" 在单 spec 场景下信息量低。

**冗余**: project_status 的 scenes/specs 列表与 governance_map 有重叠（都列 scene/spec 名称和 status）。但 project_status 多了任务计数和 agent/错误，governance_map 多了 L0 和锚点——所以不是纯冗余，各有侧重。

**缺口**: 没有一个工具能直接回答"这个 Spec 的 requirements.md 正文是什么"——`context_search` 和 `spec_get` 是深层工具。但这对"接手快照"来说是合理的分层设计。

---

### D. 错误路径验证

**D.1 — pending 直接标 completed（跳步）**:
```json
{
  "ok": false,
  "errors": [{
    "code": "INVALID_STATUS_TRANSITION",
    "message": "非法状态转换：pending → completed",
    "hint": "当前状态 pending 只允许转换到：in_progress、blocked；请用 task_update 选择其中一个状态。completed 是终态，返工请新建 task。"
  }]
}
```

✅ **足以自我纠正**: code 精确描述问题、message 点明非法转换、hint 枚举了所有合法目标状态 + 警告 completed 是终态。

**D.2 — validates 引用不存在的锚点**:
```json
{
  "ok": false,
  "errors": [{
    "code": "INVALID_INPUT",
    "message": "批量创建校验失败：1 处错误，任务未创建",
    "hint": "按 errors 明细逐条修正（index 为条目在 tasks 数组中的序号，0 起）后整批重新提交。",
    "errors": [{
      "index": 0, "field": "validates", "code": "INVALID_INPUT",
      "message": "validates 只接受 F-xx / D-xx 锚点：F-NONEXISTENT"
    }]
  }]
}
```

✅ **足以自我纠正**: 明确告知格式约束（F-xx / D-xx），但注意——这里 code 是 `INVALID_INPUT` 而非 `ANCHOR_NOT_FOUND`。这是因为 `F-NONEXISTENT` 连格式都不对（不是数字）。对比阶段 2A.3 中 `F-99` 的 `ANCHOR_NOT_FOUND`（格式对但不存）。**两者区分合理**——格式错误和内容错误分属不同 code。

---

## 卡点清单（按严重度排序）

| # | 严重度 | 描述 | 影响 |
|---|--------|------|------|
| 1 | 🟡 中 | `spec_gate_check(ready)` 对未勾选验收清单的提示是 soft_fail，但 ai_followup 语气是"通过"——可能导致 AI 在验收标准未确认时就进入实施 | AI 可能跳过用户确认 |
| 2 | 🟡 中 | `task_create_many` 的压缩摘要只返回 id+title，不返回 depends_on/validates/acceptance。AI 需要额外调 `task_list` 确认依赖是否正确解析 | 多一步往返 |
| 3 | 🟢 低 | `lrnev_init` 返回 `was_new: false` 但实际是新项目——因为 `.lrnev/` 下已有 `agents/` 和 `locks/` 空目录（可能是 IDE/MCP 初始化残留）。AI 会困惑"到底 init 过没有" | 轻微歧义 |
| 4 | 🟢 低 | `governance_map` 不含 ADR/错误/agent 信息——接手者如果只看这个会漏掉决策历史和已知问题 | 导航工具定位问题 |

---

## 文档/引导缺口建议

站在**第一次用 lrnev 的 AI** 角度：

1. **缺少 "init 后第一步" 的强化引导**：ai_followup 说了"读构建文件 → 补全 PROJECT.md/ARCHITECTURE.md"，但没有明确说"你现在就应该做这件事，这是 init 后必须完成的步骤"。可以考虑在 init 返回里加一句类似 "⏩ 你的下一步：补全 PROJECT.md 和 ARCHITECTURE.md（这是接入完成的标志）"。

2. **缺少 `task_create_many` 的推荐提示**：当 AI 用逐条 `task_create` 创建 ≥3 个任务时，ai_followup 可以提一句 "提示：≥3 个任务可用 task_create_many 一次原子创建"。当前 `task_create` 的返回没有这类提示。

3. **memory_save 的分类指引不够具体**：5 个分类（preferences/decisions/patterns/errors/facts）之间的边界对 AI 来说不够直观。例如 "EARS 格式约定" 归 patterns 还是 preferences？可以在工具描述或 lrnev_guide 的 concepts 里给一组典型例子。

4. **缺少"现在该干什么"的全局状态灯**：project_status 给了全貌但没给 "你应该做的下一件事"。比如 "2 tasks completed, 6 pending, 0 in_progress → 建议从 T-003 开始" 只在每个 task_update 返回里提了，但如果 AI 中断后回来，project_status 没有这种主动建议。

---

## 一句话总评

**AI 能仅靠 lrnev 自带引导准确使用它吗？**

**能**。从 init → spec_create → gate_check → task_create_many → task_update → completion gate → error_record/adr_create/memory_save，每一步的 `ai_followup` 都给出了正确的下一工具和参数模板。状态机违规和锚点错误都有足以自我纠正的报错信息。少数卡点（压缩摘要缺字段、分类边界模糊）不影响主干流程的正确性。
