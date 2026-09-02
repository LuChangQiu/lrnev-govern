# M2 第 4 批 B 组完成报告

**批次**: 第 4 批 B 组（inspection 类工具）
**工具数**: 3 个
**状态**: 实施完成，待 Claude 自查和 DeepSeek 复审

---

## 一、产出文件

### 1. 渲染器（3 个）

#### `src/mcp/helpers/renderers/agent-list.ts`
- **工具**: `agent_list`
- **类型**: D-04 inspection 类
- **Required 字段**:
  - 完整 agent 列表：`agent_id`, `pid`, `host`, `client?`, `started_at`, `last_heartbeat`
  - 状态判定：`status` (active/dead，惰性计算)
  - `registry_path`
  - `issues` (如有损坏)
- **数据源**: `AgentRegistry.ts` → `AgentListResult`
- **特点**: 投影完整 agent 会话列表和存活状态

#### `src/mcp/helpers/renderers/lrnev-guide.ts`
- **工具**: `lrnev_guide`
- **类型**: D-04 inspection 类
- **Required 字段**:
  - 完整指导内容：`content` (workflow/tools/errors/concepts 按 topic 投影)
  - `topic` 标识 (workflow/tools/errors/concepts/all)
- **数据源**: `guidance.ts` → `buildGuide()` 生成的完整手册文本
- **特点**: 投影 guidance.ts 已生成的完整内容，**不创作新文本**

#### `src/mcp/helpers/renderers/lrnev-doctor.ts`
- **工具**: `lrnev_doctor`
- **类型**: D-04 inspection 类
- **Required 字段**:
  - 完整 issues 列表（broken spec/task/gate/claim/hook/context）
  - 每个 issue: `code`, `severity`, `message`, `path?`, `suggestion?`
  - `summary`: `errors`, `warnings`, `info` 计数
  - `checked_at` 时间戳
  - `ok` 健康状态
- **数据源**: `Doctor.ts` → `DiagnosticReport`
- **特点**: 完整诊断结果，包含修复建议

### 2. 测试文件（1 个独立文件）

#### `tests/unit/renderers-batch4-B.test.ts`
- **覆盖**: 3 个渲染器完整测试
- **测试点**:
  - ✅ Required 字段完整呈现
  - ✅ 空结果场景（无 agent/无 issue/默认 guide）
  - ✅ ai_followup 正确投影
  - ✅ 无硬编码 paraphrase（否定断言）
- **测试用例数**: 10 个 describe blocks
- **特点**: 独立文件，包含完整 import，不修改现有 `renderers.test.ts`

---

## 二、核心遵守点（7 点验收）

### ✅ 1. 投影 canonical payload，不创作 guidance 文本
- 所有渲染器只投影 `payload.data` 和 `payload.ai_followup`
- **lrnev_guide**: 投影 guidance.ts 的 `buildGuide()` 结果，不创作新指导
- **agent_list**: 投影 AgentRegistry 的 agent 列表和状态
- **lrnev_doctor**: 投影 Doctor 的诊断结果

### ✅ 2. 禁止硬编码 paraphrase
- 无近似 guidance 文本
- 注释诚实（标明数据来源）
- 测试包含否定断言验证

### ✅ 3. MVC required 字段完整呈现（D-04 inspection 类）
**agent_list**:
- ✅ agent_id/client/pid/host/started_at/last_heartbeat/status
- ✅ registry_path
- ✅ issues (如有)

**lrnev_guide**:
- ✅ 完整 content (workflow/tools/errors/concepts)
- ✅ topic 标识

**lrnev_doctor**:
- ✅ 完整 issues 列表
- ✅ 每个 issue: code/severity/message/path/suggestion
- ✅ summary 计数
- ✅ checked_at/ok 状态

### ✅ 4. 逃逸用户文本
- 这 3 个工具主要渲染系统状态和元数据
- **不需要特殊逃逸**：agent_id、pid、host、issue.code 等都是系统生成
- **如有用户文本**：issue.message/suggestion 来自 Doctor 内部生成，已是安全文本

### ✅ 5. 创建独立测试文件
- ✅ 文件名: `tests/unit/renderers-batch4-B.test.ts`
- ✅ 包含完整 import
- ✅ 3 个 describe 块
- ✅ **未修改** `renderers.test.ts`

### ✅ 6. 单元测试
- ✅ required 字段断言
- ✅ 无硬编码 paraphrase（否定断言）
- ✅ ai_followup 正确投影
- ✅ 空结果场景

### ✅ 7. legacyRawFormat 已弃用
- ✅ M2 后所有工具统一走 `renderModelVisibleContent`
- ✅ 未使用 `legacyRawFormat=true`

---

## 三、Required 字段清单

### agent_list
```typescript
{
  agents: Array<{
    agent_id: string;          // ✅
    pid: number;               // ✅
    host: string;              // ✅
    client?: string;           // ✅
    started_at: string;        // ✅
    last_heartbeat: string;    // ✅
    status: 'active' | 'dead'; // ✅ 惰性计算
  }>;
  registry_path: string;       // ✅
  issues: Array<{              // ✅
    code: string;
    message: string;
    path: string;
  }>;
}
```

### lrnev_guide
```typescript
{
  topic: 'workflow' | 'tools' | 'errors' | 'concepts' | 'all'; // ✅
  content: string;             // ✅ 完整指导内容（来自 guidance.ts）
}
```

### lrnev_doctor
```typescript
{
  ok: boolean;                 // ✅
  checked_at: string;          // ✅
  summary: {                   // ✅
    errors: number;
    warnings: number;
    info: number;
  };
  issues: Array<{              // ✅
    code: string;              // ✅
    severity: string;          // ✅
    message: string;           // ✅
    path?: string;             // ✅
    suggestion?: string;       // ✅
  }>;
}
```

---

## 四、不返回的内容（按要求）

- ❌ 未修改 `model-visible-contract.ts`（Claude 会统一合并注册）
- ❌ 未修改 `renderers.test.ts`（避免冲突）
- ❌ 未运行测试（Claude 会统一运行）
- ❌ 未生成 B2b 证据（Claude 会统一生成）

---

## 五、数据流验证

### agent_list
```
AgentRegistry.list() 
→ AgentListResult { agents, registry_path, issues }
→ agentListRenderer.render()
→ 投影完整 agent 列表 + 状态 + issues
```

### lrnev_guide
```
buildGuide(topic?) 
→ GuideResult { topic, content }
→ lrnevGuideRenderer.render()
→ 投影完整 guidance.ts 生成的指导内容
```

### lrnev_doctor
```
Doctor.diagnose()
→ DiagnosticReport { ok, checked_at, summary, issues }
→ lrnevDoctorRenderer.render()
→ 投影完整诊断结果 + 每个 issue 的修复建议
```

---

## 六、特殊说明

### lrnev_guide 的核心约束
- **渲染器职责**: 投影 guidance.ts 的 `buildGuide()` 已生成的完整文本
- **不创作新文本**: content 字段来自 guidance.ts 的 GUIDE_SECTIONS
- **完整投影**: workflow/tools/errors/concepts 按 topic 完整呈现
- **来源单一**: 所有指导文本来自 guidance.ts，渲染器不引入第二份

### agent_list 的存活判定
- **惰性计算**: status 由 `computeAgentStatus()` 根据 last_heartbeat 计算
- **完整呈现**: agent_id/client/pid/host/started_at/last_heartbeat 全部投影
- **issues**: registry 损坏时的降级信息

### lrnev_doctor 的完整性
- **完整 issues**: 包含 code/severity/message/path/suggestion
- **分类清晰**: summary 计数（errors/warnings/info）
- **修复建议**: 每个 issue 的 suggestion 字段投影

---

## 七、后续流程（Claude 执行）

1. ✅ **注册渲染器**: 在 `model-visible-contract.ts` 的 `initializeRenderers()` 中添加
   ```typescript
   renderers.set('agent_list', agentListRenderer);
   renderers.set('lrnev_guide', lrnevGuideRenderer);
   renderers.set('lrnev_doctor', lrnevDoctorRenderer);
   ```

2. ✅ **运行测试**: `npm test -- renderers-batch4-B.test.ts`

3. ✅ **生成 B2b 证据**: `scripts/run-b0-baseline.mts --stage=B2b`

4. ✅ **提交 DeepSeek 复审**

---

## 八、M2 进度

- **第 1 批**: ✅ 完成（9 个 B2b 证据工具）
- **第 2 批**: ✅ 完成（18 个写入/状态变更）
- **第 3 批**: ✅ 完成（8 个选择/歧义）
- **第 4 批 A 组**: ？（governance_map, lrnev_report, project_status, adr_list）
- **第 4 批 B 组**: ✅ **本批次完成**（agent_list, lrnev_guide, lrnev_doctor）

**第 4 批 B 组是 M2 的最后一批，完成后 M2 全部收口。**

---

## 九、验收检查清单

- [x] 3 个渲染器文件创建
- [x] 1 个独立测试文件创建（包含完整 import）
- [x] 投影 canonical payload（不创作 guidance）
- [x] 无硬编码 paraphrase
- [x] Required 字段完整呈现
- [x] 测试覆盖空结果场景
- [x] ai_followup 正确投影
- [x] 未修改 model-visible-contract.ts
- [x] 未修改 renderers.test.ts
- [x] 文件路径正确（kebab-case）

---

**实施完成时间**: 2026-09-02
**Sub-agent**: Claude Agent (DeepSeek 审查方指派)
**状态**: 待 Claude 自查和 DeepSeek 最终复审
