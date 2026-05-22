import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const COLLECTION_PACK_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_COLLECTION_PACK_20260515.json')
const WORK_ORDERS_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_COLLECTION_WORK_ORDERS_20260515.csv')
const INTAKE_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_INTAKE_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_CONTRACT_BOARD_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_CONTRACT_BOARD_20260515.csv')

type ContractRow = {
  field: string
  required: true
  rejectionRule: string
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
}

function countCsvRows(text: string): number {
  return Math.max(0, text.trim().split(/\r?\n/).filter(Boolean).length - 1)
}

async function main(): Promise<void> {
  const [collectionPack, intake, workOrdersCsv] = await Promise.all([
    readJson(COLLECTION_PACK_PATH),
    readJson(INTAKE_PATH),
    readFile(WORK_ORDERS_CSV_PATH, 'utf8'),
  ])
  const rows: ContractRow[] = [
    { field: 'schemaVersion', required: true, rejectionRule: 'must equal dsxu.phase12-raw-log-manifest.v1' },
    { field: 'side', required: true, rejectionRule: 'must equal target-reference' },
    { field: 'source.collectedAt', required: true, rejectionRule: 'must be filled after real target run' },
    { field: 'source.acquisitionMethod', required: true, rejectionRule: 'must be manual-import or runner-export' },
    { field: 'source.immutableRawDir', required: true, rejectionRule: 'must point to immutable target-reference run output' },
    { field: 'logs[].comparisonId', required: true, rejectionRule: 'must match the collection work order comparisonId' },
    { field: 'logs[].taskId', required: true, rejectionRule: 'must match the collection work order taskId' },
    { field: 'logs[].taskPrompt', required: true, rejectionRule: 'must be the exact same-task prompt' },
    { field: 'logs[].rawLogPath', required: true, rejectionRule: 'must point to real raw transcript output' },
    { field: 'logs[].artifactPaths', required: true, rejectionRule: 'must include tool trace, final report, artifacts, metrics, and risks' },
    { field: 'logs[].evidence', required: true, rejectionRule: 'baseline/context/execution/recovery/verification/cost/final must be true' },
    { field: 'logs[].integrity', required: true, rejectionRule: 'rawTranscript/toolTrace/finalReport must be true' },
    { field: 'logs[].metrics', required: true, rejectionRule: 'elapsed/intervention/tool/evidence/cost/no-evidence metrics must be present' },
    { field: 'logs[].risks', required: true, rejectionRule: 'must list real target risks; empty is allowed only when supported by raw output' },
  ]
  const workOrderCount = countCsvRows(workOrdersCsv)
  const report = {
    schemaVersion: 'dsxu.v20.p12-target-manifest-contract-board.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: 'CONTRACT_READY_TARGET_MANIFEST_STILL_REQUIRED',
    workOrderCount,
    requiredMinimumPairedRawLogsForPass: collectionPack.minimumPairedRawLogsForPass ?? 14,
    currentAcceptedTargetLogs: intake.acceptedLogCount ?? 0,
    didFabricateTargetLogs: false,
    didImportTargetManifest: false,
    rows,
    blockers: [
      'targetReferenceManifestPath is still missing',
      'target-reference manifest template and work orders do not count as raw evidence',
    ],
    nextAction: 'collect real target-reference outputs for all work orders, fill manifest, then run p12:target-intake and p12:raw-readiness',
    rule:
      'This contract board is not raw evidence and not a P12 PASS. It only freezes the target-reference manifest acceptance contract.',
  }
  const headers = ['field', 'required', 'rejectionRule']
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(
      OUTPUT_CSV_PATH,
      [
        headers.map(csvEscape).join(','),
        ...rows.map(row => headers.map(header => csvEscape(row[header as keyof ContractRow])).join(',')),
      ].join('\n') + '\n',
    ),
  ])
  console.log(JSON.stringify({
    status: report.status,
    workOrderCount: report.workOrderCount,
    currentAcceptedTargetLogs: report.currentAcceptedTargetLogs,
    didFabricateTargetLogs: report.didFabricateTargetLogs,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
