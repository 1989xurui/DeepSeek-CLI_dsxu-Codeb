import { readFile } from 'node:fs/promises'
import type { TrainingTrajectoryExportResult } from './exporter'
import { exportTrainingTrajectory, type TrainingTrajectoryToolInput } from './exporter'
import type { LongTaskLedgerEvent } from '../engine/progress-ledger'

export interface RuntimeEvidenceImportOptions {
  taskId?: string
  category?: string
  intent?: string
  verificationCommands?: readonly string[]
  verificationPassed?: boolean
  claimBound?: boolean
  outputStatus?: 'success' | 'partial' | 'failed' | 'blocked'
}

export interface RuntimeEvidenceImportSummary {
  schemaVersion: 'dsxu.runtime-evidence-import-summary.v1'
  recordCount: number
  requestCount: number
  requestTags: readonly string[]
  events: Record<string, number>
  toolCallCount: number
  toolResultCount: number
  toolResultChars: number
  model: string
  routeReason: string
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  rawContentStored: boolean
}

export interface RuntimeEvidenceImportResult extends TrainingTrajectoryExportResult {
  summary: RuntimeEvidenceImportSummary
}

export async function exportTrainingTrajectoryFromRuntimeFile(
  path: string,
  options: RuntimeEvidenceImportOptions = {},
): Promise<RuntimeEvidenceImportResult> {
  const text = await readFile(path, 'utf8')
  return exportTrainingTrajectoryFromRuntimeJsonl(text, options)
}

export function exportTrainingTrajectoryFromRuntimeJsonl(
  jsonl: string,
  options: RuntimeEvidenceImportOptions = {},
): RuntimeEvidenceImportResult {
  const records = parseJsonl(jsonl)
  const summary = summarizeRuntimeRecords(records)
  const verificationPassed = options.verificationPassed ?? false
  const claimBound = options.claimBound ?? verificationPassed
  const toolResults = buildToolInputs(records)
  const ledgerEvents = buildLedgerEvents(summary)
  const result = exportTrainingTrajectory({
    task: {
      taskId: options.taskId ?? 'runtime-evidence-import',
      category: options.category ?? 'runtime-evidence',
      intent: options.intent ?? 'Import DSXU runtime evidence into a redacted training trajectory.',
      riskLevel: summary.rawContentStored ? 'high' : 'medium',
      acceptanceCriteria: [
        'runtime evidence is redacted',
        'tool calls/results are summarized',
        'verification claim remains partial unless explicit verification is supplied',
      ],
      claimScope: 'internal',
    },
    intentUnderstanding: {
      interpretedGoal: options.intent ?? 'Import DSXU runtime evidence.',
      constraints: ['no live API call', 'no source body storage', 'no public benchmark claim'],
      explicitNoEdit: false,
      missingInfo: verificationPassed ? [] : ['verification result not supplied by runtime trace'],
      riskClassification: summary.rawContentStored ? 'high' : 'medium',
    },
    ledgerEvents,
    toolResults,
    filesRead: inferFilesRead(records),
    rangesRead: [],
    sourceEvidenceText: records.map(record => JSON.stringify({
      event: record.event,
      requestTag: record.requestTag,
      requestId: record.requestId,
    })),
    verification: {
      commands: options.verificationCommands ?? [],
      passed: verificationPassed,
      claimBound,
      localizedFeedbackPresent: !verificationPassed,
      artifactPaths: [],
    },
    recovery: verificationPassed ? undefined : {
      failureClass: 'missing_runtime_verification',
      localizedFiles: [],
      changedStrategy: true,
      nextAction: 'attach real verification command output before marking success',
      recoveryDecision: 'block-final-claim',
    },
    contextMemory: {
      goalPreserved: true,
      resumePoint: 'runtime-import',
      openObligations: verificationPassed ? [] : ['supply verification evidence'],
      compactOccurred: false,
      sourceRereadAfterResume: false,
    },
    costRoute: {
      model: summary.model,
      routeReason: summary.routeReason,
      estimatedCostUsd: 0,
      cacheHitInputTokens: summary.cacheHitInputTokens,
      cacheMissInputTokens: summary.cacheMissInputTokens,
      proAdmissionJustified: /pro/i.test(summary.model),
    },
    antiCheat: {
      oracleLeakFlag: false,
      solutionArtifactFlag: false,
      oldReportFlag: false,
      testOnlyFixFlag: false,
      publicClaimAllowed: false,
    },
    communication: {
      userVisibleSummary: verificationPassed
        ? 'Runtime evidence import is verification-bound.'
        : 'Runtime evidence import is partial and not release-claimable until verification is attached.',
      verifiedFacts: [
        `${summary.recordCount} redacted runtime records imported`,
        `${summary.toolCallCount} tool calls summarized`,
        `${summary.toolResultCount} tool results summarized`,
      ],
      unverifiedRisks: verificationPassed ? [] : ['no verification command result in imported runtime evidence'],
      overclaimDetected: false,
    },
    outcome: {
      status: options.outputStatus ?? (verificationPassed ? 'success' : 'partial'),
      finalClaim: verificationPassed
        ? 'runtime evidence imported with verification evidence'
        : 'runtime evidence imported without final success claim',
      verified: verificationPassed,
      publicClaimAllowed: false,
    },
  })

  return { ...result, summary }
}

export function parseJsonl(jsonl: string): Record<string, unknown>[] {
  return jsonl
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>)
}

export function summarizeRuntimeRecords(records: readonly Record<string, unknown>[]): RuntimeEvidenceImportSummary {
  const requestTags = new Set<string>()
  const events: Record<string, number> = {}
  let toolCallCount = 0
  let toolResultCount = 0
  let toolResultChars = 0
  let cacheHitInputTokens = 0
  let cacheMissInputTokens = 0
  let outputTokens = 0
  let rawContentStored = false
  let model = 'unknown'
  let routeReason = 'runtime-evidence-import'

  for (const record of records) {
    const event = stringFrom(record.event) ?? 'unknown'
    events[event] = (events[event] ?? 0) + 1
    const requestTag = stringFrom(record.requestTag)
    if (requestTag) requestTags.add(requestTag)
    rawContentStored = rawContentStored || record.redacted !== true || record.rawContentStored === true
    model = stringFrom(record.responseModel) ?? stringFrom(record.modelName) ?? stringFrom(record.requestedModel) ?? model
    routeReason = stringFrom(record.routeReason) ?? routeReason

    const assistantToolCalls = arrayFrom(record.assistantToolCalls)
    const responseToolCalls = arrayFrom(record.toolCalls)
    toolCallCount += assistantToolCalls.length + responseToolCalls.length
    const toolResults = arrayFrom(record.toolResults)
    toolResultCount += numberFrom(record.toolResultCount) ?? toolResults.length
    for (const toolResult of toolResults) {
      const item = objectFrom(toolResult)
      toolResultChars += numberFrom(item.contentChars) ?? 0
    }

    const usage = objectFrom(record.usage)
    cacheHitInputTokens += numberFrom(usage.cache_read_input_tokens) ?? numberFrom(usage.prompt_cache_hit_tokens) ?? 0
    cacheMissInputTokens += numberFrom(usage.cache_creation_input_tokens) ?? numberFrom(usage.prompt_cache_miss_tokens) ?? 0
    outputTokens += numberFrom(usage.output_tokens) ?? numberFrom(usage.completion_tokens) ?? 0
  }

  return {
    schemaVersion: 'dsxu.runtime-evidence-import-summary.v1',
    recordCount: records.length,
    requestCount: requestTags.size,
    requestTags: [...requestTags].sort(),
    events,
    toolCallCount,
    toolResultCount,
    toolResultChars,
    model,
    routeReason,
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens,
    rawContentStored,
  }
}

function buildToolInputs(records: readonly Record<string, unknown>[]): TrainingTrajectoryToolInput[] {
  const calls: TrainingTrajectoryToolInput[] = []
  const resultById = new Map<string, { chars: number; hash?: string }>()
  for (const record of records) {
    for (const result of arrayFrom(record.toolResults)) {
      const item = objectFrom(result)
      const id = stringFrom(item.toolCallId)
      if (id) {
        resultById.set(id, {
          chars: numberFrom(item.contentChars) ?? 0,
          hash: stringFrom(item.contentHash),
        })
      }
    }
  }

  for (const record of records) {
    const snapshots = [...arrayFrom(record.assistantToolCalls), ...arrayFrom(record.toolCalls)]
    for (const [index, snapshot] of snapshots.entries()) {
      const item = objectFrom(snapshot)
      const id = stringFrom(item.id) ?? `${stringFrom(record.requestTag) ?? 'request'}-tool-${calls.length + index + 1}`
      const name = stringFrom(item.name) ?? 'UnknownTool'
      const result = resultById.get(id)
      calls.push({
        toolUseId: id,
        toolName: name,
        readonly: /read|grep|glob|ls/i.test(name),
        permissionDecision: 'unknown',
        outputText: result ? `redacted tool result chars=${result.chars} hash=${result.hash ?? 'unknown'}` : undefined,
      })
    }
  }

  if (calls.length === 0 && resultById.size > 0) {
    for (const [id, result] of resultById.entries()) {
      calls.push({
        toolUseId: id,
        toolName: 'UnknownTool',
        readonly: false,
        permissionDecision: 'unknown',
        outputText: `redacted tool result chars=${result.chars} hash=${result.hash ?? 'unknown'}`,
      })
    }
  }

  return calls
}

function buildLedgerEvents(summary: RuntimeEvidenceImportSummary): Partial<LongTaskLedgerEvent>[] {
  return [
    {
      kind: 'goal',
      owner: 'Runtime Evidence Importer',
      summary: 'import DSXU runtime evidence as training trajectory',
    },
    {
      kind: 'plan',
      owner: 'Runtime Evidence Importer',
      summary: `records=${summary.recordCount} requests=${summary.requestCount}`,
    },
    ...(summary.toolCallCount > 0 || summary.toolResultCount > 0
      ? [{
          kind: 'tool' as const,
          owner: 'Tool Gate',
          summary: `toolCalls=${summary.toolCallCount} toolResults=${summary.toolResultCount}`,
        }]
      : []),
    {
      kind: 'cost-cache',
      owner: 'DeepSeek route/cost/cache',
      summary: summary.routeReason,
      metadata: {
        model: summary.model,
        routeReason: summary.routeReason,
        cacheHitInputTokens: summary.cacheHitInputTokens,
        cacheMissInputTokens: summary.cacheMissInputTokens,
        outputTokens: summary.outputTokens,
      },
    },
    {
      kind: 'verification',
      owner: 'Runtime Evidence Importer',
      summary: 'runtime import requires external verification evidence before final success',
    },
  ]
}

function inferFilesRead(records: readonly Record<string, unknown>[]): string[] {
  const hasRead = records.some(record =>
    [...arrayFrom(record.assistantToolCalls), ...arrayFrom(record.toolCalls)].some(tool => /read/i.test(stringFrom(objectFrom(tool).name) ?? '')),
  )
  return hasRead ? ['runtime:redacted-read-tool-call'] : []
}

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
