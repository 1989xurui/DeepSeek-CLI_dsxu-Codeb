import {
  CROSS_PLATFORM_CODE_EXEC,
  DANGEROUS_BASH_PATTERNS,
} from '../../utils/permissions/dangerousPatterns.js'
import {
  ALIAS_HIJACK_CMDLETS,
  MODULE_LOADING_CMDLETS,
  NETWORK_CMDLETS,
  NEVER_SUGGEST,
  WMI_CIM_CMDLETS,
} from '../../utils/powershell/dangerousCmdlets.js'

export type V18ShellGateDecision = {
  behavior: 'allow' | 'ask' | 'deny'
  reason: string
  riskLevel: 'low' | 'medium' | 'high'
}

const DENY_PATTERNS = [
  /\brm\s+-rf\s+(?:\/|\*|~|[A-Za-z]:\\)/i,
  /\bRemove-Item\b.*\s-(?:Recurse|r)\b.*\s-(?:Force|f)\b/i,
  /\bformat\b.*\b[A-Za-z]:/i,
  /\bdel\s+\/[fsq]\b/i,
]

const ASK_PATTERNS = [
  /\b(?:curl|wget|iwr|Invoke-WebRequest)\b/i,
  /\b(?:git\s+push|git\s+reset|git\s+clean|git\s+checkout)\b/i,
  /\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove)\b/i,
  />\s*\S+|>>\s*\S+/,
]

const ALLOW_PATTERNS = [
  /^\s*(?:echo|printf|pwd|ls|dir|cat|type|Get-Content|Select-String|rg|git\s+status|git\s+diff|bun\s+test)\b/i,
]

const POWERSHELL_DENY_PATTERNS = [
  /\bRemove-Item\b.*\s-(?:Recurse|r)\b.*\s-(?:Force|f)\b/i,
  /\b(?:Invoke-Expression|iex)\b/i,
  /\b(?:-EncodedCommand|-enc)\b/i,
]

const BASH_RISK_PREFIXES = [
  ...new Set([...DANGEROUS_BASH_PATTERNS, ...CROSS_PLATFORM_CODE_EXEC]),
]

const POWERSHELL_RISK_PREFIXES = [
  ...new Set([
    ...NEVER_SUGGEST,
    ...NETWORK_CMDLETS,
    ...MODULE_LOADING_CMDLETS,
    ...ALIAS_HIJACK_CMDLETS,
    ...WMI_CIM_CMDLETS,
  ]),
]

function startsWithCommand(command: string, prefix: string): boolean {
  const escaped = prefix.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\s*${escaped}(?:\\s|$|[;|&])`, 'i').test(command)
}

export function classifyV18ShellCommand(command: string): V18ShellGateDecision {
  const normalized = command.trim()
  if (!normalized) {
    return {
      behavior: 'deny',
      reason: 'empty command is not executable',
      riskLevel: 'high',
    }
  }
  if (
    DENY_PATTERNS.some(pattern => pattern.test(normalized)) ||
    POWERSHELL_DENY_PATTERNS.some(pattern => pattern.test(normalized))
  ) {
    return {
      behavior: 'deny',
      reason: 'shared shell safety rules classified this as destructive or direct code execution',
      riskLevel: 'high',
    }
  }
  if (ALLOW_PATTERNS.some(pattern => pattern.test(normalized))) {
    return {
      behavior: 'allow',
      reason: 'read-only or test command inside DSXU Code smoke boundary',
      riskLevel: 'low',
    }
  }
  if (BASH_RISK_PREFIXES.some(prefix => startsWithCommand(normalized, prefix))) {
    return {
      behavior: 'ask',
      reason: 'shared bash permission classifier marks this prefix as code execution or broad side effect',
      riskLevel: 'medium',
    }
  }
  if (POWERSHELL_RISK_PREFIXES.some(prefix => startsWithCommand(normalized, prefix))) {
    return {
      behavior: 'ask',
      reason: 'shared PowerShell permission classifier marks this cmdlet as code execution, network, or runtime mutation',
      riskLevel: 'medium',
    }
  }
  if (ASK_PATTERNS.some(pattern => pattern.test(normalized))) {
    return {
      behavior: 'ask',
      reason: 'command has network, dependency, git mutation, or file-write side effects',
      riskLevel: 'medium',
    }
  }
  return {
    behavior: 'ask',
    reason: 'unknown command category defaults to ask',
    riskLevel: 'medium',
  }
}
