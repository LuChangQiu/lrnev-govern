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

v2.3.0 发布前审计整改：三客户端真机 E2E（codex/gpt-5.5、opencode/deepseek-v4-pro、claude-sonnet-4-6）与全量文档审核收敛出的引导漂移、行为失真与文档缺口，一次收口。

## L1 概览

### 目标

发布前审计（2026-07-06）用三个 AI 客户端在干净真实项目上只靠 lrnev 自带引导走全流程，同时逐份对照源码审核全部文档，收敛出四类问题：

1. **引导漂移**：`lrnev_guide` 完整手册与 server instructions 停在 v2.0 之前——`task_create_many`/`governance_map`/`lrnev_report`/`spec_update`/`assess_goal` 零提及，"AI 不确定时的兜底手册"失效。
2. **行为失真**：`was_new` 以 `.lrnev/` 目录存在判定，但 MCP 连接自动注册会先创建 `.lrnev/agents/`，导致经 MCP 调 init 永远 `was_new:false`（三家模型全部困惑）；README 明确 PROJECT.md 才是"已初始化标记"，实现与文档矛盾。
3. **引导缺口**（真机收敛）：模板标题不可翻译无事前警示（codex 实撞）、ready 通过后无"填 design.md"无条件提示（两家在 completion 才发现）、`agent_register` 的 gc 字段无描述、report headline"整体健康"与执行进度混淆、`claimable_next` 截断与依赖不透明。
4. **文档缺口**：CHANGELOG 缺 2.0~2.3 链接定义；ARCHITECTURE.md 目录树 5 处失真；AI-ADAPTATION 缺 LRNEV_WORKSPACE 且含 MCP 误导；`.lrnev/config/lrnev.json` 全部配置键无任何成文；6 个工具在用户文档零覆盖；dev-docs 3 份活文档失活、9 份快照混杂。

### 用户故事

- 作为第一次接入 lrnev 的 AI，我希望 guide 与 followup 覆盖当前全部关键工具与已知坑（标题契约、design 时机），以便不靠猜就走通全流程。
- 作为经 MCP 初始化项目的用户，我希望 `was_new` 反映"治理档案是否已建立"而非目录是否存在，以便判断是首次接入还是重复 init。
- 作为查配置的用户，我希望有一处成文列出全部可配置键与默认值，以便不用读源码。

### 范围

**包含**：
- guide（workflow/tools 相关小节）与 WORKFLOW_OVERVIEW 同步 v2.1~v2.3 能力
- followup/描述增强：spec_create 标题警示、ready-passed design 提示、agent_register gc 语义、task_create 批量提示、assess_goal override 指引、report headline 措辞
- `was_new` 判定改为 PROJECT.md 存在性
- `claimable_next` 条目附 depends_on、project_status 对截断透明（不过滤、不改 claimable 语义）
- 用户文档修复与补全（CHANGELOG 链接、ARCHITECTURE 树、AI-ADAPTATION、sample-project、HOOKS、GOVERNANCE-FLOW、CONFIG 成文、零覆盖工具）
- dev-docs 整理（快照归档 archive/、活文档刷新、v2.3 e2e 报告收录）

**不包含**：
- claimable_next 过滤依赖未完成任务（用户裁决：保持软依赖哲学，只加透明标注）
- project_status 隐藏空 00-default 的行为变更（by design，文档说明即可）
- 提供治理文档写入工具（codex 建议的 project_profile_update 等——AI 直接编辑文件是既定设计）
- error_record verification 重复提示微调（噪音极低，不值改动）

## L2 详情

### 详细需求

#### F-01 guide 与 server instructions 同步 v2.1~v2.3
- 描述：`lrnev_guide` 的 workflow/tools 小节与 `WORKFLOW_OVERVIEW` 补齐 `task_create_many`（ready 后批量拆任务）、`governance_map`/`lrnev_report`（接手与体检）、`spec_update`（状态回填）、`assess_goal`（粒度辅助）；工具速查按现有分组就近补入，不重构结构。
- 验收：
  - WHEN 调 lrnev_guide（完整或 tools/workflow topic） THEN 内容包含 task_create_many、governance_map、lrnev_report、spec_update。
  - WHEN MCP 连接读 server instructions THEN 新建特性行提及批量拆任务、接手行提及治理地图。

#### F-02 followup 与工具描述引导增强
- 描述：(a) spec_create followup 加"章节标题勿翻译/改名（ready gate 按中文模板精确匹配）"；(b) ready gate 通过 followup 加无条件"接下来把 design.md 的 FILL 填完（completion gate 会硬拦 design 残留）"；(c) agent_register 工具描述补 gc 字段语义（有实际清理才出现）；(d) task_create 描述提示"多条任务请用 task_create_many"；(e) assess_goal 判 multi-spec 的 followup 加 override 指引（用户已明确单特性时可按 single-spec 继续）；(f) report headline 从"整体健康"改为明示"治理债"口径，不与执行进度混淆。
- 验收：
  - WHEN spec_create 成功 THEN followup 含标题契约警示。
  - WHEN ready gate 通过 THEN followup 含无条件填 design.md 提示。
  - WHEN report 无任何治理债 THEN headline 明示"治理债"口径（如"治理债：无…"），不再是裸"整体健康"。

#### F-03 was_new 判定改 PROJECT.md
- 描述：`ensureWorkspace` 的 was_new 以 `PROJECT.md` 是否已存在判定（README 既定的"已初始化标记"），不再以 `.lrnev/` 目录存在判定；MCP 自动注册预创建 `.lrnev/agents/` 不再影响 init 的 was_new。
- 验收：
  - WHEN 目录仅有自动注册产生的 `.lrnev/agents/` 而无 PROJECT.md 时调 init THEN was_new 为 true。
  - WHEN PROJECT.md 已存在时再次 init THEN was_new 为 false 且既有文件不被覆盖。

#### F-04 claimable_next 透明化
- 描述：`claimable_next` 条目附带非空 `depends_on`（加法字段）；当可领任务数超过预览上限时，project_status 的 followup 说明"最多展示 N 条，其余看 free_tasks_count"。不改变 claimable 语义（依赖未完成仍可领，软提醒哲学不动）。
- 验收：
  - WHEN 可领任务带 depends_on THEN claimable_next 条目含该字段。
  - WHEN free_tasks_count 大于预览条数 THEN followup 出现截断说明。

#### F-05 用户文档修复与补全
- 描述：CHANGELOG 补 [2.0.0]~[2.3.0] 链接定义；docs/ARCHITECTURE.md 目录树对齐实际源码（cli 重复项、GateGuidance/SpecGuidance、governance-map.ts/index.ts、text.ts、templates/project）；docs/AI-ADAPTATION.md 增 LRNEV_WORKSPACE 说明、修"--workspace"误导、实测矩阵回填三行 v2.3 结果；examples/sample-project 修步骤号注释并提及 create-many；docs/HOOKS.md 事件表补 task.update.pending；docs/GOVERNANCE-FLOW.md 开头重框定为通用语义文档并补"空 00-default 不出现在 project_status"说明；新增 docs/CONFIG.md（全配置键+默认值）与 docs/examples/lrnev.json；summarize_save/session_commit/error_promote/memory_forget/memory_search/adr_get 在用户文档至少各有一处说明。
- 验收：
  - WHEN 在 README/docs/examples 内检索上述 6 个工具名 THEN 各至少命中一处。
  - WHEN 打开 docs/CONFIG.md THEN 覆盖 config.ts 全部顶层配置组。
  - WHEN 对照 src 目录树与 docs/ARCHITECTURE.md THEN 无缺漏与重复。

#### F-06 dev-docs 整理与 e2e 报告收录
- 描述：9 份已消化快照移入 dev-docs/archive/；NEXT-STEPS.md（勾掉已发布项、指向 git 执法环）、PRODUCT-STRATEGY.md（回填已完成两步、修工具数）、INTEGRATION-TEST.md（工具数/测试数/补 v2.1~v2.3 验证面）刷新到 v2.3；PUBLISH.md 示例版本号更新；三份 v2.3 e2e 报告收录进 dev-docs；清理 research 三个测试项目里的 `.lrnev/`、报告与 opencode.json 残留。
- 验收：
  - WHEN 查看 dev-docs THEN 顶层只余活文档 + archive/ + 本轮 e2e 报告。
  - WHEN 读 NEXT-STEPS/PRODUCT-STRATEGY/INTEGRATION-TEST THEN 无与 v2.3 矛盾的数字（工具 42/测试 688）。

### 非功能性需求

- 兼容性：响应契约只做加法（claimable_next 的 depends_on、followup 文案），既有消费方不受影响；was_new 语义变更与 README 既有文档对齐。
- 零模型、无新依赖；全量测试保持全绿。

### 边界与依赖

- report headline 措辞改动需同步 v2.2 锁定 headline 口径的测试。
- guide/followup 文案改动需同步既有断言测试。
- 不依赖其他 Spec。

### 验收标准

<!-- 审计来源：三客户端真机 E2E 报告（dev-docs/archive/E2E-REPORT-*-V23-2026-07-06.md）+ 全文档对照源码审核（2026-07-06） -->
- [x] guide 与 server instructions 可检索到 v2.1~v2.3 关键工具。
- [x] 干净目录经 MCP 场景（预存 .lrnev/agents/）init 返回 was_new:true。
- [x] 6 个零覆盖工具在用户文档各有落点；CONFIG.md 覆盖全部配置组。
- [x] 全量测试套件全绿。
