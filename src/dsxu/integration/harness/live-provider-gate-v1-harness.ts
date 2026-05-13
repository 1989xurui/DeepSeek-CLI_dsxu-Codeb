import { execFile } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const WSL_PROVIDER_ENV_KEYS = [
  'DSXU_API_KEY',
  'DEEPSEEK_API_KEY',
  'DSXU_DEEPSEEK_API_KEY',
  'LITELLM_BASE_URL',
  'DSXU_MODEL_PROVIDER',
  'DSXU_MODEL_GATEWAY',
]

export type LiveProviderGateStatus = 'READY' | 'BLOCKED-EVIDENCED'

export type LiveProviderGateResult = {
  ok: boolean
  status: LiveProviderGateStatus
  evidencePath: string
  generatedAt: string
  executionTarget: 'current-process' | 'wsl'
  probe: {
    DSXU_API_KEY: boolean
    DEEPSEEK_API_KEY: boolean
    DSXU_DEEPSEEK_API_KEY: boolean
    LITELLM_BASE_URL: boolean
    DSXU_MODEL_PROVIDER: boolean
    DSXU_MODEL_GATEWAY: boolean
  }
  targetProbe?: {
    distro?: string
    envReadOk: boolean
    error?: string
  }
  blockedItems: string[]
  nextStep: string
}

export type LiveProviderGateOptions = {
  env?: Record<string, string | undefined>
  evidencePath?: string
  generatedAt?: string
  executionTarget?: 'current-process' | 'wsl'
  distro?: string
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function evaluateLiveProviderGate(
  options: LiveProviderGateOptions = {},
): LiveProviderGateResult {
  const env = options.env ?? process.env
  const executionTarget = options.executionTarget ?? 'current-process'
  const evidencePath =
    options.evidencePath ??
    join(process.cwd(), '.dsxu', 'trace', 'v18-live-provider', 'live-provider-gate.json')
  const probe = {
    DSXU_API_KEY: hasValue(env.DSXU_API_KEY),
    DEEPSEEK_API_KEY: hasValue(env.DEEPSEEK_API_KEY),
    DSXU_DEEPSEEK_API_KEY: hasValue(env.DSXU_DEEPSEEK_API_KEY),
    LITELLM_BASE_URL: hasValue(env.LITELLM_BASE_URL),
    DSXU_MODEL_PROVIDER: hasValue(env.DSXU_MODEL_PROVIDER),
    DSXU_MODEL_GATEWAY: hasValue(env.DSXU_MODEL_GATEWAY),
  }
  const ready =
    probe.DSXU_API_KEY ||
    probe.DEEPSEEK_API_KEY ||
    probe.DSXU_DEEPSEEK_API_KEY ||
    probe.LITELLM_BASE_URL ||
    probe.DSXU_MODEL_GATEWAY

  return {
    ok: ready,
    status: ready ? 'READY' : 'BLOCKED-EVIDENCED',
    evidencePath,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    executionTarget,
    probe,
    targetProbe:
      executionTarget === 'wsl'
        ? {
            distro: options.distro ?? 'Ubuntu',
            envReadOk: true,
          }
        : undefined,
    blockedItems: ready
      ? []
      : [
          'live model-driven Agent worker -> parent synthesis -> final evidence replay',
          'live provider-backed real TUI long-task/resume replay',
          'live token/cost evidence from provider usage records',
        ],
    nextStep: ready
      ? executionTarget === 'wsl'
        ? 'Run scoped WSL live replay with Flash-first entry and Pro only for planning/recovery/failed verification.'
        : 'Run scoped live replay with Flash-first entry and Pro only for planning/recovery/failed verification.'
      : executionTarget === 'wsl'
        ? 'Configure provider credentials inside the WSL distro used by the TUI, then rerun the same harness.'
        : 'Keep deterministic replay evidence, report BLOCKED, and do not mark live provider behavior DONE.',
  }
}

async function readWslProviderEnv(distro: string): Promise<{
  env: Record<string, string | undefined>
  error?: string
}> {
  const keys = WSL_PROVIDER_ENV_KEYS
  const presentProviderKeys = keys.filter(key => hasValue(process.env[key]))
  const forwarded = presentProviderKeys.map(key => `${key}/u`)
  const wslEnv = forwarded.length > 0
    ? {
        ...process.env,
        WSLENV: [
          ...(process.env.WSLENV ? process.env.WSLENV.split(':').filter(Boolean) : []),
          ...forwarded,
        ].join(':'),
      }
    : process.env
  const script = [
    'set +u',
    ...keys.map(key => `if [ -n "\${${key}:-}" ]; then printf '${key}=1\\n'; else printf '${key}=0\\n'; fi`),
  ].join('; ')
  try {
    const { stdout } = await execFileAsync(
      'wsl.exe',
      ['-d', distro, '--', 'bash', '-lc', script],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
        env: wslEnv,
        windowsHide: true,
      },
    )
    const env: Record<string, string | undefined> = {}
    for (const line of String(stdout).split(/\r?\n/)) {
      const [key, value] = line.split('=')
      if (keys.includes(key ?? '')) env[key!] = value === '1' ? 'present' : undefined
    }
    return { env }
  } catch (error) {
    return {
      env: {},
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function writeLiveProviderGateEvidence(
  options: LiveProviderGateOptions = {},
): Promise<LiveProviderGateResult> {
  const executionTarget = options.executionTarget ?? 'current-process'
  const distro = options.distro ?? 'Ubuntu'
  const wslEnv =
    executionTarget === 'wsl' && !options.env
      ? await readWslProviderEnv(distro)
      : undefined
  const result = evaluateLiveProviderGate({
    ...options,
    env: wslEnv?.env ?? options.env,
    executionTarget,
    distro,
    evidencePath: resolve(
      options.evidencePath ??
        join(process.cwd(), '.dsxu', 'trace', 'v18-live-provider', 'live-provider-gate.json'),
    ),
  })
  if (wslEnv?.error || result.targetProbe) {
    result.targetProbe = {
      distro,
      envReadOk: !wslEnv?.error,
      error: wslEnv?.error,
    }
  }
  await mkdir(dirname(result.evidencePath), { recursive: true })
  await writeFile(result.evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  return result
}
