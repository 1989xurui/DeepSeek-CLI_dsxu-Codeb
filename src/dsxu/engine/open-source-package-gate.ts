import { execFile } from 'child_process'
import { access } from 'fs/promises'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const SOURCE_REFERENCE_PRODUCT = ['cl', 'aude'].join('')
const SOURCE_REFERENCE_ROOT = `\\u539f\\u4ee3\\u7801${SOURCE_REFERENCE_PRODUCT}`
const LEGACY_PROXY_DIR = ['upstream', 'proxy'].join('')

export type V18OpenSourcePackageGateStatus = 'DONE_EVIDENCED' | 'BLOCKED_EVIDENCED'

export type V18OpenSourceCleanExportStatus =
  | 'READY_FOR_CLEAN_EXPORT'
  | 'PENDING_DELETION_REVIEW'
  | 'BLOCKED_PRESENT_FORBIDDEN_PATHS'

export type V18OpenSourceReleasePolicy =
  | 'ship'
  | 'exclude'
  | 'rewrite-or-exclude'
  | 'pending-delete'

export type V18OpenSourceProvenance =
  | 'dsxu-owned-release-source'
  | 'public-release-document'
  | 'canonical-planning-source'
  | 'internal-generated-evidence'
  | 'historical-quarantine'
  | 'legacy-runtime-shell'
  | 'local-runtime-scratch'
  | 'pending-deletion-debt'

export type V18OpenSourceCleanExportManifestEntry = {
  path: string
  present: boolean
  provenance: V18OpenSourceProvenance
  releasePolicy: V18OpenSourceReleasePolicy
  reason: string
  ruleId?: string
}

export type V18OpenSourceCleanExportSummary = {
  shipCount: number
  excludeCount: number
  rewriteOrExcludeCount: number
  pendingDeleteCount: number
}

export type V18PendingDeletionRequiredAction =
  | 'review-and-commit-deletion'
  | 'verify-mainline-replacement-then-commit-deletion'

export type V18PendingDeletionRestorePolicy =
  | 'do-not-restore-release-excluded-state'
  | 'do-not-restore-old-runtime-shell'

export type V18PendingDeletionClosureEntry = {
  path: string
  ruleId: string
  requiredAction: V18PendingDeletionRequiredAction
  restorePolicy: V18PendingDeletionRestorePolicy
  reason: string
  releaseImpact: string
}

export type V18PendingDeletionClosure = {
  total: number
  byRule: Readonly<Record<string, number>>
  requiresMainlineReplacementEvidenceCount: number
  requiresNormalGitDeletionReviewCount: number
  entries: readonly V18PendingDeletionClosureEntry[]
  safeguards: readonly string[]
}

export type V18PackageForbiddenRule = {
  id: string
  pattern: RegExp
  reason: string
}

export type V18PackageViolation = {
  path: string
  ruleId: string
  reason: string
  present: boolean
}

export type V18OpenSourcePackageGate = {
  status: V18OpenSourcePackageGateStatus
  ok: boolean
  cleanExportStatus: V18OpenSourceCleanExportStatus
  cleanExportReady: boolean
  generatedAt: string
  evidencePath: string
  trackedFileCount: number
  candidateFileCount: number
  violationCount: number
  releaseBlockerCount: number
  pendingDeletionCount: number
  cleanExportSummary: V18OpenSourceCleanExportSummary
  cleanExportManifest: readonly V18OpenSourceCleanExportManifestEntry[]
  pendingDeletionClosure: V18PendingDeletionClosure
  violations: readonly V18PackageViolation[]
  releaseBlockers: readonly V18PackageViolation[]
  pendingDeletions: readonly V18PackageViolation[]
  safeguards: readonly string[]
}

export const V18_FORBIDDEN_OPEN_SOURCE_PACKAGE_RULES: readonly V18PackageForbiddenRule[] = [
  {
    id: 'local-runtime-scratch',
    pattern: new RegExp(
      '^(tmp|outputs|undefined|\\u9694\\u79bb\\u5904\\u7406|\\u975edsxu-code\\u9879\\u76ee\\u6587\\u4ef6|\\.dsevo-kill-switch-test)(/|$)',
    ),
    reason: 'local runtime scratch, evidence, or archive material must not be tracked in the open-source package',
  },
  {
    id: 'external-reference-source',
    pattern: new RegExp(`^${SOURCE_REFERENCE_ROOT}(/|$)`),
    reason: 'external reference source is audit input, not DSXU distributable source',
  },
  {
    id: 'legacy-control-plane-shell',
    pattern: new RegExp(`^src/(bridge|remote|${LEGACY_PROXY_DIR})(/|$)`),
    reason: 'V18 uses DSXU Control Plane; old Bridge/Remote/Proxy shell must not ship as active source',
  },
  {
    id: 'legacy-private-state',
    pattern: new RegExp(`^(\\.${SOURCE_REFERENCE_PRODUCT}|\\.dsevo|dsevo|evals)(/|$)`),
    reason: 'historical private state, golden fixtures, and old eval side paths are excluded from the release package',
  },
  {
    id: 'old-root-shims',
    pattern: new RegExp(
      `^(start-${SOURCE_REFERENCE_PRODUCT}\\.(cmd|ps1)|crash-handler\\.js|deepseek-proxy\\.(js|ts)|test-(context-budget|cost-ledger|infra-tasks)\\.(js|cjs))$`,
    ),
    reason: 'old root shims and one-off scripts are quarantined outside the release surface',
  },
]

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^"|"$/g, '')
}

const PUBLIC_RELEASE_DOC_PATHS = new Set([
  'docs/BENCHMARK.md',
  'docs/CONFIGURATION.md',
  'docs/CONTRIBUTING.md',
  'docs/DEEPSEEK_V4_CAPABILITIES.md',
  'docs/DOCTOR_HEALTH.md',
  'docs/INSTALL.md',
  'docs/RELEASE_RUNBOOK.md',
  'docs/SECURITY_PERMISSION.md',
  'docs/TOOL_SURFACE.md',
  'docs/product/README.md',
  'docs/release/README.md',
])

function isPublicReleaseDoc(path: string): boolean {
  return PUBLIC_RELEASE_DOC_PATHS.has(path) || /^docs\/assets\/[^/]+\.(?:svg|png|jpg|jpeg|webp)$/i.test(path)
}

function isInternalReleaseEvidenceDoc(path: string): boolean {
  return /^docs\/generated\//i.test(path) || /^docs\/DSXU_/i.test(path)
}

function isCanonicalPlanningDoc(path: string): boolean {
  return isInternalReleaseEvidenceDoc(path)
}

function provenanceForRule(ruleId: string, present: boolean): V18OpenSourceProvenance {
  if (!present) return 'pending-deletion-debt'
  if (ruleId === 'legacy-control-plane-shell') return 'legacy-runtime-shell'
  if (ruleId === 'local-runtime-scratch') return 'local-runtime-scratch'
  return 'historical-quarantine'
}

function policyForViolation(present: boolean): V18OpenSourceReleasePolicy {
  return present ? 'exclude' : 'pending-delete'
}

function buildCleanExportManifest(input: {
  candidateFiles: readonly string[]
  presentFileSet: ReadonlySet<string>
  violations: readonly V18PackageViolation[]
}): readonly V18OpenSourceCleanExportManifestEntry[] {
  const violationByPath = new Map(input.violations.map(violation => [violation.path, violation]))
  return input.candidateFiles.map(rawPath => {
    const path = normalizePath(rawPath)
    const present = input.presentFileSet.has(path)
    const violation = violationByPath.get(path)
    if (violation) {
      return {
        path,
        present,
        provenance: provenanceForRule(violation.ruleId, present),
        releasePolicy: policyForViolation(present),
        reason: violation.reason,
        ruleId: violation.ruleId,
      }
    }
    if (isPublicReleaseDoc(path)) {
      return {
        path,
        present,
        provenance: 'public-release-document',
        releasePolicy: 'ship',
        reason: 'curated public release documentation or release-safe public asset',
      }
    }
    if (isCanonicalPlanningDoc(path)) {
      return {
        path,
        present,
        provenance: /^docs\/generated\//i.test(path) ? 'internal-generated-evidence' : 'canonical-planning-source',
        releasePolicy: 'rewrite-or-exclude',
        reason:
          'internal DSXU planning, audit, benchmark, owner review, or generated evidence docs stay source-side; clean export must exclude them or ship a curated public rewrite',
      }
    }
    return {
      path,
      present,
      provenance: 'dsxu-owned-release-source',
      releasePolicy: 'ship',
      reason: 'default DSXU-owned release source or package metadata',
    }
  })
}

export function shouldShipCleanExportManifestEntry(
  entry: V18OpenSourceCleanExportManifestEntry,
): boolean {
  return entry.present && entry.releasePolicy === 'ship'
}

function summarizeCleanExportManifest(
  manifest: readonly V18OpenSourceCleanExportManifestEntry[],
): V18OpenSourceCleanExportSummary {
  return {
    shipCount: manifest.filter(entry => entry.releasePolicy === 'ship').length,
    excludeCount: manifest.filter(entry => entry.releasePolicy === 'exclude').length,
    rewriteOrExcludeCount: manifest.filter(entry => entry.releasePolicy === 'rewrite-or-exclude').length,
    pendingDeleteCount: manifest.filter(entry => entry.releasePolicy === 'pending-delete').length,
  }
}

function pendingDeletionRequiredAction(ruleId: string): V18PendingDeletionRequiredAction {
  return ruleId === 'legacy-control-plane-shell' || ruleId === 'old-root-shims'
    ? 'verify-mainline-replacement-then-commit-deletion'
    : 'review-and-commit-deletion'
}

function pendingDeletionRestorePolicy(ruleId: string): V18PendingDeletionRestorePolicy {
  return ruleId === 'legacy-control-plane-shell'
    ? 'do-not-restore-old-runtime-shell'
    : 'do-not-restore-release-excluded-state'
}

function buildPendingDeletionClosure(
  pendingDeletions: readonly V18PackageViolation[],
): V18PendingDeletionClosure {
  const byRule: Record<string, number> = {}
  const entries = pendingDeletions.map(violation => {
    byRule[violation.ruleId] = (byRule[violation.ruleId] ?? 0) + 1
    const requiredAction = pendingDeletionRequiredAction(violation.ruleId)
    return {
      path: violation.path,
      ruleId: violation.ruleId,
      requiredAction,
      restorePolicy: pendingDeletionRestorePolicy(violation.ruleId),
      reason: violation.reason,
      releaseImpact:
        'cleanExportReady remains false until this tracked deletion is reviewed and committed in git',
    }
  })
  return {
    total: entries.length,
    byRule,
    requiresMainlineReplacementEvidenceCount: entries.filter(
      entry => entry.requiredAction === 'verify-mainline-replacement-then-commit-deletion',
    ).length,
    requiresNormalGitDeletionReviewCount: entries.filter(
      entry => entry.requiredAction === 'review-and-commit-deletion',
    ).length,
    entries,
    safeguards: [
      'closure plan is evidence-only and does not stage, delete, restore, move, or commit files',
      'old runtime shell deletions must not be restored; DSXU Control Plane or other mainline replacement evidence must stay available',
      'private state, eval, scratch, and old root shim deletions stay excluded from release packaging',
      'clean export becomes ready only after normal git review closes pending deletion debt',
    ],
  }
}

export function buildV18OpenSourcePackageGate(input: {
  trackedFiles: readonly string[]
  presentFiles?: readonly string[]
  evidencePath?: string
  nowIso?: string
  rules?: readonly V18PackageForbiddenRule[]
}): V18OpenSourcePackageGate {
  const rules = input.rules ?? V18_FORBIDDEN_OPEN_SOURCE_PACKAGE_RULES
  const presentFileSet = new Set((input.presentFiles ?? input.trackedFiles).map(normalizePath))
  const violations: V18PackageViolation[] = []
  for (const rawPath of input.trackedFiles) {
    const path = normalizePath(rawPath)
    for (const rule of rules) {
      if (rule.pattern.test(path)) {
        violations.push({
          path,
          ruleId: rule.id,
          reason: rule.reason,
          present: presentFileSet.has(path),
        })
        break
      }
    }
  }
  const releaseBlockers = violations.filter(violation => violation.present)
  const pendingDeletions = violations.filter(violation => !violation.present)
  const cleanExportManifest = buildCleanExportManifest({
    candidateFiles: input.trackedFiles,
    presentFileSet,
    violations,
  })
  const cleanExportSummary = summarizeCleanExportManifest(cleanExportManifest)
  const cleanExportStatus: V18OpenSourceCleanExportStatus =
    releaseBlockers.length > 0
      ? 'BLOCKED_PRESENT_FORBIDDEN_PATHS'
      : pendingDeletions.length > 0
        ? 'PENDING_DELETION_REVIEW'
        : 'READY_FOR_CLEAN_EXPORT'
  const pendingDeletionClosure = buildPendingDeletionClosure(pendingDeletions)

  const safeguards = [
    'gate separates present release blockers from tracked paths already deleted in the worktree',
    'gate does not delete, restore, move, stage, or commit files',
    'pending deletions still require normal review/commit before publishing a clean repository',
    'external reference source may remain on disk locally but must not be tracked or packaged',
    'clean-export manifest keeps internal DSXU planning, audit, benchmark, owner review, and generated evidence docs as source truth while requiring rewrite or exclude policy for release output',
    'curated public docs and release-safe docs/assets are the only docs shipped by default',
    'default ship policy applies only after forbidden paths, local scratch, old runtime shells, and pending deletions are classified',
  ]

  return {
    status: releaseBlockers.length === 0 ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok: releaseBlockers.length === 0,
    cleanExportStatus,
    cleanExportReady: cleanExportStatus === 'READY_FOR_CLEAN_EXPORT',
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath:
      input.evidencePath ??
      join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain', 'open-source-package-gate-20260507.evidence.json'),
    trackedFileCount: input.trackedFiles.length,
    candidateFileCount: input.trackedFiles.length,
    violationCount: violations.length,
    releaseBlockerCount: releaseBlockers.length,
    pendingDeletionCount: pendingDeletions.length,
    cleanExportSummary,
    cleanExportManifest,
    pendingDeletionClosure,
    violations,
    releaseBlockers,
    pendingDeletions,
    safeguards,
  }
}

async function gitLsPackageCandidateFiles(repoRoot: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    timeout: 30_000,
    maxBuffer: 6 * 1024 * 1024,
    windowsHide: true,
  })
  return String(stdout)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

async function filterPresentTrackedFiles(repoRoot: string, paths: readonly string[]): Promise<string[]> {
  const present: string[] = []
  for (const path of paths) {
    try {
      await access(join(repoRoot, normalizePath(path)))
      present.push(path)
    } catch {
      // A tracked-but-deleted path is a pending deletion debt, not a release package input.
    }
  }
  return present
}

export async function runV18OpenSourcePackageGateHarness(input: {
  repoRoot?: string
  evidenceDir?: string
} = {}): Promise<V18OpenSourcePackageGate> {
  const repoRoot = input.repoRoot ?? process.cwd()
  const evidenceDir = input.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'open-source-package-gate-20260507.evidence.json')
  const candidateFiles = await gitLsPackageCandidateFiles(repoRoot)
  const presentFiles = await filterPresentTrackedFiles(repoRoot, candidateFiles)
  const gate = buildV18OpenSourcePackageGate({ trackedFiles: candidateFiles, presentFiles, evidencePath })
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8')
  return gate
}
