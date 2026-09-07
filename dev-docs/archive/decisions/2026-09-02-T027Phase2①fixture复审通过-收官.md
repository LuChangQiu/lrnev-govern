# T-027 Phase 2 ① fixture 复审通过（收官）→ ②③ 开工

- **日期**: 2026-09-02
- **作者**: DeepSeek（审查方）
- **复审对象**: 提交 `d7b7110`（E-07/E-11 话术-期望错位修正）
- **复审方式**: diff 通读 + typecheck 复跑 + 全量测试独立复跑
- **结论**: ✅ **通过，Phase 2 ① fixture 权威源收官**。12 场景 .ts fixture 为单一真相源，话术-期望自洽，盲测隔离声明就位。

## 独立复跑证据（2026-09-02）

- 全量测试：**869/869 通过（68 文件）**；
- typecheck：仅报**已知遗留** `task-create-many.ts(19,22) TS2339 errors`（统一全面审查预埋项，与本次无关，非本批引入）。

## d7b7110 逐项确认

| 项 | 状态 | 证据 |
|---|---|---|
| E-07 userInput 改代码语境 | ✅ | `'登录页有 bug，不建 Spec 了，直接改代码'`——与 design D-01 ⑧ 一致，AI 有落位动机被用户拒绝，可测 no_spec 张力 |
| E-07 decisionContext | ✅ | user_intent='fix bug directly, no spec'；注释与输入自洽 |
| E-11 userInput other 自然请求 | ✅ | `'帮我分析一下现有的登录流程有什么问题'`——方向枚举外请求 |
| E-11 decisionContext | ✅ | scene 改 '01-user-management'（分析登录流程语境）；user_intent='analysis request…' |
| 测试断言同步 | ✅ | e07.test L20→'不建 Spec'；e11.test L20→'分析' + L49-50 scene/user_intent |
| README 修订说明 | ✅ | 已更新 |

话术双向自洽确认：E-07（no_spec 改代码拒绝）↔ E-11（other 分析请求）**可区分**，且各自与 expectedDecisionContext 匹配。

## 非阻塞建议（P2，Phase 2 ② 开发时顺手）

- `e07.ts` 新增字段 `ai_would_suggest` 不在 types.ts DecisionContext 内（0 命中）——tests 目录被 tsconfig exclude（`include: ["src/**/*.ts"]`），无类型门禁故未报错。建议复用 types.ts 既有同义字段 `ai_recommendation`（语义一致），保持 fixture 决策上下文字段与类型契约一致，harness 消费时不混淆。
- 若有意让 tests 纳入类型门禁，可加 `tsconfig.test.json`（`include: ["tests/**/*.ts", "src/**/*.ts"]`）——属工程卫生，列入统一全面审查候选，不在本批。

## Phase 2 ②③ 开工指示（给 Claude）

1. **② clean session harness**（核心审查点）：
   - 消费 `tests/fixtures/04-00/*.ts`（FixturesDefinition）：**prompt 组装只读 userInput**（多轮场景按轮次结构分轮注入：E-05 两轮、E-06a 一次注入近似、**E-06b 必须分轮**——先注入第一轮等 AI 完成 spec_create 再注入第二轮）；
   - **不得注入 expectedDecisionContext/expectedAction 等任何期望字段**（禁读声明 README 已就位）；
   - fixture 工作区构建器：按 decisionContext（scene/existing_specs/spec_count/last_update/status）在独立临时工作区构建真实 .lrnev 状态（spec 内容需使服务端 guidance 方向符合场景前提——构建后可用 assess_goal/spec_get 预检工作区状态与场景前提一致，防"场景前提失效"）；
   - 双 SHA（A=45a86e15 / B=6383e99）各独立 worktree 快照（wrapper 已支持），每场景每 SHA 5 次重复 = clean session；
   - 全量录制：工具调用序列、服务端 stdout/stderr、最终动作——落 24 字段契约（b2b-evidence-manifest.json 参照）。
2. **③ 客户端真实 headless 接入冒烟**：Claude Code 优先（`--mcp-config` 隔离加载，勿污染项目 .mcp.json）；验证 headless 下 MCP 工具真实可用（`claude -p` 已知坑）；Codex/OpenCode 按实测格式接入。
3. 完成报告附：harness 设计要点、1 次真实会话录制样例、接入冒烟结果——报 DeepSeek 复审后再放量 5 轮。

**时序红线重申**：双 SHA 放量对照必须在 05-00 合入前完成；SHA B 固定 6383e99 快照。
