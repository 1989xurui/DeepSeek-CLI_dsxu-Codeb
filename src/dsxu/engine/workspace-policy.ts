import { resolve } from 'node:path'

export interface WorkspacePolicy {
  workspaceId: string
  allowedRoots: string[]
  blockedRoots: string[]
  projectOnlyWrite: boolean
}

export interface WorkspacePolicyDecision {
  decisionId: string
  allowed: boolean
  reason: string
  normalizedPath: string
  action: 'read' | 'write' | 'execute'
}

export interface DSXUPermissionDecision {
  schemaId: string
  decision: 'allow' | 'warn' | 'block' | 'require_confirmation'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  reason: string
}

export function evaluateDSXUToolPermission(input: {
  access: 'read-only' | 'write-local' | 'write-external'
  allows?: boolean
  requiresConfirmation?: boolean
  hasExternalEffect?: boolean
  reason?: string
}): DSXUPermissionDecision {
  if (input.hasExternalEffect || input.access === 'write-external') {
    return {
      schemaId: 'dsxu.permission.external',
      decision: input.allows ? 'require_confirmation' : 'block',
      riskLevel: 'high',
      reason: input.reason || 'external side effect requires DSXU governance approval',
    }
  }
  if (input.requiresConfirmation || input.access === 'write-local') {
    return {
      schemaId: 'dsxu.permission.write-local',
      decision: 'require_confirmation',
      riskLevel: 'medium',
      reason: input.reason || 'workspace write requires explicit DSXU confirmation',
    }
  }
  return {
    schemaId: 'dsxu.permission.read-only',
    decision: input.allows === false ? 'warn' : 'allow',
    riskLevel: input.allows === false ? 'medium' : 'low',
    reason: input.reason || (input.allows === false ? 'permission confidence degraded' : 'read-only operation allowed'),
  }
}

export function evaluateWorkspacePolicy(
  policy: WorkspacePolicy,
  input: { path: string; action: 'read' | 'write' | 'execute' },
): WorkspacePolicyDecision {
  const normalizedPath = resolve(input.path)
  const allowedRoots = policy.allowedRoots.map((root) => resolve(root))
  const blockedRoots = policy.blockedRoots.map((root) => resolve(root))
  const inAllowedRoot = allowedRoots.some((root) => isInside(normalizedPath, root))
  const inBlockedRoot = blockedRoots.some((root) => isInside(normalizedPath, root))

  if (inBlockedRoot) {
    return decision(false, 'path is inside blockedRoots', normalizedPath, input.action)
  }
  if (!inAllowedRoot) {
    return decision(false, 'path is outside allowedRoots', normalizedPath, input.action)
  }
  if (policy.projectOnlyWrite && input.action === 'write' && !inAllowedRoot) {
    return decision(false, 'projectOnlyWrite denied write outside project roots', normalizedPath, input.action)
  }
  return decision(true, 'workspace policy allowed', normalizedPath, input.action)
}

function isInside(target: string, root: string): boolean {
  return target === root || target.startsWith(`${root}\\`) || target.startsWith(`${root}/`)
}

function decision(
  allowed: boolean,
  reason: string,
  normalizedPath: string,
  action: WorkspacePolicyDecision['action'],
): WorkspacePolicyDecision {
  return {
    decisionId: `policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    allowed,
    reason,
    normalizedPath,
    action,
  }
}
