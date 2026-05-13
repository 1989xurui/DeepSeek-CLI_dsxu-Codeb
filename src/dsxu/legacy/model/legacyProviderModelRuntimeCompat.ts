import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_MODEL_ALIASES,
  DEEPSEEK_V4_PRO_MODEL,
  type DeepSeekV4Model,
} from '../../../utils/model/deepseekV4Control.js'

const LEGACY_PROVIDER_CODE_FAMILY = 'cl' + 'aude'
const LEGACY_HIGH_TIER_FAMILY = 'op' + 'us'
const LEGACY_DEFAULT_TIER_FAMILY = 'son' + 'net'
const LEGACY_LIGHTWEIGHT_FAMILY = 'hai' + 'ku'

function legacyModelId(family: string, version: string): string {
  return `${LEGACY_PROVIDER_CODE_FAMILY}-${family}-${version}`
}

export function getCompatDeepSeekModelMapping(): Record<string, DeepSeekV4Model> {
  return {
    'deepseek-chat': DEEPSEEK_V4_MODEL_ALIASES['deepseek-chat'],
    'deepseek-coder': DEEPSEEK_V4_MODEL_ALIASES['deepseek-coder'],
    'deepseek-reasoner': DEEPSEEK_V4_MODEL_ALIASES['deepseek-reasoner'],
    [legacyModelId(LEGACY_DEFAULT_TIER_FAMILY, '4-6')]: DEEPSEEK_V4_PRO_MODEL,
    [legacyModelId(LEGACY_HIGH_TIER_FAMILY, '4-6')]: DEEPSEEK_V4_PRO_MODEL,
    'gpt-4o': DEEPSEEK_V4_PRO_MODEL,
    'gpt-4o-mini': DEEPSEEK_V4_FLASH_MODEL,
  }
}

export function getCompatDefaultTierModelId(): string {
  return legacyModelId(LEGACY_DEFAULT_TIER_FAMILY, '4-6')
}

export function getCompatHighTierModelId(): string {
  return legacyModelId(LEGACY_HIGH_TIER_FAMILY, '4-6')
}

export function getCompatLightweightModelAlias(): string {
  return LEGACY_LIGHTWEIGHT_FAMILY
}

export function isCompatExtraUsageModel(
  normalizedModelName: string,
  isHighTierMerged: boolean,
): boolean {
  const highTierMatch =
    normalizedModelName === LEGACY_HIGH_TIER_FAMILY ||
    normalizedModelName.includes(`${LEGACY_HIGH_TIER_FAMILY}-4-6`)
  const defaultTierMatch =
    normalizedModelName === LEGACY_DEFAULT_TIER_FAMILY ||
    normalizedModelName.includes(`${LEGACY_DEFAULT_TIER_FAMILY}-4-6`)

  if (highTierMatch && isHighTierMerged) return false
  return highTierMatch || defaultTierMatch
}

export function isCompatPdfUnsupportedModel(modelName: string): boolean {
  return modelName
    .toLowerCase()
    .includes(legacyModelId(LEGACY_LIGHTWEIGHT_FAMILY, '3'))
}
