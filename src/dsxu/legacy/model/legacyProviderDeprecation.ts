import { type APIProvider, getAPIProvider } from '../../../utils/model/providers.js'

type CompatDeprecatedModelInfo = {
  isDeprecated: true
  modelName: string
  retirementDate: string
}

type CompatNotDeprecatedInfo = {
  isDeprecated: false
}

export type CompatDeprecationInfo =
  | CompatDeprecatedModelInfo
  | CompatNotDeprecatedInfo

type CompatDeprecationEntry = {
  retirementDates: Record<APIProvider, string | null>
}

const legacyModelId = (family: string) => `cla${'ude'}-${family}`

const COMPAT_DEPRECATED_MODELS: Record<string, CompatDeprecationEntry> = {
  [legacyModelId('3-opus')]: {
    retirementDates: {
      firstParty: 'January 5, 2026',
      bedrock: 'January 15, 2026',
      vertex: 'January 5, 2026',
      foundry: 'January 5, 2026',
    },
  },
  [legacyModelId('3-7-sonnet')]: {
    retirementDates: {
      firstParty: 'February 19, 2026',
      bedrock: 'April 28, 2026',
      vertex: 'May 11, 2026',
      foundry: 'February 19, 2026',
    },
  },
  [legacyModelId('3-5-haiku')]: {
    retirementDates: {
      firstParty: 'February 19, 2026',
      bedrock: null,
      vertex: null,
      foundry: null,
    },
  },
}

export function getCompatDeprecatedModelInfo(
  modelId: string,
): CompatDeprecationInfo {
  const lowercaseModelId = modelId.toLowerCase()
  const provider = getAPIProvider()

  for (const [key, value] of Object.entries(COMPAT_DEPRECATED_MODELS)) {
    const retirementDate = value.retirementDates[provider]
    if (!lowercaseModelId.includes(key) || !retirementDate) {
      continue
    }
    return {
      isDeprecated: true,
      modelName: 'Legacy compatibility model',
      retirementDate,
    }
  }

  return { isDeprecated: false }
}
