import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json')
const STAGE_PLAN_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_PLAN_20260515.json')
const ACL_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_PREFLIGHT_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_SIX_STAGE_TEST_PLAN_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_SIX_STAGE_TEST_PLAN_20260515.csv')

type TestStage = {
  order: number
  stage: string
  status: 'READY_FOR_PRODUCT_VALIDATION' | 'BLOCKED_FOR_FINAL_RUN_READY_FOR_FOCUSED' | 'BLOCKED_UNTIL_UPSTREAM_GATES_PASS' | 'BLOCKED_FOR_RELEASE_CLOSURE'
  purpose: string
  commands: readonly string[]
  acceptanceStandard: string
}

type SixStagePlan = {
  schemaVersion: 'dsxu.v20.six-stage-test-plan.v1'
  generatedAt: string
  repoRoot: string
  status: 'READY_FOR_RELEASE_CLOSURE_TESTS' | 'PRODUCT_VALIDATION_READY_RELEASE_EXPORT_BLOCKED' | 'BLOCKED_UNTIL_UPSTREAM_GATES_PASS'
  didRunFinalTests: false
  upstreamGates: {
    ownerGitRegisterAligned: boolean
    deletionStagePlanReady: boolean
    aclResidues: number
    p12PairedRawLogCount: number
    p12MinimumPairedRawLogsForPass: number
    p12ReplayFamilyGapCount: number
    cleanExportReady: boolean
  }
  stages: readonly TestStage[]
  blockers: readonly string[]
  nextAction: string
  rule: string
}

function csvEscape(value: unknown): string {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(stages: readonly TestStage[]): string {
  const headers = ['order', 'stage', 'status', 'purpose', 'commands', 'acceptanceStandard']
  return [
    headers.map(csvEscape).join(','),
    ...stages.map(stage => headers.map(header => csvEscape(stage[header as keyof TestStage])).join(',')),
  ].join('\n') + '\n'
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
}

function numberFromJson(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function boolFromJson(value: unknown): boolean {
  return value === true
}

function stage(
  order: number,
  name: string,
  purpose: string,
  commands: readonly string[],
  acceptanceStandard: string,
  status: TestStage['status'] = 'BLOCKED_FOR_FINAL_RUN_READY_FOR_FOCUSED',
): TestStage {
  return {
    order,
    stage: name,
    status,
    purpose,
    commands,
    acceptanceStandard,
  }
}

async function main(): Promise<void> {
  const [preflight, stagePlan, aclPreflight] = await Promise.all([
    readJson(PREFLIGHT_PATH),
    readJson(STAGE_PLAN_PATH),
    readJson(ACL_PREFLIGHT_PATH),
  ])
  const p12PairedRawLogCount = numberFromJson(preflight.p12PairedRawLogCount, 0)
  const p12MinimumPairedRawLogsForPass = numberFromJson(preflight.p12MinimumPairedRawLogsForPass, 14)
  const p12ReplayFamilyGapCount = numberFromJson(preflight.p12ReplayFamilyGapCount, 14)
  const ownerGitReady = boolFromJson(preflight.postStageIndexVerified) || boolFromJson(preflight.registerAlignedToGitStatus)
  const deletionStageReady = stagePlan.status === 'STAGED_BY_OWNER_GIT_EXECUTION' || boolFromJson(stagePlan.canStageDeletionPackets)
  const p12Ready = p12PairedRawLogCount >= p12MinimumPairedRawLogsForPass && p12ReplayFamilyGapCount === 0
  const productValidationReady = ownerGitReady && deletionStageReady && p12Ready
  const aclStatus = String(aclPreflight.status ?? '')
  const aclClosed = aclStatus.startsWith('PASS')
  const aclResidueCount = numberFromJson(aclPreflight.residueCount, 0)
  const aclBlockingResidues = aclClosed ? 0 : aclResidueCount
  const productStageStatus: TestStage['status'] = productValidationReady
    ? 'READY_FOR_PRODUCT_VALIDATION'
    : 'BLOCKED_FOR_FINAL_RUN_READY_FOR_FOCUSED'
  const stages: TestStage[] = [
    stage(
      1,
      'function-tests',
      'prove core owner paths: tools, permission, provider routing, agent lifecycle, MCP/skill registry, context, evidence',
      [
        'bun test src/dsxu/engine/__tests__/tool-gate-v1-clean.test.ts src/dsxu/engine/__tests__/tool-definition-owner.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
        'bun test src/dsxu/engine/__tests__/api-service.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/provider' +
          '-migration-model-migration-boundary-v1.test.ts',
        'bun test src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts src/dsxu/engine/__tests__/local-agent-background-lifecycle-v1.test.ts',
      ],
      'all core functions pass without duplicate runtime, shortcut bridge, or hidden compatibility path',
      productStageStatus,
    ),
    stage(
      2,
      'experience-tests',
      'prove UI/TUI/operator-visible state can show trustworthy long-task progress and continuation state',
      [
        'bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts src/dsxu/engine/__tests__/model-driven-tui-long-task-v1.test.ts src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts',
        'bun test src/dsxu/engine/__tests__/control-plane-v1.test.ts src/dsxu/engine/__tests__/control-plane-stage-acceptance-v1.test.ts src/dsxu/engine/__tests__/real-gap-acceptance.test.ts',
        'browser UI smoke: open local DSXU surface only after release gate permits interactive verification',
      ],
      'operator can see pending permission, active plan, tool state, recovery status, cost/evidence without misleading completion',
      productStageStatus,
    ),
    stage(
      3,
      'recovery-tests',
      'prove long-running coding tasks survive failure, resume, replay, and parent/agent synthesis',
      [
        'bun test src/dsxu/engine/__tests__/recovery-mainline-v3.test.ts src/dsxu/engine/__tests__/recovery-query-loop-v3.test.ts src/dsxu/engine/__tests__/scenario-review-recovery-v3.test.ts',
        'bun test src/dsxu/engine/__tests__/experience-store-replay-v1.test.ts src/dsxu/engine/__tests__/experience-store-smooth-resume-pack-v1.test.ts src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
      ],
      'failure paths preserve context and evidence, then resume through the original owner instead of a side runtime',
      productStageStatus,
    ),
    stage(
      4,
      'performance-tests',
      'prove routing, cache, cost, and long-task loops are fast enough under DeepSeek Flash/Flash-MAX/Pro policy',
      [
        'bun test src/dsxu/engine/__tests__/phase12-live-cost-matrix-v1.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts',
        'bun run live:provider-gate',
        'bun run live:cache-prefix-smoke',
      ],
      'latency/cost evidence is captured and non-DeepSeek fallback remains explicit opt-in only',
      productStageStatus,
    ),
    stage(
      5,
      'evaluation-tests',
      'prove V18/V19/V20 senior-programmer experience against real paired target evidence, not templates',
      [
        'bun run p12:raw-readiness --targetReferenceManifestPath <real-target-reference-manifest>',
        'bun test src/dsxu/engine/__tests__/phase12-raw-comparison-v1.test.ts src/dsxu/engine/__tests__/phase12-reference-semantic-exam-v1.test.ts src/dsxu/engine/__tests__/phase12-senior-programmer-experience-v1.test.ts',
        'bun test src/dsxu/engine/__tests__/evidence-eval-pack.test.ts src/dsxu/engine/__tests__/eval-baseline-manifest.test.ts',
      ],
      'P12 target raw paired logs meet 14/14 family coverage and delta report supports the 90+ experience claim',
      productStageStatus,
    ),
    stage(
      6,
      'release-closure-tests',
      'prove source, release surface, pending deletion review, ACL residues, and clean export gate are closed',
      [
        'bun run owner-git:preflight',
        'bun run test:dsxu:release',
        'bun run clean-export:preflight',
        'bun test src/dsxu/engine/__tests__/release-test-gate-v1.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts',
      ],
      'final preflight passes, no unresolved deletion/ACL/P12 gate remains, then clean export can be created',
      aclBlockingResidues > 0
        ? 'BLOCKED_FOR_RELEASE_CLOSURE'
        : productStageStatus,
    ),
  ]
  const blockers = [
    ...(p12PairedRawLogCount < p12MinimumPairedRawLogsForPass
      ? [`P12 target-reference paired raw logs incomplete: ${p12PairedRawLogCount}/${p12MinimumPairedRawLogsForPass}`]
      : []),
    ...(p12ReplayFamilyGapCount > 0 ? [`P12 replay family gap remains: ${p12ReplayFamilyGapCount}`] : []),
    ...(deletionStageReady ? [] : ['deletion stage plan is not ready']),
    ...(aclBlockingResidues > 0
      ? [`${aclBlockingResidues} ACL residue path(s) still require external permission/ownership closure`]
      : []),
    ...(productValidationReady ? [] : ['product validation tests require P12, Owner/Git, and deletion gates first']),
    ...(productValidationReady && aclClosed ? [] : ['clean export remains last and is not created by this plan']),
  ]
  const plan: SixStagePlan = {
    schemaVersion: 'dsxu.v20.six-stage-test-plan.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: productValidationReady && aclClosed
      ? 'READY_FOR_RELEASE_CLOSURE_TESTS'
      : productValidationReady
      ? 'PRODUCT_VALIDATION_READY_RELEASE_EXPORT_BLOCKED'
      : 'BLOCKED_UNTIL_UPSTREAM_GATES_PASS',
    didRunFinalTests: false,
    upstreamGates: {
      ownerGitRegisterAligned: ownerGitReady,
      deletionStagePlanReady: deletionStageReady,
      aclResidues: aclBlockingResidues,
      p12PairedRawLogCount,
      p12MinimumPairedRawLogsForPass,
      p12ReplayFamilyGapCount,
      cleanExportReady: boolFromJson(preflight.canCreateCleanExport),
    },
    stages,
    blockers,
    nextAction:
      productValidationReady && aclClosed
        ? 'run release closure tests, final preflight, and clean export preflight; do not create export until preflight passes'
        : productValidationReady
        ? 'run product validation stages now; keep release closure and clean export blocked until ACL residue is externally closed'
        : 'import real targetReferenceManifestPath or authorize owner/Git mutation-stage handling; then rerun preflight before final six-stage tests',
    rule:
      'This test plan defines the final proof order only. It does not run final tests, create export artifacts, stage, commit, delete, reset, or clean.',
  }
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(plan, null, 2) + '\n'),
    writeFile(OUTPUT_CSV_PATH, toCsv(stages)),
  ])
  console.log(JSON.stringify({
    status: plan.status,
    stages: plan.stages.length,
    p12PairedRawLogCount,
    p12MinimumPairedRawLogsForPass,
    p12ReplayFamilyGapCount,
    deletionStagePlanReady: plan.upstreamGates.deletionStagePlanReady,
    aclResidues: plan.upstreamGates.aclResidues,
    didRunFinalTests: plan.didRunFinalTests,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
