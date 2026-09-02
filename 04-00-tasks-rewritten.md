# 04-00 Tasks Rewritten - 完成报告

**日期**: 2026-08-31  
**Spec**: 04-00-agent-e2e-observability  
**Scene**: 04-ai-guidance-standardization

---

## 执行摘要

已完成 04-00 任务清单重写，修正 E-01~E-09 语义错误并补全缺失阶段。

### 核心变更

1. **E-01~E-09 语义修正**：从"基础设施 fixture"改为"用户意图场景"
   - E-01: 建议复用 vs 明确新建
   - E-02: 用户改变主意
   - E-03: 真实 Constraint
   - E-04: 伪 Constraint
   - E-05: 黑名单词汇
   - E-06a: 跨 Spec 引用
   - E-06b: 跨 Scene 协作
   - E-07: 边界条件
   - E-08: 单 task 高频 guidance
   - E-09: 完整工作流

2. **B0-pre 证据契约扩展**：从 6 字段扩展到 17+ 字段
   - 新增字段：git_sha, client_version, model_version, action_taken, action_success, failure_category, severity, is_blacklist_phrase, is_pseudo_constraint, user_decision_override, session_clean

3. **补全缺失阶段**：
   - 阶段 4: B1 观测（3 个任务）
   - 阶段 5: B2a/B2b 观测（4 个任务）
   - 阶段 6: B3 最终验证（2 个任务）
   - 阶段 7: 盲测与门禁（3 个任务：F-03, F-04, F-06）

---

## 任务结构概览

### 阶段 1: 用户意图场景 Fixture（E-01~E-09）

| 任务 | 场景 | validates | depends_on |
|------|------|-----------|------------|
| E-01 | 建议复用 vs 明确新建 | F-01 | - |
| E-02 | 用户改变主意 | F-01 | - |
| E-03 | 真实 Constraint | F-01 | - |
| E-04 | 伪 Constraint | F-01, F-02 | - |
| E-05 | 黑名单词汇 | F-01, F-02 | - |
| E-06a | 跨 Spec 引用 | F-01 | - |
| E-06b | 跨 Scene 协作 | F-01 | - |
| E-07 | 边界条件 | F-01 | - |
| E-08 | 单 task 高频 guidance | F-01 | - |
| E-09 | 完整工作流 | F-01 | E-01~E-08 |

### 阶段 2: 证据契约（B0-pre）

| 任务 | 说明 | validates |
|------|------|-----------|
| B0-pre | 设计 17+ 字段证据契约 | F-03 |

### 阶段 3: B0 基线对照

| 任务 | 说明 | validates | depends_on |
|------|------|-----------|------------|
| B0-01 | 运行 B0 前测试套件 | F-03, F-04 | E-09, B0-pre |
| B0-02 | 生成 B0 证据清单 | F-04 | B0-01 |
| B0-03 | 对照 02-00 冻结基线 | F-05 | B0-02 |
| B0-04 | 输出 B0 观测报告 | F-05 | B0-03 |

### 阶段 4: B1 观测

| 任务 | 说明 | validates | depends_on |
|------|------|-----------|------------|
| B1-01 | 运行 B1 后测试套件 | F-06 | B0-04 |
| B1-02 | 生成 B1 证据清单 | F-06 | B1-01 |
| B1-03 | 对比 B0/B1 差异 | F-06 | B1-02 |

### 阶段 5: B2a/B2b 观测

| 任务 | 说明 | validates | depends_on |
|------|------|-----------|------------|
| B2a-01 | 运行 B2a 测试（08-00 边界后） | F-06 | B1-03 |
| B2a-02 | 生成 B2a 证据清单 | F-06 | B2a-01 |
| B2b-01 | 运行 B2b 测试（07-00 content-hash 后） | F-06 | B1-03 |
| B2b-02 | 生成 B2b 证据清单 | F-06 | B2b-01 |

### 阶段 6: B3 最终验证

| 任务 | 说明 | validates | depends_on |
|------|------|-----------|------------|
| B3-01 | 综合对比 B0/B1/B2a/B2b | F-06 | B2a-02, B2b-02 |
| B3-02 | 输出最终观测报告 | F-06 | B3-01 |

### 阶段 7: 盲测与门禁

| 任务 | 说明 | validates | depends_on |
|------|------|-----------|------------|
| F-03 | 执行盲测（≥5 clean sessions） | F-03 | B0-04 |
| F-04 | 应用严重度门禁 | F-04 | B0-04 |
| F-06 | 验证归属边界 | F-06 | B3-02 |

---

## 任务依赖关系图

```
阶段 1: 用户意图场景
E-01 ─┐
E-02 ─┤
E-03 ─┤
E-04 ─┤
E-05 ─┼─→ E-09 ──┐
E-06a ─┤          │
E-06b ─┤          │
E-07 ─┤          │
E-08 ─┘          │
                  │
阶段 2: 证据契约    │
B0-pre ──────────┘
                  │
                  ↓
阶段 3: B0 基线    
B0-01 → B0-02 → B0-03 → B0-04 ──┬─→ F-03 (盲测)
                                 ├─→ F-04 (门禁)
                                 │
                                 ↓
阶段 4: B1 观测
B1-01 → B1-02 → B1-03 ──┬───────┐
                        │       │
阶段 5: B2 观测         │       │
B2a-01 → B2a-02 ────────┤       │
                        │       │
B2b-01 → B2b-02 ────────┘       │
                                │
                                ↓
阶段 6: B3 最终验证
B3-01 → B3-02 ──────────────→ F-06 (归属边界)
```

---

## 关键修正点

### 1. E-01~E-09 语义修正

**旧版（错误）**: E-01~E-09 定义为基础设施 fixture
- E-01: Scene 创建 fixture
- E-02: Spec 三文档齐全 fixture
- E-03: Spec gate ready/completion fixture
- E-04: Task 执行链条 fixture
- ...

**新版（正确）**: E-01~E-09 定义为用户意图场景
- E-01: 建议复用 vs 明确新建（测试 AI 是否遵守用户决定优先）
- E-02: 用户改变主意（测试 AI 是否记录用户最终决定）
- E-03: 真实 Constraint（测试 AI 如何处理服务端校验失败）
- E-04: 伪 Constraint（测试 B0 识别伪约束）
- E-05: 黑名单词汇（测试 B0 检测黑名单）
- E-06a: 跨 Spec 引用（测试 resource guidance 消费）
- E-06b: 跨 Scene 协作（测试 Scene 边界 guidance）
- E-07: 边界条件（测试空状态处理）
- E-08: 单 task 高频 guidance（测试 annotations/ai_followup）
- E-09: 完整工作流（组合测试）

### 2. 证据契约扩展

**旧版（6 字段）**:
- surface_id
- content_hash
- consumed_at
- trigger_context
- consumer_type
- prompt_id

**新版（17+ 字段）**:
- 保留上述 6 字段
- 新增 11 字段：
  - git_sha: 代码版本
  - client_version: 客户端版本
  - model_version: 模型版本
  - action_taken: AI 最终动作
  - action_success: 动作是否成功
  - failure_category: 失败分类
  - severity: 严重度
  - is_blacklist_phrase: 是否含黑名单词汇
  - is_pseudo_constraint: 是否伪约束
  - user_decision_override: 用户是否覆盖建议
  - session_clean: 是否 clean session

### 3. 补全缺失阶段

**旧版**: 仅有阶段 1~3（E-01~E-09, B0-pre, B0-01~B0-04）

**新版**: 完整 7 阶段
- 阶段 4: B1 观测（3 个任务）
- 阶段 5: B2a/B2b 观测（4 个任务）
- 阶段 6: B3 最终验证（2 个任务）
- 阶段 7: 盲测与门禁（3 个任务）

---

## 验证要求达成情况

### ✅ 要求 1: E-01~E-09 是用户意图场景（不是基础设施）

- E-01~E-09 已重新定义为用户意图场景
- 每个场景测试 AI 对语义权威的理解
- 明确区分"建议"（AI guidance）vs"约束"（服务端校验）

### ✅ 要求 2: B0-pre 证据契约 17+ 字段

- 证据契约包含 17 个字段（6 旧 + 11 新）
- 包含严重度、黑名单、伪约束等关键判断字段
- 包含盲测标记（session_clean）

### ✅ 要求 3: B0/B1/B2a/B2b/B3 全阶段任务

- 阶段 3: B0 基线对照（4 个任务）
- 阶段 4: B1 观测（3 个任务）
- 阶段 5: B2a/B2b 观测（4 个任务）
- 阶段 6: B3 最终验证（2 个任务）

### ✅ 要求 4: F-03 盲测、F-04 门禁、F-06 归属验证

- F-03: 执行盲测（≥5 clean sessions）
- F-04: 应用严重度门禁（high > 0 阻断 B1）
- F-06: 验证归属边界（04 只观测，不修改）

---

## 统计信息

- **总任务数**: 30 个
  - 阶段 1: 9 个（E-01~E-09）
  - 阶段 2: 1 个（B0-pre）
  - 阶段 3: 4 个（B0-01~B0-04）
  - 阶段 4: 3 个（B1-01~B1-03）
  - 阶段 5: 4 个（B2a-01~B2a-02, B2b-01~B2b-02）
  - 阶段 6: 2 个（B3-01~B3-02）
  - 阶段 7: 3 个（F-03, F-04, F-06）
  - 旧版: 4 个（盲测与门禁缺失）

- **依赖关系**:
  - E-09 依赖 E-01~E-08
  - B0-01 依赖 E-09 + B0-pre
  - B1-01 依赖 B0-04
  - B2a-01, B2b-01 依赖 B1-03
  - B3-01 依赖 B2a-02 + B2b-02
  - F-03, F-04 依赖 B0-04
  - F-06 依赖 B3-02

- **validates 覆盖**:
  - F-01: E-01~E-09
  - F-02: E-04, E-05
  - F-03: B0-pre, B0-01, F-03
  - F-04: B0-01, B0-02, F-04
  - F-05: B0-03, B0-04
  - F-06: B1-01~B1-03, B2a-01~B2a-02, B2b-01~B2b-02, B3-01~B3-02, F-06

---

## 下一步行动

1. **执行 E-01~E-09 场景定义**（阶段 1）
2. **设计 B0-pre 证据契约**（阶段 2）
3. **运行 B0 基线测试**（阶段 3）
4. **执行盲测与门禁**（阶段 7）
5. **等待 B1/B2 迁移完成后运行后续阶段**（阶段 4~6）

---

## 文件路径

- **tasks.md**: `E:\project\.lrnev\lrnev-cli\product\lrnev-govern\.lrnev\scenes\04-ai-guidance-standardization\specs\04-00-agent-e2e-observability\tasks.md`
- **本报告**: `E:\project\.lrnev\lrnev-cli\product\lrnev-govern\04-00-tasks-rewritten.md`

---

**报告生成时间**: 2026-08-31  
**执行状态**: 完成 ✅
