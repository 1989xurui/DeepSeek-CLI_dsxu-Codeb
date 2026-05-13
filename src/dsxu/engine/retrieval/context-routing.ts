/**
 * Context Routing - 上下文路由实现 (F-2)
 *
 * 将检索到的子图路由到不同的处理组件
 * 吸收上游 task/session/memory 路由机制
 */

import type {
  RetrievedSubgraph,
  ContextRoutingBundle,
  ContextRoutingTarget,
  RetrievalQuery
} from './types'

import type { GraphRetrievalImpl } from './graph-retrieval'

/**
 * 路由决策因素
 */
export interface RoutingDecision {
  target: ContextRoutingTarget
  priority: number
  reason: string
  instructions?: string
}

/**
 * 路由配置
 */
export interface RoutingConfig {
  /** 默认路由目标 */
  defaultTarget: ContextRoutingTarget
  /** 最小相关性阈值 */
  minRelevanceThreshold: number
  /** 最大节点数阈值 */
  maxNodeThreshold: number
  /** 是否启用智能路由 */
  enableSmartRouting: boolean
  /** 路由缓存时间（毫秒） */
  routingCacheTTL: number
}

/**
 * 路由上下文
 */
export interface RoutingContext {
  sessionId?: string
  taskId?: string
  currentFile?: string
  focusArea?: string
  userIntent?: string
  previousRoutes?: ContextRoutingBundle[]
}

/**
 * Context Routing 实现类
 */
export class ContextRoutingImpl {
  private graphRetrieval: GraphRetrievalImpl
  private config: RoutingConfig
  private routingCache: Map<string, { bundle: ContextRoutingBundle; timestamp: number }>
  private routingHistory: ContextRoutingBundle[]

  constructor(graphRetrieval: GraphRetrievalImpl, config?: Partial<RoutingConfig>) {
    this.graphRetrieval = graphRetrieval
    this.config = {
      defaultTarget: 'query-loop',
      minRelevanceThreshold: 60,
      maxNodeThreshold: 50,
      enableSmartRouting: true,
      routingCacheTTL: 300000, // 5分钟
      ...config
    }
    this.routingCache = new Map()
    this.routingHistory = []
  }

  /**
   * 执行上下文路由
   */
  async routeContext(
    query: RetrievalQuery,
    context?: RoutingContext
  ): Promise<ContextRoutingBundle> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(query, context)

    // 检查缓存
    if (this.routingCache.has(cacheKey)) {
      const cached = this.routingCache.get(cacheKey)!
      if (Date.now() - cached.timestamp < this.config.routingCacheTTL) {
        console.log(`[ContextRouting] 使用缓存路由: ${cached.bundle.id}`)
        return cached.bundle
      }
    }

    console.log(`[ContextRouting] 执行路由: ${query.queryType}, 目标数: ${query.targetIds.length}`)

    // 1. 执行检索
    const subgraph = await this.graphRetrieval.retrieve(query)

    // 2. 分析检索结果，做出路由决策
    const decision = await this.analyzeAndDecide(subgraph, query, context)

    // 3. 创建路由包
    const bundle = this.createRoutingBundle(subgraph, decision, query, context)

    // 4. 更新缓存和历史
    this.routingCache.set(cacheKey, {
      bundle,
      timestamp: Date.now()
    })
    this.routingHistory.push(bundle)

    // 5. 记录路由日志
    console.log(`[ContextRouting] 路由完成: ${bundle.id} -> ${bundle.target} (优先级: ${bundle.priority})`)

    return bundle
  }

  /**
   * 分析检索结果并做出路由决策
   */
  private async analyzeAndDecide(
    subgraph: RetrievedSubgraph,
    query: RetrievalQuery,
    context?: RoutingContext
  ): Promise<RoutingDecision> {
    // 基础分析
    const stats = subgraph.statistics
    const avgRelevance = stats.avgRelevance
    const totalNodes = stats.totalNodes

    // 智能路由决策
    if (this.config.enableSmartRouting) {
      const smartDecision = await this.smartRoutingDecision(subgraph, query, context)
      if (smartDecision) {
        return smartDecision
      }
    }

    // 默认路由规则
    return this.defaultRoutingDecision(subgraph, query, context)
  }

  /**
   * 智能路由决策
   */
  private async smartRoutingDecision(
    subgraph: RetrievedSubgraph,
    query: RetrievalQuery,
    context?: RoutingContext
  ): Promise<RoutingDecision | null> {
    const stats = subgraph.statistics
    const avgRelevance = stats.avgRelevance
    const totalNodes = stats.totalNodes

    // 1. 高相关性 + 小规模 -> Query Loop（快速处理）
    if (avgRelevance >= 85 && totalNodes <= 10) {
      return {
        target: 'query-loop',
        priority: 9,
        reason: '高相关性小规模检索，适合快速处理',
        instructions: '快速处理高相关性小规模上下文'
      }
    }

    // 2. 包含验证相关节点 -> Verify Gate
    const hasVerificationNodes = subgraph.nodes.some(node =>
      node.node.type === 'test' ||
      node.node.type === 'verification' ||
      node.node.properties?.isTest === true ||
      node.node.id.includes('test') ||
      node.node.id.includes('Test')
    )
    if (hasVerificationNodes) {
      return {
        target: 'verify-gate',
        priority: 8,
        reason: '包含测试或验证相关节点',
        instructions: '进行验证和测试相关的处理'
      }
    }

    // 3. 包含复杂结构 -> Context Builder
    const hasComplexStructure = subgraph.nodes.some(node =>
      node.node.type === 'class' ||
      node.node.type === 'interface' ||
      node.node.type === 'module'
    )
    if (hasComplexStructure && totalNodes >= 5) {
      return {
        target: 'context-builder',
        priority: 7,
        reason: '包含复杂代码结构，需要构建完整上下文',
        instructions: '构建完整的代码结构和依赖上下文'
      }
    }

    // 4. 包含错误或问题 -> Reviewer
    const hasErrorNodes = subgraph.nodes.some(node =>
      node.node.type === 'error' ||
      node.node.type === 'bug' ||
      node.node.properties?.hasError === true
    )
    if (hasErrorNodes) {
      return {
        target: 'reviewer',
        priority: 8,
        reason: '包含错误或问题节点，需要审查',
        instructions: '审查代码问题和潜在风险'
      }
    }

    // 5. 根据查询类型路由
    switch (query.queryType) {
      case 'task':
        return {
          target: 'context-builder',
          priority: 7,
          reason: '任务相关查询，需要构建任务上下文',
          instructions: '构建任务执行上下文'
        }
      case 'slice':
        return {
          target: 'query-loop',
          priority: 6,
          reason: '代码切片查询，适合快速分析',
          instructions: '分析代码切片上下文'
        }
      case 'dependency':
        return {
          target: 'context-builder',
          priority: 7,
          reason: '依赖关系查询，需要构建依赖上下文',
          instructions: '构建依赖关系上下文'
        }
    }

    return null
  }

  /**
   * 默认路由决策
   */
  private defaultRoutingDecision(
    subgraph: RetrievedSubgraph,
    query: RetrievalQuery,
    context?: RoutingContext
  ): RoutingDecision {
    const stats = subgraph.statistics
    const avgRelevance = stats.avgRelevance
    const totalNodes = stats.totalNodes

    // 根据相关性阈值决定
    if (avgRelevance >= this.config.minRelevanceThreshold) {
      if (totalNodes > this.config.maxNodeThreshold) {
        return {
          target: 'context-builder',
          priority: 6,
          reason: '高相关性大规模检索，需要构建完整上下文',
          instructions: '构建大规模高相关性上下文'
        }
      } else {
        return {
          target: 'query-loop',
          priority: 7,
          reason: '高相关性适中规模，适合查询循环处理',
          instructions: '处理高相关性上下文'
        }
      }
    } else {
      return {
        target: this.config.defaultTarget,
        priority: 5,
        reason: '默认路由规则',
        instructions: '使用默认路由处理'
      }
    }
  }

  /**
   * 创建路由包
   */
  private createRoutingBundle(
    subgraph: RetrievedSubgraph,
    decision: RoutingDecision,
    query: RetrievalQuery,
    context?: RoutingContext
  ): ContextRoutingBundle {
    const bundleId = `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      id: bundleId,
      target: decision.target,
      subgraph,
      priority: decision.priority,
      instructions: decision.instructions,
      metadata: {
        sessionId: context?.sessionId,
        taskId: context?.taskId,
        triggeredBy: query.queryType,
        routingTime: Date.now()
      }
    }
  }

  /**
   * 批量路由
   */
  async batchRouteContext(
    queries: RetrievalQuery[],
    context?: RoutingContext
  ): Promise<ContextRoutingBundle[]> {
    console.log(`[ContextRouting] 批量路由: ${queries.length} 个查询`)

    const bundles: ContextRoutingBundle[] = []

    for (const query of queries) {
      try {
        const bundle = await this.routeContext(query, context)
        bundles.push(bundle)
      } catch (error) {
        console.error(`[ContextRouting] 路由失败: ${query.queryType}`, error)
        // 创建错误路由包
        bundles.push(this.createErrorBundle(query, error as Error, context))
      }
    }

    return bundles
  }

  /**
   * 创建错误路由包
   */
  private createErrorBundle(
    query: RetrievalQuery,
    error: Error,
    context?: RoutingContext
  ): ContextRoutingBundle {
    return {
      id: `error_route_${Date.now()}`,
      target: 'recovery',
      subgraph: {
        id: `error_subgraph_${Date.now()}`,
        query,
        nodes: [],
        edges: [],
        statistics: {
          totalNodes: 0,
          totalEdges: 0,
          avgRelevance: 0,
          maxRelevance: 0,
          retrievalTimeMs: 0
        },
        summary: `路由错误: ${error.message}`,
        createdAt: Date.now()
      },
      priority: 1,
      instructions: `处理路由错误: ${error.message}`,
      metadata: {
        sessionId: context?.sessionId,
        taskId: context?.taskId,
        triggeredBy: 'error',
        routingTime: Date.now()
      }
    }
  }

  /**
   * 获取路由历史
   */
  getRoutingHistory(limit?: number): ContextRoutingBundle[] {
    const history = [...this.routingHistory].reverse() // 最新的在前
    return limit ? history.slice(0, limit) : history
  }

  /**
   * 清空路由缓存
   */
  clearRoutingCache(): void {
    this.routingCache.clear()
  }

  /**
   * 获取路由统计
   */
  getRoutingStats(): {
    totalRoutes: number
    byTarget: Record<ContextRoutingTarget, number>
    avgPriority: number
    cacheSize: number
  } {
    const byTarget: Record<ContextRoutingTarget, number> = {
      'query-loop': 0,
      'context-builder': 0,
      'verify-gate': 0,
      'reviewer': 0,
      'recovery': 0
    }

    let totalPriority = 0

    this.routingHistory.forEach(bundle => {
      byTarget[bundle.target] = (byTarget[bundle.target] || 0) + 1
      totalPriority += bundle.priority
    })

    return {
      totalRoutes: this.routingHistory.length,
      byTarget,
      avgPriority: this.routingHistory.length > 0
        ? totalPriority / this.routingHistory.length
        : 0,
      cacheSize: this.routingCache.size
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(query: RetrievalQuery, context?: RoutingContext): string {
    const contextStr = context
      ? `${context.sessionId || ''}:${context.taskId || ''}:${context.currentFile || ''}`
      : ''
    return `${query.queryType}:${query.targetIds.join(',')}:${contextStr}:${JSON.stringify(query.filters)}`
  }
}

/**
 * 工厂函数：创建 Context Routing 实例
 */
export function createContextRouting(
  graphRetrieval: GraphRetrievalImpl,
  config?: Partial<RoutingConfig>
): ContextRoutingImpl {
  return new ContextRoutingImpl(graphRetrieval, config)
}

/**
 * 快速路由函数（简化版）
 */
export async function routeContextQuick(
  graphRetrieval: GraphRetrievalImpl,
  query: RetrievalQuery,
  context?: RoutingContext
): Promise<ContextRoutingBundle> {
  const routing = new ContextRoutingImpl(graphRetrieval, {
    enableSmartRouting: true,
    minRelevanceThreshold: 70
  })

  return routing.routeContext(query, context)
}
