/**
 * Context Routing 测试 (F-2)
 *
 * 测试上下文路由功能
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { ContextRoutingImpl } from '../retrieval/context-routing'
import type { GraphRetrievalImpl } from '../retrieval/graph-retrieval'
import type { RetrievalQuery, RetrievedSubgraph } from '../retrieval/types'

// 模拟 GraphRetrievalImpl
const mockGraphRetrieval = {
  retrieve: mock(async (query: RetrievalQuery) => {
    // 模拟不同的检索结果
    const baseSubgraph: RetrievedSubgraph = {
      id: `subgraph_${Date.now()}`,
      query,
      nodes: [
        {
          node: {
            id: 'test-node',
            type: 'file',
            label: 'test.ts',
            properties: { path: 'src/test.ts' },
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          relevanceScore: 85,
          distance: 0,
          matchReasons: ['直接匹配']
        }
      ],
      edges: [],
      statistics: {
        totalNodes: 1,
        totalEdges: 0,
        avgRelevance: 85,
        maxRelevance: 85,
        retrievalTimeMs: 10
      },
      summary: '测试子图',
      createdAt: Date.now()
    }

    // 根据查询类型调整结果
    if (query.queryType === 'task') {
      baseSubgraph.nodes.push({
        node: {
          id: 'task-node',
          type: 'task',
          label: '测试任务',
          properties: { taskId: 'task-123' },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        relevanceScore: 90,
        distance: 0,
        matchReasons: ['任务匹配']
      })
      baseSubgraph.statistics.totalNodes = 2
      baseSubgraph.statistics.avgRelevance = 87.5
    }

    return baseSubgraph
  })
} as unknown as GraphRetrievalImpl

describe('Context Routing 测试 (F-2)', () => {
  let contextRouting: ContextRoutingImpl

  beforeEach(() => {
    contextRouting = new ContextRoutingImpl(mockGraphRetrieval)
  })

  describe('1. 基础功能测试', () => {
    it('应该能创建 ContextRoutingImpl 实例', () => {
      expect(contextRouting).toBeDefined()
      expect(contextRouting).toBeInstanceOf(ContextRoutingImpl)
    })

    it('应该能获取默认配置', () => {
      const routing = new ContextRoutingImpl(mockGraphRetrieval, {
        defaultTarget: 'context-builder',
        minRelevanceThreshold: 70
      })

      // 这里只是验证构造函数不抛出错误
      expect(routing).toBeDefined()
    })
  })

  describe('2. 路由执行测试', () => {
    it('应该能执行基本路由', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test-file']
      }

      const bundle = await contextRouting.routeContext(query)

      expect(bundle).toBeDefined()
      expect(bundle.id).toBeDefined()
      expect(bundle.target).toBeDefined()
      expect(bundle.priority).toBeGreaterThan(0)
      expect(bundle.subgraph).toBeDefined()
      expect(bundle.metadata).toBeDefined()
    })

    it('应该能使用路由上下文', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test-file']
      }

      const context = {
        sessionId: 'session-123',
        taskId: 'task-456',
        currentFile: 'src/main.ts'
      }

      const bundle = await contextRouting.routeContext(query, context)

      expect(bundle).toBeDefined()
      expect(bundle.metadata.sessionId).toBe('session-123')
      expect(bundle.metadata.taskId).toBe('task-456')
    })
  })

  describe('3. 智能路由决策测试', () => {
    it('应该能将高相关性小规模检索路由到 query-loop', async () => {
      // 模拟高相关性小规模结果
      const mockHighRelevanceRetrieval = {
        retrieve: mock(async () => ({
          id: 'high-relevance-subgraph',
          query: { queryType: 'file', targetIds: ['test'] },
          nodes: Array.from({ length: 5 }, (_, i) => ({
            node: {
              id: `node-${i}`,
              type: 'file',
              label: `file${i}.ts`,
              properties: {},
              createdAt: Date.now(),
              updatedAt: Date.now()
            },
            relevanceScore: 90 + i, // 高相关性
            distance: 0,
            matchReasons: ['高相关性']
          })),
          edges: [],
          statistics: {
            totalNodes: 5,
            totalEdges: 0,
            avgRelevance: 92,
            maxRelevance: 94,
            retrievalTimeMs: 10
          },
          summary: '高相关性小规模',
          createdAt: Date.now()
        }))
      } as unknown as GraphRetrievalImpl

      const routing = new ContextRoutingImpl(mockHighRelevanceRetrieval)
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test']
      }

      const bundle = await routing.routeContext(query)

      expect(bundle.target).toBe('query-loop')
      expect(bundle.priority).toBeGreaterThanOrEqual(9)
    })

    it('应该将包含测试节点的检索路由到 verify-gate', async () => {
      const mockTestRetrieval = {
        retrieve: mock(async () => ({
          id: 'test-subgraph',
          query: { queryType: 'file', targetIds: ['test'] },
          nodes: [
            {
              node: {
                id: 'test-node',
                type: 'test',
                label: '单元测试',
                properties: { isTest: true },
                createdAt: Date.now(),
                updatedAt: Date.now()
              },
              relevanceScore: 80,
              distance: 0,
              matchReasons: ['测试节点']
            }
          ],
          edges: [],
          statistics: {
            totalNodes: 1,
            totalEdges: 0,
            avgRelevance: 80,
            maxRelevance: 80,
            retrievalTimeMs: 10
          },
          summary: '包含测试',
          createdAt: Date.now()
        }))
      } as unknown as GraphRetrievalImpl

      const routing = new ContextRoutingImpl(mockTestRetrieval)
      const bundle = await routing.routeContext({
        queryType: 'file',
        targetIds: ['test']
      })

      expect(bundle.target).toBe('verify-gate')
    })

    it('应该将包含"test"或"Test"在节点ID中的检索路由到 verify-gate', async () => {
      const mockTestIdRetrieval = {
        retrieve: mock(async () => ({
          id: 'test-id-subgraph',
          query: { queryType: 'file', targetIds: ['test'] },
          nodes: [
            {
              node: {
                id: 'myTestFile',
                type: 'file',
                label: '测试文件',
                properties: { path: 'src/myTestFile.ts' },
                createdAt: Date.now(),
                updatedAt: Date.now()
              },
              relevanceScore: 85,
              distance: 0,
              matchReasons: ['文件名匹配']
            },
            {
              node: {
                id: 'TestComponent',
                type: 'component',
                label: '测试组件',
                properties: { componentType: 'test' },
                createdAt: Date.now(),
                updatedAt: Date.now()
              },
              relevanceScore: 80,
              distance: 0,
              matchReasons: ['组件匹配']
            }
          ],
          edges: [],
          statistics: {
            totalNodes: 2,
            totalEdges: 0,
            avgRelevance: 82.5,
            maxRelevance: 85,
            retrievalTimeMs: 10
          },
          summary: '包含test/Test在ID中',
          createdAt: Date.now()
        }))
      } as unknown as GraphRetrievalImpl

      const routing = new ContextRoutingImpl(mockTestIdRetrieval)
      const bundle = await routing.routeContext({
        queryType: 'file',
        targetIds: ['test']
      })

      expect(bundle.target).toBe('verify-gate')
    })
  })

  describe('4. 批量路由测试', () => {
    it('应该能执行批量路由', async () => {
      const queries: RetrievalQuery[] = [
        {
          queryType: 'file',
          targetIds: ['file1']
        },
        {
          queryType: 'symbol',
          targetIds: ['func1']
        },
        {
          queryType: 'task',
          targetIds: ['task1']
        }
      ]

      const bundles = await contextRouting.batchRouteContext(queries)

      expect(bundles).toBeDefined()
      expect(bundles).toHaveLength(3)

      // 验证每个路由包
      bundles.forEach((bundle, index) => {
        expect(bundle).toBeDefined()
        expect(bundle.id).toBeDefined()
        expect(bundle.target).toBeDefined()
        expect(bundle.subgraph.query).toEqual(queries[index])
      })
    })

    it('应该能处理批量路由中的错误', async () => {
      const mockErrorRetrieval = {
        retrieve: mock(async (query: RetrievalQuery) => {
          if (query.queryType === 'error') {
            throw new Error('模拟检索错误')
          }
          return {
            id: 'normal-subgraph',
            query,
            nodes: [],
            edges: [],
            statistics: {
              totalNodes: 0,
              totalEdges: 0,
              avgRelevance: 0,
              maxRelevance: 0,
              retrievalTimeMs: 10
            },
            summary: '正常结果',
            createdAt: Date.now()
          }
        })
      } as unknown as GraphRetrievalImpl

      const routing = new ContextRoutingImpl(mockErrorRetrieval)
      const queries: RetrievalQuery[] = [
        {
          queryType: 'file',
          targetIds: ['file1']
        },
        {
          queryType: 'error', // 这个会出错
          targetIds: ['error']
        },
        {
          queryType: 'symbol',
          targetIds: ['func1']
        }
      ]

      const bundles = await routing.batchRouteContext(queries)

      // 应该仍然返回3个路由包
      expect(bundles).toHaveLength(3)

      // 错误的路由包应该指向 recovery
      const errorBundle = bundles.find(b => b.subgraph.query.queryType === 'error')
      expect(errorBundle).toBeDefined()
      expect(errorBundle!.target).toBe('recovery')
      expect(errorBundle!.priority).toBe(1)
    })
  })

  describe('5. 缓存功能测试', () => {
    it('应该能缓存路由结果', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test-file']
      }

      // 第一次路由
      const bundle1 = await contextRouting.routeContext(query)

      // 第二次路由（应该使用缓存）
      const bundle2 = await contextRouting.routeContext(query)

      expect(bundle1).toBeDefined()
      expect(bundle2).toBeDefined()

      // 验证缓存统计
      const stats = contextRouting.getRoutingStats()
      expect(stats.cacheSize).toBeGreaterThan(0)
    })

    it('应该能清空路由缓存', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test-file']
      }

      await contextRouting.routeContext(query)

      const statsBefore = contextRouting.getRoutingStats()
      expect(statsBefore.cacheSize).toBe(1)

      contextRouting.clearRoutingCache()

      const statsAfter = contextRouting.getRoutingStats()
      expect(statsAfter.cacheSize).toBe(0)
    })
  })

  describe('6. 路由历史测试', () => {
    it('应该能记录路由历史', async () => {
      const queries: RetrievalQuery[] = [
        {
          queryType: 'file',
          targetIds: ['file1']
        },
        {
          queryType: 'symbol',
          targetIds: ['func1']
        }
      ]

      for (const query of queries) {
        await contextRouting.routeContext(query)
      }

      const history = contextRouting.getRoutingHistory()
      expect(history).toHaveLength(2)

      // 最新的应该在前
      expect(history[0].subgraph.query.queryType).toBe('symbol')
      expect(history[1].subgraph.query.queryType).toBe('file')
    })

    it('应该能限制历史记录数量', async () => {
      // 创建多个路由
      for (let i = 0; i < 10; i++) {
        await contextRouting.routeContext({
          queryType: 'file',
          targetIds: [`file${i}`]
        })
      }

      const fullHistory = contextRouting.getRoutingHistory()
      expect(fullHistory).toHaveLength(10)

      const limitedHistory = contextRouting.getRoutingHistory(5)
      expect(limitedHistory).toHaveLength(5)
    })
  })

  describe('7. 路由统计测试', () => {
    it('应该能获取路由统计信息', async () => {
      // 创建不同类型的路由
      const queries: RetrievalQuery[] = [
        { queryType: 'file', targetIds: ['file1'] },
        { queryType: 'file', targetIds: ['file2'] },
        { queryType: 'symbol', targetIds: ['func1'] },
        { queryType: 'task', targetIds: ['task1'] }
      ]

      for (const query of queries) {
        await contextRouting.routeContext(query)
      }

      const stats = contextRouting.getRoutingStats()

      expect(stats.totalRoutes).toBe(4)
      expect(stats.byTarget['query-loop']).toBeGreaterThan(0)
      expect(stats.avgPriority).toBeGreaterThan(0)
      expect(stats.cacheSize).toBe(4)
    })
  })

  describe('8. 实际场景模拟', () => {
    it('应该能模拟开发工作流的路由', async () => {
      // 模拟一个完整的开发工作流
      const workflowQueries: RetrievalQuery[] = [
        // 1. 查看文件结构
        {
          queryType: 'file',
          targetIds: ['src/main.ts'],
          filters: {
            nodeTypes: ['file', 'directory'],
            maxDistance: 1
          }
        },
        // 2. 查找特定函数
        {
          queryType: 'symbol',
          targetIds: ['calculateTotal'],
          filters: {
            nodeTypes: ['function', 'class']
          }
        },
        // 3. 查看任务上下文
        {
          queryType: 'task',
          targetIds: ['feature-implementation'],
          filters: {
            nodeTypes: ['task', 'file', 'session']
          }
        },
        // 4. 分析代码切片
        {
          queryType: 'slice',
          targetIds: ['complex-logic-area'],
          filters: {
            nodeTypes: ['file', 'function', 'class'],
            maxDistance: 2
          }
        }
      ]

      const context = {
        sessionId: 'dev-session-123',
        taskId: 'current-task-456',
        currentFile: 'src/main.ts',
        userIntent: '实现新功能'
      }

      const bundles = await contextRouting.batchRouteContext(workflowQueries, context)

      expect(bundles).toHaveLength(4)

      // 验证每个路由包都有正确的上下文
      bundles.forEach(bundle => {
        expect(bundle.metadata.sessionId).toBe('dev-session-123')
        expect(bundle.metadata.taskId).toBe('current-task-456')
        expect(bundle.metadata.triggeredBy).toBeDefined()

        // 验证路由决策
        expect(bundle.target).toBeDefined()
        expect(bundle.priority).toBeGreaterThan(0)
        expect(bundle.instructions).toBeDefined()
      })

      // 验证路由统计
      const stats = contextRouting.getRoutingStats()
      expect(stats.totalRoutes).toBe(4)
      expect(Object.values(stats.byTarget).reduce((a, b) => a + b, 0)).toBe(4)
    })
  })
})