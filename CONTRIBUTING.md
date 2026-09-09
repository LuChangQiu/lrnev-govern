# 贡献指南

感谢对 lrnev 的关注。以下说明帮助你提交高质量的 PR。

## 项目原则（PR 前必读）

- **确定性归 lrnev，判断归 AI**：不新增 lrnev 替 AI 判断的能力（如不给生态堆 parser、不加自动拆分 Spec）。给信号和引导，把判断留给客户端 AI。
- **零模型依赖**：lrnev 不调任何 LLM / embedding API。
- **文件即真相**：所有数据存 Markdown/JSON，不引入数据库。
- **MCP + CLI 对等**：新增能力必须同时提供 MCP 工具和 CLI 子命令，参数与行为一致。

## 本地调试

前置要求：**Node.js ≥ 20**（见 `package.json` 的 `engines` 字段；版本过低请先升级）。

```bash
git clone https://github.com/LuChangQiu/lrnev-govern.git
cd lrnev-govern
npm ci              # 推荐：按 package-lock.json 安装锁版本依赖；没有 lock 时首次用 npm install

# 发布门禁（提交前全部要过）
npm run typecheck        # src 类型检查：0 错误
npm run typecheck:test   # 测试代码类型检查：0 错误（tsconfig.test.json）
npm test                 # 全量测试全绿
npm run build            # tsc 编译到 dist/，零警告

# 本地 CLI（bin 走 dist，需先 npm run build）
node bin/lrnev.mjs init --project-name demo
node bin/lrnev.mjs status

# 本地 MCP 服务（stdio）
node bin/lrnev-mcp.mjs
```

## 代码规范

- **文件命名**：core/storage 层用 PascalCase（如 `ClaimStore.ts`）；types/shared/mcp/cli 用小写（如 `errors.ts`/`config.ts`）。例外：`src/core/decision-context.ts`、`src/core/guidance-semantics.ts` 是 05-00 引入的 kebab-case 纯函数模块（历史产物，治理档案引用其文件名，**保持原名不改**）；新文件的纯函数模块按所在层规则命名。
- **类型**：禁止 `any`/`as any`，该标的类型都要标。
- **错误处理**：统一走 `LrnevError` + `ErrorCode`，带可操作 `hint`；禁止裸 `throw new Error()`。
- **配置**：可调阈值（超时/TTL/条数/深度）进 `src/shared/config.ts`；契约值（ID 格式/目录名/状态机/错误码）写死在代码里。
- **注释**：非显而易见的 WHY 要写；不要复述代码的 WHAT。

## Commit 格式

```
<type>: <简短描述>

<详细说明（可选）>
```

类型：`feat`（新功能）、`fix`（修 bug）、`docs`（文档）、`refactor`（重构）、`test`（测试）、`chore`（构建/工具）。

## PR 流程

1. Fork 本仓库
2. 建分支：`feat/something` 或 `fix/something`
3. 改代码 + 发布门禁全过：`npm run typecheck`（src 0 错误）+ `npm run typecheck:test`（测试代码 0 错误）+ `npm test` 全绿 + `npm run build` 零警告
4. 如有新功能，补测试（测试代码同样受 `typecheck:test` 类型门禁约束）
5. 提交 PR，标题写清楚做了什么、为什么

## 行为准则

- 保持专业和友善
- 就事论事讨论代码
- 尊重项目原则（尤其不要 PR 里加 LLM 调用或数据库依赖）

## 给 AI 协作者与自动化工具的指引

提出架构或功能建议前，**先读治理档案再开口**——本项目大量"看起来缺的东西"已在档案中被实现或明确拒绝：

1. `.lrnev/decisions/adr/` —— 本项目自身治理的架构决策（含 superseded 状态）
2. `dev-docs/decisions/` —— 审定决策档案；尤其 **2026-09-07 的「3.1 路线裁决」**：Verify/Eval、git 执法环、自动记忆沉淀（.project/、Project Historian、每日自动 Memory Commit）等候选已被评估并裁决不立项
3. `.lrnev/scenes/` —— 既有 spec 是否已承接该方向

若发现"已有等价物"或"已被明确拒绝"，请在建议/PR 描述里引用对应档案，而不是重新发明。这既是规则也是演示：lrnev 用它自己治理自己。

## 许可证

MIT。提交 PR 即表示你同意将代码以 MIT 许可证发布。
