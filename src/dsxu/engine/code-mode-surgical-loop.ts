import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'
import { promisify } from 'util'
import {
  buildDSXUWorkStateTimeline,
  type DSXUWorkStateEvent,
  type DSXUWorkStateTimeline,
} from './work-state-timeline'
import { buildDepGraph, computeBlastRadius, type BlastResult } from './blast-radius'

const execFileAsync = promisify(execFile)

export type DSXUCodeFailureType = 'TEST' | 'PATCH' | 'COMMAND' | 'TIMEOUT' | 'CONTEXT' | 'UNKNOWN'

export type DSXURepoProfile = {
  root: string
  language: 'typescript' | 'javascript' | 'python' | 'unknown'
  packageManager: 'bun' | 'npm' | 'pnpm' | 'yarn' | 'unknown'
  testCommand: string[]
  evidenceFiles: readonly string[]
}

export type DSXURepoIndex = {
  root: string
  files: readonly string[]
  sourceFiles: readonly string[]
  testFiles: readonly string[]
  entryFiles: readonly string[]
}

export type DSXUIssueProfile = {
  failureType: DSXUCodeFailureType
  command: string[]
  exitCode: number | null
  stdout: string
  stderr: string
  summary: string
  testNames: readonly string[]
}

export type DSXULocalizationResult = {
  files: readonly string[]
  reasons: readonly string[]
}

export type DSXUCodeContextPack = {
  files: readonly Array<{ path: string; snippet: string }>
  sourceTruthCapsules: readonly DSXUCodeSourceTruthCapsule[]
  readFallbackPolicy: DSXUReadFallbackPolicy
  estimatedInputTokens: number
  compressionRatio: number
  rawChars: number
  packedChars: number
  cacheHygiene: {
    status: 'SOURCE_CAPSULE_READY' | 'SOURCE_CAPSULE_RISK'
    noReadDefault: boolean
    toolResultCharsAvoided: number
    guards: readonly string[]
  }
}

export type DSXUCodeSourceAnchor = {
  id: string
  line: number
  text: string
  reason: 'query-match' | 'symbol' | 'test-assertion' | 'first-meaningful-line'
}

export type DSXUReadFallbackPolicy = {
  mode: 'source-capsule-first'
  requiresLocatorBeforeLargeRead: boolean
  maxLinesPerRead: number
  maxApproxTokensPerRead: number
  largeFileLineThreshold: number
  noReadDefault: boolean
}

export type DSXUCodeSourceTruthCapsule = {
  capsuleId: string
  path: string
  sha256: string
  lineCount: number
  bytes: number
  anchors: readonly DSXUCodeSourceAnchor[]
  excerptBudgetChars: number
  excerpt: string
  riskTags: readonly string[]
  fallbackReadPolicy: DSXUReadFallbackPolicy
}

export type DSXUReadFallbackDecision = {
  allowed: boolean
  status:
    | 'ALLOW_BOUNDED_READ'
    | 'BLOCK_FULL_FILE_READ'
    | 'BLOCK_UNLOCATED_LARGE_READ'
    | 'BLOCK_OVER_BUDGET_READ'
    | 'BLOCK_UNKNOWN_SOURCE'
  path: string
  capsuleId?: string
  requestedOffset?: number
  requestedLimit?: number
  recommendedOffset?: number
  recommendedLimit?: number
  estimatedApproxTokens: number
  maxApproxTokensPerRead: number
  reason: string
  evidence: readonly string[]
}

export type DSXUCodeImpactRadar = {
  status: 'IMPACT_RADAR_READY' | 'IMPACT_RADAR_NEEDS_REVIEW'
  changedFiles: readonly string[]
  directDependents: readonly string[]
  transitiveDependents: readonly string[]
  affectedTests: readonly string[]
  totalAffected: number
  riskLevel: 'low' | 'medium' | 'high'
  recommendedVerification: readonly string[]
  evidence: readonly string[]
  blastRadius: BlastResult
}

export type DSXUEvidenceDrivenReviewFinding = {
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  title: string
  path: string
  line?: number
  evidence: readonly string[]
  risk: string
  repairCandidate?: string
}

export type DSXUEvidenceDrivenReview = {
  status: 'EVIDENCE_REVIEW_READY' | 'EVIDENCE_REVIEW_BLOCKED'
  goal: string
  summary: string
  findings: readonly DSXUEvidenceDrivenReviewFinding[]
  sourceTruthCapsuleIds: readonly string[]
  impactRadarStatus: DSXUCodeImpactRadar['status']
  verificationCommand: readonly string[]
  releaseClaimAllowed: boolean
  evidence: readonly string[]
}

const DEFAULT_CODE_SOURCE_EXCERPT_CHARS = 800
const DEFAULT_CODE_SOURCE_MAX_ANCHORS = 6
const DEFAULT_READ_FALLBACK_POLICY: DSXUReadFallbackPolicy = {
  mode: 'source-capsule-first',
  requiresLocatorBeforeLargeRead: true,
  maxLinesPerRead: 160,
  maxApproxTokensPerRead: 8_000,
  largeFileLineThreshold: 260,
  noReadDefault: true,
}

export type DSXUPatchPlan = {
  goal: string
  files: readonly string[]
  oldText: string
  newText: string
  risk: 'low' | 'medium' | 'high'
  verificationCommand: readonly string[]
  rollback: 'snapshot-suggestion-only'
}

export type DSXUPatchApplyResult = {
  ok: boolean
  filePath: string
  snapshotPath: string
  changed: boolean
  failure?: {
    failureType: DSXUCodeFailureType
    message: string
  }
}

export type DSXUVerificationResult = {
  command: readonly string[]
  exitCode: number | null
  stdout: string
  stderr: string
  passed: boolean
  failureType: DSXUCodeFailureType
}

export type DSXUFinalPatchReport = {
  status: 'PASS' | 'FAIL' | 'PARTIAL'
  goal: string
  changedFiles: readonly string[]
  verification: DSXUVerificationResult
  modelCostEvidence?: {
    scenario: string
    totalCostUsd: number
    proOnlyCostUsd: number
    costPerSolvedUsd: number | null
    savingsVsProOnlyPct: number
    proNodeRatio: number
    cacheHitInputTokens?: number
    cacheMissInputTokens?: number
    outputTokens?: number
    cacheHitRatePct?: number
    cacheByModel?: readonly Array<{
      model: string
      cacheHitInputTokens: number
      cacheMissInputTokens: number
      outputTokens: number
      cacheHitRatePct: number
    }>
    cacheByRouteReason?: readonly Array<{
      routeReason: string
      cacheHitInputTokens: number
      cacheMissInputTokens: number
      outputTokens: number
      cacheHitRatePct: number
    }>
    proRoi?: {
      proNodeCount: number
      proNodesWithPriorFlashAttempt: number
      proNodesWithAdmissionReason: number
      proNodesMarkedSavedTask: number
      proRoiRatePct: number
      entries: readonly Array<{
        nodeId: string
        routeReason: string
        proAdmissionReason: string
        flashAttemptedBeforePro: boolean
        flashAttemptNodeIds: readonly string[]
        proSavedTask: boolean
        proSaveEvidence: string
      }>
    }
    routeReasons: readonly string[]
    modelEvidence: string
    costComplete: boolean
  }
  tracePath: string
  risks: readonly string[]
  summary: string
  workStateTimeline: DSXUWorkStateTimeline
}

export type DSXUEditProofEnvelope = {
  schemaVersion: 'dsxu.edit-proof-envelope.v5'
  owner: 'Tool Gate / VerificationKernel / Evidence'
  claim: string
  filesChanged: readonly string[]
  sourceEvidence: readonly string[]
  commandsRun: readonly string[]
  verification: 'pass' | 'fail' | 'not_run'
  remainingRisks: readonly string[]
  rollbackPoint: string
  claimAllowed: boolean
  guards: readonly string[]
  evidence: readonly string[]
}

export type DSXUSurgicalLoopTrace = {
  repoProfile: DSXURepoProfile
  repoIndex: DSXURepoIndex
  issueProfile: DSXUIssueProfile
  localization: DSXULocalizationResult
  contextPack: DSXUCodeContextPack
  metrics: {
    repoContextReductionPct: number
    regressionGuardPassed: boolean
  }
  patchPlan: DSXUPatchPlan
  repairAttempt: {
    applyResult: DSXUPatchApplyResult
    failureType: DSXUCodeFailureType
  }
  applyResult: DSXUPatchApplyResult
  verification: DSXUVerificationResult
  finalReport: DSXUFinalPatchReport
  events: readonly string[]
}

export function buildDSXUEditProofEnvelope(input: {
  claim: string
  filesChanged: readonly string[]
  sourceEvidence: readonly string[]
  commandsRun: readonly string[]
  verification: DSXUVerificationResult | 'not_run'
  remainingRisks?: readonly string[]
  rollbackPoint?: string
  risk?: 'low' | 'medium' | 'high' | 'critical'
}): DSXUEditProofEnvelope {
  const verification =
    input.verification === 'not_run'
      ? 'not_run'
      : input.verification.passed
        ? 'pass'
        : 'fail'
  const rollbackPoint = input.rollbackPoint?.trim() ?? ''
  const risk = input.risk ?? (input.filesChanged.length > 1 ? 'high' : 'medium')
  const guards = [
    !input.claim.trim() ? 'missing edit claim' : '',
    input.filesChanged.length === 0 ? 'missing changed files' : '',
    input.sourceEvidence.length === 0 ? 'missing source evidence' : '',
    verification === 'not_run' ? 'verification not run' : '',
    verification === 'fail' ? 'verification failed' : '',
    !rollbackPoint ? 'missing rollback point' : '',
    (input.remainingRisks?.length ?? 0) > 0 ? 'remaining risks unresolved' : '',
    (risk === 'high' || risk === 'critical') && input.sourceEvidence.length === 0
      ? 'high-risk edit missing source evidence'
      : '',
  ].filter(Boolean)
  const claimAllowed = guards.length === 0 && verification === 'pass'
  const commandsRun = input.verification === 'not_run'
    ? [...input.commandsRun]
    : [...new Set([...input.commandsRun, input.verification.command.join(' ')])]

  return {
    schemaVersion: 'dsxu.edit-proof-envelope.v5',
    owner: 'Tool Gate / VerificationKernel / Evidence',
    claim: input.claim.trim(),
    filesChanged: [...input.filesChanged],
    sourceEvidence: [...input.sourceEvidence],
    commandsRun,
    verification,
    remainingRisks: [...(input.remainingRisks ?? [])],
    rollbackPoint,
    claimAllowed,
    guards,
    evidence: [
      `filesChanged:${input.filesChanged.length}`,
      `sourceEvidence:${input.sourceEvidence.length}`,
      `verification:${verification}`,
      `rollbackPoint:${rollbackPoint || 'missing'}`,
      `claimAllowed:${String(claimAllowed)}`,
    ],
  }
}

function outputLooksLikePassingVerification(text: string): boolean {
  const lower = text.toLowerCase()
  if (/\b[1-9]\d*\s+fail\b/.test(lower) || /\bfailed\b/.test(lower) || /\berror\b/.test(lower)) {
    return false
  }
  return /\b0\s+fail\b/.test(lower) || /\b[1-9]\d*\s+pass(?:ed)?\b/.test(lower) || /\bpassed\b/.test(lower)
}

function outputLooksLikeFailedVerification(text: string): boolean {
  const lower = text.toLowerCase()
  return /\b[1-9]\d*\s+fail\b/.test(lower) || /\bfailed\b/.test(lower) || /\berror\b/.test(lower)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function walkFiles(root: string, dir = root, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    const rel = relative(root, full).replace(/[\\/]+/g, '/')
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'dist', 'build', '.dsxu'].includes(entry.name)) continue
      await walkFiles(root, full, out)
      continue
    }
    out.push(rel)
  }
  return out.sort()
}

export async function probeDSXURepo(root: string): Promise<DSXURepoProfile> {
  const packageJson = join(root, 'package.json')
  const evidenceFiles: string[] = []
  if (await pathExists(packageJson)) evidenceFiles.push('package.json')
  const pkg = evidenceFiles.includes('package.json')
    ? JSON.parse(await readFile(packageJson, 'utf8')) as { scripts?: Record<string, string>; devDependencies?: Record<string, string> }
    : {}
  const hasBunLock = await pathExists(join(root, 'bun.lock')) || await pathExists(join(root, 'bun.lockb'))
  const hasPnpm = await pathExists(join(root, 'pnpm-lock.yaml'))
  const hasYarn = await pathExists(join(root, 'yarn.lock'))
  const packageManager = hasBunLock ? 'bun' : hasPnpm ? 'pnpm' : hasYarn ? 'yarn' : evidenceFiles.length ? 'npm' : 'unknown'
  const scriptTest = pkg.scripts?.test
  const testCommand =
    packageManager === 'bun'
      ? ['bun', 'test']
      : packageManager === 'pnpm'
        ? ['pnpm', 'test']
        : packageManager === 'yarn'
          ? ['yarn', 'test']
          : scriptTest
            ? ['npm', 'test']
            : ['bun', 'test']

  return {
    root,
    language: pkg.devDependencies?.typescript || await pathExists(join(root, 'tsconfig.json')) ? 'typescript' : 'unknown',
    packageManager,
    testCommand,
    evidenceFiles,
  }
}

export async function buildDSXURepoIndex(root: string): Promise<DSXURepoIndex> {
  const files = await walkFiles(root)
  const sourceFiles = files.filter(file => /\.(ts|tsx|js|jsx|py)$/.test(file) && !/\.test\./.test(file))
  const testFiles = files.filter(file => /\.(test|spec)\.(ts|tsx|js|jsx|py)$/.test(file))
  const entryFiles = sourceFiles.filter(file => /(^|\/)(index|main|app)\.(ts|tsx|js|jsx)$/.test(file))
  return { root, files, sourceFiles, testFiles, entryFiles }
}

export function parseDSXUCodeIssue(input: {
  command: readonly string[]
  exitCode: number | null
  stdout?: string
  stderr?: string
}): DSXUIssueProfile {
  const stdout = input.stdout ?? ''
  const stderr = input.stderr ?? ''
  const combined = `${stdout}\n${stderr}`
  const timeout = /timeout|timed out/i.test(combined)
  const patch = /old_string|patch|apply failed|not found/i.test(combined)
  const testNames = [...combined.matchAll(/\((?:fail|pass)\)\s+([^\r\n]+)/gi)].map(match => match[1]?.trim() ?? '').filter(Boolean)
  const failureType: DSXUCodeFailureType =
    timeout ? 'TIMEOUT' : patch ? 'PATCH' : input.exitCode && input.exitCode !== 0 ? 'TEST' : 'UNKNOWN'
  return {
    failureType,
    command: [...input.command],
    exitCode: input.exitCode,
    stdout,
    stderr,
    summary: combined.split(/\r?\n/).find(line => /fail|error|expected|assert/i.test(line))?.trim() || combined.slice(0, 160),
    testNames,
  }
}

export function localizeDSXUCodeFiles(input: {
  query: string
  repoIndex: DSXURepoIndex
  issueProfile: DSXUIssueProfile
}): DSXULocalizationResult {
  const query = input.query.toLowerCase()
  const candidates = new Set<string>()
  const reasons: string[] = []
  for (const file of input.repoIndex.files) {
    const name = basename(file).toLowerCase()
    if (query.split(/[^a-z0-9]+/).some(token => token.length >= 3 && name.includes(token))) {
      candidates.add(file)
      reasons.push(`query-name:${file}`)
    }
  }
  for (const testFile of input.repoIndex.testFiles) {
    candidates.add(testFile)
    reasons.push(`test-file:${testFile}`)
    const sourceGuess = testFile.replace(/\.(test|spec)(\.[^.]+)$/, '$2')
    if (input.repoIndex.sourceFiles.includes(sourceGuess)) {
      candidates.add(sourceGuess)
      reasons.push(`test-source-pair:${sourceGuess}`)
    }
  }
  return { files: [...candidates].slice(0, 6), reasons }
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function approxTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4)
}

function queryAnchorTokens(query: string | undefined): string[] {
  return [...new Set((query ?? '').toLowerCase().split(/[^a-z0-9_.$-]+/).filter(token => token.length >= 3))]
    .slice(0, 24)
}

function lineAnchorId(file: string, line: number, text: string): string {
  return `capsule:${sha256(`${file}:${line}:${text}`).slice(0, 12)}`
}

function addAnchor(
  anchors: DSXUCodeSourceAnchor[],
  seenLines: Set<number>,
  file: string,
  line: number,
  text: string,
  reason: DSXUCodeSourceAnchor['reason'],
  maxAnchors: number,
): void {
  if (anchors.length >= maxAnchors || seenLines.has(line)) return
  const trimmed = text.trim()
  if (!trimmed) return
  seenLines.add(line)
  anchors.push({
    id: lineAnchorId(file, line, trimmed),
    line,
    text: trimmed.slice(0, 240),
    reason,
  })
}

function selectSourceAnchors(input: {
  path: string
  query?: string
  lines: readonly string[]
  maxAnchors: number
}): DSXUCodeSourceAnchor[] {
  const anchors: DSXUCodeSourceAnchor[] = []
  const seenLines = new Set<number>()
  const tokens = queryAnchorTokens(input.query)

  if (tokens.length > 0) {
    input.lines.forEach((line, index) => {
      const lower = line.toLowerCase()
      if (tokens.some(token => lower.includes(token))) {
        addAnchor(anchors, seenLines, input.path, index + 1, line, 'query-match', input.maxAnchors)
      }
    })
  }

  input.lines.forEach((line, index) => {
    if (/^\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var)\s+[A-Za-z_$][\w$]*/.test(line)) {
      addAnchor(anchors, seenLines, input.path, index + 1, line, 'symbol', input.maxAnchors)
    }
  })

  input.lines.forEach((line, index) => {
    if (/\b(?:describe|test|it|expect)\s*\(/.test(line)) {
      addAnchor(anchors, seenLines, input.path, index + 1, line, 'test-assertion', input.maxAnchors)
    }
  })

  input.lines.forEach((line, index) => {
    if (line.trim() && !line.trim().startsWith('//')) {
      addAnchor(anchors, seenLines, input.path, index + 1, line, 'first-meaningful-line', input.maxAnchors)
    }
  })

  return anchors.sort((a, b) => a.line - b.line).slice(0, input.maxAnchors)
}

function renderBoundedSourceExcerpt(input: {
  lines: readonly string[]
  anchors: readonly DSXUCodeSourceAnchor[]
  maxChars: number
}): string {
  const selectedLines = new Set<number>()
  for (const anchor of input.anchors) {
    selectedLines.add(Math.max(1, anchor.line - 1))
    selectedLines.add(anchor.line)
    selectedLines.add(Math.min(input.lines.length, anchor.line + 1))
  }
  const rendered: string[] = []
  for (const lineNumber of [...selectedLines].sort((a, b) => a - b)) {
    const text = input.lines[lineNumber - 1]
    if (text === undefined) continue
    rendered.push(`${lineNumber}: ${text}`)
    if (rendered.join('\n').length >= input.maxChars) break
  }
  const excerpt = rendered.join('\n')
  return excerpt.length > input.maxChars
    ? `${excerpt.slice(0, input.maxChars)}\n[DSXU source capsule excerpt truncated]`
    : excerpt
}

function sourceRiskTags(input: {
  path: string
  contentLength: number
  lineCount: number
  anchors: readonly DSXUCodeSourceAnchor[]
  excerptBudgetChars: number
  policy: DSXUReadFallbackPolicy
}): string[] {
  const tags: string[] = []
  if (input.lineCount > input.policy.largeFileLineThreshold) tags.push('large-file')
  if (input.contentLength > input.excerptBudgetChars) tags.push('bounded-excerpt')
  if (!input.anchors.some(anchor => anchor.reason === 'query-match')) tags.push('no-query-anchor')
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$|\/__tests__\//i.test(input.path)) tags.push('test-source')
  if (tags.includes('large-file')) tags.push('fallback-read-must-be-range-limited')
  return tags
}

export async function buildDSXUCodeSourceTruthCapsules(input: {
  root: string
  files: readonly string[]
  query?: string
  maxExcerptChars?: number
  maxAnchors?: number
  readFallbackPolicy?: Partial<DSXUReadFallbackPolicy>
}): Promise<DSXUCodeSourceTruthCapsule[]> {
  const excerptBudgetChars = Math.max(240, input.maxExcerptChars ?? DEFAULT_CODE_SOURCE_EXCERPT_CHARS)
  const maxAnchors = Math.max(1, input.maxAnchors ?? DEFAULT_CODE_SOURCE_MAX_ANCHORS)
  const policy = { ...DEFAULT_READ_FALLBACK_POLICY, ...(input.readFallbackPolicy ?? {}) }
  const capsules: DSXUCodeSourceTruthCapsule[] = []

  for (const file of [...new Set(input.files)]) {
    const full = join(input.root, file)
    const [content, info] = await Promise.all([
      readFile(full, 'utf8'),
      stat(full),
    ])
    const lines = content.split(/\r?\n/)
    const anchors = selectSourceAnchors({
      path: file,
      query: input.query,
      lines,
      maxAnchors,
    })
    const hash = sha256(content)
    capsules.push({
      capsuleId: `source:${sha256(`${file}:${hash}`).slice(0, 16)}`,
      path: file,
      sha256: hash,
      lineCount: lines.length,
      bytes: info.size,
      anchors,
      excerptBudgetChars,
      excerpt: renderBoundedSourceExcerpt({ lines, anchors, maxChars: excerptBudgetChars }),
      riskTags: sourceRiskTags({
        path: file,
        contentLength: content.length,
        lineCount: lines.length,
        anchors,
        excerptBudgetChars,
        policy,
      }),
      fallbackReadPolicy: policy,
    })
  }

  return capsules
}

export async function buildDSXUCodeContextPack(input: {
  root: string
  files: readonly string[]
  query?: string
  maxCharsPerFile?: number
  maxAnchorsPerFile?: number
  readFallbackPolicy?: Partial<DSXUReadFallbackPolicy>
}): Promise<DSXUCodeContextPack> {
  const maxCharsPerFile = input.maxCharsPerFile ?? 800
  const readFallbackPolicy = { ...DEFAULT_READ_FALLBACK_POLICY, ...(input.readFallbackPolicy ?? {}) }
  const sourceTruthCapsules = await buildDSXUCodeSourceTruthCapsules({
    root: input.root,
    files: input.files,
    query: input.query,
    maxExcerptChars: maxCharsPerFile,
    maxAnchors: input.maxAnchorsPerFile,
    readFallbackPolicy,
  })
  const packed = sourceTruthCapsules.map(capsule => ({
    path: capsule.path,
    snippet: [
      `capsuleId=${capsule.capsuleId}`,
      `sha256=${capsule.sha256}`,
      `lines=${capsule.lineCount}`,
      `anchors=${capsule.anchors.map(anchor => `${anchor.id}@L${anchor.line}:${anchor.reason}`).join(',')}`,
      `fallback=${capsule.fallbackReadPolicy.mode};maxLines=${capsule.fallbackReadPolicy.maxLinesPerRead};maxApproxTokens=${capsule.fallbackReadPolicy.maxApproxTokensPerRead}`,
      capsule.excerpt,
    ].join('\n'),
  }))
  const rawChars = sourceTruthCapsules.reduce((sum, item) => sum + item.bytes, 0)
  const packedChars = packed.reduce((sum, item) => sum + item.snippet.length, 0)
  const compressionRatio = rawChars <= 0
    ? 1
    : Math.min(1, Math.round((packedChars / rawChars) * 1000) / 1000)
  const guards = sourceTruthCapsules.flatMap(capsule => {
    const out: string[] = []
    if (capsule.anchors.length === 0) out.push(`${capsule.path}:no anchors selected`)
    if (capsule.riskTags.includes('fallback-read-must-be-range-limited')) {
      out.push(`${capsule.path}:fallback Read requires locator and bounded range`)
    }
    return out
  })
  return {
    files: packed,
    sourceTruthCapsules,
    readFallbackPolicy,
    estimatedInputTokens: Math.ceil(packedChars / 4),
    compressionRatio,
    rawChars,
    packedChars,
    cacheHygiene: {
      status: guards.length === 0 ? 'SOURCE_CAPSULE_READY' : 'SOURCE_CAPSULE_RISK',
      noReadDefault: readFallbackPolicy.noReadDefault,
      toolResultCharsAvoided: Math.max(0, rawChars - packedChars),
      guards,
    },
  }
}

export function decideDSXUReadFallback(input: {
  path: string
  capsules: readonly DSXUCodeSourceTruthCapsule[]
  offset?: number
  limit?: number
  locatorEvidence?: boolean
  reason?: string
  policy?: Partial<DSXUReadFallbackPolicy>
}): DSXUReadFallbackDecision {
  const capsule = input.capsules.find(item => item.path === input.path)
  const policy = { ...DEFAULT_READ_FALLBACK_POLICY, ...(capsule?.fallbackReadPolicy ?? {}), ...(input.policy ?? {}) }
  if (!capsule) {
    return {
      allowed: false,
      status: 'BLOCK_UNKNOWN_SOURCE',
      path: input.path,
      requestedOffset: input.offset,
      requestedLimit: input.limit,
      estimatedApproxTokens: 0,
      maxApproxTokensPerRead: policy.maxApproxTokensPerRead,
      reason: 'Read fallback must reference a known source-truth capsule.',
      evidence: ['missing:capsule'],
    }
  }

  const firstAnchor = capsule.anchors[0]
  const recommendedLimit = Math.min(policy.maxLinesPerRead, Math.max(1, capsule.lineCount))
  const recommendedOffset = firstAnchor
    ? Math.max(1, firstAnchor.line - Math.floor(recommendedLimit / 2))
    : 1
  const requestedOffset = input.offset
  const requestedLimit = input.limit
  const requestedIsFullFile = requestedLimit === undefined
  const averageCharsPerLine = Math.max(1, Math.ceil(capsule.bytes / Math.max(1, capsule.lineCount)))
  const estimatedApproxTokens = requestedLimit === undefined
    ? approxTokensFromChars(capsule.bytes)
    : approxTokensFromChars(Math.min(capsule.bytes, requestedLimit * averageCharsPerLine))
  const largeFile = capsule.lineCount > policy.largeFileLineThreshold || estimatedApproxTokens > policy.maxApproxTokensPerRead
  const evidence = [
    `capsule:${capsule.capsuleId}`,
    `path:${capsule.path}`,
    `lines:${capsule.lineCount}`,
    `estimatedApproxTokens:${estimatedApproxTokens}`,
    `maxApproxTokensPerRead:${policy.maxApproxTokensPerRead}`,
  ]

  if (requestedIsFullFile && largeFile) {
    return {
      allowed: false,
      status: 'BLOCK_FULL_FILE_READ',
      path: capsule.path,
      capsuleId: capsule.capsuleId,
      requestedOffset,
      requestedLimit,
      recommendedOffset,
      recommendedLimit,
      estimatedApproxTokens,
      maxApproxTokensPerRead: policy.maxApproxTokensPerRead,
      reason: 'Large source already has a source-truth capsule; fallback Read must be anchor-bounded instead of full-file.',
      evidence,
    }
  }

  if (largeFile && policy.requiresLocatorBeforeLargeRead && !input.locatorEvidence) {
    return {
      allowed: false,
      status: 'BLOCK_UNLOCATED_LARGE_READ',
      path: capsule.path,
      capsuleId: capsule.capsuleId,
      requestedOffset,
      requestedLimit,
      recommendedOffset,
      recommendedLimit,
      estimatedApproxTokens,
      maxApproxTokensPerRead: policy.maxApproxTokensPerRead,
      reason: 'Large-source fallback Read requires prior Grep/anchor/source-capsule locator evidence.',
      evidence,
    }
  }

  if ((requestedLimit ?? 0) > policy.maxLinesPerRead || estimatedApproxTokens > policy.maxApproxTokensPerRead) {
    return {
      allowed: false,
      status: 'BLOCK_OVER_BUDGET_READ',
      path: capsule.path,
      capsuleId: capsule.capsuleId,
      requestedOffset,
      requestedLimit,
      recommendedOffset,
      recommendedLimit,
      estimatedApproxTokens,
      maxApproxTokensPerRead: policy.maxApproxTokensPerRead,
      reason: 'Fallback Read exceeds DSXU code-mode cache hygiene budget.',
      evidence,
    }
  }

  return {
    allowed: true,
    status: 'ALLOW_BOUNDED_READ',
    path: capsule.path,
    capsuleId: capsule.capsuleId,
    requestedOffset,
    requestedLimit,
    recommendedOffset,
    recommendedLimit,
    estimatedApproxTokens,
    maxApproxTokensPerRead: policy.maxApproxTokensPerRead,
    reason: input.reason ?? 'Bounded fallback Read is compatible with source capsule and DeepSeek cache hygiene.',
    evidence,
  }
}

function toAbsolute(root: string, file: string): string {
  return file.match(/^[A-Za-z]:[\\/]|^\//) ? file : join(root, file)
}

function toRelative(root: string, file: string): string {
  return relative(root, file).replace(/[\\/]+/g, '/')
}

function classifyImpactRisk(result: BlastResult): DSXUCodeImpactRadar['riskLevel'] {
  if (result.totalAffected >= 12 || result.transitiveDependents.length >= 5) return 'high'
  if (result.totalAffected >= 4 || result.directDependents.length >= 2 || result.affectedTests.length === 0) return 'medium'
  return 'low'
}

export function buildDSXUCodeImpactRadar(input: {
  root: string
  changedFiles: readonly string[]
  maxDepth?: number
  verificationCommand?: readonly string[]
}): DSXUCodeImpactRadar {
  const graph = buildDepGraph(input.root)
  const changedAbs = input.changedFiles.map(file => toAbsolute(input.root, file))
  const blastRadius = computeBlastRadius(graph, changedAbs, input.maxDepth ?? 5)
  const riskLevel = classifyImpactRisk(blastRadius)
  const affectedTests = blastRadius.affectedTests.map(file => toRelative(input.root, file))
  const changedFiles = blastRadius.changedFiles.map(file => toRelative(input.root, file))
  const directDependents = blastRadius.directDependents.map(file => toRelative(input.root, file))
  const transitiveDependents = blastRadius.transitiveDependents.map(file => toRelative(input.root, file))
  const recommendedVerification = affectedTests.length > 0
    ? ['bun', 'test', ...affectedTests]
    : input.verificationCommand ?? ['bun', 'test']
  const evidence = [
    `changed:${changedFiles.join(',') || 'none'}`,
    `directDependents:${directDependents.length}`,
    `transitiveDependents:${transitiveDependents.length}`,
    `affectedTests:${affectedTests.join(',') || 'none'}`,
    `riskLevel:${riskLevel}`,
    `verification:${recommendedVerification.join(' ')}`,
  ]
  return {
    status: riskLevel === 'high' || affectedTests.length === 0 ? 'IMPACT_RADAR_NEEDS_REVIEW' : 'IMPACT_RADAR_READY',
    changedFiles,
    directDependents,
    transitiveDependents,
    affectedTests,
    totalAffected: blastRadius.totalAffected,
    riskLevel,
    recommendedVerification,
    evidence,
    blastRadius,
  }
}

export function buildDSXUEvidenceDrivenReview(input: {
  goal: string
  sourceTruthCapsules: readonly DSXUCodeSourceTruthCapsule[]
  impactRadar: DSXUCodeImpactRadar
  readFallbackDecisions?: readonly DSXUReadFallbackDecision[]
  verification?: DSXUVerificationResult
  repairCandidates?: readonly string[]
}): DSXUEvidenceDrivenReview {
  const findings: DSXUEvidenceDrivenReviewFinding[] = []
  for (const capsule of input.sourceTruthCapsules) {
    const firstAnchor = capsule.anchors[0]
    findings.push({
      severity: capsule.riskTags.includes('large-file') ? 'P2' : 'P3',
      title: 'Source truth capsule is bound to review evidence',
      path: capsule.path,
      line: firstAnchor?.line,
      evidence: [
        `capsule:${capsule.capsuleId}`,
        `sha256:${capsule.sha256}`,
        `anchors:${capsule.anchors.length}`,
        `riskTags:${capsule.riskTags.join(',') || 'none'}`,
      ],
      risk: capsule.riskTags.includes('large-file')
        ? 'Large file must stay capsule-first with bounded fallback Read.'
        : 'Source evidence is compact and reviewable.',
      repairCandidate: input.repairCandidates?.[0],
    })
  }

  if (input.impactRadar.riskLevel !== 'low') {
    findings.push({
      severity: input.impactRadar.riskLevel === 'high' ? 'P1' : 'P2',
      title: 'Impact radar requires focused verification',
      path: input.impactRadar.changedFiles[0] ?? 'unknown',
      evidence: input.impactRadar.evidence,
      risk: `Blast radius is ${input.impactRadar.riskLevel}; run the recommended focused verification before PASS.`,
      repairCandidate: `Run ${input.impactRadar.recommendedVerification.join(' ')}`,
    })
  }

  for (const decision of input.readFallbackDecisions ?? []) {
    if (!decision.allowed) {
      findings.push({
        severity: decision.status === 'BLOCK_FULL_FILE_READ' ? 'P2' : 'P3',
        title: 'Read fallback is blocked by cache hygiene',
        path: decision.path,
        evidence: decision.evidence,
        risk: decision.reason,
        repairCandidate: decision.recommendedOffset !== undefined && decision.recommendedLimit !== undefined
          ? `Read ${decision.path} with offset=${decision.recommendedOffset}, limit=${decision.recommendedLimit} after locator evidence.`
          : undefined,
      })
    }
  }

  if (input.verification && !input.verification.passed) {
    findings.push({
      severity: 'P1',
      title: 'Verification has not passed',
      path: input.impactRadar.changedFiles[0] ?? 'unknown',
      evidence: [
        `command:${input.verification.command.join(' ')}`,
        `exitCode:${input.verification.exitCode ?? 'null'}`,
        `failureType:${input.verification.failureType}`,
      ],
      risk: 'Review cannot approve PASS while focused verification is failing.',
      repairCandidate: 'Continue repair from the failing verification evidence.',
    })
  }

  const releaseClaimAllowed =
    input.sourceTruthCapsules.length > 0 &&
    input.impactRadar.affectedTests.length > 0 &&
    (input.verification?.passed ?? true) &&
    findings.every(finding => finding.severity !== 'P0' && finding.severity !== 'P1')
  const evidence = [
    `goal:${input.goal}`,
    ...input.sourceTruthCapsules.map(capsule => `capsule:${capsule.capsuleId}`),
    ...input.impactRadar.evidence,
    ...(input.verification ? [`verification:${input.verification.command.join(' ')}:${input.verification.passed}`] : ['verification:not-run']),
  ]
  return {
    status: releaseClaimAllowed ? 'EVIDENCE_REVIEW_READY' : 'EVIDENCE_REVIEW_BLOCKED',
    goal: input.goal,
    summary: releaseClaimAllowed
      ? 'Evidence-driven review is ready for owner review and focused verification replay.'
      : 'Evidence-driven review has blocking or medium/high risk evidence that must be addressed before PASS.',
    findings,
    sourceTruthCapsuleIds: input.sourceTruthCapsules.map(capsule => capsule.capsuleId),
    impactRadarStatus: input.impactRadar.status,
    verificationCommand: input.impactRadar.recommendedVerification,
    releaseClaimAllowed,
    evidence,
  }
}

export function createDSXUPatchPlan(input: {
  goal: string
  file: string
  oldText: string
  newText: string
  verificationCommand: readonly string[]
}): DSXUPatchPlan {
  return {
    goal: input.goal,
    files: [input.file],
    oldText: input.oldText,
    newText: input.newText,
    risk: input.oldText.split(/\r?\n/).length <= 3 ? 'low' : 'medium',
    verificationCommand: [...input.verificationCommand],
    rollback: 'snapshot-suggestion-only',
  }
}

export async function applyDSXUSurgicalPatch(input: {
  root: string
  plan: DSXUPatchPlan
  snapshotDir: string
}): Promise<DSXUPatchApplyResult> {
  const filePath = join(input.root, input.plan.files[0] ?? '')
  const snapshotPath = join(input.snapshotDir, `${basename(filePath)}.${Date.now()}.snapshot`)
  await mkdir(dirname(snapshotPath), { recursive: true })
  await copyFile(filePath, snapshotPath)
  const before = await readFile(filePath, 'utf8')
  if (!before.includes(input.plan.oldText)) {
    return {
      ok: false,
      filePath,
      snapshotPath,
      changed: false,
      failure: { failureType: 'PATCH', message: 'old text not found; no automatic rollback executed' },
    }
  }
  await writeFile(filePath, before.replace(input.plan.oldText, input.plan.newText), 'utf8')
  return { ok: true, filePath, snapshotPath, changed: true }
}

export async function runDSXUVerification(input: {
  root: string
  command: readonly string[]
  timeoutMs?: number
}): Promise<DSXUVerificationResult> {
  const [exe, ...args] = input.command
  if (!exe) throw new Error('verification command is empty')
  try {
    const result = await execFileAsync(exe, args, {
      cwd: input.root,
      timeout: input.timeoutMs ?? 60_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    const combined = `${result.stdout}\n${result.stderr}`
    const passed = outputLooksLikePassingVerification(combined)
    return {
      command: [...input.command],
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
      passed,
      failureType: passed ? 'UNKNOWN' : outputLooksLikeFailedVerification(combined) ? 'TEST' : 'UNKNOWN',
    }
  } catch (caught) {
    const error = caught as { code?: number | string; stdout?: string; stderr?: string; message?: string }
    const parsed = parseDSXUCodeIssue({
      command: input.command,
      exitCode: typeof error.code === 'number' ? error.code : null,
      stdout: error.stdout,
      stderr: error.stderr ?? error.message,
    })
    return {
      command: [...input.command],
      exitCode: parsed.exitCode,
      stdout: parsed.stdout,
      stderr: parsed.stderr,
      passed: false,
      failureType: parsed.failureType,
    }
  }
}

export function buildDSXUFinalPatchReport(input: {
  goal: string
  changedFiles: readonly string[]
  verification: DSXUVerificationResult
  tracePath: string
  modelCostEvidence?: DSXUFinalPatchReport['modelCostEvidence']
  permissionEvidence?: readonly string[]
  agentEvidence?: readonly string[]
  mcpEvidence?: readonly string[]
  trajectoryEvidence?: readonly string[]
  nextAction?: string
}): DSXUFinalPatchReport {
  const costSuffix = input.modelCostEvidence?.costComplete
    ? ` Cost evidence: $${input.modelCostEvidence.totalCostUsd.toFixed(6)} total, ${input.modelCostEvidence.savingsVsProOnlyPct}% saved vs Pro-only.`
    : ''
  const workStateTimeline = buildDSXUFinalReportWorkStateTimeline(input)
  const timelineSuffix = ` Work-state timeline: ${workStateTimeline.status}.`
  return {
    status: input.verification.passed ? 'PASS' : 'FAIL',
    goal: input.goal,
    changedFiles: input.changedFiles,
    verification: input.verification,
    modelCostEvidence: input.modelCostEvidence,
    tracePath: input.tracePath,
    risks: input.verification.passed ? ['No known residual risk from focused replay.'] : ['Verification failed; do not claim PASS.'],
    summary: input.verification.passed
      ? `Applied focused patch to ${input.changedFiles.join(', ')} and verified with ${input.verification.command.join(' ')}.${costSuffix}${timelineSuffix}`
      : `Patch did not verify with ${input.verification.command.join(' ')}.${timelineSuffix}`,
    workStateTimeline,
  }
}

function compactEvidence(items: readonly string[]): string[] {
  const seen = new Set<string>()
  const compacted: string[] = []
  for (const item of items) {
    const normalized = item.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    compacted.push(normalized)
  }
  return compacted
}

function commandToEvidence(command: readonly string[]): string {
  return command.length === 0 ? 'command:<empty>' : `command:${command.join(' ')}`
}

function firstDeepSeekModel(modelEvidence: string | undefined): string | undefined {
  return modelEvidence?.match(/deepseek-v4-(?:flash|pro)/)?.[0]
}

function firstRouteReason(routeReasons: readonly string[] | undefined): string | undefined {
  if (!routeReasons || routeReasons.length === 0) return undefined
  const first = routeReasons[0]
  const separatorIndex = first.indexOf(':')
  return separatorIndex >= 0 ? first.slice(separatorIndex + 1) : first
}

export function buildDSXUFinalReportWorkStateTimeline(input: {
  goal: string
  changedFiles: readonly string[]
  verification: DSXUVerificationResult
  tracePath: string
  modelCostEvidence?: DSXUFinalPatchReport['modelCostEvidence']
  permissionEvidence?: readonly string[]
  agentEvidence?: readonly string[]
  mcpEvidence?: readonly string[]
  trajectoryEvidence?: readonly string[]
  nextAction?: string
}): DSXUWorkStateTimeline {
  const changedFileEvidence = input.changedFiles.length === 0
    ? ['changedFiles:none']
    : input.changedFiles.map(file => `changed:${file}`)
  const verificationEvidence = [
    commandToEvidence(input.verification.command),
    `exitCode:${input.verification.exitCode ?? 'null'}`,
    `passed:${input.verification.passed}`,
    `failureType:${input.verification.failureType}`,
  ]
  const costEvidence = input.modelCostEvidence
  const events: DSXUWorkStateEvent[] = [
    {
      id: 'final-report-source-truth',
      kind: 'source_truth',
      status: 'completed',
      title: 'Final report links trace and changed source truth',
      owner: 'Source Truth Repair',
      evidence: compactEvidence([
        `trace:${input.tracePath}`,
        ...changedFileEvidence,
      ]),
    },
    {
      id: 'final-report-tool-verification',
      kind: 'tool',
      status: input.verification.passed ? 'completed' : 'failed',
      title: 'Focused verification command is visible',
      owner: 'Tool Gate',
      risk: input.changedFiles.length > 0 ? 'medium' : 'low',
      evidence: compactEvidence(verificationEvidence),
    },
    {
      id: 'final-report-permission-visibility',
      kind: 'permission',
      status: input.changedFiles.length > 0 ? 'completed' : 'skipped',
      title: 'Scoped mutation evidence is visible to the operator',
      owner: 'Permission Gate',
      detail: 'Projection only; permission decisions remain owned by the Tool Gate path.',
      evidence: compactEvidence([
        `mutatingFiles:${input.changedFiles.length}`,
        `trace:${input.tracePath}`,
        ...(input.permissionEvidence ?? []),
      ]),
    },
    {
      id: 'final-report-cost-route-cache',
      kind: 'cost',
      status: costEvidence?.costComplete ? 'completed' : 'blocked',
      title: 'DeepSeek route, cost, cache, and trajectory evidence',
      owner: 'DeepSeek Model Router / Cost Evidence',
      model: firstDeepSeekModel(costEvidence?.modelEvidence),
      routeReason: firstRouteReason(costEvidence?.routeReasons),
      costUsd: costEvidence?.costComplete ? costEvidence.totalCostUsd : undefined,
      evidence: compactEvidence([
        costEvidence ? `scenario:${costEvidence.scenario}` : 'scenario:missing',
        costEvidence ? `costComplete:${costEvidence.costComplete}` : 'costComplete:false',
        costEvidence ? `savingsVsProOnlyPct:${costEvidence.savingsVsProOnlyPct}` : 'savingsVsProOnlyPct:missing',
        costEvidence?.cacheHitRatePct !== undefined ? `cacheHitRatePct:${costEvidence.cacheHitRatePct}` : 'cacheHitRatePct:missing',
        costEvidence ? `proNodeRatio:${costEvidence.proNodeRatio}` : 'proNodeRatio:missing',
        ...(costEvidence?.routeReasons ?? []).map(reason => `route:${reason}`),
        ...(input.trajectoryEvidence ?? []),
      ]),
    },
  ]

  if (!input.verification.passed) {
    events.push(
      {
        id: 'final-report-failure',
        kind: 'failure',
        status: 'failed',
        title: 'Verification failure is visible',
        owner: 'Recovery Mainline',
        risk: 'high',
        evidence: compactEvidence(verificationEvidence),
      },
      {
        id: 'final-report-recovery-next',
        kind: 'recovery',
        status: 'blocked',
        title: 'Recovery must continue before PASS',
        owner: 'Recovery Mainline',
        evidence: ['nextAction:continue recovery; do not claim PASS'],
      },
    )
  }

  if ((input.agentEvidence ?? []).length > 0) {
    events.push({
      id: 'final-report-agent-evidence',
      kind: 'agent',
      status: 'completed',
      title: 'Agent ownership evidence is projected',
      owner: 'Agent Lifecycle',
      evidence: compactEvidence(input.agentEvidence ?? []),
    })
  }

  if ((input.mcpEvidence ?? []).length > 0) {
    events.push({
      id: 'final-report-mcp-skill-evidence',
      kind: 'evidence',
      status: 'completed',
      title: 'MCP and Skill registry evidence is projected',
      owner: 'MCP / Skill Registry',
      evidence: compactEvidence(input.mcpEvidence ?? []),
    })
  }

  events.push({
    id: 'final-report-evidence',
    kind: 'evidence',
    status: 'completed',
    title: 'Final patch report evidence is linked',
    owner: 'Evidence / Release',
    evidence: compactEvidence([
      `trace:${input.tracePath}`,
      commandToEvidence(input.verification.command),
      ...changedFileEvidence,
    ]),
  })

  return buildDSXUWorkStateTimeline({
    goal: input.goal,
    plan: [
      'Read source truth and record the trace',
      'Run scoped tool or patch path through Tool Gate ownership',
      'Verify with focused command evidence',
      'Project DeepSeek route, cost, cache, and trajectory evidence',
      'Report risks, evidence, and next action',
    ],
    currentStepId: input.verification.passed ? 'final-report-evidence' : 'final-report-recovery-next',
    nextAction: input.nextAction ?? (
      input.verification.passed
        ? 'ready for owner review or next V26 gate'
        : 'continue recovery before any PASS or release claim'
    ),
    events,
    requiresSourceTruth: true,
    requiresPermissionVisibility: input.changedFiles.length > 0,
    requiresCostVisibility: true,
  })
}
