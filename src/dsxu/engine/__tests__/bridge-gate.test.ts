import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(fullPath)
    return /\.(?:ts|tsx|js)$/.test(entry.name) ? [fullPath] : []
  })
}

describe('Retired bridge adapter owner', () => {
  const root = process.cwd()
  const retiredAdapter = join(root, 'src/dsxu/engine/adapters/bridge-adapter.ts')

  it('allows deletion or only an ACL tombstone for the retired bridge adapter runtime', () => {
    if (!existsSync(retiredAdapter)) return
    const tombstone = readFileSync(retiredAdapter, 'utf8')
    expect(tombstone).toContain('Retired adapter tombstone')
    expect(tombstone).toContain('external-tool-adapter.ts')
    expect(tombstone).not.toContain('class BridgeAdapter')
    expect(tombstone).not.toContain('BridgeToolErrorType')
  })

  it('keeps product code on DSXU external-tool adapter owners', () => {
    const offenders = listSourceFiles(join(root, 'src'))
      .filter(file => !relative(root, file).includes(`${'__tests__'}`))
      .filter(file => !relative(root, file).includes('_deleted_files'))
      .filter(file => readFileSync(file, 'utf8').includes('bridge-adapter'))
      .map(file => relative(root, file))

    expect(offenders).toEqual([])
  })
})
