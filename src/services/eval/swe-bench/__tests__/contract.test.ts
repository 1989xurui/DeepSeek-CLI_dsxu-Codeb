import { describe, expect, test } from 'bun:test'
import { generateDetailedReport } from '../bridge'
import { validateSweTask } from '../contract'
import type { SWEResult } from '../contract'
import { createInternalSweSmokeTask } from '../runner'

describe('DSXU SWE benchmark replacement owner contract', () => {
  test('creates a DSXU-owned internal smoke task without public benchmark claim semantics', () => {
    const task = createInternalSweSmokeTask('internal-001')

    expect(task.id).toBe('internal-001')
    expect(task.repo).toBe('dsxu/internal-smoke')
    expect(task.languages).toContain('typescript')
    expect(task.goldPatch).toContain('fixed')
    expect(validateSweTask(task)).toEqual([])
  })

  test('validates malformed benchmark tasks before they can enter evidence', () => {
    const errors = validateSweTask({
      id: '',
      repo: '',
      difficulty: 'easy',
      languages: [],
      multiFile: false,
    })

    expect(errors).toContain('task id is required')
    expect(errors).toContain('repo is required')
    expect(errors).toContain('base commit is required')
    expect(errors).toContain('problem statement is required')
    expect(errors).toContain('at least one language is required')
    expect(errors).toContain('test patch is required')
  })

  test('keeps owner-level reporting under eval evidence instead of the legacy service', () => {
    const easyTask = createInternalSweSmokeTask('easy-001')
    const hardTask = {
      ...createInternalSweSmokeTask('hard-001', 'real-benchmark'),
      difficulty: 'hard' as const,
      languages: ['typescript', 'python'],
    }
    const results: SWEResult[] = [
      {
        taskId: easyTask.id,
        generatedPatch: easyTask.goldPatch ?? '',
        testsPassed: true,
        passedTests: 1,
        totalTests: 1,
        durationMs: 10,
      },
      {
        taskId: hardTask.id,
        generatedPatch: '',
        testsPassed: false,
        passedTests: 0,
        totalTests: 1,
        durationMs: 20,
        error: 'failing test',
      },
    ]

    const report = generateDetailedReport([easyTask, hardTask], results)

    expect(report.totalTasks).toBe(2)
    expect(report.passedTasks).toBe(1)
    expect(report.passAt1).toBe(0.5)
    expect(report.byDifficulty.easy.rate).toBe(1)
    expect(report.byDifficulty.hard.rate).toBe(0)
    expect(report.byLanguage.typescript.total).toBe(2)
    expect(report.byLanguage.python.total).toBe(1)
  })
})
