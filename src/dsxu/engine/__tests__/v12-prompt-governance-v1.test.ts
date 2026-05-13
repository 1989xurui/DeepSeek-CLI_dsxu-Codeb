import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildSystemPrompt, SystemPromptBuilder } from '../system-prompt'
import { getEnterPlanModeToolPrompt } from '../../../tools/EnterPlanModeTool/prompt'
import { EXIT_PLAN_MODE_V2_TOOL_PROMPT } from '../../../tools/ExitPlanModeTool/prompt'
import { getEditToolDescription } from '../../../tools/FileEditTool/prompt'
import { getDsxuAgentPromptRuntimeProfile } from '../../../tools/AgentTool/prompt'
import { TaskOutputTool } from '../../../tools/TaskOutputTool/TaskOutputTool'
import { getDsxuPromptGovernanceContract } from '../../../constants/prompts'
import { getCompactPrompt, getPartialCompactPrompt } from '../../../services/compact/prompt'
import {
  buildDsxuAgentFinalGateNudge,
  buildDsxuBackgroundTaskFinalGateNudge,
  buildDsxuEmptyFinalAnswerNudge,
  buildDsxuExecutionVisibilityNudge,
  buildDsxuIntentOnlyFinalNudge,
  buildDsxuRecoveryState,
  buildDsxuContextBudgetSystemContext,
  buildDsxuToolStateCursorNudge,
  getDsxuDiscoveryStreakSinceProgress,
  getDsxuFailedVerificationStreakSinceEdit,
} from '../../../query'
import {
  createDsxuTaskStateSnapshot,
  createDsxuTaskStateSnapshotFromMessages,
  getDsxuTaskGovernanceRuntimeProfile,
  isPathAllowedByDsxuScopeFence,
  isToolAllowedByDsxuScopeFence,
  parseDsxuScopeFence,
  readDsxuTaskStateSnapshot,
  renderDsxuTaskStateSnapshotForResume,
  selectDsxuWorkflowPreferences,
  writeDsxuTaskStateSnapshot,
} from '../task-governance'
import {
  createDiscoveryNarrowingRequiredMessage,
  createParentMutationAfterWorkerOwnershipBlockedMessage,
  createPrematureVerificationBeforeExactEditBudgetBlockedMessage,
  createRepeatedFailedVerificationBlockedMessage,
  createUnsafeBatchVerificationBlockedMessage,
  createVerificationAfterPassBlockedMessage,
  createWorkerLocalVerificationAfterParentHandoffBlockedMessage,
  getFailedVerificationStreakSinceProgress,
  getLatestDsxuToolState,
  hasDsxuPendingRequiredEditAfterBaselinePass,
  hasUnsafeMutationVerificationBatch,
  shouldRequireDiscoveryNarrowingInBatch,
  shouldBlockParentMutationAfterWorkerOwnership,
  shouldBlockPrematureVerificationBeforeExactEditBudgetComplete,
  shouldBlockRepeatedFailedVerification,
  shouldBlockVerificationAfterVerifiedPass,
  shouldBlockWorkerLocalVerificationAfterParentHandoff,
  shouldBlockUnsafeBatchVerification,
} from '../../../services/tools/dsxuToolBatchGate'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const root = process.cwd()

describe('DSXU V12 prompt governance contracts', () => {
  test('default mainline prompt exposes the six V12 governance rules', () => {
    const prompt = getDsxuPromptGovernanceContract()

    expect(prompt).toContain('# DSXU Prompt Governance Contract')
    expect(prompt).toContain('Complex task decompose gate')
    expect(prompt).toContain('Context window and hygiene visibility')
    expect(prompt).toContain('Checkpoint and rollback')
    expect(prompt).toContain('Edit pre-apply review')
    expect(prompt).toContain('Active workflow preference recall')
    expect(prompt).toContain('Task-state snapshot persistence')
    expect(prompt).toContain('must be decomposed')
    expect(prompt).toContain('compact only when route, context-window, cache, or recovery risk requires it')
    expect(prompt).toContain('do not mock the database')
    expect(prompt).toContain('Re-read the source files before editing or claiming PASS')
  })

  test('query loop builds model-visible context window and hygiene warnings', () => {
    const medium = buildDsxuContextBudgetSystemContext({
      tokenUsage: 720_000,
      model: 'deepseek-v4-flash',
      postCompact: false,
    })
    const postCompact = buildDsxuContextBudgetSystemContext({
      tokenUsage: 900_000,
      model: 'deepseek-v4-flash',
      postCompact: true,
    })

    expect(medium).toContain('contextUsedPercent')
    expect(medium).toContain('contextPolicy: route-aware/context-window-aware/cache-aware')
    expect(medium).toContain('contextWindowClass:')
    expect(medium).toContain('estimatedTurnsRemaining')
    expect(medium).toContain('contextRisk:')
    expect(medium).toContain('contextHygieneAction:')
    expect(medium).toContain('recommendedAction:')
    expect(medium).toContain('sourceTruthReread: required-before-edit-or-pass')
    expect(postCompact).toContain('Post-compact/resume turn')
    expect(postCompact).toContain('re-read source truth')
  })

  test('query loop keeps low-risk context window and hygiene guidance cache-stable across ordinary turns', () => {
    const first = buildDsxuContextBudgetSystemContext({
      tokenUsage: 12_000,
      model: 'deepseek-v4-flash',
      postCompact: false,
    })
    const second = buildDsxuContextBudgetSystemContext({
      tokenUsage: 48_000,
      model: 'deepseek-v4-flash',
      postCompact: false,
    })

    expect(first).toBe(second)
    expect(first).toContain('contextUsedPercent: <70')
    expect(first).toContain('estimatedTurnsRemaining: >=10')
  })

  test('query loop turns tool result state into a cursor nudge instead of more prompt prose', () => {
    const nudge = buildDsxuToolStateCursorNudge([
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'edit-1',
              content:
                'The requested edit is already present.\nDSXU tool state: edit_already_applied; blocked=repeat_same_edit; next=planned_edit_or_verify.',
            },
            {
              type: 'tool_result',
              tool_use_id: 'verify-1',
              content:
                'bun test\n1 pass\n0 fail\nDSXU tool state: verification_passed; next=final_answer.',
            },
          ],
        },
        uuid: 'u1',
      } as any,
    ], [
      { id: 'edit-1', name: 'Edit', input: {} },
      { id: 'verify-1', name: 'PowerShell', input: {} },
    ] as any)

    expect(nudge).toContain('DSXU query-loop cursor state')
    expect(nudge).toContain('edit_already_applied')
    expect(nudge).toContain('completed no-op')
    expect(nudge).toContain('do not Read the just-edited file')
    expect(nudge).toContain('unsafe_batch_detected')
    expect(nudge).toContain('possibly stale')
  })

  test('query loop cursor surfaces mutation budget pressure after too many unverified edits', () => {
    const makeEditResult = (id: string) => ({
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: id,
            content:
              'The file has been updated successfully.\nDSXU tool state: edit_applied; blocked=repeat_same_edit; next=planned_edit_or_verify.',
          },
        ],
      },
      uuid: `u-${id}`,
    } as any)

    const nudge = buildDsxuToolStateCursorNudge([], [], [
      makeEditResult('edit-1'),
      makeEditResult('edit-2'),
      makeEditResult('edit-3'),
      makeEditResult('edit-4'),
    ])

    expect(nudge).toContain('mutation_budget_high')
    expect(nudge).toContain('4 successful Edit results')
    expect(nudge).toContain('Stop expanding the patch')
    expect(nudge).toContain('Run the smallest relevant verification')
  })

  test('pre-execution batch gate blocks same-message mutation plus verification before command execution', () => {
    const editBlock = {
      type: 'tool_use',
      id: 'tool-edit-unsafe-batch',
      name: 'Edit',
      input: {
        file_path: 'src/example.ts',
        old_string: 'before',
        new_string: 'after',
      },
    } as any
    const verificationBlock = {
      type: 'tool_use',
      id: 'tool-verify-unsafe-batch',
      name: 'PowerShell',
      input: {
        command: 'bun test',
      },
    } as any
    const readBlock = {
      type: 'tool_use',
      id: 'tool-read-safe-batch',
      name: 'Read',
      input: {
        file_path: 'src/example.ts',
      },
    } as any
    const batch = [editBlock, verificationBlock]

    expect(hasUnsafeMutationVerificationBatch(batch)).toBe(true)
    expect(shouldBlockUnsafeBatchVerification(batch, editBlock)).toBe(false)
    expect(shouldBlockUnsafeBatchVerification(batch, verificationBlock)).toBe(true)
    expect(hasUnsafeMutationVerificationBatch([readBlock, verificationBlock])).toBe(false)

    const message = createUnsafeBatchVerificationBlockedMessage(
      verificationBlock,
      {
        type: 'assistant',
        uuid: 'assistant-unsafe-batch',
        message: {
          role: 'assistant',
          content: [editBlock, verificationBlock],
        },
      } as any,
    )
    const content = JSON.stringify(message.message.content)
    expect(content).toContain('pre-execution tool batch gate blocked')
    expect(content).toContain('verification_blocked_unsafe_batch')
    expect(content).toContain('wait_for_mutation_result_then_verify')
  })

  test('post-mutation Bash verification result becomes a final-answer cursor state', () => {
    const editResultMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-after-write',
            content:
              'The file has been updated successfully.\nDSXU tool state: edit_applied; blocked=repeat_same_edit; next=verify.',
          },
          {
            type: 'tool_result',
            tool_use_id: 'blocked-same-batch-verify',
            is_error: true,
            content:
              'DSXU pre-execution tool batch gate blocked this verification command.\nDSXU tool state: verification_blocked_unsafe_batch; blocked=stale_same_batch_verification; next=wait_for_mutation_result_then_verify.',
          },
        ],
      },
    } as any
    const verifyBlock = {
      type: 'tool_use',
      id: 'fresh-cat-verify',
      name: 'Bash',
      input: {
        command: 'cat /tmp/edit-target.txt',
      },
    } as any
    const verifyResultMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'fresh-cat-verify',
            content: 'beta',
            is_error: false,
          },
        ],
      },
    } as any

    const state = buildDsxuRecoveryState({
      toolResults: [verifyResultMessage],
      toolUseBlocks: [verifyBlock],
      conversationMessages: [editResultMessage],
    })
    const nudge = buildDsxuToolStateCursorNudge(
      [verifyResultMessage],
      [verifyBlock],
      [editResultMessage],
    )

    expect(state.state).toBe('post_mutation_verification_ready_final')
    expect(state.requiredAction).toBe('final_answer')
    expect(state.verificationRequired).toBe(false)
    expect(nudge).toContain('post_mutation_verification_result')
    expect(nudge).toContain('Stop calling tools now')
    expect(nudge).toContain('Do not repeat this verification command')
  })

  test('pre-execution gate blocks all drift-prone tools after latest verified PASS', () => {
    const verificationBlock = {
      type: 'tool_use',
      id: 'tool-verify-after-pass',
      name: 'PowerShell',
      input: {
        command: 'bun test',
      },
    } as any
    const readBlock = {
      type: 'tool_use',
      id: 'tool-read-after-pass',
      name: 'Read',
      input: {
        file_path: 'src/example.ts',
      },
    } as any
    const editBlock = {
      type: 'tool_use',
      id: 'tool-edit-after-pass',
      name: 'Edit',
      input: {
        file_path: 'src/example.ts',
        old_string: 'before',
        new_string: 'after',
      },
    } as any
    const agentBlock = {
      type: 'tool_use',
      id: 'tool-agent-after-pass',
      name: 'Agent',
      input: {
        description: 'extra check',
        prompt: 'keep checking after PASS',
      },
    } as any
    const latestPassMessages = [
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'prior-verify',
              content: '18 pass, 0 fail\nDSXU tool state: verification_passed; blocked=rerun_same_command; next=final_answer.',
            },
          ],
        },
      },
    ] as any
    const passThenEditMessages = [
      ...latestPassMessages,
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'later-edit',
              content: 'DSXU tool state: edit_applied; blocked=repeat_same_edit; next=planned_edit_or_verify.',
            },
          ],
        },
      },
    ] as any

    expect(getLatestDsxuToolState(latestPassMessages)).toBe('verification_passed')
    expect(shouldBlockVerificationAfterVerifiedPass(latestPassMessages, verificationBlock)).toBe(true)
    expect(shouldBlockVerificationAfterVerifiedPass(latestPassMessages, readBlock)).toBe(true)
    expect(shouldBlockVerificationAfterVerifiedPass(latestPassMessages, editBlock)).toBe(false)
    expect(shouldBlockVerificationAfterVerifiedPass(latestPassMessages, agentBlock)).toBe(true)
    expect(shouldBlockVerificationAfterVerifiedPass(passThenEditMessages, verificationBlock)).toBe(false)

    const message = createVerificationAfterPassBlockedMessage(
      readBlock,
      {
        type: 'assistant',
        uuid: 'assistant-after-pass',
        message: {
          role: 'assistant',
          content: [readBlock],
        },
      } as any,
    )
    const content = JSON.stringify(message.message.content)
    expect(content).toContain('stop-on-pass gate blocked')
    expect(content).toContain('tool_blocked_after_pass')
    expect(content).toContain('post_pass_tool_call')
    expect(content).toContain('next=final_answer')
  })

  test('baseline verified PASS does not block explicit required Edit workflow', () => {
    const promptMessage = {
      type: 'user',
      message: {
        role: 'user',
        content:
          'Product-grade review-to-fix task. Run bun test first. Fix sanitizeComment, add one regression assertion, and you must make exactly two Edits: one source edit and one test edit. Run one PowerShell bun test verification after those edits.',
      },
      uuid: 'prompt-baseline-pass-required-edits',
    } as any
    const baselinePassMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'baseline-verify',
            content:
              'bun test v1.3.11\n\n 1 pass\n 0 fail\nDSXU tool state: verification_passed; blocked=rerun_same_command,more_tools_after_pass; next=final_answer.',
          },
        ],
      },
      uuid: 'baseline-pass-before-required-edits',
    } as any
    const readBlock = {
      type: 'tool_use',
      id: 'read-after-baseline-pass',
      name: 'Read',
      input: {
        file_path: 'src/sanitize.js',
      },
    } as any
    const toolUseBlocks = [
      {
        id: 'baseline-verify',
        name: 'PowerShell',
        input: {
          command: 'bun test',
        },
      },
    ] as any

    expect(hasDsxuPendingRequiredEditAfterBaselinePass([
      promptMessage,
      baselinePassMessage,
    ])).toBe(true)
    expect(shouldBlockVerificationAfterVerifiedPass([
      promptMessage,
      baselinePassMessage,
    ], readBlock)).toBe(false)

    const recoveryState = buildDsxuRecoveryState({
      toolResults: [baselinePassMessage],
      toolUseBlocks,
      conversationMessages: [promptMessage],
    })
    expect(recoveryState.state).toBe('baseline_pass_pending_required_edit')
    expect(recoveryState.canClaimComplete).toBe(false)
    expect(recoveryState.requiredAction).toBe('read_source_truth')

    const nudge = buildDsxuToolStateCursorNudge(
      [baselinePassMessage],
      toolUseBlocks,
      [promptMessage],
    )
    expect(nudge).toContain('baseline_pass_pending_required_edit')
    expect(nudge).toContain('can_claim_complete=false')
    expect(nudge).toContain('baseline_verification_passed')
    expect(nudge).toContain('Continue with the planned Read/Edit steps')
  })

  test('pre-execution gate blocks verification between exact planned edits', () => {
    const promptMessage = {
      type: 'user',
      message: {
        role: 'user',
        content:
          'Product-grade multi-file recovery task. Fix both failures with exactly two sequential source Edits, then run one PowerShell bun test verification after those edits.',
      },
      uuid: 'prompt-exact-two-edits',
    } as any
    const firstEditMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'first-edit',
            content:
              'The file src/pricing.js has been updated successfully.\nDSXU tool state: edit_applied; blocked=repeat_same_edit; next=planned_edit_or_verify.',
          },
        ],
      },
      uuid: 'first-edit-result',
    } as any
    const verifyBlock = {
      type: 'tool_use',
      id: 'verify-before-second-edit',
      name: 'PowerShell',
      input: {
        command: 'bun test',
      },
    } as any
    const assistantMessage = {
      type: 'assistant',
      uuid: 'assistant-premature-verify',
      message: {
        role: 'assistant',
        content: [verifyBlock],
      },
    } as any

    expect(shouldBlockPrematureVerificationBeforeExactEditBudgetComplete([
      promptMessage,
      firstEditMessage,
    ], verifyBlock)).toBe(true)

    const message = createPrematureVerificationBeforeExactEditBudgetBlockedMessage(
      verifyBlock,
      assistantMessage,
    )
    const content = JSON.stringify(message.message.content)
    expect(content).toContain('multiple successful Edits')
    expect(content).toContain('verification_blocked_pending_exact_edits')
    expect(content).toContain('next=next_planned_edit_then_verify')

    const afterEachPrompt = {
      ...promptMessage,
      message: {
        role: 'user',
        content:
          'Make exactly two Edits and run tests after each Edit because each step must be independently checked.',
      },
    } as any
    expect(shouldBlockPrematureVerificationBeforeExactEditBudgetComplete([
      afterEachPrompt,
      firstEditMessage,
    ], verifyBlock)).toBe(false)

    const exploratoryPrompt = {
      ...promptMessage,
      message: {
        role: 'user',
        content:
          'Fix both files with exactly two Edits. You may verify after either edit if needed to decide the next safe change.',
      },
    } as any
    expect(shouldBlockPrematureVerificationBeforeExactEditBudgetComplete([
      exploratoryPrompt,
      firstEditMessage,
    ], verifyBlock)).toBe(false)
  })

  test('tool batch gate ignores REPL metadata events without message content', () => {
    const promptMessage = {
      type: 'user',
      message: {
        role: 'user',
        content:
          'Run Bash command: echo DSXU_PTY_OK',
      },
      uuid: 'prompt-with-file-history',
    } as any
    const metadataMessage = {
      type: 'file-history-snapshot',
      messageId: 'prompt-with-file-history',
      snapshot: {},
    } as any
    const bashBlock = {
      type: 'tool_use',
      id: 'bash-after-metadata',
      name: 'Bash',
      input: {
        command: 'echo DSXU_PTY_OK',
      },
    } as any

    expect(() =>
      shouldBlockVerificationAfterVerifiedPass(
        [metadataMessage, promptMessage],
        bashBlock,
      ),
    ).not.toThrow()
    expect(
      shouldBlockVerificationAfterVerifiedPass(
        [metadataMessage, promptMessage],
        bashBlock,
      ),
    ).toBe(false)
  })

  test('TaskOutput pass evidence marks verification_passed for parent finalization', () => {
    const resultBlock = TaskOutputTool.mapToolResultToToolResultBlockParam({
      retrieval_status: 'success',
      task: {
        task_id: 'agent-task-1',
        task_type: 'local_agent',
        status: 'completed',
        description: 'worker-owned fix',
        output: 'bun test v1.3.11\n\n 1 pass\n 0 fail\n 4 expect() calls',
      },
    } as any, 'task-output-pass')
    const messages = [
      {
        type: 'user',
        message: {
          role: 'user',
          content: [resultBlock],
        },
      },
    ] as any
    const readBlock = {
      type: 'tool_use',
      id: 'read-after-agent-pass',
      name: 'Read',
      input: {
        file_path: 'C:/tmp/agent-task-1.output',
      },
    } as any
    const taskOutputBlock = {
      type: 'tool_use',
      id: 'taskoutput-after-agent-pass',
      name: 'TaskOutput',
      input: {
        task_id: 'agent-task-1',
      },
    } as any

    expect(resultBlock.content).toContain('DSXU tool state: verification_passed')
    expect(getLatestDsxuToolState(messages)).toBe('verification_passed')
    expect(shouldBlockVerificationAfterVerifiedPass(messages, readBlock)).toBe(true)
    expect(shouldBlockVerificationAfterVerifiedPass(messages, taskOutputBlock)).toBe(true)
  })

  test('query cursor and pre-execution gate stop repeated failed verification loops', () => {
    const editMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-invoice',
            content: 'The file has been updated successfully.\nDSXU tool state: edit_applied; next=planned_edit_or_verify.',
          },
        ],
      },
    } as any
    const makeVerifyTurn = (id: string) => ([
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id,
              name: 'PowerShell',
              input: { command: 'bun test' },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: id,
              content: 'Exit code 1\nbun test\n1 pass\n1 fail\nerror: expect(received).toEqual(expected)\nDSXU tool state: verification_failed; blocked=rerun_same_command_without_strategy_change; next=source_repair_or_partial.',
            },
          ],
        },
      },
    ] as any[])

    const messages = [
      editMessage,
      ...makeVerifyTurn('verify-1'),
      ...makeVerifyTurn('verify-2'),
    ] as any[]
    const nextVerifyBlock = {
      type: 'tool_use',
      id: 'verify-3',
      name: 'PowerShell',
      input: { command: 'bun test' },
    } as any

    expect(getDsxuFailedVerificationStreakSinceEdit(messages)).toBe(2)
    expect(getFailedVerificationStreakSinceProgress(messages)).toBe(2)
    expect(shouldBlockRepeatedFailedVerification(messages, nextVerifyBlock)).toBe(true)

    const nudge = buildDsxuToolStateCursorNudge([], [nextVerifyBlock], messages)
    expect(nudge).toContain('failed_verification_repeat')
    expect(nudge).toContain('Stop rerunning the same command')
    expect(nudge).toContain('one source-repair action')

    const message = createRepeatedFailedVerificationBlockedMessage(
      nextVerifyBlock,
      {
        type: 'assistant',
        uuid: 'assistant-repeat-failed-verify',
        message: {
          role: 'assistant',
          content: [nextVerifyBlock],
        },
      } as any,
    )
    const content = JSON.stringify(message.message.content)
    expect(content).toContain('recovery gate blocked')
    expect(content).toContain('verification_blocked_repeated_failure')
    expect(content).toContain('source_repair_or_partial')
  })

  test('query recovery state machine classifies repeated failed verification before retry', () => {
    const makeVerifyTurn = (id: string) => ([
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id,
              name: 'PowerShell',
              input: { command: 'bun test' },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: id,
              content:
                'bun test\n1 pass\n1 fail\nerror: expected checkout total\nExit code 1',
            },
          ],
        },
      },
    ] as any[])
    const messages = [
      ...makeVerifyTurn('verify-state-1'),
      ...makeVerifyTurn('verify-state-2'),
    ] as any[]
    const state = buildDsxuRecoveryState({
      toolResults: [],
      toolUseBlocks: [],
      conversationMessages: messages,
    })
    const nudge = buildDsxuToolStateCursorNudge([], [], messages)

    expect(state.state).toBe('failed_verification_loop')
    expect(state.requiredAction).toBe('source_repair')
    expect(state.canClaimComplete).toBe(false)
    expect(state.sourceTruthRequired).toBe(true)
    expect(state.verificationRequired).toBe(false)
    expect(state.reason).toContain('2 failed verification results')
    expect(nudge).toContain('recovery_state: failed_verification_loop')
    expect(nudge).toContain('required_action=source_repair')
    expect(nudge).toContain('can_claim_complete=false')
    expect(nudge).toContain('source_truth_required=true')
  })

  test('pre-execution gate treats raw failing test output as repeated verification failure', () => {
    const makeRawVerifyTurn = (id: string) => ([
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id,
              name: 'PowerShell',
              input: { command: 'bun test' },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: id,
              content:
                'bun test\n1 pass\n1 fail\nerror: expect(received).toEqual(expected)\nExit code 1',
            },
          ],
        },
      },
    ] as any[])

    const messages = [
      ...makeRawVerifyTurn('raw-verify-1'),
      ...makeRawVerifyTurn('raw-verify-2'),
    ] as any[]
    const nextVerifyBlock = {
      type: 'tool_use',
      id: 'raw-verify-3',
      name: 'PowerShell',
      input: { command: 'bun test' },
    } as any

    expect(getFailedVerificationStreakSinceProgress(messages)).toBe(2)
    expect(shouldBlockRepeatedFailedVerification(messages, nextVerifyBlock)).toBe(true)
  })

  test('pre-execution gate blocks parent mutation after worker-owned Agent handoff', () => {
    const editBlock = {
      type: 'tool_use',
      id: 'tool-parent-edit-after-worker-owned',
      name: 'Edit',
      input: {
        file_path: 'src/worker-owned.ts',
        old_string: 'before',
        new_string: 'after',
      },
    } as any
    const messages = [
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'agent-worker-owned',
              content:
                'Worker accepted ownership for src/worker-owned.ts.\nDSXU tool state: agent_worker_owned; blocked=parent_duplicate_worker_scope; next=worker_evidence_or_sendmessage.',
            },
          ],
        },
      },
    ] as any

    expect(getLatestDsxuToolState(messages)).toBe('agent_worker_owned')
    expect(shouldBlockParentMutationAfterWorkerOwnership(messages, editBlock)).toBe(true)

    const message = createParentMutationAfterWorkerOwnershipBlockedMessage(
      editBlock,
      {
        type: 'assistant',
        uuid: 'assistant-worker-owned-edit',
        message: {
          role: 'assistant',
          content: [editBlock],
        },
      } as any,
    )
    const content = JSON.stringify(message.message.content)
    expect(content).toContain('Agent ownership gate blocked')
    expect(content).toContain('parent_mutation_blocked_worker_owned')
    expect(content).toContain('worker_evidence_or_sendmessage')
  })

  test('pre-execution gate blocks worker local verification after parent handoff', () => {
    const verifyBlock = {
      type: 'tool_use',
      id: 'tool-worker-local-verify-after-handoff',
      name: 'PowerShell',
      input: { command: 'bun test' },
    } as any
    const messages = [
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'worker-edit',
              content:
                'The file src/html.js has been updated successfully. Worker handoff: the parent/verifier owns post-edit verification for this delegated task. Do not run PowerShell/Bash verification here.\n' +
                'DSXU tool state: edit_applied; blocked=repeat_same_edit,shell_write_fallback,read_edited_file_to_confirm; next=planned_edit_or_parent_verification_handoff.',
            },
          ],
        },
      },
    ] as any

    expect(shouldBlockWorkerLocalVerificationAfterParentHandoff(messages, verifyBlock)).toBe(true)

    const message = createWorkerLocalVerificationAfterParentHandoffBlockedMessage(
      verifyBlock,
      {
        type: 'assistant',
        uuid: 'assistant-worker-local-verify',
        message: {
          role: 'assistant',
          content: [verifyBlock],
        },
      } as any,
    )
    const content = JSON.stringify(message.message.content)
    expect(content).toContain('worker handoff gate blocked')
    expect(content).toContain('worker_verification_blocked_parent_handoff')
    expect(content).toContain('report_edit_result_to_parent')
  })

  test('query cursor downgrades parent completion when Agent evidence is partial', () => {
    const nudge = buildDsxuToolStateCursorNudge([
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'agent-partial',
              content: [
                '<evidence>',
                'files_read: src/checkout/service.ts',
                'files_changed: src/checkout/service.ts',
                'commands_run: bun test tests/checkout/regression.test.ts',
                'tests_passed: none',
                'tests_failed: bun test tests/checkout/regression.test.ts',
                'unresolved_risks: regression still failing',
                'completion_claim: partial',
                '</evidence>',
                'Worker result: PARTIAL',
              ].join('\n'),
            },
          ],
        },
        uuid: 'u-agent-partial',
      } as any,
    ], [
      { id: 'agent-partial', name: 'Agent', input: {} },
    ] as any)

    expect(nudge).toContain('DSXU query-loop cursor state')
    expect(nudge).toContain('agent_evidence_incomplete')
    expect(nudge).toContain('Do not claim complete')
    expect(nudge).toContain('request one focused clarification')
    expect(nudge).toContain('report PARTIAL')
  })

  test('Agent parent final gate blocks completion claims on incomplete worker evidence', () => {
    const agentEvidence = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'agent-partial',
            content: [
              '<evidence>',
              'files_read: src/checkout/service.ts',
              'files_changed: src/checkout/service.ts',
              'commands_run: bun test tests/checkout/regression.test.ts',
              'tests_passed: none',
              'tests_failed: bun test tests/checkout/regression.test.ts',
              'unresolved_risks: checkout regression still failing',
              'completion_claim: partial',
              '</evidence>',
            ].join('\n'),
          },
        ],
      },
      uuid: 'u-agent-partial',
    } as any

    const badFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-bad',
        content: [{ type: 'text', text: 'Done. The checkout bug is fixed and verified.' }],
      },
      uuid: 'a-final-bad',
    } as any
    const gate = buildDsxuAgentFinalGateNudge([agentEvidence], [badFinal])
    expect(gate).toContain('DSXU parent-final evidence gate')
    expect(gate).toContain('blocked_final')
    expect(gate).toContain('do not claim complete')
    expect(gate).toContain('PARTIAL')

    const partialFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-partial',
        content: [
          {
            type: 'text',
            text: 'PARTIAL: worker evidence shows bun test tests/checkout/regression.test.ts is still failing.',
          },
        ],
      },
      uuid: 'a-final-partial',
    } as any
    expect(buildDsxuAgentFinalGateNudge([agentEvidence], [partialFinal])).toBeNull()
  })

  test('Agent parent final gate requires cited concrete evidence after complete worker evidence', () => {
    const completeEvidence = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'agent-complete',
            content: [
              '<evidence>',
              'files_read: src/checkout/service.ts',
              'files_changed: src/checkout/service.ts',
              'commands_run: bun test tests/checkout/regression.test.ts',
              'tests_passed: bun test tests/checkout/regression.test.ts',
              'tests_failed: none',
              'unresolved_risks: none',
              'completion_claim: complete',
              '</evidence>',
            ].join('\n'),
          },
        ],
      },
      uuid: 'u-agent-complete',
    } as any

    const uncitedFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-uncited',
        content: [{ type: 'text', text: 'Done. The bug is fixed and tests pass.' }],
      },
      uuid: 'a-final-uncited',
    } as any
    const gate = buildDsxuAgentFinalGateNudge([completeEvidence], [uncitedFinal])
    expect(gate).toContain('does not cite concrete worker evidence')
    expect(gate).toContain('changed/read file path or verification command')

    const citedFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-cited',
        content: [
          {
            type: 'text',
            text: 'Done. Worker evidence changed src/checkout/service.ts and passed bun test tests/checkout/regression.test.ts.',
          },
        ],
      },
      uuid: 'a-final-cited',
    } as any
    expect(buildDsxuAgentFinalGateNudge([completeEvidence], [citedFinal])).toBeNull()
  })

  test('TaskOutput forwards async Agent evidence into parent final gate', () => {
    const taskOutput = TaskOutputTool.mapToolResultToToolResultBlockParam({
      retrieval_status: 'success',
      task: {
        task_id: 'agent-async-evidence',
        task_type: 'local_agent',
        status: 'completed',
        description: 'Worker validates checkout fix',
        output: 'Worker completed checkout repair.\n1 test passed, 0 failed',
        prompt: 'Repair checkout flow',
        result: 'Worker completed checkout repair.\n1 test passed, 0 failed',
        evidencePacket: {
          files_read: ['src/checkout/service.ts'],
          files_changed: ['src/checkout/service.ts'],
          commands_run: ['bun test tests/checkout/regression.test.ts'],
          tests_passed: ['bun test tests/checkout/regression.test.ts'],
          tests_failed: [],
          unresolved_risks: [],
          completion_claim: 'complete',
        },
      },
    } as any, 'task-output-agent-evidence')

    expect(taskOutput.content).toContain('<evidence>')
    expect(taskOutput.content).toContain('files_changed: src/checkout/service.ts')
    expect(taskOutput.content).toContain('tests_passed: bun test tests/checkout/regression.test.ts')

    const conversationMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: [taskOutput],
      },
      uuid: 'u-task-output-evidence',
    } as any
    const malformedMessage = {
      type: 'system',
      uuid: 'system-without-message',
    } as any
    const uncitedFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-uncited-async',
        content: [{ type: 'text', text: 'Done. The checkout bug is fixed and tests pass.' }],
      },
      uuid: 'a-final-uncited-async',
    } as any

    const gate = buildDsxuAgentFinalGateNudge(
      [malformedMessage, conversationMessage],
      [uncitedFinal],
    )
    expect(gate).toContain('DSXU parent-final evidence gate')
    expect(gate).toContain('does not cite concrete worker evidence')
  })

  test('Agent parent final gate catches uncited completion earlier in the same response', () => {
    const completeEvidence = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'agent-complete-same-turn',
            content: [
              '<evidence>',
              'files_read: src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts',
              'files_changed: none',
              'commands_run: bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate"',
              'tests_passed: bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate"',
              'tests_failed: none',
              'unresolved_risks: none',
              'completion_claim: complete',
              '</evidence>',
            ].join('\n'),
          },
        ],
      },
      uuid: 'u-agent-complete-same-turn',
    } as any
    const uncitedDone = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-done-same-turn',
        content: [{ type: 'text', text: 'Done.' }],
      },
      uuid: 'a-final-done-same-turn',
    } as any
    const citedAfterward = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-cited-afterward',
        content: [
          {
            type: 'text',
            text: 'DSXU_BENCH_V16_AGENT_PARENT_FINAL_GATE_PASS\nWorker ran bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate".',
          },
        ],
      },
      uuid: 'a-final-cited-afterward',
    } as any

    const gate = buildDsxuAgentFinalGateNudge(
      [completeEvidence],
      [uncitedDone, citedAfterward],
    )
    expect(gate).toContain('DSXU parent-final evidence gate')
    expect(gate).toContain('does not cite concrete worker evidence')
  })

  test('Agent parent final gate blocks bare Done prelude glued to later evidence', () => {
    const completeEvidence = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'agent-complete-glued-final',
            content: [
              '<evidence>',
              'files_read: src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts',
              'files_changed: none',
              'commands_run: bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate"',
              'tests_passed: bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate"',
              'tests_failed: none',
              'unresolved_risks: none',
              'completion_claim: complete',
              '</evidence>',
            ].join('\n'),
          },
        ],
      },
      uuid: 'u-agent-complete-glued-final',
    } as any
    const gluedFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-glued-done-then-evidence',
        content: [
          {
            type: 'text',
            text: 'Done.\nDSXU_BENCH_V16_AGENT_PARENT_FINAL_GATE_PASS\nWorker ran bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate".',
          },
        ],
      },
      uuid: 'a-final-glued-done-then-evidence',
    } as any

    const gate = buildDsxuAgentFinalGateNudge([completeEvidence], [gluedFinal])
    expect(gate).toContain('DSXU parent-final evidence gate')
    expect(gate).toContain('does not cite concrete worker evidence')

    const citedFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-cited-no-bare-prelude',
        content: [
          {
            type: 'text',
            text: 'DSXU_BENCH_V16_AGENT_PARENT_FINAL_GATE_PASS\nWorker ran bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate".',
          },
        ],
      },
      uuid: 'a-final-cited-no-bare-prelude',
    } as any
    expect(buildDsxuAgentFinalGateNudge([completeEvidence], [citedFinal])).toBeNull()
  })

  test('final answer visibility gate blocks thinking-only marker responses', () => {
    const thinkingOnlyFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-thinking-only',
        content: [
          {
            type: 'thinking',
            thinking: 'DSXU_BENCH_MUTATION_PERMISSION_NETWORK_EXECUTE_DENY_PASS',
            signature: '',
          },
        ],
      },
      uuid: 'a-thinking-only',
    } as any
    const nudge = buildDsxuEmptyFinalAnswerNudge([thinkingOnlyFinal])
    expect(nudge).toContain('final-answer visibility gate')
    expect(nudge).toContain('no user-visible text')
    expect(nudge).toContain('visible text response')

    const visibleFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-visible',
        content: [
          {
            type: 'text',
            text: 'DSXU_BENCH_MUTATION_PERMISSION_NETWORK_EXECUTE_DENY_PASS',
          },
        ],
      },
      uuid: 'a-visible',
    } as any
    expect(buildDsxuEmptyFinalAnswerNudge([visibleFinal])).toBeNull()
  })

  test('intent-only final gate blocks promise-to-act responses without tools', () => {
    const intentOnlyFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-intent-only',
        content: [
          {
            type: 'text',
            text: '我现在直接开始做视觉升级实现，不再问了。让我先确认当前文件状态，然后做视觉风格改造。',
          },
        ],
      },
      uuid: 'a-intent-only',
    } as any

    const nudge = buildDsxuIntentOnlyFinalNudge([intentOnlyFinal])
    expect(nudge).toContain('intent-only final gate')
    expect(nudge).toContain('emitted no tool call')
    expect(nudge).toContain('Do not wait for the user to type continue')

    const clearFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-clear',
        content: [
          {
            type: 'text',
            text: '检查结果：没有继续执行工具，当前状态是 PARTIAL，需要重新提交任务才能继续。',
          },
        ],
      },
      uuid: 'a-clear',
    } as any
    expect(buildDsxuIntentOnlyFinalNudge([clearFinal])).toBeNull()
  })

  test('execution visibility gate blocks broad tool fanout without a visible brief', () => {
    const toolUseBlocks = Array.from({ length: 5 }, (_, index) => ({
      type: 'tool_use',
      id: `read-${index}`,
      name: index % 2 === 0 ? 'Read' : 'Grep',
      input: {},
    })) as any
    const silentFanout = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'assistant-silent-fanout',
        content: toolUseBlocks,
      },
      uuid: 'a-silent-fanout',
    } as any

    const nudge = buildDsxuExecutionVisibilityNudge(toolUseBlocks, [silentFanout])
    expect(nudge).toContain('execution-visibility gate')
    expect(nudge).toContain('5 tool calls')
    expect(nudge).toContain('visible sentence')
    expect(nudge).toContain('3-5 dimensions')

    const briefedFanout = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'assistant-briefed-fanout',
        content: [
          {
            type: 'text',
            text: 'I am checking process state, logs, git status, benchmark reports, and the shell lifecycle code in parallel.',
          },
          ...toolUseBlocks,
        ],
      },
      uuid: 'a-briefed-fanout',
    } as any
    expect(buildDsxuExecutionVisibilityNudge(toolUseBlocks, [briefedFanout])).toBeNull()
  })

  test('execution visibility gate accepts a visible brief split before tool messages', () => {
    const toolUseBlocks = Array.from({ length: 4 }, (_, index) => ({
      type: 'tool_use',
      id: `split-tool-${index}`,
      name: index === 3 ? 'PowerShell' : 'Read',
      input: {},
    })) as any
    const splitBrief = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'assistant-split-brief',
        content: [
          {
            type: 'text',
            text: 'Intent brief: I am checking source exports, tests, package scripts, and baseline verification before editing.',
          },
        ],
      },
      uuid: 'a-split-brief',
    } as any
    const splitTools = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'assistant-split-tools',
        content: toolUseBlocks,
      },
      uuid: 'a-split-tools',
    } as any

    expect(
      buildDsxuExecutionVisibilityNudge(toolUseBlocks, [
        splitBrief,
        splitTools,
      ]),
    ).toBeNull()
  })

  test('background task final gate blocks silent completion while shell task is still running', () => {
    const activeTasks = {
      b12345678: {
        id: 'b12345678',
        type: 'local_bash',
        status: 'running',
        description: 'Run bun test',
        outputFile: 'D:/DSXU-code/.dsxu/task-output/b12345678.txt',
        outputOffset: 0,
        notified: false,
        startTime: Date.now(),
        isBackgrounded: true,
        completionStatusSentInAttachment: false,
        shellCommand: null,
        lastReportedTotalLines: 0,
      },
    } as any
    const silentCompleteFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-silent-complete',
        content: [{ type: 'text', text: 'Done. Everything passes now.' }],
      },
      uuid: 'a-silent-complete',
    } as any

    const gate = buildDsxuBackgroundTaskFinalGateNudge(
      [silentCompleteFinal],
      activeTasks,
    )
    expect(gate).toContain('background-task final gate')
    expect(gate).toContain('b12345678')
    expect(gate).toContain('output=')
    expect(gate).toContain('TaskOutput/TaskStop')

    const genericBackgroundFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-generic-background',
        content: [
          {
            type: 'text',
            text: 'Done. I am waiting for the background-task final gate notification.',
          },
        ],
      },
      uuid: 'a-generic-background',
    } as any
    expect(
      buildDsxuBackgroundTaskFinalGateNudge(
        [genericBackgroundFinal],
        activeTasks,
      ),
    ).toContain('background-task final gate')

    const reportedFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'final-reported-background',
        content: [
          {
            type: 'text',
            text: 'The background task b12345678 is still running; output is being written to D:/DSXU-code/.dsxu/task-output/b12345678.txt.',
          },
        ],
      },
      uuid: 'a-reported-background',
    } as any
    expect(
      buildDsxuBackgroundTaskFinalGateNudge([reportedFinal], activeTasks),
    ).toBeNull()
  })

  test('query loop cursor narrows broad discovery into candidate selection instead of hard blocking tools', () => {
    const messages: any[] = []
    for (let i = 0; i < 8; i++) {
      const id = `read-${i}`
      messages.push({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id,
              name: i % 2 === 0 ? 'Read' : 'Grep',
              input: {},
            },
          ],
        },
      })
      messages.push({
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: id,
              content: `discovery result ${i}`,
            },
          ],
        },
      })
    }
    const grepBlock = {
      type: 'tool_use',
      id: 'grep-after-budget',
      name: 'Grep',
      input: {
        pattern: 'summary',
      },
    } as any
    const editBlock = {
      type: 'tool_use',
      id: 'edit-after-budget',
      name: 'Edit',
      input: {},
    } as any

    expect(getDsxuDiscoveryStreakSinceProgress(messages)).toBe(8)

    const nudge = buildDsxuToolStateCursorNudge([], [grepBlock], messages)
    expect(nudge).toContain('discovery_budget_pressure')
    expect(nudge).toContain('candidate_files')
    expect(nudge).toContain('evidence_for_each_candidate')
    expect(nudge).toContain('selected_candidate')
    expect(nudge).toContain('latest_source_truth_to_read_or_reuse')
    expect(nudge).toContain('smallest_safe_edit')
    expect(nudge).toContain('choose one candidate')

    const afterEdit = [
      ...messages,
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: editBlock.id,
              content: 'DSXU tool state: edit_applied; next=planned_edit_or_verify.',
            },
          ],
        },
      },
    ] as any
    expect(getDsxuDiscoveryStreakSinceProgress(afterEdit)).toBe(0)
  })

  test('query loop cursor treats Edit preflight failures as source-truth binding problems', () => {
    const nudge = buildDsxuToolStateCursorNudge([
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'edit-stale',
              content:
                'String to replace not found in file.\nDSXU tool state: edit_preflight_failed; blocked=stale_old_string; next=read_latest_source_truth_or_select_candidate.',
            },
            {
              type: 'tool_result',
              tool_use_id: 'edit-missing-read',
              content:
                'File has not been read yet.\nDSXU tool state: edit_preflight_required; blocked=missing_source_truth; next=read_latest_source_truth_or_select_candidate.',
            },
          ],
        },
        uuid: 'u-edit-preflight',
      } as any,
    ], [
      { id: 'edit-stale', name: 'Edit', input: {} },
      { id: 'edit-missing-read', name: 'Edit', input: {} },
    ] as any)

    expect(nudge).toContain('edit_preflight_failed')
    expect(nudge).toContain('Do not retry the same old_string')
    expect(nudge).toContain('edit_preflight_required')
    expect(nudge).toContain('bind old_string to the latest Read result')
    expect(nudge).toContain('Do not switch to shell writes')
  })

  test('same-turn discovery batch gate requires candidate selection after initial discovery budget', () => {
    const batch = Array.from({ length: 7 }, (_, index) => ({
      type: 'tool_use',
      id: `discovery-${index}`,
      name: index % 2 === 0 ? 'Read' : 'Grep',
      input: {},
    })) as any[]

    expect(shouldRequireDiscoveryNarrowingInBatch(batch, batch[0])).toBe(false)
    expect(shouldRequireDiscoveryNarrowingInBatch(batch, batch[4])).toBe(false)
    expect(shouldRequireDiscoveryNarrowingInBatch(batch, batch[5])).toBe(true)

    const message = createDiscoveryNarrowingRequiredMessage(
      batch[5],
      {
        type: 'assistant',
        uuid: 'assistant-discovery-batch',
        message: {
          role: 'assistant',
          content: batch,
        },
      } as any,
    )
    const content = JSON.stringify(message.message.content)
    expect(content).toContain('discovery narrowing required')
    expect(content).toContain('candidate-file selection')
    expect(content).toContain('selected_candidate')
    expect(content).toContain('latest_source_truth_to_read_or_reuse')
    expect(content).toContain('shell writes')
    expect(content).toContain('discovery_narrowing_required')
    expect(content).toContain('next=candidate_file_selection')
  })

  test('system prompt includes complex task governance, checkpoint, rollback, edit preflight, and task-state rules', () => {
    const prompt = buildSystemPrompt({
      cwd: root,
      gear: 2,
      toolNames: ['Read', 'Edit', 'Write', 'Grep', 'Glob', 'Bash', 'Agent', 'MCPTool', 'workflow'],
    })

    expect(prompt).toContain('## V12 Task Governance Contract')
    expect(prompt).toContain('Complex tasks must be decomposed before implementation')
    expect(prompt).toContain('If a dedicated DSXU discovery/read tool is unavailable')
    expect(prompt).toContain('Do not use shell fallback when the current case explicitly forbids shell tools')
    expect(prompt).toContain('Goal, Assumptions, Scope fence, Read-only discovery budget, Task decomposition, Checkpoint plan, Verification plan, Rollback trigger')
    expect(prompt).toContain('## Checkpoint and Rollback Contract')
    expect(prompt).toContain('A post-PASS search, read, or verification rerun is task drift')
    expect(prompt).toContain('After every 2-3 source Edits')
    expect(prompt).toContain('Forward fix is appropriate')
    expect(prompt).toContain('Rollback is appropriate')
    expect(prompt).toContain('## Edit Preflight Contract')
    expect(prompt).toContain('old_string or new_string is over 8 lines')
    expect(prompt).toContain('## Workflow Preference Contract')
    expect(prompt).toContain('Relevant workflow preferences from memory are active checks')
    expect(prompt).toContain('## Task-State Snapshot Contract')
    expect(prompt).toContain('Re-read the source files before editing or claiming PASS')
  })

  test('context window hygiene, workflow preferences, and task snapshot are dynamic sections after stable prefix', () => {
    const builder = new SystemPromptBuilder()
      .loadProjectRules(root)
      .setContextBudget({
        contextUsedPercent: 87,
        estimatedTurnsRemaining: 2,
        compactionRisk: 'high',
        recommendedAction: 'compact',
        postCompact: true,
      })
      .setWorkflowPreferences(['Do not mock the database when database integration is under test.'])
      .setTaskStateSnapshot({
        goal: 'repair failing checkout test',
        scope: 'src/checkout/**, tests/checkout/**',
        filesRead: ['src/checkout/service.ts'],
        filesChanged: ['src/checkout/service.ts'],
        lastPassingCommand: 'bun test tests/checkout/basic.test.ts',
        failedCommands: ['bun test tests/checkout/regression.test.ts'],
        permissionDenials: ['network execute denied'],
        activeAgents: ['verifier'],
        pendingTasks: ['rerun regression test'],
        workflowPreferencesApplied: ['Do not mock the database'],
        nextAction: 'reread service then verify',
        verificationStatus: 'partial',
      })
      .setDynamicContext('DYNAMIC_MARKER')

    const layered = builder.buildLayered()

    expect(layered.l1Prefix).toContain('## V12 Task Governance Contract')
    expect(layered.l1Prefix).toContain('## Cache Layout Contract')
    expect(layered.l1Prefix).not.toContain('## Context Window & Hygiene')
    expect(layered.l1Prefix).not.toContain('Do not mock the database')
    expect(layered.l1Prefix).not.toContain('repair failing checkout test')
    expect(layered.l2Dynamic).toContain('## Context Window & Hygiene')
    expect(layered.l2Dynamic).toContain('compact only when route, context-window, cache, or recovery risk requires it')
    expect(layered.l2Dynamic).toContain('Post-compact turn')
    expect(layered.l2Dynamic).toContain('## Workflow Preferences')
    expect(layered.l2Dynamic).toContain('Do not mock the database')
    expect(layered.l2Dynamic).toContain('## Task-State Snapshot')
    expect(layered.l2Dynamic).toContain('failedCommands: bun test tests/checkout/regression.test.ts')
    expect(layered.l2Dynamic).toContain('Snapshot is navigation only')
    expect(layered.l2Dynamic).toContain('DYNAMIC_MARKER')
  })

  test('task snapshot resume renderer turns tool history into source-truth navigation state', () => {
    const messages = [
      {
        type: 'user',
        message: {
          role: 'user',
          content: 'Fix the checkout regression and verify it.',
        },
      },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'read-checkout',
              name: 'Read',
              input: { file_path: 'src/checkout/service.ts' },
            },
            {
              type: 'tool_use',
              id: 'edit-checkout',
              name: 'Edit',
              input: { file_path: 'src/checkout/service.ts' },
            },
            {
              type: 'tool_use',
              id: 'verify-fail',
              name: 'PowerShell',
              input: { command: 'bun test tests/checkout/regression.test.ts' },
            },
            {
              type: 'tool_use',
              id: 'worker',
              name: 'Agent',
              input: { description: 'checkout verifier' },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'verify-fail',
              content: 'bun test\n1 pass\n1 fail\nerror: expected true\nExit code 1',
            },
          ],
        },
      },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'verify-pass',
              name: 'PowerShell',
              input: { command: 'bun test tests/checkout/regression.test.ts' },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'verify-pass',
              content:
                'bun test tests/checkout/regression.test.ts\n2 pass\n0 fail\nDSXU tool state: verification_passed; next=final_answer.',
            },
          ],
        },
      },
    ] as any[]

    const snapshot = createDsxuTaskStateSnapshotFromMessages(messages, {
      scope: 'src/checkout/**, tests/checkout/**',
      pendingTasks: ['final answer with exact verification evidence'],
      createdAt: '2026-05-04T00:00:00.000Z',
    })
    const rendered = renderDsxuTaskStateSnapshotForResume(snapshot)

    expect(snapshot.goal).toBe('Fix the checkout regression and verify it.')
    expect(snapshot.filesRead).toEqual(['src/checkout/service.ts'])
    expect(snapshot.filesChanged).toEqual(['src/checkout/service.ts'])
    expect(snapshot.failedCommands).toEqual(['bun test tests/checkout/regression.test.ts'])
    expect(snapshot.lastPassingCommand).toBe('bun test tests/checkout/regression.test.ts')
    expect(snapshot.activeAgents).toEqual(['checkout verifier'])
    expect(snapshot.verificationStatus).toBe('passed')
    expect(rendered).toContain('## Task-State Snapshot')
    expect(rendered).toContain('scope: src/checkout/**, tests/checkout/**')
    expect(rendered).toContain('filesRead: src/checkout/service.ts')
    expect(rendered).toContain('filesChanged: src/checkout/service.ts')
    expect(rendered).toContain('lastPassingCommand: bun test tests/checkout/regression.test.ts')
    expect(rendered).toContain('failedCommands: bun test tests/checkout/regression.test.ts')
    expect(rendered).toContain('pendingTasks: final answer with exact verification evidence')
    expect(rendered).toContain('verificationStatus: passed')
    expect(rendered).toContain('Snapshot is navigation only')
    expect(rendered).toContain('Reread source truth before editing or claiming PASS')
  })

  test('compact prompts require task-state snapshot fields for post-compact resume', () => {
    const full = getCompactPrompt()
    const partial = getPartialCompactPrompt(undefined, 'from')
    const partialUpTo = getPartialCompactPrompt(undefined, 'up_to')

    for (const prompt of [full, partial, partialUpTo]) {
      expect(prompt).toContain('DSXU resume requirement')
      expect(prompt).toContain('Task-State Snapshot')
      expect(prompt).toContain('filesRead')
      expect(prompt).toContain('filesChanged')
      expect(prompt).toContain('lastPassingCommand')
      expect(prompt).toContain('failedCommands')
      expect(prompt).toContain('permissionDenials')
      expect(prompt).toContain('activeAgents')
      expect(prompt).toContain('nextAction')
      expect(prompt).toContain('verificationStatus')
      expect(prompt).toContain('navigation only')
      expect(prompt).toContain('must not be treated as PASS evidence')
    }
  })

  test('PlanMode prompts require decompose gate, checkpoint plan, and rollback trigger', () => {
    const previousUserType = process.env.USER_TYPE
    try {
      delete process.env.USER_TYPE
      const external = getEnterPlanModeToolPrompt()
      expect(external).toContain('DSXU V12 Complex Task Decompose Gate')
      expect(external).toContain('The work adds or changes tests')
      expect(external).toContain('The work involves Agent, MCP, Workflow, permissions, compact, or resume')
      expect(external).toContain('Checkpoint plan')
      expect(external).toContain('Rollback trigger')

      process.env.USER_TYPE = 'ant'
      const ant = getEnterPlanModeToolPrompt()
      expect(ant).toContain('DSXU V12 Complex Task')
      expect(ant).toContain('prefer PlanMode')
      expect(ant).not.toContain('prefer starting work and using AskUserQuestion')
    } finally {
      if (previousUserType === undefined) {
        delete process.env.USER_TYPE
      } else {
        process.env.USER_TYPE = previousUserType
      }
    }
  })

  test('ExitPlanMode refuses incomplete governance plans', () => {
    expect(EXIT_PLAN_MODE_V2_TOOL_PROMPT).toContain('Goal section and an Assumptions section')
    expect(EXIT_PLAN_MODE_V2_TOOL_PROMPT).toContain('Read-only discovery budget')
    expect(EXIT_PLAN_MODE_V2_TOOL_PROMPT).toContain('Task decomposition')
    expect(EXIT_PLAN_MODE_V2_TOOL_PROMPT).toContain('Checkpoint plan')
    expect(EXIT_PLAN_MODE_V2_TOOL_PROMPT).toContain('Rollback trigger')
    expect(EXIT_PLAN_MODE_V2_TOOL_PROMPT).toContain('do not skip rollback triggers')
  })

  test('Edit prompt includes V12 preflight checks for large or risky edits', () => {
    const prompt = getEditToolDescription()
    expect(prompt).toContain('V12 complex Edit preflight')
    expect(prompt).toContain('`old_string` or `new_string` is over 8 lines')
    expect(prompt).toContain('public APIs, tests, permissions, tool calls, query loop, Agent, MCP, or Workflow')
    expect(prompt).toContain('`new_string` does not introduce symbols you have not read or located')
    expect(prompt).toContain('Do not send large speculative edits without a preflight review')
  })

  test('Agent prompt forbids shell listing discovery and requires scoped worker discovery budget', () => {
    const prompt = readFileSync(join(root, 'src/tools/AgentTool/prompt.ts'), 'utf8')
    const profile = getDsxuAgentPromptRuntimeProfile([])

    expect(prompt).toContain('Worker discovery discipline')
    expect(prompt).toContain('use Glob for file names, Grep for content, and Read for exact files')
    expect(prompt).toContain('Get-ChildItem')
    expect(prompt).toContain('Discovery budget')
    expect(prompt).toContain('max 2 Glob')
    expect(prompt).toContain('max 3 Grep')
    expect(prompt).toContain('max 4 Read')
    expect(prompt).toContain('Worker edit ownership budget')
    expect(prompt).toContain('Verifier evidence before parent final')
    expect(prompt).toContain('use SendMessage once to request evidence')
    expect(prompt).toContain('no shell listing or shell reads')
    expect(profile.promptDiscipline).toContain('worker discovery uses Glob/Grep/Read, not shell listing')
  })

  test('V14 task governance parses scope fence into enforceable path and tool decisions', () => {
    const scope = parseDsxuScopeFence(`
Scope:
- allowed files: src/sanitize.js, test/sanitize.test.js
- denied files: src/secret.js
- allowed dirs: src, test
- denied dirs: .dsxu, node_modules
- allowed tools: Read, Edit, PowerShell
- denied tools: Bash, Glob
`)

    expect(scope.allowedFiles).toContain('src/sanitize.js')
    expect(scope.deniedFiles).toContain('src/secret.js')
    expect(scope.allowedDirs).toContain('src')
    expect(scope.deniedDirs).toContain('.dsxu')
    expect(isPathAllowedByDsxuScopeFence(root, 'src/sanitize.js', scope)).toEqual({
      allowed: true,
      reason: 'allowed file: src/sanitize.js',
    })
    expect(isPathAllowedByDsxuScopeFence(root, 'src/secret.js', scope).allowed).toBe(false)
    expect(isPathAllowedByDsxuScopeFence(root, '.dsxu/settings.json', scope).allowed).toBe(false)
    expect(isPathAllowedByDsxuScopeFence(root, 'docs/readme.md', scope).allowed).toBe(false)
    expect(isToolAllowedByDsxuScopeFence('Edit', scope).allowed).toBe(true)
    expect(isToolAllowedByDsxuScopeFence('Glob', scope).allowed).toBe(false)
  })

  test('V14 task governance persists checkpoint snapshots without treating them as PASS evidence', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-v14-snapshot-'))
    try {
      const snapshot = createDsxuTaskStateSnapshot({
        goal: 'repair sanitizer regression',
        scope: 'src/sanitize.js, test/sanitize.test.js',
        filesRead: ['src/sanitize.js'],
        filesChanged: ['src/sanitize.js'],
        lastPassingCommand: 'bun test',
        failedCommands: ['bun test before regex fix'],
        permissionDenials: [],
        activeAgents: [],
        pendingTasks: ['reread source truth before next edit'],
        workflowPreferencesApplied: ['do not mock database'],
        nextAction: 'reread source truth then verify',
        verificationStatus: 'partial',
        createdAt: '2026-05-04T00:00:00.000Z',
      })

      const path = writeDsxuTaskStateSnapshot(cwd, 'task:review/fix', snapshot)
      expect(existsSync(path)).toBe(true)
      const restored = readDsxuTaskStateSnapshot(cwd, 'task:review/fix')
      expect(restored?.goal).toBe('repair sanitizer regression')
      expect(restored?.verificationStatus).toBe('partial')
      expect(restored?.nextAction).toContain('reread source truth')
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  test('V14 active workflow recall selects preferences by task keywords as hints only', () => {
    const selected = selectDsxuWorkflowPreferences(
      'Add a database integration test for auth token refresh without mocking the db.',
      [
        {
          id: 'db-real',
          text: 'Do not mock the database when database integration is under test.',
          keywords: ['database', 'db', 'integration test'],
        },
        {
          id: 'agent-worker',
          text: 'Agent worker results require verifier evidence before parent final.',
          keywords: ['agent', 'worker', 'verifier'],
        },
      ],
    )

    expect(selected).toEqual([
      'Do not mock the database when database integration is under test.',
    ])
    expect(getDsxuTaskGovernanceRuntimeProfile().guarantees).toContain(
      'workflow preferences are selected by task keywords as hints only',
    )
  })
})
