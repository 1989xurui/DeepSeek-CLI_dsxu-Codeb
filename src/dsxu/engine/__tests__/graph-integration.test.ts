/**
 * Graph Memory 集成测试
 *
 * 测试 Graph Memory 与现有系统的集成
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { GraphMemoryImpl } from '../graph/graph-memory'
import { createSession, createTask } from '../session'
import type { Session, Task } from '../session'
import type { GraphNode } from '../graph/types'

describe('Graph Memory 集成测试', () => {
  let session: Session
  let task: Task
  let graphMemory: GraphMemoryImpl

  beforeEach(() => {
    session = createSession({
      cwd: '/test/project',
      title: 'Graph 集成测试会话'
    })
    task = createTask({
      sessionId: session.id,
      title: 'Graph 集成测试任务',
      description: '测试 Graph Memory 与 Session/Task 的集成'
    })
    graphMemory = new GraphMemoryImpl(session.id)
  })

  describe('1. Session/Task 集成测试', () => {
    it('应该将 Session/Task 信息集成到图中', () => {
      // 创建 Session 节点
      const sessionNode: GraphNode = {
        id: `session_${session.id}`,
        type: 'session',
        label: session.title,
        properties: {
          sessionId: session.id,
          cwd: session.cwd,
          status: session.status,
          createdAt: session.createdAt
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // 创建 Task 节点
      const taskNode: GraphNode = {
        id: `task_${task.id}`,
        type: 'task',
        label: task.title,
        properties: {
          taskId: task.id,
          sessionId: task.sessionId,
          status: task.status,
          description: task.description,
          createdAt: task.createdAt
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graphMemory.addNode(sessionNode)
      graphMemory.addNode(taskNode)

      // 创建 Session -> Task 边
      const edgeId = `edge_${sessionNode.id}_${taskNode.id}`
      graphMemory.addEdge({
        id: edgeId,
        sourceId: sessionNode.id,
        targetId: taskNode.id,
        type: 'contains',
        properties: {
          weight: 0.9,
          description: '会话包含任务'
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      })

      // 验证集成
      const graph = graphMemory.getGraph()
      expect(graph.nodes.size).toBe(2)
      expect(graph.edges.size).toBe(1)

      const retrievedSessionNode = graphMemory.getNode(sessionNode.id)
      const retrievedTaskNode = graphMemory.getNode(taskNode.id)

      expect(retrievedSessionNode).toBeDefined()
      expect(retrievedSessionNode?.properties.sessionId).toBe(session.id)
      expect(retrievedTaskNode).toBeDefined()
      expect(retrievedTaskNode?.properties.taskId).toBe(task.id)

      // 验证边
      const neighbors = graphMemory.getNeighbors(sessionNode.id)
      expect(neighbors.length).toBe(1)
      expect(neighbors[0].node.id).toBe(taskNode.id)
    })

    it('应该能通过 Session ID 查找相关节点', () => {
      // 添加多个与 Session 相关的节点
      const sessionNode: GraphNode = {
        id: `session_${session.id}`,
        type: 'session',
        label: session.title,
        properties: { sessionId: session.id },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const fileNode1: GraphNode = {
        id: 'file-session-1',
        type: 'file',
        label: 'session-file-1.ts',
        properties: { sessionId: session.id, path: 'src/file1.ts' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const fileNode2: GraphNode = {
        id: 'file-session-2',
        type: 'file',
        label: 'session-file-2.ts',
        properties: { sessionId: session.id, path: 'src/file2.ts' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      graphMemory.addNode(sessionNode)
      graphMemory.addNode(fileNode1)
      graphMemory.addNode(fileNode2)

      // 查找与 Session 相关的所有节点
      const sessionRelatedNodes = graphMemory.findNodes(
        node => node.properties.sessionId === session.id
      )

      expect(sessionRelatedNodes.length).toBe(3)
      expect(sessionRelatedNodes.map(n => n.id)).toContain(sessionNode.id)
      expect(sessionRelatedNodes.map(n => n.id)).toContain(fileNode1.id)
      expect(sessionRelatedNodes.map(n => n.id)).toContain(fileNode2.id)
    })
  })

  describe('2. 代码理解集成测试', () => {
    it('应该能表示代码结构和依赖关系', () => {
      // 模拟代码仓库结构
      const fileNodes: GraphNode[] = [
        {
          id: 'file-index',
          type: 'file',
          label: 'index.ts',
          properties: { path: 'src/index.ts', importance: 90 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'file-utils',
          type: 'file',
          label: 'utils.ts',
          properties: { path: 'src/utils.ts', importance: 80 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'file-types',
          type: 'file',
          label: 'types.ts',
          properties: { path: 'src/types.ts', importance: 70 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]

      const symbolNodes: GraphNode[] = [
        {
          id: 'func-calculate',
          type: 'function',
          label: 'calculateSum',
          properties: { filePath: 'src/utils.ts', line: 10, signature: 'function calculateSum(a: number, b: number): number' },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'interface-response',
          type: 'interface',
          label: 'ApiResponse',
          properties: { filePath: 'src/types.ts', line: 15, signature: 'interface ApiResponse<T>' },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]

      // 添加所有节点
      ;[...fileNodes, ...symbolNodes].forEach(node => graphMemory.addNode(node))

      // 添加依赖边
      const dependencyEdges = [
        {
          id: 'edge-index-utils',
          sourceId: 'file-index',
          targetId: 'file-utils',
          type: 'imports',
          properties: { weight: 0.8, description: 'index.ts 导入 utils.ts' }
        },
        {
          id: 'edge-utils-types',
          sourceId: 'file-utils',
          targetId: 'file-types',
          type: 'imports',
          properties: { weight: 0.7, description: 'utils.ts 导入 types.ts' }
        },
        {
          id: 'edge-file-func',
          sourceId: 'file-utils',
          targetId: 'func-calculate',
          type: 'contains',
          properties: { weight: 0.9, description: 'utils.ts 包含 calculateSum 函数' }
        },
        {
          id: 'edge-file-interface',
          sourceId: 'file-types',
          targetId: 'interface-response',
          type: 'contains',
          properties: { weight: 0.9, description: 'types.ts 包含 ApiResponse 接口' }
        }
      ]

      dependencyEdges.forEach(edge => {
        graphMemory.addEdge({
          ...edge,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      })

      // 验证图结构
      const graph = graphMemory.getGraph()
      expect(graph.nodes.size).toBe(5)
      expect(graph.edges.size).toBe(4)

      // 验证文件依赖链
      const indexNeighbors = graphMemory.getNeighbors('file-index')
      expect(indexNeighbors.length).toBe(1)
      expect(indexNeighbors[0].node.id).toBe('file-utils')

      const utilsNeighbors = graphMemory.getNeighbors('file-utils')
      expect(utilsNeighbors.length).toBe(3) // 来自 index.ts 的入边，到 types.ts 的出边，到 func-calculate 的出边

      // 验证符号包含关系
      const fileUtilsNodes = graphMemory.findNodes(
        node => node.type === 'file' && node.properties.path === 'src/utils.ts'
      )
      expect(fileUtilsNodes.length).toBe(1)

      const utilsSymbols = graphMemory.findNodes(
        node => node.type === 'function' && node.properties.filePath === 'src/utils.ts'
      )
      expect(utilsSymbols.length).toBe(1)
      expect(utilsSymbols[0].label).toBe('calculateSum')
    })
  })

  describe('3. 热点区域集成测试', () => {
    it('应该能标识和关联热点区域', () => {
      // 创建热点节点
      const hotspotNode: GraphNode = {
        id: 'hotspot-complex',
        type: 'hotspot',
        label: '复杂逻辑区域',
        properties: {
          type: 'complex',
          severity: 8,
          bugProneness: 75,
          description: '包含多层嵌套和复杂条件判断的区域'
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // 创建相关文件节点
      const affectedFiles: GraphNode[] = [
        {
          id: 'file-complex-1',
          type: 'file',
          label: 'complexLogic.ts',
          properties: { path: 'src/logic/complexLogic.ts', complexity: 85 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'file-complex-2',
          type: 'file',
          label: 'utils.ts',
          properties: { path: 'src/utils.ts', complexity: 70 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]

      graphMemory.addNode(hotspotNode)
      affectedFiles.forEach(file => graphMemory.addNode(file))

      // 创建热点到文件的边
      affectedFiles.forEach((file, index) => {
        graphMemory.addEdge({
          id: `edge-hotspot-${index}`,
          sourceId: hotspotNode.id,
          targetId: file.id,
          type: 'affects',
          properties: {
            weight: 0.8 - index * 0.1, // 第一个文件影响更大
            description: `热点影响 ${file.label}`
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      })

      // 验证热点关联
      const hotspotNeighbors = graphMemory.getNeighbors(hotspotNode.id)
      expect(hotspotNeighbors.length).toBe(2)

      const affectedFileIds = hotspotNeighbors.map(n => n.node.id)
      expect(affectedFileIds).toContain('file-complex-1')
      expect(affectedFileIds).toContain('file-complex-2')

      // 验证热点属性
      const retrievedHotspot = graphMemory.getNode(hotspotNode.id)
      expect(retrievedHotspot?.properties.severity).toBe(8)
      expect(retrievedHotspot?.properties.bugProneness).toBe(75)
    })
  })

  describe('4. 图查询和导航测试', () => {
    beforeEach(() => {
      // 设置测试图数据
      const nodes: GraphNode[] = [
        { id: 'file-a', type: 'file', label: 'a.ts', properties: { path: 'src/a.ts' }, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'file-b', type: 'file', label: 'b.ts', properties: { path: 'src/b.ts' }, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'file-c', type: 'file', label: 'c.ts', properties: { path: 'src/c.ts' }, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'func-x', type: 'function', label: 'funcX', properties: { filePath: 'src/a.ts' }, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'func-y', type: 'function', label: 'funcY', properties: { filePath: 'src/b.ts' }, createdAt: Date.now(), updatedAt: Date.now() }
      ]

      const edges = [
        { id: 'edge-ab', sourceId: 'file-a', targetId: 'file-b', type: 'imports', properties: {} },
        { id: 'edge-bc', sourceId: 'file-b', targetId: 'file-c', type: 'imports', properties: {} },
        { id: 'edge-a-func', sourceId: 'file-a', targetId: 'func-x', type: 'contains', properties: {} },
        { id: 'edge-b-func', sourceId: 'file-b', targetId: 'func-y', type: 'contains', properties: {} }
      ]

      nodes.forEach(node => graphMemory.addNode(node))
      edges.forEach(edge => {
        graphMemory.addEdge({
          ...edge,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      })
    })

    it('应该能按类型查询节点', () => {
      const fileNodes = graphMemory.findNodes(node => node.type === 'file')
      expect(fileNodes.length).toBe(3)

      const functionNodes = graphMemory.findNodes(node => node.type === 'function')
      expect(functionNodes.length).toBe(2)
    })

    it('应该能按属性查询节点', () => {
      const nodesWithPath = graphMemory.findNodes(
        node => node.properties.path && node.properties.path.includes('src/')
      )
      expect(nodesWithPath.length).toBe(3)

      const nodesFromFileA = graphMemory.findNodes(
        node => node.properties.filePath === 'src/a.ts'
      )
      expect(nodesFromFileA.length).toBe(1)
      expect(nodesFromFileA[0].id).toBe('func-x')
    })

    it('应该能追踪依赖链', () => {
      // 从 file-a 开始追踪依赖
      const startNodeId = 'file-a'
      const visited = new Set<string>()
      const dependencyChain: string[] = []

      const traverse = (nodeId: string) => {
        if (visited.has(nodeId)) return
        visited.add(nodeId)
        dependencyChain.push(nodeId)

        const neighbors = graphMemory.getNeighbors(nodeId)
        for (const { node, edge } of neighbors) {
          if (edge.type === 'imports' && edge.sourceId === nodeId) {
            traverse(node.id)
          }
        }
      }

      traverse(startNodeId)

      expect(dependencyChain).toContain('file-a')
      expect(dependencyChain).toContain('file-b')
      expect(dependencyChain).toContain('file-c')
      expect(dependencyChain.length).toBe(3)
    })

    it('应该能获取图的统计信息', () => {
      const graph = graphMemory.getGraph()
      const metadata = graph.metadata

      expect(metadata.nodeCount).toBe(5)
      expect(metadata.edgeCount).toBe(4)
      expect(metadata.statistics.byNodeType.file).toBe(3)
      expect(metadata.statistics.byNodeType.function).toBe(2)
      expect(metadata.statistics.byEdgeType.imports).toBe(2)
      expect(metadata.statistics.byEdgeType.contains).toBe(2)
      expect(metadata.statistics.avgNodeDegree).toBeGreaterThan(0)
    })
  })

  describe('5. 实际场景模拟', () => {
    it('应该模拟实际开发场景的图构建', () => {
      // 模拟一个实际开发场景
      const scenarioGraph = new GraphMemoryImpl('scenario-session')

      // 1. 项目结构
      const projectNodes: GraphNode[] = [
        { id: 'dir-src', type: 'directory', label: 'src', properties: { path: 'src' }, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'file-main', type: 'file', label: 'main.ts', properties: { path: 'src/main.ts' }, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'file-utils', type: 'file', label: 'utils.ts', properties: { path: 'src/utils.ts' }, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'file-api', type: 'file', label: 'api.ts', properties: { path: 'src/api.ts' }, createdAt: Date.now(), updatedAt: Date.now() }
      ]

      // 2. 代码符号
      const symbolNodes: GraphNode[] = [
        { id: 'func-process', type: 'function', label: 'processData', properties: { filePath: 'src/utils.ts' }, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'class-service', type: 'class', label: 'ApiService', properties: { filePath: 'src/api.ts' }, createdAt: Date.now(), updatedAt: Date.now() }
      ]

      // 3. 开发任务
      const taskNode: GraphNode = {
        id: 'task-feature',
        type: 'task',
        label: '实现新功能',
        properties: { description: '添加数据验证功能' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // 添加所有节点
      ;[...projectNodes, ...symbolNodes, taskNode].forEach(node => scenarioGraph.addNode(node))

      // 添加关系边
      const edges = [
        { id: 'edge-dir-file', sourceId: 'dir-src', targetId: 'file-main', type: 'contains', properties: {} },
        { id: 'edge-main-utils', sourceId: 'file-main', targetId: 'file-utils', type: 'imports', properties: {} },
        { id: 'edge-utils-api', sourceId: 'file-utils', targetId: 'file-api', type: 'imports', properties: {} },
        { id: 'edge-file-func', sourceId: 'file-utils', targetId: 'func-process', type: 'contains', properties: {} },
        { id: 'edge-file-class', sourceId: 'file-api', targetId: 'class-service', type: 'contains', properties: {} },
        { id: 'edge-task-utils', sourceId: 'task-feature', targetId: 'file-utils', type: 'affects', properties: { description: '任务影响 utils.ts' } }
      ]

      edges.forEach(edge => {
        scenarioGraph.addEdge({
          ...edge,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      })

      // 验证场景图
      const graph = scenarioGraph.getGraph()
      console.log(`场景图: ${graph.nodes.size} 节点, ${graph.edges.size} 边`)

      expect(graph.nodes.size).toBe(7)
      expect(graph.edges.size).toBe(6)

      // 验证任务相关文件
      const taskNeighbors = scenarioGraph.getNeighbors('task-feature')
      expect(taskNeighbors.length).toBe(1)
      expect(taskNeighbors[0].node.id).toBe('file-utils')

      // 验证依赖链
      const mainImports = scenarioGraph.findEdges(edge => edge.sourceId === 'file-main' && edge.type === 'imports')
      expect(mainImports.length).toBe(1)
      expect(mainImports[0].targetId).toBe('file-utils')
    })
  })
})