/**
 * DSxu Query Engine 鈥?璺嚎 B 鐨勫績鑴? *
 * 鍗曟ā鍨?tool use loop锛堝 Claude 鏋舵瀯锛? DSxu 涓夊ぇ鐙湁鑳藉姏锛? * - 姝ラ绾т笁妗ｅ彉閫? * - MSA 涓夌骇璁板繂
 * - 娴嬭瘯椹卞姩鑷不锛圫.1锛? *
 * 鐢ㄦ硶锛? *   import { QueryEngine } from './engine'
 *
 *   const engine = new QueryEngine({
 *     llmCall: createProxyLLMCall(),
 *   })
 *   engine.registerTool({ name: 'Bash', ... })
 *
 *   const result = await engine.run('甯垜淇 auth.ts 鐨?bug')
 *   // 鎴栫敤 async generator 瀹炴椂鐩戝惉锛? *   for await (const event of engine.stream('甯垜淇 auth.ts 鐨?bug')) {
 *     console.log(event.type)
 *   }
 */

export { ToolRegistry } from './tool-registry'
export { createGearBox } from './gear-box'
export { queryLoop, runQuery } from './query-loop'
export { createProxyLLMCall, createDirectLLMCall, createMockLLMCall } from './llm-adapter'
export { getCoreTools, getReadOnlyTools, BashTool, ReadTool, WriteTool, EditTool, GrepTool, GlobTool } from './builtin-tools'
export { APIService } from './api-service'
export type { APIServiceConfig, APIBackend } from './api-service'
export { CircuitBreaker } from './circuit-breaker'
export type { CircuitBreakerConfig, CircuitBreakerSnapshot, CircuitBreakerState } from './circuit-breaker'
export { microCompact, fullCompact, autoCompactIfNeeded } from './compact'
export type { CompactConfig, CompactResult } from './compact'
export { PermissionManager, classifyBashCommand, getToolSafetyLevel, withPermissions } from './permissions'
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
export { WebFetchTool, WebSearchTool, TodoWriteTool, AskUserTool, RewindFilesTool, getExtendedTools, getAllTools, setAskUserCallback } from './extended-tools'
export { createFork, createForkAgentTool, ForkAgentTool, getActiveForkCount, extractStructuredSummary } from './forked-agent'
export type { ForkConfig, ForkResult, AgentSummary } from './forked-agent'
export { LSPTool, parseTscOutput, collectProjectDiagnostics } from './lsp-tool'
export type { Diagnostic } from './lsp-tool'
export { MCPManager, MCPConnection } from './mcp-client'
export type { MCPServerConfig, MCPTool, MCPResource, MCPResourceTemplate } from './mcp-client'
export { estimateTokens, estimateMessageTokens, estimateAllTokens, calculateTokenBudget, tokenAccuracyMonitor, calibrateFromResponse } from './token-estimator'
export type { TokenBudget, TokenAccuracyStats } from './token-estimator'
export { DEEPSEEK_CONTEXT_WINDOW, DEEPSEEK_MAX_OUTPUT_TOKENS, DEFAULT_SAFETY_MARGIN, NIGHT_SAFETY_MARGIN, isBeijingOffPeak, getSafetyMargin, getModelContextLimit, getModelMaxOutputTokens, clampMaxTokensToBudget } from './model-limits'
export { buildProxyBudgetGuard, summarizeBudgetMessages, advanceBudgetGuardState, resetBudgetGuardState, buildBudgetIncidentDetails, shouldBlockProxyRequest, buildLocalBudgetExceededError, buildBudgetKillSwitchPayload } from './proxy-budget-guard'
export type { ProxyBudgetBase, ProxyBudgetGuard, ProxyBudgetGuardState, ProxyBudgetGuardTransition, BudgetMessageSummary, BudgetKillSwitchPayload } from './proxy-budget-guard'
export { resolveAPIMicrocompactBridge } from './api-microcompact-bridge'
export type { APIMicrocompactBridgeOptions, APIMicrocompactBridgeResult } from './api-microcompact-bridge'
export { extractMemories, extractFromCompactSummary, MemoryStore, AutoDreamIntegrator } from './memory-extractor'
export type { Memory, ExtractionResult } from './memory-extractor'
export { SkillsAdapter, createSkillsAdapter } from './skills-adapter'
export type { SkillsAdapterConfig } from './skills-adapter'
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
export { BlastRadiusTool, buildDepGraph, computeBlastRadius, parseImports, parseExports, isTestFile, collectSourceFiles, quickBlastRadius } from './blast-radius'
export type { DepGraph, DepNode, BlastResult } from './blast-radius'
export { AccessibilityTreeTool, parseHTMLToA11yTree, renderA11yTree, countA11yNodes, checkA11yIssues } from './accessibility-tree'
export type { A11yNode } from './accessibility-tree'
export { withRetry, isRetryableError, calculateDelay, RateLimiter, withRateLimitAndRetry } from './retry'
export type { RetryConfig, RetryResult, RateLimiterConfig } from './retry'
export { executeToolsParallel, ToolResultCache } from './parallel-tools'
export type { ParallelConfig, ToolExecResult, ToolCacheConfig } from './parallel-tools'
export { CostTracker, estimateCost, MODEL_PRICING } from './cost-tracker'
export type { CostEntry, CostBudget, CostAlert, ModelPricing } from './cost-tracker'
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
export { scanFullAbsorbStatus, buildFullAbsorbActions } from './full-absorb'
export { executeFullAbsorbPlan } from './full-absorb-executor'
export { connectLegacyFullAbsorbBridges } from './legacy-full-bridge'
export { checkCommand, checkApiKey, checkProjectConfig, checkNodeVersion, runDoctor, formatDoctorReport, getVersionInfo, getAuth, validateApiKey, VERSION } from './doctor'
export type { HealthCheck, DoctorReport, AuthConfig } from './doctor'
export { TaskQueue, WorkspaceManager, analyzeWorkspace, discoverProjects } from './task-queue'
export type { Task, TaskStatus, WorkspaceInfo } from './task-queue'
export { CodingTaskRunner } from './coding-task-runner'
export type { CodingTaskSpec, CodingTaskRunRecord } from './coding-task-runner'
export { getToolCapabilityPool, getToolCapabilityPoolSnapshot } from './tool-capability-pool'
export type { ToolCapabilityPoolName } from './tool-capability-pool'
export { formatTokens, formatCost, formatDuration, formatBytes, truncate, formatTable, simplifyMarkdown, validateFilePath, validateJSON, checkInjection, sanitizeInput, initProject, PluginManager } from './formatters'
export type { InitResult, PluginManifest, PluginRegistration } from './formatters'
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
import { createProxyLLMCall } from './llm-adapter'
import { MCPManager } from './mcp-client'
import { ReviewerSubagent } from './reviewer-subagent'
import { WorktreeOrchestrator } from './worktree-orchestrator'
import { EvoEngine } from './evo-engine'
import { scanFullAbsorbStatus, buildFullAbsorbActions } from './full-absorb'
import { executeFullAbsorbPlan } from './full-absorb-executor'
import { connectLegacyFullAbsorbBridges } from './legacy-full-bridge'
import { getAllTools } from './extended-tools'
import { getDebugTools } from './debug-tools'
import { BlastRadiusTool } from './blast-radius'
import { AccessibilityTreeTool } from './accessibility-tree'
import {
  getToolCapabilityPool,
  getToolCapabilityPoolSnapshot,
} from './tool-capability-pool'
import type { ToolCapabilityPoolName } from './tool-capability-pool'

/**
 * DSxu Query Engine 鈥?楂樺眰 API
 */
export class QueryEngine {
  private config: QueryEngineConfig
  private toolRegistry: ToolRegistry
  private mcpManager: MCPManager
  private mcpInitialized = false
  private memoryStore: MemoryStore
  private autoDreamIntegrator: AutoDreamIntegrator | null = null
  /** Skills适配器 */
  private skillsAdapter: SkillsAdapter | null = null
  /** Speculation管理器 */
  private speculationManager: SpeculationManager | null = null
  /** Agent Summaries 收集器 */
  private agentSummaries: AgentSummary[] = []
  /** 当前会话消息历史 */
  private currentSessionMessages: Message[] = []

  constructor(config?: Partial<QueryEngineConfig>) {
    this.config = {
      llmCall: config?.llmCall ?? createProxyLLMCall(),
      maxTurns: config?.maxTurns ?? 50,
      maxConsecutiveErrors: config?.maxConsecutiveErrors ?? 10,
      cwd: config?.cwd ?? process.cwd(),
      abortSignal: config?.abortSignal,
      priority: config?.priority ?? 2,
      priorityConfig: config?.priorityConfig,
      mcpAutoConnect: config?.mcpAutoConnect ?? true,
      maxToolCallsPerTurn: config?.maxToolCallsPerTurn ?? 12,
      toolExecution: config?.toolExecution ?? { mode: 'batch' },
      toolCircuitBreaker: config?.toolCircuitBreaker ?? { enabled: false },
      toolTransaction: config?.toolTransaction ?? { enabled: false, rollbackOnToolError: true, maxTrackedFilesPerTurn: 32 },
      toolSubset: config?.toolSubset ?? { enabled: true, maxTools: 12, minTools: 6 },
      telemetry: config?.telemetry,
      reviewerSubagent: config?.reviewerSubagent ?? { enabled: false, minScoreToApprove: 75, failOnRollback: true, failOnCircuitSkipThreshold: 2 },
      worktreeOrchestrator: config?.worktreeOrchestrator ?? { maxParallel: 2, branchPrefix: 'codex/wt' },
      evoEngine: config?.evoEngine ?? { enabled: false, maxMutationsPerRun: 3, allowModelSwitch: false },
      fullAbsorb: config?.fullAbsorb ?? { enabled: false, aggressive: false, reduceTestStrategy: 'minimal' },
      memoryExtraction: config?.memoryExtraction ?? { enabled: true, qualityThreshold: 0.6 },
      sessionSummary: config?.sessionSummary ?? { enabled: true, updateInterval: 10, maxLength: 1000 },
      sessionMemory: config?.sessionMemory ?? { enabled: true, updateInterval: 5, minImportance: 0.3, maxNotes: 20, autoGenerate: true, summaryMaxLength: 500 },
      autoDream: config?.autoDream ?? { enabled: true, intervalMs: 30000, batchSize: 10, qualityThreshold: 0.7 },
      skills: config?.skills ?? { enabled: true, autoRegister: true, excludeSkills: [], timeout: 30000, debug: false },
      speculation: config?.speculation ?? { enabled: false, maxParallel: 3, timeoutMs: 30000, maxSpeculations: 5, debug: false, triggerInterval: 5, minConfidence: 0.5 },
    }
    this.toolRegistry = new ToolRegistry()
    this.mcpManager = new MCPManager()

    // 初始化 MemoryStore 和 AutoDreamIntegrator
    this.memoryStore = new MemoryStore(config?.memoryExtraction?.persistCallback)

    if (this.config.autoDream?.enabled) {
      this.autoDreamIntegrator = new AutoDreamIntegrator(
        this.memoryStore,
        this.config.autoDream
      )
      this.autoDreamIntegrator.start()
    }

    // 初始化Skills适配器（如果启用）
    if (this.config.skills?.enabled) {
      // 确保Skills系统已初始化
      this.ensureSkillsInitialized()

      this.skillsAdapter = createSkillsAdapter(this.config.skills)

      // 自动注册Skills
      if (this.config.skills.autoRegister) {
        const skillTools = this.skillsAdapter.registerAllSkills()
        this.toolRegistry.registerAll(skillTools)
        console.log(`[QueryEngine] Registered ${skillTools.length} skills`)
      }
    }

    // 初始化Speculation管理器（如果启用）
    if (this.config.speculation?.enabled) {
      this.speculationManager = createSpeculationManager(this.config.speculation)
      console.log('[QueryEngine] Speculation system initialized')
    }
  }

  /**
   * 确保Skills系统已初始化
   */
  private ensureSkillsInitialized(): void {
    try {
      // 动态导入并初始化Skills系统
      const { initBundledSkills } = require('../../skills/bundled/index.js')
      initBundledSkills()
    } catch (error: any) {
      console.warn(`[QueryEngine] Failed to initialize skills system: ${error.message}`)
    }
  }

  /**
   * 启用Skills系统支持
   *
   * 如果构造函数中未启用，可以手动调用此方法启用Skills系统
   */
  enableSkills(): this {
    if (this.skillsAdapter) {
      console.log('[QueryEngine] Skills system already enabled')
      return this
    }

    // 确保配置存在
    if (!this.config.skills) {
      this.config.skills = { enabled: true, autoRegister: true }
    } else {
      this.config.skills.enabled = true
    }

    this.skillsAdapter = createSkillsAdapter(this.config.skills)

    // 自动注册Skills
    if (this.config.skills.autoRegister) {
      const skillTools = this.skillsAdapter.registerAllSkills()
      this.toolRegistry.registerAll(skillTools)
      console.log(`[QueryEngine] Registered ${skillTools.length} skills`)
    }

    return this
  }

  /**
   * 启用Speculation系统支持
   */
  enableSpeculation(): this {
    if (this.speculationManager) {
      console.log('[QueryEngine] Speculation system already enabled')
      return this
    }

    // 确保配置存在
    if (!this.config.speculation) {
      this.config.speculation = { enabled: true, maxParallel: 3, timeoutMs: 30000, maxSpeculations: 5 }
    } else {
      this.config.speculation.enabled = true
    }

    this.speculationManager = createSpeculationManager(this.config.speculation)
    console.log('[QueryEngine] Speculation system enabled')

    return this
  }

  /**
   * 禁用Speculation系统支持
   */
  disableSpeculation(): this {
    if (!this.speculationManager) {
      console.log('[QueryEngine] Speculation system not enabled')
      return this
    }

    this.speculationManager = null
    if (this.config.speculation) {
      this.config.speculation.enabled = false
    }
    console.log('[QueryEngine] Speculation system disabled')

    return this
  }

  /**
   * 注册Speculation策略
   */
  registerSpeculationStrategy(strategy: SpeculationStrategy): this {
    if (!this.speculationManager) {
      throw new Error('Speculation system is not enabled')
    }

    this.speculationManager.registerStrategy(strategy)
    console.log(`[QueryEngine] Registered speculation strategy: ${strategy.name}`)

    return this
  }

  /**
   * 获取Speculation状态
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
   * 执行Speculation
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
   * 禁用Skills系统支持
   */
  disableSkills(): this {
    if (!this.skillsAdapter) {
      console.log('[QueryEngine] Skills system not enabled')
      return this
    }

    // 从工具注册表中移除所有技能工具
    const skillTools = this.getSkillTools()
    for (const tool of skillTools) {
      this.toolRegistry.unregister(tool.name)
    }

    this.skillsAdapter = null
    if (this.config.skills) {
      this.config.skills.enabled = false
    }

    console.log(`[QueryEngine] Disabled skills system, removed ${skillTools.length} skills`)
    return this
  }

  /**
   * 获取已注册的Skills工具
   */
  getSkillTools(): ToolDefinition[] {
    if (!this.skillsAdapter) {
      return []
    }
    return this.skillsAdapter.getSkillTools()
  }

  /**
   * 获取模型配置
   */
  getModelConfig(modelName?: string): DeepSeekModelConfig {
    const model = modelName || 'deepseek-chat'
    return getModelConfig(model)
  }

  /**
   * 检查是否为DeepSeek原生模型
   */
  isDeepSeekNativeModel(modelName: string): boolean {
    return isDeepSeekNativeModel(modelName)
  }

  /**
   * 获取所有可用的DeepSeek模型
   */
  getAvailableModels(): string[] {
    return getAvailableModels()
  }

  /**
   * 根据任务类型推荐模型
   */
  recommendModelForTask(taskType: string): DeepSeekModelConfig {
    return recommendModelForTask(taskType)
  }

  /**
   * 获取特定技能工具
   */
  getSkillTool(skillName: string): ToolDefinition | undefined {
    if (!this.skillsAdapter) {
      return undefined
    }
    return this.skillsAdapter.getSkillTool(skillName)
  }

  /**
   * 检查技能是否已注册
   */
  hasSkill(skillName: string): boolean {
    if (!this.skillsAdapter) {
      return false
    }
    return this.skillsAdapter.hasSkill(skillName)
  }

  /**
   * 执行特定技能
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
   * 获取Skills系统状态
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
   * 更新Skills配置
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

    console.log(`[QueryEngine] Updated skills config:`, config)
    return this
  }

  /**
   * 启用 ForkAgent 工具
   *
   * 注意：需要在运行查询前调用此方法
   */
  enableForkAgent(forkConfig?: ForkConfig): this {
    const forkTool = createForkAgentTool(
      this.config.llmCall,
      this.toolRegistry,
      () => this.currentSessionMessages, // 使用当前会话消息
      forkConfig,
      (summary) => this.addAgentSummary(summary)
    )
    this.toolRegistry.register(forkTool)
    console.log('[QueryEngine] ForkAgent tool enabled')
    return this
  }

  /** 娉ㄥ唽宸ュ叿 */
  registerTool(tool: ToolDefinition): this {
    this.toolRegistry.register(tool)
    return this
  }

  /** 鎵归噺娉ㄥ唽宸ュ叿 */
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

  /** 鑾峰彇宸ュ叿娉ㄥ唽琛?*/
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
   * 更新 Auto Dream 配置
   */
  updateAutoDreamConfig(next: NonNullable<QueryEngineConfig['autoDream']>): this {
    const oldEnabled = this.config.autoDream?.enabled ?? true
    this.config.autoDream = {
      ...(this.config.autoDream ?? {}),
      ...next,
    }

    // 处理 AutoDreamIntegrator 的启用/禁用
    const newEnabled = this.config.autoDream.enabled ?? true

    if (!oldEnabled && newEnabled) {
      // 从禁用变为启用
      if (!this.autoDreamIntegrator) {
        this.autoDreamIntegrator = new AutoDreamIntegrator(
          this.memoryStore,
          this.config.autoDream
        )
      }
      this.autoDreamIntegrator.start()
    } else if (oldEnabled && !newEnabled) {
      // 从启用变为禁用
      if (this.autoDreamIntegrator) {
        this.autoDreamIntegrator.stop()
      }
    } else if (this.autoDreamIntegrator && newEnabled) {
      // 更新现有整合器的配置
      this.autoDreamIntegrator.updateConfig(this.config.autoDream)
    }

    return this
  }

  /**
   * 获取 Auto Dream 状态
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
   * 添加 Agent Summary
   */
  addAgentSummary(summary: AgentSummary): void {
    this.agentSummaries.push(summary)
    console.log(`[QueryEngine] Added agent summary: ${summary.forkId} (${summary.status})`)
  }

  /**
   * 获取所有 Agent Summaries
   */
  getAgentSummaries(): AgentSummary[] {
    return [...this.agentSummaries]
  }

  /**
   * 获取最近的 Agent Summaries
   */
  getRecentAgentSummaries(limit: number = 5): AgentSummary[] {
    return this.agentSummaries.slice(-limit)
  }

  /**
   * 获取 Agent Summary 统计
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
      // 兼容新旧结构
      const legacy = summary as any
      const turns = summary.metadata?.totalTurns ?? legacy.turns ?? 0
      const duration = summary.metadata?.performance?.durationMs ?? legacy.durationMs ?? 0
      const normalizedStatus = summary.status === 'success' ? 'completed' : summary.status

      // 使用归一化后的状态进行统计
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
   * 清空 Agent Summaries
   */
  clearAgentSummaries(): void {
    this.agentSummaries = []
    console.log('[QueryEngine] Cleared all agent summaries')
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

  /** One-shot full-absorb bootstrap: enable aggressive profile + import high-value tool pool. */
  bootstrapFullAbsorb(options?: { aggressive?: boolean; importToolPool?: boolean }) {
    const aggressive = options?.aggressive ?? true
    if (aggressive) {
      this.config.fullAbsorb = { enabled: true, aggressive: true, reduceTestStrategy: 'minimal' }
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
      this.registerTools(getAllTools())
      this.registerTools(getDebugTools())
      this.registerTool(BlastRadiusTool)
      this.registerTool(AccessibilityTreeTool)
    }
    const after = this.toolCount
    const status = scanFullAbsorbStatus(this.config.cwd ?? process.cwd())
    const actions = buildFullAbsorbActions(status)
    return {
      aggressive,
      importedTools: after - before,
      status,
      actions,
    }
  }

  getFullAbsorbStatus() {
    return scanFullAbsorbStatus(this.config.cwd ?? process.cwd())
  }

  getFullAbsorbActions() {
    return buildFullAbsorbActions(this.getFullAbsorbStatus())
  }

  /** Execute full-absorb plan once and return an execution report. */
  executeFullAbsorbOnce(options?: {
    aggressive?: boolean
    importToolPool?: boolean
    reduceTestStrategy?: 'minimal' | 'standard'
  }) {
    const bootstrap = this.bootstrapFullAbsorb({
      aggressive: options?.aggressive ?? true,
      importToolPool: options?.importToolPool ?? true,
    })
    this.config.fullAbsorb = {
      ...(this.config.fullAbsorb ?? {}),
      enabled: true,
      aggressive: options?.aggressive ?? true,
      reduceTestStrategy: options?.reduceTestStrategy ?? this.config.fullAbsorb?.reduceTestStrategy ?? 'minimal',
    }
    return executeFullAbsorbPlan({
      status: bootstrap.status,
      importedTools: bootstrap.importedTools,
      toolSchemas: this.toolRegistry.getSchemas(),
      reduceTestStrategy: this.config.fullAbsorb.reduceTestStrategy,
    })
  }

  /** Execute full content absorption including legacy service bridges in one run. */
  async executeAllContentOnce(options?: {
    aggressive?: boolean
    importToolPool?: boolean
    reduceTestStrategy?: 'minimal' | 'standard'
  }) {
    const report = this.executeFullAbsorbOnce(options)
    const legacyBridges = await connectLegacyFullAbsorbBridges(this.config)
    return {
      ...report,
      legacyBridges,
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

  /**
   * 娴佸紡杩愯 鈥?async generator锛屽疄鏃?yield 姣忎竴姝ヤ簨浠?   *
   * 鐢ㄦ硶锛?   *   for await (const event of engine.stream('fix the bug')) {
   *     if (event.type === 'gear_shift') console.log('鍗囬檷妗ｏ紒')
   *   }
   */
  async *stream(
    userMessage: string,
    options?: {
      systemPrompt?: string
      taskQuery?: string
      initialGear?: 1 | 2 | 3
    },
  ): AsyncGenerator<QueryEvent, QueryResult> {
    await this.ensureMCPToolsConnected()

    const messages: Message[] = [{ role: 'user', content: userMessage }]
    this.currentSessionMessages = messages // 重置会话消息

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

    // 查询完成后，更新会话消息历史
    this.currentSessionMessages = result.value.messages
    return result.value
  }

  /** Manually connect MCP servers from .mcp.json and register MCP tools. */
  async connectMCPFromConfig(cwd?: string): Promise<{ servers: number; toolCount: number }> {
    const targetCwd = cwd ?? this.config.cwd ?? process.cwd()
    await this.mcpManager.connectFromConfig(targetCwd)
    const mcpTools = this.mcpManager.getToolDefinitions()
    this.toolRegistry.registerAll(mcpTools)
    this.mcpInitialized = true
    return { servers: this.mcpManager.size, toolCount: mcpTools.length }
  }

  /** Get MCP server status snapshot. */
  getMCPStatus(): ReturnType<MCPManager['getStatus']> {
    return this.mcpManager.getStatus()
  }

  /** Disconnect MCP servers. */
  async disconnectMCP(): Promise<void> {
    await this.mcpManager.disconnectAll()
    this.mcpInitialized = false
  }

  /**
   * 涓€娆℃€ц繍琛?鈥?杩斿洖鏈€缁堢粨鏋?   *
   * 鐢ㄦ硶锛?   *   const result = await engine.run('fix the bug')
   *   console.log(result.finalMessage)
   */
  async run(
    userMessage: string,
    options?: Parameters<QueryEngine['stream']>[1],
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
            console.log(`[Engine] Gear ${event.from}鈫?{event.to}: ${event.reason}`)
            break
          case 'tool_start':
            console.log(`[Engine] Tool: ${event.toolName}(${JSON.stringify(event.input).slice(0, 80)})`)
            break
          case 'test_detected':
            console.log(`[Engine] Test ${event.passed ? '馃煝 PASS' : '馃敶 FAIL'}`)
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

    // 将提取的记忆传递给 AutoDreamIntegrator（如果启用）
    if (this.autoDreamIntegrator && finalResult.extractedMemories && finalResult.extractedMemories.length > 0) {
      this.autoDreamIntegrator.addMemories(finalResult.extractedMemories)
    }

    return finalResult
  }

  /** 鑾峰彇宸叉敞鍐屽伐鍏锋暟閲?*/
  get toolCount(): number {
    return this.toolRegistry.size
  }

  /** 鑾峰彇宸叉敞鍐屽伐鍏峰悕绉?*/
  get toolNames(): string[] {
    return this.toolRegistry.names
  }

  private async ensureMCPToolsConnected(): Promise<void> {
    if (this.mcpInitialized) return
    if (this.config.mcpAutoConnect === false) return

    try {
      await this.connectMCPFromConfig(this.config.cwd)
    } catch {
      // Non-fatal: engine should still run with local tools only.
      this.mcpInitialized = true
    }
  }
}


