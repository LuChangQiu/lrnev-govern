#!/usr/bin/env tsx
/**
 * T-027 双 SHA wrapper
 *
 * 功能：读取 current-sha.txt 指针，切换到对应 worktree 启动 MCP server
 * SHA A = 45a86e15 (B0 基线)
 * SHA B = 6383e99 (收尾后，不含 Profile)
 *
 * 使用：
 * - 切换到 SHA A: echo "sha-a" > .claude/t027-worktrees/current-sha.txt
 * - 切换到 SHA B: echo "sha-b" > .claude/t027-worktrees/current-sha.txt
 * - 启动 server: tsx tests/e2e/t027-baseline/wrapper.mts
 *
 * 注意：
 * - 指针文件在 .claude/t027-worktrees/current-sha.txt（gitignore 区）
 * - worktrees 在 .claude/t027-worktrees/sha-{a,b}/
 * - wrapper 从项目根目录显式解析路径
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// 显式解析到项目根目录（向上查找 package.json）
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== resolve(dir, '..')) {
    if (existsSync(resolve(dir, 'package.json'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  throw new Error('未找到项目根目录（package.json）');
}

const projectRoot = findProjectRoot(process.cwd());
const worktreeBaseDir = resolve(projectRoot, '.claude/t027-worktrees');
const currentShaPath = resolve(worktreeBaseDir, 'current-sha.txt');

// 读取当前 SHA 指针
if (!existsSync(currentShaPath)) {
  console.error(`❌ 指针文件不存在：${currentShaPath}`);
  console.error(`提示：echo "sha-a" > ${currentShaPath}`);
  process.exit(1);
}

const currentSha = readFileSync(currentShaPath, 'utf-8').trim();

if (currentSha !== 'sha-a' && currentSha !== 'sha-b') {
  console.error(`❌ 无效的 SHA 指针：${currentSha}（应为 sha-a 或 sha-b）`);
  process.exit(1);
}

// 构建 worktree 路径（显式指向 .claude/t027-worktrees/）
const worktreePath = resolve(worktreeBaseDir, currentSha);
const serverPath = resolve(worktreePath, 'src/mcp/server.ts');

// 验证 worktree 存在
if (!existsSync(worktreePath)) {
  console.error(`❌ Worktree 不存在：${worktreePath}`);
  console.error(`提示：git worktree add ${worktreePath} <commit-sha>`);
  process.exit(1);
}

if (!existsSync(serverPath)) {
  console.error(`❌ MCP server 不存在：${serverPath}`);
  process.exit(1);
}

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
