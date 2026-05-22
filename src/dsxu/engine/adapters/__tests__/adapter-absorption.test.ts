/**
 * 适配器吸收测试
 * 测试从 DSXU 吸收的成熟内容在 DSXU 中的实现
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileEditAdapter, createFileEditSpec, FileEditErrorType } from '../file-edit-adapter'
import { BashAdapter, createBashSpec } from '../bash-adapter'
import { ExternalToolAdapter, ExternalToolErrorType } from '../external-tool-adapter'
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
    expect(result.outputText).toContain('Editing sensitive file is blocked')
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
    expect(spec.description).toContain('quote normalization')
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
        command: 'echo "test output"'
      }
    }

    const result = await adapter.execute(request, createTestContext())

    expect(result.ok).toBe(true)
    expect(result.outputText).toContain('test output')
    expect(result.structuredData?.stdout).toContain('test output')
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
    expect(result.outputText).toContain('blocking safety issue')
  })

  it('应该格式化输出（从 DSXU 吸收）', async () => {
    const request: ToolCallRequest = {
      callId: 'test-7',
      toolName: 'Bash',
      arguments: {
        command: 'for i in 1 2 3 4 5 6 7 8 9 10; do echo "iteration $i"; done'
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
    expect(spec.description).toContain('formatted output')
    expect(spec.inputSchema.properties.timeout.minimum).toBe(1000)
    expect(spec.inputSchema.properties.timeout.maximum).toBe(300000)
    expect(spec.constraints?.dangerousPatterns).toContain('rm -rf /')
    expect(spec.constraints?.commandSemanticAnalysis).toBe(true)
  })
})

describe('ExternalToolAdapter - DSXU external capability owner', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
  })

  it('routes external tool calls through the configured DSXU gate', async () => {
    const gateCalls: Array<{ toolName: string; input: unknown }> = []
    const adapter = new ExternalToolAdapter(new Map([
      ['Tool1', { execute: async () => ({ content: 'plain string result', isError: false }) }],
    ]), {
      enabled: true,
      gatedTools: ['Tool1'],
      gateCheck: async (toolName, input) => {
        gateCalls.push({ toolName, input })
        return { allowed: true }
      },
    })

    const result = await adapter.execute({
      callId: 'test-9a',
      toolName: 'Tool1',
      arguments: { value: 1 },
    }, createTestContext())

    expect(result.ok).toBe(true)
    expect(result.outputText).toBe('plain string result')
    expect(result.metadata?.usedBridge).toBe(false)
    expect(gateCalls).toEqual([{ toolName: 'Tool1', input: { value: 1 } }])
  })

  it('blocks denied external tools at the DSXU gate', async () => {
    const adapter = new ExternalToolAdapter(new Map([
      ['Tool1', { execute: async () => ({ content: 'should not run', isError: false }) }],
    ]), {
      enabled: true,
      gatedTools: ['Tool1'],
      gateCheck: async () => ({ allowed: false, reason: 'blocked by owner gate' }),
    })

    const result = await adapter.execute({
      callId: 'test-9b',
      toolName: 'Tool1',
      arguments: {},
    }, createTestContext())

    expect(result.ok).toBe(false)
    expect(result.error?.type).toBe(ExternalToolErrorType.PERMISSION_DENIED)
    expect(result.outputText).toContain('blocked by owner gate')
    expect(result.metadata?.usedBridge).toBe(false)
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
    // FileEdit 错误类型应该与 ExternalTool 错误类型兼容
    expect(FileEditErrorType.PERMISSION_DENIED).toBe('PERMISSION_DENIED')
    expect(ExternalToolErrorType.PERMISSION_DENIED).toBe('PERMISSION_DENIED')

    expect(FileEditErrorType.VALIDATION_FAILED).toBe('VALIDATION_FAILED')
    expect(ExternalToolErrorType.VALIDATION_FAILED).toBe('VALIDATION_FAILED')

    expect(FileEditErrorType.EXECUTION_FAILED).toBe('EXECUTION_FAILED')
    expect(ExternalToolErrorType.EXECUTION_FAILED).toBe('EXECUTION_FAILED')
  })
})
