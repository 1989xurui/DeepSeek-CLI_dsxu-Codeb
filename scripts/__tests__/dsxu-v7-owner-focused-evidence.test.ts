import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildOwnerFocusedEvidence } from '../dsxu-v7-owner-focused-evidence'

describe('V7 owner focused evidence', () => {
  test('aggregates focused owner commands without creating public claims', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-owner-focused-'))
    const reachabilityPath = join(dir, 'reachability.json')
    const command = 'bun test src/example.test.ts'
    await writeFile(reachabilityPath, JSON.stringify({
      rows: [
        { path: 'src/a.ts', owner: 'Owner A', verificationCommand: command },
        { path: 'src/b.ts', owner: 'Owner A', verificationCommand: command },
        { path: 'src/c.ts', owner: 'Owner B', verificationCommand: 'needs focused owner test before claim' },
      ],
    }), 'utf8')

    const report = await buildOwnerFocusedEvidence({
      reachabilityPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
      commandResults: {
        [command]: {
          status: 'PASS',
          exitCode: 0,
          durationMs: 12,
          keyOutput: ['2 pass', '0 fail'],
        },
      },
    })

    expect(report.status).toBe('PASS_DSXU_V7_OWNER_FOCUSED_EVIDENCE')
    expect(report.summary.commands).toBe(1)
    expect(report.summary.coveredRows).toBe(2)
    expect(report.summary.coveredOwners).toBe(1)
    expect(report.commands[0]?.keyOutput).toContain('2 pass')
  })
})
