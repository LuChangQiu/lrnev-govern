/**
 * 05-00-lrnev-guidance-profile T-004/T-006 单元测试 —— Profile 纯函数契约 + 挂载回退
 *
 * Spec: 05-00-lrnev-guidance-profile（F-03/F-06/F-07、D-04/D-05/D-06）
 * Task: T-004（裁决 Q1/Q3/Q4/Q5/Q6）+ T-006 O6（2026-09-07 运行时挂载回退）
 *
 * 覆盖：
 * - classifyInstructions：识别五角色前缀行 → 语义输入；非 role 行丢弃；顺序保持。
 * - buildGuidanceView(classifyInstructions(...)) 派生一致性（结构化项与文本同源 1:1）。
 * - guidance 项形状：role/text/profile_version 最小集；source_ref/enforcement 省略规则；
 *   与 LrnevGuidanceItemSchema zod 一致。
 * - diagnoseGuidance / assertGuidancePublishable：冲突显式诊断与发布守卫保留为纯函数
 *   契约面（T-006：运行时诊断路径已随挂载移除，冲突只在测试/CI 门禁处拦截）。
 * - tool-result-adapter（T-006 O6）：任何工具响应都不再携带 guidance 字段
 *   （运行时挂载已回退）——role 化文本行原样留在 ai_followup.instructions /
 *   content 文本通道（唯一被消费通道，G5 效果走文本不依赖数组），adapter 不产生
 *   任何 Profile 诊断日志（无运行时 diagnose 路径）。
 * - response_version 保持 '1'；不引入 priority / 三维必填。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import { GUIDANCE_PROFILE_VERSION, ROLE_PREFIX, type GuidRole } from '../../src/core/guidance-semantics.js';
import { LrnevGuidanceItemSchema } from '../../src/mcp/types/guidance-profile.js';
import {
  GuidancePublishError,
  assertGuidancePublishable,
  buildGuidanceView,
  classifyInstructions,
  diagnoseGuidance,
} from '../../src/mcp/helpers/guidance-profile.js';
import { toMcpToolResult } from '../../src/mcp/helpers/tool-result-adapter.js';
import { renderModelVisibleContent } from '../../src/mcp/helpers/model-visible-contract.js';
import type { AiFollowupResponse } from '../../src/types/response.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** 构造可被 tool-result-adapter 挂载的 AiFollowupResponse。 */
function responseWithInstructions<T>(data: T, instructions: string[]): AiFollowupResponse<T> {
  return { ok: true, data, ai_followup: { instructions } };
}

/** spec_create 的业务 data 形状（renderer 需要的字段）。 */
const specData = { spec: '00-00-guidance-spec', scene: '00-default', path: '.lrnev/scenes/00-default/specs/00-00-guidance-spec' };

describe('guidance-mounting (unit)', () => {
  // ------------------------------------------------------------
  // 1) classifyInstructions：识别 / 丢弃 / 顺序
  // ------------------------------------------------------------
  describe('classifyInstructions', () => {
    it('识别全部五角色前缀行并剥离行首前缀为语义输入（顺序保持）', () => {
      const lines = [
        '【事实】Spec 已创建。',
        '这是普通文本行（应被丢弃）。',
        '【建议】可考虑复用已有 Spec。',
        '【决策边界】以用户确认为准。',
        '【执行约束】状态机拒绝该迁移。',
        '【下一步】可调用 context_search。',
      ];
      const inputs = classifyInstructions(lines);
      expect(inputs).toEqual([
        { role: 'FACT', text: 'Spec 已创建。' },
        { role: 'RECOMMENDATION', text: '可考虑复用已有 Spec。' },
        { role: 'DECISION_BOUNDARY', text: '以用户确认为准。' },
        { role: 'EXECUTION_CONSTRAINT', text: '状态机拒绝该迁移。' },
        { role: 'ACTION_HINT', text: '可调用 context_search。' },
      ]);
    });

    it('非五角色前缀行丢弃：普通文本、【重要】等非角色引导、无前缀行都不进 Profile', () => {
      const inputs = classifyInstructions([
        '请协助用户填充 requirements.md。',
        '【重要】以上是治理建议，不代表失败。',
        '评估结果是 single-spec。',
        '【事实】真正的事实行。',
        '  【建议】行首有空格的也不算（前缀须在行首）。',
        '',
      ]);
      expect(inputs).toEqual([{ role: 'FACT', text: '真正的事实行。' }]);
    });

    it('role 化行与文本通道一一对应：剥离前缀后由 buildGuidanceView 加回，文本行字节不变', () => {
      const lines = [
        '【事实】Spec "01-00" 已创建于 Scene "00-default"。',
        '【建议】如果这是已有特性的增量，可考虑复用。',
        '【重要】非角色引导，不进 Profile。',
        '普通待办文本。',
      ];
      const inputs = classifyInstructions(lines);
      const view = buildGuidanceView(inputs);
      // buildGuidanceView 对已剥离前缀的 text 重新加同前缀 → 文本行与原 role 行完全一致
      expect(view.textLines).toEqual(lines.slice(0, 2));
      expect(view.profileItems).toHaveLength(2);
    });

    it('空输入 / 空串输入返回空数组', () => {
      expect(classifyInstructions([])).toEqual([]);
      expect(classifyInstructions(['', '  '])).toEqual([]);
    });
  });

  // ------------------------------------------------------------
  // 2) buildGuidanceView 派生一致性 + guidance 项形状
  // ------------------------------------------------------------
  describe('guidance 派生一致性与项形状', () => {
    it('派生结果与 LrnevGuidanceItemSchema 一致（最小集 role/text/profile_version）', () => {
      const lines = [
        '【事实】Spec "S" 已创建，路径 .lrnev/scenes/x/specs/S。',
        '【建议】可考虑 context_search 找到对应 Spec 用 task_create 落位。',
        '【决策边界】客户端声明方向与本次调用不一致，请先向用户确认。',
      ];
      const view = buildGuidanceView(classifyInstructions(lines));

      expect(view.profileItems).toHaveLength(3);
      for (const [index, item] of view.profileItems.entries()) {
        // 项形状：role/text/profile_version；无 source_ref / enforcement / priority / provenance
        expect(item.role).toBeDefined();
        expect(item.text).toBeDefined();
        expect(item.profile_version).toBe(GUIDANCE_PROFILE_VERSION);
        expect(item).not.toHaveProperty('source_ref');
        expect(item).not.toHaveProperty('enforcement');
        expect(item).not.toHaveProperty('priority');
        expect(item).not.toHaveProperty('provenance');
        // zod schema 校验通过
        const parsed = LrnevGuidanceItemSchema.safeParse(item);
        expect(parsed.success).toBe(true);
        // 与文本同源：ROLE_PREFIX[role] + text 恰为原文本行
        const itemRole = item.role as GuidRole;
        expect(`${ROLE_PREFIX[itemRole]}${item.text}`).toBe(lines[index]);
      }
      // 测试门禁（裁决 Q3）：真实派生项无冲突 → assertGuidancePublishable 放行
      expect(() => assertGuidancePublishable(view.profileItems)).not.toThrow();
    });

    it('guidance 项文本不带行首前缀（role 单独承载语义）', () => {
      const view = buildGuidanceView(classifyInstructions(['【事实】Spec 已创建。']));
      expect(view.profileItems[0]).toEqual({
        role: 'FACT',
        text: 'Spec 已创建。',
        profile_version: GUIDANCE_PROFILE_VERSION,
      });
    });
  });

  // ------------------------------------------------------------
  // 3) tool-result-adapter：T-006 O6 回退后不再派生/附加 guidance（文本通道原样）
  // ------------------------------------------------------------
  describe('adapter 不再挂载 guidance（T-006 O6 回退，2026-09-07）', () => {
    it('allowlist 工具（spec_create）有 role 化行 → payload 无 guidance 字段、文本通道与 content 字节不变', async () => {
      const instructions = [
        '【事实】Spec "S" 已创建于 Scene "00-default"。',
        '【建议】如果这是已有特性的增量，通常可以考虑复用。',
        '请协助用户填充 requirements.md。',
      ];
      const result = await toMcpToolResult(
        Promise.resolve(responseWithInstructions(specData, instructions)),
        'spec_create',
      );

      const payload = result.structuredContent!;
      expect(payload.ok).toBe(true);
      expect(payload.response_version).toBe('1');
      // O6：响应不再携带结构化 guidance（挂载回退；结构化面保留为纯函数库）
      expect(payload).not.toHaveProperty('guidance');
      // 文本通道原样保留（含非 role 行），不因 Profile 逻辑改写
      expect(payload.ai_followup!.instructions).toEqual(instructions);
      // content 与"同一 payload"渲染结果字节一致（文本是唯一被消费通道）
      const expected = renderModelVisibleContent('spec_create', {
        response_version: '1',
        ok: true,
        data: specData,
        ai_followup: { instructions },
      });
      expect(result.content[0]!.text).toBe(expected);
      expect(result.isError).toBeFalsy();
      // role 化行的语义仍可由纯函数链复现（契约面保留，未来客户端可用）
      const items = buildGuidanceView(classifyInstructions(instructions)).profileItems;
      expect(items.map((i) => i.role)).toEqual(['FACT', 'RECOMMENDATION']);
      expect(() => assertGuidancePublishable(items)).not.toThrow();
    });

    it('allowlist 之外的工具（spec_update）不携带 guidance', async () => {
      const instructions = ['【事实】这是 spec_update 不该携带的 role 行。', '普通指令'];
      const result = await toMcpToolResult(
        Promise.resolve(responseWithInstructions(specData, instructions)),
        'spec_update',
      );
      expect(result.structuredContent!.ok).toBe(true);
      expect(result.structuredContent!).not.toHaveProperty('guidance');
    });

    it('allowlist 工具但无 role 化行 → 不出现 guidance 字段', async () => {
      const result = await toMcpToolResult(
        Promise.resolve(responseWithInstructions(specData, ['纯文本指令一', '纯文本指令二'])),
        'spec_create',
      );
      expect(result.structuredContent!.ok).toBe(true);
      expect(result.structuredContent!).not.toHaveProperty('guidance');
    });

    it('ok=false（业务拒绝）即使带 role 化行也不携带 guidance', async () => {
      const result = await toMcpToolResult(
        Promise.resolve({
          ok: false as const,
          data: undefined,
          errors: [{ code: 'INVALID_INPUT' as const, message: '参数错误' }],
          ai_followup: { instructions: ['【事实】错误路径不挂载。'] },
        }),
        'spec_create',
      );
      expect(result.isError).toBe(true);
      expect(result.structuredContent!.ok).toBe(false);
      expect(result.structuredContent!).not.toHaveProperty('guidance');
    });

    it('toMcpToolResultFromData 不携带 guidance', async () => {
      const { toMcpToolResultFromData } = await import('../../src/mcp/helpers/tool-result-adapter.js');
      const result = await toMcpToolResultFromData(Promise.resolve({ id: 'scene-1' }), 'scene_get');
      expect(result.structuredContent!.ok).toBe(true);
      expect(result.structuredContent!).not.toHaveProperty('guidance');
    });
  });

  // ------------------------------------------------------------
  // 4) 冲突/异常面：T-006 后改为纯函数契约（诊断与发布守卫仍在），
  //    adapter 无运行时 diagnose 路径 → 不省略任何业务内容、零诊断日志
  // ------------------------------------------------------------
  describe('冲突与异常面（T-006：运行时诊断路径已移除，契约面在纯函数）', () => {
    it('【执行约束】行缺 source_ref → diagnoseGuidance 检出 constraint_missing_source_ref、发布守卫抛错；adapter 原样透传且零日志', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const instructions = [
        '【事实】Spec 已创建。',
        '【执行约束】状态机拒绝该迁移。', // EXECUTION_CONSTRAINT 无 source_ref → diagnose 冲突
      ];

      // 纯函数契约面：冲突仍被显式诊断（F-03/F-06：阻止发布的依据，供测试/CI 门禁）
      const view = buildGuidanceView(classifyInstructions(instructions));
      const diagnoses = diagnoseGuidance(view.profileItems);
      expect(diagnoses.some((d) => d.kind === 'constraint_missing_source_ref')).toBe(true);
      expect(() => assertGuidancePublishable(view.profileItems)).toThrow(GuidancePublishError);

      // adapter 面：O6 后不再运行时派生/诊断 → 业务内容原样、无 guidance、无诊断日志
      const result = await toMcpToolResult(
        Promise.resolve(responseWithInstructions(specData, instructions)),
        'spec_create',
      );
      const payload = result.structuredContent!;
      expect(payload.ok).toBe(true); // 绝不翻 ok
      expect(payload).not.toHaveProperty('guidance');
      expect(payload.data).toEqual(specData);
      expect(payload.ai_followup!.instructions).toEqual(instructions);
      expect(result.isError).toBeFalsy();
      expect(result.content[0]!.text).toBe(
        renderModelVisibleContent('spec_create', {
          response_version: '1',
          ok: true,
          data: specData,
          ai_followup: { instructions },
        }),
      );
      // 无运行时 diagnose 路径：不产生任何 [guidance-profile] 诊断日志
      expect(errorSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('注入异常 instructions（含非字符串项）→ 原样透传不抛错、不翻 ok、零诊断日志', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const raw = {
        ok: true,
        data: specData,
        ai_followup: { instructions: [42, '【事实】正常行'] },
      } as unknown as AiFollowupResponse<typeof specData>;

      const result = await toMcpToolResult(Promise.resolve(raw), 'spec_create');
      const payload = result.structuredContent!;
      expect(payload.ok).toBe(true);
      expect(payload).not.toHaveProperty('guidance');
      // 文本通道不因 Profile 逻辑被触碰（原样透传）
      expect(payload.ai_followup!.instructions).toEqual([42, '【事实】正常行']);
      expect(errorSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('allowlist 工具 + role 行 + ok=false：错误响应不携带 guidance', async () => {
      const result = await toMcpToolResult(
        Promise.resolve({
          ok: false as const,
          data: undefined,
          errors: [{ code: 'SCENE_NOT_FOUND' as const, message: 'Scene 不存在' }],
          ai_followup: { instructions: ['【事实】错误路径不挂载。'] },
        }),
        'assess_goal',
      );
      expect(result.isError).toBe(true);
      expect(result.structuredContent!.ok).toBe(false);
      expect(result.structuredContent!).not.toHaveProperty('guidance');
    });
  });

  // ------------------------------------------------------------
  // 5) 契约面收尾：真实派生项过发布守卫 / response_version 不变 / payload 恒无 guidance
  // ------------------------------------------------------------
  describe('纯函数门禁与信封约束（T-006 语义）', () => {
    it('真实 spec_create 派生项可通过 assertGuidancePublishable（测试/CI 门禁保留）', async () => {
      const instructions = [
        '【事实】Spec "S" 已创建于 Scene "00-default"，路径 .lrnev/scenes/00-default/specs/S。',
        '【建议】如果这是已有特性的增量，通常可以考虑 context_search 找到对应 Spec 用 task_create 落位。',
        '请协助用户填充 requirements.md。',
      ];
      const items = buildGuidanceView(classifyInstructions(instructions)).profileItems;
      expect(items.length).toBeGreaterThan(0);
      expect(() => assertGuidancePublishable(items)).not.toThrow();

      const result = await toMcpToolResult(
        Promise.resolve(responseWithInstructions(specData, instructions)),
        'spec_create',
      );
      expect(result.structuredContent!).not.toHaveProperty('guidance');
    });

    it('role 化行响应 response_version 保持 \'1\'（不 bump，裁决 Q6）', async () => {
      const result = await toMcpToolResult(
        Promise.resolve(
          responseWithInstructions(specData, ['【事实】Spec 已创建。', '【建议】可考虑复用。']),
        ),
        'spec_create',
      );
      expect(result.structuredContent!.response_version).toBe('1');
      expect(result.structuredContent!).not.toHaveProperty('guidance');
    });
  });
});
