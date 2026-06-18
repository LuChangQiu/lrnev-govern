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

> 也可以直接在 `examples/sample-project` 里跑，但完成后记得删 `.lrnev/`，避免污染仓库。

---

## 1. 初始化工作区

```bash
lrnev init --project-name lrnev-demo
```

你会看到 `.lrnev/` 目录生成了 `PROJECT.md`、`ARCHITECTURE.md`、`steering/`、默认 Scene `00-default/`。**这就是 lrnev 的全部数据**，可以 `git add .lrnev/` 跟踪。

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
- [ ] 登录成功率 > 99%
```

---

## 5. 跑 ready gate

```bash
lrnev gate check --scene 00-default --spec 01-00-user-login --gate ready
```

如果哨兵没填完，gate 会精确指出哪几行；填完后 `passed: true`，`ai_followup` 还会建议你"把 spec.status 改成 ready"并询问"是否需要 ADR"。

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

---

## 7. 建任务 + 推进 + 完结

```bash
# 建任务，validates 同时关联需求 F-01 和设计 D-01
lrnev task create "实现登录 API" \
  --scene 00-default --spec 01-00-user-login \
  --validates F-01 D-01 \
  --acceptance "POST /login 200 含 session cookie" "错误密码 401"

# 开始干活：状态机会校验 pending → in_progress；ai_followup 回填 anchor_context（F-01 验收口径段落），无 validates 则回填 spec 级 summary_context
lrnev spec update 01-00-user-login --scene 00-default --status in-progress --reason "demo 开始实现"
lrnev task update T-001 --scene 00-default --spec 01-00-user-login --status in_progress

# ... 写代码、写测试 ...

lrnev task update T-001 --scene 00-default --spec 01-00-user-login --status completed
```

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
├── PROJECT.md
├── ARCHITECTURE.md
├── steering/
├── scenes/00-default/
│   ├── scene.md
│   └── specs/01-00-user-login/
│       ├── requirements.md  # 已填完
│       ├── design.md        # 已填完，completion gate 会检查无 FILL
│       └── tasks.md         # 含 T-001 completed + meta 注释
├── errorbook/incidents/...  # 步骤 9 的记录
└── auto/codebase.json
```

---

## 接入 AI 客户端

上面是 CLI 用法。要让 Claude Code / Cursor / 其他 MCP 客户端用同一份数据：

```json
{
  "mcpServers": {
    "lrnev": { "command": "lrnev-mcp" }
  }
}
```

工具名跟 CLI 子命令一一对应（如 `spec_create` / `task_update` / `project_status`）。

---

更多请看仓库根 README 和 `docs/GOVERNANCE-FLOW.md`。
