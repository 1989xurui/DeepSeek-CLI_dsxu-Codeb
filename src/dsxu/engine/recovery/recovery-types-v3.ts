export type RecoveryReason =
  | 'verify-failure'
  | 'reviewer-rejection'
  | 'tool-failure'
  | 'context-insufficiency'
  | 'repeated-failure';

export type RecoveryAction =
  | 'retry'
  | 'replan'
  | 'rollback'
  | 'abort'
  | 'ask-human';

export interface RecoveryDecision {
  action: RecoveryAction;
  reason: RecoveryReason;
  confidence: number; // 0-1
  retryCount?: number;
  maxRetries?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface RecoveryContext {
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
}