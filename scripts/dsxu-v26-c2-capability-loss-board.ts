import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type CsvRow = Record<string, string>

type LoopDefinition = {
  id: string
  label: string
  tokens: readonly string[]
  v26Owner: string
}

const ROOT = process.cwd()
const DATE = '20260515'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const INPUT_C2_JOIN = join(GENERATED_DIR, `DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_${DATE}.csv`)
const INPUT_C2_JOIN_JSON = join(GENERATED_DIR, `DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_${DATE}.json`)
const INPUT_C2_LOOP_JSON = join(GENERATED_DIR, `DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V26_C2_CAPABILITY_LOSS_BOARD_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_V26_C2_CAPABILITY_LOSS_BOARD_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V26_C2_CAPABILITY_LOSS_BOARD_${DATE}.md`)

const LOOP_DEFINITIONS: readonly LoopDefinition[] = [
  {
    id: 'visible-work-state',
    label: 'Visible Work-State',
    tokens: ['ui_interaction'],
    v26Owner: 'V26-2 Senior Programmer Work-State Timeline',
  },
  {
    id: 'tool-permission-lifecycle',
    label: 'Tool / Permission Lifecycle',
    tokens: ['tool_runtime', 'permission_safety'],
    v26Owner: 'V26-4 Tool / Permission / Recovery Mainline',
  },
  {
    id: 'source-truth-coding',
    label: 'Source Truth / Coding Loop',
    tokens: ['coding_workflow'],
    v26Owner: 'V26-4 Source Truth Repair Loop',
  },
  {
    id: 'context-memory-recovery',
    label: 'Context / Memory / Recovery',
    tokens: ['memory_context', 'recovery_remote'],
    v26Owner: 'V26-2/V26-4 Long Task Recovery',
  },
  {
    id: 'model-cost-cache',
    label: 'Model / Cost / Cache',
    tokens: ['provider_model', 'telemetry_data'],
    v26Owner: 'V26-3 DeepSeek Runtime Excellence',
  },
  {
    id: 'mcp-skill-ecosystem',
    label: 'MCP / Skill / Ecosystem',
    tokens: ['plugin_mcp_skill'],
    v26Owner: 'V26-5 Ecosystem Compatibility Capability Pack',
  },
]

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
  const headers = header.map((key, index) => index === 0 ? key.replace(/^\uFEFF/, '') : key)
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

function groupCount<T extends Record<string, string>>(rows: readonly T[], key: keyof T): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const value = row[key] || '<empty>'
    counts[value] = (counts[value] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))
}

function splitSignals(row: CsvRow): string[] {
  return (row.experienceSignalCategories || row.primarySignal || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
}

function matchingLoops(row: CsvRow): LoopDefinition[] {
  const signals = new Set(splitSignals(row))
  return LOOP_DEFINITIONS.filter(loop => loop.tokens.some(token => signals.has(token)))
}

function numeric(row: CsvRow, key: string): number {
  const value = Number(row[key] || '0')
  return Number.isFinite(value) ? value : 0
}

function riskPriority(row: CsvRow, loopCount: number): 'P0' | 'P1' | 'P2' | 'P3' {
  const symbolSignals = numeric(row, 'auditSymbolSignals')
  const productSpecific = row.disposition === 'product_specific_adapt_or_exclude'
  const sharedBaseline = row.disposition === 'shared_utility_baseline_no_new_absorption'
  const referenceOnly = row.disposition === 'shared_utility_reference_only_no_absorption'
  const directPath = row.dsxuDirectPathExists === 'yes'
  if (productSpecific && directPath && loopCount >= 6 && symbolSignals >= 25) return 'P0'
  if (productSpecific && (directPath || loopCount >= 5 || symbolSignals >= 20)) return 'P1'
  if (sharedBaseline && (loopCount >= 5 || symbolSignals >= 20)) return 'P1'
  if (referenceOnly && (loopCount >= 3 || symbolSignals >= 10)) return 'P1'
  if (productSpecific || sharedBaseline || referenceOnly) return 'P2'
  return 'P3'
}

function requiredV26Action(row: CsvRow, loops: readonly LoopDefinition[], priority: string): string {
  const owner = loops.map(loop => loop.v26Owner).filter(Boolean).join('; ')
  if (row.disposition === 'product_specific_adapt_or_exclude') {
    return `${priority}: re-audit product-specific row; extract generic UX/recovery/telemetry mechanism into DSXU owner, exclude only brand/subscription/proprietary behavior; owners=${owner || row.finalOwnerPacket}`
  }
  if (row.disposition === 'shared_utility_baseline_no_new_absorption') {
    return `${priority}: verify baseline/no-new-absorption is truly behavior-equivalent; if not, move utility behavior into named DSXU owner; owners=${owner || row.finalOwnerPacket}`
  }
  if (row.disposition === 'shared_utility_reference_only_no_absorption') {
    return `${priority}: prove reference-only utility is not required for DSXU experience; otherwise implement DSXU-owned equivalent; owners=${owner || row.finalOwnerPacket}`
  }
  if (row.disposition === 'review_candidate_mapped_or_excluded') {
    return `${priority}: close review candidate with absorb/adapt/exclude/delete decision; owners=${owner || row.finalOwnerPacket}`
  }
  return `${priority}: keep as absorbed mainline only if import/use, tests, and live evidence remain valid; owners=${owner || row.finalOwnerPacket}`
}

function publicClaimStatus(row: CsvRow): string {
  if (row.disposition === 'absorbed_into_dsxu_mainline' && row.behaviorEvidenceStatus === 'OWNER_DISPOSITION_PLUS_OWNER_BEHAVIOR_EVIDENCE') {
    return 'CLAIMABLE_ONLY_WITH_EXISTING_OWNER_EVIDENCE'
  }
  if (row.disposition === 'product_specific_adapt_or_exclude') {
    return 'NOT_CLAIMABLE_UNTIL_GENERIC_MECHANISM_REVIEWED'
  }
  if (row.disposition.startsWith('shared_utility')) {
    return 'NOT_CLAIMABLE_AS_FEATURE_UNTIL_IMPORT_USE_OR_NO_LOSS_PROVEN'
  }
  return 'NOT_CLAIMABLE_UNTIL_OWNER_DECISION_CLOSED'
}

function mdTable(rows: Record<string, unknown>[], columns: string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => String(row[column] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n')
}

function takeTop(rows: CsvRow[], count: number): CsvRow[] {
  const rank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  return [...rows]
    .sort((a, b) => {
      const risk = (rank[a.riskPriority] ?? 9) - (rank[b.riskPriority] ?? 9)
      if (risk !== 0) return risk
      return Number(b.auditSymbolSignals || '0') - Number(a.auditSymbolSignals || '0')
    })
    .slice(0, count)
}

function ownerPriorityRows(rows: CsvRow[]): Array<Record<string, string>> {
  const byOwner = new Map<string, CsvRow[]>()
  for (const row of rows) {
    const owner = row.finalOwnerPacket || '<empty>'
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), row])
  }
  return [...byOwner.entries()]
    .map(([ownerPacket, ownerRows]) => {
      const count = (priority: string) => ownerRows.filter(row => row.riskPriority === priority).length
      return {
        ownerPacket,
        rows: String(ownerRows.length),
        p0: String(count('P0')),
        p1: String(count('P1')),
        p2: String(count('P2')),
        p3: String(count('P3')),
        productSpecific: String(ownerRows.filter(row => row.disposition === 'product_specific_adapt_or_exclude').length),
        sharedUtility: String(ownerRows.filter(row => row.disposition.startsWith('shared_utility')).length),
        blockedPublicClaim: String(ownerRows.filter(row => row.publicClaimStatus.startsWith('NOT_CLAIMABLE')).length),
      }
    })
    .sort((a, b) => {
      const p0 = Number(b.p0) - Number(a.p0)
      if (p0 !== 0) return p0
      const p1 = Number(b.p1) - Number(a.p1)
      if (p1 !== 0) return p1
      return Number(b.rows) - Number(a.rows)
    })
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const [joinCsvText, joinJsonText, loopJsonText] = await Promise.all([
    readFile(INPUT_C2_JOIN, 'utf8'),
    readFile(INPUT_C2_JOIN_JSON, 'utf8'),
    readFile(INPUT_C2_LOOP_JSON, 'utf8'),
  ])
  const joinRows = parseCsv(joinCsvText)
  const joinJson = JSON.parse(joinJsonText) as { counts?: Record<string, unknown> }
  const loopJson = JSON.parse(loopJsonText) as { status?: string; coverage?: Record<string, unknown> }

  const boardRows = joinRows.map(row => {
    const loops = matchingLoops(row)
    const priority = riskPriority(row, loops.length)
    return {
      referencePath: row.referencePath,
      disposition: row.disposition,
      finalOwnerPacket: row.finalOwnerPacket,
      dsxuOwner: row.dsxuOwner,
      dsxuDirectPath: row.dsxuDirectPath,
      dsxuDirectPathExists: row.dsxuDirectPathExists,
      capabilityLoops: loops.map(loop => loop.id).join(';'),
      capabilityLoopLabels: loops.map(loop => loop.label).join(';'),
      v26Owners: loops.map(loop => loop.v26Owner).join(';'),
      experienceSignalCategories: row.experienceSignalCategories,
      auditSymbolSignals: row.auditSymbolSignals,
      testEvidenceCount: row.testEvidenceCount,
      liveTuiApiEvidence: row.liveTuiApiEvidence,
      behaviorEvidenceStatus: row.behaviorEvidenceStatus,
      riskPriority: priority,
      publicClaimStatus: publicClaimStatus(row),
      requiredV26Action: requiredV26Action(row, loops, priority),
    }
  })

  const productSpecificRows = boardRows.filter(row => row.disposition === 'product_specific_adapt_or_exclude')
  const sharedRows = boardRows.filter(row => row.disposition.startsWith('shared_utility'))
  const highPriorityRows = boardRows.filter(row => row.riskPriority === 'P0' || row.riskPriority === 'P1')
  const blockedClaimRows = boardRows.filter(row => row.publicClaimStatus.startsWith('NOT_CLAIMABLE'))
  const directProductRows = productSpecificRows.filter(row => row.dsxuDirectPathExists === 'yes')

  const loopRows = LOOP_DEFINITIONS.map(loop => ({
    loop: loop.id,
    label: loop.label,
    v26Owner: loop.v26Owner,
    rows: String(boardRows.filter(row => row.capabilityLoops.split(';').includes(loop.id)).length),
    productSpecificRows: String(productSpecificRows.filter(row => row.capabilityLoops.split(';').includes(loop.id)).length),
    sharedUtilityRows: String(sharedRows.filter(row => row.capabilityLoops.split(';').includes(loop.id)).length),
  }))
  const ownerMatrix = ownerPriorityRows(boardRows)
  const nextOwnerSlices = ownerMatrix
    .filter(row => Number(row.p0) + Number(row.p1) > 0)
    .slice(0, 8)

  const summary = {
    schemaVersion: 'dsxu.v26.c2-capability-loss-board.v1',
    generatedAt: new Date().toISOString(),
    status: 'OPEN_V26_C2_CAPABILITY_LOSS_REVIEW_REQUIRED',
    inputs: {
      c2JoinCsv: INPUT_C2_JOIN,
      c2JoinJson: INPUT_C2_JOIN_JSON,
      c2LoopJson: INPUT_C2_LOOP_JSON,
    },
    outputs: {
      json: OUT_JSON,
      csv: OUT_CSV,
      markdown: OUT_MD,
    },
    totals: {
      rows: boardRows.length,
      productSpecificRows: productSpecificRows.length,
      productSpecificRowsWithDirectDsxuPath: directProductRows.length,
      sharedUtilityRows: sharedRows.length,
      highPriorityReviewRows: highPriorityRows.length,
      blockedPublicClaimRows: blockedClaimRows.length,
      c2LoopStatus: loopJson.status,
      c2LoopPassedRows: loopJson.coverage?.passedRows,
      v24JoinDispositionCounts: joinJson.counts?.byDisposition,
    },
    counts: {
      byDisposition: groupCount(boardRows, 'disposition'),
      byOwnerPacket: groupCount(boardRows, 'finalOwnerPacket'),
      byRiskPriority: groupCount(boardRows, 'riskPriority'),
      byPublicClaimStatus: groupCount(boardRows, 'publicClaimStatus'),
    },
    capabilityLoops: loopRows,
    ownerPriorityMatrix: ownerMatrix,
    nextOwnerSlices,
    topHighPriorityRows: takeTop(highPriorityRows, 40),
    rule: 'This board is a V26 execution input. It does not claim reference feature parity. It identifies where product-specific or shared-utility rows must be re-audited so DSXU can absorb generic senior-programmer experience without copying code, names, branding, or proprietary behavior.',
    nextAction: 'Execute P0/P1 rows by V26 owner: visible work-state, tool/permission lifecycle, source-truth repair loop, DeepSeek runtime, MCP/skill ecosystem, and long-task recovery.',
  }

  await writeFile(OUT_CSV, toCsv(boardRows), 'utf8')
  await writeFile(OUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  const md = [
    `# DSXU V26 C2 Capability Loss Board - ${DATE}`,
    '',
    `Status: ${summary.status}`,
    '',
    '## Why This Exists',
    '',
    'V26 must not treat C2 1902 owner-disposition as feature parity. This board turns the 1902-file join into an execution queue for capability-loss review: product-specific rows, shared utilities, and review candidates are mapped to DSXU owners, capability loops, public claim status, and required V26 actions.',
    '',
    '## Summary',
    '',
    mdTable([
      { key: 'rows', value: summary.totals.rows },
      { key: 'productSpecificRows', value: summary.totals.productSpecificRows },
      { key: 'productSpecificRowsWithDirectDsxuPath', value: summary.totals.productSpecificRowsWithDirectDsxuPath },
      { key: 'sharedUtilityRows', value: summary.totals.sharedUtilityRows },
      { key: 'highPriorityReviewRows', value: summary.totals.highPriorityReviewRows },
      { key: 'blockedPublicClaimRows', value: summary.totals.blockedPublicClaimRows },
      { key: 'c2LoopStatus', value: summary.totals.c2LoopStatus },
      { key: 'c2LoopPassedRows', value: String(summary.totals.c2LoopPassedRows ?? '') },
    ], ['key', 'value']),
    '',
    '## By Risk Priority',
    '',
    mdTable(Object.entries(summary.counts.byRiskPriority).map(([priority, count]) => ({ priority, count })), ['priority', 'count']),
    '',
    '## By Public Claim Status',
    '',
    mdTable(Object.entries(summary.counts.byPublicClaimStatus).map(([status, count]) => ({ status, count })), ['status', 'count']),
    '',
    '## Capability Loop Coverage',
    '',
    mdTable(loopRows, ['loop', 'label', 'v26Owner', 'rows', 'productSpecificRows', 'sharedUtilityRows']),
    '',
    '## Owner Priority Matrix',
    '',
    mdTable(ownerMatrix, ['ownerPacket', 'rows', 'p0', 'p1', 'p2', 'p3', 'productSpecific', 'sharedUtility', 'blockedPublicClaim']),
    '',
    '## Next Owner Slices',
    '',
    mdTable(nextOwnerSlices, ['ownerPacket', 'rows', 'p0', 'p1', 'productSpecific', 'sharedUtility', 'blockedPublicClaim']),
    '',
    '## Top P0/P1 Review Rows',
    '',
    mdTable(
      summary.topHighPriorityRows.slice(0, 20).map(row => ({
        priority: row.riskPriority,
        referencePath: row.referencePath,
        disposition: row.disposition,
        owner: row.finalOwnerPacket,
        loops: row.capabilityLoops,
        publicClaimStatus: row.publicClaimStatus,
      })),
      ['priority', 'referencePath', 'disposition', 'owner', 'loops', 'publicClaimStatus'],
    ),
    '',
    '## Rules',
    '',
    '- Do not copy reference source, prompt text, UI copy, brand names, or commercial logic.',
    '- Product-specific rows can only contribute generic DSXU mechanisms after owner review.',
    '- Shared utility baseline/no-op rows must prove no DSXU behavior loss; otherwise implement a DSXU-owned equivalent.',
    '- Public GitHub claims can only cite rows with DSXU implementation, tests, and live/TUI/API evidence.',
    '',
    '## Files',
    '',
    `- CSV: ${OUT_CSV}`,
    `- JSON: ${OUT_JSON}`,
  ].join('\n')
  await writeFile(OUT_MD, `${md}\n`, 'utf8')

  console.log(JSON.stringify({
    status: summary.status,
    rows: summary.totals.rows,
    productSpecificRows: summary.totals.productSpecificRows,
    productSpecificRowsWithDirectDsxuPath: summary.totals.productSpecificRowsWithDirectDsxuPath,
    sharedUtilityRows: summary.totals.sharedUtilityRows,
    highPriorityReviewRows: summary.totals.highPriorityReviewRows,
    blockedPublicClaimRows: summary.totals.blockedPublicClaimRows,
    outJson: OUT_JSON,
    outCsv: OUT_CSV,
    outMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
