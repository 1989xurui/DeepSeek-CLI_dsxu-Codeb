/**
 * Memory System Types - 记忆系统类型定义
 */

import type { Message, ToolCall, ToolResult } from '../types'

// ── 核心类型 ──

/**
 * 记忆类型
 */
export type MemoryType = 'episode' | 'extracted' | 'compact' | 'brief'

/**
 * 记忆记录
 */
export interface MemoryRecord {
  /** 唯一标识符 */
  id: string
  /** 记忆类型 */
  type: MemoryType
  /** 记忆内容 */
  content: string
  /** 元数据 */
  metadata: MemoryMetadata
  /** 关联的会话ID */
  sessionId: string
  /** 关联的任务ID（可选） */
  taskId?: string
  /** 关联的Episode ID（可选） */
  episodeId?: string
}

/**
 * 记忆元数据
 */
export interface MemoryMetadata {
  /** 创建时间戳 */
  createdAt: number
  /** 最后访问时间戳 */
  lastAccessed: number
  /** 访问次数 */
  accessCount: number
  /** 重要性（0-100） */
  importance: number
  /** 质量（0-1） */
  quality: number
  /** 关联的文件列表 */
  files: string[]
  /** 标签列表 */
  tags: string[]
  /** 自定义元数据 */
  custom?: Record<string, any>
}

// ── 提取相关类型 ──

/**
 * 提取的记忆
 */
export interface Memory {
  /** 记忆内容 */
  content: string
  /** 记忆类型 */
  type: 'code' | 'concept' | 'decision' | 'error' | 'insight'
  /** 置信度（0-1） */
  confidence: number
  /** 关联的文件列表 */
  files: string[]
  /** 关键片段 */
  keySnippets: string[]
  /** 标签 */
  tags: string[]
}

/**
 * 提取上下文
 */
export interface ExtractionContext {
  /** 会话ID */
  sessionId: string
  /** 任务ID（可选） */
  taskId?: string
  /** 当前文件（可选） */
  currentFile?: string
  /** 当前目录 */
  cwd: string
  /** 时间戳 */
  timestamp: number
}

// ── Episode相关类型 ──

/**
 * Episode结果
 */
export type EpisodeOutcome = 'success' | 'partial_success' | 'failure' | 'abandoned'

/**
 * Episode事件类型
 */
export type EpisodeEventType = 'tool_call' | 'message' | 'error' | 'decision' | 'note'

/**
 * Episode事件
 */
export interface EpisodeEvent {
  /** 事件类型 */
  type: EpisodeEventType
  /** 时间戳 */
  timestamp: number
  /** 事件数据 */
  data: Record<string, any>
}

/**
 * Episode
 */
export interface Episode {
  /** Episode ID */
  episodeId: string
  /** 关联的任务ID */
  taskId: string
  /** 关联的会话ID */
  sessionId: string
  /** 标题 */
  title: string
  /** 描述 */
  description: string
  /** 开始时间 */
  startTime: number
  /** 结束时间（可选） */
  endTime?: number
  /** 最终结果 */
  finalOutcome: EpisodeOutcome
  /** 工具事件列表 */
  toolEvents: EpisodeEvent[]
  /** 关键决策列表 */
  keyDecisions: string[]
  /** 学到的经验列表 */
  lessonsLearned: string[]
  /** 关联的文件列表 */
  files: string[]
  /** 元数据 */
  metadata: {
    /** 复杂度（1-10） */
    complexity: number
    /** 难度（1-10） */
    difficulty: number
    /** 价值（1-10） */
    value: number
    /** 标签 */
    tags: string[]
  }
}

// ── 搜索相关类型 ──

/**
 * 记忆搜索选项
 */
export interface MemorySearchOptions {
  /** 查询文本 */
  query: string
  /** 记忆类型（可选） */
  type?: MemoryType | MemoryType[]
  /** 最小重要性（可选） */
  minImportance?: number
  /** 最小质量（可选） */
  minQuality?: number
  /** 包含的标签（可选） */
  includeTags?: string[]
  /** 排除的标签（可选） */
  excludeTags?: string[]
  /** 限制返回数量（可选） */
  limit?: number
  /** 偏移量（可选） */
  offset?: number
  /** 是否按相关性排序（可选） */
  sortByRelevance?: boolean
}

/**
 * 记忆搜索结果
 */
export interface MemorySearchResult {
  /** 记忆记录 */
  memory: MemoryRecord
  /** 相关性分数（0-1） */
  relevance: number
  /** 匹配的片段 */
  matchedSnippets: string[]
  /** 匹配的标签 */
  matchedTags: string[]
}

// ── 流水线相关类型 ──

/**
 * 流水线类型
 */
export type PipelineType = 'compact' | 'brief' | 'classify'

/**
 * 流水线配置
 */
export interface PipelineConfig {
  /** 是否启用Compact流水线 */
  compactEnabled: boolean
  /** Compact触发的最小消息数 */
  compactMinMessages: number
  /** Compact触发的最小token数 */
  compactMinTokens: number
  /** Compact模型 */
  compactModel: string

  /** 是否启用Brief流水线 */
  briefEnabled: boolean
  /** Brief触发条件：任务完成时 */
  briefOnTaskComplete: boolean
  /** Brief触发条件：会话结束时 */
  briefOnSessionEnd: boolean
  /** Brief模型 */
  briefModel: string

  /** 是否启用Classify流水线 */
  classifyEnabled: boolean
  /** 自动分类提取的记忆 */
  classifyExtractedMemories: boolean
  /** 分类模型 */
  classifyModel: string

  /** 性能配置 */
  performance: {
    /** 批量处理大小 */
    batchSize: number
    /** 处理超时（毫秒） */
    timeoutMs: number
    /** 最大重试次数 */
    maxRetries: number
  }
}

/**
 * 流水线结果
 */
export interface PipelineResult {
  /** 流水线类型 */
  type: PipelineType
  /** 是否成功 */
  success: boolean
  /** 生成的记忆ID列表 */
  memoryIds: string[]
  /** 处理耗时（毫秒） */
  durationMs: number
  /** 错误信息（可选） */
  error?: string
  /** 统计信息 */
  stats: {
    /** 输入数量 */
    inputCount: number
    /** 输出数量 */
    outputCount: number
    /** 跳过数量 */
    skippedCount: number
  }
}

/**
 * Compact流水线结果
 */
export interface CompactResult extends PipelineResult {
  type: 'compact'
  /** 压缩摘要 */
  summary: string
  /** 原始消息数 */
  originalMessageCount: number
  /** 压缩后消息数 */
  compressedMessageCount: number
}

/**
 * Brief流水线结果
 */
export interface BriefResult extends PipelineResult {
  type: 'brief'
  /** 简短摘要 */
  brief: string
  /** 摘要长度 */
  length: number
  /** 目标ID */
  targetId: string
}

/**
 * Classify流水线结果
 */
export interface ClassifyResult extends PipelineResult {
  type: 'classify'
  /** 分类的记忆ID列表 */
  classifiedMemoryIds: string[]
  /** 新增的标签 */
  addedTags: Record<string, string[]>
  /** 更新的重要性分数 */
  updatedImportance: Record<string, number>
}

// ── 存储相关类型 ──

/**
 * 存储统计信息
 */
export interface StorageStats {
  /** 总记忆数 */
  totalMemories: number
  /** 按类型统计 */
  byType: Record<MemoryType, number>
  /** 按重要性统计 */
  byImportance: {
    /** 低重要性（0-33） */
    low: number
    /** 中重要性（34-66） */
    medium: number
    /** 高重要性（67-100） */
    high: number
  }
  /** 按质量统计 */
  byQuality: {
    /** 差（0-0.25） */
    poor: number
    /** 一般（0.26-0.5） */
    fair: number
    /** 好（0.51-0.75） */
    good: number
    /** 优秀（0.76-1） */
    excellent: number
  }
  /** 存储大小（字节） */
  storageSize: number
  /** 索引大小（字节） */
  indexSize: number
}

/**
 * 存储查询
 */
export interface StorageQuery {
  /** 查询条件（可选） */
  where?: {
    /** 记忆类型（可选） */
    type?: MemoryType | MemoryType[]
    /** 会话ID（可选） */
    sessionId?: string
    /** 任务ID（可选） */
    taskId?: string
    /** Episode ID（可选） */
    episodeId?: string
    /** 标签（可选） */
    tags?: string[]
    /** 重要性范围（可选） */
    importance?: {
      /** 大于等于 */
      gte?: number
      /** 小于等于 */
      lte?: number
    }
    /** 质量范围（可选） */
    quality?: {
      /** 大于等于 */
      gte?: number
      /** 小于等于 */
      lte?: number
    }
    /** 创建时间范围（可选） */
    createdAt?: {
      /** 大于等于 */
      gte?: number
      /** 小于等于 */
      lte?: number
    }
  }
  /** 排序方式（可选） */
  orderBy?: {
    /** 排序字段 */
    field: 'createdAt' | 'lastAccessed' | 'importance' | 'quality' | 'accessCount'
    /** 排序方向 */
    direction: 'asc' | 'desc'
  }
  /** 限制数量（可选） */
  limit?: number
  /** 偏移量（可选） */
  offset?: number
}

/**
 * 批量操作
 */
export interface StorageBatchOperation {
  /** 操作类型 */
  type: 'insert' | 'update' | 'delete'
  /** 记忆ID */
  memoryId: string
  /** 记忆数据（仅insert/update需要） */
  memory?: MemoryRecord
  /** 更新字段（仅update需要） */
  updates?: Partial<MemoryRecord>
}

// ── 记忆系统接口 ──

/**
 * 记忆系统接口
 */
export interface MemorySystem {
  // ── 基础操作 ──

  /** 添加记忆 */
  addMemory(memory: Omit<MemoryRecord, 'id' | 'metadata'> & { metadata?: Partial<MemoryMetadata> }): Promise<string>

  /** 获取记忆 */
  getMemory(id: string): Promise<MemoryRecord | null>

  /** 更新记忆 */
  updateMemory(id: string, updates: Partial<MemoryRecord>): Promise<boolean>

  /** 删除记忆 */
  deleteMemory(id: string): Promise<boolean>

  /** 批量操作 */
  batch(operations: StorageBatchOperation[]): Promise<{ success: boolean; errors?: string[] }>

  // ── 查询操作 ──

  /** 查询记忆 */
  query(query: StorageQuery): Promise<MemoryRecord[]>

  /** 搜索记忆 */
  search(options: MemorySearchOptions): Promise<MemorySearchResult[]>

  /** 获取统计信息 */
  getStats(): Promise<StorageStats>

  // ── 提取功能 ──

  /** 从消息中提取记忆 */
  extractFromMessages(messages: Message[], context: ExtractionContext): Promise<Memory[]>

  /** 从工具调用中提取记忆 */
  extractFromToolCalls(toolCalls: ToolCall[], context: ExtractionContext): Promise<Memory[]>

  /** 从工具结果中提取记忆 */
  extractFromToolResults(toolResults: ToolResult[], context: ExtractionContext): Promise<Memory[]>

  // ── Episode功能 ──

  /** 创建Episode */
  createEpisode(episode: Omit<Episode, 'episodeId'>): Promise<string>

  /** 获取Episode */
  getEpisode(episodeId: string): Promise<Episode | null>

  /** 更新Episode */
  updateEpisode(episodeId: string, updates: Partial<Episode>): Promise<boolean>

  /** 添加Episode事件 */
  addEpisodeEvent(episodeId: string, event: EpisodeEvent): Promise<boolean>

  /** 获取任务的所有Episodes */
  getEpisodesByTask(taskId: string): Promise<Episode[]>

  // ── 流水线功能 ──

  /** 运行Compact流水线 */
  runCompactPipeline(sessionId: string, messages: Message[]): Promise<CompactResult>

  /** 运行Brief流水线 */
  runBriefPipeline(targetId: string, type: 'task' | 'session'): Promise<BriefResult>

  /** 运行Classify流水线 */
  runClassifyPipeline(memoryIds: string[]): Promise<ClassifyResult>

  /** 获取流水线配置 */
  getPipelineConfig(): PipelineConfig

  /** 更新流水线配置 */
  updatePipelineConfig(config: Partial<PipelineConfig>): Promise<void>

  // ── 管理功能 ──

  /** 清理旧记忆 */
  cleanup(maxAgeDays?: number, minImportance?: number): Promise<{ deleted: number; kept: number }>

  /** 导出记忆 */
  export(format?: 'json' | 'csv'): Promise<string>

  /** 导入记忆 */
  import(data: string, format?: 'json' | 'csv'): Promise<{ imported: number; skipped: number }>

  /** 重置记忆系统 */
  reset(): Promise<void>
}

// ── 工具函数类型 ──

export interface MemorySystemOptions {
  /** 是否启用记忆系统 */
  enabled?: boolean
  /** 记忆存储路径 */
  storagePath?: string
  /** 最大记忆数量 */
  maxMemories?: number
  /** 自动清理间隔（毫秒） */
  cleanupInterval?: number
  /** 流水线配置 */
  pipelineConfig?: Partial<PipelineConfig>
}