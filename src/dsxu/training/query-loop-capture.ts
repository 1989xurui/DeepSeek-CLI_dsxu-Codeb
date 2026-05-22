import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { LongTaskLedgerEvent, ProgressLedger } from '../engine/progress-ledger'
import type { QueryEvent, QueryResult } from '../engine/types'
import { scoreTrainingTrajectory, type DsxuTrainingScoreResult } from './scorer'
import { exportTrainingTrajectory, type TrainingTrajectoryToolInput } from './exporter'
import type { DsxuTrainingTrajectory } from './schema'
import { validateTrainingTrajectory, type DsxuTrainingTrajectoryValidation } from './validator'

export const QUERY_LOOP_CAPTURE_SCHEMA_VERSION = 'dsxu.training-query-loop-capture.v1' as const
export const QUERY_LOOP_CAPTURE_ENV = 'DSXU_TRAINING_QUERY_LOOP_CAPTURE_FILE' as const

export interface QueryLoopTrainingCaptureArtifact {
  schemaVersion: typeof QUERY_LOOP_CAPTURE_SCHEMA_VERSION
  generatedAt: string
  datasetKind: 'query_loop_opt_in_capture'
  publicClaimAllowed: false
  capture: {
    mode: 'env_opt_in'
    envVar: typeof QUERY_LOOP_CAPTURE_ENV
    sessionId?: string
    requestId?: string
    task: string
    eventCount: number
    eventTypes: readonly string[]
    resultExitReason: string
  }
  validation: DsxuTrainingTrajectoryValidation
  score: DsxuTrainingScoreResult
  trajectory: DsxuTrainingTrajectory
  rule: string
}

export function getQueryLoopTrainingCapturePath(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const path = env[QUERY_LOOP_CAPTURE_ENV]?.trim()
  return path ? path : undefined
}

export async function writeQueryLoopTrainingCaptureIfEnabled(input: {
  env?: NodeJS.ProcessEnv
  events: readonly QueryEvent[]
  result: QueryResult
  task?: string
  sessionId?: string
  requestId?: string
}): Promise<QueryLoopTrainingCaptureArtifact | undefined> {
  const outputPath = getQueryLoopTrainingCapturePath(input.env)
  if (!outputPath) return undefined
  const artifact = buildQueryLoopTrainingCaptureArtifact(input)
  try {
    const resolvedPath = resolve(outputPath)
    await mkdir(dirname(resolvedPath), { recursive: true })
    await writeFile(resolvedPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  } catch (error) {
    console.warn(`[TrainingCapture] failed to write ${QUERY_LOOP_CAPTURE_ENV}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return artifact
}

export function buildQueryLoopTrainingCaptureArtifact(input: {
  events: readonly QueryEvent[]
  result: QueryResult
  task?: string
  sessionId?: string
  requestId?: string
}): QueryLoopTrainingCaptureArtifact {
  const task = input.task ?? inferTaskFromResult(input.result) ?? 'DSXU query-loop task'
  const trajectory = exportTrainingTrajectoryFromCapturedQueryLoopEvents({
    events: input.events,
    result: input.result,
    task,
    sessionId: input.sessionId,
    requestId: input.requestId,
  }).trajectory
  const validation = validateTrainingTrajectory(trajectory)
  const score = scoreTrainingTrajectory(trajectory)
  return {
    schemaVersion: QUERY_LOOP_CAPTURE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    datasetKind: 'query_loop_opt_in_capture',
    publicClaimAllowed: false,
    capture: {
      mode: 'env_opt_in',
      envVar: QUERY_LOOP_CAPTURE_ENV,
      sessionId: input.sessionId,
      requestId: input.requestId,
      task,
      eventCount: input.events.length,
      eventTypes: [...new Set(input.events.map(event => event.type))],
      resultExitReason: input.result.exitReason,
    },
    validation,
    score,
    trajectory,
    rule: 'Query-loop training capture is opt-in, redacted, and non-blocking. It must not be treated as a public benchmark or live provider quality claim.',
  }
}

export function exportTrainingTrajectoryFromCapturedQueryLoopEvents(input: {
  events: readonly QueryEvent[]
  result: QueryResult
  task: string
  sessionId?: string
  requestId?: string
}) {
  const ledgerEvents = extractLedgerEvents(input.events, input.result)
  const toolInputs = extractToolInputs(input.events)
  const filesRead = extractFilesRead(input.events)
  const verificationCommands = extractVerificationCommands(input.events)
  const verificationPassed = input.events.some(event => event.type === 'test_detected' && event.passed) ||
    toolInputs.some(tool => tool.toolName === 'Bash' && tool.ok === true && /pass|passed|success/i.test(tool.outputText ?? tool.result?.outputText ?? ''))
  const model = String(input.events.find(event => event.type === 'model_called')?.model ?? 'unknown')
  const taskId = [input.sessionId, input.requestId].filter(Boolean).join(':') || 'query-loop-opt-in-capture'

  return exportTrainingTrajectory({
    task: {
      taskId,
      category: 'query-loop-opt-in-capture',
      intent: input.task,
      riskLevel: toolInputs.some(tool => !tool.readonly) ? 'medium' : 'low',
      acceptanceCriteria: [
        'query-loop runtime events captured',
        'tool result pairing preserved',
        'source bodies are not stored',
      ],
      claimScope: 'internal',
    },
    intentUnderstanding: {
      interpretedGoal: input.task,
      constraints: ['env opt-in only', 'no raw source body storage', 'non-blocking capture', 'no public benchmark claim'],
      explicitNoEdit: false,
      missingInfo: [],
      riskClassification: toolInputs.some(tool => !tool.readonly) ? 'medium' : 'low',
    },
    ledgerEvents,
    toolResults: toolInputs,
    filesRead,
    rangesRead: filesRead.map(file => `${file}:summary-only`),
    sourceEvidenceText: [
      `query-loop event types: ${[...new Set(input.events.map(event => event.type))].join(',')}`,
      `exitReason:${input.result.exitReason}`,
    ],
    verification: {
      commands: verificationCommands,
      passed: verificationPassed,
      claimBound: verificationPassed,
      localizedFeedbackPresent: false,
      artifactPaths: [getQueryLoopTrainingCapturePath() ?? QUERY_LOOP_CAPTURE_ENV],
    },
    contextMemory: {
      goalPreserved: input.result.exitReason === 'end_turn',
      resumePoint: input.result.exitReason === 'end_turn' ? 'query-loop-finished' : `query-loop-${input.result.exitReason}`,
      openObligations: input.result.exitReason === 'end_turn' ? [] : [`exitReason:${input.result.exitReason}`],
      compactOccurred: input.events.some(event => event.type === 'context_snapshot_reset'),
      sourceRereadAfterResume: false,
    },
    costRoute: extractCostRoute(ledgerEvents, model),
    antiCheat: {
      publicClaimAllowed: false,
      oracleLeakFlag: false,
      solutionArtifactFlag: false,
      oldReportFlag: false,
      testOnlyFixFlag: false,
    },
    communication: {
      userVisibleSummary: input.result.finalMessage,
      verifiedFacts: verificationPassed
        ? ['query-loop runtime events captured', 'verification command passed']
        : ['query-loop runtime events captured'],
      unverifiedRisks: verificationPassed ? [] : ['verification command did not pass or was not observed'],
      overclaimDetected: false,
    },
    outcome: {
      status: verificationPassed && input.result.exitReason === 'end_turn' ? 'success' : 'partial',
      finalClaim: verificationPassed
        ? 'query-loop opt-in capture produced a verified training trajectory'
        : 'query-loop opt-in capture produced a partial training trajectory',
      verified: verificationPassed,
      publicClaimAllowed: false,
    },
  })
}

function inferTaskFromResult(result: QueryResult): string | undefined {
  const user = result.messages.findLast(message => message.role === 'user')
  if (!user) return undefined
  return typeof user.content === 'string' ? user.content : JSON.stringify(user.content)
}

function extractLedgerEvents(events: readonly QueryEvent[], result: QueryResult): readonly Partial<LongTaskLedgerEvent>[] {
  const ledgers = [
    ...events.map(event => progressLedgerFromMetadata((event as { metadata?: Record<string, unknown> }).metadata)),
    progressLedgerFromMetadata(result.metadata),
  ].filter((ledger): ledger is ProgressLedger => Boolean(ledger))
  const latest = ledgers[ledgers.length - 1]
  return latest?.events ?? []
}

function progressLedgerFromMetadata(metadata?: Record<string, unknown>): ProgressLedger | undefined {
  const ledger = metadata?.progressLedger
  if (!ledger || typeof ledger !== 'object') return undefined
  return ledger as ProgressLedger
}

function extractToolInputs(events: readonly QueryEvent[]): readonly TrainingTrajectoryToolInput[] {
  return events
    .filter((event): event is Extract<QueryEvent, { type: 'tool_result' }> => event.type === 'tool_result')
    .map(event => ({
      toolUseId: event.toolUseId,
      toolName: event.toolName,
      readonly: /^(Read|Grep|Glob|LSP)$/i.test(event.toolName),
      permissionDecision: 'allow' as const,
      ok: !event.result.isError,
      outputText: event.result.content,
      result: {
        schemaVersion: 'dsxu.tool-call-result.v1',
        ok: !event.result.isError,
        outputText: event.result.content,
        events: [],
        error: event.result.isError
          ? {
              type: 'EXECUTION_FAILED',
              message: event.result.content,
              retryable: true,
            }
          : undefined,
        metadata: {
          duration: Number(event.result.meta?.durationMs ?? 0),
          executorKind: event.result.meta?.executorKind === 'bridge' ? 'bridge' : 'dsxu_native',
          usedBridge: Boolean(event.result.meta?.usedBridge),
        },
      },
    }))
}

function extractFilesRead(events: readonly QueryEvent[]): readonly string[] {
  return [
    ...new Set(
      events
        .filter((event): event is Extract<QueryEvent, { type: 'tool_start' }> => event.type === 'tool_start' && event.toolName === 'Read')
        .map(event => String(event.input.file_path ?? event.input.path ?? 'unknown'))
        .filter(file => file !== 'unknown'),
    ),
  ]
}

function extractVerificationCommands(events: readonly QueryEvent[]): readonly string[] {
  return [
    ...new Set(
      events
        .filter((event): event is Extract<QueryEvent, { type: 'tool_start' }> => event.type === 'tool_start' && event.toolName === 'Bash')
        .map(event => String(event.input.command ?? ''))
        .filter(Boolean),
    ),
  ]
}

function extractCostRoute(events: readonly Partial<LongTaskLedgerEvent>[], model: string) {
  const usage = events
    .filter(event => event.kind === 'cost-cache')
    .map(event => event.metadata ?? {})
  const cacheHitInputTokens = usage.reduce((total, item) => total + Number(item.cacheReadTokens ?? 0), 0)
  const cacheMissInputTokens = usage.reduce((total, item) => total + Number(item.inputTokens ?? 0), 0) - cacheHitInputTokens
  return {
    model,
    routeReason: 'query-loop-opt-in-capture',
    estimatedCostUsd: 0,
    cacheHitInputTokens: Math.max(0, cacheHitInputTokens),
    cacheMissInputTokens: Math.max(0, cacheMissInputTokens),
    proAdmissionJustified: false,
  }
}
