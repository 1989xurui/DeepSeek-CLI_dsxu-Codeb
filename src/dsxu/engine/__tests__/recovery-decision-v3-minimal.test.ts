import { RecoveryPlannerV3 } from '../recovery/recovery-planner-v3';

describe('RecoveryDecisionV3', () => {
  const planner = new RecoveryPlannerV3();

  test('verify-failure → retry / replan', () => {
    // 第一次验证失败 → retry
    const context1 = {
      bugContext: { description: '验证失败bug' },
      verification: { passed: false, errors: ['验证失败'] },
      failureCount: 1,
    };

    const decision1 = planner.decideRecoveryAction(context1 as any);
    expect(decision1.reason).toBe('verify-failure');
    expect(['retry', 'replan']).toContain(decision1.action);

    // 多次验证失败 → replan
    const context2 = {
      bugContext: { description: '多次验证失败bug' },
      verification: { passed: false, errors: ['验证失败'] },
      failureCount: 3,
    };

    const decision2 = planner.decideRecoveryAction(context2 as any);
    expect(decision2.reason).toBe('verify-failure');
    expect(decision2.action).toBe('replan');
  });

  test('reviewer-rejection → replan', () => {
    const context = {
      bugContext: { description: '评审拒绝bug' },
      reviewer: { accepted: false, feedback: '需要改进' },
      failureCount: 1,
    };

    const decision = planner.decideRecoveryAction(context as any);
    expect(decision.reason).toBe('reviewer-rejection');
    expect(decision.action).toBe('replan');
  });

  test('tool-failure → retry / abort', () => {
    // 第一次工具失败 → retry
    const context1 = {
      bugContext: { description: '工具失败bug' },
      lastError: '工具执行失败: timeout',
      failureCount: 1,
    };

    const decision1 = planner.decideRecoveryAction(context1 as any);
    expect(decision1.reason).toBe('tool-failure');
    expect(decision1.action).toBe('retry');

    // 多次工具失败 → abort
    const context2 = {
      bugContext: { description: '多次工具失败bug' },
      lastError: '工具执行失败: timeout',
      failureCount: 3,
    };

    const decision2 = planner.decideRecoveryAction(context2 as any);
    expect(decision2.reason).toBe('tool-failure');
    expect(decision2.action).toBe('abort');
  });

  test('context-insufficiency → replan / ask-human', () => {
    // 第一次上下文不足 → replan
    const context1 = {
      bugContext: { description: '上下文不足bug' },
      compact: { context: '信息不足', retrievalScore: 0.3 },
      failureCount: 1,
    };

    const decision1 = planner.decideRecoveryAction(context1 as any);
    expect(decision1.reason).toBe('context-insufficiency');
    expect(decision1.action).toBe('replan');

    // 多次上下文不足 → ask-human
    const context2 = {
      bugContext: { description: '多次上下文不足bug' },
      compact: { context: '信息不足', retrievalScore: 0.3 },
      failureCount: 3,
    };

    const decision2 = planner.decideRecoveryAction(context2 as any);
    expect(decision2.reason).toBe('context-insufficiency');
    expect(decision2.action).toBe('ask-human');
  });

  test('repeated-failure → rollback / ask-human', () => {
    // 重复失败但次数较少 → ask-human
    const context1 = {
      bugContext: { description: '重复失败bug' },
      failureCount: 4,
    };

    const decision1 = planner.decideRecoveryAction(context1 as any);
    expect(decision1.reason).toBe('repeated-failure');
    expect(decision1.action).toBe('ask-human');

    // 严重重复失败 → rollback
    const context2 = {
      bugContext: { description: '严重重复失败bug' },
      failureCount: 6,
    };

    const decision2 = planner.decideRecoveryAction(context2 as any);
    expect(decision2.reason).toBe('repeated-failure');
    expect(decision2.action).toBe('rollback');
  });
});