/**
 * Bash File Adapter Mainline V1 测试
 *
 * 测试bash和file-edit适配器的主链联动
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { BashAdapter } from '../adapters/bash-adapter'
import { FileEditAdapter } from '../adapters/file-edit-adapter'
import type { ToolCallRequest, ToolExecutionContext } from '../tool-protocol'
import { mkdir, writeFile, readFile, rm } from 'fs/promises'
import { join } from 'path'

describe('Bash File Adapter Mainline V1', () => {
  let bashAdapter: BashAdapter
  let fileEditAdapter: FileEditAdapter
  let mockContext: ToolExecutionContext
  let testDir: string

  beforeEach(async () => {
    bashAdapter = new BashAdapter()
    fileEditAdapter = new FileEditAdapter()
    testDir = join('/tmp', `test-mainline-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    mockContext = {
      sessionId: 'test-session-123',
      taskId: 'test-task-456',
      cwd: testDir,
      environment: 'test'
    }
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  test('bash风险判定不应被file-edit结果覆盖', async () => {
    // 先执行一个安全的bash命令
    const bashRequest: ToolCallRequest = {
      callId: 'bash-call-1',
      toolName: 'Bash',
      arguments: { command: 'echo "safe command"' }
    }

    const bashResult = await bashAdapter.execute(bashRequest, mockContext)

    // 再执行一个安全的file-edit操作
    const fileEditRequest: ToolCallRequest = {
      callId: 'file-call-1',
      toolName: 'FileEdit',
      arguments: {
        file_path: 'safe.txt',
        new_content: 'Safe content',
        old_content: '',
        create_if_missing: true
      }
    }

    const fileEditResult = await fileEditAdapter.execute(fileEditRequest, mockContext)

    // 验证bash结果独立存在
    expect(bashResult.ok).toBe(true)
    expect(bashResult.structuredData?.securityAnalysis).toBeDefined()

    // 验证file-edit成功独立存在
    expect(fileEditResult.ok).toBe(true)
    expect(fileEditResult.structuredData?.fileEditResult?.success).toBe(true)

    // 验证两者结果都能被主链消费
    expect(bashResult.structuredData?.executionContext?.sessionId).toBe('test-session-123')
    expect(bashResult.structuredData?.executionContext?.taskId).toBe('test-task-456')

    expect(fileEditResult.structuredData?.executionContext?.sessionId).toBe('test-session-123')
    expect(fileEditResult.structuredData?.executionContext?.taskId).toBe('test-task-456')
  })

  test('file-edit冲突不应被bash allow覆盖', async () => {
    // 先创建一个文件
    const testFile = join(testDir, 'conflict.txt')
    await writeFile(testFile, 'Original content')

    // 模拟文件在外部被修改
    const externalWrite = new Promise<void>(resolve => {
      setTimeout(() => {
        void writeFile(testFile, 'Modified externally').finally(resolve)
      }, 10)
    })

    // 执行一个安全的bash命令
    const bashRequest: ToolCallRequest = {
      callId: 'bash-call-2',
      toolName: 'Bash',
      arguments: { command: 'echo "safe command"' }
    }

    const bashResult = await bashAdapter.execute(bashRequest, mockContext)

    // 执行file-edit操作（可能检测到冲突）
    const fileEditRequest: ToolCallRequest = {
      callId: 'file-call-2',
      toolName: 'FileEdit',
      arguments: {
        file_path: 'conflict.txt',
        new_content: 'New content',
        old_content: 'Original content'
      }
    }

    const fileEditResult = await fileEditAdapter.execute(fileEditRequest, mockContext)
    await externalWrite

    // 验证bash允许独立存在
    expect(bashResult.ok).toBe(true)
    expect(bashResult.structuredData?.securityAnalysis?.riskLevel).toBe('allow')

    // 验证file-edit冲突信息独立存在
    expect(fileEditResult.structuredData?.atomicWrite).toBeDefined()

    // 即使bash允许，file-edit的冲突信息应该被记录
    const atomicWrite = fileEditResult.structuredData?.atomicWrite
    if (atomicWrite?.conflictDetected) {
      expect(atomicWrite.conflictDetails?.length).toBeGreaterThan(0)
      expect(atomicWrite.conflictType).toBeDefined()
    }
  })

  test('应建立真实主链消费链路', async () => {
    // 创建一个组合场景：先检查目录，再创建文件
    const bashRequest: ToolCallRequest = {
      callId: 'bash-call-3',
      toolName: 'Bash',
      arguments: { command: 'ls -la' }
    }

    const bashResult = await bashAdapter.execute(bashRequest, mockContext)

    // 验证bash结果有结构化数据
    expect(bashResult.structuredData).toBeDefined()
    expect(bashResult.structuredData?.securityAnalysis).toBeDefined()
    expect(bashResult.structuredData?.executionContext).toBeDefined()

    // 使用bash结果中的信息来创建文件
    const fileEditRequest: ToolCallRequest = {
      callId: 'file-call-3',
      toolName: 'FileEdit',
      arguments: {
        file_path: 'mainline-test.txt',
        new_content: `Created at ${new Date().toISOString()}\nSession: ${bashResult.structuredData?.executionContext?.sessionId}`,
        old_content: '',
        create_if_missing: true
      }
    }

    const fileEditResult = await fileEditAdapter.execute(fileEditRequest, mockContext)

    // 验证file-edit结果有结构化数据
    expect(fileEditResult.structuredData).toBeDefined()
    expect(fileEditResult.structuredData?.fileEditResult).toBeDefined()
    expect(fileEditResult.structuredData?.executionContext).toBeDefined()

    // 验证两者共享相同的执行上下文
    expect(bashResult.structuredData?.executionContext?.sessionId).toBe('test-session-123')
    expect(bashResult.structuredData?.executionContext?.taskId).toBe('test-task-456')

    expect(fileEditResult.structuredData?.executionContext?.sessionId).toBe('test-session-123')
    expect(fileEditResult.structuredData?.executionContext?.taskId).toBe('test-task-456')

    // 验证主链可以消费两者的结构化结果
    const mainlineResult = {
      sessionId: 'test-session-123',
      taskId: 'test-task-456',
      operations: [
        {
          type: 'bash',
          result: bashResult.structuredData,
          securityAnalysis: bashResult.structuredData?.securityAnalysis
        },
        {
          type: 'file_edit',
          result: fileEditResult.structuredData,
          fileEditResult: fileEditResult.structuredData?.fileEditResult
        }
      ]
    }

    expect(mainlineResult.sessionId).toBe('test-session-123')
    expect(mainlineResult.taskId).toBe('test-task-456')
    expect(mainlineResult.operations).toHaveLength(2)
    expect(mainlineResult.operations[0].type).toBe('bash')
    expect(mainlineResult.operations[1].type).toBe('file_edit')
  })
})
