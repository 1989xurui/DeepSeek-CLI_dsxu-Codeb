import { exportTrainingTrajectory } from './exporter'
import {
  TRAINING_FIXTURE_SCHEMA_VERSION,
  type DsxuTrainingFixture,
  type DsxuTrainingFixtureExpected,
} from './fixture'
import type { DsxuTrainingTrajectory } from './schema'

type FixtureMutator = (trajectory: DsxuTrainingTrajectory) => DsxuTrainingTrajectory

const GROUPS = [
  { prefix: 'G1', category: 'basic-edit' },
  { prefix: 'G2', category: 'multi-file' },
  { prefix: 'G3', category: 'verification' },
  { prefix: 'G4', category: 'recovery' },
  { prefix: 'G5', category: 'long-task' },
  { prefix: 'G6', category: 'anti-cheat' },
] as const

export function buildGoldenTrainingFixtures(): DsxuTrainingFixture[] {
  const fixtures: DsxuTrainingFixture[] = []
  for (const group of GROUPS) {
    for (let index = 1; index <= 5; index += 1) {
      fixtures.push(makePositiveFixture(group.prefix, group.category, index))
    }
    for (let index = 6; index <= 10; index += 1) {
      fixtures.push(makeNegativeFixture(group.prefix, group.category, index))
    }
  }
  return fixtures
}

function makePositiveFixture(prefix: string, category: string, index: number): DsxuTrainingFixture {
  return makeFixture({
    fixtureId: `${prefix}-${String(index).padStart(2, '0')}`,
    category,
    description: `${category} positive verified trajectory`,
    expected: {
      validationStatus: 'accepted',
      seesRange: [75, 100],
    },
    taskCategory: category,
    mutator: trajectory => ({
      ...trajectory,
      task: {
        ...trajectory.task,
        taskId: `${prefix}-${String(index).padStart(2, '0')}`,
        category,
        intent: `Golden positive sample for ${category}`,
      },
      stateTrace: [
        ...trajectory.stateTrace,
        {
          state: 'final',
          previousState: 'verify',
          allowedTransition: true,
          transitionReason: 'verified positive sample',
          attemptCount: 1,
        },
      ],
    }),
  })
}

function makeNegativeFixture(prefix: string, category: string, index: number): DsxuTrainingFixture {
  if (prefix === 'G1') {
    return makeFixture({
      fixtureId: `${prefix}-${String(index).padStart(2, '0')}`,
      category,
      description: 'basic edit negative: stale source truth before edit',
      expected: {
        validationStatus: 'rejected',
        hardGateViolations: ['stale_source_edit'],
        seesRange: [0, 70],
      },
      taskCategory: category,
      mutator: trajectory => ({
        ...trajectory,
        sourceTruth: {
          ...trajectory.sourceTruth,
          staleReadDetected: true,
        },
        editTrace: [{
          file: 'src/example.ts',
          intent: 'edit without fresh source truth',
          changedLineRanges: ['src/example.ts:10-12'],
          sourceTruthFresh: false,
          diffHash: 'stale-edit',
        }],
      }),
    })
  }

  if (prefix === 'G2') {
    return makeFixture({
      fixtureId: `${prefix}-${String(index).padStart(2, '0')}`,
      category,
      description: 'multi-file negative: verification catches missed import/call point',
      expected: {
        validationStatus: 'accepted',
        seesRange: [0, 80],
      },
      taskCategory: category,
      verificationPassed: false,
      claimBound: false,
      outcomeStatus: 'partial',
      mutator: trajectory => ({
        ...trajectory,
        verification: {
          ...trajectory.verification,
          failureSignature: 'missing-import',
          localizedFeedbackPresent: true,
        },
        recovery: {
          failureClass: 'missing_import',
          localizedFiles: ['src/example.ts'],
          changedStrategy: true,
          nextAction: 'add missing import and rerun tests',
          recoveryDecision: 'replan',
        },
      }),
    })
  }

  if (prefix === 'G3') {
    return makeFixture({
      fixtureId: `${prefix}-${String(index).padStart(2, '0')}`,
      category,
      description: 'verification negative: final success without verification binding',
      expected: {
        validationStatus: 'rejected',
        hardGateViolations: ['false_pass'],
        seesRange: [0, 80],
      },
      taskCategory: category,
      verificationPassed: true,
      claimBound: false,
      outcomeStatus: 'success',
    })
  }

  if (prefix === 'G4') {
    return makeFixture({
      fixtureId: `${prefix}-${String(index).padStart(2, '0')}`,
      category,
      description: 'recovery negative: failed verification without strategy change',
      expected: {
        validationStatus: 'accepted',
        seesRange: [0, 80],
      },
      taskCategory: category,
      verificationPassed: false,
      claimBound: false,
      outcomeStatus: 'partial',
      mutator: trajectory => ({
        ...trajectory,
        recovery: {
          failureClass: 'repeated_verification_failure',
          localizedFiles: ['src/example.ts'],
          changedStrategy: false,
          nextAction: 'do not repeat the same failed command',
          recoveryDecision: 'retry',
        },
      }),
    })
  }

  if (prefix === 'G5') {
    return makeFixture({
      fixtureId: `${prefix}-${String(index).padStart(2, '0')}`,
      category,
      description: 'long task negative: compact/resume lost original goal',
      expected: {
        validationStatus: 'accepted',
        seesRange: [0, 75],
      },
      taskCategory: category,
      mutator: trajectory => ({
        ...trajectory,
        contextMemory: {
          ...trajectory.contextMemory,
          goalPreserved: false,
          compactOccurred: true,
          resumePoint: 'ambiguous-after-compact',
          openObligations: ['recover original goal before editing'],
        },
      }),
    })
  }

  return makeFixture({
    fixtureId: `${prefix}-${String(index).padStart(2, '0')}`,
    category,
    description: 'anti-cheat negative: oracle or old report evidence used',
    expected: {
      validationStatus: 'rejected',
      hardGateViolations: ['oracle_or_solution_leak'],
      seesRange: [0, 70],
    },
    taskCategory: category,
    mutator: trajectory => ({
      ...trajectory,
      antiCheat: {
        ...trajectory.antiCheat,
        oracleLeakFlag: true,
      },
    }),
  })
}

function makeFixture(input: {
  fixtureId: string
  category: string
  description: string
  expected: DsxuTrainingFixtureExpected
  taskCategory: string
  verificationPassed?: boolean
  claimBound?: boolean
  outcomeStatus?: 'success' | 'partial' | 'failed' | 'blocked'
  mutator?: FixtureMutator
}): DsxuTrainingFixture {
  const verificationPassed = input.verificationPassed ?? true
  const claimBound = input.claimBound ?? verificationPassed
  const outcomeStatus = input.outcomeStatus ?? (verificationPassed ? 'success' : 'partial')
  const { trajectory } = exportTrainingTrajectory({
    task: {
      taskId: input.fixtureId,
      category: input.taskCategory,
      intent: `Golden sample ${input.fixtureId}`,
      riskLevel: input.category === 'long-task' ? 'high' : 'medium',
      acceptanceCriteria: ['expected validation status matches', 'expected SEES range matches'],
      claimScope: 'internal',
    },
    ledgerEvents: [
      { kind: 'plan', summary: 'build golden sample plan', owner: 'Training Trajectory' },
      { kind: 'source_evidence', summary: 'source truth capsule present', owner: 'Source Truth' },
      { kind: 'tool', summary: 'tool call paired with result', owner: 'Tool Gate' },
      { kind: 'verification', summary: verificationPassed ? 'verification passed' : 'verification failed', owner: 'Verification' },
      ...(input.category === 'long-task' ? [{ kind: 'recovery' as const, summary: 'long task recovery checkpoint', owner: 'Recovery' }] : []),
    ],
    toolResults: [{
      toolUseId: `${input.fixtureId}-tool-1`,
      toolName: 'Read',
      readonly: true,
      permissionDecision: 'allow',
      result: {
        schemaVersion: 'dsxu.tool-call-result.v1',
        ok: true,
        outputText: `${input.fixtureId} redacted source summary`,
        events: [],
        metadata: {
          duration: 3,
          executorKind: 'dsxu_native',
          usedBridge: false,
        },
      },
    }],
    filesRead: ['src/example.ts'],
    rangesRead: ['src/example.ts:1-80'],
    sourceEvidenceText: [`${input.fixtureId} source evidence summary`],
    verification: {
      commands: ['bun test src/example.test.ts'],
      passed: verificationPassed,
      claimBound,
      localizedFeedbackPresent: !verificationPassed,
    },
    outcome: {
      status: outcomeStatus,
      finalClaim: verificationPassed ? 'verified golden sample' : 'partial golden sample',
      verified: verificationPassed,
      publicClaimAllowed: false,
    },
    costRoute: {
      model: input.category === 'long-task' ? 'deepseek-v4-flash-max' : 'deepseek-v4-flash',
      routeReason: 'golden-fixture',
      estimatedCostUsd: 0.0001,
      cacheHitInputTokens: 100,
      cacheMissInputTokens: 20,
      proAdmissionJustified: false,
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
