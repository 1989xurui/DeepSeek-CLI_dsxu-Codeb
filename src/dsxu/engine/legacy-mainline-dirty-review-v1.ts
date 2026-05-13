import type {
  V18DirtyLedgerEntry,
  V18DirtyQuarantineLedger,
} from './v18-dirty-quarantine-ledger'

const LEGACY_PRODUCT = ['cl', 'aude'].join('')
const LEGACY_PRODUCT_PATTERN = new RegExp(LEGACY_PRODUCT, 'i')
const LEGACY_PRODUCT_REPLACE_PATTERN = new RegExp(LEGACY_PRODUCT, 'gi')

export type LegacyMainlineDirtyReviewStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'
export type LegacyMainlineDirtyReviewBatchId =
  | 'LMR-01'
  | 'LMR-02'
  | 'LMR-03'
  | 'LMR-04'
  | 'LMR-05'
  | 'LMR-06'
  | 'LMR-99'

export type LegacyUiProductSurfaceSliceId =
  | 'LMR-02A'
  | 'LMR-02B'
  | 'LMR-02C'
  | 'LMR-02D'
  | 'LMR-02E'
  | 'LMR-02F'
  | 'LMR-02G'
  | 'LMR-02H'
  | 'LMR-02I'
  | 'LMR-02J'
  | 'LMR-02K'

type LegacyUiProductSemanticDecision = 'keep-mainline' | 'review-before-keep' | 'replace-delete-candidate'

export type LegacyMainlineOwnerSlice = {
  id: string
  parentId: LegacyMainlineDirtyReviewBatchId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetOwner: string
  semanticDecision: LegacyUiProductSemanticDecision
  goalFit: string
  conflictRisk: string
  requiredAction: string
  canOwnRuntime: boolean
  subSlices?: readonly LegacyMainlineOwnerSubSlice[]
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type LegacyMainlineOwnerSubSlice = {
  id: string
  parentId: string
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetOwner: string
  semanticDecision: LegacyUiProductSemanticDecision
  goalFit: string
  conflictRisk: string
  requiredAction: string
  canOwnRuntime: boolean
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type LegacyUiProductSubSlice = {
  id: string
  parentId: LegacyUiProductSurfaceSliceId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetOwner: string
  semanticDecision: LegacyUiProductSemanticDecision
  goalFit: string
  conflictRisk: string
  obsoletePathCount: number
  requiredAction: string
  canOwnRuntime: false
  samplePaths: readonly string[]
  obsoleteSamplePaths: readonly string[]
  redlines: readonly string[]
}

export type LegacyUiProductSurfaceSlice = {
  id: LegacyUiProductSurfaceSliceId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  targetOwner: string
  semanticDecision: LegacyUiProductSemanticDecision
  goalFit: string
  conflictRisk: string
  obsoletePathCount: number
  requiredAction: string
  canOwnRuntime: false
  subSlices?: readonly LegacyUiProductSubSlice[]
  samplePaths: readonly string[]
  obsoleteSamplePaths: readonly string[]
  redlines: readonly string[]
}

export type LegacyMainlineDirtyReviewBatch = {
  id: LegacyMainlineDirtyReviewBatchId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  status: LegacyMainlineDirtyReviewStatus
  risk: 'high' | 'medium' | 'low'
  disposition: 'migrate-or-replace' | 'keep-and-review' | 'map-to-dsxu-owner'
  requiredAction: string
  targetOwner: string
  canAutoClose: boolean
  ownerSlices?: readonly LegacyMainlineOwnerSlice[]
  uiProductSlices?: readonly LegacyUiProductSurfaceSlice[]
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type LegacyMainlineDirtyReview = {
  schemaVersion: 'dsxu.legacy-mainline-dirty-review.v1'
  status: LegacyMainlineDirtyReviewStatus
  total: number
  batchCount: number
  pass: number
  partial: number
  blocked: number
  highRiskBatchCount: number
  toolRuntimeReviewStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
  toolRuntimeReviewBatchCount: number
  uiProductSliceCount: number
  uiProductSubSliceCount: number
  uiProductUnassignedCount: number
  uiProductReplaceDeleteCandidateCount: number
  uiProductReviewBeforeKeepCount: number
  legacyOwnerSliceCount: number
  legacyOwnerSubSliceCount: number
  legacyOwnerReplaceDeleteCandidateCount: number
  legacyOwnerReviewBeforeKeepCount: number
  canCloseLegacyMainlineGate: boolean
  mustNotStageOrRestore: boolean
  batches: readonly LegacyMainlineDirtyReviewBatch[]
  redlines: readonly string[]
  safeguards: readonly string[]
  nextAction: 'review-tool-runtime-migration' | 'review-ui-product-surface' | 'review-legacy-other' | 'legacy-mainline-gate-closed'
}

const groupOrder = [
  'tool-runtime',
  'ui-product',
  'legacy-other',
  'context-memory',
  'core-root',
  'legacy-tests',
] as const

type LegacyMainlineDirtyGroup = typeof groupOrder[number]

const uiProductSliceOrder = [
  'app-entry-bootstrap',
  'cli-transport-surface',
  'component-visible-state',
  'prompt-input-interaction',
  'agent-product-surface',
  'mcp-skill-product-surface',
  'permission-safety-product-surface',
  'screen-repl-product-surface',
  'ink-render-surface',
  'keybinding-output-voice',
  'buddy-assistant-surface',
] as const

type LegacyUiProductSurfaceGroup = typeof uiProductSliceOrder[number]

const componentVisibleSubSliceOrder = [
  'app-shell-layout',
  'message-transcript-rendering',
  'tool-evidence-rendering',
  'settings-config-surface',
  'diagnostics-cost-status',
  'help-onboarding-docs',
  'feedback-survey-surface',
  'branding-upsell-surface',
  'design-system-surface',
  'hook-config-surface',
  'remote-ide-workflow-surface',
  'misc-visible-state',
] as const

type ComponentVisibleSubSliceGroup = typeof componentVisibleSubSliceOrder[number]

const buddyAssistantSubSliceOrder = [
  'assistant-session-history',
  'buddy-companion-surface',
] as const

type BuddyAssistantSubSliceGroup = typeof buddyAssistantSubSliceOrder[number]

const legacyOtherSliceOrder = [
  'query-core-surface',
  'remote-control-surface',
  'task-lifecycle-surface',
  'skill-bundle-surface',
  'constants-prompt-policy',
  'type-schema-surface',
  'migration-policy-surface',
  'cost-telemetry-surface',
  'editor-input-surface',
  'root-entry-shell',
  'coordinator-surface',
  'misc-legacy-surface',
] as const

type LegacyOtherSliceGroup = typeof legacyOtherSliceOrder[number]

const contextMemorySliceOrder = [
  'context-provider-state',
  'memory-retrieval-state',
  'history-session-state',
  'context-misc-state',
] as const

type ContextMemorySliceGroup = typeof contextMemorySliceOrder[number]

const coreRootSliceOrder = [
  'query-engine-core',
  'task-core',
  'tool-contract-core',
] as const

type CoreRootSliceGroup = typeof coreRootSliceOrder[number]

const legacyTestsSliceOrder = [
  'deleted-legacy-test',
  'active-legacy-test',
] as const

type LegacyTestsSliceGroup = typeof legacyTestsSliceOrder[number]

const skillBundleSubSliceOrder = [
  'deleted-legacy-provider-skills',
  'dsxu-api-browser-skills',
  'bundled-workflow-skills',
  'skill-registry-loader',
] as const

type SkillBundleSubSliceGroup = typeof skillBundleSubSliceOrder[number]

const typeSchemaSubSliceOrder = [
  'deleted-legacy-generated-event-schema',
  'current-generated-event-schema',
  'provider-sdk-contract-types',
  'command-permission-log-types',
  'hook-schema-contracts',
] as const

type TypeSchemaSubSliceGroup = typeof typeSchemaSubSliceOrder[number]

const migrationPolicySubSliceOrder = [
  'dsxu-legacy-model-facade',
  'current-settings-migrations',
  'legacy-provider-model-boundary',
  'deleted-legacy-model-migration',
] as const

type MigrationPolicySubSliceGroup = typeof migrationPolicySubSliceOrder[number]

function normalizedPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^"|"$/g, '')
}

function isLegacyMainlinePath(path: string): boolean {
  const normalized = normalizedPath(path)
  return /^src\//.test(normalized) && !/^src\/dsxu\//.test(normalized)
}

function groupForPath(path: string): LegacyMainlineDirtyGroup {
  const normalized = normalizedPath(path)
  if (/^src\/__tests__\//.test(normalized)) return 'legacy-tests'
  if (/^src\/(assistant|bootstrap|buddy|cli|components|dialogs|screens|ui|theme|ink|tui|app|entrypoints|keybindings|outputStyles|voice)\//.test(normalized)) {
    return 'ui-product'
  }
  if (/^src\/(tools|Tool|permissions|services|utils|hooks|commands|mcp|ide|terminal|shell|network|browser|plugins|server|native-ts|local-work|moreright)\//.test(normalized)) {
    return 'tool-runtime'
  }
  if (/^src\/(context|memory|compact|history|session|store|state|memdir)\//.test(normalized) || normalized === 'src/history.ts') return 'context-memory'
  if (/^src\/(QueryEngine|Task|Tool)\.ts$/.test(normalized)) return 'core-root'
  return 'legacy-other'
}

function uiProductSliceForPath(path: string): LegacyUiProductSurfaceGroup {
  const normalized = normalizedPath(path)
  if (/^src\/(bootstrap|entrypoints|app)\//.test(normalized)) return 'app-entry-bootstrap'
  if (/^src\/cli\//.test(normalized)) return 'cli-transport-surface'
  if (/^src\/components\/PromptInput\//.test(normalized)) return 'prompt-input-interaction'
  if (/^src\/components\/agents\//.test(normalized) || /^src\/components\/(Agent|Team|Teammate|TaskList)/.test(normalized)) return 'agent-product-surface'
  if (/^src\/components\/(mcp|MCP|Skill)/.test(normalized)) return 'mcp-skill-product-surface'
  if (/^src\/components\/(permissions|TrustDialog|AutoMode|BypassPermissions|Sandbox|MCPServerApproval)/.test(normalized)) return 'permission-safety-product-surface'
  if (/^src\/screens\//.test(normalized)) return 'screen-repl-product-surface'
  if (/^src\/(ink|tui|theme|outputStyles)\//.test(normalized)) return 'ink-render-surface'
  if (/^src\/(keybindings|voice)\//.test(normalized)) return 'keybinding-output-voice'
  if (/^src\/(assistant|buddy)\//.test(normalized)) return 'buddy-assistant-surface'
  return 'component-visible-state'
}

function idForGroup(group: LegacyMainlineDirtyGroup): LegacyMainlineDirtyReviewBatchId {
  if (group === 'tool-runtime') return 'LMR-01'
  if (group === 'ui-product') return 'LMR-02'
  if (group === 'legacy-other') return 'LMR-03'
  if (group === 'context-memory') return 'LMR-04'
  if (group === 'core-root') return 'LMR-05'
  if (group === 'legacy-tests') return 'LMR-06'
  return 'LMR-99'
}

function ownerForGroup(group: LegacyMainlineDirtyGroup): string {
  if (group === 'tool-runtime') return 'Tool Runtime Migration'
  if (group === 'ui-product') return 'Product Surface Migration'
  if (group === 'legacy-other') return 'Legacy Source Review'
  if (group === 'context-memory') return 'Context / Memory Migration'
  if (group === 'core-root') return 'Core Query Loop Migration'
  return 'Legacy Test Review'
}

function targetOwnerForGroup(group: LegacyMainlineDirtyGroup): string {
  if (group === 'tool-runtime') return 'DSXU tool lifecycle / Tool Evidence Pack'
  if (group === 'ui-product') return 'DSXU product surface / query-loop visible state'
  if (group === 'context-memory') return 'DSXU Context Owner Rule'
  if (group === 'core-root') return 'DSXU Query Loop owner'
  if (group === 'legacy-tests') return 'DSXU verification owner'
  return 'DSXU mainline owner map'
}

function riskForGroup(group: LegacyMainlineDirtyGroup): LegacyMainlineDirtyReviewBatch['risk'] {
  if (group === 'tool-runtime' || group === 'core-root') return 'high'
  if (group === 'ui-product' || group === 'context-memory') return 'medium'
  return 'low'
}

function dispositionForGroup(group: LegacyMainlineDirtyGroup): LegacyMainlineDirtyReviewBatch['disposition'] {
  if (group === 'legacy-other' || group === 'legacy-tests') return 'map-to-dsxu-owner'
  if (group === 'ui-product') return 'keep-and-review'
  return 'migrate-or-replace'
}

function requiredActionForGroup(group: LegacyMainlineDirtyGroup): string {
  if (group === 'tool-runtime') return 'map old tool runtime paths to DSXU tool lifecycle before any closure'
  if (group === 'ui-product') return 'confirm product surface paths are still used or replaced by DSXU visible-state flow'
  if (group === 'context-memory') return 'map old context and memory paths to Context Owner Rule'
  if (group === 'core-root') return 'map core root files to the single query-loop owner'
  if (group === 'legacy-tests') return 'map old tests to current verification owner or release-excluded archive'
  return 'assign DSXU owner, replacement evidence, or archive policy'
}

function uiProductSliceIdForGroup(group: LegacyUiProductSurfaceGroup): LegacyUiProductSurfaceSliceId {
  if (group === 'app-entry-bootstrap') return 'LMR-02A'
  if (group === 'cli-transport-surface') return 'LMR-02B'
  if (group === 'component-visible-state') return 'LMR-02C'
  if (group === 'prompt-input-interaction') return 'LMR-02D'
  if (group === 'agent-product-surface') return 'LMR-02E'
  if (group === 'mcp-skill-product-surface') return 'LMR-02F'
  if (group === 'permission-safety-product-surface') return 'LMR-02G'
  if (group === 'screen-repl-product-surface') return 'LMR-02H'
  if (group === 'ink-render-surface') return 'LMR-02I'
  if (group === 'keybinding-output-voice') return 'LMR-02J'
  return 'LMR-02K'
}

function uiProductOwnerForGroup(group: LegacyUiProductSurfaceGroup): string {
  if (group === 'app-entry-bootstrap') return 'App Bootstrap / Session Surface'
  if (group === 'cli-transport-surface') return 'CLI / Transport Surface'
  if (group === 'component-visible-state') return 'Component Visible State'
  if (group === 'prompt-input-interaction') return 'Prompt Input Interaction'
  if (group === 'agent-product-surface') return 'Agent Product Projection'
  if (group === 'mcp-skill-product-surface') return 'MCP / Skill Product Projection'
  if (group === 'permission-safety-product-surface') return 'Permission / Safety Product Projection'
  if (group === 'screen-repl-product-surface') return 'REPL / Screen Product Surface'
  if (group === 'ink-render-surface') return 'Ink / Render Surface'
  if (group === 'keybinding-output-voice') return 'Keybinding / Output / Voice Surface'
  return 'Buddy / Assistant Surface'
}

function uiProductTargetOwnerForGroup(group: LegacyUiProductSurfaceGroup): string {
  if (group === 'app-entry-bootstrap') return 'query-loop session state and product bootstrap projection'
  if (group === 'cli-transport-surface') return 'structured IO, remote IO, and transport projection over existing lifecycle owners'
  if (group === 'component-visible-state') return 'query-loop/tool/evidence visible-state projection'
  if (group === 'prompt-input-interaction') return 'input intent projection into query-loop and command facade owners'
  if (group === 'agent-product-surface') return 'AgentTool lifecycle and agent visible-state projection'
  if (group === 'mcp-skill-product-surface') return 'single MCP/Skill registry visible-state projection'
  if (group === 'permission-safety-product-surface') return 'Tool Gate permission and recovery visible-state projection'
  if (group === 'screen-repl-product-surface') return 'REPL screen projection over query-loop/session state'
  if (group === 'ink-render-surface') return 'render-only Ink layout and terminal presentation owner'
  if (group === 'keybinding-output-voice') return 'input/output adapter projection with no execution ownership'
  return 'assistant/buddy visible projection and notification owner'
}

function uiProductRequiredActionForGroup(group: LegacyUiProductSurfaceGroup): string {
  if (group === 'app-entry-bootstrap') return 'prove bootstrap/startup only initializes or projects owner state and cannot decide tool execution'
  if (group === 'cli-transport-surface') return 'prove transport paths serialize lifecycle/evidence events and do not own query-loop decisions'
  if (group === 'component-visible-state') return 'prove components render existing query-loop/tool/evidence state only'
  if (group === 'prompt-input-interaction') return 'prove prompt input emits intent into existing owners and cannot execute tools directly'
  if (group === 'agent-product-surface') return 'prove agent UI projects AgentTool lifecycle and cannot orchestrate workers'
  if (group === 'mcp-skill-product-surface') return 'prove MCP/skill UI projects registry state and cannot execute dynamic tools directly'
  if (group === 'permission-safety-product-surface') return 'prove permission UI projects Tool Gate wait/deny/recovery state'
  if (group === 'screen-repl-product-surface') return 'prove REPL screens project query-loop/session state without owning completion'
  if (group === 'ink-render-surface') return 'prove Ink/render code is presentation-only'
  if (group === 'keybinding-output-voice') return 'prove keybinding/output/voice paths remain input-output adapters'
  return 'prove assistant/buddy surfaces are notification/projection only'
}

function hasLegacyProductName(path: string): boolean {
  return LEGACY_PRODUCT_PATTERN.test(path)
}

function isObsoleteUiProductPath(path: string): boolean {
  const normalized = normalizedPath(path)
  return hasLegacyProductName(normalized) ||
    /\/(Clawd|Opus1m|DesktopUpsell|GuestPassesUpsell|OverageCreditUpsell)/i.test(normalized)
}

function componentVisibleSubSliceForPath(path: string): ComponentVisibleSubSliceGroup {
  const normalized = normalizedPath(path)
  if (/^src\/components\/(App|FullscreenLayout|OffscreenFreeze|StatusLine|StatusNotices|VirtualMessageList|SessionPreview|SessionBackgroundHint|ScrollKeybindingHandler|TextInput|VimTextInput|BaseTextInput|CustomSelect|TagTabs|SearchBox|QuickOpenDialog|HistorySearchDialog|GlobalSearchDialog|PressEnterToContinue)/.test(normalized)) return 'app-shell-layout'
  if (/^src\/components\/(Message|Messages|Markdown|MarkdownTable|messages\/|messageActions|MessageModel|MessageResponse|MessageRow|MessageSelector|MessageTimestamp|CompactSummary|ContextSuggestions|ContextVisualization|InterruptedByUser|CtrlOToExpand)/.test(normalized)) return 'message-transcript-rendering'
  if (/^src\/components\/(FileEditTool|NotebookEditTool|FallbackToolUse|ToolUseLoader|StructuredDiff|StructuredDiffList|HighlightedCode|FilePathLink|ClickableImageRef|diff\/|shell\/|BashModeProgress)/.test(normalized)) return 'tool-evidence-rendering'
  if (/^src\/components\/(Settings\/|ManagedSettingsSecurityDialog\/|ModelPicker|ThemePicker|OutputStylePicker|ThinkingToggle|LanguagePicker|LogSelector|InvalidConfigDialog|InvalidSettingsDialog|ValidationErrorsList)/.test(normalized)) return 'settings-config-surface'
  if (/^src\/components\/(CostThresholdDialog|DiagnosticsDisplay|Effort|MemoryUsageIndicator|Stats|TokenWarning|DevBar|DevChannelsDialog|KeybindingWarnings|NativeAutoUpdater|AutoUpdater|AutoUpdaterWrapper|PackageManagerAutoUpdater|AwsAuthStatusBox)/.test(normalized)) return 'diagnostics-cost-status'
  if (/^src\/components\/(HelpV2\/|Onboarding|DsxuBrowserProviderOnboarding|ClaudeInChromeOnboarding|LspRecommendation\/|ShowInIDEPrompt|IdeOnboardingDialog|IdeAutoConnectDialog|IdeStatusIndicator|RemoteCallout|RemoteEnvironmentDialog)/.test(normalized)) return 'help-onboarding-docs'
  if (/^src\/components\/(Feedback|FeedbackSurvey\/|SkillImprovementSurvey)/.test(normalized)) return 'feedback-survey-surface'
  if (/^src\/components\/(LogoV2\/|DesktopUpsell\/|Passes\/|ClaudeCodeHint\/|ClaudeMdExternalIncludesDialog|DsxuCodeHint\/|DsxuInstructionExternalIncludesDialog|ChannelDowngradeDialog|ExportDialog|ExitFlow|Teleport|WorkflowMultiselectDialog|WorktreeExitDialog)/.test(normalized)) return 'branding-upsell-surface'
  if (/^src\/components\/(design-system\/|ui\/|wizard\/|FastIcon|Spinner)/.test(normalized)) return 'design-system-surface'
  if (/^src\/components\/hooks\//.test(normalized)) return 'hook-config-surface'
  if (/^src\/components\/(DesktopHandoff|ResumeTask|tasks\/|teams\/|CoordinatorAgentStatus|PrBadge|Teleport|Remote|ConsoleOAuthFlow)/.test(normalized)) return 'remote-ide-workflow-surface'
  return 'misc-visible-state'
}

function buddyAssistantSubSliceForPath(path: string): BuddyAssistantSubSliceGroup {
  const normalized = normalizedPath(path)
  if (/^src\/assistant\/sessionHistory\.ts$/.test(normalized)) return 'assistant-session-history'
  return 'buddy-companion-surface'
}

function isReplaceDeleteCandidatePath(path: string): boolean {
  const normalized = normalizedPath(path)
  return isObsoleteUiProductPath(path) || /^src\/buddy\//.test(normalized)
}

function legacyOtherSliceForPath(path: string): LegacyOtherSliceGroup {
  const normalized = normalizedPath(path)
  if (/^src\/query(\/|\.ts$)/.test(normalized) || /^src\/context\.ts$/.test(normalized)) return 'query-core-surface'
  if (/^src\/(bridge|remote|upstreamproxy)\//.test(normalized) || /^src\/replLauncher\.tsx$/.test(normalized)) return 'remote-control-surface'
  if (/^src\/tasks(\/|\.ts$)/.test(normalized)) return 'task-lifecycle-surface'
  if (/^src\/skills\//.test(normalized)) return 'skill-bundle-surface'
  if (/^src\/constants\//.test(normalized)) return 'constants-prompt-policy'
  if (/^src\/(schemas|types)\//.test(normalized)) return 'type-schema-surface'
  if (/^src\/migrations\//.test(normalized)) return 'migration-policy-surface'
  if (/^src\/(costHook|cost-tracker)\.ts$/.test(normalized)) return 'cost-telemetry-surface'
  if (/^src\/vim\//.test(normalized) || /^src\/interactiveHelpers\.tsx$/.test(normalized)) return 'editor-input-surface'
  if (/^src\/(main|setup|ink|html|commands|tools|dialogLaunchers|localRecoveryCli|projectOnboardingState)\./.test(normalized)) return 'root-entry-shell'
  if (/^src\/coordinator\//.test(normalized)) return 'coordinator-surface'
  return 'misc-legacy-surface'
}

function contextMemorySliceForPath(path: string): ContextMemorySliceGroup {
  const normalized = normalizedPath(path)
  if (/^src\/context\//.test(normalized)) return 'context-provider-state'
  if (/^src\/memdir\//.test(normalized)) return 'memory-retrieval-state'
  if (/^src\/(history|session|memory|compact)\//.test(normalized) || /^src\/history\.ts$/.test(normalized)) return 'history-session-state'
  return 'context-misc-state'
}

function coreRootSliceForPath(path: string): CoreRootSliceGroup {
  const normalized = normalizedPath(path)
  if (normalized === 'src/QueryEngine.ts') return 'query-engine-core'
  if (normalized === 'src/Task.ts') return 'task-core'
  return 'tool-contract-core'
}

function legacyTestsSliceForPath(path: string): LegacyTestsSliceGroup {
  return normalizedPath(path).includes('/proxy/') ? 'deleted-legacy-test' : 'active-legacy-test'
}

function legacyOwnerGroupForPath(
  parentGroup: LegacyMainlineDirtyGroup,
  path: string,
): LegacyOtherSliceGroup | ContextMemorySliceGroup | CoreRootSliceGroup | LegacyTestsSliceGroup {
  if (parentGroup === 'legacy-other') return legacyOtherSliceForPath(path)
  if (parentGroup === 'context-memory') return contextMemorySliceForPath(path)
  if (parentGroup === 'core-root') return coreRootSliceForPath(path)
  return legacyTestsSliceForPath(path)
}

function legacyOwnerSliceOrderForGroup(
  parentGroup: LegacyMainlineDirtyGroup,
): readonly (LegacyOtherSliceGroup | ContextMemorySliceGroup | CoreRootSliceGroup | LegacyTestsSliceGroup)[] {
  if (parentGroup === 'legacy-other') return legacyOtherSliceOrder
  if (parentGroup === 'context-memory') return contextMemorySliceOrder
  if (parentGroup === 'core-root') return coreRootSliceOrder
  if (parentGroup === 'legacy-tests') return legacyTestsSliceOrder
  return []
}

function legacyOwnerSliceId(
  parentId: LegacyMainlineDirtyReviewBatchId,
  index: number,
): string {
  return `${parentId}.${index.toString().padStart(2, '0')}`
}

function legacyOwnerForSlice(group: string): string {
  if (group === 'query-core-surface' || group === 'query-engine-core') return 'Query Loop Owner'
  if (group === 'remote-control-surface') return 'Remote / Control Plane Owner'
  if (group === 'task-lifecycle-surface' || group === 'task-core') return 'Task Lifecycle Owner'
  if (group === 'skill-bundle-surface') return 'MCP / Skill Registry Owner'
  if (group === 'constants-prompt-policy') return 'Prompt / Policy Constants Owner'
  if (group === 'type-schema-surface') return 'Schema / Type Contract Owner'
  if (group === 'migration-policy-surface') return 'Migration Policy Owner'
  if (group === 'cost-telemetry-surface') return 'Cost / Telemetry Evidence Owner'
  if (group === 'editor-input-surface') return 'Editor Input Owner'
  if (group === 'root-entry-shell') return 'App Root Entry Owner'
  if (group === 'coordinator-surface') return 'Coordinator Projection Owner'
  if (group === 'context-provider-state') return 'Context Provider Owner'
  if (group === 'memory-retrieval-state') return 'Memory Retrieval Owner'
  if (group === 'history-session-state') return 'History / Session Owner'
  if (group === 'tool-contract-core') return 'Tool Contract Owner'
  if (group === 'deleted-legacy-test' || group === 'active-legacy-test') return 'Verification Owner'
  return 'Legacy Owner Map'
}

function legacyTargetOwnerForSlice(group: string): string {
  if (group === 'query-core-surface' || group === 'query-engine-core') return 'single query-loop owner'
  if (group === 'remote-control-surface') return 'control-plane adapter boundary over query-loop and permission owners'
  if (group === 'task-lifecycle-surface' || group === 'task-core') return 'task lifecycle projection over AgentTool/query-loop owners'
  if (group === 'skill-bundle-surface') return 'single MCP/Skill registry owner'
  if (group === 'constants-prompt-policy') return 'prompt, policy, and model constants owner'
  if (group === 'type-schema-surface') return 'shared schema/type contract owner'
  if (group === 'migration-policy-surface') return 'release migration owner or replace/delete if obsolete'
  if (group === 'cost-telemetry-surface') return 'model router, cost evidence, and telemetry owner'
  if (group === 'editor-input-surface') return 'input adapter projection without execution ownership'
  if (group === 'root-entry-shell') return 'app bootstrap/query-loop entry owner'
  if (group === 'coordinator-surface') return 'agent/coordinator visible projection owner'
  if (group === 'context-provider-state') return 'Context Owner Rule provider projection'
  if (group === 'memory-retrieval-state') return 'Context Owner Rule memory retrieval'
  if (group === 'history-session-state') return 'Context Owner Rule session and history state'
  if (group === 'tool-contract-core') return 'single Tool lifecycle contract owner'
  if (group === 'deleted-legacy-test') return 'release-excluded verification archive or replacement test'
  if (group === 'active-legacy-test') return 'current DSXU verification owner'
  return 'DSXU mainline owner map'
}

function legacySemanticDecisionForSlice(
  group: string,
  entries: readonly V18DirtyLedgerEntry[],
): LegacyUiProductSemanticDecision {
  if (group === 'deleted-legacy-test') return 'replace-delete-candidate'
  if (group === 'remote-control-surface' && entries.every(entry => entry.status.includes('D'))) return 'replace-delete-candidate'
  if (group === 'migration-policy-surface' && entries.some(entry => hasLegacyProductName(entry.path) || /Opus1m|Sonnet1m|Fennec/i.test(entry.path))) return 'review-before-keep'
  if (group === 'constants-prompt-policy' && entries.some(entry => hasLegacyProductName(entry.path))) return 'review-before-keep'
  if (group === 'misc-legacy-surface' || group === 'active-legacy-test') return 'review-before-keep'
  if (entries.some(entry => entry.status.includes('D'))) return 'review-before-keep'
  return 'keep-mainline'
}

function legacyGoalFitForSlice(group: string, decision: LegacyUiProductSemanticDecision): string {
  if (decision === 'replace-delete-candidate') return 'does not belong to active DSXU source unless replaced by current verification or owner evidence'
  if (decision === 'review-before-keep') return 'requires owner proof before keep because obsolete naming, deletion, or unclear DSXU target value remains'
  if (group === 'query-core-surface' || group === 'query-engine-core') return 'belongs to the single query-loop owner'
  if (group === 'remote-control-surface') return 'adapter boundary only; may not own query, tool, permission, or provider runtime decisions'
  if (group === 'task-lifecycle-surface' || group === 'task-core') return 'projects task lifecycle over established agent/query owners'
  if (group === 'skill-bundle-surface') return 'belongs to MCP/Skill registry packaging and projection'
  if (group === 'context-provider-state' || group === 'memory-retrieval-state' || group === 'history-session-state') return 'belongs to Context Owner Rule'
  return 'maps to an explicit DSXU mainline owner'
}

function legacyConflictRiskForDecision(decision: LegacyUiProductSemanticDecision): string {
  if (decision === 'replace-delete-candidate') return 'stale or deleted source can conflict with current verification and release scope'
  if (decision === 'review-before-keep') return 'must prove current owner value and avoid stale product/provider behavior'
  return 'low once owner proof confirms it is not a standalone runtime'
}

function legacyRequiredActionForSlice(group: string): string {
  if (group === 'remote-control-surface') return 'prove remote/control paths are adapter boundary only and cannot own permission or query execution'
  if (group === 'task-lifecycle-surface') return 'prove task paths project existing AgentTool/query-loop lifecycle rather than adding another orchestrator'
  if (group === 'skill-bundle-surface') return 'prove bundled skills feed the single MCP/Skill registry'
  if (group === 'migration-policy-surface') return 'separate current DSXU migrations from obsolete provider/model migrations'
  if (group === 'constants-prompt-policy') return 'map constants to prompt/policy/model owners and mark obsolete product constants'
  if (group === 'deleted-legacy-test') return 'replace with current DSXU test evidence or keep only as release-excluded archive evidence'
  if (group === 'query-engine-core') return 'prove this is the only query-loop owner'
  if (group === 'tool-contract-core') return 'prove this feeds the single Tool lifecycle contract'
  return 'map to the named DSXU owner and prove no standalone runtime ownership'
}

function legacyCanOwnRuntime(group: string): boolean {
  return group === 'query-core-surface' ||
    group === 'query-engine-core' ||
    group === 'task-core' ||
    group === 'tool-contract-core'
}

function skillBundleSubSliceForPath(path: string): SkillBundleSubSliceGroup {
  const normalized = normalizedPath(path)
  if (/^src\/skills\/bundled\/(claudeApi|claudeApiContent|claudeInChrome)\.ts$/.test(normalized)) return 'deleted-legacy-provider-skills'
  if (/^src\/skills\/bundled\/(dsxuApi|dsxuApiContent|DsxuBrowserProvider)\.ts$/.test(normalized)) return 'dsxu-api-browser-skills'
  if (/^src\/skills\/(bundledSkills|loadSkillsDir|mcpSkillBuilders)\.ts$/.test(normalized) || /^src\/skills\/bundled\/index\.ts$/.test(normalized)) return 'skill-registry-loader'
  return 'bundled-workflow-skills'
}

function typeSchemaSubSliceForPath(path: string): TypeSchemaSubSliceGroup {
  const normalized = normalizedPath(path)
  if (/^src\/types\/generated\/events_mono\/claude_code\//.test(normalized)) return 'deleted-legacy-generated-event-schema'
  if (/^src\/types\/generated\//.test(normalized)) return 'current-generated-event-schema'
  if (/^src\/types\/(provider|browserProvider|mcpbProvider|sandboxRuntime)/.test(normalized)) return 'provider-sdk-contract-types'
  if (/^src\/types\/(command|permissions|logs|ids|analyticsTelemetry|textInputTypes|plugin)/.test(normalized)) return 'command-permission-log-types'
  return 'hook-schema-contracts'
}

function migrationPolicySubSliceForPath(path: string): MigrationPolicySubSliceGroup {
  const normalized = normalizedPath(path)
  if (/^src\/migrations\/dsxuLegacyModelMigrations\.ts$/.test(normalized)) return 'dsxu-legacy-model-facade'
  if (/^src\/migrations\/migrateOpusToOpus1m\.ts$/.test(normalized)) return 'deleted-legacy-model-migration'
  if (/^src\/migrations\/(migrateFennecToOpus|migrateLegacyOpusToCurrent|migrateSonnet1mToSonnet45|migrateSonnet45ToSonnet46|resetProToOpusDefault)\.ts$/.test(normalized)) return 'legacy-provider-model-boundary'
  return 'current-settings-migrations'
}

function legacyOwnerSubSliceOrderForGroup(
  group: string,
): readonly (SkillBundleSubSliceGroup | TypeSchemaSubSliceGroup | MigrationPolicySubSliceGroup)[] {
  if (group === 'skill-bundle-surface') return skillBundleSubSliceOrder
  if (group === 'type-schema-surface') return typeSchemaSubSliceOrder
  if (group === 'migration-policy-surface') return migrationPolicySubSliceOrder
  return []
}

function legacyOwnerSubSliceGroupForPath(
  parentGroup: string,
  path: string,
): SkillBundleSubSliceGroup | TypeSchemaSubSliceGroup | MigrationPolicySubSliceGroup {
  if (parentGroup === 'skill-bundle-surface') return skillBundleSubSliceForPath(path)
  if (parentGroup === 'type-schema-surface') return typeSchemaSubSliceForPath(path)
  return migrationPolicySubSliceForPath(path)
}

function legacyOwnerSubSliceId(parentId: string, index: number): string {
  return `${parentId}.${index.toString().padStart(2, '0')}`
}

function legacyOwnerForSubSlice(group: string): string {
  if (group === 'deleted-legacy-provider-skills' || group === 'dsxu-api-browser-skills' || group === 'bundled-workflow-skills' || group === 'skill-registry-loader') return 'MCP / Skill Registry Owner'
  if (group === 'deleted-legacy-generated-event-schema' || group === 'current-generated-event-schema' || group === 'provider-sdk-contract-types' || group === 'command-permission-log-types' || group === 'hook-schema-contracts') return 'Schema / Type Contract Owner'
  return 'Migration Policy Owner'
}

function legacyTargetOwnerForSubSlice(group: string): string {
  if (group === 'deleted-legacy-provider-skills') return 'replace/delete old provider skill files; current registry must use DSXU skill names'
  if (group === 'dsxu-api-browser-skills') return 'single MCP/Skill registry with DSXU API and browser provider skills'
  if (group === 'bundled-workflow-skills') return 'single bundled skill registry for workflow prompt commands'
  if (group === 'skill-registry-loader') return 'single skill registry loader and extraction owner'
  if (group === 'deleted-legacy-generated-event-schema') return 'replace/delete old generated event schema'
  if (group === 'current-generated-event-schema') return 'current generated event schema contract owner'
  if (group === 'provider-sdk-contract-types') return 'provider SDK and sandbox/browser contract type owner'
  if (group === 'command-permission-log-types') return 'command, permission, log, id, and telemetry type owner'
  if (group === 'hook-schema-contracts') return 'hook schema contract owner'
  if (group === 'dsxu-legacy-model-facade') return 'DSXU facade for legacy model migration calls'
  if (group === 'current-settings-migrations') return 'current config/settings migration owner'
  if (group === 'legacy-provider-model-boundary') return 'legacy provider migration boundary that must early-return in DSXU runtime'
  return 'replace/delete deleted old model migration'
}

function legacySemanticDecisionForSubSlice(
  group: string,
  entries: readonly V18DirtyLedgerEntry[],
): LegacyUiProductSemanticDecision {
  if (group === 'deleted-legacy-provider-skills' || group === 'deleted-legacy-generated-event-schema' || group === 'deleted-legacy-model-migration') return 'replace-delete-candidate'
  if (entries.some(entry => entry.status.includes('D'))) return 'review-before-keep'
  return 'keep-mainline'
}

function legacyGoalFitForSubSlice(group: string, decision: LegacyUiProductSemanticDecision): string {
  if (decision === 'replace-delete-candidate') return 'deleted or old provider-specific artifact should not remain in active DSXU source without replacement evidence'
  if (decision === 'review-before-keep') return 'must prove DSXU runtime is protected by facade or early return before keep'
  if (group === 'dsxu-api-browser-skills') return 'current DSXU skill entrypoints register through the single bundled skill registry'
  if (group === 'skill-registry-loader') return 'registry and loader own skill discovery/extraction without adding another skill runtime'
  if (group === 'dsxu-legacy-model-facade') return 'neutral facade centralizes legacy model migration calls away from public startup paths'
  return 'belongs to the named DSXU owner without standalone runtime authority'
}

function legacyRequiredActionForSubSlice(group: string): string {
  if (group === 'deleted-legacy-provider-skills') return 'confirm deletion is replaced by dsxuApi and DsxuBrowserProvider registration'
  if (group === 'deleted-legacy-generated-event-schema') return 'confirm generated event consumers use current schema path or exclude old schema from release'
  if (group === 'deleted-legacy-model-migration') return 'confirm old migration is replaced by current facade or release-excluded archive evidence'
  if (group === 'legacy-provider-model-boundary') return 'prove each legacy provider migration is DSXU-gated and cannot rewrite DSXU model policy'
  if (group === 'skill-registry-loader') return 'prove loader feeds the single skill registry and cannot create a second skill runtime'
  return 'map to the named owner and prove no duplicate runtime path remains'
}

function uiProductSemanticDecisionForGroup(
  group: LegacyUiProductSurfaceGroup,
  entries: readonly V18DirtyLedgerEntry[],
): LegacyUiProductSurfaceSlice['semanticDecision'] {
  const replaceDeleteCandidateCount = entries.filter(entry => isReplaceDeleteCandidatePath(entry.path)).length
  if (replaceDeleteCandidateCount > 0 && replaceDeleteCandidateCount === entries.length) return 'replace-delete-candidate'
  if (replaceDeleteCandidateCount > 0) return 'keep-mainline'
  return 'keep-mainline'
}

function uiProductSemanticDecisionForSubSlice(
  group: ComponentVisibleSubSliceGroup | BuddyAssistantSubSliceGroup,
  entries: readonly V18DirtyLedgerEntry[],
): LegacyUiProductSemanticDecision {
  const replaceDeleteCandidateCount = entries.filter(entry => isReplaceDeleteCandidatePath(entry.path)).length
  if (replaceDeleteCandidateCount > 0 && replaceDeleteCandidateCount === entries.length) return 'replace-delete-candidate'
  if (replaceDeleteCandidateCount > 0) return 'keep-mainline'
  if (group === 'buddy-companion-surface') return 'replace-delete-candidate'
  return 'keep-mainline'
}

function uiProductGoalFitForDecision(
  group: LegacyUiProductSurfaceGroup,
  decision: LegacyUiProductSemanticDecision,
): string {
  if (decision === 'replace-delete-candidate') {
    return 'path names or deleted remnants indicate old product surface; keep only if a DSXU owner proves current user value'
  }
  if (decision === 'review-before-keep') {
    return 'may serve DSXU visible experience, but requires owner proof that it supports query-loop/tool/agent evidence rather than old product behavior'
  }
  if (group === 'ink-render-surface') return 'supports terminal rendering and presentation for DSXU workflows'
  if (group === 'prompt-input-interaction') return 'supports user intent capture before query-loop ownership'
  if (group === 'agent-product-surface') return 'supports AgentTool evidence projection'
  return 'supports DSXU product surface as projection of existing mainline owners'
}

function uiProductConflictRiskForDecision(
  decision: LegacyUiProductSemanticDecision,
): string {
  if (decision === 'replace-delete-candidate') return 'old product semantics may conflict with DSXU identity, release surface, or current owner model'
  if (decision === 'review-before-keep') return 'must prove no hidden execution, orchestration, or obsolete product behavior before keep'
  return 'low if it remains projection-only and does not own runtime decisions'
}

function subSliceOwnerForGroup(group: ComponentVisibleSubSliceGroup | BuddyAssistantSubSliceGroup): string {
  if (group === 'app-shell-layout') return 'App Shell Visible State'
  if (group === 'message-transcript-rendering') return 'Transcript Visible State'
  if (group === 'tool-evidence-rendering') return 'Tool Evidence Visible State'
  if (group === 'settings-config-surface') return 'Settings / Config Visible State'
  if (group === 'diagnostics-cost-status') return 'Diagnostics / Cost Visible State'
  if (group === 'help-onboarding-docs') return 'Help / Onboarding Surface'
  if (group === 'feedback-survey-surface') return 'Feedback Survey Surface'
  if (group === 'branding-upsell-surface') return 'Branding / Upsell Surface'
  if (group === 'design-system-surface') return 'Design System Surface'
  if (group === 'hook-config-surface') return 'Hook Config Surface'
  if (group === 'remote-ide-workflow-surface') return 'Remote / IDE Workflow Surface'
  if (group === 'assistant-session-history') return 'Assistant Session History Projection'
  if (group === 'buddy-companion-surface') return 'Buddy Companion Surface'
  return 'Misc Visible State'
}

function subSliceTargetOwnerForGroup(group: ComponentVisibleSubSliceGroup | BuddyAssistantSubSliceGroup): string {
  if (group === 'message-transcript-rendering') return 'query-loop transcript and context visible-state owner'
  if (group === 'tool-evidence-rendering') return 'Tool Evidence Pack visible-state owner'
  if (group === 'settings-config-surface') return 'settings/config control-plane projection owner'
  if (group === 'diagnostics-cost-status') return 'model router, cost evidence, diagnostics, and status projection owner'
  if (group === 'help-onboarding-docs') return 'help/onboarding projection over existing product state'
  if (group === 'feedback-survey-surface') return 'feedback evidence owner as visible projection only'
  if (group === 'branding-upsell-surface') return 'DSXU identity owner or replace/delete old product surface'
  if (group === 'design-system-surface') return 'shared presentation primitives only'
  if (group === 'hook-config-surface') return 'hook configuration visible projection only'
  if (group === 'remote-ide-workflow-surface') return 'remote session, IDE, and worktree visible-state owner'
  if (group === 'assistant-session-history') return 'session history and resume-state projection owner'
  if (group === 'buddy-companion-surface') return 'replace/delete unless DSXU owner proves current product value'
  return 'query-loop visible-state projection owner'
}

function subSliceRequiredActionForGroup(group: ComponentVisibleSubSliceGroup | BuddyAssistantSubSliceGroup): string {
  if (group === 'buddy-companion-surface') return 'mark as replace/delete candidate unless a DSXU owner proves current value'
  if (group === 'branding-upsell-surface') return 'separate DSXU identity from old product or upsell paths and mark obsolete paths replace/delete'
  if (group === 'feedback-survey-surface') return 'keep as feedback evidence projection only; it cannot own query-loop, runtime, or tool decisions'
  if (group === 'tool-evidence-rendering') return 'prove rendering consumes Tool Evidence Pack state only'
  if (group === 'message-transcript-rendering') return 'prove rendering consumes query-loop transcript state only'
  if (group === 'diagnostics-cost-status') return 'prove display consumes model/cost/diagnostic evidence only'
  if (group === 'assistant-session-history') return 'prove history projection cannot orchestrate agent or query execution'
  return 'prove projection-only ownership and no runtime decision authority'
}

function uiProductGoalFitForSubSlice(
  group: ComponentVisibleSubSliceGroup | BuddyAssistantSubSliceGroup,
  decision: LegacyUiProductSemanticDecision,
): string {
  if (decision === 'replace-delete-candidate') {
    return 'does not yet prove DSXU query-loop, tool, agent, context, or evidence value; keep only with explicit owner proof'
  }
  if (decision === 'review-before-keep') {
    return 'may be useful visible state, but must prove current DSXU user value and no obsolete product surface behavior'
  }
  if (group === 'message-transcript-rendering') return 'projects query-loop transcript and user/assistant message state'
  if (group === 'tool-evidence-rendering') return 'projects Tool Evidence Pack and source/tool result state'
  if (group === 'settings-config-surface') return 'projects configuration state owned outside the component layer'
  if (group === 'diagnostics-cost-status') return 'projects diagnostics, cost, model, and status evidence'
  if (group === 'assistant-session-history') return 'projects session history and resume state without owning orchestration'
  return 'projects DSXU visible state without owning runtime decisions'
}

function componentVisibleSubSliceIdForGroup(group: ComponentVisibleSubSliceGroup): string {
  const index = componentVisibleSubSliceOrder.indexOf(group) + 1
  return `LMR-02C.${index.toString().padStart(2, '0')}`
}

function buddyAssistantSubSliceIdForGroup(group: BuddyAssistantSubSliceGroup): string {
  const index = buddyAssistantSubSliceOrder.indexOf(group) + 1
  return `LMR-02K.${index.toString().padStart(2, '0')}`
}

function sanitizePath(path: string): string {
  return path.replace(LEGACY_PRODUCT_REPLACE_PATTERN, 'legacy-product')
}

function buildBatch(
  group: LegacyMainlineDirtyGroup,
  entries: readonly V18DirtyLedgerEntry[],
): LegacyMainlineDirtyReviewBatch {
  const uiProductSlices = group === 'ui-product' ? buildUiProductSlices(entries) : undefined
  const ownerSlices = group !== 'tool-runtime' && group !== 'ui-product' ? buildLegacyOwnerSlices(group, entries) : undefined
  const redlines = entries.length === 0 ? ['batch has no entries'] : []
  return {
    id: idForGroup(group),
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: ownerForGroup(group),
    status: redlines.length > 0 ? 'BLOCKED' : 'PARTIAL',
    risk: riskForGroup(group),
    disposition: dispositionForGroup(group),
    requiredAction: requiredActionForGroup(group),
    targetOwner: targetOwnerForGroup(group),
    canAutoClose: false,
    ...(ownerSlices ? { ownerSlices } : {}),
    ...(uiProductSlices ? { uiProductSlices } : {}),
    samplePaths: entries.slice(0, 10).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

function buildLegacyOwnerSlice(
  parentId: LegacyMainlineDirtyReviewBatchId,
  id: string,
  group: string,
  entries: readonly V18DirtyLedgerEntry[],
): LegacyMainlineOwnerSlice {
  const semanticDecision = legacySemanticDecisionForSlice(group, entries)
  const subSlices = buildLegacyOwnerSubSlices(id, group, entries)
  const redlines = [
    ...(entries.length === 0 ? ['legacy owner slice has no entries'] : []),
    ...(semanticDecision === 'replace-delete-candidate' ? ['legacy owner slice is replace/delete candidate unless current owner proof exists'] : []),
    ...(semanticDecision === 'review-before-keep' ? ['legacy owner slice requires owner proof before keep'] : []),
  ]
  return {
    id,
    parentId,
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: legacyOwnerForSlice(group),
    targetOwner: legacyTargetOwnerForSlice(group),
    semanticDecision,
    goalFit: legacyGoalFitForSlice(group, semanticDecision),
    conflictRisk: legacyConflictRiskForDecision(semanticDecision),
    requiredAction: legacyRequiredActionForSlice(group),
    canOwnRuntime: legacyCanOwnRuntime(group),
    ...(subSlices.length > 0 ? { subSlices } : {}),
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

function buildLegacyOwnerSubSlice(
  parentId: string,
  id: string,
  group: string,
  entries: readonly V18DirtyLedgerEntry[],
): LegacyMainlineOwnerSubSlice {
  const semanticDecision = legacySemanticDecisionForSubSlice(group, entries)
  const redlines = [
    ...(entries.length === 0 ? ['legacy owner sub-slice has no entries'] : []),
    ...(semanticDecision === 'replace-delete-candidate' ? ['legacy owner sub-slice is replace/delete candidate unless current owner proof exists'] : []),
    ...(semanticDecision === 'review-before-keep' ? ['legacy owner sub-slice requires owner proof before keep'] : []),
  ]
  return {
    id,
    parentId,
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: legacyOwnerForSubSlice(group),
    targetOwner: legacyTargetOwnerForSubSlice(group),
    semanticDecision,
    goalFit: legacyGoalFitForSubSlice(group, semanticDecision),
    conflictRisk: legacyConflictRiskForDecision(semanticDecision),
    requiredAction: legacyRequiredActionForSubSlice(group),
    canOwnRuntime: false,
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

function buildLegacyOwnerSubSlices(
  parentId: string,
  group: string,
  entries: readonly V18DirtyLedgerEntry[],
): readonly LegacyMainlineOwnerSubSlice[] {
  return legacyOwnerSubSliceOrderForGroup(group)
    .map((subGroup, index) => {
      const subEntries = entries.filter(entry => legacyOwnerSubSliceGroupForPath(group, entry.path) === subGroup)
      return subEntries.length > 0
        ? buildLegacyOwnerSubSlice(parentId, legacyOwnerSubSliceId(parentId, index + 1), subGroup, subEntries)
        : null
    })
    .filter((slice): slice is LegacyMainlineOwnerSubSlice => slice !== null)
}

function buildLegacyOwnerSlices(
  group: LegacyMainlineDirtyGroup,
  entries: readonly V18DirtyLedgerEntry[],
): readonly LegacyMainlineOwnerSlice[] {
  const parentId = idForGroup(group)
  return legacyOwnerSliceOrderForGroup(group)
    .map((sliceGroup, index) => {
      const sliceEntries = entries.filter(entry => legacyOwnerGroupForPath(group, entry.path) === sliceGroup)
      return sliceEntries.length > 0
        ? buildLegacyOwnerSlice(parentId, legacyOwnerSliceId(parentId, index + 1), sliceGroup, sliceEntries)
        : null
    })
    .filter((slice): slice is LegacyMainlineOwnerSlice => slice !== null)
}

function buildUiProductSlice(
  group: LegacyUiProductSurfaceGroup,
  entries: readonly V18DirtyLedgerEntry[],
): LegacyUiProductSurfaceSlice {
  const semanticDecision = uiProductSemanticDecisionForGroup(group, entries)
  const subSlices = buildUiProductSubSlices(group, entries)
  const obsoleteSamplePaths = entries
    .filter(entry => isReplaceDeleteCandidatePath(entry.path))
    .slice(0, 8)
    .map(entry => sanitizePath(entry.path))
  const redlines = [
    ...(entries.length === 0 ? ['ui product owner slice has no entries'] : []),
    ...(semanticDecision === 'replace-delete-candidate' ? ['ui product slice has old product or obsolete surface paths; keep requires explicit DSXU owner proof'] : []),
    ...(semanticDecision === 'review-before-keep' ? ['ui product slice requires goal-fit review before keep'] : []),
    ...(obsoleteSamplePaths.length > 0 && semanticDecision !== 'replace-delete-candidate' ? ['ui product slice contains old product or obsolete path-level replace/delete candidates'] : []),
  ]
  return {
    id: uiProductSliceIdForGroup(group),
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: uiProductOwnerForGroup(group),
    targetOwner: uiProductTargetOwnerForGroup(group),
    semanticDecision,
    goalFit: uiProductGoalFitForDecision(group, semanticDecision),
    conflictRisk: uiProductConflictRiskForDecision(semanticDecision),
    obsoletePathCount: entries.filter(entry => isReplaceDeleteCandidatePath(entry.path)).length,
    requiredAction: uiProductRequiredActionForGroup(group),
    canOwnRuntime: false,
    ...(subSlices.length > 0 ? { subSlices } : {}),
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    obsoleteSamplePaths,
    redlines,
  }
}

function buildUiProductSubSlice(
  parentId: LegacyUiProductSurfaceSliceId,
  id: string,
  group: ComponentVisibleSubSliceGroup | BuddyAssistantSubSliceGroup,
  entries: readonly V18DirtyLedgerEntry[],
): LegacyUiProductSubSlice {
  const semanticDecision = uiProductSemanticDecisionForSubSlice(group, entries)
  const obsoleteSamplePaths = entries
    .filter(entry => isReplaceDeleteCandidatePath(entry.path))
    .slice(0, 8)
    .map(entry => sanitizePath(entry.path))
  const redlines = [
    ...(entries.length === 0 ? ['ui product sub-slice has no entries'] : []),
    ...(semanticDecision === 'replace-delete-candidate' ? ['sub-slice is replace/delete candidate unless current DSXU owner value is proven'] : []),
    ...(semanticDecision === 'review-before-keep' ? ['sub-slice requires goal-fit review before keep'] : []),
    ...(obsoleteSamplePaths.length > 0 && semanticDecision !== 'replace-delete-candidate' ? ['sub-slice contains path-level replace/delete candidates'] : []),
  ]
  return {
    id,
    parentId,
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: subSliceOwnerForGroup(group),
    targetOwner: subSliceTargetOwnerForGroup(group),
    semanticDecision,
    goalFit: uiProductGoalFitForSubSlice(group, semanticDecision),
    conflictRisk: uiProductConflictRiskForDecision(semanticDecision),
    obsoletePathCount: entries.filter(entry => isReplaceDeleteCandidatePath(entry.path)).length,
    requiredAction: subSliceRequiredActionForGroup(group),
    canOwnRuntime: false,
    samplePaths: entries.slice(0, 8).map(entry => sanitizePath(entry.path)),
    obsoleteSamplePaths,
    redlines,
  }
}

function buildUiProductSubSlices(
  group: LegacyUiProductSurfaceGroup,
  entries: readonly V18DirtyLedgerEntry[],
): readonly LegacyUiProductSubSlice[] {
  if (group === 'component-visible-state') {
    return componentVisibleSubSliceOrder
      .map(subGroup => {
        const sliceEntries = entries.filter(entry => componentVisibleSubSliceForPath(entry.path) === subGroup)
        return sliceEntries.length > 0
          ? buildUiProductSubSlice('LMR-02C', componentVisibleSubSliceIdForGroup(subGroup), subGroup, sliceEntries)
          : null
      })
      .filter((slice): slice is LegacyUiProductSubSlice => slice !== null)
  }
  if (group === 'buddy-assistant-surface') {
    return buddyAssistantSubSliceOrder
      .map(subGroup => {
        const sliceEntries = entries.filter(entry => buddyAssistantSubSliceForPath(entry.path) === subGroup)
        return sliceEntries.length > 0
          ? buildUiProductSubSlice('LMR-02K', buddyAssistantSubSliceIdForGroup(subGroup), subGroup, sliceEntries)
          : null
      })
      .filter((slice): slice is LegacyUiProductSubSlice => slice !== null)
  }
  return []
}

function buildUiProductSlices(entries: readonly V18DirtyLedgerEntry[]): readonly LegacyUiProductSurfaceSlice[] {
  return uiProductSliceOrder
    .map(group => {
      const sliceEntries = entries.filter(entry => uiProductSliceForPath(entry.path) === group)
      return sliceEntries.length > 0 ? buildUiProductSlice(group, sliceEntries) : null
    })
    .filter((slice): slice is LegacyUiProductSurfaceSlice => slice !== null)
}

export function buildLegacyMainlineDirtyReview(ledger: V18DirtyQuarantineLedger): LegacyMainlineDirtyReview {
  const legacyEntries = ledger.entries.filter(entry => entry.category === 'mainline_active' && isLegacyMainlinePath(entry.path))
  const batches = groupOrder
    .map(group => {
      const entries = legacyEntries.filter(entry => groupForPath(entry.path) === group)
      return entries.length > 0 ? buildBatch(group, entries) : null
    })
    .filter((batch): batch is LegacyMainlineDirtyReviewBatch => batch !== null)
  const pass = batches.filter(batch => batch.status === 'PASS').length
  const partial = batches.filter(batch => batch.status === 'PARTIAL').length
  const blocked = batches.filter(batch => batch.status === 'BLOCKED').length
  const highRiskBatchCount = batches.filter(batch => batch.risk === 'high').length
  const legacyOwnerSlices = batches.flatMap(batch => batch.ownerSlices ?? [])
  const legacyOwnerSubSlices = legacyOwnerSlices.flatMap(slice => slice.subSlices ?? [])
  const legacyOwnerReviewUnits = [
    ...legacyOwnerSlices.filter(slice => !slice.subSlices || slice.subSlices.length === 0),
    ...legacyOwnerSubSlices,
  ]
  const uiProductSlices = batches.flatMap(batch => batch.uiProductSlices ?? [])
  const uiProductSubSlices = uiProductSlices.flatMap(slice => slice.subSlices ?? [])
  const uiProductReviewUnits = [
    ...uiProductSlices.filter(slice => !slice.subSlices || slice.subSlices.length === 0),
    ...uiProductSubSlices,
  ]
  const redlines = [
    ...(legacyEntries.length > 0 ? ['legacy mainline dirty entries remain open'] : []),
    ...batches.flatMap(batch => batch.redlines.map(redline => `${batch.id}: ${redline}`)),
  ]
  const status: LegacyMainlineDirtyReviewStatus = blocked > 0
    ? 'BLOCKED'
    : legacyEntries.length > 0 || partial > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.legacy-mainline-dirty-review.v1',
    status,
    total: legacyEntries.length,
    batchCount: batches.length,
    pass,
    partial,
    blocked,
    highRiskBatchCount,
    toolRuntimeReviewStatus: 'NOT_RUN',
    toolRuntimeReviewBatchCount: 0,
    uiProductSliceCount: uiProductSlices.length,
    uiProductSubSliceCount: uiProductSubSlices.length,
    uiProductUnassignedCount: uiProductReviewUnits
      .filter(slice => slice.redlines.length > 0)
      .reduce((sum, slice) => sum + slice.count, 0),
    uiProductReplaceDeleteCandidateCount: uiProductReviewUnits
      .reduce((sum, slice) => sum + (slice.semanticDecision === 'replace-delete-candidate' ? slice.count : slice.obsoletePathCount), 0),
    uiProductReviewBeforeKeepCount: uiProductReviewUnits
      .filter(slice => slice.semanticDecision === 'review-before-keep')
      .reduce((sum, slice) => sum + slice.count, 0),
    legacyOwnerSliceCount: legacyOwnerSlices.length,
    legacyOwnerSubSliceCount: legacyOwnerSubSlices.length,
    legacyOwnerReplaceDeleteCandidateCount: legacyOwnerReviewUnits
      .filter(slice => slice.semanticDecision === 'replace-delete-candidate')
      .reduce((sum, slice) => sum + slice.count, 0),
    legacyOwnerReviewBeforeKeepCount: legacyOwnerReviewUnits
      .filter(slice => slice.semanticDecision === 'review-before-keep')
      .reduce((sum, slice) => sum + slice.count, 0),
    canCloseLegacyMainlineGate: legacyEntries.length === 0 && blocked === 0,
    mustNotStageOrRestore: legacyEntries.length > 0 || blocked > 0,
    batches,
    redlines,
    safeguards: [
      'review is evidence-only and does not stage, delete, restore, move, reset, or commit files',
      'legacy source must map to a DSXU owner, replacement evidence, or release-excluded archive before close',
      'large tool-runtime and core-root changes cannot be closed by aggregate tests alone',
      'disposition is a review state, not permission to delete files',
    ],
    nextAction: batches.some(batch => batch.group === 'tool-runtime')
      ? 'review-tool-runtime-migration'
      : batches.some(batch => batch.group === 'ui-product')
        ? 'review-ui-product-surface'
        : batches.length > 0
          ? 'review-legacy-other'
          : 'legacy-mainline-gate-closed',
  }
}
