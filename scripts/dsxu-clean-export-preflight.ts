import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const FINAL_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_FINAL_PREFLIGHT_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.csv')

type CleanExportRule = {
  rule: string
  status: 'PASS' | 'BLOCKED'
  detail: string
}

type CleanExportPreflight = {
  schemaVersion: 'dsxu.v20.clean-export-preflight.v1'
  generatedAt: string
  repoRoot: string
  status: 'PASS_READY_TO_CREATE_CLEAN_EXPORT' | 'BLOCKED'
  canCreateCleanExport: boolean
  didCreateExport: false
  requiredExclusions: readonly string[]
  rules: readonly CleanExportRule[]
  blockers: readonly string[]
  nextAction: string
  rule: string
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(rows: readonly CleanExportRule[]): string {
  const headers = ['rule', 'status', 'detail']
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header as keyof CleanExportRule])).join(',')),
  ].join('\n') + '\n'
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
}

async function main(): Promise<void> {
  const finalPreflight = await readJson(FINAL_PREFLIGHT_PATH)
  const finalReady = finalPreflight.status === 'PASS' && finalPreflight.canCreateCleanExport === true
  const rules: CleanExportRule[] = [
    {
      rule: 'final-preflight',
      status: finalReady ? 'PASS' : 'BLOCKED',
      detail: 'final preflight must PASS before any export artifact is created',
    },
    {
      rule: 'evidence-directories',
      status: finalReady ? 'PASS' : 'BLOCKED',
      detail: '.dsxu trace/runs evidence remains source-side only and must not be included in release/export',
    },
    {
      rule: 'local-dependencies',
      status: finalReady ? 'PASS' : 'BLOCKED',
      detail: 'node_modules is local build/test dependency and must not be included in release/export',
    },
    {
      rule: 'git-worktree',
      status: finalReady ? 'PASS' : 'BLOCKED',
      detail: finalReady
        ? 'owner/Git packets are staged and post-stage verified; clean export must be built from tracked release surface and exclude physical ACL residues'
        : 'current git status remains dirty; owner/Git mutation and final tests are not closed',
    },
  ]
  const report: CleanExportPreflight = {
    schemaVersion: 'dsxu.v20.clean-export-preflight.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: finalReady ? 'PASS_READY_TO_CREATE_CLEAN_EXPORT' : 'BLOCKED',
    canCreateCleanExport: finalReady,
    didCreateExport: false,
    requiredExclusions: ['.git', '.dsxu', 'node_modules', 'local trace/runs evidence', 'permission-blocked residues'],
    rules,
    blockers: rules.filter(row => row.status === 'BLOCKED').map(row => `${row.rule}: ${row.detail}`),
    nextAction: finalReady
      ? 'clean export may be created by an explicit release/export action; this preflight did not create artifacts'
      : 'finish P12, owner/Git mutation, ACL residues, six-stage tests, and final preflight before clean export',
    rule:
      'This clean export preflight is evidence-only. It does not create archives, copy files, clean directories, delete files, stage, commit, or reset.',
  }
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(OUTPUT_CSV_PATH, toCsv(rules)),
  ])
  console.log(JSON.stringify({
    status: report.status,
    canCreateCleanExport: report.canCreateCleanExport,
    didCreateExport: report.didCreateExport,
    blockers: report.blockers.length,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
