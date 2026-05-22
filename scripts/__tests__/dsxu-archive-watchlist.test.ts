import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildArchiveWatchlist } from '../dsxu-archive-watchlist'

describe('V7 archive watchlist', () => {
  test('does not archive active docs and never deletes now', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-archive-watchlist-'))
    const registryPath = join(dir, 'registry.json')
    const signalPath = join(dir, 'signals.json')
    await writeFile(registryPath, JSON.stringify({
      rows: [
        { path: 'docs/current.md', status: 'active-master-plan', deleteSafety: 'no', transformPotential: 'high' },
        { path: 'docs/old.md', status: 'superseded-plan', deleteSafety: 'after-signal-extraction', transformPotential: 'high', claimRisk: false, releaseRisk: false },
        { path: 'docs/risk.md', status: 'historical-evidence', deleteSafety: 'after-signal-extraction', transformPotential: 'high', claimRisk: true, releaseRisk: false },
      ],
    }), 'utf8')
    await writeFile(signalPath, JSON.stringify({
      signals: [
        { sourceDoc: 'docs/old.md', archiveAfterExtraction: true },
        { sourceDoc: 'docs/risk.md', archiveAfterExtraction: true },
      ],
    }), 'utf8')

    const report = await buildArchiveWatchlist({
      registryPath,
      signalPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_ARCHIVE_WATCHLIST')
    expect(report.summary.activeRowsInWatchlist).toBe(0)
    expect(report.summary.deleteNow).toBe(0)
    expect(report.rows.some(row => row.path === 'docs/current.md')).toBe(false)
    expect(report.rows.find(row => row.path === 'docs/old.md')?.action).toBe('archive-review')
    expect(report.rows.find(row => row.path === 'docs/risk.md')?.action).toBe('keep-governance-evidence')
  })
})
