# T-029 归属边界验证报告

**验证时间**: 2026-09-02  
**任务**: T-029（04-00-agent-e2e-observability）  
**验证目标**: 确认 04-00 只观测、不修改运行时行为

---

## 一、验收标准

### 1.1 三项验收要求

1. ✅ **证据采集代码不侵入业务逻辑**
2. ✅ **证据存储在独立文件（不修改 .lrnev 状态）**
3. ✅ **归属声明：04 观测，08 定义边界，03 执行迁移**

---

## 二、验证结果

### 2.1 证据采集代码不侵入业务逻辑

**验证项**：
- ✅ `EvidenceCollector` 位于 `tests/e2e/04-00/evidence-collector.ts`（测试目录）
- ✅ `src/` 业务代码**零引用** EvidenceCollector（grep 结果：0 次）
- ✅ 采集方式：**fixture 驱动**，不依赖真实 MCP server 运行时钩子
- ✅ 结构事实判定：基于 `tool_sequence`、`expectedAction`、状态机规则（`VALID_SPEC_TRANSITIONS`）

**代码路径验证**：
```
tests/e2e/04-00/evidence-collector.ts  ← 采集器实现（测试目录）
tests/e2e/04-00/e01.test.ts ~ e11.test.ts  ← 测试使用采集器
tests/fixtures/04-00/  ← fixture 定义（测试数据）
scripts/run-b0-baseline.mts  ← 证据生成脚本（独立工具）

src/  ← 业务逻辑（完全隔离）
```

**业务逻辑隔离证明**：
```bash
$ grep -r "EvidenceCollector" src/ --include="*.ts"
(无结果，零引用)
```

**结论**: ✅ **证据采集代码完全不侵入业务逻辑**

---

### 2.2 证据存储在独立文件

**验证项**：
- ✅ 证据存储位置：`dev-docs/ai-guidance-standardization/evidence/`（文档目录）
- ✅ **不在 `.lrnev/` 状态目录**
- ✅ `.lrnev/` 引用证据文件数量：13 次（仅文档引用，非状态依赖）

**证据文件清单**：
```
dev-docs/ai-guidance-standardization/evidence/
├── b0-evidence-manifest.json      (23540 bytes, B0-s 结构基线)
├── b1-evidence-manifest.json      (25260 bytes, B1 text_v1 标注)
├── b1-runtime-evidence-manifest.json  (24613 bytes, B1 运行时)
├── b2a-evidence-manifest.json     (26000 bytes, B2a M1)
└── b2b-evidence-manifest.json     (24480 bytes, B2b M2)
```

**状态目录验证**：
```bash
$ ls .lrnev/scenes/04-ai-guidance-standardization/specs/04-00-agent-e2e-observability/
requirements.md
design.md
tasks.md
(证据文件不在此处)
```

**引用检查**：
```bash
$ grep -r "dev-docs/ai-guidance-standardization" .lrnev/ | wc -l
13  (仅文档中的路径引用，非运行时状态依赖)
```

**结论**: ✅ **证据存储在独立文件，不修改 .lrnev 状态**

---

### 2.3 归属声明验证

**验证项**：
- ✅ 04-00 最终观测报告中明确声明归属边界
- ✅ requirements.md F-06 定义证据引用契约
- ✅ 与其他 Spec 协作边界清晰

**归属声明内容**（来源：../deliverables/04-00-final-observation-report.md 第六节）：

| 职责 | 归属 | 说明 |
|------|------|------|
| **观测** | 04-00 | 采集 client/model/version 运行时 guidance 消费证据 |
| **定义边界** | 08-00 | 定义 guidance surface 边界 |
| **执行迁移** | 03-00 | 实施 guidance 迁移（M1/M2） |
| **清单维护** | 02-00 | guidance surface 清单维护 |
| **Profile 适配** | 05-00 | 补充 client_version/model_version |
| **实施文档** | 06-00 | 引用 04 证据，说明实测覆盖范围 |

**证据引用契约**（F-06）：
```
04 是 client/model/version 运行时 capability 的唯一证据源；
02 的静态备注和 05/06 的适配结论均引用 run_id/evidence_path，
不复制或改写原始观察；
发布前重跑受影响客户端的核心场景。
```

**协作流程**：
```
08-00 定义边界 → 02-00 维护清单 → 03-00 迁移实施 
                                    ↓
                              04-00 观测验证（本 Spec）
                                    ↓
                    ← 05-00 Profile 适配 ← 06-00 实施文档
```

**结论**: ✅ **归属声明清晰，与其他 Spec 协作边界明确**

---

## 三、补充验证

### 3.1 测试隔离性

**验证方式**：检查测试是否修改业务代码

```bash
$ ls tests/e2e/04-00/*.test.ts | xargs grep -l "import.*from.*'\.\./\.\./\.\./src/"
(无结果，测试不导入 src/ 业务代码)
```

**说明**：
- 测试仅使用 fixture（测试数据）驱动
- 不依赖真实 MCP server 运行时
- 不修改任何 src/ 业务逻辑

**结论**: ✅ **测试完全隔离，不修改业务代码**

### 3.2 证据生成工具隔离性

**工具位置**: `scripts/run-b0-baseline.mts`

**工具职责**：
- 读取 fixture 定义
- 调用 EvidenceCollector 生成证据
- 输出到 `dev-docs/ai-guidance-standardization/evidence/`

**隔离验证**：
- ✅ 位于 `scripts/`（工具目录）
- ✅ 不修改 `src/` 业务代码
- ✅ 不修改 `.lrnev/` 状态
- ✅ 仅写入 `dev-docs/`（文档输出）

**结论**: ✅ **证据生成工具完全隔离**

---

## 四、综合结论

### 4.1 验收达成

| 验收标准 | 结论 | 证据 |
|---------|------|------|
| **证据采集代码不侵入业务逻辑** | ✅ 完全隔离 | src/ 零引用 EvidenceCollector |
| **证据存储在独立文件** | ✅ 不修改状态 | dev-docs/ 独立存储，不在 .lrnev/ |
| **归属声明清晰** | ✅ 明确边界 | 04 观测、08 定义、03 迁移 |

### 4.2 隔离性保障

✅ **代码层面**：
- EvidenceCollector 在 `tests/` 目录
- 业务代码（src/）零引用
- 测试不修改业务逻辑

✅ **数据层面**：
- 证据存储在 `dev-docs/`
- 不修改 `.lrnev/` 状态
- 仅 13 处文档路径引用（非状态依赖）

✅ **职责层面**：
- 04-00 只观测，不定义、不迁移
- 证据引用契约（F-06）明确
- 与其他 Spec 协作边界清晰

### 4.3 最终判定

**T-029 验收**: ✅ **全部通过**

04-00 完全符合"只观测、不修改"的归属边界要求：
- 证据采集不侵入业务
- 证据存储不污染状态
- 归属声明清晰明确

---

**验证时间**: 2026-09-02  
**验证人**: Claude Opus 5  
**状态**: T-029 验收通过，可落库
