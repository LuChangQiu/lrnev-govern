---
spec: '02-00-locator-upgrade'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 02-00 定位升级：治理地图 + 锚点抽段 + BM25 - 设计

> 设计依据：已核源码 `src/core/Searcher.ts`（`scoreText:91`、`makeSnippet:127`、`levelBoost:101`、`tokenize:83`）+ requirements F-01~F-03。
> **硬前置**：F-02 复用 01-00 沉淀的 `extractAnchorSections`；01-00 未先落地则本 spec 的 F-02/F-01 阻塞或重复造。

## L0 摘要

三件都在 `Searcher` 现有全量扫描（几十毫秒）上做，零模型、零新依赖：地图聚合 frontmatter + 标题，抽段复用 01-00 的 `extractAnchorSections`，BM25 替换裸命中计数。

## L1 概览

### 架构思路

- IO 非瓶颈（数千小 md 几十毫秒），问题是"返回得不够小不够准"——三件都改"返回/排序"，不改"扫描"。
- 复用 01-00 的锚点抽段、scene 01 的摘要 sidecar（`levelBoost`），不引入新数据结构。

### 主要模块

- `Searcher.search`（`:18`）：候选打分主循环。
- `scoreText`（`:91`，现裸命中计数）→ BM25（D-03）。
- `makeSnippet`（`:127`，现返回首个命中行）→ 锚点段（D-02）。
- 新增地图能力（D-01）：core 新模块 + CLI `lrnev map` + MCP 工具（或扩 `project_status` 视图，design 阶段定形态）。
- `SearchResult`（`src/types/search.ts`）：D-02 新增 `anchor` 字段。

### 关键决策

| 决策 | 取舍 | ADR? |
|------|------|------|
| 不上 SQLite FTS / 向量 | 零模型是身份；触发条件（扫描 >300-500ms）未到 | 否（见 roadmap 待评估） |
| BM25 纯算术 ~50 行 | 不引分词器，tokenize 子串口径不变，对中文照常 | 否 |
| 地图只取标题不取正文 | 地图是目录不是内容，控体积 ~2-4k token | 否 |

## L2 详情

### 模块详细设计

#### D-01 治理地图（F-01）

- 新增只读能力，输出 scene → spec（id/status/priority/L0）→ 该 spec 锚点标题列表（`#### F-xx 标题` / `#### D-xx 标题`）。
- 实现 = 聚合已有 frontmatter + 扫 requirements/design 的标题行跑 `extractAnchorPool` 风格的**标题级**提取。**读文件、但输出只含标题级**（取 `#### F-xx` / `#### D-xx` 标题，不把正文放进输出）。目标体积 ~2-4k token，一次入上下文，AI 据此用 URI 直接跳转。
- 纯只读、无写副作用。

#### D-02 context_search 锚点级抽段返回（F-02）

- `makeSnippet` 升级：命中位置若落在某 `#### F-xx` / `#### D-xx` 段内，snippet 改为**该锚点段落内容**（复用 01-00 的 `extractAnchorSections`，受其同款截断约束），`SearchResult` 附 `anchor` 字段标明命中哪个锚点。
- 命中落在锚点段外（L0/L1 摘要、frontmatter）→ 保持现有行级 snippet，`anchor` 为空。
- 一个文档多个锚点段命中 → 返回得分最高的那个（不展开全部，避免膨胀）。

#### D-03 BM25 打分替换裸命中计数（F-03）

- **召回与排序分离（关键）**：当前 `Searcher.ts:32-34` 用 `scoreText` 一个值同时做召回门（`textScore<=0 → continue`）和排序分。BM25 的 IDF 对"过半文档都含"的高频词会变负，直接替换会把命中文档误踢出召回集、破坏"召回集不缩小"。故**召回谓词独立保留**（裸命中 / contains 判断是否入候选，第 33 行谓词不动），BM25 只算**排序分**。
- **BM25 需语料统计 → 改两趟**：`scoreText(text)` 是纯单文档的，BM25 要 df（词的文档频率）与 avgdl（平均文档长度），都是跨文档量。故主循环改两趟：先扫候选收集 df / 各文档长度 / avgdl，再逐个算 BM25。
- BM25 本体：词频饱和（k1，一个词出现 10 次不等于 10 倍相关）+ 文档长度归一化（b，短而精准不被长文档高频词压过）；保留 `levelBoost`（L0/L1 加权）叠加在 BM25 分之上；`tokenize` 不变（子串口径，对中文两字词照常）。

### 数据模型

- `SearchResult` 新增可选 `anchor` 字段；地图输出为 scene→spec→标题 的层级只读结构。

### 接口契约

- `context_search` 返回新增 `anchor` + 段落级 snippet；新增地图能力的 CLI JSON 与 MCP 工具输出对等（S1）。

### 错误处理

- 某 spec 无 L0 → 地图该项 L0 空，不读全文兜底；抽段失败 → 退回行级 snippet。均不报错。

### 测试策略

- 单元：BM25（短精准胜长高频 / 中文两字词 / 召回不缩小）；抽段（命中段内返回段 / 段外行级 / 多命中取最高分）；地图（层级完整 / 无 L0 不报错 / 体积只含标题级）。
- `npm test` 全绿、无回归。
