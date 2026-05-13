import { resolve } from 'path'
import {
  getEmptyToolPermissionContext,
  type ToolPermissionContext,
  type ToolPermissionRulesBySource,
} from '../../Tool.js'
import type { AdditionalWorkingDirectory, PermissionMode } from '../../types/permissions.js'

export type DsxuScopedPermissionOptions = {
  cwd: string
  mode?: PermissionMode
  base?: ToolPermissionContext
  externalWriteGrants?: string[]
  allowTestBuild?: boolean
}

export type DsxuExternalWorkspaceGrant = {
  path: string
  normalizedPath: string
  source: 'cli' | 'session' | 'project' | 'user'
  grantedAt: number
  expiresAt?: number
}

const SAFE_TEST_BUILD_RULES = [
  'Bash(bun run test)',
  'Bash(bun test)',
  'Bash(npm test)',
  'Bash(npm run test)',
  'Bash(pnpm test)',
  'Bash(pnpm run test)',
  'Bash(yarn test)',
  'Bash(yarn run test)',
  'PowerShell(bun run test)',
  'PowerShell(bun test)',
  'PowerShell(npm test)',
  'PowerShell(npm run test)',
  'PowerShell(pnpm test)',
  'PowerShell(pnpm run test)',
  'PowerShell(yarn test)',
  'PowerShell(yarn run test)',
] as const

export function normalizeDsxuPermissionPath(path: string): string {
  return resolve(path)
}

export function createDsxuScopedPermissionContext(
  options: DsxuScopedPermissionOptions,
): ToolPermissionContext {
  const base = options.base ?? getEmptyToolPermissionContext()
  const additionalWorkingDirectories = new Map<string, AdditionalWorkingDirectory>(
    base.additionalWorkingDirectories,
  )

  addWorkingDirectory(additionalWorkingDirectories, options.cwd, 'session')
  for (const grant of options.externalWriteGrants ?? []) {
    addWorkingDirectory(additionalWorkingDirectories, grant, 'session')
  }

  return {
    ...base,
    mode: options.mode ?? base.mode,
    additionalWorkingDirectories,
    alwaysAllowRules: options.allowTestBuild
      ? appendSessionRules(base.alwaysAllowRules, SAFE_TEST_BUILD_RULES)
      : base.alwaysAllowRules,
  }
}

export function createExternalWorkspaceGrant(
  path: string,
  options: {
    source?: DsxuExternalWorkspaceGrant['source']
    now?: number
    ttlMs?: number
  } = {},
): DsxuExternalWorkspaceGrant {
  const grantedAt = options.now ?? Date.now()
  return {
    path,
    normalizedPath: normalizeDsxuPermissionPath(path),
    source: options.source ?? 'session',
    grantedAt,
    expiresAt: options.ttlMs ? grantedAt + options.ttlMs : undefined,
  }
}

export function filterActiveExternalWorkspaceGrants(
  grants: readonly DsxuExternalWorkspaceGrant[],
  now = Date.now(),
): DsxuExternalWorkspaceGrant[] {
  return grants.filter(grant => grant.expiresAt === undefined || grant.expiresAt > now)
}

export function createDsxuScopedPermissionContextFromGrants(
  options: Omit<DsxuScopedPermissionOptions, 'externalWriteGrants'> & {
    externalWriteGrants?: readonly DsxuExternalWorkspaceGrant[]
    now?: number
  },
): ToolPermissionContext {
  return createDsxuScopedPermissionContext({
    ...options,
    externalWriteGrants: filterActiveExternalWorkspaceGrants(
      options.externalWriteGrants ?? [],
      options.now,
    ).map(grant => grant.normalizedPath),
  })
}

export function renderExternalWorkspaceGrantSummary(
  grants: readonly DsxuExternalWorkspaceGrant[],
): string {
  if (grants.length === 0) return 'No external DSXU workspace write grants.'
  return grants.map(grant => {
    const expires = grant.expiresAt === undefined
      ? 'never'
      : new Date(grant.expiresAt).toISOString()
    return [
      `path=${grant.normalizedPath}`,
      `source=${grant.source}`,
      `grantedAt=${new Date(grant.grantedAt).toISOString()}`,
      `expiresAt=${expires}`,
    ].join(' ')
  }).join('\n')
}

function addWorkingDirectory(
  directories: Map<string, AdditionalWorkingDirectory>,
  path: string,
  source: AdditionalWorkingDirectory['source'],
): void {
  const normalized = normalizeDsxuPermissionPath(path)
  directories.set(normalized, { path: normalized, source })
}

function appendSessionRules(
  rules: ToolPermissionRulesBySource,
  additions: readonly string[],
): ToolPermissionRulesBySource {
  const session = new Set([...(rules.session ?? []), ...additions])
  return {
    ...rules,
    session: Array.from(session),
  }
}
