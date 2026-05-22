export type DSXUBrandCompatRiskDisposition =
  | 'allowed-provider-compat-boundary'
  | 'allowed-source-truth-evidence'
  | 'build-time-dce-review'
  | 'public-surface-blocker'
  | 'runtime-cleanup-candidate'
  | 'test-evidence-allowed'

export type DSXUBrandCompatRiskKind =
  | 'legacy-user-type-gate'
  | 'reference-brand-token'
  | 'provider-migration-token'

export type DSXUBrandCompatOccurrence = {
  path: string
  line: number
  kind: DSXUBrandCompatRiskKind
  match: string
  disposition: DSXUBrandCompatRiskDisposition
  reason: string
}

export type DSXUBrandCompatRiskBoard = {
  status: 'DONE_EVIDENCED' | 'BLOCKED_EVIDENCED'
  generatedAt: string
  scannedFileCount: number
  occurrenceCount: number
  publicSurfaceBlockerCount: number
  runtimeCleanupCandidateCount: number
  buildTimeDceReviewCount: number
  compatBoundaryAllowedCount: number
  sourceTruthEvidenceCount: number
  testEvidenceAllowedCount: number
  occurrences: readonly DSXUBrandCompatOccurrence[]
  safeguards: readonly string[]
}

const SOURCE_REFERENCE_PRODUCT = ['cl', 'aude'].join('')
const SOURCE_REFERENCE_VENDOR = ['anth', 'ropic'].join('')
const SOURCE_REFERENCE_VENDOR_SCOPE = `@${SOURCE_REFERENCE_VENDOR}-ai/`

const USER_TYPE_ANT_PATTERN = /USER_TYPE[\w\s.?!:=()[\]'"`|&-]*(?:ant|['"`]ant['"`])/i
const PROVIDER_MIGRATION_PATTERN = /provider[-_ ]?migration/i
const PROVIDER_MIGRATION_ENV_GATE_PATTERN =
  /DSXU(?:_CODE)?_(?:ALLOW|ENABLE)_PROVIDER_MIGRATION_[A-Z0-9_]+/
const ARCHIVED_PROTOCOL_IMPORT_PATH_PATTERN =
  /from\s+['"][^'"]*(?:providerMigrationProtocol|controlProviderMigrationProtocol)\.js['"]/i
const ARCHIVED_COMPAT_IMPORT_PATH_PATTERN =
  /from\s+['"][^'"]*providerMigration[^'"]*['"]/i
const REFERENCE_BRAND_PATTERNS = [
  new RegExp(`\\b${SOURCE_REFERENCE_PRODUCT}\\b`, 'i'),
  new RegExp(`\\b${SOURCE_REFERENCE_PRODUCT}\\s+Code\\b`, 'i'),
  new RegExp(`\\b${SOURCE_REFERENCE_VENDOR}\\b`, 'i'),
  new RegExp(SOURCE_REFERENCE_VENDOR_SCOPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
] as const

const PUBLIC_DOCS = new Set([
  'README.md',
  'docs/BENCHMARK.md',
  'docs/DEEPSEEK_V4_CAPABILITIES.md',
])

export function collectDSXUBrandCompatOccurrences(input: {
  files: readonly { path: string; content: string }[]
  generatedAt?: string
}): DSXUBrandCompatRiskBoard {
  const occurrences: DSXUBrandCompatOccurrence[] = []

  for (const file of input.files) {
    if (!isTextLike(file.path) || isExcluded(file.path)) continue
    const lines = file.content.split(/\r?\n/)
    lines.forEach((line, index) => {
      const userTypeMatch = line.match(USER_TYPE_ANT_PATTERN)?.[0]
      if (userTypeMatch) {
        occurrences.push(
          classifyDSXUBrandCompatOccurrence({
            path: file.path,
            line: index + 1,
            kind: 'legacy-user-type-gate',
            match: userTypeMatch,
          }),
        )
      }

      const providerMigrationMatch = line.match(PROVIDER_MIGRATION_PATTERN)?.[0]
      if (
        providerMigrationMatch &&
        !isArchivedProtocolImportPathOnly(line) &&
        !isArchivedCompatImportPathOnly(line)
      ) {
        occurrences.push(
          classifyDSXUBrandCompatOccurrence({
            path: file.path,
            line: index + 1,
            kind: 'provider-migration-token',
            match: providerMigrationMatch,
            context: line,
          }),
        )
      }

      for (const pattern of REFERENCE_BRAND_PATTERNS) {
        const referenceMatch = line.match(pattern)?.[0]
        if (referenceMatch) {
          occurrences.push(
            classifyDSXUBrandCompatOccurrence({
              path: file.path,
              line: index + 1,
              kind: 'reference-brand-token',
              match: referenceMatch,
            }),
          )
          break
        }
      }
    })
  }

  return buildDSXUBrandCompatRiskBoard({
    generatedAt: input.generatedAt,
    scannedFileCount: input.files.length,
    occurrences,
  })
}

export function classifyDSXUBrandCompatOccurrence(input: {
  path: string
  line: number
  kind: DSXUBrandCompatRiskKind
  match: string
  context?: string
}): DSXUBrandCompatOccurrence {
  const path = normalizePath(input.path)
  const publicSurface = isPublicSurfacePath(path)
  const providerCompat = isProviderCompatPath(path)
  const testEvidence = isTestOrBenchmarkPath(path)
  const sourceTruth = isCanonicalSourceTruthDoc(path)

  if (publicSurface && input.kind === 'reference-brand-token') {
    return occurrence(input, 'public-surface-blocker', 'public release surface contains a reference brand token')
  }
  if (providerCompat) {
    return occurrence(input, 'allowed-provider-compat-boundary', 'legacy/provider token is isolated inside a DSXU-owned compatibility boundary')
  }
  if (
    input.kind === 'provider-migration-token' &&
    isCompatibilityEnvGate(input.context ?? input.match)
  ) {
    return occurrence(input, 'allowed-provider-compat-boundary', 'explicit archived-provider env gate is a named compatibility boundary')
  }
  if (testEvidence) {
    return occurrence(input, 'test-evidence-allowed', 'test or benchmark evidence may retain redacted compatibility probes')
  }
  if (sourceTruth) {
    return occurrence(input, 'allowed-source-truth-evidence', 'source-truth planning evidence is kept internally and must be rewritten or excluded from release export')
  }
  if (input.kind === 'legacy-user-type-gate') {
    return occurrence(input, 'build-time-dce-review', 'legacy USER_TYPE gate must remain build-time/dead-code-elimination only or be replaced by DSXU-owned config')
  }
  if (input.kind === 'provider-migration-token') {
    return occurrence(input, 'runtime-cleanup-candidate', 'provider-migration wording reached a runtime/public path and needs owner review')
  }
  return occurrence(input, 'runtime-cleanup-candidate', 'reference token reached a non-public non-compat path and needs owner review')
}

export function buildDSXUBrandCompatRiskBoard(input: {
  generatedAt?: string
  scannedFileCount: number
  occurrences: readonly DSXUBrandCompatOccurrence[]
}): DSXUBrandCompatRiskBoard {
  const publicSurfaceBlockerCount = countBy(input.occurrences, 'public-surface-blocker')
  const runtimeCleanupCandidateCount = countBy(input.occurrences, 'runtime-cleanup-candidate')
  const buildTimeDceReviewCount = countBy(input.occurrences, 'build-time-dce-review')
  const compatBoundaryAllowedCount = countBy(input.occurrences, 'allowed-provider-compat-boundary')
  const sourceTruthEvidenceCount = countBy(input.occurrences, 'allowed-source-truth-evidence')
  const testEvidenceAllowedCount = countBy(input.occurrences, 'test-evidence-allowed')

  return {
    status: publicSurfaceBlockerCount === 0 ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scannedFileCount: input.scannedFileCount,
    occurrenceCount: input.occurrences.length,
    publicSurfaceBlockerCount,
    runtimeCleanupCandidateCount,
    buildTimeDceReviewCount,
    compatBoundaryAllowedCount,
    sourceTruthEvidenceCount,
    testEvidenceAllowedCount,
    occurrences: input.occurrences,
    safeguards: [
      'public release files must not contain reference brand tokens',
      'legacy USER_TYPE gates are review debt unless proven build-time-only',
      'provider compatibility wording is allowed only inside DSXU-owned compatibility or source-truth evidence boundaries',
      'generated reports redact exact reference matches before human-readable publication',
      'this board does not delete, stage, or rewrite files; it creates owner review evidence',
    ],
  }
}

export function redactDSXUBrandCompatMatch(match: string): string {
  const lower = match.toLowerCase()
  if (lower.includes(SOURCE_REFERENCE_PRODUCT) || lower.includes(SOURCE_REFERENCE_VENDOR)) {
    return '[reference-token]'
  }
  return match.replace(/ant/gi, '[legacy-user-type]')
}

function occurrence(
  input: {
    path: string
    line: number
    kind: DSXUBrandCompatRiskKind
    match: string
  },
  disposition: DSXUBrandCompatRiskDisposition,
  reason: string,
): DSXUBrandCompatOccurrence {
  return {
    path: normalizePath(input.path),
    line: input.line,
    kind: input.kind,
    match: redactDSXUBrandCompatMatch(input.match),
    disposition,
    reason,
  }
}

function countBy(
  occurrences: readonly DSXUBrandCompatOccurrence[],
  disposition: DSXUBrandCompatRiskDisposition,
): number {
  return occurrences.filter(occurrence => occurrence.disposition === disposition).length
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^"|"$/g, '')
}

function isTextLike(path: string): boolean {
  return /\.(cjs|css|js|json|jsonc|jsx|lock|md|mjs|ps1|sh|ts|tsx|txt|yaml|yml)$/i.test(path)
}

function isExcluded(path: string): boolean {
  const normalized = normalizePath(path)
  return (
    normalized.startsWith('.git/') ||
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('.dsxu/') ||
    normalized.startsWith('tmp/') ||
    normalized.startsWith('outputs/') ||
    normalized === 'docs/DSXU_BRAND_COMPAT_RISK_BOARD_20260517.md' ||
    normalized === 'docs/generated/DSXU_BRAND_COMPAT_RISK_BOARD_20260517.json'
  )
}

function isPublicSurfacePath(path: string): boolean {
  return PUBLIC_DOCS.has(path) || path === 'package.json'
}

function isProviderCompatPath(path: string): boolean {
  return (
    /^src\/constants\/providerMigrationProtocol\.ts$/.test(path) ||
    /^src\/dsxu\/control-plane\/controlProviderMigrationProtocol\.ts$/.test(path) ||
    /^src\/dsxu\/engine\/(?:brand-compat-risk-board|entrypoint-policy|model-public-surface-gate|proprietary-code-risk-gate|provider-contract|provider-service-shell-policy|public-surface-clean-gate)\.ts$/.test(path) ||
    /^src\/utils\/model\/providerMigration\//.test(path) ||
    /^src\/utils\/envCompat\.ts$/.test(path) ||
    /^src\/utils\/commitAttributionProviderMigration\.ts$/.test(path) ||
    /^src\/services\/auth\/dsxuProvider(?:Control)?Auth\.ts$/.test(path) ||
    /^src\/services\/mockRateLimitsProviderMigration\//.test(path) ||
    /^src\/dsxu\/legacy\//.test(path) ||
    /^src\/migrations\//.test(path)
  )
}

function isArchivedProtocolImportPathOnly(line: string): boolean {
  return ARCHIVED_PROTOCOL_IMPORT_PATH_PATTERN.test(line)
}

function isArchivedCompatImportPathOnly(line: string): boolean {
  return ARCHIVED_COMPAT_IMPORT_PATH_PATTERN.test(line)
}

function isCompatibilityEnvGate(line: string): boolean {
  return PROVIDER_MIGRATION_ENV_GATE_PATTERN.test(line)
}

function isTestOrBenchmarkPath(path: string): boolean {
  return (
    /\/__tests__\//.test(path) ||
    /\.test\.[cm]?[tj]sx?$/.test(path) ||
    /^scripts\/benchmark\//.test(path) ||
    /benchmark/i.test(path)
  )
}

function isCanonicalSourceTruthDoc(path: string): boolean {
  return /^docs\/(?:generated\/)?DSXU_(?:V(?:18|19|20|24|26)_|[A-Z0-9_]+_\d{8})/i.test(path)
}
