import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildRemainingEvidenceQueue } from '../dsxu-v7-remaining-evidence-queue'

describe('V7 remaining evidence queue', () => {
  test('separates focused evidence coverage from remaining owner-test work', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-remaining-'))
    const reachabilityPath = join(dir, 'reachability.json')
    const focusedEvidencePath = join(dir, 'focused.json')
    const command = 'bun test src/tool.test.ts'
    await writeFile(reachabilityPath, JSON.stringify({
      rows: [
        { path: 'src/tool.ts', owner: 'Tool Gate / Tool View', capability: 'tool', reachability: 'R2', verificationCommand: command },
        { path: 'src/query.ts', owner: 'Query Loop / Execution Contract', capability: 'query', reachability: 'R2', verificationCommand: 'needs focused owner test before claim' },
      ],
    }), 'utf8')
    await writeFile(focusedEvidencePath, JSON.stringify({
      commands: [{ command, status: 'PASS' }],
    }), 'utf8')

    const report = await buildRemainingEvidenceQueue({
      reachabilityPath,
      focusedEvidencePath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_V7_REMAINING_EVIDENCE_QUEUE')
    expect(report.summary.totalRows).toBe(2)
    expect(report.summary.coveredByFocusedEvidence).toBe(1)
    expect(report.summary.needsFocusedOwnerTest).toBe(1)
    expect(report.summary.p0PendingRows).toBe(1)
    expect(report.summary.publicClaimAllowedRows).toBe(0)
  })
})
