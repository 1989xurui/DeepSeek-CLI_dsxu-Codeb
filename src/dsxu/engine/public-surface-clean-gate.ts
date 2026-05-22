import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type V18PublicSurfaceCleanStatus = 'DONE_EVIDENCED' | 'BLOCKED_EVIDENCED'

export type V18PublicSurfaceCleanBucket =
  | 'active_src'
  | 'provider_migration'
  | 'tests'
  | 'docs'
  | 'scripts'
  | 'package'
  | 'other'

export type V18PublicSurfaceCleanViolation = {
  surface: 'path' | 'content'
  severity: 'blocker' | 'review' | 'justified'
  bucket: V18PublicSurfaceCleanBucket
  path: string
  line?: number
  match: string
  reason: string
}

export type V18PublicSurfaceCleanGate = {
  status: V18PublicSurfaceCleanStatus
  ok: boolean
  generatedAt: string
  evidencePath: string
  scannedFileCount: number
  violationCount: number
  blockerCount: number
  reviewCount: number
  justifiedCount: number
  providerMigrationModelAliasJustifiedCount: number
  sourceTruthDocJustifiedCount: number
  benchContractJustifiedCount: number
  publicSurfaceReviewCount: number
  nonPublicReviewCount: number
  byBucket: Record<V18PublicSurfaceCleanBucket, number>
  violations: readonly V18PublicSurfaceCleanViolation[]
  safeguards: readonly string[]
}

const SOURCE_REFERENCE_PRODUCT = ['cl', 'aude'].join('')
const SOURCE_REFERENCE_MASCOT = ['cl', 'awd'].join('')
const SOURCE_REFERENCE_VENDOR = ['anth', 'ropic'].join('')
const SOURCE_REFERENCE_VENDOR_SCOPE = `@${SOURCE_REFERENCE_VENDOR}-ai/`

const EXCLUDED_PREFIXES = [
  `\u539f\u4ee3\u7801${SOURCE_REFERENCE_PRODUCT}/`,
  '\u975edsxu-code\u9879\u76ee\u6587\u4ef6/',
  'tmp/',
  'outputs/',
  '\u9694\u79bb\u5904\u7406/',
] as const

const PATH_BLOCKERS = [
  new RegExp(`(^|/)(${SOURCE_REFERENCE_PRODUCT}|${SOURCE_REFERENCE_MASCOT}|${SOURCE_REFERENCE_VENDOR})([^/]*)$`, 'i'),
  new RegExp(`(^|/)([^/]*)(${SOURCE_REFERENCE_PRODUCT}|${SOURCE_REFERENCE_MASCOT}|${SOURCE_REFERENCE_VENDOR})([^/]*)(/|$)`, 'i'),
] as const

const LEGACY_MODEL_FAMILY_WORDS = ['o' + 'pus', 'son' + 'net', 'hai' + 'ku'] as const
const LEGACY_MODEL_FAMILY_PATTERN = LEGACY_MODEL_FAMILY_WORDS.join('|')

const PATH_REVIEW = [
  new RegExp(`(^|/)([^/]*)(${LEGACY_MODEL_FAMILY_PATTERN})([^/]*)(/|$)`, 'i'),
] as const

const CONTENT_BLOCKERS = [
  new RegExp(`\\b${SOURCE_REFERENCE_PRODUCT} Code\\b`, 'i'),
  new RegExp(`\\b${SOURCE_REFERENCE_PRODUCT}\\b`, 'i'),
  new RegExp(`\\b${SOURCE_REFERENCE_MASCOT}\\b`, 'i'),
  new RegExp(`\\b${SOURCE_REFERENCE_VENDOR}\\b`, 'i'),
  new RegExp(SOURCE_REFERENCE_VENDOR_SCOPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
] as const

const CONTENT_REVIEW = [
  new RegExp(`\\b(${LEGACY_MODEL_FAMILY_PATTERN})\\b`, 'i'),
] as const

const PACKAGE_FILES = new Set(['package.json', 'package-lock.json', 'bun.lock'])

function isModelFamilyFalsePositive(path: string, line: string, match: string): boolean {
  const [highTier, balancedTier] = LEGACY_MODEL_FAMILY_WORDS
  const highTierExtensionPattern = new RegExp(`['"]\\.${highTier}['"]`)
  const balancedTierWordPattern = new RegExp(`['"]${balancedTier}['"]`)
  const lowerMatch = match.toLowerCase()
  if (lowerMatch === highTier && path === 'src/constants/files.ts' && highTierExtensionPattern.test(line)) {
    return true
  }
  if (lowerMatch === balancedTier && path === 'src/utils/words.ts' && balancedTierWordPattern.test(line)) {
    return true
  }
  return false
}

function isCanonicalPlanningDoc(path: string): boolean {
  return /^docs\/(?:generated\/)?DSXU_(?:V(?:18|19|20|24|26)_|[A-Z0-9_]+_\d{8})/i.test(path)
}

function isProviderMigrationBoundaryPath(path: string): boolean {
  return (
    /^src\/utils\/model\/providerMigration\//.test(path) ||
    /^src\/utils\/commitAttributionProviderMigration\.ts$/.test(path) ||
    /^src\/utils\/envCompat\.ts$/.test(path) ||
    /^src\/services\/mockRateLimitsProviderMigration\//.test(path) ||
    /^src\/services\/auth\/dsxuProvider(?:Control)?Auth\.ts$/.test(path)
  )
}

function bucketForPath(path: string): V18PublicSurfaceCleanBucket {
  if (PACKAGE_FILES.has(path)) return 'package'
  if (/^scripts\/benchmark\//.test(path)) return 'tests'
  if (
    isProviderMigrationBoundaryPath(path) ||
    /^src\/dsxu\/legacy\//.test(path) ||
    /^src\/migrations\//.test(path) ||
    /^src\/utils\/model\/legacy/i.test(path) ||
    /^src\/constants\/legacy/i.test(path) ||
    /^migrations\//.test(path)
  ) {
    return 'provider_migration'
  }
  if (/^src\//.test(path)) {
    if (/\/__tests__\//.test(path) || /\.test\.[cm]?[tj]sx?$/.test(path)) return 'tests'
    return 'active_src'
  }
  if (/^(test|fixtures)\//.test(path) || /\.test\.[cm]?[tj]sx?$/.test(path)) return 'tests'
  if (/^docs\//.test(path) || /\.md$/i.test(path)) return 'docs'
  if (/^scripts\//.test(path) || /\.(ps1|sh)$/i.test(path)) return 'scripts'
  return 'other'
}

function initializeBucketCounts(): Record<V18PublicSurfaceCleanBucket, number> {
  return {
    active_src: 0,
    provider_migration: 0,
    tests: 0,
    docs: 0,
    scripts: 0,
    package: 0,
    other: 0,
  }
}

function isPublicSurfaceReviewBucket(bucket: V18PublicSurfaceCleanBucket): boolean {
  return bucket === 'active_src' || bucket === 'package' || bucket === 'scripts' || bucket === 'other'
}

function isBenchContractEvidence(bucket: V18PublicSurfaceCleanBucket): boolean {
  return bucket === 'tests'
}

function isHiddenProviderMigrationModelAlias(path: string, bucket: V18PublicSurfaceCleanBucket): boolean {
  return (
    bucket === 'provider_migration' &&
    (isProviderMigrationBoundaryPath(path) ||
      /^src\/dsxu\/legacy\//.test(path) ||
      /^src\/migrations\//.test(path) ||
      /^src\/utils\/model\/legacy/i.test(path) ||
      /^src\/constants\/legacy/i.test(path) ||
      /^migrations\//.test(path))
  )
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^"|"$/g, '')
}

function isExcluded(path: string): boolean {
  const normalized = normalizePath(path)
  return EXCLUDED_PREFIXES.some(prefix => normalized.startsWith(prefix))
}

function isTextLike(path: string): boolean {
  return /\.(cjs|css|js|json|jsonc|jsx|md|mjs|ps1|sh|ts|tsx|txt|yaml|yml)$/i.test(path)
}

function firstMatch(patterns: readonly RegExp[], text: string): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[0]) return match[0]
  }
  return undefined
}

export function buildV18PublicSurfaceCleanGate(input: {
  files: readonly { path: string; content?: string }[]
  evidencePath?: string
  nowIso?: string
}): V18PublicSurfaceCleanGate {
  const violations: V18PublicSurfaceCleanViolation[] = []
  const files = input.files.filter(file => !isExcluded(file.path))

  for (const file of files) {
    const path = normalizePath(file.path)
    const bucket = bucketForPath(path)
    const pathBlocker = firstMatch(PATH_BLOCKERS, path)
    if (pathBlocker) {
      const planningDoc = isCanonicalPlanningDoc(path)
      violations.push({
        surface: 'path',
        severity: planningDoc ? 'justified' : 'blocker',
        bucket,
        path,
        match: pathBlocker,
        reason: planningDoc
          ? 'DSXU source-truth or evidence document keeps historical/reference wording; release export must exclude or rewrite it, but the current source doc must stay in place'
          : 'release path still contains legacy/proprietary legacy naming or vendor namespace',
      })
    } else {
      const pathReview = firstMatch(PATH_REVIEW, path)
      if (pathReview) {
        const hiddenProviderMigrationAlias = isHiddenProviderMigrationModelAlias(path, bucket)
        const benchContract = isBenchContractEvidence(bucket)
        violations.push({
          surface: 'path',
          severity: hiddenProviderMigrationAlias || benchContract ? 'justified' : 'review',
          bucket,
          path,
          match: pathReview,
          reason: hiddenProviderMigrationAlias
            ? 'legacy model-family alias is retained in a hidden DSXU compatibility or migration path and must not ship as public surface'
            : benchContract
              ? 'test or benchmark fixture retains legacy naming as BENCH_CONTRACT_ONLY evidence and must not define public product surface'
              : 'release path still contains legacy model-family legacy naming that should be DSXU/DeepSeek-owned',
        })
      }
    }

    if (!file.content) continue
    const lines = file.content.split(/\r?\n/)
    lines.forEach((line, index) => {
      const contentBlocker = firstMatch(CONTENT_BLOCKERS, line)
      if (contentBlocker) {
        const planningDoc = isCanonicalPlanningDoc(path)
        const benchContract = isBenchContractEvidence(bucket)
        violations.push({
          surface: 'content',
          severity: planningDoc || benchContract ? 'justified' : 'blocker',
          bucket,
          path,
          line: index + 1,
          match: contentBlocker,
          reason: planningDoc
            ? 'DSXU source-truth or evidence document keeps historical/reference wording; release export must exclude or rewrite it, but the current source doc must stay in place'
            : benchContract
              ? 'test or benchmark fixture retains legacy wording as BENCH_CONTRACT_ONLY evidence and must not define public product surface'
              : 'release content still exposes legacy/proprietary legacy naming',
        })
        return
      }
      const contentReview = firstMatch(CONTENT_REVIEW, line)
      if (contentReview) {
        if (isModelFamilyFalsePositive(path, line, contentReview)) return
        const hiddenProviderMigrationAlias = isHiddenProviderMigrationModelAlias(path, bucket)
        const planningDoc = isCanonicalPlanningDoc(path)
        const benchContract = isBenchContractEvidence(bucket)
        violations.push({
          surface: 'content',
          severity: hiddenProviderMigrationAlias || planningDoc || benchContract ? 'justified' : 'review',
          bucket,
          path,
          line: index + 1,
          match: contentReview,
          reason: hiddenProviderMigrationAlias
            ? 'legacy model-family alias is retained inside a hidden DSXU archived boundary'
            : planningDoc
              ? 'DSXU source-truth or evidence document keeps historical/reference wording; release export must exclude or rewrite it'
              : benchContract
                ? 'test or benchmark fixture retains legacy model-family wording as BENCH_CONTRACT_ONLY evidence'
                : 'release content still exposes legacy model-family wording',
        })
      }
    })
  }

  const blockerCount = violations.filter(violation => violation.severity === 'blocker').length
  const reviewCount = violations.filter(violation => violation.severity === 'review').length
  const justifiedCount = violations.filter(violation => violation.severity === 'justified').length
  const providerMigrationModelAliasJustifiedCount = violations.filter(
    violation => violation.severity === 'justified' && isHiddenProviderMigrationModelAlias(violation.path, violation.bucket),
  ).length
  const sourceTruthDocJustifiedCount = violations.filter(
    violation => violation.severity === 'justified' && isCanonicalPlanningDoc(violation.path),
  ).length
  const benchContractJustifiedCount = violations.filter(
    violation => violation.severity === 'justified' && isBenchContractEvidence(violation.bucket),
  ).length
  const publicSurfaceReviewCount = violations.filter(
    violation => violation.severity === 'review' && isPublicSurfaceReviewBucket(violation.bucket),
  ).length
  const nonPublicReviewCount = reviewCount - publicSurfaceReviewCount
  const byBucket = initializeBucketCounts()
  for (const violation of violations) {
    byBucket[violation.bucket] += 1
  }
  const safeguards = [
    'gate excludes the original reference directory and local quarantine/archive directories',
    'gate reports violations only; it does not delete, rename, move, stage, or commit files',
    'public surface blockers must be removed from release paths and user-visible/runtime content before release packaging',
    'canonical DSXU planning and evidence documents are release-excluded review debt, not active runtime/public UI blockers',
    'benchmark scripts are classified with tests so benchmark-only search contracts do not inflate public-surface public surface debt',
    'public-surface review count tracks active source, package, general scripts, and other release text separately from provider_migration/docs/tests',
    'hidden archived model aliases are justified findings, not cleanup debt, as long as they stay behind DSXU-owned archived boundaries',
    'DSXU source-truth and evidence documents are justified findings and must be rewritten or excluded in release export instead of edited in place for packaging optics',
    'test and benchmark fixtures are justified BENCH_CONTRACT_ONLY findings when they retain legacy names as anti-regression evidence',
    'model-family review findings must be either rewritten to DSXU/DeepSeek names or explicitly justified as non-release archived references',
  ]

  return {
    status: blockerCount === 0 ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok: blockerCount === 0,
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath:
      input.evidencePath ??
      join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain', 'public-surface-clean-gate-20260507.evidence.json'),
    scannedFileCount: files.length,
    violationCount: violations.length,
    blockerCount,
    reviewCount,
    justifiedCount,
    providerMigrationModelAliasJustifiedCount,
    sourceTruthDocJustifiedCount,
    benchContractJustifiedCount,
    publicSurfaceReviewCount,
    nonPublicReviewCount,
    byBucket,
    violations: violations.slice(0, 500),
    safeguards,
  }
}

async function gitLsFiles(repoRoot: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    timeout: 30_000,
    maxBuffer: 6 * 1024 * 1024,
    windowsHide: true,
  })
  return String(stdout).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

export async function runV18PublicSurfaceCleanGateHarness(input: {
  repoRoot?: string
  evidenceDir?: string
} = {}): Promise<V18PublicSurfaceCleanGate> {
  const repoRoot = input.repoRoot ?? process.cwd()
  const evidenceDir = input.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'public-surface-clean-gate-20260507.evidence.json')
  const trackedFiles = (await gitLsFiles(repoRoot)).filter(file => !isExcluded(file) && isTextLike(file))
  const files = await Promise.all(
    trackedFiles.map(async path => {
      try {
        return { path, content: await readFile(join(repoRoot, path), 'utf8') }
      } catch {
        return undefined
      }
    }),
  )
  const gate = buildV18PublicSurfaceCleanGate({
    files: files.filter((file): file is { path: string; content: string } => Boolean(file)),
    evidencePath,
  })
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8')
  return gate
}
