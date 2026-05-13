/**
 * Bug Brain 集成钩子
 * 吸收上游模块间失败信息传递机制
 */

import { BugBrain, defaultBugBrain } from './index'
import { BugCategory, BugSeverity, BugSource, BugContext } from './types'

/**
 * Verify Gate 集成
 */
export function createVerifyGateHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordVerifyFailure(
      description: string,
      context: {
        code?: string
        filePath?: string
        rule?: string
        error?: Error
        sessionId?: string
        taskId?: string
        compactLevel?: string
      }
    ) {
      const bugContext: BugContext = {
        codeSnippet: context.code,
        filePath: context.filePath,
        errorStack: context.error?.stack,
        errorType: context.error?.name,
        errorMessage: context.error?.message,
        environment: {
          rule: context.rule,
        },
        sessionContext: context.sessionId || context.taskId ? {
          sessionId: context.sessionId,
          taskId: context.taskId,
        } : undefined,
        compactContext: context.compactLevel ? {
          compactLevel: context.compactLevel as any,
        } : undefined,
        timestamp: Date.now(),
      }

      return bugBrain.recordBug(
        'verify-failure',
        'medium',
        'verify-gate',
        description,
        bugContext
      )
    },
  }
}

/**
 * Verify Review Chain 集成
 */
export function createVerifyReviewChainHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordReviewFailure(
      description: string,
      context: {
        reviewStage?: string
        reviewerType?: string
        feedback?: string
        error?: Error
      }
    ) {
      const bugContext: BugContext = {
        errorStack: context.error?.stack,
        environment: {
          reviewStage: context.reviewStage,
          reviewerType: context.reviewerType,
        },
        userInput: context.feedback,
      }

      return bugBrain.recordBug(
        'reviewer-rejection',
        'medium',
        'verify-review-chain',
        description,
        bugContext
      )
    },
  }
}

/**
 * Reviewer Subagent 集成
 */
export function createReviewerSubagentHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordReviewerRejection(
      description: string,
      context: {
        subagentType?: string
        criteria?: string[]
        score?: number
        threshold?: number
        error?: Error
      }
    ) {
      const bugContext: BugContext = {
        errorStack: context.error?.stack,
        environment: {
          subagentType: context.subagentType,
          criteria: context.criteria,
          score: context.score,
          threshold: context.threshold,
        },
      }

      return bugBrain.recordBug(
        'reviewer-rejection',
        'low',
        'reviewer-subagent',
        description,
        bugContext
      )
    },
  }
}

/**
 * Memory 集成
 */
export function createMemoryHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordMemoryFailure(
      description: string,
      context: {
        memoryType?: string
        operation?: string
        key?: string
        error?: Error
      }
    ) {
      const bugContext: BugContext = {
        errorStack: context.error?.stack,
        environment: {
          memoryType: context.memoryType,
          operation: context.operation,
          key: context.key,
        },
      }

      return bugBrain.recordBug(
        'memory-insufficiency',
        'low',
        'memory',
        description,
        bugContext
      )
    },
  }
}

/**
 * Episode Memory 集成
 */
export function createEpisodeMemoryHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordEpisodeFailure(
      description: string,
      context: {
        episodeId?: string
        stage?: string
        error?: Error
      }
    ) {
      const bugContext: BugContext = {
        errorStack: context.error?.stack,
        environment: {
          episodeId: context.episodeId,
          stage: context.stage,
        },
      }

      return bugBrain.recordBug(
        'memory-insufficiency',
        'medium',
        'episode-memory',
        description,
        bugContext
      )
    },
  }
}

/**
 * Graph Retrieval 集成
 */
export function createGraphRetrievalHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordRetrievalMiss(
      description: string,
      context: {
        query?: string
        expectedResults?: number
        actualResults?: number
        relevanceThreshold?: number
      }
    ) {
      const bugContext: BugContext = {
        retrievalContext: {
          query: context.query,
          retrievedNodes: context.actualResults,
        },
        environment: {
          expectedResults: context.expectedResults,
          relevanceThreshold: context.relevanceThreshold,
        },
      }

      return bugBrain.recordBug(
        'graph-retrieval-miss',
        'low',
        'graph-retrieval',
        description,
        bugContext
      )
    },
  }
}

/**
 * Tool Execution 集成
 */
export function createToolExecutionHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordToolFailure(
      description: string,
      context: {
        toolName?: string
        parameters?: any
        error?: Error
        timeout?: boolean
      }
    ) {
      const bugContext: BugContext = {
        errorStack: context.error?.stack,
        environment: {
          toolName: context.toolName,
          parameters: context.parameters,
          timeout: context.timeout,
        },
      }

      const severity: BugSeverity = context.timeout ? 'high' : 'medium'

      return bugBrain.recordBug(
        'tool-failure',
        severity,
        'tool-execution',
        description,
        bugContext
      )
    },
  }
}

/**
 * Context Routing 集成
 */
export function createContextRoutingHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordContextInsufficiency(
      description: string,
      context: {
        requiredContext?: string[]
        availableContext?: string[]
        routingDecision?: string
      }
    ) {
      const bugContext: BugContext = {
        environment: {
          requiredContext: context.requiredContext,
          availableContext: context.availableContext,
          routingDecision: context.routingDecision,
        },
      }

      return bugBrain.recordBug(
        'context-insufficiency',
        'medium',
        'context-routing',
        description,
        bugContext
      )
    },
  }
}

/**
 * Compact 集成
 */
export function createCompactHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordCompactFailure(
      description: string,
      context: {
        originalSize?: number
        compactedSize?: number
        removedElements?: string[]
        hygieneScore?: number
        error?: Error
      }
    ) {
      const bugContext: BugContext = {
        errorStack: context.error?.stack,
        compactContext: {
          originalContextSize: context.originalSize,
          compactedContextSize: context.compactedSize,
          removedElements: context.removedElements,
          hygieneScore: context.hygieneScore,
        },
        timestamp: Date.now(),
      }

      return bugBrain.recordBug(
        'context-insufficiency', // compact 失败通常导致上下文不足
        'medium',
        'context-routing', // 暂时使用 context-routing 作为来源
        description,
        bugContext
      )
    },
  }
}

/**
 * Rollback / Default Chain 集成
 */
export function createRollbackHook(bugBrain: BugBrain = defaultBugBrain) {
  return {
    recordRollbackFailure(
      description: string,
      context: {
        rollbackStage?: string
        originalState?: any
        targetState?: any
        error?: Error
        recoveryAttempted?: boolean
      }
    ) {
      const bugContext: BugContext = {
        errorStack: context.error?.stack,
        environment: {
          rollbackStage: context.rollbackStage,
          recoveryAttempted: context.recoveryAttempted,
        },
        state: {
          original: context.originalState,
          target: context.targetState,
        },
        timestamp: Date.now(),
      }

      return bugBrain.recordBug(
        'recovery-failure',
        'high', // rollback 失败通常是高严重性
        'session-state', // 暂时使用 session-state 作为来源
        description,
        bugContext
      )
    },
  }
}

/**
 * 导出所有集成钩子
 */
export const bugBrainHooks = {
  verifyGate: createVerifyGateHook(),
  verifyReviewChain: createVerifyReviewChainHook(),
  reviewerSubagent: createReviewerSubagentHook(),
  memory: createMemoryHook(),
  episodeMemory: createEpisodeMemoryHook(),
  graphRetrieval: createGraphRetrievalHook(),
  toolExecution: createToolExecutionHook(),
  contextRouting: createContextRoutingHook(),
  compact: createCompactHook(),
  rollback: createRollbackHook(),
}

/**
 * 快速记录工具
 */
export function quickRecordBug(
  type: BugCategory,
  severity: BugSeverity,
  source: BugSource,
  description: string,
  context: Partial<BugContext> = {}
) {
  const fullContext: BugContext = {
    ...context,
    timestamp: Date.now(),
  }

  return defaultBugBrain.recordBug(type, severity, source, description, fullContext)
}
