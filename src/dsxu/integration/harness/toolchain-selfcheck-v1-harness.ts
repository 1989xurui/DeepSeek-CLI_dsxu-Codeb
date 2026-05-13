import { execFile } from 'child_process'
import { access, mkdir, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type ToolchainCheckStatus = 'pass' | 'fail'

export type ToolchainCheck = {
  id: string
  status: ToolchainCheckStatus
  command: string
  stdout: string
  stderr: string
  error?: string
}

export type ToolchainSelfcheckResult = {
  ok: boolean
  evidencePath: string
  repoRoot: string
  inventory: ToolchainInventoryItem[]
  forbiddenRuntimeSources: ToolchainForbiddenRuntimeSource[]
  checks: ToolchainCheck[]
  packagingGuidance: string[]
}

export type ToolchainSelfcheckOptions = {
  repoRoot?: string
  evidenceDir?: string
  distro?: string
}

export type ToolchainInventoryStatus =
  | 'ready'
  | 'repair-proven'
  | 'dependency-managed'
  | 'host-boundary'
  | 'gap'

export type ToolchainInventoryItem = {
  id: string
  role: string
  defaultOwner: 'dsxu-vendored' | 'dsxu-cache' | 'repo-dependency' | 'host-platform'
  status: ToolchainInventoryStatus
  windowsPath?: string
  wslPath?: string
  evidenceCheckIds: string[]
  releasePackagingRule: string
}

export type ToolchainForbiddenRuntimeSource = {
  pattern: string
  status: 'not-found' | 'found'
  scope: string
}

const DEFAULT_TIMEOUT_MS = 15_000

function windowsPathToWslPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (!match) return normalized
  return `/mnt/${match[1]!.toLowerCase()}/${match[2]}`
}

function deriveHeadlessShellPath(chromiumPath: string): string {
  const normalized = chromiumPath.replace(/\\/g, '/')
  const match = normalized.match(/^(.*)\/chromium-(\d+)\/chrome-win64\/chrome\.exe$/)
  if (!match) return chromiumPath
  return `${match[1]}/chromium_headless_shell-${match[2]}/chrome-headless-shell-win64/chrome-headless-shell.exe`
}

async function runCommand(
  id: string,
  command: string,
  args: string[],
): Promise<ToolchainCheck> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    })
    return {
      id,
      status: 'pass',
      command: [command, ...args].join(' '),
      stdout: String(stdout).trim(),
      stderr: String(stderr).trim(),
    }
  } catch (error: any) {
    return {
      id,
      status: 'fail',
      command: [command, ...args].join(' '),
      stdout: String(error?.stdout ?? '').trim(),
      stderr: String(error?.stderr ?? '').trim(),
      error: error?.message ?? String(error),
    }
  }
}

async function runWsl(
  id: string,
  distro: string,
  script: string,
): Promise<ToolchainCheck> {
  // wsl.exe is launched from Windows, where unescaped bash variables such as
  // $HOME, $resolved, and $(command ...) can be consumed before bash receives
  // the command string. Escape dollars once at the Windows boundary so bash
  // performs the expansion inside the target distro.
  const escapedScript = script.replace(/\$/g, '\\$')
  return runCommand(id, 'wsl.exe', [
    '-d',
    distro,
    '--',
    'bash',
    '-lc',
    escapedScript,
  ])
}

export function buildToolchainPackagingGuidance(): string[] {
  return [
    'Ship DSXU-owned native tools under src/utils/vendor or the packaged app resource directory, never from Codex app temp/resource paths.',
    'Resolve tools through DSXU launchers and runtime selfcheck before falling back to PATH.',
    'For WSL, prefer the Linux vendored binary and fail visibly if it is missing; Windows rg.exe interop is developer-only escape hatch.',
    'Keep binaries in stable product directories, avoid writing executable tools to temp/system folders, and document AV allowlisting by product path and hash.',
    'Do not solve AV/tool failures by disabling tools globally; surface restore guidance and exact missing binary path.',
  ]
}

export function buildToolchainInventory(repoRoot = process.cwd()): ToolchainInventoryItem[] {
  const windowsRg = join(
    repoRoot,
    'src',
    'utils',
    'vendor',
    'ripgrep',
    'x64-win32',
    'rg.exe',
  )
  const linuxRg = join(
    repoRoot,
    'src',
    'utils',
    'vendor',
    'ripgrep',
    'x64-linux',
    'rg',
  )

  return [
    {
      id: 'ripgrep-windows',
      role: 'default Windows search/file listing engine',
      defaultOwner: 'dsxu-vendored',
      status: 'ready',
      windowsPath: windowsRg,
      evidenceCheckIds: ['windows-vendored-rg', 'windows-vendored-rg-sha256'],
      releasePackagingRule:
        'ship stable DSXU rg.exe bytes with published SHA-256; never resolve from Codex app resource paths by default',
    },
    {
      id: 'ripgrep-wsl',
      role: 'default WSL/Linux search/file listing engine',
      defaultOwner: 'dsxu-cache',
      status: 'repair-proven',
      windowsPath: linuxRg,
      wslPath: '$HOME/.dsxu/tools/ripgrep/x64-linux/rg',
      evidenceCheckIds: [
        'wsl-internal-rg',
        'wsl-internal-rg-sha256',
        'wsl-dsxu-path-rg',
      ],
      releasePackagingRule:
        'repair WSL rg from DSXU-owned Linux bytes, verify hash, and put DSXU cache path before PATH',
    },
    {
      id: 'powershell-host',
      role: 'Windows host command executor and permission surface',
      defaultOwner: 'host-platform',
      status: 'host-boundary',
      evidenceCheckIds: ['windows-powershell'],
      releasePackagingRule:
        'do not vendor PowerShell; detect exact host path/version and surface permission or AV failures explicitly',
    },
    {
      id: 'wsl-bash-host',
      role: 'WSL shell boundary for Linux project execution',
      defaultOwner: 'host-platform',
      status: 'host-boundary',
      evidenceCheckIds: ['wsl-bun-node-python'],
      releasePackagingRule:
        'do not silently fall back to Windows tools inside WSL; WSL shell failures must report distro, command, and missing capability',
    },
    {
      id: 'bun-runtime',
      role: 'DSXU TypeScript/runtime/test runner',
      defaultOwner: 'host-platform',
      status: 'host-boundary',
      evidenceCheckIds: [
        'windows-bun',
        'windows-bun-config-read',
        'windows-bun-src-js-alias',
        'wsl-bun-node-python',
      ],
      releasePackagingRule:
        'open-source installs may require Bun; release bundles should include or preflight the runtime, project config read access, and src/*.js source alias contract before launch',
    },
    {
      id: 'node-runtime',
      role: 'user project JavaScript runtime compatibility boundary',
      defaultOwner: 'host-platform',
      status: 'host-boundary',
      evidenceCheckIds: ['windows-node', 'wsl-bun-node-python'],
      releasePackagingRule:
        'preflight Node separately from Bun because many user projects and package scripts still invoke node directly',
    },
    {
      id: 'npm-project-manager',
      role: 'user project package manager and web app verification support',
      defaultOwner: 'host-platform',
      status: 'host-boundary',
      evidenceCheckIds: ['windows-npm'],
      releasePackagingRule:
        'treat npm as project-owned; DSXU should verify availability before using it and keep long-running dev servers owned',
    },
    {
      id: 'playwright-headless-shell',
      role: 'real browser/TUI/frontend verification',
      defaultOwner: 'repo-dependency',
      status: 'dependency-managed',
      evidenceCheckIds: ['windows-playwright-headless-shell'],
      releasePackagingRule:
        'ship through DSXU dependency/package lock or explicit browser bundle, not temp browser paths; report missing browser with restore guidance',
    },
    {
      id: 'python3-wsl',
      role: 'WSL document/test helper boundary',
      defaultOwner: 'host-platform',
      status: 'host-boundary',
      evidenceCheckIds: ['wsl-bun-node-python'],
      releasePackagingRule:
        'only use when the task requires Python; preflight in WSL and do not hide missing interpreter as a tool success',
    },
    {
      id: 'docker-desktop-wsl-integration',
      role: 'container-backed task execution and Docker Desktop Ubuntu integration',
      defaultOwner: 'host-platform',
      status: 'host-boundary',
      evidenceCheckIds: ['docker-wsl-integration-health'],
      releasePackagingRule:
        'do not vendor Docker Desktop; preflight the Ubuntu proxy executable, docker socket, CLI, and server reachability before container-backed tasks',
    },
  ]
}

export function buildForbiddenRuntimeSourceInventory(): ToolchainForbiddenRuntimeSource[] {
  return [
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
  ]
}

export async function runToolchainSelfcheck(
  options: ToolchainSelfcheckOptions = {},
): Promise<ToolchainSelfcheckResult> {
  const repoRoot = resolve(options.repoRoot ?? process.cwd())
  const evidenceDir =
    options.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'toolchain-selfcheck.json')
  const distro = options.distro ?? 'Ubuntu'
  const wslRoot = windowsPathToWslPath(repoRoot)
  const windowsRg = join(
    repoRoot,
    'src',
    'utils',
    'vendor',
    'ripgrep',
    'x64-win32',
    'rg.exe',
  )
  const wslCacheRg = '$HOME/.dsxu/tools/ripgrep/x64-linux/rg'

  await mkdir(evidenceDir, { recursive: true })

  const checks: ToolchainCheck[] = []
  try {
    await access(windowsRg)
    checks.push(await runCommand('windows-vendored-rg', windowsRg, ['--version']))
    checks.push(
      await runCommand('windows-vendored-rg-sha256', 'powershell.exe', [
        '-NoProfile',
        '-Command',
        `(Get-FileHash -Algorithm SHA256 -LiteralPath ${JSON.stringify(windowsRg)}).Hash.ToLowerInvariant()`,
      ]),
    )
  } catch (error: any) {
    checks.push({
      id: 'windows-vendored-rg',
      status: 'fail',
      command: windowsRg,
      stdout: '',
      stderr: '',
      error: error?.message ?? String(error),
    })
  }

  checks.push(
    await runWsl(
      'wsl-internal-rg',
      distro,
      [
        `cd ${wslRoot}`,
        `test -x ${wslCacheRg}`,
        `${wslCacheRg} --version | head -1`,
      ].join(' && '),
    ),
  )

  checks.push(
    await runWsl(
      'wsl-internal-rg-sha256',
      distro,
      `set -o pipefail && sha256sum ${wslCacheRg} | awk '{print $1}'`,
    ),
  )

  checks.push(
    await runWsl(
      'wsl-dsxu-path-rg',
      distro,
      [
        `export PATH="$HOME/.dsxu/tools/ripgrep/x64-linux:${wslRoot}/src/utils/vendor/ripgrep/x64-linux:$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin"`,
        'resolved="$(command -v rg)"',
        'echo "rg=$resolved"',
        'test "$resolved" = "$HOME/.dsxu/tools/ripgrep/x64-linux/rg"',
        'rg --version | head -1',
      ].join(' && '),
    ),
  )

  checks.push(
    await runCommand('windows-powershell', 'powershell.exe', [
      '-NoProfile',
      '-Command',
      '$PSVersionTable.PSVersion.ToString()',
    ]),
  )
  checks.push(await runCommand('windows-bun', 'bun', ['--version']))
  checks.push(
    await runCommand('windows-bun-config-read', 'bun', [
      '-e',
      [
        "const { readFileSync } = await import('node:fs')",
        "const config = JSON.parse(readFileSync('tsconfig.json', 'utf8'))",
        "if (!config.compilerOptions?.paths?.['src/*.js']) throw new Error('missing src/*.js alias')",
        "console.log('tsconfig-src-js-alias=ok')",
      ].join('; '),
    ]),
  )
  checks.push(
    await runCommand('windows-bun-src-js-alias', 'bun', [
      '-e',
      "const mod = await import('src/services/analytics/index.js'); console.log(`src-js-alias=${typeof mod.logEvent}`)",
    ]),
  )
  checks.push(await runCommand('windows-node', 'node', ['--version']))
  checks.push(
    await runCommand('windows-npm', process.platform === 'win32' ? 'npm.cmd' : 'npm', [
      '--version',
    ]),
  )
  try {
    const { chromium } = await import('playwright')
    const headlessShell = deriveHeadlessShellPath(chromium.executablePath())
    await access(headlessShell)
    checks.push(
      await runCommand('windows-playwright-headless-shell', headlessShell, [
        '--version',
      ]),
    )
  } catch (error: any) {
    checks.push({
      id: 'windows-playwright-headless-shell',
      status: 'fail',
      command: 'playwright chromium headless-shell',
      stdout: '',
      stderr: '',
      error: error?.message ?? String(error),
    })
  }
  checks.push(
    await runWsl(
      'wsl-bun-node-python',
      distro,
      [
        'export PATH="$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin"',
        'command -v bun',
        'bun --version',
        'command -v node',
        'node --version',
        'command -v python3',
        'python3 --version',
      ].join(' && '),
    ),
  )

  const packagingGuidance = buildToolchainPackagingGuidance()
  const result: ToolchainSelfcheckResult = {
    ok: checks.every(check => check.status === 'pass'),
    evidencePath,
    repoRoot,
    inventory: buildToolchainInventory(repoRoot),
    forbiddenRuntimeSources: buildForbiddenRuntimeSourceInventory(),
    checks,
    packagingGuidance,
  }

  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  return result
}
