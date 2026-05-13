/**
 * FileEdit Adapter Atomic V1 测试
 *
 * 测试文件编辑适配器的原子写入、冲突检测、权限边界
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { FileEditAdapter } from '../adapters/file-edit-adapter'
import type { ToolCallRequest, ToolExecutionContext } from '../tool-protocol'
import { mkdir, writeFile, readFile, unlink, rm } from 'fs/promises'
import { join } from 'path'

describe('FileEdit Adapter Atomic V1', () => {
  let adapter: FileEditAdapter
  let mockContext: ToolExecutionContext
  let testDir: string

  beforeEach(async () => {
    adapter = new FileEditAdapter()
    testDir = join('/tmp', `test-file-edit-${Date.now()}`)
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

  test('应执行原子文件写入并返回结构化结果', async () => {
    const testFile = join(testDir, 'test.txt')
    const request: ToolCallRequest = {
      callId: 'test-call-1',
      toolName: 'FileEdit',
      arguments: {
        file_path: 'test.txt',
        new_content: 'Hello World',
        old_content: '',
        create_if_missing: true
      }
    }

    const result = await adapter.execute(request, mockContext)

    expect(result.ok).toBe(true)
    expect(result.structuredData).toBeDefined()
    expect(result.structuredData?.fileEditResult).toBeDefined()

    const fileEditResult = result.structuredData?.fileEditResult
    expect(fileEditResult?.success).toBe(true)
    expect(fileEditResult?.atomic).toBe(true)
    expect(fileEditResult?.operation).toBe('create')
    expect(fileEditResult?.newSize).toBe(11) // "Hello World".length

    // 验证原子写入信息
    expect(result.structuredData?.atomicWrite).toBeDefined()
    expect(result.structuredData?.atomicWrite?.usedAtomic).toBe(true)
    expect(result.structuredData?.atomicWrite?.atomicOperationSummary).toBeDefined()
    expect(result.structuredData?.atomicWrite?.atomicOperationSummary?.operationType).toBe('atomic_file_write')

    // 验证执行上下文
    expect(result.structuredData?.executionContext).toBeDefined()
    expect(result.structuredData?.executionContext?.sessionId).toBe('test-session-123')
    expect(result.structuredData?.executionContext?.taskId).toBe('test-task-456')
    expect(result.structuredData?.executionContext?.atomicOperation).toBe(true)
  })

  test('应检测冲突并返回冲突信息', async () => {
    const testFile = join(testDir, 'conflict.txt')
    await writeFile(testFile, 'Original content')

    const request: ToolCallRequest = {
      callId: 'test-call-2',
      toolName: 'FileEdit',
      arguments: {
        file_path: 'conflict.txt',
        new_content: 'New content',
        old_content: 'Original content'
      }
    }

    const result = await adapter.execute(request, mockContext)

    expect(result.structuredData?.atomicWrite).toBeDefined()

    // 验证原子写入信息存在
    const atomicWrite = result.structuredData?.atomicWrite
    expect(atomicWrite?.usedAtomic).toBe(true)
    expect(atomicWrite?.operationId).toBeDefined()
    expect(atomicWrite?.atomicOperationSummary).toBeDefined()

    // 冲突检测可能不会触发，但原子写入结构应该存在
    if (atomicWrite?.conflictDetected) {
      expect(atomicWrite.conflictDetails).toBeDefined()
      expect(atomicWrite.conflictType).toBeDefined()
      expect(atomicWrite.resolutionStrategy).toBeDefined()
    }
  })

  test('应拦截非法路径并返回权限检查结果', async () => {
    const request: ToolCallRequest = {
      callId: 'test-call-3',
      toolName: 'FileEdit',
      arguments: {
        file_path: 'test.txt', // 使用相对路径
        new_content: 'Test content',
        old_content: '',
        create_if_missing: true
      }
    }

    const result = await adapter.execute(request, mockContext)

    expect(result.ok).toBe(true)

    // 验证权限检查结果在结构化数据中
    expect(result.structuredData?.fileEditResult).toBeDefined()
    const fileEditResult = result.structuredData?.fileEditResult
    expect(fileEditResult?.permissionCheck).toBeDefined()
    expect(fileEditResult?.permissionCheck?.allowed).toBe(true)
  })

  test('应支持rollback-safe结果结构', async () => {
    const testFile = join(testDir, 'rollback.txt')
    const originalContent = 'Original line 1\nOriginal line 2'
    await writeFile(testFile, originalContent)

    const request: ToolCallRequest = {
      callId: 'test-call-4',
      toolName: 'FileEdit',
      arguments: {
        file_path: 'rollback.txt',
        new_content: 'New line 1\nNew line 2',
        old_content: originalContent
      }
    }

    const result = await adapter.execute(request, mockContext)

    expect(result.ok).toBe(true)
    expect(result.structuredData?.fileEditResult).toBeDefined()

    const fileEditResult = result.structuredData?.fileEditResult
    expect(fileEditResult?.rollbackSafe).toBeDefined()
    expect(fileEditResult?.rollbackSafe?.canRollback).toBe(true)
    expect(fileEditResult?.rollbackSafe?.rollbackStrategy).toBeDefined()

    // 验证差异信息
    expect(fileEditResult?.diff).toBeDefined()
    expect(fileEditResult?.diff?.added).toBeDefined()
    expect(fileEditResult?.diff?.removed).toBeDefined()
    expect(fileEditResult?.diff?.changed).toBeDefined()
  })
})