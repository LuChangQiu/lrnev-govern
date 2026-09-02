#!/usr/bin/env node
/**
 * T-027 Phase 1 冒烟验证（真实 MCP 握手 + wrapper 全链）
 *
 * 验证项：
 * 1. SHA A (45a86e15) 通过 wrapper 启动并完成 MCP initialize 握手
 * 2. SHA B (6383e99) 通过 wrapper 启动并完成 MCP initialize 握手
 * 3. tools/list 返回工具清单
 * 4. 按 SHA 记录工具清单摘要（验证单变量）
 *
 * 全链验证：
 * - 通过 wrapper.mjs 启动（不绕过）
 * - 真实 stdio 通信
 * - 验证 initialize response
 * - 验证 tools/list response
 * - 记录工具清单 hash
 */

import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== resolve(dir, '..')) {
    if (existsSync(resolve(dir, 'package.json'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  throw new Error('未找到项目根目录');
}

async function testSha(sha, projectRoot, wrapperPath) {
  console.error(`\n🧪 测试 ${sha}...`);

  const worktreeBaseDir = resolve(projectRoot, '.claude/t027-worktrees');
  const currentShaPath = resolve(worktreeBaseDir, 'current-sha.txt');

  // 切换 SHA
  writeFileSync(currentShaPath, sha);

  return new Promise((resolvePromise) => {
    const child = spawn('node', [wrapperPath], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    let jsonrpcBuffer = '';
    let stderrBuffer = '';
    let initializeReceived = false;
    let toolsListReceived = false;
    let toolsList = [];

    const timeout = setTimeout(() => {
      child.kill();
      resolvePromise({
        sha,
        success: false,
        error: '超时（15 秒）未完成 MCP 握手',
        stderr: stderrBuffer,
      });
    }, 15000);

    child.stdout?.on('data', (data) => {
      jsonrpcBuffer += data.toString();

      // 解析 JSON-RPC 响应
      const lines = jsonrpcBuffer.split('\n');
      jsonrpcBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const response = JSON.parse(line);

          // initialize response
          if (response.result && response.result.protocolVersion) {
            initializeReceived = true;
            console.error(`  ✅ initialize 握手成功`);

            // 发送 tools/list 请求
            const toolsListRequest = {
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/list',
              params: {},
            };
            child.stdin?.write(JSON.stringify(toolsListRequest) + '\n');
          }

          // tools/list response
          if (response.result && Array.isArray(response.result.tools)) {
            toolsListReceived = true;
            toolsList = response.result.tools;
            console.error(`  ✅ tools/list 返回 ${toolsList.length} 个工具`);

            clearTimeout(timeout);
            child.kill();

            // 计算工具清单 hash
            const toolNames = toolsList.map(t => t.name).sort();
            const toolsHash = createHash('sha256').update(JSON.stringify(toolNames)).digest('hex').slice(0, 8);

            resolvePromise({
              sha,
              success: true,
              serverInfo: response.result.serverInfo,
              toolsListHash: toolsHash,
              toolCount: toolsList.length,
              stderr: stderrBuffer,
            });
          }
        } catch (err) {
          // 忽略非 JSON 行
        }
      }
    });

    child.stderr?.on('data', (data) => {
      const stderr = data.toString();
      stderrBuffer += stderr;
      // 实时输出 stderr（wrapper 日志）
      process.stderr.write(stderr);
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      resolvePromise({
        sha,
        success: false,
        error: `spawn 失败：${err.message}`,
        stderr: stderrBuffer,
      });
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      if (!initializeReceived || !toolsListReceived) {
        resolvePromise({
          sha,
          success: false,
          error: `提前退出（code=${code}, signal=${signal}），未完成 MCP 握手`,
          stderr: stderrBuffer,
        });
      }
    });

    // 发送 initialize 请求
    const initializeRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 't027-smoke-test',
          version: '1.0.0',
        },
      },
    };

    child.stdin?.write(JSON.stringify(initializeRequest) + '\n');
  });
}

async function main() {
  console.error('🚀 T-027 Phase 1 冒烟验证（真实 MCP 握手 + wrapper 全链）');
  console.error('═'.repeat(60));

  const projectRoot = findProjectRoot(__dirname);
  const worktreeBaseDir = resolve(projectRoot, '.claude/t027-worktrees');
  const wrapperPath = resolve(projectRoot, 'tests/e2e/t027-baseline/wrapper.mjs');

  // 验证 worktrees 存在
  if (!existsSync(worktreeBaseDir)) {
    console.error('❌ Worktrees 目录不存在');
    console.error(`提示：创建 worktrees：`);
    console.error(`  git worktree add ${resolve(worktreeBaseDir, 'sha-a')} 45a86e15`);
    console.error(`  git worktree add ${resolve(worktreeBaseDir, 'sha-b')} 6383e99`);
    process.exit(1);
  }

  // 验证 wrapper 存在
  if (!existsSync(wrapperPath)) {
    console.error(`❌ Wrapper 不存在：${wrapperPath}`);
    process.exit(1);
  }

  const results = [];

  // 测试 SHA A
  results.push(await testSha('sha-a', projectRoot, wrapperPath));

  // 测试 SHA B
  results.push(await testSha('sha-b', projectRoot, wrapperPath));

  // 输出结果
  console.error('\n📊 冒烟验证结果');
  console.error('═'.repeat(60));

  for (const result of results) {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    console.error(`\n${result.sha}: ${status}`);
    if (result.error) {
      console.error(`  错误：${result.error}`);
    }
    if (result.toolCount !== undefined) {
      console.error(`  工具数量：${result.toolCount}`);
      console.error(`  工具清单 hash：${result.toolsListHash}`);
    }
  }

  const allPassed = results.every(r => r.success);

  // 保存工具清单摘要
  if (allPassed) {
    const summaryDir = resolve(projectRoot, 'tests/e2e/t027-baseline/.smoke-results');
    if (!existsSync(summaryDir)) {
      mkdirSync(summaryDir, { recursive: true });
    }

    const summary = {
      timestamp: new Date().toISOString(),
      results: results.map(r => ({
        sha: r.sha,
        toolCount: r.toolCount,
        toolsListHash: r.toolsListHash,
      })),
    };

    const summaryPath = resolve(summaryDir, 'tools-summary.json');
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.error(`\n✅ 工具清单摘要已保存：${summaryPath}`);
  }

  console.error('\n📝 下一步');
  console.error('═'.repeat(60));

  if (allPassed) {
    console.error('✅ 冒烟验证通过！');
    console.error('');
    console.error('下一步：手工验证三客户端 headless MCP 工具调用');
    console.error('  1. 配置客户端使用 lrnev-t027');
    console.error('  2. 测试至少一个客户端的工具调用');
    console.error('  3. 报告 DeepSeek 复审');
  } else {
    console.error('❌ 冒烟验证失败！');
    console.error('');
    console.error('请检查失败原因后重新运行。');
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ 冒烟验证脚本异常：', err);
  process.exit(1);
});
