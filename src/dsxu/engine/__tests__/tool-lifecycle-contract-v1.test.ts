import { describe, expect, test } from 'bun:test'
import { z } from 'zod/v4'
import { buildTool } from '../../../Tool.js'
import {
  getDsxuToolExecutionSemantics,
  getDsxuToolPathLifecycle,
  buildDsxuToolRuntimeEventBoundary,
  mapDsxuToolResultForLifecycle,
} from '../../../services/tools/toolLifecycle.js'

describe('DSXU tool lifecycle contract V1', () => {
  test('classifies tool execution semantics in one fail-closed path', () => {
    const tool = buildTool({
      name: 'ThrowingSafeTool',
      inputSchema: z.object({ value: z.string() }),
      async call() {
        return { data: 'ok' }
      },
      async description() {
        return 'test tool'
      },
      async prompt() {
        return 'test tool'
      },
      isConcurrencySafe() {
        throw new Error('classifier failed')
      },
      isReadOnly() {
        return true
      },
      isDestructive() {
        return true
      },
      mapToolResultToToolResultBlockParam(content, toolUseID) {
        return {
          type: 'tool_result',
          content: String(content),
          tool_use_id: toolUseID,
        }
      },
      maxResultSizeChars: Infinity,
      userFacingName() {
        return 'ThrowingSafeTool'
      },
    })

    expect(
      getDsxuToolExecutionSemantics(tool, { value: 42 }),
    ).toMatchObject({
      toolFound: true,
      inputParsed: false,
      isConcurrencySafe: false,
      isReadOnly: false,
      isDestructive: false,
    })
    expect(
      getDsxuToolExecutionSemantics(tool, { value: 'ok' }),
    ).toMatchObject({
      toolFound: true,
      inputParsed: true,
      isConcurrencySafe: false,
      isReadOnly: true,
      isDestructive: true,
    })
    expect(
      getDsxuToolExecutionSemantics(undefined, { value: 'ok' }),
    ).toMatchObject({
      toolFound: false,
      inputParsed: false,
      isConcurrencySafe: false,
      isReadOnly: false,
      isDestructive: false,
      inputError: 'tool_not_found',
    })
  })

  test('normalizes path and result mapping lifecycle evidence in one contract', () => {
    const tool = buildTool({
      name: 'PathResultTool',
      inputSchema: z.object({ file_path: z.string() }),
      async call() {
        return { data: { text: 'ok' } }
      },
      async description() {
        return 'test tool'
      },
      async prompt() {
        return 'test tool'
      },
      getPath(input) {
        return input.file_path
      },
      mapToolResultToToolResultBlockParam(content, toolUseID) {
        return {
          type: 'tool_result',
          content: [{ type: 'text', text: content.text }],
          tool_use_id: toolUseID,
        }
      },
      maxResultSizeChars: Infinity,
      userFacingName() {
        return 'PathResultTool'
      },
    })

    const pathLifecycle = getDsxuToolPathLifecycle(
      tool,
      { file_path: 'src\\feature.ts' },
      'D:\\repo',
    )
    expect(pathLifecycle).toMatchObject({
      cwd: 'D:/repo',
      rawPath: 'src/feature.ts',
      normalizedPath: 'D:/repo/src/feature.ts',
      relativePath: 'src/feature.ts',
      isInsideCwd: true,
    })

    const mapped = mapDsxuToolResultForLifecycle(
      tool,
      { text: 'ok' },
      'toolu-result-1',
    )
    expect(mapped.block.tool_use_id).toBe('toolu-result-1')
    expect(mapped.contentKind).toBe('blocks')
    expect(mapped.sizeBytes).toBeGreaterThan(0)
  })

  test('folds legacy tool result blocks into canonical runtime event boundary', () => {
    const tool = buildTool({
      name: 'RuntimeBoundaryTool',
      inputSchema: z.object({ value: z.string() }),
      async call() {
        return { data: 'ok' }
      },
      async description() {
        return 'test tool'
      },
      async prompt() {
        return 'test tool'
      },
      mapToolResultToToolResultBlockParam(content, toolUseID) {
        return {
          type: 'tool_result',
          content: String(content),
          tool_use_id: toolUseID,
        }
      },
      maxResultSizeChars: Infinity,
      userFacingName() {
        return 'RuntimeBoundaryTool'
      },
    })

    const mapped = mapDsxuToolResultForLifecycle(
      tool,
      'canonical output',
      'toolu-boundary-1',
    )
    const boundary = buildDsxuToolRuntimeEventBoundary({
      toolUseID: 'toolu-boundary-1',
      toolName: tool.name,
      mapping: mapped,
      startTime: Date.now() - 12,
      taskId: 'task-runtime-boundary',
      turnId: 'turn-1',
    })

    expect(boundary.canonicalResult.schemaVersion).toBe(
      'dsxu.tool-call-result.v1',
    )
    expect(boundary.contractEvidence).toMatchObject({
      schemaVersion: 'dsxu.tool-result-contract.v1',
      canonicalResultSchema: 'dsxu.tool-call-result.v1',
      runtimeEventSchema: 'dsxu.runtime-event.v1',
      boundaryKind: 'provider_message',
      adapterBoundaryOnly: true,
      canonical: true,
      ok: true,
    })
    expect(boundary.ledgerEvent).toMatchObject({
      kind: 'tool',
      owner: 'Tool Gate',
      taskId: 'task-runtime-boundary',
      turnId: 'turn-1',
      toolUseId: 'toolu-boundary-1',
    })
    expect(boundary.ledgerEvent.evidence).toContain('schema:ToolCallResult')
    expect(boundary.workStateEvent).toMatchObject({
      kind: 'tool',
      status: 'completed',
      owner: 'Tool Gate',
      taskId: 'task-runtime-boundary',
      turnId: 'turn-1',
      toolUseId: 'toolu-boundary-1',
    })
    expect(boundary.workStateEvent.evidence?.join('\n')).toContain(
      'outputChars:16',
    )
  })
})
