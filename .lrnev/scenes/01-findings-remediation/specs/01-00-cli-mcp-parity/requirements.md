---
spec: 01-00-cli-mcp-parity
scene: 01-findings-remediation
status: ready
priority: P1
created: '2026-06-11'
updated: '2026-06-12'
---

# 01-00 Cli Mcp Parity - 需求

> 权威依据：`dev-docs/FINDINGS-CHECKLIST.md`（最终决定表 I-1/I-2/I-3）+ `dev-docs/CLAUDE-INTEGRATION-TEST-2026-06-11.md`（A3 / D3 / D6 复现）。实现前回查，勿凭记忆。

## L0 摘要

补齐 CLI 相对 MCP 缺失的三处能力：spec_get 的“开新版”引导、task create 的 --depends-on、adr create 的 --supersedes，让“同一能力两条路都能走”的契约真正成立。

## L1 概览

### 目标

消除 CLI/MCP 能力不对等。README 宣称“MCP 工具名跟 CLI 子命令一一对应，同一能力两条路都能走”，但实测三处 CLI 缺口：`spec get` 无开新版引导、`task create` 无 --depends-on（传了静默吞）、`adr create` 无 --supersedes。本 Spec 把这三处补齐，并优先以“逻辑下沉 core、两路共用”根治同类问题。

### 用户故事

- 作为用 CLI（而非 MCP）驱动 lrnev 的用户，我希望 CLI 子命令与 MCP 工具能力一致，以便不因选了哪条通道而丢失引导或参数。

### 范围

**包含**：
- I-1：`spec_get` 对“已有实现的 spec 建议开新版”的 guidance（现仅 MCP `tools/index.ts:specGetWithGuidance`）下沉到 core 共享层，CLI 与 MCP 都调用。
- I-2：CLI `task create` 补 `--depends-on <ids...>` 并透传；**保留 `allowUnknownOption()`**（被 `cli.test.ts:115` dashTitle 用例依赖），加回归测试确保 `--depends-on` 被正确解析、且标题以 `--` 开头仍可用。
- I-3：CLI `adr create` 补 `--supersedes <nums...>` 并透传（直接补，不等 I-17）。

**不包含**：
- depends_on 的存在性硬拒（S2 / I-7）与依赖未完成提醒（S3）——本 Spec 只让参数“传得进”。
- supersedes 是否回写旧 ADR / 读时计算 superseded_by（S5 / I-17）——本 Spec 只让 CLI 能传该参数。
- spec_get guidance 的内容本身不改，只改“CLI 也能拿到”。

## L2 详情

### 详细需求

#### F-01 spec_get 开新版引导下沉 core 两路共用
- 描述：把 MCP 侧 `specGetWithGuidance`（对已有实现的 spec 追加“考虑 spec_create --version 开新版”提示）的判定逻辑抽到 core 的共享 guidance builder；CLI `spec get` 与 MCP `spec_get` 都调用它，输出形态各自包装。
- 验收：
  - WHEN 对一个 status=completed（或有 completed task）的 spec 跑 CLI `spec get` THEN 返回含“考虑开新版”的 ai_followup（与 MCP 一致）。
  - WHEN 对未实现的 spec 跑 CLI `spec get` THEN 不追加该提示（与 MCP 现有零噪音行为一致）。

#### F-02 CLI task create 支持 --depends-on
- 描述：CLI `task create` 增加 `--depends-on <ids...>` 选项并透传给 `tasks.create`；不删除 `allowUnknownOption()`，新增回归测试同时覆盖“--depends-on 被解析”与“标题以 -- 开头仍可用”。
- 验收：
  - WHEN CLI `task create ... --depends-on T-001 T-002` THEN 创建的 task 的 depends_on 含 T-001、T-002（不再静默为空）。
  - WHEN CLI `task create "--scan 改占位"`（标题以 -- 开头）THEN 标题仍被正确解析为该字符串（现有 dashTitle 行为不回归）。

#### F-03 CLI adr create 支持 --supersedes
- 描述：CLI `adr create` 增加 `--supersedes <nums...>` 选项并透传给 `adrs.create`，与 MCP 对齐。
- 验收：
  - WHEN CLI `adr create ... --supersedes 1 2` THEN 新 ADR 记录 supersedes [1,2]（与 MCP 行为一致；是否回写旧 ADR 属 I-17，不在此）。

### 非功能性需求

- 性能：纯参数/调用层改动，无新增 IO。
- 兼容性：不改变现有 CLI 其它行为；`allowUnknownOption()` 保留，dashTitle 能力不回归。

### 边界与依赖

- I-1 的 core 下沉是后续避免同类不对等的根治手段，优先于“CLI 各自复制一份 guidance”。
- 依赖既有 `SpecManager` / `tasks.create` / `adrs.create` 接口。

### 验收标准

<!-- 最初失败信号 / 期望结果 -->
最初失败信号：A3 中 CLI spec get 对已完成 spec 无开新版引导；D3 中 CLI task create --depends-on 被静默吞；D6 中 CLI adr create 无 --supersedes。期望结果：三处补齐，两路能力一致，旧行为不回归。
- [ ] CLI spec get 对已实现 spec 返回开新版引导，逻辑与 MCP 共用 core。
- [ ] CLI task create --depends-on 生效；dashTitle 不回归；有回归测试。
- [ ] CLI adr create --supersedes 生效，与 MCP 对齐。
- [ ] `npm test` 全绿无回归。
