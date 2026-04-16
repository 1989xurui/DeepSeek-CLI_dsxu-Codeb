/**
 * #7 Auto Compact — 上下文压缩引擎
 *
 * 学 Claude 的多层压缩策略：
 *   1. Micro-compact: 清理旧 tool result（不调 LLM，零成本）
 *   2. Auto-compact: 调 DeepSeek chat 总结旧对话（¥0.001/次）
 *   3. 压前归档: 原文写入 MSA L3（不丢信息）
 *
 * 护栏（V13 规定）：
 *   - 最近 3 轮不压
 *   - 用户指令不压
 *   - 压缩后 L3 归档原文
 *
 * 与 proxy 的 hardTruncate 区别：
 *   proxy 是暴力截断（丢信息），compact 是智能摘要（保关键信息）
 */

import type { Message, LLMCallFn } from './types'

/** Token 估算（与 proxy 一致） */
function estimateTokens(s: string): number {
  if (!s) return 0
  let zh = 0, other = 0
  for (const char of s) {
    const c = char.charCodeAt(0)
    if (c >= 0x4e00 && c <= 0x9fff) zh++
    else other++
  }
  return Math.ceil(zh * 0.6 + other * 0.28)
}

function estimateMessageTokens(msg: Message): number {
  let t = 4  // role overhead
  if (typeof msg.content === 'string') t += estimateTokens(msg.content)
  else if (Array.isArray(msg.content)) {
    for (const b of msg.content) t += estimateTokens(JSON.stringify(b))
  }
  if (msg.toolCalls) t += estimateTokens(JSON.stringify(msg.toolCalls))
  if (msg.reasoning) t += estimateTokens(msg.reasoning)
  return t
}

function estimateAllTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}

export interface CompactConfig {
  /** 触发自动压缩的 token 阈值（默认 100K） */
  autoCompactThreshold?: number
  /** 保留最近 N 轮对话不压（默认 3） */
  keepRecentRounds?: number
  /** 压缩摘要的最大 token（默认 4000） */
  summaryMaxTokens?: number
  /** L3 归档回调（压缩前调用） */
  onArchive?: (messages: Message[], summary: string) => Promise<void>
  /** 分层压缩策略：micro -> light -> full */
  enableTieredCompaction?: boolean
  /** light压缩阈值（默认 70% 上下文使用率） */
  lightCompactThreshold?: number
  /** full压缩阈值（默认 85% 上下文使用率） */
  fullCompactThreshold?: number
  /** 保护阈值：压缩后至少保留的token数（默认 20K） */
  minTokensAfterCompact?: number
  /** 压缩冷却时间（ms，默认 30秒） */
  cooldownMs?: number
  /** 单消息最大token限制（默认 8000） */
  maxSingleMessageTokens?: number
  /** 启用二次压缩策略（默认 true） */
  enableSecondaryStrategy?: boolean
  /** 启用单消息超长保护（默认 true） */
  enableSingleMessageProtection?: boolean
  /** 单消息超长警告阈值（默认 5000 tokens） */
  singleMessageWarningThreshold?: number
  /** 启用自动预压缩检查（默认 true） */
  enablePreCompactCheck?: boolean
}

export interface CompactResult {
  /** 压缩后的消息 */
  messages: Message[]
  /** 是否执行了压缩 */
  wasCompacted: boolean
  /** 压缩类型 */
  compactType: 'none' | 'micro' | 'light' | 'full' | 'emergency'
  /** 压缩前后 token 变化 */
  tokensBefore: number
  tokensAfter: number
  /** 被压缩的消息数 */
  messagesRemoved: number
  /** 使用的压缩策略 */
  strategyUsed?: 'none' | 'micro' | 'light' | 'full' | 'aggressive' | 'minimal' | 'emergency' | 'cooldown' | 'emergency_single_truncate' | 'emergency_aggressive' | 'emergency_extreme'
  /** 是否有单消息被截断 */
  singleMessageTruncated?: boolean
  /** 压缩节省的token数 */
  tokensSaved?: number
  /** 上下文使用率（压缩前） */
  usageRatioBefore?: number
  /** 上下文使用率（压缩后） */
  usageRatioAfter?: number
  /** 是否触发了单消息超长警告 */
  singleMessageWarning?: boolean
  /** 压缩耗时（ms） */
  durationMs?: number
  /** 错误信息（如果有） */
  error?: string
}

/**
 * Micro-compact: 清理旧 tool result（不调 LLM）
 *
 * 策略：
 * - 保留最近 keepN 条 tool result 完整内容
 * - 更早的 tool result 替换为 "[Earlier tool result cleared]"
 * - 不改变消息数量，只缩短内容
 */
export function microCompact(
  messages: Message[],
  keepRecentToolResults: number = 8,
): CompactResult {
  const tokensBefore = estimateAllTokens(messages)

  // 找到所有 tool role 消息的索引
  const toolIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'tool') toolIndices.push(i)
  }

  if (toolIndices.length <= keepRecentToolResults) {
    return {
      messages,
      wasCompacted: false,
      compactType: 'none',
      tokensBefore,
      tokensAfter: tokensBefore,
      messagesRemoved: 0,
      tokensSaved: 0,
    }
  }

  // 清理旧的 tool results
  const cutoff = toolIndices[toolIndices.length - keepRecentToolResults]
  const result = messages.map((m, i) => {
    if (m.role === 'tool' && i < cutoff) {
      const content = typeof m.content === 'string' ? m.content : ''
      if (content.length > 100) {
        return { ...m, content: '[Earlier tool result cleared by compact]' }
      }
    }
    return m
  })

  const tokensAfter = estimateAllTokens(result)
  const tokensSaved = tokensBefore - tokensAfter
  return {
    messages: result,
    wasCompacted: tokensBefore !== tokensAfter,
    compactType: 'micro',
    tokensBefore,
    tokensAfter,
    messagesRemoved: 0,
    tokensSaved,
  }
}

/**
 * Full Compact: 调 LLM 总结旧消息
 *
 * 策略（学 Claude）：
 * 1. 保留 system 消息
 * 2. 保留最近 keepRecentRounds 轮
 * 3. 把更早的消息发给 LLM 总结
 * 4. 总结替换旧消息
 * 5. 归档原文到 MSA L3
 */
export async function fullCompact(
  messages: Message[],
  llmCall: LLMCallFn,
  config?: CompactConfig,
): Promise<CompactResult> {
  const keepRounds = config?.keepRecentRounds ?? 3
  const summaryMaxTokens = config?.summaryMaxTokens ?? 4000
  const tokensBefore = estimateAllTokens(messages)

  // 分离 system 和非 system 消息
  const systemMsgs = messages.filter(m => m.role === 'system')
  const otherMsgs = messages.filter(m => m.role !== 'system')

  // 保留最近 N 轮（user + assistant + tool 算一个序列）
  // 从后往前找 N 个 user 消息
  let keepFromIndex = 0  // 默认保留全部（不够 N 轮时不压）
  let userCount = 0
  for (let i = otherMsgs.length - 1; i >= 0; i--) {
    if (otherMsgs[i].role === 'user') {
      userCount++
      if (userCount >= keepRounds) {
        keepFromIndex = i
        break
      }
    }
  }

  // 确保不切在 assistant(tool_calls) 和 tool 之间
  while (keepFromIndex > 0 && otherMsgs[keepFromIndex]?.role === 'tool') {
    keepFromIndex--
  }

  const oldMsgs = otherMsgs.slice(0, keepFromIndex)
  const recentMsgs = otherMsgs.slice(keepFromIndex)

  if (oldMsgs.length === 0) {
    return {
      messages,
      wasCompacted: false,
      compactType: 'none',
      tokensBefore,
      tokensAfter: tokensBefore,
      messagesRemoved: 0,
      tokensSaved: 0,
    }
  }

  // 构建摘要请求（学 Claude 的 compact prompt）
  const oldText = oldMsgs.map(m => {
    const role = m.role
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    return `[${role}]: ${content.slice(0, 2000)}`
  }).join('\n\n')

  const summaryPrompt = `Summarize the following conversation history concisely but preserving ALL key information.

REQUIRED sections in your summary:
1. **Primary Request**: What the user originally asked for
2. **Key Technical Concepts**: Technologies, frameworks, patterns discussed
3. **Files Modified**: List of files that were created/edited with brief descriptions
4. **Errors & Fixes**: Any errors encountered and how they were resolved
5. **Current State**: What was accomplished, what's working
6. **Pending Tasks**: What still needs to be done
7. **User Messages**: Paraphrase ALL user instructions (never lose user intent)

Keep the summary under ${summaryMaxTokens} tokens. Be precise with file paths and code details.

---
CONVERSATION TO SUMMARIZE:

${oldText}`

  try {
    // 调 LLM 生成摘要
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a precise conversation summarizer. Output a structured summary preserving all critical details.' },
        { role: 'user', content: summaryPrompt },
      ],
      [],  // 不需要工具
      {
        model: 'deepseek-chat',  // 用 chat 就够（便宜）
        maxTokens: summaryMaxTokens,
      },
    )

    const summary = response.content

    // 归档原文到 L3
    if (config?.onArchive) {
      await config.onArchive(oldMsgs, summary).catch(e =>
        console.warn(`[Compact] L3 归档失败: ${e.message}`)
      )
    }

    // 构建压缩后的消息
    const compactedMessages: Message[] = [
      ...systemMsgs,
      {
        role: 'system',
        content: `<conversation_summary>\nThis is a summary of the earlier conversation:\n\n${summary}\n</conversation_summary>`,
      },
      ...recentMsgs,
    ]

    const tokensAfter = estimateAllTokens(compactedMessages)

    console.log(
      `[Compact] ✓ full: ${tokensBefore} → ${tokensAfter} tokens ` +
      `(saved ${tokensBefore - tokensAfter}, removed ${oldMsgs.length} messages)`
    )

    const tokensSaved = tokensBefore - tokensAfter
    return {
      messages: compactedMessages,
      wasCompacted: true,
      compactType: 'full',
      tokensBefore,
      tokensAfter,
      messagesRemoved: oldMsgs.length,
      tokensSaved,
    }
  } catch (error: any) {
    console.error(`[Compact] 摘要失败: ${error.message}，降级为 micro-compact`)
    // 降级为 micro-compact
    return microCompact(messages)
  }
}

/**
 * Light Compact: 介于 micro 和 full 之间的压缩策略
 *
 * 策略：
 * - 保留 system 消息
 * - 保留最近 keepRecentRounds 轮对话
 * - 对更早的消息进行轻量摘要（不调 LLM，使用规则提取）
 * - 不归档到 L3（节省成本）
 */
export function lightCompact(
  messages: Message[],
  config?: CompactConfig,
): CompactResult {
  const keepRounds = config?.keepRecentRounds ?? 3
  const tokensBefore = estimateAllTokens(messages)

  // 分离 system 和非 system 消息
  const systemMsgs = messages.filter(m => m.role === 'system')
  const otherMsgs = messages.filter(m => m.role !== 'system')

  // 保留最近 N 轮（user + assistant + tool 算一个序列）
  let keepFromIndex = 0
  let userCount = 0
  for (let i = otherMsgs.length - 1; i >= 0; i--) {
    if (otherMsgs[i].role === 'user') {
      userCount++
      if (userCount >= keepRounds) {
        keepFromIndex = i
        break
      }
    }
  }

  // 确保不切在 assistant(tool_calls) 和 tool 之间
  while (keepFromIndex > 0 && otherMsgs[keepFromIndex]?.role === 'tool') {
    keepFromIndex--
  }

  const oldMsgs = otherMsgs.slice(0, keepFromIndex)
  const recentMsgs = otherMsgs.slice(keepFromIndex)

  if (oldMsgs.length === 0) {
    return {
      messages,
      wasCompacted: false,
      compactType: 'none',
      tokensBefore,
      tokensAfter: tokensBefore,
      messagesRemoved: 0,
      tokensSaved: 0,
    }
  }

  // 轻量摘要：提取关键信息
  const summary = generateLightSummary(oldMsgs)

  // 构建压缩后的消息
  const compactedMessages: Message[] = [
    ...systemMsgs,
    {
      role: 'system',
      content: `<light_summary>\nEarlier conversation summary:\n\n${summary}\n</light_summary>`,
    },
    ...recentMsgs,
  ]

  const tokensAfter = estimateAllTokens(compactedMessages)

  console.log(
    `[Compact] ✓ light: ${tokensBefore} → ${tokensAfter} tokens ` +
    `(saved ${tokensBefore - tokensAfter}, removed ${oldMsgs.length} messages)`
  )

  const tokensSaved = tokensBefore - tokensAfter
  return {
    messages: compactedMessages,
    wasCompacted: true,
    compactType: 'light',
    tokensBefore,
    tokensAfter,
    messagesRemoved: oldMsgs.length,
    tokensSaved,
  }
}

/**
 * 生成轻量摘要（不调 LLM）
 */
function generateLightSummary(messages: Message[]): string {
  const userMessages = messages.filter(m => m.role === 'user')
  const assistantMessages = messages.filter(m => m.role === 'assistant')
  const toolMessages = messages.filter(m => m.role === 'tool')

  // 提取关键信息
  const keyInfo: string[] = []

  // 用户意图
  if (userMessages.length > 0) {
    const firstUser = userMessages[0]
    const lastUser = userMessages[userMessages.length - 1]

    if (typeof firstUser.content === 'string') {
      keyInfo.push(`Initial request: ${firstUser.content.slice(0, 200)}`)
    }
    if (typeof lastUser.content === 'string' && userMessages.length > 1) {
      keyInfo.push(`Latest request: ${lastUser.content.slice(0, 200)}`)
    }
  }

  // 统计信息
  keyInfo.push(`Conversation stats: ${messages.length} total messages`)
  keyInfo.push(`- User: ${userMessages.length}`)
  keyInfo.push(`- Assistant: ${assistantMessages.length}`)
  keyInfo.push(`- Tool calls: ${toolMessages.length}`)

  // 提取文件操作
  const fileOperations = extractFileOperations(messages)
  if (fileOperations.length > 0) {
    keyInfo.push(`Files mentioned: ${fileOperations.slice(0, 5).join(', ')}${fileOperations.length > 5 ? '...' : ''}`)
  }

  return keyInfo.join('\n')
}

/**
 * 从消息中提取文件操作
 */
function extractFileOperations(messages: Message[]): string[] {
  const files = new Set<string>()
  const filePatterns = [
    /file[_-]?path["']?\s*:\s*["']([^"']+)["']/gi,
    /path["']?\s*:\s*["']([^"']+)["']/gi,
    /\.(ts|js|tsx|jsx|md|json|yml|yaml|txt)\b/gi,
  ]

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

    for (const pattern of filePatterns) {
      let match
      pattern.lastIndex = 0
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && match[1].includes('/') || match[1].includes('\\')) {
          files.add(match[1].trim())
        }
      }
    }
  }

  return Array.from(files).slice(0, 10) // 最多返回10个文件
}

/**
 * 分层压缩管理器（单例）
 */
class CompactionManager {
  private static instance: CompactionManager | null = null
  private lastCompactTime = 0
  private cooldownMs: number = 30_000 // 30秒冷却
  private minTokensAfterCompact: number = 20_000 // 压缩后至少保留20K tokens

  private constructor() {}

  static getInstance(config?: CompactConfig): CompactionManager {
    if (!CompactionManager.instance) {
      CompactionManager.instance = new CompactionManager()
    }

    // 更新配置
    if (config?.cooldownMs !== undefined) {
      CompactionManager.instance.cooldownMs = config.cooldownMs
    }
    if (config?.minTokensAfterCompact !== undefined) {
      CompactionManager.instance.minTokensAfterCompact = config.minTokensAfterCompact
    }

    return CompactionManager.instance
  }

  /**
   * 检查是否可以执行压缩（冷却时间）
   */
  canCompact(): boolean {
    return Date.now() - this.lastCompactTime >= this.cooldownMs
  }

  /**
   * 记录压缩时间
   */
  recordCompaction(): void {
    this.lastCompactTime = Date.now()
  }

  /**
   * 检查压缩后是否满足最小token要求
   */
  satisfiesMinTokens(tokensAfter: number): boolean {
    return tokensAfter >= this.minTokensAfterCompact
  }

  /**
   * 重置状态（用于测试）
   */
  reset(): void {
    this.lastCompactTime = 0
    // 重置单例实例，确保测试之间完全隔离
    CompactionManager.instance = null
  }
}

/**
 * 自动压缩判定 + 执行（分层策略）
 *
 * 调用方在每轮 query loop 开始时调用：
 *   const result = await autoCompactIfNeeded(messages, llmCall, config)
 *   if (result.wasCompacted) messages = result.messages
 */
export async function autoCompactIfNeeded(
  messages: Message[],
  llmCall: LLMCallFn,
  config?: CompactConfig,
): Promise<CompactResult> {
  const threshold = config?.autoCompactThreshold ?? 100_000
  const enableTiered = config?.enableTieredCompaction ?? true
  const lightThreshold = config?.lightCompactThreshold ?? 0.7
  const fullThreshold = config?.fullCompactThreshold ?? 0.85
  const enableSecondary = config?.enableSecondaryStrategy ?? true
  const enableSingleMessageProtection = config?.enableSingleMessageProtection ?? true
  const singleMessageWarningThreshold = config?.singleMessageWarningThreshold ?? 5000
  const enablePreCompactCheck = config?.enablePreCompactCheck ?? true

  const currentTokens = estimateAllTokens(messages)
  const maxContext = 128_000 // DeepSeek默认上下文
  const usageRatio = currentTokens / maxContext

  // 获取压缩管理器单例
  const manager = CompactionManager.getInstance(config)

  // 预压缩检查：单消息超长警告
  if (enablePreCompactCheck && enableSingleMessageProtection) {
    for (let i = 0; i < messages.length; i++) {
      const msgTokens = estimateMessageTokens(messages[i])
      if (msgTokens > singleMessageWarningThreshold) {
        console.warn(`[Compact] ⚠️ 消息 ${i} (${messages[i].role}) 超长: ${msgTokens} tokens > ${singleMessageWarningThreshold} 阈值`)
      }
      if (msgTokens > (config?.maxSingleMessageTokens ?? 8000)) {
        console.error(`[Compact] ❌ 消息 ${i} (${messages[i].role}) 严重超长: ${msgTokens} tokens，可能拖垮上下文`)
      }
    }
  }

  const startTime = Date.now()

  // 检查冷却时间
  if (!manager.canCompact()) {
    const duration = Date.now() - startTime
    console.log(`[Compact] 冷却中，跳过压缩 (${Date.now() - manager.lastCompactTime}ms / ${manager.cooldownMs}ms)`)
    return {
      messages,
      wasCompacted: false,
      compactType: 'none',
      strategyUsed: 'cooldown',
      tokensBefore: currentTokens,
      tokensAfter: currentTokens,
      messagesRemoved: 0,
      tokensSaved: 0,
      usageRatioBefore: usageRatio,
      usageRatioAfter: usageRatio,
      durationMs: duration,
    }
  }

  // 不到阈值 → 不压
  if (currentTokens < threshold) {
    const duration = Date.now() - startTime
    return {
      messages,
      wasCompacted: false,
      compactType: 'none',
      strategyUsed: 'none',
      tokensBefore: currentTokens,
      tokensAfter: currentTokens,
      messagesRemoved: 0,
      tokensSaved: 0,
      usageRatioBefore: usageRatio,
      usageRatioAfter: usageRatio,
      durationMs: duration,
    }
  }

  // 分层压缩策略
  if (enableTiered) {
    // 1. 先尝试 micro-compact（免费）
    const microResult = microCompact(messages)

    // 检查是否满足最小token要求
    if (!manager.satisfiesMinTokens(microResult.tokensAfter)) {
      console.warn(`[Compact] ⚠️ micro压缩后token不足: ${microResult.tokensAfter} < ${manager.minTokensAfterCompact}`)
      // 如果micro压缩后token不足，直接返回不压缩
      const duration = Date.now() - startTime
      return {
        messages,
        wasCompacted: false,
        compactType: 'none',
        strategyUsed: 'minimal',
        tokensBefore: currentTokens,
        tokensAfter: currentTokens,
        messagesRemoved: 0,
        tokensSaved: 0,
        usageRatioBefore: usageRatio,
        usageRatioAfter: usageRatio,
        durationMs: duration,
      }
    }

    if (microResult.tokensAfter < threshold * 0.8) {
      console.log(`[Compact] micro 足够: ${currentTokens} → ${microResult.tokensAfter} tokens`)
      manager.recordCompaction()
      return {
        ...microResult,
        strategyUsed: 'micro',
      }
    }

    // 2. 根据使用率选择 light 或 full
    if (usageRatio < fullThreshold) {
      // light压缩（使用率 < 85%）
      console.log(`[Compact] 使用率 ${(usageRatio * 100).toFixed(1)}% < ${fullThreshold * 100}%，执行 light compact...`)
      const lightResult = lightCompact(microResult.messages, config)

      if (manager.satisfiesMinTokens(lightResult.tokensAfter)) {
        manager.recordCompaction()
        return {
          ...lightResult,
          strategyUsed: 'light',
        }
      } else {
        console.warn(`[Compact] ⚠️ light压缩后token不足: ${lightResult.tokensAfter} < ${manager.minTokensAfterCompact}`)
      }
    }

    // 3. full压缩（使用率 >= 85% 或 light压缩后token不足）
    console.log(`[Compact] 使用率 ${(usageRatio * 100).toFixed(1)}% >= ${fullThreshold * 100}%，执行 full compact...`)
    const fullResult = await fullCompact(microResult.messages, llmCall, config)

    if (manager.satisfiesMinTokens(fullResult.tokensAfter)) {
      manager.recordCompaction()
      return {
        ...fullResult,
        strategyUsed: 'full',
      }
    } else {
      console.error(`[Compact] ❌ full压缩后token仍不足: ${fullResult.tokensAfter} < ${manager.minTokensAfterCompact}`)

      // 启用二次压缩策略
      if (enableSecondary) {
        console.log(`[Compact] 启用二次压缩策略...`)
        return await applySecondaryCompactionStrategy(messages, llmCall, config, manager)
      }

      // 返回未压缩的消息，避免过度压缩
      const duration = Date.now() - startTime
      return {
        messages,
        wasCompacted: false,
        compactType: 'none',
        strategyUsed: 'aggressive',
        tokensBefore: currentTokens,
        tokensAfter: currentTokens,
        messagesRemoved: 0,
        tokensSaved: 0,
        usageRatioBefore: usageRatio,
        usageRatioAfter: usageRatio,
        durationMs: duration,
      }
    }
  } else {
    // 旧策略：micro -> full
    const microResult = microCompact(messages)
    if (microResult.tokensAfter < threshold * 0.8) {
      console.log(`[Compact] micro 足够: ${currentTokens} → ${microResult.tokensAfter} tokens`)
      manager.recordCompaction()
      return {
        ...microResult,
        strategyUsed: 'micro',
      }
    }

    console.log(`[Compact] micro 不够 (${microResult.tokensAfter} > ${threshold * 0.8}), 执行 full compact...`)
    const fullResult = await fullCompact(microResult.messages, llmCall, config)
    manager.recordCompaction()
    return {
      ...fullResult,
      strategyUsed: 'full',
    }
  }
}

/**
 * 二次压缩策略：当full压缩后token仍不足时应用
 *
 * 升级路径：
 * 1. 单消息截断（针对个别超长消息）
 * 2. 激进压缩（保留最少轮次）
 * 3. 极端压缩（只保留最后1轮，硬截断）
 */
async function applySecondaryCompactionStrategy(
  messages: Message[],
  llmCall: LLMCallFn,
  config: CompactConfig | undefined,
  manager: CompactionManager,
): Promise<CompactResult> {
  const currentTokens = estimateAllTokens(messages)
  const maxSingleMessageTokens = config?.maxSingleMessageTokens ?? 8000
  const emergencyKeepRounds = 1 // 极端情况只保留1轮

  console.log(`[Compact] 应用二次压缩策略（升级路径）...`)

  // 策略1: 检查是否有单消息过长
  const longMessageIndex = messages.findIndex(msg => estimateTokens(msg.content) > maxSingleMessageTokens)
  if (longMessageIndex !== -1) {
    console.log(`[Compact] 策略1: 单消息截断 (${estimateTokens(messages[longMessageIndex].content)} tokens)`)
    const truncatedMessages = [...messages]
    const originalContent = truncatedMessages[longMessageIndex].content
    truncatedMessages[longMessageIndex] = {
      ...truncatedMessages[longMessageIndex],
      content: originalContent.slice(0, maxSingleMessageTokens * 4) + '... [内容过长已截断]',
    }

    const tokensAfter = estimateAllTokens(truncatedMessages)
    const tokensSaved = currentTokens - tokensAfter
    const maxContext = 128_000
    const usageRatioBefore = currentTokens / maxContext
    const usageRatioAfter = tokensAfter / maxContext
    manager.recordCompaction()
    return {
      messages: truncatedMessages,
      wasCompacted: true,
      compactType: 'emergency',
      strategyUsed: 'emergency_single_truncate',
      tokensBefore: currentTokens,
      tokensAfter,
      messagesRemoved: 0,
      tokensSaved,
      usageRatioBefore,
      usageRatioAfter,
      singleMessageTruncated: true,
    }
  }

  // 策略2: 激进压缩 - 只保留最近3轮对话
  console.log(`[Compact] 策略2: 激进压缩（保留3轮）`)
  const keepRecent = Math.min(config?.keepRecentRounds ?? 3, 3) // 激进压缩最多保留3轮
  const recentMessages = messages.slice(-keepRecent * 2) // 每轮2条消息

  // 创建摘要消息
  const summaryPrompt = `以下是之前的对话历史摘要（已压缩）：
${messages.slice(0, -keepRecent * 2).map(msg => `${msg.role}: ${msg.content.slice(0, 200)}...`).join('\n')}`

  const compressedMessages = [
    { role: 'system' as const, content: summaryPrompt },
    ...recentMessages,
  ]

  const tokensAfter = estimateAllTokens(compressedMessages)

  // 检查是否满足最小token要求
  if (manager.satisfiesMinTokens(tokensAfter)) {
    const tokensSaved = currentTokens - tokensAfter
    const maxContext = 128_000
    const usageRatioBefore = currentTokens / maxContext
    const usageRatioAfter = tokensAfter / maxContext
    manager.recordCompaction()
    return {
      messages: compressedMessages,
      wasCompacted: true,
      compactType: 'emergency',
      strategyUsed: 'emergency_aggressive',
      tokensBefore: currentTokens,
      tokensAfter,
      messagesRemoved: messages.length - compressedMessages.length,
      tokensSaved,
      usageRatioBefore,
      usageRatioAfter,
    }
  }

  // 策略3: 极端压缩 - 只保留最后1轮对话，硬截断
  console.log(`[Compact] 策略3: 极端压缩（保留1轮，硬截断）`)
  const extremeMessages = messages.slice(-emergencyKeepRounds * 2)
  const extremeSummary = `[极端压缩] 只保留最后${emergencyKeepRounds}轮对话，之前的历史已丢弃。`

  const extremeCompressedMessages = [
    { role: 'system' as const, content: extremeSummary },
    ...extremeMessages,
  ]

  const extremeTokensAfter = estimateAllTokens(extremeCompressedMessages)
  const tokensSaved = currentTokens - extremeTokensAfter
  const maxContext = 128_000
  const usageRatioBefore = currentTokens / maxContext
  const usageRatioAfter = extremeTokensAfter / maxContext
  manager.recordCompaction()
  return {
    messages: extremeCompressedMessages,
    wasCompacted: true,
    compactType: 'emergency',
    strategyUsed: 'emergency_extreme',
    tokensBefore: currentTokens,
    tokensAfter: extremeTokensAfter,
    messagesRemoved: messages.length - extremeCompressedMessages.length,
    tokensSaved,
    usageRatioBefore,
    usageRatioAfter,
    singleMessageTruncated: false,
  }
}

// 导出用于测试
export { CompactionManager }
