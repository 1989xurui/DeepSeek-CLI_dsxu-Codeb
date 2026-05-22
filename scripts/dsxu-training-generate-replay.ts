import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildReplayTrainingFixtures } from '../src/dsxu/training/replay-fixtures'

async function main(): Promise<void> {
  const outDir = join(process.cwd(), '.dsxu', 'training', 'replay')
  await mkdir(outDir, { recursive: true })
  const fixtures = buildReplayTrainingFixtures()
  for (const fixture of fixtures) {
    await writeFile(join(outDir, `${fixture.fixtureId}.json`), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')
  }
  console.log(JSON.stringify({
    schemaVersion: 'dsxu.training-replay-generation.v1',
    datasetKind: 'internal_synthetic_replay',
    publicClaimAllowed: false,
    outputDir: outDir,
    fixtureCount: fixtures.length,
    categories: Array.from(new Set(fixtures.map(fixture => fixture.category))).sort(),
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
