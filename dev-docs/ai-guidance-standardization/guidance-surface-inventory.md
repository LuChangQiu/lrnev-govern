# lrnev Guidance Surface Inventory

**Baseline Date**: 2026-09-01
**Spec**: 02-00-guidance-surface-inventory
**Status**: draft

## Summary Statistics

- **Total Surfaces**: 345

### By Channel

- server_instructions: 1
- tool_metadata: 84
- tool_input_schema: 121
- tool_annotations: 42
- mcp_resource: 17
- ai_followup: 4
- governance_doc: 76

### By Consumer

- client: 42
- model: 81
- both: 222

### By Role

- RECOMMENDATION: 85
- FACT: 256
- ACTION_HINT: 4

### Total Budget

- Characters: 303,513
- Tokens (estimate): 76,001

## Surface Catalog

### server_instructions

#### `server_instructions:global:workflow_overview`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `WORKFLOW_OVERVIEW`
  - Line: 3
- **Trigger**: MCP server initialization
- **Consumer**: model
- **Content Hash**: `c4db95b1f9bd8b57...`
- **Budget**: 541 chars / ~136 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
lrnev 是确定性的项目治理引擎：文件即真相，不调用 LLM。
概念：Scene > Spec > Task；Gate 只查结构契约；ADR/Errorbook/Memory 是轻产物。
新建特性：首次先 lrnev_init，再 spec_create；填 requirements 后跑 spec_gate_check(ready)，再拆任务（多条清单用 task_create_many、单条用 task_create），最后 spec_gate_check(completion)。
接手项目：先调 project_status 拿全貌，从 in_progress task 继续；可用 governance_map 看治理全景、lrnev_report 看治理欠债。
分流(便宜先)：写不出独立验收→直接做；已有特性增量→落位 spec；独立新特性→spec_create。新 spec 优先已有 scene；新域经用户确认会有多 spec→scene_create；无域小特性落 00-default；scene/00 不确定问用户。踩坑→error_record，决策→adr_cre...
```
</details>

### tool_metadata

#### `tool_metadata:lrnev_guide:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `lrnev_guide`
  - Line: 95
- **Trigger**: Tool lrnev_guide listing/invocation
- **Consumer**: both
- **Content Hash**: `52436bb3b48e2325...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
lrnev 使用手册
```
</details>

#### `tool_metadata:lrnev_guide:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.lrnev_guide`
- **Trigger**: Tool lrnev_guide listing/invocation
- **Consumer**: both
- **Content Hash**: `9aade6e9c6a9ce09...`
- **Budget**: 106 chars / ~27 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
返回 lrnev 工作流、工具速查、错误自救和核心概念。何时用：不确定下一步、刚接入 MCP、或 gate/状态机报错时。前置：无。例子：lrnev_guide{topic:"errors"} → 只看错误自救。
```
</details>

#### `tool_metadata:lrnev_init:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `lrnev_init`
  - Line: 111
- **Trigger**: Tool lrnev_init listing/invocation
- **Consumer**: both
- **Content Hash**: `e2d56f352978b75b...`
- **Budget**: 20 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Init lrnev workspace
```
</details>

#### `tool_metadata:lrnev_init:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.lrnev_init`
- **Trigger**: Tool lrnev_init listing/invocation
- **Consumer**: both
- **Content Hash**: `04b4396fb6ce6e75...`
- **Budget**: 85 chars / ~22 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
初始化 .lrnev 工作区。何时用：新项目首次接入。前置：项目根目录已确定。例子：lrnev_init{project_name:"demo"} → 创建默认治理骨架。
```
</details>

#### `tool_metadata:project_status:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `project_status`
  - Line: 129
- **Trigger**: Tool project_status listing/invocation
- **Consumer**: both
- **Content Hash**: `8d2cea88382c1b93...`
- **Budget**: 14 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Project Status
```
</details>

#### `tool_metadata:project_status:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.project_status`
- **Trigger**: Tool project_status listing/invocation
- **Consumer**: both
- **Content Hash**: `903fbdb38ec82d0d...`
- **Budget**: 90 chars / ~23 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
返回接手快照。何时用：继续已有项目或新会话开头。前置：已 init。例子：project_status{} → 查看 active tasks、ADR 和 open errors。
```
</details>

#### `tool_metadata:governance_map:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `governance_map`
  - Line: 145
- **Trigger**: Tool governance_map listing/invocation
- **Consumer**: both
- **Content Hash**: `ff8d7a425fa768b0...`
- **Budget**: 14 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Governance Map
```
</details>

#### `tool_metadata:governance_map:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.governance_map`
- **Trigger**: Tool governance_map listing/invocation
- **Consumer**: both
- **Content Hash**: `e04848ea2f40067c...`
- **Budget**: 108 chars / ~27 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
返回治理地图：scene→spec(状态/L0)→锚点标题 的压缩全景（只读、只含标题级，不含正文）。何时用：接手项目或需要一次性了解全貌、按 URI 直接跳转时，替代反复 context_search + 读全文。
```
</details>

#### `tool_metadata:lrnev_report:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `lrnev_report`
  - Line: 159
- **Trigger**: Tool lrnev_report listing/invocation
- **Consumer**: both
- **Content Hash**: `ad21abdbfa0726fd...`
- **Budget**: 17 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Governance Report
```
</details>

#### `tool_metadata:lrnev_report:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.lrnev_report`
- **Trigger**: Tool lrnev_report listing/invocation
- **Consumer**: both
- **Content Hash**: `ae6ffdf78d9a4631...`
- **Budget**: 163 chars / ~41 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
零模型治理体检：做完没收口/failed/blocked + validates 覆盖率（孤儿/坏 validates）+ 每条欠债的可执行下一步，等价 CLI report --json。何时用：想知道工作区欠了哪些治理债、给人看或让用户拍板收口时。参数 scene? 只看某域、release_notes? 附已完成清单。
```
</details>

#### `tool_metadata:scene_create:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `scene_create`
  - Line: 177
- **Trigger**: Tool scene_create listing/invocation
- **Consumer**: both
- **Content Hash**: `b61f73ac0fc78867...`
- **Budget**: 12 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Create Scene
```
</details>

#### `tool_metadata:scene_create:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.scene_create`
- **Trigger**: Tool scene_create listing/invocation
- **Consumer**: both
- **Content Hash**: `9204676ab1176eae...`
- **Budget**: 111 chars / ~28 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
创建业务 Scene，并生成 scene.md、architecture.md、roadmap.md。何时用：需要按业务域隔离一组 Specs 时；传 intent 可在 followup 获得单/多 Spec 拆分信号。
```
</details>

#### `tool_metadata:scene_list:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `scene_list`
  - Line: 193
- **Trigger**: Tool scene_list listing/invocation
- **Consumer**: both
- **Content Hash**: `51776222c7b78266...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
List Scenes
```
</details>

#### `tool_metadata:scene_list:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.scene_list`
- **Trigger**: Tool scene_list listing/invocation
- **Consumer**: both
- **Content Hash**: `420c5ffe43a88146...`
- **Budget**: 52 chars / ~13 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
列出当前工作区中的所有 Scene。何时用：接手项目、选择工作场景或排查 broken Scene 时。
```
</details>

#### `tool_metadata:scene_get:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `scene_get`
  - Line: 205
- **Trigger**: Tool scene_get listing/invocation
- **Consumer**: both
- **Content Hash**: `289f227793d442cf...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Get Scene
```
</details>

#### `tool_metadata:scene_get:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.scene_get`
- **Trigger**: Tool scene_get listing/invocation
- **Consumer**: both
- **Content Hash**: `4e66fdefb7b221eb...`
- **Budget**: 48 chars / ~12 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
读取一个 Scene 的元信息和统计信息。何时用：需要确认某个 Scene 的文档与统计概况时。
```
</details>

#### `tool_metadata:spec_create:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `spec_create`
  - Line: 221
- **Trigger**: Tool spec_create listing/invocation
- **Consumer**: both
- **Content Hash**: `aec8f94c1e3c7c40...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Create Spec
```
</details>

#### `tool_metadata:spec_create:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.spec_create`
- **Trigger**: Tool spec_create listing/invocation
- **Consumer**: both
- **Content Hash**: `88a21f63c79a9094...`
- **Budget**: 250 chars / ~63 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
创建 Spec 三文档。何时用：先自问"这是可独立交付、能写出 WHEN…THEN 验收的特性吗"——通常适合为这类特性开 spec；做完没有独立验收可挂的小改动(改文档/排版/注释、小重构、调参数、答问题等，举例非穷举)直接做、不要开 spec。拿不准先问用户、别默认开。注意：以上是建议，若用户已明确要求（如"帮我新建一个 Spec"），即使已有相似 Spec 可以承载，也应尊重用户决定直接创建。前置：已 init；scene 可省略。例子：spec_create{name:"login"}。
```
</details>

#### `tool_metadata:spec_list:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `spec_list`
  - Line: 238
- **Trigger**: Tool spec_list listing/invocation
- **Consumer**: both
- **Content Hash**: `a8d89e7b211a3ff6...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
List Specs
```
</details>

#### `tool_metadata:spec_list:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.spec_list`
- **Trigger**: Tool spec_list listing/invocation
- **Consumer**: both
- **Content Hash**: `648d2489c0ae5e7c...`
- **Budget**: 53 chars / ~14 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
列出指定 Scene 下的所有 Spec。何时用：查看同 Scene 已有哪些特性、避免重复或找接手目标。
```
</details>

#### `tool_metadata:spec_get:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `spec_get`
  - Line: 252
- **Trigger**: Tool spec_get listing/invocation
- **Consumer**: both
- **Content Hash**: `3770955bb91113d1...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Get Spec
```
</details>

#### `tool_metadata:spec_get:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.spec_get`
- **Trigger**: Tool spec_get listing/invocation
- **Consumer**: both
- **Content Hash**: `6d838d4dfa21ebb3...`
- **Budget**: 71 chars / ~18 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
读取一个 Spec 的元信息和三文档存在性。何时用：进入某个 Spec 前确认 requirements/design/tasks 是否齐全。
```
</details>

#### `tool_metadata:spec_update:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `spec_update`
  - Line: 276
- **Trigger**: Tool spec_update listing/invocation
- **Consumer**: both
- **Content Hash**: `c972e82df2df4e13...`
- **Budget**: 18 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Update Spec Status
```
</details>

#### `tool_metadata:spec_update:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.spec_update`
- **Trigger**: Tool spec_update listing/invocation
- **Consumer**: both
- **Content Hash**: `9f3c114462166d51...`
- **Budget**: 115 chars / ~29 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
按状态机更新 Spec 状态(draft→ready→in-progress→completed→archived)。何时用：gate 通过后回填状态，或开重写版后把被取代的旧版标 archived(归档后其待办不再进可领列表)。
```
</details>

#### `tool_metadata:spec_gate_check:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `spec_gate_check`
  - Line: 295
- **Trigger**: Tool spec_gate_check listing/invocation
- **Consumer**: both
- **Content Hash**: `98147f13f53534d5...`
- **Budget**: 15 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Check Spec Gate
```
</details>

#### `tool_metadata:spec_gate_check:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.spec_gate_check`
- **Trigger**: Tool spec_gate_check listing/invocation
- **Consumer**: both
- **Content Hash**: `ad078f2ea74e5c35...`
- **Budget**: 106 chars / ~27 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
运行 Spec gate。何时用：创建后、需求填完或任务完成后验收。前置：spec 已存在；ready 前替换 FILL。例子：spec_gate_check{gate:"ready"} → 返回 checks。
```
</details>

#### `tool_metadata:task_create:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `task_create`
  - Line: 322
- **Trigger**: Tool task_create listing/invocation
- **Consumer**: both
- **Content Hash**: `5a9133cebfab7531...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Create Task
```
</details>

#### `tool_metadata:task_create:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.task_create`
- **Trigger**: Tool task_create listing/invocation
- **Consumer**: both
- **Content Hash**: `4fa4234074589c6f...`
- **Budget**: 129 chars / ~33 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
追加单条结构化 Task。何时用：临时补一个执行项；一次拆多条任务清单请改用 task_create_many；大项可用 parent 拆子任务。前置：spec 已创建。例子：task_create{title:"实现登录",parent:"T-001"}。
```
</details>

#### `tool_metadata:task_create_many:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `task_create_many`
  - Line: 343
- **Trigger**: Tool task_create_many listing/invocation
- **Consumer**: both
- **Content Hash**: `166bb04c58e834fe...`
- **Budget**: 17 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Create Many Tasks
```
</details>

#### `tool_metadata:task_create_many:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.task_create_many`
- **Trigger**: Tool task_create_many listing/invocation
- **Consumer**: both
- **Content Hash**: `a132a738d18bd14f...`
- **Budget**: 178 chars / ~45 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
一次原子性创建多个 Task。何时用：spec ready 后一次性拆任务清单；补单个仍用 task_create。批内依赖用 key 临时键(禁 T-xxx)，任一条失败整批不写、返回全部错误。例子：task_create_many{tasks:[{key:"a",title:"建模"},{title:"接口",depends_on:["a"]}]}。
```
</details>

#### `tool_metadata:task_update:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `task_update`
  - Line: 367
- **Trigger**: Tool task_update listing/invocation
- **Consumer**: both
- **Content Hash**: `6cfe65a77f84fceb...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Update Task
```
</details>

#### `tool_metadata:task_update:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.task_update`
- **Trigger**: Tool task_update listing/invocation
- **Consumer**: both
- **Content Hash**: `6ca72b068cfc83d7...`
- **Budget**: 124 chars / ~31 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
按状态机更新 Task。何时用：开始/完成/阻塞任务时。前置：task 已存在，遵守 pending→in_progress→completed。例子：task_update{task_id:"T-001",status:"completed"}。
```
</details>

#### `tool_metadata:task_claim:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `task_claim`
  - Line: 388
- **Trigger**: Tool task_claim listing/invocation
- **Consumer**: both
- **Content Hash**: `1495da930aab330d...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Claim Task
```
</details>

#### `tool_metadata:task_claim:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.task_claim`
- **Trigger**: Tool task_claim listing/invocation
- **Consumer**: both
- **Content Hash**: `6c16a90c2a199c90...`
- **Budget**: 104 chars / ~26 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
登记 Task 运行态软占用。何时用：多窗口开始做某个 Task 前。前置：agent 已注册、task 已存在。例子：task_claim{task:"T-001",agent_id:"agent-a"}。
```
</details>

#### `tool_metadata:task_release:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `task_release`
  - Line: 407
- **Trigger**: Tool task_release listing/invocation
- **Consumer**: both
- **Content Hash**: `99be8815ebe069ff...`
- **Budget**: 18 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Release Task Claim
```
</details>

#### `tool_metadata:task_release:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.task_release`
- **Trigger**: Tool task_release listing/invocation
- **Consumer**: both
- **Content Hash**: `8f90a611a4c23d32...`
- **Budget**: 112 chars / ~28 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
释放 Task claim。何时用：放弃、交接或不再处理某个 Task 时。前置：该 claim 属于当前 agent_id。例子：task_release{task:"T-001",agent_id:"agent-a"}。
```
</details>

#### `tool_metadata:task_list:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `task_list`
  - Line: 424
- **Trigger**: Tool task_list listing/invocation
- **Consumer**: both
- **Content Hash**: `12614c36c9c94faa...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
List Tasks
```
</details>

#### `tool_metadata:task_list:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.task_list`
- **Trigger**: Tool task_list listing/invocation
- **Consumer**: both
- **Content Hash**: `0b55b26ca18b2dfa...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
列出指定 Spec 的所有 Task。何时用：接手或收尾时查看 pending/in_progress/completed 状态。
```
</details>

#### `tool_metadata:adr_create:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `adr_create`
  - Line: 447
- **Trigger**: Tool adr_create listing/invocation
- **Consumer**: both
- **Content Hash**: `b495d5dbf26c9049...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Create ADR
```
</details>

#### `tool_metadata:adr_create:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.adr_create`
- **Trigger**: Tool adr_create listing/invocation
- **Consumer**: both
- **Content Hash**: `978609b6f51cd1f0...`
- **Budget**: 52 chars / ~13 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
创建全局或 Scene 范围的 ADR，并更新对应索引。何时用：已有明确技术决策、选型或取舍需要留痕时。
```
</details>

#### `tool_metadata:adr_list:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `adr_list`
  - Line: 469
- **Trigger**: Tool adr_list listing/invocation
- **Consumer**: both
- **Content Hash**: `4183b39a75d9394d...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
List ADRs
```
</details>

#### `tool_metadata:adr_list:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.adr_list`
- **Trigger**: Tool adr_list listing/invocation
- **Consumer**: both
- **Content Hash**: `2050907274946d11...`
- **Budget**: 51 chars / ~13 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
按 scope 列出 ADR，默认 global。何时用：实施前回看既有决策或检查某个范围的决策历史。
```
</details>

#### `tool_metadata:adr_get:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `adr_get`
  - Line: 482
- **Trigger**: Tool adr_get listing/invocation
- **Consumer**: both
- **Content Hash**: `2a94c24c3132f4cd...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Get ADR
```
</details>

#### `tool_metadata:adr_get:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.adr_get`
- **Trigger**: Tool adr_get listing/invocation
- **Consumer**: both
- **Content Hash**: `b35ab97820f08b23...`
- **Budget**: 45 chars / ~12 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
读取指定 scope 下的 ADR。何时用：需要理解某个已定决策的背景、后果或替代方案时。
```
</details>

#### `tool_metadata:assess_goal:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `assess_goal`
  - Line: 498
- **Trigger**: Tool assess_goal listing/invocation
- **Consumer**: both
- **Content Hash**: `66d4d611ccb0e20e...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Assess Goal
```
</details>

#### `tool_metadata:assess_goal:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.assess_goal`
- **Trigger**: Tool assess_goal listing/invocation
- **Consumer**: both
- **Content Hash**: `1a7a4775275a7cea...`
- **Budget**: 92 chars / ~23 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
用启发式规则评估目标复杂度，建议 single-spec / multi-spec-program / research-program。何时用：用户目标较模糊、需要先判断治理粒度时。
```
</details>

#### `tool_metadata:summarize_save:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `summarize_save`
  - Line: 513
- **Trigger**: Tool summarize_save listing/invocation
- **Consumer**: both
- **Content Hash**: `9413abe3dd450163...`
- **Budget**: 12 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Save Summary
```
</details>

#### `tool_metadata:summarize_save:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.summarize_save`
- **Trigger**: Tool summarize_save listing/invocation
- **Consumer**: both
- **Content Hash**: `dc8907e1e43d7722...`
- **Budget**: 61 chars / ~16 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
保存指定 context:// URI 的 L0 / L1 摘要，不调用 LLM。何时用：完成阶段性工作后更新接手摘要时。
```
</details>

#### `tool_metadata:context_search:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `context_search`
  - Line: 530
- **Trigger**: Tool context_search listing/invocation
- **Consumer**: both
- **Content Hash**: `cb5499d704844d1e...`
- **Budget**: 14 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Search Context
```
</details>

#### `tool_metadata:context_search:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.context_search`
- **Trigger**: Tool context_search listing/invocation
- **Consumer**: both
- **Content Hash**: `69a26f183667fcd2...`
- **Budget**: 61 chars / ~16 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
目录优先检索 context:// 资源，优先使用 L0/L1 摘要。何时用：找相关 Spec、ADR、记忆或错误记录时。
```
</details>

#### `tool_metadata:error_record:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `error_record`
  - Line: 550
- **Trigger**: Tool error_record listing/invocation
- **Consumer**: both
- **Content Hash**: `cac527b099309fc4...`
- **Budget**: 12 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Record Error
```
</details>

#### `tool_metadata:error_record:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.error_record`
- **Trigger**: Tool error_record listing/invocation
- **Consumer**: both
- **Content Hash**: `d0d743d663749886...`
- **Budget**: 58 chars / ~15 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
记录错误到 Errorbook incidents，并按指纹自动去重合并。何时用：遇到踩坑、回归或可复用故障经验时。
```
</details>

#### `tool_metadata:error_search:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `error_search`
  - Line: 572
- **Trigger**: Tool error_search listing/invocation
- **Consumer**: both
- **Content Hash**: `91ea24c69cc93dab...`
- **Budget**: 13 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Search Errors
```
</details>

#### `tool_metadata:error_search:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.error_search`
- **Trigger**: Tool error_search listing/invocation
- **Consumer**: both
- **Content Hash**: `e9a6fec857489219...`
- **Budget**: 99 chars / ~25 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
搜索 incidents 和 promoted 错误手册。何时用：修类似问题前查历史根因、修法和验证证据时。零模型关键词检索、无语义召回：请用记录原文的关键词/错误码/文件名搜，不要改述或用近义词。
```
</details>

#### `tool_metadata:error_promote:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `error_promote`
  - Line: 597
- **Trigger**: Tool error_promote listing/invocation
- **Consumer**: both
- **Content Hash**: `e4b6d972a319a03f...`
- **Budget**: 13 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Promote Error
```
</details>

#### `tool_metadata:error_promote:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.error_promote`
- **Trigger**: Tool error_promote listing/invocation
- **Consumer**: both
- **Content Hash**: `06295881c19c8d53...`
- **Budget**: 71 chars / ~18 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
将 incidents 错误提升为 promoted，必须提供 verification。何时用：同类错误已验证可复用、需要沉淀为错误手册时。
```
</details>

#### `tool_metadata:memory_save:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `memory_save`
  - Line: 626
- **Trigger**: Tool memory_save listing/invocation
- **Consumer**: both
- **Content Hash**: `4d9decf56040997f...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Save Memory
```
</details>

#### `tool_metadata:memory_save:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.memory_save`
- **Trigger**: Tool memory_save listing/invocation
- **Consumer**: both
- **Content Hash**: `d8d64263e9b1e99d...`
- **Budget**: 50 chars / ~13 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
保存一条项目记忆，source 必填，同类别内自动去重。何时用：一句约定、事实或偏好值得后续复用时。
```
</details>

#### `tool_metadata:memory_search:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `memory_search`
  - Line: 646
- **Trigger**: Tool memory_search listing/invocation
- **Consumer**: both
- **Content Hash**: `d4a9cf57a1bc4300...`
- **Budget**: 13 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Search Memory
```
</details>

#### `tool_metadata:memory_search:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.memory_search`
- **Trigger**: Tool memory_search listing/invocation
- **Consumer**: both
- **Content Hash**: `5c0abec3230bc574...`
- **Budget**: 47 chars / ~12 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
搜索项目记忆，可按分类和 scope 过滤。何时用：需要回看项目约定、事实、模式或用户偏好时。
```
</details>

#### `tool_metadata:memory_forget:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `memory_forget`
  - Line: 665
- **Trigger**: Tool memory_forget listing/invocation
- **Consumer**: both
- **Content Hash**: `e5e5538cbce66d96...`
- **Budget**: 13 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Forget Memory
```
</details>

#### `tool_metadata:memory_forget:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.memory_forget`
- **Trigger**: Tool memory_forget listing/invocation
- **Consumer**: both
- **Content Hash**: `dbcbdbb02ec8f415...`
- **Budget**: 34 chars / ~9 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
删除指定记忆。何时用：确认某条记忆过期、错误或不应再影响后续判断时。
```
</details>

#### `tool_metadata:session_commit:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `session_commit`
  - Line: 684
- **Trigger**: Tool session_commit listing/invocation
- **Consumer**: both
- **Content Hash**: `2b76b1837db35af1...`
- **Budget**: 14 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Commit Session
```
</details>

#### `tool_metadata:session_commit:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.session_commit`
- **Trigger**: Tool session_commit listing/invocation
- **Consumer**: both
- **Content Hash**: `914ffbe5437cfce4...`
- **Budget**: 42 chars / ~11 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
批量保存本轮对话抽取出的候选记忆。何时用：会话结束或上下文压缩前沉淀多条候选记忆时。
```
</details>

#### `tool_metadata:agent_register:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `agent_register`
  - Line: 709
- **Trigger**: Tool agent_register listing/invocation
- **Consumer**: both
- **Content Hash**: `e07efcb947651dac...`
- **Budget**: 14 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Register Agent
```
</details>

#### `tool_metadata:agent_register:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.agent_register`
- **Trigger**: Tool agent_register listing/invocation
- **Consumer**: both
- **Content Hash**: `874bb9c9a74362e3...`
- **Budget**: 118 chars / ~30 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
注册当前 Agent，返回 agent_id；未传时自动生成。何时用：stdio 启动时自动注册;脚本化或跨主机会话手动调用。返回 data.gc 仅在本次顺手清理了死 agent/过期 claim 时出现，没有该字段=无需清理，正常。
```
</details>

#### `tool_metadata:agent_heartbeat:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `agent_heartbeat`
  - Line: 724
- **Trigger**: Tool agent_heartbeat listing/invocation
- **Consumer**: both
- **Content Hash**: `9078e321eb7350bf...`
- **Budget**: 15 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Heartbeat Agent
```
</details>

#### `tool_metadata:agent_heartbeat:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.agent_heartbeat`
- **Trigger**: Tool agent_heartbeat listing/invocation
- **Consumer**: both
- **Content Hash**: `74779abbef79d6f3...`
- **Budget**: 71 chars / ~18 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
更新 Agent last_heartbeat 并续租其 claim。何时用:通常无需(存活随进程自动判定);仅跨主机协作需要兜底续活时调用。
```
</details>

#### `tool_metadata:agent_list:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `agent_list`
  - Line: 738
- **Trigger**: Tool agent_list listing/invocation
- **Consumer**: both
- **Content Hash**: `5978452ff83b3486...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
List Agents
```
</details>

#### `tool_metadata:agent_list:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.agent_list`
- **Trigger**: Tool agent_list listing/invocation
- **Consumer**: both
- **Content Hash**: `695734b3d44873fc...`
- **Budget**: 54 chars / ~14 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
列出 Agent 注册表，并惰性计算 active/dead 状态。何时用：查看当前有哪些客户端会话在线时。
```
</details>

#### `tool_metadata:agent_unregister:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `agent_unregister`
  - Line: 750
- **Trigger**: Tool agent_unregister listing/invocation
- **Consumer**: both
- **Content Hash**: `56f06dd18260fd05...`
- **Budget**: 16 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Unregister Agent
```
</details>

#### `tool_metadata:agent_unregister:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.agent_unregister`
- **Trigger**: Tool agent_unregister listing/invocation
- **Consumer**: both
- **Content Hash**: `ae969dd9642a071d...`
- **Budget**: 39 chars / ~10 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
注销 Agent 会话。何时用：Agent 正常退出或交接完成后清理会话状态。
```
</details>

#### `tool_metadata:lrnev_doctor:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `lrnev_doctor`
  - Line: 766
- **Trigger**: Tool lrnev_doctor listing/invocation
- **Consumer**: both
- **Content Hash**: `7d45677be6addefe...`
- **Budget**: 24 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Diagnose lrnev workspace
```
</details>

#### `tool_metadata:lrnev_doctor:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.lrnev_doctor`
- **Trigger**: Tool lrnev_doctor listing/invocation
- **Consumer**: both
- **Content Hash**: `b5319d5729888268...`
- **Budget**: 99 chars / ~25 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
检查 .lrnev 工作区结构、Spec、Task、ADR、claim、hook 和 context；可迁移旧 TODO、清理遗留摘要。何时用：gate 失败、broken 条目、数据异常或接手前。
```
</details>

#### `tool_metadata:lrnev_hook_list:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `lrnev_hook_list`
  - Line: 797
- **Trigger**: Tool lrnev_hook_list listing/invocation
- **Consumer**: both
- **Content Hash**: `e4419e805ec23dac...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
List Hooks
```
</details>

#### `tool_metadata:lrnev_hook_list:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.lrnev_hook_list`
- **Trigger**: Tool lrnev_hook_list listing/invocation
- **Consumer**: both
- **Content Hash**: `7b593f1d9bd58565...`
- **Budget**: 51 chars / ~13 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
列出 hook 配置和最近执行状态。何时用：确认 hooks.json 生效情况或排查自动化未触发时。
```
</details>

#### `tool_metadata:lrnev_hook_trigger:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `lrnev_hook_trigger`
  - Line: 808
- **Trigger**: Tool lrnev_hook_trigger listing/invocation
- **Consumer**: both
- **Content Hash**: `c56b1c57689390bc...`
- **Budget**: 12 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Trigger Hook
```
</details>

#### `tool_metadata:lrnev_hook_trigger:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.lrnev_hook_trigger`
- **Trigger**: Tool lrnev_hook_trigger listing/invocation
- **Consumer**: both
- **Content Hash**: `18fafc6d5e2841d7...`
- **Budget**: 55 chars / ~14 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
手动触发 hook 事件，用于测试 hooks.json 配置。何时用：新增或修改 hook 后做本地验证时。
```
</details>

#### `tool_metadata:lrnev_hook_tail_log:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `lrnev_hook_tail_log`
  - Line: 822
- **Trigger**: Tool lrnev_hook_tail_log listing/invocation
- **Consumer**: both
- **Content Hash**: `9e7ca4153cd642c8...`
- **Budget**: 13 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Tail Hook Log
```
</details>

#### `tool_metadata:lrnev_hook_tail_log:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.lrnev_hook_tail_log`
- **Trigger**: Tool lrnev_hook_tail_log listing/invocation
- **Consumer**: both
- **Content Hash**: `7d7b13b7dd5b38ce...`
- **Budget**: 55 chars / ~14 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
读取最近 hook 执行日志。何时用：hook 失败、超时、warning 或 trigger 后确认输出时。
```
</details>

#### `tool_metadata:lrnev_hook_enable:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `lrnev_hook_enable`
  - Line: 835
- **Trigger**: Tool lrnev_hook_enable listing/invocation
- **Consumer**: both
- **Content Hash**: `2acec83a43ba0a29...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Enable Hook
```
</details>

#### `tool_metadata:lrnev_hook_enable:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.lrnev_hook_enable`
- **Trigger**: Tool lrnev_hook_enable listing/invocation
- **Consumer**: both
- **Content Hash**: `52e5143dcbb26594...`
- **Budget**: 41 chars / ~11 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
启用 hooks.json 中指定 hook。何时用：临时关闭的自动化需要恢复时。
```
</details>

#### `tool_metadata:lrnev_hook_disable:title`

- **Source**: `src/mcp/tools/index.ts`
  - Symbol: `lrnev_hook_disable`
  - Line: 846
- **Trigger**: Tool lrnev_hook_disable listing/invocation
- **Consumer**: both
- **Content Hash**: `46f2ad9d0cde8f77...`
- **Budget**: 12 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
Disable Hook
```
</details>

#### `tool_metadata:lrnev_hook_disable:description`

- **Source**: `src/mcp/guidance.ts`
  - Symbol: `TOOL_DESCRIPTIONS.lrnev_hook_disable`
- **Trigger**: Tool lrnev_hook_disable listing/invocation
- **Consumer**: both
- **Content Hash**: `cbdb97ed3a5140ac...`
- **Budget**: 48 chars / ~12 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: null

<details>
<summary>Content Preview</summary>

```
禁用 hooks.json 中指定 hook。何时用：某个 hook 失败、太慢或干扰主流程时。
```
</details>

### tool_input_schema

#### `tool_input_schema:tools:topic_line101`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `topic`
  - Line: 101
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `96cfdc12f5bb6a6b...`
- **Budget**: 42 chars / ~11 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：workflow/tools/errors/concepts；省略返回完整手册
```
</details>

#### `tool_input_schema:tools:root_line117`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `root`
  - Line: 117
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `212c07feae434d99...`
- **Budget**: 40 chars / ~10 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：显式指定项目根目录；默认按 LRNEV_WORKSPACE 或当前目录定位
```
</details>

#### `tool_input_schema:tools:project_name_line118`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `project_name`
  - Line: 118
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `b1e3fa90b07f017e...`
- **Budget**: 14 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：项目名；默认使用目录名
```
</details>

#### `tool_input_schema:tools:scan_line119`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scan`
  - Line: 119
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `51cb017cb52413fc...`
- **Budget**: 28 chars / ~7 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
占位 flag，M2 不做主动扫描；行为同默认 init
```
</details>

#### `tool_input_schema:tools:scene_line135`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 135
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `289e738cd96e0e56...`
- **Budget**: 25 chars / ~7 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：只返回指定 Scene 的状态，缩小接手快照
```
</details>

#### `tool_input_schema:tools:scene_line165`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 165
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `8e3dc11678892a38...`
- **Budget**: 17 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
只体检指定 scene；不给则全量
```
</details>

#### `tool_input_schema:tools:release_notes_line166`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `release_notes`
  - Line: 166
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `41349842c037df7e...`
- **Budget**: 24 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
附已完成工作的 release notes 草稿
```
</details>

#### `tool_input_schema:tools:name_line183`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `name`
  - Line: 183
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `987ef113f6ef4e7b...`
- **Budget**: 32 chars / ~8 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
kebab-case 名称，例如 user-management
```
</details>

#### `tool_input_schema:tools:number_line184`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `number`
  - Line: 184
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `fda738bdc0489229...`
- **Budget**: 16 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：手动指定 Scene 序号
```
</details>

#### `tool_input_schema:tools:intent_line185`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `intent`
  - Line: 185
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `af877b4ef550bb48...`
- **Budget**: 12 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：业务意图一句话说明
```
</details>

#### `tool_input_schema:tools:scene_line211`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 211
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `ed93665d44ee7c64...`
- **Budget**: 21 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识：完整 id、序号或纯名称
```
</details>

#### `tool_input_schema:tools:scene_line227`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 227
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `e16847af02212900...`
- **Budget**: 38 chars / ~10 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识：完整 id、序号或纯名称；缺省时使用 00-default
```
</details>

#### `tool_input_schema:tools:name_line228`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `name`
  - Line: 228
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `92af8a706e3eca63...`
- **Budget**: 32 chars / ~8 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
kebab-case Spec 名称，例如 user-login
```
</details>

#### `tool_input_schema:tools:version_line229`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `version`
  - Line: 229
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `4d2e9ff3f77d40bb...`
- **Budget**: 79 chars / ~20 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：默认 0。小修小改直接编辑现有 requirements/design/tasks，不传 version；仅整体重写并想保留旧版对照时传 1/2/...
```
</details>

#### `tool_input_schema:tools:priority_line230`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `priority`
  - Line: 230
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `05fc6a28818ccd29...`
- **Budget**: 6 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：优先级
```
</details>

#### `tool_input_schema:tools:scene_line244`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 244
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `ed93665d44ee7c64...`
- **Budget**: 21 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识：完整 id、序号或纯名称
```
</details>

#### `tool_input_schema:tools:scene_line258`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 258
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `ed93665d44ee7c64...`
- **Budget**: 21 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识：完整 id、序号或纯名称
```
</details>

#### `tool_input_schema:tools:spec_line259`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `spec`
  - Line: 259
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `eee9c60a9cb76297...`
- **Budget**: 22 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Spec 标识：完整 id、序号前缀或纯名称
```
</details>

#### `tool_input_schema:tools:scene_line282`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 282
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `ed93665d44ee7c64...`
- **Budget**: 21 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识：完整 id、序号或纯名称
```
</details>

#### `tool_input_schema:tools:spec_line283`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `spec`
  - Line: 283
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `eee9c60a9cb76297...`
- **Budget**: 22 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Spec 标识：完整 id、序号前缀或纯名称
```
</details>

#### `tool_input_schema:tools:status_line284`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `status`
  - Line: 284
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `dba8a85c2fc38630...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
目标状态
```
</details>

#### `tool_input_schema:tools:reason_line285`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `reason`
  - Line: 285
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `69de172d8a685fcc...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：变更原因
```
</details>

#### `tool_input_schema:tools:scene_line301`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 301
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `ed93665d44ee7c64...`
- **Budget**: 21 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识：完整 id、序号或纯名称
```
</details>

#### `tool_input_schema:tools:spec_line302`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `spec`
  - Line: 302
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `eee9c60a9cb76297...`
- **Budget**: 22 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Spec 标识：完整 id、序号前缀或纯名称
```
</details>

#### `tool_input_schema:tools:gate_line303`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `gate`
  - Line: 303
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `8655313d7dbf61b3...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Gate 类型
```
</details>

#### `tool_input_schema:tools:scene_line328`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 328
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `26a66b936e5e70d6...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识
```
</details>

#### `tool_input_schema:tools:spec_line329`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `spec`
  - Line: 329
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `25cc8ff76479582c...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Spec 标识
```
</details>

#### `tool_input_schema:tools:title_line330`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `title`
  - Line: 330
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `f118de64d6ec8f5b...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
任务标题
```
</details>

#### `tool_input_schema:tools:description_line331`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `description`
  - Line: 331
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `8fc4e5fd978e6e59...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：任务描述
```
</details>

#### `tool_input_schema:tools:acceptance_line332`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `acceptance`
  - Line: 332
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `473248301e13f516...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：验收标准列表
```
</details>

#### `tool_input_schema:tools:depends_on_line333`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `depends_on`
  - Line: 333
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c6dc79f8a1104c92...`
- **Budget**: 16 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：依赖 Task ID 列表
```
</details>

#### `tool_input_schema:tools:parent_line334`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `parent`
  - Line: 334
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `ce758022cbbde113...`
- **Budget**: 44 chars / ~11 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：父 Task ID；把大执行项拆成可分别认领/验收的子任务时使用，例如 T-003
```
</details>

#### `tool_input_schema:tools:validates_line335`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `validates`
  - Line: 335
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `66f7b1d81ec4cf3d...`
- **Budget**: 25 chars / ~7 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：需求/设计锚点，例如 F-01 或 D-02
```
</details>

#### `tool_input_schema:tools:scene_line349`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 349
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `26a66b936e5e70d6...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识
```
</details>

#### `tool_input_schema:tools:spec_line350`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `spec`
  - Line: 350
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `25cc8ff76479582c...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Spec 标识
```
</details>

#### `tool_input_schema:tools:title_line352`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `title`
  - Line: 352
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `f118de64d6ec8f5b...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
任务标题
```
</details>

#### `tool_input_schema:tools:description_line353`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `description`
  - Line: 353
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `8fc4e5fd978e6e59...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：任务描述
```
</details>

#### `tool_input_schema:tools:acceptance_line354`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `acceptance`
  - Line: 354
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `473248301e13f516...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：验收标准列表
```
</details>

#### `tool_input_schema:tools:depends_on_line355`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `depends_on`
  - Line: 355
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `55ba40f24f985a19...`
- **Budget**: 39 chars / ~10 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：依赖列表；每项可为批内其它条目的 key 或已存在的真实 Task ID
```
</details>

#### `tool_input_schema:tools:parent_line356`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `parent`
  - Line: 356
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `3160eda44575270c...`
- **Budget**: 40 chars / ~10 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：父 Task ID；只接受已存在的真实 Task ID，不支持批内 key
```
</details>

#### `tool_input_schema:tools:validates_line357`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `validates`
  - Line: 357
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `66f7b1d81ec4cf3d...`
- **Budget**: 25 chars / ~7 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：需求/设计锚点，例如 F-01 或 D-02
```
</details>

#### `tool_input_schema:tools:key_line358`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `key`
  - Line: 358
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `ac3e06957474b623...`
- **Budget**: 44 chars / ~11 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：批内临时键，供同批 depends_on 引用；不得使用 T-xxx 格式，不落盘
```
</details>

#### `tool_input_schema:tools:key_line359`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `key`
  - Line: 359
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `548fd67dc3502d59...`
- **Budget**: 34 chars / ~9 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
要创建的任务列表；按数组顺序分配 T-xxx，任一条校验失败整批不写
```
</details>

#### `tool_input_schema:tools:scene_line373`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 373
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `26a66b936e5e70d6...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识
```
</details>

#### `tool_input_schema:tools:spec_line374`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `spec`
  - Line: 374
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `25cc8ff76479582c...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Spec 标识
```
</details>

#### `tool_input_schema:tools:task_id_line375`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `task_id`
  - Line: 375
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `9fafbb4fd7d5e789...`
- **Budget**: 16 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Task ID，例如 T-001
```
</details>

#### `tool_input_schema:tools:status_line376`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `status`
  - Line: 376
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `dba8a85c2fc38630...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
目标状态
```
</details>

#### `tool_input_schema:tools:reason_line377`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `reason`
  - Line: 377
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `3a5f9cafc02942b6...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：状态变更原因
```
</details>

#### `tool_input_schema:tools:agent_id_line378`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `agent_id`
  - Line: 378
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `35f517275ee05afe...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：当前 Agent ID；传入后 in_progress 自动登记 task claim，completed/failed 自动释放
```
</details>

#### `tool_input_schema:tools:claim_ttl_seconds_line379`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `claim_ttl_seconds`
  - Line: 379
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `a20e6b36516cbc13...`
- **Budget**: 18 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：task claim 租约秒数
```
</details>

#### `tool_input_schema:tools:touches_files_line380`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `touches_files`
  - Line: 380
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `3d61a8a8f7bb73e8...`
- **Budget**: 41 chars / ~11 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：多窗口并行时建议声明本 Task 预计修改的文件路径，用于重叠提示，不锁源码
```
</details>

#### `tool_input_schema:tools:scene_line394`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 394
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `26a66b936e5e70d6...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识
```
</details>

#### `tool_input_schema:tools:spec_line395`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `spec`
  - Line: 395
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `25cc8ff76479582c...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Spec 标识
```
</details>

#### `tool_input_schema:tools:task_line396`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `task`
  - Line: 396
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `9fafbb4fd7d5e789...`
- **Budget**: 16 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Task ID，例如 T-001
```
</details>

#### `tool_input_schema:tools:agent_id_line397`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `agent_id`
  - Line: 397
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `20b786281a19721d...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
当前 Agent ID
```
</details>

#### `tool_input_schema:tools:ttl_seconds_line398`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `ttl_seconds`
  - Line: 398
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `a20e6b36516cbc13...`
- **Budget**: 18 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：task claim 租约秒数
```
</details>

#### `tool_input_schema:tools:touches_files_line399`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `touches_files`
  - Line: 399
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `69be6d0cc4cbaaa8...`
- **Budget**: 34 chars / ~9 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：多窗口并行时建议声明预计修改的文件路径，用于重叠提示，不锁源码
```
</details>

#### `tool_input_schema:tools:scene_line413`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 413
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `26a66b936e5e70d6...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识
```
</details>

#### `tool_input_schema:tools:spec_line414`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `spec`
  - Line: 414
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `25cc8ff76479582c...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Spec 标识
```
</details>

#### `tool_input_schema:tools:task_line415`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `task`
  - Line: 415
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `9fafbb4fd7d5e789...`
- **Budget**: 16 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Task ID，例如 T-001
```
</details>

#### `tool_input_schema:tools:agent_id_line416`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `agent_id`
  - Line: 416
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `20b786281a19721d...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
当前 Agent ID
```
</details>

#### `tool_input_schema:tools:scene_line430`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scene`
  - Line: 430
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `26a66b936e5e70d6...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Scene 标识
```
</details>

#### `tool_input_schema:tools:spec_line431`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `spec`
  - Line: 431
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `25cc8ff76479582c...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Spec 标识
```
</details>

#### `tool_input_schema:tools:view_line432`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `view`
  - Line: 432
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `11d4ed87dbcf5476...`
- **Budget**: 50 chars / ~13 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：raw 返回完整 Task；readable 返回人读投影视图，隐藏 history/meta
```
</details>

#### `tool_input_schema:tools:title_line453`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `title`
  - Line: 453
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `d42e973e4247a925...`
- **Budget**: 6 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
ADR 标题
```
</details>

#### `tool_input_schema:tools:scope_line454`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 454
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `03c7425b28b3ad46...`
- **Budget**: 19 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}
```
</details>

#### `tool_input_schema:tools:context_line455`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `context`
  - Line: 455
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c958e7013e2cc9e2...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
决策背景
```
</details>

#### `tool_input_schema:tools:decision_line456`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `decision`
  - Line: 456
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `e34a55600d75c001...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
最终决策
```
</details>

#### `tool_input_schema:tools:alternatives_line457`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `alternatives`
  - Line: 457
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `2f3fce2630abea6f...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
备选方案及拒绝理由
```
</details>

#### `tool_input_schema:tools:consequences_line458`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `consequences`
  - Line: 458
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `b55f91d0c08b7b4b...`
- **Budget**: 5 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
后果与风险
```
</details>

#### `tool_input_schema:tools:supersedes_line459`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `supersedes`
  - Line: 459
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `0d808b88c787e29c...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
替代的 ADR 编号
```
</details>

#### `tool_input_schema:tools:scope_line475`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 475
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `03c7425b28b3ad46...`
- **Budget**: 19 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}
```
</details>

#### `tool_input_schema:tools:scope_line488`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 488
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `03c7425b28b3ad46...`
- **Budget**: 19 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}
```
</details>

#### `tool_input_schema:tools:number_line489`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `number`
  - Line: 489
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `4c2e6502afc775b4...`
- **Budget**: 18 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
ADR 编号，例如 1 或 0001
```
</details>

#### `tool_input_schema:tools:goal_line504`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `goal`
  - Line: 504
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `6293a1fc9eedf6bc...`
- **Budget**: 6 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
用户目标描述
```
</details>

#### `tool_input_schema:tools:uri_line519`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `uri`
  - Line: 519
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `b8e324bf2deae833...`
- **Budget**: 21 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
要保存摘要的 context:// URI
```
</details>

#### `tool_input_schema:tools:l0_line520`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `l0`
  - Line: 520
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `eaa63350be2fbe9c...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
L0 一句话摘要
```
</details>

#### `tool_input_schema:tools:l1_line521`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `l1`
  - Line: 521
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `45cd24672c0398c2...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
L1 概览摘要
```
</details>

#### `tool_input_schema:tools:query_line536`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `query`
  - Line: 536
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c00a21fdf78473a4...`
- **Budget**: 5 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
搜索关键词
```
</details>

#### `tool_input_schema:tools:scope_line537`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 537
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `03c7425b28b3ad46...`
- **Budget**: 19 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}
```
</details>

#### `tool_input_schema:tools:max_depth_line538`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `max_depth`
  - Line: 538
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `2bd1129306fa83d7...`
- **Budget**: 11 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
最大下钻深度，默认 3
```
</details>

#### `tool_input_schema:tools:symptom_line556`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `symptom`
  - Line: 556
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `ffd8f782679b9075...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
错误现象
```
</details>

#### `tool_input_schema:tools:root_cause_line557`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `root_cause`
  - Line: 557
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c876c32adae4244d...`
- **Budget**: 2 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
根因
```
</details>

#### `tool_input_schema:tools:fix_action_line558`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `fix_action`
  - Line: 558
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c1b042f2368e67e6...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
修复动作
```
</details>

#### `tool_input_schema:tools:scope_line559`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 559
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c16c9011c3518c6d...`
- **Budget**: 29 chars / ~8 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}，默认 global
```
</details>

#### `tool_input_schema:tools:verification_line560`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `verification`
  - Line: 560
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `8f8634ff72b58cd2...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：验证证据
```
</details>

#### `tool_input_schema:tools:references_line561`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `references`
  - Line: 561
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `47f13e931497801e...`
- **Budget**: 14 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：提交、PR、日志等引用
```
</details>

#### `tool_input_schema:tools:tags_line562`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `tags`
  - Line: 562
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `68ac0741416c90ed...`
- **Budget**: 5 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：标签
```
</details>

#### `tool_input_schema:tools:query_line578`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `query`
  - Line: 578
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c00a21fdf78473a4...`
- **Budget**: 5 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
搜索关键词
```
</details>

#### `tool_input_schema:tools:scope_line579`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 579
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c16c9011c3518c6d...`
- **Budget**: 29 chars / ~8 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}，默认 global
```
</details>

#### `tool_input_schema:tools:id_line603`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `id`
  - Line: 603
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `da53d0c01edf0af5...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
错误 ID / 指纹
```
</details>

#### `tool_input_schema:tools:scope_line604`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 604
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c16c9011c3518c6d...`
- **Budget**: 29 chars / ~8 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}，默认 global
```
</details>

#### `tool_input_schema:tools:verification_line605`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `verification`
  - Line: 605
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `4f0fac1855b7b1b4...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
验证证据
```
</details>

#### `tool_input_schema:tools:category_line632`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `category`
  - Line: 632
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `a9481803e3c6ae37...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
记忆分类
```
</details>

#### `tool_input_schema:tools:content_line633`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `content`
  - Line: 633
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `a1e87f0e4ac3d7f1...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
记忆内容
```
</details>

#### `tool_input_schema:tools:source_line634`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `source`
  - Line: 634
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `51a95772fa3e68e7...`
- **Budget**: 12 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
来源：对话、文件、提交等
```
</details>

#### `tool_input_schema:tools:scope_line635`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 635
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c16c9011c3518c6d...`
- **Budget**: 29 chars / ~8 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}，默认 global
```
</details>

#### `tool_input_schema:tools:tentative_line636`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `tentative`
  - Line: 636
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `7b77ece7c39fbc73...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
是否为不确定记忆
```
</details>

#### `tool_input_schema:tools:query_line652`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `query`
  - Line: 652
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c00a21fdf78473a4...`
- **Budget**: 5 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
搜索关键词
```
</details>

#### `tool_input_schema:tools:category_line653`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `category`
  - Line: 653
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `e80447422e57603b...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：记忆分类
```
</details>

#### `tool_input_schema:tools:scope_line654`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 654
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c16c9011c3518c6d...`
- **Budget**: 29 chars / ~8 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}，默认 global
```
</details>

#### `tool_input_schema:tools:id_line671`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `id`
  - Line: 671
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `97bfdd303fc90976...`
- **Budget**: 5 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
记忆 ID
```
</details>

#### `tool_input_schema:tools:category_line672`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `category`
  - Line: 672
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `a9481803e3c6ae37...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
记忆分类
```
</details>

#### `tool_input_schema:tools:scope_line673`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 673
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c16c9011c3518c6d...`
- **Budget**: 29 chars / ~8 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}，默认 global
```
</details>

#### `tool_input_schema:tools:summary_line690`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `summary`
  - Line: 690
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `989843d481caabe1...`
- **Budget**: 4 chars / ~1 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
会话摘要
```
</details>

#### `tool_input_schema:tools:source_line695`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `source`
  - Line: 695
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `8fd5b3722cf59faa...`
- **Budget**: 6 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
候选记忆列表
```
</details>

#### `tool_input_schema:tools:scope_line696`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `scope`
  - Line: 696
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c16c9011c3518c6d...`
- **Budget**: 29 chars / ~8 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
global 或 scene:{id}，默认 global
```
</details>

#### `tool_input_schema:tools:agent_id_line715`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `agent_id`
  - Line: 715
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `dcbbf59d9b8b7d73...`
- **Budget**: 17 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：客户端自带 Agent ID
```
</details>

#### `tool_input_schema:tools:client_line716`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `client`
  - Line: 716
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `f80197c3ab77ca8d...`
- **Budget**: 36 chars / ~9 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：客户端名称，例如 codex/claude-code/cursor
```
</details>

#### `tool_input_schema:tools:agent_id_line730`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `agent_id`
  - Line: 730
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `510bce732db77286...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Agent ID
```
</details>

#### `tool_input_schema:tools:agent_id_line756`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `agent_id`
  - Line: 756
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `510bce732db77286...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Agent ID
```
</details>

#### `tool_input_schema:tools:verbose_line772`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `verbose`
  - Line: 772
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `228fd8c0d7f84b53...`
- **Budget**: 24 chars / ~6 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
M1 保留参数；当前总是返回结构化 issues
```
</details>

#### `tool_input_schema:tools:fix_line773`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `fix`
  - Line: 773
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `d972a96f186aa315...`
- **Budget**: 14 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
M1 不自动修复，只返回建议
```
</details>

#### `tool_input_schema:tools:migrate_todos_line774`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `migrate_todos`
  - Line: 774
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `c7bd0e91e455ba60...`
- **Budget**: 42 chars / ~11 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：把旧模板 TODO 占位精确迁移为 <!-- FILL: ... --> 哨兵
```
</details>

#### `tool_input_schema:tools:migrate_summaries_line775`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `migrate_summaries`
  - Line: 775
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `b22e2c75b5681686...`
- **Budget**: 42 chars / ~11 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：删除旧式目录级摘要文件 .abstract.md / .overview.md
```
</details>

#### `tool_input_schema:tools:gc_agents_line776`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `gc_agents`
  - Line: 776
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `b16ed1e1fb0bb443...`
- **Budget**: 39 chars / ~10 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：显式清理已判 dead 且名下无未过期 claim 的 agent 记录
```
</details>

#### `tool_input_schema:tools:event_line814`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `event`
  - Line: 814
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `3f3f769e1c1a9b32...`
- **Budget**: 28 chars / ~7 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
事件名，例如 task.update.completed
```
</details>

#### `tool_input_schema:tools:payload_line815`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `payload`
  - Line: 815
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `733d0e5d64a1ed5c...`
- **Budget**: 28 chars / ~7 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选 payload，会注入 LRNEV_PAYLOAD
```
</details>

#### `tool_input_schema:tools:lines_line828`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `lines`
  - Line: 828
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `d13dc42b1b4b08a0...`
- **Budget**: 44 chars / ~11 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
可选：读取最近 N 条 hook 日志，默认使用配置 recent_list_limit
```
</details>

#### `tool_input_schema:tools:unknown_line840`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `unknown`
  - Line: 840
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `a7913ec1ef9c3e77...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Hook 名称
```
</details>

#### `tool_input_schema:tools:unknown_line851`

- **Source**: `src/mcp/tools/index.ts`
  - Field: `unknown`
  - Line: 851
- **Trigger**: Tool input validation
- **Consumer**: both
- **Content Hash**: `a7913ec1ef9c3e77...`
- **Budget**: 7 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: lrnev
- **Enforcement**: server_enforced
- **Capability Note**: Zod schema description for field validation

<details>
<summary>Content Preview</summary>

```
Hook 名称
```
</details>

### ai_followup

#### `ai_followup:inline:followup_1`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 589
- **Trigger**: Tool result with ai_followup
- **Consumer**: model
- **Content Hash**: `b6eb4492ec23ef9c...`
- **Budget**: 128 chars / ~32 tokens
- **Role**: ACTION_HINT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: Inline ai_followup in tool result

<details>
<summary>Content Preview</summary>

```

        instructions: [
          'error_search 是零模型关键词检索、无语义召回：未命中时请换记录原文的关键词/错误码/文件名重试，不要用近义改述（I-14）。',
        ],
      
```
</details>

#### `ai_followup:inline:followup_2`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 906
- **Trigger**: Tool result with ai_followup
- **Consumer**: model
- **Content Hash**: `5cc41e15813a9924...`
- **Budget**: 179 chars / ~45 tokens
- **Role**: ACTION_HINT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: Inline ai_followup in tool result

<details>
<summary>Content Preview</summary>

```

      instructions: [
        '返回数组是全量平铺：含 parent 字段的是子任务；顶层视图用 task.parent === undefined 过滤。',
        '父任务的 children 字段是冗余视图，便于直接渲染层级；不要把 children 内的项再算一次。',
      ],
    
```
</details>

#### `ai_followup:inline:followup_3`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 918
- **Trigger**: Tool result with ai_followup
- **Consumer**: model
- **Content Hash**: `e138860cb2cf279c...`
- **Budget**: 262 chars / ~66 tokens
- **Role**: ACTION_HINT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: Inline ai_followup in tool result

<details>
<summary>Content Preview</summary>

```

      ...response.ai_followup,
      instructions: [
        ...(response.ai_followup?.instructions ?? []),
        'active_agents 里的 active_claims 显示谁正在做哪个 Task；free_tasks_count/claimable_next 给出当前可领的 pending task，claim 只做软占用，文件重叠需要你自己确认。',
      ],
    
```
</details>

#### `ai_followup:inline:followup_4`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 942
- **Trigger**: Tool result with ai_followup
- **Consumer**: model
- **Content Hash**: `8a2e5ffeb77c7017...`
- **Budget**: 62 chars / ~16 tokens
- **Role**: ACTION_HINT
- **Provenance**: lrnev
- **Enforcement**: none
- **Capability Note**: Inline ai_followup in tool result

<details>
<summary>Content Preview</summary>

```

        instructions: [
          `检测到 ${brokenItems.length
```
</details>

### tool_annotations

#### `tool_annotations:metadata:annotations_1`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 104
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80422ca059003efd...`
- **Budget**: 87 chars / ~22 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_2`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_3`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_4`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_5`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_6`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_7`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_8`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_9`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_10`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_11`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_12`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_13`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_14`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_15`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_16`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_17`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_18`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_19`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_20`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_21`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_22`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_23`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_24`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_25`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_26`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_27`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_28`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_29`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_30`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_31`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 675
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `5b160b9bec57eea3...`
- **Budget**: 66 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: true, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_32`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 188
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `2d4bae8a70f9ea56...`
- **Budget**: 68 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_33`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_34`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_35`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_36`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_37`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_38`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_39`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 817
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `7347ee4eb02c3be6...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: false, openWorldHint: true 
```
</details>

#### `tool_annotations:metadata:annotations_40`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 138
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `80430210f381568c...`
- **Budget**: 65 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
readOnlyHint: true, destructiveHint: false, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_41`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

#### `tool_annotations:metadata:annotations_42`

- **Source**: `src/mcp/tools/index.ts`
  - Line: 122
- **Trigger**: Tool registration
- **Consumer**: client
- **Content Hash**: `cd5cff2c2782af5a...`
- **Budget**: 67 chars / ~17 tokens
- **Role**: RECOMMENDATION
- **Provenance**: lrnev
- **Enforcement**: client_boundary
- **Capability Note**: MCP annotations are hints, not enforcement

<details>
<summary>Content Preview</summary>

```
destructiveHint: false, idempotentHint: true, openWorldHint: false 
```
</details>

### mcp_resource

#### `mcp_resource:definition:project`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 17
- **Trigger**: MCP resource read: context://project
- **Consumer**: both
- **Content Hash**: `d963b4a2ce82ba17...`
- **Budget**: 6 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://project

<details>
<summary>Content Preview</summary>

```
项目全局概述
```
</details>

#### `mcp_resource:definition:project_architecture`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 18
- **Trigger**: MCP resource read: context://project/architecture
- **Consumer**: both
- **Content Hash**: `a208a43d9a45676f...`
- **Budget**: 6 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://project/architecture

<details>
<summary>Content Preview</summary>

```
项目全局架构
```
</details>

#### `mcp_resource:definition:auto_codebase`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 19
- **Trigger**: MCP resource read: context://auto/codebase
- **Consumer**: both
- **Content Hash**: `1225232d5a595021...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://auto/codebase

<details>
<summary>Content Preview</summary>

```
自动分析的代码库信息
```
</details>

#### `mcp_resource:definition:steering_core`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 20
- **Trigger**: MCP resource read: context://steering/core
- **Consumer**: both
- **Content Hash**: `181c994acfaea610...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://steering/core

<details>
<summary>Content Preview</summary>

```
AI 核心行为原则
```
</details>

#### `mcp_resource:definition:steering_scope`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 21
- **Trigger**: MCP resource read: context://steering/scope
- **Consumer**: both
- **Content Hash**: `cdd504e08f2415b9...`
- **Budget**: 25 chars / ~7 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://steering/scope

<details>
<summary>Content Preview</summary>

```
global / scene scope 判定规则
```
</details>

#### `mcp_resource:definition:steering_adr`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 22
- **Trigger**: MCP resource read: context://steering/adr
- **Consumer**: both
- **Content Hash**: `e595e3169592d581...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://steering/adr

<details>
<summary>Content Preview</summary>

```
ADR 触发规则
```
</details>

#### `mcp_resource:definition:steering_memory`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 23
- **Trigger**: MCP resource read: context://steering/memory
- **Consumer**: both
- **Content Hash**: `2600c4181b616297...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://steering/memory

<details>
<summary>Content Preview</summary>

```
记忆提取触发规则
```
</details>

#### `mcp_resource:definition:scene_list`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 24
- **Trigger**: MCP resource read: context://scene
- **Consumer**: both
- **Content Hash**: `bb9ac261951d8a9e...`
- **Budget**: 8 chars / ~2 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://scene

<details>
<summary>Content Preview</summary>

```
Scene 列表
```
</details>

#### `mcp_resource:definition:adr_list`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 25
- **Trigger**: MCP resource read: context://adr
- **Consumer**: both
- **Content Hash**: `63d38bffe918389b...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://adr

<details>
<summary>Content Preview</summary>

```
全局 ADR 索引
```
</details>

#### `mcp_resource:definition:scene`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 29
- **Trigger**: MCP resource read: context://scene/{scene}
- **Consumer**: both
- **Content Hash**: `e99d984551da1593...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://scene/{scene}

<details>
<summary>Content Preview</summary>

```
Scene 主文档
```
</details>

#### `mcp_resource:definition:scene_architecture`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 30
- **Trigger**: MCP resource read: context://scene/{scene}/architecture
- **Consumer**: both
- **Content Hash**: `e8182da0ba14793f...`
- **Budget**: 10 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://scene/{scene}/architecture

<details>
<summary>Content Preview</summary>

```
Scene 架构文档
```
</details>

#### `mcp_resource:definition:scene_roadmap`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 31
- **Trigger**: MCP resource read: context://scene/{scene}/roadmap
- **Consumer**: both
- **Content Hash**: `96710ce8349541fc...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://scene/{scene}/roadmap

<details>
<summary>Content Preview</summary>

```
Scene 路线图
```
</details>

#### `mcp_resource:definition:spec_requirements`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 32
- **Trigger**: MCP resource read: context://spec/{scene}/{spec}
- **Consumer**: both
- **Content Hash**: `1ffe80ae12714095...`
- **Budget**: 20 chars / ~5 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://spec/{scene}/{spec}

<details>
<summary>Content Preview</summary>

```
Spec requirements.md
```
</details>

#### `mcp_resource:definition:spec_design`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 33
- **Trigger**: MCP resource read: context://spec/{scene}/{spec}/design
- **Consumer**: both
- **Content Hash**: `53e84daf8946182e...`
- **Budget**: 14 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://spec/{scene}/{spec}/design

<details>
<summary>Content Preview</summary>

```
Spec design.md
```
</details>

#### `mcp_resource:definition:spec_tasks`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 34
- **Trigger**: MCP resource read: context://spec/{scene}/{spec}/tasks
- **Consumer**: both
- **Content Hash**: `bcc67c040d0a3f9e...`
- **Budget**: 13 chars / ~4 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://spec/{scene}/{spec}/tasks

<details>
<summary>Content Preview</summary>

```
Spec tasks.md
```
</details>

#### `mcp_resource:definition:adr`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 35
- **Trigger**: MCP resource read: context://adr/{number}
- **Consumer**: both
- **Content Hash**: `22936a2873e9953d...`
- **Budget**: 9 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://adr/{number}

<details>
<summary>Content Preview</summary>

```
全局 ADR 文档
```
</details>

#### `mcp_resource:definition:scene_adr`

- **Source**: `src/mcp/resources/index.ts`
  - Line: 36
- **Trigger**: MCP resource read: context://scene/{scene}/adr/{number}
- **Consumer**: both
- **Content Hash**: `ba89270d99b077de...`
- **Budget**: 12 chars / ~3 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: MCP resource at context://scene/{scene}/adr/{number}

<details>
<summary>Content Preview</summary>

```
Scene ADR 文档
```
</details>

### governance_doc

#### `governance_doc:00-default:scene`

- **Source**: `.lrnev/scenes/00-default/scene.md`
- **Trigger**: Reading scene.md for scene 00-default
- **Consumer**: model
- **Content Hash**: `2a7ee1d30da454fa...`
- **Budget**: 711 chars / ~178 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: scene.md

<details>
<summary>Content Preview</summary>

```
---
id: '00-default'
number: 0
name: 'default'
status: draft
created: '2026-06-11'
intent: 'Default landing scene for specs without an explicit scene.'
---

# Default

## L0 摘要

（一句话描述这个 
```
</details>

#### `governance_doc:00-default_01-00-task-create-many:requirements`

- **Source**: `.lrnev/scenes/00-default/specs/01-00-task-create-many/requirements.md`
- **Trigger**: Reading requirements.md for spec 00-default/01-00-task-create-many
- **Consumer**: model
- **Content Hash**: `50d33722c729c97e...`
- **Budget**: 3906 chars / ~977 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 01-00-task-create-many
scene: 00-default
status: completed
priority: P1
created: '2026-07-06'
updated: '2026-07-06'
---

# 01-00 Task Create Many - 需求

## L0 摘要

新增 task_create_many 工具/命令：sp
```
</details>

#### `governance_doc:00-default_01-00-task-create-many:design`

- **Source**: `.lrnev/scenes/00-default/specs/01-00-task-create-many/design.md`
- **Trigger**: Reading design.md for spec 00-default/01-00-task-create-many
- **Consumer**: model
- **Content Hash**: `b3d1a907c57ba7d7...`
- **Budget**: 5169 chars / ~1293 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-task-create-many'
scene: '00-default'
created: '2026-07-06'
---

# 01-00 Task Create Many - 设计

## L0 摘要

TaskManager 新增 createMany：批内先全量校验（复用单条校验逻辑 + key 解析）再一次性写入 tasks.md，MCP 新工具 t
```
</details>

#### `governance_doc:00-default_01-00-task-create-many:tasks`

- **Source**: `.lrnev/scenes/00-default/specs/01-00-task-create-many/tasks.md`
- **Trigger**: Reading tasks.md for spec 00-default/01-00-task-create-many
- **Consumer**: model
- **Content Hash**: `57acf8dada524413...`
- **Budget**: 3504 chars / ~876 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-task-create-many'
scene: '00-default'
created: '2026-07-06'
---

# 01-00 Task Create Many - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed
```
</details>

#### `governance_doc:00-default_02-00-release-audit-remediation:requirements`

- **Source**: `.lrnev/scenes/00-default/specs/02-00-release-audit-remediation/requirements.md`
- **Trigger**: Reading requirements.md for spec 00-default/02-00-release-audit-remediation
- **Consumer**: model
- **Content Hash**: `ae1f14be0431a67a...`
- **Budget**: 5473 chars / ~1369 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 02-00-release-audit-remediation
scene: 00-default
status: completed
priority: P1
created: '2026-07-06'
updated: '2026-07-06'
---

# 02-00 Release Audit Remediation - 需求

## L0 摘要

v2.3.0
```
</details>

#### `governance_doc:00-default_02-00-release-audit-remediation:design`

- **Source**: `.lrnev/scenes/00-default/specs/02-00-release-audit-remediation/design.md`
- **Trigger**: Reading design.md for spec 00-default/02-00-release-audit-remediation
- **Consumer**: model
- **Content Hash**: `67147ee4d0f167df...`
- **Budget**: 3307 chars / ~827 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '02-00-release-audit-remediation'
scene: '00-default'
created: '2026-07-06'
---

# 02-00 Release Audit Remediation - 设计

## L0 摘要

纯文本层收口为主（guidance 字符串、followup 拼装、Markdown 文档），仅两处小行为变更（was
```
</details>

#### `governance_doc:00-default_02-00-release-audit-remediation:tasks`

- **Source**: `.lrnev/scenes/00-default/specs/02-00-release-audit-remediation/tasks.md`
- **Trigger**: Reading tasks.md for spec 00-default/02-00-release-audit-remediation
- **Consumer**: model
- **Content Hash**: `d0b76817ee4af4ea...`
- **Budget**: 4072 chars / ~1018 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '02-00-release-audit-remediation'
scene: '00-default'
created: '2026-07-06'
---

# 02-00 Release Audit Remediation - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → 
```
</details>

#### `governance_doc:01-findings-remediation:scene`

- **Source**: `.lrnev/scenes/01-findings-remediation/scene.md`
- **Trigger**: Reading scene.md for scene 01-findings-remediation
- **Consumer**: model
- **Content Hash**: `acf867795f29943c...`
- **Budget**: 1687 chars / ~422 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: scene.md

<details>
<summary>Content Preview</summary>

```
---
id: '01-findings-remediation'
number: 1
name: 'findings-remediation'
status: draft
created: '2026-06-11'
intent: '落实 2026-06-11 全面测试发现的清单:CLI/MCP对齐、确定性硬校验、引用软提醒、启发式打磨、维护可见性、design锚点规范化、治理边界文
```
</details>

#### `governance_doc:01-findings-remediation:architecture`

- **Source**: `.lrnev/scenes/01-findings-remediation/architecture.md`
- **Trigger**: Reading architecture.md for scene 01-findings-remediation
- **Consumer**: model
- **Content Hash**: `6450c7950a0794a9...`
- **Budget**: 2064 chars / ~516 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: architecture.md

<details>
<summary>Content Preview</summary>

```
---
scene: '01-findings-remediation'
created: '2026-06-11'
---

# Findings Remediation - 架构

> 本文档描述本 Scene 内所有 Spec 共享的架构约束。
> 单个 Spec 的具体设计在各自的 design.md 中。

## L0 摘要

7 个修复 Spec 共享一条总纲—
```
</details>

#### `governance_doc:01-findings-remediation:roadmap`

- **Source**: `.lrnev/scenes/01-findings-remediation/roadmap.md`
- **Trigger**: Reading roadmap.md for scene 01-findings-remediation
- **Consumer**: model
- **Content Hash**: `67d98763dc4b20c5...`
- **Budget**: 1529 chars / ~383 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: roadmap.md

<details>
<summary>Content Preview</summary>

```
---
scene: '01-findings-remediation'
created: '2026-06-11'
---

# Findings Remediation - 路线图

> 本 Scene 的中长期规划。Spec 是路线图的具体实施。

## 当前阶段

需求定义完成、待实现。7 个 Spec 的 requirements 已全部填写并通过 ready ga
```
</details>

#### `governance_doc:01-findings-remediation_01-00-cli-mcp-parity:requirements`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/01-00-cli-mcp-parity/requirements.md`
- **Trigger**: Reading requirements.md for spec 01-findings-remediation/01-00-cli-mcp-parity
- **Consumer**: model
- **Content Hash**: `9a2ceddad416e525...`
- **Budget**: 2996 chars / ~749 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 01-00-cli-mcp-parity
scene: 01-findings-remediation
status: completed
priority: P1
created: '2026-06-11'
updated: '2026-06-12'
---

# 01-00 Cli Mcp Parity - 需求

> 权威依据：`dev-docs/F
```
</details>

#### `governance_doc:01-findings-remediation_01-00-cli-mcp-parity:design`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/01-00-cli-mcp-parity/design.md`
- **Trigger**: Reading design.md for spec 01-findings-remediation/01-00-cli-mcp-parity
- **Consumer**: model
- **Content Hash**: `3bc813a5089dedc4...`
- **Budget**: 2525 chars / ~632 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-cli-mcp-parity'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 01-00 Cli Mcp Parity - 设计

## L0 摘要

把 MCP 独有的 spec_get 开新版引导下沉到 core 共享层供两路复用，CLI task create 
```
</details>

#### `governance_doc:01-findings-remediation_01-00-cli-mcp-parity:tasks`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/01-00-cli-mcp-parity/tasks.md`
- **Trigger**: Reading tasks.md for spec 01-findings-remediation/01-00-cli-mcp-parity
- **Consumer**: model
- **Content Hash**: `b7b72069bc18ac21...`
- **Budget**: 1688 chars / ~422 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-cli-mcp-parity'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 01-00 Cli Mcp Parity - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → 
```
</details>

#### `governance_doc:01-findings-remediation_02-00-deterministic-hard-checks:requirements`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/02-00-deterministic-hard-checks/requirements.md`
- **Trigger**: Reading requirements.md for spec 01-findings-remediation/02-00-deterministic-hard-checks
- **Consumer**: model
- **Content Hash**: `da8721dd3ca8e6be...`
- **Budget**: 3335 chars / ~834 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 02-00-deterministic-hard-checks
scene: 01-findings-remediation
status: completed
priority: P0
created: '2026-06-11'
updated: '2026-06-12'
---

# 02-00 Deterministic Hard Checks - 需求
```
</details>

#### `governance_doc:01-findings-remediation_02-00-deterministic-hard-checks:design`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/02-00-deterministic-hard-checks/design.md`
- **Trigger**: Reading design.md for spec 01-findings-remediation/02-00-deterministic-hard-checks
- **Consumer**: model
- **Content Hash**: `4aeb0462d9954500...`
- **Budget**: 3672 chars / ~918 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '02-00-deterministic-hard-checks'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 02-00 Deterministic Hard Checks - 设计

## L0 摘要

在三个写入/校验点（completion gate、summarize_
```
</details>

#### `governance_doc:01-findings-remediation_02-00-deterministic-hard-checks:tasks`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/02-00-deterministic-hard-checks/tasks.md`
- **Trigger**: Reading tasks.md for spec 01-findings-remediation/02-00-deterministic-hard-checks
- **Consumer**: model
- **Content Hash**: `e52dba715fa480e3...`
- **Budget**: 2595 chars / ~649 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '02-00-deterministic-hard-checks'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 02-00 Deterministic Hard Checks - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pe
```
</details>

#### `governance_doc:01-findings-remediation_03-00-reference-soft-reminders:requirements`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/03-00-reference-soft-reminders/requirements.md`
- **Trigger**: Reading requirements.md for spec 01-findings-remediation/03-00-reference-soft-reminders
- **Consumer**: model
- **Content Hash**: `398e546b56d66f78...`
- **Budget**: 2479 chars / ~620 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 03-00-reference-soft-reminders
scene: 01-findings-remediation
status: completed
priority: P1
created: '2026-06-11'
updated: '2026-06-12'
---

# 03-00 Reference Soft Reminders - 需求

```
</details>

#### `governance_doc:01-findings-remediation_03-00-reference-soft-reminders:design`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/03-00-reference-soft-reminders/design.md`
- **Trigger**: Reading design.md for spec 01-findings-remediation/03-00-reference-soft-reminders
- **Consumer**: model
- **Content Hash**: `64f414ac9d6befb4...`
- **Budget**: 1984 chars / ~496 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '03-00-reference-soft-reminders'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 03-00 Reference Soft Reminders - 设计

## L0 摘要

在 `TaskManager.buildFollowupAfterUpdat
```
</details>

#### `governance_doc:01-findings-remediation_03-00-reference-soft-reminders:tasks`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/03-00-reference-soft-reminders/tasks.md`
- **Trigger**: Reading tasks.md for spec 01-findings-remediation/03-00-reference-soft-reminders
- **Consumer**: model
- **Content Hash**: `009a24910ee77f3d...`
- **Budget**: 1631 chars / ~408 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '03-00-reference-soft-reminders'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 03-00 Reference Soft Reminders - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pend
```
</details>

#### `governance_doc:01-findings-remediation_04-00-heuristic-polish:requirements`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/04-00-heuristic-polish/requirements.md`
- **Trigger**: Reading requirements.md for spec 01-findings-remediation/04-00-heuristic-polish
- **Consumer**: model
- **Content Hash**: `1b13e1d5b801e0db...`
- **Budget**: 2599 chars / ~650 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 04-00-heuristic-polish
scene: 01-findings-remediation
status: completed
priority: P2
created: '2026-06-11'
updated: '2026-06-12'
---

# 04-00 Heuristic Polish - 需求

> 权威依据：`dev-do
```
</details>

#### `governance_doc:01-findings-remediation_04-00-heuristic-polish:design`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/04-00-heuristic-polish/design.md`
- **Trigger**: Reading design.md for spec 01-findings-remediation/04-00-heuristic-polish
- **Consumer**: model
- **Content Hash**: `febb72e1d205e5d3...`
- **Budget**: 1966 chars / ~492 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '04-00-heuristic-polish'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 04-00 Heuristic Polish - 设计

## L0 摘要

两处零模型启发式微调：in_progress 的并行提示改为按弱信号有条件追加（`TaskManager`）
```
</details>

#### `governance_doc:01-findings-remediation_04-00-heuristic-polish:tasks`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/04-00-heuristic-polish/tasks.md`
- **Trigger**: Reading tasks.md for spec 01-findings-remediation/04-00-heuristic-polish
- **Consumer**: model
- **Content Hash**: `4751690a2f0070f8...`
- **Budget**: 1267 chars / ~317 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '04-00-heuristic-polish'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 04-00 Heuristic Polish - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progres
```
</details>

#### `governance_doc:01-findings-remediation_05-00-maintenance-visibility:requirements`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/05-00-maintenance-visibility/requirements.md`
- **Trigger**: Reading requirements.md for spec 01-findings-remediation/05-00-maintenance-visibility
- **Consumer**: model
- **Content Hash**: `6ee4cdb9be5c9452...`
- **Budget**: 2837 chars / ~710 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 05-00-maintenance-visibility
scene: 01-findings-remediation
status: completed
priority: P2
created: '2026-06-11'
updated: '2026-06-12'
---

# 05-00 Maintenance Visibility - 需求

> 
```
</details>

#### `governance_doc:01-findings-remediation_05-00-maintenance-visibility:design`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/05-00-maintenance-visibility/design.md`
- **Trigger**: Reading design.md for spec 01-findings-remediation/05-00-maintenance-visibility
- **Consumer**: model
- **Content Hash**: `ea36d3b35cc47410...`
- **Budget**: 2480 chars / ~620 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '05-00-maintenance-visibility'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 05-00 Maintenance Visibility - 设计

## L0 摘要

新增显式 dead-agent GC 维护命令（只清 dead 且无活跃 claim
```
</details>

#### `governance_doc:01-findings-remediation_05-00-maintenance-visibility:tasks`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/05-00-maintenance-visibility/tasks.md`
- **Trigger**: Reading tasks.md for spec 01-findings-remediation/05-00-maintenance-visibility
- **Consumer**: model
- **Content Hash**: `a9d03fd9245c22cd...`
- **Budget**: 1750 chars / ~438 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '05-00-maintenance-visibility'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 05-00 Maintenance Visibility - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending 
```
</details>

#### `governance_doc:01-findings-remediation_06-00-design-anchor-d-xx:requirements`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/06-00-design-anchor-d-xx/requirements.md`
- **Trigger**: Reading requirements.md for spec 01-findings-remediation/06-00-design-anchor-d-xx
- **Consumer**: model
- **Content Hash**: `819e98b8c37c6279...`
- **Budget**: 3743 chars / ~936 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 06-00-design-anchor-d-xx
scene: 01-findings-remediation
status: completed
priority: P1
created: '2026-06-11'
updated: '2026-06-12'
---

# 06-00 Design Anchor D Xx - 需求

> 权威依据：`de
```
</details>

#### `governance_doc:01-findings-remediation_06-00-design-anchor-d-xx:design`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/06-00-design-anchor-d-xx/design.md`
- **Trigger**: Reading design.md for spec 01-findings-remediation/06-00-design-anchor-d-xx
- **Consumer**: model
- **Content Hash**: `b5001da6f03dab08...`
- **Budget**: 3772 chars / ~943 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '06-00-design-anchor-d-xx'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 06-00 Design Anchor D Xx - 设计

## L0 摘要

把 validates 从自由字符串收紧为只认 F-xx/D-xx 的结构化锚点：格式校验 + 存在
```
</details>

#### `governance_doc:01-findings-remediation_06-00-design-anchor-d-xx:tasks`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/06-00-design-anchor-d-xx/tasks.md`
- **Trigger**: Reading tasks.md for spec 01-findings-remediation/06-00-design-anchor-d-xx
- **Consumer**: model
- **Content Hash**: `694f875c471178f1...`
- **Budget**: 3042 chars / ~761 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '06-00-design-anchor-d-xx'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 06-00 Design Anchor D Xx - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_pro
```
</details>

#### `governance_doc:01-findings-remediation_07-00-governance-boundary-docs:requirements`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/07-00-governance-boundary-docs/requirements.md`
- **Trigger**: Reading requirements.md for spec 01-findings-remediation/07-00-governance-boundary-docs
- **Consumer**: model
- **Content Hash**: `f419b8f76f13bc85...`
- **Budget**: 2072 chars / ~518 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 07-00-governance-boundary-docs
scene: 01-findings-remediation
status: completed
priority: P2
created: '2026-06-11'
updated: '2026-06-12'
---

# 07-00 Governance Boundary Docs - 需求

```
</details>

#### `governance_doc:01-findings-remediation_07-00-governance-boundary-docs:design`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/07-00-governance-boundary-docs/design.md`
- **Trigger**: Reading design.md for spec 01-findings-remediation/07-00-governance-boundary-docs
- **Consumer**: model
- **Content Hash**: `0a433220fc56c471...`
- **Budget**: 1357 chars / ~340 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '07-00-governance-boundary-docs'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 07-00 Governance Boundary Docs - 设计

## L0 摘要

把三条 by-design 边界（序号复用→用完整 ID、ready gat
```
</details>

#### `governance_doc:01-findings-remediation_07-00-governance-boundary-docs:tasks`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/07-00-governance-boundary-docs/tasks.md`
- **Trigger**: Reading tasks.md for spec 01-findings-remediation/07-00-governance-boundary-docs
- **Consumer**: model
- **Content Hash**: `754a24fa78caa45d...`
- **Budget**: 1263 chars / ~316 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '07-00-governance-boundary-docs'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 07-00 Governance Boundary Docs - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pend
```
</details>

#### `governance_doc:01-findings-remediation_08-00-guidance-semantic-boundary:requirements`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/08-00-guidance-semantic-boundary/requirements.md`
- **Trigger**: Reading requirements.md for spec 01-findings-remediation/08-00-guidance-semantic-boundary
- **Consumer**: model
- **Content Hash**: `d00a8d3804c20ce9...`
- **Budget**: 6221 chars / ~1556 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: '08-00-guidance-semantic-boundary'
scene: '01-findings-remediation'
status: draft
priority: P0
created: '2026-08-26'
---

# 08-00 Guidance Semantic Boundary - 需求

## L0 摘要

明确区分 guidance 中的”
```
</details>

#### `governance_doc:01-findings-remediation_08-00-guidance-semantic-boundary:design`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/08-00-guidance-semantic-boundary/design.md`
- **Trigger**: Reading design.md for spec 01-findings-remediation/08-00-guidance-semantic-boundary
- **Consumer**: model
- **Content Hash**: `5fe98b6636a67391...`
- **Budget**: 7023 chars / ~1756 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '08-00-guidance-semantic-boundary'
scene: '01-findings-remediation'
created: '2026-08-26'
---

# 08-00 Guidance Semantic Boundary - 设计

## L0 摘要

纯文案修复 + 测试补充：修改 6 处 guidance 文案，补充
```
</details>

#### `governance_doc:01-findings-remediation_08-00-guidance-semantic-boundary:tasks`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/08-00-guidance-semantic-boundary/tasks.md`
- **Trigger**: Reading tasks.md for spec 01-findings-remediation/08-00-guidance-semantic-boundary
- **Consumer**: model
- **Content Hash**: `6abcaaa46299273d...`
- **Budget**: 2456 chars / ~614 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '08-00-guidance-semantic-boundary'
scene: '01-findings-remediation'
created: '2026-08-26'
---

# 08-00 Guidance Semantic Boundary - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending →
```
</details>

#### `governance_doc:01-findings-remediation_09-00-structured-ai-followup:requirements`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/09-00-structured-ai-followup/requirements.md`
- **Trigger**: Reading requirements.md for spec 01-findings-remediation/09-00-structured-ai-followup
- **Consumer**: model
- **Content Hash**: `2191f08a93518a62...`
- **Budget**: 5997 chars / ~1500 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: '09-00-structured-ai-followup'
scene: '01-findings-remediation'
status: draft
priority: P1
created: '2026-08-26'
---

# 09-00 Structured Ai Followup - 需求

> **⚠️ 当前状态：暂缓执行，待重写**
>
> 经过 GPT 和
```
</details>

#### `governance_doc:01-findings-remediation_09-00-structured-ai-followup:design`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/09-00-structured-ai-followup/design.md`
- **Trigger**: Reading design.md for spec 01-findings-remediation/09-00-structured-ai-followup
- **Consumer**: model
- **Content Hash**: `09596ad1022f1a6f...`
- **Budget**: 13803 chars / ~3451 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '09-00-structured-ai-followup'
scene: '01-findings-remediation'
created: '2026-08-26'
---

# 09-00 Structured Ai Followup - 设计

> **⚠️ 当前状态：暂缓执行，待重写**
>
> 当前设计不应执行，详见 requirements.
```
</details>

#### `governance_doc:01-findings-remediation_09-00-structured-ai-followup:tasks`

- **Source**: `.lrnev/scenes/01-findings-remediation/specs/09-00-structured-ai-followup/tasks.md`
- **Trigger**: Reading tasks.md for spec 01-findings-remediation/09-00-structured-ai-followup
- **Consumer**: model
- **Content Hash**: `a8cb6982976d06ae...`
- **Budget**: 456 chars / ~114 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '09-00-structured-ai-followup'
scene: '01-findings-remediation'
created: '2026-08-26'
---

# 09-00 Structured Ai Followup - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_prog
```
</details>

#### `governance_doc:02-context-delivery:scene`

- **Source**: `.lrnev/scenes/02-context-delivery/scene.md`
- **Trigger**: Reading scene.md for scene 02-context-delivery
- **Consumer**: model
- **Content Hash**: `420f6ba42ee12d83...`
- **Budget**: 2556 chars / ~639 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: scene.md

<details>
<summary>Content Preview</summary>

```
---
id: '02-context-delivery'
number: 2
name: 'context-delivery'
status: draft
created: '2026-06-15'
intent: '把治理数据在正确时刻送进AI上下文;解决维护态缺口(小增量落位)与需求审核(新开spec停一步)两大问题'
---

# Context Delivery

## L0 摘要

把
```
</details>

#### `governance_doc:02-context-delivery:architecture`

- **Source**: `.lrnev/scenes/02-context-delivery/architecture.md`
- **Trigger**: Reading architecture.md for scene 02-context-delivery
- **Consumer**: model
- **Content Hash**: `b89629f7564af116...`
- **Budget**: 2071 chars / ~518 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: architecture.md

<details>
<summary>Content Preview</summary>

```
---
scene: '02-context-delivery'
created: '2026-06-15'
---

# Context Delivery - 架构

> 本文档描述本 Scene 内所有 Spec 共享的架构约束。
> 单个 Spec 的具体设计在各自的 design.md 中。

## L0 摘要

零模型、零新依赖：复用 `ai_followup` 协议与 scene 01
```
</details>

#### `governance_doc:02-context-delivery:roadmap`

- **Source**: `.lrnev/scenes/02-context-delivery/roadmap.md`
- **Trigger**: Reading roadmap.md for scene 02-context-delivery
- **Consumer**: model
- **Content Hash**: `30c97cb24da94f16...`
- **Budget**: 3163 chars / ~791 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: roadmap.md

<details>
<summary>Content Preview</summary>

```
---
scene: '02-context-delivery'
created: '2026-06-15'
---

# Context Delivery - 路线图

> 本 Scene 的中长期规划。Spec 是路线图的具体实施。
> 业务线：把治理数据在正确时刻送进 AI 上下文。
> 战略依据：`dev-docs/PRODUCT-STRATEGY.md`（战略四步）+ `dev-docs
```
</details>

#### `governance_doc:02-context-delivery_01-00-maintenance-flow-and-review-gate:requirements`

- **Source**: `.lrnev/scenes/02-context-delivery/specs/01-00-maintenance-flow-and-review-gate/requirements.md`
- **Trigger**: Reading requirements.md for spec 02-context-delivery/01-00-maintenance-flow-and-review-gate
- **Consumer**: model
- **Content Hash**: `4cd77bef13a80094...`
- **Budget**: 8247 chars / ~2062 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 01-00-maintenance-flow-and-review-gate
scene: 02-context-delivery
status: completed
priority: P0
created: '2026-06-15'
updated: '2026-06-18'
---

# 01-00 维护态流程 + 需求审核门 + 任务启动上下文 - 需求

> 权威依据
```
</details>

#### `governance_doc:02-context-delivery_01-00-maintenance-flow-and-review-gate:design`

- **Source**: `.lrnev/scenes/02-context-delivery/specs/01-00-maintenance-flow-and-review-gate/design.md`
- **Trigger**: Reading design.md for spec 02-context-delivery/01-00-maintenance-flow-and-review-gate
- **Consumer**: model
- **Content Hash**: `aca342ac4af22e7d...`
- **Budget**: 4214 chars / ~1054 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-maintenance-flow-and-review-gate'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 01-00 维护态流程 + 需求审核门 + 任务启动上下文 - 设计

> 设计依据：已核源码（`src/core/TaskManager.ts`、`src/core/GateRun
```
</details>

#### `governance_doc:02-context-delivery_01-00-maintenance-flow-and-review-gate:tasks`

- **Source**: `.lrnev/scenes/02-context-delivery/specs/01-00-maintenance-flow-and-review-gate/tasks.md`
- **Trigger**: Reading tasks.md for spec 02-context-delivery/01-00-maintenance-flow-and-review-gate
- **Consumer**: model
- **Content Hash**: `8d5aef4d850d7257...`
- **Budget**: 4595 chars / ~1149 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-maintenance-flow-and-review-gate'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 01-00 维护态流程 + 需求审核门 + 任务启动上下文 - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → 
```
</details>

#### `governance_doc:02-context-delivery_02-00-locator-upgrade:requirements`

- **Source**: `.lrnev/scenes/02-context-delivery/specs/02-00-locator-upgrade/requirements.md`
- **Trigger**: Reading requirements.md for spec 02-context-delivery/02-00-locator-upgrade
- **Consumer**: model
- **Content Hash**: `848d46e86cd007a8...`
- **Budget**: 4602 chars / ~1151 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 02-00-locator-upgrade
scene: 02-context-delivery
status: completed
priority: P1
created: '2026-06-15'
updated: '2026-06-18'
---

# 02-00 定位升级：治理地图 + 锚点抽段 + BM25 - 需求

> 权威依据：`dev-docs/NEXT-S
```
</details>

#### `governance_doc:02-context-delivery_02-00-locator-upgrade:design`

- **Source**: `.lrnev/scenes/02-context-delivery/specs/02-00-locator-upgrade/design.md`
- **Trigger**: Reading design.md for spec 02-context-delivery/02-00-locator-upgrade
- **Consumer**: model
- **Content Hash**: `e522714ecd7a16f7...`
- **Budget**: 2644 chars / ~661 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '02-00-locator-upgrade'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 02-00 定位升级：治理地图 + 锚点抽段 + BM25 - 设计

> 设计依据：已核源码 `src/core/Searcher.ts`（`scoreText:91`、`makeSnippet:127`、`lev
```
</details>

#### `governance_doc:02-context-delivery_02-00-locator-upgrade:tasks`

- **Source**: `.lrnev/scenes/02-context-delivery/specs/02-00-locator-upgrade/tasks.md`
- **Trigger**: Reading tasks.md for spec 02-context-delivery/02-00-locator-upgrade
- **Consumer**: model
- **Content Hash**: `2b50e216fb02fb74...`
- **Budget**: 3090 chars / ~773 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '02-00-locator-upgrade'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 02-00 定位升级：治理地图 + 锚点抽段 + BM25 - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → com
```
</details>

#### `governance_doc:02-context-delivery_03-00-governance-report:requirements`

- **Source**: `.lrnev/scenes/02-context-delivery/specs/03-00-governance-report/requirements.md`
- **Trigger**: Reading requirements.md for spec 02-context-delivery/03-00-governance-report
- **Consumer**: model
- **Content Hash**: `b4035583d36a1264...`
- **Budget**: 6766 chars / ~1692 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 03-00-governance-report
scene: 02-context-delivery
status: completed
priority: P2
created: '2026-06-15'
updated: '2026-06-18'
---

# 03-00 Governance Report - 需求

## L0 摘要

新增 `lrnev report`
```
</details>

#### `governance_doc:02-context-delivery_03-00-governance-report:design`

- **Source**: `.lrnev/scenes/02-context-delivery/specs/03-00-governance-report/design.md`
- **Trigger**: Reading design.md for spec 02-context-delivery/03-00-governance-report
- **Consumer**: model
- **Content Hash**: `2bbcc2de42ce4080...`
- **Budget**: 8962 chars / ~2241 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '03-00-governance-report'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 03-00 Governance Report - 设计

## L0 摘要

新增 `GovernanceReport` core 类（仿 `GovernanceMap`/`ProjectStatus`：自己扫
```
</details>

#### `governance_doc:02-context-delivery_03-00-governance-report:tasks`

- **Source**: `.lrnev/scenes/02-context-delivery/specs/03-00-governance-report/tasks.md`
- **Trigger**: Reading tasks.md for spec 02-context-delivery/03-00-governance-report
- **Consumer**: model
- **Content Hash**: `4633e96a66684c8d...`
- **Budget**: 5036 chars / ~1259 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '03-00-governance-report'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 03-00 Governance Report - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → complet
```
</details>

#### `governance_doc:03-workspace-hygiene:scene`

- **Source**: `.lrnev/scenes/03-workspace-hygiene/scene.md`
- **Trigger**: Reading scene.md for scene 03-workspace-hygiene
- **Consumer**: model
- **Content Hash**: `bfecd99de575cc1b...`
- **Budget**: 679 chars / ~170 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: scene.md

<details>
<summary>Content Preview</summary>

```
---
id: '03-workspace-hygiene'
number: 3
name: 'workspace-hygiene'
status: draft
created: '2026-07-06'
intent: '工作区运行态卫生：registry/claims 等运行态残留的自动清理与文件真相维护'
---

# Workspace Hygiene

## L0 摘要

（一句话描述这
```
</details>

#### `governance_doc:03-workspace-hygiene:architecture`

- **Source**: `.lrnev/scenes/03-workspace-hygiene/architecture.md`
- **Trigger**: Reading architecture.md for scene 03-workspace-hygiene
- **Consumer**: model
- **Content Hash**: `4a3a987a75f22aef...`
- **Budget**: 426 chars / ~107 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: architecture.md

<details>
<summary>Content Preview</summary>

```
---
scene: '03-workspace-hygiene'
created: '2026-07-06'
---

# Workspace Hygiene - 架构

> 本文档描述本 Scene 内所有 Spec 共享的架构约束。
> 单个 Spec 的具体设计在各自的 design.md 中。

## L0 摘要

（一句话总结本 Scene 的架构特点）

## L1 概览

### 
```
</details>

#### `governance_doc:03-workspace-hygiene:roadmap`

- **Source**: `.lrnev/scenes/03-workspace-hygiene/roadmap.md`
- **Trigger**: Reading roadmap.md for scene 03-workspace-hygiene
- **Consumer**: model
- **Content Hash**: `938f67596e512cf3...`
- **Budget**: 278 chars / ~70 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: roadmap.md

<details>
<summary>Content Preview</summary>

```
---
scene: '03-workspace-hygiene'
created: '2026-07-06'
---

# Workspace Hygiene - 路线图

> 本 Scene 的中长期规划。Spec 是路线图的具体实施。

## 当前阶段

（描述目前所处阶段）

## 已完成

- <!-- FILL: 路线图条目或无 -->

## 进行中

- <!-- FILL: 路线
```
</details>

#### `governance_doc:03-workspace-hygiene_01-00-auto-gc:requirements`

- **Source**: `.lrnev/scenes/03-workspace-hygiene/specs/01-00-auto-gc/requirements.md`
- **Trigger**: Reading requirements.md for spec 03-workspace-hygiene/01-00-auto-gc
- **Consumer**: model
- **Content Hash**: `f0a7ca2157cbd322...`
- **Budget**: 5143 chars / ~1286 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 01-00-auto-gc
scene: 03-workspace-hygiene
status: completed
priority: P1
created: '2026-07-06'
updated: '2026-07-06'
---

# 01-00 Auto Gc - 需求

## L0 摘要

在 agent register 时机会式清理已死 agent 记录与过
```
</details>

#### `governance_doc:03-workspace-hygiene_01-00-auto-gc:design`

- **Source**: `.lrnev/scenes/03-workspace-hygiene/specs/01-00-auto-gc/design.md`
- **Trigger**: Reading design.md for spec 03-workspace-hygiene/01-00-auto-gc
- **Consumer**: model
- **Content Hash**: `5be11f4150fedce6...`
- **Budget**: 4703 chars / ~1176 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-auto-gc'
scene: '03-workspace-hygiene'
created: '2026-07-06'
---

# 01-00 Auto Gc - 设计

## L0 摘要

在 AgentRegistry.register 的注册锁内追加一次 best-effort 清扫：复用 computeAgentStatus 双轨判死 + gc-age
```
</details>

#### `governance_doc:03-workspace-hygiene_01-00-auto-gc:tasks`

- **Source**: `.lrnev/scenes/03-workspace-hygiene/specs/01-00-auto-gc/tasks.md`
- **Trigger**: Reading tasks.md for spec 03-workspace-hygiene/01-00-auto-gc
- **Consumer**: model
- **Content Hash**: `0b50fd0a06a462b3...`
- **Budget**: 3167 chars / ~792 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-auto-gc'
scene: '03-workspace-hygiene'
created: '2026-07-06'
---

# 01-00 Auto Gc - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked
```
</details>

#### `governance_doc:04-ai-guidance-standardization:scene`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/scene.md`
- **Trigger**: Reading scene.md for scene 04-ai-guidance-standardization
- **Consumer**: model
- **Content Hash**: `949b43554e55d1d5...`
- **Budget**: 2931 chars / ~733 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: scene.md

<details>
<summary>Content Preview</summary>

```
---
id: '04-ai-guidance-standardization'
number: 4
name: 'ai-guidance-standardization'
status: draft
created: '2026-08-26'
intent: '端到端标准化 lrnev 面向客户端 AI 的治理契约：统一语义角色、MCP 结构化响应、client_asserted decisio
```
</details>

#### `governance_doc:04-ai-guidance-standardization:architecture`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/architecture.md`
- **Trigger**: Reading architecture.md for scene 04-ai-guidance-standardization
- **Consumer**: model
- **Content Hash**: `e73869e2404acea0...`
- **Budget**: 3115 chars / ~779 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: architecture.md

<details>
<summary>Content Preview</summary>

```
---
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# Ai Guidance Standardization - 架构

> 本文档描述本 Scene 内所有 Spec 共享的架构约束。
> 单个 Spec 的具体设计在各自的 design.md 中。

## L0 摘要

本 Scene 将 lrnev 
```
</details>

#### `governance_doc:04-ai-guidance-standardization:roadmap`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/roadmap.md`
- **Trigger**: Reading roadmap.md for scene 04-ai-guidance-standardization
- **Consumer**: model
- **Content Hash**: `3ff91a1670b48a8b...`
- **Budget**: 1884 chars / ~471 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Scene governance document: roadmap.md

<details>
<summary>Content Preview</summary>

```
---
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# Ai Guidance Standardization - 路线图

> 本 Scene 的中长期规划。Spec 是路线图的具体实施。

## 当前阶段

端到端结构化设计收敛阶段。Scene 已拆为 6 个 Spec：语义规范、Surface 基线、M
```
</details>

#### `governance_doc:04-ai-guidance-standardization_01-00-semantic-authority-model:requirements`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/01-00-semantic-authority-model/requirements.md`
- **Trigger**: Reading requirements.md for spec 04-ai-guidance-standardization/01-00-semantic-authority-model
- **Consumer**: model
- **Content Hash**: `5e9f8e31109a2e18...`
- **Budget**: 2745 chars / ~687 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: 01-00-semantic-authority-model
scene: 04-ai-guidance-standardization
status: in-progress
priority: P0
created: '2026-08-26'
updated: '2026-08-27'
---

# 01-00 Semantic Authority Model - 需求


```
</details>

#### `governance_doc:04-ai-guidance-standardization_01-00-semantic-authority-model:design`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/01-00-semantic-authority-model/design.md`
- **Trigger**: Reading design.md for spec 04-ai-guidance-standardization/01-00-semantic-authority-model
- **Consumer**: model
- **Content Hash**: `dd13f83353e4a91f...`
- **Budget**: 3392 chars / ~848 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-semantic-authority-model'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 01-00 Semantic Authority Model - 设计

## L0 摘要

用五种文本角色表达 guidance，用 provenance、role、enfo
```
</details>

#### `governance_doc:04-ai-guidance-standardization_01-00-semantic-authority-model:tasks`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/01-00-semantic-authority-model/tasks.md`
- **Trigger**: Reading tasks.md for spec 04-ai-guidance-standardization/01-00-semantic-authority-model
- **Consumer**: model
- **Content Hash**: `22a17d8bd9278b61...`
- **Budget**: 3773 chars / ~944 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '01-00-semantic-authority-model'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 01-00 Semantic Authority Model - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。达到 `v0.1` 五项冻
```
</details>

#### `governance_doc:04-ai-guidance-standardization_02-00-guidance-surface-inventory:requirements`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/02-00-guidance-surface-inventory/requirements.md`
- **Trigger**: Reading requirements.md for spec 04-ai-guidance-standardization/02-00-guidance-surface-inventory
- **Consumer**: model
- **Content Hash**: `71c3e076b40df4fa...`
- **Budget**: 2969 chars / ~743 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: '02-00-guidance-surface-inventory'
scene: '04-ai-guidance-standardization'
status: draft
priority: P0
created: '2026-08-26'
---

# 02-00 Guidance Surface Inventory - 需求

## L0 摘要

盘点所有会影响客户端
```
</details>

#### `governance_doc:04-ai-guidance-standardization_02-00-guidance-surface-inventory:design`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/02-00-guidance-surface-inventory/design.md`
- **Trigger**: Reading design.md for spec 04-ai-guidance-standardization/02-00-guidance-surface-inventory
- **Consumer**: model
- **Content Hash**: `90dbc440bd368030...`
- **Budget**: 2418 chars / ~605 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '02-00-guidance-surface-inventory'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 02-00 Guidance Surface Inventory - 设计

## L0 摘要

建立“完整 Surface 清单 + 三维语义标注 + 内容 hash +
```
</details>

#### `governance_doc:04-ai-guidance-standardization_02-00-guidance-surface-inventory:tasks`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/02-00-guidance-surface-inventory/tasks.md`
- **Trigger**: Reading tasks.md for spec 04-ai-guidance-standardization/02-00-guidance-surface-inventory
- **Consumer**: model
- **Content Hash**: `7be34def04b47d94...`
- **Budget**: 5570 chars / ~1393 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '02-00-guidance-surface-inventory'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 02-00 Guidance Surface Inventory - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。本 Spec 只冻
```
</details>

#### `governance_doc:04-ai-guidance-standardization_03-00-mcp-response-conformance:requirements`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/03-00-mcp-response-conformance/requirements.md`
- **Trigger**: Reading requirements.md for spec 04-ai-guidance-standardization/03-00-mcp-response-conformance
- **Consumer**: model
- **Content Hash**: `6688ed2d7ba4a138...`
- **Budget**: 5373 chars / ~1344 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: '03-00-mcp-response-conformance'
scene: '04-ai-guidance-standardization'
status: draft
priority: P1
created: '2026-08-26'
---

# 03-00 MCP Response Conformance - 需求

## L0 摘要

让 lrnev 工具响应符合
```
</details>

#### `governance_doc:04-ai-guidance-standardization_03-00-mcp-response-conformance:design`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/03-00-mcp-response-conformance/design.md`
- **Trigger**: Reading design.md for spec 04-ai-guidance-standardization/03-00-mcp-response-conformance
- **Consumer**: model
- **Content Hash**: `200b0040dba7bc4e...`
- **Budget**: 5328 chars / ~1332 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '03-00-mcp-response-conformance'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 03-00 MCP Response Conformance - 设计

## L0 摘要

以 MCP `structuredContent` 承载完整机器数据，以 `con
```
</details>

#### `governance_doc:04-ai-guidance-standardization_03-00-mcp-response-conformance:tasks`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/03-00-mcp-response-conformance/tasks.md`
- **Trigger**: Reading tasks.md for spec 04-ai-guidance-standardization/03-00-mcp-response-conformance
- **Consumer**: model
- **Content Hash**: `54b51aec043a6f5d...`
- **Budget**: 4751 chars / ~1188 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '03-00-mcp-response-conformance'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 03-00 MCP Response Conformance - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。本 Spec 无语义 E2
```
</details>

#### `governance_doc:04-ai-guidance-standardization_04-00-agent-e2e-observability:requirements`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/04-00-agent-e2e-observability/requirements.md`
- **Trigger**: Reading requirements.md for spec 04-ai-guidance-standardization/04-00-agent-e2e-observability
- **Consumer**: model
- **Content Hash**: `0288ff7431fe2154...`
- **Budget**: 3660 chars / ~915 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: '04-00-agent-e2e-observability'
scene: '04-ai-guidance-standardization'
status: draft
priority: P0
created: '2026-08-26'
---

# 04-00 Agent E2E Observability - 需求

## L0 摘要

用真实客户端 AI 验证端到端结
```
</details>

#### `governance_doc:04-ai-guidance-standardization_04-00-agent-e2e-observability:design`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/04-00-agent-e2e-observability/design.md`
- **Trigger**: Reading design.md for spec 04-ai-guidance-standardization/04-00-agent-e2e-observability
- **Consumer**: model
- **Content Hash**: `610a45201101fe54...`
- **Budget**: 4080 chars / ~1020 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '04-00-agent-e2e-observability'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 04-00 Agent E2E Observability - 设计

## L0 摘要

测试端到端决策链而不是“字段是否存在”：固定 fixture 和 clean sess
```
</details>

#### `governance_doc:04-ai-guidance-standardization_04-00-agent-e2e-observability:tasks`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/04-00-agent-e2e-observability/tasks.md`
- **Trigger**: Reading tasks.md for spec 04-ai-guidance-standardization/04-00-agent-e2e-observability
- **Consumer**: model
- **Content Hash**: `c988cb06f72d1f67...`
- **Budget**: 32500 chars / ~8125 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '04-00-agent-e2e-observability'
scene: '04-ai-guidance-standardization'
created: '2026-08-31'
---

# 04-00 Agent E2E Observability - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。本 Spec 观测运行时 gu
```
</details>

#### `governance_doc:04-ai-guidance-standardization_05-00-lrnev-guidance-profile:requirements`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/05-00-lrnev-guidance-profile/requirements.md`
- **Trigger**: Reading requirements.md for spec 04-ai-guidance-standardization/05-00-lrnev-guidance-profile
- **Consumer**: model
- **Content Hash**: `ca35531ad4793ce6...`
- **Budget**: 3829 chars / ~958 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: '05-00-lrnev-guidance-profile'
scene: '04-ai-guidance-standardization'
status: draft
priority: P1
created: '2026-08-26'
---

# 05-00 lrnev Guidance Profile - 需求

> 用户已决定引入端到端结构化。本 Spec 必须实施最
```
</details>

#### `governance_doc:04-ai-guidance-standardization_05-00-lrnev-guidance-profile:design`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/05-00-lrnev-guidance-profile/design.md`
- **Trigger**: Reading design.md for spec 04-ai-guidance-standardization/05-00-lrnev-guidance-profile
- **Consumer**: model
- **Content Hash**: `df866cf0b2a1662f...`
- **Budget**: 3005 chars / ~752 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '05-00-lrnev-guidance-profile'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 05-00 lrnev Guidance Profile - 设计

## L0 摘要

把 lrnev Guidance Profile 设计成显式版本化、客户端可选适配的应用层
```
</details>

#### `governance_doc:04-ai-guidance-standardization_05-00-lrnev-guidance-profile:tasks`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/05-00-lrnev-guidance-profile/tasks.md`
- **Trigger**: Reading tasks.md for spec 04-ai-guidance-standardization/05-00-lrnev-guidance-profile
- **Consumer**: model
- **Content Hash**: `1e3472b345423eda...`
- **Budget**: 3989 chars / ~998 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '05-00-lrnev-guidance-profile'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 05-00 lrnev Guidance Profile - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。Profile `v1` 已获架构
```
</details>

#### `governance_doc:04-ai-guidance-standardization_06-00-guidance-documentation:requirements`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/06-00-guidance-documentation/requirements.md`
- **Trigger**: Reading requirements.md for spec 04-ai-guidance-standardization/06-00-guidance-documentation
- **Consumer**: model
- **Content Hash**: `20d48e9142847ae6...`
- **Budget**: 2721 chars / ~681 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: requirements.md

<details>
<summary>Content Preview</summary>

```
---
spec: '06-00-guidance-documentation'
scene: '04-ai-guidance-standardization'
status: draft
priority: P1
created: '2026-08-27'
---

# 06-00 Guidance Documentation - 需求

## L0 摘要

无条件发布 lrnev 的基础语义、
```
</details>

#### `governance_doc:04-ai-guidance-standardization_06-00-guidance-documentation:design`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/06-00-guidance-documentation/design.md`
- **Trigger**: Reading design.md for spec 04-ai-guidance-standardization/06-00-guidance-documentation
- **Consumer**: model
- **Content Hash**: `f94e380c0422445f...`
- **Budget**: 2422 chars / ~606 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: design.md

<details>
<summary>Content Preview</summary>

```
---
spec: '06-00-guidance-documentation'
scene: '04-ai-guidance-standardization'
created: '2026-08-27'
---

# 06-00 Guidance Documentation - 设计

## L0 摘要

按“规范、清单、传输、客户端、证据、Profile 附录”分层发布文档，让通用 MCP 使
```
</details>

#### `governance_doc:04-ai-guidance-standardization_06-00-guidance-documentation:tasks`

- **Source**: `.lrnev/scenes/04-ai-guidance-standardization/specs/06-00-guidance-documentation/tasks.md`
- **Trigger**: Reading tasks.md for spec 04-ai-guidance-standardization/06-00-guidance-documentation
- **Consumer**: model
- **Content Hash**: `47852891fddc132a...`
- **Budget**: 3966 chars / ~992 tokens
- **Role**: FACT
- **Provenance**: workspace
- **Enforcement**: none
- **Capability Note**: Spec governance document: tasks.md

<details>
<summary>Content Preview</summary>

```
---
spec: '06-00-guidance-documentation'
scene: '04-ai-guidance-standardization'
created: '2026-08-27'
---

# 06-00 Guidance Documentation - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。基础文档无条件发布；Profile
```
</details>
