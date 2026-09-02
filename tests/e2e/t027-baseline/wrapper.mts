#!/usr/bin/env tsx
/**
 * T-027 双 SHA wrapper
 *
 * 功能：读取 current-sha.txt 指针，切换到对应 worktree 启动 MCP server
 * SHA A = 45a86e15 (B0 基线)
 * SHA B = 6383e99 (收尾后，不含 Profile)
 *
 * 使用：
 * - 切换到 SHA A: echo "sha-a" > current-sha.txt
 * - 切换到 SHA B: echo "sha-b" > current-sha.txt
 * - 启动 server: tsx wrapper.mts
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const currentShaPath = resolve(here, 'current-sha.txt');

// 读取当前 SHA 指针
const currentSha = readFileSync(currentShaPath, 'utf-8').trim();

if (currentSha !== 'sha-a' && currentSha !== 'sha-b') {
  console.error(`❌ 无效的 SHA 指针：${currentSha}（应为 sha-a 或 sha-b）`);
  process.exit(1);
}

// 构建 worktree 路径
const worktreePath = resolve(here, currentSha);
const serverPath = resolve(worktreePath, 'src/mcp/server.ts');

console.log(`🔀 T-027 双 SHA wrapper`);
console.log(`📍 当前 SHA：${currentSha}`);
console.log(`📂 Worktree：${worktreePath}`);
console.log(`🚀 启动 MCP server：${serverPath}`);
console.log('');

// 启动 MCP server
const child = spawn('tsx', [serverPath], {
  cwd: worktreePath,
  stdio: 'inherit',
  shell: true,
});

child.on('error', (err) => {
  console.error(`❌ 启动失败：${err.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
