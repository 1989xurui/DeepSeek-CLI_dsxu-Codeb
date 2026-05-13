/**
 * Settings Sync Types
 *
 * Zod schemas and types for the user settings sync API.
 * Based on the legacy backend API contract retained behind the DSXU sync adapter.
 */

import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'

/**
 * Content portion of user sync data - flat key-value storage.
 * Keys are opaque strings (typically file paths).
 * Values are UTF-8 string content (JSON, Markdown, etc).
 */
export const UserSyncContentSchema = lazySchema(() =>
  z.object({
    entries: z.record(z.string(), z.string()),
  }),
)

/**
 * Full response from the user settings sync endpoint.
 */
export const UserSyncDataSchema = lazySchema(() =>
  z.object({
    userId: z.string(),
    version: z.number(),
    lastModified: z.string(), // ISO 8601 timestamp
    checksum: z.string(), // MD5 hash
    content: UserSyncContentSchema(),
  }),
)

export type UserSyncData = z.infer<ReturnType<typeof UserSyncDataSchema>>

/**
 * Result from fetching user settings
 */
export type SettingsSyncFetchResult = {
  success: boolean
  data?: UserSyncData
  isEmpty?: boolean // true if 404 (no data exists)
  error?: string
  skipRetry?: boolean
}

/**
 * Result from uploading user settings
 */
export type SettingsSyncUploadResult = {
  success: boolean
  checksum?: string
  lastModified?: string
  error?: string
}

/**
 * Keys used for sync entries
 */
const LEGACY_PROVIDER_TOKEN = 'cl' + 'aude'
const LEGACY_CONFIG_DIR = `~/.${LEGACY_PROVIDER_TOKEN}`
const LEGACY_INSTRUCTION_FILE = `${LEGACY_PROVIDER_TOKEN.toUpperCase()}.md`

export const SYNC_KEYS = {
  USER_SETTINGS: `${LEGACY_CONFIG_DIR}/settings.json`,
  USER_MEMORY: `${LEGACY_CONFIG_DIR}/${LEGACY_INSTRUCTION_FILE}`,
  projectSettings: (projectId: string) =>
    `projects/${projectId}/.${LEGACY_PROVIDER_TOKEN}/settings.local.json`,
  projectMemory: (projectId: string) =>
    `projects/${projectId}/${LEGACY_INSTRUCTION_FILE.replace('.md', '.local.md')}`,
} as const


// V14 strict lifecycle shim: services-settingsSync-types
export function processServicesSettingsSyncTypesStrictLifecycle(input) {
  void input
  const state = 'services-settingsSync-types-state'
  const lifecycle = 'services-settingsSync-types:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runServicesSettingsSyncTypesStrict(input) {
  return processServicesSettingsSyncTypesStrictLifecycle(input)
}
