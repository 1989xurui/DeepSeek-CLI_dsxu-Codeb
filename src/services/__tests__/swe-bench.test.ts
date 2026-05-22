import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  createDefaultOutputPath,
  createInternalSweSmokeTask,
  generateDetailedReport,
  runSweBenchInstances,
  validateSweTask,
} from '../eval/swe-bench/index'
import type { SWEResult } from '../eval/swe-bench/contract'

describe('legacy SWE owner migration evidence', () => {
  test('uses the eval SWE owner for task construction and validation', () => {
    const task = createInternalSweSmokeTask('legacy-migrated-001')

    expect(task.id).toBe('legacy-migrated-001')
    expect(task.repo).toBe('dsxu/internal-smoke')
    expect(task.languages).toContain('typescript')
    expect(validateSweTask(task)).toEqual([])
  })

  test('rejects incomplete task evidence before it can become a release claim', () => {
    const errors = validateSweTask({
      id: '',
      repo: 'dsxu/internal-smoke',
      difficulty: 'easy',
      languages: ['typescript'],
      multiFile: false,
    })

    expect(errors).toContain('task id is required')
    expect(errors).toContain('base commit is required')
    expect(errors).toContain('problem statement is required')
    expect(errors).toContain('test patch is required')
  })

  test('runs internal smoke through the eval owner with public claims blocked', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-swe-owner-migration-'))
    try {
      const output = await runSweBenchInstances(
        {
          instanceIds: ['legacy-migrated-001', 'legacy-migrated-002'],
          timeoutMs: 1000,
          model: 'deepseek-v4-flash',
          mode: 'internal-smoke',
          outputPath: join(dir, 'internal-smoke.json'),
        },
        {
          mockRunner: async task => ({
            taskId: task.id,
            generatedPatch: task.goldPatch ?? '',
            testsPassed: true,
            passedTests: 1,
            totalTests: 1,
            durationMs: 1,
          }),
        },
      )

      expect(output.owner).toBe('Evidence / benchmark / public challenge')
      expect(output.mode).toBe('internal-smoke')
      expect(output.publicBenchmarkClaimAllowed).toBe(false)
      expect(output.claimBoundary).toContain('not a public SWE-bench score')
      expect(output.passRate).toBe(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('keeps report aggregation under the eval evidence owner', () => {
    const easyTask = createInternalSweSmokeTask('easy-pass')
    const hardTask = {
      ...createInternalSweSmokeTask('hard-fail', 'real-benchmark'),
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

    expect(report.passAt1).toBe(0.5)
    expect(report.byDifficulty.easy.rate).toBe(1)
    expect(report.byDifficulty.hard.rate).toBe(0)
    expect(report.byLanguage.typescript.total).toBe(2)
    expect(report.byLanguage.python.total).toBe(1)
  })

  test('keeps default output paths claim-safe by mode', () => {
    expect(createDefaultOutputPath(new Date('2026-05-17T00:00:00Z'))).toContain(
      'DSXU_SWE_INTERNAL_SMOKE_RESULTS_20260517.json',
    )
    expect(createDefaultOutputPath(new Date('2026-05-17T00:00:00Z'), 'real-benchmark')).toContain(
      'DSXU_SWE_BENCH_RESULTS_20260517.json',
    )
  })
})
