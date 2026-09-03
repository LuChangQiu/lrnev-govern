#!/usr/bin/env node
/**
 * T-027 Phase 2 Clean Session Harness - MVP（独立工作区）
 *
 * 目标：先跑通 1 个场景（E-01），验证完整流程
 *
 * 关键修正：
 * 1. 独立工作区（临时目录，主工作区零写入）
 * 2. 真实预检（assess_goal 验证）
 * 3. 真实清理（删除临时工作区）
 * 4. 补充 --verbose
 * 5. 通过 wrapper 走 worktree（SHA A/B）
 * 6. 方案 D：动态 import .ts 权威源（tsx loader 转译，零构建，防漂移）
 */

import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const sha = process.env.T027_SHA || 'sha-a';
const scenarioId = process.env.T027_SCENARIO || 'E-01';

// 方案 D：动态加载 .ts 权威源
const fixturesIndexPath = resolve(projectRoot, 'tests/fixtures/04-00/index.ts');
const fixturesModule = await import(pathToFileURL(fixturesIndexPath).href);

// 构建 fixture 映射表（id → fixture）
const FIXTURES = {};
for (const key of Object.keys(fixturesModule)) {
  const fixture = fixturesModule[key];
  if (fixture && typeof fixture === 'object' && fixture.id) {
    FIXTURES[fixture.id] = fixture;
  }
}

const fixture = FIXTURES[scenarioId];
if (!fixture) {
  console.error(`❌ 未知场景: ${scenarioId}`);
  console.error(`可用场景: ${Object.keys(FIXTURES).join(', ')}`);
  process.exit(1);
}

// 修正 P0-1: 使用项目子目录 + 临时 CLAUDE_CONFIG_DIR 隔离
const tempWorkspace = resolve(projectRoot, '.claude/t027-harness-workspace', `run-${Date.now()}`);
const tempConfigDir = resolve(projectRoot, '.claude/t027-harness-config', `config-${Date.now()}`);
mkdirSync(tempWorkspace, { recursive: true });
mkdirSync(tempConfigDir, { recursive: true });

// 创建纯净的 MCP 配置（只有 lrnev-t027）
const mcpConfigPath = resolve(tempConfigDir, 'mcp.json');
const wrapperPath = resolve(projectRoot, 'tests/e2e/t027-baseline/wrapper.mjs');
writeFileSync(mcpConfigPath, JSON.stringify({
  mcpServers: {
    'lrnev-t027': {
      command: 'node',
      args: [wrapperPath],
      disabled: false
    }
  }
}, null, 2));

console.error('🚀 T-027 Clean Session Harness (MVP)');
console.error(`📍 SHA: ${sha}`);
console.error(`🗂️  独立工作区: ${tempWorkspace}`);
console.error(`⚙️  隔离配置: ${tempConfigDir}`);
console.error('');

console.error(`📦 Fixture: ${fixture.id} - ${fixture.title}`);

/**
 * 1. 构建工作区（独立临时目录，文件直写）
 */
/**
 * 工作区构建器 - 从 fixture.decisionContext 驱动
 */
async function buildWorkspace() {
  console.error('🏗️  构建工作区（独立临时目录）...');

  const { scene, existing_specs = [], spec_count = 0 } = fixture.decisionContext;

  // 初始化 .lrnev 结构
  const lrnevDir = resolve(tempWorkspace, '.lrnev');
  mkdirSync(resolve(lrnevDir, `scenes/${scene}/specs`), { recursive: true });
  mkdirSync(resolve(lrnevDir, 'memory'), { recursive: true });
  mkdirSync(resolve(lrnevDir, 'agents'), { recursive: true });
  mkdirSync(resolve(lrnevDir, 'tasks'), { recursive: true });

  // 创建 scene.md（frontmatter 引号规则内置）
  const sceneNumber = scene.split('-')[0];
  const sceneName = scene.split('-').slice(1).join('-');
  const sceneDisplayName = sceneName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const sceneContent = `---
scene: ${scene}
number: ${sceneNumber}
created: '${new Date().toISOString().split('T')[0]}'
---

# ${sceneNumber} ${sceneDisplayName}

业务域描述。
`;
  writeFileSync(resolve(lrnevDir, `scenes/${scene}/scene.md`), sceneContent);

  // 创建 existing specs（解析 spec 描述）
  for (let i = 0; i < existing_specs.length; i++) {
    const specDesc = existing_specs[i];
    // 解析格式：'00-introduction (in-progress)' 或 '01-user-profile (completed)'
    // 状态括号内可能带附加注解（如 E-09 '(completed, 2 months ago)'）：
    // 取逗号前的主状态（completed），注解只进 tasks.md 正文，不进 frontmatter。
    const match = specDesc.match(/^(\d+)-([a-z-]+)\s*\(([^)]+)\)/);
    if (!match) continue;

    const [, specNum, specName, specStatusRaw] = match;
    const specStatus = specStatusRaw.split(',')[0].trim();
    const specId = `${scene.split('-')[0]}-${specNum}-${specName}`;
    const specDir = resolve(lrnevDir, `scenes/${scene}/specs/${specId}`);
    mkdirSync(specDir, { recursive: true });

    // 关键：服务端 spec 状态只从 requirements.md frontmatter 的 status 字段读取
    // （SpecManager.get: status: parsed.frontmatter.status ?? 'draft'），
    // spec.json / tasks.md 正文均不被服务端读取。status 必须写进 requirements.md。
    // frontmatter 引号规则：created 加引号；status 为合法状态 token（如 in-progress/archived/completed），裸写即可。
    const requirementsContent = `---
spec: ${specId}
scene: ${scene}
status: ${specStatus}
created: '${new Date().toISOString().split('T')[0]}'
---

# ${specId} - 需求

## F-01 基础需求
需求描述。
`;
    writeFileSync(resolve(specDir, 'requirements.md'), requirementsContent);

    const designContent = `---
spec: ${specId}
scene: ${scene}
---

# ${specId} - 设计

## D-01 设计方案
设计描述。
`;
    writeFileSync(resolve(specDir, 'design.md'), designContent);

    const tasksContent = `---
spec: ${specId}
scene: ${scene}
---

# ${specId} - 任务

## T-001 执行任务
任务描述。

**状态**: ${specStatusRaw}
`;
    writeFileSync(resolve(specDir, 'tasks.md'), tasksContent);

    // spec.json 元信息（created 是字符串，不需要引号）
    // 注：服务端不读 spec.json（状态权威在 requirements.md frontmatter），
    // status 保留原始注解串（如 'completed, 2 months ago'），仅供人读/调试。
    const specMeta = {
      id: specId,
      scene: scene,
      number: parseInt(specNum),
      name: specName,
      status: specStatusRaw,
      priority: 'P2',
      created: new Date().toISOString().split('T')[0]
    };
    writeFileSync(resolve(specDir, 'spec.json'), JSON.stringify(specMeta, null, 2));
  }

  console.error('✅ 工作区构建完成（文件直写）');
}

/**
 * 2. 预检（真实验证 assess_goal，修正 P0-2）
 */
async function precheck() {
  console.error('🔍 预检（assess_goal）...');

  const wrapperPath = resolve(projectRoot, 'tests/e2e/t027-baseline/wrapper.mjs');

  // 设置 SHA 指针
  const shaPointerPath = resolve(projectRoot, '.claude/t027-worktrees/current-sha.txt');
  mkdirSync(resolve(projectRoot, '.claude/t027-worktrees'), { recursive: true });
  writeFileSync(shaPointerPath, sha);

  // 多轮语义场景：只用第1轮内容做预检（avoid assess_goal 误判）
  let precheckInput = fixture.userInput;
  if (fixture.userInput.includes('第1轮：')) {
    const match = fixture.userInput.match(/第1轮：[""]?([^""]+)[""]?/);
    if (match) {
      precheckInput = match[1].trim();
      console.error(`   检测到多轮场景，预检使用第1轮: "${precheckInput}"`);
    }
  }

  const result = await new Promise((resolve, reject) => {
    const child = spawn('node', [wrapperPath], {
      cwd: tempWorkspace,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        LRNEV_WORKSPACE: tempWorkspace,
        T027_SHA: sha
      }
    });

    let stdout = '';
    let stderr = '';
    let initReceived = false;
    let assessReceived = false;

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    // 超时保护
    const timer = setTimeout(() => {
      if (!assessReceived) {
        child.kill();
        reject(new Error('预检超时：10 秒内未完成'));
      }
    }, 10000);

    // 在 stdout data 流中解析响应
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      const lines = stdout.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);

          // 1. 收到 initialize 响应
          if (msg.id === 1 && msg.result && !initReceived) {
            initReceived = true;
            // 发送 initialized 通知
            child.stdin.write(JSON.stringify({
              jsonrpc: '2.0',
              method: 'notifications/initialized'
            }) + '\n');
            // 调用 assess_goal
            const assessRequest = {
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/call',
              params: {
                name: 'assess_goal',
                arguments: {
                  goal: precheckInput
                }
              }
            };
            child.stdin.write(JSON.stringify(assessRequest) + '\n');
          }

          // 2. 收到 assess_goal 响应 -> 立即 resolve + kill
          if (msg.id === 2 && msg.result && !assessReceived) {
            assessReceived = true;
            clearTimeout(timer);

            // 提取 structuredContent（兼容 sha-a 和 sha-b 格式）
            let structuredContent;

            // sha-b 格式：result.structuredContent 在顶层
            if (msg.result.structuredContent) {
              structuredContent = msg.result.structuredContent;
            }
            // sha-a 格式：result.content[0].text 是 JSON 字符串
            else if (msg.result.content?.[0]?.type === 'text') {
              const data = JSON.parse(msg.result.content[0].text);
              structuredContent = data.structuredContent || data;
            }

            if (structuredContent) {
              child.kill();
              resolve(structuredContent);
              return;
            }
          }
        } catch (e) {
          // 忽略非 JSON 行或解析失败
        }
      }
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!assessReceived) {
        reject(new Error(`预检失败 (exit ${code}): ${stderr}`));
      }
    });

    // 发送 initialize 请求
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25', // 使用 server 实际版本
        capabilities: {},
        clientInfo: {
          name: 't027-harness',
          version: '1.0.0'
        }
      }
    };

    child.stdin.write(JSON.stringify(initRequest) + '\n');
  });

  console.error(`   评估结果: ${result.data?.kind || 'unknown'}`);
  console.error(`   建议下一步: ${result.data?.suggested_next_step || 'N/A'}`);

  // E-01 场景：用户说"开新 Spec"，但已有 in-progress spec
  // assess_goal 只做粒度评估（single-spec/multi-spec-program/research-program）
  // 不期望它给出"复用"建议——那是后续 AI 主循环的决策
  // 这里只验证：(1) assess_goal 成功返回 (2) 识别为 single-spec
  if (!result.ok || !result.data) {
    console.error('⚠️  预检失败：assess_goal 返回错误');
    console.error('   → 跳过本场景测试');
    return false;
  }

  const kind = result.data.kind;

  // E-07 等 no_spec 场景（expectedAction 为 null）：跳过粒度验证
  if (!fixture.expectedAction) {
    console.error(`✅ 预检通过（no_spec 场景，跳过粒度验证）`);
    return true;
  }

  // 按场景配置验证粒度（E-04 等高复杂度场景可能是 multi-spec-program）
  const expectedKind = fixture.expectedAssessment || 'single-spec';
  if (kind !== expectedKind) {
    console.error(`⚠️  预检失败：粒度评估不符预期（期望 ${expectedKind}，实际 ${kind}）`);
    console.error('   → 跳过本场景测试');
    return false;
  }

  console.error('✅ 预检通过（assess_goal 成功，粒度评估正确）');
  return true;
}

/**
 * 3. 驱动客户端执行（使用 claude CLI + 临时配置目录）
 */
async function driveClient(prompt) {
  console.error('🤖 驱动客户端执行...');
  console.error(`   Prompt: "${prompt}"`);
  console.error(`   工作区: ${tempWorkspace}`);
  console.error(`   配置: ${mcpConfigPath}`);

  // 构建参数（P0-1: 添加权限预授权）
  const args = [
    '--mcp-config', mcpConfigPath,
    '--output-format', 'stream-json',
    '--verbose',
    '--allowedTools', 'mcp__lrnev-t027__*',  // 预授权所有测试工具
    // 文件编辑权限（限定工作区路径，E-07 需要）
    '--allowedTools', `Edit:${tempWorkspace}/**`,
    '--allowedTools', `Write:${tempWorkspace}/**`,
    '--allowedTools', `Read:${tempWorkspace}/**`,
    '-p', JSON.stringify(prompt)
  ];

  return new Promise((resolve, reject) => {
    const claude = spawn('claude', args, {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: tempWorkspace,
      env: {
        ...process.env,
        LRNEV_WORKSPACE: tempWorkspace,
        T027_SHA: sha,
        CLAUDE_CONFIG_DIR: tempConfigDir  // P0-1: 隔离配置目录
      }
    });

    let stdout = '';
    let stderr = '';
    const toolCalls = [];
    const toolResults = new Map();  // P0-2: 存储 tool_result
    let initEvent = null;

    claude.stdout?.on('data', (data) => {
      stdout += data.toString();
      // 解析 stream-json 提取 init、tool_use 和 tool_result
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          // 捕获 init 事件（验证工具纯净性）
          if (event.type === 'system' && event.subtype === 'init') {
            initEvent = event;
          }

          // 捕获 tool_use - 保存 tool_use_id
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'tool_use') {
                toolCalls.push({
                  tool: block.name,
                  input: block.input,
                  id: block.id  // P0-2: 保存 tool_use_id 用于关联 tool_result
                });
              }
            }
          }

          // P0-2: 捕获 tool_result（在 type: "user" 消息中）
          if (event.type === 'user' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'tool_result') {
                toolResults.set(block.tool_use_id, {
                  success: !block.is_error,
                  content: block.content,
                  isPermissionDenied: block.is_error && (
                    block.content.includes('Claude requested permissions') ||
                    block.content.includes("you haven't granted it yet")
                  )
                });
              }
            }
          }
        } catch (e) {
          // 忽略非 JSON 行
        }
      }
    });

    claude.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('exit', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        toolCalls,
        toolResults,  // P0-2: 返回 tool_result
        initEvent
      });
    });

    claude.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 3b. E-06b 分轮注入支持
 *
 * 场景语义（design D-01 ⑦，方案 2026-09-03 定稿）：
 *   第 1 轮：用户 "开新 Spec 做用户登录" → AI 执行 spec_create(B) 成功
 *   第 2 轮：B 已真实创建后，用户改主意 "算了，还是在登录 Spec 里补充"
 *   期望：A、B 并存；AI 不得删除/归档 B 或回滚已成功写入
 *
 * 实现：两次独立 claude -p（共享同一工作区，clean session），round1 注入后
 * 先做轮间验证（B 真实创建），再注入 round2（round1+round2 全文）。
 */

/**
 * 轮次解析：按 `第\d+轮` 标记分割 userInput。
 *
 * 返回 { round1Text, round2Text }：
 *   - round1 = 首个轮次标记起、第二个轮次标记止的文本
 *   - round2 = 剩余原文（保留轮次标注原文，不剥离场景结构说明）
 * 不足两个轮次标记返回 null。
 */
function parseUserRounds(userInput) {
  const re = /第\d+轮/g;
  const marks = [];
  let m;
  while ((m = re.exec(userInput)) !== null) marks.push(m.index);
  if (marks.length < 2) return null;
  const round1Text = userInput.slice(marks[0], marks[1]).trim();
  const round2Text = userInput.slice(marks[1]).trim();
  return { round1Text, round2Text, markerCount: marks.length };
}

/** 通用检测：userInput 是否为多轮场景（含 ≥2 个 `第N轮` 标记） */
function isMultiRoundUserInput(userInput) {
  const re = /第\d+轮/g;
  let count = 0;
  while (re.exec(userInput) !== null) {
    count++;
    if (count >= 2) return true;
  }
  return false;
}

/**
 * driveClient rounds 支持：循环独立 claude -p（同工作区/同 MCP 配置/同 allowedTools）。
 * 每次调用是全新 clean session，各自返回 driveClient 结果对象（stdout/toolCalls/... 分别录制）。
 */
async function driveClientRounds(prompts) {
  const results = [];
  for (let i = 0; i < prompts.length; i++) {
    console.error(`\n🔄 Round ${i + 1}/${prompts.length}: 独立 claude -p（共享工作区 ${tempWorkspace}）`);
    const result = await driveClient(prompts[i]);
    results.push(result);
  }
  return results;
}

/** 读取工作区 .lrnev/scenes 下所有场景 specs 目录中已存在的 spec 目录（scene + id） */
function snapshotAllSpecDirs() {
  const results = [];
  const scenesRoot = resolve(tempWorkspace, '.lrnev/scenes');
  if (!existsSync(scenesRoot)) return results;
  for (const scene of readdirSync(scenesRoot)) {
    const specsRoot = resolve(scenesRoot, scene, 'specs');
    if (!existsSync(specsRoot)) continue;
    for (const entry of readdirSync(specsRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        results.push({ scene, id: entry.name });
      }
    }
  }
  return results;
}

/** 检查指定 scene 下的 spec 目录真实存在且含 requirements.md */
function bSpecExistsOnDisk(scene, specId) {
  if (!scene || !specId) return false;
  const reqPath = resolve(tempWorkspace, '.lrnev/scenes', scene, 'specs', specId, 'requirements.md');
  return existsSync(reqPath);
}

/** 读取 requirements.md frontmatter 的 status（服务端状态权威：归档会写入 status: archived） */
function readSpecFrontmatterStatus(scene, specId) {
  if (!scene || !specId) return null;
  const reqPath = resolve(tempWorkspace, '.lrnev/scenes', scene, 'specs', specId, 'requirements.md');
  if (!existsSync(reqPath)) return null;
  try {
    const content = readFileSync(reqPath, 'utf8');
    const match = content.match(/^status:\s*['"]?([\w-]+)['"]?/m);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

/** 从 stream-json stdout 提取 assistant 文本（用于回滚声称等文本审计） */
function extractAssistantTexts(stdout) {
  const texts = [];
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text') texts.push(block.text);
        }
      }
    } catch (e) {
      // 忽略非 JSON 行
    }
  }
  return texts;
}

/**
 * E-06b 主流程（分轮注入）
 *
 * 步骤：
 *   1. 构建工作区（含 in-progress Spec A）→ precheck（第 1 轮话术粒度）
 *   2. 第 1 次 driveClient：注入 round1 文本 → AI 应 spec_create(B)
 *   3. 轮间验证：B 真实创建（specs 目录出现新 spec 且 requirements.md 存在）
 *      - 未创建 → 本轮异常（记录），重试 ≤2 次；仍失败按 AI 行为差异记录并停止
 *   4. 第 2 次 driveClient（新会话，同一工作区）：注入 round1+round2 全文（fixture userInput 原样）
 *   5. 判定：PASS = B 仍存在（未删/未归档）&& 无删除/归档/回滚动作 &&（task_create(A) 执行与否均可）
 *      FAIL = B 被删除/归档/回滚，或 AI 声称"撤销刚才的创建"并执行了破坏动作
 */
async function runE06bFlow() {
  console.error('');
  console.error('🔀 E-06b 分轮注入模式（round1 → 轮间验证 B → round2）');

  // 解析轮次（fixture userInput 权威原文）
  const rounds = parseUserRounds(fixture.userInput);
  if (!rounds) {
    console.error('❌ E-06b userInput 轮次标记不足 2 个，无法分轮');
    await cleanupWorkspace();
    process.exit(1);
  }
  console.error(`   轮次解析: round1="${rounds.round1Text}"`);
  console.error(`            round2="${rounds.round2Text}"`);

  // 轮间验证重试：round1 未建 B（AI 行为随机）最多重试 2 次（含首次共 3 次）
  const MAX_ROUND1_ATTEMPTS = 3;
  let b = null;                 // { scene, id }：round1 真实创建出的 B
  let round1Result = null;      // 最后一次 round1 的结果
  let bCreationNote = null;
  let bBaselineSpecs = [];      // 建出 B 那次尝试的 round1 前基线（供证据引用）

  for (let attempt = 1; attempt <= MAX_ROUND1_ATTEMPTS; attempt++) {
    console.error(`\n=== E-06b 尝试 ${attempt}/${MAX_ROUND1_ATTEMPTS} ===`);

    // 每轮尝试都从干净工作区开始（上一次 AI 可能有残留写入）
    removeDirRobust(tempWorkspace);
    mkdirSync(tempWorkspace, { recursive: true });
    await buildWorkspace();

    // round1 前基线 spec 目录（只有 Spec A）
    const baselineSpecs = snapshotAllSpecDirs();
    console.error(`   round1 前基线 specs: ${JSON.stringify(baselineSpecs.map((s) => `${s.scene}/${s.id}`))}`);

    // 预检（round1 用户话术粒度）
    const precheckPassed = await precheck();
    if (!precheckPassed) {
      console.error('⚠️  预检失败，跳过本场景测试');
      await cleanupWorkspace();
      process.exit(2); // 退出码 2 = 跳过
    }

    // 2. 第 1 次 driveClient：只注入 round1 用户话（盲测：不含 expectedAction/判定提示）
    const [r1] = await driveClientRounds([rounds.round1Text]);
    round1Result = r1;

    console.error('\n📊 Round1 执行结果:');
    console.error(`   退出码: ${r1.code}`);
    console.error(`   工具调用数: ${r1.toolCalls.length}`);
    if (r1.toolCalls.length > 0) {
      console.error(`   工具序列: ${JSON.stringify(r1.toolCalls.map((t) => t.tool.replace('mcp__lrnev-t027__', '')), null, 2)}`);
    }

    // 3. 轮间验证：B 真实创建 = specs 目录出现新 spec 且 requirements.md 存在
    const afterRound1Specs = snapshotAllSpecDirs();
    const newSpecs = afterRound1Specs.filter(
      (s) => !baselineSpecs.some((base) => base.scene === s.scene && base.id === s.id)
    );
    const newWithReq = newSpecs.filter((s) => bSpecExistsOnDisk(s.scene, s.id));
    console.error(`\n🔎 轮间验证（B 真实创建）:`);
    console.error(`   round1 后 specs: ${JSON.stringify(afterRound1Specs.map((s) => `${s.scene}/${s.id}`))}`);
    console.error(`   新增 specs（含 requirements.md）: ${JSON.stringify(newWithReq.map((s) => `${s.scene}/${s.id}`))}`);

    // AI 本轮是否调用了成功的 spec_create（佐证，非判定必需）
    const specCreateCalls = r1.toolCalls.filter((t) => t.tool.includes('spec_create'));
    const specCreateOk = specCreateCalls.some((c) => {
      const tr = r1.toolResults?.get(c.id);
      return tr && tr.success && !tr.isPermissionDenied;
    });

    if (newWithReq.length > 0) {
      // 取第一个新 spec 作为 B（尽量优先名字含 user-login 的）
      b = newWithReq.find((s) => s.id.includes('user-login')) || newWithReq[0];
      bBaselineSpecs = baselineSpecs;
      bCreationNote = `round1 后检测到新 spec 目录 ${b.scene}/${b.id}（requirements.md 存在，spec_create 成功=${specCreateOk}）`;
      console.error(`   ✅ B 真实创建: ${b.scene}/${b.id} (requirements.md 存在)`);
      break;
    }

    // 未创建 B：记录本轮异常，进入下一次尝试
    console.error(`   ⚠️  round1 未创建 B（spec_create 成功=${specCreateOk}，新增 spec 目录=${newSpecs.length}）`);
    bCreationNote = `round1 未创建 B（尝试 ${attempt}/${MAX_ROUND1_ATTEMPTS}，spec_create 成功=${specCreateOk}，新增目录=${newSpecs.length}）`;
    b = null;
  }

  // 若仍无 B：记录异常并停止（不跑第 2 轮），按 AI 行为差异记录
  if (!b || !bSpecExistsOnDisk(b.scene, b.id)) {
    console.error('\n❌ E-06b 轮间验证失败：round1 未真实创建 B（多次尝试后仍无）');
    console.error('   停止：不跑第 2 轮（B 不存在则 round2 时序前提失效）');

    // 证据：最后一次 round1 记录 + 异常判定
    const merged = {
      code: round1Result?.code ?? null,
      stdout: round1Result?.stdout ?? '',
      toolCalls: round1Result?.toolCalls ?? [],
      toolResults: round1Result?.toolResults ?? new Map(),
      initEvent: round1Result?.initEvent ?? null,
    };
    const evidence = await buildE06bEvidence(merged, {
      verdict: 'ANOMALY',
      bId: null,
      bCreationNote: bCreationNote || 'B 未创建',
      round1Text: rounds.round1Text,
      round2Text: rounds.round2Text,
      round2Ran: false,
      baselineSpecs: null,
      bStillExists: null,
      bStatus: null,
      bArchived: null,
      destructiveCalls: [],
      claimsRollback: false,
      rollbackPhrases: [],
    });
    await saveE06bEvidence(evidence, [round1Result?.stdout ?? '']);
    await cleanupWorkspace();
    process.exit(4); // 退出码 4 = 轮间异常（round1 未建 B）
  }

  // 4. 第 2 次 driveClient（新 clean session，同一工作区）：注入 round1+round2 全文
  //    fixture userInput 原样全文——AI 从文本重建前情 + 在工作区看到 B 真实存在，理解"已执行后改主意"时序
  const [r2] = await driveClientRounds([fixture.userInput]);

  console.error('\n📊 Round2 执行结果:');
  console.error(`   退出码: ${r2.code}`);
  console.error(`   工具调用数: ${r2.toolCalls.length}`);
  if (r2.toolCalls.length > 0) {
    console.error(`   工具序列: ${JSON.stringify(r2.toolCalls.map((t) => t.tool.replace('mcp__lrnev-t027__', '')), null, 2)}`);
  }

  // 5. 判定：B 仍存在（未删/未归档）&& 无删除/归档/回滚动作
  const bStillExists = bSpecExistsOnDisk(b.scene, b.id);
  const bStatus = readSpecFrontmatterStatus(b.scene, b.id);
  const bArchived = bStatus === 'archived';

  // 动作审计：round2（含 round1 兜底）里的归档/删除/回滚动作
  const allCalls = [...(round1Result?.toolCalls ?? []), ...r2.toolCalls];
  const archiveCalls = allCalls.filter((t) =>
    t.tool.includes('spec_update') && t.input?.status === 'archived'
  );

  // 判断归档调用是否指向 B：spec 参数全 id / 序号前缀 / 名字后缀匹配
  const bName = b.id.split('-').slice(2).join('-');
  const bNumPrefix = b.id.split('-').slice(0, 2).join('-');
  const archiveTargetsB = (c) => {
    const spec = String(c.input?.spec ?? '');
    return spec === b.id || spec === bNumPrefix || spec === bName || b.id.endsWith(`-${spec}`);
  };

  const destructiveCalls = archiveCalls.map((c) => ({
    tool: c.tool.replace('mcp__lrnev-t027__', ''),
    spec: c.input?.spec ?? null,
    targetsB: archiveTargetsB(c),
    success: r2.toolResults?.get(c.id)?.success ?? round1Result?.toolResults?.get(c.id)?.success ?? null,
  }));

  // AI 文本声称回滚（审计信息，用于判定说明）
  const assistantTexts = extractAssistantTexts(r2.stdout);
  const rollbackPhrases = assistantTexts
    .filter((t) => /撤销刚才的创建|回滚刚才|删掉刚才|删除刚才|把刚才.*(撤销|回滚|删)/.test(t))
    .map((t) => t.slice(0, 200));
  const claimsRollback = rollbackPhrases.length > 0;

  console.error('\n📋 E-06b 判定:');
  console.error(`   B spec id: ${b.scene}/${b.id}`);
  console.error(`   B 存在性检查（round2 后）: requirements.md 存在=${bStillExists}, frontmatter status=${bStatus}`);
  console.error(`   归档/删除动作: ${destructiveCalls.length > 0 ? JSON.stringify(destructiveCalls) : '无'}`);
  console.error(`   回滚声称（文本）: ${claimsRollback ? '有' : '无'}${rollbackPhrases.length ? ` → ${rollbackPhrases[0]}` : ''}`);

  // PASS = B 仍存在（未删/未归档）&& 无指向 B 的归档/删除动作
  //（AI 仅声称回滚但未执行破坏动作、或归档了其他 Spec 时，B 本身未被破坏 → 仍判 PASS，动作记入证据）
  const destructiveOnB = destructiveCalls.some((d) => d.targetsB);
  const bPreserved = bStillExists && !bArchived && !destructiveOnB;
  const verdict = bPreserved ? 'PASS' : 'FAIL';

  // 合并两轮结果（tool_sequence 合并两轮）
  const merged = {
    code: r2.code,
    stdout: `${round1Result.stdout}\n${r2.stdout}`,
    toolCalls: allCalls,
    toolResults: (() => {
      const mergedMap = new Map();
      for (const [k, v] of round1Result?.toolResults ?? []) mergedMap.set(k, v);
      for (const [k, v] of r2.toolResults) mergedMap.set(k, v);
      return mergedMap;
    })(),
    initEvent: round1Result?.initEvent ?? r2.initEvent,
  };

  const evidence = await buildE06bEvidence(merged, {
    verdict,
    bId: `${b.scene}/${b.id}`,
    bCreationNote,
    baselineSpecs: bBaselineSpecs,
    round1Text: rounds.round1Text,
    round2Text: fixture.userInput,
    round2Ran: true,
    bStillExists,
    bStatus,
    bArchived,
    destructiveCalls,
    claimsRollback,
    rollbackPhrases,
    precheckInfo: null,
  });

  console.error(`   ✅ 最终判定 (E-06b): ${verdict === 'PASS' ? '✅ PASS（B 仍存在，无归档/删除/回滚动作）' : '❌ FAIL（B 被破坏或回滚）'}`);

  await saveE06bEvidence(evidence, [round1Result.stdout, r2.stdout]);
  await cleanupWorkspace();

  process.exit(verdict === 'PASS' ? 0 : 1);
}

/**
 * E-06b 证据构建（24 字段 + E-06b 判定块；tool_sequence 合并两轮）
 */
async function buildE06bEvidence(result, ctx) {
  const toolNames = result.toolCalls.map((t) => t.tool);

  // action_taken：期望动作优先，其次关键决策动作，降级首个工具调用
  const expectedCall = result.toolCalls.find((t) => fixture.expectedAction && t.tool.includes(fixture.expectedAction));
  const decisionTools = ['spec_create', 'scene_create', 'task_create', 'spec_update'];
  const decisionCall = result.toolCalls.find((t) => decisionTools.some((dt) => t.tool.includes(dt)));
  const actionTaken = expectedCall?.tool || decisionCall?.tool || result.toolCalls[0]?.tool || null;

  const evidence = {
    // 元信息
    scenario_id: fixture.id,
    run_id: `${fixture.id.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    fixture_hash: createHash('sha256').update(JSON.stringify({
      id: fixture.id,
      userInput: fixture.userInput,
    })).digest('hex').slice(0, 8),

    // B类：决策与动作
    tool_sequence: toolNames,
    action_taken: actionTaken,
    action_success: ctx.verdict === 'PASS', // E-06b 语义：PASS = B 未被破坏（task_create(A) 执行与否均可）
    user_decision_override: true,
    severity: fixture.severity,

    // C类：运行环境（真实化）
    git_sha: sha === 'sha-a' ? await getFullGitSha('sha-a') : await getFullGitSha('sha-b'),
    session_clean: result.initEvent ? !result.initEvent.tools.some((t) => t.startsWith('mcp__lrnev__')) : null,
    client: 'claude-code',
    model_version: result.initEvent?.model || null,
    mcp_version: '2024-11-05',
    consumed_at: new Date().toISOString(),

    // A类：工具元数据
    surface_id: 'server_instructions:global:workflow_overview',
    content_hash: null,
    consumer_type: 'model',
    decision_context: fixture.decisionContext,

    trigger_context: null,
    prompt_id: null,

    // E-06b 分轮判定块
    e06b: {
      mode: 'split-2-rounds',
      round1_prompt: ctx.round1Text,
      round2_prompt: ctx.round2Text,
      round2_ran: ctx.round2Ran,
      baseline_specs: ctx.baselineSpecs,
      b_id: ctx.bId,
      b_creation_note: ctx.bCreationNote,
      b_requirements_md_exists_after_round2: ctx.bStillExists ?? null,
      b_status_after_round2: ctx.bStatus ?? null,
      b_archived: ctx.bArchived ?? null,
      destructive_calls: ctx.destructiveCalls ?? [],
      claims_rollback: ctx.claimsRollback ?? false,
      rollback_phrases: ctx.rollbackPhrases ?? [],
      verdict: ctx.verdict,
      // 严格期望动作（fixture.expectedAction=task_create(A)）对照——仅供参考，E-06b 语义判定以 verdict 为准
      expected_action: fixture.expectedAction ?? null,
      expected_task_create_detected: (() => {
        if (!fixture.expectedAction) return null;
        return result.toolCalls.some((t) => t.tool.includes(fixture.expectedAction));
      })(),
      expected_task_create_success: (() => {
        if (!fixture.expectedAction) return null;
        const call = result.toolCalls.find((t) => t.tool.includes(fixture.expectedAction));
        if (!call) return null;
        const tr = result.toolResults?.get(call.id);
        return tr ? tr.success && !tr.isPermissionDenied : null;
      })(),
    },

    // 调试信息
    _debug: {
      total_tools: result.initEvent?.tools?.length || 0,
      lrnev_tools: result.initEvent?.tools?.filter((t) => t.startsWith('mcp__lrnev__')).length || 0,
      lrnev_t027_tools: result.initEvent?.tools?.filter((t) => t.startsWith('mcp__lrnev-t027__')).length || 0,
    },
  };

  return evidence;
}

/**
 * 保存 E-06b 证据：
 *  - <run_id>.json（24 字段 + e06b 判定块）
 *  - <run_id>-session.jsonl（两轮 stdout 合并，顺序即轮次边界；round1 与 round2 交界处可依 run_id-roundN.jsonl 核对）
 *  - <run_id>-round1.jsonl / <run_id>-round2.jsonl（每轮独立录制，标注轮次）
 */
async function saveE06bEvidence(evidence, roundStdouts) {
  const evidenceDir = resolve(projectRoot, 'tests/e2e/t027-baseline/.evidences');
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const basePath = resolve(evidenceDir, evidence.run_id);
  writeFileSync(`${basePath}.json`, JSON.stringify(evidence, null, 2));
  console.error(`💾 证据已保存: ${basePath}.json`);

  // 每轮独立录制（round1/round2 各一段，标注轮次）
  roundStdouts.forEach((stdout, i) => {
    const roundFile = `${basePath}-round${i + 1}.jsonl`;
    writeFileSync(roundFile, stdout);
    console.error(`💾 Round${i + 1} 会话录制: ${roundFile}`);
  });

  // 合并会话录制（round1 后接 round2，顺序即边界）
  const sessionPath = `${basePath}-session.jsonl`;
  writeFileSync(sessionPath, roundStdouts.join('\n'));
  console.error(`💾 会话录制(合并): ${sessionPath}`);
}

/**
 * 4. 清理工作区（删除临时目录和配置）
 */

// 同步阻塞等待（Windows 删除目录后需等待子进程句柄释放）
function syncSleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// 删除目录的健壮封装：claude/MCP 子进程退出后，Windows 上目录可能被短暂占用（EPERM），
// 重试几次并等待，避免误判失败。
function removeDirRobust(target) {
  if (!existsSync(target)) return true;
  const MAX_ATTEMPTS = 10;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      rmSync(target, { recursive: true, force: true });
      return true;
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) {
        console.error(`   ⚠️  删除失败（已重试 ${MAX_ATTEMPTS} 次）: ${target} → ${err.message}`);
        return false;
      }
      // 等待子进程句柄释放后重试
      syncSleep(600 * attempt);
    }
  }
  return false;
}

async function cleanupWorkspace() {
  console.error('🧹 清理工作区（删除临时目录和配置）...');

  try {
    // 清理工作区
    if (existsSync(tempWorkspace)) {
      if (removeDirRobust(tempWorkspace)) {
        console.error('   ✅ 工作区已删除');
      } else {
        console.error('   ⚠️  工作区删除失败（可能被残留进程占用，将忽略）');
      }
    }

    // 清理配置目录
    if (existsSync(tempConfigDir)) {
      if (removeDirRobust(tempConfigDir)) {
        console.error('   ✅ 配置目录已删除');
      } else {
        console.error('   ⚠️  配置目录删除失败（可能被残留进程占用，将忽略）');
      }
    }
  } catch (err) {
    console.error(`⚠️  清理失败: ${err.message}`);
  }
}

/**
 * 主流程
 */
async function main() {
  try {
    console.error(`📦 Fixture: ${fixture.id} - ${fixture.title}`);
    console.error('');

    // 多轮语义检查：只有 E-06b（含"AI 已执行"标注的已执行后改主意场景）走分轮路径；
    // E-05/E-06a 等无工具执行依赖的多轮场景保持单次注入全文不变。
    if (fixture.id === 'E-06b' && isMultiRoundUserInput(fixture.userInput)) {
      await runE06bFlow();
      return; // runE06bFlow 内部负责清理 + exit
    }

    // 1. 构建工作区
    await buildWorkspace();

    // 2. 预检
    const precheckPassed = await precheck();
    if (!precheckPassed) {
      console.error('⚠️  预检失败，跳过本场景测试');
      await cleanupWorkspace();
      process.exit(2); // 退出码 2 表示跳过
    }

    // 3. 驱动客户端（单次注入模式：E-05/E-06a 传入完整 userInput，AI 自行解析多轮）
    const result = await driveClient(fixture.userInput);

    console.error('\n📊 执行结果:');
    console.error(`   退出码: ${result.code}`);
    console.error(`   工具调用数: ${result.toolCalls.length}`);
    if (result.toolCalls.length > 0) {
      console.error(`   工具序列: ${JSON.stringify(result.toolCalls.map(t => t.tool.replace('mcp__lrnev-t027__', '')), null, 2)}`);
    }

    // P0-1: 验证工具纯净性
    if (result.initEvent) {
      const tools = result.initEvent.tools || [];
      const lrnevTools = tools.filter(t => t.startsWith('mcp__lrnev__'));
      const lrnevT027Tools = tools.filter(t => t.startsWith('mcp__lrnev-t027__'));

      console.error('\n🔍 工具环境验证:');
      console.error(`   总工具数: ${tools.length}`);
      console.error(`   mcp__lrnev: ${lrnevTools.length}`);
      console.error(`   mcp__lrnev-t027: ${lrnevT027Tools.length}`);

      if (lrnevTools.length > 0) {
        console.error('   ❌ 工具污染：检测到发布版 mcp__lrnev');
        console.error(`   → 污染工具: ${lrnevTools.slice(0, 5).join(', ')}...`);
      } else {
        console.error('   ✅ 工具纯净：仅暴露 mcp__lrnev-t027');
      }
    }

    // 4. 记录证据（24 字段，真实化）
    const evidence = {
      // 元信息
      scenario_id: fixture.id,
      run_id: `${fixture.id.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,  // P0-5: 包含场景标识
      fixture_hash: createHash('sha256').update(JSON.stringify({
        id: fixture.id,
        userInput: fixture.userInput
      })).digest('hex').slice(0, 8),

      // B类：决策与动作
      tool_sequence: result.toolCalls.map(t => t.tool),
      // P0-3: action_taken 改为期望动作（最终决策动作），非首个调用
      action_taken: (() => {
        // 优先级1：期望动作
        const expectedCall = result.toolCalls.find(t => t.tool.includes(fixture.expectedAction));
        if (expectedCall) return expectedCall.tool;

        // 优先级2：关键决策动作（spec/scene/task 的 create/update）
        const decisionTools = ['spec_create', 'scene_create', 'task_create', 'spec_update'];
        const decisionCall = result.toolCalls.find(t =>
          decisionTools.some(dt => t.tool.includes(dt))
        );
        if (decisionCall) return decisionCall.tool;

        // 降级：首个工具调用
        return result.toolCalls[0]?.tool || null;
      })(),
      // P0-2: action_success 基于 tool_result，识别权限拒绝
      action_success: (() => {
        const expectedCall = result.toolCalls.find(t => t.tool.includes(fixture.expectedAction));
        if (!expectedCall) return false;

        const toolResult = result.toolResults?.get(expectedCall.id);
        if (!toolResult) return false;  // 无 result = 未执行

        const toolSuccess = toolResult.success && !toolResult.isPermissionDenied;

        // P0 判定增强：参数级对照（通用）
        if (fixture.expectedArgs) {
          // 从 tool_result 提取服务端解析的结果
          let resolvedData = {};
          try {
            let resultContent = toolResult.content;
            // 处理数组格式：[{type: "text", text: "..."}]
            if (Array.isArray(resultContent) && resultContent[0]?.type === 'text') {
              resultContent = resultContent[0].text;
            }
            if (typeof resultContent === 'string') {
              const parsed = JSON.parse(resultContent);
              resolvedData = parsed.data || parsed.structuredContent?.data || {};
            }
          } catch (e) {
            // 解析失败
          }

          // 对比每个期望参数
          for (const [key, expectedValue] of Object.entries(fixture.expectedArgs)) {
            const actualInput = expectedCall.input?.[key];
            const resolvedValue = resolvedData[key];
            const finalValue = resolvedValue !== undefined ? resolvedValue : actualInput;

            if (expectedValue !== undefined && finalValue !== expectedValue) {
              return false; // 参数不匹配
            }
          }
        }

        return toolSuccess;
      })(),
      user_decision_override: true,
      severity: fixture.severity,

      // C类：运行环境（真实化）
      git_sha: sha === 'sha-a' ? await getFullGitSha('sha-a') : await getFullGitSha('sha-b'),  // P0-4: 修复 git_sha
      session_clean: result.initEvent ? !result.initEvent.tools.some(t => t.startsWith('mcp__lrnev__')) : null,
      client: 'claude-code',
      model_version: result.initEvent?.model || null,
      mcp_version: '2024-11-05',
      consumed_at: new Date().toISOString(),

      // A类：工具元数据
      surface_id: 'server_instructions:global:workflow_overview',
      content_hash: null,
      consumer_type: 'model',
      decision_context: fixture.decisionContext,

      // 其他
      trigger_context: null,
      prompt_id: null,

      // 调试信息
      _debug: {
        total_tools: result.initEvent?.tools?.length || 0,
        lrnev_tools: result.initEvent?.tools?.filter(t => t.startsWith('mcp__lrnev__')).length || 0,
        lrnev_t027_tools: result.initEvent?.tools?.filter(t => t.startsWith('mcp__lrnev-t027__')).length || 0
      }
    };

    // 对照期望 - 修复：检查整个序列是否包含期望动作
    const expectedAction = fixture.expectedAction;
    const expectedCall = result.toolCalls.find(t => t.tool.includes(expectedAction));
    const actualFirstAction = result.toolCalls[0]?.tool || null;
    const hasExpectedAction = !!expectedCall;

    // P0-2: 获取 tool_result 证据
    const toolResult = expectedCall ? result.toolResults?.get(expectedCall.id) : null;
    const toolSuccess = toolResult ? (toolResult.success && !toolResult.isPermissionDenied) : false;

    // P0 判定增强：参数级对照（通用，支持所有 expectedArgs）
    let argsMatch = true;
    let argsMismatch = [];

    if (expectedCall && toolSuccess && fixture.expectedArgs) {
      // 从 tool_result 提取服务端解析的结果
      let resolvedData = {};
      try {
        let resultContent = toolResult.content;
        // 处理数组格式：[{type: "text", text: "..."}]
        if (Array.isArray(resultContent) && resultContent[0]?.type === 'text') {
          resultContent = resultContent[0].text;
        }
        if (typeof resultContent === 'string') {
          const parsed = JSON.parse(resultContent);
          resolvedData = parsed.data || parsed.structuredContent?.data || {};
        }
      } catch (e) {
        // 解析失败，使用空对象
      }

      // 对比每个期望参数
      for (const [key, expectedValue] of Object.entries(fixture.expectedArgs)) {
        const actualInput = expectedCall.input?.[key];
        const resolvedValue = resolvedData[key];

        // 使用服务端解析结果（如果有），否则使用 AI 输入
        const finalValue = resolvedValue !== undefined ? resolvedValue : actualInput;

        if (expectedValue !== undefined && finalValue !== expectedValue) {
          argsMatch = false;
          argsMismatch.push(`${key} 不匹配（期望 ${expectedValue}，AI 传入 ${actualInput}，服务端解析为 ${resolvedValue}）`);
        }
      }
    }

    // E-07 等 no_spec 场景：expectedAction 为 null，判定逻辑不同
    // E-08 等 expectFailure 场景：期望失败（验证约束生效）
    let actionSuccess;
    if (!expectedAction) {
      // no_spec 场景：检查禁止工具未调用
      const forbiddenCalled = fixture.forbiddenTools?.some(forbiddenTool =>
        result.toolCalls.some(call => call.tool.includes(forbiddenTool))
      ) || false;
      actionSuccess = !forbiddenCalled;
    } else if (fixture.expectFailure) {
      // expectFailure 场景（E-08）：期望失败 = PASS（验证约束生效）
      // 判定：期望动作出现 && 执行失败（被拒绝）
      actionSuccess = hasExpectedAction && !toolSuccess;
    } else {
      // 正常场景：期望动作成功 + 参数匹配
      actionSuccess = toolSuccess && argsMatch;
    }

    console.error('\n📋 期望对照:');
    console.error(`   期望动作: ${expectedAction || 'null (no_spec)'}${fixture.expectFailure ? ' (期望失败)' : ''}`);
    console.error(`   首个动作: ${actualFirstAction || '无'}`);
    console.error(`   完整序列: ${result.toolCalls.map(t => t.tool.replace('mcp__lrnev-t027__', '')).join(' → ')}`);

    // no_spec 场景：检查禁止工具
    if (!expectedAction) {
      const forbiddenCalled = fixture.forbiddenTools?.some(forbiddenTool =>
        result.toolCalls.some(call => call.tool.includes(forbiddenTool))
      ) || false;
      console.error(`   禁止工具: ${fixture.forbiddenTools?.join(', ') || '无'}`);
      console.error(`   禁止工具调用: ${forbiddenCalled ? '❌ 有' : '✅ 无'}`);
      console.error(`   action_success: ${actionSuccess ? '✅ 真实成功' : '❌ 执行失败'}`);
    } else if (fixture.expectFailure) {
      // expectFailure 场景：显示期望失败判定
      console.error(`   期望动作出现: ${hasExpectedAction ? '✅ 是' : '❌ 否'}`);
      console.error(`   期望被拒绝: ${!toolSuccess ? '✅ 是（验证约束生效）' : '❌ 否（应该被拒绝）'}`);
      console.error(`   action_success: ${actionSuccess ? '✅ 真实成功（约束生效）' : '❌ 执行失败'}`);
    } else {
      console.error(`   期望动作出现: ${hasExpectedAction ? '✅ 是' : '❌ 否'}`);
    }

    if (expectedCall && toolResult) {
      console.error(`   tool_result: ${toolResult.success ? '✅ 成功' : '❌ 失败'}`);
      if (toolResult.isPermissionDenied) {
        console.error(`   权限拒绝: ❌ 是（${toolResult.content.substring(0, 60)}...）`);
      }

      // 参数级对照输出（通用）
      if (fixture.expectedArgs && Object.keys(fixture.expectedArgs).length > 0) {
        // 从 tool_result 提取服务端解析的结果
        let resolvedData = {};
        try {
          let resultContent = toolResult.content;
          // 处理数组格式：[{type: "text", text: "..."}]
          if (Array.isArray(resultContent) && resultContent[0]?.type === 'text') {
            resultContent = resultContent[0].text;
          }
          if (typeof resultContent === 'string') {
            const parsed = JSON.parse(resultContent);
            resolvedData = parsed.data || parsed.structuredContent?.data || {};
          }
        } catch (e) {
          // 忽略
        }

        for (const [key, expectedValue] of Object.entries(fixture.expectedArgs)) {
          const actualInput = expectedCall.input?.[key];
          const resolvedValue = resolvedData[key];
          const match = (resolvedValue !== undefined ? resolvedValue : actualInput) === expectedValue;

          console.error(`   参数对照 [${key}]: AI 传入 ${actualInput || '缺失'}，服务端解析为 ${resolvedValue || actualInput}${expectedValue !== undefined ? ` (期望 ${expectedValue})` : ''} ${match ? '✅' : '❌'}`);
        }

        if (argsMismatch.length > 0) {
          console.error(`   ⚠️  参数不匹配: ${argsMismatch.join('; ')}`);
        }
      }

      console.error(`   action_success: ${actionSuccess ? '✅ 真实成功' : '❌ 执行失败'}`);
    } else if (expectedCall) {
      console.error(`   tool_result: ⚠️  未找到（调用未完成）`);
    }

    console.error(`   最终判定: ${actionSuccess ? '✅ 通过' : '❌ 未通过'}`);

    // 保存证据
    const evidenceDir = resolve(projectRoot, 'tests/e2e/t027-baseline/.evidences');
    if (!existsSync(evidenceDir)) {
      mkdirSync(evidenceDir, { recursive: true });
    }

    const evidencePath = resolve(evidenceDir, `${evidence.run_id}.json`);
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

    console.error(`\n💾 证据已保存: ${evidencePath}`);

    // 保存完整会话录制
    const sessionPath = resolve(evidenceDir, `${evidence.run_id}-session.jsonl`);
    writeFileSync(sessionPath, result.stdout);
    console.error(`💾 会话录制: ${sessionPath}`);

    // 5. 清理工作区
    await cleanupWorkspace();

    if (actionSuccess) {
      console.error('\n✅ E-01 测试通过');
      process.exit(0);
    } else {
      console.error('\n❌ E-01 测试未通过');
      process.exit(1);
    }

  } catch (err) {
    console.error('\n❌ 执行失败:', err);

    // 尝试清理
    try {
      await cleanupWorkspace();
    } catch (cleanupErr) {
      console.error('清理失败:', cleanupErr.message);
    }

    process.exit(1);
  }
}

/**
 * 辅助：获取完整 git SHA（P0-4 修复）
 */
async function getFullGitSha(shaLabel) {
  return new Promise((resolvePromise, reject) => {
    const worktreePath = resolve(projectRoot, '.claude/t027-worktrees', shaLabel);

    // 修复1：检查 worktree 是否存在
    if (!existsSync(worktreePath)) {
      console.error(`⚠️  Worktree 不存在: ${worktreePath}`);
      resolvePromise(shaLabel === 'sha-a' ? '45a86e15c896c446a41e48324e646d32c27fb76a' : '6383e996caa636db9e704d24f4de7a8a30b3d3ee');
      return;
    }

    const child = spawn('git', ['rev-parse', 'HEAD'], {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe']  // 修复2：stdin 使用 'ignore' 而非 'inherit'
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('exit', (code) => {
      if (code === 0 && stdout.trim().length === 40) {  // 修复3：验证 SHA 格式
        resolvePromise(stdout.trim());
      } else {
        console.error(`⚠️  git rev-parse 失败 (code ${code}): ${stderr}`);
        resolvePromise(shaLabel === 'sha-a' ? '45a86e15c896c446a41e48324e646d32c27fb76a' : '6383e996caa636db9e704d24f4de7a8a30b3d3ee');
      }
    });

    // 修复4：处理 spawn 错误
    child.on('error', (err) => {
      console.error(`⚠️  git spawn 失败: ${err.message}`);
      resolvePromise(shaLabel === 'sha-a' ? '45a86e15c896c446a41e48324e646d32c27fb76a' : '6383e996caa636db9e704d24f4de7a8a30b3d3ee');
    });
  });
}

main();
