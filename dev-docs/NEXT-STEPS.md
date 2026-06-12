# lrnev 执行顺序总纲（2026-06-12）

> 汇总 2026-06-12 全部讨论的执行视图：先做什么、每步引用哪份权威文档、彼此什么依赖。
> 战略依据：`PRODUCT-STRATEGY.md`（为什么）；本文只管「按什么顺序动手」。
> 检索与规模化结论此前未落档，收录在本文第三节。

---

## 一、执行顺序（带依赖）

```
0. 开工整备（5 分钟）                            ✅ 完成（2026-06-12，commit 38b4251）

1. scene 01-findings-remediation 实现           ✅ 完成（2026-06-12，649cff8..2c8c520）
   7 spec 全部 completion gate passed + status=completed
   独立核验通过：591 测试全绿、构建零警告、
   checklist 边界逐条验证、5 项硬校验真机冒烟全过
   ⚠ 遗留：版本仍 1.3.1、CHANGELOG 未补——行为变更（gate 变严、
   validates 收紧）发布前应升 1.4.0 + CHANGELOG 条目

2. 每批实现完成 → 真机回归                       ◐ 部分完成
   ✅ 单测/构建/CLI 冒烟（2026-06-12 独立核验）
   ☐ 真实客户端回归：dev-docs/INTEGRATION-TEST.md 第三节（黄金路径）、
     第五节（新行为）、第六节（边界自救）、第八节（ai_followup 真驱动）
   ☐ 多模型矩阵（第九节）至少跑 Claude + 一个非 Claude 模型
   ☐ 顺手修正文档数字漂移：实测为 41 文件 / 591 测试（INTEGRATION-TEST
     写 520+、PROJECT.md 写 570）

3. 任务启动上下文（锚点内容回填）                 ← S6 完成后立即，窗口最佳
   依据：dev-docs/TASK-START-CONTEXT.md（验收口径已收敛，按文档开 spec）
   复用 S6 的锚点基础设施（extractAnchorPool → 新增 extractAnchorSections）

4. 检索三件套（见第三节结论）
   ① 治理地图（repo-map 思路，定位的"不搜索"解法）
   ② context_search 升级：BM25 打分 + 锚点级抽段返回
   ③ （不做新 spec_locate 工具，升级 context_search 返回结构，工具数不涨）

5. 战略四步继续（PRODUCT-STRATEGY.md）
   维护通道铺显（followup/steering）→ git pre-commit + doctor 审计
   （硬依赖维护通道先行）→ AGENTS.md / lrnev integrate 薄垫片 → lrnev report
```

**锚点基础设施是贯穿 1/3/4/5 的同一条筋**，一份投入五处变现：

```
#### F-xx / D-xx 锚点
  ├─ S6：validates 格式 + 存在性硬校验（写入时挡坏引用）
  ├─ 任务启动上下文：锚点段落回填（动手前送达验收口径）
  ├─ context_search：锚点级抽段返回（搜索终点从文档细到段落）
  ├─ 治理地图：锚点标题构成地图叶子（定位不依赖搜索）
  └─ lrnev report：F-xx 任务覆盖率 / 追溯链完整度（事后收割）
```

---

## 二、三份文档的角色分工

| 文档 | 角色 | 何时翻 |
|---|---|---|
| `FINDINGS-CHECKLIST.md` | scene 01 的最终决定表（用户拍板） | 实现 scene 01 任一 spec 前回查边界 |
| `INTEGRATION-TEST.md` | **常备真机验证关卡**——覆盖 CI 测不到的协议握手、ai_followup 真驱动、多模型矩阵、性能基准 | 每批行为变更（gate/followup/工具）合入后；发版前 |
| `TASK-START-CONTEXT.md` | 已收敛的功能提案（验收口径定稿） | S6 完成后立项开 spec 时 |
| `PRODUCT-STRATEGY.md` | 战略层「为什么和往哪走」 | 评估新需求是否该做、排序时 |
| 本文 | 执行层「按什么顺序动手」 | 每完成一步勾掉、接下一步 |

注意：INTEGRATION-TEST.md 标注 38 工具 / 520+ 测试，PROJECT.md 写 570 测试——数字有漂移，下次真机走清单时顺手以实跑输出为准修正。

---

## 三、检索与规模化结论（2026-06-12 讨论收敛，此前未落档）

### 背景问题

1. AI 自己定位文档烧 token——要不要引入数据库/向量库？
2. 大项目 spec/文档多了之后怎么快速定位？

### 已核实的现状（源码证据）

- `context_search` 每次调用全量扫 `.lrnev/**/*.{md,json}`，关键词命中计数打分，L0(+8)/L1(+4) 摘要加权，返回 top_k（`src/core/Searcher.ts:30-47`）。
- **token 烧在召回之后**：打分是整文档级、snippet 只返回第一个命中行（:91-99, :127-131）——命中藏在某个 `#### F-03` 段落里时，AI 拿到「文档 URI + 一行话」，只能去读全文。搜索粒度的终点是文档，浪费发生在最后一公里。
- 语料规模：即使大项目（数百 spec）也只是几千个小 md、几 MB，全量扫描几十毫秒——**IO 在可见的未来不是瓶颈**。

### 结论（按确定性排序）

| 方案 | 结论 | 理由 |
|---|---|---|
| **向量库 / embedding** | **永远不做** | 零模型是身份；本地向量库无 embedding 模型无意义、内置模型破坏零依赖；治理语料小而结构强，关键词+结构在此尺度打得过模糊语义（Sourcegraph 实测放弃 embeddings 退回关键词可为旁证） |
| **持久化 JSON 索引缓存** | **不做（砍掉 GPT 提的中期层）** | 为不存在的瓶颈优化；无 watcher 时谁更新索引是死结（requirements/design 由 AI 直接编辑文件、不走 lrnev 工具，写路径钩子兜不住）；多窗口写竞争；还要 doctor 查 stale=为缓存新增治理负担。真要省 IO，MCP 长连接进程内 mtime 键控内存 memo 即可，磁盘零新文件 |
| **SQLite FTS5** | **现在不上，条件后手** | 成本三笔：①依赖（better-sqlite3=首个原生依赖破坏轻装；node:sqlite 需把 engines 从 >=20 提到 22.5+，22.x 仍 Experimental）②中文回退（unicode61 不分中文；trigram 要求查询≥3 字符，治理语料两字词是主力——naive FTS5 比现状还差，要 LIKE 兜底）③陈旧性死结同上。**触发条件**：真实项目扫描 >300-500ms 可感知时再上，作 `.lrnev/cache/` 可丢缓存，届时 Node 24 基线 + trigram + LIKE 兜底 + mtime 校验 |
| **锚点级抽段返回** | **做（正解之一）** | token 问题的解法是「返回更小更准」不是「搜得更快」；复用锚点基础设施（见第一节筋图） |
| **治理地图** | **做（定位的最优解）** | 抄 Aider repo-map：scene→spec(状态/L0)→锚点标题 的压缩全景，约 2-4k token 一次性入上下文，AI 看图用 URI 直接跳转——把定位从 O(搜索质量) 变 O(1)。实现=聚合已有 frontmatter + extractAnchorPool 输出 |
| **BM25 打分** | **做（廉价升级）** | 替换裸命中计数（现状：长文档高频词压过精准短文档）；纯算术零依赖约 50 行，对中文子串照常工作 |

### 大厂对照（为什么这个方向是对的）

精确派在上位、向量派在退潮（代码/结构化文本 + agent 场景）：Claude Code 零索引纯 agentic grep 迭代；Sourcegraph Cody 公开放弃 embeddings 退回 Zoekt trigram + BM25；Google Code Search / GitHub Blackbird 都是 trigram 精确索引；Aider 用 tree-sitter repo map「不搜索、给地图」。lrnev 该抄的全在精确派，且每一件都恰好零模型——身份约束站在了行业风向的正确一侧。

### 检索域优先级

**治理地图 > 锚点抽段 > BM25 >（条件触发的）SQLite FTS**。前三个零模型、零新依赖、复用已有数据结构。

---

## 四、现在就该做的一件事

**scene 01 的 S2（deterministic-hard-checks，P0）**，开工前做完第一节第 0 步整备。其余一切都在它和 S6 的下游。
