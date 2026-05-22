import { getDefaultOpusModel } from './providerMigrationModel.js'

export function getArchivedInsightsAnalysisModel(): string {
  return getDefaultOpusModel()
}

export const getProviderMigrationInsightsAnalysisModel =
  getArchivedInsightsAnalysisModel
