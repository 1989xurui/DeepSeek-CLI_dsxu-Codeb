import { describe, expect, test } from 'bun:test'
import { readFile } from 'fs/promises'
import { join } from 'path'

describe('PowerShell parser lifecycle', () => {
  test('keeps DSXU permission parsing bounded and internally governed', async () => {
    const repoRoot = process.cwd()
    const parser = await readFile(
      join(repoRoot, 'src/utils/powershell/parser.ts'),
      'utf8',
    )
    const permissions = await readFile(
      join(repoRoot, 'src/tools/PowerShellTool/powershellPermissions.ts'),
      'utf8',
    )

    expect(parser).toContain('const DEFAULT_PARSE_TIMEOUT_MS = 15_000')
    expect(parser).toContain('withSerializedPowerShellParser')
    expect(parser).toContain('await withSerializedPowerShellParser')
    expect(parser.indexOf('await withSerializedPowerShellParser')).toBeLessThan(
      parser.indexOf('await execa(pwshPath, args'),
    )

    expect(permissions).toContain('PARSE_INDEPENDENT_READONLY_CMDLETS')
    expect(permissions).toContain("new Set(['get-location'])")
    expect(permissions).toContain('isParseIndependentReadOnlyCommand(command)')
    expect(permissions).not.toContain('isReadOnlyCommand(command))')
  })
})
