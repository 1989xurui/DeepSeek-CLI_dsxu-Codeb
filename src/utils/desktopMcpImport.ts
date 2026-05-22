import { readdir, readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import {
  type McpServerConfig,
  McpStdioServerConfigSchema,
} from '../services/mcp/types.js'
import { getErrnoCode } from './errors.js'
import { safeParseJSON } from './json.js'
import { logError } from './log.js'
import { getPlatform, SUPPORTED_PLATFORMS } from './platform.js'

const DSXU_DESKTOP_MCP_CONFIG = 'dsxu_desktop_mcp_config.json'
const PROVIDER_MIGRATION_DESKTOP_MCP_CONFIG = 'dsxu_desktop_config.json'

export function getDsxuDesktopMcpImportRuntimeProfile(): {
  runtime: 'DSXU Desktop MCP Import'
  owner: 'DSXU MCP Config Intake Boundary'
  activationEvidence: readonly string[]
  releaseRiskControls: readonly string[]
} {
  return {
    runtime: 'DSXU Desktop MCP Import',
    owner: 'DSXU MCP Config Intake Boundary',
    activationEvidence: [
      'desktop import reads DSXU desktop MCP config first',
      'provider-migration desktop MCP config is accepted only as migration intake',
      'McpStdioServerConfigSchema validates imported server records',
      'unsupported platforms fail closed with an explicit error',
    ],
    releaseRiskControls: [
      'desktop MCP import is config intake, not MCP connection ownership',
      'imported servers must still pass MCP config merge, Tool Gate, and permission checks',
      'invalid desktop config records are skipped instead of silently activated',
    ],
  }
}

export async function getDesktopMcpConfigPath(): Promise<string> {
  const platform = getPlatform()

  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(
      `Unsupported platform: ${platform} - desktop MCP import currently supports macOS and WSL.`,
    )
  }

  if (platform === 'macos') {
    return join(
      homedir(),
      'Library',
      'Application Support',
      'DSXU',
      DSXU_DESKTOP_MCP_CONFIG,
    )
  }

  for (const configPath of await getWindowsDesktopMcpConfigCandidates()) {
    try {
      await stat(configPath)
      return configPath
    } catch {
      // File does not exist, continue.
    }
  }

  throw new Error(
    'Could not find a DSXU desktop MCP config file. Create DSXU/dsxu_desktop_mcp_config.json or import a provider-migration desktop MCP config.',
  )
}

async function getWindowsDesktopMcpConfigCandidates(): Promise<string[]> {
  const candidates: string[] = []
  const windowsHome = process.env.USERPROFILE
    ? process.env.USERPROFILE.replace(/\\/g, '/')
    : null

  if (windowsHome) {
    const wslPath = windowsHome.replace(/^[A-Z]:/, '')
    candidates.push(
      `/mnt/c${wslPath}/AppData/Roaming/DSXU/${DSXU_DESKTOP_MCP_CONFIG}`,
      // Migration-only fallback: import existing desktop MCP servers into DSXU.
      `/mnt/c${wslPath}/AppData/Roaming/DSXU/${PROVIDER_MIGRATION_DESKTOP_MCP_CONFIG}`,
    )
  }

  try {
    const userDirs = await readdir('/mnt/c/Users', { withFileTypes: true })
    for (const user of userDirs) {
      if (
        user.name === 'Public' ||
        user.name === 'Default' ||
        user.name === 'Default User' ||
        user.name === 'All Users'
      ) {
        continue
      }

      candidates.push(
        join(
          '/mnt/c/Users',
          user.name,
          'AppData',
          'Roaming',
          'DSXU',
          DSXU_DESKTOP_MCP_CONFIG,
        ),
        join(
          '/mnt/c/Users',
          user.name,
          'AppData',
          'Roaming',
          'DSXU',
          PROVIDER_MIGRATION_DESKTOP_MCP_CONFIG,
        ),
      )
    }
  } catch (error) {
    logError(error)
  }

  return candidates
}

export async function readDesktopMcpServers(): Promise<
  Record<string, McpServerConfig>
> {
  if (!SUPPORTED_PLATFORMS.includes(getPlatform())) {
    throw new Error(
      'Unsupported platform - desktop MCP import currently supports macOS and WSL.',
    )
  }

  try {
    const configPath = await getDesktopMcpConfigPath()
    let configContent: string
    try {
      configContent = await readFile(configPath, { encoding: 'utf8' })
    } catch (e: unknown) {
      const code = getErrnoCode(e)
      if (code === 'ENOENT') return {}
      throw e
    }

    const config = safeParseJSON(configContent)
    if (!config || typeof config !== 'object') return {}

    const mcpServers = (config as Record<string, unknown>).mcpServers
    if (!mcpServers || typeof mcpServers !== 'object') return {}

    const servers: Record<string, McpServerConfig> = {}
    for (const [name, serverConfig] of Object.entries(
      mcpServers as Record<string, unknown>,
    )) {
      if (!serverConfig || typeof serverConfig !== 'object') continue
      const result = McpStdioServerConfigSchema().safeParse(serverConfig)
      if (result.success) servers[name] = result.data
    }

    return servers
  } catch (error) {
    logError(error)
    return {}
  }
}
