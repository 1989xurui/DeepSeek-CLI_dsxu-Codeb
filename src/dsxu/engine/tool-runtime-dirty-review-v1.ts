import type {
  V18DirtyLedgerEntry,
  V18DirtyQuarantineLedger,
} from './v18-dirty-quarantine-ledger'

const LEGACY_PRODUCT = ['cl', 'aude'].join('')
const LEGACY_PRODUCT_PATTERN = new RegExp(LEGACY_PRODUCT, 'gi')
const LEGACY_AI_LIMITS = `${LEGACY_PRODUCT}AiLimits`
const LEGACY_AI_LIMITS_HOOK = `${LEGACY_PRODUCT}AiLimitsHook`
const LEGACY_IN_CHROME = `${LEGACY_PRODUCT}InChrome`
const LEGACY_CODE_HINTS = `${LEGACY_PRODUCT}CodeHints`
const LEGACY_GOOD_SLUG = `good-${LEGACY_PRODUCT}`

export type ToolRuntimeDirtyReviewStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'
export type ToolRuntimeDirtyReviewBatchId =
  | 'TRR-01'
  | 'TRR-02'
  | 'TRR-03'
  | 'TRR-04'
  | 'TRR-05'
  | 'TRR-99'

export type ToolRuntimeSupportServiceSliceId =
  | 'TRR-01A'
  | 'TRR-01B'
  | 'TRR-01C'
  | 'TRR-01D'
  | 'TRR-01E'
  | 'TRR-01F'
  | 'TRR-01G'
  | 'TRR-01H'

export type ToolRuntimeSupportServiceDisposition =
  | 'merge-to-permission-tool-gate'
  | 'merge-to-provider-cost-owner'
  | 'merge-to-skill-mcp-owner'
  | 'merge-to-context-memory-owner'
  | 'map-to-source-evidence-owner'
  | 'map-to-product-surface-owner'
  | 'map-to-trace-diagnostics-owner'
  | 'keep-shared-helper-with-owner'

export type ToolRuntimeSharedUtilitySliceId =
  | 'TRR-01H1'
  | 'TRR-01H2'
  | 'TRR-01H3'
  | 'TRR-01H4'
  | 'TRR-01H5'
  | 'TRR-01H6'
  | 'TRR-01H7'
  | 'TRR-01H8'
  | 'TRR-01H9'

export type ToolRuntimeSharedUtilitySlice = {
  id: ToolRuntimeSharedUtilitySliceId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetMainline: string
  requiredAction: string
  canKeepAsGenericSupportBucket: false
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeCommandSurfaceSliceId =
  | 'TRR-02A'
  | 'TRR-02B'
  | 'TRR-02C'
  | 'TRR-02D'
  | 'TRR-02E'
  | 'TRR-02F'
  | 'TRR-02G'
  | 'TRR-02H'
  | 'TRR-02I'

export type ToolRuntimeCommandSurfaceSlice = {
  id: ToolRuntimeCommandSurfaceSliceId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetMainline: string
  requiredAction: string
  canKeepAsGenericCommandBucket: false
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeToolCoreSliceId =
  | 'TRR-03A'
  | 'TRR-03B'
  | 'TRR-03C'
  | 'TRR-03D'
  | 'TRR-03E'
  | 'TRR-03F'
  | 'TRR-03G'
  | 'TRR-03H'
  | 'TRR-03I'

export type ToolRuntimeToolCoreSlice = {
  id: ToolRuntimeToolCoreSliceId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetMainline: string
  requiredAction: string
  canKeepAsSeparateToolRuntime: false
  importUseScan?: ToolRuntimePermissionImportUseScan
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeAgentToolSliceId =
  | 'TRR-04A'
  | 'TRR-04B'
  | 'TRR-04C'
  | 'TRR-04D'
  | 'TRR-04E'
  | 'TRR-04F'

export type ToolRuntimeAgentToolSlice = {
  id: ToolRuntimeAgentToolSliceId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetMainline: string
  requiredAction: string
  canKeepAsSecondAgentRuntime: false
  importUseScan?: ToolRuntimePermissionImportUseScan
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeExternalIntegrationSliceId =
  | 'TRR-05A'
  | 'TRR-05B'
  | 'TRR-05C'
  | 'TRR-05D'
  | 'TRR-05E'

export type ToolRuntimeExternalIntegrationSlice = {
  id: ToolRuntimeExternalIntegrationSliceId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetMainline: string
  requiredAction: string
  canKeepAsStandaloneRuntime: false
  importUseScan?: ToolRuntimePermissionImportUseScan
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeMainlineImportUseProof = {
  proofStatus: 'PARTIAL'
  owner: string
  requiredMainlineOwner: string
  allowedConsumerOwners: readonly string[]
  importUseEvidence: readonly string[]
  importUseScan?: ToolRuntimePermissionImportUseScan
  forbiddenBypass: readonly string[]
  missingProofBeforeClose: readonly string[]
  canCloseWithoutImportUseReview: false
}

export type ToolRuntimePermissionImportUseOwner =
  | 'tool-gate'
  | 'bash-powershell-adapter'
  | 'control-plane-permission-bridge'
  | 'visible-state-projection'
  | 'forbidden-second-permission-runtime'
  | 'unknown-owner'

export type ToolRuntimeProviderImportUseOwner =
  | 'model-router'
  | 'provider-adapter'
  | 'cost-evidence'
  | 'final-report-usage-evidence'
  | 'legacy-provider-compat'
  | 'forbidden-second-provider-runtime'
  | 'unknown-owner'

export type ToolRuntimeMcpSkillImportUseOwner =
  | 'mcp-adapter'
  | 'skill-registry'
  | 'tool-lifecycle'
  | 'tool-search-projection'
  | 'mcp-visible-state-projection'
  | 'forbidden-second-mcp-skill-runtime'
  | 'unknown-owner'

export type ToolRuntimeSharedUtilityImportUseOwner =
  | 'auth-control-plane'
  | 'process-tool-lifecycle'
  | 'filesystem-source-evidence'
  | 'scheduler-query-control'
  | 'network-provider-adapter'
  | 'render-evidence-projection'
  | 'input-command-facade'
  | 'storage-state-evidence'
  | 'trace-diagnostics'
  | 'compat-test-evidence'
  | 'unknown-owner'

export type ToolRuntimeMediumSupportImportUseOwner =
  | 'context-owner'
  | 'memory-store'
  | 'resume-session-control'
  | 'source-truth'
  | 'static-analysis-owner'
  | 'evidence-artifact-owner'
  | 'product-visible-state'
  | 'product-config-surface'
  | 'ide-terminal-surface'
  | 'analytics-sink'
  | 'diagnostics-trace'
  | 'observability-projection'
  | 'forbidden-second-context-runtime'
  | 'forbidden-second-source-runtime'
  | 'forbidden-second-product-runtime'
  | 'forbidden-second-diagnostics-runtime'
  | 'unknown-owner'

export type ToolRuntimeToolCoreImportUseOwner =
  | 'tool-bus-lifecycle'
  | 'tool-gate'
  | 'shell-adapter'
  | 'source-tool-adapter'
  | 'mcp-skill-registry'
  | 'workflow-task-owner'
  | 'worktree-config-control'
  | 'web-network-adapter'
  | 'evidence-output-owner'
  | 'evidence-artifact-owner'
  | 'product-visible-state'
  | 'compat-test-evidence'
  | 'replace-delete-candidate'
  | 'forbidden-second-tool-runtime'
  | 'unknown-owner'

export type ToolRuntimeAgentToolImportUseOwner =
  | 'agent-tool-lifecycle'
  | 'agent-execution-runner'
  | 'agent-registry-prompt'
  | 'agent-context-evidence'
  | 'agent-visible-state'
  | 'tool-bus-lifecycle'
  | 'workflow-task-owner'
  | 'source-tool-adapter'
  | 'mcp-skill-registry'
  | 'evidence-artifact-owner'
  | 'compat-test-evidence'
  | 'forbidden-second-agent-orchestrator'
  | 'unknown-owner'

export type ToolRuntimeExternalIntegrationImportUseOwner =
  | 'native-runtime-adapter'
  | 'plugin-bundle-adapter'
  | 'direct-connect-server-adapter'
  | 'product-compat-adapter'
  | 'adapter-visible-projection'
  | 'tool-bus-lifecycle'
  | 'mcp-skill-registry'
  | 'auth-control-plane'
  | 'network-provider-adapter'
  | 'evidence-artifact-owner'
  | 'compat-test-evidence'
  | 'forbidden-standalone-external-runtime'
  | 'unknown-owner'

export type ToolRuntimeImportUseOwner =
  | ToolRuntimePermissionImportUseOwner
  | ToolRuntimeProviderImportUseOwner
  | ToolRuntimeMcpSkillImportUseOwner
  | ToolRuntimeSharedUtilityImportUseOwner
  | ToolRuntimeMediumSupportImportUseOwner
  | ToolRuntimeToolCoreImportUseOwner
  | ToolRuntimeAgentToolImportUseOwner
  | ToolRuntimeExternalIntegrationImportUseOwner

export type ToolRuntimeImportUseScanId =
  | 'TRR-01A-permission-tool-gate-import-use'
  | 'TRR-01B-provider-cost-import-use'
  | 'TRR-01C-mcp-skill-registry-import-use'
  | 'TRR-01D-context-memory-resume-import-use'
  | 'TRR-01E-source-analysis-evidence-import-use'
  | 'TRR-01F-product-surface-hooks-import-use'
  | 'TRR-01G-telemetry-diagnostics-import-use'
  | 'TRR-01H-shared-runtime-utilities-import-use'
  | 'TRR-03A-shell-execution-tool-import-use'
  | 'TRR-03B-file-source-tool-import-use'
  | 'TRR-03C-mcp-skill-resource-tool-import-use'
  | 'TRR-03D-plan-task-workflow-tool-import-use'
  | 'TRR-03E-worktree-config-control-tool-import-use'
  | 'TRR-03F-web-network-tool-import-use'
  | 'TRR-03G-evidence-output-tool-import-use'
  | 'TRR-03H-test-compat-tool-import-use'
  | 'TRR-04A-agent-entry-lifecycle-import-use'
  | 'TRR-04B-agent-execution-runner-import-use'
  | 'TRR-04C-agent-registry-prompt-import-use'
  | 'TRR-04D-agent-memory-context-import-use'
  | 'TRR-04E-agent-visible-state-import-use'
  | 'TRR-05A-native-runtime-adapter-import-use'
  | 'TRR-05B-plugin-bundle-adapter-import-use'
  | 'TRR-05C-direct-connect-server-adapter-import-use'
  | 'TRR-05D-product-compat-adapter-import-use'

export type ToolRuntimeImportUseObservation = {
  callerPath: string
  symbol: string
  lineNumber?: number
  evidence?: string
}

export type ToolRuntimeForbiddenClosureDisposition =
  | 'migrate-to-mainline-owner'
  | 'remove-public-export'
  | 'replace-or-delete-candidate'
  | 'compat-facade-only'

export type ToolRuntimeForbiddenRuntimeClosure = {
  disposition: ToolRuntimeForbiddenClosureDisposition
  targetOwner: string
  requiredMigration: string
  canKeepAsRuntime: false
}

export type ToolRuntimePermissionImportUseFinding = {
  callerPath: string
  owner: ToolRuntimeImportUseOwner
  allowed: boolean
  symbols: readonly string[]
  reason: string
  sampleEvidence: readonly string[]
  forbiddenClosure?: ToolRuntimeForbiddenRuntimeClosure
}

export type ToolRuntimePermissionImportUseOwnerCount = {
  owner: ToolRuntimeImportUseOwner
  count: number
}

export type ToolRuntimePermissionImportUseScan = {
  scanId: ToolRuntimeImportUseScanId
  status: 'PASS' | 'PARTIAL' | 'BLOCKED'
  totalCallerCount: number
  allowedCallerCount: number
  forbiddenCallerCount: number
  unknownCallerCount: number
  forbiddenClosureCount: number
  ownerCounts: readonly ToolRuntimePermissionImportUseOwnerCount[]
  findings: readonly ToolRuntimePermissionImportUseFinding[]
  redlines: readonly string[]
}

export type ToolRuntimeSupportServiceSlice = {
  id: ToolRuntimeSupportServiceSliceId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetMainline: string
  duplicateSystemRisk: 'high' | 'medium' | 'low'
  disposition: ToolRuntimeSupportServiceDisposition
  requiredAction: string
  canKeepAsGenericSupportBucket: false
  samplePaths: readonly string[]
  redlines: readonly string[]
  mainlineImportUseProof?: ToolRuntimeMainlineImportUseProof
  sharedUtilityImportUseScan?: ToolRuntimePermissionImportUseScan
  sharedUtilitySlices?: readonly ToolRuntimeSharedUtilitySlice[]
}

export type ToolRuntimeDirtyReviewBatch = {
  id: ToolRuntimeDirtyReviewBatchId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetMainline: string
  duplicateSystemRisk: 'high' | 'medium' | 'low'
  status: ToolRuntimeDirtyReviewStatus
  disposition: 'migrate-to-single-mainline' | 'verify-and-keep' | 'map-or-quarantine'
  requiredAction: string
  canAutoClose: boolean
  samplePaths: readonly string[]
  redlines: readonly string[]
  supportSlices?: readonly ToolRuntimeSupportServiceSlice[]
  commandSurfaceSlices?: readonly ToolRuntimeCommandSurfaceSlice[]
  toolCoreSlices?: readonly ToolRuntimeToolCoreSlice[]
  agentToolSlices?: readonly ToolRuntimeAgentToolSlice[]
  externalIntegrationSlices?: readonly ToolRuntimeExternalIntegrationSlice[]
}

export type ToolRuntimeDirtyReview = {
  schemaVersion: 'dsxu.tool-runtime-dirty-review.v1'
  status: ToolRuntimeDirtyReviewStatus
  total: number
  batchCount: number
  pass: number
  partial: number
  blocked: number
  highDuplicateRiskBatchCount: number
  supportServiceSliceCount: number
  supportServiceHighRiskSliceCount: number
  supportServiceHighRiskProofCount: number
  supportServiceSharedHelperCount: number
  supportServiceSharedOwnerSliceCount: number
  supportServiceUnassignedSharedHelperCount: number
  commandSurfaceSliceCount: number
  commandSurfaceUnassignedCount: number
  toolCoreSliceCount: number
  toolCoreUnassignedCount: number
  agentToolSliceCount: number
  agentToolUnassignedCount: number
  externalIntegrationSliceCount: number
  externalIntegrationUnassignedCount: number
  importUseUnknownCallerCount: number
  importUseForbiddenClosureCount: number
  duplicationDecisionStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
  duplicationDecisionBatchCount: number
  canCloseToolRuntimeGate: boolean
  mustNotStageOrRestore: boolean
  batches: readonly ToolRuntimeDirtyReviewBatch[]
  redlines: readonly string[]
  safeguards: readonly string[]
  nextAction: 'resolve-import-use-blockers' | 'collapse-support-services' | 'map-commands-to-tool-lifecycle' | 'review-tool-core' | 'tool-runtime-gate-closed'
}

export type ToolRuntimeDirtyReviewOptions = {
  permissionImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  providerImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  mcpSkillImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  contextMemoryImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  sourceEvidenceImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  productSurfaceImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  telemetryDiagnosticsImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  sharedUtilityImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  shellToolImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  fileSourceToolImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  mcpSkillResourceToolImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  planTaskWorkflowToolImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  worktreeConfigToolImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  webNetworkToolImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  evidenceOutputToolImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  testCompatToolImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  agentEntryLifecycleImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  agentExecutionRunnerImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  agentRegistryPromptImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  agentMemoryContextImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  agentVisibleStateImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  nativeRuntimeAdapterImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  pluginBundleAdapterImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  directConnectServerAdapterImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
  productCompatAdapterImportUseObservations?: readonly ToolRuntimeImportUseObservation[]
}

const groupOrder = [
  'support-services',
  'commands',
  'tools-core',
  'agent-tool',
  'external-integration',
] as const

type ToolRuntimeDirtyGroup = typeof groupOrder[number]

const supportSliceOrder = [
  'permission-safety',
  'provider-cost',
  'mcp-plugin-skill',
  'context-memory-resume',
  'source-analysis-evidence',
  'product-surface-hooks',
  'telemetry-diagnostics',
  'shared-runtime-utilities',
] as const

type ToolRuntimeSupportServiceGroup = typeof supportSliceOrder[number]

const sharedUtilitySliceOrder = [
  'auth-oauth-secret',
  'process-execution',
  'filesystem-path-data',
  'scheduler-task-session',
  'network-http-platform',
  'render-format-output',
  'input-command-adapter',
  'storage-mutation-state',
  'compat-test-evidence',
] as const

type ToolRuntimeSharedUtilityGroup = typeof sharedUtilitySliceOrder[number]

const commandSurfaceSliceOrder = [
  'query-session-command',
  'permission-tool-gate-command',
  'provider-cost-command',
  'mcp-skill-command',
  'source-evidence-command',
  'product-surface-command',
  'trace-diagnostics-command',
  'external-adapter-command',
  'compat-command-review',
] as const

type ToolRuntimeCommandSurfaceGroup = typeof commandSurfaceSliceOrder[number]

const toolCoreSliceOrder = [
  'shell-execution-tool',
  'file-source-tool',
  'mcp-skill-resource-tool',
  'plan-task-workflow-tool',
  'worktree-config-control-tool',
  'web-network-tool',
  'evidence-output-tool',
  'test-compat-tool',
  'unmapped-tool-core',
] as const

type ToolRuntimeToolCoreGroup = typeof toolCoreSliceOrder[number]

const agentToolSliceOrder = [
  'agent-entry-lifecycle',
  'agent-execution-runner',
  'agent-registry-prompt',
  'agent-memory-context',
  'agent-visible-state',
  'unmapped-agent-tool',
] as const

type ToolRuntimeAgentToolGroup = typeof agentToolSliceOrder[number]

const externalIntegrationSliceOrder = [
  'native-runtime-adapter',
  'plugin-bundle-adapter',
  'direct-connect-server-adapter',
  'product-compat-adapter',
  'unmapped-external-integration',
] as const

type ToolRuntimeExternalIntegrationGroup = typeof externalIntegrationSliceOrder[number]

function normalizedPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^"|"$/g, '')
}

function isToolRuntimePath(path: string): boolean {
  return /^src\/(tools|permissions|services|utils|hooks|commands|mcp|ide|terminal|shell|network|browser|plugins|server|native-ts|local-work|moreright)\//.test(normalizedPath(path))
}

function groupForPath(path: string): ToolRuntimeDirtyGroup {
  const normalized = normalizedPath(path)
  if (/^src\/commands\//.test(normalized)) return 'commands'
  if (/^src\/tools\/AgentTool\//.test(normalized)) return 'agent-tool'
  if (/^src\/tools\//.test(normalized)) return 'tools-core'
  if (/^src\/(permissions|services|utils|hooks)\//.test(normalized)) return 'support-services'
  return 'external-integration'
}

function supportSliceForPath(path: string): ToolRuntimeSupportServiceGroup {
  const normalized = normalizedPath(path)
  if (
    /^src\/permissions\//.test(normalized) ||
    /^src\/hooks\/toolPermission\//.test(normalized) ||
    /^src\/utils\/(permissions|bash|shell|powershell|sandbox)\//.test(normalized) ||
    /^src\/utils\/(Shell|ShellCommand|autoModeDenials|classifierApprovals|classifierApprovalsHook|promptShellExecution)\.ts/.test(normalized)
  ) {
    return 'permission-safety'
  }
  if (
    new RegExp(`^src\\/services\\/(api|policyLimits|tokenEstimation|sampling-policy|cache-stats|rateLimit|rateLimitMessages|rateLimitMocking|mockRateLimits|dsxuLimits|dsxuLimitsHook|${LEGACY_AI_LIMITS}|${LEGACY_AI_LIMITS_HOOK})\\b`).test(normalized) ||
    /^src\/utils\/(model|tokens|tokenBudget|modelCost|effort|proxy|billing|api|apiPreconnect|extraUsage|betas|fastMode)\b/.test(normalized)
  ) {
    return 'provider-cost'
  }
  if (
    /^src\/services\/(mcp|plugins|MagicDocs)\b/.test(normalized) ||
    /^src\/services\/mcpServerApproval\.tsx/.test(normalized) ||
    /^src\/utils\/(plugins|mcp|skills|toolSearch|desktopMcpImport|mcpInstructionsDelta|mcpOutputStorage|mcpValidation|mcpWebSocketTransport|dxt)\b/.test(normalized)
  ) {
    return 'mcp-plugin-skill'
  }
  if (
    /^src\/services\/(compact|autoDream|SessionMemory|teamMemorySync|extractMemories|experience|snapshot)\b/.test(normalized) ||
    /^src\/utils\/(agent|agentId|agentSwarmsEnabled|agenticSessionSearch|analyzeContext|attachments|context|contextAnalysis|contextSuggestions|controlMessageCompat|memory|memoryFileDetection|session|conversationRecovery|crossProjectResume|readEditContext|fileRead|fileReadCache|fileStateCache|collapseReadSearch|message|messages|forkedAgent|agentContext|teammate|teammateMailbox|teammateContext|teamMemoryOps)\b/.test(normalized)
  ) {
    return 'context-memory-resume'
  }
  if (
    /^src\/services\/tools\//.test(normalized) ||
    /^src\/services\/(static-analysis|lsp|swe-bench|eval|toolUseSummary|AgentSummary)\b/.test(normalized) ||
    /^src\/utils\/(QueryGuard|attribution|commitAttribution|detectRepository|embeddedTools|fileOperationAnalytics|frontmatterParser|groupToolUses|git|gitDiff|github|ghPrStatus|diff|worktree|worktreeModeEnabled|getWorktreePaths|glob|ripgrep|codeIndexing|readFileInRange|vendorToolPaths|vendor|file|fsOperations|generatedFiles|preflightChecks|queryHelpers|todo|toolErrors|toolPool|toolResultStorage|toolSchemaCache)\b/.test(normalized)
  ) {
    return 'source-analysis-evidence'
  }
  if (
    /^src\/hooks\//.test(normalized) ||
    /^src\/services\/(tips|PromptSuggestion|remoteManagedSettings|settingsSync|notifier|preventSleep|awaySummary|voice|voiceStreamSTT|voiceKeyterms)\b/.test(normalized) ||
    new RegExp(`^src\\/utils\\/(advisor|autoRunIssue|autoUpdater|bundledMode|browser|${LEGACY_IN_CHROME}|${LEGACY_CODE_HINTS}|clipboard|config|configConstants|cwd|deepLink|desktopDeepLink|doctorContextWarnings|dsxuCodeHints|dsxuBrowserProvider|dsxuHealthMonitor|dsxuInstructions|editor|fullscreen|horizontalScroll|hyperlink|ide|intl|jetbrains|keyboardShortcuts|localInstaller|logoV2Utils|markdown|nativeInstaller|notebook|pasteStore|pdf|plans|planModeV2|prompt|promptEditor|promptCategory|renderOptions|settings|statusNotice|teleport|terminal|terminalPanel|theme|image|imagePaste|imageResizer|imageStore|imageValidation)\\b`).test(normalized)
  ) {
    return 'product-surface-hooks'
  }
  if (
    /^src\/services\/(analytics|diagnosticTracking|internalLogging|vcr)\b/.test(normalized) ||
    /^src\/utils\/(telemetry|telemetryAttributes|unaryLogging|stats|statsCache|profiler|startupProfiler|headlessProfiler|queryProfiler|errorLogSink|warningHandler|heapDumpService|debug|debugFilter|diagLogs|doctorDiagnostic|log|slowOperations|fpsTracker|activityManager|sinks)\b/.test(normalized)
  ) {
    return 'telemetry-diagnostics'
  }
  return 'shared-runtime-utilities'
}

function sharedUtilitySliceForPath(path: string): ToolRuntimeSharedUtilityGroup {
  const normalized = normalizedPath(path)
  if (
    /^src\/services\/oauth\//.test(normalized) ||
    /^src\/utils\/(auth|authFileDescriptor|authPortable|aws|awsAuthStatusManager|crypto|fingerprint|secureStorage|mtls|caCerts|caCertsConfig|privacyLevel|user)\b/.test(normalized)
  ) {
    return 'auth-oauth-secret'
  }
  if (
    /^src\/utils\/(execFileNoThrow|execFileNoThrowPortable|execSyncWrapper|process|genericProcessUtils|subprocessEnv|combinedAbortSignal|abortController|cleanup|cleanupRegistry|gracefulShutdown|queueProcessor|sequential|sleep|timeouts|signal|withResolvers|slowOperations|stream|streamJsonStdoutGuard|bufferedWriter)\b/.test(normalized)
  ) {
    return 'process-execution'
  }
  if (
    /^src\/utils\/(path|windowsPaths|systemDirectories|cachePaths|tempfile|json|jsonRead|yaml|xml|hash|uuid|set|array|objectGroupBy|lazySchema|zodToJsonSchema|semanticBoolean|semanticNumber|semver|lockfile|binaryCheck|which|xdg|workloadContext|modifiers|sanitization|stringUtils|streamlinedTransform|truncate|unaryLogging)\b/.test(normalized)
  ) {
    return 'filesystem-path-data'
  }
  if (
    /^src\/utils\/(cron|cronJitterConfig|cronScheduler|cronTasks|cronTasksLock|tasks|task|sessionStart|sessionEnvVars|sessionEnvironment|sessionActivity|sessionStorage|sessionStoragePortable|sessionState|sessionTitle|sessionUrl|listSessionsImpl|idleTimeout|backgroundHousekeeping|concurrentSessions|mailbox|sdkEventQueue)\b/.test(normalized)
  ) {
    return 'scheduler-task-session'
  }
  if (
    /^src\/utils\/(http|userAgent|peerAddress|platform|env|envUtils|envValidation|envDynamic|managedEnv|managedEnvConstants|mtls|caCerts|caCertsConfig|systemTheme|iTermBackup|appleTerminalBackup|appleTerminalBackup|localInstaller)\b/.test(normalized)
  ) {
    return 'network-http-platform'
  }
  if (
    /^src\/utils\/(ansiToPng|ansiToSvg|asciicast|format|formatBriefTimestamp|heatmap|html|sliceAnsi|textHighlighting|highlightMatch|treeify|staticRender|exportRenderer|markdown|markdownConfigLoader|pdf|pdfUtils|image|imageStore|imagePaste|imageResizer|imageValidation|terminal|terminalPanel|ink|fullscreen|horizontalScroll|renderOptions)\b/.test(normalized)
  ) {
    return 'render-format-output'
  }
  if (
    /^src\/utils\/(processUserInput|immediateCommand|slashCommandParsing|argumentSubstitution|exampleCommands|cliArgs|cliHighlight|earlyInput|handlePromptSubmit|promptEditor|promptCategory|promptShellExecution|sideQuestion|sideQuery|completionCache|pasteStore|keyboardShortcuts)\b/.test(normalized)
  ) {
    return 'input-command-adapter'
  }
  if (
    /^src\/services\/(embedding|mutation)\//.test(normalized) ||
    /^src\/utils\/(filePersistence|generatedFiles|contentArray|CircularBuffer|Cursor|mailbox|taggedId|localInstaller|nativeInstaller|desktopDeepLink|directMemberMessage|displayTags|undercover|user|words|xml)\b/.test(normalized)
  ) {
    return 'storage-mutation-state'
  }
  return 'compat-test-evidence'
}

function commandNameForPath(path: string): string {
  const normalized = normalizedPath(path)
  const rest = normalized.replace(/^src\/commands\//, '')
  return rest.split('/')[0]?.replace(/\.[^.]+$/, '') ?? rest
}

function commandSurfaceSliceForPath(path: string): ToolRuntimeCommandSurfaceGroup {
  const commandName = commandNameForPath(path)
  if ([
    'agents',
    'break-cache',
    'btw',
    'clear',
    'compact',
    'context',
    'exit',
    'memory',
    'plan',
    'resume',
    'rewind',
    'run',
    'session',
    'summary',
    'tasks',
    'thinkback',
    'thinkback-play',
    'ultraplan',
  ].includes(commandName)) return 'query-session-command'
  if ([
    'permissions',
    'sandbox-toggle',
  ].includes(commandName)) return 'permission-tool-gate-command'
  if ([
    'cost',
    'effort',
    'env',
    'extra-usage',
    'fast',
    'mock-limits',
    'model',
    'rate-limit-options',
    'reset-limits',
    'usage',
  ].includes(commandName)) return 'provider-cost-command'
  if ([
    'hooks',
    'init',
    'init-verifiers',
    'mcp',
    'plugin',
    'reload-plugins',
    'skills',
    'createMovedToPluginCommand',
  ].includes(commandName)) return 'mcp-skill-command'
  if ([
    'add-dir',
    'autofix-pr',
    'backfill-sessions',
    'branch',
    'brief',
    'bughunter',
    'commit',
    'commit-push-pr',
    'diff',
    'dsxu-commit',
    'dsxu-commit-push-pr',
    'files',
    'issue',
    'pr_comments',
    'release-notes',
    'review',
    'security-review',
  ].includes(commandName)) return 'source-evidence-command'
  if ([
    'advisor',
    'chrome',
    'color',
    'config',
    'copy',
    'ctx_viz',
    'desktop',
    LEGACY_GOOD_SLUG,
    'help',
    'ide',
    'install',
    'keybindings',
    'mobile',
    'onboarding',
    'output-style',
    'privacy-settings',
    'rename',
    'status',
    'statusline',
    'stickers',
    'tag',
    'terminalSetup',
    'theme',
    'upgrade',
    'version',
    'vim',
    'voice',
  ].includes(commandName)) return 'product-surface-command'
  if ([
    'ant-trace',
    'debug-tool-call',
    'doctor',
    'heapdump',
    'insights',
    'passes',
    'perf-issue',
    'stats',
  ].includes(commandName)) return 'trace-diagnostics-command'
  if ([
    'bridge',
    'bridge-kick',
    'export',
    'feedback',
    'install-github-app',
    'install-slack-app',
    'login',
    'logout',
    'oauth-refresh',
    'remote-env',
    'remote-setup',
    'share',
    'teleport',
  ].includes(commandName)) return 'external-adapter-command'
  return 'compat-command-review'
}

function toolCoreSliceForPath(path: string): ToolRuntimeToolCoreGroup {
  const normalized = normalizedPath(path)
  if (/^src\/tools\/(BashTool|PowerShellTool)\//.test(normalized) || /^src\/tools\/(ShellTool|BashTool|PowerShellTool)\.tsx?$/.test(normalized)) return 'shell-execution-tool'
  if (/^src\/tools\/(FileReadTool|FileEditTool|FileWriteTool|NotebookEditTool|GlobTool|GrepTool|LSPTool)\//.test(normalized) || /^src\/tools\/(ReadTool|EditTool|WriteTool|GrepTool|GlobTool|LSPTool)\.tsx?$/.test(normalized)) return 'file-source-tool'
  if (/^src\/tools\/(MCPTool|McpAuthTool|ListMcpResourcesTool|ReadMcpResourceTool|SkillTool|ToolSearchTool)\//.test(normalized) || /^src\/tools\/(MCPTool|SkillTool|ToolSearchTool)\.tsx?$/.test(normalized)) return 'mcp-skill-resource-tool'
  if (/^src\/tools\/(EnterPlanModeTool|ExitPlanModeTool|TaskCreateTool|TaskGetTool|TaskListTool|TaskOutputTool|TaskStopTool|TaskUpdateTool|TeamCreateTool|TeamDeleteTool|TodoWriteTool|WorkflowTool|ScheduleCronTool|SleepTool)\//.test(normalized) || /^src\/tools\/(TaskTool|WorkflowTool|TodoWriteTool)\.tsx?$/.test(normalized)) return 'plan-task-workflow-tool'
  if (/^src\/tools\/(ConfigTool|EnterWorktreeTool|ExitWorktreeTool|RemoteTriggerTool|SendMessageTool|REPLTool)\//.test(normalized) || /^src\/tools\/(ConfigTool|WorktreeTool|REPLTool)\.tsx?$/.test(normalized)) return 'worktree-config-control-tool'
  if (/^src\/tools\/(WebFetchTool|WebSearchTool)\//.test(normalized) || /^src\/tools\/(WebFetchTool|WebSearchTool)\.tsx?$/.test(normalized)) return 'web-network-tool'
  if (/^src\/tools\/(AskUserQuestionTool|BriefTool|CollectEvidenceTool|RunNativeTestTool|SyntheticOutputTool)\//.test(normalized) || /^src\/tools\/(AskUserQuestionTool|BriefTool|SyntheticOutputTool)\.tsx?$/.test(normalized)) return 'evidence-output-tool'
  if (/^src\/tools\/(testing|shared)\//.test(normalized) || /^src\/tools\/(schema-lint|utils)\.ts$/.test(normalized)) return 'test-compat-tool'
  return 'unmapped-tool-core'
}

function agentToolSliceForPath(path: string): ToolRuntimeAgentToolGroup {
  const normalized = normalizedPath(path)
  if (/^src\/tools\/AgentTool\/(AgentTool|constants|UI)\.tsx?$/.test(normalized)) return 'agent-entry-lifecycle'
  if (/^src\/tools\/AgentTool\/(runAgent|forkSubagent|resumeAgent|agentToolUtils)\.ts$/.test(normalized)) return 'agent-execution-runner'
  if (/^src\/tools\/AgentTool\/(builtInAgents|loadAgentsDir|prompt)\.ts$/.test(normalized) || /^src\/tools\/AgentTool\/built-in\//.test(normalized)) return 'agent-registry-prompt'
  if (/^src\/tools\/AgentTool\/(agentMemory|agentMemorySnapshot)\.ts$/.test(normalized)) return 'agent-memory-context'
  if (/^src\/tools\/AgentTool\/(agentColorManager|agentDisplay)\.ts$/.test(normalized)) return 'agent-visible-state'
  return 'unmapped-agent-tool'
}

function externalIntegrationSliceForPath(path: string): ToolRuntimeExternalIntegrationGroup {
  const normalized = normalizedPath(path)
  if (/^src\/native-ts\//.test(normalized)) return 'native-runtime-adapter'
  if (/^src\/plugins\//.test(normalized)) return 'plugin-bundle-adapter'
  if (/^src\/server\//.test(normalized)) return 'direct-connect-server-adapter'
  if (/^src\/(moreright|local-work|mcp|ide|terminal|shell|network|browser)\//.test(normalized)) return 'product-compat-adapter'
  return 'unmapped-external-integration'
}

function idForGroup(group: ToolRuntimeDirtyGroup): ToolRuntimeDirtyReviewBatchId {
  if (group === 'support-services') return 'TRR-01'
  if (group === 'commands') return 'TRR-02'
  if (group === 'tools-core') return 'TRR-03'
  if (group === 'agent-tool') return 'TRR-04'
  if (group === 'external-integration') return 'TRR-05'
  return 'TRR-99'
}

function ownerForGroup(group: ToolRuntimeDirtyGroup): string {
  if (group === 'support-services') return 'Support Service Collapse'
  if (group === 'commands') return 'Command Surface Mapping'
  if (group === 'tools-core') return 'Tool Core Mapping'
  if (group === 'agent-tool') return 'Agent Tool Mapping'
  return 'External Integration Mapping'
}

function targetMainlineForGroup(group: ToolRuntimeDirtyGroup): string {
  if (group === 'support-services') return 'single tool lifecycle helpers under DSXU tool/evidence owner'
  if (group === 'commands') return 'command facade routed through query-loop and tool lifecycle'
  if (group === 'tools-core') return 'DSXU ToolBus / Tool Evidence Pack'
  if (group === 'agent-tool') return 'DSXU serial_worker / parallel_fanout Agent owner'
  return 'DSXU adapter layer with permission and evidence hooks'
}

function supportSliceIdForGroup(group: ToolRuntimeSupportServiceGroup): ToolRuntimeSupportServiceSliceId {
  if (group === 'permission-safety') return 'TRR-01A'
  if (group === 'provider-cost') return 'TRR-01B'
  if (group === 'mcp-plugin-skill') return 'TRR-01C'
  if (group === 'context-memory-resume') return 'TRR-01D'
  if (group === 'source-analysis-evidence') return 'TRR-01E'
  if (group === 'product-surface-hooks') return 'TRR-01F'
  if (group === 'telemetry-diagnostics') return 'TRR-01G'
  return 'TRR-01H'
}

function supportSliceOwnerForGroup(group: ToolRuntimeSupportServiceGroup): string {
  if (group === 'permission-safety') return 'Permission / Tool Gate'
  if (group === 'provider-cost') return 'Model Router / Cost Evidence'
  if (group === 'mcp-plugin-skill') return 'MCP / Skill Registry'
  if (group === 'context-memory-resume') return 'Context / Memory / Resume'
  if (group === 'source-analysis-evidence') return 'Source Truth / Evidence'
  if (group === 'product-surface-hooks') return 'Product Surface Visible State'
  if (group === 'telemetry-diagnostics') return 'Trace / Diagnostics Evidence'
  return 'Shared Runtime Utility Owner'
}

function supportSliceTargetForGroup(group: ToolRuntimeSupportServiceGroup): string {
  if (group === 'permission-safety') return 'tool-gate-v1 and permission visible recovery'
  if (group === 'provider-cost') return 'DeepSeek model router, provider usage, and cost evidence'
  if (group === 'mcp-plugin-skill') return 'single MCP adapter and skills registry path'
  if (group === 'context-memory-resume') return 'Context Owner Rule, compact, memory, and resume snapshot'
  if (group === 'source-analysis-evidence') return 'source truth, static analysis, and evidence artifacts'
  if (group === 'product-surface-hooks') return 'TUI/product visible state fed by query-loop and evidence'
  if (group === 'telemetry-diagnostics') return 'trace, diagnostics, and final report evidence'
  return 'shared helper imported by exactly one mainline owner'
}

function supportSliceRiskForGroup(group: ToolRuntimeSupportServiceGroup): ToolRuntimeSupportServiceSlice['duplicateSystemRisk'] {
  if (group === 'permission-safety' || group === 'provider-cost' || group === 'mcp-plugin-skill') return 'high'
  if (group === 'context-memory-resume' || group === 'source-analysis-evidence' || group === 'product-surface-hooks') return 'medium'
  return 'low'
}

function supportSliceDispositionForGroup(group: ToolRuntimeSupportServiceGroup): ToolRuntimeSupportServiceDisposition {
  if (group === 'permission-safety') return 'merge-to-permission-tool-gate'
  if (group === 'provider-cost') return 'merge-to-provider-cost-owner'
  if (group === 'mcp-plugin-skill') return 'merge-to-skill-mcp-owner'
  if (group === 'context-memory-resume') return 'merge-to-context-memory-owner'
  if (group === 'source-analysis-evidence') return 'map-to-source-evidence-owner'
  if (group === 'product-surface-hooks') return 'map-to-product-surface-owner'
  if (group === 'telemetry-diagnostics') return 'map-to-trace-diagnostics-owner'
  return 'keep-shared-helper-with-owner'
}

function supportSliceRequiredActionForGroup(group: ToolRuntimeSupportServiceGroup): string {
  if (group === 'permission-safety') return 'prove permission helpers enter Tool Gate, visible wait, deny, and recovery evidence'
  if (group === 'provider-cost') return 'prove provider helpers enter model routing, cache, usage, and final cost evidence'
  if (group === 'mcp-plugin-skill') return 'prove dynamic MCP and skills enter the single registry, parser, permission, and trace path'
  if (group === 'context-memory-resume') return 'prove memory and session helpers obey source truth and compact/resume owner rules'
  if (group === 'source-analysis-evidence') return 'prove file/source helpers produce bounded source evidence and do not execute tools directly'
  if (group === 'product-surface-hooks') return 'prove UI hooks are visible projections of query-loop/tool evidence, not a second runtime'
  if (group === 'telemetry-diagnostics') return 'prove telemetry and diagnostics observe events without owning execution decisions'
  return 'assign a concrete mainline owner or quarantine the helper before closing TRR-01'
}

function classifyPermissionImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)
  const symbolSet = new Set(symbols)

  if (
    (/^src\/dsxu\/engine\/permissions\.ts$/.test(normalized) && symbolSet.has('PermissionManager')) ||
    (/^src\/dsxu\/engine\/runtime-core\.ts$/.test(normalized) && symbolSet.has('PermissionManager')) ||
    (/^src\/dsxu\/engine\/skills-executor\.ts$/.test(normalized) && symbolSet.has('PermissionManager')) ||
    (/^src\/dsxu\/engine\/index\.ts$/.test(normalized) && symbolSet.has('PermissionManager'))
  ) {
    return {
      owner: 'forbidden-second-permission-runtime',
      allowed: false,
      reason: 'defines or imports a standalone PermissionManager instead of entering Tool Gate',
    }
  }

  if (
    /^src\/dsxu\/engine\/(tool-gate-v1|tool-mainline-runtime-v1|tool-types-v1|engine-tool-adapter|builtin-tools|runtime-core|permissions|permission-prompt-v1|permission-usability)\.ts$/.test(normalized) ||
    /^src\/dsxu\/engine\/(adapters|tool-registry-v1|types)\b/.test(normalized) ||
    /^src\/services\/tools\//.test(normalized) ||
    /^src\/(Tool|tools)\.ts$/.test(normalized) ||
    /^src\/tools\/(AgentTool|AskUserQuestionTool|EnterPlanModeTool|ExitPlanModeTool|FileEditTool|FileReadTool|FileWriteTool|GlobTool|GrepTool|LSPTool|MCPTool|McpAuthTool|NotebookEditTool|SkillTool|SyntheticOutputTool|TaskOutputTool|ToolSearchTool|WebFetchTool|WebSearchTool)\//.test(normalized) ||
    /^src\/utils\/permissions\//.test(normalized) ||
    /^src\/utils\/(analyzeContext|api|attachments|glob|queryContext|toolPool|toolSearch)\.ts$/.test(normalized)
  ) {
    return {
      owner: 'tool-gate',
      allowed: true,
      reason: 'permission helper is consumed by Tool Gate or the single tool lifecycle permission path',
    }
  }

  if (
    /^src\/tools\/(BashTool|PowerShellTool)\//.test(normalized) ||
    /^src\/tasks\/LocalShellTask\//.test(normalized) ||
    /^src\/dsxu\/engine\/(v18-shell-gate|v18-terminal-hit-rate)\.ts$/.test(normalized) ||
    /^src\/utils\/(bash|powershell|shell|sandbox)\//.test(normalized) ||
    /^src\/utils\/(Shell|ShellCommand|argumentSubstitution|collapseReadSearch|memoryFileDetection|stringUtils|promptShellExecution|classifierApprovals|classifierApprovalsHook)\.ts$/.test(normalized) ||
    /^src\/utils\/hooks\/(AsyncHookRegistry|execHttpHook)\.ts$/.test(normalized) ||
    /^src\/utils\/deepLink\/terminalLauncher\.ts$/.test(normalized)
  ) {
    return {
      owner: 'bash-powershell-adapter',
      allowed: true,
      reason: 'permission helper is consumed by Bash/PowerShell adapter or shell execution guard',
    }
  }

  if (
    /^src\/(main|query|QueryEngine|setup|interactiveHelpers)\.tsx?$/.test(normalized) ||
    /^src\/query\//.test(normalized) ||
    /^src\/entrypoints\//.test(normalized) ||
    /^src\/cli\/structuredIO\.ts$/.test(normalized) ||
    /^src\/commands\//.test(normalized) ||
    /^src\/hooks\/(useInboxPoller|useSwarmPermissionPoller|useDirectConnect|useRemoteSession|useSSHSession)\.tsx?$/.test(normalized) ||
    /^src\/services\/(api|awaySummary|compact|internalLogging|PromptSuggestion)\//.test(normalized) ||
    /^src\/services\/(awaySummary|internalLogging)\.ts$/.test(normalized) ||
    /^src\/skills\//.test(normalized) ||
    /^src\/tools\/(SendMessageTool|shared)\//.test(normalized) ||
    /^src\/utils\/(forkedAgent|processUserInput|sessionState)\//.test(normalized) ||
    /^src\/utils\/(forkedAgent|sessionState)\.ts$/.test(normalized) ||
    /^src\/utils\/hooks\.ts$/.test(normalized) ||
    /^src\/utils\/hooks\/(apiQueryHookHelper|execAgentHook|execPromptHook|skillImprovement)\.ts$/.test(normalized) ||
    /^src\/utils\/plugins\/loadPluginCommands\.ts$/.test(normalized) ||
    /^src\/utils\/settings\/applySettingsChange\.ts$/.test(normalized) ||
    /^src\/utils\/swarm\//.test(normalized)
  ) {
    return {
      owner: 'control-plane-permission-bridge',
      allowed: true,
      reason: 'permission helper is projected through control-plane permission request or update bridge',
    }
  }

  if (
    /^src\/cli\/print\.ts$/.test(normalized) ||
    /^src\/components\//.test(normalized) ||
    /^src\/hooks\/(notifs\/)?use[A-Z]/.test(normalized) ||
    /^src\/hooks\/(toolPermission|useCanUseTool|usePromptsFromDsxuBrowserProvider|useCancelRequest|useDiffInIDE)\//.test(normalized) ||
    /^src\/hooks\/(useCanUseTool|usePromptsFromDsxuBrowserProvider|useCancelRequest|useDiffInIDE)\.tsx?$/.test(normalized) ||
    /^src\/screens\//.test(normalized) ||
    /^src\/state\//.test(normalized) ||
    /^src\/types\//.test(normalized) ||
    /^src\/constants\//.test(normalized) ||
    /^src\/utils\/(doctorContextWarnings|doctorDiagnostic|status)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'visible-state-projection',
      allowed: true,
      reason: 'permission helper is consumed by product visible-state projection',
    }
  }

  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: 'caller is not yet proven to enter Tool Gate, shell adapter, control-plane bridge, or visible-state projection',
  }
}

export function buildPermissionToolGateImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  const byPath = new Map<string, ToolRuntimeImportUseObservation[]>()
  for (const observation of observations) {
    const normalized = normalizedPath(observation.callerPath)
    byPath.set(normalized, [...(byPath.get(normalized) ?? []), observation])
  }

  const findings = Array.from(byPath.entries())
    .map(([callerPath, pathObservations]) => {
      const symbols = Array.from(new Set(pathObservations.map(observation => observation.symbol))).sort()
      const classification = classifyPermissionImportUseOwner(callerPath, symbols)
      return {
        callerPath: sanitizePath(callerPath),
        owner: classification.owner,
        allowed: classification.allowed,
        symbols,
        reason: classification.reason,
        sampleEvidence: pathObservations
          .slice(0, 3)
          .map(observation => `${observation.lineNumber ?? '?'}:${sanitizePath(observation.evidence ?? observation.symbol)}`),
        ...(classification.allowed ? {} : {
          forbiddenClosure: forbiddenClosureForImportUseFinding(
            'TRR-01A-permission-tool-gate-import-use',
            callerPath,
            classification.owner,
          ),
        }),
      }
    })
    .sort((left, right) => left.callerPath.localeCompare(right.callerPath))

  const ownerCounts = Array.from(
    findings.reduce((counts, finding) => {
      counts.set(finding.owner, (counts.get(finding.owner) ?? 0) + 1)
      return counts
    }, new Map<ToolRuntimePermissionImportUseOwner, number>()),
  )
    .map(([owner, count]) => ({ owner, count }))
    .sort((left, right) => left.owner.localeCompare(right.owner))
  const forbiddenCallerCount = findings.filter(finding => finding.owner === 'forbidden-second-permission-runtime').length
  const unknownCallerCount = findings.filter(finding => finding.owner === 'unknown-owner').length
  const allowedCallerCount = findings.filter(finding => finding.allowed).length
  const forbiddenClosureCount = findings.filter(finding => finding.forbiddenClosure !== undefined).length
  const redlines = [
    ...(forbiddenCallerCount > 0 ? ['TRR-01A import/use scan found standalone PermissionManager runtime candidate'] : []),
    ...(unknownCallerCount > 0 ? ['TRR-01A import/use scan has callers without proven mainline owner'] : []),
  ]

  return {
    scanId: 'TRR-01A-permission-tool-gate-import-use',
    status: forbiddenCallerCount > 0 ? 'BLOCKED' : unknownCallerCount > 0 ? 'PARTIAL' : 'PASS',
    totalCallerCount: findings.length,
    allowedCallerCount,
    forbiddenCallerCount,
    unknownCallerCount,
    forbiddenClosureCount,
    ownerCounts,
    findings,
    redlines,
  }
}

function forbiddenClosureForImportUseFinding(
  scanId: ToolRuntimeImportUseScanId,
  callerPath: string,
  owner: ToolRuntimeImportUseOwner,
): ToolRuntimeForbiddenRuntimeClosure | undefined {
  const normalized = normalizedPath(callerPath)
  if (owner === 'unknown-owner') return undefined

  if (scanId.startsWith('TRR-04')) {
    if (/^src\/dsxu\/engine\/(runtime-core|index)\.ts$/.test(normalized)) {
      return {
        disposition: 'replace-or-delete-candidate',
        targetOwner: 'single Agent Tool lifecycle owner',
        requiredMigration: 'merge equivalent agent behavior into AgentTool lifecycle, runner, registry, context, or visible-state owner, then remove standalone orchestrator exports or constructors',
        canKeepAsRuntime: false,
      }
    }
    return {
      disposition: 'migrate-to-mainline-owner',
      targetOwner: 'Agent Tool lifecycle plus concrete agent owner',
      requiredMigration: 'route agent behavior through AgentTool lifecycle and its concrete runner/registry/context/visible-state owner instead of retaining a second agent orchestrator',
      canKeepAsRuntime: false,
    }
  }

  if (scanId.startsWith('TRR-05')) {
    return {
      disposition: 'migrate-to-mainline-owner',
      targetOwner: 'external adapter boundary with auth, permission, registry, and evidence hooks',
      requiredMigration: 'keep the integration as an adapter boundary only; merge any lifecycle, query-loop, tool execution, auth, or evidence behavior into the original owner and remove standalone runtime ownership',
      canKeepAsRuntime: false,
    }
  }

  if (scanId.startsWith('TRR-03')) {
    if (/^src\/dsxu\/engine\/(runtime-core|index)\.ts$/.test(normalized)) {
      return {
        disposition: 'replace-or-delete-candidate',
        targetOwner: 'single ToolBus lifecycle owner',
        requiredMigration: 'merge equivalent tool execution behavior into ToolBus/tool-mainline-runtime ownership, then remove standalone runtime exports or constructors',
        canKeepAsRuntime: false,
      }
    }
    return {
      disposition: 'migrate-to-mainline-owner',
      targetOwner: 'ToolBus lifecycle plus concrete tool adapter owner',
      requiredMigration: 'route tool behavior through ToolBus lifecycle and its concrete shell/source/MCP/workflow owner instead of retaining a second tool runtime path',
      canKeepAsRuntime: false,
    }
  }

  if (scanId === 'TRR-01A-permission-tool-gate-import-use') {
    if (/^src\/dsxu\/engine\/index\.ts$/.test(normalized)) {
      return {
        disposition: 'remove-public-export',
        targetOwner: 'tool-gate-v1 public facade only',
        requiredMigration: 'remove PermissionManager export or replace it with Tool Gate evaluation facade after all consumers migrate',
        canKeepAsRuntime: false,
      }
    }
    if (/^src\/dsxu\/engine\/permissions\.ts$/.test(normalized)) {
      return {
        disposition: 'replace-or-delete-candidate',
        targetOwner: 'tool-gate-v1',
        requiredMigration: 'migrate safety classification and permission checks into Tool Gate or shell adapters, then delete standalone stateful PermissionManager',
        canKeepAsRuntime: false,
      }
    }
    return {
      disposition: 'migrate-to-mainline-owner',
      targetOwner: 'tool-gate-v1 + shell adapter permission bridge',
      requiredMigration: 'replace PermissionManager construction/use with Tool Gate evaluation and existing Bash/PowerShell permission adapters',
      canKeepAsRuntime: false,
    }
  }

  if (scanId === 'TRR-01B-provider-cost-import-use') {
    if (/^src\/dsxu\/engine\/index\.ts$/.test(normalized)) {
      return {
        disposition: 'remove-public-export',
        targetOwner: 'Model Router / Cost Evidence facade only',
        requiredMigration: 'stop exporting provider runtime constructors directly; expose only model-router and cost-evidence facade after migration',
        canKeepAsRuntime: false,
      }
    }
    return {
      disposition: 'migrate-to-mainline-owner',
      targetOwner: 'Model Router / Cost Evidence',
      requiredMigration: 'route provider/model calls through the single model router and emit usage/cache/cost evidence',
      canKeepAsRuntime: false,
    }
  }

  if (/^src\/dsxu\/engine\/index\.ts$/.test(normalized)) {
    return {
      disposition: 'remove-public-export',
      targetOwner: 'MCP adapter / Skill registry facade only',
      requiredMigration: 'stop exporting MCP/skill runtime constructors directly; expose only registry or adapter facade after migration',
      canKeepAsRuntime: false,
    }
  }
  return {
    disposition: 'migrate-to-mainline-owner',
    targetOwner: 'single MCP adapter + Skill registry + tool lifecycle',
    requiredMigration: 'replace direct MCP/skill runtime construction with registry, adapter, ToolSearch, and tool lifecycle calls',
    canKeepAsRuntime: false,
  }
}

function buildImportUseScan(
  input: {
    scanId: ToolRuntimeImportUseScanId
    observations: readonly ToolRuntimeImportUseObservation[]
    classify: (
      path: string,
      symbols: readonly string[],
    ) => Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'>
    forbiddenOwner: ToolRuntimeImportUseOwner
    unknownOwner: ToolRuntimeImportUseOwner
    forbiddenRedline: string
    unknownRedline: string
  },
): ToolRuntimePermissionImportUseScan {
  const byPath = new Map<string, ToolRuntimeImportUseObservation[]>()
  for (const observation of input.observations) {
    const normalized = normalizedPath(observation.callerPath)
    byPath.set(normalized, [...(byPath.get(normalized) ?? []), observation])
  }

  const findings = Array.from(byPath.entries())
    .map(([callerPath, pathObservations]) => {
      const symbols = Array.from(new Set(pathObservations.map(observation => observation.symbol))).sort()
      const classification = input.classify(callerPath, symbols)
      return {
        callerPath: sanitizePath(callerPath),
        owner: classification.owner,
        allowed: classification.allowed,
        symbols,
        reason: classification.reason,
        sampleEvidence: pathObservations
          .slice(0, 3)
          .map(observation => `${observation.lineNumber ?? '?'}:${sanitizePath(observation.evidence ?? observation.symbol)}`),
        ...(classification.allowed ? {} : {
          forbiddenClosure: forbiddenClosureForImportUseFinding(
            input.scanId,
            callerPath,
            classification.owner,
          ),
        }),
      }
    })
    .sort((left, right) => left.callerPath.localeCompare(right.callerPath))

  const ownerCounts = Array.from(
    findings.reduce((counts, finding) => {
      counts.set(finding.owner, (counts.get(finding.owner) ?? 0) + 1)
      return counts
    }, new Map<ToolRuntimeImportUseOwner, number>()),
  )
    .map(([owner, count]) => ({ owner, count }))
    .sort((left, right) => left.owner.localeCompare(right.owner))
  const forbiddenCallerCount = findings.filter(finding => finding.owner === input.forbiddenOwner).length
  const unknownCallerCount = findings.filter(finding => finding.owner === input.unknownOwner).length
  const allowedCallerCount = findings.filter(finding => finding.allowed).length
  const forbiddenClosureCount = findings.filter(finding => finding.forbiddenClosure !== undefined).length
  const redlines = [
    ...(forbiddenCallerCount > 0 ? [input.forbiddenRedline] : []),
    ...(unknownCallerCount > 0 ? [input.unknownRedline] : []),
  ]

  return {
    scanId: input.scanId,
    status: forbiddenCallerCount > 0 ? 'BLOCKED' : unknownCallerCount > 0 ? 'PARTIAL' : 'PASS',
    totalCallerCount: findings.length,
    allowedCallerCount,
    forbiddenCallerCount,
    unknownCallerCount,
    forbiddenClosureCount,
    ownerCounts,
    findings,
    redlines,
  }
}

function classifyProviderImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)
  const symbolSet = new Set(symbols)

  if (
    (/^src\/dsxu\/engine\/api-service\.ts$/.test(normalized) && symbolSet.has('createLLMCall')) ||
    (/^src\/dsxu\/engine\/index\.ts$/.test(normalized) && (symbolSet.has('createDirectLLMCall') || symbolSet.has('createProxyLLMCall'))) ||
    (/^src\/dsxu\/engine\/runtime-core\.ts$/.test(normalized) && symbolSet.has('createLLMCall'))
  ) {
    return {
      owner: 'forbidden-second-provider-runtime',
      allowed: false,
      reason: 'defines or exports provider/model call runtime outside the single model router and cost evidence path',
    }
  }

  if (
    /^src\/utils\/model\//.test(normalized) ||
    (/^src\/dsxu\/engine\/index\.ts$/.test(normalized) &&
      symbolSet.has('createPreferredDSXULLMCall') &&
      !symbolSet.has('createDirectLLMCall') &&
      !symbolSet.has('createProxyLLMCall')) ||
    (/^src\/dsxu\/engine\/runtime-core\.ts$/.test(normalized) &&
      symbolSet.has('createPreferredDSXULLMCall') &&
      !symbolSet.has('createLLMCall') &&
      !symbolSet.has('createDirectLLMCall')) ||
    /^src\/dsxu\/engine\/(adr-review|brief\/brief-generator|classify\/classifier|cold-mode-cost-planning|compact|compact\/compact-pipeline|config|context-builder|context-window-manager-v1|deepseek-model-policy|effort-routing|gear-box|llm-adapter|memory-extractor|memory-pipeline|model-limits|model-config|model-routing-control|problem-slicer|proxy-budget-guard|session-adapter|token-estimator|types|v18-real-task-route-plan)\.ts$/.test(normalized) ||
    /^src\/(query|query\/tokenBudget)\.ts$/.test(normalized) ||
    /^src\/services\/sampling-policy\.ts$/.test(normalized)
  ) {
    return {
      owner: 'model-router',
      allowed: true,
      reason: 'model route or budget helper feeds the single model router policy',
    }
  }

  if (/^src\/services\/api\//.test(normalized) || /^src\/dsxu\/engine\/api-service\.ts$/.test(normalized)) {
    return {
      owner: 'provider-adapter',
      allowed: true,
      reason: 'provider helper is consumed by the API/provider adapter layer',
    }
  }

  if (
    /^src\/dsxu\/engine\/cost-tracker\.ts$/.test(normalized) ||
    /^src\/cost-tracker\.ts$/.test(normalized) ||
    /^src\/dsxu\/cost\//.test(normalized) ||
    /^src\/dsxu\/engine\/(final-report-usage-evidence|skills-adapter|skills-executor|v19-cost-cache-live-task-evidence)\.ts$/.test(normalized) ||
    /^src\/services\/(tokenEstimation|cache-stats|rateLimit|policyLimits|dsxuLimits)\b/.test(normalized) ||
    /^src\/utils\/(tokens|tokenBudget|extraUsage|context)\.ts$/.test(normalized)
  ) {
    return {
      owner: 'cost-evidence',
      allowed: true,
      reason: 'usage, token, cache, or cost helper feeds cost evidence',
    }
  }

  if (
    /^src\/dsxu\/legacy\/model\//.test(normalized) ||
    /^src\/utils\/model\/agent\.ts$/.test(normalized)
  ) {
    return {
      owner: 'legacy-provider-compat',
      allowed: true,
      reason: 'legacy model name compatibility maps into DeepSeek V4 model routing',
    }
  }

  if (
    /^src\/components\//.test(normalized) ||
    /^src\/hooks\//.test(normalized) ||
    /^src\/cli\//.test(normalized) ||
    /^src\/(bootstrap\/state|constants\/prompts|screens\/REPL|tools\/FileReadTool\/FileReadTool|utils\/attachments)\.tsx?$/.test(normalized) ||
    /^src\/services\/(compact|PromptSuggestion|awaySummary)\//.test(normalized) ||
    /^src\/services\/SessionMemory\/prompts\.ts$/.test(normalized) ||
    /^src\/dsxu\/engine\/__tests__\//.test(normalized)
  ) {
    return {
      owner: 'final-report-usage-evidence',
      allowed: true,
      reason: 'caller consumes model or cost state as visible/final evidence',
    }
  }

  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: 'provider/cost caller is not yet proven to enter model router, provider adapter, or cost evidence',
  }
}

export function buildProviderCostImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-01B-provider-cost-import-use',
    observations,
    classify: classifyProviderImportUseOwner,
    forbiddenOwner: 'forbidden-second-provider-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-01B import/use scan found provider/model runtime outside model router',
    unknownRedline: 'TRR-01B import/use scan has callers without proven model-router or cost owner',
  })
}

function classifyMcpSkillImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)
  const symbolSet = new Set(symbols)

  if (
    /^src\/dsxu\/engine\/index\.ts$/.test(normalized) &&
    (symbolSet.has('MCPManager') || symbolSet.has('SkillsAdapter')) &&
    !symbolSet.has('MCPConnection') &&
    !symbolSet.has('MCPTool')
  ) {
    return {
      owner: 'tool-lifecycle',
      allowed: true,
      reason: 'public engine entrypoint wires QueryEngine to MCP and Skill owners without re-exporting their runtime constructors',
    }
  }

  if (
    (/^src\/dsxu\/engine\/index\.ts$/.test(normalized) && (symbolSet.has('MCPConnection') || symbolSet.has('MCPTool'))) ||
    (/^src\/dsxu\/engine\/skills-executor\.ts$/.test(normalized) &&
      symbolSet.has('SkillsExecutor') &&
      !(symbolSet.has('buildSkillToolGateDefinition') && symbolSet.has('evaluateToolGate'))) ||
    (/^src\/dsxu\/engine\/skills-adapter\.ts$/.test(normalized) && symbolSet.has('SkillsExecutor')) ||
    (/^src\/dsxu\/engine\/runtime-core\.ts$/.test(normalized) && (symbolSet.has('MCPManager') || symbolSet.has('SkillsExecutor')))
  ) {
    return {
      owner: 'forbidden-second-mcp-skill-runtime',
      allowed: false,
      reason: 'defines or constructs MCP/skills execution runtime outside the single MCP adapter and skill registry path',
    }
  }

  if (
    /^src\/dsxu\/engine\/skills-executor\.ts$/.test(normalized) &&
    symbolSet.has('buildSkillToolGateDefinition') &&
    symbolSet.has('evaluateToolGate')
  ) {
    return {
      owner: 'tool-lifecycle',
      allowed: true,
      reason: 'skill execution consumes the Skill Registry gate contract and Tool Gate instead of owning an MCP/skill runtime',
    }
  }

  if (
    /^src\/dsxu\/engine\/skills-adapter\.ts$/.test(normalized) &&
    symbolSet.has('buildSkillToolGateDefinition') &&
    symbolSet.has('evaluateToolGate') &&
    !symbolSet.has('SkillsExecutor')
  ) {
    return {
      owner: 'skill-registry',
      allowed: true,
      reason: 'skill adapter consumes the Skill Registry gate contract and Tool Gate without owning a second skill executor',
    }
  }

  if (
    /^src\/dsxu\/engine\/tool-gate-v1\.ts$/.test(normalized) ||
    (/^src\/dsxu\/engine\/permissions\.ts$/.test(normalized) && symbolSet.has('evaluateToolGate'))
  ) {
    return {
      owner: 'tool-lifecycle',
      allowed: true,
      reason: 'Tool Gate permission helper is consumed by skill and tool lifecycle paths without owning MCP/skill execution',
    }
  }

  if (
    /^src\/dsxu\/engine\/runtime-core\.ts$/.test(normalized) &&
    !symbolSet.has('MCPManager') &&
    !symbolSet.has('SkillsExecutor')
  ) {
    return {
      owner: 'tool-lifecycle',
      allowed: true,
      reason: 'runtime-core references MCP/skill/tool-search capabilities only through tool lifecycle evidence after constructor exports were removed',
    }
  }

  if (
    /^src\/services\/mcp\//.test(normalized) ||
    /^src\/dsxu\/engine\/mcp-client\.ts$/.test(normalized) ||
    /^src\/dsxu\/engine\/graph\/graph-memory\.ts$/.test(normalized) ||
    /^src\/tools\/MCPTool\//.test(normalized) ||
    /^src\/tools\/McpAuthTool\//.test(normalized) ||
    /^src\/utils\/(mcp|mcpValidation|mcpWebSocketTransport|mcpOutputStorage|mcpInstructionsDelta|desktopMcpImport)\.ts$/.test(normalized)
  ) {
    return {
      owner: 'mcp-adapter',
      allowed: true,
      reason: 'MCP helper is consumed by MCP adapter/tool lifecycle path',
    }
  }

  if (
    /^src\/skills\//.test(normalized) ||
    /^src\/dsxu\/engine\/skills-registry-v1\.ts$/.test(normalized) ||
    /^src\/dsxu\/engine\/legacy-mainline-dirty-review-v1\.ts$/.test(normalized) ||
    /^src\/tools\/SkillTool\//.test(normalized) ||
    /^src\/tools\/(FileEditTool|FileReadTool|FileWriteTool)\//.test(normalized) ||
    /^src\/commands(\.ts|\/)/.test(normalized) ||
    /^src\/utils\/skills\//.test(normalized) ||
    /^src\/utils\/(frontmatterParser|promptShellExecution)\.ts$/.test(normalized) ||
    /^src\/utils\/plugins\/(cacheUtils|loadPluginCommands|refresh)\.ts$/.test(normalized)
  ) {
    return {
      owner: 'skill-registry',
      allowed: true,
      reason: 'skill helper is consumed by the skill registry, Skill tool bridge, or dirty owner evidence mapping',
    }
  }

  if (
    /^src\/services\/tools\//.test(normalized) ||
    /^src\/dsxu\/engine\/(dsxu-integrations-v1|engine-tool-adapter)\.ts$/.test(normalized) ||
    /^src\/tools\/ToolSearchTool\//.test(normalized) ||
    /^src\/tools\.ts$/.test(normalized) ||
    /^src\/utils\/toolSearch\.ts$/.test(normalized) ||
    /^src\/utils\/(analyzeContext|attachments|collapseReadSearch|hooks|messages)\.ts$/.test(normalized) ||
    /^src\/utils\/permissions\/classifierDecision\.ts$/.test(normalized) ||
    /^src\/services\/(compact|tokenEstimation)\//.test(normalized) ||
    /^src\/services\/(tokenEstimation)\.ts$/.test(normalized) ||
    /^src\/utils\/attachments\.ts$/.test(normalized) ||
    /^src\/services\/api\/dsxuTransport\.ts$/.test(normalized)
  ) {
    return {
      owner: 'tool-search-projection',
      allowed: true,
      reason: 'dynamic tool/MCP discovery is projected through ToolSearch or tool lifecycle',
    }
  }

  if (
    /^src\/components\//.test(normalized) ||
    /^src\/hooks\//.test(normalized) ||
    /^src\/(cli|constants|entrypoints|main|screens|state|types)\//.test(normalized) ||
    /^src\/(constants\/tools|entrypoints\/sdk\/coreSchemas|main|screens\/REPL|state\/AppStateStore|types\/hooks)\.tsx?$/.test(normalized) ||
    /^src\/services\/api\/deepseek-adapter\.ts$/.test(normalized) ||
    /^src\/dsxu\/engine\/phase12-product-window-oracle-v1\.ts$/.test(normalized) ||
    /^src\/dsxu\/engine\/(high-pressure-reference-absorption-contract|next-stage-productization-contract|product-reality-hardening-contract|reference-experience-quality-contract|reference-governance-absorption-contract|v10-reference-behavior-productization-contract|v6-mainline-completion-contract|v7-productization-contract|v8-product-build-contract|v9-reference-absorption-completion-contract)\.ts$/.test(normalized) ||
    /^src\/utils\/(computerUse|dsxuBrowserProvider)\//.test(normalized)
  ) {
    return {
      owner: 'mcp-visible-state-projection',
      allowed: true,
      reason: 'caller renders or projects MCP/skill visible state',
    }
  }

  if (/^src\/dsxu\/engine\/tool-mainline-runtime-v1\.ts$/.test(normalized)) {
    return {
      owner: 'tool-lifecycle',
      allowed: true,
      reason: 'MCP/skill helper enters the single tool lifecycle runtime',
    }
  }

  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: 'MCP/skill caller is not yet proven to enter MCP adapter, skill registry, ToolSearch, or tool lifecycle',
  }
}

export function buildMcpSkillRegistryImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-01C-mcp-skill-registry-import-use',
    observations,
    classify: classifyMcpSkillImportUseOwner,
    forbiddenOwner: 'forbidden-second-mcp-skill-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-01C import/use scan found MCP/skill runtime outside registry or tool lifecycle',
    unknownRedline: 'TRR-01C import/use scan has callers without proven MCP/skill owner',
  })
}

function classifyContextMemoryImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)
  if (
    /^src\/services\/(compact|autoDream|SessionMemory|teamMemorySync|extractMemories|experience|snapshot)\b/.test(normalized) ||
    /^src\/utils\/(memory|memoryFileDetection|teamMemoryOps|teamMemoryContext|teamMemoryMailbox)\b/.test(normalized)
  ) {
    return {
      owner: 'memory-store',
      allowed: true,
      reason: 'memory helper is owned by Context/Memory/Resume and cannot override source truth',
    }
  }
  if (
    /^src\/(bootstrap|commands|constants|entrypoints|memdir|query|tasks)\//.test(normalized) ||
    /^src\/(commands|context|history|setup|dialogLaunchers|main|query|QueryEngine|Tool)\.tsx?$/.test(normalized) ||
    /^src\/(services\/api|services\/lsp|services\/mcp|services\/PromptSuggestion|services\/tips|services\/tokenEstimation|services\/tools|services\/toolUseSummary|services\/vcr)\b/.test(normalized) ||
    /^src\/services\/(AgentSummary|analytics|awaySummary)\b/.test(normalized) ||
    /^src\/(skills|tools)\//.test(normalized) ||
    /^src\/utils\/(conversationRecovery|crossProjectResume|session|sessionStorage|sessionState|sessionTitle|sessionUrl|listSessionsImpl|forkedAgent|agentContext|teammate|teammateMailbox|teammateContext)\b/.test(normalized) ||
    /^src\/(context|history|setup)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'resume-session-control',
      allowed: true,
      reason: 'resume/session helper is controlled by session recovery owner',
    }
  }
  if (
    /^src\/dsxu\/engine\//.test(normalized) ||
    /^src\/dsxu\/legacy\/model\//.test(normalized) ||
    /^src\/(cli|types)\//.test(normalized) ||
    /^src\/keybindings\//.test(normalized) ||
    /^src\/utils\//.test(normalized) ||
    /^src\/utils\/(analyzeContext|context|contextAnalysis|contextSuggestions|readEditContext|fileRead|fileReadCache|fileStateCache|collapseReadSearch|message|messages|attachments|controlMessageCompat)\b/.test(normalized) ||
    /^src\/dsxu\/engine\/(context-owner-rule-v1|prompt-processing-v1|dsxu-conversation-control|dsxu-session-cache-control|query-loop)\.ts$/.test(normalized)
  ) {
    return {
      owner: 'context-owner',
      allowed: true,
      reason: 'context helper feeds the single query-loop context owner',
    }
  }
  if (
    /^src\/(assistant|buddy|components|hooks|screens|state)\//.test(normalized) ||
    /^src\/utils\/(advisor|teleport|status|stats|statsCache)\b/.test(normalized)
  ) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'context state is projected to product-visible state only',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `context/memory caller is not yet mapped to a concrete owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildContextMemoryResumeImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-01D-context-memory-resume-import-use',
    observations,
    classify: classifyContextMemoryImportUseOwner,
    forbiddenOwner: 'forbidden-second-context-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-01D import/use scan found second context/memory runtime owner',
    unknownRedline: 'TRR-01D import/use scan has callers without proven context/memory owner',
  })
}

function classifySourceEvidenceImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)
  if (
    /^src\/(cli|constants|entrypoints|main|memdir|native-ts)\//.test(normalized) ||
    /^src\/(main|query|QueryEngine|Tool|tools)\.tsx?$/.test(normalized) ||
    /^src\/dsxu\/engine\//.test(normalized) ||
    /^src\/(services\/compact|services\/mcp)\b/.test(normalized) ||
    /^src\/(skills|types)\//.test(normalized) ||
    /^src\/services\/(static-analysis|lsp|swe-bench|eval|toolUseSummary|AgentSummary)\b/.test(normalized) ||
    /^src\/utils\/(QueryGuard|api|attachments|background|bash|cleanup|conversationRecovery|doctorDiagnostic|embeddedTools|forkedAgent|githubRepoPathMapping|handlePromptSubmit|markdownConfigLoader|mcpOutputStorage|nativeInstaller|pdf|permissions|plugins|processUserInput|promptShellExecution|sandbox|search|sessionRestore|sessionStorage|settings|shell|swarm|teleport)\b/.test(normalized) ||
    /^src\/utils\/(QueryGuard|detectRepository|git|gitDiff|github|ghPrStatus|diff|worktree|worktreeModeEnabled|getWorktreePaths|glob|ripgrep|codeIndexing|readFileInRange|vendorToolPaths|vendor|file|fsOperations|generatedFiles|preflightChecks|queryHelpers|todo|toolErrors|toolPool|toolResultStorage|toolSchemaCache)\b/.test(normalized)
  ) {
    return {
      owner: 'source-truth',
      allowed: true,
      reason: 'source/evidence helper is bounded by source truth and evidence artifact ownership',
    }
  }
  if (
    /^src\/tools\/(GrepTool|GlobTool|FileReadTool|LSPTool|TaskOutputTool|ToolSearchTool)\//.test(normalized) ||
    /^src\/services\/tools\//.test(normalized) ||
    /^src\/dsxu\/engine\/(tool-mainline-runtime-v1|engine-tool-adapter|tool-bus)\b/.test(normalized)
  ) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'source helper output is attached to Tool Evidence Pack or bounded tool result storage',
    }
  }
  if (
    /^src\/(components|hooks|screens|tools)\//.test(normalized) ||
    /^src\/commands\/(diff|files|review|issue|pr_comments|branch|add-dir)\b/.test(normalized)
  ) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'source evidence is only displayed or requested by product/command surface',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `source/evidence caller is not yet mapped to a concrete owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildSourceAnalysisEvidenceImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-01E-source-analysis-evidence-import-use',
    observations,
    classify: classifySourceEvidenceImportUseOwner,
    forbiddenOwner: 'forbidden-second-source-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-01E import/use scan found second source/evidence runtime owner',
    unknownRedline: 'TRR-01E import/use scan has callers without proven source/evidence owner',
  })
}

function classifyProductSurfaceImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)
  if (
    /^src\/(assistant|buddy|cli|components|context|dialogLaunchers|hooks|screens|state|ink|keybindings)\//.test(normalized) ||
    /^src\/(commands|context|dialogLaunchers|interactiveHelpers|ink|main|query|QueryEngine|Tool)\.tsx?$/.test(normalized) ||
    /^src\/(commands|entrypoints|native-ts|query|server|skills|tasks|tools|types|voice)\//.test(normalized) ||
    /^src\/commands\/(advisor|chrome|color|config|copy|desktop|help|ide|keybindings|mobile|onboarding|output-style|privacy-settings|rename|status|stickers|tag|terminalSetup|theme|upgrade|vim|voice)\b/.test(normalized)
  ) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'product surface helper renders or updates visible state only',
    }
  }
  if (
    /^src\/dsxu\/engine\//.test(normalized) ||
    /^src\/provider-backend\//.test(normalized) ||
    /^src\/services\/(api|mcp)\b/.test(normalized) ||
    /^src\/utils\//.test(normalized) ||
    /^src\/utils\/(config|configConstants|settings|cwd|theme|statusNotice|prompt|promptEditor|promptCategory|browser|clipboard|editor|ide|jetbrains|keyboardShortcuts|logoV2Utils|markdown|pdf|image|terminal|terminalPanel|renderOptions|horizontalScroll|fullscreen|pasteStore|teleport)\b/.test(normalized) ||
    /^src\/services\/(tips|PromptSuggestion|remoteManagedSettings|settingsSync|notifier|preventSleep|awaySummary|voice|voiceStreamSTT|voiceKeyterms)\b/.test(normalized)
  ) {
    return {
      owner: 'product-config-surface',
      allowed: true,
      reason: 'product/config helper projects existing owner state and cannot own execution decisions',
    }
  }
  if (/^src\/utils\/(dsxuBrowserProvider|deepLink|computerUse)\//.test(normalized)) {
    return {
      owner: 'ide-terminal-surface',
      allowed: true,
      reason: 'IDE/browser/terminal surface remains an adapter projection with hooks',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `product surface caller is not yet mapped to a concrete owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildProductSurfaceHooksImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-01F-product-surface-hooks-import-use',
    observations,
    classify: classifyProductSurfaceImportUseOwner,
    forbiddenOwner: 'forbidden-second-product-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-01F import/use scan found product surface owning a second runtime',
    unknownRedline: 'TRR-01F import/use scan has callers without proven product surface owner',
  })
}

function classifyTelemetryDiagnosticsImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)
  if (
    /^src\/(cli|commands|entrypoints|services|tools|utils)\//.test(normalized) ||
    /^src\/(commands|context|cost-tracker|history|interactiveHelpers|main|query|setup|Tool)\.tsx?$/.test(normalized) ||
    /^src\/(constants|dsxu\/legacy|ink|keybindings|migrations|outputStyles|plugins|skills|voice)\//.test(normalized) ||
    /^src\/services\/(analytics|diagnosticTracking|internalLogging|vcr)\b/.test(normalized) ||
    /^src\/utils\/(telemetry|telemetryAttributes|unaryLogging|stats|statsCache)\b/.test(normalized)
  ) {
    return {
      owner: 'analytics-sink',
      allowed: true,
      reason: 'analytics helper records lifecycle events without deciding execution',
    }
  }
  if (
    /^src\/dsxu\/engine\//.test(normalized) ||
    /^src\/(bootstrap|coordinator|memdir|native-ts|query|server|tasks|types)\//.test(normalized) ||
    /^src\/(QueryEngine)\.tsx?$/.test(normalized) ||
    /^src\/utils\/(profiler|startupProfiler|headlessProfiler|queryProfiler|errorLogSink|warningHandler|heapDumpService|debug|debugFilter|diagLogs|doctorDiagnostic|log|slowOperations|fpsTracker|activityManager|sinks)\b/.test(normalized) ||
    /^src\/commands\/(ant-trace|debug-tool-call|doctor|heapdump|passes|perf-issue|stats)\b/.test(normalized)
  ) {
    return {
      owner: 'diagnostics-trace',
      allowed: true,
      reason: 'diagnostics helper observes and traces existing lifecycle state',
    }
  }
  if (
    /^src\/dsxu\/engine\/(final-report|final-report-usage-evidence|tool-evidence|trace)\b/.test(normalized) ||
    /^src\/(assistant|buddy|components|context|hooks|screens|state)\//.test(normalized)
  ) {
    return {
      owner: 'observability-projection',
      allowed: true,
      reason: 'diagnostic data is projected into reports or product state only',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `telemetry/diagnostics caller is not yet mapped to a concrete owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildTelemetryDiagnosticsImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-01G-telemetry-diagnostics-import-use',
    observations,
    classify: classifyTelemetryDiagnosticsImportUseOwner,
    forbiddenOwner: 'forbidden-second-diagnostics-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-01G import/use scan found telemetry owning execution decisions',
    unknownRedline: 'TRR-01G import/use scan has callers without proven diagnostics owner',
  })
}

function classifySharedUtilityImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (
    /^src\/services\/oauth\//.test(normalized) ||
    /^src\/utils\/(auth|authFileDescriptor|authPortable|aws|awsAuthStatusManager|crypto|fingerprint|secureStorage|mtls|caCerts|caCertsConfig|privacyLevel|user)\b/.test(normalized) ||
    /^src\/utils\/sessionIngressAuth\.ts$/.test(normalized) ||
    /^src\/dsxu\/legacy\/auth\//.test(normalized) ||
    /^src\/(entrypoints|services\/api)\//.test(normalized)
  ) {
    return {
      owner: 'auth-control-plane',
      allowed: true,
      reason: 'auth and secret helpers are consumed through provider or control-plane boundaries',
    }
  }

  if (/^src\/utils\/permissions\//.test(normalized)) {
    return {
      owner: 'tool-gate',
      allowed: true,
      reason: 'permission shared helpers are owned by the Tool Gate path, not a side permission runtime',
    }
  }

  if (
    /^src\/tools\/(BashTool|PowerShellTool|FileEditTool|FileReadTool|FileWriteTool|MCPTool|SkillTool)\//.test(normalized) ||
    /^src\/tools\/(AgentTool|BriefTool|CollectEvidenceTool|ConfigTool|EnterWorktreeTool|ExitWorktreeTool|LSPTool|RemoteTriggerTool|REPLTool|RunNativeTestTool|SendMessageTool|WorkflowTool|shared)\//.test(normalized) ||
    /^src\/tools\.ts$/.test(normalized) ||
    /^src\/services\/tools\//.test(normalized) ||
    /^src\/tasks\/(LocalShellTask|LocalAgentTask|LocalMainSessionTask|RemoteAgentTask)\//.test(normalized) ||
    /^src\/tasks\/(LocalMainSessionTask)\.ts$/.test(normalized) ||
    /^src\/utils\/(embeddedTools|hooks|powershell|shell|swarm)\b/.test(normalized) ||
    /^src\/utils\/(Shell|tmuxSocket)\.tsx?$/.test(normalized) ||
    /^src\/utils\/(bash|computerUse|deepLink|dsxuBrowserProvider)\//.test(normalized) ||
    /^src\/utils\/(getWorktreePaths|commitAttribution|doctorDiagnostic|autoUpdater)\.ts$/.test(normalized) ||
    /^src\/utils\/(execFileNoThrow|execFileNoThrowPortable|execSyncWrapper|process|genericProcessUtils|subprocessEnv|combinedAbortSignal|abortController|cleanup|cleanupRegistry|gracefulShutdown|queueProcessor|sequential|sleep|timeouts|signal|withResolvers|stream|streamJsonStdoutGuard|bufferedWriter)\b/.test(normalized)
  ) {
    return {
      owner: 'process-tool-lifecycle',
      allowed: true,
      reason: 'process helper is consumed by tool lifecycle or shell adapter code without owning execution policy',
    }
  }

  if (
    /^src\/services\/(static-analysis|lsp|swe-bench|eval|toolUseSummary|AgentSummary)\b/.test(normalized) ||
    /^src\/utils\/git\//.test(normalized) ||
    /^src\/utils\/teleport\/gitBundle\.ts$/.test(normalized) ||
    /^src\/utils\/(attribution|commitAttribution)\.ts$/.test(normalized) ||
    /^src\/utils\/(git|gitDiff|gitSettings|glob|ghPrStatus|instructionFiles|releaseNotes|ripgrep|worktree)\.tsx?$/.test(normalized) ||
    /^src\/utils\/(path|windowsPaths|systemDirectories|cachePaths|tempfile|json|jsonRead|yaml|xml|hash|uuid|set|array|objectGroupBy|lazySchema|zodToJsonSchema|semanticBoolean|semanticNumber|semver|lockfile|binaryCheck|which|xdg|workloadContext|modifiers|sanitization|stringUtils|streamlinedTransform|truncate|vendor|vendorToolPaths|file|fsOperations|generatedFiles|preflightChecks|queryHelpers|todo|toolErrors|toolPool|toolResultStorage|toolSchemaCache)\b/.test(normalized)
  ) {
    return {
      owner: 'filesystem-source-evidence',
      allowed: true,
      reason: 'filesystem/data helper is pure utility or source evidence support',
    }
  }

  if (
    /^src\/(query|QueryEngine|main)\.tsx?$/.test(normalized) ||
    /^src\/(bootstrap|coordinator|memdir|migrations|query)\//.test(normalized) ||
    /^src\/tools\/ScheduleCronTool\//.test(normalized) ||
    /^src\/types\/logs\.ts$/.test(normalized) ||
    /^src\/(context|history|setup|interactiveHelpers|commands)\.tsx?$/.test(normalized) ||
    /^src\/dsxu\/engine\/(dsxu-conversation-control|dsxu-session-cache-control|prompt-processing-v1|runtime-core|reference-governance-absorption-contract)\.ts$/.test(normalized) ||
    /^src\/utils\/(fileHistory|messageQueueManager|planModeV2|plans|sessionRestore|systemPrompt)\.tsx?$/.test(normalized) ||
    /^src\/utils\/teleport\.tsx?$/.test(normalized) ||
    /^src\/utils\/ultraplan\//.test(normalized) ||
    /^src\/services\/(compact|autoDream|SessionMemory|teamMemorySync|extractMemories|experience|snapshot)\b/.test(normalized) ||
    /^src\/utils\/(cron|cronJitterConfig|cronScheduler|cronTasks|cronTasksLock|tasks|task|sessionStart|sessionEnvVars|sessionEnvironment|sessionActivity|sessionStorage|sessionStoragePortable|sessionState|sessionTitle|sessionUrl|listSessionsImpl|idleTimeout|backgroundHousekeeping|concurrentSessions|mailbox|sdkEventQueue|agent|agentId|agentSwarmsEnabled|agenticSessionSearch|analyzeContext|attachments|context|contextAnalysis|contextSuggestions|controlMessageCompat|memory|memoryFileDetection|conversationRecovery|crossProjectResume|readEditContext|fileRead|fileReadCache|fileStateCache|collapseReadSearch|message|messages|forkedAgent|agentContext|teammate|teammateMailbox|teammateContext|teamMemoryOps)\b/.test(normalized)
  ) {
    return {
      owner: 'scheduler-query-control',
      allowed: true,
      reason: 'scheduler/session helper reports state to query-loop or control-plane ownership',
    }
  }

  if (
    /^src\/services\/(api|policyLimits|tokenEstimation|sampling-policy|cache-stats|rateLimit|rateLimitMessages|dsxuLimits)\b/.test(normalized) ||
    /^src\/services\/(analytics|mcp|MagicDocs|remoteManagedSettings)\b/.test(normalized) ||
    /^src\/constants\//.test(normalized) ||
    /^src\/dsxu\/legacy\/model\//.test(normalized) ||
    /^src\/utils\/settings\//.test(normalized) ||
    /^src\/utils\/(http|userAgent|peerAddress|platform|env|envUtils|envValidation|envDynamic|managedEnv|managedEnvConstants|systemTheme|iTermBackup|appleTerminalBackup|localInstaller|api|apiPreconnect|model|tokens|tokenBudget|modelCost|effort|proxy|billing|extraUsage|betas|fastMode)\b/.test(normalized)
  ) {
    return {
      owner: 'network-provider-adapter',
      allowed: true,
      reason: 'network/platform helper is consumed by provider or adapter owner',
    }
  }

  if (
    /^src\/(components|hooks|screens|state|cli)\//.test(normalized) ||
    /^src\/(ink|keybindings)\//.test(normalized) ||
    /^src\/services\/(preventSleep|vcr)\.ts$/.test(normalized) ||
    /^src\/utils\/(advisor|config|debug|diagLogs|doctorDiagnostic|screenshotClipboard|status)\.tsx?$/.test(normalized) ||
    /^src\/services\/(tips|PromptSuggestion|notifier|awaySummary|voice|voiceStreamSTT|voiceKeyterms)\b/.test(normalized) ||
    /^src\/utils\/(ansiToPng|ansiToSvg|asciicast|format|formatBriefTimestamp|heatmap|html|sliceAnsi|textHighlighting|highlightMatch|treeify|staticRender|exportRenderer|markdown|markdownConfigLoader|pdf|pdfUtils|image|imageStore|imagePaste|imageResizer|imageValidation|terminal|terminalPanel|ink|fullscreen|horizontalScroll|renderOptions|browser|clipboard|editor|ide|intl|jetbrains|keyboardShortcuts|logoV2Utils|statusNotice|theme)\b/.test(normalized)
  ) {
    return {
      owner: 'render-evidence-projection',
      allowed: true,
      reason: 'render/format helper projects UI or final evidence without deciding runtime success',
    }
  }

  if (
    /^src\/commands\//.test(normalized) ||
    /^src\/skills\//.test(normalized) ||
    /^src\/utils\/(toolSearch|mcpInstructionsDelta)\.ts$/.test(normalized) ||
    /^src\/utils\/skills\//.test(normalized) ||
    /^src\/utils\/(processUserInput|immediateCommand|slashCommandParsing|argumentSubstitution|exampleCommands|cliArgs|cliHighlight|earlyInput|handlePromptSubmit|promptEditor|promptCategory|sideQuestion|sideQuery|completionCache|pasteStore)\b/.test(normalized)
  ) {
    return {
      owner: 'input-command-facade',
      allowed: true,
      reason: 'input helper routes into query-loop or command facade without executing tools directly',
    }
  }

  if (
    /^src\/services\/(embedding|mutation)\//.test(normalized) ||
    /^src\/utils\/(mcpOutputStorage)\.ts$/.test(normalized) ||
    /^src\/utils\/(filePersistence|generatedFiles|contentArray|CircularBuffer|Cursor|taggedId|nativeInstaller|desktopDeepLink|directMemberMessage|displayTags|undercover|words)\b/.test(normalized)
  ) {
    return {
      owner: 'storage-state-evidence',
      allowed: true,
      reason: 'storage/mutation helper has state or evidence ownership and does not own source truth',
    }
  }

  if (
    /^src\/utils\/telemetry\//.test(normalized) ||
    /^src\/utils\/(errorLogSink|headlessProfiler|log|queryProfiler|slowOperations|startupProfiler|stats|statsCache|telemetryAttributes|warningHandler)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'trace-diagnostics',
      allowed: true,
      reason: 'telemetry and log helpers project diagnostics evidence and do not own tool execution',
    }
  }

  if (/^src\/utils\/plugins\//.test(normalized)) {
    return {
      owner: 'mcp-adapter',
      allowed: true,
      reason: 'plugin helpers are consumed by MCP/plugin adapter ownership rather than a second runtime',
    }
  }

  if (
    /\/__tests__\//.test(normalized) ||
    /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized) ||
    /^src\/utils\/(legacy-productDesktop|legacy-productmd|collapseBackgroundBashNotifications|collapseHookSummaries|background\/remote)\b/.test(normalized)
  ) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'compatibility or test helper remains verification evidence and cannot define product runtime behavior',
    }
  }

  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `shared helper caller is not yet mapped to a concrete owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildSharedUtilityImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-01H-shared-runtime-utilities-import-use',
    observations,
    classify: classifySharedUtilityImportUseOwner,
    forbiddenOwner: 'forbidden-second-mcp-skill-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-01H import/use scan has shared helper callers without concrete owner',
    unknownRedline: 'TRR-01H import/use scan has shared helper callers without concrete owner',
  })
}

function classifyShellToolCoreImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'shell behavior reference is test evidence only and cannot hold product runtime ownership',
    }
  }
  if (
    /^src\/tools\/(BashTool|PowerShellTool)\//.test(normalized) ||
    /^src\/utils\/(bash|powershell|shell)\//.test(normalized) ||
    /^src\/utils\/(Shell|ShellCommand|bash|powershell|shell|sandbox|subprocessEnv|execFileNoThrow|execFileNoThrowPortable|execSyncWrapper)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'shell-adapter',
      allowed: true,
      reason: 'shell execution is owned by Bash/PowerShell adapters under Tool Gate policy',
    }
  }
  if (
    /^src\/permissions\//.test(normalized) ||
    /^src\/hooks\/toolPermission\//.test(normalized) ||
    /^src\/utils\/permissions\//.test(normalized) ||
    /^src\/utils\/(hooks|promptShellExecution)\.tsx?$/.test(normalized) ||
    /^src\/dsxu\/engine\/(permissions|tool-gate-v1)\.ts$/.test(normalized)
  ) {
    return {
      owner: 'tool-gate',
      allowed: true,
      reason: 'shell permission reference enters the original Tool Gate and visible recovery path',
    }
  }
  if (
    /^src\/dsxu\/engine\/(runtime-core|tool-mainline-runtime-v1|engine-tool-adapter|tool-bus|tool-types-v1|query-loop)\.ts$/.test(normalized) ||
    /^src\/dsxu\/engine\/(builtin-tools|index)\.ts$/.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized) ||
    /^src\/tasks\/(LocalShellTask|LocalMainSessionTask)\//.test(normalized)
  ) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'shell tool reference is part of the single ToolBus/query-loop lifecycle, not a second runtime',
    }
  }
  if (
    /^src\/tools\//.test(normalized) ||
    /^src\/(constants|context|coordinator|entrypoints|services|skills|types|utils)\//.test(normalized) ||
    /^src\/(context)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'shell tool name or prompt reference feeds the original ToolBus shell adapter path',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'shell tool reference is contract or evidence text bound to the original tool lifecycle',
    }
  }
  if (
    /^src\/(assistant|buddy|components|hooks|screens|state|cli|commands)\//.test(normalized) ||
    /^src\/(main|interactiveHelpers)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'shell state is projected to UI or command surfaces and cannot execute independently',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `shell tool caller is not yet mapped to Tool Gate, shell adapter, or ToolBus owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildShellExecutionToolImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-03A-shell-execution-tool-import-use',
    observations,
    classify: classifyShellToolCoreImportUseOwner,
    forbiddenOwner: 'forbidden-second-tool-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-03A import/use scan found shell execution outside ToolBus or Tool Gate',
    unknownRedline: 'TRR-03A import/use scan has shell callers without proven original owner',
  })
}

function classifyFileSourceToolCoreImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'file/source tool reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/(FileReadTool|FileEditTool|FileWriteTool|NotebookEditTool|GlobTool|GrepTool|LSPTool)\//.test(normalized) ||
    /^src\/services\/(lsp|static-analysis|tools)\//.test(normalized) ||
    /^src\/utils\/(file|fsOperations|generatedFiles|readFileInRange|fileRead|fileReadCache|fileStateCache|glob|ripgrep|git|gitDiff|detectRepository|preflightChecks|QueryGuard|toolErrors|toolPool|toolResultStorage|toolSchemaCache|lsp)\b/.test(normalized)
  ) {
    return {
      owner: 'source-tool-adapter',
      allowed: true,
      reason: 'file/source operation is owned by source adapters with bounded evidence output',
    }
  }
  if (
    /^src\/(constants|coordinator|memdir|services|tools|types|utils)\//.test(normalized) ||
    /^src\/utils\/(attachments|messages|plans|permissions|plugins|sandbox|swarm)\//.test(normalized)
  ) {
    return {
      owner: 'source-tool-adapter',
      allowed: true,
      reason: 'file/source tool reference feeds source adapters, prompts, or bounded source evidence helpers',
    }
  }
  if (
    /^src\/dsxu\/engine\/(runtime-core|tool-mainline-runtime-v1|engine-tool-adapter|tool-bus|tool-types-v1|tool-evidence|query-loop)\.ts$/.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'file/source tool enters the single ToolBus lifecycle',
    }
  }
  if (
    /^src\/dsxu\/engine\//.test(normalized) ||
    /^src\/services\/(AgentSummary|toolUseSummary|swe-bench|eval)\//.test(normalized)
  ) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'file/source output is consumed as evidence and cannot own execution',
    }
  }
  if (
    /^src\/(assistant|buddy|components|hooks|screens|state|cli|commands)\//.test(normalized) ||
    /^src\/(main|interactiveHelpers)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'file/source state is projected to product or command surfaces',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `file/source tool caller is not yet mapped to source adapter, ToolBus, or evidence owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildFileSourceToolImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-03B-file-source-tool-import-use',
    observations,
    classify: classifyFileSourceToolCoreImportUseOwner,
    forbiddenOwner: 'forbidden-second-tool-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-03B import/use scan found file/source execution outside ToolBus source owner',
    unknownRedline: 'TRR-03B import/use scan has file/source callers without proven original owner',
  })
}

function classifyMcpSkillResourceToolCoreImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'MCP/skill tool reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/(MCPTool|McpAuthTool|ListMcpResourcesTool|ReadMcpResourceTool|SkillTool|ToolSearchTool)\//.test(normalized) ||
    /^src\/services\/(mcp|MagicDocs|tools)\//.test(normalized) ||
    /^src\/skills\//.test(normalized) ||
    /^src\/utils\/(mcp|mcpValidation|mcpWebSocketTransport|mcpOutputStorage|mcpInstructionsDelta|desktopMcpImport|toolSearch)\.tsx?$/.test(normalized) ||
    /^src\/utils\/skills\//.test(normalized) ||
    /^src\/utils\/plugins\//.test(normalized) ||
    /^src\/dsxu\/engine\/(mcp-client|skills-registry-v1|skills-types-v1|skills-adapter|skills-executor|dsxu-integrations-v1)\.ts$/.test(normalized)
  ) {
    return {
      owner: 'mcp-skill-registry',
      allowed: true,
      reason: 'MCP/resource/skill reference enters the single registry, adapter, or ToolSearch lifecycle',
    }
  }
  if (
    /^src\/(commands|services|skills|tools|utils)\//.test(normalized) ||
    /^src\/(commands)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'mcp-skill-registry',
      allowed: true,
      reason: 'MCP/skill tool reference feeds the original registry, ToolSearch, or skill prompt owner',
    }
  }
  if (
    /^src\/dsxu\/engine\/(runtime-core|tool-mainline-runtime-v1|engine-tool-adapter|tool-bus|tool-types-v1|tool-gate-v1|query-loop)\.ts$/.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'MCP/skill tool reference enters the single ToolBus and Tool Gate lifecycle',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'MCP/skill reference is consumed as trace or evidence by the DSXU engine owner',
    }
  }
  if (
    /^src\/(assistant|buddy|components|hooks|screens|state|cli|commands|constants|entrypoints|types)\//.test(normalized) ||
    /^src\/(main|interactiveHelpers)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'MCP/skill tool state is projected to product or command surfaces',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `MCP/skill resource caller is not yet mapped to registry, ToolBus, or evidence owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildMcpSkillResourceToolImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-03C-mcp-skill-resource-tool-import-use',
    observations,
    classify: classifyMcpSkillResourceToolCoreImportUseOwner,
    forbiddenOwner: 'forbidden-second-tool-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-03C import/use scan found MCP/skill tool execution outside registry or ToolBus',
    unknownRedline: 'TRR-03C import/use scan has MCP/skill callers without proven original owner',
  })
}

function classifyPlanTaskWorkflowToolCoreImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'plan/task/workflow reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/(EnterPlanModeTool|ExitPlanModeTool|ExitPlanModeV2Tool|TaskCreateTool|TaskOutputTool|TeamCreateTool|TeamOutputTool|TodoWriteTool|WorkflowTool|ScheduleCronTool|SleepTool)\//.test(normalized) ||
    /^src\/tasks\//.test(normalized) ||
    /^src\/utils\/(tasks|task|cron|cronScheduler|cronTasks|cronTasksLock|planModeV2|plans|todo|forkedAgent|agentContext|teammate|teammateMailbox|teammateContext|teamMemoryOps)\b/.test(normalized)
  ) {
    return {
      owner: 'workflow-task-owner',
      allowed: true,
      reason: 'plan/task/workflow state is owned by query-loop workflow and task lifecycle',
    }
  }
  if (
    /^src\/(bootstrap|commands|coordinator|query|schemas|services|skills|tools|utils)\//.test(normalized) ||
    /^src\/(commands)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'workflow-task-owner',
      allowed: true,
      reason: 'plan/task/workflow reference feeds the original query-loop workflow and task lifecycle owner',
    }
  }
  if (
    /^src\/dsxu\/engine\/(runtime-core|tool-mainline-runtime-v1|engine-tool-adapter|tool-bus|tool-types-v1|query-loop|coordinator|agent-role-router)\.ts$/.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'plan/task/workflow reference enters the single ToolBus/query-loop lifecycle',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'plan/task/workflow state is consumed as recovery or evidence by the DSXU engine owner',
    }
  }
  if (
    /^src\/(assistant|buddy|components|hooks|screens|state|cli|commands|constants|entrypoints|types)\//.test(normalized) ||
    /^src\/(main|interactiveHelpers)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'plan/task/workflow state is projected to product or command surfaces',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `plan/task/workflow caller is not yet mapped to query-loop workflow, ToolBus, or evidence owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildPlanTaskWorkflowToolImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-03D-plan-task-workflow-tool-import-use',
    observations,
    classify: classifyPlanTaskWorkflowToolCoreImportUseOwner,
    forbiddenOwner: 'forbidden-second-tool-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-03D import/use scan found plan/task/workflow execution outside query-loop ToolBus owner',
    unknownRedline: 'TRR-03D import/use scan has plan/task/workflow callers without proven original owner',
  })
}

function classifyWorktreeConfigToolCoreImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'worktree/config tool reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/(ConfigTool|EnterWorktreeTool|ExitWorktreeTool|RemoteTriggerTool|SendMessageTool|REPLTool)\//.test(normalized) ||
    /^src\/utils\/(worktree|getWorktreePaths|worktreeModeEnabled|config|settings|remoteTrigger|repl|sessionStorage|sessionState)\b/.test(normalized) ||
    /^src\/commands\/(config|worktree|remote|send-message|repl)\b/.test(normalized) ||
    /^src\/(bootstrap|coordinator|dialogLaunchers|main|memdir|setup|skills|voice)\//.test(normalized) ||
    /^src\/(dialogLaunchers|main|setup)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'worktree-config-control',
      allowed: true,
      reason: 'worktree/config/control reference enters control-plane state ownership',
    }
  }
  if (
    /^src\/dsxu\/engine\/(runtime-core|tool-mainline-runtime-v1|engine-tool-adapter|tool-bus|tool-types-v1|query-loop)\.ts$/.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized) ||
    /^src\/(commands|constants|entrypoints|services|tools|types|utils)\//.test(normalized)
  ) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'worktree/config tool reference is routed through ToolBus or command/control-plane lifecycle',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'worktree/config reference is release, governance, or hook evidence bound to the original control-plane owner',
    }
  }
  if (/^src\/(assistant|buddy|components|hooks|screens|state|cli)\//.test(normalized)) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'worktree/config state is projected to product surfaces only',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `worktree/config tool caller is not yet mapped to control-plane or ToolBus owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildWorktreeConfigToolImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-03E-worktree-config-control-tool-import-use',
    observations,
    classify: classifyWorktreeConfigToolCoreImportUseOwner,
    forbiddenOwner: 'forbidden-second-tool-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-03E import/use scan found worktree/config control outside ToolBus or control-plane owner',
    unknownRedline: 'TRR-03E import/use scan has worktree/config callers without proven original owner',
  })
}

function classifyWebNetworkToolCoreImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'web/network tool reference is verification evidence only',
    }
  }
  if (/^src\/dsxu\/engine\/(raw-evidence-readiness-register-v1|browser-dev-server-proof-v1)\.ts$/.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'web/network reference is release readiness or evidence text and cannot own execution',
    }
  }
  if (
    /^src\/tools\/(WebFetchTool|WebSearchTool)\//.test(normalized) ||
    /^src\/utils\/(http|userAgent|browser|dsxuBrowserProvider|webSearch|webFetch)\b/.test(normalized) ||
    /^src\/services\/(api|mcp|MagicDocs)\//.test(normalized) ||
    /^src\/skills\/bundled\/(dsxuApi|dsxuApiContent)\.ts$/.test(normalized) ||
    /^src\/dsxu\/engine\/(extended-tools|index|permissions)\.ts$/.test(normalized)
  ) {
    return {
      owner: 'web-network-adapter',
      allowed: true,
      reason: 'web/network reference enters adapter ownership with permission/source evidence hooks',
    }
  }
  if (
    /^src\/dsxu\/engine\/(runtime-core|tool-mainline-runtime-v1|engine-tool-adapter|tool-bus|tool-types-v1|query-loop)\.ts$/.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized) ||
    /^src\/(commands|constants|entrypoints|services|tools|types|utils)\//.test(normalized)
  ) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'web/network tool reference is routed through ToolBus lifecycle or adapter prompt ownership',
    }
  }
  if (/^src\/(assistant|buddy|components|hooks|screens|state|cli)\//.test(normalized)) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'web/network state is projected to product surfaces only',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `web/network tool caller is not yet mapped to adapter or ToolBus owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildWebNetworkToolImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-03F-web-network-tool-import-use',
    observations,
    classify: classifyWebNetworkToolCoreImportUseOwner,
    forbiddenOwner: 'forbidden-second-tool-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-03F import/use scan found web/network execution outside ToolBus adapter owner',
    unknownRedline: 'TRR-03F import/use scan has web/network callers without proven original owner',
  })
}

function classifyEvidenceOutputToolCoreImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'evidence/output tool reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/(AskUserQuestionTool|BriefTool|CollectEvidenceTool|RunNativeTestTool|SyntheticOutputTool)\//.test(normalized) ||
    /^src\/dsxu\/engine\/(tool-evidence|final-report|brief|brief\/brief-generator|trace)\b/.test(normalized) ||
    /^src\/services\/(toolUseSummary|AgentSummary|vcr)\//.test(normalized) ||
    /^src\/utils\/(mcpOutputStorage|toolResultStorage|pdf|image|format|markdown|html)\b/.test(normalized)
  ) {
    return {
      owner: 'evidence-output-owner',
      allowed: true,
      reason: 'evidence/output reference emits visible evidence or user output without owning global completion',
    }
  }
  if (
    /^src\/(bootstrap|commands|coordinator|keybindings|main|skills|tasks)\//.test(normalized) ||
    /^src\/(commands|main)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'evidence-output-owner',
      allowed: true,
      reason: 'evidence/output tool reference is emitted or displayed through the original query-loop evidence owner',
    }
  }
  if (
    /^src\/dsxu\/engine\//.test(normalized) ||
    /^src\/(commands|constants|entrypoints|services|tools|types|utils)\//.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'evidence/output tool reference is consumed by Tool Evidence Pack or reporting owner',
    }
  }
  if (/^src\/(assistant|buddy|components|hooks|screens|state|cli)\//.test(normalized)) {
    return {
      owner: 'product-visible-state',
      allowed: true,
      reason: 'evidence/output state is projected to product surfaces only',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `evidence/output tool caller is not yet mapped to evidence owner or ToolBus owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildEvidenceOutputToolImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-03G-evidence-output-tool-import-use',
    observations,
    classify: classifyEvidenceOutputToolCoreImportUseOwner,
    forbiddenOwner: 'forbidden-second-tool-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-03G import/use scan found evidence/output tool owning global completion',
    unknownRedline: 'TRR-03G import/use scan has evidence/output callers without proven original owner',
  })
}

function classifyTestCompatToolCoreImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (
    /\/__tests__\//.test(normalized) ||
    /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized) ||
    /^src\/tools\/(schema-lint|testing|shared|utils)\b/.test(normalized) ||
    /^src\/utils\/(streamlinedTransform|toolSchemaCache|permissions\/classifierDecision)\b/.test(normalized) ||
    /^src\/cli\//.test(normalized) ||
    /^src\/(cli|tools)\.tsx?$/.test(normalized) ||
    /^src\/dsxu\/engine\/runtime-core\.ts$/.test(normalized) ||
    /^src\/dsxu\/legacy\/auth\//.test(normalized)
  ) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'tool compatibility reference is restricted to schema/test evidence and cannot own product runtime',
    }
  }
  if (/^src\/(tools|utils|services|commands|types)\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'tool compatibility reference is consumed as evidence or validation under existing owners',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `test/compat tool caller is not yet mapped to verification evidence or validation owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildTestCompatToolImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-03H-test-compat-tool-import-use',
    observations,
    classify: classifyTestCompatToolCoreImportUseOwner,
    forbiddenOwner: 'forbidden-second-tool-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-03H import/use scan found compatibility tool owning product runtime',
    unknownRedline: 'TRR-03H import/use scan has compatibility callers without proven evidence owner',
  })
}

function classifyAgentEntryLifecycleImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'AgentTool entry reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/AgentTool\/(AgentTool|UI|constants)\.tsx?$/.test(normalized) ||
    /^src\/tools\/AgentTool\//.test(normalized)
  ) {
    return {
      owner: 'agent-tool-lifecycle',
      allowed: true,
      reason: 'AgentTool entry is owned by the single Agent Tool lifecycle',
    }
  }
  if (
    /^src\/dsxu\/engine\/(runtime-core|tool-mainline-runtime-v1|engine-tool-adapter|tool-bus|query-loop|agent-role-router)\.ts$/.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized) ||
    /^src\/(commands|constants|entrypoints|services|skills|tasks|utils|types)\//.test(normalized)
  ) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'AgentTool entry reference is routed through ToolBus/query-loop lifecycle',
    }
  }
  if (
    /^src\/(bootstrap|coordinator|dialogLaunchers|main)\.tsx?$/.test(normalized) ||
    /^src\/(bootstrap|coordinator)\//.test(normalized) ||
    /^src\/tools\//.test(normalized)
  ) {
    return {
      owner: 'agent-tool-lifecycle',
      allowed: true,
      reason: 'AgentTool entry reference feeds the original AgentTool lifecycle and tool prompt surface',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'AgentTool entry reference is contract or evidence text bound to the agent lifecycle',
    }
  }
  if (/^src\/(assistant|buddy|components|hooks|screens|state|cli)\//.test(normalized)) {
    return {
      owner: 'agent-visible-state',
      allowed: true,
      reason: 'AgentTool entry state is projected to product surfaces only',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `AgentTool entry caller is not yet mapped to AgentTool lifecycle or ToolBus owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildAgentEntryLifecycleImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-04A-agent-entry-lifecycle-import-use',
    observations,
    classify: classifyAgentEntryLifecycleImportUseOwner,
    forbiddenOwner: 'forbidden-second-agent-orchestrator',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-04A import/use scan found AgentTool entry outside the single agent lifecycle',
    unknownRedline: 'TRR-04A import/use scan has AgentTool entry callers without proven owner',
  })
}

function classifyAgentExecutionRunnerImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'agent runner reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/AgentTool\/(runAgent|forkSubagent|resumeAgent|agentToolUtils)\.ts$/.test(normalized) ||
    /^src\/utils\/(forkedAgent|agentContext|agentId|agentSwarmsEnabled|agenticSessionSearch|inProcessTeammateHelpers)\b/.test(normalized) ||
    /^src\/utils\/swarm\//.test(normalized)
  ) {
    return {
      owner: 'agent-execution-runner',
      allowed: true,
      reason: 'agent execution is owned by serial_worker / parallel_fanout runner paths',
    }
  }
  if (
    /^src\/(constants|hooks|query|setup|screens)\//.test(normalized) ||
    /^src\/(main|setup)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'agent-execution-runner',
      allowed: true,
      reason: 'agent runner reference feeds serial_worker / parallel_fanout setup, prompts, or lifecycle hooks',
    }
  }
  if (
    /^src\/tools\/AgentTool\//.test(normalized) ||
    /^src\/tools\/(ExitPlanModeTool|TaskCreateTool|TaskOutputTool|TaskListTool|TaskUpdateTool|TeamCreateTool|TeamOutputTool|TeamDeleteTool|SendMessageTool|SkillTool|ToolSearchTool|shared)\//.test(normalized) ||
    /^src\/(tasks|services|utils|commands|skills)\//.test(normalized)
  ) {
    return {
      owner: 'workflow-task-owner',
      allowed: true,
      reason: 'agent runner reference feeds query-loop task/workflow lifecycle without creating a second orchestrator',
    }
  }
  if (/^src\/(cli|components)\//.test(normalized)) {
    return {
      owner: 'agent-visible-state',
      allowed: true,
      reason: 'agent runner state is projected to product surfaces and cannot own orchestration',
    }
  }
  if (
    /^src\/dsxu\/engine\/(runtime-core|tool-mainline-runtime-v1|engine-tool-adapter|tool-bus|query-loop|coordinator|agent-role-router)\.ts$/.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'agent runner enters the single ToolBus/query-loop lifecycle',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'agent runner reference is contract or evidence text bound to the original agent owner',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `agent runner caller is not yet mapped to runner, workflow, or ToolBus owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildAgentExecutionRunnerImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-04B-agent-execution-runner-import-use',
    observations,
    classify: classifyAgentExecutionRunnerImportUseOwner,
    forbiddenOwner: 'forbidden-second-agent-orchestrator',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-04B import/use scan found agent runner outside serial_worker / parallel_fanout ownership',
    unknownRedline: 'TRR-04B import/use scan has runner callers without proven owner',
  })
}

function classifyAgentRegistryPromptImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'agent registry/prompt reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/AgentTool\/(builtInAgents|loadAgentsDir|prompt)\.ts$/.test(normalized) ||
    /^src\/tools\/AgentTool\/built-in\//.test(normalized) ||
    /^src\/utils\/plugins\/loadPluginAgents\.ts$/.test(normalized)
  ) {
    return {
      owner: 'agent-registry-prompt',
      allowed: true,
      reason: 'agent definitions and prompts are owned by the single Agent registry/prompt owner',
    }
  }
  if (
    /^src\/(cli|components|hooks|screens|state)\//.test(normalized) ||
    /^src\/(main)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'agent-visible-state',
      allowed: true,
      reason: 'agent registry data is rendered or edited by product surfaces without owning execution',
    }
  }
  if (/^src\/tools\/AgentTool\//.test(normalized)) {
    return {
      owner: 'agent-tool-lifecycle',
      allowed: true,
      reason: 'agent registry reference feeds AgentTool lifecycle and does not own execution',
    }
  }
  if (/^src\/tools\//.test(normalized)) {
    return {
      owner: 'agent-registry-prompt',
      allowed: true,
      reason: 'agent registry or built-in agent reference feeds tool prompts under the original registry owner',
    }
  }
  if (
    /^src\/(commands|constants|entrypoints|services|skills|tasks|utils|types)\//.test(normalized) ||
    /^src\/(Tool|tools|query|QueryEngine)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'agent-registry-prompt',
      allowed: true,
      reason: 'agent definition or prompt reference feeds the original registry/prompt owner',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'agent registry reference is contract or evidence text bound to the original agent owner',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `agent registry/prompt caller is not yet mapped to registry, lifecycle, or evidence owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildAgentRegistryPromptImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-04C-agent-registry-prompt-import-use',
    observations,
    classify: classifyAgentRegistryPromptImportUseOwner,
    forbiddenOwner: 'forbidden-second-agent-orchestrator',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-04C import/use scan found agent registry/prompt owning a second orchestrator',
    unknownRedline: 'TRR-04C import/use scan has registry/prompt callers without proven owner',
  })
}

function classifyAgentMemoryContextImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'agent memory/context reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/AgentTool\/(agentMemory|agentMemorySnapshot)\.ts$/.test(normalized) ||
    /^src\/utils\/(agentContext|forkedAgent|teammateContext|teamMemoryOps|teamMemoryContext)\b/.test(normalized) ||
    /^src\/services\/(AgentSummary|SessionMemory|teamMemorySync)\//.test(normalized)
  ) {
    return {
      owner: 'agent-context-evidence',
      allowed: true,
      reason: 'agent memory/context is evidence input and cannot override source truth',
    }
  }
  if (
    /^src\/(components|dialogLaunchers|hooks)\//.test(normalized) ||
    /^src\/(dialogLaunchers)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'agent-visible-state',
      allowed: true,
      reason: 'agent memory/context is projected to product surfaces as evidence state',
    }
  }
  if (/^src\/tools\/(ScheduleCronTool|TaskCreateTool|SkillTool|shared)\//.test(normalized)) {
    return {
      owner: 'agent-context-evidence',
      allowed: true,
      reason: 'agent context is consumed by scheduled/task/skill lifecycle as evidence input',
    }
  }
  if (/^src\/tools\/AgentTool\//.test(normalized)) {
    return {
      owner: 'agent-tool-lifecycle',
      allowed: true,
      reason: 'agent memory/context reference is consumed by AgentTool lifecycle',
    }
  }
  if (/^src\/(commands|constants|entrypoints|services|skills|tasks|utils|types)\//.test(normalized)) {
    return {
      owner: 'agent-context-evidence',
      allowed: true,
      reason: 'agent memory/context reference feeds evidence or session context ownership',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'agent memory/context reference is contract or evidence text bound to original source truth',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `agent memory/context caller is not yet mapped to context evidence or AgentTool lifecycle owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildAgentMemoryContextImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-04D-agent-memory-context-import-use',
    observations,
    classify: classifyAgentMemoryContextImportUseOwner,
    forbiddenOwner: 'forbidden-second-agent-orchestrator',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-04D import/use scan found agent memory/context owning source truth or orchestration',
    unknownRedline: 'TRR-04D import/use scan has memory/context callers without proven owner',
  })
}

function classifyAgentVisibleStateImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'agent visible-state reference is verification evidence only',
    }
  }
  if (
    /^src\/tools\/AgentTool\/(agentColorManager|agentDisplay|UI)\.tsx?$/.test(normalized) ||
    /^src\/(assistant|buddy|bootstrap|components|hooks|screens|state|cli)\//.test(normalized) ||
    /^src\/(main)\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'agent-visible-state',
      allowed: true,
      reason: 'agent display/color/progress state is product-visible projection only',
    }
  }
  if (/^src\/tools\/AgentTool\//.test(normalized)) {
    return {
      owner: 'agent-tool-lifecycle',
      allowed: true,
      reason: 'agent visible-state reference is projected from AgentTool lifecycle',
    }
  }
  if (/^src\/(commands|constants|entrypoints|services|skills|tasks|utils|types)\//.test(normalized)) {
    return {
      owner: 'agent-visible-state',
      allowed: true,
      reason: 'agent visible-state reference feeds UI/report projection and cannot finalize execution',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'agent visible-state reference is contract or evidence text bound to original agent lifecycle',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `agent visible-state caller is not yet mapped to visible projection or AgentTool lifecycle owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildAgentVisibleStateImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-04E-agent-visible-state-import-use',
    observations,
    classify: classifyAgentVisibleStateImportUseOwner,
    forbiddenOwner: 'forbidden-second-agent-orchestrator',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-04E import/use scan found agent visible-state owning execution',
    unknownRedline: 'TRR-04E import/use scan has visible-state callers without proven owner',
  })
}

function classifyNativeRuntimeAdapterImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'native adapter reference is verification evidence only',
    }
  }
  if (
    /^src\/native-ts\//.test(normalized) ||
    /^src\/ink\/layout\/yoga\.ts$/.test(normalized) ||
    /^src\/ink\/ink\.tsx?$/.test(normalized) ||
    /^src\/hooks\/fileSuggestions\.ts$/.test(normalized) ||
    /^src\/components\/StructuredDiff\/colorDiff\.ts$/.test(normalized)
  ) {
    return {
      owner: 'native-runtime-adapter',
      allowed: true,
      reason: 'native replacement is adapter-only and consumed by rendering/source helpers',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'native adapter reference is review or evidence text and cannot own runtime lifecycle',
    }
  }
  if (/^src\/(components|hooks|ink|utils)\//.test(normalized)) {
    return {
      owner: 'adapter-visible-projection',
      allowed: true,
      reason: 'native adapter output is projected through UI/source owners only',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `native adapter caller is not yet mapped to adapter or evidence owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildNativeRuntimeAdapterImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-05A-native-runtime-adapter-import-use',
    observations,
    classify: classifyNativeRuntimeAdapterImportUseOwner,
    forbiddenOwner: 'forbidden-standalone-external-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-05A import/use scan found native adapter owning standalone runtime',
    unknownRedline: 'TRR-05A import/use scan has native adapter callers without proven owner',
  })
}

function classifyPluginBundleAdapterImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'plugin bundle reference is verification evidence only',
    }
  }
  if (
    /^src\/plugins\//.test(normalized) ||
    /^src\/commands\/plugin\//.test(normalized) ||
    /^src\/commands\/thinkback\//.test(normalized) ||
    /^src\/utils\/plugins\//.test(normalized) ||
    /^src\/services\/(plugins|lsp|mcp)\//.test(normalized)
  ) {
    return {
      owner: 'plugin-bundle-adapter',
      allowed: true,
      reason: 'plugin bundle reference is owned by plugin adapter and marketplace/trust boundary',
    }
  }
  if (
    /^src\/skills\//.test(normalized) ||
    /^src\/tools\/SkillTool\//.test(normalized) ||
    /^src\/commands\.ts$/.test(normalized) ||
    /^src\/main\.tsx?$/.test(normalized) ||
    /^src\/QueryEngine\.tsx?$/.test(normalized)
  ) {
    return {
      owner: 'mcp-skill-registry',
      allowed: true,
      reason: 'plugin bundle capability enters the single skill/MCP registry path',
    }
  }
  if (/^src\/utils\/permissions\//.test(normalized)) {
    return {
      owner: 'auth-control-plane',
      allowed: true,
      reason: 'plugin bundle trust and permissions are controlled by auth/permission boundary',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'plugin bundle reference is review or evidence text and cannot own runtime lifecycle',
    }
  }
  if (/^src\/(components|hooks|screens|state|cli|types|utils)\//.test(normalized)) {
    return {
      owner: 'adapter-visible-projection',
      allowed: true,
      reason: 'plugin bundle state is product-visible projection or adapter utility only',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `plugin bundle caller is not yet mapped to plugin adapter, registry, or evidence owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildPluginBundleAdapterImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-05B-plugin-bundle-adapter-import-use',
    observations,
    classify: classifyPluginBundleAdapterImportUseOwner,
    forbiddenOwner: 'forbidden-standalone-external-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-05B import/use scan found plugin bundle owning standalone runtime',
    unknownRedline: 'TRR-05B import/use scan has plugin bundle callers without proven owner',
  })
}

function classifyDirectConnectServerAdapterImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'direct-connect reference is verification evidence only',
    }
  }
  if (
    /^src\/server\//.test(normalized) ||
    /^src\/hooks\/useDirectConnect\.ts$/.test(normalized) ||
    /^src\/dsxu\/engine\/dsxu-direct-connect-session\.ts$/.test(normalized)
  ) {
    return {
      owner: 'direct-connect-server-adapter',
      allowed: true,
      reason: 'direct-connect reference stays inside server/session adapter boundary',
    }
  }
  if (/^src\/(bootstrap|main|screens)\//.test(normalized) || /^src\/(main)\.tsx?$/.test(normalized)) {
    return {
      owner: 'adapter-visible-projection',
      allowed: true,
      reason: 'direct-connect state is startup/session projection around the adapter boundary',
    }
  }
  if (/^src\/utils\/(logoV2Utils|userAgent|env|api)\b/.test(normalized)) {
    return {
      owner: 'network-provider-adapter',
      allowed: true,
      reason: 'direct-connect metadata is consumed by network/provider adapter helpers',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'direct-connect reference is review or evidence text and cannot own query-loop decisions',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `direct-connect caller is not yet mapped to server adapter or projection owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildDirectConnectServerAdapterImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-05C-direct-connect-server-adapter-import-use',
    observations,
    classify: classifyDirectConnectServerAdapterImportUseOwner,
    forbiddenOwner: 'forbidden-standalone-external-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-05C import/use scan found direct-connect owning standalone runtime',
    unknownRedline: 'TRR-05C import/use scan has direct-connect callers without proven owner',
  })
}

function classifyProductCompatAdapterImportUseOwner(
  path: string,
  symbols: readonly string[],
): Pick<ToolRuntimePermissionImportUseFinding, 'owner' | 'allowed' | 'reason'> {
  const normalized = normalizedPath(path)
  const symbolSet = new Set(symbols)

  if (/\/__tests__\//.test(normalized) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized)) {
    return {
      owner: 'compat-test-evidence',
      allowed: true,
      reason: 'product compatibility reference is verification evidence only',
    }
  }
  if (
    /^src\/dsxu\/engine\/runtime-core\.ts$/.test(normalized) &&
    (
      symbolSet.has('createDSXUBridgeBatchMainlineRuntime') ||
      symbolSet.has('createDSXUBridgeOrchestrationMainlineRuntime') ||
      symbolSet.has('createDSXUBridgeSessionLifecycleRuntime') ||
      symbolSet.has('createDSXURemoteSkillRuntime')
    )
  ) {
    return {
      owner: 'forbidden-standalone-external-runtime',
      allowed: false,
      reason: 'runtime-core still exports a bridge/product compatibility runtime instead of routing through provider adapter boundary or replace/delete review',
    }
  }
  if (
    /^src\/dsxu\/engine\/runtime-core\.ts$/.test(normalized) &&
    (
      symbolSet.has('provider-backend/dsxu-provider-compat') ||
      symbolSet.has('dsxu-mainline-compat-wrappers')
    )
  ) {
    return {
      owner: 'runtime-core-replace-delete-review',
      allowed: true,
      reason: 'runtime-core no longer exports a bridge/product compatibility runtime; remaining compatibility references are owned by DWR/OGC replace-delete review',
    }
  }
  if (/^src\/commands\/bridge(?:\/|$)/.test(normalized) || /^src\/commands\/bridge-kick\.ts$/.test(normalized)) {
    return {
      owner: 'forbidden-standalone-external-runtime',
      allowed: false,
      reason: 'legacy bridge command owns a product compatibility runtime surface instead of provider adapter boundary or replace/delete review',
    }
  }
  if (/^src\/cli\/print\.ts$/.test(normalized)) {
    return {
      owner: 'adapter-visible-projection',
      allowed: true,
      reason: 'CLI print consumes provider compatibility state as visible projection and block messaging only',
    }
  }
  if (/^src\/cli\/(remoteIO|transports\/ccrClient)\.ts$/.test(normalized)) {
    return {
      owner: 'network-provider-adapter',
      allowed: true,
      reason: 'CLI transport helper consumes provider compatibility through the network/provider adapter boundary',
    }
  }
  if (/^src\/commands\/(login\/login|logout\/logout|rename\/rename|ultraplan)\.tsx?$/.test(normalized)) {
    return {
      owner: 'auth-control-plane',
      allowed: true,
      reason: 'command consumes provider compatibility through auth/control-plane adapter hooks only',
    }
  }
  if (/^src\/tools\/(BriefTool\/upload|SendMessageTool\/SendMessageTool)\.ts$/.test(normalized)) {
    return {
      owner: 'tool-bus-lifecycle',
      allowed: true,
      reason: 'tool consumes provider compatibility through ToolBus lifecycle and provider adapter hooks',
    }
  }
  if (/^src\/(moreright|local-work|mcp|ide|terminal|shell|network|browser)\//.test(normalized)) {
    return {
      owner: 'product-compat-adapter',
      allowed: true,
      reason: 'product compatibility path is adapter or projection only and cannot own product runtime',
    }
  }
  if (/^src\/(screens|components|hooks|state|main)\//.test(normalized) || /^src\/(main)\.tsx?$/.test(normalized)) {
    return {
      owner: 'adapter-visible-projection',
      allowed: true,
      reason: 'product compatibility state is visible projection only',
    }
  }
  if (/^src\/dsxu\/engine\//.test(normalized)) {
    return {
      owner: 'evidence-artifact-owner',
      allowed: true,
      reason: 'product compatibility reference is review or evidence text and cannot own runtime lifecycle',
    }
  }
  return {
    owner: 'unknown-owner',
    allowed: false,
    reason: `product compatibility caller is not yet mapped to adapter projection or evidence owner for symbols: ${symbols.join(', ')}`,
  }
}

export function buildProductCompatAdapterImportUseScan(
  observations: readonly ToolRuntimeImportUseObservation[],
): ToolRuntimePermissionImportUseScan {
  return buildImportUseScan({
    scanId: 'TRR-05D-product-compat-adapter-import-use',
    observations,
    classify: classifyProductCompatAdapterImportUseOwner,
    forbiddenOwner: 'forbidden-standalone-external-runtime',
    unknownOwner: 'unknown-owner',
    forbiddenRedline: 'TRR-05D import/use scan found product compatibility owning standalone runtime',
    unknownRedline: 'TRR-05D import/use scan has product compatibility callers without proven owner',
  })
}

function highRiskImportUseProofForGroup(
  group: ToolRuntimeSupportServiceGroup,
  permissionImportUseScan?: ToolRuntimePermissionImportUseScan,
  providerImportUseScan?: ToolRuntimePermissionImportUseScan,
  mcpSkillImportUseScan?: ToolRuntimePermissionImportUseScan,
  contextMemoryImportUseScan?: ToolRuntimePermissionImportUseScan,
  sourceEvidenceImportUseScan?: ToolRuntimePermissionImportUseScan,
  productSurfaceImportUseScan?: ToolRuntimePermissionImportUseScan,
  telemetryDiagnosticsImportUseScan?: ToolRuntimePermissionImportUseScan,
): ToolRuntimeMainlineImportUseProof | undefined {
  if (group === 'permission-safety') {
    return {
      proofStatus: 'PARTIAL',
      owner: 'Permission / Tool Gate',
      requiredMainlineOwner: 'tool-gate-v1 + visible permission recovery',
      allowedConsumerOwners: [
        'Tool Gate',
        'Tool Mainline Runtime',
        'Bash/PowerShell adapters',
        'Control Plane permission bridge',
        'Product visible-state projection',
      ],
      importUseEvidence: [
        'paths under src/permissions, src/hooks/toolPermission, and shell safety helpers are classified only as permission-safety',
        'required close proof names Tool Gate, visible wait, deny, and recovery evidence',
        'duplication decision forbids direct tool execution by support helpers',
        ...(permissionImportUseScan
          ? [`TRR-01A import/use scan classified ${permissionImportUseScan.totalCallerCount} callers with ${permissionImportUseScan.forbiddenCallerCount} forbidden and ${permissionImportUseScan.unknownCallerCount} unknown`]
          : []),
      ],
      ...(permissionImportUseScan ? { importUseScan: permissionImportUseScan } : {}),
      forbiddenBypass: [
        'permission helper cannot execute a command directly',
        'permission helper cannot finalize a query-loop turn',
        'permission helper cannot create a second permission runtime',
      ],
      missingProofBeforeClose: [
        'import/use scan from each helper to Tool Gate or adapter caller',
        'focused evidence that denied/pending permission emits Tool Evidence Pack',
        'focused evidence that product hooks only project visible permission state',
      ],
      canCloseWithoutImportUseReview: false,
    }
  }
  if (group === 'provider-cost') {
    return {
      proofStatus: 'PARTIAL',
      owner: 'Model Router / Cost Evidence',
      requiredMainlineOwner: 'DeepSeek model router + provider usage + final cost evidence',
      allowedConsumerOwners: [
        'Model Router',
        'Provider adapter',
        'Cost tracker',
        'Final report usage evidence',
        'Live cost matrix',
      ],
      importUseEvidence: [
        'paths under src/services/api, policy limits, token estimation, and model/cost utils are classified only as provider-cost',
        'required close proof names routing, cache, usage, and final cost evidence',
        'duplication decision forbids provider helpers from owning a model runtime',
        ...(providerImportUseScan
          ? [`TRR-01B import/use scan classified ${providerImportUseScan.totalCallerCount} callers with ${providerImportUseScan.forbiddenCallerCount} forbidden and ${providerImportUseScan.unknownCallerCount} unknown`]
          : []),
      ],
      ...(providerImportUseScan ? { importUseScan: providerImportUseScan } : {}),
      forbiddenBypass: [
        'provider helper cannot choose model route outside Model Router',
        'provider helper cannot hide usage/cost evidence',
        'provider helper cannot create a second provider runtime loop',
      ],
      missingProofBeforeClose: [
        'import/use scan from each provider helper to router/provider adapter owner',
        'focused evidence that cache and usage reach final report cost evidence',
        'focused evidence that Pro rescue and Flash default routing remain under router policy',
      ],
      canCloseWithoutImportUseReview: false,
    }
  }
  if (group === 'mcp-plugin-skill') {
    return {
      proofStatus: 'PARTIAL',
      owner: 'MCP / Skill Registry',
      requiredMainlineOwner: 'single MCP adapter + skills registry + tool lifecycle permission/trace',
      allowedConsumerOwners: [
        'MCP adapter',
        'Skill registry',
        'Tool lifecycle',
        'Tool Gate',
        'Trace/evidence owner',
      ],
      importUseEvidence: [
        'paths under src/services/mcp, plugin services, MagicDocs, and skill/MCP utils are classified only as mcp-plugin-skill',
        'required close proof names one registry/parser, permission, and trace path',
        'duplication decision forbids dynamic MCP/skill paths from bypassing tool lifecycle',
        ...(mcpSkillImportUseScan
          ? [`TRR-01C import/use scan classified ${mcpSkillImportUseScan.totalCallerCount} callers with ${mcpSkillImportUseScan.forbiddenCallerCount} forbidden and ${mcpSkillImportUseScan.unknownCallerCount} unknown`]
          : []),
      ],
      ...(mcpSkillImportUseScan ? { importUseScan: mcpSkillImportUseScan } : {}),
      forbiddenBypass: [
        'MCP helper cannot execute remote tools outside Tool Gate',
        'skill helper cannot create a second skill registry/parser',
        'dynamic skill/MCP helper cannot emit untraced tool results',
      ],
      missingProofBeforeClose: [
        'import/use scan from MCP helpers to MCP adapter and Tool Gate',
        'import/use scan from skill helpers to the single skills registry',
        'focused evidence that dynamic skill/MCP output is traced through Tool Evidence Pack',
      ],
      canCloseWithoutImportUseReview: false,
    }
  }
  if (group === 'context-memory-resume') {
    return {
      proofStatus: 'PARTIAL',
      owner: 'Context / Memory / Resume',
      requiredMainlineOwner: 'Context Owner Rule + compact/resume source-truth owner',
      allowedConsumerOwners: [
        'Context owner',
        'Memory store',
        'Resume/session control',
        'Product visible-state projection',
      ],
      importUseEvidence: [
        'paths under compact, SessionMemory, autoDream, context, session, and resume helpers are classified only as context-memory-resume',
        'required close proof names source truth over memory and compact/resume continuity',
        ...(contextMemoryImportUseScan
          ? [`TRR-01D import/use scan classified ${contextMemoryImportUseScan.totalCallerCount} callers with ${contextMemoryImportUseScan.forbiddenCallerCount} forbidden and ${contextMemoryImportUseScan.unknownCallerCount} unknown`]
          : []),
      ],
      ...(contextMemoryImportUseScan ? { importUseScan: contextMemoryImportUseScan } : {}),
      forbiddenBypass: [
        'memory helper cannot override current source truth',
        'resume helper cannot finalize a query-loop turn independently',
        'context helper cannot create a second prompt owner',
      ],
      missingProofBeforeClose: [
        'import/use scan from memory/session helpers to Context Owner Rule',
        'focused evidence that compact/resume preserves failures and next action',
        'focused evidence that memory is evidence input, not source replacement',
      ],
      canCloseWithoutImportUseReview: false,
    }
  }
  if (group === 'source-analysis-evidence') {
    return {
      proofStatus: 'PARTIAL',
      owner: 'Source Truth / Evidence',
      requiredMainlineOwner: 'source truth, static analysis, and Tool Evidence Pack owner',
      allowedConsumerOwners: [
        'Source truth',
        'Static analysis owner',
        'Evidence artifact owner',
        'Product visible-state projection',
      ],
      importUseEvidence: [
        'paths under static analysis, LSP, eval, source helpers, git/worktree, and tool result storage are classified only as source-analysis-evidence',
        'required close proof names bounded source evidence and no direct tool execution',
        ...(sourceEvidenceImportUseScan
          ? [`TRR-01E import/use scan classified ${sourceEvidenceImportUseScan.totalCallerCount} callers with ${sourceEvidenceImportUseScan.forbiddenCallerCount} forbidden and ${sourceEvidenceImportUseScan.unknownCallerCount} unknown`]
          : []),
      ],
      ...(sourceEvidenceImportUseScan ? { importUseScan: sourceEvidenceImportUseScan } : {}),
      forbiddenBypass: [
        'source helper cannot execute side-effect tools directly',
        'analysis helper cannot replace source truth with inferred memory',
        'evidence helper cannot emit unlinked final proof',
      ],
      missingProofBeforeClose: [
        'import/use scan from source helpers to source/evidence owner',
        'focused evidence that analysis output links to final report or recovery',
        'focused evidence that source helper output remains bounded by requested files',
      ],
      canCloseWithoutImportUseReview: false,
    }
  }
  if (group === 'product-surface-hooks') {
    return {
      proofStatus: 'PARTIAL',
      owner: 'Product Surface Visible State',
      requiredMainlineOwner: 'query-loop/tool evidence visible-state projection',
      allowedConsumerOwners: [
        'Product visible state',
        'Product config surface',
        'IDE/terminal surface adapter',
      ],
      importUseEvidence: [
        'paths under hooks, product services, UI/config utils, and IDE/browser/terminal surfaces are classified only as product-surface-hooks',
        'required close proof names visible projection and no execution decisions',
        ...(productSurfaceImportUseScan
          ? [`TRR-01F import/use scan classified ${productSurfaceImportUseScan.totalCallerCount} callers with ${productSurfaceImportUseScan.forbiddenCallerCount} forbidden and ${productSurfaceImportUseScan.unknownCallerCount} unknown`]
          : []),
      ],
      ...(productSurfaceImportUseScan ? { importUseScan: productSurfaceImportUseScan } : {}),
      forbiddenBypass: [
        'product hook cannot own tool execution decisions',
        'visible state cannot silently hide permission/recovery waits',
        'config surface cannot create a second query-loop runtime',
      ],
      missingProofBeforeClose: [
        'import/use scan from product hooks to visible-state projection',
        'focused evidence that pending/background states remain visible',
        'focused evidence that product surface never finalizes tool execution',
      ],
      canCloseWithoutImportUseReview: false,
    }
  }
  if (group === 'telemetry-diagnostics') {
    return {
      proofStatus: 'PARTIAL',
      owner: 'Trace / Diagnostics Evidence',
      requiredMainlineOwner: 'trace, diagnostics, analytics, and final evidence observer',
      allowedConsumerOwners: [
        'Analytics sink',
        'Diagnostics trace',
        'Observability projection',
      ],
      importUseEvidence: [
        'paths under analytics, diagnostic tracking, logging, profiler, stats, and trace helpers are classified only as telemetry-diagnostics',
        'required close proof names observation without execution ownership',
        ...(telemetryDiagnosticsImportUseScan
          ? [`TRR-01G import/use scan classified ${telemetryDiagnosticsImportUseScan.totalCallerCount} callers with ${telemetryDiagnosticsImportUseScan.forbiddenCallerCount} forbidden and ${telemetryDiagnosticsImportUseScan.unknownCallerCount} unknown`]
          : []),
      ],
      ...(telemetryDiagnosticsImportUseScan ? { importUseScan: telemetryDiagnosticsImportUseScan } : {}),
      forbiddenBypass: [
        'telemetry helper cannot decide tool execution',
        'diagnostic helper cannot declare task completion',
        'analytics helper cannot replace final evidence',
      ],
      missingProofBeforeClose: [
        'import/use scan from telemetry helpers to diagnostics/evidence owner',
        'focused evidence that trace links back to owning mainline',
        'focused evidence that analytics observes lifecycle events only',
      ],
      canCloseWithoutImportUseReview: false,
    }
  }
  return undefined
}

function sharedUtilitySliceIdForGroup(group: ToolRuntimeSharedUtilityGroup): ToolRuntimeSharedUtilitySliceId {
  if (group === 'auth-oauth-secret') return 'TRR-01H1'
  if (group === 'process-execution') return 'TRR-01H2'
  if (group === 'filesystem-path-data') return 'TRR-01H3'
  if (group === 'scheduler-task-session') return 'TRR-01H4'
  if (group === 'network-http-platform') return 'TRR-01H5'
  if (group === 'render-format-output') return 'TRR-01H6'
  if (group === 'input-command-adapter') return 'TRR-01H7'
  if (group === 'storage-mutation-state') return 'TRR-01H8'
  return 'TRR-01H9'
}

function sharedUtilityOwnerForGroup(group: ToolRuntimeSharedUtilityGroup): string {
  if (group === 'auth-oauth-secret') return 'Auth / Secret Boundary'
  if (group === 'process-execution') return 'Process Execution Utility'
  if (group === 'filesystem-path-data') return 'Filesystem / Data Utility'
  if (group === 'scheduler-task-session') return 'Session / Task Scheduler'
  if (group === 'network-http-platform') return 'Network / Platform Boundary'
  if (group === 'render-format-output') return 'Render / Output Formatting'
  if (group === 'input-command-adapter') return 'Input / Command Adapter'
  if (group === 'storage-mutation-state') return 'Storage / Mutation State'
  return 'Compatibility / Test Evidence Owner'
}

function sharedUtilityTargetForGroup(group: ToolRuntimeSharedUtilityGroup): string {
  if (group === 'auth-oauth-secret') return 'auth, OAuth, secret storage, and certificate helpers used by provider/control-plane owners'
  if (group === 'process-execution') return 'process helpers consumed by Bash/PowerShell/tool lifecycle without owning execution policy'
  if (group === 'filesystem-path-data') return 'path, serialization, schema, and cache helpers consumed by source/evidence owners'
  if (group === 'scheduler-task-session') return 'cron, task, session, and background helpers consumed by query-loop/control-plane owners'
  if (group === 'network-http-platform') return 'HTTP, environment, platform, and network helpers consumed by provider/adapter owners'
  if (group === 'render-format-output') return 'rendering and formatting helpers consumed by product surface or final evidence owners'
  if (group === 'input-command-adapter') return 'input parsing helpers consumed by query-loop and command facade owners'
  if (group === 'storage-mutation-state') return 'local storage and mutation helpers consumed by state/evidence owners'
  return 'compatibility remnants and test evidence that cannot own product runtime'
}

function sharedUtilityRequiredActionForGroup(group: ToolRuntimeSharedUtilityGroup): string {
  if (group === 'auth-oauth-secret') return 'prove auth helpers are only called through provider/control-plane permissioned paths'
  if (group === 'process-execution') return 'prove process helpers cannot bypass Tool Gate or tool lifecycle execution policy'
  if (group === 'filesystem-path-data') return 'prove filesystem/data helpers are pure utilities or source evidence helpers'
  if (group === 'scheduler-task-session') return 'prove scheduler helpers report state to query-loop/control-plane evidence'
  if (group === 'network-http-platform') return 'prove network helpers are adapter utilities and do not own retry/runtime loops'
  if (group === 'render-format-output') return 'prove render helpers only project evidence or UI output'
  if (group === 'input-command-adapter') return 'prove input helpers route into query-loop or command facade owners'
  if (group === 'storage-mutation-state') return 'prove state helpers have a single storage/evidence owner'
  return 'map compatibility helpers to replacement owners or keep tests as verification evidence only'
}

function commandSurfaceSliceIdForGroup(group: ToolRuntimeCommandSurfaceGroup): ToolRuntimeCommandSurfaceSliceId {
  if (group === 'query-session-command') return 'TRR-02A'
  if (group === 'permission-tool-gate-command') return 'TRR-02B'
  if (group === 'provider-cost-command') return 'TRR-02C'
  if (group === 'mcp-skill-command') return 'TRR-02D'
  if (group === 'source-evidence-command') return 'TRR-02E'
  if (group === 'product-surface-command') return 'TRR-02F'
  if (group === 'trace-diagnostics-command') return 'TRR-02G'
  if (group === 'external-adapter-command') return 'TRR-02H'
  return 'TRR-02I'
}

function commandSurfaceOwnerForGroup(group: ToolRuntimeCommandSurfaceGroup): string {
  if (group === 'query-session-command') return 'Query Loop / Session Control'
  if (group === 'permission-tool-gate-command') return 'Permission / Tool Gate'
  if (group === 'provider-cost-command') return 'Model Router / Cost Evidence'
  if (group === 'mcp-skill-command') return 'MCP / Skill Registry'
  if (group === 'source-evidence-command') return 'Source Truth / Evidence'
  if (group === 'product-surface-command') return 'Product Surface Visible State'
  if (group === 'trace-diagnostics-command') return 'Trace / Diagnostics Evidence'
  if (group === 'external-adapter-command') return 'External Adapter With Hooks'
  return 'Command Compatibility Review'
}

function commandSurfaceTargetForGroup(group: ToolRuntimeCommandSurfaceGroup): string {
  if (group === 'query-session-command') return 'query-loop/session owner; command only chooses visible intent'
  if (group === 'permission-tool-gate-command') return 'Tool Gate permission lifecycle and visible recovery'
  if (group === 'provider-cost-command') return 'model router, usage, rate-limit, and cost evidence owner'
  if (group === 'mcp-skill-command') return 'single MCP/plugin/skill registry and parser path'
  if (group === 'source-evidence-command') return 'source truth and evidence-producing workflows'
  if (group === 'product-surface-command') return 'visible UI/config projection fed by existing owners'
  if (group === 'trace-diagnostics-command') return 'diagnostic trace and final evidence owner'
  if (group === 'external-adapter-command') return 'adapter boundary with permission, auth, and evidence hooks'
  return 'explicit owner decision before command facade closure'
}

function commandSurfaceRequiredActionForGroup(group: ToolRuntimeCommandSurfaceGroup): string {
  if (group === 'query-session-command') return 'prove command delegates to query-loop/session control and cannot finalize work by itself'
  if (group === 'permission-tool-gate-command') return 'prove command only changes visible permission policy through Tool Gate'
  if (group === 'provider-cost-command') return 'prove command reads or configures provider/cost state without owning a model runtime'
  if (group === 'mcp-skill-command') return 'prove command enters the single MCP/skill registry path'
  if (group === 'source-evidence-command') return 'prove command produces source/evidence requests without executing side-effect tools directly'
  if (group === 'product-surface-command') return 'prove command projects product state and does not own execution decisions'
  if (group === 'trace-diagnostics-command') return 'prove command observes diagnostics only and links output to evidence'
  if (group === 'external-adapter-command') return 'prove adapter command keeps permission/auth/evidence hooks and no standalone runtime loop'
  return 'map command to a concrete owner or quarantine before closing TRR-02'
}

function toolCoreSliceIdForGroup(group: ToolRuntimeToolCoreGroup): ToolRuntimeToolCoreSliceId {
  if (group === 'shell-execution-tool') return 'TRR-03A'
  if (group === 'file-source-tool') return 'TRR-03B'
  if (group === 'mcp-skill-resource-tool') return 'TRR-03C'
  if (group === 'plan-task-workflow-tool') return 'TRR-03D'
  if (group === 'worktree-config-control-tool') return 'TRR-03E'
  if (group === 'web-network-tool') return 'TRR-03F'
  if (group === 'evidence-output-tool') return 'TRR-03G'
  if (group === 'test-compat-tool') return 'TRR-03H'
  return 'TRR-03I'
}

function toolCoreOwnerForGroup(group: ToolRuntimeToolCoreGroup): string {
  if (group === 'shell-execution-tool') return 'Bash / PowerShell Adapter'
  if (group === 'file-source-tool') return 'Source Tool Adapter'
  if (group === 'mcp-skill-resource-tool') return 'MCP / Skill Resource Adapter'
  if (group === 'plan-task-workflow-tool') return 'Plan / Task / Workflow Tool Owner'
  if (group === 'worktree-config-control-tool') return 'Worktree / Config Control Tool Owner'
  if (group === 'web-network-tool') return 'Web / Network Tool Adapter'
  if (group === 'evidence-output-tool') return 'Evidence / User Output Tool Owner'
  if (group === 'test-compat-tool') return 'Tool Compatibility / Test Evidence'
  return 'Unmapped Tool Core Review'
}

function toolCoreTargetForGroup(group: ToolRuntimeToolCoreGroup): string {
  if (group === 'shell-execution-tool') return 'Tool Gate guarded shell execution through Bash/PowerShell adapter'
  if (group === 'file-source-tool') return 'ToolBus source read/edit/write/LSP evidence pack'
  if (group === 'mcp-skill-resource-tool') return 'single MCP/Skill registry and ToolSearch lifecycle'
  if (group === 'plan-task-workflow-tool') return 'query-loop plan/task/workflow lifecycle and recovery evidence'
  if (group === 'worktree-config-control-tool') return 'control-plane worktree/config/session state with tool evidence'
  if (group === 'web-network-tool') return 'WebFetch/WebSearch network adapter with permission and source evidence'
  if (group === 'evidence-output-tool') return 'user-visible output and evidence artifact emission'
  if (group === 'test-compat-tool') return 'compatibility helper or test evidence only'
  return 'explicit ToolBus owner decision before TRR-03 closure'
}

function toolCoreRequiredActionForGroup(group: ToolRuntimeToolCoreGroup): string {
  if (group === 'shell-execution-tool') return 'prove shell tools enter Tool Gate, adapter safety, lifecycle result, and recovery evidence'
  if (group === 'file-source-tool') return 'prove source tools emit bounded Tool Evidence Pack and cannot bypass read-before-edit discipline'
  if (group === 'mcp-skill-resource-tool') return 'prove MCP/resource/skill tools enter one registry, permission, and trace path'
  if (group === 'plan-task-workflow-tool') return 'prove plan/task/workflow tools are query-loop lifecycle states, not a second orchestrator'
  if (group === 'worktree-config-control-tool') return 'prove control tools update state through control-plane and emit evidence'
  if (group === 'web-network-tool') return 'prove web/network tools remain adapters with permission/source evidence hooks'
  if (group === 'evidence-output-tool') return 'prove user-output tools emit evidence and cannot declare global completion independently'
  if (group === 'test-compat-tool') return 'prove compatibility helpers are verification evidence and not product runtime owners'
  return 'map tool core path to a concrete ToolBus owner or quarantine before closing TRR-03'
}

function agentToolSliceIdForGroup(group: ToolRuntimeAgentToolGroup): ToolRuntimeAgentToolSliceId {
  if (group === 'agent-entry-lifecycle') return 'TRR-04A'
  if (group === 'agent-execution-runner') return 'TRR-04B'
  if (group === 'agent-registry-prompt') return 'TRR-04C'
  if (group === 'agent-memory-context') return 'TRR-04D'
  if (group === 'agent-visible-state') return 'TRR-04E'
  return 'TRR-04F'
}

function agentToolOwnerForGroup(group: ToolRuntimeAgentToolGroup): string {
  if (group === 'agent-entry-lifecycle') return 'Agent Tool Lifecycle Entry'
  if (group === 'agent-execution-runner') return 'Serial Worker / Parallel Fanout Runner'
  if (group === 'agent-registry-prompt') return 'Agent Registry / Prompt Owner'
  if (group === 'agent-memory-context') return 'Agent Context / Memory Evidence'
  if (group === 'agent-visible-state') return 'Agent Visible State Projection'
  return 'Unmapped Agent Tool Review'
}

function agentToolTargetForGroup(group: ToolRuntimeAgentToolGroup): string {
  if (group === 'agent-entry-lifecycle') return 'AgentTool entry through ToolBus with original tool evidence'
  if (group === 'agent-execution-runner') return 'serial_worker / parallel_fanout runner only'
  if (group === 'agent-registry-prompt') return 'agent definition registry and prompt selection evidence'
  if (group === 'agent-memory-context') return 'agent context and memory as evidence, not source truth replacement'
  if (group === 'agent-visible-state') return 'agent progress and display state projected from worker evidence'
  return 'explicit agent owner decision before TRR-04 closure'
}

function agentToolRequiredActionForGroup(group: ToolRuntimeAgentToolGroup): string {
  if (group === 'agent-entry-lifecycle') return 'prove AgentTool enters ToolBus and preserves original tool/result evidence'
  if (group === 'agent-execution-runner') return 'prove runner exposes only serial_worker or parallel_fanout, not role-swarm orchestration'
  if (group === 'agent-registry-prompt') return 'prove agent registry selects definitions without creating a second planner runtime'
  if (group === 'agent-memory-context') return 'prove agent memory/context is evidence input and cannot override source truth'
  if (group === 'agent-visible-state') return 'prove UI/display code projects worker state and cannot finalize parent synthesis'
  return 'map AgentTool path to a concrete agent owner or quarantine before closing TRR-04'
}

function externalIntegrationSliceIdForGroup(group: ToolRuntimeExternalIntegrationGroup): ToolRuntimeExternalIntegrationSliceId {
  if (group === 'native-runtime-adapter') return 'TRR-05A'
  if (group === 'plugin-bundle-adapter') return 'TRR-05B'
  if (group === 'direct-connect-server-adapter') return 'TRR-05C'
  if (group === 'product-compat-adapter') return 'TRR-05D'
  return 'TRR-05E'
}

function externalIntegrationOwnerForGroup(group: ToolRuntimeExternalIntegrationGroup): string {
  if (group === 'native-runtime-adapter') return 'Native Runtime Adapter'
  if (group === 'plugin-bundle-adapter') return 'Plugin Bundle Adapter'
  if (group === 'direct-connect-server-adapter') return 'Direct Connect Server Adapter'
  if (group === 'product-compat-adapter') return 'Product Compatibility Adapter'
  return 'Unmapped External Integration Review'
}

function externalIntegrationTargetForGroup(group: ToolRuntimeExternalIntegrationGroup): string {
  if (group === 'native-runtime-adapter') return 'native helper behind existing ToolBus/control-plane hooks'
  if (group === 'plugin-bundle-adapter') return 'plugin bundle discovery through MCP/skill/tool registry owner'
  if (group === 'direct-connect-server-adapter') return 'direct-connect session adapter with auth, permission, and evidence hooks'
  if (group === 'product-compat-adapter') return 'compat adapter projected through product/tool lifecycle owner'
  return 'explicit external adapter owner decision before TRR-05 closure'
}

function externalIntegrationRequiredActionForGroup(group: ToolRuntimeExternalIntegrationGroup): string {
  if (group === 'native-runtime-adapter') return 'prove native code is adapter-only and cannot own a separate tool runtime'
  if (group === 'plugin-bundle-adapter') return 'prove plugin bundles enter the single registry and permission/evidence path'
  if (group === 'direct-connect-server-adapter') return 'prove server adapter keeps auth, permission, and evidence boundaries'
  if (group === 'product-compat-adapter') return 'prove compatibility adapter is projection/hook only, not independent runtime'
  return 'map external integration path to a concrete adapter owner or quarantine before closing TRR-05'
}

function duplicateRiskForGroup(group: ToolRuntimeDirtyGroup): ToolRuntimeDirtyReviewBatch['duplicateSystemRisk'] {
  if (group === 'support-services' || group === 'commands' || group === 'tools-core') return 'high'
  if (group === 'agent-tool' || group === 'external-integration') return 'medium'
  return 'low'
}

function dispositionForGroup(group: ToolRuntimeDirtyGroup): ToolRuntimeDirtyReviewBatch['disposition'] {
  if (group === 'external-integration') return 'verify-and-keep'
  if (group === 'agent-tool') return 'migrate-to-single-mainline'
  return 'map-or-quarantine'
}

function requiredActionForGroup(group: ToolRuntimeDirtyGroup): string {
  if (group === 'support-services') return 'collapse helpers into the single DSXU tool lifecycle owner or mark replacement evidence'
  if (group === 'commands') return 'map command entrypoints to query-loop/tool lifecycle without a second executor'
  if (group === 'tools-core') return 'map old tools to ToolBus and Tool Evidence Pack before close'
  if (group === 'agent-tool') return 'remove duplicate Agent orchestration and map to serial_worker or parallel_fanout'
  return 'verify adapters keep permission and evidence hooks without creating a second runtime'
}

function sanitizePath(path: string): string {
  return path.replace(LEGACY_PRODUCT_PATTERN, 'legacy-product')
}

function buildSupportSlice(
  group: ToolRuntimeSupportServiceGroup,
  entries: readonly V18DirtyLedgerEntry[],
  options: ToolRuntimeDirtyReviewOptions,
): ToolRuntimeSupportServiceSlice {
  const sharedUtilitySlices = group === 'shared-runtime-utilities' ? buildSharedUtilitySlices(entries) : undefined
  const permissionImportUseScan = group === 'permission-safety' && options.permissionImportUseObservations
    ? buildPermissionToolGateImportUseScan(options.permissionImportUseObservations)
    : undefined
  const providerImportUseScan = group === 'provider-cost' && options.providerImportUseObservations
    ? buildProviderCostImportUseScan(options.providerImportUseObservations)
    : undefined
  const mcpSkillImportUseScan = group === 'mcp-plugin-skill' && options.mcpSkillImportUseObservations
    ? buildMcpSkillRegistryImportUseScan(options.mcpSkillImportUseObservations)
    : undefined
  const contextMemoryImportUseScan = group === 'context-memory-resume' && options.contextMemoryImportUseObservations
    ? buildContextMemoryResumeImportUseScan(options.contextMemoryImportUseObservations)
    : undefined
  const sourceEvidenceImportUseScan = group === 'source-analysis-evidence' && options.sourceEvidenceImportUseObservations
    ? buildSourceAnalysisEvidenceImportUseScan(options.sourceEvidenceImportUseObservations)
    : undefined
  const productSurfaceImportUseScan = group === 'product-surface-hooks' && options.productSurfaceImportUseObservations
    ? buildProductSurfaceHooksImportUseScan(options.productSurfaceImportUseObservations)
    : undefined
  const telemetryDiagnosticsImportUseScan = group === 'telemetry-diagnostics' && options.telemetryDiagnosticsImportUseObservations
    ? buildTelemetryDiagnosticsImportUseScan(options.telemetryDiagnosticsImportUseObservations)
    : undefined
  const sharedUtilityImportUseScan = group === 'shared-runtime-utilities' && options.sharedUtilityImportUseObservations
    ? buildSharedUtilityImportUseScan(options.sharedUtilityImportUseObservations)
    : undefined
  const mainlineImportUseProof = highRiskImportUseProofForGroup(
    group,
    permissionImportUseScan,
    providerImportUseScan,
    mcpSkillImportUseScan,
    contextMemoryImportUseScan,
    sourceEvidenceImportUseScan,
    productSurfaceImportUseScan,
    telemetryDiagnosticsImportUseScan,
  )
  const redlines = [
    ...(entries.length === 0 ? ['support-service slice has no entries'] : []),
    ...(contextMemoryImportUseScan?.redlines ?? []),
    ...(sourceEvidenceImportUseScan?.redlines ?? []),
    ...(productSurfaceImportUseScan?.redlines ?? []),
    ...(telemetryDiagnosticsImportUseScan?.redlines ?? []),
    ...(sharedUtilityImportUseScan?.redlines ?? []),
  ]
  return {
    id: supportSliceIdForGroup(group),
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: supportSliceOwnerForGroup(group),
    targetMainline: supportSliceTargetForGroup(group),
    duplicateSystemRisk: supportSliceRiskForGroup(group),
    disposition: supportSliceDispositionForGroup(group),
    requiredAction: supportSliceRequiredActionForGroup(group),
    canKeepAsGenericSupportBucket: false,
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    redlines,
    ...(mainlineImportUseProof ? { mainlineImportUseProof } : {}),
    ...(sharedUtilityImportUseScan ? { sharedUtilityImportUseScan } : {}),
    ...(sharedUtilitySlices ? { sharedUtilitySlices } : {}),
  }
}

function buildSharedUtilitySlice(
  group: ToolRuntimeSharedUtilityGroup,
  entries: readonly V18DirtyLedgerEntry[],
): ToolRuntimeSharedUtilitySlice {
  const redlines = [
    ...(entries.length === 0 ? ['shared utility owner slice has no entries'] : []),
  ]
  return {
    id: sharedUtilitySliceIdForGroup(group),
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: sharedUtilityOwnerForGroup(group),
    targetMainline: sharedUtilityTargetForGroup(group),
    requiredAction: sharedUtilityRequiredActionForGroup(group),
    canKeepAsGenericSupportBucket: false,
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

function buildSharedUtilitySlices(entries: readonly V18DirtyLedgerEntry[]): readonly ToolRuntimeSharedUtilitySlice[] {
  return sharedUtilitySliceOrder
    .map(group => {
      const sliceEntries = entries.filter(entry => sharedUtilitySliceForPath(entry.path) === group)
      return sliceEntries.length > 0 ? buildSharedUtilitySlice(group, sliceEntries) : null
    })
    .filter((slice): slice is ToolRuntimeSharedUtilitySlice => slice !== null)
}

function buildCommandSurfaceSlice(
  group: ToolRuntimeCommandSurfaceGroup,
  entries: readonly V18DirtyLedgerEntry[],
): ToolRuntimeCommandSurfaceSlice {
  const redlines = [
    ...(entries.length === 0 ? ['command owner slice has no entries'] : []),
    ...(group === 'compat-command-review' && entries.length > 0 ? ['command facade has unmapped compatibility entries'] : []),
  ]
  return {
    id: commandSurfaceSliceIdForGroup(group),
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: commandSurfaceOwnerForGroup(group),
    targetMainline: commandSurfaceTargetForGroup(group),
    requiredAction: commandSurfaceRequiredActionForGroup(group),
    canKeepAsGenericCommandBucket: false,
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

function buildCommandSurfaceSlices(entries: readonly V18DirtyLedgerEntry[]): readonly ToolRuntimeCommandSurfaceSlice[] {
  return commandSurfaceSliceOrder
    .map(group => {
      const sliceEntries = entries.filter(entry => commandSurfaceSliceForPath(entry.path) === group)
      return sliceEntries.length > 0 ? buildCommandSurfaceSlice(group, sliceEntries) : null
    })
    .filter((slice): slice is ToolRuntimeCommandSurfaceSlice => slice !== null)
}

function buildToolCoreSlice(
  group: ToolRuntimeToolCoreGroup,
  entries: readonly V18DirtyLedgerEntry[],
  options: ToolRuntimeDirtyReviewOptions,
): ToolRuntimeToolCoreSlice {
  const importUseScan =
    group === 'shell-execution-tool' && options.shellToolImportUseObservations
      ? buildShellExecutionToolImportUseScan(options.shellToolImportUseObservations)
      : group === 'file-source-tool' && options.fileSourceToolImportUseObservations
        ? buildFileSourceToolImportUseScan(options.fileSourceToolImportUseObservations)
        : group === 'mcp-skill-resource-tool' && options.mcpSkillResourceToolImportUseObservations
          ? buildMcpSkillResourceToolImportUseScan(options.mcpSkillResourceToolImportUseObservations)
          : group === 'plan-task-workflow-tool' && options.planTaskWorkflowToolImportUseObservations
            ? buildPlanTaskWorkflowToolImportUseScan(options.planTaskWorkflowToolImportUseObservations)
            : group === 'worktree-config-control-tool' && options.worktreeConfigToolImportUseObservations
              ? buildWorktreeConfigToolImportUseScan(options.worktreeConfigToolImportUseObservations)
              : group === 'web-network-tool' && options.webNetworkToolImportUseObservations
                ? buildWebNetworkToolImportUseScan(options.webNetworkToolImportUseObservations)
                : group === 'evidence-output-tool' && options.evidenceOutputToolImportUseObservations
                  ? buildEvidenceOutputToolImportUseScan(options.evidenceOutputToolImportUseObservations)
                  : group === 'test-compat-tool' && options.testCompatToolImportUseObservations
                    ? buildTestCompatToolImportUseScan(options.testCompatToolImportUseObservations)
                    : undefined
  const redlines = [
    ...(entries.length === 0 ? ['tool-core owner slice has no entries'] : []),
    ...(group === 'unmapped-tool-core' && entries.length > 0 ? ['tool core has unmapped entries without concrete ToolBus owner'] : []),
    ...(importUseScan?.redlines ?? []),
  ]
  return {
    id: toolCoreSliceIdForGroup(group),
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: toolCoreOwnerForGroup(group),
    targetMainline: toolCoreTargetForGroup(group),
    requiredAction: toolCoreRequiredActionForGroup(group),
    canKeepAsSeparateToolRuntime: false,
    ...(importUseScan ? { importUseScan } : {}),
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

function buildToolCoreSlices(
  entries: readonly V18DirtyLedgerEntry[],
  options: ToolRuntimeDirtyReviewOptions,
): readonly ToolRuntimeToolCoreSlice[] {
  return toolCoreSliceOrder
    .map(group => {
      const sliceEntries = entries.filter(entry => toolCoreSliceForPath(entry.path) === group)
      return sliceEntries.length > 0 ? buildToolCoreSlice(group, sliceEntries, options) : null
    })
    .filter((slice): slice is ToolRuntimeToolCoreSlice => slice !== null)
}

function buildAgentToolSlice(
  group: ToolRuntimeAgentToolGroup,
  entries: readonly V18DirtyLedgerEntry[],
  options: ToolRuntimeDirtyReviewOptions,
): ToolRuntimeAgentToolSlice {
  const importUseScan =
    group === 'agent-entry-lifecycle' && options.agentEntryLifecycleImportUseObservations
      ? buildAgentEntryLifecycleImportUseScan(options.agentEntryLifecycleImportUseObservations)
      : group === 'agent-execution-runner' && options.agentExecutionRunnerImportUseObservations
        ? buildAgentExecutionRunnerImportUseScan(options.agentExecutionRunnerImportUseObservations)
        : group === 'agent-registry-prompt' && options.agentRegistryPromptImportUseObservations
          ? buildAgentRegistryPromptImportUseScan(options.agentRegistryPromptImportUseObservations)
          : group === 'agent-memory-context' && options.agentMemoryContextImportUseObservations
            ? buildAgentMemoryContextImportUseScan(options.agentMemoryContextImportUseObservations)
            : group === 'agent-visible-state' && options.agentVisibleStateImportUseObservations
              ? buildAgentVisibleStateImportUseScan(options.agentVisibleStateImportUseObservations)
              : undefined
  const redlines = [
    ...(entries.length === 0 ? ['agent-tool owner slice has no entries'] : []),
    ...(group === 'unmapped-agent-tool' && entries.length > 0 ? ['AgentTool has unmapped entries without concrete agent owner'] : []),
    ...(importUseScan?.redlines ?? []),
  ]
  return {
    id: agentToolSliceIdForGroup(group),
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: agentToolOwnerForGroup(group),
    targetMainline: agentToolTargetForGroup(group),
    requiredAction: agentToolRequiredActionForGroup(group),
    canKeepAsSecondAgentRuntime: false,
    ...(importUseScan ? { importUseScan } : {}),
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

function buildAgentToolSlices(
  entries: readonly V18DirtyLedgerEntry[],
  options: ToolRuntimeDirtyReviewOptions,
): readonly ToolRuntimeAgentToolSlice[] {
  return agentToolSliceOrder
    .map(group => {
      const sliceEntries = entries.filter(entry => agentToolSliceForPath(entry.path) === group)
      return sliceEntries.length > 0 ? buildAgentToolSlice(group, sliceEntries, options) : null
    })
    .filter((slice): slice is ToolRuntimeAgentToolSlice => slice !== null)
}

function buildExternalIntegrationSlice(
  group: ToolRuntimeExternalIntegrationGroup,
  entries: readonly V18DirtyLedgerEntry[],
  options: ToolRuntimeDirtyReviewOptions,
): ToolRuntimeExternalIntegrationSlice {
  const importUseScan =
    group === 'native-runtime-adapter' && options.nativeRuntimeAdapterImportUseObservations
      ? buildNativeRuntimeAdapterImportUseScan(options.nativeRuntimeAdapterImportUseObservations)
      : group === 'plugin-bundle-adapter' && options.pluginBundleAdapterImportUseObservations
        ? buildPluginBundleAdapterImportUseScan(options.pluginBundleAdapterImportUseObservations)
        : group === 'direct-connect-server-adapter' && options.directConnectServerAdapterImportUseObservations
          ? buildDirectConnectServerAdapterImportUseScan(options.directConnectServerAdapterImportUseObservations)
          : group === 'product-compat-adapter' && options.productCompatAdapterImportUseObservations
            ? buildProductCompatAdapterImportUseScan(options.productCompatAdapterImportUseObservations)
            : undefined
  const redlines = [
    ...(entries.length === 0 ? ['external integration owner slice has no entries'] : []),
    ...(group === 'unmapped-external-integration' && entries.length > 0 ? ['external integration has unmapped entries without concrete adapter owner'] : []),
    ...(importUseScan?.redlines ?? []),
  ]
  return {
    id: externalIntegrationSliceIdForGroup(group),
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: externalIntegrationOwnerForGroup(group),
    targetMainline: externalIntegrationTargetForGroup(group),
    requiredAction: externalIntegrationRequiredActionForGroup(group),
    canKeepAsStandaloneRuntime: false,
    ...(importUseScan ? { importUseScan } : {}),
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

function buildExternalIntegrationSlices(
  entries: readonly V18DirtyLedgerEntry[],
  options: ToolRuntimeDirtyReviewOptions,
): readonly ToolRuntimeExternalIntegrationSlice[] {
  return externalIntegrationSliceOrder
    .map(group => {
      const sliceEntries = entries.filter(entry => externalIntegrationSliceForPath(entry.path) === group)
      return sliceEntries.length > 0 ? buildExternalIntegrationSlice(group, sliceEntries, options) : null
    })
    .filter((slice): slice is ToolRuntimeExternalIntegrationSlice => slice !== null)
}

function buildSupportSlices(
  entries: readonly V18DirtyLedgerEntry[],
  options: ToolRuntimeDirtyReviewOptions,
): readonly ToolRuntimeSupportServiceSlice[] {
  return supportSliceOrder
    .map(group => {
      const sliceEntries = entries.filter(entry => supportSliceForPath(entry.path) === group)
      return sliceEntries.length > 0 ? buildSupportSlice(group, sliceEntries, options) : null
    })
    .filter((slice): slice is ToolRuntimeSupportServiceSlice => slice !== null)
}

function buildBatch(
  group: ToolRuntimeDirtyGroup,
  entries: readonly V18DirtyLedgerEntry[],
  options: ToolRuntimeDirtyReviewOptions,
): ToolRuntimeDirtyReviewBatch {
  const redlines = entries.length === 0 ? ['batch has no entries'] : []
  const supportSlices = group === 'support-services' ? buildSupportSlices(entries, options) : undefined
  const commandSurfaceSlices = group === 'commands' ? buildCommandSurfaceSlices(entries) : undefined
  const toolCoreSlices = group === 'tools-core' ? buildToolCoreSlices(entries, options) : undefined
  const agentToolSlices = group === 'agent-tool' ? buildAgentToolSlices(entries, options) : undefined
  const externalIntegrationSlices = group === 'external-integration' ? buildExternalIntegrationSlices(entries, options) : undefined
  const batchRedlines = [
    ...redlines,
    ...(commandSurfaceSlices?.flatMap(slice => slice.redlines) ?? []),
    ...(toolCoreSlices?.flatMap(slice => slice.redlines) ?? []),
    ...(agentToolSlices?.flatMap(slice => slice.redlines) ?? []),
    ...(externalIntegrationSlices?.flatMap(slice => slice.redlines) ?? []),
  ]
  return {
    id: idForGroup(group),
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: ownerForGroup(group),
    targetMainline: targetMainlineForGroup(group),
    duplicateSystemRisk: duplicateRiskForGroup(group),
    status: batchRedlines.length > 0 ? 'BLOCKED' : 'PARTIAL',
    disposition: dispositionForGroup(group),
    requiredAction: requiredActionForGroup(group),
    canAutoClose: false,
    samplePaths: entries.slice(0, 10).map(entry => sanitizePath(entry.path)),
    redlines: batchRedlines,
    ...(supportSlices ? { supportSlices } : {}),
    ...(commandSurfaceSlices ? { commandSurfaceSlices } : {}),
    ...(toolCoreSlices ? { toolCoreSlices } : {}),
    ...(agentToolSlices ? { agentToolSlices } : {}),
    ...(externalIntegrationSlices ? { externalIntegrationSlices } : {}),
  }
}

export function buildToolRuntimeDirtyReview(
  ledger: V18DirtyQuarantineLedger,
  options: ToolRuntimeDirtyReviewOptions = {},
): ToolRuntimeDirtyReview {
  const toolEntries = ledger.entries.filter(entry => entry.category === 'mainline_active' && isToolRuntimePath(entry.path))
  const batches = groupOrder
    .map(group => {
      const entries = toolEntries.filter(entry => groupForPath(entry.path) === group)
      return entries.length > 0 ? buildBatch(group, entries, options) : null
    })
    .filter((batch): batch is ToolRuntimeDirtyReviewBatch => batch !== null)
  const pass = batches.filter(batch => batch.status === 'PASS').length
  const partial = batches.filter(batch => batch.status === 'PARTIAL').length
  const blocked = batches.filter(batch => batch.status === 'BLOCKED').length
  const highDuplicateRiskBatchCount = batches.filter(batch => batch.duplicateSystemRisk === 'high').length
  const supportSlices = batches.flatMap(batch => batch.supportSlices ?? [])
  const commandSurfaceSlices = batches.flatMap(batch => batch.commandSurfaceSlices ?? [])
  const toolCoreSlices = batches.flatMap(batch => batch.toolCoreSlices ?? [])
  const agentToolSlices = batches.flatMap(batch => batch.agentToolSlices ?? [])
  const externalIntegrationSlices = batches.flatMap(batch => batch.externalIntegrationSlices ?? [])
  const sharedUtilitySlices = supportSlices.flatMap(slice => slice.sharedUtilitySlices ?? [])
  const importUseScans = [
    ...supportSlices.flatMap(slice => slice.mainlineImportUseProof?.importUseScan ? [slice.mainlineImportUseProof.importUseScan] : []),
    ...supportSlices.flatMap(slice => slice.sharedUtilityImportUseScan ? [slice.sharedUtilityImportUseScan] : []),
    ...toolCoreSlices.flatMap(slice => slice.importUseScan ? [slice.importUseScan] : []),
    ...agentToolSlices.flatMap(slice => slice.importUseScan ? [slice.importUseScan] : []),
    ...externalIntegrationSlices.flatMap(slice => slice.importUseScan ? [slice.importUseScan] : []),
  ]
  const importUseUnknownCallerCount = importUseScans
    .reduce((sum, scan) => sum + scan.unknownCallerCount, 0)
  const importUseForbiddenClosureCount = importUseScans
    .reduce((sum, scan) => sum + scan.forbiddenClosureCount, 0)
  const redlines = [
    ...(toolEntries.length > 0 ? ['tool runtime dirty entries remain open'] : []),
    ...batches.flatMap(batch => batch.redlines.map(redline => `${batch.id}: ${redline}`)),
    ...supportSlices.flatMap(slice => slice.redlines.map(redline => `${slice.id}: ${redline}`)),
    ...supportSlices.flatMap(slice => slice.mainlineImportUseProof?.importUseScan?.redlines.map(redline => `${slice.id}: ${redline}`) ?? []),
    ...supportSlices.flatMap(slice => slice.sharedUtilityImportUseScan?.redlines.map(redline => `${slice.id}: ${redline}`) ?? []),
    ...sharedUtilitySlices.flatMap(slice => slice.redlines.map(redline => `${slice.id}: ${redline}`)),
  ]
  const status: ToolRuntimeDirtyReviewStatus = blocked > 0
    ? 'BLOCKED'
    : toolEntries.length > 0 || partial > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.tool-runtime-dirty-review.v1',
    status,
    total: toolEntries.length,
    batchCount: batches.length,
    pass,
    partial,
    blocked,
    highDuplicateRiskBatchCount,
    supportServiceSliceCount: supportSlices.length,
    supportServiceHighRiskSliceCount: supportSlices.filter(slice => slice.duplicateSystemRisk === 'high').length,
    supportServiceHighRiskProofCount: supportSlices.filter(slice => slice.duplicateSystemRisk === 'high' && slice.mainlineImportUseProof !== undefined).length,
    supportServiceSharedHelperCount: supportSlices
      .filter(slice => slice.group === 'shared-runtime-utilities')
      .reduce((sum, slice) => sum + slice.count, 0),
    supportServiceSharedOwnerSliceCount: sharedUtilitySlices.length,
    supportServiceUnassignedSharedHelperCount: sharedUtilitySlices
      .filter(slice => slice.group === 'compat-test-evidence')
      .reduce((sum, slice) => slice.redlines.length > 0 ? sum + slice.count : sum, 0),
    commandSurfaceSliceCount: commandSurfaceSlices.length,
    commandSurfaceUnassignedCount: commandSurfaceSlices
      .filter(slice => slice.group === 'compat-command-review')
      .reduce((sum, slice) => slice.redlines.length > 0 ? sum + slice.count : sum, 0),
    toolCoreSliceCount: toolCoreSlices.length,
    toolCoreUnassignedCount: toolCoreSlices
      .filter(slice => slice.group === 'unmapped-tool-core')
      .reduce((sum, slice) => slice.redlines.length > 0 ? sum + slice.count : sum, 0),
    agentToolSliceCount: agentToolSlices.length,
    agentToolUnassignedCount: agentToolSlices
      .filter(slice => slice.group === 'unmapped-agent-tool')
      .reduce((sum, slice) => slice.redlines.length > 0 ? sum + slice.count : sum, 0),
    externalIntegrationSliceCount: externalIntegrationSlices.length,
    externalIntegrationUnassignedCount: externalIntegrationSlices
      .filter(slice => slice.group === 'unmapped-external-integration')
      .reduce((sum, slice) => slice.redlines.length > 0 ? sum + slice.count : sum, 0),
    importUseUnknownCallerCount,
    importUseForbiddenClosureCount,
    duplicationDecisionStatus: 'NOT_RUN',
    duplicationDecisionBatchCount: 0,
    canCloseToolRuntimeGate: toolEntries.length === 0 && blocked === 0,
    mustNotStageOrRestore: toolEntries.length > 0 || blocked > 0,
    batches,
    redlines,
    safeguards: [
      'review is evidence-only and does not stage, delete, restore, move, reset, or commit files',
      'tool runtime cannot keep a second executor, second command owner, or parallel orchestration layer',
      'duplicate equivalent behavior must be merged into the original owner or marked replace/delete candidate, not kept for later',
      'compatibility labels may remain only for test evidence or adapter projection; product runtime paths must have a concrete owner',
      'all retained paths must route through the single DSXU tool lifecycle and evidence owner',
      'disposition is a review state, not permission to delete files',
    ],
    nextAction: importUseForbiddenClosureCount > 0 || importUseUnknownCallerCount > 0
      ? 'resolve-import-use-blockers'
      : batches.some(batch => batch.group === 'support-services')
        ? 'collapse-support-services'
        : batches.some(batch => batch.group === 'commands')
          ? 'map-commands-to-tool-lifecycle'
          : batches.length > 0
            ? 'review-tool-core'
            : 'tool-runtime-gate-closed',
  }
}
