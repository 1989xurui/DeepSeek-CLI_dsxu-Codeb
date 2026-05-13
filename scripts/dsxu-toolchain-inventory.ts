import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { runToolchainSelfcheck } from '../src/dsxu/integration/harness/toolchain-selfcheck-v1-harness'

type InventoryReport = {
  ok: boolean
  generatedAt: string
  repoRoot: string
  evidencePath: string
  selfcheckEvidencePath: string
  inventory: Awaited<ReturnType<typeof runToolchainSelfcheck>>['inventory']
  forbiddenRuntimeSources: Awaited<
    ReturnType<typeof runToolchainSelfcheck>
  >['forbiddenRuntimeSources']
  failedChecks: Awaited<ReturnType<typeof runToolchainSelfcheck>>['checks']
  packagingGuidance: string[]
}

async function main(): Promise<void> {
  const repoRoot = resolve(process.cwd())
  const evidenceDir = join(repoRoot, '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'toolchain-inventory.json')
  const selfcheck = await runToolchainSelfcheck({ repoRoot, evidenceDir })
  const failedChecks = selfcheck.checks.filter(check => check.status !== 'pass')

  const report: InventoryReport = {
    ok:
      selfcheck.ok &&
      selfcheck.forbiddenRuntimeSources.every(source => source.status === 'not-found') &&
      failedChecks.length === 0,
    generatedAt: new Date().toISOString(),
    repoRoot,
    evidencePath,
    selfcheckEvidencePath: selfcheck.evidencePath,
    inventory: selfcheck.inventory,
    forbiddenRuntimeSources: selfcheck.forbiddenRuntimeSources,
    failedChecks,
    packagingGuidance: selfcheck.packagingGuidance,
  }

  await mkdir(dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

await main()
