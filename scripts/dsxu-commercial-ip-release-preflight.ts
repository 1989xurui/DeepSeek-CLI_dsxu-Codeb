import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const SCAN_SUMMARY_PATH = join(GENERATED_DIR, 'DSXU_V20_COMMERCIAL_IP_BRAND_SCAN_SUMMARY_20260515.json')
const ADJUDICATION_SUMMARY_PATH = join(GENERATED_DIR, 'DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_SUMMARY_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_COMMERCIAL_IP_RELEASE_PREFLIGHT_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_COMMERCIAL_IP_RELEASE_PREFLIGHT_20260515.csv')

type GateRow = {
  gate: string
  status: string
  count: number
  nextAction: string
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
}

function numberFromJson(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

async function main(): Promise<void> {
  const [scan, adjudication] = await Promise.all([
    readJson(SCAN_SUMMARY_PATH),
    readJson(ADJUDICATION_SUMMARY_PATH),
  ])
  const activeReviewRequiredRows = numberFromJson(adjudication.activeReviewRequiredRows)
  const publicReleaseThirdPartyRows = numberFromJson(scan.publicReleaseThirdPartyRows)
  const gates: GateRow[] = [
    {
      gate: 'active-review-required',
      status: activeReviewRequiredRows === 0 ? 'PASS_ADJUDICATED_ZERO' : 'BLOCKED',
      count: activeReviewRequiredRows,
      nextAction: activeReviewRequiredRows === 0 ? 'keep release copy neutral' : 'adjudicate remaining active source rows',
    },
    {
      gate: 'public-release-third-party',
      status: publicReleaseThirdPartyRows === 0 ? 'PASS_ZERO_PUBLIC_THIRD_PARTY_ROWS' : 'BLOCKED',
      count: publicReleaseThirdPartyRows,
      nextAction: publicReleaseThirdPartyRows === 0 ? 'final notice review still required' : 'rewrite public release docs',
    },
    {
      gate: 'notice-and-license-review',
      status: 'PENDING_FINAL_RELEASE_NOTICE_REVIEW',
      count: 1,
      nextAction: 'review license/vendor notices/package metadata during final preflight',
    },
  ]
  const blockers = gates
    .filter(row => row.status === 'BLOCKED' || row.status.includes('PENDING'))
    .map(row => `${row.gate}: ${row.nextAction}`)
  const report = {
    schemaVersion: 'dsxu.v20.commercial-ip-release-preflight.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: blockers.some(item => item.includes('BLOCKED'))
      ? 'BLOCKED'
      : 'ADJUDICATED_ACTIVE_BLOCKERS_0_RELEASE_NOTICE_PENDING',
    scannedFiles: scan.scannedFiles,
    scanRows: scan.totalRows,
    reviewRequiredRows: scan.reviewRequiredRows,
    publicReleaseThirdPartyRows,
    adjudicatedSourceRows: adjudication.scannedSourceRows,
    activeReviewRequiredRows,
    productCopyNeutralizedThisRound: adjudication.productCopyNeutralizedThisRound,
    inlineSourceMapsRemoved: adjudication.inlineSourceMapsRemoved,
    didRewriteSource: false,
    gates,
    blockers,
    nextAction: 'perform final release notice/license/package metadata review after owner/Git and P12 gates close',
    rule: 'This is release hygiene evidence, not legal advice or patent clearance. It does not rewrite source or create export artifacts.',
  }
  const headers = ['gate', 'status', 'count', 'nextAction']
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(
      OUTPUT_CSV_PATH,
      [
        headers.map(csvEscape).join(','),
        ...gates.map(row => headers.map(header => csvEscape(row[header as keyof GateRow])).join(',')),
      ].join('\n') + '\n',
    ),
  ])
  console.log(JSON.stringify({
    status: report.status,
    activeReviewRequiredRows,
    publicReleaseThirdPartyRows,
    didRewriteSource: report.didRewriteSource,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
