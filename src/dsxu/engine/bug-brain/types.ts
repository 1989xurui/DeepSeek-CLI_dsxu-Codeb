/**
 * Bug Brain 类型定义
 * 吸收 DSXU 的失败摘要结构化机制
 */

/**
 * Bug 严重程度
 */
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/**
 * Bug 来源模块
 */
export type BugSource =
  | 'verify-gate'
  | 'verify-review-chain'
  | 'reviewer-subagent'
  | 'memory'
  | 'episode-memory'
  | 'graph-retrieval'
  | 'context-routing'
  | 'tool-execution'
  | 'session-state'
  | 'task-execution'
  | 'unknown'

/**
 * Bug 类别
 */
export type BugCategory =
  | 'verify-failure'
  | 'reviewer-rejection'
  | 'tool-failure'
  | 'context-insufficiency'
  | 'recovery-failure'
  | 'graph-retrieval-miss'
  | 'memory-insufficiency'
  | 'execution-timeout'
  | 'resource-exhaustion'
  | 'configuration-error'
  | 'integration-failure'
  | 'other'

/**
 * Bug 记录
 * 吸收 DSXU 的失败摘要结构：问题描述 + 上下文 + 时间戳 + 来源
 */
export interface BugRecord {
  id: string
  type: BugCategory
  severity: BugSeverity
  source: BugSource
  description: string
  context: BugContext
  timestamp: number
  sessionId?: string
  taskId?: string
  relatedNodeIds?: string[]
  metadata?: Record<string, any>
}

/**
 * Bug 上下文
 * 吸收 DSXU 的上下文组织方式：相关代码 + 环境 + 状态 + session/memory
 */
export interface BugContext {
  // 代码相关上下文（吸收 DSXU 的代码分析上下文）
  codeSnippet?: string
  filePath?: string
  lineNumber?: number
  functionName?: string
  moduleName?: string

  // 执行环境上下文（吸收 DSXU 的环境状态记录）
  environment?: Record<string, any>
  state?: Record<string, any>

  // 错误信息（吸收 DSXU 的错误堆栈结构化）
  errorStack?: string
  errorType?: string
  errorMessage?: string

  // 用户交互上下文（吸收 DSXU 的用户输入记录）
  userInput?: string
  userIntent?: string
  taskDescription?: string

  // 工具执行上下文（吸收 DSXU 的工具调用记录）
  toolOutput?: string
  toolName?: string
  toolParameters?: any

  // 检索上下文（吸收 DSXU 的图检索机制）
  retrievalContext?: {
    query?: string
    retrievedNodes?: number
    relevanceScores?: number[]
    retrievalTime?: number
    retrievalSource?: string
  }

  // Session/Memory 上下文（吸收 DSXU 的 session 和 memory extractor）
  sessionContext?: {
    sessionId?: string
    taskId?: string
    conversationId?: string
    turnCount?: number
    memorySummary?: string
    episodeId?: string
  }

  // Compact/Context Hygiene 上下文（吸收 DSXU 的 compact 机制）
  compactContext?: {
    compactLevel?: 'none' | 'light' | 'aggressive'
    originalContextSize?: number
    compactedContextSize?: number
    removedElements?: string[]
    hygieneScore?: number
  }

  // 时间戳和元数据
  timestamp?: number
  metadata?: Record<string, any>
}

/**
 * Bug 模式
 * 从多个相似 Bug 记录中提取的模式
 */
export interface BugPattern {
  patternId: string
  bugType: BugCategory
  commonSymptoms: string[]
  frequency: number
  lastSeen: number
  exampleBugIds: string[]
  severityDistribution: Record<BugSeverity, number>
  sourceDistribution: Record<BugSource, number>
  metadata?: Record<string, any>
}

/**
 * 修复模式
 * 吸收 DSXU 的修复经验沉淀机制
 */
export interface FixPattern {
  fixId: string
  bugPatternId: string
  steps: FixStep[]
  successRate: number
  prerequisites: string[]
  lastApplied: number
  applicationCount: number
  metadata?: Record<string, any>
}

/**
 * 修复步骤
 */
export interface FixStep {
  action: string
  description: string
  parameters?: Record<string, any>
  expectedOutcome?: string
}

/**
 * Bug 分析结果
 */
export interface BugAnalysis {
  bugRecord: BugRecord
  suggestedCategory?: BugCategory
  suggestedSeverity?: BugSeverity
  similarBugs?: BugRecord[]
  potentialPatterns?: BugPattern[]
  recommendedFixPatterns?: FixPattern[]
  confidence: number
}

/**
 * Bug 统计
 */
export interface BugStatistics {
  totalBugs: number
  byCategory: Record<BugCategory, number>
  bySeverity: Record<BugSeverity, number>
  bySource: Record<BugSource, number>
  avgResolutionTime?: number
  resolutionRate?: number
  recentTrend?: 'increasing' | 'decreasing' | 'stable'
}