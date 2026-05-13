/**
 * SkillsExecutor 测试
 *
 * 测试策略：
 * - 测试模拟执行模式
 * - 测试实际执行模式
 * - 测试错误处理
 * - 测试统计跟踪
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SkillsExecutor, createSkillsExecutor, type SkillsExecutorConfig, type SkillExecutionResult, type ToolUseContext } from '../skills-executor'

describe('SkillsExecutor', () => {
  let executor: SkillsExecutor
  const mockContext: ToolUseContext = {
    cwd: '/test/path',
    sessionId: 'test-session-123',
    agentId: 'test-agent',
    userId: 'test-user',
    requestId: 'test-request',
  }

  beforeEach(() => {
    executor = createSkillsExecutor({
      debug: false,
      mockExecution: true,
      mockDelay: 0,
    })
  })

  afterEach(() => {
    // 清理
  })

  describe('基础功能', () => {
    it('应该创建执行器实例', () => {
      expect(executor).toBeDefined()
      expect(executor.execute).toBeDefined()
      expect(executor.getExecutionStats).toBeDefined()
      expect(executor.getStatus).toBeDefined()
    })

    it('应该返回执行器状态', () => {
      const status = executor.getStatus()
      expect(status.mockExecution).toBe(true)
      expect(status.config).toBeDefined()
      expect(status.config.debug).toBe(false)
    })

    it('应该更新配置', () => {
      executor.updateConfig({ debug: true, mockDelay: 100 })
      const status = executor.getStatus()
      expect(status.config.debug).toBe(true)
      expect(status.config.mockDelay).toBe(100)
    })
  })

  describe('模拟执行', () => {
    it('应该模拟执行 skillify 技能', async () => {
      const result = await executor.execute('skillify', '--name test-skill', mockContext)

      expect(result).toBeDefined()
      expect(result.isError).toBe(false)
      expect(result.content).toContain('[Mock Skill Execution: skillify]')
      expect(result.content).toContain('skillify')
      expect(result.meta).toBeDefined()
      expect(result.meta.mock).toBe(true)
      expect(result.meta.skillType).toBe('skillify')
    })

    it('应该模拟执行 commit 技能', async () => {
      const result = await executor.execute('commit', '-m "test commit"', mockContext)

      expect(result).toBeDefined()
      expect(result.isError).toBe(false)
      expect(result.content).toContain('[Mock Skill Execution: commit]')
      expect(result.content).toContain('commit')
      expect(result.meta).toBeDefined()
      expect(result.meta.mock).toBe(true)
      expect(result.meta.skillType).toBe('commit')
    })

    it('应该模拟执行 review-pr 技能', async () => {
      const result = await executor.execute('review-pr', '123', mockContext)

      expect(result).toBeDefined()
      expect(result.isError).toBe(false)
      expect(result.content).toContain('[Mock Skill Execution: review-pr]')
      expect(result.content).toContain('review-pr')
      expect(result.meta).toBeDefined()
      expect(result.meta.mock).toBe(true)
      expect(result.meta.skillType).toBe('review-pr')
    })

    it('应该模拟执行 update-config 技能', async () => {
      const result = await executor.execute('update-config', '--key debug --value true', mockContext)

      expect(result).toBeDefined()
      expect(result.isError).toBe(false)
      expect(result.content).toContain('[Mock Skill Execution: update-config]')
      expect(result.content).toContain('update-config')
      expect(result.meta).toBeDefined()
      expect(result.meta.mock).toBe(true)
      expect(result.meta.skillType).toBe('update-config')
    })

    it('应该模拟执行未知技能', async () => {
      const result = await executor.execute('unknown-skill', '--arg value', mockContext)

      expect(result).toBeDefined()
      expect(result.isError).toBe(false)
      expect(result.content).toContain('[Mock Skill Execution: unknown-skill]')
      expect(result.content).toContain('unknown-skill')
      expect(result.meta).toBeDefined()
      expect(result.meta.mock).toBe(true)
      expect(result.meta.skillType).toBe('generic')
    })

    it('应该处理模拟延迟', async () => {
      executor.updateConfig({ mockDelay: 50 })

      const startTime = Date.now()
      const result = await executor.execute('skillify', '', mockContext)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(endTime - startTime).toBeGreaterThanOrEqual(45) // 允许一些误差
    })
  })

  describe('执行统计', () => {
    it('应该跟踪执行统计', async () => {
      // 初始统计
      const initialStats = executor.getExecutionStats()
      expect(initialStats.totalExecutions).toBe(0)
      expect(initialStats.successfulExecutions).toBe(0)
      expect(initialStats.failedExecutions).toBe(0)
      expect(initialStats.totalDurationMs).toBe(0)

      // 执行几次技能
      await executor.execute('skillify', '', mockContext)
      await executor.execute('commit', '', mockContext)
      await executor.execute('review-pr', '', mockContext)

      // 检查统计
      const stats = executor.getExecutionStats()
      expect(stats.totalExecutions).toBe(3)
      expect(stats.successfulExecutions).toBe(3)
      expect(stats.failedExecutions).toBe(0)
      expect(stats.totalDurationMs).toBeGreaterThan(0)
      expect(stats.avgDurationMs).toBeGreaterThan(0)
      expect(stats.successRate).toBe(100)
    })

    it('应该计算平均持续时间和成功率', async () => {
      // 执行多次
      for (let i = 0; i < 5; i++) {
        await executor.execute('skillify', '', mockContext)
      }

      const stats = executor.getExecutionStats()
      expect(stats.totalExecutions).toBe(5)
      expect(stats.successfulExecutions).toBe(5)
      expect(stats.avgDurationMs).toBeGreaterThan(0)
      expect(stats.successRate).toBe(100)
    })

    it('应该跟踪错误分布', async () => {
      // 注意：模拟执行不会产生错误，所以这里只是测试错误分布对象存在
      const stats = executor.getExecutionStats()
      expect(stats.errorDistribution).toBeDefined()
      expect(typeof stats.errorDistribution).toBe('object')
    })
  })

  describe('配置选项', () => {
    it('应该使用自定义配置创建执行器', () => {
      const customExecutor = createSkillsExecutor({
        debug: true,
        mockExecution: true,
        mockDelay: 200,
      })

      const status = customExecutor.getStatus()
      expect(status.config.debug).toBe(true)
      expect(status.config.mockExecution).toBe(true)
      expect(status.config.mockDelay).toBe(200)
    })

    it('应该使用默认配置创建执行器', () => {
      const defaultExecutor = createSkillsExecutor()

      const status = defaultExecutor.getStatus()
      expect(status.config.debug).toBe(false)
      expect(status.config.mockExecution).toBe(true)
      expect(status.config.mockDelay).toBe(0)
    })
  })

  describe('独立执行器禁用真实执行', () => {
    it('应该切换到非模拟配置但不拥有真实执行 runtime', () => {
      executor.updateConfig({ mockExecution: false })
      const status = executor.getStatus()
      expect(status.mockExecution).toBe(false)
    })

    // 注意：实际执行模式的测试需要更复杂的设置
    // 这里只测试配置切换，不测试实际执行
  })

  describe('错误处理', () => {
    it('应该处理空参数', async () => {
      const result = await executor.execute('skillify', '', mockContext)
      expect(result).toBeDefined()
      expect(result.isError).toBe(false)
    })

    it('应该处理 null/undefined 参数', async () => {
      const result1 = await executor.execute('skillify', null as any, mockContext)
      expect(result1).toBeDefined()
      expect(result1.isError).toBe(false)

      const result2 = await executor.execute('skillify', undefined as any, mockContext)
      expect(result2).toBeDefined()
      expect(result2.isError).toBe(false)
    })
  })

  describe('性能跟踪', () => {
    it('应该记录执行持续时间', async () => {
      const startTime = Date.now()
      await executor.execute('skillify', '', mockContext)
      const endTime = Date.now()

      const stats = executor.getExecutionStats()
      expect(stats.totalDurationMs).toBeGreaterThan(0)
      expect(stats.totalDurationMs).toBeLessThanOrEqual(endTime - startTime + 10) // 允许一些误差
    })
  })
})
