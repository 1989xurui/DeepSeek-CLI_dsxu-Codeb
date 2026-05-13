import { RecoveryPlannerV3 } from '../recovery/recovery-planner-v3';
import { RecoveryReason, RecoveryAction, RecoveryDecision } from '../recovery/recovery-types-v3';

describe('RecoveryPlannerV3', () => {
  test('可实例化', () => {
    const planner = new RecoveryPlannerV3();
    expect(planner).toBeInstanceOf(RecoveryPlannerV3);
  });

  test('RecoveryReason 类型存在', () => {
    const reasons: RecoveryReason[] = [
      'verify-failure',
      'reviewer-rejection',
      'tool-failure',
      'context-insufficiency',
      'repeated-failure',
    ];

    expect(reasons).toHaveLength(5);
    expect(reasons).toContain('verify-failure');
    expect(reasons).toContain('reviewer-rejection');
  });

  test('RecoveryAction 类型存在', () => {
    const actions: RecoveryAction[] = [
      'retry',
      'replan',
      'rollback',
      'abort',
      'ask-human',
    ];

    expect(actions).toHaveLength(5);
    expect(actions).toContain('retry');
    expect(actions).toContain('replan');
  });

  test('RecoveryDecision 结构完整', () => {
    const decision: RecoveryDecision = {
      action: 'retry',
      reason: 'verify-failure',
      confidence: 0.8,
      retryCount: 1,
      maxRetries: 3,
      message: '测试消息',
      metadata: { test: true },
    };

    expect(decision).toHaveProperty('action');
    expect(decision).toHaveProperty('reason');
    expect(decision).toHaveProperty('confidence');
    expect(typeof decision.confidence).toBe('number');
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
  });

  test('decideRecoveryAction 返回有效决策', () => {
    const planner = new RecoveryPlannerV3();
    const context = {
      bugContext: { description: '测试bug' },
      failureCount: 1,
    };

    const decision = planner.decideRecoveryAction(context as any);

    expect(decision).toHaveProperty('action');
    expect(decision).toHaveProperty('reason');
    expect(decision).toHaveProperty('confidence');
    expect(decision.confidence).toBeGreaterThan(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
  });
});