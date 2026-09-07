---
spec: '06-00-guidance-documentation'
scene: '04-ai-guidance-standardization'
created: '2026-08-27'
---

# 06-00 Guidance Documentation - 设计

## L0 摘要

按“规范、清单、传输、客户端、证据、Profile 附录”分层发布文档，让通用 MCP 使用者不必理解 lrnev Profile，也让 Profile 使用者不误把客户端声明当成服务端事实。

## L1 概览

#### D-01 文档产物树

```text
dev-docs/ai-guidance-standardization/
  semantic-authority-model.md        # 01，五种角色与真实 Constraint
  guidance-surface-inventory-v2.md   # 02，静态入口与基线
  mcp-response-conformance.md        # 03，标准传输、response_version 和错误契约
  model-visible-contract.md          # 03，逐工具 content 完整性规则
  client-integration-guide.md        # 06，客户端消费与 decision_context
  e2e-evidence-index.md              # 04，run id 和 capability 结论
  lrnev-guidance-profile.md          # 05，Profile v1 已实施时才发布
```

README 只作为导航页，不复制上述规范正文。

#### D-02 客户端集成模型

```text
用户原话
  -> Client AI 保留并理解
  -> 可选 decision_context { source, strength, direction?, target_ref? }
  -> lrnev tool
  -> structuredContent（完整机器数据） + content（文本呈现）
  -> Client AI 处理 FACT / RECOMMENDATION / DECISION_BOUNDARY /
     EXECUTION_CONSTRAINT / ACTION_HINT
```

客户端必须把 `decision_context` 当作自己对对话的声明，而不是把它标成 lrnev 已验证事实。缺失 context 只表示未声明，不能擅自改写成 `unspecified`；explicit/preferred 必须提供 direction，unspecified 必须省略 direction。服务端只做 direction/target_ref 与当前调用的枚举级非阻断对齐。

#### D-03 迁移与版本

- MCP `content` 继续作为通用非结构化结果通道；它不再承诺包含完整 lrnev JSON，但必须满足逐工具 ModelVisibleContract，不得丢失模型判断所需信息。
- `structuredContent` 是完整机器数据，要求与 outputSchema 一致；`response_version` 独立于 MCP protocol 和 Profile 版本。
- B2a 先引入 outputSchema/structuredContent 并保持 B1 模型可见信息，B2b 再切换 ModelVisibleContract；两阶段均由 04 记录对照。
- 旧客户端若依赖解析完整 JSON text，需要按 major version 迁移到 structuredContent 或新的 content 视图；不通过永久复制完整 JSON 维持双重真相。
- 每个迁移条目包含引入版本、废弃版本、response_version、回滚版本、客户端验证命令/场景和受影响 surface_id。

## L2 详情

#### D-04 Profile 附录规则

- `lrnev.guidance/v1` 仅在 05 完成实际版本后发布。
- 附录必须声明 capability 前提、已验证客户端版本和 content 文本降级行为。
- 任何 `decision_context` 示例都使用 `client_asserted`，并说明它不持久化、不授予阻断权。

#### D-05 证据引用

- 文档写 capability 结论时引用 `e2e-evidence-index.md` 的 run id 和 stage。
- 02 的静态 Surface 清单、04 的运行记录、05 的适配结论分别拥有不同真相源；文档不得把其中任一项复制成独立事实。

#### D-06 文档测试

- 检查文档树、链接、response/MCP/Profile 版本、schema/role 名称、错误码与 surface_id 是否存在。
- 扫描“Recommendation 必须执行”“用户决定覆盖 Constraint”“Profile 是 MCP 标准”等禁止表述。
- 从 examples 解析 decision_context，验证 `source='client_asserted'`、strength/direction 枚举、target_ref、缺失与 unspecified、不阻断和不持久化声明；检查 ModelVisibleContract 是否覆盖所有注册工具。
