import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildP12TargetReferenceCollectionPack,
  type P12RawTaskLog,
  type P12TargetReferenceCollectionPack,
} from '../../engine/phase12-raw-comparison-v1'
import { runRealTaskReplaySuiteHarness } from './real-task-replay-suite-v1-harness'

export type P12TargetReferenceCollectionHarnessResult = P12TargetReferenceCollectionPack & {
  evidencePath: string
  manifestTemplatePath: string
  runbookPath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function buildRunbook(pack: P12TargetReferenceCollectionPack): string {
  const taskLines = pack.tasks.map(task => [
    `## ${task.taskId}`,
    '',
    `comparisonId: \`${task.comparisonId}\``,
    '',
    `taskPrompt: \`${task.taskPrompt}\``,
    '',
    `DSXU raw log: \`${task.dsxuRawLogPath}\``,
    '',
    'Required target fields:',
    ...task.requiredTargetFields.map(field => `- \`${field}\``),
    '',
  ].join('\n'))

  return [
    '# P12-19 Target Reference Raw Log Collection Runbook',
    '',
    'This runbook turns the DSXU replay cases into same-task target reference collection work.',
    'Do not use the template or this runbook as raw comparison evidence.',
    'P12-19 remains PARTIAL until real target reference logs are collected, imported, paired, and gap-free.',
    '',
    '## Collection Rules',
    '',
    '- Run each taskPrompt under the target reference condition.',
    '- Preserve raw transcript, tool trace, final report, artifacts, metrics, and risks before judging the outcome.',
    '- Fill `target-reference-manifest.template.json` only with real run outputs.',
    '- Import the completed manifest through `targetReferenceManifestPath`.',
    `- A PASS claim requires at least ${pack.minimumPairedRawLogsForPass} paired raw logs plus no critical gap.`,
    '',
    '## Output Files',
    '',
    '- `target-reference-collection-pack.evidence.json`: collection contract and current DSXU-side tasks.',
    '- `target-reference-manifest.template.json`: empty manifest scaffold; not evidence until filled with real logs.',
    '- `target-reference-runbook.md`: this operator checklist.',
    '',
    '## Expansion Backlog',
    '',
    ...pack.expansionBacklog.flatMap(task => [
      `- \`${task.slotId}\` (${task.familyId}): ${task.requiredScenario}`,
      `  - existing owner: ${task.mustUseExistingOwner}`,
      `  - required evidence: ${task.requiredEvidence.join(', ')}`,
    ]),
    ...(pack.expansionBacklog.length === 0
      ? ['- No additional same-task slots are required for the minimum paired sample threshold.']
      : []),
    '',
    '## Target Manifest Backlog Slots',
    '',
    ...pack.targetManifestBacklogSlots.flatMap(task => [
      `- \`${task.slotId}\` (${task.familyId})`,
      `  - DSXU pair requirement: ${task.dsxuPairRequirement}`,
      `  - manifest log requirement: ${task.manifestLogRequirement}`,
      `  - task id requirement: ${task.taskIdRequirement}`,
      `  - comparison id requirement: ${task.comparisonIdRequirement}`,
    ]),
    ...(pack.targetManifestBacklogSlots.length === 0
      ? ['- No target manifest backlog slots remain.']
      : []),
    '',
    '## Collection Work Orders',
    '',
    ...pack.collectionWorkOrders.flatMap(order => [
      `- \`${order.workOrderId}\` (${order.kind})`,
      `  - family: ${order.familyId ?? 'unmapped'}`,
      `  - owner: ${order.mustUseExistingOwner}`,
      `  - comparison: ${order.comparisonIdRequirement}`,
      `  - task: ${order.taskIdRequirement}`,
      `  - prompt: ${order.taskPromptRequirement}`,
      `  - DSXU raw: ${order.dsxuRawOutputRequirement}`,
      `  - target raw: ${order.targetReferenceRawOutputRequirement}`,
      `  - evidence: ${order.requiredEvidence.join(', ')}`,
      `  - gate: ${order.acceptanceGate.join('; ')}`,
    ]),
    ...(pack.collectionWorkOrders.length === 0
      ? ['- No collection work orders remain.']
      : []),
    '',
    '## Tasks',
    '',
    ...taskLines,
  ].join('\n')
}

export async function runP12TargetReferenceCollectionHarness(options: {
  evidenceDir?: string
} = {}): Promise<P12TargetReferenceCollectionHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'p12-target-reference-collection-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'target-reference-collection-pack.evidence.json')
  const manifestTemplatePath = join(evidenceDir, 'target-reference-manifest.template.json')
  const runbookPath = join(evidenceDir, 'target-reference-runbook.md')
  const tracePath = join(evidenceDir, 'target-reference-collection-pack.trace.json')
  const replay = await runRealTaskReplaySuiteHarness({
    evidenceDir: join(evidenceDir, 'dsxu-real-task-replay'),
  })
  const dsxuLogs: P12RawTaskLog[] = replay.cases.map(item => ({
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
  }))
  const pack = buildP12TargetReferenceCollectionPack(dsxuLogs)
  const result: P12TargetReferenceCollectionHarnessResult = {
    ...pack,
    evidencePath,
    manifestTemplatePath,
    runbookPath,
    tracePath,
  }

  await writeJson(tracePath, { replay, dsxuLogs, pack })
  await writeJson(evidencePath, result)
  await writeJson(manifestTemplatePath, pack.manifestTemplate)
  await writeFile(runbookPath, buildRunbook(pack), 'utf8')
  return result
}
