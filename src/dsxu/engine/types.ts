import type { FileHistoryManager } from './file-history'
import type { Memory } from './memory-extractor'

/**
 * DSxu Query Engine — 类型定义
 *
 * 学 Claude 架构（单模型 tool use loop），加 DSxu 独有能力：
 * - 步骤级三档变速（每个 tool result 都能触发升降档）
 * - MSA 三级记忆注入
 * - 测试驱动自治（S.1）
 */

// ── 工具系统 ──

/** 工具的 JSON Schema 定义（发给 LLM 的） */
export interface ToolSchema {
  name: string
  description: string
  inputSchema: Record<string, any>  // JSON Schema
}

/** 工具执行结果 */
export interface ToolResult {
  toolUseId: string
  content: string
  isError: boolean
}

/** 工具执行函数签名 */
export type ToolExecuteFn = (
  name: string,
  input: Record<string, any>,
  toolUseId: string,
) => Promise<ToolResult>

/** 工具定义（注册时用） */
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, any>
  /** 执行函数 */
  execute: (input: Record<string, any>, context: ToolContext) => Promise<ToolOutput>
  /** 是否可以并发执行（默认 false） */
  concurrencySafe?: boolean
  /** 是否只读（不修改文件系统） */
  readOnly?: boolean
  /** 是否启用（动态判断） */
  isEnabled?: () => boolean
}

/** 工具执行上下文 */
export interface ToolContext {
  /** ?????? */
  cwd: string
  /** ???? ID */
  sessionId: string
  /** ???? */
  gear: 1 | 2 | 3
  /** ?? tool use ID */
  toolUseId?: string
  /** ????/???? */
  fileHistory?: FileHistoryManager
  /** ???? */
  abortSignal?: AbortSignal
}

/** 工具输出 */
export interface ToolOutput {
  /** 返回给 LLM 的内容 */
  content: string
  /** 是否为错误 */
  isError?: boolean
  /** 额外元数据（不发给 LLM） */
  meta?: Record<string, any>
}

// ── LLM 交互 ──

/** 消息角色 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

/** 通用消息 */
export interface Message {
  role: MessageRole
  content: string | ContentBlock[]
  /** assistant 消息的 tool_calls */
  toolCalls?: ToolCall[]
  /** tool 消息的 tool_call_id */
  toolCallId?: string
  /** R1 reasoning_content */
  reasoning?: string
}

/** 内容块 */
export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking'
  text?: string
  thinking?: string
  id?: string
  name?: string
  input?: Record<string, any>
  toolUseId?: string
  content?: string
  isError?: boolean
}

/** LLM 返回的工具调用 */
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

/** LLM 响应 */
export interface LLMResponse {
  content: string
  toolCalls: ToolCall[]
  reasoning?: string
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'error'
  usage: {
    inputTokens: number
    outputTokens: number
    cacheHit?: boolean
    /** Provider-reported cache read tokens (if available). */
    cacheReadTokens?: number
    /** Provider-reported cache creation/write tokens (if available). */
    cacheCreationTokens?: number
  }
}

/** LLM 调用函数签名 */
export type LLMCallFn = (
  messages: Message[],
  tools: ToolSchema[],
  options: LLMCallOptions,
) => Promise<LLMResponse>

/** DeepSeek 模型配置 */
export interface DeepSeekModelConfig {
  /** 模型名称 */
  name: string
  /** 显示名称 */
  displayName: string
  /** 上下文窗口大小 */
  contextWindow: number
  /** 最大输出token数 */
  maxOutputTokens: number
  /** 是否支持推理 */
  supportsReasoning: boolean
  /** 默认温度 */
  defaultTemperature: number
  /** 是否支持工具调用 */
  supportsTools: boolean
  /** 每百万token输入价格（USD） */
  inputPricePerMillion?: number
  /** 每百万token输出价格（USD） */
  outputPricePerMillion?: number
}

/** LLM 调用选项 */
export interface LLMCallOptions {
  model: string
  maxTokens?: number
  temperature?: number
  /** 取消信号 */
  abortSignal?: AbortSignal
  /** 模型特定配置 */
  modelConfig?: DeepSeekModelConfig
}

// ── Query Engine ──

/** Query Engine 配置 */
export interface QueryEngineConfig {
  /** LLM 调用函数（通过 proxy 或直连 DeepSeek） */
  llmCall: LLMCallFn
  /** 工具执行函数（默认用内置 ToolRegistry） */
  toolExecute?: ToolExecuteFn
  /** 最大轮次（防无限循环） */
  maxTurns?: number          // 默认 50
  /** 最大连续错误（触发 HITL） */
  maxConsecutiveErrors?: number  // 默认 10
  /** 当前工作目录 */
  cwd?: string
  /** 取消信号 */
  abortSignal?: AbortSignal
  /** 查询优先级：1=低，2=中，3=高，4=紧急 */
  priority?: 1 | 2 | 3 | 4
  /** 优先级相关配置 */
  priorityConfig?: {
    /** 是否启用优先级影响模型参数 */
    affectModelParams?: boolean
    /** 是否启用优先级影响工具选择 */
    affectToolSelection?: boolean
    /** 是否启用优先级影响预算分配 */
    affectBudgetAllocation?: boolean
    /** 温度调整映射：priority -> temperature */
    temperatureMap?: Record<1 | 2 | 3 | 4, number>
    /** 最大token调整映射：priority -> maxTokens multiplier */
    maxTokensMultiplierMap?: Record<1 | 2 | 3 | 4, number>
    /** 工具可靠性权重映射：priority -> reliability weight */
    toolReliabilityWeightMap?: Record<1 | 2 | 3 | 4, number>
  }
  /** Auto-connect MCP from .mcp.json and inject MCP tools before running. */
  mcpAutoConnect?: boolean
  /** Hard cap for tool calls executed in a single turn (default: 12). */
  maxToolCallsPerTurn?: number
  /** Tool execution mode for a turn. */
  toolExecution?: {
    mode?: 'batch' | 'sequential'
  }
  /** Per-tool circuit breaker to avoid repeatedly calling unhealthy tools. */
  toolCircuitBreaker?: {
    enabled?: boolean
    failureThreshold?: number
    successThreshold?: number
    cooldownMs?: number
  }
  /** Turn-level transaction guard for write operations. */
  toolTransaction?: {
    enabled?: boolean
    /** Roll back tracked files when any tool in the turn fails (default: true). */
    rollbackOnToolError?: boolean
    /** Whether skipped-by-circuit-breaker tool errors should trigger rollback (default: false). */
    rollbackOnSkipped?: boolean
    /** Maximum files auto-tracked in one turn (default: 32). */
    maxTrackedFilesPerTurn?: number
    /** Additional argument keys to auto-track as file paths. */
    trackArgumentKeys?: string[]
  }
  /** Tool subset retrieval to reduce prompt/tool noise per turn. */
  toolSubset?: {
    enabled?: boolean
    maxTools?: number
    minTools?: number
    alwaysInclude?: string[]
    /** Always include by wildcard patterns, e.g. "mcp__github__*" */
    alwaysIncludePatterns?: string[]
    /** Explicitly prefer these tools when selecting subset. */
    preferTools?: string[]
    /** Prefer by wildcard patterns, e.g. "mcp__github__*" */
    preferPatterns?: string[]
    /** Explicitly exclude these tools from subset selection. */
    excludeTools?: string[]
    /** Exclude by wildcard patterns, e.g. "*debug*" */
    excludePatterns?: string[]
    /** Hard cap for MCP-prefixed tools in one subset. */
    maxMcpTools?: number
    /** Hard cap for write-like tools in one subset. */
    maxWriteTools?: number
    /** Prefer read-like tools in ranking. */
    preferReadOnly?: boolean
    /** Penalize write-like tools in ranking. */
    penalizeWriteTools?: boolean
    /** Penalty value when penalizeWriteTools is enabled (default: 3). */
    writePenaltyWeight?: number
    /** Minimum score threshold to keep a tool in scored candidates. */
    minScore?: number
    /** If minScore filters too aggressively, still backfill to minTools (default: true). */
    fallbackToTopMinWhenBelowMinScore?: boolean
    /** Optional task profile for subset scoring. */
    profile?: 'coding' | 'debug' | 'refactor' | 'research'
    /** Profile boost multiplier (default: 1). */
    profileWeight?: number
    /** Weight multiplier for recently successful tools (default: 1) */
    successBoostWeight?: number
    /** Weight multiplier for consecutive failure penalty (default: 1) */
    failurePenaltyWeight?: number
    /** Maximum number of recent successful tools to track (default: 8) */
    maxRecentSuccessTools?: number
  }
  /** Optional telemetry bridge. */
  telemetry?: {
    collector?: {
      track: (type: string, data?: Record<string, any>) => void
    }
  }
  reviewerSubagent?: {
    enabled?: boolean
    minScoreToApprove?: number
    failOnRollback?: boolean
    failOnCircuitSkipThreshold?: number
  }
  worktreeOrchestrator?: {
    maxParallel?: number
    branchPrefix?: string
  }
  evoEngine?: {
    enabled?: boolean
    maxMutationsPerRun?: number
    allowModelSwitch?: boolean
  }
  fullAbsorb?: {
    enabled?: boolean
    aggressive?: boolean
    reduceTestStrategy?: 'minimal' | 'standard'
  }
  /** 记忆提取配置 */
  memoryExtraction?: {
    enabled?: boolean
    qualityThreshold?: number
    persistCallback?: (memory: Memory) => Promise<void>
  }
  /** 会话摘要配置 */
  sessionSummary?: {
    enabled?: boolean
    updateInterval?: number
    maxLength?: number
  }
  /** 会话记忆配置 */
  sessionMemory?: {
    enabled?: boolean
    /** 记忆更新间隔（轮次） */
    updateInterval?: number
    /** 最小重要性阈值 */
    minImportance?: number
    /** 最大记忆笔记数量 */
    maxNotes?: number
    /** 是否自动生成记忆笔记 */
    autoGenerate?: boolean
    /** 记忆摘要最大长度 */
    summaryMaxLength?: number
  }
  /** 智能体摘要配置 */
  agentSummary?: {
    enabled?: boolean
    /** 摘要格式模板 */
    template?: string
    /** 是否自动生成摘要 */
    autoGenerate?: boolean
    /** 最小摘要长度 */
    minLength?: number
    /** 最大摘要长度 */
    maxLength?: number
  }
  /** Auto Dream 记忆整合配置 */
  autoDream?: {
    enabled?: boolean
    intervalMs?: number
    batchSize?: number
    qualityThreshold?: number
    integrateCallback?: (memory: Memory) => Promise<void>
  }
  /** Skills系统配置 */
  skills?: {
    /** 是否启用Skills系统 */
    enabled?: boolean
    /** 自动注册Skills */
    autoRegister?: boolean
    /** 排除的Skills名称 */
    excludeSkills?: string[]
    /** Skills执行超时（毫秒） */
    timeout?: number
    /** 是否启用调试日志 */
    debug?: boolean
  }
  /** 上下文毒性熔断配置 */
  contextToxicityBreaker?: {
    /** 触发快照重启前的最大连续失败轮次（默认 15） */
    maxFailedTurnsBeforeSnapshot?: number
    /** 是否启用失败快照重置（默认 true） */
    enableFailureSnapshotReset?: boolean
  }
  /** 语义缓存配置 */
  semanticCache?: {
    /** 是否启用语义缓存（默认 false） */
    enabled?: boolean
    /** 是否仅对只读工具启用语义缓存（默认 true） */
    readOnlyOnly?: boolean
  }
  /** 注意力锚点配置 */
  attentionAnchor?: {
    /** 是否启用注意力锚点（默认 true） */
    enabled?: boolean
    /** 锚点文本模板（可配置） */
    template?: string
    /** 最大锚点长度（字符数） */
    maxLength?: number
    /** 最小上下文长度触发锚点（消息数） */
    minContextLength?: number
  }
  /** 反事实并行推演配置 */
  counterfactual?: CounterfactualConfig
  /** Hook配置扩展 */
  hookConfig?: HookConfigExtension
  /** Speculation预测执行配置 */
  speculation?: {
    /** 是否启用Speculation（默认 false） */
    enabled?: boolean
    /** 最大并行度 */
    maxParallel?: number
    /** 超时时间（毫秒） */
    timeoutMs?: number
    /** 最大预测数量 */
    maxSpeculations?: number
    /** 是否启用调试日志 */
    debug?: boolean
    /** 触发Speculation的轮次间隔 */
    triggerInterval?: number
    /** 最小置信度阈值 */
    minConfidence?: number
  }
}

/** 单轮事件（async generator yield） */
export type QueryEvent =
  | { type: 'turn_start'; turn: number; gear: 1 | 2 | 3; model: string }
  | { type: 'tool_calls_capped'; requested: number; executed: number; cap: number }
  | {
      type: 'tool_subset_selected'
      totalTools: number
      selectedTools: number
      selectedToolNames: string[]
      profileUsed?: 'coding' | 'debug' | 'refactor' | 'research'
      excludedByConfig?: number
      excludedByPattern?: number
      droppedByMinScore?: number
      mcpToolsSelected?: number
      writeToolsSelected?: number
    }
  | { type: 'llm_response'; response: LLMResponse }
  | {
      type: 'cache_break'
      reason: string
      querySource: string
      prevCacheReadTokens: number
      cacheReadTokens: number
      tokenDrop: number
    }
  | { type: 'tool_start'; toolName: string; toolUseId: string; input: Record<string, any> }
  | {
      type: 'tool_skipped_by_circuit_breaker'
      toolName: string
      toolUseId: string
      state: 'closed' | 'open' | 'half_open'
      consecutiveFailures: number
      openedAt: number | null
    }
  | { type: 'transaction_started'; txId: string; trackedFiles: string[] }
  | { type: 'transaction_rolled_back'; txId: string; filesChanged: string[]; reason: string }
  | { type: 'transaction_committed'; txId: string; trackedFiles: string[] }
  | { type: 'tool_result'; toolName: string; toolUseId: string; result: ToolResult }
  | { type: 'test_detected'; passed: boolean; output: string }
  | { type: 'gear_shift'; from: 1 | 2 | 3; to: 1 | 2 | 3; reason: string }
  | { type: 'context_snapshot_reset'; reason: string; failedTurns: number; messagesKept: number; messagesDiscarded: number }
  | { type: 'semantic_cache_bypass'; reason: string; toolNames: string[] }
  | { type: 'attention_anchor_applied'; reason: string; anchor: string; contextLength: number }
  | { type: 'priority_set'; priority: 1 | 2 | 3 | 4 }
  | { type: 'speculation_started'; strategyCount: number; query: string }
  | { type: 'speculation_plan_generated'; planCount: number; strategies: string[] }
  | { type: 'speculation_executed'; results: number; successful: number; durationMs: number }
  | { type: 'speculation_result'; planId: string; strategy: string; success: boolean; confidence: number }
  | { type: 'error'; error: Error; recoverable: boolean }
  | { type: 'completed'; reason: QueryExitReason; finalMessage: string; turns: number }

/** Query 退出原因 */
export type QueryExitReason =
  | 'end_turn'          // LLM 正常结束
  | 'max_turns'         // 达到最大轮次
  | 'max_errors'        // 连续错误过多 → HITL
  | 'aborted'           // 用户取消
  | 'test_passed'       // 测试通过（S.1 测试驱动终止）
  | 'api_error'         // LLM API 不可用

/** Query 结果 */
export interface QueryResult {
  /** 最终回复文本 */
  finalMessage: string
  /** 退出原因 */
  exitReason: QueryExitReason
  /** 总轮次 */
  turns: number
  /** 总 token 使用 */
  totalUsage: { inputTokens: number; outputTokens: number }
  /** 最终档位 */
  finalGear: 1 | 2 | 3
  /** 所有消息历史 */
  messages: Message[]
  /** 提取的记忆 */
  extractedMemories?: Memory[]
  /** 智能体摘要 */
  agentSummary?: AgentSummary & { summaryText: string }
}

export interface ReviewerFinding {
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  title: string
  detail: string
}

export interface ReviewerReport {
  approved: boolean
  score: number
  findings: ReviewerFinding[]
  suggestions: string[]
}

export interface WorktreeTask {
  id: string
  title: string
  estimatedMinutes?: number
}

export interface WorktreeLane {
  laneId: number
  branch: string
  tasks: WorktreeTask[]
}

export interface WorktreePlan {
  maxParallel: number
  lanes: WorktreeLane[]
}

export interface EvoMetrics {
  taskSuccessRate: number
  firstPassRate: number
  toolSuccessRate: number
  avgRepairRounds: number
  longTaskRecoveryRate: number
  costPerTask: number
}

export interface EvoSuggestion {
  path: string
  from: number | boolean | string | undefined
  to: number | boolean | string
  reason: string
}

export interface EvoProposal {
  safe: boolean
  mutations: EvoSuggestion[]
  notes: string[]
}

export interface FullAbsorbTargetStatus {
  phase: 'Phase0' | 'Phase1' | 'Phase2' | 'Phase3' | 'Phase4' | 'Phase5'
  key: string
  path: string
  exists: boolean
  status: 'complete' | 'partial' | 'missing'
}

export interface FullAbsorbStatus {
  total: number
  complete: number
  partial: number
  missing: number
  ratio: number
  targets: FullAbsorbTargetStatus[]
}

export interface FullAbsorbAction {
  wave: 'W1' | 'W2'
  title: string
  items: string[]
}

// ── Agent Summary 接口 ──

/**
 * 智能体摘要状态
 */
export type AgentStatus = 'completed' | 'failed' | 'timeout' | 'aborted' | 'running'

/**
 * 智能体摘要接口
 */
export interface AgentSummary {
  /** 智能体ID */
  agentId: string
  /** 父会话ID */
  parentSessionId: string
  /** 开始时间戳 */
  startedAt: number
  /** 结束时间戳 */
  endedAt?: number
  /** 状态 */
  status: AgentStatus
  /** 关键发现 */
  keyFindings: string[]
  /** 执行的操作 */
  actions: string[]
  /** 错误信息（如果有） */
  errors: string[]
  /** 元数据 */
  metadata: {
    /** 总轮次 */
    totalTurns: number
    /** 使用的工具 */
    toolsUsed: string[]
    /** 是否成功 */
    success: boolean
    /** 错误代码（如果有） */
    errorCode?: string
    /** 性能指标 */
    performance?: {
      durationMs: number
      tokensUsed: number
      toolCalls: number
    }
  }
}

/**
 * 智能体摘要配置
 */
export interface AgentSummaryConfig {
  /** 是否启用智能体摘要 */
  enabled?: boolean
  /** 摘要格式模板 */
  template?: string
  /** 是否自动生成摘要 */
  autoGenerate?: boolean
  /** 最小摘要长度 */
  minLength?: number
  /** 最大摘要长度 */
  maxLength?: number
}

export interface FullAbsorbTrackResult {
  track: string
  done: boolean
  evidence: string[]
}

export interface FullAbsorbWaveResult {
  wave: 'W1' | 'W2'
  title: string
  doneCount: number
  totalCount: number
  tracks: FullAbsorbTrackResult[]
}

export interface FullAbsorbExecutionReport {
  startedAt: string
  finishedAt: string
  status: FullAbsorbStatus
  importedTools: number
  totalTools: number
  waves: FullAbsorbWaveResult[]
  legacyBridges?: Array<{
    name: string
    connected: boolean
    detail: string
  }>
  recommendedTests: string[]
}

// ── 三档变速（步骤级） ──

/** 步骤级变速器状态 */
export interface GearState {
  gear: 1 | 2 | 3
  consecutiveErrors: number
  lastErrorTs: number
  /** 测试结果历史（最近 5 条） */
  testHistory: Array<{ passed: boolean; ts: number }>
}

/** 步骤级变速器接口 */
export interface StepGearBox {
  /** 获取当前档位 */
  getGear(): 1 | 2 | 3
  /** 获取当前档位对应的模型 */
  getModel(): string
  /** 报告工具结果（可能触发升降档） */
  reportToolResult(result: ToolResult, toolName: string): void
  /** 报告测试结果（S.1 物理证据，优先级最高） */
  reportTestResult(passed: boolean): void
  /** 报告 LLM 错误 */
  reportLLMError(error: Error): void
  /** 报告成功（降档） */
  reportSuccess(): void
  /** 获取状态快照 */
  getState(): GearState
}

/** 上下文快照状态 */
export interface ContextSnapshotState {
  /** 快照生成时间戳 */
  timestamp: number
  /** 当前档位 */
  gear: 1 | 2 | 3
  /** 连续错误计数 */
  consecutiveErrors: number
  /** 当前工作目录 */
  cwd: string
  /** 会话ID */
  sessionId: string
  /** 任务查询（如果有） */
  taskQuery?: string
  /** 关键状态摘要 */
  summary: string
}

// ── 反事实并行推演配置 ──

/** 反事实并行推演策略 */
export type CounterfactualStrategy = 'ablation' | 'diversity'

/** 反事实并行推演配置 */
export interface CounterfactualConfig {
  /** 是否启用反事实并行推演 */
  enabled?: boolean
  /** 并行分支数量 */
  branchCount?: number
  /** 每个分支最大轮次 */
  maxBranchTurns?: number
  /** 分支生成策略 */
  strategy?: CounterfactualStrategy
  /** 是否自动汇总结果 */
  autoSummarize?: boolean
  /** 是否自动选择获胜分支 */
  autoPickWinner?: boolean
}

/** 分支结果 */
export interface CounterfactualBranchResult {
  /** 分支ID */
  branchId: string
  /** 分支指令 */
  directive: string
  /** 状态 */
  status: 'completed' | 'failed' | 'timeout' | 'aborted'
  /** 总轮次 */
  turns: number
  /** 执行时长（毫秒） */
  durationMs: number
  /** 错误计数 */
  errorCount: number
  /** 工具调用计数 */
  toolCallCount: number
  /** 最终消息 */
  finalMessage: string
  /** 评分 */
  score?: number
  /** 错误信息（如果有） */
  error?: string
}

/** 会话结果 */
export interface CounterfactualSessionResult {
  /** 会话ID */
  sessionId: string
  /** 原始查询 */
  originalQuery: string
  /** 所有分支结果 */
  branches: CounterfactualBranchResult[]
  /** 获胜分支ID */
  winnerBranchId?: string
  /** 分支排名 */
  ranking: Array<{ branchId: string; score: number; rank: number }>
  /** 选择理由 */
  reason?: string
  /** 汇总摘要 */
  summary?: string
  /** 总执行时长（毫秒） */
  totalDurationMs: number
}

// ── Hook 错误处理配置 ──

/** Hook错误处理模式 */
export type HookErrorMode = 'degrade' | 'throw'

/** Hook配置扩展 */
export interface HookConfigExtension {
  /** Hook错误处理模式 */
  hookErrorMode?: HookErrorMode
  /** 降级时的默认返回值 */
  hookDegradeValue?: any
  /** 是否启用ANSI清洗 */
  enableAnsiSanitize?: boolean
  /** 清洗后的最大长度 */
  maxSanitizedLength?: number
}

// ── 默认配置 ──

/** 反事实并行推演默认配置 */
export const DEFAULT_COUNTERFACTUAL_CONFIG: CounterfactualConfig = {
  enabled: false,
  branchCount: 3,
  maxBranchTurns: 4,
  strategy: 'diversity',
  autoSummarize: true,
  autoPickWinner: true
}
