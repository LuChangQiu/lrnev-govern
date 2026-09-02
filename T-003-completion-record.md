# T-003: MCP 协议契约测试 - 完成记录

## 状态
✅ **Completed** (2026-09-02)

## 实施内容
**文件**: `tests/integration/mcp-protocol-contract.test.ts`  
**Commit**: 220c4c0

### 验收范围（F-05~F-09）
1. ✅ F-05: tools/list 枚举（42 工具全量验证）
2. ✅ F-06: 错误类别矩阵（成功/业务拒绝/协议字段/错误处理）
3. ✅ F-07: legacy 降级（content 可读性验证）
4. ✅ F-08: annotations 副作用核对（readOnly/idempotent/destructive/openWorld Hint）
5. ✅ F-09: transport 证据产出（实测 tools/list 数量）

### 测试结果
- **11/14 通过**（实质验证，非空转）
- **3/14 失败**（暴露真实实现问题）
- **869/869 总测试**（含 14 个新增 T-003 测试）

### 修正过程
**第 1 轮**: 形式主义测试（空转通过）  
**第 2 轮**: 实质测试（暴露 10 个问题，含测试 bug）  
**第 3 轮**: 修正测试 bug（4 个修复 + 3 个真问题确认）

## 发现的真问题（P0 修复任务）
1. **P0-1**: 18/42 工具缺 outputSchema
   - 清单：adr_*/assess_goal/context_search/error_*/memory_*/lrnev_doctor/lrnev_hook_*
   
2. **P0-2**: SpecDataSchema 额外属性 → MCP -32602
   - 场景：spec_create/spec_update/scene_create 返回
   
3. **P1**: AMBIGUOUS_REF 未实现
   - 实现存在（SpecManager L308 + adapter L142）
   - E2E 路径待定位

## DeepSeek 复审
- **第 1 轮**: 不通过（形式主义测试）
- **第 2 轮**: 指出 3 个测试 bug
- **第 3 轮**: ✅ 通过（测试合格，真问题确认）

## 裁决
- ✅ T-003 职责达成（建立协议测试体系，能暴露真问题）
- 🔴 3 个问题立 P0 修复任务（实现缺陷，非 T-003 阻塞）
- 修复后 3 失败转绿 → T-004/T-005/T-006 落库 → 04-00 T-023~T-026

## 红线固化
**测试不得空转**（本次两轮教训）：
- 条件跳过（if 条件存在才断言）
- 空循环（只有注释无断言）
- 自说自话（自己写死常量再断言）

## 交付物
1. ✅ `tests/integration/mcp-protocol-contract.test.ts`（263 行，14 测试）
2. ✅ `T-003-修正清单.md`（3 个真问题 + 修复方案）
3. ✅ 测试结果报告（11/14 通过）
4. ✅ Commit: 220c4c0

---

**Completed**: 2026-09-02  
**Reviewed by**: DeepSeek (3 轮复审通过)  
**Next**: P0 修复任务 → T-004/T-005/T-006 落库
