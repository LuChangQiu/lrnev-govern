---
spec: 06-00-design-anchor-d-xx
scene: 01-findings-remediation
status: ready
priority: P1
created: '2026-06-11'
updated: '2026-06-12'
---

# 06-00 Design Anchor D Xx - 需求

> 权威依据：`dev-docs/FINDINGS-CHECKLIST.md`（I-18 最终决策 + I-5 翻转行）+ `dev-docs/CLAUDE-INTEGRATION-TEST-2026-06-11.md`（D1 validates 不校验）。实现前回查，勿凭记忆。
> 本 Spec 吸收了原 I-5（validates F-xx 校验，已从 S3 翻转为硬校验移入）。

## L0 摘要

把 validates 锚点体系规范化：设计锚点用 D-xx（与 requirements 的 F-xx 对称），validates 只认 F-xx/D-xx 且对其存在性硬校验，废弃 design#3.2 自由写法。

## L1 概览

### 目标

让 validates 从“自由字符串、不校验、可指向空气”变成确定性结构化治理能力。确立锚点规范：F-xx 指 requirements 的功能需求、D-xx 指 design 的设计点；validates 只接受这两类，引用不存在的锚点像 depends_on 坏引用一样硬拒、不落盘。lrnev 仍不判断设计/需求质量，只判断“这个编号在不在”——确定性治理。

### 用户故事

- 作为用 validates 做需求/设计追溯的用户，我希望写下的锚点要么指向真实存在的 F-xx/D-xx、要么被当场拒绝，以便 validates 能真正支撑覆盖率、追溯和 completion 自查，而不是一堆指向空气的字符串。

### 范围

**包含**：
- 规范定义：design.md 设计锚点用 `#### D-xx`（与 requirements 的 `#### F-xx` 对称）；更新 design 模板加 D-xx 示范。
- validates 格式约束：只接受 `^F-\d+$` 或 `^D-\d+$`，其它一律硬拒（含 design#3.2 等废弃格式，报“格式已废弃，请用 D-xx”）。
- 存在性硬校验：F-xx 去对应 requirements 找 `#### F-xx`、D-xx 去对应 design 找 `#### D-xx`，找不到则硬拒、不落盘。
- 清理草稿例子：把工具描述（cli/index.ts、mcp/tools/index.ts、types/task.ts）、测试（task-manager.test.ts 等）、文档（GOVERNANCE-FLOW.md）里的 `design#3.2` 例子全部改为 D-xx。
- doctor 检测：对存量 `.lrnev` 中残留的废弃/坏锚点列出提示（不自动迁移）。

**不包含**：
- 不自动迁移存量 `design#3.2 → D-xx`（无确定映射，工具不能猜）。
- 不判断 design/requirements 内容质量。
- depends_on 存在性（S2）、依赖未完成/父子软提醒（S3）不在本 Spec。

## L2 详情

### 详细需求

#### F-01 design 锚点规范 D-xx 与模板
- 描述：确立 design.md 用 `#### D-xx 标题` 作为稳定设计锚点；更新 `templates/spec/design.md.tmpl` 给出 D-xx 锚点示范与说明；相关文档（GOVERNANCE-FLOW 等）同步说明 F-xx/D-xx 锚点体系。
- 验收：
  - WHEN 查看 design 模板/治理文档 THEN 能看到“设计锚点用 #### D-xx，与 F-xx 对称”的规范说明与示例。

#### F-02 validates 只接受 F-xx/D-xx，其它硬拒
- 描述：task_create / task_update 校验 validates 每一项格式：只允许 `^F-\d+$` 或 `^D-\d+$`；其它（含 design#3.2、自由备注）抛错且不落盘，废弃格式的报错信息明确指向“请用 D-xx”。
- 验收：
  - WHEN validates 含 `design#3.2` THEN 报错“格式已废弃/不支持，请用 D-xx”，task 未创建。
  - WHEN validates 含任意自由字符串（如 `登录相关`）THEN 报格式错误，task 未创建。
  - WHEN validates 全是 `F-xx`/`D-xx` 形式 THEN 通过格式校验，进入存在性校验。

#### F-03 F-xx/D-xx 存在性硬校验
- 描述：格式合法后，对每个 `F-xx` 去该 spec 的 requirements.md 找 `#### F-xx`、每个 `D-xx` 去 design.md 找 `#### D-xx`；任一找不到则抛 `TASK_NOT_FOUND`/`ANCHOR_NOT_FOUND` 类错误，指明缺失锚点，且不落盘。与 depends_on 存在性硬校验（S2）口径一致，集中在 `TaskManager.create`。
- 验收：
  - WHEN validates=F-99 但 requirements 无 `#### F-99` THEN 硬拒，指明 F-99 缺失，task 未创建。
  - WHEN validates=D-99 但 design 无 `#### D-99` THEN 硬拒，指明 D-99 缺失，task 未创建。
  - WHEN validates 的 F-xx/D-xx 都能在对应文档找到 THEN 正常创建。

#### F-04 清理草稿例子 + doctor 检测存量
- 描述：把仓库内 `design#3.2` 例子（工具描述/测试/文档）全部改为 D-xx；doctor 增加对存量 `.lrnev` 中废弃/坏 validates 锚点的检测，列出供用户手改，不自动迁移。
- 验收：
  - WHEN grep 全仓 THEN 不再有 `design#3.2` 作为推荐示例（测试/描述/文档已换 D-xx）。
  - WHEN 存量数据含废弃/坏锚点，跑 doctor THEN 列出具体位置与建议，不自动改写。

### 非功能性需求

- 性能：格式校验是字符串正则；存在性校验复用 create 时已读取的 requirements/design（避免多余 IO）。
- 兼容性：这是 validates 语义的**有意收紧**（去自由字符串化）——核实确认无真实用户数据依赖自由字符串，仅测试/示例用过 design#3.2，随本 Spec 一并更新；F-xx 既有用法（指向真实需求）不回归。

### 边界与依赖

- 依赖 requirements 的 `#### F-xx` 与 design 的 `#### D-xx` 标题格式、`TaskManager.create` 校验位置（与 depends_on 存在性同处）。
- 与 S2 口径一致：坏的结构引用一律硬拒、不落盘。

### 验收标准

<!-- 最初失败信号 / 期望结果 -->
最初失败信号：D1 中 validates=F-99/design#9.9 等照单全收、指向空气，validates 是自由字符串无治理能力。期望结果：validates 只认 F-xx/D-xx 且存在性硬校验，废弃格式被拒，例子清理干净，validates 成为可追溯的结构化锚点。
- [ ] design 锚点规范 D-xx 落入模板与文档。
- [ ] validates 只接受 F-xx/D-xx，其它（含 design#3.2、自由串）硬拒。
- [ ] F-xx/D-xx 存在性硬校验，找不到不落盘。
- [ ] 仓库内 design#3.2 例子全部改 D-xx；doctor 检测存量坏锚点不自动迁移。
- [ ] 新增/修改测试覆盖；`npm test` 全绿无回归。
