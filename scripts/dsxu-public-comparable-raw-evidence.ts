#!/usr/bin/env bun

import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import {
  buildPublicComparableRawEvidenceReadiness,
  type PublicComparableBenchmarkManifest,
  type PublicComparableRawEvidenceCase,
  type PublicComparableRawEvidenceField,
  type PublicComparableRawEvidenceManifest,
} from '../src/dsxu/engine/raw-evidence-readiness-register-v1'

type CollectorStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

type CollectorOptions = {
  root?: string
  manifestPath?: string
  rawRoot?: string
  outputPath?: string
  reportPath?: string
  write?: boolean
}

type CollectionPackOptions = CollectorOptions & {
  collectionReportPath?: string
}

type CliOptions = CollectorOptions & {
  scaffold?: boolean
  collectionReportPath?: string
}

type ImportCaseReport = {
  id: string
  status: CollectorStatus
  imported: boolean
  foundFields: readonly string[]
  missingFields: readonly PublicComparableRawEvidenceField[]
  missingExternalTargetFields: readonly string[]
  externalTargetRedlines: readonly string[]
  redlines: readonly string[]
  caseDir: string
}

type PublicComparableRawEvidenceImportReport = {
  schemaVersion: 'dsxu.public-comparable-raw-evidence-import-report.v1'
  generatedAt: string
  status: CollectorStatus
  manifestPath: string
  rawRoot: string
  rawManifestPath: string
  rawManifestWritten: boolean
  acquisitionMethod: 'manual-import'
  caseCount: number
  importedCaseCount: number
  readyCaseCount: number
  partialCaseCount: number
  missingCaseCount: number
  externalTargetReadyCount: number
  publicBenchmarkClaimAllowed: boolean
  externalComparisonClaimAllowed: boolean
  nextAction: string
  safeguards: readonly string[]
  cases: readonly ImportCaseReport[]
}

type CollectionCaseReport = {
  id: string
  status: 'READY_COLLECTION_CASE_NO_RAW_EVIDENCE'
  caseDir: string
  workOrderPath: string
  metricsTemplatePath: string
  readmePath: string
  expectedPromptHashPath: string
  rawEvidenceWritten: false
}

type PublicComparableCollectionPackReport = {
  schemaVersion: 'dsxu.public-comparable-collection-pack.v1'
  generatedAt: string
  status: 'READY_COLLECTION_PACK_NO_RAW_EVIDENCE'
  manifestPath: string
  rawRoot: string
  caseCount: number
  createdCaseCount: number
  rawEvidenceWritten: false
  publicBenchmarkClaimAllowed: false
  externalComparisonClaimAllowed: false
  nextAction: 'collect-public-comparable-raw-evidence'
  safeguards: readonly string[]
  cases: readonly CollectionCaseReport[]
}

const DATE = '20260518'
const REPORT_DATE = '20260520'
const RAW_FILE_CANDIDATES = ['raw-transcript.jsonl', 'dsxu.raw.jsonl', 'transcript.jsonl', 'transcript.ndjson']
const TOOL_TRACE_CANDIDATES = ['tool-trace.jsonl', 'tool-trace.json', 'trace.jsonl', 'trace.json']
const RAW_API_CANDIDATES = ['raw-api-response.json', 'raw-api.json', 'api-response.json']
const TARGET_REFERENCE_CANDIDATES = [
  'target-reference-transcript.jsonl',
  'target-reference.raw.jsonl',
  'target.raw.jsonl',
  'reference-transcript.jsonl',
]
const FINAL_REPORT_CANDIDATES = ['final-report.json', 'final-report.md', 'report.json', 'report.md']
const METRICS_CANDIDATES = ['metrics.json', 'score.json', 'result.json']

export async function scaffoldPublicComparableRawEvidenceCollection(
  options: CollectionPackOptions = {},
): Promise<PublicComparableCollectionPackReport> {
  const root = resolve(options.root ?? process.cwd())
  const manifestPath = resolve(root, options.manifestPath ?? join('docs', 'generated', `DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_${DATE}.json`))
  const rawRoot = resolve(root, options.rawRoot ?? join('.dsxu', 'trace', 'public-comparable-raw-evidence'))
  const collectionReportPath = resolve(root, options.collectionReportPath ?? join('docs', 'generated', `DSXU_PUBLIC_COMPARABLE_COLLECTION_PACK_${REPORT_DATE}.json`))
  const write = options.write ?? true
  const manifest = parseManifest(await readJson(manifestPath))
  const cases: CollectionCaseReport[] = []

  for (const manifestCase of manifest.cases) {
    const caseDir = join(rawRoot, manifestCase.id)
    const artifactDir = join(caseDir, 'artifacts')
    const workOrderPath = join(caseDir, 'work-order.json')
    const metricsTemplatePath = join(caseDir, 'metrics.template.json')
    const readmePath = join(caseDir, 'README.md')
    const expectedPromptHashPath = join(caseDir, 'prompt-hash.expected.txt')
    if (write) {
      await mkdir(artifactDir, { recursive: true })
      await Promise.all([
        writeJson(workOrderPath, buildWorkOrder(root, manifest, manifestCase, caseDir)),
        writeJson(metricsTemplatePath, buildMetricsTemplate(manifestCase)),
        writeFile(readmePath, buildCaseReadme(manifestCase), 'utf8'),
        writeFile(expectedPromptHashPath, `${manifestCase.promptHash}\n`, 'utf8'),
      ])
    }
    cases.push({
      id: manifestCase.id,
      status: 'READY_COLLECTION_CASE_NO_RAW_EVIDENCE',
      caseDir: toEvidencePath(root, caseDir),
      workOrderPath: toEvidencePath(root, workOrderPath),
      metricsTemplatePath: toEvidencePath(root, metricsTemplatePath),
      readmePath: toEvidencePath(root, readmePath),
      expectedPromptHashPath: toEvidencePath(root, expectedPromptHashPath),
      rawEvidenceWritten: false,
    })
  }

  const report: PublicComparableCollectionPackReport = {
    schemaVersion: 'dsxu.public-comparable-collection-pack.v1',
    generatedAt: new Date().toISOString(),
    status: 'READY_COLLECTION_PACK_NO_RAW_EVIDENCE',
    manifestPath: toEvidencePath(root, manifestPath),
    rawRoot: toEvidencePath(root, rawRoot),
    caseCount: manifest.cases.length,
    createdCaseCount: cases.length,
    rawEvidenceWritten: false,
    publicBenchmarkClaimAllowed: false,
    externalComparisonClaimAllowed: false,
    nextAction: 'collect-public-comparable-raw-evidence',
    safeguards: [
      'collection pack creates work orders and templates only; it does not create metrics.json, transcripts, api responses, or final reports',
      'metrics.template.json is intentionally ignored by the raw-evidence importer',
      'prompt-hash.expected.txt is an expected value for operators, not proof of executed raw evidence',
      'public benchmark and external comparison claims remain blocked until real per-case raw artifacts are imported',
    ],
    cases,
  }

  if (write) await writeJson(collectionReportPath, report)
  return report
}

export async function collectPublicComparableRawEvidence(
  options: CollectorOptions = {},
): Promise<PublicComparableRawEvidenceImportReport> {
  const root = resolve(options.root ?? process.cwd())
  const manifestPath = resolve(root, options.manifestPath ?? join('docs', 'generated', `DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_${DATE}.json`))
  const rawRoot = resolve(root, options.rawRoot ?? join('.dsxu', 'trace', 'public-comparable-raw-evidence'))
  const outputPath = resolve(root, options.outputPath ?? join('docs', 'generated', `DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_${DATE}.json`))
  const reportPath = resolve(root, options.reportPath ?? join('docs', 'generated', `DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_${REPORT_DATE}.json`))
  const write = options.write ?? true
  const manifest = parseManifest(await readJson(manifestPath))
  const importedCases: PublicComparableRawEvidenceCase[] = []

  for (const manifestCase of manifest.cases) {
    const rawCase = await importCase(root, rawRoot, manifestCase)
    if (hasCollectedEvidence(rawCase)) importedCases.push(rawCase)
  }

  const rawManifest: PublicComparableRawEvidenceManifest = {
    schemaVersion: 'dsxu.public-comparable-raw-evidence.v1',
    source: {
      collectedAt: new Date().toISOString(),
      acquisitionMethod: 'manual-import',
      immutableRawDir: toEvidencePath(root, rawRoot),
    },
    cases: importedCases,
  }
  const readiness = buildPublicComparableRawEvidenceReadiness({
    manifest,
    rawEvidenceManifest: rawManifest,
    artifactRoot: root,
  })
  const reportCases: ImportCaseReport[] = readiness.cases.map(item => {
    const rawCase = importedCases.find(candidate => candidate.id === item.id)
    return {
      id: item.id,
      status: item.status,
      imported: rawCase !== undefined,
      foundFields: rawCase ? collectedFieldNames(rawCase) : [],
      missingFields: item.missingFields,
      missingExternalTargetFields: item.missingExternalTargetFields,
      externalTargetRedlines: item.externalTargetRedlines,
      redlines: item.redlines,
      caseDir: toEvidencePath(root, join(rawRoot, item.id)),
    }
  })
  const status: CollectorStatus = readiness.publicBenchmarkClaimAllowed
    ? 'PASS'
    : importedCases.length > 0
      ? 'PARTIAL'
      : 'BLOCKED'
  const shouldWriteManifest = write && importedCases.length > 0
  const report: PublicComparableRawEvidenceImportReport = {
    schemaVersion: 'dsxu.public-comparable-raw-evidence-import-report.v1',
    generatedAt: new Date().toISOString(),
    status,
    manifestPath: toEvidencePath(root, manifestPath),
    rawRoot: toEvidencePath(root, rawRoot),
    rawManifestPath: toEvidencePath(root, outputPath),
    rawManifestWritten: shouldWriteManifest,
    acquisitionMethod: 'manual-import',
    caseCount: readiness.caseCount,
    importedCaseCount: importedCases.length,
    readyCaseCount: readiness.readyCaseCount,
    partialCaseCount: readiness.partialCaseCount,
    missingCaseCount: readiness.missingCaseCount,
    externalTargetReadyCount: readiness.externalTargetReadyCount,
    publicBenchmarkClaimAllowed: readiness.publicBenchmarkClaimAllowed,
    externalComparisonClaimAllowed: readiness.externalComparisonClaimAllowed,
    nextAction: readiness.nextAction,
    safeguards: [
      ...readiness.safeguards,
      'collector imports existing raw artifacts only; it does not call a model or fabricate results',
      'cases without recognized raw files are reported as missing and omitted from the raw manifest',
      'promptHash must come from raw evidence metrics.json or prompt-hash.txt so readiness can reject missing or wrong-task evidence',
    ],
    cases: reportCases,
  }

  if (shouldWriteManifest) {
    await writeJson(outputPath, rawManifest)
  }
  if (write) {
    await writeJson(reportPath, report)
  }
  return report
}

async function importCase(
  root: string,
  rawRoot: string,
  manifestCase: PublicComparableBenchmarkManifest['cases'][number],
): Promise<PublicComparableRawEvidenceCase> {
  const caseDir = join(rawRoot, manifestCase.id)
  const metrics = await readFirstMetrics(caseDir)
  const rawTranscriptPath = await findFirstFile(caseDir, RAW_FILE_CANDIDATES)
  const toolTracePath = await findFirstFile(caseDir, TOOL_TRACE_CANDIDATES)
  const rawApiResponsePath = await findFirstFile(caseDir, RAW_API_CANDIDATES)
  const targetReferenceTranscriptPath = await findFirstFile(caseDir, TARGET_REFERENCE_CANDIDATES)
  const finalReportPath = await findFirstFile(caseDir, FINAL_REPORT_CANDIDATES)
  const artifactDir = await findFirstDir(caseDir, ['artifacts'])
  const artifactDirectorySize = artifactDir ? await directorySize(artifactDir) : undefined
  const artifactDirWithContent = artifactDirectorySize !== undefined && artifactDirectorySize > 0 ? artifactDir : undefined
  const promptHash = metricString(metrics.promptHash) ?? await readPromptHash(caseDir)
  const artifactLogSizeBytes = metricNumber(metrics.artifactLogSizeBytes) ??
    (artifactDirWithContent ? artifactDirectorySize : undefined)
  const toolResultChars = metricNumber(metrics.toolResultChars) ??
    (toolTracePath ? await fileCharLength(toolTracePath) : undefined)
  return omitUndefined({
    id: manifestCase.id,
    promptHash,
    rawTranscriptPath: rawTranscriptPath ? toEvidencePath(root, rawTranscriptPath) : undefined,
    toolTracePath: toolTracePath ? toEvidencePath(root, toolTracePath) : undefined,
    rawApiResponsePath: rawApiResponsePath ? toEvidencePath(root, rawApiResponsePath) : undefined,
    targetReferenceTranscriptPath: targetReferenceTranscriptPath ? toEvidencePath(root, targetReferenceTranscriptPath) : undefined,
    finalReportPath: finalReportPath ? toEvidencePath(root, finalReportPath) : undefined,
    artifactDir: artifactDirWithContent ? toEvidencePath(root, artifactDirWithContent) : undefined,
    firstAttemptPass: metricBoolean(metrics.firstAttemptPass),
    secondAttemptPass: metricBoolean(metrics.secondAttemptPass),
    finalPass: metricBoolean(metrics.finalPass),
    costUsd: metricNumber(metrics.costUsd),
    wallClockMs: metricNumber(metrics.wallClockMs),
    cacheHitRatePct: metricNumber(metrics.cacheHitRatePct),
    proAdmissionCount: metricNumber(metrics.proAdmissionCount),
    failureRecoveryEvents: metricFailureRecoveryEvents(metrics.failureRecoveryEvents),
    unavailableToolUseCount: metricNumber(metrics.unavailableToolUseCount),
    executionVisibilityBlockedCount: metricNumber(metrics.executionVisibilityBlockedCount),
    noToolUnsupportedClaimCount: metricNumber(metrics.noToolUnsupportedClaimCount),
    toolBudgetExceededCount: metricNumber(metrics.toolBudgetExceededCount),
    readBudgetExceededCount: metricNumber(metrics.readBudgetExceededCount),
    shellBudgetExceededCount: metricNumber(metrics.shellBudgetExceededCount),
    toolResultChars,
    artifactLogSizeBytes,
  })
}

function buildWorkOrder(
  root: string,
  manifest: PublicComparableBenchmarkManifest,
  manifestCase: PublicComparableBenchmarkManifest['cases'][number],
  caseDir: string,
): Record<string, unknown> {
  return {
    schemaVersion: 'dsxu.public-comparable-collection-work-order.v1',
    generatedAt: new Date().toISOString(),
    id: manifestCase.id,
    category: manifestCase.category,
    expectedModel: manifestCase.expectedModel,
    workflowKind: manifestCase.workflowKind,
    routeReason: manifestCase.routeReason,
    allowedTools: manifestCase.allowedTools,
    maxTurns: manifestCase.maxTurns,
    budgets: manifestCase.budgets,
    prompt: manifestCase.prompt,
    promptHashExpected: manifestCase.promptHash,
    rawEvidenceDirectory: toEvidencePath(root, caseDir),
    requiredRawEvidence: manifestCase.requiredRawEvidence ?? manifest.rawEvidenceFields,
    requiredOutputFiles: {
      rawTranscript: RAW_FILE_CANDIDATES,
      toolTrace: TOOL_TRACE_CANDIDATES,
      rawApiResponse: RAW_API_CANDIDATES,
      targetReferenceTranscript: TARGET_REFERENCE_CANDIDATES,
      finalReport: FINAL_REPORT_CANDIDATES,
      metrics: METRICS_CANDIDATES,
      artifactsDirectory: 'artifacts/',
    },
    metricsTemplate: 'metrics.template.json',
    scoringRubric: manifestCase.scoringRubric,
    claimBoundary: manifestCase.claimBoundary,
    executionRules: [
      'Run this exact prompt for the DSXU lane before writing raw-transcript or tool-trace artifacts.',
      'Run the same-task raw DeepSeek API baseline before writing raw-api-response artifacts.',
      'Run the same-task target/reference lane before writing target-reference transcript artifacts.',
      'Copy promptHashExpected into metrics.json only after the real evidence files exist.',
      'Do not rename metrics.template.json to metrics.json until the case has real raw evidence.',
      'Do not use target/reference transcripts for DSXU-vs-raw-API claims unless the paired external lane was actually collected.',
      'Do not claim external comparison until targetReferenceTranscriptPath is present for this exact case.',
      'If the task is blocked, write the blocker into final-report and metrics.json instead of deleting the case.',
    ],
  }
}

function buildMetricsTemplate(
  manifestCase: PublicComparableBenchmarkManifest['cases'][number],
): Record<string, unknown> {
  return {
    schemaVersion: 'dsxu.public-comparable-metrics-template.v1',
    templateOnly: true,
    promptHash: manifestCase.promptHash,
    firstAttemptPass: null,
    secondAttemptPass: null,
    finalPass: null,
    costUsd: null,
    wallClockMs: null,
    cacheHitRatePct: null,
    proAdmissionCount: null,
    failureRecoveryEvents: null,
    unavailableToolUseCount: null,
    executionVisibilityBlockedCount: null,
    noToolUnsupportedClaimCount: null,
    toolBudgetExceededCount: null,
    readBudgetExceededCount: null,
    shellBudgetExceededCount: null,
    toolResultChars: null,
    artifactLogSizeBytes: null,
    notes: 'Rename to metrics.json only after real raw evidence artifacts exist for this case.',
  }
}

function buildCaseReadme(manifestCase: PublicComparableBenchmarkManifest['cases'][number]): string {
  return [
    `# ${manifestCase.id}`,
    '',
    'This directory is a collection work area, not evidence by itself.',
    '',
    'Required before this case can be imported:',
    '- A real DSXU raw transcript file such as `raw-transcript.jsonl`.',
    '- A real DSXU tool trace file such as `tool-trace.jsonl`.',
    '- A real raw DeepSeek API response such as `raw-api-response.json`.',
    '- A real final report such as `final-report.md` or `final-report.json`.',
    '- Real artifacts under `artifacts/`.',
    '- A completed `metrics.json` copied from `metrics.template.json` after the run.',
    '',
    'Required only before external target/reference comparison claims:',
    '- A same-task target/reference transcript such as `target-reference-transcript.jsonl`.',
    '- The transcript must be collected from the target/reference lane for this exact prompt hash; placeholders, summaries, or DSXU self-runs do not count.',
    '',
    'Templates and expected prompt hashes do not unlock benchmark or external comparison claims.',
    '',
  ].join('\n')
}

function parseManifest(input: unknown): PublicComparableBenchmarkManifest {
  if (!isRecord(input)) throw new Error('public comparable manifest is not an object')
  if (input.schemaVersion !== 'dsxu.public-comparable-benchmark-manifest.v1') {
    throw new Error('public comparable manifest schemaVersion mismatch')
  }
  if (!Array.isArray(input.cases)) throw new Error('public comparable manifest cases must be an array')
  return input as PublicComparableBenchmarkManifest
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readFirstMetrics(caseDir: string): Promise<Record<string, unknown>> {
  const path = await findFirstFile(caseDir, METRICS_CANDIDATES)
  if (!path) return {}
  const parsed = await readJson(path)
  return isRecord(parsed) ? parsed : {}
}

async function readPromptHash(caseDir: string): Promise<string | undefined> {
  const path = await findFirstFile(caseDir, ['prompt-hash.txt', 'promptHash.txt'])
  if (!path) return undefined
  const value = (await readFile(path, 'utf8')).trim()
  return value.length > 0 ? value : undefined
}

async function findFirstFile(dir: string, names: readonly string[]): Promise<string | undefined> {
  for (const name of names) {
    const path = join(dir, name)
    if (existsSync(path) && (await stat(path)).isFile()) return path
  }
  return undefined
}

async function findFirstDir(dir: string, names: readonly string[]): Promise<string | undefined> {
  for (const name of names) {
    const path = join(dir, name)
    if (existsSync(path) && (await stat(path)).isDirectory()) return path
  }
  return undefined
}

async function directorySize(dir: string): Promise<number> {
  let total = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) total += await directorySize(path)
    if (entry.isFile()) total += (await stat(path)).size
  }
  return total
}

async function fileCharLength(path: string): Promise<number> {
  return (await readFile(path, 'utf8')).length
}

function toEvidencePath(root: string, path: string): string {
  const rel = relative(root, path).replace(/\\/g, '/')
  return rel.length > 0 && !rel.startsWith('..') ? rel : path.replace(/\\/g, '/')
}

function hasCollectedEvidence(rawCase: PublicComparableRawEvidenceCase): boolean {
  return collectedFieldNames(rawCase).length > 0
}

function collectedFieldNames(rawCase: PublicComparableRawEvidenceCase): string[] {
  return Object.keys(rawCase)
    .filter(key => key !== 'id' && key !== 'promptHash')
    .sort()
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function metricNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function metricBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function metricString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function metricFailureRecoveryEvents(value: unknown): number | unknown[] | undefined {
  if (Array.isArray(value)) return value
  return metricNumber(value)
}

function parseArgs(argv: readonly string[]): CliOptions {
  const values = new Map<string, string>()
  const flags = new Set<string>()
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const [key, inlineValue] = arg.slice(2).split('=', 2)
    if (inlineValue !== undefined) {
      values.set(key, inlineValue)
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      values.set(key, argv[index + 1])
      index += 1
    } else {
      flags.add(key)
    }
  }
  return {
    manifestPath: values.get('manifest'),
    rawRoot: values.get('raw-root'),
    outputPath: values.get('output'),
    reportPath: values.get('report'),
    collectionReportPath: values.get('collection-report'),
    write: !flags.has('dry-run'),
    scaffold: flags.has('scaffold'),
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (options.scaffold) {
    const report = await scaffoldPublicComparableRawEvidenceCollection(options)
    console.log(JSON.stringify({
      status: report.status,
      caseCount: report.caseCount,
      createdCaseCount: report.createdCaseCount,
      rawEvidenceWritten: report.rawEvidenceWritten,
      publicBenchmarkClaimAllowed: report.publicBenchmarkClaimAllowed,
      externalComparisonClaimAllowed: report.externalComparisonClaimAllowed,
      nextAction: report.nextAction,
    }, null, 2))
    return
  }
  const report = await collectPublicComparableRawEvidence(options)
  console.log(JSON.stringify({
    status: report.status,
    caseCount: report.caseCount,
    importedCaseCount: report.importedCaseCount,
    readyCaseCount: report.readyCaseCount,
    partialCaseCount: report.partialCaseCount,
    missingCaseCount: report.missingCaseCount,
    publicBenchmarkClaimAllowed: report.publicBenchmarkClaimAllowed,
    externalComparisonClaimAllowed: report.externalComparisonClaimAllowed,
    rawManifestWritten: report.rawManifestWritten,
    rawManifestPath: report.rawManifestPath,
    nextAction: report.nextAction,
  }, null, 2))
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
