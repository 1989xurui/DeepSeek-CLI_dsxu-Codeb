import { RecoveryIntegrationV3 } from '../../engine/recovery/recovery-integration-v3';

/**
 * 评审恢复的最小化harness
 * 专门测试 reviewer-rejection 和 context-insufficiency 场景
 */
export class ReviewerRecoveryHarnessV3 {
  private integration: RecoveryIntegrationV3;

  constructor() {
    this.integration = new RecoveryIntegrationV3();
  }

  /**
   * 测试评审拒绝恢复场景
   */
  testReviewerRecovery(feedback: string = '需要改进') {
    console.log('\n=== 评审拒绝恢复测试 ===');

    const input = {
      // DSXU吸收线1: session信息
      session: {
        id: 'review-session-001',
        summary: '代码评审会话',
        memory: { previousAttempts: 2 },
      },

      // DSXU吸收线2: compact信息
      compact: {
        context: '相关代码上下文',
        retrievalScore: 0.8,
      },

      // DSXU吸收线3: 评审反馈
      reviewer: {
        accepted: false,
        feedback,
      },

      // DSXU吸收线4: 历史决策
      previousDecisions: [
        {
          action: 'retry',
          reason: 'verify-failure',
          confidence: 0.7,
          message: '第一次尝试',
        },
      ],

      bugContext: {
        description: '函数实现不符合规范',
        filePath: '/src/utils/validator.ts',
        lineNumber: 45,
      },
      failureCount: 1,
      lastError: '评审未通过',
    };

    const decision = this.integration.processRecoveryRequest(input);

    console.log('输入反馈:', feedback);
    console.log('恢复决策:', {
      原因: decision.reason,
      行动: decision.action,
      置信度: decision.confidence.toFixed(2),
      建议: decision.message,
    });

    return decision;
  }

  /**
   * 测试上下文信息不足场景
   */
  testContextInsufficiency(retrievalScore: number = 0.3) {
    console.log(`\n=== 上下文信息不足测试 (检索分数: ${retrievalScore}) ===`);

    const input = {
      compact: {
        context: '有限的上下文信息',
        retrievalScore,
      },
      bugContext: {
        description: '复杂bug需要更多上下文',
      },
      failureCount: retrievalScore < 0.3 ? 3 : 1, // 低分数时模拟多次失败
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
   * 运行完整测试
   */
  runFullTest() {
    console.log('🧠 开始评审恢复harness测试\n');

    // 测试不同反馈的评审拒绝
    this.testReviewerRecovery('代码风格需要改进');
    this.testReviewerRecovery('算法效率不足');
    this.testReviewerRecovery('缺少错误处理');

    // 测试不同检索分数的上下文不足
    this.testContextInsufficiency(0.2); // 很低分数，应该 ask-human
    this.testContextInsufficiency(0.4); // 中等分数，应该 replan
    this.testContextInsufficiency(0.6); // 较高分数，可能不是上下文不足

    console.log('\n✅ 评审恢复harness测试完成');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const harness = new ReviewerRecoveryHarnessV3();
  harness.runFullTest();
}