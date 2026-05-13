/**
 * Graph Retrieval 集成示例 (F-2)
 *
 * 展示如何在现有系统中使用 Graph Retrieval 和 Context Routing
 */

import { createRuntimeCore } from '../runtime-core'
import type { RetrievalQuery, RoutingContext } from './types'

/**
 * 示例1: 在 Query Loop 中使用 Graph Retrieval
 */
export async function exampleQueryLoopIntegration() {
  console.log('=== 示例1: Query Loop 集成 ===')

  // 创建 Runtime Core 实例
  const runtime = createRuntimeCore({
    graph: {
      // Graph Memory 配置
      sessionId: 'example-session',
      enablePersistence: true
    }
  })

  // 检查 Graph Retrieval 是否可用
  if (!runtime.retrieval) {
    console.log('Graph Retrieval 不可用，跳过示例')
    return
  }

  // 模拟一个开发任务：查找与特定文件相关的代码
  const taskContext: RoutingContext = {
    sessionId: 'dev-session-123',
    taskId: 'implement-feature-456',
    currentFile: 'src/main.ts',
    userIntent: '实现新的API端点'
  }

  // 1. 执行文件检索
  const fileQuery: RetrievalQuery = {
    queryType: 'file',
    targetIds: ['src/main.ts'],
    filters: {
      nodeTypes: ['file', 'function', 'class'],
      maxDistance: 2
    }
  }

  console.log('执行文件检索...')
  const fileResult = await runtime.retrieval.retrieve(fileQuery)
  console.log(`检索结果: ${fileResult.statistics.totalNodes} 个节点, ${fileResult.statistics.totalEdges} 条边`)
  console.log(`平均相关性: ${fileResult.statistics.avgRelevance.toFixed(1)}`)

  // 2. 执行上下文路由
  console.log('\n执行上下文路由...')
  const routeBundle = await runtime.retrieval.routeContext(fileQuery, taskContext)
  console.log(`路由目标: ${routeBundle.target}`)
  console.log(`路由优先级: ${routeBundle.priority}`)
  console.log(`路由指令: ${routeBundle.instructions}`)

  // 3. 根据路由目标处理结果
  switch (routeBundle.target) {
    case 'query-loop':
      console.log('→ 发送到 Query Loop 进行快速处理')
      // 这里可以调用实际的 Query Loop 处理逻辑
      break
    case 'context-builder':
      console.log('→ 发送到 Context Builder 构建完整上下文')
      // 这里可以调用 Context Builder 处理逻辑
      break
    case 'verify-gate':
      console.log('→ 发送到 Verify Gate 进行验证')
      // 这里可以调用 Verify Gate 处理逻辑
      break
    case 'reviewer':
      console.log('→ 发送到 Reviewer 进行代码审查')
      // 这里可以调用 Reviewer 处理逻辑
      break
  }

  return routeBundle
}

/**
 * 示例2: 在 Context Builder 中使用 Graph Retrieval
 */
export async function exampleContextBuilderIntegration() {
  console.log('\n=== 示例2: Context Builder 集成 ===')

  const runtime = createRuntimeCore({
    graph: {
      sessionId: 'context-builder-session'
    }
  })

  if (!runtime.retrieval) {
    console.log('Graph Retrieval 不可用，跳过示例')
    return
  }

  // 模拟构建复杂代码上下文的场景
  const context: RoutingContext = {
    sessionId: 'code-review-session',
    taskId: 'review-complex-feature',
    userIntent: '理解复杂的代码依赖关系'
  }

  // 执行多类型检索
  const queries: RetrievalQuery[] = [
    {
      queryType: 'symbol',
      targetIds: ['ApiService', 'DataProcessor'],
      filters: { nodeTypes: ['class', 'interface'] }
    },
    {
      queryType: 'dependency',
      targetIds: ['src/main.ts'],
      filters: { maxDistance: 3 }
    },
    {
      queryType: 'hotspot',
      targetIds: ['complex-logic-area'],
      filters: { nodeTypes: ['file', 'function'] }
    }
  ]

  console.log('执行批量检索和路由...')
  const bundles = await runtime.retrieval.contextRouting.batchRouteContext(queries, context)

  console.log(`处理了 ${bundles.length} 个查询:`)
  bundles.forEach((bundle, index) => {
    console.log(`  ${index + 1}. ${bundle.subgraph.query.queryType} → ${bundle.target} (优先级: ${bundle.priority})`)
    console.log(`     节点: ${bundle.subgraph.statistics.totalNodes}, 平均相关性: ${bundle.subgraph.statistics.avgRelevance.toFixed(1)}`)
  })

  // 获取系统统计
  const stats = runtime.retrieval.getStats()
  console.log('\n系统统计:')
  console.log(`  检索次数: ${stats.retrieval.retrievalCount}`)
  console.log(`  平均检索时间: ${stats.retrieval.avgRetrievalTime.toFixed(2)}ms`)
  console.log(`  缓存命中率: ${(stats.retrieval.cacheHitRate * 100).toFixed(1)}%`)
  console.log(`  路由次数: ${stats.routing.totalRoutes}`)

  return bundles
}

/**
 * 示例3: 错误处理和恢复
 */
export async function exampleErrorRecovery() {
  console.log('\n=== 示例3: 错误处理和恢复 ===')

  const runtime = createRuntimeCore({
    graph: {
      sessionId: 'error-recovery-session'
    }
  })

  if (!runtime.retrieval) {
    console.log('Graph Retrieval 不可用，跳过示例')
    return
  }

  // 模拟一个会出错的查询
  const errorQuery: RetrievalQuery = {
    queryType: 'file',
    targetIds: ['non-existent-file-that-causes-error']
  }

  try {
    console.log('执行可能出错的检索...')
    const bundle = await runtime.retrieval.routeContext(errorQuery, {
      sessionId: 'error-test',
      taskId: 'test-error-handling'
    })

    console.log(`路由结果: ${bundle.target}`)
    if (bundle.target === 'recovery') {
      console.log('✅ 错误被正确路由到恢复系统')
      console.log(`恢复指令: ${bundle.instructions}`)
    }
  } catch (error) {
    console.log('❌ 错误未被正确处理:', error.message)
  }

  return true
}

/**
 * 主函数：运行所有示例
 */
export async function runAllExamples() {
  console.log('🚀 开始运行 Graph Retrieval 集成示例 (F-2)\n')

  try {
    // 运行示例1
    await exampleQueryLoopIntegration()

    // 运行示例2
    await exampleContextBuilderIntegration()

    // 运行示例3
    await exampleErrorRecovery()

    console.log('\n✅ 所有示例运行完成！')
    console.log('Graph Retrieval 系统已成功集成到 DSXU 主链中。')
  } catch (error) {
    console.error('❌ 示例运行失败:', error)
  }
}

// 如果直接运行此文件
if (import.meta.main) {
  runAllExamples()
}
/**
 * V14 FROZEN: example-only retrieval integration file. Retained only because
 * Windows ACL blocked physical removal after copying to _deleted_files.
 */
