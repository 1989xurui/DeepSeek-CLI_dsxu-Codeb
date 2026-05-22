import { createHash } from 'node:crypto'
import {
  compileDSXUExecutionContract,
  type DSXUExecutionContract,
} from './action-contract'
import {
  buildDSXUEditProofEnvelope,
  type DSXUEditProofEnvelope,
  type DSXUVerificationResult,
} from './code-mode-surgical-loop'
import {
  decideDeepSeekV4Route,
  normalizeDeepSeekV4Model,
} from '../../utils/model/deepseekV4Control'

export const REAL_TASK_REPLAY_P12_SLOT_IDS = [
  'RT-01',
  'RT-01-additional-2',
  'RT-01-additional-3',
  'RT-02-additional-1',
  'RT-02-additional-2',
  'RT-03-additional-1',
  'RT-03-additional-2',
  'RT-04',
  'RT-04-additional-2',
  'RT-05-additional-1',
  'RT-06-additional-1',
  'RT-07',
  'RT-07-additional-2',
  'RT-08',
] as const

export type RealTaskReplayId = (typeof REAL_TASK_REPLAY_P12_SLOT_IDS)[number]
export type RealTaskReplayStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

export type RealTaskReplayEvidenceChecklist = {
  baseline: boolean
  context: boolean
  execution: boolean
  recovery: boolean
  verification: boolean
  cost: boolean
  final: boolean
}

export type RealTaskReplayCase = {
  id: RealTaskReplayId
  title: string
  target: string
  evidence: RealTaskReplayEvidenceChecklist
  artifactPaths: readonly string[]
  metrics: Record<string, number | string | boolean | null>
  risks: readonly string[]
}

export type RealTaskReplayCaseResult = RealTaskReplayCase & {
  status: RealTaskReplayStatus
  missingEvidence: readonly (keyof RealTaskReplayEvidenceChecklist)[]
}

export type RealTaskReplaySuiteResult = {
  schemaVersion: 'dsxu.real-task-replay-suite.v1'
  status: RealTaskReplayStatus
  caseCount: number
  pass: number
  partial: number
  blocked: number
  mustNotClaimReleaseReady: boolean
  cases: readonly RealTaskReplayCaseResult[]
  requiredArtifacts: readonly string[]
  redlines: readonly string[]
}

export type V5ReplayTraceEvidence = {
  caseId: string
  layer: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  userTask: string
  executionContract: boolean
  route: boolean
  visibleTools: boolean
  promptHash: boolean
  toolEvents: boolean
  sourceEvidence: boolean
  editProof: boolean
  verificationResult: boolean
  recoveryPath: boolean
  finalAnswer: boolean
  accepted: boolean
  rawTracePath: string
}

export type V5ReplayBank = {
  schemaVersion: 'dsxu.replay-bank.v5'
  owner: 'Replay Bank / Evidence'
  status: 'PASS_V5_REPLAY_BANK_READY' | 'NEEDS_V5_REPLAY_BANK_EVIDENCE'
  caseCount: number
  acceptedCount: number
  recoveryCaseCount: number
  layerCounts: Record<V5ReplayTraceEvidence['layer'], number>
  requiredSubsetReady: boolean
  fullReleaseReady: boolean
  rawTraceSavedPct: number
  redlines: readonly string[]
  cases: readonly V5ReplayTraceEvidence[]
}

export type V5ReplayTraceMetadataInput = {
  caseId: string
  userTask: string
  workspace: string
  prompt: string
  visibleTools: readonly string[]
  sourceEvidence: readonly string[]
  changedFiles: readonly string[]
  verificationCommand: readonly string[]
  verificationPassed: boolean
  verificationStdout?: string
  verificationStderr?: string
  verificationArtifacts?: readonly string[]
  recoveryPath: boolean
  routeModel?: string
  priorFailureCount?: number
  now?: number
}

export type V5ReplayTraceMetadata = {
  executionContract: DSXUExecutionContract
  promptHash: {
    schemaVersion: 'dsxu.prompt-cache-hash.v5'
    promptHash: string
    stablePrefixHash: string
    dynamicTailHash: string
    stablePrefixChars: number
    dynamicTailChars: number
    routeModel: string
  }
  editProof: DSXUEditProofEnvelope
  replayStandard: {
    schemaVersion: 'dsxu.replay-standard.v5'
    caseId: string
    owner: 'Replay Bank / Evidence'
    visibleToolCount: number
    sourceEvidenceCount: number
    changedFileCount: number
    verificationArtifactCount: number
    recoveryPath: boolean
    acceptedFields: readonly string[]
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function buildV5ReplayTraceMetadata(
  input: V5ReplayTraceMetadataInput,
): V5ReplayTraceMetadata {
  const stablePrefix = [
    'DSXU V5 replay trace metadata',
    `routeModel:${input.routeModel ?? 'deepseek-v4-flash'}`,
    `visibleTools:${input.visibleTools.join(',')}`,
    `workspace:${input.workspace}`,
  ].join('\n')
  const dynamicTail = [
    `caseId:${input.caseId}`,
    `task:${input.userTask}`,
    `prompt:${input.prompt}`,
    `sourceEvidence:${input.sourceEvidence.join(',')}`,
    `changedFiles:${input.changedFiles.join(',')}`,
    `verification:${input.verificationCommand.join(' ')}`,
  ].join('\n')
  const verification: DSXUVerificationResult = {
    command: [...input.verificationCommand],
    exitCode: input.verificationPassed ? 0 : 1,
    stdout: input.verificationStdout ?? '',
    stderr: input.verificationStderr ?? '',
    passed: input.verificationPassed,
    failureType: input.verificationPassed ? 'unknown' : 'test_failure',
  }
  const executionContract = compileDSXUExecutionContract({
    taskId: input.caseId,
    userRequest: input.userTask,
    workspaceSignals: {
      changedFiles: input.changedFiles,
      availableScripts: input.verificationCommand.length > 0 ? [input.verificationCommand.join(' ')] : [],
      hasPackageJson: true,
      isDirty: input.changedFiles.length > 0,
    },
    riskTags: ['replay-evidence'],
    priorFailureCount: input.priorFailureCount ?? (input.recoveryPath ? 1 : 0),
    sourceEvidenceCount: input.sourceEvidence.length,
    maxToolCalls: Math.max(input.visibleTools.length, 1),
    routeDecisionOverride: decideDeepSeekV4Route({
      workflowKind: 'verification',
      role: 'verifier',
      requiresReasoning: false,
      requestedMaxTokens: 8192,
    }),
    now: input.now,
  })
  const editProof = buildDSXUEditProofEnvelope({
    claim: `V5 replay case ${input.caseId} completed with verification evidence.`,
    filesChanged: input.changedFiles,
    sourceEvidence: input.sourceEvidence,
    commandsRun: input.verificationCommand.length > 0 ? [input.verificationCommand.join(' ')] : [],
    verification,
    rollbackPoint: `trace:${input.caseId}`,
    risk: input.changedFiles.length > 1 ? 'high' : 'medium',
    remainingRisks: input.verificationPassed ? [] : ['verification failed; replay cannot be accepted'],
  })

  return {
    executionContract,
    promptHash: {
      schemaVersion: 'dsxu.prompt-cache-hash.v5',
      promptHash: sha256(`${stablePrefix}\n${dynamicTail}`),
      stablePrefixHash: sha256(stablePrefix),
      dynamicTailHash: sha256(dynamicTail),
      stablePrefixChars: stablePrefix.length,
      dynamicTailChars: dynamicTail.length,
      routeModel: normalizeDeepSeekV4Model(input.routeModel),
    },
    editProof,
    replayStandard: {
      schemaVersion: 'dsxu.replay-standard.v5',
      caseId: input.caseId,
      owner: 'Replay Bank / Evidence',
      visibleToolCount: input.visibleTools.length,
      sourceEvidenceCount: input.sourceEvidence.length,
      changedFileCount: input.changedFiles.length,
      verificationArtifactCount: input.verificationArtifacts?.length ?? 0,
      recoveryPath: input.recoveryPath,
      acceptedFields: [
        'executionContract',
        'route',
        'visibleTools',
        'promptHash',
        'toolEvents',
        'sourceEvidence',
        'editProof',
        'verificationResult',
        'recoveryPath',
        'finalAnswer',
      ],
    },
  }
}

export function buildV5ReplayTraceMetadataEvents(
  input: V5ReplayTraceMetadataInput,
): readonly Record<string, unknown>[] {
  const metadata = buildV5ReplayTraceMetadata(input)
  return [
    {
      type: 'dsxu.execution-contract.v5',
      task_contract: metadata.executionContract,
      summary: compactText(`${metadata.executionContract.taskType} ${metadata.executionContract.modelRoute}`),
    },
    {
      type: 'dsxu.prompt-hash',
      ...metadata.promptHash,
    },
    {
      type: 'dsxu.edit-proof-envelope.v5',
      editProof: metadata.editProof,
    },
    {
      type: 'dsxu.replay-standard.v5',
      ...metadata.replayStandard,
    },
  ]
}

export function evaluateRealTaskReplayCase(input: RealTaskReplayCase): RealTaskReplayCaseResult {
  const missingEvidence = (Object.keys(input.evidence) as Array<keyof RealTaskReplayEvidenceChecklist>)
    .filter(key => input.evidence[key] !== true)
  const status: RealTaskReplayStatus =
    input.risks.some(risk => /fake pass|missing|unverified|blocked/i.test(risk)) || missingEvidence.length > 0
      ? 'BLOCKED'
      : input.risks.length > 0
        ? 'PARTIAL'
        : 'PASS'
  return {
    ...input,
    status,
    missingEvidence,
  }
}

export function buildRealTaskReplaySuite(
  cases: readonly RealTaskReplayCase[],
): RealTaskReplaySuiteResult {
  const evaluated = cases.map(evaluateRealTaskReplayCase)
  const pass = evaluated.filter(item => item.status === 'PASS').length
  const partial = evaluated.filter(item => item.status === 'PARTIAL').length
  const blocked = evaluated.filter(item => item.status === 'BLOCKED').length
  return {
    schemaVersion: 'dsxu.real-task-replay-suite.v1',
    status: blocked > 0 ? 'BLOCKED' : partial > 0 ? 'PARTIAL' : 'PASS',
    caseCount: evaluated.length,
    pass,
    partial,
    blocked,
    mustNotClaimReleaseReady: true,
    cases: evaluated,
    requiredArtifacts: [...new Set(evaluated.flatMap(item => item.artifactPaths))],
    redlines: evaluated.flatMap(item => [
      ...item.missingEvidence.map(field => `${item.id}: missing ${field} evidence`),
      ...item.risks.map(risk => `${item.id}: ${risk}`),
    ]),
  }
}

export function buildV5ReplayBank(
  cases: readonly V5ReplayTraceEvidence[],
): V5ReplayBank {
  const requiredFields: Array<keyof V5ReplayTraceEvidence> = [
    'executionContract',
    'route',
    'visibleTools',
    'promptHash',
    'toolEvents',
    'sourceEvidence',
    'editProof',
    'verificationResult',
    'finalAnswer',
  ]
  const layerCounts: Record<V5ReplayTraceEvidence['layer'], number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
    L5: 0,
  }
  const redlines: string[] = []
  let rawTraceSaved = 0
  let acceptedCount = 0
  let recoveryCaseCount = 0

  for (const replayCase of cases) {
    layerCounts[replayCase.layer] += 1
    if (replayCase.accepted) acceptedCount += 1
    if (replayCase.recoveryPath) recoveryCaseCount += 1
    if (replayCase.rawTracePath.trim()) rawTraceSaved += 1
    for (const field of requiredFields) {
      if (replayCase[field] !== true) {
        redlines.push(`${replayCase.caseId}: missing ${field}`)
      }
    }
    if (!replayCase.rawTracePath.trim()) {
      redlines.push(`${replayCase.caseId}: missing rawTracePath`)
    }
    if (!replayCase.accepted) {
      redlines.push(`${replayCase.caseId}: replay rejected`)
    }
  }
  const requiredRecoveryCases = cases.length >= 100 ? 20 : cases.length >= 20 ? 5 : 0
  if (recoveryCaseCount < requiredRecoveryCases) {
    redlines.push(`replay bank: need ${requiredRecoveryCases} recovery-path cases, found ${recoveryCaseCount}`)
  }

  const requiredSubsetReady = cases.length >= 20 && redlines.length === 0
  const fullReleaseReady = cases.length >= 100 && redlines.length === 0
  const rawTraceSavedPct = cases.length === 0
    ? 0
    : Math.round((rawTraceSaved / cases.length) * 1000) / 10
  const status = requiredSubsetReady
    ? 'PASS_V5_REPLAY_BANK_READY'
    : 'NEEDS_V5_REPLAY_BANK_EVIDENCE'

  return {
    schemaVersion: 'dsxu.replay-bank.v5',
    owner: 'Replay Bank / Evidence',
    status,
    caseCount: cases.length,
    acceptedCount,
    recoveryCaseCount,
    layerCounts,
    requiredSubsetReady,
    fullReleaseReady,
    rawTraceSavedPct,
    redlines,
    cases: [...cases],
  }
}
