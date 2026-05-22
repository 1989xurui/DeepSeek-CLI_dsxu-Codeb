import { mkdir, writeFile } from 'fs/promises'
import { dirname } from 'path'
import {
  resolveDSXUAgentOrchestration,
  type DSXUAgentOrchestrationPlan,
  type DSXUAgentWorkItem,
} from '../../engine/agent-role-router-v1'
import type {
  DsxuLiveReportCaseLike,
  DsxuLiveReportLike,
} from '../../engine/experience-live-report-ingest'
import { runAgentParentFinalGateReplay } from './agent-parent-final-gate-replay-v1-harness'

export type DsxuAgentLiveReportReplayResult = {
  status: 'DONE_EVIDENCED' | 'PARTIAL'
  reportPath: string
  evidencePath: string
  serialPlan: DSXUAgentOrchestrationPlan
  parallelPlan: DSXUAgentOrchestrationPlan
  parentFinalGateOk: boolean
  summary: {
    visibleModes: readonly string[]
    runtimePlacements: readonly string[]
    serialCaseId: string
    parallelCaseIds: readonly string[]
    parallelWorkers: number
    parentFinalGateCaseCount: number
  }
  warnings: readonly string[]
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

function extractPromptFileReferences(prompt: string | undefined): string[] {
  return unique(prompt?.match(/\b(?:src|test|tests|lib|app)\/[A-Za-z0-9_.\/-]+\b/g) ?? [])
}

function workItemForCase(item: DsxuLiveReportCaseLike): DSXUAgentWorkItem {
  const promptFiles = extractPromptFileReferences(item.prompt)
  const ownedFiles = promptFiles.length > 0
    ? promptFiles
    : item.fixturePath
      ? [item.fixturePath]
      : []
  const hasEdit = (item.metrics?.successfulEditCalls ?? 0) > 0
  return {
    taskId: `agent-${item.id}`,
    objective: [
      `Replay ${item.category ?? 'coding'} task evidence from ${item.id}.`,
      `status=${item.status ?? 'unknown'}`,
      `policyPassed=${item.policyPassed === true}`,
      `toolCalls=${item.metrics?.toolCalls ?? 0}`,
      'Return concrete file/command evidence only.',
    ].join(' '),
    readOnly: !hasEdit,
    ownedFiles,
    role: hasEdit ? 'implementer' : 'researcher',
  }
}

function findCase(report: DsxuLiveReportLike, caseId: string): DsxuLiveReportCaseLike {
  const item = report.cases?.find(candidate => candidate.id === caseId)
  if (!item) {
    throw new Error(`Missing live report case: ${caseId}`)
  }
  return item
}

export async function runV18AgentLiveReportReplayHarness(input: {
  report: DsxuLiveReportLike
  reportPath: string
  evidencePath: string
  serialCaseId: string
  parallelCaseIds: readonly string[]
}): Promise<DsxuAgentLiveReportReplayResult> {
  const serialCase = findCase(input.report, input.serialCaseId)
  const parallelCases = input.parallelCaseIds.map(caseId => findCase(input.report, caseId))
  const serialPlan = resolveDSXUAgentOrchestration({
    taskText: 'continue one worker and preserve parent ownership',
    requestedMode: 'serial_worker',
    workItems: [workItemForCase(serialCase)],
  })
  const parallelPlan = resolveDSXUAgentOrchestration({
    taskText: 'fan out independent live report tasks with owned write scopes',
    requestedMode: 'parallel_fanout',
    maxParallel: 4,
    workItems: parallelCases.map(workItemForCase),
  })
  const parentFinalReplay = await runAgentParentFinalGateReplay({
    evidenceDir: dirname(input.evidencePath),
  })
  const warnings: string[] = []
  if (serialPlan.visibleMode !== 'serial_worker') warnings.push('serial-plan-not-serial-worker')
  if (parallelPlan.visibleMode !== 'parallel_fanout') warnings.push('parallel-plan-not-parallel-fanout')
  if (serialPlan.evidence.visibleModes.length !== 2 || parallelPlan.evidence.visibleModes.length !== 2) {
    warnings.push('visible-mode-count-drift')
  }
  if (!parentFinalReplay.ok) warnings.push('parent-final-gate-replay-failed')

  const status =
    warnings.length === 0 &&
    parentFinalReplay.ok &&
    serialPlan.visibleMode === 'serial_worker' &&
    parallelPlan.visibleMode === 'parallel_fanout' &&
    parallelPlan.evidence.runtimePlacementsAreNotPlanningModes
      ? 'DONE_EVIDENCED'
      : 'PARTIAL'

  const result: DsxuAgentLiveReportReplayResult = {
    status,
    reportPath: input.reportPath,
    evidencePath: input.evidencePath,
    serialPlan,
    parallelPlan,
    parentFinalGateOk: parentFinalReplay.ok,
    summary: {
      visibleModes: parallelPlan.evidence.visibleModes,
      runtimePlacements: parallelPlan.runtimePlacements,
      serialCaseId: input.serialCaseId,
      parallelCaseIds: input.parallelCaseIds,
      parallelWorkers: parallelPlan.maxWorkers,
      parentFinalGateCaseCount: parentFinalReplay.aggregate.caseCount,
    },
    warnings,
  }

  await mkdir(dirname(input.evidencePath), { recursive: true })
  await writeFile(input.evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  return result
}
