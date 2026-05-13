import { RecoveryIntegrationV3 } from '../recovery/recovery-integration-v3';

describe('RecoveryIntegrationV3', () => {
  const integration = new RecoveryIntegrationV3();

  test('能消费最小 bug context', () => {
    const input = {
      bugContext: {
        description: '最小bug描述',
        filePath: '/test/file.ts',
        lineNumber: 42,
      },
      failureCount: 1,
    };

    const decision = integration.processRecoveryRequest(input);

    expect(decision).toBeDefined();
    expect(decision.action).toBeDefined();
    expect(decision.reason).toBeDefined();
    expect(decision.confidence).toBeGreaterThan(0);
  });

  test('能消费 session / memory / graph / compact 的最小输入', () => {
    const input = {
      // DSXU吸收线1: session / summary / memory
      session: {
        id: 'session-123',
        summary: '测试会话摘要',
        memory: { key: 'value' },
      },

      // DSXU吸收线2: compact / retrieval
      compact: {
        context: '压缩后的上下文',
        retrievalScore: 0.7,
      },

      // DSXU吸收线3: verify / reviewer / rollback 协同
      verification: {
        passed: false,
        errors: ['验证错误1', '验证错误2'],
      },
      reviewer: {
        accepted: false,
        feedback: '需要改进实现',
      },
      rollback: {
        attempted: true,
        success: false,
      },

      // DSXU吸收线4: 决策结果结构化记录
      previousDecisions: [
        {
          action: 'retry',
          reason: 'verify-failure',
          confidence: 0.8,
          retryCount: 1,
          message: '第一次重试',
        },
      ],

      // 基础信息
      bugContext: {
        description: '完整输入测试bug',
      },
      failureCount: 2,
      lastError: '综合错误',
    };

    const decision = integration.processRecoveryRequest(input);

    // 验证所有DSXU吸收线输入都被处理
    expect(decision).toBeDefined();
    expect(decision.action).toBeDefined();
    expect(decision.reason).toBeDefined();

    // 验证决策包含必要信息
    expect(decision.confidence).toBeGreaterThan(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
    expect(decision.message).toBeDefined();
    expect(decision.metadata).toBeDefined();
  });

  test('能返回结构化 RecoveryDecision', () => {
    const input = {
      bugContext: { description: '结构化测试' },
      failureCount: 1,
    };

    const decision = integration.processRecoveryRequest(input);

    // 验证决策结构
    expect(decision).toBeDefined();
    expect(typeof decision.action).toBe('string');
    expect(typeof decision.reason).toBe('string');
    expect(typeof decision.confidence).toBe('number');

    // 验证置信度范围
    expect(decision.confidence).toBeGreaterThanOrEqual(0.2);
    expect(decision.confidence).toBeLessThanOrEqual(1);

    // 验证可选字段
    if (decision.retryCount !== undefined) {
      expect(typeof decision.retryCount).toBe('number');
    }
    if (decision.maxRetries !== undefined) {
      expect(typeof decision.maxRetries).toBe('number');
    }
    if (decision.message !== undefined) {
      expect(typeof decision.message).toBe('string');
    }
  });

  test('DSXU吸收线4个输入点至少在对象结构里存在', () => {
    const input = {
      bugContext: { description: '吸收线测试' },
      failureCount: 1,
    };

    const decision = integration.processRecoveryRequest(input);

    // 验证决策包含吸收线相关的元数据
    expect(decision.metadata).toBeDefined();
    expect(decision.metadata).toHaveProperty('timestamp');
    expect(typeof decision.metadata.timestamp).toBe('number');

    // 验证quickDecide接口
    const quickDecision = integration.quickDecide('verify-failure', 2, '快速测试');
    expect(quickDecision).toBeDefined();
    expect(quickDecision.reason).toBe('verify-failure');
  });
});