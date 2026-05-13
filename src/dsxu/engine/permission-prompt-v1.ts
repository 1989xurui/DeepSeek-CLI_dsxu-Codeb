export type PermissionSchemaResolution = {
  schemaId: string
  decision: 'allow' | 'deny' | 'require_confirmation'
  stateOwner: 'query_loop'
  sourceOwner: 'permission'
  gateKind: 'permission_prompt' | 'permission_visibility_fallback'
  gateClass:
    | 'SAFETY_BLOCK'
    | 'QUALITY_BLOCK'
    | 'RECOVERY_BLOCK'
    | 'CAPABILITY_NUDGE'
    | 'COST_SMELL'
    | 'BENCH_CONTRACT_ONLY'
    | 'RELAX_OR_REMOVE'
  blocked: boolean
  visibleFallbackRequired: boolean
  nextAction: string
  reason: string
}

export type PermissionPromptVisibilityInput = {
  promptVisible?: boolean
  fallbackVisible?: boolean
  waitingMs?: number
}

const HIDDEN_PROMPT_WAIT_MS = 5_000

function normalizePermissionAction(action: string): string {
  return action.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isSafetyBlockedAction(action: string): boolean {
  const normalized = normalizePermissionAction(action)

  return [
    /\brm\s+-rf\s+(\/|~|\$home\b|%userprofile%)/,
    /\bremove-item\b.*\b-recurse\b.*\b-force\b.*(?:\\|\/|:)/,
    /\bformat-volume\b/,
    /\bmkfs\b/,
    /\bdd\s+.*\bof=\/dev\//,
    /\bgit\s+push\b.*\b--force\b/,
    /\bcurl\b.*\|\s*(?:sh|bash|pwsh|powershell)\b/,
    /\bsecret\b.*\b(?:print|echo|exfiltrate|upload)\b/,
  ].some(pattern => pattern.test(normalized))
}

function isLocalMutationAction(action: string): boolean {
  const normalized = normalizePermissionAction(action)

  return [
    'write',
    'edit',
    'patch',
    'create-file',
    'delete',
    'move',
    'rename',
    'shell',
    'bash',
    'powershell',
  ].some(keyword => normalized.includes(keyword))
}

function isHiddenPermissionPrompt(input: PermissionPromptVisibilityInput): boolean {
  if (input.fallbackVisible) return false
  if (input.promptVisible === false) return true
  if (input.waitingMs !== undefined && input.waitingMs >= HIDDEN_PROMPT_WAIT_MS) {
    return input.promptVisible !== true
  }
  return false
}

export function classifyPermissionGate(
  action: string,
  visibility: PermissionPromptVisibilityInput = {},
): PermissionSchemaResolution {
  if (isSafetyBlockedAction(action)) {
    return {
      schemaId: 'dsxu-permission-safety-redline',
      decision: 'deny',
      stateOwner: 'query_loop',
      sourceOwner: 'permission',
      gateKind: 'permission_prompt',
      gateClass: 'SAFETY_BLOCK',
      blocked: true,
      visibleFallbackRequired: false,
      nextAction: 'reject_and_explain_safety_boundary',
      reason: 'Permission action matches a destructive or secret-exfiltration redline.',
    }
  }

  if (isLocalMutationAction(action)) {
    if (isHiddenPermissionPrompt(visibility)) {
      return {
        schemaId: 'dsxu-permission-visible-fallback-required',
        decision: 'require_confirmation',
        stateOwner: 'query_loop',
        sourceOwner: 'permission',
        gateKind: 'permission_visibility_fallback',
        gateClass: 'RECOVERY_BLOCK',
        blocked: true,
        visibleFallbackRequired: true,
        nextAction: 'show_visible_permission_fallback_or_return_error',
        reason:
          'Permission confirmation is required but no visible prompt or fallback is available.',
      }
    }

    return {
      schemaId: 'dsxu-permission-write-local',
      decision: 'require_confirmation',
      stateOwner: 'query_loop',
      sourceOwner: 'permission',
      gateKind: 'permission_prompt',
      gateClass: 'QUALITY_BLOCK',
      blocked: true,
      visibleFallbackRequired: true,
      nextAction: 'show_permission_prompt_before_mutation',
      reason: 'Local mutation requires explicit visible confirmation before execution.',
    }
  }

  return {
    schemaId: 'dsxu-permission-read-only',
    decision: 'allow',
    stateOwner: 'query_loop',
    sourceOwner: 'permission',
    gateKind: 'permission_prompt',
    gateClass: 'RELAX_OR_REMOVE',
    blocked: false,
    visibleFallbackRequired: false,
    nextAction: 'allow_read_only_tool',
    reason: 'Read-only permission should not be a mainline hard gate.',
  }
}

export function resolvePermissionSchema(
  action: string,
  visibility: PermissionPromptVisibilityInput = {},
): PermissionSchemaResolution {
  return classifyPermissionGate(action, visibility)
}
