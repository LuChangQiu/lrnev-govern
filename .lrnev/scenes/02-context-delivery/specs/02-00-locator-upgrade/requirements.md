---
spec: 02-00-locator-upgrade
scene: 02-context-delivery
status: completed
priority: P1
created: '2026-06-15'
updated: '2026-06-18'
---

# 02-00 定位升级：治理地图 + 锚点抽段 + BM25 - 需求

> 权威依据：`dev-docs/NEXT-STEPS.md` 第三节（检索与规模化结论，源码证据已核）+ `dev-docs/PRODUCT-STRATEGY.md`（收割结构化数据主线）。
> 前置：本 scene 的 spec 01-00 沉淀 `extractAnchorSections`（锚点 ID→段落映射），本 spec 的 F-02 复用它。

## L0 摘要

把"AI 了解项目现状靠读一堆文件、搜索停在文档级"升级为：一张压缩治理地图直接跳转、context_search 锚点级抽段返回、BM25 打分压过裸命中计数。三件套都零模型、零新依赖。

## L1 概览

### 问题域

scene 01 修通了治理数据的"写入正确性"（硬校验），spec 01-00 修通了"任务启动时送达"（锚点回填）。但 AI **定位**治理数据仍有两处低效，已核源码：

**问题一：定位靠搜索，没有全景地图。**

AI 要了解"项目有哪些 spec、什么状态、关键需求是什么"，只能反复 context_search + 逐个读文件。定位质量是 O(搜索质量)——搜得好就找到，搜不好就漏。理想是给一张地图：scene→spec(状态/L0)→锚点标题 的压缩全景，AI 看一眼用 URI 直接跳转，定位变 O(1)。这是 Aider repo-map 的思路（"不搜索，给地图"）。

**问题二：搜索粒度停在文档级，token 浪费在最后一公里。**

`context_search`（`src/core/Searcher.ts`）现状已核：
- 打分是**裸命中计数**（`scoreText` L91-99：term 出现几次加几分）——长文档高频词压过精准短文档。
- snippet **只返回第一个命中行**（`makeSnippet` L127-131）。
- 命中藏在某个 `#### F-03` 段落里时，AI 拿到的是"文档 URI + 一行话"，只能去读**整篇** requirements.md。搜索的终点是文档，浪费发生在最后一公里。

语料规模：即使数百 spec 也只是几千个小 md、几 MB，全量扫描几十毫秒——**IO 不是瓶颈**，问题是"返回得不够小不够准"，不是"搜得不够快"。

### 为什么是这三件（不是别的）

检索域优先级（NEXT-STEPS 第三节收敛）：**治理地图 > 锚点抽段 > BM25 >（条件触发的）SQLite FTS**。前三个零模型、零新依赖、复用已有数据结构；SQLite FTS 现在不上（中文 trigram ≥3 字符 vs 治理语料两字词主力、陈旧性死结、依赖破坏轻装——触发条件是扫描 >300-500ms 可感知时）。向量/embedding 永远不做（零模型是身份）。大厂对照：Claude Code 零索引 agentic grep、Sourcegraph 放弃 embeddings 退回 trigram+BM25、Aider tree-sitter repo-map——该抄的全在精确派，且每件都恰好零模型。

### 用户故事

- **U-1（治理地图）**：新会话接手项目时，我希望调一次就拿到全部 scene/spec 的压缩全景（状态 + L0 + 锚点标题），看图用 URI 直接跳转，而不是反复搜索+读文件。
- **U-2（锚点抽段）**：context_search 命中某 spec 的 F-03 段落时，我希望直接拿到 F-03 那一段，而不是"文档 URI + 一行"然后自己读整篇。
- **U-3（精准打分）**：搜"登录"时，我希望短而精准的登录 spec 排在一个泛泛提了 10 次"登录"的长文档前面。

### 范围

**包含**：
- F-01：治理地图——聚合 scene/spec frontmatter + 锚点标题的压缩全景。
- F-02：context_search 锚点级抽段返回——命中定位到 `#### F-xx`/`#### D-xx` 段落，复用 `extractAnchorSections`。
- F-03：BM25 打分替换裸命中计数。

**不包含**：
- SQLite FTS5 —— 条件触发的后手（扫描 >300-500ms 时），见 roadmap「待评估」。
- 向量/embedding/语义检索 —— 永远不做（零模型是身份）。
- 持久化 JSON 索引缓存 —— 不做（无 watcher 时陈旧是死结，见 roadmap）。
- 入口执法/report/AGENTS.md —— scene roadmap 后续阶段，与定位无关。

## L2 详情

### 详细需求

#### F-01 治理地图

- 描述：新增一个只读能力（CLI `lrnev map` + MCP 工具，或扩展 project_status 的一个视图——design 阶段定形态），输出当前工作区的压缩全景：scene → spec（id/状态/优先级/L0 摘要）→ 该 spec 的锚点标题列表（`#### F-xx 标题` / `#### D-xx 标题`）。目标体积约 2-4k token，一次性入上下文，AI 据此用 URI 直接跳转。实现 = 聚合已有 frontmatter + 扫 requirements/design 的标题行跑 `extractAnchorPool` 风格的标题提取；**读文件、但输出只含标题级**（只取 `#### F-xx` / `#### D-xx` 标题，不把段落正文放进输出——地图是目录不是内容）。
- 验收：
  - WHEN 调治理地图 THEN 返回全部 scene→spec→锚点标题的层级结构，每个 spec 含 status/priority/L0。
  - WHEN 某 spec 无 L0 摘要 THEN 该项 L0 字段为空，不报错、不读全文兜底。
  - WHEN 工作区有数百 spec THEN 地图只含标题级信息（不含段落正文），体积可控。
  - 纯只读，无写副作用（遵 NFR-1）。

#### F-02 context_search 锚点级抽段返回

- 描述：context_search 命中文档后，若命中位置落在某个 `#### F-xx` / `#### D-xx` 锚点段落内，返回结果的 snippet 升级为**该锚点段落内容**（而非首个命中行），并附 `anchor` 字段标明命中哪个锚点。命中不在任何锚点段内（如 L0/L1 摘要、frontmatter）时，保持现有行级 snippet。复用 spec 01-00 的 `extractAnchorSections`。
- 验收：
  - WHEN 搜索命中某 spec requirements 的 F-03 段落 THEN 结果含 `anchor: "F-03"` 和 F-03 段落内容（受 spec 01-00 同款截断上限约束）。
  - WHEN 命中落在锚点段之外（如 L0 摘要）THEN 保持现有行级 snippet，`anchor` 为空。
  - WHEN 一个文档多个锚点段命中 THEN 返回得分最高的锚点段（不展开全部，避免膨胀）。
  - 返回结构变更对 CLI JSON 与 MCP 对等。

#### F-03 BM25 打分替换裸命中计数

- 描述：把 `scoreText`（现状裸命中计数）替换为 BM25 打分：考虑词频饱和（一个词出现 10 次不等于 10 倍相关）与文档长度归一化（短而精准的文档不被长文档的高频词压过）。纯算术、零依赖、约 50 行。对中文子串匹配照常工作（BM25 的 term 仍是 tokenize 出的子串，不依赖分词器）。L0/L1 摘要加权（现有 `levelBoost`）保留，叠加在 BM25 分之上。
- 验收：
  - WHEN 搜索"登录"，A 是短而精准的登录 spec、B 是提了 10 次"登录"的长文档 THEN A 排在 B 前面。
  - WHEN 中文两字词查询（如"登录"）THEN BM25 照常打分，不因 trigram 类限制失效。
  - WHEN 现有搜索用例 THEN 召回集不缩小（BM25 改的是排序，不是召回门槛——textScore>0 仍入候选）。

### 非功能性需求

- 性能：三件都在现有全量扫描（几十毫秒）基础上做，不新增 IO；BM25 是纯算术；地图读文件但输出只含 frontmatter + 标题行、不取正文段落。扫描 <300ms 目标内。
- 兼容性：F-02 改 search 返回结构（新增 anchor 字段、snippet 可能是段落），需确认现有 search 消费方不被破坏；F-03 改排序不改召回；F-01 是新增能力。零模型、零新依赖。
- CLI/MCP 对等：三件的输出在 CLI JSON 与 MCP 工具间同构（S1 原则）。

### 边界与依赖

- **硬依赖 spec 01-00 先做**：F-02 复用 01-00 沉淀的 `extractAnchorSections`（锚点 ID→段落映射）；F-01 复用同族的标题提取。01-00 不先把这个工具抽出来，本 spec 的 F-01/F-02 要么重复造、要么阻塞。
- 改动集中在 `src/core/Searcher.ts`（F-02/F-03）+ 新增地图能力（F-01，core 新模块或扩展 ProjectStatus）。
- 与永远不做的边界：不引入向量、不持久化索引、不上 SQLite（除非触发条件）。

### 验收标准

最初失败信号：AI 定位靠反复搜索+读全文（无地图）；context_search 命中后只给文档 URI+一行，AI 读整篇；裸命中计数让长文档高频词压过精准短文档。期望结果：一张图直接跳转、命中给锚点段落、排序按 BM25 精准。
- [ ] F-01：治理地图返回 scene→spec(状态/L0)→锚点标题压缩全景，纯只读，体积可控。
- [ ] F-02：context_search 命中锚点段时返回该段落 + anchor 字段，命中段外保持行级 snippet。
- [ ] F-03：BM25 排序让短精准文档胜过长文档高频词；中文子串照常；召回不缩小。
- [ ] CLI/MCP 对等；零模型零新依赖；扫描性能不退化。
- [ ] 新增测试覆盖；npm test 全绿无回归。
