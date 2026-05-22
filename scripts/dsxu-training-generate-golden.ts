import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildGoldenTrainingFixtures } from '../src/dsxu/training/golden-fixtures'

async function main(): Promise<void> {
  const outDir = join(process.cwd(), 'docs', 'training', 'golden')
  await mkdir(outDir, { recursive: true })
  const fixtures = buildGoldenTrainingFixtures()
  for (const fixture of fixtures) {
    const filePath = join(outDir, `${fixture.fixtureId}.json`)
    await writeFile(filePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')
  }
  console.log(JSON.stringify({
    schemaVersion: 'dsxu.training-golden-generation.v1',
    outputDir: outDir,
    fixtureCount: fixtures.length,
    categories: Array.from(new Set(fixtures.map(fixture => fixture.category))).sort(),
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
