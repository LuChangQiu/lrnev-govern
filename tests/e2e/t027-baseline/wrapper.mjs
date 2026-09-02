#!/usr/bin/env node
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
 * - 启动 server: node tests/e2e/t027-baseline/wrapper.mjs
 *
 * 注意：
 * - 指针文件在 .claude/t027-worktrees/current-sha.txt（gitignore 区）
 * - worktrees 在 .claude/t027-worktrees/sha-{a,b}/
 * - wrapper 从项目根目录显式解析路径
 * - 所有日志走 stderr（stdout 是 JSON-RPC 通道）
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 显式解析到项目根目录（向上查找 package.json）
function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== resolve(dir, '..')) {
    if (existsSync(resolve(dir, 'package.json'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  throw new Error('未找到项目根目录（package.json）');
}

const projectRoot = findProjectRoot(__dirname);
const worktreeBaseDir = resolve(projectRoot, '.claude/t027-worktrees');
const currentShaPath = resolve(worktreeBaseDir, 'current-sha.txt');
const mcpEntryPath = resolve(worktreeBaseDir, 'mcp-entry.mjs');

// 如果 gitignore 区垫片不存在，从入库版本复制
const inRepoEntryPath = resolve(projectRoot, 'tests/e2e/t027-baseline/mcp-entry.mjs');
if (!existsSync(mcpEntryPath) && existsSync(inRepoEntryPath)) {
  console.error(`⚠️  垫片不存在，从入库版本复制：${mcpEntryPath}`);
  const { copyFileSync } = await import('node:fs');
  copyFileSync(inRepoEntryPath, mcpEntryPath);
}

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

// 验证 worktree 存在
if (!existsSync(worktreePath)) {
  console.error(`❌ Worktree 不存在：${worktreePath}`);
  console.error(`提示：git worktree add ${worktreePath} <commit-sha>`);
  process.exit(1);
}

// 验证垫片入口存在
if (!existsSync(mcpEntryPath)) {
  console.error(`❌ MCP 垫片入口不存在：${mcpEntryPath}`);
  process.exit(1);
}

console.error(`🔀 T-027 双 SHA wrapper`);
console.error(`📍 当前 SHA：${currentSha}`);
console.error(`📂 Worktree：${worktreePath}`);
console.error(`🚀 启动 MCP server（通过垫片入口）`);
console.error('');

// 启动 MCP server（node + tsx + 垫片入口）
// 透传 LRNEV_WORKSPACE 等环境变量给 server
const child = spawn('node', ['--import', 'tsx', mcpEntryPath], {
  cwd: worktreePath,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    // 如果调用方设置了 LRNEV_WORKSPACE，优先使用；否则用 worktree 目录
    LRNEV_WORKSPACE: process.env.LRNEV_WORKSPACE || worktreePath
  }
});

child.on('error', (err) => {
  console.error(`❌ 启动失败：${err.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
