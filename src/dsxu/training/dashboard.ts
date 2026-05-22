import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const TRAINING_EVIDENCE_DASHBOARD_SCHEMA_VERSION = 'dsxu.training-evidence-dashboard.v1' as const

export type TrainingEvidenceClaimStatus = 'allowed-internal' | 'blocked' | 'missing-evidence'

export interface TrainingEvidenceDashboardPaths {
  v1Run: string
  replayValidation: string
  replayScore: string
  ablation: string
  queryLoopReachability: string
  queryLoopReachabilityScore: string
  queryLoopCapture: string
  queryLoopCaptureScore: string
  liveProviderCapture: string
  liveProviderValidation: string
  liveProviderScore: string
}

export interface TrainingEvidenceClaimGate {
  id: string
  label: string
  status: TrainingEvidenceClaimStatus
  claimAllowed: boolean
  evidence: Record<string, unknown>
  reason: string
  nextAction: string
}

export interface TrainingEvidenceDashboard {
  schemaVersion: typeof TRAINING_EVIDENCE_DASHBOARD_SCHEMA_VERSION
  generatedAt: string
  datasetKind: 'training_evidence_dashboard'
  publicClaimAllowed: false
  evidenceCompletenessScore: number
  summary: {
    offlineV1Status: string
    replaySampleCount: number
    queryLoopReachability: boolean
    queryLoopCapture: boolean
    liveProviderStatus: string
    liveProviderRecordCount: number
    publicBenchmarkEvidencePresent: boolean
    superiorityEvidencePresent: boolean
  }
  claimGates: readonly TrainingEvidenceClaimGate[]
  missingEvidence: readonly string[]
  recommendedNextActions: readonly string[]
  inputs: Record<keyof TrainingEvidenceDashboardPaths, {
    path: string
    present: boolean
    parseError?: string
  }>
  rule: string
}

export const DEFAULT_TRAINING_EVIDENCE_DASHBOARD_PATHS: TrainingEvidenceDashboardPaths = {
  v1Run: 'docs/generated/DSXU_TRAINING_V1_RUN_20260520.json',
  replayValidation: 'docs/generated/DSXU_TRAINING_REPLAY_VALIDATE_20260520.json',
  replayScore: 'docs/generated/DSXU_TRAINING_REPLAY_SCORE_20260520.json',
  ablation: 'docs/generated/DSXU_TRAINING_ABLATION_20260520.json',
  queryLoopReachability: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_REACHABILITY_20260520.json',
  queryLoopReachabilityScore: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_REACHABILITY_SCORE_20260520.json',
  queryLoopCapture: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_CAPTURE_20260520.json',
  queryLoopCaptureScore: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_CAPTURE_SCORE_20260520.json',
  liveProviderCapture: 'docs/generated/DSXU_TRAINING_LIVE_PROVIDER_CAPTURE_20260520.json',
  liveProviderValidation: 'docs/generated/DSXU_TRAINING_LIVE_PROVIDER_CAPTURE_VALIDATE_20260520.json',
  liveProviderScore: 'docs/generated/DSXU_TRAINING_LIVE_PROVIDER_CAPTURE_SCORE_20260520.json',
}

export async function buildTrainingEvidenceDashboardFromFiles(input: {
  paths?: Partial<TrainingEvidenceDashboardPaths>
  outputPath: string
}): Promise<TrainingEvidenceDashboard> {
  const paths = { ...DEFAULT_TRAINING_EVIDENCE_DASHBOARD_PATHS, ...input.paths }
  const loaded = await loadTrainingDashboardInputs(paths)
  const dashboard = buildTrainingEvidenceDashboard({ paths, artifacts: loaded.artifacts, inputState: loaded.inputState })
  const outputPath = resolve(input.outputPath)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`, 'utf8')
  return dashboard
}

export function buildTrainingEvidenceDashboard(input: {
  paths: TrainingEvidenceDashboardPaths
  artifacts: Partial<Record<keyof TrainingEvidenceDashboardPaths, unknown>>
  inputState?: Partial<TrainingEvidenceDashboard['inputs']>
}): TrainingEvidenceDashboard {
  const artifacts = input.artifacts
  const v1Status = stringField(artifacts.v1Run, 'status') ?? 'missing'
  const v1PublicClaimAllowed = booleanField(artifacts.v1Run, 'publicClaimAllowed')
  const replayValidationStatus = stringField(artifacts.replayValidation, 'status')
  const replaySampleCount = numberField(artifacts.replayValidation, 'sampleCount')
  const replayExpectedMismatches = countExpectedMismatches(artifacts.replayValidation)
  const replayScoreSampleCount = numberField(artifacts.replayScore, 'sampleCount')
  const replayScoreMismatches = numberField(artifacts.replayScore, 'expectedScoreMismatchedCount')
  const ablationStatus = stringField(artifacts.ablation, 'status')
  const ablationPublicClaimAllowed = booleanField(artifacts.ablation, 'publicClaimAllowed')
  const queryLoopReachabilityPresent = booleanField(objectField(artifacts.queryLoopReachability, 'probe'), 'requiredEventTypesPresent') === true
  const queryLoopReachabilityPublic = booleanField(artifacts.queryLoopReachability, 'publicClaimAllowed')
  const queryLoopReachabilityScoreCount = numberField(artifacts.queryLoopReachabilityScore, 'sampleCount')
  const queryLoopCaptureMode = stringField(objectField(artifacts.queryLoopCapture, 'capture'), 'mode')
  const queryLoopCapturePublic = booleanField(artifacts.queryLoopCapture, 'publicClaimAllowed')
  const queryLoopCaptureScoreCount = numberField(artifacts.queryLoopCaptureScore, 'sampleCount')
  const liveStatus = stringField(artifacts.liveProviderCapture, 'status') ?? 'missing'
  const livePublicClaimAllowed = booleanField(artifacts.liveProviderCapture, 'publicClaimAllowed')
  const liveProviderClaimAllowed = booleanField(artifacts.liveProviderCapture, 'liveProviderClaimAllowed')
  const liveValidationStatus = stringField(artifacts.liveProviderValidation, 'status')
  const liveScoreCount = numberField(artifacts.liveProviderScore, 'sampleCount')
  const liveRecordCount = numberField(objectField(objectField(artifacts.liveProviderCapture, 'import'), 'summary'), 'recordCount')

  const claimGates: TrainingEvidenceClaimGate[] = [
    claimGate({
      id: 'offline-training-pipeline',
      label: 'offline training pipeline evidence',
      passed: v1Status === 'PASS' && v1PublicClaimAllowed === false,
      missing: v1Status === 'missing',
      evidence: {
        v1Status,
        publicClaimAllowed: v1PublicClaimAllowed,
      },
      reason: 'V1 runner must pass before internal pipeline quality can be cited.',
      nextAction: 'Run bun run training:v1 and fix failed gates before using offline training evidence.',
    }),
    claimGate({
      id: 'internal-replay-calibration',
      label: 'internal replay and ablation calibration',
      passed: replayValidationStatus === 'PASS' &&
        replaySampleCount >= 300 &&
        replayScoreSampleCount >= 300 &&
        replayExpectedMismatches === 0 &&
        replayScoreMismatches === 0 &&
        ablationStatus === 'PASS_INTERNAL_SYNTHETIC_REPLAY_BASELINE' &&
        ablationPublicClaimAllowed === false,
      missing: replayValidationStatus === undefined || ablationStatus === undefined,
      evidence: {
        replayValidationStatus,
        replaySampleCount,
        replayExpectedMismatches,
        replayScoreSampleCount,
        replayScoreMismatches,
        ablationStatus,
        ablationPublicClaimAllowed,
      },
      reason: 'Internal replay can calibrate validators and scorer, but cannot be public benchmark evidence.',
      nextAction: 'Regenerate replay, validation, score, and ablation artifacts if any mismatch appears.',
    }),
    claimGate({
      id: 'query-loop-training-reachability',
      label: 'query-loop event stream reaches training schema',
      passed: queryLoopReachabilityPresent &&
        queryLoopReachabilityPublic === false &&
        queryLoopReachabilityScoreCount >= 1 &&
        queryLoopCaptureMode === 'env_opt_in' &&
        queryLoopCapturePublic === false &&
        queryLoopCaptureScoreCount >= 1,
      missing: artifacts.queryLoopReachability === undefined || artifacts.queryLoopCapture === undefined,
      evidence: {
        requiredEventTypesPresent: queryLoopReachabilityPresent,
        reachabilityPublicClaimAllowed: queryLoopReachabilityPublic,
        reachabilityScoreCount: queryLoopReachabilityScoreCount,
        captureMode: queryLoopCaptureMode,
        capturePublicClaimAllowed: queryLoopCapturePublic,
        captureScoreCount: queryLoopCaptureScoreCount,
      },
      reason: 'Query-loop evidence proves reachability and opt-in capture, not default user-task quality.',
      nextAction: 'Run training:reachability and training:capture-query-loop when this gate is missing or blocked.',
    }),
    claimGate({
      id: 'live-provider-smoke',
      label: 'DeepSeek live provider smoke evidence',
      passed: liveStatus === 'PASS_LIVE_PROVIDER_CAPTURE' &&
        liveValidationStatus === 'PASS' &&
        liveScoreCount >= 1 &&
        liveRecordCount >= 3 &&
        livePublicClaimAllowed === false &&
        liveProviderClaimAllowed === false,
      missing: liveStatus === 'missing' || liveStatus === 'SKIPPED_NO_API_KEY',
      evidence: {
        liveStatus,
        liveValidationStatus,
        liveScoreCount,
        liveRecordCount,
        publicClaimAllowed: livePublicClaimAllowed,
        liveProviderClaimAllowed,
      },
      reason: 'Live provider smoke proves the DeepSeek adapter path can emit redacted evidence, not task success rate.',
      nextAction: 'Run bun run training:live-provider-capture; use --require-live only in release preflight with a valid key.',
    }),
    {
      id: 'public-benchmark-claim',
      label: 'public benchmark or SWE-bench claim',
      status: 'blocked',
      claimAllowed: false,
      evidence: {
        publicBenchmarkEvidencePresent: false,
        acceptedEvidenceTypes: ['real benchmark run', 'raw task logs', 'reproducible judge output'],
      },
      reason: 'No real external benchmark artifact is part of the training evidence dashboard.',
      nextAction: 'Run an explicitly scoped benchmark runner with raw evidence before making any public score claim.',
    },
    {
      id: 'superiority-claim',
      label: 'claim DSXU exceeds target reference coding agents',
      status: 'blocked',
      claimAllowed: false,
      evidence: {
        superiorityEvidencePresent: false,
        requiredEvidence: ['same-task comparison', 'model/provider versions', 'judge protocol', 'raw logs'],
      },
      reason: 'Offline/internal/live-smoke evidence is insufficient for superiority claims.',
      nextAction: 'Keep this claim blocked until a real comparable benchmark package exists.',
    },
  ]

  const missingEvidence = claimGates
    .filter(gate => gate.status !== 'allowed-internal')
    .map(gate => gate.id)
  const recommendedNextActions = claimGates
    .filter(gate => gate.status !== 'allowed-internal')
    .map(gate => gate.nextAction)
  const allowedInternalCount = claimGates.filter(gate => gate.status === 'allowed-internal').length
  const evidenceCompletenessScore = Math.round((allowedInternalCount / claimGates.length) * 100)

  return {
    schemaVersion: TRAINING_EVIDENCE_DASHBOARD_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    datasetKind: 'training_evidence_dashboard',
    publicClaimAllowed: false,
    evidenceCompletenessScore,
    summary: {
      offlineV1Status: v1Status,
      replaySampleCount: finiteNumberOrZero(replaySampleCount),
      queryLoopReachability: queryLoopReachabilityPresent,
      queryLoopCapture: queryLoopCaptureMode === 'env_opt_in',
      liveProviderStatus: liveStatus,
      liveProviderRecordCount: finiteNumberOrZero(liveRecordCount),
      publicBenchmarkEvidencePresent: false,
      superiorityEvidencePresent: false,
    },
    claimGates,
    missingEvidence,
    recommendedNextActions,
    inputs: buildInputState(input.paths, input.inputState),
    rule: 'This dashboard is a claim-boundary map for training/runtime evidence. It never permits public benchmark or model-superiority claims from internal replay, query-loop probes, or live provider smoke.',
  }
}

async function loadTrainingDashboardInputs(paths: TrainingEvidenceDashboardPaths): Promise<{
  artifacts: Partial<Record<keyof TrainingEvidenceDashboardPaths, unknown>>
  inputState: TrainingEvidenceDashboard['inputs']
}> {
  const artifacts: Partial<Record<keyof TrainingEvidenceDashboardPaths, unknown>> = {}
  const inputState = {} as TrainingEvidenceDashboard['inputs']
  for (const [key, path] of Object.entries(paths) as Array<[keyof TrainingEvidenceDashboardPaths, string]>) {
    const fullPath = resolve(path)
    if (!existsSync(fullPath)) {
      inputState[key] = { path: fullPath, present: false }
      continue
    }
    try {
      artifacts[key] = JSON.parse(await readFile(fullPath, 'utf8'))
      inputState[key] = { path: fullPath, present: true }
    } catch (error) {
      inputState[key] = {
        path: fullPath,
        present: true,
        parseError: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return { artifacts, inputState }
}

function buildInputState(
  paths: TrainingEvidenceDashboardPaths,
  existing?: Partial<TrainingEvidenceDashboard['inputs']>,
): TrainingEvidenceDashboard['inputs'] {
  const result = {} as TrainingEvidenceDashboard['inputs']
  for (const [key, path] of Object.entries(paths) as Array<[keyof TrainingEvidenceDashboardPaths, string]>) {
    result[key] = existing?.[key] ?? { path: resolve(path), present: false }
  }
  return result
}

function claimGate(input: {
  id: string
  label: string
  passed: boolean
  missing: boolean
  evidence: Record<string, unknown>
  reason: string
  nextAction: string
}): TrainingEvidenceClaimGate {
  return {
    id: input.id,
    label: input.label,
    status: input.passed ? 'allowed-internal' : input.missing ? 'missing-evidence' : 'blocked',
    claimAllowed: input.passed,
    evidence: input.evidence,
    reason: input.reason,
    nextAction: input.nextAction,
  }
}

function countExpectedMismatches(value: unknown): number {
  return arrayField(value, 'items').filter(item => booleanField(item, 'expectedMatched') !== true).length
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function objectField(value: unknown, key: string): Record<string, unknown> | undefined {
  return objectValue(objectValue(value)?.[key])
}

function stringField(value: unknown, key: string): string | undefined {
  const field = objectValue(value)?.[key]
  return typeof field === 'string' ? field : undefined
}

function numberField(value: unknown, key: string): number {
  const field = objectValue(value)?.[key]
  return typeof field === 'number' && Number.isFinite(field) ? field : Number.NaN
}

function finiteNumberOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function booleanField(value: unknown, key: string): boolean | undefined {
  const field = objectValue(value)?.[key]
  return typeof field === 'boolean' ? field : undefined
}

function arrayField(value: unknown, key: string): readonly unknown[] {
  const field = objectValue(value)?.[key]
  return Array.isArray(field) ? field : []
}
