import type {
  ToolRuntimeAgentToolSlice,
  ToolRuntimeCommandSurfaceSlice,
  ToolRuntimeDirtyReview,
  ToolRuntimeDirtyReviewBatch,
  ToolRuntimeExternalIntegrationSlice,
  ToolRuntimeMainlineImportUseProof,
  ToolRuntimePermissionImportUseScan,
  ToolRuntimeSupportServiceSlice,
  ToolRuntimeSharedUtilitySlice,
  ToolRuntimeToolCoreSlice,
} from './tool-runtime-dirty-review-v1'

export type ToolRuntimeDuplicationDecisionStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'
export type ToolRuntimeDuplicationDisposition =
  | 'merge-to-single-mainline'
  | 'replace-or-delete-candidate'
  | 'keep-adapter-with-mainline-hooks'
  | 'quarantine-if-unmapped'

export type ToolRuntimeDuplicationDecisionBatch = {
  sourceBatchId: string
  group: string
  count: number
  duplicateSystemRisk: ToolRuntimeDirtyReviewBatch['duplicateSystemRisk']
  targetMainline: string
  disposition: ToolRuntimeDuplicationDisposition
  canDeleteNow: false
  canKeepAsSeparateRuntime: false
  requiredProofBeforeClose: readonly string[]
  redlines: readonly string[]
  supportServiceDecisions?: readonly ToolRuntimeSupportServiceDecision[]
  commandSurfaceDecisions?: readonly ToolRuntimeCommandSurfaceDecision[]
  toolCoreDecisions?: readonly ToolRuntimeToolCoreDecision[]
  agentToolDecisions?: readonly ToolRuntimeAgentToolDecision[]
  externalIntegrationDecisions?: readonly ToolRuntimeExternalIntegrationDecision[]
}

export type ToolRuntimeSupportServiceDecision = {
  sourceSliceId: string
  group: string
  count: number
  owner: string
  targetMainline: string
  duplicateSystemRisk: ToolRuntimeSupportServiceSlice['duplicateSystemRisk']
  disposition: ToolRuntimeSupportServiceSlice['disposition']
  canKeepAsGenericSupportBucket: false
  forbiddenRuntimeClosureCount: number
  requiredProofBeforeClose: readonly string[]
  redlines: readonly string[]
  mainlineImportUseProof?: ToolRuntimeMainlineImportUseProof
  sharedUtilityImportUseScan?: ToolRuntimePermissionImportUseScan
  sharedUtilityDecisions?: readonly ToolRuntimeSharedUtilityDecision[]
}

export type ToolRuntimeSharedUtilityDecision = {
  sourceSliceId: string
  group: string
  count: number
  owner: string
  targetMainline: string
  canKeepAsGenericSupportBucket: false
  requiredProofBeforeClose: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeCommandSurfaceDecision = {
  sourceSliceId: string
  group: string
  count: number
  owner: string
  targetMainline: string
  canKeepAsGenericCommandBucket: false
  requiredProofBeforeClose: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeToolCoreDecision = {
  sourceSliceId: string
  group: string
  count: number
  owner: string
  targetMainline: string
  canKeepAsSeparateToolRuntime: false
  importUseScan?: ToolRuntimePermissionImportUseScan
  requiredProofBeforeClose: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeAgentToolDecision = {
  sourceSliceId: string
  group: string
  count: number
  owner: string
  targetMainline: string
  canKeepAsSecondAgentRuntime: false
  importUseScan?: ToolRuntimePermissionImportUseScan
  requiredProofBeforeClose: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeExternalIntegrationDecision = {
  sourceSliceId: string
  group: string
  count: number
  owner: string
  targetMainline: string
  canKeepAsStandaloneRuntime: false
  importUseScan?: ToolRuntimePermissionImportUseScan
  requiredProofBeforeClose: readonly string[]
  redlines: readonly string[]
}

export type ToolRuntimeDuplicationDecision = {
  schemaVersion: 'dsxu.tool-runtime-duplication-decision.v1'
  status: ToolRuntimeDuplicationDecisionStatus
  total: number
  batchCount: number
  mergeRequiredCount: number
  replaceOrDeleteCandidateCount: number
  keepAdapterCount: number
  quarantineIfUnmappedCount: number
  highDuplicateRiskCount: number
  supportServiceDecisionCount: number
  highRiskImportUseProofCount: number
  forbiddenRuntimeClosureCount: number
  supportServiceSharedHelperCount: number
  sharedUtilityDecisionCount: number
  unassignedSharedHelperCount: number
  commandSurfaceDecisionCount: number
  unassignedCommandSurfaceCount: number
  toolCoreDecisionCount: number
  unassignedToolCoreCount: number
  agentToolDecisionCount: number
  unassignedAgentToolCount: number
  externalIntegrationDecisionCount: number
  unassignedExternalIntegrationCount: number
  canCloseDuplicationGate: boolean
  mustNotDeleteOrStage: boolean
  batches: readonly ToolRuntimeDuplicationDecisionBatch[]
  redlines: readonly string[]
  safeguards: readonly string[]
  nextAction: 'collapse-support-services' | 'map-command-facades' | 'merge-tool-core' | 'duplication-gate-closed'
}

function dispositionForBatch(batch: ToolRuntimeDirtyReviewBatch): ToolRuntimeDuplicationDisposition {
  if (batch.group === 'commands') return 'replace-or-delete-candidate'
  if (batch.group === 'external-integration') return 'keep-adapter-with-mainline-hooks'
  if (batch.group === 'support-services' || batch.group === 'tools-core' || batch.group === 'agent-tool') {
    return 'merge-to-single-mainline'
  }
  return 'quarantine-if-unmapped'
}

function proofForBatch(batch: ToolRuntimeDirtyReviewBatch): readonly string[] {
  if (batch.group === 'commands') {
    return [
      'command entrypoint is routed through query-loop',
      'tool lifecycle evidence is emitted',
      'no second executor remains',
    ]
  }
  if (batch.group === 'agent-tool') {
    return [
      'Agent path maps to serial_worker or parallel_fanout',
      'parent synthesis uses worker evidence',
      'no duplicate orchestration owner remains',
    ]
  }
  if (batch.group === 'external-integration') {
    return [
      'adapter keeps permission hook',
      'adapter emits evidence artifact',
      'adapter does not own a runtime loop',
    ]
  }
  return [
    'path maps to one DSXU mainline owner',
    'replacement evidence or migration target is recorded',
    'no duplicate tool runtime remains',
  ]
}

function proofForSupportSlice(slice: ToolRuntimeSupportServiceSlice): readonly string[] {
  if (slice.group === 'permission-safety') {
    return [
      'permission helpers enter Tool Gate',
      'visible wait, denial, and recovery evidence exists',
      'no support helper executes tools directly',
    ]
  }
  if (slice.group === 'provider-cost') {
    return [
      'provider helper enters model router',
      'usage, cache, and cost evidence is emitted',
      'no provider helper owns a second model runtime',
    ]
  }
  if (slice.group === 'mcp-plugin-skill') {
    return [
      'MCP and skills enter one registry/parser',
      'permission and trace hooks are preserved',
      'dynamic skills do not bypass tool lifecycle',
    ]
  }
  if (slice.group === 'context-memory-resume') {
    return [
      'source truth remains primary over memory',
      'compact/resume snapshot keeps next action and failures',
      'memory helper does not inject an independent prompt owner',
    ]
  }
  if (slice.group === 'source-analysis-evidence') {
    return [
      'source helpers produce bounded evidence',
      'static analysis does not execute side-effect tools',
      'evidence path is linked to final report or recovery',
    ]
  }
  if (slice.group === 'product-surface-hooks') {
    return [
      'UI hooks project query-loop or tool evidence state',
      'product surface does not own execution decisions',
      'permission and background states remain visible',
    ]
  }
  if (slice.group === 'telemetry-diagnostics') {
    return [
      'diagnostics observe lifecycle events only',
      'trace output links back to owning mainline',
      'telemetry does not decide tool execution',
    ]
  }
  return [
    'shared helper is split by concrete DSXU owner',
    'generic support bucket is not closable',
    'every nested shared utility owner has close proof',
  ]
}

function proofForSharedUtilitySlice(slice: ToolRuntimeSharedUtilitySlice): readonly string[] {
  if (slice.group === 'auth-oauth-secret') {
    return [
      'auth helper is only used through provider or control-plane owner',
      'secret and token access has permission or config boundary',
      'helper does not own model/tool execution',
    ]
  }
  if (slice.group === 'process-execution') {
    return [
      'process helper is called by Bash/PowerShell/tool lifecycle only',
      'Tool Gate remains the execution policy owner',
      'helper emits or preserves lifecycle evidence',
    ]
  }
  if (slice.group === 'filesystem-path-data') {
    return [
      'helper is pure path/data/schema utility or source evidence helper',
      'helper does not perform untracked side effects',
      'owning caller records evidence when used for tool execution',
    ]
  }
  if (slice.group === 'scheduler-task-session') {
    return [
      'scheduler helper reports state to query-loop/control-plane',
      'background work cannot finalize current user turn',
      'task/session state is recoverable',
    ]
  }
  if (slice.group === 'network-http-platform') {
    return [
      'network helper is adapter/provider utility only',
      'retry and runtime loop ownership stays outside the helper',
      'network side effects are permissioned or traced',
    ]
  }
  if (slice.group === 'render-format-output') {
    return [
      'render helper only projects UI or evidence output',
      'rendering cannot decide tool success',
      'final evidence owner keeps source trace',
    ]
  }
  if (slice.group === 'input-command-adapter') {
    return [
      'input helper routes to query-loop or command facade',
      'input parsing does not execute tools directly',
      'command lifecycle evidence is preserved',
    ]
  }
  if (slice.group === 'storage-mutation-state') {
    return [
      'storage helper has one state or evidence owner',
      'mutation helper cannot bypass source truth',
      'state writes are traceable or release-excluded',
    ]
  }
  return [
    'test helper remains verification evidence only',
    'test helper does not define product runtime behavior',
    'non-test paths cannot remain in this slice',
  ]
}

function proofForCommandSurfaceSlice(slice: ToolRuntimeCommandSurfaceSlice): readonly string[] {
  if (slice.group === 'query-session-command') {
    return [
      'command delegates to query-loop or session control',
      'command cannot finalize a turn outside query-loop',
      'visible state keeps next action and recovery',
    ]
  }
  if (slice.group === 'permission-tool-gate-command') {
    return [
      'command changes permission state only through Tool Gate owner',
      'visible denial and recovery state remains available',
      'command does not execute protected tools directly',
    ]
  }
  if (slice.group === 'provider-cost-command') {
    return [
      'command routes model or cost state through provider owner',
      'usage and rate-limit evidence remains observable',
      'command does not create a provider runtime loop',
    ]
  }
  if (slice.group === 'mcp-skill-command') {
    return [
      'command enters one MCP/plugin/skill registry',
      'dynamic command loading stays parser and permission bounded',
      'command cannot bypass tool lifecycle evidence',
    ]
  }
  if (slice.group === 'source-evidence-command') {
    return [
      'command produces source or repository evidence requests',
      'side-effect tools remain owned by ToolBus lifecycle',
      'source truth links to final evidence or recovery',
    ]
  }
  if (slice.group === 'product-surface-command') {
    return [
      'command projects product-visible state only',
      'execution decisions remain in query-loop or tool owner',
      'UI/config output is traceable to owning state',
    ]
  }
  if (slice.group === 'trace-diagnostics-command') {
    return [
      'command observes diagnostics without owning execution',
      'trace output links to lifecycle evidence',
      'diagnostic command cannot declare task completion',
    ]
  }
  if (slice.group === 'external-adapter-command') {
    return [
      'adapter command keeps auth, permission, and evidence hooks',
      'external side effects are routed through adapter owner',
      'adapter command does not create a standalone runtime loop',
    ]
  }
  return [
    'command must be mapped to a concrete owner',
    'generic command bucket cannot close',
    'compatibility command cannot define product runtime behavior',
  ]
}

function proofForToolCoreSlice(slice: ToolRuntimeToolCoreSlice): readonly string[] {
  if (slice.group === 'shell-execution-tool') {
    return [
      'shell tool enters Tool Gate before execution',
      'Bash/PowerShell adapter owns command safety semantics',
      'tool result and recovery evidence are emitted through ToolBus lifecycle',
    ]
  }
  if (slice.group === 'file-source-tool') {
    return [
      'file/source tool emits bounded Tool Evidence Pack',
      'read-before-edit and source truth discipline remain outside UI text',
      'file tool cannot finalize the query-loop turn independently',
    ]
  }
  if (slice.group === 'mcp-skill-resource-tool') {
    return [
      'MCP/resource/skill tool enters one registry and ToolSearch path',
      'permission and trace hooks are preserved',
      'dynamic tool output cannot bypass Tool Evidence Pack',
    ]
  }
  if (slice.group === 'plan-task-workflow-tool') {
    return [
      'plan/task/workflow tool is query-loop lifecycle state',
      'background or scheduled work cannot become a second orchestrator',
      'recovery and progress evidence remain visible',
    ]
  }
  if (slice.group === 'worktree-config-control-tool') {
    return [
      'worktree/config control tool updates state through control-plane owner',
      'state mutation is permissioned or traceable',
      'control tool cannot own global execution decisions',
    ]
  }
  if (slice.group === 'web-network-tool') {
    return [
      'web/network tool remains an adapter with permission and source hooks',
      'network result is linked to source evidence',
      'adapter cannot create a standalone retrieval runtime',
    ]
  }
  if (slice.group === 'evidence-output-tool') {
    return [
      'user-output tool emits evidence artifacts or visible response only',
      'output tool cannot declare task completion outside query-loop',
      'evidence path links back to owning lifecycle',
    ]
  }
  if (slice.group === 'test-compat-tool') {
    return [
      'compat helper remains verification evidence only',
      'test helper cannot define product tool runtime behavior',
      'non-test paths must have concrete ToolBus owner',
    ]
  }
  return [
    'tool core path must be mapped to a concrete ToolBus owner',
    'generic tool-core bucket cannot close',
    'unmapped tool cannot remain as a separate runtime',
  ]
}

function proofForAgentToolSlice(slice: ToolRuntimeAgentToolSlice): readonly string[] {
  if (slice.group === 'agent-execution-runner') {
    return [
      'runner exposes serial_worker or parallel_fanout only',
      'parent synthesis waits for worker evidence',
      'runner cannot create role-swarm orchestration',
    ]
  }
  if (slice.group === 'agent-registry-prompt') {
    return [
      'agent registry selects definitions and prompts only',
      'registry cannot own execution loop',
      'agent selection is traceable',
    ]
  }
  if (slice.group === 'agent-memory-context') {
    return [
      'agent memory is evidence input',
      'memory cannot override source truth',
      'context handoff is recoverable',
    ]
  }
  if (slice.group === 'agent-visible-state') {
    return [
      'display state projects worker evidence only',
      'UI cannot finalize parent synthesis',
      'progress remains visible and traceable',
    ]
  }
  if (slice.group === 'agent-entry-lifecycle') {
    return [
      'AgentTool enters ToolBus lifecycle',
      'original tool evidence is preserved',
      'AgentTool cannot bypass Tool Gate',
    ]
  }
  return [
    'AgentTool path must map to concrete agent owner',
    'generic agent bucket cannot close',
    'unmapped agent path cannot remain a second runtime',
  ]
}

function proofForExternalIntegrationSlice(slice: ToolRuntimeExternalIntegrationSlice): readonly string[] {
  if (slice.group === 'native-runtime-adapter') {
    return [
      'native code is adapter-only',
      'native helper cannot own tool runtime loop',
      'native output is consumed through existing owner',
    ]
  }
  if (slice.group === 'plugin-bundle-adapter') {
    return [
      'plugin bundle enters one registry',
      'plugin adapter keeps permission/evidence hooks',
      'plugin code cannot create separate tool runtime',
    ]
  }
  if (slice.group === 'direct-connect-server-adapter') {
    return [
      'server adapter keeps auth boundary',
      'permission and evidence hooks are preserved',
      'server adapter cannot own query-loop decisions',
    ]
  }
  if (slice.group === 'product-compat-adapter') {
    return [
      'compat adapter projects through product/tool lifecycle owner',
      'compat path cannot own independent runtime',
      'adapter has explicit owner before closure',
    ]
  }
  return [
    'external integration path must map to adapter owner',
    'generic external bucket cannot close',
    'unmapped adapter cannot remain standalone runtime',
  ]
}

function buildSharedUtilityDecision(slice: ToolRuntimeSharedUtilitySlice): ToolRuntimeSharedUtilityDecision {
  return {
    sourceSliceId: slice.id,
    group: slice.group,
    count: slice.count,
    owner: slice.owner,
    targetMainline: slice.targetMainline,
    canKeepAsGenericSupportBucket: false,
    requiredProofBeforeClose: proofForSharedUtilitySlice(slice),
    redlines: slice.redlines,
  }
}

function buildCommandSurfaceDecision(slice: ToolRuntimeCommandSurfaceSlice): ToolRuntimeCommandSurfaceDecision {
  return {
    sourceSliceId: slice.id,
    group: slice.group,
    count: slice.count,
    owner: slice.owner,
    targetMainline: slice.targetMainline,
    canKeepAsGenericCommandBucket: false,
    requiredProofBeforeClose: proofForCommandSurfaceSlice(slice),
    redlines: slice.redlines,
  }
}

function buildToolCoreDecision(slice: ToolRuntimeToolCoreSlice): ToolRuntimeToolCoreDecision {
  return {
    sourceSliceId: slice.id,
    group: slice.group,
    count: slice.count,
    owner: slice.owner,
    targetMainline: slice.targetMainline,
    canKeepAsSeparateToolRuntime: false,
    ...(slice.importUseScan ? { importUseScan: slice.importUseScan } : {}),
    requiredProofBeforeClose: proofForToolCoreSlice(slice),
    redlines: slice.redlines,
  }
}

function buildAgentToolDecision(slice: ToolRuntimeAgentToolSlice): ToolRuntimeAgentToolDecision {
  return {
    sourceSliceId: slice.id,
    group: slice.group,
    count: slice.count,
    owner: slice.owner,
    targetMainline: slice.targetMainline,
    canKeepAsSecondAgentRuntime: false,
    ...(slice.importUseScan ? { importUseScan: slice.importUseScan } : {}),
    requiredProofBeforeClose: proofForAgentToolSlice(slice),
    redlines: slice.redlines,
  }
}

function buildExternalIntegrationDecision(slice: ToolRuntimeExternalIntegrationSlice): ToolRuntimeExternalIntegrationDecision {
  return {
    sourceSliceId: slice.id,
    group: slice.group,
    count: slice.count,
    owner: slice.owner,
    targetMainline: slice.targetMainline,
    canKeepAsStandaloneRuntime: false,
    ...(slice.importUseScan ? { importUseScan: slice.importUseScan } : {}),
    requiredProofBeforeClose: proofForExternalIntegrationSlice(slice),
    redlines: slice.redlines,
  }
}

function buildSupportDecision(slice: ToolRuntimeSupportServiceSlice): ToolRuntimeSupportServiceDecision {
  const sharedUtilityDecisions = slice.sharedUtilitySlices?.map(buildSharedUtilityDecision)
  const forbiddenRuntimeClosureCount = slice.mainlineImportUseProof?.importUseScan?.forbiddenClosureCount ?? 0
  const redlines = [
    ...(slice.duplicateSystemRisk === 'high' ? ['high support-service duplicate risk remains'] : []),
    ...(forbiddenRuntimeClosureCount > 0 ? [`${forbiddenRuntimeClosureCount} forbidden runtime closure items remain`] : []),
    ...slice.redlines,
  ]
  return {
    sourceSliceId: slice.id,
    group: slice.group,
    count: slice.count,
    owner: slice.owner,
    targetMainline: slice.targetMainline,
    duplicateSystemRisk: slice.duplicateSystemRisk,
    disposition: slice.disposition,
    canKeepAsGenericSupportBucket: false,
    forbiddenRuntimeClosureCount,
    requiredProofBeforeClose: proofForSupportSlice(slice),
    redlines,
    ...(slice.mainlineImportUseProof ? { mainlineImportUseProof: slice.mainlineImportUseProof } : {}),
    ...(slice.sharedUtilityImportUseScan ? { sharedUtilityImportUseScan: slice.sharedUtilityImportUseScan } : {}),
    ...(sharedUtilityDecisions ? { sharedUtilityDecisions } : {}),
  }
}

function buildDecisionBatch(batch: ToolRuntimeDirtyReviewBatch): ToolRuntimeDuplicationDecisionBatch {
  const disposition = dispositionForBatch(batch)
  const supportServiceDecisions = batch.supportSlices?.map(buildSupportDecision)
  const commandSurfaceDecisions = batch.commandSurfaceSlices?.map(buildCommandSurfaceDecision)
  const toolCoreDecisions = batch.toolCoreSlices?.map(buildToolCoreDecision)
  const agentToolDecisions = batch.agentToolSlices?.map(buildAgentToolDecision)
  const externalIntegrationDecisions = batch.externalIntegrationSlices?.map(buildExternalIntegrationDecision)
  const redlines = [
    ...(batch.duplicateSystemRisk === 'high' ? ['high duplicate runtime risk remains'] : []),
    ...(batch.status === 'BLOCKED' ? ['source review batch is blocked'] : []),
    ...(commandSurfaceDecisions?.flatMap(decision => decision.redlines) ?? []),
    ...(toolCoreDecisions?.flatMap(decision => decision.redlines) ?? []),
    ...(agentToolDecisions?.flatMap(decision => decision.redlines) ?? []),
    ...(externalIntegrationDecisions?.flatMap(decision => decision.redlines) ?? []),
  ]
  return {
    sourceBatchId: batch.id,
    group: batch.group,
    count: batch.count,
    duplicateSystemRisk: batch.duplicateSystemRisk,
    targetMainline: batch.targetMainline,
    disposition,
    canDeleteNow: false,
    canKeepAsSeparateRuntime: false,
    requiredProofBeforeClose: proofForBatch(batch),
    redlines,
    ...(supportServiceDecisions ? { supportServiceDecisions } : {}),
    ...(commandSurfaceDecisions ? { commandSurfaceDecisions } : {}),
    ...(toolCoreDecisions ? { toolCoreDecisions } : {}),
    ...(agentToolDecisions ? { agentToolDecisions } : {}),
    ...(externalIntegrationDecisions ? { externalIntegrationDecisions } : {}),
  }
}

export function buildToolRuntimeDuplicationDecision(
  review: ToolRuntimeDirtyReview,
): ToolRuntimeDuplicationDecision {
  const batches = review.batches.map(buildDecisionBatch)
  const mergeRequiredCount = batches
    .filter(batch => batch.disposition === 'merge-to-single-mainline')
    .reduce((sum, batch) => sum + batch.count, 0)
  const replaceOrDeleteCandidateCount = batches
    .filter(batch => batch.disposition === 'replace-or-delete-candidate')
    .reduce((sum, batch) => sum + batch.count, 0)
  const keepAdapterCount = batches
    .filter(batch => batch.disposition === 'keep-adapter-with-mainline-hooks')
    .reduce((sum, batch) => sum + batch.count, 0)
  const quarantineIfUnmappedCount = batches
    .filter(batch => batch.disposition === 'quarantine-if-unmapped')
    .reduce((sum, batch) => sum + batch.count, 0)
  const highDuplicateRiskCount = batches
    .filter(batch => batch.duplicateSystemRisk === 'high')
    .reduce((sum, batch) => sum + batch.count, 0)
  const supportServiceDecisions = batches.flatMap(batch => batch.supportServiceDecisions ?? [])
  const commandSurfaceDecisions = batches.flatMap(batch => batch.commandSurfaceDecisions ?? [])
  const toolCoreDecisions = batches.flatMap(batch => batch.toolCoreDecisions ?? [])
  const agentToolDecisions = batches.flatMap(batch => batch.agentToolDecisions ?? [])
  const externalIntegrationDecisions = batches.flatMap(batch => batch.externalIntegrationDecisions ?? [])
  const sharedUtilityDecisions = supportServiceDecisions.flatMap(decision => decision.sharedUtilityDecisions ?? [])
  const forbiddenRuntimeClosureCount = supportServiceDecisions
    .reduce((sum, decision) => sum + decision.forbiddenRuntimeClosureCount, 0)
  const redlines = [
    ...(review.total > 0 ? ['tool runtime duplication decisions remain open'] : []),
    ...batches.flatMap(batch => batch.redlines.map(redline => `${batch.sourceBatchId}: ${redline}`)),
    ...supportServiceDecisions.flatMap(decision => decision.redlines.map(redline => `${decision.sourceSliceId}: ${redline}`)),
    ...sharedUtilityDecisions.flatMap(decision => decision.redlines.map(redline => `${decision.sourceSliceId}: ${redline}`)),
  ]
  const status: ToolRuntimeDuplicationDecisionStatus = forbiddenRuntimeClosureCount > 0 || batches.some(batch => batch.redlines.includes('source review batch is blocked'))
    ? 'BLOCKED'
    : review.total > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.tool-runtime-duplication-decision.v1',
    status,
    total: review.total,
    batchCount: batches.length,
    mergeRequiredCount,
    replaceOrDeleteCandidateCount,
    keepAdapterCount,
    quarantineIfUnmappedCount,
    highDuplicateRiskCount,
    supportServiceDecisionCount: supportServiceDecisions.length,
    highRiskImportUseProofCount: supportServiceDecisions.filter(decision => decision.duplicateSystemRisk === 'high' && decision.mainlineImportUseProof !== undefined).length,
    forbiddenRuntimeClosureCount,
    supportServiceSharedHelperCount: supportServiceDecisions
      .filter(decision => decision.group === 'shared-runtime-utilities')
      .reduce((sum, decision) => sum + decision.count, 0),
    sharedUtilityDecisionCount: sharedUtilityDecisions.length,
    unassignedSharedHelperCount: sharedUtilityDecisions
      .filter(decision => decision.redlines.length > 0)
      .reduce((sum, decision) => sum + decision.count, 0),
    commandSurfaceDecisionCount: commandSurfaceDecisions.length,
    unassignedCommandSurfaceCount: commandSurfaceDecisions
      .filter(decision => decision.group === 'compat-command-review')
      .reduce((sum, decision) => decision.redlines.length > 0 ? sum + decision.count : sum, 0),
    toolCoreDecisionCount: toolCoreDecisions.length,
    unassignedToolCoreCount: toolCoreDecisions
      .filter(decision => decision.group === 'unmapped-tool-core')
      .reduce((sum, decision) => decision.redlines.length > 0 ? sum + decision.count : sum, 0),
    agentToolDecisionCount: agentToolDecisions.length,
    unassignedAgentToolCount: agentToolDecisions
      .filter(decision => decision.group === 'unmapped-agent-tool')
      .reduce((sum, decision) => decision.redlines.length > 0 ? sum + decision.count : sum, 0),
    externalIntegrationDecisionCount: externalIntegrationDecisions.length,
    unassignedExternalIntegrationCount: externalIntegrationDecisions
      .filter(decision => decision.group === 'unmapped-external-integration')
      .reduce((sum, decision) => decision.redlines.length > 0 ? sum + decision.count : sum, 0),
    canCloseDuplicationGate: review.total === 0 && status === 'PASS',
    mustNotDeleteOrStage: review.total > 0 || status !== 'PASS',
    batches,
    redlines,
    safeguards: [
      'decision table does not delete, stage, restore, move, reset, or commit files',
      'delete-candidate means eligible for normal owner review only after replacement proof exists',
      'no retained path may keep a second executor, command owner, tool runtime, or orchestration loop',
      'equivalent duplicate behavior is not retainable; merge it into the original owner or keep it as a replace/delete candidate',
      'compatibility is not a holding pattern for product runtime paths; only test evidence or adapter projection can keep that label',
      'all retained or migrated paths must route through DSXU single tool lifecycle and evidence owner',
    ],
    nextAction: batches.some(batch => batch.group === 'support-services')
      ? 'collapse-support-services'
      : batches.some(batch => batch.group === 'commands')
        ? 'map-command-facades'
        : batches.length > 0
          ? 'merge-tool-core'
          : 'duplication-gate-closed',
  }
}
