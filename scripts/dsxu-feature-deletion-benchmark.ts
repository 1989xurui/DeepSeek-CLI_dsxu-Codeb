import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  buildDefaultDSXUFeatureDeletionTaskPack,
  validateDSXUFeatureDeletionTaskPack,
} from '../src/dsxu/engine/feature-deletion-benchmark'

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function main(): void {
  const pack = buildDefaultDSXUFeatureDeletionTaskPack()
  const board = validateDSXUFeatureDeletionTaskPack(pack)
  const report = {
    schemaVersion: 'dsxu.v10.feature-deletion-benchmark-report.v1',
    generatedAt: new Date().toISOString(),
    owner: 'Evidence / Benchmark / Release Claim Binder',
    status: board.status,
    publicClaimAllowed: false,
    pack,
    board,
    rule: 'Feature deletion cases are internal product-evidence tasks. They are not SWE-bench, external victory, or public 90% claims.',
  }
  const jsonPath = join(process.cwd(), 'docs', 'generated', 'DSXU_V10_FEATURE_DELETION_BENCHMARK_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V10_FEATURE_DELETION_BENCHMARK_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Feature Deletion Benchmark Pack',
    '',
    `Status: ${report.status}`,
    '',
    `Cases: ${board.caseCount}`,
    '',
    '| id | category | profile | verification | forbidden |',
    '|---|---|---|---|---|',
    ...pack.cases.map(item =>
      `| ${item.id} | ${item.category} | ${item.expectedToolProfile} | ${item.expectedVerificationCommands.join('<br>')} | ${item.forbiddenBehavior.join('<br>')} |`,
    ),
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({
    status: report.status,
    cases: board.caseCount,
    outputJson: jsonPath,
    outputMd: mdPath,
  }, null, 2))
  if (board.status !== 'PASS_V10_FEATURE_DELETION_TASK_PACK_READY') process.exitCode = 1
}

main()
