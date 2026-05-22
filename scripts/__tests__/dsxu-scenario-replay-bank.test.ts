import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildScenarioReplayBank } from '../dsxu-scenario-replay-bank'

describe('V7 scenario replay bank', () => {
  test('keeps replay layers separate and blocks public benchmark claims', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-scenario-replay-'))
    const signalPath = join(dir, 'signals.json')
    await writeFile(signalPath, JSON.stringify({
      signals: [
        {
          sourceDoc: 'docs/benchmark.md',
          signalCategory: 'benchmark-hit-rate',
          targetOwner: 'Evidence Owner',
          missingRuntime: false,
          missingTest: true,
          claimAllowed: false,
        },
        {
          sourceDoc: 'docs/provider.md',
          signalCategory: 'deepseek-routing-cost-cache',
          targetOwner: 'DeepSeek Runtime Owner',
          missingRuntime: false,
          missingTest: true,
          claimAllowed: false,
        },
        {
          sourceDoc: 'docs/tool.md',
          signalCategory: 'tool-protocol',
          targetOwner: 'Tool Owner',
          missingRuntime: false,
          missingTest: true,
          claimAllowed: false,
        },
      ],
    }), 'utf8')

    const report = await buildScenarioReplayBank({
      signalPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_SCENARIO_REPLAY_BANK')
    expect(report.summary.totalCases).toBe(3)
    expect(report.summary['external-benchmark']).toBe(1)
    expect(report.summary['live-provider']).toBe(1)
    expect(report.summary['fixture-mutation']).toBe(1)
    expect(report.summary.publicBenchmarkClaimAllowedRows).toBe(0)
    expect(report.cases.every(row => row.passFailDefined)).toBe(true)
  })
})
