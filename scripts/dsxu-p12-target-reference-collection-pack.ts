import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { runP12TargetReferenceCollectionHarness } from '../src/dsxu/integration/harness/p12-target-reference-collection-v1-harness'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_COLLECTION_PACK_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_COLLECTION_WORK_ORDERS_20260515.csv')

type P12TargetCollectionOptions = {
  evidenceDir?: string
  help: boolean
}

function usage(): string {
  return [
    'DSXU P12 target-reference collection pack',
    '',
    'Usage:',
    '  bun run scripts/dsxu-p12-target-reference-collection-pack.ts [--evidenceDir <path>]',
    '',
    'Rules:',
    '  - Generates collection work orders and an empty manifest template only.',
    '  - Does not fabricate target-reference raw logs.',
    '  - Does not mark P12 ready or PASS.',
  ].join('\n')
}

function parseArgs(args: string[]): P12TargetCollectionOptions {
  const options: P12TargetCollectionOptions = { help: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--evidenceDir') {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) throw new Error('--evidenceDir requires a path value')
      options.evidenceDir = value
      index += 1
      continue
    }
    if (arg.startsWith('--evidenceDir=')) {
      options.evidenceDir = arg.slice('--evidenceDir='.length)
      continue
    }
    throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  const result = await runP12TargetReferenceCollectionHarness({
    evidenceDir: options.evidenceDir ? resolve(options.evidenceDir) : undefined,
  })
  const rows = result.collectionWorkOrders.map(order => ({
    workOrderId: order.workOrderId,
    kind: order.kind,
    familyId: order.familyId ?? '',
    mustUseExistingOwner: order.mustUseExistingOwner,
    comparisonIdRequirement: order.comparisonIdRequirement,
    taskIdRequirement: order.taskIdRequirement,
    targetReferenceRawOutputRequirement: order.targetReferenceRawOutputRequirement,
  }))
  const headers = [
    'workOrderId',
    'kind',
    'familyId',
    'mustUseExistingOwner',
    'comparisonIdRequirement',
    'taskIdRequirement',
    'targetReferenceRawOutputRequirement',
  ]
  const summary = {
    schemaVersion: 'dsxu.v20.p12-target-collection-pack-cli.v1',
    generatedAt: new Date().toISOString(),
    status: 'READY_FOR_REAL_TARGET_REFERENCE_COLLECTION_NOT_EVIDENCE',
    taskCount: result.taskCount,
    workOrderCount: result.collectionWorkOrders.length,
    expansionBacklogCount: result.expansionBacklog.length,
    targetManifestBacklogSlotCount: result.targetManifestBacklogSlots.length,
    minimumPairedRawLogsForPass: result.minimumPairedRawLogsForPass,
    pairedRawLogCount: result.pairedRawLogCount,
    requiredAdditionalSameTaskPairCount: result.requiredAdditionalSameTaskPairCount,
    currentPackCanReachPass: result.currentPackCanReachPass,
    mustNotClaimComparisonWin: result.mustNotClaimComparisonWin,
    evidencePath: result.evidencePath,
    manifestTemplatePath: result.manifestTemplatePath,
    runbookPath: result.runbookPath,
    tracePath: result.tracePath,
    didFabricateTargetLogs: false,
    didImportTargetManifest: false,
    nextAction: 'fill target-reference-manifest.template.json only with real same-task target-reference outputs, then run p12:target-intake and p12:raw-readiness',
    rule: 'The collection pack and template are not target-reference raw evidence and do not count toward P12 PASS.',
  }
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(summary, null, 2) + '\n'),
    writeFile(
      OUTPUT_CSV_PATH,
      [
        headers.map(csvEscape).join(','),
        ...rows.map(row => headers.map(header => csvEscape(row[header as keyof typeof row])).join(',')),
      ].join('\n') + '\n',
    ),
  ])
  console.log(JSON.stringify({
    status: summary.status,
    workOrderCount: summary.workOrderCount,
    targetManifestBacklogSlotCount: summary.targetManifestBacklogSlotCount,
    pairedRawLogCount: summary.pairedRawLogCount,
    didFabricateTargetLogs: summary.didFabricateTargetLogs,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
