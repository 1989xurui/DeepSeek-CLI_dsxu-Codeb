/**
 * DSxu Query Loop 鈥?璺嚎 B 鐨勫績鑴? *
 * 瀛?Claude 鐨?while(true) tool use loop锛屽姞 DSxu 涓夊ぇ鐙湁鑳藉姏锛? * 1. 姝ラ绾т笁妗ｅ彉閫?鈥?姣忎釜 tool result 閮借兘瑙﹀彂鍗囬檷妗? * 2. MSA 璁板繂娉ㄥ叆 鈥?L1/L2/L3 涓夌骇璁板繂鎸佺画鏇存柊
 * 3. 娴嬭瘯椹卞姩鑷不锛圫.1锛夆€?娴嬭瘯閫氳繃鏄湡姝ｇ殑"瀹屾垚"淇″彿
 *
 * 鏍稿績寰幆锛? *   user message 鈫?[閫夋。] 鈫?LLM call 鈫?tool_calls? 鈫? *     鏈?鈫?鎵ц宸ュ叿 鈫?[妫€娴嬫祴璇?閿欒 鈫?鍗囬檷妗 鈫?缁х画 loop
 *     鏃?鈫?LLM 璇村畬浜?鈫?閫€鍑? *
 * 閫€鍑烘潯浠讹紙瀛?Claude锛?0 绉嶉€€鍑鸿矾寰勶級锛? *   - end_turn: LLM 姝ｅ父缁撴潫
 *   - test_passed: S.1 娴嬭瘯閫氳繃
 *   - max_turns: 闃叉棤闄愬惊鐜? *   - max_errors: 杩炵画閿欒杩囧 鈫?HITL
 *   - aborted: 鐢ㄦ埛鍙栨秷
 *   - api_error: LLM API 涓嶅彲鐢? */

import type {
  Message,
  ToolCall,
  ToolResult,
  ToolSchema,
  LLMResponse,
  LLMCallFn,
  QueryEngineConfig,
  QueryEvent,
  QueryResult,
  QueryExitReason,
  ToolContext,
  CounterfactualConfig,
  CounterfactualSessionResult,
} from './types'
import { ToolRegistry } from './tool-registry'
import type { StepGearBox } from './types'
import { createGearBox } from './gear-box'
import { autoCompactIfNeeded } from './compact'
import { FileHistoryManager } from './file-history'
import {
  recordPromptState,
  checkResponseForCacheBreak,
  notifyCompaction,
} from './prompt-cache-break-detection'
import { CircuitBreaker } from './circuit-breaker'
import { TransactionManager } from './transaction-manager'
import { extractMemories } from './memory-extractor'
import { SessionSummaryManager, SessionStore, AgentSummaryManager } from './session'
import { EnhancedSpeculationManager, createSpeculationManager } from './speculation'
import type { ContextSnapshotState } from './types'
import { runCounterfactualBranches } from './forked-agent'

const DEFAULT_MAX_TURNS = 50
const DEFAULT_MAX_CONSECUTIVE_ERRORS = 10
const DEFAULT_TOOL_SUBSET_MAX = 12
const DEFAULT_TOOL_SUBSET_MIN = 6
const DEFAULT_MAX_TOOL_CALLS_PER_TURN = 12
const MAX_RECENT_SUCCESS_TOOLS = 8

// 上下文毒性熔断默认配置
const DEFAULT_MAX_FAILED_TURNS_BEFORE_SNAPSHOT = 15
const DEFAULT_ENABLE_FAILURE_SNAPSHOT_RESET = true

// 语义缓存默认配置
const DEFAULT_SEMANTIC_CACHE_ENABLED = false
const DEFAULT_SEMANTIC_CACHE_READ_ONLY_ONLY = true

// 注意力锚点默认配置
const DEFAULT_ATTENTION_ANCHOR_ENABLED = true
const DEFAULT_ATTENTION_ANCHOR_TEMPLATE = "【重点提醒】当前核心任务：{task}"
const DEFAULT_ATTENTION_ANCHOR_MAX_LENGTH = 100
const DEFAULT_ATTENTION_ANCHOR_MIN_CONTEXT_LENGTH = 8

/**
 * 生成最小状态快照
 */
function createMinimalSnapshot(
  gearBox: StepGearBox,
  cwd: string,
  sessionId: string,
  taskQuery?: string
): ContextSnapshotState {
  const gearState = gearBox.getState()
  return {
    timestamp: Date.now(),
    gear: gearBox.getGear(),
    consecutiveErrors: gearState.consecutiveErrors,
    cwd,
    sessionId,
    taskQuery,
    summary: `Gear ${gearBox.getGear()}, ${gearState.consecutiveErrors} consecutive errors, ${gearState.testHistory.length} test results`
  }
}

/**
 * 检查是否需要旁路语义缓存
 * 规则：当特定工具存在时，禁止语义缓存拦截
 */
function shouldBypassSemanticCache(
  toolNames: string[],
  semanticCacheEnabled: boolean,
  semanticCacheReadOnlyOnly: boolean
): { bypass: boolean; reason: string; bypassTools: string[] } {
  if (!semanticCacheEnabled) {
    return { bypass: false, reason: '语义缓存未启用', bypassTools: [] }
  }

  // 需要旁路的工具列表
  const BYPASS_TOOLS = new Set([
    'Read',
    'Grep',
    'Glob',
    'Bash',
    'Git',
    'WebFetch'
  ])

  // 查找存在的旁路工具
  const foundBypassTools = toolNames.filter(toolName =>
    BYPASS_TOOLS.has(toolName)
  )

  if (foundBypassTools.length > 0) {
    return {
      bypass: true,
      reason: `存在需要旁路的工具: ${foundBypassTools.join(', ')}`,
      bypassTools: foundBypassTools
    }
  }

  // 如果配置为仅对只读工具启用，检查是否有写操作工具
  if (semanticCacheReadOnlyOnly) {
    const writeTools = toolNames.filter(toolName => isWriteLikeTool(toolName))
    if (writeTools.length > 0) {
      return {
        bypass: true,
        reason: `配置为仅对只读工具启用，但存在写操作工具: ${writeTools.join(', ')}`,
        bypassTools: writeTools
      }
    }
  }

  return { bypass: false, reason: '无需旁路', bypassTools: [] }
}

/**
 * 生成注意力锚点文本
 * 目标：降低长上下文下规范遗忘风险（Lost in the Middle）
 *
 * 规则：
 * 1. 仅在启用时生成
 * 2. 仅当上下文长度超过阈值时生成
 * 3. 锚点应简短（1-2句）
 * 4. 追加到最后一条用户消息
 */
function generateAttentionAnchor(
  messages: Message[],
  enabled: boolean,
  template: string,
  maxLength: number,
  minContextLength: number,
  taskQuery?: string
): { anchor: string | null; reason: string } {
  if (!enabled) {
    return { anchor: null, reason: '注意力锚点未启用' }
  }

  // 检查上下文长度
  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length < minContextLength) {
    return { anchor: null, reason: `上下文长度(${userMessages.length})未达到阈值(${minContextLength})` }
  }

  // 获取最后一条用户消息
  const lastUserMessage = userMessages[userMessages.length - 1]
  if (!lastUserMessage) {
    return { anchor: null, reason: '未找到用户消息' }
  }

  // 提取任务描述
  let taskDescription = '完成当前任务'

  // 优先级：1. taskQuery 2. 最后一条用户消息
  if (taskQuery) {
    taskDescription = taskQuery
  } else if (typeof lastUserMessage.content === 'string') {
    const content = lastUserMessage.content
    // 简单提取：取前50个字符作为任务描述
    if (content.length > 10) {
      const shortDesc = content.substring(0, 50).replace(/\n/g, ' ').trim()
      if (shortDesc.length > 5) {
        taskDescription = shortDesc + (content.length > 50 ? '...' : '')
      }
    }
  }

  // 生成锚点文本
  let anchor = template.replace('{task}', taskDescription)

  // 确保不超过最大长度
  if (anchor.length > maxLength) {
    anchor = anchor.substring(0, maxLength - 3) + '...'
  }

  return {
    anchor,
    reason: `上下文长度${userMessages.length}≥${minContextLength}，生成${anchor.length}字符锚点`
  }
}

interface ToolSelectionSignals {
  recentSuccessfulTools: string[]
  consecutiveFailures: Record<string, number>
}

interface ToolSubsetSelectionMeta {
  profileUsed: 'coding' | 'debug' | 'refactor' | 'research'
  excludedByConfig: number
  excludedByPattern: number
  droppedByMinScore: number
  mcpToolsSelected: number
  writeToolsSelected: number
}

/**
 * 检查是否需要触发反事实并行推演
 */
function shouldTriggerCounterfactual(
  query: string,
  config: CounterfactualConfig | undefined
): boolean {
  if (!config?.enabled) {
    return false
  }

  // 高风险关键词检测
  const highRiskKeywords = [
    'refactor',
    'migration',
    'rewrite',
    'critical',
    '重构',
    '迁移',
    '重写',
    '关键',
    '高风险',
    '重要修改',
    '重大变更',
  ]

  const lowerQuery = query.toLowerCase()
  const hasHighRiskKeyword = highRiskKeywords.some(keyword =>
    lowerQuery.includes(keyword.toLowerCase())
  )

  return hasHighRiskKeyword
}

/**
 * 根据优先级计算模型参数
 */
function calculateModelParamsByPriority(
  priority: 1 | 2 | 3 | 4,
  priorityConfig?: QueryEngineConfig['priorityConfig']
): { temperature?: number; maxTokens?: number } {
  const defaultTemperatureMap: Record<1 | 2 | 3 | 4, number> = {
    1: 0.8,  // 低优先级：较高温度，更创造性
    2: 0.7,  // 中优先级：中等温度
    3: 0.5,  // 高优先级：较低温度，更确定性
    4: 0.3,  // 紧急：最低温度，最确定性
  }

  const defaultMaxTokensMultiplierMap: Record<1 | 2 | 3 | 4, number> = {
    1: 0.8,  // 低优先级：较少token
    2: 1.0,  // 中优先级：标准token
    3: 1.2,  // 高优先级：较多token
    4: 1.5,  // 紧急：最多token
  }

  const baseMaxTokens = 8192

  // 使用配置的映射或默认映射
  const temperatureMap = priorityConfig?.temperatureMap ?? defaultTemperatureMap
  const maxTokensMultiplierMap = priorityConfig?.maxTokensMultiplierMap ?? defaultMaxTokensMultiplierMap

  const temperature = temperatureMap[priority]
  const maxTokens = Math.floor(baseMaxTokens * maxTokensMultiplierMap[priority])

  return { temperature, maxTokens }
}

/**
 * 根据优先级调整工具选择权重
 */
function calculateToolReliabilityWeightByPriority(
  priority: 1 | 2 | 3 | 4,
  priorityConfig?: QueryEngineConfig['priorityConfig']
): number {
  const defaultWeightMap: Record<1 | 2 | 3 | 4, number> = {
    1: 0.5,  // 低优先级：较低可靠性权重
    2: 1.0,  // 中优先级：标准可靠性权重
    3: 2.0,  // 高优先级：较高可靠性权重
    4: 3.0,  // 紧急：最高可靠性权重
  }

  const weightMap = priorityConfig?.toolReliabilityWeightMap ?? defaultWeightMap
  return weightMap[priority]
}

/**
 * 计算工具可靠性分数（0-10分）
 */
function calculateToolReliability(toolName: string): number {
  // 核心工具：最高可靠性
  const coreTools = ['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Edit', 'Git']
  if (coreTools.includes(toolName)) {
    return 10
  }

  // 内置工具：高可靠性
  const builtinTools = ['WebFetch', 'WebSearch', 'TodoWrite', 'AskUser', 'RewindFiles']
  if (builtinTools.includes(toolName)) {
    return 8
  }

  // MCP工具：中等可靠性
  if (toolName.startsWith('mcp__')) {
    return 6
  }

  // Skill工具：根据技能类型判断可靠性
  if (toolName.startsWith('skill__')) {
    const skillName = toolName.replace('skill__', '')
    // 核心技能：高可靠性
    const coreSkills = ['commit', 'skillify', 'update-config', 'review', 'simplify']
    if (coreSkills.includes(skillName)) {
      return 7
    }
    // 其他技能：中等可靠性
    return 5
  }

  // 其他工具：默认可靠性
  return 4
}

/**
 * 鏍稿績 Query Loop 鈥?async generator
 *
 * 鐢ㄦ硶锛? *   for await (const event of queryLoop(config, messages, tools)) {
 *     // 瀹炴椂澶勭悊姣忎竴姝ヤ簨浠? *   }
 */
export async function* queryLoop(
  config: QueryEngineConfig,
  initialMessages: Message[],
  toolRegistry: ToolRegistry,
  options?: {
    /** 鍒濆绯荤粺 prompt锛圡SA 浼氭敞鍏ュ埌杩欓噷锛?*/
    systemPrompt?: string
    /** 鍒濆妗ｄ綅 */
    initialGear?: 1 | 2 | 3
    /** 浠诲姟鎻忚堪锛堢敤浜?MSA L3 妫€绱級 */
    taskQuery?: string
    /** Cache break tracking source key */
    querySource?: string
  },
): AsyncGenerator<QueryEvent, QueryResult> {
  const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS
  const maxErrors = config.maxConsecutiveErrors ?? DEFAULT_MAX_CONSECUTIVE_ERRORS
  const cwd = config.cwd ?? process.cwd()
  const abortSignal = config.abortSignal
  const priority = config.priority ?? 2 // 默认中等优先级
  const sessionId = `session-${Date.now()}`
  const fileHistory = new FileHistoryManager({ cwd })

  // 上下文毒性熔断配置
  const toxicityConfig = config.contextToxicityBreaker ?? {}
  const maxFailedTurnsBeforeSnapshot = toxicityConfig.maxFailedTurnsBeforeSnapshot ?? DEFAULT_MAX_FAILED_TURNS_BEFORE_SNAPSHOT
  const enableFailureSnapshotReset = toxicityConfig.enableFailureSnapshotReset ?? DEFAULT_ENABLE_FAILURE_SNAPSHOT_RESET

  // 语义缓存配置
  const semanticCacheConfig = config.semanticCache ?? {}
  const semanticCacheEnabled = semanticCacheConfig.enabled ?? DEFAULT_SEMANTIC_CACHE_ENABLED
  const semanticCacheReadOnlyOnly = semanticCacheConfig.readOnlyOnly ?? DEFAULT_SEMANTIC_CACHE_READ_ONLY_ONLY

  // 注意力锚点配置
  const attentionAnchorConfig = config.attentionAnchor ?? {}
  const attentionAnchorEnabled = attentionAnchorConfig.enabled ?? DEFAULT_ATTENTION_ANCHOR_ENABLED
  const attentionAnchorTemplate = attentionAnchorConfig.template ?? DEFAULT_ATTENTION_ANCHOR_TEMPLATE
  const attentionAnchorMaxLength = attentionAnchorConfig.maxLength ?? DEFAULT_ATTENTION_ANCHOR_MAX_LENGTH
  const attentionAnchorMinContextLength = attentionAnchorConfig.minContextLength ?? DEFAULT_ATTENTION_ANCHOR_MIN_CONTEXT_LENGTH

  // Speculation配置
  const speculationConfig = config.speculation ?? {}
  const speculationEnabled = speculationConfig.enabled ?? false
  const speculationTriggerInterval = speculationConfig.triggerInterval ?? 5
  const speculationMinConfidence = speculationConfig.minConfidence ?? 0.5

  // 毒性熔断状态跟踪
  let consecutiveFailedTurns = 0
  let lastSuccessfulTurn = 0

  // 步骤级变速器
  const gearBox: StepGearBox = createGearBox()

  // Speculation管理器
  let speculationManager: EnhancedSpeculationManager | null = null
  if (speculationEnabled) {
    speculationManager = createSpeculationManager(speculationConfig)
  }

  // Mutable message history for the query loop.
  const messages: Message[] = []

  // 绯荤粺娑堟伅
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }

  // 鍒濆鐢ㄦ埛娑堟伅
  messages.push(...initialMessages)

  // 缁熻
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let turn = 0
  let lastAssistantText = ''
  let lastAssistantAt: number | null = null
  const querySource = options?.querySource ?? 'repl_main_thread'

  // 触发优先级事件
  yield { type: 'priority_set', priority }
  const toolSelectionSignals: ToolSelectionSignals = {
    recentSuccessfulTools: [],
    consecutiveFailures: {},
  }
  const transactionManager = new TransactionManager(fileHistory, cwd, config.toolTransaction)
  const toolBreakers = new Map<string, CircuitBreaker>()
  const circuitEnabled = config.toolCircuitBreaker?.enabled === true
  const circuitConfig = config.toolCircuitBreaker
  const trackTelemetry = (type: string, data: Record<string, any>) => {
    config.telemetry?.collector?.track(type, data)
  }

  const getToolBreaker = (toolName: string): CircuitBreaker => {
    const key = normalizeToolName(toolName)
    let breaker = toolBreakers.get(key)
    if (!breaker) {
      breaker = new CircuitBreaker({
        failureThreshold: circuitConfig?.failureThreshold,
        successThreshold: circuitConfig?.successThreshold,
        cooldownMs: circuitConfig?.cooldownMs,
      })
      toolBreakers.set(key, breaker)
    }
    return breaker
  }

  // 记忆提取辅助函数
  // 收集所有事件用于生成Agent Summary
  const allEvents: QueryEvent[] = []

  async function extractAndAddMemories(result: QueryResult): Promise<QueryResult> {
    // 检查是否启用记忆提取
    if (config.memoryExtraction?.enabled === false) {
      return result
    }

    try {
      const extraction = await extractMemories(
        result.messages,
        config.llmCall,
        effectiveSessionId,
        config.memoryExtraction?.qualityThreshold ?? 0.6 // 质量阈值
      )

      // 如果有持久化回调，调用它
      if (config.memoryExtraction?.persistCallback && extraction.memories.length > 0) {
        for (const memory of extraction.memories) {
          await config.memoryExtraction.persistCallback(memory).catch(e =>
            console.warn(`[QueryLoop] Memory persist failed: ${e.message}`)
          )
        }
      }

      return {
        ...result,
        extractedMemories: extraction.memories
      }
    } catch (error: any) {
      console.warn(`[QueryLoop] Memory extraction failed: ${error.message}`)
      return result
    }
  }

  async function generateAgentSummary(result: QueryResult): Promise<QueryResult> {
    // 检查是否启用Agent Summary
    if (config.agentSummary?.enabled === false) {
      return result
    }

    try {
      // 生成Agent ID（基于会话ID和任务查询）
      const agentId = `agent-${effectiveSessionId}-${options?.taskQuery ? Buffer.from(options.taskQuery).toString('hex').slice(0, 8) : Date.now().toString(36)}`

      // 生成Agent Summary
      const agentSummary = agentSummaryManager.generateSummaryFromQueryResult(
        agentId,
        effectiveSessionId,
        result,
        allEvents
      )

      // 生成摘要文本
      const summaryText = agentSummaryManager.generateSummaryText(agentSummary)

      console.log(`[AgentSummary] 生成智能体摘要: ${agentId} (状态: ${agentSummary.status})`)

      return {
        ...result,
        agentSummary: {
          ...agentSummary,
          summaryText
        }
      }
    } catch (error: any) {
      console.warn(`[AgentSummary] 生成智能体摘要失败: ${error.message}`)
      return result
    }
  }

  async function finalizeResult(result: QueryResult): Promise<QueryResult> {
    // 先提取记忆
    const withMemories = await extractAndAddMemories(result)
    // 再生成Agent Summary
    return await generateAgentSummary(withMemories)
  }

  // 会话摘要管理器
  const sessionSummaryManager = new SessionSummaryManager(
    {
      enabled: config.sessionSummary?.enabled ?? true,
      updateInterval: config.sessionSummary?.updateInterval ?? 10,
      maxLength: config.sessionSummary?.maxLength ?? 1000,
    },
    config.llmCall
  )

  // 智能体摘要管理器
  const agentSummaryManager = new AgentSummaryManager(
    config.agentSummary ?? {
      enabled: true,
      template: 'standard',
      autoGenerate: true,
      minLength: 100,
      maxLength: 1000,
    }
  )

  // 会话存储（用于会话摘要）
  const sessionStore = new SessionStore()

  // 创建会话记录
  const sessionTitle = options?.taskQuery ? `Query: ${options.taskQuery.slice(0, 50)}` : `Session ${new Date().toLocaleString()}`
  const sessionData = sessionStore.create(cwd, sessionTitle)
  // 使用创建的sessionId，而不是之前生成的
  const effectiveSessionId = sessionData.meta.id

  // 会话记忆功能
  const sessionMemoryEnabled = config.sessionMemory?.enabled ?? true
  const sessionMemoryUpdateInterval = config.sessionMemory?.updateInterval ?? 5
  const sessionMemoryMinImportance = config.sessionMemory?.minImportance ?? 0.3
  const sessionMemoryMaxNotes = config.sessionMemory?.maxNotes ?? 20
  const sessionMemoryAutoGenerate = config.sessionMemory?.autoGenerate ?? true
  const sessionMemorySummaryMaxLength = config.sessionMemory?.summaryMaxLength ?? 500

  // 会话记忆更新跟踪
  let lastMemoryUpdateTurn = 0

  // ── 反事实并行推演触发检查 ──
  let counterfactualResult: CounterfactualSessionResult | null = null
  const counterfactualConfig = config.counterfactual ?? {}

  // 检查是否需要触发反事实并行推演（仅在第一次循环前）
  if (shouldTriggerCounterfactual(options?.taskQuery || '', counterfactualConfig)) {
    try {
      console.log(`[Counterfactual] 🔍 Detected high-risk query, triggering counterfactual analysis...`)

      counterfactualResult = await runCounterfactualBranches(
        options?.taskQuery || '',
        messages,
        config.llmCall,
        toolRegistry,
        counterfactualConfig
      )

      if (counterfactualResult && counterfactualResult.branches.length > 0) {
        console.log(`[Counterfactual] ✅ Analysis completed: ${counterfactualResult.branches.length} branches, winner=${counterfactualResult.winnerBranchId || 'none'}`)

        // 将反事实结果注入为结构化上下文
        const contextMessage: Message = {
          role: 'system',
          content: `## 反事实并行推演分析结果

以下是对当前高风险任务的并行推演分析结果，供您参考：

${counterfactualResult.summary || '无汇总摘要'}

**建议**：${counterfactualResult.reason || '请参考上述分析结果进行决策'}

**注意**：此分析仅供参考，最终决策仍需基于实际情况。`,
        }

        // 在系统消息后插入
        const systemMessageIndex = messages.findIndex(m => m.role === 'system')
        if (systemMessageIndex >= 0) {
          messages.splice(systemMessageIndex + 1, 0, contextMessage)
        } else {
          // 如果没有系统消息，添加到开头
          messages.unshift(contextMessage)
        }
      }
    } catch (error) {
      // 降级处理：任何异常都不能中断主链
      console.warn(`[Counterfactual] ⚠️  Counterfactual analysis failed, degrading gracefully: ${error}`)
    }
  }

  // ── 主循环 ──
  while (true) {
    turn++
    let turnSuccessful = false // 跟踪当前轮次是否成功

    // 鈹€鈹€ Speculation触发检查（每N轮） 鈹€鈹€
    if (speculationEnabled && speculationManager && turn % speculationTriggerInterval === 0) {
      try {
        const latestUserMessage = [...messages].reverse().find(m => m.role === 'user')
        if (latestUserMessage) {
          const query = typeof latestUserMessage.content === 'string'
            ? latestUserMessage.content
            : JSON.stringify(latestUserMessage.content)

          yield { type: 'speculation_started', strategyCount: speculationManager.getRegisteredStrategies().length, query }

          const results = await speculationManager.speculateEnhanced({
            messages,
            tools: toolRegistry.getAll(),
            cwd,
            sessionId: effectiveSessionId,
            gear: gearBox.getGear(),
            query,
          })

          yield { type: 'speculation_executed', results: results.length, successful: results.filter(r => r.success).length, durationMs: 0 }

          // 记录高置信度的结果
          const highConfidenceResults = results.filter(r => r.confidence >= speculationMinConfidence)
          for (const result of highConfidenceResults) {
            yield { type: 'speculation_result', planId: result.planId, strategy: result.strategy, success: result.success, confidence: result.confidence }
          }
        }
      } catch (error: any) {
        console.warn(`[Speculation] Failed to execute speculation: ${error.message}`)
      }
    }

    // ── 上下文毒性熔断检查（每轮开始） ──
    if (enableFailureSnapshotReset && consecutiveFailedTurns >= maxFailedTurnsBeforeSnapshot) {
      console.warn(`[ContextToxicityBreaker] 连续 ${consecutiveFailedTurns} 轮失败，触发快照重启`)

      // 生成最小状态快照
      const snapshot = createMinimalSnapshot(gearBox, cwd, effectiveSessionId, options?.taskQuery)

      // 保存系统消息和最新用户指令
      const systemMessages = messages.filter(m => m.role === 'system')
      const latestUserMessage = [...messages].reverse().find(m => m.role === 'user')

      // 清空消息历史，仅保留系统基座 + 快照 + 最新用户指令
      messages.length = 0
      messages.push(...systemMessages)

      // 添加快照作为系统消息
      messages.push({
        role: 'system',
        content: `## 上下文快照重启\n由于连续 ${consecutiveFailedTurns} 轮失败，已重置上下文。\n快照状态：${JSON.stringify(snapshot, null, 2)}`
      })

      if (latestUserMessage) {
        messages.push(latestUserMessage)
      }

      // 重置失败计数
      const previousFailedTurns = consecutiveFailedTurns
      consecutiveFailedTurns = 0
      lastSuccessfulTurn = turn

      // 发出快照重启事件
      yield {
        type: 'context_snapshot_reset',
        reason: `连续 ${previousFailedTurns} 轮失败超过阈值 ${maxFailedTurnsBeforeSnapshot}`,
        failedTurns: previousFailedTurns,
        messagesKept: messages.length,
        messagesDiscarded: previousFailedTurns * 3 // 粗略估计
      }

      console.log(`[ContextToxicityBreaker] 快照重启完成，保留 ${messages.length} 条消息`)
    }

    // 鈹€鈹€ 会话记忆更新（每轮开始） 鈹€鈹€
    if (sessionMemoryEnabled && turn - lastMemoryUpdateTurn >= sessionMemoryUpdateInterval) {
      try {
        // 更新会话摘要
        await sessionSummaryManager.updateSessionSummary(
          sessionStore,
          effectiveSessionId,
          messages,
          turn,
          false // 不强制更新
        )

        // 自动生成记忆笔记
        if (sessionMemoryAutoGenerate) {
          const memoryNotes = await sessionSummaryManager.generateMemoryNotesFromMessages(
            effectiveSessionId,
            messages,
            turn,
            config.llmCall
          )
          console.log(`[SessionMemory] 生成 ${memoryNotes.length} 条记忆笔记 (轮次 ${turn})`)
        }

        // 清理过期记忆
        const expiredCount = sessionSummaryManager.cleanupExpiredMemoryNotes(effectiveSessionId)
        if (expiredCount > 0) {
          console.log(`[SessionMemory] 清理 ${expiredCount} 条过期记忆笔记`)
        }

        lastMemoryUpdateTurn = turn
      } catch (error: any) {
        console.warn(`[SessionMemory] 记忆更新失败（非致命）: ${error.message}`)
        // 失败降级：继续执行主链
      }
    }

    // 鈹€鈹€ Auto Compact: 涓婁笅鏂囧帇缂╋紙姣忚疆寮€濮嬫鏌ワ級 鈹€鈹€
    if (turn > 1) {  // 绗竴杞笉鍘嬶紙鍒氬紑濮嬶級
      try {
        const compactResult = await autoCompactIfNeeded(messages, config.llmCall)
        if (compactResult.wasCompacted) {
          // 鏇挎崲娑堟伅鍘嗗彶
          messages.length = 0
          messages.push(...compactResult.messages)
          console.log(
            `[QueryLoop] Auto-compact: ${compactResult.compactType} ` +
            `(${compactResult.tokensBefore} 鈫?${compactResult.tokensAfter} tokens, ` +
            `removed ${compactResult.messagesRemoved} msgs)`
          )
          notifyCompaction(querySource)
        }
      } catch (e: any) {
        console.warn(`[QueryLoop] Compact failed (non-fatal): ${e.message}`)
      }
    }

    // 鈹€鈹€ 閫€鍑猴細瓒呰繃鏈€澶ц疆娆?鈹€鈹€
    if (turn > maxTurns) {
      const result: QueryResult = {
        finalMessage: lastAssistantText || '[杈惧埌鏈€澶ц疆娆￠檺鍒禲',
        exitReason: 'max_turns',
        turns: turn - 1,
        totalUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        finalGear: gearBox.getGear(),
        messages: [...messages],
      }
      yield { type: 'completed', reason: 'max_turns', finalMessage: result.finalMessage, turns: result.turns }
      return await finalizeResult(result)
    }

    // 鈹€鈹€ 閫€鍑猴細鐢ㄦ埛鍙栨秷 鈹€鈹€
    if (abortSignal?.aborted) {
      const result: QueryResult = {
        finalMessage: lastAssistantText || '[鐢ㄦ埛鍙栨秷]',
        exitReason: 'aborted',
        turns: turn - 1,
        totalUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        finalGear: gearBox.getGear(),
        messages: [...messages],
      }
      yield { type: 'completed', reason: 'aborted', finalMessage: result.finalMessage, turns: result.turns }
      return await finalizeResult(result)
    }

    // 鈹€鈹€ 閫€鍑猴細杩炵画閿欒杩囧 鈫?HITL 鈹€鈹€
    const gearState = gearBox.getState()
    if (gearState.consecutiveErrors >= maxErrors) {
      const result: QueryResult = {
        finalMessage: `[杩炵画閿欒 ${gearState.consecutiveErrors} 娆★紝闇€瑕佷汉宸ヤ粙鍏`,
        exitReason: 'max_errors',
        turns: turn - 1,
        totalUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        finalGear: gearBox.getGear(),
        messages: [...messages],
      }
      yield { type: 'completed', reason: 'max_errors', finalMessage: result.finalMessage, turns: result.turns }
      return await finalizeResult(result)
    }

    // 鈹€鈹€ Step 1: 閫夋。 + 閫夋ā鍨?鈹€鈹€
    const currentGear = gearBox.getGear()
    const model = gearBox.getModel()
    const selection = selectToolSubsetForTurn({
      toolRegistry,
      messages,
      config,
      currentGear,
      signals: toolSelectionSignals,
      queryHint: options?.taskQuery,
    })
    const toolSchemas = selection.schemas
    yield {
      type: 'tool_subset_selected',
      totalTools: toolRegistry.getSchemas().length,
      selectedTools: toolSchemas.length,
      selectedToolNames: toolSchemas.map(t => t.name),
      profileUsed: selection.meta.profileUsed,
      excludedByConfig: selection.meta.excludedByConfig,
      excludedByPattern: selection.meta.excludedByPattern,
      droppedByMinScore: selection.meta.droppedByMinScore,
      mcpToolsSelected: selection.meta.mcpToolsSelected,
      writeToolsSelected: selection.meta.writeToolsSelected,
    }
    const systemPrompt = messages
      .filter(m => m.role === 'system')
      .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      .join('\n\n')

    // 语义缓存旁路检查
    const selectedToolNames = toolSchemas.map(t => t.name)
    const bypassCheck = shouldBypassSemanticCache(
      selectedToolNames,
      semanticCacheEnabled,
      semanticCacheReadOnlyOnly
    )

    if (bypassCheck.bypass) {
      yield {
        type: 'semantic_cache_bypass',
        reason: bypassCheck.reason,
        toolNames: bypassCheck.bypassTools
      }
      console.warn(`[SemanticCache] 旁路语义缓存: ${bypassCheck.reason}`)
    }

    recordPromptState({
      querySource,
      systemPrompt,
      toolSchemas,
      model,
    })

    const turnStartEvent = { type: 'turn_start', turn, gear: currentGear, model } as const
    allEvents.push(turnStartEvent)
    yield turnStartEvent

    // 鈹€鈹€ 注入会话记忆摘要到系统提示 鈹€鈹€
    const memorySummary = sessionMemoryEnabled
      ? sessionSummaryManager.getMemorySummary(effectiveSessionId, sessionMemorySummaryMaxLength)
      : ''

    let messagesWithMemory = [...messages]
    if (memorySummary) {
      // 查找系统消息并追加记忆摘要
      const systemMessageIndex = messagesWithMemory.findIndex(m => m.role === 'system')
      if (systemMessageIndex !== -1) {
        const systemMessage = messagesWithMemory[systemMessageIndex]
        const currentContent = typeof systemMessage.content === 'string'
          ? systemMessage.content
          : JSON.stringify(systemMessage.content)

        const enhancedContent = `${currentContent}\n\n## 会话记忆摘要\n${memorySummary}`
        messagesWithMemory[systemMessageIndex] = {
          ...systemMessage,
          content: enhancedContent,
        }
      } else {
        // 如果没有系统消息，添加一个
        messagesWithMemory.unshift({
          role: 'system',
          content: `## 会话记忆摘要\n${memorySummary}`,
        })
      }
    }

    // 鈹€鈹€ 注入注意力锚点（降低长上下文遗忘风险） 鈹€鈹€
    const anchorResult = generateAttentionAnchor(
      messagesWithMemory,
      attentionAnchorEnabled,
      attentionAnchorTemplate,
      attentionAnchorMaxLength,
      attentionAnchorMinContextLength,
      options?.taskQuery
    )

    if (anchorResult.anchor) {
      console.log(`[AttentionAnchor] ${anchorResult.reason}: "${anchorResult.anchor}"`)

      // 查找最后一条用户消息并追加锚点
      for (let i = messagesWithMemory.length - 1; i >= 0; i--) {
        if (messagesWithMemory[i].role === 'user') {
          const userMessage = messagesWithMemory[i]
          const currentContent = typeof userMessage.content === 'string'
            ? userMessage.content
            : JSON.stringify(userMessage.content)

          messagesWithMemory[i] = {
            ...userMessage,
            content: `${currentContent}/n/n${anchorResult.anchor}`
          }
          break
        }
      }

      // 触发注意力锚点事件
      yield {
        type: 'attention_anchor_applied',
        reason: anchorResult.reason,
        anchor: anchorResult.anchor,
        contextLength: messagesWithMemory.filter(m => m.role === 'user').length
      }
    }

    // 鈹€鈹€ Step 2: 璋冪敤 LLM 鈹€鈹€
    let response: LLMResponse
    try {
      // 根据优先级调整模型参数
      const priority = config.priority ?? 2
      const priorityConfig = config.priorityConfig
      const modelParams = calculateModelParamsByPriority(priority, priorityConfig)

      const llmOptions = {
        model,
        maxTokens: model === 'deepseek-reasoner' ? 65536 : 8192,
        abortSignal,
      }

      // 应用优先级调整
      if (priorityConfig?.affectModelParams !== false) {
        if (modelParams.temperature !== undefined) {
          ;(llmOptions as any).temperature = modelParams.temperature
        }
        if (modelParams.maxTokens !== undefined) {
          ;(llmOptions as any).maxTokens = modelParams.maxTokens
        }
      }

      response = await config.llmCall(
        messagesWithMemory,
        toolSchemas,
        llmOptions,
      )
    } catch (error: any) {
      gearBox.reportLLMError(error)
      const errorEvent = { type: 'error', error, recoverable: true } as const
      allEvents.push(errorEvent)
      yield errorEvent

      // 娉ㄥ叆閿欒淇℃伅鍒板璇濓紝璁╀笅涓€杞?LLM 鐪嬪埌
      messages.push({
        role: 'assistant',
        content: `[API Error: ${error.message}]`,
      })

      // API 杩炵画澶辫触 3 娆?鈫?涓嶅彲鎭㈠
      if (gearState.consecutiveErrors >= 3) {
        const result: QueryResult = {
          finalMessage: `[API 杩炵画澶辫触: ${error.message}]`,
          exitReason: 'api_error',
          turns: turn,
          totalUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
          finalGear: gearBox.getGear(),
          messages: [...messages],
        }
        yield { type: 'completed', reason: 'api_error', finalMessage: result.finalMessage, turns: result.turns }
        return await finalizeResult(result)
      }

      // 轮次失败：LLM API错误
      consecutiveFailedTurns++
      console.warn(`[ContextToxicityBreaker] LLM API错误，连续失败轮次：${consecutiveFailedTurns}/${maxFailedTurnsBeforeSnapshot}`)

      continue  // 閲嶈瘯
    }

    yield { type: 'llm_response', response }

    const usage = response.usage ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      cacheHit: false,
    }

    const cacheBreak = checkResponseForCacheBreak({
      querySource,
      usage,
      sinceLastAssistantMs: lastAssistantAt === null ? null : Date.now() - lastAssistantAt,
    })
    if (cacheBreak) {
      console.warn(
        `[PromptCacheBreak] ${cacheBreak.reason} ` +
        `[source=${cacheBreak.querySource}, cache read: ${cacheBreak.prevCacheReadTokens} -> ${cacheBreak.cacheReadTokens}]`
      )
      yield {
        type: 'cache_break',
        reason: cacheBreak.reason,
        querySource: cacheBreak.querySource,
        prevCacheReadTokens: cacheBreak.prevCacheReadTokens,
        cacheReadTokens: cacheBreak.cacheReadTokens,
        tokenDrop: cacheBreak.tokenDrop,
      }
    }

    // 鏇存柊缁熻
    totalInputTokens += usage.inputTokens
    totalOutputTokens += usage.outputTokens

    // 璁板綍 assistant 鏂囨湰
    if (response.content) {
      lastAssistantText = response.content
    }
    lastAssistantAt = Date.now()

    // 鈹€鈹€ Step 3: 妫€鏌ユ槸鍚﹂渶瑕佹墽琛屽伐鍏?鈹€鈹€
    if (response.stopReason !== 'tool_use' || response.toolCalls.length === 0) {
      // LLM 璇村畬浜?鈥?姝ｅ父閫€鍑?      gearBox.reportSuccess()
      turnSuccessful = true
      consecutiveFailedTurns = 0
      lastSuccessfulTurn = turn

      const result: QueryResult = {
        finalMessage: lastAssistantText,
        exitReason: 'end_turn',
        turns: turn,
        totalUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        finalGear: gearBox.getGear(),
        messages: [...messages],
      }
      yield { type: 'completed', reason: 'end_turn', finalMessage: result.finalMessage, turns: result.turns }
      return await finalizeResult(result)
    }

    // 鈹€鈹€ Step 4: 杩藉姞 assistant 娑堟伅锛堝惈 tool_calls锛?鈹€鈹€
    messages.push({
      role: 'assistant',
      content: response.content || '',
      toolCalls: response.toolCalls,
      reasoning: response.reasoning,
    })

    // 鈹€鈹€ Step 5: 鎵ц宸ュ叿 鈹€鈹€
    const toolContext: ToolContext = {
      cwd,
      sessionId: effectiveSessionId,
      gear: currentGear,
      fileHistory,
      abortSignal,
    }

    const toolResults: ToolResult[] = []
    const txId = `tx-turn-${turn}-${Date.now()}`
    if (transactionManager.isEnabled()) {
      transactionManager.begin(txId)
    }
    const maxToolCallsPerTurn = Math.max(1, config.maxToolCallsPerTurn ?? DEFAULT_MAX_TOOL_CALLS_PER_TURN)
    if (response.toolCalls.length > maxToolCallsPerTurn) {
      yield {
        type: 'tool_calls_capped',
        requested: response.toolCalls.length,
        executed: maxToolCallsPerTurn,
        cap: maxToolCallsPerTurn,
      }
    }
    const turnToolCalls = response.toolCalls.slice(0, maxToolCallsPerTurn)
    const toolCallById = new Map(turnToolCalls.map(tc => [tc.id, tc]))
    const skippedToolUseIds = new Set<string>()
    const executableCalls: Array<{ name: string; input: Record<string, any>; toolUseId: string }> = []

    for (const tc of turnToolCalls) {
      if (circuitEnabled) {
        const breaker = getToolBreaker(tc.name)
        if (!breaker.canRequest()) {
          const snapshot = breaker.getSnapshot()
          yield {
            type: 'tool_skipped_by_circuit_breaker',
            toolName: tc.name,
            toolUseId: tc.id,
            state: snapshot.state,
            consecutiveFailures: snapshot.consecutiveFailures,
            openedAt: snapshot.openedAt,
          }
          toolResults.push({
            toolUseId: tc.id,
            content: `Tool "${tc.name}" skipped by circuit breaker (${snapshot.state}).`,
            isError: true,
          })
          skippedToolUseIds.add(tc.id)
          continue
        }
      }
      if (transactionManager.isEnabled() && isWriteLikeTool(tc.name)) {
        for (const filePath of extractTrackableFilePaths(tc.arguments, config.toolTransaction?.trackArgumentKeys)) {
          transactionManager.track(filePath)
        }
      }
      const toolStartEvent = { type: 'tool_start', toolName: tc.name, toolUseId: tc.id, input: tc.arguments } as const
      allEvents.push(toolStartEvent)
      yield toolStartEvent
      executableCalls.push({
        name: tc.name,
        input: tc.arguments,
        toolUseId: tc.id,
      })
    }
    if (transactionManager.isEnabled()) {
      transactionManager.snapshotStart()
      const txState = transactionManager.getState()
      if (txState.active && txState.trackedFiles.length > 0) {
        yield {
          type: 'transaction_started',
          txId: txState.txId ?? txId,
          trackedFiles: txState.trackedFiles,
        }
        trackTelemetry('transaction_started', {
          txId: txState.txId ?? txId,
          trackedFilesCount: txState.trackedFiles.length,
        })
      }
    }

    if (abortSignal?.aborted) break

    const executionMode = config.toolExecution?.mode ?? 'batch'
    const batchResults = executableCalls.length === 0
      ? []
      : executionMode === 'sequential'
        ? await executeSequentially(toolRegistry, executableCalls, toolContext)
        : await toolRegistry.executeBatch(executableCalls, toolContext)

    for (const result of batchResults) {
      const tc = toolCallById.get(result.toolUseId)
      const toolName = tc?.name ?? 'unknown'
      toolResults.push(result)
      if (circuitEnabled && tc) {
        const breaker = getToolBreaker(tc.name)
        if (result.isError) breaker.recordFailure()
        else breaker.recordSuccess()
      }
      updateToolSelectionSignals(toolSelectionSignals, toolName, result.isError, config)

      const toolResultEvent = { type: 'tool_result', toolName, toolUseId: result.toolUseId, result } as const
      allEvents.push(toolResultEvent)
      yield toolResultEvent

      // 记录工具执行遥测
      trackTelemetry('tool_execution', {
        tool: toolName,
        isError: result.isError,
        durationMs: result.meta?.durationMs,
        isSkill: toolName.startsWith('skill__'),
        skillName: toolName.startsWith('skill__') ? toolName.replace('skill__', '') : undefined,
      })

      const prevGear = gearBox.getGear()
      gearBox.reportToolResult(result, toolName)
      const newGear = gearBox.getGear()

      if (newGear !== prevGear) {
        yield { type: 'gear_shift', from: prevGear, to: newGear, reason: result.isError ? 'tool_error' : 'test_result' }
      }

      if (toolName === 'Bash') {
        const gs = gearBox.getState()
        const lastTest = gs.testHistory[gs.testHistory.length - 1]
        if (lastTest?.passed) {
          yield { type: 'test_detected', passed: true, output: result.content.slice(0, 200) }
        }
        if (lastTest && !lastTest.passed) {
          yield { type: 'test_detected', passed: false, output: result.content.slice(0, 200) }
        }
      }
    }

    for (const skipped of toolResults.filter(r => !batchResults.some(br => br.toolUseId === r.toolUseId))) {
      const tc = toolCallById.get(skipped.toolUseId)
      const toolName = tc?.name ?? 'unknown'
      updateToolSelectionSignals(toolSelectionSignals, toolName, skipped.isError, config)
      const toolResultEvent2 = { type: 'tool_result', toolName, toolUseId: skipped.toolUseId, result: skipped } as const
      allEvents.push(toolResultEvent2)
      yield toolResultEvent2

      const prevGear = gearBox.getGear()
      gearBox.reportToolResult(skipped, toolName)
      const newGear = gearBox.getGear()
      if (newGear !== prevGear) {
        yield { type: 'gear_shift', from: prevGear, to: newGear, reason: 'tool_error' }
      }
    }

    if (transactionManager.isEnabled()) {
      const txState = transactionManager.getState()
      if (txState.active) {
        const rollbackOnSkipped = config.toolTransaction?.rollbackOnSkipped === true
        const hasError = toolResults.some(r => {
          if (!r.isError) return false
          if (rollbackOnSkipped) return true
          return !skippedToolUseIds.has(r.toolUseId)
        })
        if (hasError && transactionManager.shouldRollbackOnToolError()) {
          const filesChanged = transactionManager.rollback()
          if (txState.trackedFiles.length > 0) {
            yield {
              type: 'transaction_rolled_back',
              txId: txState.txId ?? txId,
              filesChanged,
              reason: 'tool_error',
            }
            trackTelemetry('transaction_rolled_back', {
              txId: txState.txId ?? txId,
              filesChangedCount: filesChanged.length,
            })
          }
        } else {
          transactionManager.commit()
          if (txState.trackedFiles.length > 0) {
            yield {
              type: 'transaction_committed',
              txId: txState.txId ?? txId,
              trackedFiles: txState.trackedFiles,
            }
            trackTelemetry('transaction_committed', {
              txId: txState.txId ?? txId,
              trackedFilesCount: txState.trackedFiles.length,
            })
          }
        }
      }
    }
// 鈹€鈹€ Step 6: 灏?tool results 杩藉姞鍒版秷鎭巻鍙?鈹€鈹€
    for (const tr of toolResults) {
      messages.push({
        role: 'tool',
        content: tr.content,
        toolCallId: tr.toolUseId,
      })
    }

    // 鈹€鈹€ Step 7: 会话摘要更新（每N轮）鈹€鈹€
    if (config.sessionSummary?.enabled !== false) {
      try {
        await sessionSummaryManager.updateSessionSummary(sessionStore, effectiveSessionId, messages, turn)
      } catch (error: any) {
        console.warn(`[QueryLoop] Session summary update failed: ${error.message}`)
      }
    }

    // 鈹€鈹€ 更新失败计数（仅当轮次未成功完成时到达这里）鈹€鈹€
    if (!turnSuccessful) {
      // 检查是否有工具执行成功
      const hasSuccessfulToolExecution = toolResults.some(r => !r.isError)
      if (!hasSuccessfulToolExecution) {
        consecutiveFailedTurns++
        console.warn(`[ContextToxicityBreaker] 轮次 ${turn} 失败，连续失败轮次：${consecutiveFailedTurns}/${maxFailedTurnsBeforeSnapshot}`)
      } else {
        // 有工具执行成功，重置失败计数
        consecutiveFailedTurns = 0
      }
    }

    // 鈹€鈹€ 缁х画 loop锛氬洖鍒?Step 1锛孡LM 浼氱湅鍒?tool results 鈹€鈹€
  }
}

/**
 * 绠€鍖栫増鍏ュ彛 鈥?杩愯涓€娆″畬鏁寸殑 query锛岃繑鍥炴渶缁堢粨鏋? *
 * 鐢ㄦ硶锛? *   const result = await runQuery(config, [{ role: 'user', content: '...' }], registry)
 */
export async function runQuery(
  config: QueryEngineConfig,
  initialMessages: Message[],
  toolRegistry: ToolRegistry,
  options?: Parameters<typeof queryLoop>[3],
): Promise<QueryResult> {
  let lastResult: QueryResult | undefined

  for await (const event of queryLoop(config, initialMessages, toolRegistry, options)) {
    if (event.type === 'completed') {
      // completed 浜嬩欢鍚?generator 浼?return QueryResult
    }

    // 鍙互鍦ㄨ繖閲屽姞鏃ュ織
    if (event.type === 'turn_start') {
      console.log(`[QueryEngine] Turn ${event.turn}, gear=${event.gear}, model=${event.model}`)
    }
    if (event.type === 'gear_shift') {
      console.log(`[QueryEngine] Gear ${event.from}鈫?{event.to}: ${event.reason}`)
    }
  }

  // async generator 鐨?return value 闇€瑕侀€氳繃 .next() 鑾峰彇
  // 鐢?for-await 浼氫涪澶?return value锛屾墍浠ユ墜鍔ㄨ繍琛?  const gen = queryLoop(config, initialMessages, toolRegistry, options)
  let result: IteratorResult<QueryEvent, QueryResult>
  do {
    result = await gen.next()
  } while (!result.done)

  return result.value
}

function selectToolSubsetForTurn(input: {
  toolRegistry: ToolRegistry
  messages: Message[]
  config: QueryEngineConfig
  currentGear: 1 | 2 | 3
  signals?: ToolSelectionSignals
  queryHint?: string
}): { schemas: ToolSchema[]; meta: ToolSubsetSelectionMeta } {
  const { toolRegistry, messages, config, currentGear, signals, queryHint } = input
  const allSchemas = toolRegistry.getSchemas()
  const subsetConfig = config.toolSubset ?? {}
  const excludeSet = new Set((subsetConfig.excludeTools ?? []).map(normalizeToolName).filter(Boolean))
  const excludePatterns = (subsetConfig.excludePatterns ?? []).map(s => s.trim()).filter(Boolean)
  const candidateSchemas = excludeSet.size > 0
    ? allSchemas.filter(s => !excludeSet.has(normalizeToolName(s.name)))
    : allSchemas
  const finalCandidates = excludePatterns.length > 0
    ? candidateSchemas.filter(s => !excludePatterns.some(p => wildcardMatch(s.name, p)))
    : candidateSchemas

  const contextText = buildToolSelectionText(messages, queryHint)
  const profile = resolveToolProfile(contextText, subsetConfig.profile)
  const baseMeta = {
    profileUsed: profile,
    excludedByConfig: (subsetConfig.excludeTools ?? []).filter(Boolean).length,
    excludedByPattern: (subsetConfig.excludePatterns ?? []).filter(Boolean).length,
    droppedByMinScore: 0,
    mcpToolsSelected: 0,
    writeToolsSelected: 0,
  } satisfies ToolSubsetSelectionMeta

  if (subsetConfig.enabled === false) {
    const schemas = applyToolFamilyCaps(finalCandidates, subsetConfig)
    return {
      schemas,
      meta: {
        ...baseMeta,
        mcpToolsSelected: schemas.filter(s => isMcpTool(s.name)).length,
        writeToolsSelected: schemas.filter(s => isWriteLikeTool(s.name)).length,
      },
    }
  }
  if (finalCandidates.length <= 1) {
    return {
      schemas: finalCandidates,
      meta: {
        ...baseMeta,
        mcpToolsSelected: finalCandidates.filter(s => isMcpTool(s.name)).length,
        writeToolsSelected: finalCandidates.filter(s => isWriteLikeTool(s.name)).length,
      },
    }
  }

  const baseMax = Math.max(1, subsetConfig.maxTools ?? DEFAULT_TOOL_SUBSET_MAX)
  const minTools = Math.max(1, subsetConfig.minTools ?? DEFAULT_TOOL_SUBSET_MIN)
  const allowFallbackToMin = subsetConfig.fallbackToTopMinWhenBelowMinScore ?? true
  const gearBoost = currentGear >= 2 ? 4 : 0
  const maxTools = Math.max(minTools, baseMax + gearBoost)
  if (finalCandidates.length <= maxTools) {
    const schemas = applyToolFamilyCaps(finalCandidates, subsetConfig)
    return {
      schemas,
      meta: {
        ...baseMeta,
        mcpToolsSelected: schemas.filter(s => isMcpTool(s.name)).length,
        writeToolsSelected: schemas.filter(s => isWriteLikeTool(s.name)).length,
      },
    }
  }

  const desired = new Set<string>((subsetConfig.alwaysInclude ?? []).map(normalizeToolName).filter(Boolean))
  const alwaysIncludePatterns = (subsetConfig.alwaysIncludePatterns ?? []).map(s => s.trim()).filter(Boolean)
  for (const schema of finalCandidates) {
    if (alwaysIncludePatterns.some(p => wildcardMatch(schema.name, p))) {
      desired.add(normalizeToolName(schema.name))
    }
  }
  for (const name of (subsetConfig.preferTools ?? []).map(normalizeToolName).filter(Boolean)) {
    desired.add(name)
  }
  const preferPatterns = (subsetConfig.preferPatterns ?? []).map(s => s.trim()).filter(Boolean)
  for (const schema of finalCandidates) {
    if (preferPatterns.some(p => wildcardMatch(schema.name, p))) {
      desired.add(normalizeToolName(schema.name))
    }
  }
  for (const name of inferAlwaysIncludeTools(contextText).map(normalizeToolName)) desired.add(name)
  const rawScored = finalCandidates.map(schema => ({
    schema,
    score: scoreToolSchema(schema, contextText, signals, config, profile),
  }))
  const minScore = subsetConfig.minScore ?? Number.NEGATIVE_INFINITY
  let droppedByMinScore = 0
  let scored = rawScored
  if (Number.isFinite(minScore)) {
    scored = rawScored.filter(entry => entry.score >= minScore)
    droppedByMinScore = rawScored.length - scored.length
    if (allowFallbackToMin && scored.length < minTools) {
      scored = rawScored
    }
  }

  scored.sort((a, b) => b.score - a.score || a.schema.name.localeCompare(b.schema.name))

  const picked = new Map<string, ToolSchema>()

  for (const mustHave of desired) {
    const found = finalCandidates.find(s => normalizeToolName(s.name) === mustHave)
    if (found) picked.set(found.name, found)
  }

  for (const entry of scored) {
    if (picked.size >= maxTools) break
    picked.set(entry.schema.name, entry.schema)
  }

  if (allowFallbackToMin && picked.size < minTools) {
    for (const schema of finalCandidates) {
      if (picked.size >= minTools) break
      picked.set(schema.name, schema)
    }
  }

  let selected = Array.from(picked.values()).sort((a, b) => a.name.localeCompare(b.name))
  selected = applyToolFamilyCaps(selected, subsetConfig)

  return {
    schemas: selected,
    meta: {
      ...baseMeta,
      droppedByMinScore,
      mcpToolsSelected: selected.filter(s => isMcpTool(s.name)).length,
      writeToolsSelected: selected.filter(s => isWriteLikeTool(s.name)).length,
    },
  }
}

function selectToolSchemasForTurn(input: {
  toolRegistry: ToolRegistry
  messages: Message[]
  config: QueryEngineConfig
  currentGear: 1 | 2 | 3
  signals?: ToolSelectionSignals
  queryHint?: string
}): ToolSchema[] {
  return selectToolSubsetForTurn(input).schemas
}

function buildToolSelectionText(messages: Message[], queryHint?: string): string {
  const latestUser = [...messages].reverse().find(m => m.role === 'user')
  const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  const userText = latestUser?.content
  const assistantText = latestAssistant?.content
  const userString = typeof userText === 'string' ? userText : JSON.stringify(userText ?? '')
  const assistantString = typeof assistantText === 'string' ? assistantText : JSON.stringify(assistantText ?? '')
  return `${userString}\n${assistantString}\n${String(queryHint ?? '')}`.toLowerCase()
}

function inferAlwaysIncludeTools(contextText: string): string[] {
  const picks: string[] = []
  const hasAny = (words: string[]) => words.some(w => contextText.includes(w))

  if (hasAny(['test', 'pytest', 'jest', 'vitest', 'bun test', 'npm test', 'pnpm test'])) {
    picks.push('Bash')
  }
  if (hasAny(['read', 'open file', '鏌ョ湅', '璇诲彇'])) {
    picks.push('Read')
  }
  if (hasAny(['edit', 'modify', 'change', 'patch', 'fix', '淇', '淇敼'])) {
    picks.push('Edit')
  }
  if (hasAny(['create file', 'write file', 'save', '鏂板鏂囦欢', '鍐欏叆'])) {
    picks.push('Write')
  }
  if (hasAny(['search', 'find', 'grep', 'regex', '鏌ユ壘', '鎼滅储'])) {
    picks.push('Grep')
    picks.push('Glob')
  }
  return picks
}

function scoreToolSchema(
  schema: ToolSchema,
  contextText: string,
  signals?: ToolSelectionSignals,
  config?: QueryEngineConfig,
  profile?: 'coding' | 'debug' | 'refactor' | 'research'
): number {
  const hay = `${schema.name} ${schema.description}`.toLowerCase()
  const normalizedToolName = normalizeToolName(schema.name)
  const queryTokens = tokenize(contextText)
  const toolTokens = new Set(tokenize(hay))

  let overlap = 0
  for (const t of queryTokens) {
    if (toolTokens.has(t)) overlap++
  }

  let score = overlap * 3
  if (contextText.includes(schema.name.toLowerCase())) score += 10

  if (['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob'].includes(schema.name)) {
    score += 2
  }

  // Skill工具评分加成
  if (schema.name.startsWith('skill__')) {
    score += 3 // 基础加成
    // 根据技能类型额外加成
    const skillName = schema.name.replace('skill__', '')
    if (['commit', 'skillify', 'update-config'].includes(skillName)) {
      score += 2 // 写操作技能额外加成
    }
  }

  if (profile) {
    const profileBoost = scoreByProfile(schema.name, profile)
    const profileWeight = config?.toolSubset?.profileWeight ?? 1
    score += profileBoost * profileWeight
  }

  if (config?.toolSubset?.preferReadOnly && isReadLikeTool(schema.name)) {
    score += 4
  }
  if (config?.toolSubset?.penalizeWriteTools && isWriteLikeTool(schema.name)) {
    score -= Math.max(0, config?.toolSubset?.writePenaltyWeight ?? 3)
  }

  // 优先级影响工具可靠性权重
  if (config?.priorityConfig?.affectToolSelection !== false) {
    const priority = config.priority ?? 2
    const reliabilityWeight = calculateToolReliabilityWeightByPriority(priority, config.priorityConfig)

    // 根据工具可靠性调整分数
    const toolReliability = calculateToolReliability(schema.name)
    score += toolReliability * reliabilityWeight
  }

  if (signals) {
    const normalizedRecent = signals.recentSuccessfulTools.map(normalizeToolName)
    const successIndex = normalizedRecent.indexOf(normalizedToolName)
    if (successIndex >= 0) {
      const baseBoost = Math.max(3, 18 - successIndex * 3)
      const weight = Math.max(0, config?.toolSubset?.successBoostWeight ?? 1)
      score += baseBoost * weight
    }

    const failCount =
      signals.consecutiveFailures[normalizedToolName] ??
      signals.consecutiveFailures[schema.name] ??
      0
    if (failCount > 0) {
      const basePenalty = Math.min(18, failCount * 8)
      const weight = Math.max(0, config?.toolSubset?.failurePenaltyWeight ?? 1)
      score -= basePenalty * weight
    }
  }

  return score
}

function tokenize(text: string): string[] {
  return text
    .split(/[^a-zA-Z0-9_]+/g)
    .map(s => s.trim())
    .filter(s => s.length >= 2)
}

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase()
}

function updateToolSelectionSignals(
  signals: ToolSelectionSignals,
  toolName: string,
  isError: boolean,
  config?: QueryEngineConfig
): void {
  const normalizedToolName = normalizeToolName(toolName)
  if (isError) {
    signals.consecutiveFailures[normalizedToolName] = (signals.consecutiveFailures[normalizedToolName] ?? 0) + 1
    signals.recentSuccessfulTools = signals.recentSuccessfulTools.filter(name => normalizeToolName(name) !== normalizedToolName)
    return
  }

  signals.consecutiveFailures[normalizedToolName] = 0
  signals.recentSuccessfulTools = [normalizedToolName, ...signals.recentSuccessfulTools.filter(name => normalizeToolName(name) !== normalizedToolName)]
  const maxRecent = Math.max(1, config?.toolSubset?.maxRecentSuccessTools ?? MAX_RECENT_SUCCESS_TOOLS)
  if (signals.recentSuccessfulTools.length > maxRecent) {
    signals.recentSuccessfulTools = signals.recentSuccessfulTools.slice(0, maxRecent)
  }
}

async function executeSequentially(
  toolRegistry: ToolRegistry,
  calls: Array<{ name: string; input: Record<string, any>; toolUseId: string }>,
  context: ToolContext,
): Promise<ToolResult[]> {
  const results: ToolResult[] = []
  for (const call of calls) {
    results.push(await toolRegistry.execute(call.name, call.input, call.toolUseId, context))
  }
  return results
}

export const __queryLoopInternals = {
  selectToolSchemasForTurn,
  selectToolSubsetForTurn,
}

function resolveToolProfile(
  contextText: string,
  explicit?: 'coding' | 'debug' | 'refactor' | 'research',
): 'coding' | 'debug' | 'refactor' | 'research' {
  if (explicit) return explicit
  if (/(debug|trace|stack|flaky|repro|日志|排查)/.test(contextText)) return 'debug'
  if (/(refactor|cleanup|rename|extract|restructure|重构)/.test(contextText)) return 'refactor'
  if (/(research|docs|web|search|compare|调研)/.test(contextText)) return 'research'
  return 'coding'
}

function scoreByProfile(
  toolName: string,
  profile: 'coding' | 'debug' | 'refactor' | 'research',
): number {
  const normalizedName = normalizeToolName(toolName)
  const table: Record<typeof profile, Record<string, number>> = {
    coding: { Read: 3, Edit: 4, Write: 3, Grep: 2, Glob: 2, Bash: 2, LSP: 2 },
    debug: { Bash: 5, Grep: 4, Read: 3, LSP: 3, InjectDebugLogger: 4, HypothesisDebug: 4 },
    refactor: { LSP: 5, Edit: 4, Read: 3, Grep: 3, Glob: 2, Write: 2 },
    research: { WebSearch: 6, WebFetch: 5, Read: 2, Grep: 2 },
  }

  const byName = table[profile]
  for (const [key, val] of Object.entries(byName)) {
    if (normalizedName.includes(normalizeToolName(key))) return val
  }
  return 0
}

function wildcardMatch(value: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i').test(value)
}

function isMcpTool(toolName: string): boolean {
  return normalizeToolName(toolName).startsWith('mcp__')
}

function applyMcpCap(schemas: ToolSchema[], maxMcpTools?: number): ToolSchema[] {
  if (maxMcpTools === undefined || maxMcpTools < 0) return schemas
  const limited: ToolSchema[] = []
  let mcpCount = 0
  for (const schema of schemas) {
    if (!isMcpTool(schema.name)) {
      limited.push(schema)
      continue
    }
    if (mcpCount < maxMcpTools) {
      limited.push(schema)
      mcpCount++
    }
  }
  return limited
}

function applyWriteCap(schemas: ToolSchema[], maxWriteTools?: number): ToolSchema[] {
  if (maxWriteTools === undefined || maxWriteTools < 0) return schemas
  const limited: ToolSchema[] = []
  let writeCount = 0
  for (const schema of schemas) {
    if (!isWriteLikeTool(schema.name)) {
      limited.push(schema)
      continue
    }
    if (writeCount < maxWriteTools) {
      limited.push(schema)
      writeCount++
    }
  }
  return limited
}

function applyToolFamilyCaps(
  schemas: ToolSchema[],
  subsetConfig: NonNullable<QueryEngineConfig['toolSubset']>,
): ToolSchema[] {
  return applyWriteCap(applyMcpCap(schemas, subsetConfig.maxMcpTools), subsetConfig.maxWriteTools)
}

function isReadLikeTool(toolName: string): boolean {
  const n = normalizeToolName(toolName)
  return (
    n.includes('read')
    || n.includes('grep')
    || n.includes('glob')
    || n.includes('search')
    || n.includes('fetch')
    || n.includes('list_')
    || n.includes('list')
    // Skill工具：只读技能
    || (n.startsWith('skill') && (
      n.includes('simplify')
      || n.includes('review')
      || n.includes('pdf')
    ))
  )
}

function isWriteLikeTool(toolName: string): boolean {
  const n = normalizeToolName(toolName)
  return (
    n.includes('write')
    || n.includes('edit')
    || n.includes('bash')
    || n.includes('git')
    || n.includes('rewind')
    || n.includes('delete')
    || n.includes('move')
    // Skill工具：写操作技能
    || (n.startsWith('skill') && (
      n.includes('commit')
      || n.includes('skillify')
      || n.includes('update')
    ))
  )
}

function extractTrackableFilePaths(input: Record<string, any>, customKeys?: string[]): string[] {
  const defaultKeys = [
    'file_path',
    'path',
    'target_file',
    'old_file_path',
    'new_file_path',
    'output_path',
    'destination',
  ]
  const keys = uniqueCaseInsensitive([...defaultKeys, ...(customKeys ?? [])])
  const paths: string[] = []

  for (const key of keys) {
    const value = pickValueByKeyCaseInsensitive(input, key)
    if (typeof value === 'string' && looksLikeFilePath(value)) {
      paths.push(value)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && looksLikeFilePath(item)) {
          paths.push(item)
        }
      }
    }
  }

  return Array.from(new Set(paths))
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function pickValueByKeyCaseInsensitive(obj: Record<string, any>, targetKey: string): any {
  const target = targetKey.trim().toLowerCase()
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase() === target) return v
  }
  return undefined
}

function looksLikeFilePath(value: string): boolean {
  const v = value.trim()
  if (!v || v.length > 400) return false
  if (v.includes('\n') || v.includes('\r') || v.includes('\0')) return false
  return (
    v.includes('/') ||
    v.includes('\\') ||
    /\.[a-zA-Z0-9]{1,10}$/.test(v)
  )
}
