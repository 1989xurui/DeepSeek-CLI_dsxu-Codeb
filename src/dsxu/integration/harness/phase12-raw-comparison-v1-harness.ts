import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildP12RawComparisonKey,
  buildP12RawDeltaReport,
  buildP12RawComparisonReport,
  buildP12TargetReferenceCollectionPack,
  validateP12RawLogManifest,
  type P12RawDeltaReport,
  type P12RawComparisonInput,
  type P12RawComparisonReport,
  type P12RawLogManifestValidation,
  type P12RawTaskLog,
  type P12TargetReferenceCollectionPack,
} from '../../engine/phase12-raw-comparison-v1'
import { runRealTaskReplaySuiteHarness } from './real-task-replay-suite-v1-harness'

export type P12UnpairedTargetReferenceRawLog = {
  comparisonId: string
  taskId: string
  taskPrompt: string
  rawLogPath: string
}

export type P12RawComparisonHarnessResult = P12RawComparisonReport & {
  collectionPack: P12TargetReferenceCollectionPack
  deltaReport: P12RawDeltaReport
  deltaReportPath: string
  evidencePath: string
  tracePath: string
  unpairedTargetReferenceRawLogCount: number
  unpairedTargetReferenceRawLogs: readonly P12UnpairedTargetReferenceRawLog[]
  targetReferenceImport?: P12RawLogManifestValidation
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
}

export async function runP12RawComparisonHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
} = {}): Promise<P12RawComparisonHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'p12-19-raw-comparison-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'phase12-raw-comparison.evidence.json')
  const deltaReportPath = join(evidenceDir, 'phase12-raw-delta-report.evidence.json')
  const tracePath = join(evidenceDir, 'phase12-raw-comparison.trace.json')
  const replay = await runRealTaskReplaySuiteHarness({
    evidenceDir: join(evidenceDir, 'dsxu-real-task-replay'),
  })
  const targetReferenceImport = options.targetReferenceManifestPath
    ? validateP12RawLogManifest(await readJson(options.targetReferenceManifestPath))
    : undefined
  const targetReferenceImportRedlines = targetReferenceImport
    ? [
      ...targetReferenceImport.redlines,
      ...(targetReferenceImport.side !== 'target-reference'
        ? ['targetReferenceManifestPath must import a target-reference manifest']
        : []),
    ]
    : []
  const targetReferenceByKey = new Map(
    (targetReferenceImport?.side === 'target-reference' ? targetReferenceImport.acceptedLogs : []).map(log => [
      buildP12RawComparisonKey(log),
      log,
    ]),
  )

  const inputs: P12RawComparisonInput[] = replay.cases.map((item): P12RawComparisonInput => {
    const dsxu: P12RawTaskLog = {
      comparisonId: `P12-19-${item.id}`,
      taskId: item.id,
      side: 'dsxu',
      taskPrompt: item.target,
      rawLogPath: replay.tracePath,
      artifactPaths: item.artifactPaths,
      outcome: item.status,
      evidence: item.evidence,
      integrity: {
        rawTranscript: true,
        toolTrace: true,
        finalReport: true,
      },
      metrics: {
        elapsedMs: typeof item.metrics.elapsedMs === 'number' ? item.metrics.elapsedMs : null,
        interventionCount: 0,
        toolCallCount: typeof item.metrics.toolCallCount === 'number'
          ? item.metrics.toolCallCount
          : item.artifactPaths.length,
        evidenceCompletenessPct: item.missingEvidence.length === 0 ? 100 : 0,
        costUsd: typeof item.metrics.costPerSolvedUsd === 'number' ? item.metrics.costPerSolvedUsd : null,
        noEvidenceActionCount: item.risks.length,
      },
      risks: item.risks,
    }
    return {
      comparisonId: dsxu.comparisonId,
      taskId: item.id,
      taskPrompt: item.target,
      dsxu,
      targetReference: targetReferenceByKey.get(buildP12RawComparisonKey(dsxu)),
    }
  })

  const pairedInputKeys = new Set(inputs.map(input => buildP12RawComparisonKey(input.dsxu)))
  const unpairedTargetReferenceRawLogs: P12UnpairedTargetReferenceRawLog[] = (
    targetReferenceImport?.side === 'target-reference' ? targetReferenceImport.acceptedLogs : []
  )
    .filter(log => !pairedInputKeys.has(buildP12RawComparisonKey(log)))
    .map(log => ({
      comparisonId: log.comparisonId,
      taskId: log.taskId,
      taskPrompt: log.taskPrompt,
      rawLogPath: log.rawLogPath,
    }))
  const report = buildP12RawComparisonReport(inputs)
  const collectionPack = buildP12TargetReferenceCollectionPack(inputs.map(item => item.dsxu))
  const deltaReport = buildP12RawDeltaReport(report)
  const importBlocked = targetReferenceImport !== undefined && (
    targetReferenceImport.status === 'BLOCKED' || targetReferenceImport.side !== 'target-reference'
  )
  const result: P12RawComparisonHarnessResult = {
    ...report,
    collectionPack,
    status: importBlocked ? 'BLOCKED' : report.status,
    redlines: importBlocked
      ? [...targetReferenceImportRedlines, ...report.redlines]
      : report.redlines,
    nextAction: importBlocked ? 'fix-blocked-raw-integrity' : report.nextAction,
    mustNotClaimComparisonWin: importBlocked ? true : report.mustNotClaimComparisonWin,
    deltaReport: importBlocked
      ? {
        ...deltaReport,
        status: 'BLOCKED',
        mustNotClaimComparisonWin: true,
        redlines: [...targetReferenceImportRedlines, ...deltaReport.redlines],
        nextAction: 'fix-blocked-raw-integrity',
      }
      : deltaReport,
    deltaReportPath,
    evidencePath,
    tracePath,
    unpairedTargetReferenceRawLogCount: unpairedTargetReferenceRawLogs.length,
    unpairedTargetReferenceRawLogs,
    ...(targetReferenceImport ? { targetReferenceImport } : {}),
  }
  await writeJson(tracePath, { replay, targetReferenceImport, report, collectionPack, unpairedTargetReferenceRawLogs, deltaReport: result.deltaReport })
  await writeJson(deltaReportPath, result.deltaReport)
  await writeJson(evidencePath, result)
  return result
}
