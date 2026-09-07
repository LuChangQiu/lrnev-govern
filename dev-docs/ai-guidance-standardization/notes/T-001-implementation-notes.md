# T-001 实施笔记

**任务**: 实现 Surface 扫描器与清单数据契约  
**状态**: 已完成  
**日期**: 2026-08-28

## 已实现内容

### 1. 数据模型（`tests/fixtures/guidance-surface/surface-schema.ts`）

创建了 TypeScript 接口，为 Guidance Surface 定义完整的数据契约：

- **GuidanceSurface**：主接口，包含必填与可选字段
- **SurfaceChannel**：12 种通道类型（server_instructions、tool_metadata 等）
- **SemanticRole**：来自 01-00 的 5 种角色（FACT、RECOMMENDATION、DECISION_BOUNDARY、EXECUTION_CONSTRAINT、ACTION_HINT）
- **Provenance**：来源追踪（workspace、lrnev、client_asserted、user_quote、unknown）
- **Enforcement**：执行强度（none、client_boundary、server_enforced）
- **SurfaceInventory**：完整的清单结构，含统计信息

### 2. 扫描器实现（`scripts/scan-guidance-surfaces.ts`）

实现了一个静态代码扫描器，功能包括：

- **生成稳定的 surface_ids**：格式为 `channel:category:name`（例如 `tool_metadata:scene_create:title`）
- **计算内容哈希**：SHA256，用于变更检测
- **计算预算**：字符数与 token 估算（chars / 4）
- **校验必填字段**：必填字段缺失时显式失败
- **扫描多个来源**：
  - 服务端指令（WORKFLOW_OVERVIEW）
  - 工具元数据（42 个工具的 title + description）
  - 工具注解（readOnlyHint、destructiveHint 等）
  - AI followup 生成点
  - 错误消息（DEFAULT_ERROR_HINTS）

### 3. 输出产物

**Markdown 报告**（`guidance-surface-inventory.md`）：
- 按通道组织的人类可读目录
- 汇总统计（按 channel、consumer、role、budget）
- 每个 surface 都包含源码位置、触发条件与内容预览

**JSON 清单**（`guidance-surface-inventory.json`）：
- 机器可读的完整清单
- 初次扫描发现 132 个 surfaces
- 2,321 行结构化数据

## 扫描结果（基线）

### 统计数据
- **总 Surfaces**: 132
- **按通道**:
  - server_instructions: 1
  - tool_metadata: 84（42 个工具，每个 2 个字段）
  - tool_annotations: 42
  - ai_followup: 5
- **按消费方**:
  - client: 42
  - model: 6
  - both: 84
- **总预算**: 5,977 chars / 约 1,545 tokens

### 计数规则（已文档化）

为避免 T-002 阶段重蹈覆辙：
- **Surface** = 每个独立的 guidance 入口（1 个工具描述 = 1 个 surface）
- **同一工具**: title + description = 2 个独立 surfaces
- **哈希冲突** = 内容完全相同
- **预算** = chars / 4（token 估算）

## 对照需求验证

### D-01 清单字段 ✓
D-01 所需的全部字段均已实现：
- surface_id（稳定、可重复）
- source（file、symbol、field、line）
- channel、trigger、consumer
- content、content_hash
- budget（chars + tokens_estimate）
- 可选: role、provenance、enforcement、owner、tests、capability_note

### D-05 失败处理 ✓
- 必填字段校验，错误信息明确
- 错误上报包含 file:line:field 位置
- 扫描器快速失败，返回结构化错误
- 可选字段（capability_note）显式置为 null

### F-01、F-05、F-06、F-07 ✓
- 稳定 surface_ids 确定性生成
- 内容哈希（SHA256）用于基线比对
- 预算计算（chars + token 估算）
- capability_note 仅记录静态声明
- Markdown + JSON 输出，供人工与机器使用

## 已知限制（需 T-002 处理）

当前实现只是一个**扫描器骨架**。T-002 需要在此基础上增强：

1. **工具描述**: 目前为占位符 `[Description for X]`，需要从 TOOL_DESCRIPTIONS 提取真实文本
2. **输入 schemas**: Zod 的 `.describe()` 调用尚未提取
3. **输出 schemas**: 尚未实现
4. **资源**: MCP resources 尚未扫描
5. **治理文档**: Scene/Spec guidance、AI-ADAPTATION.md 尚未扫描
6. **错误消息**: 目前仅提取了 DEFAULT_ERROR_HINTS，行内错误文本尚未提取

## 用法

```bash
# Run scanner
npx tsx scripts/scan-guidance-surfaces.ts

# Output files
dev-docs/ai-guidance-standardization/guidance-surface-inventory.md
dev-docs/ai-guidance-standardization/guidance-surface-inventory.json
```

## 后续步骤（T-002）

T-002 将使用该扫描器框架来：
1. 提取真实的 TOOL_DESCRIPTIONS 内容（而非占位符）
2. 解析 Zod schemas 中的输入字段描述
3. 扫描 resources、治理文档与错误文本
4. 按 D-02 要求实现全覆盖
5. 生成完整的迁移规划基线
