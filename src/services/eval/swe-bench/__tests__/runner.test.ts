import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { SWEResult, SWETask } from '../contract'
import { SweBenchJudge } from '../judge'
import { createDefaultOutputPath, normalizeSweBenchMode, runSweBenchInstances } from '../runner'

const task: SWETask = {
  id: 'example',
  repo: 'external/swe-bench',
  baseCommit: 'abc123',
  problemStatement: 'fix a real failing test',
  difficulty: 'easy',
  languages: ['typescript'],
  multiFile: false,
  testPatch: '+ test',
  goldPatch: '+ export const fixed = true;',
}

describe('DSXU SWE benchmark owner boundary', () => {
  test('does not mark patch similarity as PASS when tests did not pass', () => {
    const result: SWEResult = {
      taskId: task.id,
      generatedPatch: '+ export const fixed = true;',
      testsPassed: false,
      passedTests: 0,
      totalTests: 1,
      durationMs: 1,
    }

    const verdict = new SweBenchJudge().judge(task, result)

    expect(verdict.patchMatch).toBe(1)
    expect(verdict.status).toBe('FAIL')
  })

  test('keeps internal smoke evidence out of public benchmark claims', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-swe-smoke-'))
    const output = await runSweBenchInstances(
      {
        instanceIds: ['mock-001'],
        timeoutMs: 1000,
        model: 'deepseek-v4-flash',
        mode: 'internal-smoke',
        outputPath: join(dir, 'swe-internal-smoke-test.json'),
      },
      {
        mockRunner: async item => ({
          taskId: item.id,
          generatedPatch: item.goldPatch ?? '',
          testsPassed: true,
          passedTests: 1,
          totalTests: 1,
          durationMs: 1,
        }),
      },
    )

    expect(output.mode).toBe('internal-smoke')
    expect(output.passRate).toBe(1)
    expect(output.publicBenchmarkClaimAllowed).toBe(false)
    expect(output.claimBoundary).toContain('internal harness smoke only')
    await rm(dir, { recursive: true, force: true })
  })

  test('maps public-comparable into the real benchmark evidence lane without enabling claims', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-swe-public-comparable-'))
    const output = await runSweBenchInstances(
      {
        instanceIds: ['fixed-public-001'],
        timeoutMs: 1000,
        model: 'deepseek-v4-flash',
        mode: 'public-comparable',
        outputPath: join(dir, 'swe-public-comparable-test.json'),
      },
      {
        mockRunner: async item => ({
          taskId: item.id,
          generatedPatch: item.goldPatch ?? '',
          testsPassed: true,
          passedTests: 1,
          totalTests: 1,
          durationMs: 1,
        }),
      },
    )

    expect(output.requestedMode).toBe('public-comparable')
    expect(output.mode).toBe('real-benchmark')
    expect(output.evidenceClass).toBe('public-comparable-candidate')
    expect(output.publicBenchmarkClaimAllowed).toBe(false)
    expect(output.externalComparisonClaimAllowed).toBe(false)
    expect(output.rawEvidenceRequired).toContain('DSXU raw transcript')
    expect(output.rawEvidenceRequired).toContain('optional paired target/reference raw transcript for external comparison')
    await rm(dir, { recursive: true, force: true })
  })

  test('blocks public-comparable runs when the real SWE environment is not prepared', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-swe-public-blocked-'))
    const output = await runSweBenchInstances(
      {
        instanceIds: ['fixed-public-001'],
        timeoutMs: 1000,
        model: 'deepseek-v4-flash',
        mode: 'public-comparable',
        outputPath: join(dir, 'swe-public-comparable-blocked-test.json'),
      },
      {
        workDir: dir,
        evalDir: join(dir, 'missing-eval-dir'),
      },
    )

    expect(output.status).toBe('BLOCKED_PUBLIC_COMPARABLE_EVIDENCE')
    expect(output.blocked).toBe(1)
    expect(output.crash).toBe(0)
    expect(output.records[0]?.verdict.status).toBe('BLOCKED')
    expect(output.records[0]?.verdict.error).toContain('SWE_BENCH_ENV_NOT_READY')
    expect(output.publicBenchmarkClaimAllowed).toBe(false)
    await rm(dir, { recursive: true, force: true })
  })

  test('keeps public-comparable output paths in the benchmark result family', () => {
    expect(normalizeSweBenchMode('public-comparable')).toBe('real-benchmark')
    expect(createDefaultOutputPath(new Date('2026-05-18T00:00:00Z'), 'public-comparable')).toContain(
      'DSXU_SWE_BENCH_RESULTS_20260518.json',
    )
  })
})
