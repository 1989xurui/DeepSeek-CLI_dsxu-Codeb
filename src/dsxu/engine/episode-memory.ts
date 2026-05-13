/**
 * DSXU Episode Memory - 核心结构定义
 *
 * Work Package 9A-D: Episode Memory 核心结构
 * 记录任务执行过程的状态、事件和结果
 */

import type { VerifySummary, ReviewSummary, QueryResult } from './types'

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
  defaultChainResult?: QueryResult
  /** 13. 备注信息 */
  notes?: string[]
  /** 14. 元数据 */
  metadata: EpisodeMetadata
}

/** 创建 Episode 的选项 */
export interface CreateEpisodeOptions {
  /** 任务ID */
  taskId: string
  /** 会话ID */
  sessionId: string
  /** 初始状态 */
  initialState?: RuntimeStateEvent[]
  /** 初始工具事件 */
  initialToolEvents?: ToolEvent[]
  /** 备注信息 */
  notes?: string[]
  /** 元数据 */
  metadata?: Partial<EpisodeMetadata>
}

/** 创建新的 Episode */
export function createEpisode(options: CreateEpisodeOptions): Episode {
  const now = Date.now()

  const metadata: EpisodeMetadata = {
    createdAt: now,
    updatedAt: now,
    version: '1.0.0',
    tags: [],
    ...options.metadata
  }

  return {
    episodeId: generateEpisodeId(),
    taskId: options.taskId,
    sessionId: options.sessionId,
    states: options.initialState || [],
    toolEvents: options.initialToolEvents || [],
    finalOutcome: 'success', // 默认成功，执行过程中会更新
    startedAt: now,
    completedAt: now, // 初始与开始时间相同，完成后更新
    notes: options.notes || [],
    metadata
  }
}

/** 生成 Episode ID */
function generateEpisodeId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10)
  return `episode-${timestamp}-${random}`
}

/** 更新 Episode 状态 */
export function updateEpisodeState(
  episode: Episode,
  state: RuntimeStateEvent
): Episode {
  return {
    ...episode,
    states: [...episode.states, state],
    metadata: {
      ...episode.metadata,
      updatedAt: Date.now()
    }
  }
}

/** 添加工具事件到 Episode */
export function addToolEvent(
  episode: Episode,
  event: ToolEvent
): Episode {
  return {
    ...episode,
    toolEvents: [...episode.toolEvents, event],
    metadata: {
      ...episode.metadata,
      updatedAt: Date.now()
    }
  }
}

/** 更新 Episode 最终结果 */
export function updateEpisodeOutcome(
  episode: Episode,
  outcome: EpisodeOutcome
): Episode {
  const now = Date.now()

  return {
    ...episode,
    finalOutcome: outcome,
    completedAt: now,
    metadata: {
      ...episode.metadata,
      updatedAt: now
    }
  }
}

/** 添加备注到 Episode */
export function addNoteToEpisode(
  episode: Episode,
  note: string
): Episode {
  return {
    ...episode,
    notes: [...(episode.notes || []), note],
    metadata: {
      ...episode.metadata,
      updatedAt: Date.now()
    }
  }
}

/** 检查 Episode 是否完成 */
export function isEpisodeCompleted(episode: Episode): boolean {
  return episode.completedAt > episode.startedAt
}

/** 获取 Episode 持续时间（毫秒） */
export function getEpisodeDuration(episode: Episode): number {
  if (!isEpisodeCompleted(episode)) {
    return Date.now() - episode.startedAt
  }
  return episode.completedAt - episode.startedAt
}
