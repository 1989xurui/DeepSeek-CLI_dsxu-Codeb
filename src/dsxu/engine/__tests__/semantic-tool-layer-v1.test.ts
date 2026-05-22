import { describe, expect, test } from 'bun:test'
import {
  analyzeVerificationFailure,
  buildRunNativeTestDecision,
  classifyVerificationCommand,
  collectEvidenceFromVerificationEvents,
  getVerificationIntentKey,
  getVerificationCommandKey,
  normalizeSemanticCommand,
  stripNoisyVerificationShellSyntax,
  type SemanticVerificationEvent,
} from '../semantic-tools'
import { buildSemanticToolGateRealTrace } from '../semantic-tool-trace'

describe('V18 semantic tool layer', () => {
  test('normalizes native verification commands without hiding strategy changes', () => {
    expect(normalizeSemanticCommand('  bun    test   src/a.test.ts  ')).toBe(
      'bun test src/a.test.ts',
    )
    expect(classifyVerificationCommand('bun test src/a.test.ts --timeout 180000')).toBe(
      'native_test',
    )
    expect(classifyVerificationCommand('npm run build')).toBe('native_build')
    expect(classifyVerificationCommand('curl http://localhost:5173')).toBe('dev_server')

    const firstKey = getVerificationCommandKey({
      cwd: 'D:\\DSXU-code',
      command: 'bun test src/a.test.ts',
    })
    const secondKey = getVerificationCommandKey({
      cwd: 'D:/DSXU-code',
      command: 'bun    test   src/b.test.ts',
    })
    expect(secondKey).not.toBe(firstKey)
  })

  test('groups noisy native-test shell variants without hiding real grep strategy changes', () => {
    const failedAttempt: SemanticVerificationEvent = {
      id: 'attempt-1',
      tool: 'PowerShell',
      command:
        'bun test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts --timeout 180000 2>&1',
      cwd: 'D:\\DSXU-code',
      exitCode: 1,
      output: '1 fail\nexit code 1',
    }
    const noisyTimeoutChange = buildRunNativeTestDecision({
      command:
        'bun   test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts --timeout 240000',
      cwd: 'D:/DSXU-code',
      previousAttempts: [failedAttempt],
    })
    const grepStrategyChange = buildRunNativeTestDecision({
      command:
        'bun test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts --grep focused',
      cwd: 'D:/DSXU-code',
      previousAttempts: [failedAttempt],
      strategyChangedSinceLastAttempt: true,
    })

    expect(getVerificationIntentKey(failedAttempt)).toBe(noisyTimeoutChange.intentKey)
    expect(noisyTimeoutChange.action).toBe('block_repeated_verification')
    expect(grepStrategyChange.intentKey).not.toBe(noisyTimeoutChange.intentKey)
    expect(grepStrategyChange.action).toBe('run')
  })

  test('strips noisy shell syntax without lowercasing case-sensitive test patterns', () => {
    const command =
      'bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts -t SendMessage 2>&1'
    const noisyAttempt: SemanticVerificationEvent = {
      id: 'attempt-1',
      tool: 'RunNativeTest',
      command,
      cwd: 'D:\\DSXU-code',
      exitCode: 1,
    }
    const sameIntentDifferentCase = buildRunNativeTestDecision({
      command:
        'bun   test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts -t sendmessage',
      cwd: 'D:/DSXU-code',
      previousAttempts: [noisyAttempt],
    })

    expect(stripNoisyVerificationShellSyntax(command)).toContain('-t SendMessage')
    expect(stripNoisyVerificationShellSyntax(command)).not.toContain('2>&1')
    expect(sameIntentDifferentCase.intentKey).toBe(getVerificationIntentKey(noisyAttempt))
    expect(sameIntentDifferentCase.action).toBe('block_repeated_verification')
  })

  test('blocks same failed native test until source or strategy changes', () => {
    const command = 'bun test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts'
    const failedAttempt: SemanticVerificationEvent = {
      id: 'attempt-1',
      tool: 'PowerShell',
      command,
      cwd: 'D:\\DSXU-code',
      exitCode: 1,
      output: '1 fail\nexit code 1',
    }

    expect(
      buildRunNativeTestDecision({
        command,
        cwd: 'D:\\DSXU-code',
      }).action,
    ).toBe('run')
    expect(
      buildRunNativeTestDecision({
        command,
        cwd: 'D:\\DSXU-code',
        previousAttempts: [failedAttempt],
      }).action,
    ).toBe('block_repeated_verification')
    expect(
      buildRunNativeTestDecision({
        command,
        cwd: 'D:\\DSXU-code',
        previousAttempts: [failedAttempt],
        sourceChangedSinceLastAttempt: true,
      }).action,
    ).toBe('run')
    expect(
      buildRunNativeTestDecision({
        command: `${command} --grep focused`,
        cwd: 'D:\\DSXU-code',
        previousAttempts: [failedAttempt],
        strategyChangedSinceLastAttempt: true,
      }).action,
    ).toBe('run')
  })

  test('does not reuse a prior pass after a source mutation', () => {
    const command = 'bun test test/apiMicrocompact.test.ts'
    const passedAttempt: SemanticVerificationEvent = {
      id: 'attempt-1',
      tool: 'RunNativeTest',
      command,
      cwd: 'D:\\DSXU-code',
      exitCode: 0,
      output: '4 pass\n0 fail',
    }

    const stalePass = buildRunNativeTestDecision({
      command,
      cwd: 'D:\\DSXU-code',
      previousAttempts: [passedAttempt],
    })
    const freshAfterEdit = buildRunNativeTestDecision({
      command,
      cwd: 'D:\\DSXU-code',
      previousAttempts: [passedAttempt],
      sourceChangedSinceLastAttempt: true,
    })

    expect(stalePass.action).toBe('collect_existing_pass')
    expect(freshAfterEdit.action).toBe('run')
    expect(freshAfterEdit.reason).toBe('source_changed_after_passed_native_verification')
  })

  test('collects repeated raw verification into concise latest evidence', () => {
    const command = 'bun test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts'
    const evidence = collectEvidenceFromVerificationEvents([
      {
        id: 'attempt-1',
        tool: 'PowerShell',
        command,
        cwd: 'D:\\DSXU-code',
        exitCode: 1,
        output: '1 fail\nexit code 1',
      },
      {
        id: 'attempt-2',
        tool: 'RunNativeTest',
        command,
        cwd: 'D:\\DSXU-code',
        exitCode: 0,
        output: '9 pass\n0 fail',
      },
    ])

    expect(evidence.status).toBe('PASS')
    expect(evidence.rawCommandCount).toBe(2)
    expect(evidence.uniqueCommandCount).toBe(1)
    expect(evidence.repeatedCommandCount).toBe(1)
    expect(evidence.latestVerification?.outputSignal).toContain('9 pass')
    expect(evidence.failedCommands).toHaveLength(1)
    expect(evidence.warnings).toContain(
      'raw verification had repeated commands; prefer RunNativeTest before shell fallback',
    )
  })

  test('failure oracle turns native stderr into a repair target', () => {
    const oracle = analyzeVerificationFailure(`
test\\apiMicrocompact.test.ts:

# Unhandled error between tests
SyntaxError: Export named 'apiMicrocompact' not found in module 'D:\\work\\src\\services\\compact\\apiMicrocompact.ts'.
`)

    expect(oracle.kind).toBe('missing_export')
    expect(oracle.confidence).toBe('high')
    expect(oracle.symbols).toContain('apiMicrocompact')
    expect(oracle.targetFiles.join('\n')).toContain('src/services/compact/apiMicrocompact.ts')
    expect(oracle.targetFiles.join('\n')).toContain('test/apiMicrocompact.test.ts')
    expect(oracle.nextAction).toBe('read_named_source_and_test')
  })

  test('failure oracle treats missing prompt-named files as blocked targets', () => {
    const oracle = analyzeVerificationFailure(
      'Error: ENOENT: no such file or directory, open "D:/repo/src/format.js"',
    )

    expect(oracle.kind).toBe('missing_module_or_file')
    expect(oracle.targetFiles).toContain('D:/repo/src/format.js')
    expect(oracle.nextAction).toBe('locate_missing_module_or_file')
  })

  test('failure oracle recognizes extensionless missing modules from unrelated baseline failures', () => {
    const oracle = analyzeVerificationFailure(
      "error: Cannot find module '../src/dsxu/engine/analyzers/classification-analyzer' from 'D:\\repo\\test\\opportunity-discovery.test.ts'",
    )

    expect(oracle.kind).toBe('missing_module_or_file')
    expect(oracle.targetFiles).toContain('../src/dsxu/engine/analyzers/classification-analyzer')
    expect(oracle.targetFiles.join('\n')).toContain('test/opportunity-discovery.test.ts')
    expect(oracle.nextAction).toBe('locate_missing_module_or_file')
  })

  test('real trace proves duplicate gate does not overblock changed strategy', async () => {
    const trace = await buildSemanticToolGateRealTrace()

    expect(trace.ok).toBe(true)
    expect(trace.gate.blockedDuplicateCount).toBe(2)
    expect(trace.gate.blockedReadCacheRepeatCount).toBe(1)
    expect(trace.gate.changedStrategyAllowedCount).toBeGreaterThanOrEqual(3)
    expect(trace.gate.overblockCount).toBe(0)
    expect(trace.semanticTools.evidence.status).toBe('PASS')
  })
})
