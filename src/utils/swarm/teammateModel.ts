import { OPUS_4_6_PROVIDER_CONFIG } from '../model/configs.js'
import { getAPIProvider } from '../model/providers.js'

// @[MODEL LAUNCH]: Update the fallback model below.
// When the user has never set teammateDefaultModel in /config, new teammates
// use the provider-aware high-tier fallback so non-DSXU customers get the
// correct compatibility model ID.
export function getHardcodedTeammateModelFallback(): string {
  return OPUS_4_6_PROVIDER_CONFIG[getAPIProvider()]
}
