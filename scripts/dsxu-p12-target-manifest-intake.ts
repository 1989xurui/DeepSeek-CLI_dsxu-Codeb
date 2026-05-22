import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, isAbsolute, join, resolve } from 'path'
import {
  validateP12RawLogManifest,
  type P12RawTaskLog,
} from '../src/dsxu/engine/phase12-raw-comparison-v1'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_INTAKE_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_INTAKE_20260515.csv')

type P12TargetManifestIntakeOptions = {
  targetReferenceManifestPath?: string
  help: boolean
}

type P12TargetManifestLogRow = {
  index: number
  comparisonId: string
  taskId: string
  side: string
  rawLogPath: string
  rawLogExists: boolean
  artifactCount: number
  artifactExistsCount: number
  evidenceComplete: boolean
  integrityComplete: boolean
  metricsComplete: boolean
  riskCount: number
  status: string
}

type P12TargetManifestIntake = {
  schemaVersion: 'dsxu.v20.p12-target-manifest-intake.v1'
  generatedAt: string
  status:
    | 'BLOCKED_MISSING_TARGET_REFERENCE_MANIFEST'
    | 'BLOCKED_INVALID_TARGET_REFERENCE_MANIFEST'
    | 'READY_FOR_RAW_READINESS_IMPORT'
  targetReferenceManifestPath: string | null
  acceptedLogCount: number
  rejectedLogCount: number
  rawLogExistsCount: number
  artifactExistsCount: number
  requiredMinimumPairedRawLogsForPass: 14
  didFabricateTargetLogs: false
  didRunComparison: false
  rows: readonly P12TargetManifestLogRow[]
  blockers: readonly string[]
  requiredManifestContract: {
    schemaVersion: 'dsxu.phase12-raw-log-manifest.v1'
    side: 'target-reference'
    requiredLogFields: readonly string[]
    requiredEvidenceFields: readonly string[]
    requiredIntegrityFields: readonly string[]
    requiredMetricFields: readonly string[]
  }
  nextAction: string
  rule: string
}

function usage(): string {
  return [
    'DSXU P12 target-reference manifest intake preflight',
    '',
    'Usage:',
    '  bun run scripts/dsxu-p12-target-manifest-intake.ts [--targetReferenceManifestPath <path>]',
    '',
    'Rules:',
    '  - This script validates intake only.',
    '  - It never fabricates target-reference logs.',
    '  - It does not run final P12 comparison.',
  ].join('\n')
}

function parseArgs(args: string[]): P12TargetManifestIntakeOptions {
  const options: P12TargetManifestIntakeOptions = { help: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--targetReferenceManifestPath' || arg === '--target-reference-manifest') {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a path value`)
      options.targetReferenceManifestPath = value
      index += 1
      continue
    }
    if (arg.startsWith('--targetReferenceManifestPath=')) {
      options.targetReferenceManifestPath = arg.slice('--targetReferenceManifestPath='.length)
      continue
    }
    if (arg.startsWith('--target-reference-manifest=')) {
      options.targetReferenceManifestPath = arg.slice('--target-reference-manifest='.length)
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

function toCsv(rows: readonly P12TargetManifestLogRow[]): string {
  const headers = [
    'index',
    'comparisonId',
    'taskId',
    'side',
    'rawLogPath',
    'rawLogExists',
    'artifactCount',
    'artifactExistsCount',
    'evidenceComplete',
    'integrityComplete',
    'metricsComplete',
    'riskCount',
    'status',
  ]
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header as keyof P12TargetManifestLogRow])).join(',')),
  ].join('\n') + '\n'
}

function requiredManifestContract(): P12TargetManifestIntake['requiredManifestContract'] {
  return {
    schemaVersion: 'dsxu.phase12-raw-log-manifest.v1',
    side: 'target-reference',
    requiredLogFields: [
      'comparisonId',
      'taskId',
      'side',
      'taskPrompt',
      'rawLogPath',
      'artifactPaths',
      'outcome',
      'evidence',
      'integrity',
      'metrics',
      'risks',
    ],
    requiredEvidenceFields: ['baseline', 'context', 'execution', 'recovery', 'verification', 'cost', 'final'],
    requiredIntegrityFields: ['rawTranscript', 'toolTrace', 'finalReport'],
    requiredMetricFields: [
      'elapsedMs',
      'interventionCount',
      'toolCallCount',
      'evidenceCompletenessPct',
      'costUsd',
      'noEvidenceActionCount',
    ],
  }
}

function resolveEvidencePath(inputPath: string, manifestPath: string, immutableRawDir?: string): string {
  if (isAbsolute(inputPath)) return inputPath
  if (immutableRawDir && !immutableRawDir.includes('<')) {
    const base = isAbsolute(immutableRawDir) ? immutableRawDir : resolve(dirname(manifestPath), immutableRawDir)
    return resolve(base, inputPath)
  }
  return resolve(dirname(manifestPath), inputPath)
}

function allTrue(record: Record<string, boolean>): boolean {
  return Object.values(record).every(value => value === true)
}

function metricsComplete(log: P12RawTaskLog): boolean {
  return (
    typeof log.metrics.interventionCount === 'number' &&
    typeof log.metrics.toolCallCount === 'number' &&
    typeof log.metrics.evidenceCompletenessPct === 'number' &&
    typeof log.metrics.noEvidenceActionCount === 'number'
  )
}

function rowFromLog(log: P12RawTaskLog, index: number, manifestPath: string, immutableRawDir?: string): P12TargetManifestLogRow {
  const resolvedRawLogPath = resolveEvidencePath(log.rawLogPath, manifestPath, immutableRawDir)
  const artifactExistence = log.artifactPaths.map(item => existsSync(resolveEvidencePath(item, manifestPath, immutableRawDir)))
  const evidenceComplete = allTrue(log.evidence)
  const integrityComplete = allTrue(log.integrity)
  const metricsOk = metricsComplete(log)
  const rawLogExists = existsSync(resolvedRawLogPath)
  const artifactExistsCount = artifactExistence.filter(Boolean).length
  const status = rawLogExists &&
    log.artifactPaths.length > 0 &&
    artifactExistsCount === log.artifactPaths.length &&
    evidenceComplete &&
    integrityComplete &&
    metricsOk &&
    log.risks.length >= 0
    ? 'READY'
    : 'BLOCKED_MISSING_RAW_OR_ARTIFACT'
  return {
    index,
    comparisonId: log.comparisonId,
    taskId: log.taskId,
    side: log.side,
    rawLogPath: log.rawLogPath,
    rawLogExists,
    artifactCount: log.artifactPaths.length,
    artifactExistsCount,
    evidenceComplete,
    integrityComplete,
    metricsComplete: metricsOk,
    riskCount: log.risks.length,
    status,
  }
}

async function buildReport(options: P12TargetManifestIntakeOptions): Promise<P12TargetManifestIntake> {
  const contract = requiredManifestContract()
  if (!options.targetReferenceManifestPath) {
    return {
      schemaVersion: 'dsxu.v20.p12-target-manifest-intake.v1',
      generatedAt: new Date().toISOString(),
      status: 'BLOCKED_MISSING_TARGET_REFERENCE_MANIFEST',
      targetReferenceManifestPath: null,
      acceptedLogCount: 0,
      rejectedLogCount: 0,
      rawLogExistsCount: 0,
      artifactExistsCount: 0,
      requiredMinimumPairedRawLogsForPass: 14,
      didFabricateTargetLogs: false,
      didRunComparison: false,
      rows: [],
      blockers: ['targetReferenceManifestPath is required before P12 can move toward PASS'],
      requiredManifestContract: contract,
      nextAction: 'provide a real targetReferenceManifestPath with same-task target-reference raw transcript, tool trace, final report, artifacts, metrics, and risks',
      rule: 'This intake preflight does not accept templates, generic logs, target-only logs, dry plans, or DSXU-side logs as target-reference evidence.',
    }
  }
  const manifestPath = resolve(options.targetReferenceManifestPath)
  if (!existsSync(manifestPath)) {
    return {
      schemaVersion: 'dsxu.v20.p12-target-manifest-intake.v1',
      generatedAt: new Date().toISOString(),
      status: 'BLOCKED_INVALID_TARGET_REFERENCE_MANIFEST',
      targetReferenceManifestPath: manifestPath,
      acceptedLogCount: 0,
      rejectedLogCount: 0,
      rawLogExistsCount: 0,
      artifactExistsCount: 0,
      requiredMinimumPairedRawLogsForPass: 14,
      didFabricateTargetLogs: false,
      didRunComparison: false,
      rows: [],
      blockers: [`targetReferenceManifestPath does not exist: ${manifestPath}`],
      requiredManifestContract: contract,
      nextAction: 'provide an existing target-reference manifest path',
      rule: 'This intake preflight does not create or repair target-reference manifests.',
    }
  }
  const manifest = JSON.parse((await readFile(manifestPath, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
  const validation = validateP12RawLogManifest(manifest)
  const immutableRawDir = typeof (manifest.source as { immutableRawDir?: unknown } | undefined)?.immutableRawDir === 'string'
    ? (manifest.source as { immutableRawDir: string }).immutableRawDir
    : undefined
  const rows = validation.acceptedLogs.map((log, index) => rowFromLog(log, index, manifestPath, immutableRawDir))
  const blockedRows = rows.filter(row => row.status !== 'READY')
  const blockers = [
    ...(validation.side !== 'target-reference' ? ['manifest side must be target-reference'] : []),
    ...validation.redlines,
    ...blockedRows.map(row => `log ${row.index}: missing local raw/artifact evidence for ${row.comparisonId}`),
    ...(validation.acceptedLogs.length < 14 ? [`accepted target-reference raw logs are below minimum: ${validation.acceptedLogs.length}/14`] : []),
  ]
  return {
    schemaVersion: 'dsxu.v20.p12-target-manifest-intake.v1',
    generatedAt: new Date().toISOString(),
    status: blockers.length === 0 ? 'READY_FOR_RAW_READINESS_IMPORT' : 'BLOCKED_INVALID_TARGET_REFERENCE_MANIFEST',
    targetReferenceManifestPath: manifestPath,
    acceptedLogCount: validation.acceptedLogs.length,
    rejectedLogCount: validation.rejectedLogs.length,
    rawLogExistsCount: rows.filter(row => row.rawLogExists).length,
    artifactExistsCount: rows.reduce((sum, row) => sum + row.artifactExistsCount, 0),
    requiredMinimumPairedRawLogsForPass: 14,
    didFabricateTargetLogs: false,
    didRunComparison: false,
    rows,
    blockers,
    requiredManifestContract: contract,
    nextAction: blockers.length === 0
      ? 'run p12:raw-readiness with this targetReferenceManifestPath'
      : 'fix the manifest and raw evidence paths before P12 raw readiness import',
    rule: 'This intake preflight validates target-reference raw inputs only. It never fabricates target logs or marks P12 PASS.',
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  const report = await buildReport(options)
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(OUTPUT_CSV_PATH, toCsv(report.rows)),
  ])
  console.log(JSON.stringify({
    status: report.status,
    acceptedLogCount: report.acceptedLogCount,
    rejectedLogCount: report.rejectedLogCount,
    rawLogExistsCount: report.rawLogExistsCount,
    artifactExistsCount: report.artifactExistsCount,
    didFabricateTargetLogs: report.didFabricateTargetLogs,
    didRunComparison: report.didRunComparison,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
