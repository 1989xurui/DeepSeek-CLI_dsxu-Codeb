import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type Priority = 'P0' | 'P1' | 'P2'

type BacklogRow = {
  id: string
  priority: Priority
  mechanismArea: string
  mechanismClass: string
  role: string
  phase: string
  title: string
  dsxuOwner: string
  value: string
  deepseekAdaptation: string
  implementationBoundary: string
  acceptanceEvidence: string
}

type CapabilityRow = {
  id: string
  capability: string
  dsxuFitTier: string
  acceptanceDecision: string
  dsxuOwner: string
  nextAction: string
}

type LocalScenarioRow = {
  source: 'v26-9.19.5'
  priority: Priority
  title: string
  value: string
  boundary: string
}

type ExecutionPacket = {
  id: string
  label: string
  owners: string[]
  keywords: string[]
  areaHints: string[]
  representativeFiles: string[]
  representativeTests: string[]
  nextAction: string
  acceptance: string
}

type PacketReport = ExecutionPacket & {
  rowsFrom174: number
  rowsFrom1000: number
  p0Rows: number
  p1Rows: number
  p2Rows: number
  capabilityGaps: string[]
  filesExisting: string[]
  filesMissing: string[]
  testsExisting: string[]
  testsMissing: string[]
  status: 'accepted-core' | 'ready-for-execution' | 'needs-live-evidence' | 'needs-owner-review'
}

const ROOT = process.cwd()
const DATE = '20260516'
const DOC = join(ROOT, 'docs', 'DSXU_V26_MASTER_PLAN_20260515.md')
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const BACKLOG_JSON = join(GENERATED_DIR, `DSXU_REFERENCE_SCENARIO_BACKLOG_${DATE}.json`)
const CAPABILITY_JSON = join(GENERATED_DIR, `DSXU_CAPABILITY_ACCEPTANCE_AUDIT_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_REFERENCE_SCENARIO_CONVERGENCE_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_REFERENCE_SCENARIO_CONVERGENCE_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_REFERENCE_SCENARIO_CONVERGENCE_${DATE}.md`)

const PACKETS: readonly ExecutionPacket[] = [
  {
    id: 'EP-01',
    label: 'Source Truth + Cache',
    owners: ['Code-mode source truth owner', 'ContextCompiler / TokenFirewall owner', 'DeepSeek route / cost owner'],
    keywords: ['source', 'capsule', 'read', 'cache', 'context', 'token', 'freshness', 'impact', 'blast', 'code mode'],
    areaHints: ['Source Truth / Capsule', 'Context / Cache Hygiene', 'Impact / Blast Radius'],
    representativeFiles: [
      'src/dsxu/engine/context-builder.ts',
      'src/dsxu/engine/code-mode-surgical-loop.ts',
      'src/dsxu/engine/prompt-prefix-cache-builder.ts',
      'src/dsxu/engine/route-cache-dynamic-tail.ts',
      'src/tools/FileReadTool/FileReadTool.ts',
    ],
    representativeTests: [
      'src/dsxu/engine/__tests__/context-hygiene-v1.test.ts',
      'src/dsxu/engine/__tests__/code-mode-source-cache-governor.test.ts',
      'src/dsxu/engine/__tests__/compact-source-clean-v1.test.ts',
      'src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts',
      'src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts',
    ],
    nextAction: 'Code-mode source capsule and bounded Read fallback are accepted; rerun during final six-stage verification and continue with EP-02 visible-state evidence.',
    acceptance: 'Code-mode source truth uses path/hash/anchor/excerpt with bounded fallback Read; cache and toolResultChars remain visible.',
  },
  {
    id: 'EP-02',
    label: 'Visible State + Tool/Permission',
    owners: ['Work-state timeline owner', 'Tool Gate / ToolBus owner', 'Permission Gate owner'],
    keywords: ['visible', 'timeline', 'tool', 'permission', 'side effect', 'causality', 'human signoff', 'state'],
    areaHints: ['Visible Work-State Projection', 'Tool Lifecycle / Causality', 'Permission / Human Signoff'],
    representativeFiles: [
      'src/dsxu/engine/work-state-timeline.ts',
      'src/dsxu/engine/tool-gate-v1.ts',
      'src/dsxu/engine/tool-mainline-runtime-v1.ts',
      'src/dsxu/engine/permissions.ts',
      'src/dsxu/engine/tool-evidence-pack-v1.ts',
    ],
    representativeTests: [
      'src/dsxu/engine/__tests__/work-state-timeline.test.ts',
      'src/dsxu/engine/__tests__/tool-gate-v1-clean.test.ts',
      'src/dsxu/engine/__tests__/permissions.test.ts',
      'src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts',
    ],
    nextAction: 'Visible-state projection contract is accepted for Tool/Permission/Agent/MCP/Skill evidence; rerun during final UI/TUI parity and continue EP-05 DeepSeek cost-quality gate.',
    acceptance: 'Tool/Permission/Agent/MCP/Skill, DeepSeek route/cost/cache, source truth, and evidence share one DSXU-owned work-state projection.',
  },
  {
    id: 'EP-03',
    label: 'Terminal Live Acceptance',
    owners: ['Terminal lifecycle owner', 'Failure taxonomy / recovery owner', 'VerificationKernel owner'],
    keywords: ['terminal', 'shell', 'command', 'stdout', 'stderr', 'timeout', 'failure', 'repair', 'artifact'],
    areaHints: ['Terminal / Shell Reliability', 'Failure / Repair Loop', 'Test Selection / Verification'],
    representativeFiles: [
      'src/dsxu/engine/code-terminal-runner.ts',
      'src/dsxu/engine/terminal-hit-rate.ts',
      'src/dsxu/engine/failure-taxonomy.ts',
      'src/tools/BashTool/BashTool.tsx',
      'src/tools/PowerShellTool/PowerShellTool.tsx',
    ],
    representativeTests: [
      'src/dsxu/engine/__tests__/tui-terminal-reliability-pack-v1.test.ts',
      'src/dsxu/engine/__tests__/code-terminal-runner.test.ts',
      'src/dsxu/engine/__tests__/terminal-hit-rate.test.ts',
      'src/dsxu/engine/__tests__/controlled-failure-taxonomy.test.ts',
    ],
    nextAction: 'EP-03 live evidence is closed; keep B12/B13 as boundary-only claims and rerun during final six-stage verification.',
    acceptance: 'Terminal live acceptance proves command plan, failure, timeout, repair, artifact checking, bounded preview, and result packaging without claiming Terminal-Bench 2.0.',
  },
  {
    id: 'EP-04',
    label: 'Agent/MCP/Skill Boundary',
    owners: ['Agent lifecycle owner', 'MCP / Skill registry owner', 'External adapter boundary owner'],
    keywords: ['agent', 'worker', 'mcp', 'skill', 'plugin', 'registry', 'handoff', 'envelope', 'conflict'],
    areaHints: ['Agent / Worker Handoff', 'MCP / Skill Ecosystem', 'External Adapter / IDE / Browser Boundary'],
    representativeFiles: [
      'src/dsxu/engine/forked-agent.ts',
      'src/dsxu/engine/subagent-protocol.ts',
      'src/dsxu/engine/skills-registry-v1.ts',
      'src/dsxu/engine/skill-governance-v1.ts',
      'src/dsxu/engine/agent-mcp-skill-boundary-board.ts',
      'src/dsxu/engine/adapters/external-tool-adapter.ts',
    ],
    representativeTests: [
      'src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts',
      'src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
      'src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts',
      'src/dsxu/engine/__tests__/skills-integration.test.ts',
      'src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/external-integration-owner.test.ts',
    ],
    nextAction: 'Agent/MCP/Skill boundary board is accepted; continue EP-08 external benchmark/adapter proof and keep final six-stage verification pending.',
    acceptance: 'Workers return summary/path/hash/evidence; parent finals cite envelopes; MCP/Skill remains governed by DSXU registry and Tool Gate.',
  },
  {
    id: 'EP-05',
    label: 'DeepSeek Cost Quality',
    owners: ['DeepSeek route / cost owner', 'Provider gate / doctor owner'],
    keywords: ['deepseek', 'flash', 'pro', 'route', 'cost', 'cache', 'provider', 'quality', 'pareto', 'token'],
    areaHints: ['Model Route / Cost Evidence', 'Provider Health / First Run', 'Benchmark / Public Challenge Proof'],
    representativeFiles: [
      'src/utils/model/deepseekV4Control.ts',
      'src/utils/model/deepseekV4CostRouter.ts',
      'src/services/api/deepseek-trajectory-store.ts',
      'src/dsxu/engine/cost-cache-live-task-evidence.ts',
      'src/dsxu/engine/live-deepseek-benchmark-gate.ts',
    ],
    representativeTests: [
      'src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts',
      'src/dsxu/engine/__tests__/cost-cache-live-task-evidence.test.ts',
      'src/dsxu/engine/__tests__/live-provider-gate-v1.test.ts',
      'src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts',
    ],
    nextAction: 'Cost-quality board is accepted for Flash-first cost and evidenced Pro admission; continue EP-04 Agent/MCP/Skill Boundary while public 90 and high-cache ROI claims remain guarded.',
    acceptance: 'Flash-first route, cache, cost, quality and Pro admission are visible in the same Pareto board; public 90/high-cache ROI claims stay blocked until raw runs prove them.',
  },
  {
    id: 'EP-06',
    label: 'Release Claim + Open Source',
    owners: ['Release evidence owner', 'Open-source launch owner', 'Security / secret scan owner'],
    keywords: ['release', 'claim', 'readme', 'github', 'open source', 'secret', 'license', 'brand', 'privacy'],
    areaHints: ['Release Evidence / Claim Guard', 'Open Source Product / Maintainer Flow', 'Security / Privacy / Secret Safety'],
    representativeFiles: [
      'src/dsxu/engine/release-provenance-gate.ts',
      'src/dsxu/engine/release-surface-source-policy-review-v1.ts',
      'src/dsxu/engine/open-source-package-gate.ts',
      'src/dsxu/engine/open-source-core.ts',
    ],
    representativeTests: [
      'src/dsxu/engine/__tests__/release-test-gate-v1.test.ts',
      'src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts',
      'src/dsxu/engine/__tests__/open-source-package-gate.test.ts',
    ],
    nextAction: 'Rebuild GitHub launch pack only from strict public claims and real charts.',
    acceptance: 'README, launch pack and release artifacts cite DSXU-owned source/test/live/raw/cost/cache evidence only.',
  },
  {
    id: 'EP-07',
    label: 'Workspace/Owner/Git Hygiene',
    owners: ['Workspace hygiene / owner review owner', 'Repo index / owner map owner'],
    keywords: ['workspace', 'dirty', 'owner', 'git', 'duplicate', 'delete', 'stage', 'mutation', 'hygiene'],
    areaHints: ['Workspace Hygiene / Dirty Attribution', 'Impact / Blast Radius'],
    representativeFiles: [
      'src/dsxu/engine/workspace-policy.ts',
      'src/dsxu/engine/context-owner-rule-v1.ts',
      'src/dsxu/engine/release-surface-source-policy-review-v1.ts',
    ],
    representativeTests: [
      'src/dsxu/engine/__tests__/context-owner-rule-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts',
    ],
    nextAction: 'Use owner/Git packets for dirty attribution and replace/delete candidates; do not auto clean.',
    acceptance: 'Every mutation candidate has owner, replacement evidence, risk, and explicit review state.',
  },
  {
    id: 'EP-08',
    label: 'External Benchmark/Adapter Proof',
    owners: ['Benchmark evidence owner', 'External adapter boundary owner'],
    keywords: ['benchmark', 'public challenge', 'target', 'manifest', 'adapter', 'ide', 'browser', 'external', 'raw'],
    areaHints: ['Benchmark / Public Challenge Proof', 'External Adapter / IDE / Browser Boundary'],
    representativeFiles: [
      'src/dsxu/engine/benchmark-readiness.ts',
      'src/dsxu/engine/raw-evidence-readiness-register-v1.ts',
      'src/dsxu/engine/external-benchmark-adapter-proof-board.ts',
      'src/dsxu/engine/public-challenge-ablation-board.ts',
      'src/dsxu/engine/adapters/external-tool-adapter.ts',
      'src/dsxu/engine/live-deepseek-benchmark-gate.ts',
    ],
    representativeTests: [
      'src/dsxu/engine/__tests__/benchmark-readiness.test.ts',
      'src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts',
      'src/dsxu/engine/__tests__/external-benchmark-adapter-proof-board.test.ts',
      'src/dsxu/engine/__tests__/public-challenge-ablation-board.test.ts',
      'src/dsxu/engine/__tests__/external-integration-owner.test.ts',
    ],
    nextAction: 'Adapter/browser/provider proof is guarded; import real target manifest before external comparison, public 90, or clean export claims.',
    acceptance: 'Adapter proof can be shown as DSXU boundary evidence; target raw, DSXU raw, metrics, risk and artifact manifests must be same-task before comparison claims.',
  },
]

function priorityCounts() {
  return { P0: 0, P1: 0, P2: 0 } as Record<Priority, number>
}

function addPriority(acc: Record<Priority, number>, priority: Priority) {
  acc[priority] += 1
}

function parseLocalScenarios(text: string): LocalScenarioRow[] {
  const start = text.indexOf('#### 9.19.5')
  const end = text.indexOf('#### 9.19.6')
  if (start < 0 || end < start) return []
  const section = text.slice(start, end)
  const rows: LocalScenarioRow[] = []
  for (const line of section.split(/\r?\n/)) {
    if (!/^\| P[0-2] \|/.test(line)) continue
    const cells = line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim())
    if (cells.length < 4) continue
    rows.push({
      source: 'v26-9.19.5',
      priority: cells[0] as Priority,
      title: cells[1].replaceAll('`', ''),
      value: cells[2],
      boundary: cells[3],
    })
  }
  return rows
}

function packetForText(text: string, area?: string): string {
  const normalized = `${area ?? ''} ${text}`.toLowerCase()
  let best = PACKETS[0]
  let bestScore = -1
  for (const packet of PACKETS) {
    let score = 0
    for (const hint of packet.areaHints) {
      if (area === hint) score += 20
      if (normalized.includes(hint.toLowerCase())) score += 8
    }
    for (const keyword of packet.keywords) {
      if (normalized.includes(keyword.toLowerCase())) score += 1
    }
    if (score > bestScore) {
      best = packet
      bestScore = score
    }
  }
  return best.id
}

function packetForCapability(row: CapabilityRow): string {
  if (/^B(0[1-6]|0[8-9]|1[0-4])$/.test(row.id)) return 'EP-03'
  if (['A16', 'A17', 'E02', 'PZ03'].includes(row.id)) return 'EP-08'
  if (['M07', 'A14'].includes(row.id)) return 'EP-05'
  if (row.id === 'PZ07') return 'EP-04'
  return packetForText(`${row.id} ${row.capability} ${row.dsxuOwner} ${row.nextAction}`)
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function exists(path: string): boolean {
  return existsSync(join(ROOT, path))
}

function statusFor(packet: PacketReport): PacketReport['status'] {
  if (['EP-01', 'EP-02', 'EP-03', 'EP-04', 'EP-05'].includes(packet.id)) return 'accepted-core'
  if (packet.id === 'EP-08') return 'needs-live-evidence'
  if (packet.id === 'EP-07') return 'needs-owner-review'
  return 'ready-for-execution'
}

function buildMarkdown(reports: PacketReport[], summary: Record<string, unknown>): string {
  const lines = [
    '# DSXU Reference Scenario Convergence - 2026-05-16',
    '',
    'This report merges the V26 174 scenario pool, the 1000 generated reference scenario backlog, and the 67/82 capability acceptance audit into eight executable packets.',
    '',
    `Summary: sourceRows=${summary.sourceRows}, rowsFrom174=${summary.rowsFrom174}, rowsFrom1000=${summary.rowsFrom1000}, P0=${summary.P0}, P1=${summary.P1}, P2=${summary.P2}.`,
    '',
    '| packet | status | rows 174 | rows 1000 | P0 | P1 | P2 | capability gaps | next action |',
    '|---|---|---:|---:|---:|---:|---:|---|---|',
    ...reports.map(
      report =>
        `| ${report.id} ${report.label} | ${report.status} | ${report.rowsFrom174} | ${report.rowsFrom1000} | ${report.p0Rows} | ${report.p1Rows} | ${report.p2Rows} | ${report.capabilityGaps.join('; ') || 'none'} | ${report.nextAction} |`,
    ),
    '',
    'Owner coverage:',
    '',
    '| packet | files existing | files missing | tests existing | tests missing |',
    '|---|---:|---:|---:|---:|',
    ...reports.map(
      report =>
        `| ${report.id} | ${report.filesExisting.length} | ${report.filesMissing.length} | ${report.testsExisting.length} | ${report.testsMissing.length} |`,
    ),
    '',
  ]
  return lines.join('\n')
}

async function main() {
  const [doc, backlogRaw, capabilityRaw] = await Promise.all([
    readFile(DOC, 'utf8'),
    readFile(BACKLOG_JSON, 'utf8'),
    readFile(CAPABILITY_JSON, 'utf8'),
  ])
  const localRows = parseLocalScenarios(doc)
  const backlog = JSON.parse(backlogRaw) as { rows: BacklogRow[] }
  const capability = JSON.parse(capabilityRaw) as { rows: CapabilityRow[] }

  const reports = new Map<string, PacketReport>()
  for (const packet of PACKETS) {
    reports.set(packet.id, {
      ...packet,
      rowsFrom174: 0,
      rowsFrom1000: 0,
      p0Rows: 0,
      p1Rows: 0,
      p2Rows: 0,
      capabilityGaps: [],
      filesExisting: packet.representativeFiles.filter(exists),
      filesMissing: packet.representativeFiles.filter(file => !exists(file)),
      testsExisting: packet.representativeTests.filter(exists),
      testsMissing: packet.representativeTests.filter(file => !exists(file)),
      status: 'ready-for-execution',
    })
  }

  const aggregatePriority = priorityCounts()
  for (const row of localRows) {
    const packetId = packetForText(`${row.title} ${row.value} ${row.boundary}`)
    const report = reports.get(packetId)
    if (!report) continue
    report.rowsFrom174 += 1
    addPriority(aggregatePriority, row.priority)
    if (row.priority === 'P0') report.p0Rows += 1
    if (row.priority === 'P1') report.p1Rows += 1
    if (row.priority === 'P2') report.p2Rows += 1
  }

  for (const row of backlog.rows) {
    const packetId = packetForText(`${row.title} ${row.value} ${row.implementationBoundary}`, row.mechanismArea)
    const report = reports.get(packetId)
    if (!report) continue
    report.rowsFrom1000 += 1
    addPriority(aggregatePriority, row.priority)
    if (row.priority === 'P0') report.p0Rows += 1
    if (row.priority === 'P1') report.p1Rows += 1
    if (row.priority === 'P2') report.p2Rows += 1
  }

  const gapRows = capability.rows.filter(row =>
    ['adapted/subset+tested', 'implemented+tested-needs-live-window'].includes(row.acceptanceDecision),
  )
  for (const row of gapRows) {
    const packetId = packetForCapability(row)
    const report = reports.get(packetId)
    if (report) report.capabilityGaps.push(`${row.id}:${row.capability} [${row.acceptanceDecision}]`)
  }

  const packetReports = [...reports.values()].map(report => ({ ...report, status: statusFor(report) }))
  const sourceRows = localRows.length + backlog.rows.length
  const summary = {
    schemaVersion: 'dsxu.reference-scenario-convergence.v1',
    generatedAt: new Date().toISOString(),
    sourceRows,
    rowsFrom174: localRows.length,
    rowsFrom1000: backlog.rows.length,
    P0: aggregatePriority.P0,
    P1: aggregatePriority.P1,
    P2: aggregatePriority.P2,
    packetCount: packetReports.length,
    capabilityGaps: gapRows.length,
    decision:
      'The 174 local scenarios and 1000 generated backlog rows converge into eight execution packets. Execute packets, not individual scenario rows.',
  }

  await mkdir(GENERATED_DIR, { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify({ summary, packets: packetReports }, null, 2)}\n`, 'utf8')
  const csvHeader = [
    'id',
    'label',
    'status',
    'rowsFrom174',
    'rowsFrom1000',
    'p0Rows',
    'p1Rows',
    'p2Rows',
    'capabilityGaps',
    'filesExisting',
    'filesMissing',
    'testsExisting',
    'testsMissing',
    'nextAction',
    'acceptance',
  ]
  const csvRows = packetReports.map(report =>
    [
      report.id,
      report.label,
      report.status,
      report.rowsFrom174,
      report.rowsFrom1000,
      report.p0Rows,
      report.p1Rows,
      report.p2Rows,
      report.capabilityGaps.join('; '),
      report.filesExisting.join('; '),
      report.filesMissing.join('; '),
      report.testsExisting.join('; '),
      report.testsMissing.join('; '),
      report.nextAction,
      report.acceptance,
    ]
      .map(csvCell)
      .join(','),
  )
  await writeFile(OUT_CSV, `${csvHeader.join(',')}\n${csvRows.join('\n')}\n`, 'utf8')
  await writeFile(OUT_MD, buildMarkdown(packetReports, summary), 'utf8')

  console.log('PASS_DSXU_REFERENCE_SCENARIO_CONVERGENCE_GENERATED')
  console.log(`sourceRows=${summary.sourceRows}`)
  console.log(`rowsFrom174=${summary.rowsFrom174}`)
  console.log(`rowsFrom1000=${summary.rowsFrom1000}`)
  console.log(`priorityCounts=${JSON.stringify({ P0: summary.P0, P1: summary.P1, P2: summary.P2 })}`)
  console.log(`packets=${packetReports.length}`)
  console.log(`json=${OUT_JSON}`)
  console.log(`markdown=${OUT_MD}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
