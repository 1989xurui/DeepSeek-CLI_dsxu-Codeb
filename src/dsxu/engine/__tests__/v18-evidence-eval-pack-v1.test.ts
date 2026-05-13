import { mkdtemp, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, test } from 'bun:test'
import {
  buildV18EvidenceEvalPack,
  runV18EvidenceEvalPackHarness,
  type V18AblationStep,
  type V18EvalScore,
} from '../v18-evidence-eval-pack'

function score(input: Partial<V18EvalScore> & Pick<V18EvalScore, 'variant' | 'suite'>): V18EvalScore {
  return {
    totalCases: 10,
    pass: 10,
    fail: 0,
    policyFail: 0,
    timedOut: 0,
    costUSD: 0.1,
    proRatio: input.variant === 'pro_bare' ? 1 : 0.25,
    toolCalls: 50,
    source: 'measured',
    ...input,
  }
}

function measuredAblationSteps(): V18AblationStep[] {
  return [
    {
      id: 'A0',
      label: 'Flash bare',
      enabledModules: ['model.flash'],
      totalCases: 10,
      passRate: 0.6,
      costUSD: 0.05,
      source: 'measured',
    },
    {
      id: 'A1',
      label: 'Pro bare',
      enabledModules: ['model.pro'],
      totalCases: 10,
      passRate: 0.7,
      costUSD: 0.35,
      source: 'measured',
    },
    {
      id: 'A2',
      label: 'DSXU Cold routing',
      enabledModules: ['query_loop', 'tools', 'cost_router'],
      totalCases: 10,
      passRate: 0.8,
      costUSD: 0.09,
      source: 'measured',
    },
    {
      id: 'A3',
      label: 'DSXU Cold + evidence gates',
      enabledModules: ['verification', 'trace'],
      totalCases: 10,
      passRate: 0.9,
      costUSD: 0.1,
      source: 'measured',
    },
    {
      id: 'A4',
      label: 'DSXU Cold + memory/context',
      enabledModules: ['experience_store'],
      totalCases: 10,
      passRate: 1,
      costUSD: 0.11,
      source: 'measured',
    },
  ]
}

function liveReport(input: {
  totalCostUSD: number
  proCostUSD?: number
  modelsUsed: string[]
  totalToolCalls?: number
  entryModelMode?: string
  entryModel?: string
  semanticToolsEnabled?: boolean
  baselineProfile?: string
  benchMode?: string
  benchmaxCandidateCount?: number
}) {
  return {
    mode: 'live',
    entryModelMode: input.entryModelMode,
    entryModel: input.entryModel,
    semanticToolsEnabled: input.semanticToolsEnabled,
    baselineProfile: input.baselineProfile,
    benchMode: input.benchMode,
    benchmaxCandidateCount: input.benchmaxCandidateCount,
    total: 10,
    summary: {
      pass: 10,
      fail: 0,
      policyFail: 0,
      timedOut: 0,
      totalToolCalls: input.totalToolCalls ?? 40,
      totalCostUSD: input.totalCostUSD,
      modelsUsed: input.modelsUsed,
    },
    cases: [
      {
        metrics: {
          totalCostUSD: input.totalCostUSD,
          modelUsage: input.proCostUSD
            ? { 'deepseek-v4-pro': { costUSD: input.proCostUSD } }
            : {},
        },
      },
    ],
  }
}

describe('V18 Evidence Eval Pack V1', () => {
  test('blocks public claims when Flash/Pro/BenchMax and Code-10/Terminal-10 baselines are missing', () => {
    const report = buildV18EvidenceEvalPack({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-eval/evidence.json',
      markdownPath: 'docs/eval.md',
      miniReportPath: 'docs/mini.md',
      realTaskPackPath: '.dsxu/trace/real-task.json',
      realTaskPack: {
        aggregate: {
          totalCases: 4,
          pass: 4,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 24,
          totalCostUSD: 0.121638,
          modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        },
      },
    })

    expect(report.ok).toBe(false)
    expect(report.status).toBe('PARTIAL_EVAL_PACK')
    expect(report.goStop.code10).toBe('STOP')
    expect(report.goStop.terminal10).toBe('STOP')
    expect(report.goStop.publicReport).toBe('STOP')
    expect(report.blockers).toContain(
      'missing baseline variants: Flash bare, Pro bare, BenchMax',
    )
    expect(report.blockers).toContain('Code-10 DSXU Cold baseline is missing')
    expect(report.blockers).toContain('Terminal-10 DSXU Cold baseline is missing')
    expect(report.guards).toContain(
      'current DSXU Cold evidence is mixed-suite; split Code and Terminal before score claims',
    )
  })

  test('allows DONE-EVIDENCED only when all baseline variants and Code/Terminal 10 are present', () => {
    const report = buildV18EvidenceEvalPack({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-eval/evidence.json',
      markdownPath: 'docs/eval.md',
      miniReportPath: 'docs/mini.md',
      baselineScores: [
        score({ variant: 'flash_bare', suite: 'code', costUSD: 0.05 }),
        score({ variant: 'pro_bare', suite: 'code', costUSD: 0.35, proRatio: 1 }),
        score({ variant: 'benchmax', suite: 'code', costUSD: 0.48, proRatio: 0.7 }),
        score({ variant: 'dsxu_cold', suite: 'code', costUSD: 0.09, proRatio: 0.2 }),
        score({ variant: 'dsxu_cold', suite: 'terminal', costUSD: 0.07, proRatio: 0.1 }),
      ],
      ablationSteps: [
        ...measuredAblationSteps(),
      ],
    })

    expect(report.ok).toBe(true)
    expect(report.status).toBe('DONE_EVIDENCED')
    expect(report.blockers).toEqual([])
    expect(report.goStop).toMatchObject({
      code10: 'GO',
      terminal10: 'GO',
      publicReport: 'GO',
    })
  })

  test('harness writes evidence, full report, and local-only mini report', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v18-eval-'))
    const realTaskPackPath = join(dir, 'real-task.json')
    await Bun.write(
      realTaskPackPath,
      JSON.stringify({
        aggregate: {
          totalCases: 4,
          pass: 4,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 24,
          totalCostUSD: 0.121638,
          modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        },
      }),
    )

    const report = await runV18EvidenceEvalPackHarness({
      evidenceDir: join(dir, 'trace'),
      markdownPath: join(dir, 'eval.md'),
      miniReportPath: join(dir, 'mini.md'),
      realTaskPackPath,
      code10ReportPath: join(dir, 'missing-code10.json'),
      terminal10ReportPath: join(dir, 'missing-terminal10.json'),
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    const evidence = JSON.parse(await readFile(report.evidencePath, 'utf8'))
    const miniReport = await readFile(report.miniReportPath, 'utf8')
    expect(evidence.status).toBe('PARTIAL_EVAL_PACK')
    expect(miniReport).toContain('local-only')
    expect(miniReport).toContain('must not be used as a public benchmark claim')
  })

  test('harness derives DSXU Cold Code-10 and Terminal-10 baselines from live reports', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v18-eval-live-'))
    const code10ReportPath = join(dir, 'code10-live.json')
    const terminal10ReportPath = join(dir, 'terminal10-live.json')
    await Bun.write(
      code10ReportPath,
      JSON.stringify({
        total: 10,
        summary: {
          pass: 10,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 65,
          totalCostUSD: 0.388456,
          modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        },
        cases: [
          {
            metrics: {
              totalCostUSD: 0.3,
              modelUsage: { 'deepseek-v4-pro': { costUSD: 0.2 } },
            },
          },
        ],
      }),
    )
    await Bun.write(
      terminal10ReportPath,
      JSON.stringify({
        total: 10,
        summary: {
          pass: 10,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 23,
          totalCostUSD: 0.041234,
          modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        },
        cases: [
          {
            metrics: {
              totalCostUSD: 0.04,
              modelUsage: { 'deepseek-v4-pro': { costUSD: 0.02 } },
            },
          },
        ],
      }),
    )

    const report = await runV18EvidenceEvalPackHarness({
      evidenceDir: join(dir, 'trace'),
      markdownPath: join(dir, 'eval.md'),
      miniReportPath: join(dir, 'mini.md'),
      realTaskPackPath: join(dir, 'missing-real-task.json'),
      code10ReportPath,
      terminal10ReportPath,
      flashBareCodeReportPath: join(dir, 'missing-flash-bare.json'),
      proBareCodeReportPath: join(dir, 'missing-pro-bare.json'),
      benchmaxCodeReportPath: join(dir, 'missing-benchmax.json'),
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(report.goStop.code10).toBe('GO')
    expect(report.goStop.terminal10).toBe('GO')
    expect(report.goStop.publicReport).toBe('STOP')
    expect(report.blockers).not.toContain('Code-10 DSXU Cold baseline is missing')
    expect(report.blockers).not.toContain('Terminal-10 DSXU Cold baseline is missing')
    expect(report.blockers).toContain(
      'missing baseline variants: Flash bare, Pro bare, BenchMax',
    )
    expect(report.baselineScores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variant: 'dsxu_cold',
          suite: 'code',
          totalCases: 10,
          pass: 10,
          source: 'measured',
        }),
        expect.objectContaining({
          variant: 'dsxu_cold',
          suite: 'terminal',
          totalCases: 10,
          pass: 10,
          source: 'measured',
        }),
      ]),
    )
  })

  test('harness derives Flash bare, Pro bare, and BenchMax baselines from live report paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v18-eval-baselines-'))
    const flashBareCodeReportPath = join(dir, 'flash-bare-code.json')
    const proBareCodeReportPath = join(dir, 'pro-bare-code.json')
    const benchmaxCodeReportPath = join(dir, 'benchmax-code.json')
    const code10ReportPath = join(dir, 'code10-live.json')
    const terminal10ReportPath = join(dir, 'terminal10-live.json')

    await Bun.write(
      flashBareCodeReportPath,
      JSON.stringify(
        liveReport({
          totalCostUSD: 0.02,
          modelsUsed: ['deepseek-v4-flash'],
          totalToolCalls: 31,
          entryModelMode: 'flash',
          entryModel: 'deepseek-v4-flash',
          semanticToolsEnabled: false,
          baselineProfile: 'model_forced_bare',
        }),
      ),
    )
    await Bun.write(
      proBareCodeReportPath,
      JSON.stringify(
        liveReport({
          totalCostUSD: 0.32,
          proCostUSD: 0.32,
          modelsUsed: ['deepseek-v4-pro'],
          totalToolCalls: 29,
          entryModelMode: 'pro',
          entryModel: 'deepseek-v4-pro',
          semanticToolsEnabled: false,
          baselineProfile: 'model_forced_bare',
        }),
      ),
    )
    await Bun.write(
      benchmaxCodeReportPath,
      JSON.stringify(
        liveReport({
          totalCostUSD: 0.21,
          proCostUSD: 0.14,
          modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
          totalToolCalls: 44,
          entryModelMode: 'auto',
          entryModel: 'deepseek-v4-flash',
          baselineProfile: 'benchmax',
          benchMode: 'benchmax',
          benchmaxCandidateCount: 2,
        }),
      ),
    )
    await Bun.write(
      code10ReportPath,
      JSON.stringify(
        liveReport({
          totalCostUSD: 0.09,
          proCostUSD: 0.02,
          modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
          totalToolCalls: 48,
        }),
      ),
    )
    await Bun.write(
      terminal10ReportPath,
      JSON.stringify(
        liveReport({
          totalCostUSD: 0.04,
          modelsUsed: ['deepseek-v4-flash'],
          totalToolCalls: 19,
        }),
      ),
    )

    const report = await runV18EvidenceEvalPackHarness({
      evidenceDir: join(dir, 'trace'),
      markdownPath: join(dir, 'eval.md'),
      miniReportPath: join(dir, 'mini.md'),
      realTaskPackPath: join(dir, 'missing-real-task.json'),
      flashBareCodeReportPath,
      proBareCodeReportPath,
      benchmaxCodeReportPath,
      code10ReportPath,
      terminal10ReportPath,
      ablationSteps: measuredAblationSteps(),
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(report.ok).toBe(true)
    expect(report.goStop.publicReport).toBe('GO')
    expect(report.baselineScores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variant: 'flash_bare',
          suite: 'code',
          totalCases: 10,
          proRatio: 0,
          source: 'measured',
        }),
        expect.objectContaining({
          variant: 'pro_bare',
          suite: 'code',
          totalCases: 10,
          proRatio: 1,
          source: 'measured',
        }),
        expect.objectContaining({
          variant: 'benchmax',
          suite: 'code',
          totalCases: 10,
          proRatio: 0.6667,
          source: 'measured',
        }),
      ]),
    )
  })

  test('rejects mislabeled bare baselines that do not declare the baseline protocol', () => {
    const report = buildV18EvidenceEvalPack({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-eval/evidence.json',
      markdownPath: 'docs/eval.md',
      miniReportPath: 'docs/mini.md',
      flashBareCodeReportPath: '.dsxu/runs/not-bare/live-report.json',
      flashBareCodeReport: liveReport({
        totalCostUSD: 0.02,
        modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        entryModelMode: 'auto',
        entryModel: 'deepseek-v4-flash',
        semanticToolsEnabled: true,
      }),
      baselineScores: [
        score({ variant: 'pro_bare', suite: 'code', proRatio: 1 }),
        score({ variant: 'benchmax', suite: 'code' }),
        score({ variant: 'dsxu_cold', suite: 'code' }),
        score({ variant: 'dsxu_cold', suite: 'terminal' }),
      ],
      ablationSteps: measuredAblationSteps(),
    })

    expect(report.ok).toBe(false)
    expect(report.goStop.publicReport).toBe('STOP')
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        'Flash bare report must set DSXU_BENCH_BASELINE_PROFILE=model_forced_bare',
        'Flash bare report must have semantic tools disabled',
        'Flash bare report must use --entry-model=flash (deepseek-v4-flash)',
        'Flash bare report used unexpected model deepseek-v4-pro',
      ]),
    )
    expect(report.baselineScores).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variant: 'flash_bare',
          suite: 'code',
          source: 'measured',
        }),
      ]),
    )
  })

  test('guards keep public report stopped even when blockers are closed', () => {
    const report = buildV18EvidenceEvalPack({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-eval/evidence.json',
      markdownPath: 'docs/eval.md',
      miniReportPath: 'docs/mini.md',
      baselineScores: [
        score({ variant: 'flash_bare', suite: 'code' }),
        score({ variant: 'pro_bare', suite: 'code', proRatio: 1 }),
        score({ variant: 'benchmax', suite: 'code' }),
        score({ variant: 'dsxu_cold', suite: 'code' }),
        score({ variant: 'dsxu_cold', suite: 'terminal' }),
        score({
          variant: 'dsxu_cold',
          suite: 'mixed',
          totalCases: 4,
          pass: 4,
          source: 'derived',
        }),
      ],
      ablationSteps: measuredAblationSteps(),
    })

    expect(report.blockers).toEqual([])
    expect(report.guards).toContain(
      'existing measured evidence is below 10 cases; keep it local-only',
    )
    expect(report.ok).toBe(false)
    expect(report.status).toBe('PARTIAL_EVAL_PACK')
    expect(report.goStop.publicReport).toBe('STOP')
  })
})
