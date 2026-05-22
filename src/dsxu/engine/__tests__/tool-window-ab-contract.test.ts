import { describe, expect, test } from 'bun:test'
import {
  buildDSXUV8ToolWindowABReport,
  createDSXUV8MockToolWindowABSamples,
} from '../tool-window-ab-v8'

describe('V8 tool-window AB contract', () => {
  test('keeps mock AB output internal and blocks public benchmark claims', () => {
    const samples = createDSXUV8MockToolWindowABSamples({
      profiles: ['single_file_edit', 'debug', 'long_task'],
      windows: [8, 12, 16, 20, 24, 27],
      suite: 'mock-v8-smoke',
    })
    const report = buildDSXUV8ToolWindowABReport({
      suite: 'mock-v8-smoke',
      resultLevel: 'mock',
      samples,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.schemaVersion).toBe('dsxu.tool-window-ab.v8')
    expect(report.owner).toBe('Evidence / Tool Gate')
    expect(report.publicClaimAllowed).toBe(false)
    expect(report.blockedClaims.join('\n')).toContain('internal evidence only')
    expect(report.results.length).toBe(18)
    expect(report.selection.map(item => item.profile)).toEqual(
      expect.arrayContaining(['single_file_edit', 'debug', 'long_task']),
    )
  })

  test('selects windows only when false-pass and starvation gates are clean', () => {
    const report = buildDSXUV8ToolWindowABReport({
      suite: 'internal-replay',
      resultLevel: 'internal_replay',
      generatedAt: '2026-05-19T00:00:00.000Z',
      samples: [
        {
          profile: 'single_file_edit',
          window: 4,
          taskId: 'starved',
          expectedToolCount: 12,
          pass: false,
          verified: false,
          costUsd: 0.001,
          latencyMs: 100,
          contextGrowthTokens: 100,
        },
        {
          profile: 'single_file_edit',
          window: 12,
          taskId: 'good',
          expectedToolCount: 12,
          pass: true,
          verified: true,
          costUsd: 0.003,
          latencyMs: 200,
          contextGrowthTokens: 200,
        },
      ],
    })

    expect(report.publicClaimAllowed).toBe(false)
    expect(report.selection).toEqual([
      expect.objectContaining({
        profile: 'single_file_edit',
        selectedWindow: 12,
      }),
    ])
    expect(report.results.find(result => result.window === 4)?.toolStarvationRate).toBe(1)
  })
})
