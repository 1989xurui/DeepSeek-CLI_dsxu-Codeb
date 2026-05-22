import { describe, expect, test } from 'bun:test'
import type { ToolUseBlock } from '../../../types/providerSdk.js'
import { getDsxuToolBatchGateDecision } from '../../../services/tools/dsxuToolBatchGate.js'
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

function assistantFor(block: ToolUseBlock) {
  return createAssistantMessage({
    content: [block as never],
  })
}

function toolResult(toolUseId: string, content: string) {
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

describe('DSXU tool batch gate classification V1', () => {
  test('classifies repeated same-batch tool calls as a capability nudge', () => {
    const first = toolUse('Read', { file_path: 'src/cart.ts' }, 'read-1')
    const second = toolUse('Read', { file_path: 'src/cart.ts' }, 'read-2')

    const decision = getDsxuToolBatchGateDecision({
      messages: [],
      toolUseBlocks: [first, second],
      block: second,
    })

    expect(decision).toMatchObject({
      owner: 'tool_lifecycle',
      gateId: 'dsxu_repeated_semantic_tool_gate',
      gateKind: 'tool_batch',
      gateClass: 'CAPABILITY_NUDGE',
      reason: 'repeated_semantic_tool',
      blocked: true,
      nextAction: 'use_existing_result_or_strategy_change',
    })
    expect(
      JSON.stringify(decision!.createMessage(assistantFor(second)).message.content),
    ).toContain('repeated_semantic_tool_blocked')
  })

  test('classifies read-cache repeat as a nonblocking cost smell', () => {
    const first = toolUse('Read', { file_path: 'src/cart.ts' }, 'read-1')
    const repeat = toolUse('Read', { file_path: 'src/cart.ts' }, 'read-2')
    const decision = getDsxuToolBatchGateDecision({
      messages: [
        createAssistantMessage({ content: [first as never] }),
        toolResult(
          first.id,
          'Read cache hit for src/cart.ts\nDSXU tool state: read_cache_hit; next=advance_cursor.',
        ),
      ],
      toolUseBlocks: [repeat],
      block: repeat,
    })

    expect(decision).toMatchObject({
      gateId: 'dsxu_read_cache_repeat_gate',
      gateClass: 'COST_SMELL',
      reason: 'read_cache_hit_repeat',
      blocked: false,
      nextAction: 'advance_cursor_or_verify',
    })
  })

  test('classifies exact edit budgets as nonblocking benchmark-contract-only gates', () => {
    const contract = createUserMessage({
      content:
        'DSXU edit budget contract: max_successful_edits=2; exact_successful_edits=2. Apply exactly two sequential Edits.',
    })
    const extra = toolUse('Edit', {
      file_path: 'src/cart.ts',
      old_string: 'old',
      new_string: 'new',
    })

    const decision = getDsxuToolBatchGateDecision({
      messages: [
        contract,
        toolResult(
          'edit-1',
          'The file src/cart.ts has been updated successfully.\nDSXU tool state: edit_applied; next=planned_edit_or_verify.',
        ),
        toolResult(
          'edit-2',
          'The file src/cart.test.ts has been updated successfully.\nDSXU tool state: edit_applied; next=planned_edit_or_verify.',
        ),
      ],
      toolUseBlocks: [extra],
      block: extra,
    })

    expect(decision).toMatchObject({
      gateId: 'dsxu_edit_budget_gate',
      gateClass: 'BENCH_CONTRACT_ONLY',
      reason: 'edit_budget_exhausted',
      blocked: false,
      nextAction: 'verify_or_final_or_partial',
    })
  })

  test('classifies same-batch mutation plus verification as a quality block', () => {
    const edit = toolUse(
      'Edit',
      {
        file_path: 'src/cart.ts',
        old_string: 'old',
        new_string: 'new',
      },
      'edit-1',
    )
    const verify = toolUse('Bash', { command: 'bun test src/cart.test.ts' }, 'bash-1')

    const decision = getDsxuToolBatchGateDecision({
      messages: [],
      toolUseBlocks: [edit, verify],
      block: verify,
    })

    expect(decision).toMatchObject({
      gateId: 'dsxu_unsafe_batch_verification_gate',
      gateClass: 'QUALITY_BLOCK',
      reason: 'unsafe_batch_verification',
      blocked: true,
      nextAction: 'wait_for_mutation_result_then_verify',
    })
  })

  test('classifies verification-after-pass as a finalization quality block, not a cost gate', () => {
    const verifyAgain = toolUse(
      'Bash',
      { command: 'bun test src/cart.test.ts' },
      'bash-after-pass',
    )
    const decision = getDsxuToolBatchGateDecision({
      messages: [
        toolResult(
          'bash-pass',
          'bun test src/cart.test.ts\n1 pass\n0 fail\nDSXU tool state: verification_passed; next=final_answer.',
        ),
      ],
      toolUseBlocks: [verifyAgain],
      block: verifyAgain,
    })

    expect(decision).toMatchObject({
      owner: 'tool_lifecycle',
      gateId: 'dsxu_post_pass_tool_gate',
      gateKind: 'tool_batch',
      gateClass: 'QUALITY_BLOCK',
      reason: 'post_pass',
      blocked: true,
      nextAction: 'final_answer_after_verified_pass',
    })
    expect(
      JSON.stringify(decision!.createMessage(assistantFor(verifyAgain)).message.content),
    ).toContain('tool_blocked_after_pass')
  })

  test('classifies tool-after-CollectEvidence-PASS as finalization quality block', () => {
    const readAfterEvidence = toolUse(
      'Read',
      { file_path: 'src/cart.ts' },
      'read-after-evidence',
    )
    const decision = getDsxuToolBatchGateDecision({
      messages: [
        toolResult(
          'collect-pass',
          [
            'CollectEvidence status: PASS',
            'latest=native_test exit=0 signal=RunNativeTest status: pass',
            'DSXU tool state: evidence_collected; semanticTool=CollectEvidence; next=final_answer.',
          ].join('\n'),
        ),
      ],
      toolUseBlocks: [readAfterEvidence],
      block: readAfterEvidence,
    })

    expect(decision).toMatchObject({
      owner: 'tool_lifecycle',
      gateId: 'dsxu_post_pass_tool_gate',
      gateKind: 'tool_batch',
      gateClass: 'QUALITY_BLOCK',
      reason: 'post_pass',
      blocked: true,
      nextAction: 'final_answer_after_verified_pass',
    })
    expect(
      JSON.stringify(decision!.createMessage(assistantFor(readAfterEvidence)).message.content),
    ).toContain('tool_blocked_after_pass')
  })

  test('does not classify tool-after-CollectEvidence-PARTIAL as verified final', () => {
    const readAfterPartial = toolUse(
      'Read',
      { file_path: 'src/cart.ts' },
      'read-after-partial',
    )
    const decision = getDsxuToolBatchGateDecision({
      messages: [
        toolResult(
          'collect-partial',
          [
            'CollectEvidence status: PARTIAL',
            'latest=native_test exit=1 signal=RunNativeTest status: fail',
            'DSXU tool state: evidence_collected; semanticTool=CollectEvidence; next=repair_or_report_partial.',
          ].join('\n'),
        ),
      ],
      toolUseBlocks: [readAfterPartial],
      block: readAfterPartial,
    })

    expect(decision?.gateId).not.toBe('dsxu_post_pass_tool_gate')
  })
})
