---
spec: '02-00-locator-upgrade'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 02-00 定位升级：治理地图 + 锚点抽段 + BM25 - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。
> 注：本批任务因 MCP 当前 root 指向旧树，由 AI 按 lrnev 任务块格式手写到本树；root 切回后可用 task_list / doctor 校验。
> **硬前置**：T-002 复用 01-00 沉淀的 `extractAnchorSections`，须待 01-00 落地后再做（跨 spec 依赖，不写进 depends_on）。

## 验收标准（整体）

- [x] F-01~F-03 实现并各自单测通过
- [x] 零模型、零新依赖；扫描性能不退化（仍是现有全量扫描的两趟，纯算术）
- [x] CLI 与 MCP 输出对等；`npm test` 全绿无回归（617 passed）
- [x] 所有任务完成

## 任务

### T-001 BM25 排序分：召回谓词独立 + 两趟语料统计 + 单测 <!-- lrnev-task: status=completed, created=2026-06-15T09:00:00.000Z, updated=2026-06-16T02:10:00.000Z, validates=F-03|D-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T02:00:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T02:10:00.000Z"}] -->

BM25 只做排序分、不替代召回判定：召回继续用裸命中 / contains（`Searcher.ts:33` 谓词不动），避免 BM25 的负 IDF 把命中文档踢出候选。BM25 需 df / avgdl（跨文档量），故主循环改两趟——先扫候选收集 df / 文档长度 / avgdl，再逐个打分；词频饱和 k1 + 长度归一化 b，保留 `levelBoost` 叠加，`tokenize` 子串口径不变。纯算术、零依赖。可独立于 01-00 先做。

**验收**：
- 搜"登录"时短而精准的 spec 排在提了 10 次"登录"的长文档前
- 中文两字词照常打分，不因 trigram 类限制失效
- **召回集不缩小**：高频 / 负 IDF 词命中的文档仍在候选里（召回谓词独立于 BM25 排序分）

### T-002 context_search 锚点级抽段返回 + SearchResult.anchor <!-- lrnev-task: status=completed, created=2026-06-15T09:01:00.000Z, updated=2026-06-16T02:20:00.000Z, validates=F-02|D-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T02:12:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T02:20:00.000Z"}] -->

`makeSnippet`（:127）升级：命中落在 `#### F-xx`/`#### D-xx` 段内时返回该段落（复用 01-00 的 `extractAnchorSections`，受同款截断），`SearchResult` 加 `anchor` 字段；段外保持行级 snippet；多命中取最高分。**硬依赖 01-00 的 extractAnchorSections 先落地。**

**验收**：
- 命中某 spec requirements 的 F-03 段 → 结果含 anchor:"F-03" 和该段落内容
- 命中段外（L0 摘要）→ 保持行级 snippet，anchor 为空
- 一文档多锚点命中 → 返回得分最高的一个

### T-003 治理地图能力（CLI lrnev map + MCP 工具） <!-- lrnev-task: status=completed, created=2026-06-15T09:02:00.000Z, updated=2026-06-16T02:40:00.000Z, validates=F-01|D-01 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T02:22:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T02:40:00.000Z"}] -->

新增只读地图能力：聚合 scene/spec frontmatter（id/status/priority/L0）+ 标题级锚点提取（只取标题不取正文），输出层级全景 ~2-4k token。形态（新 core 模块 + CLI/MCP，或扩 project_status 视图）在实现时定。

**验收**：
- 返回全部 scene→spec→锚点标题层级，每 spec 含 status/priority/L0
- 某 spec 无 L0 → 该项 L0 空，不读全文兜底
- 数百 spec 时只含标题级信息、体积可控；纯只读无写副作用

### T-004 CLI/MCP 对等 + 全量回归 <!-- lrnev-task: status=completed, created=2026-06-15T09:03:00.000Z, updated=2026-06-16T02:50:00.000Z, validates=F-02|F-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T02:42:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T02:50:00.000Z"}] -->

确认三件的输出在 CLI JSON 与 MCP 工具间同构；补集成测试；确认扫描性能不退化；`npm test` 全绿。

**验收**：
- search（anchor/snippet）与地图的 CLI/MCP 输出同构
- 扫描性能不退化（<300ms 目标内）
- 新增测试覆盖，无回归

**依赖**：T-002, T-003
