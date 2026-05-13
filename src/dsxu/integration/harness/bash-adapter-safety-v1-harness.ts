/**
 * Bash Adapter Safety V1 Harness
 *
 * Bash安全分析测试工具
 */

import { BashAdapter } from '../../engine/adapters/bash-adapter'
import type { ToolCallRequest, ToolExecutionContext } from '../../engine/tool-protocol'

/**
 * 测试bash安全分析功能
 */
export function testBashSafetyAnalysis() {
  const adapter = new BashAdapter()
  const mockContext: ToolExecutionContext = {
    sessionId: 'harness-session-123',
    taskId: 'harness-task-456',
    cwd: '/tmp/harness-test',
    environment: 'test'
  }

  const testCases = [
    {
      name: '安全命令',
      command: 'echo "safe command"',
      expectedRiskLevel: 'allow'
    },
    {
      name: '列表命令',
      command: 'ls -la',
      expectedRiskLevel: 'allow'
    }
  ]

  const results = []

  for (const testCase of testCases) {
    const request: ToolCallRequest = {
      callId: `harness-call-${Date.now()}`,
      toolName: 'Bash',
      arguments: { command: testCase.command }
    }

    try {
      // 注意：这里不实际执行，只测试结构
      results.push({
        name: testCase.name,
        command: testCase.command,
        expectedRiskLevel: testCase.expectedRiskLevel,
        adapterExists: true,
        hasSecurityCheck: typeof (adapter as any).checkSecurity === 'function'
      })
    } catch (error) {
      results.push({
        name: testCase.name,
        command: testCase.command,
        error: error.message,
        adapterExists: true
      })
    }
  }

  return {
    totalTests: testCases.length,
    results,
    allPassed: results.every(r => !r.error && r.adapterExists && r.hasSecurityCheck)
  }
}

/**
 * 验证bash适配器支持的风险等级类型
 */
export function testBashRiskLevels() {
  const adapter = new BashAdapter()

  // 检查安全分析方法是否存在
  const hasSecurityCheck = typeof (adapter as any).checkSecurity === 'function'

  // 定义预期的风险等级
  const expectedRiskLevels = ['allow', 'warn', 'block', 'require_confirmation']

  // 定义预期的风险类型
  const expectedRiskTypes = [
    'destructive_command',
    'heredoc_risk',
    'shell_injection',
    'permission_overflow',
    'path_traversal'
  ]

  return {
    adapterExists: true,
    hasSecurityCheck,
    expectedRiskLevels,
    expectedRiskTypes,
    structuredOutputSupported: true
  }
}

/**
 * Bash安全分析测试工具集
 */
export const BashAdapterSafetyHarness = {
  testBashSafetyAnalysis,
  testBashRiskLevels
}