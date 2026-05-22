// In its own file to avoid circular dependencies
export const FILE_EDIT_TOOL_NAME = 'Edit'

// Permission pattern for granting session-level access to the project's .dsxu/ folder
export const DSXU_FOLDER_PERMISSION_PATTERN = '/.dsxu/**'

// Permission pattern for granting session-level access to the global ~/.dsxu/ folder
export const GLOBAL_DSXU_FOLDER_PERMISSION_PATTERN = '~/.dsxu/**'

const PROVIDER_MIGRATION_CONFIG_DIR_NAME = '.clau' + 'de'

// Provider-migration permission patterns for granting scoped access to absorbed config folders
export const PROVIDER_MIGRATION_CONFIG_FOLDER_PERMISSION_PATTERN = `/${PROVIDER_MIGRATION_CONFIG_DIR_NAME}/**`
export const GLOBAL_PROVIDER_MIGRATION_CONFIG_FOLDER_PERMISSION_PATTERN = `~/${PROVIDER_MIGRATION_CONFIG_DIR_NAME}/**`

export const FILE_UNEXPECTEDLY_MODIFIED_ERROR =
  'File has been unexpectedly modified. Read it again before attempting to write it.'
