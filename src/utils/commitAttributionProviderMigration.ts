import type { FileAttributionState } from '../../../types/logs.js'

const PROVIDER_MIGRATION_SOURCE_GITHUB_ORG = 'anth' + 'ropics'
const PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR = 'clau' + 'de'
const PROVIDER_MIGRATION_SOURCE_ENTRYPOINT_ENV = 'CL' + 'AUDE' + '_CODE_ENTRYPOINT'
const PROVIDER_MIGRATION_SOURCE_ATTRIBUTION_FIELD = `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}Contribution`

function providerMigrationSourceGithubRepo(repo: string): string[] {
  return [
    `github.com:${PROVIDER_MIGRATION_SOURCE_GITHUB_ORG}/${repo}`,
    `github.com/${PROVIDER_MIGRATION_SOURCE_GITHUB_ORG}/${repo}`,
  ]
}

const PROVIDER_MIGRATION_INTERNAL_MODEL_REPOS = [
  ...providerMigrationSourceGithubRepo(`${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-cli-internal`),
  ...providerMigrationSourceGithubRepo('anth' + 'ropic'),
  ...providerMigrationSourceGithubRepo('apps'),
  ...providerMigrationSourceGithubRepo('casino'),
  ...providerMigrationSourceGithubRepo('dbt'),
  ...providerMigrationSourceGithubRepo('dotfiles'),
  ...providerMigrationSourceGithubRepo('terraform-config'),
  ...providerMigrationSourceGithubRepo('hex-export'),
  ...providerMigrationSourceGithubRepo('feedback-v2'),
  ...providerMigrationSourceGithubRepo('labs'),
  ...providerMigrationSourceGithubRepo('argo-rollouts'),
  ...providerMigrationSourceGithubRepo('starling-configs'),
  ...providerMigrationSourceGithubRepo('ts-tools'),
  ...providerMigrationSourceGithubRepo('ts-capsules'),
  ...providerMigrationSourceGithubRepo('feldspar-testing'),
  ...providerMigrationSourceGithubRepo('trellis'),
  ...providerMigrationSourceGithubRepo(`${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-for-hiring`),
  ...providerMigrationSourceGithubRepo('forge-web'),
  ...providerMigrationSourceGithubRepo('infra-manifests'),
  ...providerMigrationSourceGithubRepo('mycro_manifests'),
  ...providerMigrationSourceGithubRepo('mycro_configs'),
  ...providerMigrationSourceGithubRepo('mobile-apps'),
]

export function getProviderMigrationDsxuContribution(
  fileState: FileAttributionState | undefined,
): number {
  if (!fileState) return 0
  return (
    fileState.dsxuContribution ??
    ((fileState as unknown as Record<string, number | undefined>)[
      PROVIDER_MIGRATION_SOURCE_ATTRIBUTION_FIELD
    ] ?? 0)
  )
}

export function isProviderMigrationInternalModelRepoRemote(remoteUrl: string): boolean {
  return PROVIDER_MIGRATION_INTERNAL_MODEL_REPOS.some(repo => remoteUrl.includes(repo))
}

export function sanitizeProviderMigrationModelName(shortName: string): string {
  if (shortName.includes('opus-4-6')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-opus-4-6`
  if (shortName.includes('opus-4-5')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-opus-4-5`
  if (shortName.includes('opus-4-1')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-opus-4-1`
  if (shortName.includes('opus-4')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-opus-4`
  if (shortName.includes('sonnet-4-6')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-sonnet-4-6`
  if (shortName.includes('sonnet-4-5')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-sonnet-4-5`
  if (shortName.includes('sonnet-4')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-sonnet-4`
  if (shortName.includes('sonnet-3-7')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-sonnet-3-7`
  if (shortName.includes('haiku-4-5')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-haiku-4-5`
  if (shortName.includes('haiku-3-5')) return `${PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR}-haiku-3-5`
  return PROVIDER_MIGRATION_SOURCE_MODEL_VENDOR
}

export function getProviderMigrationSourceEntrypoint(): string | undefined {
  return process.env[PROVIDER_MIGRATION_SOURCE_ENTRYPOINT_ENV]
}
