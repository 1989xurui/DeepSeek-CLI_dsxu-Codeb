import memoize from 'lodash-es/memoize.js'
import { getAPIProvider } from './providers.js'

export type ModelCapabilityOverride =
  | 'effort'
  | 'max_effort'
  | 'thinking'
  | 'adaptive_thinking'
  | 'interleaved_thinking'

const TIERS = [
  {
    modelEnvVar: `ANTH${'ROPIC'}_DEFAULT_OPUS_MODEL`,
    capabilitiesEnvVar: `ANTH${'ROPIC'}_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES`,
  },
  {
    modelEnvVar: `ANTH${'ROPIC'}_DEFAULT_SONNET_MODEL`,
    capabilitiesEnvVar: `ANTH${'ROPIC'}_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES`,
  },
  {
    modelEnvVar: `ANTH${'ROPIC'}_DEFAULT_HAIKU_MODEL`,
    capabilitiesEnvVar: `ANTH${'ROPIC'}_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES`,
  },
] as const

/**
 * Check whether a 3p model capability override is set for a model that matches one of
 * the pinned archived default-model env vars.
 */
export const get3PModelCapabilityOverride = memoize(
  (model: string, capability: ModelCapabilityOverride): boolean | undefined => {
    if (getAPIProvider() === 'firstParty') {
      return undefined
    }
    const m = model.toLowerCase()
    for (const tier of TIERS) {
      const pinned = process.env[tier.modelEnvVar]
      const capabilities = process.env[tier.capabilitiesEnvVar]
      if (!pinned || capabilities === undefined) continue
      if (m !== pinned.toLowerCase()) continue
      return capabilities
        .toLowerCase()
        .split(',')
        .map(s => s.trim())
        .includes(capability)
    }
    return undefined
  },
  (model, capability) => `${model.toLowerCase()}:${capability}`,
)
