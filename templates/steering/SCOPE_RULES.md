# Scope（范围）判定规则

> ADR / Memory / Errorbook 三类数据都支持 `scope` 字段：
>   - `global`：全局适用
>   - `scene:{id}`：仅适用于某个 Scene
>
> 写入时 AI 必须显式选 scope。本文档教你怎么选。

---

## 默认：写 `global`

不确定时一律写 `global`，理由：
1. 全局数据更显眼，不会被埋在某个 Scene 里
2. 后续可下沉到 Scene（M2 提供 `adr_demote` / `memory_demote`），反向更难

## 写 `scene:{id}` 的判定条件

满足以下**任意一条**才用 Scene scope：

### 条件 1：内容明确仅在某个 Scene 内成立

✅ 正确：
- "用户管理 Scene 使用 JWT，订单管理 Scene 不用"
- "本 Scene 的领域模型里订单包含子订单（其他 Scene 没有这个概念）"

❌ 错误（应该 global）：
- "项目统一用 TypeScript"（适用所有 Scene）
- "命名用 kebab-case"（项目级偏好）

### 条件 2：内容引用了 Scene 特有的术语 / 实体

✅ 正确：
- "在订单 Scene 里，'订单' 指…"
- "用户 Scene 的 PasswordResetFlow 用 redis 存 token"

❌ 错误：
- 通用概念（HTTP / REST / JWT）→ global

### 条件 3：用户在对话中明示

用户原话："这只是 X Scene 的事"、"这个偏好只用在 Y Scene"。

## Tentative 标记

不确定时可写 `global` + 在 frontmatter 加：

```yaml
tentative: true
```

表示"我不太确定 scope，待用户后续确认/收敛"（`tentative` 标记仅 `memory_save` 支持；ADR/Errorbook 不支持该标记）。

## 写作提示：验收可测

requirements 的验收标准鼓励写成 EARS 风格，例如：
`WHEN 用户输错密码 THEN 系统返回 401 且不暴露用户是否存在`。

这只是写作示范，不是 gate 硬规则；简单 Spec 仍可使用自然语言验收。

## 写作提示：frontmatter 日期

结构化状态与 spec/task 的 `created` / `updated` 由 lrnev 工具生成（`spec_update` 等回写）；**无工具的正文文档**（PROJECT / ARCHITECTURE / scene 三件套）由编辑者维护日期，不要伪造工具时间戳。

## 写作提示：Spec 版本号

修改现有 Spec 内容时直接编辑当前 `requirements.md` / `design.md` / `tasks.md`，不要改 Spec 版本号。只有整体推翻重写并需要保留旧版对照时，才用 `spec_create --version` 开新版。**尚未实现（draft、无 completed task）的整体重写直接编辑即可，不开新版。**

## 提升 / 下沉（当前无工具）

目前**没有** `adr_promote` / `adr_demote` / `memory_promote` / `memory_demote` 工具（勿在建议/流程中引用它们）。scope 需要收敛（如某条记录实际应属 Scene 或全局）时：与用户确认后手工迁移（mv 文件 + 改 frontmatter，Markdown 友好）或重新保存。

## 速查表

| 内容性质 | 应选 scope |
|---------|----------|
| 跨 Scene 适用 | global |
| 影响项目架构 | global |
| 团队 / 项目偏好 | global |
| 通用编码规范 | global |
| 仅在一个 Scene 内成立 | `scene:{id}` |
| Scene 内反复出现的坑 | `scene:{id}` |
| Scene 特有术语 / 实体 | `scene:{id}` |
| 不确定 | global + tentative |
