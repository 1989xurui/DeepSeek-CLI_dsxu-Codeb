import {
  RecoveryReason,
  RecoveryAction,
  RecoveryDecision,
  RecoveryContext,
} from './recovery-types-v3';

export class RecoveryPlannerV3 {
  decideRecoveryAction(context: RecoveryContext): RecoveryDecision {
    const { failureCount, lastError } = context;

    // 确定失败原因
    const reason = this.determineReason(context);

    // 根据原因和上下文决定行动
    const action = this.determineAction(reason, context);

    // 计算置信度
    const confidence = this.calculateConfidence(reason, action, context);

    const decision: RecoveryDecision = {
      action,
      reason,
      confidence,
      retryCount: failureCount,
      maxRetries: this.getMaxRetries(reason),
      message: this.generateMessage(reason, action, context),
      metadata: {
        timestamp: Date.now(),
        lastError,
      },
    };

    return decision;
  }

  private determineReason(context: RecoveryContext): RecoveryReason {
    const { verification, reviewer, failureCount, lastError } = context;

    // 优先级：verification > reviewer > tool > context > repeated
    if (verification && !verification.passed) {
      return 'verify-failure';
    }

    if (reviewer && !reviewer.accepted) {
      return 'reviewer-rejection';
    }

    // 改进工具失败检测
    if (lastError && (
      lastError.toLowerCase().includes('tool') ||
      lastError.toLowerCase().includes('timeout') ||
      lastError.toLowerCase().includes('execution') ||
      lastError.toLowerCase().includes('failed to execute')
    )) {
      return 'tool-failure';
    }

    if (context.compact?.retrievalScore && context.compact.retrievalScore < 0.5) {
      return 'context-insufficiency';
    }

    if (failureCount >= 3) {
      return 'repeated-failure';
    }

    // 默认基于已有信息
    if (lastError) {
      return 'tool-failure';
    }

    return 'verify-failure';
  }

  private determineAction(reason: RecoveryReason, context: RecoveryContext): RecoveryAction {
    const { failureCount } = context;

    switch (reason) {
      case 'verify-failure':
        return failureCount < 2 ? 'retry' : 'replan';

      case 'reviewer-rejection':
        return 'replan';

      case 'tool-failure':
        return failureCount < 2 ? 'retry' : 'abort';

      case 'context-insufficiency':
        return failureCount < 2 ? 'replan' : 'ask-human';

      case 'repeated-failure':
        return failureCount >= 5 ? 'rollback' : 'ask-human';

      default:
        return 'retry';
    }
  }

  private calculateConfidence(reason: RecoveryReason, action: RecoveryAction, context: RecoveryContext): number {
    let confidence = 0.7; // 基础置信度

    // 根据失败次数调整
    if (context.failureCount === 1) {
      confidence += 0.1;
    } else if (context.failureCount >= 3) {
      confidence -= 0.2;
    }

    // 根据原因调整
    if (reason === 'verify-failure' || reason === 'reviewer-rejection') {
      confidence += 0.05;
    }

    if (reason === 'repeated-failure') {
      confidence -= 0.1;
    }

    // 确保在0-1范围内，且最小值为0.2
    return Math.max(0.2, Math.min(1, confidence));
  }

  private getMaxRetries(reason: RecoveryReason): number {
    switch (reason) {
      case 'verify-failure':
      case 'tool-failure':
        return 3;
      case 'reviewer-rejection':
      case 'context-insufficiency':
        return 2;
      case 'repeated-failure':
        return 1;
      default:
        return 2;
    }
  }

  private generateMessage(reason: RecoveryReason, action: RecoveryAction, context: RecoveryContext): string {
    const { failureCount } = context;

    const messages: Record<RecoveryReason, string> = {
      'verify-failure': `验证失败 (${failureCount}次)`,
      'reviewer-rejection': `评审拒绝`,
      'tool-failure': `工具执行失败`,
      'context-insufficiency': `上下文信息不足`,
      'repeated-failure': `重复失败 (${failureCount}次)`,
    };

    const actionMessages: Record<RecoveryAction, string> = {
      'retry': '重试操作',
      'replan': '重新规划',
      'rollback': '回滚更改',
      'abort': '中止任务',
      'ask-human': '请求人工干预',
    };

    return `${messages[reason]} → ${actionMessages[action]}`;
  }
}