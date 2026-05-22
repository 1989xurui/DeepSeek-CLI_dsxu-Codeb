import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const ACL_PREFLIGHT_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_PREFLIGHT_20260515.json')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_CLOSURE_PLAN_20260515.json')
const OUTPUT_CSV_PATH = join(GENERATED_DIR, 'DSXU_V20_ACL_RESIDUE_CLOSURE_PLAN_20260515.csv')

type AclRow = {
  path: string
  residueClass: string
  exists: boolean
  writable: boolean
  parentWritable: boolean
  deleteAllowedByAcl: boolean
  activeProductReferenceRows: number
  closureStatus: string
  executionRule: string
}

type ClosureRow = {
  path: string
  residueClass: string
  status: string
  commandPlan: string
  requiresExplicitAuthorization: true
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

async function main(): Promise<void> {
  const acl = JSON.parse((await readFile(ACL_PREFLIGHT_PATH, 'utf8')).replace(/^\uFEFF/, '')) as { rows: AclRow[] }
  const rows: ClosureRow[] = acl.rows.map(row => ({
    path: row.path,
    residueClass: row.residueClass,
    status: row.exists &&
      row.activeProductReferenceRows === 0 &&
      row.closureStatus === 'OWNER_SIGNED_EXTERNAL_RESIDUE_DELETE_WHEN_PERMISSION_ALLOWS' &&
      row.executionRule.includes('Do not import')
      ? 'SIGNED_EXTERNAL_RESIDUE_NOT_PRODUCT_RUNTIME'
      : row.exists && row.activeProductReferenceRows === 0 && row.deleteAllowedByAcl
      ? 'READY_PENDING_EXPLICIT_OWNER_GIT_MUTATION_OR_EXTERNAL_PERMISSION'
      : row.exists && row.activeProductReferenceRows === 0
        ? 'BLOCKED_DELETE_PERMISSION_DENIED_OR_EXTERNAL_SIGNOFF'
      : 'BLOCKED_REFERENCE_OR_MISSING_FILE_STATE',
    commandPlan: `Remove-Item -LiteralPath "${row.path.replace(/"/g, '\\"')}"`,
    requiresExplicitAuthorization: true,
  }))
  const readyRows = rows.filter(row => row.status === 'READY_PENDING_EXPLICIT_OWNER_GIT_MUTATION_OR_EXTERNAL_PERMISSION').length
  const permissionDeniedRows = rows.filter(row => row.status === 'BLOCKED_DELETE_PERMISSION_DENIED_OR_EXTERNAL_SIGNOFF').length
  const signedExternalRows = rows.filter(row => row.status === 'SIGNED_EXTERNAL_RESIDUE_NOT_PRODUCT_RUNTIME').length
  const report = {
    schemaVersion: 'dsxu.v20.acl-residue-closure-plan.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: signedExternalRows === rows.length
      ? 'PASS_EXTERNAL_RESIDUE_SIGNED_NO_PRODUCT_RUNTIME'
      : readyRows === rows.length
      ? 'READY_PENDING_EXPLICIT_OWNER_GIT_MUTATION_OR_EXTERNAL_PERMISSION'
      : permissionDeniedRows > 0
        ? 'BLOCKED_DELETE_PERMISSION_DENIED_OR_EXTERNAL_SIGNOFF'
        : 'BLOCKED',
    residueCount: rows.length,
    readyRows,
    permissionDeniedRows,
    signedExternalRows,
    didMutateFilesystem: false,
    didStageGit: false,
    rows,
    blockers: signedExternalRows === rows.length
      ? []
      : [
          permissionDeniedRows > 0
            ? 'current user/session lacks Delete/DeleteChild ACL for one or more residue paths'
            : 'explicit owner/Git mutation or external permission closure is required before deleting ACL residue paths',
          'this plan did not delete, chmod, chown, stage, reset, clean, or export',
        ],
    nextAction: permissionDeniedRows > 0
      ? 'close ACL ownership externally or run from an elevated/owner session; do not restore these residue files as runtime'
      : signedExternalRows === rows.length
        ? 'continue final preflight; release/export must continue excluding these physical ACL residues'
      : 'after explicit authorization, delete these residue paths and stage the removals through owner/Git review',
    rule: 'ACL residues must not be restored as product runtime or compatibility holding paths.',
  }
  const headers = ['path', 'residueClass', 'status', 'commandPlan', 'requiresExplicitAuthorization']
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await Promise.all([
    writeFile(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'),
    writeFile(
      OUTPUT_CSV_PATH,
      [
        headers.map(csvEscape).join(','),
        ...rows.map(row => headers.map(header => csvEscape(row[header as keyof ClosureRow])).join(',')),
      ].join('\n') + '\n',
    ),
  ])
  console.log(JSON.stringify({
    status: report.status,
    residueCount: report.residueCount,
    readyRows: report.readyRows,
    permissionDeniedRows: report.permissionDeniedRows,
    signedExternalRows: report.signedExternalRows,
    didMutateFilesystem: report.didMutateFilesystem,
    didStageGit: report.didStageGit,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
