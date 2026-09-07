---
spec: 02-00-guidance-surface-inventory
scene: 04-ai-guidance-standardization
status: completed
priority: P0
created: '2026-08-26'
updated: '2026-09-07'
---

# 02-00 Guidance Surface Inventory - 需求

## L0 摘要

盘点所有会影响客户端 AI 判断或 MCP 数据交付的 Guidance Surface，建立变更前静态基线，记录来源、作用域、文本角色、执行强度、预算、hash 和客户端 capability 备注，不在本 Spec 执行文案迁移。

## L1 概览

### 目标

lrnev 当前的 guidance 和数据交付分布在 server instructions、tool metadata/input descriptions、MCP resources、manager followup、错误响应、GoalAssessor/SpecGuidance、Scene/Spec 文档和用户手动复制的常驻规则中。当前工具结果又只通过 `content[].text` 发送 JSON，尚未使用 `outputSchema/structuredContent`。没有清单和基线，就无法判断一处修复是否被另一处旧文案抵消，也无法区分“服务端没发送”“客户端没注入”和“模型选择性忽略”。

### 范围

**包含**：
- 建立可审阅的 Guidance Surface 清单，记录精确路径/符号、MCP 通道、触发条件、消费者、文本角色、来源、执行强度、维护人和测试覆盖。
- 覆盖 server instructions、tool title/description、Zod `.describe()`、input/output schema、tool annotations/execution metadata、resources/templates/content、tool result `content/structuredContent/isError/_meta`、`ai_followup/suggested_tools`、错误文本、常驻规则和治理文档。
- 识别重复、互相矛盾、把建议写成命令和没有来源的“下一步”文本。
- 记录全局 guidance、工具描述、资源内容和单次 followup 的字符/token 预算、内容 hash 与冲突检查规则。
- 建立文案迁移前的数量、重复、冲突、预算和客户端通道基线。
- 登记不同客户端已知/声明的 capability 差异，但不在本 Spec 判断运行时实际消费行为。

**不包含**：
- 不在没有清单和 E2E 证据前大规模重写所有提示。
- 不把所有软建议升级成 Constraint，不删除仍有业务价值的轻产物分流。
- 不改 MCP 工具签名或执行逻辑。
- 不在本 Spec 迁移高危文案；迁移按 `01-00` 的 `v0.1` 术语执行，并由 `04-00` 做前后对照。
- 不用静态 capability 备注替代真实客户端观测；运行时证据归 `04-00`，Profile 结论归 `05-00`。

## L2 详情

### 详细需求

#### F-01 Guidance Surface 全量清单

- 验收：清单覆盖所有已注册 MCP instructions/tools/resources 及其 schema/metadata/result 通道，并覆盖 `ai_followup` 生成点、GoalAssessor、SpecGuidance、Gate/Scene/Workspace guidance、`AI-ADAPTATION.md` 和 Scene/Spec 文档；每项有精确路径、符号、触发条件和生命周期。

#### F-02 角色、来源与执行强度标注

- 验收：每项按 `01-00 v0.1` 标记 FACT、RECOMMENDATION、DECISION_BOUNDARY、EXECUTION_CONSTRAINT 或 ACTION_HINT，并记录 provenance/enforcement；未经客户端声明的 USER_DECISION、无代码位置的“执行约束”和把 ACTION_HINT 写成 required step 的条目必须列为问题。

#### F-03 高危措辞扫描

- 验收：静态检查能发现“必须复用”“禁止创建新 Spec”“不新开 spec”等建议伪命令，并只允许能引用真实服务端校验的 EXECUTION_CONSTRAINT 使用阻断语气；扫描结果可定位到 surface_id、文件和符号。

#### F-04 重复与冲突检查

- 验收：能够识别同一触发场景中相互冲突的分流、不同通道的重复、文本与 schema/annotation 的行为矛盾，以及全局规则和 followup 的覆盖关系；每个冲突有待迁移决策（保留、合并、降级或移除）。

#### F-05 预算、hash 与基线

- 验收：为全局 instructions、单个 tool description/input description、资源内容和单次 followup 记录当前字符/token 使用量及内容 hash；既有局部预算作为“当前基线”记录，不直接升级成永久架构常量；生成迁移前 surface 数量、重复组、冲突组和预算报告。

#### F-06 capability 归属边界

- 验收：02 只登记协议声明、客户端文档声明和静态可见性备注；真实客户端是否注入/消费某 Surface 只能由 `04-00` 运行记录确认；`05-00` 只引用 04 证据形成适配结论，不复制观测数据。

#### F-07 清单产物

- 验收：人工可审阅清单写入 `dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v2.md`；可重复扫描输出包含 stable surface_id、内容 hash 和基线指标，不凭文件名推测覆盖范围。

### 非功能性需求

- 可维护性：清单由源码路径或稳定标识引用，禁止只用文件名猜测覆盖范围。
- 兼容性：静态文档和旧 `instructions` 消费者仍可工作。
- 可观测性：扫描输出能用于回归比较，保留变更前后计数。

### 验收标准

- [ ] Guidance Surface 清单完成并经过源码逐项核对。
- [ ] resources、annotations、`.describe()`、schema、错误响应和传输通道没有漏项。
- [ ] 高危措辞、重复、冲突、预算和 hash 基线可重复生成。
- [ ] capability 数据归属遵守“02 登记、04 观测、05 引用”。
- [ ] 本 Spec 未执行文案迁移，基线未被修复后数据污染。
