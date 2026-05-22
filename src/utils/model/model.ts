// DSXU model facade.
//
// Keep the public import path stable while making the provider-migration boundary
// explicit. Do not use a blanket export here: public callers should depend only
// on the reviewed symbols below, while provider-family migration behavior stays in
// the hidden provider-migration module.

export type {
  ModelName,
  ModelSetting,
  ModelShortName,
} from './providerMigration/providerMigrationModel.js'

export {
  firstPartyNameToCanonical,
  getCanonicalName,
  getDefaultMainLoopModel,
  getDefaultMainLoopModelSetting,
  getProviderMigrationUserDefaultModelDescription,
  getMainLoopModel,
  getMarketingNameForModel,
  getPublicModelDisplayName,
  getPublicModelName,
  getRuntimeMainLoopModel,
  getSmallFastModel,
  getThirdPartyProviderMigrationFallbackModelSuggestion,
  getUserSpecifiedModelSetting,
  isProviderMigrationHighTierModelTarget,
  isProviderMigrationModelRemapEnabled,
  modelDisplayString,
  normalizeModelStringForAPI,
  parseUserSpecifiedModel,
  renderDefaultModelSetting,
  renderModelName,
  renderModelSetting,
  resolveSkillModelOverride,
} from './providerMigration/providerMigrationModel.js'
