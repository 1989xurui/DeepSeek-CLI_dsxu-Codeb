import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

type FamilyId =
  | 'goal-plan-query-loop'
  | 'visible-work-state'
  | 'tool-permission-lifecycle'
  | 'source-truth-repair'
  | 'terminal-shell-reliability'
  | 'context-memory-recovery'
  | 'agent-orchestration'
  | 'mcp-skill-ecosystem'
  | 'model-cost-cache'
  | 'ide-remote-bridge'
  | 'first-run-trust'
  | 'telemetry-evidence-release'

type Family = {
  id: FamilyId
  label: string
  referenceSignals: readonly string[]
  dsxuOwner: string
  dsxuFiles: readonly string[]
  dsxuTests: readonly string[]
  liveEvidence: readonly string[]
  productDecision: 'implemented+tested' | 'needs stronger live evidence' | 'adapted/excluded'
}

type ReferenceFile = {
  path: string
  ext: string
  bytes: number
  families: FamilyId[]
}

const ROOT = process.cwd()
const DATE = '20260516'
const REFERENCE_ROOT = resolve(process.env.DSXU_REFERENCE_SRC_ROOT ?? join(ROOT, '..', 'reference-product-src', 'src'))
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V26_REFERENCE_EXPERIENCE_REVERSE_ANALYSIS_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_V26_REFERENCE_EXPERIENCE_REVERSE_ANALYSIS_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V26_REFERENCE_EXPERIENCE_REVERSE_ANALYSIS_${DATE}.md`)

const FAMILIES: readonly Family[] = [
  {
    id: 'goal-plan-query-loop',
    label: 'Goal / Plan / Query Loop',
    referenceSignals: ['query', 'plan', 'todo', 'prompt', 'repl', 'task'],
    dsxuOwner: 'DSXU Query Loop / Entry Composition',
    dsxuFiles: [
      'src/dsxu/engine/query-loop.ts',
      'src/dsxu/engine/query-loop-gate-state-v1.ts',
      'src/tools/TodoWriteTool/TodoWriteTool.ts',
      'src/tools/EnterPlanModeTool/EnterPlanModeTool.ts',
      'src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-run-query-v1.test.ts',
      'src/dsxu/engine/__tests__/product-runtime-owner-map-v1.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json'],
    productDecision: 'implemented+tested',
  },
  {
    id: 'visible-work-state',
    label: 'Senior Visible Work-State',
    referenceSignals: ['component', 'message', 'spinner', 'status', 'progress', 'ink', 'screen'],
    dsxuOwner: 'UI/TUI Visible Work-State Projection',
    dsxuFiles: [
      'src/dsxu/engine/work-state-timeline.ts',
      'src/components/Message.tsx',
      'src/components/messages/AssistantToolUseMessage.tsx',
      'src/components/permissions/PermissionRequest.tsx',
      'src/components/AgentProgressLine.tsx',
      'src/commands/cost/cost.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/work-state-timeline.test.ts',
      'src/dsxu/engine/__tests__/query-loop-visible-copy-v1.test.ts',
      'src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
      'src/dsxu/engine/__tests__/tui-permission-fallback-health-v1.test.ts',
    ],
    liveEvidence: [
      'docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json',
      'docs/generated/DSXU_V24_SENIOR_CODING_WINDOW_20260515.json',
    ],
    productDecision: 'implemented+tested',
  },
  {
    id: 'tool-permission-lifecycle',
    label: 'Tool / Permission Lifecycle',
    referenceSignals: ['tool', 'permission', 'bash', 'filesystem', 'approval', 'sandbox'],
    dsxuOwner: 'Tool Gate / Permission Gate',
    dsxuFiles: [
      'src/dsxu/engine/tool-gate-v1.ts',
      'src/dsxu/engine/tool-mainline-runtime-v1.ts',
      'src/dsxu/engine/permissions.ts',
      'src/tools/BashTool/BashTool.tsx',
      'src/tools/PowerShellTool/PowerShellTool.tsx',
      'src/dsxu/control-plane/permissionControlBridge.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/tool-gate-v1-clean.test.ts',
      'src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/permissions.test.ts',
      'src/tools/__tests__/tool-permission-owner-gate.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json'],
    productDecision: 'implemented+tested',
  },
  {
    id: 'source-truth-repair',
    label: 'Source Truth Repair Loop',
    referenceSignals: ['file', 'edit', 'diff', 'grep', 'glob', 'lsp', 'git', 'diagnostic'],
    dsxuOwner: 'Source Truth / Coding Repair',
    dsxuFiles: [
      'src/dsxu/engine/code-mode-surgical-loop.ts',
      'src/tools/FileReadTool/FileReadTool.ts',
      'src/tools/FileEditTool/FileEditTool.ts',
      'src/tools/GrepTool/GrepTool.ts',
      'src/tools/LSPTool/LSPTool.ts',
      'src/dsxu/engine/lsp-tool.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/code-mode-surgical-loop-v1.test.ts',
      'src/dsxu/engine/__tests__/file-edit-surgical-loop.test.ts',
      'src/dsxu/engine/__tests__/phase12-senior-programmer-experience-v1.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json'],
    productDecision: 'implemented+tested',
  },
  {
    id: 'terminal-shell-reliability',
    label: 'Terminal / Shell Reliability',
    referenceSignals: ['terminal', 'shell', 'bash', 'powershell', 'pty', 'termio', 'ansi'],
    dsxuOwner: 'Terminal Tool Adapter / Result Pack',
    dsxuFiles: [
      'src/tools/BashTool/BashTool.tsx',
      'src/tools/PowerShellTool/PowerShellTool.tsx',
      'src/tools/RunNativeTestTool/RunNativeTestTool.ts',
      'src/dsxu/engine/provider-service-shell-policy.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/subprocess-encoding-boundary-v1.test.ts',
      'src/dsxu/engine/__tests__/tui-terminal-reliability-pack-v1.test.ts',
      'src/tools/RunNativeTestTool/RunNativeTestTool.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json'],
    productDecision: 'needs stronger live evidence',
  },
  {
    id: 'context-memory-recovery',
    label: 'Context / Memory / Recovery',
    referenceSignals: ['context', 'memory', 'compact', 'resume', 'history', 'session', 'recover'],
    dsxuOwner: 'Context Builder / Recovery Mainline',
    dsxuFiles: [
      'src/dsxu/engine/context-builder.ts',
      'src/dsxu/engine/context-discipline-control.ts',
      'src/dsxu/engine/experience-store.ts',
      'src/dsxu/engine/recovery/index.ts',
      'src/dsxu/engine/memory-context-compact/index.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/context-hygiene-v1.test.ts',
      'src/dsxu/engine/__tests__/experience-store-smooth-resume-pack-v1.test.ts',
      'src/dsxu/engine/__tests__/query-engine-recovery-mainline-v1.test.ts',
      'src/dsxu/engine/__tests__/recovery-mainline-v3.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_SENIOR_CODING_WINDOW_20260515.json'],
    productDecision: 'implemented+tested',
  },
  {
    id: 'agent-orchestration',
    label: 'Agent Orchestration / Parent Evidence',
    referenceSignals: ['agent', 'teammate', 'task', 'worker', 'swarm', 'coordinator'],
    dsxuOwner: 'Agent Lifecycle',
    dsxuFiles: [
      'src/tools/AgentTool/AgentTool.tsx',
      'src/tools/AgentTool/runAgent.ts',
      'src/dsxu/engine/agent-role-router-v1.ts',
      'src/dsxu/engine/subagent-protocol.ts',
      'src/components/AgentProgressLine.tsx',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts',
      'src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts',
      'src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json'],
    productDecision: 'implemented+tested',
  },
  {
    id: 'mcp-skill-ecosystem',
    label: 'MCP / Skill Ecosystem',
    referenceSignals: ['mcp', 'plugin', 'skill', 'marketplace', 'resource', 'server'],
    dsxuOwner: 'MCP / Skill Registry',
    dsxuFiles: [
      'src/services/mcp/client.ts',
      'src/services/mcp/doctor.ts',
      'src/tools/MCPTool/MCPTool.ts',
      'src/tools/SkillTool/SkillTool.ts',
      'src/dsxu/engine/skills-registry-v1.ts',
      'src/dsxu/engine/skill-governance-v1.ts',
    ],
    dsxuTests: [
      'src/services/mcp/__tests__/doctor.test.ts',
      'src/dsxu/engine/__tests__/skills-integration.test.ts',
      'src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/real-mcp-server.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json'],
    productDecision: 'implemented+tested',
  },
  {
    id: 'model-cost-cache',
    label: 'DeepSeek Model / Cost / Cache',
    referenceSignals: ['model', 'cost', 'token', 'cache', 'usage', 'rate', 'api'],
    dsxuOwner: 'DeepSeek Runtime / Cost Evidence',
    dsxuFiles: [
      'src/utils/model/deepseekV4Control.ts',
      'src/utils/model/deepseekV4CostRouter.ts',
      'src/services/api/deepseek-adapter.ts',
      'src/services/api/deepseek-trajectory-store.ts',
      'src/dsxu/engine/prompt-prefix-cache-evidence.ts',
      'src/commands/cost/cost.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts',
      'src/services/api/deepseek-adapter-cache-prefix-v1.test.ts',
      'src/services/api/deepseek-trajectory-store.test.ts',
      'src/dsxu/engine/__tests__/cost-cache-live-task-evidence.test.ts',
    ],
    liveEvidence: [
      'docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json',
      'docs/generated/DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json',
    ],
    productDecision: 'implemented+tested',
  },
  {
    id: 'ide-remote-bridge',
    label: 'IDE / Remote / External Host Boundary',
    referenceSignals: ['ide', 'remote', 'bridge', 'chrome', 'desktop', 'teleport', 'direct'],
    dsxuOwner: 'External Host Adapter Boundary',
    dsxuFiles: [
      'src/commands/ide/ide.tsx',
      'src/commands/desktop/desktop.tsx',
      'src/tools/RemoteTriggerTool/RemoteTriggerTool.ts',
      'src/dsxu/engine/adapters/external-tool-adapter.ts',
      'src/dsxu/engine/mainline-tool-adapter.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/external-integration-owner.test.ts',
      'src/dsxu/engine/__tests__/extension-runtime-owner.test.ts',
      'src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json'],
    productDecision: 'needs stronger live evidence',
  },
  {
    id: 'first-run-trust',
    label: 'First-Run Trust / Doctor',
    referenceSignals: ['onboarding', 'doctor', 'auth', 'login', 'key', 'settings', 'trust'],
    dsxuOwner: 'Install / Auth / Doctor',
    dsxuFiles: [
      'src/components/Onboarding.tsx',
      'src/commands/doctor/doctor.tsx',
      'src/cli/handlers/auth.ts',
      'src/commands/login/login.tsx',
      'src/commands/logout/logout.tsx',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/live-provider-gate-v1.test.ts',
      'src/dsxu/engine/__tests__/dsxu-key-wizard-v1.test.ts',
      'src/dsxu/engine/__tests__/toolchain-selfcheck-v1.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json'],
    productDecision: 'implemented+tested',
  },
  {
    id: 'telemetry-evidence-release',
    label: 'Telemetry / Evidence / Release Gate',
    referenceSignals: ['telemetry', 'diagnostic', 'stats', 'feedback', 'export', 'release', 'log'],
    dsxuOwner: 'Evidence / Release',
    dsxuFiles: [
      'src/dsxu/engine/final-report-usage-evidence.ts',
      'src/dsxu/engine/benchmark-readiness.ts',
      'src/dsxu/engine/open-source-package-gate.ts',
      'src/dsxu/engine/proprietary-code-risk-gate.ts',
      'scripts/dsxu-v24-github-open-source-launch-pack.ts',
    ],
    dsxuTests: [
      'src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts',
      'src/dsxu/engine/__tests__/benchmark-readiness.test.ts',
      'src/dsxu/engine/__tests__/release-public-surface-gate-v1.test.ts',
    ],
    liveEvidence: ['docs/generated/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.json'],
    productDecision: 'implemented+tested',
  },
]

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const result: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...await listFiles(full))
    } else if (/\.(ts|tsx|js|jsx|json|md|css|mjs|cjs)$/.test(entry.name)) {
      result.push(full)
    }
  }
  return result
}

function familiesForPath(path: string): FamilyId[] {
  const lower = path.toLowerCase()
  const matches = FAMILIES
    .filter(family => family.referenceSignals.some(signal => lower.includes(signal)))
    .map(family => family.id)
  if (matches.length > 0) return [...new Set(matches)]
  if (lower.includes('/components/') || lower.includes('/hooks/')) return ['visible-work-state']
  if (lower.includes('/utils/')) return ['source-truth-repair']
  return ['goal-plan-query-loop']
}

async function buildReferenceFiles(): Promise<ReferenceFile[]> {
  const files = await listFiles(REFERENCE_ROOT)
  const rows: ReferenceFile[] = []
  for (const file of files) {
    const fileStat = await stat(file)
    const rel = normalizePath(relative(REFERENCE_ROOT, file))
    rows.push({
      path: rel,
      ext: rel.includes('.') ? rel.slice(rel.lastIndexOf('.') + 1).toLowerCase() : '',
      bytes: fileStat.size,
      families: familiesForPath(rel),
    })
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path))
}

function existsFromRoot(path: string): boolean {
  return existsSync(join(ROOT, path))
}

function countBy<T extends string>(values: readonly T[]): Record<T, number> {
  const counts = {} as Record<T, number>
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function mdTable(rows: Record<string, unknown>[], columns: string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => String(row[column] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n')
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]!)
  return [
    headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
  ].join('\n') + '\n'
}

async function readJsonIfExists(path: string): Promise<Record<string, any> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, any>
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const referenceFiles = await buildReferenceFiles()
  const actualReferenceSourceFiles = referenceFiles.length
  const familyRows = FAMILIES.map(family => {
    const files = referenceFiles.filter(file => file.families.includes(family.id))
    const foundFiles = family.dsxuFiles.filter(existsFromRoot)
    const foundTests = family.dsxuTests.filter(existsFromRoot)
    const foundEvidence = family.liveEvidence.filter(existsFromRoot)
    const implementationEvidenceReady =
      foundFiles.length === family.dsxuFiles.length &&
      foundTests.length > 0 &&
      foundEvidence.length > 0
    const decision =
      family.productDecision === 'implemented+tested' && implementationEvidenceReady
        ? 'implemented+tested'
        : family.productDecision
    return {
      family: family.id,
      label: family.label,
      referenceFiles: files.length,
      topReferenceExamples: files.slice(0, 8).map(file => file.path).join('; '),
      dsxuOwner: family.dsxuOwner,
      dsxuFilesFound: `${foundFiles.length}/${family.dsxuFiles.length}`,
      testsFound: `${foundTests.length}/${family.dsxuTests.length}`,
      liveEvidenceFound: `${foundEvidence.length}/${family.liveEvidence.length}`,
      implementationDecision: decision,
      githubClaim: decision === 'implemented+tested'
        ? 'claim DSXU-owned mechanism with evidence, not reference parity'
        : 'roadmap or internal evidence only; do not claim public parity',
    }
  })

  const c2OwnerAcceptance = await readJsonIfExists(join(GENERATED_DIR, 'DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json'))
  const publicChallenge = await readJsonIfExists(join(GENERATED_DIR, 'DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json'))
  const extensionRows = referenceFiles.flatMap(file =>
    file.families.map(family => ({
      referencePath: file.path,
      ext: file.ext,
      bytes: file.bytes,
      family,
    })),
  )
  const byTopDirectory = Object.entries(countBy(referenceFiles.map(file => file.path.split('/')[0] ?? '<root>')))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([directory, files]) => ({ directory, files }))

  const output = {
    schemaVersion: 'dsxu.v26.reference-experience-reverse-analysis.v1',
    generatedAt: new Date().toISOString(),
    status: actualReferenceSourceFiles === 1902
      ? 'PASS_REFERENCE_1902_REVERSE_ANALYSIS_GENERATED'
      : 'PARTIAL_REFERENCE_SOURCE_COUNT_MISMATCH',
    reference: {
      sourceRoot: REFERENCE_ROOT,
      actualReferenceSourceFiles,
      rule: 'Mechanism analysis only. Do not copy source code, prompt text, brand language, or product-specific commercial behavior.',
    },
    c2OwnerAcceptance: {
      status: c2OwnerAcceptance?.status,
      rows: c2OwnerAcceptance?.totals?.rows,
      implementedTestedRows: c2OwnerAcceptance?.totals?.implementedTestedRows,
      adaptedExcludedRows: c2OwnerAcceptance?.totals?.adaptedExcludedRows,
      noLossBaselineRows: c2OwnerAcceptance?.totals?.noLossBaselineRows,
      needsRealCodeTestRows: c2OwnerAcceptance?.totals?.needsRealCodeTestRows,
      public95ClaimAllowed: c2OwnerAcceptance?.gates?.public95ClaimAllowed,
    },
    publicChallenge: {
      status: publicChallenge?.status,
      scoreFloor: publicChallenge?.scoreFloor,
      totalFlashCostUSD: publicChallenge?.totalFlashCostUSD,
      proWasRun: publicChallenge?.proWasRun,
    },
    byTopDirectory,
    familyRows,
    files: extensionRows,
    nextProductActions: [
      'Keep work-state timeline as DSXU-owned projection contract; wire new live/TUI evidence to this contract before public 95 claims.',
      'Promote terminal/shell reliability and IDE/remote bridge from partial live evidence to product benchmark rows.',
      'Keep Pro admission evidence-bound; default public demos should remain Flash-first unless failed verification or high-risk gates require Pro.',
      'Do not claim reference product parity; publish DSXU-owned mechanism evidence and raw benchmark data only.',
    ],
  }

  await mkdir(GENERATED_DIR, { recursive: true })
  await writeFile(OUT_JSON, JSON.stringify(output, null, 2), 'utf8')
  await writeFile(OUT_CSV, toCsv(familyRows), 'utf8')

  const markdown = [
    '# DSXU V26 Reference Experience Reverse Analysis - 2026-05-16',
    '',
    '目标：从本地 1902 个参考源码文件反推“高级程序员体验闭环密度”，只吸收通用机制，不复制源码、prompt、品牌文案或商业专属实现。',
    '',
    `Status: ${output.status}`,
    `Reference source files: ${actualReferenceSourceFiles}`,
    '',
    '## 1. 安全边界',
    '',
    '- 允许：抽象机制，例如可见工作状态、工具/权限生命周期、source truth 修复、上下文恢复、Agent 父子证据、MCP/Skill registry、成本/缓存证据。',
    '- 禁止：复制参考源码、UI 文案、prompt 文案、品牌词、订阅/商业专属逻辑、第二套 runtime。',
    '- GitHub 只能声明 DSXU 自有实现与证据，不能声明参考产品 parity。',
    '',
    '## 2. 目录信号',
    '',
    mdTable(byTopDirectory, ['directory', 'files']),
    '',
    '## 3. 能力闭环映射',
    '',
    mdTable(familyRows, [
      'family',
      'label',
      'referenceFiles',
      'dsxuOwner',
      'dsxuFilesFound',
      'testsFound',
      'liveEvidenceFound',
      'implementationDecision',
      'githubClaim',
    ]),
    '',
    '## 4. C2/V26 证据对齐',
    '',
    mdTable([
      { metric: 'C2 owner acceptance status', value: output.c2OwnerAcceptance.status ?? 'missing' },
      { metric: 'C2 rows', value: output.c2OwnerAcceptance.rows ?? 'missing' },
      { metric: 'implemented+tested', value: output.c2OwnerAcceptance.implementedTestedRows ?? 'missing' },
      { metric: 'adapted/excluded', value: output.c2OwnerAcceptance.adaptedExcludedRows ?? 'missing' },
      { metric: 'no-loss baseline', value: output.c2OwnerAcceptance.noLossBaselineRows ?? 'missing' },
      { metric: 'needs real code/test', value: output.c2OwnerAcceptance.needsRealCodeTestRows ?? 'missing' },
      { metric: 'public challenge score floor', value: output.publicChallenge.scoreFloor ?? 'missing' },
      { metric: 'public 95 claim allowed', value: output.c2OwnerAcceptance.public95ClaimAllowed ?? false },
    ], ['metric', 'value']),
    '',
    '## 5. 本轮落地',
    '',
    '- 新增 DSXU 原创 `src/dsxu/engine/work-state-timeline.ts`：把目标、计划、source truth、工具、权限、失败、恢复、成本、证据和 next action 组成一个可测试的 visible-state projection contract。',
    '- 新增 `src/dsxu/engine/__tests__/work-state-timeline.test.ts`：验证完整 senior coding loop 能 PASS，假完成/权限不可见/失败无恢复会被 guards 阻断，且该文件不拥有第二套 tool/query/provider runtime。',
    '',
    '## 6. 下一步',
    '',
    ...output.nextProductActions.map(action => `- ${action}`),
    '',
  ].join('\n')
  await writeFile(OUT_MD, markdown, 'utf8')

  console.log(JSON.stringify({
    status: output.status,
    referenceFiles: actualReferenceSourceFiles,
    markdown: OUT_MD,
    json: OUT_JSON,
    csv: OUT_CSV,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
