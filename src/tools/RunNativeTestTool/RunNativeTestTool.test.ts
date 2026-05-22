import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { RunNativeTestTool } from './RunNativeTestTool'
import { hasSourceMutationAfterLatestSameVerification } from './semanticVerificationMessages'

describe('RunNativeTestTool owner gate', () => {
  test('requires an absolute existing cwd before native execution', async () => {
    const relative = await RunNativeTestTool.validateInput({
      command: 'bun test',
      cwd: 'relative-project',
    } as never, {} as never)
    expect(relative.result).toBe(false)

    const missing = await RunNativeTestTool.validateInput({
      command: 'bun test',
      cwd: join(process.cwd(), 'does-not-exist-for-run-native-test'),
    } as never, {} as never)
    expect(missing.result).toBe(false)

    const ok = await RunNativeTestTool.validateInput({
      command: 'bun test',
      cwd: process.cwd(),
    } as never, {} as never)
    expect(ok.result).toBe(true)
  })

  test('uses the DSXU permission pipeline instead of default allow', async () => {
    const decision = await RunNativeTestTool.checkPermissions({
      command: 'bun test',
      cwd: process.cwd(),
    } as never, {} as never)

    expect(decision.behavior).toBe('passthrough')
    expect(decision.message).toContain('RunNativeTest wants to execute')
  })

  test('normalizes shell redirection before permission and execution semantics', async () => {
    const ok = await RunNativeTestTool.validateInput({
      command: 'bun test --bail 2>&1',
      cwd: process.cwd(),
    } as never, {} as never)
    const decision = await RunNativeTestTool.checkPermissions({
      command: 'bun test --bail 2>&1',
      cwd: process.cwd(),
    } as never, {} as never)

    expect(ok.result).toBe(true)
    expect(decision.message).toContain("execute 'bun test --bail'")
    expect(decision.message).not.toContain('2>&1')
  })

  test('preserves case-sensitive bun test name patterns while cleaning shell noise', async () => {
    const command =
      'bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts -t SendMessage 2>&1'
    const ok = await RunNativeTestTool.validateInput({
      command,
      cwd: process.cwd(),
    } as never, {} as never)
    const decision = await RunNativeTestTool.checkPermissions({
      command,
      cwd: process.cwd(),
    } as never, {} as never)

    expect(ok.result).toBe(true)
    expect(decision.message).toContain('-t SendMessage')
    expect(decision.message).not.toContain('-t sendmessage')
    expect(decision.message).not.toContain('2>&1')
  })

  test('projects failure oracle into the model-visible tool result', () => {
    const block = RunNativeTestTool.mapToolResultToToolResultBlockParam({
      status: 'fail',
      command: 'bun test --bail',
      cwd: process.cwd(),
      exitCode: 1,
      stdout: '',
      stderr: 'SyntaxError: Export named \'apiMicrocompact\' not found in module \'D:\\repo\\src\\services\\compact\\apiMicrocompact.ts\'.',
      decisionReason: 'first_semantic_native_verification_for_target',
      failureOracle: {
        kind: 'missing_export',
        confidence: 'high',
        summary: 'missing export apiMicrocompact from D:/repo/src/services/compact/apiMicrocompact.ts',
        targetFiles: ['D:/repo/src/services/compact/apiMicrocompact.ts', 'test/apiMicrocompact.test.ts'],
        symbols: ['apiMicrocompact'],
        nextAction: 'read_named_source_and_test',
      },
    } as never, 'tool-1')

    expect(block.content).toContain('FailureOracle kind=missing_export')
    expect(block.content).toContain('FailureOracle targetFiles=D:/repo/src/services/compact/apiMicrocompact.ts')
    expect(block.content).toContain('FailureOracle symbols=apiMicrocompact')
  })

  test('invalidates prior passing native verification after an edit result', () => {
    const command = 'bun test test/apiMicrocompact.test.ts'
    const messages = [
      {
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'verify-1',
              name: 'RunNativeTest',
              input: { command, cwd: 'D:/repo' },
            },
          ],
        },
      },
      {
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'verify-1',
              content: 'RunNativeTest status: pass\nexitCode=0\nDSXU tool state: verification_passed; semanticTool=RunNativeTest; next=collect_evidence_before_final_or_final_now.',
              is_error: false,
            },
          ],
        },
      },
      {
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'edit-1',
              content: 'The file D:/repo/src/services/compact/apiMicrocompact.ts has been updated successfully.\nDSXU tool state: edit_applied; next=planned_edit_or_verify.',
              is_error: false,
            },
          ],
        },
      },
    ]

    expect(
      hasSourceMutationAfterLatestSameVerification(
        messages as never,
        event => event.command === command,
      ),
    ).toBe(true)
  })

  test('invalidates repeated native verification after a write result', () => {
    const command = 'bun test --bail'
    const messages = [
      {
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'verify-1',
              name: 'RunNativeTest',
              input: { command, cwd: 'D:/repo' },
            },
          ],
        },
      },
      {
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'verify-1',
              content: 'RunNativeTest status: fail\nexitCode=1\nDSXU tool state: verification_failed; semanticTool=RunNativeTest; next=repair_or_report_partial.',
              is_error: true,
            },
          ],
        },
      },
      {
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'write-1',
              content: 'File created successfully at: D:/repo/docs/missing.md.\nDSXU tool state: file_written; blocked=repeat_same_write,shell_write_fallback; next=verify.',
              is_error: false,
            },
          ],
        },
      },
    ]

    expect(
      hasSourceMutationAfterLatestSameVerification(
        messages as never,
        event => event.command === command,
      ),
    ).toBe(true)
  })
})
