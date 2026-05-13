import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('visible UI copy pack V1', () => {
  test('keeps settings model and shortcut copy readable', () => {
    const source = read('src/components/Settings/Config.tsx')

    expect(source).toContain("' - Billed as extra usage'")
    expect(source).toContain('placeholder="Search settings..."')
    expect(source).toContain('shortcut="Left/Right tab"')
    expect(source).toContain('shortcut="Enter/Down"')
    expect(source).not.toContain('Search settings\uFFFD')
    expect(source).not.toContain('\uFFFD\uFFFD Billed as extra usage')
  })

  test('keeps IDE workspace display copy readable', () => {
    const source = read('src/commands/ide/ide.tsx')

    expect(source).toContain('Connecting to {connectingIDE.name}...')
    expect(source).toContain('result += \', ...\'')
    expect(source).toContain("return '...' + folder.slice(-(maxLengthPerPath - 3))")
    expect(source).not.toContain('Connecting to {connectingIDE.name}\uFFFD')
  })

  test('keeps marketplace and thinkback loading copy readable', () => {
    const marketplace = read('src/commands/plugin/ManageMarketplaces.tsx')
    const thinkback = read('src/commands/thinkback/thinkback.tsx')
    const visibleCopy = [
      'Loading marketplaces...',
      'Updating marketplace...',
      'Please wait...',
      'Processing changes...',
      'Checking thinkback installation...',
      'Installing marketplace...',
      'Enabling thinkback plugin...',
      'Installing thinkback plugin...',
      'Loading thinkback skill...',
    ]

    const combined = `${marketplace}\n${thinkback}`
    for (const copy of visibleCopy) {
      expect(combined).toContain(copy)
    }

    const visibleStatusLines = combined
      .split(/\r?\n/)
      .filter(line =>
        /Loading|Updating marketplace|Please wait|Processing changes|Installing|Enabling thinkback/.test(line),
      )
      .join('\n')

    expect(visibleStatusLines).not.toContain('\uFFFD')
  })
})
