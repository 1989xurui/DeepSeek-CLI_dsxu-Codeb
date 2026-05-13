export type DSXUFailureCategory =
  | 'validation'
  | 'permission'
  | 'executor'
  | 'timeout'
  | 'workspace'
  | 'model'
  | 'unknown'

export type DSXURecoveryAction = 'retry' | 'replan' | 'rollback' | 'abort' | 'request_approval'

export interface DSXUFailure {
  failureCode: string
  category: DSXUFailureCategory
  message: string
  retryable: boolean
  recommendedAction: DSXURecoveryAction
  raw?: unknown
}

export function normalizeFailure(error: unknown, context?: { operation?: string; blockedByPolicy?: boolean }): DSXUFailure {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown failure')
  const lower = message.toLowerCase()

  if (context?.blockedByPolicy || lower.includes('permission') || lower.includes('denied')) {
    return {
      failureCode: 'DSXU_PERMISSION_DENIED',
      category: 'permission',
      message,
      retryable: false,
      recommendedAction: 'request_approval',
      raw: error,
    }
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      failureCode: 'DSXU_TIMEOUT',
      category: 'timeout',
      message,
      retryable: true,
      recommendedAction: 'retry',
      raw: error,
    }
  }

  if (lower.includes('validation') || lower.includes('schema')) {
    return {
      failureCode: 'DSXU_VALIDATION_FAILED',
      category: 'validation',
      message,
      retryable: false,
      recommendedAction: 'replan',
      raw: error,
    }
  }

  if (lower.includes('workspace') || lower.includes('root')) {
    return {
      failureCode: 'DSXU_WORKSPACE_BOUNDARY',
      category: 'workspace',
      message,
      retryable: false,
      recommendedAction: 'abort',
      raw: error,
    }
  }

  return {
    failureCode: `DSXU_EXECUTOR_${(context?.operation || 'UNKNOWN').toUpperCase()}`,
    category: 'executor',
    message,
    retryable: true,
    recommendedAction: 'replan',
    raw: error,
  }
}
