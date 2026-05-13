import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import {
  buildP12RawComparisonReport,
  buildP12TargetReferenceCollectionPack,
  type P12RawTaskLog,
} from '../phase12-raw-comparison-v1'
import {
  buildRawEvidenceReadinessRegister,
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
    const register = await runRawEvidenceReadinessRegisterHarness()

    expect(register.evidencePath).toContain('raw-evidence-readiness-register.evidence.json')
    expect(register.tracePath).toContain('raw-evidence-readiness-register.trace.json')
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
