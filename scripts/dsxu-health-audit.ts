import { readdir, readFile, stat, writeFile, mkdir } from 'fs/promises'
import { dirname, extname, join, resolve } from 'path'

const STRICT_UTF8_DECODER = new TextDecoder('utf-8', { fatal: true })
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.jsonc'])
const DEFAULT_SCAN_ROOTS = ['src', 'scripts'] as const
const REPLACEMENT_GLYPH = '\uFFFD'
const COMMON_GBK_MOJIBAKE = '\u951f\u65a4\u62f7'

type HealthAuditFileFinding = {
  path: string
  reason: 'invalid-utf8' | 'replacement-glyph' | 'gbk-mojibake'
}

type HealthAuditReport = {
  ok: boolean
  generatedAt: string
  repoRoot: string
  scannedFileCount: number
  invalid_utf8_files: readonly string[]
  user_visible_risk_files: readonly HealthAuditFileFinding[]
  evidencePath: string
  flags: readonly string[]
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function shouldSkip(name: string): boolean {
  return name === '.git' || name === '.dsxu' || name === 'node_modules' || name === 'dist'
}

async function listTextFiles(root: string): Promise<string[]> {
  const absolute = join(process.cwd(), root)
  const info = await stat(absolute)
  if (info.isFile()) return TEXT_EXTENSIONS.has(extname(root).toLowerCase()) ? [root] : []

  const entries = await readdir(absolute, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue
    const child = `${root}/${entry.name}`
    if (entry.isDirectory()) {
      files.push(...await listTextFiles(child))
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(child)
    }
  }
  return files
}

async function auditFile(path: string): Promise<readonly HealthAuditFileFinding[]> {
  const bytes = await readFile(join(process.cwd(), path))
  const findings: HealthAuditFileFinding[] = []
  let text = ''
  try {
    text = STRICT_UTF8_DECODER.decode(bytes)
  } catch {
    findings.push({ path, reason: 'invalid-utf8' })
    return findings
  }
  if (text.includes(REPLACEMENT_GLYPH)) findings.push({ path, reason: 'replacement-glyph' })
  if (text.includes(COMMON_GBK_MOJIBAKE)) findings.push({ path, reason: 'gbk-mojibake' })
  return findings
}

async function main(): Promise<void> {
  const repoRoot = resolve(process.cwd())
  const evidencePath = join(repoRoot, '.dsxu', 'trace', 'health-audit', 'dsxu-health-audit.json')
  const flags = process.argv.slice(2)
  const files = (await Promise.all(DEFAULT_SCAN_ROOTS.map(listTextFiles))).flat()
  const findings = (await Promise.all(files.map(auditFile))).flat()
  const invalidUtf8Files = findings
    .filter(finding => finding.reason === 'invalid-utf8')
    .map(finding => finding.path)
  const userVisibleRiskFiles = findings.filter(finding => finding.reason !== 'invalid-utf8')
  const failOnUserVisibleRisk = hasFlag('--fail-on-user-visible-risk')
  const failOnInvalidUtf8 = hasFlag('--fail-on-invalid-utf8')
  const ok = (!failOnInvalidUtf8 || invalidUtf8Files.length === 0) &&
    (!failOnUserVisibleRisk || userVisibleRiskFiles.length === 0)
  const report: HealthAuditReport = {
    ok,
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedFileCount: files.length,
    invalid_utf8_files: invalidUtf8Files,
    user_visible_risk_files: userVisibleRiskFiles,
    evidencePath,
    flags,
  }

  await mkdir(dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`invalid_utf8_files=${invalidUtf8Files.length}`)
  console.log(`user_visible_risk_files=${userVisibleRiskFiles.length}`)
  console.log(JSON.stringify(report, null, 2))
  if (!ok) process.exitCode = 2
}

await main()
