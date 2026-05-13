import { RecoveryIntegrationV3 } from '../../engine/recovery/recovery-integration-v3';

/**
 * 重试和重新规划的最小化harness
 * 用于测试 verify-failure 和 reviewer-rejection 场景
 */
export class RetryReplanHarnessV3 {
  private integration: RecoveryIntegrationV3;

  constructor() {
    this.integration = new RecoveryIntegrationV3();
  }

  /**
   * 测试验证失败场景
   */
  testVerifyFailureScenario(failureCount: number = 1) {
    console.log(`\n=== 验证失败场景测试 (失败次数: ${failureCount}) ===`);

    const decision = this.integration.quickDecide('verify-failure', failureCount, '验证失败bug');

    console.log('决策:', {
      原因: decision.reason,
      行动: decision.action,
      置信度: decision.confidence.toFixed(2),
      消息: decision.message,
    });

    return decision;
  }

  /**
   * 测试评审拒绝场景
   */
  testReviewerRejectionScenario(failureCount: number = 1) {
    console.log(`\n=== 评审拒绝场景测试 (失败次数: ${failureCount}) ===`);

    const input = {
      bugContext: { description: '评审拒绝bug' },
      reviewer: { accepted: false, feedback: '代码质量不足' },
      failureCount,
    };

    const decision = this.integration.processRecoveryRequest(input);

    console.log('决策:', {
      原因: decision.reason,
      行动: decision.action,
      置信度: decision.confidence.toFixed(2),
      消息: decision.message,
    });

    return decision;
  }

  /**
   * 运行完整测试序列
   */
  runFullTest() {
    console.log('🚀 开始重试/重新规划harness测试\n');

    // 测试不同失败次数的验证失败
    this.testVerifyFailureScenario(1); // 应该返回 retry
    this.testVerifyFailureScenario(3); // 应该返回 replan

    // 测试评审拒绝
    this.testReviewerRejectionScenario(1); // 应该返回 replan
    this.testReviewerRejectionScenario(2); // 应该返回 replan

    console.log('\n✅ 重试/重新规划harness测试完成');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const harness = new RetryReplanHarnessV3();
  harness.runFullTest();
}