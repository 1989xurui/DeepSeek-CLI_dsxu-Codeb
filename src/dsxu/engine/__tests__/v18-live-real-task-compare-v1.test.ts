import { describe, expect, test } from 'bun:test'
import {
  buildV18LiveRealTaskComparisonEvidence,
  extractSemanticVerificationEventsFromStream,
} from '../v18-live-real-task-compare'

function liveCase(input: {
  id: string
  status?: string
  model: string
  toolCalls: number
  readCalls: number
  powerShellCalls: number
  actualCommands: string[]
  costUSD: number
  cacheRead: number
  cacheMiss: number
  outputTokens: number
}) {
  return {
    id: input.id,
    category: 'feature',
    status: input.status ?? 'pass',
    metrics: {
      toolCalls: input.toolCalls,
      readCalls: input.readCalls,
      powerShellCalls: input.powerShellCalls,
      bashCalls: 0,
      actualCommands: input.actualCommands,
      modelsUsed: [input.model],
      totalCostUSD: input.costUSD,
      modelUsage: {
        [input.model]: {
          cacheReadInputTokens: input.cacheRead,
          cacheCreationInputTokens: input.cacheMiss,
          outputTokens: input.outputTokens,
          costUSD: input.costUSD,
        },
      },
    },
  }
}

describe('V18 live real task comparison evidence', () => {
  test('extracts verification runs and does not treat post-edit rerun as waste', () => {
    const stream = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'ps-1',
              name: 'PowerShell',
              input: { command: 'bun test' },
            },
          ],
        },
      }),
      JSON.stringify({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'ps-1',
              content: 'Exit code 1\n1 fail',
              is_error: true,
            },
          ],
        },
      }),
      JSON.stringify({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'edit-1',
              content: 'DSXU tool state: edit_applied',
            },
          ],
        },
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'ps-2',
              name: 'PowerShell',
              input: { command: 'bun test --timeout 180000' },
            },
          ],
        },
      }),
      JSON.stringify({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'ps-2',
              content: '1 pass\n0 fail\nDSXU tool state: verification_passed',
              is_error: false,
            },
          ],
        },
      }),
    ].join('\n')

    const events = extractSemanticVerificationEventsFromStream(stream)
    expect(events).toHaveLength(2)
    expect(events[0]?.sourceChangedBeforeRun).toBe(false)
    expect(events[1]?.sourceChangedBeforeRun).toBe(true)
  })

  test('compares focused before/after reports and keeps warnings separate from blockers', async () => {
    const evidence = await buildV18LiveRealTaskComparisonEvidence({
      generatedAt: '2026-05-07T13:10:00+08:00',
      evidencePath: '.dsxu/trace/v18-semantic-tool/test.json',
      beforeReportPath: 'before.json',
      afterReportPath: 'after.json',
      caseIds: ['case-a'],
      root: process.cwd(),
      beforeReport: {
        cases: [
          liveCase({
            id: 'case-a',
            model: 'deepseek-v4-pro',
            toolCalls: 7,
            readCalls: 3,
            powerShellCalls: 2,
            actualCommands: ['bun test', 'bun test'],
            costUSD: 0.04,
            cacheRead: 80,
            cacheMiss: 20,
            outputTokens: 10,
          }),
        ],
      },
      afterReport: {
        cases: [
          liveCase({
            id: 'case-a',
            model: 'deepseek-v4-flash',
            toolCalls: 4,
            readCalls: 2,
            powerShellCalls: 1,
            actualCommands: ['bun test'],
            costUSD: 0.01,
            cacheRead: 90,
            cacheMiss: 10,
            outputTokens: 8,
          }),
        ],
      },
    })

    expect(evidence.ok).toBe(true)
    expect(evidence.status).toBe('PARTIAL_EVIDENCED')
    expect(evidence.deltas.toolCalls).toBe(-3)
    expect(evidence.deltas.totalCostUSD).toBe(-0.03)
    expect(evidence.deltas.proCaseRatioPct).toBe(-100)
    expect(evidence.warnings.join('\n')).toContain('demoted from Pro to Flash')
  })
})
