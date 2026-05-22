/**
 * Model deprecation utilities.
 *
 * Active source returns DSXU-safe public text. Archived matching lives
 * behind the archived boundary.
 */

import { getArchivedDeprecatedModelInfo } from './providerMigration/providerMigrationDeprecation.js'

/**
 * Get a deprecation warning message for a model, or null if not deprecated.
 */
export function getModelDeprecationWarning(
  modelId: string | null,
): string | null {
  if (!modelId) {
    return null
  }

  const info = getArchivedDeprecatedModelInfo(modelId)
  if (!info.isDeprecated) {
    return null
  }

  return `Warning: ${info.modelName} will be retired on ${info.retirementDate}. Consider switching to a newer DSXU model.`
}
