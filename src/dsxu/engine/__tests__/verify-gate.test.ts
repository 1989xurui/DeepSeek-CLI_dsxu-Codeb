import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runVerifyGate } from '../verify-gate'
import type { QueryEvent, QueryResult } from '../types'

describe('VerifyGate', () => {
  const baseResult: QueryResult = {
    exitReason: 'end_turn',
    finalMessage: 'task completed',
    turns: 1,
    memories: [],
  }

  const fileEditEvent: QueryEvent = {
    type: 'tool_result',
    toolName: 'FileEdit',
    toolUseId: 'edit-1',
    result: {
      toolUseId: 'edit-1',
      content: 'edited src/example.ts',
      isError: false,
    },
  }

  const bashEvent: QueryEvent = {
    type: 'tool_result',
    toolName: 'Bash',
    toolUseId: 'bash-1',
    result: {
      toolUseId: 'bash-1',
      content: 'ls -la',
      isError: false,
    },
  }

  const verificationPassEvent: QueryEvent = {
    type: 'tool_result',
    toolName: 'Bash',
    toolUseId: 'verify-pass',
    result: {
      toolUseId: 'verify-pass',
      content: 'bun test src/example.test.ts\n1 pass\n0 fail',
      isError: false,
    },
  }

  const verificationFailEvent: QueryEvent = {
    type: 'tool_result',
    toolName: 'Bash',
    toolUseId: 'verify-fail',
    result: {
      toolUseId: 'verify-fail',
      content: 'bun test src/example.test.ts\n0 pass\n1 fail',
      isError: true,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('trigger behavior', () => {
    it('skips when no mutation trigger exists', async () => {
      const { result, verification } = await runVerifyGate([], baseResult, {
        enabled: true,
        triggerOnFileEdit: true,
      })

      expect(verification).toBeUndefined()
      expect(result.exitReason).toBe('end_turn')
    })

    it('passes a file edit only when real post-edit verification evidence exists', async () => {
      const result = await runVerifyGate(
        [fileEditEvent, verificationPassEvent],
        baseResult,
        { enabled: true, triggerOnFileEdit: true },
      )

      expect(result.verification).toBeDefined()
      expect(result.verification?.passed).toBe(true)
      expect(result.verification?.score).toBe(100)
    })

    it('triggers for shell events when configured but does not fake a PASS', async () => {
      const { verification } = await runVerifyGate([bashEvent], baseResult, {
        enabled: true,
        triggerOnBash: true,
        onFailure: 'continue',
      })

      expect(verification).toBeDefined()
      expect(verification?.passed).toBe(false)
      expect(verification?.findings[0]?.title).toBe('Verification evidence is missing')
    })
  })

  describe('configuration', () => {
    it('supports disabling the gate', async () => {
      const { verification } = await runVerifyGate([fileEditEvent], baseResult, {
        enabled: false,
      })

      expect(verification).toBeUndefined()
    })

    it('supports file-edit-only triggers', async () => {
      const { verification } = await runVerifyGate([bashEvent], baseResult, {
        enabled: true,
        triggerOnFileEdit: true,
        triggerOnBash: false,
      })

      expect(verification).toBeUndefined()
    })

    it('supports bash-only triggers', async () => {
      const { verification } = await runVerifyGate([fileEditEvent], baseResult, {
        enabled: true,
        triggerOnFileEdit: false,
        triggerOnBash: true,
      })

      expect(verification).toBeUndefined()
    })
  })

  describe('gate decisions', () => {
    it('attaches rule evidence for passing verification', async () => {
      const { result } = await runVerifyGate(
        [fileEditEvent, verificationPassEvent],
        baseResult,
        {
          enabled: true,
          triggerOnFileEdit: true,
          minScore: 70,
          onFailure: 'warn',
        },
      )

      expect(result.verification).toBeDefined()
      expect(result.verification?.passed).toBe(true)
      expect(result.verification?.ruleResults?.length).toBeGreaterThan(0)
    })

    it('blocks by default when mutation evidence exists but verification is missing', async () => {
      const { result } = await runVerifyGate([fileEditEvent], baseResult, {
        enabled: true,
        triggerOnFileEdit: true,
      })

      expect(result.verification?.passed).toBe(false)
      expect(result.exitReason).toBe('max_errors')
      expect(result.finalMessage).toContain('Task blocked by verification gate')
    })

    it('respects continue mode while retaining failed verification evidence', async () => {
      const { result } = await runVerifyGate([fileEditEvent], baseResult, {
        enabled: true,
        triggerOnFileEdit: true,
        onFailure: 'continue',
      })

      expect(result.exitReason).toBe('end_turn')
      expect(result.verification?.passed).toBe(false)
    })

    it('treats failing native verification output as a blocking failure', async () => {
      const { result, verification } = await runVerifyGate(
        [fileEditEvent, verificationFailEvent],
        baseResult,
        {
          enabled: true,
          triggerOnFileEdit: true,
          onFailure: 'block',
        },
      )

      expect(verification?.passed).toBe(false)
      expect(result.exitReason).toBe('max_errors')
      expect(result.finalMessage).toContain('Task blocked by verification gate')
    })

    it('can run explicit verification commands instead of relying on shell transcript evidence', async () => {
      const { result, verification } = await runVerifyGate([fileEditEvent], baseResult, {
        enabled: true,
        triggerOnFileEdit: true,
        verificationCommands: [
          [
            process.execPath,
            '-e',
            'console.log("focused verification passed"); process.exit(0)',
          ],
        ],
      })

      expect(verification?.passed).toBe(true)
      expect(result.exitReason).toBe('end_turn')
    })
  })
})
