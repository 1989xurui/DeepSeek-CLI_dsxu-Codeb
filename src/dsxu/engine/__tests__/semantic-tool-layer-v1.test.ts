import { describe, expect, test } from 'bun:test'
import {
  buildRunNativeTestDecision,
  classifyVerificationCommand,
  collectEvidenceFromVerificationEvents,
  getVerificationIntentKey,
  getVerificationCommandKey,
  normalizeSemanticCommand,
  type SemanticVerificationEvent,
} from '../v18-semantic-tools'
import { buildSemanticToolGateRealTrace } from '../v18-semantic-tool-trace'

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
