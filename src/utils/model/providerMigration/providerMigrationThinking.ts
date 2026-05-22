import { resolveAntModel } from '../antModels.js'
import type { APIProvider } from '../providers.js'

export function supportsArchivedThinking(input: {
  canonical: string
  model: string
  provider: APIProvider
  userType?: string
}): boolean {
  if (input.userType === 'ant' && resolveAntModel(input.model.toLowerCase())) {
    return true
  }
  if (input.provider === 'foundry' || input.provider === 'firstParty') {
    return !input.canonical.includes('dsxu-3-')
  }
  return (
    input.canonical.includes('sonnet-4') ||
    input.canonical.includes('opus-4')
  )
}

export function supportsArchivedAdaptiveThinking(canonical: string): boolean | undefined {
  if (canonical.includes('opus-4-6') || canonical.includes('sonnet-4-6')) {
    return true
  }
  if (
    canonical.includes('opus') ||
    canonical.includes('sonnet') ||
    canonical.includes('haiku')
  ) {
    return false
  }
  return undefined
}

export const supportsProviderMigrationThinking = supportsArchivedThinking
export const supportsProviderMigrationAdaptiveThinking =
  supportsArchivedAdaptiveThinking
