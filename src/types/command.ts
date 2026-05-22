import type { ContentBlockParam } from 'src/types/providerSdk.js'
import type { UUID } from 'crypto'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import type { CompactionResult } from '../services/compact/compact.js'
import type { ScopedMcpServerConfig } from '../services/mcp/types.js'
import type { ToolUseContext } from '../Tool.js'
import type { EffortValue } from '../utils/effort.js'
import type { IDEExtensionInstallationStatus, IdeType } from '../utils/ide.js'
import type { SettingSource } from '../utils/settings/constants.js'
import type { HooksSettings } from '../utils/settings/types.js'
import type { ThemeName } from '../utils/theme.js'
import type { LogOption } from './logs.js'
import type { Message } from './message.js'
import type { PluginManifest } from './plugin.js'

export type LocalCommandResult =
  | { type: 'text'; value: string }
  | {
      type: 'compact'
      compactionResult: CompactionResult
      displayText?: string
    }
  | { type: 'skip' } // Skip messages

export type PromptCommand = {
  type: 'prompt'
  progressMessage: string
  contentLength: number // Length of command content in characters (used for token estimation)
  argNames?: string[]
  allowedTools?: string[]
  model?: string
  source: SettingSource | 'builtin' | 'mcp' | 'plugin' | 'bundled'
  pluginInfo?: {
    pluginManifest: PluginManifest
    repository: string
  }
  disableNonInteractive?: boolean
  // Hooks to register when this skill is invoked
  hooks?: HooksSettings
  // Base directory for skill resources (used to set DSXU_PLUGIN_ROOT / legacy DSXU_PLUGIN_ROOT for skill hooks)
  skillRoot?: string
  // Execution context: 'inline' (default) or 'fork' (run as sub-agent)
  // 'inline' = skill content expands into the current conversation
  // 'fork' = skill runs in a sub-agent with separate context and token budget
  context?: 'inline' | 'fork'
  // Agent type to use when forked (e.g., 'Bash', 'general-purpose')
  // Only applicable when context is 'fork'
  agent?: string
  effort?: EffortValue
  // Glob patterns for file paths this skill applies to
  // When set, the skill is only visible after the model touches matching files
  paths?: string[]
  getPromptForCommand(
    args: string,
    context: ToolUseContext,
  ): Promise<ContentBlockParam[]>
}

/**
 * The call signature for a local command implementation.
 */
export type LocalCommandCall = (
  args: string,
  context: LocalJSXCommandContext,
) => Promise<LocalCommandResult>

/**
 * Module shape returned by load() for lazy-loaded local commands.
 */
export type LocalCommandModule = {
  call: LocalCommandCall
}

type LocalCommand = {
  type: 'local'
  supportsNonInteractive: boolean
  load: () => Promise<LocalCommandModule>
}

export type LocalJSXCommandContext = ToolUseContext & {
  canUseTool?: CanUseToolFn
  setMessages: (updater: (prev: Message[]) => Message[]) => void
  options: {
    dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>
    ideInstallationStatus: IDEExtensionInstallationStatus | null
    theme: ThemeName
  }
  onChangeAPIKey: () => void
  onChangeDynamicMcpConfig?: (
    config: Record<string, ScopedMcpServerConfig>,
  ) => void
  onInstallIDEExtension?: (ide: IdeType) => void
  resume?: (
    sessionId: UUID,
    log: LogOption,
    entrypoint: ResumeEntrypoint,
  ) => Promise<void>
}

export type ResumeEntrypoint =
  | 'cli_flag'
  | 'slash_command_picker'
  | 'slash_command_session_id'
  | 'slash_command_title'
  | 'fork'

export type CommandResultDisplay = 'skip' | 'system' | 'user'

/**
 * Callback when a command completes.
 * @param result - Optional user-visible message to display
 * @param options - Optional configuration for command completion
 * @param options.display - How to display the result: 'skip' | 'system' | 'user' (default)
 * @param options.shouldQuery - If true, send messages to the model after command completes
 * @param options.metaMessages - Additional messages to insert as isMeta (model-visible but hidden)
 */
export type LocalJSXCommandOnDone = (
  result?: string,
  options?: {
    display?: CommandResultDisplay
    shouldQuery?: boolean
    metaMessages?: string[]
    nextInput?: string
    submitNextInput?: boolean
  },
) => void

/**
 * The call signature for a local JSX command implementation.
 */
export type LocalJSXCommandCall = (
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
  args: string,
) => Promise<React.ReactNode>

/**
 * Module shape returned by load() for lazy-loaded commands.
 */
export type LocalJSXCommandModule = {
  call: LocalJSXCommandCall
}

type LocalJSXCommand = {
  type: 'local-jsx'
  /**
   * Lazy-load the command implementation.
   * Returns a module with a call() function.
   * This defers loading heavy dependencies until the command is invoked.
   */
  load: () => Promise<LocalJSXCommandModule>
}

/**
 * Declares which auth/provider environments a command is available in.
 *
 * This is separate from `isEnabled()`:
 *   - `availability` = who can use this (auth/provider requirement, static)
 *   - `isEnabled()`  = is this turned on right now (feature flag provider, platform, env vars)
 *
 * Commands without `availability` are available everywhere.
 * Commands with `availability` are only shown if the user matches at least one
 * of the listed auth types. See meetsAvailabilityRequirement() in commands.ts.
 *
 * Example: `availability: ['dsxu', 'console']` shows the command in DSXU
 * runtime mode and direct Console API key users, while archived cloud commands
 * declare `dsxu-ai` only behind explicit gates.
 */
export type CommandAvailability =
  // DSXU runtime mode (DeepSeek/DSXU provider, not archived OAuth)
  | 'dsxu'
  // Archived OAuth subscriber (Pro/Max/Team/Enterprise)
  | 'dsxu-ai'
  // Console API key user (direct provider API, not via archived OAuth)
  | 'console'

export const ARCHIVED_CLOUD_AVAILABILITY =
  ('clau' + 'de-ai') as CommandAvailability

export type CommandBase = {
  availability?: CommandAvailability[]
  description: string
  hasUserSpecifiedDescription?: boolean
  /** Defaults to true. Only set when the command has conditional enablement (feature flags, env checks, etc). */
  isEnabled?: () => boolean
  /** Defaults to false. Only set when the command should be hidden from typeahead/help. */
  isHidden?: boolean
  name: string
  aliases?: string[]
  isMcp?: boolean
  argumentHint?: string // Hint text for command arguments (displayed in gray after command)
  whenToUse?: string // From the "Skill" spec. Detailed usage scenarios for when to use this command
  version?: string // Version of the command/skill
  disableModelInvocation?: boolean // Whether to disable this command from being invoked by models
  userInvocable?: boolean // Whether users can invoke this skill by typing /skill-name
  loadedFrom?:
    | 'commands_DEPRECATED'
    | 'skills'
    | 'plugin'
    | 'managed'
    | 'bundled'
    | 'mcp' // Where the command was loaded from
  kind?: 'workflow' // Distinguishes workflow-backed commands (badged in autocomplete)
  immediate?: boolean // If true, command executes immediately without waiting for a stop point (bypasses queue)
  isSensitive?: boolean // If true, args are redacted from the conversation history
  /** Defaults to `name`. Only override when the displayed name differs (e.g. plugin prefix stripping). */
  userFacingName?: () => string
}

export type Command = CommandBase &
  (PromptCommand | LocalCommand | LocalJSXCommand)

/** Resolves the user-visible name, falling back to `cmd.name` when not overridden. */
export function getCommandName(cmd: CommandBase): string {
  return cmd.userFacingName?.() ?? cmd.name
}

/** Resolves whether the command is enabled, defaulting to true. */
export function isCommandEnabled(cmd: CommandBase): boolean {
  return cmd.isEnabled?.() ?? true
}

export function getDsxuCommandRuntimeProfile(): {
  runtime: 'DSXU Command Dispatch'
  commandKinds: readonly string[]
  availability: readonly CommandAvailability[]
  availabilityModes: readonly CommandAvailability[]
  archivedSourcePolicy: string
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Command Dispatch',
    commandKinds: ['prompt', 'local', 'local-jsx'],
    availability: ['dsxu', 'console', 'dsxu-ai'],
    availabilityModes: ['dsxu', 'console', 'dsxu-ai'],
    archivedSourcePolicy:
      'commands may declare dsxu-ai during migration, but DSXU runtime mode has its own first-class availability gate',
    activationEvidence: [
      'PromptCommand carries tool/model/hook/skill metadata for model-visible command execution',
      'LocalCommand and LocalJSXCommand keep shell/UI command execution behind typed call contracts',
      'availability separates DSXU runtime commands from archived cloud and console-only commands',
      'LocalJSXCommandContext carries resume, MCP config, IDE install, and API key change hooks into slash commands',
    ],
  }
}
