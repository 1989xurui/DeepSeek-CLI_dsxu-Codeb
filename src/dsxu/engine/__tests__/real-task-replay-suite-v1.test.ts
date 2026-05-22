import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import {
  buildV5ReplayTraceMetadataEvents,
  buildRealTaskReplaySuite,
  buildV5ReplayBank,
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

  test('builds V5 Replay Bank only when traces carry contract, tool, proof, verification, raw trace evidence, and subset recovery coverage', () => {
    const goodCases = Array.from({ length: 20 }, (_, index) => ({
      caseId: `case-${index + 1}`,
      layer: (['L1', 'L2', 'L3', 'L4', 'L5'] as const)[index % 5],
      userTask: 'bounded coding replay',
      executionContract: true,
      route: true,
      visibleTools: true,
      promptHash: true,
      toolEvents: true,
      sourceEvidence: true,
      editProof: true,
      verificationResult: true,
      recoveryPath: index % 4 === 0,
      finalAnswer: true,
      accepted: true,
      rawTracePath: `.dsxu/trace/replay/case-${index + 1}.jsonl`,
    }))
    const ready = buildV5ReplayBank(goodCases)
    const blocked = buildV5ReplayBank([
      {
        ...goodCases[0],
        caseId: 'bad-case',
        editProof: false,
        rawTracePath: '',
      },
    ])

    expect(ready.schemaVersion).toBe('dsxu.replay-bank.v5')
    expect(ready.status).toBe('PASS_V5_REPLAY_BANK_READY')
    expect(ready.requiredSubsetReady).toBe(true)
    expect(ready.fullReleaseReady).toBe(false)
    expect(ready.rawTraceSavedPct).toBe(100)
    expect(ready.recoveryCaseCount).toBe(5)
    expect(ready.redlines).toEqual([])
    expect(blocked.status).toBe('NEEDS_V5_REPLAY_BANK_EVIDENCE')
    expect(blocked.redlines).toContain('bad-case: missing editProof')
    expect(blocked.redlines).toContain('bad-case: missing rawTracePath')
  })

  test('builds native V5 replay metadata events without adding a second benchmark runtime', () => {
    const events = buildV5ReplayTraceMetadataEvents({
      caseId: 'v5-native-case',
      userTask: 'repair checkout pricing',
      workspace: 'D:/tmp/replay',
      prompt: 'Fix checkout and verify with bun test.',
      visibleTools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob'],
      sourceEvidence: ['src/checkout.ts', 'tests/checkout.test.ts'],
      changedFiles: ['src/checkout.ts'],
      verificationCommand: ['bun', 'test'],
      verificationPassed: true,
      verificationArtifacts: ['stdout.log', 'stderr.log'],
      recoveryPath: true,
      routeModel: 'deepseek-v4-flash',
      now: 1,
    })

    expect(events.map(event => event.type)).toEqual([
      'dsxu.execution-contract.v5',
      'dsxu.prompt-hash',
      'dsxu.edit-proof-envelope.v5',
      'dsxu.replay-standard.v5',
    ])
    expect(events[0]).toMatchObject({
      task_contract: expect.objectContaining({
        schemaVersion: 'dsxu.execution-contract.v5',
        owner: 'Query Loop / PlanGraph / Tool Gate',
      }),
    })
    expect(events[1]).toMatchObject({
      schemaVersion: 'dsxu.prompt-cache-hash.v5',
      routeModel: 'deepseek-v4-flash',
    })
    expect(events[2]).toMatchObject({
      editProof: expect.objectContaining({
        schemaVersion: 'dsxu.edit-proof-envelope.v5',
        owner: 'Tool Gate / VerificationKernel / Evidence',
        claimAllowed: true,
      }),
    })
  })
})
