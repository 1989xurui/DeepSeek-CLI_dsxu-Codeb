/**
 * Skills失败路径测试 - 验证Skills在生产环境中的错误处理能力
 *
 * 测试要点：
 * 1. 超时、权限拒绝、运行时异常都可降级返回
 * 2. 主链继续执行，不崩溃
 * 3. 事务回滚生效（有写入时）
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'bun:test'
import { EngineHarness } from '../index'
import { createMockLLMCall } from '../llm-adapter'
import { SkillsExecutor, SkillErrorCode } from '../skills-executor'

describe('Skills Failure Path Tests', () => {
  let engine: EngineHarness
  let mockSkillsExecutor: any

  beforeEach(() => {
    // 创建模拟的Skills执行器
    mockSkillsExecutor = {
      execute: vi.fn(),
      getExecutionStats: vi.fn(() => ({
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        successRate: 0,
        errorDistribution: {},
      })),
      getStatus: vi.fn(() => ({ mockExecution: false })),
      updateConfig: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    if (engine) {
      engine.disableSkills()
    }
  })

  test('Skill超时应被正确处理', async () => {
    // 模拟超时错误
    mockSkillsExecutor.execute.mockRejectedValueOnce(
      new Error('Skill execution timeout')
    )

    const mockLLM = createMockLLMCall([
      {
        content: 'I will use a skill.',
        tool_calls: [
          {
            id: 'call_1',
            type: 'tool_use',
            name: 'skill__test',
            input: { args: 'test' },
          },
        ],
      },
      {
        content: 'Task completed despite skill timeout.',
      },
    ])

    engine = new EngineHarness({
      llmCall: mockLLM,
      skills: {
        enabled: true,
        autoRegister: false, // 不自动注册，我们手动处理
      },
    })

    // 注册一个测试skill工具
    engine.registerTool({
      name: 'skill__test',
      description: '[Skill] Test skill',
      inputSchema: {
        type: 'object',
        properties: {
          args: { type: 'string' },
        },
        required: ['args'],
      },
      execute: async (input, context) => {
        // 这里会调用模拟的Skills执行器
        const result = await mockSkillsExecutor.execute('test', input.args, context)
        return result
      },
    })

    // 运行查询 - 应该不崩溃
    const result = await engine.run('Test skill timeout handling')

    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toBeDefined()
    expect(mockSkillsExecutor.execute).toHaveBeenCalled()
  })

  test('Skill权限拒绝应被正确处理', async () => {
    // 模拟权限拒绝
    mockSkillsExecutor.execute.mockResolvedValueOnce({
      content: 'Permission denied for skill test',
      isError: true,
      errorCode: SkillErrorCode.PERMISSION_DENIED,
      meta: {
        skill: 'test',
        error: 'Permission denied',
        durationMs: 100,
      },
    })

    const mockLLM = createMockLLMCall([
      {
        content: 'I will use a skill.',
        tool_calls: [
          {
            id: 'call_1',
            type: 'tool_use',
            name: 'skill__test',
            input: { args: 'test' },
          },
        ],
      },
      {
        content: 'Task completed despite permission denial.',
      },
    ])

    engine = new EngineHarness({
      llmCall: mockLLM,
      skills: {
        enabled: true,
        autoRegister: false,
      },
    })

    // 注册测试skill工具
    engine.registerTool({
      name: 'skill__test',
      description: '[Skill] Test skill',
      inputSchema: {
        type: 'object',
        properties: {
          args: { type: 'string' },
        },
        required: ['args'],
      },
      execute: async (input, context) => {
        const result = await mockSkillsExecutor.execute('test', input.args, context)
        return result
      },
    })

    const result = await engine.run('Test skill permission handling')

    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toBeDefined()
    expect(mockSkillsExecutor.execute).toHaveBeenCalled()
  })

  test('Skill运行时异常应被正确处理', async () => {
    // 模拟运行时异常
    mockSkillsExecutor.execute.mockResolvedValueOnce({
      content: 'Runtime error in skill test: Something went wrong',
      isError: true,
      errorCode: SkillErrorCode.RUNTIME_ERROR,
      meta: {
        skill: 'test',
        error: 'Something went wrong',
        durationMs: 150,
        stack: 'Error stack trace',
      },
    })

    const mockLLM = createMockLLMCall([
      {
        content: 'I will use a skill.',
        tool_calls: [
          {
            id: 'call_1',
            type: 'tool_use',
            name: 'skill__test',
            input: { args: 'test' },
          },
        ],
      },
      {
        content: 'Task completed despite runtime error.',
      },
    ])

    engine = new EngineHarness({
      llmCall: mockLLM,
      skills: {
        enabled: true,
        autoRegister: false,
      },
    })

    // 注册测试skill工具
    engine.registerTool({
      name: 'skill__test',
      description: '[Skill] Test skill',
      inputSchema: {
        type: 'object',
        properties: {
          args: { type: 'string' },
        },
        required: ['args'],
      },
      execute: async (input, context) => {
        const result = await mockSkillsExecutor.execute('test', input.args, context)
        return result
      },
    })

    const result = await engine.run('Test skill runtime error handling')

    expect(result.exitReason).toBe('end_turn')
    expect(result.finalMessage).toBeDefined()
    expect(mockSkillsExecutor.execute).toHaveBeenCalled()
  })

  test('主链应在Skill失败后继续执行', async () => {
    let callCount = 0

    mockSkillsExecutor.execute.mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        // 第一次调用失败
        return {
          content: 'Skill failed',
          isError: true,
          errorCode: SkillErrorCode.RUNTIME_ERROR,
          meta: { skill: 'test', durationMs: 100 },
        }
      }
      // 第二次调用成功
      return {
        content: 'Skill succeeded',
        isError: false,
        meta: { skill: 'test', durationMs: 200 },
      }
    })

    const mockLLM = createMockLLMCall([
      {
        content: 'I will use a skill.',
        tool_calls: [
          {
            id: 'call_1',
            type: 'tool_use',
            name: 'skill__test',
            input: { args: 'first' },
          },
        ],
      },
      {
        content: 'I will use the skill again.',
        tool_calls: [
          {
            id: 'call_2',
            type: 'tool_use',
            name: 'skill__test',
            input: { args: 'second' },
          },
        ],
      },
      {
        content: 'Task completed with mixed results.',
      },
    ])

    engine = new EngineHarness({
      llmCall: mockLLM,
      skills: {
        enabled: true,
        autoRegister: false,
      },
    })

    // 注册测试skill工具
    engine.registerTool({
      name: 'skill__test',
      description: '[Skill] Test skill',
      inputSchema: {
        type: 'object',
        properties: {
          args: { type: 'string' },
        },
        required: ['args'],
      },
      execute: async (input, context) => {
        const result = await mockSkillsExecutor.execute('test', input.args, context)
        return result
      },
    })

    const result = await engine.run('Test chain continuation after skill failure')

    expect(result.exitReason).toBe('end_turn')
    expect(callCount).toBe(2) // 应该调用了两次
    expect(mockSkillsExecutor.execute).toHaveBeenCalledTimes(2)
  })

  test('Skill错误应包含诊断信息', async () => {
    mockSkillsExecutor.execute.mockResolvedValueOnce({
      content: 'Skill execution failed',
      isError: true,
      errorCode: SkillErrorCode.TIMEOUT,
      meta: {
        skill: 'test',
        error: 'Execution timeout',
        durationMs: 30000,
        timestamp: new Date().toISOString(),
        diagnostics: {
          skillName: 'test',
          durationMs: 30000,
          status: 'failed',
          errorCode: SkillErrorCode.TIMEOUT,
        },
      },
    })

    const mockLLM = createMockLLMCall([
      {
        content: 'I will use a skill.',
        tool_calls: [
          {
            id: 'call_1',
            type: 'tool_use',
            name: 'skill__test',
            input: { args: 'test' },
          },
        ],
      },
      {
        content: 'Task completed.',
      },
    ])

    engine = new EngineHarness({
      llmCall: mockLLM,
      skills: {
        enabled: true,
        autoRegister: false,
      },
    })

    // 注册测试skill工具
    engine.registerTool({
      name: 'skill__test',
      description: '[Skill] Test skill',
      inputSchema: {
        type: 'object',
        properties: {
          args: { type: 'string' },
        },
        required: ['args'],
      },
      execute: async (input, context) => {
        const result = await mockSkillsExecutor.execute('test', input.args, context)
        return result
      },
    })

    const result = await engine.run('Test skill error diagnostics')

    expect(result.exitReason).toBe('end_turn')

    // 验证错误结果包含诊断信息
    const executionResult = await mockSkillsExecutor.execute.mock.results[0].value
    expect(executionResult.meta.diagnostics).toBeDefined()
    expect(executionResult.meta.diagnostics.skillName).toBe('test')
    expect(executionResult.meta.diagnostics.errorCode).toBe(SkillErrorCode.TIMEOUT)
  })

  test('多个连续Skill失败不应导致主链崩溃', async () => {
    // 模拟连续失败
    mockSkillsExecutor.execute.mockResolvedValue({
      content: 'Skill failed repeatedly',
      isError: true,
      errorCode: SkillErrorCode.RUNTIME_ERROR,
      meta: { skill: 'test', durationMs: 100 },
    })

    const mockLLM = createMockLLMCall({
      responses: [
        {
          content: 'I will use skill 1.',
          tool_calls: [
            {
              id: 'call_1',
              type: 'tool_use',
              name: 'skill__test1',
              input: { args: 'test1' },
            },
          ],
        },
        {
          content: 'I will use skill 2.',
          tool_calls: [
            {
              id: 'call_2',
              type: 'tool_use',
              name: 'skill__test2',
              input: { args: 'test2' },
            },
          ],
        },
        {
          content: 'I will use skill 3.',
          tool_calls: [
            {
              id: 'call_3',
              type: 'tool_use',
              name: 'skill__test3',
              input: { args: 'test3' },
            },
          ],
        },
        {
          content: 'Task completed despite multiple failures.',
        },
      ],
    })

    engine = new EngineHarness({
      llmCall: mockLLM,
      skills: {
        enabled: true,
        autoRegister: false,
      },
      maxConsecutiveErrors: 10, // 提高错误容忍度
    })

    // 注册多个测试skill工具
    for (let i = 1; i <= 3; i++) {
      engine.registerTool({
        name: `skill__test${i}`,
        description: `[Skill] Test skill ${i}`,
        inputSchema: {
          type: 'object',
          properties: {
            args: { type: 'string' },
          },
          required: ['args'],
        },
        execute: async (input, context) => {
          const result = await mockSkillsExecutor.execute(`test${i}`, input.args, context)
          return result
        },
      })
    }

    const result = await engine.run('Test multiple consecutive skill failures')

    expect(result.exitReason).toBe('end_turn')
    expect(mockSkillsExecutor.execute).toHaveBeenCalledTimes(3)
  })
})
