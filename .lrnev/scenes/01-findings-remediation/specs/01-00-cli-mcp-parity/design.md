---
spec: '01-00-cli-mcp-parity'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 01-00 Cli Mcp Parity - 设计

## L0 摘要

把 MCP 独有的 spec_get 开新版引导下沉到 core 共享层供两路复用，CLI task create / adr create 补齐 --depends-on / --supersedes 两个透传参数（core 已支持，仅 CLI 缺入口）。

## L1 概览

### 架构思路

- 能力对等优先“逻辑下沉 core”而非“CLI 复制一份”，从根上杜绝再次漂移。
- I-2/I-3 经核实 core 已支持（`tasks.create` 接受 depends_on、`ADRManager.create` 接受 supersedes），CLI 只是没暴露参数——纯透传，工作量极小。

### 主要模块

- `src/core/SpecManager.ts`：新增共享 guidance 逻辑（从 `mcp/tools/index.ts:740 specGetWithGuidance` 下沉）。
- `src/mcp/tools/index.ts`：spec_get 改调下沉后的共享逻辑。
- `src/cli/index.ts`：spec get 接入同一逻辑；task create 加 `--depends-on`；adr create 加 `--supersedes`。

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| spec_get 引导落点 | (a)下沉 core helper (b)CLI 复制一份 | **(a)下沉** | 否 |
| allowUnknownOption 处理 | (a)保留+加回归测试 (b)删除 | **(a)保留** | 否 |
| I-3 是否等 I-17 | 直接补，不等（core 已支持 supersedes 写入） | 直接补 | 否 |

> 核实结论：`CreateADRInput.supersedes` 已存在并写入 frontmatter（`ADRManager.ts:190`）；`tasks.create` 已接受 `depends_on`。故 I-2/I-3 纯属 CLI 入口缺失，core 无需改。
> allowUnknownOption 陷阱：`cli.test.ts:115` dashTitleTask 依赖标题可 `--` 开头，不能删 `allowUnknownOption()`；加 `--depends-on` 后须加回归测试同时覆盖“依赖被解析”与“dash-title 不回归”。

## L2 详情

### 模块详细设计

> 本段用 `#### D-xx` 标注设计锚点（供 task --validates 引用）。

#### D-01 spec_get 开新版引导下沉 core
- 把 `specGetWithGuidance`（判定 spec 已有实现→追加“考虑 spec_create --version”提示）的核心判定从 `mcp/tools` 抽到 core（SpecManager 方法或同模块 helper，如 `SpecManager.getWithGuidance` / 共享 `buildSpecGetFollowup`）。
- MCP `spec_get` 与 CLI `spec get` 都调用它；输出形态各自包装（MCP 走 toToolResult，CLI 走 format）。

#### D-02 CLI task create 加 --depends-on
- `buildTaskCommand` 的 create 子命令加 `.option('--depends-on <ids...>', ...)`，透传给 `tasks.create({ depends_on })`。
- **不删 `allowUnknownOption()`**；新增回归测试：`--depends-on T-001` 被解析进 depends_on，且标题 `--scan 改占位` 仍正确解析。

#### D-03 CLI adr create 加 --supersedes
- `buildAdrCommand` 的 create 子命令加 `.option('--supersedes <nums...>', ...)`，透传给 `adrs.create({ supersedes })`。core 已支持，无需改 ADRManager。

### 数据模型

无新增数据结构。仅 CLI 参数透传 + guidance 逻辑搬家。

### 接口契约

- CLI `spec get` 返回结构与 MCP 一致（含 ai_followup）。
- CLI `task create --depends-on`、`adr create --supersedes` 与 MCP 对应工具语义一致。

### 错误处理

- 沿用既有错误处理；新参数为可选，不传时行为不变。

### 测试策略

- 单元（cli.test.ts）：spec get 对已实现 spec 含开新版引导；task create --depends-on 生效 + dash-title 不回归；adr create --supersedes 写入。
- 单元（mcp-server.test.ts）：spec_get 走下沉逻辑后行为不变（回归）。
- 全量 `npm test` 绿。
