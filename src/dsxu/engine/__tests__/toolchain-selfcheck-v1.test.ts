import { describe, expect, test } from 'bun:test'
import { readFile, stat } from 'fs/promises'
import {
  buildToolchainPackagingGuidance,
  runToolchainSelfcheck,
} from '../../integration/harness/toolchain-selfcheck-v1-harness'

describe('V18 toolchain selfcheck', () => {
  test(
    'proves DSXU-owned Windows and WSL toolchain paths are available',
    async () => {
      const result = await runToolchainSelfcheck()

      expect(result.ok, JSON.stringify(result.checks, null, 2)).toBe(true)
      expect(result.checks.map(check => check.id)).toEqual([
        'windows-vendored-rg',
        'windows-vendored-rg-sha256',
        'wsl-internal-rg',
        'wsl-internal-rg-sha256',
        'wsl-dsxu-path-rg',
        'windows-powershell',
        'windows-bun',
        'windows-bun-config-read',
        'windows-bun-src-js-alias',
        'windows-node',
        'windows-npm',
        'windows-playwright-headless-shell',
        'wsl-bun-node-python',
      ])

      const byId = new Map(result.checks.map(check => [check.id, check]))
      expect(byId.get('windows-vendored-rg')?.stdout).toContain('ripgrep')
      expect(byId.get('windows-vendored-rg-sha256')?.stdout).toBe(
        '1dce02aae98c0a48c2644abd1849fb90406296d4e0c95e239f95242ee8480ff8',
      )
      expect(byId.get('wsl-internal-rg')?.stdout).toContain('ripgrep')
      expect(byId.get('wsl-internal-rg-sha256')?.stdout).toBe(
        'c2feed7a376d3754958fa6235a6ef88a74bcabc9b0cfccacbd48939b5f87860d',
      )
      expect(byId.get('wsl-dsxu-path-rg')?.stdout).toContain(
        '.dsxu/tools/ripgrep/x64-linux/rg',
      )
      expect(byId.get('windows-powershell')?.stdout).toMatch(/\d+\.\d+/)
      expect(byId.get('windows-bun')?.stdout).toMatch(/\d+\.\d+\.\d+/)
      expect(byId.get('windows-bun-config-read')?.stdout).toContain(
        'tsconfig-src-js-alias=ok',
      )
      expect(byId.get('windows-bun-src-js-alias')?.stdout).toBe(
        'src-js-alias=function',
      )
      expect(byId.get('windows-node')?.stdout).toMatch(/^v\d+\.\d+\.\d+/)
      expect(byId.get('windows-npm')?.stdout).toMatch(/\d+\.\d+\.\d+/)
      expect(byId.get('windows-playwright-headless-shell')?.stdout).toContain(
        'Chrome',
      )
      expect(byId.get('wsl-bun-node-python')?.stdout).toContain('node')
      expect(byId.get('wsl-bun-node-python')?.stdout).toContain('Python')

      expect((await stat(result.evidencePath)).size).toBeGreaterThan(0)
      const evidence = await readFile(result.evidencePath, 'utf8')
      expect(evidence).toContain('"ok": true')
      expect(evidence).toContain('"wsl-dsxu-path-rg"')
      expect(evidence).toContain('"windows-vendored-rg-sha256"')
      expect(evidence).toContain('"wsl-internal-rg-sha256"')
      expect(evidence).toContain('"windows-bun-config-read"')
      expect(evidence).toContain('"windows-bun-src-js-alias"')
      expect(evidence).toContain('"windows-playwright-headless-shell"')
      expect(result.inventory.map(item => item.id)).toEqual([
        'ripgrep-windows',
        'ripgrep-wsl',
        'powershell-host',
        'wsl-bash-host',
        'bun-runtime',
        'node-runtime',
        'npm-project-manager',
        'playwright-headless-shell',
        'python3-wsl',
        'docker-desktop-wsl-integration',
      ])
      expect(result.inventory.filter(item => item.status === 'gap')).toEqual([])
      expect(result.forbiddenRuntimeSources).toEqual([
        {
          pattern: 'Codex app resource path',
          status: 'not-found',
          scope: 'src/utils/vendorToolPaths.ts, src/utils/ripgrep.ts, launchers',
        },
        {
          pattern: 'openai-bundled tool binary',
          status: 'not-found',
          scope: 'default DSXU native tool resolution',
        },
        {
          pattern: 'temporary extracted executable as default tool',
          status: 'not-found',
          scope: 'default DSXU native tool resolution',
        },
      ])
    },
    45_000,
  )

  test('packaging guidance does not disable tools as a workaround', () => {
    const guidance = buildToolchainPackagingGuidance().join('\n')
    expect(guidance).toContain('DSXU-owned native tools')
    expect(guidance).toContain('AV allowlisting')
    expect(guidance).toContain('Do not solve AV/tool failures by disabling tools globally')
  })

  test('mainline runtime defaults to DSXU vendored ripgrep instead of PATH', async () => {
    const source = await readFile(
      `${process.cwd()}/src/dsxu/engine/engine-tool-adapter.ts`,
      'utf8',
    )
    expect(source).toContain("process.env.USE_BUILTIN_RIPGREP ??= '1'")
    expect(source).not.toContain("process.env.USE_BUILTIN_RIPGREP ??= '0'")
  })

  test('inventory runner is a first-class package script', async () => {
    const packageJson = await readFile(`${process.cwd()}/package.json`, 'utf8')
    const script = await readFile(
      `${process.cwd()}/scripts/dsxu-toolchain-inventory.ts`,
      'utf8',
    )

    expect(packageJson).toContain('"toolchain:inventory"')
    expect(script).toContain('runToolchainSelfcheck')
    expect(script).toContain('toolchain-inventory.json')
    expect(script).not.toMatch(/\b(curl|wget|Invoke-WebRequest|http:\/\/|https:\/\/)\b/i)
  })
})
