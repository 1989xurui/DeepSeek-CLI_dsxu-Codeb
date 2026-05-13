import { describe, expect, test } from 'bun:test'
import type { ToolUseBlock } from '../../../types/providerSdk.js'
import {
  createEditBudgetExhaustedBlockedMessage,
  createReadAfterEditBlockedMessage,
  createWriteFallbackAfterEditBlockedMessage,
  getDsxuToolBatchGateDecision,
  shouldBlockEditBudgetExhausted,
  shouldBlockReadAfterEditBeforeVerification,
  shouldBlockWriteFallbackAfterEdit,
} from '../../../services/tools/dsxuToolBatchGate.js'
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

function toolResult(content: string) {
  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'edit-1',
        content,
        is_error: false,
      },
    ],
    toolUseResult: content,
  })
}

function assistantFor(block: ToolUseBlock) {
  return createAssistantMessage({
    content: [block as never],
  })
}

describe('V18 edit convergence gate', () => {
  const editApplied = toolResult(
    'The file src/cart.ts has been updated successfully. The requested old_string has been replaced.\n' +
      'DSXU tool state: edit_applied; blocked=repeat_same_edit,shell_write_fallback,read_edited_file_to_confirm; next=planned_edit_or_verify.',
  )

  test('blocks same-file Write fallback after successful Edit before fresh verification', () => {
    const write = toolUse('Write', {
      file_path: 'src/cart.ts',
      content: 'fallback overwrite',
    })

    expect(shouldBlockWriteFallbackAfterEdit([editApplied], write)).toBe(true)

    const message = createWriteFallbackAfterEditBlockedMessage(
      write,
      assistantFor(write),
    )
    const block = Array.isArray(message.message.content)
      ? message.message.content[0]
      : null
    expect(block).toMatchObject({
      type: 'tool_result',
      is_error: true,
      tool_use_id: write.id,
    })
    expect(JSON.stringify(block)).toContain('write_fallback_blocked_after_edit')
  })

  test('blocks same-file Read after successful Edit before fresh verification', () => {
    const read = toolUse('Read', {
      file_path: 'src/cart.ts',
    })

    expect(shouldBlockReadAfterEditBeforeVerification([editApplied], read)).toBe(true)

    const message = createReadAfterEditBlockedMessage(read, assistantFor(read))
    expect(JSON.stringify(message.message.content)).toContain(
      'read_blocked_after_edit',
    )
  })

  test('allows same-file Read when explicit source-truth recovery is needed for another same-file Edit', () => {
    const sameFileFollowup = createUserMessage({
      content:
        'Complex task: make two Edits in the same file src/cart.ts. After the first Edit, reread the same file if needed before the next source Edit because context may be stale.',
    })
    const read = toolUse('Read', {
      file_path: 'src/cart.ts',
      description: 'Reread same file before the next source Edit',
    })

    expect(
      shouldBlockReadAfterEditBeforeVerification([
        sameFileFollowup,
        editApplied,
      ], read),
    ).toBe(false)
  })

  test('allows distinct-file Write so planned multi-file work can continue', () => {
    const writeOther = toolUse('Write', {
      file_path: 'src/cart.test.ts',
      content: 'new regression test',
    })

    expect(shouldBlockWriteFallbackAfterEdit([editApplied], writeOther)).toBe(false)
  })

  test('allows same-file repair after a fresh failed verification following the Edit', () => {
    const failedVerification = toolResult(
      'bun test src/cart.test.ts\n1 fail\n0 pass\nDSXU tool state: verification_failed; blocked=latest_native_failure; next=source_repair.',
    )
    const write = toolUse('Write', {
      file_path: 'src/cart.ts',
      content: 'repair after test failure',
    })
    const read = toolUse('Read', {
      file_path: 'src/cart.ts',
    })

    expect(shouldBlockWriteFallbackAfterEdit([editApplied, failedVerification], write)).toBe(false)
    expect(shouldBlockReadAfterEditBeforeVerification([editApplied, failedVerification], read)).toBe(false)
  })

  test('clears the edit convergence gate after verification passed', () => {
    const verificationPassed = toolResult(
      'bun test src/cart.test.ts\n1 pass\n0 fail\nDSXU tool state: verification_passed; blocked=post_pass_tool_call; next=final_answer.',
    )
    const read = toolUse('Read', {
      file_path: 'src/cart.ts',
    })

    expect(shouldBlockReadAfterEditBeforeVerification([editApplied, verificationPassed], read)).toBe(false)
  })

  test('blocks extra mutations after an explicit exactly-N edit contract is exhausted', () => {
    const contract = createUserMessage({
      content:
        'DSXU edit budget contract: max_successful_edits=2; exact_successful_edits=2. Apply exactly two sequential Edits.',
    })
    const secondEditApplied = toolResult(
      'The file src/cart.test.ts has been updated successfully.\nDSXU tool state: edit_applied; next=planned_edit_or_verify.',
    )
    const extraEdit = toolUse('Edit', {
      file_path: 'src/cart.ts',
      old_string: 'old',
      new_string: 'new',
    })

    expect(
      shouldBlockEditBudgetExhausted(
        [contract, editApplied, secondEditApplied],
        [extraEdit],
        extraEdit,
      ),
    ).toBe(true)
    expect(
      getDsxuToolBatchGateDecision({
        messages: [contract, editApplied, secondEditApplied],
        toolUseBlocks: [extraEdit],
        block: extraEdit,
      }),
    ).toMatchObject({
      gateId: 'dsxu_edit_budget_gate',
      gateClass: 'BENCH_CONTRACT_ONLY',
      blocked: false,
    })

    const message = createEditBudgetExhaustedBlockedMessage(
      extraEdit,
      assistantFor(extraEdit),
    )
    expect(JSON.stringify(message.message.content)).toContain(
      'edit_budget_exhausted',
    )
    expect(JSON.stringify(message.message.content)).toContain(
      'exact_edit_budget_reached',
    )
  })

  test('blocks same-batch mutation overflow before the extra Edit runs', () => {
    const contract = createUserMessage({
      content:
        'DSXU edit budget contract: max_successful_edits=2; exact_successful_edits=2.',
    })
    const secondEdit = toolUse(
      'Edit',
      {
        file_path: 'src/cart.test.ts',
        old_string: 'old',
        new_string: 'new',
      },
      'edit-2',
    )
    const thirdEdit = toolUse(
      'Edit',
      {
        file_path: 'src/other.ts',
        old_string: 'old',
        new_string: 'new',
      },
      'edit-3',
    )

    expect(
      shouldBlockEditBudgetExhausted(
        [contract, editApplied],
        [secondEdit, thirdEdit],
        secondEdit,
      ),
    ).toBe(false)
    expect(
      shouldBlockEditBudgetExhausted(
        [contract, editApplied],
        [secondEdit, thirdEdit],
        thirdEdit,
      ),
    ).toBe(true)
  })

  test('does not limit normal tasks without an explicit edit budget', () => {
    const edit = toolUse('Edit', {
      file_path: 'src/cart.test.ts',
      old_string: 'old',
      new_string: 'new',
    })

    expect(shouldBlockEditBudgetExhausted([editApplied], [edit], edit)).toBe(false)
  })
})
