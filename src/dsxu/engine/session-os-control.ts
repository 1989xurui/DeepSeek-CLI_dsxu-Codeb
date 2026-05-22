import type {
  PersistentSessionState,
  ResumeHint,
  SessionCheckpoint,
  SessionContinuationDecision,
  SessionResumeHint,
  SessionSnapshot,
} from './session'

export interface DSXUSessionOSOptions {
  enableCheckpoints?: boolean
  maxCheckpoints?: number
  autoSnapshotInterval?: number
}

export class DSXUSessionStateMachine {
  private sessionState: PersistentSessionState | null = null
  private options: Required<DSXUSessionOSOptions>

  constructor(private sessionId: string, options: DSXUSessionOSOptions = {}) {
    this.options = {
      enableCheckpoints: options.enableCheckpoints ?? true,
      maxCheckpoints: options.maxCheckpoints ?? 10,
      autoSnapshotInterval: options.autoSnapshotInterval ?? 30000,
    }
  }

  createCheckpoint(snapshot: SessionSnapshot): SessionCheckpoint {
    const checkpointId = `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const resumeHint = generateStructuredResumeHint(snapshot, snapshot.resumeHints)
    const continuationDecision = decideSessionContinuation(this.sessionId, snapshot)
    return {
      checkpointId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      snapshot,
      resumeState: {
        canContinue: shouldContinueDSXUSession(snapshot),
        resumeHint,
        continuationDecision,
      },
      metadata: {
        generatedBy: 'dsxu-session-os',
        snapshotVersion: '1.0',
        source: 'dsxu-control-plane',
      },
    }
  }

  updatePersistentState(checkpoint: SessionCheckpoint): PersistentSessionState {
    if (!this.sessionState) {
      this.sessionState = {
        sessionId: this.sessionId,
        lastActivityTime: Date.now(),
        sessionState: checkpoint.snapshot.status,
        checkpoints: [checkpoint],
        currentCheckpointId: checkpoint.checkpointId,
        resumeHistory: [],
      }
      return this.sessionState
    }

    this.sessionState.checkpoints.push(checkpoint)
    if (this.sessionState.checkpoints.length > this.options.maxCheckpoints) {
      this.sessionState.checkpoints = this.sessionState.checkpoints.slice(-this.options.maxCheckpoints)
    }
    this.sessionState.currentCheckpointId = checkpoint.checkpointId
    this.sessionState.lastActivityTime = Date.now()
    this.sessionState.sessionState = checkpoint.snapshot.status
    return this.sessionState
  }

  getResumeDecision(): SessionContinuationDecision | null {
    const latest = this.latestCheckpoint()
    return latest?.resumeState.continuationDecision ?? null
  }

  getResumeHint(): ResumeHint | null {
    const latest = this.latestCheckpoint()
    return latest?.resumeState.resumeHint ?? null
  }

  recordResume(decision: SessionContinuationDecision): void {
    if (!this.sessionState) return
    this.sessionState.resumeHistory.push({
      timestamp: Date.now(),
      decision,
      success: true,
    })
  }

  handleLongTaskContinuation(input: {
    taskId: string
    lastStep: number
    pendingSteps: Array<{
      stepId: string
      description: string
      status: 'pending' | 'in_progress' | 'completed'
    }>
    resumeContext: Record<string, unknown>
  }): void {
    if (!this.sessionState) {
      this.sessionState = {
        sessionId: this.sessionId,
        lastActivityTime: Date.now(),
        sessionState: 'active',
        checkpoints: [],
        resumeHistory: [],
      }
    }
    this.sessionState.longTaskContinuation = input
    this.sessionState.lastActivityTime = Date.now()
  }

  private latestCheckpoint(): SessionCheckpoint | undefined {
    if (!this.sessionState || this.sessionState.checkpoints.length === 0) return undefined
    return this.sessionState.checkpoints[this.sessionState.checkpoints.length - 1]
  }
}

export function createDSXUSessionStateMachine(sessionId: string, options?: DSXUSessionOSOptions): DSXUSessionStateMachine {
  return new DSXUSessionStateMachine(sessionId, options)
}

export function shouldContinueDSXUSession(snapshot: SessionSnapshot): boolean {
  return snapshot.status === 'active' || snapshot.status === 'paused'
}

export function shouldResumeDSXUSessionId(snapshot: SessionSnapshot): boolean {
  return snapshot.status === 'paused' && snapshot.messageStats.total > 0
}

export function generateStructuredResumeHint(snapshot: SessionSnapshot, existingHints: SessionResumeHint[] = []): ResumeHint {
  const hint = existingHints[0] ?? snapshot.resumeHints[0]
  if (snapshot.status === 'active') {
    return {
      type: 'continue',
      content: hint?.content || 'DSXU session is active and can continue',
      priority: hint?.priority || 'high',
      suggestedAction: 'continueSession',
    }
  }
  if (snapshot.status === 'paused') {
    return {
      type: 'resume',
      content: hint?.content || 'DSXU session is paused and can resume from checkpoint',
      priority: hint?.priority || 'medium',
      suggestedAction: 'resumeSessionId',
    }
  }
  return {
    type: 'review',
    content: hint?.content || 'DSXU session is closed; review and start a new task if needed',
    priority: hint?.priority || 'low',
    suggestedAction: 'createNewSession',
  }
}

function decideSessionContinuation(sessionId: string, snapshot: SessionSnapshot): SessionContinuationDecision {
  if (snapshot.status === 'active') {
    return {
      decisionType: 'continue',
      sessionId,
      resumeInput: {
        inputType: 'continueSession',
        sessionId,
        params: { fromCheckpoint: false, restoreFileState: true, restoreMemories: true },
      },
      confidence: 0.9,
      reason: 'DSXU session is active and should continue in the same control-plane trace',
    }
  }
  if (snapshot.status === 'paused') {
    return {
      decisionType: 'resume',
      sessionId,
      resumeInput: {
        inputType: 'resumeSessionId',
        sessionId,
        params: { fromCheckpoint: true, restoreFileState: true, restoreMemories: true },
      },
      confidence: 0.8,
      reason: 'DSXU session is paused and should resume from checkpoint',
    }
  }
  return {
    decisionType: 'restart',
    sessionId,
    resumeInput: {
      inputType: 'continueSession',
      sessionId,
      params: { fromCheckpoint: false, restoreFileState: false, restoreMemories: true },
    },
    confidence: 0.7,
    reason: 'DSXU session is closed and should start a new task with memory refill',
  }
}
