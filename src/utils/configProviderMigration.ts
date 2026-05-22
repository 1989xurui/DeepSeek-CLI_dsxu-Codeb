import type { MemoryType } from './memory/types.js'

const PROVIDER_MIGRATION_SOURCE_SHARED_MEMORY_FILE = `${'CL' + 'AUDE'}/md`
const PROVIDER_MIGRATION_SOURCE_LOCAL_MEMORY_FILE = `${'CL' + 'AUDE'}/local/md`

export const PROVIDER_MIGRATION_1M_MERGE_NOTICE_COUNT_KEY =
  'opus1mMergeNoticeSeenCount' as const
export const PROVIDER_MIGRATION_PLAN_WELCOME_KEY =
  'hasShownOpusPlanWelcome' as const
export const PROVIDER_MIGRATION_PRO_MIGRATION_DONE_KEY =
  'opusProMigrationComplete' as const
export const PROVIDER_MIGRATION_PRO_MIGRATION_TIME_KEY =
  'opusProMigrationTimestamp' as const
export const PROVIDER_MIGRATION_1M_MIGRATION_DONE_KEY =
  'sonnet1m45MigrationComplete' as const
// Persisted provider-migration source key; do not rename on disk or old configs lose migration state.
export const PROVIDER_MIGRATION_HIGH_CAPACITY_MIGRATION_TIME_KEY =
  'legacyOpusMigrationTimestamp' as const
export const PROVIDER_MIGRATION_EVERYDAY_MIGRATION_TIME_KEY =
  'sonnet45To46MigrationTimestamp' as const

export function getProviderMigrationMemoryFile(
  memoryType: MemoryType,
): string | null {
  switch (memoryType) {
    case 'User':
    case 'Project':
    case 'Managed':
      return PROVIDER_MIGRATION_SOURCE_SHARED_MEMORY_FILE
    case 'Local':
      return PROVIDER_MIGRATION_SOURCE_LOCAL_MEMORY_FILE
    case 'AutoMem':
    case 'TeamMem':
      return null
  }
}
