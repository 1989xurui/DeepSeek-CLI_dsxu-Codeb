import { describe, expect, it } from 'bun:test'
import { buildTrainingV1RunnerReport, type TrainingV1RunnerStepResult } from '../v1-runner'

const stepIds = [
  'training-tests',
  'dry-run-export',
  'dry-run-validate',
  'dry-run-score',
  'golden-generate',
  'golden-validate',
  'golden-score',
  'replay-generate',
  'replay-validate',
  'replay-score',
  'ablation',
  'runtime-import',
  'runtime-import-validate',
  'runtime-import-score',
  'runtime-capture',
  'runtime-capture-validate',
  'runtime-capture-score',
  'query-loop-reachability',
  'query-loop-reachability-validate',
  'query-loop-reachability-score',
  'query-loop-capture',
  'query-loop-capture-validate',
  'query-loop-capture-score',
] as const

describe('training v1 runner report', () => {
  it('passes only when every command and hard gate passes', () => {
    const report = buildTrainingV1RunnerReport({
      steps: successfulSteps(),
      artifacts: validArtifacts(),
    })

    expect(report.status).toBe('PASS')
    expect(report.publicClaimAllowed).toBe(false)
    expect(report.gates.every(gate => gate.passed)).toBe(true)
  })

  it('fails when runtime capture is claimable or command execution failed', () => {
    const artifacts = validArtifacts()
    artifacts.runtimeCapture = {
      ...artifacts.runtimeCapture as Record<string, unknown>,
      publicClaimAllowed: true,
    }
    const steps = successfulSteps()
    steps[0] = { ...steps[0], status: 'failed', exitCode: 1 }

    const report = buildTrainingV1RunnerReport({ steps, artifacts })

    expect(report.status).toBe('FAIL')
    expect(report.gates.find(gate => gate.id === 'commands-succeeded')?.passed).toBe(false)
    expect(report.gates.find(gate => gate.id === 'claim-boundary-clean')?.passed).toBe(false)
  })
})

function successfulSteps(): TrainingV1RunnerStepResult[] {
  return stepIds.map(id => ({
    id,
    label: id,
    command: ['bun', 'run', id],
    status: 'success',
    exitCode: 0,
    durationMs: 1,
  }))
}

function validArtifacts() {
  const validationItems = (count: number) => Array.from({ length: count }, (_, index) => ({
    path: `item-${index}.json`,
    expectedMatched: true,
    validation: { status: 'accepted' },
  }))
  return {
    dryRunValidation: {
      status: 'PASS',
      sampleCount: 1,
      items: validationItems(1),
    },
    dryRunScore: {
      sampleCount: 1,
      scoredCount: 1,
      averageSees: 80,
    },
    goldenValidation: {
      status: 'PASS',
      sampleCount: 60,
      items: validationItems(60),
    },
    goldenScore: {
      sampleCount: 60,
      expectedScoreMismatchedCount: 0,
      averageSees: 81,
    },
    replayValidation: {
      status: 'PASS',
      sampleCount: 300,
      items: validationItems(300),
    },
    replayScore: {
      sampleCount: 300,
      expectedScoreMismatchedCount: 0,
      averageSees: 83,
    },
    ablation: {
      status: 'PASS_INTERNAL_SYNTHETIC_REPLAY_BASELINE',
      publicClaimAllowed: false,
      replaySampleCount: 300,
    },
    runtimeImport: {
      publicClaimAllowed: false,
    },
    runtimeImportValidation: {
      status: 'PASS',
      sampleCount: 1,
      items: validationItems(1),
    },
    runtimeImportScore: {
      sampleCount: 1,
      averageSees: 65,
    },
    runtimeCapture: {
      publicClaimAllowed: false,
      trajectoryCaptured: true,
      exitCode: 0,
      timedOut: false,
    },
    runtimeCaptureValidation: {
      status: 'PASS',
      sampleCount: 1,
      items: validationItems(1),
    },
    runtimeCaptureScore: {
      sampleCount: 1,
      averageSees: 62,
    },
    queryLoopReachability: {
      publicClaimAllowed: false,
      probe: {
        requiredEventTypesPresent: true,
      },
    },
    queryLoopReachabilityValidation: {
      status: 'PASS',
      sampleCount: 1,
      items: validationItems(1),
    },
    queryLoopReachabilityScore: {
      sampleCount: 1,
      averageSees: 90,
    },
    queryLoopCapture: {
      publicClaimAllowed: false,
      capture: {
        mode: 'env_opt_in',
      },
    },
    queryLoopCaptureValidation: {
      status: 'PASS',
      sampleCount: 1,
      items: validationItems(1),
    },
    queryLoopCaptureScore: {
      sampleCount: 1,
      averageSees: 90,
    },
  }
}
