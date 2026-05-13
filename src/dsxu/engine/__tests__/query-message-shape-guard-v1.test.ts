import { describe, expect, test } from 'bun:test'
import {
  buildDsxuAgentFinalGateNudge,
  buildDsxuBackgroundTaskFinalGateNudge,
  buildDsxuExecutionVisibilityNudge,
  buildDsxuIntentOnlyFinalNudge,
  buildDsxuUnverifiedMutationFinalGateNudge,
  clearDsxuReadCacheForBlockedExecutionVisibility,
  getDsxuDiscoveryStreakSinceProgress,
  getDsxuFailedVerificationStreakSinceEdit,
  getLatestDsxuToolStateForTrace,
  getDsxuUnverifiedEditStreak,
  hasDsxuUnverifiedMutationSinceVerification,
} from '../../../query'
import { TaskOutputTool } from '../../../tools/TaskOutputTool/TaskOutputTool'
import { createFileStateCacheWithSizeLimit } from '../../../utils/fileStateCache'
import { expandPath } from '../../../utils/path'

const malformedAssistant = {
  type: 'assistant',
  uuid: 'assistant-without-message',
} as any

const malformedUser = {
  type: 'user',
  uuid: 'user-without-message',
} as any

describe('query message shape guard V1', () => {
  test('final gates ignore malformed assistant messages instead of crashing', () => {
    expect(() => buildDsxuIntentOnlyFinalNudge([malformedAssistant])).not.toThrow()
    expect(buildDsxuIntentOnlyFinalNudge([malformedAssistant])).toBeNull()

    expect(() =>
      buildDsxuBackgroundTaskFinalGateNudge([malformedAssistant], {
        task1: {
          id: 'task1',
          type: 'local_agent',
          status: 'running',
          description: 'still running',
        },
      }),
    ).not.toThrow()
    expect(
      buildDsxuBackgroundTaskFinalGateNudge([malformedAssistant], {
        task1: {
          id: 'task1',
          type: 'local_agent',
          status: 'running',
          description: 'still running',
        },
      }),
    ).toBeNull()
  })

  test('agent parent final gate tolerates non-provider messages around TaskOutput evidence', () => {
    const taskOutput = TaskOutputTool.mapToolResultToToolResultBlockParam({
      retrieval_status: 'success',
      task: {
        task_id: 'agent-shape-guard',
        task_type: 'local_agent',
        status: 'completed',
        description: 'worker evidence',
        output: 'PASS',
        prompt: 'verify',
        result: 'PASS',
        evidencePacket: {
          files_read: ['src/query.ts'],
          files_changed: [],
          commands_run: ['bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate"'],
          tests_passed: ['bun test src/dsxu/engine/__tests__/v12-prompt-governance-v1.test.ts -t "Agent parent final gate"'],
          tests_failed: [],
          unresolved_risks: [],
          completion_claim: 'complete',
        },
      },
    } as any, 'task-output-shape-guard')

    const evidenceMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: [taskOutput],
      },
      uuid: 'task-output-evidence',
    } as any
    const uncitedFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'uncited-final',
        content: [{ type: 'text', text: 'Done. Tests pass.' }],
      },
      uuid: 'uncited-final',
    } as any

    expect(() =>
      buildDsxuAgentFinalGateNudge(
        [malformedUser, { type: 'system', uuid: 'system-event' } as any, evidenceMessage],
        [malformedAssistant, uncitedFinal],
      ),
    ).not.toThrow()
    expect(
      buildDsxuAgentFinalGateNudge(
        [malformedUser, { type: 'system', uuid: 'system-event' } as any, evidenceMessage],
        [malformedAssistant, uncitedFinal],
      ),
    ).toContain('DSXU parent-final evidence gate')
  })

  test('cursor streak helpers tolerate malformed messages', () => {
    const messages = [
      malformedUser,
      { type: 'attachment', attachment: { type: 'max_turns_reached' } },
      malformedAssistant,
    ] as any[]

    expect(() => getDsxuFailedVerificationStreakSinceEdit(messages)).not.toThrow()
    expect(() => getDsxuDiscoveryStreakSinceProgress(messages)).not.toThrow()
    expect(() => getDsxuUnverifiedEditStreak(messages)).not.toThrow()
    expect(getDsxuFailedVerificationStreakSinceEdit(messages)).toBe(0)
    expect(getDsxuDiscoveryStreakSinceProgress(messages)).toBe(0)
    expect(getDsxuUnverifiedEditStreak(messages)).toBe(0)
  })

  test('lifecycle trace can read latest tool state without content TDZ', () => {
    const messages = [
      malformedUser,
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'verify-pass',
              content:
                'bun test\n4 pass\n0 fail\nDSXU tool state: verification_passed; next=final_answer.',
            },
          ],
        },
        uuid: 'verification-result',
      },
    ] as any[]

    expect(() => getLatestDsxuToolStateForTrace(messages)).not.toThrow()
    expect(getLatestDsxuToolStateForTrace(messages)).toBe('verification_passed')
  })

  test('execution visibility gate still blocks broad silent batches with malformed history', () => {
    const toolUses = Array.from({ length: 4 }, (_, index) => ({
      type: 'tool_use',
      id: `tool-${index}`,
      name: index % 2 === 0 ? 'Read' : 'PowerShell',
      input: {},
    })) as any

    const nudge = buildDsxuExecutionVisibilityNudge(toolUses, [
      malformedAssistant,
    ])
    expect(nudge).toContain('DSXU execution-visibility gate')
  })

  test('execution visibility gate clears speculative Read cache for blocked reads', () => {
    const cache = createFileStateCacheWithSizeLimit(10)
    const filePath = '.\\fixtures\\blocked-read.ts'
    const normalizedPath = expandPath(filePath)
    cache.set(normalizedPath, {
      content: 'stale speculative content',
      timestamp: 1,
      offset: undefined,
      limit: undefined,
    })

    const clearedPaths = clearDsxuReadCacheForBlockedExecutionVisibility(
      [
        {
          type: 'tool_use',
          id: 'read-1',
          name: 'Read',
          input: { file_path: filePath },
        },
        {
          type: 'tool_use',
          id: 'bash-1',
          name: 'Bash',
          input: { command: 'echo ok' },
        },
        {
          type: 'tool_use',
          id: 'read-malformed',
          name: 'Read',
          input: {},
        },
      ] as any,
      cache,
    )

    expect(clearedPaths).toEqual([normalizedPath])
    expect(cache.has(normalizedPath)).toBe(false)
  })

  test('post-edit final gate blocks final answers before fresh verification', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content:
              'DSXU tool state: edit_applied; next=run_smallest_verification',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const staleFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'stale-final',
        content: [{ type: 'text', text: 'FAIL: tests still failed.' }],
      },
      uuid: 'stale-final',
    } as any

    expect(hasDsxuUnverifiedMutationSinceVerification([editResult])).toBe(true)
    expect(
      buildDsxuUnverifiedMutationFinalGateNudge(
        [editResult],
        [staleFinal],
        true,
      ),
    ).toContain('DSXU post-edit verification final gate')
  })

  test('post-edit final gate clears after verification evidence', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content: 'DSXU tool state: edit_applied',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const verificationResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'verify-1',
            content:
              'bun test src/cart.test.ts\n1 pass\n0 fail\nDSXU tool state: verification_passed; next=final_answer',
          },
        ],
      },
      uuid: 'verification-result',
    } as any
    const finalAnswer = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'verified-final',
        content: [{ type: 'text', text: 'PASS' }],
      },
      uuid: 'verified-final',
    } as any

    expect(
      hasDsxuUnverifiedMutationSinceVerification([
        editResult,
        verificationResult,
      ]),
    ).toBe(false)
    expect(
      buildDsxuUnverifiedMutationFinalGateNudge(
        [editResult, verificationResult],
        [finalAnswer],
        true,
      ),
    ).toBeNull()
  })

  test('post-edit final gate permits explicit partial when no verifier exists', () => {
    const editResult = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'edit-1',
            content: 'DSXU tool state: edit_applied',
          },
        ],
      },
      uuid: 'edit-result',
    } as any
    const partialFinal = {
      type: 'assistant',
      message: {
        role: 'assistant',
        id: 'partial-final',
        content: [
          {
            type: 'text',
            text: 'PARTIAL: no verification tool is available after the edit.',
          },
        ],
      },
      uuid: 'partial-final',
    } as any

    expect(
      buildDsxuUnverifiedMutationFinalGateNudge(
        [editResult],
        [partialFinal],
        false,
      ),
    ).toBeNull()
  })
})
