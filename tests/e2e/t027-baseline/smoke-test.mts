#!/usr/bin/env tsx
/**
 * T-027 Phase 1 冒烟验证
 *
 * 验证项：
 * 1. SHA A (45a86e15) 历史提交能否启动
 * 2. SHA B (6383e99) 当前提交能否启动
 * 3. wrapper 切换是否正常
 * 4. 三客户端 headless 是否真启用 MCP 工具（留待手工验证）
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const currentShaPath = resolve(here, 'current-sha.txt');

interface TestResult {
  sha: string;
  success: boolean;
  error?: string;
}

async function testSha(sha: 'sha-a' | 'sha-b'): Promise<TestResult> {
  console.log(`\n🧪 测试 ${sha}...`);

  // 切换 SHA
  writeFileSync(currentShaPath, sha);

  return new Promise((resolve) => {
    const child = spawn('tsx', ['wrapper.mts'], {
      cwd: here,
      timeout: 5000, // 5 秒超时
    });

    let output = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      output += data.toString();
    });

    child.on('error', (err) => {
      resolve({
        sha,
        success: false,
        error: `启动失败：${err.message}`,
      });
    });

    child.on('exit', (code) => {
      // MCP server 会持续运行，所以超时或手动终止是正常的
      // 只要没有立即崩溃就算成功
      if (output.includes('MCP') || output.includes('server') || output.includes('启动')) {
        resolve({
          sha,
          success: true,
        });
      } else {
        resolve({
          sha,
          success: false,
          error: `意外退出（code=${code}）\n输出：${output}`,
        });
      }
    });

    // 5 秒后认为启动成功（没崩溃）
    setTimeout(() => {
      child.kill();
      resolve({
        sha,
        success: true,
      });
    }, 5000);
  });
}

async function main() {
  console.log('🚀 T-027 Phase 1 冒烟验证');
  console.log('═'.repeat(50));

  const results: TestResult[] = [];

  // 测试 SHA A
  results.push(await testSha('sha-a'));

  // 测试 SHA B
  results.push(await testSha('sha-b'));

  // 输出结果
  console.log('\n📊 冒烟验证结果');
  console.log('═'.repeat(50));

  for (const result of results) {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    console.log(`${result.sha}: ${status}`);
    if (result.error) {
      console.log(`  错误：${result.error}`);
    }
  }

  const allPassed = results.every(r => r.success);

  console.log('\n📝 下一步');
  console.log('═'.repeat(50));

  if (allPassed) {
    console.log('✅ 冒烟验证通过！');
    console.log('');
    console.log('下一步：手工验证三客户端 headless MCP 工具调用');
    console.log('  1. Claude Code: 配置 lrnev-t027 后测试工具调用');
    console.log('  2. Codex: 配置 lrnev-t027 后测试工具调用');
    console.log('  3. OpenCode: 配置 lrnev-t027 后测试工具调用');
    console.log('');
    console.log('手工验证后报告 DeepSeek 复审。');
  } else {
    console.log('❌ 冒烟验证失败！');
    console.log('');
    console.log('请检查失败原因后重新运行。');
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ 冒烟验证脚本异常：', err);
  process.exit(1);
});
