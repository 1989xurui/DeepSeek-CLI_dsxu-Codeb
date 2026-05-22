import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildClaimBoundaryGate } from '../dsxu-claim-boundary-gate'

describe('V7 claim boundary gate', () => {
  test('allows live-provider proof wording but keeps 90 percent benchmark claim blocked', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-claim-boundary-'))
    const reachabilityPath = join(dir, 'reachability.json')
    const replayBankPath = join(dir, 'replay.json')
    await writeFile(reachabilityPath, JSON.stringify({
      rows: [
        { path: 'src/query.ts', owner: 'Query Owner', reachability: 'R4', publicClaimAllowed: false },
        { path: 'src/tools/FileEditTool/FileEditTool.ts', owner: 'Tool Owner', reachability: 'R3', publicClaimAllowed: false },
      ],
    }), 'utf8')
    await writeFile(replayBankPath, JSON.stringify({
      cases: [
        { id: 'live-1', replayLevel: 'live-provider', publicBenchmarkClaimAllowed: false },
        { id: 'external-1', replayLevel: 'external-benchmark', publicBenchmarkClaimAllowed: false },
      ],
    }), 'utf8')

    const report = await buildClaimBoundaryGate({
      reachabilityPath,
      replayBankPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_CLAIM_BOUNDARY_GATE')
    expect(report.summary.public90Allowed).toBe(false)
    expect(report.summary.externalBenchmarkReady).toBe(false)
    expect(report.summary.c3BelowPublicAllowed).toBe(0)
    expect(report.candidates.find(row => row.id === 'V7-CLAIM-C4-LIVE-DEEPSEEK')?.publicAllowed).toBe(true)
    expect(report.candidates.find(row => row.id === 'V7-CLAIM-C5-EXTERNAL-BENCHMARK')?.publicAllowed).toBe(false)
  })
})
