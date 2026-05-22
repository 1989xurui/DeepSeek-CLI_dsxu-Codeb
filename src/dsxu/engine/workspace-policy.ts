import { delimiter, resolve } from 'node:path'

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

export interface ProductCoreGuardDecision {
  decisionId: string
  allowed: boolean
  reason: string
  normalizedPath: string
  action: 'read' | 'write' | 'execute'
  matchedRoot?: string
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

export function getProductCoreGuardRootsFromEnv(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return uniqueRoots([
    env.DSXU_PRODUCT_CORE_ROOT,
    env.DSXU_INSTALL_ROOT,
    ...splitRootList(env.DSXU_PRODUCT_CORE_ROOTS),
  ])
}

export function isProductCoreGuardBypassed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.DSXU_ALLOW_PRODUCT_CORE_MUTATION === '1' || env.DSXU_DEV_ALLOW_CORE_MUTATION === '1'
}

export function evaluateProductCoreGuard(input: {
  path: string
  action: 'read' | 'write' | 'execute'
  protectedRoots?: string[]
  allowCoreMutation?: boolean
}): ProductCoreGuardDecision {
  const normalizedPath = resolve(input.path)
  const protectedRoots = uniqueRoots(input.protectedRoots ?? [])
  const matchedRoot = protectedRoots.find(root => isInside(normalizedPath, root))

  if (!matchedRoot) {
    return productCoreDecision(true, 'path is outside DSXU product core roots', normalizedPath, input.action)
  }
  if (input.action === 'read') {
    return productCoreDecision(true, 'read inside DSXU product core is allowed', normalizedPath, input.action, matchedRoot)
  }
  if (input.allowCoreMutation) {
    return productCoreDecision(true, 'explicit DSXU product-core mutation override is enabled', normalizedPath, input.action, matchedRoot)
  }
  return productCoreDecision(false, 'write/execute inside DSXU product core root is blocked by Product Core Guard', normalizedPath, input.action, matchedRoot)
}

function isInside(target: string, root: string): boolean {
  const normalizedTarget = normalizeForInside(target)
  const normalizedRoot = normalizeForInside(root)
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}\\`) || normalizedTarget.startsWith(`${normalizedRoot}/`)
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

function productCoreDecision(
  allowed: boolean,
  reason: string,
  normalizedPath: string,
  action: ProductCoreGuardDecision['action'],
  matchedRoot?: string,
): ProductCoreGuardDecision {
  return {
    decisionId: `product-core-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    allowed,
    reason,
    normalizedPath,
    action,
    ...(matchedRoot ? { matchedRoot } : {}),
  }
}

function splitRootList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(delimiter)
    .flatMap(part => part.split(/\r?\n/))
    .map(part => part.trim())
    .filter(Boolean)
}

function uniqueRoots(roots: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const root of roots) {
    if (!root) continue
    const resolvedRoot = resolve(root)
    const key = normalizeForInside(resolvedRoot)
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(resolvedRoot)
  }
  return normalized
}

function normalizeForInside(path: string): string {
  const resolved = resolve(path).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}
