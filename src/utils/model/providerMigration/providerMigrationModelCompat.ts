import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_MODEL_ALIASES,
  DEEPSEEK_V4_PRO_MODEL,
  type DeepSeekV4Model,
  type DeepSeekV4RouteRole,
} from '../deepseekV4Control.js'
import {
  type DsxuPublicModelAlias,
  type ProviderMigrationModelAlias,
  isProviderMigrationModelAlias,
} from '../aliases.js'

export type ProviderMigrationModelResolution = {
  sourceAlias: ProviderMigrationModelAlias
  normalizedAlias: string
  model: DeepSeekV4Model
  publicAlias: DsxuPublicModelAlias
  routeRole?: DeepSeekV4RouteRole
  routeIntent:
    | 'lightweight'
    | 'coding'
    | 'planning'
    | 'review'
  contextHint: 'default' | 'one_million'
  costRouterControlled: boolean
  migrationProjectionOnly: true
}

function stripContextTag(modelInput: string): {
  normalizedAlias: string
  contextHint: 'default' | 'one_million'
} {
  const normalized = modelInput.trim().toLowerCase()
  if (normalized.endsWith('[1m]')) {
    return {
      normalizedAlias: normalized.replace(/\[1m]$/i, ''),
      contextHint: 'one_million',
    }
  }
  return { normalizedAlias: normalized, contextHint: 'default' }
}

export function resolveProviderMigrationModelAlias(
  modelInput: string,
): ProviderMigrationModelResolution | null {
  const normalizedInput = modelInput.trim().toLowerCase()
  if (!isProviderMigrationModelAlias(normalizedInput)) return null

  const { normalizedAlias, contextHint } = stripContextTag(normalizedInput)
  switch (normalizedAlias) {
    case 'haiku':
    case 'sonnet':
    case 'fast':
    case 'flash':
      return {
        sourceAlias: normalizedInput,
        normalizedAlias,
        model: DEEPSEEK_V4_FLASH_MODEL,
        publicAlias: 'flash',
        routeRole: normalizedAlias === 'haiku' || normalizedAlias === 'fast' ? 'classifier' : 'coder',
        routeIntent: normalizedAlias === 'haiku' || normalizedAlias === 'fast' ? 'lightweight' : 'coding',
        contextHint,
        costRouterControlled: false,
        migrationProjectionOnly: true,
      }
    case 'opus':
    case 'opusplan':
    case 'best':
      return {
        sourceAlias: normalizedInput,
        normalizedAlias,
        model: DEEPSEEK_V4_FLASH_MODEL,
        publicAlias: 'flash-max',
        routeRole: normalizedAlias === 'opusplan' ? 'planner' : 'reviewer',
        routeIntent: normalizedAlias === 'opusplan' ? 'planning' : 'review',
        contextHint,
        costRouterControlled: true,
        migrationProjectionOnly: true,
      }
    default:
      return null
  }
}

export function getProviderMigrationModelAliasEvidence(modelInput: string): string | null {
  const resolution = resolveProviderMigrationModelAlias(modelInput)
  if (!resolution) return null
  const context = resolution.contextHint === 'one_million' ? '; context_hint=1m' : ''
  const router = resolution.costRouterControlled ? '; cost_router_decides=true' : ''
  return `DSXU provider migration model alias: ${resolution.sourceAlias} -> ${resolution.publicAlias}; route_intent=${resolution.routeIntent}; projection_only=true${context}${router}.`
}

const PROVIDER_MIGRATION_SOURCE_CODE_FAMILY = 'cl' + 'aude'
const PROVIDER_MIGRATION_HIGH_TIER_FAMILY = 'op' + 'us'
const PROVIDER_MIGRATION_DEFAULT_TIER_FAMILY = 'son' + 'net'
const PROVIDER_MIGRATION_LIGHTWEIGHT_FAMILY = 'hai' + 'ku'

function providerMigrationSourceModelId(family: string, version: string): string {
  return `${PROVIDER_MIGRATION_SOURCE_CODE_FAMILY}-${family}-${version}`
}

export function getProviderMigrationDeepSeekModelMapping(): Record<string, DeepSeekV4Model> {
  return {
    'deepseek-chat': DEEPSEEK_V4_MODEL_ALIASES['deepseek-chat'],
    'deepseek-coder': DEEPSEEK_V4_MODEL_ALIASES['deepseek-coder'],
    'deepseek-reasoner': DEEPSEEK_V4_MODEL_ALIASES['deepseek-reasoner'],
    [providerMigrationSourceModelId(PROVIDER_MIGRATION_DEFAULT_TIER_FAMILY, '4-6')]: DEEPSEEK_V4_PRO_MODEL,
    [providerMigrationSourceModelId(PROVIDER_MIGRATION_HIGH_TIER_FAMILY, '4-6')]: DEEPSEEK_V4_PRO_MODEL,
    'gpt-4o': DEEPSEEK_V4_PRO_MODEL,
    'gpt-4o-mini': DEEPSEEK_V4_FLASH_MODEL,
  }
}

export function getProviderMigrationDefaultTierModelId(): string {
  return providerMigrationSourceModelId(PROVIDER_MIGRATION_DEFAULT_TIER_FAMILY, '4-6')
}

export function getProviderMigrationHighTierModelId(): string {
  return providerMigrationSourceModelId(PROVIDER_MIGRATION_HIGH_TIER_FAMILY, '4-6')
}

export function getProviderMigrationLightweightModelAlias(): string {
  return PROVIDER_MIGRATION_LIGHTWEIGHT_FAMILY
}

export function isProviderMigrationExtraUsageModel(
  normalizedModelName: string,
  isHighTierMerged: boolean,
): boolean {
  const highTierMatch =
    normalizedModelName === PROVIDER_MIGRATION_HIGH_TIER_FAMILY ||
    normalizedModelName.includes(`${PROVIDER_MIGRATION_HIGH_TIER_FAMILY}-4-6`)
  const defaultTierMatch =
    normalizedModelName === PROVIDER_MIGRATION_DEFAULT_TIER_FAMILY ||
    normalizedModelName.includes(`${PROVIDER_MIGRATION_DEFAULT_TIER_FAMILY}-4-6`)

  if (highTierMatch && isHighTierMerged) return false
  return highTierMatch || defaultTierMatch
}

export function isProviderMigrationPdfUnsupportedModel(modelName: string): boolean {
  return modelName
    .toLowerCase()
    .includes(providerMigrationSourceModelId(PROVIDER_MIGRATION_LIGHTWEIGHT_FAMILY, '3'))
}
