import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildToolRuntimeDirtyReview,
  type ToolRuntimeImportUseObservation,
  type ToolRuntimeDirtyReview,
} from '../../engine/tool-runtime-dirty-review-v1'
import { buildToolRuntimeDuplicationDecision } from '../../engine/tool-runtime-duplication-decision-v1'
import { runV18DirtyQuarantineLedgerHarness } from '../../engine/v18-dirty-quarantine-ledger'

export type ToolRuntimeDirtyReviewHarnessResult = ToolRuntimeDirtyReview & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const permissionImportUseTerms = [
  'PermissionManager',
  'ToolPermissionContext',
  'toolPermissionContext',
  'permissionLogging',
  'startSpeculativeClassifierCheck',
  'hasPermissionsToUseTool',
  'checkRuleBasedPermissions',
  'bashToolHasPermission',
  'powershellToolHasPermission',
  'SandboxManager',
  'ShellCommand',
  'executeShellCommandsInPrompt',
  'applyPermissionUpdate',
] as const

const providerImportUseTerms = [
  'createLLMCall',
  'createDirectLLMCall',
  'createProxyLLMCall',
  'createPreferredDSXULLMCall',
  'DeepSeekAdapter',
  'decideDeepSeekV4Route',
  'resolveDeepSeekV4CostRoute',
  'estimateDeepSeekV4Cost',
  'estimateCost',
  'CostTracker',
  'MODEL_PRICING',
  'tokenBudget',
  'TokenBudget',
  'DEEPSEEK_V4_FLASH_MODEL',
  'DEEPSEEK_V4_PRO_MODEL',
] as const

const mcpSkillImportUseTerms = [
  'MCPManager',
  'MCPConnection',
  'MCPTool',
  'McpAuth',
  'SkillRegistry',
  'SkillsExecutor',
  'SkillsAdapter',
  'evaluateToolGate',
  'buildSkillToolGateDefinition',
  'isWriteSkillName',
  'loadSkillsDir',
  'loadPluginCommands',
  'executeShellCommandsInPrompt',
  'ToolSearchTool',
  'toolSearch',
  'mcpSkill',
] as const

const contextMemoryImportUseTerms = [
  'SessionMemory',
  'sessionMemory',
  'autoDream',
  'compact',
  'apiMicrocompact',
  'conversationRecovery',
  'crossProjectResume',
  'contextAnalysis',
  'contextSuggestions',
  'readEditContext',
  'memoryFileDetection',
  'collapseReadSearch',
  'agentContext',
  'forkedAgent',
  'teammateMailbox',
  'teamMemory',
  'sessionStorage',
] as const

const sourceEvidenceImportUseTerms = [
  'LSPClient',
  'LSPServerManager',
  'LSPDiagnosticRegistry',
  'static-analysis',
  'swe-bench',
  'AgentSummary',
  'toolUseSummary',
  'detectRepository',
  'gitDiff',
  'ripgrep',
  'readFileInRange',
  'toolResultStorage',
  'preflightChecks',
  'QueryGuard',
] as const

const productSurfaceImportUseTerms = [
  'useIDEStatusIndicator',
  'useFastModeNotification',
  'useInstallMessages',
  'PromptSuggestion',
  'remoteManagedSettings',
  'settingsSync',
  'statusNotice',
  'renderOptions',
  'terminalPanel',
  'keyboardShortcuts',
  'dsxuBrowserProvider',
  'teleport',
  'voice',
  'theme',
] as const

const telemetryDiagnosticsImportUseTerms = [
  'logEvent',
  'Analytics',
  'analytics',
  'diagnosticTracking',
  'logForDebugging',
  'diagLogs',
  'doctorDiagnostic',
  'errorLogSink',
  'startupProfiler',
  'queryProfiler',
  'headlessProfiler',
  'telemetryAttributes',
  'perfetto',
  'statsCache',
] as const

const sharedUtilityImportUseTerms = [
  'authFileDescriptor',
  'authPortable',
  'secureStorage',
  'execFileNoThrow',
  'execFileNoThrowPortable',
  'execSyncWrapper',
  'combinedAbortSignal',
  'cleanupRegistry',
  'cronScheduler',
  'cronTasks',
  'sessionStorage',
  'backgroundHousekeeping',
  'processUserInput',
  'handlePromptSubmit',
  'argumentSubstitution',
  'ansiToPng',
  'ansiToSvg',
  'formatBriefTimestamp',
  'highlightMatch',
  'envUtils',
  'envValidation',
  'managedEnv',
  'filePersistence',
  'contentArray',
  'CircularBuffer',
  'legacy-productDesktop',
  'legacy-productmd',
] as const

const shellToolImportUseTerms = [
  'BashTool',
  'PowerShellTool',
  'BASH_TOOL_NAME',
  'POWERSHELL_TOOL_NAME',
  'bashToolHasPermission',
  'powershellToolHasPermission',
  'ShellCommand',
  'executeShellCommandsInPrompt',
  'shouldUseSandbox',
] as const

const fileSourceToolImportUseTerms = [
  'FileReadTool',
  'FileEditTool',
  'FileWriteTool',
  'NotebookEditTool',
  'GlobTool',
  'GrepTool',
  'LSPTool',
  'readFileInRange',
  'toolResultStorage',
  'preflightChecks',
  'QueryGuard',
  'LSPDiagnosticRegistry',
] as const

const mcpSkillResourceToolImportUseTerms = [
  'MCPTool',
  'McpAuthTool',
  'ReadMcpResourceTool',
  'ListMcpResourcesTool',
  'SkillTool',
  'ToolSearchTool',
  'MCPManager',
  'loadSkillsDir',
  'SkillRegistry',
  'mcpOutputStorage',
  'toolSearch',
] as const

const planTaskWorkflowToolImportUseTerms = [
  'EnterPlanModeTool',
  'ExitPlanModeTool',
  'ExitPlanModeV2Tool',
  'TaskCreateTool',
  'TaskOutputTool',
  'WorkflowTool',
  'ScheduleCronTool',
  'TodoWriteTool',
  'TeamCreateTool',
  'forkedAgent',
  'agentContext',
  'teammateMailbox',
  'cronScheduler',
] as const

const worktreeConfigToolImportUseTerms = [
  'ConfigTool',
  'EnterWorktreeTool',
  'ExitWorktreeTool',
  'RemoteTriggerTool',
  'SendMessageTool',
  'REPLTool',
  'getWorktreePaths',
  'worktreeModeEnabled',
  'worktree',
  'supportedSettings',
] as const

const webNetworkToolImportUseTerms = [
  'WebFetchTool',
  'WebSearchTool',
  'webFetch',
  'webSearch',
  'WebFetch',
  'WebSearch',
  'mcpOutputStorage',
] as const

const evidenceOutputToolImportUseTerms = [
  'AskUserQuestionTool',
  'BriefTool',
  'CollectEvidenceTool',
  'RunNativeTestTool',
  'SyntheticOutputTool',
  'ToolEvidencePack',
  'toolEvidence',
  'finalReport',
  'brief',
] as const

const testCompatToolImportUseTerms = [
  'TestingPermissionTool',
  'schema-lint',
  'gitOperationTracking',
  'spawnMultiAgent',
  'toolSchemaCache',
  'streamlinedTransform',
] as const

const agentEntryLifecycleImportUseTerms = [
  'AgentTool',
  'AGENT_TOOL_NAME',
  'agentTool',
  'spawnAgent',
] as const

const agentExecutionRunnerImportUseTerms = [
  'runAgent',
  'forkSubagent',
  'resumeAgent',
  'serial_worker',
  'parallel_fanout',
  'forkedAgent',
  'agentContext',
  'agentSwarmsEnabled',
  'teammateMailbox',
] as const

const agentRegistryPromptImportUseTerms = [
  'builtInAgents',
  'loadAgentsDir',
  'AgentDefinition',
  'AgentPrompt',
  'generalPurposeAgent',
  'exploreAgent',
  'planAgent',
  'verificationAgent',
] as const

const agentMemoryContextImportUseTerms = [
  'agentMemory',
  'agentMemorySnapshot',
  'AgentMemory',
  'agentContext',
  'teamMemory',
  'teammateContext',
] as const

const agentVisibleStateImportUseTerms = [
  'agentColorManager',
  'agentDisplay',
  'AgentDisplay',
  'agentColor',
  'agentStatus',
] as const

const nativeRuntimeAdapterImportUseTerms = [
  'native-ts',
  'color-diff',
  'file-index',
  'yoga-layout',
  'getYogaCounters',
  'colorDiff',
] as const

const pluginBundleAdapterImportUseTerms = [
  'builtinPlugins',
  'getBuiltinPluginSkillCommands',
  'getBuiltinPluginDefinition',
  'pluginOperations',
  'pluginLoader',
  'PluginTrustWarning',
  'BundledSkillDefinition',
] as const

const directConnectServerAdapterImportUseTerms = [
  'DirectConnect',
  'directConnect',
  'createDirectConnectSession',
  'DirectConnectSessionManager',
  'DirectConnectConfig',
  'getDirectConnectServerUrl',
  'setDirectConnectServerUrl',
] as const

const productCompatAdapterImportUseTerms = [
  'useMoreRight',
  'MoreRight',
  'moreright',
  'local-work',
  'local-work-engine',
  'legacy-product',
  'createDSXUBridgeBatchMainlineRuntime',
  'createDSXUBridgeOrchestrationMainlineRuntime',
  'createDSXUBridgeSessionLifecycleRuntime',
  'createDSXURemoteSkillRuntime',
  'provider-backend/dsxu-provider-compat',
  'dsxu-mainline-compat-wrappers',
] as const

function shouldScanSourceFile(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  if (/\/__tests__\//.test(normalized)) return false
  if (/\/dsxu\/integration\/harness\//.test(normalized)) return false
  if (/\/dsxu\/engine\/tool-runtime-(dirty-review|duplication-decision)-v1\.ts$/.test(normalized)) return false
  if (/\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) return false
  return /\.[cm]?[tj]sx?$/.test(normalized)
}

async function collectImportUseObservations(
  root: string,
  terms: readonly string[],
): Promise<readonly ToolRuntimeImportUseObservation[]> {
  const observations: ToolRuntimeImportUseObservation[] = []
  const termMatchers = new Map(
    terms.map(term => [
      term,
      new RegExp(`(^|[^A-Za-z0-9_$])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_$]|$)`),
    ]),
  )

  async function visit(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        await visit(path)
        continue
      }
      if (!entry.isFile() || !shouldScanSourceFile(path)) continue

      const text = await readFile(path, 'utf8')
      const relativePath = path.replace(`${process.cwd()}\\`, '').replace(`${process.cwd()}/`, '').replace(/\\/g, '/')
      const lines = text.split(/\r?\n/)
      for (const [index, line] of lines.entries()) {
        for (const term of terms) {
          if (!termMatchers.get(term)?.test(line)) continue
          observations.push({
            callerPath: relativePath,
            symbol: term,
            lineNumber: index + 1,
            evidence: line.trim(),
          })
        }
      }
    }
  }

  await visit(root)
  return observations
}

export async function collectPermissionImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, permissionImportUseTerms)
}

export async function collectProviderImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, providerImportUseTerms)
}

export async function collectMcpSkillImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, mcpSkillImportUseTerms)
}

export async function collectContextMemoryImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, contextMemoryImportUseTerms)
}

export async function collectSourceEvidenceImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, sourceEvidenceImportUseTerms)
}

export async function collectProductSurfaceImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, productSurfaceImportUseTerms)
}

export async function collectTelemetryDiagnosticsImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, telemetryDiagnosticsImportUseTerms)
}

export async function collectSharedUtilityImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, sharedUtilityImportUseTerms)
}

export async function collectShellToolImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, shellToolImportUseTerms)
}

export async function collectFileSourceToolImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, fileSourceToolImportUseTerms)
}

export async function collectMcpSkillResourceToolImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, mcpSkillResourceToolImportUseTerms)
}

export async function collectPlanTaskWorkflowToolImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, planTaskWorkflowToolImportUseTerms)
}

export async function collectWorktreeConfigToolImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, worktreeConfigToolImportUseTerms)
}

export async function collectWebNetworkToolImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, webNetworkToolImportUseTerms)
}

export async function collectEvidenceOutputToolImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, evidenceOutputToolImportUseTerms)
}

export async function collectTestCompatToolImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, testCompatToolImportUseTerms)
}

export async function collectAgentEntryLifecycleImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, agentEntryLifecycleImportUseTerms)
}

export async function collectAgentExecutionRunnerImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, agentExecutionRunnerImportUseTerms)
}

export async function collectAgentRegistryPromptImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, agentRegistryPromptImportUseTerms)
}

export async function collectAgentMemoryContextImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, agentMemoryContextImportUseTerms)
}

export async function collectAgentVisibleStateImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, agentVisibleStateImportUseTerms)
}

export async function collectNativeRuntimeAdapterImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, nativeRuntimeAdapterImportUseTerms)
}

export async function collectPluginBundleAdapterImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, pluginBundleAdapterImportUseTerms)
}

export async function collectDirectConnectServerAdapterImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, directConnectServerAdapterImportUseTerms)
}

export async function collectProductCompatAdapterImportUseObservations(root: string): Promise<readonly ToolRuntimeImportUseObservation[]> {
  return collectImportUseObservations(root, productCompatAdapterImportUseTerms)
}

export async function runToolRuntimeDirtyReviewHarness(options: {
  evidenceDir?: string
} = {}): Promise<ToolRuntimeDirtyReviewHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'tool-runtime-dirty-review-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'tool-runtime-dirty-review.evidence.json')
  const tracePath = join(evidenceDir, 'tool-runtime-dirty-review.trace.json')

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
  const duplicationDecision = buildToolRuntimeDuplicationDecision(review)
  const result: ToolRuntimeDirtyReviewHarnessResult = {
    ...review,
    duplicationDecisionStatus: duplicationDecision.status,
    duplicationDecisionBatchCount: duplicationDecision.batchCount,
    evidencePath,
    tracePath,
  }

  await writeJson(join(evidenceDir, 'tool-runtime-duplication-decision.evidence.json'), duplicationDecision)
  await writeJson(tracePath, { ledger, review: result, duplicationDecision })
  await writeJson(evidencePath, result)
  return result
}
