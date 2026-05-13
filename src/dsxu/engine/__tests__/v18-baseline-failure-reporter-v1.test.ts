import { mkdtemp, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, test } from 'bun:test'
import {
  buildV18BaselineFailureReporter,
  runV18BaselineFailureReporterHarness,
} from '../v18-baseline-failure-reporter'

function reportFixture() {
  return {
    baselineProfile: 'model_forced_bare',
    entryModelMode: 'flash',
    total: 3,
    summary: {
      pass: 1,
      fail: 2,
      policyFail: 2,
      timedOut: 0,
      totalToolCalls: 25,
      totalCostUSD: 0.01,
      modelsUsed: ['deepseek-v4-flash'],
    },
    cases: [
      {
        id: 'clean-pass',
        category: 'feature',
        status: 'pass',
        policyPassed: true,
        metrics: {
          toolCalls: 4,
          modelsUsed: ['deepseek-v4-flash'],
          totalCostUSD: 0.001,
        },
      },
      {
        id: 'policy-drift',
        category: 'workflow',
        status: 'fail',
        policyPassed: false,
        routeExpectation: {
          expectedModel: 'deepseek-v4-flash',
          routeReason: 'recovery_flash_thinking_max',
        },
        fixtureVerification: { status: 0 },
        logPath: '.dsxu/runs/x/policy.stream.jsonl',
        routeTracePath: '.dsxu/runs/x/policy.route.jsonl',
        metrics: {
          toolCalls: 13,
          editCalls: 1,
          readCalls: 7,
          powerShellCalls: 4,
          bashCalls: 0,
          totalCostUSD: 0.005,
          modelsUsed: ['deepseek-v4-flash'],
          baselinePolicyViolations: [
            'noncanonical_powershell_verification',
            'execution_visibility_gate',
          ],
          executionVisibilityGateCount: 1,
          nonCanonicalPowerShellNativeVerificationCalls: 1,
        },
        failureAnalysis: {
          categories: ['policy_or_permission', 'tool_drift'],
        },
      },
      {
        id: 'unresolved-timeout',
        category: 'bugfix',
        status: 'fail',
        timedOut: true,
        policyPassed: false,
        metrics: {
          toolCalls: 30,
          editCalls: 0,
          readCalls: 20,
          powerShellCalls: 0,
          bashCalls: 0,
          totalCostUSD: 0.004,
          modelsUsed: ['deepseek-v4-flash'],
        },
        failureAnalysis: {
          categories: ['tool_drift'],
        },
      },
    ],
  }
}

describe('V18 baseline failure reporter', () => {
  test('classifies policy drift as a gate/protocol fix before Pro spend', () => {
    const evidence = buildV18BaselineFailureReporter({
      generatedAt: '2026-05-07T00:00:00.000Z',
      sourceReportPath: '.dsxu/runs/baseline/live-report.json',
      evidencePath: '.dsxu/trace/baseline-failure.json',
      markdownPath: 'docs/baseline-failure.md',
      report: reportFixture(),
    })

    expect(evidence.ok).toBe(false)
    expect(evidence.status).toBe('PARTIAL_BASELINE_FAILURES')
    expect(evidence.summary).toMatchObject({
      totalCases: 3,
      pass: 1,
      fail: 2,
      policyFail: 2,
      policyFailRatePct: 66.7,
    })
    expect(evidence.failureCounts).toMatchObject({
      noncanonical_powershell_verification: 1,
      execution_visibility_gate: 1,
      timeout: 1,
      tool_drift: 2,
    })
    expect(evidence.cases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-drift',
          fixturePassed: true,
          action: 'fix_protocol_or_gate_before_pro',
          rootCauses: expect.arrayContaining([
            'noncanonical_powershell_verification',
            'execution_visibility_gate',
          ]),
        }),
        expect.objectContaining({
          id: 'unresolved-timeout',
          action: 'candidate_for_pro_recovery_probe',
          rootCauses: expect.arrayContaining(['timeout', 'tool_drift']),
        }),
      ]),
    )
    expect(evidence.next).toContain(
      'Close baseline policy/tool drift before Pro bare: execution visibility, Bash native verification, noncanonical PowerShell, and missing pre-edit baseline.',
    )
  })

  test('reports DONE only for a clean 10-case baseline', () => {
    const evidence = buildV18BaselineFailureReporter({
      generatedAt: '2026-05-07T00:00:00.000Z',
      sourceReportPath: '.dsxu/runs/baseline/live-report.json',
      evidencePath: '.dsxu/trace/baseline-failure.json',
      markdownPath: 'docs/baseline-failure.md',
      report: {
        total: 10,
        summary: {
          pass: 10,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 40,
          totalCostUSD: 0.02,
        },
        cases: Array.from({ length: 10 }, (_, index) => ({
          id: `case-${index}`,
          status: 'pass',
          policyPassed: true,
          metrics: { toolCalls: 4, totalCostUSD: 0.002 },
        })),
      },
    })

    expect(evidence.ok).toBe(true)
    expect(evidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.cases).toEqual([])
    expect(evidence.next).toContain(
      'Flash bare Code-10 is clean; Pro bare can be scheduled from the manifest.',
    )
  })

  test('guards model-forced Flash bare reports that used Pro', () => {
    const evidence = buildV18BaselineFailureReporter({
      generatedAt: '2026-05-07T00:00:00.000Z',
      sourceReportPath: '.dsxu/runs/baseline/live-report.json',
      evidencePath: '.dsxu/trace/baseline-failure.json',
      markdownPath: 'docs/baseline-failure.md',
      report: {
        baselineProfile: 'model_forced_bare',
        entryModelMode: 'flash',
        total: 10,
        summary: {
          pass: 10,
          fail: 0,
          policyFail: 0,
          timedOut: 0,
          totalToolCalls: 40,
          totalCostUSD: 0.2,
          modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        },
        cases: Array.from({ length: 10 }, (_, index) => ({
          id: `case-${index}`,
          status: 'pass',
          policyPassed: true,
          metrics: {
            toolCalls: 4,
            totalCostUSD: 0.02,
            modelUsage: index === 0
              ? { 'deepseek-v4-pro': { costUSD: 0.1 } }
              : {},
          },
        })),
      },
    })

    expect(evidence.ok).toBe(false)
    expect(evidence.status).toBe('PARTIAL_BASELINE_FAILURES')
    expect(evidence.guards).toContain(
      'model-forced Flash bare baseline used Pro; rerun with route model upgrades disabled',
    )
    expect(evidence.next[0]).toBe(
      'Rerun Flash bare with DSXU_ROUTE_MODEL_UPGRADE_DISABLED=1; this report used Pro and is not a bare baseline.',
    )
  })

  test('harness writes JSON and Markdown artifacts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v18-baseline-failure-'))
    const sourceReportPath = join(dir, 'live-report.json')
    const evidencePath = join(dir, 'failure.json')
    const markdownPath = join(dir, 'failure.md')
    await Bun.write(sourceReportPath, JSON.stringify(reportFixture()))

    const evidence = await runV18BaselineFailureReporterHarness({
      sourceReportPath,
      evidencePath,
      markdownPath,
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    const written = JSON.parse(await readFile(evidencePath, 'utf8'))
    const markdown = await readFile(markdownPath, 'utf8')
    expect(evidence.status).toBe('PARTIAL_BASELINE_FAILURES')
    expect(written.cases).toHaveLength(2)
    expect(markdown).toContain('DSXU V18 Baseline Failure Report')
    expect(markdown).toContain('policy-drift')
  })
})
