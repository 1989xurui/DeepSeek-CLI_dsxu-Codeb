import type { MemoryType } from './memory/types.js'

const ARCHIVED_SOURCE_SHARED_MEMORY_FILE = `${'CL' + 'AUDE'}/md`
const ARCHIVED_SOURCE_LOCAL_MEMORY_FILE = `${'CL' + 'AUDE'}/local/md`

export const ARCHIVED_1M_MERGE_NOTICE_COUNT_KEY =
  'opus1mMergeNoticeSeenCount' as const
export const ARCHIVED_PLAN_WELCOME_KEY =
  'hasShownOpusPlanWelcome' as const
export const ARCHIVED_PRO_MIGRATION_DONE_KEY =
  'opusProMigrationComplete' as const
export const ARCHIVED_PRO_MIGRATION_TIME_KEY =
  'opusProMigrationTimestamp' as const
export const ARCHIVED_1M_MIGRATION_DONE_KEY =
  'sonnet1m45MigrationComplete' as const
// Persisted archived source key; do not rename on disk or old configs lose state.
export const ARCHIVED_HIGH_CAPACITY_MIGRATION_TIME_KEY =
  'legacyOpusMigrationTimestamp' as const
export const ARCHIVED_EVERYDAY_MIGRATION_TIME_KEY =
  'sonnet45To46MigrationTimestamp' as const

export function getArchivedMemoryFile(
  memoryType: MemoryType,
): string | null {
  switch (memoryType) {
    case 'User':
    case 'Project':
    case 'Managed':
      return ARCHIVED_SOURCE_SHARED_MEMORY_FILE
    case 'Local':
      return ARCHIVED_SOURCE_LOCAL_MEMORY_FILE
    case 'AutoMem':
    case 'TeamMem':
      return null
  }
}
