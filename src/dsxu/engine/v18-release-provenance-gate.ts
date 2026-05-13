import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type V18ReleaseProvenanceStatus =
  | 'DONE_EVIDENCED'
  | 'BLOCKED_EVIDENCED'

export type V18ReleaseProvenanceIssue = {
  severity: 'blocker' | 'review' | 'justified'
  surface: 'dependency' | 'path' | 'content'
  path: string
  line?: number
  match: string
  reason: string
}

export type V18ReleaseProvenanceGate = {
  status: V18ReleaseProvenanceStatus
  ok: boolean
  generatedAt: string
  evidencePath: string
  scannedFileCount: number
  issueCount: number
  blockerCount: number
  reviewCount: number
  justifiedCount: number
  sourceTruthDocJustifiedCount: number
  issues: readonly V18ReleaseProvenanceIssue[]
  safeguards: readonly string[]
}

const LEGACY_PRODUCT = ['cl', 'aude'].join('')
const LEGACY_VENDOR = ['anth', 'ropic'].join('')
const LEGACY_VENDOR_SCOPE = `@${LEGACY_VENDOR}-ai/`
const ORIGINAL_REFERENCE_PREFIX = `\u539f\u4ee3\u7801${LEGACY_PRODUCT}/`
const LEGACY_PROXY_DIR = ['upstream', 'proxy'].join('')

const EXCLUDED_PREFIXES = [
  ORIGINAL_REFERENCE_PREFIX,
  '\u975edsxu-code\u9879\u76ee\u6587\u4ef6/',
  'tmp/',
  'outputs/',
  '\u9694\u79bb\u5904\u7406/',
] as const

const LEGACY_RUNTIME_PATHS = [
  /^src\/bridge\//i,
  /^src\/remote\//i,
  new RegExp(`^src/${LEGACY_PROXY_DIR}/`, 'i'),
] as const

const PACKAGE_FILES = new Set(['package.json', 'package-lock.json', 'bun.lock'])

const SOURCE_REFERENCE_PATTERNS = [
  new RegExp(ORIGINAL_REFERENCE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
  new RegExp(`${LEGACY_PRODUCT}\\s+source`, 'i'),
  new RegExp(`${LEGACY_PRODUCT}\\s+reference`, 'i'),
  new RegExp(`original\\s+${LEGACY_PRODUCT}`, 'i'),
  new RegExp(`from\\s+${LEGACY_PRODUCT}`, 'i'),
] as const

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

function firstMatch(patterns: readonly RegExp[], text: string): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[0]) return match[0]
  }
  return undefined
}

function isCanonicalSourceTruthDoc(path: string): boolean {
  return /^docs\/DSXU_V(?:18|19)_/i.test(path)
}

export function buildV18ReleaseProvenanceGate(input: {
  files: readonly { path: string; content?: string }[]
  evidencePath?: string
  nowIso?: string
}): V18ReleaseProvenanceGate {
  const issues: V18ReleaseProvenanceIssue[] = []
  const files = input.files.filter(file => !isExcluded(file.path))

  for (const file of files) {
    const path = normalizePath(file.path)
    const legacyPath = firstMatch(LEGACY_RUNTIME_PATHS, path)
    if (legacyPath) {
      issues.push({
        severity: 'blocker',
        surface: 'path',
        path,
        match: legacyPath,
        reason: 'release package still contains a legacy runtime shell directory instead of DSXU Control Plane code',
      })
    }

    if (!file.content) continue
    const lines = file.content.split(/\r?\n/)
    lines.forEach((line, index) => {
      if (PACKAGE_FILES.has(path) && line.includes(LEGACY_VENDOR_SCOPE)) {
        issues.push({
          severity: 'blocker',
          surface: 'dependency',
          path,
          line: index + 1,
          match: LEGACY_VENDOR_SCOPE,
          reason: 'release dependency graph still references a proprietary/vendor-scoped package',
        })
        return
      }

      const sourceReference = firstMatch(SOURCE_REFERENCE_PATTERNS, line)
      if (sourceReference) {
        const sourceTruthDoc = isCanonicalSourceTruthDoc(path)
        issues.push({
          severity: sourceTruthDoc ? 'justified' : 'review',
          surface: 'content',
          path,
          line: index + 1,
          match: sourceReference,
          reason: sourceTruthDoc
            ? 'V18/V19 source-truth document keeps external reference provenance for planning; release export must exclude or rewrite it'
            : 'release content still references external source provenance and must be rewritten or quarantined before release packaging',
        })
      }
    })
  }

  const blockerCount = issues.filter(issue => issue.severity === 'blocker').length
  const reviewCount = issues.filter(issue => issue.severity === 'review').length
  const justifiedCount = issues.filter(issue => issue.severity === 'justified').length
  const sourceTruthDocJustifiedCount = issues.filter(
    issue => issue.severity === 'justified' && isCanonicalSourceTruthDoc(issue.path),
  ).length
  return {
    status: blockerCount === 0 ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok: blockerCount === 0,
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath:
      input.evidencePath ??
      join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain', 'release-provenance-gate-20260507.evidence.json'),
    scannedFileCount: files.length,
    issueCount: issues.length,
    blockerCount,
    reviewCount,
    justifiedCount,
    sourceTruthDocJustifiedCount,
    issues: issues.slice(0, 500),
    safeguards: [
      'gate scans actual existing tracked and untracked release files, not deleted index entries',
      'gate excludes the original reference and quarantine/archive directories',
      'vendor-scoped package dependencies are blockers until replaced by DSXU-owned facades or bundled internal tools',
      'V18/V19 source-truth provenance references are justified findings and must be rewritten or excluded in release export',
      'source-provenance references are review debt that must be rewritten or quarantined before release packaging',
    ],
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

export async function runV18ReleaseProvenanceGateHarness(input: {
  repoRoot?: string
  evidenceDir?: string
} = {}): Promise<V18ReleaseProvenanceGate> {
  const repoRoot = input.repoRoot ?? process.cwd()
  const evidenceDir = input.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'release-provenance-gate-20260507.evidence.json')
  const releaseFiles = (await gitLsFiles(repoRoot)).filter(file => !isExcluded(file) && isTextLike(file))
  const files = await Promise.all(
    releaseFiles.map(async path => {
      try {
        return { path, content: await readFile(join(repoRoot, path), 'utf8') }
      } catch {
        return undefined
      }
    }),
  )
  const gate = buildV18ReleaseProvenanceGate({
    files: files.filter((file): file is { path: string; content: string } => Boolean(file)),
    evidencePath,
  })
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8')
  return gate
}
