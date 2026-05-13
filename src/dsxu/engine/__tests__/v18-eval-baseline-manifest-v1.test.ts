import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  buildV18EvalBaselineManifest,
  runV18EvalBaselineManifestHarness,
} from '../v18-eval-baseline-manifest'

describe('V18 Eval Baseline Manifest V1', () => {
  test('generates Flash bare and Pro bare model-forced commands without semantic tools', () => {
    const manifest = buildV18EvalBaselineManifest({
      generatedAt: '2026-05-07T00:00:00.000Z',
      outPrefix: '.dsxu\\runs\\v18-eval-baseline-test',
      caseTimeoutMs: 123456,
    })

    const flashCode = manifest.commands.find(
      item => item.variant === 'flash_bare' && item.suite === 'code',
    )
    const proCode = manifest.commands.find(
      item => item.variant === 'pro_bare' && item.suite === 'code',
    )

    expect(flashCode).toMatchObject({
      runnable: true,
      env: {
        DSXU_BENCH_BASELINE_PROFILE: 'model_forced_bare',
        DSXU_BENCH_MODE: 'cold',
        DSXU_BENCH_ENABLE_SEMANTIC_TOOLS: null,
      },
    })
    expect(flashCode?.command).toContain('--entry-model=flash')
    expect(flashCode?.command).toContain('--case-timeout-ms=123456')
    expect(flashCode?.command).toContain('--case=v8-real-bugfix-multifile')
    expect(flashCode?.command).toContain(
      'Remove-Item Env:\\DSXU_BENCH_ENABLE_SEMANTIC_TOOLS',
    )

    expect(proCode).toMatchObject({
      runnable: true,
      env: {
        DSXU_BENCH_BASELINE_PROFILE: 'model_forced_bare',
        DSXU_BENCH_MODE: 'cold',
        DSXU_BENCH_ENABLE_SEMANTIC_TOOLS: null,
      },
    })
    expect(proCode?.command).toContain('--entry-model=pro')
  })

  test('keeps DSXU Cold auto-routed and BenchMax blocked until candidate evidence exists', () => {
    const manifest = buildV18EvalBaselineManifest({
      generatedAt: '2026-05-07T00:00:00.000Z',
      outPrefix: '.dsxu\\runs\\v18-eval-baseline-test',
    })

    const dsxuTerminal = manifest.commands.find(
      item => item.variant === 'dsxu_cold' && item.suite === 'terminal',
    )
    const benchmaxCode = manifest.commands.find(
      item => item.variant === 'benchmax' && item.suite === 'code',
    )

    expect(dsxuTerminal).toMatchObject({
      runnable: true,
      env: {
        DSXU_BENCH_BASELINE_PROFILE: null,
        DSXU_BENCH_MODE: 'cold',
      },
    })
    expect(dsxuTerminal?.command).toContain('--entry-model=auto')
    expect(dsxuTerminal?.command).toContain('--case=permission-deny-replan')

    expect(benchmaxCode).toMatchObject({
      runnable: false,
      env: {
        DSXU_BENCH_BASELINE_PROFILE: 'benchmax',
        DSXU_BENCH_MODE: 'benchmax',
      },
    })
    expect(benchmaxCode?.blockedReason).toContain(
      'candidate search/review',
    )
  })

  test('covers four variants times Code and Terminal without stage-close 22-case', () => {
    const manifest = buildV18EvalBaselineManifest({
      generatedAt: '2026-05-07T00:00:00.000Z',
    })

    expect(manifest.commands).toHaveLength(8)
    expect(manifest.commands.every(item => item.caseIds.length === 10)).toBe(true)
    expect(manifest.guards).toContain('Do not run broad 22-case from this manifest.')
  })

  test('harness writes a reusable manifest artifact', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v18-baseline-manifest-'))
    const evidencePath = join(dir, 'manifest.json')
    const manifest = await runV18EvalBaselineManifestHarness({
      evidencePath,
      generatedAt: '2026-05-07T00:00:00.000Z',
      outPrefix: '.dsxu\\runs\\v18-eval-baseline-test',
      caseTimeoutMs: 123456,
    })
    const onDisk = JSON.parse(await readFile(evidencePath, 'utf8'))

    expect(manifest.evidencePath).toBe(evidencePath)
    expect(onDisk.commands).toHaveLength(8)
    expect(onDisk.commands[0].command).toContain('--entry-model=flash')
  })
})
