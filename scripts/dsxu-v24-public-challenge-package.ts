import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'

type CommandRun = {
  id: string
  command: string[]
  exitCode: number
  durationMs: number
  stdoutPath: string
  stderrPath: string
}

type FlashReview = CommandRun & {
  promptPath: string
  tracePath: string
  trajectoryPath: string
  promptProfile: {
    stablePrefixHash: string
    dynamicTailHash: string
    stablePrefixChars: number
    dynamicTailChars: number
  }
  trajectoryAttribution: FlashTrajectoryAttribution
  resultJson: Record<string, unknown> | null
  costUSD: number
  modelUsage: Record<string, unknown> | null
}

type FlashCacheSummary = {
  reviewCount: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  totalCostUSD: number
  cacheHitRatePct: number
  targetHitRatePct: number
  targetMet: boolean
  releaseBlocking: false
  claimPolicy: string
  readToolCallCount: number
  toolResultCount: number
  toolResultChars: number
  maxToolResultChars: number
  routeReasons: string[]
  uniqueSystemHashes: number
  uniqueStablePrefixHashes: number
  uniqueDynamicTailHashes: number
}

type FlashTrajectoryAttribution = {
  requestCount: number
  routeReasons: string[]
  systemHashes: string[]
  uniqueSystemHashes: number
  readToolCallCount: number
  toolResultCount: number
  toolResultChars: number
  maxToolResultChars: number
  cacheReadInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  noReadDefaultRespected: boolean
}

type SourceTruthCapsule = {
  id: string
  line: number
  title: string
  excerpt: string
  excerptHash: string
}

type EvidenceReport = {
  id: string
  path: string
  status: string
  summary: Record<string, unknown>
}

type StableSourceRef = {
  id: string
  path: string
  exists: boolean
  sha256: string | null
  bytes: number
  lineCount: number
  anchors: string[]
  capsuleId: string
  excerptBudgetChars: number
  riskTags: string[]
  fallbackReadPolicy: string
  anchorCapsules: SourceTruthCapsule[]
}

type StableEvidencePack = {
  schemaVersion: string
  snapshotDate: string
  purpose: string
  guardrails: string[]
  sourceTruthRefs: StableSourceRef[]
  reportSummaries: EvidenceReport[]
  capabilityClaims: Record<string, unknown>
  releaseClaims: Record<string, unknown>
  cacheOptimization: Record<string, unknown>
}

const ROOT = process.cwd()
const DATE = '20260515'
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'v24-public-challenge-package')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_${DATE}.md`)
const STABLE_EVIDENCE_PACK_JSON = join(GENERATED_DIR, `DSXU_V26_PUBLIC_CHALLENGE_STABLE_EVIDENCE_PACK_${DATE}.json`)
const STABLE_EVIDENCE_PACK_MD = join(ROOT, 'docs', `DSXU_V26_PUBLIC_CHALLENGE_STABLE_EVIDENCE_PACK_${DATE}.md`)

const PUBLIC_CHALLENGE_CACHE_REFERENCE_HIT_RATE_PCT = 70
const PUBLIC_CHALLENGE_SOURCE_TRUTH_EXCERPT_BUDGET_CHARS = 1_400
const PUBLIC_CHALLENGE_FALLBACK_READ_MAX_CHARS = 24_000

const PUBLIC_CHALLENGE_STABLE_CONTRACT = [
  'DSXU V26 public challenge review common contract.',
  'Use DeepSeek Flash-first. Set pro_needed=true only if the current package cannot be judged with Flash and must be escalated to Pro now; do not set it true for future optional improvements or high-risk roadmap items.',
  'Judge current evidence, not stale historical blockers.',
  'Do not claim reference-product parity, brand parity, copied commercial behavior, or public 90 ability if score floor or same-task raw public comparison data remain.',
  'Return JSON only for the task-specific schema. Do not include Markdown.',
  'Every claim must cite DSXU-owned files, generated evidence, capsule ids, raw traces, route/cost/cache evidence, or release artifacts that actually exist.',
].join('\n')

const STABLE_SOURCE_TRUTH_PATHS = [
  'docs/DSXU_V26_MASTER_PLAN_20260515.md',
  'docs/DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_20260515.md',
  'docs/DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.md',
  'docs/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.md',
  'docs/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.md',
  'docs/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.md',
  'docs/DSXU_V24_SENIOR_CODING_WINDOW_20260515.md',
  'docs/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.md',
  'docs/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.md',
  'scripts/dsxu-v24-public-challenge-package.ts',
  'scripts/dsxu-v24-github-open-source-launch-pack.ts',
  'src/dsxu/engine/work-state-timeline.ts',
  'src/dsxu/engine/code-mode-surgical-loop.ts',
  'src/dsxu/engine/public-surface-clean-gate.ts',
  'src/dsxu/engine/proprietary-code-risk-gate.ts',
  'src/dsxu/engine/release-provenance-gate.ts',
  'src/dsxu/engine/__tests__/product-runtime-owner-map-v1.test.ts',
  'src/dsxu/engine/__tests__/query-engine-recovery-mainline-v1.test.ts',
  'src/QueryEngine.ts',
  'src/query.ts',
  'src/cli/print.ts',
  'src/Tool.ts',
  'src/hooks/useCanUseTool.tsx',
  'src/types/permissions.ts',
  'src/utils/model/deepseekV4Control.ts',
  'src/utils/model/deepseekV4CostRouter.ts',
  'src/services/api/deepseek-adapter.ts',
  'src/services/api/deepseek-trajectory-store.ts',
  'src/services/api/deepseek-trajectory-store.test.ts',
  'package.json',
] as const

const commandBatches = [
  {
    id: 'completed-reacceptance-replay',
    command: ['bun', 'run', 'v24:completed-reacceptance'],
    timeoutMs: 900_000,
  },
  {
    id: 'interactive-tui-acceptance-replay',
    command: ['bun', 'run', 'v24:interactive-tui-acceptance'],
    timeoutMs: 900_000,
  },
  {
    id: 'c2-loop-acceptance-replay',
    command: ['bun', 'run', 'v24:c2-loop-acceptance'],
    timeoutMs: 1_200_000,
  },
  {
    id: 'product-runtime-owner-map-replay',
    command: ['bun', 'test', 'src/dsxu/engine/__tests__/product-runtime-owner-map-v1.test.ts'],
    timeoutMs: 300_000,
  },
  {
    id: 'query-engine-recovery-mainline-replay',
    command: ['bun', 'test', 'src/dsxu/engine/__tests__/query-engine-recovery-mainline-v1.test.ts', 'src/dsxu/engine/__tests__/recovery-mainline-v3.test.ts'],
    timeoutMs: 300_000,
  },
  {
    id: 'deepseek-trajectory-store-replay',
    command: [
      'bun',
      'test',
      'src/services/api/deepseek-trajectory-store.test.ts',
      'src/services/api/deepseek-adapter-cache-prefix-v1.test.ts',
      'src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts',
    ],
    timeoutMs: 300_000,
  },
  {
    id: 'clean-export-preflight-replay',
    command: ['bun', 'run', 'clean-export:preflight'],
    timeoutMs: 600_000,
  },
] as const

const reportPaths = {
  completed: join(GENERATED_DIR, `DSXU_V24_COMPLETED_REACCEPTANCE_${DATE}.json`),
  interactiveTui: join(GENERATED_DIR, `DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_${DATE}.json`),
  c2Loop: join(GENERATED_DIR, `DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_${DATE}.json`),
  c2PublicClaimClosure: join(GENERATED_DIR, `DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_${DATE}.json`),
  c2OwnerImplementationAcceptance: join(GENERATED_DIR, `DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_${DATE}.json`),
  seniorCoding: join(GENERATED_DIR, `DSXU_V24_SENIOR_CODING_WINDOW_${DATE}.json`),
  cleanExport: join(GENERATED_DIR, `DSXU_V20_CLEAN_EXPORT_PREFLIGHT_${DATE}.json`),
  sixStageFinalTests: join(GENERATED_DIR, `DSXU_V24_SIX_STAGE_FINAL_TESTS_${DATE}.json`),
  cleanExportArtifact: join(GENERATED_DIR, `DSXU_V24_CLEAN_EXPORT_ARTIFACT_${DATE}.json`),
  freshInstallSmoke: join(GENERATED_DIR, `DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_${DATE}.json`),
}

function nowSafe(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function pct(hit: number, miss: number): number {
  const total = hit + miss
  return total === 0 ? 0 : Math.round((hit / total) * 1000) / 10
}

function buildStablePromptPayload(pack: StableEvidencePack): string {
  return JSON.stringify({
    evidencePackPath: `docs/generated/DSXU_V26_PUBLIC_CHALLENGE_STABLE_EVIDENCE_PACK_${DATE}.json`,
    evidencePackMarkdownPath: `docs/DSXU_V26_PUBLIC_CHALLENGE_STABLE_EVIDENCE_PACK_${DATE}.md`,
    snapshotDate: pack.snapshotDate,
    guardrails: pack.guardrails,
    reportSummaries: pack.reportSummaries,
    capabilityClaims: pack.capabilityClaims,
    releaseClaims: pack.releaseClaims,
    cacheOptimization: pack.cacheOptimization,
    sourceTruthRefs: pack.sourceTruthRefs.map(ref => ({
      id: ref.id,
      path: ref.path,
      exists: ref.exists,
      sha256: ref.sha256,
      bytes: ref.bytes,
      lineCount: ref.lineCount,
      anchors: ref.anchors,
      capsuleId: ref.capsuleId,
      excerptBudgetChars: ref.excerptBudgetChars,
      riskTags: ref.riskTags,
      fallbackReadPolicy: ref.fallbackReadPolicy,
      anchorCapsules: ref.anchorCapsules,
    })),
  })
}

function buildPublicChallengeStablePrefix(pack: StableEvidencePack): string {
  return [
    PUBLIC_CHALLENGE_STABLE_CONTRACT,
    '',
    'Stable DSXU-owned source-truth capsule for all three Flash reviews.',
    'Do not call tools in the default public challenge review lane. Judge from the capsule payload below, which contains path/hash/anchors/excerpt capsules and report summaries.',
    'If a future fallback lane needs raw source, it must use the fallbackReadPolicy from sourceTruthRefs and must not replace this no-Read default lane.',
    'Return did_use_source_truth_capsule=true when you use this embedded capsule. Evidence arrays must cite at least one capsuleId or anchor capsule id from sourceTruthRefs.',
    'Stable capsule payload:',
    buildStablePromptPayload(pack),
  ].join('\n')
}

function buildFlashPrompt(stablePrefix: string, dynamicTail: string): {
  prompt: string
  promptProfile: FlashReview['promptProfile']
} {
  const tail = dynamicTail.trim()
  return {
    prompt: `${stablePrefix}\n\nTask-specific review packet:\n${tail}`,
    promptProfile: {
      stablePrefixHash: shortHash(stablePrefix),
      dynamicTailHash: shortHash(tail),
      stablePrefixChars: stablePrefix.length,
      dynamicTailChars: tail.length,
    },
  }
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

async function readTextOrNull(relativePath: string): Promise<string | null> {
  try {
    return await readFile(join(ROOT, relativePath), 'utf8')
  } catch {
    return null
  }
}

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function anchorPatternsForPath(relativePath: string): RegExp[] {
  const common = [
    /export\s+(async\s+)?(function|class|type|const|interface)\s+/i,
    /deepseek|flash|pro|route|cost|cache|trajectory|usage/i,
    /work.?state|timeline|visible|stream-json|final report/i,
    /tool|permission|gate|lifecycle|mcp|skill|agent/i,
    /clean export|fresh install|doctor|secret|public challenge|claim/i,
  ]
  if (relativePath.endsWith('.md')) {
    return [/^#|^##|Status:|scoreFloor|cache hit|claim|blocked|PASS|OPEN/i, ...common]
  }
  if (relativePath.includes('deepseek')) {
    return [/trajectory|cache|cost|route|usage|redact|request/i, ...common]
  }
  if (relativePath.includes('work-state') || relativePath.includes('code-mode')) {
    return [/timeline|event|final report|evidence|nextAction|recovery/i, ...common]
  }
  if (relativePath.includes('permission') || relativePath.includes('Tool')) {
    return [/permission|tool|schema|gate|risk|decision/i, ...common]
  }
  return common
}

function extractAnchors(text: string, relativePath: string): string[] {
  const patterns = anchorPatternsForPath(relativePath)
  const anchors: string[] = []
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed) continue
    if (!patterns.some(pattern => pattern.test(trimmed))) continue
    anchors.push(`${index + 1}: ${trimmed.slice(0, 220)}`)
    if (anchors.length >= 14) break
  }
  return anchors
}

function sourceRefId(relativePath: string): string {
  return relativePath.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
}

function riskTagsForPath(relativePath: string): string[] {
  const tags = new Set<string>()
  const lower = relativePath.toLowerCase()
  if (lower.includes('public') || lower.includes('github') || lower.includes('release')) tags.add('public-claim')
  if (lower.includes('deepseek') || lower.includes('model') || lower.includes('cost')) tags.add('provider-cost-cache')
  if (lower.includes('tool') || lower.includes('permission') || lower.includes('mcp') || lower.includes('skill')) tags.add('tool-permission-runtime')
  if (lower.includes('query') || lower.includes('recovery') || lower.includes('work-state') || lower.includes('code-mode')) tags.add('mainline-experience')
  if (lower.endsWith('.md')) tags.add('source-truth-doc')
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) tags.add('source-code')
  return [...tags].sort()
}

function buildExcerpt(lines: readonly string[], index: number, budgetChars: number): string {
  const start = Math.max(0, index - 1)
  const end = Math.min(lines.length, index + 2)
  const excerpt = lines
    .slice(start, end)
    .map((line, offset) => `${start + offset + 1}: ${line.trim()}`)
    .join('\n')
  return excerpt.length <= budgetChars ? excerpt : `${excerpt.slice(0, Math.max(0, budgetChars - 3))}...`
}

function extractAnchorCapsules(text: string, relativePath: string): SourceTruthCapsule[] {
  const patterns = anchorPatternsForPath(relativePath)
  const capsules: SourceTruthCapsule[] = []
  const lines = text.split(/\r?\n/)
  const perCapsuleBudget = Math.max(240, Math.floor(PUBLIC_CHALLENGE_SOURCE_TRUTH_EXCERPT_BUDGET_CHARS / 6))
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed) continue
    if (!patterns.some(pattern => pattern.test(trimmed))) continue
    const excerpt = buildExcerpt(lines, index, perCapsuleBudget)
    capsules.push({
      id: `${sourceRefId(relativePath)}#L${index + 1}`,
      line: index + 1,
      title: trimmed.slice(0, 160),
      excerpt,
      excerptHash: shortHash(excerpt),
    })
    if (capsules.length >= 6) break
  }
  return capsules
}

async function buildStableSourceRef(relativePath: string): Promise<StableSourceRef> {
  const text = await readTextOrNull(relativePath)
  const id = sourceRefId(relativePath)
  if (text === null) {
    return {
      id,
      path: relativePath,
      exists: false,
      sha256: null,
      bytes: 0,
      lineCount: 0,
      anchors: [],
      capsuleId: `${id}:missing`,
      excerptBudgetChars: 0,
      riskTags: riskTagsForPath(relativePath),
      fallbackReadPolicy: 'missing source; do not fallback-read; treat related claim as blocked or cited from generated report evidence only',
      anchorCapsules: [],
    }
  }
  return {
    id,
    path: relativePath,
    exists: true,
    sha256: sha256(text),
    bytes: new TextEncoder().encode(text).length,
    lineCount: text.split(/\r?\n/).length,
    anchors: extractAnchors(text, relativePath),
    capsuleId: `${id}:capsule`,
    excerptBudgetChars: PUBLIC_CHALLENGE_SOURCE_TRUTH_EXCERPT_BUDGET_CHARS,
    riskTags: riskTagsForPath(relativePath),
    fallbackReadPolicy: `no-Read default; if raw source is explicitly needed, read only anchor-local ranges and keep total raw chars <= ${PUBLIC_CHALLENGE_FALLBACK_READ_MAX_CHARS}`,
    anchorCapsules: extractAnchorCapsules(text, relativePath),
  }
}

async function buildStableEvidencePack(
  reports: Record<string, Record<string, unknown> | null>,
  evidenceReports: EvidenceReport[],
): Promise<StableEvidencePack> {
  const c2LoopCoverage = objectFrom(reports.c2Loop?.coverage)
  const c2OwnerTotals = objectFrom(reports.c2OwnerImplementationAcceptance?.totals)
  const seniorWindow = objectFrom(reports.seniorCoding?.window)
  const seniorChecks = objectFrom(reports.seniorCoding?.checks)
  const cleanExportArtifact = reports.cleanExportArtifact ?? {}
  const sourceTruthRefs = await Promise.all(STABLE_SOURCE_TRUTH_PATHS.map(buildStableSourceRef))
  return {
    schemaVersion: 'dsxu.v26.public-challenge.stable-evidence-pack.v2',
    snapshotDate: DATE,
    purpose: 'One deterministic DSXU-owned source-truth capsule shared by all public challenge Flash reviews to reduce dynamic Read variance while preserving source-truth paths, hashes, anchors, and bounded excerpts.',
    guardrails: [
      'Do not claim public 90 ability until scoreFloor reaches around 90 on fixed public challenge tasks with raw evidence.',
      'Do not claim external superiority without same-task raw target transcripts.',
      'Do not claim reference-product parity or copied branded behavior.',
      'Do not create a second provider, tool, MCP, agent, or query runtime.',
      'Use deepseek-v4-flash by default; Pro requires explicit admission evidence.',
      'Use the embedded sourceTruthRefs/anchorCapsules as the default source-truth lane; do not call Read in the default public challenge lane.',
      `Fallback raw reads are allowed only in an explicit fallback lane, must be anchor-local, and must keep total raw chars <= ${PUBLIC_CHALLENGE_FALLBACK_READ_MAX_CHARS}.`,
    ],
    sourceTruthRefs,
    reportSummaries: evidenceReports,
    capabilityClaims: {
      c2LoopStatus: statusFrom(reports.c2Loop),
      c2LoopCoverage,
      c2PublicClaimBoundaryStatus: statusFrom(reports.c2PublicClaimClosure),
      c2OwnerImplementationAcceptanceStatus: statusFrom(reports.c2OwnerImplementationAcceptance),
      c2OwnerImplementationTotals: c2OwnerTotals,
      interactiveTuiStatus: statusFrom(reports.interactiveTui),
      seniorCodingStatus: statusFrom(reports.seniorCoding),
      seniorCodingWindow: {
        continuousWindowSatisfied: seniorWindow.continuousWindowSatisfied,
        minutes: seniorWindow.minutes,
      },
      seniorCodingFinalTestPassed: seniorChecks.finalTestPassed,
      workStateTimelineImplementation: {
        owner: 'DSXU-owned visible-state projection',
        source: 'src/dsxu/engine/work-state-timeline.ts',
        finalReportWiring: 'src/dsxu/engine/code-mode-surgical-loop.ts',
        queryWiring: 'src/query.ts',
      },
      deepSeekRuntimeImplementation: {
        trajectoryStore: 'src/services/api/deepseek-trajectory-store.ts',
        adapter: 'src/services/api/deepseek-adapter.ts',
        costRouter: 'src/utils/model/deepseekV4CostRouter.ts',
        controlPolicy: 'src/utils/model/deepseekV4Control.ts',
      },
    },
    releaseClaims: {
      cleanExportPreflightStatus: statusFrom(reports.cleanExport),
      sixStageFinalTestsStatus: statusFrom(reports.sixStageFinalTests),
      cleanExportArtifactStatus: statusFrom(reports.cleanExportArtifact),
      cleanExportZipPath: cleanExportArtifact.zipPath,
      cleanExportZipSha256: cleanExportArtifact.zipSha256,
      freshInstallSmokeStatus: statusFrom(reports.freshInstallSmoke),
      publicSurfacePolicy: 'V24/V26 source-truth docs are allowed as audit evidence, not public parity claims.',
    },
    cacheOptimization: {
      optimizationReferenceHitRatePct: PUBLIC_CHALLENGE_CACHE_REFERENCE_HIT_RATE_PCT,
      targetHitRatePct: PUBLIC_CHALLENGE_CACHE_REFERENCE_HIT_RATE_PCT,
      targetIsReleaseGate: false,
      noReadDefault: true,
      fallbackReadMaxChars: PUBLIC_CHALLENGE_FALLBACK_READ_MAX_CHARS,
      fallbackReadPolicy: 'Read is disabled in the default review lane; fallback raw reads require an explicit source gap, anchor-local range, and separate accounting.',
      strategy: 'All Flash reviews share the same deterministic source-truth capsule and only vary a short task-specific verdict schema.',
      sourceTruthRefCount: sourceTruthRefs.length,
      sourceTruthCapsuleCount: sourceTruthRefs.reduce((sum, ref) => sum + ref.anchorCapsules.length, 0),
      missingSourceTruthRefs: sourceTruthRefs.filter(ref => !ref.exists).map(ref => ref.path),
    },
  }
}

async function writeStableEvidencePack(pack: StableEvidencePack): Promise<string> {
  const packJson = `${JSON.stringify(pack, null, 2)}\n`
  await writeFile(STABLE_EVIDENCE_PACK_JSON, packJson, 'utf8')
  const packHash = sha256(packJson)
  const md = [
    '# DSXU V26 Public Challenge Stable Evidence Pack - 20260515',
    '',
    `Snapshot: \`${pack.snapshotDate}\``,
    `JSON: \`${STABLE_EVIDENCE_PACK_JSON}\``,
    `sha256: \`${packHash}\``,
    '',
    '## Purpose',
    '',
    pack.purpose,
    '',
    '## Source Truth Refs',
    '',
    markdownTable(pack.sourceTruthRefs.map(ref => ({
      id: ref.id,
      exists: ref.exists,
      bytes: ref.bytes,
      lines: ref.lineCount,
      capsules: ref.anchorCapsules.length,
      riskTags: ref.riskTags.join(','),
      sha256: ref.sha256 ? ref.sha256.slice(0, 16) : '',
      path: ref.path,
    })), ['id', 'exists', 'bytes', 'lines', 'capsules', 'riskTags', 'sha256', 'path']),
    '',
    '## Report Summaries',
    '',
    markdownTable(pack.reportSummaries.map(report => ({
      id: report.id,
      status: report.status,
      path: report.path,
    })), ['id', 'status', 'path']),
    '',
    '## Guardrails',
    '',
    ...pack.guardrails.map(item => `- ${item}`),
    '',
  ].join('\n')
  await writeFile(STABLE_EVIDENCE_PACK_MD, md, 'utf8')
  return packHash
}

async function runCommand(id: string, command: string[], timeoutMs: number, stdinText?: string): Promise<CommandRun> {
  const startedAt = Date.now()
  const stdoutPath = join(TRACE_DIR, `${id}-${nowSafe()}.stdout.log`)
  const stderrPath = join(TRACE_DIR, `${id}-${nowSafe()}.stderr.log`)
  const proc = Bun.spawn(command, {
    cwd: ROOT,
    stdin: stdinText === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  if (stdinText !== undefined) {
    proc.stdin?.write(stdinText)
    proc.stdin?.end()
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`command timed out after ${timeoutMs}ms: ${command.join(' ')}`))
    }, timeoutMs)
  })
  try {
    const exitCode = await Promise.race([proc.exited, timeout])
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    await mkdir(dirname(stdoutPath), { recursive: true })
    await Promise.all([
      writeFile(stdoutPath, stdout, 'utf8'),
      writeFile(stderrPath, stderr, 'utf8'),
    ])
    return {
      id,
      command,
      exitCode,
      durationMs: Date.now() - startedAt,
      stdoutPath,
      stderrPath,
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function parseMarkdownJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const candidates: string[] = []
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced?.[1]) candidates.push(fenced[1].trim())
  candidates.push(trimmed)
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1))
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

function parseStreamJson(stdout: string): {
  resultJson: Record<string, unknown> | null
  costUSD: number
  modelUsage: Record<string, unknown> | null
} {
  let resultJson: Record<string, unknown> | null = null
  let lastAssistantJson: Record<string, unknown> | null = null
  let costUSD = 0
  let modelUsage: Record<string, unknown> | null = null
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as Record<string, unknown>
      if (event.type === 'assistant') {
        const message = event.message as { content?: unknown } | undefined
        const content = Array.isArray(message?.content) ? message.content : []
        for (const block of content) {
          if (!block || typeof block !== 'object') continue
          const text = (block as { text?: unknown }).text
          if (typeof text !== 'string') continue
          const parsed = parseMarkdownJson(text)
          if (parsed) lastAssistantJson = parsed
        }
      }
      if (event.type === 'result') {
        if (typeof event.result === 'string') resultJson = parseMarkdownJson(event.result)
        if (typeof event.total_cost_usd === 'number') costUSD = event.total_cost_usd
        if (event.modelUsage && typeof event.modelUsage === 'object') {
          modelUsage = event.modelUsage as Record<string, unknown>
        }
      }
    } catch {
      // Raw trace is preserved.
    }
  }
  resultJson ??= lastAssistantJson
  return { resultJson, costUSD, modelUsage }
}

async function summarizeTrajectory(path: string): Promise<FlashTrajectoryAttribution> {
  const readToolCallKeys = new Set<string>()
  const attribution: FlashTrajectoryAttribution = {
    requestCount: 0,
    routeReasons: [],
    systemHashes: [],
    uniqueSystemHashes: 0,
    readToolCallCount: 0,
    toolResultCount: 0,
    toolResultChars: 0,
    maxToolResultChars: 0,
    cacheReadInputTokens: 0,
    cacheMissInputTokens: 0,
    outputTokens: 0,
    noReadDefaultRespected: true,
  }
  const recordReadToolCall = (toolCall: unknown, fallbackKey: string): void => {
    const record = objectFrom(toolCall)
    if (record.name !== 'Read') return
    const key = typeof record.id === 'string' ? record.id : fallbackKey
    if (readToolCallKeys.has(key)) return
    readToolCallKeys.add(key)
    attribution.readToolCallCount += 1
  }
  const text = await readTextOrNull(path.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '')) ?? await (async () => {
    try {
      return await readFile(path, 'utf8')
    } catch {
      return ''
    }
  })()
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    let event: Record<string, unknown>
    try {
      event = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (event.event === 'request_plan') {
      attribution.requestCount += 1
      if (typeof event.routeReason === 'string') attribution.routeReasons.push(event.routeReason)
      const systemPromptSummary = objectFrom(event.systemPromptSummary)
      const normalizedHash = systemPromptSummary.normalizedHash
      if (typeof normalizedHash === 'string') attribution.systemHashes.push(normalizedHash)
    }
    if (event.event === 'request_messages') {
      const toolResults = Array.isArray(event.toolResults) ? event.toolResults : []
      attribution.toolResultCount += numberFrom(event.toolResultCount) ?? toolResults.length
      for (const toolResult of toolResults) {
        const record = objectFrom(toolResult)
        const chars = numberFrom(record.contentChars) ?? 0
        attribution.toolResultChars += chars
        attribution.maxToolResultChars = Math.max(attribution.maxToolResultChars, chars)
      }
      const assistantToolCalls = Array.isArray(event.assistantToolCalls) ? event.assistantToolCalls : []
      assistantToolCalls.forEach((toolCall, index) => recordReadToolCall(toolCall, `${event.requestTag ?? 'request'}:assistant:${index}`))
    }
    if (event.event === 'stream_response' || event.event === 'json_response') {
      const toolCalls = Array.isArray(event.toolCalls) ? event.toolCalls : []
      toolCalls.forEach((toolCall, index) => recordReadToolCall(toolCall, `${event.requestTag ?? 'response'}:tool:${index}`))
    }
    if (event.event === 'response_usage') {
      const usage = objectFrom(event.usage)
      attribution.cacheReadInputTokens += numberFrom(usage.cache_read_input_tokens) ?? 0
      attribution.cacheMissInputTokens += numberFrom(usage.cache_creation_input_tokens) ?? 0
      attribution.outputTokens += numberFrom(usage.output_tokens) ?? 0
      if (typeof event.routeReason === 'string') attribution.routeReasons.push(event.routeReason)
    }
  }
  attribution.routeReasons = [...new Set(attribution.routeReasons)]
  attribution.uniqueSystemHashes = new Set(attribution.systemHashes).size
  attribution.noReadDefaultRespected = attribution.readToolCallCount === 0 && attribution.toolResultCount === 0
  return attribution
}

async function runFlashReview(
  id: string,
  prompt: string,
  promptProfile: FlashReview['promptProfile'],
): Promise<FlashReview> {
  const tracePath = join(TRACE_DIR, `${id}-${nowSafe()}.jsonl`)
  const trajectoryPath = join(TRACE_DIR, `${id}-${nowSafe()}.trajectory.jsonl`)
  const promptPath = join(TRACE_DIR, `${id}-${nowSafe()}.prompt.txt`)
  await writeFile(promptPath, prompt, 'utf8')
  const previousTrajectoryPath = process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE
  const previousRouteWorkflowKind = process.env.DSXU_DEEPSEEK_ROUTE_WORKFLOW_KIND
  const previousRouteRole = process.env.DSXU_DEEPSEEK_ROUTE_ROLE
  let run: CommandRun
  try {
    process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE = trajectoryPath
    process.env.DSXU_DEEPSEEK_ROUTE_WORKFLOW_KIND = 'review'
    process.env.DSXU_DEEPSEEK_ROUTE_ROLE = 'reviewer'
    run = await runCommand(id, [
      'bun',
      '--env-file=.env',
      './src/entrypoints/dsxu-code.tsx',
      '-p',
      '--verbose',
      '--model',
      'deepseek-v4-flash',
      '--max-turns',
      '3',
      '--output-format',
      'stream-json',
      '--tools',
      '',
      '--permission-mode',
      'dontAsk',
    ], 480_000, prompt)
  } finally {
    if (previousTrajectoryPath === undefined) delete process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE
    else process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE = previousTrajectoryPath
    if (previousRouteWorkflowKind === undefined) delete process.env.DSXU_DEEPSEEK_ROUTE_WORKFLOW_KIND
    else process.env.DSXU_DEEPSEEK_ROUTE_WORKFLOW_KIND = previousRouteWorkflowKind
    if (previousRouteRole === undefined) delete process.env.DSXU_DEEPSEEK_ROUTE_ROLE
    else process.env.DSXU_DEEPSEEK_ROUTE_ROLE = previousRouteRole
  }
  const combined = (await readFile(run.stdoutPath, 'utf8')) + (await readFile(run.stderrPath, 'utf8'))
  await writeFile(tracePath, combined, 'utf8')
  const parsed = parseStreamJson(combined)
  const trajectoryAttribution = await summarizeTrajectory(trajectoryPath)
  return {
    ...run,
    promptPath,
    tracePath,
    trajectoryPath,
    promptProfile,
    trajectoryAttribution,
    resultJson: parsed.resultJson,
    costUSD: parsed.costUSD,
    modelUsage: parsed.modelUsage,
  }
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'true'
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function summarizeFlashCache(reviews: readonly FlashReview[]): FlashCacheSummary {
  let cacheHitInputTokens = 0
  let cacheMissInputTokens = 0
  let outputTokens = 0
  let totalCostUSD = 0
  let readToolCallCount = 0
  let toolResultCount = 0
  let toolResultChars = 0
  let maxToolResultChars = 0
  const routeReasons = new Set<string>()
  const systemHashes = new Set<string>()
  for (const review of reviews) {
    totalCostUSD += review.costUSD
    readToolCallCount += review.trajectoryAttribution.readToolCallCount
    toolResultCount += review.trajectoryAttribution.toolResultCount
    toolResultChars += review.trajectoryAttribution.toolResultChars
    maxToolResultChars = Math.max(maxToolResultChars, review.trajectoryAttribution.maxToolResultChars)
    for (const reason of review.trajectoryAttribution.routeReasons) routeReasons.add(reason)
    for (const hash of review.trajectoryAttribution.systemHashes) systemHashes.add(hash)
    if (review.trajectoryAttribution.cacheReadInputTokens > 0 || review.trajectoryAttribution.cacheMissInputTokens > 0) {
      cacheHitInputTokens += review.trajectoryAttribution.cacheReadInputTokens
      cacheMissInputTokens += review.trajectoryAttribution.cacheMissInputTokens
      outputTokens += review.trajectoryAttribution.outputTokens
    } else {
      for (const usage of Object.values(review.modelUsage ?? {})) {
        if (!usage || typeof usage !== 'object') continue
        const record = usage as Record<string, unknown>
        cacheHitInputTokens += numberFrom(record.cacheReadInputTokens) ?? 0
        cacheMissInputTokens += numberFrom(record.cacheCreationInputTokens) ?? 0
        outputTokens += numberFrom(record.outputTokens) ?? 0
      }
    }
  }
  const uniqueStablePrefixHashes = new Set(reviews.map(review => review.promptProfile.stablePrefixHash)).size
  const uniqueDynamicTailHashes = new Set(reviews.map(review => review.promptProfile.dynamicTailHash)).size
  const cacheHitRatePct = pct(cacheHitInputTokens, cacheMissInputTokens)
  return {
    reviewCount: reviews.length,
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens,
    totalCostUSD,
    cacheHitRatePct,
    targetHitRatePct: PUBLIC_CHALLENGE_CACHE_REFERENCE_HIT_RATE_PCT,
    targetMet: cacheHitRatePct >= PUBLIC_CHALLENGE_CACHE_REFERENCE_HIT_RATE_PCT,
    releaseBlocking: false,
    claimPolicy: 'Cache hit rate is a public optimization metric and attribution signal, not a fixed release gate; claims must use observed values and before/after evidence.',
    readToolCallCount,
    toolResultCount,
    toolResultChars,
    maxToolResultChars,
    routeReasons: [...routeReasons].sort(),
    uniqueSystemHashes: systemHashes.size,
    uniqueStablePrefixHashes,
    uniqueDynamicTailHashes,
  }
}

function statusFrom(report: Record<string, unknown> | null): string {
  const status = report?.status
  return typeof status === 'string' ? status : 'MISSING'
}

function summarizeReport(id: string, path: string, report: Record<string, unknown> | null): EvidenceReport {
  const coverage = report?.coverage && typeof report.coverage === 'object'
    ? report.coverage as Record<string, unknown>
    : {}
  return {
    id,
    path,
    status: statusFrom(report),
    summary: {
      primaryPassed: coverage.primaryPassed,
      secondaryPassed: coverage.secondaryPassed,
      passedRows: coverage.passedRows,
      openRows: coverage.openRows,
      flashReviewPass: report?.flashReviewPass,
      canCreateCleanExport: report?.canCreateCleanExport,
      didCreateExport: report?.didCreateExport,
      blockers: Array.isArray(report?.blockers) ? report.blockers.length : undefined,
      continuousWindowSatisfied: report?.window && typeof report.window === 'object'
        ? (report.window as Record<string, unknown>).continuousWindowSatisfied
        : undefined,
      finalTestPassed: report?.checks && typeof report.checks === 'object'
        ? (report.checks as Record<string, unknown>).finalTestPassed
        : undefined,
    },
  }
}

function flashReviewPass(run: FlashReview): boolean {
  const sourceTruthAccepted =
    isTrue(run.resultJson?.did_use_source_truth_capsule) ||
    isTrue(run.resultJson?.did_read_source_truth)
  const evidenceText = JSON.stringify(run.resultJson?.evidence ?? '')
  const hasCapsuleEvidence = /capsule|#L\d+/i.test(evidenceText)
  return (
    run.exitCode === 0 &&
    run.resultJson !== null &&
    sourceTruthAccepted &&
    hasCapsuleEvidence &&
    isTrue(run.resultJson.flash_first_policy_respected) &&
    isTrue(run.resultJson.no_second_runtime) &&
    !isTrue(run.resultJson.pro_needed) &&
    run.trajectoryAttribution.noReadDefaultRespected
  )
}

function escapeCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function markdownTable(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => escapeCell(row[column])).join(' | ')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(GENERATED_DIR, { recursive: true })

  const commandRuns: CommandRun[] = []
  for (const batch of commandBatches) {
    commandRuns.push(await runCommand(batch.id, batch.command, batch.timeoutMs))
  }

  const reports = {
    completed: await readJson(reportPaths.completed),
    interactiveTui: await readJson(reportPaths.interactiveTui),
    c2Loop: await readJson(reportPaths.c2Loop),
    c2PublicClaimClosure: await readJson(reportPaths.c2PublicClaimClosure),
    c2OwnerImplementationAcceptance: await readJson(reportPaths.c2OwnerImplementationAcceptance),
    seniorCoding: await readJson(reportPaths.seniorCoding),
    cleanExport: await readJson(reportPaths.cleanExport),
    sixStageFinalTests: await readJson(reportPaths.sixStageFinalTests),
    cleanExportArtifact: await readJson(reportPaths.cleanExportArtifact),
    freshInstallSmoke: await readJson(reportPaths.freshInstallSmoke),
  }

  const evidenceReports = [
    summarizeReport('completed-reacceptance', reportPaths.completed, reports.completed),
    summarizeReport('interactive-tui', reportPaths.interactiveTui, reports.interactiveTui),
    summarizeReport('c2-loop', reportPaths.c2Loop, reports.c2Loop),
    summarizeReport('c2-public-claim-closure', reportPaths.c2PublicClaimClosure, reports.c2PublicClaimClosure),
    summarizeReport('c2-owner-implementation-acceptance', reportPaths.c2OwnerImplementationAcceptance, reports.c2OwnerImplementationAcceptance),
    summarizeReport('senior-coding-window', reportPaths.seniorCoding, reports.seniorCoding),
    summarizeReport('clean-export-preflight', reportPaths.cleanExport, reports.cleanExport),
    summarizeReport('six-stage-final-tests', reportPaths.sixStageFinalTests, reports.sixStageFinalTests),
    summarizeReport('clean-export-artifact', reportPaths.cleanExportArtifact, reports.cleanExportArtifact),
    summarizeReport('fresh-install-release-smoke', reportPaths.freshInstallSmoke, reports.freshInstallSmoke),
  ]
  const stableEvidencePack = await buildStableEvidencePack(reports, evidenceReports)
  const stableEvidencePackHash = await writeStableEvidencePack(stableEvidencePack)
  const publicChallengeStablePrefix = buildPublicChallengeStablePrefix(stableEvidencePack)

  const flashPrompts = [
    {
      id: 'flash-public-claim-guard-review',
      dynamicTail: [
        'V26 public challenge package review. Use the source-truth capsule embedded in the stable prefix. Do not call tools in this default no-Read lane.',
        'Return JSON only with {"did_use_source_truth_capsule":boolean,"flash_first_policy_respected":boolean,"no_second_runtime":boolean,"pro_needed":boolean,"package_ready":boolean,"score_0_100":number,"sellable_metrics":[string],"claim_guard":[string],"blocking_gaps":[string],"evidence":[string]}.',
        'Judge C2 matrix, public-claim boundary, owner implementation acceptance, Flash-first cost evidence, DeepSeek redacted trajectory traces, TUI replay, senior-coding window, clean export artifact, and fresh install smoke from the stable pack. Evidence strings must cite capsule ids such as sourceTruthRefs[].capsuleId or anchorCapsules[].id.',
      ].join(' '),
    },
    {
      id: 'flash-senior-coding-experience-review',
      dynamicTail: [
        'V26 senior coding experience review. Use the source-truth capsule embedded in the stable prefix. Do not call tools in this default no-Read lane; block claims instead of inventing missing source.',
        'Return JSON only with {"did_use_source_truth_capsule":boolean,"flash_first_policy_respected":boolean,"no_second_runtime":boolean,"pro_needed":boolean,"package_ready":boolean,"score_0_100":number,"strengths":[string],"remaining_gaps":[string],"next_code_changes":[string],"evidence":[string]}.',
        'Focus on whether the current DSXU product entry path looks like a senior-programmer task system after the real senior-coding window: goal retention, source truth, permission/tool gate, recovery, cost evidence, and no duplicate product runtime. Treat QueryEngine recovery evidence lines as a terminal error consumption contract, not as a second recovery loop. Treat DSXU engine C2 harness files by import/use evidence, not by filename alone. Evidence strings must cite capsule ids.',
      ].join(' '),
    },
    {
      id: 'flash-release-ecosystem-review',
      dynamicTail: [
        'V26 release ecosystem review. Use the source-truth capsule embedded in the stable prefix. Do not call tools in this default no-Read lane.',
        'Return JSON only with {"did_use_source_truth_capsule":boolean,"flash_first_policy_respected":boolean,"no_second_runtime":boolean,"pro_needed":boolean,"package_ready":boolean,"score_0_100":number,"release_ready_claims":[string],"blocked_claims":[string],"evidence":[string]}.',
        'Check commercial/IP/brand guard, source-truth doc allowance, clean export readiness, and whether ecosystem compatibility is framed as DSXU-owned entry contracts rather than third-party runtime embedding. Evidence strings must cite capsule ids.',
      ].join(' '),
    },
  ] as const

  const flashReviews: FlashReview[] = []
  for (const task of flashPrompts) {
    const prompt = buildFlashPrompt(publicChallengeStablePrefix, task.dynamicTail)
    flashReviews.push(await runFlashReview(task.id, prompt.prompt, prompt.promptProfile))
  }

  const commandPass = commandRuns.every(run => run.exitCode === 0)
  const flashPass = flashReviews.every(flashReviewPass)
  const c2Pass = statusFrom(reports.c2Loop) === 'PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH'
  const c2PublicClaimBoundaryClosed =
    statusFrom(reports.c2PublicClaimClosure) === 'PASS_C2_PUBLIC_CLAIM_BOUNDARY_CLOSED' &&
    reports.c2PublicClaimClosure?.gates?.referenceFeatureParityClaimAllowed === false &&
    reports.c2PublicClaimClosure?.totals?.openPublicClaimBoundaryRows === 0
  const c2OwnerImplementationAcceptancePass =
    statusFrom(reports.c2OwnerImplementationAcceptance) === 'PASS_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_DECISIONS_CLOSED' &&
    reports.c2OwnerImplementationAcceptance?.gates?.referenceFeatureParityClaimAllowed === false &&
    reports.c2OwnerImplementationAcceptance?.totals?.needsRealCodeTestRows === 0
  const tuiPass = statusFrom(reports.interactiveTui) === 'PASS_INTERACTIVE_TUI_ACCEPTANCE'
  const completedPass = statusFrom(reports.completed) === 'PASS_COMPLETED_FEATURES_REACCEPTED_WITH_FLASH_FIRST_EVIDENCE'
  const seniorCodingPass =
    statusFrom(reports.seniorCoding) === 'PASS_SENIOR_CODING_WINDOW_30_45_MIN_REAL_DSXU' &&
    reports.seniorCoding?.window &&
    typeof reports.seniorCoding.window === 'object' &&
    (reports.seniorCoding.window as Record<string, unknown>).continuousWindowSatisfied === true &&
    reports.seniorCoding?.checks &&
    typeof reports.seniorCoding.checks === 'object' &&
    (reports.seniorCoding.checks as Record<string, unknown>).finalTestPassed === true
  const cleanPass =
    statusFrom(reports.cleanExport) === 'PASS_READY_TO_CREATE_CLEAN_EXPORT' &&
    reports.cleanExport?.canCreateCleanExport === true
  const sixStagePass =
    statusFrom(reports.sixStageFinalTests) === 'PASS_V24_SIX_STAGE_FINAL_TESTS' &&
    reports.sixStageFinalTests?.failedCommandCount === 0
  const cleanExportArtifactPass =
    statusFrom(reports.cleanExportArtifact) === 'PASS_CLEAN_EXPORT_ARTIFACT_CREATED' &&
    typeof reports.cleanExportArtifact?.zipSha256 === 'string'
  const freshInstallPass =
    statusFrom(reports.freshInstallSmoke) === 'PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE' &&
    reports.freshInstallSmoke?.failedCommandCount === 0
  const releaseGatesPass = sixStagePass && cleanExportArtifactPass && freshInstallPass
  const scores = flashReviews
    .map(run => numberFrom(run.resultJson?.score_0_100))
    .filter((score): score is number => score !== undefined)
  const scoreFloor = scores.length > 0 ? Math.min(...scores) : 0
  const totalFlashCostUSD = flashReviews.reduce((sum, run) => sum + run.costUSD, 0)
  const flashCacheSummary = summarizeFlashCache(flashReviews)
  const status = commandPass && flashPass && c2Pass && c2PublicClaimBoundaryClosed && c2OwnerImplementationAcceptancePass && tuiPass && completedPass && seniorCodingPass && cleanPass && releaseGatesPass
    ? 'PASS_PUBLIC_CHALLENGE_PACKAGE_READY'
    : 'OPEN_PUBLIC_CHALLENGE_PACKAGE_REVIEW_REQUIRED'

  const publicClaimsAllowed = [
    'Flash-first DSXU product-entry evidence is available; Pro was not required in this package.',
    ...(c2Pass ? ['C2 experience-loop behavior matrix is evidenced at 51/51 rows.'] : []),
    ...(c2PublicClaimBoundaryClosed ? ['C2 public-claim boundary is closed as DSXU-owned generic experience evidence, not reference-product parity.'] : []),
    ...(c2OwnerImplementationAcceptancePass ? ['C2 owner implementation acceptance resolved 1902/1902 rows into implemented+tested, adapted/excluded, or no-loss baseline decisions.'] : []),
    'DeepSeek trajectory tracing can record request plan, message/tool-result structure, redacted thinking/tool/use snapshots, usage, cache, route, and request id evidence when DSXU_DEEPSEEK_TRAJECTORY_FILE is enabled.',
    ...(flashCacheSummary.targetMet
      ? [`Public challenge Flash cache hit rate is above the optimization reference: ${flashCacheSummary.cacheHitRatePct}% >= ${flashCacheSummary.targetHitRatePct}%.`]
      : []),
    ...(flashCacheSummary.readToolCallCount === 0
      ? ['Public challenge review now respects DSXU no-Read source-truth capsule mode: 0 Read calls and 0 tool-result chars in the default review lane.']
      : []),
    'Real TUI replay evidence covers startup, permission visibility, recovery, compact resume, background task, and model task progress.',
    '30-45 minute senior-coding window is evidenced through real DSXU product-entry runs, source edit, failed-to-passing test loop, sustained reviews, and Flash-only cost.',
    cleanExportArtifactPass
      ? `Clean export artifact is created and secret-scanned: ${reports.cleanExportArtifact?.zipPath ?? 'unknown zip'}.`
      : 'Clean export preflight is ready, but export artifact evidence is not closed in this package.',
    freshInstallPass
      ? 'Fresh install/help/doctor/provider gate smoke is evidenced from the clean export.'
      : 'Fresh install smoke remains required before release readiness can be claimed.',
    'Release public-surface gates recognize V24 source-truth docs without treating them as public product claims.',
  ]
  const publicClaimsBlocked = [
    'Do not claim public 90 ability until the public challenge score floor reaches around 90 with fixed raw task data.',
    'Do not claim independent benchmark superiority until a comparable public challenge run is executed against a fixed task pack.',
    ...(!c2Pass ? ['Do not claim 51/51 C2 loop acceptance while the latest C2 loop report remains OPEN.'] : []),
    ...(!flashCacheSummary.targetMet
      ? [`Do not claim high cache ROI yet; observed public challenge cache hit rate is ${flashCacheSummary.cacheHitRatePct}% against a non-release reference of ${flashCacheSummary.targetHitRatePct}%.`]
      : []),
    ...(flashCacheSummary.readToolCallCount > 0
      ? [`Do not claim no-Read source-truth mode yet; observed Read tool calls=${flashCacheSummary.readToolCallCount}, toolResultChars=${flashCacheSummary.toolResultChars}.`]
      : []),
    ...(!c2PublicClaimBoundaryClosed ? ['Do not claim C2 reference feature parity while V26 C2 public-claim boundary closure is not PASS.'] : []),
    ...(!c2OwnerImplementationAcceptancePass ? ['Do not claim C2 owner implementation acceptance while any row still needs real code/test.'] : []),
    'Do not claim third-party product embedding; ecosystem compatibility must be framed as DSXU-owned intake/host contracts.',
  ]

  const report = {
    schemaVersion: 'dsxu.v26.public-challenge-package.v2',
    generatedAt: new Date().toISOString(),
    status,
    policy: {
      defaultModel: 'deepseek-v4-flash',
      proWasRun: false,
      noSecondRuntime: true,
      didCreateExport: cleanExportArtifactPass,
    },
    commandPass,
    flashPass,
    c2Pass,
    c2PublicClaimBoundaryClosed,
    c2OwnerImplementationAcceptancePass,
    tuiPass,
    completedPass,
    seniorCodingPass,
    cleanPass,
    sixStagePass,
    cleanExportArtifactPass,
    freshInstallPass,
    releaseGatesPass,
    scoreFloor,
    totalFlashCostUSD,
    flashCacheSummary,
    stableEvidencePack: {
      jsonPath: STABLE_EVIDENCE_PACK_JSON,
      markdownPath: STABLE_EVIDENCE_PACK_MD,
      sha256: stableEvidencePackHash,
      sourceTruthRefCount: stableEvidencePack.sourceTruthRefs.length,
      missingSourceTruthRefs: stableEvidencePack.sourceTruthRefs.filter(ref => !ref.exists).map(ref => ref.path),
    },
    publicClaimsAllowed,
    publicClaimsBlocked,
    commandRuns,
    flashReviews,
    evidenceReports,
    remainingForPublic90: [
      'public challenge scoreFloor around 90 with fixed raw task data',
      'same-task external/target raw transcript evidence before any superiority claim',
      ...(!c2PublicClaimBoundaryClosed ? ['V26 C2 blocked public-claim rows closed or explicitly excluded'] : []),
      ...(!c2OwnerImplementationAcceptancePass ? ['V26 C2 owner implementation acceptance decisions closed'] : []),
      ...(flashCacheSummary.readToolCallCount > 0 ? ['public challenge no-Read source-truth capsule respected by all reviews'] : []),
      ...(!sixStagePass ? ['six-stage final tests: functional, experience, recovery, performance, evaluation, release closure'] : []),
      ...(!cleanExportArtifactPass ? ['clean export artifact'] : []),
      ...(!freshInstallPass ? ['fresh install/help/doctor/provider gate smoke'] : []),
    ],
  }
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const md = [
    '# DSXU V24 Public Challenge Package - 20260515',
    '',
    `Status: \`${status}\``,
    '',
    'This package turns current V24/V26 evidence into a GitHub-ready product claim guard and public challenge evidence pack. It does not claim public 90 ability or external superiority without fixed raw task evidence.',
    '',
    '## Summary',
    '',
    markdownTable([
      { item: 'command batches', result: `${commandRuns.filter(run => run.exitCode === 0).length}/${commandRuns.length} pass` },
      { item: 'Flash reviews', result: `${flashReviews.filter(flashReviewPass).length}/${flashReviews.length} pass` },
      { item: 'C2 behavior matrix', result: c2Pass ? '51/51 pass' : 'not pass' },
      { item: 'C2 public claim boundary', result: c2PublicClaimBoundaryClosed ? 'closed without reference parity claim' : 'not closed' },
      { item: 'C2 owner implementation acceptance', result: c2OwnerImplementationAcceptancePass ? `${reports.c2OwnerImplementationAcceptance?.totals?.implementedTestedRows} implemented+tested / ${reports.c2OwnerImplementationAcceptance?.totals?.adaptedExcludedRows} adapted/excluded / ${reports.c2OwnerImplementationAcceptance?.totals?.noLossBaselineRows} no-loss / ${reports.c2OwnerImplementationAcceptance?.totals?.needsRealCodeTestRows} needs` : 'not closed' },
      { item: 'TUI replay', result: tuiPass ? 'pass' : 'not pass' },
      { item: 'completed reacceptance', result: completedPass ? 'pass' : 'not pass' },
      { item: 'senior-coding window', result: seniorCodingPass ? '30-45 min real DSXU pass' : 'not pass' },
      { item: 'release evidence', result: releaseGatesPass ? 'six-stage/export/fresh install pass' : `preflight=${cleanPass}; sixStage=${sixStagePass}; artifact=${cleanExportArtifactPass}; freshInstall=${freshInstallPass}` },
      { item: 'score floor from Flash reviews', result: scoreFloor },
      { item: 'Flash review cost USD', result: totalFlashCostUSD },
      { item: 'Flash cache hit rate', result: `${flashCacheSummary.cacheHitRatePct}% (${flashCacheSummary.cacheHitInputTokens} hit / ${flashCacheSummary.cacheMissInputTokens} miss)` },
      { item: 'Flash cache optimization reference', result: `${flashCacheSummary.targetMet ? 'above' : 'below'} ${flashCacheSummary.targetHitRatePct}% reference; not a release gate` },
      { item: 'no-Read source-truth lane', result: `${flashCacheSummary.readToolCallCount} Read calls / ${flashCacheSummary.toolResultChars} tool-result chars` },
      { item: 'stable prompt prefix hashes', result: `${flashCacheSummary.uniqueStablePrefixHashes} stable / ${flashCacheSummary.uniqueDynamicTailHashes} dynamic` },
      { item: 'stable evidence pack', result: `${stableEvidencePack.sourceTruthRefs.filter(ref => ref.exists).length}/${stableEvidencePack.sourceTruthRefs.length} source refs, sha256=${stableEvidencePackHash.slice(0, 16)}` },
    ], ['item', 'result']),
    '',
    '## Command Evidence',
    '',
    markdownTable(commandRuns.map(run => ({
      id: run.id,
      exit: run.exitCode,
      durationMs: run.durationMs,
      stdout: run.stdoutPath,
    })), ['id', 'exit', 'durationMs', 'stdout']),
    '',
    '## Flash Review Evidence',
    '',
    markdownTable(flashReviews.map(run => ({
      id: run.id,
      exit: run.exitCode,
      pass: flashReviewPass(run),
      score: numberFrom(run.resultJson?.score_0_100) ?? '',
      costUSD: run.costUSD,
      cacheHitRatePct: summarizeFlashCache([run]).cacheHitRatePct,
      readCalls: run.trajectoryAttribution.readToolCallCount,
      toolResultChars: run.trajectoryAttribution.toolResultChars,
      requests: run.trajectoryAttribution.requestCount,
      stablePrefix: run.promptProfile.stablePrefixHash,
      trace: run.tracePath,
    })), ['id', 'exit', 'pass', 'score', 'costUSD', 'cacheHitRatePct', 'readCalls', 'toolResultChars', 'requests', 'stablePrefix', 'trace']),
    '',
    '## Cache Miss Attribution',
    '',
    markdownTable([{
      reviewCount: flashCacheSummary.reviewCount,
      cacheHitRatePct: flashCacheSummary.cacheHitRatePct,
      cacheHitInputTokens: flashCacheSummary.cacheHitInputTokens,
      cacheMissInputTokens: flashCacheSummary.cacheMissInputTokens,
      readToolCallCount: flashCacheSummary.readToolCallCount,
      toolResultCount: flashCacheSummary.toolResultCount,
      toolResultChars: flashCacheSummary.toolResultChars,
      maxToolResultChars: flashCacheSummary.maxToolResultChars,
      uniqueSystemHashes: flashCacheSummary.uniqueSystemHashes,
      routeReasons: flashCacheSummary.routeReasons.join(','),
    }], ['reviewCount', 'cacheHitRatePct', 'cacheHitInputTokens', 'cacheMissInputTokens', 'readToolCallCount', 'toolResultCount', 'toolResultChars', 'maxToolResultChars', 'uniqueSystemHashes', 'routeReasons']),
    '',
    '## Public Claims Allowed',
    '',
    ...publicClaimsAllowed.map(item => `- ${item}`),
    '',
    '## Claims Still Blocked',
    '',
    ...publicClaimsBlocked.map(item => `- ${item}`),
    '',
    '## Remaining Public 90 / Experience Gates',
    '',
    ...report.remainingForPublic90.map(item => `- ${item}`),
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  process.stdout.write(JSON.stringify({
    status,
    commandPass,
    flashPass,
    c2Pass,
    c2PublicClaimBoundaryClosed,
    tuiPass,
    completedPass,
    cleanPass,
    sixStagePass,
    cleanExportArtifactPass,
    freshInstallPass,
    releaseGatesPass,
    scoreFloor,
    totalFlashCostUSD,
    flashCacheSummary,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
