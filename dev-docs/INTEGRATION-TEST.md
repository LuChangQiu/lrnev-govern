# MCP 接入与流程测试（真实客户端实测清单 / F-14）

> 本清单覆盖**单元测试覆盖不到**的部分：MCP 协议握手、工具可发现性、ai_followup 是否真能驱动 AI、真机体验。
> 测试方式：在真实 Claude Code / Cursor 里接入本地 `lrnev-mcp`（发布前未上 npm 也可用本地路径），在一个**全新真实项目**里逐项验证。
> 标记：✅ 通过 / ⚠️ 卡在某步（注明）/ ❌ 无法走通。

---

## 一、AI 客户端接入 MCP

### Claude Code
`claude_desktop_config.json` 或项目级 `.mcp.json`：
```json
{ "mcpServers": { "lrnev": { "command": "lrnev-mcp" } } }
```
发布前用本地构建：`"command": "node", "args": ["<repo>/product/lrnev-govern/bin/lrnev-mcp.mjs"]`。
重启后在对话中验证：`调 lrnev_guide 看看有哪些能力`。

### Cursor
设置 → MCP → 添加同样的 `command: lrnev-mcp`。

### Codex / 其他 MCP 客户端
只要实现 MCP 工具调用，配 `command: lrnev-mcp` 即可。

### 不接 MCP 直接用 CLI
```bash
npm install -g lrnev      # 发布前：cd product/lrnev-govern && npm link
lrnev init                # 不传名时默认用当前文件夹名
lrnev --help
```

---

## 二、协议接入层（最关键，单测测不到）

- [ ] **握手**：client 连上 `lrnev-mcp` stdio，不报错、不超时。
- [ ] **工具发现**：`listTools` 返回 **42 个**工具（v2.3/3.0.0 工具集均 42、无删改；含 `task_create_many`、`governance_map`、`lrnev_report`、`spec_update`；3.0.0 起 `--profile core` 时只注册 33 个，见"六、v3.0.0 新增验证面"）。
- [ ] **adr_suggest 已删**：列表里**没有** `adr_suggest`、也没有 `lock_acquire/lock_release/lock_list`。
- [ ] **新工具在**：`lrnev_hook_tail_log` 在列表里。
- [ ] **描述渲染**：每个工具 description 可见且含"何时用"。
- [ ] **会话稳定**：长对话多次调用不掉线、不串话。
- [ ] **资源（若暴露）**：`context://` 资源能 list/read。

---

## 三、完整生命周期黄金路径（端到端）

```
1. lrnev_init（不传名）   → .lrnev/ 骨架 + steering/ + auto/codebase.json + PROJECT/ARCHITECTURE 预填
2. scene_create          → 三文档 + followup 给出拆分标尺（见五）
3. spec_create user-login → 不传 scene 自动挂 00-default；生成 requirements/design/tasks
4. AI 填 requirements     → 替换所有 FILL 哨兵，填 L0/L1/L2
5. spec_gate_check ready  → 未填哨兵时 passed=false 并拦；填了 passed=true，followup 含 EARS 示范 + ADR 提示
6. task_create "实现登录" → validates=F-01 写入 meta
7. task_update in_progress → 自动 claim；followup 含"先回看 F-01"
8. task_update completed   → 状态机校验通过；自动 release
9. project_status         → 只返活任务 + 计数 + claimable_next，不随历史膨胀
10. spec_gate_check completion → 全任务完成才 passed=true
11. lrnev_doctor          → 无异常或仅预期 warning
```

---

> v2.1~v2.3 新增验证面（真机走查时重点）：`anchor_context`/`summary_context` 任务启动回填（task_update/task_claim 两入口）、需求审核门（ready 通过后的"请暂停"+ 无条件填 design 提示）、BM25 排序与锚点抽段、治理地图、`lrnev report` 治理债口径、register 机会式 GC（`data.gc` 字段）、`task_create_many` 原子批量与错误明细、`was_new` 以 PROJECT.md 判定。v2.3 三客户端盲测报告见 `E2E-REPORT-*-V23-2026-07-06.md`。

## 四、各能力域逐项（42 工具全覆盖，v2.3/3.0.0 工具集一致）

| 域 | 工具 | 看什么 |
|----|------|--------|
| 接入/引导 | `lrnev_init` `lrnev_guide` `project_status` `governance_map` `lrnev_report` | guide 四档都能返回；接手快照可读（含 claimable 预览截断说明）；治理地图全景；report 治理债口径 |
| Scene | `scene_create` `scene_list` `scene_get` | 序号自增、三文档、统计正确 |
| Spec | `spec_create` `spec_list` `spec_get` `spec_update` `spec_gate_check` | 三档 gate(creation/ready/completion)语义各自正确；状态机回填 |
| Task | `task_create` `task_create_many` `task_update` `task_list` `task_claim` `task_release` | 状态机、子任务 parent、claim/release；批量原子创建（key 依赖、整批拒绝、压缩返回，v2.3） |
| 目标评估 | `assess_goal` | single-spec / multi-spec-program / research-program 三类 |
| ADR | `adr_create` `adr_list` `adr_get` | scope(global/scene)、索引更新 |
| 错误手册 | `error_record` `error_search` `error_promote` | 指纹去重；incident→promoted 需 verification |
| 记忆 | `memory_save` `memory_search` `memory_forget` `session_commit` | source 必填、同类去重、批量沉淀 |
| 检索/摘要 | `context_search` `summarize_save` | 目录优先、L0/L1 |
| 多 Agent | `agent_register` `agent_heartbeat` `agent_list` `agent_unregister` | 注册/心跳/active-dead/注销 |
| Hooks | `lrnev_hook_list` `lrnev_hook_trigger` `lrnev_hook_enable` `lrnev_hook_disable` `lrnev_hook_tail_log` | 配置生效、手动触发、启停、读日志 |
| 诊断 | `lrnev_doctor` | 结构/断链/stale claim/hook/agent 检查 |

**多窗口防撞**（具体步骤）：
```
1. agent-A register + task_claim T-001
2. agent-B claim 同一 T-001 → 返回 conflict 软提示，不硬阻止
3. agent-C claim 同 Spec 的 T-002 → 成功，互不干扰
4. agent-A 心跳停止 → claim 过期
5. project_status → active_agents 显示活跃 claim；claimable_next 不含活跃 claim
```
**子任务并行**（具体步骤）：
```
1. task_create 父任务 → T-001
2. task_create 子任务1 --parent T-001
3. task_create 子任务2 --parent T-001
4. task_list → children 按创建顺序嵌套
5. 并发 update 两个子任务 → 不互相覆盖；全部完成时提示父任务可关闭
```

---

## 五、重点：08/09 新行为（v2.1~v2.3 期引入；此后各版发版前回归面）

- [ ] **scene_create 拆分标尺**：传含"以及/同时/多个/端到端"的 `intent` → followup 出现三条标尺(独立验收 / 共享验收标准 / 需否调研) + **multi 辅助信号** + 建议 `assess_goal`。
- [ ] 传单一特性 `intent` → single 信号，但**三条标尺仍在**。
- [ ] 不传 `intent` → followup 仍含三条标尺。
- [ ] **lrnev 不自动建 Spec**——只给文字引导。
- [ ] **task_create 子任务引导**：拆 task 节点 followup/描述提示"大项可用 `parent` 拆子任务"。
- [ ] **task_claim touches_files**：多 agent 上下文 → followup **提示声明 touches_files**；**单 agent 不提示**(不噪音)。声明后两窗口改同文件 → 出重叠警告(不阻止、不锁源码)。
- [ ] **adr_suggest 已删**：client 调不到、列表没有。
- [ ] **`.lrnev/` 目录分层**：config=hooks.json、state=hook-log、runtime/claims=占用，各归其位。

---

## 六、v3.0.0 新增验证面（scene04 标准化战役，2026-09-07 3.0.0 语境）

> 3.0.0 破坏性变更：`content[0].text` 不再是 JSON（机器数据改读 `structuredContent`）。以下清单项为 dev-docs 终审（2026-09-07）测试清单，发版前真机走查重点；对应回归见"十二、CI 可自动化的测试"的测试规模与 CHANGELOG 3.0.0 Tests 节。

- [ ] **双通道 MVC 文本**：每次工具调用 `content[0].text`（逐工具 ModelVisibleContract 渲染文本，含角色前缀行）与 `structuredContent`（canonical 信封 `response_version:'1'`/`ok`/`data`/`errors`/`ai_followup`）内容一致；`tools/list` 全工具带 `outputSchema`；曾 `JSON.parse(content[0].text)` 的接入方迁到 `structuredContent` 后行为不变。
- [ ] **isError 统一**：`ok:false` 业务拒绝（参数错误、状态机冲突、歧义引用 AMBIGUOUS_REF、内部错误）一律 `isError:true`——AMBIGUOUS_REF 不再被客户端误判成功。
- [ ] **错误路径统一转义**（D-04.1 防注入契约）：错误 message/hint 含用户可控文本时经统一转义出口（错误路径不再绕过转义）。
- [ ] **decision_context 负向校验**：`scene_create`/`spec_create`/`task_create`/`assess_goal` 传 `decision_context`——`explicit`/`preferred` 缺 `direction` 或 `unspecified` 带 `direction` → `INVALID_INPUT` 拒绝，模型据错误自纠后成功；不传 = 未声明，行为与旧版一致；不落盘、不阻断。
- [ ] **`--profile core|full` 集合差**：默认 `full` 注册 42 工具（与 2.3.0 一致）；`core` 注册 33 = `full` − `agent_*` 自动面 4 + `lrnev_hook_*` 配置面 5 共 9 个"AI 不该主动选"工具；`tools/list` 断言两档集合差恰为这 9 个；`core` 下对应工具不可调、其余行为不受影响。
- [ ] **spec_get 分层引导 + 归档边界**：未完成 Spec 的 `spec_get` 给"开发/扩展请求先 `task_create` 登记"【决策边界】引导；archived 为终态、只由用户决定——用户改主意不构成自动归档依据（G5 归档边界，B4 真机验证归档率 4/5→0/5）。
- [ ] **工具描述档位标记**：工具 description 带 `[核心]/[自动]/[配置]` 档位标记，与 `--profile` 分层一致（模型可判断"该不该主动选"）。

## 七、边界与错误处理（自救体验）

- [ ] **ready gate 未过**：checks 含 name/message/**hint**，AI 能照 hint 修。
- [ ] **非法状态跃迁**(pending 直接 completed) → `INVALID_STATUS_TRANSITION` + 可读 hint。
- [ ] **AMBIGUOUS_REF**(scene/spec 简写有歧义) → 返回 candidates，AI 选完整 id 重试。
- [ ] **completion gate 未过**(有未完成 task) → 提示去 task_list 找未完成项，不强行标完成。
- [ ] **文件缺失/broken** → doctor 能报 + 给修复路径。

---

## 八、真实环境特性（单测 mock 不了）

- [ ] **真实项目 init**：在有真实 `package.json`/`go.mod` 的项目里 init → AutoAnalyzer 探到技术栈、预填 ARCHITECTURE。
- [ ] **BOM/编码**：Windows 下 init 真实文件 → 不再解析失败(本轮已修)。
- [ ] **路径大小写**：Linux/Mac 上 import 大小写一致(跨平台能测最好)。
- [ ] **CLI vs MCP 一致**：同一能力 `lrnev xxx` 命令与 MCP 工具行为一致。
- [ ] **旧项目零负担接入**：cd 一个无 `.lrnev/` 的存量项目 → `lrnev init` 只建最小骨架，不要求为历史代码补建 Scene/Spec，可直接 spec_create。

---

## 九、体验层（AI 视角，最能暴露问题）（v2.1~v2.3 期累积；3.0.0 回归面——常驻提示模板自 3.0.0 起单源化于 docs/AI-ADAPTATION.md，含 --profile A/B 两版）

- [ ] **ai_followup 真驱动**：写工具返回后，AI 是否**真按 followup 的下一步走**(而非空转/乱来)。
- [ ] **接手连贯**：新会话只调 `project_status` 能接着干。
- [ ] **长对话不忘**：贴了常驻提示模板（docs/AI-ADAPTATION.md，3.0.0 起单源）后，压缩多轮 AI 仍记得用 lrnev。
- [ ] **不确定时**：AI 卡住调 `lrnev_guide` 能否自救。

---

## 十、多模型验证矩阵

| 模型 | 黄金路径(三) | 接手 | 多窗口 | 新行为(五) | 备注 |
|------|------|------|--------|------|------|
| Claude | | | | | |
| GPT-4o | | | | | |
| GPT-4o-mini | | | | | |
| 本地模型 | | | | | |

---

## 十一、性能基准（参考）

| 场景 | 目标 | 实测 |
|------|------|------|
| `project_status` | < 500ms | |
| `spec_gate_check` | < 100ms | |
| `task_update` | < 200ms | |
| `context_search`(1000 文件项目) | < 1s | |

---

## 十二、CI 可自动化的测试

每次 `npm test` 覆盖：
- 测试规模：以 `npm test` 实跑输出为准（**3.0.0 实测为 81 个测试文件、1076 条**；v2.3 审计整改后为 46 个测试文件、692 条）。
- 覆盖：所有 Manager、MCP 协议、CLI、并发、状态机、gate、agent 心跳、hooks、guide。
- 执行：`npm test`；构建：`npm run build`(应零警告)。

> 注意：本清单(协议层、ai_followup 驱动、真机体验)是 CI **测不到**的部分，必须在真实客户端手动走一遍才算 F-14 通过。
