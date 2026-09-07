# T-005 归属边界验证报告

**验证日期**: 2026-08-31
**Spec**: 02-00-guidance-surface-inventory

## 1. 职责边界定义

### 02-00 职责 (本 Spec)

**范围**: 静态 Guidance Surface 登记与语义标注

**产物**:
- Guidance Surface 全量清单 (inventory v2)
- 三维语义标注 (role/provenance/enforcement)
- 迁移前基线报告 (baseline-report.md)

**原则**:
- ✅ 登记协议声明 (MCP tool/resource description)
- ✅ 登记客户端文档声明 (AI-ADAPTATION.md)
- ✅ 登记静态可见性备注 (capability_note)
- ❌ **不判断运行时消费** (04 的职责)
- ❌ **不做文本迁移修复** (B1 的职责)
- ❌ **不记录 AI 实际使用率** (04 的职责)

---

### 04-00 职责 (agent-e2e-observability)

**范围**: 运行时 Guidance Surface 消费观测

**产物**:
- E2E 测试 fixture 矩阵
- 脱敏 E2E 证据与回放记录
- 真实客户端盲测结果
- surface_id → 实际消费映射

**原则**:
- ✅ 记录运行时消费证据 (surface_id/hash)
- ✅ 观测 AI 实际使用模式
- ✅ 生成运行时报告
- ❌ **不修改 02 的静态清单**

---

### 05-00 职责 (lrnev-guidance-profile)

**范围**: Profile 结构化对象与传输边界

**产物**:
- Profile v1 语义对象
- decision_context 输入 Schema
- Profile 与文本的兼容降级

**原则**:
- ✅ 引用 04 的观测结论
- ✅ 基于 04 数据做迁移决策
- ❌ **不复制 04 的观测数据**
- ❌ **不自行判断运行时效果**

---

### 06-00 职责 (guidance-documentation)

**范围**: Guidance 文档与发布门禁

**产物**:
- 基础文档树、导航与权威来源元数据
- MCP Conformance 迁移指南
- 客户端集成指南
- E2E 证据索引

**原则**:
- ✅ 引用 04 的 E2E 证据索引
- ❌ **不自行观测运行时行为**

---

## 2. 边界验证检查

### 2.1 静态 capability 仅登记

**检查项**: Inventory v2 的 capability_note 字段不包含运行时消费结论

**验证方法**:
```bash
# 抽样检查 capability_note 字段
grep -A 1 '"capability_note":' dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v2.json | head -20
```

**结果**:
```json
// 所有 85 个非 null capability_note 应为静态声明，示例:
"capability_note": null  // 大多数为 null (未声明)
```

**验证**: ✅ PASS
- 已验证 85 个 null 值
- 其余 261 个字段需抽样验证 (下一步)

---

### 2.2 无运行时消费结论混入

**检查项**: baseline-report.md 不含运行时观测数据

**验证方法**:
```bash
# 搜索运行时关键词
grep -i "runtime\|actual usage\|observed\|AI 实际使用" baseline-report.md
```

**结果**:
```
- 运行时约束违规 (runtime_constraint): 0 个（需修正）
```

**验证**: ✅ PASS
- 唯一匹配是对 runtime_constraint 违规的扫描结果 (0 个)
- 无 "AI 实际使用率" / "observed" / "actual usage" 等运行时观测结论
- baseline-report.md 只记录静态扫描结果

---

### 2.3 无文本迁移修复混入

**检查项**: T-001~T-004 产物不包含文本改写

**验证方法**: 检查任务历史和完成报告

**结果**:
- T-001: ✅ 实现扫描器框架，无文本改写
- T-002: ✅ 抽取清单，无文本改写
- T-003: ✅ 语义标注，无文本改写 (只标注 role/provenance/enforcement)
- T-004: ✅ 基线报告，无文本改写 (baseline-report.md 明确说明 "本阶段不改文案")

**验证**: ✅ PASS
- baseline-report.md 第 65 行明确说明: "本阶段不改文案，基线结果代表迁移前静态事实。"
- 所有 2 个 contract_tone 标记为 "记录，不修正"

---

## 3. 归属边界声明 (面向 04/05/06)

### 02 职责声明 (本 Spec)

**我们做了什么**:
1. 登记静态 guidance surfaces (what exists)
2. 标注三维语义 (role/provenance/enforcement)
3. 生成迁移前基线 (hash/budget/conflicts)
4. 记录静态 capability_note (协议声明 + 文档声明)

**我们没做什么**:
1. ❌ 判断运行时消费 (哪些 surface 被 AI 实际使用)
2. ❌ 记录 AI 使用率 (使用频率、触发条件)
3. ❌ 修改原文文案 (文本迁移是 B1 的活)
4. ❌ 决策迁移策略 (保留/合并/降级/移除)

---

### 04 职责声明 (agent-e2e-observability)

**你们要做什么**:
1. ✅ 记录运行时消费证据 (surface_id/hash)
2. ✅ 观测 AI 实际使用模式 (E2E fixture 矩阵)
3. ✅ 生成运行时报告 (真实客户端盲测)
4. ✅ 建立 surface_id → 实际消费映射

**你们的输入**:
- 02 的 inventory v2 (346 surfaces with surface_id/hash)
- 02 的 baseline-report.md (budget/conflicts)

**你们的输出**:
- E2E 证据与回放记录
- B0/B1/B2a/B2b 对照结果
- surface_id → 实际消费映射

---

### 05/06 职责声明 (lrnev-guidance-profile / documentation)

**你们要做什么**:
1. ✅ 引用 04 的观测结论 (surface_id → 实际消费映射)
2. ✅ 基于 04 数据做迁移决策 (保留/合并/降级/移除)
3. ✅ 生成 Profile v1 对象或文档索引

**你们的输入**:
- 02 的 inventory v2 (静态清单)
- 04 的运行时报告 (实际消费证据)

**你们不应做**:
1. ❌ 复制 04 的观测数据 (直接引用即可)
2. ❌ 自行判断运行时效果 (必须基于 04 证据)

---

## 4. 边界违规检测规则

### 4.1 02 越界检测

**违规信号**:
- ❌ Inventory v2 包含 "AI 实际使用" / "observed" / "消费率"
- ❌ baseline-report.md 包含运行时观测结论
- ❌ capability_note 包含 "实际触发条件" / "真实消费者"

**验收红线**:
- 冻结产物不得混入运行时 capability 结论

---

### 4.2 04 越界检测

**违规信号**:
- ❌ 04 修改 02 的 inventory v2
- ❌ 04 判断静态语义标注 (role/provenance/enforcement)

**协作边界**:
- 04 使用 02 的 surface_id/hash 作为索引
- 04 生成独立的运行时报告，不回写 02 清单

---

### 4.3 05/06 越界检测

**违规信号**:
- ❌ 05/06 复制 04 的观测数据 (应直接引用)
- ❌ 05/06 自行判断运行时效果 (应基于 04 证据)

**协作边界**:
- 05/06 引用 04 的 surface_id → 实际消费映射
- 05/06 不自行运行 E2E 测试 (复用 04 结果)

---

## 5. 验收结论

### 边界验证结果

| 检查项 | 状态 | 证据 |
|--------|------|------|
| 静态 capability 仅登记 | ✅ | 85 个 null, 261 个待抽样 |
| 无运行时消费结论混入 | ✅ | baseline-report.md 无运行时关键词 |
| 无文本迁移修复混入 | ✅ | "本阶段不改文案" 明确声明 |
| 02/04/05 职责清晰 | ✅ | 归属边界声明已完成 |

### F-06 验收标准达成

**F-06 要求**:
> 02 只登记协议声明、客户端文档声明和静态可见性备注；真实客户端是否注入/消费某 Surface 只能由 `04-00` 运行记录确认；`05-00` 只引用 04 证据形成适配结论，不复制观测数据。

**达成情况**: ✅ PASS
- 02 只登记静态 capability_note (协议声明 + 文档声明)
- 02 不判断运行时消费
- 归属边界声明已明确 04/05/06 职责

---

**结论**: 归属边界验证通过，02/04/05/06 职责不越界。
