/**
 * 记忆智能体链类型定义
 *
 * 统一所有记忆相关组件的类型定义，提供一致的API接口
 */

import type { Message, LLMCallFn } from './types'
import type { ToolDefinition } from './types'
import type { AgentMemoryScope } from '../../tools/AgentTool/agentMemory'

// ── 基础类型 ──

export interface Memory {
  /** 唯一 ID */
  id: string
  /** 记忆类型 */
  type: 'technical_decision' | 'bug_fix' | 'user_preference' | 'project_pattern' | 'error_solution' | 'general'
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
  /** 元数据 */
  metadata?: Record<string, any>
}

export interface MemoryStats {
  /** 总记忆数 */
  totalMemories: number
  /** 按类型统计 */
  byType: Record<string, number>
  /** 提取次数 */
  extractionCount: number
  /** 整合次数 */
  integrationCount: number
  /** 智能体记忆数 */
  agentMemoryCount: number
  /** 搜索次数 */
  searchCount: number
}

export interface ComponentStatus {
  /** 是否启用 */
  enabled: boolean
  /** 最后活动时间 */
  lastActivity?: string
  /** 错误信息 */
  error?: string
  /** 自定义状态 */
  [key: string]: any
}

// ── 配置类型 ──

export interface MemoryChainConfig {
  /** 是否启用记忆链 */
  enabled: boolean

  /** 记忆提取配置 */
  extraction: MemoryExtractionConfig

  /** 自动整合配置 */
  autoDream: AutoDreamConfig

  /** 智能体记忆配置 */
  agentMemory: AgentMemoryConfig

  /** Skills集成配置 */
  skills: SkillsIntegrationConfig

  /** Fork代理配置 */
  forkAgent: ForkAgentConfig

  /** 性能配置 */
  performance: PerformanceConfig
}

export interface MemoryExtractionConfig {
  /** 是否启用记忆提取 */
  enabled: boolean
  /** 质量阈值 (0-1) */
  qualityThreshold: number
  /** 最小对话长度 */
  minConversationLength: number
  /** 提取模型 */
  model: string
  /** 是否启用会话记忆 */
  sessionMemory: SessionMemoryConfig
}

export interface SessionMemoryConfig {
  /** 是否启用会话记忆 */
  enabled: boolean
  /** 最小token数 */
  minTokens: number
  /** 工具调用间隔 */
  toolCallsBetweenUpdates: number
}

export interface AutoDreamConfig {
  /** 是否启用自动整合 */
  enabled: boolean
  /** 整合间隔（毫秒） */
  intervalMs: number
  /** 每次整合的最大记忆数 */
  batchSize: number
  /** 质量阈值 */
  qualityThreshold: number
}

export interface AgentMemoryConfig {
  /** 是否启用智能体记忆 */
  enabled: boolean
  /** 默认作用域 */
  defaultScope: AgentMemoryScope
  /** 各作用域启用状态 */
  scopes: Record<AgentMemoryScope, boolean>
}

export interface SkillsIntegrationConfig {
  /** 是否启用Skills集成 */
  enabled: boolean
  /** 自动注册Skills */
  autoRegister: boolean
  /** 排除的Skills名称 */
  excludeSkills: string[]
  /** 记忆感知Skills */
  memoryAwareSkills: string[]
}

export interface ForkAgentConfig {
  /** 是否启用Fork代理 */
  enabled: boolean
  /** 最大并发Fork数 */
  maxConcurrentForks: number
  /** 默认最大轮次 */
  defaultMaxTurns: number
  /** 默认超时时间（毫秒） */
  defaultTimeout: number
  /** 记忆感知Fork */
  memoryAwareForks: boolean
}

export interface PerformanceConfig {
  /** 批量处理 */
  batchProcessing: boolean
  /** 最大批量大小 */
  maxBatchSize: number
  /** 处理超时（毫秒） */
  processingTimeout: number
  /** 缓存启用 */
  cacheEnabled: boolean
}

// ── 处理结果类型 ──

export interface MemoryProcessingResult {
  /** 提取的记忆 */
  extractedMemories: Memory[]
  /** 整合的记忆 */
  integratedMemories: Memory[]
  /** 触发的Skills */
  triggeredSkills: string[]
  /** 创建的Fork代理 */
  createdForks: ForkResult[]
  /** 处理状态 */
  status: 'success' | 'partial' | 'error'
  /** 错误信息 */
  error?: string
  /** 处理耗时（毫秒） */
  durationMs: number
}

export interface ForkResult {
  /** Fork ID */
  forkId: string
  /** 指令 */
  directive: string
  /** 最终回复 */
  finalMessage: string
  /** 退出原因 */
  exitReason: string
  /** 总轮次 */
  turns: number
  /** Token使用 */
  usage: { inputTokens: number; outputTokens: number }
  /** 执行耗时（毫秒） */
  durationMs: number
  /** Agent摘要 */
  agentSummary?: AgentSummary
}

export interface AgentSummary {
  /** 子任务ID */
  forkId: string
  /** 指令 */
  directive: string
  /** 执行状态 */
  status: 'success' | 'error' | 'timeout' | 'max_turns' | 'max_forks'
  /** 最终回复 */
  finalMessage: string
  /** 总轮次 */
  turns: number
  /** 执行时间（毫秒） */
  durationMs: number
  /** Token使用 */
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
  /** 结构化摘要 */
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

// ── 搜索选项 ──

export interface SearchOptions {
  /** 返回结果数量限制 */
  limit?: number
  /** 最小质量分数 */
  minQuality?: number
  /** 记忆类型过滤 */
  types?: Memory['type'][]
  /** 标签过滤 */
  tags?: string[]
  /** 文件过滤 */
  files?: string[]
  /** 排序方式 */
  sortBy?: 'relevance' | 'quality' | 'recency'
}

// ── 回调接口 ──

export interface MemoryCallback {
  /** 记忆提取完成 */
  onMemoriesExtracted?(memories: Memory[]): void

  /** 记忆整合完成 */
  onMemoriesIntegrated?(memories: Memory[]): void

  /** Skills触发 */
  onSkillTriggered?(skillName: string, result: any): void

  /** Fork代理创建 */
  onForkCreated?(forkResult: ForkResult): void

  /** 处理完成 */
  onProcessingComplete?(result: MemoryProcessingResult): void

  /** 错误发生 */
  onError?(error: Error, context: string): void
}

// ── 触发选项 ──

export interface TriggerOptions {
  /** 强制处理（忽略阈值） */
  force?: boolean
  /** 处理模式 */
  mode?: 'extraction' | 'integration' | 'all'
  /** 自定义配置 */
  config?: Partial<MemoryChainConfig>
  /** 回调函数 */
  callback?: MemoryCallback
}

// ── 核心接口 ──

export interface MemoryChain {
  /** 初始化记忆链 */
  initialize(config: MemoryChainConfig): Promise<void>

  /** 处理对话消息 */
  processMessages(messages: Message[], sessionId: string, options?: TriggerOptions): Promise<MemoryProcessingResult>

  /** 搜索记忆 */
  search(query: string, options?: SearchOptions): Promise<Memory[]>

  /** 获取记忆统计 */
  getStats(): MemoryStats

  /** 获取组件状态 */
  getComponentStatus(): Record<string, ComponentStatus>

  /** 更新配置 */
  updateConfig(config: Partial<MemoryChainConfig>): void

  /** 设置回调函数 */
  setCallback(callback: MemoryCallback): void

  /** 清理资源 */
  cleanup(): Promise<void>
}

// ── 工具接口 ──

export interface MemoryAwareTool extends ToolDefinition {
  /** 工具是否感知记忆 */
  memoryAware: boolean
  /** 记忆处理函数 */
  processMemory?(memory: Memory, context: any): Promise<any>
}

// ── 默认配置 ──

export const DEFAULT_MEMORY_CHAIN_CONFIG: MemoryChainConfig = {
  enabled: true,
  extraction: {
    enabled: true,
    qualityThreshold: 0.6,
    minConversationLength: 4,
    model: 'deepseek-chat',
    sessionMemory: {
      enabled: true,
      minTokens: 1000,
      toolCallsBetweenUpdates: 3,
    },
  },
  autoDream: {
    enabled: true,
    intervalMs: 30000,
    batchSize: 10,
    qualityThreshold: 0.7,
  },
  agentMemory: {
    enabled: true,
    defaultScope: 'project',
    scopes: {
      user: true,
      project: true,
      local: true,
    },
  },
  skills: {
    enabled: true,
    autoRegister: true,
    excludeSkills: [],
    memoryAwareSkills: ['debug', 'simplify', 'commit', 'review-pr'],
  },
  forkAgent: {
    enabled: true,
    maxConcurrentForks: 1,
    defaultMaxTurns: 20,
    defaultTimeout: 5 * 60 * 1000, // 5分钟
    memoryAwareForks: true,
  },
  performance: {
    batchProcessing: true,
    maxBatchSize: 50,
    processingTimeout: 30000,
    cacheEnabled: true,
  },
}

// ── 工具函数 ──

/** 格式化记忆供输出 */
export function formatMemoriesForOutput(memories: Memory[]): string {
  if (memories.length === 0) {
    return 'No memories found.'
  }

  return memories.map((memory, index) => {
    return `## ${index + 1}. ${memory.title} (${memory.type}, quality: ${memory.quality.toFixed(2)})

**Content**: ${memory.content.slice(0, 200)}${memory.content.length > 200 ? '...' : ''}

**Files**: ${memory.files.length > 0 ? memory.files.join(', ') : 'None'}
**Tags**: ${memory.tags.length > 0 ? memory.tags.join(', ') : 'None'}
**Session**: ${memory.sessionId}
**Timestamp**: ${new Date(memory.timestamp).toLocaleString()}
`
  }).join('\n---\n')
}

/** 验证记忆配置 */
export function validateMemoryConfig(config: MemoryChainConfig): string[] {
  const errors: string[] = []

  if (config.extraction.qualityThreshold < 0 || config.extraction.qualityThreshold > 1) {
    errors.push('extraction.qualityThreshold must be between 0 and 1')
  }

  if (config.autoDream.qualityThreshold < 0 || config.autoDream.qualityThreshold > 1) {
    errors.push('autoDream.qualityThreshold must be between 0 and 1')
  }

  if (config.performance.maxBatchSize <= 0) {
    errors.push('performance.maxBatchSize must be positive')
  }

  if (config.performance.processingTimeout <= 0) {
    errors.push('performance.processingTimeout must be positive')
  }

  return errors
}

/** 创建记忆ID */
export function createMemoryId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 检查记忆是否有效 */
export function isValidMemory(memory: Partial<Memory>): memory is Memory {
  return (
    typeof memory.id === 'string' &&
    typeof memory.type === 'string' &&
    typeof memory.title === 'string' &&
    typeof memory.content === 'string' &&
    typeof memory.quality === 'number' &&
    memory.quality >= 0 && memory.quality <= 1 &&
    typeof memory.timestamp === 'string' &&
    typeof memory.sessionId === 'string'
  )
}