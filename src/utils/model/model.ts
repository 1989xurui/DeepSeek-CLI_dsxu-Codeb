// DSXU model facade.
//
// Keep the public import path stable while making the archived boundary
// explicit. Do not use a blanket export here: public callers should depend only
// on the reviewed symbols below, while archived provider-family behavior stays in
// the hidden archived module.

export type {
  ModelName,
  ModelSetting,
  ModelShortName,
} from './providerMigration/providerMigrationModel.js'

export {
  firstPartyNameToCanonical,
  getArchivedThirdPartyFallbackModelSuggestion,
  getArchivedUserDefaultModelDescription,
  getCanonicalName,
  getDefaultMainLoopModel,
  getDefaultMainLoopModelSetting,
  getMainLoopModel,
  getMarketingNameForModel,
  getPublicModelDisplayName,
  getPublicModelName,
  getRuntimeMainLoopModel,
  getSmallFastModel,
  getUserSpecifiedModelSetting,
  isArchivedHighTierModelTarget,
  isArchivedModelRemapEnabled,
  modelDisplayString,
  normalizeModelStringForAPI,
  parseUserSpecifiedModel,
  renderDefaultModelSetting,
  renderModelName,
  renderModelSetting,
  resolveSkillModelOverride,
} from './providerMigration/providerMigrationModel.js'
