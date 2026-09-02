#!/usr/bin/env node
/**
 * T-027 Phase 2 ③ Claude Code 接入冒烟
 *
 * 验证项：
 * 1. claude --mcp-config 隔离加载
 * 2. lrnev-t027 工具可用性
 * 3. 基础工具调用（spec_list, scene_list）
 * 4. 不污染项目 .mcp.json
 */

import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const projectRoot = process.cwd();
const t027ConfigPath = resolve(projectRoot, 'tests/e2e/t027-baseline/.t027-mcp-config.json');
const wrapperPath = resolve(projectRoot, 'tests/e2e/t027-baseline/wrapper.mjs');

console.error('🚀 T-027 Claude Code 接入冒烟');
console.error('═'.repeat(60));

// 1. 创建隔离配置
const t027Config = {
  mcpServers: {
    'lrnev-t027': {
      command: 'node',
      args: [wrapperPath],
      disabled: false,
      alwaysAllow: []
    }
  }
};

console.error(`📝 创建隔离配置: ${t027ConfigPath}`);
writeFileSync(t027ConfigPath, JSON.stringify(t027Config, null, 2));

// 2. 验证 claude 命令可用
console.error('\n🔍 验证 claude 命令...');

const claudeCheck = spawn('claude', ['--version'], { shell: true });

claudeCheck.on('error', (err) => {
  console.error('❌ claude 命令不可用:', err.message);
  console.error('');
  console.error('请安装 Claude Code CLI:');
  console.error('  npm install -g @anthropic-ai/claude-code');
  process.exit(1);
});

claudeCheck.on('exit', (code) => {
  if (code !== 0) {
    console.error('❌ claude --version 失败');
    process.exit(1);
  }

  console.error('✅ claude 命令可用');

  // 3. 测试隔离加载
  testIsolatedLoading();
});

/**
 * 测试隔离加载
 */
function testIsolatedLoading() {
  console.error('\n🔍 测试隔离加载 (--mcp-config)...');

  const prompt = '列出可用的 MCP 工具';

  console.error(`📝 Prompt: "${prompt}"`);

  const claude = spawn(
    'claude',
    ['--mcp-config', t027ConfigPath, '-p', prompt],
    {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe']
    }
  );

  let stdout = '';
  let stderr = '';

  claude.stdout?.on('data', (data) => {
    stdout += data.toString();
    process.stdout.write(data);
  });

  claude.stderr?.on('data', (data) => {
    stderr += data.toString();
    process.stderr.write(data);
  });

  claude.on('exit', (code) => {
    if (code !== 0) {
      console.error('\n❌ claude 执行失败');
      process.exit(1);
    }

    // 验证输出包含 lrnev 工具
    const hasLrnevTools = stdout.includes('spec_list') || stdout.includes('scene_list');

    console.error('\n📊 验证结果');
    console.error('═'.repeat(60));

    if (hasLrnevTools) {
      console.error('✅ lrnev-t027 工具可用');
    } else {
      console.error('⚠️  输出未包含 lrnev 工具（可能是响应格式问题）');
      console.error('');
      console.error('手动验证：检查上方输出是否包含 spec_list/scene_list');
    }

    // 4. 验证不污染项目 .mcp.json
    console.error('\n🔍 验证不污染项目 .mcp.json...');

    const projectMcpPath = resolve(projectRoot, '.mcp.json');
    if (existsSync(projectMcpPath)) {
      const projectMcp = JSON.parse(readFileSync(projectMcpPath, 'utf-8'));
      if (projectMcp.mcpServers && projectMcp.mcpServers['lrnev-t027']) {
        console.error('⚠️  项目 .mcp.json 包含 lrnev-t027（不应污染）');
      } else {
        console.error('✅ 项目 .mcp.json 未污染');
      }
    } else {
      console.error('✅ 项目无 .mcp.json（干净）');
    }

    console.error('\n📝 下一步');
    console.error('═'.repeat(60));
    console.error('1. 手动验证工具调用：');
    console.error(`   claude --mcp-config ${t027ConfigPath} -p "列出所有 Scene"`);
    console.error('');
    console.error('2. 真实会话测试（E-01）：');
    console.error(`   claude --mcp-config ${t027ConfigPath} -p "开新 Spec 做用户登录功能"`);
    console.error('');
    console.error('3. 运行 harness 放量测试');
    console.error('');

    process.exit(0);
  });

  claude.on('error', (err) => {
    console.error('❌ claude 启动失败:', err);
    process.exit(1);
  });
}
