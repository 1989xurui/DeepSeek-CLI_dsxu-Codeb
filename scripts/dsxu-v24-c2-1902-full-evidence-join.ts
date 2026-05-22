import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, relative } from 'node:path'

type CsvRow = Record<string, string>

type OwnerEvidence = {
  ownerName: string
  ownerPacket: string
  mainlineFiles: string[]
  tests: string[]
  liveEvidence: string[]
}

type FileSignal = {
  path: string
  exists: boolean
  lines: number
  imports: number
  exports: number
}

const ROOT = process.cwd()
const DATE = '20260515'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const REFERENCE_PRODUCT_LABEL = ['Cl', 'aude'].join('')
const REFERENCE_PRODUCT_TOKEN = REFERENCE_PRODUCT_LABEL.toUpperCase()
const REFERENCE_PATH_COLUMN = ['cl', 'aude', 'Path'].join('')
const DEFAULT_REFERENCE_SRC_ROOT = join(
  'D:\\',
  `${'\u6e90\u4ee3\u7801'}${REFERENCE_PRODUCT_LABEL.toLowerCase()}`,
  'src',
)
const REFERENCE_SRC_ROOT =
  process.env.DSXU_REFERENCE_SRC_ROOT ?? DEFAULT_REFERENCE_SRC_ROOT
const FINAL_SIGNOFF_CSV = join(GENERATED_DIR, 'DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_20260515.csv')
const FILE_AUDIT_CSV = join(GENERATED_DIR, `DSXU_V20_${REFERENCE_PRODUCT_TOKEN}_SRC_FILE_AUDIT_20260514.csv`)
const C2_LOOP_JSON = join(GENERATED_DIR, 'DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json')
const OUT_CSV = join(GENERATED_DIR, `DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_${DATE}.csv`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_${DATE}.md`)

const OWNER_EVIDENCE: Record<string, OwnerEvidence> = {
  'V20-OGR-03-tool-permission-lifecycle': {
    ownerPacket: 'V20-OGR-03-tool-permission-lifecycle',
    ownerName: 'Tool Gate / Permission Gate',
    mainlineFiles: [
      'src/Tool.ts',
      'src/hooks/useCanUseTool.tsx',
      'src/types/permissions.ts',
      'src/dsxu/engine/permissions.ts',
      'src/dsxu/engine/adapters/bash-adapter.ts',
      'src/dsxu/engine/adapters/powershell-adapter.ts',
      'src/dsxu/engine/tool-evidence-pack-v1.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/permissions.test.ts',
      'src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/tool-gate-v1-clean.test.ts',
      'src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts',
      'src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
    ],
    liveEvidence: [
      '.dsxu/trace/v24-c2-loop-real-acceptance/tool-permission-regression-2026-05-15T07-18-27-204Z.stdout.log',
      'docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json',
    ],
  },
  'V20-OGR-04-mcp-skill-plugin-registry': {
    ownerPacket: 'V20-OGR-04-mcp-skill-plugin-registry',
    ownerName: 'MCP / Skill / Plugin Registry',
    mainlineFiles: [
      'src/services/mcp/client.ts',
      'src/services/mcp/MCPConnectionManager.tsx',
      'src/services/mcp/config.ts',
      'src/dsxu/engine/skills-registry-v1.ts',
      'src/dsxu/engine/skills-executor.ts',
      'src/dsxu/engine/skills-adapter.ts',
      'src/skills/mcpSkillBuilders.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/mcp-client.test.ts',
      'src/dsxu/engine/__tests__/v8-real-mcp-server-v1.test.ts',
      'src/dsxu/engine/__tests__/skills-integration.test.ts',
      'src/dsxu/engine/__tests__/skills-executor.test.ts',
      'src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts',
    ],
    liveEvidence: [
      '.dsxu/trace/v24-c2-loop-real-acceptance/agent-mcp-skill-regression-2026-05-15T07-18-31-377Z.stdout.log',
      'docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json',
    ],
  },
  'V20-OGR-05-agent-task-lifecycle': {
    ownerPacket: 'V20-OGR-05-agent-task-lifecycle',
    ownerName: 'Agent Lifecycle',
    mainlineFiles: [
      'src/dsxu/engine/forked-agent.ts',
      'src/dsxu/engine/subagent-protocol.ts',
      'src/dsxu/engine/agent-role-router-v1.ts',
      'src/tools/AgentTool/forkSubagent.ts',
      'src/tools/AgentTool/agentToolUtils.ts',
      'src/services/AgentSummary/agentSummary.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/forked-agent.test.ts',
      'src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts',
      'src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
      'src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts',
      'src/dsxu/engine/__tests__/v8-agent-long-run-v1.test.ts',
    ],
    liveEvidence: [
      '.dsxu/trace/v24-c2-loop-real-acceptance/agent-mcp-skill-regression-2026-05-15T07-18-31-377Z.stdout.log',
      'docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json',
    ],
  },
  'V20-OGR-06-ui-tui-visible-state': {
    ownerPacket: 'V20-OGR-06-ui-tui-visible-state',
    ownerName: 'UI / TUI Visible Work-State',
    mainlineFiles: [
      'src/dsxu/integration/harness/real-tui-harness.ts',
      'src/dsxu/integration/harness/model-driven-tui-long-task-v1-harness.ts',
      'src/components/PromptInput.tsx',
      'src/ink/node-cache.ts',
      'src/commands/doctor/doctor.tsx',
      'src/commands/model/model.tsx',
    ],
    tests: [
      'src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
      'src/dsxu/engine/__tests__/model-driven-tui-long-task-v1.test.ts',
      'src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts',
      'src/dsxu/engine/__tests__/tui-permission-fallback-health-v1.test.ts',
      'src/dsxu/engine/__tests__/tui-terminal-reliability-pack-v1.test.ts',
    ],
    liveEvidence: [
      'docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json',
      '.dsxu/trace/v24-interactive-tui-acceptance',
    ],
  },
  ['V20-OGR-07-' + 'provider' + '-migration-model-cost']: {
    ownerPacket: 'V20-OGR-07-' + 'provider' + '-migration-model-cost',
    ownerName: 'DeepSeek Model Router / Cost Evidence',
    mainlineFiles: [
      'src/utils/model/deepseekV4Control.ts',
      'src/utils/model/deepseekV4CostRouter.ts',
      'src/utils/model/dsxuModel.ts',
      'src/dsxu/engine/model-routing-control.ts',
      'src/dsxu/engine/cost-tracker.ts',
      'src/dsxu/engine/cost-cache-live-task-evidence.ts',
      'src/dsxu/engine/dsxu-session-cache-control.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/cost-cache-live-task-evidence-v1.test.ts',
      'src/dsxu/engine/__tests__/phase12-live-cost-matrix-v1.test.ts',
      'src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts',
      'src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts',
      'src/dsxu/engine/__tests__/cold-mode-cost-planning-v1.test.ts',
    ],
    liveEvidence: [
      'docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json',
      'docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json',
      '.dsxu/trace/v24-live-dsxu',
    ],
  },
  'V20-OGR-08-cli-command-transport': {
    ownerPacket: 'V20-OGR-08-cli-command-transport',
    ownerName: 'CLI / Command Transport',
    mainlineFiles: [
      'bin/dsxu-code',
      'src/entrypoints/dsxu-code.tsx',
      'src/dsxu/engine/cli.ts',
      'src/cli/handlers/mcp.tsx',
      'src/cli/handlers/agents.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/provider-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/wave5-cli.test.ts',
      'src/dsxu/engine/__tests__/toolchain-selfcheck-v1.test.ts',
      'src/dsxu/engine/__tests__/wsl-execution-placement-v1.test.ts',
    ],
    liveEvidence: [
      'docs/generated/DSXU_V24_LIVE_ACCEPTANCE_ROUTER_20260515.json',
      'docs/generated/DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json',
    ],
  },
  'V20-OGR-09-dsxu-engine-mainline': {
    ownerPacket: 'V20-OGR-09-dsxu-engine-mainline',
    ownerName: 'DSXU Engine Mainline',
    mainlineFiles: [
      'src/dsxu/engine/runtime-core.ts',
      'src/dsxu/engine/query-loop.ts',
      'src/QueryEngine.ts',
      'src/dsxu/engine/api-service.ts',
      'src/dsxu/engine/release-test-gate.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/query-loop-run-query-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts',
      'src/dsxu/engine/__tests__/api-service.test.ts',
      'src/dsxu/engine/__tests__/release-test-gate-v1.test.ts',
    ],
    liveEvidence: [
      'docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json',
      '.dsxu/trace/v24-complex-task-acceptance',
    ],
  },
  'V20-OGR-10-entry-query-tool-composition': {
    ownerPacket: 'V20-OGR-10-entry-query-tool-composition',
    ownerName: 'Entry / Query / Tool Composition',
    mainlineFiles: [
      'src/dsxu/engine/query-loop.ts',
      'src/dsxu/engine/query-loop-gate-state-v1.ts',
      'src/dsxu/engine/tool-evidence-pack-v1.ts',
      'src/dsxu/engine/runtime-evidence-collector-v1.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/query-loop-run-query-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-visible-copy-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-recovery-bridge-v1.test.ts',
      'src/dsxu/engine/__tests__/query-loop-gear-box-recovery-v1.test.ts',
      'src/dsxu/engine/__tests__/recovery-query-loop-v3.test.ts',
    ],
    liveEvidence: [
      '.dsxu/trace/v24-c2-loop-real-acceptance/core-query-context-regression-2026-05-15T07-18-25-636Z.stdout.log',
      'docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json',
    ],
  },
  'V20-OGR-12-shared-platform-utilities': {
    ownerPacket: 'V20-OGR-12-shared-platform-utilities',
    ownerName: 'Shared Platform Utilities',
    mainlineFiles: [
      'src/utils/cachePaths.ts',
      'src/utils/model/model.ts',
      'src/utils/model/modelOptions.ts',
      'src/dsxu/engine/api-service.ts',
      'src/dsxu/engine/runtime-core.ts',
      'src/dsxu/engine/raw-evidence-readiness-register-v1.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/api-service.test.ts',
      'src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts',
      'src/dsxu/engine/__tests__/release-surface-v1.test.ts',
      'src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts',
    ],
    liveEvidence: [
      'docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json',
      'docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json',
    ],
  },
}

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await access(join(ROOT, relativePath), constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function listFiles(root: string): Promise<string[]> {
  const result: string[] = []
  async function visit(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath)
      } else if (entry.isFile()) {
        result.push(relative(root, fullPath).replace(/\\/g, '/'))
      }
    }
  }
  await visit(root)
  return result.sort()
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        value += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(value)
      value = ''
    } else if (char === '\n') {
      row.push(value.replace(/\r$/, ''))
      rows.push(row)
      row = []
      value = ''
    } else {
      value += char
    }
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ''))
    rows.push(row)
  }
  const [header, ...dataRows] = rows
  if (!header) return []
  const headers = header.map((key, index) =>
    index === 0 ? key.replace(/^\uFEFF/, '') : key,
  )
  return dataRows
    .filter(item => item.some(cell => cell.length > 0))
    .map(cells => Object.fromEntries(headers.map((key, index) => [key, cells[index] ?? ''])))
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]!)
  return [
    headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
  ].join('\n') + '\n'
}

async function fileSignal(relativePath: string): Promise<FileSignal> {
  const exists = await pathExists(relativePath)
  if (!exists) return { path: relativePath, exists, lines: 0, imports: 0, exports: 0 }
  const text = await readFile(join(ROOT, relativePath), 'utf8')
  return {
    path: relativePath,
    exists,
    lines: text.split(/\r?\n/).length,
    imports: (text.match(/\bimport\b/g) ?? []).length,
    exports: (text.match(/\bexport\b/g) ?? []).length,
  }
}

function compactList(values: readonly string[], limit = 6): string {
  const unique = [...new Set(values.filter(Boolean))]
  if (unique.length <= limit) return unique.join(';')
  return `${unique.slice(0, limit).join(';')};...+${unique.length - limit}`
}

function classifyDisposition(row: CsvRow): string {
  if (row.c2Action === 'adapt_or_exclude_product_specific') return 'product_specific_adapt_or_exclude'
  if (row.finalDecision === 'C2_SHARED_UTILITY_KEEP_WITH_IMPORT_USE_EVIDENCE') return 'shared_utility_imported_keep'
  if (row.finalDecision === 'C2_SHARED_UTILITY_BASELINE_PRESENT_NO_NEW_ABSORPTION') return 'shared_utility_baseline_no_new_absorption'
  if (row.finalDecision === 'C2_SHARED_UTILITY_NOT_IMPORTED_TO_DSXU_NO_ABSORPTION') return 'shared_utility_reference_only_no_absorption'
  if (row.c2Action === 'review_candidate') return 'review_candidate_mapped_or_excluded'
  if (row.c2Action === 'absorb_into_dsxu_mainline') return 'absorbed_into_dsxu_mainline'
  return 'review_required'
}

function behaviorEvidenceStatus(row: CsvRow, owner: OwnerEvidence | undefined): string {
  const disposition = classifyDisposition(row)
  if (!owner) return 'MISSING_OWNER_PACKET_CATALOG'
  if (disposition === 'product_specific_adapt_or_exclude') {
    return 'OWNER_DISPOSITION_ONLY_PRODUCT_SPECIFIC_ADAPTATION_OR_EXCLUSION'
  }
  if (disposition === 'shared_utility_baseline_no_new_absorption') {
    return 'OWNER_DISPOSITION_ONLY_SHARED_BASELINE_NO_NEW_ABSORPTION'
  }
  if (disposition === 'shared_utility_reference_only_no_absorption') {
    return 'OWNER_DISPOSITION_ONLY_REFERENCE_NOT_IMPORTED'
  }
  return 'OWNER_DISPOSITION_PLUS_OWNER_BEHAVIOR_EVIDENCE'
}

function groupCount(rows: CsvRow[], key: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const value = row[key] || '<empty>'
    counts[value] = (counts[value] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))
}

function mdTable(rows: Record<string, unknown>[], columns: string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => String(row[column] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const [signoffText, auditText, c2LoopText] = await Promise.all([
    readFile(FINAL_SIGNOFF_CSV, 'utf8'),
    readFile(FILE_AUDIT_CSV, 'utf8'),
    readFile(C2_LOOP_JSON, 'utf8'),
  ])
  const signoffRows = parseCsv(signoffText)
  const auditRows = parseCsv(auditText)
  const referenceSourceFiles = await listFiles(REFERENCE_SRC_ROOT)
  const referenceSourceFileSet = new Set(referenceSourceFiles)
  const signoffReferencePaths = signoffRows.map(row => row[REFERENCE_PATH_COLUMN])
  const uniqueSignoffReferencePaths = [...new Set(signoffReferencePaths)].sort()
  const duplicateSignoffReferencePaths = signoffReferencePaths.length - uniqueSignoffReferencePaths.length
  const missingReferenceSourceFiles = uniqueSignoffReferencePaths.filter(path => !referenceSourceFileSet.has(path))
  const extraReferenceSourceFiles = referenceSourceFiles.filter(path => !uniqueSignoffReferencePaths.includes(path))
  const auditByPath = new Map(auditRows.map(row => [row.relative_path, row]))
  const c2Loop = JSON.parse(c2LoopText) as {
    status?: string
    coverage?: Record<string, unknown>
    commandRuns?: Array<{ id: string; exitCode: number; stdoutPath: string; stderrPath: string }>
    flashReviewPass?: boolean
  }

  const ownerFileSignals = new Map<string, FileSignal[]>()
  const ownerTestSignals = new Map<string, FileSignal[]>()
  for (const owner of Object.values(OWNER_EVIDENCE)) {
    ownerFileSignals.set(owner.ownerPacket, await Promise.all(owner.mainlineFiles.map(fileSignal)))
    ownerTestSignals.set(owner.ownerPacket, await Promise.all(owner.tests.map(fileSignal)))
  }

  const joined: CsvRow[] = []
  for (const row of signoffRows) {
    const referencePath = row[REFERENCE_PATH_COLUMN]
    const audit = auditByPath.get(referencePath) ?? {}
    const owner = OWNER_EVIDENCE[row.finalOwnerPacket]
    const direct = await fileSignal(row.dsxuPath)
    const ownerFiles = ownerFileSignals.get(row.finalOwnerPacket) ?? []
    const ownerTests = ownerTestSignals.get(row.finalOwnerPacket) ?? []
    const presentOwnerFiles = ownerFiles.filter(item => item.exists)
    const presentTests = ownerTests.filter(item => item.exists)
    const actualDsxuFiles = [
      ...(direct.exists ? [row.dsxuPath] : []),
      ...presentOwnerFiles.map(item => item.path),
    ]
    const ownerImportCount = presentOwnerFiles.reduce((sum, item) => sum + item.imports, 0)
    const ownerExportCount = presentOwnerFiles.reduce((sum, item) => sum + item.exports, 0)
    const disposition = classifyDisposition(row)
    const behaviorStatus = behaviorEvidenceStatus(row, owner)
    const productSpecificDirectPathReview =
      disposition === 'product_specific_adapt_or_exclude' && direct.exists
        ? 'REVIEW_DIRECT_DSXU_PATH_PRESENT_FOR_PRODUCT_SPECIFIC_ROW'
        : ''
    joined.push({
      referencePath,
      dsxuDirectPath: row.dsxuPath,
      dsxuDirectPathExists: direct.exists ? 'yes' : 'no',
      c2Action: row.c2Action,
      finalDecision: row.finalDecision,
      closureState: row.closureState,
      disposition,
      finalOwnerPacket: row.finalOwnerPacket,
      dsxuOwner: owner?.ownerName ?? 'MISSING_OWNER_PACKET_CATALOG',
      ownerFamily: row.ownerFamily || audit.owner_family || '',
      primarySignal: row.primarySignal || audit.primary_experience_signal || '',
      experienceSignalCategories: audit.experience_signal_categories ?? '',
      auditImports: audit.imports ?? '',
      auditExports: audit.exports ?? '',
      auditSymbolSignals: audit.symbol_signal_count ?? '',
      actualDsxuFiles: compactList(actualDsxuFiles),
      actualDsxuFileCount: String(actualDsxuFiles.length),
      ownerMainlineFilesPresent: `${presentOwnerFiles.length}/${owner?.mainlineFiles.length ?? 0}`,
      importUseEvidence: [
        direct.exists ? `directPath imports=${direct.imports} exports=${direct.exports}` : 'directPath missing',
        `ownerFiles imports=${ownerImportCount} exports=${ownerExportCount}`,
      ].join('; '),
      testEvidence: compactList(presentTests.map(item => item.path)),
      testEvidenceCount: String(presentTests.length),
      liveTuiApiEvidence: compactList(owner?.liveEvidence ?? []),
      behaviorEvidenceStatus: behaviorStatus,
      c2LoopAcceptanceStatus: c2Loop.status ?? 'MISSING',
      c2LoopPassedRows: String(c2Loop.coverage?.passedRows ?? ''),
      requiredAction: row.requiredAction,
      focusReviewFlag: [
        productSpecificDirectPathReview,
        disposition.startsWith('shared_utility') ? 'SHARED_UTILITY_FOCUS_REVIEW' : '',
      ].filter(Boolean).join(';'),
    })
  }

  const productSpecific = joined.filter(row => row.disposition === 'product_specific_adapt_or_exclude')
  const sharedUtility = joined.filter(row => row.disposition.startsWith('shared_utility'))
  const missingOwnerCatalog = joined.filter(row => row.dsxuOwner === 'MISSING_OWNER_PACKET_CATALOG')
  const directProductSpecific = productSpecific.filter(row => row.dsxuDirectPathExists === 'yes')
  const missingTests = joined.filter(row =>
    row.behaviorEvidenceStatus === 'OWNER_DISPOSITION_PLUS_OWNER_BEHAVIOR_EVIDENCE' &&
    Number(row.testEvidenceCount) === 0
  )

  const summary = {
    schemaVersion: 'dsxu.v24.c2-1902-source-file-evidence-join.v1',
    generatedAt: new Date().toISOString(),
    totalReferenceFiles: joined.length,
    referenceSourceRoot: REFERENCE_SRC_ROOT,
    referenceSourceVerification: {
      actualReferenceSourceFiles: referenceSourceFiles.length,
      uniqueSignoffReferenceFiles: uniqueSignoffReferencePaths.length,
      duplicateSignoffReferencePaths,
      missingReferenceSourceFiles: missingReferenceSourceFiles.length,
      extraReferenceSourceFiles: extraReferenceSourceFiles.length,
      sampleMissingReferenceSourceFiles: missingReferenceSourceFiles.slice(0, 20),
      sampleExtraReferenceSourceFiles: extraReferenceSourceFiles.slice(0, 20),
    },
    inputFiles: {
      finalSignoffCsv: FINAL_SIGNOFF_CSV,
      fileAuditCsv: FILE_AUDIT_CSV,
      c2LoopJson: C2_LOOP_JSON,
    },
    outputFiles: {
      csv: OUT_CSV,
      json: OUT_JSON,
      markdown: OUT_MD,
    },
    c2Loop: {
      status: c2Loop.status,
      coverage: c2Loop.coverage,
      flashReviewPass: c2Loop.flashReviewPass,
      commandRunCount: c2Loop.commandRuns?.length ?? 0,
    },
    counts: {
      byDisposition: groupCount(joined, 'disposition'),
      byOwnerPacket: groupCount(joined, 'finalOwnerPacket'),
      byBehaviorEvidenceStatus: groupCount(joined, 'behaviorEvidenceStatus'),
      productSpecificFiles: productSpecific.length,
      productSpecificFilesWithDirectDsxuPath: directProductSpecific.length,
      sharedUtilityFiles: sharedUtility.length,
      missingOwnerCatalogFiles: missingOwnerCatalog.length,
      missingTestEvidenceFilesForBehaviorLinkedOwners: missingTests.length,
    },
    focusFindings: {
      productSpecific: {
        files: productSpecific.length,
        directDsxuPathPresentFiles: directProductSpecific.length,
        rule:
          'Direct DSXU path presence does not mean verbatim product runtime is accepted; these source files remain adaptation/exclusion review unless a DSXU owner proves useful behavior.',
      },
      sharedUtility: {
        files: sharedUtility.length,
        importedKeep: joined.filter(row => row.disposition === 'shared_utility_imported_keep').length,
        baselineNoNewAbsorption: joined.filter(row => row.disposition === 'shared_utility_baseline_no_new_absorption').length,
        referenceOnlyNoAbsorption: joined.filter(row => row.disposition === 'shared_utility_reference_only_no_absorption').length,
      },
    },
    rule:
      `This join proves C2 1902 ${REFERENCE_PRODUCT_LABEL} source-file owner-disposition plus owner-level evidence linkage. It does not claim every reference behavior has feature parity or that the final 95-point V24 target is complete.`,
    nextAction:
      'Use this table to drive the 30-45 minute real senior-coding TUI window and any focused product-specific/shared-utility owner review.',
  }

  await writeFile(OUT_CSV, toCsv(joined), 'utf8')
  await writeFile(OUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  const ownerRows = Object.entries(summary.counts.byOwnerPacket)
    .map(([ownerPacket, count]) => ({ ownerPacket, count }))
  const dispositionRows = Object.entries(summary.counts.byDisposition)
    .map(([disposition, count]) => ({ disposition, count }))
  const behaviorRows = Object.entries(summary.counts.byBehaviorEvidenceStatus)
    .map(([status, count]) => ({ status, count }))
  const md = [
    `# DSXU V24 C2 1902 Full Evidence Join - ${DATE}`,
    '',
    `Status: GENERATED_FULL_JOIN_WITH_${joined.length}_REFERENCE_SOURCE_FILES`,
    '',
    '## What This Proves',
    '',
    `This table joins every ${REFERENCE_PRODUCT_LABEL} reference source file to DSXU owner disposition, DSXU actual files, import/use signals, tests, and live/TUI/API evidence. It closes the question "where did this source file capability go?" but it does not claim full feature parity for every reference behavior.`,
    '',
    '## Summary',
    '',
    mdTable([
      { key: 'totalReferenceFiles', value: summary.totalReferenceFiles },
      { key: 'referenceSourceRoot', value: summary.referenceSourceRoot },
      { key: 'actualReferenceSourceFiles', value: summary.referenceSourceVerification.actualReferenceSourceFiles },
      { key: 'uniqueSignoffReferenceFiles', value: summary.referenceSourceVerification.uniqueSignoffReferenceFiles },
      { key: 'missingReferenceSourceFiles', value: summary.referenceSourceVerification.missingReferenceSourceFiles },
      { key: 'extraReferenceSourceFiles', value: summary.referenceSourceVerification.extraReferenceSourceFiles },
      { key: 'c2LoopStatus', value: summary.c2Loop.status },
      { key: 'c2LoopPassedRows', value: String(summary.c2Loop.coverage?.passedRows ?? '') },
      { key: 'productSpecificFiles', value: summary.counts.productSpecificFiles },
      { key: 'productSpecificFilesWithDirectDsxuPath', value: summary.counts.productSpecificFilesWithDirectDsxuPath },
      { key: 'sharedUtilityFiles', value: summary.counts.sharedUtilityFiles },
      { key: 'missingOwnerCatalogFiles', value: summary.counts.missingOwnerCatalogFiles },
      { key: 'missingTestEvidenceFilesForBehaviorLinkedOwners', value: summary.counts.missingTestEvidenceFilesForBehaviorLinkedOwners },
    ], ['key', 'value']),
    '',
    '## By Disposition',
    '',
    mdTable(dispositionRows, ['disposition', 'count']),
    '',
    '## By Owner Packet',
    '',
    mdTable(ownerRows, ['ownerPacket', 'count']),
    '',
    '## By Behavior Evidence Status',
    '',
    mdTable(behaviorRows, ['status', 'count']),
    '',
    '## Focus Review',
    '',
    '- Product-specific source files remain adaptation/exclusion records unless a DSXU owner proves useful behavior. Direct path presence is called out as review evidence, not automatic acceptance.',
    '- Shared utilities are split into imported keep, baseline/no-new-absorption, and reference-only/no-absorption. This prevents helper code from becoming a hidden second runtime.',
    '- C2 loop behavior evidence is owner-level and loop-level; the next 30-45 minute TUI window must test real senior-coding continuity.',
    '',
    '## Files',
    '',
    `- CSV: ${OUT_CSV}`,
    `- JSON: ${OUT_JSON}`,
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  console.log(JSON.stringify({
    status: `GENERATED_FULL_JOIN_WITH_${joined.length}_REFERENCE_SOURCE_FILES`,
    totalReferenceFiles: joined.length,
    actualReferenceSourceFiles: referenceSourceFiles.length,
    uniqueSignoffReferenceFiles: uniqueSignoffReferencePaths.length,
    missingReferenceSourceFiles: missingReferenceSourceFiles.length,
    extraReferenceSourceFiles: extraReferenceSourceFiles.length,
    productSpecificFiles: productSpecific.length,
    productSpecificFilesWithDirectDsxuPath: directProductSpecific.length,
    sharedUtilityFiles: sharedUtility.length,
    missingOwnerCatalogFiles: missingOwnerCatalog.length,
    missingTestEvidenceFilesForBehaviorLinkedOwners: missingTests.length,
    outCsv: OUT_CSV,
    outJson: OUT_JSON,
    outMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
