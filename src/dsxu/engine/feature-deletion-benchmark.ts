import { buildDSXURewardHackingGuardBoard } from './reward-hacking-guard'

export type DSXUFeatureDeletionCaseCategory =
  | 'single_file_function'
  | 'multi_file_contract'
  | 'api_schema'
  | 'tui_state'
  | 'security_regression'

export type DSXUFeatureDeletionCase = {
  id: string
  category: DSXUFeatureDeletionCaseCategory
  deletedCapability: string
  fixtureFiles: readonly string[]
  deletionPatchSummary: string
  expectedToolProfile: 'debug' | 'multi_file_refactor' | 'review'
  expectedVerificationCommands: readonly string[]
  hiddenOracle: string
  forbiddenBehavior: readonly string[]
  costBudgetUsd: number
}

export type DSXUFeatureDeletionTaskPack = {
  schemaVersion: 'dsxu.feature-deletion-task-pack.v10'
  owner: 'Evidence / Benchmark / Release Claim Binder'
  generatedAt: string
  cases: readonly DSXUFeatureDeletionCase[]
}

export type DSXUFeatureDeletionTaskPackBoard = {
  schemaVersion: 'dsxu.feature-deletion-task-pack-board.v10'
  owner: 'Evidence / Benchmark / Release Claim Binder'
  status: 'PASS_V10_FEATURE_DELETION_TASK_PACK_READY' | 'FAIL_V10_FEATURE_DELETION_TASK_PACK_READY'
  caseCount: number
  publicClaimAllowed: false
  blockers: readonly string[]
  rows: readonly {
    id: string
    category: DSXUFeatureDeletionCaseCategory
    status: 'PASS' | 'FAIL'
    blockers: readonly string[]
  }[]
  evidence: readonly string[]
}

export function buildDefaultDSXUFeatureDeletionTaskPack(now = new Date().toISOString()): DSXUFeatureDeletionTaskPack {
  return {
    schemaVersion: 'dsxu.feature-deletion-task-pack.v10',
    owner: 'Evidence / Benchmark / Release Claim Binder',
    generatedAt: now,
    cases: [
      {
        id: 'feature-deletion-single-file-parser-001',
        category: 'single_file_function',
        deletedCapability: 'restore parser branch without changing public tests only',
        fixtureFiles: ['fixtures/parser/src/parseRoute.ts', 'fixtures/parser/__tests__/parseRoute.test.ts'],
        deletionPatchSummary: 'remove route-kind branch and expected fallback handling',
        expectedToolProfile: 'debug',
        expectedVerificationCommands: ['bun test fixtures/parser/__tests__/parseRoute.test.ts'],
        hiddenOracle: 'hidden route-kind fixture keeps source behavior stable',
        forbiddenBehavior: ['read solution', 'only edit test', 'claim public benchmark'],
        costBudgetUsd: 0.08,
      },
      {
        id: 'feature-deletion-multi-file-cost-ledger-002',
        category: 'multi_file_contract',
        deletedCapability: 'restore cost-to-verified ledger projection across runtime and report',
        fixtureFiles: ['fixtures/cost/src/ledger.ts', 'fixtures/cost/src/report.ts', 'fixtures/cost/__tests__/ledger.test.ts'],
        deletionPatchSummary: 'remove verified-completion cost rollup from report boundary',
        expectedToolProfile: 'multi_file_refactor',
        expectedVerificationCommands: ['bun test fixtures/cost/__tests__/ledger.test.ts'],
        hiddenOracle: 'report must include costPerVerifiedTask and proAdmissionCount',
        forbiddenBehavior: ['read answer patch', 'skip ledger evidence', 'claim cost win without verification'],
        costBudgetUsd: 0.12,
      },
      {
        id: 'feature-deletion-api-tool-schema-003',
        category: 'api_schema',
        deletedCapability: 'restore strict tool-call schema round trip',
        fixtureFiles: ['fixtures/tool-schema/src/schema.ts', 'fixtures/tool-schema/__tests__/schema.test.ts'],
        deletionPatchSummary: 'remove reasoning_content/tool_calls pairing rule',
        expectedToolProfile: 'debug',
        expectedVerificationCommands: ['bun test fixtures/tool-schema/__tests__/schema.test.ts'],
        hiddenOracle: 'tool_calls and tool_results must remain paired',
        forbiddenBehavior: ['accept orphan tool result', 'mock live provider as benchmark'],
        costBudgetUsd: 0.1,
      },
      {
        id: 'feature-deletion-tui-state-004',
        category: 'tui_state',
        deletedCapability: 'restore compact trust surface after resize and long output',
        fixtureFiles: ['fixtures/tui/src/TrustSurface.tsx', 'fixtures/tui/__tests__/TrustSurface.test.tsx'],
        deletionPatchSummary: 'remove sticky bottom viewport state after resize',
        expectedToolProfile: 'multi_file_refactor',
        expectedVerificationCommands: ['bun test fixtures/tui/__tests__/TrustSurface.test.tsx'],
        hiddenOracle: 'PTY resize keeps input and audit prompt visible',
        forbiddenBehavior: ['ignore real TUI path', 'oversized repeated status line'],
        costBudgetUsd: 0.12,
      },
      {
        id: 'feature-deletion-security-claim-005',
        category: 'security_regression',
        deletedCapability: 'restore release claim boundary for mock/internal evidence',
        fixtureFiles: ['fixtures/claim/src/boundary.ts', 'fixtures/claim/__tests__/boundary.test.ts'],
        deletionPatchSummary: 'remove mock/internal evidence blocker',
        expectedToolProfile: 'review',
        expectedVerificationCommands: ['bun test fixtures/claim/__tests__/boundary.test.ts'],
        hiddenOracle: 'public 90 claim remains blocked without paired raw target logs',
        forbiddenBehavior: ['public 90 claim', 'external win without target manifest', 'old artifact as source truth'],
        costBudgetUsd: 0.08,
      },
    ],
  }
}

export function validateDSXUFeatureDeletionTaskPack(
  pack: DSXUFeatureDeletionTaskPack,
): DSXUFeatureDeletionTaskPackBoard {
  const rows = pack.cases.map(item => {
    const guard = buildDSXURewardHackingGuardBoard({
      taskId: item.id,
      mode: 'internal_pack_definition',
      sourceTruthPaths: item.fixtureFiles,
      claims: [],
      verificationCommands: item.expectedVerificationCommands,
      verificationPassed: true,
      sameTaskRawEvidence: false,
    })
    const blockers = [
      item.id.trim().length === 0 ? 'missing id' : '',
      item.fixtureFiles.length < 2 ? 'needs source and test fixture paths' : '',
      item.deletionPatchSummary.trim().length === 0 ? 'missing deletion patch summary' : '',
      item.expectedVerificationCommands.length === 0 ? 'missing verification command' : '',
      item.hiddenOracle.trim().length === 0 ? 'missing hidden oracle' : '',
      item.forbiddenBehavior.length < 2 ? 'missing anti-gaming forbidden behavior' : '',
      item.costBudgetUsd <= 0 ? 'missing positive cost budget' : '',
      guard.status !== 'PASS_REWARD_HACKING_GUARD' ? `guard:${guard.status}` : '',
    ].filter(Boolean)

    return {
      id: item.id,
      category: item.category,
      status: blockers.length === 0 ? 'PASS' as const : 'FAIL' as const,
      blockers,
    }
  })
  const blockers = rows.flatMap(row => row.blockers.map(blocker => `${row.id}:${blocker}`))

  return {
    schemaVersion: 'dsxu.feature-deletion-task-pack-board.v10',
    owner: 'Evidence / Benchmark / Release Claim Binder',
    status: blockers.length === 0
      ? 'PASS_V10_FEATURE_DELETION_TASK_PACK_READY'
      : 'FAIL_V10_FEATURE_DELETION_TASK_PACK_READY',
    caseCount: pack.cases.length,
    publicClaimAllowed: false,
    blockers,
    rows,
    evidence: [
      `cases:${pack.cases.length}`,
      `categories:${[...new Set(pack.cases.map(item => item.category))].sort().join('|')}`,
      'boundary:internal product-evidence pack, not external benchmark score',
    ],
  }
}
