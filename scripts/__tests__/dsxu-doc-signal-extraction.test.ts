import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildDocSignalExtraction } from '../dsxu-doc-signal-extraction'

describe('V7 doc signal extraction', () => {
  test('extracts structured signals without allowing historical raw prompt context', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-doc-signals-'))
    const registryPath = join(dir, 'registry.json')
    await writeFile(registryPath, JSON.stringify({
      rows: [
        {
          path: 'docs/DSXU_V6_DEEPSEEK_NATIVE_ENGINEERING_RUNTIME_20260519_CN.md',
          status: 'active-master-plan',
          deleteSafety: 'no',
          transformPotential: 'high',
          lines: 100,
          remainingSignals: ['prompt-behavior-discipline', 'deepseek-routing-cost-cache'],
        },
        {
          path: 'docs/DSXU_V26_MASTER_PLAN_20260515.md',
          status: 'historical-evidence',
          deleteSafety: 'after-signal-extraction',
          transformPotential: 'high',
          lines: 200,
          remainingSignals: ['prompt-behavior-discipline', 'scenario-test-corpus'],
        },
      ],
    }), 'utf8')

    const report = await buildDocSignalExtraction({
      registryPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_DOC_SIGNAL_EXTRACTION')
    expect(report.summary.docCount).toBe(2)
    expect(report.summary.signalCount).toBe(4)
    expect(report.summary.p0DocsWithSignals).toBe(report.summary.p0DocCount)
    expect(report.signals.some(signal => signal.sourceDoc.includes('V26') && signal.promptAllowed)).toBe(false)
    expect(report.summary.claimAllowedSignals).toBe(0)
  })
})
