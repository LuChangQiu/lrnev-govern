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
- [ ] **工具发现**：`listTools` 返回 **38 个**工具。
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

## 四、各能力域逐项（38 工具全覆盖）

| 域 | 工具 | 看什么 |
|----|------|--------|
| 接入/引导 | `lrnev_init` `lrnev_guide` `project_status` | guide 四档(workflow/tools/errors/concepts)都能返回；接手快照可读 |
| Scene | `scene_create` `scene_list` `scene_get` | 序号自增、三文档、统计正确 |
| Spec | `spec_create` `spec_list` `spec_get` `spec_gate_check` | 三档 gate(creation/ready/completion)语义各自正确 |
| Task | `task_create` `task_update` `task_list` `task_claim` `task_release` | 状态机(pending→in_progress→completed/failed/blocked)、子任务 parent、claim/release |
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

## 五、重点：08/09 新行为（刚加的，务必真机验）

- [ ] **scene_create 拆分标尺**：传含"以及/同时/多个/端到端"的 `intent` → followup 出现三条标尺(独立验收 / 共享验收标准 / 需否调研) + **multi 辅助信号** + 建议 `assess_goal`。
- [ ] 传单一特性 `intent` → single 信号，但**三条标尺仍在**。
- [ ] 不传 `intent` → followup 仍含三条标尺。
- [ ] **lrnev 不自动建 Spec**——只给文字引导。
- [ ] **task_create 子任务引导**：拆 task 节点 followup/描述提示"大项可用 `parent` 拆子任务"。
- [ ] **task_claim touches_files**：多 agent 上下文 → followup **提示声明 touches_files**；**单 agent 不提示**(不噪音)。声明后两窗口改同文件 → 出重叠警告(不阻止、不锁源码)。
- [ ] **adr_suggest 已删**：client 调不到、列表没有。
- [ ] **`.lrnev/` 目录分层**：config=hooks.json、state=hook-log、runtime/claims=占用，各归其位。

---

## 六、边界与错误处理（自救体验）

- [ ] **ready gate 未过**：checks 含 name/message/**hint**，AI 能照 hint 修。
- [ ] **非法状态跃迁**(pending 直接 completed) → `INVALID_STATUS_TRANSITION` + 可读 hint。
- [ ] **AMBIGUOUS_REF**(scene/spec 简写有歧义) → 返回 candidates，AI 选完整 id 重试。
- [ ] **completion gate 未过**(有未完成 task) → 提示去 task_list 找未完成项，不强行标完成。
- [ ] **文件缺失/broken** → doctor 能报 + 给修复路径。

---

## 七、真实环境特性（单测 mock 不了）

- [ ] **真实项目 init**：在有真实 `package.json`/`go.mod` 的项目里 init → AutoAnalyzer 探到技术栈、预填 ARCHITECTURE。
- [ ] **BOM/编码**：Windows 下 init 真实文件 → 不再解析失败(本轮已修)。
- [ ] **路径大小写**：Linux/Mac 上 import 大小写一致(跨平台能测最好)。
- [ ] **CLI vs MCP 一致**：同一能力 `lrnev xxx` 命令与 MCP 工具行为一致。
- [ ] **旧项目零负担接入**：cd 一个无 `.lrnev/` 的存量项目 → `lrnev init` 只建最小骨架，不要求为历史代码补建 Scene/Spec，可直接 spec_create。

---

## 八、体验层（AI 视角，最能暴露问题）

- [ ] **ai_followup 真驱动**：写工具返回后，AI 是否**真按 followup 的下一步走**(而非空转/乱来)。
- [ ] **接手连贯**：新会话只调 `project_status` 能接着干。
- [ ] **长对话不忘**：贴了常驻提示模板(见 AI-ADAPTATION)后，压缩多轮 AI 仍记得用 lrnev。
- [ ] **不确定时**：AI 卡住调 `lrnev_guide` 能否自救。

---

## 九、多模型验证矩阵

| 模型 | 黄金路径(三) | 接手 | 多窗口 | 新行为(五) | 备注 |
|------|------|------|--------|------|------|
| Claude | | | | | |
| GPT-4o | | | | | |
| GPT-4o-mini | | | | | |
| 本地模型 | | | | | |

---

## 十、性能基准（参考）

| 场景 | 目标 | 实测 |
|------|------|------|
| `project_status` | < 500ms | |
| `spec_gate_check` | < 100ms | |
| `task_update` | < 200ms | |
| `context_search`(1000 文件项目) | < 1s | |

---

## 十一、CI 可自动化的测试

每次 `npm test` 覆盖：
- 测试规模：以 `npm test` 实跑输出为准（当前约 39 个测试文件、520+ 条）。
- 覆盖：所有 Manager、MCP 协议、CLI、并发、状态机、gate、agent 心跳、hooks、guide。
- 执行：`npm test`；构建：`npm run build`(应零警告)。

> 注意：本清单(协议层、ai_followup 驱动、真机体验)是 CI **测不到**的部分，必须在真实客户端手动走一遍才算 F-14 通过。
