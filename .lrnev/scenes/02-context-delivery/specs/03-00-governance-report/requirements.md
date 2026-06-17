---
spec: '03-00-governance-report'
scene: '02-context-delivery'
status: draft
priority: P2
created: '2026-06-15'
---

# 03-00 Governance Report - 需求

## L0 摘要

新增 `lrnev report`：零模型地从 `.lrnev` 文件确定性算出一份「治理体检单」，把肉眼看不见的治理欠债（做完没收口的 spec、没人验证的孤儿锚点）摆到人面前，并能草拟 release notes。它是 lrnev 第一个主消费者是「人」而非 AI 的工具——交税之后的分红。

## L1 概览

### 目标

- 一条命令看清当前工作区的治理健康：链路完整度、validates 覆盖率。
- 把"做完忘收口""需求写了没人做"这类肉眼难发现的欠债显式列出来。
- 顺带产出可贴到 GitHub Release / PR 的 release notes 草稿。
- 全程零模型、纯快照：报告是某一刻的确定性计算结果，不是实时监控，不调 LLM。

### 用户故事

- 作为项目作者，我希望一条命令看到"哪些 spec 做完了却没收口"，以便补跑 completion gate 把状态推进到位。
- 作为项目作者，我希望看到 validates 覆盖率和孤儿锚点，以便知道哪些需求/设计写了却没有任何 task 去验证。
- 作为发版者，我希望根据已完成的 spec/task 自动草拟一份 release notes，以便少手写、直接微调后贴出去。
- 作为使用者，我希望报告默认打到终端、需要时才落地成 markdown 文件，以便保持 `.lrnev` 目录干净。

### 范围

**包含**：
- `lrnev report`：链路完整度 + validates 覆盖率两段体检，默认 text 打终端。
- `lrnev report --release-notes`：第三个视图，输出已完成工作的 release notes 草稿。
- 输出形态：默认 text；`--md` 输出 markdown 到 stdout；`--json` 输出结构化数据；`--out <path>` 可选落盘（不给则不写文件）。
- 顶部一句话总结，规则确定性（有硬欠债报欠债，否则报健康）。
- "做完没收口"检测并入链路完整度：task 全 completed 但 spec status≠completed。
- 孤儿锚点检测并入覆盖率：写了 `#### F-xx`/`#### D-xx` 但无任何 task validates；区分"在途 spec 的正常孤儿"与"已收口 spec 的真欠债"。
- MCP 侧对等工具 `lrnev_report`（S1 对等原则）。

**不包含**：
- 任何网页 / 实时监控 / 仪表盘（违背零模型与文件即真相定位；"当前在做哪个任务"已由 `project_status` 覆盖）。
- 报告自动触发 AI 行动：报告只把债摆到人面前，做不做、做哪个由人拍板。
- 报告默认写入 `.lrnev`：派生产物不污染治理真相目录，落盘必须经 `--out` 显式指定。
- 迁移命令合并（doctor --migrate-* 收拢）——那是独立的直接改动，不在本 Spec。
- 僵尸 spec 时效判定、release notes 的 git 区间裁剪等需要拍脑袋阈值的项——v1 不做，等反馈。

## L2 详情

### 详细需求

#### F-01 链路完整度视图

- 统计 scene / spec / task 总数，并按 scene 列出每个 scene 的 spec 数、task 数与汇总状态。
- 空的 00-default 标记为"(空)"，不算欠债。
- "做完没收口"检测：列出所有"task 全部 completed 但 spec status≠completed"的 spec，给出 `已完成task/总task` 与当前 status，并提示"跑 completion gate 推进状态"。
- "在途"列出：status 仍为 draft/in-progress 且确有未完成 task（或零 task）的 spec。
- 验收：
  - WHEN 工作区存在一个 spec 其 task 全 completed 但 status=draft，THEN report 在链路段把它列入"做完没收口"，并标出 `N/N task done, status=draft`。
  - WHEN 某 scene 下无任何 spec，THEN 该 scene 标记为"(空)"且不计入欠债。

#### F-02 validates 覆盖率视图

- 统计锚点总数（拆 F-xx / D-xx），统计被至少一个 task `validates` 引用的锚点数，给出覆盖率百分比。
- 列出孤儿锚点（无任何 task validates 的 F-xx/D-xx），并区分：在途 spec 的孤儿（正常，待拆 task）与已收口 spec 的孤儿（真欠债）。
- `<!-- FILL:` 哨兵标题的锚点不计入（未填写的占位不算真锚点）。
- 验收：
  - WHEN 一个 spec 写了 `#### F-01` 但没有任何 task 的 validates 含 F-01，THEN 该锚点出现在孤儿清单，且按所属 spec 状态归类为"在途/真欠债"。
  - WHEN 所有锚点都被 validates 覆盖，THEN 覆盖率显示 100% 且孤儿清单为空。

#### F-03 release notes 草稿视图

- `lrnev report --release-notes` 输出一份已完成工作的清单草稿：按 scene/spec 分组，列出 completed 状态的 spec 及其 completed task 标题。
- 输出供人复制微调，不追求成稿；不依赖 git。
- 验收：
  - WHEN 存在已 completed 的 spec 与 task，THEN `--release-notes` 输出包含这些 spec/task 标题的分组清单。
  - WHEN 无任何已完成项，THEN 输出空清单的友好提示，而非报错。

#### F-04 输出形态与 CLI/MCP 对等

- 默认 text 打终端；`--md` 输出 markdown 到 stdout；`--json` 输出结构化对象；三者互斥，json 面向机器/CI。
- `--out <path>` 把当前格式落盘到指定路径；不给 `--out` 一律不写文件。lrnev 不替用户选默认归档路径，不向 `.lrnev` 写报告。
- 顶部一句话总结：有硬欠债（做完没收口 spec >0 或 failed task >0）→ 报欠债概述；否则 → 报"整体健康"。
- MCP 侧提供对等工具 `lrnev_report`，返回结构化数据（等价于 `--json`），参数覆盖 release-notes 模式。
- 验收：
  - WHEN 执行 `lrnev report --json`，THEN 输出可被 JSON.parse 的结构化对象，含链路与覆盖率两段数据。
  - WHEN 执行 `lrnev report --md --out X.md` 后再执行 `lrnev report`（无 --out），THEN 仅前者在 X.md 落盘，后者不产生任何文件。
  - WHEN 通过 MCP 调用 `lrnev_report`，THEN 返回的数据口径与 CLI `--json` 一致。

### 非功能性需求

- 性能：报告为一次性快照，遍历 `.lrnev` 文件即可；命中规模与 `status`/`map` 同量级，不引入额外重扫。
- 兼容性：零模型、零新运行时依赖；无 `.lrnev` 或空工作区时给友好提示而非崩溃；不改动任何治理源文件。

### 边界与依赖

- 复用现有扫描能力：scene/spec 遍历同 `GovernanceMap`/`project_status`，锚点解析同 `extractAnchorSections`/锚点池，task 状态与 validates 同 `TaskManager` 既有解析；不新建独立扫描器。
- 依赖 02-context-delivery 已落地的 `readSpecSummary`、`GovernanceMap` 等 core 能力。
- 不依赖 git；不依赖外部网络。

### 验收标准

<!-- 最初的失败信号：当前肉眼看不出"做完没收口"的 spec（真机已证实 02-context-delivery/01-00、02-00 task 全完但 status=draft）。期望结果：一条命令把它们列出来。 -->
- [ ] `lrnev report` 在真实工作区能列出"做完没收口"的 spec 与孤儿锚点，且与手工统计一致。
- [ ] `--md` / `--json` / `--out` 三种输出形态行为符合 F-04，默认不向 `.lrnev` 或任何位置写文件。
- [ ] `lrnev report --release-notes` 产出按 scene/spec 分组的已完成清单草稿。
- [ ] MCP `lrnev_report` 与 CLI `--json` 数据口径一致（CLI/MCP 对等）。
- [ ] 单元 + e2e 测试通过，零模型、无新运行时依赖。
