import { migrateFennecToOpus } from './migrateFennecToOpus.js'
import { migrateLegacyOpusToCurrent } from './migrateLegacyOpusToCurrent.js'
import { migrateSonnet1mToSonnet45 } from './migrateSonnet1mToSonnet45.js'
import { migrateSonnet45ToSonnet46 } from './migrateSonnet45ToSonnet46.js'
import { resetProToOpusDefault } from './resetProToOpusDefault.js'
import { isDsxuRuntimeMode } from '../utils/envUtils.js'

/**
 * DSXU-owned facade for old provider model migrations.
 *
 * The underlying files keep their historical names until release packaging
 * decides whether to rename, hide, or exclude them. Mainline startup imports
 * this neutral facade so public DSXU paths do not depend on old model-family
 * names directly.
 */
function shouldSkipLegacyProviderMigration(): boolean {
  return isDsxuRuntimeMode()
}

export function runLegacyProviderDefaultModelMigration(): void {
  if (shouldSkipLegacyProviderMigration()) return
  resetProToOpusDefault()
}

export function runLegacyProviderLongContextPinMigration(): void {
  if (shouldSkipLegacyProviderMigration()) return
  migrateSonnet1mToSonnet45()
}

export function runLegacyProviderExplicitModelCleanup(): void {
  if (shouldSkipLegacyProviderMigration()) return
  migrateLegacyOpusToCurrent()
}

export function runLegacyProviderTierModelCleanup(): void {
  if (shouldSkipLegacyProviderMigration()) return
  migrateSonnet45ToSonnet46()
}

export function runLegacyExternalProviderAliasMigration(): void {
  if (shouldSkipLegacyProviderMigration()) return
  migrateFennecToOpus()
}
