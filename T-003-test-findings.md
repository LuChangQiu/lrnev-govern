# T-003 MCP 协议契约测试 - 实测结果与修正清单

## 执行摘要

重做后的测试已实现实质性验证，成功暴露 10 个真实问题（非空转）。测试按 DeepSeek 复审要求修正：
- F-05: 强制断言 outputSchema + 42 工具数量 ✅
- F-06: 验证失败路径（isError/error/AMBIGUOUS_REF） ✅
- F-07: legacy 降级测试（已合格） ✅
- F-08: 实质 annotations 断言（暴露缺失） ✅
- F-09: 从实测获取证据（非硬编码） ✅

## 发现的问题（10个）

### 1. F-05: 工具数量不符（预期 42，实际 9）
**问题**: 测试环境只注册了 9 个工具，与生产环境 42 个不符
**影响**: 测试覆盖率不足
**建议**: 确认测试环境是否正确初始化所有工具注册器

### 2. F-05: 6 个工具缺失 outputSchema
**缺失清单**:
- lrnev_doctor
- lrnev_hook_list
- lrnev_hook_trigger
- lrnev_hook_tail_log
- lrnev_hook_enable
- lrnev_hook_disable

**影响**: MCP 协议合规性不完整
**建议**: 为这 6 个工具补充 outputSchema 定义

### 3. F-06: 业务拒绝未返回 isError=true
**问题**: `spec_update` 调用不存在的 spec 时，返回的 `result.isError` 是 `undefined`，应为 `true`
**影响**: 客户端无法正确判断调用是否失败
**建议**: 修正 B2b 渲染器，确保业务拒绝场景返回 `isError: true`

### 4. F-06: 歧义引用测试失败（schema 校验错误）
**问题**: 创建多版本 spec 时触发 MCP schema 校验错误：`data/data must NOT have additional properties`
**影响**: 无法测试 AMBIGUOUS_REF 场景
**建议**: 
- 检查 `scene_create` 和 `spec_create` 的 outputSchema 定义
- 或调整测试策略（歧义场景可能由实现决定采用"最新版本"策略）

### 5. F-06: 参数类型错误未抛出异常
**问题**: `task_create` 传入错误类型参数（scene: 123, spec: null, title: {}）时，返回成功而非抛出错误
**影响**: 缺少参数校验
**建议**: 在工具调用入口添加参数类型校验

### 6-9. F-08: annotations 缺失（4 类共 13 个工具）

#### 6. 缺失 readOnly=true（6 个工具）
- spec_get
- task_list
- scene_list
- adr_get
- project_status
- lrnev_guide

#### 7. 缺失 idempotent=true（3 个工具）
- spec_create
- adr_create
- scene_create

#### 8. 缺失 destructive=true（1 个工具）
- memory_forget

#### 9. 缺失 openWorld=true（3 个工具）
- context_search
- error_search
- memory_search

**影响**: 客户端无法根据 annotations 优化调用策略（如缓存只读结果、重试幂等操作）
**建议**: 在工具注册时添加相应 annotations

### 10. F-09: 工具数量不符（同问题 1）

## 修正优先级

### P0 - 协议合规性
1. **补充 6 个工具的 outputSchema**（F-05）
2. **修正业务拒绝的 isError 返回**（F-06）
3. **修正参数类型校验**（F-06）

### P1 - 可观测性
4. **添加 annotations**（F-08，13 个工具）
   - readOnly: 6 个
   - idempotent: 3 个
   - destructive: 1 个
   - openWorld: 3 个

### P2 - 测试完整性
5. **确认测试环境工具注册**（F-05/F-09，为何只有 9 个工具）
6. **调整歧义测试策略**（F-06，或接受"最新版本"实现）

## 测试状态

- **通过**: 4/14
- **失败**: 10/14（全部为真实验证失败，非空转）
- **测试文件**: `tests/integration/mcp-protocol-contract.test.ts`
- **执行时间**: 610ms

## 下一步

1. 本文档作为修正清单，另行处理（不在 T-003 范围内）
2. 提交 T-003 测试重做 commit
3. 创建后续任务处理修正清单（建议拆分为独立 spec）
