import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

type AcceptanceDecision =
  | 'implemented+tested'
  | 'implemented+tested-needs-live-window'
  | 'adapted/subset+tested'
  | 'guard-or-eval-coordinate-only'
  | 'deferred-not-pass'
  | 'needs-real-functional-acceptance'

type CrosswalkRow = {
  id: string
  domain: string
  capability: string
  sheet: string
  historicalStatus: 'PASS' | 'DEFERRED_NOT_PASS'
  costLayer: string
  dsxuOwner: string
  ownerEvidence: string[]
  liveEvidence: string[]
  publicClaimAllowed: boolean
}

type AcceptanceRow = CrosswalkRow & {
  acceptanceDecision: AcceptanceDecision
  dsxuFitTier: string
  dsxuFitReason: string
  strictPublicClaimAllowed: boolean
  evidenceStrength: 'source+tests+live' | 'source+tests' | 'source-only' | 'guard-only' | 'deferred'
  v18Meaning: string
  risk: string
  nextAction: string
  explicitEvidenceFound: {
    ownerFiles: number
    liveFiles: number
    testsFromClean: string[]
    testsFound: string[]
  }
}

const ROOT = process.cwd()
const DATE = '20260516'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const CROSSWALK_JSON = join(GENERATED_DIR, `DSXU_CAPABILITY_COST_CROSSWALK_${DATE}.json`)
const CLEAN_DOC = join(ROOT, 'docs', 'DSXU_V18_V19_MERGED_AUDIT_20260510_CLEAN.md')
const OUT_JSON = join(GENERATED_DIR, `DSXU_CAPABILITY_ACCEPTANCE_AUDIT_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_CAPABILITY_ACCEPTANCE_AUDIT_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_CAPABILITY_ACCEPTANCE_AUDIT_${DATE}.md`)
const TERMINAL_LIVE_ACCEPTANCE_JSON = join(GENERATED_DIR, `DSXU_TERMINAL_LIVE_ACCEPTANCE_${DATE}.json`)
const TERMINAL_LIVE_ACCEPTANCE_MD = join(ROOT, 'docs', `DSXU_TERMINAL_LIVE_ACCEPTANCE_${DATE}.md`)
const SOURCE_CACHE_ACCEPTANCE_JSON = join(GENERATED_DIR, `DSXU_SOURCE_CACHE_ACCEPTANCE_${DATE}.json`)
const SOURCE_CACHE_ACCEPTANCE_MD = join(ROOT, 'docs', `DSXU_SOURCE_CACHE_ACCEPTANCE_${DATE}.md`)
const VISIBLE_STATE_ACCEPTANCE_JSON = join(GENERATED_DIR, `DSXU_VISIBLE_STATE_ACCEPTANCE_${DATE}.json`)
const VISIBLE_STATE_ACCEPTANCE_MD = join(ROOT, 'docs', `DSXU_VISIBLE_STATE_ACCEPTANCE_${DATE}.md`)
const DEEPSEEK_COST_QUALITY_ACCEPTANCE_JSON = join(GENERATED_DIR, `DSXU_DEEPSEEK_COST_QUALITY_ACCEPTANCE_${DATE}.json`)
const DEEPSEEK_COST_QUALITY_ACCEPTANCE_MD = join(ROOT, 'docs', `DSXU_DEEPSEEK_COST_QUALITY_ACCEPTANCE_${DATE}.md`)
const AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_JSON = join(GENERATED_DIR, `DSXU_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_${DATE}.json`)
const AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_MD = join(ROOT, 'docs', `DSXU_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_${DATE}.md`)
const EXTERNAL_BENCHMARK_ADAPTER_PROOF_JSON = join(GENERATED_DIR, `DSXU_EXTERNAL_BENCHMARK_ADAPTER_PROOF_${DATE}.json`)
const EXTERNAL_BENCHMARK_ADAPTER_PROOF_MD = join(ROOT, 'docs', `DSXU_EXTERNAL_BENCHMARK_ADAPTER_PROOF_${DATE}.md`)
const PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_JSON = join(GENERATED_DIR, `DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_${DATE}.json`)
const PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_MD = join(ROOT, 'docs', `DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_${DATE}.md`)

const deferredIds = new Set(['R01', 'R02', 'S02', 'R04', 'R05', 'R06', 'PZ01', 'PZ02', 'PZ04', 'PZ05', 'PZ06', 'PZ08'])

const subsetIds = new Set([
  'A16', // Code-10/30 runner: Code-10 covered, Code-30 remains blocked by readiness.
  'B12', // TerminalBench subset adapter, not full Terminal-Bench 2.0.
  'B13', // Terminal-10 covered, Terminal-30 remains readiness-gated.
  'A17', // SWE smoke only.
  'PZ03', // Browser proof/smoke boundary, not a full browser executor product.
  'PZ07', // DSXU serial/parallel fanout, not a swarm runtime.
])

const evalCoordinateOnlyIds = new Set([
  'R03', // SWE Pro as experience-quality contract, not same-task public benchmark pass.
  'R07', // OSWorld-lite coordinate, not external raw benchmark completion.
  'R08', // Toolathlon coordinate, not external raw benchmark completion.
])

const liveWindowNeededIds = new Set([
  'B01',
  'B02',
  'B03',
  'B05',
  'B06',
  'B08',
  'B09',
  'B10',
  'B11',
  'B14',
  'E02', // ablation runner exists, but latest no-Read/source capsule before-after rerun is still required.
])

const terminalLiveImplementedIds = new Set([
  'B01',
  'B02',
  'B03',
  'B05',
  'B06',
  'B08',
  'B09',
  'B10',
  'B11',
  'B14',
])

const sourceCacheAcceptedIds = new Set([
  'C07',
  'M06',
])

const visibleStateAcceptedIds = new Set([
  'C03',
  'C04',
])

const deepseekCostQualityAcceptedIds = new Set([
  'M01',
  'M02',
  'M06',
  'C09',
  'C16',
  'E03',
  'A14',
])

const agentMcpSkillBoundaryAcceptedIds = new Set([
  'PZ07',
  'C06',
  'M04',
])

const externalBenchmarkAdapterProofAcceptedIds = new Set([
  'A16',
  'A17',
  'PZ03',
])

const publicChallengeAblationAcceptedIds = new Set([
  'E02',
])

const claimLimitedIds = new Set([
  'A14', // Pro reviewer is risk/admission route, not always-Pro reviewer product claim.
  'M07', // FIM is a bounded Flash non-thinking lane, not broad autonomous edit runtime.
])

const currentTestAliasesById = new Map<string, string[]>([
  ['M06', ['route-cache-dynamic-tail.test.ts', 'route-cache-roi-smoke.test.ts', 'prompt-prefix-cache-evidence.test.ts', 'code-mode-source-cache-governor.test.ts']],
  ['C07', ['context-builder.test.ts', 'context-owner-rule-contract-v1.test.ts', 'query-context-builder-v1.test.ts', 'prompt-prefix-cache-builder.test.ts', 'code-mode-source-cache-governor.test.ts']],
  ['C09', ['cost-cache-live-task-evidence.test.ts', 'deepseek-v4-control-v1.test.ts']],
  ['C14', ['controlled-failure-taxonomy.test.ts', 'failure-taxonomy-v1.test.ts']],
  ['E01', ['eval-baseline-manifest.test.ts']],
  ['E02', ['evidence-eval-pack.test.ts', 'public-challenge-ablation-board.test.ts']],
  ['E03', ['evidence-eval-pack.test.ts', 'cost-cache-live-task-evidence.test.ts']],
  ['E04', ['baseline-failure-reporter.test.ts']],
  ['E06', ['go-stop-decision.test.ts', 'stage-close-readiness.test.ts']],
  ['C06', ['skills-integration.test.ts', 'skill-governance-contract-v1.test.ts', 'critical-skills-runtime-v1-clean.test.ts']],
  ['C03', ['work-state-timeline.test.ts']],
  ['C04', ['work-state-timeline.test.ts', 'tool-gate-v1-clean.test.ts', 'permissions.test.ts']],
  ['M01', ['deepseek-v4-control-v1.test.ts', 'deepseek-cost-quality-board.test.ts']],
  ['M02', ['deepseek-v4-control-v1.test.ts', 'deepseek-cost-quality-board.test.ts']],
  ['C16', ['final-report-usage-evidence-v1.test.ts', 'deepseek-cost-quality-board.test.ts']],
  ['A14', ['cost-cache-live-task-evidence.test.ts', 'deepseek-cost-quality-board.test.ts']],
  ['E07', ['evidence-eval-pack.test.ts']],
  ['A16', ['code-terminal-runner.test.ts', 'benchmark-readiness.test.ts']],
  ['B12', ['code-terminal-runner.test.ts', 'evidence-eval-pack.test.ts']],
  ['B13', ['code-terminal-runner.test.ts', 'terminal-hit-rate.test.ts', 'benchmark-readiness.test.ts']],
  ['A17', ['experience-live-report-ingest.test.ts']],
])

function fileExistsOrGlob(rel: string): boolean {
  if (rel.includes('#')) return existsSync(join(ROOT, rel.split('#')[0]!))
  if (!rel.includes('*')) return existsSync(join(ROOT, rel))
  const slash = Math.max(rel.lastIndexOf('/'), rel.lastIndexOf('\\'))
  const dir = slash >= 0 ? rel.slice(0, slash) : '.'
  const pattern = rel.slice(slash + 1)
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  const re = new RegExp(`^${escaped}$`)
  try {
    return readdirSync(join(ROOT, dir)).some(entry => re.test(entry))
  } catch {
    return false
  }
}

function parseCleanEvidenceTests(clean: string): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const line of clean.split(/\r?\n/)) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim())
    if (cells.length < 6) continue
    const id = cells[1]
    const evidence = cells[4] ?? ''
    const tests = [...evidence.matchAll(/`([^`]+\.test\.ts)`/g)].map(match => match[1]!)
    if (id) map.set(id, tests)
  }
  return map
}

async function allRepoFiles(): Promise<string[]> {
  const out = Bun.spawnSync(['rg', '--files', 'src', 'scripts', 'docs'], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' })
  if (out.exitCode !== 0) return []
  return new TextDecoder().decode(out.stdout).split(/\r?\n/).filter(Boolean).map(path => path.replace(/\\/g, '/'))
}

function findTests(testNames: string[], repoFiles: string[]): string[] {
  const lowerFiles = repoFiles.map(file => ({ file, lower: file.toLowerCase() }))
  const found: string[] = []
  for (const name of testNames) {
    const leaf = name.split(/[\\/]/).pop()!.toLowerCase()
    const normalized = leaf
      .replace(/^v18-/, '')
      .replace(/^v19-/, '')
      .replace(/-v1\.test\.ts$/, '.test.ts')
      .replace(/-clean\.test\.ts$/, '.test.ts')
    const matches = lowerFiles.filter(candidate => candidate.lower.endsWith(leaf) || candidate.lower.endsWith(normalized) || candidate.lower.includes(normalized.replace('.test.ts', '')))
    found.push(...matches.map(match => match.file))
  }
  return [...new Set(found)]
}

async function loadTerminalLiveAcceptedIds(): Promise<Set<string>> {
  if (!existsSync(TERMINAL_LIVE_ACCEPTANCE_JSON)) return new Set()
  try {
    const data = JSON.parse(await readFile(TERMINAL_LIVE_ACCEPTANCE_JSON, 'utf8')) as {
      ok?: boolean
      capabilityAcceptance?: Array<{ id?: string; status?: string }>
    }
    if (data.ok !== true) return new Set()
    return new Set(
      (data.capabilityAcceptance ?? [])
        .filter(item => item.id && item.status && item.status !== 'blocked')
        .map(item => item.id!),
    )
  } catch {
    return new Set()
  }
}

async function sourceCacheAcceptancePassed(): Promise<boolean> {
  if (!existsSync(SOURCE_CACHE_ACCEPTANCE_JSON)) return false
  try {
    const data = JSON.parse(await readFile(SOURCE_CACHE_ACCEPTANCE_JSON, 'utf8')) as { status?: string }
    return data.status === 'PASS_SOURCE_CACHE_ACCEPTANCE'
  } catch {
    return false
  }
}

async function visibleStateAcceptancePassed(): Promise<boolean> {
  if (!existsSync(VISIBLE_STATE_ACCEPTANCE_JSON)) return false
  try {
    const data = JSON.parse(await readFile(VISIBLE_STATE_ACCEPTANCE_JSON, 'utf8')) as { status?: string }
    return data.status === 'PASS_VISIBLE_STATE_ACCEPTANCE'
  } catch {
    return false
  }
}

async function deepseekCostQualityAcceptancePassed(): Promise<boolean> {
  if (!existsSync(DEEPSEEK_COST_QUALITY_ACCEPTANCE_JSON)) return false
  try {
    const data = JSON.parse(await readFile(DEEPSEEK_COST_QUALITY_ACCEPTANCE_JSON, 'utf8')) as { status?: string }
    return data.status === 'PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE'
  } catch {
    return false
  }
}

async function agentMcpSkillBoundaryAcceptancePassed(): Promise<boolean> {
  if (!existsSync(AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_JSON)) return false
  try {
    const data = JSON.parse(await readFile(AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_JSON, 'utf8')) as { status?: string }
    return data.status === 'PASS_AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE'
  } catch {
    return false
  }
}

async function externalBenchmarkAdapterProofPassed(): Promise<boolean> {
  if (!existsSync(EXTERNAL_BENCHMARK_ADAPTER_PROOF_JSON)) return false
  try {
    const data = JSON.parse(await readFile(EXTERNAL_BENCHMARK_ADAPTER_PROOF_JSON, 'utf8')) as { status?: string }
    return data.status === 'PASS_EXTERNAL_ADAPTER_PROOF_WITH_TARGET_RAW_BLOCKED' ||
      data.status === 'PASS_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED'
  } catch {
    return false
  }
}

async function publicChallengeAblationAcceptancePassed(): Promise<boolean> {
  if (!existsSync(PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_JSON)) return false
  try {
    const data = JSON.parse(await readFile(PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_JSON, 'utf8')) as { status?: string }
    return data.status === 'PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE'
  } catch {
    return false
  }
}

function classify(row: CrosswalkRow, ownerFiles: number, liveFiles: number, testsFound: string[], terminalLiveAcceptedIds: Set<string>, ablationLiveAcceptedIds: Set<string>): Pick<AcceptanceRow, 'acceptanceDecision' | 'strictPublicClaimAllowed' | 'evidenceStrength' | 'v18Meaning' | 'risk' | 'nextAction'> {
  if (deferredIds.has(row.id) || row.historicalStatus !== 'PASS') {
    return {
      acceptanceDecision: 'deferred-not-pass',
      strictPublicClaimAllowed: false,
      evidenceStrength: 'deferred',
      v18Meaning: 'V18/V19 明确未覆盖，不能当 PASS。',
      risk: '如果写成已实现，会把 roadmap 或外部 benchmark 坐标冒充产品能力。',
      nextAction: '保留为 deferred/roadmap；只有真实代码、测试、live/raw 证据齐后才能转入 PASS。',
    }
  }

  if (evalCoordinateOnlyIds.has(row.id)) {
    return {
      acceptanceDecision: 'guard-or-eval-coordinate-only',
      strictPublicClaimAllowed: false,
      evidenceStrength: 'guard-only',
      v18Meaning: '这是体验/评测坐标或 quality contract PASS，不是外部同题 raw benchmark PASS。',
      risk: '不能在 GitHub 写成已通过 SWE/OSWorld/Toolathlon 等外部榜单。',
      nextAction: '放入公开挑战/benchmark 数据包；等待同题 raw run 后再升级 claim。',
    }
  }

  if (subsetIds.has(row.id) || claimLimitedIds.has(row.id)) {
    return {
      acceptanceDecision: 'adapted/subset+tested',
      strictPublicClaimAllowed: false,
      evidenceStrength: testsFound.length > 0 && liveFiles > 0 ? 'source+tests+live' : testsFound.length > 0 ? 'source+tests' : 'source-only',
      v18Meaning: '能力已按 DSXU 目标改造或子集化，不是原名完整功能。',
      risk: '公开卖点必须写 DSXU 自有边界，不能写成完整参考功能或外部评测通过。',
      nextAction: '补充 claim-limited 文案和 live 示例；不能扩大为 full feature claim。',
    }
  }

  const hasRequiredLiveWindow =
    (terminalLiveImplementedIds.has(row.id) && terminalLiveAcceptedIds.has(row.id)) ||
    ablationLiveAcceptedIds.has(row.id)
  if (liveWindowNeededIds.has(row.id) && !hasRequiredLiveWindow) {
    return {
      acceptanceDecision: 'implemented+tested-needs-live-window',
      strictPublicClaimAllowed: false,
      evidenceStrength: testsFound.length > 0 ? 'source+tests' : ownerFiles > 0 ? 'source-only' : 'guard-only',
      v18Meaning: '源码和测试证据存在，但还需要真实 DSXU 窗口或同题 before/after live 验收。',
      risk: '只靠单元测试会漏掉高级程序员体验里的可见状态、失败恢复和长输出处理。',
      nextAction: '进入 30-45 分钟 senior-coding window、terminal live demo 或 ablation rerun。',
    }
  }

  const hasTests = testsFound.length > 0
  const hasOwner = ownerFiles > 0
  const hasLive = liveFiles > 0
  if (!hasOwner || !hasTests) {
    return {
      acceptanceDecision: 'needs-real-functional-acceptance',
      strictPublicClaimAllowed: false,
      evidenceStrength: hasOwner ? 'source-only' : 'guard-only',
      v18Meaning: '历史 PASS 缺少足够的当前源码/测试反查证据。',
      risk: '这是最容易假 PASS 的类型。',
      nextAction: '先补 DSXU-owned source/test，再做 live acceptance；完成前不能进入公开卖点。',
    }
  }

  return {
    acceptanceDecision: 'implemented+tested',
    strictPublicClaimAllowed: row.publicClaimAllowed && hasLive,
    evidenceStrength: hasLive ? 'source+tests+live' : 'source+tests',
    v18Meaning: '历史能力已经落到 DSXU-owned 主线，并有测试/证据可复核。',
    risk: hasLive
      ? '可作为 DSXU 自有能力证据；公开 90% 或 benchmark 胜出仍需 public challenge raw proof。'
      : '可作为内部/release 候选能力；公开强 claim 前仍需 live/raw 证据。',
    nextAction: hasLive
      ? '随最终六阶段测试回归。'
      : '补一次真实 DSXU workflow/live evidence。',
  }
}

function fitTierFor(row: Pick<AcceptanceRow, 'acceptanceDecision' | 'strictPublicClaimAllowed'> & CrosswalkRow): Pick<AcceptanceRow, 'dsxuFitTier' | 'dsxuFitReason'> {
  if (row.strictPublicClaimAllowed) {
    return {
      dsxuFitTier: 'public-sellable-now',
      dsxuFitReason: '已经有 DSXU source/test/live 证据，可进入公开卖点，但仍不得宣称公开 90% 对标达成。',
    }
  }
  if (row.acceptanceDecision === 'implemented+tested') {
    return {
      dsxuFitTier: 'workflow-sellable-now',
      dsxuFitReason: '适合 DSXU 主工作流和 README 功能说明，但不能包装成成本/榜单/外部胜出 claim。',
    }
  }
  if (row.acceptanceDecision === 'implemented+tested-needs-live-window') {
    return {
      dsxuFitTier: 'product-fit-after-live-window',
      dsxuFitReason: '功能方向适合 DSXU，但必须补真实 TUI/CLI/API 窗口、失败恢复或 ablation live 证据后才能公开卖。',
    }
  }
  if (row.acceptanceDecision === 'adapted/subset+tested') {
    return {
      dsxuFitTier: 'sellable-with-boundary',
      dsxuFitReason: '适合 DSXU，但必须写成 DSXU 自有子集/适配能力，不能扩大成完整外部功能或参考产品 parity。',
    }
  }
  if (row.acceptanceDecision === 'guard-or-eval-coordinate-only') {
    return {
      dsxuFitTier: 'benchmark-coordinate-only',
      dsxuFitReason: '适合作为挑战任务/评测坐标，不适合作为当前产品功能卖点。',
    }
  }
  return {
    dsxuFitTier: 'deferred-or-not-suitable-now',
    dsxuFitReason: '当前缺主线实现或 raw/live 证据，只能 roadmap/deferred，不能写进 PASS 或卖点。',
  }
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function markdownTable(rows: Record<string, unknown>[], columns: string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' |')} |`,
    ...rows.map(row => `| ${columns.map(col => String(row[col] ?? '').replace(/\n/g, '<br>')).join(' |')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  if (!existsSync(CROSSWALK_JSON)) {
    throw new Error(`Missing crosswalk JSON: ${relative(ROOT, CROSSWALK_JSON)}. Run capability:cost-crosswalk first.`)
  }
  await mkdir(GENERATED_DIR, { recursive: true })
  const crosswalk = JSON.parse(await readFile(CROSSWALK_JSON, 'utf8')) as { rows: CrosswalkRow[] }
  const clean = existsSync(CLEAN_DOC) ? await readFile(CLEAN_DOC, 'utf8') : ''
  const cleanTests = parseCleanEvidenceTests(clean)
  const repoFiles = await allRepoFiles()
  const terminalLiveAcceptedIds = await loadTerminalLiveAcceptedIds()
  const hasSourceCacheAcceptance = await sourceCacheAcceptancePassed()
  const hasVisibleStateAcceptance = await visibleStateAcceptancePassed()
  const hasDeepSeekCostQualityAcceptance = await deepseekCostQualityAcceptancePassed()
  const hasAgentMcpSkillBoundaryAcceptance = await agentMcpSkillBoundaryAcceptancePassed()
  const hasExternalBenchmarkAdapterProof = await externalBenchmarkAdapterProofPassed()
  const hasPublicChallengeAblationAcceptance = await publicChallengeAblationAcceptancePassed()
  const ablationLiveAcceptedIds = hasPublicChallengeAblationAcceptance ? publicChallengeAblationAcceptedIds : new Set<string>()

  const rows: AcceptanceRow[] = crosswalk.rows.map(row => {
    const ownerFiles = row.ownerEvidence.filter(fileExistsOrGlob).length
    const terminalLiveEvidence =
      terminalLiveAcceptedIds.has(row.id) && existsSync(TERMINAL_LIVE_ACCEPTANCE_MD)
        ? [relative(ROOT, TERMINAL_LIVE_ACCEPTANCE_MD).replace(/\\/g, '/')]
        : []
    const sourceCacheEvidence =
      hasSourceCacheAcceptance && sourceCacheAcceptedIds.has(row.id) && existsSync(SOURCE_CACHE_ACCEPTANCE_MD)
        ? [relative(ROOT, SOURCE_CACHE_ACCEPTANCE_MD).replace(/\\/g, '/')]
        : []
    const visibleStateEvidence =
      hasVisibleStateAcceptance && visibleStateAcceptedIds.has(row.id) && existsSync(VISIBLE_STATE_ACCEPTANCE_MD)
        ? [relative(ROOT, VISIBLE_STATE_ACCEPTANCE_MD).replace(/\\/g, '/')]
        : []
    const deepseekCostQualityEvidence =
      hasDeepSeekCostQualityAcceptance && deepseekCostQualityAcceptedIds.has(row.id) && existsSync(DEEPSEEK_COST_QUALITY_ACCEPTANCE_MD)
        ? [relative(ROOT, DEEPSEEK_COST_QUALITY_ACCEPTANCE_MD).replace(/\\/g, '/')]
        : []
    const agentMcpSkillBoundaryEvidence =
      hasAgentMcpSkillBoundaryAcceptance && agentMcpSkillBoundaryAcceptedIds.has(row.id) && existsSync(AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_MD)
        ? [relative(ROOT, AGENT_MCP_SKILL_BOUNDARY_ACCEPTANCE_MD).replace(/\\/g, '/')]
        : []
    const externalBenchmarkAdapterProofEvidence =
      hasExternalBenchmarkAdapterProof && externalBenchmarkAdapterProofAcceptedIds.has(row.id) && existsSync(EXTERNAL_BENCHMARK_ADAPTER_PROOF_MD)
        ? [relative(ROOT, EXTERNAL_BENCHMARK_ADAPTER_PROOF_MD).replace(/\\/g, '/')]
        : []
    const publicChallengeAblationEvidence =
      hasPublicChallengeAblationAcceptance && publicChallengeAblationAcceptedIds.has(row.id) && existsSync(PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_MD)
        ? [relative(ROOT, PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_MD).replace(/\\/g, '/')]
        : []
    const rowWithLiveEvidence = {
      ...row,
      liveEvidence: [...row.liveEvidence, ...terminalLiveEvidence, ...sourceCacheEvidence, ...visibleStateEvidence, ...deepseekCostQualityEvidence, ...agentMcpSkillBoundaryEvidence, ...externalBenchmarkAdapterProofEvidence, ...publicChallengeAblationEvidence],
    }
    const liveFiles = rowWithLiveEvidence.liveEvidence.filter(fileExistsOrGlob).length
    const testsFromClean = [...(cleanTests.get(row.id) ?? []), ...(currentTestAliasesById.get(row.id) ?? [])]
    const testsFound = findTests(testsFromClean, repoFiles)
    const classified = classify(rowWithLiveEvidence, ownerFiles, liveFiles, testsFound, terminalLiveAcceptedIds, ablationLiveAcceptedIds)
    const fit = fitTierFor({ ...rowWithLiveEvidence, ...classified })
    return {
      ...rowWithLiveEvidence,
      ...classified,
      ...fit,
      explicitEvidenceFound: {
        ownerFiles,
        liveFiles,
        testsFromClean,
        testsFound,
      },
    }
  })

  const summary = {
    schemaVersion: 'dsxu.capability-acceptance-audit.v1',
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    historicalPassRows: rows.filter(row => row.historicalStatus === 'PASS').length,
    deferredRows: rows.filter(row => row.acceptanceDecision === 'deferred-not-pass').length,
    fullyImplementedTestedRows: rows.filter(row => row.acceptanceDecision === 'implemented+tested').length,
    liveWindowNeededRows: rows.filter(row => row.acceptanceDecision === 'implemented+tested-needs-live-window').length,
    subsetOrAdaptedRows: rows.filter(row => row.acceptanceDecision === 'adapted/subset+tested').length,
    evalCoordinateOnlyRows: rows.filter(row => row.acceptanceDecision === 'guard-or-eval-coordinate-only').length,
    needsRealFunctionalAcceptanceRows: rows.filter(row => row.acceptanceDecision === 'needs-real-functional-acceptance').length,
    strictPublicClaimAllowedRows: rows.filter(row => row.strictPublicClaimAllowed).length,
    byFitTier: Object.fromEntries(
      [...new Set(rows.map(row => row.dsxuFitTier))]
        .map(tier => [tier, rows.filter(row => row.dsxuFitTier === tier).length]),
    ),
    dsxuSuitableRows:
      rows.filter(row => ['public-sellable-now', 'workflow-sellable-now', 'product-fit-after-live-window', 'sellable-with-boundary'].includes(row.dsxuFitTier)).length,
    dsxuUnsuitableForCurrentReleaseRows:
      rows.filter(row => ['benchmark-coordinate-only', 'deferred-or-not-suitable-now'].includes(row.dsxuFitTier)).length,
    decision:
      '70 historical PASS must be treated as alignment evidence, not blanket feature-complete acceptance. 33 rows are strict public-sellable now; more rows are still suitable for DSXU but require boundary wording or live acceptance.',
  }

  const riskRows = rows.filter(row => row.acceptanceDecision !== 'implemented+tested')
  const json = { summary, rows, riskRows }
  await writeFile(OUT_JSON, `${JSON.stringify(json, null, 2)}\n`)

  const csvColumns = [
    'id',
    'domain',
    'capability',
    'historicalStatus',
    'acceptanceDecision',
    'evidenceStrength',
    'strictPublicClaimAllowed',
    'dsxuFitTier',
    'dsxuFitReason',
    'dsxuOwner',
    'v18Meaning',
    'risk',
    'nextAction',
  ]
  await writeFile(
    OUT_CSV,
    [
      csvColumns.join(','),
      ...rows.map(row => csvColumns.map(col => csvCell((row as unknown as Record<string, unknown>)[col])).join(',')),
    ].join('\n') + '\n',
  )

  const summaryRows = [summary]
  const riskTable = riskRows.map(row => ({
    id: row.id,
    capability: row.capability,
    decision: row.acceptanceDecision,
    evidence: row.evidenceStrength,
    fitTier: row.dsxuFitTier,
    nextAction: row.nextAction,
  }))
  const fitRows = Object.entries(summary.byFitTier).map(([fitTier, count]) => ({
    fitTier,
    count,
  }))
  const md = [
    '# DSXU Capability Acceptance Audit - 2026-05-16',
    '',
    'This audit reclassifies the historical V18/V19 82 capability table. `70 PASS` means historical alignment pass; it is not automatically a full product-function acceptance or public benchmark claim.',
    '',
    '## Summary',
    '',
    markdownTable(summaryRows, [
      'totalRows',
      'historicalPassRows',
      'fullyImplementedTestedRows',
      'liveWindowNeededRows',
      'subsetOrAdaptedRows',
      'evalCoordinateOnlyRows',
      'deferredRows',
      'needsRealFunctionalAcceptanceRows',
      'strictPublicClaimAllowedRows',
      'dsxuSuitableRows',
      'dsxuUnsuitableForCurrentReleaseRows',
    ]),
    '',
    '## DSXU Fit Tiers',
    '',
    markdownTable(fitRows, ['fitTier', 'count']),
    '',
    '## Rows That Must Not Be Treated As Full Feature PASS',
    '',
    markdownTable(riskTable, ['id', 'capability', 'decision', 'evidence', 'fitTier', 'nextAction']),
    '',
    '## Rules',
    '',
    '- `implemented+tested` can support DSXU-owned release evidence, but public 90% ability still requires public challenge raw proof.',
    '- `implemented+tested-needs-live-window` must go through real DSXU TUI/CLI/API workflow acceptance.',
    '- `adapted/subset+tested` can be sold only under DSXU-owned constrained wording.',
    '- `guard-or-eval-coordinate-only` is not a benchmark pass.',
    '- `deferred-not-pass` remains roadmap/gap and must not enter PASS copy.',
    '',
  ].join('\n')
  await writeFile(OUT_MD, md)

  console.log('PASS_DSXU_CAPABILITY_ACCEPTANCE_AUDIT_GENERATED')
  console.log(`totalRows=${summary.totalRows}`)
  console.log(`historicalPassRows=${summary.historicalPassRows}`)
  console.log(`fullyImplementedTestedRows=${summary.fullyImplementedTestedRows}`)
  console.log(`liveWindowNeededRows=${summary.liveWindowNeededRows}`)
  console.log(`subsetOrAdaptedRows=${summary.subsetOrAdaptedRows}`)
  console.log(`evalCoordinateOnlyRows=${summary.evalCoordinateOnlyRows}`)
  console.log(`deferredRows=${summary.deferredRows}`)
  console.log(`strictPublicClaimAllowedRows=${summary.strictPublicClaimAllowedRows}`)
  console.log(`dsxuSuitableRows=${summary.dsxuSuitableRows}`)
  console.log(`byFitTier=${JSON.stringify(summary.byFitTier)}`)
  console.log(`json=${relative(ROOT, OUT_JSON)}`)
  console.log(`markdown=${relative(ROOT, OUT_MD)}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
