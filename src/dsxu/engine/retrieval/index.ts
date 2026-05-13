/**
 * Graph Retrieval 模块导出
 *
 * 提供图检索和上下文路由功能
 * 吸收上游 repo-level context 组织方式
 */

// 类型导出
export type {
  RetrievalQuery,
  RetrievalQueryType,
  RetrievalFilter,
  RetrievedNode,
  RetrievedEdge,
  RetrievedSubgraph,
  RetrievalMetrics,
  RetrievalConfig,
  RetrievalAlgorithm,
  RetrievalStrategy,
  ContextRoutingTarget,
  ContextRoutingBundle
} from './types'

// Graph Retrieval 实现
import { GraphRetrievalImpl as GraphRetrievalImplClass } from './graph-retrieval'
export { GraphRetrievalImplClass as GraphRetrievalImpl }
export type { RetrievalResult, RetrievalMode, RankingReason } from './graph-retrieval'

// Context Routing 实现
import { ContextRoutingImpl as ContextRoutingImplClass, createContextRouting as createContextRoutingFn, routeContextQuick as routeContextQuickFn } from './context-routing'
export { ContextRoutingImplClass as ContextRoutingImpl, createContextRoutingFn as createContextRouting, routeContextQuickFn as routeContextQuick }
export type { RoutingDecision, RoutingConfig, RoutingContext } from './context-routing'

/**
 * 创建完整的 Graph Retrieval 系统
 */
export function createGraphRetrievalSystem(graphMemory: any) {
  const graphRetrieval = new GraphRetrievalImplClass(graphMemory)
  const contextRouting = createContextRoutingFn(graphRetrieval)

  return {
    graphRetrieval,
    contextRouting,

    // 快捷方法
    retrieve: (query: RetrievalQuery) => graphRetrieval.retrieve(query),
    routeContext: (query: RetrievalQuery, context?: RoutingContext) =>
      contextRouting.routeContext(query, context),

    // 系统信息
    getVersion: () => '1.0.0 (F-2 Graph Retrieval & Context Routing)',
    getStats: () => ({
      retrieval: graphRetrieval.getMetrics(),
      routing: contextRouting.getRoutingStats()
    })
  }
}

/**
 * 检查 Graph Retrieval 是否可用
 */
export function isGraphRetrievalAvailable(): boolean {
  try {
    return typeof GraphRetrievalImplClass === 'function' &&
           typeof ContextRoutingImplClass === 'function'
  } catch {
    return false
  }
}

/**
 * 获取 Graph Retrieval 版本信息
 */
export function getGraphRetrievalVersion(): string {
  return '1.0.0 (F-2 Graph Retrieval & Context Routing)'
}
