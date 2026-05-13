/**
 * #2 Extract Memories + #3 Session Memory
 *
 * 对话结束时提取关键记忆：
 *   1. 调 LLM 提取结构化知识（技术决策、修复方案、用户偏好）
 *   2. 质量打分，< 0.6 不写入
 *   3. 写入 MSA L3 归档 + ExperienceStore
 *
 * 与 Compact 联动（#3 Session Memory）：
 *   fullCompact 时，一次 LLM 调用同时完成压缩 + 记忆提取
 *
 * 与 DSXU 的区别：
 *   - DSXU 用小模型路由提取记忆（便宜）
 *   - DSxu 用 DeepSeek chat 提取（更便宜）
 */

import type { Message, LLMCallFn, LLMResponse } from './types'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../utils/model/deepseekV4Control'

// ── 记忆类型 ──

/** H-4R: 记忆分类 */
export type MemoryCategory = 'bug' | 'decision' | 'task-state' | 'repo-context' | 'recovery-history' | 'technical-pattern' | 'user-preference'

export interface Memory {
  /** 唯一 ID */
  id: string
  /** 记忆类型 */
  type: 'technical_decision' | 'bug_fix' | 'user_preference' | 'project_pattern' | 'error_solution' | 'general'
  /** H-4R: 记忆分类 */
  category: MemoryCategory
  /** 标题 */
  title: string
  /** 内容 */
  content: string
  /** 关联文件 */
  files: string[]
  /** 关联标签 */
  tags: string[]
  /** 质量分数 (0-1) */
  quality: number
  /** 提取时间 */
  timestamp: string
  /** 来源会话 ID */
  sessionId: string
  /** H-4R: 置信度 */
  confidence: number
  /** H-4R: 元数据 */
  metadata?: Record<string, any>
}

/** H-4R: 提取的记忆 */
export interface ExtractedMemory {
  /** 记忆ID */
  id: string
  /** 分类 */
  category: MemoryCategory
  /** 标题 */
  title: string
  /** 内容 */
  content: string
  /** 置信度 (0-1) */
  confidence: number
  /** 关联文件 */
  relatedFiles: string[]
  /** 时间戳 */
  timestamp: number
  /** 来源消息索引 */
  sourceMessageIndices: number[]
  /** 元数据 */
  metadata: Record<string, any>
}

/** H-4R: 记忆索引提示 */
export interface MemoryIndexHint {
  /** 提示类型 */
  type: 'category' | 'file' | 'time' | 'confidence'
  /** 提示值 */
  value: string | number
  /** 权重 */
  weight: number
}

export interface ExtractionResult {
  /** 提取的记忆列表 */
  memories: Memory[]
  /** 被过滤掉的低质量记忆数 */
  filteredCount: number
  /** 总提取数 */
  totalExtracted: number
}

// ── 记忆提取 Prompt ──

const EXTRACTION_PROMPT = `You are a precise knowledge extractor. Analyze the conversation and extract key learnings.

For EACH distinct piece of knowledge, output a JSON object on its own line:
{"type":"<type>","title":"<short title>","content":"<detailed content>","files":["<file paths>"],"tags":["<tags>"],"quality":<0-1>}

Types: technical_decision, bug_fix, user_preference, project_pattern, error_solution, general

Quality scoring:
- 1.0: Critical decision with clear reasoning
- 0.8: Useful pattern/fix that applies broadly
- 0.6: Context-specific but reusable
- 0.4: Trivial or too specific
- 0.2: Just a statement of fact

RULES:
1. Only extract ACTIONABLE knowledge (not "user said hello")
2. Include file paths when relevant
3. Be specific — "use vitest not jest" is better than "testing is important"
4. Minimum 1, maximum 10 memories per conversation
5. Each memory should be self-contained (understandable without conversation context)

Output ONLY JSON lines, no other text.`

// ── 核心提取函数 ──

/**
 * 从对话中提取记忆
 *
 * @param messages 对话消息历史
 * @param llmCall LLM 调用函数
 * @param sessionId 会话 ID
 * @param qualityThreshold 质量阈值（默认 0.6）
 */
export async function extractMemories(
  messages: Message[],
  llmCall: LLMCallFn,
  sessionId: string,
  qualityThreshold: number = 0.6,
): Promise<ExtractionResult> {
  // 过滤出有意义的对话（跳过 system、短消息）
  const meaningful = messages.filter(m => {
    if (m.role === 'system') return false
    const content = typeof m.content === 'string' ? m.content : ''
    return content.length > 20
  })

  if (meaningful.length < 4) {
    // 太短的对话不提取
    return { memories: [], filteredCount: 0, totalExtracted: 0 }
  }

  // 构建提取请求
  const conversationText = meaningful.slice(-30).map(m => {
    const role = m.role
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    return `[${role}]: ${content.slice(0, 1000)}`
  }).join('\n\n')

  try {
    const response = await llmCall(
      [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: `Extract memories from this conversation:\n\n${conversationText}` },
      ],
      [],
      {
        model: DEEPSEEK_V4_FLASH_MODEL,
        maxTokens: 2000,
      },
    )

    const memories = parseMemories(response.content, sessionId)
    const qualified = memories.filter(m => m.quality >= qualityThreshold)

    console.log(
      `[MemoryExtractor] Extracted ${memories.length} memories, ` +
      `${qualified.length} passed quality threshold (${qualityThreshold})`
    )

    return {
      memories: qualified,
      filteredCount: memories.length - qualified.length,
      totalExtracted: memories.length,
    }
  } catch (error: any) {
    console.warn(`[MemoryExtractor] Extraction failed: ${error.message}`)
    return { memories: [], filteredCount: 0, totalExtracted: 0 }
  }
}

/** 解析 LLM 输出的 JSON lines 为 Memory[] */
function parseMemories(text: string, sessionId: string): Memory[] {
  const memories: Memory[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue

    try {
      const obj = JSON.parse(trimmed)

      if (!obj.type || !obj.title || !obj.content) continue

      memories.push({
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: obj.type || 'general',
        title: String(obj.title).slice(0, 200),
        content: String(obj.content).slice(0, 2000),
        files: Array.isArray(obj.files) ? obj.files.map(String) : [],
        tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
        quality: typeof obj.quality === 'number' ? Math.max(0, Math.min(1, obj.quality)) : 0.5,
        timestamp: new Date().toISOString(),
        sessionId,
      })
    } catch {
      // Skip malformed lines
    }
  }

  return memories
}

// ── Session Memory（与 Compact 联动） ──

/**
 * 从 Compact 摘要中提取会话级记忆
 *
 * 在 fullCompact 的 onArchive 回调中使用：
 *   onArchive: async (messages, summary) => {
 *     const memories = await extractFromCompactSummary(summary, llmCall, sessionId)
 *     // 写入 L3
 *   }
 */
export async function extractFromCompactSummary(
  summary: string,
  llmCall: LLMCallFn,
  sessionId: string,
): Promise<Memory[]> {
  if (!summary || summary.length < 50) return []

  try {
    const response = await llmCall(
      [
        { role: 'system', content: EXTRACTION_PROMPT },
        {
          role: 'user',
          content: `Extract key learnings from this conversation summary:\n\n${summary.slice(0, 4000)}`,
        },
      ],
      [],
      { model: DEEPSEEK_V4_FLASH_MODEL, maxTokens: 1000 },
    )

    return parseMemories(response.content, sessionId).filter(m => m.quality >= 0.6)
  } catch {
    return []
  }
}

// ── Memory Store（内存 + 可选持久化） ──

export class MemoryStore {
  private memories: Memory[] = []
  private persistCallback?: (memory: Memory) => Promise<void>

  constructor(persistCallback?: (memory: Memory) => Promise<void>) {
    this.persistCallback = persistCallback
  }

  /** 添加记忆 */
  async add(memory: Memory): Promise<void> {
    // 去重（相同 title + type → 更新）
    const existingIdx = this.memories.findIndex(
      m => m.title === memory.title && m.type === memory.type
    )
    if (existingIdx >= 0) {
      this.memories[existingIdx] = memory
    } else {
      this.memories.push(memory)
    }

    // 持久化
    if (this.persistCallback) {
      await this.persistCallback(memory).catch(e =>
        console.warn(`[MemoryStore] Persist failed: ${e.message}`)
      )
    }
  }

  /** 批量添加 */
  async addAll(memories: Memory[]): Promise<void> {
    for (const m of memories) {
      await this.add(m)
    }
  }

  /** 按关键词搜索 */
  search(query: string, limit: number = 5): Memory[] {
    const keywords = query.toLowerCase().split(/\s+/)

    return this.memories
      .map(m => {
        const text = `${m.title} ${m.content} ${m.tags.join(' ')} ${m.files.join(' ')}`.toLowerCase()
        const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0)
        return { memory: m, score }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.memory.quality - a.memory.quality)
      .slice(0, limit)
      .map(item => item.memory)
  }

  /** 获取所有记忆 */
  getAll(): Memory[] {
    return [...this.memories]
  }

  /** 获取统计 */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {}
    for (const m of this.memories) {
      byType[m.type] = (byType[m.type] || 0) + 1
    }
    return { total: this.memories.length, byType }
  }

  /** 清空 */
  clear(): void {
    this.memories = []
  }
}

// ── H-4R: 增强记忆提取 ──

/**
 * 增强记忆提取 - 支持 H-4R 分类
 */
export async function extractMemoriesEnhanced(
  messages: Message[],
  llmCall: LLMCallFn,
  sessionId: string,
  options?: {
    qualityThreshold?: number
    minConfidence?: number
    targetCategories?: MemoryCategory[]
  }
): Promise<{
  memories: Memory[]
  extractedMemories: ExtractedMemory[]
  categoryStats: Record<MemoryCategory, number>
  indexHints: MemoryIndexHint[]
}> {
  // 先执行基础提取
  const baseResult = await extractMemories(messages, llmCall, sessionId, options?.qualityThreshold || 0.6)

  // 转换为增强的记忆格式
  const extractedMemories: ExtractedMemory[] = baseResult.memories.map(memory => {
    // 将旧类型映射到新分类
    const category = mapMemoryTypeToCategory(memory.type)

    return {
      id: memory.id,
      category,
      title: memory.title,
      content: memory.content,
      confidence: memory.quality, // 使用质量作为置信度
      relatedFiles: memory.files,
      timestamp: Date.parse(memory.timestamp),
      sourceMessageIndices: [], // 需要更复杂的分析来填充
      metadata: {
        originalType: memory.type,
        tags: memory.tags,
        sessionId: memory.sessionId
      }
    }
  })

  // 计算分类统计
  const categoryStats: Record<MemoryCategory, number> = {
    'bug': 0, 'decision': 0, 'task-state': 0, 'repo-context': 0,
    'recovery-history': 0, 'technical-pattern': 0, 'user-preference': 0
  }

  extractedMemories.forEach(memory => {
    categoryStats[memory.category] = (categoryStats[memory.category] || 0) + 1
  })

  // 生成索引提示
  const indexHints = generateMemoryIndexHints(extractedMemories, categoryStats)

  return {
    memories: baseResult.memories,
    extractedMemories,
    categoryStats,
    indexHints
  }
}

/** 将旧记忆类型映射到新分类 */
function mapMemoryTypeToCategory(type: string): MemoryCategory {
  const mapping: Record<string, MemoryCategory> = {
    'bug_fix': 'bug',
    'error_solution': 'bug',
    'technical_decision': 'decision',
    'project_pattern': 'technical-pattern',
    'user_preference': 'user-preference'
  }

  return mapping[type] || 'decision' // 默认分类
}

/** 生成记忆索引提示 */
function generateMemoryIndexHints(
  memories: ExtractedMemory[],
  categoryStats: Record<MemoryCategory, number>
): MemoryIndexHint[] {
  const hints: MemoryIndexHint[] = []

  // 按分类生成提示
  Object.entries(categoryStats).forEach(([category, count]) => {
    if (count > 0) {
      hints.push({
        type: 'category',
        value: category,
        weight: count / memories.length
      })
    }
  })

  // 按置信度生成提示
  const avgConfidence = memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length
  hints.push({
    type: 'confidence',
    value: avgConfidence,
    weight: 0.5
  })

  // 按文件关联生成提示
  const fileMap = new Map<string, number>()
  memories.forEach(memory => {
    memory.relatedFiles.forEach(file => {
      fileMap.set(file, (fileMap.get(file) || 0) + 1)
    })
  })

  Array.from(fileMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([file, count]) => {
      hints.push({
        type: 'file',
        value: file,
        weight: count / memories.length
      })
    })

  return hints
}

// ── Auto Dream 记忆整合 ──

/**
 * Auto Dream 记忆整合配置
 */
export interface AutoDreamConfig {
  /** 是否启用 Auto Dream 记忆整合 */
  enabled?: boolean
  /** 整合间隔（毫秒） */
  intervalMs?: number
  /** 每次整合的最大记忆数 */
  batchSize?: number
  /** 质量阈值 */
  qualityThreshold?: number
  /** 整合回调函数 */
  integrateCallback?: (integratedMemory: Memory) => Promise<void>
}

/**
 * Auto Dream 记忆整合器
 *
 * 低优先后台整合历史记忆，不阻塞主循环
 */
export class AutoDreamIntegrator {
  private config: Required<AutoDreamConfig>
  private memoryStore: MemoryStore
  private isRunning: boolean = false
  private timeoutId: NodeJS.Timeout | null = null
  private pendingMemories: Memory[] = []

  constructor(
    memoryStore: MemoryStore,
    config?: AutoDreamConfig
  ) {
    this.memoryStore = memoryStore
    this.config = {
      enabled: config?.enabled ?? true,
      intervalMs: config?.intervalMs ?? 30000, // DSXU comment sanitized.
      batchSize: config?.batchSize ?? 10,
      qualityThreshold: config?.qualityThreshold ?? 0.7,
      integrateCallback: config?.integrateCallback ?? (async () => {})
    }
  }

  /**
   * 启动 Auto Dream 整合
   */
  start(): void {
    if (!this.config.enabled || this.isRunning) return

    this.isRunning = true
    console.log(`[AutoDream] Starting memory integration (interval: ${this.config.intervalMs}ms)`)
    this.scheduleNextIntegration()
  }

  /**
   * 停止 Auto Dream 整合
   */
  stop(): void {
    this.isRunning = false
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    console.log('[AutoDream] Stopped memory integration')
  }

  /**
   * 添加待整合的记忆
   */
  addMemories(memories: Memory[]): void {
    if (!this.config.enabled) return

    // 过滤低质量记忆
    const qualified = memories.filter(m => m.quality >= this.config.qualityThreshold)
    this.pendingMemories.push(...qualified)

    console.log(`[AutoDream] Added ${qualified.length} memories for integration (total pending: ${this.pendingMemories.length})`)
  }

  /**
   * 获取整合状态
   */
  getStatus(): {
    enabled: boolean
    isRunning: boolean
    pendingCount: number
    config: AutoDreamConfig
  } {
    return {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      pendingCount: this.pendingMemories.length,
      config: this.config
    }
  }

  /**
   * 手动触发整合
   */
  async integrateNow(): Promise<void> {
    if (!this.config.enabled) return
    await this.performIntegration()
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AutoDreamConfig>): void {
    const wasEnabled = this.config.enabled
    Object.assign(this.config, config)

    if (!wasEnabled && this.config.enabled) {
      this.start()
    } else if (wasEnabled && !this.config.enabled) {
      this.stop()
    }

    console.log(`[AutoDream] Config updated: ${JSON.stringify(config)}`)
  }

  // 私有方法

  private scheduleNextIntegration(): void {
    if (!this.isRunning) return

    this.timeoutId = setTimeout(async () => {
      try {
        await this.performIntegration()
      } catch (error: any) {
        console.warn(`[AutoDream] Integration failed: ${error.message}`)
      } finally {
        if (this.isRunning) {
          this.scheduleNextIntegration()
        }
      }
    }, this.config.intervalMs)
  }

  private async performIntegration(): Promise<void> {
    if (this.pendingMemories.length === 0) {
      console.log('[AutoDream] No pending memories to integrate')
      return
    }

    // 获取一批记忆进行整合
    const batch = this.pendingMemories.splice(0, this.config.batchSize)
    console.log(`[AutoDream] Integrating ${batch.length} memories`)

    // 这里可以实现更复杂的整合逻辑，比如：
    // 1. 合并相似记忆
    // 2. 提取更高层次的模式
    // 3. 更新现有记忆的质量分数
    // 目前我们只是简单地将它们添加到MemoryStore

    for (const memory of batch) {
      try {
        // 添加到MemoryStore
        await this.memoryStore.add(memory)

        // 调用整合回调
        await this.config.integrateCallback(memory)

        console.log(`[AutoDream] Integrated memory: ${memory.title} (quality: ${memory.quality})`)
      } catch (error: any) {
        console.warn(`[AutoDream] Failed to integrate memory "${memory.title}": ${error.message}`)
      }
    }

    console.log(`[AutoDream] Integration completed. Remaining pending: ${this.pendingMemories.length}`)
  }
}
