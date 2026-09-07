# Surface Baseline Report (Pre-Migration)

**Baseline Date**: 2026-08-31
**Inventory Version**: v2
**Total Surfaces**: 346
**Spec**: 02-00-guidance-surface-inventory

## 1. High-Risk Wording Findings

### 1.1 Governance Doc Force Language

**Total Scanned**: 76 surfaces

| Surface ID | Pattern | Risk Type | Severity | Recommendation |
|------------|---------|-----------|----------|----------------|
| governance_doc:04-ai-guidance-standardization_04-00-agent-e2e-observability:tasks | 不得 | contract_tone | low | 记录，不修正（契约措辞） |
| governance_doc:04-ai-guidance-standardization_05-00-lrnev-guidance-profile:requirements | 必须 | contract_tone | low | 记录，不修正（契约措辞） |

**Summary**:
- 契约措辞 (contract_tone): 2 个（记录，不修正）
- 运行时约束违规 (runtime_constraint): 0 个（需修正）
- 伪命令 (pseudo_command): 0 个（需删除或改为 ACTION_HINT）

### 1.2 Input Schema Consistency

**Total Scanned**: 121 surfaces

✅ No schema-description mismatches detected.

### 1.3 Tool Annotations Overpromise

**Total Scanned**: 42 surfaces

✅ No annotation overpromise detected.

### 1.4 MCP Resource Descriptions (Manual Review)

**Total Scanned**: 17 surfaces

⚠️ These require manual verification:

- mcp_resource:definition:project (src/mcp/resources/index.ts)
- mcp_resource:definition:project_architecture (src/mcp/resources/index.ts)
- mcp_resource:definition:auto_codebase (src/mcp/resources/index.ts)
- mcp_resource:definition:steering_core (src/mcp/resources/index.ts)
- mcp_resource:definition:steering_scope (src/mcp/resources/index.ts)
- mcp_resource:definition:steering_adr (src/mcp/resources/index.ts)
- mcp_resource:definition:steering_memory (src/mcp/resources/index.ts)
- mcp_resource:definition:scene_list (src/mcp/resources/index.ts)
- mcp_resource:definition:adr_list (src/mcp/resources/index.ts)
- mcp_resource:definition:scene (src/mcp/resources/index.ts)
- mcp_resource:definition:scene_architecture (src/mcp/resources/index.ts)
- mcp_resource:definition:scene_roadmap (src/mcp/resources/index.ts)
- mcp_resource:definition:spec_requirements (src/mcp/resources/index.ts)
- mcp_resource:definition:spec_design (src/mcp/resources/index.ts)
- mcp_resource:definition:spec_tasks (src/mcp/resources/index.ts)
- mcp_resource:definition:adr (src/mcp/resources/index.ts)
- mcp_resource:definition:scene_adr (src/mcp/resources/index.ts)

### 1.5 Coverage Summary

- 前缀规则覆盖: 90 surfaces (26.0%)
- 新增扫描覆盖: 256 surfaces (74.0%)
- **总覆盖率**: 346 / 346 (100.0%)

## 2. Conflicts & Duplicates

### 2.1 Trigger Conflicts

| Trigger | Surfaces | Issue | Severity |
|---------|----------|-------|----------|
| Tool registration | tool_annotations:metadata:annotations_1, tool_annotations:metadata:annotations_2, tool_annotations:metadata:annotations_3, tool_annotations:metadata:annotations_4, tool_annotations:metadata:annotations_5, tool_annotations:metadata:annotations_6, tool_annotations:metadata:annotations_7, tool_annotations:metadata:annotations_8, tool_annotations:metadata:annotations_9, tool_annotations:metadata:annotations_10, tool_annotations:metadata:annotations_11, tool_annotations:metadata:annotations_12, tool_annotations:metadata:annotations_13, tool_annotations:metadata:annotations_14, tool_annotations:metadata:annotations_15, tool_annotations:metadata:annotations_16, tool_annotations:metadata:annotations_17, tool_annotations:metadata:annotations_18, tool_annotations:metadata:annotations_19, tool_annotations:metadata:annotations_20, tool_annotations:metadata:annotations_21, tool_annotations:metadata:annotations_22, tool_annotations:metadata:annotations_23, tool_annotations:metadata:annotations_24, tool_annotations:metadata:annotations_25, tool_annotations:metadata:annotations_26, tool_annotations:metadata:annotations_27, tool_annotations:metadata:annotations_28, tool_annotations:metadata:annotations_29, tool_annotations:metadata:annotations_30, tool_annotations:metadata:annotations_31, tool_annotations:metadata:annotations_32, tool_annotations:metadata:annotations_33, tool_annotations:metadata:annotations_34, tool_annotations:metadata:annotations_35, tool_annotations:metadata:annotations_36, tool_annotations:metadata:annotations_37, tool_annotations:metadata:annotations_38, tool_annotations:metadata:annotations_39, tool_annotations:metadata:annotations_40, tool_annotations:metadata:annotations_41, tool_annotations:metadata:annotations_42 | 共享触发条件（结构使然，非内容冲突） | low |

### 2.2 Cross-Channel Duplicates

✅ No cross-channel duplicates detected.

## 3. Budget & Hash Baseline

### 3.1 Budget by Channel

| Channel | Count | Chars | Tokens (Est.) |
|---------|-------|-------|---------------|
| governance_doc | 76 | 262,838 | 65,736 |
| tool_metadata | 84 | 3,929 | 1,013 |
| tool_annotations | 42 | 2,808 | 719 |
| tool_input_schema | 121 | 2,154 | 578 |
| ai_followup | 5 | 815 | 205 |
| server_instructions | 1 | 541 | 136 |
| mcp_resource | 17 | 185 | 54 |
| **Total** | **346** | **273,270** | **68,441** |

### 3.2 Budget by Role

| Role | Count | Chars | Tokens (Est.) |
|------|-------|-------|---------------|
| RECOMMENDATION | 127 | 182,681 | 45,719 |
| ACTION_HINT | 26 | 64,620 | 16,163 |
| FACT | 193 | 25,969 | 6,559 |
| **Total** | **346** | **273,270** | **68,441** |

### 3.3 Hash Statistics

- Total surfaces: 346
- Unique hashes: 271
- Duplicate content: 75

## 4. Reproducibility

**Command**: `npx tsx scripts/scan-high-risk-wording.ts`

**Input**:
- File: `guidance-surface-inventory-v2.json`
- Size: 258.3 KB
- Surfaces: 346

**Output**:
- Report Hash: `sha256:e9dd6a08a9ed9a209ac2b7ceae555f9f3868dca8253c824c33d5377acce8f8be`
