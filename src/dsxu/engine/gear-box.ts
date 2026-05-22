/**
 * DSXU step-level GearBox.
 *
 * This file is intentionally ASCII-only in the main runtime section because
 * it is imported by release-gate tests in both Windows and WSL environments.
 */

import type {
  GearState,
  GearVerificationContext,
  GearVerificationSummary,
  StepGearBox,
  ToolResult,
} from './types'
import type { RecoveryAction, RecoveryDecision, RecoveryReason } from './recovery/recovery-types-v3'
import {
  projectVerificationRecoveryDecision,
  type StallRecoveryDecision,
  type VerifySummary,
} from './progress-ledger'
import { DEEPSEEK_V4_FLASH_MODEL, DEEPSEEK_V4_PRO_MODEL } from '../../utils/model/deepseekV4Control'

const GEAR_TIMEOUT = 5 * 60 * 1000
const TEST_HISTORY_SIZE = 5

export function createGearBox(): StepGearBox {
  const state: GearState = {
    gear: 1,
    consecutiveErrors: 0,
    lastErrorTs: 0,
    testHistory: [],
  }

  function checkTimeout(): void {
    if (state.lastErrorTs > 0 && Date.now() - state.lastErrorTs > GEAR_TIMEOUT) {
      state.consecutiveErrors = 0
      state.gear = 1
    }
  }

  function updateGear(): void {
    if (state.consecutiveErrors >= 6 && state.gear < 3) {
      const from = state.gear
      state.gear = 3
      console.log(`[GearBox] ${from}->3: repeated failures need max recovery reasoning`)
      return
    }

    if (state.consecutiveErrors >= 4 && state.gear < 2) {
      state.gear = 2
      console.log('[GearBox] 1->2: repeated failures need Pro reasoning')
    }
  }

  function adjustGearByRecoveryDecision(decision: RecoveryDecision): void {
    const prevGear = state.gear

    switch (decision.action) {
      case 'retry':
        if (state.gear > 1 && decision.confidence > 0.7) {
          state.gear = Math.max(1, state.gear - 1) as 1 | 2 | 3
          console.log(`[GearBox] retry ${prevGear}->${state.gear}: high-confidence retry`)
        }
        break

      case 'replan':
        if (state.gear < 3) {
          state.gear = Math.min(3, state.gear + 1) as 1 | 2 | 3
          console.log(`[GearBox] replan ${prevGear}->${state.gear}: stronger planning required`)
        }
        break

      case 'rollback':
        if (state.gear > 1) {
          state.gear = 1
          console.log(`[GearBox] rollback ${prevGear}->1: conservative execution`)
        }
        break

      case 'ask-human':
        console.log(`[GearBox] ask-human: holding gear ${state.gear}`)
        break

      case 'abort':
        console.log(`[GearBox] abort: holding gear ${state.gear}`)
        break
    }

    switch (decision.reason) {
      case 'verify-failure':
        if (state.gear < 3) {
          state.gear = Math.min(3, state.gear + 1) as 1 | 2 | 3
          console.log(`[GearBox] verify-failure ${prevGear}->${state.gear}: verification needs stronger reasoning`)
        }
        break

      case 'tool-failure':
        if (state.gear > 1 && decision.confidence < 0.5) {
          state.gear = Math.max(1, state.gear - 1) as 1 | 2 | 3
          console.log(`[GearBox] tool-failure ${prevGear}->${state.gear}: tool result is unreliable`)
        }
        break

      case 'context-insufficiency':
      case 'repeated-failure':
        if (state.gear < 3) {
          state.gear = 3
          console.log(`[GearBox] ${decision.reason} ${prevGear}->3: maximum recovery reasoning required`)
        }
        break

      case 'reviewer-rejection':
        if (state.gear < 2) {
          state.gear = 2
          console.log(`[GearBox] reviewer-rejection ${prevGear}->2: review recovery requires Pro reasoning`)
        }
        break
    }
  }

  function detectTest(result: ToolResult, toolName: string): boolean | null {
    if (!['Bash', 'bash', 'PowerShell', 'powershell', 'shell', 'terminal'].includes(toolName)) {
      return null
    }

    const text = result.content
    const isTestOutput =
      /\d+ pass/i.test(text) ||
      /\d+ fail/i.test(text) ||
      /Tests?:\s+\d+/i.test(text) ||
      /PASS|FAIL/.test(text) ||
      /npm test|vitest|jest|pytest|bun test/i.test(text) ||
      /[\u2713\u2717\u25cf]/.test(text)

    if (!isTestOutput) return null

    const failPatterns = [
      /[1-9]\d* fail/i,
      /FAIL\s/,
      /FAILED/i,
      /\u2717/,
      /exit code [1-9]/i,
      /AssertionError/i,
    ]

    return !failPatterns.some(pattern => pattern.test(text))
  }

  function decideVerificationRecovery(
    summary: GearVerificationSummary,
    context: GearVerificationContext = {},
  ): RecoveryDecision | null {
    if (summary.passed) return null

    const attempts = Math.max(1, context.failedAttemptsSinceProgress ?? 1)
    const policy = context.policy ?? 'block'
    const firstFinding = summary.findings?.[0]
    const missingEvidence =
      firstFinding?.title.toLowerCase().includes('evidence') === true ||
      firstFinding?.detail.toLowerCase().includes('no native verification') === true ||
      firstFinding?.detail.toLowerCase().includes('missing') === true

    const verification: VerifySummary = {
      passed: summary.passed,
      score: summary.score,
      findings: summary.findings ?? [],
      timestamp: Date.now(),
    }
    const projection = projectVerificationRecoveryDecision({
      verification,
      onFailure: policy,
      failedAttemptsSinceProgress: attempts,
      command: context.command,
      owner: 'GearBox / VerificationKernel',
      evidence: [
        'source:RECOVERY_DECISION_TABLE',
        missingEvidence ? 'missingEvidence:true' : 'missingEvidence:false',
        firstFinding?.title ? `findingTitle:${firstFinding.title}` : '',
      ].filter(Boolean),
    })

    if (!projection.recoveryDecision) {
      return null
    }

    return stallDecisionToGearRecoveryDecision(projection.recoveryDecision, {
      policy,
      score: summary.score,
      command: context.command,
      attempts,
      missingEvidence,
      findingTitle: firstFinding?.title,
      projectionSchema: projection.schemaVersion,
    })
  }

  return {
    getGear() {
      checkTimeout()
      return state.gear
    },

    getModel() {
      checkTimeout()
      switch (state.gear) {
        case 1:
          return DEEPSEEK_V4_FLASH_MODEL
        case 2:
        case 3:
          return DEEPSEEK_V4_PRO_MODEL
      }
    },

    reportToolResult(result: ToolResult, toolName: string) {
      const testPassed = detectTest(result, toolName)
      if (testPassed !== null) {
        this.reportTestResult(testPassed)
        return
      }

      if (result.isError) {
        checkTimeout()
        state.consecutiveErrors++
        state.lastErrorTs = Date.now()
        updateGear()
        console.log(`[GearBox] tool ${toolName} failed; consecutive=${state.consecutiveErrors}; gear=${state.gear}`)
      }
    },

    reportTestResult(passed: boolean) {
      state.testHistory.push({ passed, ts: Date.now() })
      if (state.testHistory.length > TEST_HISTORY_SIZE) {
        state.testHistory.shift()
      }

      if (passed) {
        console.log('[GearBox] test passed; reset to gear 1')
        state.consecutiveErrors = 0
        state.gear = 1
        return
      }

      checkTimeout()
      state.consecutiveErrors++
      state.lastErrorTs = Date.now()
      updateGear()
      console.log(`[GearBox] test failed; consecutive=${state.consecutiveErrors}; gear=${state.gear}`)
    },

    reportVerificationSummary(
      summary: GearVerificationSummary,
      context: GearVerificationContext = {},
    ): RecoveryDecision | null {
      this.reportTestResult(summary.passed)
      if (summary.passed) {
        state.lastRecoveryDecision = undefined
        return null
      }

      const decision = decideVerificationRecovery(summary, context)
      if (decision) {
        this.applyRecoveryDecision(decision)
      }
      return decision
    },

    reportLLMError(error: Error, callId?: string) {
      checkTimeout()
      state.consecutiveErrors++
      state.lastErrorTs = Date.now()
      updateGear()
      const callIdSuffix = callId ? ` (callId: ${callId})` : ''
      console.log(`[GearBox] LLM error: ${error.message}; consecutive=${state.consecutiveErrors}; gear=${state.gear}${callIdSuffix}`)
    },

    reportSuccess() {
      if (state.gear > 1) {
        console.log(`[GearBox] success; ${state.gear}->1`)
      }
      state.consecutiveErrors = 0
      state.gear = 1
    },

    applyRecoveryDecision(decision: RecoveryDecision): void {
      console.log(`[GearBox] recovery decision: ${decision.action} (${decision.reason}); confidence=${decision.confidence}`)
      state.lastRecoveryDecision = decision
      adjustGearByRecoveryDecision(decision)
    },

    getState() {
      return { ...state, testHistory: [...state.testHistory] }
    },
  }
}

function stallDecisionToGearRecoveryDecision(
  decision: StallRecoveryDecision,
  metadata: {
    policy: NonNullable<GearVerificationContext['policy']>
    score: number
    command?: string
    attempts: number
    missingEvidence: boolean
    findingTitle?: string
    projectionSchema: string
  },
): RecoveryDecision {
  return {
    action: mapStallActionToGearAction(decision.action),
    reason: mapStallReasonToGearReason(decision.reason),
    confidence: decision.confidence,
    retryCount: metadata.attempts,
    maxRetries: 3,
    message: decision.nextAction,
    metadata: {
      ...metadata,
      sourceRecoveryDecisionTable: true,
      stallDecision: decision,
    },
  }
}

function mapStallActionToGearAction(action: StallRecoveryDecision['action']): RecoveryAction {
  if (action === 'flash-max' || action === 'pro-admission') {
    return 'replan'
  }
  return action
}

function mapStallReasonToGearReason(reason: StallRecoveryDecision['reason']): RecoveryReason {
  switch (reason) {
    case 'repeated_verification_failure':
      return 'verify-failure'
    case 'tool_failure':
    case 'timeout':
      return 'tool-failure'
    case 'context_pressure':
      return 'context-insufficiency'
    case 'model_failure':
    case 'repeated_read':
    case 'no_diff':
    case 'validation_failure':
    case 'workspace_boundary':
    case 'cost_pressure':
    case 'agent_timeout':
    case 'permission_loop':
    case 'tool_result_growth':
      return 'repeated-failure'
  }
}
// ===== Coordinator Signal Driven Gear Strategy =====

export type CoordinatorGearSignal =
  | { type: 'fork'; payload: { runnableBranches: string[] } }
  | { type: 'merge'; payload: { outcome: 'winner' | 'merged' | 'kept' | 'discarded' | 'conflict' } }
  | { type: 'abort'; payload: { scope: { scope: 'local' | 'global' } } }
  | { type: 'escalate'; payload: { priority: 'low' | 'medium' | 'high' | 'critical' } };

export interface GearStrategyState {
  lane: 'balanced' | 'parallel-first' | 'safe-recovery' | 'escalation-guard';
  maxParallel: number;
  writerMode: 'normal' | 'single-writer';
  reason: string;
}

export function createGearStrategyState(): GearStrategyState {
  return {
    lane: 'balanced',
    maxParallel: 2,
    writerMode: 'normal',
    reason: 'default strategy',
  };
}

export function applyCoordinatorSignalToGearStrategy(
  current: GearStrategyState,
  signal: CoordinatorGearSignal,
): GearStrategyState {
  if (signal.type === 'fork') {
    return {
      lane: 'parallel-first',
      maxParallel: Math.max(2, signal.payload.runnableBranches.length),
      writerMode: 'single-writer',
      reason: 'fork runnable branches increased parallel planning',
    };
  }

  if (signal.type === 'merge') {
    if (signal.payload.outcome === 'conflict' || signal.payload.outcome === 'discarded') {
      return {
        lane: 'safe-recovery',
        maxParallel: 1,
        writerMode: 'single-writer',
        reason: `merge outcome ${signal.payload.outcome} requires conservative execution`,
      };
    }
    return {
      lane: 'balanced',
      maxParallel: 2,
      writerMode: 'normal',
      reason: `merge outcome ${signal.payload.outcome} allows normal execution`,
    };
  }

  if (signal.type === 'abort') {
    return {
      lane: 'safe-recovery',
      maxParallel: signal.payload.scope.scope === 'global' ? 1 : current.maxParallel,
      writerMode: 'single-writer',
      reason: `abort(${signal.payload.scope.scope}) triggered recovery mode`,
    };
  }

  return {
    lane: 'escalation-guard',
    maxParallel: signal.payload.priority === 'critical' ? 1 : 2,
    writerMode: 'single-writer',
    reason: `escalation(${signal.payload.priority}) tightened scheduling policy`,
  };
}

// ===== Phase A Coordinator Mode Gear Bridge =====
export function applyCoordinatorModeToGearStrategy(
  current: GearStrategyState,
  input: {
    isCoordinatorMode: boolean;
    sessionMode: 'coordinator' | 'normal';
    signal?: CoordinatorGearSignal;
  },
): GearStrategyState {
  const withSignal = input.signal ? applyCoordinatorSignalToGearStrategy(current, input.signal) : current;
  if (!input.isCoordinatorMode || input.sessionMode !== 'coordinator') {
    return { ...withSignal, lane: 'balanced', reason: 'normal mode strategy' };
  }
  return {
    ...withSignal,
    lane: withSignal.lane === 'balanced' ? 'parallel-first' : withSignal.lane,
    maxParallel: Math.max(withSignal.maxParallel, 3),
    reason: `coordinator mode active: ${withSignal.reason}`,
  };
}

// ===== Phase C Context Aware Gear Adjustment =====
export function applyContextSignalToGearStrategy(
  current: GearStrategyState,
  input: { contextUsedPercent: number; shouldCompact: boolean },
): GearStrategyState {
  if (input.shouldCompact || input.contextUsedPercent >= 85) {
    return {
      lane: 'safe-recovery',
      maxParallel: 1,
      writerMode: 'single-writer',
      reason: 'high context pressure forced conservative scheduling',
    };
  }
  if (input.contextUsedPercent >= 70) {
    return {
      ...current,
      maxParallel: Math.max(1, current.maxParallel - 1),
      reason: 'context pressure reduced parallelism',
    };
  }
  return current;
}

// ===== Phase D Gear Evidence Hook =====
export function recordGearMainlineConsumption(input: {
  signalType: string;
  detail: string;
}): { module: 'gear-box'; signalType: string; detail: string } {
  return { module: 'gear-box', signalType: input.signalType, detail: input.detail };
}
