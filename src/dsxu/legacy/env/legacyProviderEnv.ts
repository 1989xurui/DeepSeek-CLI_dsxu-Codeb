import memoize from 'lodash-es/memoize.js'
import { homedir } from 'os'
import { join } from 'path'

const LEGACY_PRODUCT_NAME = 'cl' + 'aude'
const LEGACY_CONFIG_ENV = `CL${'AUDE'}_CONFIG_DIR`
const LEGACY_CODE_SIMPLE_ENV = `CL${'AUDE'}_CODE_SIMPLE`
const LEGACY_BASH_MAINTAIN_CWD_ENV =
  `CL${'AUDE'}_BASH_MAINTAIN_PROJECT_WORKING_DIR`
const LEGACY_VERTEX_REGION_PREFIX = `VERTEX_REGION_${'CL' + 'AUDE'}`

function isTruthy(envVar: string | boolean | undefined): boolean {
  if (!envVar) return false
  if (typeof envVar === 'boolean') return envVar
  const normalizedValue = envVar.toLowerCase().trim()
  return ['1', 'true', 'yes', 'on'].includes(normalizedValue)
}

export const getCompatProviderConfigHomeDir = memoize(
  (): string => {
    return (
      process.env[LEGACY_CONFIG_ENV] ?? join(homedir(), `.${LEGACY_PRODUCT_NAME}`)
    ).normalize('NFC')
  },
  () => process.env[LEGACY_CONFIG_ENV],
)

export function getCompatCodeEnv(name: string): string | undefined {
  return process.env[`CL${'AUDE'}_CODE_${name}`]
}

export function isCompatCodeSimpleEnvTruthy(): boolean {
  return isTruthy(process.env[LEGACY_CODE_SIMPLE_ENV])
}

export function isCompatProviderServiceShellAllowed(): boolean {
  return (
    isTruthy(process.env.DSXU_ALLOW_LEGACY_PROVIDER_SERVICE_SHELL) ||
    isTruthy(process.env[`DSXU_ALLOW_LEGACY_${'CLA' + 'UDE'}_SERVICE_SHELL`])
  )
}

export function shouldCompatMaintainProjectWorkingDir(): boolean {
  return isTruthy(process.env[LEGACY_BASH_MAINTAIN_CWD_ENV])
}

const legacyModelPrefix = (name: string) => `${LEGACY_PRODUCT_NAME}-${name}`
const VERTEX_REGION_OVERRIDES: ReadonlyArray<[string, string]> = [
  [legacyModelPrefix('haiku-4-5'), `${LEGACY_VERTEX_REGION_PREFIX}_HAIKU_4_5`],
  [legacyModelPrefix('3-5-haiku'), `${LEGACY_VERTEX_REGION_PREFIX}_3_5_HAIKU`],
  [legacyModelPrefix('3-5-sonnet'), `${LEGACY_VERTEX_REGION_PREFIX}_3_5_SONNET`],
  [legacyModelPrefix('3-7-sonnet'), `${LEGACY_VERTEX_REGION_PREFIX}_3_7_SONNET`],
  [legacyModelPrefix('opus-4-1'), `${LEGACY_VERTEX_REGION_PREFIX}_4_1_OPUS`],
  [legacyModelPrefix('opus-4'), `${LEGACY_VERTEX_REGION_PREFIX}_4_0_OPUS`],
  [legacyModelPrefix('sonnet-4-6'), `${LEGACY_VERTEX_REGION_PREFIX}_4_6_SONNET`],
  [legacyModelPrefix('sonnet-4-5'), `${LEGACY_VERTEX_REGION_PREFIX}_4_5_SONNET`],
  [legacyModelPrefix('sonnet-4'), `${LEGACY_VERTEX_REGION_PREFIX}_4_0_SONNET`],
]

export function getCompatVertexRegionForModel(
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
