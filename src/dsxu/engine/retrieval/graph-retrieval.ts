/**
 * Graph Retrieval - 图检索实现 (F-2)
 *
 * 吸收上游 repo-level context 组织方式
 * 提供 byFile / bySymbol 等检索能力
 */

import type {
  GraphNode,
  GraphEdge,
  GraphNodeType
} from '../graph/types'

import type {
  RetrievalQuery,
  RetrievalQueryType,
  RetrievalFilter,
  RetrievedNode,
  RetrievedEdge,
  RetrievedSubgraph,
  RetrievalMetrics
} from './types'

import type { GraphMemoryImpl } from '../graph/graph-memory'

/**
 * 检索模式
 */
export type RetrievalMode = 'byFile' | 'bySymbol' | 'byTask' | 'bySlice'

/**
 * 排名原因
 */
export interface RankingReason {
  factor: string
  score: number
  description: string
}

/**
 * 检索结果
 */
export interface RetrievalResult {
  nodes: RetrievedNode[]
  edges: RetrievedEdge[]
  rankingReasons: RankingReason[]
  retrievalMode: RetrievalMode
  retrievalTimeMs: number
}

/**
 * Graph Retrieval 实现类
 */
export class GraphRetrievalImpl {
  private graphMemory: GraphMemoryImpl
  private metrics: RetrievalMetrics
  private cache: Map<string, { result: RetrievalResult; timestamp: number }>

  constructor(graphMemory: GraphMemoryImpl) {
    this.graphMemory = graphMemory
    this.metrics = {
      retrievalCount: 0,
      avgRetrievalTime: 0,
      cacheHitRate: 0,
      avgRelevanceScore: 0,
      byQueryType: {} as Record<RetrievalQueryType, number>,
      byAlgorithm: {} as Record<string, number>
    }
    this.cache = new Map()
  }

  /**
   * 执行检索查询
   */
  async retrieve(query: RetrievalQuery): Promise<RetrievedSubgraph> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(query)

    // 检查缓存（简化实现）
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      if (Date.now() - cached.timestamp < 300000) { // 5分钟缓存
        this.updateMetrics(startTime, query.queryType, 'cached', cached.result)
        return this.resultToSubgraph(cached.result, query)
      }
    }

    console.log(`[GraphRetrieval] 执行检索: ${query.queryType}, 目标: ${query.targetIds.length} 个`)

    let result: RetrievalResult

    // 根据查询类型选择检索模式
    switch (query.queryType) {
      case 'file':
        result = await this.retrieveByFile(query)
        break
      case 'symbol':
        result = await this.retrieveBySymbol(query)
        break
      case 'task':
        result = await this.retrieveByTask(query)
        break
      case 'slice':
        result = await this.retrieveBySlice(query)
        break
      default:
        result = await this.retrieveByFile(query)
    }

    // 更新缓存
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    })

    // 更新指标
    this.updateMetrics(startTime, query.queryType, 'default', result)

    // 转换为子图
    const subgraph = this.resultToSubgraph(result, query)
    console.log(`[GraphRetrieval] 检索完成: ${result.nodes.length} 节点, ${result.edges.length} 边`)

    return subgraph
  }

  /**
   * 按文件检索
   */
  private async retrieveByFile(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now()
    const retrievedNodes: RetrievedNode[] = []
    const rankingReasons: RankingReason[] = []

    // 对每个目标文件进行检索
    for (const targetId of query.targetIds) {
      const fileNode = this.findFileNode(targetId)
      if (!fileNode) continue

      // 直接匹配的文件节点
      retrievedNodes.push({
        node: fileNode,
        relevanceScore: 100,
        distance: 0,
        matchReasons: ['直接匹配目标文件']
      })

      rankingReasons.push({
        factor: 'file_direct_match',
        score: 100,
        description: `直接匹配文件: ${fileNode.label}`
      })

      // 检索相关文件（通过导入/依赖关系）
      const relatedFiles = await this.findRelatedFiles(fileNode, query.filters)
      retrievedNodes.push(...relatedFiles)

      // 检索文件中的符号
      const fileSymbols = await this.findFileSymbols(fileNode, query.filters)
      retrievedNodes.push(...fileSymbols)
    }

    // 收集相关边
    const retrievedEdges = await this.collectRelevantEdges(retrievedNodes)

    // 去重和排序
    const uniqueNodes = this.deduplicateAndSortNodes(retrievedNodes)
    const filteredEdges = this.filterRelevantEdges(retrievedEdges, uniqueNodes)

    return {
      nodes: uniqueNodes,
      edges: filteredEdges,
      rankingReasons,
      retrievalMode: 'byFile',
      retrievalTimeMs: Date.now() - startTime
    }
  }

  /**
   * 按符号检索
   */
  private async retrieveBySymbol(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now()
    const retrievedNodes: RetrievedNode[] = []
    const rankingReasons: RankingReason[] = []

    // 对每个目标符号进行检索
    for (const targetId of query.targetIds) {
      const symbolNode = this.findSymbolNode(targetId)
      if (!symbolNode) continue

      // 直接匹配的符号节点
      retrievedNodes.push({
        node: symbolNode,
        relevanceScore: 100,
        distance: 0,
        matchReasons: ['直接匹配目标符号']
      })

      rankingReasons.push({
        factor: 'symbol_direct_match',
        score: 100,
        description: `直接匹配符号: ${symbolNode.label}`
      })

      // 查找符号所在的文件
      const fileNode = this.findSymbolFile(symbolNode)
      if (fileNode) {
        retrievedNodes.push({
          node: fileNode,
          relevanceScore: 90,
          distance: 1,
          matchReasons: [`符号 ${symbolNode.label} 所在的文件`]
        })

        rankingReasons.push({
          factor: 'symbol_file_context',
          score: 90,
          description: `符号所在文件: ${fileNode.label}`
        })
      }

      // 查找相关符号（同文件、同类型等）
      const relatedSymbols = await this.findRelatedSymbols(symbolNode, query.filters)
      retrievedNodes.push(...relatedSymbols)
    }

    // 收集相关边
    const retrievedEdges = await this.collectRelevantEdges(retrievedNodes)

    // 去重和排序
    const uniqueNodes = this.deduplicateAndSortNodes(retrievedNodes)
    const filteredEdges = this.filterRelevantEdges(retrievedEdges, uniqueNodes)

    return {
      nodes: uniqueNodes,
      edges: filteredEdges,
      rankingReasons,
      retrievalMode: 'bySymbol',
      retrievalTimeMs: Date.now() - startTime
    }
  }

  /**
   * 按任务检索（简化实现）
   */
  private async retrieveByTask(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now()
    const retrievedNodes: RetrievedNode[] = []
    const rankingReasons: RankingReason[] = []

    // 查找任务节点
    for (const targetId of query.targetIds) {
      const taskNode = this.findTaskNode(targetId)
      if (!taskNode) continue

      retrievedNodes.push({
        node: taskNode,
        relevanceScore: 100,
        distance: 0,
        matchReasons: ['直接匹配目标任务']
      })

      rankingReasons.push({
        factor: 'task_direct_match',
        score: 100,
        description: `直接匹配任务: ${taskNode.label}`
      })

      // 查找任务相关的文件（通过任务属性或边关系）
      const taskFiles = await this.findTaskRelatedFiles(taskNode, query.filters)
      retrievedNodes.push(...taskFiles)

      // 查找任务会话上下文
      const sessionNode = this.findTaskSession(taskNode)
      if (sessionNode) {
        retrievedNodes.push({
          node: sessionNode,
          relevanceScore: 80,
          distance: 1,
          matchReasons: [`任务 ${taskNode.label} 所属的会话`]
        })
      }
    }

    const retrievedEdges = await this.collectRelevantEdges(retrievedNodes)
    const uniqueNodes = this.deduplicateAndSortNodes(retrievedNodes)
    const filteredEdges = this.filterRelevantEdges(retrievedEdges, uniqueNodes)

    return {
      nodes: uniqueNodes,
      edges: filteredEdges,
      rankingReasons,
      retrievalMode: 'byTask',
      retrievalTimeMs: Date.now() - startTime
    }
  }

  /**
   * 按代码切片检索（简化实现）
   */
  private async retrieveBySlice(query: RetrievalQuery): Promise<RetrievalResult> {
    // 简化为按文件检索的变体
    return this.retrieveByFile(query)
  }

  /**
   * 查找文件节点
   */
  private findFileNode(targetId: string): GraphNode | undefined {
    // 先尝试直接按ID查找
    const node = this.graphMemory.getNode(targetId)
    if (node && (node.type === 'file' || node.type === 'directory')) {
      return node
    }

    // 尝试按路径查找
    const fileNodes = this.graphMemory.findNodes(n =>
      n.type === 'file' &&
      (n.properties.path === targetId || n.id.includes(targetId))
    )

    return fileNodes[0]
  }

  /**
   * 查找符号节点
   */
  private findSymbolNode(targetId: string): GraphNode | undefined {
    // 先尝试直接按ID查找
    const node = this.graphMemory.getNode(targetId)
    if (node && this.isSymbolType(node.type)) {
      return node
    }

    // 尝试按名称查找
    const symbolNodes = this.graphMemory.findNodes(n =>
      this.isSymbolType(n.type) &&
      (n.label === targetId || n.id.includes(targetId))
    )

    return symbolNodes[0]
  }

  /**
   * 查找任务节点
   */
  private findTaskNode(targetId: string): GraphNode | undefined {
    const node = this.graphMemory.getNode(targetId)
    if (node && node.type === 'task') {
      return node
    }

    const taskNodes = this.graphMemory.findNodes(n =>
      n.type === 'task' &&
      (n.properties.taskId === targetId || n.id.includes(targetId))
    )

    return taskNodes[0]
  }

  /**
   * 判断是否为符号类型
   */
  private isSymbolType(nodeType: GraphNodeType): boolean {
    return [
      'function',
      'class',
      'interface',
      'type',
      'variable',
      'constant',
      'enum'
    ].includes(nodeType)
  }

  /**
   * 查找相关文件
   */
  private async findRelatedFiles(fileNode: GraphNode, filters?: RetrievalFilter): Promise<RetrievedNode[]> {
    const relatedNodes: RetrievedNode[] = []
    const visited = new Set<string>([fileNode.id])

    // BFS 查找相关文件（最大深度2）
    const queue: { nodeId: string; distance: number }[] = [
      { nodeId: fileNode.id, distance: 0 }
    ]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current.distance >= 2) continue

      const neighbors = this.graphMemory.getNeighbors(current.nodeId)
      for (const { node: neighbor, edge } of neighbors) {
        if (visited.has(neighbor.id)) continue

        // 只关注文件相关的边
        if (!['imports', 'requires', 'references', 'depends_on'].includes(edge.type)) {
          continue
        }

        // 过滤节点
        if (filters?.nodeTypes && !filters.nodeTypes.includes(neighbor.type)) {
          continue
        }

        visited.add(neighbor.id)
        const distance = current.distance + 1

        // 计算相关性（距离越近相关性越高）
        const relevanceScore = Math.max(0, 100 - distance * 30)

        relatedNodes.push({
          node: neighbor,
          relevanceScore,
          distance,
          matchReasons: [`通过 ${edge.type} 关系连接`]
        })

        if (neighbor.type === 'file' || neighbor.type === 'directory') {
          queue.push({ nodeId: neighbor.id, distance })
        }
      }
    }

    return relatedNodes
  }

  /**
   * 查找文件中的符号
   */
  private async findFileSymbols(fileNode: GraphNode, filters?: RetrievalFilter): Promise<RetrievedNode[]> {
    const symbolNodes: RetrievedNode[] = []

    // 查找文件包含的符号
    const neighbors = this.graphMemory.getNeighbors(fileNode.id)
    for (const { node: neighbor, edge } of neighbors) {
      if (edge.type !== 'contains') continue

      if (!this.isSymbolType(neighbor.type)) continue

      // 过滤符号
      if (filters?.nodeTypes && !filters.nodeTypes.includes(neighbor.type)) {
        continue
      }

      symbolNodes.push({
        node: neighbor,
        relevanceScore: 85, // 文件包含的符号有较高相关性
        distance: 1,
        matchReasons: [`文件 ${fileNode.label} 包含的 ${neighbor.type}`]
      })
    }

    return symbolNodes
  }

  /**
   * 查找符号所在的文件
   */
  private findSymbolFile(symbolNode: GraphNode): GraphNode | undefined {
    const neighbors = this.graphMemory.getNeighbors(symbolNode.id)
    for (const { node: neighbor, edge } of neighbors) {
      if (edge.type === 'contains' && neighbor.type === 'file') {
        return neighbor
      }
    }
    return undefined
  }

  /**
   * 查找相关符号
   */
  private async findRelatedSymbols(symbolNode: GraphNode, filters?: RetrievalFilter): Promise<RetrievedNode[]> {
    const relatedSymbols: RetrievedNode[] = []

    // 查找同文件的符号
    const fileNode = this.findSymbolFile(symbolNode)
    if (fileNode) {
      const fileSymbols = await this.findFileSymbols(fileNode, filters)
      // 过滤掉自己
      relatedSymbols.push(...fileSymbols.filter(s => s.node.id !== symbolNode.id))
    }

    // 查找通过调用/引用关系连接的符号
    const neighbors = this.graphMemory.getNeighbors(symbolNode.id)
    for (const { node: neighbor, edge } of neighbors) {
      if (!this.isSymbolType(neighbor.type)) continue

      if (!['calls', 'references', 'extends', 'implements'].includes(edge.type)) {
        continue
      }

      // 过滤符号
      if (filters?.nodeTypes && !filters.nodeTypes.includes(neighbor.type)) {
        continue
      }

      relatedSymbols.push({
        node: neighbor,
        relevanceScore: 75,
        distance: 1,
        matchReasons: [`通过 ${edge.type} 关系连接的符号`]
      })
    }

    return relatedSymbols
  }

  /**
   * 查找任务相关文件
   */
  private async findTaskRelatedFiles(taskNode: GraphNode, filters?: RetrievalFilter): Promise<RetrievedNode[]> {
    const relatedFiles: RetrievedNode[] = []

    // 通过边关系查找任务影响的文件
    const neighbors = this.graphMemory.getNeighbors(taskNode.id)
    for (const { node: neighbor, edge } of neighbors) {
      if (neighbor.type !== 'file') continue

      if (!['affects', 'related_to', 'triggers'].includes(edge.type)) {
        continue
      }

      // 过滤文件
      if (filters?.nodeTypes && !filters.nodeTypes.includes(neighbor.type)) {
        continue
      }

      relatedFiles.push({
        node: neighbor,
        relevanceScore: 80,
        distance: 1,
        matchReasons: [`任务 ${taskNode.label} 影响的文件`]
      })
    }

    return relatedFiles
  }

  /**
   * 查找任务所属会话
   */
  private findTaskSession(taskNode: GraphNode): GraphNode | undefined {
    const neighbors = this.graphMemory.getNeighbors(taskNode.id)
    for (const { node: neighbor, edge } of neighbors) {
      if (edge.type === 'belongs_to' && neighbor.type === 'session') {
        return neighbor
      }
    }
    return undefined
  }

  /**
   * 收集相关边
   */
  private async collectRelevantEdges(nodes: RetrievedNode[]): Promise<RetrievedEdge[]> {
    const edges: RetrievedEdge[] = []
    const nodeIds = new Set(nodes.map(n => n.node.id))

    // 收集节点之间的边
    for (const node of nodes) {
      const neighbors = this.graphMemory.getNeighbors(node.node.id)
      for (const { edge } of neighbors) {
        if (nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId)) {
          // 计算边的相关性（基于两端节点的相关性）
          const sourceNode = nodes.find(n => n.node.id === edge.sourceId)
          const targetNode = nodes.find(n => n.node.id === edge.targetId)
          const relevanceScore = sourceNode && targetNode
            ? Math.round((sourceNode.relevanceScore + targetNode.relevanceScore) / 2)
            : 50

          edges.push({
            edge,
            relevanceScore
          })
        }
      }
    }

    return edges
  }

  /**
   * 去重和排序节点
   */
  private deduplicateAndSortNodes(nodes: RetrievedNode[]): RetrievedNode[] {
    const nodeMap = new Map<string, RetrievedNode>()

    for (const node of nodes) {
      const existing = nodeMap.get(node.node.id)
      if (!existing || node.relevanceScore > existing.relevanceScore) {
        nodeMap.set(node.node.id, node)
      }
    }

    return Array.from(nodeMap.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /**
   * 过滤相关边
   */
  private filterRelevantEdges(edges: RetrievedEdge[], nodes: RetrievedNode[]): RetrievedEdge[] {
    const nodeIds = new Set(nodes.map(n => n.node.id))

    return edges
      .filter(edge => nodeIds.has(edge.edge.sourceId) && nodeIds.has(edge.edge.targetId))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /**
   * 将检索结果转换为子图
   */
  private resultToSubgraph(result: RetrievalResult, query: RetrievalQuery): RetrievedSubgraph {
    return {
      id: `subgraph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query,
      nodes: result.nodes,
      edges: result.edges,
      statistics: {
        totalNodes: result.nodes.length,
        totalEdges: result.edges.length,
        avgRelevance: result.nodes.length > 0
          ? result.nodes.reduce((sum, node) => sum + node.relevanceScore, 0) / result.nodes.length
          : 0,
        maxRelevance: result.nodes.length > 0
          ? Math.max(...result.nodes.map(node => node.relevanceScore))
          : 0,
        retrievalTimeMs: result.retrievalTimeMs
      },
      summary: this.generateSummary(result),
      createdAt: Date.now()
    }
  }

  /**
   * 生成摘要
   */
  private generateSummary(result: RetrievalResult): string {
    const nodeTypes = new Map<string, number>()
    result.nodes.forEach(node => {
      const count = nodeTypes.get(node.node.type) || 0
      nodeTypes.set(node.node.type, count + 1)
    })

    const topTypes = Array.from(nodeTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type}(${count})`)
      .join(', ')

    return `${result.retrievalMode} 检索: ${result.nodes.length} 节点 (${topTypes}), ${result.edges.length} 条边, 平均相关性 ${Math.round(
      result.nodes.reduce((sum, node) => sum + node.relevanceScore, 0) / result.nodes.length || 0
    )}`
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(query: RetrievalQuery): string {
    return `${query.queryType}:${query.targetIds.join(',')}:${JSON.stringify(query.filters)}`
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(
    startTime: number,
    queryType: RetrievalQueryType,
    algorithm: string,
    result: RetrievalResult
  ): void {
    const retrievalTime = Date.now() - startTime

    this.metrics.retrievalCount++

    // 更新平均检索时间
    this.metrics.avgRetrievalTime =
      (this.metrics.avgRetrievalTime * (this.metrics.retrievalCount - 1) + retrievalTime) /
      this.metrics.retrievalCount

    // 更新缓存命中率
    if (algorithm === 'cached') {
      const totalCached = (this.metrics.byQueryType['cached' as RetrievalQueryType] || 0) + 1
      this.metrics.byQueryType['cached' as RetrievalQueryType] = totalCached
      this.metrics.cacheHitRate = totalCached / this.metrics.retrievalCount
    } else {
      // 更新查询类型统计
      this.metrics.byQueryType[queryType] = (this.metrics.byQueryType[queryType] || 0) + 1

      // 更新算法统计
      this.metrics.byAlgorithm[algorithm] = (this.metrics.byAlgorithm[algorithm] || 0) + 1

      // 更新平均相关性
      const avgRelevance = result.nodes.length > 0
        ? result.nodes.reduce((sum, node) => sum + node.relevanceScore, 0) / result.nodes.length
        : 0
      this.metrics.avgRelevanceScore =
        (this.metrics.avgRelevanceScore * (this.metrics.retrievalCount - 1) + avgRelevance) /
        this.metrics.retrievalCount
    }
  }

  /**
   * 获取性能指标
   */
  getMetrics(): RetrievalMetrics {
    return { ...this.metrics }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
  }
}
