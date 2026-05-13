import type { MemoryType } from '../../../utils/memory/types.js'

const LEGACY_SHARED_MEMORY_FILE = `${'CL' + 'AUDE'}.md`
const LEGACY_LOCAL_MEMORY_FILE = `${'CL' + 'AUDE'}.local.md`

export const COMPAT_1M_MERGE_NOTICE_COUNT_KEY =
  'opus1mMergeNoticeSeenCount' as const
export const COMPAT_PLAN_WELCOME_KEY = 'hasShownOpusPlanWelcome' as const
export const COMPAT_PRO_MIGRATION_DONE_KEY =
  'opusProMigrationComplete' as const
export const COMPAT_PRO_MIGRATION_TIME_KEY =
  'opusProMigrationTimestamp' as const
export const COMPAT_1M_MIGRATION_DONE_KEY =
  'sonnet1m45MigrationComplete' as const
export const COMPAT_HIGH_CAPACITY_MIGRATION_TIME_KEY =
  'legacyOpusMigrationTimestamp' as const
export const COMPAT_EVERYDAY_MIGRATION_TIME_KEY =
  'sonnet45To46MigrationTimestamp' as const

export function getCompatLegacyMemoryFile(memoryType: MemoryType): string | null {
  switch (memoryType) {
    case 'User':
    case 'Project':
    case 'Managed':
      return LEGACY_SHARED_MEMORY_FILE
    case 'Local':
      return LEGACY_LOCAL_MEMORY_FILE
    case 'AutoMem':
    case 'TeamMem':
      return null
  }
}
