import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, lstat, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import {
  buildV18OpenSourcePackageGate,
  shouldShipCleanExportManifestEntry,
} from '../src/dsxu/engine/open-source-package-gate'

type ExportedFile = {
  path: string
  sizeBytes: number
}

type ReleaseSurfacePolicy = {
  status: 'PASS_RELEASE_SURFACE_POLICY_APPLIED' | 'FAIL_RELEASE_SURFACE_POLICY'
  candidateFileCount: number
  shippedFileCount: number
  excludedFileCount: number
  rewriteOrExcludeCount: number
  pendingDeleteCount: number
  releaseBlockerCount: number
  internalEvidenceExcludedCount: number
  publicDocsShippedCount: number
  blockedPaths: string[]
  sampleExcludedInternalEvidence: string[]
}

type SecretScan = {
  status: 'PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT' | 'FAIL_SECRET_VALUE_IN_EXPORT'
  scannedFileCount: number
  activeEnvSecretNamesPresent: string[]
  forbiddenPathMatches: string[]
  matchedEnvSecretNames: string[]
}

const ROOT = process.cwd()
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const EXPORT_ROOT = resolve(
  process.env.DSXU_V24_EXPORT_ROOT ??
    join(dirname(ROOT), 'DSXU-code-release-artifacts'),
)
const OUT_JSON = join(GENERATED_DIR, 'DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json')
const OUT_MD = join(ROOT, 'docs', 'DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.md')
const CLEAN_PREFLIGHT = join(GENERATED_DIR, 'DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json')
const SIX_STAGE = join(GENERATED_DIR, 'DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json')
const PRODUCT_BENCHMARK = join(GENERATED_DIR, 'DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json')

function safeTime(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
}

async function runCommand(command: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(command, {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

function normalizeGitPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
}

function isExcluded(path: string): boolean {
  const normalized = normalizeGitPath(path)
  if (!normalized || normalized.includes('\0')) return true
  const lower = normalized.toLowerCase()
  return lower === '.git' ||
    lower.startsWith('.git/') ||
    lower === '.dsxu' ||
    lower.startsWith('.dsxu/') ||
    lower === 'node_modules' ||
    lower.startsWith('node_modules/') ||
    lower === 'outputs' ||
    lower.startsWith('outputs/') ||
    lower === '.dsevo' ||
    lower.startsWith('.dsevo/') ||
    lower === '.trash' ||
    lower.startsWith('.trash/') ||
    lower === 'tmp' ||
    lower.startsWith('tmp/') ||
    lower === 'undefined' ||
    lower.startsWith('undefined/') ||
    lower === '.env' ||
    (lower.startsWith('.env.') && lower !== '.env.example') ||
    lower.endsWith('.backup')
}

async function collectFiles(): Promise<string[]> {
  const result = await runCommand(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  if (result.exitCode !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr || result.stdout}`)
  }
  const seen = new Set<string>()
  for (const raw of result.stdout.split('\0')) {
    const normalized = normalizeGitPath(raw)
    if (!normalized || isExcluded(normalized)) continue
    seen.add(normalized)
  }
  return [...seen].sort((left, right) => left.localeCompare(right))
}

async function filterPresentFiles(files: readonly string[]): Promise<string[]> {
  const present: string[] = []
  for (const file of files) {
    if (existsSync(resolve(ROOT, file))) present.push(file)
  }
  return present
}

async function applyReleaseSurfacePolicy(files: readonly string[]): Promise<{
  filesToShip: string[]
  policy: ReleaseSurfacePolicy
}> {
  const presentFiles = await filterPresentFiles(files)
  const gate = buildV18OpenSourcePackageGate({
    trackedFiles: files,
    presentFiles,
    nowIso: new Date().toISOString(),
  })
  const filesToShip = gate.cleanExportManifest
    .filter(shouldShipCleanExportManifestEntry)
    .map(entry => entry.path)
    .sort((left, right) => left.localeCompare(right))
  const excludedManifest = gate.cleanExportManifest.filter(entry => !shouldShipCleanExportManifestEntry(entry))
  const internalEvidenceExcluded = excludedManifest.filter(entry =>
    entry.provenance === 'canonical-planning-source' ||
    entry.provenance === 'internal-generated-evidence'
  )
  const publicDocsShipped = gate.cleanExportManifest.filter(entry =>
    shouldShipCleanExportManifestEntry(entry) &&
    entry.provenance === 'public-release-document'
  )
  const blockedPaths = [
    ...gate.releaseBlockers.map(violation => violation.path),
    ...gate.pendingDeletions.map(violation => violation.path),
  ].sort()
  return {
    filesToShip,
    policy: {
      status: blockedPaths.length === 0
        ? 'PASS_RELEASE_SURFACE_POLICY_APPLIED'
        : 'FAIL_RELEASE_SURFACE_POLICY',
      candidateFileCount: gate.candidateFileCount,
      shippedFileCount: filesToShip.length,
      excludedFileCount: excludedManifest.length,
      rewriteOrExcludeCount: gate.cleanExportSummary.rewriteOrExcludeCount,
      pendingDeleteCount: gate.cleanExportSummary.pendingDeleteCount,
      releaseBlockerCount: gate.releaseBlockerCount,
      internalEvidenceExcludedCount: internalEvidenceExcluded.length,
      publicDocsShippedCount: publicDocsShipped.length,
      blockedPaths,
      sampleExcludedInternalEvidence: internalEvidenceExcluded.slice(0, 30).map(entry => entry.path),
    },
  }
}

async function copyExportFiles(files: string[], exportDir: string): Promise<ExportedFile[]> {
  const exported: ExportedFile[] = []
  for (const file of files) {
    const source = resolve(ROOT, file)
    const sourceRelative = relative(ROOT, source)
    if (sourceRelative.startsWith('..') || sourceRelative === '') continue
    if (!existsSync(source)) continue
    const info = await lstat(source)
    if (!info.isFile()) continue
    const dest = join(exportDir, file)
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(source, dest)
    exported.push({ path: file, sizeBytes: info.size })
  }
  return exported
}

async function createZip(exportDir: string, zipPath: string): Promise<void> {
  const escapedExport = exportDir.replace(/'/g, "''")
  const escapedZip = zipPath.replace(/'/g, "''")
  const script = `Compress-Archive -Path '${escapedExport}\\*' -DestinationPath '${escapedZip}' -Force`
  const result = await runCommand(['powershell', '-NoProfile', '-Command', script])
  if (result.exitCode !== 0) {
    throw new Error(`Compress-Archive failed: ${result.stderr || result.stdout}`)
  }
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256')
  hash.update(await readFile(path))
  return hash.digest('hex')
}

function isProbablyText(path: string): boolean {
  return /\.(?:cjs|cmd|css|csv|example|html|js|json|jsonl|jsx|lock|md|mjs|ps1|sh|toml|ts|tsx|txt|yaml|yml)$/i.test(path) ||
    !path.includes('.')
}

async function scanExportForSecrets(exportedFiles: ExportedFile[], exportDir: string): Promise<SecretScan> {
  const activeSecrets = [
    ['DSXU_API_KEY', process.env.DSXU_API_KEY],
    ['DEEPSEEK_API_KEY', process.env.DEEPSEEK_API_KEY],
    ['DSXU_DEEPSEEK_API_KEY', process.env.DSXU_DEEPSEEK_API_KEY],
    ['LITELLM_API_KEY', process.env.LITELLM_API_KEY],
  ].filter((entry): entry is [string, string] =>
    typeof entry[1] === 'string' &&
    entry[1].trim().length >= 12 &&
    !/^your[_-]?/i.test(entry[1].trim()),
  )
  const matched = new Set<string>()
  const forbiddenPathMatches = exportedFiles
    .map(file => normalizeGitPath(file.path))
    .filter(path =>
      path === '.env' ||
      (path.startsWith('.env.') && path !== '.env.example') ||
      path.startsWith('.dsxu/') ||
      path.startsWith('node_modules/') ||
      path.startsWith('outputs/'),
    )

  let scannedFileCount = 0
  for (const file of exportedFiles) {
    if (!isProbablyText(file.path) || file.sizeBytes > 2_000_000) continue
    scannedFileCount += 1
    const text = await readFile(join(exportDir, file.path), 'utf8').catch(() => '')
    for (const [name, value] of activeSecrets) {
      if (text.includes(value)) matched.add(name)
    }
  }

  return {
    status: matched.size === 0 && forbiddenPathMatches.length === 0
      ? 'PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT'
      : 'FAIL_SECRET_VALUE_IN_EXPORT',
    scannedFileCount,
    activeEnvSecretNamesPresent: activeSecrets.map(([name]) => name),
    forbiddenPathMatches,
    matchedEnvSecretNames: [...matched].sort(),
  }
}

function mdList(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n')
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(EXPORT_ROOT, { recursive: true })

  const [cleanPreflight, sixStage, productBenchmark] = await Promise.all([
    readJson(CLEAN_PREFLIGHT),
    readJson(SIX_STAGE),
    readJson(PRODUCT_BENCHMARK),
  ])
  const blockers = [
    ...(cleanPreflight.status === 'PASS_READY_TO_CREATE_CLEAN_EXPORT' && cleanPreflight.canCreateCleanExport === true
      ? []
      : ['clean export preflight is not PASS_READY_TO_CREATE_CLEAN_EXPORT']),
    ...(sixStage.status === 'PASS_V24_SIX_STAGE_FINAL_TESTS'
      ? []
      : ['six-stage final tests are not PASS_V24_SIX_STAGE_FINAL_TESTS']),
    ...(productBenchmark.status === 'PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY'
      ? []
      : ['fixed public benchmark/product demo data pack is not PASS']),
  ]
  if (blockers.length > 0) {
    throw new Error(`clean export blocked: ${blockers.join('; ')}`)
  }

  const stamp = safeTime()
  const exportName = `dsxu-code-v24-clean-export-20260515-${stamp}`
  const exportDir = join(EXPORT_ROOT, exportName)
  const zipPath = join(EXPORT_ROOT, `${exportName}.zip`)
  await mkdir(exportDir, { recursive: true })

  const files = await collectFiles()
  const { filesToShip, policy: releaseSurfacePolicy } = await applyReleaseSurfacePolicy(files)
  if (releaseSurfacePolicy.status !== 'PASS_RELEASE_SURFACE_POLICY_APPLIED') {
    throw new Error(`clean export release-surface policy failed: ${JSON.stringify({
      releaseBlockerCount: releaseSurfacePolicy.releaseBlockerCount,
      pendingDeleteCount: releaseSurfacePolicy.pendingDeleteCount,
      blockedPaths: releaseSurfacePolicy.blockedPaths.slice(0, 20),
    })}`)
  }
  const exportedFiles = await copyExportFiles(filesToShip, exportDir)
  const secretScan = await scanExportForSecrets(exportedFiles, exportDir)
  if (secretScan.status !== 'PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT') {
    throw new Error(`clean export secret scan failed: ${JSON.stringify({
      forbiddenPathMatches: secretScan.forbiddenPathMatches,
      matchedEnvSecretNames: secretScan.matchedEnvSecretNames,
    })}`)
  }
  await createZip(exportDir, zipPath)
  const zipInfo = await stat(zipPath)
  const zipSha256 = await sha256(zipPath)
  const excluded = [
    '.git',
    '.dsxu',
    'node_modules',
    'outputs',
    '.env/.env.* except .env.example',
    '.trash',
    '.dsevo',
    'tmp',
    'internal DSXU planning/audit/owner-review docs',
    'docs/generated evidence corpus',
  ]
  const report = {
    schemaVersion: 'dsxu.v24.clean-export-artifact.v1',
    generatedAt: new Date().toISOString(),
    status: 'PASS_CLEAN_EXPORT_ARTIFACT_CREATED',
    repoRoot: ROOT,
    exportRoot: EXPORT_ROOT,
    exportDir,
    zipPath,
    zipSizeBytes: zipInfo.size,
    zipSha256,
    exportedFileCount: exportedFiles.length,
    exportedTotalBytes: exportedFiles.reduce((sum, file) => sum + file.sizeBytes, 0),
    releaseSurfacePolicy,
    requiredExclusions: excluded,
    gateEvidence: {
      cleanExportPreflightStatus: cleanPreflight.status,
      sixStageFinalTestsStatus: sixStage.status,
      productBenchmarkDataStatus: productBenchmark.status,
    },
    secretScan,
    rule:
      'This script creates a release artifact outside the source tree by default. It does not stage, commit, delete, reset, clean source files, or include local evidence/dependency directories.',
    sampleFiles: exportedFiles.slice(0, 40),
  }
  const md = [
    '# DSXU V24 Clean Export Artifact - 2026-05-15',
    '',
    `Status: ${report.status}`,
    '',
    `Export dir: ${exportDir}`,
    '',
    `Zip: ${zipPath}`,
    '',
    `Zip SHA256: ${zipSha256}`,
    '',
    `Files: ${report.exportedFileCount}`,
    '',
    `Zip bytes: ${report.zipSizeBytes}`,
    '',
    '## Secret Scan',
    '',
    `Status: ${secretScan.status}`,
    '',
    `Active env secret names checked: ${secretScan.activeEnvSecretNamesPresent.join(', ') || 'none present in runner env'}`,
    '',
    `Matched env secret names in export: ${secretScan.matchedEnvSecretNames.join(', ') || 'none'}`,
    '',
    '## Release Surface Policy',
    '',
    `Status: ${releaseSurfacePolicy.status}`,
    '',
    `Candidate files: ${releaseSurfacePolicy.candidateFileCount}`,
    '',
    `Shipped files: ${releaseSurfacePolicy.shippedFileCount}`,
    '',
    `Excluded files: ${releaseSurfacePolicy.excludedFileCount}`,
    '',
    `Internal evidence excluded: ${releaseSurfacePolicy.internalEvidenceExcludedCount}`,
    '',
    `Public docs/assets shipped: ${releaseSurfacePolicy.publicDocsShippedCount}`,
    '',
    '### Sample Excluded Internal Evidence',
    '',
    mdList(releaseSurfacePolicy.sampleExcludedInternalEvidence),
    '',
    '## Required Exclusions',
    '',
    mdList(excluded),
    '',
    '## Gate Evidence',
    '',
    `- clean export preflight: ${cleanPreflight.status}`,
    `- six-stage final tests: ${sixStage.status}`,
    `- product benchmark/demo data: ${productBenchmark.status}`,
    '',
    '## Rule',
    '',
    report.rule,
    '',
  ].join('\n')
  await Promise.all([
    writeFile(OUT_JSON, JSON.stringify(report, null, 2) + '\n'),
    writeFile(OUT_MD, md, 'utf8'),
  ])
  console.log(JSON.stringify({
    status: report.status,
    exportedFileCount: report.exportedFileCount,
    zipPath,
    zipSizeBytes: report.zipSizeBytes,
    zipSha256,
    secretScanStatus: secretScan.status,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
