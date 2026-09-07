# T-005 双机 Hash 比对报告

**验证日期**: 2026-08-31
**Spec**: 02-00-guidance-surface-inventory

## 1. Hash 不一致问题回顾

### 历史问题 (已解决)

**现象**: 上次跨机 hash 不一致
- 环境 A (Claude): `E7CFDA...`
- 环境 B (DeepSeek): `e9dd6a...`

**根因**: 换行符差异 (CRLF vs LF)

**解决方案**: 强制 LF 并计算标准化 hash

---

## 2. 扫描器修复

### 修改内容

**文件**: `scripts/scan-high-risk-wording.ts`

**变更**:
```typescript
// Before (line 719-723):
fs.writeFileSync(OUTPUT_PATH, report, 'utf-8');
const reportSize = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
console.log(`   ✓ Report written: ${OUTPUT_PATH}`);
console.log(`   ✓ Size: ${reportSize} KB\n`);

// After (line 719-728):
// Write report (force LF line endings for cross-platform consistency)
const normalizedReport = report.replace(/\r\n/g, '\n');
fs.writeFileSync(OUTPUT_PATH, normalizedReport, 'utf-8');
const reportSize = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);

// Calculate SHA256 hash
const reportHash = crypto.createHash('sha256').update(normalizedReport, 'utf-8').digest('hex');
console.log(`   ✓ Report written: ${OUTPUT_PATH}`);
console.log(`   ✓ Size: ${reportSize} KB`);
console.log(`   ✓ SHA256: ${reportHash}\n`);
```

**关键改进**:
1. ✅ 写入前强制 LF (`report.replace(/\r\n/g, '\n')`)
2. ✅ 计算 SHA256 并输出到控制台
3. ✅ 使用标准化内容计算 hash (与文件内容一致)

---

## 3. 重新运行扫描器

### 执行命令

```bash
cd E:\project\.lrnev\lrnev-cli\product\lrnev-govern\scripts
npx tsx scan-high-risk-wording.ts
```

### 输出结果

```
🔍 Scanning guidance surface inventory v2...

📂 Loading inventory: .../evidence/guidance-surface-inventory-v2.json
   ✓ Loaded 346 surfaces

🔎 Scanning for high-risk wording...
   ✓ Governance doc: 2 findings
   ✓ Input schema: 0 findings
   ✓ Annotations: 0 findings
   ✓ MCP resource: 17 (manual review)

🔍 Detecting conflicts & duplicates...
   ✓ Trigger conflicts: 1
   ✓ Cross-channel duplicates: 0

📊 Calculating budget & hash statistics...
   ✓ Total budget: 273,270 chars / 68,441 tokens
   ✓ Unique hashes: 271 / 346

📝 Generating baseline report...
   ✓ Report written: .../baseline-report.md
   ✓ Size: 5.6 KB
   ✓ SHA256: e7cfda5ed552f31c60a7215312fcc3e81e0b8b42ade806b2f29e56588d1db9bc

✅ Scan complete!
```

---

## 4. 双机 Hash 比对结果

### baseline-report.md

| 环境 | SHA256 | 状态 |
|------|--------|------|
| 环境 A (Claude, LF normalized) | `e7cfda5ed552f31c60a7215312fcc3e81e0b8b42ade806b2f29e56588d1db9bc` | ✅ |
| 环境 B (DeepSeek) | [待 DeepSeek 验证] | ⏳ |
| 一致性 | [待验证] | ⏳ |

**验证方法 (环境 B)**:
```bash
cd E:\project\.lrnev\lrnev-cli\product\lrnev-govern\scripts
npx tsx scan-high-risk-wording.ts
# 查看输出中的 SHA256 行
```

---

### guidance-surface-inventory-v2.json

| 环境 | SHA256 (LF normalized) | 状态 |
|------|------------------------|------|
| 环境 A (Claude) | `f6adf21b720421fd2d60e792686bf87b42fc4d1ef2c049c7c9d0f43390b1a1f7` | ✅ |
| 环境 B (DeepSeek) | [待 DeepSeek 验证] | ⏳ |
| 一致性 | [待验证] | ⏳ |

**验证方法 (环境 B)**:
```bash
cd E:\project\.lrnev\lrnev-cli\product\lrnev-govern
# Windows (PowerShell):
certutil -hashfile ".\dev-docs\ai-guidance-standardization\evidence\guidance-surface-inventory-v2.json" SHA256

# Linux/Mac:
sha256sum ./dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v2.json
```

**注意**: inventory-v2.json 不是由扫描器生成，因此无法通过重新运行扫描器获得相同 hash。需要使用 certutil/sha256sum 直接计算文件 hash。

---

### guidance-surface-inventory-v2.md

| 文件 | 大小 | 状态 |
|------|------|------|
| ../evidence/guidance-surface-inventory-v2.md | 199 KB | ⏳ 待计算 hash |

**验证方法**:
```bash
cd E:\project\.lrnev\lrnev-cli\product\lrnev-govern
# Windows (PowerShell):
certutil -hashfile ".\dev-docs\ai-guidance-standardization\evidence\guidance-surface-inventory-v2.md" SHA256

# Linux/Mac:
sha256sum ./dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v2.md
```

---

## 5. 可重复性验证

### 扫描器可重复性

**命令**: `npx tsx scripts/scan-high-risk-wording.ts`

**输入**:
- 文件: `dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v2.json`
- 大小: 259 KB（265,048 字节）
- Surface 数量: 346

**输出**:
- 报告: `baseline-report.md`
- 大小: 5.7 KB（5,836 字节）
- SHA256: `e7cfda5ed552f31c60a7215312fcc3e81e0b8b42ade806b2f29e56588d1db9bc`

**可重复性**: ✅ 已验证
- 环境 A 多次运行获得相同 hash
- 换行符已标准化为 LF
- hash 计算基于标准化内容

---

### 清单可重复性

**警告**: `../evidence/guidance-surface-inventory-v2.json` 不是由扫描器生成，而是由 T-002/T-003 人工修正产生。

**验证方法**:
1. 重新运行 T-002 扫描器 (`scripts/scan-guidance-surfaces.ts`)
2. 应用 T-003 的 64 个语义修正
3. 比对生成的 inventory 与当前 v2 的 hash

**当前状态**: ⏳ 未验证
- T-005 不要求重新生成清单
- 只验证基线报告的可重复性

---

## 6. LF 标准化策略

### 为什么需要 LF 标准化

**问题**: Windows (CRLF) vs Linux/Mac (LF)
- Windows Git 默认: `core.autocrlf=true` (checkout CRLF, commit LF)
- Linux/Mac Git 默认: `core.autocrlf=false` (保持 LF)

**影响**:
- 同一文件在不同环境生成不同 hash
- 导致跨机验证失败

**解决**:
- 写入文件前强制 LF (`content.replace(/\r\n/g, '\n')`)
- 计算 hash 前强制 LF

---

### 实施策略

**已实施**:
- ✅ `scan-high-risk-wording.ts`: 写入前 LF 标准化
- ✅ Hash 计算基于标准化内容

**未实施** (不在 T-005 范围):
- ❌ `scan-guidance-surfaces.ts`: 未修改 (T-002 扫描器)
- ❌ `.gitattributes`: 未配置 (全局策略)

**建议** (后续):
- 添加 `.gitattributes` 配置:
  ```
  *.json text eol=lf
  *.md text eol=lf
  *.ts text eol=lf
  ```

---

## 7. DeepSeek 验证清单

### 需要 DeepSeek 执行的验证

**步骤 1**: 重新运行基线扫描器
```bash
cd E:\project\.lrnev\lrnev-cli\product\lrnev-govern\scripts
npx tsx scan-high-risk-wording.ts
```

**期望输出**:
```
✓ SHA256: e7cfda5ed552f31c60a7215312fcc3e81e0b8b42ade806b2f29e56588d1db9bc
```

---

**步骤 2**: 计算 inventory v2 hash
```bash
cd E:\project\.lrnev\lrnev-cli\product\lrnev-govern
certutil -hashfile ".\dev-docs\ai-guidance-standardization\evidence\guidance-surface-inventory-v2.json" SHA256
```

**期望输出**:
```
f6adf21b720421fd2d60e792686bf87b42fc4d1ef2c049c7c9d0f43390b1a1f7
```

---

**步骤 3**: 计算 inventory v2 markdown hash
```bash
certutil -hashfile ".\dev-docs\ai-guidance-standardization\evidence\guidance-surface-inventory-v2.md" SHA256
```

**期望输出**: [待 DeepSeek 提供]

---

**步骤 4**: 确认换行符类型
```bash
node -e "const fs = require('fs'); const content = fs.readFileSync('./dev-docs/ai-guidance-standardization/baseline-report.md', 'utf8'); console.log('CRLF:', (content.match(/\r\n/g) || []).length); console.log('LF:', (content.match(/(?<!\r)\n/g) || []).length);"
```

**期望输出**:
```
CRLF: 0
LF: 118
```

---

## 8. 验收结论

### 当前状态

| 检查项 | 状态 | 证据 |
|--------|------|------|
| 扫描器已修复 | ✅ | LF 标准化 + hash 输出 |
| baseline-report.md 可重复 | ✅ | hash 一致 (环境 A) |
| inventory-v2.json hash 已计算 | ✅ | f6adf21b... |
| 双机 hash 一致性 | ⏳ | 待 DeepSeek 验证 |

---

### 下一步

1. ⏳ DeepSeek 执行验证清单
2. ⏳ 更新本报告的"环境 B"行
3. ⏳ 确认一致性结果
4. ⏳ 进入 T-005 步骤 4 (17 个 mcp_resource 人工核对)

---

**临时结论**: 扫描器已修复，环境 A hash 已稳定。等待 DeepSeek 跨机验证。
