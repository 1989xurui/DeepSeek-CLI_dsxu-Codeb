import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildRuntimeReachabilityMap } from '../dsxu-runtime-reachability-map'

describe('V7 runtime reachability map', () => {
  test('grades mainline-owner rows without creating public claims', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-reachability-'))
    const ownerDecisionPath = join(dir, 'owners.json')
    await writeFile(ownerDecisionPath, JSON.stringify({
      rows: [
        { path: 'src/a.ts', decision: 'mainline-owner', owner: 'A', activeImportCount: 0, importedByCount: 0, testReferenceCount: 0 },
        { path: 'src/b.ts', decision: 'mainline-owner', owner: 'B', activeImportCount: 1, importedByCount: 1, testReferenceCount: 0 },
        { path: 'src/c.ts', decision: 'mainline-owner', owner: 'C', activeImportCount: 1, importedByCount: 1, testReferenceCount: 1 },
        { path: 'src/skip.ts', decision: 'legacy', owner: 'Legacy', activeImportCount: 5, importedByCount: 5, testReferenceCount: 5 },
      ],
    }), 'utf8')

    const report = await buildRuntimeReachabilityMap({
      ownerDecisionPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_RUNTIME_REACHABILITY_MAP')
    expect(report.summary.mainlineOwnerRows).toBe(3)
    expect(report.summary.R0).toBe(1)
    expect(report.summary.R2).toBe(1)
    expect(report.summary.R3).toBe(1)
    expect(report.summary.publicClaimAllowedRows).toBe(0)
  })
})
