import { existsSync } from 'fs'
import { delimiter } from 'path'
import { spawnSync } from 'child_process'

export type NetworkHostPattern = {
  host: string
  port?: number
  protocol?: string
}

export type SandboxAskCallback = (
  hostPattern: NetworkHostPattern,
) => Promise<boolean> | boolean

export type FsReadRestrictionConfig = {
  denyOnly: string[]
  allowWithinDeny?: string[]
}

export type FsWriteRestrictionConfig = {
  allowOnly: string[]
  denyWithinAllow: string[]
}

export type IgnoreViolationsConfig = Record<string, unknown>

export type NetworkRestrictionConfig = {
  allowedHosts?: string[]
  deniedHosts?: string[]
}

export type SandboxDependencyCheck = {
  errors: string[]
  warnings: string[]
}

export type SandboxRuntimeConfig = {
  filesystem?: {
    denyRead?: string[]
    allowRead?: string[]
    allowWrite?: string[]
    denyWrite?: string[]
  }
  network?: {
    allowedDomains?: string[]
    deniedDomains?: string[]
    allowUnixSockets?: string[]
    allowAllUnixSockets?: boolean
    allowLocalBinding?: boolean
    httpProxyPort?: number
    socksProxyPort?: number
  }
  ignoreViolations?: IgnoreViolationsConfig
  enableWeakerNestedSandbox?: boolean
  enableWeakerNetworkIsolation?: boolean
  ripgrep?: Record<string, unknown>
}

export type SandboxViolationEvent = {
  timestamp: Date
  line: string
  command?: string
}

type SandboxRuntimeDependencyInput = {
  command?: string
  args?: string[]
}

class DsxuSandboxViolationStore {
  private readonly violations: SandboxViolationEvent[] = []
  private readonly subscribers = new Set<
    (violations: readonly SandboxViolationEvent[]) => void
  >()

  add(event: Omit<SandboxViolationEvent, 'timestamp'> & { timestamp?: Date }): void {
    this.violations.push({
      timestamp: event.timestamp ?? new Date(),
      line: event.line,
      command: event.command,
    })
    this.publish()
  }

  subscribe(
    subscriber: (violations: readonly SandboxViolationEvent[]) => void,
  ): () => void {
    this.subscribers.add(subscriber)
    subscriber([...this.violations])
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  getTotalCount(): number {
    return this.violations.length
  }

  reset(): void {
    this.violations.length = 0
    this.publish()
  }

  private publish(): void {
    const snapshot = [...this.violations]
    for (const subscriber of this.subscribers) {
      subscriber(snapshot)
    }
  }
}

const violationStore = new DsxuSandboxViolationStore()

let activeConfig: SandboxRuntimeConfig = {}
let initialized = false

function commandExists(command: string | undefined): boolean {
  if (!command) return false
  if (command.includes('/') || command.includes('\\')) {
    return existsSync(command)
  }

  const paths = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
      : ['']

  for (const dir of paths) {
    for (const ext of extensions) {
      if (existsSync(`${dir}/${command}${ext}`)) return true
    }
  }
  return false
}

function canRunCommand(command: string | undefined, args: string[] = []): boolean {
  if (!commandExists(command)) return false
  try {
    const result = spawnSync(command, args.slice(0, 4), {
      stdio: 'ignore',
      timeout: 2_000,
      windowsHide: true,
    })
    return result.error === undefined
  } catch {
    return false
  }
}

function isSupportedPlatform(): boolean {
  return process.platform === 'darwin' || process.platform === 'linux'
}

function getDependencyCheck(input: SandboxRuntimeDependencyInput = {}): SandboxDependencyCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isSupportedPlatform()) {
    errors.push('DSXU native sandbox runtime supports macOS, Linux, and WSL2 only')
    return { errors, warnings }
  }

  if (input.command && !commandExists(input.command)) {
    errors.push(`ripgrep command not found: ${input.command}`)
  }

  if (process.platform === 'linux') {
    if (!commandExists('bwrap')) errors.push('bwrap not found')
    if (!commandExists('socat')) errors.push('socat not found')
    if (!process.env.DSXU_NATIVE_SANDBOX_HELPER) {
      errors.push('DSXU native sandbox helper is not installed')
    }
  }

  if (process.platform === 'darwin' && !canRunCommand('/usr/bin/sandbox-exec', ['-h'])) {
    warnings.push('macOS sandbox-exec probe failed; sandbox will stay unavailable until the host tool is healthy')
  }

  return { errors, warnings }
}

export const SandboxRuntimeConfigSchema = {
  parse(config: unknown): SandboxRuntimeConfig {
    if (typeof config !== 'object' || config === null) return {}
    return config as SandboxRuntimeConfig
  },
}

export const SandboxViolationStore = DsxuSandboxViolationStore

export const BaseSandboxManager = {
  checkDependencies(input: SandboxRuntimeDependencyInput = {}): SandboxDependencyCheck {
    return getDependencyCheck(input)
  },

  isSupportedPlatform,

  async initialize(config: SandboxRuntimeConfig, _ask?: SandboxAskCallback): Promise<void> {
    const dependencyCheck = getDependencyCheck()
    if (dependencyCheck.errors.length > 0) {
      throw new Error(dependencyCheck.errors.join(', '))
    }
    activeConfig = SandboxRuntimeConfigSchema.parse(config)
    initialized = true
  },

  updateConfig(config: SandboxRuntimeConfig): void {
    activeConfig = SandboxRuntimeConfigSchema.parse(config)
  },

  async reset(): Promise<void> {
    initialized = false
    activeConfig = {}
    violationStore.reset()
  },

  async wrapWithSandbox(command: string): Promise<string> {
    if (!initialized) {
      throw new Error('DSXU native sandbox runtime is not initialized')
    }
    throw new Error(
      `DSXU native sandbox helper is unavailable; refusing to run unsandboxed command: ${command}`,
    )
  },

  getFsReadConfig(): FsReadRestrictionConfig {
    return {
      denyOnly: activeConfig.filesystem?.denyRead ?? [],
      allowWithinDeny: activeConfig.filesystem?.allowRead ?? [],
    }
  },

  getFsWriteConfig(): FsWriteRestrictionConfig {
    return {
      allowOnly: activeConfig.filesystem?.allowWrite ?? [],
      denyWithinAllow: activeConfig.filesystem?.denyWrite ?? [],
    }
  },

  getNetworkRestrictionConfig(): NetworkRestrictionConfig {
    return {
      allowedHosts: activeConfig.network?.allowedDomains ?? [],
      deniedHosts: activeConfig.network?.deniedDomains ?? [],
    }
  },

  getIgnoreViolations(): IgnoreViolationsConfig {
    return activeConfig.ignoreViolations ?? {}
  },

  getAllowUnixSockets(): string[] {
    return activeConfig.network?.allowUnixSockets ?? []
  },

  getAllowLocalBinding(): boolean {
    return activeConfig.network?.allowLocalBinding ?? false
  },

  getEnableWeakerNestedSandbox(): boolean {
    return activeConfig.enableWeakerNestedSandbox ?? false
  },

  getProxyPort(): number | undefined {
    return activeConfig.network?.httpProxyPort
  },

  getSocksProxyPort(): number | undefined {
    return activeConfig.network?.socksProxyPort
  },

  getLinuxHttpSocketPath(): string | undefined {
    return undefined
  },

  getLinuxSocksSocketPath(): string | undefined {
    return undefined
  },

  async waitForNetworkInitialization(): Promise<boolean> {
    return false
  },

  getSandboxViolationStore(): DsxuSandboxViolationStore {
    return violationStore
  },

  annotateStderrWithSandboxFailures(command: string, stderr: string): string {
    if (!stderr) return stderr
    return stderr
      .split(/\r?\n/)
      .map(line => {
        if (/permission denied|operation not permitted|network is unreachable/i.test(line)) {
          violationStore.add({ command, line })
        }
        return line
      })
      .join('\n')
  },

  cleanupAfterCommand(): void {
    // DSXU-owned runtime keeps no external subprocess state.
  },
}
