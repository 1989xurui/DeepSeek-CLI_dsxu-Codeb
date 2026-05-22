/**
 * Graph Memory 模块导出
 *
 * 提供图结构的代码理解和记忆管理
 */

// 类型导出
export type {
  GraphNodeType,
  GraphEdgeType,
  GraphNodeProperties,
  GraphNode,
  GraphEdgeProperties,
  GraphEdge,
  GraphMemoryMetadata,
  GraphMemory,
  GraphBuildConfig,
  GraphUpdateOptions
} from './types'

// 实现导出
export { GraphMemoryImpl } from './graph-memory'

/**
 * 创建 Graph Memory 实例的工厂函数
 */
export function createGraphMemory(sessionId: string, config?: GraphBuildConfig): GraphMemoryImpl {
  return new GraphMemoryImpl(sessionId, config)
}

/**
 * 检查 Graph Memory 是否可用
 */
export function isGraphMemoryAvailable(): boolean {
  try {
    // 检查 GraphMemoryImpl 类是否可用
    return typeof GraphMemoryImpl === 'function'
  } catch {
    return false
  }
}

/**
 * 获取 Graph Memory 版本信息
 */
export function getGraphMemoryVersion(): string {
  return '1.0.0 (Graph Memory)'
}
