import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const STRICT_UTF8_DECODER = new TextDecoder('utf-8', { fatal: true })
const REPLACEMENT_GLYPH = '\uFFFD'
const COMMON_GBK_MOJIBAKE = '\u951f\u65a4\u62f7'

const CRITICAL_MAINLINE_FILES = [
  'src/query.ts',
  'src/utils/messages.ts',
  'src/dsxu/engine/runtime-core.ts',
  'src/dsxu/engine/compact.ts',
  'src/tools/AgentTool/AgentTool.tsx',
  'src/tasks/LocalAgentTask/LocalAgentTask.tsx',
  'src/tools/FileEditTool/FileEditTool.ts',
  'src/tools/BashTool/BashTool.tsx',
  'src/tools/BashTool/bashPermissions.ts',
  'src/tools/PowerShellTool/PowerShellTool.tsx',
  'src/utils/permissions/permissions.ts',
]

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.jsonc'])

function extensionOf(path: string): string {
  const index = path.lastIndexOf('.')
  return index < 0 ? '' : path.slice(index).toLowerCase()
}

function listTextFiles(root: string): string[] {
  const absolute = join(process.cwd(), root)
  const info = statSync(absolute)
  if (info.isFile()) {
    return TEXT_EXTENSIONS.has(extensionOf(root)) ? [root] : []
  }

  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      return []
    }
    const child = `${root}/${entry.name}`
    if (entry.isDirectory()) return listTextFiles(child)
    if (entry.isFile() && TEXT_EXTENSIONS.has(extensionOf(entry.name))) return [child]
    return []
  })
}

describe('source encoding boundary V1', () => {
  test('keeps critical mainline source files strict UTF-8 decodable', () => {
    for (const file of CRITICAL_MAINLINE_FILES) {
      const bytes = readFileSync(join(process.cwd(), file))

      expect(() => STRICT_UTF8_DECODER.decode(bytes), file).not.toThrow()
    }
  })

  test('keeps runtime-core resume hints free of replacement glyphs', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/dsxu/engine/runtime-core.ts'),
      'utf8',
    )

    expect(source).toContain('Executed ${hygieneCompactResult.compactResult.compactType} compaction')
    expect(source).toContain('Saved ${hygieneCompactResult.compactResult.tokensSaved} tokens')
    expect(source).toContain('Primary memory category: ${topCategory[0]}')
    expect(source).not.toContain(REPLACEMENT_GLYPH)
    expect(source).not.toContain(COMMON_GBK_MOJIBAKE)
  })

  test('health audit uses strict UTF-8 before scanning mojibake text', () => {
    const source = readFileSync(
      join(process.cwd(), 'scripts/dsxu-health-audit.ts'),
      'utf8',
    )

    expect(source).toContain("new TextDecoder('utf-8', { fatal: true })")
    expect(source).toContain('invalid_utf8_files=')
    expect(source).toContain('--fail-on-user-visible-risk')
    expect(source).toContain('--fail-on-invalid-utf8')
    expect(source).toContain('process.exitCode = 2')
  })

  test('keeps active src and scripts text files strict UTF-8 decodable', () => {
    const files = ['src', 'scripts'].flatMap(listTextFiles)

    const invalidFiles: string[] = []
    for (const file of files) {
      const bytes = readFileSync(join(process.cwd(), file))
      try {
        STRICT_UTF8_DECODER.decode(bytes)
      } catch {
        invalidFiles.push(file)
      }
    }

    expect(invalidFiles).toEqual([])
  })
})
