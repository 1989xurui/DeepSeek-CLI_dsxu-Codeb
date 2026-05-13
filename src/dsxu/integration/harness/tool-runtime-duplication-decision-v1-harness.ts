import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { buildToolRuntimeDirtyReview } from '../../engine/tool-runtime-dirty-review-v1'
import {
  buildToolRuntimeDuplicationDecision,
  type ToolRuntimeDuplicationDecision,
} from '../../engine/tool-runtime-duplication-decision-v1'
import { runV18DirtyQuarantineLedgerHarness } from '../../engine/v18-dirty-quarantine-ledger'
import {
  collectAgentEntryLifecycleImportUseObservations,
  collectAgentExecutionRunnerImportUseObservations,
  collectAgentMemoryContextImportUseObservations,
  collectAgentRegistryPromptImportUseObservations,
  collectAgentVisibleStateImportUseObservations,
  collectContextMemoryImportUseObservations,
  collectDirectConnectServerAdapterImportUseObservations,
  collectEvidenceOutputToolImportUseObservations,
  collectFileSourceToolImportUseObservations,
  collectMcpSkillImportUseObservations,
  collectMcpSkillResourceToolImportUseObservations,
  collectNativeRuntimeAdapterImportUseObservations,
  collectPermissionImportUseObservations,
  collectPluginBundleAdapterImportUseObservations,
  collectPlanTaskWorkflowToolImportUseObservations,
  collectProductCompatAdapterImportUseObservations,
  collectProductSurfaceImportUseObservations,
  collectProviderImportUseObservations,
  collectSharedUtilityImportUseObservations,
  collectShellToolImportUseObservations,
  collectSourceEvidenceImportUseObservations,
  collectTelemetryDiagnosticsImportUseObservations,
  collectTestCompatToolImportUseObservations,
  collectWebNetworkToolImportUseObservations,
  collectWorktreeConfigToolImportUseObservations,
} from './tool-runtime-dirty-review-v1-harness'

export type ToolRuntimeDuplicationDecisionHarnessResult = ToolRuntimeDuplicationDecision & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runToolRuntimeDuplicationDecisionHarness(options: {
  evidenceDir?: string
} = {}): Promise<ToolRuntimeDuplicationDecisionHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'tool-runtime-duplication-decision-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'tool-runtime-duplication-decision.evidence.json')
  const tracePath = join(evidenceDir, 'tool-runtime-duplication-decision.trace.json')

  const ledger = await runV18DirtyQuarantineLedgerHarness({
    evidenceDir: join(evidenceDir, 'dirty-ledger'),
  })
  const sourceRoot = join(process.cwd(), 'src')
  const [
    permissionImportUseObservations,
    providerImportUseObservations,
    mcpSkillImportUseObservations,
    contextMemoryImportUseObservations,
    sourceEvidenceImportUseObservations,
    productSurfaceImportUseObservations,
    telemetryDiagnosticsImportUseObservations,
    sharedUtilityImportUseObservations,
    shellToolImportUseObservations,
    fileSourceToolImportUseObservations,
    mcpSkillResourceToolImportUseObservations,
    planTaskWorkflowToolImportUseObservations,
    worktreeConfigToolImportUseObservations,
    webNetworkToolImportUseObservations,
    evidenceOutputToolImportUseObservations,
    testCompatToolImportUseObservations,
    agentEntryLifecycleImportUseObservations,
    agentExecutionRunnerImportUseObservations,
    agentRegistryPromptImportUseObservations,
    agentMemoryContextImportUseObservations,
    agentVisibleStateImportUseObservations,
    nativeRuntimeAdapterImportUseObservations,
    pluginBundleAdapterImportUseObservations,
    directConnectServerAdapterImportUseObservations,
    productCompatAdapterImportUseObservations,
  ] = await Promise.all([
    collectPermissionImportUseObservations(sourceRoot),
    collectProviderImportUseObservations(sourceRoot),
    collectMcpSkillImportUseObservations(sourceRoot),
    collectContextMemoryImportUseObservations(sourceRoot),
    collectSourceEvidenceImportUseObservations(sourceRoot),
    collectProductSurfaceImportUseObservations(sourceRoot),
    collectTelemetryDiagnosticsImportUseObservations(sourceRoot),
    collectSharedUtilityImportUseObservations(sourceRoot),
    collectShellToolImportUseObservations(sourceRoot),
    collectFileSourceToolImportUseObservations(sourceRoot),
    collectMcpSkillResourceToolImportUseObservations(sourceRoot),
    collectPlanTaskWorkflowToolImportUseObservations(sourceRoot),
    collectWorktreeConfigToolImportUseObservations(sourceRoot),
    collectWebNetworkToolImportUseObservations(sourceRoot),
    collectEvidenceOutputToolImportUseObservations(sourceRoot),
    collectTestCompatToolImportUseObservations(sourceRoot),
    collectAgentEntryLifecycleImportUseObservations(sourceRoot),
    collectAgentExecutionRunnerImportUseObservations(sourceRoot),
    collectAgentRegistryPromptImportUseObservations(sourceRoot),
    collectAgentMemoryContextImportUseObservations(sourceRoot),
    collectAgentVisibleStateImportUseObservations(sourceRoot),
    collectNativeRuntimeAdapterImportUseObservations(sourceRoot),
    collectPluginBundleAdapterImportUseObservations(sourceRoot),
    collectDirectConnectServerAdapterImportUseObservations(sourceRoot),
    collectProductCompatAdapterImportUseObservations(sourceRoot),
  ])
  const review = buildToolRuntimeDirtyReview(ledger, {
    permissionImportUseObservations,
    providerImportUseObservations,
    mcpSkillImportUseObservations,
    contextMemoryImportUseObservations,
    sourceEvidenceImportUseObservations,
    productSurfaceImportUseObservations,
    telemetryDiagnosticsImportUseObservations,
    sharedUtilityImportUseObservations,
    shellToolImportUseObservations,
    fileSourceToolImportUseObservations,
    mcpSkillResourceToolImportUseObservations,
    planTaskWorkflowToolImportUseObservations,
    worktreeConfigToolImportUseObservations,
    webNetworkToolImportUseObservations,
    evidenceOutputToolImportUseObservations,
    testCompatToolImportUseObservations,
    agentEntryLifecycleImportUseObservations,
    agentExecutionRunnerImportUseObservations,
    agentRegistryPromptImportUseObservations,
    agentMemoryContextImportUseObservations,
    agentVisibleStateImportUseObservations,
    nativeRuntimeAdapterImportUseObservations,
    pluginBundleAdapterImportUseObservations,
    directConnectServerAdapterImportUseObservations,
    productCompatAdapterImportUseObservations,
  })
  const decision = buildToolRuntimeDuplicationDecision(review)
  const result: ToolRuntimeDuplicationDecisionHarnessResult = {
    ...decision,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { ledger, review, decision })
  await writeJson(evidencePath, result)
  return result
}
