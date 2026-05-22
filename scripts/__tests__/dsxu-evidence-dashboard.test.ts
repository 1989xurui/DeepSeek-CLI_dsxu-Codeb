import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { aggregateEvidence } from '../dsxu-evidence-dashboard'

describe('dsxu-evidence-dashboard', () => {
  test('does not promote public comparable manifest-ready status into benchmark PASS', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
      status: 'PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY',
      caseCount: 2,
      cases: [
        { id: 'feature-1', category: 'feature', expectedModel: 'deepseek-v4-flash' },
        { id: 'bugfix-1', category: 'bugfix', expectedModel: 'deepseek-v4-flash' },
      ],
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const written = JSON.parse(await readFile(outputPath, 'utf8'))
    const gate = dashboard.gates.find(item => item.name === 'DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518')
    const readiness = dashboard.publicComparableReadiness[0]

    expect(gate?.status).toBe('INFO')
    expect(dashboard.benchmarkResults).toHaveLength(0)
    expect(dashboard.gateSummary).toMatchObject({ total: 1, pass: 0, fail: 0, blocked: 0, claimBlocked: 0, notRun: 0, info: 1 })
    expect(readiness).toMatchObject({
      status: 'CLAIM_BLOCKED',
      caseCount: 2,
      readyCaseCount: 0,
      missingCaseCount: 2,
      publicBenchmarkClaimAllowed: false,
      externalComparisonClaimAllowed: false,
      nextAction: 'collect-public-comparable-raw-evidence',
    })
    expect(dashboard.workbench).toMatchObject({
      trustState: 'evidence-incomplete',
      releaseClaimAllowed: false,
      publicComparablePendingCount: 1,
    })
    expect(dashboard.releaseTrustPanel).toMatchObject({
      status: 'needs-evidence',
      publicComparableMissingCases: 2,
      mainlineAliasesReady: false,
    })
    expect(written.publicComparableReadiness).toHaveLength(1)
  })

  test('collects final acceptance owner failure attributions without changing score floor', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_V24_SIX_STAGE_FINAL_TESTS_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.v24.six-stage-final-tests.v1',
      status: 'FAIL_V24_SIX_STAGE_FINAL_TESTS',
      failedCommandAttributions: [
        {
          id: 'evaluation-p12-raw-readiness',
          owner: 'Evidence / Evaluation owner',
          rootCause: 'missing-target-reference-raw-input',
          nextAction: 'import a real target-reference manifest',
          timedOut: false,
        },
      ],
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json'), JSON.stringify({
      status: 'PASS',
      scoreFloor: 72,
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const written = JSON.parse(await readFile(outputPath, 'utf8'))

    expect(dashboard.scoreFloor).toBe(72)
    expect(dashboard.gateSummary).toMatchObject({ total: 2, pass: 1, fail: 1, blocked: 0, notRun: 0 })
    expect(dashboard.failureAttributions).toEqual([
      expect.objectContaining({
        source: 'DSXU_V24_SIX_STAGE_FINAL_TESTS_20260518',
        id: 'evaluation-p12-raw-readiness',
        owner: 'Evidence / Evaluation owner',
        rootCause: 'missing-target-reference-raw-input',
        nextAction: 'import a real target-reference manifest',
        timedOut: false,
      }),
    ])
    expect(dashboard.ownerFailureSummary).toEqual([
      expect.objectContaining({
        owner: 'Evidence / Evaluation owner',
        failureCount: 1,
        rootCauses: ['missing-target-reference-raw-input'],
      }),
    ])
    expect(dashboard.workbench).toMatchObject({
      trustState: 'runtime-failing',
      releaseClaimAllowed: false,
      failedOwnerCount: 1,
    })
    expect(dashboard.workbench.actionItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'runtime-failure:Evidence / Evaluation owner',
        priority: 'P0',
        owner: 'Evidence / Evaluation owner',
        reason: 'missing-target-reference-raw-input',
        command: 'bun run test:six-stage-final',
      }),
    ]))
    expect(written.failureAttributions).toHaveLength(1)
  })

  test('uses public comparable raw evidence manifest when it exists without allowing external comparison', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
      status: 'PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY',
      caseCount: 1,
      cases: [{ id: 'feature-1', category: 'feature', expectedModel: 'deepseek-v4-flash' }],
    }), 'utf8')
    await mkdir(join(dir, '.dsxu', 'raw', 'feature-1', 'artifacts'), { recursive: true })
    await writeFile(join(dir, '.dsxu', 'raw', 'feature-1', 'transcript.jsonl'), '{}\n', 'utf8')
    await writeFile(join(dir, '.dsxu', 'raw', 'feature-1', 'tool-trace.jsonl'), '{}\n', 'utf8')
    await writeFile(join(dir, '.dsxu', 'raw', 'feature-1', 'api-response.json'), '{}\n', 'utf8')
    await writeFile(join(dir, '.dsxu', 'raw', 'feature-1', 'final-report.md'), 'pass\n', 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
      source: { collectedAt: '2026-05-18T00:00:00.000Z', acquisitionMethod: 'manual-import' },
      cases: [{
        id: 'feature-1',
        rawTranscriptPath: '.dsxu/raw/feature-1/transcript.jsonl',
        toolTracePath: '.dsxu/raw/feature-1/tool-trace.jsonl',
        rawApiResponsePath: '.dsxu/raw/feature-1/api-response.json',
        finalReportPath: '.dsxu/raw/feature-1/final-report.md',
        artifactDir: '.dsxu/raw/feature-1/artifacts',
        firstAttemptPass: true,
        secondAttemptPass: true,
        finalPass: true,
        costUsd: 0.012,
        wallClockMs: 120000,
        cacheHitRatePct: 72,
        proAdmissionCount: 0,
        failureRecoveryEvents: 1,
        unavailableToolUseCount: 0,
        executionVisibilityBlockedCount: 0,
        noToolUnsupportedClaimCount: 0,
        toolBudgetExceededCount: 0,
        readBudgetExceededCount: 0,
        shellBudgetExceededCount: 0,
        toolResultChars: 8400,
        artifactLogSizeBytes: 2048,
      }],
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const readiness = dashboard.publicComparableReadiness[0]

    expect(readiness).toMatchObject({
      status: 'PASS',
      caseCount: 1,
      readyCaseCount: 1,
      missingCaseCount: 0,
      publicBenchmarkClaimAllowed: true,
      externalComparisonClaimAllowed: false,
    })
    expect(dashboard.workbench).toMatchObject({
      publicComparablePendingCount: 0,
      externalComparisonPendingCount: 1,
    })
    expect(dashboard.workbench.blockingReasons).not.toContain('public-comparable-raw-evidence-incomplete')
    expect(dashboard.workbench.blockingReasons).toContain('external-target-raw-evidence-incomplete')
    expect(dashboard.workbench.actionItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external-comparison-target-raw-evidence',
        owner: 'Evidence / Benchmark / External Comparison',
      }),
    ]))
    expect(dashboard.releaseTrustPanel).toMatchObject({
      publicComparableMissingCases: 0,
      externalComparisonPendingCount: 1,
    })
    expect(dashboard.releaseTrustPanel.dataStillNeeded).not.toContain('public comparable raw evidence for 1 cases')
    expect(dashboard.releaseTrustPanel.dataStillNeeded).toContain('target reference raw evidence for 1 public comparable manifest(s)')
  })

  test('selects the most complete public comparable raw evidence manifest instead of lexicographically newest partial', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
      status: 'PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY',
      caseCount: 2,
      cases: [
        { id: 'feature-1', category: 'feature', expectedModel: 'deepseek-v4-flash' },
        { id: 'feature-2', category: 'feature', expectedModel: 'deepseek-v4-flash' },
      ],
    }), 'utf8')

    for (const id of ['feature-1', 'feature-2']) {
      await mkdir(join(dir, '.dsxu', 'raw', id, 'artifacts'), { recursive: true })
      await writeFile(join(dir, '.dsxu', 'raw', id, 'transcript.jsonl'), '{}\n', 'utf8')
      await writeFile(join(dir, '.dsxu', 'raw', id, 'tool-trace.jsonl'), '{}\n', 'utf8')
      await writeFile(join(dir, '.dsxu', 'raw', id, 'api-response.json'), '{}\n', 'utf8')
      await writeFile(join(dir, '.dsxu', 'raw', id, 'final-report.md'), 'pass\n', 'utf8')
    }

    const rawCase = (id: string) => ({
      id,
      rawTranscriptPath: `.dsxu/raw/${id}/transcript.jsonl`,
      toolTracePath: `.dsxu/raw/${id}/tool-trace.jsonl`,
      rawApiResponsePath: `.dsxu/raw/${id}/api-response.json`,
      finalReportPath: `.dsxu/raw/${id}/final-report.md`,
      artifactDir: `.dsxu/raw/${id}/artifacts`,
      firstAttemptPass: true,
      secondAttemptPass: true,
      finalPass: true,
      costUsd: 0.01,
      wallClockMs: 1000,
      cacheHitRatePct: 70,
      proAdmissionCount: 0,
      failureRecoveryEvents: 0,
      unavailableToolUseCount: 0,
      executionVisibilityBlockedCount: 0,
      noToolUnsupportedClaimCount: 0,
      toolBudgetExceededCount: 0,
      readBudgetExceededCount: 0,
      shellBudgetExceededCount: 0,
      toolResultChars: 100,
      artifactLogSizeBytes: 10,
    })

    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_RERUN99_PARTIAL_20260521.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
      source: { collectedAt: '2026-05-21T23:00:00.000Z', acquisitionMethod: 'manual-import' },
      cases: [rawCase('feature-1')],
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_FULL_30_RERUN51_20260521.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
      source: { collectedAt: '2026-05-21T14:20:00.000Z', acquisitionMethod: 'manual-import' },
      cases: [rawCase('feature-1'), rawCase('feature-2')],
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const readiness = dashboard.publicComparableReadiness[0]

    expect(readiness).toMatchObject({
      status: 'PASS',
      readyCaseCount: 2,
      missingCaseCount: 0,
      publicBenchmarkClaimAllowed: true,
      externalComparisonClaimAllowed: false,
    })
    expect(dashboard.releaseTrustPanel.publicComparableMissingCases).toBe(0)
    expect(dashboard.releaseTrustPanel.externalComparisonPendingCount).toBe(1)
  })

  test('downgrades stale public comparable DSXU lane failures after full raw evidence import passes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })

    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_FULL_30_RERUN51_20260521.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-raw-evidence-import-report.v1',
      status: 'PASS',
      caseCount: 30,
      importedCaseCount: 30,
      readyCaseCount: 30,
      partialCaseCount: 0,
      missingCaseCount: 0,
      publicBenchmarkClaimAllowed: true,
      externalComparisonClaimAllowed: false,
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_DSXU_LANE_RERUN48_REMAINING_16_20260521.json'), JSON.stringify({
      status: 'DELIVERY_PARTIAL',
      passed: 9,
      failed: 7,
      summary: {
        status: 'PARTIAL',
      },
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const staleGate = dashboard.gates.find(item => item.name === 'DSXU_PUBLIC_COMPARABLE_DSXU_LANE_RERUN48_REMAINING_16_20260521')

    expect(staleGate?.status).toBe('INFO')
    expect(dashboard.gateSummary).toMatchObject({ total: 2, pass: 1, fail: 0, blocked: 0, claimBlocked: 0, notRun: 0, info: 1 })
    expect(dashboard.workbench.trustState).not.toBe('release-blocked')
  })

  test('keeps stale public comparable DSXU lane failures blocked until full raw evidence import exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })

    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_DSXU_LANE_RERUN48_REMAINING_16_20260521.json'), JSON.stringify({
      status: 'DELIVERY_PARTIAL',
      passed: 9,
      failed: 7,
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const staleGate = dashboard.gates.find(item => item.name === 'DSXU_PUBLIC_COMPARABLE_DSXU_LANE_RERUN48_REMAINING_16_20260521')

    expect(staleGate?.status).toBe('BLOCKED')
    expect(dashboard.gateSummary).toMatchObject({ total: 1, pass: 0, fail: 0, blocked: 1, claimBlocked: 0, notRun: 0, info: 0 })
    expect(dashboard.workbench.trustState).toBe('release-blocked')
  })

  test('downgrades stale partial public comparable raw import reports after a newer full import passes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })

    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_RERUN47_PARTIAL_20260521.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-raw-evidence-import-report.v1',
      status: 'PARTIAL',
      caseCount: 30,
      readyCaseCount: 14,
      missingCaseCount: 16,
      publicBenchmarkClaimAllowed: false,
      externalComparisonClaimAllowed: false,
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_FULL_30_RERUN51_20260521.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-raw-evidence-import-report.v1',
      status: 'PASS',
      caseCount: 30,
      readyCaseCount: 30,
      missingCaseCount: 0,
      publicBenchmarkClaimAllowed: true,
      externalComparisonClaimAllowed: false,
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const staleGate = dashboard.gates.find(item => item.name === 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_RERUN47_PARTIAL_20260521')
    const currentGate = dashboard.gates.find(item => item.name === 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_FULL_30_RERUN51_20260521')

    expect(staleGate?.status).toBe('INFO')
    expect(currentGate?.status).toBe('PASS')
    expect(dashboard.gateSummary).toMatchObject({ total: 2, pass: 1, fail: 0, blocked: 0, claimBlocked: 0, notRun: 0, info: 1 })
  })

  test('keeps partial public comparable raw import reports claim-blocked without a newer full import pass', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })

    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_RERUN47_PARTIAL_20260521.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-raw-evidence-import-report.v1',
      status: 'PARTIAL',
      caseCount: 30,
      readyCaseCount: 14,
      missingCaseCount: 16,
      publicBenchmarkClaimAllowed: false,
      externalComparisonClaimAllowed: false,
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const staleGate = dashboard.gates.find(item => item.name === 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_RERUN47_PARTIAL_20260521')

    expect(staleGate?.status).toBe('CLAIM_BLOCKED')
    expect(dashboard.gateSummary).toMatchObject({ total: 1, pass: 0, fail: 0, blocked: 0, claimBlocked: 1, notRun: 0, info: 0 })
  })

  test('separates blocked release claims from failing runtime evidence', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_GITHUB_LAUNCH_PACK.json'), JSON.stringify({
      schemaVersion: 'dsxu.github-open-source-launch-pack.v1',
      status: 'BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM',
      public95ClaimAllowed: false,
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)

    expect(dashboard.gates[0]?.status).toBe('CLAIM_BLOCKED')
    expect(dashboard.gateSummary).toMatchObject({ total: 1, pass: 0, fail: 0, blocked: 0, claimBlocked: 1, notRun: 0 })
    expect(dashboard.workbench).toMatchObject({
      trustState: 'evidence-incomplete',
      releaseClaimAllowed: false,
    })
    expect(dashboard.workbench.blockingReasons).toContain('public-claim-boundary-evidence-incomplete')
    expect(dashboard.workbench.actionItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'public-claim-boundary-blocked',
        owner: 'Evidence / Release Claim Binder',
        command: 'bun run release:github-launch-pack',
      }),
    ]))
    expect(dashboard.releaseTrustPanel).toMatchObject({
      status: 'needs-evidence',
      blockedGateNames: [],
      claimBlockedGateNames: ['DSXU_GITHUB_LAUNCH_PACK'],
    })
  })

  test('treats blocked public comparable raw import reports as claim blockers, not runtime blockers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_20260520.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-raw-evidence-import-report.v1',
      status: 'BLOCKED',
      caseCount: 30,
      importedCaseCount: 0,
      missingCaseCount: 30,
      publicBenchmarkClaimAllowed: false,
      externalComparisonClaimAllowed: false,
      nextAction: 'collect-public-comparable-raw-evidence',
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)

    expect(dashboard.gates[0]?.status).toBe('CLAIM_BLOCKED')
    expect(dashboard.gateSummary).toMatchObject({ total: 1, pass: 0, fail: 0, blocked: 0, claimBlocked: 1 })
    expect(dashboard.workbench).toMatchObject({
      trustState: 'evidence-incomplete',
      releaseClaimAllowed: false,
    })
    expect(dashboard.releaseTrustPanel).toMatchObject({
      status: 'needs-evidence',
      blockedGateNames: [],
      claimBlockedGateNames: ['DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_20260520'],
    })
  })

  test('builds an actionable release trust panel from command catalog and gate state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_COMMAND_CATALOG_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.command-catalog.v1',
      status: 'PASS_DSXU_COMMAND_CATALOG_READY',
      scriptCount: 118,
      mainlineAliases: ['evidence:dashboard', 'benchmark:swe-bench', 'health:runtime', 'cache:warm'],
      categorySummary: { 'mainline-validation': 12 },
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
      status: 'PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY',
      caseCount: 1,
      cases: [{ id: 'feature-1', category: 'feature', expectedModel: 'deepseek-v4-flash' }],
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)

    expect(dashboard.commandCatalog).toMatchObject({
      scriptCount: 118,
      mainlineAliases: ['evidence:dashboard', 'benchmark:swe-bench', 'health:runtime', 'cache:warm'],
    })
    expect(dashboard.releaseTrustPanel).toMatchObject({
      status: 'needs-evidence',
      mainlineAliasesReady: true,
      publicComparableMissingCases: 1,
    })
    expect(dashboard.releaseTrustPanel.recommendedCommands).toContain('bun run benchmark:swe-bench -- --mode public-comparable')
  })

  test('surfaces source/test/live/raw/cost/cache coverage in the workbench', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_COMMAND_CATALOG_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.command-catalog.v1',
      status: 'PASS_DSXU_COMMAND_CATALOG_READY',
      scriptCount: 118,
      mainlineAliases: ['evidence:dashboard', 'benchmark:swe-bench', 'health:runtime', 'cache:warm'],
      categorySummary: { 'mainline-validation': 12 },
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_TUI_LIVE_ACCEPTANCE_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.tui-live-acceptance.v1',
      status: 'PASS_TUI_LIVE_ACCEPTANCE',
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
      source: { collectedAt: '2026-05-18T00:00:00.000Z', acquisitionMethod: 'manual-import' },
      cases: [{
        id: 'feature-1',
        rawTranscriptPath: '.dsxu/raw/feature-1/transcript.jsonl',
        toolTracePath: '.dsxu/raw/feature-1/tool-trace.jsonl',
        rawApiResponsePath: '.dsxu/raw/feature-1/api-response.json',
        finalReportPath: '.dsxu/raw/feature-1/final-report.md',
        artifactDir: '.dsxu/raw/feature-1/artifacts',
        firstAttemptPass: true,
        secondAttemptPass: true,
        finalPass: true,
        costUsd: 0.012,
        wallClockMs: 120000,
        cacheHitRatePct: 72,
        proAdmissionCount: 0,
        failureRecoveryEvents: 1,
        toolResultChars: 8400,
        artifactLogSizeBytes: 2048,
      }],
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const written = JSON.parse(await readFile(outputPath, 'utf8'))

    expect(dashboard.evidenceCoverage).toMatchObject({
      sourceTest: { ready: true },
      live: { ready: true },
      raw: { ready: true },
      cost: { ready: true },
      cache: { ready: true },
      missingAreas: [],
    })
    expect(dashboard.releaseTrustPanel.dataStillNeeded.join('\n')).not.toContain('release evidence coverage')
    expect(written.evidenceCoverage.raw.sampleFiles).toHaveLength(1)
  })

  test('surfaces V4 consolidation status without promoting it into a public benchmark claim', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_COMMAND_CATALOG_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.command-catalog.v1',
      status: 'PASS_DSXU_COMMAND_CATALOG_READY',
      scriptCount: 118,
      mainlineAliases: ['evidence:dashboard', 'benchmark:swe-bench', 'health:runtime', 'cache:warm'],
      categorySummary: { 'mainline-validation': 12 },
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_V4_CONSOLIDATION_STATUS_20260518.json'), JSON.stringify({
      schemaVersion: 'dsxu.v4.consolidation-status.v1',
      status: 'PASS_DSXU_V4_CONSOLIDATION_STATUS',
      expectedStages: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
      completedStages: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
      releaseClaimBoundary: 'V4 owner-folded consolidation is engineering evidence, not a public benchmark score claim.',
      stages: [
        { stage: 'P0', status: 'DONE', owner: 'V4 Product Core Guard', evidenceFiles: ['docs/generated/DSXU_V4_FEATURE_OWNER_MAP_20260518.json'] },
        { stage: 'P1', status: 'DONE', owner: 'Provider Plan owner', evidenceFiles: ['src/services/api/deepseek-adapter.ts'] },
        { stage: 'P2', status: 'DONE', owner: 'DeepSeek route/cost/cache owner', evidenceFiles: ['src/dsxu/engine/prompt-prefix-cache-builder.ts'] },
        { stage: 'P3', status: 'DONE', owner: 'Verification Envelope owner', evidenceFiles: ['src/dsxu/engine/post-mutation-verification-envelope.ts'] },
        { stage: 'P4', status: 'DONE', owner: 'Tool Envelope owner', evidenceFiles: ['src/dsxu/engine/tool-protocol.ts'] },
        { stage: 'P5', status: 'DONE', owner: 'Recovery Decision owner', evidenceFiles: ['src/dsxu/engine/progress-ledger.ts'] },
        { stage: 'P6', status: 'DONE', owner: 'Agent Evidence owner', evidenceFiles: ['src/dsxu/engine/agent-mcp-skill-boundary-board.ts'] },
        { stage: 'P7', status: 'DONE', owner: 'Trust UI owner', evidenceFiles: ['src/components/PromptInput/PromptInputFooter.tsx'] },
        { stage: 'P8', status: 'DONE', owner: 'Evidence / Release Claim Binder', evidenceFiles: ['scripts/dsxu-evidence-dashboard.ts'] },
      ],
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)
    const written = JSON.parse(await readFile(outputPath, 'utf8'))

    expect(dashboard.v4Consolidation).toMatchObject({
      status: 'PASS',
      completedStageCount: 9,
      expectedStageCount: 9,
      missingStages: [],
      blockedStages: [],
      releaseClaimBoundary: 'V4 owner-folded consolidation is engineering evidence, not a public benchmark score claim.',
    })
    expect(dashboard.releaseTrustPanel).toMatchObject({
      v4ConsolidationReady: true,
      mainlineAliasesReady: true,
    })
    expect(dashboard.benchmarkResults).toHaveLength(0)
    expect(written.v4Consolidation.stageStatuses).toHaveLength(9)
  })

  test('separates informational manifests from not-run executable gates', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_STATIC_PLAN_20260520.json'), JSON.stringify({
      schemaVersion: 'dsxu.static-plan.v1',
      generatedAt: '2026-05-20T00:00:00.000Z',
      stages: [{ id: 'P0', name: 'plan only' }],
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_SUMMARY_WRAPPED_PASS_20260520.json'), JSON.stringify({
      summary: {
        schemaVersion: 'dsxu.summary-wrapped-pass.v1',
        status: 'PASS_SUMMARY_WRAPPED',
      },
      rows: [],
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)

    expect(dashboard.gates.find(item => item.name === 'DSXU_STATIC_PLAN_20260520')?.status).toBe('INFO')
    expect(dashboard.gates.find(item => item.name === 'DSXU_SUMMARY_WRAPPED_PASS_20260520')?.status).toBe('PASS')
    expect(dashboard.gateSummary).toMatchObject({ total: 2, pass: 1, fail: 0, blocked: 0, notRun: 0, info: 1 })
    expect(dashboard.releaseTrustPanel.dataStillNeeded).not.toContain('not-run evidence cannot be used as GitHub claims')
  })

  test('supersedes old target-raw acceptance blocker when current P12 raw-readiness has passed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-evidence-dashboard-'))
    const evidenceDir = join(dir, 'generated')
    const outputPath = join(evidenceDir, 'dashboard.json')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(join(evidenceDir, 'DSXU_V20_REAL_GAP_ACCEPTANCE_SUMMARY_20260515.json'), JSON.stringify({
      schema: 'dsxu.v20.real-gap-acceptance.v1',
      status: 'FOCUSED_ACCEPTANCE_READY_TARGET_RAW_STILL_EXTERNAL',
    }), 'utf8')
    await writeFile(join(evidenceDir, 'DSXU_P12_RAW_EVIDENCE_READINESS_20260520.json'), JSON.stringify({
      schemaVersion: 'dsxu.p12.raw-readiness-cli.v1',
      status: 'PASS',
      p12Status: 'PASS',
      deferredEvalStatus: 'PASS',
    }), 'utf8')

    const dashboard = await aggregateEvidence(evidenceDir, outputPath)

    expect(dashboard.gates.find(item => item.name === 'DSXU_V20_REAL_GAP_ACCEPTANCE_SUMMARY_20260515')?.status).toBe('INFO')
    expect(dashboard.gates.find(item => item.name === 'DSXU_P12_RAW_EVIDENCE_READINESS_20260520')?.status).toBe('PASS')
    expect(dashboard.gateSummary).toMatchObject({ fail: 0, blocked: 0, claimBlocked: 0, notRun: 0 })
  })
})
