/**
 * Model deprecation utilities.
 *
 * Active source returns DSXU-safe public text. Legacy provider matching lives
 * behind the compatibility boundary.
 */

import { getCompatDeprecatedModelInfo } from '../../dsxu/legacy/model/legacyProviderDeprecation.js'

/**
 * Get a deprecation warning message for a model, or null if not deprecated.
 */
export function getModelDeprecationWarning(
  modelId: string | null,
): string | null {
  if (!modelId) {
    return null
  }

  const info = getCompatDeprecatedModelInfo(modelId)
  if (!info.isDeprecated) {
    return null
  }

  return `Warning: ${info.modelName} will be retired on ${info.retirementDate}. Consider switching to a newer DSXU model.`
}


// V14 lifecycle shim: deprecation
export function processDeprecationLifecycle(input) {
  void input
  const state = 'deprecation-state'
  const lifecycle = 'deprecation:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
