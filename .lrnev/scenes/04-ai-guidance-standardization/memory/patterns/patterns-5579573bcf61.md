---
id: patterns-5579573bcf61
category: patterns
scope: 'scene:04-ai-guidance-standardization'
source: 用户指令（2026-08-27）
created: '2026-08-27T08:48:25.174Z'
reference_count: 0
---

执行 Scene 04 时，每完成一个 Spec 必须停止等待 DeepSeek 审查通过后再进入下一个；若某 Spec 需要真实客户端/真机测试，启动子 Agent 并要求通过 OpenCode 使用 DeepSeek V4 Flash，回传脱敏证据与结论。
