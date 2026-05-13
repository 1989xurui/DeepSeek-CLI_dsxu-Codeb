/**
 * 适配器吸收测试
 * 测试从 DSXU 吸收的成熟内容在 DSXU 中的实现
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileEditAdapter, createFileEditSpec, FileEditErrorType } from '../file-edit-adapter'
import { BashAdapter, createBashSpec } from '../bash-adapter'
import { BridgeAdapter, BridgeToolErrorType, BridgeToolEventType } from '../bridge-adapter'
import type { ToolCallRequest, ToolExecutionContext } from '../../tool-protocol'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'

const TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-adapter-test-' + Date.now())

// 测试上下文
const createTestContext = (): ToolExecutionContext => ({
  cwd: TEST_DIR,
  sessionId: 'test-session',
  gear: 1,
  currentCallId: 'test-call',
  emitEvent: () => {} // 空事件发射器
})

describe('FileEditAdapter - 从 DSXU 吸收的成熟内容', () => {
  const adapter = new FileEditAdapter()
  const spec = createFileEditSpec()

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
  })

  it('应该支持正确的工具名', () => {
    expect(adapter.supports('FileEdit')).toBe(true)
    expect(adapter.supports('Edit')).toBe(true)
    expect(adapter.supports('Invalid')).toBe(false)
  })

  it('应该创建新文件', async () => {
    const filePath = join(TEST_DIR, 'new-file.txt')
    const request: ToolCallRequest = {
      callId: 'test-1',
      toolName: 'FileEdit',
      arguments: {
        file_path: filePath,
        new_content: 'Hello World',
        old_content: ''
      }
    }

    const result = await adapter.execute(request, createTestContext())

    expect(result.ok).toBe(true)
    expect(result.structuredData?.fileExisted).toBe(false)
    expect(readFileSync(filePath, 'utf-8')).toBe('Hello World')
  })

  it('应该更新现有文件', async () => {
    const filePath = join(TEST_DIR, 'existing.txt')
    writeFileSync(filePath, 'Old content')

    const request: ToolCallRequest = {
      callId: 'test-2',
      toolName: 'FileEdit',
      arguments: {
        file_path: filePath,
        old_content: 'Old',
        new_content: 'New',
        replace_all: false
      }
    }

    const result = await adapter.execute(request, createTestContext())

    expect(result.ok).toBe(true)
    expect(result.structuredData?.fileExisted).toBe(true)
    expect(readFileSync(filePath, 'utf-8')).toBe('New content')
  })

  it('应该阻止敏感文件编辑（从 DSXU 吸收）', async () => {
    const request: ToolCallRequest = {
      callId: 'test-3',
      toolName: 'FileEdit',
      arguments: {
        file_path: '.env',
        new_content: 'SECRET=123'
      }
    }

    const result = await adapter.execute(request, createTestContext())

    expect(result.ok).toBe(false)
    expect(result.error?.type).toBe(FileEditErrorType.PERMISSION_DENIED)
    expect(result.outputText).toContain('敏感文件')
  })

  it('应该处理多匹配和 replace_all（从 DSXU 吸收）', async () => {
    const filePath = join(TEST_DIR, 'multi.txt')
    writeFileSync(filePath, 'test test test')

    // 测试 replace_all = false 应该失败（多个匹配）
    const request1: ToolCallRequest = {
      callId: 'test-4a',
      toolName: 'FileEdit',
      arguments: {
        file_path: filePath,
        old_content: 'test',
        new_content: 'TEST',
        replace_all: false
      }
    }

    const result1 = await adapter.execute(request1, createTestContext())
    expect(result1.ok).toBe(false)
    expect(result1.error?.type).toBe(FileEditErrorType.MULTIPLE_MATCHES)

    // 测试 replace_all = true 应该成功
    const request2: ToolCallRequest = {
      callId: 'test-4b',
      toolName: 'FileEdit',
      arguments: {
        file_path: filePath,
        old_content: 'test',
        new_content: 'TEST',
        replace_all: true
      }
    }

    const result2 = await adapter.execute(request2, createTestContext())
    expect(result2.ok).toBe(true)
    expect(readFileSync(filePath, 'utf-8')).toBe('TEST TEST TEST')
  })

  it('应该验证工具规格（从 DSXU 吸收）', () => {
    expect(spec.name).toBe('FileEdit')
    expect(spec.description).toContain('引号规范化')
    expect(spec.inputSchema.properties.replace_all).toBeDefined()
    expect(spec.constraints?.maxFileSize).toBe('1GB')
    expect(spec.constraints?.quoteNormalization).toBe(true)
  })
})

describe('BashAdapter - 从 DSXU 吸收的成熟内容', () => {
  const adapter = new BashAdapter()
  const spec = createBashSpec()

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
  })

  it('应该支持正确的工具名', () => {
    expect(adapter.supports('Bash')).toBe(true)
    expect(adapter.supports('Shell')).toBe(true)
    expect(adapter.supports('Invalid')).toBe(false)
  })

  it('应该执行简单命令', async () => {
    const request: ToolCallRequest = {
      callId: 'test-5',
      toolName: 'Bash',
      arguments: {
        command: 'echo "Hello from test"'
      }
    }

    const result = await adapter.execute(request, createTestContext())

    expect(result.ok).toBe(true)
    expect(result.outputText).toContain('Hello from test')
    expect(result.structuredData?.stdout).toContain('Hello from test')
  })

  it('应该阻止危险命令（从 DSXU 吸收）', async () => {
    const request: ToolCallRequest = {
      callId: 'test-6',
      toolName: 'Bash',
      arguments: {
        command: 'rm -rf /'
      }
    }

    const result = await adapter.execute(request, createTestContext())

    expect(result.ok).toBe(false)
    expect(result.outputText).toContain('危险命令')
  })

  it('应该格式化输出（从 DSXU 吸收）', async () => {
    const request: ToolCallRequest = {
      callId: 'test-7',
      toolName: 'Bash',
      arguments: {
        command: 'echo "Line 1"; echo "Line 2"; echo "Line 3"'
      }
    }

    const result = await adapter.execute(request, createTestContext())

    expect(result.ok).toBe(true)
    expect(result.structuredData?.totalLines).toBeGreaterThan(0)
    // 结构化数据应该包含格式化后的输出
    expect(result.structuredData?.stdout).toBeDefined()
    expect(result.structuredData?.stdoutOriginal).toBeDefined()
  })

  it('应该识别静默命令（从 DSXU 吸收）', async () => {
    const filePath = join(TEST_DIR, 'touch-test.txt')
    const request: ToolCallRequest = {
      callId: 'test-8',
      toolName: 'Bash',
      arguments: {
        command: `touch "${filePath}"`
      }
    }

    const result = await adapter.execute(request, createTestContext())

    expect(result.ok).toBe(true)
    // touch 是静默命令，应该有无输出的处理
    expect(result.structuredData?.isSilent).toBe(true)
  })

  it('应该验证工具规格（从 DSXU 吸收）', () => {
    expect(spec.name).toBe('Bash')
    expect(spec.description).toContain('输出格式化')
    expect(spec.inputSchema.properties.timeout.minimum).toBe(1000)
    expect(spec.inputSchema.properties.timeout.maximum).toBe(300000)
    expect(spec.constraints?.dangerousPatterns).toContain('rm -rf /')
    expect(spec.constraints?.commandSemanticAnalysis).toBe(true)
  })
})

describe('BridgeAdapter - 从 DSXU 吸收的成熟内容', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
  })

  it('应该创建带门禁的适配器', () => {
    const gateConfig = BridgeAdapter.createDefaultGateConfig()
    const adapter = new BridgeAdapter(new Map(), gateConfig)

    expect(adapter.getGateConfig().enabled).toBe(true)
    expect(adapter.getGateConfig().gatedTools).toContain('FileEdit')
    expect(adapter.getGateConfig().gatedTools).toContain('Bash')
  })

  it('应该归一化桥接结果（从 DSXU 吸收）', async () => {
    const context = createTestContext()

    // 测试不同的桥接结果格式
    const mockTool1 = {
      execute: async () => 'plain string result'
    }

    const mockTool2 = {
      execute: async () => ({ content: 'object result', isError: false, meta: { test: true } })
    }

    const mockTool3 = {
      execute: async () => ({ output: 'output field', error: null })
    }

    const adapter = new BridgeAdapter(new Map([
      ['Tool1', mockTool1],
      ['Tool2', mockTool2],
      ['Tool3', mockTool3]
    ]))

    // 测试格式1: 纯字符串
    const result1 = await adapter.execute({
      callId: 'test-9a',
      toolName: 'Tool1',
      arguments: {}
    }, context)

    expect(result1.ok).toBe(true)
    expect(result1.outputText).toBe('plain string result')

    // 测试格式2: 标准对象格式
    const result2 = await adapter.execute({
      callId: 'test-9b',
      toolName: 'Tool2',
      arguments: {}
    }, context)

    expect(result2.ok).toBe(true)
    expect(result2.outputText).toBe('object result')
    expect(result2.structuredData?.test).toBe(true)

    // 测试格式3: output/error 格式
    const result3 = await adapter.execute({
      callId: 'test-9c',
      toolName: 'Tool3',
      arguments: {}
    }, context)

    expect(result3.ok).toBe(true)
    expect(result3.outputText).toBe('output field')
  })
})

// 集成测试：测试原生路径和桥接路径的一致性
describe('集成测试 - 原生路径与桥接路径一致性', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
  })

  it('应该保持错误类型的一致性', () => {
    // FileEdit 错误类型应该与 BridgeTool 错误类型兼容
    expect(FileEditErrorType.PERMISSION_DENIED).toBe('PERMISSION_DENIED')
    expect(BridgeToolErrorType.PERMISSION_DENIED).toBe('PERMISSION_DENIED')

    expect(FileEditErrorType.VALIDATION_FAILED).toBe('VALIDATION_FAILED')
    expect(BridgeToolErrorType.VALIDATION_FAILED).toBe('VALIDATION_FAILED')

    expect(FileEditErrorType.EXECUTION_FAILED).toBe('EXECUTION_FAILED')
    expect(BridgeToolErrorType.EXECUTION_FAILED).toBe('EXECUTION_FAILED')
  })
})
