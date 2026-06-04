# 贡献指南

感谢对 lrnev 的关注。以下说明帮助你提交高质量的 PR。

## 项目原则(PR 前必读)

- **确定性归 lrnev,判断归 AI**:不新增 lrnev 替 AI 判断的能力(如不给生态堆 parser、不加自动拆分 Spec)。给信号和引导,把判断留给客户端 AI。
- **零模型依赖**:lrnev 不调任何 LLM / embedding API。
- **文件即真相**:所有数据存 Markdown/JSON,不引入数据库。
- **MCP + CLI 对等**:新增能力必须同时提供 MCP 工具和 CLI 子命令,参数与行为一致。

## 本地调试

```bash
git clone https://github.com/LuChangQiu/lrnev-govern.git
cd lrnev-govern
npm install

# 构建
npm run build

# 跑全部测试
npm test

# 本地 CLI
npm run lrnev -- init --project-name demo
npm run lrnev -- status

# 本地 MCP 服务(stdio)
node bin/lrnev-mcp.mjs
```

## 代码规范

- **文件命名**:core/storage 层用 PascalCase(如 `ClaimStore.ts`);types/shared/mcp/cli 用小写(如 `errors.ts`/`config.ts`)。
- **类型**:禁止 `any`/`as any`,该标的类型都要标。
- **错误处理**:统一走 `LrnevError` + `ErrorCode`,带可操作 `hint`;禁止裸 `throw new Error()`。
- **配置**:可调阈值(超时/TTL/条数/深度)进 `src/shared/config.ts`;契约值(ID 格式/目录名/状态机/错误码)写死在代码里。
- **注释**:非显而易见的 WHY 要写;不要复述代码的 WHAT。

## Commit 格式

```
<type>: <简短描述>

<详细说明(可选)>
```

类型:`feat`(新功能)、`fix`(修 bug)、`docs`(文档)、`refactor`(重构)、`test`(测试)、`chore`(构建/工具)。

## PR 流程

1. Fork 本仓库
2. 建分支:`feat/something` 或 `fix/something`
3. 改代码 + 跑 `npm test` 全绿 + `npm run build` 零警告
4. 如有新功能,补测试
5. 提交 PR,标题写清楚做了什么、为什么

## 行为准则

- 保持专业和友善
- 就事论事讨论代码
- 尊重项目原则(尤其不要 PR 里加 LLM 调用或数据库依赖)

## 许可证

MIT。提交 PR 即表示你同意将代码以 MIT 许可证发布。
