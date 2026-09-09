# sample-project — lrnev 上手 demo

跟着这份 README 敲，你能从"一个空目录"走到"一个完整的需求 + 设计 + 任务清单 + Gate 通过"，最后再用 `lrnev report` 看治理体检。

> 假设你已经全局装好 lrnev：`npm install -g lrnev`。本地开发用 `npm link` 后 `lrnev` 命令同样可用。

---

## 0. 准备

```bash
# 把这个示例目录复制到任意你想测试的位置
cp -r examples/sample-project /tmp/lrnev-demo
cd /tmp/lrnev-demo
```

> ⚠️ **workspace 定位**：lrnev 按「`LRNEV_WORKSPACE` 环境变量 → 向上查找最近的 `.lrnev/PROJECT.md` → 当前目录」的顺序定位工作区。**不要**在仓库里（或任何祖先目录已含 `.lrnev` 的地方）直接跑 demo——命令会命中祖先那个工作区，而不是在示例目录里新建。复制到独立目录后建议把工作区钉死，避免 cd 错位或祖先干扰：
>
> ```bash
> export LRNEV_WORKSPACE=/tmp/lrnev-demo
> lrnev init   # 幂等。返回里的 data.root 若不是 /tmp/lrnev-demo、或 was_new 不是 true，说明命中了别的 .lrnev——先检查 LRNEV_WORKSPACE 再继续
> ```
>
> 等价手段：每条命令带全局参数 `lrnev -w /tmp/lrnev-demo <子命令>`。MCP 客户端侧用 `env.LRNEV_WORKSPACE` 钉死（见文末「接入 AI 客户端」）。

---

## 1. 初始化工作区

```bash
lrnev init --project-name lrnev-demo
```

init 的返回里 `was_new: true`、`data.root` 指向 `/tmp/lrnev-demo`，就说明工作区定位正确。你会看到 `.lrnev/` 目录生成了 `PROJECT.md`、`ARCHITECTURE.md`（二者都是带 `FILL` 占位的骨架，供 AI 读构建/清单文件后补全）、`steering/`、默认 Scene `00-default/scene.md`、`config/hooks.json`（空数组），以及 `scenes/`、`decisions/adr/`、`errorbook/`、`memory/`、`agents/`、`runtime/`、`locks/`、`state/` 等目录骨架。**治理数据全在 `.lrnev/` 下的 Markdown 文件里**，可以 `git add .lrnev/` 版本管理；其中 `agents/`、`runtime/`、`locks/`、`state/` 是进程运行态（claim 软占用、锁等），建议出库不跟踪。

> 想顺手练 git 跟踪的话：示例目录自带的 `.gitignore` 忽略了整个 `.lrnev/`（那是防止有人误在仓库里跑 demo 的保险），复制出来后先删掉它，再 `git init && git add .lrnev/` 即可看到治理档案入库。

---

## 2. 想做个需求？先评估粒度（可选）

```bash
lrnev goal assess "做一个用户邮箱密码登录功能"
```

启发式只看文本，不调 LLM。返回 `kind` + `confidence` + 三档分流文案。AI 客户端会读 `ai_followup` 决定该开 Spec 还是走 Errorbook / ADR / Memory。

---

## 3. 创建第一个 Spec

```bash
# 不传 scene → 自动挂到 00-default
lrnev spec create user-login --priority P1
```

`spec` 字段输出 `01-00-user-login`，路径 `.lrnev/scenes/00-default/specs/01-00-user-login/`。三文档已生成：requirements / design / tasks。

---

## 4. 填需求

编辑 `requirements.md`，把所有 `<!-- FILL: ... -->` 哨兵换成真实内容。下面是 demo 用的最小填法：

```markdown
## L0 摘要
邮箱密码登录：注册用户用邮箱 + 密码登录，登录态用 session cookie 维持 30 天。

## L1 概览
### 目标
让回头用户不必每次输入密码就能进入应用。

### 用户故事
- 作为 注册用户，我希望 输入邮箱密码即可登录，以便 不用反复重新登录。

### 范围
**包含**：
- 邮箱密码登录、会话保持、登出
**不包含**：
- 三方登录、密码找回

## L2 详情
### 详细需求
#### F-01 邮箱密码登录
- 描述：用户提交邮箱+密码，校验通过后建立会话。
- 验收：登录成功率 > 99%，错误密码不泄露用户是否存在

### 非功能性需求
- 性能：登录响应 P95 < 500ms
- 兼容性：主流浏览器最新两个大版本

### 边界与依赖
依赖用户表已存在。

### 验收标准
- [x] 登录成功率 > 99%
```

> 模板章节标题是契约（gate 按中文标题匹配章节、task 的 validates 按 `F-xx`/`D-xx` 锚点定位），所以只替换 `<!-- FILL: ... -->` 哨兵与括号占位，标题和层级保持原样；上面填法只是演示"够跑通的最小内容"，不必逐字照抄。

---

## 5. 跑 ready gate

```bash
lrnev gate check --scene 00-default --spec 01-00-user-login --gate ready
```

如果哨兵没填完，gate 会精确指出哪几行（如 `requirements.md 仍有未填哨兵：L28, L31`）；填完后 `passed: true`。`ready` gate 只检查 `requirements.md`（结构章节、无 FILL 哨兵、验收清单已勾选），此时 `design.md`/`tasks.md` 还没填也不影响。通过的响应里 `ai_followup` 会建议把 `spec.status` 回填成 `ready`，并询问是否需要 ADR（`suggested_tools` 给出 `adr_create`）。

> 注意：ready gate 的 `requirements_acceptance_checked` 会拦验收标准里未勾选的清单项（`- [ ]` 会被精确指出行号，需改为 `- [x]`）。整体验收项要记得勾选——§4 demo 的填法已经按勾选态（`[x]`）写好。

```bash
lrnev spec update 01-00-user-login --scene 00-default --status ready --reason "demo ready gate 通过"
```

---

## 6. 填设计

`completion` gate 会硬拦 `requirements.md` 和 `design.md` 里残留的 `<!-- FILL: ... -->` 哨兵，所以继续前也要把 `design.md` 填掉。下面是 demo 用的最小填法：

```markdown
## L0 摘要

登录 API 校验邮箱密码，成功后写入 session cookie，登出时清理会话。

## L1 概览

### 架构思路

登录逻辑放在 auth service，HTTP 层只负责参数校验和响应封装。

### 主要模块

- `POST /login`：校验邮箱密码并创建 session。
- `POST /logout`：删除 session。
- session store：保存 30 天登录态。

### 关键决策

无重大架构分歧；demo 使用服务端 session cookie。

## L2 详情

### 模块详细设计

#### D-01 登录会话流程

请求进入 auth service 后按邮箱查用户、校验密码 hash，成功则创建 session id 并写入 httpOnly cookie。

### 数据模型

session: `{ id, user_id, expires_at }`。

### 接口契约

- `POST /login` 成功返回 200 和 session cookie。
- 密码错误返回 401。

### 错误处理

错误密码不暴露用户是否存在；session store 不可用时返回 503。

### 测试策略

覆盖登录成功、错误密码、登出和 session 过期。
```

> 与 §4 同一原则：保留模板章节标题，只替换哨兵与占位；`#### D-01` 这类设计锚点标题要留着，后面 task 的 `--validates D-01` 靠它定位。

---

## 7. 建任务 + 推进 + 完结

```bash
# 建任务，validates 同时关联需求 F-01 和设计 D-01
lrnev task create "实现登录 API" \
  --scene 00-default --spec 01-00-user-login \
  --validates F-01 D-01 \
  --acceptance "POST /login 200 含 session cookie" "错误密码 401"

# 已经想好完整任务清单？用批量创建一次落盘（自 v2.3 引入，当前 v3.0.0）：JSON 数组，批内依赖用 key 临时键，
# 任一条校验失败整批不写并一次返回全部错误
# lrnev task create-many --scene 00-default --spec 01-00-user-login --from-file tasks.json

# 开始干活：状态机会校验 pending → in_progress；写代码前先把 spec 标成 in-progress
lrnev spec update 01-00-user-login --scene 00-default --status in-progress --reason "demo 开始实现"
lrnev task update T-001 --scene 00-default --spec 01-00-user-login --status in_progress

# ... 写代码、写测试 ...

lrnev task update T-001 --scene 00-default --spec 01-00-user-login --status completed
```

> **看懂这次 `task update` 的返回**：切到 `in_progress` 时响应会回填干活需要的上下文——声明了 validates 的返回 `anchor_context`（数组，每条带锚点原文，如 F-01 验收口径段落）；没声明 validates 的返回 spec 级 `summary_context`。3.0.0 起每个上下文带 `meta: { text_status, returned_length }`：`text_status` 为 `complete` / `truncated_by_budget`（大段落按预算截断）/ `incomplete_source`（源段落还是模板占位），残缺或截断会明确标注，不会把占位噪声当正文回填——详情见根 README 的 MCP 响应契约节。

---

## 8. completion gate

```bash
lrnev gate check --scene 00-default --spec 01-00-user-login --gate completion
```

所有 task 都 completed，且 requirements / design 没有 FILL 哨兵 → `passed: true`。`ai_followup` 建议你把 `spec.status` 改成 `completed`。

```bash
lrnev spec update 01-00-user-login --scene 00-default --status completed --reason "demo 完成，completion gate 通过"
```

---

## 9. 治理体检 report

```bash
lrnev report
lrnev report --json
```

`report` 是给人看的"分红"快照：它会列出做完没收口的 spec、failed/blocked 任务、validates 覆盖率和孤儿锚点，并给每条欠债下一步。它不是 CI gate，有欠债也 exit 0。

---

## 10. 接手时（多 AI / 跨会话）

```bash
lrnev status
```

返回 scenes / specs / **active_tasks** / recent_adrs / open_errors 全量快照。接力的 AI 看 `active_tasks` 里的 `in_progress` task 就能直接继续。

> 3.0.0 起查询类返回会带 `query_meta`（如 `claimable_meta`：returned_count / total_count / truncated / omitted），告诉你这份快照有没有被截断省略、总共还有多少——需要全量时换更窄的查询条件再取。

---

## 11. 想试试踩坑沉淀？

```bash
lrnev error record \
  --symptom "登录接口在并发 100 时偶发 500" \
  --root-cause "session store 用了 in-memory map，没考虑多副本" \
  --fix-action "迁移到 Redis"
```

不强制开 Spec——小事就走 Errorbook / ADR / Memory。

---

## 想看 Demo 走完后的样子？

跑完上面所有步骤，`.lrnev/` 会长成：

```
.lrnev/
├── PROJECT.md · ARCHITECTURE.md     # 项目定位与约定 / 全局架构约束
├── steering/                         # 给 AI 的行为指引（原则、范围、ADR/memory 触发条件）
├── scenes/00-default/
│   ├── scene.md                      # 默认 Scene
│   └── specs/01-00-user-login/
│       ├── requirements.md           # frontmatter status=completed；内容已填完
│       ├── design.md                 # 已填完，completion gate 会检查无 FILL
│       └── tasks.md                  # 含 `### T-001 ... <!-- lrnev-task: status=completed, ... -->`
├── decisions/adr/                    # ADR（本 demo 未产生，目录就位）
├── errorbook/incidents/xxx.md        # 步骤 11 的记录（指纹命名的 incident）
├── memory/                           # 项目记忆（decisions/errors/facts/patterns/preferences 五类）
├── config/hooks.json                 # Hooks 配置（init 后是空数组 []）
└── agents/ · runtime/claims/ · locks/ · state/   # 运行态：可忽略、出库不跟踪
```

---

## 接入 AI 客户端

上面是 CLI 用法。要让 Claude Code / Cursor / 其他 MCP 客户端用同一份数据，在客户端的 MCP 配置里加：

```json
{
  "mcpServers": {
    "lrnev": {
      "command": "lrnev-mcp",
      "env": { "LRNEV_WORKSPACE": "/tmp/lrnev-demo" },
      "args": ["--profile", "core"]
    }
  }
}
```

- `env.LRNEV_WORKSPACE`：MCP 子进程的 cwd 常常不是项目根，**建议始终钉死**——不钉死时 lrnev 向上查找 `.lrnev`，可能命中祖先目录里别的项目（与 §0 是同一个坑）。
- `args: ["--profile", "core"]`（3.0.0 起，可选）：缺省 `full` 注册全部 42 个工具；`core` 裁掉 9 个"AI 不该主动选"的自动/配置面工具（`agent_*` 4 个 + `lrnev_hook_*` 5 个），保留 33 个。工具名与 CLI 子命令一一对应（如 `spec_create` / `task_update` / `project_status` / `assess_goal`）。

**3.0.0 双通道响应（接入方须知）**：每次工具调用同时返回 `structuredContent`（canonical 数据契约：`response_version: '1'` / `ok` / `data` / `errors` / `ai_followup`，按场景带 `anchor_context` / `summary_context`）与 `content[0].text`（按工具渲染、给 AI / 人直接读的文本）。**2.3.0 及以前 `content[0].text` 是 JSON 字符串；3.0.0 起不再是 JSON**，机器解析一律读 `structuredContent`。详细契约见仓库根 README「MCP 响应契约」一节。

**（可选）hooks 自动化**：init 后 `.lrnev/config/hooks.json` 是空数组。想让事件（如 `task.update.completed`、`spec.gate_passed.completion`）触发本地脚本时，往里加 `{ "name", "event", "command", "mode" }` 条目，用 `lrnev hook list` 查看、`lrnev hook trigger <event>` 手动试跑。3.0.0 起 async hook 触发即先记 `invoked`，进程退出会 drain（超时补记 `timed_out`），排查一律用 `lrnev hook tail-log`。事件表与配置键见 `docs/HOOKS.md`，完整示例见 `docs/examples/hooks.json`。

---

更多请看仓库根 README（命令流、MCP 双通道契约与 `--profile` 分层）、`docs/GOVERNANCE-FLOW.md`（gate / 哨兵 / 状态机语义）和 `docs/AI-ADAPTATION.md`（跨客户端接入配置、常驻提示词模板）。
