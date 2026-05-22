export const TRAINING_V1_RUNNER_SCHEMA_VERSION = 'dsxu.training-v1-runner.v1' as const

export type TrainingV1RunnerStepStatus = 'success' | 'failed' | 'skipped'

export interface TrainingV1RunnerStepResult {
  id: string
  label: string
  command: readonly string[]
  status: TrainingV1RunnerStepStatus
  exitCode: number | null
  durationMs: number
  stdoutPath?: string
  stderrPath?: string
  stdoutPreview?: string
  stderrPreview?: string
}

export interface TrainingV1RunnerGate {
  id: string
  label: string
  passed: boolean
  evidence: Record<string, unknown>
}

export interface TrainingV1RunnerReport {
  schemaVersion: typeof TRAINING_V1_RUNNER_SCHEMA_VERSION
  generatedAt: string
  status: 'PASS' | 'FAIL'
  datasetKind: 'training_v1_reality_run'
  publicClaimAllowed: false
  steps: readonly TrainingV1RunnerStepResult[]
  gates: readonly TrainingV1RunnerGate[]
  rule: string
}

export interface TrainingV1RunnerArtifacts {
  dryRunValidation?: unknown
  dryRunScore?: unknown
  goldenValidation?: unknown
  goldenScore?: unknown
  replayValidation?: unknown
  replayScore?: unknown
  ablation?: unknown
  runtimeImport?: unknown
  runtimeImportValidation?: unknown
  runtimeImportScore?: unknown
  runtimeCapture?: unknown
  runtimeCaptureValidation?: unknown
  runtimeCaptureScore?: unknown
  queryLoopReachability?: unknown
  queryLoopReachabilityValidation?: unknown
  queryLoopReachabilityScore?: unknown
  queryLoopCapture?: unknown
  queryLoopCaptureValidation?: unknown
  queryLoopCaptureScore?: unknown
}

export function buildTrainingV1RunnerReport(input: {
  steps: readonly TrainingV1RunnerStepResult[]
  artifacts: TrainingV1RunnerArtifacts
}): TrainingV1RunnerReport {
  const stepsById = new Map(input.steps.map(step => [step.id, step]))
  const gates: TrainingV1RunnerGate[] = [
    gate('commands-succeeded', 'all V1 commands exited successfully', input.steps.every(step => step.status === 'success'), {
      failedSteps: input.steps.filter(step => step.status !== 'success').map(step => step.id),
      stepCount: input.steps.length,
    }),
    gate('unit-tests-passed', 'training unit tests passed', stepSucceeded(stepsById, 'training-tests'), {
      step: stepsById.get('training-tests')?.status ?? 'missing',
    }),
    gate('dry-run-valid', 'dry-run trajectory validates and scores', reportStatus(input.artifacts.dryRunValidation) === 'PASS' && numberField(input.artifacts.dryRunScore, 'scoredCount') >= 1, {
      validationStatus: reportStatus(input.artifacts.dryRunValidation),
      scoredCount: numberField(input.artifacts.dryRunScore, 'scoredCount'),
    }),
    gate('golden-fixtures-valid', 'golden fixture corpus matches expected accept/reject labels', reportStatus(input.artifacts.goldenValidation) === 'PASS' &&
      numberField(input.artifacts.goldenValidation, 'sampleCount') >= 60 &&
      allExpectedMatched(input.artifacts.goldenValidation), {
      validationStatus: reportStatus(input.artifacts.goldenValidation),
      sampleCount: numberField(input.artifacts.goldenValidation, 'sampleCount'),
      expectedMismatches: expectedMismatchCount(input.artifacts.goldenValidation),
    }),
    gate('golden-score-valid', 'golden fixture scores stay within expected SEES ranges', numberField(input.artifacts.goldenScore, 'expectedScoreMismatchedCount') === 0 &&
      numberField(input.artifacts.goldenScore, 'sampleCount') >= 60, {
      sampleCount: numberField(input.artifacts.goldenScore, 'sampleCount'),
      expectedScoreMismatchedCount: numberField(input.artifacts.goldenScore, 'expectedScoreMismatchedCount'),
      averageSees: numberField(input.artifacts.goldenScore, 'averageSees'),
    }),
    gate('replay-fixtures-valid', 'internal replay corpus validates with expected negative examples', reportStatus(input.artifacts.replayValidation) === 'PASS' &&
      numberField(input.artifacts.replayValidation, 'sampleCount') >= 300 &&
      allExpectedMatched(input.artifacts.replayValidation), {
      validationStatus: reportStatus(input.artifacts.replayValidation),
      sampleCount: numberField(input.artifacts.replayValidation, 'sampleCount'),
      expectedMismatches: expectedMismatchCount(input.artifacts.replayValidation),
    }),
    gate('replay-score-valid', 'internal replay scores remain calibrated', numberField(input.artifacts.replayScore, 'expectedScoreMismatchedCount') === 0 &&
      numberField(input.artifacts.replayScore, 'sampleCount') >= 300, {
      sampleCount: numberField(input.artifacts.replayScore, 'sampleCount'),
      expectedScoreMismatchedCount: numberField(input.artifacts.replayScore, 'expectedScoreMismatchedCount'),
      averageSees: numberField(input.artifacts.replayScore, 'averageSees'),
    }),
    gate('ablation-valid', 'ablation baseline passes without public benchmark claim', stringField(input.artifacts.ablation, 'status') === 'PASS_INTERNAL_SYNTHETIC_REPLAY_BASELINE' &&
      booleanField(input.artifacts.ablation, 'publicClaimAllowed') === false &&
      numberField(input.artifacts.ablation, 'replaySampleCount') >= 300, {
      status: stringField(input.artifacts.ablation, 'status'),
      publicClaimAllowed: booleanField(input.artifacts.ablation, 'publicClaimAllowed'),
      replaySampleCount: numberField(input.artifacts.ablation, 'replaySampleCount'),
    }),
    gate('runtime-import-valid', 'runtime evidence import is accepted but not public-claimable', reportStatus(input.artifacts.runtimeImportValidation) === 'PASS' &&
      publicClaimAllowed(input.artifacts.runtimeImport) === false &&
      numberField(input.artifacts.runtimeImportScore, 'sampleCount') >= 1, {
      validationStatus: reportStatus(input.artifacts.runtimeImportValidation),
      publicClaimAllowed: publicClaimAllowed(input.artifacts.runtimeImport),
      sampleCount: numberField(input.artifacts.runtimeImportScore, 'sampleCount'),
      averageSees: numberField(input.artifacts.runtimeImportScore, 'averageSees'),
    }),
    gate('runtime-capture-valid', 'runtime capture command produced accepted evidence and stayed claim-bound', reportStatus(input.artifacts.runtimeCaptureValidation) === 'PASS' &&
      booleanField(input.artifacts.runtimeCapture, 'trajectoryCaptured') === true &&
      numberField(input.artifacts.runtimeCapture, 'exitCode') === 0 &&
      booleanField(input.artifacts.runtimeCapture, 'timedOut') === false &&
      publicClaimAllowed(input.artifacts.runtimeCapture) === false, {
      validationStatus: reportStatus(input.artifacts.runtimeCaptureValidation),
      trajectoryCaptured: booleanField(input.artifacts.runtimeCapture, 'trajectoryCaptured'),
      exitCode: numberField(input.artifacts.runtimeCapture, 'exitCode'),
      timedOut: booleanField(input.artifacts.runtimeCapture, 'timedOut'),
      publicClaimAllowed: publicClaimAllowed(input.artifacts.runtimeCapture),
      averageSees: numberField(input.artifacts.runtimeCaptureScore, 'averageSees'),
    }),
    gate('query-loop-reachability-valid', 'query-loop event stream can be exported as training trajectory', reportStatus(input.artifacts.queryLoopReachabilityValidation) === 'PASS' &&
      booleanField(objectField(input.artifacts.queryLoopReachability, 'probe'), 'requiredEventTypesPresent') === true &&
      publicClaimAllowed(input.artifacts.queryLoopReachability) === false &&
      numberField(input.artifacts.queryLoopReachabilityScore, 'sampleCount') >= 1, {
      validationStatus: reportStatus(input.artifacts.queryLoopReachabilityValidation),
      requiredEventTypesPresent: booleanField(objectField(input.artifacts.queryLoopReachability, 'probe'), 'requiredEventTypesPresent'),
      publicClaimAllowed: publicClaimAllowed(input.artifacts.queryLoopReachability),
      averageSees: numberField(input.artifacts.queryLoopReachabilityScore, 'averageSees'),
    }),
    gate('query-loop-opt-in-capture-valid', 'runQuery opt-in capture writes accepted non-public training evidence', reportStatus(input.artifacts.queryLoopCaptureValidation) === 'PASS' &&
      publicClaimAllowed(input.artifacts.queryLoopCapture) === false &&
      stringField(objectField(input.artifacts.queryLoopCapture, 'capture'), 'mode') === 'env_opt_in' &&
      numberField(input.artifacts.queryLoopCaptureScore, 'sampleCount') >= 1, {
      validationStatus: reportStatus(input.artifacts.queryLoopCaptureValidation),
      captureMode: stringField(objectField(input.artifacts.queryLoopCapture, 'capture'), 'mode'),
      publicClaimAllowed: publicClaimAllowed(input.artifacts.queryLoopCapture),
      averageSees: numberField(input.artifacts.queryLoopCaptureScore, 'averageSees'),
    }),
    gate('claim-boundary-clean', 'synthetic/runtime artifacts cannot be used as public benchmark claims', [
      input.artifacts.ablation,
      input.artifacts.runtimeImport,
      input.artifacts.runtimeCapture,
      input.artifacts.queryLoopReachability,
      input.artifacts.queryLoopCapture,
    ].every(artifact => publicClaimAllowed(artifact) === false), {
      ablationPublicClaimAllowed: publicClaimAllowed(input.artifacts.ablation),
      runtimeImportPublicClaimAllowed: publicClaimAllowed(input.artifacts.runtimeImport),
      runtimeCapturePublicClaimAllowed: publicClaimAllowed(input.artifacts.runtimeCapture),
      queryLoopReachabilityPublicClaimAllowed: publicClaimAllowed(input.artifacts.queryLoopReachability),
      queryLoopCapturePublicClaimAllowed: publicClaimAllowed(input.artifacts.queryLoopCapture),
    }),
  ]

  return {
    schemaVersion: TRAINING_V1_RUNNER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    status: gates.every(item => item.passed) ? 'PASS' : 'FAIL',
    datasetKind: 'training_v1_reality_run',
    publicClaimAllowed: false,
    steps: input.steps,
    gates,
    rule: 'This runner verifies the DSXU training trajectory pipeline as offline/internal evidence only. It does not prove live provider quality, SWE-bench score, or public model superiority.',
  }
}

function gate(
  id: string,
  label: string,
  passed: boolean,
  evidence: Record<string, unknown>,
): TrainingV1RunnerGate {
  return { id, label, passed, evidence }
}

function stepSucceeded(stepsById: Map<string, TrainingV1RunnerStepResult>, id: string): boolean {
  return stepsById.get(id)?.status === 'success'
}

function reportStatus(value: unknown): string | undefined {
  return stringField(value, 'status')
}

function allExpectedMatched(value: unknown): boolean {
  const items = arrayField(value, 'items')
  return items.length > 0 && items.every(item => booleanField(item, 'expectedMatched') === true)
}

function expectedMismatchCount(value: unknown): number {
  return arrayField(value, 'items').filter(item => booleanField(item, 'expectedMatched') !== true).length
}

function publicClaimAllowed(value: unknown): boolean | undefined {
  return booleanField(value, 'publicClaimAllowed')
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

function booleanField(value: unknown, key: string): boolean | undefined {
  const field = objectValue(value)?.[key]
  return typeof field === 'boolean' ? field : undefined
}

function arrayField(value: unknown, key: string): readonly unknown[] {
  const field = objectValue(value)?.[key]
  return Array.isArray(field) ? field : []
}
