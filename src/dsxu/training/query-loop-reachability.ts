import { queryLoop } from '../engine/query-loop'
import type { LongTaskLedgerEvent, ProgressLedger } from '../engine/progress-ledger'
import type { QueryEngineConfig, QueryEvent, QueryResult, ToolResult } from '../engine/types'
import { scoreTrainingTrajectory, type DsxuTrainingScoreResult } from './scorer'
import { exportTrainingTrajectory, type TrainingTrajectoryToolInput } from './exporter'
import type { DsxuTrainingTrajectory } from './schema'
import { validateTrainingTrajectory, type DsxuTrainingTrajectoryValidation } from './validator'

export const QUERY_LOOP_REACHABILITY_SCHEMA_VERSION = 'dsxu.training-query-loop-reachability.v1' as const

export interface QueryLoopReachabilityArtifact {
  schemaVersion: typeof QUERY_LOOP_REACHABILITY_SCHEMA_VERSION
  generatedAt: string
  datasetKind: 'query_loop_reachability_probe'
  publicClaimAllowed: false
  probe: {
    sessionId: string
    requestId: string
    task: string
    eventCount: number
    eventTypes: readonly string[]
    requiredEventTypesPresent: boolean
    resultExitReason?: string
  }
  validation: DsxuTrainingTrajectoryValidation
  score: DsxuTrainingScoreResult
  trajectory: DsxuTrainingTrajectory
  rule: string
}

export interface QueryLoopReachabilityRunResult {
  artifact: QueryLoopReachabilityArtifact
  events: readonly QueryEvent[]
  result: QueryResult
}

const REQUIRED_EVENT_TYPES = [
  'loop_started',
  'model_called',
  'tool_start',
  'tool_result',
  'loop_finished',
] as const

export async function runQueryLoopReachabilityProbe(input: {
  sessionId?: string
  requestId?: string
  task?: string
  cwd?: string
} = {}): Promise<QueryLoopReachabilityRunResult> {
  const sessionId = input.sessionId ?? 'training-query-loop-reachability-session'
  const requestId = input.requestId ?? 'training-query-loop-reachability-request'
  const task = input.task ?? 'Read a source file summary and run verification through query-loop.'
  let callCount = 0
  const config: QueryEngineConfig = {
    cwd: input.cwd ?? process.cwd(),
    maxTurns: 3,
    toolExecution: { mode: 'sequential' },
    sessionSummary: { enabled: false },
    sessionMemory: { enabled: false },
    memoryExtraction: { enabled: false },
    agentSummary: { enabled: false },
    verificationGate: {
      enabled: true,
      triggerOnBash: true,
      onFailure: 'block',
    },
    reviewGate: {
      enabled: true,
      minScoreToApprove: 70,
    },
    llmCall: async () => {
      callCount += 1
      if (callCount === 1) {
        return {
          content: 'I will read the owner file and run the verification command.',
          reasoning: 'Use Read for source truth, then Bash for verification evidence.',
          stopReason: 'tool_use',
          toolCalls: [
            {
              id: 'reach-read-1',
              name: 'Read',
              arguments: {
                file_path: 'src/dsxu/engine/query-loop.ts',
              },
            },
            {
              id: 'reach-bash-1',
              name: 'Bash',
              arguments: {
                command: 'bun test src/dsxu/training/__tests__/query-loop-reachability.test.ts',
              },
            },
          ],
          usage: {
            inputTokens: 1200,
            outputTokens: 160,
            cacheHit: true,
            cacheReadTokens: 900,
            cacheCreationTokens: 120,
          },
        }
      }
      return {
        content: 'Verification passed. Query-loop reachability evidence was captured.',
        reasoning: 'The tool result was paired and the verification command reported PASS.',
        stopReason: 'end_turn',
        toolCalls: [],
        usage: {
          inputTokens: 700,
          outputTokens: 90,
          cacheHit: true,
          cacheReadTokens: 620,
          cacheCreationTokens: 0,
        },
      }
    },
  }

  const registry = createReachabilityToolRegistry()
  const generator = queryLoop(
    config,
    [{ role: 'user', content: task }],
    registry as any,
    {
      sessionId,
      requestId,
      taskQuery: task,
      loopId: 'training-query-loop-reachability-loop',
      callId: 'training-query-loop-reachability-call',
    },
  )
  const events: QueryEvent[] = []
  let next = await generator.next()
  while (!next.done) {
    events.push(next.value)
    next = await generator.next()
  }
  const result = next.value
  const artifact = buildQueryLoopReachabilityArtifact({
    sessionId,
    requestId,
    task,
    events,
    result,
  })
  return { artifact, events, result }
}

export function buildQueryLoopReachabilityArtifact(input: {
  sessionId: string
  requestId: string
  task: string
  events: readonly QueryEvent[]
  result: QueryResult
}): QueryLoopReachabilityArtifact {
  const trajectory = exportTrainingTrajectoryFromQueryLoopEvents(input).trajectory
  const validation = validateTrainingTrajectory(trajectory)
  const score = scoreTrainingTrajectory(trajectory)
  const eventTypes = [...new Set(input.events.map(event => event.type))]
  return {
    schemaVersion: QUERY_LOOP_REACHABILITY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    datasetKind: 'query_loop_reachability_probe',
    publicClaimAllowed: false,
    probe: {
      sessionId: input.sessionId,
      requestId: input.requestId,
      task: input.task,
      eventCount: input.events.length,
      eventTypes,
      requiredEventTypesPresent: REQUIRED_EVENT_TYPES.every(type => eventTypes.includes(type)),
      resultExitReason: input.result.exitReason,
    },
    validation,
    score,
    trajectory,
    rule: 'This artifact proves query-loop event reachability to the training trajectory schema with mocked provider/tool evidence. It is not a live provider benchmark or a public model quality claim.',
  }
}

export function exportTrainingTrajectoryFromQueryLoopEvents(input: {
  sessionId: string
  requestId: string
  task: string
  events: readonly QueryEvent[]
  result: QueryResult
}) {
  const ledgerEvents = extractLedgerEvents(input.events, input.result)
  const toolInputs = extractToolInputs(input.events)
  const filesRead = extractFilesRead(input.events)
  const verificationCommands = extractVerificationCommands(input.events)
  const verificationPassed = input.events.some(event => event.type === 'test_detected' && event.passed) ||
    toolInputs.some(tool => tool.toolName === 'Bash' && tool.ok === true && /pass|passed|success/i.test(tool.outputText ?? tool.result?.outputText ?? ''))
  const model = String(input.events.find(event => event.type === 'model_called')?.model ?? 'unknown')
  const cost = extractCostRoute(ledgerEvents, model)
  return exportTrainingTrajectory({
    task: {
      taskId: `${input.sessionId}:${input.requestId}`,
      category: 'query-loop-reachability',
      intent: input.task,
      riskLevel: 'low',
      acceptanceCriteria: [
        'query-loop emits required runtime events',
        'tool result is paired',
        'verification command evidence is present',
      ],
      claimScope: 'internal',
    },
    intentUnderstanding: {
      interpretedGoal: input.task,
      constraints: ['mock provider only', 'no raw source body storage', 'no public benchmark claim'],
      explicitNoEdit: false,
      missingInfo: [],
      riskClassification: 'low',
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
      artifactPaths: ['docs/generated/DSXU_TRAINING_QUERY_LOOP_REACHABILITY_20260520.json'],
    },
    contextMemory: {
      goalPreserved: input.result.exitReason === 'end_turn',
      resumePoint: 'query-loop-finished',
      openObligations: [],
      compactOccurred: input.events.some(event => event.type === 'context_snapshot_reset'),
      sourceRereadAfterResume: false,
    },
    costRoute: cost,
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
        ? ['query-loop emitted required event sequence', 'verification command passed']
        : ['query-loop emitted runtime events'],
      unverifiedRisks: verificationPassed ? [] : ['verification command did not pass'],
      overclaimDetected: false,
    },
    outcome: {
      status: verificationPassed && input.result.exitReason === 'end_turn' ? 'success' : 'partial',
      finalClaim: 'query-loop reachability probe produced a valid training trajectory',
      verified: verificationPassed,
      publicClaimAllowed: false,
    },
  })
}

function createReachabilityToolRegistry() {
  const schemas = [
    {
      name: 'Read',
      description: 'Read a source file summary without storing raw content',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'Bash',
      description: 'Run a verification command',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string' },
        },
        required: ['command'],
      },
    },
  ]
  return {
    getAll: () => schemas,
    get: (name: string) => schemas.find(schema => schema.name === name),
    has: (name: string) => schemas.some(schema => schema.name === name),
    register: () => {},
    unregister: () => {},
    clear: () => {},
    size: schemas.length,
    getSchemas: () => schemas,
    execute: async (name: string, input: Record<string, unknown>, toolUseId: string): Promise<ToolResult> => {
      if (name === 'Read') {
        return {
          toolUseId,
          content: `SOURCE_SUMMARY path=${String(input.file_path ?? 'unknown')} owner=query-loop lines=summary-only`,
          isError: false,
          meta: {
            durationMs: 5,
            executorKind: 'dsxu_native',
            usedBridge: false,
          },
        }
      }
      if (name === 'Bash') {
        return {
          toolUseId,
          content: `PASS ${String(input.command ?? 'verification command')}`,
          isError: false,
          meta: {
            durationMs: 9,
            executorKind: 'dsxu_native',
            usedBridge: false,
          },
        }
      }
      return {
        toolUseId,
        content: `Unknown tool: ${name}`,
        isError: true,
        meta: {
          durationMs: 1,
          executorKind: 'dsxu_native',
          usedBridge: false,
        },
      }
    },
  }
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
    routeReason: 'query-loop-reachability-probe',
    estimatedCostUsd: 0,
    cacheHitInputTokens: Math.max(0, cacheHitInputTokens),
    cacheMissInputTokens: Math.max(0, cacheMissInputTokens),
    proAdmissionJustified: false,
  }
}
