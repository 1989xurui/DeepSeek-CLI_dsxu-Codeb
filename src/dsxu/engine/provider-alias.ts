import {
  createLocalDSXUProviderContract,
  type DSXUProviderEvent,
} from './provider-contract'

const PROVIDER_ALIAS_COMMANDS = new Set([
  'remote-control',
  'rc',
  'remote',
  'sync',
  'bridge',
])

export type DSXUProviderAliasResult = {
  handled: boolean
  exitCode: number
  message: string
  events: readonly DSXUProviderEvent[]
}

export function isDsxuProviderAliasCommand(command: string | undefined): boolean {
  return command !== undefined && PROVIDER_ALIAS_COMMANDS.has(command)
}

export async function handleDsxuProviderAliasCommand(
  command: string | undefined,
  options: {
    cwd?: string
    sessionId?: string
  } = {},
): Promise<DSXUProviderAliasResult | undefined> {
  if (!isDsxuProviderAliasCommand(command)) return undefined

  const events: DSXUProviderEvent[] = []
  const provider = createLocalDSXUProviderContract({
    emitEvent: event => events.push(event),
  })
  const sessionId =
    options.sessionId ??
    `provider-alias-${command}-${Date.now().toString(36)}`
  const remote = await provider.createRemoteSession({
    sessionId,
    cwd: options.cwd ?? process.cwd(),
    metadata: {
      alias: command,
      archivedBridgeEnabled: provider.archivedBridge.enabled,
      archivedBridgeFlag: provider.archivedBridge.flagName,
    },
  })

  return {
    handled: true,
    exitCode: 1,
    events,
    message: [
      `DSXU provider alias "${command}" is blocked in the default local coding mainline.`,
      `Remote session status: ${remote.status}.`,
      remote.reason ? `Reason: ${remote.reason}` : undefined,
      `Archived bridge remains opt-in only via ${provider.archivedBridge.flagName} for isolated migration work.`,
    ].filter(Boolean).join('\n'),
  }
}
