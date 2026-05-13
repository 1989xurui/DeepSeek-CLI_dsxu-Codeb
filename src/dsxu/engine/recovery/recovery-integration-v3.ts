import { RecoveryPlannerV3 } from './recovery-planner-v3';
import { RecoveryContext, RecoveryDecision } from './recovery-types-v3';

export class RecoveryIntegrationV3 {
  private planner: RecoveryPlannerV3;

  constructor() {
    this.planner = new RecoveryPlannerV3();
  }

  /**
   * DSXU吸收线集成入口
   * 接收最小化的输入结构，返回恢复决策
   */
  processRecoveryRequest(input: {
    // DSXU吸收线1: session / summary / memory
    session?: {
      id: string;
      summary?: string;
      memory?: Record<string, unknown>;
    };

    // DSXU吸收线2: compact / retrieval
    compact?: {
      context: string;
      retrievalScore?: number;
    };

    // DSXU吸收线3: verify / reviewer / rollback 协同
    verification?: {
      passed: boolean;
      errors?: string[];
    };
    reviewer?: {
      accepted: boolean;
      feedback?: string;
    };
    rollback?: {
      attempted: boolean;
      success?: boolean;
    };

    // DSXU吸收线4: 决策结果结构化记录
    previousDecisions?: RecoveryDecision[];

    // 基础信息
    bugContext: {
      description: string;
      filePath?: string;
      lineNumber?: number;
    };
    failureCount: number;
    lastError?: string;
  }): RecoveryDecision {

    const context: RecoveryContext = {
      session: input.session,
      compact: input.compact,
      verification: input.verification,
      reviewer: input.reviewer,
      rollback: input.rollback,
      previousDecisions: input.previousDecisions,
      bugContext: input.bugContext,
      failureCount: input.failureCount,
      lastError: input.lastError,
    };

    return this.planner.decideRecoveryAction(context);
  }

  /**
   * 简化接口，用于快速测试
   */
  quickDecide(
    reason: string,
    failureCount: number = 1,
    bugDescription: string = 'test bug'
  ): RecoveryDecision {
    const context: RecoveryContext = {
      bugContext: { description: bugDescription },
      failureCount,
      lastError: `模拟错误: ${reason}`,
    };

    // 根据reason设置相应的上下文
    if (reason.includes('verify')) {
      context.verification = { passed: false, errors: ['验证失败'] };
    } else if (reason.includes('reviewer')) {
      context.reviewer = { accepted: false, feedback: '评审拒绝' };
    } else if (reason.includes('tool')) {
      context.lastError = '工具执行失败: ' + reason;
    } else if (reason.includes('context')) {
      context.compact = { context: '上下文不足', retrievalScore: 0.3 };
    } else if (reason.includes('repeated')) {
      context.failureCount = 4; // 强制重复失败
    }

    return this.planner.decideRecoveryAction(context);
  }
}