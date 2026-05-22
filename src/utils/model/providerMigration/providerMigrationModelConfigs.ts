import type { ModelName } from '../model.js'
import type { APIProvider } from '../providers.js'

export type ModelConfig = Record<APIProvider, ModelName>

const PROVIDER_MODEL_PREFIX = 'cl' + 'aude'
const PROVIDER_DNS_PREFIX = 'anth' + 'ropic'

const firstPartyModel = (name: string): ModelName =>
  `${PROVIDER_MODEL_PREFIX}-${name}` as ModelName
const bedrockModel = (name: string): ModelName =>
  `us.${PROVIDER_DNS_PREFIX}.${PROVIDER_MODEL_PREFIX}-${name}-v1:0` as ModelName
const bedrockModelNoRegion = (name: string): ModelName =>
  `${PROVIDER_DNS_PREFIX}.${PROVIDER_MODEL_PREFIX}-${name}` as ModelName
const vertexModel = (name: string, date?: string): ModelName =>
  date
    ? (`${PROVIDER_MODEL_PREFIX}-${name}@${date}` as ModelName)
    : (`${PROVIDER_MODEL_PREFIX}-${name}` as ModelName)

export const SONNET_3_7_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('3-7-sonnet-20250219'),
  bedrock: bedrockModel('3-7-sonnet-20250219'),
  vertex: vertexModel('3-7-sonnet', '20250219'),
  foundry: firstPartyModel('3-7-sonnet'),
} as const satisfies ModelConfig

export const SONNET_3_5_V2_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('3-5-sonnet-20241022'),
  bedrock: bedrockModelNoRegion('3-5-sonnet-20241022-v2:0'),
  vertex: vertexModel('3-5-sonnet-v2', '20241022'),
  foundry: firstPartyModel('3-5-sonnet'),
} as const satisfies ModelConfig

export const HAIKU_3_5_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('3-5-haiku-20241022'),
  bedrock: bedrockModel('3-5-haiku-20241022'),
  vertex: vertexModel('3-5-haiku', '20241022'),
  foundry: firstPartyModel('3-5-haiku'),
} as const satisfies ModelConfig

export const HAIKU_4_5_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('haiku-4-5-20251001'),
  bedrock: bedrockModel('haiku-4-5-20251001'),
  vertex: vertexModel('haiku-4-5', '20251001'),
  foundry: firstPartyModel('haiku-4-5'),
} as const satisfies ModelConfig

export const SONNET_4_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('sonnet-4-20250514'),
  bedrock: bedrockModel('sonnet-4-20250514'),
  vertex: vertexModel('sonnet-4', '20250514'),
  foundry: firstPartyModel('sonnet-4'),
} as const satisfies ModelConfig

export const SONNET_4_5_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('sonnet-4-5-20250929'),
  bedrock: bedrockModel('sonnet-4-5-20250929'),
  vertex: vertexModel('sonnet-4-5', '20250929'),
  foundry: firstPartyModel('sonnet-4-5'),
} as const satisfies ModelConfig

export const OPUS_4_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('opus-4-20250514'),
  bedrock: bedrockModel('opus-4-20250514'),
  vertex: vertexModel('opus-4', '20250514'),
  foundry: firstPartyModel('opus-4'),
} as const satisfies ModelConfig

export const OPUS_4_1_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('opus-4-1-20250805'),
  bedrock: bedrockModel('opus-4-1-20250805'),
  vertex: vertexModel('opus-4-1', '20250805'),
  foundry: firstPartyModel('opus-4-1'),
} as const satisfies ModelConfig

export const OPUS_4_5_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('opus-4-5-20251101'),
  bedrock: bedrockModel('opus-4-5-20251101'),
  vertex: vertexModel('opus-4-5', '20251101'),
  foundry: firstPartyModel('opus-4-5'),
} as const satisfies ModelConfig

export const OPUS_4_6_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('opus-4-6'),
  bedrock: `us.${PROVIDER_DNS_PREFIX}.${PROVIDER_MODEL_PREFIX}-opus-4-6-v1` as ModelName,
  vertex: firstPartyModel('opus-4-6'),
  foundry: firstPartyModel('opus-4-6'),
} as const satisfies ModelConfig

export const SONNET_4_6_PROVIDER_CONFIG = {
  firstParty: firstPartyModel('sonnet-4-6'),
  bedrock: `us.${PROVIDER_DNS_PREFIX}.${PROVIDER_MODEL_PREFIX}-sonnet-4-6` as ModelName,
  vertex: firstPartyModel('sonnet-4-6'),
  foundry: firstPartyModel('sonnet-4-6'),
} as const satisfies ModelConfig

export const ALL_MODEL_CONFIGS = {
  haiku35: HAIKU_3_5_PROVIDER_CONFIG,
  haiku45: HAIKU_4_5_PROVIDER_CONFIG,
  sonnet35: SONNET_3_5_V2_PROVIDER_CONFIG,
  sonnet37: SONNET_3_7_PROVIDER_CONFIG,
  sonnet40: SONNET_4_PROVIDER_CONFIG,
  sonnet45: SONNET_4_5_PROVIDER_CONFIG,
  sonnet46: SONNET_4_6_PROVIDER_CONFIG,
  opus40: OPUS_4_PROVIDER_CONFIG,
  opus41: OPUS_4_1_PROVIDER_CONFIG,
  opus45: OPUS_4_5_PROVIDER_CONFIG,
  opus46: OPUS_4_6_PROVIDER_CONFIG,
} as const satisfies Record<string, ModelConfig>

export type ModelKey = keyof typeof ALL_MODEL_CONFIGS

export type CanonicalModelId =
  (typeof ALL_MODEL_CONFIGS)[ModelKey]['firstParty']

export const CANONICAL_MODEL_IDS = Object.values(ALL_MODEL_CONFIGS).map(
  c => c.firstParty,
) as [CanonicalModelId, ...CanonicalModelId[]]

export const CANONICAL_ID_TO_KEY: Record<CanonicalModelId, ModelKey> =
  Object.fromEntries(
    (Object.entries(ALL_MODEL_CONFIGS) as [ModelKey, ModelConfig][]).map(
      ([key, cfg]) => [cfg.firstParty, key],
    ),
  ) as Record<CanonicalModelId, ModelKey>

export function processConfigsLifecycle(input: unknown) {
  void input
  const state = 'configs-state'
  const lifecycle = 'configs:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
