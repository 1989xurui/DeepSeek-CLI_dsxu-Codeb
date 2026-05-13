import type { ToolDefinition as LegacyToolDefinition, ToolContext } from './types'
import { evaluateToolGate } from './tool-gate-v1'
import type {
  ToolCapabilityTag,
  ToolDefinition as GateToolDefinition,
  ToolPermissionLevel,
  ToolReadWriteClass,
  ToolSideEffectClass,
} from './tool-types-v1'

export type PermissionMode = 'default' | 'plan' | 'yolo'
export type ToolSafetyLevel = 'safe' | 'write' | 'execute' | 'network'
export type PermissionDecision = 'allow' | 'deny' | 'ask'

export interface PermissionCheckResult {
  decision: PermissionDecision
  reason: string
  prompt?: string
}

export interface PermissionRule {
  toolPattern: string
  behavior: PermissionDecision
  contentPattern?: string
  source: 'builtin' | 'user' | 'project' | 'session'
}

export type ToolGatePermissionPolicy = {
  mode: PermissionMode
  rules?: PermissionRule[]
  askCallback?: (prompt: string) => Promise<boolean>
  sessionAllowed?: Set<string>
}

const TOOL_SAFETY_MAP: Record<string, ToolSafetyLevel> = {
  Read: 'safe',
  Grep: 'safe',
  Glob: 'safe',
  WebSearch: 'safe',
  TodoRead: 'safe',
  Write: 'write',
  Edit: 'write',
  NotebookEdit: 'write',
  TodoWrite: 'write',
  Bash: 'execute',
  WebFetch: 'network',
  skill__simplify: 'safe',
  'skill__review-pr': 'safe',
  skill__pdf: 'safe',
  skill__commit: 'write',
  skill__skillify: 'write',
  'skill__update-config': 'write',
  'skill__*': 'execute',
}

const DANGEROUS_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r|--force|--recursive)/i,
  /\bsudo\b/i,
  /\bchmod\s+[0-7]{3,4}/i,
  /\bchown\b/i,
  /\bdd\s+/i,
  /\bmkfs\b/i,
  /\bformat\b/i,
  />\s*\/dev\//,
  /\bcurl\b.*\|\s*(sh|bash)/i,
  /\bwget\b.*\|\s*(sh|bash)/i,
  /\bgit\s+push\s+.*--force/i,
  /\bgit\s+reset\s+--hard/i,
  /\bgit\s+clean\s+-[a-zA-Z]*f/i,
  /\bnpm\s+publish/i,
  /\bdocker\s+rm/i,
  /\bkill\s+-9/i,
  /\benv\b.*PASSWORD|TOKEN|SECRET|KEY/i,
]

const SAFE_BASH_PATTERNS = [
  /^\s*(echo|cat|ls|pwd|head|tail|wc|date|whoami)\b/,
  /^\s*git\s+(status|log|diff|show|branch)\b/,
  /^\s*(npm|npx|yarn|pnpm|bun)\s+(test|run|exec)\b/,
  /^\s*(node|bun|deno|python|python3)\s/,
  /^\s*(tsc|vitest|jest|pytest|cargo\s+test)\b/,
  /^\s*(grep|rg|find|fd)\b/,
]

export function getToolSafetyLevel(toolName: string): ToolSafetyLevel {
  if (TOOL_SAFETY_MAP[toolName]) {
    return TOOL_SAFETY_MAP[toolName]
  }

  if (toolName.startsWith('skill__')) {
    return TOOL_SAFETY_MAP['skill__*'] || 'execute'
  }

  return 'execute'
}

export function classifyBashCommand(command: string): 'safe' | 'dangerous' | 'unknown' {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) return 'dangerous'
  }
  for (const pattern of SAFE_BASH_PATTERNS) {
    if (pattern.test(command)) return 'safe'
  }
  return 'unknown'
}

export function createToolGatePermissionPolicy(
  mode: PermissionMode = 'default',
  askCallback?: (prompt: string) => Promise<boolean>,
): ToolGatePermissionPolicy {
  return {
    mode,
    askCallback,
    rules: [],
    sessionAllowed: new Set(),
  }
}

export function setToolGatePermissionMode(policy: ToolGatePermissionPolicy, mode: PermissionMode): ToolGatePermissionPolicy {
  return { ...policy, mode }
}

export function addToolGatePermissionRule(policy: ToolGatePermissionPolicy, rule: PermissionRule): ToolGatePermissionPolicy {
  return { ...policy, rules: [...(policy.rules ?? []), rule] }
}

export function clearToolGateSessionAllowed(policy: ToolGatePermissionPolicy): ToolGatePermissionPolicy {
  policy.sessionAllowed?.clear()
  return policy
}

export async function checkToolGatePermission(
  policy: ToolGatePermissionPolicy,
  toolName: string,
  input: Record<string, any>,
  context: ToolContext,
): Promise<PermissionCheckResult> {
  const ruleResult = checkRules(policy.rules ?? [], toolName, input)
  if (ruleResult) return ruleResult

  const safetyLevel = getToolSafetyLevel(toolName)
  const sessionKey = getSessionKey(toolName, input)

  if (policy.mode === 'yolo') {
    return { decision: 'allow', reason: 'yolo mode via tool-gate policy' }
  }

  if (policy.sessionAllowed?.has(sessionKey)) {
    return { decision: 'allow', reason: 'session-approved' }
  }

  if (policy.mode === 'plan' && safetyLevel !== 'safe') {
    return {
      decision: 'deny',
      reason: `Tool "${toolName}" is not allowed in plan mode (read-only)`,
    }
  }

  const localResult = evaluateLocalPermissionExceptions(toolName, input, context, safetyLevel)
  if (localResult) return localResult

  const gate = evaluateToolGate(buildGateToolDefinition(toolName, safetyLevel), {
    allowedPermissionLevel: modeToAllowedPermissionLevel(policy.mode),
    requireConfirmationForWrite: policy.mode !== 'yolo',
  })

  if (gate.executionDecision === 'deny') {
    return {
      decision: 'deny',
      reason: `Tool "${toolName}" is not allowed in ${policy.mode} mode (${gate.permissionDecision})`,
    }
  }

  if (gate.gateDecision === 'require_confirmation' || gate.gateDecision === 'warn') {
    return handleToolGateAsk(policy, buildPrompt(toolName, input, safetyLevel), sessionKey)
  }

  return { decision: 'allow', reason: gate.approvalTrace.notes[0] ?? 'tool-gate allowed' }
}

export function withPermissions(
  tool: LegacyToolDefinition,
  policy: ToolGatePermissionPolicy,
): LegacyToolDefinition {
  return {
    ...tool,
    execute: async (input, context) => {
      const check = await checkToolGatePermission(policy, tool.name, input, context)

      if (check.decision === 'deny') {
        return {
          content: `Permission denied: ${check.reason}`,
          isError: true,
        }
      }

      return tool.execute(input, context)
    },
  }
}

function buildGateToolDefinition(toolName: string, safetyLevel: ToolSafetyLevel): GateToolDefinition {
  return {
    toolId: toolName,
    metadata: {
      displayName: toolName,
      description: `Permission evaluation for ${toolName}`,
      owner: 'Tool Gate',
      version: '1',
      tags: ['permission', safetyLevel],
    },
    capabilityTags: toolCapabilityTags(safetyLevel),
    executionMode: 'sync',
    permissionLevel: toolPermissionLevel(safetyLevel),
    readWriteClass: toolReadWriteClass(safetyLevel),
    sideEffectClass: toolSideEffectClass(safetyLevel),
    failureClass: 'permission',
    inputContract: {
      schemaRef: 'dsxu.permission.input.v1',
      requiredFields: [],
      optionalFields: ['command', 'file_path', 'path', 'url', 'args'],
      validationNotes: ['permission owner: tool-gate-v1'],
    },
    outputContract: {
      schemaRef: 'dsxu.permission.output.v1',
      producedFields: ['decision', 'reason'],
      failureFields: ['prompt'],
      stabilityNotes: ['decision produced by evaluateToolGate'],
    },
    constraints: [],
  }
}

function toolPermissionLevel(safetyLevel: ToolSafetyLevel): ToolPermissionLevel {
  if (safetyLevel === 'safe') return 'safe'
  if (safetyLevel === 'write') return 'guarded'
  return 'privileged'
}

function toolReadWriteClass(safetyLevel: ToolSafetyLevel): ToolReadWriteClass {
  if (safetyLevel === 'safe' || safetyLevel === 'network') return 'read-only'
  if (safetyLevel === 'write') return 'write-local'
  return 'write-external'
}

function toolSideEffectClass(safetyLevel: ToolSafetyLevel): ToolSideEffectClass {
  if (safetyLevel === 'safe') return 'none'
  if (safetyLevel === 'write') return 'local-state'
  return 'external-side-effect'
}

function toolCapabilityTags(safetyLevel: ToolSafetyLevel): ToolCapabilityTag[] {
  if (safetyLevel === 'safe') return ['analysis']
  if (safetyLevel === 'write') return ['write']
  if (safetyLevel === 'network') return ['network']
  return ['execute']
}

function modeToAllowedPermissionLevel(mode: PermissionMode): ToolPermissionLevel {
  if (mode === 'plan') return 'safe'
  if (mode === 'yolo') return 'privileged'
  return 'guarded'
}

function evaluateLocalPermissionExceptions(
  toolName: string,
  input: Record<string, any>,
  context: ToolContext,
  safetyLevel: ToolSafetyLevel,
): PermissionCheckResult | null {
  if (toolName === 'Bash' && typeof input.command === 'string' && classifyBashCommand(input.command) === 'safe') {
    return { decision: 'allow', reason: 'safe bash command' }
  }

  if (safetyLevel === 'write') {
    const filePath = input.file_path || input.path
    if (typeof filePath === 'string' && filePath.startsWith(context.cwd)) {
      return { decision: 'allow', reason: 'write within project directory' }
    }
  }

  if (toolName.startsWith('skill__') && safetyLevel === 'write') {
    const skillArgs = input.args || ''
    if (typeof skillArgs === 'string' && hasPathUnderCwd(skillArgs, context.cwd)) {
      return { decision: 'allow', reason: `write skill within project: ${toolName.replace('skill__', '')}` }
    }
  }

  if (safetyLevel === 'network') {
    const url = input.url || ''
    if (typeof url === 'string' && (url.includes('localhost') || url.includes('127.0.0.1'))) {
      return { decision: 'allow', reason: 'localhost network access' }
    }
  }

  return null
}

function checkRules(
  rules: PermissionRule[],
  toolName: string,
  input: Record<string, any>,
): PermissionCheckResult | null {
  for (const rule of rules) {
    if (!matchToolPattern(rule.toolPattern, toolName)) continue
    if (rule.contentPattern) {
      const content = input.command || input.file_path || input.url || input.args || ''
      if (typeof content === 'string' && content.includes(rule.contentPattern)) {
        return { decision: rule.behavior, reason: `rule: ${rule.source}` }
      }
      continue
    }
    return { decision: rule.behavior, reason: `rule: ${rule.source}` }
  }
  return null
}

function matchToolPattern(pattern: string, toolName: string): boolean {
  if (pattern === '*') return true
  if (pattern.endsWith('*')) return toolName.startsWith(pattern.slice(0, -1))
  return pattern === toolName
}

async function handleToolGateAsk(
  policy: ToolGatePermissionPolicy,
  prompt: string,
  sessionKey: string,
): Promise<PermissionCheckResult> {
  if (!policy.askCallback) {
    return { decision: 'allow', reason: 'no ask callback (autonomous)' }
  }

  const allowed = await policy.askCallback(prompt)
  if (allowed) {
    policy.sessionAllowed?.add(sessionKey)
    return { decision: 'allow', reason: 'user-approved' }
  }
  return { decision: 'deny', reason: 'user-denied', prompt }
}

function buildPrompt(toolName: string, input: Record<string, any>, safetyLevel: ToolSafetyLevel): string {
  if (toolName === 'Bash') {
    return `Bash command requires confirmation:\n  $ ${input.command ?? ''}\nAllow?`
  }
  if (toolName.startsWith('skill__')) {
    return `Skill "${toolName.replace('skill__', '')}" requires confirmation (${safetyLevel}). Allow execution?`
  }
  if (safetyLevel === 'write') {
    return `File write requires confirmation:\n  ${input.file_path || input.path || 'unknown'}\nAllow?`
  }
  if (safetyLevel === 'network') {
    return `Network access requested:\n  ${input.url || ''}\nAllow?`
  }
  return `Tool "${toolName}" requires confirmation. Allow?`
}

function getSessionKey(toolName: string, input: Record<string, any>): string {
  if (toolName === 'Bash') {
    const cmd = (input.command || '').split(' ').slice(0, 2).join(' ')
    return `${toolName}:${cmd}`
  }
  if (input.file_path) return `${toolName}:${input.file_path}`
  if (input.url) return `${toolName}:${new URL(input.url).hostname}`
  return toolName
}

function hasPathUnderCwd(text: string, cwd: string): boolean {
  const normalizedCwd = cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalizedCwd) return false
  const pathRegex = /([A-Za-z]:)?[\\/][A-Za-z0-9._\-\\/]+/g
  const matches = text.match(pathRegex) ?? []
  for (const raw of matches) {
    const candidate = raw.replace(/\\/g, '/')
    if (candidate === normalizedCwd || candidate.startsWith(`${normalizedCwd}/`)) {
      return true
    }
  }
  return false
}
