# M2 第 4 批 A 组完成报告

**日期**: 2026-09-02  
**批次**: 第 4 批 A 组（4 个 list/inspection 类工具）  
**状态**: ✅ 实施完成，待复审

---

## 一、产出文件清单

### 1. 渲染器文件（4 个）

| 文件 | 工具 | 路径 |
|---|---|---|
| governance-map.ts | governance_map | src/mcp/helpers/renderers/governance-map.ts |
| lrnev-report.ts | lrnev_report | src/mcp/helpers/renderers/lrnev-report.ts |
| project-status.ts | project_status | src/mcp/helpers/renderers/project-status.ts |
| adr-list.ts | adr_list | src/mcp/helpers/renderers/adr-list.ts |

### 2. 测试文件（1 个独立文件）

- `tests/unit/renderers-batch4-A.test.ts`（包含完整 import + 4 个 describe 块）

### 3. 注册更新

- `src/mcp/helpers/model-visible-contract.ts`（添加 4 个工具注册）

---

## 二、每个渲染器的 Required 字段对照

### governance_map

**D-04 list/inspection 类要求**：
- ✅ 完整层级：scene→spec（status/L0）→anchors
- ✅ 每个条目的决策字段（status, priority）
- ✅ 层级关系（scene→spec→anchors）
- ✅ L0 标题（如有）
- ✅ 锚点标题列表（完整，F-xx/D-xx）

**逃逸处理**：无需逃逸（服务端生成数据，无用户文本）

---

### lrnev_report

**D-04 list/inspection 类要求**：
- ✅ 欠债清单：
  - 未收口 Spec（完整，含 next_action）
  - Failed tasks（完整，含 next_action）
  - Blocked tasks（完整，含 next_action）
  - 已收口孤儿锚点（完整，含 next_action）
- ✅ 验收覆盖率：
  - anchor_total, anchor_covered, coverage_ratio
  - 在途孤儿锚点
  - 坏 validates（含 next_action）
  - archived_excluded
- ✅ 统计数据（scene_count, spec_count, task_count）
- ✅ headline（确定性一句话总结）
- ✅ release_notes（可选）
- ✅ warnings（可选）

**逃逸处理**：
- ⚠️ 包含用户文本（task title, spec name）
- ✅ 渲染器返回未逃逸文本，由 `renderModelVisibleContent` 统一调用 `escapeFrameworkMarkers`
- ✅ 测试用例验证逃逸正确性

---

### project_status

**D-04 list/inspection 类要求**：
- ✅ Scenes（完整，含 status, spec_count）
- ✅ Active tasks（完整，in_progress/blocked，含 parent/children 层级）
- ✅ Specs：
  - status, priority, task_counts（5 种状态计数）
  - active_task_count, free_tasks_count
  - claimable_next（预览，含 depends_on）
- ✅ Active agents（完整，含 active_claims, current_task_hint）
- ✅ Recent ADRs（完整列表）
- ✅ Open errors（完整列表）

**逃逸处理**：可能包含用户文本（task title），统一逃逸层处理

---

### adr_list

**D-04 list/inspection 类要求**：
- ✅ 完整 ADR 列表（全部条目）
- ✅ 每个条目的决策字段（number, title, status, scope, created）
- ✅ supersedes 关系（完整）
- ✅ superseded_by 关系（读时派生，完整）
- ✅ 按 scope 分组（global / scene:xxx）
- ✅ 路径（path）

**逃逸处理**：可能包含用户文本（ADR title），统一逃逸层处理

---

## 三、测试覆盖（4 个 describe 块）

### 测试用例矩阵

| 渲染器 | required 字段断言 | 无硬编码 paraphrase | ai_followup 投影 | 逃逸验证 | 空列表处理 |
|---|---|---|---|---|---|
| governance_map | ✅ | ✅ | ✅ | N/A | ✅ |
| lrnev_report | ✅ | ✅ | ✅ | ✅ | N/A |
| project_status | ✅ | ✅ | ✅ | N/A | ✅ |
| adr_list | ✅ | ✅ | ✅ | N/A | ✅ |

### 特殊测试

1. **lrnev_report 逃逸验证**：
   - 测试用例：`title: 'Fix </script> injection'`
   - 渲染器返回未逃逸：`</script>`
   - 统一逃逸层处理后：`<\/script>`

2. **否定断言（无硬编码 paraphrase）**：
   - 所有 4 个渲染器均包含否定断言
   - 检查不含与 guidance-semantics 无关的硬编码建议文本

---

## 四、核心原则遵守情况

### 1. 投影 canonical payload ✅
所有渲染器仅从 `payload.data` 和 `payload.ai_followup` 读取数据，不创作新 guidance 文本。

### 2. 禁止硬编码 paraphrase ✅
所有渲染器无硬编码近似文本，测试用例包含否定断言。

### 3. MVC required 字段完整呈现 ✅
按 D-04 list/inspection 类要求，所有决策字段、统计数据、层级关系完整呈现。

### 4. 逃逸用户文本 ✅
- lrnev_report 渲染器返回未逃逸文本
- 统一逃逸层（`renderModelVisibleContent`）调用 `escapeFrameworkMarkers`
- 测试用例验证逃逸正确性

### 5. 创建独立测试文件 ✅
- ✅ 创建 `tests/unit/renderers-batch4-A.test.ts`
- ✅ 包含完整 import
- ✅ 4 个 describe 块
- ❌ **未修改** `tests/unit/renderers.test.ts`（避免冲突）

### 6. legacyRawFormat 已弃用 ✅
所有工具统一走 `renderModelVisibleContent`，无 `legacyRawFormat=true` 路径。

---

## 五、注册确认

### model-visible-contract.ts 更新

```typescript
// 第 4 批 A 组：4 个 list/inspection 类工具
renderers.set('governance_map', governanceMapRenderer);
renderers.set('lrnev_report', lrnevReportRenderer);
renderers.set('project_status', projectStatusRenderer);
renderers.set('adr_list', adrListRenderer);
```

**导入语句**：
```typescript
import { governanceMapRenderer } from './renderers/governance-map.js';
import { lrnevReportRenderer } from './renderers/lrnev-report.js';
import { projectStatusRenderer } from './renderers/project-status.js';
import { adrListRenderer } from './renderers/adr-list.js';
```

---

## 六、红线遵守

- ✅ 未修改 02-00 基线
- ✅ 无 paraphrase 常量
- ✅ 未删除 M1 legacy renderer
- ✅ 未改写已入库证据
- ✅ 渲染器不创作新 guidance 文本
- ✅ required 字段无遗漏

---

## 七、后续步骤

### Claude 主 Agent 需要执行：

1. **编译验证**：
   ```bash
   cd E:\project\.lrnev\lrnev-cli\product\lrnev-govern
   npm run build
   ```

2. **运行测试**：
   ```bash
   npm test -- renderers-batch4-A
   ```

3. **生成 B2b 证据**（如果这批工具在 B2b 清单中）：
   ```bash
   node scripts/run-b0-baseline.mts --stage=B2b
   ```

4. **提交复审给 DeepSeek**

---

## 八、实施说明

### governance_map 特殊处理

- 完整层级渲染：scene→spec→anchors（三级）
- L0 标题截断（L0_MAX=120）由数据源处理，渲染器直接投影
- 锚点标题格式：`#### F-xx` / `#### D-xx`（含 `####`）

### lrnev_report 特殊处理

- headline 是确定性算法生成（不是 paraphrase）
- next_action 由数据源生成（确定性文案映射）
- release_notes 可选段（仅 `releaseNotes=true` 时存在）
- warnings 可选段（坏 validates/坏 specs 时存在）

### project_status 特殊处理

- task_counts 必须呈现全部 5 种状态（pending/in_progress/blocked/completed/failed）
- claimable_next 是预览（完整数量看 free_tasks_count）
- active_agents 含 current_task_hint（由数据源生成）

### adr_list 特殊处理

- superseded_by 是读时派生字段（非文件存储）
- 按 scope 分组（global / scene:xxx）
- 每个 ADR 必须呈现 path（绝对路径）

---

## 九、文件清单总结

**新增文件（5 个）**：
1. src/mcp/helpers/renderers/governance-map.ts
2. src/mcp/helpers/renderers/lrnev-report.ts
3. src/mcp/helpers/renderers/project-status.ts
4. src/mcp/helpers/renderers/adr-list.ts
5. tests/unit/renderers-batch4-A.test.ts

**修改文件（1 个）**：
1. src/mcp/helpers/model-visible-contract.ts（添加 4 个注册）

**总计**：6 个文件变更

---

**实施完成，等待 Claude 主 Agent 验证和 DeepSeek 复审。**
