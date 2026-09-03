# E-01 证据标注：INVALID（判定逻辑 bug）

- **run_id**: e-01-1788424396962-zcwhpzpx
- **状态**: INVALID - 判定逻辑解析 bug，非真实失败
- **时间**: 2026-09-03 16:33

## 问题

证据显示 `action_success: false`，但实际：
- spec_create 调用成功（ok: true）
- 创建了 `02-00-user-login` 在 `01-user-management`
- AI 输入 `scene: "user-management"`，服务端自动补全为 `"01-user-management"`

## 根因

harness 判定逻辑（旧版）只处理字符串格式 tool_result：
```javascript
if (typeof resultContent === 'string') {
  const parsed = JSON.parse(resultContent);
  resolvedData = parsed.data || ...;
}
```

但实际 `block.content` 是数组格式：
```javascript
[{type: "text", text: "{\"ok\":true,\"data\":{...}}"}]
```

导致 `resolvedData` 为空 → scene 参数判定失败。

## 修复

commit 9e39304 已修复三处解析逻辑，先检测数组格式提取 text。

## 处置

标注为 INVALID，保留历史。有效证据仍为 `e-01-1788402488324-d1fxqvvv`（sha-a）。
