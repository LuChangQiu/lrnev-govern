---
spec: '02-00-guidance-surface-inventory'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 02-00 Guidance Surface Inventory - 设计

## L0 摘要

建立“完整 Surface 清单 + 三维语义标注 + 内容 hash + 冲突/预算基线”，只记录静态事实和声明式 capability；运行时消费交给 E2E，文本迁移在基线冻结后另行执行。

## L1 概览

#### D-01 清单字段

| 字段 | 含义 |
|---|---|
| `surface_id` | 稳定标识，例如 `global.workflow_overview` |
| `channel` | server_instruction / tool_metadata / input_schema / resource / result_content / error / client_rule / document |
| `source` | 源码/文档的精确路径、符号、字段或章节 |
| `trigger` | 何时进入客户端上下文 |
| `consumer` | MCP 客户端、CLI、常驻规则或人工阅读者 |
| `role` | FACT / RECOMMENDATION / DECISION_BOUNDARY / EXECUTION_CONSTRAINT / ACTION_HINT |
| `provenance` | workspace / lrnev / client_asserted / user_quote / unknown |
| `enforcement` | none / client_boundary / server_enforced |
| `owner` | 维护模块或 Spec |
| `budget` | 字符/token 预算和当前值 |
| `content_hash` | 规范化内容 hash，用于基线与对照 |
| `tests` | 静态、单元、E2E 覆盖 |
| `capability_note` | 协议/客户端文档声明的可见性备注；不是运行时结论 |

清单本身放在 `dev-docs/ai-guidance-standardization`，源码扫描只生成事实，不替代架构判断。

#### D-02 Surface 覆盖范围

1. **MCP 初始化**：server instructions、capabilities、协议版本。
2. **工具声明**：title/description、Zod `.describe()`、input/output schema、annotations、execution metadata。
3. **工具结果**：`content`、`structuredContent`、`isError`、`_meta`、lrnev `ai_followup/suggested_tools` 和错误文本。
4. **Resources**：固定/模板 resource 的 description、URI、实际 Markdown 内容及客户端是否声明自动注入。
5. **项目/客户端文档**：`AI-ADAPTATION.md`、Scene/Spec guidance、常驻规则模板。

当前未注册 MCP prompts，也应在清单中记录为“无”，避免未来误以为已覆盖。

#### D-03 规则

- `ACTION_HINT` 必须声明为建议的下一步，不得默认等于 required step。
- Recommendation 旁必须有可接受/拒绝/询问用户的例外语义。
- DECISION_BOUNDARY 是客户端行为边界，不得标为服务端 Constraint。
- 真正 EXECUTION_CONSTRAINT 必须指向确定性校验和失败结果，不用模糊的“最好不要”。
- Tool annotations 按 MCP 契约只是 hints，不得当作权限或安全事实。
- 02 只生成待迁移清单，不在基线阶段改写文本。

## L2 详情

#### D-04 静态扫描与人工核对

- 从 `registerTool/registerResource`、Zod schema、server instructions、guidance 常量和 `AiFollowup.instructions` 提取 Surface。
- 对 Markdown 常驻规则、resource 实际内容和 Spec 文档做关键词、角色前缀与链接检查。
- 报告重复文本、同触发条件冲突、schema/annotation 与实际行为矛盾、预算超限和未分类条目。
- 扫描生成事实，人工负责判断角色和迁移决策；禁止用默认 Recommendation 掩盖无法分类的条目。

#### D-05 失败处理

扫描失败只阻止本 Spec 验收，不改变运行时行为。必填清单字段缺失时显式报错；可选 capability 备注缺失时写 `null`，不能以推测值填充。

#### D-06 测试策略

- 黑名单 + 白名单先在当前文本上生成变更前事实，不把预期修复写进基线。
- 输出 surface 数量、按 channel/role 分类数量、重复组、冲突组、预算使用率和内容 hash。
- 04 通过 surface_id + hash 记录运行时实际消费证据；02 不复制 E2E 结果。
- 迁移后复用同一扫描器生成对照，但基线文件保持不可变。
