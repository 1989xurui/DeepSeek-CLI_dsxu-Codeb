import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

type StaticCheck = {
  id: string
  passed: boolean
  detail: string
}

type CommandCheck = {
  id: string
  command: string[]
  exitCode: number
  expectedExitCodes: number[]
  passed: boolean
  durationMs: number
  stdoutPath: string
  stderrPath: string
  stdoutTail: string
  stderrTail: string
}

const ROOT = process.cwd()
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'fresh-install-windows-smoke')
const OUT_JSON = join(GENERATED_DIR, 'DSXU_FRESH_INSTALL_WINDOWS_SMOKE_20260522.json')
const OUT_MD = join(ROOT, 'docs', 'DSXU_FRESH_INSTALL_WINDOWS_SMOKE_20260522.md')
const ISOLATED_CONFIG_DIR = join(TRACE_DIR, `isolated-config-${safeTime()}`)

function safeTime(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function tail(text: string, max = 2_500): string {
  return text.length <= max ? text : text.slice(-max)
}

async function readText(path: string): Promise<string> {
  return (await readFile(join(ROOT, path), 'utf8')).replace(/^\uFEFF/, '')
}

async function readBinary(path: string): Promise<Uint8Array | null> {
  try {
    return await readFile(join(ROOT, path))
  } catch {
    return null
  }
}

function pass(id: string, detail: string): StaticCheck {
  return { id, passed: true, detail }
}

function fail(id: string, detail: string): StaticCheck {
  return { id, passed: false, detail }
}

function commandEnv(): Record<string, string | undefined> {
  const env = {
    ...process.env,
    DSXU_CODE_MODE: '1',
    DSXU_PRODUCT_NAME: 'DSXU Code',
    DSXU_MODEL_PROVIDER: 'deepseek',
    DSXU_MODEL_GATEWAY: 'direct',
    DSXU_MODEL: 'deepseek-v4-flash',
    DSXU_CONFIG_DIR: ISOLATED_CONFIG_DIR,
  }
  delete env.DSXU_API_KEY
  delete env.DEEPSEEK_API_KEY
  delete env.DSXU_DEEPSEEK_API_KEY
  delete env.LITELLM_BASE_URL
  delete env.LITELLM_API_KEY
  delete env.WT_SESSION
  delete env.TERM_PROGRAM
  delete env.VSCODE_PID
  delete env.DSXU_ALLOW_CONHOST
  delete env.DSXU_TEST_DISABLE_WT_LOOKUP
  return env
}

function includesIgnoreCase(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle.toLowerCase())
}

function hasHardFailureSentinel(text: string): boolean {
  return /\b(?:UNEXPECTED_REACH|SHOULD_NOT_REACH(?:_HERE)?)\b/i.test(text)
}

async function runCommand(
  id: string,
  command: string[],
  expectedExitCodes: number[],
  stdin?: string,
  extraEnv?: Record<string, string | undefined>,
): Promise<CommandCheck> {
  await mkdir(TRACE_DIR, { recursive: true })
  const startedAt = Date.now()
  const base = `${id}-${safeTime()}`
  const stdoutPath = join(TRACE_DIR, `${base}.stdout.log`)
  const stderrPath = join(TRACE_DIR, `${base}.stderr.log`)
  const proc = Bun.spawn(command, {
    cwd: ROOT,
    env: {
      ...commandEnv(),
      ...extraEnv,
    },
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: stdin === undefined ? 'ignore' : 'pipe',
  })
  if (stdin !== undefined) {
    proc.stdin.write(stdin)
    proc.stdin.end()
  }
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<number>(resolve => {
    timeoutHandle = setTimeout(() => {
      proc.kill()
      resolve(124)
    }, 120_000)
  })
  const exitCode = await Promise.race([proc.exited, timeout])
  if (timeoutHandle) {
    clearTimeout(timeoutHandle)
  }
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  await Promise.all([
    writeFile(stdoutPath, stdout, 'utf8'),
    writeFile(stderrPath, stderr, 'utf8'),
  ])
  return {
    id,
    command,
    exitCode,
    expectedExitCodes,
    passed:
      expectedExitCodes.includes(exitCode) &&
      !stdout.includes('dsxu-test-windows-smoke-token') &&
      !stderr.includes('dsxu-test-windows-smoke-token') &&
      !hasHardFailureSentinel(stdout) &&
      !hasHardFailureSentinel(stderr),
    durationMs: Date.now() - startedAt,
    stdoutPath,
    stderrPath,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  }
}

async function staticChecks(): Promise<StaticCheck[]> {
  const startCmd = await readText('Start-DSXU-Code.cmd')
  const wslCmd = await readText('Start-DSXU-Code-WSL.cmd')
  const wslLaunch = await readText('bin/dsxu-code-wsl-launch')
  const attributes = await readText('.gitattributes')
  const winStart = await readText('scripts/start-dsxu-windows.ps1')
  const wslWinStart = await readText('scripts/start-dsxu-wsl-windows.ps1')
  const productEntrypoint = await readText('src/entrypoints/dsxu-code.tsx')
  const mainEntrypoint = await readText('src/main.tsx')
  const rootInstall = await readText('install.ps1')
  const rootShellInstall = await readText('install.sh')
  const winInstall = await readText('scripts/install-windows.ps1')
  const shInstall = await readText('scripts/install.sh')
  const installDoc = await readText('docs/INSTALL.md')
  const readme = await readText('README.md')
  const readmeCn = await readText('README.zh-CN.md')
  const packageJson = await readText('package.json')
  const wechatPayQr = await readBinary('docs/assets/wechat-pay.jpg')
  const wechatFriendQr = await readBinary('docs/assets/wechat-friend.jpg')
  const launcherSurface = [
    startCmd,
    wslCmd,
    wslLaunch,
    attributes,
    winStart,
    wslWinStart,
    mainEntrypoint,
    rootInstall,
    rootShellInstall,
    winInstall,
    shInstall,
  ].join('\n')

  const checks: StaticCheck[] = []
  checks.push(
    packageJson.includes('"name"') &&
      startCmd.length > 0 &&
      winStart.length > 0 &&
      productEntrypoint.length > 0
      ? pass('workspace-identity-root-files', `smoke root has package.json, Windows launchers, and DSXU product entrypoint: ${ROOT}`)
      : fail('workspace-identity-root-files', `smoke root is missing package.json, launchers, or product entrypoint: ${ROOT}`),
  )
  checks.push(
    !/(?:[A-Z]:[\\/]+DSXU-Code\d?|[A-Z]:[\\/]+DSXU-code\d?|\/mnt\/d\/DSXU-Code\d?|\/mnt\/d\/DSXU-code\d?)/i.test(launcherSurface)
      ? pass('launcher-path-drift-no-hardcoded-repo', 'launchers and installers derive repo root from their own location instead of hard-coded D:/DSXU paths')
      : fail('launcher-path-drift-no-hardcoded-repo', 'launcher or installer still contains hard-coded D:/DSXU path that can read one checkout and launch another'),
  )
  checks.push(
    rootInstall.includes('scripts\\install-windows.ps1') &&
      rootInstall.includes('bash ./scripts/install.sh') &&
      rootInstall.includes('$installParams') &&
      rootInstall.includes('InstallWsl') &&
      rootInstall.includes('CreateWslShortcut') &&
      rootInstall.includes('NoWindowsTerminalInstall') &&
      rootInstall.includes('NoLaunch')
      ? pass('root-install-dispatcher', 'root install.ps1 dispatches Windows install, optional WSL, Windows Terminal policy, and no-launch smoke mode')
      : fail('root-install-dispatcher', 'root install.ps1 is missing Windows/Unix dispatch, optional WSL, Windows Terminal policy, or no-launch mode'),
  )
  checks.push(
    rootShellInstall.includes('scripts/install.sh') &&
      rootShellInstall.includes('powershell -NoProfile -ExecutionPolicy Bypass -File ./install.ps1') &&
      rootShellInstall.includes('MINGW') &&
      rootShellInstall.includes('--no-dependencies')
      ? pass('root-shell-install-dispatcher', 'root install.sh dispatches Unix install and points Windows Git Bash users to install.ps1')
      : fail('root-shell-install-dispatcher', 'root install.sh is missing Unix/Windows dispatch guidance'),
  )
  checks.push(
    !startCmd.includes('D:\\DSXU-code') && startCmd.includes('scripts\\start-dsxu-windows.ps1')
      ? pass('root-start-cmd-current-dir', 'root Windows launcher delegates to repo-local PowerShell script')
      : fail('root-start-cmd-current-dir', 'root Windows launcher still hardcodes a machine path or does not delegate'),
  )
  checks.push(
    startCmd.includes('chcp 65001')
      ? pass('root-start-cmd-utf8', 'root Windows launcher switches code page to UTF-8')
      : fail('root-start-cmd-utf8', 'root Windows launcher does not set UTF-8 code page'),
  )
  checks.push(
    startCmd.includes('DSXU_ASCII_TUI') &&
      startCmd.includes('if "%DSXU_HAS_ARGS%"=="0"') &&
      startCmd.includes('-- cmd.exe /k') &&
      startCmd.includes('Microsoft\\WindowsApps\\wt.exe') &&
      startCmd.includes('Windows Terminal was not detected') &&
      startCmd.includes('DSXU_ALLOW_CONHOST') &&
      startCmd.includes('Classic cmd/PowerShell can turn Chinese input into question marks') &&
      winStart.includes('Get-DsxuWindowsTerminalPath') &&
      winStart.includes('Start-DsxuInWindowsTerminal') &&
      winStart.includes('DSXU_TEST_DISABLE_WT_LOOKUP') &&
      winStart.includes('TERM_PROGRAM') &&
      winStart.includes('DSXU_ASCII_TUI') &&
      productEntrypoint.includes('isWindowsInteractiveConsoleUnsafe') &&
      productEntrypoint.includes('Classic cmd/PowerShell can turn Chinese input')
      ? pass('windows-classic-console-interactive-block', 'Windows launchers relaunch trusted terminals or block interactive classic-console sessions unless explicitly allowed')
      : fail('windows-classic-console-interactive-block', 'Windows launchers or product entrypoint do not protect classic console users from Unicode/CJK input loss'),
  )
  checks.push(
    !wslCmd.includes('--cd /mnt/d/DSXU-code') &&
      !wslCmd.includes('wsl.exe --cd') &&
      wslCmd.includes('where wsl.exe') &&
      wslCmd.includes('DSXU_SELECTED_DISTRO') &&
      wslCmd.includes('DSXU_WSL_REPO=/mnt/') &&
      wslCmd.includes("test -f '%DSXU_WSL_REPO%/bin/dsxu-code-wsl-launch'") &&
      wslCmd.includes('wsl.exe -d %DSXU_SELECTED_DISTRO% -- bash -lc') &&
      wslCmd.includes('exec bash ./bin/dsxu-code-wsl-launch') &&
      wslCmd.includes('Falling back to the Windows native DSXU launcher') &&
      wslCmd.includes('Start-DSXU-Code.cmd') &&
      !wslCmd.includes('scripts\\start-dsxu-wsl-windows.ps1') &&
      wslWinStart.includes('Test-DsxuWslListLine') &&
      wslWinStart.includes('Test-DsxuWslDistroCandidate') &&
      wslWinStart.includes('ConvertTo-DsxuWslPath') &&
      wslWinStart.includes('Test-DsxuWslRepo') &&
      wslWinStart.includes('Start-DsxuNativeFallback') &&
      wslWinStart.includes('DSXU_TEST_DISABLE_WSL') &&
      !wslWinStart.includes('& wsl.exe @wslArgs')
      ? pass('wsl-launcher-default-distro-current-path', 'WSL root launcher owns distro probing, repo path conversion, native fallback, and direct inherited-console WSL launch without PowerShell stdout capture')
      : fail('wsl-launcher-default-distro-current-path', 'WSL launcher still hardcodes repo path, uses stale PowerShell delegation, captures WSL stdout through PowerShell, or lacks native fallback'),
  )
  checks.push(
    !wslLaunch.includes('ROOT_DIR="/mnt/d/DSXU-code"') &&
      wslLaunch.includes('DSXU_FORCE_INTERACTIVE') &&
      wslLaunch.includes('DSXU_WSL_STARTUP_RESIZE_DELAYS') &&
      wslLaunch.includes('for delay in') &&
      wslLaunch.includes('kill -WINCH "$dsxu_launcher_pid"') &&
      wslLaunch.includes('kill -WINCH 0') &&
      wslLaunch.includes('< /dev/tty') &&
      wslLaunch.includes('exec ./bin/dsxu-code "$@"') &&
      attributes.includes('bin/dsxu-code-wsl-launch text eol=lf') &&
      attributes.includes('scripts/*.sh text eol=lf') &&
      mainEntrypoint.includes('DSXU_FORCE_INTERACTIVE') &&
      mainEntrypoint.includes('(!forceInteractive && !process.stdout.isTTY)')
      ? pass('wsl-inner-launcher-current-dir', 'WSL inner launcher resolves repo from its own location, forces interactive mode, and nudges startup resize so no-arg WSL launch does not fall into --print or blank initial render')
      : fail('wsl-inner-launcher-current-dir', 'WSL inner launcher still hardcodes repo path, can misclassify no-arg WSL launch as print mode, or can blank the first TUI render before resize'),
  )
  checks.push(
    winStart.includes('UTF8Encoding') &&
      winStart.includes('chcp.com 65001') &&
      winStart.includes('bun --env-file=.env ./src/entrypoints/dsxu-code.tsx')
      ? pass('powershell-launcher-utf8-bun', 'PowerShell launcher owns UTF-8 setup and DSXU product entrypoint')
      : fail('powershell-launcher-utf8-bun', 'PowerShell launcher is missing UTF-8 or DSXU entrypoint setup'),
  )
  checks.push(
    winInstall.includes('Desktop shortcut created') &&
      winInstall.includes('DSXU Code\\bin') &&
      winInstall.includes('New-DsxuDesktopCommand') &&
      winInstall.includes('DSXU Code WSL.cmd') &&
      winInstall.includes('Start-DSXU-Code-WSL.cmd') &&
      winInstall.includes('InstallWsl') &&
      winInstall.includes('CreateWslShortcut') &&
      winInstall.includes('NoWindowsTerminalInstall') &&
      winInstall.includes('NoLaunch') &&
      winInstall.includes('Start-DsxuCliWindow') &&
      winInstall.includes('wsl.exe --install -d') &&
      winInstall.includes('Microsoft.WindowsTerminal') &&
      winInstall.includes('winget') &&
      winInstall.includes('Microsoft\\WindowsApps\\wt.exe') &&
      winInstall.includes('-- cmd.exe /k')
      ? pass('windows-installer-desktop-path-shim', 'Windows installer creates native shortcut, regenerated WSL lnk/cmd launchers, user PATH shim, Windows Terminal path, and auto-opens CLI')
      : fail('windows-installer-desktop-path-shim', 'Windows installer does not create native shortcut, regenerated WSL lnk/cmd launchers, PATH shim, Windows Terminal path, or auto-open CLI path'),
  )
  checks.push(
    winInstall.includes('New-DsxuDesktopCommand "DSXU Code WSL.cmd"') &&
      winInstall.includes('set "DSXU_REPO_ROOT=$ResolvedRepoRoot"') &&
      winInstall.includes('set "DSXU_LAUNCHER=$Launcher"') &&
      winInstall.includes('start "" wt.exe -w new new-tab') &&
      winInstall.includes('cmd.exe /k ""%DSXU_LAUNCHER%""') &&
      winInstall.includes('call "%DSXU_LAUNCHER%" %*') &&
      !winInstall.includes('wsl.exe -d "%DSXU_WSL_DISTRO%"') &&
      !winInstall.includes('wsl.exe --cd') &&
      !winInstall.includes('bash ./bin/dsxu-code-wsl-launch')
      ? pass('windows-installer-overwrites-stale-wsl-cmd', 'Windows installer overwrites stale desktop WSL .cmd with a Windows Terminal trampoline plus root-launcher delegate')
      : fail('windows-installer-overwrites-stale-wsl-cmd', 'Windows installer can leave or regenerate stale direct-wsl desktop command content or a foreground-pausing cmd wrapper'),
  )
  checks.push(
    winInstall.includes('WSL shortcut skipped') &&
      winInstall.includes('$shouldCreateWslShortcut') &&
      winInstall.includes('Get-DsxuWslDistro') &&
      wslWinStart.includes('Falling back to the Windows native DSXU launcher') &&
      wslWinStart.includes('Start-DsxuNativeFallback')
      ? pass('windows-wsl-optional-fallback', 'WSL shortcut is optional by default and WSL launcher falls back to native DSXU when WSL is unavailable')
      : fail('windows-wsl-optional-fallback', 'WSL optional/fallback behavior is missing'),
  )
  checks.push(
    shInstall.includes('~/.local/bin') && shInstall.includes('DSXU Code WSL.cmd')
      && shInstall.includes('--no-dependencies')
      && shInstall.includes('--no-desktop-shortcut')
      && shInstall.includes('Start-DSXU-Code-WSL.cmd')
      && !shInstall.includes('wsl.exe -d "%DSXU_WSL_DISTRO%" --cd "$ROOT_DIR"')
      ? pass('unix-installer-shims', 'Unix/WSL installer creates command shim and WSL desktop command when available')
      : fail('unix-installer-shims', 'Unix/WSL installer is missing command shim or WSL desktop command'),
  )
  checks.push(
    includesIgnoreCase(installDoc, 'One-command install') &&
      installDoc.includes('.\\install.ps1') &&
      installDoc.includes('bash ./install.sh') &&
      installDoc.includes('bash ./install.sh --help') &&
      includesIgnoreCase(installDoc, 'Windows one-command install') &&
      installDoc.includes('-InstallWsl') &&
      installDoc.includes('-CreateWslShortcut') &&
      installDoc.includes('-NoLaunch') &&
      installDoc.includes('opens the DSXU CLI') &&
      installDoc.includes('does not force every Windows user into WSL') &&
      installDoc.includes('DeepSeek key setup') &&
      installDoc.includes('UTF-8') &&
      includesIgnoreCase(installDoc, 'First-run DeepSeek key setup')
      ? pass('install-doc-bilingual-first-run', 'INSTALL.md covers bilingual install, auto-open, optional WSL, encoding, and first-run key setup')
      : fail('install-doc-bilingual-first-run', 'INSTALL.md is missing bilingual install, auto-open, optional WSL, first-run, or encoding guidance'),
  )
  checks.push(
    includesIgnoreCase(readme, 'Windows one-command install') &&
      readme.includes('.\\install.ps1') &&
      readme.includes('bash ./install.sh') &&
      readme.includes('bash ./install.sh --help') &&
      includesIgnoreCase(readme, 'First-run DeepSeek key setup') &&
      readme.includes('-InstallWsl') &&
      readme.includes('-CreateWslShortcut') &&
      readme.includes('-NoLaunch') &&
      readme.includes('opens the DSXU CLI') &&
      readme.includes('does not force-install WSL') &&
      readmeCn.includes('DSXU CLI') &&
      readmeCn.includes('.\\install.ps1') &&
      readmeCn.includes('bash ./install.sh') &&
      readmeCn.includes('bash ./install.sh --help') &&
      readmeCn.includes('-InstallWsl') &&
      readmeCn.includes('-CreateWslShortcut') &&
      readmeCn.includes('-NoLaunch') &&
      readmeCn.includes('DeepSeek key') &&
      readmeCn.includes('UTF-8')
      ? pass('readme-install-surface', 'README files expose install, auto-open, first-run, desktop, and encoding guidance')
      : fail('readme-install-surface', 'README install surface is incomplete'),
  )
  checks.push(
    readme.includes('Support And Say Hi') &&
      readme.includes('docs/assets/wechat-pay.jpg') &&
      readme.includes('docs/assets/wechat-friend.jpg') &&
      readmeCn.includes('打赏与认识一下') &&
      readmeCn.includes('如果好用好玩就打赏一下，也可以交个朋友') &&
      readmeCn.includes('docs/assets/wechat-pay.jpg') &&
      readmeCn.includes('docs/assets/wechat-friend.jpg')
      ? pass('readme-support-surface', 'README files expose the support/friend section with fixed QR asset paths')
      : fail('readme-support-surface', 'README files are missing the support/friend section or QR asset paths'),
  )
  checks.push(
    wechatPayQr !== null &&
      wechatFriendQr !== null &&
      wechatPayQr.byteLength > 10_000 &&
      wechatFriendQr.byteLength > 10_000
      ? pass('readme-support-qr-assets', 'support QR image assets exist and are not empty placeholders')
      : fail('readme-support-qr-assets', 'expected exact QR assets at docs/assets/wechat-pay.jpg and docs/assets/wechat-friend.jpg'),
  )
  checks.push(
    packageJson.includes('"release:fresh-install-windows-smoke"')
      ? pass('package-script-windows-smoke', 'package.json exposes the Windows install smoke command')
      : fail('package-script-windows-smoke', 'package.json is missing release:fresh-install-windows-smoke'),
  )
  return checks
}

function mdTable(staticResults: StaticCheck[], commandResults: CommandCheck[]): string {
  const staticRows = staticResults
    .map(row => `| ${row.id} | ${row.passed} | ${row.detail.replace(/\|/g, '/')} |`)
    .join('\n')
  const commandRows = commandResults
    .map(row => `| ${row.id} | ${row.passed} | ${row.exitCode} | ${row.durationMs} | ${row.stdoutPath} | ${row.stderrPath} |`)
    .join('\n')
  return [
    '## Static checks',
    '',
    '| id | passed | detail |',
    '|---|---:|---|',
    staticRows,
    '',
    '## Command checks',
    '',
    '| id | passed | exitCode | durationMs | stdout | stderr |',
    '|---|---:|---:|---:|---|---|',
    commandRows,
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(TRACE_DIR, { recursive: true })
  await mkdir(dirname(OUT_MD), { recursive: true })

  const staticResults = await staticChecks()
  const commandResults: CommandCheck[] = []

  if (process.platform === 'win32') {
    const desktopInstallCheck = `
$ErrorActionPreference = 'Stop'
& .\\scripts\\install-windows.ps1 -NoDependencies -NoLaunch -CreateWslShortcut -NoWindowsTerminalInstall
$desktop = [Environment]::GetFolderPath('Desktop')
$cmdPath = Join-Path $desktop 'DSXU Code WSL.cmd'
$lnkPath = Join-Path $desktop 'DSXU Code WSL.lnk'
if (-not (Test-Path -LiteralPath $cmdPath)) { throw 'missing DSXU Code WSL.cmd' }
if (-not (Test-Path -LiteralPath $lnkPath)) { throw 'missing DSXU Code WSL.lnk' }
$cmdText = Get-Content -LiteralPath $cmdPath -Raw
if ($cmdText -match 'wsl\\.exe\\s+-d|wsl\\.exe\\s+--cd|--cd\\s+"?/mnt/d/DSXU-code|bash\\s+-lc\\s+"exec bash') { throw 'stale WSL desktop command content' }
if ($cmdText -notmatch 'Start-DSXU-Code-WSL\\.cmd') { throw 'WSL desktop command does not delegate to the root launcher' }
if ($cmdText -notmatch 'wt\\.exe -w new new-tab') { throw 'WSL desktop command does not trampoline no-arg double-clicks into Windows Terminal' }
if ($cmdText -notmatch 'cmd\\.exe /k') { throw 'WSL desktop command missing Windows Terminal cmd.exe /k launch shape' }
if ($cmdText -notmatch 'call "%DSXU_LAUNCHER%" %\\*') { throw 'WSL desktop command does not preserve argument forwarding fallback' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
if ($shortcut.Arguments -notmatch '--\\s+cmd\\.exe\\s+/k') { throw 'WSL shortcut missing Windows Terminal command separator' }
if ($shortcut.Arguments -notmatch 'Start-DSXU-Code-WSL\\.cmd') { throw 'WSL shortcut does not call root launcher' }
Write-Host 'PASS: desktop WSL entrypoints regenerated'
`
    commandResults.push(
      await runCommand('windows-installer-regenerates-desktop-wsl-entrypoints', [
        'powershell.exe',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        desktopInstallCheck,
      ], [0]),
    )
    commandResults.push(
      await runCommand('windows-wsl-launcher-disabled-falls-back-to-native-version', [
        'powershell.exe',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        'scripts/start-dsxu-wsl-windows.ps1',
        '--version',
      ], [0], undefined, {
        DSXU_TEST_DISABLE_WSL: '1',
      }),
    )
    commandResults.push(
      await runCommand('windows-launcher-classic-interactive-blocks-without-wt', [
        'powershell.exe',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        'scripts/start-dsxu-windows.ps1',
      ], [2], undefined, {
        DSXU_TEST_DISABLE_WT_LOOKUP: '1',
      }),
    )
    commandResults.push(
      await runCommand('windows-product-entrypoint-classic-interactive-blocks', [
        'bun',
        '--env-file=.env',
        './src/entrypoints/dsxu-code.tsx',
      ], [1, 2]),
    )
    commandResults.push(
      await runCommand('windows-launcher-version', [
        'powershell.exe',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        'scripts/start-dsxu-windows.ps1',
        '--version',
      ], [0]),
    )
    commandResults.push(
      await runCommand('windows-launcher-missing-key-status', [
        'powershell.exe',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        'scripts/start-dsxu-windows.ps1',
        'auth',
        'status',
        '--text',
      ], [1]),
    )
    commandResults.push(
      await runCommand('windows-launcher-key-stdin', [
        'powershell.exe',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        'scripts/start-dsxu-windows.ps1',
        'auth',
        'login',
        '--api-key-stdin',
      ], [0], 'dsxu-test-windows-smoke-token\n'),
    )
  }

  const failedStatic = staticResults.filter(row => !row.passed)
  const failedCommands = commandResults.filter(row => !row.passed)
  const status = failedStatic.length === 0 && failedCommands.length === 0
    ? 'PASS_FRESH_INSTALL_WINDOWS_SMOKE'
    : 'FAIL_FRESH_INSTALL_WINDOWS_SMOKE'
  const report = {
    schemaVersion: 'dsxu.fresh-install-windows-smoke.v1',
    generatedAt: new Date().toISOString(),
    status,
    repoRoot: ROOT,
    staticCheckCount: staticResults.length,
    commandCheckCount: commandResults.length,
    failedStaticChecks: failedStatic.map(row => row.id),
    failedCommandChecks: failedCommands.map(row => row.id),
    evidenceRule:
      'This focused smoke verifies Windows source-install launchers, UTF-8 setup, WSL path detection, README/INSTALL surface, support QR assets, and isolated first-run key setup without storing or printing a real key.',
    staticResults,
    commandResults,
  }
  await Promise.all([
    writeFile(OUT_JSON, JSON.stringify(report, null, 2) + '\n', 'utf8'),
    writeFile(OUT_MD, [
      '# DSXU Fresh Install Windows Smoke - 2026-05-22',
      '',
      `Status: ${status}`,
      '',
      report.evidenceRule,
      '',
      mdTable(staticResults, commandResults),
      '',
    ].join('\n'), 'utf8'),
  ])
  console.log(JSON.stringify({
    status,
    staticCheckCount: report.staticCheckCount,
    commandCheckCount: report.commandCheckCount,
    failedStaticChecks: report.failedStaticChecks,
    failedCommandChecks: report.failedCommandChecks,
    outJson: OUT_JSON,
    outMd: OUT_MD,
  }, null, 2))
  if (status !== 'PASS_FRESH_INSTALL_WINDOWS_SMOKE') {
    process.exit(1)
  }
}

await main()
