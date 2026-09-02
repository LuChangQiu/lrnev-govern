# 04-00 E2E Fixture 权威源

⚠️ **禁读声明**

本目录下的 fixture 文件（.ts）是 04-00 E2E 测试的**权威源**，包含：

1. **userInput**：用户原话（盲测 prompt）
2. **expectedAction/Args**：期望行为（执行者不可见）
3. **decisionContext**：工作区状态（fixture 构建用）

## 盲测原则

- **只向执行者展示 userInput**
- **expectedAction/Target/prohibited 事后对照**
- **期望答案执行者不可见**

## 单一真相

- B0~B2b 基于此 fixture 话术
- T-027 双 SHA 对照必须使用相同话术（单变量控制）
- 禁止创建平行 .json/.yaml 等其他格式 fixture

## 使用方式

### CI 测试（当前）
```typescript
import { E01_SuggestReuseExplicitNew } from './e01-suggest-reuse-explicit-new';
// 使用 fixture.userInput 和 fixture.expectedAction
```

### T-027 真机测试（Phase 2）
- 读取 fixture.userInput 作为盲测 prompt
- 不注入 expectedDecisionContext（SHA A/B 无此参数）
- 事后对照 fixture.expectedAction

## 维护规则

- 修改 userInput 必须同步更新所有引用测试
- 全量测试通过后方可提交
- 内嵌期望标注（如 "explicit+new_spec"）已清除

---

**创建时间**: 2026-09-02  
**最后修订**: 2026-09-02
- 清除内嵌标注（E-05/E-06a/E-06b）
- 删除 .json 双源（816a98a → 106f214）
- 修正 E-07/E-11 话术-期望错位（106f214 → 本次）
  - E-07: "不用开 Spec 直接回答" → "登录页有 bug，不建 Spec 了，直接改代码"（改代码语境，测出 no_spec 张力）
  - E-11: "不用开 Spec/Scene 直接回答" → "帮我分析一下现有的登录流程有什么问题"（自然分析请求，other 协议）
- 同步测试断言（e07.test.ts L20，e11.test.ts L20/L49-50）
- 全量测试 869/869 通过 ✅
