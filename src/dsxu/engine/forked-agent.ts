/**
 * #9 Forked Agent — 子任务分叉执行
 *
 * 学 Claude 的 fork 机制，简化为 DSxu 需要的核心：
 *   1. 快照父对话消息
 *   2. 创建隔离上下文（独立消息历史、独立变速器）
 *   3. 运行子任务 query loop
 *   4. 返回结果给父
 *
 * V13 护栏：
 *   - 单 fork，不并行 fan-out（稳定优先）
 *   - 文件写操作自动排队（append-only transcript）
 *   - AbortController 父子联动
 *   - 超时 + 最大轮次双保险
 *
 * 与 Claude 的区别：
 *   - Claude 支持多 fork 并行（fan-out）→ DSxu V13 只允许单 fork
 *   - Claude 有复杂的 CacheSafeParams → DSxu 直接复制消息
 *   - Claude 用 sidechain transcript → DSxu 用内存 + 可选 JSONL 归档
 */

import type {
  Message,
  LLMCallFn,
  ToolDefinition,
  QueryResult,
  QueryEvent,
  QueryEngineConfig,
  ToolContext,
  CounterfactualConfig,
  CounterfactualBranchResult,
  CounterfactualSessionResult,
  CounterfactualStrategy,
} from './types'
import { ToolRegistry } from './tool-registry'
import { queryLoop } from './query-loop'
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// ── 配置 ──

export interface ForkConfig {
  /** 子任务最大轮次（默认 20，比主循环少） */
  maxTurns?: number
  /** 子任务超时 ms（默认 5 分钟） */
  timeout?: number
  /** 是否记录 transcript（默认 true） */
  recordTranscript?: boolean
  /** Transcript 目录（默认 .dsxu/transcripts/） */
  transcriptDir?: string
  /** 初始档位（默认 1） */
  initialGear?: 1 | 2 | 3
  /** 额外系统提示（注入子任务上下文） */
  systemPrompt?: string
}

// ── 结果 ──

export interface ForkResult {
  /** 子任务最终回复 */
  finalMessage: string
  /** 退出原因 */
  exitReason: string
  /** 总轮次 */
  turns: number
  /** Token 使用 */
  usage: { inputTokens: number; outputTokens: number }
  /** 子任务消息历史 */
  messages: Message[]
  /** 执行事件流（用于回溯） */
  events: QueryEvent[]
  /** Fork ID */
  forkId: string
  /** 执行耗时 ms */
  durationMs: number
  /** Agent Summary（结构化摘要） */
  agentSummary?: AgentSummary
}

// ── 文件写入队列（防并发冲突） ──

const writeQueue: Array<{ path: string; content: string; resolve: () => void }> = []
let drainScheduled = false

function enqueueWrite(path: string, content: string): Promise<void> {
  return new Promise<void>((resolve) => {
    writeQueue.push({ path, content, resolve })
    if (!drainScheduled) {
      drainScheduled = true
      setTimeout(drainWriteQueue, 100)  // 100ms 批量刷写
    }
  })
}

function drainWriteQueue(): void {
  drainScheduled = false
  const batch = writeQueue.splice(0)

  // 按文件分组
  const byFile = new Map<string, string[]>()
  const resolvers: Array<() => void> = []

  for (const { path, content, resolve } of batch) {
    const existing = byFile.get(path) || []
    existing.push(content)
    byFile.set(path, existing)
    resolvers.push(resolve)
  }

  // 批量写入
  for (const [path, contents] of byFile) {
    try {
      const dir = dirname(path)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      appendFileSync(path, contents.join(''), 'utf-8')
    } catch (e: any) {
      console.warn(`[Fork] Write queue error: ${e.message}`)
    }
  }

  // 全部 resolve
  for (const resolve of resolvers) resolve()
}

// ── Fork 活跃计数器（V13 单 fork 限制） ──

let activeForkCount = 0
const MAX_CONCURRENT_FORKS = 1  // V13 限制

// ── 核心：创建并运行 Fork ──

/**
 * 创建子任务 fork
 *
 * @param directive 子任务指令
 * @param parentMessages 父对话消息快照
 * @param llmCall LLM 调用函数
 * @param toolRegistry 工具注册表
 * @param config Fork 配置
 * @returns Fork 执行结果
 */
export async function createFork(
  directive: string,
  parentMessages: Message[],
  llmCall: LLMCallFn,
  toolRegistry: ToolRegistry,
  config?: ForkConfig,
): Promise<ForkResult> {
  // ── V13 护栏：单 fork 限制 ──
  if (activeForkCount >= MAX_CONCURRENT_FORKS) {
    return {
      finalMessage: `[Fork] 已有活跃的子任务在执行（当前 ${activeForkCount}/${MAX_CONCURRENT_FORKS}）。等待完成后重试。`,
      exitReason: 'max_forks',
      turns: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
      messages: [],
      events: [],
      forkId: '',
      durationMs: 0,
    }
  }

  const forkId = `fork-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const maxTurns = config?.maxTurns ?? 20
  const timeout = config?.timeout ?? 5 * 60_000
  const recordTranscript = config?.recordTranscript ?? true

  console.log(`[Fork] 🔀 Starting ${forkId}: "${directive.slice(0, 80)}..."`)

  // ── 创建隔离 AbortController（父子联动） ──
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error(`Fork timeout (${timeout}ms)`))
  }, timeout)

  // ── 快照消息 ──
  const snapshotMessages = snapshotParentMessages(parentMessages)

  // ── 构建子任务初始消息 ──
  const forkMessages: Message[] = [
    // 父对话上下文摘要（不复制全部消息，只取关键信息）
    {
      role: 'system',
      content: buildForkSystemPrompt(snapshotMessages, config?.systemPrompt),
    },
    {
      role: 'user',
      content: directive,
    },
  ]

  // ── 运行子任务 ──
  activeForkCount++
  const startTime = Date.now()
  const events: QueryEvent[] = []

  try {
    const engineConfig: QueryEngineConfig = {
      llmCall,
      maxTurns,
      maxConsecutiveErrors: 5,  // 子任务容错更低
      abortSignal: abortController.signal,
    }

    const gen = queryLoop(engineConfig, forkMessages, toolRegistry, {
      initialGear: config?.initialGear,
    })

    let result: IteratorResult<QueryEvent, QueryResult>
    do {
      result = await gen.next()
      if (!result.done) {
        events.push(result.value)

        // 实时日志
        if (result.value.type === 'turn_start') {
          console.log(`[Fork:${forkId}] Turn ${result.value.turn} | gear=${result.value.gear}`)
        }
        if (result.value.type === 'error') {
          console.warn(`[Fork:${forkId}] Error: ${result.value.error.message}`)
        }
      }
    } while (!result.done)

    const queryResult = result.value
    const durationMs = Date.now() - startTime

    console.log(
      `[Fork] ✅ ${forkId} done: ${queryResult.exitReason} in ${queryResult.turns} turns, ` +
      `${durationMs}ms, ${queryResult.totalUsage.inputTokens + queryResult.totalUsage.outputTokens} tokens`
    )

    // ── 归档 Transcript ──
    if (recordTranscript) {
      const transcriptDir = config?.transcriptDir || join(process.cwd(), '.dsxu', 'transcripts')
      await archiveTranscript(forkId, directive, queryResult, events, transcriptDir)
    }

    // 生成 Agent Summary
    const agentSummary = generateAgentSummary(forkId, directive, {
      finalMessage: queryResult.finalMessage,
      exitReason: queryResult.exitReason,
      turns: queryResult.turns,
      usage: queryResult.totalUsage,
      messages: queryResult.messages,
      events,
      forkId,
      durationMs,
    }, events)

    return {
      finalMessage: queryResult.finalMessage,
      exitReason: queryResult.exitReason,
      turns: queryResult.turns,
      usage: queryResult.totalUsage,
      messages: queryResult.messages,
      events,
      forkId,
      durationMs,
      agentSummary,
    }
  } catch (error: any) {
    const durationMs = Date.now() - startTime
    console.error(`[Fork] ❌ ${forkId} failed: ${error.message} (${durationMs}ms)`)

    // 生成错误状态的 Agent Summary
    const agentSummary = generateAgentSummary(forkId, directive, {
      finalMessage: `[Fork error: ${error.message}]`,
      exitReason: 'error',
      turns: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
      messages: [],
      events,
      forkId,
      durationMs,
    }, events)

    return {
      finalMessage: `[Fork error: ${error.message}]`,
      exitReason: 'error',
      turns: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
      messages: [],
      events,
      forkId,
      durationMs,
      agentSummary,
    }
  } finally {
    activeForkCount--
    clearTimeout(timeoutId)
  }
}

// ── 消息快照 ──

function snapshotParentMessages(messages: Message[]): Message[] {
  // 深拷贝（防止父修改影响子）
  return messages.map(m => ({
    ...m,
    content: typeof m.content === 'string' ? m.content : JSON.parse(JSON.stringify(m.content)),
    toolCalls: m.toolCalls ? [...m.toolCalls] : undefined,
  }))
}

// ── Fork 系统提示 ──

function buildForkSystemPrompt(parentMessages: Message[], extraPrompt?: string): string {
  // 提取父对话摘要（最近的几条关键消息）
  const parentSummary = extractParentSummary(parentMessages)

  let prompt = `You are a sub-agent executing a specific task. You have access to the same tools as the main agent.

IMPORTANT RULES:
1. Focus ONLY on the task given to you. Do not deviate.
2. Be concise — complete the task and report back.
3. If you encounter errors, try to fix them (up to 3 attempts) before reporting failure.
4. Do not ask clarifying questions — work with the information provided.

PARENT CONVERSATION CONTEXT:
${parentSummary}`

  if (extraPrompt) {
    prompt += `\n\nADDITIONAL CONTEXT:\n${extraPrompt}`
  }

  return prompt
}

function extractParentSummary(messages: Message[]): string {
  if (messages.length === 0) return '(no prior context)'

  // 取最近 5 条非-system 消息做摘要
  const recent = messages
    .filter(m => m.role !== 'system')
    .slice(-5)

  return recent.map(m => {
    const role = m.role
    const content = typeof m.content === 'string'
      ? m.content.slice(0, 500)
      : JSON.stringify(m.content).slice(0, 500)
    return `[${role}]: ${content}`
  }).join('\n')
}

// ── Transcript 归档 ──

async function archiveTranscript(
  forkId: string,
  directive: string,
  result: QueryResult,
  events: QueryEvent[],
  transcriptDir: string,
): Promise<void> {
  const transcript = {
    forkId,
    directive,
    exitReason: result.exitReason,
    turns: result.turns,
    usage: result.totalUsage,
    finalMessage: result.finalMessage.slice(0, 2000),
    timestamp: new Date().toISOString(),
    eventCount: events.length,
  }

  const line = JSON.stringify(transcript) + '\n'
  const filePath = join(transcriptDir, 'forks.jsonl')

  await enqueueWrite(filePath, line)
}

// ── Agent Summary 结构 ──

export interface AgentSummary {
  /** 子任务 ID */
  forkId: string
  /** 指令 */
  directive: string
  /** 执行状态 */
  status: 'success' | 'error' | 'timeout' | 'max_turns' | 'max_forks'
  /** 最终回复 */
  finalMessage: string
  /** 总轮次 */
  turns: number
  /** 执行时间 (ms) */
  durationMs: number
  /** Token 使用 */
  usage: { inputTokens: number; outputTokens: number }
  /** 关键事件统计 */
  stats: {
    toolCalls: number
    errors: number
    rollbacks: number
    circuitSkips: number
  }
  /** 时间戳 */
  timestamp: string
  /** 结构化摘要（供主会话使用） */
  structuredSummary?: {
    /** 完成的任务项 */
    completedTasks: string[]
    /** 发现的问题 */
    issuesFound: string[]
    /** 建议的下一步 */
    nextSteps: string[]
    /** 关键文件 */
    keyFiles: string[]
  }
}

// ── 摘要生成函数 ──

function generateAgentSummary(
  forkId: string,
  directive: string,
  result: Omit<ForkResult, 'agentSummary'>,
  events: QueryEvent[],
): AgentSummary {
  // 统计关键事件
  const toolCalls = events.filter(e => e.type === 'tool_start').length
  const errors = events.filter(e => e.type === 'error').length
  const rollbacks = events.filter(e => e.type === 'transaction_rolled_back').length
  const circuitSkips = events.filter(e => e.type === 'tool_skipped_by_circuit_breaker').length

  // 从最终消息中提取结构化信息（简单实现）
  const structuredSummary = extractStructuredSummary(result.finalMessage)

  return {
    forkId,
    directive,
    status: mapExitReasonToStatus(result.exitReason),
    finalMessage: result.finalMessage,
    turns: result.turns,
    durationMs: result.durationMs,
    usage: result.usage,
    stats: {
      toolCalls,
      errors,
      rollbacks,
      circuitSkips,
    },
    timestamp: new Date().toISOString(),
    structuredSummary,
  }
}

function mapExitReasonToStatus(exitReason: string): AgentSummary['status'] {
  switch (exitReason) {
    case 'end_turn':
    case 'test_passed':
      return 'success'
    case 'error':
    case 'api_error':
      return 'error'
    case 'max_turns':
      return 'max_turns'
    case 'max_forks':
      return 'max_forks'
    case 'aborted':
      return 'timeout'
    default:
      return 'success'
  }
}

export function extractStructuredSummary(finalMessage: string): AgentSummary['structuredSummary'] {
  // 简单实现：从消息中提取关键信息
  // 在实际应用中，可以使用更复杂的 NLP 或规则提取
  const lines = finalMessage.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const completedTasks: string[] = []
  const issuesFound: string[] = []
  const nextSteps: string[] = []
  const keyFiles: string[] = []

  // 简单规则提取
  for (const line of lines) {
    if (line.includes('完成') || line.includes('完成') || line.includes('fixed') || line.includes('added')) {
      completedTasks.push(line)
    }
    if (line.includes('错误') || line.includes('error') || line.includes('bug') || line.includes('issue')) {
      issuesFound.push(line)
    }
    if (line.includes('建议') || line.includes('下一步') || line.includes('recommend') || line.includes('next')) {
      nextSteps.push(line)
    }
    if (line.includes('.ts') || line.includes('.js') || line.includes('.tsx') || line.includes('.jsx')) {
      // 只提取纯路径片段，避免把“关键文件：”这类前缀带入结果
      const fileMatch = line.match(/([A-Za-z0-9_./\\-]+\.(ts|js|tsx|jsx|json|md))\b/)
      if (fileMatch) {
        keyFiles.push(fileMatch[1].replace(/\\/g, '/'))
      }
    }
  }

  return {
    completedTasks: completedTasks.slice(0, 5), // 限制数量
    issuesFound: issuesFound.slice(0, 5),
    nextSteps: nextSteps.slice(0, 3),
    keyFiles: [...new Set(keyFiles)].slice(0, 10), // 去重
  }
}

// ── Fork Agent 工具（注册到 ToolRegistry） ──

export const ForkAgentTool: ToolDefinition = {
  name: 'ForkAgent',
  description: 'Launch a sub-agent to handle a specific task independently. The sub-agent has its own conversation context and tools. Use for tasks that can be delegated: research, test writing, file organization, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      directive: {
        type: 'string',
        description: 'Clear instructions for the sub-agent. Be specific about what to do and what files to work with.',
      },
      max_turns: {
        type: 'number',
        description: 'Maximum turns for the sub-agent (default 20)',
      },
      /** 是否返回结构化摘要（默认 true） */
      structured_summary: {
        type: 'boolean',
        description: 'Whether to return structured summary (default true)',
      },
    },
    required: ['directive'],
  },
  concurrencySafe: false,
  readOnly: false,
  execute: async (input, context) => {
    // 注意：这个 execute 需要外部注入 llmCall 和 toolRegistry
    // 见 createForkAgentTool()
    return {
      content: '[ForkAgent] Not configured. Use createForkAgentTool() to inject dependencies.',
      isError: true,
    }
  },
}

/**
 * 创建配置好依赖的 ForkAgent 工具
 *
 * 用法：
 *   const forkTool = createForkAgentTool(llmCall, toolRegistry, parentMessages)
 *   toolRegistry.register(forkTool)
 */
export function createForkAgentTool(
  llmCall: LLMCallFn,
  toolRegistry: ToolRegistry,
  getParentMessages: () => Message[],
  forkConfig?: ForkConfig,
  /** Agent Summary 回调函数 */
  onSummary?: (summary: AgentSummary) => void,
): ToolDefinition {
  return {
    ...ForkAgentTool,
    execute: async (input, context) => {
      const directive = input.directive as string
      const maxTurns = input.max_turns as number | undefined
      const structuredSummary = input.structured_summary as boolean | undefined

      if (!directive) {
        return { content: 'Error: directive is required', isError: true }
      }

      const result = await createFork(
        directive,
        getParentMessages(),
        llmCall,
        toolRegistry,
        {
          ...forkConfig,
          maxTurns: maxTurns ?? forkConfig?.maxTurns,
        },
      )

      // 调用 Agent Summary 回调
      if (onSummary && result.agentSummary) {
        onSummary(result.agentSummary)
      }

      // 格式化返回给父 LLM（使用 result.agentSummary）
      const summary = formatAgentSummaryForLLM(
        result.agentSummary!,
        structuredSummary ?? true
      )

      return {
        content: summary,
        isError: result.exitReason === 'error',
        meta: {
          forkId: result.forkId,
          exitReason: result.exitReason,
          turns: result.turns,
          durationMs: result.durationMs,
          agentSummary: result.agentSummary, // 包含结构化摘要
        },
      }
    },
  }
}

/** 格式化 Agent Summary 供 LLM 使用 */
function formatAgentSummaryForLLM(
  summary: AgentSummary,
  includeStructured: boolean,
): string {
  const parts = [
    `## Agent Summary (${summary.forkId})`,
    ``,
    `**Directive**: ${summary.directive}`,
    `**Status**: ${summary.status}`,
    `**Turns**: ${summary.turns}`,
    `**Duration**: ${summary.durationMs}ms`,
    `**Tokens**: ${summary.usage.inputTokens + summary.usage.outputTokens}`,
    `**Stats**: ${summary.stats.toolCalls} tool calls, ${summary.stats.errors} errors, ${summary.stats.rollbacks} rollbacks, ${summary.stats.circuitSkips} circuit skips`,
    ``,
    `### Final Response:`,
    summary.finalMessage,
  ]

  if (includeStructured && summary.structuredSummary) {
    const { completedTasks, issuesFound, nextSteps, keyFiles } = summary.structuredSummary

    parts.push(
      ``,
      `### Structured Summary:`,
      ``,
      `**Completed Tasks**:`,
      ...(completedTasks.length > 0 ? completedTasks.map(t => `- ${t}`) : ['- None']),
      ``,
      `**Issues Found**:`,
      ...(issuesFound.length > 0 ? issuesFound.map(i => `- ${i}`) : ['- None']),
      ``,
      `**Next Steps**:`,
      ...(nextSteps.length > 0 ? nextSteps.map(s => `- ${s}`) : ['- None']),
      ``,
      `**Key Files**:`,
      ...(keyFiles.length > 0 ? keyFiles.map(f => `- ${f}`) : ['- None']),
    )
  }

  return parts.join('\n')
}

/** 获取当前活跃 fork 数 */
export function getActiveForkCount(): number {
  return activeForkCount
}

// ── 反事实并行推演 ──

/**
 * 运行反事实并行推演分支
 *
 * @param originalQuery 原始查询
 * @param parentMessages 父对话消息
 * @param llmCall LLM调用函数
 * @param toolRegistry 工具注册表
 * @param config 反事实配置
 * @returns 并行推演会话结果
 */
export async function runCounterfactualBranches(
  originalQuery: string,
  parentMessages: Message[],
  llmCall: LLMCallFn,
  toolRegistry: ToolRegistry,
  config: CounterfactualConfig = {},
): Promise<CounterfactualSessionResult> {
  const sessionId = `counterfactual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const startTime = Date.now()

  // 合并默认配置
  const effectiveConfig: Required<CounterfactualConfig> = {
    enabled: config.enabled ?? false,
    branchCount: config.branchCount ?? 3,
    maxBranchTurns: config.maxBranchTurns ?? 4,
    strategy: config.strategy ?? 'diversity',
    autoSummarize: config.autoSummarize ?? true,
    autoPickWinner: config.autoPickWinner ?? true,
  }

  if (!effectiveConfig.enabled) {
    return {
      sessionId,
      originalQuery,
      branches: [],
      ranking: [],
      totalDurationMs: Date.now() - startTime,
    }
  }

  console.log(`[Counterfactual] 🔀 Starting ${sessionId}: ${effectiveConfig.branchCount} branches for "${originalQuery.slice(0, 80)}..."`)

  // 生成分支指令
  const directives = generateBranchDirectives(originalQuery, effectiveConfig.branchCount, effectiveConfig.strategy)

  // 并行执行所有分支
  const branchPromises = directives.map((directive, index) =>
    runCounterfactualBranch(
      directive,
      index,
      parentMessages,
      llmCall,
      toolRegistry,
      effectiveConfig.maxBranchTurns,
      sessionId
    )
  )

  let branchResults: CounterfactualBranchResult[]
  try {
    branchResults = await Promise.all(branchPromises)
  } catch (error) {
    // 降级处理：如果并行执行失败，返回降级结果
    console.warn(`[Counterfactual] ❌ Parallel execution failed: ${error}`)
    return {
      sessionId,
      originalQuery,
      branches: [],
      ranking: [],
      totalDurationMs: Date.now() - startTime,
      reason: 'Parallel execution failed, degraded to empty result',
    }
  }

  // 计算评分
  const scoredBranches = branchResults.map(branch => ({
    ...branch,
    score: calculateBranchScore(branch),
  }))

  // 排序
  const sortedBranches = [...scoredBranches].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  // 生成排名
  const ranking = sortedBranches.map((branch, index) => ({
    branchId: branch.branchId,
    score: branch.score ?? 0,
    rank: index + 1,
  }))

  // 选择获胜分支
  let winnerBranchId: string | undefined
  let reason: string | undefined

  if (effectiveConfig.autoPickWinner && sortedBranches.length > 0) {
    const winner = sortedBranches[0]
    winnerBranchId = winner.branchId
    reason = generateWinnerReason(winner, sortedBranches)
  }

  // 生成汇总摘要
  let summary: string | undefined
  if (effectiveConfig.autoSummarize) {
    summary = generateSessionSummary(originalQuery, sortedBranches, winnerBranchId)
  }

  const totalDurationMs = Date.now() - startTime

  console.log(`[Counterfactual] ✅ ${sessionId} completed: ${branchResults.length} branches, winner=${winnerBranchId || 'none'}, ${totalDurationMs}ms`)

  return {
    sessionId,
    originalQuery,
    branches: scoredBranches,
    winnerBranchId,
    ranking,
    reason,
    summary,
    totalDurationMs,
  }
}

/**
 * 运行单个反事实分支
 */
async function runCounterfactualBranch(
  directive: string,
  branchIndex: number,
  parentMessages: Message[],
  llmCall: LLMCallFn,
  toolRegistry: ToolRegistry,
  maxTurns: number,
  sessionId: string,
): Promise<CounterfactualBranchResult> {
  const branchId = `${sessionId}-branch-${branchIndex}`
  const startTime = Date.now()

  console.log(`[Counterfactual:${branchId}] Starting: "${directive.slice(0, 80)}..."`)

  try {
    const result = await createFork(
      directive,
      parentMessages,
      llmCall,
      toolRegistry,
      {
        maxTurns,
        timeout: 2 * 60_000, // 2分钟超时
        recordTranscript: false, // 反事实分支不记录transcript
        initialGear: 1, // 从最低档位开始
      }
    )

    const durationMs = Date.now() - startTime

    // 统计错误数
    const errorCount = result.events.filter(e => e.type === 'error').length

    // 统计工具调用数
    const toolCallCount = result.events.filter(e => e.type === 'tool_start').length

    return {
      branchId,
      directive,
      status: mapExitReasonToBranchStatus(result.exitReason),
      turns: result.turns,
      durationMs,
      errorCount,
      toolCallCount,
      finalMessage: result.finalMessage,
    }
  } catch (error: any) {
    const durationMs = Date.now() - startTime
    console.error(`[Counterfactual:${branchId}] Failed: ${error.message}`)

    return {
      branchId,
      directive,
      status: 'failed',
      turns: 0,
      durationMs,
      errorCount: 1,
      toolCallCount: 0,
      finalMessage: `[Counterfactual branch failed: ${error.message}]`,
      error: error.message,
    }
  }
}

/**
 * 生成分支指令
 */
function generateBranchDirectives(
  originalQuery: string,
  branchCount: number,
  strategy: CounterfactualStrategy,
): string[] {
  const directives: string[] = []

  if (strategy === 'ablation') {
    // 消融策略：逐步简化或移除假设
    for (let i = 0; i < branchCount; i++) {
      const variant = i === 0 ? 'full' : `variant-${i}`
      directives.push(`[Counterfactual Branch ${variant}] ${originalQuery}`)
    }
  } else {
    // 多样性策略：不同角度或方法
    const approaches = [
      '采用保守方法，优先保证稳定性',
      '采用激进方法，优先实现功能',
      '采用折中方法，平衡稳定性和功能',
      '采用创新方法，尝试新技术方案',
      '采用传统方法，遵循最佳实践',
    ]

    for (let i = 0; i < branchCount; i++) {
      const approach = approaches[i % approaches.length]
      directives.push(`[Counterfactual Branch ${i + 1}] ${approach}: ${originalQuery}`)
    }
  }

  return directives
}

/**
 * 计算分支评分
 */
function calculateBranchScore(branch: CounterfactualBranchResult): number {
  const COMPLETE_BONUS = 100
  const ERROR_PENALTY = 30
  const TURN_PENALTY = 5
  const DURATION_PENALTY = 0.01 // 每毫秒0.01分

  let score = 0

  // 完成奖励
  if (branch.status === 'completed') {
    score += COMPLETE_BONUS
  }

  // 错误惩罚
  score -= branch.errorCount * ERROR_PENALTY

  // 轮次惩罚（鼓励简洁）
  score -= branch.turns * TURN_PENALTY

  // 时长惩罚（鼓励快速）
  score -= branch.durationMs * DURATION_PENALTY

  // 确保非负
  return Math.max(0, score)
}

/**
 * 生成获胜理由
 */
function generateWinnerReason(
  winner: CounterfactualBranchResult,
  allBranches: CounterfactualBranchResult[]
): string {
  const reasons: string[] = []

  if (winner.status === 'completed') {
    reasons.push('成功完成任务')
  }

  if (winner.errorCount === 0) {
    reasons.push('无错误')
  } else if (winner.errorCount < Math.min(...allBranches.map(b => b.errorCount))) {
    reasons.push('错误最少')
  }

  if (winner.turns <= Math.min(...allBranches.map(b => b.turns))) {
    reasons.push('轮次最少')
  }

  if (winner.durationMs <= Math.min(...allBranches.map(b => b.durationMs))) {
    reasons.push('执行最快')
  }

  if (reasons.length === 0) {
    return '综合评分最高'
  }

  return reasons.join('，')
}

/**
 * 生成会话摘要
 */
function generateSessionSummary(
  originalQuery: string,
  branches: CounterfactualBranchResult[],
  winnerBranchId?: string,
): string {
  const completed = branches.filter(b => b.status === 'completed').length
  const failed = branches.filter(b => b.status === 'failed').length
  const avgTurns = branches.reduce((sum, b) => sum + b.turns, 0) / branches.length
  const avgDuration = branches.reduce((sum, b) => sum + b.durationMs, 0) / branches.length

  let summary = `# 反事实并行推演摘要

原始查询：${originalQuery}

## 统计概览
- 总分支数：${branches.length}
- 成功完成：${completed}
- 失败：${failed}
- 平均轮次：${avgTurns.toFixed(1)}
- 平均时长：${avgDuration.toFixed(0)}ms

## 分支排名
`

  branches.forEach((branch, index) => {
    const isWinner = branch.branchId === winnerBranchId
    const winnerMark = isWinner ? ' 🏆' : ''
    summary += `${index + 1}. ${branch.branchId}${winnerMark} - 评分：${branch.score?.toFixed(1) || 0}，状态：${branch.status}，轮次：${branch.turns}，错误：${branch.errorCount}\n`
  })

  if (winnerBranchId) {
    const winner = branches.find(b => b.branchId === winnerBranchId)
    if (winner) {
      summary += `\n## 获胜分支建议
推荐采用分支 ${winnerBranchId} 的方案：
${winner.directive}

关键优势：
- ${generateWinnerReason(winner, branches)}
- 最终结果：${winner.finalMessage.slice(0, 200)}...`
    }
  }

  return summary
}

/**
 * 映射退出原因到分支状态
 */
function mapExitReasonToBranchStatus(exitReason: string): CounterfactualBranchResult['status'] {
  switch (exitReason) {
    case 'end_turn':
    case 'test_passed':
      return 'completed'
    case 'error':
    case 'api_error':
      return 'failed'
    case 'max_turns':
      return 'failed' // 超轮次视为失败
    case 'aborted':
      return 'timeout'
    default:
      return 'failed'
  }
}
