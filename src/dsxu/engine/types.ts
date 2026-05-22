import type { FileHistoryManager } from './file-history'
import type { Memory } from './memory-extractor'
import type { AppState } from '../../state/AppStateStore'
import type { ToolPermissionContext } from '../../Tool'
import type { MCPServerConnection } from '../../services/mcp/types'
import type { RecoveryDecision } from './recovery/recovery-types-v3'

/**
 *
 *
 * DSXU 单模型 tool use loop，加 DSXU 独有能力：
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

export type ToolRegistryProviderKind = 'mainline' | 'mcp' | 'agent' | 'skill' | 'fallback'

export interface ToolOwnershipMetadata {
  ownerId: string
  providerId: string
  providerKind: ToolRegistryProviderKind
  registryOwner: 'DSXU Tool Registry'
  adapterBoundary: string
  permissionBoundary: string
  runtimeBoundary: string
  evidenceIds: string[]
  registeredAt?: string
}

/** 工具执行结果 */
export interface ToolResult {
  toolUseId: string
  content: string
  isError: boolean
  /** Internal execution metadata. Not sent back to the model. */
  meta?: Record<string, any>
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
  ownership?: Partial<ToolOwnershipMetadata>
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
  /** 当前工作目录 */
  cwd: string
  /** 会话 ID */
  sessionId: string
  /** 当前档位 */
  gear: 1 | 2 | 3
  /** 当前 tool use ID */
  toolUseId?: string
  /** Optional mainline subagent id when engine adapters execute inside a worker. */
  agentId?: string
  /** Optional source message history to preserve worker ownership instructions. */
  messages?: any[]
  /** 文件历史管理器 */
  fileHistory?: FileHistoryManager
  /** 中止信号 */
  abortSignal?: AbortSignal
  /** 事件发射函数（用于桥接工具发出事件） */
  emitEvent?: (event: any) => void
  /** DSXU permission bridge for wrapped src/tools classes. */
  mainlinePermissionCallback?: (request: {
    toolName: string
    input: Record<string, any>
    permission: any
  }) => Promise<{
    behavior: 'allow' | 'deny'
    updatedInput?: Record<string, any>
    message?: string
  }>
  /** Explicit src/tools permission context for wrapped mainline tools. */
  mainlineToolPermissionContext?: ToolPermissionContext
  /** Optional initial src/tools AppState seed for adapter tests and orchestration bridges. */
  mainlineInitialAppState?: Partial<AppState>
  /** Explicit MCP clients for wrapped mainline MCP resource tools. */
  mainlineMcpClients?: MCPServerConnection[]
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

/** 运行剖面类型 */
export type ProfileType = 'plan' | 'edit' | 'review' | 'session'

/** 运行时状态机状态 */
export type RuntimeState =
  | 'plan'      // 规划状态：分析任务，制定计划
  | 'retrieve'  // 检索状态：获取上下文信息
  | 'edit'      // 编辑状态：执行代码编辑操作
  | 'execute'   // 执行状态：运行测试或命令
  | 'verify'    // 验证状态：检查结果正确性
  | 'review'    // 审查状态：代码审查和风险评估
  | 'commit'    // 提交状态：保存变更结果
  | 'rollback'  // 回滚状态：撤销失败变更

/** 运行时状态机配置 */
export interface RuntimeStateMachineConfig {
  /** 是否启用状态机 */
  enabled?: boolean
  /** 状态转移超时时间（毫秒） */
  stateTransitionTimeout?: number
  /** 最大状态重试次数 */
  maxStateRetries?: number
  /** 状态特定配置 */
  stateConfigs?: Partial<Record<RuntimeState, StateSpecificConfig>>
}

/** 状态特定配置 */
export interface StateSpecificConfig {
  /** 状态超时时间（毫秒） */
  timeout?: number
  /** 允许的最大工具调用次数 */
  maxToolCalls?: number
  /** 状态特定工具过滤 */
  allowedToolCategories?: ToolCategory[]
  /** 状态特定模型配置 */
  model?: string
  /** 状态特定温度设置 */
  temperature?: number
}

/** 运行时状态机状态对象 */
export interface RuntimeStateObject {
  /** 当前状态 */
  currentState: RuntimeState
  /** 上一个状态 */
  previousState: RuntimeState | null
  /** 进入当前状态的时间戳 */
  enteredAt: number
  /** 状态转移原因 */
  reason?: string
  /** 状态元数据 */
  metadata?: Record<string, any>
  /** 状态尝试次数 */
  attemptCount: number
  /** 状态是否完成 */
  isCompleted: boolean
  /** 状态结果（成功/失败） */
  result?: 'success' | 'failure' | 'pending'
  /** 状态错误信息 */
  error?: string
}

/** 运行剖面配置 */
export interface ProfileConfig {
  /** 剖面类型 */
  type: ProfileType
  /** 显示名称 */
  displayName: string
  /** 描述 */
  description: string
  /** 推荐的模型名称 */
  recommendedModel: string
  /** 温度设置 */
  temperature: number
  /** 最大输出token数 */
  maxOutputTokens: number
  /** 是否启用推理模式 */
  enableReasoning: boolean
  /** 允许的工具类型 */
  allowedToolCategories: ToolCategory[]
  /** 输出格式约束 */
  outputFormat: OutputFormat
  /** 上下文长度限制（字符数） */
  contextLengthLimit?: number
  /** 是否只读 */
  readOnly: boolean
  /** 思考深度（1-10） */
  thinkingDepth: number
  /** 延迟容忍度（1-10，1=最低延迟，10=最高质量） */
  latencyTolerance: number
}

/** 工具类别 */
export type ToolCategory =
  | 'read'      // 只读工具：Read, Grep, Glob
  | 'write'     // 写操作工具：Write, Edit, Bash（写文件时）
  | 'analysis'  // 分析工具：LSP, StaticAnalysis
  | 'git'       // Git操作
  | 'skill'     // Skill工具
  | 'mcp'       // MCP工具
  | 'test'      // 测试工具：Bash（运行测试时）

/** 输出格式 */
export type OutputFormat =
  | 'json'      // 结构化JSON输出
  | 'patch'     // 补丁/编辑操作
  | 'text'      // 自由文本
  | 'mixed'     // 混合格式

/** LLM 调用选项 */
export interface LLMCallOptions {
  model: string
  maxTokens?: number
  temperature?: number
  responseFormat?: 'json_object'
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
  maxTurns?: number // DSXU comment sanitized.
  /** 最大连续错误（触发 HITL） */
  maxConsecutiveErrors?: number // DSXU comment sanitized.
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
  /** Mainline MCP clients supplied by src/services/mcp; engine does not own MCP transport startup. */
  mainlineMcpClients?: MCPServerConnection[]
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
    /** Default-mainline visible tool hard cap. GearBox may change ranking, not exceed this cap. */
    visibleToolHardCap?: number
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
  /** 验证门禁配置 */
  verificationGate?: {
    /** 是否启用验证门禁 */
    enabled?: boolean
    /** 验证触发条件：有文件编辑时验证 */
    triggerOnFileEdit?: boolean
    /** 验证触发条件：有Bash执行时验证 */
    triggerOnBash?: boolean
    /** 最小验证分数阈值 (0-100) */
    minScore?: number
    /** 验证失败时的行为：'warn' | 'block' | 'continue' */
    onFailure?: 'warn' | 'block' | 'continue'
  }
  /** 审查门禁配置 */
  reviewGate?: {
    /** 是否启用审查门禁 */
    enabled?: boolean
    /** 最小批准分数 (0-100) */
    minScoreToApprove?: number
    /** 事务回滚是否导致失败 */
    failOnRollback?: boolean
    /** 熔断器跳过阈值 */
    failOnCircuitSkipThreshold?: number
    /** 审查未通过时的行为：'warn' | 'block' | 'continue' */
    onReject?: 'warn' | 'block' | 'continue'
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
    reduceTestStrategy?: 'focused' | 'standard'
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
  /** 运行剖面配置 */
  profile?: {
    /** 剖面类型（plan/edit/review/session） */
    type?: ProfileType
    /** 是否根据任务自动推荐剖面 */
    autoRecommend?: boolean
    /** 剖面特定配置覆盖 */
    configOverrides?: Partial<ProfileConfig>
    /** 是否启用剖面工具过滤 */
    enableToolFiltering?: boolean
    /** 是否启用剖面输出格式约束 */
    enableOutputFormatting?: boolean
  }
  /** Tool Protocol 配置 */
  toolProtocol?: {
    /** 是否启用 Tool Protocol（默认 false） */
    enabled?: boolean
    /** 是否自动注册原生工具 */
    autoRegisterNativeTools?: boolean
    /** 是否自动桥接现有工具 */
    autoBridgeExistingTools?: boolean
    /** 是否启用协议门禁 */
    enableGuards?: boolean
    /** 是否启用协议事件 */
    enableEvents?: boolean
    /** A-2A: KAIROS 会话恢复上下文 */
    resumeContext?: {
      /** 会话ID */
      sessionId?: string
      /** 检查点ID */
      checkpointId?: string
      /** 恢复类型 */
      resumeType?: 'continue' | 'resume' | 'restart'
      /** 恢复参数 */
      params?: Record<string, any>
    }
  }
}

/** 单轮事件（async generator yield） */
export type QueryEvent =
  | { type: 'loop_started'; loopId: string; requestId: string; timestamp: number; metadata?: Record<string, any> }
  | { type: 'model_called'; loopId: string; callId: string; model: string; timestamp: number; metadata?: Record<string, any> }
  | { type: 'tool_dispatch_started'; loopId: string; callId: string; toolName: string; toolUseId: string; timestamp: number }
  | { type: 'tool_dispatch_completed'; loopId: string; callId: string; toolName: string; toolUseId: string; success: boolean; timestamp: number }
  | { type: 'loop_finished'; loopId: string; requestId: string; success: boolean; reason: string; timestamp: number; result?: QueryResult; metadata?: Record<string, any> }
  | { type: 'loop_aborted'; loopId: string; requestId: string; reason: string; timestamp: number; failureType?: string; result?: QueryResult; metadata?: Record<string, any> }
  | { type: 'state_transition'; from: RuntimeState | string; to: RuntimeState | string; reason: string; timestamp: number; metadata?: Record<string, any> }
  | { type: 'tool_failure'; loopId: string; callId: string; toolName: string; toolUseId: string; error: string; errorType: string; timestamp: number }
  | { type: 'validation_failure'; loopId: string; requestId: string; score: number; findings: any[]; timestamp: number }
  | { type: 'budget_failure'; loopId: string; requestId: string; budgetType: string; limit: number; actual: number; timestamp: number }
  | { type: 'proxy_failure'; loopId: string; requestId: string; error: string; timestamp: number }
  | { type: 'model_failure'; loopId: string; callId: string; model: string; error: string; timestamp: number }
  | { type: 'aborted_by_guard'; loopId: string; requestId: string; guardType: string; reason: string; timestamp: number }
  | { type: 'aborted_by_timeout'; loopId: string; requestId: string; timeoutMs: number; timestamp: number }
  | { type: 'turn_start'; turn: number; gear: 1 | 2 | 3; model: string }
  | { type: 'tool_calls_capped'; requested: number; executed: number; cap: number }
  | {
      type: 'tool_subset_selected'
      totalTools: number
      selectedTools: number
      selectedToolNames: string[]
      profileUsed?: 'coding' | 'debug' | 'refactor' | 'research' | ProfileType
      excludedByConfig?: number
      excludedByPattern?: number
      profileFilteredCount?: number
      droppedByMinScore?: number
      mcpToolsSelected?: number
      writeToolsSelected?: number
      visibleToolHardCap?: number
      withinVisibleToolHardCap?: boolean
      hardCapEnforced?: boolean
      toolWindowOwner?: string
      evidence?: string[]
    }
  | { type: 'llm_response'; response: LLMResponse }
  | {
      type: 'cache_break'
      reason: string
      querySource: string
      prevCacheReadTokens: number
      cacheReadTokens: number
      tokenDrop: number
      warmupRecommendation?: {
        owner: 'DeepSeek route/cost/cache'
        mode: 'dry-run-only'
        command: string
        debounceMs: number
        reason: string
        claimBoundary: string
      }
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
  | { type: 'tool_result'; toolName: string; toolUseId: string; result: ToolResult; metadata?: Record<string, any> }
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
  | { type: 'verification_started' }
  | { type: 'verification_completed'; result: VerificationResult }
  | { type: 'review_started' }
  | { type: 'review_completed'; result: ReviewResult }
  | { type: 'bridge_tool_started'; toolName: string; toolEventId: string; timestamp: number; data: { input: Record<string, any> } }
  | { type: 'bridge_tool_completed'; toolName: string; toolEventId: string; timestamp: number; data: { success: boolean; duration: number; outputLength: number } }
  | { type: 'bridge_tool_failed'; toolName: string; toolEventId: string; timestamp: number; data: { error: string; errorType: string; duration: number; stack?: string } }
  | { type: 'bridge_gate_check'; toolName: string; toolEventId: string; timestamp: number; data: { allowed: boolean; reason?: string; errorType?: string } }
  | { type: 'completed'; reason: QueryExitReason; finalMessage: string; turns: number }

/** Query 退出原因 */
export type QueryExitReason =
  | 'end_turn'          // LLM 正常结束
  | 'max_turns'         // 达到最大轮次
  | 'max_errors'        // 连续错误过多 → HITL
  | 'aborted'           // 用户取消
  | 'test_passed'       // 测试通过（S.1 测试驱动终止）
  | 'api_error'         // LLM API 不可用

/** 验证结果 */
export interface VerificationResult {
  /** 是否通过验证 */
  passed: boolean
  /** 验证分数 (0-100) */
  score: number
  /** 验证发现的问题 */
  findings: Array<{
    severity: 'P0' | 'P1' | 'P2' | 'P3'
    title: string
    detail: string
    suggestion?: string
  }>
  /** 验证输出（如测试结果） */
  output?: string
  /** 验证类型 */
  type: 'unit_test' | 'integration_test' | 'syntax_check' | 'manual_review'
  /** 9A-C: 规则检查结果 */
  ruleResults?: CheckRuleResult[]
}

/** 审查结果 */
export interface ReviewResult {
  /** 审查分数 (0-100) */
  score: number
  /** 是否批准 */
  approved: boolean
  /** 审查发现 */
  findings: Array<{
    severity: 'P0' | 'P1' | 'P2' | 'P3'
    title: string
    detail: string
    suggestion?: string
  }>
  /** 建议 */
  suggestions: string[]
  /** 审查者 */
  reviewer: 'auto' | 'human'
  /** 9A-C: 规则检查结果 */
  ruleResults?: CheckRuleResult[]
}

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
  /** 验证结果（可选） */
  verification?: VerificationResult
  /** 审查结果（可选） */
  review?: ReviewResult
  /** 所有消息历史 */
  messages: Message[]
  /** Visible-state and owner evidence metadata. */
  metadata?: Record<string, any>
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
  archivedBridges?: Array<{
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
  lastRecoveryDecision?: RecoveryDecision
  /** 测试结果历史（最近 5 条） */
  testHistory: Array<{ passed: boolean; ts: number }>
}

/** 步骤级变速器接口 */
export interface GearVerificationSummary {
  passed: boolean
  score: number
  findings?: Array<{
    severity: 'P1' | 'P2' | 'P3'
    title: string
    detail: string
    suggestion?: string
  }>
}

export interface GearVerificationContext {
  policy?: 'warn' | 'block' | 'continue'
  failedAttemptsSinceProgress?: number
  command?: string
}

export interface StepGearBox {
  /** 获取当前档位 */
  getGear(): 1 | 2 | 3
  /** 获取当前档位对应的模型 */
  getModel(): string
  /** 报告工具结果（可能触发升降档） */
  reportToolResult(result: ToolResult, toolName: string): void
  /** 报告测试结果（S.1 物理证据，优先级最高） */
  reportTestResult(passed: boolean): void
  /** Consume VerifyGate's canonical summary and return the GearBox recovery decision, if any. */
  reportVerificationSummary(summary: GearVerificationSummary, context?: GearVerificationContext): RecoveryDecision | null
  /** 报告 LLM 错误 */
  reportLLMError(error: Error, callId?: string): void
  /** Apply a canonical Recovery / GearBox decision. */
  applyRecoveryDecision(decision: RecoveryDecision): void
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

// ── Context Builder (Work Package G) ──

/** 上下文包令牌预算 */
export interface ContextTokenBudget {
  /** 输入令牌预算 */
  inputBudget: number
  /** 保留输出令牌 */
  reservedOutput: number
  /** 总限制（输入+输出） */
  totalLimit: number
  /** 已使用输入令牌 */
  usedInput?: number
  /** 已使用输出令牌 */
  usedOutput?: number
}

/** 上下文包配置 */
export interface ContextBundleConfig {
  /** 是否启用上下文构建 */
  enabled: boolean
  /** 最大文件数量 */
  maxFiles?: number
  /** 最大符号数量 */
  maxSymbols?: number
  /** 令牌预算配置 */
  tokenBudget?: Partial<ContextTokenBudget>
  /** 是否启用智能文件选择 */
  smartFileSelection?: boolean
  /** 是否启用符号提取 */
  symbolExtraction?: boolean
  /** 是否启用依赖分析 */
  dependencyAnalysis?: boolean
}

/** 上下文包引用（用于query-loop集成） */
export interface ContextBundleRef {
  /** 上下文包ID */
  bundleId: string
  /** 任务ID */
  taskId: string
  /** 创建时间 */
  createdAt: number
  /** 最后使用时间 */
  lastUsedAt: number
  /** 使用次数 */
  usageCount: number
  /** 是否已压缩 */
  compressed: boolean
  /** 压缩后大小（字节） */
  compressedSize?: number
  /** 原始大小（字节） */
  originalSize?: number
}

// ── Patch Engine (Work Package H) ──

/** 编辑原语类型 */
export type PatchStrategy =
  | 'str_replace'   // 字符串替换：精确匹配并替换特定字符串
  | 'diff_replace'  // 差异替换：基于差异的智能替换
  | 'whole_file'    // 全文件替换：替换整个文件内容

/** 编辑原语配置 */
export interface PatchStrategyConfig {
  /** 策略类型 */
  strategy: PatchStrategy
  /** 策略描述 */
  description: string
  /** 是否允许回退到下一个策略 */
  allowFallback: boolean
  /** 最大重试次数 */
  maxRetries: number
  /** 超时时间（毫秒） */
  timeoutMs: number
}

/** Patch Engine 配置 */
export interface PatchEngineConfig {
  /** 是否启用Patch Engine */
  enabled: boolean
  /** 默认策略 */
  defaultStrategy?: PatchStrategy
  /** 是否启用自动回退 */
  enableAutoFallback: boolean
  /** 最大回退深度 */
  maxFallbackDepth: number
  /** 是否启用策略验证 */
  enableStrategyValidation: boolean
  /** 是否记录策略选择日志 */
  logStrategySelection: boolean
}

// ── Progress Ledger (Work Package I) ──

/** 进度账本条目结果 */
export interface LedgerEntryResult {
  /** 结果类型：success | failure | pending */
  type: 'success' | 'failure' | 'pending'
  /** 结果消息 */
  message?: string
  /** 错误信息（如果失败） */
  error?: string
  /** 结果数据 */
  data?: Record<string, any>
  /** 时间戳 */
  timestamp: number
}

/** 验证摘要 */
export interface VerifySummary {
  /** 是否通过 */
  passed: boolean
  /** 验证分数 (0-100) */
  score: number
  /** 验证发现的问题 */
  findings: Array<{
    severity: 'P1' | 'P2' | 'P3'
    title: string
    detail: string
    suggestion?: string
  }>
  /** 验证时间戳 */
  timestamp: number
  /** 9A-C: 规则检查结果 */
  ruleResults?: CheckRuleResult[]
}

/** 审查摘要 */
export interface ReviewSummary {
  /** 是否批准 */
  approved: boolean
  /** 审查分数 (0-100) */
  score: number
  /** 审查意见 */
  comments: string[]
  /** 风险等级：low | medium | high */
  riskLevel: 'low' | 'medium' | 'high'
  /** 审查时间戳 */
  timestamp: number
  /** 9A-C: 规则检查结果 */
  ruleResults?: CheckRuleResult[]
}

/** 默认链阶段类型 */
export type DefaultChainPhase =
  | 'edit'      // 编辑阶段：代码修改和重构
  | 'execute'   // 执行阶段：运行测试、构建和验证命令
  | 'verify'    // 验证阶段：检查修改正确性和完整性
  | 'review'    // 审查阶段：代码审查、风险评估和质量检查
  | 'commit'    // 提交阶段：保存变更结果
  | 'rollback'  // 回滚阶段：撤销失败变更

/** 阶段执行结果 */
export interface PhaseResult<T = any> {
  /** 阶段类型 */
  phase: DefaultChainPhase
  /** 是否成功 */
  success: boolean
  /** 结果数据 */
  data?: T
  /** 错误信息（如果失败） */
  error?: string
  /** 开始时间 */
  startedAt: number
  /** 结束时间 */
  endedAt: number
  /** 阶段元数据 */
  metadata?: Record<string, any>
}

/** 验证阶段结果 */
export interface VerifyPhaseResult extends PhaseResult<VerifySummary> {
  phase: 'verify'
}

/** 审查阶段结果 */
export interface ReviewPhaseResult extends PhaseResult<ReviewSummary> {
  phase: 'review'
}

/** 回滚触发条件 */
export interface RollbackTrigger {
  /** 触发原因 */
  reason: 'verify_failed' | 'review_rejected' | 'execution_failed' | 'error'
  /** 触发阶段 */
  fromPhase: DefaultChainPhase
  /** 错误信息 */
  error?: string
  /** 触发时间 */
  timestamp: number
}

/** 默认链执行配置 */
export interface DefaultChainConfig {
  /** 是否启用验证阶段 */
  enableVerification: boolean
  /** 是否启用审查阶段 */
  enableReview: boolean
  /** 验证通过阈值（0-100） */
  verificationThreshold: number
  /** 审查通过阈值（0-100） */
  reviewThreshold: number
  /** 自动回滚配置 */
  autoRollback: {
    /** 验证失败时自动回滚 */
    onVerifyFailed: boolean
    /** 审查拒绝时自动回滚 */
    onReviewRejected: boolean
    /** 执行失败时自动回滚 */
    onExecutionFailed: boolean
  }
}

/** 默认链执行结果 */
export interface DefaultChainResult {
  /** 最终结果：commit 或 rollback */
  finalOutcome: 'commit' | 'rollback'
  /** 执行的阶段结果 */
  phaseResults: PhaseResult[]
  /** 回滚触发信息（如果是rollback） */
  rollbackTrigger?: RollbackTrigger
  /** 总执行时间 */
  totalDuration: number
  /** 是否成功完成 */
  success: boolean
}

/** 进度账本步骤 */
export interface LedgerStep {
  /** 步骤ID */
  stepId: string
  /** 步骤类型 */
  type: string
  /** 步骤状态 */
  state: 'pending' | 'running' | 'completed' | 'failed'
  /** 开始时间 */
  startedAt: number
  /** 结束时间 */
  endedAt?: number
  /** 步骤结果 */
  result?: LedgerEntryResult
  /** 步骤元数据 */
  metadata?: Record<string, any>
}

/** 进度账本配置 */
export interface ProgressLedgerConfig {
  /** 是否启用进度账本 */
  enabled: boolean
  /** 是否持久化到文件 */
  persistToFile: boolean
  /** 持久化文件路径 */
  filePath?: string
  /** 自动保存间隔（毫秒） */
  autoSaveInterval: number
  /** 最大历史步骤数 */
  maxHistorySteps: number
  /** 是否启用自动恢复 */
  enableAutoResume: boolean
}

// ── 9A-A: Problem Slicer 类型定义 ──

/** 问题切片风险等级 */
export type ProblemSliceRiskLevel = 'low' | 'medium' | 'high'

/** 建议的智能体剖面（与8E Role Profiles对齐） */
export type ProblemSliceProfile = 'plan' | 'edit' | 'review' | 'session'

/** 问题切片 - 核心结构定义 */
export interface ProblemSlice {
  /** 切片唯一标识符 */
  id: string
  /** 切片标题 */
  title: string
  /** 切片意图描述 */
  intent: string
  /** 建议使用的智能体剖面 */
  suggestedProfile: ProblemSliceProfile
  /** 预期需要的工具列表 */
  expectedTools: string[]
  /** 风险等级 */
  riskLevel: ProblemSliceRiskLevel
  /** 详细描述（可选） */
  description?: string
  /** 依赖的其他切片ID（可选） */
  dependencies?: string[]
  /** 备注信息（可选） */
  notes?: string
  /** 预估工作量（可选） */
  estimatedEffort?: number
  /** 工作量等级决策 */
  effortLevel?: EffortLevel
  /** 推理偏好决策 */
  reasoningPreference?: ReasoningPreference
  /** 是否使用深度审查路径 */
  useDeepReviewPath?: boolean
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
}

/** 问题切片器结果 */
export interface ProblemSlicerResult {
  /** 原始任务描述 */
  originalTask: string
  /** 生成的切片列表 */
  slices: ProblemSlice[]
  /** 切片总数 */
  totalSlices: number
  /** 总体风险等级 */
  overallRiskLevel: ProblemSliceRiskLevel
  /** 预估总工作量 */
  totalEstimatedEffort?: number
  /** 生成时间戳 */
  generatedAt: number
}

// ── 9A-E: Effort Routing 类型定义 ──

/** 工作量等级 */
export type EffortLevel = 'low' | 'medium' | 'high'

/** 推理偏好 */
export type ReasoningPreference = 'fast' | 'balanced' | 'deep'

/** 工作量路由输入参数 */
export interface EffortRoutingInput {
  /** 任务复杂度 (1-10) */
  taskComplexity: number
  /** 切片风险等级 */
  sliceRisk: 'low' | 'medium' | 'high'
  /** 可用token预算 */
  tokenBudget: number
  /** 建议的智能体剖面 */
  suggestedProfile: 'plan' | 'edit' | 'review' | 'session'
  /** 是否需要深度审查 */
  requiresDeepReview: boolean
  /** 是否包含工具执行 */
  hasToolExecution: boolean
  /** 可选：上下文长度 */
  contextLength?: number
  /** 可选：时间限制（分钟） */
  timeLimit?: number
  /** 可选：优先级 (1-10) */
  priority?: number
}

/** 工作量路由决策结果 */
export interface EffortRoutingDecision {
  /** 工作量等级 */
  effortLevel: EffortLevel
  /** 保留的输出token数量 */
  reservedOutputTokens: number
  /** 最大输入token预算 */
  maxInputBudget: number
  /** 推理偏好 */
  reasoningPreference: ReasoningPreference
  /** 是否使用深度审查路径 */
  useDeepReviewPath: boolean
  /** 是否启用详细日志 */
  enableDetailedLogging: boolean
  /** 是否启用额外安全检查 */
  enableExtraSafetyChecks: boolean
  /** 建议的思考时间（秒） */
  suggestedThinkingTime?: number
  /** 决策时间戳 */
  decidedAt: number
}

// ── 9A-B: Repo Brain 类型定义 ──

/** 仓库地图节点 - 表示仓库中的文件或目录 */
export interface RepoMapNode {
  /** 节点路径（相对于仓库根目录） */
  path: string
  /** 节点类型：file | directory */
  type: 'file' | 'directory'
  /** 文件扩展名（仅文件类型） */
  extension?: string
  /** 文件大小（字节，仅文件类型） */
  size?: number
  /** 最后修改时间戳 */
  lastModified?: number
  /** 是否被选中用于分析 */
  selected?: boolean
  /** 节点重要性评分（0-100） */
  importanceScore?: number
}

/** 符号定义 - 代码中的标识符 */
export interface SymbolDefinition {
  /** 符号名称 */
  name: string
  /** 符号类型：function | class | interface | type | variable | constant | enum */
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'enum'
  /** 符号所在文件路径 */
  filePath: string
  /** 符号位置（行号） */
  line: number
  /** 符号位置（列号） */
  column?: number
  /** 符号可见性：public | private | protected | internal */
  visibility?: 'public' | 'private' | 'protected' | 'internal'
  /** 符号描述（从注释提取） */
  description?: string
  /** 符号签名（函数签名、类型定义等） */
  signature?: string
}

/** 依赖关系 - 文件或符号之间的引用关系 */
export interface DependencyRelation {
  /** 源文件路径 */
  sourcePath: string
  /** 目标文件路径 */
  targetPath: string
  /** 依赖类型：import | require | reference | extend | implement | call */
  type: 'import' | 'require' | 'reference' | 'extend' | 'implement' | 'call'
  /** 依赖强度（0-100） */
  strength?: number
  /** 是否循环依赖 */
  isCyclic?: boolean
  /** 依赖描述 */
  description?: string
}

/** 热点区域 - 代码中的关键或复杂区域 */
export interface HotspotArea {
  /** 热点ID */
  id: string
  /** 热点类型：complex | critical | frequent-change | bug-prone | performance */
  type: 'complex' | 'critical' | 'frequent-change' | 'bug-prone' | 'performance'
  /** 相关文件路径列表 */
  filePaths: string[]
  /** 热点描述 */
  description: string
  /** 热点严重程度（1-10） */
  severity: number
  /** 热点置信度（0-100） */
  confidence?: number
  /** 建议操作 */
  suggestions?: string[]
}

/** 仓库大脑输入配置 */
export interface RepoBrainInput {
  /** 仓库根目录路径 */
  repoRoot: string
  /** 是否包含隐藏文件 */
  includeHidden?: boolean
  /** 要排除的文件模式 */
  excludePatterns?: string[]
  /** 要包含的文件扩展名 */
  includeExtensions?: string[]
  /** 最大文件大小（字节） */
  maxFileSize?: number
  /** 是否分析符号 */
  analyzeSymbols?: boolean
  /** 是否分析依赖 */
  analyzeDependencies?: boolean
  /** 是否检测热点 */
  detectHotspots?: boolean
  /** 分析深度限制 */
  depthLimit?: number
}

/** 仓库大脑输出包 */
export interface RepoBrainBundle {
  /** 仓库地图 - 文件系统结构 */
  repoMap: RepoMapNode[]
  /** 符号定义 - 代码中的标识符 */
  symbols: SymbolDefinition[]
  /** 依赖关系 - 文件/符号之间的引用 */
  dependencies: DependencyRelation[]
  /** 热点区域 - 关键或复杂代码区域 */
  hotspots: HotspotArea[]
  /** 选中的文件列表（用于进一步分析） */
  selectedFiles: string[]
  /** 入口点文件列表 */
  entryPoints: string[]
  /** 分析备注 */
  notes: string[]
  /** 生成时间戳 */
  generatedAt: number
  /** 仓库根目录 */
  repoRoot: string
  /** 分析配置 */
  config: RepoBrainInput
}

// ── 9A-C: Checks as Rules 类型定义 ──

/** 规则类别 */
export type CheckRuleCategory = 'syntax' | 'dangerous_change' | 'verification' | 'style' | 'security' | 'performance'

/** 规则严重程度 */
export type CheckRuleSeverity = 'low' | 'medium' | 'high' | 'critical'

/** 规则适用阶段 */
export type CheckRulePhase = 'verify' | 'review' | 'plan' | 'edit' | 'session'

/** 规则条件类型 */
export type CheckRuleConditionType = 'simple' | 'regex' | 'ast' | 'custom'

/** 规则动作类型 */
export type CheckRuleActionType = 'warn' | 'error' | 'suggest' | 'auto_fix' | 'require_approval'

/** 规则条件 - 核心结构定义 */
export interface CheckRuleCondition {
  /** 条件类型 */
  type: CheckRuleConditionType
  /** 条件表达式（根据类型不同而不同） */
  expression: string
  /** 条件描述 */
  description?: string
  /** 条件参数 */
  params?: Record<string, any>
}

/** 规则动作 - 核心结构定义 */
export interface CheckRuleAction {
  /** 动作类型 */
  type: CheckRuleActionType
  /** 动作消息（显示给用户） */
  message: string
  /** 动作详情 */
  details?: string
  /** 修复建议（如果是 auto_fix 类型） */
  fixSuggestion?: string
  /** 动作参数 */
  params?: Record<string, any>
}

/** 规则元数据 */
export interface CheckRuleMetadata {
  /** 创建者 */
  author?: string
  /** 创建时间 */
  createdAt?: number
  /** 最后修改时间 */
  updatedAt?: number
  /** 规则版本 */
  version?: string
  /** 相关文档链接 */
  documentation?: string
  /** 规则权重（0-100） */
  weight?: number
  /** 自定义扩展字段 */
  extensions?: Record<string, any>
}

/** 检查规则 - 核心结构定义 */
export interface CheckRule {
  /** 规则唯一标识符 */
  id: string
  /** 规则名称 */
  name: string
  /** 规则类别 */
  category: CheckRuleCategory
  /** 规则严重程度 */
  severity: CheckRuleSeverity
  /** 规则描述 */
  description: string
  /** 规则条件 */
  condition: CheckRuleCondition
  /** 规则动作 */
  action: CheckRuleAction
  /** 是否启用 */
  enabled: boolean
  /** 适用阶段 */
  appliesToPhase: CheckRulePhase[]
  /** 规则标签 */
  tags: string[]
  /** 规则元数据 */
  metadata?: CheckRuleMetadata
}

/** 规则检查结果状态 */
export type CheckRuleResultStatus = 'passed' | 'failed' | 'warning' | 'skipped' | 'error'

/** 规则检查结果 - 核心结构定义 */
export interface CheckRuleResult {
  /** 结果唯一标识符 */
  id: string
  /** 关联的规则ID */
  ruleId: string
  /** 检查结果状态 */
  status: CheckRuleResultStatus
  /** 检查时间戳 */
  checkedAt: number
  /** 检查目标（文件路径、代码片段等） */
  target: string
  /** 检查详情 */
  details?: string
  /** 错误消息（如果检查失败） */
  errorMessage?: string
  /** 建议修复方案 */
  fixSuggestion?: string
  /** 检查上下文 */
  context?: Record<string, any>
  /** 结果元数据 */
  metadata?: {
    /** 执行耗时（毫秒） */
    executionTime?: number
    /** 资源消耗 */
    resourceUsage?: Record<string, any>
    /** 自定义扩展字段 */
    extensions?: Record<string, any>
  }
}

/** 规则检查结果集 */
export interface CheckRuleResultSet {
  /** 结果集ID */
  id: string
  /** 关联的任务ID */
  taskId?: string
  /** 检查阶段 */
  phase: CheckRulePhase
  /** 所有检查结果 */
  results: CheckRuleResult[]
  /** 检查开始时间 */
  startedAt: number
  /** 检查结束时间 */
  completedAt: number
  /** 统计信息 */
  stats: {
    /** 总规则数 */
    totalRules: number
    /** 通过数 */
    passed: number
    /** 失败数 */
    failed: number
    /** 警告数 */
    warnings: number
    /** 跳过数 */
    skipped: number
    /** 错误数 */
    errors: number
  }
  /** 结果集元数据 */
  metadata?: Record<string, any>
}

// ── 9A-D: Episode Memory 类型定义 ──

/** Episode 执行结果状态 */
export type EpisodeOutcome =
  | 'success'      // 成功完成
  | 'rollback'     // 有回滚但完成
  | 'failed'       // 执行失败
  | 'aborted'      // 被中止
  | 'timeout'      // 超时
  | 'max_errors'   // 达到最大错误数
  | 'max_turns'    // 达到最大轮次

/** 运行时状态事件 */
export interface RuntimeStateEvent {
  /** 状态类型 */
  type: string
  /** 状态值 */
  value: any
  /** 时间戳 */
  timestamp: number
  /** 上下文信息 */
  context?: Record<string, any>
}

/** 工具事件 - 核心结构 */
export interface ToolEvent {
  /** 事件ID */
  eventId: string
  /** 工具名称 */
  toolName: string
  /** 事件类型 */
  type: 'tool_call' | 'tool_result' | 'tool_error' | 'tool_skipped'
  /** 输入参数 */
  input?: Record<string, any>
  /** 输出结果 */
  output?: any
  /** 错误信息 */
  error?: string
  /** 时间戳 */
  timestamp: number
  /** 持续时间（毫秒） */
  durationMs?: number
  /** 是否成功 */
  success?: boolean
}

/** Episode 切片信息 */
export interface EpisodeSlice {
  /** 切片ID */
  sliceId: string
  /** 切片标题 */
  title: string
  /** 建议的智能体剖面 */
  suggestedProfile?: string
  /** 风险等级 */
  riskLevel?: 'low' | 'medium' | 'high'
  /** 工作量等级 */
  effortLevel?: 'low' | 'medium' | 'high'
  /** 推理偏好 */
  reasoningPreference?: 'fast' | 'balanced' | 'deep'
  /** 是否使用深度审查路径 */
  useDeepReviewPath?: boolean
  /** 开始时间 */
  startedAt?: number
  /** 完成时间 */
  completedAt?: number
  /** 结果状态 */
  outcome?: EpisodeOutcome
}

/** Episode 元数据 */
export interface EpisodeMetadata {
  /** 创建时间 */
  createdAt: number
  /** 最后更新时间 */
  updatedAt: number
  /** 版本号 */
  version: string
  /** 标签 */
  tags?: string[]
  /** 自定义字段 */
  custom?: Record<string, any>
}

/** Episode - 核心结构定义 */
export interface Episode {
  /** 1. Episode ID (唯一标识) */
  episodeId: string
  /** 2. 任务ID */
  taskId: string
  /** 3. 会话ID */
  sessionId: string
  /** 4. 运行时状态序列 */
  states: RuntimeStateEvent[]
  /** 5. 工具事件序列 */
  toolEvents: ToolEvent[]
  /** 6. 最终结果状态 */
  finalOutcome: EpisodeOutcome
  /** 7. 开始时间 */
  startedAt: number
  /** 8. 完成时间 */
  completedAt: number
  /** 9. 切片信息（预留） */
  slices?: EpisodeSlice[]
  /** 10. 验证摘要（预留） */
  verifySummary?: VerifySummary
  /** 11. 评审摘要（预留） */
  reviewSummary?: ReviewSummary
  /** 12. 默认链结果（预留） */
  defaultChainResult?: DefaultChainResult
  /** 13. 备注信息 */
  notes?: string[]
  /** 14. 元数据 */
  metadata: EpisodeMetadata
}
