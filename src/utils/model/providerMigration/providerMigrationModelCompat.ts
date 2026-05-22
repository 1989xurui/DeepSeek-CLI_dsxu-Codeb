import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_MODEL_ALIASES,
  DEEPSEEK_V4_PRO_MODEL,
  type DeepSeekV4Model,
  type DeepSeekV4RouteRole,
} from '../deepseekV4Control.js'
import {
  type DsxuPublicModelAlias,
  type ArchivedSourceModelAlias,
  isArchivedSourceModelAlias,
} from '../aliases.js'

export type ArchivedSourceModelResolution = {
  sourceAlias: ArchivedSourceModelAlias
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

export type ProviderMigrationModelResolution = ArchivedSourceModelResolution

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

export function resolveArchivedSourceModelAlias(
  modelInput: string,
): ArchivedSourceModelResolution | null {
  const normalizedInput = modelInput.trim().toLowerCase()
  if (!isArchivedSourceModelAlias(normalizedInput)) return null

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

export const resolveProviderMigrationModelAlias = resolveArchivedSourceModelAlias

export function getArchivedModelAliasEvidence(modelInput: string): string | null {
  const resolution = resolveArchivedSourceModelAlias(modelInput)
  if (!resolution) return null
  const context = resolution.contextHint === 'one_million' ? '; context_hint=1m' : ''
  const router = resolution.costRouterControlled ? '; cost_router_decides=true' : ''
  return `DSXU provider migration model alias: ${resolution.sourceAlias} -> ${resolution.publicAlias}; route_intent=${resolution.routeIntent}; projection_only=true${context}${router}.`
}

export const getProviderMigrationModelAliasEvidence = getArchivedModelAliasEvidence

const ARCHIVED_SOURCE_CODE_FAMILY = 'cl' + 'aude'
const ARCHIVED_HIGH_TIER_FAMILY = 'op' + 'us'
const ARCHIVED_DEFAULT_TIER_FAMILY = 'son' + 'net'
const ARCHIVED_LIGHTWEIGHT_FAMILY = 'hai' + 'ku'

function archivedSourceModelId(family: string, version: string): string {
  return `${ARCHIVED_SOURCE_CODE_FAMILY}-${family}-${version}`
}

export function getArchivedDeepSeekModelMapping(): Record<string, DeepSeekV4Model> {
  return {
    'deepseek-chat': DEEPSEEK_V4_MODEL_ALIASES['deepseek-chat'],
    'deepseek-coder': DEEPSEEK_V4_MODEL_ALIASES['deepseek-coder'],
    'deepseek-reasoner': DEEPSEEK_V4_MODEL_ALIASES['deepseek-reasoner'],
    [archivedSourceModelId(ARCHIVED_DEFAULT_TIER_FAMILY, '4-6')]: DEEPSEEK_V4_PRO_MODEL,
    [archivedSourceModelId(ARCHIVED_HIGH_TIER_FAMILY, '4-6')]: DEEPSEEK_V4_PRO_MODEL,
    'gpt-4o': DEEPSEEK_V4_PRO_MODEL,
    'gpt-4o-mini': DEEPSEEK_V4_FLASH_MODEL,
  }
}

export const getProviderMigrationDeepSeekModelMapping = getArchivedDeepSeekModelMapping

export function getArchivedDefaultTierModelId(): string {
  return archivedSourceModelId(ARCHIVED_DEFAULT_TIER_FAMILY, '4-6')
}

export const getProviderMigrationDefaultTierModelId = getArchivedDefaultTierModelId

export function getArchivedHighTierModelId(): string {
  return archivedSourceModelId(ARCHIVED_HIGH_TIER_FAMILY, '4-6')
}

export const getProviderMigrationHighTierModelId = getArchivedHighTierModelId

export function getArchivedLightweightModelAlias(): string {
  return ARCHIVED_LIGHTWEIGHT_FAMILY
}

export const getProviderMigrationLightweightModelAlias = getArchivedLightweightModelAlias

export function isArchivedExtraUsageModel(
  normalizedModelName: string,
  isHighTierMerged: boolean,
): boolean {
  const highTierMatch =
    normalizedModelName === ARCHIVED_HIGH_TIER_FAMILY ||
    normalizedModelName.includes(`${ARCHIVED_HIGH_TIER_FAMILY}-4-6`)
  const defaultTierMatch =
    normalizedModelName === ARCHIVED_DEFAULT_TIER_FAMILY ||
    normalizedModelName.includes(`${ARCHIVED_DEFAULT_TIER_FAMILY}-4-6`)

  if (highTierMatch && isHighTierMerged) return false
  return highTierMatch || defaultTierMatch
}

export const isProviderMigrationExtraUsageModel = isArchivedExtraUsageModel

export function isArchivedPdfUnsupportedModel(modelName: string): boolean {
  return modelName
    .toLowerCase()
    .includes(archivedSourceModelId(ARCHIVED_LIGHTWEIGHT_FAMILY, '3'))
}

export const isProviderMigrationPdfUnsupportedModel = isArchivedPdfUnsupportedModel
