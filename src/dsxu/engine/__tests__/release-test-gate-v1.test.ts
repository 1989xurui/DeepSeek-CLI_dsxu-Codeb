import { describe, expect, test } from 'bun:test'
import {
  classifyDsxuTestForGate,
  DSXU_QUARANTINE_RULES,
  DSXU_RELEASE_GATE_TESTS,
  getDsxuReleaseGateCommand,
} from '../release-test-gate'

describe('DSXU release/quarantine test gate V1', () => {
  test('release gate contains only focused runtime-critical tests', () => {
    expect(DSXU_RELEASE_GATE_TESTS.length).toBeGreaterThanOrEqual(10)
    expect(DSXU_RELEASE_GATE_TESTS.every(entry => entry.required)).toBe(true)
    expect(DSXU_RELEASE_GATE_TESTS.map(entry => entry.path)).toContain(
      'src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
    )
    expect(DSXU_RELEASE_GATE_TESTS.map(entry => entry.path)).toContain(
      'src/dsxu/engine/__tests__/background-task-hard-gate-v1.test.ts',
    )
  })

  test('known stale side-path tests are quarantine, not release score', () => {
    expect(classifyDsxuTestForGate('src/dsxu/engine/__tests__/compact-session-integration.test.ts')).toBe('quarantine')
    expect(classifyDsxuTestForGate('src/dsxu/engine/__tests__/prompt-processing-v1-clean.test.ts')).toBe('quarantine')
    expect(classifyDsxuTestForGate('src/dsxu/engine/__tests__/context-analysis-v1-clean.test.ts')).toBe('quarantine')
    expect(classifyDsxuTestForGate('src/dsxu/engine/__tests__/c16-shell-full-audit-clean.test.ts')).toBe('quarantine')
    expect(DSXU_QUARANTINE_RULES.length).toBeGreaterThanOrEqual(5)
  })

  test('release command is explicit and does not run the historical V-series suite', () => {
    const command = getDsxuReleaseGateCommand()
    expect(command[0]).toBe('bun')
    expect(command[1]).toBe('test')
    expect(command.join('\n')).not.toContain('compact-session-integration')
    expect(command.join('\n')).not.toContain('c16-shell-full-audit-clean')
    expect(command.join('\n')).not.toContain('prompt-processing-v1-clean')
    expect(command.join('\n')).not.toContain('context-analysis-v1-clean')
  })
})
