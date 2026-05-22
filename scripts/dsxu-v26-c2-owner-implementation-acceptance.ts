import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type CsvRow = Record<string, string>

type AcceptanceDecision =
  | 'implemented+tested'
  | 'adapted/excluded'
  | 'no-loss baseline'
  | 'needs real code/test'

type LoopDefinition = {
  id: string
  label: string
  acceptanceOwner: string
}

const ROOT = process.cwd()
const DATE = '20260515'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const INPUT_BOARD_CSV = join(GENERATED_DIR, `DSXU_V26_C2_CAPABILITY_LOSS_BOARD_${DATE}.csv`)
const INPUT_BOARD_JSON = join(GENERATED_DIR, `DSXU_V26_C2_CAPABILITY_LOSS_BOARD_${DATE}.json`)
const INPUT_SIGNOFF_CSV = join(GENERATED_DIR, `DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_${DATE}.csv`)
const INPUT_SIGNOFF_JSON = join(GENERATED_DIR, `DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_SUMMARY_${DATE}.json`)
const INPUT_PUBLIC_CLAIM_JSON = join(GENERATED_DIR, `DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_${DATE}.md`)

const LOOP_ORDER: readonly LoopDefinition[] = [
  {
    id: 'visible-work-state',
    label: 'Visible Work-State',
    acceptanceOwner: 'V26-2 Senior Programmer Work-State Timeline',
  },
  {
    id: 'tool-permission-lifecycle',
    label: 'Tool/Permission',
    acceptanceOwner: 'V26-4 Tool / Permission / Recovery Mainline',
  },
  {
    id: 'source-truth-coding',
    label: 'Source Truth Repair',
    acceptanceOwner: 'V26-4 Source Truth Repair Loop',
  },
  {
    id: 'model-cost-cache',
    label: 'DeepSeek Runtime',
    acceptanceOwner: 'V26-3 DeepSeek Runtime Excellence',
  },
  {
    id: 'context-memory-recovery',
    label: 'Context Recovery',
    acceptanceOwner: 'V26-2/V26-4 Long Task Recovery',
  },
  {
    id: 'mcp-skill-ecosystem',
    label: 'MCP/Skill Ecosystem',
    acceptanceOwner: 'V26-5 Ecosystem Compatibility Capability Pack',
  },
]

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
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
  const headers = header.map((key, index) => index === 0 ? stripBom(key) : key)
  return dataRows
    .filter(cells => cells.some(cell => cell.length > 0))
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

async function readJson(path: string): Promise<Record<string, any>> {
  return JSON.parse(stripBom(await readFile(path, 'utf8'))) as Record<string, any>
}

function groupCount(rows: readonly CsvRow[], key: string): Record<string, number> {
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

function indexedByReference(rows: CsvRow[]): Map<string, CsvRow> {
  const map = new Map<string, CsvRow>()
  for (const row of rows) {
    map.set(row.claudePath || row.referencePath, row)
  }
  return map
}

function hasEvidence(row: CsvRow): boolean {
  return Number(row.testEvidenceCount || '0') > 0 && Boolean(row.liveTuiApiEvidence)
}

function decisionFromFinalSignoff(boardRow: CsvRow, signoff: CsvRow | undefined): AcceptanceDecision {
  if (!signoff) return 'needs real code/test'
  if (!hasEvidence(boardRow)) return 'needs real code/test'
  switch (signoff.finalDecision) {
    case 'C2_MAINLINE_ABSORPTION_SIGNED_BY_NAMED_OWNER':
    case 'C2_SHARED_UTILITY_KEEP_WITH_IMPORT_USE_EVIDENCE':
    case 'C2_REVIEW_CANDIDATE_MAPPED_TO_NAMED_OWNER':
      return 'implemented+tested'
    case 'C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED':
    case 'C2_REVIEW_CANDIDATE_EXCLUDED_OR_ADAPTED_BY_OWNER':
      return 'adapted/excluded'
    case 'C2_SHARED_UTILITY_BASELINE_PRESENT_NO_NEW_ABSORPTION':
    case 'C2_SHARED_UTILITY_NOT_IMPORTED_TO_DSXU_NO_ABSORPTION':
      return 'no-loss baseline'
    default:
      return 'needs real code/test'
  }
}

function acceptanceReason(decision: AcceptanceDecision, boardRow: CsvRow, signoff: CsvRow | undefined): string {
  if (!signoff) return 'missing final owner signoff; must not be claimed or treated as implemented.'
  if (!hasEvidence(boardRow)) return 'missing test or live/TUI/API evidence; requires real implementation verification.'
  switch (decision) {
    case 'implemented+tested':
      return 'named DSXU owner has behavior evidence, test evidence, and live/TUI/API evidence; this is DSXU implementation evidence, not reference parity.'
    case 'adapted/excluded':
      return 'product-specific, branded, subscription, commercial, or reference-only behavior is excluded/adapted; only DSXU-owned generic mechanisms may be cited.'
    case 'no-loss baseline':
      return 'shared utility is signed as baseline/no-new-absorption or reference-only no-loss; it must not be sold as a new product feature.'
    case 'needs real code/test':
      return 'requires real DSXU code/test/live evidence before owner acceptance.'
  }
}

function loopsFor(row: CsvRow): string[] {
  return row.capabilityLoops.split(';').map(item => item.trim()).filter(Boolean)
}

function loopSummary(rows: CsvRow[]): Array<Record<string, string | number>> {
  return LOOP_ORDER.map(loop => {
    const loopRows = rows.filter(row => loopsFor(row).includes(loop.id))
    return {
      loop: loop.label,
      acceptanceOwner: loop.acceptanceOwner,
      rows: loopRows.length,
      implementedTested: loopRows.filter(row => row.acceptanceDecision === 'implemented+tested').length,
      adaptedExcluded: loopRows.filter(row => row.acceptanceDecision === 'adapted/excluded').length,
      noLossBaseline: loopRows.filter(row => row.acceptanceDecision === 'no-loss baseline').length,
      needsRealCodeTest: loopRows.filter(row => row.acceptanceDecision === 'needs real code/test').length,
      p0: loopRows.filter(row => row.riskPriority === 'P0').length,
      p1: loopRows.filter(row => row.riskPriority === 'P1').length,
      blockedPublicClaim: loopRows.filter(row => row.priorPublicClaimStatus.startsWith('NOT_CLAIMABLE')).length,
    }
  })
}

function ownerSummary(rows: CsvRow[]): Array<Record<string, string | number>> {
  const byOwner = new Map<string, CsvRow[]>()
  for (const row of rows) {
    const owner = row.ownerPacket || '<empty>'
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), row])
  }
  return [...byOwner.entries()]
    .map(([ownerPacket, ownerRows]) => ({
      ownerPacket,
      rows: ownerRows.length,
      p0: ownerRows.filter(row => row.riskPriority === 'P0').length,
      p1: ownerRows.filter(row => row.riskPriority === 'P1').length,
      blockedPublicClaim: ownerRows.filter(row => row.priorPublicClaimStatus.startsWith('NOT_CLAIMABLE')).length,
      implementedTested: ownerRows.filter(row => row.acceptanceDecision === 'implemented+tested').length,
      adaptedExcluded: ownerRows.filter(row => row.acceptanceDecision === 'adapted/excluded').length,
      noLossBaseline: ownerRows.filter(row => row.acceptanceDecision === 'no-loss baseline').length,
      needsRealCodeTest: ownerRows.filter(row => row.acceptanceDecision === 'needs real code/test').length,
    }))
    .sort((a, b) => {
      const needs = Number(b.needsRealCodeTest) - Number(a.needsRealCodeTest)
      if (needs !== 0) return needs
      const p0 = Number(b.p0) - Number(a.p0)
      if (p0 !== 0) return p0
      return Number(b.p1) - Number(a.p1)
    })
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const [boardCsvText, boardJson, signoffCsvText, signoffJson, publicClaimJson] = await Promise.all([
    readFile(INPUT_BOARD_CSV, 'utf8'),
    readJson(INPUT_BOARD_JSON),
    readFile(INPUT_SIGNOFF_CSV, 'utf8'),
    readJson(INPUT_SIGNOFF_JSON),
    readJson(INPUT_PUBLIC_CLAIM_JSON),
  ])
  const boardRows = parseCsv(boardCsvText)
  const signoffRows = parseCsv(signoffCsvText)
  const signoffByReference = indexedByReference(signoffRows)
  const acceptanceRows = boardRows.map(row => {
    const signoff = signoffByReference.get(row.referencePath)
    const acceptanceDecision = decisionFromFinalSignoff(row, signoff)
    return {
      referencePath: row.referencePath,
      ownerPacket: row.finalOwnerPacket,
      dsxuOwner: row.dsxuOwner,
      dsxuDirectPath: row.dsxuDirectPath,
      dsxuDirectPathExists: row.dsxuDirectPathExists,
      disposition: row.disposition,
      riskPriority: row.riskPriority,
      priorPublicClaimStatus: row.publicClaimStatus,
      finalDecision: signoff?.finalDecision ?? '',
      closureState: signoff?.closureState ?? '',
      acceptanceDecision,
      acceptanceReason: acceptanceReason(acceptanceDecision, row, signoff),
      capabilityLoops: row.capabilityLoops,
      testEvidenceCount: row.testEvidenceCount,
      liveTuiApiEvidence: row.liveTuiApiEvidence,
      publicClaimBoundary: acceptanceDecision === 'implemented+tested'
        ? 'claim DSXU-owned generic mechanism only with owner/test/live evidence.'
        : 'do not claim as reference feature parity.',
    }
  })
  const needsRows = acceptanceRows.filter(row => row.acceptanceDecision === 'needs real code/test')
  const summary = {
    schemaVersion: 'dsxu.v26.c2-owner-implementation-acceptance.v1',
    generatedAt: new Date().toISOString(),
    status: needsRows.length === 0
      ? 'PASS_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_DECISIONS_CLOSED'
      : 'OPEN_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_NEEDS_CODE_OR_TEST',
    inputs: {
      capabilityLossBoardCsv: INPUT_BOARD_CSV,
      capabilityLossBoardJson: INPUT_BOARD_JSON,
      finalSignoffCsv: INPUT_SIGNOFF_CSV,
      finalSignoffSummary: INPUT_SIGNOFF_JSON,
      publicClaimClosure: INPUT_PUBLIC_CLAIM_JSON,
    },
    outputs: {
      json: OUT_JSON,
      csv: OUT_CSV,
      markdown: OUT_MD,
    },
    gates: {
      finalSignoffPass: signoffJson.unresolvedRows === 0 && signoffJson.remainingReviewCandidateBuckets === 0,
      publicClaimBoundaryClosed: publicClaimJson.status === 'PASS_C2_PUBLIC_CLAIM_BOUNDARY_CLOSED',
      referenceFeatureParityClaimAllowed: false,
      ownerImplementationAcceptanceDecisionsClosed: needsRows.length === 0,
      public95ClaimAllowed: false,
    },
    totals: {
      rows: acceptanceRows.length,
      implementedTestedRows: acceptanceRows.filter(row => row.acceptanceDecision === 'implemented+tested').length,
      adaptedExcludedRows: acceptanceRows.filter(row => row.acceptanceDecision === 'adapted/excluded').length,
      noLossBaselineRows: acceptanceRows.filter(row => row.acceptanceDecision === 'no-loss baseline').length,
      needsRealCodeTestRows: needsRows.length,
      p0Rows: acceptanceRows.filter(row => row.riskPriority === 'P0').length,
      p1Rows: acceptanceRows.filter(row => row.riskPriority === 'P1').length,
      priorBlockedPublicClaimRows: acceptanceRows.filter(row => row.priorPublicClaimStatus.startsWith('NOT_CLAIMABLE')).length,
      publicClaimClosureStatus: publicClaimJson.status,
      capabilityLossBoardStatus: boardJson.status,
    },
    counts: {
      byAcceptanceDecision: groupCount(acceptanceRows, 'acceptanceDecision'),
      byOwnerPacket: groupCount(acceptanceRows, 'ownerPacket'),
      byRiskPriority: groupCount(acceptanceRows, 'riskPriority'),
      byFinalDecision: groupCount(acceptanceRows, 'finalDecision'),
    },
    loopAcceptanceOrder: loopSummary(acceptanceRows),
    ownerAcceptanceMatrix: ownerSummary(acceptanceRows),
    rules: [
      'Every row must resolve to exactly one of: implemented+tested, adapted/excluded, no-loss baseline, needs real code/test.',
      'implemented+tested means DSXU owner evidence exists; it does not mean reference-product feature parity.',
      'adapted/excluded rows must not copy product-specific source, prompts, UI copy, brand, subscription, or commercial behavior.',
      'no-loss baseline rows may not be marketed as new product features.',
      'public95ClaimAllowed remains false until fixed public raw benchmark and same-task external/target raw evidence raise the score floor to 95 or higher.',
    ],
    nextAction: needsRows.length === 0
      ? 'Proceed to public benchmark truth: fixed raw live tasks and same-task target/reference raw transcripts before any public 95 or superiority claim.'
      : 'Implement and test needs real code/test rows by loop order: Visible Work-State, Tool/Permission, Source Truth Repair, DeepSeek Runtime, Context Recovery, MCP/Skill Ecosystem.',
  }

  await writeFile(OUT_CSV, toCsv(acceptanceRows), 'utf8')
  await writeFile(OUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  const md = [
    `# DSXU V26 C2 Owner Implementation Acceptance - ${DATE}`,
    '',
    `Status: ${summary.status}`,
    '',
    '## Purpose',
    '',
    'This board is stricter than the public-claim closure. It assigns every C2 1902 reference-file row to exactly one owner acceptance decision: implemented+tested, adapted/excluded, no-loss baseline, or needs real code/test. Passing this board does not permit reference-product feature parity claims.',
    '',
    '## Gates',
    '',
    mdTable(Object.entries(summary.gates).map(([key, value]) => ({ key, value })), ['key', 'value']),
    '',
    '## Totals',
    '',
    mdTable(Object.entries(summary.totals).map(([key, value]) => ({ key, value })), ['key', 'value']),
    '',
    '## Acceptance Decisions',
    '',
    mdTable(Object.entries(summary.counts.byAcceptanceDecision).map(([decision, rows]) => ({ decision, rows })), ['decision', 'rows']),
    '',
    '## Loop Acceptance Order',
    '',
    mdTable(summary.loopAcceptanceOrder, ['loop', 'acceptanceOwner', 'rows', 'implementedTested', 'adaptedExcluded', 'noLossBaseline', 'needsRealCodeTest', 'p0', 'p1', 'blockedPublicClaim']),
    '',
    '## Owner Acceptance Matrix',
    '',
    mdTable(summary.ownerAcceptanceMatrix, ['ownerPacket', 'rows', 'p0', 'p1', 'blockedPublicClaim', 'implementedTested', 'adaptedExcluded', 'noLossBaseline', 'needsRealCodeTest']),
    '',
    '## Rules',
    '',
    ...summary.rules.map(rule => `- ${rule}`),
    '',
    '## Next Action',
    '',
    summary.nextAction,
    '',
    '## Files',
    '',
    `- JSON: ${OUT_JSON}`,
    `- CSV: ${OUT_CSV}`,
  ].join('\n')
  await writeFile(OUT_MD, `${md}\n`, 'utf8')

  console.log(JSON.stringify({
    status: summary.status,
    rows: summary.totals.rows,
    implementedTestedRows: summary.totals.implementedTestedRows,
    adaptedExcludedRows: summary.totals.adaptedExcludedRows,
    noLossBaselineRows: summary.totals.noLossBaselineRows,
    needsRealCodeTestRows: summary.totals.needsRealCodeTestRows,
    public95ClaimAllowed: summary.gates.public95ClaimAllowed,
    outJson: OUT_JSON,
    outMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
