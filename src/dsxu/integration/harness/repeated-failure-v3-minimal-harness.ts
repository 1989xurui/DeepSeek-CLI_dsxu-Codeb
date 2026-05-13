import { RecoveryIntegrationV3 } from '../../engine/recovery/recovery-integration-v3';

/**
 * 重复失败的最小化harness
 * 测试 repeated-failure 和 tool-failure 的恢复决策
 */
export class RepeatedFailureHarnessV3 {
  private integration: RecoveryIntegrationV3;

  constructor() {
    this.integration = new RecoveryIntegrationV3();
  }

  /**
   * 测试重复失败场景
   */
  testRepeatedFailureScenario(failureCount: number) {
    console.log(`\n=== 重复失败场景测试 (失败次数: ${failureCount}) ===`);

    const input = {
      // DSXU吸收线1: 会话历史
      session: {
        id: `failure-session-${failureCount}`,
        summary: `经历了${failureCount}次失败的会话`,
        memory: {
          failures: failureCount,
          lastErrors: ['错误1', '错误2', '错误3'].slice(0, failureCount),
        },
      },

      // DSXU吸收线4: 历史决策记录
      previousDecisions: Array.from({ length: failureCount - 1 }, (_, i) => ({
        action: i % 2 === 0 ? 'retry' : 'replan',
        reason: 'verify-failure',
        confidence: 0.8 - (i * 0.1),
        retryCount: i + 1,
        message: `第${i + 1}次恢复尝试`,
      })),

      bugContext: {
        description: '难以修复的顽固bug',
        filePath: '/src/core/processor.ts',
        lineNumber: 128,
      },
      failureCount,
      lastError: `第${failureCount}次尝试失败: 未知错误`,
    };

    const decision = this.integration.processRecoveryRequest(input);

    console.log('决策分析:', {
      失败次数: failureCount,
      检测原因: decision.reason,
      建议行动: decision.action,
      决策置信度: decision.confidence.toFixed(2),
      恢复建议: decision.message,
    });

    return decision;
  }

  /**
   * 测试工具失败场景
   */
  testToolFailureScenario(errorType: string = 'timeout') {
    console.log(`\n=== 工具失败场景测试 (错误类型: ${errorType}) ===`);

    const input = {
      bugContext: { description: '工具执行失败bug' },
      failureCount: 2,
      lastError: `工具执行失败: ${errorType}`,
    };

    const decision = this.integration.processRecoveryRequest(input);

    console.log('工具失败决策:', {
      错误类型: errorType,
      检测原因: decision.reason,
      建议行动: decision.action,
      置信度: decision.confidence.toFixed(2),
    });

    return decision;
  }

  /**
   * 测试综合恢复场景（包含所有DSXU吸收线）
   */
  testComprehensiveRecovery() {
    console.log('\n=== 综合恢复场景测试 (包含所有DSXU吸收线) ===');

    const input = {
      // DSXU吸收线1: session / summary / memory
      session: {
        id: 'comprehensive-session',
        summary: '综合恢复测试会话',
        memory: {
          attempts: 4,
          toolsUsed: ['validator', 'analyzer', 'fixer'],
          issues: ['性能', '内存', '稳定性'],
        },
      },

      // DSXU吸收线2: compact / retrieval
      compact: {
        context: '综合bug分析上下文',
        retrievalScore: 0.65,
      },

      // DSXU吸收线3: verify / reviewer / rollback 协同
      verification: {
        passed: false,
        errors: ['测试失败', '覆盖率不足'],
      },
      reviewer: {
        accepted: false,
        feedback: '需要全面重构',
      },
      rollback: {
        attempted: true,
        success: true,
      },

      // DSXU吸收线4: 决策结果结构化记录
      previousDecisions: [
        { action: 'retry', reason: 'verify-failure', confidence: 0.8, message: '第一次重试' },
        { action: 'replan', reason: 'reviewer-rejection', confidence: 0.7, message: '重新规划' },
        { action: 'retry', reason: 'tool-failure', confidence: 0.6, message: '工具重试' },
      ],

      bugContext: {
        description: '复杂的系统级bug',
        filePath: '/src/system/core.ts',
        lineNumber: 256,
      },
      failureCount: 4,
      lastError: '综合恢复测试失败',
    };

    const decision = this.integration.processRecoveryRequest(input);

    console.log('综合恢复决策:');
    console.log('- 原因:', decision.reason);
    console.log('- 行动:', decision.action);
    console.log('- 置信度:', decision.confidence.toFixed(2));
    console.log('- 消息:', decision.message);
    console.log('- 元数据:', JSON.stringify(decision.metadata, null, 2));

    return decision;
  }

  /**
   * 运行完整测试
   */
  runFullTest() {
    console.log('🔄 开始重复失败harness测试\n');

    // 测试不同失败次数的重复失败
    this.testRepeatedFailureScenario(3); // 应该 ask-human
    this.testRepeatedFailureScenario(5); // 应该 rollback
    this.testRepeatedFailureScenario(6); // 应该 rollback

    // 测试不同类型的工具失败
    this.testToolFailureScenario('timeout');
    this.testToolFailureScenario('permission denied');
    this.testToolFailureScenario('resource exhausted');

    // 测试综合场景
    this.testComprehensiveRecovery();

    console.log('\n✅ 重复失败harness测试完成');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const harness = new RepeatedFailureHarnessV3();
  harness.runFullTest();
}