# E2E Reverify Codex - lrnev v2.1.0

Date: 2026-06-17
Workspace: `E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty`

## Precheck

Command:

```powershell
lrnev --workspace 'E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty' --version
```

Key output:

```text
2.1.0
```

Fresh init command:

```powershell
lrnev --workspace 'E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty' --json init
```

Key output:

```json
{
  "ok": true,
  "data": {
    "root": "E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty",
    "was_new": true,
    "files_created": [
      ".lrnev/config/hooks.json",
      ".lrnev/scenes/00-default/scene.md"
    ]
  }
}
```

## 1. Unknown Gate

Result: PASS

Command:

```powershell
lrnev --workspace 'E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty' --json gate check --scene 00-default --spec anything --gate bogus
```

Key output:

```json
{
  "ok": false,
  "errors": [
    {
      "code": "INVALID_INPUT",
      "message": "未知 gate 类型：\"bogus\"",
      "field": "gate",
      "hint": "gate 只接受 creation / ready / completion。"
    }
  ]
}
```

Judgement: returned structured `ok:false` with error code `INVALID_INPUT`; no `undefined` output or crash.

## 2. Init hooks.json

Result: PASS

Commands:

```powershell
Test-Path '.lrnev/config/hooks.json'
Get-Content -Raw '.lrnev/config/hooks.json'
```

Key output:

```text
True
[]
```

Judgement: fresh init created `.lrnev/config/hooks.json`, and its content is the empty JSON array `[]`.

## 3. error record --tags

Result: PASS

Command:

```powershell
lrnev --workspace 'E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty' --json error record --symptom s1 --root-cause r1 --fix-action f1 --tags alpha beta
```

Key output:

```json
{
  "ok": true,
  "data": {
    "id": "440ed293b625",
    "tags": [
      "alpha",
      "beta"
    ],
    "body": {
      "symptom": "s1",
      "root_cause": "r1",
      "fix_action": "f1"
    }
  }
}
```

Judgement: `data.tags` contains both `alpha` and `beta`.

## 4. CLI Requirement Review Gate Parity

Result: PASS

Setup command:

```powershell
lrnev --workspace 'E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty' --json spec create reviewgate
```

Key output:

```json
{
  "ok": true,
  "data": {
    "spec": "01-00-reviewgate",
    "scene": "00-default",
    "status": "draft"
  }
}
```

Edited `.lrnev/scenes/00-default/specs/01-00-reviewgate/requirements.md` to remove all `FILL` sentinels, add a real `#### F-01 Ready gate 需求审核提示`, and check the acceptance checklist.

CLI command:

```powershell
lrnev --workspace 'E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty' --json gate check --scene 00-default --spec 01-00-reviewgate --gate ready
```

CLI key output:

```json
{
  "ok": true,
  "data": {
    "gate": "ready",
    "passed": true,
    "checks": [
      { "name": "requirements_no_fill_sentinels", "passed": true },
      { "name": "requirements_acceptance_checked", "passed": true }
    ]
  },
  "ai_followup": {
    "instructions": [
      "ready gate 已通过：requirements 结构契约完整。",
      "请暂停：把 requirements.md 展示给用户确认「做什么」后再继续——这是用户审核需求方向的唯一人工门，确认后再建 task 与设计；如用户明确说「直接做」则可跳过。"
    ]
  }
}
```

MCP command:

```powershell
$env:LRNEV_WORKSPACE='E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty'
@'
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const workspace = 'E:/project/.lrnev/lrnev-cli/.tmp/e2e-codex/empty';
const serverPath = 'E:/project/.lrnev/lrnev-cli/product/lrnev-govern/bin/lrnev-mcp.mjs';
const transport = new StdioClientTransport({
  command: 'node',
  args: [serverPath],
  env: { ...process.env, LRNEV_WORKSPACE: workspace },
});
const client = new Client({ name: 'codex-e2e-reverify', version: '1.0.0' });
await client.connect(transport);
const result = await client.callTool({
  name: 'spec_gate_check',
  arguments: { scene: '00-default', spec: '01-00-reviewgate', gate: 'ready' },
});
console.log(JSON.stringify(result, null, 2));
await client.close();
'@ | node --input-type=module -
```

MCP key output:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"ok\": true,\n  \"data\": {\n    \"gate\": \"ready\",\n    \"passed\": true\n  },\n  \"ai_followup\": {\n    \"instructions\": [\n      \"ready gate 已通过：requirements 结构契约完整。\",\n      \"请暂停：把 requirements.md 展示给用户确认「做什么」后再继续——这是用户审核需求方向的唯一人工门，确认后再建 task 与设计；如用户明确说「直接做」则可跳过。\"\n    ]\n  }\n}"
    }
  ]
}
```

Judgement: CLI ready gate returns `ai_followup.instructions` containing `请暂停`; MCP `spec_gate_check` ready returns the same requirement-review pause instruction.

## Summary

4 个修复都生效：未知 gate、fresh init hooks.json、`error record --tags`、CLI/MCP ready gate 需求审核提示对等，全部 PASS。
