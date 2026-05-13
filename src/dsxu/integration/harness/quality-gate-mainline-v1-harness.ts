/**
 * Quality Gate Mainline V1 Harness
 *
 * 验证门禁主流程测试工具
 */

import { runVerifyGate } from '../../engine/verify-gate'
import type { QueryEvent, QueryResult } from '../../engine/types'

/**
 * 创建测试用查询事件
 */
export function createTestEvents(hasFileEdit: boolean = true): QueryEvent[] {
  if (hasFileEdit) {
    return [
      {
        type: 'tool_result',
        toolName: 'FileEdit',
        result: { content: 'test content' },
        timestamp: Date.now()
      }
    ] as QueryEvent[]
  }

  return [
    {
      type: 'tool_result',
      toolName: 'Bash',
      result: { content: 'ls -la' },
      timestamp: Date.now()
    }
  ] as QueryEvent[]
}

/**
 * 创建测试用查询结果
 */
export function createTestResult(): QueryResult {
  return {
    exitReason: 'success',
    finalMessage: 'Test completed',
    sessionId: 'test-session-123',
    taskId: 'test-task-456'
  }
}

/**
 * 运行验证门禁测试
 */
export async function runVerifyGateTest(config: any = {}) {
  const events = createTestEvents()
  const result = createTestResult()

  const fullConfig = {
    enabled: true,
    triggerOnFileEdit: true,
    minScore: 70,
    onFailure: 'warn',
    ...config
  }

  return await runVerifyGate(events, result, fullConfig)
}

/**
 * 验证门禁测试工具集
 */
export const QualityGateMainlineHarness = {
  createTestEvents,
  createTestResult,
  runVerifyGateTest
}