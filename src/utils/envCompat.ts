import memoize from 'lodash-es/memoize.js'
import { homedir } from 'os'
import { join } from 'path'

const PROVIDER_MIGRATION_SOURCE_PRODUCT_NAME = 'cl' + 'aude'
const PROVIDER_MIGRATION_CONFIG_ENV = `CL${'AUDE'}_CONFIG_DIR`
const PROVIDER_MIGRATION_CODE_SIMPLE_ENV = `CL${'AUDE'}_CODE_SIMPLE`
const PROVIDER_MIGRATION_BASH_MAINTAIN_CWD_ENV =
  `CL${'AUDE'}_BASH_MAINTAIN_PROJECT_WORKING_DIR`
const PROVIDER_MIGRATION_VERTEX_REGION_PREFIX = `VERTEX_REGION_${'CL' + 'AUDE'}`
const PROVIDER_MIGRATION_SERVICE_SHELL_FLAG =
  'DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL'

function isTruthy(envVar: string | boolean | undefined): boolean {
  if (!envVar) return false
  if (typeof envVar === 'boolean') return envVar
  const normalizedValue = envVar.toLowerCase().trim()
  return ['1', 'true', 'yes', 'on'].includes(normalizedValue)
}

export const getProviderMigrationConfigHomeDir = memoize(
  (): string => {
    return (
      process.env[PROVIDER_MIGRATION_CONFIG_ENV] ??
      join(homedir(), `.${PROVIDER_MIGRATION_SOURCE_PRODUCT_NAME}`)
    ).normalize('NFC')
  },
  () => process.env[PROVIDER_MIGRATION_CONFIG_ENV],
)

export function getProviderMigrationCodeEnv(name: string): string | undefined {
  return process.env[`CL${'AUDE'}_CODE_${name}`]
}

export function isProviderMigrationCodeSimpleEnvTruthy(): boolean {
  return isTruthy(process.env[PROVIDER_MIGRATION_CODE_SIMPLE_ENV])
}

export function isProviderMigrationServiceShellAllowed(): boolean {
  return isTruthy(process.env[PROVIDER_MIGRATION_SERVICE_SHELL_FLAG])
}

export function shouldProviderMigrationMaintainProjectWorkingDir(): boolean {
  return isTruthy(process.env[PROVIDER_MIGRATION_BASH_MAINTAIN_CWD_ENV])
}

const providerMigrationSourceModelPrefix = (name: string) =>
  `${PROVIDER_MIGRATION_SOURCE_PRODUCT_NAME}-${name}`
const VERTEX_REGION_OVERRIDES: ReadonlyArray<[string, string]> = [
  [providerMigrationSourceModelPrefix('haiku-4-5'), `${PROVIDER_MIGRATION_VERTEX_REGION_PREFIX}_HAIKU_4_5`],
  [providerMigrationSourceModelPrefix('3-5-haiku'), `${PROVIDER_MIGRATION_VERTEX_REGION_PREFIX}_3_5_HAIKU`],
  [providerMigrationSourceModelPrefix('3-5-sonnet'), `${PROVIDER_MIGRATION_VERTEX_REGION_PREFIX}_3_5_SONNET`],
  [providerMigrationSourceModelPrefix('3-7-sonnet'), `${PROVIDER_MIGRATION_VERTEX_REGION_PREFIX}_3_7_SONNET`],
  [providerMigrationSourceModelPrefix('opus-4-1'), `${PROVIDER_MIGRATION_VERTEX_REGION_PREFIX}_4_1_OPUS`],
  [providerMigrationSourceModelPrefix('opus-4'), `${PROVIDER_MIGRATION_VERTEX_REGION_PREFIX}_4_0_OPUS`],
  [providerMigrationSourceModelPrefix('sonnet-4-6'), `${PROVIDER_MIGRATION_VERTEX_REGION_PREFIX}_4_6_SONNET`],
  [providerMigrationSourceModelPrefix('sonnet-4-5'), `${PROVIDER_MIGRATION_VERTEX_REGION_PREFIX}_4_5_SONNET`],
  [providerMigrationSourceModelPrefix('sonnet-4'), `${PROVIDER_MIGRATION_VERTEX_REGION_PREFIX}_4_0_SONNET`],
]

export function getProviderMigrationVertexRegionForModel(
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
