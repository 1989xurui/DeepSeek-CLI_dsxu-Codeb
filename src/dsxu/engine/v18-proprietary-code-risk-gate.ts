import { execFile } from 'child_process'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type V18ProprietaryCodeRiskStatus = 'DONE_EVIDENCED' | 'BLOCKED_EVIDENCED'

export type V18ProprietaryCodeRiskSeverity = 'blocker' | 'review' | 'justified'

export type V18ProprietaryCodeRiskBucket =
  | 'active_src'
  | 'provider_migration'
  | 'tests'
  | 'docs'
  | 'scripts'
  | 'package'
  | 'other'

export type V18ProprietaryCodeRiskRuleId =
  | 'vendor-naming-or-api'
  | 'vendor-dependency'
  | 'vendor-secret-or-env'
  | 'legacy-runtime-shell-path'
  | 'legacy-runtime-import'
  | 'legacy-control-symbol'
  | 'legacy-oauth-protocol'
  | 'vendor-model-family'

export type V18ProprietaryCodeRiskIssue = {
  severity: V18ProprietaryCodeRiskSeverity
  ruleId: V18ProprietaryCodeRiskRuleId
  bucket: V18ProprietaryCodeRiskBucket
  path: string
  line?: number
  match: string
  reason: string
}

export type V18ProprietaryTrackedPathRisk = {
  path: string
  ruleId: V18ProprietaryCodeRiskRuleId
  present: boolean
  reason: string
}

export type V18ProprietaryCodeRiskGate = {
  status: V18ProprietaryCodeRiskStatus
  ok: boolean
  generatedAt: string
  evidencePath: string
  scannedFileCount: number
  issueCount: number
  blockerCount: number
  reviewCount: number
  justifiedCount: number
  providerMigrationModelAliasJustifiedCount: number
  providerMigrationProtocolJustifiedCount: number
  sourceTruthDocJustifiedCount: number
  benchContractJustifiedCount: number
  publicSurfaceReviewCount: number
  nonPublicReviewCount: number
  trackedPathRiskCount: number
  pendingDeletionCount: number
  byBucket: Record<V18ProprietaryCodeRiskBucket, number>
  byRule: Record<V18ProprietaryCodeRiskRuleId, number>
  issues: readonly V18ProprietaryCodeRiskIssue[]
  trackedPathRisks: readonly V18ProprietaryTrackedPathRisk[]
  safeguards: readonly string[]
}

const SOURCE_REFERENCE_PRODUCT = ['cl', 'aude'].join('')
const SOURCE_REFERENCE_VENDOR = ['anth', 'ropic'].join('')
const SOURCE_REFERENCE_VENDOR_SCOPE = `@${SOURCE_REFERENCE_VENDOR}-ai/`
const SOURCE_REFERENCE_PRODUCT_CODE_ENV = `${SOURCE_REFERENCE_PRODUCT.toUpperCase()}_CODE`
const SOURCE_REFERENCE_PRODUCT_ENV = SOURCE_REFERENCE_PRODUCT.toUpperCase()
const SOURCE_REFERENCE_VENDOR_ENV = SOURCE_REFERENCE_VENDOR.toUpperCase()
const SOURCE_REFERENCE_PREFIX = `\u539f\u4ee3\u7801${SOURCE_REFERENCE_PRODUCT}/`
const LEGACY_INTERNAL_STAGING_DOMAIN = ['staging', 'ant', 'dev'].join('.')
const LEGACY_FEDSTART_DOMAIN = ['fedstart', 'com'].join('.')
const LEGACY_PROXY_DIR = ['upstream', 'proxy'].join('')
const LEGACY_AUTH_BETA_HEADER_SYMBOL = ['OAUTH', 'BETA', 'HEADER'].join('_')

const EXCLUDED_PREFIXES = [
  SOURCE_REFERENCE_PREFIX,
  '\u975edsxu-code\u9879\u76ee\u6587\u4ef6/',
  '\u9694\u79bb\u5904\u7406/',
  '.dsxu/',
  '.git/',
  'node_modules/',
  'tmp/',
  'outputs/',
  'undefined/',
] as const

const PACKAGE_FILES = new Set(['package.json', 'package-lock.json', 'bun.lock'])

const TRACKED_PATH_RISK_RULES: readonly {
  ruleId: V18ProprietaryCodeRiskRuleId
  pattern: RegExp
  reason: string
}[] = [
  {
    ruleId: 'legacy-runtime-shell-path',
    pattern: new RegExp(`^src/(bridge|remote|${LEGACY_PROXY_DIR})(/|$)`, 'i'),
    reason: 'old control/remote/proxy shell path must not ship as active DSXU runtime',
  },
  {
    ruleId: 'legacy-runtime-shell-path',
    pattern: new RegExp(`^(\\.${SOURCE_REFERENCE_PRODUCT}|\\.dsevo|dsevo|evals)(/|$)`, 'i'),
    reason: 'historical private state and old eval side paths must stay outside release packaging',
  },
  {
    ruleId: 'legacy-runtime-shell-path',
    pattern: new RegExp(
      `^(start-${SOURCE_REFERENCE_PRODUCT}\\.(cmd|ps1)|crash-handler\\.js|deepseek-proxy\\.(js|ts)|test-(context-budget|cost-ledger|infra-tasks)\\.(js|cjs))$`,
      'i',
    ),
    reason: 'old root shims must be deleted or moved out of the release surface',
  },
]

function isProviderMigrationBoundaryPath(path: string): boolean {
  return (
    /^src\/utils\/model\/providerMigration\//.test(path) ||
    /^src\/utils\/commitAttributionProviderMigration\.ts$/.test(path) ||
    /^src\/utils\/envCompat\.ts$/.test(path) ||
    /^src\/services\/mockRateLimitsProviderMigration\//.test(path) ||
    /^src\/services\/auth\/dsxuProvider(?:Control)?Auth\.ts$/.test(path)
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
  return /\.(cjs|css|js|json|jsonc|jsx|lock|md|mjs|ps1|sh|ts|tsx|txt|yaml|yml)$/i.test(path)
}

function bucketForPath(path: string): V18ProprietaryCodeRiskBucket {
  if (PACKAGE_FILES.has(path)) return 'package'
  if (/^scripts\/benchmark\//.test(path)) return 'tests'
  if (
    isProviderMigrationBoundaryPath(path) ||
    /^src\/dsxu\/legacy\//.test(path) ||
    /^src\/migrations\//.test(path) ||
    path === 'src/utils/model/configs.ts' ||
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

function initializeBucketCounts(): Record<V18ProprietaryCodeRiskBucket, number> {
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

function initializeRuleCounts(): Record<V18ProprietaryCodeRiskRuleId, number> {
  return {
    'vendor-naming-or-api': 0,
    'vendor-dependency': 0,
    'vendor-secret-or-env': 0,
    'legacy-runtime-shell-path': 0,
    'legacy-runtime-import': 0,
    'legacy-control-symbol': 0,
    'legacy-oauth-protocol': 0,
    'vendor-model-family': 0,
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pushIssue(
  issues: V18ProprietaryCodeRiskIssue[],
  issue: Omit<V18ProprietaryCodeRiskIssue, 'bucket'>,
): void {
  issues.push({
    ...issue,
    bucket: bucketForPath(issue.path),
  })
}

function isReleaseBlockingBucket(bucket: V18ProprietaryCodeRiskBucket): boolean {
  return bucket === 'active_src' || bucket === 'package' || bucket === 'scripts' || bucket === 'other'
}

function isPublicSurfaceReviewBucket(bucket: V18ProprietaryCodeRiskBucket): boolean {
  return bucket === 'active_src' || bucket === 'package' || bucket === 'scripts' || bucket === 'other'
}

function isHiddenProviderMigrationModelAlias(path: string, bucket: V18ProprietaryCodeRiskBucket): boolean {
  return (
    bucket === 'provider_migration' &&
    (isProviderMigrationBoundaryPath(path) ||
      /^src\/dsxu\/legacy\//.test(path) ||
      /^src\/migrations\//.test(path) ||
      /^src\/utils\/model\/legacy/i.test(path) ||
      /^src\/constants\/legacy/i.test(path) ||
      path === 'src/utils/model/configs.ts' ||
      /^migrations\//.test(path))
  )
}

function isHiddenProviderMigrationProtocol(path: string, bucket: V18ProprietaryCodeRiskBucket): boolean {
  return bucket === 'provider_migration' && (
    /^src\/dsxu\/legacy\/auth\//.test(path) ||
    /^src\/services\/auth\/dsxuProvider(?:Control)?Auth\.ts$/.test(path)
  )
}

function isCanonicalSourceTruthDoc(path: string): boolean {
  return /^docs\/(?:generated\/)?DSXU_V(?:18|19|20)_/i.test(path)
}

function isBenchContractEvidence(bucket: V18ProprietaryCodeRiskBucket): boolean {
  return bucket === 'tests'
}

function nonPublicJustifiedSeverity(
  path: string,
  bucket: V18ProprietaryCodeRiskBucket,
): V18ProprietaryCodeRiskSeverity | undefined {
  if (isCanonicalSourceTruthDoc(path)) return 'justified'
  if (isBenchContractEvidence(bucket)) return 'justified'
  return undefined
}

function nonPublicJustifiedReason(
  path: string,
  bucket: V18ProprietaryCodeRiskBucket,
): string | undefined {
  if (isCanonicalSourceTruthDoc(path)) {
    return 'V18/V19/V20 source-truth document retains historical/reference wording; release export must rewrite or exclude it'
  }
  if (isBenchContractEvidence(bucket)) {
    return 'test or benchmark fixture retains legacy wording as BENCH_CONTRACT_ONLY evidence and must not define public product surface'
  }
  return undefined
}

const VENDOR_BRAND_OR_API_PATTERNS = [
  new RegExp(`\\b${SOURCE_REFERENCE_PRODUCT}\\b`, 'i'),
  new RegExp(`\\b${SOURCE_REFERENCE_VENDOR}\\b`, 'i'),
  new RegExp(`${escapeRegExp(SOURCE_REFERENCE_PRODUCT)}\\.ai`, 'i'),
  new RegExp(`api\\.${escapeRegExp(SOURCE_REFERENCE_VENDOR)}\\.com`, 'i'),
  new RegExp(`${escapeRegExp(SOURCE_REFERENCE_VENDOR)}-beta`, 'i'),
  new RegExp(escapeRegExp(LEGACY_INTERNAL_STAGING_DOMAIN), 'i'),
  new RegExp(escapeRegExp(LEGACY_FEDSTART_DOMAIN), 'i'),
  /\bLEGACY_(?:VENDOR_DOMAIN|CLOUD_NAME|CLOUD_AI_NAME|CLOUD_COM_NAME|PLATFORM_HOST|API_HOST|CLI_APP_ID|CLI_API_PATH|CUSTOM_OAUTH_ENV|OAUTH_CLIENT_ID_ENV|LOCAL_OAUTH_ENV_PREFIX)\b/,
] as const

const VENDOR_ENV_PATTERNS = [
  new RegExp(`\\b${SOURCE_REFERENCE_VENDOR_ENV}_[A-Z0-9_]+\\b`, 'i'),
  new RegExp(`\\b${SOURCE_REFERENCE_PRODUCT_CODE_ENV}_[A-Z0-9_]+\\b`, 'i'),
  new RegExp(`\\b${SOURCE_REFERENCE_PRODUCT_ENV}_[A-Z0-9_]+\\b`, 'i'),
  new RegExp(`\\b${['sk', 'ant'].join('-')}[a-z0-9_-]*`, 'i'),
] as const

const LEGACY_RUNTIME_IMPORT_PATTERNS = [
  /\.\.\/\.\.\/remote\//i,
  new RegExp(`\\.\\./\\.\\./${LEGACY_PROXY_DIR}/`, 'i'),
  /\.\.\/remote\//i,
  new RegExp(`\\.\\./${LEGACY_PROXY_DIR}/`, 'i'),
  /src\/bridge\//i,
  /src\/remote\//i,
  new RegExp(`src/${LEGACY_PROXY_DIR}/`, 'i'),
] as const

const LEGACY_CONTROL_SYMBOL_PATTERNS = [
  /\bRemoteSessionManager\b/,
  /\bSessionsWebSocket\b/,
  /\bbridgeMain\b/,
  /\bbridgeMessaging\b/,
  /\breplBridge\b/,
  /\bremoteBridge\b/,
  new RegExp(`\\b${LEGACY_PROXY_DIR}\\b`, 'i'),
] as const

const LEGACY_OAUTH_PROTOCOL_PATTERNS = [
  new RegExp(`\\b${LEGACY_AUTH_BETA_HEADER_SYMBOL}\\b`),
  /\bgetProviderOAuthTokens\b/,
  /\bproviderOAuth\b/,
] as const

const LEGACY_MODEL_FAMILY_WORDS = ['o' + 'pus', 'son' + 'net', 'hai' + 'ku'] as const
const LEGACY_MODEL_FAMILY_PATTERN = LEGACY_MODEL_FAMILY_WORDS.join('|')

const MODEL_FAMILY_PATTERNS = [
  new RegExp(`\\b(${LEGACY_MODEL_FAMILY_PATTERN})\\b`, 'i'),
] as const

function firstMatch(patterns: readonly RegExp[], text: string): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[0]) return match[0]
  }
  return undefined
}

function isImportLike(line: string): boolean {
  return /\b(import|from|require|modulePath|completedSourceFiles|sourceFiles)\b/.test(line)
}

function isModelFamilyFalsePositive(path: string, line: string, match: string): boolean {
  const [highTier, balancedTier] = LEGACY_MODEL_FAMILY_WORDS
  const highTierConfigFilePattern = new RegExp(`['"]\\.${highTier}['"]`)
  const balancedTierWordPattern = new RegExp(`['"]${balancedTier}['"]`)
  if (match.toLowerCase() === highTier && path === 'src/constants/files.ts' && highTierConfigFilePattern.test(line)) {
    return true
  }
  if (match.toLowerCase() === balancedTier && path === 'src/utils/words.ts' && balancedTierWordPattern.test(line)) {
    return true
  }
  return false
}

export function buildV18ProprietaryCodeRiskGate(input: {
  files: readonly { path: string; content?: string }[]
  trackedFiles?: readonly string[]
  presentFiles?: readonly string[]
  evidencePath?: string
  nowIso?: string
}): V18ProprietaryCodeRiskGate {
  const issues: V18ProprietaryCodeRiskIssue[] = []
  const files = input.files.filter(file => !isExcluded(file.path))
  const trackedFiles = (input.trackedFiles ?? files.map(file => file.path)).map(normalizePath).filter(path => !isExcluded(path))
  const presentFileSet = new Set((input.presentFiles ?? trackedFiles).map(normalizePath))
  const trackedPathRisks: V18ProprietaryTrackedPathRisk[] = []

  for (const path of trackedFiles) {
    for (const rule of TRACKED_PATH_RISK_RULES) {
      if (rule.pattern.test(path)) {
        trackedPathRisks.push({
          path,
          ruleId: rule.ruleId,
          present: presentFileSet.has(path),
          reason: rule.reason,
        })
        break
      }
    }
  }

  for (const file of files) {
    const path = normalizePath(file.path)
    const bucket = bucketForPath(path)
    if (!file.content) continue

    const lines = file.content.split(/\r?\n/)
    lines.forEach((line, index) => {
      if (PACKAGE_FILES.has(path) && line.includes(SOURCE_REFERENCE_VENDOR_SCOPE)) {
        pushIssue(issues, {
          severity: 'blocker',
          ruleId: 'vendor-dependency',
          path,
          line: index + 1,
          match: SOURCE_REFERENCE_VENDOR_SCOPE,
          reason: 'package metadata still references a vendor-scoped dependency instead of a DSXU-owned boundary',
        })
        return
      }

      const vendorNamingOrApi = firstMatch(VENDOR_BRAND_OR_API_PATTERNS, line)
      if (vendorNamingOrApi) {
        const justifiedSeverity = nonPublicJustifiedSeverity(path, bucket)
        pushIssue(issues, {
          severity: justifiedSeverity ?? (isReleaseBlockingBucket(bucket) ? 'blocker' : 'review'),
          ruleId: 'vendor-naming-or-api',
          path,
          line: index + 1,
          match: vendorNamingOrApi,
          reason:
            nonPublicJustifiedReason(path, bucket) ??
            'release surface still exposes a legacy vendor/product name, API URL, or vendor API header',
        })
        return
      }

      const vendorEnv = firstMatch(VENDOR_ENV_PATTERNS, line)
      if (vendorEnv) {
        const justifiedSeverity = nonPublicJustifiedSeverity(path, bucket)
        pushIssue(issues, {
          severity: justifiedSeverity ?? (isReleaseBlockingBucket(bucket) ? 'blocker' : 'review'),
          ruleId: 'vendor-secret-or-env',
          path,
          line: index + 1,
          match: vendorEnv,
          reason:
            nonPublicJustifiedReason(path, bucket) ??
            'release surface still exposes a legacy vendor secret, environment variable, or token prefix',
        })
        return
      }

      const runtimeImport = firstMatch(LEGACY_RUNTIME_IMPORT_PATTERNS, line)
      if (runtimeImport) {
        const justifiedSeverity = nonPublicJustifiedSeverity(path, bucket)
        pushIssue(issues, {
          severity: justifiedSeverity ?? (bucket === 'active_src' && isImportLike(line) ? 'blocker' : 'review'),
          ruleId: 'legacy-runtime-import',
          path,
          line: index + 1,
          match: runtimeImport,
          reason:
            nonPublicJustifiedReason(path, bucket) ??
            'code still points at an old control/remote/proxy runtime path instead of DSXU Control Plane modules',
        })
        return
      }

      const controlSymbol = firstMatch(LEGACY_CONTROL_SYMBOL_PATTERNS, line)
      if (controlSymbol) {
        const justifiedSeverity = nonPublicJustifiedSeverity(path, bucket)
        pushIssue(issues, {
          severity: justifiedSeverity ?? 'review',
          ruleId: 'legacy-control-symbol',
          path,
          line: index + 1,
          match: controlSymbol,
          reason:
            nonPublicJustifiedReason(path, bucket) ??
            'legacy control-plane symbol remains and needs DSXU-owned naming or an explicit compatibility justification',
        })
        return
      }

      const oauthProtocol = firstMatch(LEGACY_OAUTH_PROTOCOL_PATTERNS, line)
      if (oauthProtocol) {
        const justifiedSeverity = nonPublicJustifiedSeverity(path, bucket)
        const hiddenProviderMigrationProtocol = isHiddenProviderMigrationProtocol(path, bucket)
        pushIssue(issues, {
          severity: hiddenProviderMigrationProtocol ? 'justified' : justifiedSeverity ?? 'review',
          ruleId: 'legacy-oauth-protocol',
          path,
          line: index + 1,
          match: oauthProtocol,
          reason: hiddenProviderMigrationProtocol
            ? 'provider OAuth/control protocol naming is retained inside a hidden DSXU provider-migration auth boundary and must not define public control-plane ownership'
            : nonPublicJustifiedReason(path, bucket) ??
              'provider OAuth/control protocol naming remains and must be centralized under DSXU auth/control ownership',
        })
        return
      }

      const modelFamily = firstMatch(MODEL_FAMILY_PATTERNS, line)
      if (modelFamily) {
        if (isModelFamilyFalsePositive(path, line, modelFamily)) return
        const hiddenProviderMigrationAlias = isHiddenProviderMigrationModelAlias(path, bucket)
        const justifiedSeverity = nonPublicJustifiedSeverity(path, bucket)
        pushIssue(issues, {
          severity: hiddenProviderMigrationAlias ? 'justified' : justifiedSeverity ?? 'review',
          ruleId: 'vendor-model-family',
          path,
          line: index + 1,
          match: modelFamily,
          reason:
            (hiddenProviderMigrationAlias
              ? 'legacy model-family alias is retained inside a hidden DSXU provider-migration boundary and must not leak to public release surfaces'
              : nonPublicJustifiedReason(path, bucket)) ??
            'legacy model-family wording remains and should be moved to DSXU/DeepSeek route aliases or documented provider-migration maps',
        })
      }
    })
  }

  const pendingDeletionCount = trackedPathRisks.filter(risk => !risk.present).length
  for (const risk of trackedPathRisks.filter(risk => risk.present)) {
    issues.push({
      severity: 'blocker',
      ruleId: risk.ruleId,
      bucket: bucketForPath(risk.path),
      path: risk.path,
      match: risk.path,
      reason: risk.reason,
    })
  }

  const byBucket = initializeBucketCounts()
  const byRule = initializeRuleCounts()
  for (const issue of issues) {
    byBucket[issue.bucket] += 1
    byRule[issue.ruleId] += 1
  }

  const blockerCount = issues.filter(issue => issue.severity === 'blocker').length
  const reviewCount = issues.filter(issue => issue.severity === 'review').length
  const justifiedCount = issues.filter(issue => issue.severity === 'justified').length
  const providerMigrationModelAliasJustifiedCount = issues.filter(
    issue => issue.severity === 'justified' && issue.ruleId === 'vendor-model-family',
  ).length
  const providerMigrationProtocolJustifiedCount = issues.filter(
    issue =>
      issue.severity === 'justified' &&
      issue.ruleId === 'legacy-oauth-protocol' &&
      isHiddenProviderMigrationProtocol(issue.path, issue.bucket),
  ).length
  const sourceTruthDocJustifiedCount = issues.filter(
    issue => issue.severity === 'justified' && isCanonicalSourceTruthDoc(issue.path),
  ).length
  const benchContractJustifiedCount = issues.filter(
    issue => issue.severity === 'justified' && isBenchContractEvidence(issue.bucket),
  ).length
  const publicSurfaceReviewCount = issues.filter(
    issue => issue.severity === 'review' && isPublicSurfaceReviewBucket(issue.bucket),
  ).length
  const nonPublicReviewCount = reviewCount - publicSurfaceReviewCount

  return {
    status: blockerCount === 0 ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok: blockerCount === 0,
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath:
      input.evidencePath ??
      join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain', 'proprietary-code-risk-gate-20260507.evidence.json'),
    scannedFileCount: files.length,
    issueCount: issues.length,
    blockerCount,
    reviewCount,
    justifiedCount,
    providerMigrationModelAliasJustifiedCount,
    providerMigrationProtocolJustifiedCount,
    sourceTruthDocJustifiedCount,
    benchContractJustifiedCount,
    publicSurfaceReviewCount,
    nonPublicReviewCount,
    trackedPathRiskCount: trackedPathRisks.length,
    pendingDeletionCount,
    byBucket,
    byRule,
    issues: issues.slice(0, 1000),
    trackedPathRisks,
    safeguards: [
      'gate distinguishes release blockers from review debt so cleanup is evidence-ordered, not blind replacement',
      'gate excludes the original reference, quarantine/archive, local evidence, node_modules, and runtime scratch directories',
      'old control/remote/proxy path imports in active source are blockers; historical tests/docs are review debt until rewritten or justified',
      'provider-migration paths are counted separately so old aliases can exist only behind DSXU-owned migration boundaries',
      'benchmark scripts are classified with tests so benchmark-only search contracts do not inflate public-surface review debt',
      'public-surface review count tracks active source, package, general scripts, and other release text separately from provider_migration/docs/tests',
      'hidden provider-migration model aliases are justified findings, not cleanup debt, as long as they stay behind DSXU-owned provider-migration boundaries',
      'hidden provider-migration auth protocol symbols are justified findings when confined to DSXU legacy auth boundaries',
      'V18/V19 source-truth documents are justified findings and must be rewritten or excluded in release export instead of edited in place for packaging optics',
      'test and benchmark fixtures are justified BENCH_CONTRACT_ONLY findings when they retain legacy names as anti-regression evidence',
      'vendor model-family wording is tracked as review debt because it affects product ownership and routing clarity, not immediate runtime safety',
      'gate records tracked path risks separately so moved/deleted legacy paths can be reviewed before staging without re-entering release packages',
    ],
  }
}

async function gitLsFiles(repoRoot: string, args: readonly string[]): Promise<string[]> {
  const { stdout } = await execFileAsync('git', ['ls-files', ...args], {
    cwd: repoRoot,
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  })
  return String(stdout)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

async function filterPresentFiles(repoRoot: string, paths: readonly string[]): Promise<string[]> {
  const present: string[] = []
  for (const path of paths) {
    try {
      await access(join(repoRoot, normalizePath(path)))
      present.push(path)
    } catch {
      // A tracked-but-deleted path is pending deletion debt, not a present release input.
    }
  }
  return present
}

export async function runV18ProprietaryCodeRiskGateHarness(input: {
  repoRoot?: string
  evidenceDir?: string
} = {}): Promise<V18ProprietaryCodeRiskGate> {
  const repoRoot = input.repoRoot ?? process.cwd()
  const evidenceDir = input.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'proprietary-code-risk-gate-20260507.evidence.json')
  const trackedFiles = await gitLsFiles(repoRoot, [])
  const untrackedFiles = await gitLsFiles(repoRoot, ['--others', '--exclude-standard'])
  const releaseFiles = [...new Set([...trackedFiles, ...untrackedFiles])]
    .map(normalizePath)
    .filter(path => !isExcluded(path) && isTextLike(path))
  const presentTrackedFiles = await filterPresentFiles(repoRoot, trackedFiles)
  const files = await Promise.all(
    releaseFiles.map(async path => {
      try {
        return { path, content: await readFile(join(repoRoot, path), 'utf8') }
      } catch {
        return undefined
      }
    }),
  )
  const gate = buildV18ProprietaryCodeRiskGate({
    files: files.filter((file): file is { path: string; content: string } => Boolean(file)),
    trackedFiles,
    presentFiles: presentTrackedFiles,
    evidencePath,
  })
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8')
  return gate
}
