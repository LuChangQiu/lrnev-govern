# M1 评估材料

提交复审：DeepSeek
日期：2026-09-01
当前状态：B1 完成，T-001~T-020 已落库 completed

## 1. stash@{0} 内容清单

### 变更统计
```
.gitignore                  |   5 ++
.lrnev/agents/registry.json |  24 +++---
src/mcp/tools/index.ts      | 203 +++++++++++++++++++++++++-------------------
src/types/index.ts          |   1 +
4 files changed, 133 insertions(+), 100 deletions(-)
```

### 变更范围摘要
- **03-00 传输通道改造**（src/mcp/tools/index.ts 主体，203 行变更）
- 类型定义补充（src/types/index.ts，+1）
- agent registry 更新（.lrnev/agents/registry.json，24 行调整）
- gitignore 补充（.gitignore，+5）

### 禁改区域验证
✅ 未触碰以下区域：
- 02-00 基线（`guidance-surface-inventory-v2.json`）
- 04-00 fixtures（`tests/fixtures/04-00/`）
- B0-s 证据（`b0-evidence-manifest.json` / `b0-observation-report.md`）
- B1 证据（`b1-evidence-manifest.json` / `b1-migration-report.md`）

## 2. M1 语义自查

### 2.1 shouldSetIsError 语义（D-05 要求）
**定义**：`!payload.ok` 时设置 `isError: true`

**自查方法**：
```bash
# 查找 shouldSetIsError 实现
git stash show stash@{0} -p | grep -A5 "shouldSetIsError"
```

**预期**：逻辑应为 `return !payload.ok;`，不应有其他判断条件。

**待验证**：合入后抽查 3 个工具的错误响应，确认 `isError` 字段正确设置。

### 2.2 双通道（structuredContent vs legacy content）
**定义**：
- `structuredContent`：新通道，含 `isError` / `severity` / `actionable` / `recoverable`
- `legacy content`：原 `content` 字段，纯文本，B0 等价

**自查方法**：
```bash
# 查找 structuredContent 构造
git stash show stash@{0} -p | grep -A10 "structuredContent"
```

**预期**：
- `structuredContent` 包含所有 D-05 字段
- `content` 字段保持原文本格式（B0 等价，不受新通道影响）

**待验证**：合入后运行 04-00 测试套件，确认 `content` 字段未变（B0 等价性保持）。

### 2.3 legacyRawFormat B0 等价性
**定义**：原 `content` 字段的文本格式与 B0-s 基线（git_sha=45a86e15）完全一致

**验证方法**（合入后）：
```bash
# 切到 B0-s SHA
git checkout 45a86e15
# 跑一次测试，记录 content 字段
npx vitest run tests/e2e/04-00/ > /tmp/b0-content.txt

# 切回合入后 HEAD
git checkout main
# 再跑一次，对比 content 字段
npx vitest run tests/e2e/04-00/ > /tmp/m1-content.txt
diff /tmp/b0-content.txt /tmp/m1-content.txt
```

**预期**：`content` 字段完全一致，差异只应在 `structuredContent`（新增字段）。

## 3. 合入计划

### 3.1 M1 完整文件清单（8 个文件）

**tracked 文件**（stash@{0} 包含的修改，4 个）：
- `.gitignore`（+5）
- `.lrnev/agents/registry.json`（24 行调整）
- `src/mcp/tools/index.ts`（±203）
- `src/types/index.ts`（+1）

**untracked 文件**（M1 核心实现，stash 不包含，必须显式纳入提交，4 个）：
- `src/mcp/helpers/tool-result-adapter.ts`（6.8KB，tools/index.ts 依赖）
- `src/mcp/types/output-schemas.ts`（20KB，tools/index.ts 依赖）
- `src/mcp/types/response-envelope.ts`（5.8KB，adapter 依赖）
- `tests/unit/response-envelope.test.ts`（3.7KB，M1 单元测试）

**注**：stash 只包含 tracked 文件的修改，未跟踪的 M1 核心实现必须显式 `git add`，否则提交后 tools/index.ts 的 import 会找不到模块，编译失败。

### 3.2 合入步骤（修订版，先测试再提交）
```bash
# 1. pop stash@{0}（恢复 tracked 文件的修改）
git stash pop stash@{0}

# 2. 确认工作区状态
git status --short
# 预期：
# M  .gitignore
# M  .lrnev/agents/registry.json
# M  src/mcp/tools/index.ts
# M  src/types/index.ts
# ?? src/mcp/helpers/
# ?? src/mcp/types/
# ?? tests/unit/response-envelope.test.ts
# （以及其他 04-00 产物，不纳入本次提交）

# 3. 纳入 M1 完整变更（8 个文件）
git add .gitignore \
        .lrnev/agents/registry.json \
        src/mcp/tools/index.ts \
        src/types/index.ts \
        src/mcp/helpers/tool-result-adapter.ts \
        src/mcp/types/output-schemas.ts \
        src/mcp/types/response-envelope.ts \
        tests/unit/response-envelope.test.ts

# 4. 验证暂存区完整性
git diff --cached --stat
# 预期：8 files changed（上述 8 个文件）

# 5. 跑 731 全量回归（合入态工作区，DeepSeek 独立复跑确认）
npx vitest run
# 预期：731 tests passed（或当前实际测试总数）
# 若未通过：修复 → 重跑 → 通过后进入步骤 6
# 若通过：记录实际通过数，写入 commit message

# 6. 提交（message 如实记录步骤 5 的结果）
git commit -m "feat(03-00): M1 传输通道改造 — structuredContent + shouldSetIsError

- 新增 structuredContent 字段（isError/severity/actionable/recoverable）
- 实现 shouldSetIsError 语义（!payload.ok）
- 核心实现：tool-result-adapter / output-schemas / response-envelope
- 保持 legacy content B0 等价性
- 全量测试通过（<实际通过数> tests passed）

refs: 03-00 T-002
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

# 7. 验证提交完整性
git show --stat HEAD
# 预期：8 files changed（与步骤 4 一致）

git ls-files src/mcp/helpers/ src/mcp/types/
# 预期：3 个文件已进 repo（adapter.ts / output-schemas.ts / response-envelope.ts）

# 8. 记录新 SHA
git rev-parse HEAD > /tmp/m1-sha.txt
cat /tmp/m1-sha.txt
```

**修正关键点**：
- 步骤 5（731 回归）前置到 commit 之前，在合入态工作区（暂存区已含 8 文件）跑测试
- 步骤 6 的 commit message 如实记录步骤 5 的实际结果（`<实际通过数> tests passed`）
- 避免 M1 第一轮"假报告"教训的变体：不预填未发生的事

### 3.3 731 全量回归（合入态实测）
```bash
# 1. pop stash@{0}
git stash pop stash@{0}

# 2. 确认工作区干净（除预期的 4 个文件外无其他变更）
git status

# 3. 提交
git add .gitignore .lrnev/agents/registry.json src/mcp/tools/index.ts src/types/index.ts
git commit -m "feat(03-00): M1 传输通道改造 — structuredContent + shouldSetIsError

- 新增 structuredContent 字段（isError/severity/actionable/recoverable）
- 实现 shouldSetIsError 语义（!payload.ok）
- 保持 legacy content B0 等价性
- 731 全量测试通过

refs: 03-00 T-002
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

# 4. 记录新 SHA
git rev-parse HEAD
```

### 3.2 731 全量回归（合入态实测）
**注意**：必须在合入后（新 HEAD）跑测试，不是 stash 内自报。

```bash
# 确认当前 HEAD 已包含 M1 变更
git log -1 --oneline

# 运行全量测试
npx vitest run

# 预期结果
# - 731 tests passed（或当前实际测试总数）
# - 0 failed
# - 04-00 测试套件 43/43 通过
```

### 3.3 03-00 T-002 completed
合入 + 731 通过后，落库 T-002（03-00 的 M1 任务）：
```bash
# 标记 M1 完成
lrnev task_update --scene=03-transmission-channel --spec=03-00-m1 --task=T-002 --status=completed --reason="M1 合入完成：structuredContent 双通道 + shouldSetIsError 语义 + 731 全量通过 + B0 等价性保持"
```

## 4. 审查方合入门禁（DeepSeek 三项）

### 4.1 diff 范围
✅ 已自查：只动 03-00 范围（4 个文件），未触碰禁改区域

**待 DeepSeek 复核**：
- `git stash show stash@{0} --name-only` 文件清单
- 是否有非预期文件

### 4.2 731 实测
⏸️ 待合入后执行

**由 DeepSeek 独立复跑**：避免重复 M1 第一轮教训（stash 后跑原始代码，把原始通过当 M1 结果的假报告）

### 4.3 语义抽查
⏸️ 待合入后执行

**待 DeepSeek 抽查**：
- `shouldSetIsError` 错误码判定（`!payload.ok`，不应有其他条件）
- `legacyRawFormat` content 等价（与 B0-s git_sha=45a86e15 对比）
- 3 个工具的 `structuredContent` 格式（含 D-05 所有字段）

## 5. 合入后下一步

M1 合入 ✅ → T-021（B2a）启动
- B2a：05-00 Profile `v1` 后采集证据
- 与 B1 对比（M1 传输通道改造是否影响行为）
- T-027 B0' 双 SHA 对照（Claude Code 主 + Codex 补）

## 6. 红线保持

- 02-00 基线不可变（`f6adf21b...`）
- B0-s 禁改写（git_sha=45a86e15 已归档）
- B1 禁改写（git_sha=45a86e15 已归档）
- B0' 双 SHA 对照仍可 checkout 旧 SHA（45a86e15 vs 合入后新 SHA）
