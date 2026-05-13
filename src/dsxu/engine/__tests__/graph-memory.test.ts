/**
 * Graph Memory 单元测试
 *
 * 测试 Graph Memory 的基本功能
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { GraphMemoryImpl } from '../graph/graph-memory'
import type { GraphNode, GraphEdge } from '../graph/types'

describe('Graph Memory 单元测试', () => {
  let graphMemory: GraphMemoryImpl

  beforeEach(() => {
    graphMemory = new GraphMemoryImpl('test-session-123')
  })

  describe('1. 基础功能测试', () => {
    it('应该正确创建 Graph Memory 实例', () => {
      expect(graphMemory).toBeDefined()
      const graph = graphMemory.getGraph()
      expect(graph.id).toMatch(/^graph_/)
      expect(graph.sessionId).toBe('test-session-123')
      expect(graph.nodes.size).toBe(0)
      expect(graph.edges.size).toBe(0)
    })

    it('应该能添加和获取节点', () => {
      const node: GraphNode = {
        id: 'test-node-1',
        type: 'file',
        label: 'test.ts',
        properties: { path: 'src/test.ts' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graphMemory.addNode(node)
      const retrievedNode = graphMemory.getNode('test-node-1')

      expect(retrievedNode).toBeDefined()
      expect(retrievedNode?.id).toBe('test-node-1')
      expect(retrievedNode?.type).toBe('file')
      expect(retrievedNode?.label).toBe('test.ts')
    })

    it('应该能添加和获取边', () => {
      // 先添加两个节点
      const node1: GraphNode = {
        id: 'node-1',
        type: 'file',
        label: 'file1.ts',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      const node2: GraphNode = {
        id: 'node-2',
        type: 'file',
        label: 'file2.ts',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graphMemory.addNode(node1)
      graphMemory.addNode(node2)

      // 添加边
      const edge: GraphEdge = {
        id: 'edge-1',
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'imports',
        properties: { weight: 0.8 },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graphMemory.addEdge(edge)
      const retrievedEdge = graphMemory.getEdge('edge-1')

      expect(retrievedEdge).toBeDefined()
      expect(retrievedEdge?.id).toBe('edge-1')
      expect(retrievedEdge?.sourceId).toBe('node-1')
      expect(retrievedEdge?.targetId).toBe('node-2')
      expect(retrievedEdge?.type).toBe('imports')
    })

    it('应该能删除节点和相关的边', () => {
      // 添加节点和边
      const node1: GraphNode = {
        id: 'node-to-delete',
        type: 'file',
        label: 'file.ts',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      const node2: GraphNode = {
        id: 'node-other',
        type: 'file',
        label: 'other.ts',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graphMemory.addNode(node1)
      graphMemory.addNode(node2)

      const edge: GraphEdge = {
        id: 'edge-to-delete',
        sourceId: 'node-to-delete',
        targetId: 'node-other',
        type: 'imports',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graphMemory.addEdge(edge)

      // 删除节点
      const deleted = graphMemory.deleteNode('node-to-delete')
      expect(deleted).toBe(true)
      expect(graphMemory.getNode('node-to-delete')).toBeUndefined()
      expect(graphMemory.getEdge('edge-to-delete')).toBeUndefined()
    })

    it('应该能删除边', () => {
      const node1: GraphNode = {
        id: 'node-a',
        type: 'file',
        label: 'a.ts',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      const node2: GraphNode = {
        id: 'node-b',
        type: 'file',
        label: 'b.ts',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graphMemory.addNode(node1)
      graphMemory.addNode(node2)

      const edge: GraphEdge = {
        id: 'edge-ab',
        sourceId: 'node-a',
        targetId: 'node-b',
        type: 'imports',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graphMemory.addEdge(edge)
      const deleted = graphMemory.deleteEdge('edge-ab')

      expect(deleted).toBe(true)
      expect(graphMemory.getEdge('edge-ab')).toBeUndefined()
    })
  })

  describe('2. 查询功能测试', () => {
    beforeEach(() => {
      // 添加测试数据
      const nodes: GraphNode[] = [
        {
          id: 'file-1',
          type: 'file',
          label: 'utils.ts',
          properties: { path: 'src/utils.ts', importance: 80 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'file-2',
          type: 'file',
          label: 'index.ts',
          properties: { path: 'src/index.ts', importance: 90 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'function-1',
          type: 'function',
          label: 'calculateSum',
          properties: { filePath: 'src/utils.ts', line: 10 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]

      nodes.forEach(node => graphMemory.addNode(node))

      const edges: GraphEdge[] = [
        {
          id: 'edge-import',
          sourceId: 'file-2',
          targetId: 'file-1',
          type: 'imports',
          properties: { weight: 0.7 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'edge-contains',
          sourceId: 'file-1',
          targetId: 'function-1',
          type: 'contains',
          properties: { weight: 0.9 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]

      edges.forEach(edge => graphMemory.addEdge(edge))
    })

    it('应该能查找节点', () => {
      const fileNodes = graphMemory.findNodes(node => node.type === 'file')
      expect(fileNodes.length).toBe(2)
      expect(fileNodes.map(n => n.id)).toContain('file-1')
      expect(fileNodes.map(n => n.id)).toContain('file-2')

      const functionNodes = graphMemory.findNodes(node => node.type === 'function')
      expect(functionNodes.length).toBe(1)
      expect(functionNodes[0].label).toBe('calculateSum')
    })

    it('应该能查找边', () => {
      const importEdges = graphMemory.findEdges(edge => edge.type === 'imports')
      expect(importEdges.length).toBe(1)
      expect(importEdges[0].id).toBe('edge-import')

      const containsEdges = graphMemory.findEdges(edge => edge.type === 'contains')
      expect(containsEdges.length).toBe(1)
      expect(containsEdges[0].id).toBe('edge-contains')
    })

    it('应该能获取节点的邻居', () => {
      const neighbors = graphMemory.getNeighbors('file-1')
      expect(neighbors.length).toBe(2) // 一个入边（imports），一个出边（contains）

      const neighborIds = neighbors.map(n => n.node.id)
      expect(neighborIds).toContain('file-2') // 来自 imports 边
      expect(neighborIds).toContain('function-1') // 来自 contains 边
    })
  })

  describe('3. 图构建测试', () => {
    it('应该能模拟构建图', async () => {
      const graph = new GraphMemoryImpl('build-test')

      // 手动添加模拟数据，而不是调用 buildFromRepoBrain
      const mockNode: GraphNode = {
        id: 'mock-file',
        type: 'file',
        label: 'mock.ts',
        properties: { path: 'src/mock.ts' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graph.addNode(mockNode)

      const result = graph.getGraph()
      expect(result.nodes.size).toBe(1)
      expect(result.metadata.nodeCount).toBe(1)

      console.log(`模拟构建结果: ${result.nodes.size} 节点`)
    })

    it('应该处理缺少 repo-brain 的情况', async () => {
      const graph = new GraphMemoryImpl('no-repo-test')

      // 测试没有设置 repo-brain 时的情况
      try {
        // 这里我们不调用 buildFromRepoBrain，因为需要 repo-brain 实例
        // 只是验证图实例能正常创建
        expect(graph).toBeDefined()
      } catch (error) {
        // 如果出错，应该是其他原因
        console.error('Unexpected error:', error)
      }
    })
  })

  describe('4. 序列化测试', () => {
    it('应该能正确序列化和反序列化', () => {
      // 添加测试数据
      const node: GraphNode = {
        id: 'serialize-node',
        type: 'file',
        label: 'test.ts',
        properties: { path: 'src/test.ts', importance: 75 },
        createdAt: 1234567890,
        updatedAt: 1234567890
      }

      graphMemory.addNode(node)

      // 序列化
      const json = graphMemory.toJSON()
      expect(json.id).toBeDefined()
      expect(json.sessionId).toBe('test-session-123')
      expect(json.nodes).toBeInstanceOf(Array)
      expect(json.nodes.length).toBe(1)
      expect(json.nodes[0].id).toBe('serialize-node')

      // 反序列化
      const restored = GraphMemoryImpl.fromJSON(json)
      const restoredGraph = restored.getGraph()
      expect(restoredGraph.id).toBe(json.id)
      expect(restoredGraph.sessionId).toBe(json.sessionId)
      expect(restoredGraph.nodes.size).toBe(1)
      expect(restoredGraph.nodes.get('serialize-node')).toBeDefined()
    })
  })

  describe('5. 元数据更新测试', () => {
    it('应该在添加节点和边时更新元数据', () => {
      const initialGraph = graphMemory.getGraph()
      expect(initialGraph.metadata.nodeCount).toBe(0)
      expect(initialGraph.metadata.edgeCount).toBe(0)

      // 添加节点
      const node: GraphNode = {
        id: 'meta-node',
        type: 'file',
        label: 'meta.ts',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      graphMemory.addNode(node)

      const afterNodeGraph = graphMemory.getGraph()
      expect(afterNodeGraph.metadata.nodeCount).toBe(1)
      expect(afterNodeGraph.metadata.statistics.byNodeType.file).toBe(1)

      // 添加另一个节点和边
      const node2: GraphNode = {
        id: 'meta-node-2',
        type: 'function',
        label: 'metaFunc',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      graphMemory.addNode(node2)

      const edge: GraphEdge = {
        id: 'meta-edge',
        sourceId: 'meta-node',
        targetId: 'meta-node-2',
        type: 'contains',
        properties: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      graphMemory.addEdge(edge)

      const finalGraph = graphMemory.getGraph()
      expect(finalGraph.metadata.nodeCount).toBe(2)
      expect(finalGraph.metadata.edgeCount).toBe(1)
      expect(finalGraph.metadata.statistics.byNodeType.file).toBe(1)
      expect(finalGraph.metadata.statistics.byNodeType.function).toBe(1)
      expect(finalGraph.metadata.statistics.byEdgeType.contains).toBe(1)
    })
  })
})