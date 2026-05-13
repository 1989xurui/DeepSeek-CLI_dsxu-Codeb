import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, test } from 'bun:test'
import {
  buildP12RawComparisonReport,
  buildP12RawDeltaReport,
  buildP12TargetReferenceCollectionPack,
  validateP12RawLogManifest,
  type P12RawComparisonInput,
  type P12RawComparisonSide,
  type P12RawLogManifest,
  type P12RawTaskLog,
} from '../phase12-raw-comparison-v1'
import { runP12RawComparisonHarness } from '../../integration/harness/phase12-raw-comparison-v1-harness'
import { runP12TargetReferenceCollectionHarness } from '../../integration/harness/p12-target-reference-collection-v1-harness'

function makeLog(options: {
  comparisonId?: string
  taskId?: string
  side: P12RawComparisonSide
  taskPrompt?: string
  outcome?: P12RawTaskLog['outcome']
  rawLogPath?: string
  interventionCount?: number
  evidenceCompletenessPct?: number
  costUsd?: number
  noEvidenceActionCount?: number
  risks?: readonly string[]
}): P12RawTaskLog {
  const comparisonId = options.comparisonId ?? 'cmp-1'
  const taskId = options.taskId ?? 'task-1'
  return {
    comparisonId,
    taskId,
    side: options.side,
    taskPrompt: options.taskPrompt ?? 'fix the failing code path and verify it',
    rawLogPath: options.rawLogPath ?? `.dsxu/trace/p12-19/${comparisonId}-${options.side}.jsonl`,
    artifactPaths: [`.dsxu/trace/p12-19/${comparisonId}-${options.side}.final-report.json`],
    outcome: options.outcome ?? 'PASS',
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
      interventionCount: options.interventionCount ?? 0,
      toolCallCount: 5,
      evidenceCompletenessPct: options.evidenceCompletenessPct ?? 100,
      costUsd: options.costUsd ?? 0.01,
      noEvidenceActionCount: options.noEvidenceActionCount ?? 0,
    },
    risks: options.risks ?? [],
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

function makeInput(index: number): P12RawComparisonInput {
  const [comparisonId, taskId] = p12FamilySlots[index - 1] ?? [`cmp-${index}`, `task-${index}`]
  const taskPrompt = `same task ${taskId}`
  return {
    comparisonId,
    taskId,
    taskPrompt,
    dsxu: makeLog({ comparisonId, taskId, taskPrompt, side: 'dsxu' }),
    targetReference: makeLog({ comparisonId, taskId, taskPrompt, side: 'target-reference' }),
  }
}

const replayTargets = [
  ['P12-19-RT-01', 'RT-01', 'baseline fail -> localization -> context pack -> patch repair -> verification -> final report'],
  ['P12-19-RT-01-additional-2', 'RT-01-additional-2', 'discounted total clamp bugfix -> failed baseline -> surgical patch -> focused regression verification -> final report'],
  ['P12-19-RT-01-additional-3', 'RT-01-additional-3', 'cart pricing regression repair -> localized source/test context -> patch repair -> two-test verification -> final report'],
  ['P12-19-RT-02-additional-1', 'RT-02-additional-1', 'implement hasTag normalized tag membership and verify with a new native Bun test'],
  ['P12-19-RT-02-additional-2', 'RT-02-additional-2', 'repair retryDelay behavior after failed verification and verify capped exponential delay with native tests'],
  ['P12-19-RT-03-additional-1', 'RT-03-additional-1', 'review normalizeLimit for a non-style runtime risk, patch the behavior, verify tests, and record review approval'],
  ['P12-19-RT-03-additional-2', 'RT-03-additional-2', 'review stableSlug for a non-style routing risk, patch the behavior, verify tests, and record review approval'],
  ['P12-19-RT-04', 'RT-04', 'shell state -> command plan -> artifact -> timeout/recovery -> verification pack'],
  ['P12-19-RT-04-additional-2', 'RT-04-additional-2', 'terminal reliability replay -> shell state capture -> artifact verification -> timeout guard -> result pack'],
  ['P12-19-RT-05-additional-1', 'RT-05-additional-1', 'dev-server browser proof with HTTP readiness, real screenshot artifact, timeout guard, and final report'],
  ['P12-19-RT-06-additional-1', 'RT-06-additional-1', 'package/build environment diagnosis with vendored tool checks, runtime probes, dependency boundaries, and final report'],
  ['P12-19-RT-07', 'RT-07', 'compact snapshot -> source reread -> edit -> focused verification without premature PASS'],
  ['P12-19-RT-07-additional-2', 'RT-07-additional-2', 'compact recovery replay -> source truth reread -> pending agent preservation -> focused verification -> honest final'],
  ['P12-19-RT-08', 'RT-08', 'worker evidence -> parent final gate -> honest partial handling'],
] as const

function writeTargetManifest(logs: readonly P12RawTaskLog[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsxu-p12-raw-manifest-'))
  const path = join(dir, 'target-reference-manifest.json')
  const manifest: P12RawLogManifest = {
    schemaVersion: 'dsxu.phase12-raw-log-manifest.v1',
    side: 'target-reference',
    source: {
      collectedAt: '2026-05-12T00:00:00.000Z',
      acquisitionMethod: 'manual-import',
      immutableRawDir: '.dsxu/trace/p12-19/target-reference',
    },
    logs,
  }
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return path
}

describe('WP-07 - P12-19 Raw Comparison V1', () => {
  test('keeps P12-19 partial when DSXU replay exists but same-task target reference raw logs are missing', async () => {
    const result = await runP12RawComparisonHarness()

    expect(result.schemaVersion).toBe('dsxu.phase12-raw-comparison.v1')
    expect(result.status).toBe('PARTIAL')
    expect(result.caseCount).toBe(14)
    expect(result.pairedRawLogCount).toBe(0)
    expect(result.mustNotClaimComparisonWin).toBe(true)
    expect(result.nextAction).toBe('collect-target-reference-raw-logs')
    expect(result.redlines.join('\n')).toContain('same-task target reference raw log is missing')
    expect(result.deltaReport.schemaVersion).toBe('dsxu.phase12-raw-delta-report.v1')
    expect(result.deltaReport.summary.missingTargetReferenceRawLogs).toBe(14)
    expect(result.deltaReport.mustNotClaimComparisonWin).toBe(true)
    expect(existsSync(result.deltaReportPath)).toBe(true)
    expect(existsSync(result.evidencePath)).toBe(true)
    expect(existsSync(result.tracePath)).toBe(true)
  }, 120_000)

  test('builds a target reference collection pack without creating paired raw logs', async () => {
    const pack = await runP12TargetReferenceCollectionHarness()

    expect(pack.schemaVersion).toBe('dsxu.p12-target-reference-collection.v1')
    expect(pack.status).toBe('READY_FOR_COLLECTION')
    expect(pack.taskCount).toBe(14)
    expect(pack.pairedRawLogCount).toBe(0)
    expect(pack.currentPackCanReachPass).toBe(true)
    expect(pack.requiredAdditionalSameTaskPairCount).toBe(0)
    expect(pack.unmappedCollectionTaskCount).toBe(0)
    expect(pack.expansionBacklog).toHaveLength(0)
    expect(pack.targetManifestBacklogSlots).toHaveLength(0)
    expect(pack.collectionWorkOrders).toHaveLength(14)
    expect(pack.collectionWorkOrders.filter(order => order.kind === 'existing-dsxu-pair')).toHaveLength(14)
    expect(pack.collectionWorkOrders.filter(order => order.kind === 'expansion-pair-slot')).toHaveLength(0)
    expect(pack.replayFamilyCoverage.map(item => `${item.familyId}:${item.missingPairCount}`)).toEqual([
      'RT-01:0',
      'RT-02:0',
      'RT-03:0',
      'RT-04:0',
      'RT-05:0',
      'RT-06:0',
      'RT-07:0',
      'RT-08:0',
    ])
    expect(pack.collectionWorkOrders[0]).toMatchObject({
      workOrderId: 'P12-19-RT-01:target-reference',
      kind: 'existing-dsxu-pair',
      familyId: 'RT-01',
    })
    expect(pack.collectionWorkOrders[0]?.acceptanceGate.join('\n')).toContain('comparisonId, taskId, and taskPrompt match')
    expect(pack.collectionWorkOrders.find(order => order.workOrderId === 'P12-19-RT-02-additional-1:target-reference')).toMatchObject({
      kind: 'existing-dsxu-pair',
      familyId: 'RT-02',
    })
    expect(pack.mustNotClaimComparisonWin).toBe(true)
    expect(pack.manifestTemplate.logs).toEqual([])
    expect(pack.targetManifestAcceptanceCriteria.join('\n')).toContain('manifest side must be target-reference')
    expect(pack.targetManifestAcceptanceCriteria.join('\n')).toContain('targetManifestBacklogSlots are pair-slot collection requirements only')
    expect(pack.targetManifestAcceptanceCriteria.join('\n')).toContain('collectionWorkOrders are the only accepted intake checklist')
    expect(pack.instructions.join('\n')).toContain('current collection pack has enough task slots')
    expect(pack.instructions.join('\n')).toContain('targetManifestBacklogSlots list the required original-side RT family pair slots')
    expect(pack.instructions.join('\n')).toContain('collectionWorkOrders combine current DSXU pairs and expansion slots')
    expect(pack.tasks.map(task => task.taskId)).toEqual(replayTargets.map(([, taskId]) => taskId))
    expect(pack.tasks.every(task => task.requiredTargetFields.includes('rawLogPath'))).toBe(true)
    expect(existsSync(pack.evidencePath)).toBe(true)
    expect(existsSync(pack.manifestTemplatePath)).toBe(true)
    expect(existsSync(pack.runbookPath)).toBe(true)
    expect(existsSync(pack.tracePath)).toBe(true)

    const template = JSON.parse(readFileSync(pack.manifestTemplatePath, 'utf8'))
    const templateValidation = validateP12RawLogManifest(template)
    const runbook = readFileSync(pack.runbookPath, 'utf8')
    expect(templateValidation.status).toBe('PASS')
    expect(templateValidation.acceptedLogs).toHaveLength(0)
    expect(runbook).toContain('Do not use the template or this runbook as raw comparison evidence.')
    expect(runbook).toContain('Expansion Backlog')
    expect(runbook).toContain('Target Manifest Backlog Slots')
    expect(runbook).toContain('Collection Work Orders')
    expect(runbook).toContain('RT-02-additional-1')
    expect(runbook).toContain('DSXU raw:')
    expect(runbook).toContain('target raw:')
    expect(runbook).toContain('P12-19-RT-01-additional-2:target-reference')
    expect(runbook).toContain('RT-01')
  }, 120_000)

  test('imports target reference raw log manifest and pairs it without pretending the sample set is complete', async () => {
    const manifestPath = writeTargetManifest(replayTargets.map(([comparisonId, taskId, taskPrompt]) => makeLog({
      comparisonId,
      taskId,
      taskPrompt,
      side: 'target-reference',
      costUsd: 0.02,
    })))
    const evidenceDir = mkdtempSync(join(tmpdir(), 'dsxu-p12-raw-with-target-'))
    const result = await runP12RawComparisonHarness({
      evidenceDir,
      targetReferenceManifestPath: manifestPath,
    })

    expect(result.status).toBe('PASS')
    expect(result.targetReferenceImport?.status).toBe('PASS')
    expect(result.caseCount).toBe(14)
    expect(result.pairedRawLogCount).toBe(14)
    expect(result.unpairedTargetReferenceRawLogCount).toBe(0)
    expect(result.replayFamilyGapCount).toBe(0)
    expect(result.nextAction).toBe('ready-for-delta-review')
    expect(result.redlines.join('\n')).not.toContain('same-task target reference raw log is missing')
    expect(result.redlines).toEqual([])
    expect(result.deltaReport.summary.missingTargetReferenceRawLogs).toBe(0)
    expect(result.deltaReport.summary.replayFamilyGapCount).toBe(0)
    expect(result.deltaReport.pairedRawLogCount).toBe(14)
    expect(result.mustNotClaimComparisonWin).toBe(false)
  }, 120_000)

  test('surfaces imported target logs that do not have a matching DSXU pair slot', async () => {
    const manifestPath = writeTargetManifest([
      ...replayTargets.map(([comparisonId, taskId, taskPrompt]) => makeLog({
        comparisonId,
        taskId,
        taskPrompt,
        side: 'target-reference',
        costUsd: 0.02,
      })),
      makeLog({
        comparisonId: 'P12-19-extra-target-only',
        taskId: 'target-only-extra',
        taskPrompt: 'target-only extra log without matching DSXU raw output',
        side: 'target-reference',
        costUsd: 0.02,
      }),
    ])
    const result = await runP12RawComparisonHarness({
      evidenceDir: mkdtempSync(join(tmpdir(), 'dsxu-p12-unpaired-target-')),
      targetReferenceManifestPath: manifestPath,
    })

    expect(result.targetReferenceImport?.status).toBe('PASS')
    expect(result.targetReferenceImport?.acceptedLogs).toHaveLength(15)
    expect(result.pairedRawLogCount).toBe(14)
    expect(result.unpairedTargetReferenceRawLogCount).toBe(1)
    expect(result.unpairedTargetReferenceRawLogs[0]).toMatchObject({
      comparisonId: 'P12-19-extra-target-only',
      taskId: 'target-only-extra',
    })
    expect(result.replayFamilyCoverage.find(item => item.familyId === 'RT-02')?.pairedRawLogCount).toBe(2)
    expect(result.replayFamilyGapCount).toBe(0)
    expect(result.status).toBe('PASS')
    expect(result.mustNotClaimComparisonWin).toBe(false)
  }, 120_000)

  test('blocks malformed target reference manifest before comparison claims are made', () => {
    const validation = validateP12RawLogManifest({
      schemaVersion: 'dsxu.phase12-raw-log-manifest.v1',
      side: 'target-reference',
      source: { collectedAt: '2026-05-12T00:00:00.000Z', acquisitionMethod: 'manual-import' },
      logs: [
        makeLog({ side: 'dsxu' }),
        {
          comparisonId: 'bad',
          taskId: 'bad',
          side: 'target-reference',
          taskPrompt: 'bad task',
          rawLogPath: '',
          artifactPaths: [],
        },
      ],
    })

    expect(validation.status).toBe('BLOCKED')
    expect(validation.acceptedLogs).toHaveLength(0)
    expect(validation.rejectedLogs).toHaveLength(2)
    expect(validation.redlines.join('\n')).toContain('does not match manifest side')
    expect(validation.redlines.join('\n')).toContain('missing rawLogPath')
  })

  test('blocks target import when source placeholders or the wrong manifest side are used', async () => {
    const placeholderValidation = validateP12RawLogManifest({
      schemaVersion: 'dsxu.phase12-raw-log-manifest.v1',
      side: 'target-reference',
      source: {
        collectedAt: '<fill-after-run>',
        acquisitionMethod: 'manual-import',
        immutableRawDir: '<fill-raw-log-directory>',
      },
      logs: [makeLog({ side: 'target-reference' })],
    })

    expect(placeholderValidation.status).toBe('BLOCKED')
    expect(placeholderValidation.redlines.join('\n')).toContain('source.collectedAt must be filled')
    expect(placeholderValidation.redlines.join('\n')).toContain('source.immutableRawDir must point')

    const wrongSidePath = writeTargetManifest([makeLog({
      comparisonId: 'P12-19-RT-01',
      taskId: 'RT-01',
      taskPrompt: replayTargets[0][2],
      side: 'dsxu',
    })])
    const wrongSideManifest = JSON.parse(readFileSync(wrongSidePath, 'utf8'))
    wrongSideManifest.side = 'dsxu'
    wrongSideManifest.logs = wrongSideManifest.logs.map((log: P12RawTaskLog) => ({ ...log, side: 'dsxu' }))
    writeFileSync(wrongSidePath, `${JSON.stringify(wrongSideManifest, null, 2)}\n`, 'utf8')
    const result = await runP12RawComparisonHarness({
      evidenceDir: mkdtempSync(join(tmpdir(), 'dsxu-p12-wrong-side-')),
      targetReferenceManifestPath: wrongSidePath,
    })

    expect(result.status).toBe('BLOCKED')
    expect(result.redlines.join('\n')).toContain('targetReferenceManifestPath must import a target-reference manifest')
    expect(result.mustNotClaimComparisonWin).toBe(true)
  }, 120_000)

  test('blocks dry-plan or no-evidence material from being ranked as raw comparison', () => {
    const input = makeInput(1)
    const report = buildP12RawComparisonReport([
      {
        ...input,
        dsxu: makeLog({
          comparisonId: input.comparisonId,
          taskId: input.taskId,
          taskPrompt: input.taskPrompt,
          side: 'dsxu',
          rawLogPath: 'dry plan only',
          noEvidenceActionCount: 1,
          risks: ['dry plan as ranking evidence'],
        }),
      },
    ], { minimumPairedRawLogsForPass: 1 })

    expect(report.status).toBe('BLOCKED')
    expect(report.nextAction).toBe('fix-blocked-raw-integrity')
    expect(report.redlines.join('\n')).toContain('dry plan cannot be used as raw comparison evidence')
    expect(report.redlines.join('\n')).toContain('contains no-evidence actions')
  })

  test('does not pass with 14 generic paired logs that do not cover original-side families', () => {
    const report = buildP12RawComparisonReport(
      Array.from({ length: 14 }, (_, index) => {
        const comparisonId = `generic-${index + 1}`
        const taskId = `generic-task-${index + 1}`
        const taskPrompt = `generic same task ${index + 1}`
        return {
          comparisonId,
          taskId,
          taskPrompt,
          dsxu: makeLog({ comparisonId, taskId, taskPrompt, side: 'dsxu' }),
          targetReference: makeLog({ comparisonId, taskId, taskPrompt, side: 'target-reference' }),
        }
      }),
    )

    expect(report.status).toBe('PARTIAL')
    expect(report.pairedRawLogCount).toBe(14)
    expect(report.unmappedPairedRawLogCount).toBe(14)
    expect(report.replayFamilyGapCount).toBe(14)
    expect(report.nextAction).toBe('expand-sample-set')
    expect(report.mustNotClaimComparisonWin).toBe(true)
    expect(report.redlines.join('\n')).toContain('RT-01: needs 3 additional paired target-reference raw log')
  })

  test('passes only when the required original-side family paired raw sample set is complete and gap-free', () => {
    const report = buildP12RawComparisonReport(
      Array.from({ length: 14 }, (_, index) => makeInput(index + 1)),
    )

    expect(report.status).toBe('PASS')
    expect(report.caseCount).toBe(14)
    expect(report.pairedRawLogCount).toBe(14)
    expect(report.unmappedPairedRawLogCount).toBe(0)
    expect(report.replayFamilyGapCount).toBe(0)
    expect(report.replayFamilyCoverage.every(item => item.missingPairCount === 0)).toBe(true)
    expect(report.mustNotClaimComparisonWin).toBe(false)
    expect(report.nextAction).toBe('ready-for-delta-review')
    expect(report.redlines).toEqual([])

    const delta = buildP12RawDeltaReport(report)
    expect(delta.status).toBe('PASS')
    expect(delta.summary.criticalFindings).toBe(0)
    expect(delta.summary.missingTargetReferenceRawLogs).toBe(0)
    expect(delta.summary.replayFamilyGapCount).toBe(0)
    expect(delta.summary.unmappedPairedRawLogs).toBe(0)
    expect(delta.nextAction).toBe('ready-for-delta-review')
  })

  test('collection pack templates are not valid imported raw-log evidence by themselves', () => {
    const pack = buildP12TargetReferenceCollectionPack([
      makeLog({
        comparisonId: 'P12-19-RT-01',
        taskId: 'RT-01',
        taskPrompt: 'same task',
        side: 'dsxu',
      }),
    ])
    const validation = validateP12RawLogManifest(pack.manifestTemplate)

    expect(pack.pairedRawLogCount).toBe(0)
    expect(pack.currentPackCanReachPass).toBe(false)
    expect(pack.requiredAdditionalSameTaskPairCount).toBe(13)
    expect(pack.unmappedCollectionTaskCount).toBe(0)
    expect(pack.expansionBacklog).toHaveLength(13)
    expect(pack.targetManifestBacklogSlots).toHaveLength(13)
    expect(pack.collectionWorkOrders).toHaveLength(14)
    expect(pack.collectionWorkOrders.filter(order => order.kind === 'existing-dsxu-pair')).toHaveLength(1)
    expect(pack.collectionWorkOrders.filter(order => order.kind === 'expansion-pair-slot')).toHaveLength(13)
    expect(validation.status).toBe('PASS')
    expect(validation.acceptedLogs).toHaveLength(0)
  })

  test('keeps an honest gap when target reference solves more of the same task', () => {
    const input = makeInput(1)
    const report = buildP12RawComparisonReport([
      {
        ...input,
        dsxu: makeLog({
          comparisonId: input.comparisonId,
          taskId: input.taskId,
          taskPrompt: input.taskPrompt,
          side: 'dsxu',
          outcome: 'PARTIAL',
        }),
      },
    ], { minimumPairedRawLogsForPass: 1 })

    expect(report.status).toBe('PARTIAL')
    expect(report.mustNotClaimComparisonWin).toBe(true)
    expect(report.redlines.join('\n')).toContain('target reference solved more of the task than DSXU')
  })
})
