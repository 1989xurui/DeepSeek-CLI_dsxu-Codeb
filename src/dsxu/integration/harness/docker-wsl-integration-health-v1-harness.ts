import { execFile } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type DsxuDockerWslIntegrationStatus =
  | 'DONE_EVIDENCED'
  | 'BLOCKED_EVIDENCED'

export type DsxuDockerWslIntegrationEvidence = {
  status: DsxuDockerWslIntegrationStatus
  ok: boolean
  generatedAt: string
  evidencePath: string
  distro: string
  checks: {
    windowsDockerServer: boolean
    proxyFileExecutable: boolean
    proxyFileNonEmpty: boolean
    dockerSocketPresent: boolean
    ubuntuDockerCli: boolean
    ubuntuDockerServer: boolean
    proxyProcessAlive: boolean
    sawPermissionDenied: boolean
    sawZeroByteProxy: boolean
  }
  outputs: {
    windowsDocker: string
    proxyFile: string
    ubuntuDocker: string
    proxyProcess: string
  }
  blockers: readonly string[]
  nextStep: string
}

async function runCommand(command: string, args: string[], timeoutMs = 30_000): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    })
    return `${stdout}${stderr}`.trim()
  } catch (error) {
    const stdout = String((error as { stdout?: unknown })?.stdout ?? '')
    const stderr = String((error as { stderr?: unknown })?.stderr ?? '')
    const message = error instanceof Error ? error.message : String(error)
    return `${stdout}${stderr}${message ? `\n${message}` : ''}`.trim()
  }
}

async function runWsl(distro: string, user: string, script: string): Promise<string> {
  return runCommand('wsl.exe', ['-d', distro, '-u', user, '--', 'bash', '-lc', script])
}

export function classifyDsxuDockerWslIntegration(input: {
  distro: string
  evidencePath: string
  windowsDocker: string
  proxyFile: string
  ubuntuDocker: string
  proxyProcess: string
  nowIso?: string
}): DsxuDockerWslIntegrationEvidence {
  const all = [
    input.windowsDocker,
    input.proxyFile,
    input.ubuntuDocker,
    input.proxyProcess,
  ].join('\n')
  const proxyLines = input.proxyFile
    .split(/\r?\n/)
    .filter(line => line.includes('docker-desktop-user-distro'))
    .join('\n')
  const checks = {
    windowsDockerServer: /Server:\s*\d+\.\d+\.\d+|ServerVersion=\d+\.\d+\.\d+|\b\d+\.\d+\.\d+\b/.test(input.windowsDocker),
    proxyFileExecutable: /docker-desktop-user-distro[\s\S]*(?:-rwx|Access:\s*\(0755\/-rwx)/.test(input.proxyFile),
    proxyFileNonEmpty: /Size:\s*(?!0\b)\d+|docker-desktop-user-distro[\s\S]+\b[1-9]\d{4,}\b/.test(input.proxyFile),
    dockerSocketPresent: /\/var\/run\/docker\.sock/.test(input.proxyFile),
    ubuntuDockerCli: /\/docker\b|Client:\s*\n\s*Version:|\bClientVersion=/.test(input.ubuntuDocker),
    ubuntuDockerServer: /Server:\s*\n\s*Version:|ServerVersion=\d+\.\d+\.\d+|\bServer:\s+Docker Desktop\b/.test(input.ubuntuDocker),
    proxyProcessAlive: /docker-desktop-user-distro\s+proxy|proxy_alive/.test(input.proxyProcess),
    sawPermissionDenied: /Permission denied|execvpe\(\/mnt\/wsl\/docker-desktop\/docker-desktop-user-distro\) failed/i.test(all),
    sawZeroByteProxy:
      /(?:^|\n)[^\n]*\s0\s+\w{3}\s+[^\n]*docker-desktop-user-distro/.test(proxyLines) ||
      /Size:\s*0\b|regular empty file/.test(input.proxyFile),
  }
  const blockers: string[] = []
  if (!checks.windowsDockerServer) blockers.push('Windows Docker Desktop server is unavailable')
  if (!checks.proxyFileExecutable) blockers.push('Docker Desktop WSL proxy file is not executable')
  if (!checks.proxyFileNonEmpty) blockers.push('Docker Desktop WSL proxy file is empty or missing')
  if (!checks.dockerSocketPresent) blockers.push('Ubuntu docker socket is missing')
  if (!checks.ubuntuDockerCli) blockers.push('Ubuntu Docker CLI is unavailable')
  if (!checks.ubuntuDockerServer) blockers.push('Ubuntu Docker CLI cannot reach Docker Desktop server')
  if (!checks.proxyProcessAlive) blockers.push('Docker Desktop WSL integration proxy process is not running')
  if (checks.sawPermissionDenied) blockers.push('Docker Desktop WSL proxy reported permission denied')
  if (checks.sawZeroByteProxy) blockers.push('Docker Desktop WSL proxy file appears to be zero bytes')
  const ok =
    checks.windowsDockerServer &&
    checks.proxyFileExecutable &&
    checks.proxyFileNonEmpty &&
    checks.dockerSocketPresent &&
    checks.ubuntuDockerCli &&
    checks.ubuntuDockerServer &&
    checks.proxyProcessAlive &&
    !checks.sawPermissionDenied &&
    !checks.sawZeroByteProxy

  return {
    status: ok ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok,
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath: input.evidencePath,
    distro: input.distro,
    checks,
    outputs: {
      windowsDocker: input.windowsDocker,
      proxyFile: input.proxyFile,
      ubuntuDocker: input.ubuntuDocker,
      proxyProcess: input.proxyProcess,
    },
    blockers,
    nextStep: ok
      ? 'Docker Desktop WSL integration is healthy for container-backed tasks.'
      : 'Restart Docker Desktop WSL integration, then verify the proxy file is a non-empty executable and Ubuntu docker can reach the server before running container-backed tasks.',
  }
}

export async function runDsxuDockerWslIntegrationHealth(input: {
  distro?: string
  evidenceDir?: string
  nowIso?: string
} = {}): Promise<DsxuDockerWslIntegrationEvidence> {
  const distro = input.distro ?? 'Ubuntu'
  const evidenceDir = input.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'docker-wsl-integration-health-20260507.evidence.json')
  await mkdir(evidenceDir, { recursive: true })

  const windowsDocker = await runCommand('docker.exe', ['version'])
  const proxyFile = await runWsl(
    distro,
    'root',
    [
      'ls -l /mnt/wsl/docker-desktop/docker-desktop-user-distro /var/run/docker.sock 2>&1',
      'stat /mnt/wsl/docker-desktop/docker-desktop-user-distro 2>&1',
      'file /mnt/wsl/docker-desktop/docker-desktop-user-distro 2>&1',
    ].join('; '),
  )
  const ubuntuDocker = await runWsl(
    distro,
    'root',
    [
      'command -v docker 2>&1',
      'docker version 2>&1',
      'docker ps 2>&1',
    ].join('; '),
  )
  const proxyProcess = await runWsl(
    distro,
    'root',
    "ps -eo comm,args | grep docker-desktop-user-distro | grep -v grep || true",
  )
  const evidence = classifyDsxuDockerWslIntegration({
    distro,
    evidencePath,
    windowsDocker,
    proxyFile,
    ubuntuDocker,
    proxyProcess,
    nowIso: input.nowIso,
  })
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  return evidence
}
