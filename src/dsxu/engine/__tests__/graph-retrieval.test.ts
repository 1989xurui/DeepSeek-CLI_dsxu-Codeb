/**
 * Graph Retrieval 测试 (F-2)
 *
 * 测试 Graph Retrieval 的核心功能
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { GraphRetrievalImpl } from '../retrieval/graph-retrieval'
import type { GraphMemoryImpl } from '../graph/graph-memory'
import type { RetrievalQuery, RetrievedSubgraph } from '../retrieval/types'

// 模拟 GraphMemoryImpl
const mockGraphMemory = {
  getNode: mock(() => ({
    id: 'test-file',
    type: 'file',
    label: 'test.ts',
    properties: { path: 'src/test.ts' },
    createdAt: Date.now(),
    updatedAt: Date.now()
  })),
  findNodes: mock(() => [
    {
      id: 'test-file',
      type: 'file',
      label: 'test.ts',
      properties: { path: 'src/test.ts' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]),
  getNeighbors: mock(() => [
    {
      node: {
        id: 'related-file',
        type: 'file',
        label: 'related.ts',
        properties: { path: 'src/related.ts' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      edge: {
        id: 'edge-import',
        sourceId: 'test-file',
        targetId: 'related-file',
        type: 'imports',
        properties: { weight: 0.8 },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    }
  ])
} as unknown as GraphMemoryImpl

describe('Graph Retrieval 测试 (F-2)', () => {
  let graphRetrieval: GraphRetrievalImpl

  beforeEach(() => {
    graphRetrieval = new GraphRetrievalImpl(mockGraphMemory)
  })

  describe('1. 基础功能测试', () => {
    it('应该能创建 GraphRetrievalImpl 实例', () => {
      expect(graphRetrieval).toBeDefined()
      expect(graphRetrieval).toBeInstanceOf(GraphRetrievalImpl)
    })

    it('应该能获取性能指标', () => {
      const metrics = graphRetrieval.getMetrics()
      expect(metrics).toBeDefined()
      expect(metrics.retrievalCount).toBe(0)
      expect(metrics.avgRetrievalTime).toBe(0)
      expect(metrics.cacheHitRate).toBe(0)
    })
  })

  describe('2. 按文件检索测试', () => {
    it('应该能执行按文件检索', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test-file'],
        filters: {
          nodeTypes: ['file', 'function']
        }
      }

      const result = await graphRetrieval.retrieve(query)

      expect(result).toBeDefined()
      expect(result.query).toEqual(query)
      expect(result.nodes).toBeDefined()
      expect(result.edges).toBeDefined()
      expect(result.statistics).toBeDefined()
      expect(result.summary).toBeDefined()
    })

    it('应该能处理多个目标文件', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['file1', 'file2', 'file3'],
        filters: {
          maxDistance: 2
        }
      }

      const result = await graphRetrieval.retrieve(query)

      expect(result).toBeDefined()
      expect(result.query.targetIds).toHaveLength(3)
    })
  })

  describe('3. 按符号检索测试', () => {
    it('应该能执行按符号检索', async () => {
      const query: RetrievalQuery = {
        queryType: 'symbol',
        targetIds: ['test-function'],
        filters: {
          nodeTypes: ['function', 'class']
        }
      }

      const result = await graphRetrieval.retrieve(query)

      expect(result).toBeDefined()
      expect(result.query.queryType).toBe('symbol')
    })
  })

  describe('4. 缓存功能测试', () => {
    it('应该能缓存检索结果', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test-file']
      }

      // 第一次检索
      const result1 = await graphRetrieval.retrieve(query)

      // 第二次检索（应该使用缓存）
      const result2 = await graphRetrieval.retrieve(query)

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()

      // 检查缓存命中率
      const metrics = graphRetrieval.getMetrics()
      expect(metrics.cacheHitRate).toBeGreaterThan(0)
    })

    it('应该能清空缓存', () => {
      graphRetrieval.clearCache()
      const metrics = graphRetrieval.getMetrics()
      expect(metrics.cacheHitRate).toBe(0)
    })
  })

  describe('5. 性能指标测试', () => {
    it('应该能跟踪检索性能', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test-file']
      }

      const startMetrics = graphRetrieval.getMetrics()
      expect(startMetrics.retrievalCount).toBe(0)

      await graphRetrieval.retrieve(query)

      const endMetrics = graphRetrieval.getMetrics()
      expect(endMetrics.retrievalCount).toBe(1)
      // avgRetrievalTime 可能为0如果检索太快，但检索计数应该增加
      expect(endMetrics.avgRetrievalTime).toBeGreaterThanOrEqual(0)
    })

    it('应该能按查询类型统计', async () => {
      const fileQuery: RetrievalQuery = {
        queryType: 'file',
        targetIds: ['test-file']
      }

      const symbolQuery: RetrievalQuery = {
        queryType: 'symbol',
        targetIds: ['test-function']
      }

      await graphRetrieval.retrieve(fileQuery)
      await graphRetrieval.retrieve(symbolQuery)

      const metrics = graphRetrieval.getMetrics()
      expect(metrics.byQueryType.file).toBe(1)
      expect(metrics.byQueryType.symbol).toBe(1)
    })
  })

  describe('6. 错误处理测试', () => {
    it('应该能处理空目标ID', async () => {
      const query: RetrievalQuery = {
        queryType: 'file',
        targetIds: []
      }

      const result = await graphRetrieval.retrieve(query)

      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(0)
      expect(result.edges).toHaveLength(0)
    })

    it('应该能处理不存在的目标', async () => {
      // 临时修改mock以返回空结果
      const originalGetNode = mockGraphMemory.getNode
      const originalFindNodes = mockGraphMemory.findNodes

      mockGraphMemory.getNode = mock(() => undefined)
      mockGraphMemory.findNodes = mock(() => []) // 返回空数组

      try {
        const query: RetrievalQuery = {
          queryType: 'file',
          targetIds: ['non-existent-file']
        }

        const result = await graphRetrieval.retrieve(query)

        expect(result).toBeDefined()
        // 应该返回空结果
        expect(result.statistics.totalNodes).toBe(0)
      } finally {
        // 恢复原始mock
        mockGraphMemory.getNode = originalGetNode
        mockGraphMemory.findNodes = originalFindNodes
      }
    })
  })

  describe('7. 集成场景测试', () => {
    it('应该能模拟实际检索场景', async () => {
      // 模拟一个实际开发场景的查询
      const queries: RetrievalQuery[] = [
        {
          queryType: 'file',
          targetIds: ['src/main.ts'],
          filters: {
            nodeTypes: ['file', 'function', 'class'],
            maxDistance: 2
          }
        },
        {
          queryType: 'symbol',
          targetIds: ['calculateSum'],
          filters: {
            nodeTypes: ['function', 'class']
          }
        },
        {
          queryType: 'task',
          targetIds: ['task-123'],
          filters: {
            nodeTypes: ['task', 'file', 'session']
          }
        }
      ]

      for (const query of queries) {
        const result = await graphRetrieval.retrieve(query)
        expect(result).toBeDefined()
        expect(result.query).toEqual(query)

        // 验证结果结构
        expect(result.id).toBeDefined()
        expect(result.nodes).toBeDefined()
        expect(result.edges).toBeDefined()
        expect(result.statistics).toBeDefined()
        expect(result.createdAt).toBeGreaterThan(0)
      }

      // 验证总体性能指标
      const metrics = graphRetrieval.getMetrics()
      expect(metrics.retrievalCount).toBe(3)
      expect(metrics.byQueryType.file).toBe(1)
      expect(metrics.byQueryType.symbol).toBe(1)
      expect(metrics.byQueryType.task).toBe(1)
    })
  })
})