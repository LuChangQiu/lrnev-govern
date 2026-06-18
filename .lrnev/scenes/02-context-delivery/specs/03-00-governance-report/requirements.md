---
spec: '03-00-governance-report'
scene: '02-context-delivery'
status: draft
priority: P2
created: '2026-06-15'
---

# 03-00 Governance Report - 需求

## L0 摘要

新增 `lrnev report`：零模型地从 `.lrnev` 文件确定性算出一份「治理体检单」，把肉眼看不见的治理欠债（做完没收口的 spec、没人验证的孤儿锚点、failed/blocked 任务）摆到人面前，每条债都带"下一步该跑什么命令"，并能草拟 release notes。它是 lrnev 第一个主消费者是「人」而非 AI 的工具——交税之后的分红。

## L1 概览

### 目标

- 一条命令看清当前工作区的治理健康：链路完整度（含收口缺口、failed/blocked）、validates 覆盖率。
- 把"做完忘收口""需求写了没人做""有任务失败/阻塞了没人管"这类肉眼难发现的欠债显式列出来，且每条都给可执行的下一步。
- 顺带产出可贴到 GitHub Release / PR 的 release notes 草稿（低优先，工期紧可后置）。
- 全程零模型、纯快照：报告是某一刻的确定性计算结果，不是实时监控、不是新 gate、不调 LLM。

### 用户故事

- 作为项目作者，我希望一条命令看到"哪些 spec 做完了却没收口"，并直接告诉我"跑 completion gate→改 status"，以便照着做完收口。
- 作为项目作者，我希望看到 validates 覆盖率、孤儿锚点、坏 validates，以便知道哪些需求/设计没人验证、哪些 validates 指向了空气。
- 作为项目作者，我希望看到所有 failed / blocked 任务明细，以便 headline 说"有债"时我能立刻找到具体是哪几条。
- 作为大工作区使用者，我希望 `--scene` 只看当前业务域，以便报告不被全量内容刷屏。
- 作为发版者，我希望根据已完成的 spec/task 自动草拟 release notes，以便少手写。

### 范围

**包含**：
- `lrnev report`：链路完整度 + validates 覆盖率两段体检，默认 text 打终端。
- 链路完整度含：scene/spec/task 计数、"做完没收口"spec、failed 任务明细、blocked 任务明细。
- 每条欠债项带「可执行下一步」（命令/工具 hint）与「定位」（context:// URI + requirements/tasks 路径），人和 AI 都能直接跳过去/照着做。
- validates 覆盖率含：锚点总数/覆盖数/百分比、孤儿锚点（按 spec 状态分类）、坏 validates 单列（不计入覆盖、指向 doctor 修复）。
- `--scene <id>` 过滤：只体检指定业务域（与 `project_status --scene` 对齐）。
- `lrnev report --release-notes`：已完成工作的 release notes 草稿（低优先视图）。
- 输出形态：默认 text；`--md` markdown 到 stdout；`--json` 结构化；`--out <path>` 可选落盘（不给则不写文件）。
- 顶部一句话总结，规则确定性（有硬欠债报欠债，否则报健康），且 headline 提到的债类型在下面都能找到对应明细。
- MCP 侧对等工具 `lrnev_report`（含 `scene` / `release_notes` 参数，S1 对等）。

**不包含**：
- 任何网页 / 实时监控 / 仪表盘（违背零模型与文件即真相定位；"当前在做哪个任务"已由 `project_status` 覆盖）。
- **CI exit code / `--fail-on`（明确不做）**：report 是"给人看的分红"，不是卡 CI 的新 gate；加退出码会把它从分红变成执法，破坏定位。
- 报告自动触发 AI 行动：报告只把债摆到人面前并给 hint，做不做、做哪个由人拍板。
- 报告默认写入 `.lrnev`：派生产物不污染治理真相目录，落盘必须经 `--out` 显式指定。
- stale / 长期 in-progress 任务的时效判定：留给 `doctor`，report 不重复（避免两命令越长越像）。
- 坏 validates 的详细逐条修复指引：report 只标记+不算歪覆盖率+指向 doctor，详细修复是 doctor 的活。
- 迁移命令合并、僵尸 spec 时效、release notes 的 git 区间裁剪等需要拍脑袋阈值的项——v1 不做。

## L2 详情

### 详细需求

#### F-01 链路完整度视图（含收口缺口 + failed/blocked 明细）

- 统计 scene / spec / task 总数，并按 scene 列出每个 scene 的 spec 数、task 数与汇总状态；空的 00-default 标"(空)"、不算欠债。
- "做完没收口"检测：列出"task 全部 completed 但 spec status≠completed（且非 archived）"的 spec，给 `已完成task/总task` 与当前 status。判定口径**只镜像 completion gate 的 all_tasks_completed 这一子检查**（全平铺 every-completed，含子任务，不对 parent/children 特殊处理）；completion gate 还会查 `requirements_no_fill`/`design_exists`/`design_no_fill`，那些**仍由 gate 自己决定，report 不替 gate 下结论**——report 只说"任务都做完了、status 没推进，建议去跑 gate 验收"，不承诺 gate 必过。
- failed 任务明细：列出所有 status=failed 的 task（scene/spec/id/title），供 headline 报"有 failed 债"时定位。
- blocked 任务明细：列出所有 status=blocked 的 task。
- 每个 spec/task 项带定位：`context://spec/<scene>/<spec>`、requirements_path、tasks_path。
- 验收：
  - WHEN 一个 spec 其 task 全 completed 但 status=draft，THEN 列入"做完没收口"，标 `N/N done, status=draft`，且该判定与对该 spec 跑 completion gate 的 all_tasks_completed 结果一致。
  - WHEN 存在 status=failed / blocked 的 task，THEN 在对应明细段逐条列出（含 scene/spec/id/title）。
  - WHEN 某 spec 含未完成子任务，THEN 它不被判为"做完没收口"（与 gate 同口径）。

#### F-02 validates 覆盖率视图（含坏 validates / archived 口径）

- 统计真锚点总数（拆 F-xx/D-xx；`<!-- FILL:` 占位锚点不计入）、被 task validates 覆盖数、覆盖率百分比。
- 孤儿锚点（无任何 task validates）按所属 spec 状态分类：在途 spec 的孤儿（正常）、已收口 spec 的孤儿（真欠债）。
- 坏 validates（task 的 validates 指向不存在/废弃格式的锚点，口径同 `doctor`/`TaskManager` 的存在性校验）：**不计入 covered**（否则覆盖率算歪），单列 `broken_validates` 并在 warnings 提示"详细修复看 doctor"。
- archived spec：默认不计入任何欠债；JSON 里可统计，text 默认弱化/隐藏，避免旧方案刷屏。
- 验收：
  - WHEN 一个 spec 写了 `#### F-01` 但无任何 task validates 含 F-01，THEN F-01 进孤儿清单并按 spec 状态归类。
  - WHEN 某 task 的 validates 含一个不存在的锚点，THEN 它不计入 covered、出现在 broken_validates，且 warnings 指向 doctor。
  - WHEN spec 状态为 archived，THEN 它不出现在欠债统计里（text 默认不刷屏）。

#### F-03 release notes 草稿视图（低优先）

- `lrnev report --release-notes` 输出已完成工作清单草稿：按 scene/spec 分组，列 completed spec 及其 completed task 标题；供人复制微调；不依赖 git。
- 优先级低于链路/覆盖率：与体检共享同一次遍历产物（仅多一个渲染分支，不二次扫描），工期紧时可后置到后续迭代而不影响 F-01/F-02/F-05。
- 验收：
  - WHEN 存在已 completed 的 spec 与 task，THEN `--release-notes` 输出含这些 spec/task 标题的分组清单。
  - WHEN 无任何已完成项，THEN 输出空清单友好提示而非报错。

#### F-04 输出形态、--scene 过滤与 CLI/MCP 对等

- 默认 text 打终端；`--md` markdown 到 stdout；`--json` 结构化对象；三者互斥，json 面向机器/CI（仅数据，无退出码语义）。
- `--out <path>` 把当前格式落盘到指定路径；不给 `--out` 一律不写文件；绝不向 `.lrnev` 或默认路径写。
- `--scene <id>`：只体检指定 scene（解析同 `SceneManager.resolveId`）；不给则全量。
- 顶部一句话总结：有硬欠债（做完没收口 spec >0 或 failed task >0）→ 报欠债概述；否则 → "整体健康"。headline 所提债类型在明细段都能找到。
- MCP `lrnev_report` 返回结构化数据（等价 `--json`），参数含 `scene?` / `release_notes?`，口径与 CLI `--json` 一致。
- 验收：
  - WHEN `lrnev report --json`，THEN 输出可 JSON.parse，含链路+覆盖率两段数据。
  - WHEN `lrnev report --md --out X.md` 后再执行无 `--out` 的 `report`，THEN 仅前者落盘 X.md，后者不产生任何文件。
  - WHEN `lrnev report --scene <id>`，THEN 只含该 scene 的数据。
  - WHEN MCP `lrnev_report({scene})` 与 CLI `report --scene <id> --json`，THEN 数据深相等。

#### F-05 每条欠债带「可执行下一步」

- 每条欠债项随结果附一个确定性的"下一步" hint，让报告从"诊断"升级为"分红"：
  - 做完没收口 → `spec_gate_check(scene, spec, gate=completion)`，通过后 `spec_update(scene, spec, status=completed)`。
  - 孤儿锚点（真欠债）→ 提示"给该锚点补一个 task 的 validates，或确认需求是否还需要"。
  - failed task → 提示 `error_record` 记录 + `task_update` 重试路径。
  - 坏 validates → 指向 `doctor` 查全量 + 手改 tasks.md。
- hint 是文字/结构化建议，不自动执行；report 不替人做决定（呼应"不自动触发 AI 行动"）。
- 验收：
  - WHEN 报告含一条"做完没收口"spec，THEN 该项带可执行下一步（completion gate → spec_update）。
  - WHEN 报告含一条 failed task，THEN 该项带可执行下一步（error_record / 重试）。

### 非功能性需求

- 性能：一次性快照，遍历 `.lrnev` 即可；命中规模与 `status`/`map` 同量级，`--scene` 时只遍历该 scene；不引入额外重扫。
- 兼容性：零模型、零新运行时依赖；无 `.lrnev`/空工作区给友好提示而非崩溃；不改动任何治理源文件。

### 边界与依赖

- 复用现有扫描与解析：scene/spec 遍历同 `GovernanceMap`/`ProjectStatus`，task 解析用 `parseTasksFromMarkdown`+`attachTaskChildren`，锚点用 FILL-aware 提取（参照 `GovernanceMap.anchorHeadings`），坏 validates 口径复用 `TaskManager` 的存在性校验；不新建独立扫描器。
- **report vs doctor 边界（重要）**：doctor = 工作区结构健康（目录/锁/孤儿 agent/坏引用的**详细修复**、stale 判定）；report = 治理进度体检（收口/覆盖率/欠债的**呈现 + 下一步**）。两者都碰的（坏 validates）：report 只标记+不算歪覆盖率+指向 doctor，不重复 doctor 职责。
- completion 判定必须与 `GateRunner` 的 `all_tasks_completed` 同口径，避免 report 与 gate 互相打脸。
- 不依赖 git；不依赖外部网络。

### 验收标准

<!-- 最初的失败信号：当前肉眼看不出"做完没收口"的 spec（真机已证实 02-context-delivery/01-00、02-00 task 全完但 status=draft）；headline 说"有债"却找不到具体 failed 项。期望结果：一条命令把它们全列出来并给下一步。 -->
- [ ] `lrnev report` 列出"做完没收口"spec（与 completion gate 口径一致）、failed/blocked 明细、孤儿锚点、坏 validates，且与手工统计一致。
- [ ] 每条欠债带可执行下一步 hint 与 context:// 定位。
- [ ] `--scene` 过滤、`--md`/`--json`/`--out` 输出形态行为符合 F-04，默认不写任何文件，无 CI 退出码。
- [ ] `lrnev report --release-notes` 产出按 scene/spec 分组的已完成清单（低优先）。
- [ ] MCP `lrnev_report`（含 scene/release_notes）与 CLI `--json` 数据口径一致。
- [ ] 单元 + e2e 测试通过，零模型、无新运行时依赖。
