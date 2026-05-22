import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  buildDsxuExperienceEntriesFromLiveReport,
  buildDsxuLiveReportSmoothResumeProjection,
  ingestDsxuLiveReportIntoExperienceStore,
  runV18ExperienceLiveReportIngestHarness,
  type DsxuLiveReportLike,
} from '../experience-live-report-ingest'
import {
  createDsxuExperienceStore,
  recallDsxuExperience,
} from '../experience-store'

const report: DsxuLiveReportLike = {
  generatedAt: '2026-05-07T09:00:00.000Z',
  mode: 'live',
  baselineProfile: 'model_forced_bare',
  benchMode: 'cold',
  cases: [
    {
      id: 'v8-real-review-fix',
      category: 'review',
      expectedMarker: 'DSXU_BENCH_V8_REAL_REVIEW_FIX_PASS',
      status: 'pass',
      policyPassed: true,
      prompt:
        'Review the escaping code, run the failing bun test with PowerShell, then read both src/html.js and test/html.test.js before editing.',
      logPath: '.dsxu/runs/live/v8-real-review-fix.stream.jsonl',
      routeTracePath: '.dsxu/runs/live/v8-real-review-fix.route.jsonl',
      fixturePath: 'tmp/fixture/v8-real-review-fix',
      routeExpectation: {
        expectedModel: 'deepseek-v4-flash',
        routeReason: 'review_flash_thinking_max',
      },
      metrics: {
        toolCalls: 5,
        readCalls: 2,
        powerShellCalls: 2,
        successfulEditCalls: 1,
        failedEditCalls: 0,
        totalCostUSD: 0.002,
        modelsUsed: ['deepseek-v4-flash'],
        actualCommands: [
          'Set-Location "D:\\tmp\\fixture\\v8-real-review-fix"; bun test',
        ],
        modelUsage: {
          'deepseek-v4-flash': {
            inputTokens: 86000,
            outputTokens: 1500,
            costUSD: 0.002,
          },
        },
      },
    },
    {
      id: 'product-workflow-recovery-live',
      category: 'workflow',
      expectedMarker: 'DSXU_BENCH_PRODUCT_WORKFLOW_RECOVERY_PASS',
      status: 'fail',
      policyPassed: false,
      logPath: '.dsxu/runs/live/product-workflow-recovery-live.stream.jsonl',
      routeTracePath: '.dsxu/runs/live/product-workflow-recovery-live.route.jsonl',
      fixturePath: 'tmp/fixture/product-workflow-recovery-live',
      failureAnalysis: {
        categories: ['tool_drift', 'policy_or_permission'],
        notes: ['execution visibility gate triggered before focused context'],
      },
      metrics: {
        toolCalls: 11,
        readCalls: 8,
        powerShellCalls: 2,
        successfulEditCalls: 1,
        failedEditCalls: 0,
        totalCostUSD: 0.003,
        modelsUsed: ['deepseek-v4-flash'],
        modelUsage: {
          'deepseek-v4-flash': {
            inputTokens: 90000,
            outputTokens: 1700,
            costUSD: 0.003,
          },
        },
      },
    },
  ],
}

describe('V18 ExperienceStore live report ingest V1', () => {
  test('converts real live report cases into safe ExperienceStore entries', () => {
    const entries = buildDsxuExperienceEntriesFromLiveReport({
      report,
      reportPath: '.dsxu/runs/live/live-report.json',
    })

    expect(entries.map(entry => entry.kind)).toEqual([
      'task_snapshot',
      'success_fix',
      'verification_command',
      'cost_route',
      'task_snapshot',
      'failure_pattern',
      'cost_route',
    ])
    expect(entries.every(entry => entry.sourcePath)).toBe(true)
    expect(entries.every(entry => entry.deletablePath.startsWith('.dsxu/memory/'))).toBe(true)
    expect(entries.some(entry => entry.relatedFiles?.includes('src/html.js'))).toBe(true)
    expect(entries.some(entry => entry.relatedFiles?.includes('test/html.test.js'))).toBe(true)
    expect(entries.map(entry => `${entry.title}\n${entry.content}`).join('\n')).not.toContain(
      'DSXU_BENCH_V8_REAL_REVIEW_FIX_PASS',
    )
    expect(
      entries.find(entry => entry.kind === 'verification_command')?.content,
    ).toContain('replacing any temporary fixture cwd')
  })

  test('records live report experience and makes recall actionable without benchmark answer leaks', () => {
    const store = createDsxuExperienceStore()
    const result = ingestDsxuLiveReportIntoExperienceStore({
      store,
      report,
      reportPath: '.dsxu/runs/live/live-report.json',
    })

    expect(result.rejected).toEqual([])
    expect(result.summary).toMatchObject({
      cases: 2,
      passedCases: 1,
      failedOrPolicyCases: 1,
      verificationCommandEntries: 1,
      costRouteEntries: 2,
    })
    expect(result.accepted).toHaveLength(7)

    const recalls = recallDsxuExperience({
      store,
      query: 'review html escaping failure with execution visibility gate',
      currentSourceFiles: ['tmp/fixture/v8-real-review-fix/src/html.js'],
      maxEntries: 5,
    })

    expect(recalls.some(recall => recall.entry.kind === 'success_fix')).toBe(true)
    expect(recalls.some(recall => recall.entry.kind === 'failure_pattern')).toBe(true)
    expect(recalls.map(recall => recall.entry.content).join('\n')).not.toContain('DSXU_BENCH')
  })

  test('writes reusable ingest evidence from a live report path', () => {
    const dir = mkdtempSync(join(process.cwd(), 'tmp-v18-experience-ingest-'))
    try {
      const reportPath = join(dir, 'live-report.json')
      const evidencePath = join(dir, 'evidence.json')
      writeFileSync(reportPath, JSON.stringify(report), 'utf8')

      const result = runV18ExperienceLiveReportIngestHarness({
        sourceReportPath: reportPath,
        evidencePath,
        query: 'recover html escaping workflow with source truth',
        currentSourceFiles: ['src/html.js', 'test/html.test.js'],
        smoothResumeCaseId: 'v8-real-review-fix',
      })

      expect(result.status).toBe('DONE_EVIDENCED')
      expect(result.benchmarkLeakDetected).toBe(false)
      expect(result.storeEntries).toBe(7)
      expect(result.recalls.length).toBeGreaterThan(0)
      expect(result.smoothResumeProjection?.sourceTruthRefreshRequired).toBe(true)
      expect(result.smoothResumeProjection?.mayClaimPass).toBe(false)
      expect(['stable', 'strong']).toContain(
        result.smoothResumeProjection?.replayReport.planningQuality.grade,
      )
      expect(existsSync(evidencePath)).toBe(true)

      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
        status: string
        benchmarkLeakDetected: boolean
        recallKinds: string[]
        smoothResumeProjection: {
          status: string
          sourceTruthRefreshRequired: boolean
          mayClaimPass: boolean
          planningGrade: string
        }
      }
      expect(evidence.status).toBe('DONE_EVIDENCED')
      expect(evidence.benchmarkLeakDetected).toBe(false)
      expect(evidence.recallKinds).toContain('success_fix')
      expect(evidence.smoothResumeProjection).toMatchObject({
        status: 'DONE_EVIDENCED',
        sourceTruthRefreshRequired: true,
        mayClaimPass: false,
      })
      expect(['stable', 'strong']).toContain(evidence.smoothResumeProjection.planningGrade)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('projects smooth resume from live report memory with current source truth guard', () => {
    const projection = buildDsxuLiveReportSmoothResumeProjection({
      report,
      reportPath: '.dsxu/runs/live/live-report.json',
      caseId: 'v8-real-review-fix',
      query: 'resume review escaping task with focused verification',
      currentSourceFiles: ['src/html.js', 'test/html.test.js'],
    })

    expect(projection.status).toBe('DONE_EVIDENCED')
    expect(projection.sourceTruthRefreshRequired).toBe(true)
    expect(projection.mayClaimPass).toBe(false)
    expect(projection.resumePlan.rendered).toContain('Read latest source truth for src/html.js before any Edit')
    expect(projection.replayReport.repeatedExplorationReduced).toBe(true)
    expect(['stable', 'strong']).toContain(projection.replayReport.planningQuality.grade)
    expect(projection.replayReport.toolCallReductionPct).toBeGreaterThanOrEqual(20)
    expect(projection.replayReport.tokenReductionPct).toBeGreaterThanOrEqual(30)
    expect(projection.recallIds.some(id => id.includes('success-fix'))).toBe(true)
  })
})
