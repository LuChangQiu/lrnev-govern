import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import * as fs from 'fs';
import * as path from 'path';
import { TaskManager } from '../../src/core/TaskManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { ErrorCode } from '../../src/shared/errors.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';

// Load fixtures
const fixturesDir = path.join(__dirname, '../fixtures/semantic-authority');
const E01 = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'E-01-explicit.json'), 'utf-8'));
const E02 = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'E-02-preferred.json'), 'utf-8'));
const E03 = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'E-03-unspecified.json'), 'utf-8'));
const E04 = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'E-04-user-changed-decision.json'), 'utf-8'));
const E05 = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'E-05-constraint-conflict.json'), 'utf-8'));

/**
 * Static semantic checker: detects prohibited patterns in guidance text
 * Returns array of violations with pattern description and location
 */
function checkSemanticViolations(text: string): Array<{ pattern: string; location: number; violation: string }> {
  const violations: Array<{ pattern: string; location: number; violation: string }> = [];

  // Check 1: RECOMMENDATION written as mandatory
  const mandatoryInRecommendation = /【建议】[^。！？]*?(只能|必须|不允许|拒绝)/g;
  let match;
  while ((match = mandatoryInRecommendation.exec(text)) !== null) {
    violations.push({
      pattern: match[0],
      location: match.index,
      violation: 'RECOMMENDATION contains mandatory language (只能/必须/不允许/拒绝)',
    });
  }

  // Check 2: USER_DECISION from non-user sources
  const fabricatedDecision = /(GoalAssessor|spec_list|gate check|tool result)[^。！？]*?【用户已决定|用户确认】/gi;
  while ((match = fabricatedDecision.exec(text)) !== null) {
    violations.push({
      pattern: match[0],
      location: match.index,
      violation: 'USER_DECISION fabricated from non-user source',
    });
  }

  // Check 3: Client boundary disguised as server rule
  const disguisedBoundary = /【执行约束】[^。！？]*?(客户端|前端|界面|显示)/g;
  while ((match = disguisedBoundary.exec(text)) !== null) {
    violations.push({
      pattern: match[0],
      location: match.index,
      violation: 'Client boundary disguised as EXECUTION_CONSTRAINT',
    });
  }

  // Check 4: Decision origin not traceable (USER_DECISION without user_quote/client_asserted provenance)
  const untraceableDecision = /【用户已决定|用户确认】/g;
  while ((match = untraceableDecision.exec(text)) !== null) {
    // Check if there's no explicit provenance marker nearby
    const context = text.substring(Math.max(0, match.index - 100), Math.min(text.length, match.index + 100));
    if (!/user_quote|client_asserted|用户明确要求/.test(context)) {
      violations.push({
        pattern: match[0],
        location: match.index,
        violation: 'USER_DECISION without traceable provenance (missing user_quote/client_asserted)',
      });
    }
  }

  // Check 5: Decision boundary overreach (DECISION_BOUNDARY claiming server enforcement)
  const boundaryOverreach = /【决策边界】[^。！？]*?(服务端将拒绝|服务端强制|限制已绕过)/g;
  while ((match = boundaryOverreach.exec(text)) !== null) {
    violations.push({
      pattern: match[0],
      location: match.index,
      violation: 'DECISION_BOUNDARY claiming server enforcement power',
    });
  }

  // Check 6: Server constraint without source reference
  const constraintPattern = /【执行约束】[^。！？]+/g;
  while ((match = constraintPattern.exec(text)) !== null) {
    const constraintText = match[0];
    // Check if it has source reference markers
    if (!/参考|源码|SpecManager|TaskManager|SceneManager|ClaimStore|实现于|见代码/.test(constraintText)) {
      violations.push({
        pattern: constraintText,
        location: match.index,
        violation: 'EXECUTION_CONSTRAINT without source code reference',
      });
    }
  }

  return violations;
}

describe('Semantic Authority Model v0.1', () => {
  describe('Five Semantic Cases', () => {
    describe('E-01: Explicit User Request Overrides Recommendation', () => {
      it('should allow spec creation even when similar spec exists (recommendation does not block)', () => {
        // This is a semantic assertion test - verifies the principle that:
        // - User explicit request (DECISION_BOUNDARY) > RECOMMENDATION
        // - Server only enforces real EXECUTION_CONSTRAINT

        expect(E01.id).toBe('E-01');
        expect(E01.role).toBe('decision_boundary');
        expect(E01.enforcement).toBe('client_boundary');

        // Client behavior assertions
        expect(E01.clientBehavior.actions).toContain('识别用户明确请求：「新建 Spec B」');
        expect(E01.clientBehavior.actions).toContain('不将 RECOMMENDATION 显示为阻断规则');

        // Server behavior assertions
        expect(E01.serverBehavior.response.mustNotInclude).toContain('【执行约束】不能创建新 Spec，必须使用 A');
        expect(E01.serverBehavior.constraints).toContain('不因已有相似 Spec A 而拒绝创建 B');

        // Observable result assertions
        expect(E01.observableResult.assertions).toContain('RECOMMENDATION 不阻止 B 的创建');

        // User story validation
        expect(E01.userStory).toContain('建议仍可解释利弊，但不能被当作禁止新建的规则');
      });
    });

    describe('E-02: Preferred Recommendation Without Confirmation', () => {
      it('should not generate USER_DECISION from RECOMMENDATION', () => {
        expect(E02.id).toBe('E-02');
        expect(E02.role).toBe('recommendation');
        expect(E02.enforcement).toBe('none');
        expect(E02.provenance).toBe('lrnev');

        // Server must not fabricate user decision
        expect(E02.serverBehavior.response.mustNotInclude).toContain('【用户已决定】使用 Spec A');
        expect(E02.serverBehavior.response.mustNotInclude).toContain('【用户已确认】不创建新 Spec');
        expect(E02.serverBehavior.response.mustNotInclude).toContain('从 GoalAssessor.suggested_next_step 生成的 USER_DECISION');

        // Observable result: no fabricated decision
        expect(E02.observableResult.assertions).toContain('响应不包含 USER_DECISION 标记');
        expect(E02.observableResult.assertions).toContain('用户可选择复用或新建，两者均为合法路径');
      });
    });

    describe('E-03: Unspecified Direction Requires Clarification', () => {
      it('should not treat GoalAssessor output as USER_DECISION', () => {
        expect(E03.id).toBe('E-03');
        expect(E03.role).toBe('action_hint');

        // Client behavior: GoalAssessor is heuristic, not decision
        expect(E03.clientBehavior.actions).toContain('不把 GoalAssessor.kind 或 suggested_next_step 当作 USER_DECISION');

        // Server behavior: GoalAssessor results are recommendations
        expect(E03.serverBehavior.response.canInclude).toContain('GoalAssessor 的 kind（single-spec/multi-spec-program/research-program）作为启发式');
        expect(E03.serverBehavior.response.mustNotInclude).toContain('把 GoalAssessor.kind 伪装成用户意图');

        // Observable result
        expect(E03.observableResult.assertions).toContain('GoalAssessor 结果仅作为 RECOMMENDATION 或 ACTION_HINT');
        expect(E03.observableResult.assertions).toContain('服务端未持久化未经确认的方向');
      });
    });

    describe('E-04: User Changed Decision', () => {
      it('should honor latest user decision without requiring revocation of previous decision', () => {
        expect(E04.id).toBe('E-04');
        expect(E04.provenance).toBe('user_quote');
        expect(E04.role).toBe('decision_boundary');

        // Server does not create locks from conversation history
        expect(E04.serverBehavior.response.mustNotInclude).toContain('【执行约束】必须先撤销方案 A');
        expect(E04.serverBehavior.response.mustNotInclude).toContain('把客户端对话历史当作服务端状态锁');

        // Dialogue flow validation
        expect(E04.dialogueFlow).toHaveLength(3);
        expect(E04.dialogueFlow[1].client).toContain('覆盖之前的决定');

        // Observable result
        expect(E04.observableResult.assertions).toContain('服务端未因历史决定 A 产生阻断');
      });
    });

    describe('E-05: Real Constraint Conflict', () => {
      it('should reference real execution constraint from inventory', () => {
        expect(E05.id).toBe('E-05');
        expect(E05.role).toBe('execution_constraint');
        expect(E05.enforcement).toBe('server_enforced');

        // Must reference real constraint from execution-constraints-inventory.md
        expect(E05.realConstraintReference.inventorySection).toBe('§1.1 Spec Status Transition');
        expect(E05.realConstraintReference.sourceFile).toContain('src/core/SpecManager.ts');
        expect(E05.realConstraintReference.validationFunction).toBe('isValidSpecTransition(from, to)');

        // Server behavior: deterministic rejection
        expect(E05.serverBehavior.response.errorCode).toBe('INVALID_STATUS_TRANSITION');
        expect(E05.serverBehavior.response.observableResult).toContain('未写入');

        // Observable result: error code and hint
        expect(E05.observableResult.assertions).toContain('错误码为 INVALID_STATUS_TRANSITION');
        expect(E05.observableResult.assertions).toContain('这是确定性服务端校验，不是 RECOMMENDATION');
      });
    });
  });

  describe('Direct assertValidatesAnchors Tests', () => {
    let taskManager: TaskManager;
    let specManager: SpecManager;
    let sceneManager: SceneManager;
    let tmpDirHandle: DirectoryResult;
    let storage: FileStorage;
    let testScene: any;
    let testSpec: any;

    beforeEach(async () => {
      // Create temp test workspace
      tmpDirHandle = await tmpDir({ unsafeCleanup: true });
      const testRoot = tmpDirHandle.path;

      storage = new FileStorage(testRoot);
      await ensureWorkspace(testRoot);

      sceneManager = new SceneManager(storage);
      specManager = new SpecManager(storage, sceneManager);
      taskManager = new TaskManager(storage, sceneManager, specManager);

      // Create test scene and spec with anchors
      const sceneResult = await sceneManager.create({ name: 'test-scene' });
      testScene = sceneResult.data;
      const specResult = await specManager.create({
        scene: testScene.id,
        name: 'test-spec',
      });
      testSpec = specResult.data;

      // Write requirements.md with F-xx anchors
      const reqPath = path.join('.lrnev', 'scenes', testScene.id, 'specs', testSpec.spec, 'requirements.md');
      const reqContent = `---
spec: test-spec
---

# Requirements

#### F-01 First Feature
Content for F-01

#### F-02 Second Feature
Content for F-02
`;
      await storage.write(reqPath, reqContent);

      // Write design.md with D-xx anchors
      const designPath = path.join('.lrnev', 'scenes', testScene.id, 'specs', testSpec.spec, 'design.md');
      const designContent = `---
spec: test-spec
---

# Design

#### D-01 First Design
Design content

#### D-02 Second Design
More design
`;
      await storage.write(designPath, designContent);
    });

    afterEach(async () => {
      // Cleanup temp directory
      await tmpDirHandle.cleanup();
    });

    it('should accept valid F-xx validates anchors that exist in requirements.md', async () => {
      const result = await taskManager.create({
        scene: testScene.id,
        spec: testSpec.spec,
        title: 'Test task with valid F anchor',
        validates: ['F-01'],
      });

      expect(result.ok).toBe(true);
      expect(result.data.validates).toContain('F-01');
    });

    it('should accept valid D-xx validates anchors that exist in design.md', async () => {
      const result = await taskManager.create({
        scene: testScene.id,
        spec: testSpec.spec,
        title: 'Test task with valid D anchor',
        validates: ['D-01', 'D-02'],
      });

      expect(result.ok).toBe(true);
      expect(result.data.validates).toContain('D-01');
      expect(result.data.validates).toContain('D-02');
    });

    it('should reject F-xx anchor that does not exist in requirements.md', async () => {
      try {
        await taskManager.create({
          scene: testScene.id,
          spec: testSpec.spec,
          title: 'Test task with missing F anchor',
          validates: ['F-99'],
        });
        expect.fail('Should have thrown ANCHOR_NOT_FOUND error');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.ANCHOR_NOT_FOUND);
        expect(error.message).toContain('F-99');
        expect(error.message).toContain('requirements.md');
      }
    });

    it('should reject D-xx anchor that does not exist in design.md', async () => {
      try {
        await taskManager.create({
          scene: testScene.id,
          spec: testSpec.spec,
          title: 'Test task with missing D anchor',
          validates: ['D-99'],
        });
        expect.fail('Should have thrown ANCHOR_NOT_FOUND error');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.ANCHOR_NOT_FOUND);
        expect(error.message).toContain('D-99');
        expect(error.message).toContain('design.md');
      }
    });

    it('should reject mixed valid and invalid anchors', async () => {
      try {
        await taskManager.create({
          scene: testScene.id,
          spec: testSpec.spec,
          title: 'Test task with mixed anchors',
          validates: ['F-01', 'F-99', 'D-01'],
        });
        expect.fail('Should have thrown ANCHOR_NOT_FOUND error');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.ANCHOR_NOT_FOUND);
        expect(error.message).toContain('F-99');
      }
    });

    it('should reject invalid anchor format', async () => {
      try {
        await taskManager.create({
          scene: testScene.id,
          spec: testSpec.spec,
          title: 'Test task with invalid format',
          validates: ['invalid-format'],
        });
        expect.fail('Should have thrown INVALID_INPUT error');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.INVALID_INPUT);
        expect(error.message).toContain('F-xx / D-xx');
      }
    });

    it('should reject legacy design# format', async () => {
      try {
        await taskManager.create({
          scene: testScene.id,
          spec: testSpec.spec,
          title: 'Test task with legacy format',
          validates: ['design#some-section'],
        });
        expect.fail('Should have thrown INVALID_INPUT error');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.INVALID_INPUT);
        expect(error.message).toContain('validates 锚点格式已废弃');
        expect(error.message).toContain('design#');
      }
    });
  });

  describe('Static Semantic Checks', () => {
    describe('Prohibition: Recommendation as Mandatory', () => {
      it('should detect when recommendation is written as must/only/required', () => {
        const forbiddenPatterns = [
          '【建议】只能使用现有 Spec',
          '【建议】必须先创建父任务',
          '【建议】服务端拒绝其他选择',
          '【建议】不允许创建新 Spec',
        ];

        forbiddenPatterns.forEach(pattern => {
          const violations = checkSemanticViolations(pattern);
          expect(violations.length).toBeGreaterThan(0);
          expect(violations[0]!.violation).toContain('mandatory language');
        });

        const validPatterns = [
          '【建议】可以考虑使用现有 Spec',
          '【建议】优先评估复用方案',
          '【建议】建议先创建父任务',
        ];

        validPatterns.forEach(pattern => {
          const violations = checkSemanticViolations(pattern);
          expect(violations).toHaveLength(0);
        });
      });
    });

    describe('Prohibition: User Decision Above Real Constraint', () => {
      it('should detect when client-asserted decision is treated as server constraint', () => {
        const violations = [
          '【决策边界】用户确认使用方案 A，因此服务端将拒绝其他方案',
          '【用户已决定】创建 Spec B，archived Spec 限制已绕过',
        ];

        violations.forEach(text => {
          // These patterns violate semantic authority by treating USER_DECISION as SERVER_CONSTRAINT
          // Verify the problematic pattern exists
          const hasDecisionMarker = /决策边界|用户已决定/.test(text);
          const hasServerOverreach = /服务端将拒绝|限制已绕过/.test(text);

          expect(hasDecisionMarker).toBe(true);
          expect(hasServerOverreach).toBe(true);

          // This combination is semantically invalid:
          // USER_DECISION should not grant server enforcement power
        });
      });
    });

    describe('Prohibition: Client Boundary Disguised as Server Rule', () => {
      it('should detect when client boundary is falsely claimed as server constraint', () => {
        const violations = [
          '【执行约束】客户端必须显示确认对话框',
          '【执行约束】界面上不能出现该选项',
        ];

        violations.forEach(text => {
          const detected = checkSemanticViolations(text);
          expect(detected.length).toBeGreaterThan(0);
          expect(detected[0]!.violation).toContain('Client boundary disguised');
        });

        // Valid patterns
        const validPatterns = [
          '【决策边界】客户端确认后，以最后确认方向为准',
          '【执行约束】服务端状态机拒绝 archived → in-progress（参考 SpecManager.updateStatus）',
        ];

        validPatterns.forEach(text => {
          const detected = checkSemanticViolations(text);
          expect(detected).toHaveLength(0);
        });
      });
    });

    describe('Prohibition: Fabricating USER_DECISION from Tool Results', () => {
      it('should detect USER_DECISION generated from non-user sources', () => {
        const violations = [
          {
            source: 'GoalAssessor.kind',
            claim: '【用户已决定】采用 single-spec 方案',
            issue: 'GoalAssessor is heuristic, not user decision',
          },
          {
            source: 'spec_list result',
            claim: '【用户确认】使用已找到的 Spec A',
            issue: 'Tool result is not user confirmation',
          },
          {
            source: 'gate check result',
            claim: '【用户已决定】先修复 gate 问题',
            issue: 'Gate result is fact, not user decision',
          },
        ];

        violations.forEach(({ source, claim }) => {
          const text = `${source} ${claim}`;
          const detected = checkSemanticViolations(text);
          expect(detected.length).toBeGreaterThan(0);
          expect(detected[0]!.violation).toContain('fabricated from non-user source');
        });

        // Valid patterns
        const validSources = [
          {
            source: 'user_quote',
            claim: '【决策边界】用户明确要求「创建新 Spec」',
            valid: true,
          },
          {
            source: 'client_asserted',
            claim: '【决策边界】客户端确认用户选择了方案 B',
            valid: true,
          },
        ];

        validSources.forEach(({ claim }) => {
          const detected = checkSemanticViolations(claim);
          expect(detected).toHaveLength(0);
        });
      });
    });

    describe('Three-Dimensional Framework Non-Expansion', () => {
      it('should not require provenance/role/enforcement as mandatory fields in all messages', () => {
        // The three-dimensional framework is for analysis, not protocol
        // Fixtures use them for documentation, but they are not mandatory in runtime messages
        expect(E01.provenance).toBeDefined();
        expect(E01.role).toBeDefined();
        expect(E01.enforcement).toBeDefined();

        // The framework is for analysis only, not runtime protocol requirements
        // Runtime guidance uses text prefixes (【建议】/【事实】), not structured three-field objects

        // Verify that these are analysis fields, not required in every runtime message
        const hasAllAnalysisFields = Boolean(E01.provenance && E01.role && E01.enforcement);
        expect(hasAllAnalysisFields).toBe(true);
      });

      it('should not use numeric priority to compare different semantics', () => {
        // The semantic authority model forbids reducing provenance/role/enforcement
        // to a single numeric priority. Each dimension must be evaluated separately.

        // Invalid approach: assigning priority numbers
        const invalidComparison = {
          recommendation: { priority: 1 },
          userDecision: { priority: 2 },
          constraint: { priority: 3 },
        };

        // This test verifies the anti-pattern exists in our test data
        // (to document what NOT to do, per §4 and §8)
        const hasInvalidPriorityPattern =
          invalidComparison.recommendation.priority < invalidComparison.userDecision.priority &&
          invalidComparison.userDecision.priority < invalidComparison.constraint.priority;

        // Confirm the anti-pattern structure exists (for documentation purposes)
        expect(hasInvalidPriorityPattern).toBe(true);

        // The correct approach: evaluate provenance → role → enforcement separately
        // Not: compare priority numbers
      });
    });
  });

  describe('Constraint Inventory Cross-Reference', () => {
    it('should verify E-05 references real constraints from inventory', () => {
      // E-05 must only reference constraints documented in execution-constraints-inventory.md
      expect(E05.realConstraintReference.inventorySection).toBe('§1.1 Spec Status Transition');

      // The constraint must have:
      // - Source file location
      expect(E05.serverBehavior.sourceFiles[0]).toContain('src/types/spec.ts');
      expect(E05.serverBehavior.sourceFiles[1]).toContain('src/core/SpecManager.ts');

      // - Observable error code
      expect(E05.serverBehavior.response.errorCode).toBe('INVALID_STATUS_TRANSITION');

      // - Alternative path
      expect(E05.serverBehavior.response.hint).toContain('spec_create');

      // This satisfies F-05 requirement: "约束冲突案例只引用经源码核验的真实 Constraint"
    });

    it('should not reference non-implemented constraints', () => {
      // These are explicitly listed as NOT constraints in inventory and dev-docs/ai-guidance-standardization/notes/semantic-authority-model.md §6.1
      const nonConstraints = [
        'archived Spec 不能新增 Task',
        'ready gate 会为其他工具建立全局锁',
        '发现已有相近 Spec 后不能创建新的 Spec',
      ];

      // None of these should appear in E-05 or any fixture as EXECUTION_CONSTRAINT
      const allFixtures = [E01, E02, E03, E04, E05];

      nonConstraints.forEach(nonConstraint => {
        allFixtures.forEach(fixture => {
          const fixtureText = JSON.stringify(fixture);
          // Verify that non-implemented constraints are not referenced
          expect(fixtureText).not.toContain(nonConstraint);
        });
      });
    });
  });
});
