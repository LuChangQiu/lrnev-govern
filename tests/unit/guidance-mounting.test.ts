/**
 * 05-00-lrnev-guidance-profile T-004 单元测试 —— Profile 挂载与文本降级派生
 *
 * Spec: 05-00-lrnev-guidance-profile（F-03/F-06/F-07、D-04/D-05/D-06）
 * Task: T-004（裁决 Q1/Q3/Q4/Q5/Q6）
 *
 * 覆盖：
 * - classifyInstructions：识别五角色前缀行 → 语义输入；非 role 行丢弃；顺序保持。
 * - buildGuidanceView(classifyInstructions(...)) 派生一致性（guidance 与文本同源）。
 * - guidance 项形状：role/text/profile_version 最小集；source_ref/enforcement 省略规则；
 *   与 LrnevGuidanceItemSchema zod 一致。
 * - tool-result-adapter 单点挂载：allowlist 四工具才有 guidance；spec_update 等没有；
 *   无 role 行 / ok=false 不挂载；content 文本字节不变（guidance 不进入文本通道）。
 * - 降级：派生冲突/失败只省略 guidance + console.error 诊断，绝不抛错、不翻 ok、
 *   不影响 data/content。
 * - response_version 保持 '1'；不引入 priority / 三维必填；assertGuidancePublishable
 *   作为测试门禁通过（真实派生项无冲突）。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import { GUIDANCE_PROFILE_VERSION, ROLE_PREFIX, type GuidRole } from '../../src/core/guidance-semantics.js';
import { LrnevGuidanceItemSchema, type LrnevGuidanceItem } from '../../src/mcp/types/guidance-profile.js';
import {
  assertGuidancePublishable,
  buildGuidanceView,
  classifyInstructions,
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
  // 3) tool-result-adapter 单点挂载：allowlist / 无 role 行 / ok=false
  // ------------------------------------------------------------
  describe('adapter 单点挂载', () => {
    it('allowlist 工具（spec_create）有 role 化行 → guidance 附加到 payload，文本通道不变', async () => {
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
      expect(Array.isArray(payload.guidance)).toBe(true);
      expect(payload.guidance!.map((g) => g.role)).toEqual(['FACT', 'RECOMMENDATION']);
      expect(payload.guidance![0]!.text).toBe('Spec "S" 已创建于 Scene "00-default"。');
      expect(payload.guidance![1]!.text).toContain('如果这是已有特性的增量');
      // 文本通道原样保留（含非 role 行），不因挂载改写
      expect(payload.ai_followup!.instructions).toEqual(instructions);
      // content 与"不含 guidance 的同一 payload"渲染结果字节一致
      const expected = renderModelVisibleContent('spec_create', {
        response_version: '1',
        ok: true,
        data: specData,
        ai_followup: { instructions },
      });
      expect(result.content[0]!.text).toBe(expected);
      expect(result.isError).toBeFalsy();
    });

    it('allowlist 之外的工具（spec_update）即使有 role 化行也不挂载', async () => {
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

    it('ok=false（业务拒绝）即使带 role 化行也不挂载 guidance', async () => {
      const result = await toMcpToolResult(
        Promise.resolve({
          ok: false as const,
          data: undefined,
          errors: [{ code: 'INVALID_INPUT' as const, message: '参数错误' }],
          ai_followup: { instructions: ['【事实】不应对错误响应挂载。'] },
        }),
        'spec_create',
      );
      expect(result.isError).toBe(true);
      expect(result.structuredContent!.ok).toBe(false);
      expect(result.structuredContent!).not.toHaveProperty('guidance');
    });

    it('toMcpToolResultFromData（不在 allowlist）不挂载', async () => {
      const { toMcpToolResultFromData } = await import('../../src/mcp/helpers/tool-result-adapter.js');
      const result = await toMcpToolResultFromData(Promise.resolve({ id: 'scene-1' }), 'scene_get');
      expect(result.structuredContent!.ok).toBe(true);
      expect(result.structuredContent!).not.toHaveProperty('guidance');
    });
  });

  // ------------------------------------------------------------
  // 4) 降级：冲突 / 派生失败 → 省略 guidance + 诊断日志，绝不翻 ok
  // ------------------------------------------------------------
  describe('降级（裁决 Q3/Q4/D-06）', () => {
    it('注入冲突（【执行约束】行缺 source_ref）→ 省略整组 guidance + console.error，不抛错、不影响 data/content', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const instructions = [
        '【事实】Spec 已创建。',
        '【执行约束】状态机拒绝该迁移。', // EXECUTION_CONSTRAINT 无 source_ref → diagnose 冲突
      ];
      const result = await toMcpToolResult(
        Promise.resolve(responseWithInstructions(specData, instructions)),
        'spec_create',
      );

      const payload = result.structuredContent!;
      expect(payload.ok).toBe(true); // 绝不翻 ok
      expect(payload).not.toHaveProperty('guidance'); // 冲突 → 省略 guidance
      expect(payload.data).toEqual(specData); // data 不受影响
      expect(payload.ai_followup!.instructions).toEqual(instructions); // 文本不受影响
      expect(result.isError).toBeFalsy();
      // content 仍来自同一渲染器（字节不变）
      expect(result.content[0]!.text).toBe(
        renderModelVisibleContent('spec_create', {
          response_version: '1',
          ok: true,
          data: specData,
          ai_followup: { instructions },
        }),
      );
      // 诊断日志
      expect(errorSpy).toHaveBeenCalled();
      const logText = errorSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(logText).toContain('[guidance-profile]');
      expect(logText).toContain('constraint_missing_source_ref');
    });

    it('注入派生失败（instructions 含非字符串项）→ 省略 guidance + 诊断日志，不抛错、不翻 ok', async () => {
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
      expect(errorSpy).toHaveBeenCalled();
      const logText = errorSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(logText).toContain('[guidance-profile]');
    });

    it('allowlist 工具 + role 行 + ok=false：不抛错、guidance 不出现', async () => {
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
  // 5) 门禁与形状补充断言
  // ------------------------------------------------------------
  describe('挂载不创建硬约束 / 不引入数字 priority / response_version 不变', () => {
    it('真实 spec_create 派生项可通过 assertGuidancePublishable（测试/CI 门禁）', async () => {
      const instructions = [
        '【事实】Spec "S" 已创建于 Scene "00-default"，路径 .lrnev/scenes/00-default/specs/S。',
        '【建议】如果这是已有特性的增量，通常可以考虑 context_search 找到对应 Spec 用 task_create 落位。',
        '请协助用户填充 requirements.md。',
      ];
      const result = await toMcpToolResult(
        Promise.resolve(responseWithInstructions(specData, instructions)),
        'spec_create',
      );
      const items = result.structuredContent!.guidance as LrnevGuidanceItem[] | undefined;
      expect(items).toBeDefined();
      expect(() => assertGuidancePublishable(items!)).not.toThrow();
    });

    it('所有挂载响应 response_version 保持 \'1\'（不 bump，裁决 Q6）', async () => {
      const result = await toMcpToolResult(
        Promise.resolve(
          responseWithInstructions(specData, ['【事实】Spec 已创建。', '【建议】可考虑复用。']),
        ),
        'spec_create',
      );
      expect(result.structuredContent!.response_version).toBe('1');
    });
  });
});
