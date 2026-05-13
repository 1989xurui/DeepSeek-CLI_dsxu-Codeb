import { describe, expect, test } from 'bun:test'
import type { ToolUseBlock } from '../../../types/providerSdk.js'
import {
  createReadCacheHitRepeatBlockedMessage,
  createRepeatedSemanticToolBlockedMessage,
  getDsxuToolBatchGateDecision,
  shouldBlockReadCacheHitRepeat,
  shouldBlockRepeatedSemanticToolInBatch,
  shouldBlockToolAfterAssistantPassMarker,
} from '../../../services/tools/dsxuToolBatchGate.js'
import { StreamingToolExecutor } from '../../../services/tools/StreamingToolExecutor.js'
import { createAssistantMessage, createUserMessage } from '../../../utils/messages.js'

function toolUse(
  name: string,
  input: Record<string, unknown>,
  id = `${name.toLowerCase()}-1`,
): ToolUseBlock {
  return {
    type: 'tool_use',
    id,
    name,
    input,
  }
}

function assistantWith(block: ToolUseBlock) {
  return createAssistantMessage({
    content: [block as never],
  })
}

function resultFor(toolUseId: string, content: string) {
  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content,
        is_error: false,
      },
    ],
    toolUseResult: content,
  })
}

describe('V18 semantic tool gate', () => {
  test('blocks identical same-batch Read targets while allowing the first call', () => {
    const first = toolUse('Read', { file_path: 'D:\\DSXU-code\\src\\query.ts' }, 'read-1')
    const duplicate = toolUse('Read', { path: 'd:/dsxu-code/src/query.ts' }, 'read-2')
    const batch = [first, duplicate]

    expect(shouldBlockRepeatedSemanticToolInBatch(batch, first)).toBe(false)
    expect(shouldBlockRepeatedSemanticToolInBatch(batch, duplicate)).toBe(true)

    const message = createRepeatedSemanticToolBlockedMessage(
      duplicate,
      assistantWith(duplicate),
    )
    expect(JSON.stringify(message.message.content)).toContain(
      'repeated_semantic_tool_blocked',
    )
  })

  test('blocks identical same-batch shell commands after whitespace normalization', () => {
    const first = toolUse('PowerShell', { command: 'Test-Path   "D:\\DSXU-code"' }, 'ps-1')
    const duplicate = toolUse('PowerShell', { command: 'Test-Path "D:\\DSXU-code"' }, 'ps-2')

    expect(shouldBlockRepeatedSemanticToolInBatch([first, duplicate], duplicate)).toBe(true)
  })

  test('detects a repeated Read after read_cache_hit but keeps it advisory in the main tool gate', () => {
    const read = toolUse('Read', { file_path: 'src/cart.ts' }, 'read-1')
    const repeat = toolUse('Read', { file_path: 'src/cart.ts' }, 'read-2')
    const cacheHit = resultFor(
      'read-1',
      'DSXU tool state: read_cache_hit. File unchanged since last read.',
    )

    expect(shouldBlockReadCacheHitRepeat([assistantWith(read), cacheHit], repeat)).toBe(true)

    expect(
      getDsxuToolBatchGateDecision({
        messages: [assistantWith(read), cacheHit],
        toolUseBlocks: [repeat],
        block: repeat,
      }),
    ).toMatchObject({
      gateId: 'dsxu_read_cache_repeat_gate',
      gateClass: 'COST_SMELL',
      blocked: false,
    })

    const blocked = createReadCacheHitRepeatBlockedMessage(
      repeat,
      assistantWith(repeat),
    )
    expect(JSON.stringify(blocked.message.content)).toContain(
      'read_cache_repeat_blocked',
    )

    const editApplied = resultFor(
      'edit-1',
      'The file src/cart.ts has been updated successfully.\nDSXU tool state: edit_applied; next=verify.',
    )
    expect(
      shouldBlockReadCacheHitRepeat(
        [assistantWith(read), cacheHit, editApplied],
        repeat,
      ),
    ).toBe(false)
  })

  test('blocks duplicate streamed tool use at the executor boundary before execution', async () => {
    const first = toolUse('Read', { file_path: 'src/query.ts' }, 'read-1')
    const duplicate = toolUse('Read', { file_path: 'src/query.ts' }, 'read-2')
    const assistant = assistantWith(duplicate)
    const executor = new StreamingToolExecutor(
      [],
      (async () => ({ behavior: 'allow', updatedInput: {} })) as never,
      {
        messages: [],
        options: { tools: [] },
        abortController: new AbortController(),
        setInProgressToolUseIDs() {},
        setResponseLength() {},
        getAppState: () => ({}) as never,
        setAppState() {},
        readFileState: {} as never,
        updateFileHistoryState() {},
        updateAttributionState() {},
      } as never,
    )

    executor.addTool(duplicate, assistant, [first, duplicate])
    const updates = []
    for await (const update of executor.getRemainingResults()) {
      updates.push(update)
    }

    expect(updates).toHaveLength(1)
    expect(JSON.stringify(updates[0]?.message?.message.content)).toContain(
      'repeated_semantic_tool_blocked',
    )
  })

  test('blocks any tool after assistant has emitted a terminal benchmark PASS marker', () => {
    const read = toolUse('Read', { file_path: 'src/cart.ts' }, 'read-after-pass')
    const assistantPass = createAssistantMessage({
      content: [
        {
          type: 'text',
          text: 'Tests pass: 1 pass, 0 fail.\n\nDSXU_BENCH_V8_REAL_FEATURE_PASS',
        } as never,
      ],
    })
    const assistantMention = createAssistantMessage({
      content: [
        {
          type: 'text',
          text: 'When done, finish with DSXU_BENCH_V8_REAL_FEATURE_PASS after verification.',
        } as never,
      ],
    })

    expect(shouldBlockToolAfterAssistantPassMarker([assistantPass], read)).toBe(true)
    expect(shouldBlockToolAfterAssistantPassMarker([assistantMention], read)).toBe(false)
  })
})
