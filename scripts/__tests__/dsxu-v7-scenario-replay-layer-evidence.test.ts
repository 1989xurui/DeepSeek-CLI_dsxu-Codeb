import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildScenarioReplayLayerEvidence } from '../dsxu-v7-scenario-replay-layer-evidence'

describe('V7 scenario replay layer evidence', () => {
  test('executes mock contracts locally and blocks external benchmark claims without paired raw evidence', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-replay-layer-'))
    const sourceDoc = join(dir, 'source.md')
    const replayBankPath = join(dir, 'replay-bank.json')
    await writeFile(sourceDoc, '# source\n', 'utf8')
    await writeFile(replayBankPath, JSON.stringify({
      summary: { totalCases: 2 },
      cases: [
        {
          id: 'V7-RP-0001',
          sourceDoc,
          owner: 'Scenario Replay Bank',
          replayLevel: 'mock',
          passFailDefined: true,
          publicBenchmarkClaimAllowed: false,
          requiredEvidence: ['deterministic fixture input', 'expected structured output'],
          passCriteria: 'mock only',
        },
        {
          id: 'V7-RP-0002',
          sourceDoc,
          owner: 'Evidence / Benchmark Owner',
          replayLevel: 'external-benchmark',
          passFailDefined: true,
          publicBenchmarkClaimAllowed: false,
          requiredEvidence: ['fixed manifest', 'paired target raw transcript', 'tool trace', 'cost/cache metrics'],
          passCriteria: 'external only',
        },
      ],
    }), 'utf8')

    const report = await buildScenarioReplayLayerEvidence({
      replayBankPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE')
    expect(report.summary.rows).toBe(2)
    expect(report.summary.mockContractPassRows).toBe(1)
    expect(report.summary.externalBenchmarkBlockedRows).toBe(1)
    expect(report.summary.publicBenchmarkClaimAllowedRows).toBe(0)
    expect(report.summary.publicClaimReadyRows).toBe(0)
  })

  test('blocks invalid replay cases instead of treating them as ready', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-replay-layer-blocked-'))
    const replayBankPath = join(dir, 'replay-bank.json')
    await writeFile(replayBankPath, JSON.stringify({
      summary: { totalCases: 1 },
      cases: [
        {
          id: 'V7-RP-0001',
          sourceDoc: join(dir, 'missing.md'),
          owner: 'Scenario Replay Bank',
          replayLevel: 'mock',
          passFailDefined: false,
          publicBenchmarkClaimAllowed: true,
          requiredEvidence: [],
          passCriteria: '',
        },
      ],
    }), 'utf8')

    const report = await buildScenarioReplayLayerEvidence({
      replayBankPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('BLOCKED_DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE')
    expect(report.summary.missingSourceDocRows).toBe(1)
    expect(report.blockers).toEqual(expect.arrayContaining([
      'one or more replay cases are invalid',
    ]))
  })
})
