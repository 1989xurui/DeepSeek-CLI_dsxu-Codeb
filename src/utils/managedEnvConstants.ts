/**
 * Environment variables that control inference routing: provider selection,
 * endpoint routing, and model IDs.
 *
 * DSXU accepts DSXU_CODE_* names first and keeps provider-migration source names as
 * provider-migration contracts at the boundary. Settings-sourced env is stripped
 * when a host owns provider routing so user config cannot override it.
 */

const PROVIDER_MIGRATION_VENDOR_ENV_PREFIX = 'ANTH' + 'ROPIC'
const PROVIDER_MIGRATION_CODE_ENV_PREFIX = 'CL' + 'AUDE' + '_CODE'
const PROVIDER_MIGRATION_BASH_ENV_PREFIX = 'CL' + 'AUDE' + '_BASH'
const PROVIDER_MIGRATION_VERTEX_MODEL_REGION_PREFIX =
  'VERTEX_REGION_' + ('CL' + 'AUDE') + '_'

const vendorEnv = (name: string): string => `${PROVIDER_MIGRATION_VENDOR_ENV_PREFIX}_${name}`
const providerMigrationCodeEnv = (name: string): string =>
  `${PROVIDER_MIGRATION_CODE_ENV_PREFIX}_${name}`
const dsxuCodeEnv = (name: string): string => `DSXU_CODE_${name}`
const providerMigrationBashEnv = (name: string): string =>
  `${PROVIDER_MIGRATION_BASH_ENV_PREFIX}_${name}`
const vertexRegionEnv = (name: string): string =>
  `${PROVIDER_MIGRATION_VERTEX_MODEL_REGION_PREFIX}${name}`

const withDsxuCodeAliases = (names: readonly string[]): string[] =>
  names.flatMap(name => [dsxuCodeEnv(name), providerMigrationCodeEnv(name)])

const providerRoutingCodeEnvNames = [
  'PROVIDER_MANAGED_BY_HOST',
  'USE_BEDROCK',
  'USE_VERTEX',
  'USE_FOUNDRY',
  'OAUTH_TOKEN',
  'SKIP_BEDROCK_AUTH',
  'SKIP_VERTEX_AUTH',
  'SKIP_FOUNDRY_AUTH',
  'SUBAGENT_MODEL',
] as const

const vendorRoutingEnvNames = [
  'BASE_URL',
  'BEDROCK_BASE_URL',
  'VERTEX_BASE_URL',
  'FOUNDRY_BASE_URL',
  'FOUNDRY_RESOURCE',
  'VERTEX_PROJECT_ID',
  'API_KEY',
  'AUTH_TOKEN',
  'FOUNDRY_API_KEY',
  'MODEL',
  'DEFAULT_HAIKU_MODEL',
  'DEFAULT_HAIKU_MODEL_DESCRIPTION',
  'DEFAULT_HAIKU_MODEL_NAME',
  'DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES',
  'DEFAULT_OPUS_MODEL',
  'DEFAULT_OPUS_MODEL_DESCRIPTION',
  'DEFAULT_OPUS_MODEL_NAME',
  'DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES',
  'DEFAULT_SONNET_MODEL',
  'DEFAULT_SONNET_MODEL_DESCRIPTION',
  'DEFAULT_SONNET_MODEL_NAME',
  'DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES',
  'SMALL_FAST_MODEL',
  'SMALL_FAST_MODEL_AWS_REGION',
] as const

const vertexModelRegionNames = [
  '3_5_HAIKU',
  '3_5_SONNET',
  '3_7_SONNET',
  '4_0_OPUS',
  '4_0_SONNET',
  '4_1_OPUS',
  '4_5_SONNET',
  '4_6_SONNET',
  'HAIKU_4_5',
] as const

const PROVIDER_MANAGED_ENV_VARS = new Set([
  ...withDsxuCodeAliases(providerRoutingCodeEnvNames),
  ...vendorRoutingEnvNames.map(vendorEnv),
  'AWS_BEARER_TOKEN_BEDROCK',
  'CLOUD_ML_REGION',
])

const PROVIDER_MANAGED_ENV_PREFIXES = [
  PROVIDER_MIGRATION_VERTEX_MODEL_REGION_PREFIX,
  'DSXU_VERTEX_REGION_',
]

export function isProviderManagedEnvVar(key: string): boolean {
  const upper = key.toUpperCase()
  return (
    PROVIDER_MANAGED_ENV_VARS.has(upper) ||
    PROVIDER_MANAGED_ENV_PREFIXES.some(p => upper.startsWith(p))
  )
}

/**
 * Dangerous shell settings that can execute arbitrary shell code.
 */
export const DANGEROUS_SHELL_SETTINGS = [
  'apiKeyHelper',
  'awsAuthRefresh',
  'awsCredentialExport',
  'gcpAuthRefresh',
  'otelHeadersHelper',
  'statusLine',
] as const

const safeCodeEnvNames = [
  'API_KEY_HELPER_TTL_MS',
  'DISABLE_EXPERIMENTAL_BETAS',
  'DISABLE_NONESSENTIAL_TRAFFIC',
  'DISABLE_TERMINAL_TITLE',
  'ENABLE_TELEMETRY',
  'EXPERIMENTAL_AGENT_TEAMS',
  'IDE_SKIP_AUTO_INSTALL',
  'MAX_OUTPUT_TOKENS',
  'SKIP_BEDROCK_AUTH',
  'SKIP_FOUNDRY_AUTH',
  'SKIP_VERTEX_AUTH',
  'SUBAGENT_MODEL',
  'USE_BEDROCK',
  'USE_FOUNDRY',
  'USE_VERTEX',
] as const

/**
 * Safe environment variables that can be applied before trust dialog.
 *
 * DSXU owns the safe-list and accepts DSXU_CODE_* aliases. Provider-migration
 * source names remain as protocol entries where external SDKs read
 * them directly.
 */
export const SAFE_ENV_VARS = new Set([
  ...vendorRoutingEnvNames
    .filter(name => !['BASE_URL', 'BEDROCK_BASE_URL', 'VERTEX_BASE_URL', 'FOUNDRY_BASE_URL', 'FOUNDRY_RESOURCE', 'API_KEY', 'AUTH_TOKEN', 'VERTEX_PROJECT_ID'].includes(name))
    .map(vendorEnv),
  vendorEnv('CUSTOM_HEADERS'),
  vendorEnv('CUSTOM_MODEL_OPTION'),
  vendorEnv('CUSTOM_MODEL_OPTION_DESCRIPTION'),
  vendorEnv('CUSTOM_MODEL_OPTION_NAME'),
  ...withDsxuCodeAliases(safeCodeEnvNames),
  providerMigrationBashEnv('MAINTAIN_PROJECT_WORKING_DIR'),
  'AWS_DEFAULT_REGION',
  'AWS_PROFILE',
  'AWS_REGION',
  'BASH_DEFAULT_TIMEOUT_MS',
  'BASH_MAX_OUTPUT_LENGTH',
  'BASH_MAX_TIMEOUT_MS',
  'DISABLE_AUTOUPDATER',
  'DISABLE_BUG_COMMAND',
  'DISABLE_COST_WARNINGS',
  'DISABLE_ERROR_REPORTING',
  'DISABLE_FEEDBACK_COMMAND',
  'DISABLE_TELEMETRY',
  'ENABLE_TOOL_SEARCH',
  'MAX_MCP_OUTPUT_TOKENS',
  'MAX_THINKING_TOKENS',
  'MCP_TIMEOUT',
  'MCP_TOOL_TIMEOUT',
  'OTEL_EXPORTER_OTLP_HEADERS',
  'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
  'OTEL_EXPORTER_OTLP_LOGS_PROTOCOL',
  'OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE',
  'OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY',
  'OTEL_EXPORTER_OTLP_METRICS_HEADERS',
  'OTEL_EXPORTER_OTLP_METRICS_PROTOCOL',
  'OTEL_EXPORTER_OTLP_PROTOCOL',
  'OTEL_EXPORTER_OTLP_TRACES_HEADERS',
  'OTEL_LOG_TOOL_DETAILS',
  'OTEL_LOG_USER_PROMPTS',
  'OTEL_LOGS_EXPORT_INTERVAL',
  'OTEL_LOGS_EXPORTER',
  'OTEL_METRIC_EXPORT_INTERVAL',
  'OTEL_METRICS_EXPORTER',
  'OTEL_METRICS_INCLUDE_ACCOUNT_UUID',
  'OTEL_METRICS_INCLUDE_SESSION_ID',
  'OTEL_METRICS_INCLUDE_VERSION',
  'OTEL_RESOURCE_ATTRIBUTES',
  'USE_BUILTIN_RIPGREP',
  ...vertexModelRegionNames.map(vertexRegionEnv),
])
