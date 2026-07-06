# lrnev v2.1.0 E2E Walkthrough Report - Codex

- Client: codex-cli
- Model: gpt-5.5
- Time: 2026-06-17 09:30 Asia/Shanghai
- CLI: `lrnev --version` -> `2.1.0`
- Node: `v22.17.1`
- Workspaces:
  - Empty: `E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty`
  - Real project: `E:/project/.lrnev/lrnev-cli/research/P0_5_Aider` (created `.lrnev` during test, then removed it; final `Test-Path .../.lrnev` -> `False`)

## Stage Summary

| Stage | Result | Notes |
|---|---:|---|
| 0 Environment/cold start | ✅ | Version guard passed; CLI help has `map`; true MCP stdio `initialize` reports `lrnev@2.1.0`; `tools/list` has `governance_map`. |
| 1 Init | ⚠️ | Init/idempotence works and codebase detection works. Deviation: fresh init ensures `.lrnev/config/` but does not create `.lrnev/config/hooks.json`, though walkthrough expects it. |
| 2 Scene | ✅ | create/list/get/name/id/number paths work. One parallel write/read attempt caused transient misses, so same-workspace write ops should be run sequentially. |
| 3 Spec lifecycle | ⚠️ | create/default scene/ready gate/template contract/status transitions work. CLI `gate check --json` prints only gate data, while MCP wraps `ok/data/ai_followup`; demand-review followup is visible via MCP. |
| 4 Task lifecycle | ✅ | task create/update/claim/release/list and invalid validates/depends_on/status paths behaved as expected. |
| 5 Completion gate | ✅ | incomplete task, `design_no_fill`, missing `design.md`, and final completion pass all matched expectations. |
| 6 anchor_context / summary_context | ✅ | `task_update` and `task_claim` both return context. Long F truncates at sentence boundary; D returns title + first physical line. |
| 7 Four-way routing | ✅ | spec_create followup and server instructions include existing-spec landing, existing scene, new scene only when clear/user-confirmed, 00-default fallback/no spec guidance. |
| 8 Search/map | ⚠️ | BM25 and anchor snippets work. Deviation: `map` includes non-empty 00-default; this is reasonable, but empty 00-default exclusion was not observable after quick spec creation. Empty scene `02-payment` appears with `specs: []`. |
| 9 ADR/Errorbook/Memory | ⚠️ | Main operations work. CLI `error promote` without `--verification` is blocked by commander before JSON output, not by structured lrnev error. |
| 10 Summary | ✅ | `summary save` writes sidecars; nonexistent URI returns `FILE_NOT_FOUND` and does not create orphan summary. |
| 11 Handoff/status | ✅ | CLI `status` and MCP `project_status` return scenes/specs/active_tasks/agents/errors and scoped scene view. CLI name differs from MCP name. |
| 12 Multi-agent | ✅ | True stdio two-client test: both active, overlap warning, disconnect unregisters agent and releases claim for takeover. |
| 13 Hooks | ⚠️ | Hook list/trigger/tail/enable/disable work once `hooks.json` exists and is an array. Init did not create it; object-shaped config gives `HOOK_CONFIG_INVALID`. Example node hook failed with empty stderr. |
| 14 Doctor | ✅ | Doctor reports onboarding FILL, missing validates anchor, stale task claims, orphan claims. `--gc-agents` path was lightly exercised through list/doctor, not a deep cleanup matrix. |
| 15 CLI/MCP equivalence | ✅ | True stdio MCP and CLI shared the same workspace; `governance_map`, `context_search`, task context fields are structurally equivalent. |
| 16 MCP resources | ✅ | true stdio `resources/list` and `resources/read` work; missing URI returns MCP error and server stays alive. |
| 17 Real project | ✅ | Aider project init, codebase detection, source reading, PROJECT/ARCHITECTURE fill, spec chain, anchor_context, map/search all worked; `.lrnev` cleaned afterward. |

## Version Guard Evidence

Command:

```powershell
lrnev --version
lrnev --help
```

Key output:

```text
2.1.0
Commands: init ... doctor ... search ... status ... map
```

True MCP stdio evidence:

```json
{
  "serverInfo": { "name": "lrnev", "version": "2.1.0" },
  "instructions": "lrnev 是确定性的项目治理引擎...分流(便宜先)..."
}
```

`tools/list` evidence:

```json
{
  "tool_count": 40,
  "has_governance_map": true,
  "has_adr_suggest": false,
  "first_tools": ["adr_create", "adr_get", "adr_list", "agent_heartbeat"]
}
```

The walkthrough says about 39 tools; actual is 40. This is not a release blocker because the required new tool exists and removed `adr_suggest` is absent.

## Key Pass Evidence

### Init

Command:

```powershell
lrnev --json --workspace E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty init --project-name demo
```

Output excerpt:

```json
{
  "ok": true,
  "data": {
    "was_new": true,
    "files_created": [".lrnev/PROJECT.md", ".lrnev/auto/codebase.json", ".lrnev/ARCHITECTURE.md", ".lrnev/scenes/00-default/scene.md"],
    "directories_ensured": [".lrnev/config", ".lrnev/scenes/00-default/specs"],
    "codebase_detected": false
  }
}
```

Deviation evidence:

```powershell
Test-Path E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty/.lrnev/config/hooks.json
# False
```

### Ready Gate and Demand Review Gate

CLI ready pass:

```powershell
lrnev --json --workspace ... gate check --scene user-management --spec user-login --gate ready
```

Output excerpt:

```json
{ "gate": "ready", "passed": true, "checks": [{ "name": "requirements_sections_present", "passed": true }] }
```

MCP ready pass includes v2.1 demand review followup:

```json
{
  "ok": true,
  "data": { "gate": "ready", "passed": true },
  "ai_followup": {
    "instructions": [
      "ready gate 已通过：requirements 结构契约完整。",
      "请暂停：把 requirements.md 展示给用户确认「做什么」后再继续——这是用户审核需求方向的唯一人工门..."
    ]
  }
}
```

English-title contract fail:

```json
{
  "passed": false,
  "checks": [{
    "name": "requirements_sections_present",
    "message": "requirements.md 缺少必填章节：L1 概览",
    "hint": "章节标题必须与模板完全一致...不要翻译或改名"
  }]
}
```

### Task Error Paths

Commands:

```powershell
lrnev --json --workspace ... task create '坏锚点' --scene user-management --spec user-login --validates F-99
lrnev --json --workspace ... task create '旧式设计引用' --scene user-management --spec user-login --validates design#3.2
lrnev --json --workspace ... task create '坏依赖' --scene user-management --spec user-login --depends-on T-999
lrnev --json --workspace ... task update T-002 --scene user-management --spec user-login --status completed
```

Actual output excerpts:

```json
{ "code": "ANCHOR_NOT_FOUND", "message": "validates 锚点在 requirements.md 中不存在：F-99" }
{ "code": "INVALID_INPUT", "message": "validates 锚点格式已废弃：design#3.2", "hint": "...改用 D-xx。" }
{ "code": "TASK_NOT_FOUND", "message": "depends_on 指向不存在的 Task：T-999" }
{ "code": "INVALID_STATUS_TRANSITION", "message": "非法状态转换：pending → completed" }
```

### Completion Gate

Commands:

```powershell
lrnev --json --workspace ... gate check --scene user-management --spec user-login --gate completion
lrnev --json --workspace ... gate check --scene user-management --spec completion-boundary --gate completion
```

Actual output excerpts:

```json
{ "name": "all_tasks_completed", "passed": false, "message": "仍有未完成 Task：T-002:pending" }
{ "name": "design_no_fill", "passed": false, "message": "design.md 仍有未填哨兵：L11, L17, L21, L25, L34" }
{ "name": "design_exists", "passed": false, "message": "design.md 不存在：.lrnev/scenes/.../design.md" }
{ "gate": "completion", "passed": true, "checks": [{ "name": "all_tasks_completed", "passed": true }] }
```

### anchor_context

Short F anchor via `task_update`:

```json
{
  "anchor_context": [{
    "anchor": "F-01",
    "source": "requirements",
    "text": "#### F-01 短上下文\n\nWHEN 任务引用短需求 THEN 启动上下文返回完整段落...",
    "truncated": false
  }]
}
```

Long F anchor via `task_claim`:

```json
{
  "anchor_context": [{
    "anchor": "F-03",
    "source": "requirements",
    "text": "#### F-03 极长上下文\n\n第一句说明这是一个明显超过限制的极长段落...第九句继续填充大量需求背景...",
    "truncated": true
  }]
}
```

D anchor, physical line boundary:

```json
{
  "anchor_context": [{
    "anchor": "D-02",
    "source": "design",
    "text": "#### D-02 物理换行验证\n第一行设计说明应该返回。",
    "truncated": false
  }]
}
```

Note: if two sentences are written on the same physical line under `D-01`, both are returned because the contract is “first line,” not “first sentence.”

Drift soft warning:

```json
{
  "ok": true,
  "ai_followup": {
    "instructions": ["validates 锚点 F-01 为废弃格式或在 requirements/design 中不存在，可能漂移；请核实（claim 不阻断）。"]
  }
}
```

### summary_context

Inline fallback:

```json
{
  "summary_context": {
    "source": "inline",
    "l0": "用于验证任务启动上下文回填的测试规格。",
    "truncated": false
  }
}
```

Sidecar priority:

```json
{
  "summary_context": {
    "source": "sidecar",
    "l0": "sidecar 摘要优先级测试。",
    "l1": "sidecar L1 覆盖内联摘要用于任务启动上下文。",
    "truncated": false
  }
}
```

No validates and no summary:

```json
{
  "ok": true,
  "data": { "id": "T-001", "status": "in_progress" },
  "ai_followup": { "instructions": ["先回看本 Spec 的 requirements 目标与验收标准，确认验收口径后再动手。"] }
}
```

### Governance Map and Search

Command:

```powershell
lrnev --json --workspace ... map
```

Excerpt:

```json
{
  "scene": "01-user-management",
  "specs": [{
    "spec": "01-00-user-login",
    "status": "in-progress",
    "l0": "用户可以用邮箱和密码登录，并在失败时获得安全的错误响应。",
    "anchors": ["#### F-01 邮箱密码登录", "#### F-02 安全失败响应", "#### D-01 登录服务编排"]
  }]
}
```

BM25/anchor search command:

```powershell
lrnev --json --workspace ... search unicorn
```

Actual order:

```json
[
  { "uri": "context://spec/01-user-management/05-00-precise-search", "score": 5.45, "anchor": "F-01" },
  { "uri": "context://spec/01-user-management/06-00-verbose-search", "score": 5.36, "anchor": "F-01" }
]
```

Empty search:

```json
{ "results": [], "ai_followup": { "instructions": ["没有找到明显匹配项；请尝试换关键词，或先补充 L0/L1 摘要。"] } }
```

### MCP Resources

True stdio commands were executed through `@modelcontextprotocol/sdk/client/stdio` with `LRNEV_WORKSPACE` pinned to the empty workspace.

Evidence:

```json
{
  "resources": ["context://project", "context://project/architecture", "context://auto/codebase", "context://steering/core", "context://scene", "context://adr"],
  "project_start": "---\ntitle: 'demo'...",
  "spec_l0_start": "sidecar 摘要优先级测试。\n",
  "missing_error": "MCP error -32603: 文件不存在：\".lrnev/scenes/01-user-management/specs/not-there/requirements.md\""
}
```

### Multi-Agent

True stdio test used two separate MCP clients.

Evidence excerpt:

```json
{
  "agents": [
    { "client": "codex-e2e-b", "status": "active" },
    { "client": "codex-e2e-a", "status": "active" }
  ],
  "claim2": {
    "data": { "overlaps": [{ "task": "T-005", "touches_files": ["src/auth.ts"] }] },
    "ai_followup": { "instructions": ["touches_files 重叠警告...src/auth.ts"] }
  },
  "agentsAfter": [{ "client": "codex-e2e-b", "status": "active" }],
  "reclaim": { "ok": true, "data": { "claimed": true } }
}
```

## Light Artifacts Evidence

ADR:

```json
{ "number": "0001", "title": "Use server sessions", "scope": "global", "path": ".lrnev/decisions/adr/0001-use-server-sessions.md" }
{ "code": "INVALID_INPUT", "message": "supersedes 编号不合法：\"ADR-1\"" }
```

Errorbook:

```json
{ "id": "02ddeabb8bbb", "occurrence_count": 1, "status": "incident" }
{ "id": "02ddeabb8bbb", "occurrence_count": 2, "status": "incident" }
{ "status": "promoted", "verification": "reviewed and reusable" }
```

CLI deviation for missing verification:

```text
error: required option '--verification <text>' not specified
```

Memory/session:

```json
{ "id": "facts-768f0ee4066f", "content": "e2e-facts-memory" }
{ "id": "facts-768f0ee4066f", "deleted": true }
{ "saved": [{ "content": "session fact one" }, { "content": "session pattern one" }], "skipped": [] }
```

Goal assess:

```json
{
  "kind": "multi-spec-program",
  "confidence": "medium",
  "reasons": ["目标列举了 3 个并列项，可能是多个可交付特性"]
}
```

## Hooks Evidence

Initial fresh init state:

```json
{ "hooks": [], "config_path": ".lrnev/config/hooks.json", "issues": [] }
```

But file was absent until manually created. Object-shaped config failed:

```json
{ "code": "HOOK_CONFIG_INVALID", "message": "hooks.json 顶层必须是数组" }
```

Array-shaped config loaded and trigger ran:

```json
{ "hooks": [{ "name": "e2e-echo", "event": "task.update.completed", "enabled": true }], "issues": [] }
{ "event": "task.update.completed", "matched": 1, "warnings": [] }
{ "hook": "e2e-echo", "status": "failed", "exit_code": 1, "stdout_tail": "", "stderr_tail": "" }
{ "name": "e2e-echo", "enabled": false }
{ "name": "e2e-echo", "enabled": true }
```

Hook management works, but failed hook diagnostics were weak: exit code was present but stderr/stdout tails were empty for the test command.

## Doctor Evidence

Command:

```powershell
lrnev --json --workspace ... doctor
```

Output excerpts:

```json
{
  "summary": { "errors": 0, "warnings": 12 },
  "issues": [
    { "code": "ONBOARDING_INCOMPLETE", "path": ".lrnev/PROJECT.md" },
    { "code": "VALIDATES_ANCHOR_MISSING", "message": "Task T-001 的 validates 锚点 \"F-01\" 在 requirements.md 中不存在" },
    { "code": "STALE_TASK_CLAIM", "message": "Task T-001 处于 in_progress，但没有活跃 task claim" },
    { "code": "ORPHAN_CLAIM", "message": "claim ... 的属主 Agent probe-a 不在注册表" }
  ]
}
```

## Real Project Walkthrough: P0_5_Aider

What I read before filling onboarding docs:

```text
pyproject.toml: project name aider-chat, Python >=3.10,<3.15, entrypoint aider = aider.main:main
README.md: “AI Pair Programming in Your Terminal” and features: repo map, git integration, linting/testing, IDE/watch, voice
Core files sampled: aider/main.py, aider/commands.py, aider/io.py, aider/coders/base_coder.py, aider/repomap.py
```

Init detection:

```json
{
  "codebase_detected": true,
  "tech_stack": [{ "ecosystem": "python", "manifest": "pyproject.toml", "name": "aider-chat" }],
  "primary_language": "python",
  "root_files": ["pyproject.toml", "requirements.txt", "README.md", "pytest.ini"]
}
```

I filled `PROJECT.md` and `ARCHITECTURE.md` with Aider-specific content: CLI AI pair programming tool, main/input-output/commands/coder/repomap modules, setuptools Python package, prompt_toolkit/rich/litellm/gitpython/tree-sitter ecosystem.

Real request used:

```text
改进 Aider 在自动 lint/test 命令失败时的终端诊断输出，让用户能区分命令不存在、进程非零退出和测试失败，并看到下一步建议
```

`assess_goal` result:

```json
{ "kind": "multi-spec-program", "confidence": "medium", "reasons": ["目标列举了 4 个并列项，可能是多个可交付特性"] }
```

Product feel: this was over-cautious. The request is one cohesive feature with three failure modes, so I proceeded with a single spec.

Ready/completion and anchor_context evidence:

```json
{ "gate": "ready", "passed": true }
{
  "anchor_context": [
    { "anchor": "F-01", "text": "#### F-01 命令不存在诊断\n\nWHEN lint/test 命令因为可执行文件不存在而失败 THEN Aider 输出..." },
    { "anchor": "F-02", "text": "#### F-02 非零退出诊断\n\nWHEN lint/test 进程以非零退出码结束 THEN Aider 输出退出码..." },
    { "anchor": "F-03", "text": "#### F-03 测试失败诊断\n\nWHEN pytest 等测试命令运行成功但报告测试失败 THEN Aider 输出..." },
    { "anchor": "D-01", "source": "design" },
    { "anchor": "D-02", "source": "design" }
  ]
}
{ "gate": "completion", "passed": true }
```

Real-project map/search:

```json
{
  "scene": "00-default",
  "specs": [{
    "spec": "01-00-lint-test-diagnostics",
    "l0": "改进 Aider 自动 lint/test 命令失败时的终端诊断输出...",
    "anchors": ["#### F-01 命令不存在诊断", "#### D-01 失败分类器"]
  }]
}
```

```json
{
  "query": "lint/test",
  "results": [
    { "uri": "context://spec/00-default/01-00-lint-test-diagnostics", "anchor": "F-01" },
    { "uri": "context://spec/00-default/01-00-lint-test-diagnostics/design", "anchor": "D-01" },
    { "uri": "context://project/architecture", "snippet": "aider/coders/base_coder.py...lint/test/提交编排。" }
  ]
}
```

Cleanup:

```powershell
Remove-Item -LiteralPath E:/project/.lrnev/lrnev-cli/research/P0_5_Aider/.lrnev -Recurse -Force
Test-Path E:/project/.lrnev/lrnev-cli/research/P0_5_Aider/.lrnev
# False
```

### Real Project Product Feel

Useful:
- `init` followup correctly forced me to read `pyproject.toml` and real source before filling governance docs.
- `anchor_context` was genuinely useful: it put all F/D acceptance text directly into the task start response, enough to begin implementation without hunting files.
- `map` and `context_search` were readable on real Aider governance data and returned both spec anchors and project architecture snippets.

Noisy or awkward:
- `assess_goal` over-split a single cohesive feature because it counted failure modes as parallel deliverables.
- Defaulting to `00-default` is convenient, but for a real project it can hide that there may be a CLI/terminal UX scene worth creating.
- CLI/MCP naming differs (`status` vs `project_status`, `summary save` vs MCP `summarize_save`), which is acceptable but easy to trip over during manual walkthrough.

## FAIL / Deviation Details

### 1. Fresh init does not create `.lrnev/config/hooks.json`

Expected: init creates `.lrnev/config/hooks.json`.

Actual: init ensures `.lrnev/config` but no file.

Repro:

```powershell
Remove-Item .lrnev -Recurse -Force
lrnev --json --workspace E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty init --project-name demo
Test-Path E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty/.lrnev/config/hooks.json
```

Actual output:

```text
False
```

Impact: hook list still works and points at the config path, but users have no generated example/schema and can easily write the wrong shape.

### 2. Hook config schema is not discoverable and object shape fails

Expected: hooks are manageable after init, or config format is obvious.

Actual: no file is created; when I created `{ "hooks": [...] }`, lrnev rejected it.

Repro:

```json
{ "hooks": [{ "name": "e2e-echo", "event": "task.update.completed", "enabled": true, "command": "node -e ..." }] }
```

Actual output:

```json
{ "code": "HOOK_CONFIG_INVALID", "message": "hooks.json 顶层必须是数组" }
```

Impact: non-blocking, but likely to trip real users.

### 3. Hook failed diagnostics were weak

Expected: tail log gives useful stderr/stdout or error reason.

Actual:

```json
{ "hook": "e2e-echo", "status": "failed", "exit_code": 1, "stdout_tail": "", "stderr_tail": "" }
```

Impact: user knows it failed but not why.

### 4. CLI JSON output shape is inconsistent with MCP and sometimes drops followup context

Expected: `[both]` checks expose comparable response structure.

Actual: CLI `gate check --json` returns raw gate object:

```json
{ "gate": "ready", "passed": true, "checks": [...] }
```

MCP returns:

```json
{ "ok": true, "data": { "gate": "ready", "passed": true }, "ai_followup": { ...需求审核门... } }
```

Impact: the demand-review gate exists, but CLI JSON users may not see the followup. This matters because the review gate is one of v2.1's highlighted behaviors.

### 5. CLI validation can bypass structured JSON error for required options

Expected: JSON mode consistently returns `{ ok:false, errors:[...] }`.

Actual:

```powershell
lrnev --json --workspace ... error promote 02ddeabb8bbb
```

Output:

```text
error: required option '--verification <text>' not specified
```

Impact: scripts expecting JSON need special handling for commander-level option errors.

### 6. `assess_goal` may over-split cohesive features with multiple scenarios

Expected: real request with three failure modes should likely be `single-spec`.

Actual:

```json
{ "kind": "multi-spec-program", "reason": "目标列举了 4 个并列项，可能是多个可交付特性" }
```

Impact: non-blocking because followup asks user to confirm, but it nudges toward over-governance.

## v2.1 Feature Conclusions

- `anchor_context`: ✅ PASS. Both `task_update` and `task_claim` return F/D anchor context. F anchors include requirement paragraphs; D anchors return title + first physical line. Long F anchors set `truncated:true` at a sentence boundary.
- `summary_context`: ✅ PASS. No-validates tasks use inline L0, sidecar L0/L1 overrides inline, and no-summary tasks return no context with a useful followup.
- Demand review gate: ⚠️ Partial. MCP exposes the review followup exactly; CLI `--json` gate output does not show it.
- Four-way routing: ✅ PASS. Server instructions and spec_create followup contain the four routes and caution about scene/00-default uncertainty.
- `governance_map` / `lrnev map`: ✅ PASS. CLI and MCP expose title-level scene/spec/anchor map.
- `context_search` BM25 + anchor snippets: ✅ PASS. Short precise doc ranked above long noisy doc; snippets include `anchor` when hit is inside `#### F-xx`/`D-xx`.
- MCP resources: ✅ PASS. Static resources list/read works; spec L0 reads sidecar when present; missing URI errors without crashing.
- Hook management: ⚠️ Partial. Tooling works, but init does not create config and failed hook diagnostics can be sparse.

## Release Recommendation

I would not block v2.1.0 on core governance behavior: the main lifecycle, anchor_context, summary_context, search/map, MCP resources, and real-project flow are usable. I recommend release only after fixing or explicitly documenting the CLI JSON followup gap and hook config/bootstrap behavior; otherwise publish with those as known issues.
