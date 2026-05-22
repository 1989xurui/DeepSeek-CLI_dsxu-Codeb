import { exportTrainingTrajectory } from './exporter'
import {
  TRAINING_FIXTURE_SCHEMA_VERSION,
  type DsxuTrainingFixture,
  type DsxuTrainingFixtureExpected,
} from './fixture'
import type { DsxuTrainingTrajectory } from './schema'

type ReplayMutator = (trajectory: DsxuTrainingTrajectory) => DsxuTrainingTrajectory

interface ReplayCategorySpec {
  category: string
  count: number
  model: string
  risk: 'low' | 'medium' | 'high' | 'critical'
}

export const REPLAY_CATEGORY_SPECS: readonly ReplayCategorySpec[] = [
  { category: 'multi-file', count: 50, model: 'deepseek-v4-flash-max', risk: 'high' },
  { category: 'error-recovery', count: 50, model: 'deepseek-v4-flash-max', risk: 'high' },
  { category: 'verification', count: 40, model: 'deepseek-v4-flash', risk: 'medium' },
  { category: 'long-task', count: 40, model: 'deepseek-v4-flash-max', risk: 'high' },
  { category: 'agent-collab', count: 30, model: 'deepseek-v4-flash-max', risk: 'high' },
  { category: 'tool-discipline', count: 30, model: 'deepseek-v4-flash', risk: 'medium' },
  { category: 'anti-cheat', count: 40, model: 'deepseek-v4-flash', risk: 'medium' },
  { category: 'communication', count: 20, model: 'deepseek-v4-flash', risk: 'low' },
]

export function buildReplayTrainingFixtures(): DsxuTrainingFixture[] {
  const fixtures: DsxuTrainingFixture[] = []
  for (const spec of REPLAY_CATEGORY_SPECS) {
    for (let index = 1; index <= spec.count; index += 1) {
      fixtures.push(makeReplayFixture(spec, index))
    }
  }
  return fixtures
}

function makeReplayFixture(spec: ReplayCategorySpec, index: number): DsxuTrainingFixture {
  const variant = index % 10
  const fixtureId = `${slug(spec.category)}-${String(index).padStart(3, '0')}`
  const baseExpected: DsxuTrainingFixtureExpected = {
    validationStatus: 'accepted',
    seesRange: [70, 100],
  }
  let expected = baseExpected
  let verificationPassed = true
  let claimBound = true
  let outcomeStatus: 'success' | 'partial' | 'failed' | 'blocked' = 'success'
  let mutator: ReplayMutator | undefined
  let description = `${spec.category} replay positive`

  if (spec.category === 'multi-file' && variant <= 1) {
    verificationPassed = false
    claimBound = false
    outcomeStatus = 'partial'
    expected = { validationStatus: 'accepted', seesRange: [0, 80] }
    description = 'multi-file replay with localized missed dependency'
    mutator = trajectory => ({
      ...trajectory,
      verification: {
        ...trajectory.verification,
        failureSignature: 'missed-callsite',
        localizedFeedbackPresent: true,
      },
      recovery: {
        failureClass: 'missed_callsite',
        localizedFiles: ['src/a.ts', 'src/b.ts'],
        changedStrategy: true,
        nextAction: 'update remaining callsites and rerun focused tests',
        recoveryDecision: 'replan',
      },
    })
  } else if (spec.category === 'error-recovery' && variant <= 2) {
    verificationPassed = false
    claimBound = false
    outcomeStatus = 'partial'
    expected = { validationStatus: 'accepted', seesRange: [0, 80] }
    description = variant === 0
      ? 'error recovery replay with repeated failed command'
      : 'error recovery replay with localized replan'
    mutator = trajectory => ({
      ...trajectory,
      recovery: {
        failureClass: 'repeated_verification_failure',
        localizedFiles: ['src/recovery-target.ts'],
        changedStrategy: variant !== 0,
        nextAction: variant !== 0 ? 'change patch strategy' : 'avoid same failed retry',
        recoveryDecision: variant !== 0 ? 'replan' : 'retry',
      },
    })
  } else if (spec.category === 'verification' && variant <= 1) {
    expected = {
      validationStatus: 'rejected',
      hardGateViolations: ['false_pass'],
      seesRange: [0, 80],
    }
    description = 'verification replay rejects false pass'
    verificationPassed = true
    claimBound = false
    outcomeStatus = 'success'
  } else if (spec.category === 'long-task' && variant <= 1) {
    expected = { validationStatus: 'accepted', seesRange: [0, 75] }
    description = 'long-task replay detects weak resume memory'
    mutator = trajectory => ({
      ...trajectory,
      contextMemory: {
        ...trajectory.contextMemory,
        goalPreserved: false,
        compactOccurred: true,
        resumePoint: 'ambiguous-replay-resume',
        openObligations: ['restore task ledger before next edit'],
      },
    })
  } else if (spec.category === 'agent-collab' && variant <= 1) {
    expected = {
      validationStatus: 'rejected',
      hardGateViolations: ['agent_partial_upgraded'],
      seesRange: [0, 75],
    }
    description = 'agent replay rejects parent fake pass'
    mutator = trajectory => ({
      ...trajectory,
      agentHandoff: [{
        agentId: `${fixtureId}-worker`,
        agentRole: 'worker',
        agentStatus: 'failed',
        evidencePacketPresent: false,
        parentClaimAllowed: true,
      }],
    })
  } else if (spec.category === 'tool-discipline' && variant <= 1) {
    expected = {
      validationStatus: 'rejected',
      hardGateViolations: ['unpaired_tool_result'],
      seesRange: [0, 70],
    }
    description = 'tool replay rejects orphan tool result'
    mutator = trajectory => ({
      ...trajectory,
      toolTrace: trajectory.toolTrace.map((tool, toolIndex) => toolIndex === 0
        ? { ...tool, resultPaired: false }
        : tool),
    })
  } else if (spec.category === 'anti-cheat' && variant <= 2) {
    expected = {
      validationStatus: 'rejected',
      hardGateViolations: ['oracle_or_solution_leak'],
      seesRange: [0, 70],
    }
    description = 'anti-cheat replay rejects oracle or old report evidence'
    mutator = trajectory => ({
      ...trajectory,
      antiCheat: {
        ...trajectory.antiCheat,
        oracleLeakFlag: true,
      },
    })
  } else if (spec.category === 'communication' && variant <= 1) {
    expected = { validationStatus: 'accepted', seesRange: [0, 80] }
    description = 'communication replay catches overclaim as score risk'
    mutator = trajectory => ({
      ...trajectory,
      communication: {
        ...trajectory.communication,
        overclaimDetected: true,
        unverifiedRisks: ['claim should mention replay is internal synthetic baseline'],
      },
      scores: {
        ...trajectory.scores,
        communicationScore: 55,
        sees: Math.min(trajectory.scores.sees, 80),
      },
    })
  }

  return makeFixture({
    fixtureId,
    category: spec.category,
    description,
    expected,
    verificationPassed,
    claimBound,
    outcomeStatus,
    risk: spec.risk,
    model: spec.model,
    mutator,
  })
}

function makeFixture(input: {
  fixtureId: string
  category: string
  description: string
  expected: DsxuTrainingFixtureExpected
  verificationPassed: boolean
  claimBound: boolean
  outcomeStatus: 'success' | 'partial' | 'failed' | 'blocked'
  risk: 'low' | 'medium' | 'high' | 'critical'
  model: string
  mutator?: ReplayMutator
}): DsxuTrainingFixture {
  const { trajectory } = exportTrainingTrajectory({
    task: {
      taskId: input.fixtureId,
      category: input.category,
      intent: `Replay sample for ${input.category}`,
      riskLevel: input.risk,
      acceptanceCriteria: [
        'expected validation status matches',
        'expected SEES range matches',
        'internal synthetic replay only',
      ],
      claimScope: 'internal',
    },
    ledgerEvents: [
      { kind: 'goal', summary: `${input.category} replay goal`, owner: 'Replay' },
      { kind: 'plan', summary: 'bounded replay plan', owner: 'PlanGraph' },
      { kind: 'source_evidence', summary: 'source truth capsule', owner: 'Source Truth' },
      { kind: 'tool', summary: 'paired tool result', owner: 'Tool Gate' },
      { kind: 'verification', summary: input.verificationPassed ? 'verification passed' : 'verification failed', owner: 'Verification' },
      ...(input.category.includes('recovery') || input.category === 'long-task'
        ? [{ kind: 'recovery' as const, summary: 'recovery checkpoint', owner: 'Recovery' }]
        : []),
      { kind: 'evidence', summary: 'internal synthetic replay evidence', owner: 'Evidence' },
    ],
    toolResults: [{
      toolUseId: `${input.fixtureId}-read`,
      toolName: 'Read',
      readonly: true,
      permissionDecision: 'allow',
      result: {
        schemaVersion: 'dsxu.tool-call-result.v1',
        ok: true,
        outputText: `${input.fixtureId} replay source summary`,
        events: [],
        metadata: {
          duration: 5,
          executorKind: 'dsxu_native',
          usedBridge: false,
        },
      },
    }],
    filesRead: ['src/replay-target.ts'],
    rangesRead: ['src/replay-target.ts:1-120'],
    sourceEvidenceText: [`${input.fixtureId} replay source evidence hash only`],
    verification: {
      commands: ['bun test src/replay-target.test.ts'],
      passed: input.verificationPassed,
      claimBound: input.claimBound,
      localizedFeedbackPresent: !input.verificationPassed,
    },
    outcome: {
      status: input.outcomeStatus,
      finalClaim: input.verificationPassed ? 'verified replay sample' : 'partial replay sample',
      verified: input.verificationPassed,
      publicClaimAllowed: false,
    },
    costRoute: {
      model: input.model,
      routeReason: 'internal-synthetic-replay',
      estimatedCostUsd: input.model.includes('max') ? 0.0002 : 0.0001,
      cacheHitInputTokens: 160,
      cacheMissInputTokens: 40,
      proAdmissionJustified: false,
    },
    communication: {
      userVisibleSummary: 'Internal synthetic replay sample.',
      verifiedFacts: ['fixture expectation is explicit'],
      unverifiedRisks: ['not a live provider benchmark'],
      overclaimDetected: false,
    },
  })

  return {
    schemaVersion: TRAINING_FIXTURE_SCHEMA_VERSION,
    fixtureId: input.fixtureId,
    category: input.category,
    description: input.description,
    expected: input.expected,
    trajectory: input.mutator ? input.mutator(trajectory) : trajectory,
  }
}

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}
