import { describe, expect, test } from 'bun:test'
import {
  decideContextDiscipline,
  evaluateContextHygiene,
} from '../context-discipline-control'

describe('context discipline capability-first policy', () => {
  test('does not compact early in a 1M context when cache-friendly room remains', () => {
    const messages = [
      { role: 'system', content: 'stable DSXU prefix' },
      { role: 'user', content: 'implement a multi-file feature with tests' },
      { role: 'assistant', content: 'tool trace summary '.repeat(600) },
    ]

    const decision = decideContextDiscipline({
      taskId: 'capability-first-1m',
      query: 'continue the complex coding task',
      usedTokens: 620_000,
      maxTokens: 1_000_000,
      messages,
    })

    expect(decision.action).toBe('keep')
    expect(decision.risk).toBe('low')
  })

  test('briefs but does not compact medium-pressure large-context tasks', () => {
    const decision = decideContextDiscipline({
      taskId: 'capability-first-medium',
      query: 'continue the complex coding task',
      usedTokens: 700_000,
      maxTokens: 1_000_000,
      messages: [
        { role: 'system', content: 'stable DSXU prefix' },
        { role: 'tool', content: 'build log '.repeat(3000) },
      ],
    })

    expect(decision.action).toBe('brief')
    expect(decision.risk).toBe('medium')
  })

  test('turns high-pressure large-context tasks into snapshot hygiene, not early compact', () => {
    const highPressure = decideContextDiscipline({
      taskId: 'capability-first-high',
      query: 'continue the complex coding task',
      usedTokens: 910_000,
      maxTokens: 1_000_000,
      messages: [{ role: 'user', content: 'continue' }],
    })

    expect(highPressure.action).toBe('snapshot_hygiene')
    expect(highPressure.risk).toBe('high')
    expect(highPressure.routeHints).toContain('route:context-hygiene')
    expect(highPressure.suggestedActions).toContain('snapshot-current-task-state')
    expect(highPressure.suggestedActions).toContain('compress-volatile-output-only')
    expect(highPressure.reason).toContain('route-aware context window')
  })

  test('keeps collapse only for critical or pathological context recovery', () => {
    const critical = decideContextDiscipline({
      taskId: 'capability-first-critical',
      query: 'continue the complex coding task',
      usedTokens: 970_000,
      maxTokens: 1_000_000,
      messages: [{ role: 'tool', content: 'x'.repeat(90_000) }],
    })

    expect(critical.action).toBe('collapse')
    expect(critical.risk).toBe('critical')

    const pathological = evaluateContextHygiene(
      [{ role: 'tool', content: 'x'.repeat(90_000) }],
      { contextWindow: 1_000_000 },
    )

    expect(pathological.some(issue => issue.severity === 'critical')).toBe(true)
  })
})
