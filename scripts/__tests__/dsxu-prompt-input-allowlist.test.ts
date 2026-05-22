import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildPromptInputAllowlist } from '../dsxu-prompt-input-allowlist'

describe('V7 prompt input allowlist', () => {
  test('blocks delete-review and historical raw inputs from the default prompt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-prompt-allowlist-'))
    const signalPath = join(dir, 'signals.json')
    const ownerDecisionPath = join(dir, 'owners.json')
    await writeFile(signalPath, JSON.stringify({
      signals: [
        {
          sourceDoc: 'docs/active.md',
          signalCategory: 'prompt-discipline',
          summary: 'active prompt rule',
          targetOwner: 'Prompt Section Router',
          promptAllowed: true,
          claimAllowed: false,
        },
        {
          sourceDoc: 'docs/old.md',
          signalCategory: 'scenario-replay',
          summary: 'historical scenario raw signal',
          targetOwner: 'Scenario Replay Bank',
          promptAllowed: false,
          claimAllowed: false,
        },
      ],
    }), 'utf8')
    await writeFile(ownerDecisionPath, JSON.stringify({
      rows: [
        { path: 'src/old.ts', owner: 'Old', decision: 'delete-review' },
        { path: 'src/evidence.ts', owner: 'Evidence', decision: 'evidence-only' },
      ],
    }), 'utf8')

    const report = await buildPromptInputAllowlist({
      signalPath,
      ownerDecisionPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_PROMPT_INPUT_ALLOWLIST')
    expect(report.summary.deleteReviewPromptItems).toBe(0)
    expect(report.summary.generatedHistoricalRawDocs).toBe(0)
    expect(report.summary.supersededPlanRawDocs).toBe(0)
    expect(report.allowlist.some(item => item.source === 'src/old.ts')).toBe(false)
    expect(report.blocked.some(item => item.source === 'src/old.ts')).toBe(true)
  })
})
