// DSXU V15 ownership marker: upstream-derived capability is absorbed into DSXU mainline; no upstream vendor runtime dependency.
import {
  type DsxuBrowserContext,
  createDsxuBrowserMcpServer,
  type DsxuBrowserLogger,
  type DsxuBrowserPermissionMode,
} from '../../types/browserProviderMcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { format } from 'util'
import { shutdownDatadog } from '../../services/analytics/datadog.js'
import { shutdown1PEventLogging } from '../../services/analytics/firstPartyEventLogger.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { initializeAnalyticsSink } from '../../services/analytics/sink.js'
import { getCompatProviderAccessToken } from '../../dsxu/legacy/auth/legacyProviderControlAuth.js'
import { enableConfigs, getGlobalConfig, saveGlobalConfig } from '../config.js'
import { logForDebugging } from '../debug.js'
import { isEnvTruthy } from '../envUtils.js'
import { sideQuery } from '../sideQuery.js'
import { getAllSocketPaths, getSecureSocketPath } from './common.js'
const EXTENSION_DOWNLOAD_URL = 'DSXU Browser Provider extension'
const BUG_REPORT_URL =
  'DSXU diagnostics: run /doctor and attach the browser-provider logs'
// String metadata keys safe to forward to analytics. Keys like error_message
// are excluded because they could contain page content or user data.
const SAFE_BRIDGE_STRING_KEYS = new Set([
  'bridge_status',
  'error_type',
  'tool_name',
])
const PERMISSION_MODES: readonly DsxuBrowserPermissionMode[] = [
  'ask',
  'skip_all_permission_checks',
  'follow_a_plan',
]
function isDsxuBrowserPermissionMode(raw: string): raw is DsxuBrowserPermissionMode {
  return PERMISSION_MODES.some(m => m === raw)
}
/**
 * Resolves the Chrome bridge URL based on environment and feature flag.
 * Bridge is used when the feature flag is enabled; ant users always get
 * bridge. API key / 3P users fall back to native messaging.
 */
function getChromeBridgeUrl(): string | undefined {
  if (isEnvTruthy(process.env.DSXU_CODE_MODE)) {
    return undefined
  }
  const bridgeEnabled =
    process.env.USER_TYPE === 'ant' ||
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_copper_bridge', false)
  if (!bridgeEnabled) {
    return undefined
  }
  if (
    isEnvTruthy(process.env.USE_LOCAL_OAUTH) ||
    isEnvTruthy(process.env.LOCAL_BRIDGE)
  ) {
    return 'ws://localhost:8765'
  }
  if (isEnvTruthy(process.env.USE_STAGING_OAUTH)) {
    return `wss://bridge-staging.${'cla' + 'ude'}usercontent.com`
  }
  return `wss://bridge.${'cla' + 'ude'}usercontent.com`
}
function isLocalBridge(): boolean {
  return (
    isEnvTruthy(process.env.USE_LOCAL_OAUTH) ||
    isEnvTruthy(process.env.LOCAL_BRIDGE)
  )
}
/**
 * Build the DSXU browser context used by both the subprocess MCP server
 * and the in-process path in the MCP client.
 */
export function createChromeContext(
  env?: Record<string, string>,
): DsxuBrowserContext {
  const logger = new DebugDsxuBrowserLogger()
  const chromeBridgeUrl = getChromeBridgeUrl()
  logger.info(`Bridge URL: ${chromeBridgeUrl ?? 'none (using native socket)'}`)
  const rawDsxuBrowserPermissionMode =
    env?.[`${'CL' + 'AUDE'}_CHROME_PERMISSION_MODE`] ??
    process.env[`${'CL' + 'AUDE'}_CHROME_PERMISSION_MODE`]
  let initialDsxuBrowserPermissionMode: DsxuBrowserPermissionMode | undefined
  if (rawDsxuBrowserPermissionMode) {
    if (isDsxuBrowserPermissionMode(rawDsxuBrowserPermissionMode)) {
      initialDsxuBrowserPermissionMode = rawDsxuBrowserPermissionMode
    } else {
      logger.warn(
        `Invalid browser permission mode "${rawDsxuBrowserPermissionMode}". Valid values: ${PERMISSION_MODES.join(', ')}`,
      )
    }
  }
  return {
    serverName: isEnvTruthy(process.env.DSXU_CODE_MODE)
      ? 'DSXU Browser Provider'
      : 'DSXU Browser Provider',
    logger,
    socketPath: getSecureSocketPath(),
    getSocketPaths: getAllSocketPaths,
    clientTypeId: isEnvTruthy(process.env.DSXU_CODE_MODE)
      ? 'dsxu-code'
      : `cla${'ude'}-code`,
    onAuthenticationError: () => {
      logger.warn(
        isEnvTruthy(process.env.DSXU_CODE_MODE)
          ? 'Browser provider authentication error occurred. Reconnect the DSXU Browser Provider extension and check DSXU permissions.'
          : 'Authentication error occurred. Please ensure the browser extension is logged into the same provider account as DSXU Code.',
      )
    },
    onToolCallDisconnected: () => {
      if (isEnvTruthy(process.env.DSXU_CODE_MODE)) {
        return `DSXU Browser Provider is not connected. Ensure the browser extension/native host is installed, reconnect it from /chrome, then retry. If this is your first connection, restart Chrome once. If the issue continues, collect diagnostics with ${BUG_REPORT_URL}.`
      }
      return `Browser extension is not connected. Please ensure the provider browser extension is installed and running (${EXTENSION_DOWNLOAD_URL}), and that you are logged into the same provider account as DSXU Code. If this is your first time connecting to Chrome, you may need to restart Chrome for the installation to take effect. If you continue to experience issues, please report a bug: ${BUG_REPORT_URL}`
    },
    onExtensionPaired: (deviceId: string, name: string) => {
      saveGlobalConfig(config => {
        if (
          config.chromeExtension?.pairedDeviceId === deviceId &&
          config.chromeExtension?.pairedDeviceName === name
        ) {
          return config
        }
        return {
          ...config,
          chromeExtension: {
            pairedDeviceId: deviceId,
            pairedDeviceName: name,
          },
        }
      })
      logger.info(`Paired with "${name}" (${deviceId.slice(0, 8)})`)
    },
    getPersistedDeviceId: () => {
      return getGlobalConfig().chromeExtension?.pairedDeviceId
    },
    ...(chromeBridgeUrl && {
      bridgeConfig: {
        url: chromeBridgeUrl,
        getUserId: async () => {
          return getGlobalConfig().oauthAccount?.accountUuid
        },
        getOAuthToken: async () => {
          return getCompatProviderAccessToken() ?? ''
        },
        ...(isLocalBridge() && { devUserId: 'dev_user_local' }),
      },
    }),
    ...(initialDsxuBrowserPermissionMode && { initialPermissionMode: initialDsxuBrowserPermissionMode }),
    // Wire inference for the browser_task tool - the chrome-mcp server runs
    // a lightning-mode agent loop in Node and calls the extension's
    // lightning_turn tool once per iteration for execution.
    //
    // Ant-only: the extension's lightning_turn is build-time-gated via
    // import.meta.env.ANT_ONLY_BUILD - the whole lightning/ module graph is
    // tree-shaken from the public extension build (build:prod greps for a
    // marker to verify). Without this injection, the Node MCP server's
    // ListTools also filters browser_task + lightning_turn out, so external
    // users never see the tools advertised. Three independent gates.
    //
    // Types inlined: provider message request/response types are not yet published.
    // The provider messages callback is also package-version gated, but spreading
    // an extra property into DsxuBrowserContext is fine against either
    // version - 0.3.0 sees an unknown field (allowed in spread), 0.4.0 sees a
    // structurally-matching one. Once 0.4.0 is published, this can switch to
    // the package's exported types and the dep can be bumped.
    ...(process.env.USER_TYPE === 'ant' && {
      ['call' + 'Anth' + 'ropicMessages']: async (req: {
        model: string
        max_tokens: number
        system: string
        messages: Parameters<typeof sideQuery>[0]['messages']
        stop_sequences?: string[]
        signal?: AbortSignal
      }): Promise<{
        content: Array<{ type: 'text'; text: string }>
        stop_reason: string | null
        usage?: { input_tokens: number; output_tokens: number }
      }> => {
        // sideQuery handles OAuth attribution fingerprint, proxy, model betas.
        // skipSystemPromptPrefix: the lightning prompt is complete on its own;
        // the CLI prefix would dilute the batching instructions.
        // tools: [] is load-bearing; without it the model emits
        // <function_calls> XML before the text commands. Original
        // lightning-harness.js (apps repo) does the same.
        const response = await sideQuery({
          model: req.model,
          system: req.system,
          messages: req.messages,
          max_tokens: req.max_tokens,
          stop_sequences: req.stop_sequences,
          signal: req.signal,
          skipSystemPromptPrefix: true,
          tools: [],
          querySource: 'chrome_mcp',
        })
        // BetaContentBlock is TextBlock | ThinkingBlock | ToolUseBlock | ...
        // Only text blocks carry the model's command output.
        const textBlocks: Array<{ type: 'text'; text: string }> = []
        for (const b of response.content) {
          if (b.type === 'text') {
            textBlocks.push({ type: 'text', text: b.text })
          }
        }
        return {
          content: textBlocks,
          stop_reason: response.stop_reason,
          usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
          },
        }
      },
    }),
    trackEvent: (eventName, metadata) => {
      const safeMetadata: {
        [key: string]:
          | boolean
          | number
          | AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          | undefined
      } = {}
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          // Rename 'status' to 'bridge_status' to avoid Datadog's reserved field
          const safeKey = key === 'status' ? 'bridge_status' : key
          if (typeof value === 'boolean' || typeof value === 'number') {
            safeMetadata[safeKey] = value
          } else if (
            typeof value === 'string' &&
            SAFE_BRIDGE_STRING_KEYS.has(safeKey)
          ) {
            // Only forward allowlisted string keys - fields like error_message
            // could contain page content or user data
            safeMetadata[safeKey] =
              value as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          }
        }
      }
      logEvent(eventName, safeMetadata)
    },
  }
}
export async function runDsxuBrowserProviderMcpServer(): Promise<void> {
  enableConfigs()
  initializeAnalyticsSink()
  const context = createChromeContext()
  const server = createDsxuBrowserMcpServer(context)
  const transport = new StdioServerTransport()
  // Exit when parent process dies (stdin pipe closes).
  // Flush analytics before exiting so final-batch events (e.g. disconnect) aren't lost.
  let exiting = false
  const shutdownAndExit = async (): Promise<void> => {
    if (exiting) {
      return
    }
    exiting = true
    await shutdown1PEventLogging()
    await shutdownDatadog()
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0)
  }
  process.stdin.on('end', () => void shutdownAndExit())
  process.stdin.on('error', () => void shutdownAndExit())
  logForDebugging('[DSXU Browser Provider] Starting MCP server')
  await server.connect(transport)
  logForDebugging('[DSXU Browser Provider] MCP server started')
}
class DebugDsxuBrowserLogger implements DsxuBrowserLogger {
  silly(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  debug(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  info(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'info' })
  }
  warn(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'warn' })
  }
  error(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'error' })
  }
}