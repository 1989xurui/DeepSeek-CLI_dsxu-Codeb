import { execFile } from 'child_process'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'
import { promisify } from 'util'

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
  estimatedInputTokens: number
  compressionRatio: number
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

export async function buildDSXUCodeContextPack(input: {
  root: string
  files: readonly string[]
  maxCharsPerFile?: number
}): Promise<DSXUCodeContextPack> {
  const maxCharsPerFile = input.maxCharsPerFile ?? 800
  const packed: Array<{ path: string; snippet: string }> = []
  let rawChars = 0
  for (const file of input.files) {
    const full = join(input.root, file)
    const content = await readFile(full, 'utf8')
    rawChars += content.length
    packed.push({
      path: file,
      snippet: content.length > maxCharsPerFile ? `${content.slice(0, maxCharsPerFile)}\n[truncated]` : content,
    })
  }
  const packedChars = packed.reduce((sum, item) => sum + item.snippet.length, 0)
  return {
    files: packed,
    estimatedInputTokens: Math.ceil(packedChars / 4),
    compressionRatio: rawChars <= 0 ? 1 : Math.round((packedChars / rawChars) * 1000) / 1000,
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
}): DSXUFinalPatchReport {
  const costSuffix = input.modelCostEvidence?.costComplete
    ? ` Cost evidence: $${input.modelCostEvidence.totalCostUsd.toFixed(6)} total, ${input.modelCostEvidence.savingsVsProOnlyPct}% saved vs Pro-only.`
    : ''
  return {
    status: input.verification.passed ? 'PASS' : 'FAIL',
    goal: input.goal,
    changedFiles: input.changedFiles,
    verification: input.verification,
    modelCostEvidence: input.modelCostEvidence,
    tracePath: input.tracePath,
    risks: input.verification.passed ? ['No known residual risk from focused replay.'] : ['Verification failed; do not claim PASS.'],
    summary: input.verification.passed
      ? `Applied focused patch to ${input.changedFiles.join(', ')} and verified with ${input.verification.command.join(' ')}.${costSuffix}`
      : `Patch did not verify with ${input.verification.command.join(' ')}.`,
  }
}
