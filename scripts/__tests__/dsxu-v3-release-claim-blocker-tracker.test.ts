import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  buildReleaseClaimBlockerTracker,
  writeReleaseClaimBlockerTracker,
} from '../dsxu-v3-release-claim-blocker-tracker'

describe('dsxu-v3-release-claim-blocker-tracker', () => {
  test('projects current raw import target-reference gaps without using stale case dirs', async () => {
    const root = await createRoot()
    await writeFixtureInputs(root)

    const tracker = await buildReleaseClaimBlockerTracker({ root })

    expect(tracker).toMatchObject({
      status: 'READY_RELEASE_CLAIM_BLOCKER_TRACKER',
      dashboard: {
        publicComparableMissingCases: 0,
        externalComparisonPendingCount: 1,
        claimBlockedGateNames: [
          'DSXU_SWE_BENCH_RESULTS_20260520',
          'DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515',
        ],
      },
      p12RawReadiness: {
        status: 'PASS',
        p12Status: 'PASS',
        pairedRawLogCount: 14,
      },
      publicComparableExternalComparison: {
        rawRoot: '.dsxu/trace/public-comparable-raw-evidence',
        missingTargetReferenceCaseCount: 1,
        externalComparisonClaimAllowed: false,
      },
      public95ClaimBoundary: {
        public95ClaimAllowed: false,
        scoreFloor: 72,
      },
    })
    expect(tracker.publicComparableExternalComparison.missingTargetCases[0]).toMatchObject({
      id: 'case-1',
      caseDir: '.dsxu/trace/public-comparable-raw-evidence/case-1',
      missingExternalTargetFields: ['targetReferenceTranscriptPath'],
    })
    expect(tracker.safeguards.join('\n')).toContain('not runtime evidence and not a score source')
  })

  test('writes json and markdown tracker with the same current raw root', async () => {
    const root = await createRoot()
    await writeFixtureInputs(root)

    const tracker = await writeReleaseClaimBlockerTracker({ root })
    const jsonPath = join(root, 'docs', 'generated', 'DSXU_V3_RELEASE_CLAIM_BLOCKER_TRACKER_20260521.json')
    const mdPath = join(root, 'docs', 'DSXU_V3_RELEASE_CLAIM_BLOCKER_TRACKER_20260521_CN.md')

    expect(existsSync(jsonPath)).toBe(true)
    expect(existsSync(mdPath)).toBe(true)
    expect(JSON.parse(await readFile(jsonPath, 'utf8'))).toMatchObject({
      publicComparableExternalComparison: {
        rawRoot: '.dsxu/trace/public-comparable-raw-evidence',
      },
    })
    expect(await readFile(mdPath, 'utf8')).toContain('Current rawRoot: `.dsxu/trace/public-comparable-raw-evidence`')
    expect(tracker.publicComparableExternalComparison.missingTargetReferenceCaseCount).toBe(1)
  })
})

async function createRoot(): Promise<string> {
  const root = join(tmpdir(), `dsxu-release-claim-blocker-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await mkdir(root, { recursive: true })
  return root
}

async function writeFixtureInputs(root: string): Promise<void> {
  await writeJson(join(root, 'docs', 'generated', 'DSXU_EVIDENCE_DASHBOARD_20260521.json'), {
    gateSummary: {
      pass: 158,
      fail: 0,
      blocked: 0,
      claimBlocked: 2,
      info: 144,
    },
    workbench: {
      trustState: 'evidence-incomplete',
    },
    publicComparableMissingCases: 0,
    gates: [
      { name: 'DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515', status: 'CLAIM_BLOCKED' },
      { name: 'DSXU_SWE_BENCH_RESULTS_20260520', status: 'CLAIM_BLOCKED' },
      { name: 'runtime-gate', status: 'PASS' },
    ],
    releaseTrustPanel: {
      externalComparisonPendingCount: 1,
      actionItems: [
        {
          reason: '1 public-comparable manifest(s) have DSXU raw evidence but lack target reference raw evidence',
          nextAction: 'collect target reference raw evidence before external comparison claims',
        },
      ],
    },
  })
  await writeJson(join(root, 'docs', 'generated', 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_20260520.json'), {
    schemaVersion: 'dsxu.public-comparable-raw-evidence-import-report.v1',
    status: 'PASS',
    rawRoot: '.dsxu/trace/public-comparable-raw-evidence',
    rawManifestPath: 'docs/generated/DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_20260518.json',
    caseCount: 1,
    publicBenchmarkClaimAllowed: true,
    externalComparisonClaimAllowed: false,
    externalTargetReadyCount: 0,
    cases: [
      {
        id: 'case-1',
        caseDir: '.dsxu/trace/public-comparable-raw-evidence/case-1',
        missingExternalTargetFields: ['targetReferenceTranscriptPath'],
      },
    ],
  })
  await writeJson(join(root, '.dsxu', 'trace', 'raw-evidence-readiness-register-v1', 'raw-evidence-readiness-register.evidence.json'), {
    status: 'PASS',
    p12Status: 'PASS',
    deferredEvalStatus: 'PASS',
    p12PairedRawLogCount: 14,
    p12MinimumPairedRawLogsForPass: 14,
  })
  await writeJson(join(root, 'docs', 'generated', 'DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.json'), {
    status: 'BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM',
    public95ClaimAllowed: false,
    metrics: {
      scoreFloor: 72,
    },
  })
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
