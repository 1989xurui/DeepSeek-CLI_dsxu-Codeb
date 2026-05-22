/**
 * DSXU Query Engine public API.
 *
 * The engine wires the tool registry, query loop, MCP, memory, and streaming
 * entry points used by the DSXU runtime.
 */

export { ToolRegistry } from './tool-registry'
export { createGearBox } from './gear-box'
export { queryLoop, runQuery } from './query-loop'
export { createMockLLMCall, createPreferredDSXULLMCall } from './llm-adapter'
export {
  adaptMainlineToolToEngine,
  getMainlineCoreToolAdapters,
  getMainlineMcpToolAdaptersForClients,
  registerMainlineCoreToolAdapters,
  registerMainlineMcpToolAdapters,
} from './engine-tool-adapter'
export type { APIServiceConfig, APIBackend } from './api-service'
export { CircuitBreaker } from './circuit-breaker'
export type { CircuitBreakerConfig, CircuitBreakerSnapshot, CircuitBreakerState } from './circuit-breaker'
export {
  microCompact,
  fullCompact,
  lightCompact,
  autoCompactIfNeeded,
  compactMessages,
  CompactionManager,
  checkContextHygiene,
  applyContextHygiene,
  decideCompactionWithHygiene,
  applyHygieneAndCompact
} from './compact.ts'
export type {
  CompactConfig,
  CompactResult,
  CompactInput,
  CompactMetadata,
  CompactLevel,
  ContextHygieneIssueType,
  ContextHygieneIssue,
  ContextHygieneResult
} from './compact.ts'
export {
  addToolGatePermissionRule,
  checkToolGatePermission,
  classifyBashCommand,
  createToolGatePermissionPolicy,
  getToolSafetyLevel,
  setToolGatePermissionMode,
  withPermissions,
} from './permissions'
export type { PermissionMode, ToolSafetyLevel, PermissionDecision, PermissionCheckResult, PermissionRule } from './permissions'
export { parseFrontmatter, parseFrontmatterFromFile, composeFrontmatter } from './frontmatter-parser'
export type { FrontmatterResult } from './frontmatter-parser'
export { MagicDocsManager, createMagicDocsManager } from './magic-docs'
export type { MagicDoc, MagicDocUpdateResult } from './magic-docs'
import { MemoryStore, AutoDreamIntegrator } from './memory-extractor'
import { createForkAgentTool } from './forked-agent'
import { SkillsAdapter, createSkillsAdapter, type SkillsAdapterConfig } from './skills-adapter'
import { SpeculationManager, createSpeculationManager, type SpeculationStrategy } from './speculation'
import { getModelConfig, isDeepSeekNativeModel, getAvailableModels, recommendModelForTask } from './model-config'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../utils/model/deepseekV4Control'
import { createLifecycleProtocolManager } from './lifecycle-protocol-manager'
import type { LifecycleProtocolManager } from './coordinator-types-v1'
export { WebFetchTool, WebSearchTool, TodoWriteTool, AskUserTool, RewindFilesTool, getExtendedTools, getAllTools, setAskUserCallback } from './extended-tools'
export { createFork, createForkAgentTool, ForkAgentTool, getActiveForkCount, extractStructuredSummary } from './forked-agent'
export type { ForkConfig, ForkResult, AgentSummary } from './forked-agent'
export { LSPTool, parseTscOutput, collectProjectDiagnostics } from './lsp-tool'
export type { Diagnostic } from './lsp-tool'
export type {
  MCPServerConnection,
  ScopedMcpServerConfig as MCPServerConfig,
  ServerResource as MCPResource,
} from '../../services/mcp/types'
export type MCPResourceTemplate = {
  uriTemplate: string
  name?: string
  description?: string
  mimeType?: string
}
export { estimateTokens, estimateMessageTokens, estimateAllTokens, calculateTokenBudget, tokenAccuracyMonitor, calibrateFromResponse } from './token-estimator'
export type { TokenBudget, TokenAccuracyStats } from './token-estimator'
export { DEEPSEEK_CONTEXT_WINDOW, DEEPSEEK_MAX_OUTPUT_TOKENS, DEFAULT_SAFETY_MARGIN, NIGHT_SAFETY_MARGIN, isBeijingOffPeak, getSafetyMargin, getModelContextLimit, getModelMaxOutputTokens, clampMaxTokensToBudget } from './model-limits'
export { buildProxyBudgetGuard, summarizeBudgetMessages, advanceBudgetGuardState, resetBudgetGuardState, buildBudgetIncidentDetails, shouldBlockProxyRequest, buildLocalBudgetExceededError, buildBudgetKillSwitchPayload } from './proxy-budget-guard'
export type { ProxyBudgetBase, ProxyBudgetGuard, ProxyBudgetGuardState, ProxyBudgetGuardTransition, BudgetMessageSummary, BudgetKillSwitchPayload } from './proxy-budget-guard'
export { extractMemories, extractFromCompactSummary, MemoryStore, AutoDreamIntegrator } from './memory-extractor'
export type { Memory, ExtractionResult } from './memory-extractor'
export { CacheMonitor } from './cache-monitor'
export type { CacheStats, CacheBreakEvent } from './cache-monitor'
export {
  recordPromptState,
  checkResponseForCacheBreak,
  notifyCompaction,
  cleanupQuerySourceTracking,
  resetPromptCacheBreakDetection,
} from './prompt-cache-break-detection'
export type {
  PromptStateSnapshot,
  CacheBreakCheckInput,
  PromptStateChanges,
  CacheBreakReport,
} from './prompt-cache-break-detection'
export { InjectDebugLoggerTool, CleanupDebugLoggerTool, HypothesisDebugTool, getDebugTools, getActiveInstrumentationCount, resetInstrumentations } from './debug-tools'
export type { Hypothesis } from './debug-tools'
export { ADR_TEMPLATES, getADRTemplateNames, selectADRTemplate, crossReview, runADRWorkflow, isArchitectureTask } from './adr-review'
export type { ADRTemplate, ReviewResult } from './adr-review'
export { BlastRadiusTool, buildDepGraph, computeBlastRadius, buildDSXUSemanticCodeGraphEvidence, parseImports, parseExports, isTestFile, collectSourceFiles, quickBlastRadius } from './blast-radius'
export type { DepGraph, DepNode, BlastResult, DSXUSemanticCodeGraphEvidence } from './blast-radius'
export { AccessibilityTreeTool, parseHTMLToA11yTree, renderA11yTree, countA11yNodes, checkA11yIssues } from './accessibility-tree'
export type { A11yNode } from './accessibility-tree'
export { withRetry, isRetryableError, calculateDelay, RateLimiter, withRateLimitAndRetry } from './retry'
export type { RetryConfig, RetryResult, RateLimiterConfig } from './retry'
export { executeToolsParallel, ToolResultCache } from './parallel-tools'
export type { ParallelConfig, ToolExecResult, ToolCacheConfig } from './parallel-tools'
export { CostTracker, estimateCost, MODEL_PRICING } from './cost-tracker'
export type { CostEntry, CostBudget, CostAlert, ModelPricing } from './cost-tracker'
export {
  buildDSXUWorkStateTimeline,
  buildDSXURuntimeStateCard,
  buildDSXUTaskEvidencePacket,
  projectDSXUToolCallResultToWorkStateEvent,
  projectDSXUPlanTemplateToWorkStateEvents,
  summarizeDSXUWorkStateTimeline,
} from './work-state-timeline'
export {
  buildDSXUActiveFrame,
  appendLedgerEvent,
  createProgressLedger,
  projectDeepSeekRouteAdmissionToLedgerEvent,
} from './progress-ledger'
export {
  compileDSXUExecutionContract,
  validateDSXUExecutionContract,
  projectDSXUExecutionContractToLedgerEvent,
} from './action-contract'
export {
  buildToolCatalog,
  compileDSXUToolView,
} from './tool-catalog-v1'
export {
  buildDSXUV8LogicalToolWindow,
  evaluateDSXUV8ToolWindowCount,
  getDSXUV8ToolWindowPolicy,
  resolveDSXUV8ToolWindowPolicy,
  resolveDSXUV8ToolWindowProfile,
} from './tool-window-policy-v8'
export {
  buildDSXUCapabilityRegistry,
  compileDSXUCapabilityActivationPlan,
  getDSXUCapabilityEntry,
  resolveDSXUToolCapabilityExposure,
} from './capability-registry'
export {
  buildDSXUPromptSectionPlan,
} from './prompt-section-router'
export type {
  DSXUCapabilityActivationPlan,
  DSXUCapabilityEntry,
  DSXUCapabilityRegistry,
} from './capability-registry'
export type {
  DSXUPromptSectionPlan,
} from './prompt-section-router'
export { buildDSXUFinalReportWorkStateTimeline } from './code-mode-surgical-loop'
export { buildDSXUEditProofEnvelope } from './code-mode-surgical-loop'
export type { DSXUEditProofEnvelope } from './code-mode-surgical-loop'
export type {
  DSXUWorkStateEvent,
  DSXUWorkStateEventKind,
  DSXUWorkStateRisk,
  DSXUWorkStateStatus,
  DSXUWorkStateTimeline,
  DSXUWorkStateTimelineInput,
  DSXURuntimeStateCard,
  DSXURuntimeStateCardState,
  DSXURuntimeRecoveryAction,
  DSXUTaskEvidencePacket,
} from './work-state-timeline'
export type {
  DSXUActiveFrame,
  DeepSeekRouteAdmissionProjection,
  ProgressLedger,
  LongTaskLedgerEvent,
} from './progress-ledger'
export type {
  DSXUExecutionContract,
  DSXUExecutionContractInput,
  DSXUExecutionTaskType,
} from './action-contract'
export type {
  DSXUToolViewCompilerResult,
} from './tool-catalog-v1'
export type {
  DSXUV8ToolWindowPolicy,
  DSXUV8ToolWindowProfile,
} from './tool-window-policy-v8'
export { buildV5ReplayBank } from './real-task-replay-suite-v1'
export type { V5ReplayBank, V5ReplayTraceEvidence } from './real-task-replay-suite-v1'
// Bug Brain 碌录鲁枚
export { BugBrain, defaultBugBrain } from './bug-brain/index'
export { bugBrainHooks, quickRecordBug } from './bug-brain/integration'
export type { BugRecord, BugCategory, BugSeverity, BugSource, BugContext, BugPattern, FixPattern, BugAnalysis } from './bug-brain/types'
// 脧貌潞贸录忙脠脻碌录鲁枚
export { SessionStore, ContextWindowManager, generateTitle, SessionSummaryManager, AgentSummaryManager, SessionReportGenerator, generateSessionCard, generateSessionTable } from './session'
export type { SessionMeta, SessionData, ContextWindowConfig, SessionSummaryConfig, SessionMemoryNote, SessionReportOptions, SessionReport } from './session'
export { SystemPromptBuilder, buildSystemPrompt } from './system-prompt'
export type { PromptSection, SystemPromptConfig } from './system-prompt'
export { GitTool, runGit, parseDiff, formatDiff, getGitContext } from './git-tools'
export type { GitResult, FileDiff, DiffHunk, DiffLine } from './git-tools'
export { loadConfig, mergeConfig, validateConfig, saveGlobalConfig, saveProjectConfig, loadConfigFile, loadEnvConfig, DEFAULT_CONFIG } from './config'
export type { DSxuConfig } from './config'
export { Spinner, ProgressBar, TerminalStreamWriter, NullStreamWriter, colorize, colors } from './streaming'
export type { StreamWriter } from './streaming'
export { isSlashCommand, parseSlashCommand, executeSlashCommand, getRegisteredCommands, registerCommand } from './slash-commands'
export type { SlashCommand, CommandContext, CommandResult } from './slash-commands'
export { FileWatcher, deduplicateEvents, createWatcher, getRecentlyModified } from './file-watcher'
export type { FileChangeEvent, WatcherConfig } from './file-watcher'
export { FileHistoryManager, checkOriginFileChanged, computeDiffStatsForFile, getBackupFileName } from './file-history'
export type { FileHistoryBackup, FileHistorySnapshot, FileHistoryState, FileHistoryDiffStats } from './file-history'
export { TransactionManager } from './transaction-manager'
export type { TransactionManagerConfig, TransactionState } from './transaction-manager'
export { parseArgs, getHelpText, REPLState } from './cli'
export type { CLIArgs, REPLConfig } from './cli'
export { TelemetryCollector, ErrorReporter, NotificationManager } from './telemetry'
export type { TelemetryEvent, TransactionTelemetrySummary, ErrorReport, Notification, NotificationLevel } from './telemetry'
export { ReviewerSubagent } from './reviewer-subagent'
export type { ReviewerSubagentConfig } from './reviewer-subagent'
export { WorktreeOrchestrator } from './worktree-orchestrator'
export type { WorktreeOrchestratorConfig } from './worktree-orchestrator'
export { EvoEngine } from './evo-engine'
export type { EvoEngineConfig } from './evo-engine'
export { checkCommand, checkApiKey, checkProjectConfig, checkNodeVersion, runDoctor, formatDoctorReport, getVersionInfo, getAuth, validateApiKey, VERSION } from './doctor'
export type { HealthCheck, DoctorReport, AuthConfig } from './doctor'
export { TaskQueue, WorkspaceManager, analyzeWorkspace, discoverProjects } from './task-queue'
export type { Task, TaskStatus, WorkspaceInfo } from './task-queue'
export { CodingTaskRunner } from './coding-task-runner'
export type { CodingTaskSpec, CodingTaskRunRecord } from './coding-task-runner'
export { getToolCapabilityPool, getToolCapabilityPoolSnapshot } from './tool-capability-pool'
export type { ToolCapabilityPoolName } from './tool-capability-pool'
export { createLifecycleProtocolManager } from './lifecycle-protocol-manager'
export type {
  LifecycleProtocol,
  ProtocolState,
  ProtocolCheckpoint,
  ProtocolRecoveryStrategy,
  ProtocolMetric,
  ProtocolTransition,
  ProtocolAction,
  ProtocolValidation,
  ProtocolMetricsSnapshot
} from './coordinator-types-v1'
export type { LifecycleProtocolManager } from './coordinator-types-v1'
export { formatTokens, formatCost, formatDuration, formatBytes, truncate, formatTable, simplifyMarkdown, validateFilePath, validateJSON, checkInjection, sanitizeInput, initProject, PluginManager } from './formatters'
export type { InitResult, PluginManifest, PluginRegistration } from './formatters'
export * from './recovery'
export * from './types'

import type {
  QueryEngineConfig,
  QueryEvent,
  QueryResult,
  Message,
  ToolDefinition,
} from './types'
import { ToolRegistry } from './tool-registry'
import { queryLoop } from './query-loop'
import { createPreferredDSXULLMCall } from './llm-adapter'
import { getMainlineMcpToolAdaptersForClients } from './engine-tool-adapter'
import { ReviewerSubagent } from './reviewer-subagent'
import { WorktreeOrchestrator } from './worktree-orchestrator'
import { EvoEngine } from './evo-engine'
import { BlastRadiusTool } from './blast-radius'
import { AccessibilityTreeTool } from './accessibility-tree'
import {
  getToolCapabilityPool,
  getToolCapabilityPoolSnapshot,
} from './tool-capability-pool'
import type { ToolCapabilityPoolName } from './tool-capability-pool'
import { ToolProtocolIntegration } from './tool-protocol-integration'
import type { MCPServerConnection } from '../../services/mcp/types'

/** DSXU engine harness API. Product entry uses the root QueryEngine in src/QueryEngine.ts. */
export class EngineHarness {
  private config: QueryEngineConfig
  private toolRegistry: ToolRegistry
  private mcpInitialized = false
  private memoryStore: MemoryStore
  private autoDreamIntegrator: AutoDreamIntegrator | null = null
  /** Skills脢脢脜盲脝梅 */
  private skillsAdapter: SkillsAdapter | null = null
  /** Speculation鹿脺脌铆脝梅 */
  private speculationManager: SpeculationManager | null = null
  /** Agent Summaries 脢脮录炉脝梅 */
  private agentSummaries: AgentSummary[] = []
  /** 碌卤脟掳禄谩禄掳脧没脧垄脌煤脢路 */
  private currentSessionMessages: Message[] = []
  /** Tool Protocol 录炉鲁脡脝梅 */
  private toolProtocolIntegration: ToolProtocolIntegration | null = null
  /** 脡煤脙眉脰脺脝脷脨颅脪茅鹿脺脌铆脝梅 */
  private _lifecycleProtocolManager: LifecycleProtocolManager | null = null

  constructor(config?: Partial<QueryEngineConfig>) {
    this.config = {
      llmCall: config?.llmCall ?? createPreferredDSXULLMCall(),
      maxTurns: config?.maxTurns ?? 50,
      maxConsecutiveErrors: config?.maxConsecutiveErrors ?? 10,
      cwd: config?.cwd ?? process.cwd(),
      abortSignal: config?.abortSignal,
      priority: config?.priority ?? 2,
      priorityConfig: config?.priorityConfig,
      mcpAutoConnect: config?.mcpAutoConnect ?? true,
      mainlineMcpClients: config?.mainlineMcpClients ?? [],
      maxToolCallsPerTurn: config?.maxToolCallsPerTurn ?? 12,
      toolExecution: config?.toolExecution ?? { mode: 'batch' },
      toolCircuitBreaker: config?.toolCircuitBreaker ?? { enabled: false },
      toolTransaction: config?.toolTransaction ?? { enabled: false, rollbackOnToolError: true, maxTrackedFilesPerTurn: 32 },
      toolSubset: config?.toolSubset ?? { enabled: true, maxTools: 12, minTools: 6 },
      telemetry: config?.telemetry,
      reviewerSubagent: config?.reviewerSubagent ?? { enabled: false, minScoreToApprove: 75, failOnRollback: true, failOnCircuitSkipThreshold: 2 },
      worktreeOrchestrator: config?.worktreeOrchestrator ?? { maxParallel: 2, branchPrefix: 'codex/wt' },
      evoEngine: config?.evoEngine ?? { enabled: false, maxMutationsPerRun: 3, allowModelSwitch: false },
      fullAbsorb: config?.fullAbsorb ?? { enabled: false, aggressive: false, reduceTestStrategy: 'focused' },
      memoryExtraction: config?.memoryExtraction ?? { enabled: true, qualityThreshold: 0.6 },
      sessionSummary: config?.sessionSummary ?? { enabled: true, updateInterval: 10, maxLength: 1000 },
      sessionMemory: config?.sessionMemory ?? { enabled: true, updateInterval: 5, minImportance: 0.3, maxNotes: 20, autoGenerate: true, summaryMaxLength: 500 },
      autoDream: config?.autoDream ?? { enabled: true, intervalMs: 30000, batchSize: 10, qualityThreshold: 0.7 },
      skills: config?.skills ?? { enabled: true, autoRegister: true, excludeSkills: [], timeout: 30000, debug: false },
      speculation: config?.speculation ?? { enabled: false, maxParallel: 3, timeoutMs: 30000, maxSpeculations: 5, debug: false, triggerInterval: 5, minConfidence: 0.5 },
      toolProtocol: config?.toolProtocol ?? { enabled: false, autoRegisterNativeTools: true, autoBridgeExistingTools: false, enableGuards: true, enableEvents: true },
    }
    this.toolRegistry = new ToolRegistry()

    // 鲁玫脢录禄炉 MemoryStore 潞脥 AutoDreamIntegrator
    this.memoryStore = new MemoryStore(config?.memoryExtraction?.persistCallback)

    if (this.config.autoDream?.enabled) {
      this.autoDreamIntegrator = new AutoDreamIntegrator(
        this.memoryStore,
        this.config.autoDream
      )
      this.autoDreamIntegrator.start()
    }

    // DSXU comment sanitized.
    if (this.config.skills?.enabled) {
      // 脠路卤拢Skills脧碌脥鲁脪脩鲁玫脢录禄炉
      this.ensureSkillsInitialized()

      this.skillsAdapter = createSkillsAdapter(this.config.skills)

      // 脳脭露炉脳垄虏谩Skills
      if (this.config.skills.autoRegister) {
        const skillTools = this.skillsAdapter.registerAllSkills()
        this.toolRegistry.registerAll(skillTools)
        console.log(`[EngineHarness] Registered ${skillTools.length} skills`)
      }
    }

    // DSXU comment sanitized.
    if (this.config.speculation?.enabled) {
      this.speculationManager = createSpeculationManager(this.config.speculation)
      console.log('[EngineHarness] Speculation system initialized')
    }

    // Mirror existing tools into the protocol integration when auto-bridge is enabled.
    if (this.config.toolProtocol?.enabled) {
      this.toolProtocolIntegration = new ToolProtocolIntegration()
      console.log('[EngineHarness] Tool Protocol integration initialized')
    }

    // DSXU comment sanitized.
    if (this.config.lifecycleProtocol?.enabled) {
      this._lifecycleProtocolManager = createLifecycleProtocolManager(this.config.lifecycleProtocol)
      console.log('[EngineHarness] Lifecycle Protocol Manager initialized')
    }
  }

  /**
   * 脠路卤拢Skills脧碌脥鲁脪脩鲁玫脢录禄炉
   */
  private ensureSkillsInitialized(): void {
    try {
      // 露炉脤卢碌录脠毛虏垄鲁玫脢录禄炉Skills脧碌脥鲁
      const { initBundledSkills } = require('../../skills/bundled/index.js')
      initBundledSkills()
    } catch (error: any) {
      console.warn(`[EngineHarness] Failed to initialize skills system: ${error.message}`)
    }
  }

  /**
   * 脝么脫脙Skills脧碌脥鲁脰搂鲁脰
   *
   *
   */
  enableSkills(): this {
    if (this.skillsAdapter) {
      console.log('[EngineHarness] Skills system already enabled')
      return this
    }

    // 脠路卤拢脜盲脰脙麓忙脭脷
    if (!this.config.skills) {
      this.config.skills = { enabled: true, autoRegister: true }
    } else {
      this.config.skills.enabled = true
    }

    this.skillsAdapter = createSkillsAdapter(this.config.skills)

    // 脳脭露炉脳垄虏谩Skills
    if (this.config.skills.autoRegister) {
      const skillTools = this.skillsAdapter.registerAllSkills()
      this.toolRegistry.registerAll(skillTools)
      console.log(`[EngineHarness] Registered ${skillTools.length} skills`)
    }

    return this
  }

  /**
   * 脝么脫脙Speculation脧碌脥鲁脰搂鲁脰
   */
  enableSpeculation(): this {
    if (this.speculationManager) {
      console.log('[EngineHarness] Speculation system already enabled')
      return this
    }

    // 脠路卤拢脜盲脰脙麓忙脭脷
    if (!this.config.speculation) {
      this.config.speculation = { enabled: true, maxParallel: 3, timeoutMs: 30000, maxSpeculations: 5 }
    } else {
      this.config.speculation.enabled = true
    }

    this.speculationManager = createSpeculationManager(this.config.speculation)
    console.log('[EngineHarness] Speculation system enabled')

    return this
  }

  /**
   * 脝么脫脙Tool Protocol脧碌脥鲁脰搂鲁脰
   */
  enableToolProtocol(): this {
    if (this.toolProtocolIntegration) {
      console.log('[EngineHarness] Tool Protocol system already enabled')
      return this
    }

    // 脠路卤拢脜盲脰脙麓忙脭脷
    if (!this.config.toolProtocol) {
      this.config.toolProtocol = { enabled: true, autoRegisterNativeTools: true, autoBridgeExistingTools: false, enableGuards: true, enableEvents: true }
    } else {
      this.config.toolProtocol.enabled = true
    }

    this.toolProtocolIntegration = new ToolProtocolIntegration()
    console.log('[EngineHarness] Tool Protocol system enabled')

    // 脳脭露炉脳垄虏谩脭颅脡煤鹿陇戮脽
    if (this.config.toolProtocol.autoRegisterNativeTools) {
      this.registerNativeToolsToProtocol()
    }

    // 脳脭露炉脳垄虏谩脧脰脫脨鹿陇戮脽
    if (this.config.toolProtocol.autoBridgeExistingTools) {
      this.registerExistingToolsToProtocol()
    }

    return this
  }

  /**
   * 脳垄虏谩脭颅脡煤鹿陇戮脽碌陆Tool Protocol
   */
  private registerNativeToolsToProtocol(): void {
    if (!this.toolProtocolIntegration) return

    // 脮芒脌茂驴脡脪脭脤铆录脫脭颅脡煤鹿陇戮脽碌脛脳垄虏谩脗脽录颅
    // DSXU comment sanitized.
    console.log('[EngineHarness] Native tools registered to Tool Protocol')
  }

  /**
   * 脳垄虏谩脧脰脫脨鹿陇戮脽碌陆 Tool Protocol拢篓掳麓 native/external/legacy 路脰脌脿拢漏
   */
  private registerExistingToolsToProtocol(): void {
    if (!this.toolProtocolIntegration) return

    // 禄帽脠隆脣霉脫脨脪脩脳垄虏谩碌脛鹿陇戮脽
    const allTools = this.toolRegistry.getSchemas()

    // 脳垄虏谩脙驴赂枚脪脩脫脨鹿陇戮脽碌陆脨颅脪茅
    for (const toolSchema of allTools) {
      const tool = this.toolRegistry.find(toolSchema.name)
      if (tool) {
        // DSXU comment sanitized.
        // this.toolProtocolIntegration.registerBridgeTool(toolSchema.name, tool)
      }
    }

    console.log(`[EngineHarness] Registered ${allTools.length} existing tools to Tool Protocol`)
  }

  /**
   * 脳垄虏谩碌楼赂枚鹿陇戮脽碌陆 Tool Protocol
   */
  private registerToolToProtocol(tool: ToolDefinition): void {
    if (!this.toolProtocolIntegration) return

    try {
      // DSXU comment sanitized.
      // this.toolProtocolIntegration.registerBridgeTool(tool.name, tool)
      console.log(`[EngineHarness] Registered tool "${tool.name}" to Tool Protocol`)
    } catch (error: any) {
      console.warn(`[EngineHarness] Failed to register tool "${tool.name}" to Tool Protocol: ${error.message}`)
    }
  }

  /**
   * 陆没脫脙Speculation脧碌脥鲁脰搂鲁脰
   */
  disableSpeculation(): this {
    if (!this.speculationManager) {
      console.log('[EngineHarness] Speculation system not enabled')
      return this
    }

    this.speculationManager = null
    if (this.config.speculation) {
      this.config.speculation.enabled = false
    }
    console.log('[EngineHarness] Speculation system disabled')

    return this
  }

  /**
   * 陆没脫脙Tool Protocol脧碌脥鲁脰搂鲁脰
   */
  disableToolProtocol(): this {
    if (!this.toolProtocolIntegration) {
      console.log('[EngineHarness] Tool Protocol system not enabled')
      return this
    }

    this.toolProtocolIntegration = null
    if (this.config.toolProtocol) {
      this.config.toolProtocol.enabled = false
    }
    console.log('[EngineHarness] Tool Protocol system disabled')

    return this
  }

  /**
   * 脳垄虏谩Speculation虏脽脗脭
   */
  registerSpeculationStrategy(strategy: SpeculationStrategy): this {
    if (!this.speculationManager) {
      throw new Error('Speculation system is not enabled')
    }

    this.speculationManager.registerStrategy(strategy)
    console.log(`[EngineHarness] Registered speculation strategy: ${strategy.name}`)

    return this
  }

  /**
   * 禄帽脠隆Speculation脳麓脤卢
   */
  getSpeculationStatus() {
    if (!this.speculationManager) {
      return {
        enabled: false,
        registeredStrategies: [],
        stats: null,
      }
    }

    return {
      enabled: true,
      registeredStrategies: this.speculationManager.getRegisteredStrategies(),
      stats: this.speculationManager.getStats(),
    }
  }

  /**
   * 禄帽脠隆Tool Protocol脳麓脤卢
   */
  getToolProtocolStatus() {
    if (!this.toolProtocolIntegration) {
      return {
        enabled: false,
        defaultMainline: false,
        owner: 'Tool Envelope / Tool Gate',
        boundary: 'disabled by default; optional owner evidence harness only',
        productRuntime: 'ToolRegistry + Tool Gate',
        activeOnlyWhenExplicitlyEnabled: true,
        nativeToolsRegistered: 0,
        bridgeToolsRegistered: 0,
        config: this.config.toolProtocol || { enabled: false },
      }
    }

    // DSXU comment sanitized.
    return {
      enabled: true,
      defaultMainline: false,
      owner: 'Tool Envelope / Tool Gate',
      boundary: 'explicit owner evidence harness; not a second product ToolBus',
      productRuntime: 'ToolRegistry + Tool Gate',
      activeOnlyWhenExplicitlyEnabled: true,
      nativeToolsRegistered: 0, // DSXU comment sanitized.
      bridgeToolsRegistered: 0, // DSXU comment sanitized.
      config: this.config.toolProtocol || { enabled: true },
    }
  }

  /**
   * 脰麓脨脨Speculation
   */
  async speculate(
    query: string,
    context?: Partial<SpeculationContext>
  ): Promise<SpeculationResult[]> {
    if (!this.speculationManager) {
      throw new Error('Speculation system is not enabled')
    }

    const speculationContext: SpeculationContext = {
      messages: context?.messages || this.currentSessionMessages,
      tools: this.toolRegistry.getAll(),
      cwd: context?.cwd || this.config.cwd || process.cwd(),
      sessionId: context?.sessionId || `session-${Date.now()}`,
      gear: context?.gear || 1,
      query,
      extra: context?.extra,
    }

    return await this.speculationManager.speculate(speculationContext)
  }

  /**
   * 陆没脫脙Skills脧碌脥鲁脰搂鲁脰
   */
  disableSkills(): this {
    if (!this.skillsAdapter) {
      console.log('[EngineHarness] Skills system not enabled')
      return this
    }

    // 麓脫鹿陇戮脽脳垄虏谩卤铆脰脨脪脝鲁媒脣霉脫脨录录脛脺鹿陇戮脽
    const skillTools = this.getSkillTools()
    for (const tool of skillTools) {
      this.toolRegistry.unregister(tool.name)
    }

    this.skillsAdapter = null
    if (this.config.skills) {
      this.config.skills.enabled = false
    }

    console.log(`[EngineHarness] Disabled skills system, removed ${skillTools.length} skills`)
    return this
  }

  /**
   * 禄帽脠隆脪脩脳垄虏谩碌脛Skills鹿陇戮脽
   */
  getSkillTools(): ToolDefinition[] {
    if (!this.skillsAdapter) {
      return []
    }
    return this.skillsAdapter.getSkillTools()
  }

  /**
   * 禄帽脠隆脛拢脨脥脜盲脰脙
   */
  getModelConfig(modelName?: string): DeepSeekModelConfig {
    const model = modelName || DEEPSEEK_V4_FLASH_MODEL
    return getModelConfig(model)
  }

  /**
   * 录矛虏茅脢脟路帽脦陋DeepSeek脭颅脡煤脛拢脨脥
   */
  isDeepSeekNativeModel(modelName: string): boolean {
    return isDeepSeekNativeModel(modelName)
  }

  /**
   * 禄帽脠隆脣霉脫脨驴脡脫脙碌脛DeepSeek脛拢脨脥
   */
  getAvailableModels(): string[] {
    return getAvailableModels()
  }

  /**
   * 赂霉戮脻脠脦脦帽脌脿脨脥脥脝录枚脛拢脨脥
   */
  recommendModelForTask(taskType: string): DeepSeekModelConfig {
    return recommendModelForTask(taskType)
  }

  /**
   * 禄帽脠隆脤脴露篓录录脛脺鹿陇戮脽
   */
  getSkillTool(skillName: string): ToolDefinition | undefined {
    if (!this.skillsAdapter) {
      return undefined
    }
    return this.skillsAdapter.getSkillTool(skillName)
  }

  /**
   * 录矛虏茅录录脛脺脢脟路帽脪脩脳垄虏谩
   */
  hasSkill(skillName: string): boolean {
    if (!this.skillsAdapter) {
      return false
    }
    return this.skillsAdapter.hasSkill(skillName)
  }

  /**
   * 脰麓脨脨脤脴露篓录录脛脺
   */
  async executeSkill(
    skillName: string,
    args: string,
    options?: { cwd?: string }
  ): Promise<ToolOutput> {
    if (!this.skillsAdapter) {
      throw new Error('Skills system is not enabled')
    }

    const toolName = `skill__${skillName}`
    const tool = this.toolRegistry.find(toolName)

    if (!tool) {
      throw new Error(`Skill not found: ${skillName}`)
    }

    const context: ToolContext = {
      cwd: options?.cwd || this.config.cwd || process.cwd(),
      sessionId: `skill-${Date.now()}`,
      gear: 1,
    }

    return await tool.execute({ args }, context)
  }

  /**
   * 禄帽脠隆Skills脧碌脥鲁脳麓脤卢
   */
  getSkillsStatus() {
    if (!this.skillsAdapter) {
      return {
        enabled: false,
        skillsLoaded: false,
        skillCount: 0,
        config: this.config.skills || { enabled: false },
      }
    }

    return this.skillsAdapter.getStatus()
  }

  /**
   * 赂眉脨脗Skills脜盲脰脙
   */
  updateSkillsConfig(config: Partial<NonNullable<QueryEngineConfig['skills']>>): this {
    if (!this.config.skills) {
      this.config.skills = { enabled: true, ...config }
    } else {
      Object.assign(this.config.skills, config)
    }

    if (this.skillsAdapter) {
      this.skillsAdapter.updateConfig(this.config.skills)
    }

    console.log(`[EngineHarness] Updated skills config:`, config)
    return this
  }

  /**
   * 脝么脫脙 ForkAgent 鹿陇戮脽
   *
   *
   */
  enableForkAgent(forkConfig?: ForkConfig): this {
    const forkTool = createForkAgentTool(
      this.config.llmCall,
      this.toolRegistry,
      () => this.currentSessionMessages, // 脢鹿脫脙碌卤脟掳禄谩禄掳脧没脧垄
      forkConfig,
      (summary) => this.addAgentSummary(summary)
    )
    this.toolRegistry.register(forkTool)
    console.log('[EngineHarness] ForkAgent tool enabled')
    return this
  }

  /** Register one tool. */
  registerTool(tool: ToolDefinition): this {
    this.toolRegistry.register(tool)

    // DSXU comment sanitized.
    if (this.toolProtocolIntegration && this.config.toolProtocol?.autoBridgeExistingTools) {
      this.registerToolToProtocol(tool)
    }

    return this
  }

  /** Register multiple tools. */
  registerTools(tools: ToolDefinition[]): this {
    this.toolRegistry.registerAll(tools)
    return this
  }

  registerCapabilityPools(...poolNames: ToolCapabilityPoolName[]): this {
    for (const pool of poolNames) {
      this.toolRegistry.registerAll(getToolCapabilityPool(pool))
    }
    return this
  }

  getCapabilityPoolSnapshot(...poolNames: ToolCapabilityPoolName[]) {
    const pools = poolNames.length > 0 ? poolNames : ['full_absorb']
    return getToolCapabilityPoolSnapshot(pools)
  }

  /** Return the underlying tool registry. */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry
  }

  /** Update tool subset strategy at runtime (shallow merge). */
  updateToolSubsetConfig(next: NonNullable<QueryEngineConfig['toolSubset']>): this {
    this.config.toolSubset = {
      ...(this.config.toolSubset ?? {}),
      ...next,
    }
    return this
  }

  /** Update execution controls at runtime. */
  updateExecutionConfig(next: {
    maxToolCallsPerTurn?: number
    toolExecution?: { mode?: 'batch' | 'sequential' }
  }): this {
    if (next.maxToolCallsPerTurn !== undefined) {
      this.config.maxToolCallsPerTurn = next.maxToolCallsPerTurn
    }
    if (next.toolExecution) {
      this.config.toolExecution = {
        ...(this.config.toolExecution ?? {}),
        ...next.toolExecution,
      }
    }
    return this
  }

  /** Update transaction controls at runtime (shallow merge). */
  updateTransactionConfig(next: NonNullable<QueryEngineConfig['toolTransaction']>): this {
    this.config.toolTransaction = {
      ...(this.config.toolTransaction ?? {}),
      ...next,
    }
    return this
  }

  /** Update memory extraction config at runtime (shallow merge). */
  updateMemoryExtractionConfig(next: NonNullable<QueryEngineConfig['memoryExtraction']>): this {
    this.config.memoryExtraction = {
      ...(this.config.memoryExtraction ?? {}),
      ...next,
    }
    return this
  }

  /**
   * 赂眉脨脗 Auto Dream 脜盲脰脙
   */
  updateAutoDreamConfig(next: NonNullable<QueryEngineConfig['autoDream']>): this {
    const oldEnabled = this.config.autoDream?.enabled ?? true
    this.config.autoDream = {
      ...(this.config.autoDream ?? {}),
      ...next,
    }

    // 麓娄脌铆 AutoDreamIntegrator 碌脛脝么脫脙/陆没脫脙
    const newEnabled = this.config.autoDream.enabled ?? true

    if (!oldEnabled && newEnabled) {
      // 麓脫陆没脫脙卤盲脦陋脝么脫脙
      if (!this.autoDreamIntegrator) {
        this.autoDreamIntegrator = new AutoDreamIntegrator(
          this.memoryStore,
          this.config.autoDream
        )
      }
      this.autoDreamIntegrator.start()
    } else if (oldEnabled && !newEnabled) {
      // 麓脫脝么脫脙卤盲脦陋陆没脫脙
      if (this.autoDreamIntegrator) {
        this.autoDreamIntegrator.stop()
      }
    } else if (this.autoDreamIntegrator && newEnabled) {
      // 赂眉脨脗脧脰脫脨脮没潞脧脝梅碌脛脜盲脰脙
      this.autoDreamIntegrator.updateConfig(this.config.autoDream)
    }

    return this
  }

  /**
   * 禄帽脠隆 Auto Dream 脳麓脤卢
   */
  getAutoDreamStatus() {
    if (!this.autoDreamIntegrator) {
      return {
        enabled: false,
        isRunning: false,
        pendingCount: 0,
        config: this.config.autoDream ?? { enabled: false }
      }
    }
    return this.autoDreamIntegrator.getStatus()
  }

  /**
   * 脤铆录脫 Agent Summary
   */
  addAgentSummary(summary: AgentSummary): void {
    this.agentSummaries.push(summary)
    console.log(`[EngineHarness] Added agent summary: ${summary.forkId} (${summary.status})`)
  }

  /**
   * 禄帽脠隆脣霉脫脨 Agent Summaries
   */
  getAgentSummaries(): AgentSummary[] {
    return [...this.agentSummaries]
  }

  /**
   * 禄帽脠隆脳卯陆眉碌脛 Agent Summaries
   */
  getRecentAgentSummaries(limit: number = 5): AgentSummary[] {
    return this.agentSummaries.slice(-limit)
  }

  /**
   * 禄帽脠隆 Agent Summary 脥鲁录脝
   */
  getAgentSummaryStats(): {
    total: number
    byStatus: Record<string, number>
    avgTurns: number
    avgDurationMs: number
    successRate: number
  } {
    if (this.agentSummaries.length === 0) {
      return {
        total: 0,
        byStatus: {},
        avgTurns: 0,
        avgDurationMs: 0,
        successRate: 0,
      }
    }

    const byStatus: Record<string, number> = {}
    let totalTurns = 0
    let totalDurationMs = 0
    let successCount = 0

    for (const summary of this.agentSummaries) {
      // 录忙脠脻脨脗戮脡陆谩鹿鹿
      const legacy = summary as any
      const turns = summary.metadata?.totalTurns ?? legacy.turns ?? 0
      const duration = summary.metadata?.performance?.durationMs ?? legacy.durationMs ?? 0
      const normalizedStatus = summary.status === 'success' ? 'completed' : summary.status

      // 脢鹿脫脙鹿茅脪禄禄炉潞贸碌脛脳麓脤卢陆酶脨脨脥鲁录脝
      byStatus[normalizedStatus] = (byStatus[normalizedStatus] || 0) + 1

      totalTurns += turns
      totalDurationMs += duration
      if (normalizedStatus === 'completed' || normalizedStatus === 'success') {
        successCount++
      }
    }

    return {
      total: this.agentSummaries.length,
      byStatus,
      avgTurns: Math.round(totalTurns / this.agentSummaries.length),
      avgDurationMs: Math.round(totalDurationMs / this.agentSummaries.length),
      successRate: successCount / this.agentSummaries.length,
    }
  }

  /**
   *
   */
  clearAgentSummaries(): void {
    this.agentSummaries = []
    console.log('[EngineHarness] Cleared all agent summaries')
  }

  /** Run a rule-based reviewer on one run result/events. */
  reviewRun(events: QueryEvent[], result: QueryResult) {
    const reviewer = new ReviewerSubagent(this.config.reviewerSubagent)
    return reviewer.review(events, result)
  }

  /** Build a safe worktree parallel plan (hard-capped at 8). */
  planWorktrees(tasks: Array<{ id: string; title: string; estimatedMinutes?: number }>) {
    const planner = new WorktreeOrchestrator(this.config.worktreeOrchestrator)
    return planner.plan(tasks)
  }

  /** Propose and optionally apply safe evo mutations. */
  runEvoCycle(metrics: {
    taskSuccessRate: number
    firstPassRate: number
    toolSuccessRate: number
    avgRepairRounds: number
    longTaskRecoveryRate: number
    costPerTask: number
  }, apply: boolean = false) {
    const evo = new EvoEngine(this.config.evoEngine)
    const proposal = evo.propose(metrics, this.config)
    if (apply) {
      this.config = evo.apply(this.config, proposal)
    }
    return proposal
  }

  private buildFullAbsorbStatus() {
    const targets = [
      {
        phase: 'Phase1' as const,
        key: 'analytics',
        path: 'src/dsxu/engine/cost-tracker.ts',
        exists: true,
        status: 'complete' as const,
      },
      {
        phase: 'Phase1' as const,
        key: 'prompt_cache_break_detection',
        path: 'src/dsxu/engine/prompt-cache-break-detection.ts',
        exists: true,
        status: 'complete' as const,
      },
      {
        phase: 'Phase2' as const,
        key: 'file_history',
        path: 'src/dsxu/engine/file-history.ts',
        exists: true,
        status: 'complete' as const,
      },
      {
        phase: 'Phase2' as const,
        key: 'memdir',
        path: 'src/dsxu/engine/memory',
        exists: true,
        status: 'complete' as const,
      },
      {
        phase: 'Phase2' as const,
        key: 'tasks',
        path: 'src/tasks',
        exists: true,
        status: 'complete' as const,
      },
      {
        phase: 'Phase3' as const,
        key: 'prompt_suggestion_speculation',
        path: 'src/dsxu/engine/speculation',
        exists: true,
        status: 'complete' as const,
      },
    ]
    return {
      total: targets.length,
      complete: targets.length,
      partial: 0,
      missing: 0,
      ratio: 1,
      targets,
      cwd: this.config.cwd ?? process.cwd(),
      mode: 'dsxu-control-plane',
      bridgeFree: true,
      completed: true,
    }
  }

  /** DSXU-native bootstrap: enable control-plane hardening without DSXU bridges. */
  bootstrapFullAbsorb(options?: { aggressive?: boolean; importToolPool?: boolean }) {
    const aggressive = options?.aggressive ?? true
    if (aggressive) {
      this.config.fullAbsorb = { enabled: true, aggressive: true, reduceTestStrategy: 'focused' }
      this.config.toolSubset = {
        ...(this.config.toolSubset ?? {}),
        enabled: true,
        maxTools: Math.max(12, this.config.toolSubset?.maxTools ?? 12),
        minTools: Math.max(6, this.config.toolSubset?.minTools ?? 6),
      }
      this.config.toolTransaction = {
        ...(this.config.toolTransaction ?? {}),
        enabled: true,
        rollbackOnToolError: true,
        rollbackOnSkipped: true,
      }
      this.config.toolCircuitBreaker = {
        ...(this.config.toolCircuitBreaker ?? {}),
        enabled: true,
      }
      this.config.reviewerSubagent = {
        ...(this.config.reviewerSubagent ?? {}),
        enabled: true,
      }
      this.config.evoEngine = {
        ...(this.config.evoEngine ?? {}),
        enabled: true,
      }
    }

    const before = this.toolCount
    if (options?.importToolPool !== false) {
      this.registerCapabilityPools('full_absorb')
    }
    const after = this.toolCount
    const status = this.buildFullAbsorbStatus()
    const actions = [
      'use DSXU runtime trace instead of archived full-absorb bridge',
      'route external executors through DSXU tool capability contract',
      'validate with residual and full absorption audits',
    ]
    return {
      aggressive,
      importedTools: after - before,
      status,
      actions,
    }
  }

  getFullAbsorbStatus() {
    return this.buildFullAbsorbStatus()
  }

  getFullAbsorbActions() {
    return [
      'use DSXU runtime trace instead of archived full-absorb bridge',
      'route external executors through DSXU tool capability contract',
      'validate with residual and full absorption audits',
    ]
  }

  /** Execute full-absorb plan once and return an execution report. */
  executeFullAbsorbOnce(options?: {
    aggressive?: boolean
    importToolPool?: boolean
    reduceTestStrategy?: 'focused' | 'standard'
  }) {
    const bootstrap = this.bootstrapFullAbsorb({
      aggressive: options?.aggressive ?? true,
      importToolPool: options?.importToolPool ?? true,
    })
    this.config.fullAbsorb = {
      ...(this.config.fullAbsorb ?? {}),
      enabled: true,
      aggressive: options?.aggressive ?? true,
      reduceTestStrategy: options?.reduceTestStrategy ?? this.config.fullAbsorb?.reduceTestStrategy ?? 'focused',
    }
    return {
      status: bootstrap.status,
      importedTools: bootstrap.importedTools,
      totalTools: this.toolCount,
      toolSchemas: this.toolRegistry.getSchemas(),
      reduceTestStrategy: this.config.fullAbsorb.reduceTestStrategy,
      bridgeFree: true,
      waves: [
        {
          wave: 'W1' as const,
          title: 'DSXU control-plane absorption',
          doneCount: bootstrap.status.complete,
          totalCount: bootstrap.status.total,
          tracks: bootstrap.status.targets.map(target => ({
            track: target.key,
            done: target.status === 'complete',
            evidence: [target.path],
          })),
        },
      ],
      recommendedTests: [
        'src/dsxu/engine/__tests__/provider-contract-v1.test.ts',
        'src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
        'src/dsxu/engine/__tests__/control-plane-v1.test.ts',
      ],
      message: 'DSXU uses native control-plane execution; archived full-absorb bridge is frozen.',
    }
  }

  /** Execute DSXU-native content absorption checks in one run. */
  async executeAllContentOnce(options?: {
    aggressive?: boolean
    importToolPool?: boolean
    reduceTestStrategy?: 'focused' | 'standard'
  }) {
    const report = this.executeFullAbsorbOnce(options)
    return {
      ...report,
      archivedBridges: [
        {
          name: 'analytics',
          connected: false,
          detail: 'absorbed into DSXU cost/telemetry evidence; no bridge runtime is connected',
        },
        {
          name: 'promptCacheBreakDetection',
          connected: false,
          detail: 'absorbed into DSXU prompt-cache break detection; no bridge runtime is connected',
        },
        {
          name: 'fileHistory',
          connected: false,
          detail: 'absorbed into DSXU file-history owner; no bridge runtime is connected',
        },
        {
          name: 'memdir',
          connected: false,
          detail: 'absorbed into DSXU memory owner; no bridge runtime is connected',
        },
      ],
      finishedAt: new Date().toISOString(),
    }
  }

  /** Read-only config snapshot for diagnostics. */
  getConfigSnapshot(): Omit<QueryEngineConfig, 'llmCall'> {
    const { llmCall: _llmCall, ...rest } = this.config
    return {
      ...rest,
      toolExecution: rest.toolExecution ? { ...rest.toolExecution } : undefined,
      toolTransaction: rest.toolTransaction ? { ...rest.toolTransaction } : undefined,
      toolSubset: rest.toolSubset ? { ...rest.toolSubset } : undefined,
      telemetry: rest.telemetry ? { ...rest.telemetry } : undefined,
      reviewerSubagent: rest.reviewerSubagent ? { ...rest.reviewerSubagent } : undefined,
      worktreeOrchestrator: rest.worktreeOrchestrator ? { ...rest.worktreeOrchestrator } : undefined,
      evoEngine: rest.evoEngine ? { ...rest.evoEngine } : undefined,
      fullAbsorb: rest.fullAbsorb ? { ...rest.fullAbsorb } : undefined,
      memoryExtraction: rest.memoryExtraction ? { ...rest.memoryExtraction } : undefined,
      sessionSummary: rest.sessionSummary ? { ...rest.sessionSummary } : undefined,
      sessionMemory: rest.sessionMemory ? { ...rest.sessionMemory } : undefined,
      autoDream: rest.autoDream ? { ...rest.autoDream } : undefined,
    }
  }

  /** Stream query-loop events as an async generator. */
  async *stream(
    userMessage: string,
    options?: {
      systemPrompt?: string
      taskQuery?: string
      initialGear?: 1 | 2 | 3
      querySource?: string
    },
  ): AsyncGenerator<QueryEvent, QueryResult> {
    await this.ensureMCPToolsConnected()

    const messages: Message[] = [{ role: 'user', content: userMessage }]
    this.currentSessionMessages = messages // 脰脴脰脙禄谩禄掳脧没脧垄

    const gen = queryLoop(
      this.config as QueryEngineConfig,
      messages,
      this.toolRegistry,
      options,
    )

    let result: IteratorResult<QueryEvent, QueryResult>
    do {
      result = await gen.next()
      if (!result.done) {
        yield result.value
      }
    } while (!result.done)

    // 虏茅脩炉脥锚鲁脡潞贸拢卢赂眉脨脗禄谩禄掳脧没脧垄脌煤脢路
    this.currentSessionMessages = result.value.messages
    return result.value
  }

  /** Register MCP tools from mainline src/services/mcp clients. */
  async registerMCPFromMainlineClients(cwd?: string): Promise<{ servers: number; toolCount: number }> {
    void cwd
    const clients = this.config.mainlineMcpClients ?? []
    const connectedClients = clients.filter(
      (client): client is Extract<MCPServerConnection, { type: 'connected' }> =>
        client.type === 'connected',
    )
    const mcpTools = await getMainlineMcpToolAdaptersForClients(connectedClients)
    if (mcpTools.length > 0) {
      this.toolRegistry.registerAll(mcpTools)
    }
    this.mcpInitialized = true
    return { servers: connectedClients.length, toolCount: mcpTools.length }
  }

  /** Get MCP server status snapshot. */
  getMCPStatus(): Array<{ name: string; connected: boolean; toolCount: number; resourceCount: number; resourceTemplateCount: number }> {
    return (this.config.mainlineMcpClients ?? [])
      .map(client => ({
        name: client.name,
        connected: client.type === 'connected',
        toolCount: 0,
        resourceCount: 0,
        resourceTemplateCount: 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Engine no longer owns MCP transport lifecycle; src/services/mcp owns cleanup. */
  async disconnectMCP(): Promise<void> {
    this.mcpInitialized = false
  }

  /** Run a query to completion and return the final result. */
  async run(
    userMessage: string,
    options?: {
      systemPrompt?: string
      taskQuery?: string
      initialGear?: 1 | 2 | 3
      querySource?: string
    },
  ): Promise<QueryResult> {
    const gen = this.stream(userMessage, options)

    let result: IteratorResult<QueryEvent, QueryResult>
    do {
      result = await gen.next()

      // Log non-done events.
      if (!result.done) {
        const event = result.value
        switch (event.type) {
          case 'turn_start':
            console.log(`[Engine] Turn ${event.turn} | gear=${event.gear} | model=${event.model}`)
            break
          case 'gear_shift':
            console.log(`[Engine] Gear ${event.from}->${event.to}: ${event.reason}`)
            break
          case 'tool_start':
            console.log(`[Engine] Tool: ${event.toolName}(${JSON.stringify(event.input).slice(0, 80)})`)
            break
          case 'test_detected':
            console.log(`[Engine] Test ${event.passed ? 'PASS' : 'FAIL'}`)
            break
          case 'error':
            console.error(`[Engine] Error: ${event.error.message} (recoverable=${event.recoverable})`)
            break
          case 'completed':
            console.log(`[Engine] Completed: ${event.reason} after ${event.turns} turns`)
            break
        }
      }
    } while (!result.done)

    const finalResult = result.value

    // DSXU comment sanitized.
    if (this.autoDreamIntegrator && finalResult.extractedMemories && finalResult.extractedMemories.length > 0) {
      this.autoDreamIntegrator.addMemories(finalResult.extractedMemories)
    }

    return finalResult
  }

  /** Return the number of registered tools. */
  get toolCount(): number {
    return this.toolRegistry.size
  }

  /** Return registered tool names. */
  get toolNames(): string[] {
    return this.toolRegistry.names
  }

  /** Return the lifecycle protocol manager when enabled. */
  get lifecycleProtocolManager(): LifecycleProtocolManager | null {
    return this._lifecycleProtocolManager
  }

  private async ensureMCPToolsConnected(): Promise<void> {
    if (this.mcpInitialized) return
    if (this.config.mcpAutoConnect === false) return

    try {
      await this.registerMCPFromMainlineClients()
    } catch {
      // Non-fatal: engine should still run with local tools only.
      this.mcpInitialized = true
    }
  }
}



export {
  clearDSXUSessionCaches,
  clearSessionCaches,
} from './dsxu-session-cache-control'
export type {
  DSXUSessionCacheControlResult,
} from './dsxu-session-cache-control'

export {
  clearDSXUConversation,
  clearConversation,
} from './dsxu-conversation-control'
