import { existsSync } from 'fs'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { dirname, isAbsolute, join, resolve } from 'path'
import {
  validateP12RawLogManifest,
  type P12RawTaskLog,
} from '../src/dsxu/engine/phase12-raw-comparison-v1'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_DISCOVERY_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_P12_TARGET_MANIFEST_DISCOVERY_20260515.csv')

type DiscoveryCandidate = {
  path: string
  status: 'READY' | 'BLOCKED'
  side: string
  acceptedLogCount: number
  rejectedLogCount: number
  readyLogCount: number
  rawLogExistsCount: number
  artifactCount: number
  artifactExistsCount: number
  redlineCount: number
  reason: string
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(path))
      continue
    }
    if (
      entry.isFile() &&
      /target-reference.*manifest.*\.json$/i.test(entry.name) &&
      !/template/i.test(entry.name)
    ) {
      files.push(path)
    }
  }
  return files
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function resolveEvidencePath(inputPath: string, manifestPath: string, immutableRawDir?: string): string {
  if (isAbsolute(inputPath)) return inputPath
  if (immutableRawDir && !immutableRawDir.includes('<')) {
    const base = isAbsolute(immutableRawDir) ? immutableRawDir : resolve(dirname(manifestPath), immutableRawDir)
    return resolve(base, inputPath)
  }
  return resolve(dirname(manifestPath), inputPath)
}

function isLogEvidenceReady(log: P12RawTaskLog, manifestPath: string, immutableRawDir?: string): {
  rawLogExists: boolean
  artifactCount: number
  artifactExistsCount: number
  ready: boolean
} {
  const rawLogExists = existsSync(resolveEvidencePath(log.rawLogPath, manifestPath, immutableRawDir))
  const artifactExistsCount = log.artifactPaths
    .map(path => existsSync(resolveEvidencePath(path, manifestPath, immutableRawDir)))
    .filter(Boolean).length
  const evidenceComplete = Object.values(log.evidence).every(value => value === true)
  const integrityComplete = Object.values(log.integrity).every(value => value === true)
  const metricsComplete =
    typeof log.metrics.interventionCount === 'number' &&
    typeof log.metrics.toolCallCount === 'number' &&
    typeof log.metrics.evidenceCompletenessPct === 'number' &&
    typeof log.metrics.noEvidenceActionCount === 'number'
  return {
    rawLogExists,
    artifactCount: log.artifactPaths.length,
    artifactExistsCount,
    ready:
      rawLogExists &&
      log.artifactPaths.length > 0 &&
      artifactExistsCount === log.artifactPaths.length &&
      evidenceComplete &&
      integrityComplete &&
      metricsComplete,
  }
}

async function candidateFromPath(path: string): Promise<DiscoveryCandidate> {
  try {
    const manifest = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
    const validation = validateP12RawLogManifest(manifest)
    const immutableRawDir = typeof (manifest.source as { immutableRawDir?: unknown } | undefined)?.immutableRawDir === 'string'
      ? (manifest.source as { immutableRawDir: string }).immutableRawDir
      : undefined
    const logStates = validation.acceptedLogs.map(log => isLogEvidenceReady(log, path, immutableRawDir))
    const readyLogCount = logStates.filter(log => log.ready).length
    const rawLogExistsCount = logStates.filter(log => log.rawLogExists).length
    const artifactCount = logStates.reduce((sum, log) => sum + log.artifactCount, 0)
    const artifactExistsCount = logStates.reduce((sum, log) => sum + log.artifactExistsCount, 0)
    const ready =
      validation.side === 'target-reference' &&
      validation.acceptedLogs.length >= 14 &&
      validation.redlines.length === 0 &&
      readyLogCount === validation.acceptedLogs.length
    return {
      path: resolve(path),
      status: ready ? 'READY' : 'BLOCKED',
      side: validation.side,
      acceptedLogCount: validation.acceptedLogs.length,
      rejectedLogCount: validation.rejectedLogs.length,
      readyLogCount,
      rawLogExistsCount,
      artifactCount,
      artifactExistsCount,
      redlineCount: validation.redlines.length,
      reason: ready
        ? 'valid target-reference manifest with >=14 ready logs and all local raw/artifact evidence present'
        : 'candidate does not satisfy target-reference manifest contract',
    }
  } catch (error) {
    return {
      path: resolve(path),
      status: 'BLOCKED',
      side: 'UNKNOWN',
      acceptedLogCount: 0,
      rejectedLogCount: 0,
      readyLogCount: 0,
      rawLogExistsCount: 0,
      artifactCount: 0,
      artifactExistsCount: 0,
      redlineCount: 1,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

function sortCandidates(left: DiscoveryCandidate, right: DiscoveryCandidate): number {
  return (
    Number(right.status === 'READY') - Number(left.status === 'READY') ||
    right.readyLogCount - left.readyLogCount ||
    right.acceptedLogCount - left.acceptedLogCount ||
    right.artifactExistsCount - left.artifactExistsCount ||
    left.path.localeCompare(right.path)
  )
}

async function main(): Promise<void> {
  const searchRoots = [
    join(process.cwd(), '.dsxu', 'trace'),
    join(process.cwd(), 'docs', 'generated'),
  ].filter(path => existsSync(path))
  const candidatePaths = [...new Set((await Promise.all(searchRoots.map(walk))).flat())]
  const candidates = (await Promise.all(candidatePaths.map(candidateFromPath))).sort(sortCandidates)
  const canonical = candidates.find(candidate => candidate.status === 'READY') ?? null
  const report = {
    schemaVersion: 'dsxu.v20.p12-target-manifest-discovery.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: canonical ? 'READY_TARGET_REFERENCE_MANIFEST_DISCOVERED' : 'BLOCKED_NO_VALID_TARGET_REFERENCE_MANIFEST',
    searchRoots,
    candidateCount: candidates.length,
    readyCandidateCount: candidates.filter(candidate => candidate.status === 'READY').length,
    canonicalTargetReferenceManifestPath: canonical?.path ?? null,
    canonicalAcceptedLogCount: canonical?.acceptedLogCount ?? 0,
    didFabricateTargetLogs: false,
    didRunComparison: false,
    candidates,
    nextAction: canonical
      ? 'run p12:target-intake and p12:raw-readiness with canonicalTargetReferenceManifestPath'
      : 'collect real target-reference outputs and rerun discovery',
    rule:
      'Discovery only validates existing local evidence. It does not create, repair, fabricate, or import target-reference logs.',
  }
  const headers = [
    'path',
    'status',
    'side',
    'acceptedLogCount',
    'rejectedLogCount',
    'readyLogCount',
    'rawLogExistsCount',
    'artifactCount',
    'artifactExistsCount',
    'redlineCount',
    'reason',
  ]
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(
      OUTPUT_CSV_PATH,
      [
        headers.map(csvEscape).join(','),
        ...candidates.map(row => headers.map(header => csvEscape(row[header as keyof DiscoveryCandidate])).join(',')),
      ].join('\n') + '\n',
    ),
  ])
  console.log(JSON.stringify({
    status: report.status,
    candidateCount: report.candidateCount,
    readyCandidateCount: report.readyCandidateCount,
    canonicalTargetReferenceManifestPath: report.canonicalTargetReferenceManifestPath,
    canonicalAcceptedLogCount: report.canonicalAcceptedLogCount,
    didFabricateTargetLogs: report.didFabricateTargetLogs,
    didRunComparison: report.didRunComparison,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
