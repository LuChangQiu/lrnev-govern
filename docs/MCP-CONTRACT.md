# MCP 响应契约（3.0.0 起）

> 本文写给**消费 `structuredContent` 的接入方**（自己写脚本、做客户端集成的）。
> 如果你的客户端只是把工具返回交给 AI 读，直接读 `content[0].text` 即可，无需适配。

| 你可能想找 | 去哪 |
|---|---|
| 跨客户端接入配置、工具总览、`--profile core/full` 分层、常驻提示词模板、真机盲测矩阵 | [AI-ADAPTATION.md](./AI-ADAPTATION.md) |
| gate / 哨兵 / 状态机 / 锚点的治理语义，以及截断元数据的治理含义 | [GOVERNANCE-FLOW.md](./GOVERNANCE-FLOW.md) |
| 产品定位、安装接入、最小闭环、命令速查 | 根 [README](../README.md) |
| 字段的代码级真源 | `src/mcp/types/response-envelope.ts`、`src/mcp/types/output-schemas.ts`、`src/types/truncation.ts` |

## 1. 双通道：一次调用，两种视图

3.0.0 起每次工具调用同时返回两条通道：

| 通道 | 是什么 | 保证机器可解析？ |
|---|---|---|
| `content[0].text` | **按工具渲染的模型可见文本**（AI / 人直接读）：含角色前缀行（`【事实】` / `【建议】` / `【决策边界】` / `【执行约束】` / `【下一步】`）、截断与修复 hint；未注册渲染器的工具回退 legacy JSON | ❌ 不保证——这是辅助阅读通道，格式随版本演进 |
| `structuredContent` | **canonical 数据契约**：本文件描述的字段结构 | ✅ 解析一律读这里 |

> 双通道是语义分离：文本通道为"读得懂"服务，`structuredContent` 为"能写进代码"服务。不要把文本通道当稳定格式解析。

## 2. 信封字段

| 字段 | 类型 | 何时出现 | 说明 |
|---|---|---|---|
| `response_version` | `'1'` | 恒有 | lrnev application envelope 自身的结构版本——独立于 MCP protocol version、Guidance Profile version 与各工具的业务 `data` schema 版本 |
| `ok` | boolean | 恒有 | 业务成功标记。`false` = 动作未执行（参数错误、状态机冲突、歧义引用、内部错误） |
| `data` | object / array | `ok: true` 时必填 | 业务数据，结构按工具定义，随 `tools/list` 的 `outputSchema` 声明；`ok: false` 时可选（个别工具错误时也可能返回部分数据） |
| `errors` | array | `ok: false` 时必填且非空 | 见下方「errors[i]」；`ok: true` 时不应出现 |
| `ai_followup` | object | 可选 | 写入类工具的后续待办与工具建议，见下方 |
| `anchor_context` | array | 可选 | `task_update(in_progress)` / `task_claim` 按 `task.validates` 回填的锚点段落；无 `validates` 或无可解析段落时**不出现**（不回空数组误导） |
| `summary_context` | object | 可选 | `anchor_context` 的降级档：task 无 `validates`（或声明的锚点段落不可解析）时回填 Spec 级 L0/L1 摘要做快速定向；两者皆无时不出现 |

### `errors[i]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | string | 稳定错误码（`shared/errors.ts` 的 `ErrorCode`），如 `INVALID_INPUT`、`INVALID_STATUS_TRANSITION`、`AMBIGUOUS_REF`、`INTERNAL_ERROR`；不暴露原始堆栈或内部实现细节 |
| `message` | string | 人类可读错误原因，不含敏感信息 |
| `field` | string? | 出错的字段或路径，如 `scene` / `spec` / `task_id` |
| `hint` | string? | 修复建议 / 下一步 |
| `candidates` | string[]? | `code = AMBIGUOUS_REF` 时**必须**包含所有匹配的完整标识符——客户端应提示用户从中选择，或用更精确的参数重试 |

### `ai_followup`

| 字段 | 类型 | 说明 |
|---|---|---|
| `instructions` | string[] | 自然语言待办，按顺序执行。写入类工具的惯用内容：生成 L0/L1 摘要并调 `summarize_save`、提示用户做某事等；**不执行 = 工作未完成** |
| `suggested_tools` | array? | 建议的下一个工具：`{ name, args_template, reason }`（`args_template` 含必填项与示例值） |

### `anchor_context[i]` 与 `summary_context`

| 字段 | 类型 | 说明 |
|---|---|---|
| `anchor_context[i].anchor` | string | 锚点 ID，如 `F-01` / `D-02` |
| `anchor_context[i].source` | `'requirements' \| 'design'` | 段落来源文档 |
| `anchor_context[i].text` | string | 段落正文（已按截断策略处理） |
| `anchor_context[i].meta` | `TextMeta` | 截断元数据，见第 5 节 |
| `summary_context.source` | `'sidecar' \| 'inline'` | 摘要来源：sidecar 文件优先，否则 requirements 内联段 |
| `summary_context.l0` | string? | 一句话摘要 |
| `summary_context.l1` | string? | 概览摘要 |
| `summary_context.meta` | `TextMeta` | 聚合截断元数据：任一返回级被预算截断为 `truncated_by_budget`，源级残缺为 `incomplete_source` |

## 3. outputSchema

每个工具随 `tools/list` 声明自己的 `outputSchema`（信封字段同上，`data` 部分按工具业务定义必填 / 可选字段）——**lrnev 不允许用无约束的 `{}` 或 `Record<string, unknown>` 伪装成 schema**。

- 严格消费方以客户端 `tools/list` 返回的 schema 为权威，不要按本文档手抄 `data` 结构。
- 若业务数据无法序列化为已声明的 schema，返回 `INTERNAL_ERROR`（`code` + `hint` 指明是实现缺陷）——**不静默降级为文本并声称成功**。

## 4. 成功与失败的判定

- `ok: true` 才是成功。
- `ok: false` 一律同时置 MCP 层 `isError: true`——业务拒绝（参数错误、状态机冲突、歧义引用）与内部错误都走这条，保证客户端能感知失败并触发重试或错误处理。
- 错误文本按 `[code] message + hint` 渲染。
- `AMBIGUOUS_REF` 表示引用有歧义（如短序号命中多个对象），用 `errors[0].candidates` 取全部候选。

## 5. 截断与省略的显式元数据（3.0.0，F-04）

返回内容可能因**体积预算**或**源残缺**而"只给一部分"——此时显式标注，而不是静默省略。两类元数据与 `structuredContent` 同源，`content` 文本通道也同步投影（如「命中 N 条，仅返回 M 条」），文本-only 客户端不解析 JSON 也能收到同等信号。

### 5.1 段落级：`anchor_context[].meta` / `summary_context.meta`

`text_status` 三态（类型见 `src/types/truncation.ts`）：

| `text_status` | 含义 | 客户端处置 |
|---|---|---|
| `complete` | 正文完整返回 | 直接使用 |
| `truncated_by_budget` | 预算截断：源内容完整，但受体积上限省略了尾部 | 只用于快速定向，关键判断前查原文 |
| `incomplete_source` | 源残缺：锚点/摘要标题在但正文未填（如仍是 `<!-- FILL: ... -->` 占位） | 先去补写 requirements/design；lrnev 不会把占位噪声当正文回填 |

- 非 `complete` 时附 `original_length`（截断 / 残缺前的原始长度）；
- 三态恒有 `returned_length`（= 实际返回的 `text` 长度）。

### 5.2 查询级：QueryMeta 四件套

`returned_count`（实际返回条数）/ `total_count`（截断前候选总数——lrnev 先全量收集再截断，**恒可得、无 null**）/ `truncated`（是否因预算省略）/ `omitted`（省略详情；类型允许 `{ kind: 'none' }` / `{ kind: 'exact', count: N }` / `{ kind: 'unknown' }`，当前实现只产出前两种）。出现位置与消费方式：

| 位置 | 字段 | 语义 |
|---|---|---|
| `context_search` | `data.query_meta` | `total_count` = 全量召回命中数，`returned_count` = 按 `top_k` 截断后的返回数。`truncated: true` 表示还有命中被省略（`omitted.count` 条）——**不要把"只返回 N 条"误读成"只有 N 条命中"**；在意被省略的命中就换更精确的关键词或加 `scope` 缩小范围重试 |
| `project_status` | 每个 Spec 的 `claimable_meta` | `total_count` = 该 Spec 的 `free_tasks_count`（可领任务全量），`returned_count` = `claimable_next` 预览条数；`truncated: true` 表示预览只取了前 `project_status.claimable_preview` 条 |
| `task_create_many` | `data.query_meta` | 核对信息：`created` 条数 = 请求批、`truncated` **恒为 `false`**——批量是原子 all-or-nothing，超 `task.max_batch_create` 在上限处直接报错，不是截断 |

> 治理语义与逐字段消费指引详见 [GOVERNANCE-FLOW.md](./GOVERNANCE-FLOW.md) 的「截断与省略的显式元数据」节。

## 6. `decision_context`（可选入参，v1）

`scene_create` / `spec_create` / `task_create` / `assess_goal` 四个工具接受 `decision_context`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `source` | `'client_asserted'` | ✅ | 只承载客户端声明来源，服务端不伪造 `USER_DECISION` |
| `strength` | `'explicit' \| 'preferred' \| 'unspecified'` | ✅ | 声明强度：`explicit` / `preferred` 必须提供 `direction`，`unspecified` 必须省略 `direction` |
| `summary` | string | ✅ | 对用户组织方式决定的简短概括；服务端不解析其语义、不持久化 |
| `direction` | `'new_scene' \| 'new_spec' \| 'reuse_spec' \| 'no_spec' \| 'other'` | 条件必填 | 见 `strength` 行 |
| `target_ref` | string | 可选 | 具体的 Scene / Spec 完整稳定引用，如 `scene=01-user-management, spec=01-00-user-login` |

它声明"本次调用是照着用户的什么组织决定来的"。服务端只把它当作**本次调用**的客户端声明，参与建议与 `content` 文本通道的【决策边界】行渲染：

- **不落盘、不阻断**——不写入任何文件，也不改变调用的成败；
- 条件规则违反（`explicit` / `preferred` 缺 `direction`，或 `unspecified` 带了 `direction`）返回 `INVALID_INPUT`；
- 不传 = 未声明，行为与旧版一致；用户没说过就不要编造声明。

## 7. 2.x → 3.0 升级注意

2.3.0 及以前，`content[0].text` 是 `JSON.stringify` 后的 payload。**曾用 `JSON.parse(content[0].text)` 消费结果的脚本 / 客户端，请迁移到 `structuredContent`**——字段与旧 JSON 同构，另加 `response_version`。3.0.0 起 `content[0].text` 是按工具渲染的模型可见文本，不再是 JSON。

## 8. 相关文档

- [GOVERNANCE-FLOW.md](./GOVERNANCE-FLOW.md) —— gate / 哨兵 / 状态机 / 锚点 / 序号 / report 口径，以及截断语义的治理含义
- [AI-ADAPTATION.md](./AI-ADAPTATION.md) —— 跨客户端接入、工具总览与 `--profile core/full` 分层、常驻提示词模板、真机盲测矩阵
- [ARCHITECTURE.md](./ARCHITECTURE.md) —— 源码结构与设计原则
- 根 [README](../README.md) —— 产品定位、安装接入、最小闭环、命令速查
- [CHANGELOG.md](../CHANGELOG.md) —— 版本升级注意与演进历史
