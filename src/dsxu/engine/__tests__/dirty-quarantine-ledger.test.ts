import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(fullPath)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : []
  })
}

describe('V18 dirty quarantine ledger deletion closure', () => {
  const root = process.cwd()
  const retiredLedger = join(root, 'src/dsxu/engine/v18-dirty-quarantine-ledger.ts')

  test('keeps the retired dirty quarantine ledger deleted', () => {
    expect(existsSync(retiredLedger)).toBe(false)
  })

  test('does not let active source import the retired ledger runtime', () => {
    const offenders = listSourceFiles(join(root, 'src'))
      .filter(file => !relative(root, file).includes(`${'__tests__'}`))
      .filter(file => !relative(root, file).endsWith(join('src', 'dsxu', 'engine', 'release-test-gate.ts')))
      .filter(file => readFileSync(file, 'utf8').includes('v18-dirty-quarantine-ledger'))
      .map(file => relative(root, file))

    expect(offenders).toEqual([])
  })

  test('keeps deletion mutation review as the owner for the retired ledger', () => {
    const mutationReview = readFileSync(
      join(root, 'docs/generated/DSXU_V20_DELETION_MUTATION_REVIEW_20260514.csv'),
      'utf8',
    )

    expect(mutationReview).toContain('src/dsxu/engine/v18-dirty-quarantine-ledger.ts')
    expect(mutationReview).toContain('READY_PENDING_GIT_MUTATION_REVIEW')
    expect(mutationReview).toContain('do-not-restore-old-runtime')
  })
})
