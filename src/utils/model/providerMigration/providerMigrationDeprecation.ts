import { type APIProvider, getAPIProvider } from '../providers.js'

type ArchivedDeprecatedModelInfo = {
  isDeprecated: true
  modelName: string
  retirementDate: string
}

type ArchivedNotDeprecatedInfo = {
  isDeprecated: false
}

export type ArchivedDeprecationInfo =
  | ArchivedDeprecatedModelInfo
  | ArchivedNotDeprecatedInfo

export type ProviderMigrationDeprecationInfo = ArchivedDeprecationInfo

type ArchivedDeprecationEntry = {
  retirementDates: Record<APIProvider, string | null>
}

const archivedSourceModelId = (family: string) => `cla${'ude'}-${family}`

const ARCHIVED_DEPRECATED_MODELS: Record<string, ArchivedDeprecationEntry> = {
  [archivedSourceModelId('3-opus')]: {
    retirementDates: {
      firstParty: 'January 5, 2026',
      bedrock: 'January 15, 2026',
      vertex: 'January 5, 2026',
      foundry: 'January 5, 2026',
    },
  },
  [archivedSourceModelId('3-7-sonnet')]: {
    retirementDates: {
      firstParty: 'February 19, 2026',
      bedrock: 'April 28, 2026',
      vertex: 'May 11, 2026',
      foundry: 'February 19, 2026',
    },
  },
  [archivedSourceModelId('3-5-haiku')]: {
    retirementDates: {
      firstParty: 'February 19, 2026',
      bedrock: null,
      vertex: null,
      foundry: null,
    },
  },
}

export function getArchivedDeprecatedModelInfo(
  modelId: string,
): ArchivedDeprecationInfo {
  const lowercaseModelId = modelId.toLowerCase()
  const provider = getAPIProvider()

  for (const [key, value] of Object.entries(ARCHIVED_DEPRECATED_MODELS)) {
    const retirementDate = value.retirementDates[provider]
    if (!lowercaseModelId.includes(key) || !retirementDate) {
      continue
    }
    return {
      isDeprecated: true,
      modelName: 'Provider migration model alias',
      retirementDate,
    }
  }

  return { isDeprecated: false }
}

export const getProviderMigrationDeprecatedModelInfo =
  getArchivedDeprecatedModelInfo
