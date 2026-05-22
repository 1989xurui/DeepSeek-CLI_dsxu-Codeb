import { existsSync } from 'fs'
import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, test } from 'bun:test'
import {
  buildP12RawComparisonReport,
  buildP12TargetReferenceCollectionPack,
  type P12RawTaskLog,
} from '../phase12-raw-comparison-v1'
import {
  buildRawEvidenceReadinessRegister,
  buildPublicComparableRawEvidenceReadiness,
  DEFERRED_EVAL_RAW_EVIDENCE_SPECS,
  validateDeferredEvalRawLiveManifest,
} from '../raw-evidence-readiness-register-v1'
import { runRawEvidenceReadinessRegisterHarness } from '../../integration/harness/raw-evidence-readiness-register-v1-harness'

function makeLog(options: {
  comparisonId: string
  taskId: string
  side: 'dsxu' | 'target-reference'
}): P12RawTaskLog {
  return {
    comparisonId: options.comparisonId,
    taskId: options.taskId,
    side: options.side,
    taskPrompt: `same task ${options.taskId}`,
    rawLogPath: `.dsxu/trace/raw/${options.comparisonId}-${options.side}.jsonl`,
    artifactPaths: [`.dsxu/trace/raw/${options.comparisonId}-${options.side}.final.json`],
    outcome: 'PASS',
    evidence: {
      baseline: true,
      context: true,
      execution: true,
      recovery: true,
      verification: true,
      cost: true,
      final: true,
    },
    integrity: {
      rawTranscript: true,
      toolTrace: true,
      finalReport: true,
    },
    metrics: {
      elapsedMs: 1000,
      interventionCount: 0,
      toolCallCount: 4,
      evidenceCompletenessPct: 100,
      costUsd: 0.01,
      noEvidenceActionCount: 0,
    },
    risks: [],
  }
}

const p12FamilySlots = [
  ['P12-19-RT-01', 'RT-01'],
  ['P12-19-RT-01-additional-2', 'RT-01-additional-2'],
  ['P12-19-RT-01-additional-3', 'RT-01-additional-3'],
  ['P12-19-RT-02-additional-1', 'RT-02-additional-1'],
  ['P12-19-RT-02-additional-2', 'RT-02-additional-2'],
  ['P12-19-RT-03-additional-1', 'RT-03-additional-1'],
  ['P12-19-RT-03-additional-2', 'RT-03-additional-2'],
  ['P12-19-RT-04', 'RT-04'],
  ['P12-19-RT-04-additional-2', 'RT-04-additional-2'],
  ['P12-19-RT-05-additional-1', 'RT-05-additional-1'],
  ['P12-19-RT-06-additional-1', 'RT-06-additional-1'],
  ['P12-19-RT-07', 'RT-07'],
  ['P12-19-RT-07-additional-2', 'RT-07-additional-2'],
  ['P12-19-RT-08', 'RT-08'],
] as const

function makePairedReport(count: number) {
  return buildP12RawComparisonReport(
    Array.from({ length: count }, (_, index) => {
      const [comparisonId, taskId] = p12FamilySlots[index] ?? [`cmp-${index + 1}`, `task-${index + 1}`]
      return {
        comparisonId,
        taskId,
        taskPrompt: `same task ${taskId}`,
        dsxu: makeLog({ comparisonId, taskId, side: 'dsxu' }),
        targetReference: makeLog({ comparisonId, taskId, side: 'target-reference' }),
      }
    }),
  )
}

describe('OGC-03 - Raw Evidence Readiness Register V1', () => {
  test('keeps public comparable manifest-ready separate from benchmark PASS', () => {
    const readiness = buildPublicComparableRawEvidenceReadiness({
      manifest: {
        schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
        status: 'PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY',
        caseCount: 2,
        cases: [
          { id: 'feature-1', category: 'feature', expectedModel: 'deepseek-v4-flash' },
          { id: 'bugfix-1', category: 'bugfix', expectedModel: 'deepseek-v4-flash' },
        ],
      },
    })

    expect(readiness.status).toBe('BLOCKED')
    expect(readiness.caseCount).toBe(2)
    expect(readiness.rawEvidenceCaseCount).toBe(0)
    expect(readiness.readyCaseCount).toBe(0)
    expect(readiness.missingCaseCount).toBe(2)
    expect(readiness.publicBenchmarkClaimAllowed).toBe(false)
    expect(readiness.externalComparisonClaimAllowed).toBe(false)
    expect(readiness.nextAction).toBe('collect-public-comparable-raw-evidence')
    expect(readiness.safeguards.join('\n')).toContain('manifest PASS only means the fixed task set exists')
  })

  test('requires every raw evidence field before public comparable charts are allowed', () => {
    const readiness = buildPublicComparableRawEvidenceReadiness({
      manifest: {
        schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
        caseCount: 1,
        cases: [{ id: 'review-1', category: 'review', expectedModel: 'deepseek-v4-pro' }],
      },
      rawEvidenceManifest: {
        schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
        cases: [{
          id: 'review-1',
          rawTranscriptPath: '.dsxu/trace/public/review-1.raw.jsonl',
          toolTracePath: '.dsxu/trace/public/review-1.tools.jsonl',
          rawApiResponsePath: '.dsxu/trace/public/review-1.raw-api.json',
          finalReportPath: 'docs/generated/review-1.report.json',
          artifactDir: '.dsxu/trace/public/review-1',
          firstAttemptPass: false,
          finalPass: true,
          costUsd: 0.04,
          wallClockMs: 1000,
          cacheHitRatePct: 70,
          proAdmissionCount: 1,
          failureRecoveryEvents: 1,
          unavailableToolUseCount: 0,
          executionVisibilityBlockedCount: 0,
          noToolUnsupportedClaimCount: 0,
          toolBudgetExceededCount: 0,
          readBudgetExceededCount: 0,
          shellBudgetExceededCount: 0,
          toolResultChars: 1200,
          artifactLogSizeBytes: 4096,
        }],
      },
    })

    expect(readiness.status).toBe('PARTIAL')
    expect(readiness.readyCaseCount).toBe(0)
    expect(readiness.partialCaseCount).toBe(1)
    expect(readiness.cases[0]?.missingFields).toContain('secondAttemptPass')
    expect(readiness.publicBenchmarkClaimAllowed).toBe(false)
    expect(readiness.firstAttemptSuccessRate).toBe(null)
  })

  test('allows public comparable metrics only after every case has raw evidence while keeping external target claim separate', () => {
    const readiness = buildPublicComparableRawEvidenceReadiness({
      manifest: {
        schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
        caseCount: 1,
        cases: [{ id: 'agent-1', category: 'agent', expectedModel: 'deepseek-v4-flash' }],
      },
      rawEvidenceManifest: {
        schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
        cases: [{
          id: 'agent-1',
          rawTranscriptPath: '.dsxu/trace/public/agent-1.raw.jsonl',
          toolTracePath: '.dsxu/trace/public/agent-1.tools.jsonl',
          rawApiResponsePath: '.dsxu/trace/public/agent-1.raw-api.json',
          finalReportPath: 'docs/generated/agent-1.report.json',
          artifactDir: '.dsxu/trace/public/agent-1',
          firstAttemptPass: false,
          secondAttemptPass: true,
          finalPass: true,
          costUsd: 0.02,
          wallClockMs: 2000,
          cacheHitRatePct: 80,
          proAdmissionCount: 0,
          failureRecoveryEvents: [],
          unavailableToolUseCount: 0,
          executionVisibilityBlockedCount: 0,
          noToolUnsupportedClaimCount: 0,
          toolBudgetExceededCount: 0,
          readBudgetExceededCount: 0,
          shellBudgetExceededCount: 0,
          toolResultChars: 1000,
          artifactLogSizeBytes: 2048,
        }],
      },
    })

    expect(readiness.status).toBe('PASS')
    expect(readiness.readyCaseCount).toBe(1)
    expect(readiness.publicBenchmarkClaimAllowed).toBe(true)
    expect(readiness.externalComparisonClaimAllowed).toBe(false)
    expect(readiness.firstAttemptSuccessRate).toBe(0)
    expect(readiness.secondAttemptSuccessRate).toBe(100)
    expect(readiness.finalPassRate).toBe(100)
    expect(readiness.averageCostUsd).toBe(0.02)
    expect(readiness.averageWallClockMs).toBe(2000)
    expect(readiness.averageCacheHitRatePct).toBe(80)
    expect(readiness.proAdmissionCount).toBe(0)
    expect(readiness.nextAction).toBe('collect-target-reference-raw-evidence')
  })

  test('requires public comparable raw evidence paths to exist when artifactRoot is provided', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-public-raw-readiness-'))
    const caseDir = join(root, '.dsxu', 'trace', 'public', 'agent-1')
    await mkdir(caseDir, { recursive: true })
    await Promise.all([
      writeFile(join(root, '.dsxu', 'trace', 'public', 'agent-1.raw.jsonl'), '{}\n', 'utf8'),
      writeFile(join(root, '.dsxu', 'trace', 'public', 'agent-1.tools.jsonl'), '{}\n', 'utf8'),
      writeFile(join(root, '.dsxu', 'trace', 'public', 'agent-1.raw-api.json'), '{}\n', 'utf8'),
      writeFile(join(root, 'agent-1.report.json'), '{}\n', 'utf8'),
    ])
    const readiness = buildPublicComparableRawEvidenceReadiness({
      artifactRoot: root,
      manifest: {
        schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
        caseCount: 2,
        cases: [
          { id: 'agent-1', category: 'agent', expectedModel: 'deepseek-v4-flash' },
          { id: 'agent-2', category: 'agent', expectedModel: 'deepseek-v4-flash' },
        ],
      },
      rawEvidenceManifest: {
        schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
        cases: [
          {
            id: 'agent-1',
            rawTranscriptPath: '.dsxu/trace/public/agent-1.raw.jsonl',
            toolTracePath: '.dsxu/trace/public/agent-1.tools.jsonl',
            rawApiResponsePath: '.dsxu/trace/public/agent-1.raw-api.json',
            finalReportPath: 'agent-1.report.json',
            artifactDir: '.dsxu/trace/public/agent-1',
            firstAttemptPass: true,
            secondAttemptPass: true,
            finalPass: true,
            costUsd: 0.02,
            wallClockMs: 2000,
            cacheHitRatePct: 80,
            proAdmissionCount: 0,
            failureRecoveryEvents: [],
            unavailableToolUseCount: 0,
            executionVisibilityBlockedCount: 0,
            noToolUnsupportedClaimCount: 0,
            toolBudgetExceededCount: 0,
            readBudgetExceededCount: 0,
            shellBudgetExceededCount: 0,
            toolResultChars: 1000,
            artifactLogSizeBytes: 2048,
          },
          {
            id: 'agent-2',
            rawTranscriptPath: '.dsxu/trace/public/missing.raw.jsonl',
            toolTracePath: '.dsxu/trace/public/missing.tools.jsonl',
            rawApiResponsePath: '.dsxu/trace/public/missing.raw-api.json',
            finalReportPath: 'missing.report.json',
            artifactDir: '.dsxu/trace/public/missing',
            firstAttemptPass: true,
            secondAttemptPass: true,
            finalPass: true,
            costUsd: 0.02,
            wallClockMs: 2000,
            cacheHitRatePct: 80,
            proAdmissionCount: 0,
            failureRecoveryEvents: [],
            unavailableToolUseCount: 0,
            executionVisibilityBlockedCount: 0,
            noToolUnsupportedClaimCount: 0,
            toolBudgetExceededCount: 0,
            readBudgetExceededCount: 0,
            shellBudgetExceededCount: 0,
            toolResultChars: 1000,
            artifactLogSizeBytes: 2048,
          },
        ],
      },
    })

    expect(readiness.status).toBe('PARTIAL')
    expect(readiness.readyCaseCount).toBe(1)
    expect(readiness.partialCaseCount).toBe(1)
    expect(readiness.publicBenchmarkClaimAllowed).toBe(false)
    expect(readiness.cases.find(item => item.id === 'agent-2')?.redlines).toContain(
      'public comparable raw evidence path does not exist: rawTranscriptPath',
    )
  })

  test('keeps external comparison blocked when target reference transcript is empty or copied from DSXU raw evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-public-target-reference-'))
    const caseDir = join(root, '.dsxu', 'trace', 'public', 'agent-1')
    await mkdir(join(caseDir, 'artifacts'), { recursive: true })
    await Promise.all([
      writeFile(join(caseDir, 'raw-transcript.jsonl'), '{"side":"dsxu"}\n', 'utf8'),
      writeFile(join(caseDir, 'tool-trace.jsonl'), '{"tool":"Read"}\n', 'utf8'),
      writeFile(join(caseDir, 'raw-api-response.json'), '{"side":"raw-api"}\n', 'utf8'),
      writeFile(join(caseDir, 'final-report.json'), '{"status":"pass"}\n', 'utf8'),
      writeFile(join(caseDir, 'artifacts', 'stdout.log'), 'ok\n', 'utf8'),
      writeFile(join(caseDir, 'empty-target-reference.jsonl'), '   \n', 'utf8'),
      writeFile(join(caseDir, 'copied-target-reference.jsonl'), '{"side":"dsxu"}\n', 'utf8'),
    ])
    const baseRawCase = {
      id: 'agent-1',
      rawTranscriptPath: '.dsxu/trace/public/agent-1/raw-transcript.jsonl',
      toolTracePath: '.dsxu/trace/public/agent-1/tool-trace.jsonl',
      rawApiResponsePath: '.dsxu/trace/public/agent-1/raw-api-response.json',
      finalReportPath: '.dsxu/trace/public/agent-1/final-report.json',
      artifactDir: '.dsxu/trace/public/agent-1/artifacts',
      firstAttemptPass: true,
      secondAttemptPass: true,
      finalPass: true,
      costUsd: 0.02,
      wallClockMs: 2000,
      cacheHitRatePct: 80,
      proAdmissionCount: 0,
      failureRecoveryEvents: [],
      unavailableToolUseCount: 0,
      executionVisibilityBlockedCount: 0,
      noToolUnsupportedClaimCount: 0,
      toolBudgetExceededCount: 0,
      readBudgetExceededCount: 0,
      shellBudgetExceededCount: 0,
      toolResultChars: 1000,
      artifactLogSizeBytes: 2048,
    } as const
    const manifest = {
      schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1' as const,
      caseCount: 1,
      cases: [{ id: 'agent-1', category: 'agent', expectedModel: 'deepseek-v4-flash' }],
    }

    const emptyTarget = buildPublicComparableRawEvidenceReadiness({
      artifactRoot: root,
      manifest,
      rawEvidenceManifest: {
        schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
        cases: [{
          ...baseRawCase,
          targetReferenceTranscriptPath: '.dsxu/trace/public/agent-1/empty-target-reference.jsonl',
        }],
      },
    })
    const copiedTarget = buildPublicComparableRawEvidenceReadiness({
      artifactRoot: root,
      manifest,
      rawEvidenceManifest: {
        schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
        cases: [{
          ...baseRawCase,
          targetReferenceTranscriptPath: '.dsxu/trace/public/agent-1/copied-target-reference.jsonl',
        }],
      },
    })
    const samePathTarget = buildPublicComparableRawEvidenceReadiness({
      artifactRoot: root,
      manifest,
      rawEvidenceManifest: {
        schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
        cases: [{
          ...baseRawCase,
          targetReferenceTranscriptPath: '.dsxu/trace/public/agent-1/raw-transcript.jsonl',
        }],
      },
    })

    expect(emptyTarget.publicBenchmarkClaimAllowed).toBe(true)
    expect(emptyTarget.externalComparisonClaimAllowed).toBe(false)
    expect(emptyTarget.cases[0]?.externalTargetRedlines).toContain(
      'public comparable external target reference transcript is empty: targetReferenceTranscriptPath',
    )
    expect(copiedTarget.externalComparisonClaimAllowed).toBe(false)
    expect(copiedTarget.cases[0]?.externalTargetRedlines).toContain(
      'public comparable external target reference transcript is byte-identical to DSXU raw transcript',
    )
    expect(samePathTarget.externalComparisonClaimAllowed).toBe(false)
    expect(samePathTarget.cases[0]?.externalTargetRedlines).toContain(
      'public comparable external target reference path reuses DSXU raw transcript: targetReferenceTranscriptPath',
    )
  })

  test('requires raw evidence promptHash to match the fixed public comparable manifest when present', () => {
    const readiness = buildPublicComparableRawEvidenceReadiness({
      manifest: {
        schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
        caseCount: 1,
        cases: [{
          id: 'anti-cheat-1',
          category: 'review',
          expectedModel: 'deepseek-v4-flash',
          promptHash: 'fixed-manifest-prompt-hash',
        }],
      },
      rawEvidenceManifest: {
        schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
        cases: [{
          id: 'anti-cheat-1',
          promptHash: 'different-task-prompt-hash',
          rawTranscriptPath: '.dsxu/trace/public/anti-cheat-1.raw.jsonl',
          toolTracePath: '.dsxu/trace/public/anti-cheat-1.tools.jsonl',
          rawApiResponsePath: '.dsxu/trace/public/anti-cheat-1.raw-api.json',
          finalReportPath: 'docs/generated/anti-cheat-1.report.json',
          artifactDir: '.dsxu/trace/public/anti-cheat-1',
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
          toolResultChars: 1000,
          artifactLogSizeBytes: 2048,
        }],
      },
    })

    expect(readiness.status).toBe('PARTIAL')
    expect(readiness.readyCaseCount).toBe(0)
    expect(readiness.publicBenchmarkClaimAllowed).toBe(false)
    expect(readiness.cases[0]?.redlines).toContain('public comparable raw evidence promptHash mismatch')
  })

  test('blocks P12-19 when target-reference paired raw logs are missing', () => {
    const dsxuLog = makeLog({ comparisonId: 'cmp-1', taskId: 'task-1', side: 'dsxu' })
    const report = buildP12RawComparisonReport([{
      comparisonId: dsxuLog.comparisonId,
      taskId: dsxuLog.taskId,
      taskPrompt: dsxuLog.taskPrompt,
      dsxu: dsxuLog,
    }])
    const register = buildRawEvidenceReadinessRegister({
      p12Report: report,
      collectionPack: buildP12TargetReferenceCollectionPack([dsxuLog]),
      deferredEvalSpecs: [],
    })

    expect(register.status).toBe('BLOCKED')
    expect(register.p12Status).toBe('BLOCKED')
    expect(register.p12PairedRawLogCount).toBe(0)
    expect(register.p12CollectionTaskCount).toBe(1)
    expect(register.p12ReplayFamilyGapCount).toBe(14)
    expect(register.p12UnmappedPairedRawLogCount).toBe(0)
    expect(register.p12RequiredAdditionalSameTaskPairCount).toBe(14)
    expect(register.p12CurrentCollectionPackCanReachPass).toBe(false)
    expect(register.p12ExpansionBacklogCount).toBe(14)
    expect(register.p12UnmappedCollectionTaskCount).toBe(1)
    expect(register.p12ReplayFamilyGaps.join(',')).toContain('RT-02:2')
    expect(register.mustNotClaimComparisonWin).toBe(true)
    expect(register.entries.find(entry => entry.id === 'P12-19')?.rawEvidenceState).toBe('missing-target-raw')
    expect(register.blockers.join('\n')).toContain('target reference paired raw logs are missing')
    expect(register.nextAction).toBe('collect-target-reference-raw-logs')
  })

  test('keeps sample-incomplete P12-19 partial rather than claiming PASS', () => {
    const report = makePairedReport(4)
    const register = buildRawEvidenceReadinessRegister({
      p12Report: report,
      collectionPack: buildP12TargetReferenceCollectionPack(report.cases.map(item => makeLog({
        comparisonId: item.comparisonId,
        taskId: item.taskId,
        side: 'dsxu',
      }))),
      deferredEvalSpecs: [],
    })

    expect(register.status).toBe('PARTIAL')
    expect(register.p12Status).toBe('PARTIAL')
    expect(register.p12PairedRawLogCount).toBe(4)
    expect(register.p12CollectionTaskCount).toBe(4)
    expect(register.p12ReplayFamilyGapCount).toBe(10)
    expect(register.p12UnmappedPairedRawLogCount).toBe(0)
    expect(register.p12RequiredAdditionalSameTaskPairCount).toBe(10)
    expect(register.p12ExpansionBacklogCount).toBe(10)
    expect(register.p12UnmappedCollectionTaskCount).toBe(0)
    expect(register.p12ReplayFamilyGaps).toEqual(['RT-02:1', 'RT-03:2', 'RT-04:2', 'RT-05:1', 'RT-06:1', 'RT-07:2', 'RT-08:1'])
    expect(register.entries.find(entry => entry.id === 'P12-19')?.rawEvidenceState).toBe('sample-incomplete')
    expect(register.mustNotClaimComparisonWin).toBe(true)
    expect(register.nextAction).toBe('expand-paired-raw-sample-set')
  })

  test('does not let generic paired raw log quantity satisfy original-side family coverage', () => {
    const report = buildP12RawComparisonReport(
      Array.from({ length: 14 }, (_, index) => {
        const comparisonId = `generic-${index + 1}`
        const taskId = `generic-task-${index + 1}`
        return {
          comparisonId,
          taskId,
          taskPrompt: `same task ${taskId}`,
          dsxu: makeLog({ comparisonId, taskId, side: 'dsxu' }),
          targetReference: makeLog({ comparisonId, taskId, side: 'target-reference' }),
        }
      }),
    )
    const register = buildRawEvidenceReadinessRegister({
      p12Report: report,
      collectionPack: buildP12TargetReferenceCollectionPack(report.cases.map(item => makeLog({
        comparisonId: item.comparisonId,
        taskId: item.taskId,
        side: 'dsxu',
      }))),
      deferredEvalSpecs: [],
    })

    expect(register.status).toBe('PARTIAL')
    expect(register.p12Status).toBe('PARTIAL')
    expect(register.p12PairedRawLogCount).toBe(14)
    expect(register.p12ReplayFamilyGapCount).toBe(14)
    expect(register.p12UnmappedPairedRawLogCount).toBe(14)
    expect(register.entries.find(entry => entry.id === 'P12-19')?.redlines.join('\n')).toContain('outside original-side replay families')
    expect(register.mustNotClaimComparisonWin).toBe(true)
    expect(register.nextAction).toBe('expand-paired-raw-sample-set')
  })

  test('keeps deferred evals waiting for raw live logs without creating benchmark runtimes', () => {
    const report = makePairedReport(14)
    const register = buildRawEvidenceReadinessRegister({
      p12Report: report,
      collectionPack: buildP12TargetReferenceCollectionPack(report.cases.map(item => makeLog({
        comparisonId: item.comparisonId,
        taskId: item.taskId,
        side: 'dsxu',
      }))),
    })

    expect(register.status).toBe('PARTIAL')
    expect(register.p12Status).toBe('PASS')
    expect(register.deferredEvalStatus).toBe('PARTIAL')
    expect(register.deferredEvalCount).toBe(6)
    expect(register.deferredEvalWaitingRawLiveCount).toBe(6)
    expect(register.entries.find(entry => entry.id === 'R05')?.owner).toContain('Tool Lifecycle')
    expect(register.entries.find(entry => entry.id === 'R05')?.requiredAction).toContain('do not create a second tool system')
    expect(register.safeguards.join('\n')).toContain('do not introduce benchmark-only runtime paths')
    expect(register.nextAction).toBe('collect-deferred-eval-raw-live-logs')
  })

  test('closes deferred evals only when raw live manifest covers every existing owner evidence item', () => {
    const report = makePairedReport(14)
    const manifest = validateDeferredEvalRawLiveManifest({
      schemaVersion: 'dsxu.deferred-eval-raw-live-manifest.v1',
      source: {
        collectedAt: '2026-05-13T00:00:00.000Z',
        acquisitionMethod: 'runner-export',
        immutableRawDir: '.dsxu/trace/deferred-eval-raw-live-codex-runner-v1',
      },
      logs: DEFERRED_EVAL_RAW_EVIDENCE_SPECS.map(spec => ({
        id: spec.id,
        owner: spec.owner,
        rawLogPath: `.dsxu/trace/deferred-eval/${spec.id}.raw.jsonl`,
        artifactPaths: [`.dsxu/trace/deferred-eval/${spec.id}.final.json`],
        outcome: 'PARTIAL',
        requiredEvidenceCovered: spec.requiredRawEvidence,
        integrity: {
          rawTranscript: true,
          toolTrace: true,
          finalReport: true,
        },
        metrics: {
          elapsedMs: 1000,
          toolCallCount: 1,
          evidenceCompletenessPct: 100,
          costUsd: null,
        },
        risks: ['raw/live evidence imported without creating benchmark-only runtime'],
      })),
    })
    const register = buildRawEvidenceReadinessRegister({
      p12Report: report,
      collectionPack: buildP12TargetReferenceCollectionPack(report.cases.map(item => makeLog({
        comparisonId: item.comparisonId,
        taskId: item.taskId,
        side: 'dsxu',
      }))),
      deferredEvalRawLiveManifest: manifest,
    })

    expect(register.status).toBe('PASS')
    expect(register.deferredEvalStatus).toBe('PASS')
    expect(register.deferredEvalWaitingRawLiveCount).toBe(0)
    expect(register.entries.filter(entry => entry.lane === 'deferred-eval').every(entry => entry.status === 'PASS')).toBe(true)
    expect(register.nextAction).toBe('ready-for-delta-review')
  })

  test('writes current raw evidence readiness register without fabricating target logs', async () => {
    const evidenceDir = await mkdtemp(join(tmpdir(), 'dsxu-raw-readiness-no-target-'))
    const register = await runRawEvidenceReadinessRegisterHarness({ evidenceDir })

    expect(register.evidencePath).toContain('raw-evidence-readiness-register.evidence.json')
    expect(register.tracePath).toContain('raw-evidence-readiness-register.trace.json')
    expect(register.evidencePath).toContain(evidenceDir)
    expect(register.tracePath).toContain(evidenceDir)
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('BLOCKED')
    expect(register.p12Status).toBe('BLOCKED')
    expect(register.p12PairedRawLogCount).toBe(0)
    expect(register.p12MinimumPairedRawLogsForPass).toBe(14)
    expect(register.p12ReplayFamilyGapCount).toBe(14)
    expect(register.p12UnmappedPairedRawLogCount).toBe(0)
    expect(register.p12CollectionTaskCount).toBe(14)
    expect(register.p12RequiredAdditionalSameTaskPairCount).toBe(0)
    expect(register.p12CurrentCollectionPackCanReachPass).toBe(true)
    expect(register.p12ExpansionBacklogCount).toBe(0)
    expect(register.p12UnmappedCollectionTaskCount).toBe(0)
    expect(register.p12ReplayFamilyGaps).toEqual([])
    expect(register.deferredEvalCount).toBe(DEFERRED_EVAL_RAW_EVIDENCE_SPECS.length)
    expect(register.deferredEvalWaitingRawLiveCount).toBe(0)
    expect(register.deferredEvalStatus).toBe('PASS')
    expect(register.entryCount).toBe(7)
    expect(register.entries.map(entry => entry.id)).toEqual(['P12-19', 'R01', 'R02', 'S02', 'R04', 'R05', 'R06'])
    expect(register.entries.filter(entry => entry.lane === 'deferred-eval').every(entry => entry.status === 'PASS')).toBe(true)
    expect(register.blockers.join('\n')).toContain('target reference paired raw logs are missing')
    expect(register.safeguards.join('\n')).toContain('collection pack task count must not be confused')
    expect(register.mustNotClaimComparisonWin).toBe(true)
    expect(register.nextAction).toBe('collect-target-reference-raw-logs')
  }, 120_000)
})
