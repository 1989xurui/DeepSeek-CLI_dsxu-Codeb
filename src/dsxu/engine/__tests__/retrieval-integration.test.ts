/**
 * Graph Retrieval 集成测试 (F-2)
 *
 * 测试完整的 Graph Retrieval 和 Context Routing 集成
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { createGraphRetrievalSystem } from '../retrieval'
import type { GraphMemoryImpl } from '../graph/graph-memory'
import type { RetrievalQuery, RoutingContext } from '../retrieval/types'

// 模拟 GraphMemoryImpl
const createMockGraphMemory = () => {
  const nodes = [
    {
      id: 'file-main',
      type: 'file',
      label: 'main.ts',
      properties: { path: 'src/main.ts', importance: 90 },
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
      id: 'file-test',
      type: 'file',
      label: 'test.ts',
      properties: { path: 'src/test.ts', isTest: true },
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'func-calculate',
      type: 'function',
      label: 'calculateSum',
      properties: { filePath: 'src/utils.ts', signature: 'function calculateSum(a: number, b: number): number' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'class-service',
      type: 'class',
      label: 'ApiService',
      properties: { filePath: 'src/main.ts', complexity: 75 },
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'task-feature',
      type: 'task',
      label: '实现新功能',
      properties: { taskId: 'task-123', description: '添加数据验证' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]

  const edges = [
    {
      id: 'edge-import',
      sourceId: 'file-main',
      targetId: 'file-utils',
      type: 'imports',
      properties: { weight: 0.8, description: 'main.ts 导入 utils.ts' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'edge-contains-func',
      sourceId: 'file-utils',
      targetId: 'func-calculate',
      type: 'contains',
      properties: { weight: 0.9, description: 'utils.ts 包含 calculateSum 函数' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'edge-contains-class',
      sourceId: 'file-main',
      targetId: 'class-service',
      type: 'contains',
      properties: { weight: 0.9, description: 'main.ts 包含 ApiService 类' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'edge-task-file',
      sourceId: 'task-feature',
      targetId: 'file-utils',
      type: 'affects',
      properties: { weight: 0.7, description: '任务影响 utils.ts' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]

  return {
    getNode: mock((id: string) => nodes.find(n => n.id === id)),
    findNodes: mock((predicate: (node: any) => boolean) => nodes.filter(predicate)),
    getNeighbors: mock((nodeId: string) => {
      const nodeEdges = edges.filter(e => e.sourceId === nodeId || e.targetId === nodeId)
      return nodeEdges.map(edge => {
        const isSource = edge.sourceId === nodeId
        const neighborId = isSource ? edge.targetId : edge.sourceId
        const neighbor = nodes.find(n => n.id === neighborId)
        return {
          node: neighbor!,
          edge
        }
      }).filter(item => item.node) // 过滤掉找不到的邻居
    })
  } as unknown as GraphMemoryImpl
}

describe('Graph Retrieval 集成测试 (F-2)', () => {
  let mockGraphMemory: GraphMemoryImpl
  let retrievalSystem: ReturnType<typeof createGraphRetrievalSystem>

  beforeEach(() => {
    mockGraphMemory = createMockGraphMemory()
    retrievalSystem = createGraphRetrievalSystem(mockGraphMemory)
  })

  describe('1. 系统创建测试', () => {
    it('应该能创建完整的检索系统', () => {
      expect(retrievalSystem).toBeDefined()
      expect(retrievalSystem.graphRetrieval).toBeDefined()
      expect(retrievalSystem.contextRouting).toBeDefined()
      expect(retrievalSystem.retrieve).toBeDefined()
      expect(retrievalSystem.routeContext).toBeDefined()
      expect(retrievalSystem.getVersion).toBeDefined()
      expect(retrievalSystem.getStats).toBeDefined()
    })

    it('应该能获取系统版本', () => {
      const version = retrievalSystem.getVersion()
      expect(version).toContain('F-2 Graph Retrieval & Context Routing')
    })

    it('应该能获取系统统计', () => {
      const stats = retrievalSystem.getStats()
      expect(stats).toBeDefined()
      expect(stats.retrieval).toBeDefined()
      expect(stats.routing).toBeDefined()
    })
  })

  describe('2. 完整工作流测试', () => {
    it('应该能执行完整的检索和路由工作流', async () => {
      // 1. 执行文件检索
      const fileQuery: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['file-main'],
        filters: {
          nodeTypes: ['file', 'function', 'class'],
          maxDistance: 2
        }
      }

      const fileResult = await retrievalSystem.retrieve(fileQuery)
      expect(fileResult).toBeDefined()
      expect(fileResult.query).toEqual(fileQuery)
      expect(fileResult.nodes.length).toBeGreaterThan(0)

      // 2. 执行符号检索
      const symbolQuery: RetrievalQuery = {
        queryType: 'symbol',
        targetIds: ['func-calculate'],
        filters: {
          nodeTypes: ['function', 'file']
        }
      }

      const symbolResult = await retrievalSystem.retrieve(symbolQuery)
      expect(symbolResult).toBeDefined()
      expect(symbolResult.query.queryType).toBe('symbol')

      // 3. 执行任务检索
      const taskQuery: RetrievalQuery = {
        queryType: 'task',
        targetIds: ['task-feature'],
        filters: {
          nodeTypes: ['task', 'file']
        }
      }

      const taskResult = await retrievalSystem.retrieve(taskQuery)
      expect(taskResult).toBeDefined()
      expect(taskResult.query.queryType).toBe('task')
    })

    it('应该能执行带上下文的路由', async () => {
      const context: RoutingContext = {
        sessionId: 'integration-session',
        taskId: 'integration-task',
        currentFile: 'src/main.ts',
        userIntent: '代码审查和优化'
      }

      const queries: RetrievalQuery[] = [
        {
          queryType: 'file',
          targetIds: ['file-main'],
          context: {
            sessionId: context.sessionId,
            taskId: context.taskId
          }
        },
        {
          queryType: 'symbol',
          targetIds: ['func-calculate'],
          context: {
            currentFile: context.currentFile
          }
        }
      ]

      for (const query of queries) {
        const bundle = await retrievalSystem.routeContext(query, context)

        expect(bundle).toBeDefined()
        expect(bundle.metadata.sessionId).toBe(context.sessionId)
        expect(bundle.metadata.taskId).toBe(context.taskId)
        expect(bundle.target).toBeDefined()
        expect(bundle.priority).toBeGreaterThan(0)

        // 验证路由决策
        expect(bundle.instructions).toBeDefined()
        expect(bundle.subgraph).toBeDefined()
      }
    })
  })

  describe('3. 智能路由场景测试', () => {
    it('应该能将测试相关检索路由到 verify-gate', async () => {
      const testQuery: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['file-test']
      }

      const bundle = await retrievalSystem.routeContext(testQuery)

      // 包含测试节点的检索应该路由到 verify-gate
      expect(bundle.target).toBe('verify-gate')
      expect(bundle.priority).toBeGreaterThanOrEqual(8)
    })

    it('应该将复杂结构检索路由到 context-builder', async () => {
      const complexQuery: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['file-main']
      }

      const bundle = await retrievalSystem.routeContext(complexQuery)

      // 包含类等复杂结构的检索应该路由到 context-builder
      expect(['context-builder', 'query-loop']).toContain(bundle.target)
    })

    it('应该将任务检索路由到 context-builder', async () => {
      const taskQuery: RetrievalQuery = {
        queryType: 'task',
        targetIds: ['task-feature']
      }

      const bundle = await retrievalSystem.routeContext(taskQuery)

      // 任务检索应该路由到 context-builder
      expect(bundle.target).toBe('context-builder')
    })
  })

  describe('4. 性能指标集成测试', () => {
    it('应该能跟踪完整的性能指标', async () => {
      const initialStats = retrievalSystem.getStats()
      expect(initialStats.retrieval.retrievalCount).toBe(0)
      expect(initialStats.routing.totalRoutes).toBe(0)

      // 执行多个检索和路由
      const queries: RetrievalQuery[] = [
        { queryType: 'file', targetIds: ['file-main'] },
        { queryType: 'symbol', targetIds: ['func-calculate'] },
        { queryType: 'task', targetIds: ['task-feature'] }
      ]

      for (const query of queries) {
        await retrievalSystem.retrieve(query)
        await retrievalSystem.routeContext(query)
      }

      const finalStats = retrievalSystem.getStats()

      expect(finalStats.retrieval.retrievalCount).toBe(3)
      expect(finalStats.routing.totalRoutes).toBe(3)
      expect(finalStats.retrieval.avgRetrievalTime).toBeGreaterThan(0)
      expect(finalStats.routing.avgPriority).toBeGreaterThan(0)

      // 验证查询类型统计
      expect(finalStats.retrieval.byQueryType.file).toBe(1)
      expect(finalStats.retrieval.byQueryType.symbol).toBe(1)
      expect(finalStats.retrieval.byQueryType.task).toBe(1)

      // 验证路由目标统计
      expect(Object.values(finalStats.routing.byTarget).reduce((a, b) => a + b, 0)).toBe(3)
    })

    it('应该能处理缓存命中', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['file-main']
      }

      // 第一次检索和路由
      await retrievalSystem.retrieve(query)
      await retrievalSystem.routeContext(query)

      const stats1 = retrievalSystem.getStats()
      expect(stats1.retrieval.retrievalCount).toBe(1)
      expect(stats1.routing.totalRoutes).toBe(1)

      // 第二次相同的查询（应该使用缓存）
      await retrievalSystem.retrieve(query)
      await retrievalSystem.routeContext(query)

      const stats2 = retrievalSystem.getStats()
      expect(stats2.retrieval.retrievalCount).toBe(2)
      expect(stats2.routing.totalRoutes).toBe(2)

      // 缓存命中率应该大于0
      expect(stats2.retrieval.cacheHitRate).toBeGreaterThan(0)
    })
  })

  describe('5. 错误处理集成测试', () => {
    it('应该能处理检索错误', async () => {
      // 创建会抛出错误的 GraphMemory
      const errorGraphMemory = {
        getNode: mock(() => { throw new Error('模拟 GraphMemory 错误') }),
        findNodes: mock(() => []),
        getNeighbors: mock(() => [])
      } as unknown as GraphMemoryImpl

      const errorSystem = createGraphRetrievalSystem(errorGraphMemory)

      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['non-existent']
      }

      // 检索应该处理错误并返回空结果
      const result = await errorSystem.retrieve(query)
      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(0)
      expect(result.statistics.totalNodes).toBe(0)
    })

    it('应该能处理路由错误', async () => {
      // 创建会抛出错误的 GraphRetrieval
      const errorGraphRetrieval = {
        retrieve: mock(async () => { throw new Error('模拟检索错误') })
      } as any

      const errorSystem = createGraphRetrievalSystem(mockGraphMemory)
      // 替换为错误的 GraphRetrieval
      errorSystem.graphRetrieval = errorGraphRetrieval
      errorSystem.retrieve = errorGraphRetrieval.retrieve

      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test']
      }

      // 路由应该处理错误并创建错误路由包
      const bundle = await errorSystem.routeContext(query)

      expect(bundle).toBeDefined()
      expect(bundle.target).toBe('recovery')
      expect(bundle.priority).toBe(1)
      expect(bundle.instructions).toContain('错误')
    })
  })

  describe('6. 实际开发场景模拟', () => {
    it('应该能模拟代码审查场景', async () => {
      const context: RoutingContext = {
        sessionId: 'code-review-session',
        taskId: 'review-pr-123',
        currentFile: 'src/utils.ts',
        userIntent: '审查 calculateSum 函数的实现',
        previousRoutes: []
      }

      // 模拟代码审查的查询序列
      const reviewWorkflow = [
        // 1. 查看当前文件
        {
          queryType: 'file',
          targetIds: ['file-utils'],
          filters: { nodeTypes: ['file', 'function'] }
        },
        // 2. 查看特定函数
        {
          queryType: 'symbol',
          targetIds: ['func-calculate'],
          filters: { nodeTypes: ['function', 'file'] }
        },
        // 3. 查看依赖文件
        {
          queryType: 'dependency',
          targetIds: ['file-utils'],
          filters: { maxDistance: 2 }
        },
        // 4. 查看相关测试
        {
          queryType: 'file',
          targetIds: ['file-test'],
          filters: { nodeTypes: ['file', 'test'] }
        }
      ]

      const bundles = []
      for (const query of reviewWorkflow) {
        const bundle = await retrievalSystem.routeContext(query as RetrievalQuery, context)
        bundles.push(bundle)

        // 更新上下文中的历史记录
        context.previousRoutes = [...(context.previousRoutes || []), bundle]
      }

      expect(bundles).toHaveLength(4)

      // 验证路由决策的合理性
      const targets = bundles.map(b => b.target)
      console.log('代码审查场景路由目标:', targets)

      // 应该包含合理的路由目标
      expect(targets).toContain('query-loop') // 快速分析
      expect(targets).toContain('context-builder') // 构建上下文
      expect(targets).toContain('verify-gate') // 测试验证

      // 验证统计信息
      const stats = retrievalSystem.getStats()
      expect(stats.retrieval.retrievalCount).toBe(4)
      expect(stats.routing.totalRoutes).toBe(4)

      // 验证缓存使用
      expect(stats.retrieval.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(stats.routing.cacheSize).toBeGreaterThan(0)
    })

    it('应该能模拟新功能开发场景', async () => {
      const context: RoutingContext = {
        sessionId: 'feature-dev-session',
        taskId: 'implement-feature-456',
        currentFile: 'src/main.ts',
        userIntent: '实现新的 API 端点',
        previousRoutes: []
      }

      // 模拟新功能开发的查询序列
      const developmentWorkflow = [
        // 1. 查看项目结构
        {
          queryType: 'file',
          targetIds: ['file-main'],
          filters: { nodeTypes: ['file', 'directory', 'class'] }
        },
        // 2. 查看相关工具函数
        {
          queryType: 'symbol',
          targetIds: ['func-calculate'],
          filters: { nodeTypes: ['function'] }
        },
        // 3. 查看任务上下文
        {
          queryType: 'task',
          targetIds: ['task-feature'],
          filters: { nodeTypes: ['task', 'file'] }
        },
        // 4. 分析代码热点
        {
          queryType: 'hotspot',
          targetIds: ['file-main'],
          filters: { nodeTypes: ['file', 'class', 'function'] }
        }
      ]

      for (const query of developmentWorkflow) {
        const bundle = await retrievalSystem.routeContext(query as RetrievalQuery, context)

        expect(bundle).toBeDefined()
        expect(bundle.metadata.sessionId).toBe(context.sessionId)
        expect(bundle.metadata.taskId).toBe(context.taskId)

        // 验证路由包包含有用的指令
        expect(bundle.instructions).toBeDefined()
        expect(bundle.instructions!.length).toBeGreaterThan(0)

        // 验证子图包含相关节点
        expect(bundle.subgraph.nodes.length).toBeGreaterThan(0)
        expect(bundle.subgraph.statistics.avgRelevance).toBeGreaterThan(0)
      }

      // 验证系统状态
      const stats = retrievalSystem.getStats()
      expect(stats.routing.byTarget['context-builder']).toBeGreaterThan(0) // 应该使用 context-builder
      expect(stats.routing.avgPriority).toBeGreaterThan(5) // 平均优先级应该较高
    })
  })

  describe('7. 系统稳定性测试', () => {
    it('应该能处理高并发请求', async () => {
      const concurrentQueries: RetrievalQuery[] = Array.from({ length: 10 }, (_, i) => ({
        queryType: i % 2 === 0 ? 'file' : 'symbol',
        targetIds: [`target-${i}`],
        filters: { nodeTypes: ['file', 'function'] }
      }))

      const promises = concurrentQueries.map(query =>
        retrievalSystem.routeContext(query, {
          sessionId: 'concurrent-session',
          taskId: 'concurrent-task'
        })
      )

      const bundles = await Promise.all(promises)

      expect(bundles).toHaveLength(10)
      bundles.forEach(bundle => {
        expect(bundle).toBeDefined()
        expect(bundle.id).toBeDefined()
        expect(bundle.target).toBeDefined()
      })

      // 验证系统统计
      const stats = retrievalSystem.getStats()
      expect(stats.routing.totalRoutes).toBe(10)
      expect(stats.retrieval.retrievalCount).toBe(10)
    })

    it('应该能处理长时间运行的工作流', async () => {
      // 模拟长时间运行的工作流
      const longRunningQueries: RetrievalQuery[] = Array.from({ length: 20 }, (_, i) => ({
        queryType: ['file', 'symbol', 'task', 'slice'][i % 4] as any,
        targetIds: [`long-target-${i}`],
        filters: { maxDistance: Math.min(3, i % 4 + 1) }
      }))

      const context: RoutingContext = {
        sessionId: 'long-running-session',
        taskId: 'long-running-task',
        userIntent: '长时间代码分析'
      }

      for (let i = 0; i < longRunningQueries.length; i++) {
        const query = longRunningQueries[i]
        const bundle = await retrievalSystem.routeContext(query, context)

        expect(bundle).toBeDefined()

        // 每5个查询检查一次系统状态
        if (i % 5 === 4) {
          const stats = retrievalSystem.getStats()
          expect(stats.routing.totalRoutes).toBe(i + 1)
          expect(stats.retrieval.retrievalCount).toBe(i + 1)

          // 缓存应该在工作
          expect(stats.retrieval.cacheHitRate).toBeGreaterThanOrEqual(0)
          expect(stats.routing.cacheSize).toBeGreaterThan(0)
        }
      }

      // 最终验证
      const finalStats = retrievalSystem.getStats()
      expect(finalStats.routing.totalRoutes).toBe(20)
      expect(finalStats.retrieval.retrievalCount).toBe(20)
      expect(finalStats.routing.avgPriority).toBeGreaterThan(0)

      // 验证各种路由目标都被使用
      const usedTargets = Object.entries(finalStats.routing.byTarget)
        .filter(([_, count]) => count > 0)
        .map(([target]) => target)

      expect(usedTargets.length).toBeGreaterThan(1) // 应该使用了多种路由目标
    })
  })
})