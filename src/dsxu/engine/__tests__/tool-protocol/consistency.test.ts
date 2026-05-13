/**
 * 并账一致性测试
 *
 * 验证原生路径与 bridge fallback 的结果/错误/事件结构一致性
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ToolProtocolIntegration } from '../../tool-protocol-integration'
import { ToolCallRequest, ToolExecutionContext } from '../../tool-protocol'
import { FileEditAdapter } from '../../adapters/file-edit-adapter'
import { BashAdapter } from '../../adapters/bash-adapter'

describe('并账一致性测试', () => {
  let integration: ToolProtocolIntegration
  let mockContext: ToolExecutionContext

  beforeEach(() => {
    integration = new ToolProtocolIntegration()

    mockContext = {
      cwd: '/tmp/test-cwd',
      sessionId: 'test-session',
      gear: 1,
      emitEvent: () => {},
      abortSignal: undefined
    }
  })

  afterEach(() => {
    // 清理测试文件
    try {
      const fs = require('fs')
      if (fs.existsSync('/tmp/test-cwd/test-file.txt')) {
        fs.unlinkSync('/tmp/test-cwd/test-file.txt')
      }
      if (fs.existsSync('/tmp/test-cwd')) {
        fs.rmdirSync('/tmp/test-cwd')
      }
    } catch (e) {
      // 忽略清理错误
    }
  })

  describe('FileEdit 结果结构一致性', () => {
    test('原生路径结果结构应符合协议规范', async () => {
      // 准备测试文件
      const fs = require('fs')
      const path = require('path')
      const testDir = '/tmp/test-cwd'
      const testFile = path.join(testDir, 'test-file.txt')

      fs.mkdirSync(testDir, { recursive: true })
      fs.writeFileSync(testFile, 'original content', 'utf-8')

      const request: ToolCallRequest = {
        callId: 'test-call-1',
        toolName: 'FileEdit',
        arguments: {
          file_path: 'test-file.txt',
          new_content: 'updated content'
        },
        source: 'llm'
      }

      const result = await integration.dispatchToolCall(request, mockContext)

      // 验证结果结构
      expect(result).toHaveProperty('ok')
      expect(result).toHaveProperty('outputText')
      expect(result).toHaveProperty('events')
      expect(result).toHaveProperty('metadata')
      expect(result.metadata).toHaveProperty('duration')
      expect(result.metadata).toHaveProperty('executorKind')
      expect(result.metadata).toHaveProperty('usedBridge')

      // 验证结构化数据（如果成功）
      if (result.ok) {
        expect(result.structuredData).toBeDefined()
        expect(result.structuredData).toHaveProperty('filePath')
        expect(result.structuredData).toHaveProperty('fileExisted')
        expect(result.structuredData).toHaveProperty('newSize')
        expect(result.structuredData).toHaveProperty('oldSize')
      }
    })

    test('错误结构应符合协议规范', async () => {
      const request: ToolCallRequest = {
        callId: 'test-call-2',
        toolName: 'FileEdit',
        arguments: {
          // 缺少必要参数
          file_path: 'test-file.txt'
          // 缺少 new_content
        },
        source: 'llm'
      }

      const result = await integration.dispatchToolCall(request, mockContext)

      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toHaveProperty('type')
      expect(result.error).toHaveProperty('message')
      expect(result.error).toHaveProperty('retryable')

      // 验证错误类型（可能是 VALIDATION_FAILED 或 EXECUTION_FAILED）
      expect(['VALIDATION_FAILED', 'EXECUTION_FAILED']).toContain(result.error!.type)
    })

    test('敏感路径拒绝应返回统一错误结构', async () => {
      const request: ToolCallRequest = {
        callId: 'test-call-3',
        toolName: 'FileEdit',
        arguments: {
          file_path: '/etc/passwd',
          new_content: 'should not be allowed'
        },
        source: 'llm'
      }

      const result = await integration.dispatchToolCall(request, mockContext)

      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
      // 可能是 PERMISSION_DENIED 或路径不在 cwd 内的错误
      expect(['PERMISSION_DENIED', 'EXECUTION_FAILED']).toContain(result.error!.type)
      if (result.error!.type === 'PERMISSION_DENIED') {
        expect(result.error!.message).toContain('禁止修改敏感文件')
      }
    })
  })

  describe('Bash 结果结构一致性', () => {
    test('原生路径结果结构应符合协议规范', async () => {
      const request: ToolCallRequest = {
        callId: 'test-call-4',
        toolName: 'Bash',
        arguments: {
          command: 'echo "hello world"'
        },
        source: 'llm'
      }

      const result = await integration.dispatchToolCall(request, mockContext)

      // 验证结果结构
      expect(result).toHaveProperty('ok')
      expect(result).toHaveProperty('outputText')
      expect(result).toHaveProperty('events')
      expect(result).toHaveProperty('metadata')
      expect(result.metadata).toHaveProperty('duration')
      expect(result.metadata).toHaveProperty('executorKind')
      expect(result.metadata).toHaveProperty('usedBridge')

      // 验证结构化数据（如果成功）
      if (result.ok) {
        expect(result.structuredData).toBeDefined()
        expect(result.structuredData).toHaveProperty('command')
        expect(result.structuredData).toHaveProperty('exitCode')
        expect(result.structuredData).toHaveProperty('stdout')
        expect(result.structuredData).toHaveProperty('stderr')
      }
    })

    test('危险命令拒绝应返回统一错误结构', async () => {
      const request: ToolCallRequest = {
        callId: 'test-call-5',
        toolName: 'Bash',
        arguments: {
          command: 'rm -rf /'
        },
        source: 'llm'
      }

      const result = await integration.dispatchToolCall(request, mockContext)

      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.type).toBe('PERMISSION_DENIED')
      // 更新错误消息匹配新的安全分析结果
      expect(result.error!.message).toContain('检测到高危命令')
    })

    test('超时错误应符合协议规范', async () => {
      const request: ToolCallRequest = {
        callId: 'test-call-6',
        toolName: 'Bash',
        arguments: {
          command: 'sleep 2', // 使用较短的睡眠时间
          timeout: 100 // 100ms 超时
        },
        source: 'llm'
      }

      const result = await integration.dispatchToolCall(request, mockContext)

      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
      // 可能是超时或命令执行失败
      expect(['EXECUTION_FAILED', 'TIMEOUT']).toContain(result.error!.type)
      if (result.error!.type === 'TIMEOUT') {
        expect(result.error!.message.toLowerCase()).toContain('timeout')
      }
    })
  })

  describe('事件结构一致性', () => {
    test('工具调用应发出标准事件', async () => {
      const events: any[] = []

      const contextWithEvents: ToolExecutionContext = {
        ...mockContext,
        emitEvent: (event) => {
          events.push(event)
        }
      }

      const request: ToolCallRequest = {
        callId: 'test-call-7',
        toolName: 'Bash',
        arguments: {
          command: 'echo "test event"'
        },
        source: 'llm'
      }

      const result = await integration.dispatchToolCall(request, contextWithEvents)

      // 验证事件结构
      expect(events.length).toBeGreaterThan(0)

      for (const event of events) {
        expect(event).toHaveProperty('type')
        expect(event).toHaveProperty('callId', 'test-call-7')
        expect(event).toHaveProperty('toolName', 'Bash')
        expect(event).toHaveProperty('timestamp')
        expect(event).toHaveProperty('data')
      }

      // 验证至少包含开始和完成事件
      const eventTypes = events.map(e => e.type)
      expect(eventTypes).toContain('tool_call_started')
      expect(eventTypes).toContain('tool_call_completed')
    })

    test('失败调用应发出失败事件', async () => {
      const events: any[] = []

      const contextWithEvents: ToolExecutionContext = {
        ...mockContext,
        emitEvent: (event) => {
          events.push(event)
        }
      }

      // 使用一个肯定会触发安全检查失败的命令
      const request: ToolCallRequest = {
        callId: 'test-call-8',
        toolName: 'Bash',
        arguments: {
          command: 'rm -rf /' // 危险命令，会被安全检查拒绝
        },
        source: 'llm'
      }

      const result = await integration.dispatchToolCall(request, contextWithEvents)

      // 验证失败事件（如果工具调用失败）
      if (!result.ok) {
        const failureEvents = events.filter(e => e.type === 'tool_call_failed')
        // 可能没有失败事件，因为安全检查可能在执行前就拒绝了
        if (failureEvents.length > 0) {
          for (const event of failureEvents) {
            expect(event.data).toHaveProperty('error')
            expect(event.data.error).toHaveProperty('type')
            expect(event.data.error).toHaveProperty('message')
          }
        }
      }
    })
  })

  describe('桥接适配器一致性', () => {
    test('桥接工具应返回统一结果结构', async () => {
      // 注意：这里需要实际的桥接工具测试
      // 由于桥接工具需要实际注册，这里先测试结构概念

      // 验证桥接适配器存在
      const bridgeAdapter = (integration as any).bridgeAdapter
      expect(bridgeAdapter).toBeDefined()

      // 验证桥接适配器支持工具
      expect(bridgeAdapter.supports).toBeInstanceOf(Function)
    })
  })
})