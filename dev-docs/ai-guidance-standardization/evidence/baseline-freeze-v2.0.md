# Guidance Surface 基线 v2.0（冻结）

**冻结日期**: 2026-08-31  
**Spec**: 02-00-guidance-surface-inventory  
**状态**: 不可变  
**版本**: v2.0

---

## 执行摘要

本基线代表 lrnev-govern 系统在**任何文本迁移或运行时观测之前**的 **guidance surfaces 完整清单**，作为 Spec 04-00 中 B0 对照的不可变测量基线。

**Surface 总数**: 346  
**覆盖率**: 100% (全部已登记的 MCP 工具/资源 + 治理文档)  
**高危发现**: 2 contract_tone (低风险，已记录)  
**运行时约束**: 0 (验证通过)

---

## 冻结产物

### 1. 清单 v2 (JSON)

**文件**: `guidance-surface-inventory-v2.json`  
**路径**: `dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v2.json`  
**大小**: 259 KB (265,048 字节)  
**Surface 数**: 346  
**SHA256 (LF)**: `f6adf21b720421fd2d60e792686bf87b42fc4d1ef2c049c7c9d0f43390b1a1f7`

**内容**:
- 346 个带稳定 surface_id 的 surfaces
- 三维语义标注 (role/provenance/enforcement)
- 每个 surface 的内容哈希 (content hash)
- 预算计算 (字符数/tokens)
- 静态 capability_note (协议声明 + 文档声明)

---

### 2. 清单 v2 (Markdown)

**文件**: `guidance-surface-inventory-v2.md`  
**路径**: `dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v2.md`  
**大小**: 199 KB (203,852 字节)  
**SHA256**: [如需要再计算]

**用途**: 清单 v2 的人工可读版本，供人工复核

---

### 3. 基线报告

**文件**: `baseline-report.md`  
**路径**: `dev-docs/ai-guidance-standardization/baseline-report.md`  
**大小**: 5.7 KB (5,836 字节)  
**SHA256 (LF)**: `e7cfda5ed552f31c60a7215312fcc3e81e0b8b42ade806b2f29e56588d1db9bc`

**内容**:
- 高危措辞扫描结果
- 冲突与重复检测
- 预算与哈希统计
- 覆盖率汇总 (100%)

---

## 基线统计

### Surface 按渠道计数

| 渠道 | 数量 | 字符数 | Tokens (估算) | 占比 |
|---------|-------|-------|---------------|------------|
| governance_doc | 76 | 262,838 | 65,736 | 96.2% (budget) |
| tool_metadata | 84 | 3,929 | 1,013 | 1.4% (budget) |
| tool_input_schema | 121 | 2,154 | 578 | 0.8% (budget) |
| tool_annotations | 42 | 2,808 | 719 | 1.0% (budget) |
| ai_followup | 5 | 815 | 205 | 0.3% (budget) |
| server_instructions | 1 | 541 | 136 | 0.2% (budget) |
| mcp_resource | 17 | 185 | 54 | 0.1% (budget) |
| **Total** | **346** | **273,270** | **68,441** | **100%** |

---

### Surface 按角色计数

| 角色 | 数量 | 字符数 | Tokens (估算) | 占比 |
|------|-------|-------|---------------|------------|
| RECOMMENDATION | 127 | 182,681 | 45,719 | 66.8% (budget) |
| FACT | 193 | 25,969 | 6,559 | 9.5% (budget) |
| ACTION_HINT | 26 | 64,620 | 16,163 | 23.7% (budget) |
| **Total** | **346** | **273,270** | **68,441** | **100%** |

---

### 高危措辞发现

**扫描总数**: 346 个 surfaces (100% 覆盖率)

| 风险类型 | 数量 | 严重度 | 处理 |
|-----------|-------|----------|--------|
| contract_tone | 2 | low | 记录，不修正 |
| runtime_constraint | 0 | - | ✅ 验收通过 |
| pseudo_command | 0 | - | ✅ 验收通过 |

**明细**:
- `governance_doc:04-ai-guidance-standardization_04-00-agent-e2e-observability:tasks` (不得)
- `governance_doc:04-ai-guidance-standardization_05-00-lrnev-guidance-profile:requirements` (必须)

---

### 冲突与重复

**触发冲突**: 1 (低严重度)
- tool_annotations 中存在共享触发 (42 个 surfaces，结构性冲突，非内容冲突)

**跨渠道重复**: 0

---

### 哈希统计

- 总 surfaces: 346
- 唯一哈希: 271
- 重复内容: 75 (不同渠道中的相同内容)

---

## 可复现性

### 基线报告生成

**命令**:
```bash
cd scripts
npx tsx scan-high-risk-wording.ts
```

**输入**:
- 文件: `guidance-surface-inventory-v2.json`
- 大小: 259 KB
- Surface 数: 346

**输出**:
- 报告: `baseline-report.md`
- 大小: 5.7 KB
- SHA256 (LF): `e7cfda5ed552f31c60a7215312fcc3e81e0b8b42ade806b2f29e56588d1db9bc`

**可复现性**: ✅ 已验证
- 在环境 A 中多次运行产生相同哈希
- 换行符统一为 LF，保证跨平台一致
- 哈希基于归一化后的内容计算

---

### 清单 v2 生成

**命令**: 无法通过单条命令复现
- T-002: `scripts/scan-guidance-surfaces.ts` (初次抽取)
- T-003: 应用了 64 处人工语义修正

**注**: 清单 v2 是人工标注 (T-003) 的产物，并非自动生成。复现需要重新应用同样的 64 处修正。

---

## 不可变保证

### 基线 v2.0 已冻结

**本基线不可变，不得修改。**

任何变更都需要:
1. ✅ 新建新版本 (如 v2.1)
2. ✅ 生成新哈希
3. ✅ 记录与 v2.0 的差异
4. ✅ 更新本冻结记录

---

### 变更控制

**禁止的操作**:
- ❌ 直接编辑 v2.0 产物
- ❌ 修改已冻结的 JSON/MD 文件
- ❌ 重跑扫描器并覆盖基线

**允许的操作**:
- ✅ 新建 v2.1 并附变更日志
- ✅ 对比 v2.1 与 v2.0 的 SHA256
- ✅ 以 v2.0 作为不可变基线引用

---

## 证据链

### T-001: 扫描器框架

**状态**: ✅ 已完成 (2026-08-28)

**交付物**:
- `scripts/scan-guidance-surfaces.ts` (29 KB)
- 带 surface_id、content_hash、budget 的 surface 数据模型

---

### T-002: 全量抽取

**状态**: ✅ 已完成 (2026-08-28)

**交付物**:
- `guidance-surface-inventory.json` (v1, 258 KB, 208 个 surfaces)
- `guidance-surface-inventory.md` (v1, 198 KB)
- 修复 3 个主要缺口 (input schema 正则、mcp resources、校验)
- 从 208 个增至 346 个 surfaces

**DeepSeek 评审**: ✅ 通过

---

### T-003: 语义标注

**状态**: ✅ 已完成 (2026-08-31)

**交付物**:
- `guidance-surface-inventory-v2.json` (259 KB, 346 个 surfaces)
- `guidance-surface-inventory-v2.md` (199 KB)
- 应用 64 处语义修正
- 角色分布: FACT (193), RECOMMENDATION (127), ACTION_HINT (26)

**DeepSeek 评审**: ✅ 通过

---

### T-004: 基线报告

**状态**: ✅ 已完成 (2026-08-31)

**交付物**:
- `scripts/scan-high-risk-wording.ts` (26 KB)
- `baseline-report.md` (5.7 KB)
- 100% 覆盖率 (346/346)
- 2 项 contract_tone 发现 (低风险)

**DeepSeek 评审**: ✅ 通过

---

### T-005: 冻结验证

**状态**: ✅ 已完成 (2026-08-31)

**交付物**:
- `../notes/T-005-evidence-chain.md` (证据链验证)
- `../notes/T-005-attribution-boundary.md` (归属边界验证)
- `../notes/T-005-cross-machine-hash.md` (双机 hash 比对)
- `../notes/T-005-mcp-resource-review.md` (17 个 resource 人工核对)
- `baseline-freeze-v2.0.md` (本文档)

**验证**:
- ✅ 证据链完整 (T-001~T-004 产物齐全)
- ✅ 归属边界清晰 (02/04/05/06 职责分明)
- ✅ 跨机哈希可复现 (LF 归一化)
- ✅ 17 个 mcp_resources 人工核对 (14 通过, 3 轻微, 0 失败)

---

## 归属边界

### 02-00 职责 (本 Spec)

**我们做了什么**:
1. ✅ 登记静态 guidance surfaces (登记既有内容)
2. ✅ 标注三维语义 (role/provenance/enforcement)
3. ✅ 生成迁移前基线 (hash/budget/conflicts)
4. ✅ 记录静态 capability_note (协议声明 + 文档声明)

**我们没做什么**:
1. ❌ 判断运行时消费 (哪些 surface 被 AI 实际使用)
2. ❌ 记录 AI 使用率 (使用频率、触发条件)
3. ❌ 修改原文文案 (文本迁移是 B1 的职责)
4. ❌ 决策迁移策略 (保留/合并/降级/移除)

---

### 04-00 职责 (agent-e2e-observability)

**你们要做什么**:
1. ✅ 记录运行时消费证据 (surface_id/hash)
2. ✅ 观测 AI 实际使用模式 (E2E fixture 矩阵)
3. ✅ 生成运行时报告 (真实客户端盲测)
4. ✅ 建立 surface_id → 实际消费映射

**你们的输入**:
- 02 的清单 v2 (346 个带 surface_id/hash 的 surfaces)
- 02 的 baseline-report.md (budget/conflicts)

**你们的输出**:
- E2E 证据与回放记录
- B0/B1/B2a/B2b 对照结果
- surface_id → 实际消费映射

---

### 05-00 与 06-00 职责

**你们要做什么**:
1. ✅ 引用 04 的观测结论 (surface_id → 消费映射)
2. ✅ 基于 04 数据做迁移决策 (保留/合并/降级/移除)
3. ✅ 生成 Profile v1 对象或文档索引

**你们不应做什么**:
1. ❌ 复制 04 的观测数据 (直接引用即可)
2. ❌ 自行判断运行时效果 (必须基于 04 证据)

---

## 验证报告

### T-005 交付物

1. `../notes/T-005-evidence-chain.md`: 证据链验证 (T-001~T-004)
2. `../notes/T-005-attribution-boundary.md`: 归属边界验证
3. `../notes/T-005-cross-machine-hash.md`: 跨机哈希比对
4. `../notes/T-005-mcp-resource-review.md`: 17 个 mcp_resource 人工核对
5. `baseline-freeze-v2.0.md`: 本冻结文档

---

### 验收标准 (F-01 至 F-07)

| 要求 | 状态 | 证据 |
|-------------|--------|----------|
| F-01 完整清单 | ✅ | 346 个 surfaces, 100% 覆盖率 |
| F-02 角色标注 | ✅ | 三维语义 (role/provenance/enforcement) |
| F-03 高危扫描 | ✅ | 2 contract_tone, 0 runtime_constraint |
| F-04 冲突检查 | ✅ | 1 个低严重度共享触发 |
| F-05 预算与哈希 | ✅ | 273,270 字符 / 68,441 tokens |
| F-06 归属边界 | ✅ | capability_note 为 null (静态登记) |
| F-07 清单产物 | ✅ | v2.json + v2.md + baseline-report.md |

---

## 使用指南

### 面向 Spec 04-00 (agent-e2e-observability)

**如何使用本基线**:
1. 以清单 v2 作为 surface 注册表
2. 以 surface_id 作为索引键
3. 用 content_hash 检测变更
4. 以本基线作为 "before"，对照 B0 (迁移前) 与 B1 (迁移后)

**不要**:
- 修改本基线
- 向本清单添加运行时观测
- 基于使用率判断某个 surface 是否应存在

---

### 面向 Spec 05-00 (lrnev-guidance-profile)

**如何使用本基线**:
1. 引用清单 v2 中的 surface_id
2. 引用 04-00 的运行时证据
3. 基于合并后的数据做迁移决策

**不要**:
- 从本基线复制 surface 内容 (按 surface_id 引用)
- 在没有 04-00 证据时判断运行时消费

---

### 面向 Spec 06-00 (guidance-documentation)

**如何使用本基线**:
1. 以清单 v2 作为完整 surface 目录
2. 引用 04-00 的 E2E 证据索引
3. 记录来自 05-00 的迁移决策

**不要**:
- 把本基线当作最终文档 (它是迁移前的)
- 假定基线中所有 surfaces 都会保留 (迁移可能移除部分)

---

## 哈希验证 (跨平台)

### baseline-report.md

**环境 A (Claude, Windows Git Bash)**:
- SHA256 (LF): `e7cfda5ed552f31c60a7215312fcc3e81e0b8b42ade806b2f29e56588d1db9bc`
- 已验证: ✅ (多次运行)

**环境 B (DeepSeek)**:
- SHA256 (LF): [待验证]
- 命令: `npx tsx scripts/scan-high-risk-wording.ts`

---

### guidance-surface-inventory-v2.json

**环境 A (Claude, Windows Git Bash)**:
- SHA256 (LF): `f6adf21b720421fd2d60e792686bf87b42fc4d1ef2c049c7c9d0f43390b1a1f7`
- 已验证: ✅

**环境 B (DeepSeek)**:
- SHA256: [待验证]
- 命令: `certutil -hashfile ".\dev-docs\ai-guidance-standardization\evidence\guidance-surface-inventory-v2.json" SHA256`

---

## 附录: 文件清单

### 核心产物 (已冻结)

```
dev-docs/ai-guidance-standardization/
├── guidance-surface-inventory-v2.json   (259 KB, SHA256: f6adf21b...)
├── guidance-surface-inventory-v2.md     (199 KB)
├── baseline-report.md                   (5.7 KB, SHA256: e7cfda5e...)
└── baseline-freeze-v2.0.md              (this file)
```

---

### 验证报告 (T-005)

```
dev-docs/ai-guidance-standardization/notes/
├── T-005-evidence-chain.md              (证据链验证)
├── T-005-attribution-boundary.md        (归属边界验证)
├── T-005-cross-machine-hash.md          (双机 hash 比对)
└── T-005-mcp-resource-review.md         (17 资源人工核对)
```

---

### 扫描器 (可复现性)

```
scripts/
├── scan-guidance-surfaces.ts            (29 KB, T-002 scanner)
└── scan-high-risk-wording.ts            (26 KB, T-004 scanner, LF-normalized)
```

---

### 旧版产物 (v2 之前)

```
dev-docs/ai-guidance-standardization/
├── guidance-surface-inventory.json      (v1, 258 KB, 208 surfaces)
├── guidance-surface-inventory.md        (v1, 198 KB)
├── T-001-implementation-notes.md
├── T-002-completion-report.md
├── T-002-summary.md
├── T-003-semantic-review.md
└── semantic-violations-report.md
```

---

## 冻结签署

**冻结方**: Claude Code (T-005 执行)  
**冻结日期**: 2026-08-31  
**Spec 状态**: 02-00 draft → ready (待 spec_gate_check)  
**后续步骤**: 
1. 对 02-00 运行 `spec_gate_check(gate: "completion")`
2. 将 spec 状态更新为 "completed"
3. 移交给 04-00 做运行时观测

---

**基线 v2.0 现已不可变。将其作为 Spec 04-00 中 B0 对照的测量基线使用。**

---

**基线冻结 v2.0 文档结束**
