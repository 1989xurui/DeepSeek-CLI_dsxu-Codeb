import { migrateFennecToOpus } from './migrateFennecToOpus.js'
import { migrateLegacyOpusToCurrent } from './migrateLegacyOpusToCurrent.js'
import { migrateSonnet1mToSonnet45 } from './migrateSonnet1mToSonnet45.js'
import { migrateSonnet45ToSonnet46 } from './migrateSonnet45ToSonnet46.js'
import { resetProToOpusDefault } from './resetProToOpusDefault.js'
import { isDsxuRuntimeMode } from '../utils/envUtils.js'

/**
 * DSXU-owned facade for archived source model migrations.
 *
 * The underlying files keep their historical names until release packaging
 * decides whether to rename, hide, or exclude them. Mainline startup imports
 * this neutral facade so public DSXU paths do not depend on old model-family
 * names directly.
 */
function shouldSkipProviderMigrationModelMigration(): boolean {
  return isDsxuRuntimeMode()
}

export function runProviderMigrationDefaultModelMigration(): void {
  if (shouldSkipProviderMigrationModelMigration()) return
  resetProToOpusDefault()
}

export function runProviderMigrationLongContextPinMigration(): void {
  if (shouldSkipProviderMigrationModelMigration()) return
  migrateSonnet1mToSonnet45()
}

export function runProviderMigrationExplicitModelCleanup(): void {
  if (shouldSkipProviderMigrationModelMigration()) return
  migrateLegacyOpusToCurrent()
}

export function runProviderMigrationTierModelCleanup(): void {
  if (shouldSkipProviderMigrationModelMigration()) return
  migrateSonnet45ToSonnet46()
}

export function runProviderMigrationExternalProviderAliasMigration(): void {
  if (shouldSkipProviderMigrationModelMigration()) return
  migrateFennecToOpus()
}
