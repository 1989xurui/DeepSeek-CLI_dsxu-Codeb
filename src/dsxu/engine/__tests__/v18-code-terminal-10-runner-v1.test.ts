import { describe, expect, test } from 'bun:test'
import {
  buildV18CodeTerminal10RunnerEvidence,
  V18_CODE_10_CASE_IDS,
  V18_TERMINAL_10_CASE_IDS,
} from '../v18-code-terminal-10-runner'

function plannedCase(id: string, index: number) {
  const flash = index % 3 === 0
  return {
    id,
    category: flash ? 'bugfix' : 'permission',
    status: 'planned',
    entryModel: 'deepseek-v4-flash',
    routeExpectation: {
      expectedModel: flash ? 'deepseek-v4-flash' : 'deepseek-v4-pro',
      routeReason: flash
        ? 'coding_flash_non_thinking'
        : 'high_risk_pro_thinking_max_requires_approval',
    },
  }
}

describe('V18 Code/Terminal-10 Runner V1', () => {
  test('accepts dry plan readiness without claiming Code-10/Terminal-10 scores', () => {
    const cases = [...V18_CODE_10_CASE_IDS, ...V18_TERMINAL_10_CASE_IDS].map(
      plannedCase,
    )
    const evidence = buildV18CodeTerminal10RunnerEvidence({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-eval/code-terminal.json',
      sourceReportPath: '.dsxu/runs/code-terminal/dry-report.json',
      outDir: '.dsxu/runs/code-terminal',
      sourceReport: {
        mode: 'dry',
        entryModelMode: 'auto',
        entryModel: 'deepseek-v4-flash',
        cases,
      },
    })

    expect(evidence.ok).toBe(true)
    expect(evidence.status).toBe('DRY_PLAN_READY')
    expect(evidence.code.found).toBe(10)
    expect(evidence.terminal.found).toBe(10)
    expect(evidence.code.pass).toBe(0)
    expect(evidence.terminal.pass).toBe(0)
    expect(evidence.routeModels).toEqual([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
    ])
    expect(evidence.guards).toContain(
      'dry plan only; no Code-10 or Terminal-10 score can be claimed',
    )
    expect(evidence.nextCommand.live).toContain('--live')
    expect(evidence.nextCommand.live).toContain('--entry-model=auto')
  })

  test('blocks missing cases and non-Flash-first entry mode', () => {
    const evidence = buildV18CodeTerminal10RunnerEvidence({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-eval/code-terminal.json',
      sourceReportPath: '.dsxu/runs/code-terminal/dry-report.json',
      outDir: '.dsxu/runs/code-terminal',
      sourceReport: {
        mode: 'dry',
        entryModelMode: 'pro',
        entryModel: 'deepseek-v4-pro',
        cases: V18_CODE_10_CASE_IDS.slice(0, 2).map(plannedCase),
      },
    })

    expect(evidence.ok).toBe(false)
    expect(evidence.status).toBe('BLOCKED')
    expect(evidence.blockers).toContain('runner entry model must be auto for Flash-first evidence')
    expect(evidence.blockers).toContain('runner dry/live entry model is not Flash-first')
    expect(evidence.blockers.some(blocker => blocker.startsWith('missing Code-10 cases'))).toBe(true)
    expect(evidence.blockers.some(blocker => blocker.startsWith('missing Terminal-10 cases'))).toBe(true)
  })
})
