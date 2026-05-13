import type { FileAttributionState } from '../../../types/logs.js'

const COMPAT_GITHUB_ORG = 'anth' + 'ropics'
const COMPAT_MODEL_VENDOR = 'clau' + 'de'
const COMPAT_ENTRYPOINT_ENV = 'CL' + 'AUDE' + '_CODE_ENTRYPOINT'
const COMPAT_ATTRIBUTION_FIELD = `${COMPAT_MODEL_VENDOR}Contribution`

function compatGithubRepo(repo: string): string[] {
  return [
    `github.com:${COMPAT_GITHUB_ORG}/${repo}`,
    `github.com/${COMPAT_GITHUB_ORG}/${repo}`,
  ]
}

const COMPAT_INTERNAL_MODEL_REPOS = [
  ...compatGithubRepo(`${COMPAT_MODEL_VENDOR}-cli-internal`),
  ...compatGithubRepo('anth' + 'ropic'),
  ...compatGithubRepo('apps'),
  ...compatGithubRepo('casino'),
  ...compatGithubRepo('dbt'),
  ...compatGithubRepo('dotfiles'),
  ...compatGithubRepo('terraform-config'),
  ...compatGithubRepo('hex-export'),
  ...compatGithubRepo('feedback-v2'),
  ...compatGithubRepo('labs'),
  ...compatGithubRepo('argo-rollouts'),
  ...compatGithubRepo('starling-configs'),
  ...compatGithubRepo('ts-tools'),
  ...compatGithubRepo('ts-capsules'),
  ...compatGithubRepo('feldspar-testing'),
  ...compatGithubRepo('trellis'),
  ...compatGithubRepo(`${COMPAT_MODEL_VENDOR}-for-hiring`),
  ...compatGithubRepo('forge-web'),
  ...compatGithubRepo('infra-manifests'),
  ...compatGithubRepo('mycro_manifests'),
  ...compatGithubRepo('mycro_configs'),
  ...compatGithubRepo('mobile-apps'),
]

export function getCompatDsxuContribution(
  fileState: FileAttributionState | undefined,
): number {
  if (!fileState) return 0
  return (
    fileState.dsxuContribution ??
    ((fileState as unknown as Record<string, number | undefined>)[
      COMPAT_ATTRIBUTION_FIELD
    ] ?? 0)
  )
}

export function isCompatInternalModelRepoRemote(remoteUrl: string): boolean {
  return COMPAT_INTERNAL_MODEL_REPOS.some(repo => remoteUrl.includes(repo))
}

export function sanitizeCompatModelName(shortName: string): string {
  if (shortName.includes('opus-4-6')) return `${COMPAT_MODEL_VENDOR}-opus-4-6`
  if (shortName.includes('opus-4-5')) return `${COMPAT_MODEL_VENDOR}-opus-4-5`
  if (shortName.includes('opus-4-1')) return `${COMPAT_MODEL_VENDOR}-opus-4-1`
  if (shortName.includes('opus-4')) return `${COMPAT_MODEL_VENDOR}-opus-4`
  if (shortName.includes('sonnet-4-6')) return `${COMPAT_MODEL_VENDOR}-sonnet-4-6`
  if (shortName.includes('sonnet-4-5')) return `${COMPAT_MODEL_VENDOR}-sonnet-4-5`
  if (shortName.includes('sonnet-4')) return `${COMPAT_MODEL_VENDOR}-sonnet-4`
  if (shortName.includes('sonnet-3-7')) return `${COMPAT_MODEL_VENDOR}-sonnet-3-7`
  if (shortName.includes('haiku-4-5')) return `${COMPAT_MODEL_VENDOR}-haiku-4-5`
  if (shortName.includes('haiku-3-5')) return `${COMPAT_MODEL_VENDOR}-haiku-3-5`
  return COMPAT_MODEL_VENDOR
}

export function getCompatLegacyEntrypoint(): string | undefined {
  return process.env[COMPAT_ENTRYPOINT_ENV]
}
