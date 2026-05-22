import type { DsxuTrainingTrajectory } from './schema'

export type DsxuTrainingAntiCheatBlocker =
  | 'invalid_schema'
  | 'unpaired_tool_result'
  | 'false_pass'
  | 'analysis_task_edited'
  | 'stale_source_edit'
  | 'agent_partial_upgraded'
  | 'oracle_or_solution_leak'
  | 'public_claim_without_raw_evidence'
  | 'cost_roi_without_usage'
  | 'source_body_stored'

export interface DsxuTrainingAntiCheatFinding {
  blocker: DsxuTrainingAntiCheatBlocker
  message: string
  hardGate: true
}

export function inspectTrainingTrajectoryAntiCheat(
  trajectory: DsxuTrainingTrajectory,
): DsxuTrainingAntiCheatFinding[] {
  const findings: DsxuTrainingAntiCheatFinding[] = []

  if (trajectory.sourceTruth.sourceBodyStored !== false) {
    findings.push(finding('source_body_stored', 'source bodies must never be stored in training trajectories'))
  }

  if (trajectory.toolTrace.some(tool => !tool.resultPaired)) {
    findings.push(finding('unpaired_tool_result', 'every tool call in training data must have a paired result'))
  }

  if (trajectory.outcome.status === 'success' && !trajectory.verification.claimBound) {
    findings.push(finding('false_pass', 'successful final claim is not bound to verification evidence'))
  }

  if (trajectory.intentUnderstanding.explicitNoEdit && (trajectory.editTrace?.length ?? 0) > 0) {
    findings.push(finding('analysis_task_edited', 'analysis-only task contains edit trace'))
  }

  if (trajectory.sourceTruth.staleReadDetected && (trajectory.editTrace?.length ?? 0) > 0) {
    findings.push(finding('stale_source_edit', 'edit was attempted after stale source truth was detected'))
  }

  if ((trajectory.agentHandoff ?? []).some(agent => agent.agentStatus !== 'completed' && agent.parentClaimAllowed)) {
    findings.push(finding('agent_partial_upgraded', 'non-completed agent handoff was upgraded to parent completion'))
  }

  if (
    trajectory.antiCheat.oracleLeakFlag ||
    trajectory.antiCheat.solutionArtifactFlag ||
    trajectory.antiCheat.oldReportFlag
  ) {
    findings.push(finding('oracle_or_solution_leak', 'oracle, solution, or old report evidence is present'))
  }

  if (
    trajectory.task.claimScope === 'public' &&
    trajectory.outcome.publicClaimAllowed &&
    !hasRawEvidenceProxy(trajectory)
  ) {
    findings.push(finding('public_claim_without_raw_evidence', 'public claim is allowed without raw evidence proxy'))
  }

  if (
    /roi|cache|cost/i.test(trajectory.costRoute.routeReason) &&
    trajectory.costRoute.estimatedCostUsd === 0 &&
    trajectory.costRoute.cacheHitInputTokens === 0 &&
    trajectory.costRoute.cacheMissInputTokens === 0
  ) {
    findings.push(finding('cost_roi_without_usage', 'cost/cache ROI claim has no usage attribution'))
  }

  return findings
}

function hasRawEvidenceProxy(trajectory: DsxuTrainingTrajectory): boolean {
  return (
    trajectory.sourceTruth.evidenceHashes.length > 0 ||
    trajectory.verification.artifactPaths.length > 0 ||
    trajectory.toolTrace.some(tool => Boolean(tool.outputHash))
  )
}

function finding(blocker: DsxuTrainingAntiCheatBlocker, message: string): DsxuTrainingAntiCheatFinding {
  return { blocker, message, hardGate: true }
}
