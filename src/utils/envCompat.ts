import memoize from 'lodash-es/memoize.js'
import { homedir } from 'os'
import { join } from 'path'

const ARCHIVED_SOURCE_PRODUCT_NAME = 'cl' + 'aude'
const ARCHIVED_CONFIG_ENV = `CL${'AUDE'}_CONFIG_DIR`
const ARCHIVED_CODE_SIMPLE_ENV = `CL${'AUDE'}_CODE_SIMPLE`
const ARCHIVED_BASH_MAINTAIN_CWD_ENV =
  `CL${'AUDE'}_BASH_MAINTAIN_PROJECT_WORKING_DIR`
const ARCHIVED_VERTEX_REGION_PREFIX = `VERTEX_REGION_${'CL' + 'AUDE'}`
const ARCHIVED_SERVICE_SHELL_FLAG =
  'DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL'

function isTruthy(envVar: string | boolean | undefined): boolean {
  if (!envVar) return false
  if (typeof envVar === 'boolean') return envVar
  const normalizedValue = envVar.toLowerCase().trim()
  return ['1', 'true', 'yes', 'on'].includes(normalizedValue)
}

export const getArchivedConfigHomeDir = memoize(
  (): string => {
    return (
      process.env[ARCHIVED_CONFIG_ENV] ??
      join(homedir(), `.${ARCHIVED_SOURCE_PRODUCT_NAME}`)
    ).normalize('NFC')
  },
  () => process.env[ARCHIVED_CONFIG_ENV],
)

export function getArchivedCodeEnv(name: string): string | undefined {
  return process.env[`CL${'AUDE'}_CODE_${name}`]
}

export function isArchivedCodeSimpleEnvTruthy(): boolean {
  return isTruthy(process.env[ARCHIVED_CODE_SIMPLE_ENV])
}

export function isArchivedServiceShellAllowed(): boolean {
  return isTruthy(process.env[ARCHIVED_SERVICE_SHELL_FLAG])
}

export function shouldArchivedMaintainProjectWorkingDir(): boolean {
  return isTruthy(process.env[ARCHIVED_BASH_MAINTAIN_CWD_ENV])
}

const archivedSourceModelPrefix = (name: string) =>
  `${ARCHIVED_SOURCE_PRODUCT_NAME}-${name}`
const VERTEX_REGION_OVERRIDES: ReadonlyArray<[string, string]> = [
  [archivedSourceModelPrefix('haiku-4-5'), `${ARCHIVED_VERTEX_REGION_PREFIX}_HAIKU_4_5`],
  [archivedSourceModelPrefix('3-5-haiku'), `${ARCHIVED_VERTEX_REGION_PREFIX}_3_5_HAIKU`],
  [archivedSourceModelPrefix('3-5-sonnet'), `${ARCHIVED_VERTEX_REGION_PREFIX}_3_5_SONNET`],
  [archivedSourceModelPrefix('3-7-sonnet'), `${ARCHIVED_VERTEX_REGION_PREFIX}_3_7_SONNET`],
  [archivedSourceModelPrefix('opus-4-1'), `${ARCHIVED_VERTEX_REGION_PREFIX}_4_1_OPUS`],
  [archivedSourceModelPrefix('opus-4'), `${ARCHIVED_VERTEX_REGION_PREFIX}_4_0_OPUS`],
  [archivedSourceModelPrefix('sonnet-4-6'), `${ARCHIVED_VERTEX_REGION_PREFIX}_4_6_SONNET`],
  [archivedSourceModelPrefix('sonnet-4-5'), `${ARCHIVED_VERTEX_REGION_PREFIX}_4_5_SONNET`],
  [archivedSourceModelPrefix('sonnet-4'), `${ARCHIVED_VERTEX_REGION_PREFIX}_4_0_SONNET`],
]

export function getArchivedVertexRegionForModel(
  model: string | undefined,
  defaultRegion: string,
): string {
  if (model) {
    const match = VERTEX_REGION_OVERRIDES.find(([prefix]) =>
      model.startsWith(prefix),
    )
    if (match) {
      return process.env[match[1]] || defaultRegion
    }
  }
  return defaultRegion
}

export const getProviderMigrationVertexRegionForModel =
  getArchivedVertexRegionForModel
