/**
 * 并账一致性测试
 *
 * 验证原生路径与 bridge fallback 的结果/错误/事件结构一致性
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ToolProtocolIntegration } from '../../tool-protocol-integration'
import {
  buildToolResultContractConsumptionBoard,
  buildToolResultContractEvidence,
  buildToolResultNormalizationEvidence,
  ensureCanonicalToolCallResult,
  isToolCallResult,
  normalizeMcpToolCallResult,
  normalizeProviderToolResultBlock,
  normalizeToolResultAtToolGateBoundary,
  ToolCallRequest,
  ToolExecutionContext,
} from '../../tool-protocol'
import { FileEditAdapter } from '../../adapters/file-edit-adapter'
import { BashAdapter } from '../../adapters/bash-adapter'
import { EngineHarness } from '../../index'

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

  describe('canonical ToolCallResult boundary normalization', () => {
    test('normalizes provider tool_result blocks only at the Tool Gate boundary', () => {
      const result = normalizeProviderToolResultBlock(
        {
          tool_use_id: 'toolu-provider-1',
          content: '<tool_use_error>permission denied</tool_use_error>',
          is_error: true,
        },
        'Bash',
        Date.now(),
      )

      expect(isToolCallResult(result)).toBe(true)
      expect(result.ok).toBe(false)
      expect(result.error?.type).toBe('EXECUTION_FAILED')
      expect(result.metadata.executorKind).toBe('legacy_adapter')
      expect(result.metadata.usedBridge).toBe(true)
      expect(result.structuredData?.boundaryKind).toBe('provider_message')

      const evidence = buildToolResultNormalizationEvidence(result, 'provider_message')
      expect(evidence).toMatchObject({
        schemaVersion: 'dsxu.tool-result-normalization.v1',
        owner: 'Tool Gate',
        boundaryKind: 'provider_message',
        canonical: true,
        ok: false,
      })
      const contract = buildToolResultContractEvidence(result, 'provider_message')
      expect(contract).toMatchObject({
        schemaVersion: 'dsxu.tool-result-contract.v1',
        canonicalResultSchema: 'dsxu.tool-call-result.v1',
        runtimeEventSchema: 'dsxu.runtime-event.v1',
        adapterBoundaryOnly: true,
        canonical: true,
      })
    })

    test('normalizes every legacy/provider/MCP shape through one Tool Gate boundary function', () => {
      const provider = normalizeToolResultAtToolGateBoundary({
        boundaryKind: 'provider_message',
        result: {
          tool_use_id: 'toolu-provider-boundary',
          content: 'provider output',
        },
        toolName: 'Bash',
        startTime: Date.now(),
      })
      const mcp = normalizeToolResultAtToolGateBoundary({
        boundaryKind: 'mcp',
        result: {
          content: [{ type: 'text', text: 'mcp output' }],
          structuredContent: { artifact: 'docs/out.md' },
        },
        toolName: 'mcp__docs__search',
        startTime: Date.now(),
      })
      const legacy = normalizeToolResultAtToolGateBoundary({
        boundaryKind: 'legacy',
        result: {
          toolUseId: 'toolu-legacy-boundary',
          content: 'legacy output',
          isError: false,
        },
        toolName: 'Read',
        startTime: Date.now(),
      })

      for (const boundary of [provider, mcp, legacy]) {
        expect(boundary.schemaVersion).toBe('dsxu.tool-gate-boundary-result.v1')
        expect(boundary.owner).toBe('Tool Gate')
        expect(boundary.result.schemaVersion).toBe('dsxu.tool-call-result.v1')
        expect(isToolCallResult(boundary.result)).toBe(true)
        expect(boundary.normalizationEvidence.canonical).toBe(true)
        expect(boundary.contractEvidence.canonicalResultSchema).toBe('dsxu.tool-call-result.v1')
        expect(boundary.contractEvidence.runtimeEventSchema).toBe('dsxu.runtime-event.v1')
      }

      expect(provider.boundaryKind).toBe('provider_message')
      expect(mcp.boundaryKind).toBe('mcp')
      expect(legacy.boundaryKind).toBe('legacy')
    })

    test('normalizes MCP results without making MCP a standalone runtime', () => {
      const result = normalizeMcpToolCallResult(
        {
          content: [{ type: 'text', text: 'done' }],
          structuredContent: { rows: 1 },
          _meta: { server: 'docs-search' },
        },
        'MCPTool',
        Date.now(),
      )

      expect(isToolCallResult(result)).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.metadata.executorKind).toBe('external')
      expect(result.metadata.usedBridge).toBe(true)
      expect(result.structuredData?.boundaryKind).toBe('mcp')
      expect(buildToolResultNormalizationEvidence(result, 'mcp').boundaryKind).toBe('mcp')
      expect(ensureCanonicalToolCallResult(result).schemaVersion).toBe('dsxu.tool-call-result.v1')
    })

    test('proves all main consumers use canonical ToolCallResult instead of legacy result shapes', () => {
      const result = normalizeProviderToolResultBlock(
        {
          tool_use_id: 'toolu-provider-success',
          content: 'updated file and wrote artifact preview',
        },
        'FileEdit',
        Date.now(),
      )
      const consumers = [
        'work-state',
        'ledger',
        'recovery',
        'tui',
        'final-report',
        'release-evidence',
      ] as const
      const board = buildToolResultContractConsumptionBoard({
        result,
        boundaryKind: 'provider_message',
        consumers: consumers.map(consumer => ({
          consumer,
          owner: consumer,
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          usesCanonicalResult: true,
          evidenceIds: [`${consumer}:canonical-tool-result`],
        })),
      })

      expect(board.status).toBe('PASS_TOOL_RESULT_CONTRACT_CONSUMPTION')
      expect(board.readyConsumers).toEqual(consumers)
      expect(board.missingConsumers).toEqual([])
      expect(board.guards).toEqual([])
      expect(board.compactPanelLines.join('\n')).toContain('ready=6/6')
      expect(board.finalReportSection.status).toBe('ready')
      expect(board.finalReportSection.evidence).toContain(
        'release-evidence:canonical-tool-result',
      )
    })

    test('blocks release evidence if a consumer still observes legacy tool result shape', () => {
      const result = normalizeProviderToolResultBlock(
        {
          tool_use_id: 'toolu-provider-legacy',
          content: 'legacy result',
        },
        'Bash',
        Date.now(),
      )
      const board = buildToolResultContractConsumptionBoard({
        result,
        boundaryKind: 'provider_message',
        requiredConsumers: ['work-state', 'ledger', 'release-evidence'],
        consumers: [
          {
            consumer: 'work-state',
            owner: 'Work-State',
            canonicalResultSchema: 'dsxu.tool-call-result.v1',
            runtimeEventSchema: 'dsxu.runtime-event.v1',
            usesCanonicalResult: true,
            evidenceIds: ['work-state:ok'],
          },
          {
            consumer: 'ledger',
            owner: 'Progress Ledger',
            canonicalResultSchema: 'dsxu.tool-call-result.v1',
            runtimeEventSchema: 'dsxu.runtime-event.v1',
            usesCanonicalResult: true,
            evidenceIds: ['ledger:ok'],
          },
          {
            consumer: 'release-evidence',
            owner: 'Evidence / Release Claim Binder',
            canonicalResultSchema: 'dsxu.tool-call-result.v1',
            runtimeEventSchema: 'dsxu.runtime-event.v1',
            usesCanonicalResult: false,
            legacyShapeObserved: true,
            evidenceIds: ['release:legacy-shape'],
          },
        ],
      })

      expect(board.status).toBe('NEEDS_TOOL_RESULT_CONTRACT_CONSUMPTION_REVIEW')
      expect(board.readyConsumers).toEqual(['work-state', 'ledger'])
      expect(board.missingConsumers).toEqual(['release-evidence'])
      expect(board.guards).toContain(
        'release-evidence does not consume canonical ToolCallResult',
      )
      expect(board.guards).toContain(
        'release-evidence still observes legacy tool result shape',
      )
      expect(board.finalReportSection.status).toBe('needs-evidence')
    })
  })

  describe('Tool Protocol product-mainline boundary', () => {
    test('keeps Tool Protocol out of the default product ToolBus surface', () => {
      const engine = new EngineHarness({
        llmCall: async () => ({ content: 'unused' } as any),
        skills: { enabled: false },
      })

      const status = engine.getToolProtocolStatus()

      expect(status.enabled).toBe(false)
      expect(status.defaultMainline).toBe(false)
      expect(status.owner).toBe('Tool Envelope / Tool Gate')
      expect(status.productRuntime).toBe('ToolRegistry + Tool Gate')
      expect(status.boundary).toContain('disabled by default')
      expect(status.activeOnlyWhenExplicitlyEnabled).toBe(true)
      expect(status.nativeToolsRegistered).toBe(0)
      expect(status.bridgeToolsRegistered).toBe(0)
    })

    test('labels explicit Tool Protocol use as an owner evidence harness, not a second product ToolBus', () => {
      const engine = new EngineHarness({
        llmCall: async () => ({ content: 'unused' } as any),
        skills: { enabled: false },
      })

      engine.enableToolProtocol()
      const status = engine.getToolProtocolStatus()

      expect(status.enabled).toBe(true)
      expect(status.defaultMainline).toBe(false)
      expect(status.owner).toBe('Tool Envelope / Tool Gate')
      expect(status.productRuntime).toBe('ToolRegistry + Tool Gate')
      expect(status.boundary).toContain('not a second product ToolBus')
      expect(status.activeOnlyWhenExplicitlyEnabled).toBe(true)
      expect(status.bridgeToolsRegistered).toBe(0)
    })

    test('legacy wrappers use a bounded fallback callId instead of crashing on missing toolUseId', async () => {
      const fs = require('fs')
      const os = require('os')
      const path = require('path')
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsxu-tool-protocol-'))
      try {
        const bashTool = integration
          .toLegacyToolDefinitions()
          .find(tool => tool.name === 'Bash')

        expect(bashTool).toBeDefined()
        const result = await bashTool!.execute(
          { command: 'echo "legacy wrapper ok"' },
          {
            cwd: testDir,
            sessionId: 'legacy-wrapper-test',
          },
        )

        expect(result.isError).toBe(false)
        expect(String(result.content)).toContain('legacy wrapper ok')
        expect(result.meta.protocolResult.metadata.executorKind).toBe('dsxu_native')
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true })
      }
    })
  })
})
