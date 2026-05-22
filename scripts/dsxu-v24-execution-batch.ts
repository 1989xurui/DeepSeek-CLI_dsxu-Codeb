import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const DATE = '20260515'
const REPO_ROOT = process.cwd()
const GENERATED_DIR = join(REPO_ROOT, 'docs', 'generated')
const CLAUDE_SRC_ROOT = process.env.DSXU_CLAUDE_SRC_ROOT ?? 'D:\\源代码claude\\src'
const DSXU_SRC_ROOT = join(REPO_ROOT, 'src')

const OUTPUTS = {
  baselineJson: join(GENERATED_DIR, `DSXU_V24_BASELINE_AUDIT_${DATE}.json`),
  baselineCsv: join(GENERATED_DIR, `DSXU_V24_BASELINE_AUDIT_${DATE}.csv`),
  redlineJson: join(GENERATED_DIR, `DSXU_V24_RUNTIME_STUB_REDLINE_${DATE}.json`),
  redlineCsv: join(GENERATED_DIR, `DSXU_V24_RUNTIME_STUB_REDLINE_${DATE}.csv`),
  densityJson: join(GENERATED_DIR, `DSXU_V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE_${DATE}.json`),
  densityCsv: join(GENERATED_DIR, `DSXU_V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE_${DATE}.csv`),
  subLoopCsv: join(GENERATED_DIR, `DSXU_V24_C2_SECONDARY_LOOP_REBASELINE_${DATE}.csv`),
  c2AcceptanceJson: join(GENERATED_DIR, `DSXU_V24_C2_FEATURE_ACCEPTANCE_MATRIX_${DATE}.json`),
  c2AcceptanceCsv: join(GENERATED_DIR, `DSXU_V24_C2_FEATURE_ACCEPTANCE_MATRIX_${DATE}.csv`),
  redlineTriageJson: join(GENERATED_DIR, `DSXU_V24_REDLINE_OWNER_PACKET_TRIAGE_${DATE}.json`),
  redlineTriageCsv: join(GENERATED_DIR, `DSXU_V24_REDLINE_OWNER_PACKET_TRIAGE_${DATE}.csv`),
  deepseekJson: join(GENERATED_DIR, `DSXU_V24_DEEPSEEK_RUNTIME_CONTRACT_${DATE}.json`),
  deepseekCsv: join(GENERATED_DIR, `DSXU_V24_DEEPSEEK_RUNTIME_CONTRACT_${DATE}.csv`),
  workStateJson: join(GENERATED_DIR, `DSXU_V24_WORK_STATE_TIMELINE_ACCEPTANCE_${DATE}.json`),
  workStateCsv: join(GENERATED_DIR, `DSXU_V24_WORK_STATE_TIMELINE_ACCEPTANCE_${DATE}.csv`),
  batchJson: join(GENERATED_DIR, `DSXU_V24_EXECUTION_BATCH_${DATE}.json`),
  batchMd: join(REPO_ROOT, 'docs', `DSXU_V24_EXECUTION_BATCH_${DATE}.md`),
}

const SOURCE_EXTENSIONS = /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i
const SOURCE_GLOBS = ['-g', '*.ts', '-g', '*.tsx', '-g', '*.js', '-g', '*.jsx', '-g', '*.mjs', '-g', '*.cjs']

type GitStatusSummary = {
  total: number
  staged: number
  unstaged: number
  untracked: number
  modified: number
  deleted: number
  renamed: number
}

type BaselineReport = {
  schemaVersion: 'dsxu.v24.baseline-audit.v1'
  generatedAt: string
  repoRoot: string
  claudeSourceRoot: string
  claudeSourceExists: boolean
  sourceCounts: {
    publishSurfaceFiles: number
    dsxuSourceFiles: number
    claudeSourceFiles: number
  }
  topDirs: {
    dsxu: readonly string[]
    claude: readonly string[]
  }
  gitStatusShort: GitStatusSummary
  v20Evidence: Record<string, unknown>
  v24GateStatus: readonly GateRow[]
  status: 'PASS_BASELINE_FIXED_WITH_OPEN_GATES'
  nextAction: string
  rule: string
}

type GateRow = {
  gate: string
  status: string
  count: number
  requiredNextAction: string
}

type RedlineRow = {
  path: string
  line: number
  category: string
  token: string
  severity: 'BLOCKER_REVIEW' | 'OWNER_REVIEW' | 'RELEASE_COPY_REVIEW' | 'INFO_REVIEW'
  disposition: string
  ownerGuess: string
  requiredAction: string
  excerpt: string
}

type LoopRow = {
  id: number
  loop: string
  owner: string
  pattern: string
  claudeFileHits: number
  dsxuFileHits: number
  status: 'SIGNAL_PRESENT_NEEDS_BEHAVIOR_EVIDENCE' | 'REVIEW_COMPRESSED_SIGNAL' | 'GAP_NO_DSXU_SIGNAL'
  requiredEvidence: string
}

type SecondaryLoopRow = {
  id: number
  loop: string
  owner: string
  pattern: string
  claudeFileHits: number
  dsxuFileHits: number
  status: 'SIGNAL_PRESENT_NEEDS_BEHAVIOR_EVIDENCE' | 'REVIEW_COMPRESSED_SIGNAL' | 'GAP_NO_DSXU_SIGNAL'
  requiredEvidence: string
}

type DensityReport = {
  schemaVersion: 'dsxu.v24.claude-experience-density-rebaseline.v1'
  generatedAt: string
  claudeSourceRoot: string
  dsxuSourceRoot: string
  claudeSourceExists: boolean
  dsxuSourceExists: boolean
  sourceCounts: {
    claude: number
    dsxu: number
  }
  categorySignalSummary: {
    claudeCategoryHits: number
    dsxuCategoryHits: number
    claudeMultiSignal4: number
    dsxuMultiSignal4: number
    claudeMultiSignal6: number
    dsxuMultiSignal6: number
  }
  categoryRows: readonly {
    category: string
    claudeFileHits: number
    dsxuFileHits: number
  }[]
  primaryLoops: readonly LoopRow[]
  secondaryLoops: readonly SecondaryLoopRow[]
  status: 'OPEN_BEHAVIOR_ACCEPTANCE_REQUIRED'
  nextAction: string
  rule: string
}

type ContractRow = {
  id: string
  owner: string
  mechanism: string
  evidenceFiles: string
  fileHitCount: number
  signalHitCount: number
  status: 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED' | 'OPEN_PRODUCTIZATION_REQUIRED' | 'GAP_NO_SIGNAL'
  requiredNextAction: string
}

type AcceptanceRow = {
  id: string
  scope: 'primary-loop' | 'secondary-loop'
  loop: string
  owner: string
  claudeFileHits: number
  dsxuFileHits: number
  signalStatus: string
  acceptanceStatus: 'OPEN_BEHAVIOR_EVIDENCE_REQUIRED'
  requiredEvidence: string
}

type RedlineTriageRow = {
  owner: string
  totalRows: number
  blockerReviewRows: number
  ownerReviewRows: number
  releaseCopyReviewRows: number
  infoReviewRows: number
  topDisposition: string
  firstAction: string
}

const v20EvidencePaths = {
  finalPreflight: join(GENERATED_DIR, `DSXU_V20_FINAL_PREFLIGHT_${DATE}.json`),
  blockerBoard: join(GENERATED_DIR, `DSXU_V20_BLOCKER_ACTION_BOARD_${DATE}.json`),
  cleanExportPreflight: join(GENERATED_DIR, `DSXU_V20_CLEAN_EXPORT_PREFLIGHT_${DATE}.json`),
  c2FinalSignoff: join(GENERATED_DIR, `DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_SUMMARY_${DATE}.json`),
  c2FunctionLoss: join(GENERATED_DIR, `DSXU_V20_C2_FUNCTION_LOSS_REVIEW_SUMMARY_${DATE}.json`),
}

const categories = [
  { name: 'query_loop_state', pattern: 'query|loop|session|turn|conversation|prompt' },
  { name: 'visible_work_state', pattern: 'status|progress|timeline|render|screen|repl|tui|ui|visible' },
  { name: 'tool_lifecycle', pattern: 'tool|execute|schema|result|hook|adapter' },
  { name: 'permission_safety', pattern: 'permission|approve|deny|risk|safe|policy' },
  { name: 'context_memory_compact', pattern: 'context|memory|compact|resume|summary' },
  { name: 'agent_task_lifecycle', pattern: 'agent|worker|task|todo|plan|delegate' },
  { name: 'mcp_plugin_skill', pattern: 'mcp|plugin|skill|registry|server' },
  { name: 'model_cost_cache', pattern: 'model|cost|cache|token|usage|pricing|latency' },
  { name: 'recovery_failure', pattern: 'error|fail|recover|retry|fallback|abort' },
  { name: 'coding_workflow', pattern: 'edit|diff|patch|file|git|test' },
  { name: 'remote_ide_api', pattern: 'ide|vscode|remote|bridge|api|sdk' },
  { name: 'telemetry_evidence', pattern: 'telemetry|evidence|metric|trace|report|audit' },
] as const

const primaryLoops = [
  {
    id: 1,
    loop: 'Goal / Intent / Session Loop',
    owner: 'Query Loop',
    pattern: 'goal|intent|session|topic|conversation|query|prompt',
    requiredEvidence: 'same-window topic replay and long-task goal retention transcript',
  },
  {
    id: 2,
    loop: 'Visible Work-State Loop',
    owner: 'UI/TUI Work-State',
    pattern: 'status|progress|timeline|visible|render|screen|repl|tui',
    requiredEvidence: 'TUI/CLI/stream-json timeline with goal, tool, permission, failure, cost, next action',
  },
  {
    id: 3,
    loop: 'Tool Lifecycle Loop',
    owner: 'Tool Gate',
    pattern: 'tool|schema|execute|progress|result|posthook|hook|adapter',
    requiredEvidence: 'strict schema, permission, execution, result pairing evidence pack',
  },
  {
    id: 4,
    loop: 'Permission / Safety Loop',
    owner: 'Permission Gate',
    pattern: 'permission|approve|deny|risk|safe|policy|danger|destructive',
    requiredEvidence: 'permission replay including denial recovery across shell, edit, MCP, browser, agent',
  },
  {
    id: 5,
    loop: 'Source Truth / Coding Loop',
    owner: 'Coding Workflow',
    pattern: 'read|edit|diff|patch|file|git|test|source',
    requiredEvidence: 'real read/patch/diff/test/final report task trace',
  },
  {
    id: 6,
    loop: 'Plan / Todo / Task Loop',
    owner: 'Task State',
    pattern: 'plan|todo|task|step|active|complete|verify',
    requiredEvidence: 'task timeline proving completion only after tool/test evidence',
  },
  {
    id: 7,
    loop: 'Agent Delegation Loop',
    owner: 'Agent Lifecycle',
    pattern: 'agent|worker|delegate|parallel|fanout|synthesis|teammate',
    requiredEvidence: 'serial/parallel worker replay and parent synthesis evidence references',
  },
  {
    id: 8,
    loop: 'Context / Memory / Compact Loop',
    owner: 'Context Recovery',
    pattern: 'context|memory|compact|resume|summary|restore|session',
    requiredEvidence: '45-minute resume replay with source-truth reread',
  },
  {
    id: 9,
    loop: 'Failure / Recovery Loop',
    owner: 'Recovery',
    pattern: 'error|fail|recover|retry|fallback|abort|exception',
    requiredEvidence: 'named failure taxonomy and recovery transcript',
  },
  {
    id: 10,
    loop: 'Model / Cost / Cache Loop',
    owner: 'DeepSeek Model Router',
    pattern: 'model|cost|cache|token|usage|pricing|latency|fim|thinking|reasoning',
    requiredEvidence: 'DeepSeek route trace, cache hit/miss, task cost ROI',
  },
  {
    id: 11,
    loop: 'MCP / Skill / Plugin Loop',
    owner: 'MCP/Skill Registry',
    pattern: 'mcp|plugin|skill|registry|server|manifest|doctor',
    requiredEvidence: 'MCP intake, skill selection, doctor, secret redaction',
  },
  {
    id: 12,
    loop: 'IDE / Remote / API Loop',
    owner: 'IDE/API Bridge',
    pattern: 'ide|vscode|remote|bridge|api|sdk|stream-json',
    requiredEvidence: 'IDE bridge smoke with diff, permission, timeline',
  },
  {
    id: 13,
    loop: 'Browser / External Action Loop',
    owner: 'External Tool Provider',
    pattern: 'browser|chrome|web|fetch|screenshot|external|provider',
    requiredEvidence: 'browser task transcript with permission and evidence',
  },
  {
    id: 14,
    loop: 'Telemetry / Evidence / Report Loop',
    owner: 'Evidence',
    pattern: 'telemetry|evidence|metric|trace|report|audit|raw',
    requiredEvidence: 'PASS/PARTIAL/FAIL metrics, trace, risk, cost',
  },
  {
    id: 15,
    loop: 'Release / Doctor / Install Loop',
    owner: 'Release',
    pattern: 'release|doctor|install|export|package|preflight|smoke',
    requiredEvidence: 'clean export and fresh install smoke',
  },
] as const

const secondaryLoops = [
  ['user intent and task boundary', 'Query Loop', 'intent|goal|constraint|boundary|topic|session'],
  ['repository orientation', 'Source Truth', 'repository|workspace|tree|directory|entrypoint|owner'],
  ['real import/use evidence', 'Owner/Git Evidence', 'import|export|require|reference|use|dependency'],
  ['active plan state', 'Task State', 'plan|todo|step|active|pending|complete'],
  ['todo verified before complete', 'Task State', 'verify|evidence|complete|done|validated'],
  ['file localization and edit boundary', 'Coding Workflow', 'locate|read|range|edit|patch|diff'],
  ['diff risk explanation', 'Coding Workflow', 'diff|risk|impact|compat|test gap'],
  ['tool schema selection', 'Tool Gate', 'tool|schema|subset|selection|router'],
  ['strict tool parameter validation', 'Tool Gate', 'schema|required|additionalProperties|validate|strict'],
  ['Bash/PowerShell lifecycle', 'Shell Adapter', 'bash|powershell|shell|exit code|cwd|stdout|stderr'],
  ['write permission chain', 'Permission Gate', 'write|edit|delete|move|permission|approve'],
  ['destructive command guard', 'Permission Gate', 'destructive|danger|reset|remove|delete|clean'],
  ['MCP server intake', 'MCP Registry', 'mcp|server|manifest|schema|secret|doctor'],
  ['skill and command intake', 'Skill Registry', 'skill|command|registry|project|load'],
  ['browser and external action', 'External Provider', 'browser|chrome|screenshot|web|external'],
  ['IDE/API entry', 'IDE/API Bridge', 'vscode|ide|api|bridge|sdk|remote'],
  ['agent ownership boundary', 'Agent Lifecycle', 'agent|worker|owner|scope|delegate'],
  ['agent evidence synthesis', 'Agent Lifecycle', 'synthesis|worker|evidence|result|parent'],
  ['parallel cancel and recovery', 'Agent Lifecycle', 'cancel|timeout|stop|recover|parallel'],
  ['context compact', 'Context Recovery', 'compact|summary|context|memory'],
  ['resume source reread', 'Context Recovery', 'resume|restore|reread|source|truth'],
  ['failure classification', 'Recovery', 'failure|error|classify|taxonomy|reason'],
  ['test failure repair path', 'Coding Workflow', 'test|fail|repair|fix|diagnostic'],
  ['provider retry/escalation', 'Model Router', 'retry|fallback|escalate|pro|flash|provider'],
  ['thinking trajectory return', 'DeepSeek Runtime', 'thinking|reasoning_content|trajectory|tool call'],
  ['FIM edit lane', 'DeepSeek Runtime', 'fim|fill-in-middle|completion|edit lane'],
  ['cache/prefix ROI', 'DeepSeek Runtime', 'cache|prefix|hit|miss|roi'],
  ['cost visibility', 'Cost Evidence', 'cost|pricing|usage|token|latency'],
  ['progress visibility', 'Work-State', 'progress|status|heartbeat|timeline|visible'],
  ['UI/TUI input experience', 'UI/TUI', 'prompt|input|permission|diff|error|continue'],
  ['final answer evidence', 'Evidence', 'final|answer|evidence|risk|verified'],
  ['telemetry and report', 'Evidence', 'telemetry|metric|trace|report|audit'],
  ['public challenge packaging', 'Product Data', 'challenge|raw|transcript|patch|metrics'],
  ['performance and experience data', 'Product Data', 'p50|p95|latency|throughput|cache|performance'],
  ['license/IP/brand guard', 'Commercial/IP', 'license|notice|brand|copyright|patent|trademark'],
  ['release/install/doctor', 'Release', 'release|install|doctor|export|smoke|package'],
] as const

const redlinePatterns = [
  {
    category: 'stub_or_incomplete',
    regex: '\\bTODO\\b|\\bFIXME\\b|not implemented|placeholder|stub\\b|deferred',
    severity: 'BLOCKER_REVIEW' as const,
    requiredAction: 'classify as implemented, test-only, release-excluded, or required V24 owner work',
  },
  {
    category: 'runtime_duplication_pressure',
    regex: 'legacy|compat|bridge|facade|adapter|migration',
    severity: 'OWNER_REVIEW' as const,
    requiredAction: 'prove facade/test-only/owner migration; no second product runtime',
  },
  {
    category: 'third_party_brand_surface',
    regex: 'Claude|Anthropic|OpenAI|OpenClaw|Hermes|AionUi|Cherry|Warp|browser-use',
    severity: 'RELEASE_COPY_REVIEW' as const,
    requiredAction: 'keep only compatibility/docs/test context; remove public product branding if present',
  },
] as const

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv<T extends Record<string, unknown>>(rows: readonly T[], headers: readonly (keyof T & string)[]): string {
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n'
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(value, null, 2) + '\n')
}

async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, value)
}

async function readJsonIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    return { readError: String(error) }
  }
}

function numberFromJson(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

async function execText(file: string, args: readonly string[], cwd = REPO_ROOT): Promise<string> {
  const { stdout } = await execFileAsync(file, [...args], {
    cwd,
    maxBuffer: 1024 * 1024 * 128,
  })
  return stdout
}

async function execTextAllowNoMatch(file: string, args: readonly string[], cwd = REPO_ROOT): Promise<string> {
  try {
    return await execText(file, args, cwd)
  } catch (error) {
    if ((error as { code?: number }).code === 1) return ''
    throw error
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

async function listFiles(root: string): Promise<string[]> {
  const stdout = await execTextAllowNoMatch('rg', ['--files', root])
  return stdout.split(/\r?\n/).filter(Boolean).filter(file => SOURCE_EXTENSIONS.test(file)).sort()
}

async function listPublishSurfaceFiles(): Promise<string[]> {
  const stdout = await execTextAllowNoMatch('rg', [
    '--files',
    '-g',
    '!.git/**',
    '-g',
    '!.dsxu/**',
    '-g',
    '!node_modules/**',
  ])
  return stdout.split(/\r?\n/).filter(Boolean).sort()
}

function topDirs(files: readonly string[], root: string): string[] {
  const counts = new Map<string, number>()
  for (const file of files) {
    const relative = file.startsWith(root) ? file.slice(root.length).replace(/^[/\\]/, '') : file
    const first = relative.split(/[\\/]/)[0] || '.'
    counts.set(first, (counts.get(first) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([name, count]) => `${name}:${count}`)
}

async function gitStatusShort(): Promise<GitStatusSummary> {
  const stdout = await execTextAllowNoMatch('git', ['status', '--short'])
  const rows = stdout.split(/\r?\n/).filter(Boolean)
  return {
    total: rows.length,
    staged: rows.filter(line => line[0] !== ' ' && line[0] !== '?').length,
    unstaged: rows.filter(line => line[1] !== ' ' && line.slice(0, 2) !== '??').length,
    untracked: rows.filter(line => line.slice(0, 2) === '??').length,
    modified: rows.filter(line => line.includes('M')).length,
    deleted: rows.filter(line => line.includes('D')).length,
    renamed: rows.filter(line => line.includes('R')).length,
  }
}

async function rgHitFiles(root: string, pattern: string): Promise<string[]> {
  const stdout = await execTextAllowNoMatch('rg', ['-l', '-i', ...SOURCE_GLOBS, '--', pattern, root])
  return stdout.split(/\r?\n/).filter(Boolean).filter(file => SOURCE_EXTENSIONS.test(file)).sort()
}

async function signalStats(root: string): Promise<{
  files: string[]
  categoryHits: number
  multiSignal4: number
  multiSignal6: number
  categoryRows: { category: string; fileHits: number }[]
}> {
  const files = await listFiles(root)
  const scores = new Map(files.map(file => [file, 0]))
  const categoryRows: { category: string; fileHits: number }[] = []
  let categoryHits = 0
  for (const category of categories) {
    const hits = await rgHitFiles(root, category.pattern)
    categoryHits += hits.length
    categoryRows.push({ category: category.name, fileHits: hits.length })
    for (const hit of hits) {
      if (scores.has(hit)) scores.set(hit, (scores.get(hit) ?? 0) + 1)
    }
  }
  const values = [...scores.values()]
  return {
    files,
    categoryHits,
    multiSignal4: values.filter(value => value >= 4).length,
    multiSignal6: values.filter(value => value >= 6).length,
    categoryRows,
  }
}

function loopStatus(claudeHits: number, dsxuHits: number): LoopRow['status'] {
  if (dsxuHits === 0) return 'GAP_NO_DSXU_SIGNAL'
  if (claudeHits > 0 && dsxuHits < Math.max(3, Math.floor(claudeHits * 0.25))) return 'REVIEW_COMPRESSED_SIGNAL'
  return 'SIGNAL_PRESENT_NEEDS_BEHAVIOR_EVIDENCE'
}

function ownerGuess(path: string): string {
  const normalized = path.replace(/\\/g, '/').toLowerCase()
  if (normalized.includes('/__tests__/') || normalized.includes('.test.') || normalized.includes('/test/') || normalized.includes('/harness/')) return 'test-evidence-harness'
  if (normalized.startsWith('scripts/')) return 'evidence-automation'
  if (normalized === 'src/main.tsx' || normalized === 'src/commands.ts' || normalized.includes('/bootstrap/') || normalized.includes('/entrypoints/')) return 'cli-command-transport'
  if (normalized === 'src/query.ts' || normalized.includes('/utils/processuserinput/') || normalized.includes('/utils/handlepromptsubmit') || normalized.includes('/utils/query')) return 'query-loop'
  if (normalized.includes('/utils/instructionfiles') || normalized.includes('/utils/messages') || normalized.includes('/utils/session') || normalized.includes('/utils/messagequeue') || normalized.includes('/utils/conversation') || normalized.includes('/utils/collapse')) return 'context-recovery'
  if (normalized.includes('/utils/effort') || normalized.includes('/utils/thinking') || normalized.includes('/utils/fastmode') || normalized.includes('/services/ratelimit')) return 'model-router-cost'
  if (normalized.includes('/utils/attachments') || normalized.includes('/utils/imagepaste') || normalized.includes('/utils/file') || normalized.includes('/utils/worktree') || normalized.includes('/utils/argumentsubstitution') || normalized.includes('/utils/ripgrep')) return 'coding-workflow'
  if (normalized.includes('/utils/git') || normalized.includes('/utils/fsoperations') || normalized.includes('/utils/pdf') || normalized.includes('/services/magicdocs')) return 'coding-workflow'
  if (normalized.includes('/services/static-analysis/') || normalized.includes('/utils/generators')) return 'coding-workflow'
  if (normalized.includes('/services/eval/') || normalized.includes('/services/pbt/')) return 'public-challenge-eval'
  if (normalized.includes('/services/experience/') || normalized.includes('/memdir/')) return 'context-recovery'
  if (normalized.includes('/utils/hooks') || normalized.includes('/commands/hooks')) return 'hook-lifecycle'
  if (normalized.includes('/utils/auth') || normalized.includes('/utils/securestorage') || normalized.includes('/utils/managedenv') || normalized.includes('/utils/subprocessenv') || normalized.includes('/utils/http') || normalized.includes('/services/settingssync/') || normalized.includes('/services/oauth/') || normalized.includes('/services/policylimits/') || normalized.includes('/utils/privacylevel') || normalized.includes('/utils/user') || normalized.includes('/utils/markdownconfigloader') || normalized.includes('/local-work/infrastructure/config/') || normalized.includes('/query/config') || normalized.includes('/utils/cacerts') || normalized.includes('/utils/cachepaths') || normalized.includes('/utils/promptcategory') || normalized.includes('/utils/betas')) return 'config-settings'
  if (normalized.includes('/utils/commitattribution') || normalized.includes('/utils/attribution') || normalized.includes('/utils/status') || normalized.includes('/utils/sinks') || normalized.includes('/utils/statscache') || normalized.includes('/services/tips/') || normalized.includes('/utils/dsxucodehints')) return 'evidence-telemetry'
  if (normalized.includes('/utils/api') || normalized.includes('/services/vcr') || normalized.includes('/services/tokenestimation') || normalized.includes('/utils/extrausage') || normalized.includes('/utils/controlmessagecompat')) return 'api-contract-types'
  if (normalized.includes('/utils/sandbox') || normalized.includes('/utils/computeruse') || normalized.includes('/services/voice') || normalized.includes('/voice/') || normalized.includes('/utils/jetbrains')) return 'external-tool-provider'
  if (normalized.includes('/keybindings/') || normalized.includes('/interactivehelpers') || normalized.includes('/nativets/') || normalized.includes('/native-ts/') || normalized.includes('/utils/displaytags') || normalized.includes('/outputstyles/') || normalized.includes('/services/promptsuggestion/') || normalized.includes('/utils/earlyinput') || normalized.includes('/utils/format') || normalized.includes('/utils/imageresizer') || normalized.includes('/utils/suggestions/') || normalized.includes('/vim/') || normalized.includes('/dialoglaunchers') || normalized.includes('/moreright/') || normalized.includes('/utils/cursor')) return 'ui-tui-work-state'
  if (normalized.includes('/utils/autoupdater') || normalized.includes('/utils/cleanup') || normalized.includes('/utils/tmuxsocket') || normalized.includes('/utils/gracefulshutdown') || normalized.includes('/utils/systemdirectories') || normalized.includes('/coordinator/') || normalized.includes('/utils/detectrepository')) return 'release-doctor'
  if (normalized.includes('/localrecoverycli') || normalized.includes('/history') || normalized.includes('/assistant/sessionhistory') || normalized.includes('/utils/concurrentsessions') || normalized.includes('/utils/listsessions') || normalized.includes('/utils/transcriptsearch')) return 'context-recovery'
  if (normalized.includes('/services/lsp/') || normalized.includes('/services/mutation/') || normalized.includes('/utils/execfilenothrow') || normalized.includes('/utils/promptshellexecution')) return 'coding-workflow'
  if (normalized.includes('/services/mockratelimits')) return 'model-router-cost'
  if (normalized.includes('/services/dsxulimits')) return 'model-router-cost'
  if (normalized.includes('/utils/advisor') || normalized.includes('/utils/ultraplan/')) return 'agent-task-lifecycle'
  if (normalized.includes('/utils/bufferedwriter')) return 'cli-command-transport'
  if (normalized.includes('/utils/cronscheduler')) return 'agent-task-lifecycle'
  if (normalized.includes('/utils/teleport') || normalized.includes('/utils/background/remote') || normalized.includes('/utils/peeraddress') || normalized.includes('/utils/deeplink/') || normalized.includes('/server/directconnectmanager') || normalized.includes('/utils/undercover') || normalized.includes('/utils/taggedid')) return 'ide-api-bridge'
  if (normalized.includes('/utils/swarm/') || normalized.includes('/utils/teammate')) return 'agent-task-lifecycle'
  if (normalized.includes('/screens/') || normalized.includes('/components/') || normalized.includes('/ink/') || normalized.includes('/hooks/') || normalized.includes('/state/')) return 'ui-tui-work-state'
  if (normalized.includes('/cli/') || normalized.includes('/commands/') || normalized.includes('/entrypoints/')) return 'cli-command-transport'
  if (normalized.includes('/utils/bash/') || normalized.includes('/utils/shell') || normalized.includes('/utils/powershell/') || normalized.includes('/shell/') || normalized.includes('bash') || normalized.includes('powershell')) return 'tool-lifecycle'
  if (normalized.includes('/utils/settings/') || normalized.includes('/utils/config') || normalized.includes('/utils/env') || normalized.includes('/constants/') || normalized.includes('/migrations/')) return 'config-settings'
  if (normalized.includes('/types/') || normalized.includes('schema')) return 'api-contract-types'
  if (normalized.includes('/dsxu/engine/query') || normalized.includes('queryengine')) return 'query-loop'
  if (normalized.includes('/dsxu/engine/') || normalized.includes('/dsxu/control-plane/')) return 'dsxu-engine-mainline'
  if (normalized.includes('permission')) return 'permission-gate'
  if (normalized.includes('/tools/') || normalized.includes('tool')) return 'tool-lifecycle'
  if (normalized.includes('agent') || normalized.includes('task')) return 'agent-task-lifecycle'
  if (normalized.includes('mcp') || normalized.includes('skill') || normalized.includes('plugin')) return 'mcp-skill-registry'
  if (normalized.includes('model') || normalized.includes('deepseek') || normalized.includes('provider') || normalized.includes('/api/')) return 'model-router-cost'
  if (normalized.includes('bridge') || normalized.includes('remote') || normalized.includes('ide') || normalized.includes('sdk')) return 'ide-api-bridge'
  if (normalized.includes('context') || normalized.includes('memory') || normalized.includes('compact') || normalized.includes('resume')) return 'context-recovery'
  if (normalized.includes('telemetry') || normalized.includes('evidence') || normalized.includes('report') || normalized.includes('audit') || normalized.includes('analytics') || normalized.includes('diagnostic')) return 'evidence-telemetry'
  if (normalized.includes('release') || normalized.includes('doctor') || normalized.includes('install') || normalized.includes('export')) return 'release-doctor'
  return 'source-owner-review'
}

function isTestOrEvidencePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').toLowerCase()
  return normalized.includes('/__tests__/') ||
    normalized.includes('.test.') ||
    normalized.includes('/harness/') ||
    normalized.startsWith('scripts/')
}

function redlineDisposition(category: string, path: string, excerpt: string): {
  severity: RedlineRow['severity']
  disposition: string
  requiredAction: string
} {
  const normalized = path.replace(/\\/g, '/').toLowerCase()
  const lower = excerpt.toLowerCase()
  if (isTestOrEvidencePath(path)) {
    return {
      severity: 'INFO_REVIEW',
      disposition: 'test_or_evidence_context_not_product_runtime',
      requiredAction: 'keep as evidence/test context unless imported by product runtime',
    }
  }
  if (category === 'third_party_brand_surface') {
    return {
      severity: 'RELEASE_COPY_REVIEW',
      disposition: normalized.includes('/dsxu/') || normalized.includes('/services/') || normalized.includes('/utils/')
        ? 'source_brand_surface_requires_release_copy_review'
        : 'compatibility_or_public_copy_review',
      requiredAction: 'keep only compatibility/docs/test context; remove or neutralize public product branding if present',
    }
  }
  if (category === 'runtime_duplication_pressure') {
    if (normalized.includes('providermigration') || normalized.includes('migration')) {
      return {
        severity: 'OWNER_REVIEW',
        disposition: 'provider_migration_owner_review',
        requiredAction: 'prove migration file is owned by model-router-cost and not a second provider runtime',
      }
    }
    if (normalized.includes('bridge') || normalized.includes('facade')) {
      return {
        severity: 'OWNER_REVIEW',
        disposition: 'entry_facade_owner_review',
        requiredAction: 'prove bridge/facade is an entry projection into DSXU owners, not a standalone runtime',
      }
    }
    if (normalized.includes('legacy') || normalized.includes('compat') || normalized.includes('adapter')) {
      return {
        severity: 'OWNER_REVIEW',
        disposition: 'compat_adapter_owner_review',
        requiredAction: 'merge equivalent behavior into the named owner or keep as replace/delete candidate',
      }
    }
    return {
      severity: 'OWNER_REVIEW',
      disposition: 'runtime_duplication_pressure_review',
      requiredAction: 'prove facade/test-only/owner migration; no second product runtime',
    }
  }
  if (category === 'stub_or_incomplete') {
    const isTodoCollision = /\btodo\b/i.test(excerpt) &&
      !/\/\/\s*todo|\/\*\s*todo|fixme|not implemented|placeholder|stub\b|deferred/i.test(excerpt)
    if (isTodoCollision) {
      return {
        severity: 'INFO_REVIEW',
        disposition: 'todo_word_collision_not_incomplete_claim',
        requiredAction: 'treat as task/todo domain wording unless paired with explicit incomplete marker',
      }
    }
    if (/placeholder/i.test(excerpt) && !/not implemented|fixme|todo|stub\b|deferred/i.test(excerpt)) {
      return {
        severity: 'OWNER_REVIEW',
        disposition: 'placeholder_ui_or_schema_review',
        requiredAction: 'prove placeholder is user-facing UI/schema behavior, not unfinished runtime',
      }
    }
    if (/fixme|not implemented|\/\/\s*todo|\/\*\s*todo/i.test(excerpt)) {
      return {
        severity: 'BLOCKER_REVIEW',
        disposition: 'explicit_incomplete_marker_requires_owner_action',
        requiredAction: 'implement, remove, or mark release-excluded with owner evidence',
      }
    }
    return {
      severity: 'OWNER_REVIEW',
      disposition: lower.includes('stub') || lower.includes('deferred')
        ? 'stub_or_deferred_owner_review'
        : 'incomplete_token_owner_review',
      requiredAction: 'classify as implemented, test-only, release-excluded, or required V24 owner work',
    }
  }
  return {
    severity: 'OWNER_REVIEW',
    disposition: 'owner_review_required',
    requiredAction: 'assign to named owner and attach behavior evidence',
  }
}

function parseRgLine(line: string): { path: string; line: number; excerpt: string } | null {
  const match = /^(.*?):(\d+):(.*)$/.exec(line)
  if (!match) return null
  return {
    path: match[1],
    line: Number(match[2]),
    excerpt: match[3].trim().slice(0, 280),
  }
}

async function buildBaselineReport(): Promise<BaselineReport> {
  const [publishSurfaceFiles, dsxuSourceFiles, claudeSourceFiles, gitStatus, ...v20EvidenceValues] = await Promise.all([
    listPublishSurfaceFiles(),
    listFiles(DSXU_SRC_ROOT),
    listFiles(CLAUDE_SRC_ROOT),
    gitStatusShort(),
    ...Object.values(v20EvidencePaths).map(readJsonIfExists),
  ])
  const v20Evidence: Record<string, unknown> = {}
  Object.keys(v20EvidencePaths).forEach((key, index) => {
    const value = v20EvidenceValues[index]
    v20Evidence[key] = value
      ? {
          status: value.status,
          summaryStatus: value.summaryStatus,
          total: value.total,
          totalRows: value.totalRows,
          ownerDispositionComplete: value.ownerDispositionComplete,
          implementedFeatureAcceptanceComplete: value.implementedFeatureAcceptanceComplete,
          canCreateCleanExport: value.canCreateCleanExport,
          canRunFinalSixStageTests: value.canRunFinalSixStageTests,
          unresolvedCount: value.unresolvedCount,
        }
      : { status: 'MISSING' }
  })
  const v20Final = v20EvidenceValues[0] ?? {}
  const c2FunctionLoss = v20EvidenceValues[4] ?? {}
  const gates: GateRow[] = [
    {
      gate: 'v20-final-preflight',
      status: String(v20Final.status ?? 'MISSING'),
      count: numberFromJson(v20Final.gitStatusShort && typeof v20Final.gitStatusShort === 'object'
        ? (v20Final.gitStatusShort as Record<string, unknown>).total
        : 0),
      requiredNextAction: 'keep as inherited release baseline; V24 cannot claim 95 from this alone',
    },
    {
      gate: 'c2-owner-disposition',
      status: String((v20EvidenceValues[3] ?? {}).status ?? (v20EvidenceValues[3] ? 'PRESENT' : 'MISSING')),
      count: numberFromJson((v20EvidenceValues[3] ?? {}).total) || numberFromJson((v20EvidenceValues[3] ?? {}).totalRows),
      requiredNextAction: 'convert owner disposition into experience-loop-density acceptance',
    },
    {
      gate: 'c2-behavior-acceptance',
      status: c2FunctionLoss.implementedFeatureAcceptanceComplete === true ? 'PASS' : 'OPEN_REQUIRED_FOR_V24',
      count: numberFromJson(c2FunctionLoss.functionLossRiskRows),
      requiredNextAction: 'run C2 density and behavior matrix; do not call C2 fully absorbed yet',
    },
    {
      gate: 'clean-export-artifact',
      status: v20Final.canCreateCleanExport === true ? 'READY_NOT_CREATED' : 'BLOCKED_OR_UNKNOWN',
      count: 1,
      requiredNextAction: 'create export only after V24 evidence and explicit release action',
    },
  ]
  return {
    schemaVersion: 'dsxu.v24.baseline-audit.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(REPO_ROOT),
    claudeSourceRoot: CLAUDE_SRC_ROOT,
    claudeSourceExists: claudeSourceFiles.length > 0,
    sourceCounts: {
      publishSurfaceFiles: publishSurfaceFiles.length,
      dsxuSourceFiles: dsxuSourceFiles.length,
      claudeSourceFiles: claudeSourceFiles.length,
    },
    topDirs: {
      dsxu: topDirs(dsxuSourceFiles, DSXU_SRC_ROOT),
      claude: topDirs(claudeSourceFiles, CLAUDE_SRC_ROOT),
    },
    gitStatusShort: gitStatus,
    v20Evidence,
    v24GateStatus: gates,
    status: 'PASS_BASELINE_FIXED_WITH_OPEN_GATES',
    nextAction: 'run runtime/stub redline and C2 experience density rebaseline before DeepSeek runtime contract work',
    rule: 'Baseline only fixes facts. It does not claim V24 feature acceptance, run final tests, delete files, clean workspace, or create exports.',
  }
}

async function signalFileHits(pattern: string, roots: readonly string[]): Promise<string[]> {
  const hits = new Set<string>()
  for (const root of roots) {
    for (const hit of await rgHitFiles(root, pattern)) hits.add(hit)
  }
  return [...hits].sort()
}

async function contractRows(checks: readonly {
  id: string
  owner: string
  mechanism: string
  files: readonly string[]
  pattern: string
  requiredNextAction: string
}[]): Promise<ContractRow[]> {
  const rows: ContractRow[] = []
  for (const check of checks) {
    const existingFiles = []
    for (const file of check.files) {
      if (await fileExists(join(REPO_ROOT, file))) existingFiles.push(file)
    }
    const hits = await signalFileHits(check.pattern, [DSXU_SRC_ROOT])
    const status: ContractRow['status'] = existingFiles.length === 0 && hits.length === 0
      ? 'GAP_NO_SIGNAL'
      : existingFiles.length === 0 || hits.length < 3
        ? 'OPEN_PRODUCTIZATION_REQUIRED'
        : 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED'
    rows.push({
      id: check.id,
      owner: check.owner,
      mechanism: check.mechanism,
      evidenceFiles: existingFiles.join('; '),
      fileHitCount: existingFiles.length,
      signalHitCount: hits.length,
      status,
      requiredNextAction: check.requiredNextAction,
    })
  }
  return rows
}

async function buildDeepSeekContractRows(): Promise<ContractRow[]> {
  return contractRows([
    {
      id: 'deepseek-thinking-tool-trajectory',
      owner: 'DeepSeek Runtime',
      mechanism: 'thinking + tool-call trajectory pairing',
      files: ['src/services/api/deepseek-adapter.ts'],
      pattern: 'reasoning_content|thinking|tool_calls|tool call|tool_use',
      requiredNextAction: 'prove multi-turn DeepSeek thinking/tool result pair retention with raw trace',
    },
    {
      id: 'deepseek-tool-subset-router',
      owner: 'Tool Gate / Model Router',
      mechanism: 'task-aware tool subset routing before provider request',
      files: ['src/tools.ts', 'src/Tool.ts'],
      pattern: 'tool_choice|tool subset|subset|tool schema|tools',
      requiredNextAction: 'productize a named subset router or prove existing owner path with focused evidence',
    },
    {
      id: 'deepseek-strict-tool-schema',
      owner: 'Tool Schema Gate',
      mechanism: 'strict object schema validation before provider request',
      files: ['src/Tool.ts', 'src/tools/schema-lint.ts'],
      pattern: 'additionalProperties|required|strict|schema|zod|ajv|validate',
      requiredNextAction: 'prove high-risk tools reject loose schemas before model request',
    },
    {
      id: 'deepseek-cache-prefix-planner',
      owner: 'DeepSeek Cache/Cost',
      mechanism: 'stable prefix and cache hit/miss ROI tracking',
      files: ['src/services/cache-stats.ts', 'src/services/api/deepseek-adapter.ts'],
      pattern: 'prompt_cache|cache_hit|cache_miss|prefix|cache',
      requiredNextAction: 'record stable-prefix/tail split and second-run cache ROI',
    },
    {
      id: 'deepseek-fim-edit-lane',
      owner: 'DeepSeek FIM Lane',
      mechanism: 'small edit FIM lane that does not bypass query loop',
      files: ['src/services/api/deepseek-fim.ts'],
      pattern: 'fim|fill-in-middle|prefix|suffix|completion',
      requiredNextAction: 'prove FIM stays small-scope and returns through normal edit verification',
    },
    {
      id: 'deepseek-cost-latency-meter',
      owner: 'Model Router / Cost Evidence',
      mechanism: 'per-turn token, usage, route reason, latency, and cost evidence',
      files: ['src/utils/model/deepseekV4Control.ts', 'src/utils/model/deepseekV4CostRouter.ts'],
      pattern: 'cost|pricing|usage|token|latency|route|flash|pro',
      requiredNextAction: 'emit task-level route/cost/latency report before public product claims',
    },
  ])
}

async function buildWorkStateRows(): Promise<ContractRow[]> {
  return contractRows([
    {
      id: 'workstate-goal-plan-current-step',
      owner: 'UI/TUI Work-State',
      mechanism: 'visible goal, plan, current step, and next action',
      files: ['src/screens/REPL.tsx', 'src/components/PromptInput/PromptInput.tsx', 'src/components/PromptInput/PromptInputFooter.tsx'],
      pattern: 'goal|plan|todo|step|next|status|progress',
      requiredNextAction: 'capture DSXU window or stream-json trace showing state transitions',
    },
    {
      id: 'workstate-tool-permission-visible',
      owner: 'Tool Gate / Permission Gate',
      mechanism: 'visible tool execution and permission request state',
      files: ['src/components/permissions/PermissionRequest.tsx', 'src/tools/BashTool/BashTool.tsx', 'src/tools/PowerShellTool/PowerShellTool.tsx'],
      pattern: 'permission|approve|deny|tool|execute|progress|result',
      requiredNextAction: 'prove permission denial and recovery are visible in TUI/CLI timeline',
    },
    {
      id: 'workstate-failure-recovery-visible',
      owner: 'Recovery',
      mechanism: 'visible failure owner, cause, verified facts, and recovery path',
      files: ['src/utils/conversationRecovery.ts', 'src/utils/errors.ts', 'src/components/REPL.tsx'],
      pattern: 'error|fail|recover|retry|fallback|exception|status',
      requiredNextAction: 'run failure-injection trace and verify no fake PASS',
    },
    {
      id: 'workstate-agent-visible',
      owner: 'Agent Lifecycle',
      mechanism: 'visible worker state and parent synthesis evidence',
      files: ['src/components/AgentProgressLine.tsx', 'src/tools/TaskCreateTool/TaskCreateTool.ts', 'src/tools/TaskOutputTool/TaskOutputTool.tsx'],
      pattern: 'agent|worker|task|progress|synthesis|evidence',
      requiredNextAction: 'run serial/parallel worker replay with parent evidence references',
    },
    {
      id: 'workstate-cost-visible',
      owner: 'Cost Evidence',
      mechanism: 'visible model, token, cache, route, and cost trend',
      files: ['src/commands/cost/cost.ts', 'src/commands/usage/usage.tsx', 'src/services/cache-stats.ts'],
      pattern: 'cost|usage|token|cache|pricing|model|route',
      requiredNextAction: 'show cost/cache/route in CLI/TUI/stream-json task evidence',
    },
    {
      id: 'workstate-stream-json-contract',
      owner: 'CLI/API Bridge',
      mechanism: 'same work-state emitted through CLI/TUI/stream-json',
      files: ['src/cli/structuredIO.ts', 'src/cli/ndjsonSafeStringify.ts', 'src/utils/streamJsonStdoutGuard.ts'],
      pattern: 'stream-json|structured|ndjson|event|timeline|status',
      requiredNextAction: 'run a stream-json task and compare state with TUI evidence',
    },
  ])
}

function buildC2AcceptanceRows(density: DensityReport): AcceptanceRow[] {
  return [
    ...density.primaryLoops.map(row => ({
      id: `P${String(row.id).padStart(2, '0')}`,
      scope: 'primary-loop' as const,
      loop: row.loop,
      owner: row.owner,
      claudeFileHits: row.claudeFileHits,
      dsxuFileHits: row.dsxuFileHits,
      signalStatus: row.status,
      acceptanceStatus: 'OPEN_BEHAVIOR_EVIDENCE_REQUIRED' as const,
      requiredEvidence: row.requiredEvidence,
    })),
    ...density.secondaryLoops.map(row => ({
      id: `S${String(row.id).padStart(2, '0')}`,
      scope: 'secondary-loop' as const,
      loop: row.loop,
      owner: row.owner,
      claudeFileHits: row.claudeFileHits,
      dsxuFileHits: row.dsxuFileHits,
      signalStatus: row.status,
      acceptanceStatus: 'OPEN_BEHAVIOR_EVIDENCE_REQUIRED' as const,
      requiredEvidence: row.requiredEvidence,
    })),
  ]
}

function buildRedlineTriageRows(rows: readonly RedlineRow[]): RedlineTriageRow[] {
  const byOwner = new Map<string, RedlineTriageRow>()
  const dispositionByOwner = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const current = byOwner.get(row.ownerGuess) ?? {
      owner: row.ownerGuess,
      totalRows: 0,
      blockerReviewRows: 0,
      ownerReviewRows: 0,
      releaseCopyReviewRows: 0,
      infoReviewRows: 0,
      topDisposition: '',
      firstAction: '',
    }
    current.totalRows += 1
    if (row.severity === 'BLOCKER_REVIEW') current.blockerReviewRows += 1
    if (row.severity === 'OWNER_REVIEW') current.ownerReviewRows += 1
    if (row.severity === 'RELEASE_COPY_REVIEW') current.releaseCopyReviewRows += 1
    if (row.severity === 'INFO_REVIEW') current.infoReviewRows += 1
    byOwner.set(row.ownerGuess, current)
    const dispositionCounts = dispositionByOwner.get(row.ownerGuess) ?? new Map<string, number>()
    dispositionCounts.set(row.disposition, (dispositionCounts.get(row.disposition) ?? 0) + 1)
    dispositionByOwner.set(row.ownerGuess, dispositionCounts)
  }
  return [...byOwner.values()]
    .map(row => ({
      ...row,
      topDisposition: [...(dispositionByOwner.get(row.owner) ?? new Map<string, number>()).entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key, count]) => `${key}:${count}`)[0] ?? '',
      firstAction: row.blockerReviewRows > 0
        ? 'triage blocker review rows: implemented/test-only/release-excluded/owner-work'
        : row.ownerReviewRows > 0
          ? 'prove runtime/facade/compat paths map to a named owner'
          : row.releaseCopyReviewRows > 0
            ? 'review release copy and third-party brand surface'
            : 'keep as informational evidence',
    }))
    .sort((a, b) => b.blockerReviewRows - a.blockerReviewRows || b.totalRows - a.totalRows || a.owner.localeCompare(b.owner))
}


async function buildRedlineRows(): Promise<RedlineRow[]> {
  const rows: RedlineRow[] = []
  for (const pattern of redlinePatterns) {
    const stdout = await execTextAllowNoMatch('rg', [
      '-n',
      '-i',
      ...SOURCE_GLOBS,
      '--',
      pattern.regex,
      'src',
      'bin',
      'scripts',
    ])
    for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
      const parsed = parseRgLine(line)
      if (!parsed) continue
      const disposition = redlineDisposition(pattern.category, parsed.path, parsed.excerpt)
      rows.push({
        path: parsed.path,
        line: parsed.line,
        category: pattern.category,
        token: pattern.regex,
        severity: disposition.severity,
        disposition: disposition.disposition,
        ownerGuess: ownerGuess(parsed.path),
        requiredAction: disposition.requiredAction,
        excerpt: parsed.excerpt,
      })
    }
  }
  return rows.sort((a, b) => {
    const severityOrder = ['BLOCKER_REVIEW', 'OWNER_REVIEW', 'RELEASE_COPY_REVIEW', 'INFO_REVIEW']
    return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity) ||
      a.path.localeCompare(b.path) ||
      a.line - b.line
  })
}

async function buildDensityReport(): Promise<DensityReport> {
  const [claudeStats, dsxuStats] = await Promise.all([
    signalStats(CLAUDE_SRC_ROOT),
    signalStats(DSXU_SRC_ROOT),
  ])
  const categoryRows = categories.map(category => ({
    category: category.name,
    claudeFileHits: claudeStats.categoryRows.find(row => row.category === category.name)?.fileHits ?? 0,
    dsxuFileHits: dsxuStats.categoryRows.find(row => row.category === category.name)?.fileHits ?? 0,
  }))
  const loopRows: LoopRow[] = []
  for (const loop of primaryLoops) {
    const [claudeHits, dsxuHits] = await Promise.all([
      rgHitFiles(CLAUDE_SRC_ROOT, loop.pattern),
      rgHitFiles(DSXU_SRC_ROOT, loop.pattern),
    ])
    loopRows.push({
      ...loop,
      claudeFileHits: claudeHits.length,
      dsxuFileHits: dsxuHits.length,
      status: loopStatus(claudeHits.length, dsxuHits.length),
    })
  }
  const subRows: SecondaryLoopRow[] = []
  for (let index = 0; index < secondaryLoops.length; index += 1) {
    const [loop, owner, pattern] = secondaryLoops[index]
    const [claudeHits, dsxuHits] = await Promise.all([
      rgHitFiles(CLAUDE_SRC_ROOT, pattern),
      rgHitFiles(DSXU_SRC_ROOT, pattern),
    ])
    subRows.push({
      id: index + 1,
      loop,
      owner,
      pattern,
      claudeFileHits: claudeHits.length,
      dsxuFileHits: dsxuHits.length,
      status: loopStatus(claudeHits.length, dsxuHits.length),
      requiredEvidence: 'real DSXU behavior evidence, not owner-disposition or signal count',
    })
  }
  return {
    schemaVersion: 'dsxu.v24.claude-experience-density-rebaseline.v1',
    generatedAt: new Date().toISOString(),
    claudeSourceRoot: CLAUDE_SRC_ROOT,
    dsxuSourceRoot: DSXU_SRC_ROOT,
    claudeSourceExists: claudeStats.files.length > 0,
    dsxuSourceExists: dsxuStats.files.length > 0,
    sourceCounts: {
      claude: claudeStats.files.length,
      dsxu: dsxuStats.files.length,
    },
    categorySignalSummary: {
      claudeCategoryHits: claudeStats.categoryHits,
      dsxuCategoryHits: dsxuStats.categoryHits,
      claudeMultiSignal4: claudeStats.multiSignal4,
      dsxuMultiSignal4: dsxuStats.multiSignal4,
      claudeMultiSignal6: claudeStats.multiSignal6,
      dsxuMultiSignal6: dsxuStats.multiSignal6,
    },
    categoryRows,
    primaryLoops: loopRows,
    secondaryLoops: subRows,
    status: 'OPEN_BEHAVIOR_ACCEPTANCE_REQUIRED',
    nextAction: 'use these loop rows to generate V24_C2_FEATURE_ACCEPTANCE_MATRIX with real DSXU behavior evidence',
    rule: 'Signal counts prove reference density only. They never prove feature parity, product readiness, or 95 score by themselves.',
  }
}

function summarizeRedline(rows: readonly RedlineRow[]): Record<string, unknown> {
  const bySeverity = new Map<string, number>()
  const byOwner = new Map<string, number>()
  const byCategory = new Map<string, number>()
  const byDisposition = new Map<string, number>()
  for (const row of rows) {
    bySeverity.set(row.severity, (bySeverity.get(row.severity) ?? 0) + 1)
    byOwner.set(row.ownerGuess, (byOwner.get(row.ownerGuess) ?? 0) + 1)
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + 1)
    byDisposition.set(row.disposition, (byDisposition.get(row.disposition) ?? 0) + 1)
  }
  const top = (map: Map<string, number>) => [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }))
  return {
    totalRows: rows.length,
    bySeverity: top(bySeverity),
    byCategory: top(byCategory),
    byDisposition: top(byDisposition),
    byOwner: top(byOwner),
    status: rows.some(row => row.severity === 'BLOCKER_REVIEW') ? 'OPEN_REDLINE_REVIEW_REQUIRED' : 'PASS_NO_BLOCKER_ROWS',
    nextAction: 'triage BLOCKER_REVIEW rows first; prove test-only/release-excluded or assign to named owner before V24 95 claim',
    rule: 'This redline does not delete or rewrite source. Rows are review input, not automatic failure.',
  }
}

function mdSummary(
  baseline: BaselineReport,
  redlineSummary: Record<string, unknown>,
  redlineTriageRows: readonly RedlineTriageRow[],
  density: DensityReport,
  deepseekRows: readonly ContractRow[],
  workStateRows: readonly ContractRow[],
  c2Rows: readonly AcceptanceRow[],
): string {
  const primaryOpen = density.primaryLoops.filter(row => row.status !== 'SIGNAL_PRESENT_NEEDS_BEHAVIOR_EVIDENCE').length
  const secondaryOpen = density.secondaryLoops.filter(row => row.status !== 'SIGNAL_PRESENT_NEEDS_BEHAVIOR_EVIDENCE').length
  const triageTable = redlineTriageRows
    .slice(0, 12)
    .map(row => `| ${row.owner} | ${row.totalRows} | ${row.blockerReviewRows} | ${row.ownerReviewRows} | ${row.releaseCopyReviewRows} | ${row.infoReviewRows} | ${row.topDisposition} |`)
    .join('\n')
  return `# DSXU V24 Execution Batch - ${DATE}

## Scope

This batch executes the first V24 gates in evidence mode:

1. V24 baseline audit.
2. Runtime/stub redline.
3. Claude 1902 experience-density rebaseline.
4. C2 experience acceptance matrix.
5. DeepSeek runtime contract audit.
6. Work-state timeline acceptance audit.

It does not delete files, clean the workspace, run final tests, commit, export, or claim V24 95 score.

## Baseline

| Item | Value |
|---|---:|
| Publish surface files | ${baseline.sourceCounts.publishSurfaceFiles} |
| DSXU source files | ${baseline.sourceCounts.dsxuSourceFiles} |
| Claude source files | ${baseline.sourceCounts.claudeSourceFiles} |
| git status --short | ${baseline.gitStatusShort.total} |
| staged paths | ${baseline.gitStatusShort.staged} |
| unstaged paths | ${baseline.gitStatusShort.unstaged} |
| untracked paths | ${baseline.gitStatusShort.untracked} |

## Runtime / Stub Redline

| Item | Value |
|---|---:|
| Redline rows | ${redlineSummary.totalRows} |
| Status | ${redlineSummary.status} |

The redline is review evidence, not automatic deletion. Any duplicate runtime or old compatibility path must be merged into the original owner or remain a replace/delete candidate.

### Redline Owner Packets

| Owner | Total | Blocker | Owner Review | Release Copy | Info | Top Disposition |
|---|---:|---:|---:|---:|---:|---|
${triageTable}

## C2 Experience Density

| Item | Claude | DSXU |
|---|---:|---:|
| Source files | ${density.sourceCounts.claude} | ${density.sourceCounts.dsxu} |
| 12-category signal hits | ${density.categorySignalSummary.claudeCategoryHits} | ${density.categorySignalSummary.dsxuCategoryHits} |
| >=4 signal files | ${density.categorySignalSummary.claudeMultiSignal4} | ${density.categorySignalSummary.dsxuMultiSignal4} |
| >=6 signal files | ${density.categorySignalSummary.claudeMultiSignal6} | ${density.categorySignalSummary.dsxuMultiSignal6} |
| Primary loops needing compressed/no-signal review | ${primaryOpen} | ${primaryOpen} |
| Secondary loops needing compressed/no-signal review | ${secondaryOpen} | ${secondaryOpen} |

Conclusion: DSXU has dense Claude-like signals, but V24 acceptance still requires real behavior evidence for each loop. Signal counts do not equal feature parity.

## Contract Matrices

| Matrix | Rows | Status |
|---|---:|---|
| C2 experience acceptance | ${c2Rows.length} | OPEN_BEHAVIOR_EVIDENCE_REQUIRED |
| DeepSeek runtime contract | ${deepseekRows.length} | ${deepseekRows.some(row => row.status !== 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED') ? 'OPEN_PRODUCTIZATION_REQUIRED' : 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED'} |
| Work-state timeline acceptance | ${workStateRows.length} | ${workStateRows.some(row => row.status !== 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED') ? 'OPEN_PRODUCTIZATION_REQUIRED' : 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED'} |

## Outputs

- \`${OUTPUTS.baselineJson}\`
- \`${OUTPUTS.baselineCsv}\`
- \`${OUTPUTS.redlineJson}\`
- \`${OUTPUTS.redlineCsv}\`
- \`${OUTPUTS.densityJson}\`
- \`${OUTPUTS.densityCsv}\`
- \`${OUTPUTS.subLoopCsv}\`
- \`${OUTPUTS.c2AcceptanceJson}\`
- \`${OUTPUTS.c2AcceptanceCsv}\`
- \`${OUTPUTS.deepseekJson}\`
- \`${OUTPUTS.deepseekCsv}\`
- \`${OUTPUTS.workStateJson}\`
- \`${OUTPUTS.workStateCsv}\`
- \`${OUTPUTS.redlineTriageJson}\`
- \`${OUTPUTS.redlineTriageCsv}\`
- \`${OUTPUTS.batchJson}\`
`
}

async function main(): Promise<void> {
  const baseline = await buildBaselineReport()
  const redlineRows = await buildRedlineRows()
  const redlineSummary = summarizeRedline(redlineRows)
  const redlineTriageRows = buildRedlineTriageRows(redlineRows)
  const redlineReport = {
    schemaVersion: 'dsxu.v24.runtime-stub-redline.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(REPO_ROOT),
    scannedRoots: ['src', 'bin', 'scripts'],
    summary: redlineSummary,
    rows: redlineRows,
  }
  const density = await buildDensityReport()
  const c2AcceptanceRows = buildC2AcceptanceRows(density)
  const deepseekRows = await buildDeepSeekContractRows()
  const workStateRows = await buildWorkStateRows()
  const c2AcceptanceReport = {
    schemaVersion: 'dsxu.v24.c2-feature-acceptance-matrix.v1',
    generatedAt: new Date().toISOString(),
    status: 'OPEN_BEHAVIOR_EVIDENCE_REQUIRED',
    rowCount: c2AcceptanceRows.length,
    rows: c2AcceptanceRows,
    rule: 'Rows are not accepted until real DSXU behavior evidence exists. Owner-disposition and signal counts are insufficient.',
  }
  const deepseekReport = {
    schemaVersion: 'dsxu.v24.deepseek-runtime-contract.v1',
    generatedAt: new Date().toISOString(),
    status: deepseekRows.some(row => row.status !== 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED')
      ? 'OPEN_PRODUCTIZATION_REQUIRED'
      : 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED',
    rows: deepseekRows,
    rule: 'This audit proves source signals only. Live provider/tool/cache/FIM behavior must be tested before public claims.',
  }
  const workStateReport = {
    schemaVersion: 'dsxu.v24.work-state-timeline-acceptance.v1',
    generatedAt: new Date().toISOString(),
    status: workStateRows.some(row => row.status !== 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED')
      ? 'OPEN_PRODUCTIZATION_REQUIRED'
      : 'SIGNAL_PRESENT_BEHAVIOR_EVIDENCE_REQUIRED',
    rows: workStateRows,
    rule: 'This audit proves UI/TUI/CLI state signals only. Window or stream-json experience evidence is still required.',
  }
  const batch = {
    schemaVersion: 'dsxu.v24.execution-batch.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(REPO_ROOT),
    executedGates: [
      'V24_BASELINE_AUDIT',
      'V24_RUNTIME_STUB_REDLINE',
      'V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE',
      'V24_C2_FEATURE_ACCEPTANCE_MATRIX',
      'V24_DEEPSEEK_RUNTIME_CONTRACT',
      'V24_WORK_STATE_TIMELINE_ACCEPTANCE',
    ],
    didDeleteFiles: false,
    didCleanWorkspace: false,
    didRunFinalTests: false,
    didCreateExport: false,
    status: 'PASS_EVIDENCE_GENERATED_OPEN_BEHAVIOR_GATES',
    baseline: {
      outputJson: OUTPUTS.baselineJson,
      outputCsv: OUTPUTS.baselineCsv,
      gitStatusShort: baseline.gitStatusShort,
      sourceCounts: baseline.sourceCounts,
    },
    redline: {
      outputJson: OUTPUTS.redlineJson,
      outputCsv: OUTPUTS.redlineCsv,
      summary: redlineSummary,
    },
    c2ExperienceDensity: {
      outputJson: OUTPUTS.densityJson,
      outputCsv: OUTPUTS.densityCsv,
      secondaryLoopCsv: OUTPUTS.subLoopCsv,
      sourceCounts: density.sourceCounts,
      categorySignalSummary: density.categorySignalSummary,
      primaryLoopRows: density.primaryLoops.length,
      secondaryLoopRows: density.secondaryLoops.length,
    },
    c2AcceptanceMatrix: {
      outputJson: OUTPUTS.c2AcceptanceJson,
      outputCsv: OUTPUTS.c2AcceptanceCsv,
      rowCount: c2AcceptanceRows.length,
      status: c2AcceptanceReport.status,
    },
    deepseekRuntimeContract: {
      outputJson: OUTPUTS.deepseekJson,
      outputCsv: OUTPUTS.deepseekCsv,
      rowCount: deepseekRows.length,
      status: deepseekReport.status,
    },
    workStateTimelineAcceptance: {
      outputJson: OUTPUTS.workStateJson,
      outputCsv: OUTPUTS.workStateCsv,
      rowCount: workStateRows.length,
      status: workStateReport.status,
    },
    redlineOwnerPacketTriage: {
      outputJson: OUTPUTS.redlineTriageJson,
      outputCsv: OUTPUTS.redlineTriageCsv,
      rowCount: redlineTriageRows.length,
    },
    nextAction: 'triage runtime/stub redline owner packets and attach real behavior evidence to C2, DeepSeek, and work-state matrices before final tests or public claims.',
    rule: 'This is a V24 execution batch, not a PASS claim for 95 score.',
  }
  await Promise.all([
    writeJson(OUTPUTS.baselineJson, baseline),
    writeText(
      OUTPUTS.baselineCsv,
      toCsv(
        baseline.v24GateStatus.map(row => ({ ...row })),
        ['gate', 'status', 'count', 'requiredNextAction'],
      ),
    ),
    writeJson(OUTPUTS.redlineJson, redlineReport),
    writeText(
      OUTPUTS.redlineCsv,
      toCsv(redlineRows, ['path', 'line', 'category', 'severity', 'disposition', 'ownerGuess', 'requiredAction', 'excerpt']),
    ),
    writeJson(OUTPUTS.densityJson, density),
    writeText(
      OUTPUTS.densityCsv,
      toCsv(density.primaryLoops.map(row => ({ ...row })), [
        'id',
        'loop',
        'owner',
        'claudeFileHits',
        'dsxuFileHits',
        'status',
        'requiredEvidence',
      ]),
    ),
    writeText(
      OUTPUTS.subLoopCsv,
      toCsv(density.secondaryLoops.map(row => ({ ...row })), [
        'id',
        'loop',
        'owner',
        'claudeFileHits',
        'dsxuFileHits',
        'status',
        'requiredEvidence',
      ]),
    ),
    writeJson(OUTPUTS.c2AcceptanceJson, c2AcceptanceReport),
    writeText(
      OUTPUTS.c2AcceptanceCsv,
      toCsv(c2AcceptanceRows, [
        'id',
        'scope',
        'loop',
        'owner',
        'claudeFileHits',
        'dsxuFileHits',
        'signalStatus',
        'acceptanceStatus',
        'requiredEvidence',
      ]),
    ),
    writeJson(OUTPUTS.redlineTriageJson, {
      schemaVersion: 'dsxu.v24.redline-owner-packet-triage.v1',
      generatedAt: new Date().toISOString(),
      status: 'OPEN_OWNER_TRIAGE_REQUIRED',
      rowCount: redlineTriageRows.length,
      rows: redlineTriageRows,
    }),
    writeText(
      OUTPUTS.redlineTriageCsv,
      toCsv(redlineTriageRows, [
        'owner',
        'totalRows',
        'blockerReviewRows',
        'ownerReviewRows',
        'releaseCopyReviewRows',
        'infoReviewRows',
        'topDisposition',
        'firstAction',
      ]),
    ),
    writeJson(OUTPUTS.deepseekJson, deepseekReport),
    writeText(
      OUTPUTS.deepseekCsv,
      toCsv(deepseekRows, [
        'id',
        'owner',
        'mechanism',
        'evidenceFiles',
        'fileHitCount',
        'signalHitCount',
        'status',
        'requiredNextAction',
      ]),
    ),
    writeJson(OUTPUTS.workStateJson, workStateReport),
    writeText(
      OUTPUTS.workStateCsv,
      toCsv(workStateRows, [
        'id',
        'owner',
        'mechanism',
        'evidenceFiles',
        'fileHitCount',
        'signalHitCount',
        'status',
        'requiredNextAction',
      ]),
    ),
    writeJson(OUTPUTS.batchJson, batch),
    writeText(OUTPUTS.batchMd, mdSummary(baseline, redlineSummary, redlineTriageRows, density, deepseekRows, workStateRows, c2AcceptanceRows)),
  ])
  console.log(JSON.stringify({
    status: batch.status,
    executedGates: batch.executedGates,
    gitStatusShort: baseline.gitStatusShort.total,
    redlineRows: redlineRows.length,
    primaryLoopRows: density.primaryLoops.length,
    secondaryLoopRows: density.secondaryLoops.length,
    c2AcceptanceRows: c2AcceptanceRows.length,
    deepseekRows: deepseekRows.length,
    workStateRows: workStateRows.length,
    outputs: OUTPUTS,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
