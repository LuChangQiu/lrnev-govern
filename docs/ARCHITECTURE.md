# 源码结构说明

> 适用于：`lrnev-govern/`（npm 包 `lrnev`）
> 参考依据：
> - 官方 MCP servers 仓库（`research/P2_26_MCP-servers/src/everything/` 模式）
> - 本仓库当前源码结构
> - claude-code 命名风格

---

## 设计原则

1. **core 是唯一业务逻辑层**：MCP 和 CLI 都是薄包装。
2. **文件系统是唯一真相**：不引入 SQLite 或其他数据库。
3. **零模型依赖**：不调任何 LLM/Embedding API；需要“理解”的工作通过 `ai_followup` 协议回传给客户端 AI。
4. **双形态对等**：MCP 能做的 CLI 也能做，同一份 core 承载行为。
5. **确定性归 lrnev，判断性归 AI**：lrnev 只做结构契约、ID、状态机、声明和文件读写；质量判断、任务拆分和分流建议交给客户端 AI。

治理流程细节见 [GOVERNANCE-FLOW.md](./GOVERNANCE-FLOW.md)，包括 gate 语义、`<!-- FILL -->` 哨兵、状态机、`project_status`、默认 Scene、adopt、以及与 OpenViking 的边界。

---

## 目录树

```text
lrnev-govern/
├── bin/                            # 可执行入口，npm install -g 后链到 PATH
│   ├── lrnev.mjs                   # CLI 命令：lrnev
│   └── lrnev-mcp.mjs               # MCP 服务命令：lrnev-mcp
│
├── src/
│   ├── core/                       # 业务逻辑层，供 MCP 和 CLI 共用
│   │   ├── index.ts                # core 统一导出
│   │   ├── ADRManager.ts
│   │   ├── AgentRegistry.ts
│   │   ├── AutoAnalyzer.ts
│   │   ├── ClaimStore.ts
│   │   ├── Doctor.ts
│   │   ├── ErrorbookManager.ts
│   │   ├── GateRunner.ts
│   │   ├── GoalAssessor.ts
│   │   ├── HookLog.ts
│   │   ├── HookManager.ts
│   │   ├── HookRunner.ts
│   │   ├── LegacyTodoMigration.ts
│   │   ├── MemoryManager.ts
│   │   ├── ProjectStatus.ts
│   │   ├── GovernanceMap.ts         # 治理地图：scene→spec(状态/L0)→锚点标题 全景（v2.1）
│   │   ├── SceneManager.ts
│   │   ├── Searcher.ts              # 目录优先检索：BM25 排序 + 锚点段抽取（v2.1）
│   │   ├── SessionCommit.ts
│   │   ├── SpecManager.ts
│   │   ├── Summarizer.ts           # 不调 LLM，只组装 ai_followup
│   │   ├── TaskManager.ts
│   │   ├── Templates.ts
│   │   └── WorkspaceManager.ts
│   │
│   ├── storage/                    # 存储层，封装文件系统读写和 Markdown/frontmatter 解析
│   │   ├── index.ts
│   │   ├── FileStorage.ts
│   │   ├── FrontmatterCodec.ts
│   │   ├── MarkdownParser.ts
│   │   ├── URIRouter.ts            # context:// URI 到文件路径
│   │   └── WorkspaceLocator.ts     # 定位 `.lrnev` 工作区
│   │
│   ├── mcp/                        # MCP 协议层
│   │   ├── server.ts               # Server 实例、capabilities、stdio transport
│   │   ├── guidance.ts             # 工具说明、使用提示和错误后续动作
│   │   ├── tools/
│   │   │   └── index.ts            # 注册所有 MCP tools
│   │   └── resources/
│   │       ├── index.ts            # 注册 context:// resources
│   │       └── handlers.ts         # resource handler 实现
│   │
│   ├── cli/                        # CLI 层
│   │   ├── index.ts                # commander 入口和子命令注册
│   │   └── index.ts                # CLI command 入口
│   │
│   ├── types/                      # 共享类型定义
│   │   ├── adr.ts
│   │   ├── agent.ts
│   │   ├── auto-analyzer.ts
│   │   ├── claim.ts
│   │   ├── doctor.ts
│   │   ├── errorbook.ts
│   │   ├── gate.ts
│   │   ├── goal.ts
│   │   ├── hooks.ts
│   │   ├── legacy-todo.ts
│   │   ├── memory.ts
│   │   ├── project-status.ts
│   │   ├── response.ts
│   │   ├── scene.ts
│   │   ├── search.ts
│   │   ├── spec.ts
│   │   ├── summary.ts
│   │   ├── task.ts
│   │   ├── templates.ts
│   │   └── workspace.ts
│   │
│   └── shared/                     # 跨模块共享
│       ├── config.ts               # 可调阈值、默认限制和契约常量
│       ├── errors.ts               # 错误码和 LrnevError
│       ├── paths.ts                # 目录和文件名约定
│       └── version.ts              # 版本号读取
│
├── templates/                      # Markdown / JSON 模板
│   ├── scene/
│   ├── spec/
│   ├── adr/
│   └── steering/
│
├── tests/
│   ├── unit/                       # 单元测试
│   ├── integration/                # 临时目录跑完整工作流
│   ├── e2e/                        # 真实 MCP / CLI 子进程
│   └── fixtures/                   # 测试样板项目
│
├── docs/                           # 面向用户的说明
├── examples/                       # 可运行样例项目
├── package.json                    # name: lrnev, bin: lrnev + lrnev-mcp
├── tsconfig.json                   # ES2022 + NodeNext + strict
├── vitest.config.ts                # 测试配置
└── README.md
```

---

## 与官方 MCP servers 仓库的对照

对照 `research/P2_26_MCP-servers/src/everything/` 的组织方式：

| 官方 everything | 我们 | 说明 |
|----------------|------|------|
| `index.ts`（入口） | `bin/lrnev-mcp.mjs` + `src/mcp/server.ts` | npm bin 负责启动，MCP server 在源码内组装 |
| `server/` | `src/mcp/server.ts` | 当前 stdio transport 直接在 server 入口内连接 |
| `tools/` | `src/mcp/tools/index.ts` | 当前工具集中注册；业务逻辑仍下沉到 core |
| `resources/` | `src/mcp/resources/` | `index.ts` 负责注册，`handlers.ts` 负责读取资源 |
| `prompts/` | 暂无 | 当前不暴露 MCP prompts |
| `transports/{sse,stdio,streamableHttp}` | `src/mcp/server.ts` | 当前只提供 stdio |
| `__tests__/` | `tests/` | 顶层目录，方便覆盖 unit/integration/e2e |

**额外多出来的层**：`core/` 和 `storage/`。
原因：官方 everything 是示例项目，业务很薄；lrnev-govern 要做真实治理服务，必须有独立业务层和文件系统存储层。

---

## 文件命名约定

| 类型 | 风格 | 例子 |
|------|------|------|
| 类（Manager / Store / Runner） | PascalCase | `TaskManager.ts` |
| 功能聚合文件 | kebab-case | `auto-analyzer.ts` |
| MCP tools / CLI commands 聚合入口 | index.ts | `src/mcp/tools/index.ts` |
| 测试文件 | `<被测>.test.ts` | `task-manager.test.ts` |

---

## 注释约定

- 公开 API 必须有 JSDoc 中文注释，说明 **做什么 + 为什么 + 何时调用**。
- 文件顶部必须有用途说明块。
- 复杂算法上方加段落注释解释思路。
- 注释一律使用中文（除了必须英文的 API 引用 / URL）。
