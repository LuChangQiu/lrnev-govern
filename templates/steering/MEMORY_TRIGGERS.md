# 记忆抽取触发规则

> 记忆（Memory）有 5 类：preferences / decisions / patterns / errors / facts
> 不是所有对话都要抽记忆。本文档教你**何时调 `session_commit`**、**抽什么**。

---

## 何时触发 session_commit

1. **对话告一段落**：用户完成一个明确的任务（一个 spec 做完、一个 bug 修完）
2. **用户显式要求**："记一下这个"、"记住我的偏好"
3. **长会话节点**：对话超过 50 轮，AI 主动建议归档

---

## 抽什么：5 类记忆速查

### preferences（偏好）

✅ 抽取：
- "我们用 4 空格缩进"
- "函数名用 camelCase"
- "测试都放 tests/ 目录"
- "我喜欢简洁的 commit message"

❌ 不抽：
- 一次性偏好（"这个函数你随便改"）
- 通用知识（"JS 用分号"）

### decisions（决策线索）

✅ 抽取：
- "选了 JWT 不选 session"（如果用户没让生成 ADR）
- "决定先做 MVP 再优化"

⚠️ 注意：成熟的决策应该 **主动询问** 生成 ADR（见 ADR_TRIGGERS），
   memory.decisions 是"还没正式记成 ADR"的中间态。

### patterns（模式）

✅ 抽取：
- "项目里所有 API 都用这个错误处理中间件"
- "所有 React 组件用这个 props 命名约定"
- "数据库查询都走 repository 层"

### errors（错误线索）

✅ 抽取：
- "我们遇到过 X，临时这么修了"

⚠️ 注意：充分调试 + 验证的错误应该 **主动提议** 进 Errorbook（更正式的知识库）。
   memory.errors 是"还没整理成 Errorbook"的中间态。

### facts（事实）

✅ 抽取：
- 项目背景（"这是给银行用的"）
- 团队信息（"我们组只有 3 人"）
- 外部约束（"上游 API 每秒最多 100 请求"）
- 业务术语表

❌ 不抽：
- 普通对话寒暄
- 可从代码 / package.json 直接读出的事实（auto/codebase.json 已经有）

---

## session_commit 调用方式

```typescript
session_commit({
  summary: "本次对话完成了 user-login Spec 的 requirements.md 编写",
  candidates: [
    {
      category: 'preferences',
      content: '用户偏好用 fetch 不用 axios（理由：减少依赖）',
      source: '对话第 12 轮'
    },
    {
      category: 'decisions',
      content: '决定 JWT 放 httpOnly cookie 不放 localStorage',
      source: '对话第 23 轮'
    },
  ],
  scope: 'global'  // 详见 SCOPE_RULES
})
```

工具会：
- 对每条候选做查重（同类别 L0 关键字匹配）
- 重复的返回 `skipped` 并指出相似条目
- 新的返回 `saved` 写入 `.lrnev/memory/{category}/{id}.md`

---

## 抽取质量要求

1. **必带 source**：哪段对话 / 哪个文件 / 哪个 commit
2. **保留具体数值**：不要泛化为"很多"、"几次"
3. **避免相对时间**："昨天" / "刚才" → 写绝对日期
4. **保留专有名词**：用户的命名 / 缩写 / 特有术语

---

## 不要做的事

- ❌ 每轮对话都调 session_commit（会污染记忆库）
- ❌ 抽取技术常识（这不是给小白 AI 看的，是给以后的 AI 用的）
- ❌ 把"我修了一个 typo"也抽成 memory
- ❌ 写记忆时夹带情感判断（"用户很挑剔"）
