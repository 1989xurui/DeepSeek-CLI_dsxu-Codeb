import { describe, expect, test } from 'bun:test'
import { readFile } from 'fs/promises'
import { join } from 'path'

describe('V18 toolchain repair', () => {
  test('repairs WSL ripgrep from DSXU-owned bytes without network downloads', async () => {
    const repoRoot = process.cwd()
    const script = await readFile(
      join(repoRoot, 'scripts/dsxu-toolchain-repair.ts'),
      'utf8',
    )
    const packageJson = await readFile(join(repoRoot, 'package.json'), 'utf8')

    expect(script).toContain('EXPECTED_LINUX_RG_SHA256')
    expect(script).toContain('createReadStream(sourcePath).pipe(child.stdin)')
    expect(script).toContain("spawn(\n    'wsl.exe'")
    expect(script).toContain('$HOME/.dsxu/tools/ripgrep/x64-linux/rg')
    expect(script).not.toMatch(/\b(curl|wget|Invoke-WebRequest|http:\/\/|https:\/\/)\b/i)
    expect(packageJson).toContain('"toolchain:repair"')
  })
})
