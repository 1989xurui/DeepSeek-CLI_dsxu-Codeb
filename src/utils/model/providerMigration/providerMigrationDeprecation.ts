import { type APIProvider, getAPIProvider } from '../providers.js'

type ProviderMigrationDeprecatedModelInfo = {
  isDeprecated: true
  modelName: string
  retirementDate: string
}

type ProviderMigrationNotDeprecatedInfo = {
  isDeprecated: false
}

export type ProviderMigrationDeprecationInfo =
  | ProviderMigrationDeprecatedModelInfo
  | ProviderMigrationNotDeprecatedInfo

type ProviderMigrationDeprecationEntry = {
  retirementDates: Record<APIProvider, string | null>
}

const providerMigrationSourceModelId = (family: string) => `cla${'ude'}-${family}`

const PROVIDER_MIGRATION_DEPRECATED_MODELS: Record<string, ProviderMigrationDeprecationEntry> = {
  [providerMigrationSourceModelId('3-opus')]: {
    retirementDates: {
      firstParty: 'January 5, 2026',
      bedrock: 'January 15, 2026',
      vertex: 'January 5, 2026',
      foundry: 'January 5, 2026',
    },
  },
  [providerMigrationSourceModelId('3-7-sonnet')]: {
    retirementDates: {
      firstParty: 'February 19, 2026',
      bedrock: 'April 28, 2026',
      vertex: 'May 11, 2026',
      foundry: 'February 19, 2026',
    },
  },
  [providerMigrationSourceModelId('3-5-haiku')]: {
    retirementDates: {
      firstParty: 'February 19, 2026',
      bedrock: null,
      vertex: null,
      foundry: null,
    },
  },
}

export function getProviderMigrationDeprecatedModelInfo(
  modelId: string,
): ProviderMigrationDeprecationInfo {
  const lowercaseModelId = modelId.toLowerCase()
  const provider = getAPIProvider()

  for (const [key, value] of Object.entries(PROVIDER_MIGRATION_DEPRECATED_MODELS)) {
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
