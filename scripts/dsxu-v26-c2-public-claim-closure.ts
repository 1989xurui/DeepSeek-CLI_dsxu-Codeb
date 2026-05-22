import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type CsvRow = Record<string, string>

const ROOT = process.cwd()
const DATE = '20260515'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const INPUT_BOARD_CSV = join(GENERATED_DIR, `DSXU_V26_C2_CAPABILITY_LOSS_BOARD_${DATE}.csv`)
const INPUT_BOARD_JSON = join(GENERATED_DIR, `DSXU_V26_C2_CAPABILITY_LOSS_BOARD_${DATE}.json`)
const INPUT_FINAL_SIGNOFF_CSV = join(GENERATED_DIR, `DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_${DATE}.csv`)
const INPUT_FINAL_SIGNOFF_JSON = join(GENERATED_DIR, `DSXU_V20_C2_FINAL_ABSORPTION_SIGNOFF_SUMMARY_${DATE}.json`)
const INPUT_LOOP_ACCEPTANCE_JSON = join(GENERATED_DIR, `DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_${DATE}.json`)
const INPUT_DENSITY_JSON = join(GENERATED_DIR, `DSXU_V24_CLAUDE_EXPERIENCE_DENSITY_REBASELINE_${DATE}.json`)
const OUT_JSON = join(GENERATED_DIR, `DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_${DATE}.md`)

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

function closureDecision(row: CsvRow, signoff: CsvRow | undefined): { state: string; publicClaimBoundary: string; reason: string } {
  const finalDecision = signoff?.finalDecision ?? ''
  const closureState = signoff?.closureState ?? ''
  if (finalDecision === 'C2_PRODUCT_SPECIFIC_REFERENCE_EXCLUDED_OR_ADAPTED') {
    return {
      state: 'CLOSED_PRODUCT_SPECIFIC_EXCLUDED_OR_DSXU_ADAPTED',
      publicClaimBoundary: 'May cite only DSXU-owned generic experience loop evidence, never reference-product parity.',
      reason: closureState || 'product-specific reference behavior was signed as exclude/adapt, not copied runtime.',
    }
  }
  if (finalDecision === 'C2_SHARED_UTILITY_KEEP_WITH_IMPORT_USE_EVIDENCE') {
    return {
      state: 'CLOSED_SHARED_UTILITY_IMPORTED_KEEP',
      publicClaimBoundary: 'May cite DSXU shared utility only through import/use and owner evidence.',
      reason: closureState || 'shared utility has import/use retention evidence.',
    }
  }
  if (finalDecision === 'C2_SHARED_UTILITY_BASELINE_PRESENT_NO_NEW_ABSORPTION') {
    return {
      state: 'CLOSED_SHARED_UTILITY_BASELINE_NO_LOSS',
      publicClaimBoundary: 'May not cite as new feature; closed only as no-loss baseline evidence.',
      reason: closureState || 'baseline/no-op utility does not create a new DSXU feature claim.',
    }
  }
  if (finalDecision === 'C2_SHARED_UTILITY_NOT_IMPORTED_TO_DSXU_NO_ABSORPTION') {
    return {
      state: 'CLOSED_SHARED_UTILITY_REFERENCE_ONLY_NO_LOSS',
      publicClaimBoundary: 'May not cite as feature; reference-only utility remains explicitly excluded.',
      reason: closureState || 'reference-only utility not required by DSXU product behavior.',
    }
  }
  if (finalDecision === 'C2_REVIEW_CANDIDATE_EXCLUDED_OR_ADAPTED_BY_OWNER') {
    return {
      state: 'CLOSED_REVIEW_CANDIDATE_EXCLUDED_OR_ADAPTED',
      publicClaimBoundary: 'May cite only the named DSXU owner behavior, not reference feature parity.',
      reason: closureState || 'review candidate closed by owner exclusion/adaptation.',
    }
  }
  if (finalDecision === 'C2_REVIEW_CANDIDATE_MAPPED_TO_NAMED_OWNER') {
    return {
      state: 'CLOSED_REVIEW_CANDIDATE_NAMED_OWNER',
      publicClaimBoundary: 'May cite only after the named DSXU owner evidence is referenced.',
      reason: closureState || 'review candidate mapped to named owner instead of unknown bucket.',
    }
  }
  return {
    state: 'OPEN_UNMATCHED_SIGNOFF',
    publicClaimBoundary: 'Not public-claimable until matched to final C2 signoff.',
    reason: `no matching final signoff for ${row.referencePath}`,
  }
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const [boardCsvText, boardJson, signoffCsvText, signoffSummary, loopAcceptance, density] = await Promise.all([
    readFile(INPUT_BOARD_CSV, 'utf8'),
    readJson(INPUT_BOARD_JSON),
    readFile(INPUT_FINAL_SIGNOFF_CSV, 'utf8'),
    readJson(INPUT_FINAL_SIGNOFF_JSON),
    readJson(INPUT_LOOP_ACCEPTANCE_JSON),
    readJson(INPUT_DENSITY_JSON),
  ])

  const boardRows = parseCsv(boardCsvText)
  const signoffRows = parseCsv(signoffCsvText)
  const signoffByReference = indexedByReference(signoffRows)
  const loopAcceptancePass =
    loopAcceptance.status === 'PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH' &&
    loopAcceptance.coverage?.passedRows === 51 &&
    loopAcceptance.coverage?.openRows === 0
  const finalSignoffPass =
    signoffSummary.unresolvedRows === 0 &&
    signoffSummary.remainingReviewCandidateBuckets === 0 &&
    signoffSummary.total === 1902
  const densityNoLowerThanReference = Array.isArray(density.categoryRows) &&
    density.categoryRows.every((row: Record<string, unknown>) => Number(row.dsxuFileHits ?? 0) >= Number(row.claudeFileHits ?? 0))

  const blockedRows = boardRows.filter(row => row.publicClaimStatus.startsWith('NOT_CLAIMABLE'))
  const closureRows = blockedRows.map(row => {
    const signoff = signoffByReference.get(row.referencePath)
    const decision = closureDecision(row, signoff)
    const isClosed = finalSignoffPass && loopAcceptancePass && decision.state.startsWith('CLOSED_')
    return {
      referencePath: row.referencePath,
      ownerPacket: row.finalOwnerPacket,
      riskPriority: row.riskPriority,
      disposition: row.disposition,
      priorPublicClaimStatus: row.publicClaimStatus,
      finalDecision: signoff?.finalDecision ?? '',
      closureState: signoff?.closureState ?? '',
      v26ClosureState: isClosed ? decision.state : 'OPEN_REQUIRES_OWNER_REVIEW',
      publicClaimBoundary: decision.publicClaimBoundary,
      reason: decision.reason,
      capabilityLoops: row.capabilityLoops,
      liveTuiApiEvidence: row.liveTuiApiEvidence,
    }
  })
  const openRows = closureRows.filter(row => row.v26ClosureState.startsWith('OPEN_'))
  const closedRows = closureRows.filter(row => row.v26ClosureState.startsWith('CLOSED_'))

  const report = {
    schemaVersion: 'dsxu.v26.c2-public-claim-closure.v1',
    generatedAt: new Date().toISOString(),
    status: openRows.length === 0 && loopAcceptancePass && finalSignoffPass
      ? 'PASS_C2_PUBLIC_CLAIM_BOUNDARY_CLOSED'
      : 'OPEN_C2_PUBLIC_CLAIM_BOUNDARY_REVIEW_REQUIRED',
    inputs: {
      capabilityLossBoardCsv: INPUT_BOARD_CSV,
      capabilityLossBoardJson: INPUT_BOARD_JSON,
      finalSignoffCsv: INPUT_FINAL_SIGNOFF_CSV,
      finalSignoffSummary: INPUT_FINAL_SIGNOFF_JSON,
      loopAcceptance: INPUT_LOOP_ACCEPTANCE_JSON,
      densityRebaseline: INPUT_DENSITY_JSON,
    },
    outputs: {
      json: OUT_JSON,
      csv: OUT_CSV,
      markdown: OUT_MD,
    },
    gates: {
      finalSignoffPass,
      loopAcceptancePass,
      densityNoLowerThanReference,
      referenceFeatureParityClaimAllowed: false,
      dsxuGenericExperienceClaimAllowed: openRows.length === 0 && loopAcceptancePass && finalSignoffPass,
    },
    totals: {
      boardRows: boardRows.length,
      priorBlockedPublicClaimRows: blockedRows.length,
      closedPublicClaimBoundaryRows: closedRows.length,
      openPublicClaimBoundaryRows: openRows.length,
    },
    counts: {
      byV26ClosureState: groupCount(closureRows, 'v26ClosureState'),
      byOwnerPacket: groupCount(closureRows, 'ownerPacket'),
      byRiskPriority: groupCount(closureRows, 'riskPriority'),
      byFinalDecision: groupCount(closureRows, 'finalDecision'),
    },
    rules: [
      'This closes C2 public-claim boundaries, not reference-product feature parity.',
      'DSXU may claim DSXU-owned generic experience loops only when loop acceptance, final signoff, and owner evidence are cited.',
      'Product-specific, branded, subscription, marketplace, or proprietary reference behavior remains excluded/adapted and must not be copied.',
      'Shared utilities may be cited only as imported DSXU helpers or no-loss baseline evidence according to final owner signoff.',
    ],
    remainingForFinal95: [
      ...(openRows.length > 0 ? ['close unmatched C2 public-claim boundary rows'] : []),
      'public challenge scoreFloor >= 95 with fixed raw task data',
      'same-task external/target raw transcript evidence before any superiority claim',
    ],
  }

  await writeFile(OUT_CSV, toCsv(closureRows), 'utf8')
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const topOwners = Object.entries(report.counts.byOwnerPacket)
    .map(([ownerPacket, rows]) => ({ ownerPacket, rows }))
    .slice(0, 12)
  const md = [
    `# DSXU V26 C2 Public Claim Closure - ${DATE}`,
    '',
    `Status: ${report.status}`,
    '',
    '## Purpose',
    '',
    'This file closes the V26 C2 public-claim boundary without claiming reference-product parity. It converts rows that were previously blocked from public claims into explicit DSXU-owned boundaries: generic experience-loop evidence may be cited; reference source, brand, proprietary behavior, subscription logic, and product-specific runtime behavior may not.',
    '',
    '## Gates',
    '',
    mdTable(Object.entries(report.gates).map(([key, value]) => ({ key, value })), ['key', 'value']),
    '',
    '## Totals',
    '',
    mdTable(Object.entries(report.totals).map(([key, value]) => ({ key, value })), ['key', 'value']),
    '',
    '## Closure States',
    '',
    mdTable(Object.entries(report.counts.byV26ClosureState).map(([state, rows]) => ({ state, rows })), ['state', 'rows']),
    '',
    '## Top Owner Packets',
    '',
    mdTable(topOwners, ['ownerPacket', 'rows']),
    '',
    '## Rules',
    '',
    ...report.rules.map(rule => `- ${rule}`),
    '',
    '## Remaining Final-95 Gates',
    '',
    ...report.remainingForFinal95.map(item => `- ${item}`),
    '',
    '## Files',
    '',
    `- JSON: ${OUT_JSON}`,
    `- CSV: ${OUT_CSV}`,
  ].join('\n')
  await writeFile(OUT_MD, `${md}\n`, 'utf8')

  console.log(JSON.stringify({
    status: report.status,
    priorBlockedPublicClaimRows: report.totals.priorBlockedPublicClaimRows,
    closedPublicClaimBoundaryRows: report.totals.closedPublicClaimBoundaryRows,
    openPublicClaimBoundaryRows: report.totals.openPublicClaimBoundaryRows,
    referenceFeatureParityClaimAllowed: report.gates.referenceFeatureParityClaimAllowed,
    dsxuGenericExperienceClaimAllowed: report.gates.dsxuGenericExperienceClaimAllowed,
    outJson: OUT_JSON,
    outMd: OUT_MD,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
