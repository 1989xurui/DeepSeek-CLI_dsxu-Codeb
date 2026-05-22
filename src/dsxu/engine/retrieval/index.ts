/**
 * Graph Retrieval 妯″潡瀵煎嚭
 *
 * 鎻愪緵鍥炬绱㈠拰涓婁笅鏂囪矾鐢卞姛鑳? * 鍚告敹涓婃父 repo-level context 缁勭粐鏂瑰紡
 */

// 绫诲瀷瀵煎嚭
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

// Graph Retrieval 瀹炵幇
import { GraphRetrievalImpl as GraphRetrievalImplClass } from './graph-retrieval'
export { GraphRetrievalImplClass as GraphRetrievalImpl }
export type { RetrievalResult, RetrievalMode, RankingReason } from './graph-retrieval'

// Context Routing 瀹炵幇
import { ContextRoutingImpl as ContextRoutingImplClass, createContextRouting as createContextRoutingFn, routeContextQuick as routeContextQuickFn } from './context-routing'
export { ContextRoutingImplClass as ContextRoutingImpl, createContextRoutingFn as createContextRouting, routeContextQuickFn as routeContextQuick }
export type { RoutingDecision, RoutingConfig, RoutingContext } from './context-routing'

/**
 * 鍒涘缓瀹屾暣鐨?Graph Retrieval 绯荤粺
 */
export function createGraphRetrievalSystem(graphMemory: any) {
  const graphRetrieval = new GraphRetrievalImplClass(graphMemory)
  const contextRouting = createContextRoutingFn(graphRetrieval)

  const system: any = {
    graphRetrieval,
    contextRouting,
    retrieve: (query: RetrievalQuery) => system.graphRetrieval.retrieve(query),
    routeContext: (query: RetrievalQuery, context?: RoutingContext) => {
      if (system.graphRetrieval !== graphRetrieval) {
        return createContextRoutingFn(system.graphRetrieval).routeContext(query, context)
      }
      return contextRouting.routeContext(query, context)
    },
    getVersion: () => '1.0.0 (F-2 Graph Retrieval & Context Routing)',
    getStats: () => ({
      retrieval: system.graphRetrieval.getMetrics ? system.graphRetrieval.getMetrics() : graphRetrieval.getMetrics(),
      routing: contextRouting.getRoutingStats()
    })
  }

  return system
}

/**
 * 妫€鏌?Graph Retrieval 鏄惁鍙敤
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
 * 鑾峰彇 Graph Retrieval 鐗堟湰淇℃伅
 */
export function getGraphRetrievalVersion(): string {
  return '1.0.0 (F-2 Graph Retrieval & Context Routing)'
}
