// DSXU model facade.
//
// Keep the public import path stable while making the compatibility boundary
// explicit. Do not use a blanket export here: public callers should depend only
// on the reviewed symbols below, while provider-family compatibility stays in
// the hidden compat module.

export type {
  ModelName,
  ModelSetting,
  ModelShortName,
} from '../../dsxu/legacy/model/legacyProviderModel.js'

export {
  firstPartyNameToCanonical,
  getCanonicalName,
  getDefaultMainLoopModel,
  getDefaultMainLoopModelSetting,
  getLegacyCloudUserDefaultModelDescription,
  getMainLoopModel,
  getMarketingNameForModel,
  getPublicModelDisplayName,
  getPublicModelName,
  getRuntimeMainLoopModel,
  getSmallFastModel,
  getThirdPartyCompatFallbackModelSuggestion,
  getUserSpecifiedModelSetting,
  isCompatHighTierModelTarget,
  isLegacyModelRemapEnabled,
  modelDisplayString,
  normalizeModelStringForAPI,
  parseUserSpecifiedModel,
  renderDefaultModelSetting,
  renderModelName,
  renderModelSetting,
  resolveSkillModelOverride,
} from '../../dsxu/legacy/model/legacyProviderModel.js'
