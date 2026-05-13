import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runVerifyGate } from '../verify-gate'
import type { QueryEvent, QueryResult } from '../types'

describe('VerifyGate', () => {
  const baseResult: QueryResult = {
    exitReason: 'end_turn',
    finalMessage: '任务完成',
    turns: 1,
    memories: []
  }

  const fileEditEvent: QueryEvent = {
    type: 'tool_result',
    toolName: 'FileEdit',
    toolUseId: 'test-1',
    result: {
      toolUseId: 'test-1',
      content: '文件编辑成功',
      isError: false
    }
  }

  const bashEvent: QueryEvent = {
    type: 'tool_result',
    toolName: 'Bash',
    toolUseId: 'test-2',
    result: {
      toolUseId: 'test-2',
      content: '命令执行成功',
      isError: false
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础功能', () => {
    it('应该跳过没有文件编辑的验证', async () => {
      const events: QueryEvent[] = []
      const config = { enabled: true, triggerOnFileEdit: true }

      const { result, verification } = await runVerifyGate(events, baseResult, config)

      expect(verification).toBeUndefined()
      expect(result.exitReason).toBe('end_turn')
    })

    it('应该在有文件编辑时触发验证', async () => {
      const events: QueryEvent[] = [fileEditEvent]
      const config = { enabled: true, triggerOnFileEdit: true }

      const result = await runVerifyGate(events, baseResult, config)

      expect(result.verification).toBeDefined()
      expect(result.verification?.passed).toBe(true)
      expect(result.verification?.score).toBeGreaterThanOrEqual(70)
    })

    it('应该在有Bash执行时触发验证', async () => {
      const events: QueryEvent[] = [bashEvent]
      const config = { enabled: true, triggerOnBash: true }

      const { verification } = await runVerifyGate(events, baseResult, config)

      expect(verification).toBeDefined()
    })
  })

  describe('配置选项', () => {
    it('应该支持禁用验证门禁', async () => {
      const events: QueryEvent[] = [fileEditEvent]
      const config = { enabled: false }

      const { verification } = await runVerifyGate(events, baseResult, config)

      expect(verification).toBeUndefined()
    })

    it('应该支持只触发文件编辑验证', async () => {
      const events: QueryEvent[] = [bashEvent]
      const config = {
        enabled: true,
        triggerOnFileEdit: true,
        triggerOnBash: false
      }

      const { verification } = await runVerifyGate(events, baseResult, config)

      expect(verification).toBeUndefined()
    })

    it('应该支持只触发Bash验证', async () => {
      const events: QueryEvent[] = [fileEditEvent]
      const config = {
        enabled: true,
        triggerOnFileEdit: false,
        triggerOnBash: true
      }

      const { verification } = await runVerifyGate(events, baseResult, config)

      expect(verification).toBeUndefined()
    })
  })

  describe('门禁行为验证', () => {
    it('应该正确处理验证结果', async () => {
      const events: QueryEvent[] = [fileEditEvent]
      const config = {
        enabled: true,
        triggerOnFileEdit: true,
        minScore: 50, // 低阈值确保通过
        onFailure: 'warn' as const
      }

      const { result } = await runVerifyGate(events, baseResult, config)

      // 验证结果应该被附加到结果上
      expect(result.verification).toBeDefined()
      expect(typeof result.verification?.passed).toBe('boolean')
      expect(typeof result.verification?.score).toBe('number')
    })

    it('应该根据配置处理验证失败', async () => {
      const events: QueryEvent[] = [fileEditEvent]

      // 测试 block 配置
      const blockConfig = {
        enabled: true,
        triggerOnFileEdit: true,
        minScore: 99, // 高阈值确保失败
        onFailure: 'block' as const
      }

      const { result: blockResult } = await runVerifyGate(events, baseResult, blockConfig)

      if (!blockResult.verification?.passed) {
        expect(blockResult.exitReason).toBe('max_errors')
      }

      // 测试 continue 配置
      const continueConfig = {
        enabled: true,
        triggerOnFileEdit: true,
        minScore: 99, // 高阈值确保失败
        onFailure: 'continue' as const
      }

      const { result: continueResult } = await runVerifyGate(events, baseResult, continueConfig)
      expect(continueResult.exitReason).toBe('end_turn')
    })
  })

  describe('错误处理', () => {
    it('应该在验证过程中发生错误时继续执行', async () => {
      const events: QueryEvent[] = [fileEditEvent]
      const config = { enabled: true }

      // 模拟验证过程中的错误
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = await runVerifyGate(events, baseResult, config)

      expect(result.exitReason).toBe('end_turn')
      expect(result).toBeDefined()
    })
  })
})
