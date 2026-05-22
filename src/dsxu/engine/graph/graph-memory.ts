/**
 * Graph Memory - 图记忆实现
 *
 * 吸收上游 Context discipline 与 compact/session memory 输入形态
 * 提供图结构的代码理解和记忆管理
 */

import type {
  GraphNode,
  GraphEdge,
  GraphMemory,
  GraphMemoryMetadata,
  GraphBuildConfig,
  GraphUpdateOptions,
  GraphNodeType,
  GraphEdgeType
} from './types'

import type { RepoBrain, RepoAnalysisResult } from '../repo-brain'
import type { LSPTool } from '../lsp-tool'
import type { MemorySystem } from '../memory/memory-system'
import type { Session } from '../session'

/**
 * Graph Memory 实现类
 */
export class GraphMemoryImpl {
  private graph: GraphMemory
  private repoBrain?: RepoBrain
  private lspTool?: LSPTool
  private memorySystem?: MemorySystem

  constructor(
    sessionId: string,
    config: GraphBuildConfig = {
      includeFiles: true,
      includeDirectories: true,
      includeSymbols: true,
      includeHotspots: true,
      includeSessionTasks: false,
      sources: ['repo-brain']
    }
  ) {
    this.graph = {
      id: `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      nodes: new Map(),
      edges: new Map(),
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodeCount: 0,
        edgeCount: 0,
        sources: config.sources,
        coverage: 'initial',
        statistics: {
          byNodeType: {} as Record<GraphNodeType, number>,
          byEdgeType: {} as Record<GraphEdgeType, number>,
          avgNodeDegree: 0,
          maxNodeDegree: 0,
          connectedComponents: 0
        }
      }
    }
  }

  /**
   * 设置依赖组件
   */
  setDependencies(
    repoBrain?: RepoBrain,
    lspTool?: LSPTool,
    memorySystem?: MemorySystem
  ): void {
    this.repoBrain = repoBrain
    this.lspTool = lspTool
    this.memorySystem = memorySystem
  }

  /**
   * 从 repo-brain 构建图
   */
  async buildFromRepoBrain(repoRoot: string): Promise<void> {
    if (!this.repoBrain) {
      throw new Error('RepoBrain not available')
    }

    console.log(`[GraphMemory] 从 repo-brain 构建图: ${repoRoot}`)

    // 这里应该调用 repoBrain.analyze()，但为了简化先模拟
    const analysisResult: RepoAnalysisResult = {
      repoRoot,
      nodes: [],
      symbols: [],
      dependencies: [],
      hotspots: []
    }

    // 构建文件节点
    if (this.graph.metadata.sources.includes('repo-brain')) {
      await this.buildFileNodes(analysisResult)
      await this.buildSymbolNodes(analysisResult)
      await this.buildDependencyEdges(analysisResult)
      await this.buildHotspotNodes(analysisResult)
    }

    this.updateMetadata()
    console.log(`[GraphMemory] 构建完成: ${this.graph.nodes.size} 节点, ${this.graph.edges.size} 边`)
  }

  /**
   * 构建文件节点
   */
  private async buildFileNodes(analysisResult: RepoAnalysisResult): Promise<void> {
    // 模拟文件节点构建
    const mockFiles = [
      { path: 'src/index.ts', type: 'file', size: 1024, lastModified: Date.now() },
      { path: 'src/utils.ts', type: 'file', size: 2048, lastModified: Date.now() - 10000 },
      { path: 'src/components/Button.tsx', type: 'file', size: 3072, lastModified: Date.now() - 20000 }
    ]

    for (const file of mockFiles) {
      const nodeId = `file_${file.path.replace(/[\/\.]/g, '_')}`
      const node: GraphNode = {
        id: nodeId,
        type: 'file',
        label: file.path.split('/').pop() || file.path,
        properties: {
          path: file.path,
          extension: file.path.split('.').pop(),
          size: file.size,
          lastModified: file.lastModified,
          importance: 70
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      this.graph.nodes.set(nodeId, node)
    }

    // 构建目录节点
    const directories = new Set<string>()
    mockFiles.forEach(file => {
      const dirPath = file.path.substring(0, file.path.lastIndexOf('/'))
      if (dirPath && !directories.has(dirPath)) {
        directories.add(dirPath)
        const dirParts = dirPath.split('/')
        const nodeId = `dir_${dirPath.replace(/\//g, '_')}`
        const node: GraphNode = {
          id: nodeId,
          type: 'directory',
          label: dirParts[dirParts.length - 1] || dirPath,
          properties: {
            path: dirPath,
            fileCount: mockFiles.filter(f => f.path.startsWith(dirPath + '/')).length
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        this.graph.nodes.set(nodeId, node)
      }
    })
  }

  /**
   * 构建符号节点
   */
  private async buildSymbolNodes(analysisResult: RepoAnalysisResult): Promise<void> {
    // 模拟符号节点
    const mockSymbols = [
      { name: 'calculateSum', type: 'function', filePath: 'src/utils.ts', line: 10 },
      { name: 'UserService', type: 'class', filePath: 'src/services/UserService.ts', line: 5 },
      { name: 'ApiResponse', type: 'interface', filePath: 'src/types.ts', line: 15 }
    ]

    for (const symbol of mockSymbols) {
      const nodeId = `symbol_${symbol.name}_${symbol.filePath.replace(/[\/\.]/g, '_')}`
      const node: GraphNode = {
        id: nodeId,
        type: symbol.type as GraphNodeType,
        label: symbol.name,
        properties: {
          filePath: symbol.filePath,
          line: symbol.line,
          signature: `${symbol.type} ${symbol.name}`,
          importance: 80
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      this.graph.nodes.set(nodeId, node)

      // 创建符号到文件的边
      const fileNodeId = `file_${symbol.filePath.replace(/[\/\.]/g, '_')}`
      if (this.graph.nodes.has(fileNodeId)) {
        const edgeId = `edge_${nodeId}_${fileNodeId}`
        const edge: GraphEdge = {
          id: edgeId,
          sourceId: fileNodeId,
          targetId: nodeId,
          type: 'contains',
          properties: {
            weight: 0.9,
            description: '文件包含符号'
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        this.graph.edges.set(edgeId, edge)
      }
    }
  }

  /**
   * 构建依赖边
   */
  private async buildDependencyEdges(analysisResult: RepoAnalysisResult): Promise<void> {
    // 模拟依赖关系
    const mockDependencies = [
      { source: 'src/index.ts', target: 'src/utils.ts', type: 'imports' },
      { source: 'src/utils.ts', target: 'src/types.ts', type: 'imports' },
      { source: 'src/components/Button.tsx', target: 'src/utils.ts', type: 'imports' }
    ]

    for (const dep of mockDependencies) {
      const sourceId = `file_${dep.source.replace(/[\/\.]/g, '_')}`
      const targetId = `file_${dep.target.replace(/[\/\.]/g, '_')}`

      if (this.graph.nodes.has(sourceId) && this.graph.nodes.has(targetId)) {
        const edgeId = `edge_${sourceId}_${targetId}`
        const edge: GraphEdge = {
          id: edgeId,
          sourceId,
          targetId,
          type: dep.type as GraphEdgeType,
          properties: {
            weight: 0.7,
            strength: 85,
            description: `${dep.source} 导入 ${dep.target}`
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        this.graph.edges.set(edgeId, edge)
      }
    }
  }

  /**
   * 构建热点节点
   */
  private async buildHotspotNodes(analysisResult: RepoAnalysisResult): Promise<void> {
    // 模拟热点区域
    const mockHotspots = [
      {
        id: 'hotspot_complex_logic',
        type: 'complex',
        filePaths: ['src/utils.ts'],
        description: '复杂逻辑区域',
        severity: 7
      }
    ]

    for (const hotspot of mockHotspots) {
      const nodeId = `hotspot_${hotspot.id}`
      const node: GraphNode = {
        id: nodeId,
        type: 'hotspot',
        label: hotspot.description,
        properties: {
          type: hotspot.type,
          filePaths: hotspot.filePaths,
          severity: hotspot.severity,
          bugProneness: 60
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      this.graph.nodes.set(nodeId, node)

      // 创建热点到文件的边
      for (const filePath of hotspot.filePaths) {
        const fileNodeId = `file_${filePath.replace(/[\/\.]/g, '_')}`
        if (this.graph.nodes.has(fileNodeId)) {
          const edgeId = `edge_${nodeId}_${fileNodeId}`
          const edge: GraphEdge = {
            id: edgeId,
            sourceId: nodeId,
            targetId: fileNodeId,
            type: 'affects',
            properties: {
              weight: 0.8,
              description: '热点影响文件'
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          this.graph.edges.set(edgeId, edge)
        }
      }
    }
  }

  /**
   * 更新元数据
   */
  private updateMetadata(): void {
    const nodes = Array.from(this.graph.nodes.values())
    const edges = Array.from(this.graph.edges.values())

    // 统计节点类型
    const byNodeType: Record<GraphNodeType, number> = {} as Record<GraphNodeType, number>
    nodes.forEach(node => {
      byNodeType[node.type] = (byNodeType[node.type] || 0) + 1
    })

    // 统计边类型
    const byEdgeType: Record<GraphEdgeType, number> = {} as Record<GraphEdgeType, number>
    edges.forEach(edge => {
      byEdgeType[edge.type] = (byEdgeType[edge.type] || 0) + 1
    })

    // 计算节点度
    const nodeDegrees = new Map<string, number>()
    edges.forEach(edge => {
      nodeDegrees.set(edge.sourceId, (nodeDegrees.get(edge.sourceId) || 0) + 1)
      nodeDegrees.set(edge.targetId, (nodeDegrees.get(edge.targetId) || 0) + 1)
    })

    const degrees = Array.from(nodeDegrees.values())
    const avgNodeDegree = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0
    const maxNodeDegree = degrees.length > 0 ? Math.max(...degrees) : 0

    this.graph.metadata = {
      ...this.graph.metadata,
      updatedAt: Date.now(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      statistics: {
        byNodeType,
        byEdgeType,
        avgNodeDegree,
        maxNodeDegree,
        connectedComponents: this.calculateConnectedComponents()
      }
    }
  }

  /**
   * 计算连通分量
   */
  private calculateConnectedComponents(): number {
    const visited = new Set<string>()
    let components = 0

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        components++
        this.dfs(nodeId, visited)
      }
    }

    return components
  }

  /**
   * 深度优先搜索
   */
  private dfs(nodeId: string, visited: Set<string>): void {
    visited.add(nodeId)

    // 查找所有与当前节点相连的边
    for (const edge of this.graph.edges.values()) {
      if (edge.sourceId === nodeId && !visited.has(edge.targetId)) {
        this.dfs(edge.targetId, visited)
      }
      if (edge.targetId === nodeId && !visited.has(edge.sourceId)) {
        this.dfs(edge.sourceId, visited)
      }
    }
  }

  /**
   * 获取图记忆
   */
  getGraph(): GraphMemory {
    return this.graph
  }

  /**
   * 获取节点
   */
  getNode(nodeId: string): GraphNode | undefined {
    return this.graph.nodes.get(nodeId)
  }

  /**
   * 获取边
   */
  getEdge(edgeId: string): GraphEdge | undefined {
    return this.graph.edges.get(edgeId)
  }

  /**
   * 添加节点
   */
  addNode(node: GraphNode): void {
    this.graph.nodes.set(node.id, node)
    this.updateMetadata()
  }

  /**
   * 添加边
   */
  addEdge(edge: GraphEdge): void {
    this.graph.edges.set(edge.id, edge)
    this.updateMetadata()
  }

  /**
   * 删除节点
   */
  deleteNode(nodeId: string): boolean {
    const deleted = this.graph.nodes.delete(nodeId)
    if (deleted) {
      // 删除相关的边
      for (const [edgeId, edge] of this.graph.edges.entries()) {
        if (edge.sourceId === nodeId || edge.targetId === nodeId) {
          this.graph.edges.delete(edgeId)
        }
      }
      this.updateMetadata()
    }
    return deleted
  }

  /**
   * 删除边
   */
  deleteEdge(edgeId: string): boolean {
    const deleted = this.graph.edges.delete(edgeId)
    if (deleted) {
      this.updateMetadata()
    }
    return deleted
  }

  /**
   * 查找节点
   */
  findNodes(predicate: (node: GraphNode) => boolean): GraphNode[] {
    return Array.from(this.graph.nodes.values()).filter(predicate)
  }

  /**
   * 查找边
   */
  findEdges(predicate: (edge: GraphEdge) => boolean): GraphEdge[] {
    return Array.from(this.graph.edges.values()).filter(predicate)
  }

  /**
   * 获取节点的邻居
   */
  getNeighbors(nodeId: string): { node: GraphNode; edge: GraphEdge }[] {
    const neighbors: { node: GraphNode; edge: GraphEdge }[] = []

    for (const edge of this.graph.edges.values()) {
      if (edge.sourceId === nodeId) {
        const targetNode = this.graph.nodes.get(edge.targetId)
        if (targetNode) {
          neighbors.push({ node: targetNode, edge })
        }
      } else if (edge.targetId === nodeId) {
        const sourceNode = this.graph.nodes.get(edge.sourceId)
        if (sourceNode) {
          neighbors.push({ node: sourceNode, edge })
        }
      }
    }

    return neighbors
  }

  /**
   * 导出为 JSON
   */
  toJSON(): any {
    return {
      id: this.graph.id,
      sessionId: this.graph.sessionId,
      taskId: this.graph.taskId,
      nodes: Array.from(this.graph.nodes.values()),
      edges: Array.from(this.graph.edges.values()),
      metadata: this.graph.metadata
    }
  }

  /**
   * 从 JSON 导入
   */
  static fromJSON(json: any): GraphMemoryImpl {
    const graphMemory = new GraphMemoryImpl(json.sessionId)
    graphMemory.graph = {
      id: json.id,
      sessionId: json.sessionId,
      taskId: json.taskId,
      nodes: new Map(json.nodes.map((node: GraphNode) => [node.id, node])),
      edges: new Map(json.edges.map((edge: GraphEdge) => [edge.id, edge])),
      metadata: json.metadata
    }
    return graphMemory
  }
}
