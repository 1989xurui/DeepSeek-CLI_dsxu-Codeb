import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import {
  buildRealTaskReplaySuite,
  REAL_TASK_REPLAY_P12_SLOT_IDS,
} from '../real-task-replay-suite-v1'
import { runRealTaskReplaySuiteHarness } from '../../integration/harness/real-task-replay-suite-v1-harness'

describe('WP-06 - Real Task Replay Suite V1', () => {
  test('runs complete P12 RT family slots with baseline, context, execution, recovery, verification, cost, and final evidence', async () => {
    const result = await runRealTaskReplaySuiteHarness()

    expect(result.schemaVersion).toBe('dsxu.real-task-replay-suite.v1')
    expect(result.status).toBe('PASS')
    expect(result.caseCount).toBe(14)
    expect(result.pass).toBe(14)
    expect(result.partial).toBe(0)
    expect(result.blocked).toBe(0)
    expect(result.mustNotClaimReleaseReady).toBe(true)
    expect(result.redlines).toEqual([])
    expect(result.cases.map(item => item.id)).toEqual([...REAL_TASK_REPLAY_P12_SLOT_IDS])
    expect(result.cases.every(item => Object.values(item.evidence).every(Boolean))).toBe(true)
    expect(result.requiredArtifacts.length).toBeGreaterThanOrEqual(30)

    const rt01 = result.cases.find(item => item.id === 'RT-01')
    expect(rt01?.metrics.repoContextReductionPct).toBeGreaterThanOrEqual(40)
    expect(rt01?.metrics.localizedFiles).toBeGreaterThanOrEqual(3)
    expect(rt01?.metrics.costPerSolvedUsd).toBeGreaterThan(0)

    const rt02 = result.cases.filter(item => item.id.startsWith('RT-02'))
    expect(rt02).toHaveLength(2)
    expect(rt02.every(item => item.metrics.costPerSolvedUsd && item.metrics.costPerSolvedUsd > 0)).toBe(true)

    const rt03 = result.cases.filter(item => item.id.startsWith('RT-03'))
    expect(rt03).toHaveLength(2)
    expect(rt03.every(item => item.metrics.reviewGateApproved === true)).toBe(true)

    const rt04 = result.cases.find(item => item.id === 'RT-04')
    expect(rt04?.metrics.timeoutTriggered).toBe(true)
    expect(rt04?.metrics.fileDeltaTracked).toBe(true)

    const rt05 = result.cases.find(item => item.id === 'RT-05-additional-1')
    expect(rt05?.metrics.screenshotBytes).toBeGreaterThan(0)

    const rt06 = result.cases.find(item => item.id === 'RT-06-additional-1')
    expect(rt06?.metrics.failedCheckCount).toBe(0)

    const rt07 = result.cases.find(item => item.id === 'RT-07')
    expect(rt07?.metrics.readBeforeEdit).toBe(true)
    expect(rt07?.metrics.verifiedAfterResume).toBe(true)

    const rt08 = result.cases.find(item => item.id === 'RT-08')
    expect(rt08?.metrics.partialDonePassBlocked).toBe(true)
    expect(rt08?.metrics.partialDisclosedAllowed).toBe(true)

    expect(existsSync(result.tracePath)).toBe(true)
    expect(existsSync(result.evidencePath)).toBe(true)
  }, 120_000)

  test('blocks a replay case that tries to pass without required evidence', () => {
    const suite = buildRealTaskReplaySuite([
      {
        id: 'RT-01',
        title: 'bad replay',
        target: 'should be blocked',
        evidence: {
          baseline: true,
          context: false,
          execution: true,
          recovery: true,
          verification: false,
          cost: true,
          final: true,
        },
        artifactPaths: ['trace.json'],
        metrics: {},
        risks: [],
      },
    ])

    expect(suite.status).toBe('BLOCKED')
    expect(suite.redlines).toContain('RT-01: missing context evidence')
    expect(suite.redlines).toContain('RT-01: missing verification evidence')
  })
})
