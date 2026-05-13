export type AmbiguousPowerShellProcessCleanupFinding = {
  form: 'stop-process-name' | 'get-process-pipe-stop' | 'taskkill-image'
  target: string
  message: string
}

const DEV_PROCESS_NAMES = ['node', 'node.exe', 'vite', 'vite.exe', 'npm', 'npm.cmd', 'pnpm', 'yarn', 'bun', 'bun.exe']

function commandStartsDevServer(command: string): boolean {
  return /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?dev\b/i.test(command) ||
    /\bnpx\s+vite\b/i.test(command) ||
    /(?:^|[;\r\n])\s*vite(?:\.cmd|\.ps1|\.exe)?\b/i.test(command)
}

function normalizeProcessName(name: string): string {
  return name.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
}

function isDevProcessName(name: string): boolean {
  return DEV_PROCESS_NAMES.includes(normalizeProcessName(name))
}

function findStopProcessName(command: string): string | null {
  const match = command.match(/\bStop-Process\b[^;\r\n|]*\s-(?:Name|ProcessName)\s+("[^"]+"|'[^']+'|[^\s;\r\n|]+)/i)
  const target = match?.[1]
  return target && isDevProcessName(target) ? normalizeProcessName(target) : null
}

function findGetProcessPipeStop(command: string): string | null {
  const match = command.match(/\bGet-Process\b\s+("[^"]+"|'[^']+'|[^\s;\r\n|]+)[^;\r\n|]*\|\s*Stop-Process\b/i)
  const target = match?.[1]
  return target && isDevProcessName(target) ? normalizeProcessName(target) : null
}

function findTaskkillImage(command: string): string | null {
  const match = command.match(/\btaskkill(?:\.exe)?\b[^;\r\n|]*\s\/IM\s+("[^"]+"|'[^']+'|[^\s;\r\n|]+)/i)
  const target = match?.[1]
  return target && isDevProcessName(target) ? normalizeProcessName(target) : null
}

export function detectAmbiguousPowerShellProcessCleanup(
  command: string,
): AmbiguousPowerShellProcessCleanupFinding | null {
  if (!commandStartsDevServer(command)) return null

  const stopProcessTarget = findStopProcessName(command)
  if (stopProcessTarget) {
    return {
      form: 'stop-process-name',
      target: stopProcessTarget,
      message:
        `Blocked: Stop-Process by broad process name "${stopProcessTarget}" immediately before starting a dev server can kill unrelated tooling and create false server readiness or Waiting states.`,
    }
  }

  const getProcessTarget = findGetProcessPipeStop(command)
  if (getProcessTarget) {
    return {
      form: 'get-process-pipe-stop',
      target: getProcessTarget,
      message:
        `Blocked: Get-Process "${getProcessTarget}" piped to Stop-Process immediately before starting a dev server is too broad and can kill unrelated tooling.`,
    }
  }

  const taskkillTarget = findTaskkillImage(command)
  if (taskkillTarget) {
    return {
      form: 'taskkill-image',
      target: taskkillTarget,
      message:
        `Blocked: taskkill /IM "${taskkillTarget}" immediately before starting a dev server is too broad and can kill unrelated tooling.`,
    }
  }

  return null
}

export function renderAmbiguousPowerShellProcessCleanupMessage(
  finding: AmbiguousPowerShellProcessCleanupFinding,
): string {
  return [
    finding.message,
    'Use a scoped port-owner cleanup instead, for example `Get-NetTCPConnection -LocalPort 5173 | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ }`.',
    'Then start the dev server as a background task and verify readiness with an HTTP poll before claiming it can open.',
  ].join(' ')
}
