import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const FINAL_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_FINAL_PREFLIGHT_20260515.json')
const COLLECTION_PACK_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_COLLECTION_PACK_20260515.json')
const P12_INTAKE_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_INTAKE_20260515.json')
const RAW_READINESS_PATH = join(process.cwd(), '.dsxu', 'trace', 'raw-evidence-readiness-register-v1', 'raw-evidence-readiness-register.evidence.json')
const PRODUCT_STAGE_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_PRODUCT_STAGE_PLAN_20260515.json')
const DELETION_STAGE_PATH = join(GENERATED_DIR, 'DSXU_V20_OWNER_GIT_STAGE_PLAN_20260515.json')
const ACL_CLOSURE_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_CLOSURE_PLAN_20260515.json')
const COMMERCIAL_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_COMMERCIAL_IP_RELEASE_PREFLIGHT_20260515.json')
const CLEAN_EXPORT_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_BLOCKER_ACTION_BOARD_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_BLOCKER_ACTION_BOARD_20260515.csv')

type ActionRow = {
  order: number
  blocker: string
  status: string
  count: number
  requiredInputOrAuthorization: string
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
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

function numberFromJson(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function gateClosed(status: string): boolean {
  return status.startsWith('PASS') || status.startsWith('STAGED') || status.startsWith('AUTHORIZED') || status.startsWith('ADJUDICATED')
}

async function main(): Promise<void> {
  const [finalPreflight, collectionPack, p12Intake, rawReadiness, productStage, deletionStage, aclClosure, commercial, cleanExport] = await Promise.all([
    readJson(FINAL_PREFLIGHT_PATH),
    readJson(COLLECTION_PACK_PATH),
    readJson(P12_INTAKE_PATH),
    readJsonIfExists(RAW_READINESS_PATH),
    readJson(PRODUCT_STAGE_PATH),
    readJson(DELETION_STAGE_PATH),
    readJson(ACL_CLOSURE_PATH),
    readJson(COMMERCIAL_PREFLIGHT_PATH),
    readJson(CLEAN_EXPORT_PREFLIGHT_PATH),
  ])
  const canRunProductValidationTests = finalPreflight.canRunProductValidationTests === true
  const canRunFinalSixStageTests = finalPreflight.canRunFinalSixStageTests === true
  const sixStageStatus = canRunFinalSixStageTests
    ? 'PASS_READY_FOR_FINAL_SIX_STAGE_TESTS'
    : canRunProductValidationTests
      ? 'PRODUCT_VALIDATION_READY_RELEASE_EXPORT_BLOCKED'
      : String(finalPreflight.status ?? 'UNKNOWN')
  const rows: ActionRow[] = [
    {
      order: 1,
      blocker: 'P12 target-reference raw input',
      status: rawReadiness?.status === 'PASS'
        ? 'PASS_READY_FOR_DELTA_REVIEW'
        : String(p12Intake.status ?? 'BLOCKED_TARGET_REFERENCE_MANIFEST_REQUIRED'),
      count: rawReadiness?.status === 'PASS'
        ? numberFromJson(rawReadiness.p12PairedRawLogCount)
        : numberFromJson(collectionPack.targetManifestBacklogSlotCount),
      requiredInputOrAuthorization: rawReadiness?.status === 'PASS'
        ? 'review P12 delta findings before any comparison win claim'
        : 'provide real targetReferenceManifestPath built from collection work orders; templates do not count',
    },
    {
      order: 2,
      blocker: 'Owner/Git product stage',
      status: String(productStage.status ?? 'UNKNOWN'),
      count: numberFromJson(productStage.totalProductPaths),
      requiredInputOrAuthorization: String(productStage.status ?? '').startsWith('STAGED')
        ? 'product packets staged; keep post-stage verification evidence'
        : 'explicit owner/Git authorization to stage product M/?? packets',
    },
    {
      order: 3,
      blocker: 'Owner/Git deletion stage',
      status: String(deletionStage.status ?? 'UNKNOWN'),
      count: numberFromJson(deletionStage.totalDeletionPaths),
      requiredInputOrAuthorization: String(deletionStage.status ?? '').startsWith('STAGED')
        ? 'deletion packets staged; do not restore old duplicate runtime'
        : 'explicit owner/Git authorization to stage accepted deletion packets',
    },
    {
      order: 4,
      blocker: 'ACL residue closure',
      status: String(aclClosure.status ?? 'UNKNOWN'),
      count: numberFromJson(aclClosure.residueCount),
      requiredInputOrAuthorization: 'external permission/ownership closure or explicit owner/Git mutation handling',
    },
    {
      order: 5,
      blocker: 'Commercial/IP release notice',
      status: String(commercial.status ?? 'UNKNOWN'),
      count: numberFromJson(commercial.activeReviewRequiredRows),
      requiredInputOrAuthorization: 'final notice/license/package metadata review; not legal advice',
    },
    {
      order: 6,
      blocker: 'Final six-stage tests',
      status: sixStageStatus,
      count: 6,
      requiredInputOrAuthorization: canRunFinalSixStageTests
        ? 'run final six-stage tests under final preflight PASS'
        : canRunProductValidationTests
          ? 'product validation stages may run; release closure and clean export remain blocked until ACL residue closes'
          : 'run only after P12, owner/Git, deletion, ACL, and release gates pass',
    },
    {
      order: 7,
      blocker: 'Clean export',
      status: String(cleanExport.status ?? 'UNKNOWN'),
      count: 1,
      requiredInputOrAuthorization: 'create export only after final preflight PASS',
    },
  ]
  const report = {
    schemaVersion: 'dsxu.v20.blocker-action-board.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: rows.every(row => gateClosed(row.status))
      ? 'PASS_RELEASE_PREFLIGHT_READY_CLEAN_EXPORT_READY'
      : canRunProductValidationTests && String(cleanExport.status ?? '') === 'BLOCKED'
      ? 'PRODUCT_VALIDATION_READY_RELEASE_EXPORT_BLOCKED'
      : 'BLOCKED_FIXED_ACTION_ORDER',
    actionCount: rows.length,
    rows,
    didMutateGit: false,
    didMutateFilesystem: false,
    didRunFinalTests: false,
    didCreateExport: false,
    nextAction: rows.find(row => !gateClosed(row.status))?.requiredInputOrAuthorization ?? 'clean export may be created only by explicit release/export action',
    rule: 'This board is an execution order, not a PASS claim. It does not stage, delete, run final tests, or export.',
  }
  const headers = ['order', 'blocker', 'status', 'count', 'requiredInputOrAuthorization']
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(
      OUTPUT_CSV_PATH,
      [
        headers.map(csvEscape).join(','),
        ...rows.map(row => headers.map(header => csvEscape(row[header as keyof ActionRow])).join(',')),
      ].join('\n') + '\n',
    ),
  ])
  console.log(JSON.stringify({
    status: report.status,
    actionCount: report.actionCount,
    didMutateGit: report.didMutateGit,
    didMutateFilesystem: report.didMutateFilesystem,
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
