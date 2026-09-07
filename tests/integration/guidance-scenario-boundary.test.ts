/**
 * 05-00-lrnev-guidance-profile T-005 集成测试 —— 场景级协议边界
 *
 * Spec: 05-00-lrnev-guidance-profile（F-01/F-03/F-04/F-05/F-06/F-07、D-03/D-04/D-06/D-07）
 * Task: T-005（覆盖 Profile 与 decision_context 协议边界测试）
 * 驱动语义：04-00-agent-e2e-observability design.md D-01 场景矩阵（E-01~E-09 + E-06a/b）。
 *
 * 本文件不重复 T-001~T-004 已覆盖项（对象/schema/纯函数/四工具接线/guidance 挂载），
 * 只补 T-005 验收要求的【场景级端到端协议边界】：走真实 MCP server + 临时工作区，
 * 每场景同时断言 .lrnev 落盘状态与响应 guidance/文本内容。
 *
 * T-006 字段回退注记（裁决 2026-09-07，dev-docs/decisions/2026-09-07-T006字段裁决.md）：
 * - O6：payload.guidance 运行时挂载与 outputSchema guidance 声明已回退——响应不再携带
 *   结构化 guidance 数组；role 语义经文本通道（ROLE_PREFIX 行）交付，Profile 保留为纯函数
 *   库 + 契约类型。本文件所有 role 断言以文本行为准（role 化行经 classifyInstructions 复核），
 *   并断言 payload 无 guidance 字段（挂载不存在，空字段误导也消除）。
 * - I6：reported_user_quote 已从 decision_context 输入契约移除（380 录制件 0 命中 +
 *   服务端零使用 + 转述不可验证）；"服务端不回显用户原话"由 schema 结构层保证。
 *
 * ─────────────────────────────────────────────────────────────
 * 每个新增字段 → 04 失败模式 / 适配收益映射（F-01 逐字段门禁依据）
 * ─────────────────────────────────────────────────────────────
 * 04-00 design D-03 失败分类：
 *   A 过度遵守：Recommendation 覆盖明确 User Decision（AI 把建议当用户决定执行/回滚）。
 *   B 选择性遵守：AI 采纳部分 guidance，忽略同层语义边界或 Constraint。
 *   C 意图传递：未传/误传 decision_context（non-explicit 误传 explicit、direction/
 *     target_ref 与原话不符、应不传的 E-08 却伪造 context）、把 client assertion 当事实。
 *   D 传输/capability：客户端不交付/不消费 content、structuredContent、resource 或 Profile。
 *   E 执行约束：服务端缺失/错误执行确定性校验。
 *
 * Profile 输出侧（guidance 项）：
 * - role（五角色最小结构）        → 防 B（层间混用）/A（建议冒充决定）：让客户端识别
 *     FACT/RECOMMENDATION/DECISION_BOUNDARY 各自语义；E-01/E-02 中 Recommendation 不得
 *     覆盖用户已表达方向；role 缺省=文本降级 → D 类客户端（只读文本仍可用，F-07）。
 * - text（与 01 文本同源）        → 防 B/D-06：文本通道与 Profile 同源一致，Profile 解析
 *     失败不影响 content/data（D-06 注入场景回归）。
 * - profile_version                → 04 evidence D-02 run_id/profile_version 对齐的适配收益；
 *     版本独立于 MCP protocolVersion / response_version（F-02）。
 * - source_ref（FACT/EXECUTION_CONSTRAINT 需定位时）→ E 类可诊断：真实约束回指错误码/
 *     校验位置（F-06）；E-08 状态机拒绝路径的可追溯性。
 * - enforcement（client_boundary/server_enforced）→ 防 A：Recommendation/DECISION_BOUNDARY
 *     永不 server_enforced（无阻断权）；EXECUTION_CONSTRAINT 必须 server_enforced 且由
 *     服务端真实校验先行执行（F-06、04 E-08 预期）。
 *
 * decision_context 输入侧：
 * - source: 'client_asserted'      → 防 C / D-04 红线：只收客户端声明来源；服务端不伪造
 *     USER_DECISION、不把声明当服务端事实；evidence decision_context_sent 语义（E-08 应不传）。
 * - strength: explicit|preferred|unspecified
 *                                   → 防 C：explicit=已决定（E-01/E-02/E-06a/b）、
 *     preferred=倾向待确认（E-05）、unspecified=明确未指定（E-03/E-04）三者不混淆，
 *     杜绝 non-explicit 误传 explicit。
 * - summary                       → 防 C/A：服务端不解析、不回显、不持久化（不把 AI 理解
 *     写成用户决定）；本文件用哨兵 summary 断言永不落盘。
 * - direction: new_scene|new_spec|reuse_spec|no_spec|other
 *                                   → 防 A/B/C：枚举级当前调用对齐（new_scene→scene_create、
 *     new_spec→spec_create、reuse_spec→task_create、no_spec→不应落位、other→不自动比较）；
 *     E-06b 已写入的 B 不得被后续方向变化自动回滚/归档；E-07 no_spec 只提示不阻断；
 *     unspecified 禁止 direction → 防把 AI Recommendation 包装成用户方向（C）。
 * - target_ref                    → 防 C（direction/target_ref 与原话不符，E-02/E-06 复用错
 *     Spec）：只做当前调用参数核对，解析失败仅提示（D-03/F-05），不升级为事实。
 *
 * 每用例开头标注其驱动的 04-00 D-01 场景（E-xx）。
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { createMcpServer } from '../../src/mcp/server.js';
import { ROLE_PREFIX } from '../../src/core/guidance-semantics.js';
import { buildGuidanceView, classifyInstructions } from '../../src/mcp/helpers/guidance-profile.js';
import { parseFrontmatter } from '../../src/storage/FrontmatterCodec.js';
import { toMcpToolResult } from '../../src/mcp/helpers/tool-result-adapter.js';
import type { AiFollowupResponse } from '../../src/types/response.js';

// ============================================================
// 哨兵常量：任何出现即代表客户端声明被解析/回显/持久化（失败）
// ============================================================
const MARKER = 'PERSIST_SENTINEL_T005_2B7';
const USER_DECISION = 'USER_DECISION';
const PREFIX = {
  FACT: ROLE_PREFIX.FACT,
  RECOMMENDATION: ROLE_PREFIX.RECOMMENDATION,
  DECISION_BOUNDARY: ROLE_PREFIX.DECISION_BOUNDARY,
  EXECUTION_CONSTRAINT: ROLE_PREFIX.EXECUTION_CONSTRAINT,
};

// ============================================================
// 工具辅助
// ============================================================

/** 调用工具并返回原始结果（含 structuredContent / content / isError）。 */
async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<any> {
  return client.callTool({ name, arguments: args });
}

/** 取 canonical payload。 */
function payloadOf(result: any): any {
  return result?.structuredContent;
}

/** 取 ai_followup.instructions（不存在返回 []）。 */
function instructionsOf(payload: any): string[] {
  return payload?.ai_followup?.instructions ?? [];
}

/** 返回以指定角色前缀开头的指令行。 */
function linesByRole(instructions: string[], prefix: string): string[] {
  return instructions.filter((line) => line.startsWith(prefix));
}

/** 相对 .lrnev 的 spec 目录（scene/spec 用完整 id 或解析后的返回值）。 */
function specRequirementsPath(root: string, sceneId: string, specId: string): string {
  return path.join(root, '.lrnev', 'scenes', sceneId, 'specs', specId, 'requirements.md');
}

function sceneMarkdownPath(root: string, sceneId: string): string {
  return path.join(root, '.lrnev', 'scenes', sceneId, 'scene.md');
}

function specTasksPath(root: string, sceneId: string, specId: string): string {
  return path.join(root, '.lrnev', 'scenes', sceneId, 'specs', specId, 'tasks.md');
}

/** 读 requirements.md frontmatter（磁盘是状态权威；解析库与读写共用 FrontmatterCodec）。 */
async function readSpecFrontmatter(root: string, sceneId: string, specId: string): Promise<any> {
  const text = await fs.readFile(specRequirementsPath(root, sceneId, specId), 'utf8');
  return parseFrontmatter(text).frontmatter;
}

/** 收集 .lrnev 下全部相对路径（递归），用于"纯读取无副作用"哨兵。 */
async function lrnevEntries(root: string): Promise<string[]> {
  const lrnevDir = path.join(root, '.lrnev');
  const entries: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let children: string[] = [];
    try {
      children = await fs.readdir(dir);
    } catch {
      return; // 目录可能暂时不存在
    }
    for (const child of children) {
      const full = path.join(dir, child);
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        await walk(full);
      } else {
        entries.push(path.relative(lrnevDir, full).replace(/\\/g, '/'));
      }
    }
  };
  await walk(lrnevDir);
  return entries.sort();
}

/** 扫描 .lrnev 下所有文件内容，返回包含 marker 的文件相对路径（证明未持久化）。 */
async function scanLrnevForMarker(root: string, marker: string): Promise<string[]> {
  const lrnevDir = path.join(root, '.lrnev');
  const hits: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let children: string[] = [];
    try {
      children = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const child of children) {
      const full = path.join(dir, child);
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        await walk(full);
      } else if (stat.size < 2_000_000) {
        try {
          const text = await fs.readFile(full, 'utf8');
          if (text.includes(marker)) {
            hits.push(path.relative(lrnevDir, full).replace(/\\/g, '/'));
          }
        } catch {
          // 不可读文件跳过
        }
      }
    }
  };
  await walk(lrnevDir);
  return hits;
}

/** 便捷构造合法 decision_context（默认 explicit + new_spec）。 */
function ctx(over: Record<string, unknown>): Record<string, unknown> {
  return {
    source: 'client_asserted',
    strength: 'explicit',
    summary: MARKER,
    direction: 'new_spec',
    ...over,
  };
}

// ============================================================
// 测试主体
// ============================================================

describe('T-005: Profile 与 decision_context 场景级协议边界（真实 MCP server）', () => {
  let workspace: DirectoryResult;
  let originalEnv: string | undefined;
  let client: Client;
  let server: ReturnType<typeof createMcpServer>;
  let sceneA: string; // 01-user-management
  let specA: string; // 01-00-user-login
  const payloads: any[] = [];

  beforeAll(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    originalEnv = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    server = createMcpServer();
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    await client.callTool({ name: 'lrnev_init', arguments: { project_name: 'test' } });

    // 04-00 D-01 场景基线：Spec A（01-00-user-login）处于 in-progress。
    const sceneResult = await callTool(client, 'scene_create', { name: 'user-management', number: 1 });
    sceneA = payloadOf(sceneResult).data.id as string;
    expect(sceneA).toBe('01-user-management');

    const specResult = await callTool(client, 'spec_create', { scene: sceneA, name: 'user-login' });
    specA = payloadOf(specResult).data.spec as string;
    expect(specA).toBe('01-00-user-login');

    // A：draft → ready → in-progress（真实状态机，spec_update 非 v1 context 工具）
    const ready = await callTool(client, 'spec_update', { scene: sceneA, spec: specA, status: 'ready', reason: 'T-005 setup' });
    expect(payloadOf(ready).data.status).toBe('ready');
    const inProgress = await callTool(client, 'spec_update', { scene: sceneA, spec: specA, status: 'in-progress', reason: 'T-005 setup' });
    expect(payloadOf(inProgress).data.status).toBe('in-progress');

    // 磁盘是状态权威：A 的 requirements.md frontmatter 已真实回写
    const fm = await readSpecFrontmatter(workspace.path, sceneA, specA);
    expect(fm.status).toBe('in-progress');
    expect(fm.spec).toBe(specA);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
    if (originalEnv === undefined) delete process.env.LRNEV_WORKSPACE;
    else process.env.LRNEV_WORKSPACE = originalEnv;
    await workspace.cleanup();
  });

  /**
   * 文本通道 role 集合（T-006 O6 口径）：role 化行经 classifyInstructions 分类，
   * 与挂载时代的结构化 role 数组同源（结构化视图 = 纯函数对同一组文本行的派生）。
   */
  function textRoles(payload: any): string[] {
    return classifyInstructions(instructionsOf(payload)).map((i) => String(i.role));
  }

  /** 断言无硬约束语义（文本行 + 无 USER_DECISION；结构化数组已随 O6 移除，检查面收敛到文本）。 */
  function expectNoHardConstraint(payload: any): void {
    expect(payload).not.toHaveProperty('guidance'); // O6：响应不携带结构化 guidance
    expectNoConstraintLine(payload);
    expect(JSON.stringify(payload)).not.toContain(USER_DECISION);
  }

  /** 断言指令文本中不存在【执行约束】行（no_spec/other 绝不升级为硬约束）。 */
  function expectNoConstraintLine(payload: any): void {
    const instructions = instructionsOf(payload);
    expect(linesByRole(instructions, PREFIX.EXECUTION_CONSTRAINT)).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain(PREFIX.EXECUTION_CONSTRAINT);
  }

  // ============================================================
  // E-06a / E-06b：改意图（执行前 / 执行后）
  // ============================================================
  describe('E-06a：声明 new_spec 但未执行 → 服务端不凭声明落盘（纯评估无副作用）', () => {
    it('assess_goal(explicit new_spec) 后 .lrnev 零新增；随后的 reuse_spec task_create(A) 不产生任何 B', async () => {
      const before = await lrnevEntries(workspace.path);

      const assess = await callTool(client, 'assess_goal', {
        goal: '新建独立登录风控 Spec B',
        decision_context: ctx({ direction: 'new_spec' }),
      });
      const assessPayload = payloadOf(assess);
      expect(assessPayload.ok).toBe(true);
      expect(assess.isError).toBeFalsy();
      // O6：结构化挂载已回退 → role 集合经文本通道复核；只含评估组织行
      // （FACT/RECOMMENDATION），无边界提示
      expect(assessPayload).not.toHaveProperty('guidance');
      expect(textRoles(assessPayload)).toEqual(['FACT', 'RECOMMENDATION']);
      expect(linesByRole(instructionsOf(assessPayload), PREFIX.DECISION_BOUNDARY)).toEqual([]);
      payloads.push(assessPayload);

      // E-06a 核心：仅声明方向不产生任何落盘（assess 是纯读取）
      const afterAssess = await lrnevEntries(workspace.path);
      expect(afterAssess).toEqual(before);

      // 改意图后只执行最后确认的 reuse_spec → task_create(A)，不得创建 B
      const create = await callTool(client, 'task_create', {
        scene: sceneA,
        spec: specA,
        title: '实现登录（E-06a 改意图后落位 A）',
        decision_context: ctx({
          direction: 'reuse_spec',
          target_ref: `scene=${sceneA}, spec=${specA}`,
        }),
      });
      const createPayload = payloadOf(create);
      expect(createPayload.ok).toBe(true);
      expect(create.isError).toBeFalsy();
      expect(createPayload.data.id).toMatch(/^T-\d+/);
      expect(linesByRole(instructionsOf(createPayload), PREFIX.DECISION_BOUNDARY)).toEqual([]);
      payloads.push(createPayload);

      // A 的 tasks.md 真实写入；仍无任何 B 目录出现
      const taskText = await fs.readFile(specTasksPath(workspace.path, sceneA, specA), 'utf8');
      expect(taskText).toContain(`### ${createPayload.data.id}`);
      const after = await lrnevEntries(workspace.path);
      expect(after).toEqual(afterAssess);
    });
  });

  describe('E-06b：spec_create(B) 已成功执行后改意图 → A、B 并存，服务端不自动回滚/归档 B', () => {
    let specB: string; // 02-00-login-risk
    let bContentBeforeReuse: string;

    it('轮次 1：explicit new_spec 调 spec_create(B) → B 真实创建（draft），无边界行', async () => {
      const result = await callTool(client, 'spec_create', {
        scene: sceneA,
        name: 'login-risk',
        decision_context: ctx({ direction: 'new_spec' }),
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      specB = payload.data.spec as string;
      expect(specB).toMatch(/^\d\d-\d\d-login-risk$/);

      // 对齐路径无 DECISION_BOUNDARY；文本通道为 spec_create 固有 FACT/RECOMMENDATION 行
      expect(payload).not.toHaveProperty('guidance');
      expect(textRoles(payload)).toEqual(['FACT', 'RECOMMENDATION']);
      expect(linesByRole(instructionsOf(payload), PREFIX.DECISION_BOUNDARY)).toEqual([]);
      expect(JSON.stringify(payload)).not.toContain(MARKER); // summary 不回显
      payloads.push(payload);

      // .lrnev 真实落盘：B 的 requirements.md 存在且状态权威为 draft
      await expect(fs.access(specRequirementsPath(workspace.path, sceneA, specB))).resolves.toBeUndefined();
      const fm = await readSpecFrontmatter(workspace.path, sceneA, specB);
      expect(fm.status).toBe('draft');
    });

    it('轮次 2：改为 explicit reuse_spec + target_ref(A) 调 task_create(A) → 正常执行且 B 逐字节未动', async () => {
      expect(specB).toBeTruthy();
      bContentBeforeReuse = await fs.readFile(specRequirementsPath(workspace.path, sceneA, specB), 'utf8');

      const result = await callTool(client, 'task_create', {
        scene: sceneA,
        spec: specA,
        title: '把登录功能实现在 A（E-06b 改意图后）',
        decision_context: ctx({
          direction: 'reuse_spec',
          target_ref: `scene=${sceneA}, spec=${specA}`,
        }),
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      expect(payload.data.id).toMatch(/^T-\d+/);

      // 对齐且 target_ref 一致 → 无任何【决策边界】提示
      const instructions = instructionsOf(payload);
      expect(linesByRole(instructions, PREFIX.DECISION_BOUNDARY)).toEqual([]);
      expect(JSON.stringify(payload)).not.toContain(USER_DECISION);
      // 服务端不解析/不回显 summary（reported_user_quote 已随 T-006 I6 移除，schema 层不再接收）
      expect(JSON.stringify(payload)).not.toContain(MARKER);
      payloads.push(payload);

      // 真实写入 A：A 的 tasks.md 出现新 Task
      const taskText = await fs.readFile(specTasksPath(workspace.path, sceneA, specA), 'utf8');
      expect(taskText).toContain(`### ${payload.data.id}`);

      // E-06b 核心：B 逐字节未变、状态仍 draft、目录并存 → 无自动回滚/删除/归档
      const bContentAfter = await fs.readFile(specRequirementsPath(workspace.path, sceneA, specB), 'utf8');
      expect(bContentAfter).toBe(bContentBeforeReuse);
      const fmB = await readSpecFrontmatter(workspace.path, sceneA, specB);
      expect(fmB.status).toBe('draft');
      const specDirs = await fs.readdir(path.join(workspace.path, '.lrnev', 'scenes', sceneA, 'specs'));
      expect(specDirs.sort()).toEqual([specA, specB].sort());
    });
  });

  // ============================================================
  // E-07：no_spec —— 只产生 DECISION_BOUNDARY 提示，执行照常，绝不升级为硬约束
  // ============================================================
  describe('E-07：no_spec 边界（assess 正向组织 + 三个落位工具误调用均不阻断）', () => {
    it('assess_goal + no_spec → 文本 role 集 = [FACT, DECISION_BOUNDARY]，纯读取无副作用', async () => {
      const before = await lrnevEntries(workspace.path);
      const result = await callTool(client, 'assess_goal', {
        goal: '不建 Spec，直接改代码',
        decision_context: ctx({ direction: 'no_spec' }),
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      expect(payload).not.toHaveProperty('guidance');
      expect(textRoles(payload)).toEqual(['FACT', 'DECISION_BOUNDARY']);

      const boundary = linesByRole(instructionsOf(payload), PREFIX.DECISION_BOUNDARY);
      expect(boundary).toHaveLength(1);
      expect(boundary[0]).toContain('no_spec');
      expect(boundary[0]).toContain('不调用');
      // no_spec 只约束客户端：评估结果里没有任何【执行约束】硬规则
      expectNoConstraintLine(payload);
      expectNoHardConstraint(payload);
      expect(JSON.stringify(payload)).not.toContain(MARKER);
      payloads.push(payload);
      expect(await lrnevEntries(workspace.path)).toEqual(before); // assess 纯读取
    });

    it('scene_create + no_spec 误调用 → 仅边界提示，Scene 仍真实创建', async () => {
      const result = await callTool(client, 'scene_create', {
        name: 'e07-misfire-scene',
        number: 2,
        decision_context: ctx({ direction: 'no_spec' }),
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy(); // 不阻断
      const sceneId = payload.data.id as string;
      expect(sceneId).toBe('02-e07-misfire-scene');
      expect(payload).not.toHaveProperty('guidance');
      expect(textRoles(payload)).toEqual(['DECISION_BOUNDARY']);

      const boundary = linesByRole(instructionsOf(payload), PREFIX.DECISION_BOUNDARY);
      expect(boundary).toHaveLength(1);
      expect(boundary[0]).toContain('no_spec');
      expect(boundary[0]).toContain('本次请求已正常执行');
      expect(boundary[0]).toContain('不阻断');
      expect(boundary[0]).not.toContain(MARKER);
      // 无硬约束升级 + 文本通道保留同一条边界行
      expectNoConstraintLine(payload);
      expectNoHardConstraint(payload);
      expect((result.content[0]?.text ?? '')).toContain(PREFIX.DECISION_BOUNDARY);
      expect((result.content[0]?.text ?? '')).not.toContain(PREFIX.EXECUTION_CONSTRAINT);
      payloads.push(payload);

      // 执行照常发生：Scene 目录真实落盘（不自动回滚/撤销）
      await expect(fs.access(sceneMarkdownPath(workspace.path, sceneId))).resolves.toBeUndefined();
    });

    it('spec_create + no_spec 误调用 → 仅边界提示，Spec 仍真实创建（执行由真实约束决定）', async () => {
      // 支撑场景（正常创建，供 spec 落位）
      const hostResult = await callTool(client, 'scene_create', { name: 'e07-spec-host', number: 3 });
      const hostScene = payloadOf(hostResult).data.id as string;

      // E-07 误调用：no_spec 却调 spec_create
      const result = await callTool(client, 'spec_create', {
        scene: hostScene,
        name: 'nospec-misfire-spec',
        decision_context: ctx({ direction: 'no_spec' }),
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy(); // 不阻断
      const specId = payload.data.spec as string;
      expect(payload).not.toHaveProperty('guidance');
      expect(textRoles(payload)).toEqual(['FACT', 'RECOMMENDATION', 'DECISION_BOUNDARY']);

      const boundary = linesByRole(instructionsOf(payload), PREFIX.DECISION_BOUNDARY);
      expect(boundary).toHaveLength(1);
      expect(boundary[0]).toContain('no_spec');
      expect(boundary[0]).toContain('spec_create');
      expect(boundary[0]).toContain('本次请求已正常执行');
      expect(boundary[0]).not.toContain(MARKER);
      // guidance 未把 no_spec 升级为 EXECUTION_CONSTRAINT
      expectNoConstraintLine(payload);
      expectNoHardConstraint(payload);
      payloads.push(payload);

      // 执行照常发生：requirements.md 真实写入，状态权威为 draft
      await expect(fs.access(specRequirementsPath(workspace.path, hostScene, specId))).resolves.toBeUndefined();
      const fm = await readSpecFrontmatter(workspace.path, hostScene, specId);
      expect(fm.status).toBe('draft');
    });

    it('task_create + no_spec 误调用 → 仅边界提示，Task 仍真实写入', async () => {
      const hostResult = await callTool(client, 'scene_create', { name: 'e07-task-host', number: 4 });
      const hostScene = payloadOf(hostResult).data.id as string;
      const specResult = await callTool(client, 'spec_create', { scene: hostScene, name: 'nospec-task-spec' });
      const hostSpec = payloadOf(specResult).data.spec as string;

      const result = await callTool(client, 'task_create', {
        scene: hostScene,
        spec: hostSpec,
        title: '直接改代码却被误调 task_create',
        decision_context: ctx({ direction: 'no_spec' }),
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      const taskId = payload.data.id as string;
      expect(taskId).toMatch(/^T-\d+/);
      expect(payload).not.toHaveProperty('guidance');
      expect(textRoles(payload)).toEqual(['DECISION_BOUNDARY']);

      const boundary = linesByRole(instructionsOf(payload), PREFIX.DECISION_BOUNDARY);
      expect(boundary).toHaveLength(1);
      expect(boundary[0]).toContain('no_spec');
      expect(boundary[0]).toContain('task_create');
      expect(boundary[0]).toContain('不阻断');
      expectNoConstraintLine(payload);
      expectNoHardConstraint(payload);
      payloads.push(payload);

      // 执行照常：tasks.md 出现该 Task
      const taskText = await fs.readFile(specTasksPath(workspace.path, hostScene, hostSpec), 'utf8');
      expect(taskText).toContain(`### ${taskId}`);
    });
  });

  // ============================================================
  // E-08：不传 context —— spec_update 由真实状态机拒绝，错误走 canonical errors
  // ============================================================
  describe('E-08：spec_update 不带 decision_context → 状态机仍真实拒绝 archived → in-progress', () => {
    let legacyScene: string;
    let legacySpec: string;

    beforeAll(async () => {
      const sceneResult = await callTool(client, 'scene_create', { name: 'e08-legacy', number: 5 });
      legacyScene = payloadOf(sceneResult).data.id as string;
      const specResult = await callTool(client, 'spec_create', { scene: legacyScene, name: 'legacy-login' });
      legacySpec = payloadOf(specResult).data.spec as string;
      const archive = await callTool(client, 'spec_update', {
        scene: legacyScene,
        spec: legacySpec,
        status: 'archived',
        reason: 'T-005 E-08 前置：归档旧 Spec',
      });
      expect(payloadOf(archive).data.status).toBe('archived');
    });

    it('spec_update(archived → in-progress) 完全不带 decision_context → canonical 拒绝且建议替代路径', async () => {
      // E-08 语义：spec_update 不是 v1 decision_context 工具，预期不传 context；
      // 服务端状态机必须独立于任何客户端声明拒绝非法转换。
      const result = await callTool(client, 'spec_update', {
        scene: legacyScene,
        spec: legacySpec,
        status: 'in-progress',
      });
      expect(result.isError).toBe(true);
      const payload = payloadOf(result);
      expect(payload.ok).toBe(false);
      expect(payload.errors).toBeDefined();
      expect(payload.errors[0].code).toBe('INVALID_STATUS_TRANSITION');
      expect(payload.errors[0].message).toContain('archived → in-progress');
      expect(payload.errors[0].field).toBe('status');
      // 终态说明 + 可行替代路径（开新版），不得声称成功
      expect(payload.errors[0].hint).toMatch(/终态|archived/);
      expect(payload.errors[0].hint).toContain('spec_create');
      expect(JSON.stringify(payload)).not.toContain('成功');
      // 错误响应无 guidance 挂载、无 USER_DECISION
      expect(payload).not.toHaveProperty('guidance');
      expect(JSON.stringify(payload)).not.toContain(USER_DECISION);
      payloads.push(payload);

      // 状态权威：requirements.md 仍是 archived（非法转换未落盘）
      const fm = await readSpecFrontmatter(workspace.path, legacyScene, legacySpec);
      expect(fm.status).toBe('archived');
    });
  });

  // ============================================================
  // 缺失（undefined）vs unspecified（显式声明）—— 协议层响应差异断言
  // ============================================================
  describe('缺失 vs unspecified：协议层可区分（不自动改写、不误传 explicit）', () => {
    const GOAL = '新增登录功能';

    it('assess_goal：缺失与显式 unspecified 文本完全相同（缺失不被改写、unspecified 不伪装方向）；explicit 才产生声明行', async () => {
      // 缺失：客户端未声明 → 无任何 context 行
      const missingResult = await callTool(client, 'assess_goal', { goal: GOAL });
      const missingPayload = payloadOf(missingResult);
      expect(missingPayload.ok).toBe(true);
      expect(missingPayload).not.toHaveProperty('guidance');

      // 显式 unspecified：明确声明"用户未指定"（无 direction）→ 与缺失同源输出，绝不静默改写
      const unspecifiedResult = await callTool(client, 'assess_goal', {
        goal: GOAL,
        decision_context: { source: 'client_asserted', strength: 'unspecified', summary: MARKER },
      });
      const unspecifiedPayload = payloadOf(unspecifiedResult);
      expect(unspecifiedPayload.ok).toBe(true);
      expect(unspecifiedPayload).not.toHaveProperty('guidance');
      // 协议层差异断言（1）：两种调用逐行指令一致 —— 服务端对"未声明"与"明确未指定"
      // 都不伪造 direction、不包装 AI 建议为用户方向（E-03/E-04 语义，04 D-01）。
      expect(instructionsOf(unspecifiedPayload)).toEqual(instructionsOf(missingPayload));
      const allText = instructionsOf(unspecifiedPayload).join('\n');
      expect(allText).not.toContain('客户端声明');
      expect(allText).not.toContain('direction=');
      expect(JSON.stringify(unspecifiedPayload)).not.toContain(MARKER); // summary 不进任何通道
      payloads.push(missingPayload, unspecifiedPayload);

      // 协议层差异断言（2）：explicit + new_spec 在 assess_goal 上确实产生声明 FACT 行
      // —— 文本通道的 role 行（而非结构化数组）成为客户端区分三种调用的观测点。
      const explicitResult = await callTool(client, 'assess_goal', {
        goal: GOAL,
        decision_context: ctx({ direction: 'new_spec' }),
      });
      const explicitPayload = payloadOf(explicitResult);
      expect(explicitPayload).not.toHaveProperty('guidance');
      expect(textRoles(explicitPayload)).toEqual(['FACT', 'RECOMMENDATION']);
      const factLines = linesByRole(instructionsOf(explicitPayload), PREFIX.FACT);
      expect(factLines.length).toBeGreaterThan(0);
      expect(factLines[0]).toContain('direction=new_spec');
      expect(factLines[0]).toContain('client_asserted');
      payloads.push(explicitPayload);
    });

    it('协议层校验差异：declared-unspecified 携带 direction 被拒（field=decision_context.direction），缺失形态永不触发该错误', async () => {
      // unspecified + direction = 把 AI 包装成用户方向 → INVALID_INPUT（F-04/D-03）
      const bad = await callTool(client, 'assess_goal', {
        goal: GOAL,
        decision_context: { source: 'client_asserted', strength: 'unspecified', summary: MARKER, direction: 'new_spec' },
      });
      expect(bad.isError).toBe(true);
      const badPayload = payloadOf(bad);
      expect(badPayload.ok).toBe(false);
      expect(badPayload.errors[0].code).toBe('INVALID_INPUT');
      expect(badPayload.errors[0].field).toBe('decision_context.direction');
      payloads.push(badPayload);

      // 对照：缺失调用不带该字段，不可能触发条件规则 → 成功
      const missing = await callTool(client, 'assess_goal', { goal: GOAL });
      expect(payloadOf(missing).ok).toBe(true);

      // explicit 缺 direction 同样被拒（条件必填只在"已声明"时生效）
      const noDir = await callTool(client, 'assess_goal', {
        goal: GOAL,
        decision_context: { source: 'client_asserted', strength: 'explicit', summary: MARKER },
      });
      expect(noDir.isError).toBe(true);
      expect(payloadOf(noDir).errors[0].field).toBe('decision_context.direction');
    });

    it('落位工具：scene_create 缺失 vs 显式 unspecified → 都正常创建且无边界行（unspecified 不触发自动对齐）', async () => {
      const missing = await callTool(client, 'scene_create', { name: 'decl-missing-scene', number: 6 });
      const missingPayload = payloadOf(missing);
      expect(missingPayload.ok).toBe(true);
      const missingId = missingPayload.data.id as string;

      const unspecified = await callTool(client, 'scene_create', {
        name: 'decl-unspec-scene',
        number: 7,
        decision_context: { source: 'client_asserted', strength: 'unspecified', summary: MARKER },
      });
      const unspecifiedPayload = payloadOf(unspecified);
      expect(unspecifiedPayload.ok).toBe(true);
      const unspecifiedId = unspecifiedPayload.data.id as string;

      // 显式 unspecified（无 direction）→ 不做方向对齐、不产生任何边界/硬约束行
      for (const payload of [missingPayload, unspecifiedPayload]) {
        expect(payload).not.toHaveProperty('guidance');
        expect(linesByRole(instructionsOf(payload), PREFIX.DECISION_BOUNDARY)).toEqual([]);
        expect(linesByRole(instructionsOf(payload), PREFIX.EXECUTION_CONSTRAINT)).toEqual([]);
        expect(JSON.stringify(payload)).not.toContain(USER_DECISION);
      }
      payloads.push(missingPayload, unspecifiedPayload);

      await expect(fs.access(sceneMarkdownPath(workspace.path, missingId))).resolves.toBeUndefined();
      await expect(fs.access(sceneMarkdownPath(workspace.path, unspecifiedId))).resolves.toBeUndefined();
    });
  });

  // ============================================================
  // direction=other：不做自动方向比较 → 无 DECISION_BOUNDARY
  // ============================================================
  describe('other 方向：不产生自动方向比较的边界行（D-03/F-05）', () => {
    it('三个落位工具在 direction=other 下照常执行且无 DECISION_BOUNDARY / EXECUTION_CONSTRAINT', async () => {
      // 支撑 host scene + spec（正常创建）
      const hostSceneResult = await callTool(client, 'scene_create', { name: 'other-host-scene', number: 8 });
      const hostScene = payloadOf(hostSceneResult).data.id as string;
      const hostSpecResult = await callTool(client, 'spec_create', { scene: hostScene, name: 'other-host-spec' });
      const hostSpec = payloadOf(hostSpecResult).data.spec as string;

      // scene_create + other → 无自动比较
      const sceneResult = await callTool(client, 'scene_create', {
        name: 'other-extra-scene',
        number: 9,
        decision_context: ctx({ direction: 'other' }),
      });
      const scenePayload = payloadOf(sceneResult);
      expect(scenePayload.ok).toBe(true);
      expect(scenePayload).not.toHaveProperty('guidance');
      expect(linesByRole(instructionsOf(scenePayload), PREFIX.DECISION_BOUNDARY)).toEqual([]);
      expectNoConstraintLine(scenePayload);
      await expect(fs.access(sceneMarkdownPath(workspace.path, scenePayload.data.id as string))).resolves.toBeUndefined();
      payloads.push(scenePayload);

      // spec_create + other → 固有 FACT/RECOMMENDATION，无边界行
      const specResult = await callTool(client, 'spec_create', {
        scene: hostScene,
        name: 'other-new-spec',
        decision_context: ctx({ direction: 'other' }),
      });
      const specPayload = payloadOf(specResult);
      expect(specPayload.ok).toBe(true);
      // spec_create + other → 文本 role 集为固有 FACT/RECOMMENDATION，无边界行
      expect(specPayload).not.toHaveProperty('guidance');
      expect(textRoles(specPayload)).toEqual(['FACT', 'RECOMMENDATION']);
      expect(linesByRole(instructionsOf(specPayload), PREFIX.DECISION_BOUNDARY)).toEqual([]);
      expectNoConstraintLine(specPayload);
      expect(JSON.stringify(specPayload)).not.toContain(MARKER);
      payloads.push(specPayload);

      // task_create + other → 正常执行，无边界行
      const taskResult = await callTool(client, 'task_create', {
        scene: hostScene,
        spec: hostSpec,
        title: '其他方向的工作项',
        decision_context: ctx({ direction: 'other' }),
      });
      const taskPayload = payloadOf(taskResult);
      expect(taskPayload.ok).toBe(true);
      expect(taskPayload.data.id).toMatch(/^T-\d+/);
      expect(linesByRole(instructionsOf(taskPayload), PREFIX.DECISION_BOUNDARY)).toEqual([]);
      expectNoConstraintLine(taskPayload);
      expectNoHardConstraint(taskPayload);
      payloads.push(taskPayload);

      const taskText = await fs.readFile(specTasksPath(workspace.path, hostScene, hostSpec), 'utf8');
      expect(taskText).toContain(`### ${taskPayload.data.id}`);
    });
  });

  // ============================================================
  // 未知 role 降级（Profile 层纯函数契约，F-03/D-06；O6 后无运行时派生管线）
  // ============================================================
  describe('unknown role 降级：未知角色行保留在文本通道，结构化纯函数视图不升级为 Constraint', () => {
    it('注入含未知角色行的 instructions 经 toMcpToolResult(task_create) → 文本原样、payload 无 guidance、纯函数视图只含可识别角色', async () => {
      const fakeFact = 'Spec "01-00-injected" 已创建于 Scene "00-injected"。';
      const unknownLine = '【用户决定】用户拍板：必须新建独立 Spec。'; // 未知角色（USER_DECISION 语义不在服务端输出集）
      const plainLine = '普通待办文本：直接改代码。';
      const data = { task_id: 'T-099', title: '注入未知角色行', scene: '00-injected', spec: '01-00-injected' };
      const response: AiFollowupResponse<typeof data> = {
        ok: true,
        data,
        ai_followup: { instructions: [`${PREFIX.FACT}${fakeFact}`, unknownLine, plainLine] },
      };

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await toMcpToolResult(Promise.resolve(response), 'task_create');
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true); // 降级不翻 ok
      expect(result.isError).toBeFalsy();
      expect(payload.data).toEqual(data);
      // 文本通道保留原样：未知角色行不被吞掉、不加前缀、不改写
      expect(payload.ai_followup!.instructions).toEqual([`${PREFIX.FACT}${fakeFact}`, unknownLine, plainLine]);
      const contentText = result.content[0]?.text ?? '';
      expect(contentText).toContain(unknownLine);
      expect(contentText).toContain(fakeFact);
      // O6：响应不携带结构化 guidance（无运行时派生管线）
      expect(payload).not.toHaveProperty('guidance');

      // Profile 结构化视图（纯函数派生，契约面保留）：只含可识别五角色行，
      // 未知行不生成任何 guidance 项、绝不升级为 EXECUTION_CONSTRAINT
      const items = buildGuidanceView(classifyInstructions(payload.ai_followup!.instructions)).profileItems;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ role: 'FACT', text: fakeFact, profile_version: 'v1' });
      expect(JSON.stringify(items)).not.toContain('用户拍板');
      expect(JSON.stringify(items)).not.toContain('USER_DECISION');
      expect(items.some((g) => g.role === 'EXECUTION_CONSTRAINT')).toBe(false);
      // 无运行时诊断路径 → 零日志（降级语义由纯函数层保证，不产生诊断噪音）
      expect(logAll(errorSpy)).toBe('');
      vi.restoreAllMocks();
      payloads.push(payload);
    });
  });

  // ============================================================
  // 真实服务端 Constraint 先行：边界提示不顶替确定性校验（F-06/E）
  // ============================================================
  describe('执行仍由真实服务端 Constraint 决定：不一致→仅提示，真实非法→照常拒绝', () => {
    it('task_create reuse_spec 对齐但 spec 不存在 → 真实校验拒绝（SPEC_NOT_FOUND），不是边界提示', async () => {
      const result = await callTool(client, 'task_create', {
        scene: sceneA,
        spec: '01-00-ghost-spec',
        title: '指向不存在 Spec 的任务',
        decision_context: ctx({ direction: 'reuse_spec', target_ref: 'scene=01-user-management, spec=01-00-ghost-spec' }),
      });
      const payload = payloadOf(result);
      expect(result.isError).toBe(true);
      expect(payload.ok).toBe(false);
      expect(payload.errors[0].code).toBe('SPEC_NOT_FOUND');
      expect(payload).not.toHaveProperty('guidance');
      expect(JSON.stringify(payload)).not.toContain(USER_DECISION);
      payloads.push(payload);
    });

    it('spec_create explicit new_spec 但名称非法 → 真实校验拒绝（INVALID_INPUT），不因声明放行', async () => {
      const before = await fs.readdir(path.join(workspace.path, '.lrnev', 'scenes', sceneA, 'specs'));
      const result = await callTool(client, 'spec_create', {
        scene: sceneA,
        name: 'Bad Name!',
        decision_context: ctx({ direction: 'new_spec' }),
      });
      const payload = payloadOf(result);
      expect(result.isError).toBe(true);
      expect(payload.ok).toBe(false);
      expect(payload.errors[0].code).toBe('INVALID_INPUT');
      expect(payload.errors[0].field).toBe('name');
      expect(payload).not.toHaveProperty('guidance');
      expect(JSON.stringify(payload)).not.toContain(USER_DECISION);
      payloads.push(payload);

      // 真实校验先行 → 未落盘
      const after = await fs.readdir(path.join(workspace.path, '.lrnev', 'scenes', sceneA, 'specs'));
      expect(after).toEqual(before);
    });
  });

  // ============================================================
  // 哨兵：服务端不生成/不持久化 USER_DECISION、decision_context 任何痕迹
  // ============================================================
  describe('哨兵：guidance/decision_context 不持久化 + 服务端不输出 USER_DECISION', () => {
    it('.lrnev 全部文件不含 summary 哨兵、decision_context、client_asserted、USER_DECISION', async () => {
      expect(await scanLrnevForMarker(workspace.path, MARKER)).toEqual([]);
      expect(await scanLrnevForMarker(workspace.path, 'decision_context')).toEqual([]);
      expect(await scanLrnevForMarker(workspace.path, 'client_asserted')).toEqual([]);
      expect(await scanLrnevForMarker(workspace.path, USER_DECISION)).toEqual([]);
    });

    it('所有收集的响应：无 guidance 字段、无 USER_DECISION、不回显哨兵、response_version 恒 1', () => {
      expect(payloads.length).toBeGreaterThan(0);
      for (const payload of payloads) {
        // O6：任何响应（含 role 化四工具 OK 响应）都不携带结构化 guidance
        expect(payload).not.toHaveProperty('guidance');
        expect(JSON.stringify(payload)).not.toContain(USER_DECISION);
        expect(JSON.stringify(payload)).not.toContain(MARKER);
        expect(payload.response_version).toBe('1');
      }
    });
  });
});

/** 读取 console.error spy 收集的日志（未知角色降级路径不应产生任何诊断）。 */
function logAll(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c) => String(c[0])).join(' ');
}
