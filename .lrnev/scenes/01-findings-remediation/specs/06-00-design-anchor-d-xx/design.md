---
spec: '06-00-design-anchor-d-xx'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 06-00 Design Anchor D Xx - 设计

## L0 摘要

把 validates 从自由字符串收紧为只认 F-xx/D-xx 的结构化锚点：格式校验 + 存在性硬校验集中在 `TaskManager.create`，与 S2 的 depends_on 校验共用同一套“引用存在性”逻辑；废弃 design#3.2 并清理仓库内例子。

## L1 概览

### 架构思路

- validates 成为与 depends_on 同级的“结构引用”：先格式判定（只接受 ^F-\d+$ / ^D-\d+$），再存在性查找（F→requirements、D→design），坏的一律硬拒、不落盘。
- 与 S2 共用实现位置（`TaskManager.create`）和模式（引用存在性校验小工具），口径一致、不分散。
- design#3.2 不做语义映射（design 无稳定章节号，映射是假确定性），直接判废弃格式。

### 主要模块

- `src/core/TaskManager.ts` → `create`（validates 格式 + F-xx/D-xx 存在性硬校验，紧邻 S2 的 depends_on 校验）
- `templates/spec/design.md.tmpl`（加 `#### D-xx` 锚点示范）
- 工具描述：`src/cli/index.ts`、`src/mcp/tools/index.ts`、`src/types/task.ts`（把 design#3.2 例子改 D-xx）
- 文档：`docs/GOVERNANCE-FLOW.md`（锚点体系说明 + 例子改 D-xx）
- 测试：`tests/unit/task-manager.test.ts` 等（用 design#3.2 的数据改 D-02）
- `src/core/Doctor.ts`（可选：检测存量坏/废弃 validates 锚点，列出不自动迁移）

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| validates 语义 | (a)只认 F-xx/D-xx (b)保留自由字符串备注 | **(a)去自由字符串化** | **建议产 ADR**（产品契约收紧） |
| F-xx/D-xx 不存在错误码 | (a)复用 `TASK_NOT_FOUND` (b)新增 `ANCHOR_NOT_FOUND` | (b)新增 `ANCHOR_NOT_FOUND` 更准 | 否 |
| 废弃格式（design#3.2）错误码 | `INVALID_INPUT`，message 指明“格式已废弃，请用 D-xx” | 复用 INVALID_INPUT | 否 |
| 存量 design#3.2 | 不自动迁移；doctor 列出手改 | 不自动迁移 | 否 |
| 校验位置 | 与 S2 depends_on 同在 `TaskManager.create` | 集中 | 否 |

> 与 S2 的耦合：S2 的 F-03（depends_on 存在性）与本 Spec 的 F-03（F-xx/D-xx 存在性）都在 `TaskManager.create` 加“引用存在性校验”。**实现时先抽一个共用小工具**（如 `assertReferenceExists(ids, pool, errorCode, label)`），depends_on 用 task pool、F-xx 用 requirements 锚点集、D-xx 用 design 锚点集，避免各写一份导致口径漂移。建议 S2、S6 在同一次实现里协调这段。
>
> **建议产 ADR**：validates 去自由字符串化是对外契约的有意收紧（虽核实无真实用户数据依赖），值得 `adr_create` 沉淀“为什么”，供未来回看。

## L2 详情

### 模块详细设计

> 本段用 `#### D-xx` 给出本 Spec 的设计锚点（吃狗粮：S6 自己的 design 即采用 D-xx 规范，供本 Spec 的 task 用 `--validates D-xx` 引用）。

#### D-01 锚点规范定义
- design.md 设计锚点：`#### D-xx 标题`（与 requirements 的 `#### F-xx` 对称）。
- 更新 `design.md.tmpl`：在“模块详细设计”给出 `#### D-01 ...` 示范 + 一句说明“设计锚点用 D-xx，供 task validates 引用”。
- `docs/GOVERNANCE-FLOW.md`：补“锚点体系：F-xx=requirements 功能锚点，D-xx=design 设计锚点，validates 只认这两类”。

#### D-02 validates 格式校验
- 在 `TaskManager.create`（解析 existing 之后、写入之前）对 `input.validates` 每项：
  - 匹配 `^F-\d+$` 或 `^D-\d+$` → 进入存在性校验。
  - 匹配旧式 `design#...` → 抛 `INVALID_INPUT`，message：“validates 锚点 design#... 格式已废弃/不支持，请改用 D-xx”。
  - 其它任意字符串 → 抛 `INVALID_INPUT`，message 指明只接受 F-xx/D-xx。
  - 任一不合法即不落盘。

#### D-03 锚点存在性硬校验
- F-xx：读该 spec `requirements.md`，提取所有 `#### F-\d+` 锚点集合，validates 的 F-xx 不在集合 → 抛 `ANCHOR_NOT_FOUND`（指明缺失 F-xx）。
- D-xx：读该 spec `design.md`，提取所有 `#### D-\d+`，validates 的 D-xx 不在集合 → 抛 `ANCHOR_NOT_FOUND`。
- 复用 S2 抽出的 `assertReferenceExists` 思路；锚点提取用与 `findMissingSections` 同风格的标题正则。

#### D-04 例子清理 + doctor 检测
- grep 替换仓库内 `design#3.2` → `D-02`（工具描述、types 注释、测试数据、文档）。
- `Doctor.ts` 增可选检测：扫描 tasks.md 的 validates，列出非 F-xx/D-xx 或指向不存在锚点的项（info/warning），不自动改写。

### 数据模型

validates 字段类型不变（string[]），但取值域收紧为 `^F-\d+$ | ^D-\d+$`。新增 ErrorCode `ANCHOR_NOT_FOUND`（+ 对应 hint）。

### 接口契约

- task_create / task_update：validates 非法或锚点不存在 → `ok:false` + INVALID_INPUT / ANCHOR_NOT_FOUND，task 不创建。
- CLI 与 MCP 的 validates 参数描述同步更新（去掉 design#3.2 例子，写 F-01 D-02）。

### 错误处理

- 格式错误：INVALID_INPUT，message 区分“废弃格式 design#”与“非法格式”。
- 锚点不存在：ANCHOR_NOT_FOUND，指明缺失锚点 + hint（去对应 requirements/design 确认或补锚点）。

### 测试策略

- 单元（task-manager）：validates=F-01 存在 → 通过；F-99 不存在 → ANCHOR_NOT_FOUND；D-01 存在/D-99 不存在；design#3.2 → INVALID_INPUT(废弃)；自由串 → INVALID_INPUT。
- 把现有 design#3.2 round-trip 测试改成 D-02，并确保 design.md 里有 `#### D-02` 供存在性通过。
- doctor 单元：含坏锚点的 tasks.md → 列出提示。
- 回归：全仓无 design#3.2 推荐示例；`npm test` 全绿。
