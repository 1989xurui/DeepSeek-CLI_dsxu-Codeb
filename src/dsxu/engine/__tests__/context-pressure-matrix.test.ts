import { describe, expect, test } from 'bun:test'
import { buildDsxuContextBudgetSystemContext } from '../../../query'
import {
  buildDSXUContextPressureDecision,
  classifyDSXUContextPressureBucket,
} from '../context-pressure-matrix'

describe('DSXU context pressure matrix', () => {
  test('classifies 70/85/95/99 pressure bands without replacing the query context owner', () => {
    expect(classifyDSXUContextPressureBucket(69)).toBe('<70')
    expect(classifyDSXUContextPressureBucket(70)).toBe('70-84')
    expect(classifyDSXUContextPressureBucket(85)).toBe('85-94')
    expect(classifyDSXUContextPressureBucket(95)).toBe('95-98')
    expect(classifyDSXUContextPressureBucket(99)).toBe('>=99')
  })

  test('keeps source truth and cache-safe recovery visible under critical pressure', () => {
    const decision = buildDSXUContextPressureDecision({
      tokenUsage: 970,
      effectiveWindow: 1000,
      postCompact: true,
      promptTooLongRecovered: true,
    })

    expect(decision.bucket).toBe('95-98')
    expect(decision.risk).toBe('critical')
    expect(decision.recommendedAction).toBe('source_capsule_then_context_hygiene')
    expect(decision.sourceTruthReread).toBe('required-before-edit-or-pass')
    expect(decision.cachePolicy).toContain('freeze_route_tools')
    expect(decision.warnings.join('\n')).toContain('Critical context pressure')
    expect(decision.warnings.join('\n')).toContain('Prompt-too-long recovery already ran')
  })

  test('query prompt projection exposes the same matrix and 413 compatibility signals', () => {
    const prompt = buildDsxuContextBudgetSystemContext({
      tokenUsage: 10_000_000,
      model: 'deepseek-v4-flash',
      postCompact: false,
    })

    expect(prompt).toContain('contextPolicy: route-aware/context-window-aware/cache-aware')
    expect(prompt).toContain('contextUsedPercent: >=99')
    expect(prompt).toContain('contextRisk: emergency')
    expect(prompt).toContain('promptTooLongCompatibility: must_withhold_413_until_context_collapse_or_reactive_compact_attempted')
    expect(prompt).toContain('sourceTruthReread: required-before-edit-or-pass')
  })
})
