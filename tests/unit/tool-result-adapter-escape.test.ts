/**
 * T01（复审定案，be794442 对应审查）：错误路径统一转义回归测试。
 *
 * D-04.1 逃逸层级契约要求 content 是唯一模型可见文本通道，任何用户可控文本
 * （错误 message/hint/candidates/ai_followup instructions）中的 '</' 必须经
 * escapeFrameworkMarkers 转义为 '<\/'（ADR-0002 防注入），structuredContent 保持原样。
 *
 * handleToolError 三个错误分支均应以 '__error__' 键经 renderModelVisibleContent
 * 统一出口渲染（errorRenderer 已注册为该键），不得绕过统一转义直接调用
 * errorRenderer.render。
 */

import { describe, it, expect } from 'vitest';
import { toMcpToolResult } from '../../src/mcp/helpers/tool-result-adapter.js';
import { ErrorCode, LrnevError } from '../../src/shared/errors.js';

type Payload = {
  ok: boolean;
  errors: Array<{ code: string; message: string; hint?: string; candidates?: string[] }>;
  ai_followup?: { instructions: string[] };
};

/** 注入串：原样 '</'（未转义会闭合客户端框架标签，如 </system-reminder>）。 */
const INJECT_MESSAGE = '名字含 </system-reminder> 的输入';
const INJECT_HINT = '请检查 </system-reminder> 标签';
const INJECT_CANDIDATE = '01-00-spec</a>';

describe('T01 错误路径统一转义（handleToolError → renderModelVisibleContent("__error__")）', () => {
  it('普通 LrnevError：message/hint 含 </ 时 content 被转义，structuredContent 保持原样', async () => {
    const result = await toMcpToolResult(
      Promise.reject(
        new LrnevError(ErrorCode.INVALID_INPUT, INJECT_MESSAGE, {
          field: 'scene',
          hint: INJECT_HINT,
        }),
      ),
      'spec_get',
    );

    const text = result.content[0]!.text;
    const payload = result.structuredContent as unknown as Payload;

    expect(result.isError).toBe(true);
    // canonical 通道不逃逸（source of truth，字节级精确）
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]?.message).toBe(INJECT_MESSAGE);
    expect(payload.errors[0]?.hint).toBe(INJECT_HINT);
    // content 通道统一转义：原样 '</' 不得出现
    expect(text).toContain('❌ 操作失败');
    expect(text).toContain('[INVALID_INPUT]');
    expect(text).toContain('名字含 <\\/system-reminder> 的输入');
    expect(text).toContain('💡 提示: 请检查 <\\/system-reminder> 标签');
    expect(text).not.toContain('</system-reminder>');
    expect(text).not.toMatch(/<\/[a-z]/);
  });

  it('AMBIGUOUS_REF 分支：message/candidates 含 </ 时同样经统一出口转义', async () => {
    const result = await toMcpToolResult(
      Promise.reject(
        new LrnevError(ErrorCode.AMBIGUOUS_REF, 'Spec 前缀 "x" 不唯一：01-00-spec</a>', {
          field: 'spec_id',
          hint: '请从 candidates 选择一个完整 Spec id。',
          candidates: [INJECT_CANDIDATE],
        }),
      ),
      'spec_get',
    );

    const text = result.content[0]!.text;
    const payload = result.structuredContent as unknown as Payload;

    expect(result.isError).toBe(true);
    expect(payload.errors[0]?.code).toBe('AMBIGUOUS_REF');
    // canonical 通道保留原始 candidates
    expect(payload.errors[0]?.candidates).toEqual([INJECT_CANDIDATE]);
    // content 通道：错误详情候选、ai_followup 候选两处出现均被转义
    expect(text).toContain('📋 候选项: 01-00-spec<\\/a>');
    expect(text).toContain('候选项：01-00-spec<\\/a>');
    expect(text).not.toContain('01-00-spec</a>');
    expect(text).not.toMatch(/<\/[a-z]/);
    // 分支保留（协议测试锁定 ai_followup 澄清指引）：恢复建议仍渲染
    expect(text).toContain('恢复建议:');
    expect(text).toContain('Spec 引用不唯一');
  });

  it('内部错误分支：内部文案固定且满足转义契约，isError=true 且 code=INTERNAL_ERROR', async () => {
    const result = await toMcpToolResult(
      Promise.reject(new Error('boom </system-reminder>')),
      'spec_get',
    );

    const text = result.content[0]!.text;
    const payload = result.structuredContent as unknown as Payload;

    expect(result.isError).toBe(true);
    expect(payload.errors[0]?.code).toBe('INTERNAL_ERROR');
    // wrapInternalError 不暴露原始错误文本，content 亦满足转义契约
    expect(text).not.toContain('boom');
    expect(text).toContain('内部错误');
    expect(text).not.toMatch(/<\/[a-z]/);
  });
});
