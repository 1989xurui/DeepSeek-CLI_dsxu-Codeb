import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_MUTATION_PREFLIGHT_20260515.json')
const DELETION_STAGE_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_PLAN_20260515.json')
const PRODUCT_STAGE_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.json')
const ACL_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_PREFLIGHT_20260515.json')
const P12_INTAKE_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_INTAKE_20260515.json')
const RAW_READINESS_PATH = join(process.cwd(), '.dsxu', 'trace', 'raw-evidence-readiness-register-v1', 'raw-evidence-readiness-register.evidence.json')
const STAGE_EXECUTION_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_EXECUTION_20260515.json')
const POST_AUTH_PATH = join(GENERATED_DIR, 'DSXU_V20_POST_AUTHORIZATION_VERIFICATION_PLAN_20260515.json')
const SIX_STAGE_PLAN_PATH = join(GENERATED_DIR, 'DSXU_V20_SIX_STAGE_TEST_PLAN_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_FINAL_PREFLIGHT_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_FINAL_PREFLIGHT_20260515.csv')

type GateRow = {
  gate: string
  status: string
  canProceed: boolean
  count: number
  requiredAction: string
}

type FinalPreflight = {
  schemaVersion: 'dsxu.v20.final-preflight.v1'
  generatedAt: string
  repoRoot: string
  status: 'PASS' | 'BLOCKED'
  gitStatusShort: {
    total: number
    modified: number
    deleted: number
    untracked: number
  }
  canRunProductValidationTests: boolean
  canRunFinalSixStageTests: boolean
  canCreateCleanExport: boolean
  didRunFinalTests: false
  didCreateExport: false
  gates: readonly GateRow[]
  blockers: readonly string[]
  nextAction: string
  rule: string
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(rows: readonly GateRow[]): string {
  const headers = ['gate', 'status', 'canProceed', 'count', 'requiredAction']
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header as keyof GateRow])).join(',')),
  ].join('\n') + '\n'
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
}

async function readJsonIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    return await readJson(path)
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

function numberFromJson(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function boolFromJson(value: unknown): boolean {
  return value === true
}

async function gitStatusShort(): Promise<FinalPreflight['gitStatusShort']> {
  const { stdout } = await execFileAsync('git', ['status', '--short'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 16,
  })
  const rows = stdout.split(/\r?\n/).filter(Boolean).map(line => line.slice(0, 2).trim())
  return {
    total: rows.length,
    modified: rows.filter(code => code === 'M').length,
    deleted: rows.filter(code => code === 'D').length,
    untracked: rows.filter(code => code === '??').length,
  }
}

async function main(): Promise<void> {
  const [preflight, deletionStage, productStage, aclPreflight, p12Intake, rawReadiness, stageExecution, postAuth, sixStagePlan, gitStatus] = await Promise.all([
    readJson(PREFLIGHT_PATH),
    readJson(DELETION_STAGE_PATH),
    readJson(PRODUCT_STAGE_PATH),
    readJson(ACL_PREFLIGHT_PATH),
    readJson(P12_INTAKE_PATH),
    readJsonIfExists(RAW_READINESS_PATH),
    readJsonIfExists(STAGE_EXECUTION_PATH),
    readJsonIfExists(POST_AUTH_PATH),
    readJson(SIX_STAGE_PLAN_PATH),
    gitStatusShort(),
  ])
  const ownerGitStaged =
    stageExecution?.status === 'STAGED_OWNER_GIT_PACKETS' &&
    boolFromJson(stageExecution.didStageGit) &&
    numberFromJson(stageExecution.failedCommandCount) === 0
  const postStageVerified =
    postAuth?.status === 'POST_STAGE_VERIFIED_REMAINING_GATES_BLOCKED' ||
    postAuth?.status === 'POST_STAGE_VERIFIED_FINAL_TEST_ENTRY_READY'
  const p12Ready = rawReadiness?.status === 'PASS'
  const aclStatus = String(aclPreflight.status ?? '')
  const aclClosed = aclStatus.startsWith('PASS')
  const aclActiveProductRefs = numberFromJson(aclPreflight.activeProductReferenceRows)
  const productValidationReady = ownerGitStaged && postStageVerified && p12Ready && aclActiveProductRefs === 0
  const finalGateReady = ownerGitStaged && postStageVerified && p12Ready && aclClosed
  const gates: GateRow[] = [
    {
      gate: 'owner-git-register',
      status: ownerGitStaged && postStageVerified
        ? 'PASS_STAGED_POST_STAGE_INDEX_VERIFIED'
        : boolFromJson(preflight.registerAlignedToGitStatus)
          ? 'PASS_ALIGNED_PRE_STAGE'
          : 'BLOCKED',
      canProceed: (ownerGitStaged && postStageVerified) || boolFromJson(preflight.registerAlignedToGitStatus),
      count: ownerGitStaged ? numberFromJson(stageExecution?.totalPlannedPathCount) : numberFromJson(preflight.registerRows),
      requiredAction: ownerGitStaged
        ? 'owner/Git packets are staged; keep post-stage index evidence instead of pre-stage register alignment'
        : 'keep every git status path mapped to a named owner packet',
    },
    {
      gate: 'product-stage-plan',
      status: ownerGitStaged ? 'PASS_STAGED' : String(productStage.status ?? 'UNKNOWN'),
      canProceed: ownerGitStaged || productStage.status === 'READY_PENDING_EXPLICIT_OWNER_GIT_STAGE',
      count: numberFromJson(productStage.totalProductPaths),
      requiredAction: ownerGitStaged
        ? 'product packets staged under Owner/Git execution report'
        : 'explicit owner/Git authorization before staging M/?? product paths',
    },
    {
      gate: 'deletion-stage-plan',
      status: ownerGitStaged ? 'PASS_STAGED' : String(deletionStage.status ?? 'UNKNOWN'),
      canProceed: ownerGitStaged || deletionStage.status === 'READY_PENDING_EXPLICIT_GIT_STAGE',
      count: numberFromJson(deletionStage.totalDeletionPaths),
      requiredAction: ownerGitStaged
        ? 'deletion packets staged under Owner/Git execution report'
        : 'explicit owner/Git authorization before staging accepted deletions',
    },
    {
      gate: 'acl-residue',
      status: String(aclPreflight.status ?? 'UNKNOWN'),
      canProceed: aclClosed,
      count: numberFromJson(aclPreflight.residueCount),
      requiredAction: aclClosed
        ? 'ACL residues are owner-signed external non-runtime residue; keep excluded from release/export'
        : 'external permission/ownership closure or explicit owner/Git mutation handling',
    },
    {
      gate: 'p12-target-reference-manifest',
      status: rawReadiness?.status === 'PASS' ? 'PASS_RAW_READY' : String(p12Intake.status ?? 'UNKNOWN'),
      canProceed: p12Ready,
      count: rawReadiness?.status === 'PASS'
        ? numberFromJson(rawReadiness.p12PairedRawLogCount)
        : numberFromJson(p12Intake.acceptedLogCount),
      requiredAction: rawReadiness?.status === 'PASS'
        ? 'paired raw logs imported; keep delta review evidence before any comparison win claim'
        : 'import real targetReferenceManifestPath; do not fabricate target logs',
    },
    {
      gate: 'six-stage-test-plan',
      status: String(sixStagePlan.status ?? 'UNKNOWN'),
      canProceed: finalGateReady,
      count: Array.isArray(sixStagePlan.stages) ? sixStagePlan.stages.length : 0,
      requiredAction: finalGateReady
        ? 'run release closure tests and keep evidence before clean export'
        : productValidationReady
          ? 'product validation stages may run; release closure remains blocked until ACL residue is externally closed'
        : 'run final tests only after upstream gates pass',
    },
    {
      gate: 'clean-export',
      status: finalGateReady ? 'READY_AFTER_RELEASE_CLOSURE_TESTS' : 'BLOCKED',
      canProceed: finalGateReady,
      count: 1,
      requiredAction: finalGateReady
        ? 'run clean-export preflight after release closure tests; do not create export artifact unless explicitly requested'
        : 'create clean export only after final preflight PASS',
    },
  ]
  const blockers = gates
    .filter(gate => !gate.canProceed)
    .map(gate => `${gate.gate}: ${gate.requiredAction}`)
  const report: FinalPreflight = {
    schemaVersion: 'dsxu.v20.final-preflight.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: finalGateReady ? 'PASS' : 'BLOCKED',
    gitStatusShort: gitStatus,
    canRunProductValidationTests: productValidationReady,
    canRunFinalSixStageTests: finalGateReady,
    canCreateCleanExport: finalGateReady,
    didRunFinalTests: false,
    didCreateExport: false,
    gates,
    blockers,
    nextAction: finalGateReady
      ? 'run release closure tests and clean-export preflight; create export only on explicit release action'
      : productValidationReady
      ? 'continue product validation evidence; release closure and clean export remain blocked by ACL residue'
      : 'close P12 target raw input, explicit owner/Git staging, ACL residues, then rerun final preflight',
    rule:
      'This final preflight is a gate report only. It does not stage, commit, delete, reset, clean, run final tests, or create export artifacts.',
  }
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(OUTPUT_CSV_PATH, toCsv(gates)),
  ])
  console.log(JSON.stringify({
    status: report.status,
    gitStatusShort: report.gitStatusShort,
    gates: report.gates.length,
    canRunFinalSixStageTests: report.canRunFinalSixStageTests,
    canCreateCleanExport: report.canCreateCleanExport,
    didRunFinalTests: report.didRunFinalTests,
    didCreateExport: report.didCreateExport,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
