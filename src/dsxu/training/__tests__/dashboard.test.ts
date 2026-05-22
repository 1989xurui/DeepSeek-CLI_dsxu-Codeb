import { describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildTrainingEvidenceDashboard,
  buildTrainingEvidenceDashboardFromFiles,
  type TrainingEvidenceDashboardPaths,
} from '../dashboard'

const paths: TrainingEvidenceDashboardPaths = {
  v1Run: 'v1.json',
  replayValidation: 'replay-validation.json',
  replayScore: 'replay-score.json',
  ablation: 'ablation.json',
  queryLoopReachability: 'query-loop-reachability.json',
  queryLoopReachabilityScore: 'query-loop-reachability-score.json',
  queryLoopCapture: 'query-loop-capture.json',
  queryLoopCaptureScore: 'query-loop-capture-score.json',
  liveProviderCapture: 'live-provider.json',
  liveProviderValidation: 'live-provider-validation.json',
  liveProviderScore: 'live-provider-score.json',
}

describe('DSXU training evidence dashboard', () => {
  test('allows only internal evidence claims and blocks public benchmark claims', () => {
    const dashboard = buildTrainingEvidenceDashboard({
      paths,
      artifacts: passingArtifacts(),
    })

    expect(dashboard.summary).toMatchObject({
      offlineV1Status: 'PASS',
      replaySampleCount: 300,
      queryLoopReachability: true,
      queryLoopCapture: true,
      liveProviderStatus: 'PASS_LIVE_PROVIDER_CAPTURE',
      liveProviderRecordCount: 4,
      publicBenchmarkEvidencePresent: false,
      superiorityEvidencePresent: false,
    })
    expect(gateStatus(dashboard, 'offline-training-pipeline')).toBe('allowed-internal')
    expect(gateStatus(dashboard, 'internal-replay-calibration')).toBe('allowed-internal')
    expect(gateStatus(dashboard, 'query-loop-training-reachability')).toBe('allowed-internal')
    expect(gateStatus(dashboard, 'live-provider-smoke')).toBe('allowed-internal')
    expect(gateStatus(dashboard, 'public-benchmark-claim')).toBe('blocked')
    expect(gateStatus(dashboard, 'superiority-claim')).toBe('blocked')
    expect(dashboard.publicClaimAllowed).toBe(false)
    expect(dashboard.evidenceCompletenessScore).toBe(67)
  })

  test('marks live provider smoke as missing when no key artifact was produced', () => {
    const artifacts = passingArtifacts()
    artifacts.liveProviderCapture = {
      status: 'SKIPPED_NO_API_KEY',
      publicClaimAllowed: false,
      liveProviderClaimAllowed: false,
    }
    artifacts.liveProviderValidation = undefined
    artifacts.liveProviderScore = undefined

    const dashboard = buildTrainingEvidenceDashboard({ paths, artifacts })

    expect(gateStatus(dashboard, 'live-provider-smoke')).toBe('missing-evidence')
    expect(dashboard.missingEvidence).toContain('live-provider-smoke')
    expect(dashboard.publicClaimAllowed).toBe(false)
  })

  test('blocks internal replay claim when expected labels do not match', () => {
    const artifacts = passingArtifacts()
    artifacts.replayValidation = {
      status: 'PASS',
      sampleCount: 300,
      items: [{ expectedMatched: false }],
    }

    const dashboard = buildTrainingEvidenceDashboard({ paths, artifacts })

    expect(gateStatus(dashboard, 'internal-replay-calibration')).toBe('blocked')
    expect(dashboard.missingEvidence).toContain('internal-replay-calibration')
  })

  test('loads dashboard inputs from files and records parse state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-training-dashboard-'))
    const outputPath = join(dir, 'dashboard.json')
    const filePaths = Object.fromEntries(
      Object.keys(paths).map(key => [key, join(dir, paths[key as keyof TrainingEvidenceDashboardPaths])]),
    ) as unknown as TrainingEvidenceDashboardPaths
    for (const [key, artifact] of Object.entries(passingArtifacts())) {
      await writeFile(filePaths[key as keyof TrainingEvidenceDashboardPaths], `${JSON.stringify(artifact)}\n`, 'utf8')
    }

    const dashboard = await buildTrainingEvidenceDashboardFromFiles({
      paths: filePaths,
      outputPath,
    })

    expect(dashboard.inputs.v1Run.present).toBe(true)
    expect(dashboard.inputs.liveProviderCapture.present).toBe(true)
    expect(gateStatus(dashboard, 'live-provider-smoke')).toBe('allowed-internal')
  })
})

function passingArtifacts(): Partial<Record<keyof TrainingEvidenceDashboardPaths, unknown>> {
  return {
    v1Run: {
      status: 'PASS',
      publicClaimAllowed: false,
    },
    replayValidation: {
      status: 'PASS',
      sampleCount: 300,
      items: [{ expectedMatched: true }, { expectedMatched: true }],
    },
    replayScore: {
      sampleCount: 300,
      expectedScoreMismatchedCount: 0,
    },
    ablation: {
      status: 'PASS_INTERNAL_SYNTHETIC_REPLAY_BASELINE',
      publicClaimAllowed: false,
    },
    queryLoopReachability: {
      publicClaimAllowed: false,
      probe: {
        requiredEventTypesPresent: true,
      },
    },
    queryLoopReachabilityScore: {
      sampleCount: 1,
    },
    queryLoopCapture: {
      publicClaimAllowed: false,
      capture: {
        mode: 'env_opt_in',
      },
    },
    queryLoopCaptureScore: {
      sampleCount: 1,
    },
    liveProviderCapture: {
      status: 'PASS_LIVE_PROVIDER_CAPTURE',
      publicClaimAllowed: false,
      liveProviderClaimAllowed: false,
      import: {
        summary: {
          recordCount: 4,
        },
      },
    },
    liveProviderValidation: {
      status: 'PASS',
    },
    liveProviderScore: {
      sampleCount: 1,
    },
  }
}

function gateStatus(
  dashboard: ReturnType<typeof buildTrainingEvidenceDashboard>,
  id: string,
): string | undefined {
  return dashboard.claimGates.find(gate => gate.id === id)?.status
}
