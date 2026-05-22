/**
 * Graph Retrieval - 鍥炬绱㈠疄鐜?(F-2)
 *
 * 鍚告敹涓婃父 repo-level context 缁勭粐鏂瑰紡
 * 鎻愪緵 byFile / bySymbol 绛夋绱㈣兘鍔? */

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
 * 妫€绱㈡ā寮? */
export type RetrievalMode = 'byFile' | 'bySymbol' | 'byTask' | 'bySlice'

/**
 * 鎺掑悕鍘熷洜
 */
export interface RankingReason {
  factor: string
  score: number
  description: string
}

/**
 * 妫€绱㈢粨鏋? */
export interface RetrievalResult {
  nodes: RetrievedNode[]
  edges: RetrievedEdge[]
  rankingReasons: RankingReason[]
  retrievalMode: RetrievalMode
  retrievalTimeMs: number
}

/**
 * Graph Retrieval 瀹炵幇绫? */
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
   * 鎵ц妫€绱㈡煡璇?   */
  async retrieve(query: RetrievalQuery, options: { countCacheHit?: boolean } = {}): Promise<RetrievedSubgraph> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(query)

    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 300000) {
      if (options.countCacheHit !== false) {
        this.updateMetrics(startTime, query.queryType, 'cached', cached.result)
      }
      return this.resultToSubgraph(cached.result, query)
    }

    console.log(`[GraphRetrieval] 执行检索: ${query.queryType}, 目标: ${query.targetIds.length} 个`)

    let result: RetrievalResult
    try {
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
        case 'dependency':
        case 'hotspot':
        case 'context':
        case 'session':
          result = await this.retrieveBySlice(query)
          break
        default:
          result = await this.retrieveByFile(query)
      }
    } catch {
      result = this.createEmptyResult(query, Date.now() - startTime)
    }

    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    })

    this.updateMetrics(startTime, query.queryType, 'default', result)

    const subgraph = this.resultToSubgraph(result, query)
    console.log(`[GraphRetrieval] 检索完成: ${result.nodes.length} 节点, ${result.edges.length} 边`)

    return subgraph
  }

  private createEmptyResult(query: RetrievalQuery, retrievalTimeMs: number): RetrievalResult {
    return {
      nodes: [],
      edges: [],
      rankingReasons: [{
        factor: 'retrieval_error_or_empty',
        score: 0,
        description: `No graph context available for ${query.queryType}`
      }],
      retrievalMode: query.queryType === 'symbol' ? 'bySymbol' : query.queryType === 'task' ? 'byTask' : 'byFile',
      retrievalTimeMs
    }
  }
  private async retrieveByFile(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now()
    const retrievedNodes: RetrievedNode[] = []
    const rankingReasons: RankingReason[] = []

    for (const targetId of query.targetIds) {
      const fileNode = this.findFileNode(targetId)
      if (!fileNode) continue

      retrievedNodes.push({
        node: fileNode,
        relevanceScore: 100,
        distance: 0,
        matchReasons: ['direct file match']
      })
      rankingReasons.push({
        factor: 'file_direct_match',
        score: 100,
        description: `Direct file match: ${fileNode.label}`
      })

      retrievedNodes.push(...await this.findRelatedFiles(fileNode, query.filters))
      retrievedNodes.push(...await this.findFileSymbols(fileNode, query.filters))
    }

    const retrievedEdges = await this.collectRelevantEdges(retrievedNodes)
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

  private async retrieveBySymbol(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now()
    const retrievedNodes: RetrievedNode[] = []
    const rankingReasons: RankingReason[] = []

    for (const targetId of query.targetIds) {
      const symbolNode = this.findSymbolNode(targetId)
      if (!symbolNode) continue

      retrievedNodes.push({
        node: symbolNode,
        relevanceScore: 100,
        distance: 0,
        matchReasons: ['direct symbol match']
      })
      rankingReasons.push({
        factor: 'symbol_direct_match',
        score: 100,
        description: `Direct symbol match: ${symbolNode.label}`
      })

      const fileNode = this.findSymbolFile(symbolNode)
      if (fileNode) {
        retrievedNodes.push({
          node: fileNode,
          relevanceScore: 90,
          distance: 1,
          matchReasons: [`file containing ${symbolNode.label}`]
        })
      }
      retrievedNodes.push(...await this.findRelatedSymbols(symbolNode, query.filters))
    }

    const retrievedEdges = await this.collectRelevantEdges(retrievedNodes)
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

  private async retrieveByTask(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now()
    const retrievedNodes: RetrievedNode[] = []
    const rankingReasons: RankingReason[] = []

    for (const targetId of query.targetIds) {
      const taskNode = this.findTaskNode(targetId)
      if (!taskNode) continue

      retrievedNodes.push({
        node: taskNode,
        relevanceScore: 100,
        distance: 0,
        matchReasons: ['direct task match']
      })
      rankingReasons.push({
        factor: 'task_direct_match',
        score: 100,
        description: `Direct task match: ${taskNode.label}`
      })

      retrievedNodes.push(...await this.findTaskRelatedFiles(taskNode, query.filters))
      const sessionNode = this.findTaskSession(taskNode)
      if (sessionNode) {
        retrievedNodes.push({
          node: sessionNode,
          relevanceScore: 80,
          distance: 1,
          matchReasons: [`session for task ${taskNode.label}`]
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

  private async retrieveBySlice(query: RetrievalQuery): Promise<RetrievalResult> {
    return this.retrieveByFile(query)
  }
  private findFileNode(targetId: string): GraphNode | undefined {
    const node = this.graphMemory.getNode(targetId)
    if (node && (node.type === 'file' || node.type === 'directory')) {
      return node
    }

    const fileNodes = this.graphMemory.findNodes(n =>
      n.type === 'file' &&
      (n.properties.path === targetId || n.id.includes(targetId) || n.label === targetId)
    )

    return fileNodes[0]
  }

  private findSymbolNode(targetId: string): GraphNode | undefined {
    const node = this.graphMemory.getNode(targetId)
    if (node && this.isSymbolType(node.type)) {
      return node
    }

    const symbolNodes = this.graphMemory.findNodes(n =>
      this.isSymbolType(n.type) &&
      (n.label === targetId || n.id.includes(targetId))
    )

    return symbolNodes[0]
  }

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

  private isSymbolType(nodeType: GraphNodeType): boolean {
    return ['function', 'class', 'interface', 'type', 'variable', 'constant', 'enum'].includes(nodeType)
  }

  private async findRelatedFiles(fileNode: GraphNode, filters?: RetrievalFilter): Promise<RetrievedNode[]> {
    const relatedNodes: RetrievedNode[] = []
    const visited = new Set<string>([fileNode.id])
    const queue: { nodeId: string; distance: number }[] = [{ nodeId: fileNode.id, distance: 0 }]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current.distance >= 2) continue

      const neighbors = this.graphMemory.getNeighbors(current.nodeId)
      for (const { node: neighbor, edge } of neighbors) {
        if (visited.has(neighbor.id)) continue
        if (!['imports', 'requires', 'references', 'depends_on', 'affects'].includes(edge.type)) continue
        if (filters?.nodeTypes && !filters.nodeTypes.includes(neighbor.type)) continue

        visited.add(neighbor.id)
        const distance = current.distance + 1
        relatedNodes.push({
          node: neighbor,
          relevanceScore: Math.max(0, 100 - distance * 30),
          distance,
          matchReasons: [`connected by ${edge.type}`]
        })

        if (neighbor.type === 'file' || neighbor.type === 'directory') {
          queue.push({ nodeId: neighbor.id, distance })
        }
      }
    }

    return relatedNodes
  }

  private async findFileSymbols(fileNode: GraphNode, filters?: RetrievalFilter): Promise<RetrievedNode[]> {
    const symbolNodes: RetrievedNode[] = []
    const neighbors = this.graphMemory.getNeighbors(fileNode.id)

    for (const { node: neighbor, edge } of neighbors) {
      if (edge.type !== 'contains') continue
      if (!this.isSymbolType(neighbor.type)) continue
      if (filters?.nodeTypes && !filters.nodeTypes.includes(neighbor.type)) continue

      symbolNodes.push({
        node: neighbor,
        relevanceScore: 85,
        distance: 1,
        matchReasons: [`${fileNode.label} contains ${neighbor.type}`]
      })
    }

    return symbolNodes
  }

  private findSymbolFile(symbolNode: GraphNode): GraphNode | undefined {
    const neighbors = this.graphMemory.getNeighbors(symbolNode.id)
    for (const { node: neighbor, edge } of neighbors) {
      if (edge.type === 'contains' && neighbor.type === 'file') {
        return neighbor
      }
    }
    return undefined
  }

  private async findRelatedSymbols(symbolNode: GraphNode, filters?: RetrievalFilter): Promise<RetrievedNode[]> {
    const relatedSymbols: RetrievedNode[] = []

    const fileNode = this.findSymbolFile(symbolNode)
    if (fileNode) {
      const fileSymbols = await this.findFileSymbols(fileNode, filters)
      relatedSymbols.push(...fileSymbols.filter(s => s.node.id !== symbolNode.id))
    }

    const neighbors = this.graphMemory.getNeighbors(symbolNode.id)
    for (const { node: neighbor, edge } of neighbors) {
      if (!this.isSymbolType(neighbor.type)) continue
      if (!['calls', 'references', 'extends', 'implements'].includes(edge.type)) continue
      if (filters?.nodeTypes && !filters.nodeTypes.includes(neighbor.type)) continue

      relatedSymbols.push({
        node: neighbor,
        relevanceScore: 75,
        distance: 1,
        matchReasons: [`connected by ${edge.type}`]
      })
    }

    return relatedSymbols
  }
  private async findTaskRelatedFiles(taskNode: GraphNode, filters?: RetrievalFilter): Promise<RetrievedNode[]> {
    const relatedFiles: RetrievedNode[] = []

    // 閫氳繃杈瑰叧绯绘煡鎵句换鍔″奖鍝嶇殑鏂囦欢
    const neighbors = this.graphMemory.getNeighbors(taskNode.id)
    for (const { node: neighbor, edge } of neighbors) {
      if (neighbor.type !== 'file') continue

      if (!['affects', 'related_to', 'triggers'].includes(edge.type)) {
        continue
      }

      // 杩囨护鏂囦欢
      if (filters?.nodeTypes && !filters.nodeTypes.includes(neighbor.type)) {
        continue
      }

      relatedFiles.push({
        node: neighbor,
        relevanceScore: 80,
        distance: 1,
        matchReasons: [`task ${taskNode.label} affects file`]
      })
    }

    return relatedFiles
  }

  /**
   * 鏌ユ壘浠诲姟鎵€灞炰細璇?   */
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
   * 鏀堕泦鐩稿叧杈?   */
  private async collectRelevantEdges(nodes: RetrievedNode[]): Promise<RetrievedEdge[]> {
    const edges: RetrievedEdge[] = []
    const nodeIds = new Set(nodes.map(n => n.node.id))

    // 鏀堕泦鑺傜偣涔嬮棿鐨勮竟
    for (const node of nodes) {
      const neighbors = this.graphMemory.getNeighbors(node.node.id)
      for (const { edge } of neighbors) {
        if (nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId)) {
          // 璁＄畻杈圭殑鐩稿叧鎬э紙鍩轰簬涓ょ鑺傜偣鐨勭浉鍏虫€э級
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
   * 鍘婚噸鍜屾帓搴忚妭鐐?   */
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
   * 杩囨护鐩稿叧杈?   */
  private filterRelevantEdges(edges: RetrievedEdge[], nodes: RetrievedNode[]): RetrievedEdge[] {
    const nodeIds = new Set(nodes.map(n => n.node.id))

    return edges
      .filter(edge => nodeIds.has(edge.edge.sourceId) && nodeIds.has(edge.edge.targetId))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /**
   * 灏嗘绱㈢粨鏋滆浆鎹负瀛愬浘
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
   * 鐢熸垚鎽樿
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

    return `${result.retrievalMode} 妫€绱? ${result.nodes.length} 鑺傜偣 (${topTypes}), ${result.edges.length} 鏉¤竟, 骞冲潎鐩稿叧鎬?${Math.round(
      result.nodes.reduce((sum, node) => sum + node.relevanceScore, 0) / result.nodes.length || 0
    )}`
  }

  /**
   * 鐢熸垚缂撳瓨閿?   */
  private generateCacheKey(query: RetrievalQuery): string {
    return `${query.queryType}:${query.targetIds.join(',')}:${JSON.stringify(query.filters)}`
  }

  /**
   * 鏇存柊鎬ц兘鎸囨爣
   */
  private updateMetrics(
    startTime: number,
    queryType: RetrievalQueryType,
    algorithm: string,
    result: RetrievalResult
  ): void {
    const retrievalTime = Math.max(1, Date.now() - startTime)
    this.metrics.retrievalCount++

    this.metrics.avgRetrievalTime =
      (this.metrics.avgRetrievalTime * (this.metrics.retrievalCount - 1) + retrievalTime) /
      this.metrics.retrievalCount

    if (algorithm === 'cached') {
      const totalCached = (this.metrics.byQueryType['cached' as RetrievalQueryType] || 0) + 1
      this.metrics.byQueryType['cached' as RetrievalQueryType] = totalCached
      this.metrics.cacheHitRate = totalCached / this.metrics.retrievalCount
      return
    }

    this.metrics.byQueryType[queryType] = (this.metrics.byQueryType[queryType] || 0) + 1
    this.metrics.byAlgorithm[algorithm] = (this.metrics.byAlgorithm[algorithm] || 0) + 1

    const avgRelevance = result.nodes.length > 0
      ? result.nodes.reduce((sum, node) => sum + node.relevanceScore, 0) / result.nodes.length
      : 0
    this.metrics.avgRelevanceScore =
      (this.metrics.avgRelevanceScore * (this.metrics.retrievalCount - 1) + avgRelevance) /
      this.metrics.retrievalCount
  }
  /**
   * 鑾峰彇鎬ц兘鎸囨爣
   */
  getMetrics(): RetrievalMetrics {
    return { ...this.metrics }
  }

  /**
   * 娓呯┖缂撳瓨
   */
  clearCache(): void {
    this.cache.clear()
  }
}
