/**
 * Graph Retrieval - 图检索类型定义
 *
 * 吸收上游 task/session/memory 与 repo-level context 衔接方式
 * 提供图结构的智能检索和上下文路由
 */

import type { GraphNode, GraphEdge, GraphNodeType, GraphEdgeType } from '../graph/types'

/**
 * 检索查询类型
 */
export type RetrievalQueryType =
  | 'file'          // 按文件检索
  | 'symbol'        // 按符号检索
  | 'task'          // 按任务检索
  | 'session'       // 按会话检索
  | 'slice'         // 按代码切片检索
  | 'dependency'    // 按依赖关系检索
  | 'hotspot'       // 按热点区域检索
  | 'context'       // 按上下文检索

/**
 * 检索过滤器
 */
export interface RetrievalFilter {
  /** 节点类型过滤 */
  nodeTypes?: GraphNodeType[]
  /** 边类型过滤 */
  edgeTypes?: GraphEdgeType[]
  /** 属性过滤 */
  properties?: Record<string, any>
  /** 最小重要性分数 */
  minImportance?: number
  /** 最大距离（跳数） */
  maxDistance?: number
  /** 最小权重阈值 */
  minWeight?: number
}

/**
 * 检索查询
 */
export interface RetrievalQuery {
  /** 查询类型 */
  queryType: RetrievalQueryType
  /** 目标ID列表（节点ID或文件路径等） */
  targetIds: string[]
  /** 检索过滤器 */
  filters?: RetrievalFilter
  /** 最大返回节点数 */
  limit?: number
  /** 查询上下文 */
  context?: {
    sessionId?: string
    taskId?: string
    currentFile?: string
    focusArea?: string
  }
}

/**
 * 检索结果节点
 */
export interface RetrievedNode {
  /** 节点 */
  node: GraphNode
  /** 相关性分数（0-100） */
  relevanceScore: number
  /** 距离（跳数） */
  distance: number
  /** 路径描述 */
  pathDescription?: string
  /** 匹配原因 */
  matchReasons: string[]
}

/**
 * 检索结果边
 */
export interface RetrievedEdge {
  /** 边 */
  edge: GraphEdge
  /** 相关性分数（0-100） */
  relevanceScore: number
}

/**
 * 检索到的子图
 */
export interface RetrievedSubgraph {
  /** 子图ID */
  id: string
  /** 查询信息 */
  query: RetrievalQuery
  /** 检索到的节点 */
  nodes: RetrievedNode[]
  /** 检索到的边 */
  edges: RetrievedEdge[]
  /** 检索统计 */
  statistics: {
    totalNodes: number
    totalEdges: number
    avgRelevance: number
    maxRelevance: number
    retrievalTimeMs: number
  }
  /** 子图摘要 */
  summary?: string
  /** 创建时间戳 */
  createdAt: number
}

/**
 * 检索算法类型
 */
export type RetrievalAlgorithm =
  | 'bfs'           // 广度优先搜索
  | 'dfs'           // 深度优先搜索
  | 'weighted'      // 加权检索
  | 'semantic'      // 语义检索
  | 'hybrid'        // 混合检索

/**
 * 检索配置
 */
export interface RetrievalConfig {
  /** 默认检索算法 */
  defaultAlgorithm: RetrievalAlgorithm
  /** 最大检索深度 */
  maxDepth: number
  /** 最大返回节点数 */
  maxNodes: number
  /** 相关性阈值 */
  relevanceThreshold: number
  /** 是否包含间接相关节点 */
  includeIndirect: boolean
  /** 是否缓存检索结果 */
  enableCaching: boolean
  /** 缓存过期时间（毫秒） */
  cacheTTL: number
}

/**
 * 上下文路由目标
 */
export type ContextRoutingTarget =
  | 'query-loop'      // Query Loop
  | 'context-builder' // Context Builder
  | 'verify-gate'     // Verify Gate
  | 'reviewer'        // Reviewer
  | 'recovery'        // Recovery Planner

/**
 * 上下文路由包
 */
export interface ContextRoutingBundle {
  /** 路由包ID */
  id: string
  /** 目标组件 */
  target: ContextRoutingTarget
  /** 检索到的子图 */
  subgraph: RetrievedSubgraph
  /** 路由优先级（1-10） */
  priority: number
  /** 路由指令 */
  instructions?: string
  /** 路由元数据 */
  metadata: {
    sessionId?: string
    taskId?: string
    triggeredBy?: string
    routingTime: number
  }
}

/**
 * 检索策略
 */
export interface RetrievalStrategy {
  /** 策略名称 */
  name: string
  /** 适用的查询类型 */
  queryTypes: RetrievalQueryType[]
  /** 使用的算法 */
  algorithm: RetrievalAlgorithm
  /** 策略配置 */
  config: {
    depth: number
    weightMultiplier: number
    includeTypes: GraphNodeType[]
    excludeTypes: GraphNodeType[]
  }
  /** 策略描述 */
  description: string
}

/**
 * 检索性能指标
 */
export interface RetrievalMetrics {
  /** 检索次数 */
  retrievalCount: number
  /** 平均检索时间（毫秒） */
  avgRetrievalTime: number
  /** 缓存命中率 */
  cacheHitRate: number
  /** 平均相关性分数 */
  avgRelevanceScore: number
  /** 按查询类型统计 */
  byQueryType: Record<RetrievalQueryType, number>
  /** 按算法统计 */
  byAlgorithm: Record<RetrievalAlgorithm, number>
}
