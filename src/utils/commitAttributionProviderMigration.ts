import type { FileAttributionState } from '../../../types/logs.js'

const ARCHIVED_SOURCE_GITHUB_ORG = 'anth' + 'ropics'
const ARCHIVED_SOURCE_MODEL_VENDOR = 'clau' + 'de'
const ARCHIVED_SOURCE_ENTRYPOINT_ENV = 'CL' + 'AUDE' + '_CODE_ENTRYPOINT'
const ARCHIVED_SOURCE_ATTRIBUTION_FIELD = `${ARCHIVED_SOURCE_MODEL_VENDOR}Contribution`

function archivedSourceGithubRepo(repo: string): string[] {
  return [
    `github.com:${ARCHIVED_SOURCE_GITHUB_ORG}/${repo}`,
    `github.com/${ARCHIVED_SOURCE_GITHUB_ORG}/${repo}`,
  ]
}

const ARCHIVED_INTERNAL_MODEL_REPOS = [
  ...archivedSourceGithubRepo(`${ARCHIVED_SOURCE_MODEL_VENDOR}-cli-internal`),
  ...archivedSourceGithubRepo('anth' + 'ropic'),
  ...archivedSourceGithubRepo('apps'),
  ...archivedSourceGithubRepo('casino'),
  ...archivedSourceGithubRepo('dbt'),
  ...archivedSourceGithubRepo('dotfiles'),
  ...archivedSourceGithubRepo('terraform-config'),
  ...archivedSourceGithubRepo('hex-export'),
  ...archivedSourceGithubRepo('feedback-v2'),
  ...archivedSourceGithubRepo('labs'),
  ...archivedSourceGithubRepo('argo-rollouts'),
  ...archivedSourceGithubRepo('starling-configs'),
  ...archivedSourceGithubRepo('ts-tools'),
  ...archivedSourceGithubRepo('ts-capsules'),
  ...archivedSourceGithubRepo('feldspar-testing'),
  ...archivedSourceGithubRepo('trellis'),
  ...archivedSourceGithubRepo(`${ARCHIVED_SOURCE_MODEL_VENDOR}-for-hiring`),
  ...archivedSourceGithubRepo('forge-web'),
  ...archivedSourceGithubRepo('infra-manifests'),
  ...archivedSourceGithubRepo('mycro_manifests'),
  ...archivedSourceGithubRepo('mycro_configs'),
  ...archivedSourceGithubRepo('mobile-apps'),
]

export function getArchivedDsxuContribution(
  fileState: FileAttributionState | undefined,
): number {
  if (!fileState) return 0
  return (
    fileState.dsxuContribution ??
    ((fileState as unknown as Record<string, number | undefined>)[
      ARCHIVED_SOURCE_ATTRIBUTION_FIELD
    ] ?? 0)
  )
}

export function isArchivedInternalModelRepoRemote(remoteUrl: string): boolean {
  return ARCHIVED_INTERNAL_MODEL_REPOS.some(repo => remoteUrl.includes(repo))
}

export function sanitizeArchivedModelName(shortName: string): string {
  if (shortName.includes('opus-4-6')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-opus-4-6`
  if (shortName.includes('opus-4-5')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-opus-4-5`
  if (shortName.includes('opus-4-1')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-opus-4-1`
  if (shortName.includes('opus-4')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-opus-4`
  if (shortName.includes('sonnet-4-6')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-sonnet-4-6`
  if (shortName.includes('sonnet-4-5')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-sonnet-4-5`
  if (shortName.includes('sonnet-4')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-sonnet-4`
  if (shortName.includes('sonnet-3-7')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-sonnet-3-7`
  if (shortName.includes('haiku-4-5')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-haiku-4-5`
  if (shortName.includes('haiku-3-5')) return `${ARCHIVED_SOURCE_MODEL_VENDOR}-haiku-3-5`
  return ARCHIVED_SOURCE_MODEL_VENDOR
}

export function getArchivedSourceEntrypoint(): string | undefined {
  return process.env[ARCHIVED_SOURCE_ENTRYPOINT_ENV]
}

export const getProviderMigrationDsxuContribution = getArchivedDsxuContribution
export const isProviderMigrationInternalModelRepoRemote =
  isArchivedInternalModelRepoRemote
export const sanitizeProviderMigrationModelName = sanitizeArchivedModelName
export const getProviderMigrationSourceEntrypoint = getArchivedSourceEntrypoint
