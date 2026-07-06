# lrnev MCP 真机集成测试报告

- 客户端/模型：Codex CLI，GPT-5 系列 coding agent
- 测试时间：2026-06-04，Asia/Shanghai；MCP 返回时间戳为 UTC `2026-06-04T06:28:56Z` 起
- 被测 MCP server：`lrnev`
- 被测项目：`E:/project/xpaas/xpaas-skill/.test-code/xpaas-boot-xmszh2`
- 测试方式：通过已连接的 `mcp__lrnev.*` MCP 工具真实调用；同时读取本地项目文件验证 `.lrnev` 产物

## 总览

| 测试面 | 结果 | 备注 |
|---|---:|---|
| MCP 工具面枚举 | ✅/⚠️ | 当前 Codex 会话实际注入 38 个 `mcp__lrnev` 工具，未注入 `adr_suggest`；但本客户端未暴露原始 `listTools` 调用入口，因此不能给出独立 `listTools` JSON 返回。 |
| `lrnev_init` Java 项目探测 | ✅ | `data.codebase_detected=true`，无 `package.json` 的 Maven 项目仍被识别为有代码库。 |
| `ai_followup` 补全引导 | ✅ | init followup 明确要求读取 `auto/codebase.json` 中 root build 文件如 `pom.xml/build.gradle` 和源码目录，并回填 `ARCHITECTURE.md` / `PROJECT.md`。 |
| `codebase.json` root_files | ✅ | `root_files` 实际包含 `"pom.xml"`。 |
| 噪音目录过滤 | ✅ | 根目录实际存在 `.idea` 和 `logs`，但 `codebase.json.directories` 未包含二者。 |
| AI 按 followup 识别项目并回填文档 | ✅ | 已读取根 POM、子模块 POM、`backend/` Java、`frontend/` Vue/API，回填 `.lrnev/ARCHITECTURE.md` 和 `.lrnev/PROJECT.md`。 |
| `lrnev_guide` | ✅ | `workflow/tools/errors/concepts` 均返回 `ok:true` 和对应内容。 |
| Scene 创建与多特性拆分提示 | ✅/⚠️ | `scene_create` 返回 Spec 拆分三标尺；但对明显多个特性的 intent 给出“看起来是单一特性”的信号，偏保守。 |
| Spec 创建与 ready gate 失败路径 | ✅ | 初始模板 ready gate 返回 `passed:false`，指出 FILL 行号和未勾选验收项，含 hint。 |
| Spec ready gate 通过路径 | ✅ | 填好 `requirements.md` 并保留中文模板标题后，ready gate 返回 `passed:true`。 |
| Task 创建/父子任务/状态机 | ✅ | `task_create` 创建 `T-001`、`T-002`，`T-002.parent=T-001`；`task_update in_progress -> completed` 正常。 |
| 自动 claim/release | ✅ | `task_update(in_progress, agent_id=...)` 返回已登记 claim；`completed` followup 返回已释放 claim。 |
| 手动 claim/release | ✅ | `task_claim` 返回 `claimed:true` 和 `expires_at`；`task_release` 返回 `released:true`。 |
| 非法状态跃迁边界 | ✅ | `pending -> completed` 返回 `ok:false`，错误码 `INVALID_STATUS_TRANSITION`，hint 明确允许状态。 |
| `task_list` / `project_status` | ✅ | `task_list` 返回两个 completed 任务；`project_status` 返回有界快照、计数、`claimable_next: []`。 |
| completion gate | ✅/⚠️ | 结构化任务全 completed 后返回 `passed:true`；但 `design.md` 和 `tasks.md` 仍含 FILL 哨兵，说明 completion gate 当前只检查任务结构，不检查设计/任务模板内容。 |
| ADR | ✅ | `adr_create/list/get` 均可用，创建 `0001`。 |
| Memory | ✅ | `memory_save/search/forget` 均可用；临时 preference 保存后删除成功。 |
| Errorbook | ✅/⚠️ | `error_record/promote` 可用；按指纹 ID 可搜到 promoted 条目，但自然语言关键词搜索返回空。 |
| Summary / Context Search | ✅ | `summarize_save` 写入 L0/L1；`context_search` 能检索 Spec、tasks、ADR、Errorbook、Memory。 |
| Agent | ✅/⚠️ | `register/heartbeat/list/unregister` 可用；曾出现心跳数分钟后 `agent_list` 判为 dead，再 heartbeat 后恢复 active。 |
| Hook | ✅ | `hook_list` 显示 implemented 且无配置；`hook_trigger` matched 0；`tail_log` 返回空；对不存在 hook 的 enable/disable 返回 `INVALID_INPUT`。 |
| Doctor | ✅ | 最终 `lrnev_doctor` 返回 `errors=0,warnings=0,info=0`。 |
| Session commit / assess goal | ✅/⚠️ | `session_commit` 保存 2 条记忆；`assess_goal` 对多特性目标判为 `single-spec/medium`，偏保守。 |

## spec-10 Java 探测关键验证

1. `lrnev_init` 实际返回：
   - `ok: true`
   - `data.root: E:/project/xpaas/xpaas-skill/.test-code/xpaas-boot-xmszh2`
   - `data.was_new: true`
   - `data.codebase_detected: true`

2. `lrnev_init.ai_followup.instructions[0]` 实际包含：
   - “未能自动识别技术栈。请读 auto/codebase.json 的 root_files 列出的构建文件（如 pom.xml/build.gradle）与主要源码目录，识别技术栈与架构，写回 ARCHITECTURE.md（技术栈/主要模块）与 PROJECT.md（项目目标/当前阶段）。”
   - 结论：没有出现“探测全空且不给引导”的死局。

3. `.lrnev/auto/codebase.json` 实际关键值：
   - `root_files`: `[ ".editorconfig", ".gitignore", "Dockerfile", "README.md", "opencode.json", "pom.xml" ]`
   - 结论：包含 `"pom.xml"`。

4. `.lrnev/auto/codebase.json.directories` 实际为：
   - `backend`, `doc`, `frontend`, `sql`, `xpaas-boot`, `xpaas-xmgl`
   - 根目录实际存在 `.idea` 和 `logs`，但未进入 `directories`。

5. 按 followup 真实回填：
   - 读取了根 `pom.xml`、`xpaas-boot/pom.xml`、`xpaas-xmgl/pom.xml`、`xpaas-xmgl` 子模块 POM、`backend/service` 控制器/服务、`frontend/src/api/doc/document.js`、`frontend/src/views/doc/documentCrud.vue`。
   - `.lrnev/ARCHITECTURE.md` 已写入 Java 21、Maven 多模块、Spring Boot 3.5.9、Spring Cloud 2025.0.1、xPaaS 内部依赖、MyBatis/MyBatis-Plus 风格、Vue/Avue 片段、主要模块和数据流。
   - `.lrnev/PROJECT.md` 已写入项目目标、核心用户、当前阶段、范围和约束。

## 工具面确认

当前 Codex MCP 客户端实际暴露并注入了 38 个 `lrnev` 工具：

`adr_create`, `adr_get`, `adr_list`, `agent_heartbeat`, `agent_list`, `agent_register`, `agent_unregister`, `assess_goal`, `context_search`, `error_promote`, `error_record`, `error_search`, `lrnev_doctor`, `lrnev_guide`, `lrnev_hook_disable`, `lrnev_hook_enable`, `lrnev_hook_list`, `lrnev_hook_tail_log`, `lrnev_hook_trigger`, `lrnev_init`, `memory_forget`, `memory_save`, `memory_search`, `project_status`, `scene_create`, `scene_get`, `scene_list`, `session_commit`, `spec_create`, `spec_gate_check`, `spec_get`, `spec_list`, `summarize_save`, `task_claim`, `task_create`, `task_list`, `task_release`, `task_update`.

未发现 `adr_suggest`。限制：本 Codex 工具层没有提供原始 MCP `listTools` 方法调用入口；这个结论来自当前会话实际注入的工具定义和后续逐项真实调用。

## 主要调用记录

- `lrnev_init`: `ok:true`, `was_new:true`, `codebase_detected:true`。
- `lrnev_guide`: `workflow/tools/errors/concepts` 均 `ok:true`。
- `scene_create`: 创建 `01-document-governance-suite`，返回 Spec 拆分三标尺和 suggested tools。
- `spec_create`: 创建 `01-00-document-import-export`，三文档存在。
- `spec_gate_check ready` 初次：`passed:false`，失败项 `requirements_no_fill_sentinels`，提示行 `L28,L31,L37,L43,L44`。
- `spec_gate_check ready` 英文标题版：`passed:false`，失败项 `requirements_sections_present`。
- `spec_gate_check ready` 中文标题版：`passed:true`。
- `agent_register`: 注册 `DESKTOP-2E4TITN-31536-39fc`。
- `task_create`: `T-001` pending；`T-002` pending 且 `parent:T-001`。
- `task_update T-002 completed` from pending：`ok:false`, `INVALID_STATUS_TRANSITION`。
- `task_update T-001 in_progress/completed`: 成功，自动 claim/release。
- `task_claim/task_release T-002`: `claimed:true`, `released:true`。
- `task_update T-002 in_progress/completed`: 成功，自动 claim/release。
- `spec_gate_check completion`: `passed:true`。
- `adr_create`: 创建 scene ADR `0001`。
- `memory_save/search/forget`: 均成功。
- `error_record`: 创建 incident `eac5ddeba4af`；`error_promote` 提升为 promoted。
- `summarize_save`: 保存 `.abstract.md` 和 `.overview.md`。
- `context_search`: 返回 requirements、tasks、ADR、overview、abstract、Errorbook、Memory 等结果。
- `hook_list`: implemented true，hooks 空。
- `hook_trigger`: matched 0。
- `hook_tail_log`: 空数组。
- `lrnev_doctor`: 最终 `errors=0,warnings=0,info=0`。
- `agent_unregister`: 注销成功，最终 `agent_list` 返回空 agents。

## 发现的问题与意外

### 1. `codebase.json` 仍未自动识别 Java 技术栈字段

复现：

1. 在干净 Java/Maven 项目调用 `lrnev_init`。
2. 查看 `.lrnev/auto/codebase.json`。

实际：

- `codebase_detected=true`
- `root_files` 包含 `pom.xml`
- 但 `tech_stack: []`, `primary_language: "unknown"`, `package_managers: []`, `dependencies: {}`, `sample_files: []`

判断：spec-10 的关键死局已修复，因为工具能检测到代码库并给 followup 引导 AI 补全；但自动分析仍没有把 Maven/Java 填入结构化字段。若 1.0.0 目标是“确定性探测 Maven/Java 元数据”，这里还需要增强。

### 2. ready gate 对 requirements 章节标题语言敏感

复现：

1. 用真实内容替换所有 FILL。
2. 将模板标题改成英文：`L0 Summary`, `L1 Overview`, `Scope`, `Detailed Requirements`, `Acceptance Criteria`。
3. 调 `spec_gate_check(gate=ready)`。

实际：

- `requirements_no_fill_sentinels=true`
- `requirements_acceptance_checked=true`
- `requirements_sections_present=false`
- message：缺少 `L0 摘要, L1 概览, L2 详情, 范围, 详细需求, 验收标准`

修复/规避：恢复中文模板标题后 ready gate 通过。建议：1.0.0 前要么文档明确“不要改模板标题”，要么 gate 支持等价英文标题。

### 3. `scene_create` / `assess_goal` 对多特性目标判断偏保守

复现：

使用 intent/goal：“列表检索、Excel 导入导出、权限审计、异步转换任务、前端 CRUD 交互”等多个独立可交付特性。

实际：

- `scene_create` followup 给出拆分标尺，但同时提示“看起来是单一特性”。
- `assess_goal` 返回 `kind: "single-spec"`, `confidence: "medium"`。

判断：不阻塞流程，因为拆分标尺仍可用；但辅助信号对多特性目标偏保守，可能误导 AI 少拆 Spec。

### 4. `error_search` 自然语言检索召回弱

复现：

1. `error_record` 记录症状：“ready gate failed ... requirements.md headings ...”
2. `error_promote` 提升。
3. 调 `error_search` query=`requirements headings ready gate FILL` 或 `ready gate failed headings`。

实际：返回 `[]`。

对照：query=`eac5ddeba4af` 能返回 promoted 条目。`context_search` 也能搜到 errorbook URI。

判断：Errorbook 写入/提升是可用的，但 `error_search` 对英文自然语言关键词召回不稳定。

### 5. Agent dead 判定较敏感

复现：

1. `agent_register`。
2. `agent_heartbeat`。
3. 数分钟后 `agent_list`。

实际：一度返回该 agent `status:"dead"`；再次 `agent_heartbeat` 后 `agent_list` 返回 `active`。

判断：可能是测试环境 TTL 较短或 registry 惰性状态计算导致。工具可恢复，但多窗口协作时需要按建议频繁心跳。

### 6. completion gate 范围较窄

复现：

1. 保持 `design.md` 和 `tasks.md` 中模板 FILL 哨兵。
2. 用 `task_create` 创建结构化任务并全部标 completed。
3. 调 `spec_gate_check(gate=completion)`。

实际：`passed:true`，只检查 `tasks_readable/tasks_exist/all_tasks_completed` 等结构化任务条件。

判断：这可能是设计选择，不一定是 bug；但如果用户以为 completion gate 会检查 design/tasks 模板是否填完，会产生误解。建议文档明确 gate 边界。

## 最终状态

- `.lrnev` 已初始化并包含真实 Scene/Spec/Task/ADR/Memory/Errorbook/Summary 产物。
- `project_status` 最终：
  - `active_task_count: 0`
  - `task_counts.completed: 2`
  - `claimable_next: []`
  - `active_agents: []`
  - `open_errors: []`
  - `recent_adrs` 包含 ADR `0001`
- `agent_list` 最终为空。
- `lrnev_doctor` 最终 `errors=0,warnings=0,info=0`。

## 1.0.0 发布结论

结论：**基本达到 1.0.0 发布标准，但建议带已知限制发布，或在发布前修复两个高价值问题。**

支持发布的理由：

- spec-10 的核心死局已修复：Java/Maven 项目 init 能识别为有代码库，`pom.xml` 被记录，噪音目录过滤有效，followup 能引导 AI 补全架构和项目文档。
- Scene/Spec/Task/Gate/Claim/ADR/Memory/Errorbook/Hook/Agent/Doctor/Search 等主要能力面真实调用可用。
- 边界错误返回结构化错误码和 hint，流程可恢复。
- 最终 doctor 干净，无残留 active agent/claim。

建议发布前优先处理：

1. 增强 `AutoAnalyzer` 对 Maven/Java 的结构化字段识别，至少填 `primary_language=java`、`package_managers=maven`、`tech_stack` 基本项和样例源码文件。
2. 处理 ready gate 对中文模板标题的硬依赖，或在模板/guide 中明确禁止改章节标题。

可作为后续版本优化：

- 改善 `error_search` 自然语言召回。
- 调整多特性目标的拆分辅助信号。
- 明确 completion gate 不检查 design/tasks FILL 的边界。
- 文档化 agent heartbeat TTL 或在返回中提示剩余租约。
