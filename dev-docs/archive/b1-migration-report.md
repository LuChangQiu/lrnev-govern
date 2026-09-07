# B1 五角色文本迁移报告

## 执行摘要

**迁移范围**: 346 surfaces（02-00 冻结基线 → 08-00 五角色标注）
**迁移方式**: 保留原文本（text_legacy），新增五角色标注（text_v1）
**完成时间**: 2026-09-01
**基线版本**: v2 (02-00) → v3 (08-00)

## 1. 迁移范围统计

### 1.1 按 channel 分组

| Channel | 数量 | 拆分 | 单一 | 状态 |
|---------|------|------|------|------|
| tool_input_schema | 121 | 1 | 120 | ✅ |
| tool_metadata | 84 | 42 | 42 | ✅ |
| governance_doc | 76 | 76 | 0 | ✅ |
| tool_annotations | 42 | 0 | 42 | ✅ |
| mcp_resource | 17 | 0 | 17 | ✅ |
| ai_followup | 5 | 5 | 0 | ✅ |
| server_instructions | 1 | 1 | 0 | ✅ |
| **总计** | **346** | **125** | **221** | ✅ |

**说明**：
- **拆分**: surface 被拆分为多个角色片段（1→N）
- **单一**: surface 保持单一角色（1→1）
- 所有 346 个 surfaces 均已完成迁移，无遗漏

### 1.2 迁移 vs 未迁移

- **已迁移**: 346 个（100%）
- **未迁移**: 0 个（0%）

所有 surface 均含自然语言描述，全部完成五角色标注。

## 2. 五角色分布

### 2.1 总体统计

| 角色 | 数量 | 占比 | 定义 |
|------|------|------|------|
| FACT | 907 | 87.7% | 客观事实陈述，不含建议或判断 |
| ACTION_HINT | 53 | 5.1% | 操作提示/何时用 |
| RECOMMENDATION | 42 | 4.1% | AI 建议（"建议 X"、"推荐 Y"） |
| DECISION_BOUNDARY | 17 | 1.6% | 决策边界/条件判断 |
| EXECUTION_CONSTRAINT | 15 | 1.5% | 执行约束/限制/禁止 |
| **总角色片段** | **1034** | **100%** | - |

**分析**：
- FACT 占主导（87.7%），符合预期（大部分是工具描述、参数说明等客观信息）
- ACTION_HINT（5.1%）主要来自"何时用"、"前置"、"例子"等操作提示
- RECOMMENDATION（4.1%）主要来自工作流建议和治理建议
- DECISION_BOUNDARY（1.6%）主要来自分流逻辑和条件判断
- EXECUTION_CONSTRAINT（1.5%）主要来自"必须"、"禁止"等硬约束

### 2.2 拆分统计

- **总 surfaces**: 346
- **总角色片段**: 1034
- **拆分为多个角色的 surfaces**: 125（36.1%）
- **保持单一角色的 surfaces**: 221（63.9%）

**拆分比例**：
- 1→1（单一）: 221 个（63.9%）
- 1→2: 约 50 个
- 1→3+: 约 75 个
- 最大拆分: 1→8（server_instructions:global:workflow_overview）

## 3. 典型案例

### 案例 1: server_instructions:global:workflow_overview
**Channel**: server_instructions  
**拆分**: 1→8

**【拆分前】**:
```
lrnev 是确定性的项目治理引擎：文件即真相，不调用 LLM。
概念：Scene > Spec > Task；Gate 只查结构契约；ADR/Errorbook/Memory 是轻产物。
新建特性：首次先 lrnev_init，再 spec_create；填 requirements 后跑 spec_gate_check(ready)，再拆任务（多条清单用 task_create_many、单条用 task_create），最后 spec_gate_check(completion)。
接手项目：先调 project_status 拿全貌，从 in_progress task 继续；可用 governance_map 看治理全景、lrnev_report 看治理欠债。
分流(便宜先)：写不出独立验收→直接做；已有特性增量→落位 spec；独立新特性→spec_create。新 spec 优先已有 scene；新域经用户确认会有多 spec→scene_create；无域小特性落 00-default；scene/00 不确定问用户。踩坑→error_record，决策→adr_create，约定→memory_save。
不确定下一步时调 lrnev_guide。
```

**【拆分后】**:
1. **FACT**: lrnev 是确定性的项目治理引擎：文件即真相，不调用 LLM。
2. **FACT**: 概念：Scene > Spec > Task；Gate 只查结构契约；ADR/Errorbook/Memory 是轻产物。
3. **ACTION_HINT**: 新建特性：首次先 lrnev_init，再 spec_create；填 requirements 后跑 spec_gate_check(ready)，再拆任务（多条清单用 task_create_many、单条用 task_create），最后 spec_gate_check(completion)。
4. **ACTION_HINT**: 接手项目：先调 project_status 拿全貌，从 in_progress task 继续；可用 governance_map 看治理全景、lrnev_report 看治理欠债。
5. **DECISION_BOUNDARY**: 分流(便宜先)：写不出独立验收→直接做；已有特性增量→落位 spec；独立新特性→spec_create。
6. **DECISION_BOUNDARY**: 新 spec 优先已有 scene；新域经用户确认会有多 spec→scene_create；无域小特性落 00-default；scene/00 不确定问用户。
7. **RECOMMENDATION**: 踩坑→error_record，决策→adr_create，约定→memory_save。
8. **ACTION_HINT**: 不确定下一步时调 lrnev_guide。

**【语义等价验证】**: ✓ 所有片段按顺序拼接可还原原文语义

---

### 案例 2: tool_metadata:lrnev_guide:description
**Channel**: tool_metadata  
**拆分**: 1→4

**【拆分前】**:
```
返回 lrnev 工作流、工具速查、错误自救和核心概念。何时用：不确定下一步、刚接入 MCP、或 gate/状态机报错时。前置：无。例子：lrnev_guide{topic:"errors"} → 只看错误自救。
```

**【拆分后】**:
1. **FACT**: 返回 lrnev 工作流、工具速查、错误自救和核心概念
2. **ACTION_HINT**: 何时用：不确定下一步、刚接入 MCP、或 gate/状态机报错时
3. **EXECUTION_CONSTRAINT**: 前置：无
4. **ACTION_HINT**: 例子：lrnev_guide{topic:"errors"} → 只看错误自救

**【语义等价验证】**: ✓ 所有片段按顺序拼接可还原原文语义

---

### 案例 3: tool_metadata:spec_create:title
**Channel**: tool_metadata  
**拆分**: 1→1（单一）

**【拆分前】**:
```
Create Spec
```

**【拆分后】**:
1. **FACT**: Create Spec

**【语义等价验证】**: ✓ 单一片段，语义完全一致

## 4. F-05~F-08 逐条对照

### F-05（回放与回归）
**要求**: 346 surfaces 必须全覆盖；每个 surface 保留原 surface_id、channel、baseline_ref（标注 08-00）；原文本保留在 text_legacy。

**满足情况**: ✅ 完全满足
- 346 个 surfaces 全部迁移，无遗漏
- 所有 surface 保留原 surface_id、channel
- baseline_ref 已标注为 "08-00"
- text_legacy 字段完整保留原 v2 文本

---

### F-06（语义等价）
**要求**: 迁移后文本与原文本语义等价（事实陈述、约束、判断标准不变）；只改变文本角色标注，不改变行为含义。

**满足情况**: ⚠️ 未完全满足（初次迁移有 77 个 surface 内容丢失，已修复）
- **初次迁移问题**：167/346 个 surface 的 text_v1 片段内容不完整，其中 77 个丢失了行尾标点、换行等实质内容
- **修复措施**：从 text_legacy 重建完整的 text_v1 片段，添加 separator 字段以保证逐字节可逆
- **当前状态**：✅ 346/346 个 surface 均可从 text_v1 逐字节还原 text_legacy
- 拆分逻辑基于句子边界和关键词识别（建议、必须、禁止、何时用等）
- 典型案例验证：3 个案例的所有片段拼接后可还原原文语义
- 未引入新的行为含义或删除原有约束

**迁移规则**：
- "建议"、"推荐"、"优先" → RECOMMENDATION
- "必须"、"不得"、"禁止"、"不能" → EXECUTION_CONSTRAINT
- "何时用"、"前置"、"例子" → ACTION_HINT
- "→"、"如果...则" → DECISION_BOUNDARY
- 其他 → FACT

---

### F-07（归属完整性）
**要求**: 每句话必须归属到五角色之一；一句话只能属于一个角色；拆分后的片段必须能拼回原语义。

**满足情况**: ✅ 完全满足
- 1034 个角色片段，每个片段均归属唯一角色
- 无"无角色"或"多角色"的片段
- 所有片段按顺序拼接可还原原文本

**统计验证**：
- 总角色片段: 1034
- 所有片段均有明确 role 字段
- role 值域: {FACT, RECOMMENDATION, DECISION_BOUNDARY, EXECUTION_CONSTRAINT, ACTION_HINT}
- 无重复标注或遗漏

---

### F-08（diff 可追溯）
**要求**: 迁移 diff 必须可逆：text_legacy + 角色标注 → 可重构出 text_v1。

**满足情况**: ✅ 完全满足（修复后）
- **初次迁移问题**：167/346 个 surface 不可逆，text_v1 片段缺少分隔符信息（换行、标点、空白）
- **修复措施**：
  - 为每个 text_v1 片段添加 `separator` 字段，记录片段后的精确分隔符
  - 修复 167 个 surface 的内容丢失问题（包括前导/尾部空白、句尾标点等）
  - 重建算法：从 text_legacy 定位每个片段的真实边界，提取完整内容和分隔符
- **当前状态**：✅ 346/346 个 surface 逐字节可逆
- 所有 surface 保留 text_legacy（原文本完整保留）
- text_v1 是原文本按句子边界拆分后的角色标注，每个片段包含 `{role, content, separator}`
- 可逆验证：`text_v1.map(f => f.content + (f.separator || '')).join('') === text_legacy`

**全量验证结果**：
- 验证脚本：`scripts/validate-b1-invertibility.mts`
- 验证结果：346/346 通过（100%）
- 总片段数：1034
- 带分隔符的片段：733（70.9%）
- 无分隔符的片段：301（29.1%，通常是最后一个片段或行内片段）

## 5. 交付物

### 5.1 产出文件

| 文件路径 | 描述 | 行数 | 大小 |
|---------|------|------|------|
| `guidance-surface-inventory-v3-08-00.json` | 五角色标注后的完整 surface 清单 | 11,844 | 374KB |
| `b1-migration-report.md` | 本报告 | 274 | ~20KB |

### 5.2 基线文件完整性验证

**验证命令**: `git diff guidance-surface-inventory-v2.json`

**预期结果**: 为空（02-00 基线未被修改）

**实际结果**: ✅ 为空（02-00 基线完整保留，未被修改）

## 6. 迁移质量评估

### 6.1 覆盖率
- **surface 覆盖**: 346/346（100%）
- **自然语言覆盖**: 346/346（100%，所有 surface 均含自然语言）
- **角色归属**: 1034/1034（100%，所有片段均有明确角色）

### 6.2 语义等价率
- **典型案例验证**: 3/3（100%）
- **抽查验证**: 5/5（100%）
- **自动化规则一致性**: ✓（所有迁移遵循统一规则）

### 6.3 可追溯性
- **text_legacy 保留**: 346/346（100%）
- **diff 可逆**: 346/346 全量验证（100%）
- **验证脚本**: `scripts/validate-b1-invertibility.mts`
- **baseline 完整性**: ✅ 已验证（`git diff guidance-surface-inventory-v2.json` 为空）

## 7. 已知限制与改进方向

### 7.1 当前迁移策略

**启发式规则**：基于关键词（建议、必须、何时用等）和标点符号（→、：）识别角色。

**优点**：
- 快速、自动化
- 规则清晰、可追溯
- 适用于 346 个 surfaces 的大规模迁移

**限制与已修复问题**：
- **已修复**：初次迁移时 167/346 个 surface 的 text_v1 片段内容不完整，已通过添加 separator 字段修复，实现 346/346 逐字节可逆
- **已修复**：77 个 surface 存在真实内容丢失（行尾标点、换行等），已从 text_legacy 重建完整内容
- **已知限制（消费契约）**：209/1034 片段（20.2%）在行尾标点/右引号处截断，截断字符存于 separator 中（如 `content="spec: '01-00-task-create-many"` + `sep="'\n"`）。**消费契约要求**：text_v1 片段只能以 `content + (separator || '')` 拼接消费，禁止单独使用 `fragment.content` —— 单独使用会导致语义不完整。切分是按字符位置而非语义边界。
- 可能存在误判（如"建议"出现在 FACT 描述中）
- 无法识别隐含的决策边界或约束
- 依赖句子边界分割，可能切分不够精细

### 7.2 改进方向（B2/B3 阶段）

1. **人工复审**：对高优先级 surfaces（如 server_instructions、关键工具的 description）进行人工复审，调整角色标注
2. **细化规则**：根据复审结果优化关键词规则和边界识别逻辑
3. **语义验证**：引入 LLM 辅助验证语义等价性（作为 B1 人工复审的辅助工具）
4. **回归测试**：在 B2a/B2b 阶段，对比 B1 基线，验证角色标注是否改善模型理解

## 8. content_hash 口径说明

B1 证据包含两个 content_hash 字段：

### 8.1 content_hash（新口径）
- **定义**：`text_v1` 五角色结构数组的 JSON 序列化 sha256
- **用途**：捕获角色标注变化（五角色 vs 无角色）
- **B1 结果**：12/12 与 B0-s 不同（因为 B0-s 用摘录文本 hash，口径不同）

### 8.2 content_hash_legacy（B0-s 兼容口径）
- **定义**：摘录文本（`fixture.aiGuidance.text`）的 sha256，与 B0-s `content_hash` 口径一致
- **用途**：单变量对照 —— 证明摘录文本未动，只有角色标注这一个变量在变
- **B1 结果**：12/12 与 B0-s 完全一致（证明 02-00→08-00 迁移未改摘录文本）

### 8.3 单变量原则（D-04）
同口径对照（`content_hash_legacy`）证明摘录文本层未改动，符合 F-06 语义等价要求。
`content_hash` 的变化是**口径变更**（摘录文本 → text_v1 JSON），不是文本迁移的结果。

**验证结果**（E-01 示例）：
- B0-s content_hash: `71d1a6be9d5d926e...`
- B1 content_hash_legacy: `71d1a6be9d5d926e...` ✓（一致）
- B1 content_hash: `e8d4bd509f511469...`（口径变更，预期不同）

全量验证：12/12 个 E-xx 场景的 `content_hash_legacy` 与 B0-s `content_hash` 完全一致。

## 9. 下一步行动

### 8.1 阶段 5 收尾（本次执行）
- [x] 统计 v3 JSON 行数和大小：11,844 行，374KB
- [x] 执行 `git diff guidance-surface-inventory-v2.json` 验证基线完整性：✅ 为空
- [x] 执行 `git rev-parse HEAD` 记录实际 SHA：45a86e15c896c446a41e48324e646d32c27fb76a
- [x] 更新 v3 JSON 的 git_sha 字段：✅ 已更新
- [x] 删除临时进度文件：✅ 已删除
- [x] 提交本报告给主 agent 复审：✅ 本报告已完成

**2026-09-01 修复（可逆性缺陷）**：
- [x] 修复 167/346 个 surface 的 text_v1 内容不完整问题
- [x] 为所有 text_v1 片段添加 separator 字段
- [x] 全量验证 346/346 逐字节可逆性
- [x] 创建验证脚本：`scripts/validate-b1-invertibility.mts`
- [x] 修正报告虚假声明（F-06、F-08）

### 8.2 后续阶段（主 agent 决策）
- [ ] B1 人工复审：主 agent 或用户复审高优先级 surfaces
- [ ] B1 调整：根据复审结果调整角色标注
- [ ] B2a structuredContent 引入：基于 B1 基线
- [ ] B2b ModelVisibleContract 切换：基于 B2a 基线
- [ ] B3 Guidance Profile v1：基于 B2b 基线

---

**报告生成时间**: 2026-09-01  
**报告版本**: v1.1（2026-09-01 修复可逆性缺陷）  
**执行 Agent**: B1 Migration Subagent  
**修复 Agent**: B1 Invertibility Fix Subagent
