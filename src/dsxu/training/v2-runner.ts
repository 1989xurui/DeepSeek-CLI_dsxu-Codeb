import { buildTrainingAblationReport } from './ablation'
import { buildTrainingV2DatasetManifest } from './dataset-manifest'
import { buildTrainingPreferencePairsReport } from './preference'
import { buildTrainingReplayReport } from './replay'

export const TRAINING_V2_RUNNER_SCHEMA_VERSION = 'dsxu.training-data-flywheel-v2-runner.v1' as const

export interface TrainingV2RunnerGate {
  id: string
  passed: boolean
  evidence: Record<string, unknown>
}

export interface TrainingV2RunnerStage {
  id: string
  name: string
  passed: boolean
  gates: readonly TrainingV2RunnerGate[]
}

export interface TrainingV2RunnerReport {
  schemaVersion: typeof TRAINING_V2_RUNNER_SCHEMA_VERSION
  generatedAt: string
  status: 'PASS_INTERNAL_TRAINING_FLYWHEEL' | 'FAIL_INTERNAL_TRAINING_FLYWHEEL'
  datasetKind: 'internal_synthetic_training_flywheel_v2'
  publicClaimAllowed: false
  stages: readonly TrainingV2RunnerStage[]
  globalHardGates: readonly TrainingV2RunnerGate[]
  artifacts: {
    replay: ReturnType<typeof buildTrainingReplayReport>
    ablation: ReturnType<typeof buildTrainingAblationReport>
    preference: ReturnType<typeof buildTrainingPreferencePairsReport>
    datasetManifest: ReturnType<typeof buildTrainingV2DatasetManifest>
  }
  rule: string
}

export function buildTrainingV2RunnerReport(): TrainingV2RunnerReport {
  const replay = buildTrainingReplayReport('core-300')
  const ablation = buildTrainingAblationReport()
  const preference = buildTrainingPreferencePairsReport({ minPairs: 2000 })
  const datasetManifest = buildTrainingV2DatasetManifest({ trajectoryMin: 980, preferencePairsMin: 2000 })
  const stages: TrainingV2RunnerStage[] = [
    stage('stage-0', 'Freeze New Product Features', [
      gate('allowed-scope-only', true, {
        allowedScopes: ['src/dsxu/training', 'scripts/dsxu-training-*', 'docs/generated', 'docs/training'],
        blockedMainlineRuntimeChange: true,
      }),
    ]),
    stage('stage-1', 'Schema and Exporter', [
      gate('manifest-schema-valid-rate', datasetManifest.metrics.schemaValidRate === 1, {
        schemaValidRate: datasetManifest.metrics.schemaValidRate,
      }),
      gate('no-source-body-storage', datasetManifest.metrics.sourceBodyLeak === 0, {
        sourceBodyLeak: datasetManifest.metrics.sourceBodyLeak,
      }),
    ]),
    stage('stage-2', 'Validator', [
      gate('false-pass-blocked', datasetManifest.metrics.falsePassRate === 0, {
        falsePassRate: datasetManifest.metrics.falsePassRate,
      }),
      gate('stale-edit-blocked', datasetManifest.metrics.staleReadEditBlocked === 1, {
        staleReadEditBlocked: datasetManifest.metrics.staleReadEditBlocked,
      }),
      gate('invalid-tool-call-within-budget', datasetManifest.metrics.invalidToolCallRate <= 0.05, {
        invalidToolCallRate: datasetManifest.metrics.invalidToolCallRate,
      }),
    ]),
    stage('stage-3', 'SEES Scorer', [
      gate('gold-has-no-hard-gate-violations', datasetManifest.qualitySummary.goldHardGateViolationCount === 0, {
        goldHardGateViolationCount: datasetManifest.qualitySummary.goldHardGateViolationCount,
      }),
    ]),
    stage('stage-4', 'Golden Dataset', [
      gate('gold-ratio-at-least-60', datasetManifest.qualitySummary.goldRatio >= 0.6, {
        goldRatio: datasetManifest.qualitySummary.goldRatio,
      }),
    ]),
    stage('stage-5', 'Replay and Ablation', [
      gate('replay-pass', replay.status === 'PASS_INTERNAL_SYNTHETIC_REPLAY', {
        replayStatus: replay.status,
        replaySampleCount: replay.sampleCount,
      }),
      gate('ablation-pass', ablation.status === 'PASS_INTERNAL_SYNTHETIC_REPLAY_BASELINE', {
        ablationStatus: ablation.status,
        finalGroup: ablation.groups.at(-1),
      }),
    ]),
    stage('stage-6', 'V2 Dataset', [
      gate('trajectory-min', datasetManifest.hardGates.trajectoryMin980, {
        trajectoryCount: datasetManifest.trajectoryCount,
      }),
      gate('preference-pair-min', datasetManifest.hardGates.preferencePairsMin2000, {
        preferencePairCount: datasetManifest.preferencePairCount,
      }),
      gate('rejected-reason-coverage', datasetManifest.hardGates.rejectedReasonCoverageAtLeast95, {
        datasetRejectedReasonCoverage: datasetManifest.qualitySummary.rejectedReasonCoverage,
        preferenceRejectedReasonCoverage: preference.rejectedReasonCoverage,
      }),
    ]),
    stage('stage-7', 'Training or Policy Use', [
      gate('policy-use-only-until-real-training', true, {
        priorityOrder: ['router policy', 'few-shot pack', 'runtime validator tuning', 'SFT', 'DPO'],
        sftOrDpoRun: false,
      }),
      gate('public-claim-blocked', datasetManifest.publicClaimAllowed === false && preference.publicClaimAllowed === false, {
        datasetPublicClaimAllowed: datasetManifest.publicClaimAllowed,
        preferencePublicClaimAllowed: preference.publicClaimAllowed,
      }),
    ]),
  ]
  const finalAblation = ablation.groups.at(-1)
  const globalHardGates: TrainingV2RunnerGate[] = [
    gate('schema_valid_rate', datasetManifest.metrics.schemaValidRate === 1, { value: datasetManifest.metrics.schemaValidRate }),
    gate('tool_result_paired', datasetManifest.metrics.toolResultPairedRate === 1, { value: datasetManifest.metrics.toolResultPairedRate }),
    gate('false_pass_rate', datasetManifest.metrics.falsePassRate === 0, { value: datasetManifest.metrics.falsePassRate }),
    gate('false_edit_on_explain', datasetManifest.metrics.falseEditOnExplain === 0, { value: datasetManifest.metrics.falseEditOnExplain }),
    gate('stale_read_edit_blocked', datasetManifest.metrics.staleReadEditBlocked === 1, { value: datasetManifest.metrics.staleReadEditBlocked }),
    gate('localized_feedback_on_failure_min', datasetManifest.metrics.localizedFeedbackOnFailure >= 0.95, { value: datasetManifest.metrics.localizedFeedbackOnFailure }),
    gate('same_failed_action_retry_rate_max', datasetManifest.metrics.sameFailedActionRetryRate <= 0.03, { value: datasetManifest.metrics.sameFailedActionRetryRate }),
    gate('long_task_resume_success_min', (finalAblation?.longTaskResumeSuccess ?? 0) >= 0.9, { value: finalAblation?.longTaskResumeSuccess }),
    gate('agent_parent_false_pass_rate', datasetManifest.metrics.agentParentFalsePassRate === 0, { value: datasetManifest.metrics.agentParentFalsePassRate }),
    gate('public_claim_without_raw_evidence', datasetManifest.metrics.publicClaimWithoutRawEvidence === 0, { value: datasetManifest.metrics.publicClaimWithoutRawEvidence }),
    gate('invalid_tool_call_rate_max', datasetManifest.metrics.invalidToolCallRate <= 0.05, { value: datasetManifest.metrics.invalidToolCallRate }),
    gate('cost_to_verified_completion_max_baseline_multiplier', (finalAblation?.costToVerifiedCompletionMultiplier ?? Number.POSITIVE_INFINITY) <= 1.2, { value: finalAblation?.costToVerifiedCompletionMultiplier }),
    gate('gold_hard_gate_violation', datasetManifest.qualitySummary.goldHardGateViolationCount === 0, { value: datasetManifest.qualitySummary.goldHardGateViolationCount }),
    gate('source_body_leak', datasetManifest.metrics.sourceBodyLeak === 0, { value: datasetManifest.metrics.sourceBodyLeak }),
    gate('secret_leak', datasetManifest.metrics.secretLeak === 0, { value: datasetManifest.metrics.secretLeak }),
  ]
  const passed = stages.every(item => item.passed) && globalHardGates.every(item => item.passed)
  return {
    schemaVersion: TRAINING_V2_RUNNER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    status: passed ? 'PASS_INTERNAL_TRAINING_FLYWHEEL' : 'FAIL_INTERNAL_TRAINING_FLYWHEEL',
    datasetKind: 'internal_synthetic_training_flywheel_v2',
    publicClaimAllowed: false,
    stages,
    globalHardGates,
    artifacts: {
      replay,
      ablation,
      preference,
      datasetManifest,
    },
    rule: 'V2 verifies the internal training data flywheel only. It does not authorize public benchmark, 90% task-completion, or model-superiority claims.',
  }
}

function stage(id: string, name: string, gates: readonly TrainingV2RunnerGate[]): TrainingV2RunnerStage {
  return {
    id,
    name,
    passed: gates.every(gate => gate.passed),
    gates,
  }
}

function gate(id: string, passed: boolean, evidence: Record<string, unknown>): TrainingV2RunnerGate {
  return { id, passed, evidence }
}
