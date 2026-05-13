import { BASH_TOOL_NAME } from '../../tools/BashTool/toolName.js'
import { POWERSHELL_TOOL_NAME } from '../../tools/PowerShellTool/toolName.js'
import {
  getDsxuCodeEnv,
  isDsxuCodeEnvTruthy,
  isEnvDefinedFalsy,
  isEnvTruthy,
} from '../envUtils.js'
import { getPlatform } from '../platform.js'
import { whichSync } from '../which.js'
import { isWindowsPowerShellFallbackAllowedFromWsl } from './powershellDetection.js'

export const SHELL_TOOL_NAMES: string[] = [BASH_TOOL_NAME, POWERSHELL_TOOL_NAME]

let cachedNativeWslPwshAvailable: boolean | undefined

function hasNativeWslPwshAvailable(): boolean {
  cachedNativeWslPwshAvailable ??= Boolean(whichSync('pwsh'))
  return cachedNativeWslPwshAvailable
}

function isPowerShellRuntimeAvailableForPlatform(): boolean {
  const platform = getPlatform()
  if (platform === 'windows') return true
  if (platform === 'wsl') {
    return hasNativeWslPwshAvailable() || isWindowsPowerShellFallbackAllowedFromWsl()
  }
  return false
}

/**
 * Runtime gate for PowerShellTool. Windows-only (the permission engine uses
 * Win32-specific path normalizations). Ant defaults on (opt-out via env=0);
 * external defaults off (opt-in via env=1).
 *
 * Used by tools.ts (tool-list visibility), processBashCommand (! routing),
 * and promptShellExecution (skill frontmatter routing) so the gate is
 * consistent across all paths that invoke PowerShellTool.call().
 */
export function isPowerShellToolEnabled(): boolean {
  const platform = getPlatform()
  if (platform !== 'windows' && platform !== 'wsl') return false
  if (!isPowerShellRuntimeAvailableForPlatform()) return false
  const configured = getDsxuCodeEnv('USE_POWERSHELL_TOOL')
  if (isDsxuCodeEnvTruthy('MODE')) {
    return !isEnvDefinedFalsy(configured)
  }
  return process.env.USER_TYPE === 'ant'
    ? !isEnvDefinedFalsy(configured)
    : isEnvTruthy(configured)
}

export function isPowerShellToolEnvConfigured(): boolean {
  return getDsxuCodeEnv('USE_POWERSHELL_TOOL') !== undefined
}
