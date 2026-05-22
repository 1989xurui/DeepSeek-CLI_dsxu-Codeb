/**
 * Context Routing - 涓婁笅鏂囪矾鐢卞疄鐜?(F-2)
 *
 * 灏嗘绱㈠埌鐨勫瓙鍥捐矾鐢卞埌涓嶅悓鐨勫鐞嗙粍浠? * 鍚告敹涓婃父 task/session/memory 璺敱鏈哄埗
 */

import type {
  RetrievedSubgraph,
  ContextRoutingBundle,
  ContextRoutingTarget,
  RetrievalQuery
} from './types'

import type { GraphRetrievalImpl } from './graph-retrieval'

/**
 * 璺敱鍐崇瓥鍥犵礌
 */
export interface RoutingDecision {
  target: ContextRoutingTarget
  priority: number
  reason: string
  instructions?: string
}

/**
 * 璺敱閰嶇疆
 */
export interface RoutingConfig {
  /** 榛樿璺敱鐩爣 */
  defaultTarget: ContextRoutingTarget
  /** 鏈€灏忕浉鍏虫€ч槇鍊?*/
  minRelevanceThreshold: number
  /** 鏈€澶ц妭鐐规暟闃堝€?*/
  maxNodeThreshold: number
  /** 鏄惁鍚敤鏅鸿兘璺敱 */
  enableSmartRouting: boolean
  /** 璺敱缂撳瓨鏃堕棿锛堟绉掞級 */
  routingCacheTTL: number
}

/**
 * 璺敱涓婁笅鏂? */
export interface RoutingContext {
  sessionId?: string
  taskId?: string
  currentFile?: string
  focusArea?: string
  userIntent?: string
  previousRoutes?: ContextRoutingBundle[]
}

/**
 * Context Routing 瀹炵幇绫? */
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
      routingCacheTTL: 300000, // 5鍒嗛挓
      ...config
    }
    this.routingCache = new Map()
    this.routingHistory = []
  }

  /**
   * 鎵ц涓婁笅鏂囪矾鐢?   */
  async routeContext(
    query: RetrievalQuery,
    context?: RoutingContext
  ): Promise<ContextRoutingBundle> {
    const cacheKey = this.generateCacheKey(query, context)

    const cached = this.routingCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.config.routingCacheTTL) {
      console.log(`[ContextRouting] 使用缓存路由: ${cached.bundle.id}`)
      this.routingHistory.push(cached.bundle)
      return cached.bundle
    }

    console.log(`[ContextRouting] 执行路由: ${query.queryType}, 目标数: ${query.targetIds.length}`)

    let subgraph: RetrievedSubgraph
    try {
      subgraph = await (this.graphRetrieval as any).retrieve(query, { countCacheHit: false })
    } catch (error) {
      const bundle = this.createErrorBundle(query, error as Error, context)
      this.routingHistory.push(bundle)
      return bundle
    }

    const decision = await this.analyzeAndDecide(subgraph, query, context)
    const bundle = this.createRoutingBundle(subgraph, decision, query, context)

    this.routingCache.set(cacheKey, {
      bundle,
      timestamp: Date.now()
    })
    this.routingHistory.push(bundle)

    console.log(`[ContextRouting] 路由完成: ${bundle.id} -> ${bundle.target} (优先级: ${bundle.priority})`)

    return bundle
  }
  /**
   * 鍒嗘瀽妫€绱㈢粨鏋滃苟鍋氬嚭璺敱鍐崇瓥
   */
  private async analyzeAndDecide(
    subgraph: RetrievedSubgraph,
    query: RetrievalQuery,
    context?: RoutingContext
  ): Promise<RoutingDecision> {
    // 鍩虹鍒嗘瀽
    const stats = subgraph.statistics
    const avgRelevance = stats.avgRelevance
    const totalNodes = stats.totalNodes

    // 鏅鸿兘璺敱鍐崇瓥
    if (this.config.enableSmartRouting) {
      const smartDecision = await this.smartRoutingDecision(subgraph, query, context)
      if (smartDecision) {
        return smartDecision
      }
    }

    // 榛樿璺敱瑙勫垯
    return this.defaultRoutingDecision(subgraph, query, context)
  }

  /**
   * 鏅鸿兘璺敱鍐崇瓥
   */
  private async smartRoutingDecision(
    subgraph: RetrievedSubgraph,
    query: RetrievalQuery,
    context?: RoutingContext
  ): Promise<RoutingDecision | null> {
    const stats = subgraph.statistics
    const avgRelevance = stats.avgRelevance
    const totalNodes = stats.totalNodes

    if (query.queryType === 'task' || query.queryType === 'dependency' || query.queryType === 'hotspot' || query.queryType === 'context') {
      return {
        target: 'context-builder',
        priority: 7,
        reason: `${query.queryType} query needs structured context before execution`,
        instructions: 'Build source/context evidence before continuing.'
      }
    }

    const hasVerificationNodes = subgraph.nodes.some(node => this.isVerificationNode(node.node))
    if (hasVerificationNodes) {
      return {
        target: 'verify-gate',
        priority: 8,
        reason: 'test or verification evidence detected',
        instructions: 'Route to verification gate and preserve source/test evidence.'
      }
    }

    const hasComplexStructure = subgraph.nodes.some(node =>
      node.node.type === 'class' ||
      node.node.type === 'interface' ||
      node.node.type === 'module'
    )
    if (hasComplexStructure && totalNodes >= 3) {
      return {
        target: 'context-builder',
        priority: 7,
        reason: 'structured code graph needs context building',
        instructions: 'Build complete code structure and dependency context.'
      }
    }

    const hasErrorNodes = subgraph.nodes.some(node =>
      node.node.type === 'error' ||
      node.node.type === 'bug' ||
      node.node.properties?.hasError === true
    )
    if (hasErrorNodes) {
      return {
        target: 'reviewer',
        priority: 8,
        reason: 'error or bug node detected',
        instructions: 'Review the failure evidence and choose a repair path.'
      }
    }

    if (avgRelevance >= 85 && totalNodes <= 10) {
      return {
        target: 'query-loop',
        priority: 9,
        reason: 'high relevance small graph can be handled directly',
        instructions: 'Process compact high-relevance context in the query loop.'
      }
    }

    if (query.queryType === 'slice') {
      return {
        target: 'query-loop',
        priority: 6,
        reason: 'slice query is suitable for quick analysis',
        instructions: 'Analyze the code slice context.'
      }
    }

    return null
  }

  private isVerificationNode(node: RetrievedSubgraph['nodes'][number]['node']): boolean {
    if (node.type === 'test' || node.type === 'verification') return true
    if (node.properties?.isTest === true || node.properties?.componentType === 'test') return true

    const path = typeof node.properties?.path === 'string' ? node.properties.path : ''
    const id = node.id ?? ''
    const explicitTestPath = /(^|[\\/])(__tests__|tests|specs)([\\/]|$)|\.(test|spec)\.[jt]sx?$/i

    return (
      explicitTestPath.test(path) ||
      explicitTestPath.test(id) ||
      /(?:^|[A-Z])(?:Test|Spec)(?:[A-Z]|$)|(?:Test|Spec)(?:File|Component|Case|Suite)/.test(id)
    )
  }
  /**
   * 榛樿璺敱鍐崇瓥
   */
  private defaultRoutingDecision(
    subgraph: RetrievedSubgraph,
    query: RetrievalQuery,
    context?: RoutingContext
  ): RoutingDecision {
    const stats = subgraph.statistics
    const avgRelevance = stats.avgRelevance
    const totalNodes = stats.totalNodes

    if (avgRelevance >= this.config.minRelevanceThreshold) {
      if (totalNodes > this.config.maxNodeThreshold) {
        return {
          target: 'context-builder',
          priority: 6,
          reason: 'high relevance large graph needs context building',
          instructions: 'Build large high-relevance context.'
        }
      }
      return {
        target: 'query-loop',
        priority: 7,
        reason: 'high relevance medium graph can enter query loop',
        instructions: 'Process high-relevance context.'
      }
    }

    return {
      target: this.config.defaultTarget,
      priority: 5,
      reason: 'default routing rule',
      instructions: 'Use default route.'
    }
  }
  /**
   * 鍒涘缓璺敱鍖?   */
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
   * 鎵归噺璺敱
   */
  async batchRouteContext(
    queries: RetrievalQuery[],
    context?: RoutingContext
  ): Promise<ContextRoutingBundle[]> {
    console.log(`[ContextRouting] batch route: ${queries.length} queries`)

    const bundles: ContextRoutingBundle[] = []

    for (const query of queries) {
      try {
        const bundle = await this.routeContext(query, context)
        bundles.push(bundle)
      } catch (error) {
        console.error(`[ContextRouting] route failed: ${query.queryType}`, error)
        bundles.push(this.createErrorBundle(query, error as Error, context))
      }
    }

    return bundles
  }

  /**
   * 鍒涘缓閿欒璺敱鍖?   */
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
        summary: `璺敱閿欒: ${error.message}`,
        createdAt: Date.now()
      },
      priority: 1,
      instructions: `澶勭悊璺敱閿欒: ${error.message}`,
      metadata: {
        sessionId: context?.sessionId,
        taskId: context?.taskId,
        triggeredBy: 'error',
        routingTime: Date.now()
      }
    }
  }

  /**
   * 鑾峰彇璺敱鍘嗗彶
   */
  getRoutingHistory(limit?: number): ContextRoutingBundle[] {
    const history = [...this.routingHistory].reverse() // 鏈€鏂扮殑鍦ㄥ墠
    return limit ? history.slice(0, limit) : history
  }

  /**
   * 娓呯┖璺敱缂撳瓨
   */
  clearRoutingCache(): void {
    this.routingCache.clear()
  }

  /**
   * 鑾峰彇璺敱缁熻
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
   * 鐢熸垚缂撳瓨閿?   */
  private generateCacheKey(query: RetrievalQuery, context?: RoutingContext): string {
    const contextStr = context
      ? `${context.sessionId || ''}:${context.taskId || ''}:${context.currentFile || ''}`
      : ''
    return `${query.queryType}:${query.targetIds.join(',')}:${contextStr}:${JSON.stringify(query.filters)}`
  }
}

/**
 * 宸ュ巶鍑芥暟锛氬垱寤?Context Routing 瀹炰緥
 */
export function createContextRouting(
  graphRetrieval: GraphRetrievalImpl,
  config?: Partial<RoutingConfig>
): ContextRoutingImpl {
  return new ContextRoutingImpl(graphRetrieval, config)
}

/**
 * 蹇€熻矾鐢卞嚱鏁帮紙绠€鍖栫増锛? */
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
