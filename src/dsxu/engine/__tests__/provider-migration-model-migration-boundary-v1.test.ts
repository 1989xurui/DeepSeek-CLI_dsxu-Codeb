import { readFileSync } from 'fs'
import { describe, expect, test } from 'bun:test'

const migrationFiles = [
  'src/migrations/providerMigrationModelMigrations.ts',
  'src/migrations/migrateFennecToOpus.ts',
  'src/migrations/migrateLegacyOpusToCurrent.ts',
  'src/migrations/migrateSonnet1mToSonnet45.ts',
  'src/migrations/migrateSonnet45ToSonnet46.ts',
  'src/migrations/resetProToOpusDefault.ts',
] as const

function readSource(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('LMR-03.07 - provider migration model migration boundary', () => {
  test('keeps provider-migration source model migrations behind DSXU runtime guards', () => {
    for (const path of migrationFiles) {
      const source = readSource(path)
      expect(source).toContain('isDsxuRuntimeMode')
      expect(source).toMatch(
        /isDsxuRuntimeMode\(\)\)\s*return|return isDsxuRuntimeMode\(\)/,
      )
    }
  })

  test('routes startup through the neutral facade instead of direct old model migrations', () => {
    const main = readSource('src/main.tsx')
    const facade = readSource('src/migrations/providerMigrationModelMigrations.ts')

    expect(main).toContain('providerMigrationModelMigrations')
    expect(main).not.toContain("from './migrations/migrateSonnet1mToSonnet45.js'")
    expect(main).not.toContain("from './migrations/migrateSonnet45ToSonnet46.js'")
    expect(main).not.toContain("from './migrations/resetProToOpusDefault.js'")
    expect(facade).toContain('shouldSkipProviderMigrationModelMigration')
  })
})
