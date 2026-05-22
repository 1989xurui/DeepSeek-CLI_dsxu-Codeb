import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { runV18AgentLiveReportReplayHarness } from '../../integration/harness/agent-live-report-replay-harness'
import type { DsxuLiveReportLike } from '../experience-live-report-ingest'

const report: DsxuLiveReportLike = {
  generatedAt: '2026-05-07T09:30:00.000Z',
  mode: 'live',
  baselineProfile: 'model_forced_bare',
  benchMode: 'cold',
  cases: [
    {
      id: 'v8-real-review-fix',
      category: 'review',
      status: 'pass',
      policyPassed: true,
      prompt:
        'Read src/html.js and test/html.test.js, then patch only src/html.js and run bun test.',
      fixturePath: 'tmp/live/v8-real-review-fix',
      metrics: {
        toolCalls: 5,
        readCalls: 2,
        powerShellCalls: 2,
        successfulEditCalls: 1,
        failedEditCalls: 0,
      },
    },
    {
      id: 'v8-real-feature-tests',
      category: 'feature',
      status: 'pass',
      policyPassed: true,
      prompt:
        'Read src/strings.js and test/strings.test.js, then add slugify in src/strings.js and run bun test.',
      fixturePath: 'tmp/live/v8-real-feature-tests',
      metrics: {
        toolCalls: 5,
        readCalls: 2,
        powerShellCalls: 2,
        successfulEditCalls: 1,
        failedEditCalls: 0,
      },
    },
    {
      id: 'product-review-fix-live',
      category: 'review',
      status: 'pass',
      policyPassed: true,
      prompt:
        'Review escaping code, patch only src/html.js, then run bun test with PowerShell.',
      fixturePath: 'tmp/live/product-review-fix-live',
      metrics: {
        toolCalls: 6,
        readCalls: 2,
        powerShellCalls: 2,
        successfulEditCalls: 1,
        failedEditCalls: 0,
      },
    },
  ],
}

describe('V18 agent live report replay V1', () => {
  test('keeps Agent to serial worker and parallel fanout while preserving lifecycle placements', async () => {
    const dir = mkdtempSync(join(process.cwd(), 'tmp-v18-agent-live-report-'))
    try {
      const evidencePath = join(dir, 'agent-live-report-replay.evidence.json')
      const result = await runV18AgentLiveReportReplayHarness({
        report,
        reportPath: 'tmp/live-report.json',
        evidencePath,
        serialCaseId: 'v8-real-review-fix',
        parallelCaseIds: ['v8-real-feature-tests', 'product-review-fix-live'],
      })

      expect(result.status, JSON.stringify(result, null, 2)).toBe('DONE_EVIDENCED')
      expect(result.serialPlan.visibleMode).toBe('serial_worker')
      expect(result.parallelPlan.visibleMode).toBe('parallel_fanout')
      expect(result.parallelPlan.maxWorkers).toBe(2)
      expect(result.summary.visibleModes).toEqual(['serial_worker', 'parallel_fanout'])
      expect(result.summary.runtimePlacements).toContain('background')
      expect(result.summary.runtimePlacements).toContain('send_message_continuation')
      expect(result.parallelPlan.evidence.runtimePlacementsAreNotPlanningModes).toBe(true)
      expect(result.parentFinalGateOk).toBe(true)
      expect(result.summary.parentFinalGateCaseCount).toBe(7)
      expect(result.warnings).toEqual([])
      expect(existsSync(evidencePath)).toBe(true)

      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
        status: string
        summary: { visibleModes: string[]; parallelWorkers: number }
      }
      expect(evidence.status).toBe('DONE_EVIDENCED')
      expect(evidence.summary.visibleModes).toEqual(['serial_worker', 'parallel_fanout'])
      expect(evidence.summary.parallelWorkers).toBe(2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
